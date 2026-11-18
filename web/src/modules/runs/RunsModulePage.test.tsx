// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchJSON: (...args: unknown[]) => fetchJSON(...args),
}));

import RunsModulePage from "./RunsModulePage";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  fetchJSON.mockReset();
});

const run = {
  runId: "rn_01M7822XN781D2S9JASH5TX1XZ",
  employeeId: "emp_9f3a4b7c",
  taskId: "tsk_open_1",
  status: "failed",
  reasonCode: "run.budget_exhausted",
  costUsd: 0.42,
  startedAt: "2026-11-18T02:00:00Z",
  endedAt: "2026-11-18T02:01:48Z",
  budgetCapUsd: 5,
  attemptNo: 1,
};

function ok(url: string): unknown {
  if (url.includes("/api/employees")) return { items: [{ employeeId: "emp_9f3a4b7c", name: "陈可" }] };
  if (url.includes("/api/run-detail")) return run;
  if (url.includes("/api/run-events")) {
    return { items: [
      { runId: run.runId, seq: 1, eventType: "started", occurredAt: "2026-11-18T02:00:00Z", payload: {} },
      { runId: run.runId, seq: 2, eventType: "tool_call", occurredAt: "2026-11-18T02:00:30Z", payload: {} },
      { runId: run.runId, seq: 3, eventType: "completed", occurredAt: "2026-11-18T02:01:48Z", payload: {} },
    ], nextSeq: 2, hasMore: false };
  }
  if (url.includes("/api/runs")) return { items: [run], nextCursor: "cur-2" };
  return {};
}

async function render() {
  await act(async () => { root.render(<RunsModulePage />); });
  await act(async () => {});
}

describe("RunsModulePage", () => {
  it("renders the run list with a real employee label and USD", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await render();
    expect(container.querySelector('[data-testid="runs-table"]')).toBeTruthy();
    expect(container.textContent).toContain("陈可");
    expect(container.textContent).toContain("$0.42");
    expect(container.textContent).not.toContain("emp_9f3a4b7c");
    expect(container.textContent).not.toContain("HTTP");
  });

  it("opens detail and reads run events", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await render();
    await act(async () => {
      (container.querySelector('[data-testid^="run-row-"]') as HTMLElement).click();
    });
    await act(async () => {});
    expect(container.textContent).toContain("预算耗尽");
    expect(container.textContent).toContain("工具调用");
    expect(container.textContent).toContain("完成");
    expect(container.querySelector('[data-testid="run-events"]')?.children.length).toBe(3);
  });

  it("turns a 400 into a filter-reading message with a request id", async () => {
    fetchJSON.mockImplementation((url: string) =>
      url.includes("/api/runs")
        ? Promise.reject(new ApiError("bad filter", { status: 400, body: "{}", url, requestId: "req-400" }))
        : Promise.resolve(ok(url)),
    );
    await render();
    expect(container.textContent).toContain("这次筛选没有被接受");
    expect(container.textContent).toContain("req-400");
    expect(container.textContent).toContain("重试");
    expect(container.textContent).not.toContain("HTTP");
  });

  it("renders empty and denied states honestly", async () => {
    fetchJSON.mockImplementation((url: string) =>
      url.includes("/api/runs") ? Promise.resolve({ items: [] }) : Promise.resolve(ok(url)),
    );
    await render();
    expect(container.querySelector('[data-testid="runs-empty"]')).toBeTruthy();

    fetchJSON.mockImplementation((url: string) =>
      url.includes("/api/runs")
        ? Promise.reject(new ApiError("gone", { status: 404, body: "{}", url, requestId: "req-404" }))
        : Promise.resolve(ok(url)),
    );
    await act(async () => root.unmount());
    container.remove();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<RunsModulePage />));
    await act(async () => {});
    expect(container.textContent).toContain("运行记录暂不可见");
    expect(container.textContent).toContain("req-404");
  });
});
