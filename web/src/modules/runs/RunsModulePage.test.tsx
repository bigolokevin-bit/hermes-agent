// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
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
  costStatus: "upstream",
  costUsd: 0.42,
  startedAt: "2026-11-18T02:00:00Z",
  endedAt: "2026-11-18T02:01:48Z",
  budgetCapUsd: 5,
  attemptNo: 1,
};

function ok(url: string): unknown {
  if (url.includes("/api/employees")) return { items: [{ employeeId: "emp_9f3a4b7c", name: "陈可" }] };
  if (url.includes("/api/run-detail")) return { ...run, upstreamRunId: "run_upstream_9f3a" };
  if (url.includes("/api/run-events")) {
    return { items: [
      { runId: run.runId, seq: 1, eventType: "started", occurredAt: "2026-11-18T02:00:00Z", payload: {} },
      { runId: run.runId, seq: 2, eventType: "tool_call", occurredAt: "2026-11-18T02:00:30Z", payload: {} },
      { runId: run.runId, seq: 3, eventType: "tool_result", occurredAt: "2026-11-18T02:01:40Z", payload: { resultRef: "rn-step-9" } },
      { runId: run.runId, seq: 4, eventType: "tool_result", occurredAt: "2026-11-18T02:01:45Z", payload: {} },
      { runId: run.runId, seq: 5, eventType: "completed", occurredAt: "2026-11-18T02:01:48Z", payload: {} },
    ], nextSeq: 2, hasMore: false };
  }
  if (url.includes("/api/runs")) return { items: [run], nextCursor: "cur-2" };
  return {};
}

async function render(entry = "/runs") {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[entry]}><RunsModulePage /></MemoryRouter>);
  });
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
    expect(container.textContent).toContain("已计价");
    expect(container.textContent).toContain("结果引用：rn-step-9");
    expect(container.textContent).toContain("结果引用：未记录");
    expect(container.textContent).toContain("重试（新建运行）");
    expect(container.textContent).toContain("不会复用本条 runId");
    const retry = container.querySelector('[data-testid="run-retry-planned"]') as HTMLButtonElement;
    expect(retry.disabled).toBe(true);
    const upstream = container.querySelector('a[href^="/runs?upstream="]') as HTMLAnchorElement;
    expect(upstream).toBeTruthy();
    expect(upstream.getAttribute("href")).toContain("run_upstream_9f3a");
    expect(container.querySelector('[data-testid="run-events"]')?.children.length).toBe(5);
  });

  it("renders unknown cost as — with a reason, never as 0", async () => {
    fetchJSON.mockImplementation((url: string) =>
      url.includes("/api/runs")
        ? Promise.resolve({ items: [{ ...run, costStatus: "unknown", costUsd: 0.42 }] })
        : Promise.resolve(ok(url)),
    );
    await render();
    const text = container.textContent ?? "";
    expect(text).toContain("未知");
    expect(text).toContain("账本没有这条运行的计价记录");
    expect(text).not.toContain("$0.42");
    expect(container.querySelector('[data-testid="runs-table"]')).toBeTruthy();
  });

  it("opens a real upstream deep link instead of a dead anchor", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await render("/runs?upstream=run_upstream_9f3a");
    expect(container.querySelector('[data-testid="upstream-run-id"]')?.textContent).toBe("run_upstream_9f3a");
    expect(container.textContent).toContain("返回运行列表");
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
    await render();
    expect(container.textContent).toContain("运行记录暂不可见");
    expect(container.textContent).toContain("req-404");
  });
});
