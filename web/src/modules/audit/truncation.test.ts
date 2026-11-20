/**
 * audO — 长值截断的算术与话术。断言的是：省略数按实际字符串算、短值不加任何
 * 装饰、title 一定带完整原文与「已省略 N 字符」、已有的 title（原始标识/缺失原因）
 * 被并列而不是被顶掉。
 */
import { describe, expect, it } from "vitest";

import { TRUNC_CELL, TRUNC_LINE, joinTitles, truncatedView } from "./truncation";

describe("audO - the truncation contract", () => {
  it("leaves a value that fits exactly alone, with no ellipsis and no count", () => {
    const fits = truncatedView("李思 · 6d7e8f90", TRUNC_CELL);
    expect(fits.truncated).toBe(false);
    expect(fits.shown).toBe("李思 · 6d7e8f90");
    expect(fits.omitted).toBe(0);
    expect(fits.title).toBe("李思 · 6d7e8f90");
    const edge = truncatedView("x".repeat(TRUNC_CELL), TRUNC_CELL);
    expect(edge.truncated).toBe(false);
  });

  it("counts what it left out, from the real strings", () => {
    const path = "/tenants/t_seakoi_pilot/workstations/ws-0001/agents/employee-api/session/42";
    const view = truncatedView(path, TRUNC_CELL);
    expect(view.truncated).toBe(true);
    expect(view.shown.endsWith("…")).toBe(true);
    expect(view.shown).toBe(path.slice(0, TRUNC_CELL) + "…");
    expect(view.omitted).toBe(path.length - TRUNC_CELL);
    expect(view.title).toContain("完整值：");
    expect(view.title).toContain(path);
    expect(view.title).toContain(`已省略 ${path.length - TRUNC_CELL} 字符`);
  });

  it("uses the wider budget for a line and the narrow one for a cell", () => {
    const text = "策略不允许在这台环境上提权，需要管理员在审批单里确认后重试，否则本次操作会被系统直接中止。";
    const cell = truncatedView(text, TRUNC_CELL);
    const line = truncatedView(text, TRUNC_LINE);
    expect(cell.omitted).toBeGreaterThan(line.omitted);
    expect(line.shown.length).toBe(TRUNC_LINE + 1);
    expect(line.omitted).toBe(text.length - TRUNC_LINE);
  });

  it("keeps an empty value empty instead of inventing a dash", () => {
    expect(truncatedView("", TRUNC_CELL)).toEqual({ truncated: false, shown: "", omitted: 0, title: "" });
  });

  it("joins titles without dropping the one a field already had", () => {
    const path = "ap_112233445566778899001122334455667788";
    const view = truncatedView(path, TRUNC_CELL);
    const joined = joinTitles(view.title, "user:2f3a4b5c6d7e8f90");
    expect(joined).toContain("完整值：");
    expect(joined).toContain(path);
    expect(joined).toContain("user:2f3a4b5c6d7e8f90");
    expect(joinTitles(undefined, null, "  ")).toBeUndefined();
    expect(joinTitles("a", undefined)).toBe("a");
  });
});
