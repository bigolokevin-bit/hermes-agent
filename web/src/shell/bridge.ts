/**
 * Console shell bridge — pure resolution + effect hooks (stage 2, lane A).
 *
 * Lives beside console.tsx (which exports ONLY components for Fast Refresh)
 * and holds everything non-visual:
 *
 *  - `useConsoleHashBridge` / `resolveHashTarget` — PRD `#/…` address forms
 *    (appendix A + the 23 redirect-only A.2 forms) resolve through the frozen
 *    route table to canonical browser locations. Redirect-only forms NEVER
 *    enter navigation (data stays out of the sidebar); conflict arbitration
 *    per stage-2 brief 1: existing App paths keep authority for compat-module
 *    rows ('#/sessions' → upstream /sessions page, '#/metrics' → upstream
 *    /analytics page); unknown forms fall back to /overview (PRD §7 — this
 *    fallback did not exist before stage 2).
 *  - `forcedState` — the shell-wide `?state=loading|empty|error|denied`
 *    forcing from §8.1-3 (M0 预埋; the pane visuals live in console.tsx).
 *  - module-page existence probe (`DetailModulePage` / `RunsModulePage`) —
 *    stage-2 brief 5: when lanes B/C ship `modules/<x>/<Name>ModulePage.tsx`
 *    the lazy glob picks it up on the next build; until then App keeps
 *    serving the existing upstream pages. Nothing outside the candidate list
 *    is ever loaded (the glob is lazy).
 */

import { lazy, useEffect, type ComponentType, type LazyExoticComponent } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  DETAIL_TAB,
  ZONE_ALIAS,
  findRoute,
  parseHash,
  pathFor,
} from "./routes";

/* ------------------------------------------------------------------ *
 * Forced four-state (?state=…, PRD §8.1-3): the pane visuals live in
 * console.tsx and read the shared fixture primitive (shell/fixtures.ts,
 * T03-CONTRACT); the bridge itself only carries `state` through as an
 * ordinary preserved param (see useConsoleHashBridge).
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Query serialization shared by bridge + tab strips
 * ------------------------------------------------------------------ */

export function searchFor(
  tab: string,
  view: string,
  zone: string,
  params: Record<string, string>,
): string {
  const sp = new URLSearchParams();
  if (tab !== "") sp.set("tab", tab);
  if (view !== "") sp.set("view", view);
  if (zone !== "") sp.set("zone", zone);
  for (const [key, value] of Object.entries(params)) sp.set(key, value);
  const qs = sp.toString();
  return qs === "" ? "" : `?${qs}`;
}

/* ------------------------------------------------------------------ *
 * Hash bridge — PRD `#/…` forms → canonical browser location
 * ------------------------------------------------------------------ */

/**
 * Pure resolution of one `#/…` address form to the browser location that
 * serves it. Exported so a test can pin the conflict arbitration without a
 * Router. Unknown forms fall back to /overview; never a dead link.
 */
export function resolveHashTarget(
  rawHash: string,
  authoritative: ReadonlySet<string>,
): { pathname: string; search: string } {
  const match = findRoute(rawHash);
  const parsed = parseHash(rawHash);

  // Unknown form — PRD §7: fall back to overview.
  if (match === null) return { pathname: "/overview", search: "" };

  const { entry, params } = match;

  // Conflict arbitration (brief 1): module-level compat rows whose path is
  // an EXISTING App route keep that authority.
  if (entry.kind === "compat-module" && entry.conflict !== undefined) {
    if (authoritative.has(entry.path)) {
      // '#/sessions' → the existing upstream /sessions page (no redirect).
      return { pathname: entry.path, search: searchFor("", "", "", parsed.params) };
    }
    if (entry.path === "/metrics") {
      // '#/metrics' → '/analytics': the existing AnalyticsPage IS the usage
      // surface the compat row points at; serve the existing page directly.
      return { pathname: "/analytics", search: searchFor("", "", "", parsed.params) };
    }
  }

  // Tab/module-level compat rows normalize onto their canonical `to` form.
  if (
    (entry.kind === "compat-tab" || entry.kind === "compat-module") &&
    entry.to !== undefined
  ) {
    const target = parseHash(entry.to);
    return {
      pathname: pathFor(target),
      search: searchFor(target.tab, target.view, target.zone, {
        ...target.params,
        ...parsed.params,
      }),
    };
  }

  // Detail zone rows: segment rows (24-27) already name the zone in the
  // path; row 23 keeps an explicit/aliased ?zone= spelling (so
  // overview/chat land on the workbench) while bare forms stay bare.
  let zoneOut = "";
  if (entry.kind === "detail-zone" && entry.path === DETAIL_TAB.path) {
    const zoneIn = normalizeZone(parsed.zone);
    if (zoneIn !== "") zoneOut = zoneIn;
  }
  return {
    pathname: pathFor(entry, params),
    search: searchFor(entry.tab ?? "", entry.view ?? "", zoneOut, parsed.params),
  };
}

/**
 * ZONE_ALIAS lookup as a plain string: routes.ts types the table as a total
 * `Record<string, DetailZone>`, so TS cannot see the runtime undefined and
 * rejects `?? ` / "" comparisons on the narrowed literal union. Reading it
 * through an optional-valued view keeps the behavior (fallback = raw query)
 * type-honest.
 */
export function normalizeZone(raw: string): string {
  const table: Readonly<Record<string, string | undefined>> = ZONE_ALIAS;
  return table[raw] ?? raw;
}

/**
 * App-level effect: when the URL carries a PRD `#/…` hash form, replace it
 * with the canonical browser location (the pushed URL has no fragment, so
 * the hash is stripped and the bridge can never loop). Params from the
 * pre-existing window.search (the GLOBAL `?state=` fixture switch of
 * shell/fixtures, plus deep-link params like `employee=`) are carried over;
 * canonical hash-derived params win on key collisions.
 */
/**
 * Boot-time hash snapshot. On a `#/…` boot, App's bridge effect navigates,
 * but ProfileProvider's effect (parent effects commit after child effects)
 * re-asserts `?profile=` from the location it captured at render — stomping
 * the redirect back to `/` within the same commit, by which time the live
 * URL no longer carries the fragment. Capturing it at module-evaluation
 * time (scripts run long before React mounts) keeps PRD deep links
 * addressable under that race; the snapshot is cleared as soon as the
 * canonical location has actually landed, so normal boots are untouched.
 */
let bootHash =
  typeof window === "undefined" ? "" : window.location.hash;

export function useConsoleHashBridge(authoritative: ReadonlySet<string>): void {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  useEffect(() => {
    const raw = window.location.hash !== "" ? window.location.hash : bootHash;
    if (!raw.startsWith("#/")) {
      bootHash = "";
      return;
    }
    const target = resolveHashTarget(raw, authoritative);
    // Landed (possibly after a re-assert above re-navigated): stop replaying.
    if (bootHash !== "" && pathname === target.pathname) {
      bootHash = "";
    }
    const merged = new URLSearchParams(window.location.search);
    new URLSearchParams(target.search).forEach((value, key) => {
      merged.set(key, value);
    });
    const qs = merged.toString();
    const wanted = qs === "" ? "" : `?${qs}`;
    if (pathname === target.pathname && search === wanted) return;
    navigate(
      { pathname: target.pathname, search: wanted },
      { replace: true },
    );
  }, [navigate, pathname, search, authoritative]);
}

/* ------------------------------------------------------------------ *
 * B/C module-page existence probe (stage-2 brief 5)
 * ------------------------------------------------------------------ */

/** Module-page shape: optional employeeId passthrough for the detail probe. */
export type ModulePageComponent = ComponentType<{ employeeId?: string }>;

const modulePageFiles = import.meta.glob("../modules/*/*ModulePage.tsx");

function pickModulePage(
  candidates: readonly string[],
): LazyExoticComponent<ModulePageComponent> | null {
  for (const key of candidates) {
    const loader = modulePageFiles[key];
    if (loader !== undefined) {
      return lazy(loader as () => Promise<{ default: ModulePageComponent }>);
    }
  }
  return null;
}

export const DetailModulePage = pickModulePage([
  "../modules/employee-detail/EmployeeDetailModulePage.tsx",
  "../modules/employees/EmployeeDetailModulePage.tsx",
]);

export const RunsModulePage = pickModulePage([
  "../modules/runs/RunsModulePage.tsx",
  "../modules/tasks/RunsModulePage.tsx",
]);

/** True when a B/C runs module page exists — App then fronts the builtin
 * `/runs` route with ConsoleRunsAdapter (the builtin mapping itself in
 * BUILTIN_ROUTES_CORE stays untouched either way). */
export function runsModulePageAvailable(): boolean {
  return RunsModulePage !== null;
}
