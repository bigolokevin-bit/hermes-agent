/**
 * Lane work · T15 (PRD v4.1) — runs LIST on the upstream shell.
 *
 * Read-only. What is on the screen is what the answers carried, and nothing
 * else:
 *   loading  a skeleton, not a list of zero
 *   ready    the runs the service sent — short codes, Chinese status,
 *            Beijing wall clock to the minute, USD or 「—」 with the reason,
 *            and a failure-reason summary
 *   empty    the service answered and the window really was empty — reason
 *            plus next step, and zeros that are earned
 *   error    human words + a copyable 请求编号 (「未提供」 when there was
 *            none) + 重试
 *   denied   403 and 404 draw ONE identical body: no code word, no route,
 *            no data rows above it
 *
 * The filters are URL-owned (`?window=` / `?status=`): the link takes effect
 * because the read is asked again with that filter — not repainted client-
 * side from the previous answer. A `?state=` repro leg draws its state from
 * the URL, carries `data-fixture` + the GAP number, and issues zero requests.
 *
 * Engineering language (HTTP codes, field names, ISO instants, raw ids)
 * reaches the screen only through `title` attributes and the collapsed
 * 「技术详情」. The run id reads 「运行 · 后4位」 with a copy affordance;
 * the full value lives in the title and the clipboard, not on the surface.
 *
 * The detail leg (timeline, three-state cost badge, retry-as-new-run) is the
 * second page of this task and arrives on top of this shell.
 */
import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { Check, Copy, RefreshCw } from "lucide-react";

import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { Spinner } from "@nous-research/ui/ui/components/spinner";

import { themedBody } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/clipboard";

import {
  DeniedPanel,
  EmptyPanel,
  ErrorPanel,
  LoadingPanel,
  ReproNote,
  TechnicalDisclosure,
} from "./states";
import {
  PAGE_LIMIT,
  SINCE_OPTIONS,
  STATUS_KEYS,
  askedLine,
  beijingMinute,
  costBadgeLabel,
  costReason,
  costState,
  costText,
  elapsedMinute,
  failureSummary,
  runCode,
  sinceKeyOf,
  statusFilterOf,
  statusLabel,
  statusTone,
  type RunRow,
} from "./runs";
import { forcedStateOf, useRunsData } from "./useRunsData";

/** 「—」 with the reason in its title: a gap reads as a gap, never as a zero. */
function Dashed({ reason }: { reason: string }): ReactNode {
  return (
    <span className="min-w-0 break-words text-muted-foreground" title={reason}>
      —
    </span>
  );
}

/**
 * The list cell for a run: 「运行 · 后4位」 on the surface, full id in the
 * title and on the clipboard only — the RUNS-01 audit counted a bare full
 * id (and the missing copy entry) as defects.
 */
function RunCodeCell({ row, testId }: { row: RunRow; testId: string }): ReactNode {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5" data-testid={testId} title={row.runId}>
      <span className="min-w-0 break-words">{runCode(row.runId)}</span>
      <button
        type="button"
        aria-label="复制运行编号"
        title="复制完整编号（供支持人员核对）"
        className="inline-flex shrink-0 items-center text-xs text-muted-foreground underline underline-offset-2"
        onClick={() => {
          void copyTextToClipboard(row.runId).then((ok) => {
            setCopied(ok ? "done" : "failed");
            if (ok) window.setTimeout(() => setCopied("idle"), 2500);
          });
        }}
      >
        {copied === "done" ? (
          <Check className="h-3 w-3" aria-hidden="true" />
        ) : copied === "failed" ? (
          <span>复制失败，请手动选择</span>
        ) : (
          <Copy className="h-3 w-3" aria-hidden="true" />
        )}
      </button>
    </span>
  );
}

function CostCell({ row, testId }: { row: RunRow; testId: string }): ReactNode {
  const state = costState(row);
  const tone = state === "known" ? "success" : state === "unknown" ? "warning" : "secondary";
  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5" data-testid={testId} title={costReason(row)}>
      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="min-w-0 break-words">{costText(row)}</span>
        <Badge tone={tone}>{costBadgeLabel(row)}</Badge>
      </span>
      {state !== "known" ? (
        <span className="min-w-0 break-words text-[11px] leading-tight text-muted-foreground">{costReason(row)}</span>
      ) : null}
    </span>
  );
}

const GRID =
  "grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,1fr)]";

function ListRows({ rows }: { rows: RunRow[] }): ReactNode {
  return (
    <Card className="min-w-0 border-border bg-card" data-testid="run5-table">
      <CardContent className="p-0">
        <div className={`hidden ${GRID} border-b border-border px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground sm:grid`}>
          <span>运行</span><span>状态</span><span>开始</span><span>耗时</span><span>成本（美元）</span><span>失败原因</span>
        </div>
        <ul className="divide-y divide-border">
          {rows.map((row, index) => {
            const start = beijingMinute(row.startedAt);
            const elapsed = elapsedMinute(row.startedAt, row.endedAt);
            const reason = failureSummary(row);
            const base = `run5-row-${index}`;
            return (
              <li
                key={row.runId}
                className={`flex min-w-0 flex-col gap-1 px-4 py-3 ${GRID}`}
                data-testid={base}
                data-status={row.status ?? "unknown"}
              >
                <RunCodeCell row={row} testId={`${base}-code`} />
                <span className="min-w-0">
                  <Badge tone={statusTone(row.status)} data-testid={`${base}-status`}>{statusLabel(row.status)}</Badge>
                </span>
                <span className="min-w-0 break-words" data-testid={`${base}-start`} title={row.startedAt ?? undefined}>
                  {start.text ?? <Dashed reason={start.reason} />}
                </span>
                <span className="min-w-0 break-words" data-testid={`${base}-elapsed`} title={elapsed.reason || undefined}>
                  {elapsed.text ?? <Dashed reason={elapsed.reason} />}
                </span>
                <CostCell row={row} testId={`${base}-cost`} />
                <span className="min-w-0 break-words" data-testid={`${base}-reason`} title={reason.reason || undefined}>
                  {reason.text}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground" data-testid="run5-foot">
          <span>只读列表 · 不发起、不取消、不重试任何运行</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function RunsModulePage() {
  const [params, setParams] = useSearchParams();
  const forced = forcedStateOf(params.get("state"));
  const sinceKey = sinceKeyOf(params.get("window"));
  const status = statusFilterOf(params.get("status"));

  const data = useRunsData(forced, { status, sinceKey });
  const { phase, rows, cursor, answeredBy, unreadable, failure, forced: isForced } = data;

  const forcedTitle = isForced ? "复现腿不发起真实请求，去掉 ?state= 即为真实读取" : undefined;

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const failedCount = rows.filter((row) => row.status === "failed").length;
  const runningCount = rows.filter((row) => row.status === "running").length;
  const countsKnown = phase === "ready" || phase === "empty";

  const technical = [
    answeredBy ? `由这条读取回答：${answeredBy}` : null,
    !answeredBy && failure?.technical ? failure.technical : null,
    askedLine(),
  ].filter((line): line is string => line !== null);

  const statusLine =
    phase === "loading"
      ? "正在读取运行记录…"
      : phase === "denied"
        ? "这一面当前看不到运行记录"
        : phase === "error"
          ? "这次读取没有成功"
          : phase === "empty"
            ? "读取成功，这个窗口没有运行"
            : "读取成功";

  return (
    <div
      className="flex min-w-0 w-full max-w-full flex-col gap-3"
      data-testid="run5-page"
      data-page="runs"
      data-fixture={forced ?? undefined}
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <nav aria-label="面包屑" className="min-w-0 break-words text-xs text-muted-foreground" data-testid="run5-breadcrumb">
            <Link to="/overview" className="underline decoration-dotted underline-offset-2 hover:text-foreground">控制台</Link>
            <span aria-hidden="true"> · </span>
            <span aria-current="page">运行</span>
          </nav>
          <h1 className={`mt-1 min-w-0 break-words text-xl ${themedBody}`}>运行</h1>
          <p className="mt-1 min-w-0 break-words text-xs text-muted-foreground">
            按时间看运行记录。这一面只读：不发起、不取消、不重试任何运行。
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-end gap-2" role="group" aria-label="运行筛选" data-testid="run5-filters">
          <label className="flex min-w-0 flex-col gap-1 text-xs" htmlFor="run5-filter-window">
            <span className="text-muted-foreground">时间范围</span>
            <select
              id="run5-filter-window"
              data-testid="run5-filter-window"
              className="h-8 min-w-0 max-w-40 rounded-md border border-border bg-transparent px-2 text-sm"
              value={sinceKey}
              disabled={isForced}
              title={isForced ? forcedTitle : "换时间范围会重新向服务要一次数据"}
              onChange={(event) => setParam("window", event.target.value)}
            >
              {SINCE_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs" htmlFor="run5-filter-status">
            <span className="text-muted-foreground">状态</span>
            <select
              id="run5-filter-status"
              data-testid="run5-filter-status"
              className="h-8 min-w-0 max-w-40 rounded-md border border-border bg-transparent px-2 text-sm"
              value={status ?? ""}
              disabled={isForced}
              title={isForced ? forcedTitle : "换状态会重新向服务要一次数据"}
              onChange={(event) => setParam("status", event.target.value || null)}
            >
              <option value="">全部状态</option>
              {STATUS_KEYS.map((key) => (
                <option key={key} value={key}>{statusLabel(key)}</option>
              ))}
            </select>
          </label>
          <Button
            size="sm"
            outlined
            onClick={data.reload}
            disabled={phase === "loading" || isForced}
            title={forcedTitle}
            data-testid="run5-refresh"
            prefix={phase === "loading" ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
          >
            重新读取
          </Button>
        </div>
      </div>

      {forced !== null ? <ReproNote state={forced} /> : null}

      <p className="min-w-0 break-words text-xs text-muted-foreground" aria-live="polite" data-testid="run5-status">
        {statusLine}
      </p>

      <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="run5-counts">
        {countsKnown
          ? `本页 ${rows.length} 次 · 失败 ${failedCount} · 运行中 ${runningCount}（仅本页已加载，最多 ${PAGE_LIMIT} 条，不是全量统计）`
          : "本页 — 次 · 失败 — · 运行中 —（暂时读不到运行数据，数字不作零处理）"}
        {phase === "ready" && cursor ? "；服务说这一页之外还有更多" : ""}
        {unreadable > 0 && countsKnown
          ? `；另有 ${unreadable} 条回的内容没有可读的运行编号，没有算在上面`
          : ""}
      </p>

      {phase === "loading" ? <LoadingPanel fixture={forced === "loading" ? "loading" : undefined} /> : null}
      {phase === "empty" ? (
        <EmptyPanel onRetry={data.reload} fixture={forced === "empty" ? "empty" : undefined} />
      ) : null}
      {phase === "error" ? (
        <ErrorPanel
          failure={failure ?? { sentence: "读取运行记录时出了问题，请稍后重试。", requestId: null, technical: null }}
          onRetry={data.reload}
          fixture={forced === "error" ? "error" : undefined}
        />
      ) : null}
      {phase === "denied" ? (
        <DeniedPanel requestId={failure?.requestId ?? null} fixture={forced === "denied" ? "denied" : undefined} />
      ) : null}
      {phase === "ready" ? <ListRows rows={rows} /> : null}

      {phase === "ready" && rows.length > 0 ? (
        <TechnicalDisclosure lines={technical} testId="run5-list-details" />
      ) : null}
    </div>
  );
}

export default RunsModulePage;
