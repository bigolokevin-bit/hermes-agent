/**
 * Console shell route table — pure data + pure helpers, ZERO page imports.
 * Stage 2 wires App.tsx against this module; nothing imports pages here.
 *
 * Transcribed row-by-row from CONSOLE-PRD-v4.md v4.1 (seakoi-agent-os):
 *   - Appendix A (L265-321): the 51 main-route forms.
 *     Frozen count law: 51 = 22 visible tab forwards (module root = default
 *     tab) + 5 detail-zone routes (workbench default "#/employees/
 *     :employeeId" counts 1 + 4 non-default zones) + 5 view deep links
 *     (VIEW_ALIAS) + 14 tab-level compat (TAB_ALIAS) + 5 module-level compat
 *     (ALIAS rows with no sub-tab mapping: metrics/sessions/org/access/audit).
 *   - Appendix A.2 (L323-337): the 23 redirect-only forms (4 roots
 *       [+1 '/matrix' row added by R4 item 3 — deviation, see REDIRECTS])
 *     #/cron #/skills #/models #/channels + 19 sub-tab aliases: skills-7
 *     including the tools→tools cross-tab, models-7, channels-5).
 *     Redirect-only means: NEVER enters navigation.
 *   Total address forms: 51 + 24 = 75 (R4 item-3 matrix row; crawl baseline
 *   was 74 — lane D refreshes crawl-routes.mjs coverage).
 *   - Section 3 (L27-55): the 22 visible tab labels (中文), routes, data
 *     sources; +1 hidden detail pane = 23 data-tabname entries.
 *   - Section 7 (L122-129) alignment contract notes:
 *       * unknown-hash fallback is an App-layer decision — NOT here; this
 *         module only exports ROUTE_TABLE and lookup helpers;
 *       * redirects never enter navigation (REDIRECTS below is data-only);
 *       * every pane carries data-src — captured per entry as `dataSource`.
 *
 * SHAPE NOTE (orchestrator stage-1 correction): the fork web app routes with
 * react-router BROWSER paths (BrowserRouter basename=HERMES_BASE_PATH in
 * main.tsx; App.tsx PATH_COMPONENT already registers "/employees/:employeeId"
 * with param name employeeId). Every entry therefore carries BOTH forms:
 *   `hash` — the PRD appendix A literal ("#/..." query style), and
 *   `path` — the react-router pattern. `?tab=` forms keep the base path and
 *   carry the tab on the entry; the query survives parse (see parseHash).
 * Detail param is `:employeeId` everywhere (PRD writes ":id"; normalized per
 * correction — App L206 and the stage-2 EmployeeDetailPage useParams fix).
 *
 * `conflict` marks entries whose path form collides with an EXISTING App.tsx
 * route in a way stage 2 must arbitrate (precedence lives there, not here).
 * Existing App paths checked against: /chat /employees /employees/:employeeId
 * /approvals /tasks /collaboration /runs /knowledge /organization
 * /tenant-quota /access-control /directory /sessions /files /analytics /models
 * /mcp /channels /cron /logs /system /config /env /docs /plugins /skills
 * /profiles /webhooks /pairing.
 *
 * `planned: true` is set only where PRD Section 3 marks the data source as a
 * known gap (GAP-01 aggregation missing, GAP-02 毕升 org endpoints unverified,
 * GAP-03 knowledge has no HTTP read side): the shell renders an honest
 * placeholder until the source is live. No fake data anywhere.
 */

export type ConsoleModule =
  | 'overview'
  | 'employees'
  | 'work'
  | 'approvals'
  | 'identity'
  | 'knowledge'
  | 'capabilities'
  | 'system';

export type RouteKind = 'tab' | 'detail-zone' | 'view' | 'compat-tab' | 'compat-module';

export interface ConsoleRoute {
  /** PRD appendix A literal hash form ('#/...'). */
  hash: string;
  /** react-router path pattern ('/...'), param name always :employeeId. */
  path: string;
  module: ConsoleModule;
  /** Tab id this form lands on (compat rows carry their DESTINATION tab). */
  tabId: string;
  kind: RouteKind;
  /** Only the 22 visible tabs enter navigation; everything else is false. */
  visible: boolean;
  /** Display label (PRD Section 3); compat rows carry the destination label. */
  label: string;
  /** Pane data source per PRD Section 3 / appendix A ('data-src' contract). */
  dataSource: string;
  /** ?tab= query value this form carries ('' = no tab query). */
  tab?: string;
  /** ?view= deep-link value (VIEW_ALIAS). */
  view?: string;
  /** Employee-detail zone (workbench|config|tasks|runs|evidence). */
  zone?: string;
  /** Compat rows: canonical target hash (redirect-only, never navigable). */
  to?: string;
  /** Data source has a known GAP (PRD Section 3/6) — honest placeholder. */
  planned?: boolean;
  /** Path form collides with an existing App.tsx route; stage 2 arbitrates. */
  conflict?: string;
}

/* ------------------------------------------------------------------ *
 * Sidebar modules (skeleton MODULES block, L5249-5258): two tiers,
 * groups 运营 x4 / 治理 x2 / 平台 x1 / 系统 x1 — count law: 8 modules.
 * ------------------------------------------------------------------ */

export interface ConsoleModuleMeta {
  module: ConsoleModule;
  group: '运营' | '治理' | '平台' | '系统';
  label: string;
}

export const CONSOLE_MODULES: readonly ConsoleModuleMeta[] = [
  { module: 'overview', group: '运营', label: '运营总览' },
  { module: 'employees', group: '运营', label: '数字员工' },
  { module: 'work', group: '运营', label: '任务与运行' },
  { module: 'approvals', group: '运营', label: '审批与发布门' },
  { module: 'identity', group: '治理', label: '人员与访问' },
  { module: 'knowledge', group: '治理', label: '知识与数据' },
  { module: 'capabilities', group: '平台', label: '能力与接入' },
  { module: 'system', group: '系统', label: '系统设置' },
];

/** Employee-detail zones (skeleton L5294) + zone aliases (L5295). */
export const ZONES = ['workbench', 'config', 'tasks', 'runs', 'evidence'] as const;
export type DetailZone = (typeof ZONES)[number];
export const ZONE_ALIAS: Readonly<Record<string, DetailZone>> = {
  overview: 'workbench',
  chat: 'workbench',
  audit: 'evidence',
};

/* ------------------------------------------------------------------ *
 * Appendix A rows 1-22 — the 22 visible tab forwards.
 * Also exported as CONSOLE_TABS; +1 hidden detail pane = 23 tabname
 * entries (skeleton probe: data-tabname unique=23, hidetab on 详情).
 * ------------------------------------------------------------------ */

export const CONSOLE_TABS: readonly ConsoleRoute[] = [
  // #1 duty 值班台 — NEW (skeleton:1840-2035); GAP-01: four-gate aggregate
  // endpoint does not exist; front-end aggregates, each gate labels source.
  { hash: '#/overview', path: '/overview', module: 'overview', tabId: 'duty', kind: 'tab', visible: true, label: '值班台', dataSource: '员工、用量、预算与审批数据汇总（聚合接口建设中）', planned: true },
  // #2 usage 用量与成本 — reuse Hermes AnalyticsPage; ledger is the only
  // money source; estimates must be labelled 预估.
  { hash: '#/overview?tab=usage', path: '/overview', module: 'overview', tabId: 'usage', kind: 'tab', visible: true, label: '用量与成本', dataSource: 'hermes-usage/budget-usage（ledger 唯一金额源）', tab: 'usage' },
  // #3 list 列表 — ported fork EmployeesPage (already at /employees).
  { hash: '#/employees', path: '/employees', module: 'employees', tabId: 'list', kind: 'tab', visible: true, label: '列表', dataSource: '员工与能力矩阵接口（读取失败时回落员工列表）' },
  // #4 matrix 能力与权限 — NEW (skeleton:2315-2384); fixture gate BOUNDARY-12.
  { hash: '#/employees?tab=matrix', path: '/employees', module: 'employees', tabId: 'matrix', kind: 'tab', visible: true, label: '能力与权限', dataSource: '员工能力矩阵接口', tab: 'matrix' },
  // #5 board 任务 — V2 TasksListPage (真源); done never rolls back.
  { hash: '#/work', path: '/work', module: 'work', tabId: 'board', kind: 'tab', visible: true, label: '任务', dataSource: '任务列表与任务详情接口' },
  // #6 runs 运行 — V2 RunDetailPage + fork RunsPage; missing cost renders —.
  { hash: '#/work?tab=runs', path: '/work', module: 'work', tabId: 'runs', kind: 'tab', visible: true, label: '运行', dataSource: '运行记录、运行详情与运行事件接口', tab: 'runs' },
  // #7 pending 待处理 — ported fork ApprovalsPage; decision write is live.
  { hash: '#/approvals', path: '/approvals', module: 'approvals', tabId: 'pending', kind: 'tab', visible: true, label: '待处理', dataSource: '待处理审批列表与审批详情接口' },
  // #8 history 历史决策 — NEW; same endpoint pure projection (8 states).
  { hash: '#/approvals?tab=history', path: '/approvals', module: 'approvals', tabId: 'history', kind: 'tab', visible: true, label: '历史决策', dataSource: '审批历史接口（八种状态）', tab: 'history' },
  // #9 people 人员目录 — GAP-02: 毕升 endpoints unverified → 待核实.
  { hash: '#/identity', path: '/identity', module: 'identity', tabId: 'people', kind: 'tab', visible: true, label: '人员目录', dataSource: '人员目录来自统一用户体系（接口对接核实中）', planned: true },
  // #10 departments 组织与部门 — GAP-02.
  { hash: '#/identity?tab=departments', path: '/identity', module: 'identity', tabId: 'departments', kind: 'tab', visible: true, label: '组织与部门', dataSource: '组织架构数据（接口对接核实中）', tab: 'departments', planned: true },
  // #11 roles 角色与权限 — GAP-02; write entry never renders (SET-01).
  { hash: '#/identity?tab=roles', path: '/identity', module: 'identity', tabId: 'roles', kind: 'tab', visible: true, label: '角色与权限', dataSource: '角色与权限数据（接口对接核实中）', tab: 'roles', planned: true },
  // #12 spaces 知识空间 — GAP-03: honest empty state; FilesPage must NOT
  // enter (BOUNDARY-09), while App.tsx already mounts upstream KnowledgePage
  // at /knowledge — path collision, stage 2 arbitrates precedence.
  { hash: '#/knowledge', path: '/knowledge', module: 'knowledge', tabId: 'spaces', kind: 'tab', visible: true, label: '知识空间', dataSource: '知识空间登记（读取接口未开放，显示诚实空态）', planned: true, conflict: "existing App route '/knowledge' renders upstream KnowledgePage/FilesPage; PRD BOUNDARY-09 says FilesPage 不进 — stage 2 decides precedence" },
  // #13 sources 数据源 — GAP-03: no endpoint; test/sync disabled.
  { hash: '#/knowledge?tab=sources', path: '/knowledge', module: 'knowledge', tabId: 'sources', kind: 'tab', visible: true, label: '数据源', dataSource: '数据源管理（尚无读取接口）', tab: 'sources', planned: true },
  // #14 evidence 证据与引用 — NEW; NO_EVIDENCE rows explicit, no fallback.
  { hash: '#/knowledge?tab=evidence', path: '/knowledge', module: 'knowledge', tabId: 'evidence', kind: 'tab', visible: true, label: '证据与引用', dataSource: '运行事件引用与审计接口', tab: 'evidence' },
  // #15 skills 技能 — Hermes SkillsPage 整块; toggle is profile-level.
  { hash: '#/capabilities', path: '/capabilities', module: 'capabilities', tabId: 'skills', kind: 'tab', visible: true, label: '技能', dataSource: '技能列表与技能详情接口' },
  // #16 tools 工具与 MCP — Hermes McpPage 整块; CRUD disabled.
  { hash: '#/capabilities?tab=tools', path: '/capabilities', module: 'capabilities', tabId: 'tools', kind: 'tab', visible: true, label: '工具与 MCP', dataSource: '工具与 MCP 服务（上游原生页面）', tab: 'tools' },
  // #17 models 模型与单价 — Hermes ModelsPage; ledger amounts authoritative;
  // roView 403.
  { hash: '#/capabilities?tab=models', path: '/capabilities', module: 'capabilities', tabId: 'models', kind: 'tab', visible: true, label: '模型与单价', dataSource: '模型选项与单价（金额以计费台账为准）', tab: 'models' },
  // #18 channels 平台接入 — Hermes ChannelsPage 整块; zero per-agent
  // fields (BOUNDARY-07).
  { hash: '#/capabilities?tab=channels', path: '/capabilities', module: 'capabilities', tabId: 'channels', kind: 'tab', visible: true, label: '平台接入', dataSource: '平台接入（上游原生页面）', tab: 'channels' },
  // #19 health 系统健康 — real probes only; unknown ≠ healthy.
  { hash: '#/system', path: '/system', module: 'system', tabId: 'health', kind: 'tab', visible: true, label: '系统健康', dataSource: '系统摘要与真实连通性探针' },
  // #20 defaults 默认设置 — zero write entries (SET-01); roView 403;
  // CR-M2-02 baseline not landed → contract unfrozen.
  { hash: '#/system?tab=defaults', path: '/system', module: 'system', tabId: 'defaults', kind: 'tab', visible: true, label: '默认设置', dataSource: '默认设置基线（配置接口尚未开放）', tab: 'defaults' },
  // #21 version 版本 — NEW minimal; build-injected info only.
  { hash: '#/system?tab=version', path: '/system', module: 'system', tabId: 'version', kind: 'tab', visible: true, label: '版本', dataSource: '构建产物注入', tab: 'version' },
  // #22 events 审计事件 — 毕升 LogPage contract + V2 AuditListPage;
  // never leak tokens.
  { hash: '#/system?tab=events', path: '/system', module: 'system', tabId: 'events', kind: 'tab', visible: true, label: '审计事件', dataSource: '审计事件、审计详情与校验接口', tab: 'events' },
];

/**
 * Hidden detail pane (the 23rd data-tabname entry; skeleton:2386 carries
 * data-hidetab="1" — present in panes, absent from navigation). Its default
 * zone is workbench (appendix A row 23); the 60/40 workbench shell lives in
 * the employee-detail manifest placeholder (stage 2 renders both columns).
 */
export const DETAIL_TAB: ConsoleRoute = {
  hash: '#/employees/:employeeId',
  path: '/employees/:employeeId',
  module: 'employees',
  tabId: 'detail',
  kind: 'detail-zone',
  visible: false,
  label: '详情',
  dataSource: 'employee/effective-config/employee-versions/tasks/runs/sessions?employee=/audit',
  zone: 'workbench',
};

/** All 23 tabname entries (22 visible + hidden 详情) — probe parity. */
export const TABNAME_ENTRIES: readonly ConsoleRoute[] = [...CONSOLE_TABS, DETAIL_TAB];

/* ------------------------------------------------------------------ *
 * Appendix A rows 23-51 (row 23 is DETAIL_TAB above).
 * ------------------------------------------------------------------ */

const DETAIL_ZONES_EXTRA: readonly ConsoleRoute[] = [
  // #24 config zone — 6-group left rail (facts/comms/run/access/knowledge/
  // budget); PRD flags the skeleton data-cfg="channels" naming bug (L2894/
  // 2915): implementation must use budget.
  { hash: '#/employees/:employeeId?zone=config', path: '/employees/:employeeId/config', module: 'employees', tabId: 'detail', kind: 'detail-zone', visible: false, label: '详情', dataSource: 'employee-versions/effective-config', zone: 'config' },
  // #25 tasks zone
  { hash: '#/employees/:employeeId?zone=tasks', path: '/employees/:employeeId/tasks', module: 'employees', tabId: 'detail', kind: 'detail-zone', visible: false, label: '详情', dataSource: 'tasks?employee=', zone: 'tasks' },
  // #26 runs zone
  { hash: '#/employees/:employeeId?zone=runs', path: '/employees/:employeeId/runs', module: 'employees', tabId: 'detail', kind: 'detail-zone', visible: false, label: '详情', dataSource: 'runs?employee=', zone: 'runs' },
  // #27 evidence zone
  { hash: '#/employees/:employeeId?zone=evidence', path: '/employees/:employeeId/evidence', module: 'employees', tabId: 'detail', kind: 'detail-zone', visible: false, label: '详情', dataSource: 'audit/run-events', zone: 'evidence' },
];

const VIEW_DEEP_LINKS: readonly ConsoleRoute[] = [
  // #28-#32 — VIEW_ALIAS targets: same pane as the tab, preset view chip.
  { hash: '#/identity?tab=people&view=admins', path: '/identity', module: 'identity', tabId: 'people', kind: 'view', visible: false, label: '人员目录', dataSource: '同 people', tab: 'people', view: 'admins' },
  { hash: '#/approvals?tab=pending&view=mine', path: '/approvals', module: 'approvals', tabId: 'pending', kind: 'view', visible: false, label: '待处理', dataSource: '同 pending', tab: 'pending', view: 'mine' },
  { hash: '#/approvals?tab=pending&view=release', path: '/approvals', module: 'approvals', tabId: 'pending', kind: 'view', visible: false, label: '待处理', dataSource: '同 pending', tab: 'pending', view: 'release' },
  { hash: '#/work?tab=board&view=cron', path: '/work', module: 'work', tabId: 'board', kind: 'view', visible: false, label: '任务', dataSource: '同 board（cron chip 规划中）', tab: 'board', view: 'cron' },
  { hash: '#/system?tab=events&view=anomaly', path: '/system', module: 'system', tabId: 'events', kind: 'view', visible: false, label: '审计事件', dataSource: '同 events', tab: 'events', view: 'anomaly' },
];

const COMPAT_TABS: readonly ConsoleRoute[] = [
  // #33-#46 — 14 tab-level compat (TAB_ALIAS, skeleton L5260-5265). The
  // `to` column transcribes appendix A's "→target(view=…)" notation.
  { hash: '#/knowledge?tab=scope', path: '/knowledge', module: 'knowledge', tabId: 'spaces', kind: 'compat-tab', visible: false, label: '知识空间', dataSource: '随目标', tab: 'scope', to: '#/knowledge' },
  { hash: '#/knowledge?tab=ingest', path: '/knowledge', module: 'knowledge', tabId: 'sources', kind: 'compat-tab', visible: false, label: '数据源', dataSource: '随目标', tab: 'ingest', to: '#/knowledge?tab=sources' },
  { hash: '#/knowledge?tab=retrieval', path: '/knowledge', module: 'knowledge', tabId: 'evidence', kind: 'compat-tab', visible: false, label: '证据与引用', dataSource: '随目标', tab: 'retrieval', to: '#/knowledge?tab=evidence' },
  { hash: '#/knowledge?tab=citations', path: '/knowledge', module: 'knowledge', tabId: 'evidence', kind: 'compat-tab', visible: false, label: '证据与引用', dataSource: '随目标', tab: 'citations', to: '#/knowledge?tab=evidence' },
  { hash: '#/identity?tab=tenant', path: '/identity', module: 'identity', tabId: 'people', kind: 'compat-tab', visible: false, label: '人员目录', dataSource: '随目标', tab: 'tenant', to: '#/identity' },
  { hash: '#/identity?tab=admins', path: '/identity', module: 'identity', tabId: 'people', kind: 'compat-tab', visible: false, label: '人员目录', dataSource: '随目标', tab: 'admins', to: '#/identity?tab=people&view=admins' },
  { hash: '#/identity?tab=binding', path: '/identity', module: 'identity', tabId: 'people', kind: 'compat-tab', visible: false, label: '人员目录', dataSource: '随目标', tab: 'binding', to: '#/identity' },
  { hash: '#/identity?tab=checks', path: '/identity', module: 'identity', tabId: 'people', kind: 'compat-tab', visible: false, label: '人员目录', dataSource: '随目标', tab: 'checks', to: '#/identity' },
  { hash: '#/approvals?tab=mine', path: '/approvals', module: 'approvals', tabId: 'pending', kind: 'compat-tab', visible: false, label: '待处理', dataSource: '随目标', tab: 'mine', to: '#/approvals?tab=pending&view=mine' },
  { hash: '#/approvals?tab=release', path: '/approvals', module: 'approvals', tabId: 'pending', kind: 'compat-tab', visible: false, label: '待处理', dataSource: '随目标', tab: 'release', to: '#/approvals?tab=pending&view=release' },
  { hash: '#/approvals?tab=policy', path: '/approvals', module: 'approvals', tabId: 'pending', kind: 'compat-tab', visible: false, label: '待处理', dataSource: '随目标', tab: 'policy', to: '#/approvals' },
  { hash: '#/work?tab=cron', path: '/work', module: 'work', tabId: 'board', kind: 'compat-tab', visible: false, label: '任务', dataSource: '随目标', tab: 'cron', to: '#/work?tab=board&view=cron' },
  { hash: '#/system?tab=security', path: '/system', module: 'system', tabId: 'events', kind: 'compat-tab', visible: false, label: '审计事件', dataSource: '随目标', tab: 'security', to: '#/system?tab=events&view=anomaly' },
  { hash: '#/system?tab=retention', path: '/system', module: 'system', tabId: 'events', kind: 'compat-tab', visible: false, label: '审计事件', dataSource: '随目标', tab: 'retention', to: '#/system?tab=events' },
];

const COMPAT_MODULES: readonly ConsoleRoute[] = [
  // #47-#51 — 5 module-level compat (ALIAS rows without sub-tab mapping,
  // skeleton L5276-5283: metrics/sessions/org/access/audit).
  { hash: '#/metrics', path: '/metrics', module: 'overview', tabId: 'usage', kind: 'compat-module', visible: false, label: '用量与成本', dataSource: '随目标', to: '#/overview?tab=usage', conflict: "existing App route '/analytics' (upstream AnalyticsPage) is the same surface the usage tab reuses — stage 2 decides which path serves it" },
  { hash: '#/sessions', path: '/sessions', module: 'employees', tabId: 'list', kind: 'compat-module', visible: false, label: '列表', dataSource: '随目标', to: '#/employees', conflict: "path '/sessions' is an existing App route (upstream SessionsPage); the compat form wants to redirect it to the employees list — stage 2 decides precedence" },
  { hash: '#/org', path: '/org', module: 'identity', tabId: 'people', kind: 'compat-module', visible: false, label: '人员目录', dataSource: '随目标', to: '#/identity' },
  { hash: '#/access', path: '/access', module: 'identity', tabId: 'roles', kind: 'compat-module', visible: false, label: '角色与权限', dataSource: '随目标', to: '#/identity?tab=roles' },
  { hash: '#/audit', path: '/audit', module: 'system', tabId: 'events', kind: 'compat-module', visible: false, label: '审计事件', dataSource: '随目标', to: '#/system?tab=events' },
];

/**
 * The complete 51-row appendix A table, in PRD row order.
 * Count law: 51 = 22 + 5 + 5 + 14 + 5 (asserted by the loop below — this
 * file must never silently pad or drop rows; PRD B8: numbers disagree →
 * fix the PRD, not the skeleton).
 */
export const ROUTE_TABLE: readonly ConsoleRoute[] = [
  ...CONSOLE_TABS, // 22 visible tab forwards (rows 1-22)
  DETAIL_TAB, //        row 23 (hidden detail, workbench default zone)
  ...DETAIL_ZONES_EXTRA, //     rows 24-27 (4 non-default zones)
  ...VIEW_DEEP_LINKS, //  28-32 (5 view deep links)
  ...COMPAT_TABS, //      33-46 (14 tab-level compat)
  ...COMPAT_MODULES, //   47-51 (5 module-level compat)
];

/* ------------------------------------------------------------------ *
 * Appendix A.2 — 23 redirect-only forms (crawl covers them; NOT counted
 * in the 51; NEVER enter navigation). 4 roots + skills 7 sub-aliases
 * (incl. the tools→tools cross-tab) + models 7 + channels 5.
 * Targets use the canonical (visible tab) form.
 * ------------------------------------------------------------------ */

export interface ConsoleRedirect {
  from: { hash: string; path: string; tab?: string };
  to: { hash: string; path: string; tab?: string };
  /** Path form collides with an existing App.tsx route; stage 2 arbitrates. */
  conflict?: string;
}

export const REDIRECTS: readonly ConsoleRedirect[] = [
  // R4 fix-order item 3 (deviation from PRD A.2's 23 rows, recorded): QA
  // probed '/matrix' and found NOHOST — matrix is a tab of employees, so it
  // gets a redirect-only row of its own (redirect forms 23→24, total 75;
  // ROUTE_TABLE stays 51, assert-ia routes count unaffected).
  { from: { hash: '#/matrix', path: '/matrix' }, to: { hash: '#/employees?tab=matrix', path: '/employees', tab: 'matrix' } },
  // 4 module roots. All four paths currently serve bare upstream pages in
  // App.tsx; the shell plan mounts those pages INSIDE the capabilities panes
  // (§3 整块 reuse), so the redirect-vs-page precedence is a stage-2 call.
  { from: { hash: '#/cron', path: '/cron' }, to: { hash: '#/work', path: '/work' }, conflict: "existing App route '/cron' (upstream CronPage); A.2 says #/cron is redirect-only to work·board — stage 2 decides precedence" },
  { from: { hash: '#/skills', path: '/skills' }, to: { hash: '#/capabilities', path: '/capabilities' }, conflict: "existing App route '/skills' (upstream SkillsPage, reused whole under capabilities·skills); stage 2 decides precedence" },
  { from: { hash: '#/models', path: '/models' }, to: { hash: '#/capabilities?tab=models', path: '/capabilities', tab: 'models' }, conflict: "existing App route '/models' (upstream ModelsPage, reused under capabilities·models); stage 2 decides precedence" },
  { from: { hash: '#/channels', path: '/channels' }, to: { hash: '#/capabilities?tab=channels', path: '/capabilities', tab: 'channels' }, conflict: "existing App route '/channels' (upstream ChannelsPage, reused under capabilities·channels); stage 2 decides precedence" },
  // skills 7 sub-tab aliases (published/review/discover/bindings/history/
  // quality collapse onto the skills pane; tools is the cross-tab case).
  { from: { hash: '#/skills?tab=published', path: '/skills', tab: 'published' }, to: { hash: '#/capabilities', path: '/capabilities' } },
  { from: { hash: '#/skills?tab=review', path: '/skills', tab: 'review' }, to: { hash: '#/capabilities', path: '/capabilities' } },
  { from: { hash: '#/skills?tab=discover', path: '/skills', tab: 'discover' }, to: { hash: '#/capabilities', path: '/capabilities' } },
  { from: { hash: '#/skills?tab=bindings', path: '/skills', tab: 'bindings' }, to: { hash: '#/capabilities', path: '/capabilities' } },
  { from: { hash: '#/skills?tab=history', path: '/skills', tab: 'history' }, to: { hash: '#/capabilities', path: '/capabilities' } },
  { from: { hash: '#/skills?tab=quality', path: '/skills', tab: 'quality' }, to: { hash: '#/capabilities', path: '/capabilities' } },
  { from: { hash: '#/skills?tab=tools', path: '/skills', tab: 'tools' }, to: { hash: '#/capabilities?tab=tools', path: '/capabilities', tab: 'tools' } },
  // models 7 sub-tab aliases — all land on capabilities·models.
  { from: { hash: '#/models?tab=catalog', path: '/models', tab: 'catalog' }, to: { hash: '#/capabilities?tab=models', path: '/capabilities', tab: 'models' } },
  { from: { hash: '#/models?tab=providers', path: '/models', tab: 'providers' }, to: { hash: '#/capabilities?tab=models', path: '/capabilities', tab: 'models' } },
  { from: { hash: '#/models?tab=budget', path: '/models', tab: 'budget' }, to: { hash: '#/capabilities?tab=models', path: '/capabilities', tab: 'models' } },
  { from: { hash: '#/models?tab=usage', path: '/models', tab: 'usage' }, to: { hash: '#/capabilities?tab=models', path: '/capabilities', tab: 'models' } },
  { from: { hash: '#/models?tab=ledger', path: '/models', tab: 'ledger' }, to: { hash: '#/capabilities?tab=models', path: '/capabilities', tab: 'models' } },
  { from: { hash: '#/models?tab=routing', path: '/models', tab: 'routing' }, to: { hash: '#/capabilities?tab=models', path: '/capabilities', tab: 'models' } },
  { from: { hash: '#/models?tab=price', path: '/models', tab: 'price' }, to: { hash: '#/capabilities?tab=models', path: '/capabilities', tab: 'models' } },
  // channels 5 sub-tab aliases — all land on capabilities·channels.
  { from: { hash: '#/channels?tab=connections', path: '/channels', tab: 'connections' }, to: { hash: '#/capabilities?tab=channels', path: '/capabilities', tab: 'channels' } },
  { from: { hash: '#/channels?tab=groups', path: '/channels', tab: 'groups' }, to: { hash: '#/capabilities?tab=channels', path: '/capabilities', tab: 'channels' } },
  { from: { hash: '#/channels?tab=send', path: '/channels', tab: 'send' }, to: { hash: '#/capabilities?tab=channels', path: '/capabilities', tab: 'channels' } },
  { from: { hash: '#/channels?tab=mapping', path: '/channels', tab: 'mapping' }, to: { hash: '#/capabilities?tab=channels', path: '/capabilities', tab: 'channels' } },
  { from: { hash: '#/channels?tab=failures', path: '/channels', tab: 'failures' }, to: { hash: '#/capabilities?tab=channels', path: '/capabilities', tab: 'channels' } },
];

/* ------------------------------------------------------------------ *
 * Skeleton alias maps (L5260-5295) transcribed for the TAB_ALIAS
 * handling the brief requires: ?tab= compat forms stay on the base path,
 * with the alias resolved to the destination tab (+ preset view chip).
 * ------------------------------------------------------------------ */

export const TAB_ALIAS: Readonly<Partial<Record<ConsoleModule, Readonly<Record<string, string>>>>> = {
  knowledge: { scope: 'spaces', ingest: 'sources', retrieval: 'evidence', citations: 'evidence' },
  identity: { tenant: 'people', admins: 'people', binding: 'people', checks: 'people' },
  approvals: { mine: 'pending', release: 'pending', policy: 'pending' },
  work: { cron: 'board' },
  system: { security: 'events', retention: 'events' },
};

export const VIEW_ALIAS: Readonly<Record<string, string>> = {
  'identity.admins': 'admins',
  'approvals.mine': 'mine',
  'approvals.release': 'release',
  'work.cron': 'cron',
  'system.security': 'anomaly',
};

/* ------------------------------------------------------------------ *
 * Pure helpers
 * ------------------------------------------------------------------ */

export interface ParsedLocation {
  /** Path portion with leading slash, query and '#' prefix stripped. */
  path: string;
  tab: string;
  view: string;
  zone: string;
  /** Remaining query params (tab/view/zone are surfaced above, not here). */
  params: Record<string, string>;
}

/**
 * Parse a location. Accepts the PRD hash form ('#/overview?tab=usage') AND
 * the browser form ('/overview?tab=usage' or a bare search-less pathname).
 * Strips query → {path, tab, view, zone, params}.
 */
export function parseHash(location: string): ParsedLocation {
  let rest = location.trim();
  if (rest.startsWith('#')) rest = rest.slice(1);
  const q = rest.indexOf('?');
  const rawPath = q === -1 ? rest : rest.slice(0, q);
  const search = q === -1 ? '' : rest.slice(q + 1);
  const query = new URLSearchParams(search);
  const params: Record<string, string> = {};
  query.forEach((value, key) => {
    if (key !== 'tab' && key !== 'view' && key !== 'zone') params[key] = value;
  });
  const path = rawPath.length === 0 || rawPath === '/' ? '/' : rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  return {
    path,
    tab: query.get('tab') ?? '',
    view: query.get('view') ?? '',
    zone: query.get('zone') ?? '',
    params,
  };
}

/** Anything that can be rendered to a canonical hash: a route entry, a
 * redirect target, or a hand-built locator. */
export interface RouteTarget {
  path: string;
  tab?: string;
  view?: string;
  zone?: string;
}

/** Build the canonical '#/path?tab=…&view=…&zone=…' hash for a target
 * (query keys are emitted in tab → view → zone order). */
export function hashFor(target: RouteTarget): string {
  const query = new URLSearchParams();
  if (target.tab) query.set('tab', target.tab);
  if (target.view) query.set('view', target.view);
  if (target.zone) query.set('zone', target.zone);
  const qs = query.toString();
  return `#${target.path}${qs === '' ? '' : `?${qs}`}`;
}

/** Render an entry's react-router path, substituting ':param' segments from
 * `params` (e.g. {employeeId: 'emp_001'} → '/employees/emp_001/config').
 * Unknown params stay literal so a missing id fails visibly, not silently. */
export function pathFor(entry: RouteTarget, params: Record<string, string> = {}): string {
  return entry.path.replace(/:(\w+)/g, (whole: string, name: string) => params[name] ?? whole);
}

function pathKey(target: RouteTarget): string {
  return `${target.path}?tab=${target.tab ?? ''}`;
}

const REDIRECT_INDEX = new Map<string, ConsoleRedirect>();
for (const redirect of REDIRECTS) {
  REDIRECT_INDEX.set(redirect.from.hash, redirect);
  REDIRECT_INDEX.set(pathKey(redirect.from), redirect);
}

/** Resolve one of the appendix A.2 redirect-only forms (23 + matrix row = 24)
 *  to its canonical
 * target hash. Accepts '#/…', '/…', or '/…?tab=…' spellings. Returns null
 * for anything that is not redirect-only. */
export function resolveRedirect(location: string): string | null {
  const raw = location.trim();
  const direct = REDIRECT_INDEX.get(raw) ?? REDIRECT_INDEX.get(raw.startsWith('#') ? raw.slice(1) : raw);
  if (direct) return direct.to.hash;
  const parsed = parseHash(raw);
  const hit = REDIRECT_INDEX.get(pathKey(parsed));
  return hit ? hit.to.hash : null;
}

/** TAB_ALIAS + VIEW_ALIAS resolution (mirrors skeleton L6582-6585: the
 * view chip is only honoured when the tab itself was aliased). */
export function resolveTab(module: ConsoleModule, tab: string): { tab: string; view: string } {
  const alias = TAB_ALIAS[module];
  const aliased = alias ? alias[tab] : undefined;
  if (aliased === undefined) return { tab, view: '' };
  return { tab: aliased, view: VIEW_ALIAS[`${module}.${tab}`] ?? '' };
}

/** Match a concrete pathname against a ':param' pattern. */
function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const want = pattern.split('/').filter((s: string) => s.length > 0);
  const got = pathname.split('/').filter((s: string) => s.length > 0);
  if (want.length !== got.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < want.length; i += 1) {
    const w = want[i] as string;
    const g = got[i] as string;
    if (w.startsWith(':')) params[w.slice(1)] = g;
    else if (w !== g) return null;
  }
  return params;
}

export interface RouteMatch {
  entry: ConsoleRoute;
  params: Record<string, string>;
}

/**
 * Locate the ROUTE_TABLE entry for a concrete location. Resolution order:
 *   1. appendix A.2 redirect-only → recurse on the canonical target hash;
 *   2. exact (path pattern, tab, view, zone) match against a ROUTE_TABLE row
 *      (compat rows match their aliased tab value verbatim);
 *   3. default-tab tolerance: '?tab=<module default>' is treated as absent
 *      so '/identity?tab=people' still lands on row 9;
 *   4. ZONE_ALIAS normalization for employee-detail zone queries.
 * Returns null for unknown locations — the App layer owns the fallback to
 * overview (PRD Section 7); this module deliberately does not decide it.
 */
export function findRoute(location: string): RouteMatch | null {
  const redirected = resolveRedirect(location);
  if (redirected !== null && redirected !== location.trim()) return findRoute(redirected);

  const raw = location.trim();
  const parsed = parseHash(raw);
  const zone: string = ZONE_ALIAS[parsed.zone] ?? parsed.zone;

  // Pass 0 — exact appendix A hash literal (crawl/PRD forms whose own `path`
  // uses the react-router segment spelling instead of the ?zone= query).
  for (const entry of ROUTE_TABLE) {
    if (entry.hash === raw || entry.hash === `#${raw}`) {
      return { entry, params: matchPath(entry.path, parsed.path) ?? {} };
    }
  }

  // Pass 1 — exact (path pattern, tab, view, zone) match.
  for (const entry of ROUTE_TABLE) {
    const patterns = [entry.path];
    // Query-form zones ('/employees/e1?zone=config') also address the
    // segment-form row; only when the zone actually names this entry.
    if (entry.zone !== undefined && entry.zone !== 'workbench' && entry.zone === zone) patterns.push(DETAIL_TAB.path);
    let params: Record<string, string> | null = null;
    for (const pattern of patterns) {
      params = matchPath(pattern, parsed.path);
      if (params !== null) break;
    }
    if (params === null) continue;
    const entryTab = entry.tab ?? '';
    const entryZone = entry.zone ?? '';
    // Workbench is the default zone: row 23's PRD literal has no zone query,
    // so an absent ?zone matches an entry whose zone is its own default.
    const parsedZone = zone === '' ? entryZone : zone;
    if (entryTab !== parsed.tab) continue;
    if ((entry.view ?? '') !== parsed.view) continue;
    if (parsedZone !== entryZone) continue;
    return { entry, params };
  }

  // Default-tab tolerance pass: only reaches here when the exact pass found
  // nothing, i.e. parsed.tab names a tab but no row carries it as a query.
  // Accept it iff it equals the module-default row's own tabId (row 9 style:
  // '/identity?tab=people' lands on '#/identity').
  for (const entry of ROUTE_TABLE) {
    const params = matchPath(entry.path, parsed.path);
    if (params === null) continue;
    if ((entry.tab ?? '') !== '') continue;
    if (parsed.tab === '' || parsed.tab !== entry.tabId) continue;
    const entryZone = entry.zone ?? '';
    const parsedZone = zone === '' ? entryZone : zone;
    if (parsedZone !== entryZone) continue;
    if ((entry.view ?? '') !== parsed.view) continue;
    return { entry, params };
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * Count-law self-check (freezes the appendix A transcription).
 * Throws at module load if a row was silently added/dropped in review.
 * ------------------------------------------------------------------ */

const kindCount = (kind: RouteKind): number => ROUTE_TABLE.filter((r) => r.kind === kind).length;
const countsOk =
  ROUTE_TABLE.length === 51 &&
  CONSOLE_TABS.length === 22 &&
  CONSOLE_TABS.every((t) => t.visible) &&
  TABNAME_ENTRIES.length === 23 &&
  !DETAIL_TAB.visible &&
  kindCount('detail-zone') === 5 &&
  kindCount('view') === 5 &&
  kindCount('compat-tab') === 14 &&
  kindCount('compat-module') === 5 &&
  REDIRECTS.length === 24 &&
  CONSOLE_MODULES.length === 8;
if (!countsOk) {
  throw new Error(
    `[shell/routes] appendix A count law violated: routes=${ROUTE_TABLE.length} (want 51) ` +
      `visible=${CONSOLE_TABS.length} (want 22) tabnames=${TABNAME_ENTRIES.length} (want 23) ` +
      `detail=${kindCount('detail-zone')}/5 view=${kindCount('view')}/5 ` +
      `compatTab=${kindCount('compat-tab')}/14 compatModule=${kindCount('compat-module')}/5 ` +
      `redirects=${REDIRECTS.length}/24 modules=${CONSOLE_MODULES.length}/8`,
  );
}
