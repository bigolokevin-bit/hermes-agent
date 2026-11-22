/**
 * R272 (READY-BACKLOG: 能力矩阵 375 版式 — 列头冻结 + 横向滚动容器，不用整页横滚).
 *
 * The pin is a contract, not a style preference: the grid is deliberately wider
 * than a phone, so if the identity column stops sticking, a reader at 375 scrolls
 * sideways and loses track of whose row every cell belongs to. And if the scroll
 * ever moves from the shell onto the page, the whole console starts sliding.
 *
 * The assertions read declarations rather than pixels: changing a value is fine,
 * dropping a tier is not.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./matrix.css", import.meta.url)), "utf8");

/** Every rule in this file starts at column 0, so the newline anchors the selector
 * and `.mtx5-pin` never matches inside `.mtx5-head .mtx5-pin`. */
function declsOf(selector: string): string {
  const at = css.indexOf(`\n${selector} {`);
  expect(at, `matrix.css must keep the ${selector} rule`).toBeGreaterThan(-1);
  const open = css.indexOf("{", at);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

function zIndexOf(selector: string): number {
  const raw = declsOf(selector).match(/z-index:\s*(\d+)/)?.[1];
  expect(raw, `${selector} must declare a z-index`).toBeDefined();
  return Number(raw);
}

describe("matrix.css — R272 375 layout contract", () => {
  it("keeps the sideways scroll inside the shell", () => {
    expect(declsOf(".mtx5-scroll")).toContain("overflow-x: auto");
  });

  it("pins the identity track to the shell's left edge", () => {
    const pin = declsOf(".mtx5-pin");
    expect(pin).toContain("position: sticky");
    expect(pin).toContain("left: 0");
    // opaque, otherwise sliding cells show straight through the pinned column
    expect(pin).toContain("background: var(--color-card)");
  });

  it("stacks the two sticky axes so the crossing cell wins", () => {
    expect(zIndexOf(".mtx5-head .mtx5-pin")).toBeGreaterThan(zIndexOf(".mtx5-pin"));
  });

  it("pins by rule instead of by a fixed width", () => {
    // a hardcoded width breaks the moment a name is longer than the guess
    expect(css).not.toMatch(/\n\.mtx5-pin \{[^}]*width:/);
  });
});
