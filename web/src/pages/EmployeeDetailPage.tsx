import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import {
  Activity,
  ArrowLeft,
  CircleDollarSign,
  ListChecks,
  MessageSquare,
  ScrollText,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";
import { Tabs, TabsList, TabsTrigger } from "@nous-research/ui/ui/components/tabs";
import { H2 } from "@nous-research/ui/ui/components/typography/h2";

import { fetchJSON } from "@/lib/api";
import { cn } from "@/lib/utils";

import {
  EmptyBlock,
  ErrorStateBlock,
  LIFECYCLE,
  RowsSkeleton,
  StatusBadge,
  WORK,
  beijing,
  countDash,
  displayName,
  errStatus,
  humanize,
  idOf,
  isRecord,
  lifecycleOf,
  money,
  nameOf,
  pickStr,
  refLabel,
  requestIdOf,
  type BlockState,
  type Rec,
} from "@/pages/EmployeesPage";

/**
 * 数字员工详情页（只读）：概览 / 聊天 / 任务 / 运行 / 审计 五个 Tab。
 *
 * 数据全部来自 BFF（Caddy 代理到 8092）。概览读 `/agent-api/api/employees/:id`，
 * 其余四个 Tab 各读各的端点、各自维护加载/空/错误/无权限四态，互不牵连；任一端点
 * 没上线时只降级它自己那一块，绝不编造行。整页没有任何写操作。
 *
 * 路由约定（编排方接线）：本页 `/employees/:id`，返回链回 `/employees`。
 */

// ── 详情对象 + 单区块状态机 ───────────────────────────────────────────────

type EmployeeState = BlockState<Rec>;

function failedState(err: unknown): EmployeeState {
  return {
    k: "error",
    status: errStatus(err),
    message: humanize(err),
    requestId: requestIdOf(err),
  };
}

/** 详情主体：先 /employees/:id，再退到 /matrix/:id。 */
function useEmployeeDetail(rawId: string): { state: EmployeeState; reload: () => void } {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<EmployeeState>({ k: "loading" });
  const id = encodeURIComponent(rawId);

  useEffect(() => {
    if (!rawId) {
      setState({ k: "ready", data: {} });
      return;
    }
    let alive = true;
    setState({ k: "loading" });
    const primary = `/agent-api/api/employees/${id}`;
    const fallback = `/agent-api/api/matrix/${id}`;
    const unwrap = (raw: unknown): Rec => {
      if (isRecord(raw) && isRecord(raw.employee)) return raw.employee as Rec;
      if (isRecord(raw) && isRecord(raw.data)) return raw.data as Rec;
      return isRecord(raw) ? raw : {};
    };
    fetchJSON<unknown>(primary)
      .then((raw) => alive && setState({ k: "ready", data: unwrap(raw) }))
      .catch((err1: unknown) =>
        fetchJSON<unknown>(fallback)
          .then((raw) => alive && setState({ k: "ready", data: unwrap(raw) }))
          .catch((err2: unknown) => alive && setState(failedState(err1 instanceof Error && errStatus(err1) ? err1 : err2))),
      );
    return () => {
      alive = false;
    };
  }, [id, rawId, nonce]);

  return { state, reload: () => setNonce((n) => n + 1) };
}

/** 单个 Tab 列表端点（带 employee 过滤），各 Tab 独立加载。 */
function useEmployeeList(url: string): { state: BlockState<Rec[]>; reload: () => void } {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<BlockState<Rec[]>>({ k: "loading" });

  useEffect(() => {
    let alive = true;
    setState({ k: "loading" });
    fetchJSON<unknown>(url)
      .then((raw) => alive && setState({ k: "ready", data: asRows(raw) }))
      .catch((err: unknown) => {
        if (alive)
          setState({
            k: "error",
            status: errStatus(err),
            message: humanize(err),
            requestId: requestIdOf(err),
          });
      });
    return () => {
      alive = false;
    };
  }, [url, nonce]);

  return { state, reload: () => setNonce((n) => n + 1) };
}

function asRows(raw: unknown): Rec[] {
  if (Array.isArray(raw)) return raw.filter(isRecord);
  if (isRecord(raw)) {
    for (const k of ["items", "results", "data", "rows", "list", "runs", "tasks", "audit", "events", "sessions"]) {
      const v = raw[k];
      if (Array.isArray(v)) return v.filter(isRecord);
    }
  }
  return [];
}

// ── 页面 ─────────────────────────────────────────────────────────────────

const TABS = [
  { value: "overview", label: "概览" },
  { value: "chat", label: "聊天" },
  { value: "tasks", label: "任务" },
  { value: "runs", label: "运行" },
  { value: "audit", label: "审计" },
] as const;

export default function EmployeeDetailPage() {
  // Snapshot fix (PRD §9.1 lane A): the live route registers `:employeeId`
  // (App PATH_COMPONENT '/employees/:employeeId' and shell/routes DETAIL_TAB
  // agree on this spelling), so reading only `id` — the stale snapshot shape
  // — gave rawId === "" for every real visit and the page always fell to the
  // empty state. Both spellings are accepted, `employeeId` authoritative,
  // so the legacy-`:id` test harness keeps passing too.
  const params = useParams<{ employeeId?: string; id?: string }>();
  const rawParam = params.employeeId ?? params.id ?? "";
  const rawId = rawParam !== "" ? decodeURIComponent(rawParam) : "";
  const { state, reload } = useEmployeeDetail(rawId);

  const detail = state.k === "ready" ? state.data : null;
  const dn = detail ? displayName(nameOf(detail), (idOf(detail) ?? rawId) || null) : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          to="/employees"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
        >
          <ArrowLeft className="h-4 w-4" />
          返回数字员工
        </Link>
      </div>

      {!rawId && (
        <EmptyBlock text="无法确定要查看的员工" hint="链接里缺少员工编号。请回到数字员工列表，从列表中重新进入。" />
      )}

      {rawId && state.k === "loading" && (
        <>
          <DetailHeaderSkeleton />
          <RowsSkeleton rows={3} />
        </>
      )}

      {rawId && state.k === "error" && (
        <ErrorStateBlock
          status={state.status}
          message={state.message}
          requestId={state.requestId}
          deniedTitle="无法打开该员工"
          errorTitle="无法加载该员工"
          onRetry={reload}
        />
      )}

      {rawId && detail && (
        <>
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted/20 text-muted-foreground">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate font-mondwest text-lg tracking-wider" title={rawId || undefined}>
                  {dn?.text ?? "—"}
                </h1>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge value={lifecycleOf(detail)} table={LIFECYCLE} unknownLabel="待核实" />
                </div>
              </div>
            </div>
            {dn?.raw && <span className="text-xs text-muted-foreground">工位编号仅用于系统标识</span>}
          </header>

          <Tabs defaultValue="overview">
            {(active, setActive) => (
              <>
                <TabsList role="tablist" aria-label="员工详情分区" className="w-full overflow-x-auto scrollbar-none">
                  {TABS.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      role="tab"
                      value={tab.value}
                      id={`tab-${tab.value}`}
                      aria-selected={active === tab.value}
                      aria-controls={`panel-${tab.value}`}
                      active={active === tab.value}
                      onClick={() => setActive(tab.value)}
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} className="pt-1">
                  {active === "overview" && <OverviewPanel detail={detail} rawId={rawId} />}
                  {active === "chat" && (
                    <Section
                      url={`/agent-api/api/sessions?employee=${encodeURIComponent(rawId)}`}
                      icon={<MessageSquare className="h-4 w-4 shrink-0" />}
                      title="聊天"
                      emptyText="暂无聊天"
                      emptyHint="这位员工还没有产生可展示的会话记录。"
                      deniedTitle="无法打开聊天"
                      errorTitle="聊天加载失败"
                      renderItem={(s) => <ChatRow s={s} />}
                    />
                  )}
                  {active === "tasks" && (
                    <Section
                      url={`/agent-api/api/tasks?employee=${encodeURIComponent(rawId)}`}
                      icon={<ListChecks className="h-4 w-4 shrink-0" />}
                      title="任务"
                      emptyText="暂无任务"
                      emptyHint="这位员工当前没有进行中或历史任务记录。"
                      deniedTitle="无法打开任务"
                      errorTitle="任务加载失败"
                      renderItem={(t) => <TaskRow t={t} />}
                    />
                  )}
                  {active === "runs" && (
                    <Section
                      url={`/agent-api/api/runs?employee=${encodeURIComponent(rawId)}`}
                      icon={<Activity className="h-4 w-4 shrink-0" />}
                      title="运行"
                      emptyText="暂无运行"
                      emptyHint="这位员工还没有运行记录。"
                      deniedTitle="无法打开运行"
                      errorTitle="运行加载失败"
                      renderItem={(r) => <RunRow r={r} />}
                    />
                  )}
                  {active === "audit" && (
                    <Section
                      url={`/agent-api/api/audit?employee=${encodeURIComponent(rawId)}`}
                      icon={<ScrollText className="h-4 w-4 shrink-0" />}
                      title="审计"
                      emptyText="暂无审计记录"
                      emptyHint="这位员工还没有可展示的审计事件。"
                      deniedTitle="无法打开审计"
                      errorTitle="审计加载失败"
                      renderItem={(a) => <AuditRow a={a} />}
                    />
                  )}
                </div>
              </>
            )}
          </Tabs>
        </>
      )}
    </div>
  );
}

// ── 概览 ─────────────────────────────────────────────────────────────────

function OverviewPanel({ detail, rawId }: { detail: Rec; rawId: string }) {
  const station = pickStr(detail, ["station", "seat", "workspace", "role", "position", "desk"]);
  const model = pickStr(detail, ["model", "model_name"]);
  const provider = pickStr(detail, ["provider"]);
  const owner = refLabel(detail.owner ?? detail.manager ?? detail.created_by ?? detail.assignee);
  const created = beijing(detail.created_at ?? detail.createdAt ?? detail.created);
  const lastSeen = beijing(detail.last_seen ?? detail.last_active ?? detail.last_active_at ?? detail.updated_at);
  const spend = money(detail.spend ?? detail.spent ?? detail.cost ?? detail.usage_cost ?? detail.budget_spent);

  const stats = isRecord(detail.stats) || isRecord(detail.metrics) || isRecord(detail.summary)
    ? ((detail.stats ?? detail.metrics ?? detail.summary) as Rec)
    : null;
  const kpis = useMemo(() => {
    const src = stats ?? detail;
    return {
      tasks: pickStr(src, ["tasks", "tasks_count", "task_count", "total_tasks", "open_tasks", "pending_tasks"]),
      runs: pickStr(src, ["runs", "runs_count", "run_count", "total_runs"]),
      sessions: pickStr(src, ["sessions", "sessions_count", "chat_count", "total_sessions"]),
    };
  }, [stats, detail]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Info term="工位">{station ?? "—"}</Info>
            <Info term="身份" raw={rawId}>{displayName(nameOf(detail), (idOf(detail) ?? rawId) || null).text}</Info>
            <Info term="模型" raw={model ?? undefined}>{model ?? "—"}</Info>
            <Info term="模型提供方">{provider ?? "—"}</Info>
            <Info term="负责人">{owner ?? "未指派"}</Info>
            <Info term="在岗状态">
              <StatusBadge value={lifecycleOf(detail)} table={LIFECYCLE} unknownLabel="待核实" />
            </Info>
            <Info term="创建时间">{created}</Info>
            <Info term="最近活动">{lastSeen}</Info>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
            预算与支出
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <Info term="支出">{spend}</Info>
            <Info term="预算">{hasMoney(detail.budget) ? money(detail.budget) : "—"}</Info>
            <Info term="剩余">{hasMoney(detail.remaining ?? detail.budget_remaining) ? money(detail.remaining ?? detail.budget_remaining) : "—"}</Info>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">金额为美元；未提供的项目显示「—」，未计价的成本显示「未计价」。</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">工作量</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <Kpi label="任务" value={kpis.tasks} />
            <Kpi label="运行" value={kpis.runs} />
            <Kpi label="会话" value={kpis.sessions} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function hasMoney(v: unknown): boolean {
  if (typeof v === "number") return Number.isFinite(v);
  return typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v));
}

function Info({ term, raw, children }: { term: string; raw?: string | null; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="mt-0.5 truncate text-sm" title={raw ?? undefined}>
        {children}
      </dd>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-md border border-border/60 bg-muted/10 px-2 py-3 text-center">
      <span className="text-lg font-semibold tabular-nums">{value ?? "—"}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// ── 通用 Tab 区块（独立四态） ──────────────────────────────────────────────

function Section({
  url,
  icon,
  title,
  emptyText,
  emptyHint,
  deniedTitle,
  errorTitle,
  renderItem,
}: {
  url: string;
  icon: ReactNode;
  title: string;
  emptyText: string;
  emptyHint: string;
  deniedTitle: string;
  errorTitle: string;
  renderItem: (row: Rec) => ReactNode;
}) {
  const { state, reload } = useEmployeeList(url);

  return (
    <div className="flex flex-col gap-3">
      <H2 variant="sm" className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {title}
        {state.k === "ready" && state.data.length > 0 && <span>（{state.data.length}）</span>}
      </H2>

      {state.k === "loading" && <RowsSkeleton rows={3} />}

      {state.k === "error" && (
        <ErrorStateBlock
          status={state.status}
          message={state.message}
          requestId={state.requestId}
          deniedTitle={deniedTitle}
          errorTitle={errorTitle}
          onRetry={reload}
        />
      )}

      {state.k === "ready" &&
        (state.data.length === 0 ? (
          <EmptyBlock text={emptyText} hint={emptyHint} />
        ) : (
          <ul className="flex flex-col gap-2">{state.data.map((row, i) => <li key={rowKeyOf(row, i)}>{renderItem(row)}</li>)}</ul>
        ))}
    </div>
  );
}

function rowKeyOf(row: Rec, i: number): string {
  return idOf(row) ?? pickStr(row, ["uuid", "run_id", "task_id", "session_id", "audit_id", "event_id"]) ?? `row-${i}`;
}

function RowShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card>
      <CardContent className={cn("flex flex-col gap-1.5 py-3 text-sm", className)}>{children}</CardContent>
    </Card>
  );
}

function ChatRow({ s }: { s: Rec }) {
  const dn = displayName(pickStr(s, ["title", "name", "subject"]), idOf(s));
  const when = beijing(s.last_active ?? s.last_active_at ?? s.updated_at ?? s.started_at ?? s.created_at);
  const msgs = countDash(s.message_count ?? s.messages ?? s.msg_count);
  return (
    <RowShell>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-medium" title={idOf(s) ?? undefined}>{dn.text}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{when}</span>
      </div>
      <div className="text-xs text-muted-foreground">消息 {msgs} 条</div>
    </RowShell>
  );
}

function TaskRow({ t }: { t: Rec }) {
  const dn = displayName(pickStr(t, ["title", "name", "subject", "summary"]), idOf(t));
  const assignee = refLabel(t.assignee ?? t.owner ?? t.assigned_to ?? t.assignedTo);
  const when = beijing(t.updated_at ?? t.due_at ?? t.created_at);
  return (
    <RowShell>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-medium" title={idOf(t) ?? undefined}>{dn.text}</span>
        <StatusBadge value={t.status ?? t.state} table={WORK} />
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span title={typeof t.assignee === "string" ? t.assignee : undefined}>指派：{assignee ?? "未指派"}</span>
        <span className="ml-auto">{when}</span>
      </div>
    </RowShell>
  );
}

function RunRow({ r }: { r: Rec }) {
  const started = beijing(r.started_at ?? r.created_at ?? r.start_time ?? r.timestamp);
  const cost = money(r.cost ?? r.spend ?? r.total_cost ?? r.usage_cost);
  const dur = duration(r.duration ?? r.duration_seconds ?? r.elapsed);
  const tokens = countDash(r.tokens ?? r.total_tokens ?? (r.input_tokens != null || r.output_tokens != null ? num(r.input_tokens) + num(r.output_tokens) : null));
  return (
    <RowShell>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-medium" title={idOf(r) ?? undefined}>
          {pickStr(r, ["name", "title", "job", "label"]) ?? (idOf(r) ? refLabel(idOf(r)!) : "一次运行")}
        </span>
        <StatusBadge value={r.status ?? r.state ?? r.result} table={WORK} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{started}</span>
        <span>耗时 {dur}</span>
        <span>用量 {tokens}</span>
        <span className="ml-auto">{cost}</span>
      </div>
    </RowShell>
  );
}

function AuditRow({ a }: { a: Rec }) {
  const when = beijing(a.created_at ?? a.timestamp ?? a.at ?? a.time ?? a.occurred_at);
  const actor = refLabel(a.actor ?? a.by ?? a.user ?? a.principal ?? a.who);
  const action = pickStr(a, ["action", "event", "type", "operation", "name", "summary", "message"]);
  return (
    <RowShell>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-medium">{action ?? "—"}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{when}</span>
      </div>
      <div className="text-xs text-muted-foreground" title={typeof a.actor === "string" ? a.actor : undefined}>
        操作者：{actor ?? "未指派"}
      </div>
    </RowShell>
  );
}

// ── 小工具 ───────────────────────────────────────────────────────────────

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function duration(value: unknown): string {
  if (value == null || value === "") return "—";
  let secs: number | null = null;
  if (typeof value === "number") secs = value;
  else if (typeof value === "string" && /^\d+(\.\d+)?$/.test(value.trim())) secs = Number(value);
  if (secs == null || !Number.isFinite(secs) || secs < 0) return "—";
  const s = Math.round(secs);
  if (s < 60) return `${s} 秒`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m} 分 ${rs} 秒`;
  const h = Math.floor(m / 60);
  return `${h} 时 ${m % 60} 分`;
}

function DetailHeaderSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-muted/20" />
      <div className="flex flex-col gap-2">
        <div className="h-5 w-44 animate-pulse rounded-sm bg-muted/20" />
        <div className="h-4 w-24 animate-pulse rounded-sm bg-muted/20" />
      </div>
    </div>
  );
}
