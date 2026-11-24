import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Badge } from '@nous-research/ui/ui/components/badge';
import { Button } from '@nous-research/ui/ui/components/button';
import { Card, CardContent } from '@nous-research/ui/ui/components/card';

import { fetchMatrix, load } from '../duty/api';
import { buildReadiness, buildCost } from '../duty/aggregate';
import { beijing, dashed, duration, shortId, usd } from '../duty/format';
import { useDutyData, type DutyData } from '../duty/useDutyData';
import { DUTY_RANGES, DEFAULT_DUTY_RANGE, dutyRange, parseDutyRange, type DutyRangeId } from '../duty/dutyRange';
import type { ActivityBody, EmployeeRow, Loadable, MatrixBody, RunRow, RunStatsBody } from '../duty/types';
import {
  buildKpis,
  blockerRows,
  dayActivity,
  monthQuota,
  overviewSummaryText,
  sourceStamp,
  trendWindow,
  OVERVIEW_GAP,
  type OverviewSummaryRow,
} from './overview';
import { fetchHermesSummary, type HermesSummaryBody } from './api';
import { COST_CALIBER_TEXT } from '../metrics/costCaliberNote';
import { TREND_H, TREND_PAD, trendGeometry } from './VizChart';
import './overview.css';

type Forced = 'loading' | 'empty' | 'error';
type StampSource = { source: string; state: Loadable<unknown> };

// OM-15：服务探针状态词表——只翻译 hermes-summary 真读数，没有读数就是未接。
const HEALTH_LABEL: Record<string, string> = { ok: '正常', degraded: '降级', down: '异常' };

const RUN_STATUS_LABEL: Record<string, string> = {
  completed: '成功',
  succeeded: '成功',
  failed: '失败',
  running: '运行中',
};

/* ============================================================================
 * 页内图标基元：内联 <svg><path/></svg>，几何 24×24，描边 1.8，
 * currentColor 随文字色走主题，不写内联 style。
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

function IconServer({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <rect x="3.4" y="4.2" width="17.2" height="6" rx="1.8" />
      <rect x="3.4" y="13.8" width="17.2" height="6" rx="1.8" />
      <path d="M7 7.2h.01M7 16.8h.01" />
    </svg>
  );
}

function IconSend({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <path d="M21 3.6 10.4 14.2" />
      <path d="M21 3.6 14.3 21l-3.9-6.8L3.6 10.3Z" />
    </svg>
  );
}

function IconBook({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <path d="M4 5.2A2 2 0 0 1 6 3.2h13.4v17.6H6a2 2 0 0 0-2 2Z" />
      <path d="M4 5.2v15.6" />
      <path d="M8.4 7.6h7" />
    </svg>
  );
}

function IconRocket({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <path d="M12 3.2c3.4 1.6 5.4 5 5.4 8.6 0 2.6-1 4.9-2.8 6.6H9.4A9.6 9.6 0 0 1 6.6 11.8c0-3.6 2-7 5.4-8.6Z" />
      <circle cx="12" cy="9.4" r="1.8" />
      <path d="M8.4 18.4c-.8 1.2-1 2.4-1 2.4s1.4-.2 2.6-1M15.6 18.4c.8 1.2 1 2.4 1 2.4s-1.4-.2-2.6-1" />
    </svg>
  );
}

/* ============================================================================
 * 图表基元
 * ========================================================================== */

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

function RequestId({ id }: { id: string | null }) {
  const [copied, setCopied] = useState(false);
  const text = id ?? '未提供';
  const copy = async () => {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimer();
    } catch {
      setCopied(false);
    }
  };
  const setTimer = () => window.setTimeout(() => setCopied(false), 1800);
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

/** 区块卡脚注：一句口径 + 一行弱色采集时刻，并成一块，避免上下各占一行。 */
function BlockFoot({ children, items, testid }: { children: ReactNode; items: StampSource[]; testid?: string }) {
  return (
    <div className="ov5-block-footrow">
      <p className="ov5-block-foot">{children}</p>
      <Freshness items={items} testid={testid} />
    </div>
  );
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
        <IconClock className="ov5-i ov5-i-13" />
        <span>{`采集时刻 北京时间 ${newest} · 每卡来源见卡内标注`}</span>
      </p>
    );
  }
  const reason = stamps.find((x) => x.reason)?.reason ?? '所有来源都没有返回采集时间';
  return (
    <p className="ov5-fresh" data-testid="ov6-asof" title={`取不到采集时间：${reason}`}>
      <IconClock className="ov5-i ov5-i-13" />
      <span>采集时刻 —（北京时间）</span>
    </p>
  );
}

/**
 * 每张卡只留一行弱色脚注：有采集时刻写「数据截至 X · 来源 A」；没有就写
 * 「采集时刻未返回 · 来源 A」并附原因。其余来源只进 title，不在卡底重复
 * 第二遍「数据截至」（信息量不增，只增高）。
 */
function Freshness({ items, testid }: { items: StampSource[]; testid?: string }) {
  const stamps = items.map(({ source, state }) => ({ source, ...sourceStamp(state) }));
  const primary = stamps.find((stamp) => stamp.shown !== null) ?? stamps[0];
  if (!primary) return <div className="ov5-stamps" data-testid={testid} />;
  const title = stamps
    .map((stamp) => `${stamp.source}：${stamp.shown ?? '采集时刻未返回'}${stamp.reason ? `（${stamp.reason}）` : ''}`)
    .join(' · ');
  return (
    <div className="ov5-stamps" data-testid={testid} title={items.length > 1 ? title : undefined}>
      <span className="ov5-stamp">
        <span>{primary.shown ? `数据截至 ${primary.shown}` : '采集时刻未返回'} · 来源 {primary.source}</span>
        {primary.reason ? <em>原因：{primary.reason}</em> : null}
      </span>
    </div>
  );
}

type KpiIssue = { label: string; state: Loadable<unknown>; gap?: string };

function IssueRows({
  issues,
  onRetry,
  testid,
}: {
  issues?: KpiIssue[];
  onRetry?: () => void;
  testid: string;
}) {
  return (
    <>
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
    </>
  );
}

/* ============================================================================
 * 骨架 3 卡：卡头 11px 微标签 + 右 11px 小链接；数值 26px 等宽；
 * 底部只留一行口径脚注（弱色），不再堆「无趋势源 / 数据截至」三行。
 * ========================================================================== */
function KpiCard({
  title,
  meta,
  value,
  unit,
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
  children,
}: {
  title: string;
  meta?: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  foot?: ReactNode;
  source: string;
  stamps: StampSource[];
  testid: string;
  note?: ReactNode;
  noteTitle?: string;
  issues?: KpiIssue[];
  onRetry?: () => void;
  icon?: ReactNode;
  viz?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card className="ov5-kpi" data-testid={testid} data-duty-testid={testid.replace('ov6-', 'duty-')}>
      <CardContent className="ov5-kpi-bd">
        <div className="ov5-kpi-hd">
          <h2 className="ov5-kpi-title">
            {icon}
            <span>{title}</span>
          </h2>
          {meta ? <span className="ov5-kpi-meta">{meta}</span> : null}
          <Source>{source}</Source>
        </div>
        <div className="ov5-kr">
          <div className="ov5-kpi-value">{value}</div>
          {unit ? <em className="ov5-unit">{unit}</em> : null}
          {viz ? <span className="ov5-kpi-viz">{viz}</span> : null}
        </div>
        {foot ? <p className="ov5-kpi-foot">{foot}</p> : null}
        {children}
        <IssueRows issues={issues} onRetry={onRetry} testid={testid} />
        <div className="ov5-kpi-footline">
          {note ? <span className="ov5-note" title={noteTitle}>{note}</span> : null}
          <Freshness items={stamps} testid={`${testid}-stamp`} />
        </div>
      </CardContent>
    </Card>
  );
}

/* ============================================================================
 * 可上岗：四门表 + 堆叠进度条 + 图例（骨架 hcard 1）
 * ========================================================================== */
function ReadyCard({
  data,
  matrix,
  kpis,
  onRetry,
}: {
  data: DutyData;
  matrix: Loadable<MatrixBody>;
  kpis: ReturnType<typeof buildKpis>;
  onRetry: () => void;
}) {
  const employees = data.employees.k === 'ready' ? data.employees.data : null;
  const stats = data.stats.k === 'ready' ? data.stats.data : null;
  const evidence = data.readiness && data.readiness.k === 'ready' ? data.readiness.data : null;
  const readiness = useMemo(
    () => buildReadiness(employees as EmployeeRow[] | null, stats, evidence),
    [employees, stats, evidence],
  );
  const buckets = readiness.buckets;
  const total = readiness.total ?? kpis.total;
  const denom = total ?? (employees ? employees.length : null);
  const narrowestKey = readiness.narrowest?.key ?? null;
  const failingGates = readiness.gates.filter((gate) => (gate.fail ?? 0) > 0);
  const restricted =
    buckets === null
      ? '四门证据未到'
      : failingGates.length === 0
        ? '无单项超限'
        : failingGates.map((gate) => `${gate.name} ${gate.fail}`).join(' · ');
  const pct = (n: number | null | undefined) =>
    n === null || n === undefined || !denom ? null : Math.round((n / denom) * 1000) / 10;

  return (
    <KpiCard
      title="可上岗"
      meta={`${dashed(denom)} 名 · 四门取交集`}
      value={dashed(readiness.confirmed)}
      unit={`/ ${dashed(denom)} 可上岗`}
      foot={
        <>
          受限 <b>{dashed(buckets?.failing)}</b>：{restricted} · 在岗 <b>{dashed(kpis.active)}</b> · 有风险{' '}
          <b>{dashed(kpis.atRisk)}</b>
        </>
      }
      source="员工统计 / 风险矩阵 / 四门证据"
      stamps={[
        { source: '员工统计', state: data.stats },
        { source: '风险矩阵', state: matrix },
        { source: '四门证据', state: data.readiness ?? { k: 'loading' } },
      ]}
      testid="ov6-kpi-employees"
      issues={[
        { label: '员工统计', state: data.employees, gap: OVERVIEW_GAP.employees },
        ...(matrix.k === 'error' ? [{ label: '风险矩阵', state: matrix, gap: OVERVIEW_GAP.risk }] : []),
      ]}
      onRetry={onRetry}
      note={kpis.atRisk === null ? '风险口径未接入' : undefined}
      noteTitle={kpis.atRisk === null ? OVERVIEW_GAP.risk : undefined}
      icon={<IconUsers className="ov5-i ov5-i-13" />}
    >
      <div className="ov5-gline">
        <span>各门独立通过</span>
        <span>/ {dashed(denom)} 人</span>
      </div>
      <div className="ov5-gates">
        {readiness.gates.map((gate) => {
          const dot = gate.state === 'pass' ? 'ok' : gate.state === 'fail' ? 'bad' : 'warn';
          return (
            <div className={`ov5-gate${gate.key === narrowestKey ? ' is-narrow' : ''}`} key={gate.key}>
              <span className="ov5-gk" title={gate.source}>
                {gate.name}
                {gate.key === narrowestKey ? <span className="ov5-gtag">最窄</span> : null}
              </span>
              <span className="ov5-gv">
                {gate.pass === null ? '—' : gate.pass} / {dashed(denom)}
              </span>
              <span className="ov5-gcut">
                {gate.state === 'unknown' ? '待核实' : `未达 ${gate.fail === null ? '—' : gate.fail}`}
              </span>
              <i className={`ov5-gdot ${dot}`} title={gate.whyNot ?? `${gate.name}：${gate.state}`} />
            </div>
          );
        })}
      </div>
      <div className="ov5-hnarrow">
        <b>四门交集 {dashed(readiness.confirmed)} 人可上岗</b>
        <span className="ov5-hsep">·</span>
        {readiness.netNote}
      </div>
      <div className="ov5-stack">
        <svg className="ov5-stack-svg" viewBox="0 0 100 6" preserveAspectRatio="none" role="img" aria-label="可上岗 / 待核实 / 受限占比">
          <rect className="ok" x={0} y={0} width={pct(buckets?.confirmed) ?? 0} height={6} />
          <rect
            className="warn"
            x={pct(buckets?.confirmed) ?? 0}
            y={0}
            width={pct(buckets?.pending) ?? 0}
            height={6}
          />
          <rect
            className="bad"
            x={(pct(buckets?.confirmed) ?? 0) + (pct(buckets?.pending) ?? 0)}
            y={0}
            width={pct(buckets?.failing) ?? 0}
            height={6}
          />
        </svg>
        <div className="ov5-legend">
          <span>
            <i className="ok" />
            {dashed(buckets?.confirmed)} 可上岗
          </span>
          <span>
            <i className="warn" />
            {dashed(buckets?.pending)} 待核实
          </span>
          <span>
            <i className="bad" />
            {dashed(buckets?.failing)} 受限
          </span>
          <span className="ov5-legend-note">四门各自独立判定后再取交集</span>
        </div>
      </div>
    </KpiCard>
  );
}

/* ============================================================================
 * 今日运行：次数 / 在跑 / 失败 / 失败率 + 在跑与失败 run 行（骨架 hcard 2）
 * ========================================================================== */
function TodayRunsCard({
  data,
  kpis,
  onRetry,
}: {
  data: DutyData;
  kpis: ReturnType<typeof buildKpis>;
  onRetry: () => void;
}) {
  const today = data.todayStats.k === 'ready' ? data.todayStats.data : null;
  const running = today?.totals?.running ?? null;
  const rows =
    data.todayRuns.k === 'ready'
      ? data.todayRuns.data.filter((run) => run.status === 'running' || run.status === 'failed').slice(0, 3)
      : [];
  return (
    <KpiCard
      title="今日运行"
      meta={<Link to="/work?tab=runs">运行记录 →</Link>}
      value={dashed(kpis.runs)}
      unit="次"
      foot={
        <>
          在跑 <b>{dashed(running)}</b> · 失败 <b>{dashed(kpis.failed)}</b> · 失败率{' '}
          <b>{kpis.failureRate === null ? '—' : `${kpis.failureRate}%`}</b>
        </>
      }
      source="运行统计（今日）"
      stamps={[{ source: '运行统计', state: data.todayStats }]}
      testid="ov6-kpi-runs"
      issues={[{ label: '运行统计', state: data.todayStats, gap: OVERVIEW_GAP.runs }]}
      onRetry={onRetry}
      note={kpis.runs === 0 && kpis.failureRate === null ? '今天还没有运行，失败率不计算' : undefined}
      noteTitle={kpis.runs === 0 && kpis.failureRate === null ? OVERVIEW_GAP.runs : undefined}
      icon={<IconGauge className="ov5-i ov5-i-13" />}
    >
      <div className="ov5-hlist">
        {rows.length > 0 ? (
          rows.map((run) => <RunRowLine key={run.runId} run={run} />)
        ) : (
          <div className="ov5-hrow">
            <span className="ov5-ht">
              {data.todayRuns.k === 'error'
                ? '运行记录没有读出来（见上方重试）'
                : data.todayRuns.k === 'loading'
                  ? '正在读今日运行记录…'
                  : '今天没有在跑或失败的 run'}
            </span>
          </div>
        )}
      </div>
    </KpiCard>
  );
}

function RunRowLine({ run }: { run: RunRow }) {
  const bad = run.status === 'failed';
  return (
    <div className="ov5-hrow">
      <span className={`ov5-pill ${bad ? 'bad' : 'info'}`}>{bad ? '失败' : '在跑'}</span>
      <span className="ov5-ht" title={run.runId}>
        {shortId(run.runId)} · {RUN_STATUS_LABEL[run.status ?? ''] ?? '—'}
      </span>
      <span className="ov5-hm">{beijing(run.startedAt).slice(11)}</span>
    </div>
  );
}

/* ============================================================================
 * 今日成本：日账本 + 月配额（骨架 hcard 3）。没有预算读口的字段写「—」，
 * 不按单价反推、不编日上限。
 * ========================================================================== */
function CostCard({
  data,
  kpis,
  matrix,
  monthUsd,
  onRetry,
}: {
  data: DutyData;
  kpis: ReturnType<typeof buildKpis>;
  matrix: Loadable<MatrixBody>;
  monthUsd: number | null;
  onRetry: () => void;
}) {
  const quota = monthQuota(matrix);
  const usedPct =
    monthUsd === null || quota === null || quota <= 0 ? null : Math.round((monthUsd / quota) * 1000) / 10;
  const covered = kpis.costPartial ? kpis.costMissing : 0;
  return (
    <KpiCard
      title="今日成本"
      meta={<Link to="/overview?tab=usage">成本账本 →</Link>}
      value={kpis.costUsd === null ? '—' : usd(kpis.costUsd)}
      unit={`今日账本 · 月配额 ${quota === null ? '—' : usd(quota)}`}
      foot={
        <>
          本月 <b>{monthUsd === null ? '—' : usd(monthUsd)}</b> / 月配额 <b>{quota === null ? '—' : usd(quota)}</b> ·
          预估月底 <b>—</b>
        </>
      }
      source="成本账本（日 / 月）"
      stamps={[
        { source: '成本账本', state: data.budgetDay },
        { source: '月账本', state: data.budgetMonth },
      ]}
      testid="ov6-kpi-cost"
      issues={[{ label: '成本账本', state: data.budgetDay, gap: OVERVIEW_GAP.cost }]}
      onRetry={onRetry}
      note={kpis.costUsd === null ? '成本口径未齐' : undefined}
      noteTitle={kpis.costUsd === null ? OVERVIEW_GAP.cost : undefined}
      icon={<IconCoins className="ov5-i ov5-i-13" />}
    >
      <div className="ov5-hlist">
        <div className="ov5-hrow">
          <span className="ov5-ht">日上限合计 —（无预算读口）</span>
          <span className="ov5-hm">如实缺</span>
        </div>
        <div className="ov5-hrow">
          <span className="ov5-ht">月配额已用 {usedPct === null ? '—' : `${usedPct}%`}</span>
          <span className="ov5-hm">{covered > 0 ? `${covered} 人缺账本` : '逐员工相加'}</span>
        </div>
        <div className="ov5-hrow">
          <span className="ov5-ht">浪费 —（账本无失败分类）</span>
          <span className="ov5-hm">预估不出</span>
        </div>
      </div>
      <div className="ov5-meter">
        <svg
          className="ov5-meter-svg"
          viewBox="0 0 100 4"
          preserveAspectRatio="none"
          role="img"
          aria-label={`月配额已用 ${usedPct === null ? '—' : `${usedPct}%`}`}
        >
          <rect className="track" x={0} y={0} width={100} height={4} />
          {usedPct !== null ? <rect className="fill" x={0} y={0} width={Math.min(100, usedPct)} height={4} /> : null}
        </svg>
        <span className="ov5-meter-lbl">月配额已用 {usedPct === null ? '—' : `${usedPct}%`} · 日上限无读口</span>
      </div>
    </KpiCard>
  );
}

/* ============================================================================
 * 三条细长条：发布 / 出站 / 账本（骨架 chainstrip，高约 44px 单行）
 * 发布与出站在本仓没有读口：整条标 data-fixture 并挂「示例数据」角标。
 * ========================================================================== */
function ChainStrip({
  kpis,
  matrix,
  covered,
}: {
  kpis: ReturnType<typeof buildKpis>;
  matrix: Loadable<MatrixBody>;
  covered: number | null;
}) {
  const quota = monthQuota(matrix);
  return (
    <div className="ov5-chainstrip">
      <Link className="ov5-cs" to="/approvals" data-fixture="1" title="发布链固定示例：3 草稿 · 2 校验失败 · 4 待批 · 1 发布超时">
        <span className="ov5-cs-k">
          <IconRocket className="ov5-i ov5-i-13" />
          发布
        </span>
        <span className="ov5-cs-v">
          <b>3</b> 草稿 · <b>2</b> 校验失败 · <b>4</b> 待批 · <b>1</b> 发布超时
        </span>
        <span className="ov5-fixture-badge">示例数据</span>
        <span className="ov5-cs-go">→</span>
      </Link>
      <span className="ov5-cs" data-fixture="1" title="出站链固定示例：96.2% 成功 · 拒绝 3 · 回执 P95 1.8s · 网关在线 · app_id 一致">
        <span className="ov5-cs-k">
          <IconSend className="ov5-i ov5-i-13" />
          出站
        </span>
        <span className="ov5-cs-v">
          <b>96.2%</b> 成功 · 拒绝 <b>3</b> · 回执 P95 <b>1.8s</b> · 网关在线
        </span>
        <span className="ov5-fixture-badge">示例数据</span>
        <span className="ov5-cs-go">→</span>
      </span>
      <Link
        className="ov5-cs"
        to="/overview?tab=usage"
        title={`账本：员工覆盖与今日实扣来自成本账本；月配额 ${quota === null ? '—' : usd(quota)}；估算与对账无读口`}
      >
        <span className="ov5-cs-k">
          <IconBook className="ov5-i ov5-i-13" />
          账本
        </span>
        <span className="ov5-cs-v">
          覆盖 <b>{covered === null ? '—' : `${covered}/${kpis.total ?? '—'}`}</b> 员工 ·
          实扣 <b>{kpis.costUsd === null ? '—' : usd(kpis.costUsd)}</b> · 估算 <b>—</b> · 最近对账 <b>未接入</b>
        </span>
        <span className="ov5-cs-go">→</span>
      </Link>
    </div>
  );
}

/* ============================================================================
 * 近 14 天：大字（总次数 · 峰值）+ 200–240px 卡片内的柱图 + 峰值标注 + 脚注
 * ========================================================================== */
function Trend({ stats, label = '近 14 天', days = 14, onRetry }: { stats: Loadable<RunStatsBody>; label?: string; days?: number; onRetry: () => void }) {
  const points = stats.k === 'ready' ? trendWindow(stats.data, days) : [];
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
  const known = points.filter((p) => p.runs !== null);
  const total = known.reduce((sum, p) => sum + (p.runs as number), 0);
  const missingDays = points.length - known.length;
  const avg = known.length > 0 ? Math.round((total / known.length) * 10) / 10 : null;
  const peak = geo?.peakAt ?? null;
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
            <Link to="/work?tab=runs">去看运行记录<IconArrowRight className="ov5-i ov5-i-14" /></Link>
          </div>
        ) : allMissing ? (
          <div className="ov5-empty-line" data-testid="ov6-trend-missing">
            <IconAlert className="ov5-i ov5-i-16" />
            <span>{label}的运行数据没有返回，所以画不出趋势。</span>
          </div>
        ) : geo ? (
          <>
            <div className="ov5-hnum">
              <span className="ov5-hnum-v">{total}</span>
              <em>次 · 峰值 {peak ? peak.value : '—'}</em>
            </div>
            <p className="ov5-hsay">
              日均 <b>{avg === null ? '—' : avg}</b> 次 · 失败{' '}
              <b>{geo.failedTotal === null ? '—' : geo.failedTotal}</b> · 缺读数 <b>{missingDays}</b> 天
              {peak ? <span className="ov5-hsay-peak"><IconTrendUp className="ov5-i ov5-i-13" />峰值柱描边</span> : null}
            </p>
            <div className="ov5-chart" ref={chartRef}>
              <svg
                className="ov5-trend-svg"
                viewBox={`0 0 ${geo.w} ${geo.h}`}
                height={TREND_H}
                role="img"
                aria-label={`${label}运行趋势：合计 ${total} 次，峰值 ${peak ? peak.value : '—'} 次，失败 ${geo.failedTotal === null ? '—' : geo.failedTotal} 次，缺读数 ${missingDays} 天`}
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
                    <text key={`ax${col.index}`} className="ov5-axis-lbl" x={col.cx} y={TREND_H - 5} textAnchor="middle">{col.label}</text>
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
                {hovered !== null && active ? (
                  <>
                    <span className="ov5-tip-k">{active.label}</span>
                    <span>运行 <b>{active.runs === null ? '—' : active.runs}</b> 次</span>
                    <span>失败 <b>{active.failed === null ? '—' : active.failed}</b></span>
                  </>
                ) : null}
              </div>
            </div>
            <BlockFoot items={[{ source: '运行统计', state: stats }]} testid="ov6-trend-stamp">
              柱高表示当日运行次数；失败次数在悬停说明里，柱内深色段即其中失败；缺读数的日子画虚线框，不折 0。
            </BlockFoot>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ============================================================================
 * 24 小时活跃：大字（峰值时段）+ 24 格热力条（未发生时段画斜线）+ 图例 + 脚注
 * ========================================================================== */
function HourActivity({ activity, label, onRetry }: { activity: Loadable<ActivityBody>; label: string; onRetry: () => void }) {
  const view = activity.k === 'ready' ? dayActivity(activity.data.cells) : null;
  const hourLabel = (hour: number) => (hour < 10 ? `0${hour}` : `${hour}`);
  return (
    <Card className="ov5-block ov5-heat" data-testid="ov6-heat" data-duty-testid="duty-heat">
      <CardContent className="ov5-block-bd">
        <div className="ov5-block-hd">
          <h2>
            <IconActivity className="ov5-i ov5-i-16" />
            24 小时活跃
            <span className="ov5-hd-note">每格 1 小时</span>
          </h2>
          <Source>运行活跃</Source>
        </div>
        {activity.k === 'loading' ? (
          <div className="ov5-skeleton" aria-busy="true" aria-label="24 小时活跃加载中"><span /><span /><span /></div>
        ) : activity.k === 'error' ? (
          <div className="ov5-inline-error" role="alert">
            <IconAlert className="ov5-i ov5-i-16" />
            <span>24 小时活跃没有读出来。</span>
            <RequestId id={activity.requestId} />
            <Button size="sm" outlined onClick={onRetry} data-testid="ov6-heat-retry">重试</Button>
          </div>
        ) : !view || !view.hasRead ? (
          <div className="ov5-empty-line">
            <IconInbox className="ov5-i ov5-i-16" />
            <span>{label}没有运行活跃读数，热力不画空格。</span>
            <Link to="/work?tab=runs">去看运行记录<IconArrowRight className="ov5-i ov5-i-14" /></Link>
          </div>
        ) : (
          <>
            <div className="ov5-hnum">
              <span className="ov5-hnum-v">{view.peak ? `${hourLabel(view.peak.hour)}:00` : '—'}</span>
              <em>峰值时段</em>
            </div>
            <p className="ov5-hsay">
              峰值 <b>{view.peak ? view.peak.count : '—'}</b> 次/时 · 取窗口内最活跃的一天
              {view.dayLabel ? `（${view.dayLabel}）` : ''} · 合计 <b>{view.windowTotal}</b> 次
            </p>
            <div className="ov5-heat24">
              <svg
                className="ov5-heat-svg"
                viewBox="0 0 480 30"
                role="img"
                aria-label={`按小时统计的运行次数，峰值 ${view.peak ? view.peak.count : '—'} 次/时，窗口合计 ${view.windowTotal} 次`}
              >
                {view.cells.map((cell) => (
                  <rect
                    key={cell.hour}
                    className={
                      cell.count === null
                        ? 'ov5-heat-cell is-void'
                        : `ov5-heat-cell ov5-heat-lv${cell.level}${view.peak && view.peak.hour === cell.hour ? ' is-peak' : ''}`
                    }
                    x={cell.hour * 20 + 0.5}
                    y={0}
                    width={19}
                    height={30}
                    rx={3}
                  >
                    <title>{`${hourLabel(cell.hour)}:00 · ${cell.count === null ? '未发生/无读数' : `${cell.count} 次`}`}</title>
                  </rect>
                ))}
              </svg>
              <div className="ov5-heat-axis" aria-hidden="true">
                <span>00</span>
                <span>06</span>
                <span>12</span>
                <span>18</span>
                <span>23</span>
              </div>
            </div>
            <div className="ov5-legend ov5-legend-heat">
              <span><i className="h0" />0</span>
              <span><i className="h1" />1–2</span>
              <span><i className="h2" />3–5</span>
              <span><i className="h3" />6+</span>
              <span className="ov5-legend-note">斜线＝未发生时段 · 峰值格描边</span>
            </div>
            <BlockFoot items={[{ source: '运行活跃', state: activity }]} testid="ov6-heat-stamp">
              每格 1 小时；没有读数的小时画斜线，不当 0。
            </BlockFoot>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ============================================================================
 * 三张列表卡：阻塞 / 待我处理 / 最近运行（行高 36–40px，标题 12.5 / 副行 11）
 * ========================================================================== */
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
            阻塞
          </h2>
          <Link to="/work?tab=tasks">查看全部 ({rows.length}) →</Link>
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
              <li key={`${row.responsibleModule}-${row.object}`} className="ov5-blkrow">
                <Badge tone={row.overSLA ? 'destructive' : 'warning'}>{row.responsibleModule}</Badge>
                <span className="ov5-bmain">
                  <span className="ov5-bline1">{row.object} · {row.reason}</span>
                  <span className="ov5-bline2">责任 {row.responsibleModule} · 下一步 {row.nextAction}</span>
                </span>
                {row.href ? <Link className="ov5-hgo" to={row.href}>去处理</Link> : null}
              </li>
            ))}
          </ul>
        )}
        <p className="ov5-block-foot">失败运行按一组计；任务与审批每条各一行。</p>
      </CardContent>
    </Card>
  );
}

function PendingCard({ data, onRetry }: { data: DutyData; onRetry: () => void }) {
  const stats = data.approvalStats.k === 'ready' ? data.approvalStats.data : null;
  const pending = stats?.pending ?? null;
  const rows = data.approvals.k === 'ready' ? data.approvals.data.slice(0, 3) : [];
  const first = rows[0];
  const issue: KpiIssue[] = [{ label: '审批统计', state: data.approvalStats, gap: OVERVIEW_GAP.approvals }];
  return (
    <Card className="ov5-block" data-testid="ov6-pending-card" data-duty-testid="duty-pending">
      <CardContent className="ov5-block-bd">
        <div className="ov5-block-hd">
          <h2>
            <IconShield className="ov5-i ov5-i-16" />
            待我处理
            <span className="ov5-hd-note">待审批</span>
          </h2>
          <Link to="/approvals">查看全部{pending === null ? '' : ` (${pending})`} →</Link>
        </div>
        {rows.length === 0 ? (
          <div className="ov5-empty-line">
            <IconInbox className="ov5-i ov5-i-16" />
            <span>{data.approvals.k === 'error' ? '审批列表没有读出来（见上方重试）' : '今天没有待你处理的审批。'}</span>
          </div>
        ) : (
          <ul className="ov5-rows">
            {rows.map((row) => (
              <li key={row.approvalId}>
                <span className="ov5-ht" title={row.title ?? row.approvalId}>
                  {row.title ?? '未命名审批'}
                </span>
                <span className="ov5-hm">{row.createdAt ? beijing(row.createdAt).slice(11) : '—'}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="ov5-pending-foot" data-testid="ov6-kpi-pending" data-duty-testid="duty-kpi-pending">
          <span className="ov5-pending-count">
            待批 <span className="ov5-kpi-value">{dashed(pending)}</span>
          </span>
          <span>最早 {first?.createdAt ? beijing(first.createdAt) : '—'}</span>
          <IssueRows issues={issue} onRetry={onRetry} testid="ov6-kpi-pending" />
          <Freshness items={[{ source: '审批统计', state: data.approvalStats }]} testid="ov6-kpi-pending-stamp" />
        </div>
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
            最近运行
          </h2>
          {/* OM-07：卡数据腿固定近 7 天（fetchRuns limit=3 + w7.from），
              「全部运行」带 window=7d 与卡同窗。 */}
          <Link to="/runs?window=7d">全部运行<IconArrowRight className="ov5-i ov5-i-14" /></Link>
        </div>
        <Freshness items={[{ source: '运行记录', state: runs }]} testid="ov6-activity-stamp" />
        {runs.k === 'loading' ? (
          <div className="ov5-skeleton" aria-busy="true" aria-label="最近运行加载中"><span /><span /><span /></div>
        ) : runs.k === 'error' ? (
          <div className="ov5-inline-error" role="alert">
            <IconAlert className="ov5-i ov5-i-16" />
            <span>最近运行没有读出来。</span>
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
                  {shortId(run.runId)}
                </Link>
                <Badge
                  tone={run.status === 'failed' ? 'destructive' : run.status === 'completed' ? 'success' : 'outline'}
                  // OM-07 状态四词表封闭：成功/失败/运行中/—；未知原值不进徽标文本，落 title 供核对。
                  title={run.status && !['failed', 'completed', 'running'].includes(run.status) ? `上游状态：${run.status}` : undefined}
                >
                  {run.status === 'failed' ? '失败' : run.status === 'completed' ? '成功' : run.status === 'running' ? '运行中' : '—'}
                </Badge>
                <span className="ov5-mono">{beijing(run.startedAt)}</span>
                <span className="ov5-hm">{duration(run.startedAt, run.endedAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="ov5-block-foot">最近 3 次 · 详情在运行记录。</p>
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
  const budgetDay = data.budgetDay.k === 'ready' ? data.budgetDay.data : null;
  const budgetMonth = data.budgetMonth.k === 'ready' ? data.budgetMonth.data : null;
  const approvalStats = data.approvalStats.k === 'ready' ? data.approvalStats.data : null;
  const employees = data.employees.k === 'ready' ? data.employees.data.length : null;
  const kpis = buildKpis({
    stats,
    todayStats: data.todayStats.k === 'ready' ? data.todayStats.data : null,
    approvalStats,
    budgetDay,
    budgetMonth,
    totalEmployeesFallback: employees,
    matrix,
  });
  const costView = buildCost(budgetDay, budgetMonth, kpis.total);
  // 单卡不再画无轴火花小图：14 天趋势只由下方的 Trend 块承担，避免「图坏了」的观感。
  const runningToday = data.todayStats.k === 'ready' ? data.todayStats.data?.totals?.running ?? null : null;
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
  const probeText = probeStatus ? HEALTH_LABEL[probeStatus] ?? probeStatus : probeState.k === 'error' ? '未接' : '—';
  const healthSynthesis = healthSources.every((s) => s.state.k === 'ready')
    ? '本页六路读数全部就绪'
    : healthSources
        .filter((s) => s.state.k !== 'ready')
        .map((s) => `${s.label}未就绪`)
        .join(' · ');

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
          <h2>还没有可汇总的数据</h2>
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
          <p className="ov5-sub">员工、运行、审批与成本各读各的；缺失值显示「—」，不补零。</p>
          <div className="ov5-facts">
            <AsofLine states={[data.stats, data.todayStats, data.employees, data.approvalStats, data.budgetDay]} />
            <span className="ov5-fact">在岗 <b>{dashed(kpis.active)}</b></span>
            <span className="ov5-fact">在跑 <b>{dashed(runningToday)}</b></span>
          </div>
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
          <Button size="sm" outlined onClick={onRetry} disabled={loading || anyLoading} aria-busy={loading || anyLoading} data-testid="ov6-refresh" prefix={<IconRefresh className={`ov5-i ov5-i-14 ${loading || anyLoading ? 'ov5-spin' : ''}`} />}>
            刷新
          </Button>
        </div>
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

      {/* 首读时不盖整页骨架：每张卡各自有「读取中 / —」形制，页面不会先空一块再跳版。 */}
      <div className="ov5-homegrid r3" data-busy={anyLoading ? '1' : undefined}>
        <ReadyCard data={data} matrix={matrix} kpis={kpis} onRetry={onRetry} />
        <TodayRunsCard data={data} kpis={kpis} onRetry={onRetry} />
        <CostCard data={data} kpis={kpis} matrix={matrix} monthUsd={costView.monthUsd} onRetry={onRetry} />
      </div>

      <ChainStrip kpis={kpis} matrix={matrix} covered={costView.covered} />

      <div className="ov5-homegrid r2">
        <Trend stats={data.stats14} label={range.label} days={range.days} onRetry={onRetry} />
        <HourActivity activity={data.activity} label={range.label} onRetry={onRetry} />
      </div>

      <div className="ov5-homegrid r3">
        <Blockers data={data} onRetry={onRetry} />
        <PendingCard data={data} onRetry={onRetry} />
        <RecentActivity data={data} onRetry={onRetry} />
      </div>

      <footer className="ov5-pagefoot">
        <span className="ov5-fixture-badge" title="发布与出站两条细长条是固定示例；其余块为实机读数">示例数据</span>
        <span>发布 / 出站为示例 · 采集 {summaryAsOf ?? '—'}（北京时间） · SEAKOI · 数字员工控制台</span>
        <div
          className="ov5-health"
          data-testid="ov6-kpi-health"
          data-duty-testid="duty-kpi-health"
          title={`GET /api/hermes-summary · ${healthSynthesis}（本页读数合成状态，不等于服务健康）`}
        >
          <IconServer className="ov5-i ov5-i-13" />
          服务探针 <span className="ov5-kpi-value">{probeText}</span>
          <span className="ov5-sr">
            GET /api/hermes-summary · {healthSynthesis}（本页读数合成状态，不等于服务健康）
            {probeState.k === 'ready' && !probeStatus ? ' · 服务探针未返回状态；不以本页读数冒充。' : ''}
          </span>
          <IssueRows
            issues={probeState.k === 'error' ? [{ label: '服务探针', state: probeState as Loadable<unknown>, gap: OVERVIEW_GAP.health }] : []}
            onRetry={onRetry}
            testid="ov6-kpi-health"
          />
          <Freshness items={[{ source: '服务探针', state: probeForStamp }]} testid="ov6-kpi-health-stamp" />
        </div>
      </footer>
    </section>
  );
}

function LiveOverview({ rangeId, onRange, rangeInvalid }: { rangeId: DutyRangeId; onRange: (id: DutyRangeId) => void; rangeInvalid: string | null }) {
  // OM-17：本页新增 24 小时活跃，活动腿改为按档位真读（weeks 随 range 走）。
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
          <h2>还没有可汇总的数据</h2>
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