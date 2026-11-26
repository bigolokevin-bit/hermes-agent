// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildGrantBody,
  buildIdentityPatch,
  parseActions,
  readCreatedGrant,
  readHandoverCandidates,
  selectorHasWildcard,
  transitionOptions,
  validateGrantDraft,
  validateIdentityDraft,
  type GrantDraft,
} from "@/modules/employee-detail/employeeEdits";

const baseDraft: GrantDraft = {
  scopeType: "tool",
  source: "role",
  actions: "send, read",
  expiresAt: "2026-12-01T10:00",
  approvalRef: "",
  selectorText: '{"types":["tool"]}',
};

describe("employeeEdits — 身份草稿校验与补丁", () => {
  it("姓名/岗位非空且限长；部门可空，超 64 报错", () => {
    expect(validateIdentityDraft({ name: "", title: "", department: "" })).toHaveLength(2);
    expect(validateIdentityDraft({ name: "x".repeat(41), title: "t", department: "d" })).toEqual([
      { field: "name", message: "姓名最多 40 字。" },
    ]);
    expect(validateIdentityDraft({ name: "n", title: "t".repeat(61), department: "d" })).toEqual([
      { field: "title", message: "岗位最多 60 字。" },
    ]);
    expect(validateIdentityDraft({ name: "n", title: "t", department: "d".repeat(65) })[0]?.field).toBe("department");
    expect(validateIdentityDraft({ name: "n", title: "t", department: "" })).toHaveLength(0);
  });

  it("只发变化的键；部门清空发 null；永不发 ownerUserId", () => {
    const original = { name: "名", title: "岗", department: "产品部" };
    expect(buildIdentityPatch(original, original)).toEqual({});
    expect(buildIdentityPatch(original, { ...original, title: " 新岗 " })).toEqual({ title: "新岗" });
    expect(buildIdentityPatch(original, { ...original, department: "" })).toEqual({ department: null });
    expect(buildIdentityPatch(original, { ...original, name: "新名", department: "" })).toEqual({
      name: "新名",
      department: null,
    });
  });
});

describe("employeeEdits — 生命周期合法边", () => {
  it("active 只给暂停与离职，且都可用", () => {
    const opts = transitionOptions("active");
    expect(opts.map((o) => o.to)).toEqual(["paused", "offboarding"]);
    expect(opts.every((o) => o.enabled)).toBe(true);
  });

  it("offboarding → archived 置灰并注明域侧未实现", () => {
    const archived = transitionOptions("offboarding").find((o) => o.to === "archived");
    expect(archived?.enabled).toBe(false);
    expect(archived?.reason).toContain("恒 409");
  });

  it("archived 是终态；未知态没有按钮", () => {
    expect(transitionOptions("archived")).toEqual([]);
    expect(transitionOptions("weird")).toEqual([]);
  });
});

describe("employeeEdits — 授权表单", () => {
  it("临时来源必须带审批引用", () => {
    const issues = validateGrantDraft({ ...baseDraft, source: "temporary" });
    expect(issues.map((i) => i.field)).toContain("approvalRef");
    expect(validateGrantDraft({ ...baseDraft, source: "temporary", approvalRef: "appr_1" })).toHaveLength(0);
  });

  it("选择器必须是 JSON 对象、非空、递归禁通配", () => {
    expect(validateGrantDraft({ ...baseDraft, selectorText: "" })[0]?.field).toBe("selectorText");
    expect(validateGrantDraft({ ...baseDraft, selectorText: "{}" })[0]?.field).toBe("selectorText");
    expect(validateGrantDraft({ ...baseDraft, selectorText: "[]" })[0]?.field).toBe("selectorText");
    expect(validateGrantDraft({ ...baseDraft, selectorText: '{"a":{"b":["x","*"]}}' })[0]?.field).toBe("selectorText");
    expect(selectorHasWildcard({ a: { b: ["x", "*"] } })).toBe(true);
    expect(selectorHasWildcard({ a: { b: ["x", "y"] } })).toBe(false);
  });

  it("有效期必填且可解析；空则报错", () => {
    expect(validateGrantDraft({ ...baseDraft, expiresAt: "" })[0]?.field).toBe("expiresAt");
    expect(validateGrantDraft({ ...baseDraft, expiresAt: "not-a-date" })[0]?.field).toBe("expiresAt");
  });

  it("动作按逗号/空白切分去重", () => {
    expect(parseActions(" send, read，send  write ")).toEqual(["send", "read", "write"]);
    expect(validateGrantDraft({ ...baseDraft, actions: " , " })[0]?.field).toBe("actions");
  });

  it("请求体：角色来源不带 approvalRef，临时来源带上；无 scopeId；到期转 ISO", () => {
    const role = buildGrantBody("emp_X", baseDraft);
    expect(role).toEqual({
      employeeId: "emp_X",
      scopeType: "tool",
      source: "role",
      resourceSelector: { types: ["tool"] },
      actions: ["send", "read"],
      expiresAt: new Date("2026-12-01T10:00").toISOString(),
    });
    const temp = buildGrantBody("emp_X", { ...baseDraft, source: "temporary", approvalRef: "appr_9" });
    expect(temp.approvalRef).toBe("appr_9");
    expect("scopeId" in temp).toBe(false);
  });

  it("回包 grant id 支持平铺与嵌套，缺了不编造", () => {
    expect(readCreatedGrant({ id: "gr_A" }).id).toBe("gr_A");
    expect(readCreatedGrant({ grant: { id: "gr_B" } }).id).toBe("gr_B");
    expect(readCreatedGrant({}).id).toBeNull();
  });

  it("交接候选排除当前员工", () => {
    const rows = readHandoverCandidates(
      { items: [{ employeeId: "emp_A", name: "甲" }, { employeeId: "emp_SELF", name: "我" }, { employeeId: "" }] },
      "emp_SELF",
    );
    expect(rows).toEqual([{ employeeId: "emp_A", name: "甲" }]);
  });
});
