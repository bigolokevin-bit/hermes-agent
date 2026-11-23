import { beijing } from '../duty/format';
import { isRecord, num } from '../duty/types';
import type { Loadable, RunStatsBody } from '../duty/types';
import type { OverviewSummaryBody, QueueBody, RunsBody, SummaryField, TasksBody } from './api';

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
  // 失败率分子分母必须同源：run-stats 同窗 totals.failed ÷ totals.runs（跨端点相除会造出假率）。
  const runsTotRaw = totals ? (totals as Record<string, unknown>).runs : null;
  const runsTot = typeof runsTotRaw === 'number' && !Number.isNaN(runsTotRaw) ? runsTotRaw : null;
  void todayRunsValue;
  const failureRate =
    failed !== null && runsTot !== null && runsTot > 0
      ? Math.round((failed / runsTot) * 1000) / 10
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
  failed: number | null;
}

const DAY_LABEL = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: '2-digit',
  day: '2-digit',
});

const HOUR_LABEL = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  hour12: false,
});

/**
 * 趋势条：run-stats 的日桶/小时桶序列（现网无独立 daily-trend 端点，实测 404）。
 * OM-04 四档窗共用：cap 取档位天数（24h 档为 24 个小时桶）。
 */
export function trendPoints(
  body: RunStatsBody | null,
  opts?: { bucket?: 'day' | 'hour'; cap?: number },
): TrendPoint[] {
  if (!body || !Array.isArray(body.buckets)) return [];
  const bucket = opts?.bucket ?? 'day';
  const cap = opts?.cap ?? 14;
  return body.buckets.slice(-cap).map((b) => {
    const start = b.bucketStart;
    const date = new Date(start);
    return {
      day: bucket === 'hour' ? start : start.slice(0, 10),
      label: Number.isNaN(date.getTime())
        ? start
        : bucket === 'hour'
          ? `${HOUR_LABEL.format(date)}时`
          : DAY_LABEL.format(date),
      runs: typeof b.runs === 'number' && !Number.isNaN(b.runs) ? b.runs : null,
      failed: typeof b.failed === 'number' && !Number.isNaN(b.failed) ? b.failed : null,
    };
  });
}

/* ── OM-07/OM-08 列表行归一化 ─────────────────────────────────────────────
 * 只做形状取值：每条都从接口原始 item 防御读取；缺 runId/taskId 的行直接丢
 * 弃（没有可钻取目标就不上屏），不做任何补数。 */

export interface ActivityRow {
  runId: string;
  time: string | null;
  status: string | null;
}

export function activityRows(body: RunsBody | null): ActivityRow[] {
  if (!body || !Array.isArray(body.items)) return [];
  const rows: ActivityRow[] = [];
  for (const it of body.items) {
    if (!isRecord(it)) continue;
    const runId = typeof it.runId === 'string' && it.runId ? it.runId : null;
    if (!runId) continue;
    const stamp =
      typeof it.startedAt === 'string'
        ? it.startedAt
        : typeof it.endedAt === 'string'
          ? it.endedAt
          : null;
    rows.push({
      runId,
      time: stamp ? beijing(stamp) : null,
      status: typeof it.status === 'string' && it.status ? it.status : null,
    });
  }
  return rows.slice(0, 3);
}

export interface BlockerRow {
  key: string;
  origin: '失败运行' | '任务' | '审批';
  title: string;
  to: string | null;
}

function itemsOf(body: { items?: unknown } | null): unknown[] | null {
  if (!body || !Array.isArray(body.items)) return null;
  return body.items;
}

export function blockerRows(
  failed: RunsBody | null,
  blocked: TasksBody | null,
  queue: QueueBody | null,
): BlockerRow[] {
  const rows: BlockerRow[] = [];
  const failItems = itemsOf(failed);
  if (failItems) {
    for (const it of failItems) {
      if (!isRecord(it)) continue;
      const runId = typeof it.runId === 'string' && it.runId ? it.runId : null;
      const reason = typeof it.reasonCode === 'string' ? ` · ${it.reasonCode}` : '';
      rows.push({
        key: `run-${runId ?? rows.length}`,
        origin: '失败运行',
        title: runId ? `运行 ${runId}${reason}` : `失败运行${reason}`,
        to: runId ? `/runs/${runId}` : null,
      });
    }
  }
  const taskItems = itemsOf(blocked);
  if (taskItems) {
    for (const it of taskItems) {
      if (!isRecord(it)) continue;
      const taskId = typeof it.taskId === 'string' && it.taskId ? it.taskId : null;
      const title = typeof it.title === 'string' && it.title ? it.title : '受阻任务';
      rows.push({
        key: `task-${taskId ?? rows.length}`,
        origin: '任务',
        title,
        to: taskId ? `/tasks/${taskId}` : null,
      });
    }
  }
  const queueItems = itemsOf(queue);
  if (queueItems) {
    for (const it of queueItems) {
      if (!isRecord(it)) continue;
      const id = typeof it.id === 'string' && it.id ? it.id : null;
      const title =
        (typeof it.title === 'string' && it.title) ||
        (typeof it.name === 'string' && it.name) ||
        id ||
        '审批项';
      rows.push({
        key: `queue-${id ?? rows.length}`,
        origin: '审批',
        title,
        to: null, // 队列项没有现网详情页，只列文不造链。
      });
    }
  }
  return rows.slice(0, 8);
}

/** 三路各自的诚实计数：ready 才是真数（含真 0），未接通是 null。 */
export function blockerCounts(
  failed: Loadable<RunsBody>,
  blocked: Loadable<TasksBody>,
  queue: Loadable<QueueBody>,
): { failed: number | null; blocked: number | null; queue: number | null } {
  const count = (l: Loadable<{ items?: unknown }>): number | null =>
    l.k === 'ready' && Array.isArray(l.data.items) ? l.data.items.length : null;
  return { failed: count(failed), blocked: count(blocked), queue: count(queue) };
}
