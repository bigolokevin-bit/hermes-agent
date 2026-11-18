/**
 * Chat-module manifest — the declaration the console shell needs to give the
 * chat module its sidebar tab and route (PRD v4.1 §9.2-B, CHAT-01).
 *
 * There is no formal module-manifest contract in this repo (no `manifest.ts`
 * existed before this file). The only way a tab is declared today is the
 * dashboard plugin system, so this object follows the plugin-tab shape.
 * Field-for-field it is copied from:
 *
 *  - `web/src/plugins/types.ts:5-19` — `PluginManifest` slots `name` (stable
 *    id), `label` (sidebar text), `icon` (a KEY string, not a component), and
 *    `tab.path` (the route the tab points at).
 *  - `web/src/App.tsx:469-473` — `buildNavItems` turns a manifest into
 *    `{ path: manifest.tab.path, label: manifest.label, icon: resolveIcon(manifest.icon) }`;
 *    this object carries exactly those four values in flat form.
 *  - `web/src/App.tsx:548-556` — `buildRoutes` pairs the same `tab.path` with
 *    the tab component; wiring `/chat` to `ChatModulePage` is the host's job.
 *  - `web/src/App.tsx:429-453` — `ICON_MAP`: `icon` must name a key resolved
 *    there. "MessageSquare" is one (also used by the Sessions nav row,
 *    `web/src/App.tsx:310`).
 *
 * The label is 「对话」 — the same string the zh locale gives the built-in
 * chat tab (`chat: "对话"`, `web/src/i18n/zh.ts:76`).
 */

export interface ChatModuleManifest {
  /** Stable module id — the plugin `name` slot (plugins/types.ts:6). */
  id: string;
  /** Route path the module owns — the plugin `tab.path` slot (plugins/types.ts:12). */
  path: string;
  /** Sidebar label, 「对话」 — the plugin `label` slot (plugins/types.ts:7). */
  label: string;
  /** Icon KEY resolved by App's ICON_MAP (App.tsx:429-453) — plugins/types.ts:9. */
  icon: string;
}

export const chatModuleManifest: ChatModuleManifest = {
  id: "chat",
  path: "/chat",
  label: "对话",
  icon: "MessageSquare",
};
