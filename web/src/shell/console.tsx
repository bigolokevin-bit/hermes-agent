/**
 * Console shell components — stage 2 (M0 lane A, shell-alignment).
 *
 * Turns the frozen appendix-A data (`./routes`), the pane registry
 * (`./registry`) and the pure bridge (`./bridge`) into the live console
 * surfaces of the hermes fork:
 *
 *  - `ConsoleNav`                — two-tier sidebar nav: 4 groups (运营4/
 *    治理2/平台1/系统1) hanging the 8 modules; every module anchor carries
 *    `data-mod`; each console page paints all 8 module `<section>`s
 *    (one live + seven inert hidden stubs) so `data-mod` is exactly ×2 per
 *    module on every console route.
 *  - `ConsoleModulePage`         — module chrome: heading + tab strip over
 *    the module's visible tabs + the ACTIVE pane (data-tab / data-tabname /
 *    data-src / data-state). Tabs the App hands a live node for (reuse rows,
 *    PRD §3 上游复用) render that upstream page inside the pane — composed,
 *    never rewritten. Everything else is an honest 规划中 placeholder with
 *    `[data-planned]` + `aria-disabled` — no blank dead links.
 *  - `ConsoleEmployeeDetailPage` — the hidden 23rd pane (详情, data-hidetab)
 *    with the five-zone strip. Bare/non-workbench zones resolve content via
 *    the B/C existence probe and fall back to the existing
 *    EmployeeDetailPage. The explicit `?zone=workbench` form (incl. the
 *    ZONE_ALIAS overview/chat spellings) renders the lane-A 60/40 workbench
 *    whose left cell carries the ONLY chat-host marker; the element with
 *    that attribute is supplied by App (renderChatHost) so the marker
 *    literal stays outside shell/ and modules/ — assert-ia's react scan
 *    counts those trees, where ChatModulePage's own host mount is the one
 *    counted host.
 *  - roView auditor view (`?roview=1`): system·defaults and
 *    capabilities·models serve a whole-pane 403 + request number (§7 全局).
 *  - `?state=loading|empty|error|denied` pane forcing (§8.1-3, M0 预埋).
 *
 * Write domain (PRD §9.1: src/shell/** owned by lane A): this file receives
 * upstream pages ONLY as App-provided ReactNodes; the single static module
 * import is the lane-A workbench placeholder.
 */

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useParams, useSearchParams } from "react-router";
import {
  CONSOLE_MODULES,
  CONSOLE_TABS,
  DETAIL_TAB,
  PANEL_TABS,
  pathFor,
  resolveTab,
  type ConsoleModule,
  type ConsoleRoute,
  type DetailZone,
} from "./routes";
import { allTabs } from "./registry";
import {
  DetailModulePage,
  RunsModulePage,
  searchFor,
} from "./bridge";
import {
  FixtureBadge,
  applyFixtureAttribute,
  parseFixtureRid,
  parseFixtureState,
  useFixtureState,
} from "./fixtures";
import EmployeeDetailWorkbench from "../modules/employee-detail/EmployeeDetailWorkbench";
import { useSidebarBadges, type SidebarBadges } from "./sidebar-data";
import { CONSOLE_MODULE_ICONS } from "./ConsoleNavIcons";
import { ConsoleButton } from "./ConsoleButton";
import { StatePlaceholder } from "./StatePlaceholder";
import "./console-nav.css";
import "./console-chrome.css";
import "../styles/table-density.css";
import "../styles/detail.css";
import { copyTextToClipboard } from "@/lib/clipboard";

/* ------------------------------------------------------------------ *
 * Fixture-mechanism integration (T03-CONTRACT.md, lines 1-2)
 * ------------------------------------------------------------------ */

/**
 * Mounted once inside `FixtureProvider` in App: mirrors the URL override on
 * `<html data-fixture>` and renders the bottom-right FIXTURE badge. Panes
 * additionally read the per-view `?state=` themselves (search wins over the
 * context value, matching the contract's per-view-over-global precedence).
 */
export function ConsoleFixtureChrome(): ReactNode {
  // react-router pushState navigations fire neither popstate nor hashchange
  // (T03-CONTRACT caveat), and the bridge lands the in-hash ?state= onto the
  // canonical search — so inside the Router the location itself is the
  // freshest source. Feed the mirror + badge from it; the provider context
  // still serves non-router consumers (live hash edits, manual resets).
  const { search } = useLocation();
  const override = parseFixtureState(search, window.location.hash);
  useEffect(() => {
    applyFixtureAttribute(document.documentElement, override);
  }, [override]);
  return <FixtureBadge state={override} />;
}

/** `?state=` value: the per-view search param wins (reliable across every
 * router navigation; pushState fires no popstate/hashchange), else the
 * FixtureProvider context (global window.search switch or pre-bridge hash
 * form). `ready`/absent → no forcing. `denied` is the §8.1-3 auditor extra
 * beyond the fixture primitive's four states. */
type PaneForced = "loading" | "empty" | "error" | "denied";

function isPaneForced(value: string): value is PaneForced {
  return value === "loading" || value === "empty" || value === "error" || value === "denied";
}

function usePaneForced(): PaneForced | null {
  const [sp] = useSearchParams();
  const { override } = useFixtureState();
  const fromSearch = (sp.get("state") ?? "").trim().toLowerCase();
  if (fromSearch !== "" && isPaneForced(fromSearch)) return fromSearch;
  return override !== null && override !== "ready" && isPaneForced(override)
    ? override
    : null;
}

function usePaneRid(): string | null {
  const [sp] = useSearchParams();
  const { search } = useLocation();
  return (sp.get("rid") ?? "").trim() || parseFixtureRid(search, window.location.hash);
}

/* ------------------------------------------------------------------ *
 * Pane source helpers
 * ------------------------------------------------------------------ */

/** Lane-A registry panes marked `kind:'planned'` (duty/matrix/board/runs
 * manifests) — the honest placeholder copy comes from the manifest
 * dataSource, keeping registry and shell in sync. */
function registryPlanned(tabId: string): string | null {
  for (const entry of allTabs()) {
    if (entry.id === tabId && entry.kind === "planned") return entry.dataSource;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Chrome pieces
 * ------------------------------------------------------------------ */

/* The chrome triad (face / border / text) that used to live in one shared
 * inline-style object is now `.console-state-frame` and friends in
 * ./console-chrome.css.
 * Same tokens, same computed face: the -ls aliases and the UI-A semantic names
 * this file used to grab resolve to the identical frozen skeleton vars
 * (--color-surface-ls and --color-surface are both var(--panel), and so on
 * for --panel-2 / --fg / --fg-2 / --line / --line-2 / --bad). */

/* R4 item 5: the shell has no backend trace id to show in forced states —
 * a fabricated req_xxxx placeholder was worse than none. Honest wording
 * replaces it everywhere (真实 trace-id 由数据层透出时另行渲染). */
const NO_TRACE_COPY = "本次请求未记录编号，可复制时间与操作路径反馈";

/* T42 item 1: every forced-state block must offer a real exit — 重试 reloads
 * the page, 返回 walks the history back. The exits are shell-local
 * ConsoleButtons (二级 描边), keeping the R7.1 zero-UI-import discipline and
 * dropping the display-face tracking the DS button would have added. */
function StateActions({ retry }: { retry: boolean }) {
  return (
    <span className="mt-2 flex flex-wrap items-center justify-center gap-2">
      {retry ? (
        <ConsoleButton
          variant="secondary"
          size="sm"
          data-testid="state-retry"
          onClick={() => window.location.reload()}
        >
          重试
        </ConsoleButton>
      ) : null}
      <ConsoleButton
        variant="secondary"
        size="sm"
        data-testid="state-back"
        onClick={() => window.history.back()}
      >
        返回
      </ConsoleButton>
    </span>
  );
}

function StateRid({ rid }: { rid: string | null }) {
  const [copied, setCopied] = useState(false);
  if (rid === null) {
    return (
      <span data-testid="state-rid-fallback" className="console-note text-xs">
        {NO_TRACE_COPY}
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center justify-center gap-2 text-xs" data-testid="state-rid-line">
      <span className="console-note">请求编号：</span>
      <code data-testid="state-rid" className="console-rid font-mono">
        {rid}
      </code>
      <ConsoleButton
        variant="ghost"
        size="sm"
        data-testid="state-rid-copy"
        onClick={() => {
          void copyTextToClipboard(rid).then(setCopied);
        }}
        className="px-2 py-1 text-xs"
      >
        {copied ? "已复制" : "复制"}
      </ConsoleButton>
    </span>
  );
}

function StateBlock({ state, rid }: { state: PaneForced; rid?: string | null }) {
  const frame = {
    className:
      "console-state-frame flex min-h-[12rem] flex-col items-center justify-center gap-2 p-6 text-sm",
  };
  if (state === "loading") {
    return (
      <div role="status" aria-live="polite" {...frame}>
        <span>加载中…</span>
        <span className="console-note text-xs">
          强制态：?state=loading
        </span>
        {/* 设计车道 ④：loading 帧给骨架，Suspense 落点不再是一屏一句话。 */}
        <StatePlaceholder rows={4} />
        <StateActions retry={false} />
      </div>
    );
  }
  if (state === "empty") {
    return (
      <div role="status" aria-live="polite" {...frame}>
        <span>暂无数据</span>
        <span className="console-note text-xs">
          强制态：?state=empty（不伪造样例数据）
        </span>
        {/* 设计车道 ④：空帧的占位条只说「这里本该有行」，不伪造内容。 */}
        <StatePlaceholder />
        <StateActions retry={false} />
      </div>
    );
  }
  if (state === "error") {
    return (
      <div role="status" aria-live="polite" {...frame}>
        <span className="console-state-error">加载失败</span>
        <StateRid rid={rid ?? null} />
        <span className="console-note text-xs">
          强制态：?state=error
        </span>
        {/* 设计车道 ④：错帧也留骨架位，重试后画面不跳版。 */}
        <StatePlaceholder />
        <StateActions retry />
      </div>
    );
  }
  return (
    <div role="status" aria-live="polite" {...frame}>
      <span className="font-mono text-lg">403</span>
      <span>无权限或未开放（403 与 404 同一整页文案）</span>
      <StateRid rid={rid ?? null} />
      <span className="console-note text-xs">
        强制态：?state=denied
      </span>
      {/* 设计车道 ④：denied 帧同样留占位条，画面不是一屏一句话。 */}
      <StatePlaceholder />
      <StateActions retry />
    </div>
  );
}

/** roView auditor view: whole-page 403 + 请求号 (§7 全局; skeleton
 * L7692-7700). 403 and 404 share one body (§8.1-3). */
function AuditorDeniedBlock() {
  return (
    <div
      role="status"
      aria-live="polite"
      data-state="denied"
      className="console-state-frame flex min-h-[16rem] flex-col items-center justify-center gap-2 p-6 text-sm"
    >
      <span className="font-mono text-2xl">403</span>
      <span>无权访问 · 只读审计员视角</span>
      <span className="console-note text-xs">
        {NO_TRACE_COPY} · 只读审计员视角
      </span>
      <span className="console-note text-xs">
        审计员（roView）不可进入 defaults/models 的写入面；退出视角请移除 ?roview=1。
      </span>
      {/* 设计车道 ④：整页 403 也铺占位条（min-h-16rem 不该空到一屏一句）。 */}
      <StatePlaceholder rows={4} />
      <StateActions retry={false} />
    </div>
  );
}

/** Honest placeholder for every tab whose data source is not live yet
 * (写侧「规划中」 vocabulary, PRD §3; `[data-planned]` disabled per §3/§7). */
function PlannedBlock({ entry }: { entry: ConsoleRoute }) {
  const source = registryPlanned(entry.tabId) ?? entry.dataSource;
  const gapNote = entry.planned
    ? "数据源未落地——接入前保持本占位，不伪造数据。"
    : "上游页面尚未接入本壳——接入前保持本占位，不留空白死链。";
  const gapRef = entry.planned ? "GAP 清单 §6/§12" : "复用映射 §3";
  return (
    <div
      data-planned={`规划中：${source}`}
      aria-disabled="true"
      role="status"
      aria-live="polite"
      className="console-state-frame is-not-allowed flex min-h-[12rem] flex-col items-start justify-center gap-2 rounded-[var(--radius-2)] border p-6 text-sm"
    >
      <span className="text-base">{entry.label} · 规划中</span>
      <span className="console-note" title={gapRef}>{gapNote}</span>
      <span className="console-note font-mono text-xs">
        数据来源：{source}
      </span>
      {/* R13 item 2: a real exit so the honest placeholder is never a dead end. */}
      <Link
        to="/overview"
        className="console-note is-link text-xs underline underline-offset-2"
      >
        返回值班台
      </Link>
    </div>
  );
}

/** roView denied targets (§7): system·defaults and capabilities·models. */
function auditorDenied(entry: ConsoleRoute, roView: boolean): boolean {
  if (!roView) return false;
  return (
    (entry.module === "system" && entry.tabId === "defaults") ||
    (entry.module === "capabilities" && entry.tabId === "models")
  );
}

interface ConsolePaneProps {
  entry: ConsoleRoute;
  liveNode?: ReactNode;
  forced: PaneForced | null;
  rid: string | null;
  roView: boolean;
}

function ConsolePane({ entry, liveNode, forced, rid, roView }: ConsolePaneProps) {
  const denied = auditorDenied(entry, roView);
  const stateAttr =
    forced ?? (denied ? "denied" : liveNode !== undefined ? "ready" : "empty");
  return (
    <div
      className="pane min-w-0 flex-1"
      data-tab={entry.tabId}
      data-tabname={entry.label}
      data-src={entry.dataSource}
      data-state={stateAttr}
    >
      {forced !== null ? (
        <StateBlock state={forced} rid={rid} />
      ) : denied ? (
        <AuditorDeniedBlock />
      ) : liveNode !== undefined ? (
        liveNode
      ) : (
        <PlannedBlock entry={entry} />
      )}
    </div>
  );
}

/** Every console route paints all 8 module sections so each `data-mod`
 * appears exactly twice per page (nav anchor + section), skeleton parity.
 * Only the active module carries content; the rest are inert hidden stubs. */
function ConsoleModulesFrame({
  activeModule,
  children,
  pageTestId,
}: {
  activeModule: ConsoleModule;
  children: ReactNode;
  pageTestId?: string;
}) {
  return (
    <>
      {CONSOLE_MODULES.map((meta) =>
        meta.module === activeModule ? (
          <section
            key={meta.module}
            data-mod={meta.module}
            data-testid={pageTestId}
            className="flex min-h-0 flex-1 flex-col gap-3"
          >
            {children}
          </section>
        ) : (
          <section key={meta.module} data-mod={meta.module} hidden aria-hidden />
        ),
      )}
    </>
  );
}

// n5: ONE preserve rule for every console link, outer tab strip and detail zone
// strip alike (three leaks of this class already shipped: P0 n1 stamped panel
// on every outer tab, n2 then dropped it from the tab that owns it, n4 found the
// same leak on the zone leg). Keeping the rule in one function is what stops a
// fourth: a new link family calls `linkSearch` and inherits the table below.
//
// Structural keys (tab/view/zone) are each strip's own addressing — they never
// ride along. `panel` addresses an inner panel of one knowledge tab, so it is
// re-attached only by the link that owns it (the active outer tab); no detail
// zone owns it, so the zone family passes ownsPanel=false. Everything else —
// state, rid, roview and module business params — survives on every link,
// because both panes read them through usePaneForced/usePaneRid.
const STRUCTURAL_KEYS: readonly string[] = ["tab", "view", "zone"];

function splitPreserve(sp: URLSearchParams): {
  preserve: Record<string, string>;
  panel: string | null;
} {
  const keep: Record<string, string> = {};
  let panelValue: string | null = null;
  for (const [key, value] of sp.entries()) {
    if (key === "panel") {
      panelValue = value;
      continue;
    }
    if (!STRUCTURAL_KEYS.includes(key)) keep[key] = value;
  }
  return { preserve: keep, panel: panelValue };
}

function linkSearch(
  sp: URLSearchParams,
  tab: string,
  view: string,
  zone: string,
  ownsPanel: boolean,
): string {
  const { preserve, panel } = splitPreserve(sp);
  return searchFor(
    tab,
    view,
    zone,
    ownsPanel && panel ? { ...preserve, panel } : preserve,
  );
}

function ConsoleTabStrip({
  module,
  activeTabId,
}: {
  module: ConsoleModule;
  activeTabId: string;
}) {
  const tabs = useMemo(
    () => CONSOLE_TABS.filter((t) => t.module === module),
    [module],
  );
  const [sp] = useSearchParams();
  return (
    <div
      role="tablist"
      aria-label={`${module} 控制台 Tab`}
      className="console-tablist flex min-w-0 border-b"
    >
      {tabs.map((tab) => {
        const active = tab.tabId === activeTabId;
        // n5: owning tab keeps its panel; see linkSearch.
        const to = {
          pathname: pathFor(tab),
          search: linkSearch(sp, tab.tab ?? "", "", "", active),
        };
        return (
          <NavLink
            key={tab.tabId}
            to={to}
            role="tab"
            aria-selected={active}
            data-tab={tab.tabId}
            className="console-tab no-underline"
          >
            {tab.label}
          </NavLink>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Console module page (overview/work/identity/knowledge/capabilities/
 * system + the route-level employees/approvals/system adapters)
 * ------------------------------------------------------------------ */

export interface ConsoleModulePageProps {
  module: ConsoleModule;
  /** tabId → live node. App composes upstream pages here (never edits them). */
  live?: Readonly<Record<string, ReactNode>>;
}

export function ConsoleModulePage({ module, live }: ConsoleModulePageProps) {
  const [sp] = useSearchParams();
  const tabs = useMemo(
    () => CONSOLE_TABS.filter((t) => t.module === module),
    [module],
  );
  const requested = sp.get("tab") ?? "";
  const resolved =
    requested === ""
      ? { tab: tabs[0]?.tabId ?? "", view: "" }
      : resolveTab(module, requested);
  // UX r7 判词① (secondary landing): the strip's aria-selected tab and the pane
  // must both follow the surface that is ACTUALLY rendered. A `?panel=` address
  // selects an inner panel of one outer tab, and routes.PANEL_TABS (derived from
  // the compat rows) declares which tab owns it. The knowledge module rewrites
  // cold-start `?tab=sources|ingest` onto `?tab=spaces&panel=ingest`, so a
  // `tab`-only reading highlighted 知识空间 while the content was 数据接入 —
  // a dead-end highlight for the primary task. Honouring the panel owner first
  // makes the highlight agree with the content regardless of whether the module
  // keeps its rewrite (the main fix lives in UI-KD's manifest.ts, not here).
  // Unknown or absent panels fall back to `resolved.tab`, so every address that
  // does not carry a declared panel behaves exactly as before, and the strip and
  // the pane keep sharing this single `active` value by construction.
  const panelReq = sp.get("panel");
  const panelOwner = panelReq ? PANEL_TABS[module]?.[panelReq] : undefined;
  const active = tabs.find((t) => t.tabId === (panelOwner ?? resolved.tab)) ?? tabs[0];
  const meta = CONSOLE_MODULES.find((m) => m.module === module);
  const forced = usePaneForced();
  const rid = usePaneRid();
  const roView = sp.get("roview") === "1";

  if (active === undefined || meta === undefined) return null;

  // R32 item 2: page-level anchors for the route-level adapters. /employees,
  // /approvals and the matrix tab each answer to one stable id that route
  // probes can hit alongside the module data-mod.
  const pageTestId =
    module === "approvals"
      ? "apr5-page"
      : module === "employees"
        ? active.tabId === "matrix"
          ? "mtx5-page"
          : "emp-l-page"
        : undefined;

  return (
    <ConsoleModulesFrame activeModule={module} pageTestId={pageTestId}>
      {/* n17 (UI-SHELL): the module breadcrumb and page title moved
         to shell/TopBar.tsx — the gate counts one h1 app-wide and it must
         live in the top bar, not in main. */}
      {roView && auditorDenied(active, true) ? null : (
        <ConsoleTabStrip module={module} activeTabId={active.tabId} />
      )}
      <ConsolePane
        entry={active}
        liveNode={live?.[active.tabId]}
        forced={forced}
        rid={rid}
        roView={roView}
      />
    </ConsoleModulesFrame>
  );
}

/* ------------------------------------------------------------------ *
 * Employee detail (hidden 23rd pane, five zones)
 * ------------------------------------------------------------------ */

const ZONE_ORDER: readonly DetailZone[] = [
  "workbench",
  "config",
  "tasks",
  "runs",
  "evidence",
];

const ZONE_LABELS: Record<DetailZone, string> = {
  workbench: "工作台",
  config: "配置",
  tasks: "任务",
  runs: "运行",
  evidence: "证据",
};

export interface ConsoleEmployeeDetailPageProps {
  /** Element for the existing upstream EmployeeDetailPage (fallback). */
  fallback: ReactNode;
  /** Explicit zone for the segment routes /employees/:employeeId/<zone>. */
  zone?: DetailZone;
  /** App renders the only chat host element here (the attribute literal
   * lives in App.tsx, outside the assert-ia scan). */
  renderChatHost?: (employeeId: string) => ReactNode;
}

/** `?zone=` 词 → 外壳 zone 条上应该亮着的那一格（族归位）。
 * 裸地址=工作台；能力与权限归「配置」；审批/审计归「证据」；
 * 成本归「运行」；任务列表归「任务」；未知词不亮任何一格。 */
function stripZoneOf(raw: string): DetailZone | null {
  switch (raw) {
    case "":
    case "workbench":
      return "workbench";
    case "config":
    case "capability":
      return "config";
    case "tasks":
    case "tasklist":
      return "tasks";
    case "runs":
    case "usage":
      return "runs";
    case "evidence":
    case "audit":
    case "approvals":
      return "evidence";
    default:
      return null;
  }
}

export function ConsoleEmployeeDetailPage({
  fallback,
  zone,
  renderChatHost,
}: ConsoleEmployeeDetailPageProps) {
  const params = useParams<{ employeeId: string }>();
  const employeeId = params.employeeId ? decodeURIComponent(params.employeeId) : "";
  const [sp] = useSearchParams();
  const zoneQuery = sp.get("zone") ?? "";
  const forced = usePaneForced();
  const rid = usePaneRid();

  // Bare /employees/:employeeId keeps the live surface (probe or existing
  // page) — stage-2 brief 5 fallback. The lane-A workbench (chat host +
  // rail) serves the EXPLICIT workbench forms (?zone=workbench plus the
  // ZONE_ALIAS overview/chat spellings).
  // 2026-11-24: 员工详情默认就是工作台（左侧 Hermes 原生对话），
  // 档案/任职/权限/活动/运行/证据 五区仍由上方 zone 条切换。
  // 裸路由此前落到 DetailModulePage，导致「对话」整块消失（用户实机投诉）。
  // 只有完全不带 ?zone= 的裸地址才是工作台；显式 ?zone=<分区>（含
  // ?zone=workbench）一律交给模块页，避免工作台与分区视图互相顶替。
  const showWorkbench = zone === undefined && zoneQuery === "";

  const detailContent: ReactNode = showWorkbench ? (
    <EmployeeDetailWorkbench
      employeeId={employeeId}
      renderChatHost={renderChatHost}
    />
  ) : DetailModulePage ? (
    <Suspense fallback={<StateBlock state="loading" />}>
      <DetailModulePage employeeId={employeeId} />
    </Suspense>
  ) : (
    fallback
  );

  const zoneHref = (z: DetailZone): { pathname: string; search: string } => ({
    pathname: `/employees/${encodeURIComponent(employeeId || "_")}`,
    // n5: same rule as the outer strip; no zone owns ?panel= so ownsPanel=false.
    search: linkSearch(sp, "", "", z, false),
  });

  return (
    <ConsoleModulesFrame activeModule="employees">
      <div
        role="tablist"
        aria-label="员工详情分区"
        className="console-tablist flex min-w-0 border-b"
      >
        {ZONE_ORDER.map((z) => {
          // 显式分区路由（zone prop）优先；否则按 ?zone= 词归位，
          // 裸地址亮「工作台」。
          const activeZone = (zone ?? stripZoneOf(zoneQuery)) === z;
          return (
            <NavLink
              key={z}
              to={zoneHref(z)}
              role="tab"
              aria-selected={activeZone}
              data-zone={z}
              className="console-tab no-underline"
            >
              {ZONE_LABELS[z]}
            </NavLink>
          );
        })}
      </div>
      <div
        className="pane min-w-0 flex-1"
        data-tab={DETAIL_TAB.tabId}
        data-tabname={DETAIL_TAB.label}
        data-hidetab="1"
        data-src={DETAIL_TAB.dataSource}
        data-state={forced ?? "ready"}
      >
        {forced !== null ? <StateBlock state={forced} rid={rid} /> : detailContent}
      </div>
    </ConsoleModulesFrame>
  );
}

/** Legacy `/runs` adapter element: probed B/C module page when it exists,
 * else the node App passes (existing RunsPage). Only mounted when
 * `runsModulePageAvailable()` — otherwise the builtin route stays the
 * sole `/runs` provider, untouched. */
export function ConsoleRunsAdapter({ fallback }: { fallback: ReactNode }) {
  return RunsModulePage ? (
    <Suspense fallback={<StateBlock state="loading" />}>
      <RunsModulePage />
    </Suspense>
  ) : (
    fallback
  );
}

/* ------------------------------------------------------------------ *
 * Sidebar — two tiers: 4 groups × 8 modules (skeleton MODULES block)
 *
 * V4 R4 B9 收口（侧栏中英双系统）：ConsoleNav 的 DOM 文本只有中文——
 * 分组标题、模块锚点标签均来自 routes.ts 的中文 label（CONSOLE_MODULES
 * 冻结 IA 数据，禁止在此处追加英文重复项或英文副标签；英文模块标识符
 * 只允许出现在 data-mod 契约标记与 URL path 中，assert-ia 按 data-mod
 * 计数，不得从 DOM 移除）。上游英文回退导航（App.tsx 的
 * NAV_GROUP_FALLBACK / SidebarNavLink / SidebarSystemActions「Restart
 * gateway」页脚）不在本写域，由 App lane 处理。
 * ------------------------------------------------------------------ */

const CONSOLE_GROUPS = ["运营", "治理", "平台", "系统"] as const;

/** module → its default visible-tab browser path (no ?tab). */
function moduleDefaultPath(module: ConsoleModule): string {
  const row = CONSOLE_TABS.find(
    (t) => t.module === module && (t.tab ?? "") === "",
  );
  return row !== undefined ? row.path : `/${module}`;
}

/** 哪几个模块的条目右侧带数字徽标；数字全部来自 sidebar-data 的真读数，
 * 取不到（null）时整枚不渲染——不写死、不拿 0 冒充。 */
const BADGE_KEYS: Partial<Record<ConsoleModule, keyof SidebarBadges>> = {
  employees: "employees",
  work: "work",
  approvals: "approvals",
};

export function ConsoleNav({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const badges = useSidebarBadges();

  return (
    <div
      className={`console-nav flex flex-col pb-2${collapsed ? " is-collapsed" : ""}`}
      role="group"
      aria-labelledby="hermes-console-nav-heading"
    >
      {/* 骨架侧栏没有「控制台」这行大标题：品牌之下直接是 4 个分组。
        * id 保留（sidebar 208px 锁宽规则与 aria-labelledby 都读它），只做 sr-only。 */}
      <span id="hermes-console-nav-heading" className="sr-only">
        控制台
      </span>
      {CONSOLE_GROUPS.map((group) => {
        const items = CONSOLE_MODULES.filter((m) => m.group === group);
        if (items.length === 0) return null;
        return (
          <div
            key={group}
            className="console-nav-section"
            role="group"
            aria-label={group}
          >
            <span className="console-nav-group-h">{group}</span>
            <ul className="flex flex-col">
              {items.map((meta) => {
                const badgeKey = BADGE_KEYS[meta.module];
                const badge = badgeKey === undefined ? null : badges[badgeKey];
                // 折叠档（is-collapsed / 56px 图标轨）：文字与徽标由 CSS 收掉，
                // 条目只留一枚 20px 图标。图标常驻 DOM、默认 display:none，
                // 因此展开档的几何与 DOM 顺序不变；折叠档靠 aria-label/title
                // 补齐中文名，删掉文字也不丢可及名。
                const Icon = CONSOLE_MODULE_ICONS[meta.module];
                return (
                  <li key={meta.module}>
                    <NavLink
                      to={moduleDefaultPath(meta.module)}
                      onClick={onNavigate}
                      data-mod={meta.module}
                      aria-label={collapsed ? meta.label : undefined}
                      title={collapsed ? meta.label : undefined}
                      className="console-nav-link"
                    >
                      <Icon className="console-nav-icon" aria-hidden="true" />
                      <span className="console-nav-label">{meta.label}</span>
                      {badge !== null && (
                        <span
                          className={`console-nav-badge${
                            meta.module === "approvals" && badge > 0
                              ? " is-alert"
                              : ""
                          }`}
                          title={`${meta.label}：${badge}`}
                        >
                          {badge}
                        </span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {/* 2026-11-24 末轮 IA 收口：侧栏不再有顶层「审计」。
        * 依据 routes.ts：#/audit 是 `compat-module / visible:false`，落点是
        * #/system?tab=events —— 它本就是 22 个可见 tab 之一（系统 · 审计事件），
        * 不该在四组之外单独成项。路由 /audit 原样保留（App 里 AuditAwareEntry
        * 仍服务该 URL），只摘掉侧栏这一枚入口，可达性走系统设置的 tab 条。 */}
    </div>
  );
}
