/**
 * Top-bar page title resolution.
 *
 * Design lane ③（「删顶栏英文模块名，统一中文面包屑」）:
 *   * Console-shell paths — every location whose pathname matches a visible
 *     tab / detail / view / compat-tab row of shell/routes.ts ROUTE_TABLE —
 *     already render their own Chinese breadcrumb in `shell/console.tsx`
 *     (`{meta.group} · 控制台` + `<h1>{meta.label}</h1>`). The global header
 *     must not repeat an English/duplicate title there; `isConsoleShellPath`
 *     lets `PageHeaderProvider` drop that <h1> while keeping the bar, its
 *     actions and layout intact. routes.ts is imported read-only (no edits).
 *   * Everything else (Hermes-native pages) truly consumes the passed `t`
 *     (`app.nav.*`), falls back to the historical English literal when the
 *     active dictionary lacks the key, and finally to the pre-existing
 *     capitalized-segment fallback.
 */
import type { Translations } from "@/i18n/types";
import { findRoute, resolveRedirect, type RouteKind } from "@/shell/routes";

const BUILTIN: Record<string, keyof Translations["app"]["nav"]> = {
  "/chat": "chat",
  "/sessions": "sessions",
  "/analytics": "analytics",
  "/models": "models",
  "/logs": "logs",
  "/cron": "cron",
  "/skills": "skills",
  "/plugins": "plugins",
  "/profiles": "profiles",
  "/config": "config",
  "/env": "keys",
  "/docs": "documentation",
  // Former BUILTIN_LITERAL (English hard-coded, t unused): every one of
  // these paths has an app.nav key in the dictionaries, so titles now resolve
  // through t; BUILTIN_EN below keeps the old literals as the miss fallback.
  "/files": "files",
  "/mcp": "mcp",
  "/channels": "channels",
  "/webhooks": "webhooks",
  "/pairing": "pairing",
  "/system": "system",
  // Native-ish pages that previously fell through to the capitalized
  // segment fallback and showed English inside the zh console.
  "/runs": "runs",
  "/tasks": "tasks",
  "/collab": "collaboration",
  "/collaboration": "collaboration",
};

/** Historical English labels — used only when the dictionary has no value. */
const BUILTIN_EN: Partial<Record<keyof Translations["app"]["nav"], string>> = {
  files: "Files",
  mcp: "MCP",
  channels: "Channels",
  webhooks: "Webhooks",
  pairing: "Pairing",
  system: "System",
};

/**
 * Design lane ③ registered residuals: console-adjacent routes that are NOT
 * ROUTE_TABLE shell rows and have no app.nav key, so they used to hit the
 * capitalize fallback ("Metrics", "Audit", "Calendar", ...). Chinese labels
 * below match each page's own in-body heading (MetricsModulePage 「运行分析」,
 * routes.ts #51 「审计事件」, App.tsx NotWiredPage labels).
 */
const RESIDUAL_ZH: Record<string, string> = {
  "/metrics": "运行分析",
  "/audit": "审计事件",
  "/calendar": "日历",
  "/integrations": "集成",
  "/forms": "表单",
};

/** Row kinds served inside the console shell (its Chinese breadcrumb renders). */
const SHELL_KINDS: readonly RouteKind[] = ["tab", "detail-zone", "view", "compat-tab"];

/**
 * True for console-shell locations per shell/routes.ts: a ROUTE_TABLE hit of
 * shell kind whose pathname is not a redirect-only (appendix A.2) form —
 * redirect sources may still mount native/gov pages under App's authority
 * (e.g. /cron renders the gov CronModulePage, /sessions stays upstream).
 */
export function isConsoleShellPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/";
  if (resolveRedirect(normalized) !== null) return false;
  const hit = findRoute(normalized);
  return hit !== null && SHELL_KINDS.includes(hit.entry.kind);
}

function navText(t: Translations | undefined, key: keyof Translations["app"]["nav"]): string {
  const value = t?.app?.nav?.[key];
  return typeof value === "string" && value.length > 0 ? value : "";
}

export function resolvePageTitle(
  pathname: string,
  t: Translations,
  pluginTabs: { path: string; label: string }[],
): string {
  const normalized = pathname.replace(/\/$/, "") || "/";
  if (normalized === "/") {
    return navText(t, "sessions") || "Sessions";
  }
  const plugin = pluginTabs.find((p) => p.path === normalized);
  if (plugin) {
    return plugin.label;
  }
  const key = BUILTIN[normalized];
  if (key) {
    const text = navText(t, key);
    if (text) return text;
    const literal = BUILTIN_EN[key];
    if (literal) return literal;
  }
  const residual = RESIDUAL_ZH[normalized];
  if (residual) {
    return residual;
  }
  // Derive title from pathname: "/profiles" → "Profiles"
  const segment = normalized.slice(1);
  if (segment) {
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  }
  return t.app.webUi;
}
