import { describe, expect, it } from "vitest";

import { shortId } from "./format";

/**
 * w182 点单：值班台/渠道页的外部标识（oc_ 会话、ou_ 发信人）不得裸上屏。
 * 本树 duty 域的 id 格式化器是 shortId（工单口径里的 fmtId 即它）——外部前缀
 * 的 id 不论长度，一律收成「后6位」短码形；内部短 id 的原样返回钉保持不变。
 * 测试值全部是合成同构串，真群里的活值不进 git。
 */
describe("外部标识不裸上屏（w182 红→绿行级钉）", () => {
  const ouShort = `ou_${"a".repeat(7)}`; // 12 位：现形制会原样返回（裸上屏缺陷本体）
  const ocLong = `oc_${"b".repeat(29)}`; // 35 位：现形制给中段截断 前6…尾4
  const ouLong = `ou_${"c".repeat(30)}`;
  const ocShort = `oc_${"d".repeat(5)}`;

  it("ou_ 短到 12 位也不再原样返回", () => {
    expect(shortId(ouShort)).not.toBe(ouShort);
  });

  it("长外部 id 收成末 6 位短码形，不是中段截断", () => {
    expect(shortId(ocLong)).toBe(`后6位 ${"b".repeat(6)}`);
  });

  it("oc_/ou_ 前缀任何长度都不原样出屏", () => {
    for (const v of [ouShort, ocLong, ouLong, ocShort]) {
      expect(shortId(v)).not.toBe(v);
      expect(shortId(v)).toContain(v.slice(-6));
    }
  });

  it("内部 id 形制不动：短的原样、长的保持前6…尾4、缺失仍是—", () => {
    expect(shortId("run_abc12")).toBe("run_abc12");
    expect(shortId("run_abcdef123456")).toBe("run_ab…3456");
    expect(shortId("emp_st_0016")).toBe("emp_st_0016");
    expect(shortId(null)).toBe("—");
    expect(shortId(undefined)).toBe("—");
  });

  it("格式化不吃额外请求：纯函数对同一输入恒等", () => {
    expect(shortId(ouShort)).toBe(shortId(ouShort));
  });
});
