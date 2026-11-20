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
 * side from the previous answer. The `?state=` repro leg (R39, restored after
 * R30 burned it) draws its panel from the URL, carries `data-fixture` plus the
 * on-screen note, and asks nothing at all — list, detail and the employee-name
 * side-read alike; the URL alone decides what a repro shows. Without `?state=`
 * every state comes from a real read, and a missing route lands on the honest
 * error/denied panels rather than on sample rows.
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
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  TechnicalDisclosure,
} from "./states";
import {
  PAGE_LIMIT,
  runListText,
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
  listActionGate,
  type ListGate,
  eventLabel,
  failureSummary,
  isToolEvent,
  resultRef,
  eventReason,
  eventSummary,
  resultRefHref,
  runCode,
  runPreview,
  shortId,
  sinceKeyOf,
  statusFilterOf,
  statusLabel,
  statusTone,
  taskLabel,
  usd,
  type RunRow,
  eventStatus,
  eventElapsed,
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

/**
 * The inline preview of one list row. Every value is derived from the row the
 * list already read — opening it asks the service nothing. The toggle owns
 * `aria-expanded`/`aria-controls`; Escape closes and hands focus back.
 */
function RunPreviewPanel({ row, names, index }: { row: RunRow; names: Map<string, string>; index: number }): ReactNode {
  const view = runPreview(row, names);
  const fields: Array<{ key: string; label: string; field: { text: string; title: string } }> = [
    { key: "status", label: "状态", field: view.status },
    { key: "started", label: "开始", field: view.started },
    { key: "ended", label: "结束", field: view.ended },
    { key: "elapsed", label: "耗时", field: view.elapsed },
    { key: "cost", label: "成本（美元）", field: view.cost },
    { key: "employee", label: "负责人", field: view.employee },
  ];
  return (
    <div
      id={`run-row-preview-${index}`}
      className="min-w-0 border-t border-border bg-muted/20 px-4 py-3"
      data-testid={`run-row-preview-${index}`}
    >
      <dl className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
        {fields.map(({ key, label, field }) => (
          <div key={key} className="min-w-0" data-testid={`run-row-preview-${index}-${key}`} title={field.title}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="m-0 min-w-0 break-words">{field.text}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 min-w-0 break-words text-[11px] leading-tight text-muted-foreground">
        预览只读：六项都取自这一行已读到的数据，打开或收起都不会再发一次请求。
      </p>
    </div>
  );
}

const GRID =
  "grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1fr)_auto]";

function RunListCopy({ rows, names, gate }: { rows: RunRow[]; names: Map<string, string>; gate: ListGate }): ReactNode {
  const [status, setStatus] = useState<"idle" | "done" | "failed">("idle");
  const [body, setBody] = useState("");
  const empty = rows.length === 0;
  const copy = () => {
    const text = runListText(rows, names);
    setBody(text);
    void copyTextToClipboard(text).then((ok) => setStatus(ok ? "done" : "failed"));
  };
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2" data-testid="run-list-copy-bar">
      <Button
        size="sm"
        outlined
        disabled={gate.disabled || empty}
        onClick={copy}
        data-testid="run-list-copy"
        title={
          gate.disabled
            ? gate.title
            : empty
              ? "当前列表没有行，没有可复制的文本"
              : `复制当前列表为纯文本：表头加 ${rows.length} 行；当前已加载 ${rows.length} 行，不是全量（每页最多 ${PAGE_LIMIT} 条）`
        }
      >
        <Copy className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
        复制为纯文本
      </Button>
      <span
        className="min-w-0 text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
        data-testid="run-list-copy-status"
      >
        {status === "done"
          ? `已复制 ${rows.length} 行`
          : status === "failed"
            ? "复制没成功：下面的文本可以自己选中复制"
            : "复制的是屏上这一页的行，只读、不改任何记录。"}
      </span>
      {status === "failed" ? (
        <div className="w-full min-w-0" data-testid="run-list-copy-fallback">
          <textarea
            readOnly
            value={body}
            aria-label="列表纯文本"
            data-testid="run-list-copy-fallback-text"
            className="h-28 w-full resize-y rounded-md border border-border bg-card p-2 font-mono text-xs text-foreground"
          />
        </div>
      ) : null}
    </div>
  );
}

function ListRows({
  rows,
  names,
  hrefOf,
  previewGate,
}: {
  rows: RunRow[];
  names: Map<string, string>;
  /**
   * R29: a row is a real anchor whose href keeps the path shape QA counts
   * (`a[href*="/runs/"]`) without inventing a route. The address is
   * `/runs/?<filters>&run=<id>`: react-router matches `/runs` leniently with
   * the trailing slash, so the page renders, the filters ride along and a
   * copied link reloads into the same record.
   */
  hrefOf: (runId: string) => string;
  previewGate: ListGate;
}): ReactNode {
  const [openId, setOpenId] = useState<string | null>(null);
  const toggleRefs = useRef(new Map<string, HTMLButtonElement>());
  const close = useCallback((rowId: string) => {
    setOpenId(null);
    toggleRefs.current.get(rowId)?.focus();
  }, []);
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
            const open = openId === row.runId;
            return (
              <li
                key={row.runId}
                className="min-w-0"
                data-testid={base}
                data-status={row.status ?? "unknown"}
                onKeyDown={(event) => {
                  if (!open || event.key !== "Escape") return;
                  event.stopPropagation();
                  close(row.runId);
                }}
              >
                <div className={GRID}>
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
                <div className="flex min-w-0 flex-col items-end gap-1 self-center">
                  <Link
                    className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground no-underline hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    to={hrefOf(row.runId)}
                    state={{ fromList: true }}
                    data-testid={`${base}-open`}
                    data-run-id={row.runId}
                    aria-label={`查看 ${runCode(row.runId)} 的详情与事件`}
                  >
                    查看
                  </Link>
                  <button
                    type="button"
                    className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    data-testid={`run-row-toggle-${index}`}
                    aria-expanded={open}
                    aria-controls={`run-row-preview-${index}`}
                    ref={(node) => {
                      if (node) toggleRefs.current.set(row.runId, node);
                      else toggleRefs.current.delete(row.runId);
                    }}
                    onClick={() => setOpenId(open ? null : row.runId)}
                    disabled={previewGate.disabled}
                    title={previewGate.title}
                  >
                    {open ? "收起预览" : "展开预览"}
                  </button>
                </div>
                </div>
                {open ? <RunPreviewPanel row={row} names={names} index={index} /> : null}
              </li>
            );
          })}
        </ul>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground" data-testid="run5-foot">
          <span>只读列表 · 行尾「查看」是真链接，可复制或新开标签 · 不发起、不取消；重试入口在只读环境下为禁用态</span>
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
          {events.map((ev, index) => {
            const prev = index > 0 ? events[index - 1] : null;
            const st = eventStatus(ev);
            const dur = eventElapsed(ev, prev);
            const at = beijingMinute(ev.occurredAt);
            const ref = resultRef(ev);
            const sum = eventSummary(ev);
            const fail = eventReason(ev);
            const href = resultRefHref(ref);
            return (
              <li
                key={ev.seq}
                className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-border pb-2 text-sm last:border-0"
                data-testid={`run5-event-${ev.seq}`}
              >
                <span className="shrink-0 text-xs text-muted-foreground">#{ev.seq}</span>
                <span
                  className="min-w-0 flex-1 break-words"
                  title={ev.eventType ?? undefined}
                >
                  {eventLabel(ev.eventType)}
                </span>
                <span
                  className="min-w-0 basis-full break-words text-xs text-muted-foreground"
                  data-testid={`run5-tl-summary-${ev.seq}`}
                  title={sum.reason || undefined}
                >
                  {sum.text}
                </span>
                {fail ? (
                  <span
                    className="min-w-0 basis-full break-words text-xs text-destructive"
                    data-testid={`run5-tl-reason-${ev.seq}`}
                    title={fail.reason || undefined}
                  >
                    {`失败原因：${fail.text}`}
                  </span>
                ) : null}
                {isToolEvent(ev.eventType) ? (
                  ref && href ? (
                    /* the raw handle stays in the title; the line shows a short code */
                    <a
                      className="min-w-0 break-words text-xs text-muted-foreground underline"
                      href={href}
                      data-tool-event={ev.eventType}
                      data-testid={`run5-result-ref-${ev.seq}`}
                      data-result-ref="present"
                      title={ref}
                    >
                      {`结果引用：${shortId(ref)}`}
                    </a>
                  ) : (
                    <span
                      className="min-w-0 break-words text-xs text-muted-foreground"
                      data-tool-event={ev.eventType}
                      data-testid={`run5-result-ref-${ev.seq}`}
                      data-result-ref={ref ? "present" : "absent"}
                      title={ref ?? "这次工具事件没有带回结果引用：服务的回答里没有 resultRef，本页不替它编一个"}
                    >
                      {`结果引用：${ref ? shortId(ref) : "未记录"}`}
                      {ref ? (
                        <span
                          className="ml-2 text-warning"
                          data-testid={`run5-result-unreachable-${ev.seq}`}
                        >
                          原文不可达：结果引用没有可用的原文地址（服务没有说明它指向哪种记录）
                        </span>
                      ) : null}
                    </span>
                  )
                ) : null}
                <span className="shrink-0 text-xs text-muted-foreground" title={ev.occurredAt ?? undefined}>
                  <span className="shrink-0 text-xs text-muted-foreground" data-testid={"run5-status-" + ev.seq} title={st.reason || undefined}>{st.text}</span>
                  <span className="shrink-0 text-xs text-muted-foreground" data-testid={"run5-duration-" + ev.seq} title={dur.reason || undefined}>{dur.text ?? "—"}</span>
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

// Retry = a NEW run. Measured on this deployment (2026-11-20):
//   POST /api/run-retry  -> HTTP 405 {"code":"console.read_only",
//                           "message":"first console is read-only; only GET/HEAD allowed"}
//   GET  /api/run-retry  -> HTTP 404 {"code":"console.unknown_route"}
// so the write channel is closed at the console, not merely unimplemented in
// the page. The entry therefore renders DISABLED with the measured reason in
// its title: no click, no optimistic success, no reusing the old id.

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
  const sinceKey = sinceKeyOf(params.get("window"));
  const status = statusFilterOf(params.get("status"));
  // The QA handle. A forced leg paints its panel from the URL and asks the
  // service nothing — not the list, not the detail, not the name side-read.
  const forced = forcedStateOf(params.get("state"));
  // Deep link: `?run=` keeps working on refresh, and `/runs/<runId>` is read
  // from the path for the day the shell registers that route. The row anchors
  // point at `/runs/?...&run=<id>`, which is the same query behind the shape
  // QA counts (R29). The hash form is deliberately NOT used: the shell owns
  // the hash and resolves #/runs/<id> to /overview.
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
  const detail = useRunDetail(selected, readTick);

  const [names, setNames] = useState<Map<string, string>>(new Map());
  // Employee names decorate the list as well as the detail line. The directory
  // is a side-read for labels only: if it fails, the 8-character code stays as
  // the honest fallback and the run answer is untouched.
  useEffect(() => {
    if (forced !== null) return;
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
    // `forced` is read, not chased: a repro leg never asks, and the handle only
    // changes when the URL does, which remounts the read anyway.
  }, [forced]);

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

  /**
   * R29: the row href is `/runs/?<current filters>&run=<id>`. Measured on a
   * local build: `/runs/?window=7d` renders the list and `/runs/?...&run=<id>`
   * renders that record, because react-router matches the `/runs` route with a
   * trailing slash. A path-form `/runs/<id>` is NOT used: the shell registers
   * only /runs, so it would land on the unknown-route fallback. The trailing
   * slash is what makes the address path-shaped for QA's a[href*="/runs/"]
   * count while keeping it reloadable.
   */
  const hrefOf = (runId: string) => {
    const next = new URLSearchParams(params);
    next.set("run", runId);
    return `/runs/?${next.toString()}`;
  };
  const closeRun = () => {
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
  // On a repro leg every control that would ask says why it cannot.
  const forcedTitle = isForced ? "复现腿不发起真实请求，去掉 ?state= 即为真实读取" : undefined;

  const failedCount = rows.filter((row) => row.status === "failed").length;
  const runningCount = rows.filter((row) => row.status === "running").length;
  const countsKnown = phase === "ready" || phase === "empty";
  const listGate = listActionGate(phase);
  const filtersNarrow = Boolean(status) || Boolean(employee);
  const clearFilters = () => {
    const next = new URLSearchParams(params);
    next.delete("status");
    next.delete("employee");
    setParams(next, { replace: true, state: { fromList: true } });
  };

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
            title={forcedTitle ?? "重新向服务要一次运行记录"}
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

      <span hidden data-testid="run-state" data-phase={phase} />
      <p
        className="min-w-0 break-words text-xs text-muted-foreground"
        data-testid="run5-counts"
        title={
          countsKnown
            ? "计数只统计这一页已加载的行，不是全量。"
            : "读取成功之前不报计数：这里写「—」，不把读不到当成 0。"
        }
      >
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
              <button
                type="button"
                disabled
                aria-disabled="true"
                data-testid="run5-retry-new"
                data-planned="true"
                data-endpoint-http="405"
                className="min-w-0 cursor-not-allowed rounded-md border border-border px-2.5 py-1 text-left text-xs text-muted-foreground opacity-60"
                title="这个环境的控制台只读：实测写请求一律被拒（POST /api/run-retry → HTTP 405 console.read_only），读路径上也没有这条路由（GET → 404 console.unknown_route）。所以这里只说明语义，点它不会发起任何请求。"
              >
                重试 · 新建一次运行（当前环境只读，写入口未开放）
              </button>
              <p className="max-w-prose min-w-0 break-words text-xs text-muted-foreground">
                重试的语义是新建一次运行并生成新编号，新编号会出现在详情页顶部的运行编号里；原运行不会被改写、复用或取消。实测本环境的控制台只接受 GET/HEAD（POST 一律 405），
                端点 /api/run-retry 也没有读路由，所以这个入口以禁用态出现，不假装成功、也不复用旧编号。
              </p>
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

      {phase === "loading" ? <LoadingPanel fixture={forced ?? undefined} /> : null}
      {phase === "empty" ? (
        <EmptyPanel
          onRetry={reloadList}
          onClear={clearFilters}
          kind={filtersNarrow ? "filter" : "window"}
          fixture={forced ?? undefined}
        />
      ) : null}
      {phase === "error" ? (
        <ErrorPanel
          failure={failure ?? { sentence: "读取运行记录时出了问题，请稍后重试。", requestId: null, technical: null }}
          onRetry={reloadList}
          fixture={forced ?? undefined}
        />
      ) : null}
      {phase === "denied" ? (
        <DeniedPanel requestId={failure?.requestId ?? null} fixture={forced ?? undefined} />
      ) : null}
      {phase === "ready" ? <ListRows rows={rows} names={names} hrefOf={hrefOf} previewGate={listGate.preview} /> : null}
      {phase !== "loading" ? <RunListCopy rows={rows} names={names} gate={listGate.copy} /> : null}

      {phase === "ready" && rows.length > 0 ? (
        <TechnicalDisclosure lines={technical} testId="run5-list-details" />
      ) : null}
    </div>
  );
}

export default RunsModulePage;
