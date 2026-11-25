import { activeCount, buildBlockers, buildCost, lifecycleTotal, runTotals } from '../duty/aggregate';
import { beijing } from '../duty/format';
import { isRecord, num } from '../duty/types';
import type { ApprovalRow, BudgetBody, Loadable, MatrixBody, RunRow, RunStatsBody, TaskRow } from '../duty/types';
import { normalizeMatrixRow } from '../duty/fixture';
import { heatLevel } from './VizChart';

export const OVERVIEW_GAP = {
  employees: 'GAP-OV5-EMPLOYEES',
  runs: 'GAP-OV5-RUNS',
  approvals: 'GAP-OV5-APPROVALS',
  risk: 'GAP-OV5-RISK',
  cost: 'GAP-OV5-COST',
  trend: 'GAP-OV5-TREND',
  activity: 'GAP-OV5-ACTIVITY',
  blockers: 'GAP-OV5-BLOCKERS',
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

/**
 * 趋势点位随窗取尾部 N 桶（OM-04：14d 之外的档位读 30d 后由
 * duty 层裁桶，这里再按档位天数收口，缺省 14 保持既有口径）。
 */
export function trendPoints(stats: RunStatsBody | null, days = 14): TrendPoint[] {
  return trendWindow(stats, days);
}

const DAY_KEY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Beijing is UTC+8 year-round — the day grid can be cut on fixed 24h steps. */
const SH_OFFSET_MS = 8 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

function beijingDayStart(ms: number): number {
  return Math.floor((ms + SH_OFFSET_MS) / DAY_MS) * DAY_MS - SH_OFFSET_MS;
}

function dayKeyOf(ms: number): string {
  return DAY_KEY.format(new Date(ms));
}

/**
 * 近 N 天逐日点位：把读口返回的桶铺到「日格」上，没有桶的那一天默认是 null
 * （缺读数），既不是 0，也不是被跳过的一格。窗口末端优先用响应自带的 `to`；
 * 测试/旧响应没有 `to` 时以最后一个桶为末端，且不回填第一个桶之前的日子。
 *
 * 唯一的「缺日＝真 0」豁免：响应同时给 `totals.runs`，且窗口内每个桶都有读数、
 * 各桶之和恰等于 totals。此时未返回的日子按算术闭合可证为 0（不是猜），
 * 卡面必须把这条推导写在脚注里。桶本身 `runs: null`（上游明说没有读数）
 * 永不进这个分支，仍按缺读数断开。
 */
export function trendWindow(stats: RunStatsBody | null, days = 14): TrendPoint[] {
  const buckets = Array.isArray(stats?.buckets) ? stats.buckets : [];
  const parsed = buckets
    .map((bucket) => ({
      ms: Date.parse(bucket.bucketStart),
      runs: num(bucket.runs),
      failed: num(bucket.failed),
    }))
    .filter((row) => Number.isFinite(row.ms));
  if (parsed.length === 0) return [];

  const byDay = new Map<string, { runs: number | null; failed: number | null }>();
  for (const row of parsed) byDay.set(dayKeyOf(row.ms), { runs: row.runs, failed: row.failed });

  const lastMs = Math.max(...parsed.map((row) => row.ms));
  const firstMs = Math.min(...parsed.map((row) => row.ms));
  const toMs = typeof stats?.to === 'string' ? Date.parse(stats.to) : NaN;
  const hasTo = Number.isFinite(toMs);
  const endMs = beijingDayStart(hasTo ? toMs : lastMs);
  let startMs = endMs - (days - 1) * DAY_MS;
  // 没有响应级 to 时只铺数据自己的跨度，既不把首桶之前当缺读数，也不硬凑天数。
  if (!hasTo) startMs = Math.max(startMs, beijingDayStart(firstMs));

  const count = Math.max(1, Math.round((endMs - startMs) / DAY_MS) + 1);
  return Array.from({ length: count }, (_, i) => {
    const ms = startMs + i * DAY_MS;
    const hit = byDay.get(dayKeyOf(ms));
    // 轴标签用日格键直接裁成 MM-DD（北京时区已由 dayKeyOf 固定）：
    // 避免 locale 的「11/24」在缩略图里被读成「12/24」，也让首/中/末三标
    // 与日格一一对应（首日、中间日、窗口末日）。
    return {
      label: dayKeyOf(ms).slice(5),
      runs: hit ? hit.runs : null,
      failed: hit ? hit.failed : null,
    };
  });
}

/**
 * 合计闭合证明：窗口内每个桶都有读数且各桶之和恰等于 `totals.runs` 时，
 * 未返回的日子按算术可证为 0。返回可证为 0 的缺日数；不可证返回 0。
 * 明确 `runs: null` 的桶不是「缺日」，永不进这个证明（缺读数就是缺读数）。
 */
export function provenZeroFill(stats: RunStatsBody | null, points: TrendPoint[]): number {
  const totals = num(stats?.totals?.runs);
  if (totals === null || points.length === 0) return 0;
  const known = points.filter((p) => p.runs !== null);
  if (known.length === 0) return 0;
  const missing = points.length - known.length;
  if (missing === 0) return 0;
  const sum = known.reduce((n, p) => n + (p.runs as number), 0);
  return sum === totals ? missing : 0;
}

/** 近 N 天迷你日格（首排卡 2/卡 3 底的 7 根竖条用）：逐日次数与金额。 */
export interface MiniDay {
  /** 北京日格键，MM-DD。 */
  label: string;
  /** 当日运行次数；null=读口没给这一天（不是 0）。 */
  runs: number | null;
  /** 当日记账金额；null=读口没给这一天（不是 0）。 */
  costUsd: number | null;
  /** 最右一格=今天（北京日窗末端）。 */
  today: boolean;
}

export interface MiniDaysView {
  days: MiniDay[];
  /**
   * 缺日是否已被「各桶之和 = totals」证明为 0：证明成立时 days 里的 null 已按
   * 真零铺平（与趋势图同一口径），7 日合计因此可写成精确值而不是下限。
   */
  zeroProven: boolean;
}

/**
 * 近 N 天迷你日序列：与 trendWindow 同一日格口径（北京日、末端优先用响应自带
 * `to`），额外带每日 costUsd。缺日在证明成立时落成 0，否则保持 null（缺读数），
 * 绝不拿「没读到」冒充 0。
 */
export function miniDays(stats: RunStatsBody | null, days = 7): MiniDaysView {
  const buckets = Array.isArray(stats?.buckets) ? stats.buckets : [];
  const parsed = buckets
    .map((bucket) => ({
      ms: Date.parse(bucket.bucketStart),
      runs: num(bucket.runs),
      cost: num(bucket.costUsd),
    }))
    .filter((row) => Number.isFinite(row.ms));
  // 算术闭合证明（与 provenZeroFill 同判据）：每个桶都给了读数且各桶之和 = totals。
  const allKnown = parsed.length > 0 && parsed.every((row) => row.runs !== null);
  const sumRuns = parsed.reduce((n, row) => n + (row.runs ?? 0), 0);
  const totalsRuns = num(stats?.totals?.runs);
  const zeroProven = allKnown && totalsRuns !== null && sumRuns === totalsRuns;
  if (parsed.length === 0) return { days: [], zeroProven: false };

  const byDay = new Map<string, { runs: number | null; cost: number | null }>();
  for (const row of parsed) byDay.set(dayKeyOf(row.ms), { runs: row.runs, cost: row.cost });

  const lastMs = Math.max(...parsed.map((row) => row.ms));
  const toMs = typeof stats?.to === 'string' ? Date.parse(stats.to) : NaN;
  const endMs = beijingDayStart(Number.isFinite(toMs) ? toMs : lastMs);
  const startMs = endMs - (days - 1) * DAY_MS;
  const out: MiniDay[] = Array.from({ length: days }, (_, i) => {
    const ms = startMs + i * DAY_MS;
    const hit = byDay.get(dayKeyOf(ms));
    const zero = zeroProven ? 0 : null;
    return {
      label: dayKeyOf(ms).slice(5),
      runs: hit ? hit.runs : zero,
      costUsd: hit ? hit.cost : zero,
      today: i === days - 1,
    };
  });
  return { days: out, zeroProven };
}

export interface DayActivityCellView {
  hour: number;
  /** null＝该小时没有读到（未发生/无读数），与真 0 区分。 */
  count: number | null;
  level: number;
}

export interface DayActivityView {
  cells: DayActivityCellView[];
  peak: { hour: number; count: number } | null;
  day: number | null;
  dayLabel: string | null;
  /** 整个读取窗口的合计（不只是被选中那一天的）。 */
  windowTotal: number;
  hasRead: boolean;
}

const DOW_LABEL: Record<number, string> = {
  0: '周日',
  1: '周一',
  2: '周二',
  3: '周三',
  4: '周四',
  5: '周五',
  6: '周六',
  7: '周日',
};

/**
 * 24 小时活跃：从 run-activity 的星期×小时矩阵里取「读数最多的一天」铺成
 * 24 格。返回形状的每一格都只来自真读数；没有格子的小时是 null（画斜线），
 * 不当 0。为什么不是「今天」：读口只给星期不给日期，窗口内也不保证今天有
 * 读数，不拿浏览器时钟猜一个「今天」出来。
 */
export function dayActivity(cells: unknown): DayActivityView {
  const list = Array.isArray(cells) ? cells : [];
  const rows = new Map<number, Map<number, number>>();
  let windowTotal = 0;
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const cell = raw as { dow?: unknown; hour?: unknown; count?: unknown };
    const dow = num(cell.dow);
    const hour = num(cell.hour);
    const count = num(cell.count);
    if (dow === null || hour === null || count === null) continue;
    if (hour < 0 || hour > 23) continue;
    if (!rows.has(dow)) rows.set(dow, new Map());
    rows.get(dow)!.set(hour, count);
    windowTotal += count;
  }
  if (rows.size === 0) {
    return { cells: [], peak: null, day: null, dayLabel: null, windowTotal: 0, hasRead: false };
  }
  let bestDay: number | null = null;
  let bestTotal = -1;
  for (const [dow, hours] of rows) {
    let total = 0;
    for (const count of hours.values()) total += count;
    if (total > bestTotal) {
      bestTotal = total;
      bestDay = dow;
    }
  }
  const hours = bestDay === null ? null : rows.get(bestDay) ?? null;
  const dayCells: DayActivityCellView[] = Array.from({ length: 24 }, (_, hour) => {
    const count = hours?.has(hour) ? (hours.get(hour) as number) : null;
    return { hour, count, level: count === null ? 0 : heatLevel(count) };
  });
  let peak: DayActivityView['peak'] = null;
  for (const cell of dayCells) {
    if (cell.count === null) continue;
    if (peak === null || cell.count > peak.count) peak = { hour: cell.hour, count: cell.count };
  }
  return {
    cells: dayCells,
    peak,
    day: bestDay,
    dayLabel: bestDay === null ? null : DOW_LABEL[bestDay] ?? null,
    windowTotal,
    hasRead: true,
  };
}

/**
 * 月配额合计只来自能力矩阵里每名员工自带的 budget.monthlyCostUsd；任一员工
 * 缺这个字段就整项返回 null（不给部分和冒充合计）。没有矩阵就是 null。
 */
export function monthQuota(matrix: Loadable<MatrixBody>): number | null {
  if (matrix.k !== 'ready') return null;
  const items = Array.isArray(matrix.data.items) ? matrix.data.items : [];
  let sum = 0;
  let seen = 0;
  for (const raw of items) {
    if (!isRecord(raw) || !isRecord(raw.budget)) continue;
    const value = num(raw.budget.monthlyCostUsd);
    if (value === null) return null;
    sum += value;
    seen += 1;
  }
  return seen > 0 ? sum : null;
}

export function blockerRows(input: {
  failedRuns: RunRow[] | null;
  blockedTasks: TaskRow[] | null;
  approvals: ApprovalRow[] | null;
}) {
  return buildBlockers(input.failedRuns, input.blockedTasks, input.approvals);
}

export interface OverviewSummaryRow {
  label: string;
  value: string;
  source: string | null;
  stamp: string | null;
}

/**
 * OM-13（重放）：运营总览摘要纯文本。
 * 纯函数：不发请求、不做金额反推；缺值一律「—」，与卡面同源同词。
 * 成本口径句必须逐字引用 metrics/costCaliberNote 的单源常量，禁止再造第二套词汇。
 */
export function overviewSummaryText(input: {
  asOf: string | null;
  rows: OverviewSummaryRow[];
  costCaliber?: string;
}): string {
  const lines = [
    '运营总览摘要',
    input.asOf
      ? `数据截至 ${input.asOf}（北京时间）`
      : '数据截至 —（只认上游采集时间，前端时钟不顶替）',
  ];
  for (const row of input.rows) {
    lines.push(`- ${row.label}：${row.value}｜来源 ${row.source ?? '—'}｜采集时刻 ${row.stamp ?? '—'}`);
  }
  if (input.costCaliber) lines.push(`成本口径：${input.costCaliber}`);
  return lines.join('\n');
}