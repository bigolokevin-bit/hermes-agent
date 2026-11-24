/**
 * 近 7 天趋势腿 — `GET /agent-api/api/run-stats?from=&to=&bucket=day` 的读法。
 *
 * 骨架 console-v4-skeleton.html 2037–2081 的第一张卡（`近 7 天` · 副行
 * `运行 / 成本`）在现实现里没有对应物，本文件补它的取数与几何，全部纯函数：
 *
 *  - 日窗按**北京日历日**切：`from` = 起点日 00:00（北京），`to` = 终点日
 *    次日 00:00（北京）。两端都是整日边界 ⇒ URL 在当天之内恒定，且
 *    `to > from` 恒成立（同日会被服务判 422）。
 *  - 服务端只回**有事件的桶**：没有桶的日子保留槽位、记 `hasReading:false`，
 *    图上画浅灰断口，表里写「无读数」，绝不补 0（补 0 = 假线）。
 *  - 桶里 `runs` 缺失同样是 null（缺读数），与真实的 0（当天确实没跑）分开。
 *  - 「单次均值」是派生比值（当日运行侧成本 ÷ 当日运行数），两个真值都在
 *    才算；它不是金额源，屏幕上的钱仍只认成本账本。
 *
 * 从 /tmp/usage-wip 的 1273 行 WIP 中裁剪而来：只保留本页真正接线的函数
 * （月窗 / 今日窗 / totals 聚合腿已由 hermes-usage 承担，此处不再留死码）。
 */
import { BFF } from "./api";

const DAY_MS = 86_400_000;

export interface DaySlot {
  /** 北京日历日 `YYYY-MM-DD`。 */
  key: string;
  /** 屏上形制 `11-18`（骨架 x 轴与表头同形）。 */
  label: string;
}

export interface DayWindow {
  from: string;
  to: string;
  slots: DaySlot[];
  /** 屏上可读的窗名，如「近 7 天」。 */
  name: string;
}

const BEIJING_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 某 instant 的北京日历日 `YYYY-MM-DD`；不可读 → null（不猜）。 */
export function beijingDate(value: unknown): string | null {
  let ms: number | null = null;
  if (typeof value === "number") ms = value;
  else if (typeof value === "string") {
    const parsed = Date.parse(value);
    ms = Number.isNaN(parsed) ? null : parsed;
  }
  if (ms === null || !Number.isFinite(ms)) return null;
  const text = BEIJING_DAY.format(new Date(ms));
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

/** `YYYY-MM-DD` → `MM-DD`，骨架 x 轴与表头的形制。 */
export function dayLabel(key: string): string {
  const parts = key.split("-");
  return parts.length === 3 ? `${parts[1]}-${parts[2]}` : key;
}

/** 相对今天的北京日窗起点 instant（UTC ms）；`offsetDays` 可为负。 */
function beijingDayStart(nowMs: number, offsetDays: number): number {
  const key = beijingDate(nowMs + offsetDays * DAY_MS);
  if (key === null) return Number.NaN;
  return Date.parse(`${key}T00:00:00+08:00`);
}

/** 末尾对齐的北京日窗：`days` 个整日，最后一日是「今天」。 */
export function beijingDayWindow(days: number, now = new Date()): DayWindow {
  const startMs = beijingDayStart(now.getTime(), -(days - 1));
  const endMs = beijingDayStart(now.getTime(), 1);
  const slots: DaySlot[] = [];
  for (let i = 0; i < days; i += 1) {
    const key = beijingDate(startMs + i * DAY_MS);
    if (key !== null) slots.push({ key, label: dayLabel(key) });
  }
  return {
    from: new Date(startMs).toISOString(),
    to: new Date(endMs).toISOString(),
    slots,
    name: `近 ${days} 天`,
  };
}

/** 路由原文（只进 `title` 与折叠的「技术详情」，不上屏）。 */
export function runStatsUrl(window: DayWindow): string {
  return `${BFF}/run-stats?from=${encodeURIComponent(window.from)}&to=${encodeURIComponent(window.to)}&bucket=day`;
}

/* ------------------------------------------------------------------ *
 * 桶 → 日槽
 * ------------------------------------------------------------------ */

export interface TrendDay {
  key: string;
  label: string;
  /** null = 这一天没有读数（缺桶 / 字段缺失），不是 0。 */
  runs: number | null;
  /** 运行侧汇总成本（USD）；账本实扣仍只认「成本账本」卡。 */
  costUsd: number | null;
  /** 成本 ÷ 运行的派生比值；任一真值缺失即 null。 */
  avgCostUsd: number | null;
  estimatedRuns: number;
  /** 服务端给了这一天的桶。 */
  hasBucket: boolean;
  /** 桶里至少有一个可读量（runs 或 costUsd）。 */
  hasReading: boolean;
}

function finiteAtLeastZero(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function field(bucket: Record<string, unknown>, camel: string, snake: string): number | null {
  const raw = bucket[camel] ?? bucket[snake];
  return raw === undefined ? null : finiteAtLeastZero(raw);
}

/**
 * 把 run-stats 的桶落到期望的北京日槽上。槽位由调用方给（决定画几天）；
 * 落在窗外或读不出日期的桶不画、只计数。
 */
export function trendDays(body: unknown, slots: DaySlot[]): { days: TrendDay[]; offWindow: number } {
  const record = body !== null && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
  const raw = Array.isArray(record.buckets) ? record.buckets : [];
  const byKey = new Map<string, Record<string, unknown>>();
  let offWindow = 0;
  for (const item of raw) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      offWindow += 1;
      continue;
    }
    const bucket = item as Record<string, unknown>;
    const key = beijingDate(bucket.bucketStart ?? bucket.bucket_start ?? bucket.date);
    if (key === null || !slots.some((slot) => slot.key === key)) {
      offWindow += 1;
      continue;
    }
    byKey.set(key, bucket);
  }

  const days: TrendDay[] = slots.map((slot) => {
    const bucket = byKey.get(slot.key);
    if (!bucket) {
      return {
        ...slot,
        runs: null,
        costUsd: null,
        avgCostUsd: null,
        estimatedRuns: 0,
        hasBucket: false,
        hasReading: false,
      };
    }
    const runs = field(bucket, "runs", "runs");
    const costUsd = field(bucket, "costUsd", "cost_usd");
    return {
      ...slot,
      runs,
      costUsd,
      avgCostUsd: runs !== null && runs > 0 && costUsd !== null ? costUsd / runs : null,
      estimatedRuns: field(bucket, "estimatedRuns", "estimated_runs") ?? 0,
      hasBucket: true,
      hasReading: runs !== null || costUsd !== null,
    };
  });

  return { days, offWindow };
}

/* ------------------------------------------------------------------ *
 * 汇总
 * ------------------------------------------------------------------ */

export interface TrendSummary {
  /** 有读数的天数（断口数与「日均」分母都由它来）。 */
  readDays: number;
  missingDays: number;
  runsTotal: number | null;
  costTotal: number | null;
  /** 日均只按有读数的天数求；一天都没有 → null，不写 0。 */
  runsAvg: number | null;
  peak: TrendDay | null;
  maxRuns: number;
  maxCost: number;
  /** 窗口里没有任何一天有读数。 */
  empty: boolean;
}

export function trendSummary(days: TrendDay[]): TrendSummary {
  const withRuns = days.filter((d) => d.runs !== null);
  const withCost = days.filter((d) => d.costUsd !== null);
  const readDays = days.filter((d) => d.hasReading).length;
  const peak = withRuns.reduce<TrendDay | null>(
    (best, d) => (best === null || (d.runs ?? 0) > (best.runs ?? 0) ? d : best),
    null,
  );
  const runsTotal = withRuns.length > 0 ? withRuns.reduce((sum, d) => sum + (d.runs ?? 0), 0) : null;
  const costTotal = withCost.length > 0 ? withCost.reduce((sum, d) => sum + (d.costUsd ?? 0), 0) : null;
  return {
    readDays,
    missingDays: days.length - readDays,
    runsTotal,
    costTotal,
    runsAvg: runsTotal === null || withRuns.length === 0 ? null : runsTotal / withRuns.length,
    peak,
    maxRuns: Math.max(0, ...withRuns.map((d) => d.runs ?? 0)),
    maxCost: Math.max(0, ...withCost.map((d) => d.costUsd ?? 0)),
    empty: readDays === 0,
  };
}

/* ------------------------------------------------------------------ *
 * nice ticks — y 轴刻度取 1/2/2.5/5 × 10^k
 * ------------------------------------------------------------------ */

export interface Ticks {
  top: number;
  values: number[];
  decimals: number;
}

const NICE = [1, 2, 2.5, 5, 10];

export function niceTicks(max: number, steps = 4, decimals = 0): Ticks {
  if (!Number.isFinite(max) || max <= 0) {
    return { top: 1, values: [0, 0.25, 0.5, 0.75, 1].slice(0, steps + 1), decimals };
  }
  const raw = max / steps;
  const exponent = Math.floor(Math.log10(raw));
  const scale = 10 ** exponent;
  const candidate = NICE.find((n) => n * scale >= raw) ?? 10;
  const step = candidate * scale;
  const top = step * steps;
  const values = Array.from({ length: steps + 1 }, (_, i) =>
    Number((step * i).toFixed(decimals + 2)),
  );
  return { top, values, decimals };
}

/** 读数轴的刻度文本：次数取整，金额保两档小数。 */
export function tickText(value: number, decimals: number): string {
  return decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
}

/** 把值映射到 svg 绘图区的 y。 */
export function scaleY(value: number, top: number, height: number): number {
  if (!(top > 0)) return height;
  return height - (Math.max(0, value) / top) * height;
}
