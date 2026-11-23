import { createContext, useContext, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowRight, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";

import { cn } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/clipboard";
import {
  activity24,
  blockersTotal,
  buildBlockers,
  buildCost,
  buildReadiness,
  dailyBuckets,
  lifecycleTotal,
  pendingView,
  runTotals,
  trendSummary,
} from "./aggregate";
import { beijing, beijingHour, beijingWeekday, dashed, duration, employeeLabel, shortId, usd } from "./format";
import { runsCaliber } from "./runsCaliber";
import {
  DUTY_STATUS_FILTERS,
  DUTY_STATUS_PARAM,
  filterDutyRuns,
  parseDutyStatusFilter,
  type DutyStatusFilterId,
} from "./dutyStatusFilter";
import { DUTY_NOTES } from "./dutyNotes";
import { AgentFleetRail, FLEET_METRIC_REASONS } from "./AgentFleetRail";
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
import type { ReadinessEvidence } from "./readiness";
import { useDutyData, type DutyData, type DutyLegKey } from "./useDutyData";
import { deriveDutyHealth, healthChipText, healthChipTitle } from "./health";
import { forcedStateOf } from "./usage";
import {
  DEFAULT_DUTY_RANGE,
  DUTY_RANGES,
  DUTY_RANGE_PARAM,
  dutyRange,
  parseDutyRange,
} from "./dutyRange";
import { DUTY_GATES_OPEN, dutyGates, type DutyGates } from "./dutyGates";
import {
  DUTY_LIST_CAP,
  NO_COUNT,
  detailsListNote,
  truncationClause,
  viewAllText,
  type ServerRowCount,
} from "./dutySlots";
import "./duty.css";

type Tone = "default" | "destructive" | "outline" | "secondary" | "success" | "warning";

/** One gate set for every action on the page; see dutyGates.ts. */
const DutyGatesContext = createContext<DutyGates>(DUTY_GATES_OPEN);
const useDutyGates = () => useContext(DutyGatesContext);

/** Q10 条目3：三张列表明细的卡外展示上限；超出部分披露「另有 N 条」。 */
const LIST_CAP = 3;

function CopyRid({ id, testId = "ov6-rid-copy" }: { id: string; testId?: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const gate = useDutyGates().copy;
  return (
    <button
      type="button"
      className="duty-req-copy"
      data-testid={testId}
      aria-label={`复制请求编号 ${id}`}
      title={gate.title ?? "把请求编号复制给支持人员"}
      disabled={!gate.enabled}
      onClick={() => {
        if (!gate.enabled) return;
        void copyTextToClipboard(id).then((ok) => setState(ok ? "done" : "failed"));
      }}
    >
      {state === "done" ? "已复制" : state === "failed" ? "复制失败" : "复制"}
    </button>
  );
}

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
  const retryGate = useDutyGates().retry;
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
    /* UI-B 错误态组合：人话标题在外，技术句（HTTP 语义的 message）折叠进「详情」；
     * rid 复制入口保持可见可复制；重试=卡内唯一实心主操作（刷新条的「再试」
     * 不在卡内、且两错误腿不同层，不与之争主操作位）。
     * DU-05① 标题分档：未接入 / 无权限 / 读取失败三套词各说各的，互不混用。 */
    const title = state.notWired
      ? "这一块的数据源未接入"
      : state.status === 401 || state.status === 403
        ? "这一块你没有权限查看"
        : "这一块没有读取成功";
    return (
      <div className="duty-error" role="alert">
        <p className="duty-error-title">{title}</p>
        <p className="duty-req">
          {state.requestId ? (
            <>
              请求编号 {state.requestId}
              <CopyRid id={state.requestId} />
            </>
          ) : (
            "本次请求未记录编号，可复制时间与操作路径反馈"
          )}
        </p>
        <details className="duty-error-details">
          <summary>详情</summary>
          <p>{state.message}</p>
        </details>
        <Button
          size="sm"
          onClick={onRetry}
          disabled={!retryGate.enabled}
          title={retryGate.title ?? undefined}
          prefix={<RefreshCw className="h-3.5 w-3.5" />}
        >
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
  hint,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  testid: string;
  /** Long explanation for the card frame; tooltip only, never visible copy. */
  hint?: string;
  stamp?: { shown: string | null; source: string; reason?: string };
}) {
  return (
    <Card
      className="duty-card"
      data-card="duty"
      data-testid={testid.replace(/^duty-/, "ov6-")}
      data-duty-testid={testid}
      title={hint}
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
                : `取不到采集时间：${stamp.reason ?? "上游响应没有带采集时间"}；不用本机时间顶替`
            }
          >
            数据截至 {stamp.shown ?? "—（北京时间）"} · 来源 {stamp.source}
            {/* DU-07①③：缺采集时刻的原因不许只活在 title 里——缺数「—」＋原因上屏。 */}
            {stamp.shown ? null : ` · 原因：${stamp.reason ?? "上游响应没有带采集时间"}`}
          </p>
        ) : null}
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * R32 item 1 / duty caliber: honest per-card collection time — only from
 * upstream payloads. Six aliases are accepted, but the value must be a full
 * ISO-8601 stamp with a zone; «yesterday» or a bare date is not a collection
 * time and prints «—». The browser clock is never a fallback.
 */
const ASOF_KEYS = [
  "asOf",
  "as_of",
  "collectedAt",
  "collected_at",
  "generatedAt",
  "generated_at",
] as const;
const ISO_STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

function asOfOf(x: unknown): string | null {
  if (x && typeof x === "object" && !Array.isArray(x)) {
    const rec = x as Record<string, unknown>;
    for (const k of ASOF_KEYS) {
      const v = rec[k];
      if (typeof v !== "string") continue;
      const s = v.trim();
      if (!ISO_STAMP.test(s) || Number.isNaN(Date.parse(s))) continue;
      return s;
    }
  }
  return null;
}

function legReason(legs: readonly Loadable<unknown>[]): string {
  if (legs.some((l) => l.k === "loading")) return "数据还在读取";
  // DU-05① 口径不混用：not_wired 形制的腿缺采集时间是因为「未接入」，不是「失败」。
  if (legs.some((l) => l.k === "error" && !l.notWired)) return "本次读取失败，取不到采集时间";
  if (legs.some((l) => l.k === "error")) return "数据来源未接入，取不到采集时间";
  return "上游响应没有带采集时间";
}

function stampOf(
  raw: string | null,
  source: string,
  legs: readonly Loadable<unknown>[],
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

/**
 * 三卡返工（用户直令 2026-11-23）：卡片只留固定槽位——标题 / 一个主数字 /
 * 一句状态 / 「查看明细」深链；检查项、最近运行、成本覆盖这些明细挪到卡外的
 * 折叠区（信息不删，只是不进卡片），卡片高度因此不再随数据行数增长。
 */
function readinessView(
  employees: Loadable<EmployeeRow[]>,
  stats: Loadable<Record<string, unknown>>,
  evidence?: Loadable<ReadinessEvidence>,
) {
  const rawStamp =
    stats.k === "ready"
      ? (typeof stats.data.asOf === "string" && stats.data.asOf) ||
        (typeof stats.data.generatedAt === "string" && stats.data.generatedAt) ||
        null
      : null;
  const readiness = buildReadiness(
    employees.k === "ready" ? employees.data : null,
    stats.k === "ready" ? stats.data : null,
    evidence && evidence.k === "ready" ? evidence.data : null,
    rawStamp ? beijing(rawStamp) : null,
  );
  const state =
    employees.k === "error"
      ? employees
      : stats.k === "error"
        ? stats
        : evidence && evidence.k === "error"
          ? evidence
          : employees;
  return { readiness, rawStamp, state };
}

function ReadinessCard({
  employees,
  stats,
  evidence,
  count = NO_COUNT,
  onRetry,
}: {
  employees: Loadable<EmployeeRow[]>;
  stats: Loadable<Record<string, unknown>>;
  evidence?: Loadable<ReadinessEvidence>;
  /** 员工目录响应真带回的行数（DU-02①）；拿不到就写「数量未提供」。 */
  count?: ServerRowCount;
  onRetry: () => void;
}) {
  const { readiness, rawStamp, state } = readinessView(employees, stats, evidence);
  return (
    <HCard
      title="可上岗"
      testid="duty-ready"
      stamp={stampOf(rawStamp, "员工目录与运行统计", [employees, stats])}
      action={
        <Link
          className="duty-link duty-card-foot"
          to="/employees"
          data-testid="duty-route-readiness"
          title={truncationClause(count)}
        >
          {viewAllText(count.serverRows)}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      <StateLine state={state} onRetry={onRetry} loadingText="正在汇总各项检查…">
        <p className="duty-num" data-testid="ov6-ready-value" data-duty-testid="duty-ready-value">
          {/* 三分态（DU-01⑤）：不给单一权威百分比——已确认/待核实/未达按真证据划分。 */}
          <span data-testid="ov6-kpi-employees" data-duty-testid="duty-kpi-employees">
            {readiness.buckets === null
              ? "—"
              : `已确认 ${readiness.buckets.confirmed} · 待核实 ${readiness.buckets.pending} · 未达 ${readiness.buckets.failing}`}
          </span>
          <em>{readiness.total === null ? "—" : `共 ${readiness.total} 在册`}</em>
        </p>
        <p className="duty-say" data-testid="duty-ready-denominator" title={readiness.denominatorNote ?? undefined}>
          {readiness.unknownGates > 0
            ? `还有 ${readiness.unknownGates} 项检查的数据源没有接入，暂不能判定 — ${readiness.gates
                .filter((g) => g.state === "unknown")
                .map((g) => g.whyNot)
                .filter(Boolean)
                .join("；")}`
            : readiness.confirmed === readiness.total
              ? "各项检查全部通过，在册员工均可上岗"
              : `最容易卡住的一项：${readiness.narrowest ? readiness.narrowest.name : "待核实"}`}
          {readiness.denominatorNote ? `（分母口径：${readiness.denominatorNote}）` : ""}
        </p>
      </StateLine>
    </HCard>
  );
}

/**
 * 卡外明细折叠区（用户直令 ③④）：原来挤在三卡里的检查项、状态筛选、
 * 最近运行、口径与成本覆盖，全部收进这里；信息一条不删，但不再撑高卡片。
 */
function DutyDetailsSection({
  employees,
  stats,
  evidence,
  employeesCount = NO_COUNT,
  runsCount = NO_COUNT,
  todayStats,
  todayRuns,
  day,
  month,
  totalEmployees,
  statusFilterId,
  onChooseStatus,
  failedRuns,
  blockedTasks,
  approvals,
  approvalStats,
  recentRuns,
}: {
  employees: Loadable<EmployeeRow[]>;
  stats: Loadable<Record<string, unknown>>;
  evidence?: Loadable<ReadinessEvidence>;
  /** 三卡深链的 N 与折叠区必须同源：这两个计数由页面透传，本区不另算。 */
  employeesCount?: ServerRowCount;
  runsCount?: ServerRowCount;
  todayStats: Loadable<RunStatsBody>;
  todayRuns: Loadable<RunRow[]>;
  day: Loadable<BudgetBody>;
  month: Loadable<BudgetBody>;
  totalEmployees: number | null;
  statusFilterId: DutyStatusFilterId;
  onChooseStatus: (next: DutyStatusFilterId) => void;
  failedRuns: Loadable<RunRow[]>;
  blockedTasks: Loadable<TaskRow[]>;
  approvals: Loadable<ApprovalRow[]>;
  approvalStats: Loadable<ApprovalStatsBody>;
  recentRuns: Loadable<RunRow[]>;
}) {
  const { readiness } = readinessView(employees, stats, evidence);
  const totals = todayStats.k === "ready" ? runTotals(todayStats.data) : null;
  // 三格从今日运行卡里搬来（DU-02②：主数字每卡一个），算法与卡上原形一致。
  const rate =
    totals && totals.runs && totals.runs > 0 && totals.succeeded !== null
      ? Math.round((totals.succeeded / totals.runs) * 100)
      : null;
  const caliberAsOf = todayStats.k === "ready" ? asOfOf(todayStats.data) : null;
  const caliber = runsCaliber({
    duty: totals ? totals.runs : null,
    metrics: null,
    dutyAsOfText: beijing(caliberAsOf),
  });
  const shownRuns =
    todayRuns.k === "ready" ? filterDutyRuns(todayRuns.data, statusFilterId) : [];
  const listedRuns = Math.min(shownRuns.length, DUTY_LIST_CAP);
  const statusFilterLabel =
    DUTY_STATUS_FILTERS.find((f) => f.id === statusFilterId)?.label ?? "";
  const cost = buildCost(
    day.k === "ready" ? day.data : null,
    month.k === "ready" ? month.data : null,
    totalEmployees,
  );
  // w192 条款5：卡内明细出卡后由本折叠区承接（信息不删；buildBlockers/pendingView 是纯函数，
  // 卡上同参复算与卡外一致）。
  const blockerItems = buildBlockers(
    failedRuns.k === "ready" ? failedRuns.data : null,
    blockedTasks.k === "ready" ? blockedTasks.data : null,
    approvals.k === "ready" ? approvals.data : null,
  );
  const blockerTotal = blockersTotal(
    failedRuns.k === "ready" ? failedRuns.data : null,
    blockedTasks.k === "ready" ? blockedTasks.data : null,
    approvals.k === "ready" ? approvals.data : null,
  );
  const pending = pendingView(
    approvalStats.k === "ready" ? approvalStats.data : null,
    approvals.k === "ready" ? approvals.data : null,
  );
  const pendingRows = pending.rows;
  const recentRows = recentRuns.k === "ready" ? recentRuns.data : [];
  return (
    <details className="duty-details" data-testid="duty-details" data-duty-testid="duty-details">
      <summary className="duty-details-summary" data-testid="duty-details-toggle">
        卡外明细：检查项 / 最近运行 / 成本覆盖
      </summary>
      <div className="duty-details-body">
        <section
          className="duty-details-block"
          data-testid="duty-details-readiness"
          title={
            "workbench/agents 缺 byLifecycle 聚合计数（active/paused/offboarding）、缺分页之外的完整名单（翻页时 total 为 null），逐行 today* 也恒为 null；本卡仍取员工目录 + 员工统计，换成该读口会丢掉总分母，故不换。"
          }
        >
          <h3>可上岗检查项</h3>
          <p className="duty-say" data-testid="duty-gates-net" data-duty-testid="duty-gates-net">
            {readiness.netNote}
          </p>
          <p className="duty-note" data-testid="duty-details-readiness-count">
            {employeesCount.serverRows === null
              ? "员工目录返回条数未提供"
              : `员工目录${truncationClause(employeesCount)}`}{" "}
            · 检查项 {readiness.gates.length} 项
            {employeesCount.unreadable && employeesCount.unreadable > 0
              ? ` · ${employeesCount.unreadable} 条读不成行形，不计入分母`
              : ""}
          </p>
          <div className="duty-gates">
            {readiness.gates.map((g) => (
              <GateRow key={g.key} gate={g} narrowest={readiness.narrowest?.key === g.key} />
            ))}
          </div>
          <p className="duty-note">各项检查独立判定，标「待核实」的项既不算通过也不算不通过。</p>
          <p className="duty-note" data-testid="duty-denominator-caliber" data-duty-testid="duty-denominator-caliber">
            {readiness.denomNote}
          </p>
        </section>
        <section className="duty-details-block" data-testid="duty-details-runs">
          <h3>今日运行明细</h3>
          {/* DU-02②：这三格原来占着今日运行卡的 KPI 位，卡上只留运行数一个主数字。 */}
          <div className="duty-kpis duty-details-kpis" data-testid="duty-today-runs-kpis">
            <span className="duty-kpi">
              <b data-testid="duty-kpi-success-rate">{rate === null ? "—" : `${rate}%`}</b>
              <i>成功率</i>
            </span>
            <span className="duty-kpi">
              <b data-testid="duty-kpi-running">{totals ? dashed(totals.running) : "—"}</b>
              <i>在跑</i>
            </span>
            <span className="duty-kpi">
              <b data-testid="duty-kpi-failed">{totals ? dashed(totals.failed) : "—"}</b>
              <i>失败</i>
            </span>
          </div>
          <p className="duty-note" data-testid="duty-details-runs-count">
            {`运行明细${detailsListNote(runsCount, listedRuns)}`}
            {statusFilterId === "all" ? "" : ` · 当前按「${statusFilterLabel}」筛选`}
          </p>
          <div className="duty-ranges duty-status-filters" role="group" aria-label="运行状态筛选">
            {DUTY_STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className="duty-range"
                data-testid={`duty-status-${f.id}`}
                aria-pressed={f.id === statusFilterId}
                onClick={() => onChooseStatus(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          {todayRuns.k === "ready" && todayRuns.data.length > 0 ? (
            shownRuns.length > 0 ? (
              <ul className="duty-list" data-testid="duty-details-run-list">
                {shownRuns.slice(0, DUTY_LIST_CAP).map((run) => (
                  <li key={run.runId}>
                    <RunStatusBadge status={run.status} />
                    <Link className="duty-row-title" to={`/runs/?run=${encodeURIComponent(run.runId)}`}>
                      {shortId(run.runId)}
                    </Link>
                    <span className="duty-row-time">{beijing(run.startedAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="duty-note" data-testid="duty-status-empty">
                该状态下没有最近运行。
                <button
                  type="button"
                  className="duty-range"
                  data-testid="duty-status-clear"
                  onClick={() => onChooseStatus("all")}
                >
                  清空筛选
                </button>
              </p>
            )
          ) : (
            <p className="duty-note">最近运行明细尚未返回，合计仍以服务端为准。</p>
          )}
          <p className="duty-note">今日 00:00 起 · 北京时间 · 合计来自服务端窗口统计</p>
          <p className="duty-runs-caliber" data-testid="duty-runs-caliber" title={caliber.title}>
            运行数口径：本卡{" "}
            <span data-testid="duty-runs-value">{totals ? totals.runs : "—"}</span> 次 · 读口
            workbench/summary?range=1d · /metrics 读 /api/run-stats 当前窗 · 采集时刻{" "}
            <span data-testid="duty-runs-asof">{beijing(caliberAsOf)}</span>｜
            <span data-testid="duty-runs-verdict">{caliber.compare}</span>
          </p>
        </section>
        <section className="duty-details-block" data-testid="duty-details-cost">
          <h3>成本覆盖明细</h3>
          <p className="duty-note" data-testid="duty-details-cost-count">
            {cost.covered === null
              ? "当日账本返回行数未提供"
              : `当日账本本轮返回 ${cost.covered} 行`}
            {cost.missing > 0 ? ` · 服务端报缺 ${cost.missing} 人金额` : ""}
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
          </ul>
          <p className="duty-note">金额 USD · 缺行不按 0 计入 · 日账与月账分开相加</p>
        </section>
        <section className="duty-details-block" data-testid="duty-details-blockers">
          <h3>阻塞明细</h3>
          {blockerItems.length === 0 ? (
            <p className="duty-say">当前没有读到的阻塞项</p>
          ) : (
            <>
              <ul className="duty-list duty-list-block">
                {blockerItems.slice(0, LIST_CAP).map((item, i) => (
                  <BlockerRow key={`${item.object}-${i}`} item={item} />
                ))}
              </ul>
              {blockerTotal > blockerItems.length ? (
                <p className="duty-note" data-testid="duty-blockers-more">
                  另有 {blockerTotal - blockerItems.length} 条未在本页列出；「查看全部 ({blockerTotal})」为本次读到的总数（各源单页上限 3，非全量）。
                </p>
              ) : null}
            </>
          )}
        </section>
        <section className="duty-details-block" data-testid="duty-details-pending">
          <h3>审批明细</h3>
          {pendingRows.length === 0 ? (
            <p className="duty-say">今天没有待你审批的事</p>
          ) : (
            <>
              <ul className="duty-list">
                {pendingRows.slice(0, LIST_CAP).map((a) => (
                  <li key={a.approvalId}>
                    <span className="duty-row-title">{a.title ?? "未命名审批"}</span>
                    <span className="duty-row-time">{beijing(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
              {(() => {
                // 总数优先取服务端 pending 计数；没读到就按本页条数如实说。
                const total = pending.pending ?? pendingRows.length;
                const shown = Math.min(pendingRows.length, LIST_CAP);
                return total > shown ? (
                  <p className="duty-note" data-testid="duty-pending-more">
                    另有 {total - shown} 条未在本页列出。
                  </p>
                ) : null;
              })()}
            </>
          )}
        </section>
        <section className="duty-details-block" data-testid="duty-details-recent">
          <h3>最近运行明细</h3>
          {recentRows.length === 0 ? (
            <p className="duty-say">最近没有运行记录</p>
          ) : (
            <>
              <ul className="duty-list">
                {recentRows.slice(0, DUTY_LIST_CAP).map((run) => (
                  <li key={run.runId}>
                    <Link className="duty-row-title font-mono" to={`/runs/?run=${encodeURIComponent(run.runId)}`}>
                      {shortId(run.runId)}
                    </Link>
                    <RunStatusBadge status={run.status} />
                    <span className="duty-row-time">{duration(run.startedAt, run.endedAt)}</span>
                  </li>
                ))}
              </ul>
              {recentRows.length >= DUTY_LIST_CAP ? (
                <p className="duty-note" data-testid="duty-recent-more">
                  本页最多读取 {DUTY_LIST_CAP} 条已触顶，可能还有更多未列出；「查看全部」的计数为本次读到的条数，非全量。
                </p>
              ) : null}
            </>
          )}
        </section>
        <section className="duty-details-block" data-testid="duty-details-fleet">
          <h3>舰队轨明细</h3>
          {/* DU-03①：2026-11-24 现网实测 /api/employees 键并集含 department（3 条中 2 条
              为 null、1 条有值），能力标签列仍不在花名册；卡面第③层按工单裁定保持整层
              省略（禁空壳、禁编造），说明句必须与真响应一致——工单原句「无数据源」对
              department 不成立，已按实测改口径，偏差见 DONE-DU-03.md。 */}
          <p className="duty-note" data-testid="duty-fleet-l3-note">
            舰队轨第③层未显示：花名册无能力标签列，部门多为空值（待 /api/matrix 扩列）
          </p>
          {/* DU-07③：卡面两个「—」的原因原来只活在格上 title（悬停才有）。判据不许关键信息
              只存在于 :hover——这里在既有载体（卡外折叠区）给**同串**出口，措辞取自
              AgentFleetRail 的 FLEET_METRIC_REASONS 单一事实源，页面不另写第二套。 */}
          <p className="duty-note" data-testid="duty-fleet-metric-note">
            {FLEET_METRIC_REASONS.today} {FLEET_METRIC_REASONS.successRate}
          </p>
          {/* DU-07③：卡面 title 的另一半原文是「名字｜原始 employee_id」。屏上只给短码
              （DU-03 裁定：屏上绝不裸 id），全值就必须有可点开的等价出口——本折叠明细
              逐行给 名字＋ui-c-id 全值，与卡面 title 同串。 */}
          {employees.k === "ready" && employees.data.length > 0 ? (
            <ul className="duty-list duty-fleet-ids" data-testid="duty-fleet-id-list">
              {employees.data.slice(0, DUTY_LIST_CAP).map((row) => (
                <li key={row.employeeId}>
                  <span>{employeeLabel(row.name, row.employeeId)}</span>
                  <code className="ui-c-id duty-fleet-id" data-testid={`duty-fleet-id-${row.employeeId}`}>
                    {row.employeeId}
                  </code>
                </li>
              ))}
            </ul>
          ) : (
            <p className="duty-note" data-testid="duty-fleet-id-empty">
              花名册没有可列出的员工行，全值编号暂无法给出（不是没有编号）。
            </p>
          )}
        </section>
      </div>
    </details>
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

/**
 * 今日运行卡（DU-02 固定槽位）：标题 / 一个主数字（运行数）/ 一句状态 / 一个「查看全部 (N)」深链。
 * 成功率·在跑·失败三格属明细，挪进卡外「今日运行明细」（信息一条不删），
 * 卡高因此与数据行数无关。N 只取运行明细响应真带回的行数。
 */
function TodayRunsCard({
  stats,
  runs,
  count = NO_COUNT,
  onRetry,
}: {
  stats: Loadable<RunStatsBody>;
  runs: Loadable<RunRow[]>;
  count?: ServerRowCount;
  onRetry: () => void;
  statusFilterId: DutyStatusFilterId;
  onChooseStatus: (next: DutyStatusFilterId) => void;
}) {
  const totals = stats.k === "ready" ? runTotals(stats.data) : null;
  const rate =
    totals && totals.runs && totals.runs > 0 && totals.succeeded !== null
      ? Math.round((totals.succeeded / totals.runs) * 100)
      : null;
  const say =
    totals === null
      ? "运行窗口统计没有返回合计，先不报数（缺数不当 0）"
      : `成功率 ${rate === null ? "—" : `${rate}%`} · 在跑 ${dashed(totals.running)} · 失败 ${dashed(
          totals.failed,
        )}，逐条见卡外「今日运行明细」`;
  const truncated = truncationClause(count);
  return (
    <HCard
      title="今日运行"
      testid="duty-today-runs"
      stamp={stampOf(stats.k === "ready" ? asOfOf(stats.data) : null, "运行窗口统计", [stats, runs])}
      action={
        <Link
          className="duty-link duty-card-foot"
          to="/runs"
          data-testid="duty-route-today-runs"
          title={truncated}
        >
          {viewAllText(count.serverRows)}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      <StateLine state={stats} onRetry={onRetry}>
        <p className="duty-num" data-testid="ov6-today-runs-num" data-duty-testid="duty-today-runs-num">
          <span data-testid="ov6-kpi-runs" data-duty-testid="duty-kpi-runs">
            {totals ? dashed(totals.runs) : "—"}
          </span>
          <em>次 · 今日</em>
        </p>
        <p className="duty-say" data-testid="duty-today-runs-say">
          {say}｜{truncated}
        </p>
      </StateLine>
    </HCard>
  );
}


function CostCard({
  day,
  month,
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
    null,
  );
  // 账本腿的行数直接取响应自带的 items（未归一化、未相加），缺形状就是 null。
  const ledgerNote =
    cost.covered === null
      ? "当日账本返回行数未提供"
      : `当日账本本轮返回 ${cost.covered} 行`;
  const state = day.k === "error" ? day : month.k === "error" ? month : day;
  return (
    <HCard
      title="今日成本"
      testid="duty-today-cost"
      stamp={stampOf(day.k === "ready" ? asOfOf(day.data) : null, "当日成本账本", [day, month])}
      action={
        <Link
          className="duty-link duty-card-foot"
          to="/metrics"
          data-testid="duty-route-cost"
          title={ledgerNote}
        >
          {viewAllText(cost.covered)}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      <StateLine state={state} onRetry={onRetry}>
        <p className="duty-num" data-testid="ov6-kpi-cost" data-duty-testid="duty-kpi-cost">
          {usd(cost.dayUsd)}
          <em>今日</em>
        </p>
        <p className="duty-say" data-testid="duty-today-cost-say">
          {cost.partial
            ? `账本还缺 ${cost.missing || "若干"} 人的金额，先不报合计`
            : `本月已花 ${usd(cost.monthUsd)}`}
          ｜{ledgerNote}
        </p>
      </StateLine>
    </HCard>
  );
}


function TrendCard({
  stats,
  onRetry,
  label,
  windowNote,
}: {
  stats: Loadable<RunStatsBody>;
  onRetry: () => void;
  label: string;
  windowNote: string | null;
}) {
  const [tableOpen, setTableOpen] = useState(false);
  const totals = stats.k === "ready" ? runTotals(stats.data) : null;
  const buckets = stats.k === "ready" ? dailyBuckets(stats.data) : [];
  const summary = trendSummary(buckets);
  const peak = summary.peak;
  // A bucket without a reading keeps its slot on the axis but never counts as 0.
  const max = Math.max(1, ...buckets.map((b) => b.runs ?? 0));
  const failed = stats.k === "error";
  const summaryTitle = failed
    ? `这次没能读取${label}趋势：${stats.message}${stats.requestId ? `（请求编号 ${stats.requestId}）` : ""}；不把缺数当 0。`
    : undefined;
  return (
    <HCard title={`${label}运行`} meta="每日启动" testid="duty-trend" stamp={stampOf(stats.k === "ready" ? asOfOf(stats.data) : null, `${label}运行统计`, [stats])}
      action={
        <Link className="duty-link" to="/runs" data-testid="duty-route-trend">
          运行记录
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      {windowNote ? (
        <p className="duty-note" data-testid="duty-trend-window-note">
          {windowNote}
        </p>
      ) : null}
      <StateLine state={stats} onRetry={onRetry}>
        <p className="duty-num">
          {totals ? totals.runs : "—"}
          <em>{peak ? `次 · 峰值 ${peak.runs ?? "—"}` : "次"}</em>
        </p>
        <p className="duty-say">
          {summary.empty
            ? "所选窗口没有运行记录"
            : summary.total === null
              ? "日均 — 次；这一批有日期没有读数"
              : `日均 ${(summary.total / buckets.length).toFixed(1)} 次${peak ? `；峰值在 ${peak.label}` : ""}`}
        </p>
        <svg
          className="duty-chart"
          viewBox="0 0 600 120"
          role="img"
          aria-label={`${label}每日运行次数`}
          aria-describedby="duty-trend-summary"
          data-testid="duty-trend-figure"
        >
          <line x1="4" y1="108" x2="596" y2="108" className="duty-axis" />
          <polyline
            className="duty-line"
            points={buckets
              .map((b, i) => {
                const x = buckets.length === 1 ? 300 : 8 + (i * 584) / (buckets.length - 1);
                const y = 100 - ((b.runs ?? 0) / max) * 84;
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
        <p className="duty-note">{label} · 按北京时间切日 · 只画有运行的桶</p>
      </StateLine>
      <p className="duty-say duty-trend-summary" id="duty-trend-summary" data-testid="duty-trend-summary" title={summaryTitle}>
        {failed ? (
          <>
            {label}摘要：首日 <span data-testid="duty-trend-first">—</span> · 末日{" "}
            <span data-testid="duty-trend-last">—</span> · 峰值{" "}
            <span data-testid="duty-trend-peak">—</span> · 最低{" "}
            <span data-testid="duty-trend-low">—</span> · 合计{" "}
            <span data-testid="duty-trend-total">—</span>
          </>
        ) : stats.k !== "ready" ? (
          `正在读取${label}的运行记录…`
        ) : summary.empty ? (
          "该区间没有运行记录"
        ) : (
          <>
            {label}：首日 {summary.first?.label} <span data-testid="duty-trend-first">{summary.first?.runs ?? "—"}</span> 次 · 末日{" "}
            {summary.last?.label} <span data-testid="duty-trend-last">{summary.last?.runs ?? "—"}</span> 次 · 峰值{" "}
            {summary.peak?.label} <span data-testid="duty-trend-peak">{summary.peak?.runs ?? "—"}</span> 次 · 最低{" "}
            {summary.low?.label} <span data-testid="duty-trend-low">{summary.low?.runs ?? "—"}</span> 次 · 合计{" "}
            <span data-testid="duty-trend-total">{summary.total ?? "—"}</span> 次
          </>
        )}
      </p>
      <Button
        size="sm"
        outlined
        className="duty-disclosure-toggle"
        aria-expanded={tableOpen}
        aria-controls="duty-trend-table"
        data-testid="duty-trend-table-toggle"
        onClick={() => setTableOpen((v) => !v)}
      >
        {tableOpen ? "收起表格" : "以表格查看"}
      </Button>
      {tableOpen ? (
        <div id="duty-trend-table" data-testid="duty-trend-table">
          <table className="duty-trend-table">
            <caption>{`${label}每日运行次数（北京时间）`}</caption>
            <thead>
              <tr>
                <th scope="col">日期</th>
                <th scope="col">运行数</th>
              </tr>
            </thead>
            <tbody>
              {!failed && !summary.empty
                ? buckets.map((b) => (
                    <tr key={b.label}>
                      <td>{b.label}</td>
                      <td>{b.runs ?? "—"}</td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
          {failed ? (
            <p className="duty-note" data-testid="duty-trend-table-empty">
              这次没有读到趋势数据，表格不补 0。
            </p>
          ) : summary.empty ? (
            /* UI-B 空态组合：卡片 h2 + 表格 caption 承担标题，testid 句承担一句说明，
             * 下方给单一主操作=重新读取（区间是观察窗口而非筛选，没有"清筛选"可落；
             * 根因出口要么换窗口要么重读，重读留在卡内）。 */
            <>
              <p className="duty-note duty-empty-lead" data-testid="duty-trend-table-empty">
                该区间没有运行记录，表体没有可列出的行。
              </p>
              <div className="duty-empty-actions">
                <Button
                  size="sm"
                  onClick={onRetry}
                  data-testid="duty-trend-empty-retry"
                  prefix={<RefreshCw className="h-3.5 w-3.5" />}
                >
                  重新读取
                </Button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </HCard>
  );
}

/**
 * DU-07①③：热力格的逐时读数原文。title（悬停）与「以文字查看」列表共用这**一份**
 * 字符串——逐时计数不许只活在悬停里，窄屏也不靠色块猜数。
 */
function heatCellText(c: { hour: number; count: number | null; future: boolean }): string {
  return c.future
    ? `${String(c.hour).padStart(2, "0")}:00 · 未发生`
    : `${String(c.hour).padStart(2, "0")}:00 · ${c.count ?? "—"} 次`;
}

function ActivityCard({ activity, onRetry, label }: { activity: Loadable<ActivityBody>; onRetry: () => void; label: string }) {
  const [textOpen, setTextOpen] = useState(false);
  const view = activity24(
    activity.k === "ready" ? activity.data : null,
    beijingWeekday(),
    beijingHour(),
  );
  return (
    <HCard title={`${label}活跃`} meta="每格 1 小时" testid="duty-activity" stamp={stampOf(activity.k === "ready" ? asOfOf(activity.data) : null, `${label}活跃统计`, [activity])} action={
      <Link className="duty-link duty-card-foot" to="/runs" data-testid="duty-route-activity">
        查看明细
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    }>
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
              title={heatCellText(c)}
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
        {/* DU-07①③：热力图的文字替代腿（与趋势「以表格查看」同形制）。逐时读数
            与格上 title 同串，点开即得——关键数字不再只存在于悬停。 */}
        <Button
          size="sm"
          outlined
          className="duty-disclosure-toggle"
          aria-expanded={textOpen}
          aria-controls="duty-activity-text"
          data-testid="duty-activity-text-toggle"
          onClick={() => setTextOpen((v) => !v)}
        >
          {textOpen ? "收起逐时文字" : "以文字查看逐时"}
        </Button>
        {textOpen ? (
          <ul className="duty-heat-text" id="duty-activity-text" data-testid="duty-activity-text-list">
            {view.cells.map((c) => (
              <li key={c.hour} data-testid={`duty-activity-text-${c.hour}`}>
                {heatCellText(c)}
              </li>
            ))}
          </ul>
        ) : null}
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
  // 截断前的读到总数：卡面恒列前 3，按钮数字不得冒充成截断后的 shown。
  const total = blockersTotal(
    runs.k === "ready" ? runs.data : null,
    tasks.k === "ready" ? tasks.data : null,
    approvals.k === "ready" ? approvals.data : null,
  );
  const firstError = [runs, tasks, approvals].find((x) => x.k === "error");
  const allReady = runs.k === "ready" && tasks.k === "ready" && approvals.k === "ready";
  // DU-07③×L0 裁定（merge 3113707983）：title 原文上屏的判据不变，但句子必须
  // 采纳线侧 DU-02 诚实口径——各读口上限 3、共读到 total、列前 LIST_CAP、其余标
  // 「另有 N 条」，禁写「已在本卡逐条列出」（该话术已被 duty.q10-parity 条目3 判失真）。
  // 链接文案恢复「查看全部 (N)」，N=blockersTotal 真数。title 与屏上句共用这一份串。
  const blockersLinkNote = `任务页不接受 status 筛选参数，这里去任务板。本次各读口上限 3 条，共读到 ${total} 项阻塞；卡面列前 ${LIST_CAP} 条，其余如实标注「另有 N 条」，不说「已逐条列出」。`;
  return (
    <HCard
      title="阻塞"
      testid="duty-blockers" stamp={stampOf(null, "运行·任务·审批明细", [runs, tasks, approvals])}
      action={
        <Link
          className="duty-link"
          to="/work"
          data-testid="duty-route-blockers"
          title={blockersLinkNote}
        >
          查看全部{total > 0 ? ` (${total})` : ""}
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
        <p className="duty-say" data-testid="duty-blockers-say">{`${items.length} 项阻塞 · 逐条见下方「阻塞明细」`}</p>
      )}
      <p className="duty-note">阻塞卡五字段：阻塞对象 · 卡在哪一步 · 等谁 · 已等时长 · 下一步动作</p>
      <p className="duty-note" data-testid="duty-blockers-link-note">{blockersLinkNote}</p>
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
      testid="duty-pending" stamp={stampOf(stats.k === "ready" ? asOfOf(stats.data) : null, "审批统计", [stats, approvals])}
      action={
        <Link
          className="duty-link"
          to="/approvals"
          data-testid="duty-route-pending"
          title={
            view.pending === null
              ? "审批总数未读到：不带数字的查看全部只跳审批页，不假造计数。"
              : `待审批总数 ${view.pending}（服务端统计）；本页最多列前 ${LIST_CAP} 条，其余标「另有 N 条」。`
          }
        >
          查看全部{view.pending === null ? "" : ` (${view.pending})`}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      <StateLine state={state} onRetry={onRetry}>
        <p className="duty-num" data-testid="ov6-kpi-pending" data-duty-testid="duty-kpi-pending">
          {dashed(view.pending)}
          <em>{view.dueSoon === null ? "待办" : `待办 · ${view.dueSoon} 即将到期`}</em>
        </p>
        {view.pending === null ? (
          <p className="duty-say">
            审批数量没有读出来
            {stats.k === "ready" && stats.data.reason ? `：${stats.data.reason}` : ""}。不当成 0，也不当作空队列。
          </p>
        ) : view.rows.length === 0 ? (
          <p className="duty-say">今天没有待你审批的事</p>
        ) : (
          <p className="duty-say" data-testid="duty-pending-say">{`${view.rows.length} 条待你审批 · 逐条见下方「审批明细」`}</p>
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
        <Link
          className="duty-link duty-card-foot"
          to="/runs"
          data-testid="duty-route-recent"
          title={`最近运行每次最多读取 ${LIST_CAP} 条；查看全部 ${runs.k === "ready" ? `(${runs.data.length})` : ""}为本次读到的条数${runs.k === "ready" && runs.data.length >= LIST_CAP ? "，已触顶，非全量" : ""}，总数以运行记录页为准。`}
        >
          查看全部{runs.k === "ready" && runs.data.length > 0 ? ` (${runs.data.length})` : ""}
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
          <p className="duty-say" data-testid="duty-recent-say">{`${runs.k === "ready" ? runs.data.length : 0} 条最近运行 · 明细见下方「最近运行明细」`}</p>
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

function DutyNotes() {
  const [open, setOpen] = useState(false);
  return (
    <section className="duty-notes" data-testid="duty-notes">
      <button
        type="button"
        className="duty-notes-toggle"
        data-testid="duty-notes-toggle"
        aria-expanded={open}
        aria-controls="duty-notes-body"
        onClick={() => setOpen((value) => !value)}
      >
        口径说明：每个区块读哪个口、算哪一段、缺值怎么显示
        <span aria-hidden="true">{open ? "收起" : "展开"}</span>
      </button>
      {open ? (
        <div className="duty-notes-body" id="duty-notes-body" data-testid="duty-notes-body">
          {DUTY_NOTES.map((note) => (
            <p key={note.key} className="duty-note-row" data-testid={`duty-note-${note.key}`}>
              <b>{note.area}</b>
              {" · "}
              <code>{note.path}</code>
              {" · "}
              {note.scope}
              {" · "}
              {note.missing}
            </p>
          ))}
          <p className="duty-notes-foot">
            展开与收起不发请求：这里写的都是各卡已经在用的读口，折叠块本身不取数。
          </p>
        </div>
      ) : null}
    </section>
  );
}

/**
 * DU-05①：页头 health chip。三态词表按主仓 `_overview` 真形制钉死（见 health.ts）：
 * ok=正常 / degraded=降级（列「读取失败」的腿名）/ 未接入（列 not_wired 的腿名）。
 * 「未接入」永不写进失败清单，「读取失败」永不借用「未接入」的说法；缺读数画「—」。
 */
function DutyHealthChip({ data }: { data: DutyData }) {
  const view = deriveDutyHealth(data);
  const tone =
    view.level === "ok" ? "success" : view.level === "degraded" ? "warning" : "default";
  return (
    <span
      className="duty-health-chip"
      data-testid="duty-health-chip"
      data-duty-testid="duty-health-chip"
      data-state={view.level}
      title={healthChipTitle(view)}
    >
      <Badge tone={tone as Tone}>{healthChipText(view)}</Badge>
    </span>
  );
}

/** DU-05③：`?state=` 复现说明——形制是复现的，不是服务的回答；去掉参数即真读。 */
function DutyReproNote({ state }: { state: string }) {
  return (
    <p className="duty-note" data-testid="duty-repro-note" title="复现腿不发起真实请求，去掉 ?state= 即为真实读取">
      {`强制态：?state=${state} — 这是用地址参数复现出来的界面形制，不是服务此刻的回答；复现腿不发起真实请求，去掉 ?state= 即为真实读取。`}
    </p>
  );
}

export default function DutyPage() {
  const [params, setParams] = useSearchParams();
  const rangeId = parseDutyRange(params.get(DUTY_RANGE_PARAM));
  const statusFilterId = parseDutyStatusFilter(params.get(DUTY_STATUS_PARAM));
  const range = dutyRange(rangeId);
  // DU-05③：四态强制读**查询串**（BrowserRouter 下这才是真接线；旧实现只看
  // window.location.hash，现网 `/overview?state=…` 根本进不了分支）。hash 形制
  // 保留兼容（壳侧 bridge 的 in-hash 写法）。非法值=忽略，回到真实读取。
  const forced = (() => {
    const fromSearch = params.get("state");
    if (fromSearch) return forcedStateOf(fromSearch.trim().toLowerCase());
    const hash = typeof window === "undefined" ? "" : window.location.hash;
    const match = hash.match(/[?&]state=([^&]+)/);
    return match ? forcedStateOf(decodeURIComponent(match[1]).trim().toLowerCase()) : null;
  })();
  // OM-04 的读取开关占位为默认档：值班台要渲染活动热力，activity 照常请求。
  const { data, counts, reload, loading, refreshState } = useDutyData(rangeId, {}, forced);
  // DU-05②：单腿重试的入口在 hook 上；复现态时它是空操作（不发请求）。
  const retry = (keys: readonly DutyLegKey[]) => () => refreshState.retryLegs(keys);
  const chooseRange = (next: string) => {
    const query = new URLSearchParams(params);
    if (next === DEFAULT_DUTY_RANGE) query.delete(DUTY_RANGE_PARAM);
    else query.set(DUTY_RANGE_PARAM, next);
    setParams(query, { replace: true });
  };
  const chooseStatus = (next: DutyStatusFilterId) => {
    const query = new URLSearchParams(params);
    if (next === "all") query.delete(DUTY_STATUS_PARAM);
    else query.set(DUTY_STATUS_PARAM, next);
    setParams(query, { replace: true });
  };
  // One derivation for refresh / retry / copy / links. Every block failed in
  // the same batch only when the first read is done and every loadable errored.
  const loadableValues = Object.values(data);
  const allFailed =
    !loading && loadableValues.length > 0 && loadableValues.every((v) => v.k === "error");
  const gates = dutyGates({
    loading,
    refreshing: refreshState.refreshing,
    allFailed,
    cooling: refreshState.cooling,
  });
  const totalEmployees =
    data.stats.k === "ready" ? lifecycleTotal(data.stats.data) : null;

  return (
    <DutyGatesContext.Provider value={gates}>
    <div className="duty-page" data-testid="ov6-page" data-duty-testid="duty-page">
      <span data-testid="duty-gates-scope" data-gates="refresh,retry,copy,link,exportDaily" hidden />
      {forced !== null ? <DutyReproNote state={forced} /> : null}
      <header className="duty-head">
        <div className="duty-title">
          <ShieldCheck className="h-5 w-5" aria-hidden />
          <span className="duty-title-name">值班台</span>
          <span>运营总览 · 只读</span>
          <DutyHealthChip data={data} />
          {(() => {
            // R41: ANY source that carries its own collection stamp counts;
            // the newest (maximum) stamp goes on screen. Only when every
            // source lacks one do we fall back to the em-dash, naming the
            // missing sources in the title. Never a client-side fetch time.
            const stampLegs: { name: string; leg: { k: string; data?: unknown } }[] = [
              { name: "今日运行统计", leg: data.todayStats },
              { name: "运行窗口统计", leg: data.stats },
              { name: `${range.label}统计`, leg: data.stats14 },
              { name: "当日成本账本", leg: data.budgetDay },
              { name: "审批统计", leg: data.approvalStats },
            ];
            const raws = stampLegs.map((sl) =>
              sl.leg.k === "ready" ? asOfOf((sl.leg as { data?: unknown }).data) : null,
            );
            const stamp = raws.reduce<string | null>(
              (acc, v) => (v === null ? acc : acc === null || Date.parse(v) > Date.parse(acc) ? v : acc),
              null,
            );
            const missing = stampLegs
              .map((sl, i) => (raws[i] === null ? sl.name : null))
              .filter((n): n is string => n !== null);
            return (
              <span
                className="duty-meta"
                data-testid="ov6-asof"
                title={
                  stamp
                    ? "取各来源响应自带的采集时间，最新的一个上屏"
                    : `取不到采集时间：未返回采集时间的来源：${missing.join("、")}；不用本机时间顶替`
                }
              >
                {stamp ? `采集时刻 北京时间 ${beijing(stamp)}` : "采集时刻 —（北京时间）"}
              </span>
            );
          })()}
        </div>
        <div className="duty-head-actions">
          <div className="duty-ranges" role="group" aria-label="时间范围">
            {DUTY_RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                className="duty-range"
                data-testid={`duty-range-${r.id}`}
                aria-pressed={r.id === rangeId}
                onClick={() => chooseRange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            outlined
            className="duty-refresh-btn"
            onClick={refreshState.refresh}
            // DU-06①：aria-disabled 而不是原生 disabled——原生 disabled 的按钮拿不到
            // 焦点，读屏与键盘都读不到那句原因；这里让钮可达但按下去不发请求
            // （useDutyData 的节流与单飞锁就是那句原因的牙齿）。
            aria-disabled={!gates.refresh.enabled}
            title={gates.refresh.title ?? undefined}
            aria-busy={refreshState.refreshing}
            data-testid="duty-refresh"
            data-cooling={refreshState.cooling ? "true" : "false"}
            prefix={
              <RefreshCw className={cn("h-3.5 w-3.5", refreshState.refreshing && "animate-spin")} />
            }
          >
            刷新
          </Button>
          {/* Q10 条目6：导出日报没有后端写接口——goto 型占位。aria-disabled
              （非原生 disabled）保焦点可辨；data-planned 与「计划中」明示。 */}
          <Button
            size="sm"
            outlined
            aria-disabled={!gates.exportDaily.enabled}
            data-planned={gates.exportDaily.enabled ? undefined : ""}
            title={gates.exportDaily.title ?? undefined}
            onClick={() => {
              if (!gates.exportDaily.enabled) return;
            }}
            data-testid="duty-export-daily"
          >
            导出日报
          </Button>
          {!gates.exportDaily.enabled ? (
            <span className="duty-meta" data-testid="duty-export-daily-hint">
              计划中
            </span>
          ) : null}
        </div>
      </header>

      <div className="duty-refreshbar" data-testid="duty-refresh-bar">
        {refreshState.refreshing ? (
          <p className="duty-note" role="status" data-testid="duty-busy-note">
            更新中…（区块先保留上一次读到的数据）
          </p>
        ) : null}
        {!refreshState.refreshing && refreshState.cooling ? (
          // DU-06①：节流窗口的原因句要**看得见**，不能只挂在 title 上
          // （DU-07 判据③：关键信息不只存在于 :hover）。句子出自 dutyGates 单点。
          <p className="duty-note" role="status" data-testid="duty-cooling-note">
            {gates.refresh.title}
          </p>
        ) : null}
        {!refreshState.refreshing && refreshState.refreshAt ? (
          <p className="duty-note" data-testid="duty-updated-at">
            刷新完成于 北京时间 {beijing(refreshState.refreshAt)}（读取时刻，不是数据时刻）
          </p>
        ) : null}
        {!refreshState.refreshing &&
        refreshState.refreshDelta &&
        refreshState.refreshDelta.items.length > 0 ? (
          <p className="duty-note duty-changed" data-testid="duty-changed" aria-live="polite">
            {refreshState.refreshDelta.items.map((item, index) => (
              <span key={item.key} data-testid={`duty-changed-${item.key}`}>
                {index > 0 ? "；" : ""}
                {item.text}
              </span>
            ))}
            {refreshState.refreshDelta.more > 0 ? (
              <span data-testid="duty-changed-more">；另有 {refreshState.refreshDelta.more} 项变化</span>
            ) : null}
          </p>
        ) : null}
        {!refreshState.refreshing && refreshState.refreshError ? (
          <div className="duty-refresh-error" data-testid="duty-refresh-error">
            <span>这次刷新没成功</span>
            <details className="duty-error-details">
              <summary>详情</summary>
              <p>{refreshState.refreshError.message}</p>
            </details>
            {refreshState.refreshError.requestId ? (
              <span className="duty-rid">
                请求编号 <code>{refreshState.refreshError.requestId}</code>
                <CopyRid id={refreshState.refreshError.requestId} testId="duty-refresh-rid" />
              </span>
            ) : null}
            <button
              type="button"
              className="duty-retry"
              data-testid="duty-refresh-retry"
              onClick={refreshState.refresh}
            >
              再试
            </button>
          </div>
        ) : null}
      </div>

      <div className="duty-grid duty-grid-3">
        <ReadinessCard
          employees={data.employees}
          stats={data.stats}
          evidence={data.readiness}
          count={counts.employees}
          onRetry={reload}
        />
        <TodayRunsCard
          stats={data.todayStats}
          runs={data.todayRuns}
          count={counts.todayRuns}
          onRetry={retry(["todayStats"])}
          statusFilterId={statusFilterId}
          onChooseStatus={chooseStatus}
        />
        <CostCard
          day={data.budgetDay}
          month={data.budgetMonth}
          employees={data.employees}
          totalEmployees={totalEmployees}
          onRetry={retry(["budgetDay", "budgetMonth"])}
        />
      </div>

      <HealthStrip cost={data.budgetDay} runs={data.todayStats} />

      <AgentFleetRail employees={data.employees} />

      <DutyDetailsSection
        employees={data.employees}
        stats={data.stats}
        evidence={data.readiness}
        employeesCount={counts.employees}
        runsCount={counts.todayRuns}
        todayStats={data.todayStats}
        todayRuns={data.todayRuns}
        day={data.budgetDay}
        month={data.budgetMonth}
        totalEmployees={totalEmployees}
        statusFilterId={statusFilterId}
        onChooseStatus={chooseStatus}
        failedRuns={data.failedRuns}
        blockedTasks={data.blockedTasks}
        approvals={data.approvals}
        approvalStats={data.approvalStats}
        recentRuns={data.recentRuns}
      />


      <div className="duty-grid duty-grid-2">
        <TrendCard
          stats={data.stats14}
          onRetry={retry(["stats14"])}
          label={range.label}
          windowNote={
            range.tsRange === "30d" && range.days < 30
              ? `数据取近 30 天，本卡只显示最近 ${range.days} 天`
              : null
          }
        />
        <ActivityCard activity={data.activity} onRetry={retry(["activity"])} label={range.label} />
      </div>

      <div className="duty-grid duty-grid-3">
        <BlockersCard runs={data.failedRuns} tasks={data.blockedTasks} approvals={data.approvals} onRetry={reload} />
        <PendingCard stats={data.approvalStats} approvals={data.approvals} onRetry={retry(["approvalStats"])} />
        <RecentCard runs={data.recentRuns} onRetry={retry(["recentRuns"])} />
      </div>

      <DutyNotes />
    </div>
    </DutyGatesContext.Provider>
  );
}