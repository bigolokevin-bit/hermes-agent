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

import TasksBoardModulePage from "./TasksBoardModulePage";

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

const ROWS: Record<string, unknown[]> = {
  open: [{ taskId: "tsk_open_1", title: "整理周报", status: "open", priority: "high", assignee: { type: "employee", id: "emp_1a2b3c4d" }, dueAt: "2026-11-18T10:00:00Z" }],
  in_progress: [{ taskId: "tsk_prog_1", title: "渠道归因", status: "in_progress", assignee: { type: "human", id: "human:7" } }],
  blocked: [{ taskId: "tsk_block_1", title: "素材去重", status: "blocked", progressNote: "等待表格能力" }],
  done: [{ taskId: "tsk_done_1", title: "对账", status: "done" }],
  cancelled: [],
};

function resolveBoard(url: string): unknown {
  const status = new URL(url, "http://x").searchParams.get("status") ?? "open";
  return { items: ROWS[status] ?? [] };
}

function resolveDetail(): unknown {
  return {
    taskId: "tsk_open_1",
    title: "整理周报",
    status: "open",
    priority: "high",
    assignee: { type: "employee", id: "emp_1a2b3c4d" },
    createdBy: { type: "human", id: "human:7" },
    source: { kind: "manual" },
    description: "把本周数据整理成一页",
    progressNote: null,
    dueAt: "2026-11-18T10:00:00Z",
    createdAt: "2026-11-17T02:00:00Z",
    updatedAt: "2026-11-18T02:00:00Z",
  };
}

async function render(entry = "/work") {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <TasksBoardModulePage />
      </MemoryRouter>,
    );
  });
  await act(async () => {});
}

describe("TasksBoardModulePage", () => {
  it("renders five status columns with honest labels", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.resolve(url.includes("/task-detail") ? resolveDetail() : resolveBoard(url)),
    );
    await render();
    for (const label of ["待处理", "进行中", "阻塞", "已完成", "已取消"]) {
      expect(container.textContent).toContain(label);
    }
    expect(container.querySelectorAll('[data-testid^="tasks-column-"]')).toHaveLength(5);
    expect(container.textContent).toContain("员工 · 3C4D");
    expect(container.textContent).not.toContain("emp_1a2b3c4d");
    expect(container.textContent).not.toContain("human:7");
    expect(container.textContent).not.toContain("HTTP");
  });

  it("opens task detail and shows the read-only fields", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.resolve(url.includes("/task-detail") ? resolveDetail() : resolveBoard(url)),
    );
    await render();
    const card = container.querySelector('[data-testid="tasks-card-tsk_open_1"]');
    expect(card).toBeTruthy();
    await act(async () => {
      (card as HTMLElement).click();
    });
    await act(async () => {});
    expect(fetchJSON).toHaveBeenCalledWith("/agent-api/api/task-detail?id=tsk_open_1");
    expect(container.textContent).toContain("把本周数据整理成一页");
    expect(container.textContent).toContain("人工创建");
    expect(container.textContent).toContain("人员");
  });

  it("shows the five forced phases", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.resolve(url.includes("/task-detail") ? resolveDetail() : resolveBoard(url)),
    );
    await render("/work?state=empty");
    expect(container.querySelector('[data-testid="tasks-board-empty"]')).toBeTruthy();
    await render("/work?state=error&rid=req-err");
    expect(container.querySelector('[data-testid="tasks-board-error"]')?.textContent).toContain("req-err");
    await render("/work?state=denied&rid=req-denied");
    expect(container.querySelector('[data-testid="tasks-board-denied"]')?.textContent).toContain("req-denied");
    await render("/work?state=loading");
    expect(container.querySelector('[data-testid="tasks-board-loading"]')).toBeTruthy();
  });

  it("keeps a request id and a working retry on a 500", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.reject(new ApiError("boom", { status: 500, body: "{}", url, requestId: "req-tasks" })),
    );
    await render();
    expect(container.textContent).toContain("请求编号 req-tasks");
    expect(container.textContent).toContain("重试");
    expect(container.textContent).not.toContain("HTTP");
  });

  it("never shows hard zeros when the board cannot load: — plus reason line and real exits", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.reject(new ApiError("down", { status: 0, body: "", url })),
    );
    await render();
    const text = container.textContent ?? "";
    // 假零整改：失败时是「—」，不是「待处理 0 / 阻塞 0」；附原因行。
    expect(text).toContain("待处理 — · 阻塞 —");
    expect(text).not.toContain("待处理 0");
    expect(text).not.toContain("阻塞 0");
    expect(text).toContain("暂时读不到任务数据（接口不可达），数字不作零处理");
    // 错误面板真出口。
    const err = container.querySelector('[data-testid="tasks-board-error"]');
    expect(err?.querySelector('a[href="/overview"]')?.textContent).toContain("返回控制台");
    expect(err?.querySelector('a[href^="mailto:"]')?.textContent).toContain("联系管理员");
    // 请求编号话术。
    expect(text).toContain("本次请求未记录编号，可复制时间与操作路径反馈");
    expect(text).not.toContain("未提供");
  });

  it("a successful read with no tasks still shows zero, honestly", async () => {
    fetchJSON.mockImplementation(() => Promise.resolve({ items: [] }));
    await render();
    expect(container.textContent).toContain("待处理 0 · 阻塞 0");
    expect(container.querySelector('[data-testid="tasks-board-empty"]')).toBeTruthy();
    expect(container.textContent).not.toContain("数字不作零处理");
  });
});
