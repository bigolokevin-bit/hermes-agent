/**
 * 棘轮门：内联 style 只减不增（L0 令，A 写域）。双口径版。
 *
 * 纯源码层断言：只读仓库源码文本，不启服务、不读 `hermes_cli/web_dist/**`
 * ⇒ 未部署的 worktree 也必须绿（与 `token-source.test.ts` 同一形制）。
 *
 * 基线来源：脸 `451621e760` 现算，两个口径都给（L0 @1042@ 口径更正）
 *   全形制  grep -rn 'style={'   web/src --include='*.tsx' | grep -v '\.test\.tsx' | wc -l ⇒ 65 ← 钉这个
 *   字面量  grep -rn 'style={{'  ……同上                                                  ⇒ 61 ← 参考值
 *   差值 4 处＝台账盲区，全部是运行时值形制（`components/ThemeSwitcher.tsx`、
 *   `components/LanguageSwitcher.tsx`），见 EXEMPT_FILES；豁免≠已清偿。
 * 旧口径教训：`style={{` 漏掉换行 `style={` 与 `style={变量}` ⇒ 验收线不得低于真实负债。
 * 冻结线 2026-11-23T20:57+08:00 之后基线只允许下调；上调＝回潮，必须走 L0 并窗评审。
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** web/src 目录（本文件位于 web/src/components/ui/） */
const SRC = fileURLToPath(new URL("../../", import.meta.url));
/** 冻结基线（全形制）：脸 451621e760 现算 65，只允许下调 */
const BASELINE_FULL = 65;
/** 参考口径（字面量）：同一脸上现算 61，只输出不放宽 */
const BASELINE_LITERAL = 61;
/** 已被清空的外壳面，恒为 0 */
const ZERO_FILES = ["shell/console.tsx"];
/** 运行时值豁免面（形制已迁、内联仍在，不计入已清偿） */
const EXEMPT_FILES = ["components/ThemeSwitcher.tsx", "components/LanguageSwitcher.tsx"];
const ANY = /style=\{/;
const LITERAL = /style=\{\{/;

function pageSources(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) pageSources(full, acc);
    else if (entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")) acc.push(full);
  }
  return acc;
}

const files = pageSources(SRC);
const rel = (abs: string): string => abs.slice(SRC.length);
/** 逐行计数（与 L0 的 grep | wc -l 同形制：一行算一处） */
function linesMatching(abs: string, re: RegExp): number[] {
  const hits: number[] = [];
  readFileSync(abs, "utf8")
    .split("\n")
    .forEach((line, index) => {
      if (re.test(line)) hits.push(index + 1);
    });
  return hits;
}
const countOf = (abs: string, re: RegExp): number => linesMatching(abs, re).length;
const fullTotal = files.reduce((sum, f) => sum + countOf(f, ANY), 0);
const literalTotal = files.reduce((sum, f) => sum + countOf(f, LITERAL), 0);
/** 只在「全形制」里出现的站点＝台账盲区，必须落在豁免面上 */
const blindSpots = files
  .flatMap((f) => {
    const full = linesMatching(f, ANY);
    const lit = new Set(linesMatching(f, LITERAL));
    return full.filter((line) => !lit.has(line)).map((line) => `${rel(f)}:${line}`);
  })
  .sort();

describe("内联 style 棘轮（双口径，只减不增）", () => {
  it("扫描面非空——防止走文件树失效造成假绿", () => {
    // 实测：web/src 下非测试 .tsx 共 153 个（含测试 525 个）。
    expect(files.length).toBeGreaterThan(120);
  });

  it(`全形制口径不得超过冻结基线 ${BASELINE_FULL} 处（钉这个）`, () => {
    expect(
      fullTotal,
      `全形制现算 ${fullTotal} 处，基线 ${BASELINE_FULL} 处（脸 451621e760；字面量口径 ${literalTotal} 处）`,
    ).toBeLessThanOrEqual(BASELINE_FULL);
  });

  it(`字面量口径不得超过参考值 ${BASELINE_LITERAL} 处（同脸现算，只作参考）`, () => {
    expect(
      literalTotal,
      `字面量现算 ${literalTotal} 处，参考值 ${BASELINE_LITERAL} 处；两口径差 ${fullTotal - literalTotal} 处必须都能对上豁免面`,
    ).toBeLessThanOrEqual(BASELINE_LITERAL);
  });

  it("换行/变量形制的站点只能出现在登记过的运行时值豁免面上", () => {
    const offenders = blindSpots.filter((site) => !EXEMPT_FILES.some((f) => site.startsWith(`${f}:`)));
    expect(offenders, `未登记的换行/变量形制站点：${offenders.join(", ")}`).toEqual([]);
    // 防空转：豁免面上确实存在这类站点（当前实测 4 处），否则说明口径又写窄了。
    expect(blindSpots.length).toBeGreaterThan(0);
  });

  for (const f of ZERO_FILES) {
    it(`${f} 的内联 style 恒为 0（L4 已清，不得回潮）`, () => {
      expect(countOf(join(SRC, f), ANY), `${f} 又出现内联 style`).toBe(0);
    });
  }
});
