// @vitest-environment jsdom
/**
 * PE-03 更新说明：Tab 集已从「概览/聊天/任务/运行/审计」对齐到五个冻结分区
 * （档案/任职/权限/身份链接/活动），旧顶层 Tab 名断言按卡面授权随更；
 * 三条既有用例的口径（概览诚实化 / 整块替换 / 单分区独立降级）逐字保留。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchJSON: (...args: unknown[]) => fetchJSON(...args),
}));

import EmployeeDetailPage from "@/pages/EmployeeDetailPage";

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

const err = (status: number, body = "") =>
  new ApiError("拒绝", { status, body, url: "/agent-api" });

/** 详情端点返回 detail；活动四区块腿返回 sections；其余读腿给空信封。 */
function route(detail: unknown, sections: unknown = []) {
  fetchJSON.mockImplementation((url: string) => {
    if (/\/api\/(sessions|tasks|runs|audit)\?/.test(url)) return Promise.resolve(sections);
    if (/\/api\/(employee-versions|workstations|effective-config)\?/.test(url)) return Promise.resolve({ items: [] });
    return Promise.resolve(detail);
  });
}

async function render(entry = "/employees/emp_9f3a4b7c") {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/employees/:id" element={<EmployeeDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  await act(async () => {});
}

const clickTab = async (label: string) => {
  const btn = Array.from(container.querySelectorAll('[role="tab"]')).find(
    (b) => (b.textContent ?? "").trim() === label,
  );
  expect(btn, `tab ${label}`).toBeTruthy();
  await act(async () => {
    (btn as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {});
};

describe("EmployeeDetailPage", () => {
  it("档案：姓名优先、emp_ 不外泄、缺失金额/计数不造假 0", async () => {
    route({
      id: "emp_9f3a4b7c",
      name: "小鲤",
      status: "active",
      model: "qwen-max",
      last_seen: "2026-11-18T02:30:00Z",
    });
    await render();
    await clickTab("档案");
    const text = container.textContent ?? "";
    expect(text).toContain("小鲤");
    expect(text).not.toContain("emp_9f3a4b7c");
    expect(text).toContain("在岗");
    expect(text).toContain("2026-11-18 10:30");
    // 无负责人 → 未指派；无预算 → —；无支出 → 未计价；无统计 → —
    expect(text).toContain("未指派");
    expect(text).toContain("未计价");
  });

  it("整块替换：详情 404 时只渲染无权限块，不出现任何分区 Tab", async () => {
    fetchJSON.mockImplementation(() => Promise.reject(err(404)));
    await render();
    const text = container.textContent ?? "";
    expect(text).toContain("无法打开该员工");
    expect(container.querySelector('[role="tab"]')).toBeNull();
    expect(text).not.toContain("档案");
  });

  it("单分区独立降级：运行区块 404 不影响概览头部", async () => {
    route({ id: "emp_9f3a4b7c", name: "小鲤", status: "active" });
    // 让运行端点 404，其余正常
    fetchJSON.mockImplementation((url: string) => {
      if (url.includes("/api/runs")) return Promise.reject(err(404));
      if (/\/api\/(sessions|tasks|runs|audit)\?/.test(url)) return Promise.resolve([]);
      if (/\/api\/(employee-versions|workstations|effective-config)\?/.test(url)) return Promise.resolve({ items: [] });
      return Promise.resolve({ id: "emp_9f3a4b7c", name: "小鲤", status: "active" });
    });
    await render();
    await clickTab("运行");
    const text = container.textContent ?? "";
    expect(text).toContain("无法打开运行"); // 仅该区块替换
    expect(text).toContain("小鲤"); // 头部仍在
  });
});
