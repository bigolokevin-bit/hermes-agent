import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router";
import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  ClipboardList,
  Clock,
  Code,
  Contact,
  Cpu,
  Database,
  Download,
  Eye,
  FolderOpen,
  FileText,
  Gauge,
  Globe,
  Handshake,
  Heart,
  KeyRound,
  Menu,
  MessageSquare,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Puzzle,
  Radio,
  RotateCw,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Terminal,
  Users,
  Webhook,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { SelectionSwitcher } from "@nous-research/ui/ui/components/selection-switcher";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { Typography } from "@nous-research/ui/ui/components/typography/index";
import { ConfirmDialog } from "@nous-research/ui/ui/components/confirm-dialog";
import { cn } from "@/lib/utils";
import { SidebarFooter } from "@/components/SidebarFooter";
import { SidebarStatusStrip, gatewayLine } from "@/components/SidebarStatusStrip";
import { useBelowBreakpoint } from "@nous-research/ui/hooks/use-below-breakpoint";
import { useSidebarStatus } from "@/hooks/useSidebarStatus";
import { AuthWidget } from "@/components/AuthWidget";
import { PageHeaderProvider } from "@/contexts/PageHeaderProvider";
import { useProfileScope } from "@/contexts/useProfileScope";
import { ProfileSwitcher } from "@/components/ProfileSwitcher";
import { ProfileScopeBanner } from "@/components/ProfileScopeBanner";
import { MemoryPressureBanner } from "@/components/MemoryPressureBanner";
import { MultiplexStandaloneBanner } from "@/components/MultiplexStandaloneBanner";
import { SharedMetricsConsentBanner } from "@/components/SharedMetricsConsentBanner";
import { useSystemActions } from "@/contexts/useSystemActions";
import type { SystemAction } from "@/contexts/system-actions-context";
// Route pages are lazy-loaded so the initial dashboard shell does not pay for
// every admin surface (and heavy deps like xterm) up front.
const ConfigPage = lazy(() => import("@/pages/ConfigPage"));
const DocsPage = lazy(() => import("@/pages/DocsPage"));
const EmployeesPage = lazy(() => import("@/pages/EmployeesPage"));
const EmployeeDetailPage = lazy(() => import("@/pages/EmployeeDetailPage"));
const ApprovalsPage = lazy(() => import("@/pages/ApprovalsPage"));
// Wave-1 module pages (lanes T10/T13/T14/T15) — integration wiring into the
// console live maps below; manifests' reuse loaders stay metadata-only.
const DutyConsolePage = lazy(() => import("@/modules/duty/DutyPage"));
const MatrixConsolePage = lazy(() =>
  import("@/modules/matrix/MatrixModulePage").then((m) => ({
    default: m.MatrixModulePage,
  })),
);
const TasksBoardConsolePage = lazy(() => import("@/modules/tasks/TasksBoardModulePage"));
// R10 item 7: audit events page body is delivered by lane aud; the shell only
// wires it into the /system live slots (?tab=events).
const AuditEventsConsolePage = lazy(() =>
  import("@/modules/audit/AuditEventsModulePage").then((m) => ({
    default: m.AuditEventsModulePage,
  })),
);
const RunsConsolePage = lazy(() => import("@/modules/runs/RunsModulePage"));
// L0 IA freeze: settings/version are system sub-tabs, not top-level modules.
// Their pages render through the /system live slots below (?tab=defaults|version).
const SettingsConsolePage = lazy(() =>
  import("@/modules/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const VersionConsolePage = lazy(() =>
  import("@/modules/version/VersionPage").then((m) => ({ default: m.VersionPage })),
);
// Wave-2 module pages (lanes T05/T11/T18-21/T25-30) — same live-map policy.
/* R15 item 2: /metrics mounts the gov metrics module (met5-* compatibility
 * table, 7×24 heat) as its own page body — the /overview usage tab stays on
 * the delivered usage page. */
const MetricsConsolePage = lazy(() =>
  import("@/modules/metrics/MetricsModulePage").then((m) => ({
    default: m.MetricsModulePage,
  })),
);
/* R17 collab: the delegation page body is delivered by lane aud
 * (named export CollabDelegationsModulePage); the shell only mounts it. */
/* R17 auth5: console sign-in page (same-origin /auth bridge by lane D). */
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const CollabConsolePage = lazy(() =>
  import("@/modules/collab/CollabDelegationsModulePage").then((m) => ({
    default: m.CollabDelegationsModulePage,
  })),
);
const UsageConsolePage = lazy(() => import("@/modules/duty/UsagePage"));
const PeopleConsolePage = lazy(() => import("@/modules/people/PeopleModulePage"));
const OrgConsolePage = lazy(() => import("@/modules/org/OrgModulePage"));
/* R13 item 1: governance page bodies delivered by lane gov — default
 * exports, wired straight into the identity/knowledge live slots. */
const AccessConsolePage = lazy(() => import("@/modules/access/AccessModulePage"));
const KnowledgeConsolePage = lazy(() => import("@/modules/knowledge/KnowledgeModulePage"));
const EvidenceConsolePage = lazy(() =>
  import("@/modules/evidence/EvidenceModulePage").then((m) => ({
    default: m.EvidenceModulePage,
  })),
);
const CapSkillsConsolePage = lazy(() =>
  import("@/modules/skills/SkillsPage").then((m) => ({ default: m.SkillsPage })),
);
const CapToolsConsolePage = lazy(() =>
  import("@/modules/tools/ToolsPage").then((m) => ({ default: m.ToolsPage })),
);
const CapModelsConsolePage = lazy(() =>
  import("@/modules/models/ModelsModulePage").then((m) => ({
    default: m.ModelsModulePage,
  })),
);
/* R11 item 3: V4 channels page body (lane aud contract: named export
 * ChannelsPage from @/modules/channels/ChannelsPage) replaces the bare
 * upstream English shell in the capabilities live slot. */
const CapChannelsConsolePage = lazy(() =>
  import("@/modules/channels/ChannelsPage").then((m) => ({
    default: m.ChannelsPage,
  })),
);
const HealthConsolePage = lazy(() =>
  import("@/modules/health/HealthPage").then((m) => ({ default: m.HealthPage })),
);
const ApprovalsPendingConsolePage = lazy(() =>
  import("@/modules/approvals/ApprovalsPendingModulePage").then((m) => ({
    default: m.ApprovalsPendingModulePage,
  })),
);
const ApprovalsHistoryConsolePage = lazy(() =>
  import("@/modules/approvals/ApprovalsHistoryModulePage").then((m) => ({
    default: m.ApprovalsHistoryModulePage,
  })),
);
const RunsPage = lazy(() => import("@/pages/RunsPage"));
const EnvPage = lazy(() => import("@/pages/EnvPage"));
const FilesPage = lazy(() => import("@/pages/FilesPage"));
const SessionsPage = lazy(() => import("@/pages/SessionsPage"));
const LogsPage = lazy(() => import("@/pages/LogsPage"));
const AnalyticsPage = lazy(() => import("@/pages/AnalyticsPage"));
const ModelsPage = lazy(() => import("@/pages/ModelsPage"));
const CronPage = lazy(() => import("@/pages/CronPage"));
const ProfilesPage = lazy(() => import("@/pages/ProfilesPage"));
const ProfileBuilderPage = lazy(() => import("@/pages/ProfileBuilderPage"));
const SkillsPage = lazy(() => import("@/pages/SkillsPage"));
const PluginsPage = lazy(() => import("@/pages/PluginsPage"));
const McpPage = lazy(() => import("@/pages/McpPage"));
const PairingPage = lazy(() => import("@/pages/PairingPage"));
const ChannelsPage = lazy(() => import("@/pages/ChannelsPage"));
const WebhooksPage = lazy(() => import("@/pages/WebhooksPage"));
const SystemPage = lazy(() => import("@/pages/SystemPage"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));
// Lane-A console shell: the employee-scoped chat module page (import only —
// never edited here; it lazy-mounts the upstream ChatPage as its host).
const ChatModulePage = lazy(() => import("@/modules/chat/ChatModulePage"));
// Console shell tokens (PRD v4 skeleton :root block). Imported exactly once
// app-wide, here (stage-2 brief 6).
import "@/shell/tokens.css";
import { FixtureProvider } from "@/shell/fixtures";
import {
  ConsoleEmployeeDetailPage,
  ConsoleFixtureChrome,
  ConsoleModulePage,
  ConsoleNav,
  ConsoleRunsAdapter,
} from "@/shell/console";
import { runsModulePageAvailable, useConsoleHashBridge } from "@/shell/bridge";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { useI18n } from "@/i18n";
import type { Translations } from "@/i18n/types";
import { PluginPage, PluginSlot, usePlugins } from "@/plugins";
import type { PluginManifest } from "@/plugins";
import { useTheme } from "@/themes";
import { isDashboardEmbeddedChatEnabled } from "@/lib/dashboard-flags";
import { latchChatActivation } from "@/lib/chat-activation";
import { sharedGatewayProfiles, sharedGatewayRestartDescription } from "@/lib/shared-gateway";
import { api } from "@/lib/api";
import type { StatusResponse, UpdateCheckResponse } from "@/lib/api";

function RouteFallback({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[12rem] flex-1 items-center justify-center"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        <span>{label}</span>
      </div>
    </div>
  );
}

function RootRedirect() {
  // R4 item 3: default landing is the console overview (值班台), not the
  // English upstream /sessions page. The /sessions route itself stays.
  return <Navigate to="/overview" replace />;
}

function UnknownRouteFallback({ pluginsLoading }: { pluginsLoading: boolean }) {
  if (pluginsLoading) {
    // Render nothing during the plugin-load window — a spinner here would just flash.
    return null;
  }
  // R4 item 3: unknown paths fall back to /overview (PRD §7 negative case);
  // previously they landed on /sessions, an all-English upstream page.
  return <Navigate to="/overview" replace />;
}

type NavGroupKey = "operations" | "governance" | "runtime" | "system";

const NAV_GROUP_ORDER: NavGroupKey[] = [
  "operations",
  "governance",
  "runtime",
  "system",
];

/** English literals are the fallback when a locale has not translated a group. */
const NAV_GROUP_FALLBACK: Record<NavGroupKey, string> = {
  operations: "运营",
  governance: "治理",
  runtime: "运行",
  system: "系统",
};

const CHAT_NAV_ITEM: NavItem = {
  path: "/chat",
  labelKey: "chat",
  label: "Chat",
  icon: Terminal,
  group: "runtime",
};

/**
 * Built-in routes except /chat.  Chat is rendered persistently (outside
 * <Routes>) when embedded — see the persistent chat host block rendered
 * inline near the bottom of this file — so the PTY child, WebSocket,
 * and xterm instance survive when the user visits another tab and comes
 * back.  A `display:none` toggle hides the terminal without unmounting.
 * The host itself is still deferred until the first /chat visit so the
 * xterm chunk is not downloaded on unrelated pages.  Routing still owns
 * the URL so /chat deep-links, browser back/forward, and nav highlight
 * keep working.
 */
const BUILTIN_ROUTES_CORE: Record<string, ComponentType> = {
  "/": RootRedirect,
  "/sessions": SessionsPage,
  "/files": FilesPage,
  "/analytics": AnalyticsPage,
  "/models": ModelsPage,
  "/logs": LogsPage,
  "/cron": CronPage,
  "/skills": SkillsPage,
  "/plugins": PluginsPage,
  "/mcp": McpPage,
  "/pairing": PairingPage,
  "/channels": ChannelsPage,
  "/webhooks": WebhooksPage,
  "/system": SystemPage,
  "/profiles": ProfilesPage,
  "/profiles/new": ProfileBuilderPage,
  "/config": ConfigPage,
  "/env": EnvPage,
  "/docs": DocsPage,
  "/employees": EmployeesPage,
  "/employees/:employeeId": EmployeeDetailPage,
  "/approvals": ApprovalsPage,
  "/runs": RunsPage,
};

// Route placeholder for /chat.  The persistent ChatPage host (rendered
// outside <Routes> when embedded chat is on) paints on top; this empty
// element just claims the path so the `*` catch-all redirect doesn't
// fire when the user navigates to /chat.
function ChatRouteSink() {
  return null;
}

/**
 * Thin route wrapper for the chat module. The chat host marker lives inside
 * ChatModulePage, which lazy-mounts the upstream ChatPage and gates it behind
 * the employee guard (zero /api/pty calls until bound). Keeping the marker
 * there makes the module the one and only host.
 */
function ConsoleChatMount({ employeeId }: { employeeId: string }) {
  return <ChatModulePage employeeId={employeeId} />;
}

const BUILTIN_NAV_REST: NavItem[] = [
  // 1) Business operations — the four live console surfaces plus two
  //    explicitly-labelled placeholders. Placeholders never navigate: they
  //    render as non-interactive rows with a "coming soon" badge so no
  //    click can land on a blank page.
  {
    path: "/employees",
    label: "数字员工",
    icon: Users,
    group: "operations",
  },
  {
    path: "/approvals",
    label: "审批",
    icon: FileText,
    group: "operations",
  },
  {
    path: "/work",
    label: "任务",
    icon: ClipboardList,
    group: "operations",
  },
  {
    path: "/collaboration",
    label: "协作",
    icon: Handshake,
    group: "operations",
    placeholder: true,
  },
  {
    path: "/runs",
    label: "运行",
    icon: Activity,
    group: "operations",
  },

  // 2) Enterprise governance — no upstream routes exist yet, so every entry
  //    is a labelled placeholder rather than a link to an empty page.
  {
    path: "/knowledge",
    label: "知识",
    icon: BookOpen,
    group: "governance",
  },
  {
    path: "/identity",
    label: "组织与人员",
    icon: Building2,
    group: "governance",
  },
  {
    path: "/tenant-quota",
    label: "租户与配额",
    icon: Gauge,
    group: "governance",
    placeholder: true,
  },
  {
    path: "/access-control",
    label: "访问控制",
    icon: Shield,
    group: "governance",
    placeholder: true,
  },
  {
    path: "/identity?tab=people",
    label: "人员名录",
    icon: Contact,
    group: "governance",
  },
  /* R13 item 1: governance tabs with delivered page bodies get real nav
   * entries (live slots in /identity and /knowledge). Still-pending items
   * above keep their honest placeholder state. */
  {
    path: "/identity?tab=departments",
    label: "组织与部门",
    icon: Building2,
    group: "governance",
  },
  {
    path: "/identity?tab=roles",
    label: "角色与权限",
    icon: ShieldCheck,
    group: "governance",
  },
  {
    path: "/knowledge?tab=spaces",
    label: "知识空间",
    icon: BookOpen,
    group: "governance",
  },

  // 3) Runtime — every existing upstream route is preserved verbatim.
  {
    path: "/sessions",
    labelKey: "sessions",
    label: "Sessions",
    icon: MessageSquare,
    group: "runtime",
  },
  {
    path: "/files",
    labelKey: "files",
    label: "Files",
    icon: FolderOpen,
    group: "runtime",
  },
  {
    path: "/analytics",
    labelKey: "analytics",
    label: "Analytics",
    icon: BarChart3,
    group: "runtime",
  },
  {
    path: "/models",
    labelKey: "models",
    label: "Models",
    icon: Cpu,
    group: "runtime",
  },
  {
    path: "/mcp",
    labelKey: "mcp",
    label: "MCP",
    icon: Plug,
    group: "runtime",
  },
  {
    // R10 item 7: single-language console surface — Chinese label, and the
    // link targets the console capabilities tab instead of the bare upstream
    // shell (which now redirects here anyway).
    path: "/capabilities?tab=channels",
    label: "平台接入",
    icon: Radio,
    group: "runtime",
  },
  {
    path: "/system?tab=events",
    label: "审计事件",
    icon: ShieldCheck,
    group: "governance",
  },
  {
    path: "/cron",
    labelKey: "cron",
    label: "Cron",
    icon: Clock,
    group: "runtime",
  },
  {
    path: "/logs",
    labelKey: "logs",
    label: "Logs",
    icon: FileText,
    group: "runtime",
  },
  {
    path: "/system",
    labelKey: "system",
    label: "System",
    icon: Wrench,
    group: "runtime",
  },

  // 4) System — all remaining upstream surfaces, none removed.
  {
    path: "/config",
    labelKey: "config",
    label: "Config",
    icon: Settings,
    group: "system",
  },
  {
    path: "/env",
    labelKey: "env",
    label: "Keys",
    icon: KeyRound,
    group: "system",
  },
  {
    path: "/docs",
    labelKey: "documentation",
    label: "Documentation",
    icon: BookOpen,
    group: "system",
  },
  {
    path: "/plugins",
    labelKey: "plugins",
    label: "Plugins",
    icon: Puzzle,
    group: "system",
  },
  {
    path: "/skills",
    labelKey: "skills",
    label: "Skills",
    icon: Package,
    group: "system",
  },
  {
    path: "/profiles",
    labelKey: "profiles",
    label: "Profiles",
    icon: Users,
    group: "system",
  },
  {
    path: "/webhooks",
    labelKey: "webhooks",
    label: "Webhooks",
    icon: Webhook,
    group: "system",
  },
  {
    path: "/pairing",
    labelKey: "pairing",
    label: "Pairing",
    icon: ShieldCheck,
    group: "system",
  },
];

const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  Activity,
  BarChart3,
  Clock,
  Cpu,
  FileText,
  FolderOpen,
  KeyRound,
  MessageSquare,
  Package,
  Settings,
  Puzzle,
  Sparkles,
  Terminal,
  Globe,
  Database,
  Shield,
  Users,
  Wrench,
  Zap,
  Heart,
  Star,
  Code,
  Eye,
};

function resolveIcon(name: string): ComponentType<{ className?: string }> {
  return ICON_MAP[name] ?? Puzzle;
}

function buildNavItems(
  builtIn: NavItem[],
  manifests: PluginManifest[],
): NavItem[] {
  const items = [...builtIn];

  for (const manifest of manifests) {
    if (manifest.tab.override) continue;
    if (manifest.tab.hidden) continue;

    const pluginItem: NavItem = {
      path: manifest.tab.path,
      label: manifest.label,
      icon: resolveIcon(manifest.icon),
    };

    const pos = manifest.tab.position ?? "end";
    if (pos === "end") {
      items.push(pluginItem);
    } else if (pos.startsWith("after:")) {
      const target = "/" + pos.slice(6);
      const idx = items.findIndex((i) => i.path === target);
      items.splice(idx >= 0 ? idx + 1 : items.length, 0, pluginItem);
    } else if (pos.startsWith("before:")) {
      const target = "/" + pos.slice(7);
      const idx = items.findIndex((i) => i.path === target);
      items.splice(idx >= 0 ? idx : items.length, 0, pluginItem);
    } else {
      items.push(pluginItem);
    }
  }

  return items;
}

/** Split merged nav into built-in sidebar entries vs plugin tabs, preserving plugin order hints. */
function partitionSidebarNav(
  builtIn: NavItem[],
  manifests: PluginManifest[],
): { coreItems: NavItem[]; pluginItems: NavItem[] } {
  const merged = buildNavItems(builtIn, manifests);
  const builtinPaths = new Set(builtIn.map((i) => i.path));
  const coreItems: NavItem[] = [];
  const pluginItems: NavItem[] = [];
  for (const item of merged) {
    if (builtinPaths.has(item.path)) coreItems.push(item);
    else pluginItems.push(item);
  }
  return { coreItems, pluginItems };
}

function buildRoutes(
  builtinRoutes: Record<string, ComponentType>,
  manifests: PluginManifest[],
): Array<{
  key: string;
  path: string;
  element: ReactNode;
}> {
  const byOverride = new Map<string, PluginManifest>();
  const addons: PluginManifest[] = [];

  for (const m of manifests) {
    if (m.tab.override) {
      byOverride.set(m.tab.override, m);
    } else {
      addons.push(m);
    }
  }

  const routes: Array<{
    key: string;
    path: string;
    element: ReactNode;
  }> = [];

  for (const [path, Component] of Object.entries(builtinRoutes)) {
    const om = byOverride.get(path);
    if (om) {
      routes.push({
        key: `override:${om.name}`,
        path,
        element: <PluginPage name={om.name} />,
      });
    } else {
      routes.push({ key: `builtin:${path}`, path, element: <Component /> });
    }
  }

  for (const m of addons) {
    if (m.tab.hidden) continue;
    if (m.tab.path === "/plugins") continue;
    if (builtinRoutes[m.tab.path]) continue;
    routes.push({
      key: `plugin:${m.name}`,
      path: m.tab.path,
      element: <PluginPage name={m.name} />,
    });
  }

  for (const m of manifests) {
    if (!m.tab.hidden) continue;
    if (m.tab.path === "/plugins") continue;
    if (builtinRoutes[m.tab.path] || m.tab.override) continue;
    routes.push({
      key: `plugin:hidden:${m.name}`,
      path: m.tab.path,
      element: <PluginPage name={m.name} />,
    });
  }

  return routes;
}

const SIDEBAR_COLLAPSED_KEY = "hermes-sidebar-collapsed";

export default function App() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const { profile } = useProfileScope();
  const { manifests, loading: pluginsLoading } = usePlugins(profile);
  const { theme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch { /* localStorage may be unavailable in private browsing */ }
      return next;
    });
  }, []);
  const isMobile = useBelowBreakpoint(1024);
  const isDesktopCollapsed = collapsed && !isMobile;
  const tooltipWarmRef = useRef(0);
  const sidebarStatus = useSidebarStatus();
  const isDocsRoute = pathname === "/docs" || pathname === "/docs/";
  const normalizedPath = pathname.replace(/\/$/, "") || "/";
  const isChatRoute = normalizedPath === "/chat";
  const embeddedChat = isDashboardEmbeddedChatEnabled();
  // Defer mounting the persistent chat host (and its xterm chunk) until the
  // user has actually opened /chat at least once. Sticky after that so the
  // PTY survives later tab switches.
  const [chatHostMounted, setChatHostMounted] = useState(isChatRoute);
  useEffect(() => {
    setChatHostMounted((prev) => latchChatActivation(prev, isChatRoute));
  }, [isChatRoute]);

  // `dashboard.show_token_analytics` gates the Analytics nav item.  The
  // page itself remains reachable by URL (it renders an explanation when
  // the flag is off — see AnalyticsPage), but hiding the nav entry avoids
  // surfacing misleading token/cost numbers in the sidebar.  Default off.
  const [showTokenAnalytics, setShowTokenAnalytics] = useState(false);
  useEffect(() => {
    api
      .getConfig()
      .then((cfg) => {
        const dash = (cfg?.dashboard ?? {}) as {
          show_token_analytics?: unknown;
        };
        setShowTokenAnalytics(dash.show_token_analytics === true);
      })
      .catch(() => setShowTokenAnalytics(false));
  }, []);

  // A plugin can replace the built-in /chat page via `tab.override: "/chat"`
  // in its manifest.  When one does, `buildRoutes` already swaps the route
  // element for <PluginPage /> — but we also have to suppress the
  // persistent ChatPage host below, or the plugin's page and the built-in
  // terminal would paint on top of each other.  The override is niche
  // (nothing ships overriding /chat today) but it's an advertised
  // extension point, so preserve the pre-persistence contract: when a
  // plugin owns /chat, the built-in chat UI is entirely absent.
  //
  // Waiting on `pluginsLoading` is load-bearing: manifests arrive
  // asynchronously from /api/dashboard/plugins, so on initial render
  // `chatOverriddenByPlugin` is always false.  Without the loading
  // gate, the persistent host would mount, spawn a PTY, and THEN get
  // yanked out from under the user when the plugin's manifest resolves
  // — killing the session mid-paint.  Delaying host mount by the
  // plugin-load window (typically <50ms, worst case 2s safety timeout)
  // is the cheaper trade-off.
  const chatOverriddenByPlugin = useMemo(
    () => manifests.some((m) => m.tab.override === "/chat"),
    [manifests],
  );

  const builtinRoutes = useMemo(
    () => ({
      ...BUILTIN_ROUTES_CORE,
      ...(embeddedChat ? { "/chat": ChatRouteSink } : {}),
    }),
    [embeddedChat],
  );

  const builtinNav = useMemo(() => {
    const base = embeddedChat
      ? [CHAT_NAV_ITEM, ...BUILTIN_NAV_REST]
      : BUILTIN_NAV_REST;
    return showTokenAnalytics
      ? base
      : base.filter((n) => n.path !== "/analytics");
  }, [embeddedChat, showTokenAnalytics]);

  const sidebarNav = useMemo(
    () => partitionSidebarNav(builtinNav, manifests),
    [builtinNav, manifests],
  );
  const routes = useMemo(
    () => buildRoutes(builtinRoutes, manifests),
    [builtinRoutes, manifests],
  );
  // --- v4 console shell wiring (M0 lane A, stage 2) -----------------------
  // Existing App paths keep authority on conflict (PRD §7 arbitration): the
  // hash bridge consults this set before redirecting compat forms.
  const consoleAuthority = useMemo(
    () => new Set(Object.keys(BUILTIN_ROUTES_CORE)),
    [],
  );
  useConsoleHashBridge(consoleAuthority);
  // Paths currently owned by a plugin `tab.override` — the console route
  // adapters stand down there so the plugin mechanism keeps priority
  // (buildRoutes above is untouched and still swaps the builtin element).
  const overriddenPaths = useMemo(() => {
    const set = new Set<string>();
    for (const m of manifests) if (m.tab.override) set.add(m.tab.override);
    return set;
  }, [manifests]);
  const renderConsoleChatHost = useCallback(
    (employeeId: string) => <ConsoleChatMount employeeId={employeeId} />,
    [],
  );
  const pluginTabMeta = useMemo(
    () =>
      manifests
        .filter((m) => !m.tab.hidden)
        .map((m) => ({
          path: m.tab.override ?? m.tab.path,
          label: m.label,
        })),
    [manifests],
  );

  const layoutVariant = theme.layoutVariant ?? "standard";

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileOpen(false);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return (
    // FixtureProvider wraps the whole layout once (T03-CONTRACT wiring):
    // the `?state=` four-state switch + badge + `<html data-fixture>` mirror
    // are shell-wide; non-console pages are unaffected (null override).
    <FixtureProvider>
    <div
      data-layout-variant={layoutVariant}
      className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-background-base text-text-primary antialiased"
    >
      <SelectionSwitcher />

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
      >
        <PluginSlot name="backdrop" />
      </div>

      <header
        className={cn(
          "lg:hidden fixed top-0 left-0 right-0 z-40 min-h-14",
          "flex items-center gap-2 px-4 py-2",
          "border-b border-current/20",
          "bg-background-base",
        )}
        style={{
          background:
            "var(--component-header-background, var(--background-base))",
          borderImage: "var(--component-header-border-image)",
          clipPath: "var(--component-header-clip-path)",
        }}
      >
        <Button
          ghost
          onClick={() => setMobileOpen(true)}
          aria-label={t.app.openNavigation}
          aria-expanded={mobileOpen}
          aria-controls="app-sidebar"
          className="text-text-secondary hover:text-midground"
        >
          <Menu />
          {/* R5 item 8: 375 first screen needs a visible Chinese nav entry,
              not an icon-only control whose label hides in the a11y tree. */}
          <span className="text-xs">菜单</span>
        </Button>

        <Typography className="font-bold text-[0.95rem] leading-[0.95] tracking-[0.05em] text-midground">
          {t.app.brand}
        </Typography>
      </header>

      {mobileOpen && (
        <Button
          ghost
          aria-label={t.app.closeNavigation}
          onClick={closeMobile}
          className={cn(
            "lg:hidden fixed inset-0 z-40 p-0 block",
            "bg-black/70",
          )}
        />
      )}

      {/* Single mobile header clearance for the banner stack + content. The
          fixed lg:hidden header is h-14/z-40; previously each banner carried
          its own mt-14 AND the content kept pt-14, so two visible banners
          stacked three offsets (NS-656 review P3). One spacer, applied once. */}
      <div aria-hidden className="h-14 shrink-0 lg:hidden" />
      <PluginSlot name="header-banner" />
      <ProfileScopeBanner />
      <MemoryPressureBanner status={sidebarStatus} />
      <MultiplexStandaloneBanner status={sidebarStatus} />
      <SharedMetricsConsentBanner />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1">
          <aside
            id="app-sidebar"
            aria-label={t.app.navigation}
            className={cn(
              "fixed top-0 left-0 z-50 flex h-dvh max-h-dvh w-64 min-h-0 flex-col font-sans",
              "border-r border-current/20",
              "bg-background-base",
              "transition-[transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
              mobileOpen ? "translate-x-0" : "-translate-x-full",
              "lg:sticky lg:top-0 lg:translate-x-0 lg:shrink-0 lg:overflow-hidden",
              "lg:transition-[width] lg:duration-300 lg:ease-[cubic-bezier(0.23,1,0.32,1)]",
              collapsed && "lg:w-14",
            )}
            style={{
              background:
                "var(--component-sidebar-background, var(--background-base))",
              clipPath: "var(--component-sidebar-clip-path)",
              borderImage: "var(--component-sidebar-border-image)",
            }}
          >
            <div
              className={cn(
                "flex h-14 shrink-0 items-center gap-2",
                "border-b border-current/20",
                collapsed ? "lg:justify-center lg:px-0" : "px-4 justify-between",
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-2",
                  collapsed && "lg:hidden",
                )}
              >
                <PluginSlot name="header-left" />

                <Typography className="font-bold text-[1.125rem] leading-[0.95] tracking-[0.0525rem] text-midground uppercase">
                  Hermes
                  <br />
                  Agent
                </Typography>
              </div>

              <Button
                ghost
                size="icon"
                onClick={closeMobile}
                aria-label={t.app.closeNavigation}
                className="lg:hidden text-text-secondary hover:text-midground"
              >
                <X />
              </Button>

              <Button
                ghost
                size="icon"
                onClick={toggleCollapsed}
                aria-label={
                  collapsed ? t.common.expand : t.common.collapse
                }
                className="hidden lg:flex text-text-secondary hover:text-midground"
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="shrink-0">
              <ProfileSwitcher collapsed={isDesktopCollapsed} />
            </div>

            <nav
              className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden border-t border-current/10 py-2"
              aria-label={t.app.navigation}
            >
              {/* v4 console IA (lane A stage 2): two tiers, 4 groups × 8
                  modules, every anchor carrying data-mod (the second data-mod
                  per module is the page's <section>). The upstream nav below
                  stays as-is: it is the only surface that still points at
                  routes the console tabs do not cover (sessions, files,
                  cron, …), and the plugin tab mechanism must not move. */}
              <ConsoleNav onNavigate={closeMobile} />

              {NAV_GROUP_ORDER.map((group) => {
                const items = sidebarNav.coreItems.filter(
                  (item) => item.group === group,
                );
                if (items.length === 0) return null;
                const heading =
                  t.app.navGroups?.[group] ?? NAV_GROUP_FALLBACK[group];
                return (
                  <div
                    className="flex flex-col pb-2"
                    key={group}
                    role="group"
                    aria-labelledby={`hermes-sidebar-${group}-heading`}
                  >
                    <span
                      className={cn(
                        "px-5 pt-2.5 pb-1",
                        "font-sans text-display text-xs tracking-[0.12em] text-text-tertiary",
                        isDesktopCollapsed && "lg:hidden",
                      )}
                      id={`hermes-sidebar-${group}-heading`}
                    >
                      {heading}
                    </span>
                    <ul className="flex flex-col">
                      {items.map((item) => (
                        <SidebarNavLink
                          closeMobile={closeMobile}
                          collapsed={isDesktopCollapsed}
                          item={item}
                          key={item.path}
                          t={t}
                          tooltipWarmRef={tooltipWarmRef}
                        />
                      ))}
                    </ul>
                  </div>
                );
              })}

              {sidebarNav.pluginItems.length > 0 && (
                <div
                  aria-labelledby="hermes-sidebar-plugin-nav-heading"
                  className="flex flex-col border-t border-current/10 pb-2"
                  role="group"
                >
                  <span
                    className={cn(
                      "px-5 pt-2.5 pb-1",
                      "font-sans text-display text-xs tracking-[0.12em] text-text-tertiary",
                      isDesktopCollapsed && "lg:hidden",
                    )}
                    id="hermes-sidebar-plugin-nav-heading"
                  >
                    {t.app.pluginNavSection}
                  </span>

                  <ul className="flex flex-col">
                    {sidebarNav.pluginItems.map((item) => (
                      <SidebarNavLink
                        closeMobile={closeMobile}
                        collapsed={isDesktopCollapsed}
                        item={item}
                        key={item.path}
                        t={t}
                        tooltipWarmRef={tooltipWarmRef}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </nav>

            <div className="shrink-0">
              <Auth5Session />
              <SidebarSystemActions
                collapsed={isDesktopCollapsed}
                onNavigate={closeMobile}
                status={sidebarStatus}
                tooltipWarmRef={tooltipWarmRef}
              />
            </div>

            <div
              className={cn(
                "flex shrink-0 items-center gap-2",
                "px-3 py-2",
                "border-t border-current/20",
                isDesktopCollapsed
                  ? "lg:flex-col lg:items-start lg:gap-3 lg:py-3"
                  : "justify-between",
              )}
            >
              <div
                className={cn(
                  "flex min-w-0 items-center gap-2",
                  isDesktopCollapsed && "lg:flex-col lg:items-start",
                )}
              >
                <PluginSlot name="header-right" />

                <SidebarIconWithTooltip
                  collapsed={isDesktopCollapsed}
                  label={t.theme?.switchTheme ?? "Switch theme"}
                  tooltipWarmRef={tooltipWarmRef}
                >
                  <ThemeSwitcher collapsed={isDesktopCollapsed} dropUp />
                </SidebarIconWithTooltip>

                <SidebarIconWithTooltip
                  collapsed={isDesktopCollapsed}
                  label={t.language.switchTo}
                  tooltipWarmRef={tooltipWarmRef}
                >
                  <LanguageSwitcher collapsed={isDesktopCollapsed} dropUp />
                </SidebarIconWithTooltip>
              </div>
            </div>

            <div
              className={cn(
                "flex shrink-0 flex-col",
                isDesktopCollapsed && "lg:hidden",
              )}
            >
              <AuthWidget />
              <SidebarFooter status={sidebarStatus} />
            </div>
          </aside>

          <PageHeaderProvider pluginTabs={pluginTabMeta}>
            <div
              className={cn(
                "relative z-2 flex min-w-0 min-h-0 flex-1 flex-col",
                // T42 item 3: 375 safety net — clip any overflowing module
                // body at the shell container so document scrollWidth never
                // exceeds the viewport (page bodies are other lanes' files).
                "overflow-x-hidden",
                "px-3 sm:px-6",
                isChatRoute
                  ? "pb-0 pt-1 sm:pt-2 lg:pt-4"
                  : "pt-2 sm:pt-4 lg:pt-6",
                isDocsRoute && "min-h-0 flex-1",
              )}
            >
              <PluginSlot name="pre-main" />
              <div
                className={cn(
                  "w-full min-w-0",
                  !isChatRoute &&
                    "pb-[calc(2rem+env(safe-area-inset-bottom,0px))] lg:pb-8",
                  (isDocsRoute || isChatRoute) &&
                    "min-h-0 flex flex-1 flex-col",
                )}
              >
                <ProfileKeyedRoutes>
                  <Suspense fallback={<RouteFallback />}>
                    <Routes>
                      {/* v4 console shell routes (M0 lane A stage 2). React
                          Router picks the highest-ranked match, first-in-tree
                          on ties: these front the generic builtin entries for
                          the overlapping paths (/employees, /approvals,
                          /system, /employees/:employeeId) WITHOUT touching
                          BUILTIN_ROUTES_CORE, buildRoutes, or the plugin
                          override plumbing below them. */}
                      <Route
                        path="/overview"
                        element={
                          <ConsoleModulePage
                            module="overview"
                            live={{ duty: <DutyConsolePage />, usage: <UsageConsolePage /> }}
                          />
                        }
                      />
                      <Route
                        path="/work"
                        element={
                          <ConsoleModulePage
                            module="work"
                            live={{ board: <TasksBoardConsolePage />, runs: <RunsConsolePage /> }}
                          />
                        }
                      />
                      <Route
                        path="/identity"
                        element={
                          <ConsoleModulePage
                            module="identity"
                            live={{ people: <PeopleConsolePage />, departments: <OrgConsolePage />, roles: <AccessConsolePage /> }}
                          />
                        }
                      />
                      <Route
                        path="/knowledge"
                        element={
                          <ConsoleModulePage
                            module="knowledge"
                            live={{ evidence: <EvidenceConsolePage />, spaces: <KnowledgeConsolePage /> }}
                          />
                        }
                      />
                      {/* R4 item 3: '/matrix' was NOHOST — it is the matrix
                          tab of the employees module, so it redirects there
                          (mirrors the '#/matrix' REDIRECTS row in routes.ts). */}
                      <Route
                        path="/matrix"
                        element={<Navigate to="/employees?tab=matrix" replace />}
                      />
                      <Route
                        path="/capabilities"
                        element={
                          <ConsoleModulePage
                            module="capabilities"
                            live={{
                              skills: <CapSkillsConsolePage />,
                              tools: <CapToolsConsolePage />,
                              models: <CapModelsConsolePage />,
                              channels: <CapChannelsConsolePage />,
                            }}
                          />
                        }
                      />
                      {!overriddenPaths.has("/employees") && (
                        <Route
                          path="/employees"
                          element={
                            <ConsoleModulePage
                              module="employees"
                              live={{ list: <EmployeesPage />, matrix: <MatrixConsolePage /> }}
                            />
                          }
                        />
                      )}
                      {!overriddenPaths.has("/approvals") && (
                        <Route
                          path="/approvals"
                          element={
                            <ConsoleModulePage
                              module="approvals"
                              live={{
                                pending: <ApprovalsPendingConsolePage />,
                                history: <ApprovalsHistoryConsolePage />,
                              }}
                            />
                          }
                        />
                      )}
                      {!overriddenPaths.has("/system") && (
                        <Route
                          path="/system"
                          element={
                            <ConsoleModulePage
                              module="system"
                              live={{
                                health: <HealthConsolePage />,
                                defaults: <SettingsConsolePage />,
                                version: <VersionConsolePage />,
                                events: <AuditEventsConsolePage />,
                              }}
                            />
                          }
                        />
                      )}
                      {/* R10 item 7: compat routes mirroring the frozen
                          routes.ts table — /audit reaches the /system audit
                          live slot (routes.ts:257), and /channels defers to
                          the V4 capabilities?tab=channels surface (routes.ts:
                          171) instead of the bare upstream English shell.
                          First-in-tree wins, so these front the generic
                          builtin entries without touching the route map. */}
                      <Route
                        path="/audit"
                        element={<Navigate to="/system?tab=events" replace />}
                      />
                      <Route
                        path="/channels"
                        element={<Navigate to="/capabilities?tab=channels" replace />}
                      />
                      {/* R11 item 2: /models renders the gov V4 models module
                        through the same capabilities tab it mirrors in
                        routes.ts (#/capabilities?tab=models), not the upstream
                        page with the raw parse error. */}
                      <Route
                        path="/models"
                        element={<Navigate to="/capabilities?tab=models" replace />}
                      />
                      {/* R15 item 1: /skills renders the gov skills module
                        (skl4-*, real data) through its capabilities tab,
                        mirroring routes.ts — not the upstream English shell. */}
                      <Route
                        path="/skills"
                        element={<Navigate to="/capabilities?tab=skills" replace />}
                      />
                      {/* R15 item 2: /metrics carries the gov metrics module
                        (met5-* heat table) as its own page body, mirroring
                        routes.ts #/metrics without falling to upstream pages. */}
                      <Route
                        path="/metrics"
                        element={<MetricsConsolePage />}
                      />
                      {/* R17 collab: /collab and /collaboration mount the aud
                        delegation page directly (col4-* reaches the screen),
                        and /org lands on the departments view — replacing the
                        old fall-through to /overview. */}
                      {/* R17 auth5: the console sign-in page; the bridge
                        cookie is set by the same-origin /auth/login proxy. */}
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/collab" element={<CollabConsolePage />} />
                      <Route
                        path="/collaboration"
                        element={<CollabConsolePage />}
                      />
                      <Route
                        path="/org"
                        element={
                          <Navigate to="/identity?tab=departments" replace />
                        }
                      />
                      {!overriddenPaths.has("/employees/:employeeId") && (
                        <>
                          <Route
                            path="/employees/:employeeId"
                            element={
                              <ConsoleEmployeeDetailPage
                                fallback={<EmployeeDetailPage />}
                                renderChatHost={renderConsoleChatHost}
                              />
                            }
                          />
                          <Route
                            path="/employees/:employeeId/config"
                            element={
                              <ConsoleEmployeeDetailPage
                                zone="config"
                                fallback={<EmployeeDetailPage />}
                                renderChatHost={renderConsoleChatHost}
                              />
                            }
                          />
                          <Route
                            path="/employees/:employeeId/tasks"
                            element={
                              <ConsoleEmployeeDetailPage
                                zone="tasks"
                                fallback={<EmployeeDetailPage />}
                                renderChatHost={renderConsoleChatHost}
                              />
                            }
                          />
                          <Route
                            path="/employees/:employeeId/runs"
                            element={
                              <ConsoleEmployeeDetailPage
                                zone="runs"
                                fallback={<EmployeeDetailPage />}
                                renderChatHost={renderConsoleChatHost}
                              />
                            }
                          />
                          <Route
                            path="/employees/:employeeId/evidence"
                            element={
                              <ConsoleEmployeeDetailPage
                                zone="evidence"
                                fallback={<EmployeeDetailPage />}
                                renderChatHost={renderConsoleChatHost}
                              />
                            }
                          />
                        </>
                      )}
                      {runsModulePageAvailable() &&
                        !overriddenPaths.has("/runs") && (
                          <Route
                            path="/runs"
                            element={<ConsoleRunsAdapter fallback={<RunsPage />} />}
                          />
                        )}
                      {routes.map(({ key, path, element }) => (
                        <Route key={key} path={path} element={element} />
                      ))}
                      <Route
                        path="*"
                        element={
                          <UnknownRouteFallback pluginsLoading={pluginsLoading} />
                        }
                      />
                    </Routes>
                  </Suspense>
                </ProfileKeyedRoutes>

                {embeddedChat &&
                  !chatOverriddenByPlugin &&
                  (pluginsLoading ? (
                    isChatRoute ? (
                      <RouteFallback label="Loading chat…" />
                    ) : null
                  ) : chatHostMounted ? (
                    <div
                      data-chat-active={isChatRoute ? "true" : "false"}
                      className={cn(
                        "min-h-0 min-w-0",
                        isChatRoute ? "flex flex-1 flex-col" : "hidden",
                      )}
                      aria-hidden={!isChatRoute}
                    >
                      <Suspense
                        fallback={
                          isChatRoute ? (
                            <RouteFallback label="Loading chat…" />
                          ) : null
                        }
                      >
                        <ChatPage isActive={isChatRoute} />
                      </Suspense>
                    </div>
                  ) : isChatRoute ? (
                    <RouteFallback label="Loading chat…" />
                  ) : null)}
              </div>
              <PluginSlot name="post-main" />
            </div>
          </PageHeaderProvider>
        </div>
      </div>

      <PluginSlot name="overlay" />
      <ConsoleFixtureChrome />
    </div>
    </FixtureProvider>
  );
}

/**
 * Remounts the entire routed page tree when the global management profile
 * changes. Pages load their data on mount; without this, a page opened
 * under profile A would keep showing A's state while writes (via the
 * fetchJSON ?profile= injection) silently targeted the newly selected
 * profile B — the exact stale-target footgun the switcher exists to kill.
 * Keying by profile resets every page's local state so it refetches under
 * the new scope. The persistent ChatPage host below handles its own
 * remount (channel keyed on scopedProfile).
 */
function ProfileKeyedRoutes({ children }: { children: ReactNode }) {
  const { profile } = useProfileScope();
  return <div key={profile || "__own__"} className="contents">{children}</div>;
}

function SidebarNavLink({
  closeMobile,
  collapsed,
  item,
  tooltipWarmRef,
  t,
}: SidebarNavLinkProps) {
  const { path, label, labelKey, icon: Icon } = item;
  const [hovered, setHovered] = useState(false);
  const [tooltipAnchor, setTooltipAnchor] = useState<HTMLElement | null>(null);

  const navLabel = labelKey
    ? ((t.app.nav as Record<string, string>)[labelKey] ?? label)
    : label;
  const comingSoon = "未接入";

  // Placeholders are deliberately not links: a future module must not open a
  // blank route, and a disabled <button> would still look like a dead control.
  // A labelled, non-interactive row communicates the intended IA without
  // pretending the surface exists yet.
  if (item.placeholder) {
    return (
      <li>
        <div
          aria-disabled="true"
          className={cn(
            "relative flex flex-col gap-1 px-5 py-2.5",
            "font-sans text-display uppercase text-sm tracking-[0.08em]",
            "text-text-tertiary/70 select-none",
          )}
          data-nav-placeholder={item.path}
          title={`${navLabel} — 未接入：后台数据源尚未提供这块能力，接入后会自动出现在导航里`}
        >
          <span className="flex min-w-0 items-start gap-2">
            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span
              className={cn(
                "min-w-0 flex-1 leading-tight break-words transition-opacity duration-300",
                collapsed ? "lg:opacity-0" : "lg:opacity-100",
              )}
            >
              {navLabel}
            </span>
          </span>
          <span
            className={cn(
              "ml-5 shrink-0 self-start border border-current/20 px-1.5 py-0.5",
              "text-[10px] leading-tight tracking-normal",
              collapsed && "lg:hidden",
            )}
          >
            {comingSoon}
          </span>
        </div>
      </li>
    );
  }

  const showTooltip = (event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    setHovered(true);
    setTooltipAnchor(event.currentTarget);
  };
  const hideTooltip = () => {
    setHovered(false);
    setTooltipAnchor(null);
  };

  return (
    <li
      onMouseEnter={collapsed ? showTooltip : undefined}
      onMouseLeave={collapsed ? hideTooltip : undefined}
    >
      <NavLink
        to={path}
        end={path === "/sessions"}
        onClick={closeMobile}
        aria-label={collapsed ? navLabel : undefined}
        onFocus={collapsed ? showTooltip : undefined}
        onBlur={collapsed ? hideTooltip : undefined}
        className={({ isActive }) =>
          cn(
            "group/nav relative flex items-center gap-3",
            "px-5 py-2.5",
            "font-sans text-display uppercase text-sm tracking-[0.12em]",
            "whitespace-nowrap transition-colors cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-midground",
            isActive
              ? "text-midground"
              : "text-text-secondary hover:text-midground",
          )
        }
        style={{
          clipPath: "var(--component-tab-clip-path)",
        }}
      >
        {({ isActive }) => (
          <>
            <Icon className="h-3.5 w-3.5 shrink-0" />

            <span
              className={cn(
                "truncate transition-opacity duration-300",
                collapsed ? "lg:opacity-0" : "lg:opacity-100",
              )}
            >
              {navLabel}
            </span>

            <span
              aria-hidden
              className="absolute inset-y-0.5 left-1.5 right-1.5 bg-midground opacity-0 pointer-events-none transition-opacity duration-200 group-hover/nav:opacity-5"
            />

            {isActive && (
              <span
                aria-hidden
                className="absolute left-0 top-0 bottom-0 w-px bg-midground"
              />
            )}
          </>
        )}
      </NavLink>

      {collapsed && hovered && tooltipAnchor && (
        <SidebarTooltip anchor={tooltipAnchor} label={navLabel} warmRef={tooltipWarmRef} />
      )}
    </li>
  );
}

/* R17 auth5: sidebar session chip wired to the same-origin /auth bridge
 * (lane D). Anonymous visitors get a real way into /login; signed-in users
 * see who they are and can sign out. Tokens and raw ids never reach screen. */
function Auth5Session(): ReactNode {
  const navigate = useNavigate();
  const [who, setWho] = useState<
    { k: "loading" } | { k: "anon" } | { k: "ok"; display: string; role: string; tenant: string }
  >({ k: "loading" });
  useEffect(() => {
    let alive = true;
    fetch("/auth/whoami", { credentials: "same-origin" })
      .then(async (res) => {
        if (!alive) return;
        if (res.status === 401) {
          setWho({ k: "anon" });
          return;
        }
        const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        if (res.ok && body) {
          const disp =
            typeof body.display === "string" && body.display.trim()
              ? body.display.trim()
              : "未命名账号";
          const role =
            typeof body.granted === "string" && body.granted.trim()
              ? body.granted.trim()
              : "—";
          const tid = typeof body.tenant_id === "string" ? body.tenant_id.trim() : "";
          const tenant = tid && !/^[a-z]+_[0-9A-Za-z]+$/.test(tid) ? tid : "—";
          setWho({ k: "ok", display: disp, role, tenant });
        } else {
          setWho({ k: "anon" });
        }
      })
      .catch(() => {
        if (alive) setWho({ k: "anon" });
      });
    return () => {
      alive = false;
    };
  }, []);
  if (who.k === "loading") {
    return (
      <div
        className="mx-3 mb-2 h-8 animate-pulse rounded-sm bg-white/5"
        data-testid="auth5-widget"
        aria-label="加载中"
      />
    );
  }
  if (who.k === "anon") {
    return (
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
        data-testid="auth5-widget"
      >
        <span className="min-w-0 break-words text-muted-foreground">未登录</span>
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="shrink-0 rounded-sm border border-border px-2 py-1"
          data-testid="auth5-goto-login"
        >
          去登录
        </button>
      </div>
    );
  }
  return (
    <div
      className="flex min-w-0 flex-col gap-1 px-3 py-2 text-xs"
      data-testid="auth5-widget"
    >
      <span className="min-w-0 truncate font-medium" data-testid="auth5-display" title={who.display}>
        {who.display}
      </span>
      <span className="min-w-0 break-words text-muted-foreground" data-testid="auth5-role">
        角色：{who.role}
      </span>
      <span className="min-w-0 break-words text-muted-foreground" data-testid="auth5-tenant">
        租户：{who.tenant}
      </span>
      <button
        type="button"
        className="mt-1 shrink-0 self-start rounded-sm border border-border px-2 py-1"
        data-testid="auth5-logout"
        onClick={() => {
          void fetch("/auth/logout", { method: "POST", credentials: "same-origin" }).finally(() => {
            sessionStorage.removeItem("auth5.session");
            navigate("/login");
          });
        }}
      >
        退出登录
      </button>
    </div>
  );
}

function SidebarSystemActions({
  collapsed,
  onNavigate,
  status,
  tooltipWarmRef,
}: SidebarSystemActionsProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { activeAction, isBusy, isRunning, pendingAction, runAction } =
    useSystemActions();
  const canUpdateHermes = status?.can_update_hermes === true;
  // Served by the shared multiplexer: a restart blips every bot on this device — say which.
  const sharedGateway = sharedGatewayProfiles(status);
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);
  const [updateConfirmOpen, setUpdateConfirmOpen] = useState(false);
  const [updateConfirmInfo, setUpdateConfirmInfo] =
    useState<UpdateCheckResponse | null>(null);
  const [updateConfirmChecking, setUpdateConfirmChecking] = useState(false);

  useEffect(() => {
    if (!updateConfirmOpen) {
      setUpdateConfirmInfo(null);
      return;
    }
    let cancelled = false;
    setUpdateConfirmChecking(true);
    api
      .checkHermesUpdate(false)
      .then((info) => {
        if (!cancelled) setUpdateConfirmInfo(info);
      })
      .catch(() => {
        if (!cancelled) setUpdateConfirmInfo(null);
      })
      .finally(() => {
        if (!cancelled) setUpdateConfirmChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [updateConfirmOpen]);

  const updateConfirmDescription = useMemo(() => {
    if (updateConfirmInfo?.behind && updateConfirmInfo.behind > 0) {
      const cmd = updateConfirmInfo.update_command;
      const n = updateConfirmInfo.behind;
      return `This will run 'hermes update' (${cmd}) and pull ${n} new commit${n === 1 ? "" : "s"}. The gateway restarts when the update finishes; the current session keeps its prompt cache until then.`;
    }
    const cmd = updateConfirmInfo?.update_command ?? "hermes update";
    return (
      t.status.updateHermesConfirmMessage ??
      `This will run 'hermes update' (${cmd}) and restart the gateway when it finishes.`
    );
  }, [t.status.updateHermesConfirmMessage, updateConfirmInfo]);

  const items: SystemActionItem[] = [
    {
      action: "restart",
      icon: RotateCw,
      label: t.status.restartGateway,
      runningLabel: t.status.restartingGateway,
      spin: true,
    },
  ];
  if (canUpdateHermes) {
    items.push({
      action: "update",
      icon: Download,
      label: t.status.updateHermes,
      runningLabel: t.status.updatingHermes,
      spin: false,
    });
  }

  const handleClick = (action: SystemAction) => {
    if (isBusy) return;
    if (action === "restart") {
      setRestartConfirmOpen(true);
      return;
    }
    if (action === "update") {
      setUpdateConfirmOpen(true);
      return;
    }
    void runAction(action);
    navigate("/sessions");
    onNavigate();
  };

  const confirmRestart = () => {
    setRestartConfirmOpen(false);
    void runAction("restart");
    navigate("/sessions");
    onNavigate();
  };

  const confirmUpdate = () => {
    setUpdateConfirmOpen(false);
    void runAction("update");
    navigate("/sessions");
    onNavigate();
  };

  return (
    <>
    <div
      className={cn(
        "shrink-0 flex flex-col",
        "border-t border-current/10",
        "py-1",
      )}
    >
      <span
        className={cn(
          "px-5 pt-0.5 pb-0.5",
          "font-sans text-display text-xs tracking-[0.12em] text-text-tertiary",
          collapsed && "lg:hidden",
        )}
      >
        {t.app.system}
      </span>

      <div className={cn(collapsed && "lg:hidden")}>
        <SidebarStatusStrip status={status} />
      </div>

      <GatewayDot collapsed={collapsed} status={status} tooltipWarmRef={tooltipWarmRef} />

      <ul className="flex flex-col">
        {items.map((item) => (
          <SystemActionButton
            key={item.action}
            collapsed={collapsed}
            disabled={isBusy && !(pendingAction === item.action || (activeAction === item.action && isRunning))}
            tooltipWarmRef={tooltipWarmRef}
            isPending={pendingAction === item.action}
            isRunning={activeAction === item.action && isRunning && pendingAction !== item.action}
            item={item}
            onClick={() => handleClick(item.action)}
          />
        ))}
      </ul>
    </div>

    <ConfirmDialog
      cancelLabel={t.common.cancel}
      confirmLabel={sharedGateway ? "Restart all" : t.status.restartGateway}
      description={
        sharedGateway
          ? sharedGatewayRestartDescription(sharedGateway)
          : (t.status.restartGatewayConfirmMessage ??
            "This restarts the Hermes gateway process. Connected channels and active sessions will reconnect afterward.")
      }
      loading={pendingAction === "restart"}
      onCancel={() => setRestartConfirmOpen(false)}
      onConfirm={confirmRestart}
      open={restartConfirmOpen}
      title={
        sharedGateway
          ? "Restart the shared gateway?"
          : (t.status.restartGatewayConfirmTitle ?? `${t.status.restartGateway}?`)
      }
    />

    <ConfirmDialog
      cancelLabel={t.common.cancel}
      confirmLabel={t.status.updateHermesConfirmNow ?? "Update now"}
      description={
        updateConfirmChecking ? t.common.loading : updateConfirmDescription
      }
      loading={pendingAction === "update" || updateConfirmChecking}
      onCancel={() => setUpdateConfirmOpen(false)}
      onConfirm={confirmUpdate}
      open={updateConfirmOpen}
      title={t.status.updateHermesConfirmTitle ?? `${t.status.updateHermes}?`}
    />
    </>
  );
}

function SystemActionButton({
  collapsed, // R4 B9: callers still pass `disabled`, intentionally unused — the button is inert (data-planned) regardless.
  isPending,
  isRunning: isActionRunning,
  item,
  onClick,
  tooltipWarmRef,
}: SystemActionButtonProps) {
  const { icon: Icon, label, runningLabel, spin } = item;
  const [hovered, setHovered] = useState(false);
  const [tooltipAnchor, setTooltipAnchor] = useState<HTMLElement | null>(null);
  const busy = isPending || isActionRunning;
  const displayLabel = isActionRunning ? runningLabel : label;
  const showTooltip = (event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    setHovered(true);
    setTooltipAnchor(event.currentTarget);
  };
  const hideTooltip = () => {
    setHovered(false);
    setTooltipAnchor(null);
  };

  return (
    <li
      onMouseEnter={collapsed ? showTooltip : undefined}
      onMouseLeave={collapsed ? hideTooltip : undefined}
    >
      <button
        onClick={onClick}
        disabled
        aria-disabled="true"
        data-planned="规划中：系统动作暂不由控制台代发"
        aria-busy={busy}
        aria-label={collapsed ? displayLabel : undefined}
        onFocus={collapsed ? showTooltip : undefined}
        onBlur={collapsed ? hideTooltip : undefined}
        type="button"
        className={cn(
          "group/action relative flex w-full items-center gap-3",
          "px-5 py-2.5",
          "font-sans text-display text-xs tracking-[0.1em]",
          "whitespace-nowrap transition-colors cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-midground",
          busy
            ? "text-midground"
            : "text-text-secondary hover:text-midground",
          "disabled:text-text-disabled disabled:cursor-not-allowed",
        )}
      >
        {isPending ? (
          <Spinner className="shrink-0 text-[0.875rem]" />
        ) : isActionRunning && spin ? (
          <Spinner className="shrink-0 text-[0.875rem]" />
        ) : (
          <Icon
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              isActionRunning && !spin && "animate-pulse",
            )}
          />
        )}

        <span className={cn(
          "truncate transition-opacity duration-300",
          collapsed ? "lg:opacity-0" : "lg:opacity-100",
        )}>
          {displayLabel}
        </span>

        {/* R14 item 2: the honest explanation is visible, not just an
          * attribute — this control is inert by design (B9 preserved). */}
        <span
          className="ml-auto shrink-0 text-[0.625rem] text-text-tertiary"
          title="规划中：系统动作暂不由控制台代发"
        >
          规划中
        </span>

        <span
          aria-hidden
          className="absolute inset-y-0.5 left-1.5 right-1.5 bg-midground opacity-0 pointer-events-none transition-opacity duration-200 group-hover/action:opacity-5"
        />

        {busy && (
          <span
            aria-hidden
            className="absolute left-0 top-0 bottom-0 w-px bg-midground"
          />
        )}
      </button>

      {collapsed && hovered && tooltipAnchor && (
        <SidebarTooltip anchor={tooltipAnchor} label={displayLabel} warmRef={tooltipWarmRef} />
      )}
    </li>
  );
}

function SidebarIconWithTooltip({
  children,
  collapsed,
  label,
  tooltipWarmRef,
}: SidebarIconWithTooltipProps) {
  const [hovered, setHovered] = useState(false);
  const [tooltipAnchor, setTooltipAnchor] = useState<HTMLElement | null>(null);
  const showTooltip = (event: MouseEvent<HTMLDivElement>) => {
    setHovered(true);
    setTooltipAnchor(event.currentTarget);
  };
  const hideTooltip = () => {
    setHovered(false);
    setTooltipAnchor(null);
  };

  return (
    <div
      className={cn(
        "relative w-fit",
        collapsed && "group/icon",
      )}
      onMouseEnter={collapsed ? showTooltip : undefined}
      onMouseLeave={collapsed ? hideTooltip : undefined}
    >
      {children}

      {collapsed && (
        <span
          aria-hidden
          className="absolute inset-y-0 inset-x-[-0.375rem] bg-midground opacity-0 pointer-events-none transition-opacity duration-200 group-hover/icon:opacity-5 hidden lg:block"
        />
      )}

      {collapsed && hovered && tooltipAnchor && (
        <SidebarTooltip anchor={tooltipAnchor} label={label} warmRef={tooltipWarmRef} />
      )}
    </div>
  );
}

function GatewayDot({ collapsed, status, tooltipWarmRef }: GatewayDotProps) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(false);
  const [tooltipAnchor, setTooltipAnchor] = useState<HTMLElement | null>(null);

  const toneToColor: Record<string, string> = {
    "text-success": "bg-success",
    "text-warning": "bg-warning",
    "text-destructive": "bg-destructive",
    "text-muted-foreground": "bg-muted-foreground",
  };

  let color: string;
  let label: string;

  if (!status) {
    color = "bg-midground/20";
    label = t.status.gateway;
  } else {
    const gw = gatewayLine(status, t);
    color = toneToColor[gw.tone] ?? "bg-muted-foreground";
    label = `${t.status.gateway} ${gw.label}`;
  }
  const showTooltip = (event: MouseEvent<HTMLDivElement> | FocusEvent<HTMLDivElement>) => {
    setHovered(true);
    setTooltipAnchor(event.currentTarget);
  };
  const hideTooltip = () => {
    setHovered(false);
    setTooltipAnchor(null);
  };

  return (
    <div
      className={cn(
        "hidden lg:flex py-3 pl-[1.625rem] transition-opacity duration-300",
        collapsed ? "lg:opacity-100" : "lg:opacity-0 lg:h-0 lg:py-0 lg:overflow-hidden",
      )}
      role="status"
      aria-label={label}
      tabIndex={collapsed ? 0 : -1}
      onMouseEnter={collapsed ? showTooltip : undefined}
      onMouseLeave={collapsed ? hideTooltip : undefined}
      onFocus={collapsed ? showTooltip : undefined}
      onBlur={collapsed ? hideTooltip : undefined}
    >
      <span
        aria-hidden
        className={cn("h-1.5 w-1.5 rounded-full", color)}
      />

      {hovered && tooltipAnchor && (
        <SidebarTooltip anchor={tooltipAnchor} label={label} warmRef={tooltipWarmRef} />
      )}
    </div>
  );
}

function SidebarTooltip({ anchor, label, warmRef }: SidebarTooltipProps) {
  const rect = anchor.getBoundingClientRect();
  const sidebar = document.getElementById("app-sidebar");
  const sidebarRight = sidebar?.getBoundingClientRect().right ?? rect.right;
  const [isWarm, setIsWarm] = useState(false);

  useEffect(() => {
    if (!warmRef) {
      setIsWarm(false);
      return;
    }
    const now = Date.now();
    setIsWarm(now - warmRef.current < 300);
    warmRef.current = now;
    return () => {
      if (warmRef) warmRef.current = Date.now();
    };
  }, [warmRef]);

  return createPortal(
    <span
      className={cn(
        "fixed z-[100] pointer-events-none",
        "px-2 py-1",
        "bg-background-base border border-current/20 shadow-lg",
        "font-sans text-display text-xs tracking-[0.1em] text-midground uppercase",
      )}
      style={{
        top: rect.top + rect.height / 2,
        left: sidebarRight + 8,
        transform: "translateY(-50%)",
        opacity: isWarm ? 1 : undefined,
        animation: isWarm ? "none" : "sidebar-tooltip-in 120ms ease-out",
      }}
    >
      {label}
    </span>,
    document.body,
  );
}

type TooltipWarmRef = React.RefObject<number>;

interface GatewayDotProps {
  collapsed: boolean;
  status: StatusResponse | null;
  tooltipWarmRef: TooltipWarmRef;
}

interface NavItem {
  icon: ComponentType<{ className?: string }>;
  label: string;
  labelKey?: string;
  path: string;
  group?: NavGroupKey;
  placeholder?: boolean;
}

interface SidebarIconWithTooltipProps {
  children: ReactNode;
  collapsed: boolean;
  label: string;
  tooltipWarmRef: TooltipWarmRef;
}

interface SidebarNavLinkProps {
  closeMobile: () => void;
  collapsed: boolean;
  item: NavItem;
  t: Translations;
  tooltipWarmRef: TooltipWarmRef;
}

interface SidebarSystemActionsProps {
  collapsed: boolean;
  onNavigate: () => void;
  status: StatusResponse | null;
  tooltipWarmRef: TooltipWarmRef;
}

interface SidebarTooltipProps {
  anchor: HTMLElement;
  label: string;
  warmRef?: TooltipWarmRef;
}

interface SystemActionButtonProps {
  collapsed: boolean;
  disabled: boolean;
  isPending: boolean;
  isRunning: boolean;
  item: SystemActionItem;
  onClick: () => void;
  tooltipWarmRef: TooltipWarmRef;
}

interface SystemActionItem {
  action: SystemAction;
  icon: ComponentType<{ className?: string }>;
  label: string;
  runningLabel: string;
  spin: boolean;
}
