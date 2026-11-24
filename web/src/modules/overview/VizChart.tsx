/**
 * OM-17：总览页图表几何（纯函数，无 JSX、无 DOM 读取）。
 *
 * 真值来源＝设计基线 docs/product/design/console-v2/ov01-target.html L795–L935
 * 的三个渲染器，逐条对照：
 *   · 火花线 L797–816：w=118 h=46 pad=3；X 均分、Y 以 (lo,hi) 线性映射；
 *     面积路径收到底边 h-pad；末点圆 r=2.4；base 有值才画 3 3 虚线基线。
 *   · 无趋势源点阵 L818–823：n=14、gap=w/(n+1)、cy=h/2、r=1.6（不是曲线、不是数据）。
 *   · 趋势柱 L876–L893：pl=34 pr=12 pt=24 pb=22；slot=iw/n；bw=min(16,slot-6)；
 *     网格 4 条（k=0..3，y=pt+ih*k/3）；柱 rx=2；峰值/事件线 dashed 3 4。
 *   · 7×24 热力 L893–L905：每格 1 小时，色阶 6 档（0 档＝底面色），行＝星期。
 *
 * 纪律：本文件只做算术，不写 style、不读 window、不注入时钟；
 * 像素一律 px 数字，交给 JSX 的 svg 属性（禁内联 style 棘轮）。
 */
import { num } from '../duty/types';

/** 火花槽位（基线 .kpi .spark 宽高 118×46）。 */
export const SPARK = { w: 118, h: 46, pad: 3 } as const;

/** 趋势图画布高：把 14 天卡压回 200–260px 档，绘图区仍占正文主体。 */
export const TREND_H = 136;
/** 趋势图内边距。overview.css 的 .ov5-bars 覆盖层按这四值对齐。 */
export const TREND_PAD = { l: 30, r: 10, t: 24, b: 20 } as const;

/** 热力栅格几何：单元格 26、间隔 2、行标签列 38、小时轴 18（基线 28/2/38/≈14）。 */
export const HEAT = { cell: 26, gap: 2, labelW: 38, axisH: 18 } as const;

export interface SparkGeometry {
  line: string;
  area: string;
  last: { x: number; y: number };
}

/**
 * 面积火花线（基线 spark() 的 area 分支）。
 * values 只放真实读数（null 桶由调用方剔除，绝不以 0 顶替）。
 */
export function sparkGeometry(values: number[]): SparkGeometry | null {
  const n = values.length;
  if (n === 0) return null;
  const { w, h, pad } = SPARK;
  const lo = Math.min(0, ...values);
  const hi = Math.max(Math.max(...values), lo + 1);
  const x = (i: number) => pad + (w - 2 * pad) * (n === 1 ? 0.5 : i / (n - 1));
  const y = (v: number) => h - pad - (h - 2 * pad) * ((v - lo) / (hi - lo));
  const pts = values.map((v, i) => `${x(i).toFixed(1)} ${y(v).toFixed(1)}`);
  const line = `M${pts.join(' L')}`;
  const area = `${line} L${x(n - 1).toFixed(1)} ${h - pad} L${x(0).toFixed(1)} ${h - pad} Z`;
  return { line, area, last: { x: x(n - 1), y: y(values[n - 1]) } };
}

/** 无趋势源点阵（基线 dots()）：14 点等距，不是曲线、不是数据。 */
export function dotGeometry(count = 14): Array<{ cx: number; cy: number }> {
  const gap = SPARK.w / (count + 1);
  return Array.from({ length: count }, (_, i) => ({ cx: gap * (i + 1), cy: SPARK.h / 2 }));
}

/** 坐标上限取整到 1/2/5×10^k，下限 4（基线用固定 15；我们按真峰值定标，不写死）。 */
export function niceCeil(peak: number): number {
  const v = Math.max(peak, 1);
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const step of [1, 2, 5, 10]) {
    const cand = step * mag;
    if (cand >= v) return Math.max(4, cand);
  }
  return Math.max(4, 10 * mag);
}

export interface TrendPointView {
  label: string;
  runs: number | null;
  failed: number | null;
}

export interface TrendColumn {
  index: number;
  label: string;
  runs: number | null;
  failed: number | null;
  /** 柱左沿与宽度（px）。 */
  x: number;
  w: number;
  /** 柱中心 x。 */
  cx: number;
  /** 柱顶 y；missing=null（该桶没有读数）。 */
  y: number | null;
  /** 柱高 px；missing=0。 */
  h: number;
  /** 其中失败子段高 px（只在有失败读数且 >0 时画）。 */
  failH: number;
  /** 该桶没有读数：画虚线占位，不画柱、不折 0。 */
  missing: boolean;
  /** 轴标签（基线每 4 格 + 末格）。 */
  showLabel: boolean;
  /** 峰值柱（画虚线标记 + 圆点）。 */
  peak: boolean;
}

export interface TrendSegment {
  /** 连续有读数的一段折线（缺读数处断开，不跨缺口连线）。 */
  line: string;
  /** 该段到绘图区底边的轻填充。 */
  area: string;
}

export interface TrendPointXY {
  index: number;
  x: number;
  y: number;
}

export interface TrendGeometry {
  w: number;
  h: number;
  plot: { l: number; t: number; w: number; h: number };
  slot: number;
  bw: number;
  ticks: Array<{ y: number; label: number }>;
  columns: TrendColumn[];
  /** 折线分段（缺读数断开）。 */
  segments: TrendSegment[];
  /** 跨缺读数的虚线连接（明确画成虚线，不冒充实测）。 */
  connectors: Array<{ line: string }>;
  /** 有读数的日格坐标（画小圆点）。 */
  points: TrendPointXY[];
  top: number;
  /** 峰值：列序号与读数；全零/全缺时为 null。 */
  peakAt: { index: number; value: number } | null;
  /** 合计（只累加有读数的桶）与失败合计（任一桶失败缺读即 null）。 */
  total: number;
  failedTotal: number | null;
}

/**
 * 整数档 y 轴（0 / 20 / 40 / 60 这类）：峰值 44 → 60，步长 20；
 * 峰值 8 → 10，步长 5。刻度从顶到底，末位必是 0。
 */
export function niceTicks(peak: number): { top: number; step: number; values: number[] } {
  const v = Math.max(1, peak);
  const rough = v / 3;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const rawStep = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const step = Math.max(1, Math.round(rawStep));
  const top = Math.ceil(v / step) * step;
  const values: number[] = [];
  for (let value = top; value >= 0; value -= step) values.push(Math.round(value * 100) / 100);
  return { top, step, values };
}

/**
 * 趋势几何：折线为主线（缺读数处断开），轻填充到绘图区底边，
 * 峰值点保留圆点；柱宽只用于悬停命中列（不再画柱）。
 */
export function trendGeometry(width: number, series: TrendPointView[]): TrendGeometry {
  const l = TREND_PAD.l;
  const t = TREND_PAD.t;
  const w = Math.max(240, Math.round(width));
  const ih = TREND_H - TREND_PAD.t - TREND_PAD.b;
  const iw = Math.max(1, w - TREND_PAD.l - TREND_PAD.r);
  const n = series.length || 1;
  const slot = iw / n;
  const bw = Math.min(30, Math.max(3, slot * 0.56));
  const peakValue = series.reduce<number>((best, p) => (p.runs !== null && p.runs > best ? p.runs : best), 0);
  const { top, values } = niceTicks(peakValue);
  const ticks = values.map((value) => ({ y: t + ih * (1 - value / top), label: value }));
  let peakIndex = -1;
  series.forEach((p, i) => {
    if (p.runs !== null && p.runs === peakValue && peakValue > 0 && peakIndex < 0) peakIndex = i;
  });
  const bottom = t + ih;
  const columns: TrendColumn[] = series.map((p, i) => {
    const cx = l + slot * i + slot / 2;
    const missing = p.runs === null;
    const h = missing ? 0 : Math.max(1.5, (ih * (p.runs as number)) / top);
    const failed = missing ? null : p.failed;
    const failH = failed !== null && failed > 0 ? Math.max(1, Math.min(h, (ih * failed) / top)) : 0;
    return {
      index: i,
      label: p.label,
      runs: p.runs,
      failed: p.failed,
      x: cx - bw / 2,
      w: bw,
      cx,
      y: missing ? null : bottom - h,
      h,
      failH,
      missing,
      showLabel: i === 0 || i === Math.floor((series.length - 1) / 2) || i === series.length - 1,
      peak: i === peakIndex,
    };
  });

  const points: TrendPointXY[] = columns
    .filter((col) => !col.missing && col.y !== null)
    .map((col) => ({ index: col.index, x: col.cx, y: col.y as number }));
  const segments: TrendSegment[] = [];
  let run: TrendPointXY[] = [];
  const flush = () => {
    if (run.length === 0) return;
    const line = run.length === 1
      ? `M${run[0].x.toFixed(1)} ${run[0].y.toFixed(1)} L${run[0].x.toFixed(1)} ${run[0].y.toFixed(1)}`
      : `M${run.map((pt) => `${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' L')}`;
    const area = `${line} L${run[run.length - 1].x.toFixed(1)} ${bottom} L${run[0].x.toFixed(1)} ${bottom} Z`;
    segments.push({ line, area });
    run = [];
  };
  for (const pt of points) {
    if (run.length > 0 && pt.index !== run[run.length - 1].index + 1) flush();
    run.push(pt);
  }
  flush();
  const connectors = points.slice(1).flatMap((point, i) => {
    const prev = points[i];
    if (point.index <= prev.index + 1) return [];
    return [{ line: `M${prev.x.toFixed(1)} ${prev.y.toFixed(1)} L${point.x.toFixed(1)} ${point.y.toFixed(1)}` }];
  });

  const total = series.reduce((sum, p) => sum + (p.runs ?? 0), 0);
  const failedTotal = series.some((p) => p.failed === null) ? null : series.reduce((sum, p) => sum + (p.failed ?? 0), 0);
  return {
    w,
    h: TREND_H,
    plot: { l, t, w: iw, h: ih },
    slot,
    bw,
    ticks,
    columns,
    segments,
    connectors,
    points,
    top,
    peakAt: peakIndex >= 0 ? { index: peakIndex, value: peakValue } : null,
    total,
    failedTotal,
  };
}

/** 热力色阶：0 / 1–2 / 3–4 / 5+ 四档，与图例逐档同序。 */
export function heatLevel(count: number): number {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  return 3;
}

export interface HeatCellView {
  hour: number;
  /** null＝该格上游没有给读数（与真 0 区分）。 */
  count: number | null;
  level: number;
}

export interface HeatRowView {
  dow: number;
  label: string;
  cells: HeatCellView[];
}

export interface HeatMatrix {
  rows: HeatRowView[];
  /** 至少一格有读数（否则整块走空态，不画 168 个空格）。 */
  hasRead: boolean;
  total: number;
  peak: { dow: number; hour: number; count: number } | null;
  /** 夜间 0–6 点每小时均值；没有读数时为 null。 */
  nightAvg: number | null;
}

/** 行序（基线 DAYS）：周一…周日，对应 JS getDay() 的 1..6,0。 */
const HEAT_ORDER: Array<{ dow: number; label: string }> = [
  { dow: 1, label: '周一' },
  { dow: 2, label: '周二' },
  { dow: 3, label: '周三' },
  { dow: 4, label: '周四' },
  { dow: 5, label: '周五' },
  { dow: 6, label: '周六' },
  { dow: 0, label: '周日' },
];

/** 7×24 矩阵：上游只给出现过的格，缺格保持 null（不当 0）。 */
export function heatMatrix(cells: unknown): HeatMatrix {
  const list = Array.isArray(cells) ? cells : [];
  const map = new Map<string, number>();
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const cell = raw as { dow?: unknown; hour?: unknown; count?: unknown };
    const dow = num(cell.dow);
    const hour = num(cell.hour);
    const count = num(cell.count);
    if (dow === null || hour === null || count === null) continue;
    if (dow < 0 || dow > 6 || hour < 0 || hour > 23) continue;
    map.set(`${dow}-${hour}`, count);
  }
  let total = 0;
  let peak: HeatMatrix['peak'] = null;
  let nightSum = 0;
  let nightCount = 0;
  const rows: HeatRowView[] = HEAT_ORDER.map(({ dow, label }) => ({
    dow,
    label,
    cells: Array.from({ length: 24 }, (_, hour) => {
      const count = map.has(`${dow}-${hour}`) ? (map.get(`${dow}-${hour}`) as number) : null;
      if (count !== null) {
        total += count;
        if (peak === null || count > peak.count) peak = { dow, hour, count };
        if (hour <= 6) {
          nightSum += count;
          nightCount += 1;
        }
      }
      return { hour, count, level: count === null ? 0 : heatLevel(count) };
    }),
  }));
  return {
    rows,
    hasRead: map.size > 0,
    total,
    peak,
    nightAvg: nightCount > 0 ? nightSum / nightCount : null,
  };
}

/** 热力色阶 6 档的 color-mix 百分比（overview.css 的 .ov5-heat-lv* 与之逐档对应）。 */
export const HEAT_RAMP = [0, 16, 32, 50, 72, 100] as const;