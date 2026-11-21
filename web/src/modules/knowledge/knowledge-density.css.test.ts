/**
 * 知识模块列表「密度档」契约（UI-RUBRIC §字体阶梯 / §3 表格）。
 *
 * 立约缘由：wave-127 有一笔从暂存区代取的提交（91bffe62）把 density 改动整段回退成
 * 基线而无人察觉——本契约让同一种回退在 CI 直接变红。
 * 断言的是「档位」而非具体字节：换数值可以，掉档不行。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./knowledge.css", import.meta.url)), "utf8");

/** 取 anchor 所属规则块内的声明文本（anchor 之后的第一个 { 到下一个 } 为止）。 */
function declsOf(anchor: string): string {
  const at = css.indexOf(anchor);
  expect(at, `knowledge.css 必须保留 ${anchor}`).toBeGreaterThan(-1);
  const open = css.indexOf("{", at);
  const close = css.indexOf("}", open);
  expect(open, `${anchor} 之后找不到规则块起始`).toBeGreaterThan(at);
  expect(close, `规则块 ${anchor} 未闭合`).toBeGreaterThan(open);
  return css.slice(open + 1, close);
}

describe("knowledge density contract", () => {
  it("表格正文与表头落在字体阶梯档：正文 13px、表头 12px", () => {
    const table = declsOf(".knw5-table {");
    expect(table).toContain("var(--font-size-2)");
    expect(table).not.toContain("0.76rem");
    expect(declsOf(".knw5-table th {")).toContain("var(--font-size-1)");
  });

  it("列距与分隔线走令牌：padding-inline var(--space-3) + 1px --color-border-subtle", () => {
    const cell = declsOf(".knw5-table th,");
    expect(cell).toContain("padding: var(--space-2) var(--space-3)");
    expect(cell).toContain("1px solid var(--color-border-subtle)");
    expect(cell).not.toMatch(/9px 12px/);
  });

  it("次要字段收敛：纯值列降一档并取次要色，名称列保持主字段档", () => {
    const secondary = declsOf('[data-label="类型"]');
    expect(secondary).toContain("color: var(--color-text-muted)");
    expect(secondary).toContain("font-size: var(--font-size-1)");
    const primary = declsOf('[data-label="名称"]');
    expect(primary).toContain("font-size: var(--font-size-2)");
    expect(declsOf(".knw5-sub {")).toContain("var(--font-size-1)");
  });

  it("证据引用卡片流按 40px 行高契约，摘要 2 行截断（全文仍在 title 里）", () => {
    expect(declsOf(".knw5-ref {")).toContain("min-height: var(--table-row-h)");
    expect(declsOf(".knw5-ref-summary {")).toContain("-webkit-line-clamp: 2");
  });

  it("375 档标签轨用 minmax(0, …) 承重，不写死像素轨", () => {
    expect(css).not.toMatch(/grid-template-columns:\s*84px/);
    expect(css).toMatch(/grid-template-columns:\s*minmax\(0,\s*5\.25rem\)\s+minmax\(0,\s*1fr\)/);
  });
});
