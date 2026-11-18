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

import EmployeesPage from "@/pages/EmployeesPage";

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

/** 矩阵端点 404，兜底 employees 成功 → 用兜底数据渲染（不编造、不报错）。 */
function resolveEmployees(rows: unknown[]) {
  fetchJSON.mockImplementation((url: string) =>
    url.includes("/api/matrix")
      ? Promise.reject(new ApiError("找不到", { status: 404, body: "", url }))
      : Promise.resolve(rows),
  );
}

async function render() {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <EmployeesPage />
      </MemoryRouter>,
    );
  });
  // flush promise chain
  await act(async () => {});
}

describe("EmployeesPage", () => {
  it("loading 态先渲染骨架，不出现编造行", async () => {
    fetchJSON.mockReturnValue(new Promise(() => {})); // 永不 resolve
    await act(async () => {
      root.render(
        <MemoryRouter>
          <EmployeesPage />
        </MemoryRouter>,
      );
    });
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it("渲染真实行：姓名优先，绝不显示 emp_ 原值，时间为北京时间格式", async () => {
    resolveEmployees([
      {
        id: "emp_9f3a4b7c",
        name: "小鲤",
        status: "active",
        role: "外勤拜访",
        model: "qwen-max",
        spend: 12.5,
        last_active: "2026-11-18T02:30:00Z", // → 北京 10:30
      },
    ]);
    await render();
    const text = container.textContent ?? "";
    expect(text).toContain("小鲤");
    expect(text).not.toContain("emp_9f3a4b7c"); // 原 id 不进可见文本（只进 title）
    expect(text).toContain("在岗");
    expect(text).toContain("$12.50");
    expect(text).toMatch(/2026-11-18 10:30/);
  });

  it("缺失支出显示「未计价」而不是假 0", async () => {
    resolveEmployees([{ id: "emp_1111aaaa", name: "阿丁" }]);
    await render();
    expect(container.textContent).toContain("未计价");
  });

  it("空数组 → 空态（含下一步说明），不报错", async () => {
    fetchJSON.mockResolvedValue([]);
    await render();
    expect(container.textContent).toContain("暂无数字员工");
  });

  it("两个端点都 404 → 无权限/未开放块（整块替换，含重试）", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.reject(new ApiError("没有", { status: 404, body: "", url })),
    );
    await render();
    const text = container.textContent ?? "";
    expect(text).toContain("尚未开放");
    expect(text).toContain("请求编号：未提供");
    expect(text).toContain("重试");
    // 不渲染任何员工行
    expect(text).not.toContain("在岗");
  });

  it("5xx → 错误块带后端人话 + 信封里的请求编号", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.reject(
        new ApiError("服务炸了", {
          status: 500,
          body: JSON.stringify({ request_id: "req-abc-123", detail: "服务炸了" }),
          url,
        }),
      ),
    );
    await render();
    const text = container.textContent ?? "";
    expect(text).toContain("服务炸了");
    expect(text).toContain("req-abc-123");
    expect(text).toContain("重试");
  });
});
