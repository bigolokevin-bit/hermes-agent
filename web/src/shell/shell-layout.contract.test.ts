// @vitest-environment node
/**
 * n16 shell-layout contract: the sidebar collapse state has ONE persisted name,
 * and that name is the one the acceptance gate reads.
 *
 * Why a source-level gate instead of a browser test: the defect this pins is a
 * cross-file naming drift. `App.tsx` wrote `hermes-sidebar-collapsed` while
 * `scripts/assert-ui-contract.mjs` clause 8 reads `hermes.sidebar.collapsed`, so
 * the persisted-state half of clause 8 could never go green no matter what the UI
 * actually did. A runtime assertion cannot catch a typo in a storage key; the
 * equality of two literals can, and it stays cheap.
 *
 * It also pins three things that were free-floating before: the collapse control's
 * discoverability hook (must not depend on a locale, since the gate matches
 * `[aria-label*="折叠"]` only in Chinese; as of n17 that control lives in
 * `shell/TopBar.tsx`, not the sidebar header), the geometry constants against the
 * frozen skeleton token `--side`, and the rule that this lane mints no new token
 * name (token freeze 2026-11-23T20:57+08:00; the defining file
 * `web/src/styles/tokens.css` is not in this lane's write scope).
 *
 * Pure source reads: no browser, no deployed bundle, so it must pass in an
 * undeployed worktree. That is the opposite kind of leg from
 * `e1Contract.test.ts:205` (disk == served), whose red is a deployment fact.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  DESKTOP_BREAKPOINT_PX,
  LEGACY_SIDEBAR_COLLAPSED_KEY,
  MAIN_COLUMN_GROWTH_PX,
  NARROW_DRAWER_WIDTH_CSS,
  SIDEBAR_COLLAPSED_KEY,
  SIDEBAR_WIDTH_COLLAPSED_PX,
  SIDEBAR_WIDTH_EXPANDED_PX,
  STATUSBAR_PX,
  TOPBAR_ROW_PX,
} from "./shell-layout";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(HERE, "../App.tsx"), "utf8");
const TOPBAR = readFileSync(join(HERE, "TopBar.tsx"), "utf8");
const GATE = readFileSync(join(HERE, "../../../scripts/assert-ui-contract.mjs"), "utf8");
const TOKENS = readFileSync(join(HERE, "../styles/tokens.css"), "utf8");
const SELF = readFileSync(join(HERE, "shell-layout.ts"), "utf8");

/** Strip comments so an exclusion assertion never trips over its own prose. */
function bare(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("n16 shell-layout: one persisted name, gate-readable, no minted tokens", () => {
  const selfCode = bare(SELF);
  const appCode = bare(APP);

  it("the canonical collapse key is the literal the acceptance gate reads", () => {
    expect(SIDEBAR_COLLAPSED_KEY).toBe("hermes.sidebar.collapsed");
    expect(GATE).toContain(`"${SIDEBAR_COLLAPSED_KEY}"`);
  });

  it("the legacy key is a distinct named constant and both are written on purpose", () => {
    expect(LEGACY_SIDEBAR_COLLAPSED_KEY).toBe("hermes-sidebar-collapsed");
    expect(LEGACY_SIDEBAR_COLLAPSED_KEY).not.toBe(SIDEBAR_COLLAPSED_KEY);
    expect(selfCode).toContain(SIDEBAR_COLLAPSED_KEY);
    expect(selfCode).toContain(LEGACY_SIDEBAR_COLLAPSED_KEY);
    // The module funnels access through one storage() helper, so pin the calls by
    // which key they touch rather than by a literal `localStorage.` receiver — the
    // contract is «canonical is read and written, legacy is read as fallback and
    // written as the migration shim», and dropping either half must go red here.
    expect(selfCode).toMatch(/setItem\(\s*SIDEBAR_COLLAPSED_KEY/);
    expect(selfCode).toMatch(/setItem\(\s*LEGACY_SIDEBAR_COLLAPSED_KEY/);
    expect(selfCode).toMatch(/getItem\(\s*SIDEBAR_COLLAPSED_KEY/);
    expect(selfCode).toMatch(/getItem\(\s*LEGACY_SIDEBAR_COLLAPSED_KEY/);
  });

  it("App.tsx holds no sidebar storage key and goes through the two helpers", () => {
    expect(appCode).not.toContain("SIDEBAR_COLLAPSED_KEY");
    expect(appCode).not.toMatch(/localStorage\.\w+\(\s*"hermes[-.]sidebar/);
    expect(appCode).toContain("useState(() => readSidebarCollapsed())");
    expect(appCode).toContain("writeSidebarCollapsed(next)");
  });

  // n17 behaviour change, declared: the collapse control left the sidebar header
  // for the new top bar, so this pin reads TopBar.tsx now. The count stays at one
  // across BOTH files — a duplicated testid would make the gate's click target
  // ambiguous, and a missing one would send clause 8 back to null delta.
  it("the collapse control is discoverable without depending on a locale", () => {
    expect(TOPBAR).toContain('data-testid="shell-sidebar-collapse"');
    expect(TOPBAR).toContain("t.common.expand");
    expect(TOPBAR).toContain("t.common.collapse");
    const sites =
      (TOPBAR.match(/data-testid="shell-sidebar-collapse"/g) ?? []).length +
      (bare(APP).match(/data-testid="shell-sidebar-collapse"/g) ?? []).length;
    expect(sites).toBe(1);
  });

  it("geometry constants mirror the frozen skeleton token and the v2 section 3 arithmetic", () => {
    expect(SIDEBAR_WIDTH_EXPANDED_PX).toBe(208);
    expect(SIDEBAR_WIDTH_COLLAPSED_PX).toBe(56);
    expect(MAIN_COLUMN_GROWTH_PX).toBe(
      SIDEBAR_WIDTH_EXPANDED_PX - SIDEBAR_WIDTH_COLLAPSED_PX,
    );
    expect(MAIN_COLUMN_GROWTH_PX).toBeGreaterThanOrEqual(151);
    expect(MAIN_COLUMN_GROWTH_PX).toBeLessThanOrEqual(153);
    expect(TOPBAR_ROW_PX).toBe(56);
    expect(STATUSBAR_PX).toBe(28);
    expect(DESKTOP_BREAKPOINT_PX).toBe(1024);
    expect(NARROW_DRAWER_WIDTH_CSS).toBe("min(288px, 100vw - 48px)");
    expect(TOKENS).toMatch(/--side:\s*208px/);
  });

  it("this module mints no CSS custom property of its own", () => {
    expect((selfCode.match(/--[a-zA-Z0-9-]+\s*:/g) ?? []).length).toBe(0);
  });
});
