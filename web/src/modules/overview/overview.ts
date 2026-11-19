import { activeCount, buildBlockers, buildCost, lifecycleTotal, runTotals } from '../duty/aggregate';
import { beijing } from '../duty/format';
import { isRecord, num } from '../duty/types';
import type { ApprovalRow, BudgetBody, Loadable, MatrixBody, RunRow, RunStatsBody, TaskRow } from '../duty/types';
import { normalizeMatrixRow } from '../duty/fixture';

export const OVERVIEW_GAP = {
  employees: 'GAP-OV5-EMPLOYEES',
  runs: 'GAP-OV5-RUNS',
  approvals: 'GAP-OV5-APPROVALS',
  risk: 'GAP-OV5-RISK',
  cost: 'GAP-OV5-COST',
  trend: 'GAP-OV5-TREND',
  activity: 'GAP-OV5-ACTIVITY',
  blockers: 'GAP-OV5-BLOCKERS',
} as const;

const STAMP_KEYS = [
  'asOf',
  'as_of',
  'generatedAt',
  'generated_at',
  'snapshotAt',
  'snapshot_at',
  'updatedAt',
  'updated_at',
  'collectedAt',
  'collected_at',
  'lastUpdated',
  'last_updated',
] as const;

function rawStamp(data: unknown): string | null {
  if (!isRecord(data)) return null;
  for (const key of STAMP_KEYS) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  for (const key of ['meta', 'source', 'ledger'] as const) {
    const nested = data[key];
    if (!isRecord(nested)) continue;
    for (const stampKey of STAMP_KEYS) {
      const value = nested[stampKey];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return null;
}

export interface SourceStamp {
  /** Beijing wall clock to the minute; null when the source supplied no stamp. */
  shown: string | null;
  /** Why the time is unknown. Always set when `shown` is null. */
  reason: string | null;
}

/**
 * Read the service's own collection stamp. A client fetch time is never
 * substituted here: that would make stale data look fresh.
 */
export function sourceStamp(state: Loadable<unknown> | null): SourceStamp {
  if (!state) return { shown: null, reason: '没有可读取的来源' };
  if (state.k === 'loading') return { shown: null, reason: '数据还在读取' };
  if (state.k === 'error') return { shown: null, reason: '本次读取失败，取不到采集时间' };
  const raw = rawStamp(state.data);
  if (!raw) return { shown: null, reason: '上游响应没有带采集时间' };
  const shown = beijing(raw);
  return shown === '—'
    ? { shown: null, reason: '上游采集时间无法解析' }
    : { shown, reason: null };
}

export interface KpiView {
  total: number | null;
  active: number | null;
  atRisk: number | null;
  runs: number | null;
  failed: number | null;
  failureRate: number | null;
  pending: number | null;
  costUsd: number | null;
  costPartial: boolean;
  costMissing: number;
}

export function matrixRiskCount(matrix: Loadable<MatrixBody>): number | null {
  if (matrix.k !== 'ready') return null;
  const rows = (matrix.data.items ?? [])
    .map((row: unknown) => normalizeMatrixRow(row))
    .filter((row): row is NonNullable<typeof row> => row !== null);
  if (rows.length === 0) return null;
  return rows.filter((row) => {
    const risk = row.risk;
    if (!risk) return false;
    return (risk.failedRuns ?? 0) > 0 || (risk.blockedApprovals ?? 0) > 0 || risk.budgetOver === true;
  }).length;
}

export function buildKpis(input: {
  stats: Record<string, unknown> | null;
  todayStats: RunStatsBody | null;
  approvalStats: { pending?: number; dueSoon?: number } | null;
  budgetDay: BudgetBody | null;
  budgetMonth: BudgetBody | null;
  totalEmployeesFallback: number | null;
  matrix: Loadable<MatrixBody>;
}): KpiView {
  const total = lifecycleTotal(input.stats) ?? input.totalEmployeesFallback;
  const active = activeCount(input.stats);
  const totals = runTotals(input.todayStats);
  const runs = totals?.runs ?? null;
  const failed = totals?.failed ?? null;
  const failureRate =
    runs !== null && runs > 0 && failed !== null ? Math.round((failed / runs) * 1000) / 10 : null;
  const pending = num(input.approvalStats?.pending);
  const cost = buildCost(input.budgetDay, input.budgetMonth, total);
  return {
    total,
    active,
    atRisk: matrixRiskCount(input.matrix),
    runs,
    failed,
    failureRate,
    pending,
    costUsd: cost.dayUsd,
    costPartial: cost.partial,
    costMissing: cost.missing,
  };
}

export interface TrendPoint {
  label: string;
  runs: number | null;
  failed: number | null;
}

const DAY_LABEL = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: '2-digit',
  day: '2-digit',
});

export function trendPoints(stats: RunStatsBody | null): TrendPoint[] {
  const buckets = stats?.buckets;
  if (!Array.isArray(buckets)) return [];
  return buckets.slice(-14).map((bucket) => {
    const at = new Date(bucket.bucketStart);
    return {
      label: Number.isNaN(at.getTime()) ? '—' : DAY_LABEL.format(at),
      runs: num(bucket.runs),
      failed: num(bucket.failed),
    };
  });
}

export function blockerRows(input: {
  failedRuns: RunRow[] | null;
  blockedTasks: TaskRow[] | null;
  approvals: ApprovalRow[] | null;
}) {
  return buildBlockers(input.failedRuns, input.blockedTasks, input.approvals);
}