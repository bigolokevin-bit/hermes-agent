// @vitest-environment node
/**
 * n17 top bar contract: one h1, in the top bar, outside `main`, with no inline
 * styling and no minted token names.
 *
 * Why a source-level gate: clause 6 (`single-h1-in-topbar`) is decided by three
 * facts that a browser run can only observe after the fact — which file owns the
 * h1, whether the bar is composed outside the routed `<main>`, and whether the
 * bar smuggles in an inline style. The acceptance gate reads
 *   inTopbar  = closest("header,[data-testid*='topbar'],[data-testid*='-head']")
 *   inContent = closest("[data-testid*='grid'],main,.duty-grid")
 * so a second h1 anywhere inside `main` fails the clause, and the only way to keep
 * exactly one is for `shell/console.tsx` to stop emitting its module header. That
 * ownership rule is a source fact, and pinning it here makes the regression loud
 * (red in any worktree, deployed or not) instead of visible only on 9122.
 *
 * It also pins the two carry-over rules from n10/n14/n16: every class the bar
 * names must have a definition in a shell stylesheet, every token it references
 * must exist in the page contract layer, and this lane mints no custom property
 * (token freeze 2026-11-23T20:57+08:00 — the defining file `web/src/styles/tokens.css`
 * is not this lane's, and `components/ui/token-source.test.ts` clause 戊 would go red).
 *
 * Pure source reads: no browser, no deployed bundle, so it must pass in an
 * undeployed worktree. That is the opposite kind of leg from `e1Contract.test.ts:205`
 * (disk == served), whose red is a deployment fact and must never be read as a
 * regression of this change.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const TOPBAR = readFileSync(join(HERE, "TopBar.tsx"), "utf8");
const APP = readFileSync(join(HERE, "../App.tsx"), "utf8");
const CONSOLE = readFileSync(join(HERE, "console.tsx"), "utf8");
const CHROME = readFileSync(join(HERE, "console-chrome.css"), "utf8");
const NAV = readFileSync(join(HERE, "console-nav.css"), "utf8");
const TOKENS = readFileSync(join(HERE, "../styles/tokens.css"), "utf8");

/** Strip comments so an exclusion assertion never trips over its own prose. */
function bare(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function count(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

const topbarCode = bare(TOPBAR);
const appCode = bare(APP);
const consoleCode = bare(CONSOLE);

/**
 * A real custom-property DEFINITION is `--name:` with no whitespace before the
 * colon. Tailwind arbitrary values write `var(--font-size-ls-1)` and never match
 * this shape, so the same regex cannot be confused by a reference.
 */
const TOKEN_DEF = /--[\w-]+:(?![\w-])/g;

describe("n17 top bar: one h1 outside main, no inline style, no minted tokens", () => {
  it("the bar carries exactly one h1 and no inline style of any shape", () => {
    expect(count(topbarCode, "<h1")).toBe(1);
    expect(topbarCode).toContain('data-testid="shell-topbar-title"');
    expect(count(TOPBAR, "style={{")).toBe(0);
    expect(count(TOPBAR, "style={")).toBe(0);
    expect(count(TOPBAR, "style=")).toBe(0);
    expect(count(TOPBAR, "fontSize")).toBe(0);
    // The row height is the frozen geometry, written as a px utility class.
    expect(topbarCode).toContain("h-[56px]");
  });

  it("App.tsx mounts the slot outside the routed body and renders the bar", () => {
    expect(appCode).toContain('id={SHELL_TOPBAR_SLOT_ID}');
    expect(appCode).toContain("<ConsoleTopBar");
    expect(appCode).toContain('from "@/shell/TopBar"');
    expect(appCode).toContain("flex min-h-0 min-w-0 flex-1 flex-col");
  });

  it("console.tsx no longer owns a module header h1", () => {
    expect(count(consoleCode, "<h1")).toBe(0);
    expect(consoleCode).not.toContain("flex min-w-0 flex-col gap-1");
    expect(consoleCode).not.toContain("text-lg font-semibold");
  });

  it("every class the bar names is backed by a shell stylesheet", () => {
    expect(CHROME).toContain(".console-note");
    const named = topbarCode.match(/className="([^"]*)"/g) ?? [];
    const words = new Set<string>();
    for (const chunk of named) {
      const inner = chunk.slice('className="'.length, -1);
      for (const word of inner.split(/\s+/)) {
        if (word.startsWith("console-")) words.add(word);
      }
    }
    expect(words.size).toBeGreaterThan(0);
    const sheets = CHROME + "\n" + NAV;
    const missing = [...words].filter((w) => !sheets.includes(`.${w}`));
    expect(missing).toEqual([]);
  });

  it("the bar keeps the artifact-facing name console-topbar", () => {
    // 构建产物里要能 grep 到这个名字：组件类名、样式表规则、组件自带 CSS 导入，三者缺一即断链。
    expect(topbarCode).toContain('className="console-topbar ');
    expect(CHROME).toContain(".console-topbar");
    expect(topbarCode).toContain('"./console-chrome.css"');
  });

  it("the bar references only token names the contract layer defines", () => {
    const referenced = new Set(
      [
        ...(topbarCode.match(/--[\w-]+(?=\))/g) ?? []),
        ...(topbarCode.match(/var\(\s*(--[\w-]+)/g) ?? []).map((s) =>
          s.replace(/var\(\s*/, ""),
        ),
      ].map((s) => s.replace(/\)$/, "")),
    );
    expect(referenced.size).toBeGreaterThan(0);
    const defined = new Set(TOKENS.match(/--[\w-]+(?=\s*:)/g) ?? []);
    const dangling = [...referenced].filter((name) => !defined.has(name));
    expect(dangling).toEqual([]);
    expect(referenced.has("--font-size-ls-5")).toBe(true);
    expect(referenced.has("--font-size-ls-1")).toBe(true);
  });

  it("the bar mints no custom property and carries no hex literal", () => {
    expect((topbarCode.match(TOKEN_DEF) ?? []).length).toBe(0);
    expect((topbarCode.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length).toBe(0);
  });

  it("the collapse control exists once, in the bar, and nowhere else", () => {
    expect(count(topbarCode, 'data-testid="shell-sidebar-collapse"')).toBe(1);
    expect(count(appCode, 'data-testid="shell-sidebar-collapse"')).toBe(0);
  });

  it("a console route's h1 title comes from the shell module table, not a derived string", () => {
    expect(topbarCode).toContain("consoleSurface(pathname)");
    expect(topbarCode).toContain(
      "surface !== null ? surface.title : resolvePageTitle(pathname, t, [])",
    );
    // Regression guard: the resolver alone rendered a pathname-derived English
    // word on /overview, which is the defect this clause pins shut.
    expect(topbarCode).not.toMatch(/^\s*const title = resolvePageTitle/m);
    // 2026-11-26 面包屑改造：写死的「分组 · 控制台」被真实层级取代。
    // 这里钉住新契约的三件：可点层级（Link）、返回钮、以及详情分区名来源。
    expect(topbarCode).toContain("surface.trail.map");
    expect(topbarCode).toContain("<Link to={crumb.to}");
    expect(topbarCode).toContain('data-testid="shell-topbar-back"');
    expect(topbarCode).toContain("ZONE_TITLE[zone]");
  });
});
