import { type ReactNode } from "react";
import {
  Activity,
  ListChecks,
  MessageSquare,
  ScrollText,
} from "lucide-react";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { Tabs, TabsList, TabsTrigger } from "@nous-research/ui/ui/components/tabs";
import { H2 } from "@nous-research/ui/ui/components/typography/h2";

import { cn } from "@/lib/utils";

import {
  EmptyBlock,
  ErrorStateBlock,
  RowsSkeleton,
  StatusBadge,
  WORK,
  beijing,
  countDash,
  displayName,
  idOf,
  isRecord,
  money,
  pickStr,
  refLabel,
  type Rec,
} from "@/pages/EmployeesPage";

import { useGuardedRows } from "./fetchState";

/**
 * 活动分区（PE-03 五分区之五）：PE-02 已修复并钉死的四区块——
 *   聊天 → /agent-api/api/sessions?employeeId=
 *   任务 → /agent-api/api/tasks?assignee=employee:&limit=20
 *   运行 → /agent-api/api/runs?employeeId=&limit=20
 *   审计 → /agent-api/api/audit?resourceId=&limit=50
 * 原样合并为一个分区（参数名与 limit 一字不动），子标签页各自维护
 * loading/ready/failed+原因+请求号/empty 四态，共用防串数据护栏。
 */

/** 引用字段的两种形制：现网 tasks/audit 给 `{type:"employee", id}` 对象，旧形制给
 *  字符串。refLabel 只认字符串，所以先摊平成 id，否则有指派的行会显示「未指派」。 */
function refValue(value: unknown): unknown {
  if (isRecord(value)) return value.id;
  return value;
}

/** 行 key：优先 id，再退到各端点的专属 id 字段，最后落序号（与原页面一致）。 */
function rowKeyOf(row: Rec, i: number): string {
  return idOf(row) ?? pickStr(row, ["uuid", "run_id", "task_id", "session_id", "audit_id", "event_id"]) ?? `row-${i}`;
}

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

const BLOCKS = [
  { value: "chat", label: "聊天" },
  { value: "tasks", label: "任务" },
  { value: "runs", label: "运行" },
  { value: "audit", label: "审计" },
] as const;

export default function ActivityPane({
  rawId,
  enc,
  initialBlock = "chat",
}: {
  rawId: string;
  enc: string;
  /** ?zone=tasks|runs|evidence 旧深链映射进来时直投对应区块（PE-03 兼容条款）。 */
  initialBlock?: string;
}) {
  const initial = BLOCKS.some((b) => b.value === initialBlock)
    ? (initialBlock as (typeof BLOCKS)[number]["value"])
    : "chat";

  return (
    <div className="flex flex-col gap-3" data-testid="emp-detail-zone-activity">
      <Tabs defaultValue={initial}>
        {(active, setActive) => (
          <>
            <TabsList role="tablist" aria-label="活动区块" className="w-full overflow-x-auto scrollbar-none">
              {BLOCKS.map((block) => (
                <TabsTrigger
                  key={block.value}
                  role="tab"
                  value={block.value}
                  id={`tab-${block.value}`}
                  aria-selected={active === block.value}
                  aria-controls={`panel-${block.value}`}
                  active={active === block.value}
                  onClick={() => setActive(block.value)}
                >
                  {block.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} className="pt-1">
              {active === "chat" && (
                <Section
                  url={`/agent-api/api/sessions?employeeId=${enc}`}
                  employeeId={rawId}
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
                  url={`/agent-api/api/tasks?assignee=employee:${enc}&limit=20`}
                  employeeId={rawId}
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
                  url={`/agent-api/api/runs?employeeId=${enc}&limit=20`}
                  employeeId={rawId}
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
                  url={`/agent-api/api/audit?resourceId=${enc}&limit=50`}
                  employeeId={rawId}
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
    </div>
  );
}

// ── 通用区块（独立四态 + 防串护栏） ──────────────────────────────────────

function Section({
  url,
  employeeId,
  icon,
  title,
  emptyText,
  emptyHint,
  deniedTitle,
  errorTitle,
  renderItem,
}: {
  url: string;
  employeeId: string;
  icon: ReactNode;
  title: string;
  emptyText: string;
  emptyHint: string;
  deniedTitle: string;
  errorTitle: string;
  renderItem: (row: Rec) => ReactNode;
}) {
  const { state, reload } = useGuardedRows(url, employeeId);

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
  const assigneeRef = refValue(t.assignee ?? t.owner ?? t.assigned_to ?? t.assignedTo);
  const assignee = refLabel(assigneeRef);
  const when = beijing(t.updated_at ?? t.due_at ?? t.created_at);
  return (
    <RowShell>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-medium" title={idOf(t) ?? undefined}>{dn.text}</span>
        <StatusBadge value={t.status ?? t.state} table={WORK} />
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span title={typeof assigneeRef === "string" ? assigneeRef : undefined}>指派：{assignee ?? "未指派"}</span>
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
  const actorRef = refValue(a.actor ?? a.by ?? a.user ?? a.principal ?? a.who);
  const actor = refLabel(actorRef);
  const action = pickStr(a, ["action", "event", "type", "operation", "name", "summary", "message"]);
  return (
    <RowShell>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-medium">{action ?? "—"}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{when}</span>
      </div>
      <div className="text-xs text-muted-foreground" title={typeof actorRef === "string" ? actorRef : undefined}>
        操作者：{actor ?? "未指派"}
      </div>
    </RowShell>
  );
}
