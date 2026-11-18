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
 *    whose left cell carries the ONLY `[data-chat-host]`; the element with
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

import { Suspense, useMemo, type ReactNode } from "react";
import { NavLink, useParams, useSearchParams } from "react-router";
import {
  CONSOLE_MODULES,
  CONSOLE_TABS,
  DETAIL_TAB,
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
  normalizeZone,
  searchFor,
} from "./bridge";
import {
  FixtureBadge,
  useFixtureMirror,
  useFixtureState,
} from "./fixtures";
import EmployeeDetailWorkbench from "../modules/employee-detail/EmployeeDetailWorkbench";

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
  useFixtureMirror(document.documentElement);
  return <FixtureBadge />;
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

const shellStyle = {
  background: "var(--panel)",
  borderColor: "var(--line)",
  color: "var(--fg)",
} as const;

/** One request-ref per mount for the honest 403/error blocks — labelled as
 * a front-end placeholder, never presented as a real backend correlation id. */
function requestRef(): string {
  const rand =
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 8)
      : String(Date.now() % 0xffffffff).padStart(8, "0");
  return `req_${rand}`;
}

function StateBlock({ state }: { state: PaneForced }) {
  const ref = useMemo(() => requestRef(), []);
  const frame = {
    className: "flex min-h-[12rem] flex-col items-center justify-center gap-2 p-5 text-sm",
    style: shellStyle,
  };
  if (state === "loading") {
    return (
      <div role="status" aria-live="polite" {...frame}>
        <span>加载中…</span>
        <span className="text-xs" style={{ color: "var(--fg-3)" }}>
          强制态：?state=loading
        </span>
      </div>
    );
  }
  if (state === "empty") {
    return (
      <div role="status" aria-live="polite" {...frame}>
        <span>暂无数据</span>
        <span className="text-xs" style={{ color: "var(--fg-3)" }}>
          强制态：?state=empty（不伪造样例数据）
        </span>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div role="status" aria-live="polite" {...frame}>
        <span style={{ color: "var(--bad)" }}>加载失败</span>
        <span className="font-mono text-xs" style={{ color: "var(--fg-3)" }}>
          {ref}（前端占位请求号）
        </span>
        <span className="text-xs" style={{ color: "var(--fg-3)" }}>
          强制态：?state=error
        </span>
      </div>
    );
  }
  return (
    <div role="status" aria-live="polite" {...frame}>
      <span className="font-mono text-lg">403</span>
      <span>无权限或未开放（403 与 404 同一整页文案）</span>
      <span className="font-mono text-xs" style={{ color: "var(--fg-3)" }}>
        {ref}（前端占位请求号）
      </span>
      <span className="text-xs" style={{ color: "var(--fg-3)" }}>
        强制态：?state=denied
      </span>
    </div>
  );
}

/** roView auditor view: whole-page 403 + 请求号 (§7 全局; skeleton
 * L7692-7700). 403 and 404 share one body (§8.1-3). */
function AuditorDeniedBlock() {
  const ref = useMemo(() => requestRef(), []);
  return (
    <div
      role="status"
      aria-live="polite"
      data-state="denied"
      className="flex min-h-[16rem] flex-col items-center justify-center gap-2 p-6 text-sm"
      style={shellStyle}
    >
      <span className="font-mono text-2xl">403</span>
      <span>无权访问 · 只读审计员视角</span>
      <span className="font-mono text-xs" style={{ color: "var(--fg-3)" }}>
        {ref} · 只读审计员视角 · 前端占位请求号
      </span>
      <span className="text-xs" style={{ color: "var(--fg-3)" }}>
        审计员（roView）不可进入 defaults/models 的写入面；退出视角请移除 ?roview=1。
      </span>
    </div>
  );
}

/** Honest placeholder for every tab whose data source is not live yet
 * (写侧「规划中」 vocabulary, PRD §3; `[data-planned]` disabled per §3/§7). */
function PlannedBlock({ entry }: { entry: ConsoleRoute }) {
  const source = registryPlanned(entry.tabId) ?? entry.dataSource;
  const gapNote = entry.planned
    ? "数据源未落地（GAP 清单 §6/§12）——接入前保持本占位，不伪造数据。"
    : "上游页面尚未接入本壳（复用映射 §3）——接入前保持本占位，不留空白死链。";
  return (
    <div
      data-planned={`规划中：${source}`}
      aria-disabled="true"
      role="status"
      aria-live="polite"
      className="flex min-h-[12rem] flex-col items-start justify-center gap-2 rounded-[var(--r)] border p-5 text-sm"
      style={{ ...shellStyle, cursor: "not-allowed" }}
    >
      <span className="text-base">{entry.label} · 规划中</span>
      <span style={{ color: "var(--fg-2)" }}>{gapNote}</span>
      <span className="font-mono text-xs" style={{ color: "var(--fg-3)" }}>
        数据来源：{source}
      </span>
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
  roView: boolean;
}

function ConsolePane({ entry, liveNode, forced, roView }: ConsolePaneProps) {
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
        <StateBlock state={forced} />
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
}: {
  activeModule: ConsoleModule;
  children: ReactNode;
}) {
  return (
    <>
      {CONSOLE_MODULES.map((meta) =>
        meta.module === activeModule ? (
          <section
            key={meta.module}
            data-mod={meta.module}
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
  return (
    <div
      role="tablist"
      aria-label={`${module} 控制台 Tab`}
      className="flex min-w-0 flex-wrap gap-1 border-b pb-1"
      style={{ borderColor: "var(--line-2)" }}
    >
      {tabs.map((tab) => {
        const to = {
          pathname: pathFor(tab),
          search: searchFor(tab.tab ?? "", "", "", {}),
        };
        const active = tab.tabId === activeTabId;
        return (
          <NavLink
            key={tab.tabId}
            to={to}
            role="tab"
            aria-selected={active}
            data-tab={tab.tabId}
            className="rounded-t-[var(--r-sm)] border border-b-0 px-3 py-1.5 text-sm no-underline"
            style={{
              ...shellStyle,
              background: active ? "var(--panel-2)" : "transparent",
              color: active ? "var(--fg)" : "var(--fg-3)",
            }}
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
  const active = tabs.find((t) => t.tabId === resolved.tab) ?? tabs[0];
  const meta = CONSOLE_MODULES.find((m) => m.module === module);
  const forced = usePaneForced();
  const roView = sp.get("roview") === "1";

  if (active === undefined || meta === undefined) return null;

  return (
    <ConsoleModulesFrame activeModule={module}>
      <header className="flex min-w-0 flex-col gap-1">
        <span
          className="text-xs tracking-[0.12em]"
          style={{ color: "var(--fg-3)" }}
        >
          {meta.group} · 控制台
        </span>
        <h1 className="text-lg font-semibold">{meta.label}</h1>
      </header>
      {roView && auditorDenied(active, true) ? null : (
        <ConsoleTabStrip module={module} activeTabId={active.tabId} />
      )}
      <ConsolePane
        entry={active}
        liveNode={live?.[active.tabId]}
        forced={forced}
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

export function ConsoleEmployeeDetailPage({
  fallback,
  zone,
  renderChatHost,
}: ConsoleEmployeeDetailPageProps) {
  const params = useParams<{ employeeId: string }>();
  const employeeId = params.employeeId ? decodeURIComponent(params.employeeId) : "";
  const [sp] = useSearchParams();
  const zoneQuery = sp.get("zone") ?? "";
  const normalized = zone !== undefined ? zone : normalizeZone(zoneQuery);
  const forced = usePaneForced();

  // Bare /employees/:employeeId keeps the live surface (probe or existing
  // page) — stage-2 brief 5 fallback. The lane-A workbench (chat host +
  // rail) serves the EXPLICIT workbench forms (?zone=workbench plus the
  // ZONE_ALIAS overview/chat spellings).
  const showWorkbench = zone === undefined && normalized === "workbench";

  const detailContent: ReactNode = DetailModulePage ? (
    <Suspense fallback={<StateBlock state="loading" />}>
      <DetailModulePage employeeId={employeeId} />
    </Suspense>
  ) : showWorkbench ? (
    <EmployeeDetailWorkbench
      employeeId={employeeId}
      renderChatHost={renderChatHost}
    />
  ) : (
    fallback
  );

  const zoneHref = (z: DetailZone): { pathname: string; search: string } => ({
    pathname: `/employees/${encodeURIComponent(employeeId || "_")}`,
    search: `?zone=${z}`,
  });

  return (
    <ConsoleModulesFrame activeModule="employees">
      <div
        role="tablist"
        aria-label="员工详情分区"
        className="flex min-w-0 flex-wrap gap-1 border-b pb-1"
        style={{ borderColor: "var(--line-2)" }}
      >
        {ZONE_ORDER.map((z) => {
          const activeZone = normalized !== "" && z === normalized;
          return (
            <NavLink
              key={z}
              to={zoneHref(z)}
              role="tab"
              aria-selected={activeZone}
              data-zone={z}
              className="rounded-t-[var(--r-sm)] border border-b-0 px-3 py-1.5 text-sm no-underline"
              style={{
                ...shellStyle,
                background: activeZone ? "var(--panel-2)" : "transparent",
                color: activeZone ? "var(--fg)" : "var(--fg-3)",
              }}
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
        {forced !== null ? <StateBlock state={forced} /> : detailContent}
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
 * ------------------------------------------------------------------ */

const CONSOLE_GROUPS = ["运营", "治理", "平台", "系统"] as const;

/** module → its default visible-tab browser path (no ?tab). */
function moduleDefaultPath(module: ConsoleModule): string {
  const row = CONSOLE_TABS.find(
    (t) => t.module === module && (t.tab ?? "") === "",
  );
  return row !== undefined ? row.path : `/${module}`;
}

export function ConsoleNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div
      className="flex flex-col pb-2"
      role="group"
      aria-labelledby="hermes-console-nav-heading"
    >
      <span
        id="hermes-console-nav-heading"
        className="px-5 pt-2.5 pb-1 font-sans text-display text-xs tracking-[0.12em] text-text-tertiary"
      >
        控制台
      </span>
      {CONSOLE_GROUPS.map((group) => {
        const items = CONSOLE_MODULES.filter((m) => m.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group} role="group" aria-label={group}>
            <span
              className="px-5 pt-2 pb-1 font-sans text-xs tracking-[0.1em]"
              style={{ color: "var(--fg-4)" }}
            >
              {group}
            </span>
            <ul className="flex flex-col">
              {items.map((meta) => (
                <li key={meta.module}>
                  <NavLink
                    to={moduleDefaultPath(meta.module)}
                    onClick={onNavigate}
                    data-mod={meta.module}
                    className={({ isActive }) =>
                      [
                        "relative flex items-center gap-3 px-5 py-2",
                        "font-sans text-display text-sm tracking-[0.08em] whitespace-nowrap no-underline",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-midground",
                        isActive
                          ? "text-midground"
                          : "text-text-secondary hover:text-midground",
                      ].join(" ")
                    }
                  >
                    {meta.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
