/**
 * AU-06 — 审计域 375/a11y/令牌化 源码契约闸（形制断言，纯源码扫描，DOM 恒等无涉）。
 *
 * 先例口径：
 *  - scrollbar-utility 棘轮：消费点只准类名，本域零裸滚动条声明（负断言）；
 *  - font-scale 丁条款同族：audit css 零字面量字号、走 var(--font-size-N)；
 *  - 『运行时值不可令牌化』：本域不新增调色板/字体 stack 字面量（零 hex 断言），
 *    内联 style 形制保持归零（页面级 grep 计数）。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./audit-375-a11y.css", import.meta.url)), "utf8");
const pages = ["AuditEventsModulePage.tsx", "AuditDetailModulePage.tsx", "AuditVerifyModulePage.tsx", "RetentionModulePage.tsx"]
  .map((f) => ({ name: f, src: readFileSync(fileURLToPath(new URL(`./${f}`, import.meta.url)), "utf8") }));

describe("AU-06 audit-375-a11y.css 令牌形制", () => {
  it("44 触点走 A 层令牌带 rubric 回落，且只在窄屏断点内", () => {
    expect(css).toContain("var(--touch-target-ls, 44px)");
    expect(css).toContain("@media (max-width: 767.98px)");
  });

  it("字号零字面量：只准 var(--font-size-N)（duty Q9 中和条款同形）", () => {
    const decls = css.split("\n").filter((l) => l.includes("font-size:"));
    expect(decls.length).toBeGreaterThanOrEqual(3);
    for (const line of decls) {
      expect(line).toMatch(/font-size:\s*var\(--font-size-\d+\)/);
    }
  });

  it("滚动条裸声明=0（定义点唯一在 index.css，本域只准类名消费）", () => {
    expect(css).not.toMatch(/::-webkit-scrollbar|scrollbar-width|scrollbar-color/);
  });

  it("零硬编码色（palette 字面量不入本域样式）", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });

  it("四页根锚=既有 data-page 属性选择器，无新增 DOM/类名（恒等护栏）", () => {
    for (const page of ["audit", "audit-detail", "audit-verify", "retention"]) {
      expect(css).toContain(`[data-page="${page}"]`);
    }
  });
});

describe("AU-06 审计页面内联形制", () => {
  it("四页 style={{ 字面量=0（内联样式负债不新增）", () => {
    for (const { name, src } of pages) {
      expect(src.match(/style={{/g) ?? [], name).toHaveLength(0);
    }
  });

  it("四页均引 audit-375-a11y.css（令牌接线在位）", () => {
    for (const { name, src } of pages) {
      expect(src, name).toContain('import "./audit-375-a11y.css";');
    }
  });

  it("原生 <select> 渲染点保持 0（全模块扫描）", () => {
    for (const { name, src } of pages) {
      expect(src.match(/<select/g) ?? [], name).toHaveLength(0);
    }
  });
});
