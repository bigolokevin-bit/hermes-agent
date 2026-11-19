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
import { useState, type ReactNode } from "react";
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
import { forcedStateOf, useToolsData } from "./useToolsData";
import "./tools.css";

function Dashed({ reason }: { reason: string }): ReactNode {
  return (
    <span className="min-w-0 break-words text-muted-foreground" title={reason}>
      —
    </span>
  );
}

function RequestId({ failure }: { failure: FailureCopy | null }): ReactNode {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const id = failure?.requestId ?? null;
  if (!id) {
    return (
      <span className="min-w-0 break-words text-xs text-muted-foreground" data-testid="tol5-request-id" title={requestIdLine(null)}>
        请求编号：未提供
      </span>
    );
  }
  return (
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
  );
}

function Row({ row }: { row: ToolRow }): ReactNode {
  const dimmed = row.status !== "enabled";
  return (
    <div
      className={`flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3 last:border-b-0 ${dimmed ? "opacity-60" : ""}`}
      data-testid="tol5-row"
      data-status={row.status}
      data-source={row.source}
      title={row.rawId ?? undefined}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="min-w-0 break-words text-sm" data-testid="tol5-name">{row.name}</p>
        <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="tol5-type">{row.type}</p>
        <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="tol5-last">
          最近调用：{row.lastUsed ?? <Dashed reason={row.lastUsedReason ?? "接口没有提供最近调用时间。"} />}
          {row.lastUsed === null ? <span className="ml-1">{row.lastUsedReason}</span> : null}
        </p>
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1">
        <span className="min-w-0 text-xs text-muted-foreground" data-testid="tol5-credential">
          凭据：{CREDENTIAL_LABEL[row.credential]}
          {row.credentialReason ? <span className="ml-1">{row.credentialReason}</span> : null}
        </span>
        <Badge
          tone={row.status === "enabled" ? "success" : row.status === "disabled" ? "destructive" : "secondary"}
          title={row.statusReason ?? undefined}
        >
          <span data-testid="tol5-status">{STATUS_LABEL[row.status]}</span>
        </Badge>
      </div>
    </div>
  );
}

function FailurePanel({
  kind,
  failure,
  onRetry,
  fixture,
}: {
  kind: "error" | "denied" | "login";
  failure: FailureCopy | null;
  onRetry: () => void;
  fixture?: string;
}): ReactNode {
  const denied = kind === "denied";
  const login = kind === "login";
  return (
    <Card
      role="alert"
      className={denied ? "border-border bg-card" : "border-destructive/40 bg-destructive/5"}
      data-testid={denied ? "tol5-denied" : login ? "tol5-login" : "tol5-error"}
      data-fixture={fixture}
      title={failure?.technical ?? undefined}
    >
      <CardContent className="flex min-w-0 flex-col items-start gap-2 px-4 py-6">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          {denied ? <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden /> : <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />}
          <span className="min-w-0 break-words">
            {denied ? "暂时看不到工具与 MCP 清单" : login ? "需要重新登录" : "工具与 MCP 清单没能加载出来"}
          </span>
        </div>
        <p className="max-w-prose break-words text-xs text-muted-foreground">
          {denied
            ? "这块内容要么尚未对你开放，要么当前环境还没有提供它；这里不显示猜测的行，也不把没读到的东西写成零。"
            : login
              ? "登录状态已经失效，请刷新页面重新登录后再看这份清单。"
              : failure?.sentence ?? "读取工具与 MCP 清单时出了问题，请稍后重试。"}
        </p>
        <RequestId failure={failure} />
        <Button size="sm" outlined onClick={onRetry} prefix={<RefreshCw className="h-3.5 w-3.5" />} data-testid="tol5-retry">
          重试
        </Button>
      </CardContent>
    </Card>
  );
}

export function ToolsPage(): ReactNode {
  const [params] = useSearchParams();
  const forced = forcedStateOf(params.get("state"));
  const tools = useToolsData(forced);
  const { phase, rows } = tools;
  const disabled = rows.filter((row) => row.status === "disabled").length;
  const unknown = rows.filter((row) => row.status === "unknown").length;
  const toolRows = rows.filter((row) => row.source === "toolset");
  const mcpRows = rows.filter((row) => row.source === "mcp");
  const fixtureMark = forced ?? (tools.fixture ? "fixture" : undefined);

  const body = (() => {
    if (phase === "loading") {
      return (
        <div className="flex min-w-0 flex-col gap-2" data-testid="tol5-loading" aria-busy="true" data-fixture={forced ?? undefined}>
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="animate-pulse rounded-md border border-border bg-card px-4 py-4" aria-hidden="true">
              <div className="h-3 w-1/3 rounded-sm bg-muted" />
              <div className="mt-3 h-2.5 w-2/3 rounded-sm bg-muted/70" />
            </div>
          ))}
        </div>
      );
    }
    if (phase === "denied") return <FailurePanel kind="denied" failure={tools.failure} onRetry={tools.reload} fixture={forced ?? undefined} />;
    if (phase === "login") return <FailurePanel kind="login" failure={tools.failure} onRetry={tools.reload} fixture={forced ?? undefined} />;
    if (phase === "error") return <FailurePanel kind="error" failure={tools.failure} onRetry={tools.reload} fixture={forced ?? undefined} />;
    if (phase === "empty") {
      return (
        <Card className="border-border bg-card" data-testid="tol5-empty" data-fixture={forced ?? undefined}>
          <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-10 text-center">
            <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden />
            <p className={`min-w-0 break-words text-sm ${themedBody}`}>服务已响应，清单里没有工具或 MCP 连接</p>
            <p className="max-w-prose break-words text-xs text-muted-foreground">
              这不是加载失败，也不显示样例；在原生工具与 MCP 管理页登记后回到这里重新读取。
            </p>
            <Button size="sm" outlined onClick={tools.reload} prefix={<RefreshCw className="h-3.5 w-3.5" />} data-testid="tol5-retry">
              重新读取
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="flex min-w-0 flex-col gap-3">
        {tools.fixture ? (
          <p
            className="min-w-0 break-words rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs"
            data-testid="tol5-fixture-note"
            title={GAP}
          >
            当前是接口未接入时的字段示例，不是真实连接；接入后这里会被真实读取替换。
          </p>
        ) : null}

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
            {toolRows.length ? toolRows.map((row) => <Row row={row} key={row.key} />) : (
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
            {mcpRows.length ? mcpRows.map((row) => <Row row={row} key={row.key} />) : (
              <p className="px-4 py-4 text-xs text-muted-foreground" data-testid="tol5-mcp-empty">
                服务已响应，没有登记 MCP 连接；这不是加载失败。
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  })();

  return (
    <div
      className="tol5-page flex min-w-0 w-full max-w-full flex-col gap-3"
      data-testid="tol5-page"
      data-page="tools"
      data-fixture={fixtureMark}
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h1 className={`min-w-0 break-words text-xl ${themedBody}`}>工具与 MCP</h1>
          <p className="mt-1 min-w-0 break-words text-xs text-muted-foreground">
            只读工具目录与已登记的 MCP 连接；不新建、不改配置、不连接任何服务，也不显示任何凭据值。
          </p>
        </div>
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

      {forced ? (
        <p className="min-w-0 break-words text-xs text-warning" data-testid="tol5-forced-note" title={GAP}>
          {`这是用 ?state=${forced} 复现出来的状态，不是服务此刻的回答；数据源未接入时只展示标记过的字段示例。`}
        </p>
      ) : null}

      <p className="min-w-0 break-words text-xs text-muted-foreground" aria-live="polite" data-testid="tol5-status">
        {phase === "loading"
          ? "正在读取工具与 MCP 清单…"
          : phase === "ready"
            ? `读取成功：${toolRows.length} 条工具与工具集，${mcpRows.length} 个 MCP 连接`
            : phase === "fixture"
              ? "接口未接入：当前展示字段示例"
              : phase === "empty"
                ? "读取成功，清单是空的"
                : "这次读取没有成功"}
      </p>

      {phase === "ready" || phase === "fixture" ? (
        <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="tol5-counts">
          工具与工具集 {toolRows.length} · MCP 连接 {mcpRows.length}
          {disabled ? ` · 停用 ${disabled}` : ""}
          {unknown ? ` · 状态待核实 ${unknown}` : ""}
        </p>
      ) : null}

      {body}
    </div>
  );
}

export default ToolsPage;
