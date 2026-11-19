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