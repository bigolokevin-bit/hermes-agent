/**
 * n10 (UI-KD rubric, wave-161): the shell chrome carries no inline styles and
 * every chrome class it names is actually defined, by a stylesheet the file
 * actually imports, whose values resolve inside the token contract.
 *
 * Pure source assertions — no browser and no deployment face, so this stays
 * runnable in an undeployed worktree (unlike e1Contract's disk==served leg).
 * It is the machine gate for the 19→0 inline-style migration: a reintroduced
 * `style={{}}`, a renamed class without its CSS, or an orphaned stylesheet all
 * go red here rather than in a screenshot.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const TSX = readFileSync(resolve(HERE, "console.tsx"), "utf8");
const CHROME = readFileSync(resolve(HERE, "console-chrome.css"), "utf8");
const NAV = readFileSync(resolve(HERE, "console-nav.css"), "utf8");
const TOKENS = readFileSync(resolve(HERE, "../styles/tokens.css"), "utf8");

/** Strip comments so prose like `../styles/tokens.css` is not read as a class. */
function bare(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*$/gm, "");
}

function classNames(css: string): Set<string> {
  return new Set([...bare(css).matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1]));
}

/** Every className literal in the shell file, split into its tokens. */
function usedClasses(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/className="([^"]*)"/g)) {
    out.push(...m[1].split(/\s+/).filter(Boolean));
  }
  return out;
}

const CHROME_CLASSES = [
  "console-state-frame",
  "console-state-error",
  "console-note",
  "console-rid",
  "console-tablist",
  "console-tab",
  "is-not-allowed",
  "is-link",
] as const;

describe("n10 shell chrome: zero inline styles, all classes backed", () => {
  it("console.tsx carries no inline style and no leftover shellStyle", () => {
    expect(TSX.match(/style=\{\{/g)?.length ?? 0).toBe(0);
    expect(TSX.match(/style=\{/g)?.length ?? 0).toBe(0);
    expect(TSX.match(/\bshellStyle\b/g)?.length ?? 0).toBe(0);
    expect(TSX.match(/^\s*style:/gm)?.length ?? 0).toBe(0);
  });

  it("every chrome class the shell names is defined in console-chrome.css", () => {
    const defined = classNames(CHROME);
    for (const name of CHROME_CLASSES) {
      expect(defined.has(name), `${name} is used by the shell but not defined`).toBe(true);
      expect(TSX, `${name} is defined but no longer applied`).toContain(name);
    }
  });

  it("no console-* class is applied without a definition in either shell sheet", () => {
    const defined = new Set([...classNames(CHROME), ...classNames(NAV)]);
    const stray = [
      ...new Set(usedClasses(TSX).filter((c) => c.startsWith("console-"))),
    ].filter((c) => !defined.has(c));
    expect(stray, `classes with no stylesheet behind them: ${stray.join(", ")}`).toEqual([]);
  });

  it("console-chrome.css is imported by console.tsx, so the classes are not orphaned", () => {
    expect(TSX).toContain('"./console-chrome.css"');
  });

  it("every var() in console-chrome.css resolves in the token contract", () => {
    const declared = new Set(
      [...bare(TOKENS).matchAll(/(^|\n)\s*(--[\w-]+)\s*:/g)].map((m) => m[2]),
    );
    const used = [...new Set([...bare(CHROME).matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]))];
    expect(used.length).toBeGreaterThan(0);
    const unresolved = used.filter((n) => !declared.has(n));
    expect(unresolved, `tokens with no definition: ${unresolved.join(", ")}`).toEqual([]);
  });

  it("console-chrome.css holds no hex and no size literal — tokens only", () => {
    const body = bare(CHROME);
    expect(body.match(/#[0-9a-fA-F]{3,8}\b/g)?.length ?? 0).toBe(0);
    expect(body.match(/\b\d+(?:\.\d+)?(?:px|em|rem|pt|%)\b/g)?.length ?? 0).toBe(0);
  });
});
