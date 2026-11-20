/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-error";
import { MetricsModulePage } from "../metrics/MetricsModulePage";
import { RunsModulePage } from "./RunsModulePage";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
const strict = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
const clip = vi.hoisted(() => ({
  copyTextToClipboard: vi.fn((text: string) => Promise.resolve(Boolean(text))),
}));

vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));
vi.mock("@/modules/models/fetchJson", () => ({ fetchJsonStrict: strict.fetchJsonStrict }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clip.copyTextToClipboard }));

const ASOF = "2026-11-19T20:12:00.000Z";

const RUN_A = {
  runId: "rn_01M7822COPY0001",
  status: "completed",
  startedAt: "2026-11-18T02:00:00Z",
  endedAt: "2026-11-18T02:11:00Z",
  costUsd: 1,
  costStatus: "known",
  employeeId: "emp_aaaabbbbcccc",
};
const RUN_B = {
  runId: "rn_01M7822COPY0002",
  status: "failed",
  startedAt: "2026-11-18T03:30:00Z",
  costUsd: null,
  costStatus: "missing",
};

let pending: Array<() => void> = [];
let runsMode: "ok" | "hold" | "fail" = "ok";
let runsFail: unknown = null;
let metricsMode: "ok" | "hold" | "fail" = "ok";
let metricsFail: unknown = null;

function runsHandler(url: string): Promise<unknown> {
  if (url.includes("/api/runs")) {
    if (runsMode === "hold") {
      return new Promise((resolve) => {
        pending.push(() => resolve({ items: [RUN_A, RUN_B], nextCursor: null, asOf: ASOF, asOfSource: "bff" }));
      });
    }
    if (runsMode === "fail") return Promise.reject(runsFail);
    return Promise.resolve({ items: [RUN_A, RUN_B], nextCursor: null, asOf: ASOF, asOfSource: "bff" });
  }
  return Promise.resolve({ items: [], asOf: ASOF });
}

function metricsBody(url: string): unknown {
  if (url.includes("/api/run-stats")) {
    return { totals: { runs: 5 }, buckets: [], asOf: ASOF, asOfSource: "bff" };
  }
  if (url.includes("/api/run-activity")) return { cells: [], max: null, from: ASOF, to: ASOF, tz: "Asia/Shanghai", asOf: ASOF };
  if (url.includes("/api/employees")) return { items: [], asOf: ASOF };
  if (url.includes("/api/budget-usage")) return { items: [], missingEmployeeIds: [], asOf: ASOF };
  if (url.includes("/api/models/pricing")) return { prices: [], asOf: ASOF };
  if (url.includes("/api/hermes-usage")) return { by_model: [], asOf: ASOF };
  return { items: [], asOf: ASOF };
}

function metricsHandler(url: string): Promise<unknown> {
  if (url.includes("/api/run-stats")) {
    if (metricsMode === "fail") return Promise.reject(metricsFail);
  }
  if (metricsMode === "fail" && !url.includes("/api/run-stats")) {
    // keep one slow sibling in flight so React can flush the failed source stamps
    // before the page judges the batch
    return new Promise((resolve) => {
      setTimeout(() => resolve(metricsBody(url)), 40);
    });
  }
  if (url.includes("/api/run-stats") && metricsMode === "hold") {
    return new Promise((resolve) => {
      pending.push(() => resolve({ totals: { runs: 5 }, buckets: [], asOf: ASOF, asOfSource: "bff" }));
    });
  }
  return Promise.resolve(metricsBody(url));
}

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  for (let i = 0; i < 400; i += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  throw new Error(`timeout: ${label}`);
}

async function releaseAll(): Promise<void> {
  for (let i = 0; i < 60 && pending.length > 0; i += 1) {
    const next = pending.shift();
    if (next) next();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

const roots: Root[] = [];
const hosts: HTMLElement[] = [];

async function mount(page: ReactNode, entry: string): Promise<void> {
  const host = document.createElement("div");
  document.body.append(host);
  hosts.push(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[entry]}>{page}</MemoryRouter>);
  });
}

function node(testid: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${testid}"]`);
}

function textOf(testid: string): string {
  return node(testid)?.textContent ?? "";
}

function click(testid: string): void {
  const el = node(testid);
  if (!el) throw new Error(`missing ${testid}`);
  act(() => {
    (el as HTMLElement).click();
  });
}

function calls(fn: { mock: { calls: unknown[][] } }, fragment: string): number {
  return fn.mock.calls.filter((call) => String(call[0]).includes(fragment)).length;
}

async function openRuns(entry = "/runs"): Promise<void> {
  api.fetchJSON.mockImplementation((url: string) => runsHandler(url));
  await mount(<RunsModulePage />, entry);
  await waitFor(() => textOf("run5-counts").length > 0, "runs ready");
}

async function openMetrics(entry = "/metrics"): Promise<void> {
  strict.fetchJsonStrict.mockImplementation((url: string) => metricsHandler(url));
  await mount(<MetricsModulePage />, entry);
  await waitFor(() => node("met6-runs-value") !== null, "metrics ready");
  await waitFor(() => document.querySelector(".met5-skeleton") === null, "metrics settled");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
}

beforeEach(() => {
  pending = [];
  runsMode = "ok";
  runsFail = null;
  metricsMode = "ok";
  metricsFail = null;
  api.fetchJSON.mockReset();
  strict.fetchJsonStrict.mockReset();
  clip.copyTextToClipboard.mockClear();
  clip.copyTextToClipboard.mockImplementation((text: string) => Promise.resolve(Boolean(text)));
});

afterEach(async () => {
  await act(async () => {
    roots.splice(0).forEach((root) => root.unmount());
  });
  hosts.splice(0).forEach((host) => host.remove());
});

describe("refresh parity across runs and metrics", () => {
  it("uses one native busy-gated button per page and swallows the second click", async () => {
    await openRuns();
    const runsButton = node("run-refresh");
    expect(runsButton?.tagName).toBe("BUTTON");
    expect(runsButton?.getAttribute("aria-busy")).toBe("false");

    const runsBefore = calls(api.fetchJSON, "/api/runs");
    runsMode = "hold";
    click("run-refresh");
    await waitFor(() => node("run-busy-note") !== null, "runs busy");
    expect(node("run-refresh")?.getAttribute("aria-busy")).toBe("true");
    expect(textOf("run-busy-note")).toContain("更新中");
    click("run-refresh");
    click("run-refresh");
    await releaseAll();
    await waitFor(() => node("run-busy-note") === null, "runs idle");
    expect(calls(api.fetchJSON, "/api/runs") - runsBefore).toBe(1);
    expect(document.querySelectorAll("[data-testid^='run5-row-'][data-status]").length).toBe(2);

    runsMode = "ok";
    await openMetrics();
    const metricsButton = node("metAK-refresh");
    expect(metricsButton?.tagName).toBe("BUTTON");
    expect(metricsButton?.getAttribute("aria-busy")).toBe("false");

    const statsBefore = calls(strict.fetchJsonStrict, "/api/run-stats");
    metricsMode = "hold";
    click("metAK-refresh");
    await waitFor(() => node("metAK-busy-note") !== null, "metrics busy");
    expect(node("metAK-refresh")?.getAttribute("aria-busy")).toBe("true");
    click("metAK-refresh");
    click("metAK-refresh");
    await releaseAll();
    await waitFor(() => node("metAK-busy-note") === null, "metrics idle");
    // one refresh batch re-reads the same sources as the first load, nothing more
    expect(statsBefore).toBeGreaterThan(0);
    expect(calls(strict.fetchJsonStrict, "/api/run-stats") - statsBefore).toBe(statsBefore);
  });

  it("keeps the old data on failure and offers a copyable request id plus a retry", async () => {
    await openRuns();
    const rowsBefore = document.querySelectorAll("[data-testid^='run5-row-'][data-status]").length;
    runsMode = "fail";
    runsFail = new ApiError("upstream said no", {
      status: 500,
      body: "",
      url: "/agent-api/api/runs",
      requestId: "req-runs-refresh",
    });
    click("run-refresh");
    await waitFor(() => node("run-refresh-error") !== null, "runs refresh failed");
    expect(document.querySelectorAll("[data-testid^='run5-row-'][data-status]").length).toBe(rowsBefore);
    expect(textOf("run-refresh-error")).toContain("req-runs-refresh");
    expect(textOf("run-refresh-rid")).toContain("req-runs-refresh");
    expect(node("run-refresh-retry")).not.toBeNull();
    expect(node("run-updated-at")).toBeNull();

    clip.copyTextToClipboard.mockClear();
    click("run-refresh-copy");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    expect(clip.copyTextToClipboard).toHaveBeenCalledWith("req-runs-refresh");

    runsMode = "ok";
    await openMetrics();
    expect(textOf("met6-runs-value")).not.toBe("");
    metricsMode = "fail";
    metricsFail = new ApiError("upstream said no", {
      status: 500,
      body: "",
      url: "/agent-api/api/run-stats",
      requestId: "req-metrics-refresh",
    });
    click("metAK-refresh");
    await waitFor(() => node("metAK-error") !== null, "metrics refresh failed");
    expect(node("metAK-error")?.textContent ?? "").toContain("req-metrics-refresh");
    expect(textOf("metAK-error")).toContain("这次刷新没成功");
    expect(textOf("met6-runs-value")).not.toBe("");
    expect(node("metAK-refresh-retry")).not.toBeNull();
    expect(node("metAK-updated-at")).toBeNull();

    const copyButton = document.querySelector(
      '[data-testid="metAK-error"] [data-testid="met5-request-id"] button',
    ) as HTMLElement | null;
    expect(copyButton).not.toBeNull();
    clip.copyTextToClipboard.mockClear();
    act(() => {
      copyButton?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    expect(clip.copyTextToClipboard).toHaveBeenCalledWith("req-metrics-refresh");
  });

  it("drops an in-flight batch when the window or the filters change", async () => {
    await openRuns();
    runsMode = "hold";
    click("run-refresh");
    await waitFor(() => node("run-busy-note") !== null, "runs busy");
    click("run-window-30d");
    await waitFor(() => node("run-busy-note") === null, "runs cancelled");
    await releaseAll();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(node("run-updated-at")).toBeNull();

    runsMode = "ok";
    await openMetrics();
    metricsMode = "hold";
    click("metAK-refresh");
    await waitFor(() => node("metAK-busy-note") !== null, "metrics busy");
    click("met6-window-7d");
    await waitFor(() => node("metAK-busy-note") === null, "metrics cancelled");
    await releaseAll();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(node("metAK-updated-at")).toBeNull();
  });

  it("stamps the read time on success without touching the collection time", async () => {
    await openRuns();
    const asOfBefore = textOf("run-asof");
    const asOfTitleBefore = node("run-asof")?.getAttribute("title");
    expect(asOfBefore).toBe("2026-11-20 04:12");

    click("run-refresh");
    await waitFor(() => node("run-updated-at") !== null, "runs updated");
    expect(textOf("run-updated-at")).toContain("刷新完成于");
    expect(textOf("run-updated-at")).toContain("不是数据时刻");
    expect(textOf("run-asof")).toBe(asOfBefore);
    expect(node("run-asof")?.getAttribute("title")).toBe(asOfTitleBefore);

    await openMetrics();
    click("metB-source-toggle");
    await waitFor(() => node("metB-source-asof-run-stats") !== null, "metrics asof row");
    const metAsOf = textOf("metB-source-asof-run-stats");
    expect(metAsOf).toBe("2026-11-20 04:12");

    click("metAK-refresh");
    await waitFor(() => node("metAK-updated-at") !== null, "metrics updated");
    expect(textOf("metAK-updated-at")).toContain("刷新完成于");
    expect(textOf("metB-source-asof-run-stats")).toBe(metAsOf);
  });
});