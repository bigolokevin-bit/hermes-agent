/**
 * 平滑曲线的纯几何（零依赖、零 DOM）。
 *
 * 等价物是 Recharts `type="monotone"` 底下的 d3-shape `curveMonotoneX`
 * （Steffen 1990 保单调三次 Hermite）：
 *   · 顶点切线 slope3：p = (s0*h1 + s1*h0) / (h0 + h1)，
 *     取 (sign(s0)+sign(s1)) * min(|s0|, |s1|, 0.5*|p|)；符号相反时归 0（极值点）。
 *   · 端点切线 slope2：h ? (3*s - t) / 2 : t（t = 相邻顶点切线）。
 *   · 每段输出三次贝塞尔：dx = (x1-x0)/3，
 *     C (x0+dx, y0+dx*t0) (x1-dx, y1-dx*t1) (x1, y1)。
 *   · 无 tension；n=2 退化成直线；n=3 直接走端点特例；相邻重合点忽略。
 *
 * 纪律：本文件只做算术，不读 window、不注入时钟、不引第三方库。
 */

export interface Pt {
  x: number;
  y: number;
}

const EPS = 1e-6;
const sign = (value: number): number => (value > 0 ? 1 : value < 0 ? -1 : 0);

/** 相邻重合点忽略（同 x 只留先到的一点），非有限值直接丢弃。 */
export function dedupePoints(points: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const prev = out[out.length - 1];
    if (prev && Math.abs(point.x - prev.x) < EPS) continue;
    out.push({ x: point.x, y: point.y });
  }
  return out;
}

/** 内部顶点切线（d3 slope3）。 */
function slope3(h0: number, h1: number, s0: number, s1: number): number {
  const span = h0 + h1;
  if (Math.abs(span) < EPS) return 0;
  const p = (s0 * h1 + s1 * h0) / span;
  const t = (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p));
  return Number.isFinite(t) ? t : 0;
}

/**
 * 每点切线。端点用单侧特例（d3 slope2），n=2 时两端都取割线斜率，
 * 因此两点序列必然是直线。
 */
export function monotoneTangents(input: readonly Pt[]): number[] {
  const points = dedupePoints(input);
  const n = points.length;
  if (n === 0) return [];
  if (n === 1) return [0];
  if (n === 2) {
    const s = (points[1].y - points[0].y) / (points[1].x - points[0].x);
    return [s, s];
  }
  const tangents: number[] = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i += 1) {
    const h0 = points[i].x - points[i - 1].x;
    const h1 = points[i + 1].x - points[i].x;
    const s0 = (points[i].y - points[i - 1].y) / h0;
    const s1 = (points[i + 1].y - points[i].y) / h1;
    tangents[i] = slope3(h0, h1, s0, s1);
  }
  tangents[0] = endTangent(points, 0, tangents[1]);
  tangents[n - 1] = endTangent(points, n - 1, tangents[n - 2]);
  return tangents;
}

/** 端点单侧切线：t0 = (3*s - t1) / 2。 */
function endTangent(points: readonly Pt[], index: number, neighbour: number): number {
  const first = index === 0;
  const a = first ? points[0] : points[index - 1];
  const b = first ? points[1] : points[index];
  const h = b.x - a.x;
  if (Math.abs(h) < EPS) return neighbour;
  const s = (b.y - a.y) / h;
  return (3 * s - neighbour) / 2;
}

const fmt = (value: number): string => (Math.round(value * 100) / 100).toFixed(2);

/** 上边界路径：平滑曲线；n<3 退化成直线（单点只给 M）。 */
export function monotoneXPath(input: readonly Pt[]): string {
  const points = dedupePoints(input);
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M${fmt(points[0].x)} ${fmt(points[0].y)}`;
  if (n === 2) {
    return `M${fmt(points[0].x)} ${fmt(points[0].y)} L${fmt(points[1].x)} ${fmt(points[1].y)}`;
  }
  const tangents = monotoneTangents(points);
  let d = `M${fmt(points[0].x)} ${fmt(points[0].y)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dx = (b.x - a.x) / 3;
    d += ` C${fmt(a.x + dx)} ${fmt(a.y + dx * tangents[i])} ${fmt(b.x - dx)} ${fmt(b.y - dx * tangents[i + 1])} ${fmt(b.x)} ${fmt(b.y)}`;
  }
  return d;
}

/** 面积路径：同一条单调曲线收口到底边（baseY）闭合。 */
export function monotoneAreaPath(input: readonly Pt[], baseY: number): string {
  const points = dedupePoints(input);
  if (points.length === 0) return '';
  const line = monotoneXPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L${fmt(last.x)} ${fmt(baseY)} L${fmt(first.x)} ${fmt(baseY)} Z`;
}

/**
 * 断口：把 y 序列切成「连续有读数」的下标段。null/非有限值即缺口，
 * 缺口两侧各自成段，跨缺段不产生任何曲线指令。
 */
export function contiguousRuns(values: ReadonlyArray<number | null | undefined>): number[][] {
  const runs: number[][] = [];
  let run: number[] = [];
  values.forEach((value, index) => {
    const has = typeof value === 'number' && Number.isFinite(value);
    if (has) {
      run.push(index);
      return;
    }
    if (run.length > 0) runs.push(run);
    run = [];
  });
  if (run.length > 0) runs.push(run);
  return runs;
}

/** 类目 band 的中心 x：plotLeft + (i + 0.5) * step。 */
export function bandCenters(count: number, plotLeft: number, plotWidth: number): number[] {
  if (count <= 0) return [];
  const step = plotWidth / count;
  return Array.from({ length: count }, (_, i) => plotLeft + (i + 0.5) * step);
}

/** IN 原文的整数档阶梯：峰值归一后取首个 ≥ 归一值的因子。 */
const LADDER = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10] as const;

/**
 * Y 轴上限取整：峰值 0 → 1；否则 magnitude = 10^floor(log10(peak))，
 * 归一值在阶梯里取首个 ≥ 归一值的因子，超出阶梯则 10*magnitude。
 */
export function yDomainLadder(peak: number): number {
  if (!Number.isFinite(peak) || peak <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  const normalized = peak / magnitude;
  const factor = LADDER.find((step) => step >= normalized - EPS);
  const top = factor === undefined ? 10 * magnitude : factor * magnitude;
  // 金额量纲（<1）不能被取整成 1，否则 0.64 的顶值会变成 1.00。
  return top > 0 ? Number(top.toPrecision(6)) : 1;
}

/** 三档整数刻度（顶 / 中 / 0）；中线取整后与端点重合时只留两档。 */
export function yTickValues(peak: number): { top: number; values: number[] } {
  return tickValuesForTop(yDomainLadder(peak));
}

/** 给定上限时的三档刻度（多图共用刻度用）。 */
export function tickValuesForTop(top: number): { top: number; values: number[] } {
  const safe = top > 0 ? Number(top.toPrecision(6)) : 1;
  // 整数量纲（次数）的中线也取整；小数量纲（金额）保两位有效档。
  const mid = Number.isInteger(safe)
    ? Math.round(safe / 2)
    : Number((safe / 2).toPrecision(3));
  return { top: safe, values: mid > 0 && mid < safe ? [safe, mid, 0] : [safe, 0] };
}
