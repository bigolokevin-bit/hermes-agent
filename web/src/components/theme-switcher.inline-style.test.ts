// @vitest-environment node
/**
 * n14 (UX migration guide §6.2): ThemeSwitcher carried four inline style
 * literals. All four values are runtime data — the swatch stops come from each
 * theme's own palette (including user themes read from
 * `~/.hermes/dashboard-themes/*.yaml`) and the font preview comes from an
 * arbitrary CSS font-stack string in web/src/themes/fonts.ts — so they cannot be
 * enumerated into `-ls` token classes without breaking the preview, and a
 * dynamic class name would be invisible to Tailwind's scanner.
 *
 * The migration therefore moves them onto named helpers (the same house rule
 * this file already used for the dropUp geometry expression) and this contract
 * pins the result so the count cannot quietly grow back:
 *   - zero `style={{` literals in the file;
 *   - every remaining style site is either a named helper or the documented
 *     geometry expression — no unaccounted anonymous site;
 *   - the helper block carries no hex and no size literal, and still reads the
 *     original provenance chain;
 *   - the swatch and preview structure (classNames, aria, the wrapper) is
 *     unchanged and no stylesheet import was added.
 *
 * Pure source assertions: no browser, no served face, so this gate is green in
 * an undeployed worktree (unlike e1Contract.test.ts's disk==served leg).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(HERE, "ThemeSwitcher.tsx"), "utf8");

const count = (needle: string): number => src.split(needle).length - 1;
const hexes = (text: string): string[] => text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
const sizes = (text: string): string[] => text.match(/\d+(px|em|rem|pt|%)\b/g) ?? [];

const helperStart = src.indexOf("function swatchCells(");
const placeholderStart = src.indexOf("function PlaceholderSwatch()");
const helperBlock =
  helperStart >= 0 && placeholderStart > helperStart
    ? src.slice(helperStart, placeholderStart)
    : "";

describe("n14 ThemeSwitcher: no inline style literals, runtime values named", () => {
  it("ThemeSwitcher.tsx carries zero inline style literals", () => {
    expect(count("style={{")).toBe(0);
  });

  it("every remaining style site is a named helper or the documented geometry expression", () => {
    const allSites = count("style={");
    const literals = count("style={{");
    const namedHelpers = count("style={fontPreviewStyle(f)}") + count("style={swatchCellStyle(color)}");
    const geometry = count("dropUp && rect");
    expect(namedHelpers).toBe(2);
    expect(geometry).toBe(1);
    expect(literals).toBe(0);
    expect(allSites).toBe(namedHelpers + geometry);
  });

  it("the helper block holds runtime values only — no hex, no size literal", () => {
    expect(helperBlock.length).toBeGreaterThan(0);
    expect(hexes(helperBlock)).toEqual([]);
    expect(sizes(helperBlock)).toEqual([]);
    expect(helperBlock).toContain("theme.swatchColors ??");
    expect(helperBlock).toContain("theme.palette.background.hex");
    expect(helperBlock).toContain("theme.palette.midground.hex");
    expect(helperBlock).toContain("theme.palette.warmGlow");
    expect(helperBlock).toContain("return { fontFamily: f.stack };");
    expect(helperBlock).toContain("return { background: color };");
  });

  it("the swatch and font-preview structure is unchanged and no stylesheet was imported", () => {
    expect(src).toContain('className="flex h-4 w-9 shrink-0 overflow-hidden border border-current/20"');
    expect(src).toContain('className="truncate text-sm"');
    expect(count('className="flex-1"')).toBe(1);
    expect(src).toContain("cells.map((color, index) =>");
    expect(src).toContain("key={index}");
    expect(src).toContain("const cells = swatchCells(theme);");
    expect(count(".css\"")).toBe(0);
  });
});
