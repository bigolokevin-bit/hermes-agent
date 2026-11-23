import { beijing } from '../duty/format';
import { isRecord, num } from '../duty/types';
import type { Loadable, RunStatsBody } from '../duty/types';
import type { OverviewSummaryBody, SummaryField } from './api';

/**
 * Q11 合同：总览 KPI 只来自现网 BFF 两个已存在端点——
 * `/api/overview/summary` 与 `/api/run-stats`（bucket=day）。
 * 取不到的读数一律 null（页面显示「未接」），禁止 fixture/假 0/假成功。
 */
export const OVERVIEW_GAP = {
  employees: 'GAP-OV5-EMPLOYEES',
  runs: 'GAP-OV5-RUNS',
  approvals: 'GAP-OV5-APPROVALS',
  cost: 'GAP-OV5-COST',
  trend: 'GAP-OV5-TREND',
  health: 'GAP-OV6-HEALTH',
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

/** 单张卡的一个读数：值 + 它的取数口径原文。value=null 表示「未接」。 */
export interface KpiDatum {
  value: number | string | null;
  /** 接口自带的 source 口径原文；null = 接口没给（页面如实标「来源未标注」）。 */
  source: string | null;
}

export interface KpiView {
  employees: KpiDatum;
  active: KpiDatum;
  todayRuns: KpiDatum;
  /** 今日失败：来自 run-stats 今日桶 totals.failed（summary 无此字段）。 */
  failed: KpiDatum;
  /** 今日失败率 %：failed/runs，仅两者皆为真数且 runs>0 时成立，否则「未接」。 */
  failureRate: KpiDatum;
  pending: KpiDatum;
  costUsd: KpiDatum;
  health: KpiDatum;
  /** summary 顶层采集时间原文（如 2026-11-23T11:41:22Z）。 */
  asOf: string | null;
  asOfSource: string | null;
}

function fieldDatum(field: SummaryField | null | undefined): KpiDatum {
  if (!isRecord(field)) return { value: null, source: null };
  const value =
    typeof field.value === 'number' || typeof field.value === 'string' ? field.value : null;
  const source =
    typeof field.source === 'string' && field.source.trim() ? field.source.trim() : null;
  return { value, source };
}

/** 只在接口真数上算派生值：拿不到就是「未接」，绝不外推、绝不补 0。 */
export function buildKpis(
  summary: OverviewSummaryBody | null,
  today: RunStatsBody | null,
): KpiView {
  const rec = isRecord(summary) ? summary : null;
  const todayRunsDatum = fieldDatum(rec ? rec.todayRuns : null);
  const todayRunsValue = num(todayRunsDatum.value);
  const totals = today && isRecord(today.totals) ? today.totals : null;
  const failedRaw = totals ? (totals as Record<string, unknown>).failed : null;
  const failed = typeof failedRaw === 'number' && !Number.isNaN(failedRaw) ? failedRaw : null;
  const failureRate =
    failed !== null && typeof todayRunsValue === 'number' && todayRunsValue > 0
      ? Math.round((failed / todayRunsValue) * 1000) / 10
      : null;

  return {
    employees: fieldDatum(rec ? rec.employeeTotal : null),
    active: fieldDatum(rec ? rec.activeTotal : null),
    todayRuns: fieldDatum(rec ? rec.todayRuns : null),
    failed: { value: failed, source: failed === null ? null : 'runtime GET /v1/runs/stats（from/to=北京日窗 bucket=day）totals.failed' },
    failureRate: {
      value: failureRate,
      source: failureRate === null ? null : '今日失败 ÷ 今日运行（两值各自接口真数）',
    },
    pending: fieldDatum(rec ? rec.pendingApprovals : null),
    costUsd: fieldDatum(rec ? rec.todayCostUsd : null),
    health: fieldDatum(rec ? rec.healthStatus : null),
    asOf: rec && typeof rec.asOf === 'string' && rec.asOf.trim() ? rec.asOf.trim() : null,
    asOfSource:
      rec && typeof rec.asOfSource === 'string' && rec.asOfSource.trim()
        ? rec.asOfSource.trim()
        : null,
  };
}

/** 今日 run-stats 桶（若接口只回历史窗而缺今日桶，如实 null，不拿昨天冒充）。 */
export function todayBucketRun(body: RunStatsBody | null, todayDate: string): number | null {
  if (!body || !Array.isArray(body.buckets)) return null;
  const hit = body.buckets.find(
    (bucket) => typeof bucket.bucketStart === 'string' && bucket.bucketStart.slice(0, 10) === todayDate,
  );
  if (!hit) return null;
  return typeof hit.runs === 'number' && !Number.isNaN(hit.runs) ? hit.runs : null;
}

export interface TrendPoint {
  day: string;
  label: string;
  runs: number | null;
}

const DAY_LABEL = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: '2-digit',
  day: '2-digit',
});

/** 趋势条：run-stats bucket=day 的 14 日窗（现网无独立 daily-trend 端点，实测 404）。 */
export function trendPoints(body: RunStatsBody | null): TrendPoint[] {
  if (!body || !Array.isArray(body.buckets)) return [];
  return body.buckets.slice(-14).map((bucket) => {
    const start = bucket.bucketStart;
    const date = new Date(start);
    return {
      day: start.slice(0, 10),
      label: Number.isNaN(date.getTime()) ? start : DAY_LABEL.format(date),
      runs: typeof bucket.runs === 'number' && !Number.isNaN(bucket.runs) ? bucket.runs : null,
    };
  });
}
