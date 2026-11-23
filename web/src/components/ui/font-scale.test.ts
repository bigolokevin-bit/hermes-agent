// 字阶棘轮门（参谋条款①「字号集合⊆6 档」的可复跑执行体）
// 纯源码层：不启服务、不读 hermes_cli/web_dist/**、不用 process.argv ⇒ 未部署 worktree 也必须绿。
//
// 为什么需要它：现查 web/src/**/*.css 的 font-size 声明共 383 处，其中 323 处不是令牌写法
// （手填 px 或按 16px 基准手算的 rem），离阶值（不等于 12/13/14/16/20/24）185 处，
// 最重 11px×60 与 0.6875rem(=11px)×35。令牌层六档早就齐了，缺的只是逐处替换与拦住回潮的门。
// 门分三条：甲＝基元层零字面量（今天就能硬钉）；乙＝全仓字面量与离阶值只准减不准增；
// 丙＝扫描面非空（防空扫描假绿）。
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("../../", import.meta.url)); // web/src

/** 只准引用这两族令牌名，别的写法一律算字面量。 */
const TOKEN_OK = /var\(\s*--font-size-(?:ls-)?[1-6]\s*\)/;
const DECL = /(?:^|[;{\s])(?:font-size)\s*:\s*([^;}\n]+)/g;
const LADDER = new Set([12, 13, 14, 16, 20, 24]);

type Hit = { file: string; line: number; value: string; offLadder: boolean };

function cssFiles(dir: string, base = ""): string[] {
  const out: string[] = [];
  for (const e of readdirSync(SRC + dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...cssFiles(`${dir}/${e.name}`, rel));
    else if (/\.(css|scss)$/.test(e.name)) out.push(rel);
  }
  return out;
}

/** px 数值：字面 px 直接取数；rem 按 16px 基准折算；其它（%, calc, var）算非令牌写法。 */
function pxOf(value: string): number | null {
  const px = /^\s*(\d+(?:\.\d+)?)px/.exec(value);
  if (px) return Number(px[1]);
  const rem = /^\s*(\d+(?:\.\d+)?)rem/.exec(value);
  if (rem) return Number(rem[1]) * 16;
  return null;
}

function scan(): { hits: Hit[]; files: number; declarations: number } {
  const hits: Hit[] = [];
  let declarations = 0;
  for (const file of cssFiles("")) {
    const text = readFileSync(SRC + file, "utf8");
    text.split("\n").forEach((line, i) => {
      DECL.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = DECL.exec(line))) {
        declarations += 1;
        const value = m[1].trim();
        if (TOKEN_OK.test(value) || value === "inherit") continue;
        const px = pxOf(value);
        const offLadder = px === null ? true : !LADDER.has(Math.round(px * 100) / 100);
        hits.push({ file, line: i + 1, value, offLadder });
      }
    });
  }
  return { hits, files: cssFiles("").length, declarations };
}

/** 全仓字面量站点冻结基线（批1 knowledge.css 收敛后 2026-11-23 现查 323→292）；迁移后必须继续下调。 */
const BASELINE_LITERAL = 292;
/** 离阶（不等于六档）字面量站点冻结基线（批1 后 185→160，余 160 处含 1 处 0.7em 相对值）。 */
const BASELINE_OFF_LADDER = 160;
/** 基元层与令牌层允许的字面量站点数——恒为 0，不参与棘轮。 */
const MY_SCOPE = /^(styles|components\/ui)\//;

describe("字阶棘轮门（字号集合 ⊆ 6 档令牌）", () => {
  const { hits, files, declarations } = scan();

  it("甲：基元层与令牌层零字面量字号，只准 var(--font-size-ls-*)", () => {
    const mine = hits.filter((h) => MY_SCOPE.test(h.file));
    expect(
      mine.map((h) => `${h.file}:${h.line} ${h.value}`),
      "web/src/styles/** 与 web/src/components/ui/** 里不得出现字面 px/rem 字号",
    ).toEqual([]);
  });

  it("乙：全仓字面量与离阶站点只准减不准增", () => {
    expect(hits.length, `全仓非令牌字号站点现算 ${hits.length}，基线 ${BASELINE_LITERAL}`).toBeLessThanOrEqual(
      BASELINE_LITERAL,
    );
    const off = hits.filter((h) => h.offLadder);
    expect(off.length, `离阶（非 12/13/14/16/20/24）站点现算 ${off.length}，基线 ${BASELINE_OFF_LADDER}`).toBeLessThanOrEqual(
      BASELINE_OFF_LADDER,
    );
  });

  it("丙：扫描面非空（空扫描不得当达标证据）", () => {
    expect(files, "web/src 下 CSS 文件数").toBeGreaterThan(20);
    expect(declarations, "font-size 声明总数").toBeGreaterThan(300);
  });

  it("丁：离阶归属逐文件可核对（台账口径，不静默吞数）", () => {
    const byFile = new Map<string, number>();
    for (const h of hits) byFile.set(h.file, (byFile.get(h.file) ?? 0) + 1);
    const top = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    // 这四个文件是收敛主力，若归属突然变化说明有人绕过台账动手，先红再对。
    expect(top.map(([f]) => f).sort()).toEqual(
      [
        "modules/capabilities/counts.css",
        "modules/duty/duty.css",
        "modules/health/health.css",
        "modules/metrics/metrics.css",
      ].sort(),
    );
  });
});
