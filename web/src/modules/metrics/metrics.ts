// Module: metrics — 7×24 run activity heatmap.
import { ASOF_KEYS, readAsOf } from './asof';
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
  /** Cells the endpoint never returned. Kept separate from a real 0. */
  missingCells: number;
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
    missingCells: flat.length - presentCells,
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
  /** Budget cap for the period, when the ledger ever carries one. */
  limitUsd: number | null;
  /** Run/session count on the row when the ledger carries one; null otherwise. */
  runs: number | null;
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
    limitUsd: numberOrNull(raw.limitUsd) ?? numberOrNull(raw.limit) ?? numberOrNull(raw.capUsd),
    runs: numberOrNull(raw.runs) ?? numberOrNull(raw.sessions) ?? numberOrNull(raw.runCount) ?? numberOrNull(raw.run_count),
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

/** Thousands groups in the integer part. Display decoration only: no value changes. */
function groupThousands(digits: string): string {
  const negative = digits.startsWith('-');
  const body = negative ? digits.slice(1) : digits;
  const [int, frac] = body.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${frac === undefined ? '' : `.${frac}`}`;
}

/**
 * The one rounding rule for money: two decimals, no symbol, no grouping.
 * Machine form for files; `formatUsd` decorates the same digits for the screen.
 */
export function usdDigits(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return value.toFixed(2);
}

/** USD with cents and thousands: `$1,234.56`. A missing value is «—», never $0.00. */
export function formatUsd(value: number | null): string {
  const digits = usdDigits(value);
  if (digits === null) return '—';
  const negative = digits.startsWith('-');
  return `${negative ? '-' : ''}$${groupThousands(negative ? digits.slice(1) : digits)}`;
}

/** Counts group thousands: `1,234`. A missing count is «—», never 0. */
export function formatCount(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : groupThousands(String(value));
}

/** The one rounding rule for a share: one decimal, no «%». Machine form for files. */
export function digitsPct(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return value.toFixed(1);
}

/** Screen share: `12.3%`; a share that cannot be computed is «—». */
export function formatSharePct(value: number | null): string {
  const digits = digitsPct(value);
  return digits === null ? '—' : `${digits}%`;
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
  const asOfRaw = readTopAsOf(payload);
  return { kind: 'ok', rows, asOf: asOfRaw };
}

/** `$0.14 / 百万 token`; a missing price is «—». */
export function formatUnitPrice(value: number | null, currency: string | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const symbol = currency === null || currency.toUpperCase() === 'USD' ? '$' : '';
  const digits = usdDigits(value) ?? '—';
  return digits === '—' ? digits : `${symbol}${groupThousands(digits)} / 百万 token`;
}

// ---- MET6: breakdown views (by employee / by model) -------------------------

export interface EmployeeSpend {
  employeeId: string | null;
  name: string | null;
  costUsd: number | null;
  /** Sum of the rows that carry a run count; null when none do. */
  runs: number | null;
  ledgerRows: number;
  asOf: string | null;
}

/** Fold ledger rows into one line per employee. A row without a number keeps
 *  `costUsd: null` — the fold never substitutes zero. */
export function aggregateByEmployee(rows: LedgerRow[], names: Record<string, string>): EmployeeSpend[] {
  const byId = new Map<string, EmployeeSpend>();
  for (const row of rows) {
    const key = row.employeeId ?? '—';
    const found = byId.get(key);
    const entry: EmployeeSpend = found ?? {
      employeeId: row.employeeId,
      name: row.employeeId ? names[row.employeeId] ?? null : null,
      costUsd: null,
      runs: null,
      ledgerRows: 0,
      asOf: null,
    };
    entry.ledgerRows += 1;
    if (row.runs !== null) entry.runs = (entry.runs ?? 0) + row.runs;
    if (row.costUsd !== null) entry.costUsd = (entry.costUsd ?? 0) + row.costUsd;
    if (row.updatedAt && (entry.asOf === null || row.updatedAt > entry.asOf)) entry.asOf = row.updatedAt;
    byId.set(key, entry);
  }
  return [...byId.values()].sort((a, b) => (b.costUsd ?? -1) - (a.costUsd ?? -1));
}

export interface ModelUsageLine {
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  apiCalls: number | null;
  sessions: number | null;
}

export type ParsedModelUsage =
  | { kind: 'ok'; lines: ModelUsageLine[]; costUsd: number | null; asOf: string | null }
  | { kind: 'invalid'; reason: string };

/** Read Hermes usage `by_model`. The upstream strips per-model money, so a
 *  missing cost stays null and the view prints «—» with its reason. */
export function readModelUsage(payload: unknown): ParsedModelUsage {
  if (!isRecord(payload)) return { kind: 'invalid', reason: '返回内容里没有用量明细。' };
  const asOf = readTopAsOf(payload);
  const costBlock = isRecord(payload.cost) ? payload.cost : null;
  const costUsd = costBlock ? numberOrNull(costBlock.cost_usd) : null;
  if (!Array.isArray(payload.by_model)) return { kind: 'ok', lines: [], costUsd, asOf };
  const lines: ModelUsageLine[] = [];
  for (const raw of payload.by_model) {
    if (!isRecord(raw)) continue;
    const model = text(raw.model) ?? text(raw.modelId) ?? text(raw.name);
    if (!model) continue;
    lines.push({
      model,
      inputTokens: numberOrNull(raw.input_tokens) ?? numberOrNull(raw.inputTokens),
      outputTokens: numberOrNull(raw.output_tokens) ?? numberOrNull(raw.outputTokens),
      apiCalls: numberOrNull(raw.api_calls) ?? numberOrNull(raw.apiCalls),
      sessions: numberOrNull(raw.sessions),
    });
  }
  return { kind: 'ok', lines, costUsd, asOf };
}

/** Share of a total; null when the total is unknown or not positive. */
export function shareOf(value: number | null, total: number | null): number | null {
  if (value === null || total === null || !Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return null;
  return Math.round((value / total) * 1000) / 10;
}

/**
 * The total of a column: unreadable cells are skipped, never counted as 0.
 * A column where nothing is readable has no total at all — «—», not 0.
 */
export function sumOrNull(values: (number | null)[]): number | null {
  let seen = false;
  let sum = 0;
  for (const value of values) {
    if (value === null || !Number.isFinite(value)) continue;
    seen = true;
    sum += value;
  }
  return seen ? sum : null;
}

/**
 * The share of the whole for a totals row: summed from the unrounded parts, so
 * the per-row rounding never drags the total off 100.0%. Unreadable parts are
 * skipped; when there is no denominator or no readable part, there is no share.
 */
export function shareOfWhole(values: (number | null)[], total: number | null): number | null {
  if (total === null || !Number.isFinite(total) || total <= 0) return null;
  let seen = false;
  let sum = 0;
  for (const value of values) {
    if (value === null || !Number.isFinite(value) || value < 0) continue;
    seen = true;
    sum += value;
  }
  if (!seen) return null;
  return Math.round((sum / total) * 1000) / 10;
}

// ---- MET7: cost share by model ---------------------------------------------

export interface ModelCostRow {
  model: string;
  /** Stable key for test ids when the label is not ASCII (employee names). */
  key?: string;
  /**
   * The upstream identifier this row stands for (employeeId today). It is never
   * rendered: it only rides into a drill href, so the list keeps showing names
   * and 8-character codes.
   */
  rawId?: string;
  /** Session count as upstream reports it; null when the answer has none. */
  runs: number | null;
  /** Ledger actual only. An estimate is never promoted into this field. */
  costUsd: number | null;
}

export type ModelCostSort = 'cost' | 'runs' | 'model';
export type SortDir = 'asc' | 'desc';

/** Where a cost row's runs drill points, and whether /runs can honour it. */
export interface RunsDrill {
  href: string;
  /** True only when the runs page really narrows by this row's owner. */
  filtered: boolean;
  /** Honest sentence when the row filter cannot ride along; null when it does. */
  note: string | null;
}

/**
 * Measured contract (2026-11-20): `/runs` reads exactly
 * `window|status|state|run|employee`, and the BFF list accepts exactly
 * `employeeId|status|since`. A `model` key is neither read by the page nor
 * accepted by the BFF, so a model row opens the same time window unfiltered
 * instead of painting a filter that does nothing.
 */
export function runsDrill(row: ModelCostRow, source: 'model' | 'employee', windowId: string): RunsDrill {
  const windowKey = /^(24h|7d|30d)$/.test(windowId) ? windowId : '7d';
  if (source === 'employee' && row.rawId) {
    return {
      href: `/runs/?employee=${encodeURIComponent(row.rawId)}&window=${windowKey}`,
      filtered: true,
      note: null,
    };
  }
  return {
    href: `/runs/?window=${windowKey}`,
    filtered: false,
    note:
      source === 'employee'
        ? '这一行没有员工标识，运行页无法按人筛选；打开的是同一时间窗的全部运行。'
        : '运行页暂不支持按模型筛选；打开的是同一时间窗的全部运行。',
  };
}

export type ParsedModelCost =
  | { kind: 'ok'; rows: ModelCostRow[]; asOf: string | null }
  | { kind: 'invalid'; reason: string };

/** Money keys that count as an actual charge. `estimated_cost*` is
 *  deliberately absent: an estimate is not a ledger row. */
const MODEL_COST_MONEY_KEYS = ['actual_cost_usd', 'actualCostUsd', 'cost_usd', 'costUsd'] as const;

export function readModelCost(payload: unknown): ParsedModelCost {
  if (!isRecord(payload)) return { kind: 'invalid', reason: '返回内容里没有按模型的用量。' };
  const asOf = readTopAsOf(payload);
  const costBlock = isRecord(payload.cost) ? payload.cost : null;
  const rowsRaw = Array.isArray(payload.by_model)
    ? payload.by_model
    : costBlock && Array.isArray(costBlock.by_model)
      ? costBlock.by_model
      : null;
  if (rowsRaw === null) return { kind: 'ok', rows: [], asOf };
  const rows: ModelCostRow[] = [];
  for (const raw of rowsRaw) {
    if (!isRecord(raw)) continue;
    const model = text(raw.model) ?? text(raw.modelId) ?? text(raw.name);
    if (!model) continue;
    let costUsd: number | null = null;
    for (const key of MODEL_COST_MONEY_KEYS) {
      const value = numberOrNull(raw[key]);
      if (value !== null) {
        costUsd = value;
        break;
      }
    }
    rows.push({ model, runs: numberOrNull(raw.sessions) ?? numberOrNull(raw.runs), costUsd });
  }
  return { kind: 'ok', rows, asOf };
}

/** Percent shares in tenths of a point; the readable rows always add up to
 *  exactly 100.0%. A row without a charge keeps null («—»), and a zero total
 *  yields no shares at all rather than a silent 0%. */
export function shareOfCosts(costs: (number | null)[]): (number | null)[] {
  const readable = costs.filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0);
  const total = readable.reduce((sum, value) => sum + value, 0);
  if (readable.length === 0 || total <= 0) return costs.map(() => null);
  const raw = costs.map((value) =>
    value === null || !Number.isFinite(value) || value <= 0 ? 0 : (value / total) * 1000,
  );
  const tenths = raw.map((value) => Math.floor(value + 1e-9));
  const left = 1000 - tenths.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, rest: value - Math.floor(value + 1e-9) }))
    .filter((item) => costs[item.index] !== null)
    .sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (let i = 0; i < order.length && i < left; i += 1) tenths[order[i].index] += 1;
  return costs.map((value, index) => (value === null ? null : tenths[index] / 10));
}

/** Sort rows for the share table. Rows without a value stay at the bottom in
 *  both directions — an unreadable number is not the smallest number. */
export function sortModelCost(rows: ModelCostRow[], key: ModelCostSort, dir: SortDir): ModelCostRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === 'model') return a.model.localeCompare(b.model) * sign;
    const left = key === 'cost' ? a.costUsd : a.runs;
    const right = key === 'cost' ? b.costUsd : b.runs;
    if (left === null && right === null) return a.model.localeCompare(b.model);
    if (left === null) return 1;
    if (right === null) return -1;
    if (left === right) return a.model.localeCompare(b.model) * sign;
    return (left - right) * sign;
  });
}

export function parseSortKey(raw: string | null): ModelCostSort {
  return raw === 'runs' || raw === 'model' ? raw : 'cost';
}

export function parseSortDir(raw: string | null, key: ModelCostSort): SortDir {
  if (raw === 'asc' || raw === 'desc') return raw;
  return key === 'model' ? 'asc' : 'desc';
}

// ---- METAQ: URL compatibility matrix ---------------------------------------

/** Canonical keys the page reads; everything else in the address is left alone. */
export const METRICS_QUERY_KEYS = ['window', 'view', 'groupBy', 'dsort', 'ddir', 'sort', 'dir', 'heat'] as const;

export interface MetricsQueryAnyway {
  query: string;
  ignored: string[];
  changed: boolean;
}

const MODES = ['employee', 'model'] as const;
const DETAIL_SORTS = ['runs', 'cost', 'share'] as const;
const SHARE_SORTS = ['runs', 'cost', 'model'] as const;
const DIRECTIONS = ['asc', 'desc'] as const;

const oneOf = (value: string | null, allowed: readonly string[]): value is string =>
  value !== null && allowed.includes(value);

/**
 * Read every known key, fold the legacy aliases into their canonical spelling
 * and hand back the address the page wants plus the values it had to ignore.
 * Unknown keys are never touched: only the metrics keys are ours.
 */
export function normalizeMetricsQuery(search: string): MetricsQueryAnyway {
  const source = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const out = new URLSearchParams(source);
  const ignored: string[] = [];

  const drop = (key: string, raw: string): void => {
    out.delete(key);
    ignored.push(`${key}=${raw}`);
  };

  const windowRaw = source.get('window');
  if (windowRaw !== null && !WINDOW_PRESETS.some((preset) => preset.id === windowRaw)) drop('window', windowRaw);

  // `w` is the pre-metAA spelling of the heat window; `heat` wins when both are there.
  const heatValid = (value: string | null): value is string =>
    value !== null && WINDOWS.some((window) => String(window.weeks) === value);
  const heatRaw = source.get('heat');
  const legacyRaw = source.get('w');
  let heatValue: string | null = null;
  if (heatValid(heatRaw)) heatValue = heatRaw;
  else if (heatRaw !== null) drop('heat', heatRaw);
  if (heatValid(legacyRaw)) {
    out.delete('w');
    if (heatValue === null) heatValue = legacyRaw;
  } else if (legacyRaw !== null) {
    drop('w', legacyRaw);
  }
  if (heatValue !== null) out.set('heat', heatValue);

  const viewRaw = source.get('view');
  if (viewRaw !== null && !oneOf(viewRaw, MODES)) drop('view', viewRaw);
  const groupRaw = source.get('groupBy');
  if (groupRaw !== null && !oneOf(groupRaw, MODES)) drop('groupBy', groupRaw);

  // `groupBy` is the older spelling of the detail axis, so a link that names it
  // alone also drives the detail table. The reverse stays one-way on purpose:
  // the detail view and the share grouping are separate choices on this page
  // (metS), and filling groupBy from view would silently move the share table.
  const viewOk = oneOf(out.get('view'), MODES);
  const groupOk = oneOf(out.get('groupBy'), MODES);
  if (groupOk && !viewOk) out.set('view', out.get('groupBy') as string);

  const dsortRaw = source.get('dsort');
  if (dsortRaw !== null && !oneOf(dsortRaw, DETAIL_SORTS)) drop('dsort', dsortRaw);
  const ddirRaw = source.get('ddir');
  if (ddirRaw !== null && !oneOf(ddirRaw, DIRECTIONS)) drop('ddir', ddirRaw);
  const sortRaw = source.get('sort');
  if (sortRaw !== null && !oneOf(sortRaw, SHARE_SORTS)) drop('sort', sortRaw);
  const dirRaw = source.get('dir');
  if (dirRaw !== null && !oneOf(dirRaw, DIRECTIONS)) drop('dir', dirRaw);

  return {
    query: out.toString(),
    ignored,
    changed: out.toString() !== source.toString(),
  };
}

/** One line above the page when the address carried values the page could not use. */
export function ignoredParamsNote(ignored: string[]): string | null {
  if (ignored.length === 0) return null;
  return `已忽略无效参数 ${ignored.length} 个`;
}

// ---- METP: detail table sorting --------------------------------------------

export type DetailSort = 'runs' | 'cost' | 'share';

export function parseDetailSort(raw: string | null): DetailSort | null {
  return raw === 'runs' || raw === 'cost' || raw === 'share' ? raw : null;
}

/**
 * Order the detail rows the same way the table shows them, so the CSV export
 * can never disagree with the screen. A missing value is not a zero: it sinks
 * to the bottom in both directions, while a real 0 sorts like any other number.
 * Equal values keep their upstream order (stable by original index).
 */
export function sortDetailLines<T extends { count: number | null; costUsd: number | null; share: number | null }>(
  lines: T[],
  sort: DetailSort,
  dir: SortDir,
): T[] {
  const valueOf = (line: T): number | null => (sort === 'runs' ? line.count : sort === 'cost' ? line.costUsd : line.share);
  return lines
    .map((line, index) => ({ line, index, value: valueOf(line) }))
    .sort((a, b) => {
      if (a.value === null && b.value === null) return a.index - b.index;
      if (a.value === null) return 1;
      if (b.value === null) return -1;
      if (a.value !== b.value) return dir === 'asc' ? a.value - b.value : b.value - a.value;
      return a.index - b.index;
    })
    .map((entry) => entry.line);
}

// ---- MET6: period-over-period delta and CSV export --------------------------

/** Equal-length window immediately before [now-span, now). */
export function previousRange(now: Date, id: UsageWindowId): { from: string; to: string } {
  const preset = usageWindowOf(id);
  const span = preset.hours * 3_600_000;
  return {
    from: new Date(now.getTime() - 2 * span).toISOString(),
    to: new Date(now.getTime() - span).toISOString(),
  };
}

export type DeltaValue = { kind: 'value'; value: number } | { kind: 'none'; reason: string };

/** Difference, or an explicit "no comparison" — never a filled-in zero. */
export function deltaOf(current: number | null, previous: number | null, unit: 'runs' | 'usd'): DeltaValue {
  if (current === null || previous === null) {
    return { kind: 'none', reason: unit === 'runs' ? '上一周期没有可比的运行数' : '上一周期没有可比的账本金额' };
  }
  return { kind: 'value', value: current - previous };
}

/** `+3` / `-2` / `±0`; a missing comparison is «—». */
export function formatDeltaCount(delta: DeltaValue): string {
  if (delta.kind === 'none') return '—';
  if (delta.value === 0) return '±0';
  return `${delta.value > 0 ? '+' : '-'}${Math.abs(delta.value)}`;
}

/** `+$0.12` / `-$0.03` / `±$0.00`; a missing comparison is «—». */
export function formatDeltaUsd(delta: DeltaValue): string {
  if (delta.kind === 'none') return '—';
  if (delta.value === 0) return '±$0.00';
  return `${delta.value > 0 ? '+' : '-'}${formatUsd(Math.abs(delta.value))}`;
}

/** One CSV cell; a missing value is empty, never 0. */
export function csvCell(value: string | number | null): string {
  if (value === null) return '';
  const raw = String(value);
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

export function toCsv(header: string[], rows: (string | number | null)[][]): string {
  return [header.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\r\n');
}

/** A block this file could not carry, with the sentence the page shows for it. */
export interface ExportGap {
  label: string;
  reason: string;
}

/**
 * One trailing note naming what the file is missing. A file with nothing
 * missing gets no note at all, so its shape stays exactly as before.
 */
export function exportGapNote(gaps: ExportGap[]): string | null {
  if (gaps.length === 0) return null;
  const parts = gaps.map((gap) => `${gap.label}（${gap.reason}）`).join('；');
  return `# 本次导出缺少 ${gaps.length} 块：${parts}`;
}

/** The note rides in its own row; RFC 4180 escaping still applies. */
/**
 * Append the totals comment line after the data rows. It is written raw, never
 * as a CSV cell, so a value holding a comma can never turn it into a data row —
 * and it still reads as a comment to anyone parsing the file.
 */
export function withTotalsNote(body: string, totalLine: string): string {
  return `${body}\r\n# ${totalLine}`;
}

export function withGapNote(body: string, gaps: ExportGap[]): string {
  const note = exportGapNote(gaps);
  return note === null ? body : `${body}\r\n${csvCell(note)}`;
}

/** `metrics-employee-7d-20261120-0931.csv` in Beijing time. */
/** File names carry only lowercase ASCII: a dot, a dash and digits, nothing else. */
function fileToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function beijingFileStamp(now: Date): string {
  return formatBeijing(now.toISOString(), now).replace(/[-:]/g, '').replace(' ', '-');
}

/**
 * metrics-detail-<window>-<group>-<sort>-<dir>-<YYYYMMDD-HHmm>.csv
 * The sort pair is always present; an untouched table writes `cost-desc`.
 */
export function csvFileStem(
  view: 'employee' | 'model',
  window: UsageWindowId,
  sort: DetailSort,
  dir: SortDir,
): string {
  return ['metrics', 'detail', window, view, sort, dir].map(fileToken).join('-');
}

export function csvFileName(
  view: 'employee' | 'model',
  window: UsageWindowId,
  sort: DetailSort,
  dir: SortDir,
  now: Date,
): string {
  return `${csvFileStem(view, window, sort, dir)}-${beijingFileStamp(now)}.csv`;
}

/**
 * A raw ISO-8601 stamp and nothing else. Exported files carry the collection
 * time only when the upstream answered with one; a missing or free-form value
 * stays an empty cell — the local clock is never a stand-in.
 */
export function isoOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(raw)) return null;
  return Number.isNaN(Date.parse(raw)) ? null : raw;
}

/**
 * The names an envelope may carry its collection time under, in priority
 * order. The list itself lives in `./asof` so the runs page reads it too;
 * this alias stays for existing call sites and tests.
 */
export const TOP_ASOF_KEYS = ASOF_KEYS;

/**
 * The top-level collection time of one payload, under any of its accepted
 * names. Delegates to the shared reader: only a full ISO instant qualifies, a
 * free-form or missing value is null, never the local clock.
 */
export function readTopAsOf(payload: unknown): string | null {
  return readAsOf(payload).asOf;
}

// ---- MET-A: export the current cost-share view ------------------------------

export type ShareCsvRow = {
  /** The row's model name or employee name — the on-screen first column. */
  name: string;
  runs: number | null;
  costUsd: number | null;
  sharePct: number | null;
  /** Raw upstream collection time; null when the answer carried none. */
  asOf?: string | null;
  /** The statistics window this row was aggregated over (`24h` / `7d` / `30d`). */
  window?: string | null;
};

/** Fixed English keys, one per data column on screen, plus provenance. */
export const SHARE_CSV_HEADER = ['group', 'runs', 'cost_usd', 'share_pct', 'as_of', 'window'];

/** Missing stays an empty cell, a real zero stays `0.00`, shares keep one decimal. */
export function shareCsvRows(rows: ShareCsvRow[]): (string | number | null)[][] {
  return rows.map((row) => [
    row.name,
    row.runs,
    usdDigits(row.costUsd),
    digitsPct(row.sharePct),
    isoOrNull(row.asOf),
    row.window ?? null,
  ]);
}

export function shareCsv(rows: ShareCsvRow[]): string {
  return toCsv(SHARE_CSV_HEADER, shareCsvRows(rows));
}

/** `metrics-24h-model-20261120-0655.csv` in Beijing time. */
/**
 * metrics-share-<window>-<group>-<sort>-<dir>-<YYYYMMDD-HHmm>.csv
 * Same shape as the detail file, so the two can never collide.
 */
export function shareCsvStem(
  group: 'model' | 'employee',
  window: UsageWindowId,
  sort: 'model' | 'cost' | 'runs',
  dir: SortDir,
): string {
  return ['metrics', 'share', window, group, sort, dir].map(fileToken).join('-');
}

export function shareCsvFileName(
  group: 'model' | 'employee',
  window: UsageWindowId,
  sort: 'model' | 'cost' | 'runs',
  dir: SortDir,
  now: Date,
): string {
  return `${shareCsvStem(group, window, sort, dir)}-${beijingFileStamp(now)}.csv`;
}


// ---- MET6: budget vs actual -------------------------------------------------

export type BudgetStatus = 'ok' | 'warn' | 'over';

export interface BudgetLine {
  key: string;
  subject: string;
  budget: number | null;
  used: number | null;
  remaining: number | null;
  usagePct: number | null;
  /** Which side of the cap the ledger landed on; null when there is no cap. */
  variance: 'surplus' | 'deficit' | 'even' | null;
  status: BudgetStatus | null;
  asOf: string | null;
  /** Why a cell is «—»; shown only as a title. */
  gap: string | null;
}

/** Thresholds, one place: ≥100% over, ≥80% close, below that normal. */
export const BUDGET_THRESHOLDS = '使用率 ≥100% 记「超支」，≥80% 记「接近」，其余记「正常」；按账本实扣÷账本上限计算。';

/**
 * Budget vs actual for one ledger row. The used amount is the ledger's own
 * number; the cap only exists when the row carries one — otherwise every
 * cap-derived cell is «—» with its reason, never 0 and never inferred.
 */
export function budgetLines(rows: LedgerRow[], names: Record<string, string>): BudgetLine[] {
  return rows.map((row, index) => {
    const budget = row.limitUsd;
    const used = row.costUsd;
    const remaining = budget !== null && used !== null ? budget - used : null;
    const usagePct = budget !== null && budget > 0 && used !== null ? Math.round((used / budget) * 1000) / 10 : null;
    const status = budget === null ? null : usageTone(usagePct);
    const variance =
      remaining === null ? null : remaining > 0 ? 'surplus' : remaining < 0 ? 'deficit' : 'even';
    return {
      key: `budget-${row.employeeId ?? index}-${index}`,
      subject: employeeLabel(row.employeeId ? names[row.employeeId] ?? null : null, row.employeeId),
      budget,
      used,
      remaining,
      usagePct,
      variance,
      status,
      asOf: row.updatedAt,
      gap: budget === null ? '账本没有给出预算上限，所以预算、剩余、使用率与超支结余都无法计算' : null,
    };
  });
}

export type UsageTone = 'ok' | 'warn' | 'over';

/** ≥100% over, ≥80% warn, otherwise ok; null stays uncoloured. */
export function usageTone(pct: number | null): UsageTone | null {
  if (pct === null || !Number.isFinite(pct)) return null;
  if (pct >= 100) return 'over';
  if (pct >= 80) return 'warn';
  return 'ok';
}

// ---- MET6: 7×24 activity grid from run-stats --------------------------------

export interface StatHeatCell {
  dow: Weekday;
  hour: number;
  runs: number | null;
  /** Bucket start (ISO) when the endpoint returned this hour. */
  at: string | null;
  present: boolean;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface StatHeatGrid {
  rows: { dow: Weekday; label: string; cells: StatHeatCell[] }[];
  presentCells: number;
  total: number | null;
  max: number | null;
}

/**
 * Fold hourly run buckets into a Beijing 7×24 grid. A bucket the endpoint
 * returned with `runs: 0` is a real idle hour; an hour it never returned stays
 * missing («—») and is never painted as zero.
 */
export function heatFromStats(stats: RunStats): StatHeatGrid {
  const seen = new Map<string, { runs: number; at: string }>();
  for (const bucket of stats.buckets) {
    if (!bucket.bucketStart || bucket.runs === null) continue;
    const date = new Date(bucket.bucketStart);
    if (Number.isNaN(date.getTime())) continue;
    const parts = beijingParts(date);
    const hour = Number(
      new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', hourCycle: 'h23' }).format(date),
    );
    if (!Number.isFinite(hour)) continue;
    seen.set(`${parts.dow}-${hour}`, { runs: bucket.runs, at: bucket.bucketStart });
  }
  const values = [...seen.values()].map((entry) => entry.runs).filter((value) => value > 0);
  const max = values.length > 0 ? Math.max(...values) : null;
  const rows = ([1, 2, 3, 4, 5, 6, 7] as const).map((dow) => ({
    dow,
    label: WEEKDAY_LABELS[dow - 1],
    cells: Array.from({ length: 24 }, (_, hour) => {
      const key = `${dow}-${hour}`;
      const found = seen.get(key);
      const present = found !== undefined;
      const runs = found ? found.runs : null;
      return { dow, hour, runs, at: found ? found.at : null, present, level: levelOf(runs, max) };
    }),
  }));
  const flat = rows.flatMap((row) => row.cells).filter((cell) => cell.present);
  return {
    rows,
    presentCells: flat.length,
    total: flat.length > 0 ? flat.reduce((sum, cell) => sum + (cell.runs ?? 0), 0) : null,
    max,
  };
}

// ---------------------------------------------------------------------------
// metB — data sources and freshness.
//
// Only an ISO-8601 `asOf` returned by the upstream may be shown as a
// collection time. Anything else (missing, local clock, human text) renders as
// "—"; the page never substitutes its own clock. No extra request is issued
// for this block: stamps are recorded by the same calls the cards already make.
// ---------------------------------------------------------------------------
export type SourceKey =
  | 'run-activity'
  | 'run-stats'
  | 'employees'
  | 'budget-usage'
  | 'pricing'
  | 'hermes-usage';

export type SourceDescriptor = { key: SourceKey; label: string; path: string };

/** One row of the page's caliber notes: what each read means and how it fails. */
export type CaliberNote = {
  key: SourceKey;
  label: string;
  path: string;
  scope: string;
  missing: string;
};

/**
 * The written caliber under the page. It restates what the cards, the freshness
 * block and the two CSV exports already do; it is static text, not a new read.
 */
/** The one sentence a caliber note reads as, shared by the foot block and the
 *  screen-reader copies the cards point at — the two must stay verbatim equal. */
export function caliberNoteText(note: CaliberNote): string {
  return `${note.label}。${note.path}。计算范围：${note.scope}。缺值策略：${note.missing}。`;
}

export const CALIBER_NOTES: CaliberNote[] = [
  {
    key: 'run-activity',
    label: '运行活动热力',
    path: '/api/run-activity',
    scope: '按整周汇总，周数由热力窗口决定；不提供单独的 24 小时切分。',
    missing: '接口没返回的格子记「—」，不补 0；接口返回的 0 就是这一小时真的没跑。',
  },
  {
    key: 'run-stats',
    label: '运行统计',
    path: '/api/run-stats',
    scope: '按所选时间窗（最近 24 小时 / 7 天 / 30 天）与上一周期同长对比。',
    missing: '缺的字段记「—」；真实的 0 记 0，不拿上一周期顶替。',
  },
  {
    key: 'employees',
    label: '员工目录',
    path: '/api/employees',
    scope: '目录全量（一次最多 200 条），只用于把员工编号换成人名与岗位。',
    missing: '目录里没有的编号显示「员工 · 短码」，不显示裸编号。',
  },
  {
    key: 'budget-usage',
    label: '平台扣费账本',
    path: '/api/budget-usage',
    scope: '按日或按月账本行，在所选时间窗内逐日累加。',
    missing: '账本没记的金额记「—」，真 0 记 $0.00；金额只取账本实扣，不用单价乘用量反推。',
  },
  {
    key: 'pricing',
    label: '模型价目表',
    path: '/api/models/pricing',
    scope: '价目表快照；单价是标价，不代表实际扣费。',
    missing: '没有单价记「—」，也不拿扣费反推单价。',
  },
  {
    key: 'hermes-usage',
    label: 'Hermes 用量',
    path: '/api/hermes-usage',
    scope: '按模型用量，天数跟随所选时间窗。',
    missing: '没给次数记「—」，不补 0；占比按可读到的部分归一。',
  },
];

export const SOURCE_CATALOG: SourceDescriptor[] = [
  { key: 'run-activity', label: '运行活动热力', path: '/api/run-activity' },
  { key: 'run-stats', label: '运行统计', path: '/api/run-stats' },
  { key: 'employees', label: '员工目录', path: '/api/employees' },
  { key: 'budget-usage', label: '平台扣费账本', path: '/api/budget-usage' },
  { key: 'pricing', label: '模型价目表', path: '/api/models/pricing' },
  { key: 'hermes-usage', label: 'Hermes 用量', path: '/api/hermes-usage' },
];

export type SourceStamp = {
  asOf: string | null;
  asOfSource: string | null;
  /** When this client finished the read that produced `asOf`; never the data clock. */
  fetchedAt: string | null;
  error: string | null;
  gap: string | null;
  requestId: string | null;
};

export const EMPTY_SOURCE_STAMP: SourceStamp = {
  asOf: null,
  asOfSource: null,
  fetchedAt: null,
  error: null,
  gap: null,
  requestId: null,
};

const ISO_STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/** A stamp counts only when it is a full ISO-8601 instant with a zone. */
export function isIsoStamp(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_STAMP.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

/** Read the BFF envelope's top-level `asOf` / `asOfSource`, inventing nothing. */
export function readSourceStamp(payload: unknown): { asOf: string | null; asOfSource: string | null } {
  if (!isRecord(payload)) return { asOf: null, asOfSource: null };
  return {
    asOf: readTopAsOf(payload),
    asOfSource: text(payload.asOfSource),
  };
}

export function sourceKeyOfPath(path: string): SourceKey | null {
  if (path.includes('/api/run-activity')) return 'run-activity';
  if (path.includes('/api/run-stats')) return 'run-stats';
  if (path.includes('/api/employees')) return 'employees';
  if (path.includes('/api/budget-usage')) return 'budget-usage';
  if (path.includes('/api/models/pricing')) return 'pricing';
  if (path.includes('/api/hermes-usage')) return 'hermes-usage';
  return null;
}

/**
 * Fold a response into the recorded stamp. A newer `asOf` wins; a response
 * without one keeps whatever was recorded before. A successful read clears the
 * failure state, so the block reflects the last attempt, not a stale error.
 */
export function mergeSourceStamp(
  prev: SourceStamp | undefined,
  next: { asOf: string | null; asOfSource: string | null; fetchedAt?: string | null },
): SourceStamp {
  const base = prev ?? EMPTY_SOURCE_STAMP;
  let asOf = base.asOf;
  let asOfSource = base.asOfSource;
  let fetchedAt = base.fetchedAt;
  if (next.asOf) {
    const nextMs = Date.parse(next.asOf);
    const baseMs = base.asOf ? Date.parse(base.asOf) : Number.NEGATIVE_INFINITY;
    if (!Number.isFinite(baseMs) || nextMs >= baseMs) {
      asOf = next.asOf;
      asOfSource = next.asOfSource ?? base.asOfSource;
      // The read time belongs to the read whose collection time we are showing.
      fetchedAt = next.fetchedAt ?? fetchedAt;
    }
  } else if (!base.asOf) {
    fetchedAt = next.fetchedAt ?? fetchedAt;
  }
  return { asOf, asOfSource, fetchedAt, error: null, gap: null, requestId: null };
}

export type SourceRow = SourceDescriptor & {
  asOf: string | null;
  asOfSource: string | null;
  fetchedAt: string | null;
  state: 'ok' | 'degraded' | 'down';
  error: string | null;
  gap: string | null;
  requestId: string | null;
};

/**
 * Three words, no fourth: a source that answered with a collection time is
 * `ok`; one that answered without one is `degraded` (the payload is usable but
 * we cannot say how fresh it is); one that failed to answer is `down`.
 */
/** One line per read, in the order the freshness table shows them. */
const SOURCE_STATE_WORD: Record<SourceRow['state'], string> = {
  ok: '正常',
  degraded: '降级',
  down: '读不到',
};

export function sourceSummaryText(rows: SourceRow[]): string {
  return rows
    .map(
      (row) =>
        `${row.label} · ${row.path} · ${row.asOf === null ? '—' : formatBeijing(row.asOf)} · ${SOURCE_STATE_WORD[row.state]}`,
    )
    .join('\n');
}

export function sourceRows(stamps: Record<string, SourceStamp>): SourceRow[] {
  return SOURCE_CATALOG.map((descriptor) => {
    const stamp = stamps[descriptor.key] ?? EMPTY_SOURCE_STAMP;
    const state: SourceRow['state'] = stamp.error ? 'down' : stamp.asOf ? 'ok' : 'degraded';
    return {
      ...descriptor,
      asOf: stamp.asOf,
      asOfSource: stamp.asOfSource,
      fetchedAt: stamp.fetchedAt,
      state,
      error: stamp.error,
      gap: stamp.gap,
      requestId: stamp.requestId,
    };
  });
}

/** A source whose collection time trails the read by more than this is called stale. */
export const SOURCE_STALE_MS = 15 * 60 * 1000;

/**
 * Compare the upstream collection time with the moment this client finished
 * reading. Only a real ISO pair can be stale: a source without a collection
 * time is never called fresh *or* stale, and the local clock never stands in
 * for a missing upstream stamp.
 */
export function sourceStaleness(
  row: Pick<SourceRow, 'asOf' | 'fetchedAt'>,
  thresholdMs = SOURCE_STALE_MS,
): { stale: boolean; ageMs: number | null } {
  if (!isIsoStamp(row.asOf) || !isIsoStamp(row.fetchedAt)) return { stale: false, ageMs: null };
  const asOfMs = Date.parse(row.asOf);
  const readMs = Date.parse(row.fetchedAt);
  if (!Number.isFinite(asOfMs) || !Number.isFinite(readMs)) return { stale: false, ageMs: null };
  const ageMs = readMs - asOfMs;
  return { stale: ageMs > thresholdMs, ageMs };
}

/** The newest upstream collection time across the sources, for the summary line. */
export function latestSourceAsOf(rows: SourceRow[]): string | null {
  let best: string | null = null;
  let bestMs = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    if (!row.asOf) continue;
    const ms = Date.parse(row.asOf);
    if (Number.isFinite(ms) && ms > bestMs) {
      bestMs = ms;
      best = row.asOf;
    }
  }
  return best;
}

// ---- METK: non-visual equivalents for the heat grid and the trend chart ----

export interface HeatDayRow {
  dow: Weekday;
  label: string;
  runs: number | null;
}

/** Sum each weekday across returned cells; a weekday with no returned cell stays null, never 0. */
export function heatDayRows(grid: HeatGrid): HeatDayRow[] {
  return grid.rows.map((row) => {
    const present = row.cells.filter((cell) => cell.present);
    return {
      dow: row.dow,
      label: row.label,
      runs: present.length === 0 ? null : present.reduce((sum, cell) => sum + (cell.count ?? 0), 0),
    };
  });
}

/** One sentence an assistive reader can announce for the whole heat grid. */
export type HeatSummaryParts = {
  total: number | null;
  peakLabel: string | null;
  peakRuns: number | null;
  lowLabel: string | null;
  lowRuns: number | null;
  coveredDays: number;
  spanDays: number;
};

/**
 * The one derivation behind both the on-screen heat summary and its copied
 * text, so the two can never quote different numbers.
 */
export function heatSummaryParts(grid: HeatGrid): HeatSummaryParts {
  const days = heatDayRows(grid).filter((day): day is HeatDayRow & { runs: number } => day.runs !== null);
  if (grid.total === null || days.length === 0) {
    return { total: null, peakLabel: null, peakRuns: null, lowLabel: null, lowRuns: null, coveredDays: 0, spanDays: 7 };
  }
  let high = days[0];
  let low = days[0];
  for (const day of days) {
    if (day.runs > high.runs) high = day;
    if (day.runs < low.runs) low = day;
  }
  return {
    total: grid.total,
    peakLabel: high.label,
    peakRuns: high.runs,
    lowLabel: low.label,
    lowRuns: low.runs,
    coveredDays: days.length,
    spanDays: 7,
  };
}

export function heatGridSummary(grid: HeatGrid): string {
  const parts = heatSummaryParts(grid);
  if (parts.total === null || parts.coveredDays === 0) {
    return '运行热力：接口没有返回可用的格子，没有总数可报，也不按 0 补。';
  }
  return `运行热力：总运行 ${parts.total} 次；最高 ${parts.peakLabel} ${parts.peakRuns} 次；最低 ${parts.lowLabel} ${parts.lowRuns} 次；覆盖 ${parts.coveredDays} / ${parts.spanDays} 天。`;
}

export type HeatCopyInput = {
  weeks: number;
  windowLabel: string;
  /** The range the activity endpoint reported; null when the read failed. */
  rangeLabel: string | null;
  parts: HeatSummaryParts;
};

/** The plain-text heat summary that `metZ-copy-heat` puts on the clipboard. */
export function heatCopyText(input: HeatCopyInput): string {
  const { parts } = input;
  const missing = parts.total === null || parts.coveredDays === 0;
  const range = input.rangeLabel;
  return [
    '热力摘要',
    `窗口：${input.windowLabel}（${input.weeks}w）`,
    `日期区间：${range && range.length > 0 ? range : '—'}`,
    `总运行：${missing ? '—' : parts.total}`,
    `最高：${missing ? '—' : `${parts.peakLabel} ${parts.peakRuns} 次`}`,
    `最低：${missing ? '—' : `${parts.lowLabel} ${parts.lowRuns} 次`}`,
    `覆盖：${missing ? '—' : `${parts.coveredDays} / ${parts.spanDays} 天`}`,
    ...(missing ? ['说明：这次没有可用的热力格子，以上几项不可比较，不按 0 记。'] : []),
  ].join('\n');
}

/** Date + count + strength band — the same facts the colour carries. */
export function heatCellLabel(
  cell: { dow: Weekday; hour: number; count: number | null; present: boolean; level: number },
  weeks: number,
  to: string | null,
): string {
  const range = cellRangeLabel(cell.dow, cell.hour, weeks, to);
  if (!cell.present) return `${range} · 无数据`;
  return `${range} · 运行 ${cell.count ?? 0} 次 · 强度 ${cell.level} 档（共 4 档）`;
}

export interface SparkSummary {
  observed: number;
  first: number | null;
  last: number | null;
  peak: number | null;
  low: number | null;
}

/** First/last/peak/low over returned slots; missing slots never become 0. */
export function sparkSummary(spark: SparkGrid): SparkSummary {
  const values = spark.slots.map((slot) => slot.runs).filter((runs): runs is number => runs !== null);
  if (values.length === 0) return { observed: 0, first: null, last: null, peak: null, low: null };
  return {
    observed: values.length,
    first: values[0],
    last: values[values.length - 1],
    peak: Math.max(...values),
    low: Math.min(...values),
  };
}

export function sparkSummaryText(spark: SparkGrid, windowLabel: string): string {
  const summary = sparkSummary(spark);
  if (summary.observed === 0) {
    return `${windowLabel}趋势：没有可用的运行记录，不补 0，也不画柱子。`;
  }
  return `${windowLabel}趋势：共 ${summary.observed} 个时段有记录；首值 ${summary.first} 次；末值 ${summary.last} 次；峰值 ${summary.peak} 次；最低 ${summary.low} 次。没有返回的时段不计入。`;
}

// ---- metL: the current view as plain text ---------------------------------
// The summary repeats the numbers this page already rendered from the batch of
// reads it holds. It never fetches, never recomputes money from price × usage,
// and never prints an internal id. A real 0 stays `$0.00` / `0`; a missing
// number stays `—`.

export type MetricsSummaryInput = {
  windowId: string;
  windowLabel: string;
  runs: number | null;
  costUsd: number | null;
  groupBy: 'model' | 'employee';
  /** Top-level asOf of the batch that produced the numbers above; null when absent. */
  asOf: string | null;
  /** When the user asked for the copy, as an ISO stamp. */
  generatedAt: string;
  /** The totals line, already rendered by the page from the same sums the table footer shows. */
  totalLine?: string | null;
};

export function metricsSummaryText(input: MetricsSummaryInput): string {
  const asOf = isoOrNull(input.asOf);
  return [
    '运行分析摘要',
    `窗口：${input.windowLabel}（${input.windowId}）`,
    `运行数：${formatCount(input.runs)}`,
    `实扣金额：${formatUsd(input.costUsd)}`,
    ...(input.totalLine === undefined ? [] : [input.totalLine ?? '合计：该窗口无可渲染行']),
    `占比口径：成本分摊按${input.groupBy === 'employee' ? '员工' : '模型'}分组的账本实扣计算，占比合计 100%，保留一位小数`,
    `采集时刻：${asOf ? formatBeijing(asOf) : '—'}`,
    `生成时刻：${formatBeijing(input.generatedAt)}（北京时间）`,
  ].join('\n');
}

// metAP — one sentence for «how many runs», naming where each face comes from and
// why the faces need not agree. Everything is derived from the batch already on
// screen; nothing here issues a read.
export type RunsCaliberInput = {
  heat: number | null;
  heatRange: string;
  detail: number | null;
  detailRange: string;
  detailSource: string;
  delta: number | null;
};

export function runsCaliberLine(input: RunsCaliberInput): string {
  const face = (value: number | null): string => (value === null ? '—' : String(value));
  const bothKnown = input.heat !== null && input.detail !== null;
  const tail = bothKnown
    ? input.heat === input.detail
      ? '｜热力与明细一致；运行页未核对，见 title'
      : '｜口径不同，见 title'
    : '｜有面缺数，见 title';
  return `运行数口径：热力 ${face(input.heat)} · 明细 ${face(input.detail)} · 运行页 —${tail}`;
}

export function runsCaliberTitle(input: RunsCaliberInput): string {
  const parts = [
    `热力：来源 /api/run-activity，按 ${input.heatRange} 的整周窗口汇总接口返回的格子（含未成功的运行）；没返回的格子不计入，也不按 0 记。`,
    `明细：来源 ${input.detailSource}，按 ${input.detailRange} 分组求和${
      input.detail === null ? '；这一面没有可求和的值' : ''
    }。`,
    '运行页：来源 /api/runs?since=…&limit=…，按时间窗分页列出且每页有上限；那里的条数是「这一页列出的行」，不等于窗口总数。',
    '这一页不另发运行列表读取，所以运行页一栏固定写「—」；要核对请打开运行页，按同一时间窗对照。',
    input.delta === null
      ? '热力和明细没有同时读到数，算不出差，也不按 0 记。'
      : `热力与明细差 ${input.delta}（热力减明细）：两处的筛选与聚合不同，属口径差，不是数据错误。`,
  ];
  return parts.join(' ');
}


// ---------------------------------------------------------------------------
// metAS — three cost faces side by side: today's budget ledger, this month's
// budget ledger, and the model aggregate from usage. Every value is taken from
// the batch already on screen; nothing here issues a read of its own. A face
// that was not read is «—», never 0.
// ---------------------------------------------------------------------------

export type CostFaceKey = 'day' | 'month' | 'usage';

export interface CostFace {
  key: CostFaceKey;
  label: string;
  value: number | null;
  source: string;
}

export interface CostCaliberInput {
  day: number | null;
  month: number | null;
  usage: number | null;
  /** Why the usage face is missing, when it is. */
  usageMissing: string | null;
}

export interface CostCaliberPair {
  label: string;
  diff: number;
}

export interface CostCaliber {
  faces: CostFace[];
  /** How many of the three faces carry a number. */
  known: number;
  verdict: string;
  pairs: CostCaliberPair[];
  /** The pair with the largest absolute gap, when any pair is computable. */
  widest: string | null;
  title: string;
}

const COST_FACE_META: Record<CostFaceKey, { label: string; source: string }> = {
  day: { label: '日累计', source: '预算账本 /api/budget-usage?periodKind=day，按条求和的记账金额' },
  month: { label: '月累计', source: '预算账本 /api/budget-usage?periodKind=month，按条求和的记账金额' },
  usage: { label: '模型聚合', source: '用量 /api/hermes-usage 各模型 cost_usd 求和，属用量推算' },
};

export function costCaliber(input: CostCaliberInput): CostCaliber {
  const faces: CostFace[] = (['day', 'month', 'usage'] as CostFaceKey[]).map((key) => ({
    key,
    label: COST_FACE_META[key].label,
    value: input[key],
    source: COST_FACE_META[key].source,
  }));
  const known = faces.filter((face) => face.value !== null).length;

  const pairs: CostCaliberPair[] = [];
  for (const [a, b] of [
    ['day', 'month'],
    ['day', 'usage'],
    ['month', 'usage'],
  ] as [CostFaceKey, CostFaceKey][]) {
    const left = input[a];
    const right = input[b];
    if (left === null || right === null) continue;
    const diff = Math.round((left - right) * 100) / 100;
    pairs.push({ label: `${COST_FACE_META[a].label}−${COST_FACE_META[b].label}`, diff });
  }

  const widestPair =
    pairs.length > 0
      ? pairs.reduce((best, pair) => (Math.abs(pair.diff) > Math.abs(best.diff) ? pair : best))
      : null;

  const allEqual = known === 3 && pairs.every((pair) => pair.diff === 0);
  const verdict =
    known < 3 ? `有面缺数（${known}/3）` : allEqual ? '三面一致' : '口径不同，见逐对差值';

  const titleParts = [
    `日累计来自${COST_FACE_META.day.source}`,
    `月累计来自${COST_FACE_META.month.source}`,
    `模型聚合来自${COST_FACE_META.usage.source}`,
    '记账与用量推算不是同一套账，数值不等属口径差，不是数据错误；三面都取自这一次读取，不发新请求。',
  ];
  for (const pair of pairs) {
    titleParts.push(`${pair.label} ${pair.diff === 0 ? '为 0' : `差 ${pair.diff > 0 ? '+' : ''}${pair.diff.toFixed(2)} USD`}`);
  }
  if (widestPair && widestPair.diff !== 0) titleParts.push(`差值绝对值最大的是${widestPair.label}`);
  if (input.usageMissing) titleParts.push(`模型聚合为「—」：${input.usageMissing}`);

  return {
    faces,
    known,
    verdict,
    pairs,
    widest: widestPair ? widestPair.label : null,
    title: titleParts.join('；') + '。',
  };
}

// HEAT — one legend sentence and one gap note for the 7×24 card, read from the
// very grid the cells render. A cell the endpoint never returned stays missing:
// it is counted, never summed as 0, and never folded into the window total.
export const HEAT_LEGEND_TEXT =
  '格内颜色是该时段（星期几×小时）的运行次数；空白格=这一格没有数据，不计入合计。';

/** Null when the batch has no missing cell, so the page renders no sentence. */
export function heatGapNoteText(missing: number): string | null {
  if (!Number.isFinite(missing) || missing <= 0) return null;
  return `本窗有 ${missing} 格空缺，合计只加有数据的格。`;
}
