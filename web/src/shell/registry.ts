/**
 * Console shell module registry — stage 1 (shell-alignment lane A).
 *
 * Loads placeholder pane manifests via an eager glob over
 * modules/<name>/manifest.ts and merges them with CONSOLE_TABS from
 * ./routes so the shell invariants are
 * assertable without any page import:
 *   - visibleTabCount() === 22  (PRD Section 3; skeleton probe parity)
 *   - CONSOLE_MODULES.length === 8 (skeleton MODULES block, L5249-5258)
 *
 * Manifests are DATA ONLY (no JSX in .ts): kind:'planned' entries carry
 * metadata for an honest placeholder shell that stage 2 renders from this
 * registry (PRD discipline: no fake data, no dead links — every planned
 * entry's `route` must exist in ROUTE_TABLE, enforced by validateRegistry()).
 * kind:'reuse' entries lazy-import an upstream component; stage 1 registers
 * none (reuse wiring must not couple to upstream pages before stage 2).
 *
 * Invalid manifests are SKIPPED with a console.warn (never crash the app at
 * import time); `validateRegistry()` returns the same issues for tests/e2e.
 */

import type { ComponentType } from 'react';
import { CONSOLE_MODULES, CONSOLE_TABS, ROUTE_TABLE, TABNAME_ENTRIES, type ConsoleModule } from './routes';

/** One pane/tab provided by a module manifest. */
export interface TabEntry {
  id: string;
  label: string;
  /** Canonical '#/…' route form; MUST match a ROUTE_TABLE entry's hash. */
  route: string;
  kind: 'planned' | 'reuse';
  /** Lazy upstream component; only valid for kind:'reuse'. */
  reuse?: () => Promise<{ default: ComponentType }>;
  /** Honest data-source label (pane data-src contract, PRD Section 7). */
  dataSource: string;
  /** Sidebar/nav icon KEY (App ICON_MAP naming) — metadata for the shell. */
  icon?: string;
  /** Owning IA group (one of CONSOLE_MODULES). Manifest dirs are the eight
   * groups, so this normally equals the module field; kept per-tab because
   * the 22-tab table is the contract, the layout is not. */
  group?: ConsoleModule;
}

export interface ModuleManifest {
  /** Pane name (matches the modules/<name>/ directory, e.g. 'duty'). */
  module: string;
  tabs: TabEntry[];
}

const manifestFiles = import.meta.glob('../modules/*/manifest.ts', { eager: true }) as Record<
  string,
  { default?: ModuleManifest } | undefined
>;

function tabEntryIssues(where: string, entry: TabEntry): string[] {
  const issues: string[] = [];
  if (typeof entry.id !== 'string' || entry.id === '') issues.push(`${where}: empty tab id`);
  if (typeof entry.label !== 'string' || entry.label === '') issues.push(`${where}: empty label`);
  if (typeof entry.route !== 'string' || !entry.route.startsWith('#/')) issues.push(`${where}: route must be a '#/…' form`);
  else if (!ROUTE_TABLE.some((r) => r.hash === entry.route)) issues.push(`${where}: route '${entry.route}' is not in ROUTE_TABLE (dead link)`);
  if (entry.kind !== 'planned' && entry.kind !== 'reuse') issues.push(`${where}: kind must be 'planned' or 'reuse'`);
  if (entry.kind === 'planned' && entry.reuse !== undefined) issues.push(`${where}: planned entries must not carry reuse()`);
  if (entry.kind === 'reuse' && typeof entry.reuse !== 'function') issues.push(`${where}: reuse entries need a reuse() loader`);
  if (typeof entry.dataSource !== 'string' || entry.dataSource === '') issues.push(`${where}: empty dataSource (data-src contract)`);
  if (entry.group !== undefined && !CONSOLE_MODULES.some((m) => m.module === entry.group))
    issues.push(`${where}: group '${String(entry.group)}' is not a CONSOLE_MODULES id`);
  return issues;
}

function manifestIssues(name: string, value: unknown): string[] {
  if (typeof value !== 'object' || value === null) return [`manifest '${name}': default export missing`];
  const manifest = value as Partial<ModuleManifest>;
  if (manifest.module !== name) return [`manifest '${name}': module field '${String(manifest.module)}' must equal the directory name`];
  if (!Array.isArray(manifest.tabs) || manifest.tabs.length === 0) return [`manifest '${name}': tabs must be a non-empty array`];
  return manifest.tabs.flatMap((entry, i) => tabEntryIssues(`${name}.tabs[${i}]`, entry));
}

const manifests = new Map<string, ModuleManifest>();
const registryIssues: string[] = [];
for (const [file, mod] of Object.entries(manifestFiles)) {
  const name = file.match(/\/modules\/([^/]+)\/manifest\.ts$/)?.[1] ?? file;
  const issues = manifestIssues(name, mod?.default);
  if (issues.length > 0) {
    registryIssues.push(...issues);
    console.warn(`[shell/registry] skipping invalid manifest '${name}':`, issues.join('; '));
    continue;
  }
  manifests.set(name, (mod as { default: ModuleManifest }).default);
}

/** Look up a pane manifest by name ('duty', 'matrix', …); undefined if
 * absent or invalid. */
export function getManifest(module: string): ModuleManifest | undefined {
  return manifests.get(module);
}

/** Names of all validly registered pane manifests (stage 1: the five
 * placeholder panes — duty, matrix, employee-detail, board, runs). */
export function registeredModules(): string[] {
  return [...manifests.keys()].sort();
}

/** 22 — visible navigation tabs only (hidden 详情 excluded; skeleton probe:
 * data-tabname unique=23, data-hidetab marks the one non-nav pane). */
export function visibleTabCount(): number {
  return CONSOLE_TABS.filter((t) => t.visible).length;
}

/** 23 — all data-tabname pane entries (22 visible + hidden detail). */
export function tabnameCount(): number {
  return TABNAME_ENTRIES.length;
}

/** 8 — sidebar console modules (not pane-manifest count). */
export function consoleModuleCount(): number {
  return CONSOLE_MODULES.length;
}

/** All tab entries across registered manifests, for stage 2 pane mounting. */
export function allTabs(): Array<TabEntry & { pane: string }> {
  return [...manifests.values()].flatMap((m) => m.tabs.map((t) => ({ ...t, pane: m.module })));
}

/** Validation issues found at load time (empty array = registry is clean).
 * Also verifies every visible CONSOLE_TABS route exists in ROUTE_TABLE and
 * that the manifest table is EXACTLY the 22 visible tabs (assert-ia react
 * counts the sum of manifest tabs[] — this law keeps the two in sync). */
export function validateRegistry(): string[] {
  const issues: string[] = [...registryIssues];
  for (const tab of CONSOLE_TABS) {
    if (!ROUTE_TABLE.some((r) => r.hash === tab.hash)) issues.push(`CONSOLE_TABS '${tab.hash}' missing from ROUTE_TABLE`);
  }
  const registered = new Set(allTabs().map((t) => t.route));
  for (const tab of CONSOLE_TABS) {
    if (!registered.has(tab.hash)) issues.push(`visible tab '${tab.hash}' (${tab.tabId}) has no manifest entry`);
  }
  const visible = new Set(CONSOLE_TABS.map((t) => t.hash));
  for (const t of allTabs()) {
    if (!visible.has(t.route)) issues.push(`manifest entry '${t.pane}/${t.id}' route '${t.route}' is not a visible CONSOLE_TAB (hidden/extra — assert-ia counts it and breaks tabs=22)`);
  }
  if (visibleTabCount() !== 22) issues.push(`visibleTabCount=${visibleTabCount()} want 22`);
  if (consoleModuleCount() !== 8) issues.push(`consoleModuleCount=${consoleModuleCount()} want 8`);
  if (tabnameCount() !== 23) issues.push(`tabnameCount=${tabnameCount()} want 23`);
  return issues;
}

/** ConsoleModule guard for callers mapping manifest names to modules. */
export function isConsoleModule(value: string): value is ConsoleModule {
  return CONSOLE_MODULES.some((m) => m.module === value);
}
