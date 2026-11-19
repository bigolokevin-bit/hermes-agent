import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowRight, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";

import { cn } from "@/lib/utils";
import {
  activity24,
  bucketPeak,
  buildBlockers,
  buildCost,
  buildReadiness,
  dailyBuckets,
  lifecycleTotal,
  pendingView,
  runTotals,
} from "./aggregate";
import { beijing, beijingHour, beijingWeekday, dashed, duration, shortId, usd } from "./format";
import type {
  ActivityBody,
  ApprovalRow,
  ApprovalStatsBody,
  BlockerItem,
  BudgetBody,
  EmployeeRow,
  GateView,
  Loadable,
  RunRow,
  RunStatsBody,
  TaskRow,
} from "./types";
import { useDutyData } from "./useDutyData";
import "./duty.css";

type Tone = "default" | "destructive" | "outline" | "secondary" | "success" | "warning";

function StateLine({
  state,
  onRetry,
  loadingText = "正在读取…",
  emptyText,
  emptyTo,
  emptyLink,
  children,
}: {
  state: Loadable<unknown>;
  onRetry: () => void;
  loadingText?: string;
  emptyText?: string;
  emptyTo?: string;
  emptyLink?: string;
  children: ReactNode;
}) {
  if (state.k === "loading") {
    return (
      <div className="duty-skeleton" aria-busy="true" aria-label={loadingText}>
        <span />
        <span />
        <span />
      </div>
    );
  }
  if (state.k === "error") {
    return (
      <div className="duty-error" role="alert">
        <p>{state.message}</p>
        <p className="duty-req">
          {state.requestId ? `请求编号 ${state.requestId}` : "本次请求未记录编号，可复制时间与操作路径反馈"}
        </p>
        <Button size="sm" outlined onClick={onRetry} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
          重试
        </Button>
      </div>
    );
  }
  if (emptyText) {
    return (
      <div className="duty-empty">
        <p>{emptyText}</p>
        {emptyTo && emptyLink ? (
          <Link className="duty-link" to={emptyTo}>
            {emptyLink}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
    );
  }
  return <>{children}</>;
}

function HCard({
  title,
  meta,
  action,
  children,
  testid,
  stamp,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  testid: string;
  stamp?: { shown: string | null; source: string; reason?: string };
}) {
  return (
    <Card
      className="duty-card"
      data-card="duty"
      data-testid={testid.replace(/^duty-/, "ov6-")}
      data-duty-testid={testid}
    >
      <CardContent className="duty-card-bd">
        <div className="duty-card-hd">
          <h2>{title}</h2>
          <span className="duty-meta">{action ?? meta}</span>
        </div>
        {stamp ? (
          <p
            className="duty-note"
            data-testid={`${testid.replace(/^duty-/, "ov6-")}-stamp`}
            data-duty-testid={`${testid}-stamp`}
            title={
              stamp.shown
                ? `来源：${stamp.source}；采集时间取自上游响应`
                : `取不到采集时间：${stamp.reason ?? "上游响应没有带采集时间"}`
            }
          >
            数据截至 {stamp.shown ?? "—"} · 来源 {stamp.source}
          </p>
        ) : null}
        {children}
      </CardContent>
    </Card>
  );
}

/** R32 item 1: honest per-card collection time — only from upstream payloads. */
function asOfOf(x: unknown): string | null {
  if (x && typeof x === "object" && !Array.isArray(x)) {
    const rec = x as Record<string, unknown>;
    for (const k of ["asOf", "generatedAt", "as_of", "generated_at"]) {
      const v = rec[k];
      if (typeof v === "string" && v.trim() !== "") return v;
    }
  }
  return null;
}

function legReason(legs: readonly { k: string }[]): string {
  if (legs.some((l) => l.k === "loading")) return "数据还在读取";
  if (legs.some((l) => l.k === "error")) return "本次读取失败，取不到采集时间";
  return "上游响应没有带采集时间";
}

function stampOf(
  raw: string | null,
  source: string,
  legs: readonly { k: string }[],
): { shown: string | null; source: string; reason?: string } {
  return { shown: raw ? beijing(raw) : null, source, reason: raw ? undefined : legReason(legs) };
}

function gateRoute(gate: GateView): string {
  const text = `${gate.name}${gate.source}`;
  if (text.includes("审批")) return "/approvals";
  if (text.includes("运行")) return "/runs";
  return "/employees";
}

function GateRow({ gate, narrowest }: { gate: GateView; narrowest: boolean }) {
  const unknown = gate.state === "unknown";
  return (
    <div
      className={cn("duty-gate", narrowest && "is-narrow")}
      data-testid={`ov6-gate-${gate.key}`}
      data-duty-testid={`duty-gate-${gate.key}`}
      // R7.1 item 8: the internal gate code (V1…V6) and the fact that a state
      // is inferred live in the tooltip, never on screen.
      title={`${gate.key} · ${gate.name}${gate.inferred ? " · 当前状态由现有数据推断，待数据源接入后确认" : ""}`}
    >
      <span className="duty-gate-name">{gate.name}</span>
      <span className={cn("duty-gate-value", unknown && "is-unknown")}>
        {unknown ? "待核实" : `${dashed(gate.pass)} / ${dashed((gate.pass ?? 0) + (gate.fail ?? 0))}`}
      </span>
      <Link className="duty-gate-source" to={gateRoute(gate)} title={gate.source}>
        {gate.source}
      </Link>
      {gate.state === "unknown" ? (
        <span className="duty-gate-asof text-xs text-muted-foreground" title={`${gate.code}：该数据源尚未接入，没有采集时间`}>
          未接入 · 截至 —
        </span>
      ) : gate.asOf ? (
        <span className="duty-gate-asof text-xs text-muted-foreground">截至 {gate.asOf}</span>
      ) : (
        <span className="duty-gate-asof text-xs text-muted-foreground" title="来源回答未携带采集时间">截至 —</span>
      )}
      <i
        className={cn("duty-dot", unknown ? "is-unknown" : gate.state === "pass" ? "is-ok" : "is-warn")}
        title={unknown ? "证据源缺失，暂不计入可上岗人数" : gate.state === "pass" ? "通过" : `${gate.fail ?? "—"} 人未达`}
      />
    </div>
  );
}

function ReadinessCard({ employees, stats, onRetry }: { employees: Loadable<EmployeeRow[]>; stats: Loadable<Record<string, unknown>>; onRetry: () => void }) {
  const rawStamp =
    stats.k === "ready"
      ? (typeof stats.data.asOf === "string" && stats.data.asOf) ||
        (typeof stats.data.generatedAt === "string" && stats.data.generatedAt) ||
        null
      : null;
  const readiness = buildReadiness(
    employees.k === "ready" ? employees.data : null,
    stats.k === "ready" ? stats.data : null,
    rawStamp ? beijing(rawStamp) : null,
  );
  const state = employees.k === "error" ? employees : stats.k === "error" ? stats : employees;
  return (
    <HCard title="可上岗" meta="各项检查全部通过才计入" testid="duty-ready" stamp={stampOf(rawStamp, "员工目录与运行统计", [employees, stats])}>
      <StateLine state={state} onRetry={onRetry} loadingText="正在汇总各项检查…">
        <p className="duty-num" data-testid="ov6-ready-value" data-duty-testid="duty-ready-value">
          <span data-testid="ov6-kpi-employees" data-duty-testid="duty-kpi-employees">
            {readiness.confirmed === null ? "—" : readiness.confirmed}
          </span>
          <em>{readiness.total === null ? "—" : `/ ${readiness.total} 可上岗`}</em>
        </p>
        <p className="duty-say">
          {readiness.unknownGates > 0
            ? `${readiness.unknownGates} 项检查的数据源尚未接入，可上岗人数暂不能判定`
            : readiness.confirmed === readiness.total
              ? "各项检查全部通过，在册员工均可上岗"
              : `通过人数最少的一项：${readiness.narrowest ? readiness.narrowest.name : "待核实"}`}
        </p>
        <div className="duty-gates">
          {readiness.gates.map((g) => (
            <GateRow key={g.key} gate={g} narrowest={readiness.narrowest?.key === g.key} />
          ))}
        </div>
        <p className="duty-note">
          各项检查独立判定，全部通过才算可上岗；标「待核实」的项既不算通过，也不算不通过。
        </p>
      </StateLine>
    </HCard>
  );
}

function RunStatusBadge({ status }: { status?: string }) {
  const map: Record<string, { text: string; tone: Tone }> = {
    running: { text: "运行中", tone: "secondary" },
    pending: { text: "排队中", tone: "outline" },
    completed: { text: "成功", tone: "success" },
    failed: { text: "失败", tone: "destructive" },
    cancelled: { text: "已取消", tone: "outline" },
    interrupted: { text: "已中断", tone: "warning" },
  };
  const hit = status ? map[status] : undefined;
  return <Badge tone={hit?.tone ?? "outline"}>{hit?.text ?? "—"}</Badge>;
}

function TodayRunsCard({ stats, runs, onRetry }: { stats: Loadable<RunStatsBody>; runs: Loadable<RunRow[]>; onRetry: () => void }) {
  const totals = stats.k === "ready" ? runTotals(stats.data) : null;
  return (
    <HCard
      title="今日运行"
      testid="duty-today-runs" stamp={stampOf(asOfOf(stats.data), "运行窗口统计", [stats, runs])}
      action={
        <Link className="duty-link" to="/runs">
          运行记录
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      <StateLine state={stats} onRetry={onRetry}>
        <p className="duty-num" data-testid="ov6-kpi-runs" data-duty-testid="duty-kpi-runs">
          {totals ? totals.runs : "—"}
          <em>次</em>
        </p>
        <p className="duty-say">
          {totals
            ? `在跑 ${dashed(totals.running)} · 成功 ${dashed(totals.succeeded)} · 失败 ${dashed(totals.failed)}`
            : "服务端未返回窗口合计，暂不展示分项。"}
        </p>
        {runs.k === "ready" && runs.data.length > 0 ? (
          <ul className="duty-list">
            {runs.data.slice(0, 3).map((run) => (
              <li key={run.runId}>
                <RunStatusBadge status={run.status} />
                <Link className="duty-row-title" to={`/runs/${encodeURIComponent(run.runId)}`}>
                  {shortId(run.runId)}
                </Link>
                <span className="duty-row-time">{beijing(run.startedAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="duty-note">最近运行明细尚未返回，合计仍以服务端为准。</p>
        )}
        <p className="duty-note">今日 00:00 起 · 北京时间 · 合计来自服务端窗口统计</p>
      </StateLine>
    </HCard>
  );
}

function CostCard({
  day,
  month,
  employees,
  totalEmployees,
  onRetry,
}: {
  day: Loadable<BudgetBody>;
  month: Loadable<BudgetBody>;
  employees: Loadable<EmployeeRow[]>;
  totalEmployees: number | null;
  onRetry: () => void;
}) {
  const cost = buildCost(
    day.k === "ready" ? day.data : null,
    month.k === "ready" ? month.data : null,
    totalEmployees,
  );
  const state = day.k === "error" ? day : month.k === "error" ? month : day;
  return (
    <HCard title="今日成本" meta="成本账本" testid="duty-today-cost" stamp={stampOf(asOfOf(day.data), "当日成本账本", [day, month])}>
      <StateLine state={state} onRetry={onRetry}>
        <p className="duty-num" data-testid="ov6-kpi-cost" data-duty-testid="duty-kpi-cost">
          {usd(cost.dayUsd)}
          <em>今日</em>
        </p>
        <p className="duty-say">
          {cost.partial
            ? `账本未覆盖全部员工${cost.missing > 0 ? `（缺 ${cost.missing} 人）` : ""}，不展示合计`
            : `本月 ${usd(cost.monthUsd)}`}
        </p>
        <ul className="duty-list">
          <li>
            <span className="duty-row-title">已覆盖</span>
            <span className="duty-row-time">
              {cost.covered === null || cost.total === null ? "—" : `${cost.covered} / ${cost.total} 人`}
            </span>
          </li>
          <li>
            <span className="duty-row-title">账本口径</span>
            <span className="duty-row-time">只认账本实际金额</span>
          </li>
          {employees.k === "error" ? (
            <li>
              <span className="duty-row-title">员工名单</span>
              <span className="duty-row-time">读取失败</span>
            </li>
          ) : null}
        </ul>
        <p className="duty-note">金额 USD · 缺行不按 0 计入 · 日账与月账分开相加</p>
      </StateLine>
    </HCard>
  );
}

function TrendCard({ stats, onRetry }: { stats: Loadable<RunStatsBody>; onRetry: () => void }) {
  const totals = stats.k === "ready" ? runTotals(stats.data) : null;
  const buckets = stats.k === "ready" ? dailyBuckets(stats.data) : [];
  const peak = bucketPeak(buckets);
  const max = Math.max(1, ...buckets.map((b) => b.runs));
  return (
    <HCard title="近 14 天运行" meta="每日启动" testid="duty-trend" stamp={stampOf(asOfOf(stats.data), "近 14 天运行统计", [stats])}>
      <StateLine state={stats} onRetry={onRetry}>
        <p className="duty-num">
          {totals ? totals.runs : "—"}
          <em>{peak ? `次 · 峰值 ${peak.runs}` : "次"}</em>
        </p>
        <p className="duty-say">
          {buckets.length === 0
            ? "所选窗口没有运行记录"
            : `日均 ${(buckets.reduce((n, b) => n + b.runs, 0) / buckets.length).toFixed(1)} 次${peak ? `；峰值在 ${peak.label}` : ""}`}
        </p>
        <svg className="duty-chart" viewBox="0 0 600 120" role="img" aria-label="近 14 天每日运行次数">
          <line x1="4" y1="108" x2="596" y2="108" className="duty-axis" />
          <polyline
            className="duty-line"
            points={buckets
              .map((b, i) => {
                const x = buckets.length === 1 ? 300 : 8 + (i * 584) / (buckets.length - 1);
                const y = 100 - (b.runs / max) * 84;
                return `${x},${y}`;
              })
              .join(" ")}
          />
          {buckets.length > 0 ? (
            <text x="8" y="118" className="duty-axis-label">
              {buckets[0].label}
            </text>
          ) : null}
          {buckets.length > 1 ? (
            <text x="592" y="118" textAnchor="end" className="duty-axis-label">
              今天
            </text>
          ) : null}
        </svg>
        <p className="duty-note">近 14 天 · 按北京时间切日 · 只画有运行的桶</p>
      </StateLine>
    </HCard>
  );
}

function ActivityCard({ activity, onRetry }: { activity: Loadable<ActivityBody>; onRetry: () => void }) {
  const view = activity24(
    activity.k === "ready" ? activity.data : null,
    beijingWeekday(),
    beijingHour(),
  );
  return (
    <HCard title="24 小时活跃" meta="每格 1 小时" testid="duty-activity" stamp={stampOf(asOfOf(activity.data), "24 小时活跃统计", [activity])}>
      <StateLine state={activity} onRetry={onRetry}>
        <p className="duty-num">
          {view.peakHour === null ? "—" : `${String(view.peakHour).padStart(2, "0")}:00`}
          <em>{view.peak === null ? "峰值时段" : `峰值 ${view.peak} 次`}</em>
        </p>
        <p className="duty-say">
          {view.peak === null ? "活动数据未返回，暂不判断高峰" : "虚线之后为尚未发生的时段"}
        </p>
        <div className="duty-heat" role="img" aria-label="24 小时活跃热力">
          {view.cells.map((c) => (
            <span
              key={c.hour}
              className={cn("duty-cell", `is-l${c.level}`, c.future && "is-future")}
              title={`${String(c.hour).padStart(2, "0")}:00 · ${c.future ? "未发生" : c.count ?? "—"} 次`}
            />
          ))}
        </div>
        <div className="duty-axis-row">
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>24</span>
        </div>
        <p className="duty-note">近 7 天同小时分布 · 当前时段之后留空 · 不补零</p>
      </StateLine>
    </HCard>
  );
}

function waitLabel(since?: string): string {
  if (!since) return "—";
  const ms = Date.parse(since);
  if (!Number.isFinite(ms)) return "—";
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  const d = new Date(ms + 480 * 60_000);
  const mins = Math.max(0, Math.floor((Date.now() - ms) / 60_000));
  const dur = mins < 60 ? `${mins} 分钟` : `${Math.floor(mins / 60)} 小时 ${mins % 60} 分钟`;
  return `${dur}（${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} 起）`;
}

function BlockerRow({ item }: { item: BlockerItem }) {
  return (
    <li className="duty-blocker">
      <Badge tone={item.overSLA ? "destructive" : "warning"}>{item.overSLA ? "超时" : "阻塞"}</Badge>
      <div className="duty-blocker-main">
        <p>阻塞对象：{item.object}</p>
        <p className="duty-blocker-fields">
          卡在哪一步：{item.step || "—"} · 等谁：{item.waitingOn || "—"} · 已等时长：{waitLabel(item.waitingSince)}
        </p>
        <p className="duty-blocker-meta">
          下一步动作：{item.nextAction}
          {item.affectsReadiness ? " · 影响上岗率" : ""}
          {item.overSLA ? " · 已超处理时限" : ""}
        </p>
        <p className="duty-blocker-reason">补充：{item.reason}</p>
      </div>
      <Link className="duty-link" to={item.href}>
        去处理
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </li>
  );
}

function BlockersCard({
  runs,
  tasks,
  approvals,
  onRetry,
}: {
  runs: Loadable<RunRow[]>;
  tasks: Loadable<TaskRow[]>;
  approvals: Loadable<ApprovalRow[]>;
  onRetry: () => void;
}) {
  const items = buildBlockers(
    runs.k === "ready" ? runs.data : null,
    tasks.k === "ready" ? tasks.data : null,
    approvals.k === "ready" ? approvals.data : null,
  );
  const firstError = [runs, tasks, approvals].find((x) => x.k === "error");
  const allReady = runs.k === "ready" && tasks.k === "ready" && approvals.k === "ready";
  return (
    <HCard
      title="阻塞"
      testid="duty-blockers" stamp={stampOf(null, "运行·任务·审批明细", [runs, tasks, approvals])}
      action={
        <Link className="duty-link" to="/tasks">
          查看全部
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      {firstError ? (
        <StateLine state={firstError} onRetry={onRetry}>
          <></>
        </StateLine>
      ) : items.length === 0 ? (
        <div className="duty-empty">
          <p>{allReady ? "当前没有读到的阻塞项" : "阻塞源尚未全部返回"}</p>
          <Link className="duty-link" to="/tasks">
            去任务板看看
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <ul className="duty-list duty-list-block">
          {items.map((item, i) => (
            <BlockerRow key={`${item.object}-${i}`} item={item} />
          ))}
        </ul>
      )}
      <p className="duty-note">阻塞卡五字段：阻塞对象 · 卡在哪一步 · 等谁 · 已等时长 · 下一步动作</p>
    </HCard>
  );
}

function PendingCard({
  stats,
  approvals,
  onRetry,
}: {
  stats: Loadable<ApprovalStatsBody>;
  approvals: Loadable<ApprovalRow[]>;
  onRetry: () => void;
}) {
  const view = pendingView(stats.k === "ready" ? stats.data : null, approvals.k === "ready" ? approvals.data : null);
  const state = stats.k === "error" ? stats : approvals.k === "error" ? approvals : stats;
  return (
    <HCard
      title="待我处理"
      testid="duty-pending" stamp={stampOf(asOfOf(stats.data), "审批统计", [stats, approvals])}
      action={
        <Link className="duty-link" to="/approvals">
          查看全部
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      <StateLine state={state} onRetry={onRetry}>
        <p className="duty-num" data-testid="ov6-kpi-pending" data-duty-testid="duty-kpi-pending">
          {dashed(view.pending)}
          <em>{view.dueSoon === null ? "待办" : `待办 · ${view.dueSoon} 即将到期`}</em>
        </p>
        {view.rows.length === 0 ? (
          <p className="duty-say">今天没有待你审批的事</p>
        ) : (
          <ul className="duty-list">
            {view.rows.slice(0, 3).map((a) => (
              <li key={a.approvalId}>
                <span className="duty-row-title">{a.title ?? "未命名审批"}</span>
                <span className="duty-row-time">{beijing(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="duty-note">只统计待你处理的审批 · 到期窗口 24 小时</p>
      </StateLine>
    </HCard>
  );
}

function RecentCard({ runs, onRetry }: { runs: Loadable<RunRow[]>; onRetry: () => void }) {
  return (
    <HCard
      title="最近运行"
      testid="duty-recent" stamp={stampOf(null, "运行明细", [runs])}
      action={
        <Link className="duty-link" to="/runs">
          查看全部
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      <StateLine state={runs} onRetry={onRetry}>
        {runs.k === "ready" && runs.data.length === 0 ? (
          <div className="duty-empty">
            <p>最近没有运行记录</p>
            <Link className="duty-link" to="/runs">
              去运行记录
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <ul className="duty-list">
            {(runs.k === "ready" ? runs.data : []).slice(0, 3).map((run) => (
              <li key={run.runId}>
                <Link className="duty-row-title font-mono" to={`/runs/${encodeURIComponent(run.runId)}`}>
                  {shortId(run.runId)}
                </Link>
                <RunStatusBadge status={run.status} />
                <span className="duty-row-time">{duration(run.startedAt, run.endedAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="duty-note">最近 3 次 · 时间北京时间 · 详情在运行记录</p>
      </StateLine>
    </HCard>
  );
}

function HealthStrip({
  cost,
  runs,
}: {
  cost: Loadable<BudgetBody>;
  runs: Loadable<RunStatsBody>;
}) {
  const totals = runs.k === "ready" ? runTotals(runs.data) : null;
  return (
    <div className="duty-health" data-testid="ov6-health" data-duty-testid="duty-health">
      <div className="duty-health-item">
        <span>发布</span>
        <b>待核实</b>
        <em>版本发布数据源未接入</em>
      </div>
      <div className="duty-health-item">
        <span>出站</span>
        <b>待核实</b>
        <em>网关健康数据源未接入</em>
      </div>
      <div className="duty-health-item">
        <span>账本</span>
        <b
          data-testid="ov6-kpi-health"
          data-duty-testid="duty-kpi-health"
          title={
            cost.k === "error" || runs.k === "error"
              ? "数据源缺口编号 GAP-01（详见技术详情）"
              : undefined
          }
        >
          {cost.k === "error" || runs.k === "error" ? "待核实" : "已接入"}
        </b>
        <em>{cost.k === "error" ? "成本账本读取失败" : totals ? "只认账本实际金额" : "运行合计未返回"}</em>
      </div>
    </div>
  );
}

export default function DutyPage() {
  const { data, reload, loading } = useDutyData();

  const forced = (() => {
    const match = window.location.hash.match(/[?&]state=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  })();
  if (forced === "loading") {
    return (
      <div className="duty-page" data-testid="ov6-page" data-duty-testid="duty-page">
        <p className="duty-note">正在读取值班数据…</p>
        <p className="duty-note" data-testid="ov6-asof" title="取不到采集时间：数据还在读取">采集时刻 —</p>
      </div>
    );
  }
  if (forced === "empty") {
    return (
      <div className="duty-page" data-testid="ov6-page" data-duty-testid="duty-page">
        <div className="duty-empty">
          <p>当前没有可显示的值班数据。</p>
          <p>数据源返回为空，可能尚未接入。</p>
          <p className="duty-note" data-testid="ov6-asof" title="取不到采集时间：上游响应没有带采集时间">采集时刻 —</p>
          <Link className="duty-link" to="/employees">去员工列表</Link>
        </div>
      </div>
    );
  }
  if (forced === "error") {
    return (
      <div className="duty-page" data-testid="ov6-page" data-duty-testid="duty-page">
        <div className="duty-empty">
          <p>值班数据暂时不可用。</p>
          <p>请求编号：未提供</p>
          <p className="duty-note" data-testid="ov6-asof" title="取不到采集时间：本次读取失败">采集时刻 —</p>
          <Button outlined onClick={reload}>重试</Button>
        </div>
      </div>
    );
  }
  const totalEmployees =
    data.stats.k === "ready" ? lifecycleTotal(data.stats.data) : null;

  return (
    <div className="duty-page" data-testid="ov6-page" data-duty-testid="duty-page">
      <header className="duty-head">
        <div className="duty-title">
          <ShieldCheck className="h-5 w-5" aria-hidden />
          <h1>值班台</h1>
          <span>运营总览 · 只读</span>
          {(() => {
            const stamp =
              data.todayStats.k === "ready" &&
              typeof (data.todayStats.data as { asOf?: unknown }).asOf === "string"
                ? ((data.todayStats.data as { asOf: string }).asOf)
                : data.stats.k === "ready" && typeof (data.stats.data as { asOf?: unknown }).asOf === "string"
                  ? ((data.stats.data as { asOf: string }).asOf)
                  : null;
            const reason = legReason([data.employees, data.stats, data.todayStats]);
            return (
              <span
                className="duty-meta"
                data-testid="ov6-asof"
                title={stamp ? "取各来源响应自带的采集时间上屏" : `取不到采集时间：${reason}`}
              >
                {stamp ? `采集时刻 北京时间 ${beijing(stamp)}` : "采集时刻 —"}
              </span>
            );
          })()}
        </div>
        <div className="duty-head-actions">
          <Button
            size="sm"
            outlined
            onClick={reload}
            disabled={loading}
            aria-busy={loading}
            prefix={<RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />}
          >
            刷新
          </Button>
        </div>
      </header>

      <div className="duty-grid duty-grid-3">
        <ReadinessCard employees={data.employees} stats={data.stats} onRetry={reload} />
        <TodayRunsCard stats={data.todayStats} runs={data.todayRuns} onRetry={reload} />
        <CostCard
          day={data.budgetDay}
          month={data.budgetMonth}
          employees={data.employees}
          totalEmployees={totalEmployees}
          onRetry={reload}
        />
      </div>

      <HealthStrip cost={data.budgetDay} runs={data.todayStats} />

      <div className="duty-grid duty-grid-2">
        <TrendCard stats={data.stats14} onRetry={reload} />
        <ActivityCard activity={data.activity} onRetry={reload} />
      </div>

      <div className="duty-grid duty-grid-3">
        <BlockersCard runs={data.failedRuns} tasks={data.blockedTasks} approvals={data.approvals} onRetry={reload} />
        <PendingCard stats={data.approvalStats} approvals={data.approvals} onRetry={reload} />
        <RecentCard runs={data.recentRuns} onRetry={reload} />
      </div>
    </div>
  );
}