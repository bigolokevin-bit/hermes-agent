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
 * Four gates. V1/V2/V3 have no read route in this BFF yet, so they are
 * explicitly unknown and never enter the numerator. V6 is inferred from the
 * employee owner field and labelled as inference.
 */
export function buildReadiness(
  employees: EmployeeRow[] | null,
  stats: Record<string, unknown> | null,
  stamp: string | null = null,
): ReadinessView {
  const total = lifecycleTotal(stats);
  const active = activeCount(stats);
  const unknown = (key: GateView["key"], name: string, code: string, source: string): GateView => ({
    key,
    name,
    pass: null,
    fail: null,
    state: "unknown",
    code,
    source,
    asOf: null,
  });

  const v1 = unknown("V1", "群@", "E_GROUP_WHITELIST", "工位与渠道事件 · 渠道事件数据源未接入");
  const v2 = unknown("V2", "ReBAC", "E_SCOPE_MISS", "有效配置与策略校验 · 策略校验数据源未接入");
  const v3 = unknown("V3", "引用", "E_NO_CITATION", "知识空间与引用 · 知识数据源未接入");

  let v6: GateView;
  if (total === null || employees === null || employees.length < total) {
    v6 = {
      ...unknown("V6", "审批", "E_NO_APPROVER", "审批人名单未冻结 · 负责人推断不完整"),
    };
  } else {
    const pass = employees.filter((e) => Boolean(e.ownerUserId)).length;
    const fail = Math.max(0, total - pass);
    v6 = {
      key: "V6",
      name: "审批",
      pass,
      fail,
      state: fail === 0 ? "pass" : "fail",
      code: "E_NO_APPROVER",
      source: `负责人推断（${pass}/${total}）· 审批人名单未冻结`,
      asOf: stamp,
      inferred: true,
    };
  }

  const gates = [v1, v2, v3, v6];
  const unknownGates = gates.filter((g) => g.state === "unknown").length;
  const confirmed = unknownGates > 0 ? null : gates.reduce((n, g) => Math.min(n, g.pass ?? 0), total ?? 0);
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
  runs: number;
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
    return { label, runs: num(b.runs) ?? 0, failed: num(b.failed) ?? 0 };
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
  const total = buckets.reduce((n, b) => n + b.runs, 0);
  const peak = bucketPeak(buckets);
  const low = buckets.reduce<DayBucketView>((best, b) => (b.runs < best.runs ? b : best), buckets[0]);
  return {
    first: buckets[0],
    last: buckets[buckets.length - 1],
    peak,
    low,
    total,
    empty: total === 0,
  };
}

export function bucketPeak(buckets: DayBucketView[]): DayBucketView | null {
  return buckets.reduce<DayBucketView | null>(
    (best, b) => (best === null || b.runs > best.runs ? b : best),
    null,
  );
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
      href: `/approvals/${encodeURIComponent(approval.approvalId)}`,
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