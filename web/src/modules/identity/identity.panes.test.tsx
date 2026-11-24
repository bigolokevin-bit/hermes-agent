// @vitest-environment jsdom
/**
 * 人员与访问三屏形制契约（骨架 console-v4-skeleton.html L3581-3976）。
 *
 * 每屏钉四件事：
 *  1) 页头副行是本次真读数的派生句（人数/在职/待激活、几个部门），不是骨架的 42/5；
 *  2) 表头列名逐字照骨架（少一个词就算漂移）；
 *  3) 没有读口的字段一律「—」，卡底 11px 一行写清「缺读口：…」；
 *  4) 模块内不出 role="tablist"、不出 h1（外壳已有）。
 *
 * 另钉错误腿：403 说「没有权限」，5xx 说「读不到」，两条腿互斥。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
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
    },
    {
      employeeId: "emp_86A81CE8FF6F42E187BCF2B540",
      name: "产品助理",
      title: "产品助理（数字员工）",
      department: "产品部",
      lifecycleState: "active",
    },
    {
      employeeId: "emp_0166858D562149938FBDA22649",
      name: "数据助理",
      title: "分析（数字员工）",
      department: null,
      lifecycleState: "draft",
    },
  ],
};

const ME = { user_id: "1", display_name: "opsadmin", org_id: "t_seakoi_pilot" };

function route(url: unknown): Promise<unknown> {
  const path = String(url);
  if (path.includes("/api/employees")) return Promise.resolve(EMPLOYEES);
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
    root.render(node);
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

function headers(selector: string): string[] {
  return [...host.querySelectorAll(`${selector} thead th`)].map((th) => (th.textContent ?? "").trim());
}

describe("人员与访问 · 人员目录", () => {
  it("副行用本次读数派生，列名逐字照骨架", async () => {
    await mount(<IdentityPeoplePage />);

    expect(text('[data-testid="identity-people-sub"]')).toBe("3 名成员·2 在职·1 待激活");
    expect(headers('[data-testid="identity-people-table"]')).toEqual([
      "成员",
      "部门 / 岗位",
      "角色",
      "可管理员工",
      "最近登录",
      "状态",
    ]);
    expect(text('[data-testid="identity-people-count"]')).toBe("3 条 · 显示 3");
  });

  it("每行成员来自台账，缺读口列一律破折号，卡底写清缺哪几个", async () => {
    await mount(<IdentityPeoplePage />);

    const rows = [...host.querySelectorAll('[data-testid="identity-people-table"] tbody tr')];
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain("质检助理");
    expect(rows[2].textContent).toContain("待激活");
    // 角色 / 可管理员工 / 最近登录 = 每行三个破折号
    expect((rows[0].textContent ?? "").match(/—/g)).toHaveLength(3);

    const foot = text('[data-testid="identity-people-card"] .id-foot');
    expect(foot).toContain("缺读口：角色、可管理员工、最近登录");
    // 骨架的 42 / 38 / 4 不许出现（禁编数字）
    expect(host.textContent).not.toMatch(/\b42\b|\b38\b/);
  });

  it("模块内不出 tablist、不出 h1", async () => {
    await mount(<IdentityPeoplePage />);
    expect(host.querySelectorAll('[role="tablist"]')).toHaveLength(0);
    expect(host.querySelectorAll("h1")).toHaveLength(0);
  });

  it("管理员两张卡保留骨架列名，表体写缺读口整行", async () => {
    await mount(<IdentityPeoplePage />);

    expect(headers('[data-testid="identity-admins-card"] table')).toEqual([
      "成员",
      "级别",
      "MFA",
      "最近操作",
      "近 30 天高危操作",
    ]);
    expect(headers('[data-testid="identity-audit-card"] table')).toEqual([
      "时间",
      "操作人",
      "动作",
      "对象",
      "结果",
    ]);
    expect(text('[data-testid="identity-admins-card"] .id-gap-cell')).toContain("缺读口：角色与管理级别");
    expect(text('[data-testid="identity-audit-card"] .id-gap-cell')).toContain("缺读口：管理员操作日志");
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
  it("副行只写算得出的段：部门数 + 已归属 + 未归属，预算段省略（不写 0）", async () => {
    await mount(<IdentityDepartmentsPage />);

    expect(text('[data-testid="identity-departments-sub"]')).toBe("2 个部门·2 名成员有部门·1 名未归属");
    expect(host.textContent).not.toContain("$0");
    expect(host.textContent).not.toMatch(/月度预算合计/);
  });

  it("列名逐字照骨架；负责人/预算/月费/占比为破折号，员工数是真读数", async () => {
    await mount(<IdentityDepartmentsPage />);

    expect(headers('[data-testid="identity-dept-table"]')).toEqual([
      "部门",
      "负责人",
      "员工数",
      "月度预算",
      "员工月费合计",
      "占月费总额",
      "状态",
    ]);
    const rows = [...host.querySelectorAll('[data-testid="identity-dept-table"] tbody tr')];
    expect(rows).toHaveLength(3); // 产品部 / 客服中心 / 未归属
    const first = [...rows.find((r) => (r.textContent ?? "").includes("产品部"))!.querySelectorAll("td")].map(
      (td) => (td.textContent ?? "").trim(),
    );
    // 未归属不是部门：部门数只数写了部门的桶。
    expect(first).toEqual(["产品部", "—", "1", "—", "—", "—", "名册未接入"]);

    expect(text('[data-testid="identity-dept-table-card"] .id-foot')).toContain(
      "缺读口：部门负责人、月度预算、员工月费合计、占月费总额",
    );
  });
});

describe("人员与访问 · 角色与权限", () => {
  it("副行不写任何角色数；矩阵列名逐字照骨架，表体一行缺读口", async () => {
    await mount(<IdentityRolesPage />);

    expect(text('[data-testid="identity-roles-sub"]')).toBe(
      "角色定义与权限矩阵没有读口：本页不列角色、不画示例矩阵，也不写条件权限的处数。",
    );
    expect(headers('[data-testid="identity-matrix-table"]')).toEqual([
      "角色",
      "查看",
      "运行任务",
      "写入配置",
      "审批",
      "安装",
      "删除",
    ]);
    expect(host.querySelectorAll('[data-testid="identity-matrix-table"] tbody tr')).toHaveLength(1);
  });

  it("另三卡列名照骨架；成员侧填真台账行，角色与范围是破折号", async () => {
    await mount(<IdentityRolesPage />);

    expect(headers('[data-testid="identity-role-members-card"] table')).toEqual(["成员", "操作", "角色"]);
    expect(headers('[data-testid="identity-role-size-card"] table')).toEqual(["成员", "人数", "范围"]);
    expect(headers('[data-testid="identity-role-detail-table"]')).toEqual([
      "成员",
      "角色",
      "部门范围",
      "最近操作",
      "状态",
    ]);

    const rows = [...host.querySelectorAll('[data-testid="identity-role-detail-table"] tbody tr')];
    expect(rows).toHaveLength(3);
    const cells = rows.map((row) => row.textContent ?? "");
    expect(cells.some((c) => c.includes("质检助理") && c.includes("客服中心") && c.includes("在职"))).toBe(true);
    expect(cells.some((c) => c.includes("产品助理") && c.includes("产品部") && c.includes("在职"))).toBe(true);
    expect(cells.some((c) => c.includes("数据助理") && c.includes("待激活"))).toBe(true);
  });
});