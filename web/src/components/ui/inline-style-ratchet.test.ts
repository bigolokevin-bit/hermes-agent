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
/**
 * 冻结基线（全形制）：只允许下调。
 * 65（脸 451621e760）→ 26（脸 a835e9c408，mega 两支内联→`-ls`/具名 helper 迁移已并窗）。
 * 同次现算：非测试 .tsx 13 个文件命中，其中盲区（只在换行/变量形制里出现的站点）8 处。
 */
const BASELINE_FULL = 26;
/** 参考口径（字面量）：61（旧脸）→ 18（脸 a835e9c408 现算），只输出不放宽 */
const BASELINE_LITERAL = 18;
/** 已被清空的外壳面，恒为 0 */
const ZERO_FILES = ["shell/console.tsx"];
/**
 * 运行时值豁免面：逐条具名 = 文件 + 稳定标记（正则）+ 为什么不可令牌化。
 * 纪律：豁免登记＝承认为残余债务，**不是清偿**，每条 why 必须写明「内联仍在／不算清偿」
 * （下面有条断言机械地钉这句话）。登记用标记而非行号：行号会随别的车道的笔漂移，
 * 而「豁免项在源码里命不中」本身就该红（防失效豁免继续挂账）。
 * 出处口径：~/.config/opencode/AGENTS.md「车道迁移判据两坑」第 2 条 +
 * docs/governance/CONSOLE-ACCEPTANCE.md §5 第 18/19 条（正典归 L0）。
 */
type ExemptSite = { file: string; mark: RegExp; why: string };
const EXEMPT_SITES: readonly ExemptSite[] = [
  {
    file: "components/ThemeSwitcher.tsx",
    mark: /bottom: window\.innerHeight - rect\.top \+ 4/,
    why: "弹层定位取运行时测量值（窗口高度与按钮 rect），枚举成令牌即写死坐标；内联仍在，不算清偿",
  },
  {
    file: "components/ThemeSwitcher.tsx",
    mark: /style=\{fontPreviewStyle\(f\)\}/,
    why: "字体预览取任意 CSS 字体栈串；改动态类名会被 Tailwind 扫描器漏掉并 purge；内联仍在，不算清偿",
  },
  {
    file: "components/ThemeSwitcher.tsx",
    mark: /style=\{swatchCellStyle\(color\)\}/,
    why: "色块取每主题调色板（含用户 ~/.hermes/dashboard-themes/*.yaml），无法预枚举；内联仍在，不算清偿",
  },
  {
    file: "components/LanguageSwitcher.tsx",
    mark: /bottom: window\.innerHeight - rect\.top \+ 4/,
    why: "同 ThemeSwitcher 的弹层定位形制（值来自 getBoundingClientRect）；内联仍在，不算清偿",
  },
  {
    file: "pages/AnalyticsPage.tsx",
    mark: /Math\.max\(inputH/,
    why: "逐柱运行时像素高＝Math.max 归一 + CHART_HEIGHT_PX 与相邻比例计算耦合，数据驱动不可令牌化；现形制已收进具名 helper chartPxHeight()，但内联仍在，不算清偿（L0 裁决＝豁免登记，SVG 重写已否决：改版面）",
  },
  {
    // 168/181 两处常量柱高：mega 迁移把它们从 style={{ height: CHART_HEIGHT_PX }}
    // 改成 style={chartPxHeight(CHART_HEIGHT_PX)}＝形制迁移（DOM/计算值恒等），
    // 但内联声明仍在，按 §5 第 19 条不算清偿，必须留在豁免面上。
    file: "pages/AnalyticsPage.tsx",
    mark: /chartPxHeight\(CHART_HEIGHT_PX\)/,
    why: "常量柱高走具名 helper（值仍是 CHART_HEIGHT_PX=160），属形制迁移；内联仍在，不算清偿（真要清偿应改 h-[160px] 类名并配测）",
  },
  {
    file: "pages/AnalyticsPage.tsx",
    mark: /Math\.max\(outputH/,
    why: "同上（输出柱，同一数据驱动函数）；内联仍在，不算清偿",
  },
];
/** 豁免面上限：只准减不准增（涨了就红，先清偿再登记） */
const EXEMPT_MAX = 7;
const EXEMPT_FILES = [...new Set(EXEMPT_SITES.map((site) => site.file))];
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
    // 防空转：豁免面上确实存在这类站点（脸 a835e9c408 现算 8 处），否则说明口径又写窄了。
    expect(blindSpots.length).toBeGreaterThan(0);
    // 硬兜底：按「登记标记在源码里的实际命中次数」算覆盖量（一条登记可盖同形制的多处站点，
    // 如 chartPxHeight(CHART_HEIGHT_PX) 有两处）；盲区比覆盖量多＝有未登记的新内联形制混进来。
    const covered = EXEMPT_SITES.reduce((total, site) => {
      const txt = readFileSync(join(SRC, site.file), "utf8");
      const each = txt.match(new RegExp(site.mark.source, "g")) ?? [];
      return total + each.length;
    }, 0);
    expect(
      blindSpots.length,
      `盲区 ${blindSpots.length} 处 > 豁免标记实际覆盖 ${covered} 处：${blindSpots.join(", ")}`,
    ).toBeLessThanOrEqual(covered);
  });

  it("豁免面逐条必须命中、总数只准减不准增、每条必须自认未清偿", () => {
    expect(
      EXEMPT_SITES.length,
      `豁免面从上限 ${EXEMPT_MAX} 涨到 ${EXEMPT_SITES.length}：新增运行时内联要先真清偿，不许直接登记`,
    ).toBeLessThanOrEqual(EXEMPT_MAX);
    for (const site of EXEMPT_SITES) {
      const txt = readFileSync(join(SRC, site.file), "utf8");
      expect(
        site.mark.test(txt),
        `豁免登记已落空（源码里找不到这条运行时站点，请把它从豁免面删掉）：${site.file} ${site.mark}`,
      ).toBe(true);
      expect(site.why, `豁免项必须明写残余状态：${site.file}`).toContain("不算清偿");
    }
    // AnalyticsPage 的数据驱动柱高必须恰好这两根；多出第三根说明有新债务未登记。
    // 计数用 Math.max(inputH|outputH，两种形制（height: / chartPxHeight(）都算一处。
    const page = readFileSync(join(SRC, "pages/AnalyticsPage.tsx"), "utf8");
    const bars = page.match(/Math\.max\((inputH|outputH)/g) ?? [];
    expect(bars.length, "AnalyticsPage 运行时柱高站点数变了，请同步豁免面").toBe(2);
    const consts = page.match(/chartPxHeight\(CHART_HEIGHT_PX\)/g) ?? [];
    expect(consts.length, "AnalyticsPage 常量柱高站点数变了，请同步豁免面").toBe(2);
  });

  for (const f of ZERO_FILES) {
    it(`${f} 的内联 style 恒为 0（L4 已清，不得回潮）`, () => {
      expect(countOf(join(SRC, f), ANY), `${f} 又出现内联 style`).toBe(0);
    });
  }
});
