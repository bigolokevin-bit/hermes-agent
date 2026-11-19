/**
 * Lane work · T15 (PRD v4.1) — runs list + read-only detail on the upstream
 * shell.
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
 * the URL, carries `data-fixture` + the GAP number, and issues zero requests
 * (list, detail and the employee-name side-read alike — the URL alone
 * decides what a repro shows).
 *
 * The detail pane (deep link `?run=`) is read-only too: the event timeline
 * with 结果引用 (「未记录」 when the answer carried none), the cost badge in
 * three honest states (已计价 / 未知 / 未记录 — an unknown cost never
 * renders a figure, a true zero renders $0.00), and 重试 that means a NEW
 * run: a fresh id upstream, then this page navigates to it. The current
 * runId is never reused or rewritten.
 *
 * Engineering language (HTTP codes, field names, ISO instants, raw ids)
 * reaches the screen only through `title` attributes and the collapsed
 * 「技术详情」. The run id reads 「运行 · 后4位」 with a copy affordance;
 * the full value lives in the title and the clipboard, not on the surface.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { Check, Copy, RefreshCw, X } from "lucide-react";

import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { Spinner } from "@nous-research/ui/ui/components/spinner";

import { fetchJSON } from "@/lib/api";
import { themedBody } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/clipboard";

import {
  DeniedPanel,
  EmptyPanel,
  ErrorPanel,
  LoadingPanel,
  ReproNote,
  RequestIdLine,
  TechnicalDisclosure,
} from "./states";
import {
  GAP,
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
  employeeLabel,
  errorInfo,
  eventLabel,
  failureSummary,
  isToolEvent,
  requestRetryRun,
  resultRef,
  runCode,
  shortId,
  sinceKeyOf,
  statusFilterOf,
  statusLabel,
  statusTone,
  taskLabel,
  usd,
  type ErrorInfo,
  type RunRow,
} from "./runs";
import { forcedStateOf, useRunsData } from "./useRunsData";
import { useRunDetail, type DetailOutcome } from "./useRunDetail";

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

/**
 * The upstream id is a runtime-side handle. The console has no route that
 * queries by it (probed: `upstreamRunId=` and `upstream=` are both ignored by
 * /api/runs), so a link here would only rewrite the URL and change nothing.
 * Copy stays; the jump is not offered and the reason is on screen.
 */
function UpstreamLine({ raw }: { raw?: string }): ReactNode {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  if (!raw) return <Dashed reason="这条运行没有带上游编号" />;
  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5">
      <span className="flex min-w-0 flex-wrap items-center gap-1.5" data-testid="run5-detail-upstream" title={raw}>
        <span className="min-w-0 break-words">{runCode(raw)}</span>
        <button
          type="button"
          aria-label="复制上游运行编号"
          title="复制完整编号（供运行时侧排查）"
          className="inline-flex shrink-0 items-center text-xs text-muted-foreground underline underline-offset-2"
          onClick={() => {
            void copyTextToClipboard(raw).then((ok) => {
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
      <span className="min-w-0 break-words text-[11px] leading-tight text-muted-foreground">
        运行时侧的上游编号。控制台没有按上游编号查询的入口，所以这里只提供复制，不做会落空的跳转。
      </span>
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
  "grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1fr)_auto]";

function ListRows({
  rows,
  names,
  onOpen,
}: {
  rows: RunRow[];
  names: Map<string, string>;
  onOpen: (runId: string) => void;
}): ReactNode {
  return (
    <Card className="min-w-0 border-border bg-card" data-testid="run5-table">
      <CardContent className="p-0">
        <div className={`hidden ${GRID} border-b border-border px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground sm:grid`}>
          <span>运行</span><span>状态</span><span>开始</span><span>耗时</span><span>成本（美元）</span><span>负责人</span><span>失败原因</span><span aria-hidden="true"></span>
        </div>
        <ul className="divide-y divide-border">
          {rows.map((row, index) => {
            const start = beijingMinute(row.startedAt);
            const elapsed = elapsedMinute(row.startedAt, row.endedAt);
            const reason = failureSummary(row);
            const base = `run5-row-${index}`;
            return (
              <li key={row.runId} className={GRID} data-testid={base} data-status={row.status ?? "unknown"}>
                <RunCodeCell row={row} testId={`${base}-code`} />
                <span className="min-w-0 self-center">
                  <Badge tone={statusTone(row.status)} data-testid={`${base}-status`}>{statusLabel(row.status)}</Badge>
                </span>
                <span className="min-w-0 self-center break-words" data-testid={`${base}-start`} title={row.startedAt ?? undefined}>
                  {start.text ?? <Dashed reason={start.reason} />}
                </span>
                <span className="min-w-0 self-center break-words" data-testid={`${base}-elapsed`} title={elapsed.reason || undefined}>
                  {elapsed.text ?? <Dashed reason={elapsed.reason} />}
                </span>
                <CostCell row={row} testId={`${base}-cost`} />
                <span
                  className="min-w-0 self-center break-words"
                  data-testid={`${base}-employee`}
                  title={
                    row.employeeId
                      ? row.employeeId
                      : "这条运行没有带回负责人；不代填、不猜"
                  }
                >
                  {employeeLabel(row.employeeId, names)}
                </span>
                <span className="min-w-0 self-center break-words" data-testid={`${base}-reason`} title={reason.reason || undefined}>
                  {reason.text}
                </span>
                <button
                  type="button"
                  className="self-center justify-self-end rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/40 focus-visible:outline-none"
                  data-testid={`${base}-open`}
                  aria-label={`查看 ${runCode(row.runId)} 的详情与事件`}
                  onClick={() => onOpen(row.runId)}
                >
                  查看
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground" data-testid="run5-foot">
          <span>只读列表 · 点一行看详情与事件 · 不发起、不取消，重试只会新建一次运行</span>
        </div>
      </CardContent>
    </Card>
  );
}

function Timeline({
  outcome,
  onRetryEvents,
}: {
  outcome: Extract<DetailOutcome, { k: "ready" }>;
  onRetryEvents: () => void;
}): ReactNode {
  const { events, hasMore, eventsFailure } = outcome;
  return (
    <div className="min-w-0 space-y-2">
      <h3 className="text-sm font-semibold">事件时间线</h3>
      {eventsFailure ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
          <span className="min-w-0 break-words text-muted-foreground">
            事件流这次没读到：{eventsFailure.sentence}
          </span>
          <Button size="sm" outlined onClick={onRetryEvents} data-testid="run5-events-retry"
            prefix={<RefreshCw className="h-3.5 w-3.5" />}>
            重新读取事件
          </Button>
        </div>
      ) : events.length === 0 ? (
        <p className="min-w-0 break-words text-sm text-muted-foreground">这条运行的事件流还没有读到内容。</p>
      ) : (
        <ol className="min-w-0 space-y-2" data-testid="run5-timeline">
          {events.map((ev) => {
            const at = beijingMinute(ev.occurredAt);
            const ref = resultRef(ev);
            return (
              <li
                key={ev.seq}
                className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-border pb-2 text-sm last:border-0"
                data-testid={`run5-event-${ev.seq}`}
              >
                <span className="shrink-0 text-xs text-muted-foreground">#{ev.seq}</span>
                <span className="min-w-0 flex-1 break-words">{eventLabel(ev.eventType)}</span>
                {isToolEvent(ev.eventType) ? (
                  <span
                    className="min-w-0 break-words text-xs text-muted-foreground"
                    data-tool-event={ev.eventType}
                    title={ref ?? "服务没有带回结果引用"}
                  >
                    {`结果引用：${ref ? shortId(ref) : "未记录"}`}
                  </span>
                ) : null}
                <span className="shrink-0 text-xs text-muted-foreground" title={ev.occurredAt ?? undefined}>
                  {at.text ?? <Dashed reason={at.reason} />}
                </span>
              </li>
            );
          })}
          {hasMore ? <li className="min-w-0 break-words text-xs text-muted-foreground">服务说这一条之外还有更多事件，这次没有读到。</li> : null}
        </ol>
      )}
    </div>
  );
}

type AttemptAsk =
  | { key: string; k: "sending" }
  | { key: string; k: "failed"; failure: ErrorInfo }
  | { key: string; k: "done"; newId: string };

function AttemptLine({ ask, runId }: { ask: AttemptAsk | null; runId: string | null }): ReactNode {
  if (!ask || ask.key !== runId) return null;
  if (ask.k === "sending") {
    return (
      <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="run5-retry-result">
        <Spinner className="mr-1 inline h-3 w-3" />
        正在请求新建一次运行…
      </p>
    );
  }
  if (ask.k === "done") {
    return (
      <p className="min-w-0 break-words text-xs text-success" data-testid="run5-retry-result" title={ask.newId}>
        {`已新建 ${runCode(ask.newId)} 并切换到这条新运行；原运行不受影响。`}
      </p>
    );
  }
  return (
    <div className="min-w-0 space-y-1" data-testid="run5-retry-result">
      <p className="min-w-0 break-words text-xs text-muted-foreground">
        {ask.k === "failed" && (ask.failure.status === 403 || ask.failure.status === 404)
          ? `新建运行的写入还没有在本控制台接通（${GAP}），本页没有替你发起任何新运行。`
          : ask.failure.sentence}
      </p>
      <RequestIdLine requestId={ask.failure.requestId} testId="run5-retry-request-id" />
    </div>
  );
}

function DetailField({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <div className="min-w-0">
      <span className="block text-[11px] tracking-wide text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

export function RunsModulePage() {
  const [params, setParams] = useSearchParams();
  const { pathname, state: locationState } = useLocation();
  const navigate = useNavigate();
  const forced = forcedStateOf(params.get("state"));
  const sinceKey = sinceKeyOf(params.get("window"));
  const status = statusFilterOf(params.get("status"));
  // Deep link: `?run=` keeps working on refresh, and `/runs/<runId>` is read
  // from the path so the same link survives once the shell registers the route.
  const pathRun = (() => {
    const m = /(?:^|\/)runs\/([^/?#]+)/.exec(pathname);
    if (!m) return null;
    const decoded = (() => { try { return decodeURIComponent(m[1]); } catch { return m[1]; } })();
    return decoded.trim() || null;
  })();
  const selected = forced === null ? params.get("run") ?? pathRun : null;
  // Deep-link only: `?employee=` narrows the list through the accepted employeeId
  // parameter. No filter control exists for it, so no dead control is implied.
  const employee = forced === null ? (params.get("employee")?.trim() || null) : null;

  const data = useRunsData(forced, { status, sinceKey, employeeId: employee });
  const { phase, rows, cursor, answeredBy, unreadable, failure, forced: isForced } = data;

  const [readTick, setReadTick] = useState(0);
  const detail = useRunDetail(forced, selected, readTick);
  const [attemptAsk, setAttemptAsk] = useState<AttemptAsk | null>(null);

  const [names, setNames] = useState<Map<string, string>>(new Map());
  // Employee names decorate the list as well as the detail line, so the ask is
  // gated on a real (non-repro) read rather than on the detail being open. The
  // directory is a side-read for labels only: if it fails, the 8-character
  // code stays as the honest fallback and the run answer is untouched.
  const namesGated = forced === null;
  useEffect(() => {
    if (!namesGated) return;
    let alive = true;
    fetchJSON<unknown>("/agent-api/api/employees?limit=100")
      .then((body) => {
        if (!alive) return;
        const items = body && typeof body === "object" && Array.isArray((body as { items?: unknown[] }).items)
          ? (body as { items: unknown[] }).items
          : [];
        const map = new Map<string, string>();
        for (const item of items) {
          if (!item || typeof item !== "object") continue;
          const r = item as Record<string, unknown>;
          const id = typeof r.employeeId === "string" ? r.employeeId : typeof r.id === "string" ? r.id : "";
          const name = typeof r.name === "string" ? r.name : typeof r.displayName === "string" ? r.displayName : "";
          if (id && name) map.set(id, name);
        }
        setNames(map);
      })
      .catch(() => {
        /* masked code is the honest fallback; no toast, no fake name */
      });
    return () => {
      alive = false;
    };
  }, [namesGated]);

  const forcedTitle = isForced ? "复现腿不发起真实请求，去掉 ?state= 即为真实读取" : undefined;

  // Filter changes replace the current entry: they are the same page, and a
  // history entry per keystroke would make the back button useless.
  const setParam = useCallback(
    (key: string, value: string | null, opts?: { push?: boolean }) => {
      const next = new URLSearchParams(params);
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
      if (opts?.push) {
        setParams(next, { replace: false, state: { fromList: true } });
        return;
      }
      setParams(next, { replace: true, state: locationState ?? null });
    },
    [params, setParams, locationState],
  );

  const openRun = (runId: string) => {
    setAttemptAsk(null);
    if (runId === selected) return;
    // R23: a detail is a real history entry, so the browser back button (and a
    // same-document traversal) returns to this list — with its scroll position
    // restored by the browser — instead of leaving a blank page behind.
    setParam("run", runId, { push: true });
  };
  const closeRun = () => {
    setAttemptAsk(null);
    // The detail was pushed from the list above, so walk back to that entry.
    // A detail opened as a deep link has nothing behind it, so it rewrites the
    // current entry into the list instead of leaving the app.
    if (locationState?.fromList === true) {
      navigate(-1);
      return;
    }
    setParam("run", null);
  };
  const reloadList = () => {
    data.reload();
  };
  const reloadDetail = () => setReadTick((n) => n + 1);

  const retryAsNewRun = useCallback(() => {
    if (selected === null) return;
    setAttemptAsk({ key: selected, k: "sending" });
    requestRetryRun(selected)
      .then((newId) => {
        setAttemptAsk({ key: newId, k: "done", newId });
        setReadTick((n) => n + 1);
        setParam("run", newId);
      })
      .catch((err: unknown) => {
        setAttemptAsk({ key: selected, k: "failed", failure: errorInfo(err) });
      });
  }, [selected, setParam]);

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
            按时间看运行记录。这一面只读：不取消运行；重试的含义是新建一次运行。
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
            onClick={reloadList}
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

      {detail.k === "loading" ? (
        <Card data-testid="run5-detail-loading" aria-busy="true">
          <CardContent className="space-y-3 p-4">
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-16 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ) : null}

      {detail.k === "error" ? (
        detail.denied ? (
          <DeniedPanel requestId={detail.failure.requestId} testId="run5-detail-denied" />
        ) : (
          <ErrorPanel
            failure={detail.failure}
            onRetry={reloadDetail}
            testId="run5-detail-error"
            title="这条运行没能加载出来"
          />
        )
      ) : null}

      {detail.k === "ready" ? (
        <Card className="min-w-0 border-border bg-card" data-testid="run5-detail">
          <CardContent className="min-w-0 space-y-4 p-4">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="min-w-0 break-words text-base font-semibold" title={detail.run.runId}>
                  {runCode(detail.run.runId)}
                </h2>
                <p className="mt-0.5 min-w-0 break-words text-xs text-muted-foreground">
                  {`${statusLabel(detail.run.status)} · 开始 ${beijingMinute(detail.run.startedAt).text ?? "—"} · 耗时 ${elapsedMinute(detail.run.startedAt, detail.run.endedAt).text ?? "—"}`}
                </p>
              </div>
              <Button size="sm" outlined onClick={closeRun} prefix={<X className="h-3.5 w-3.5" />} data-testid="run5-detail-close">
                关闭
              </Button>
            </div>

            <div className="grid min-w-0 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <DetailField label="状态">
                <Badge tone={statusTone(detail.run.status)} data-testid="run5-detail-status">{statusLabel(detail.run.status)}</Badge>
              </DetailField>
              <DetailField label="成本">
                <CostCell row={detail.run} testId="run5-detail-cost" />
              </DetailField>
              <DetailField label="预算上限">
                {detail.run.budgetCapUsd === null || detail.run.budgetCapUsd === undefined ? (
                  <Dashed reason="服务没有给出预算上限" />
                ) : (
                  usd(detail.run.budgetCapUsd)
                )}
              </DetailField>
              <DetailField label="第几次尝试">
                {detail.run.attemptNo === undefined ? <Dashed reason="服务没有给出尝试次数" /> : `第 ${detail.run.attemptNo} 次`}
              </DetailField>
              <DetailField label="结束">
                {beijingMinute(detail.run.endedAt).text ?? (
                  <Dashed reason="还没有结束时间：这条运行可能仍在进行，或服务未记录结束" />
                )}
              </DetailField>
              <DetailField label="失败原因">
                <span title={failureSummary(detail.run).reason || undefined}>
                  {failureSummary(detail.run).text}
                </span>
              </DetailField>
              <DetailField label="任务">
                <span title={detail.run.taskId ?? undefined}>{taskLabel(detail.run.taskId)}</span>
              </DetailField>
              <DetailField label="员工">
                <span title={detail.run.employeeId ?? undefined}>
                  {employeeLabel(detail.run.employeeId, names)}
                </span>
              </DetailField>
              <DetailField label="事件">
                {detail.eventsFailure
                  ? "这次没有读到"
                  : `${detail.events.length} 条${detail.hasMore ? "（服务说还有更多）" : ""}`}
              </DetailField>
              <div className="min-w-0 sm:col-span-2">
                <DetailField label="上游运行">
                  <UpstreamLine raw={detail.run.upstreamRunId} />
                </DetailField>
              </div>
            </div>

            <Timeline outcome={detail} onRetryEvents={reloadDetail} />

            <div className="min-w-0 space-y-2 border-t border-border pt-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  outlined
                  onClick={retryAsNewRun}
                  disabled={isForced || attemptAsk?.k === "sending"}
                  data-testid="run5-retry-new"
                >
                  重试 · 新建一次运行
                </Button>
              </div>
              <p className="max-w-prose min-w-0 break-words text-xs text-muted-foreground">
                重试会新建一次运行并生成新编号，本页随后切换到这条新编号；当前运行不会被改写、复用或取消。
              </p>
              <AttemptLine ask={attemptAsk} runId={selected} />
            </div>

            <TechnicalDisclosure
              lines={[
                `运行编号原值：${detail.run.runId}`,
                detail.run.upstreamRunId ? `上游编号原值：${detail.run.upstreamRunId}` : null,
                detail.run.taskId ? `任务编号原值：${detail.run.taskId}` : null,
                detail.run.reasonCode ? `原因代码原值：${detail.run.reasonCode}` : null,
              ].filter((line): line is string => line !== null)}
              testId="run5-detail-details"
            />
          </CardContent>
        </Card>
      ) : null}

      {phase === "loading" ? <LoadingPanel fixture={forced === "loading" ? "loading" : undefined} /> : null}
      {phase === "empty" ? (
        <EmptyPanel onRetry={reloadList} fixture={forced === "empty" ? "empty" : undefined} />
      ) : null}
      {phase === "error" ? (
        <ErrorPanel
          failure={failure ?? { sentence: "读取运行记录时出了问题，请稍后重试。", requestId: null, technical: null }}
          onRetry={reloadList}
          fixture={forced === "error" ? "error" : undefined}
        />
      ) : null}
      {phase === "denied" ? (
        <DeniedPanel requestId={failure?.requestId ?? null} fixture={forced === "denied" ? "denied" : undefined} />
      ) : null}
      {phase === "ready" ? <ListRows rows={rows} names={names} onOpen={openRun} /> : null}

      {phase === "ready" && rows.length > 0 ? (
        <TechnicalDisclosure lines={technical} testId="run5-list-details" />
      ) : null}
    </div>
  );
}

export default RunsModulePage;
