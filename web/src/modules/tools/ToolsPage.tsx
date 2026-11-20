/**
 * 工具与 MCP — read-only inventory.
 *
 * Real reads: `/api/tools/toolsets` (tool groups and their tools) and
 * `/api/mcp/servers` (registered MCP connections). Both use the dashboard's
 * normal authenticated fetch path. Every row states name, type, enabled state,
 * credential state and last-call time; an absent value is 「—」 with the reason,
 * never 0. Credentials are only ever 已配置 / 未配置 / 未知 — no token value is
 * read or printed. Disabled and unknown rows stay visible but dimmed.
 */
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Check, Copy, Inbox, RefreshCw, ShieldAlert, TriangleAlert } from "lucide-react";

import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { copyTextToClipboard } from "@/lib/clipboard";
import { themedBody } from "@/lib/utils";

import {
  CREDENTIAL_LABEL,
  GAP,
  STATUS_LABEL,
  requestIdLine,
  type FailureCopy,
  type ToolRow,
} from "./tools";
import { forcedStateOf, readOpenTool, rememberOpenTool, useToolsData } from "./useToolsData";
import { CapabilityCounts, publishCapabilityCount } from "../capabilities/counts";
import { CapabilitySearch } from "../capabilities/search";
import { CapabilityExport } from "../capabilities/csvExport";
import { CapabilityCopy } from "../capabilities/listCopy";
import type { CapabilityOutputState } from "../capabilities/outputState";
import { applySort, ariaSort, cycleSort, readSort, sortRows, type SortKey } from "../capabilities/sorting";
import { CapabilityRowDetail } from "../capabilities/rowDetail";
import { useEnsureTabParam } from "../capabilities/tabParam";
import { captureTabView, focusTabButton, noteTabMount, restoreTabView } from "../capabilities/tabView";
import "./tools.css";


function RequestId({ failure }: { failure: FailureCopy | null }): ReactNode {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const id = failure?.requestId ?? null;
  if (!id) {
    return (
      <span className="contents" data-testid="tl3-request-id">
        <span className="min-w-0 break-words text-xs text-muted-foreground" data-testid="tol5-request-id" title={requestIdLine(null)}>
          请求编号：未提供
        </span>
      </span>
    );
  }
  return (
    <span className="contents" data-testid="tl3-request-id">
      <span className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground" data-testid="tol5-request-id">
        请求编号：
        <code className="min-w-0 break-all font-mono" data-testid="tol5-request-id-value">{id}</code>
        <button
        type="button"
        aria-label="复制请求编号"
        className="inline-flex shrink-0 items-center gap-1 underline underline-offset-2"
        onClick={() => {
          void copyTextToClipboard(id).then((ok) => setCopied(ok ? "done" : "failed"));
        }}
      >
        {copied === "done" ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
          {copied === "done" ? "已复制" : copied === "failed" ? "复制失败" : "复制"}
        </button>
      </span>
    </span>
  );
}

function kindLabel(row: ToolRow): string {
  if (row.source === "mcp") return row.type.startsWith("MCP") ? row.type : `MCP · ${row.type}`;
  return `内置 · ${row.type}`;
}

function Row({
  row,
  open,
  onToggle,
  tabIndex,
  setRowRef,
  onFocus,
  onKeyDown,
}: {
  row: ToolRow;
  open: boolean;
  onToggle: () => void;
  tabIndex: number;
  setRowRef: (node: HTMLDivElement | null) => void;
  onFocus: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
}): ReactNode {
  const dimmed = row.status !== "enabled";
  return (
    <>
    <div
      ref={setRowRef}
      tabIndex={tabIndex}
      aria-expanded={open}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      className={`tol5-row flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3 last:border-b-0 ${dimmed ? "opacity-60" : ""}`}
      data-testid="tol5-row"
      data-status={row.status}
      data-source={row.source}
      title={[row.rawId, row.statusReason, row.credentialReason, row.lastUsedReason, row.updatedAtReason].filter(Boolean).join(" · ") || undefined}
    >
      <span className="sr-only" data-testid={`tl3-row-${row.key.replace(/[^a-zA-Z0-9_-]+/g, "-")}`} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="min-w-0 break-words text-sm" data-testid="tol5-name"><span data-testid="tl3-name">{row.name}</span></p>
        <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="tol5-type"><span data-testid="tl3-type">{kindLabel(row)}</span></p>
        <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="tol5-last">
          最近调用：{row.lastUsed ?? "—"}
          {row.lastUsed === null && row.lastUsedReason ? <span className="ml-1">{row.lastUsedReason}</span> : null}
        </p>
        <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="tl3-updated">
          最近更新：{row.updatedAt ?? "—"}
          {row.updatedAt === null && row.updatedAtReason ? <span className="ml-1">{row.updatedAtReason}</span> : null}
        </p>
        {row.failure || row.failureReason ? (
          <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="tol5-failure">
            失败原因：{row.failure ?? "—"}
            {row.failureReason ? <span className="ml-1">{row.failureReason}</span> : null}
          </p>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1">
        <button
          type="button"
          className="cap7-toggle"
          aria-expanded={open}
          onClick={onToggle}
          data-testid="cap7-detail-toggle"
        >
          {open ? "收起" : "详情"}
        </button>
        <span className="min-w-0 text-xs text-muted-foreground" data-testid="tol5-credential">
          凭据：{CREDENTIAL_LABEL[row.credential]}
          {row.credentialReason ? <span className="ml-1">{row.credentialReason}</span> : null}
        </span>
        <span className="flex min-w-0 flex-col items-end gap-0.5">
          <Badge
            tone={row.status === "enabled" ? "success" : row.status === "disabled" ? "destructive" : "secondary"}
            title={[row.statusRaw, row.statusReason].filter(Boolean).join(" · ") || undefined}
          >
            <span data-testid="tol5-status"><span data-testid="tl3-status">{STATUS_LABEL[row.status]}</span></span>
          </Badge>
          {row.statusReason ? (
            <span className="min-w-0 break-words text-[11px] text-muted-foreground" data-testid="tol5-status-reason">
              {row.statusReason}
            </span>
          ) : null}
        </span>
      </div>
    </div>
    {open ? (
      <CapabilityRowDetail
        name={row.name}
        nameReason={row.nameReason}
        type={kindLabel(row)}
        typeReason={row.typeReason}
        enabled={STATUS_LABEL[row.status]}
        enabledReason={row.statusReason}
        enabledTitle={row.statusRaw}
        updatedAt={row.updatedAt}
        updatedReason={row.updatedAtReason}
        endpoint={row.endpoint || (row.source === "mcp" ? "/api/mcp/servers" : "/api/tools/toolsets")}
        asOf={row.asOf}
        asOfReason={row.asOfReason ?? "这次读数没有带采集时刻。"}
        testid="cap7-detail-tools"
      />
    ) : null}
    </>
  );
}

function FailurePanel({
  kind,
  failure,
  onRetry,
}: {
  kind: "error" | "denied" | "login";
  failure: FailureCopy | null;
  onRetry: () => void;
}): ReactNode {
  const denied = kind === "denied";
  const login = kind === "login";
  const heading = denied ? "工具读口未接入" : login ? "需要重新登录" : "工具与 MCP 清单没能加载出来";
  const sentence = denied
    ? failure?.sentence ?? "这块内容要么尚未接入本控制台，要么当前账号无权查看；这里不显示猜测的行，也不展示样例。"
    : login
      ? "登录状态已经失效，请刷新页面重新登录后再看这份清单。"
      : failure?.sentence ?? "读取工具与 MCP 清单时出了问题，请稍后重试。";
  return (
    <Card
      role="alert"
      className={denied ? "capF-state border-border bg-card" : "capF-state border-destructive/40 bg-destructive/5"}
      data-testid={denied ? "tol5-denied" : login ? "tol5-login" : "tol5-error"}
      title={denied ? GAP : failure?.technical ?? undefined}
    >
      <CardContent className="flex min-w-0 flex-col items-start gap-2 px-4 py-6">
        <span className="sr-only" data-testid={denied ? "tl3-denied" : login ? "tl3-login" : "tl3-error"} />
        <span className="sr-only" data-testid={denied ? "capF-state-unavailable" : login ? "capF-state-login" : "capF-state-error"} aria-live="polite">
          {`${heading}：${sentence}`}
        </span>
        {denied ? (
          <span className="sr-only" data-testid={failure?.status === 403 ? "cap9-state-denied" : "cap9-state-unavailable"} />
        ) : null}
        <div className="flex min-w-0 items-center gap-2 text-sm">
          {denied ? <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden /> : <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />}
          <span className="min-w-0 break-words">{heading}</span>
        </div>
        <p className="max-w-prose break-words text-xs text-muted-foreground">{sentence}</p>
        {denied ? (
          <a href="#/approvals" className="text-xs underline underline-offset-2" data-testid="tl3-apply">
            提交开通申请
          </a>
        ) : null}
        <RequestId failure={failure} />
        <span className="contents" data-testid="tl3-retry">
          <span className="contents" data-testid="capF-retry">
            <Button size="sm" outlined onClick={onRetry} prefix={<RefreshCw className="h-3.5 w-3.5" />} data-testid="tol5-retry">
              重试
            </Button>
          </span>
        </span>
      </CardContent>
    </Card>
  );
}

export function ToolsPage(): ReactNode {
  const [params, setParams] = useSearchParams();
  useEnsureTabParam("tools");
  const [openTool, setOpenTool] = useState<string | null>(() => readOpenTool());
  const [rovingKey, setRovingKey] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    rememberOpenTool(openTool);
  }, [openTool]);

  useEffect(() => {
    const root = rootRef.current;
    if (noteTabMount("tools")) {
      restoreTabView("tools", root);
      focusTabButton("tools");
    }
    const capture = () => {
      if (rootRef.current) {
        captureTabView("tools", rootRef.current, '[data-testid^="tl3-row-"]');
      }
    };
    window.addEventListener("scroll", capture, true);
    return () => {
      capture();
      window.removeEventListener("scroll", capture, true);
    };
  }, []);

  useEffect(() => {
    if (!openTool) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenTool(null);
        rowRefs.current[openTool]?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openTool]);
  const forced = forcedStateOf(params.get("state"));
  const tools = useToolsData(forced);
  const { phase, rows } = tools;
  const q = (params.get("q") ?? "").trim();
  const sort = readSort(params);
  const needle = q.toLowerCase();
  const visibleRows = needle ? rows.filter((row) => row.name.toLowerCase().includes(needle)) : rows;
  const sortedRows = sortRows(visibleRows, sort, (row: ToolRow, key) =>
    key === "name" ? row.name : key === "type" ? row.type : row.updatedAt);
  const disabled = sortedRows.filter((row) => row.status === "disabled").length;
  const unknown = sortedRows.filter((row) => row.status === "unknown").length;
  const toolRows = sortedRows.filter((row) => row.source === "toolset");
  const mcpRows = sortedRows.filter((row) => row.source === "mcp");
  const keyRows = [...toolRows, ...mcpRows];
  const activeToolKey =
    rovingKey && keyRows.some((row) => row.key === rovingKey)
      ? rovingKey
      : keyRows[0]?.key ?? null;
  const onRowKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
    row: ToolRow,
    index: number,
  ) => {
    if (event.target !== event.currentTarget) return;
    const move = (nextIndex: number) => {
      const target = keyRows[nextIndex];
      if (!target) return;
      event.preventDefault();
      setRovingKey(target.key);
      rowRefs.current[target.key]?.focus();
    };
    if (event.key === "ArrowDown") move(Math.min(index + 1, keyRows.length - 1));
    else if (event.key === "ArrowUp") move(Math.max(index - 1, 0));
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(keyRows.length - 1);
    else if (event.key === "Enter") {
      event.preventDefault();
      setOpenTool((current) => (current === row.key ? null : row.key));
    } else if (event.key === "Escape") {
      if (openTool === row.key) {
        event.preventDefault();
        setOpenTool(null);
      }
      rowRefs.current[row.key]?.focus();
    }
  };
  const onSort = (key: SortKey) => {
    const next = cycleSort(sort, key);
    const search = new URLSearchParams(params);
    applySort(search, next);
    setParams(search);
  };
  const setQ = (next: string) => {
    const search = new URLSearchParams(params);
    if (next) search.set("q", next);
    else search.delete("q");
    setParams(search, { replace: true });
  };
  useEffect(() => {
    if (forced !== null) return;
    if (phase === "loading") {
      publishCapabilityCount("tools", { value: null, source: "loading", reason: null, gap: null });
      return;
    }
    if (phase === "ready") {
      if (tools.issues.length > 0) {
        publishCapabilityCount("tools", {
          value: null,
          source: "missing",
          reason: `${tools.issues.length} 个来源未接入，无法给出完整计数。`,
          gap: null,
        });
        return;
      }
      publishCapabilityCount("tools", {
        value: visibleRows.length,
        source: visibleRows.length ? "ready" : "empty",
        reason: null,
        gap: null,
      });
      return;
    }
    if (phase === "empty") {
      publishCapabilityCount("tools", { value: 0, source: "empty", reason: null, gap: null });
      return;
    }
    publishCapabilityCount("tools", {
      value: null,
      source: "missing",
      reason: tools.failure?.sentence ?? "工具读口这次没有返回可用的计数。",
      gap: phase === "denied" ? GAP : null,
    });
  }, [forced, phase, visibleRows.length, tools.failure?.sentence, tools.issues.length]);
  const retry = () => {
    if (forced !== null) {
      const next = new URLSearchParams(params);
      next.delete("state");
      setParams(next);
    }
    tools.reload();
  };
  const body = (() => {
    if (phase === "loading") {
      return (
        <div className="capF-state flex min-w-0 flex-col gap-2" data-testid="tol5-loading" aria-busy="true" data-fixture={forced ?? undefined}>
          <span className="sr-only" data-testid="tl3-loading" />
          <span className="sr-only" data-testid="capF-state-loading" aria-live="polite">正在读取工具与 MCP 清单…</span>
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="animate-pulse rounded-md border border-border bg-card px-4 py-4" aria-hidden="true">
              <div className="h-3 w-1/3 rounded-sm bg-muted" />
              <div className="mt-3 h-2.5 w-2/3 rounded-sm bg-muted/70" />
            </div>
          ))}
        </div>
      );
    }
    if (phase === "denied") return <FailurePanel kind="denied" failure={tools.failure} onRetry={retry} />;
    if (phase === "login") return <FailurePanel kind="login" failure={tools.failure} onRetry={retry} />;
    if (phase === "error") return <FailurePanel kind="error" failure={tools.failure} onRetry={retry} />;
    if (phase === "empty") {
      return (
        <Card className="capF-state border-border bg-card" data-testid="tol5-empty" data-fixture={forced ?? undefined}>
          <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-10 text-center">
            <span className="sr-only" data-testid="tl3-empty" />
            <span className="sr-only" data-testid="cap9-state-empty" />
            <span className="sr-only" data-testid="capF-state-empty" aria-live="polite">读口已接入，本次返回 0 条；不补样例。</span>
            <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden />
            <p className={`min-w-0 break-words text-sm ${themedBody}`}>服务已响应，清单里没有工具或 MCP 连接</p>
            <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="capF-state-empty-text">读口已接入，本次返回 0 条；不补样例。</p>
            <p className="max-w-prose break-words text-xs text-muted-foreground">
              这不是加载失败，也不显示样例；在原生工具与 MCP 管理页登记后回到这里重新读取。
            </p>
            <Button size="sm" outlined onClick={retry} prefix={<RefreshCw className="h-3.5 w-3.5" />} data-testid="tol5-retry">
              重新读取
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (q && visibleRows.length === 0) {
      return (
        <Card className="border-border bg-card" data-testid="tl3-no-match">
          <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-8 text-center">
            <p className={`min-w-0 break-words text-sm ${themedBody}`}>没有匹配项</p>
            <p className="max-w-prose break-words text-xs text-muted-foreground">
              当前已加载的 {rows.length} 项里没有名称包含「{q}」的条目。
            </p>
            <Button size="sm" outlined onClick={() => setQ("")} data-testid="tl3-clear">
              清空搜索
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="flex min-w-0 flex-col gap-3">
        {tools.issues.map((issue) => (
          <div
            className="min-w-0 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs"
            data-testid={`tol5-issue-${issue.label}`}
            key={issue.label}
          >
            <b>{issue.label}没有读到</b>
            <span className="ml-1 break-words">{issue.failure.sentence}</span>
            <RequestId failure={issue.failure} />
          </div>
        ))}

        <Card className="border-border bg-card" data-testid="tol5-list">
          <CardContent className="p-0">
            <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground" data-testid="tol5-tools-head">
              工具与工具集：{toolRows.length} 条
            </div>
            {toolRows.length ? toolRows.map((row, index) => (
              <Row
                row={row}
                key={row.key}
                open={openTool === row.key}
                onToggle={() => setOpenTool(openTool === row.key ? null : row.key)}
                tabIndex={row.key === activeToolKey ? 0 : -1}
                setRowRef={(node) => { rowRefs.current[row.key] = node; }}
                onFocus={() => setRovingKey(row.key)}
                onKeyDown={(event) => onRowKeyDown(event, row, index)}
              />
            )) : (
              <p className="px-4 py-4 text-xs text-muted-foreground" data-testid="tol5-tools-empty">
                工具目录已响应，没有列出工具。
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card" data-testid="tol5-mcp-section">
          <CardContent className="p-0">
            <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
              MCP 连接：{mcpRows.length} 个
            </div>
            {mcpRows.length ? mcpRows.map((row, index) => (
              <Row
                row={row}
                key={row.key}
                open={openTool === row.key}
                onToggle={() => setOpenTool(openTool === row.key ? null : row.key)}
                tabIndex={row.key === activeToolKey ? 0 : -1}
                setRowRef={(node) => { rowRefs.current[row.key] = node; }}
                onFocus={() => setRovingKey(row.key)}
                onKeyDown={(event) => onRowKeyDown(event, row, toolRows.length + index)}
              />
            )) : (
              <p className="px-4 py-4 text-xs text-muted-foreground" data-testid="tol5-mcp-empty">
                服务已响应，没有登记 MCP 连接；这不是加载失败。
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  })();

  const displayRows = [...toolRows, ...mcpRows];
  const exportRows = displayRows.map((row) => ({
    name: row.name,
    type: row.type,
    enabled: row.status,
    updated_at: row.updatedAt,
  }));
  const copyRows = displayRows.map((row) => ({
    name: row.name,
    type: kindLabel(row),
    enabled: STATUS_LABEL[row.status],
    updated_at: row.updatedAt,
  }));
  const outputState: CapabilityOutputState =
    phase === "loading"
      ? { kind: "loading" }
      : phase === "empty"
        ? { kind: "empty" }
        : phase === "denied"
          ? {
              kind: "unavailable",
              reason: tools.failure?.sentence ?? "这块内容要么尚未接入本控制台，要么当前账号无权查看。",
              gap: GAP,
            }
          : phase === "login"
            ? {
                kind: "error",
                reason: "登录状态已经失效，请刷新页面重新登录后再看这份清单。",
                requestId: tools.failure?.requestId ?? null,
              }
            : phase === "error"
              ? {
                  kind: "error",
                  reason: tools.failure?.sentence ?? "读取工具与 MCP 清单时出了问题，请稍后重试。",
                  requestId: tools.failure?.requestId ?? null,
                }
              : { kind: "ready" };

  return (
    <section ref={rootRef} className="capH-scroll flex min-w-0 w-full max-w-full flex-col" data-testid="tl3-page">
    <span className="sr-only" data-testid="capH-page-tools" />
    <CapabilityCounts />
    <div
      className="tol5-page flex min-w-0 w-full max-w-full flex-col gap-3"
      data-testid="tol5-page"
      data-page="tools"
      data-fixture={forced ?? undefined}
      data-cap-state={phase === "denied" ? "unavailable" : phase}
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h1 className={`min-w-0 break-words text-xl ${themedBody}`}>工具与 MCP</h1>
          <p className="mt-1 min-w-0 break-words text-xs text-muted-foreground">
            只读工具目录与已登记的 MCP 连接；不新建、不改配置、不连接任何服务，也不显示任何凭据值。
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <CapabilityExport tab="tools" rows={exportRows} state={outputState} />
          <CapabilityCopy rows={copyRows} state={outputState} />
          <span className="capA-export-note" data-testid="capA-export-order-note">导出按当前排序与搜索</span>
          <Button
            size="sm"
            outlined
            disabled
            aria-disabled="true"
            data-planned="true"
            title="控制台还没有工具写入口；接入后会提供登记与启用管理。"
            data-testid="tl3-planned-create"
          >
            新建工具
          </Button>
          <Button
            size="sm"
            outlined
            onClick={tools.reload}
            disabled={phase === "loading" || forced !== null}
            data-testid="tol5-refresh"
            prefix={phase === "loading" ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
          >
            重新读取
          </Button>
        </div>
      </div>

      {forced ? (
        <p className="min-w-0 break-words text-xs text-warning" data-testid="tol5-forced-note" title={GAP}>
          {`这是用 ?state=${forced} 复现出来的状态，不是服务此刻的回答；这里只复现状态，不展示字段示例。`}
        </p>
      ) : null}

      <p className="min-w-0 break-words text-xs text-muted-foreground" aria-live="polite" data-testid="tol5-status">
        {phase === "loading"
          ? "正在读取工具与 MCP 清单…"
          : phase === "ready"
            ? `读取成功：${toolRows.length} 条工具与工具集，${mcpRows.length} 个 MCP 连接`
            : phase === "empty"
                ? "读取成功，清单是空的"
                : "这次读取没有成功"}
      </p>

      {phase === "ready" ? (
        <CapabilitySearch value={q} total={rows.length} onChange={setQ} />
      ) : null}

      {phase === "ready" ? (
        <div className="cap8-sortbar" role="row" data-testid="cap8-sortbar">
          <span className="cap8-sortlabel">排序</span>
          {([
            ["name", "名称"],
            ["type", "类型/来源"],
            ["updated", "最近更新"],
          ] as Array<[SortKey, string]>).map(([key, label]) => (
            <span key={key} role="columnheader" aria-sort={ariaSort(sort, key)}>
              <button type="button" className="cap8-sort" data-testid={`cap8-sort-${key}`} onClick={() => onSort(key)}>
                {label}<span className="cap8-indicator" data-testid={`cap8-indicator-${key}`}>{ariaSort(sort, key) === "ascending" ? "↑" : ariaSort(sort, key) === "descending" ? "↓" : "↕"}</span>
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {phase === "ready" ? (
        <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="tol5-counts">
          工具与工具集 {toolRows.length} · MCP 连接 {mcpRows.length}
          {disabled ? ` · 停用 ${disabled}` : ""}
          {unknown ? ` · 状态待核实 ${unknown}` : ""}
        </p>
      ) : null}

      {body}
    </div>
    </section>
  );
}

export default ToolsPage;
