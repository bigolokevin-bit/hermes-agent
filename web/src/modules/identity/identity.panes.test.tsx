// @vitest-environment jsdom
/**
 * 人员与访问三屏形制契约（骨架 console-v4-skeleton.html L3582-3847）。
 *
 * 每屏钉四件事：
 *  1) 页头副行是本次真读数的派生句（人数/在职/待激活、部门数），不是骨架的 42/5；
 *  2) 表头只留本轮有读口的列，无读口整列不渲染（列名逐字照骨架的可用列）；
 *  3) 缺失只走卡底「数据可用性」清单声明一次，正文不逐行铺 `—`；
 *  4) 模块内不出 role="tablist"、不出 h1、不出示例数据；卡头是 h2。
 *
 * 另钉错误腿：403 说「没有权限」，5xx 说「读不到」，两条腿互斥。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ fetchJSON: vi.fn() }));

import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import IdentityPeoplePage from "./IdentityPeoplePage";
import IdentityDepartmentsPage from "./IdentityDepartmentsPage";
import IdentityRolesPage from "./IdentityRolesPage";

const mocked = vi.mocked(fetchJSON);

const EMPLOYEES = {
  items: [
    {
      employeeId: "emp_217A91BA995044DFBB3E2E940B",
      name: "质检助理",
      title: "质检专员（数字员工）",
      department: "客服中心",
      lifecycleState: "active",
      ownerUserId: "1",
      updatedAt: "2026-11-17T05:52:48.030Z",
    },
    {
      employeeId: "emp_86A81CE8FF6F42E187BCF2B540",
      name: "产品助理",
      title: "产品助理（数字员工）",
      department: "产品部",
      lifecycleState: "active",
      ownerUserId: "1",
      updatedAt: "2026-11-21T18:39:20.010Z",
    },
    {
      employeeId: "emp_0166858D562149938FBDA22649",
      name: "数据助理",
      title: "分析（数字员工）",
      department: null,
      lifecycleState: "draft",
      ownerUserId: null,
      updatedAt: "2026-11-13T06:02:53.031Z",
    },
  ],
};

const STATS = { total: 3, byLifecycle: { draft: 1, active: 2, paused: 0, archived: 0 } };

const MATRIX = {
  items: [
    {
      employeeId: "emp_217A91BA995044DFBB3E2E940B",
      name: "质检助理",
      lifecycleState: "active",
      skillCount: 0,
      budget: { dailyTokens: 100000, monthlyCostUsd: 10, perRunMaxUsd: 1 },
    },
    {
      employeeId: "emp_86A81CE8FF6F42E187BCF2B540",
      name: "产品助理",
      lifecycleState: "active",
      skillCount: 0,
      budget: { dailyTokens: 2000000, monthlyCostUsd: 100, perRunMaxUsd: 1 },
    },
    {
      employeeId: "emp_0166858D562149938FBDA22649",
      name: "数据助理",
      lifecycleState: "draft",
      skillCount: 0,
      budget: { dailyTokens: 100000, monthlyCostUsd: 10, perRunMaxUsd: 0.5 },
    },
  ],
};

const ME = { user_id: "1", display_name: "opsadmin", org_id: "t_seakoi_pilot" };

function route(url: unknown): Promise<unknown> {
  const path = String(url);
  if (path.includes("/api/employees")) return Promise.resolve(EMPLOYEES);
  if (path.includes("/api/employee-stats")) return Promise.resolve(STATS);
  if (path.includes("/api/matrix")) return Promise.resolve(MATRIX);
  if (path.includes("/api/auth/me")) return Promise.resolve(ME);
  if (path.includes("/departments")) {
    return Promise.reject(new ApiError("未接入", { status: 404, body: "{}", url: path }));
  }
  return Promise.reject(new ApiError("unknown", { status: 500, body: "{}", url: path }));
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  mocked.mockReset();
  mocked.mockImplementation(route as unknown as typeof fetchJSON);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

/** 每次挂载都换一个根：同一根重渲染会沿用上一次的 state，错误腿会串味。 */
async function mount(node: React.ReactElement) {
  act(() => root.unmount());
  host.remove();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    // Link 需要路由上下文：用 MemoryRouter 包一层，与外壳 BrowserRouter 同语义。
    root.render(<MemoryRouter>{node}</MemoryRouter>);
  });
  // 两段微任务：loadIdentity 的 Promise.allSettled → setState → 重渲染。
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function text(selector: string): string {
  return (host.querySelector(selector)?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** 去掉全部空白再比对：JSX 换行不该影响副行口径。 */
function flat(selector: string): string {
  return (host.querySelector(selector)?.textContent ?? "").replace(/\s+/g, "");
}

function headers(selector: string): string[] {
  return [...host.querySelectorAll(`${selector} thead th`)].map((th) => (th.textContent ?? "").trim());
}

function cells(row: Element): string[] {
  return [...row.querySelectorAll("td")].map((td) => (td.textContent ?? "").trim());
}

function gaps(cardTestId: string): string[] {
  return [...host.querySelectorAll(`[data-testid="${cardTestId}"] .console-card__availability-label`)].map((li) =>
    (li.textContent ?? "").trim(),
  );
}

describe("人员与访问 · 人员目录", () => {
  it("副行用本次读数派生；表头只留有读口的列", async () => {
    await mount(<IdentityPeoplePage />);

    expect(flat('[data-testid="identity-people-sub"]')).toBe("3名成员·2在职·1待激活");
    expect(headers('[data-testid="identity-people-table"]')).toEqual([
      "成员",
      "部门 / 岗位",
      "月费上限",
      "日 token 上限",
      "状态",
      "台账更新",
    ]);
    expect(text('[data-testid="identity-people-count"]')).toBe("3 条 · 显示 3");
  });

  it("每行是真读数：部门岗位、月费、日 token、状态、更新时刻，正文没有破折号", async () => {
    await mount(<IdentityPeoplePage />);

    const rows = [...host.querySelectorAll('[data-testid="identity-people-table"] tbody tr')];
    expect(rows).toHaveLength(3);

    const first = cells(rows[0]);
    expect(first[0]).toContain("质检助理");
    expect(first[0]).toContain("3E2E940B");
    expect(first.slice(1)).toEqual(["客服中心 · 质检专员（数字员工）", "$10.00", "100,000", "在职", "11-17 13:52"]);

    const draftRow = rows.find((row) => (row.textContent ?? "").includes("数据助理"))!;
    expect(cells(draftRow)[1]).toBe("未归属 · 分析（数字员工）");
    expect(cells(draftRow)[4]).toBe("待激活");

    // 同一缺失只声明一次：正文不再逐行铺破折号。
    expect((host.textContent ?? "").match(/—/g) ?? []).toHaveLength(0);
    // 骨架的 42 / 38 / 4 不许出现（禁编数字）。
    expect(host.textContent).not.toMatch(/\b42\b|\b38\b/);
  });

  it("无读口的列与被摘掉的骨架卡只在卡底声明一次", async () => {
    await mount(<IdentityPeoplePage />);

    expect(gaps("identity-people-card")).toEqual([
      "角色",
      "可管理员工",
      "最近登录",
      "管理员名单",
      "最近管理员操作",
      "真人成员名录",
    ]);
    // 管理员名单 / 最近管理员操作整块不渲染，也不留一行 `—`。
    expect(host.querySelector('[data-testid="identity-admins-card"]')).toBeNull();
    expect(host.querySelector('[data-testid="identity-audit-card"]')).toBeNull();
    expect(host.textContent).not.toContain("只读");
  });

  it("卡头是 6 个 h2；模块内不出 tablist、不出 h1、不出示例数据", async () => {
    await mount(<IdentityPeoplePage />);

    expect(host.querySelectorAll("h2")).toHaveLength(6);
    expect(host.querySelectorAll('[role="tablist"]')).toHaveLength(0);
    expect(host.querySelectorAll("h1")).toHaveLength(0);
    expect(host.querySelectorAll("[data-fixture]")).toHaveLength(0);
  });

  it("矩阵读不到时整列不渲染，缺口并进同一份可用性清单", async () => {
    mocked.mockImplementation(((url: unknown) => {
      const path = String(url);
      if (path.includes("/api/matrix")) {
        return Promise.reject(new ApiError("unwired", { status: 404, body: "{}", url: path }));
      }
      return route(url);
    }) as unknown as typeof fetchJSON);

    await mount(<IdentityPeoplePage />);

    expect(headers('[data-testid="identity-people-table"]')).toEqual([
      "成员",
      "部门 / 岗位",
      "状态",
      "台账更新",
    ]);
    expect(gaps("identity-people-card")).toContain("月费上限与额度");
    expect((host.textContent ?? "").match(/—/g) ?? []).toHaveLength(0);
  });

  it("403 说没有权限，5xx 说读不到，两条腿互斥", async () => {
    mocked.mockImplementation(((url: unknown) => {
      const path = String(url);
      if (path.includes("/api/employees")) {
        return Promise.reject(new ApiError("denied", { status: 403, body: "{}", url: path }));
      }
      return route(url);
    }) as unknown as typeof fetchJSON);

    await mount(<IdentityPeoplePage />);
    const denied = text('[data-testid="identity-people-state"]');
    expect(denied).toContain("无权查看");
    expect(denied).toContain("你没有查看权限");
    expect(denied).not.toContain("读不到");

    mocked.mockImplementation(((url: unknown) => {
      const path = String(url);
      if (path.includes("/api/employees")) {
        return Promise.reject(new ApiError("boom", { status: 500, body: "{}", url: path }));
      }
      return route(url);
    }) as unknown as typeof fetchJSON);

    await mount(<IdentityPeoplePage />);
    const broken = text('[data-testid="identity-people-state"]');
    expect(broken).toContain("读不到成员台账");
    expect(broken).not.toContain("没有权限");
  });
});

describe("人员与访问 · 组织与部门", () => {
  it("副行只写算得出的段：部门数 + 成员数 + 员工月费合计，预算段省略（不写 0）", async () => {
    await mount(<IdentityDepartmentsPage />);

    expect(flat('[data-testid="identity-departments-sub"]')).toBe("2个部门·3名成员·员工月费合计$120.00");
    expect(host.textContent).not.toContain("$0");
    expect(host.textContent).not.toMatch(/月度预算合计/);
  });

  it("列只留有读口的：负责人与月度预算整列不渲染，月费/占比/状态由台账现算", async () => {
    await mount(<IdentityDepartmentsPage />);

    expect(headers('[data-testid="identity-dept-table"]')).toEqual([
      "部门",
      "员工数",
      "在职",
      "待激活",
      "员工月费合计",
      "占月费总额",
      "状态",
    ]);

    const rows = [...host.querySelectorAll('[data-testid="identity-dept-table"] tbody tr')];
    expect(rows).toHaveLength(3); // 产品部 / 客服中心 / 未归属
    expect(cells(rows[0])).toEqual(["产品部", "1", "1", "0", "$100.00", "83.3%", "全员在职"]);
    expect(cells(rows[1])).toEqual(["客服中心", "1", "1", "0", "$10.00", "8.3%", "全员在职"]);
    expect(cells(rows[2])).toEqual(["未归属", "1", "0", "1", "$10.00", "8.3%", "待激活 1"]);

    expect(gaps("identity-dept-table-card")).toEqual(["部门负责人", "月度预算"]);
    expect((host.textContent ?? "").match(/—/g) ?? []).toHaveLength(0);
  });

  it("组织树按台账部门字段拼一层，组内成员逐行；每块缺失各自只声明一次", async () => {
    await mount(<IdentityDepartmentsPage />);

    const branches = [...host.querySelectorAll('[data-testid="identity-dept-tree-card"] .id-tree__leaf')].map((li) =>
      (li.textContent ?? "").replace(/\s+/g, ""),
    );
    expect(branches).toEqual(["产品部1产品助理在职", "客服中心1质检助理在职", "未归属1数据助理待激活"]);
    expect(
      host.querySelector('[data-testid="identity-dept-tree-card"] .id-tree__kid-name')?.getAttribute("href"),
    ).toBe("/employees/emp_86A81CE8FF6F42E187BCF2B540");
    expect(gaps("identity-dept-tree-card")).toEqual(["部门层级与上下级", "空部门"]);
    expect(gaps("identity-dept-cost-card")).toEqual(["本月已用"]);
    expect(host.querySelectorAll("h1")).toHaveLength(0);
    expect(host.querySelectorAll('[role="tablist"]')).toHaveLength(0);
  });
});

describe("人员与访问 · 角色与权限", () => {
  it("副行照骨架形制写角色 × 动作；矩阵六列照骨架，无角色读口时留一行占位行", async () => {
    await mount(<IdentityRolesPage />);

    expect(flat('[data-testid="identity-roles-sub"]')).toBe("角色定义未读到×6类动作·条件权限未读到");
    expect(headers('[data-testid="identity-matrix-table"]')).toEqual([
      "角色",
      "查看",
      "运行任务",
      "写入配置",
      "审批",
      "安装",
      "删除",
      "成员",
    ]);
    const rows = [...host.querySelectorAll('[data-testid="identity-matrix-table"] tbody tr')];
    expect(rows).toHaveLength(1);
    // 2026-11-24 评审口径：整行都没有数据时只写一次缺读事实，不逐格铺 `—`
    // （逐格破折号会把页面画成报错图）。
    expect(cells(rows[0])).toEqual(["未读到角色定义"]);
    expect(rows[0].querySelector("td[colspan]")).toBeTruthy();
    expect(gaps("identity-matrix-card")).toEqual(["角色定义/权限矩阵"]);
    // 表头与副行里不出现破折号（缺值只进格内）。
    expect(headers('[data-testid="identity-matrix-table"]').some((h) => h.includes("—"))).toBe(false);
    expect(text('[data-testid="identity-roles-sub"]')).not.toContain("—");
  });

  it("台账带角色字段时矩阵按真实角色起行，六类动作仍留缺值格", async () => {
    mocked.mockImplementation(((url: unknown) => {
      const path = String(url);
      if (path.includes("/api/employees")) {
        return Promise.resolve({
          items: [
            { employeeId: "emp_1", name: "甲", department: "产品部", lifecycleState: "active", role: "平台管理员" },
            { employeeId: "emp_2", name: "乙", department: "产品部", lifecycleState: "active", role: "平台管理员" },
            { employeeId: "emp_3", name: "丙", department: "客服中心", lifecycleState: "draft", role: "审批人" },
          ],
        });
      }
      return route(url);
    }) as unknown as typeof fetchJSON);

    await mount(<IdentityRolesPage />);

    expect(flat('[data-testid="identity-roles-sub"]')).toBe("2个角色×6类动作·条件权限未读到");
    const rows = [...host.querySelectorAll('[data-testid="identity-matrix-table"] tbody tr')];
    expect(rows).toHaveLength(2);
    expect(cells(rows[0])).toEqual(["平台管理员", "—", "—", "—", "—", "—", "—", "2"]);
    expect(cells(rows[1])).toEqual(["审批人", "—", "—", "—", "—", "—", "—", "1"]);
    expect(gaps("identity-matrix-card")).toEqual(["角色定义/权限矩阵"]);
  });

  it("按部门聚合真台账：部门 / 成员数 / 成员 chip / 在职待激活", async () => {
    await mount(<IdentityRolesPage />);

    expect(headers('[data-testid="identity-role-dept-table"]')).toEqual([
      "部门",
      "成员数",
      "成员",
      "在职/待激活",
    ]);
    const rows = [...host.querySelectorAll('[data-testid="identity-role-dept-table"] tbody tr')];
    expect(rows).toHaveLength(3);
    const rowsCells = rows.map((row) =>
      [...row.querySelectorAll("td")].map((td) => (td.textContent ?? "").trim()),
    );
    expect(rowsCells[0]).toEqual(["产品部", "1", "产品助理", "在职 1"]);
    expect(rowsCells[1]).toEqual(["客服中心", "1", "质检助理", "在职 1"]);
    expect(rowsCells[2]).toEqual(["未归属", "1", "数据助理", "待激活 1"]);
    expect(rows[0].querySelectorAll(".id-chip")).toHaveLength(1);
  });

  it("成员明细补回角色与最近操作两列：角色取台账真值（无则破折号）", async () => {
    await mount(<IdentityRolesPage />);

    expect(headers('[data-testid="identity-role-detail-table"]')).toEqual([
      "成员",
      "角色",
      "部门范围",
      "最近操作",
      "状态",
    ]);
    const rows = [...host.querySelectorAll('[data-testid="identity-role-detail-table"] tbody tr')];
    expect(rows).toHaveLength(3);
    const first = cells(rows[0]);
    expect(first[0]).toContain("质检助理");
    expect(first[0]).toContain("3E2E940B");
    expect(first.slice(1)).toEqual(["—", "客服中心", "—", "在职"]);
    const texts = rows.map((row) => row.textContent ?? "");
    expect(texts.some((c) => c.includes("质检助理") && c.includes("客服中心") && c.includes("在职"))).toBe(true);
    expect(texts.some((c) => c.includes("产品助理") && c.includes("产品部") && c.includes("在职"))).toBe(true);
    expect(texts.some((c) => c.includes("数据助理") && c.includes("未填写") && c.includes("待激活"))).toBe(true);
    expect(gaps("identity-role-detail-card")).toEqual(["角色", "最近操作"]);
  });

  it("按角色留一行占位；异常与建议由台账现算，提权卡指向审计", async () => {
    await mount(<IdentityRolesPage />);

    expect(headers('[data-testid="identity-role-roster-table"]')).toEqual([
      "角色",
      "成员",
      "人数",
      "范围",
    ]);
    expect(host.querySelectorAll('[data-testid="identity-role-roster-table"] tbody tr')).toHaveLength(1);
    expect(host.querySelectorAll('[data-testid="identity-role-alert-card"] .id-notice')).toHaveLength(3);
    expect(host.querySelectorAll('[data-testid="identity-role-advice-card"] .id-notice')).toHaveLength(2);
    expect(
      host.querySelector('[data-testid="identity-role-escalation-card"] a.id-link')?.getAttribute("href"),
    ).toBe("#/audit");
  });

  it("9 张卡都有 h2 卡头；模块内不出 tablist / h1 / 示例数据", async () => {
    await mount(<IdentityRolesPage />);

    expect(host.querySelectorAll("h2")).toHaveLength(9);
    expect(host.querySelectorAll('[role="tablist"]')).toHaveLength(0);
    expect(host.querySelectorAll("h1")).toHaveLength(0);
    expect(host.querySelectorAll("[data-fixture]")).toHaveLength(0);
  });
});