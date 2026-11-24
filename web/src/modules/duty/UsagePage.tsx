/**
 * T11 · 用量与成本（`#/overview?tab=usage`） — duty module, read-only.
 *
 * 骨架 console-v4-skeleton.html 2037–2081 的卡式密度版。五条读取腿：
 *   主读口  GET /agent-api/api/hermes-usage?days=<1|7|30>（四态由它驱动）
 *   趋势腿  GET /agent-api/api/run-stats?from&to&bucket=day（北京日窗）
 *   近 24h  GET /agent-api/api/hermes-usage?days=1（今日实扣＋读口状态＋归属）
 *   替代指标 GET /agent-api/api/workbench/summary?range=<1d|7d|30d>
 * 辅助腿各自落地：哪条挂掉只让它自己那块写明没有读完，不把整屏降级；
 * 缺读口的条目（预估类）一律正文只留「—」，原因收进卡底「数据可用性」。
 *
 * Money rules (enforced in `usage.ts`, pinned by tests):
 *  - a cost number reaches the screen only when the cost ledger sent it;
 *  - a true zero reads `$0.00`; a missing one reads 「—」 with its reason;
 *  - 「含估算」/「未计价」/非账本来源 are never presented as spent money;
 *  - nothing is re-priced, estimated or summed here, and no path uses `?? 0`.
 * 趋势卡的「成本」列是运行侧汇总，口径行里写明它不是账本实扣。
 *
 * The 统计窗口 filter is real — picking 24h / 7d / 30d changes the `days`
 * parameter of the main leg and the `range` of the KPI leg (asserted in
 * usage.test.ts and the page test); the trend and the 24h legs do not move.
 * Raw ids, status tokens, ISO instants and HTTP codes live in `title` and the
 * collapsed 「技术详情」 only. `?state=` repro legs fetch nothing and carry
 * the GAP number they belong to (GAP-07) in on-screen copy; every control
 * on a repro leg is disabled with its reason, never a dead click.
 */
import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { Check, ChevronDown, ChevronUp, Copy, Gauge, Inbox, RefreshCw, ShieldAlert, TriangleAlert } from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { ConsoleCard } from "@/components/console/ConsoleCard";
import { StatValue } from "@/components/console/StatValue";
import { copyTextToClipboard } from "@/lib/clipboard";

import { useUsageData } from "./useUsageData";
import {
  DEFAULT_USAGE_WINDOW,
  GAP,
  USAGE_WINDOWS,
  forcedStateOf,
  requestIdLine,
  windowLabel,
  usageUrl,
  type FailureCopy,
  type MoneyCell,
  type UsageWindowKey,
} from "./usage";
import { ConsoleSelect } from "@/shell/ConsoleSelect";
import { usd } from "./format";
import { panelUrls, useUsagePanels, type NearDayPanel, type Panel, type TrendPanel } from "./usagePanels";
import { legShortText, type SourceLeg } from "./usageSources";
import {
  niceTicks,
  scaleY,
  tickText,
  type Ticks,
  type TrendDay,
} from "./usageTrend";

/** 请求编号's own honest word when the answer carried none. */
const NO_REQUEST_ID = "未提供";

/** Why the header/panel buttons sleep on a repro leg. */
const FORCED_TITLE = "复现腿不发起真实请求，去掉 ?state= 即为真实读取";

/** 「—」 with the reason in its `title`, so a gap reads as a gap. */
function Dashed({ reason }: { reason: string }): ReactNode {
  return (
    <span className="min-w-0 break-words text-muted-foreground" title={reason}>
      —
    </span>
  );
}

/** Token counts with separators; an absent count is 「—」 with a reason, never 0. */
function tokenText(value: number | null): ReactNode {
  if (value === null) return <Dashed reason="这个读数未随回答发送" />;
  return value.toLocaleString("en-US");
}

/**
 * One ledger amount. A real number (including a true 0) shows `$x.xx`;
 * anything else shows 「—」, with the reason beside it on cards and in the
 * cell's `title` inside tables.
 */
function MoneyText({ cell, testId, besideReason }: { cell: MoneyCell; testId: string; besideReason: boolean }): ReactNode {
  if (cell.text === "—") {
    return (
      <span
        className="min-w-0 break-words"
        data-testid={testId}
        title={[cell.reason, ...cell.technical].filter((line) => line).join("；") || undefined}
      >
        —
        {besideReason && cell.reason ? (
          <span className="ml-1 text-xs font-normal text-muted-foreground">{cell.reason}</span>
        ) : null}
      </span>
    );
  }
  return (
    <span className="min-w-0 break-words tabular-nums" data-testid={testId} title={cell.technical[0] ?? undefined}>
      {cell.text}
    </span>
  );
}

// R31 fixture-debt burn: `?state=` repros carry no fixture attribute;
// the on-screen copy states they are a repro, not a service answer.

/** What a repro panel says so nobody reads it as a service answer. */
function ReproNote({ state }: { state: string }): ReactNode {
  return (
    <p className="min-w-0 break-words text-xs text-warning" data-testid="usg4-forced-note">
      {`这是用 ?state=${state} 复现出来的状态，不是服务此刻的回答；账本实扣数据尚未在本环境接通（${GAP}）。`}
    </p>
  );
}

function CopyValue({ value, reason, label, testId }: { value: string | null; reason: string; label: string; testId: string }): ReactNode {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  if (!value) {
    return (
      <span className="min-w-0 break-words text-white/60" data-testid={`${testId}-absent`} title={reason}>
        {NO_REQUEST_ID}
      </span>
    );
  }
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5" data-testid={testId}>
      <span className="min-w-0 break-all font-mono text-xs text-white/80">{value}</span>
      <button
        type="button"
        aria-label={`复制${label}`}
        title="复制"
        className="inline-flex shrink-0 items-center gap-1 text-xs text-white/60 underline underline-offset-2"
        onClick={() => {
          void copyTextToClipboard(value).then((ok) => {
            setCopied(ok ? "done" : "failed");
            if (ok) window.setTimeout(() => setCopied("idle"), 2500);
          });
        }}
      >
        {copied === "done" ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
        {copied === "done" ? "已复制" : copied === "failed" ? "复制失败，请手动选择" : "复制"}
      </button>
    </span>
  );
}

function RequestIdLine({ requestId, testId }: { requestId: string | null; testId: string }): ReactNode {
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-white/55" data-testid={testId}>
      {requestId ? <span>请求编号：</span> : null}
      <CopyValue value={requestId} reason={requestIdLine(null)} label="请求编号" testId={`${testId}-value`} />
    </p>
  );
}

/** The only place engineering values reach the screen: collapsed, and closed means absent from the DOM. */
function TechnicalDisclosure({ lines, testId }: { lines: string[]; testId: string }): ReactNode {
  const [open, setOpen] = useState(false);
  const shown = lines.filter((line) => line);
  if (!shown.length) return null;
  return (
    <div className="min-w-0 text-xs" data-testid={testId}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-white/50 underline underline-offset-2"
      >
        {open ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />}
        技术详情
      </button>
      {open ? (
        <ul className="mt-1 flex min-w-0 flex-col gap-0.5 break-words font-mono text-white/45">
          {shown.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function LoadingPanel(): ReactNode {
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="usg4-loading" aria-busy="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index}>
          <CardContent className="h-24 animate-pulse p-4" aria-hidden="true" />
        </Card>
      ))}
    </div>
  );
}

function EmptyPanel({
  onRetry,
  windowName,
  fixture,
}: {
  onRetry: () => void;
  windowName: string;
  fixture?: string;
}): ReactNode {
  return (
    <Card data-testid="usg4-empty">
      <CardContent className="flex min-w-0 flex-col items-start gap-2 p-6">
        <div className="flex min-w-0 items-center gap-2">
          <Inbox className="h-5 w-5 shrink-0 text-white/70" aria-hidden="true" />
          <h2 className="min-w-0 break-words text-base font-medium">这个窗口里没有用量记录</h2>
        </div>
        <p className="min-w-0 break-words text-sm text-white/60">
          用量服务对「{windowName}」回了一份数据，里面没有用量读数，也没有账本条目。
          这说明这段时间没有产生计费用的运行，不代表读取失败。
        </p>
        <p className="min-w-0 break-words text-xs text-white/45">下一步：换一个更长的统计窗口，或等运行产生用量后重新读取。</p>
        <Button
          size="sm"
          outlined
          onClick={onRetry}
          disabled={fixture !== undefined}
          title={fixture !== undefined ? FORCED_TITLE : undefined}
          prefix={<RefreshCw className="h-3.5 w-3.5" />}
          data-testid="usg4-empty-retry"
        >
          重新读取
        </Button>
      </CardContent>
    </Card>
  );
}

function ErrorPanel({
  failure,
  onRetry,
  fixture,
}: {
  failure: FailureCopy;
  onRetry: () => void;
  fixture?: string;
}): ReactNode {
  return (
    <Card role="alert" title={failure.technical ?? undefined} data-testid="usg4-error">
      <CardContent className="flex min-w-0 flex-col items-start gap-2 p-6">
        <div className="flex min-w-0 items-center gap-2 text-sm text-white/85">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">用量与成本没能加载出来</span>
        </div>
        <p className="min-w-0 break-words text-sm text-white/60">{failure.sentence}</p>
        <RequestIdLine requestId={failure.requestId} testId="usg4-error-request-id" />
        {failure.technical ? <TechnicalDisclosure lines={[failure.technical]} testId="usg4-error-details" /> : null}
        <Button
          size="sm"
          outlined
          onClick={onRetry}
          disabled={fixture !== undefined}
          title={fixture !== undefined ? FORCED_TITLE : undefined}
          prefix={<RefreshCw className="h-3.5 w-3.5" />}
          data-testid="usg4-retry"
        >
          重试
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * 403 and 404 both land here and read byte-for-byte the same: the pane takes
 * the request id only, so it cannot repeat anything the two answers differ on.
 * No data row is ever drawn above it.
 */
function DeniedPanel({ requestId }: { requestId: string | null }): ReactNode {
  return (
    <Card role="alert" aria-label="用量与成本不可见" data-testid="usg4-denied">
      <CardContent className="flex min-w-0 flex-col items-center gap-2 p-10 text-center">
        <ShieldAlert className="h-6 w-6 text-white/70" aria-hidden="true" />
        <p className="min-w-0 break-words text-sm">暂时看不到用量与成本</p>
        <p className="max-w-prose break-words text-xs text-white/55">
          这块内容要么尚未对你开放，要么当前环境还没有提供它。这里不会显示任何猜测的用量或金额，
          也不会把没读到的东西写成零。需要看到这份数据时，请联系工作区管理员开通用量查看权限，
          或确认后台已接入用量服务（{GAP}）；接通后本页自动显示真实数据。
        </p>
        <RequestIdLine requestId={requestId} testId="usg4-denied-request-id" />
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * 辅助腿的三态小行：只在卡内出现，缺读数就一句话，不拉平等高
 * ------------------------------------------------------------------ */

function LegFallback<T>({ panel, loadingText, testId }: { panel: Panel<T>; loadingText: string; testId: string }): ReactNode {
  if (panel.phase === "loading") {
    return <p className="console-sub">{loadingText}</p>;
  }
  return (
    <p className="console-sub" data-testid={testId}>
      {panel.message ?? "这一路没能读完。"}
      {panel.requestId ? ` 请求编号 ${panel.requestId}。` : ""}页顶「重新读取」可再试一次。
    </p>
  );
}

/* ------------------------------------------------------------------ *
 * 趋势卡：内联 SVG 柱（运行）＋方块折线（运行侧成本），断口不插值
 * ------------------------------------------------------------------ */

const CHART = { w: 700, h: 132, l: 38, r: 14, t: 10, b: 36 } as const;
const PLOT_W = CHART.w - CHART.l - CHART.r;
const PLOT_H = CHART.h - CHART.t - CHART.b;

interface SeriesLine {
  d: string;
  points: Array<{ cx: number; cy: number; key: string; label: string; value: number }>;
}

/** 把成本点连成「相邻有读数日之间」的段——缺读数的日两边一律断线。 */
function costSegments(days: TrendDay[], top: number): SeriesLine[] {
  const slotW = PLOT_W / Math.max(1, days.length);
  const segments: SeriesLine[] = [];
  let current: SeriesLine | null = null;
  days.forEach((day, index) => {
    const has = day.costUsd !== null;
    if (!has) {
      current = null;
      return;
    }
    const cx = CHART.l + slotW * (index + 0.5);
    const cy = CHART.t + scaleY(day.costUsd ?? 0, top, PLOT_H);
    const point = { cx, cy, key: day.key, label: day.label, value: day.costUsd ?? 0 };
    if (current === null) {
      current = { d: `M${cx.toFixed(1)} ${cy.toFixed(1)}`, points: [point] };
      segments.push(current);
    } else {
      current.d += ` L${cx.toFixed(1)} ${cy.toFixed(1)}`;
      current.points.push(point);
    }
  });
  return segments;
}

function TrendChart({ days, maxRuns, maxCost }: { days: TrendDay[]; maxRuns: number; maxCost: number }): ReactNode {
  const runsTicks: Ticks = niceTicks(maxRuns, 4, 0);
  const costTicks: Ticks = niceTicks(maxCost, 4, 2);
  const slotW = PLOT_W / Math.max(1, days.length);
  const barW = Math.min(34, slotW * 0.46);
  const readCount = days.filter((day) => day.hasReading).length;
  const baseline = CHART.t + PLOT_H;
  const segments = costSegments(days, costTicks.top);

  return (
    <svg
      viewBox={`0 0 ${CHART.w} ${CHART.h}`}
      className="usg4-trend-svg block h-auto w-full min-w-0"
      style={{ aspectRatio: `${CHART.w} / ${CHART.h}` }}
      role="img"
      aria-label={`近 7 天趋势：${days.length} 天里 ${readCount} 天有读数，柱为当日运行数，方块连线为运行侧成本`}
      data-testid="usg4-trend-chart"
    >
      {runsTicks.values.slice(1).map((value) => {
        const y = CHART.t + scaleY(value, runsTicks.top, PLOT_H);
        return (
          <g key={`grid-${value}`}>
            <line x1={CHART.l} x2={CHART.w - CHART.r} y1={y} y2={y} style={{ stroke: "var(--color-border-subtle-ls)" }} strokeWidth={1} />
            <text x={CHART.l - 6} y={y + 3} textAnchor="end" fontSize={10} style={{ fill: "var(--color-text-subtle-ls)" }}>
              {tickText(value, runsTicks.decimals)}
            </text>
          </g>
        );
      })}
      {days.map((day, index) => {
        const cx = CHART.l + slotW * (index + 0.5);
        return (
          <g key={day.key}>
            {!day.hasReading ? (
              <rect
                x={cx - slotW * 0.42}
                y={CHART.t}
                width={slotW * 0.84}
                height={PLOT_H}
                rx={2}
                opacity={0.34}
                style={{ fill: "var(--color-text-faint-ls)" }}
              />
            ) : null}
            {day.runs !== null ? (
              <rect
                x={cx - barW / 2}
                y={CHART.t + scaleY(day.runs, runsTicks.top, PLOT_H)}
                width={barW}
                height={Math.max(1, baseline - (CHART.t + scaleY(day.runs, runsTicks.top, PLOT_H)))}
                rx={1.5}
                style={{ fill: "var(--color-info-ls)" }}
              >
                <title>{`${day.label} 运行 ${day.runs}`}</title>
              </rect>
            ) : null}
            <text x={cx} y={CHART.h - 12} textAnchor="middle" fontSize={11} style={{ fill: "var(--color-text-subtle-ls)" }}>
              {day.label}
            </text>
          </g>
        );
      })}
      {segments.map((segment) => (
        <path
          key={segment.points[0]?.key ?? segment.d}
          d={segment.d}
          fill="none"
          strokeWidth={1.6}
          style={{ stroke: "var(--color-warning-ls)" }}
        />
      ))}
      {segments.flatMap((segment) =>
        segment.points.map((point) => (
          <rect
            key={`dot-${point.key}`}
            x={point.cx - 2.6}
            y={point.cy - 2.6}
            width={5.2}
            height={5.2}
            style={{ fill: "var(--color-warning-ls)" }}
          >
            <title>{`${point.label} 运行侧成本 ${usd(point.value)}`}</title>
          </rect>
        )),
      )}
    </svg>
  );
}

function TrendCardBody({ panel }: { panel: Panel<TrendPanel> }): ReactNode {
  if (panel.phase !== "ready" || !panel.data) {
    return <LegFallback panel={panel} loadingText="正在读近 7 天的日窗。" testId="usg4-trend-fallback" />;
  }
  const { days, summary, offWindow } = panel.data;
  return (
    <>
      <TrendChart days={days} maxRuns={summary.maxRuns} maxCost={summary.maxCost} />
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px]" style={{ color: "var(--color-text-muted-ls)" }}>
        <span className="inline-flex items-center gap-1">
          <i aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: "var(--color-info-ls)" }} />
          运行
        </span>
        <span className="inline-flex items-center gap-1">
          <i aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 1, background: "var(--color-warning-ls)" }} />
          成本
        </span>
        <span className="inline-flex items-center gap-1">
          <i aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: "var(--color-text-faint-ls)", opacity: 0.34 }} />
          无读数断口
        </span>
        {summary.empty ? (
          <span data-testid="usg4-trend-empty">这七天没有任何可读的桶；图上只画断口，不补零。</span>
        ) : (
          <>
            {summary.peak ? <span>峰值 {summary.peak.label} {summary.peak.runs?.toLocaleString("en-US")} 次</span> : null}
            {summary.runsAvg !== null ? <span>日均 {Math.round(summary.runsAvg).toLocaleString("en-US")} 次（按有读数的 {summary.readDays} 天）</span> : null}
            {summary.missingDays > 0 ? <span>{summary.missingDays} 天没有读数</span> : null}
          </>
        )}
      </div>
      <div className="mt-2 min-w-0">
        <div
          className="console-grid-row console-grid-head"
          style={{ gridTemplateColumns: "minmax(0,1fr) 52px 64px 64px" }}
        >
          <span className="console-grid-head__cell">日期</span>
          <span className="console-grid-head__cell console-grid-head__cell--right">运行</span>
          <span className="console-grid-head__cell console-grid-head__cell--right">成本</span>
          <span className="console-grid-head__cell console-grid-head__cell--right">单次均值</span>
        </div>
        {days.map((day) => (
          <div
            key={day.key}
            className="console-grid-row console-mono"
            style={{ gridTemplateColumns: "minmax(0,1fr) 52px 64px 64px", minHeight: 34 }}
            data-testid={`usg4-trend-row-${day.label}`}
          >
            <span className="console-grid-row__cell">{day.label}</span>
            <span className="console-grid-row__cell console-grid-row__cell--right">
              {day.runs !== null ? day.runs.toLocaleString("en-US") : "无读数"}
            </span>
            <span className="console-grid-row__cell console-grid-row__cell--right">
              {day.costUsd !== null ? usd(day.costUsd) : "无读数"}
            </span>
            <span className="console-grid-row__cell console-grid-row__cell--right">
              {day.avgCostUsd !== null ? usd(day.avgCostUsd) : day.hasReading ? "不可派生" : "无读数"}
            </span>
          </div>
        ))}
        {offWindow > 0 ? (
          <p className="console-sub pt-1">{`${offWindow} 个桶落在窗外或读不出日期，没有画。`}</p>
        ) : null}
        {days.some((day) => day.estimatedRuns > 0) ? (
          <p className="console-sub pt-1">{`其中 ${days.reduce((sum, day) => sum + day.estimatedRuns, 0)} 条运行被标为估算，成本列按服务原值呈现。`}</p>
        ) : null}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * 投影去向腿的读口行
 * ------------------------------------------------------------------ */

function SourceLegRow({ leg }: { leg: SourceLeg }): ReactNode {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-x-3" style={{ minHeight: 30 }}>
      <span className="min-w-0 break-words" style={{ fontSize: "var(--font-size-ls-1)" }}>
        {legShortText(leg)}
      </span>
      <span className="console-mono shrink-0 text-right text-[10px]" title={`${leg.rawKey}${leg.reason ? ` ${leg.reason}` : ""}`} style={{ color: "var(--color-text-faint-ls)" }}>
        {leg.rawKey}
      </span>
    </div>
  );
}

/** 近 24 小时腿里读口行的就绪正文。 */
function nearDayReads(data: NearDayPanel): {
  today: ReactNode;
  legs: ReactNode;
  attribution: ReactNode;
} {
  const today = data.cost ? (
    <span className="flex min-w-0 flex-col gap-0.5" title="读口：近 24 小时账本块">
      <span className="console-mono">
        <MoneyText cell={data.cost.cell} testId="usg4-today-total" besideReason={false} />
        {data.cost.entries !== null ? <span className="ml-1 text-[11px]" style={{ color: "var(--color-text-subtle-ls)" }}>· {data.cost.entries.toLocaleString("en-US")} 条</span> : null}
      </span>
      <span className="text-[11px]" style={{ color: "var(--color-text-subtle-ls)" }}>{data.cost.cell.statusLabel}</span>
    </span>
  ) : (
    <Dashed reason="近 24 小时的回答没有带成本账本块" />
  );

  const legs = data.sources.length ? (
    data.sources.map((leg) => <SourceLegRow key={leg.rawKey} leg={leg} />)
  ) : (
    <p className="console-sub">读口状态未随这份回答发送，这里不假装都好。</p>
  );

  const attribution = data.attribution && data.attribution.anyValue ? (
    <p className="console-sub" title={data.attribution.note ?? undefined}>
      {`${data.attribution.unattributedSessions ?? 0} 个会话没有归属到员工，实测 ${data.attribution.input?.toLocaleString("en-US") ?? "无"} 输入 / ${data.attribution.output?.toLocaleString("en-US") ?? "无"} 输出 token。这是会话统计腿的实测，不是总量。`}
    </p>
  ) : null;

  return { today, legs, attribution };
}

/* ------------------------------------------------------------------ *
 * KPI 小格（卡内 tile，按内容高度排，不拉平）
 * ------------------------------------------------------------------ */

function KpiTile({ label, value, sub, title }: { label: string; value: ReactNode; sub?: ReactNode; title?: string }): ReactNode {
  return (
    <div className="flex min-w-0 flex-col gap-1" title={title}>
      <span className="console-card__label" style={{ textTransform: "none" }}>{label}</span>
      <span className="min-w-0 break-words text-2xl font-medium tabular-nums" style={{ fontFamily: "var(--font-family-mono-ls)" }}>{value}</span>
      {sub ? <span className="min-w-0 break-words text-[11px]" style={{ color: "var(--color-text-subtle-ls)" }}>{sub}</span> : null}
    </div>
  );
}

const SUMMARY_KPI_WORDS: Record<string, string> = {
  runs: "窗口运行",
  succeeded: "成功",
  failed: "失败",
  running: "运行中",
  pendingApprovals: "待审批",
};

export function UsagePage() {
  const [params] = useSearchParams();
  const forced = forcedStateOf(params.get("state"));
  const [windowKey, setWindowKey] = useState<UsageWindowKey>(DEFAULT_USAGE_WINDOW);
  const [nonce, setNonce] = useState(0);
  const { phase, read, failure, reload, forced: isForced } = useUsageData(forced, windowKey);
  const panels = useUsagePanels(forced === null, windowKey, nonce);
  const fixture = forced ?? undefined;

  const reloadAll = (): void => {
    reload();
    setNonce((value) => value + 1);
  };

  const header = (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
      <Gauge className="h-5 w-5 shrink-0 text-white/70" aria-hidden="true" />
      <h2 className="min-w-0 break-words font-mondwest text-xl font-medium">用量与成本</h2>
      <label className="flex min-w-0 flex-col gap-1 text-xs" htmlFor="usg4-window">
        <span className="text-white/50">统计窗口</span>
        <ConsoleSelect
          id="usg4-window"
          data-testid="usg4-window"
          className="h-8 min-w-0 max-w-40 rounded-md border border-white/15 bg-transparent px-2 text-sm"
          value={windowKey}
          disabled={isForced}
          title={isForced ? FORCED_TITLE : undefined}
          onChange={(next) => setWindowKey(next as UsageWindowKey)}
          options={USAGE_WINDOWS.map((item) => ({ value: item.key, label: item.label }))}
        />
      </label>
      <Button
        size="sm"
        outlined
        onClick={reloadAll}
        disabled={phase === "loading" || isForced}
        title={isForced ? FORCED_TITLE : undefined}
        prefix={<RefreshCw className="h-3.5 w-3.5" />}
        data-testid="usg4-reload"
      >
        重新读取
      </Button>
    </div>
  );

  const readyView = (): ReactNode => {
    if (!read) return <LoadingPanel />;
    const cost = read.cost;
    const near = panels.nearDay.phase === "ready" && panels.nearDay.data ? panels.nearDay.data : null;
    const nearReady = near ? nearDayReads(near) : null;
    const summaryKpis = panels.summary.phase === "ready" && panels.summary.data ? panels.summary.data : null;
    const countKpis = (summaryKpis ?? []).filter((kpi) => kpi.available && kpi.value !== null && SUMMARY_KPI_WORDS[kpi.key] !== undefined);
    const tokenMissing = [
      read.tokens.input === null ? "输入 Token" : null,
      read.tokens.output === null ? "输出 Token" : null,
      read.tokens.cacheRead === null ? "缓存读取" : null,
    ].filter((x): x is string => x !== null);

    return (
      <div className="min-w-0" style={{ display: "grid", gap: 12, alignContent: "start" }}>
        <p className="min-w-0 break-words text-xs text-white/50" data-testid="usg4-meta">
          {`范围 ${windowLabel(windowKey)} · 对象 当前租户 · 更新 数据截至 `}
          {read.asOf ? (
            <>
              <span className="tabular-nums" title={read.asOf.raw}>{read.asOf.shown}</span>（北京时间）
            </>
          ) : (
            <span title="回答里没有截至时刻">未提供</span>
          )}
          {" · 金额只来自成本账本的实际扣费；单价与估算在「模型与单价 · 单价」"}
        </p>

        <div className="grid min-w-0 gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", alignItems: "start" }}>
          {/* 卡一：token 三读口合并为一张＋有读口的替代指标 */}
          <ConsoleCard
            label={`用量读数 · ${windowLabel(windowKey)}`}
            action={<span>窗口切换会重发这一路</span>}
            availability={tokenMissing.length ? tokenMissing.map((name) => ({ label: `${name}（仪表盘用量腿）`, reason: "这次回答没有带这个计数" })) : undefined}
          >
            <div className="grid min-w-0 gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 96px), 1fr))" }}>
              <div data-testid="usg4-token-input" className="flex min-w-0 flex-col gap-1">
                <span className="text-[11px] text-white/50">输入 Token</span>
                <StatValue value={tokenText(read.tokens.input)} />
              </div>
              <div data-testid="usg4-token-output" className="flex min-w-0 flex-col gap-1">
                <span className="text-[11px] text-white/50">输出 Token</span>
                <StatValue value={tokenText(read.tokens.output)} />
              </div>
              <div data-testid="usg4-token-cache" className="flex min-w-0 flex-col gap-1">
                <span className="text-[11px] text-white/50">缓存读取</span>
                <StatValue value={tokenText(read.tokens.cacheRead)} />
              </div>
            </div>
            <div className="console-divider" />
            <p className="text-[11px] uppercase tracking-[0.08em] text-white/40">替代指标</p>
            {panels.summary.phase !== "ready" ? (
              <LegFallback panel={panels.summary} loadingText={`正在读窗口计数（${windowLabel(windowKey)}）。`} testId="usg4-summary-fallback" />
            ) : countKpis.length > 0 ? (
              <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 pt-1" data-testid="usg4-summary-kpis">
                {countKpis.map((kpi) => (
                  <span key={kpi.key} className="flex min-w-0 items-baseline gap-1.5 text-xs text-white/60">
                    <span>{SUMMARY_KPI_WORDS[kpi.key]}</span>
                    <b className="console-mono text-sm" style={{ color: "var(--color-text-ls)" }}>{kpi.value?.toLocaleString("en-US")}</b>
                  </span>
                ))}
              </div>
            ) : (
              <p className="console-sub" data-testid="usg4-summary-empty">这一路没有回任何可读的计数指标。</p>
            )}
          </ConsoleCard>

          {/* 卡二：成本账本——唯一金额源 */}
          <ConsoleCard
            label="成本账本 · 唯一金额源"
            action={<Link to="/capabilities?tab=models" className="console-card__action">模型与单价 →</Link>}
            note={<span title={cost?.source ?? undefined}>账本是唯一金额源；含估算与非账本来源都不作实扣呈现</span>}
            availability={[
              { label: "预计月底（预估）", reason: "本页不做均值×天数的推算，也没有预估读口" },
              { label: "浪费（失败与重试计价）", reason: "失败运行没有计价读口" },
            ]}
          >
            <div className="grid min-w-0 gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 132px), 1fr))" }} data-testid="usg4-cost">
              <KpiTile
                label={`本窗口实扣（${windowLabel(windowKey)}）`}
                title="金额来源与状态原值只进悬停与技术详情"
                value={cost ? <MoneyText cell={cost.cell} testId="usg4-cost-total" besideReason /> : <span data-testid="usg4-cost-total"><Dashed reason="用量服务这次没有回成本账本块" /></span>}
                sub={cost ? (
                  <span title={cost.source ?? undefined}>
                    {`${cost.cell.statusLabel}${cost.entries !== null ? ` · ${cost.entries.toLocaleString("en-US")} 条账目` : ""}`}
                  </span>
                ) : "成本账本块未随这份回答提供"}
              />
              <KpiTile
                label="今日已花"
                value={
                  panels.nearDay.phase !== "ready"
                    ? panels.nearDay.phase === "loading"
                      ? <span className="text-sm font-normal text-white/50">正在读</span>
                      : <span className="text-sm font-normal text-white/50">{panels.nearDay.message ?? "没能读完"}</span>
                    : nearReady
                      ? nearReady.today
                      : null
                }
                sub="读口为近 24 小时的账本块，与窗口选择无关"
              />
              <KpiTile label="预计月底" value={<Dashed reason="本页不做估算" />} sub="预估 · 见卡底数据可用性" />
              <KpiTile label="浪费" value={<Dashed reason="失败运行没有计价读口" />} sub="预估 · 见卡底数据可用性" />
            </div>

            <div className="console-divider" />
            <div data-testid="usg4-ledger">
              {cost && cost.rows.length > 0 ? (
                <div className="flex min-w-0 flex-col">
                  {cost.rows.map((row, index) => (
                    <div key={`${row.rawId}-${index}`} className="flex min-w-0 items-baseline justify-between gap-x-3" style={{ minHeight: 34 }}>
                      <span className="min-w-0 break-words text-xs text-white/60" title={row.rawId ?? undefined}>
                        {row.code}
                        <span className="ml-2 text-[11px] text-white/40">{row.entries === null ? <Dashed reason="账目条数未随回答发送" /> : `${row.entries.toLocaleString("en-US")} 条`}</span>
                      </span>
                      <span className="flex shrink-0 items-baseline gap-2 text-sm font-medium">
                        <MoneyText cell={row.cell} testId={`usg4-ledger-money-${index}`} besideReason={false} />
                        <span className="text-[10px] font-normal text-white/40">{row.cell.statusLabel}</span>
                      </span>
                    </div>
                  ))}
                  {cost.rows.some((row) => row.cell.text === "—") ? (
                    <p className="min-w-0 break-words pt-1 text-xs text-white/45">
                      金额显示为破折号的行，账本没有给出可呈现的实扣数；把光标停在上面可以看到原因。
                    </p>
                  ) : null}
                  {cost.unreadableRows > 0 ? (
                    <p className="min-w-0 break-words pt-1 text-xs text-white/45">
                      另有 {cost.unreadableRows} 条账目读不出是哪个员工的，没有列在这里。
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="min-w-0 break-words text-sm text-white/55">
                  {cost && cost.unreadableRows > 0
                    ? `账本回了 ${cost.unreadableRows} 条读不出归属的条目，这里一条也不画。`
                    : cost
                      ? "账本块这次没有回员工明细行；总额仍按上方合计呈现，缺失不写成 0.00。"
                      : "用量服务这次没有回成本账本块，账本明细无法呈现；这里不补任何示例数字。"}
                </p>
              )}
            </div>
          </ConsoleCard>
        </div>

        {/* 卡三：近 7 天趋势（北京日窗，断口不插值） */}
        <ConsoleCard
          label="近 7 天 · 运行 / 成本"
          action={
            panels.trend.phase === "ready" && panels.trend.data
              ? <span>{`${panels.trend.data.summary.readDays}/${panels.trend.data.days.length} 天有读数`}</span>
              : undefined
          }
          note={<span title={panels.trend.url}>日窗按北京日历日切；缺读数的天画浅灰断口，不插值不补零；成本列是运行侧汇总，账本实扣见「成本账本」</span>}
        >
          <TrendCardBody panel={panels.trend} />
        </ConsoleCard>

        {/* 卡四：投影去向与读口状态 */}
        <ConsoleCard
          label="投影去向 · 读口状态"
          action={<span>总览只读，写与明细在资源域</span>}
          note={<span title={panels.nearDay.url}>读口状态来自近 24 小时的用量回答；端点原值只进悬停</span>}
        >
          <div className="flex min-w-0 flex-col gap-1">
            {panels.nearDay.phase !== "ready" ? (
              <LegFallback panel={panels.nearDay} loadingText="正在读取读口状态。" testId="usg4-sources-fallback" />
            ) : (
              nearReady?.legs
            )}
            {nearReady?.attribution}
          </div>
          <div className="console-divider" />
          <div className="flex min-w-0 flex-col gap-1" data-testid="usg4-projection-rows">
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3" style={{ minHeight: 30 }}>
              <span className="text-xs text-white/60">用量与成本明细</span>
              <Link to="/capabilities?tab=models" className="text-xs underline underline-offset-2" style={{ color: "var(--color-text-muted-ls)" }}>模型与单价 · 用量与单价 →</Link>
            </div>
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3" style={{ minHeight: 30 }}>
              <span className="text-xs text-white/60">成本账本与来源标记</span>
              <span className="text-xs text-white/40">账本明细并入「模型与单价 · 用量与账本」摘要</span>
            </div>
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3" style={{ minHeight: 30 }}>
              <span className="text-xs text-white/60">单价定义（估算用）</span>
              <span className="text-xs text-white/40">单价在「模型与单价 · 单价」段，本页不做估算</span>
            </div>
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3" style={{ minHeight: 30 }}>
              <span className="text-xs text-white/60">员工级成本</span>
              <Link to="/employees" className="text-xs underline underline-offset-2" style={{ color: "var(--color-text-muted-ls)" }}>数字员工 →</Link>
            </div>
            <p className="console-sub pt-1">总览不承接任何写操作：改预算去「预算策略」，改单价去「单价」，保存后生成草稿，发布后对新运行生效。</p>
          </div>
        </ConsoleCard>

        {/* 卡五：按模型明细 */}
        <ConsoleCard
          label="按模型"
          flush
          note={read.unreadableModels > 0 ? <span>{`另有 ${read.unreadableModels} 行明细读不出是哪个模型，没有列在这里。`}</span> : undefined}
        >
          <div data-testid="usg4-model-table">
            <div className="px-4 pb-1 pt-2 text-xs text-white/45">
              {read.models.length > 0
                ? "用量源上报的模型明细；缺失字段显示破折号，不补零。"
                : "这个窗口没有可读的模型明细（用量源降级或未随回答发送）。"}
            </div>
            {read.models.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead>
                    <tr className="text-xs text-white/45">
                      <th className="px-4 py-2 font-normal">模型</th>
                      <th className="px-4 py-2 text-right font-normal">输入 Token</th>
                      <th className="px-4 py-2 text-right font-normal">输出 Token</th>
                    </tr>
                  </thead>
                  <tbody>
                    {read.models.map((row, index) => (
                      <tr key={`${row.name}-${index}`} className="border-t border-white/10">
                        <td className="max-w-[240px] break-words px-4 py-2">{row.name}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{tokenText(row.input)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{tokenText(row.output)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </ConsoleCard>

        <TechnicalDisclosure
          testId="usg4-details"
          lines={[
            `请求窗口：${usageUrl(windowKey)}`,
            ...panelUrls(panels),
            read.windowDays !== null ? `回答窗口原值：period_days=${read.windowDays}` : "",
            ...(cost?.cell.technical ?? []),
            read.asOf ? `截至时刻原值：${read.asOf.raw}` : "",
            near?.asOf ? `近 24 小时截至原值：${near.asOf.raw}` : "",
          ]}
        />
      </div>
    );
  };

  const body = (): ReactNode => {
    if (phase === "loading") return <LoadingPanel />;
    if (phase === "denied") return <DeniedPanel requestId={failure?.requestId ?? null} />;
    if (phase === "error" && failure) return <ErrorPanel failure={failure} onRetry={reloadAll} fixture={fixture} />;
    if (phase === "empty") return <EmptyPanel onRetry={reloadAll} windowName={windowLabel(windowKey)} fixture={fixture} />;
    return readyView();
  };

  return (
    <div className="console-primitives-scope min-w-0 space-y-4 p-4 md:p-6" data-testid="usg4-page">
      {header}
      {forced ? <ReproNote state={forced} /> : null}
      {body()}
    </div>
  );
}

export default UsagePage;
