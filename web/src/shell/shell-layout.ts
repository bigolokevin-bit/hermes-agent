/**
 * Shell layout contract — the single source for the sidebar collapse state
 * and the four chrome dimensions the UI foundation contract pins.
 *
 * Why this file exists (UI-SHELL lane, P0 令 2026-11-23):
 *
 *  - `scripts/assert-ui-contract.mjs` (clause 8 `sidebar-collapse-reflows`)
 *    reads `localStorage.getItem("hermes.sidebar.collapsed")`, while
 *    `App.tsx` had been writing `"hermes-sidebar-collapsed"` since before
 *    this lane started. Two names for one fact: the gate could never see the
 *    collapse state the app was faithfully persisting, so clause 8 stayed red
 *    on a key-name mismatch rather than on a product defect. The name the
 *    acceptance gate reads is the canonical one; the old key is still written
 *    on every toggle so a rollback to a pre-this-change build keeps the user's
 *    collapse state, and reads fall back to it. Double-writing is a migration
 *    path, not a second truth table — `SIDEBAR_COLLAPSED_KEY` is the only
 *    place the canonical literal appears.
 *
 *  - The dimensions come from the frozen token contract (`web/src/styles/
 *    tokens.css`, skeleton block: `--side:208px`, `--bar:27px`) and from
 *    `docs/product/design/UI-DIRECTION-20261123-v2.md` §3 (topbar base row
 *    56px, collapsed rail 56px, main column grows 152±1px, status bar 28px,
 *    narrow drawer min(288px, 100vw - 48px)). Nothing here defines a new
 *    token name: the token freeze line is 2026-11-23T20:57+08:00 and any
 *    addition or rename goes through L0, and the defining file is outside
 *    this lane's write domain. These constants are JS-side mirrors used for
 *    arithmetic and for the contract test, so a drift between them and the
 *    stylesheet is a red test, not a silent disagreement.
 *
 * Write domain: web/src/shell/** (UI-SHELL lane). Consumers outside it are
 * limited to App.tsx's layout grid / topbar / status bar range, which the P0
 * order unfroze for this lane only.
 */

/** Canonical persistence key — the name the acceptance gate reads. */
export const SIDEBAR_COLLAPSED_KEY = "hermes.sidebar.collapsed";

/** Pre-2026-11-23 key, still written for rollback compatibility. */
export const LEGACY_SIDEBAR_COLLAPSED_KEY = "hermes-sidebar-collapsed";

/** Frozen skeleton sidebar width (`--side`), desktop expanded. */
export const SIDEBAR_WIDTH_EXPANDED_PX = 208;

/** Collapsed rail width; also the topbar base row height. */
export const SIDEBAR_WIDTH_COLLAPSED_PX = 56;

/** Main column growth when the rail collapses: 208 - 56 = 152 (contract 152±1). */
export const MAIN_COLUMN_GROWTH_PX =
  SIDEBAR_WIDTH_EXPANDED_PX - SIDEBAR_WIDTH_COLLAPSED_PX;

/** Topbar base row (v2 §3: 折叠按钮 32 + 面包屑 12 + h1 20 stacked in 56). */
export const TOPBAR_ROW_PX = 56;

/** Status bar height (v2 §3: 28px, normal flow placeholder, not fixed). */
export const STATUSBAR_PX = 28;

/** Desktop breakpoint: below this the rail becomes an overlay drawer. */
export const DESKTOP_BREAKPOINT_PX = 1024;

/** Narrow-screen drawer width, as a CSS value (v2 §3). */
export const NARROW_DRAWER_WIDTH_CSS = "min(288px, 100vw - 48px)";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Private browsing / blocked storage: layout state is optional.
    return null;
  }
}

/**
 * Read the collapse state. Canonical key wins; the legacy key is the fallback
 * so a user on a build from before this file existed keeps their rail state.
 */
export function readSidebarCollapsed(): boolean {
  const s = storage();
  if (s === null) return false;
  try {
    const canonical = s.getItem(SIDEBAR_COLLAPSED_KEY);
    if (canonical !== null) return canonical === "true";
    return s.getItem(LEGACY_SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Write the collapse state to both keys. The legacy write is deliberately
 * last-but-not-least: it is guarded separately so a storage quota error on
 * the second key can never leave the canonical key unwritten.
 */
export function writeSidebarCollapsed(next: boolean): void {
  const s = storage();
  if (s === null) return;
  const value = String(next);
  try {
    s.setItem(SIDEBAR_COLLAPSED_KEY, value);
  } catch {
    /* localStorage may be unavailable in private browsing */
  }
  try {
    s.setItem(LEGACY_SIDEBAR_COLLAPSED_KEY, value);
  } catch {
    /* same */
  }
}
