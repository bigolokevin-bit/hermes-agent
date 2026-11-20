// @vitest-environment jsdom
/**
 * The collection time is one sentence in two places: the metrics freshness
 * table and the runs list. Same payload in, same text and title out — for a
 * real instant, for nothing at all, and for a value that is not an instant.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
const strict = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));
vi.mock("@/modules/models/fetchJson", () => ({ fetchJsonStrict: strict.fetchJsonStrict }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: vi.fn(() => Promise.resolve(true)) }));

import { MetricsModulePage } from "./MetricsModulePage";
import { RunsModulePage } from "../runs/RunsModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const waitFor = async (check: () => boolean, label: string): Promise<void> => {
  for (let i = 0; i < 300; i += 1) {
    if (check()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  throw new Error(`timed out: ${label}`);
};

const stamp = { asOf: "2026-11-19T20:12:00.000Z", asOfSource: "bff-aggregation" };

function payloadFor(url: string, asOf: Record<string, unknown>): unknown {
  if (url.includes("/api/run-stats")) {
    return { totals: { runs: 0, succeeded: 0, failed: 0, running: 0, costUsd: 0 }, buckets: [], ...asOf };
  }
  if (url.includes("/api/runs")) return { items: [], nextCursor: null, ...asOf };
  if (url.includes("/api/run-activity")) return { cells: [], max: null, from: "", to: "", tz: "Asia/Shanghai" };
  if (url.includes("/api/models/pricing")) return { prices: [], ...asOf };
  if (url.includes("/api/hermes-usage")) return { by_model: [], ...asOf };
  return { items: [], missingEmployeeIds: [], ...asOf };
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function mount(page: React.ReactElement, entry: string): Promise<void> {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(createElement(MemoryRouter, { initialEntries: [entry] }, page));
  });
}

const node = (testId: string): HTMLElement | null =>
  document.querySelector(`[data-testid='${testId}']`) as HTMLElement | null;

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});
beforeEach(() => {
  document.body.replaceChildren();
});

async function pair(asOf: Record<string, unknown>): Promise<{ text: string; title: string }[]> {
  api.fetchJSON.mockImplementation((url: string) => Promise.resolve(payloadFor(String(url), asOf)));
  strict.fetchJsonStrict.mockImplementation((url: string) => Promise.resolve(payloadFor(String(url), asOf)));

  await mount(createElement(MetricsModulePage), "/metrics");
  await waitFor(() => node("metB-source-toggle") !== null, "metrics freshness toggle");
  await act(async () => node("metB-source-toggle")?.click());
  await waitFor(() => node("metB-source-asof-run-stats") !== null, "metrics run-stats cell");
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
    });
  }
  const metricsCell = node("metB-source-asof-run-stats") as HTMLElement;

  const fromMetrics = { text: metricsCell.textContent ?? "", title: metricsCell.getAttribute("title") ?? "" };
  await act(async () => root?.unmount());
  host?.remove();
  root = null;

  document.body.replaceChildren();
  await mount(createElement(RunsModulePage), "/runs");
  await waitFor(() => node("run-asof") !== null, "runs collection cell");
  const runsCell = node("run-asof") as HTMLElement;
  return [fromMetrics, { text: runsCell.textContent ?? "", title: runsCell.getAttribute("title") ?? "" }];
}

describe("asOf parity — one payload, one sentence, two pages", () => {
  it("renders a real instant identically", async () => {
    const [metrics, runs] = await pair(stamp);
    expect(metrics.text).toBe("2026-11-20 04:12");
    expect(runs.text).toBe(metrics.text);
    expect(runs.title).toBe(metrics.title);
    expect(metrics.title).toContain("2026-11-19T20:12:00.000Z");
    expect(metrics.title).toContain("来源 bff-aggregation");
  });

  it("renders a missing instant identically, without the local clock", async () => {
    const [metrics, runs] = await pair({});
    expect(metrics.text).toBe("—");
    expect(runs.text).toBe("—");
    expect(runs.title).toBe(metrics.title);
    expect(metrics.title).toContain("不用本机时间顶替");
  });

  it("treats a non-ISO value as missing on both pages", async () => {
    const [metrics, runs] = await pair({ asOf: "yesterday", asOfSource: "bff" });
    expect(metrics.text).toBe("—");
    expect(runs.text).toBe("—");
    expect(runs.title).toBe(metrics.title);
    expect(metrics.title).not.toContain("bff");
  });
});
