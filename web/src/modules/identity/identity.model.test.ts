// @vitest-environment jsdom
/**
 * 人员与访问读数层（modules/identity/model.ts）纯函数契约。
 *
 * 钉住四件事：
 *  1) 台账行缺 id 或缺姓名的整行丢弃——不造「未命名」占位行；
 *  2) 副行数字全由行派生（在职 = active，待激活 = draft），不补 0；
 *  3) 部门分桶只数台账里写了的部门，未写的单列「未归属」；
 *  4) 404/501/503 = 未接线、403 = 无权限，两条腿互斥。
 */
import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-error";
import {
  departmentBuckets,
  departmentsFrom,
  filterMembers,
  isDenied,
  isUnwired,
  lifecyclePill,
  membersFrom,
  memberSummary,
  shortCode,
  toMember,
  type MemberRow,
} from "./model";

const rows: MemberRow[] = [
  { id: "emp_217A91BA995044DFBB3E2E940B", name: "质检助理", title: "质检", department: "客服中心", lifecycle: "active", updatedAt: null },
  { id: "emp_86A81CE8FF6F42E187BCF2B540", name: "产品助理", title: "产品助理", department: "产品部", lifecycle: "active", updatedAt: null },
  { id: "emp_0166858D562149938FBDA22649", name: "数据助理", title: "分析", department: null, lifecycle: "draft", updatedAt: null },
];

describe("identity 读数层", () => {
  it("缺 id 或缺姓名的台账行整行丢弃，不造占位行", () => {
    expect(toMember({ employeeId: "emp_1" })).toBeNull();
    expect(toMember({ name: "无号成员" })).toBeNull();
    expect(membersFrom({ items: [{ employeeId: "emp_1", name: "甲" }, { employeeId: "emp_2" }] })).toEqual([
      { id: "emp_1", name: "甲", title: null, department: null, lifecycle: null, updatedAt: null },
    ]);
  });

  it("副行数字按生命周期派生：在职=active，待激活=draft，其余计入其它", () => {
    expect(memberSummary(rows)).toEqual({ total: 3, active: 2, pending: 1, other: 0 });
    expect(memberSummary([...rows, { ...rows[0], id: "emp_x", lifecycle: "suspended" }])).toEqual({
      total: 4,
      active: 2,
      pending: 1,
      other: 1,
    });
    expect(memberSummary([])).toEqual({ total: 0, active: 0, pending: 0, other: 0 });
  });

  it("状态胶囊只给人话，未知态不把代码搬上屏", () => {
    expect(lifecyclePill("active")).toEqual({ tone: "ok", label: "在职" });
    expect(lifecyclePill("draft")).toEqual({ tone: "warn", label: "待激活" });
    expect(lifecyclePill("suspended")).toEqual({ tone: "mut", label: "已停用" });
    expect(lifecyclePill("whatever")).toEqual({ tone: "mut", label: "未标注" });
    expect(lifecyclePill(null).label).toBe("未标注");
  });

  it("部门分桶只数写了部门的行，未写的排最后且标记 unassigned", () => {
    expect(departmentBuckets(rows)).toEqual([
      { name: "产品部", count: 1, unassigned: false },
      { name: "客服中心", count: 1, unassigned: false },
      { name: "未归属", count: 1, unassigned: true },
    ]);
  });

  it("本地检索命中姓名 / 岗位 / 部门，空词返回全量", () => {
    expect(filterMembers(rows, "")).toHaveLength(3);
    expect(filterMembers(rows, "产品").map((r) => r.name)).toEqual(["产品助理"]);
    expect(filterMembers(rows, "客服").map((r) => r.name)).toEqual(["质检助理"]);
    expect(filterMembers(rows, "查无此人")).toHaveLength(0);
  });

  it("工号短码取尾部，完整 id 只留在 title", () => {
    expect(shortCode("emp_217A91BA995044DFBB3E2E940B")).toBe("3E2E940B");
    expect(shortCode("")).toBe("");
  });

  it("部门名册解析：没有名字的行丢弃，预算缺就 null（不写 0）", () => {
    expect(
      departmentsFrom({ items: [{ departmentId: "d1", name: "内容中心", memberCount: 5, monthlyBudgetUsd: 320 }] }),
    ).toEqual([
      {
        id: "d1",
        name: "内容中心",
        owner: null,
        members: 5,
        monthlyBudget: 320,
        monthlyFee: null,
        parent: null,
      },
    ]);
    expect(departmentsFrom({ items: [{ departmentId: "d2" }] })).toEqual([]);
  });

  it("缺读口与无权限是两条互斥的腿", () => {
    const err = (status: number) => new ApiError("x", { status, body: "{}", url: "/api/departments" });
    expect(isUnwired(err(404))).toBe(true);
    expect(isUnwired(err(501))).toBe(true);
    expect(isUnwired(err(503))).toBe(true);
    expect(isUnwired(err(403))).toBe(false);
    expect(isDenied(err(403))).toBe(true);
    expect(isDenied(err(404))).toBe(false);
    expect(isUnwired(new Error("boom"))).toBe(false);
  });
});