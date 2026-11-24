import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Badge } from '@nous-research/ui/ui/components/badge';
import { Button } from '@nous-research/ui/ui/components/button';
import { Card, CardContent } from '@nous-research/ui/ui/components/card';

import { fetchMatrix, load } from '../duty/api';
import { beijing, dashed, employeeLabel, shortId, usd } from '../duty/format';
import { useDutyData, type DutyData } from '../duty/useDutyData';
import { DUTY_RANGES, DEFAULT_DUTY_RANGE, dutyRange, parseDutyRange, type DutyRangeId } from '../duty/dutyRange';
import type { ActivityBody, Loadable, MatrixBody, RunStatsBody } from '../duty/types';
import { buildKpis, blockerRows, overviewSummaryText, sourceStamp, trendPoints, OVERVIEW_GAP, type OverviewSummaryRow } from './overview';
import { fetchHermesSummary, type HermesSummaryBody } from './api';
import { COST_CALIBER_TEXT } from '../metrics/costCaliberNote';
import {
  HEAT,
  HEAT_RAMP,
  SPARK,
  TREND_H,
  TREND_PAD,
  dotGeometry,
  heatMatrix,
  sparkGeometry,
  trendGeometry,
  type HeatMatrix,
} from './VizChart';
import './overview.css';

type Forced = 'loading' | 'empty' | 'error';
type StampSource = { source: string; state: Loadable<unknown> };

// OM-15：服务探针状态词表——只翻译 hermes-summary 真读数，没有读数就是未接。
const HEALTH_LABEL: Record<string, string> = { ok: '正常', degraded: '降级', down: '异常' };

/* ============================================================================
 * 页内图标基元（OM-17）：设计基线用 sprite <use>，本树以「内联 <svg><path/></svg>」
 * 替换 lucide——判据④要求本页源码装载视觉层，图标也走同一形制；几何 24×24，
 * 描边 1.8，currentColor 随文字色走主题，不写内联 style。
 * ========================================================================== */
const ICON_BASE = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: 'false',
} as const;

type IconProps = { className?: string };

function IconRefresh({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <path d="M20.4 12a8.4 8.4 0 1 1-2.6-6" />
      <path d="M20 4v5.4h-5.4" />
    </svg>
  );
}

function IconClock({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.6V12l3 1.8" />
    </svg>
  );
}

function IconArrowRight({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function IconAlert({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <path d="M10.3 3.9 2.5 17.4A1.9 1.9 0 0 0 4.2 20.3h15.6a1.9 1.9 0 0 0 1.7-2.9L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 16.6h.01" />
    </svg>
  );
}

function IconFlat({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <path d="M6 12h12" />
    </svg>
  );
}

function IconTrendUp({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <polyline points="3 17 9.5 10.5 14 15 21 8" />
      <polyline points="15.5 8 21 8 21 13.5" />
    </svg>
  );
}

function IconUsers({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <path d="M16.5 20v-1.8a4 4 0 0 0-4-4H6.8a4 4 0 0 0-4 4V20" />
      <circle cx="9.7" cy="7.4" r="3.6" />
      <path d="M21.2 20v-1.8a4 4 0 0 0-3-3.9" />
      <path d="M15.6 4a3.6 3.6 0 0 1 0 6.9" />
    </svg>
  );
}

function IconGauge({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <path d="M3.6 18.5a9 9 0 1 1 16.8 0" />
      <path d="m12 14.4 3.6-4.4" />
      <circle cx="12" cy="15.2" r="1.6" />
    </svg>
  );
}

function IconShield({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <path d="M12 2.9 4.4 6v5.6c0 4.4 3.1 8.1 7.6 9.5 4.5-1.4 7.6-5.1 7.6-9.5V6Z" />
      <path d="M12 8.4v4" />
      <path d="M12 15.4h.01" />
    </svg>
  );
}

function IconPulse({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <path d="M2.8 12h4l2.4-5.6 3.6 11.2 2.4-5.6h6" />
    </svg>
  );
}

function IconCoins({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <ellipse cx="12" cy="6.6" rx="7.4" ry="3.2" />
      <path d="M4.6 6.6v5c0 1.8 3.3 3.2 7.4 3.2s7.4-1.4 7.4-3.2v-5" />
      <path d="M4.6 11.6v5c0 1.8 3.3 3.2 7.4 3.2s7.4-1.4 7.4-3.2v-5" />
    </svg>
  );
}

function IconCopy({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <rect x="8.6" y="8.6" width="11.8" height="11.8" rx="2" />
      <path d="M15.4 8.6V5.6a2 2 0 0 0-2-2H5.6a2 2 0 0 0-2 2v7.8a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

function IconCheck({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <path d="m4.8 12.6 4.6 4.6L19.2 7.4" />
    </svg>
  );
}

function IconInbox({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <polyline points="21 12 15.6 12 13.8 14.8 10.2 14.8 8.4 12 3 12" />
      <path d="M6.3 5.1 3 12v5.6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V12l-3.3-6.9A1.9 1.9 0 0 0 15.9 3.8H7.9a1.9 1.9 0 0 0-1.6 1.3Z" />
    </svg>
  );
}

function IconActivity({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <rect x="3.4" y="3.4" width="7.2" height="7.2" rx="1.6" />
      <rect x="13.4" y="3.4" width="7.2" height="7.2" rx="1.6" />
      <rect x="3.4" y="13.4" width="7.2" height="7.2" rx="1.6" />
      <rect x="13.4" y="13.4" width="7.2" height="7.2" rx="1.6" />
    </svg>
  );
}

function IconChart({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <path d="M3.6 3.6v16.8h16.8" />
      <rect x="7" y="12.6" width="3.4" height="5.4" rx="1" />
      <rect x="12.4" y="9.2" width="3.4" height="8.8" rx="1" />
      <rect x="17.8" y="5.4" width="3" height="12.6" rx="1" />
    </svg>
  );
}

/* ============================================================================
 * 图表基元（几何取自 VizChart.tsx，形制照基线 ov01-target.html L795–935）
 * ========================================================================== */

/** 面积火花线（基线 spark() area 分支）。无读数时由调用方退回点阵。 */
function SparkArea({ values, label }: { values: number[]; label: string }) {
  const geo = sparkGeometry(values);
  if (!geo) return <NoTrendDots />;
  return (
    <svg className="ov5-spark" viewBox={`0 0 ${SPARK.w} ${SPARK.h}`} role="img" aria-label={label}>
      <path className="ov5-spark-area" d={geo.area} />
      <path className="ov5-spark-line" d={geo.line} />
      <circle className="ov5-spark-dot" cx={geo.last.x} cy={geo.last.y} r={2.4} />
    </svg>
  );
}

/** 无趋势源：等距点阵 + 屏读文本「无趋势源」（基线 dots()，不是曲线、不是数据）。 */
function NoTrendDots({ note = '无趋势源' }: { note?: string }) {
  const pts = dotGeometry(14);
  return (
    <span className="ov5-viz-dots">
      <svg className="ov5-dots" viewBox={`0 0 ${SPARK.w} ${SPARK.h}`} aria-hidden="true">
        {pts.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r={1.6} />
        ))}
      </svg>
      <span className="ov5-sr">{note}</span>
    </span>
  );
}

/** 热力色阶图例（6 档，与 .ov5-heat-lv* 逐档对应）。 */
function HeatScale() {
  return (
    <svg className="ov5-heat-scale" viewBox="0 0 76 12" aria-hidden="true">
      {HEAT_RAMP.map((percent, level) => (
        <rect key={percent} className={`ov5-heat-cell ov5-heat-lv${level}`} x={level * 13} y={0} width={10} height={12} rx={4} />
      ))}
    </svg>
  );
}

/** 量宽度只为趋势图定 viewBox；jsdom 没有布局，退回 720 不影响任何断言。 */
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

function Delta({ children }: { children: ReactNode }) {
  return (
    <span className="ov5-dtl is-flat">
      <IconFlat className="ov5-i ov5-i-13" />
      {children}
    </span>
  );
}

function RequestId({ id }: { id: string | null }) {
  const [copied, setCopied] = useState(false);
  const text = id ?? '未提供';
  const copy = async () => {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeText();
    } catch {
      setCopied(false);
    }
  };
  const setTimeText = () => window.setTimeout(() => setCopied(false), 1800);
  return (
    <span className="ov5-req">
      请求编号 {text}
      {id ? (
        <button type="button" onClick={copy} data-testid="ov6-copy-req">
          {copied ? '已复制' : '复制'}
        </button>
      ) : null}
    </span>
  );
}

function Source({ children }: { children: ReactNode }) {
  return <span className="ov5-source">{children}</span>;
}

/** R31: the as-of line renders in EVERY state — the real minute stamp in
 * 北京时间 YYYY-MM-DD HH:mm, or "—" with the honest reason in title.
 * Never an invented time, never absent from the DOM. */
function AsofLine({ states }: { states: Array<Loadable<unknown> | null> }) {
  const stamps = states.map((st) => sourceStamp(st));
  const shown = stamps
    .map((x) => x.shown)
    .filter((x): x is string => Boolean(x) && x !== '—')
    .sort();
  if (shown.length > 0) {
    // R41: newest (maximum) stamp wins, matching the mounted duty surface.
    const newest = shown.reduce((a, b) => (a >= b ? a : b));
    return (
      <p className="ov5-fresh" data-testid="ov6-asof" title="取各来源响应自带的采集时间，最新的一个上屏">
        <IconClock className="ov5-i ov5-i-14" />
        <span>{`采集时刻 北京时间 ${newest} · 每卡来源见卡内标注`}</span>
      </p>
    );
  }
  const reason = stamps.find((x) => x.reason)?.reason ?? '所有来源都没有返回采集时间';
  return (
    <p className="ov5-fresh" data-testid="ov6-asof" title={`取不到采集时间：${reason}`}>
      <IconClock className="ov5-i ov5-i-14" />
      <span>采集时刻 —（北京时间）</span>
    </p>
  );
}

function Freshness({ items, testid }: { items: StampSource[]; testid?: string }) {
  return (
    <div className="ov5-stamps" data-testid={testid}>
      {items.map(({ source, state }) => {
        const stamp = sourceStamp(state);
        return (
          <div className="ov5-stamp" key={source}>
            <span>
              数据截至 {stamp.shown ?? '时间未知'} · 来源 {source}
            </span>
            {stamp.reason ? <em>原因：{stamp.reason}</em> : null}
          </div>
        );
      })}
    </div>
  );
}

type KpiIssue = { label: string; state: Loadable<unknown>; gap?: string };

function KpiCard({
  title,
  value,
  foot,
  source,
  stamps,
  testid,
  note,
  noteTitle,
  issues,
  onRetry,
  icon,
  viz,
  delta,
}: {
  title: string;
  value: ReactNode;
  foot?: ReactNode;
  source: string;
  stamps: StampSource[];
  testid: string;
  note?: ReactNode;
  noteTitle?: string;
  issues?: KpiIssue[];
  onRetry?: () => void;
  icon?: ReactNode;
  /** OM-17：火花槽位／点阵槽位（基线 .kpi .kr 右侧 118×46）。 */
  viz?: ReactNode;
  /** OM-17：delta 槽位（基线 .kpi .kn 句首）。 */
  delta?: ReactNode;
}) {
  return (
    <Card className="ov5-kpi" data-testid={testid} data-duty-testid={testid.replace('ov6-', 'duty-')}>
      <CardContent className="ov5-kpi-bd">
        <div className="ov5-kpi-hd">
          <span className="ov5-kpi-title">
            {icon}
            <span>{title}</span>
          </span>
          <Source>{source}</Source>
        </div>
        <div className="ov5-kr">
          <div className="ov5-kpi-value">{value}</div>
          {viz ? <span className="ov5-kpi-viz">{viz}</span> : null}
        </div>
        {delta ? <div className="ov5-kn">{delta}</div> : null}
        {foot ? <div className="ov5-kpi-foot">{foot}</div> : null}
        {issues?.map((issue) =>
          issue.state.k === 'error' ? (
            <div className="ov5-kpi-issue" title={issue.gap} key={issue.label}>
              <span>
                {issue.label}未接入：{issue.state.message}
              </span>
              <RequestId id={issue.state.requestId} />
              {onRetry ? (
                <Button size="sm" outlined onClick={onRetry} data-testid={`${testid}-issue-retry`}>
                  重试
                </Button>
              ) : null}
            </div>
          ) : null,
        )}
        <Freshness items={stamps} testid={`${testid}-stamp`} />
        {note ? <div className="ov5-note" title={noteTitle}>{note}</div> : null}
      </CardContent>
    </Card>
  );
}

/* ============================================================================
 * ③ 趋势：柱高＝当日运行次数；失败作为柱内子段（不叠加柱顶，不折 0）；
 *    null 桶画虚线占位并保留 .ov5-bar.is-missing 契约；悬停读数走 .ov5-tip
 *    （role="status" aria-live="polite"，与基线 #trendTip 同形制）。
 * ========================================================================== */
function Trend({ stats, label = '近 14 天', days = 14, onRetry }: { stats: Loadable<RunStatsBody>; label?: string; days?: number; onRetry: () => void }) {
  const points = stats.k === 'ready' ? trendPoints(stats.data, days) : [];
  // OM-06 数据契约：全缺桶（未返回）与全真零各走各的空态文案，都不画骨架/4px 柱；
  // max(1,…) 防除零；混合窗（有数有缺）照常逐桶画，缺桶保留 is-missing 形。
  const allMissing = points.length > 0 && points.every((p) => p.runs === null);
  const allZero = points.length > 0 && points.every((p) => p.runs === 0);
  const max = Math.max(1, ...points.map((p) => p.runs ?? 0));
  const [chartRef, width] = useMeasuredWidth(720);
  const [hovered, setHovered] = useState<number | null>(null);
  const draw = stats.k === 'ready' && points.length > 0 && !allZero && !allMissing;
  const geo = draw ? trendGeometry(width, points) : null;
  const lastWithRuns = points.reduce((best, p, i) => (p.runs !== null ? i : best), -1);
  const activeIndex = hovered !== null && hovered < points.length ? hovered : lastWithRuns;
  const active = activeIndex >= 0 ? points[activeIndex] : null;
  return (
    <Card className="ov5-block ov5-trend" data-testid="ov6-trend" data-duty-testid="duty-trend">
      <CardContent className="ov5-block-bd">
        <div className="ov5-block-hd">
          <h2>
            <IconChart className="ov5-i ov5-i-16" />
            {label}运行趋势
          </h2>
          <Source>运行统计</Source>
        </div>
        <Freshness items={[{ source: '运行统计', state: stats }]} testid="ov6-trend-stamp" />
        {stats.k === 'loading' ? (
          <div className="ov5-skeleton" aria-busy="true" aria-label="趋势加载中"><span /><span /><span /></div>
        ) : stats.k === 'error' ? (
          <div className="ov5-inline-error" role="alert">
            <IconAlert className="ov5-i ov5-i-16" />
            <span>趋势数据没有读出来。</span>
            <RequestId id={stats.requestId} />
            <Button size="sm" outlined onClick={onRetry} data-testid="ov6-trend-retry">重试</Button>
          </div>
        ) : points.length === 0 || allZero ? (
          <div className="ov5-empty-line">
            <IconInbox className="ov5-i ov5-i-16" />
            <span>{label}还没有运行记录，所以没有趋势可画。</span>
            <Link to="/runs">去看运行记录<IconArrowRight className="ov5-i ov5-i-14" /></Link>
          </div>
        ) : allMissing ? (
          <div className="ov5-empty-line" data-testid="ov6-trend-missing">
            <IconAlert className="ov5-i ov5-i-16" />
            <span>{label}的运行数据没有返回，所以画不出趋势。</span>
          </div>
        ) : geo ? (
          <>
            <div className="ov5-tsum">
              <span className="ov5-tsum-k"><b>{geo.total}</b> 次</span>
              <span>失败 <b>{geo.failedTotal === null ? '—' : geo.failedTotal}</b></span>
              <span>
                <IconTrendUp className="ov5-i ov5-i-13" />
                峰值 <b>{geo.peakAt ? geo.peakAt.value : '—'}</b>
              </span>
              <span className="ov5-tsum-note">虚线为峰值柱；缺读数的日子画虚线框，不折 0</span>
            </div>
            <div className="ov5-chart" ref={chartRef}>
              <svg
                className="ov5-trend-svg"
                viewBox={`0 0 ${geo.w} ${geo.h}`}
                height={TREND_H}
                role="img"
                aria-label={`${label}运行趋势：合计 ${geo.total} 次，峰值 ${geo.peakAt ? geo.peakAt.value : '—'} 次，失败 ${geo.failedTotal === null ? '—' : geo.failedTotal} 次`}
              >
                {geo.ticks.map((tick) => (
                  <g key={`t${tick.label}-${tick.y}`}>
                    <line className="ov5-grid-line" x1={TREND_PAD.l} x2={geo.w - TREND_PAD.r} y1={tick.y} y2={tick.y} />
                    <text className="ov5-axis-lbl" x={TREND_PAD.l - 8} y={tick.y + 4} textAnchor="end">{tick.label}</text>
                  </g>
                ))}
                {geo.columns.map((col) =>
                  col.missing ? (
                    <rect
                      key={`void${col.index}`}
                      className="ov5-trend-void"
                      x={col.cx - col.w / 2}
                      y={TREND_PAD.t}
                      width={col.w}
                      height={geo.plot.h}
                      rx={2}
                    />
                  ) : (
                    <g key={`bar${col.index}`}>
                      <rect className="ov5-trend-bar" x={col.x} y={col.y ?? 0} width={col.w} height={col.h} rx={2} />
                      {col.failH > 0 ? (
                        <rect
                          className="ov5-trend-fail"
                          x={col.x}
                          y={(col.y ?? 0) + col.h - col.failH}
                          width={col.w}
                          height={col.failH}
                          rx={2}
                        />
                      ) : null}
                    </g>
                  ),
                )}
                {geo.peakAt ? (
                  <g>
                    <line
                      className="ov5-peak-mark"
                      x1={geo.columns[geo.peakAt.index].cx}
                      x2={geo.columns[geo.peakAt.index].cx}
                      y1={TREND_PAD.t - 8}
                      y2={TREND_PAD.t + geo.plot.h}
                    />
                    <circle className="ov5-peak-dot" cx={geo.columns[geo.peakAt.index].cx} cy={TREND_PAD.t - 8} r={2.4} />
                    <text className="ov5-axis-lbl" x={geo.columns[geo.peakAt.index].cx} y={TREND_PAD.t - 11} textAnchor="middle">峰值</text>
                  </g>
                ) : null}
                {geo.columns.map((col) =>
                  col.showLabel ? (
                    <text key={`ax${col.index}`} className="ov5-axis-lbl" x={col.cx} y={TREND_H - 6} textAnchor="middle">{col.label}</text>
                  ) : null,
                )}
              </svg>
              <div className="ov5-bars">
                {points.map((point, i) => (
                  <div
                    className={point.runs === null ? 'ov5-bar is-missing' : 'ov5-bar'}
                    key={point.label}
                    title={
                      point.runs === null
                        ? `${point.label} · 当日运行数未返回，显示 —`
                        : `${point.label} · ${point.runs} 次运行 · 失败 ${point.failed ?? '—'}`
                    }
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <span className="ov5-bar-track">
                      {point.runs === null ? null : (
                        <i style={{ height: `${Math.max(4, Math.round((point.runs / max) * 100))}%` }} />
                      )}
                    </span>
                    <em>{point.label}</em>
                  </div>
                ))}
              </div>
              <div className="ov5-tip" data-testid="ov6-trend-tip" role="status" aria-live="polite">
                {active ? (
                  <>
                    <span className="ov5-tip-k">{active.label}</span>
                    <span>运行 <b>{active.runs === null ? '—' : active.runs}</b> 次</span>
                    <span>失败 <b>{active.failed === null ? '—' : active.failed}</b></span>
                  </>
                ) : (
                  <span className="ov5-tip-k">把指针停在某一天上读当日读数</span>
                )}
              </div>
            </div>
            <p className="ov5-block-foot">柱高表示当日运行次数；失败次数在悬停说明里，柱内深色段即其中失败。</p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ============================================================================
 * ④ 活动热力：7 行 × 24 列（基线 buildHeat()），仅 count、无失败维度；
 *    缺读数的格子留空面，不当 0。
 * ========================================================================== */
function Heat({ activity, label, onRetry }: { activity: Loadable<ActivityBody>; label: string; onRetry: () => void }) {
  const matrix: HeatMatrix | null = activity.k === 'ready' ? heatMatrix(activity.data.cells) : null;
  const gridW = HEAT.labelW + 24 * (HEAT.cell + HEAT.gap) - HEAT.gap;
  const gridH = HEAT.axisH + 7 * (HEAT.cell + HEAT.gap) - HEAT.gap;
  const peakDay = matrix?.peak ? matrix.rows.find((row) => row.dow === matrix.peak?.dow)?.label ?? '—' : '—';
  const hourLabel = (hour: number) => (hour < 10 ? `0${hour}` : `${hour}`);
  return (
    <Card className="ov5-block ov5-heat" data-testid="ov6-heat">
      <CardContent className="ov5-block-bd">
        <div className="ov5-block-hd">
          <h2>
            <IconActivity className="ov5-i ov5-i-16" />
            活动热力
            <span className="ov5-hd-note">{label} · 行＝星期，列＝小时</span>
          </h2>
          <Source>运行活跃</Source>
        </div>
        <Freshness items={[{ source: '运行活跃', state: activity }]} testid="ov6-heat-stamp" />
        {activity.k === 'loading' ? (
          <div className="ov5-skeleton" aria-busy="true" aria-label="活动热力加载中"><span /><span /><span /></div>
        ) : activity.k === 'error' ? (
          <div className="ov5-inline-error" role="alert">
            <IconAlert className="ov5-i ov5-i-16" />
            <span>活动热力没有读出来。</span>
            <RequestId id={activity.requestId} />
            <Button size="sm" outlined onClick={onRetry} data-testid="ov6-heat-retry">重试</Button>
          </div>
        ) : !matrix || !matrix.hasRead ? (
          <div className="ov5-empty-line">
            <IconInbox className="ov5-i ov5-i-16" />
            <span>{label}没有运行活跃读数，热力不画空格。</span>
            <Link to="/runs?window=7d">去看运行记录<IconArrowRight className="ov5-i ov5-i-14" /></Link>
          </div>
        ) : (
          <>
            <div className="ov5-heat-wrap">
              <svg
                className="ov5-heat-svg"
                viewBox={`0 0 ${gridW} ${gridH}`}
                role="img"
                aria-label={`按星期与小时统计的运行次数热力图，${label}合计 ${matrix.total} 次`}
              >
                {Array.from({ length: 24 }, (_, hour) =>
                  hour % 3 === 0 ? (
                    <text
                      key={`h${hour}`}
                      className="ov5-heat-ax"
                      x={HEAT.labelW + hour * (HEAT.cell + HEAT.gap) + HEAT.cell / 2}
                      y={HEAT.axisH - 6}
                      textAnchor="middle"
                    >
                      {hourLabel(hour)}
                    </text>
                  ) : null,
                )}
                {matrix.rows.map((row, r) => (
                  <g key={`d${row.dow}`}>
                    <text
                      className="ov5-heat-hl"
                      x={HEAT.labelW - 8}
                      y={HEAT.axisH + r * (HEAT.cell + HEAT.gap) + HEAT.cell / 2 + 4}
                      textAnchor="end"
                    >
                      {row.label}
                    </text>
                    {row.cells.map((cell) => (
                      <rect
                        key={`c${cell.hour}`}
                        className={cell.count === null ? 'ov5-heat-cell is-void' : `ov5-heat-cell ov5-heat-lv${cell.level}`}
                        x={HEAT.labelW + cell.hour * (HEAT.cell + HEAT.gap)}
                        y={HEAT.axisH + r * (HEAT.cell + HEAT.gap)}
                        width={HEAT.cell}
                        height={HEAT.cell}
                        rx={4}
                      >
                        <title>{`${row.label} ${hourLabel(cell.hour)}:00 · ${cell.count === null ? '没有读数' : `${cell.count} 次（${label}合计 ${matrix.total} 次）`}`}</title>
                      </rect>
                    ))}
                  </g>
                ))}
              </svg>
            </div>
            <div className="ov5-heat-side">
              <div className="ov5-hs">
                <div className="ov5-hs-l">
                  <span className="ov5-micro">峰值时段</span>
                  <b>{matrix.peak ? matrix.peak.count : '—'}<span className="ov5-hs-u">次/时</span></b>
                </div>
                <div className="ov5-hs-d">
                  {matrix.peak ? `${peakDay} ${hourLabel(matrix.peak.hour)}:00–${hourLabel(matrix.peak.hour)}:59` : '窗口内没有运行'}
                </div>
              </div>
              <div className="ov5-hs">
                <div className="ov5-hs-l">
                  <span className="ov5-micro">夜间批量</span>
                  <b>{matrix.nightAvg === null ? '—' : matrix.nightAvg.toFixed(2)}<span className="ov5-hs-u">次/时</span></b>
                </div>
                <div className="ov5-hs-d">0–6 点每小时均值</div>
              </div>
              <div className="ov5-hs">
                <div className="ov5-hs-l">
                  <span className="ov5-micro">{label}合计</span>
                  <b>{matrix.total}</b>
                </div>
                <div className="ov5-hs-d">仅按运行次数着色，无失败维度</div>
              </div>
            </div>
            <div className="ov5-heat-foot">
              <span className="ov5-hscale">
                <span>少</span>
                <HeatScale />
                <span>多</span>
              </span>
              <span className="ov5-hscale">每格＝1 小时 · 颜色只表运行次数 · 悬停读具体值</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivity({ data, onRetry }: { data: DutyData; onRetry: () => void }) {
  const runs = data.recentRuns;
  return (
    <Card className="ov5-block" data-testid="ov6-activity" data-duty-testid="duty-activity">
      <CardContent className="ov5-block-bd">
        <div className="ov5-block-hd">
          <h2>
            <IconPulse className="ov5-i ov5-i-16" />
            最近活动
          </h2>
          {/* OM-07：卡数据腿固定近 7 天（fetchRuns limit=3 + w7.from），
              「全部运行」带 window=7d 与卡同窗（runs 页读 window|status|state|run|employee）。 */}
          <Link to="/runs?window=7d">全部运行<IconArrowRight className="ov5-i ov5-i-14" /></Link>
        </div>
        <Freshness items={[{ source: '运行记录', state: runs }]} testid="ov6-activity-stamp" />
        {runs.k === 'loading' ? (
          <div className="ov5-skeleton" aria-busy="true" aria-label="最近活动加载中"><span /><span /><span /></div>
        ) : runs.k === 'error' ? (
          <div className="ov5-inline-error" role="alert">
            <IconAlert className="ov5-i ov5-i-16" />
            <span>最近活动没有读出来。</span>
            <RequestId id={runs.requestId} />
            <Button size="sm" outlined onClick={onRetry} data-testid="ov6-activity-retry">重试</Button>
          </div>
        ) : runs.data.length === 0 ? (
          <div className="ov5-empty-line">
            <IconInbox className="ov5-i ov5-i-16" />
            <span>近 7 天没有运行记录。</span>
            <Link to="/employees">去看数字员工<IconArrowRight className="ov5-i ov5-i-14" /></Link>
          </div>
        ) : (
          <ul className="ov5-rows">
            {runs.data.slice(0, 3).map((run) => (
              <li key={run.runId} data-testid="ov6-activity-row">
                <Link to={`/runs/${encodeURIComponent(run.runId)}`} title={run.runId}>
                  {run.employeeId ? employeeLabel(undefined, run.employeeId) : `运行 ${shortId(run.runId)}`}
                </Link>
                <Badge
                  tone={run.status === 'failed' ? 'destructive' : run.status === 'completed' ? 'success' : 'outline'}
                  // OM-07 状态四词表封闭：成功/失败/运行中/—；未知原值不进徽标文本，落 title 供核对。
                  title={run.status && !['failed', 'completed', 'running'].includes(run.status) ? `上游状态：${run.status}` : undefined}
                >
                  {run.status === 'failed' ? '失败' : run.status === 'completed' ? '成功' : run.status === 'running' ? '运行中' : '—'}
                </Badge>
                <span className="ov5-mono">{beijing(run.startedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Blockers({ data, onRetry }: { data: DutyData; onRetry: () => void }) {
  const failed = data.failedRuns.k === 'ready' ? data.failedRuns.data : null;
  const tasks = data.blockedTasks.k === 'ready' ? data.blockedTasks.data : null;
  const approvals = data.approvals.k === 'ready' ? data.approvals.data : null;
  const rows = data.recentRuns.k === 'loading' ? [] : blockerRows({ failedRuns: failed, blockedTasks: tasks, approvals });
  const blockSources = [
    { source: '失败运行', state: data.failedRuns },
    { source: '阻塞任务', state: data.blockedTasks },
    { source: '待审批', state: data.approvals },
  ];
  const unavailable = blockSources.some(({ state }) => state.k === 'error');
  const firstBlockError = blockSources.map(({ state }) => state).find((state) => state.k === 'error');
  return (
    <Card className="ov5-block" data-testid="ov6-blockers" data-duty-testid="duty-blockers">
      <CardContent className="ov5-block-bd">
        <div className="ov5-block-hd">
          <h2>
            <IconAlert className="ov5-i ov5-i-16" />
            阻塞队列
          </h2>
          <Source>失败运行 / 阻塞任务 / 待审批</Source>
        </div>
        <Freshness items={blockSources} testid="ov6-blockers-stamp" />
        {unavailable ? (
          <div className="ov5-inline-error" role="alert">
            <span>有阻塞源未接入，下面是已读到的部分，不代表全部。</span>
            <RequestId id={firstBlockError?.k === 'error' ? firstBlockError.requestId : null} />
            <Button size="sm" outlined onClick={onRetry} data-testid="ov6-blockers-retry">重试</Button>
          </div>
        ) : null}
        {rows.length === 0 ? (
          <div className="ov5-empty-line">
            <IconInbox className="ov5-i ov5-i-16" />
            <span>当前没有读到阻塞项。</span>
            <Link to="/approvals">去审批中心<IconArrowRight className="ov5-i ov5-i-14" /></Link>
          </div>
        ) : (
          <ul className="ov5-rows ov5-rows-blocker">
            {rows.map((row) => (
              <li key={`${row.responsibleModule}-${row.object}`}>
                <Badge tone={row.overSLA ? 'destructive' : 'warning'}>{row.responsibleModule}</Badge>
                <span className="ov5-obj">{row.object}</span>
                <span>{row.waitingOn}</span>
                {row.href ? <Link to={row.href}>处理<IconArrowRight className="ov5-i ov5-i-14" /></Link> : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function OverviewView({
  data,
  matrix,
  probe,
  loading,
  onRetry,
  rangeId = DEFAULT_DUTY_RANGE,
  onRange,
  rangeInvalid = null,
}: {
  data: DutyData;
  matrix: Loadable<MatrixBody>;
  /** OM-15：服务探针读数（hermes-summary）；缺席按读取中，不猜测。 */
  probe?: Loadable<HermesSummaryBody>;
  loading: boolean;
  onRetry: () => void;
  /** OM-04：?range= 四档窗口；onRange 缺席时（夹具直渲染）不画分段控件。 */
  rangeId?: DutyRangeId;
  onRange?: (id: DutyRangeId) => void;
  rangeInvalid?: string | null;
}) {
  const range = dutyRange(rangeId);
  const stats = data.stats.k === 'ready' ? data.stats.data : null;
  const today = data.todayStats.k === 'ready' ? data.todayStats.data : null;
  const budgetDay = data.budgetDay.k === 'ready' ? data.budgetDay.data : null;
  const budgetMonth = data.budgetMonth.k === 'ready' ? data.budgetMonth.data : null;
  const approvalStats = data.approvalStats.k === 'ready' ? data.approvalStats.data : null;
  const employees = data.employees.k === 'ready' ? data.employees.data.length : null;
  const kpis = buildKpis({
    stats,
    todayStats: today,
    approvalStats,
    budgetDay,
    budgetMonth,
    totalEmployeesFallback: employees,
    matrix,
  });
  // OM-17：只有「运行」卡有真时间序列（stats14 桶）；其余四卡无趋势源 → 点阵，不画假曲线。
  const sparkValues =
    data.stats14.k === 'ready'
      ? trendPoints(data.stats14.data, range.days)
          .map((point) => point.runs)
          .filter((value): value is number => value !== null)
      : [];
  const hasSpark = sparkValues.length >= 2;
  // OM-19 T2D：待审批视角三态——真 0=success、有数=attention、读不到=missing；dot 永不 bg-*-900。
  // 注意：局部 approvalStats 是解包值（可 null），判态必须走 data.approvalStats。
  const pendingLoadable = data.approvalStats;
  const pendingAppearance =
    pendingLoadable.k === 'ready'
      ? kpis.pending === 0
        ? 'success'
        : kpis.pending !== null
          ? 'attention'
          : 'missing'
      : 'missing';
  const pendingDegraded =
    pendingLoadable.k === 'ready' && Array.isArray(pendingLoadable.data.degraded)
      ? pendingLoadable.data.degraded
      : [];
  const healthSources = [
    { label: '员工统计', state: data.employees },
    { label: '运行统计', state: data.stats },
    { label: '今日运行', state: data.todayStats },
    { label: '审批统计', state: data.approvalStats },
    { label: '成本账本', state: data.budgetDay },
    { label: '风险矩阵', state: matrix },
  ];
  const coreStates = [data.employees, data.stats, data.todayStats, data.approvalStats, data.budgetDay];
  const allError = coreStates.every((state) => state.k === 'error');
  const anyLoading = coreStates.some((state) => state.k === 'loading');
  const firstError = coreStates.find((state) => state.k === 'error');

  // OM-15：健康卡两段式——服务探针真读数（gateway.status/updated_at），本页读数只做合成脚注。
  const probeState: Loadable<HermesSummaryBody> = probe ?? { k: 'loading' };
  const probeGateway = probeState.k === 'ready' ? probeState.data.gateway : null;
  const probeUpdatedAt =
    probeGateway && typeof probeGateway.updated_at === 'string' && probeGateway.updated_at
      ? probeGateway.updated_at
      : null;
  const probeStatus =
    probeGateway && typeof probeGateway.status === 'string' && probeGateway.status
      ? probeGateway.status
      : null;
  const probeForStamp: Loadable<unknown> =
    probeState.k === 'ready' ? { k: 'ready', data: { asOf: probeUpdatedAt } } : (probeState as Loadable<unknown>);
  const probeText = probeStatus
    ? HEALTH_LABEL[probeStatus] ?? probeStatus
    : probeState.k === 'error'
      ? '未接'
      : '—';

  // OM-13：摘要复制——纯函数拼文本，不新增请求、不做金额反推，缺值一律「—」。
  const asOfShown = (state: { k: string } | null | undefined): string | null =>
    state && state.k === 'ready' ? sourceStamp(state as Loadable<unknown>).shown : null;
  const summaryRows: OverviewSummaryRow[] = [
    {
      label: '员工',
      value: `在编 ${dashed(kpis.total)} · 在岗 ${dashed(kpis.active)} · 有风险 ${dashed(kpis.atRisk)}`,
      source: '员工统计 / 风险矩阵',
      stamp: [sourceStamp(data.stats).shown, sourceStamp(matrix).shown].filter(Boolean).sort().pop() ?? null,
    },
    {
      label: '今日运行',
      value: `今日 ${dashed(kpis.runs)} · 失败 ${dashed(kpis.failed)} · 失败率 ${kpis.failureRate === null ? '—' : `${kpis.failureRate}%`}`,
      source: '运行统计（今日）',
      stamp: sourceStamp(data.todayStats).shown,
    },
    { label: '待审批', value: dashed(kpis.pending), source: '审批统计', stamp: sourceStamp(data.approvalStats).shown },
    {
      label: '今日成本',
      value: kpis.costUsd === null ? '—' : usd(kpis.costUsd),
      source: '成本账本（日）',
      stamp: sourceStamp(data.budgetDay).shown,
    },
    { label: '健康检查（服务探针）', value: probeText, source: 'GET /api/hermes-summary', stamp: sourceStamp(probeForStamp).shown },
  ];
  const summaryAsOf =
    [
      asOfShown(data.stats), asOfShown(data.todayStats), asOfShown(data.approvalStats),
      asOfShown(data.budgetDay), asOfShown(probeForStamp),
    ]
      .filter((s): s is string => Boolean(s))
      .sort()
      .pop() ?? null;
  const summaryRowsKey = summaryRows.map((r) => `${r.label}|${r.value}|${r.source}|${r.stamp}`).join(';');
  const summaryText = useMemo(
    () => overviewSummaryText({ asOf: summaryAsOf, rows: summaryRows, costCaliber: COST_CALIBER_TEXT }),
    // rows 每次渲染重建，以序列化键比较避免无谓重算；不读浏览器时钟。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [summaryAsOf, summaryRowsKey],
  );
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const fallbackRef = useRef<HTMLTextAreaElement | null>(null);
  const copySummary = useCallback(() => {
    const fail = () => {
      setCopyState('fail');
      try {
        fallbackRef.current?.focus();
        fallbackRef.current?.select();
      } catch {
        // jsdom 没有实现 select，忽略。
      }
    };
    if (typeof navigator.clipboard?.writeText === 'function') {
      navigator.clipboard.writeText(summaryText).then(
        () => setCopyState('ok'),
        fail,
      );
    } else {
      fail();
    }
  }, [summaryText]);

  const allReady = coreStates.every((state) => state.k === 'ready');
  if (allReady && kpis.total === 0 && kpis.runs === 0 && kpis.pending === 0) {
    return (
      <section className="ov5-page" data-testid="ov6-page">
        <Card className="ov5-empty-card" data-testid="ov6-empty"><CardContent>
          <h1>还没有可汇总的数据</h1>
          <p>员工、运行与审批都为空时，总览没有数字可展示。</p>
          <AsofLine states={coreStates} />
          <Link to="/employees">先看数字员工<IconArrowRight className="ov5-i ov5-i-14" /></Link>
        </CardContent></Card>
      </section>
    );
  }

  if (allError) {
    return (
      <section className="ov5-page" data-testid="ov6-page">
        <Card className="ov5-error-card" data-testid="ov6-error" role="alert">
          <CardContent>
            <div className="ov5-inline-error">
              <IconAlert className="ov5-i ov5-i-20" />
              <b>总览没能读出来</b>
            </div>
            <p>这次聚合的所有来源都没有返回数据，页面没有编造任何数字。</p>
            <AsofLine states={coreStates} />
            <RequestId id={firstError?.requestId ?? null} />
            <Button size="sm" outlined onClick={onRetry} prefix={<IconRefresh className="ov5-i ov5-i-14" />} data-testid="ov6-retry">重试</Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="ov5-page" data-testid="ov6-page">
      <header className="ov5-head">
        <div className="ov5-head-main">
          <p className="ov5-eyebrow">运营 · 控制台</p>
          <h1>运营总览</h1>
          <p className="ov5-sub">员工、运行、审批与成本各读各的；缺失值显示「—」，不补零。</p>
        </div>
        <div className="ov5-head-actions">
          {onRange ? (
            <div className="ov5-seg" role="group" aria-label="时间窗" data-testid="ov6-range-seg">
              {DUTY_RANGES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  data-testid={`ov6-range-${r.id}`}
                  aria-pressed={r.id === rangeId}
                  className={r.id === rangeId ? 'ov5-seg-btn is-active' : 'ov5-seg-btn'}
                  onClick={() => onRange(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          ) : null}
          {rangeInvalid ? (
            <span
              className="ov5-range-fallback"
              data-testid="ov6-range-fallback"
              title={`时间窗参数「${rangeInvalid}」不是可用档位，已按「${range.label}」读取`}
            >
              窗口参数无效，按{range.label}读取
            </span>
          ) : null}
          <span className="ov5-copy" data-testid="ov6-summary-copy-wrap">
            <Button size="sm" outlined prefix={<IconCopy className="ov5-i ov5-i-14" />} data-testid="ov6-summary-copy" onClick={copySummary}>复制摘要</Button>
            {copyState === 'ok' ? (
              <span role="status" data-testid="ov6-summary-copy-ok">
                <IconCheck className="ov5-i ov5-i-13" />
                已复制到剪贴板
              </span>
            ) : null}
            {copyState === 'fail' ? <span role="status" data-testid="ov6-summary-copy-fail">复制失败：已选中摘要文本，可手动复制。</span> : null}
          </span>
        </div>
        <Button size="sm" outlined onClick={onRetry} disabled={loading || anyLoading} aria-busy={loading || anyLoading} data-testid="ov6-refresh" prefix={<IconRefresh className={`ov5-i ov5-i-14 ${loading || anyLoading ? 'ov5-spin' : ''}`} />}>
          刷新
        </Button>
      </header>

      {copyState === 'fail' ? (
        <textarea
          ref={fallbackRef}
          readOnly
          rows={6}
          aria-label="总览摘要文本"
          data-testid="ov6-summary-fallback"
          value={summaryText}
        />
      ) : null}

      <AsofLine states={[data.stats, data.todayStats, data.employees, data.approvalStats, data.budgetDay]} />

      {anyLoading ? <div className="ov5-skeleton" aria-busy="true" aria-label="总览加载中" data-testid="ov6-loading"><span /><span /><span /></div> : null}

      <div className="ov5-kpis">
        <KpiCard
          title="员工"
          value={dashed(kpis.total)}
          foot={<>在岗 <b>{dashed(kpis.active)}</b> · 有风险 <b>{dashed(kpis.atRisk)}</b></>}
          source="员工统计 / 风险矩阵"
          stamps={[{ source: '员工统计', state: data.stats }, { source: '风险矩阵', state: matrix }]}
          testid="ov6-kpi-employees"
          issues={[{ label: '员工统计', state: data.employees, gap: OVERVIEW_GAP.employees }, ...(matrix.k === 'error' ? [{ label: '风险矩阵', state: matrix, gap: OVERVIEW_GAP.risk }] : [])]}
          onRetry={onRetry}
          note={kpis.atRisk === null ? '风险口径未接入' : null}
          noteTitle={kpis.atRisk === null ? OVERVIEW_GAP.risk : undefined}
          icon={<IconUsers className="ov5-i ov5-i-14" />}
          viz={<NoTrendDots />}
          delta={<Delta>无对比源 · 只读当前在编与在岗</Delta>}
        />
        <KpiCard
          title="今日运行"
          value={dashed(kpis.runs)}
          foot={<>失败 <b>{dashed(kpis.failed)}</b> · 失败率 <b>{kpis.failureRate === null ? '—' : `${kpis.failureRate}%`}</b></>}
          source="运行统计（今日）"
          stamps={[{ source: '运行统计', state: data.todayStats }]}
          testid="ov6-kpi-runs"
          issues={[{ label: '运行统计', state: data.todayStats, gap: OVERVIEW_GAP.runs }]}
          onRetry={onRetry}
          note={kpis.runs === 0 && kpis.failureRate === null ? '今天还没有运行，失败率不计算' : null}
          noteTitle={kpis.runs === 0 && kpis.failureRate === null ? OVERVIEW_GAP.runs : undefined}
          icon={<IconGauge className="ov5-i ov5-i-14" />}
          viz={hasSpark ? <SparkArea values={sparkValues} label={`${range.label}每日运行次数火花线`} /> : <NoTrendDots />}
          delta={<Delta>{hasSpark ? `${range.label}火花线 · 共 ${sparkValues.length} 个有读数的日子` : '无趋势源'}</Delta>}
        />
        <KpiCard
          title="待审批"
          value={
            <span
              className={`ov5-pending-seg${pendingAppearance === 'success' ? ' tone-success' : pendingAppearance === 'attention' ? ' tone-attention' : ''}`}
              data-testid="ov6-pending-seg"
            >
              <span className="ov5-dot" data-appearance={pendingAppearance} aria-hidden />
              {dashed(kpis.pending)}
            </span>
          }
          foot={<Link to="/approvals">去审批中心<IconArrowRight className="ov5-i ov5-i-14" /></Link>}
          source="审批统计"
          stamps={[{ source: '审批统计', state: data.approvalStats }]}
          testid="ov6-kpi-pending"
          issues={[{ label: '审批统计', state: data.approvalStats, gap: OVERVIEW_GAP.approvals }]}
          onRetry={onRetry}
          note={pendingDegraded.length > 0 ? `上游降级 ${pendingDegraded.length} 路（${pendingDegraded.join('、')}）；此数只覆盖已接通上游，BFF 未给上游总数。` : null}
          noteTitle={OVERVIEW_GAP.approvals}
          icon={<IconShield className="ov5-i ov5-i-14" />}
          viz={<NoTrendDots />}
          delta={<Delta>无趋势源 · 只读当前待办</Delta>}
        />
        <KpiCard
          title="今日成本"
          value={kpis.costUsd === null ? '—' : usd(kpis.costUsd)}
          foot={kpis.costPartial ? <>账本未覆盖全部员工{kpis.costMissing > 0 ? `（${kpis.costMissing} 人缺账本）` : ''}</> : <>美元 · 账本实扣</>}
          source="成本账本（日）"
          stamps={[{ source: '成本账本', state: data.budgetDay }]}
          testid="ov6-kpi-cost"
          issues={[{ label: '成本账本', state: data.budgetDay, gap: OVERVIEW_GAP.cost }]}
          onRetry={onRetry}
          note={kpis.costUsd === null ? '成本口径未齐' : null}
          noteTitle={kpis.costUsd === null ? OVERVIEW_GAP.cost : undefined}
          icon={<IconCoins className="ov5-i ov5-i-14" />}
          viz={<NoTrendDots />}
          delta={<Delta>无趋势源 · 账本实扣，不按单价反推</Delta>}
        />
        <KpiCard
          title="健康检查（服务探针）"
          value={probeText}
          foot={<span>{healthSources.every((s) => s.state.k === 'ready') ? '本页六路读数全部就绪' : healthSources.filter((s) => s.state.k !== 'ready').map((s) => `${s.label}未就绪`).join(' · ')}（本页读数合成状态，不等于服务健康）</span>}
          source="GET /api/hermes-summary"
          stamps={[{ source: '服务探针', state: probeForStamp }]}
          testid="ov6-kpi-health"
          issues={probeState.k === 'error' ? [{ label: '服务探针', state: probeState as Loadable<unknown>, gap: OVERVIEW_GAP.health }] : []}
          onRetry={onRetry}
          note={probeState.k === 'ready' && !probeStatus ? '服务探针未返回状态；不以本页读数冒充。' : null}
          noteTitle={OVERVIEW_GAP.health}
          icon={<IconPulse className="ov5-i ov5-i-14" />}
          viz={<NoTrendDots />}
          delta={<Delta>无趋势源 · 服务探针只有当前读数</Delta>}
        />
      </div>

      <div className="ov5-grid">
        <Trend stats={data.stats14} label={range.label} days={range.days} onRetry={onRetry} />
        <Heat activity={data.activity} label={range.label} onRetry={onRetry} />
        <RecentActivity data={data} onRetry={onRetry} />
        <Blockers data={data} onRetry={onRetry} />
      </div>
    </section>
  );
}

function LiveOverview({ rangeId, onRange, rangeInvalid }: { rangeId: DutyRangeId; onRange: (id: DutyRangeId) => void; rangeInvalid: string | null }) {
  // OM-17：本页新增活动热力（7×24），活动腿改为按档位真读（weeks 随 range 走）；
  // DutyPage 的默认档不受影响。
  const { data, reload, loading } = useDutyData(rangeId, { activity: true });
  const [matrix, setMatrix] = useState<Loadable<MatrixBody>>({ k: 'loading' });
  // OM-15：服务探针独立腿；取不到就显示未接，不拿本页读数冒充服务健康。
  const [probe, setProbe] = useState<Loadable<HermesSummaryBody>>({ k: 'loading' });

  const loadMatrix = useCallback(() => {
    setMatrix({ k: 'loading' });
    void load(fetchMatrix).then(setMatrix);
  }, []);

  const loadProbe = useCallback(() => {
    setProbe({ k: 'loading' });
    void load(fetchHermesSummary).then(setProbe);
  }, []);

  useEffect(() => {
    loadMatrix();
    loadProbe();
  }, [loadMatrix, loadProbe]);

  const retry = useCallback(() => {
    loadMatrix();
    loadProbe();
    reload();
  }, [loadMatrix, loadProbe, reload]);

  const hasError =
    matrix.k === 'error' || probe.k === 'error' || Object.values(data).some((state) => state.k === 'error');

  // The domain service can restart underneath us. Keep one quiet retry in
  // flight while any source is down so a recovered service fills in without
  // a manual reload; a click on retry simply restarts the same path.
  useEffect(() => {
    if (!hasError) return;
    const timer = window.setTimeout(retry, 20_000);
    return () => window.clearTimeout(timer);
  }, [hasError, retry]);

  return <OverviewView data={data} matrix={matrix} probe={probe} loading={loading} onRetry={retry} rangeId={rangeId} onRange={onRange} rangeInvalid={rangeInvalid} />;
}

export function OverviewPage() {
  const [params, setParams] = useSearchParams();
  const forcedRaw = (params.get('state') ?? '').toLowerCase();
  const forced: Forced | null =
    forcedRaw === 'loading' || forcedRaw === 'empty' || forcedRaw === 'error'
      ? (forcedRaw as Forced)
      : null;

  // OM-04：?range= 深链四档（24h/7d/14d/30d，复用 duty 的 DUTY_RANGES 表，
  // 勿新建常量）。非法值回落默认档，并在页面顶部以 title 说明。
  const rangeRaw = params.get('range');
  const rangeId = parseDutyRange(rangeRaw);
  const rangeInvalid = rangeRaw !== null && rangeRaw !== rangeId ? rangeRaw : null;
  const setRange = (id: DutyRangeId) => {
    const next = new URLSearchParams(params);
    next.set('range', id);
    setParams(next, { replace: true });
  };

  const clearForced = () => {
    const next = new URLSearchParams(params);
    next.delete('state');
    setParams(next, { replace: true });
  };

  if (forced === 'loading') {
    return (
      <section className="ov5-page" data-testid="ov6-page" data-fixture="1">
        <div className="ov5-skeleton" aria-busy="true" aria-label="总览加载中" data-testid="ov6-loading"><span /><span /><span /></div>
      </section>
    );
  }
  if (forced === 'empty') {
    return (
      <section className="ov5-page" data-testid="ov6-page" data-fixture="1">
        <Card className="ov5-empty-card" data-testid="ov6-empty"><CardContent>
          <h1>还没有可汇总的数据</h1>
          <p>员工、运行与审批都为空时，总览没有数字可展示。</p>
          <AsofLine states={[]} />
          <Link to="/employees">先看数字员工<IconArrowRight className="ov5-i ov5-i-14" /></Link>
        </CardContent></Card>
      </section>
    );
  }
  if (forced === 'error') {
    return (
      <section className="ov5-page" data-testid="ov6-page" data-fixture="1">
        <Card className="ov5-error-card" data-testid="ov6-error" role="alert"><CardContent>
          <div className="ov5-inline-error"><IconAlert className="ov5-i ov5-i-20" /><b>总览没能读出来</b></div>
          <p>这次聚合的所有来源都没有返回数据，页面没有编造任何数字。</p>
            <AsofLine states={[]} />
          <RequestId id={null} />
          <Button size="sm" outlined onClick={clearForced} data-testid="ov6-retry">重试</Button>
        </CardContent></Card>
      </section>
    );
  }
  return <LiveOverview rangeId={rangeId} onRange={setRange} rangeInvalid={rangeInvalid} />;
}

export default OverviewPage;