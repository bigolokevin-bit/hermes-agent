// Module: metrics — 7×24 run activity heatmap.
//
// The activity endpoint aggregates runs by (weekday, hour) over a rolling
// window of whole weeks in the requested timezone. It returns only cells that
// exist; a returned 0 is a real zero, while an absent cell is "no record"
// (rendered as —, never filled with 0). No other source is mixed in.

export const METRICS_GAP = 'GAP-MET5-01';

export const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const;

export const WINDOWS = [
  { weeks: 1, label: '最近 7 天' },
  { weeks: 4, label: '最近 4 周（28 天）' },
  { weeks: 12, label: '最近 12 周（84 天）' },
] as const;

export type ActivityWindow = (typeof WINDOWS)[number];
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Hour = number;

export interface ActivityCell {
  dow: Weekday;
  hour: number;
  count: number | null;
}

export interface Activity {
  cells: ActivityCell[];
  max: number | null;
  from: string | null;
  to: string | null;
  tz: string | null;
}

export type ParsedActivity =
  | { kind: 'ok'; activity: Activity }
  | { kind: 'invalid'; reason: string };

export interface HeatCell {
  dow: Weekday;
  hour: number;
  count: number | null;
  present: boolean;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface HeatGrid {
  rows: { dow: Weekday; label: string; cells: HeatCell[] }[];
  total: number | null;
  peak: HeatCell | null;
  max: number | null;
  presentCells: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function weekday(value: unknown): Weekday | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 7) return null;
  return value as Weekday;
}

function hour(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 23) return null;
  return value;
}

/** Read the activity body without inventing cells or coercing null to 0. */
export function readActivity(payload: unknown): ParsedActivity {
  if (!isRecord(payload) || !Array.isArray(payload.cells)) {
    return { kind: 'invalid', reason: '返回内容里没有可用的热力格。' };
  }
  const cells: ActivityCell[] = [];
  for (const raw of payload.cells) {
    if (!isRecord(raw)) continue;
    const dow = weekday(raw.dow);
    const hr = hour(raw.hour);
    if (dow === null || hr === null) continue;
    cells.push({ dow, hour: hr, count: numberOrNull(raw.count) });
  }
  if (cells.length === 0 && payload.cells.length > 0) {
    return { kind: 'invalid', reason: '返回的热力格缺少星期或小时。' };
  }
  return {
    kind: 'ok',
    activity: {
      cells,
      max: numberOrNull(payload.max),
      from: text(payload.from),
      to: text(payload.to),
      tz: text(payload.tz),
    },
  };
}

/** Build 7×24 cells. Absent cells stay null (—), explicit 0 stays 0. */
export function buildHeatGrid(activity: Activity): HeatGrid {
  const seen = new Map<string, ActivityCell>();
  for (const cell of activity.cells) seen.set(`${cell.dow}-${cell.hour}`, cell);
  const present = [...seen.values()].filter((cell) => cell.count !== null);
  const observedMax = present.length > 0 ? Math.max(...present.map((cell) => cell.count ?? 0)) : null;
  const max = activity.max === null && observedMax === null ? null : Math.max(activity.max ?? 0, observedMax ?? 0);
  const rows = ([1, 2, 3, 4, 5, 6, 7] as const).map((dow) => ({
    dow,
    label: WEEKDAY_LABELS[dow - 1],
    cells: Array.from({ length: 24 }, (_, hr) => {
      const found = seen.get(`${dow}-${hr}`);
      const count = found?.count ?? null;
      return {
        dow,
        hour: hr,
        count,
        present: found !== undefined && found.count !== null,
        level: levelOf(count, max),
      };
    }),
  }));
  const flat = rows.flatMap((row) => row.cells);
  const presentCells = flat.filter((cell) => cell.present).length;
  const total = presentCells > 0 ? flat.reduce((sum, cell) => sum + (cell.count ?? 0), 0) : null;
  const peak = flat.reduce<HeatCell | null>(
    (best, cell) => (cell.count === null ? best : best === null || cell.count > (best.count ?? 0) ? cell : best),
    null,
  );
  return {
    rows,
    total,
    peak,
    max,
    presentCells,
  };
}

function levelOf(count: number | null, max: number | null): HeatCell['level'] {
  if (count === null || count <= 0 || max === null || max <= 0) return 0;
  const ratio = count / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

export function windowOf(weeks: unknown): ActivityWindow {
  const n = typeof weeks === 'number' ? weeks : Number(weeks);
  return WINDOWS.find((w) => w.weeks === n) ?? WINDOWS[0];
}

/** Beijing timestamp for display; ISO input is never shown raw. */
export function formatBeijing(stamp: string | null, fallback = new Date()): string {
  const date = stamp ? new Date(stamp) : fallback;
  const value = Number.isNaN(date.getTime()) ? fallback : date;
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(value);
}

function beijingParts(date: Date): { y: number; m: number; d: number; dow: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const dow = ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[get('weekday')] ?? 1;
  return { y: Number(get('year')), m: Number(get('month')), d: Number(get('day')), dow };
}

/**
 * For a one-week window each weekday occurs exactly once, so the tooltip can
 * name the date. Multi-week windows aggregate several dates and only name the
 * weekday + hour band.
 */
export function cellRangeLabel(dow: Weekday, hour: number, weeks: number, to: string | null): string {
  const hh = String(hour).padStart(2, '0');
  if (weeks !== 1) return `最近 ${weeks} 周 · ${WEEKDAY_LABELS[dow - 1]} ${hh}:00–${hh}:59（北京时间）`;
  const end = to ? new Date(to) : new Date();
  const base = Number.isNaN(end.getTime()) ? new Date() : end;
  const parts = beijingParts(base);
  const diff = (parts.dow - dow + 7) % 7;
  const date = new Date(base.getTime() - diff * 86_400_000);
  const dateParts = beijingParts(date);
  const ymd = `${dateParts.y}-${String(dateParts.m).padStart(2, '0')}-${String(dateParts.d).padStart(2, '0')}`;
  return `${ymd} ${hh}:00–${hh}:59（北京时间）`;
}

export function windowRangeLabel(activity: Activity): string {
  if (!activity.from || !activity.to) return '—';
  return `${formatBeijing(activity.from)} — ${formatBeijing(activity.to)}`;
}

// ---- MET6: usage & cost -----------------------------------------------------
//
// Two read-only sources, kept apart on purpose:
//   runs  → /api/run-stats  (runtime run ledger: counts and outcome rates)
//   cost  → /api/budget-usage (policy budget ledger: the money that was
//           actually charged per employee/period)
// Money is never derived from run counts, tokens, prices or another window.
// A ledger row that says 0 is a real `$0.00`; a period with no row is «—»,
// never `$0.00` and never a filled-in zero.

export const USAGE_GAP = 'GAP-MET6-01';

/** Employee ids per budget-usage read; keeps the query string well under
 *  proxy limits when a tenant has many employees. */
export const LEDGER_CHUNK = 50;

export interface RunTotals {
  runs: number | null;
  succeeded: number | null;
  failed: number | null;
  running: number | null;
  sampleCount: number | null;
  successRate: number | null;
}

export interface RunBucket {
  bucketStart: string | null;
  runs: number | null;
}

export interface RunStats {
  from: string | null;
  to: string | null;
  buckets: RunBucket[];
  totals: RunTotals;
}

export type ParsedRunStats = { kind: 'ok'; stats: RunStats } | { kind: 'invalid'; reason: string };

function totalsOf(raw: Record<string, unknown>): RunTotals {
  return {
    runs: numberOrNull(raw.runs),
    succeeded: numberOrNull(raw.succeeded),
    failed: numberOrNull(raw.failed),
    running: numberOrNull(raw.running),
    sampleCount: numberOrNull(raw.sampleCount),
    successRate: numberOrNull(raw.successRate),
  };
}

/** Read the run-stats body. Absent numbers stay null; nothing is filled in. */
export function readRunStats(payload: unknown): ParsedRunStats {
  if (!isRecord(payload) || !isRecord(payload.totals)) {
    return { kind: 'invalid', reason: '返回内容里没有运行统计。' };
  }
  const buckets: RunBucket[] = Array.isArray(payload.buckets)
    ? payload.buckets
        .filter(isRecord)
        .map((raw) => ({ bucketStart: text(raw.bucketStart), runs: numberOrNull(raw.runs) }))
    : [];
  return {
    kind: 'ok',
    stats: {
      from: text(payload.from),
      to: text(payload.to),
      buckets,
      totals: totalsOf(payload.totals),
    },
  };
}

export interface LedgerRow {
  employeeId: string | null;
  period: string | null;
  tokensUsed: number | null;
  costUsd: number | null;
  updatedAt: string | null;
}

export type ParsedLedger =
  | { kind: 'ok'; rows: LedgerRow[]; missing: string[] }
  | { kind: 'invalid'; reason: string };

/** Read a budget-ledger query body. `items` absent is a malformed body, not
 *  "no cost": an empty `items` array is the honest zero-row answer. */
export function readLedger(payload: unknown): ParsedLedger {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return { kind: 'invalid', reason: '返回内容里没有账本行。' };
  }
  const rows: LedgerRow[] = payload.items.filter(isRecord).map((raw) => ({
    employeeId: text(raw.employeeId),
    period: text(raw.period),
    tokensUsed: numberOrNull(raw.tokensUsed),
    costUsd: numberOrNull(raw.costUsd),
    updatedAt: text(raw.updatedAt),
  }));
  const missing = Array.isArray(payload.missingEmployeeIds)
    ? payload.missingEmployeeIds.filter((id): id is string => typeof id === 'string')
    : [];
  return { kind: 'ok', rows, missing };
}

/** Sum of the ledger rows that carry a number. No rows → null (not 0). */
export function ledgerTotal(rows: LedgerRow[]): number | null {
  let sum = 0;
  let priced = 0;
  for (const row of rows) {
    if (row.costUsd === null) continue;
    sum += row.costUsd;
    priced += 1;
  }
  return priced > 0 ? sum : null;
}

/** Latest ledger write time across rows — the honest "as of" for the money. */
export function ledgerAsOf(rows: LedgerRow[]): string | null {
  let latest: string | null = null;
  for (const row of rows) {
    if (!row.updatedAt) continue;
    if (latest === null || row.updatedAt > latest) latest = row.updatedAt;
  }
  return latest;
}

/** USD with cents. A missing value is «—», never $0.00. */
export function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `$${value.toFixed(2)}`;
}

export function formatCount(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : String(value);
}

/** 0.9967 → 99.7%; null → «—». Only formats a rate the server computed. */
export function formatRate(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const pct = Math.round(value * 1000) / 10;
  return `${pct}%`;
}

/** Beijing calendar day key, `YYYY-MM-DD`. */
export function beijingDayKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Beijing 00:00 for a day key, as an ISO instant (UTC offset +08:00). */
export function beijingDayStartIso(key: string): string {
  return new Date(`${key}T00:00:00+08:00`).toISOString();
}

export function chunkIds(ids: string[], size = LEDGER_CHUNK): string[][] {
  const step = Math.max(1, Math.floor(size));
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += step) chunks.push(ids.slice(index, index + step));
  return chunks;
}

export interface SparkSlot {
  hour: number;
  runs: number | null;
}

export interface SparkGrid {
  slots: SparkSlot[];
  max: number | null;
  observed: number;
}

/**
 * Place returned hourly buckets onto the 24-slot window that starts at `from`.
 * Hours the endpoint did not return stay null — they are drawn as empty slots,
 * never as zero-height bars that would claim "this hour ran 0 times".
 */
export function sparkSlots(stats: RunStats, from: string, to: string, count = 24): SparkGrid {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  const span = Number.isFinite(start) && Number.isFinite(end) ? Math.max(1, end - start) : 86_400_000;
  const width = Math.max(1, Math.floor(count));
  const slots: SparkSlot[] = Array.from({ length: width }, (_, hour) => ({ hour, runs: null }));
  let max: number | null = null;
  let observed = 0;
  for (const bucket of stats.buckets) {
    if (!bucket.bucketStart || bucket.runs === null) continue;
    const at = new Date(bucket.bucketStart).getTime();
    if (!Number.isFinite(at) || !Number.isFinite(start)) continue;
    const slot = Math.floor(((at - start) / span) * width);
    if (slot < 0 || slot >= width) continue;
    slots[slot] = { hour: slot, runs: bucket.runs };
    observed += 1;
    max = max === null || bucket.runs > max ? bucket.runs : max;
  }
  return { slots, max, observed };
}
// ---- MET6: window presets, unit price, employee short code ------------------

export const WINDOW_PRESETS = [
  { id: '24h', label: '最近 24 小时', hours: 24, bucket: 'hour', slots: 24 },
  { id: '7d', label: '最近 7 天', hours: 168, bucket: 'day', slots: 7 },
  { id: '30d', label: '最近 30 天', hours: 720, bucket: 'day', slots: 30 },
] as const;

export type UsageWindowId = (typeof WINDOW_PRESETS)[number]['id'];

export function usageWindowOf(value: unknown): (typeof WINDOW_PRESETS)[number] {
  const found = WINDOW_PRESETS.find((preset) => preset.id === value);
  return found ?? WINDOW_PRESETS[0];
}

/** Half-open window ending `now`, as ISO instants. */
export function windowRange(now: Date, id: UsageWindowId): { from: string; to: string } {
  const preset = usageWindowOf(id);
  return {
    from: new Date(now.getTime() - preset.hours * 3_600_000).toISOString(),
    to: now.toISOString(),
  };
}

/** 8-char upper-case employee code, matching the rest of the console. */
export function shortCode(id: string | null): string {
  if (!id) return '—';
  const bare = id.replace(/^emp_/i, '').replace(/[^A-Za-z0-9]/g, '');
  return bare ? bare.slice(0, 8).toUpperCase() : '—';
}

export function employeeLabel(name: string | null, id: string | null): string {
  const code = shortCode(id);
  if (name && name.trim()) return `${name.trim()} · ${code}`;
  return code === '—' ? '未署名员工' : `员工 · ${code}`;
}

export interface PriceRow {
  modelId: string | null;
  label: string;
  inputPerMillion: number | null;
  outputPerMillion: number | null;
  currency: string | null;
  asOf: string | null;
}

export type ParsedPricing = { kind: 'ok'; rows: PriceRow[]; asOf: string | null } | { kind: 'invalid'; reason: string };

/** Read the model price list. Absent prices stay null and print as «—»; the
 *  page never multiplies them by usage to invent a charge. */
export function readPricing(payload: unknown): ParsedPricing {
  if (!isRecord(payload)) return { kind: 'invalid', reason: '返回内容里没有价目表。' };
  const container = Array.isArray(payload.prices)
    ? payload.prices
    : Array.isArray(payload.items)
      ? payload.items
      : Array.isArray(payload.models)
        ? payload.models
        : null;
  if (container === null) return { kind: 'invalid', reason: '返回内容里没有价目表。' };
  const rows: PriceRow[] = [];
  for (const raw of container) {
    if (!isRecord(raw)) continue;
    const modelId = text(raw.modelId) ?? text(raw.id) ?? text(raw.model);
    rows.push({
      modelId,
      label: text(raw.label) ?? text(raw.name) ?? modelId ?? '未命名模型',
      inputPerMillion: numberOrNull(raw.inputPerMillion ?? raw.input),
      outputPerMillion: numberOrNull(raw.outputPerMillion ?? raw.output),
      currency: text(raw.currency),
      asOf: text(raw.asOf),
    });
  }
  const asOfRaw = text(payload.asOf);
  return { kind: 'ok', rows, asOf: asOfRaw };
}

/** `$0.14 / 百万 token`; a missing price is «—». */
export function formatUnitPrice(value: number | null, currency: string | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const symbol = currency === null || currency.toUpperCase() === 'USD' ? '$' : '';
  return `${symbol}${value.toFixed(2)} / 百万 token`;
}
