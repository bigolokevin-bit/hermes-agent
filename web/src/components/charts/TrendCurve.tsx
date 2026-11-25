/**
 * TrendCurve — 平滑曲线 + 面积渐变的走势图（纯 SVG，零新依赖）。
 *
 * 形制来源：IN 项目（imagine_next）Recharts `type="monotone"` 的走势图，
 * 逐值照抄后落成手写件：
 *   · 上边界 monotone（d3 curveMonotoneX 等价，见 ./monotone.ts）；
 *   · 面积用竖向 linearGradient：顶部 opacity 0.24（次线 0.22）→ 底部 0.02；
 *   · 线宽主 2 / 次 1.5 / 细 1.25，一律不画数据点；
 *   · 网格只横向实线、无 dasharray；轴不画轴线不画刻度线；
 *   · Y 轴整数档（顶/中/0）、X 轴首-中-末三标，带宽 42。
 *
 * 本仓差异（不许照抄 IN）：缺读数的日留断口——缺口两侧曲线断开，
 * 不补 0、不跨缺段连线；峰值仍标注，但用中性色（不用红）。
 */
import { type ReactNode, type RefObject, useEffect, useId, useRef, useState } from 'react';

import {
  bandCenters,
  contiguousRuns,
  monotoneAreaPath,
  monotoneXPath,
  tickValuesForTop,
  yTickValues,
  type Pt,
} from './monotone';
import './charts.css';

export interface TrendCurvePoint {
  /** X 类目标签（屏上形制，如 `11-18`）。 */
  label: string;
  /** 读数；null ＝ 该日没有读数（缺口，不补 0）。 */
  y: number | null;
}

export interface TrendCurvePad {
  l: number;
  r: number;
  t: number;
  b: number;
}

export interface TrendCurveProps {
  points: TrendCurvePoint[];
  /** 画布高（px），默认 208（IN 的容器 min-h 档）。 */
  height?: number;
  /** 主线（线宽 2、面积 0.24）；false ＝ 次线（1.5 / 0.22）。 */
  primary?: boolean;
  /** 细线 1.25（第三档）。 */
  thin?: boolean;
  /** 线的色相：中性 / 运行（info）/ 成本（warning）。 */
  tone?: 'neutral' | 'info' | 'warning';
  /** 峰值文案，默认 `峰值 N`；给 null 则不标。 */
  peakLabel?: (value: number) => string;
  formatY?: (value: number) => string;
  /** X 轴档位文案；第二参给该点的下标（末档写成「今天」这类屏上叫法时用）。 */
  formatX?: (label: string, index: number) => string;
  ariaLabel?: string;
  /** 屏上文字替代（如卡片里的逐日摘要）的 id，挂到 svg 的 aria-describedby。 */
  describedBy?: string;
  testId?: string;
  showX?: boolean;
  showGrid?: boolean;
  pad?: Partial<TrendCurvePad>;
  /** Y 轴上限覆写（多图共刻度时用）。 */
  top?: number;
  className?: string;
  /** 追加给 svg 的 class（页面侧对齐覆盖层时用）。 */
  svgClassName?: string;
  /** 绘图区下方的补充节点（图例等）。 */
  children?: ReactNode;
}

const DEFAULT_PAD: TrendCurvePad = { l: 44, r: 12, t: 18, b: 24 };
const DEFAULT_HEIGHT = 208;

/** 容器实测宽度：svg 的 viewBox 与像素 1:1，窄屏也不缩字。 */
function useMeasuredWidth(fallback: number): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = (next: number) => {
      if (next > 0) setWidth((prev) => (Math.abs(prev - next) > 0.5 ? Math.round(next) : prev));
    };
    apply(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) apply(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

export function TrendCurve({
  points,
  height = DEFAULT_HEIGHT,
  primary = true,
  thin = false,
  tone = 'neutral',
  peakLabel,
  formatY,
  formatX,
  ariaLabel,
  describedBy,
  testId,
  showX = true,
  showGrid = true,
  pad: padProp,
  top: topProp,
  className,
  svgClassName,
  children,
}: TrendCurveProps) {
  const [wrapRef, width] = useMeasuredWidth(640);
  const rawId = useId();
  const gradientId = `tc-grad-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const pad: TrendCurvePad = { ...DEFAULT_PAD, ...padProp };
  const plotW = Math.max(1, width - pad.l - pad.r);
  const plotH = Math.max(1, height - pad.t - pad.b);
  const baseY = pad.t + plotH;
  const centers = bandCenters(points.length, pad.l, plotW);
  const values = points.map((point) => point.y);
  const peak = values.reduce<number>((best, value) => (value !== null && value > best ? value : best), 0);
  const domain = topProp !== undefined ? tickValuesForTop(topProp) : yTickValues(peak);
  const top = domain.top;
  const yAt = (value: number): number => {
    if (!(top > 0)) return baseY;
    const clamped = Math.min(Math.max(value, 0), top);
    return baseY - (clamped / top) * plotH;
  };
  const runs = contiguousRuns(values);
  const segments: Pt[][] = runs.map((run) =>
    run.map((index) => ({ x: centers[index], y: yAt(values[index] as number) })),
  );

  let peakIndex = -1;
  if (peak > 0) {
    peakIndex = values.findIndex((value) => value === peak);
  }

  const axisValue = (value: number): string =>
    formatY ? formatY(value) : String(Math.round(value * 100) / 100);
  const axisLabel = (label: string, index: number): string =>
    formatX ? formatX(label, index) : label;
  const xIndices = showX && points.length > 0
    ? Array.from(
        new Set([0, Math.floor((points.length - 1) / 2), points.length - 1].filter((i) => i >= 0)),
      )
    : [];
  const lineClass = ['tc-line', primary ? '' : 'is-secondary', thin ? 'is-thin' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={['tc-chart', className].filter(Boolean).join(' ')} ref={wrapRef}>
      <svg
        className={['tc-svg', svgClassName].filter(Boolean).join(' ')}
        data-tone={tone}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        data-testid={testId}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop className="tc-stop" offset="0%" stopOpacity={primary ? 0.24 : 0.22} />
            <stop className="tc-stop" offset="100%" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {domain.values.map((value) => {
          const y = yAt(value);
          return (
            <g key={`grid-${value}`}>
              {showGrid ? (
                <line className="tc-grid" x1={pad.l} x2={pad.l + plotW} y1={y} y2={y} />
              ) : null}
              <text className="tc-tick" x={pad.l - 8} y={y + 4} textAnchor="end">
                {axisValue(value)}
              </text>
            </g>
          );
        })}

        {/* 缺读数：底部断口，不补 0 */}
        {values.map((value, index) =>
          value === null ? (
            <rect
              key={`gap-${index}`}
              className="tc-gap"
              x={centers[index] - 1.5}
              y={baseY - 7}
              width={3}
              height={7}
              rx={1}
            >
              <title>{`${points[index].label} · 缺读数`}</title>
            </rect>
          ) : null,
        )}

        {segments.map((segment, index) =>
          segment.length > 1 ? (
            <path
              key={`area-${index}`}
              className="tc-area"
              d={monotoneAreaPath(segment, baseY)}
              fill={`url(#${gradientId})`}
            />
          ) : null,
        )}
        {segments.map((segment, index) => (
          <path key={`line-${index}`} className={lineClass} d={monotoneXPath(segment)} />
        ))}
        {segments.map((segment, index) =>
          segment.length === 1 ? (
            <circle
              key={`iso-${index}`}
              className="tc-iso"
              cx={segment[0].x}
              cy={segment[0].y}
              r={1.8}
            />
          ) : null,
        )}

        {peakIndex >= 0 ? (
          <g>
            <line
              className="tc-peak-mark"
              x1={centers[peakIndex]}
              x2={centers[peakIndex]}
              y1={pad.t}
              y2={baseY}
            />
            <circle
              className="tc-peak-dot"
              cx={centers[peakIndex]}
              cy={yAt(peak)}
              r={2.6}
            />
            {peakLabel ? (
              <text
                className="tc-peak-label"
                x={centers[peakIndex] > width - 72 ? centers[peakIndex] - 6 : centers[peakIndex] + 6}
                y={Math.max(pad.t + 2, yAt(peak) - 8)}
                textAnchor={centers[peakIndex] > width - 72 ? 'end' : 'start'}
              >
                {peakLabel(peak)}
              </text>
            ) : null}
          </g>
        ) : null}

        {xIndices.map((index) => (
          <text
            key={`ax-${index}`}
            className="tc-tick"
            x={centers[index]}
            y={height - 6}
            textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
          >
            {axisLabel(points[index].label, index)}
          </text>
        ))}
      </svg>
      {children}
    </div>
  );
}
