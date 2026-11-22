/**
 * 棘轮门：内联 `style={{` 只减不增（L0 令，A 写域）。
 *
 * 纯源码层断言：只读仓库源码文本，不启服务、不读 `hermes_cli/web_dist/**`
 * ⇒ 未部署的 worktree 也必须绿（与 `token-source.test.ts` 同一形制）。
 *
 * 基线来源：脸 `1f078a8aed` 现算
 *   `grep -rn 'style={{' web/src --include='*.tsx' | grep -v '\.test\.tsx'` ⇒ 65 处
 *   （旧值 84 里的 19 处是 `web/src/shell/console.tsx`，已由 L4 清空）。
 * 冻结线 2026-11-23T20:57+08:00 之后此数只允许下调；上调＝回潮，必须走 L0 并窗评审。
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** web/src 目录（本文件位于 web/src/components/ui/） */
const SRC = fileURLToPath(new URL("../../", import.meta.url));
/** 冻结基线：见文件头，只允许下调 */
const BASELINE = 65;
/** 已被清空的外壳面，恒为 0 */
const ZERO_FILES = ["shell/console.tsx"];
const INLINE = /style=\{\{/;

function pageSources(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) pageSources(full, acc);
    else if (entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")) acc.push(full);
  }
  return acc;
}

const files = pageSources(SRC);
const countOf = (abs: string): number =>
  readFileSync(abs, "utf8").split("\n").filter((line) => INLINE.test(line)).length;
const total = files.reduce((sum, f) => sum + countOf(f), 0);

describe("内联 style 棘轮（只减不增）", () => {
  it("扫描面非空——防止走文件树失效造成假绿", () => {
    // 实测：web/src 下非测试 .tsx 共 153 个（含测试 525 个）。
    expect(files.length).toBeGreaterThan(120);
  });

  it(`生产代码内联 style 不得超过冻结基线 ${BASELINE} 处`, () => {
    expect(total, `现算 ${total} 处，基线 ${BASELINE} 处（脸 1f078a8aed）`).toBeLessThanOrEqual(BASELINE);
  });

  for (const f of ZERO_FILES) {
    it(`${f} 的内联 style 恒为 0（L4 已清，不得回潮）`, () => {
      expect(countOf(join(SRC, f)), `${f} 又出现内联 style`).toBe(0);
    });
  }
});
