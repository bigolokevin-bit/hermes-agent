// @vitest-environment jsdom
/**
 * Cross-page guards for the two things both pages must say the same way:
 * when the data was collected, and which window a request actually asks for.
 *
 * This file is the guard, not a second implementation: it imports the same
 * helper the pages import, reads the source of both pages to prove there is
 * no third copy, and drives the real buttons to check the request shapes.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
const strict = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));
vi.mock("@/modules/models/fetchJson", () => ({ fetchJsonStrict: strict.fetchJsonStrict }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: vi.fn(() => Promise.resolve(true)) }));

import { MetricsModulePage } from "../metrics/MetricsModulePage";
import { RunsModulePage } from "../runs/RunsModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ASOF_MISSING_TITLE = "上游未返回采集时刻；不用本机时间顶替。";
const LEGAL = "2026-11-19T20:12:00.000Z";

const waitFor = async (check: () => boolean, label: string): Promise<void> => {
  for (let i = 0; i < 400; i += 1) {
    if (check()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  throw new Error(`timed out: ${label}`);
};

const node = (testId: string): HTMLElement | null =>
  document.querySelector(`[data-testid='${testId}']`) as HTMLElement | null;
const text = (testId: string): string => node(testId)?.textContent ?? "";
const title = (testId: string): string => node(testId)?.getAttribute("title") ?? "";
const calls = (fragment: string): string[] =>
  api.fetchJSON.mock.calls
    .map((call) => String(call[0]))
    .filter((url) => url.includes(fragment));

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function LocationProbe(): React.ReactElement {
  const location = useLocation();
  return createElement(
    "div",
    { "data-testid": "probe-location" },
    `${location.pathname}${location.search}`,
  );
}

async function mount(page: React.ReactElement, entry: string): Promise<void> {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(
      createElement(MemoryRouter, { initialEntries: [entry] }, page, createElement(LocationProbe)),
    );
  });
}

/** Both pages read whatever endpoints they need; one body per endpoint kind. */
function payloadFor(url: string, asOf: Record<string, unknown>, runsItems: unknown[] = []): unknown {
  if (url.includes("/api/run-stats")) {
    const from = new URL(url, "http://local").searchParams.get("from");
    const days = from ? (Date.now() - Date.parse(from)) / 86_400_000 : 0;
    const runs = days >= 20 ? 14 : days >= 5 ? 13 : 0;
    return {
      totals: { runs, succeeded: runs, failed: 0, running: 0, costUsd: 0 },
      buckets: runs === 0 ? [] : [{ bucketStart: "2026-11-14T00:00:00.000Z", runs }],
      ...asOf,
    };
  }
  if (url.includes("/api/runs")) return { items: runsItems, nextCursor: null, ...asOf };
  if (url.includes("/api/run-activity")) return { cells: [], max: null, from: "", to: "", tz: "Asia/Shanghai" };
  if (url.includes("/api/models/pricing")) return { prices: [], ...asOf };
  if (url.includes("/api/hermes-usage")) return { by_model: [], ...asOf };
  return { items: [], missingEmployeeIds: [], ...asOf };
}

const RUN_ROW = {
  runId: "rn_01M7822COPY0001",
  status: "completed",
  startedAt: "2026-11-18T02:00:00.000Z",
  endedAt: "2026-11-18T02:11:00.000Z",
  costUsd: 1,
  costStatus: "known",
  employeeId: "emp_aaaabbbbcccc",
};

async function openMetrics(asOf: Record<string, unknown>): Promise<void> {
  strict.fetchJsonStrict.mockImplementation((url: string) => Promise.resolve(payloadFor(String(url), asOf)));
  await mount(createElement(MetricsModulePage), "/metrics");
  await waitFor(() => node("metB-source-toggle") !== null, "metrics freshness toggle");
  await act(async () => node("metB-source-toggle")?.click());
  await waitFor(() => node("metB-source-asof-run-stats") !== null, "metrics asOf cell");
}

async function openRuns(entry: string, asOf: Record<string, unknown>): Promise<void> {
  api.fetchJSON.mockImplementation((url: string) =>
    Promise.resolve(payloadFor(String(url), asOf, [RUN_ROW])),
  );
  await mount(createElement(RunsModulePage), entry);
  await waitFor(() => node("run-asof") !== null, "runs asOf line");
}

beforeEach(() => {
  document.body.replaceChildren();
  api.fetchJSON.mockReset();
  strict.fetchJsonStrict.mockReset();
});

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.useRealTimers();
});

describe("cross-page time: one helper, one sentence", () => {
  it("both pages import the metrics asof helper and render the same text and title", async () => {
    // No third copy: the runs page must not build its own stamp text.
    const runsSource = readFileSync(join(process.cwd(), "src/modules/runs/RunsModulePage.tsx"), "utf8");
    const metricsSource = readFileSync(join(process.cwd(), "src/modules/metrics/MetricsModulePage.tsx"), "utf8");
    expect(runsSource).toContain("../metrics/asof");
    expect(metricsSource).toContain("./asof");

    const asOf = { asOf: LEGAL, asOfSource: "bff-aggregation" };
    await openRuns(`/runs?run=${RUN_ROW.runId}`, asOf);
    const runsText = text("run-asof");
    const runsTitle = title("run-asof");
    await act(async () => root?.unmount());
    host?.remove();

    await openMetrics(asOf);
    const metricsText = text("metB-source-asof-run-stats");
    const metricsTitle = title("metB-source-asof-run-stats");

    expect(runsText).toBe("2026-11-20 04:12");
    expect(metricsText).toBe(runsText);
    expect(runsTitle).toBe("采集时刻 2026-11-19T20:12:00.000Z（UTC） · 来源 bff-aggregation");
    expect(metricsTitle).toBe(runsTitle);
  });

  it("says «—» for a missing or unreadable instant, and never borrows the machine clock", async () => {
    for (const asOf of [{}, { asOf: "yesterday" }, { asOf: "" }] as Record<string, unknown>[]) {
      await openRuns("/runs", asOf);
      const runsText = text("run-asof");
      const runsTitle = title("run-asof");
      await act(async () => root?.unmount());
      host?.remove();
      document.body.replaceChildren();

      await openMetrics(asOf);
      expect(runsText).toBe("—");
      expect(text("metB-source-asof-run-stats")).toBe("—");
      expect(runsTitle).toBe(ASOF_MISSING_TITLE);
      expect(title("metB-source-asof-run-stats")).toBe(runsTitle);
      await act(async () => root?.unmount());
      host?.remove();
      document.body.replaceChildren();
    }

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2031-03-04T05:06:07.000Z"));
    await openRuns("/runs", {});
    // The generation stamp in the CSV file name is a real clock reading; the
    // collection time must not borrow it.
    expect(text("run-asof")).toBe("—");
    expect(title("run-asof")).not.toContain("2031");
    expect(title("run-asof")).toBe(ASOF_MISSING_TITLE);
  });
});

describe("cross-page window: the request says which span it wants", () => {
  it("every runs window asks for its own span, and all never omits since", async () => {
    const asOf = { asOf: LEGAL };
    api.fetchJSON.mockImplementation((url: string) =>
      Promise.resolve(payloadFor(String(url), asOf, [RUN_ROW])),
    );
    await mount(createElement(RunsModulePage), "/runs");
    await waitFor(() => node("run-window-7d") !== null, "window buttons");

    const pressed = (): string | null =>
      document.querySelector("[data-testid^='run-window-'][aria-pressed='true']")?.getAttribute("data-testid") ?? null;
    expect(pressed()).toBe("run-window-7d");

    const sinceOfLast = (): string => {
      const last = calls("/api/runs").at(-1) ?? "";
      const since = new URL(last, "http://local").searchParams.get("since");
      if (since === null) throw new Error(`runs request has no since: ${last}`);
      return since;
    };
    const expectDays = (days: number): void => {
      const diff = Date.now() - Date.parse(sinceOfLast());
      expect(Math.abs(diff - days * 86_400_000)).toBeLessThanOrEqual(120_000);
    };

    for (const [key, days] of [["24h", 1], ["7d", 7], ["30d", 30]] as [string, number][]) {
      await act(async () => node(`run-window-${key}`)?.click());
      await waitFor(() => pressed() === `run-window-${key}`, `${key} pressed`);
      expectDays(days);
    }

    await act(async () => node("run-window-all")?.click());
    await waitFor(() => pressed() === "run-window-all", "all pressed");
    expect(sinceOfLast()).toBe("1970-01-01T00:00:00.000Z");
  });

  it("keeps an unreadable window value in the address and says it fell back", async () => {
    const asOf = { asOf: LEGAL };
    api.fetchJSON.mockImplementation((url: string) =>
      Promise.resolve(payloadFor(String(url), asOf, [RUN_ROW])),
    );
    await mount(createElement(RunsModulePage), "/runs?window=xxx&status=failed");
    await waitFor(() => node("run-source-note") !== null, "fallback note");

    expect(text("probe-location")).toBe("/runs?window=xxx&status=failed");
    expect(text("run-source-note")).toContain("未识别");
    const pressed = document.querySelector("[data-testid^='run-window-'][aria-pressed='true']");
    expect(pressed?.getAttribute("data-testid")).toBe("run-window-7d");
  });

  it("a window switch costs one batch: runs one list read, metrics one stats batch", async () => {
    const asOf = { asOf: LEGAL };

    // /runs: switching the window refetches the list and nothing else.
    await openRuns("/runs", asOf);
    const runsBefore = {
      list: calls("/api/runs").length,
      stats: calls("run-stats").length,
      people: calls("employees").length,
    };
    await act(async () => node("run-window-30d")?.click());
    await waitFor(() => text("run-asof") !== "", "runs after switch");
    await waitFor(() => calls("/api/runs").length > runsBefore.list, "runs refetched");
    expect(calls("/api/runs").length).toBe(runsBefore.list + 1);
    expect(calls("run-stats").length).toBe(runsBefore.stats);
    expect(calls("employees").length).toBe(runsBefore.people);
    await act(async () => root?.unmount());
    host?.remove();
    document.body.replaceChildren();

    // /metrics: switching the statistical window reloads the stats batch once,
    // and leaves the heat map's own source alone.
    strict.fetchJsonStrict.mockImplementation((url: string) => Promise.resolve(payloadFor(String(url), asOf)));
    await mount(createElement(MetricsModulePage), "/metrics");
    await waitFor(() => node("met6-window-24h") !== null, "metrics windows");
    await waitFor(() => text("met6-runs-value") !== "", "metrics numbers");
    const beforeStats = strict.fetchJsonStrict.mock.calls
      .map((call) => String(call[0]))
      .filter((url) => url.includes("/api/run-stats")).length;
    const beforeActivity = strict.fetchJsonStrict.mock.calls
      .map((call) => String(call[0]))
      .filter((url) => url.includes("run-activity")).length;
    expect(beforeStats).toBeGreaterThan(0);

    await act(async () => node("met6-window-7d")?.click());
    await waitFor(() => text("met6-runs-value") === "13", "metrics 7d numbers");
    const afterStats = strict.fetchJsonStrict.mock.calls
      .map((call) => String(call[0]))
      .filter((url) => url.includes("/api/run-stats")).length;
    const afterActivity = strict.fetchJsonStrict.mock.calls
      .map((call) => String(call[0]))
      .filter((url) => url.includes("run-activity")).length;
    // One batch = the pair of run-stats reads that carry the current window
    // and the one before it. A second switch costs the same pair again.
    expect(afterStats - beforeStats).toBe(2);
    expect(afterActivity).toBe(beforeActivity);
    await act(async () => node("met6-window-30d")?.click());
    await waitFor(() => text("met6-runs-value") === "14", "metrics 30d numbers");
    const afterSecond = strict.fetchJsonStrict.mock.calls
      .map((call) => String(call[0]))
      .filter((url) => url.includes("/api/run-stats")).length;
    expect(afterSecond - afterStats).toBe(2);
  });
});