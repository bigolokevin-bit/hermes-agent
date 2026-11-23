import type {
  ActivityBody,
  ApprovalRow,
  ApprovalStatsBody,
  BlockerItem,
  BudgetBody,
  EmployeeRow,
  GateView,
  ReadinessView,
  RunRow,
  RunStatsBody,
  TaskRow,
} from "./types";
import { num } from "./types";
import { beijing } from "./format";
import type { GateVerdict, ReadinessEvidence } from "./readiness";
import { DENOMINATOR_STATES, rollup, v1Verdict, v2Verdict, v3Verdict, v6Verdict } from "./readiness";

export function lifecycleTotal(stats: Record<string, unknown> | null): number | null {
  if (!stats) return null;
  const by = stats.byLifecycle;
  if (!by || typeof by !== "object" || Array.isArray(by)) return null;
  const rec = by as Record<string, unknown>;
  const keys = ["active", "paused", "offboarding"];
  let total = 0;
  for (const k of keys) {
    const n = num(rec[k]);
    if (n === null) return null;
    total += n;
  }
  return total;
}

export function activeCount(stats: Record<string, unknown> | null): number | null {
  if (!stats) return null;
  const by = stats.byLifecycle;
  if (!by || typeof by !== "object" || Array.isArray(by)) return null;
  return num((by as Record<string, unknown>).active);
}

/**
 * Four gates, computed from live BFF evidence (PRD v4 §2). Nothing is
 * hardcoded to unknown any more: each gate rolls up per-employee verdicts
 * from its evidence source, and an employee whose source did not answer
 * counts as 「待核实」 — unknown never enters the numerator. `evidence` is
 * null only while the evidence fan-out is still in flight (or when the
 * employee directory itself is down), which keeps the loading state honest.
 */
export function buildReadiness(
  employees: EmployeeRow[] | null,
  stats: Record<string, unknown> | null,
  evidence: ReadinessEvidence | null,
  stamp: string | null = null,
  now: number = Date.now(),
): ReadinessView {
  const total = lifecycleTotal(stats);
  const active = activeCount(stats);

  const denom = (employees ?? []).filter((e) =>
    DENOMINATOR_STATES.has(e.lifecycleState ?? "active"),
  );
  // 目录分页没拉满分母时逐员工判定会偏乐观，整组按证据不完整处理。
  const complete = employees !== null && total !== null && denom.length >= total;

  const v1Verdicts = denom.map((e) => {
    const l = evidence?.stations[e.employeeId];
    return l && l.k === "ready" ? v1Verdict(l.data) : null;
  });
  const v2Verdicts = denom.map((e) => {
    const l = evidence?.configs[e.employeeId];
    return l && l.k === "ready" ? v2Verdict(l.data, now) : null;
  });
  const kb = evidence?.knowledge;
  const kbReady = kb && kb.k === "ready" ? kb.data : null;
  const v3Source = !kbReady
    ? "知识文档读口未回答 · 引用证据缺失"
    : !kbReady.wired
      ? "知识库读侧未接线（待后端接入）· 引用证据缺失"
      : kbReady.count === 0
        ? "知识目录可引用文档 0 份"
        : `知识目录可引用文档 ${kbReady.count} 份 · 强制引用策略与运行引用腿未接`;
  const v3Verdicts = denom.map(() => (kbReady ? v3Verdict(kbReady) : null));
  const ap = evidence?.approvals;
  const apRows = ap && ap.k === "ready" ? ap.data : null;
  const v6Verdicts = denom.map((e) => (apRows ? v6Verdict(apRows, e.employeeId, now) : null));

  const roll = (
    key: GateView["key"],
    name: string,
    code: string,
    source: string,
    verdicts: (GateVerdict | null)[],
    stampOverride?: string | null,
  ): GateView => {
    if (!complete || evidence === null) {
      return { key, name, pass: null, fail: null, state: "unknown", code, source, asOf: null };
    }
    const r = rollup(verdicts);
    return {
      key,
      name,
      pass: r.pass,
      fail: r.fail,
      state: r.state,
      code,
      source,
      asOf: r.pass === null ? null : stampOverride ?? stamp,
    };
  };

  // V2 的采集时间取 effective-config 自带的 resolvedAt（真实读取时刻），
  // 其它门沿用统计源的 asOf 时刻；都没有就诚实地显示「截至 —」。
  const v2Resolved = denom
    .map((e) => {
      const l = evidence?.configs[e.employeeId];
      return l && l.k === "ready" ? l.data.resolvedAt : null;
    })
    .filter((s): s is string => Boolean(s))
    .sort();

  const v1 = roll("V1", "群@", "E_GROUP_WHITELIST", "工位绑定（群 + active）· 渠道事件列表 BFF 未代理，仅工位腿", v1Verdicts);
  const v2 = roll(
    "V2",
    "ReBAC",
    "E_SCOPE_MISS",
    "有效配置 scopes/grants 投影 · 策略校验未接读口",
    v2Verdicts,
    v2Resolved.length > 0 ? beijing(v2Resolved[v2Resolved.length - 1]) : null,
  );
  const v3 = roll("V3", "引用", "E_NO_CITATION", v3Source, v3Verdicts);
  const v6 = roll("V6", "审批", "E_NO_APPROVER", "审批 message_send 有效决策（有审批人且未过期）", v6Verdicts);

  const gates = [v1, v2, v3, v6];
  const unknownGates = gates.filter((g) => g.state === "unknown").length;
  // 可上岗分子：四门全部显式通过的员工；任何一门 fail/unknown/无证据都不入。
  // 仍有 unknown 门时不给出伪权威总数（PRD v4 风险表 #1：GAP-01 前不显示单一权威可上岗率）。
  const confirmed =
    unknownGates > 0 || !complete || evidence === null
      ? null
      : denom.reduce(
          (n, _e, i) =>
            n + (v1Verdicts[i] === "pass" && v2Verdicts[i] === "pass" && v3Verdicts[i] === "pass" && v6Verdicts[i] === "pass" ? 1 : 0),
          0,
        );
  const failing = gates.filter((g) => g.state !== "unknown" && (g.fail ?? 0) > 0);
  const narrowest = failing.sort((a, b) => (b.fail ?? 0) - (a.fail ?? 0))[0] ?? null;
  const deltaToNext =
    confirmed !== null && total !== null && confirmed < total ? 1 : null;

  return { total, active, confirmed, unknownGates, narrowest, deltaToNext, gates };
}

export interface RunTotalsView {
  runs: number;
  succeeded: number | null;
  failed: number | null;
  running: number | null;
  costUsd: number | null;
}

export function runTotals(stats: RunStatsBody | null): RunTotalsView | null {
  const t = stats?.totals;
  if (!t) return null;
  const runs = num(t.runs);
  if (runs === null) return null;
  return {
    runs,
    succeeded: num(t.succeeded),
    failed: num(t.failed),
    running: num(t.running),
    costUsd: num(t.costUsd),
  };
}

export interface CostView {
  dayUsd: number | null;
  monthUsd: number | null;
  covered: number | null;
  total: number | null;
  partial: boolean;
  missing: number;
}

export function buildCost(
  day: BudgetBody | null,
  month: BudgetBody | null,
  totalEmployees: number | null,
): CostView {
  const items = day?.items;
  const monthItems = month?.items;
  const missing = new Set<string>([
    ...((day?.missingEmployeeIds ?? []) as string[]),
    ...((month?.missingEmployeeIds ?? []) as string[]),
  ]);
  const covered = Array.isArray(items) ? items.length : null;
  const partial =
    !Array.isArray(items) ||
    !Array.isArray(monthItems) ||
    missing.size > 0 ||
    (totalEmployees !== null && items.length < totalEmployees);

  const sum = (rows: BudgetBody["items"] | undefined): number | null => {
    if (!Array.isArray(rows)) return null;
    let total = 0;
    for (const row of rows) {
      const n = num(row.costUsd);
      if (n === null) return null;
      total += n;
    }
    return total;
  };

  return {
    dayUsd: partial ? null : sum(items),
    monthUsd: partial ? null : sum(monthItems),
    covered,
    total: totalEmployees,
    partial,
    missing: missing.size,
  };
}

export interface DayBucketView {
  label: string;
  /** null means the bucket came back without a value; it is not summed as 0. */
  runs: number | null;
  failed: number;
}

export function dailyBuckets(stats: RunStatsBody | null): DayBucketView[] {
  const rows = Array.isArray(stats?.buckets) ? stats.buckets : [];
  return rows.map((b) => {
    const date = new Date(b.bucketStart);
    const label = Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat("zh-CN", {
          timeZone: "Asia/Shanghai",
          month: "2-digit",
          day: "2-digit",
        }).format(date)
      : "—";
    return { label, runs: num(b.runs), failed: num(b.failed) ?? 0 };
  });
}

export interface TrendSummaryView {
  first: DayBucketView | null;
  last: DayBucketView | null;
  peak: DayBucketView | null;
  low: DayBucketView | null;
  total: number | null;
  /** True when there is nothing to report: no buckets at all, or every bucket is a real zero. */
  empty: boolean;
}

/**
 * The five readings the trend card's text alternative reports. They come from
 * the very buckets the chart draws, so the summary and the picture can never
 * disagree. An empty window totals to null — never to 0 by summation.
 */
export function trendSummary(buckets: DayBucketView[]): TrendSummaryView {
  if (buckets.length === 0) {
    return { first: null, last: null, peak: null, low: null, total: null, empty: true };
  }
  const known = buckets.filter((b): b is DayBucketView & { runs: number } => b.runs !== null);
  const total = known.length === 0 ? null : known.reduce((n, b) => n + b.runs, 0);
  const peak = bucketPeak(buckets);
  const low =
    known.length === 0
      ? null
      : known.reduce<DayBucketView & { runs: number }>(
          (best, b) => (b.runs < best.runs ? b : best),
          known[0],
        );
  return {
    first: buckets[0],
    last: buckets[buckets.length - 1],
    peak,
    low,
    total,
    // An all-missing batch has nothing to report, just like an empty one; it is
    // not a sum of zeros.
    empty: buckets.length === 0 || known.length === 0 || total === 0,
  };
}

export function bucketPeak(buckets: DayBucketView[]): DayBucketView | null {
  return buckets.reduce<DayBucketView | null>((best, b) => {
    if (b.runs === null) return best;
    if (best === null || best.runs === null || b.runs > best.runs) return b;
    return best;
  }, null);
}

export interface ActivityCellView {
  hour: number;
  count: number | null;
  future: boolean;
  level: 0 | 1 | 2 | 3 | 4;
}

export function activity24(
  body: ActivityBody | null,
  weekday: number,
  currentHour: number,
): { cells: ActivityCellView[]; peakHour: number | null; peak: number | null; max: number | null } {
  const all = Array.isArray(body?.cells) ? body.cells : null;
  if (!all) {
    return {
      cells: Array.from({ length: 24 }, (_, hour) => ({ hour, count: null, future: false, level: 0 })),
      peakHour: null,
      peak: null,
      max: null,
    };
  }
  const row = all.filter((c) => c.dow === weekday);
  const max = Math.max(0, ...row.map((c) => num(c.count) ?? 0));
  const cells = Array.from({ length: 24 }, (_, hour) => {
    const cell = row.find((c) => c.hour === hour);
    const count = cell ? num(cell.count) ?? 0 : null;
    const future = hour > currentHour;
    const ratio = count !== null && max > 0 ? count / max : 0;
    const level: ActivityCellView["level"] =
      count === null || future || count === 0 ? 0 : ratio > 0.75 ? 4 : ratio > 0.5 ? 3 : ratio > 0.25 ? 2 : 1;
    return { hour, count, future, level };
  });
  const peakCell = cells.reduce<ActivityCellView | null>(
    (best, c) => (c.count !== null && (best === null || c.count > (best.count ?? 0)) ? c : best),
    null,
  );
  return { cells, peakHour: peakCell?.hour ?? null, peak: peakCell?.count ?? null, max };
}

export function buildBlockers(
  failedRuns: RunRow[] | null,
  blockedTasks: TaskRow[] | null,
  approvals: ApprovalRow[] | null,
  now = Date.now(),
): BlockerItem[] {
  const out: BlockerItem[] = [];
  if (failedRuns && failedRuns.length > 0) {
    out.push({
      object: `${failedRuns.length} 次运行失败`,
      reason: "失败原因需到运行详情查看",
      responsibleModule: "运行",
      step: "运行失败待排查",
      waitingOn: "运行值守",
      waitingSince: failedRuns[0]?.startedAt,
      nextAction: "查看失败详情并重试",
      affectsReadiness: true,
      overSLA: false,
      href: "/runs?status=failed",
    });
  }
  for (const task of blockedTasks ?? []) {
    const due = task.dueAt ? Date.parse(task.dueAt) : NaN;
    out.push({
      object: task.title ?? "未命名任务",
      reason: "任务处于阻塞状态",
      responsibleModule: "任务",
      step: "任务处于阻塞状态",
      waitingOn: "任务负责人",
      waitingSince: task.updatedAt,
      nextAction: "处理阻塞或重新指派",
      affectsReadiness: false,
      overSLA: Number.isFinite(due) && due < now,
      href: `/tasks/${encodeURIComponent(task.taskId)}`,
    });
  }
  for (const approval of approvals ?? []) {
    const expires = approval.expiresAt ? Date.parse(approval.expiresAt) : NaN;
    out.push({
      object: approval.title ?? "待审批事项",
      reason: "等待审批人处理",
      responsibleModule: "审批",
      step: "等待审批人处理",
      waitingOn: "审批人",
      waitingSince: approval.createdAt,
      nextAction: "指派审批人或催办",
      affectsReadiness: true,
      overSLA: Number.isFinite(expires) && expires < now,
      href: `/approvals?id=${encodeURIComponent(approval.approvalId)}`,
    });
  }
  return out.slice(0, 3);
}

export function pendingView(
  stats: ApprovalStatsBody | null,
  approvals: ApprovalRow[] | null,
): { pending: number | null; dueSoon: number | null; rows: ApprovalRow[] } {
  return {
    pending: num(stats?.pending),
    dueSoon: num(stats?.dueSoon),
    rows: approvals ?? [],
  };
}