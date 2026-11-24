/**
 * 「能力与权限」矩阵的 375 / 密度契约（纯样式断言，不改产品码）。
 *
 * 表格比手机宽是有意的（每列都要读得清），但页面本身绝不横滚：
 * 横滚只发生在卡内 `.mtx5-scroll` 壳里，身份列 `.mtx5-pin` 粘在卡壳左缘。
 * 行高走 40px 令牌档（36–40 契约的上沿），数字等宽由 .mtx-mono 承担。
 *
 * 断言读的是「声明」而不是像素：换值可以，撤档不行。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./matrix.css", import.meta.url)), "utf8");

/** 每条规则都从行首开始，所以换行锚定选择器，`.mtx5-pin` 不会命中更长的选择器。 */
function declsOf(selector: string): string {
  const at = css.indexOf(`\n${selector} {`);
  expect(at, `matrix.css must keep the ${selector} rule`).toBeGreaterThan(-1);
  const open = css.indexOf("{", at);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

describe("matrix.css — 375 横滚与行高契约", () => {
  it("横向滚动留在卡壳里（页面不整页横滚）", () => {
    expect(declsOf(".mtx5-scroll")).toContain("overflow-x: auto");
  });

  it("身份列粘在卡壳左缘且是不透明底（滑动单元格不会透出）", () => {
    const pin = declsOf(".mtx5-pin");
    expect(pin).toContain("position: sticky");
    expect(pin).toContain("left: 0");
    expect(pin).toContain("background: var(--color-surface-ls)");
  });

  it("粘贴靠规则而不是写死宽度", () => {
    expect(css).not.toMatch(/\n\.mtx5-pin \{[^}]*width:/);
  });

  it("行高走 40px 令牌档（36–40 契约），不写裸像素", () => {
    const td = declsOf(".mtx-table td");
    expect(td).toContain("height: var(--table-row-h-ls)");
    expect(td).not.toMatch(/height:\s*\d+px/);
  });

  it("表格撑满卡宽但允许内容更宽（min-width:100% + max-content）", () => {
    const table = declsOf(".mtx-table");
    expect(table).toContain("width: max-content");
    expect(table).toContain("min-width: 100%");
  });

  it("数字列等宽：.mtx-mono 声明 tabular-nums", () => {
    expect(declsOf(".mtx-mono")).toContain("font-variant-numeric: var(--tabular-ls)");
  });
});