/**
 * audit 审计事件 pane — module manifest (T33, lane console-approvals).
 *
 * Two exports, because this repo declares a module twice over:
 *
 *  1. THE FLAT NAV SHAPE — `id` / `path` / `label` / `icon`, field-for-field the
 *     shape `web/src/modules/chat/manifest.ts` documents (its own interface,
 *     lines 24-38): `id` is the plugin `name` slot, `label` the sidebar text,
 *     `icon` a KEY resolved by `ICON_MAP` in `web/src/App.tsx:467-491`
 *     (never a component), `path` the route the tab points at.
 *     `icon: "Shield"` is a key that already exists in that map; nothing new is
 *     added to App.tsx (it is outside this lane's write domain).
 *     `path: "/system"` carries the tab on the query, exactly as
 *     `web/src/shell/routes.ts:179` does: 「审计事件」 is the `?tab=events`
 *     pane of `/system`, and `#/audit` is its compat alias (routes.ts:255).
 *     The label 「审计事件」 is the same string routes.ts:179 gives that tab.
 *
 *  2. THE REGISTRY SHAPE — the default export `shell/registry.ts` eager-globs
 *     (pattern: one `manifest.ts` per module directory) and validates:
 *     `module` must equal the
 *     directory name, every tab needs a `route` that exists in ROUTE_TABLE
 *     (a dead link is a registry issue), `kind:'planned'` must not carry a
 *     `reuse()` loader, and `dataSource` must be non-empty. Mirrors
 *     `modules/duty|matrix|board|runs|employee-detail/manifest.ts`.
 *
 * `kind` stays `'planned'` on purpose: mounting the pane is the wiring lane's
 * job (App.tsx / shell routes are outside this write domain, and registry.ts
 * itself forbids reuse coupling before stage 2). The pages this manifest
 * describes are real and already built to the shell's own naming rule —
 * `AuditEventsModulePage.tsx` / `AuditVerifyModulePage.tsx`, the
 * `shell/bridge.ts:170` resolves (one level of module directory, then the file).
 */
import type { ModuleManifest } from "../../shell/registry";

export interface AuditModuleManifest {
  /** Stable module id — the plugin `name` slot (chat/manifest.ts:26). */
  id: string;
  /** Route path the pane lives on — the plugin `tab.path` slot. */
  path: string;
  /** Sidebar label — the plugin `label` slot. */
  label: string;
  /** Icon KEY resolved by App's ICON_MAP — the plugin `icon` slot. */
  icon: string;
}

export const auditModuleManifest: AuditModuleManifest = {
  id: "audit",
  path: "/system",
  label: "审计事件",
  icon: "Shield",
};

const manifest: ModuleManifest = {
  module: "audit",
  tabs: [
    {
      id: "events",
      label: "审计事件",
      // ROUTE_TABLE row for `#/system?tab=events` (shell/routes.ts:179) —
      // navigable, never a dead link; `#/audit` redirects here.
      route: "#/system?tab=events",
      kind: "planned",
      dataSource: "/api/audit /api/audit/detail?id= /api/audit/verify?from=&to=",
    },
  ],
};

export default manifest;
