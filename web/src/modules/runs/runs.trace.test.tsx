// @vitest-environment jsdom
// Q6 · the trace strip above the event timeline, and the per-step
// input/output excerpt. Every reading on screen is derived from the events the
// detail read already returned; a payload that carries no excerpt says
// 「未采集」 with the reason instead of inventing one.

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));
vi.mock("@/lib/clipboard", () => clip);

import { RunsModulePage } from "./RunsModulePage";
import { stepExcerpt, traceCounts, traceTone, type RunEvent } from "./runs";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  let guard = 0;
  while (!cond()) {
    if (++guard > 600) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

async function render(entry: string): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(createElement(MemoryRouter, { initialEntries: [entry] }, createElement(RunsModulePage)));
  });
}

const node = (testid: string): HTMLElement | null =>
  document.querySelector(`[data-testid='${testid}']`) as HTMLElement | null;
const text = (testid: string): string => node(testid)?.textContent ?? "";

const RUN_ID = "rn_trace_0000000000000000001";
const DEEP_LINK = `/runs?run=${encodeURIComponent(RUN_ID)}`;

const RUN = {
  runId: RUN_ID,
  status: "completed",
  employeeId: "emp_trace_01",
  startedAt: "2026-11-18T02:00:00.000Z",
  endedAt: "2026-11-18T02:00:06.000Z",
  costUsd: 0.12,
};

const event = (seq: number, eventType: string, payload: Record<string, unknown> = {}): RunEvent => ({
  seq,
  eventType,
  occurredAt: `2026-11-18T02:00:0${Math.min(seq, 9)}.000Z`,
  payload,
});

function detailOk(events: { items: RunEvent[]; hasMore: boolean }) {
  return async (url: string): Promise<unknown> => {
    if (url.includes("/api/run-detail")) {
      const id = new URL(url, "http://x").searchParams.get("id");
      return { ...RUN, runId: id ?? RUN_ID };
    }
    if (url.includes("/api/run-events")) return events;
    if (url.includes("/api/employees")) return { items: [{ employeeId: "emp_trace_01", name: "陈可" }] };
    if (url.includes("/api/runs") || url.includes("/api/run-stats")) return { items: [RUN], nextCursor: null };
    return { items: [] };
  };
}

const fourSteps = {
  items: [
    event(1, "started", { input: "谁负责 NIST AI RMF 的治理功能" }),
    event(2, "tool_call", { input: { query: "NIST" }, output: "ok" }),
    event(3, "failed", { error: { code: "tool.timeout" } }),
    event(4, "completed", {}),
  ],
  hasMore: false,
};

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
  vi.clearAllMocks();
});

describe("trace helpers", () => {
  it("tones: failure wins, running is warning, completed is success, unknown is muted", () => {
    expect(traceTone(event(1, "failed", { error: { code: "x" } }))).toBe("destructive");
    expect(traceTone(event(2, "tool_call"))).toBe("warning");
    expect(traceTone(event(3, "completed"))).toBe("success");
    expect(traceTone(event(4, "something_new"))).toBe("secondary");
  });

  it("counts only what is on screen, with an explicit other bucket", () => {
    const counts = traceCounts([
      event(1, "started"),
      event(2, "tool_call"),
      event(3, "failed", { error: { code: "x" } }),
      event(4, "completed"),
      event(5, "something_new"),
    ]);
    expect(counts).toEqual({ total: 5, done: 1, active: 2, failed: 1, other: 1 });
    expect(traceCounts([event(1, "mystery")])).toMatchObject({ total: 1, other: 1 });
  });

  it("excerpts read the payload only and stay honest when it is empty", () => {
    const withValues = event(1, "tool_call", { arguments: { q: "NIST" }, result: "done" });
    expect(stepExcerpt(withValues, "input").text).toContain("NIST");
    expect(stepExcerpt(withValues, "output").text).toBe("done");

    const empty = event(2, "completed", {});
    expect(stepExcerpt(empty, "input").text).toBeNull();
    expect(stepExcerpt(empty, "input").reason).toContain("没有输入摘录");
    expect(stepExcerpt(empty, "output").text).toBeNull();
  });
});

describe("trace strip and step details", () => {
  it("renders one chip per step and the count line", async () => {
    api.fetchJSON.mockImplementation(detailOk(fourSteps));
    await render(DEEP_LINK);
    await waitFor(() => node("run6-trace") !== null, "trace strip");

    const counts = text("run6-trace-counts");
    expect(counts).toContain("共 4 步");
    expect(counts).toContain("失败 1");
    for (const seq of [1, 2, 3, 4]) {
      expect(node(`run6-trace-step-${seq}`)).not.toBeNull();
    }
    expect(text("run6-trace-step-2")).toContain("工具调用");
  });

  it("shows the payload excerpts and says 未采集 where the payload is empty", async () => {
    api.fetchJSON.mockImplementation(detailOk(fourSteps));
    await render(DEEP_LINK);
    await waitFor(() => node("run6-step-input-2") !== null, "step details");

    expect(text("run6-step-input-2")).toContain("NIST");
    expect(text("run6-step-output-2")).toContain("ok");
    expect(text("run6-step-input-4")).toContain("未采集");
    expect(text("run6-step-input-1")).toContain("谁负责");
  });

  it("lays the strip and the details out so a narrow column never scrolls sideways", async () => {
    api.fetchJSON.mockImplementation(detailOk(fourSteps));
    await render(DEEP_LINK);
    await waitFor(() => node("run6-trace-steps") !== null, "trace steps");

    const strip = node("run6-trace-steps") as HTMLElement;
    expect(strip.className).toContain("flex-wrap");
    expect(strip.className).toContain("min-w-0");
    const input = node("run6-step-input-2") as HTMLElement;
    expect(input.className).toContain("min-w-0");
    expect(input.className).toContain("break-words");
  });

  it("flags a truncated read without pretending the missing steps exist", async () => {
    api.fetchJSON.mockImplementation(detailOk({ items: [event(1, "started")], hasMore: true }));
    await render(DEEP_LINK);
    await waitFor(() => node("run6-trace-more") !== null, "trace more hint");
    expect(text("run6-trace-counts")).toContain("共 1 步");
    expect(text("run6-trace-more")).toContain("后续还有更多步骤");
  });

  it("does not draw a trace strip when no events were read", async () => {
    api.fetchJSON.mockImplementation(detailOk({ items: [], hasMore: false }));
    await render(DEEP_LINK);
    await waitFor(() => text("run5-detail") !== "", "detail pane");
    expect(node("run6-trace")).toBeNull();
    expect(text("run5-timeline")).toBe("");
  });
});