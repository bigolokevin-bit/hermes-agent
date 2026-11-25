import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Badge } from '@nous-research/ui/ui/components/badge';
import { Button } from '@nous-research/ui/ui/components/button';
import { Card, CardContent } from '@nous-research/ui/ui/components/card';

import { fetchMatrix, fetchRunStats, load } from '../duty/api';
import { buildReadiness, buildCost } from '../duty/aggregate';
import { DENOMINATOR_STATES, v1Verdict, v2Verdict, v3Verdict, v6Verdict } from '../duty/readiness';
import { beijing, beijingDayWindow, dashed, duration, usd } from '../duty/format';
import { useDutyData, type DutyData } from '../duty/useDutyData';
import { DUTY_RANGES, DEFAULT_DUTY_RANGE, dutyRange, parseDutyRange, type DutyRangeId } from '../duty/dutyRange';
import { num } from '../duty/types';
import type { ActivityBody, EmployeeRow, Loadable, MatrixBody, RunStatsBody } from '../duty/types';
import {
  buildKpis,
  blockerRows,
  dayActivity,
  monthQuota,
  overviewSummaryText,
  provenZeroFill,
  sourceStamp,
  trendWindow,
  OVERVIEW_GAP,
  type OverviewSummaryRow,
} from './overview';
import {
  fetchHealthSources,
  fetchHermesSummary,
  fetchOverviewSummary,
  fetchTrendRuns,
  type HealthSourcesBody,
  type HermesSummaryBody,
  type OverviewSummaryBody,
} from './api';
import { COST_CALIBER_TEXT } from '../metrics/costCaliberNote';
import { TrendCurve } from '@/components/charts/TrendCurve';
import './overview.css';

/** 趋势曲线画布高（IN 的容器 208–288 档）与其内边距；
 *  内边距与 overview.css 的 .ov5-bars 覆盖层（30/10/24/20）逐像素对齐。 */
const TREND_CURVE_H = 208;
const TREND_CURVE_PAD = { l: 30, r: 10, t: 24, b: 20 } as const;

type Forced = 'loading' | 'empty' | 'error';
type StampSource = { source: string; state: Loadable<unknown> };

/**
 * 本页统一采集时刻（已按北京时间格式化）：所有卡片的「数据截至」同源同值。
 * 某来源回包没带 asOf 时沿用它，缺因仍留在该脚的 title 里。
 */
const PageStampContext = createContext<string | null>(null);

// OM-15：服务探针状态词表——只翻译 hermes-summary 真读数，没有读数就是未接。
const HEALTH_LABEL: Record<string, string> = { ok: '正常', degraded: '降级', down: '异常' };

/** 运行耗时：亚秒级如实写「<1s」，不把 8ms 洗成 0s，也不编造分钟数。 */
function shortDuration(start?: string, end?: string): string {
  if (!start) return '—';
  const a = Date.parse(start);
  if (!Number.isFinite(a)) return '—';
  // 未结束的 run 用当前时刻估耗时（只用于「多久了」这一读数），不足 1 秒同样写 <1s，
  // 不写「0s」——0s 读起来像没跑过，和骨架形制也不一致。
  const b = end ? Date.parse(end) : Date.now();
  if (!Number.isFinite(b) || b < a) return '—';
  if (b - a < 1000) return '<1s';
  return duration(start, end);
}

/**
 * 运行短码：`run_` + runId 尾段 6 位小写（骨架 `run_9f21ac` 形制）。
 * 完整 id 不丢——它留在行的 title 里，点进详情照样取得回。稳定：同一 id 恒得同一码。
 */
function runCode(raw?: string | null): string {
  const v = (raw ?? '').trim();
  if (!v) return '—';
  const bare = v.replace(/^(?:run_|rn_)/i, '') || v;
  return `run_${bare.slice(-6).toLowerCase()}`;
}

/** 等待时长人话：分/h/d 三档，只用上游给的时刻，不读页面时钟猜数据时刻。 */
function ageText(since?: string): string {
  if (!since) return '—';
  const a = Date.parse(since);
  if (!Number.isFinite(a)) return '—';
  const min = Math.max(0, Math.floor((Date.now() - a) / 60000));
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${min % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/** 逐员工成本账本求和；任一行缺金额就整笔返回 null（不给部分和冒充合计）。 */
function sumCost(items: Array<{ costUsd?: number | null }> | undefined): number | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  let total = 0;
  for (const row of items) {
    const n = num(row.costUsd);
    if (n === null) return null;
    total += n;
  }
  return total;
}

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

function IconSearch({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <circle cx="10.8" cy="10.8" r="6.6" />
      <path d="m15.6 15.6 4.4 4.4" />
    </svg>
  );
}

function IconDownload({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <path d="M12 3.6v11.2" />
      <path d="m7.4 10.4 4.6 4.6 4.6-4.6" />
      <path d="M4.4 19.6h15.2" />
    </svg>
  );
}

/* ============================================================================
 * 图表基元
 * ========================================================================== */

/** 量宽度只为趋势图定 viewBox；jsdom 没有布局，退回 720 不影响任何断言。 */
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
function AsofLine({ states, waiting = false }: { states: Array<Loadable<unknown> | null>; waiting?: boolean }) {
  // 同页同源同值：来源自身没带 asOf 时沿用本页聚合读口的采集时刻（与卡脚、页脚同一个数）。
  const pageStamp = useContext(PageStampContext);
  if (waiting) {
    return (
      <p className="ov5-fresh" data-testid="ov6-asof" title="取不到采集时间：数据还在读取">
        <IconClock className="ov5-i ov5-i-13" />
        <span>采集时刻 —（北京时间）</span>
      </p>
    );
  }
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
        <span>{`采集时刻 北京时间 ${newest}`}</span>
      </p>
    );
  }
  if (pageStamp) {
    return (
      <p className="ov5-fresh" data-testid="ov6-asof" title="各来源响应没带自身采集时间，沿用本页聚合读口的采集时刻">
        <IconClock className="ov5-i ov5-i-13" />
        <span>{`采集时刻 北京时间 ${pageStamp}`}</span>
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
  // 同页统一采集时刻：来源自身没带 asOf 时沿用页面值，只有整页都没有才是「—」。
  const pageStamp = useContext(PageStampContext);
  const stamps = items.map(({ source, state }) => ({ source, ...sourceStamp(state) }));
  const primary = stamps.find((stamp) => stamp.shown !== null) ?? stamps[0];
  if (!primary) return <div className="ov5-stamps" data-testid={testid} />;
  const shown = primary.shown ?? pageStamp;
  const title = stamps
    .map((stamp) => `${stamp.source}：${stamp.shown ?? '采集时刻未返回'}${stamp.reason ? `（${stamp.reason}）` : ''}`)
    .join(' · ');
  return (
    <div className="ov5-stamps" data-testid={testid} title={items.length > 1 ? title : undefined}>
      <span
        className="ov5-stamp"
        title={
          primary.reason && !shown
            ? `取不到采集时间：${primary.reason}`
            : primary.reason
              ? `本来源未带 asOf，沿用本页采集时刻；原因：${primary.reason}`
              : undefined
        }
      >
        <span>{`数据截至 ${shown ?? '—'} · 来源 ${primary.source}`}</span>
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
 * 首排三卡（2026-11-25 用户口径 v2）：仍是三张并排卡（卡高 180–210px、三卡等高、
 * 卡间 12px），每张卡内部固定五带：11px 标签行 / 大号等宽主数字 / 2×2 读数格 /
 * 4px 细条 / 卡底 11px 一行。三卡同序同基线，格内只放真读数；缺读口的格子写
 * 「—」，全带只在带底声明一次（不每格写原因）。
 * ========================================================================== */

/** 四门固定序：卡面紧凑行与浮层逐门明细都用这一序，三卡才对得上基线。 */
const GATE_ORDER = ['V1', 'V2', 'V3', 'V6'] as const;

/** 主数字位的未知态：16px 弱色破折号（不写「待核实」三字）。 */
function UnknownValue() {
  return <span className="ov5-kpi-unknown">—</span>;
}

/* ============================================================================
 * 三卡共用的堆叠条：宽度=真实占比；0 计数段留中性导轨痕迹；
 * 读数没回时整条画 unknown，不拿空槽冒充 0。
 * ========================================================================== */
type StackSeg = { key: 'ok' | 'bad' | 'unknown'; w: number };

function StackBar({ label, segments, fullUnknown }: {
  label: string;
  segments: StackSeg[];
  fullUnknown: boolean;
}) {
  const placed = segments.map((seg, i) => ({
    ...seg,
    x: segments.slice(0, i).reduce((acc, prev) => acc + prev.w, 0),
  }));
  return (
    <svg
      className="ov5-stack-svg"
      viewBox="0 0 100 10"
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <rect className="track" x={0} y={0} width={100} height={10} rx={3} />
      {fullUnknown ? (
        <rect className="unknown" x={0} y={0} width={100} height={10} />
      ) : (
        <>
          {/* 色块：宽度=真实计数；图上按段连续铺，不叠不省。 */}
          {placed
            .filter((seg) => seg.w > 0)
            .map((seg) => (
              <rect key={seg.key} className={seg.key} x={seg.x} y={0} width={seg.w} height={10} />
            ))}
          {/* 0 段的导轨痕迹：不画色块，但留一段中性描边导轨，整条仍读得出分段。 */}
          {placed
            .filter((seg) => seg.w === 0)
            .map((seg) => (
              <rect
                key={`rail-${seg.key}`}
                className="rail"
                x={Math.min(seg.x, 98)}
                y={0.5}
                width={2}
                height={9}
                rx={1}
              />
            ))}
        </>
      )}
    </svg>
  );
}

/* ============================================================================
 * 卡内浮层（2026-11-25 用户口径）：卡体只留主数字 + 两行关键副读数 + 一条细条；
 * 更细的读数收进 hover / focus 浮层。一行 = 11px 标签 + 12px 等宽右对齐数值，
 * 缺读口的行写「—」，缺哪个读口只在该行 title 里说一次。
 * ========================================================================== */
type PopRow = {
  key: string;
  label: string;
  value: ReactNode;
  title?: string;
  tone?: 'ok' | 'bad' | 'unknown';
};

type PopSection = { key: string; title?: string; rows: PopRow[] };

function PopRows({ section, testid }: { section: PopSection; testid: string }) {
  return (
    <div className="ov5-pop-sec">
      {section.title ? <p className="ov5-pop-t">{section.title}</p> : null}
      <dl className="ov5-pop-dl">
        {section.rows.map((row) => (
          <div className="ov5-pop-row" key={row.key} data-tone={row.tone ?? 'plain'} title={row.title}>
            <dt className="ov5-pop-k">{row.label}</dt>
            <dd className="ov5-pop-v" data-testid={`${testid}-cell-${row.key}`}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ============================================================================
 * 一张卡：外层是可聚焦的 hover/focus 宿主（tabIndex=0 + aria-describedby），
 * 卡体只见 11px 标签 / 大号主数字 / 两行副读数 / 4px 细条；浮层挂着全部细读数。
 * 打开方式：hover、键盘 focus、点卡片（375 无 hover）；Esc 与点卡外都关闭。
 * 浮层朝下开，卡贴近视口底部时翻到卡上方，永不溢出视口。
 * ========================================================================== */
function KpiCard({
  testid,
  duty,
  label,
  icon,
  value,
  unit,
  subs,
  status,
  bar,
  popover,
  issues,
  onRetry,
}: {
  testid: string;
  duty: string;
  label: string;
  icon: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  subs: Array<{ text: string; title?: string; testid?: string }>;
  status: { tone: 'ok' | 'unknown' | 'bad'; title: string };
  bar: { label: string; segments: StackSeg[]; fullUnknown: boolean };
  popover: { title: string; sections: PopSection[] };
  issues: KpiIssue[];
  onRetry: () => void;
}) {
  const popId = useId();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  // null=关；hover/focus/tap 记打开方式，保证「hover 开着时点一下」不会自己关自己。
  const [mode, setMode] = useState<'hover' | 'focus' | 'tap' | null>(null);
  const open = mode !== null;

  // 翻转方向直接写 DOM 属性（不 setState）：贴着视口底部时浮层改向上开。
  useLayoutEffect(() => {
    const host = hostRef.current;
    const pop = popRef.current;
    if (!host || !pop) return;
    if (!open) {
      pop.removeAttribute('data-flip');
      return;
    }
    const rect = host.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    if (spaceBelow < pop.offsetHeight && spaceAbove > spaceBelow) {
      pop.setAttribute('data-flip', '1');
    } else {
      pop.removeAttribute('data-flip');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: Event) => {
      const host = hostRef.current;
      if (host && !host.contains(e.target as Node)) setMode(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMode(null);
    };
    document.addEventListener('pointerdown', onDocDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDocDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      className="ov5-seg"
      data-testid={testid}
      data-duty-testid={duty}
      data-pop-open={open ? '1' : undefined}
      ref={hostRef}
      tabIndex={0}
      role="group"
      aria-describedby={popId}
      aria-label={`${label}：hover 或回车查看明细`}
      onMouseEnter={() => setMode((m) => (m === 'tap' ? m : 'hover'))}
      onMouseLeave={() => setMode((m) => (m === 'hover' ? null : m))}
      onFocus={() => setMode((m) => m ?? 'focus')}
      onBlur={() => setMode((m) => (m === 'focus' ? null : m))}
      onClick={() => setMode((m) => (m === 'tap' ? null : 'tap'))}
    >
      <Card className="ov5-seg-card">
        <CardContent className="ov5-seg-bd">
          <div className="ov5-seg-hd">
            <h2 className="ov5-seg-label">
              {icon}
              <span>{label}</span>
            </h2>
            <span
              className={`ov5-dot ${status.tone} ov5-card-status`}
              title={status.title}
              data-testid={`${testid}-status`}
            />
          </div>
          <div className="ov5-seg-main">
            <span className="ov5-kpi-value">{value}</span>
            {unit ? <em className="ov5-unit">{unit}</em> : null}
          </div>
          {subs.map((sub, i) => (
            <p
              className="ov5-kpi-foot ov5-seg-foot"
              key={sub.testid ?? `sub-${i}`}
              data-testid={sub.testid}
              title={sub.title ?? sub.text}
            >
              {sub.text}
            </p>
          ))}
          <div className="ov5-seg-bar">
            <StackBar label={bar.label} segments={bar.segments} fullUnknown={bar.fullUnknown} />
          </div>
          <IssueRows issues={issues} onRetry={onRetry} testid={testid} />
        </CardContent>
      </Card>
      <div
        className="ov5-seg-pop"
        id={popId}
        ref={popRef}
        role="tooltip"
        data-open={open ? '1' : undefined}
      >
        <p className="ov5-pop-hd">{popover.title}</p>
        {popover.sections.map((section) => (
          <PopRows key={section.key} section={section} testid={testid} />
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
 * 首排 KPI 三卡：可上岗 / 今日运行 / 今日成本 并排（760 以下上下堆叠）。
 * 真读数优先：主数字只放真值，取不到写「—」；2×2 格逐格给真读数，缺读口的格
 * 写「—」并让该格 title 说清缺什么；全带只有一处缺读口声明（带底 11px 行）。
 * ========================================================================== */
function KpiStrip({
  data,
  matrix,
  kpis,
  monthActual,
  liveCostUsd,
  dayStats,
  busy,
  onRetry,
}: {
  data: DutyData;
  matrix: Loadable<MatrixBody>;
  kpis: ReturnType<typeof buildKpis>;
  monthActual: number | null;
  liveCostUsd: number | null;
  /** 今日运行明细：/run-stats 北京日窗（比 duty 的 1d 聚合多 succeeded/p95/窗口）。 */
  dayStats?: Loadable<RunStatsBody>;
  busy: boolean;
  onRetry: () => void;
}) {
  /* ---------- 卡一：可上岗 ---------- */
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
  const pct = (n: number | null | undefined) =>
    n === null || n === undefined || !denom ? null : Math.round((n / denom) * 1000) / 10;
  const confirmed = readiness.confirmed;
  const decidableDenom = readiness.decidableDenom;
  const failingGates = readiness.gates
    .filter((gate) => (gate.fail ?? 0) > 0 && gate.decidable !== false)
    .sort((a, b) => (b.fail ?? 0) - (a.fail ?? 0));
  const topGate = failingGates[0] ?? null;
  // 卡底只拼算得出的片段：交集判不出时「受限」也一并省略（0 人在此等于没判，不是没人受限）。
  const readyParts: string[] = [];
  if (confirmed !== null && buckets !== null) readyParts.push(`受限 ${buckets.failing}`);
  if (topGate) readyParts.push(`${topGate.name}门拦下 ${topGate.fail}`);
  const unknownGates = readiness.gates.filter((gate) => gate.state === 'unknown');
  const v3Excluded = (readiness.excludedGates ?? []).some((gate) => gate.key === 'V3');
  const coverageReady = [
    data.employees.k === 'ready',
    data.stats.k === 'ready',
    matrix.k === 'ready',
    data.readiness?.k === 'ready',
    !v3Excluded,
  ].filter(Boolean).length;
  const readyGapLabels = [
    ...(v3Excluded ? ['V3 强制引用策略'] : []),
    ...(kpis.atRisk === null ? ['风险口径'] : []),
  ];
  // 四门固定序（群@ / ReBAC / 引用 / 审批）：不按「最窄门置顶」，三卡各带才对得上。
  const gateOf = (key: (typeof GATE_ORDER)[number]) => readiness.gates.find((g) => g.key === key);
  // 门判定的「当前时刻」只在挂载时取一次（不每帧 Date.now，避免渲染不纯）。
  const [nowMs] = useState(() => Date.now());
  // 逐员工判定直接复用 duty 的四门判定函数（与 buildReadiness 同一口径），
  // 只读不写：用来回答「受限的那几个人分别被哪门挡下」。
  const blockedPeople = useMemo(() => {
    // 本 memo 自带门名/可判定查询，避免把每帧新建的函数当依赖（纯计算，无副作用）。
    const nameOf = (key: (typeof GATE_ORDER)[number]) => {
      const gate = readiness.gates.find((g) => g.key === key);
      return gate ? `${gate.name}门` : key;
    };
    const mayJudge = (key: (typeof GATE_ORDER)[number]) =>
      readiness.gates.find((g) => g.key === key)?.decidable !== false;
    const verdictOf = (key: (typeof GATE_ORDER)[number], employeeId: string) => {
      if (key === 'V3') {
        const leg = evidence?.knowledge;
        return leg && leg.k === 'ready' ? v3Verdict(leg.data) : null;
      }
      if (key === 'V1') {
        const leg = evidence?.stations[employeeId];
        return leg && leg.k === 'ready' ? v1Verdict(leg.data) : null;
      }
      if (key === 'V2') {
        const leg = evidence?.configs[employeeId];
        return leg && leg.k === 'ready' ? v2Verdict(leg.data, nowMs) : null;
      }
      const leg = evidence?.approvals;
      return leg && leg.k === 'ready' ? v6Verdict(leg.data, employeeId, nowMs) : null;
    };
    const denomEmployees = (employees ?? []).filter((e) =>
      DENOMINATOR_STATES.has(e.lifecycleState ?? 'active'),
    );
    return denomEmployees
      .map((emp) => {
        const fails = GATE_ORDER.filter(
          (key) => mayJudge(key) && verdictOf(key, emp.employeeId) === 'fail',
        ).map(nameOf);
        const unknowns = GATE_ORDER.filter(
          (key) => mayJudge(key) && verdictOf(key, emp.employeeId) === null,
        ).length;
        return { id: emp.employeeId, name: emp.name ?? emp.employeeId, fails, unknowns };
      })
      .filter((row) => row.fails.length > 0);
    // decidable / gateLabel 都是无状态纯函数，只依赖 readiness 与证据本身。
  }, [employees, evidence, readiness, nowMs]);
  // 卡体第二行只留四门的紧凑符号行：✓n 通过 / ✗n 未过 / 未接 无读口 / — 本轮未答。
  const gateStrip = GATE_ORDER.map((key) => {
    const gate = gateOf(key);
    const name = gate?.name ?? key;
    if (!gate) return `${name} —`;
    if (gate.decidable === false) return `${name} 未接`;
    if (gate.state === 'unknown' || gate.pass === null) return `${name} —`;
    const fail = gate.fail ?? 0;
    return fail > 0 ? `${name} ✗${fail}` : `${name} ✓${gate.pass}`;
  }).join(' · ');
  const gateRows: PopRow[] = GATE_ORDER.map((key) => {
    const gate = gateOf(key);
    const name = `${gate?.name ?? key}门`;
    if (!gate) {
      return { key, label: name, value: '—', tone: 'unknown', title: '四门证据里没有这一门，本轮判不出' };
    }
    if (gate.decidable === false) {
      return {
        key,
        label: name,
        value: '未接入',
        tone: 'unknown',
        title: `${name} · 可判定=否 · 未接入：${gate.excludedReason ?? gate.whyNot ?? '上游没有这一门的读口'}`,
      };
    }
    if (gate.state === 'unknown' || gate.pass === null) {
      return {
        key,
        label: name,
        value: '—',
        tone: 'unknown',
        title: `${name} · 可判定=是 · 本轮没有回答：${gate.whyNot ?? '部分员工的证据腿没有回答'}`,
      };
    }
    const fail = gate.fail ?? 0;
    return {
      key,
      label: name,
      tone: fail > 0 ? 'bad' : 'ok',
      value: `通过 ${gate.pass} / ${gate.pass + fail} · 未达 ${fail}`,
      title: `${name} · 可判定=是 · 依据 ${gate.source}`,
    };
  });
  const blockedRows: PopRow[] =
    buckets === null
      ? [
          {
            key: 'unknown',
            label: '受限人员',
            value: '—',
            tone: 'unknown',
            title: '分母证明不了（目录缺行、单页触顶或统计对不上账），逐人挡门明细本轮不算',
          },
        ]
      : blockedPeople.length === 0
        ? [{ key: 'none', label: '受限人员', value: '0 人', tone: 'ok', title: '没有员工作为未过可判定门的人' }]
        : [
            ...blockedPeople.slice(0, 6).map((row) => ({
              key: row.id,
              // 同名员工在目录里真实存在（本租户两名都叫这个名字），行尾带工号后四位才分得开。
              label: `${row.name} #${row.id.slice(-4)}`,
              value: row.fails.join(' · '),
              tone: 'bad' as const,
              title: `${row.name}（${row.id}）：${row.fails.join('、')}未过${
                row.unknowns > 0 ? ` · 另有 ${row.unknowns} 项可判定门没有回答` : ''
              }`,
            })),
            ...(blockedPeople.length > 6
              ? [
                  {
                    key: 'more',
                    label: `另有 ${blockedPeople.length - 6} 名受限`,
                    value: '未展开',
                    title: '浮层只展开前 6 名；受限总数按真读数计',
                  },
                ]
              : []),
          ];
  const paused = num(
    (stats as { byLifecycle?: Record<string, unknown> } | null)?.byLifecycle?.paused,
  );
  const readySub = readyParts.length > 0 ? readyParts.join(' · ') : '—';

  /* ---------- 卡二：今日运行 ---------- */
  // 明细优先取 /run-stats 北京日窗（有 succeeded / cancelled / p95 / from-to），
  // 该腿没回时退回 duty 的 1d 聚合（只有 runs / failed / costUsd）。
  const today =
    dayStats?.k === 'ready'
      ? dayStats.data
      : data.todayStats.k === 'ready'
        ? data.todayStats.data
        : null;
  const totals = today?.totals ?? null;
  // 今日总运行数为 0 且列表已空 ⇒ 在跑=0 是可证的；有运行但统计没给 running 才留空。
  const running = totals?.running ?? (data.todayRuns.k === 'ready' && kpis.runs === 0 ? 0 : null);
  const succeeded = totals?.succeeded ?? null;
  // P95 只在有样本时由统计读口回（单位毫秒）；今日 0 次就没有样本，如实写「—」。
  const p95 = num((totals as Record<string, unknown> | null)?.p95);
  const sampleCount = num((totals as Record<string, unknown> | null)?.sampleCount);
  const pctOf = (n: number | null) =>
    n === null || kpis.runs === null || kpis.runs === 0 ? 0 : Math.round((n / kpis.runs) * 1000) / 10;
  // 成功率只在有分母（今日运行 > 0）时才算；今日 0 次是「没有分母」，不是 0% 成功。
  const successRate =
    kpis.runs !== null && kpis.runs > 0 && succeeded !== null
      ? Math.round((succeeded / kpis.runs) * 1000) / 10
      : null;
  const runRows: PopRow[] = [
    { key: 'runs', label: '今日总数', value: kpis.runs ?? '—', title: '运行统计 totals.runs（北京日窗）' },
    {
      key: 'running',
      label: '在跑',
      value: running ?? '—',
      title:
        running === null
          ? '运行统计没给在跑数，今日也没有运行可证明在跑为 0'
          : `运行统计 totals.running = ${running}`,
    },
    {
      key: 'failed',
      label: '失败',
      value: kpis.failed ?? '—',
      tone: (kpis.failed ?? 0) > 0 ? 'bad' : undefined,
      title:
        kpis.failed === null ? '运行统计没有回答，失败数取不到' : `今日运行里失败 ${kpis.failed} 次`,
    },
    { key: 'succeeded', label: '成功', value: succeeded ?? '—', title: '运行统计 totals.succeeded' },
    {
      key: 'cancelled',
      label: '取消 · 中断',
      value: `${totals?.cancelled ?? '—'} / ${totals?.interrupted ?? '—'}`,
      title: '运行统计 totals.cancelled / totals.interrupted',
    },
    {
      key: 'rate',
      label: '成功率',
      value: successRate === null ? '—' : `${successRate}%`,
      tone: successRate === null ? undefined : successRate >= 50 ? 'ok' : 'bad',
      title:
        successRate === null
          ? '今日运行 0 次，成功率没有分母——不写比率，也不拿 0% 冒充'
          : `成功 ${succeeded} / 运行 ${kpis.runs}`,
    },
    {
      key: 'people',
      label: '今日运行人数',
      value: '—',
      title:
        '按人聚合的今日运行没有读口：运行统计只回合计（无 groupBy），运行明细单页上限 3 条不能当全量人数',
    },
    {
      key: 'p95',
      label: 'P95 时长',
      value: p95 === null ? '—' : `${p95} ms`,
      title:
        p95 === null
          ? '今日运行样本为 0，P95 没有样本可算（运行统计 totals.p95 只在有样本时回）'
          : `今日运行样本 ${sampleCount ?? '—'} 条，P95 时长 ${p95} 毫秒`,
    },
  ];
  const runWindowRows: PopRow[] = [
    {
      key: 'window',
      label: '时间窗',
      value: today?.from && today?.to ? `${beijing(today.from)} – ${beijing(today.to)}` : '—',
      title: '运行统计按北京日窗 bucket=day 读取，窗口随请求带 from/to',
    },
    {
      key: 'sample',
      label: '样本数',
      value: sampleCount ?? '—',
      title: '运行统计 totals.sampleCount（参与成功率的样本条数）',
    },
  ];
  const runSub1 = `在跑 ${running ?? '—'} · 失败 ${kpis.failed ?? '—'}`;
  const runSub2Parts = [
    succeeded !== null ? `成功 ${succeeded}` : null,
    typeof totals?.cancelled === 'number' ? `取消 ${totals.cancelled}` : null,
  ].filter((part): part is string => part !== null);
  const runSub2 = runSub2Parts.length > 0 ? runSub2Parts.join(' · ') : '—';

  /* ---------- 卡三：今日成本 ---------- */
  const quota = monthQuota(matrix);
  const displayCost = kpis.costUsd ?? liveCostUsd;
  // 账本覆盖率：日账本真行数 / 员工分母；缺员数取账本自报的 missingEmployeeIds。
  const dayBudget = data.budgetDay.k === 'ready' ? data.budgetDay.data : null;
  const coveredDay = Array.isArray(dayBudget?.items) ? (dayBudget?.items as unknown[]).length : null;
  const missingDay = dayBudget ? (dayBudget.missingEmployeeIds ?? []).length : null;
  // 本月占比 = 本月实扣 ÷ 月配额，两项都有真读数才给，缺一个就不写百分比。
  const monthPct =
    monthActual !== null && quota !== null && quota > 0
      ? Math.round((monthActual / quota) * 1000) / 10
      : null;
  const usedPct = monthPct === null ? null : Math.min(monthPct, 100);
  // 预估月底＝按北京时区本月已过天数线性外推（本月实扣 ÷ 已过天数 × 当月天数）。
  const [bjYear, bjMonth, bjDay] = beijingDayWindow().date.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(bjYear, bjMonth, 0)).getUTCDate();
  const forecast =
    monthActual !== null && bjDay > 0 && daysInMonth > 0
      ? Math.round((monthActual / bjDay) * daysInMonth * 100) / 100
      : null;
  const costRows: PopRow[] = [
    {
      key: 'today',
      label: '今日实扣',
      value: displayCost === null ? '—' : usd(displayCost),
      title:
        kpis.costUsd !== null
          ? '日账本按员工求和（全员覆盖才算）'
          : displayCost !== null
            ? '日账本没有覆盖全员，今日实扣改取 /overview/summary 的运行统计口径'
            : '今日实扣没有读口：日账本未覆盖全员，聚合读口也没回答',
    },
    {
      key: 'daycap',
      label: '今日上限',
      value: '—',
      title: '美元日上限没有读口：能力矩阵的预算只给每人每日 token 与单次金额上限，没有日金额上限',
    },
    {
      key: 'month',
      label: '本月实扣',
      value: monthActual === null ? '—' : usd(monthActual),
      title: '月账本 /api/budget-usage?periodKind=month 各行 costUsd 求和',
    },
    {
      key: 'quota',
      label: '月配额',
      value: quota === null ? '—' : usd(quota),
      title: '能力矩阵各员工 monthlyCostUsd 之和；任一人缺该字段就整项不算',
    },
    {
      key: 'used',
      label: '已用',
      value: monthPct === null ? '—' : `${monthPct}%`,
      tone: monthPct === null ? undefined : monthPct > 90 ? 'bad' : 'ok',
      title:
        monthPct === null
          ? '本月实扣或月配额有一侧没有读数，占比不算'
          : `本月实扣 ${usd(monthActual)} ÷ 月配额 ${usd(quota)}`,
    },
    {
      key: 'forecast',
      label: '预估月底',
      value: forecast === null ? '—' : usd(forecast),
      title:
        forecast === null
          ? '本月实扣没有读数，无法外推月底金额'
          : `推算（非账本读数）：本月实扣 ÷ 已过 ${bjDay} 天 × ${daysInMonth} 天 = ${usd(forecast)}`,
    },
    {
      key: 'waste',
      label: '浪费',
      value: '—',
      title: '浪费金额没有读口：运行成本没有按成功 / 失败分账，算不出失败运行烧掉的钱',
    },
    {
      key: 'coverage',
      label: '账本覆盖率',
      value: coveredDay === null ? '—' : `${coveredDay} / ${denom ?? '—'}`,
      title:
        missingDay !== null && missingDay > 0
          ? `日账本缺 ${missingDay} 名员工的记录：缺员时今日实扣不上屏，也不拿月数字顶位`
          : '日账本行数 / 员工分母',
    },
  ];
  const quotaLeft = quota !== null && monthActual !== null ? quota - monthActual : null;
  const costSub1 =
    monthActual !== null && quota !== null
      ? `本月 ${usd(monthActual)} / ${usd(quota)}${monthPct !== null ? ` · ${monthPct}%` : ''}`
      : monthActual !== null
        ? `本月 ${usd(monthActual)}`
        : quota !== null
          ? `月配额 ${usd(quota)}`
          : '—';
  const costSub2 =
    quotaLeft !== null
      ? `月配额剩余 ${usd(quotaLeft)}`
      : monthPct !== null
        ? `月配额已用 ${monthPct}%`
        : '—';

  /* ---------- 带底：全页唯一的缺读口声明 ---------- */
  const gapParts = [
    ...(displayCost === null ? ['今日实扣'] : []),
    '日上限',
    ...(quota === null ? ['月配额'] : []),
    ...(monthActual === null ? ['本月实扣'] : []),
    '浪费',
    '今日运行人数',
    ...(kpis.atRisk === null ? ['风险口径'] : []),
    ...(v3Excluded ? ['V3 强制引用策略'] : []),
  ];

  return (
    <div className="ov5-kpistrip" data-testid="ov6-kpi-strip" data-busy={busy ? '1' : undefined}>
      <div className="ov5-kpis-row">
        <KpiCard
          testid="ov6-kpi-employees"
          duty="duty-kpi-employees"
          label="可上岗"
          icon={<IconUsers className="ov5-i ov5-i-13" />}
          value={
            confirmed === null || decidableDenom === null ? (
              <UnknownValue />
            ) : (
              `${confirmed} / ${decidableDenom}`
            )
          }
          subs={[
            { text: readySub, testid: 'ov6-kpi-employees-sub', title: `受限=可判定门未过的人数${topGate ? `；拦下最多的是「${topGate.name}」，${topGate.fail} 人` : ''}` },
            { text: gateStrip, testid: 'ov6-kpi-employees-sub2', title: '四门固定序：群@ / ReBAC / 引用 / 审批；✓=通过人数、✗=未过人数、未接=该门没有读口、—=本轮没有回答。明细在浮层里。' },
          ]}
          popover={{
            title: '可上岗 · 四门逐门明细（引用门无读口，不进分母）',
            sections: [
              { key: 'gates', title: '四门', rows: gateRows },
              {
                key: 'blocked',
                title: `受限 ${buckets === null ? '—' : buckets.failing} 人 · 被哪门挡下`,
                rows: blockedRows,
              },
              {
                key: 'buckets',
                title: '三段人数（分母 = 目录里在册的可判定员工）',
                rows: [
                  {
                    key: 'ready',
                    label: '可上岗',
                    value:
                      buckets === null ? '—' : `${buckets.confirmed} 人 · ${pct(buckets.confirmed) ?? '—'}%`,
                    tone: 'ok',
                    title: '可判定门全部通过的人数 / 分母',
                  },
                  {
                    key: 'limited',
                    label: '受限',
                    value:
                      buckets === null ? '—' : `${buckets.failing} 人 · ${pct(buckets.failing) ?? '—'}%`,
                    tone: 'bad',
                    title: '至少一门可判定门未过的人数 / 分母',
                  },
                  {
                    key: 'paused',
                    label: '停用',
                    value: paused === null ? '—' : `${paused} 人 · ${pct(paused) ?? '—'}%`,
                    title: '员工统计 byLifecycle.paused（当前停用，不进可上岗交集）',
                  },
                ],
              },
            ],
          }}
          status={{
            tone: readyGapLabels.length === 0 && unknownGates.length === 0 ? 'ok' : 'unknown',
            title: `数据源 ${coverageReady}/5${
              readyGapLabels.length > 0 ? ` · 缺：${readyGapLabels.join('、')}` : ''
            }`,
          }}
          bar={{
            label: '可上岗 / 受限 / 未知占比',
            fullUnknown: buckets === null,
            segments:
              buckets === null
                ? []
                : [
                    { key: 'ok', w: pct(buckets.confirmed) ?? 0 },
                    { key: 'bad', w: pct(buckets.failing) ?? 0 },
                    { key: 'unknown', w: pct(buckets.pending) ?? 0 },
                  ],
          }}
          issues={[
            { label: '员工统计', state: data.employees, gap: OVERVIEW_GAP.employees },
            ...(matrix.k === 'error'
              ? [{ label: '风险矩阵', state: matrix, gap: OVERVIEW_GAP.risk }]
              : []),
          ]}
          onRetry={onRetry}
        />
        <KpiCard
          testid="ov6-kpi-runs"
          duty="duty-kpi-runs"
          label="今日运行"
          icon={<IconGauge className="ov5-i ov5-i-13" />}
          value={kpis.runs === null ? <UnknownValue /> : kpis.runs}
          unit={kpis.runs === null ? undefined : '次'}
          subs={[
            { text: runSub1, testid: 'ov6-kpi-runs-sub', title: '在跑取 totals.running；今日 0 次且列表为空时可证明在跑为 0' },
            { text: runSub2, testid: 'ov6-kpi-runs-sub2', title: '成功 / 取消取运行统计 totals 的真读数；没有该字段时整段省略，不补 0' },
          ]}
          popover={{
            title: '今日运行 · 北京日窗明细',
            sections: [
              { key: 'runs', title: '运行读数', rows: runRows },
              { key: 'window', title: '窗口与样本', rows: runWindowRows },
            ],
          }}
          status={{
            tone: data.todayStats.k === 'ready' && data.todayRuns.k === 'ready' ? 'ok' : 'unknown',
            title: `数据源 ${
              [data.todayStats.k === 'ready', data.todayRuns.k === 'ready'].filter(Boolean).length
            }/2`,
          }}
          bar={{
            label: '今日运行成功 / 失败 / 其它占比',
            fullUnknown: kpis.runs === null || kpis.runs === 0,
            segments: [
              { key: 'ok', w: pctOf(succeeded) },
              { key: 'bad', w: pctOf(kpis.failed) },
              { key: 'unknown', w: Math.max(0, 100 - pctOf(succeeded) - pctOf(kpis.failed)) },
            ],
          }}
          issues={[{ label: '运行统计', state: data.todayStats, gap: OVERVIEW_GAP.runs }]}
          onRetry={onRetry}
        />
        <KpiCard
          testid="ov6-kpi-cost"
          duty="duty-kpi-cost"
          label="今日成本"
          icon={<IconCoins className="ov5-i ov5-i-13" />}
          value={displayCost === null ? <UnknownValue /> : usd(displayCost)}
          subs={[
            { text: costSub1, testid: 'ov6-kpi-cost-sub', title: '本月实扣 ÷ 月配额（月配额 = 能力矩阵各员工 monthlyCostUsd 之和）' },
            { text: costSub2, testid: 'ov6-kpi-cost-sub2', title: '月配额剩余 = 月配额 − 本月实扣，两项都有真读数才算' },
          ]}
          popover={{
            title: '今日成本 · 账本与配额明细',
            sections: [{ key: 'cost', title: '账本读数', rows: costRows }],
          }}
          status={{
            tone: displayCost !== null && monthPct !== null ? 'ok' : 'unknown',
            title: `数据源 ${
              [data.budgetDay.k === 'ready', data.budgetMonth.k === 'ready', quota !== null].filter(
                Boolean,
              ).length
            }/3`,
          }}
          bar={{
            label: '本月实扣占月配额比例',
            fullUnknown: usedPct === null,
            segments: [
              { key: usedPct !== null && usedPct > 90 ? 'bad' : 'ok', w: usedPct ?? 0 },
              { key: 'unknown', w: usedPct === null ? 0 : Math.max(0, 100 - usedPct) },
            ],
          }}
          issues={[{ label: '成本账本', state: data.budgetDay, gap: OVERVIEW_GAP.cost }]}
          onRetry={onRetry}
        />
      </div>
      <div className="ov5-kpis-foot">
        <span className="ov5-kpis-gaps" data-testid="ov6-kpi-gaps">
          {`缺读口：${gapParts.join(' · ')}`}
        </span>
        <Freshness
          items={[
            { source: '员工统计', state: data.stats },
            { source: '运行统计', state: data.todayStats },
            { source: '成本账本', state: data.budgetDay },
            { source: '月账本', state: data.budgetMonth },
            { source: '风险矩阵', state: matrix },
            { source: '四门证据', state: data.readiness ?? { k: 'loading' } },
          ]}
          testid="ov6-kpi-strip-stamp"
        />
      </div>
    </div>
  );
}

/* ============================================================================
 * 三条细长条：发布 / 出站 / 账本（骨架 chainstrip，高约 44px 单行）
 * 每条只放一个真主干：发布=待批数、出站=网关在线、账本=实扣额；
 * 细分字段进 title；完全没有主干时写「未接入」，不铺破折号。
 * ========================================================================== */
function ChainStrip({
  kpis,
  matrix,
  covered,
  pending,
  pendingLoading,
  gateway,
  gatewayLoading,
  platformsOnline,
  platformsTotal,
  liveCostUsd,
  costLoading,
}: {
  kpis: ReturnType<typeof buildKpis>;
  matrix: Loadable<MatrixBody>;
  covered: number | null;
  pending: number | null;
  pendingLoading: boolean;
  gateway: string | null;
  gatewayLoading: boolean;
  platformsOnline: number | null;
  platformsTotal: number | null;
  liveCostUsd: number | null;
  costLoading: boolean;
}) {
  const quota = monthQuota(matrix);
  const actual = kpis.costUsd ?? liveCostUsd;
  const gatewayTone =
    gateway === 'ok' ? 'ok' : gateway === 'degraded' ? 'warn' : gateway === 'down' ? 'bad' : 'unknown';
  const gatewayText =
    gateway === 'ok' ? '网关在线' : gateway === 'degraded' ? '网关降级' : gateway === 'down' ? '网关异常' : '未接入';
  return (
    <div className="ov5-chainstrip">
      <Link
        className="ov5-cs"
        to="/approvals"
        title={`待批 ${pending ?? '未接入'} · 草稿 / 校验失败 / 发布超时：发布链读口未接入`}
      >
        <span className="ov5-cs-k">发布</span>
        <span className="ov5-cs-v">
          {pending === null ? (
            <span className="ov5-cs-na">{pendingLoading ? '读取中' : '未接入'}</span>
          ) : (
            <>
              <b>{pending}</b> 待批
            </>
          )}
          <span className="ov5-cs-na"> · 草稿/校验失败/超时 未接入</span>
        </span>
        <span className="ov5-cs-go">→</span>
      </Link>
      <Link
        className="ov5-cs"
        to="/capabilities?tab=channels"
        title={`${gatewayText} · 成功率 / 拒绝数 / 回执 P95：出站链读口未接入 · 平台 ${platformsOnline ?? '—'}/${platformsTotal ?? '—'} 在线`}
      >
        <span className="ov5-cs-k">出站</span>
        <span className="ov5-cs-v">
          {gateway === null ? (
            <span className="ov5-cs-na">{gatewayLoading ? '读取中' : '未接入'}</span>
          ) : (
            <>
              <i className={`ov5-dot ${gatewayTone}`} />
              {gatewayText}
            </>
          )}
          <span className="ov5-cs-na">
            {' '}
            · 平台 {platformsOnline === null || platformsTotal === null ? '—' : `${platformsOnline}/${platformsTotal}`} 在线
          </span>
        </span>
        <span className="ov5-cs-go">→</span>
      </Link>
      <Link
        className="ov5-cs"
        to="/overview?tab=usage"
        title={`实扣 ${actual === null ? '未接入' : usd(actual)}（${kpis.costUsd !== null ? '成本账本' : '运行统计口径'}）· 覆盖 ${covered ?? '未接入'}/${kpis.total ?? '未接入'} 员工 · 月配额 ${quota === null ? '未接入' : usd(quota)} · 估算 / 对账未接入`}
      >
        <span className="ov5-cs-k">账本</span>
        <span className="ov5-cs-v">
          实扣{' '}
          {actual === null ? (
            <span className="ov5-cs-na">{costLoading ? '读取中' : '未接入'}</span>
          ) : (
            <b>{usd(actual)}</b>
          )}{' '}
          · 覆盖 <b>{covered === null ? '—' : `${covered}/${kpis.total ?? '—'}`}</b> · 月配额{' '}
          <b>{quota === null ? '—' : usd(quota)}</b>
        </span>
        <span className="ov5-cs-go">→</span>
      </Link>
    </div>
  );
}

/* ============================================================================
 * 近 14 天：大字（总次数 · 峰值）+ 200–240px 卡片内的柱图 + 峰值标注 + 脚注
 * ========================================================================== */
function Trend({
  stats,
  trend,
  label = '近 14 天',
  days = 14,
  onRetry,
}: {
  stats: Loadable<RunStatsBody>;
  /** 首选读口（overview 自己的 run-stats 腿，带 totals，可做合计闭合证明）。 */
  trend?: Loadable<RunStatsBody>;
  label?: string;
  days?: number;
  onRetry: () => void;
}) {
  // 首选腿有桶才用；空/失败时回落到 duty 的 workbench timeseries（同形制）。
  const source: Loadable<RunStatsBody> =
    trend && trend.k === 'ready' && (trend.data.buckets?.length ?? 0) > 0 ? trend : stats;
  const rawPoints = source.k === 'ready' ? trendWindow(source.data, days) : [];
  const provenZero = source.k === 'ready' ? provenZeroFill(source.data, rawPoints) : 0;
  // 只有算术闭合证得出来的缺日才补 0；其余仍是 null（缺读数）。
  const points = provenZero > 0
    ? rawPoints.map((point) => (point.runs === null ? { ...point, runs: 0 } : point))
    : rawPoints;
  const allMissing = points.length > 0 && points.every((p) => p.runs === null);
  const allZero = points.length > 0 && points.every((p) => p.runs === 0);
  const max = Math.max(1, ...points.map((p) => p.runs ?? 0));
  const [hovered, setHovered] = useState<number | null>(null);
  // 峰值：首个等于最大读数的日（全零/全缺时没有峰值）。
  const peak = points.reduce<{ index: number; value: number } | null>((best, point, index) => {
    const runs = point.runs;
    if (runs === null || runs <= 0) return best;
    return best === null || runs > best.value ? { index, value: runs } : best;
  }, null);
  const lastWithRuns = points.reduce((best, p, i) => (p.runs !== null ? i : best), -1);
  const activeIndex = hovered !== null && hovered < points.length ? hovered : lastWithRuns;
  const active = activeIndex >= 0 ? points[activeIndex] : null;
  const known = points.filter((p) => p.runs !== null);
  const total = known.reduce((sum, p) => sum + (p.runs as number), 0);
  const missingDays = points.length - known.length;
  const avg = known.length > 0 ? Math.round((total / known.length) * 10) / 10 : null;
  const failedTotal = source.k === 'ready' ? num(source.data.totals?.failed) : null;
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
        {source.k === 'loading' ? (
          <div className="ov5-skeleton" aria-busy="true" aria-label="趋势加载中"><span /><span /><span /></div>
        ) : source.k === 'error' ? (
          <div className="ov5-inline-error" role="alert">
            <IconAlert className="ov5-i ov5-i-16" />
            <span>趋势数据没有读出来。</span>
            <RequestId id={source.requestId} />
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
        ) : (
          <>
            <div className="ov5-hnum">
              <span className="ov5-hnum-v">{total}</span>
              <em>次 · 峰值 {peak ? peak.value : '无'}</em>
            </div>
            <p className="ov5-hsay">
              日均 <b>{avg === null ? '待核实' : avg}</b> 次 · 失败 <b>{failedTotal === null ? '待核实' : failedTotal}</b> ·{' '}
              {missingDays > 0 ? <>缺读数 <b>{missingDays}</b> 天</> : <>缺日按合计闭合补 0 <b>{provenZero}</b> 天</>}
              {peak ? (
                <span className="ov5-hsay-peak">
                  <IconTrendUp className="ov5-i ov5-i-13" />
                  峰值 {peak.value}
                </span>
              ) : null}
            </p>
            <div className="ov5-chart">
              <TrendCurve
                points={points.map((point) => ({ label: point.label, y: point.runs }))}
                height={TREND_CURVE_H}
                pad={TREND_CURVE_PAD}
                testId="ov6-trend-svg"
                ariaLabel={`${label}运行趋势：合计 ${total} 次，峰值 ${peak ? peak.value : '无'} 次，失败 ${failedTotal === null ? '待核实' : failedTotal} 次，缺读数 ${missingDays} 天`}
                peakLabel={(value) => `峰值 ${value}`}
              />
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
            <BlockFoot items={[{ source: '运行统计', state: source }]} testid="ov6-trend-stamp">
              {provenZero > 0
                ? `曲线＝当日运行次数；未返回的 ${provenZero} 天由「各桶之和＝合计 ${total}」算术闭合推得 0，非估数；失败次数在悬停说明里。`
                : '曲线＝当日运行次数；失败次数在悬停说明里；缺读数只断口，不折 0。'}
            </BlockFoot>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ============================================================================
 * 24 小时活跃：大字（峰值时段）+ 24 格热力条（未发生时段画斜线）+ 图例 + 脚注
 * ========================================================================== */
function HourActivity({
  activity,
  label,
  onRetry,
}: {
  activity: Loadable<ActivityBody>;
  label: string;
  onRetry: () => void;
}) {
  const view = activity.k === 'ready' ? dayActivity(activity.data.cells) : null;
  const hourLabel = (hour: number) => (hour < 10 ? `0${hour}` : `${hour}`);
  // 活动腿回包不自带 asOf 时，Freshness 会沿用本页统一采集时刻（见 PageStampContext），
  // 同页不再出现「采集时刻未返回」与「采集 14:19」两套读数。
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
              <span className="ov5-hnum-v">{view.peak ? `${hourLabel(view.peak.hour)}:00` : '无'}</span>
              <em>峰值时段</em>
            </div>
            <p
              className="ov5-hsay"
              title={view.dayLabel ? `取窗口内最活跃的一天：${view.dayLabel}` : undefined}
            >
              峰值 <b>{view.peak ? view.peak.count : '无'}</b> 次/时 · 取窗口内最活跃的一天 · 合计{' '}
              <b>{view.windowTotal}</b> 次
            </p>
            <div className="ov5-heat24">
              <svg
                className="ov5-heat-svg"
                viewBox="0 0 480 30"
                preserveAspectRatio="none"
                role="img"
                aria-label={`按小时统计的运行次数，峰值 ${view.peak ? view.peak.count : '无'} 次/时，窗口合计 ${view.windowTotal} 次`}
              >
                <defs>
                  <pattern id="ov5-heat-na" patternUnits="userSpaceOnUse" width="5" height="5">
                    <rect className="ov5-heat-na-bg" x={0} y={0} width={5} height={5} />
                    <path className="ov5-heat-na-line" d="M0 5 L5 0" />
                  </pattern>
                </defs>
                {view.cells.map((cell) => (
                  <rect
                    key={cell.hour}
                    className={
                      cell.count === null
                        ? 'ov5-heat-cell is-void'
                        : `ov5-heat-cell ov5-heat-lv${cell.level}${view.peak && view.peak.hour === cell.hour ? ' is-peak' : ''}`
                    }
                    x={cell.hour * 20}
                    y={0}
                    width={19}
                    height={30}
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
              <span><i className="h2" />3–4</span>
              <span><i className="h3" />5+</span>
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
function Blockers({
  data,
  onRetry,
  health,
  gateway,
  gatewayLoading,
  pending,
  queueLoading,
}: {
  data: DutyData;
  onRetry: () => void;
  health?: Loadable<HealthSourcesBody>;
  gateway: string | null;
  gatewayLoading: boolean;
  pending: number | null;
  queueLoading: boolean;
}) {
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
  const services =
    health?.k === 'ready' && Array.isArray(health.data.sources) && health.data.sources.length > 0
      ? health.data.sources.length
      : null;
  const gatewayTone =
    gateway === 'ok' ? 'ok' : gateway === 'degraded' ? 'warn' : gateway === 'down' ? 'bad' : 'unknown';
  const gatewayText =
    gateway === 'ok' ? '在线' : gateway === 'degraded' ? '降级' : gateway === 'down' ? '异常' : '未接入';
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
        <div className="ov5-statusline" data-testid="ov6-blocker-status">
          <span className="ov5-stat">
            <i className={`ov5-dot ${gatewayTone}`} />
            网关 <b>{gatewayLoading ? '读取中' : gatewayText}</b>
          </span>
          <span className="ov5-stat">服务 <b>{health?.k === 'loading' ? '读取中' : services ?? '未接入'}</b></span>
          <span className="ov5-stat">客户端 <b>未接入</b></span>
          <span className="ov5-stat">队列 <b>{queueLoading && pending === null ? '读取中' : pending ?? '未接入'}</b></span>
        </div>
        {rows.length === 0 ? (
          <div className="ov5-skelrow">
            <span className="ov5-skelbar" />
            <span className="ov5-skeltext">当前没有阻塞项</span>
          </div>
        ) : (
          <ul className="ov5-rows ov5-rows-blocker">
            {rows.map((row) => {
              // 骨架三态：失败 / 超时 / 滞后（审批未过期时写「待批」，不冒充超时）。
              const tag =
                row.responsibleModule === '运行'
                  ? '失败'
                  : row.responsibleModule === '审批'
                    ? row.overSLA
                      ? '超时'
                      : '待批'
                    : row.overSLA
                      ? '超时'
                      : '滞后';
              const impact =
                row.responsibleModule === '运行'
                  ? 'SLA'
                  : row.responsibleModule === '审批'
                    ? '上岗率'
                    : row.responsibleModule === '任务'
                      ? '派工'
                      : '引用门';
              return (
                <li key={`${row.responsibleModule}-${row.object}`} className="ov5-blkrow">
                  <Badge tone={tag === '失败' ? 'destructive' : 'warning'}>{tag}</Badge>
                  <span className="ov5-bmain">
                    {/* 骨架形制：主行 = 对象 · 阻塞原因；副行 11px = 责任 / 等待 / 影响。
                        不把 schema 字段名连写成「责任·任务·下一步」。 */}
                    <span className="ov5-bline1">
                      {row.object} · {row.reason}
                    </span>
                    <span className="ov5-bline2">
                      责任 {row.waitingOn ?? row.responsibleModule} · 等待{' '}
                      {row.waitingSince ? ageText(row.waitingSince) : '—'} · 影响 {impact}
                    </span>
                  </span>
                  {row.href ? <Link className="ov5-hgo" to={row.href}>去处理</Link> : null}
                </li>
              );
            })}
          </ul>
        )}
        {unavailable ? (
          <div className="ov5-block-error" role="alert">
            <span>有阻塞源未接入，以上是已读到的部分，不代表全部。</span>
            <RequestId id={firstBlockError?.k === 'error' ? firstBlockError.requestId : null} />
            <Button size="sm" outlined onClick={onRetry} data-testid="ov6-blockers-retry">重试</Button>
          </div>
        ) : null}
        <BlockFoot items={blockSources} testid="ov6-blockers-stamp">
          失败运行按一组计；任务与审批每条各一行，缺源不补齐。
        </BlockFoot>
      </CardContent>
    </Card>
  );
}

function PendingCard({ data, onRetry }: { data: DutyData; onRetry: () => void }) {
  const stats = data.approvalStats.k === 'ready' ? data.approvalStats.data : null;
  const pending = stats?.pending ?? null;
  const rows = data.approvals.k === 'ready' ? data.approvals.data.slice(0, 3) : [];
  const issue: KpiIssue[] = [{ label: '审批统计', state: data.approvalStats, gap: OVERVIEW_GAP.approvals }];
  return (
    <Card className="ov5-block" data-testid="ov6-pending-card" data-duty-testid="duty-pending">
      <CardContent
        className="ov5-block-bd"
        data-testid="ov6-kpi-pending"
        data-duty-testid="duty-kpi-pending"
      >
        <div className="ov5-block-hd">
          <h2>
            <IconShield className="ov5-i ov5-i-16" />
            待我处理
            <span className="ov5-hd-note">待审批</span>
          </h2>
          {/* 卡头右侧只留计数（骨架形制）；不再另起「其中待批 / 最早」两行。 */}
          <Link to="/approvals" className="ov5-headcount">
            {pending === null ? '—' : pending} 待批
          </Link>
        </div>
        <div className="ov5-hlist">
          {rows.length === 0 ? (
            <div className="ov5-hrow ov5-emptyrow">
              <span className="ov5-ht">
                {data.approvals.k === 'error'
                  ? '审批列表没有读出来（见上方重试）'
                  : '今天没有待你处理的审批'}
              </span>
            </div>
          ) : (
            rows.map((row) => (
              <div className="ov5-hrow" key={row.approvalId}>
                <span className="ov5-ht" title={row.title ?? row.approvalId}>
                  {row.title ?? '未命名审批'}
                </span>
                <span className="ov5-hm">
                  {ageText(row.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>
        <div className="ov5-pending-foot">
          <IssueRows issues={issue} onRetry={onRetry} testid="ov6-kpi-pending" />
          <Freshness items={[{ source: '审批统计', state: data.approvalStats }]} testid="ov6-kpi-pending-stamp" />
        </div>
      </CardContent>
    </Card>
  );
}

function RecentActivity({ data, onRetry }: { data: DutyData; onRetry: () => void }) {
  const runs = data.recentRuns;
  const names = new Map<string, string>();
  if (data.employees.k === 'ready') {
    for (const emp of data.employees.data) {
      if (emp.employeeId && emp.name) names.set(emp.employeeId, emp.name);
    }
  }
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
          <div className="ov5-skelrow">
            <span className="ov5-skelbar" />
            <span className="ov5-skeltext">尚无运行记录</span>
            <Link className="ov5-skel-link" to="/employees">
              去看数字员工<IconArrowRight className="ov5-i ov5-i-13" />
            </Link>
          </div>
        ) : (
          <div className="ov5-hlist">
            {runs.data.slice(0, 3).map((run) => {
              const name = run.employeeId ? names.get(run.employeeId) : undefined;
              return (
                <div className="ov5-hrow" key={run.runId} data-testid="ov6-activity-row">
                  <Link
                    className="ov5-ht"
                    to={`/runs/${encodeURIComponent(run.runId)}`}
                    title={`${run.runId}${run.startedAt ? ` · 开始 ${beijing(run.startedAt)}（北京时间）` : ''}`}
                  >
                    {runCode(run.runId)}
                    {name ? ` · ${name}` : ''}
                  </Link>
                  <span
                    className={`ov5-runstate ${
                      run.status === 'failed'
                        ? 'failed'
                        : run.status === 'completed'
                          ? 'success'
                          : run.status === 'running'
                            ? 'running'
                            : 'unknown'
                    }`}
                    // OM-07 状态四词表封闭：成功/失败/运行中/—；未知原值不进徽标文本，落 title 供核对。
                    title={run.status && !['failed', 'completed', 'running'].includes(run.status) ? `上游状态：${run.status}` : undefined}
                  >
                    {run.status === 'failed' ? '失败' : run.status === 'completed' ? '成功' : run.status === 'running' ? '运行中' : '—'}
                  </span>
                  <span className="ov5-hm">{shortDuration(run.startedAt, run.endedAt)}</span>
                </div>
              );
            })}
          </div>
        )}
        <p className="ov5-block-foot">最近 3 次 · 耗时取 startedAt→endedAt（亚秒写 &lt;1s）· 详情在运行记录。</p>
      </CardContent>
    </Card>
  );
}

export function OverviewView({
  data,
  matrix,
  probe,
  health,
  summary,
  trend,
  dayStats,
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
  /** /health/sources：阻塞条的服务数。 */
  health?: Loadable<HealthSourcesBody>;
  /** /overview/summary：BFF 聚合的今日成本（运行统计口径）兜底主数字。 */
  summary?: Loadable<OverviewSummaryBody>;
  /** 趋势首选读口（本模块 run-stats 腿，带 totals）；空/失败回落 duty 的 stats14。 */
  trend?: Loadable<RunStatsBody>;
  /** 今日运行明细读口（/run-stats 北京日窗，带 succeeded/cancelled/p95/窗口）。 */
  dayStats?: Loadable<RunStatsBody>;
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
  // 月实扣只认月账本自身；日账本没读到时整卡成本口径不上屏（不让月数字孤立显眼）。
  const monthActual =
    data.budgetDay.k === 'ready' && budgetMonth
      ? sumCost(budgetMonth.items as Array<{ costUsd?: number | null }> | undefined)
      : null;
  const liveCostUsd =
    summary?.k === 'ready' ? num(summary.data.todayCostUsd?.value) : null;
  // 单卡不再画无轴火花小图：14 天趋势只由下方的 Trend 块承担，避免「图坏了」的观感。
  // 在跑数：先认统计源的 totals.running；今日总运行数为 0 时，列表为空即可证明在跑=0。
  // 其它情况（今日有运行但统计没给 running）保持「—」，不拿前 3 行列表冒充全量。
  const runningFromEmptyList =
    data.todayRuns.k === 'ready' && kpis.runs === 0 ? 0 : null;
  const runningToday =
    data.todayStats.k === 'ready' ? data.todayStats.data?.totals?.running ?? runningFromEmptyList : null;
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
  // 首屏元数据等全部读口（含四门证据/探针/健康/聚合）落定再出数字：
  // 否则截图会停在半加载态，把「读取中」误读成占位词。
  const criticalWaiting =
    anyLoading ||
    (data.readiness !== undefined && data.readiness.k === 'loading') ||
    (probe !== undefined && probe.k === 'loading') ||
    (health !== undefined && health.k === 'loading') ||
    (summary !== undefined && summary.k === 'loading') ||
    (dayStats !== undefined && dayStats.k === 'loading');
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
  // 平台在线数只为出站条的第二组读数，来源就是同一份探针回包。
  const platformStates =
    probeGateway && probeGateway.platforms && typeof probeGateway.platforms === 'object'
      ? Object.values(probeGateway.platforms as Record<string, unknown>)
      : null;
  const platformsTotal = platformStates ? platformStates.length : null;
  const platformsOnline = platformStates
    ? platformStates.filter((row) => {
        return (
          typeof row === 'object' &&
          row !== null &&
          (row as { state?: unknown }).state === 'connected'
        );
      }).length
    : null;
  const probeForStamp: Loadable<unknown> =
    probeState.k === 'ready' ? { k: 'ready', data: { asOf: probeUpdatedAt } } : (probeState as Loadable<unknown>);
  const probeText = probeStatus
    ? HEALTH_LABEL[probeStatus] ?? probeStatus
    : probeState.k === 'error'
      ? '未接'
      : '—';
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
    <PageStampContext.Provider value={summaryAsOf}>
    <section className="ov5-page" data-testid="ov6-page">
      <header className="ov5-head">
        <div className="ov5-head-main">
          {/* 全站只有外壳 TopBar 一个 <h1>：模块内不再重复标题，页头只留一行元数据。 */}
          <div className="ov5-facts">
            {criticalWaiting ? (
              <AsofLine states={[]} waiting />
            ) : (
              <>
                <AsofLine states={[data.stats, data.todayStats, data.employees, data.approvalStats, data.budgetDay]} />
                <span className="ov5-fact"><b>{dashed(kpis.total)}</b> 名数字员工</span>
                <span className="ov5-fact">
                  {runningToday === null ? <>在跑 <b>—</b></> : <><b>{runningToday}</b> 个运行在跑</>}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="ov5-head-actions">
          {onRange ? (
            <label className="ov5-range-chip" title="时间范围">
              <span className="ov5-range-chip-k">时间</span>
              <select
                data-testid="ov6-range"
                aria-label="时间窗"
                value={rangeId}
                onChange={(event) => onRange(event.target.value as DutyRangeId)}
              >
                {DUTY_RANGES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
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
          <Button
            size="sm"
            onClick={onRetry}
            disabled={loading || anyLoading}
            aria-busy={loading || anyLoading}
            data-testid="ov6-refresh"
            prefix={<IconRefresh className={`ov5-i ov5-i-14 ${loading || anyLoading ? 'ov5-spin' : ''}`} />}
          >
            刷新
          </Button>
          <details className="ov5-more">
            <summary className="ov5-more-btn" data-testid="ov6-more">
              更多
            </summary>
            <div className="ov5-more-menu">
              <button type="button" className="ov5-more-item" data-testid="ov6-summary-copy" onClick={copySummary}>
                <IconCopy className="ov5-i ov5-i-13" />
                复制摘要
              </button>
              {copyState === 'ok' ? (
                <span className="ov5-more-state" role="status" data-testid="ov6-summary-copy-ok">
                  <IconCheck className="ov5-i ov5-i-13" />
                  已复制到剪贴板
                </span>
              ) : null}
              {copyState === 'fail' ? (
                <span className="ov5-more-state" role="status" data-testid="ov6-summary-copy-fail">
                  复制失败：已选中摘要文本，可手动复制。
                </span>
              ) : null}
              <button
                type="button"
                className="ov5-more-item"
                data-testid="ov6-search"
                disabled
                title="搜索读口未接入：⌘K 暂不可用"
              >
                <IconSearch className="ov5-i ov5-i-13" />
                搜索 ⌘K
              </button>
              <button
                type="button"
                className="ov5-more-item"
                data-testid="ov6-export"
                disabled
                title="导出接口未接入：日报导出暂不可用"
              >
                <IconDownload className="ov5-i ov5-i-13" />
                导出日报
              </button>
            </div>
          </details>
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

      {/* 首读时不盖整页骨架：带内每段自带「读取中 / —」形制，页面不会先空一块再跳版。 */}
      <KpiStrip
        data={data}
        matrix={matrix}
        kpis={kpis}
        monthActual={monthActual}
        liveCostUsd={liveCostUsd}
        dayStats={dayStats}
        busy={anyLoading}
        onRetry={onRetry}
      />

      <ChainStrip
        kpis={kpis}
        matrix={matrix}
        covered={costView.covered}
        pending={approvalStats?.pending ?? null}
        pendingLoading={data.approvalStats.k === 'loading'}
        gateway={probeStatus}
        gatewayLoading={probeState.k === 'loading'}
        platformsOnline={platformsOnline}
        platformsTotal={platformsTotal}
        liveCostUsd={liveCostUsd}
        costLoading={data.budgetDay.k === 'loading' || summary?.k === 'loading'}
      />

      <div className="ov5-homegrid r2">
        <Trend stats={data.stats14} trend={trend} label={range.label} days={range.days} onRetry={onRetry} />
        <HourActivity
          activity={data.activity}
          label={range.label}
          onRetry={onRetry}
        />
      </div>

      <div className="ov5-homegrid r3">
        <Blockers
          data={data}
          onRetry={onRetry}
          health={health}
          gateway={probeStatus}
          gatewayLoading={probeState.k === 'loading'}
          pending={approvalStats?.pending ?? null}
          queueLoading={data.approvalStats.k === 'loading'}
        />
        <PendingCard data={data} onRetry={onRetry} />
        <RecentActivity data={data} onRetry={onRetry} />
      </div>

      <footer className="ov5-pagefoot">
        <span>只展示已接通读口的数据，缺失显示「—」 · 采集 {summaryAsOf ?? '—'}（北京时间） · SEAKOI · 数字员工控制台</span>
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
    </PageStampContext.Provider>
  );
}

function LiveOverview({ rangeId, onRange, rangeInvalid }: { rangeId: DutyRangeId; onRange: (id: DutyRangeId) => void; rangeInvalid: string | null }) {
  // OM-17：本页新增 24 小时活跃，活动腿改为按档位真读（weeks 随 range 走）。
  const { data, reload, loading } = useDutyData(rangeId, { activity: true });
  const [matrix, setMatrix] = useState<Loadable<MatrixBody>>({ k: 'loading' });
  // OM-15：服务探针独立腿；取不到就显示未接，不拿本页读数冒充服务健康。
  const [probe, setProbe] = useState<Loadable<HermesSummaryBody>>({ k: 'loading' });
  // 阻塞条服务数 + 今日成本兜底：都走 BFF 现成端点，取不到就写未接入。
  const [health, setHealth] = useState<Loadable<HealthSourcesBody>>({ k: 'loading' });
  const [summary, setSummary] = useState<Loadable<OverviewSummaryBody>>({ k: 'loading' });
  // 趋势首选腿：run-stats 带 totals，缺日可做合计闭合证明；失败则回落 stats14。
  const [trend, setTrend] = useState<Loadable<RunStatsBody>>({ k: 'loading' });
  // 今日运行明细腿：/run-stats 北京日窗；今日运行卡浮层的成功/取消/P95/窗口都靠它。
  const [dayStats, setDayStats] = useState<Loadable<RunStatsBody>>({ k: 'loading' });

  const loadMatrix = useCallback(() => {
    setMatrix({ k: 'loading' });
    void load(fetchMatrix).then(setMatrix);
  }, []);

  const loadTrend = useCallback(() => {
    setTrend({ k: 'loading' });
    void load(() => fetchTrendRuns(dutyRange(rangeId).days)).then(setTrend);
  }, [rangeId]);

  useEffect(() => {
    loadTrend();
  }, [loadTrend]);

  const loadDayStats = useCallback(() => {
    setDayStats({ k: 'loading' });
    const win = beijingDayWindow();
    void load(() => fetchRunStats(win.from, win.to, 'day')).then(setDayStats);
  }, []);

  const loadProbe = useCallback(() => {
    setProbe({ k: 'loading' });
    void load(fetchHermesSummary).then(setProbe);
  }, []);

  const loadHealth = useCallback(() => {
    setHealth({ k: 'loading' });
    void load(fetchHealthSources).then(setHealth);
  }, []);

  const loadSummary = useCallback(() => {
    setSummary({ k: 'loading' });
    void load(fetchOverviewSummary).then(setSummary);
  }, []);

  useEffect(() => {
    loadMatrix();
    loadProbe();
    loadHealth();
    loadSummary();
    loadTrend();
    loadDayStats();
  }, [loadMatrix, loadProbe, loadHealth, loadSummary, loadTrend, loadDayStats]);

  const retry = useCallback(() => {
    loadMatrix();
    loadProbe();
    loadHealth();
    loadSummary();
    loadTrend();
    loadDayStats();
    reload();
  }, [loadMatrix, loadProbe, loadHealth, loadSummary, loadTrend, loadDayStats, reload]);

  const hasError =
    matrix.k === 'error' ||
    probe.k === 'error' ||
    health.k === 'error' ||
    summary.k === 'error' ||
    Object.values(data).some((state) => state.k === 'error');

  // The domain service can restart underneath us. Keep one quiet retry in
  // flight while any source is down so a recovered service fills in without
  // a manual reload; a click on retry simply restarts the same path.
  useEffect(() => {
    if (!hasError) return;
    const timer = window.setTimeout(retry, 20_000);
    return () => window.clearTimeout(timer);
  }, [hasError, retry]);

  return (
    <OverviewView
      data={data}
      matrix={matrix}
      probe={probe}
      health={health}
      summary={summary}
      trend={trend}
      dayStats={dayStats}
      loading={loading}
      onRetry={retry}
      rangeId={rangeId}
      onRange={onRange}
      rangeInvalid={rangeInvalid}
    />
  );
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
      <section className="ov5-page" data-testid="ov6-page">
        <div className="ov5-skeleton" aria-busy="true" aria-label="总览加载中" data-testid="ov6-loading"><span /><span /><span /></div>
      </section>
    );
  }
  if (forced === 'empty') {
    return (
      <section className="ov5-page" data-testid="ov6-page">
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
      <section className="ov5-page" data-testid="ov6-page">
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