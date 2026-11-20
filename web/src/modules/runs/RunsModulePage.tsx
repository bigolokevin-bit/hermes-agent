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
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { Check, Copy, Download, RefreshCw, X } from "lucide-react";

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
  pageCapMoreText,
  pageCapText,
  pageCapTitle,
  runCsvFileName,
  runListCsv,
  runListText,
  RUN_PARAM_TABLE,
  runSource,
  sinceLabel,
  SINCE_OPTIONS,
  STATUS_KEYS,
  askedLine,
  beijingMinute,
  costBadgeLabel,
  costReason,
  costState,
  costText,
  defaultRunDir,
  elapsedMinute,
  employeeLabel,
  effectiveListGate,
  listActionGate,
  parseRunDir,
  parseRunSort,
  resetFiltersTitle,
  resetRunFilters,
  sortRunRows,
  type ListGate,
  type RunSortDir,
  type RunSortKey,
  eventLabel,
  failureSummary,
  isToolEvent,
  resultRef,
  eventReason,
  eventSummary,
  resultRefHref,
  runCode,
  runPreview,
  runRowText,
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
import { asOfCell } from "../metrics/asof";
import { forcedStateOf, useRunsData } from "./useRunsData";
import { useRunDetail, type DetailOutcome } from "./useRunDetail";
import { COST_CALIBER_TEXT, costCaliberTitle } from "../metrics/costCaliberNote";
import { RUN_NOTES_TITLE, RUN_NOTE_ROWS } from "./runNotes";
import { ConsoleSelect } from "@/shell/ConsoleSelect";

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

/** 时间与金额类字段：数字列一律走 tabular-nums，纵向扫读才对得齐。 */
const NUM_KEYS = new Set(["started", "ended", "elapsed", "cost"]);

/**
 * The inline preview of one list row. Every value is derived from the row the
 * list already read — opening it asks the service nothing. The toggle owns
 * `aria-expanded`/`aria-controls`; Escape closes and hands focus back.
 */
function RunPreviewPanel({ row, names, index }: { row: RunRow; names: Map<string, string>; index: number }): ReactNode {
  const view = runPreview(row, names);
  const [copyState, setCopyState] = useState<"idle" | "done" | "failed">("idle");
  const [copyBody, setCopyBody] = useState("");
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
      className="ui-c-container min-w-0 border-t border-border bg-muted/20 px-4 py-3"
      data-testid={`run-row-preview-${index}`}
    >
      <div className="ui-c-head ui-c-head--plain ui-c-head--start">
        <div className="min-w-0 flex-1">
          <h3 className="ui-c-head-title">运行预览</h3>
          <p className="ui-c-head-sub">
            预览只读：六项都取自这一行已读到的数据，打开或收起都不会再发一次请求。
          </p>
        </div>
        <span className="ui-c-head-actions">
          <Button
            size="sm"
            outlined
            data-testid="run-row-copy"
            aria-disabled={false}
            title="复制这一行屏上已渲染的七个字段"
            onClick={() => {
              const text = runRowText(row, names);
              setCopyBody(text);
              copyTextToClipboard(text).then((ok) => setCopyState(ok ? "done" : "failed"));
            }}
          >
            复制这一行
          </Button>
          <span
            role="status"
            aria-live="polite"
            className="min-w-0 break-words text-xs text-muted-foreground"
            data-testid="run-row-copy-status"
          >
            {copyState === "done"
              ? "已复制"
              : copyState === "failed"
                ? "复制没成功：下面的文本可以自己选中复制"
                : "复制的是这一行屏上已渲染的七个字段。"}
          </span>
        </span>
      </div>
      <dl className="ui-c-fields ui-c-fields--compact">
        {fields.map(({ key, label, field }) => (
          <div
            key={key}
            className="ui-c-field"
            data-testid={`run-row-preview-${index}-${key}`}
            title={field.title}
          >
            <dt className="ui-c-field-label">{label}</dt>
            <dd className={`ui-c-field-value${NUM_KEYS.has(key) ? " ui-c-num" : ""}`}>{field.text}</dd>
          </div>
        ))}
      </dl>
      {copyState === "failed" ? (
        <div className="mt-2 min-w-0" data-testid="run-row-copy-fallback">
          <textarea
            readOnly
            value={copyBody}
            aria-label="这一行的纯文本"
            data-testid="run-row-copy-fallback-text"
            className="min-h-16 w-full resize-y rounded-md border border-border bg-transparent p-2 font-mono text-xs"
          />
        </div>
      ) : null}
    </div>
  );
}

const GRID =
  "grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1fr)_auto]";

function RunListCopy({
  rows,
  names,
  copyGate,
  exportGate,
  windowKey,
  statusKey,
}: {
  rows: RunRow[];
  names: Map<string, string>;
  copyGate: ListGate;
  exportGate: ListGate;
  windowKey: string | null;
  statusKey: string | null;
}): ReactNode {
  const [status, setStatus] = useState<"idle" | "done" | "failed">("idle");
  const [body, setBody] = useState("");
  const [exportStatus, setExportStatus] = useState<"idle" | "done" | "failed">("idle");
  const empty = rows.length === 0;
  // One object per action: disabled, aria-disabled and the reason come from it.
  const copyState = effectiveListGate(copyGate, empty, "当前列表没有行，没有可复制的文本");
  const exportState = effectiveListGate(exportGate, empty, "当前列表没有行，没有可导出的 CSV");
  // One name, computed when the filter changes: the preview and the download
  // both read this string, so they cannot disagree about the minute.
  const fileName = useMemo(
    () => runCsvFileName(windowKey, statusKey, new Date()),
    [windowKey, statusKey],
  );
  const exportCsv = () => {
    try {
      const blob = new Blob([`\uFEFF${runListCsv(rows, names)}`], { type: "text/csv;charset=utf-8" });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = fileName;
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
      setExportStatus("done");
    } catch {
      setExportStatus("failed");
    }
  };
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
        disabled={copyState.disabled}
        aria-disabled={copyState.disabled}
        onClick={copy}
        data-testid="run-list-copy"
        title={
          copyState.disabled
            ? copyState.title
            : `复制当前列表为纯文本：表头加 ${rows.length} 行；当前已加载 ${rows.length} 行，不是全量（每页最多 ${PAGE_LIMIT} 条）`
        }
      >
        <Copy className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
        复制为纯文本
      </Button>
      <Button
        size="sm"
        outlined
        disabled={exportState.disabled}
        aria-disabled={exportState.disabled}
        onClick={exportCsv}
        data-testid="run-list-export"
        title={
          exportState.disabled
            ? exportState.title
            : `导出当前列表为 CSV：表头加 ${rows.length} 行；当前已加载 ${rows.length} 行，不是全量（每页最多 ${PAGE_LIMIT} 条）`
        }
      >
        <Download className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
        导出 CSV
      </Button>
      <span className="min-w-0 text-xs text-muted-foreground" data-testid="run-list-export-count" data-rows={rows.length}>
        可导出 {rows.length} 行
      </span>
      <code className="min-w-0 break-all font-mono text-xs text-muted-foreground" data-testid="run-export-name" title={fileName}>
        {fileName}
      </code>
      <span
        className="min-w-0 text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
        data-testid="run-list-export-status"
      >
        {exportStatus === "done" ? `已导出 ${rows.length} 行` : exportStatus === "failed" ? "导出没成功：这份文件没有生成" : ""}
      </span>
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

/**
 * The permalink for the run currently selected in the address bar (`?run=`).
 * It only re-strings parameters that are already on screen, so copying adds no
 * request; pasting it back lands on the same filters and the same record.
 */
function RunPermalink({ href }: { href: string | null }): ReactNode {
  const [status, setStatus] = useState<"idle" | "done" | "failed">("idle");
  const [body, setBody] = useState("");
  const disabled = href === null;
  const copy = () => {
    if (href === null) return;
    setBody(href);
    copyTextToClipboard(href).then((ok) => setStatus(ok ? "done" : "failed"));
  };
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2" data-testid="run-permalink-bar">
      <Button
        size="sm"
        outlined
        onClick={copy}
        disabled={disabled}
        data-testid="run-permalink"
        title={
          disabled
            ? "先选中一条运行再复制"
            : "复制这条运行的链接：保留当前筛选、排序与运行标识，粘到地址栏会回到同一页并选中它。"
        }
      >
        <Copy className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
        复制运行链接
      </Button>
      <span className="min-w-0 text-xs text-muted-foreground" role="status" aria-live="polite" data-testid="run-permalink-status">
        {status === "done"
          ? "链接已复制"
          : status === "failed"
            ? "链接没复制成功：下面的文本可以自己选中复制"
            : disabled
              ? "选中一条运行（展开或打开详情）之后才能复制它的链接。"
              : "只拼地址栏已有参数，复制或粘贴都不会再读一次服务。"}
      </span>
      {status === "failed" ? (
        <div className="w-full min-w-0" data-testid="run-permalink-fallback">
          <textarea
            readOnly
            value={body}
            aria-label="运行链接"
            data-testid="run-permalink-fallback-text"
            className="h-16 w-full resize-y rounded-md border border-border bg-card p-2 font-mono text-xs text-foreground"
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * A sortable column header: the wrapper carries aria-sort, the control is a
 * real button so Enter and Space work without extra key handling.
 */
function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onSort,
  disabled,
}: {
  label: string;
  sortKey: RunSortKey;
  active: RunSortKey | null;
  dir: RunSortDir;
  onSort: (key: RunSortKey) => void;
  disabled: boolean;
}): ReactNode {
  const isActive = active === sortKey;
  const ariaSort = isActive ? (dir === "asc" ? "ascending" : "descending") : "none";
  return (
    <span role="columnheader" aria-sort={ariaSort} className="min-w-0">
      <button
        type="button"
        data-testid={`run-sort-${sortKey}`}
        className="min-w-0 break-words text-left underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
        aria-label={`按${label}排序${isActive ? (dir === "asc" ? "（当前升序）" : "（当前降序）") : ""}`}
        title={disabled ? "这一页还没有读出行，暂时不能排序。" : isActive ? "再点一次换方向；只在已加载的行内排序。" : "在这一页已加载的行内排序。"}
        disabled={disabled}
        onClick={() => onSort(sortKey)}
      >
        {label}
        {isActive ? <span aria-hidden="true">{dir === "asc" ? " ↑" : " ↓"}</span> : null}
      </button>
    </span>
  );
}

function ListRows({
  rows,
  names,
  hrefOf,
  previewGate,
  sortKey,
  sortDir,
  onSort,
  sortDisabled,
  selectedId,
}: {
  rows: RunRow[];
  names: Map<string, string>;
  sortKey: RunSortKey | null;
  sortDir: RunSortDir;
  onSort: (key: RunSortKey) => void;
  sortDisabled: boolean;
  /** The run the address bar points at (`?run=`); that row is marked, not expanded. */
  selectedId: string | null;
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
  // Roving tabindex: exactly one row is in the tab order, arrows move focus
  // between rows, Enter/Space toggles that row's preview. Inner links and
  // buttons keep their native Tab stops, so nothing becomes unreachable.
  const [activeIndex, setActiveIndex] = useState(0);
  const rowRefs = useRef<Array<HTMLLIElement | null>>([]);
  const lastIndex = Math.max(0, rows.length - 1);
  const tabStop = Math.min(activeIndex, lastIndex);
  const focusRow = (next: number) => {
    const target = Math.max(0, Math.min(next, lastIndex));
    setActiveIndex(target);
    rowRefs.current[target]?.focus();
  };
  const close = useCallback((rowId: string) => {
    setOpenId(null);
    const index = rows.findIndex((row) => row.runId === rowId);
    const row = index >= 0 ? rowRefs.current[index] : null;
    if (row) row.focus();
    else toggleRefs.current.get(rowId)?.focus();
  }, [rows]);
  return (
    <Card className="min-w-0 border-border bg-card" data-testid="run5-table">
      <CardContent className="p-0">
        <div className={`hidden ${GRID} border-b border-border px-4 py-2 text-xs text-muted-foreground sm:grid`}>
          <span>运行</span>
          <SortHeader label="状态" sortKey="status" active={sortKey} dir={sortDir} onSort={onSort} disabled={sortDisabled} />
          <SortHeader label="开始" sortKey="started" active={sortKey} dir={sortDir} onSort={onSort} disabled={sortDisabled} />
          <SortHeader label="耗时" sortKey="elapsed" active={sortKey} dir={sortDir} onSort={onSort} disabled={sortDisabled} />
          <SortHeader label="成本（美元）" sortKey="cost" active={sortKey} dir={sortDir} onSort={onSort} disabled={sortDisabled} />
          <span>负责人</span><span>失败原因</span><span aria-hidden="true"></span>
        </div>
        <ul className="divide-y divide-border">
          {rows.map((row, index) => {
            const start = beijingMinute(row.startedAt);
            const elapsed = elapsedMinute(row.startedAt, row.endedAt);
            const reason = failureSummary(row);
            const base = `run5-row-${index}`;
            const open = openId === row.runId;
            const isSelected = selectedId !== null && selectedId === row.runId;
            return (
              <li
                key={row.runId}
                ref={(node) => {
                  rowRefs.current[index] = node;
                }}
                role="group"
                tabIndex={index === tabStop ? 0 : -1}
                aria-expanded={open}
                aria-controls={open ? `run-row-preview-${index}` : undefined}
                aria-label={`${runCode(row.runId)}：${statusLabel(row.status)}`}
                className={`min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2${isSelected ? " bg-muted/40" : ""}`}
                data-testid={base}
                data-status={row.status ?? "unknown"}
                data-selected={isSelected ? "1" : undefined}
                aria-current={isSelected ? "true" : undefined}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    if (!open) return;
                    event.stopPropagation();
                    close(row.runId);
                    return;
                  }
                  // Keys pressed inside the row's own controls keep their native
                  // behaviour; only the row carrier itself drives arrow navigation.
                  if (event.target !== event.currentTarget) return;
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    focusRow(index + 1);
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    focusRow(index - 1);
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    focusRow(0);
                  } else if (event.key === "End") {
                    event.preventDefault();
                    focusRow(lastIndex);
                  } else if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    if (previewGate.disabled) return;
                    setOpenId(open ? null : row.runId);
                  }
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
    <div className="ui-c-section">
      <h3 className="ui-c-section-title">事件时间线</h3>
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
                className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-border pb-2 text-sm last:border-0"
                data-testid={`run5-event-${ev.seq}`}
              >
                <span className="ui-c-num shrink-0 text-xs text-muted-foreground">#{ev.seq}</span>
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
                      className="ui-c-id text-muted-foreground underline"
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
                      className="ui-c-id text-muted-foreground"
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
                <span className="ui-c-num flex min-w-0 shrink-0 flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground" title={ev.occurredAt ?? undefined}>
                  <span className="ui-c-num shrink-0 text-xs text-muted-foreground" data-testid={"run5-status-" + ev.seq} title={st.reason || undefined}>{st.text}</span>
                  <span className="ui-c-num shrink-0 text-xs text-muted-foreground" data-testid={"run5-duration-" + ev.seq} title={dur.reason || undefined}>{dur.text ?? "—"}</span>
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

function DetailField({
  label,
  children,
  num,
}: {
  label: string;
  children: ReactNode;
  num?: boolean;
}): ReactNode {
  return (
    <div className="ui-c-field">
      <span className="ui-c-field-label">{label}</span>
      <span className={`ui-c-field-value${num ? " ui-c-num" : ""}`}>{children}</span>
    </div>
  );
}


const RUN_SORT_LABEL: Record<RunSortKey, string> = {
  status: "状态",
  started: "开始时间",
  elapsed: "耗时",
  cost: "成本",
};

const RUN_STATE_LABEL: Record<string, string> = {
  loading: "加载中",
  empty: "空列表",
  error: "读取失败",
  denied: "无权限",
};

function RunSourceBar({ source }: { source: ReturnType<typeof runSource> }) {
  const [status, setStatus] = useState<"idle" | "done" | "failed">("idle");
  const body = source.path;
  const copy = () => {
    copyTextToClipboard(body).then((ok) => setStatus(ok ? "done" : "failed"));
  };
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs" data-testid="run-source">
      <span className="text-muted-foreground">当前筛选可分享形态</span>
      <code className="min-w-0 break-all text-[11px]" data-testid="run-source-path" title={body}>
        {body}
      </code>
      {source.active ? null : (
        <span className="text-muted-foreground" data-testid="run-source-none">
          未设置筛选（按默认近 7 天读取）
        </span>
      )}
      {source.notes.map((note) => (
        <span className="text-muted-foreground" key={note} data-testid="run-source-note">
          {note}
        </span>
      ))}
      <Button size="sm" outlined onClick={copy} data-testid="run-filter-copy" title="复制当前地址里的筛选条件，不含主机与凭据">
        复制筛选条件
      </Button>
      <span role="status" aria-live="polite" data-testid="run-filter-copy-status" className="text-muted-foreground">
        {status === "done" ? "已复制筛选条件" : status === "failed" ? "复制没成功：下面的文本可以自己选中复制" : ""}
      </span>
      {status === "failed" ? (
        <div className="w-full" data-testid="run-filter-copy-fallback">
          <textarea
            readOnly
            value={body}
            aria-label="筛选条件文本"
            data-testid="run-filter-copy-fallback-text"
            className="h-16 w-full resize-none rounded-md border border-border bg-transparent p-2 font-mono text-[11px]"
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The footer notes: seven rows of 「口径名 · 实际路径 · 计算范围 · 缺值策略」.
 * Collapsed by default — the body is not rendered while closed, so a reader
 * meets a button, not a wall. Opening or closing asks the service for nothing.
 */
function RunNotes(): ReactNode {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-0" data-testid="run-notes">
      <Button
        size="sm"
        outlined
        type="button"
        aria-expanded={open}
        aria-controls="run-notes-body"
        data-testid="run-notes-toggle"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "收起口径说明" : RUN_NOTES_TITLE}
      </Button>
      {open ? (
        <div id="run-notes-body" className="mt-2 flex flex-col gap-1" data-testid="run-notes-body">
          {RUN_NOTE_ROWS.map((note) => (
            <p
              key={note.key}
              className="min-w-0 break-words text-xs leading-5 text-muted-foreground"
              data-testid={`run-note-${note.key}`}
              title={`${note.path}｜${note.scope}｜${note.missing}`}
            >
              <span className="font-medium text-foreground">{note.area}</span>
              <span aria-hidden="true"> · </span>
              <span>{note.path}</span>
              <span aria-hidden="true"> · </span>
              <span>{note.scope}</span>
              <span aria-hidden="true"> · </span>
              <span>{note.missing}</span>
            </p>
          ))}
        </div>
      ) : null}
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
  const source = runSource({
    windowRaw: params.get("window"),
    window: sinceKey,
    statusRaw: params.get("status"),
    status,
    employee,
    stateRaw: params.get("state"),
    state: forced,
  });

  // One table drives both the shareable path and this reset; a raw value the
  // page could not parse still occupies a filter slot, so it is cleared too.
  const filterReset = resetRunFilters(new URLSearchParams(params));
  const unrecognizedFilters = (() => {
    const raws: string[] = [];
    const windowRaw = params.get("window");
    if (windowRaw !== null && windowRaw !== sinceKeyOf(windowRaw)) raws.push(windowRaw);
    const statusRaw = params.get("status");
    if (statusRaw !== null && statusFilterOf(statusRaw) !== statusRaw) raws.push(statusRaw);
    const stateRaw = params.get("state");
    if (stateRaw !== null && forced === null) raws.push(stateRaw);
    return raws;
  })();
  const resetTitle = resetFiltersTitle(filterReset.removed, unrecognizedFilters);
  const resetFilters = () => {
    if (filterReset.removed.length === 0) return;
    cancelRefreshRef.current();
    setParams(filterReset.next, { replace: true, state: locationState ?? null });
  };
  const data = useRunsData(forced, { status, sinceKey, employeeId: employee });
  const { phase, rows, cursor, asOf, asOfSource, answeredBy, unreadable, failure, forced: isForced } =
    data;
  const { refreshState, paging } = data;
  useEffect(() => {
    cancelRefreshRef.current = refreshState.cancel;
  }, [refreshState.cancel]);
  const asof = asOfCell(asOf, asOfSource);

  // Sorting is local: the list route accepts no sort parameter (see runs.ts
  // askListRoute), so this only reorders the rows already on screen.
  const rsort = parseRunSort(params.get("rsort"));
  const rdir = parseRunDir(params.get("rdir"), rsort);
  const sortedRows = useMemo(
    () => (rsort ? sortRunRows(rows, rsort, rdir) : rows),
    [rows, rsort, rdir],
  );
  const chooseSort = (key: RunSortKey) => {
    // A new order starts again from page one: the cursor that fetched the
    // appended pages belongs to the old order, not this one.
    paging.resetPages();
    // One write for both keys: two setParam calls would both start from the
    // same params snapshot and the second would drop the first.
    const next = new URLSearchParams(params);
    const dir = rsort === key ? (rdir === "asc" ? "desc" : "asc") : defaultRunDir(key);
    next.set("rsort", key);
    next.set("rdir", dir);
    setParams(next, { replace: true, state: locationState ?? null });
  };

  const [readTick, setReadTick] = useState(0);
  const detail = useRunDetail(selected, readTick);

  const cancelRefreshRef = useRef<() => void>(() => {});
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const removeChip = (keys: readonly string[]) => {
    cancelRefreshRef.current();
    const next = new URLSearchParams(params);
    for (const key of keys) next.delete(key);
    setParams(next, { replace: true, state: locationState ?? null });
  };
  // One chip per entry of the shared table; the two sort parameters are one
  // chip because the address always carries them together.
  const filterChips: { key: string; label: string; value: string; title: string; params: string[] }[] = [];
  for (const spec of RUN_PARAM_TABLE) {
    if (spec.key === "rdir") continue;
    if (spec.key === "rsort") {
      if (!params.has("rsort") && !params.has("rdir")) continue;
      const raw = [params.get("rsort"), params.get("rdir")].filter(Boolean).join(" / ");
      filterChips.push({
        key: "sort",
        label: "排序",
        value: `按${RUN_SORT_LABEL[rsort ?? "cost"]} ${rdir === "asc" ? "升序" : "降序"}`,
        title: `地址原值：${raw}；排序只在已加载的行内生效，移除后回到默认的成本降序。`,
        params: ["rsort", "rdir"],
      });
      continue;
    }
    const raw = params.get(spec.key);
    if (raw === null) continue;
    let value = raw;
    let note = "";
    if (spec.key === "window") {
      value = sinceLabel(sinceKey);
      if (raw !== sinceKey) note = "该值未被识别，按近 7 天读取";
    } else if (spec.key === "status") {
      const parsed = statusFilterOf(raw);
      value = parsed ? statusLabel(parsed) : raw;
      if (!parsed) note = "该值未被识别，按全部状态读取";
    } else if (spec.key === "employee") {
      value = employeeLabel(employee, names);
    } else if (spec.key === "state") {
      value = forced ? RUN_STATE_LABEL[forced] : raw;
      if (!forced) note = "该值未被识别，按正常读取";
    }
    filterChips.push({
      key: spec.key,
      label: spec.label,
      value,
      title: note ? `地址原值：${raw}；${note}` : `地址原值：${raw}`,
      params: [spec.key],
    });
  }

  // Employee names decorate the list as well as the detail line. The directory
  // is a side-read for labels only: if it fails, the 8-character code stays as
  // the honest fallback and the run answer is untouched.
  // Preview and detail read the same six fields through one helper, so the two
  // renderings cannot drift apart (missing values say the same sentence).
  const detailView = detail.k === "ready" ? runPreview(detail.run, names) : null;

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
    refreshState.cancel();
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
      <div className="flex min-w-0 flex-wrap items-center gap-2" data-testid="run-refresh-bar">
        <Button
          size="sm"
          outlined
          onClick={refreshState.refresh}
          aria-busy={refreshState.busy}
          disabled={isForced}
          title={forcedTitle ?? "按当前窗口、状态、负责人与排序再要一次运行记录；只读，不改任何运行"}
          data-testid="run-refresh"
          prefix={<RefreshCw className="h-3.5 w-3.5" />}
        >
          刷新
        </Button>
        {refreshState.busy ? (
          <span className="min-w-0 break-words text-xs text-muted-foreground" role="status" aria-live="polite" data-testid="run-busy-note">
            更新中…（先保留上一次读到的数据）
          </span>
        ) : null}
        {!refreshState.busy && refreshState.updatedAt !== null ? (
          <span className="min-w-0 break-words text-xs text-muted-foreground" data-testid="run-updated-at">
            {`刷新完成于 ${beijingMinute(refreshState.updatedAt).text ?? "—"}（读取时刻，不是数据时刻）`}
          </span>
        ) : null}
      </div>
      {refreshState.error !== null ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-border px-2 py-1 text-xs" data-testid="run-refresh-error">
          <span className="min-w-0 break-words">这次刷新没成功：{refreshState.error.sentence}</span>
          {refreshState.error.requestId !== null ? (
            <>
              <span className="text-muted-foreground">请求编号</span>
              <code className="min-w-0 break-all text-[11px]" data-testid="run-refresh-rid">{refreshState.error.requestId}</code>
              <Button
                size="sm"
                outlined
                onClick={() => void copyTextToClipboard(refreshState.error?.requestId ?? "")}
                data-testid="run-refresh-copy"
              >
                复制编号
              </Button>
            </>
          ) : (
            <span className="text-muted-foreground" data-testid="run-refresh-rid-absent">本次请求未记录编号</span>
          )}
          <Button size="sm" outlined onClick={refreshState.refresh} data-testid="run-refresh-retry">
            再试
          </Button>
        </div>
      ) : null}
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
          <div
            className="flex min-w-0 flex-col gap-1 text-xs"
            role="group"
            aria-label="时间范围"
            data-testid="run5-filter-window"
            title={isForced ? forcedTitle : "换时间范围会重新向服务要一次数据，其余筛选保持不变"}
          >
            <span className="text-muted-foreground">时间范围</span>
            <div className="flex min-w-0 flex-wrap gap-1">
              {SINCE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  data-testid={`run-window-${option.key}`}
                  aria-pressed={option.key === sinceKey}
                  className={
                    option.key === sinceKey
                      ? "rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-medium"
                      : "rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                  }
                  onClick={() => {
                    refreshState.cancel();
                    setParam("window", option.key);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex min-w-0 flex-col gap-1 text-xs" htmlFor="run5-filter-status">
            <span className="text-muted-foreground">状态</span>
            <ConsoleSelect
              id="run5-filter-status"
              data-testid="run5-filter-status"
              className="h-8 min-w-0 max-w-40 rounded-md border border-border bg-transparent px-2 text-sm"
              value={status ?? ""}
              title={isForced ? forcedTitle : "换状态会重新向服务要一次数据"}
              onChange={(next) => {
                refreshState.cancel();
                setParam("status", next || null);
              }}
              options={[
                { value: "", label: "全部状态" },
                ...STATUS_KEYS.map((key) => ({ value: key, label: statusLabel(key) })),
              ]}
            />
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
          <Button
            size="sm"
            outlined
            onClick={resetFilters}
            disabled={filterReset.removed.length === 0}
            data-testid="run-reset-filters"
            title={resetTitle ?? "当前没有可清除的筛选条件"}
          >
            清除筛选
          </Button>
        </div>
        {filterChips.length > 0 ? (
          <div
            className="flex min-w-0 flex-wrap items-center gap-2"
            data-testid="run-filter-chips"
            aria-label="生效筛选"
          >
            <span className="text-xs text-muted-foreground">当前筛选</span>
            {filterChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex min-w-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs"
                data-testid={`run-chip-${chip.key}`}
                title={chip.title}
              >
                <span className="min-w-0 truncate">{chip.label}：{chip.value}</span>
                <button
                  type="button"
                  className="shrink-0 rounded-full px-1 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  aria-label={`移除${chip.label}筛选`}
                  data-testid={`run-chip-${chip.key}-remove`}
                  onClick={() => removeChip(chip.params)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {forced !== null ? <ReproNote state={forced} /> : null}

      <p className="min-w-0 break-words text-xs text-muted-foreground" aria-live="polite" data-testid="run5-status">
        {statusLine}
      </p>

      <RunSourceBar source={source} />

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
          : "本页 — 次 · 失败 — · 运行中 —（暂时读不到运行数据，请稍后重试）"}
        {phase === "ready" && cursor ? "；服务说这一页之外还有更多" : ""}
        {unreadable > 0 && countsKnown
          ? `；另有 ${unreadable} 条这次没有返回有效的运行编号，没有算在上面`
          : ""}
      </p>
      {countsKnown ? null : (
        // 设计车道⑤：技术口径从主句撤下，收进「详情」折叠（样式参照 pages/SystemPage.tsx 的原生 details 先例）。
        <details className="text-xs text-muted-foreground" data-testid="run5-counts-detail">
          <summary className="cursor-pointer">详情</summary>
          <p className="mt-1">
            读取没有成功之前数字不作零处理：这里写「—」，不按 0 算。
            {failure?.requestId ? `请求编号：${failure.requestId}` : ""}
          </p>
        </details>
      )}

      <p
        className="min-w-0 break-words text-xs text-muted-foreground"
        data-testid="run-page-cap"
        title={pageCapTitle()}
      >
        已加载 {countsKnown ? rows.length : "—"} 行（{pageCapText()}；复制与导出也只含这些行，不报全量）
        {phase === "ready" && cursor ? (
          <span className="ml-2" data-testid="run-page-cap-more">
            {pageCapMoreText()}
          </span>
        ) : null}
      </p>

      <p
        className="min-w-0 break-words text-xs text-muted-foreground"
        data-testid="run-asof-line"
      >
        采集时刻 <span data-testid="run-asof" title={asof.title}>{asof.text}</span>
        （上游给了才显示；没给就是「—」，不拿本机时间顶替）
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
          <CardContent className="ui-c-container min-w-0 space-y-4 p-4">
            <div className="ui-c-head ui-c-head--plain ui-c-head--start">
              <div className="min-w-0 flex-1">
                <h2 className="ui-c-head-title ui-c-head-title--lead" title={detail.run.runId}>
                  {runCode(detail.run.runId)}
                </h2>
                <p className="ui-c-head-sub" data-testid="run5-detail-summary">
                  {`${detailView?.status.text ?? "—"} · 开始 ${detailView?.started.text ?? "—"} · 耗时 ${detailView?.elapsed.text ?? "—"}`}
                </p>
              </div>
              <span className="ui-c-head-actions">
                <Button size="sm" outlined onClick={closeRun} prefix={<X className="h-3.5 w-3.5" />} data-testid="run5-detail-close">
                  关闭
                </Button>
              </span>
            </div>

            <dl className="ui-c-fields ui-c-fields--compact">
              <DetailField label="状态">
                <span title={detailView?.status.title}>
                  <Badge tone={statusTone(detail.run.status)} data-testid="run5-detail-status">{detailView?.status.text ?? "—"}</Badge>
                </span>
              </DetailField>
              <DetailField label="成本" num>
                <CostCell row={detail.run} testId="run5-detail-cost" />
              </DetailField>
              <DetailField label="预算上限" num>
                {detail.run.budgetCapUsd === null || detail.run.budgetCapUsd === undefined ? (
                  <Dashed reason="服务没有给出预算上限" />
                ) : (
                  usd(detail.run.budgetCapUsd)
                )}
              </DetailField>
              <DetailField label="第几次尝试" num>
                {detail.run.attemptNo === undefined ? <Dashed reason="服务没有给出尝试次数" /> : `第 ${detail.run.attemptNo} 次`}
              </DetailField>
              <DetailField label="结束" num>
                <span data-testid="run5-detail-ended" title={detailView?.ended.title}>
                  {detailView?.ended.text ?? "—"}
                </span>
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
                <span data-testid="run5-detail-employee" title={detailView?.employee.title}>
                  {detailView?.employee.text ?? "—"}
                </span>
              </DetailField>
              <DetailField label="事件" num>
                {detail.eventsFailure
                  ? "这次没有读到"
                  : `${detail.events.length} 条${detail.hasMore ? "（服务说还有更多）" : ""}`}
              </DetailField>
              <div className="ui-c-field--span">
                <DetailField label="上游运行">
                  <UpstreamLine raw={detail.run.upstreamRunId} />
                </DetailField>
              </div>
            </dl>

            <Timeline outcome={detail} onRetryEvents={reloadDetail} />

            <div className="ui-c-section">
              <button
                type="button"
                disabled
                aria-disabled="true"
                data-testid="run5-retry-new"
                data-planned="true"
                data-endpoint-http="405"
                className="min-w-0 cursor-not-allowed rounded-[var(--radius-1)] border border-border px-3 py-1 text-left text-xs text-muted-foreground opacity-60"
                title="这个环境的控制台只读：实测写请求一律被拒（POST /api/run-retry → HTTP 405 console.read_only），读路径上也没有这条路由（GET → 404 console.unknown_route）。所以这里只说明语义，点它不会发起任何请求。"
              >
                重试 · 新建一次运行（当前环境只读，不能在这里修改）
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
          guide={
            <>
              <p className="max-w-prose break-words text-xs text-muted-foreground">
                想先有东西可看：去任务板挑一件来跑，或到指标页看这段时间的钱花在哪。
              </p>
              <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
                <Link className="underline underline-offset-2" to="/work?tab=board" data-testid="run-empty-guide-work">
                  去任务板
                </Link>
                <Link className="underline underline-offset-2" to="/metrics" data-testid="run-empty-guide-metrics">
                  看运行分析
                </Link>
              </p>
              <p className="max-w-prose break-words text-xs text-muted-foreground">
                若你刚收窄过条件，清空筛选就能看全部；这里没有汇总数字，也不把空当 0。
              </p>
            </>
          }
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
      {phase === "ready" ? (
        <ListRows
          key={sinceKey}
          rows={sortedRows}
          names={names}
          hrefOf={hrefOf}
          previewGate={listGate.preview}
          selectedId={selected}
          sortKey={rsort}
          sortDir={rdir}
          onSort={chooseSort}
          sortDisabled={false}
        />
      ) : null}
      {phase === "ready" ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2" data-testid="run-more-bar">
          <Button
            size="sm"
            outlined
            type="button"
            data-testid="run-more"
            aria-busy={paging.busy}
            disabled={paging.busy || !paging.hasMore}
            title={
              paging.hasMore
                ? `按当前筛选、排序继续取下一页；每页最多 ${PAGE_LIMIT} 条。`
                : "服务没有给出下一页，列表已经到底了。"
            }
            onClick={paging.loadMore}
          >
            加载更多
          </Button>
          {paging.busy ? (
            <span className="text-xs text-muted-foreground" role="status" aria-live="polite" data-testid="run-more-busy">
              正在取下一页…（已加载的行先保留）
            </span>
          ) : null}
          {!paging.hasMore ? (
            <span className="text-xs text-muted-foreground" data-testid="run-more-end">
              已到末页
            </span>
          ) : null}
        </div>
      ) : null}
      {paging.error ? (
        <div
          className="min-w-0 space-y-1 rounded-md border border-border bg-card p-3 text-xs text-muted-foreground"
          role="status"
          data-testid="run-more-error"
        >
          <p className="min-w-0 break-words">
            这一页没有取到更多运行记录，已加载的行仍然保留。{paging.error.sentence}
          </p>
          <p className="flex min-w-0 flex-wrap items-center gap-2">
            <span>请求编号</span>
            {paging.error.requestId ? (
              <code className="min-w-0 break-all" data-testid="run-more-rid">
                {paging.error.requestId}
              </code>
            ) : (
              <span data-testid="run-more-rid-absent">本次请求未记录编号</span>
            )}
            {paging.error.requestId ? (
              <button
                type="button"
                className="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                data-testid="run-more-copy"
                onClick={() => {
                  if (paging.error?.requestId) void copyTextToClipboard(paging.error.requestId);
                }}
              >
                复制编号
              </button>
            ) : null}
            <button
              type="button"
              className="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              data-testid="run-more-retry"
              onClick={paging.loadMore}
            >
              重试
            </button>
          </p>
        </div>
      ) : null}
      {phase === "ready" ? (
        <p
          className="min-w-0 break-words text-xs text-muted-foreground"
          data-testid="run-cost-caliber-note"
          title={costCaliberTitle("runs")}
        >
          {COST_CALIBER_TEXT}
        </p>
      ) : null}
      {rsort !== null && phase === "ready" ? (
        <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="run-sort-scope-note">
          仅在当前已加载 {sortedRows.length} 行内排序；服务端读口不接受排序参数，点表头不会重新读取。
        </p>
      ) : null}
      {forced === null && phase !== "loading" ? (
        <RunListCopy
          rows={sortedRows}
          names={names}
          copyGate={listGate.copy}
          exportGate={listGate.export}
          windowKey={params.get("window")}
          statusKey={params.get("status")}
        />
      ) : null}

      {forced === null ? <RunPermalink href={selected ? hrefOf(selected) : null} /> : null}

      {phase === "ready" && rows.length > 0 ? (
        <TechnicalDisclosure lines={technical} testId="run5-list-details" />
      ) : null}

      {forced === null && (phase === "ready" || phase === "empty") ? <RunNotes /> : null}
    </div>
  );
}

export default RunsModulePage;
