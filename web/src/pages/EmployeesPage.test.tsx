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
    expect(text).toContain("请求编号未记录");
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

  // ── R5 八条回归 ──────────────────────────────────────────────────────

  it("R5-3/4: 列表容器与行有稳定 testid，姓名是真链接可键盘聚焦", async () => {
    resolveEmployees([
      { id: "emp_9F3A1B2C3D4E", name: "小鲤", lifecycleState: "active" },
      { id: "emp_77AA99BB00CC", name: "阿澜", lifecycleState: "onboarding" },
    ]);
    await render();
    const list = container.querySelector('[data-testid="emp-l-list"]');
    expect(list).toBeTruthy();
    expect(list?.querySelectorAll('[data-testid="emp-l-row"]').length).toBe(2);
    const link = container.querySelector<HTMLAnchorElement>('[data-testid="emp-l-name-link"]');
    if (!link) throw new Error("emp-l-name-link is missing");
    expect(link.getAttribute("href")).toBe("/employees/emp_9F3A1B2C3D4E");
  });

  it("R5-5: 状态按 API lifecycle 真值映射；未知值显示「待核实」不猜", async () => {
    resolveEmployees([
      { id: "emp_A1", name: "甲", lifecycleState: "offboarding" },
      { id: "emp_B2", name: "乙", lifecycleState: "suspended" },
      { id: "emp_C3", name: "丙", lifecycleState: "quantic" },
    ]);
    await render();
    const text = container.textContent ?? "";
    expect(text).toContain("离职中");
    expect(text).toContain("已停用");
    expect(text).toContain("待核实");
  });

  it("R5-6: 同名员工以「姓名 · 8位短码」消歧，屏幕上无裸 emp_", async () => {
    resolveEmployees([
      { id: "emp_9F3A1B2C3D4E", name: "小鲤", lifecycleState: "active" },
      { id: "emp_Z8Y7X6W5V4U3", name: "小鲤", lifecycleState: "active" },
    ]);
    await render();
    const links = [...container.querySelectorAll("a")].map((a) => a.textContent);
    expect(links).toContain("小鲤 · 9F3A1B2C");
    expect(links).toContain("小鲤 · Z8Y7X6W5");
    expect(container.textContent).not.toMatch(/emp_/);
  });

  it("R5-7: 支出与运行/审批同口径（USD 千分位两位小数）", async () => {
    resolveEmployees([{ id: "emp_D4", name: "丁", lifecycleState: "active", spend: 1234.5 }]);
    await render();
    expect(container.textContent).toContain("$1,234.50");
  });

  it("R5-1 → 设计车道 ①: 401 不再自绘失效卡 — 回落通用错误 + 可复制请求编号 + 重试，登录失效只由全站横幅说一次", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.reject(
        new ApiError("unauthenticated", {
          status: 401,
          body: "",
          url,
          requestId: "req-401-77",
        }),
      ),
    );
    await render();
    const text = container.textContent ?? "";
    // 页面不再重复说「登录失效」：那句话归 SessionExpiredBanner（shell/SessionExpiredBanner.tsx）。
    expect(text).not.toContain("需要登录");
    expect(text).not.toContain("登录状态已失效");
    expect(container.querySelector('[data-testid="auth-reload-exit"]')).toBeNull();
    // 通用错误呈现仍在：标题、请求编号、重试。
    expect(text).toContain("无法加载数字员工列表");
    expect(text).toContain("req-401-77");
    expect(text).toContain("重试");
    // 绝不能停在无限 loading 骨架
    expect(container.querySelector('[aria-busy="true"]')).toBeFalsy();
  });
});

describe("EmployeesPage (R7.1 item 4/6 — real detail links and same-name codes)", () => {
  it("live /v1/matrix/employees envelope rows link by real agent id, not row numbers", async () => {
    fetchJSON.mockImplementation((url: string) =>
      url.includes("/api/matrix")
        ? Promise.resolve({
            "1": {
              name: "AgentOS 产品助理",
              agent: "emp_41018EB4A68341AE8FA0B34856AE01F7",
              lifecycle: "active",
            },
            "2": {
              name: "AgentOS 产品助理",
              agent: "emp_80C8938810144061B7238B79F23DD4BD",
              lifecycle: "onboarding",
            },
          })
        : Promise.reject(new ApiError("找不到", { status: 404, body: "", url })),
    );
    await render();
    const links = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('a[href^="/employees/"]'),
    );
    expect(links).toHaveLength(2);
    expect(links[0]!.getAttribute("href")).toContain("emp_41018EB4A68341AE8FA0B34856AE01F7");
    expect(links[1]!.getAttribute("href")).toContain("emp_80C8938810144061B7238B79F23DD4BD");
    const names = links.map((a) => a.textContent ?? "");
    expect(names[0]).not.toBe(names[1]);
    expect(names.join(" ")).toContain("41018EB4");
    expect(names.join(" ")).toContain("80C89388");
    expect(names.join(" ")).not.toContain("/employees/1");
    const hrefs = links.map((a) => a.getAttribute("href") ?? "");
    expect(hrefs.join(" ")).not.toMatch(/\/employees\/\d+$/);
  });

  it("R9-4/6: live /api/employees items[] rows expose employeeId links and 8-digit codes", async () => {
    fetchJSON.mockImplementation((url: string) =>
      url.includes("/api/employees")
        ? Promise.resolve({
            items: [
              { employeeId: "emp_86A81CE8FF6F42E187BCF2B540", name: "AgentOS 产品助理", lifecycleState: "active" },
              { employeeId: "emp_0166858D562149938FBDA22649", name: "AgentOS 产品助理", lifecycleState: "active" },
            ],
          })
        : Promise.reject(new ApiError("找不到", { status: 404, body: "", url })),
    );
    await render();
    const links = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('a[href^="/employees/"]'),
    );
    expect(links).toHaveLength(2);
    expect(links[0]!.getAttribute("href")).toContain("emp_86A81CE8FF6F42E187BCF2B540");
    const text = links.map((a) => a.textContent ?? "").join(" ");
    expect(text).toContain("86A81CE8");
    expect(text).toContain("0166858D");
    expect(text).not.toContain("emp_");
  });

  it("R13 深链：行带 task/run 引用时给出可聚焦的真链接，原值只进 title", async () => {
    resolveEmployees([
      {
        employeeId: "emp_DL0001",
        name: "深链员",
        lifecycleState: "active",
        task_id: "tk_DL9999",
        run_id: "run_DL8888",
      },
      { employeeId: "emp_DL0002", name: "无链员", lifecycleState: "active" },
    ]);
    await render();
    const taskLink = container.querySelector<HTMLAnchorElement>(
      'a[href="/work?tab=board"]',
    );
    expect(taskLink).toBeTruthy();
    expect(taskLink!.textContent).toContain("最近任务");
    expect(taskLink!.getAttribute("title")).toBe("tk_DL9999");
    const runLink = container.querySelector<HTMLAnchorElement>('a[href="/runs"]');
    expect(runLink).toBeTruthy();
    expect(runLink!.textContent).toContain("最近运行");
    expect(runLink!.getAttribute("title")).toBe("run_DL8888");
    // 无字段的行不出第二条链（只有深链员一行有）
    expect(container.querySelectorAll('a[href="/work?tab=board"]')).toHaveLength(
      1,
    );
    // 原值不在可见文本上屏
    const body = container.textContent ?? "";
    expect(body).not.toContain("tk_DL9999");
    expect(body).not.toContain("run_DL8888");
  });
});
