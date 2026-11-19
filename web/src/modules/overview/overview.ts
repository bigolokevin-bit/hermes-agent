import { activeCount, buildBlockers, buildCost, dailyBuckets, lifecycleTotal, runTotals } from '../duty/aggregate';
import { num } from '../duty/types';
import type { ApprovalRow, BudgetBody, Loadable, MatrixBody, RunRow, RunStatsBody, TaskRow } from '../duty/types';
import { normalizeMatrixRow } from '../duty/fixture';

export const OVERVIEW_GAP = {
  risk: 'GAP-OV5-RISK',
  cost: 'GAP-OV5-COST',
  trend: 'GAP-OV5-TREND',
  activity: 'GAP-OV5-ACTIVITY',
  blockers: 'GAP-OV5-BLOCKERS',
} as const;

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
  runs: number;
  failed: number;
}

export function trendPoints(stats: RunStatsBody | null): TrendPoint[] {
  return dailyBuckets(stats).slice(-14);
}

export function blockerRows(input: {
  failedRuns: RunRow[] | null;
  blockedTasks: TaskRow[] | null;
  approvals: ApprovalRow[] | null;
}) {
  return buildBlockers(input.failedRuns, input.blockedTasks, input.approvals);
}