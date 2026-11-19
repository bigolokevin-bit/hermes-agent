/**
 * 工具与 MCP (T27) — a read-only list of the registered MCP connections.
 *
 * One real read:
 *   `GET /agent-api/api/mcp/servers`
 *
 * What is on the screen is what the answer carried, and nothing else:
 *   loading  a skeleton, not a list of zero
 *   ready    the rows the service sent, with their count against its denominator
 *   empty    the service sent an empty list, with the reason and where to go
 *   error    human wording + a copyable 请求编号 (「未提供」 when there was none) + retry
 *   denied   403 and 404 draw one identical body, no row above it, no path echoed
 *
 * A server that is unavailable, or whose state the upstream never explained,
 * stays on the list: greyed, with its reason. An unknown state reads 「—」 — it is
 * never rounded down to 不可用 and never counted as a working connection.
 * Raw ids and upstream status tokens live in `title` and 「技术详情」 only.
 */
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import { RefreshCw } from "lucide-react";

import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { Spinner } from "@nous-research/ui/ui/components/spinner";

import { themedBody } from "@/lib/utils";

import { DeniedPanel, EmptyPanel, ErrorPanel, LoadingPanel, ReproNote, TechnicalDisclosure } from "./states";
import {
  STATUS_LABEL,
  beijingMinute,
  type ServerRow,
} from "./tools";
import { forcedStateOf, useToolsData } from "./useToolsData";

/** 「—」 with the reason in its `title`, so a gap reads as a gap. */
function Dashed({ reason }: { reason: string }): ReactNode {
  return (
    <span className="min-w-0 break-words text-muted-foreground" title={reason}>
      —
    </span>
  );
}

function ServerRowCard({ row, testId }: { row: ServerRow; testId: string }): ReactNode {
  const dimmed = row.status !== "available";
  const checked = beijingMinute(row.checkedAt);
  const technical = [
    row.rawId ? `连接标识：${row.rawId}` : null,
    row.rawStatus ? `状态原值：${row.rawStatus}` : null,
    row.checkedAt ? `检查时刻原值：${row.checkedAt}` : null,
    row.rawReason ? `原因原值：${row.rawReason}` : null,
  ].filter((line): line is string => line !== null);

  return (
    <div
      className={`flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-3 last:border-b-0 ${
        dimmed ? "opacity-60" : ""
      }`}
      data-testid={testId}
      data-status={row.status}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="min-w-0 break-words text-sm" title={row.rawId ?? undefined}>
          {row.name ?? <Dashed reason="服务未提供这个连接的名称" />}
        </p>

        {row.status === "unavailable" ? (
          <p className="min-w-0 break-words text-xs text-muted-foreground">
            {row.reason ?? (
              <>
                原因未说明<Dashed reason="上游没有给出不可用的原因" />
              </>
            )}
          </p>
        ) : null}

        {row.status === "unknown" ? (
          <p className="min-w-0 break-words text-xs text-muted-foreground">
            上游没有说明这个连接现在的状态，所以这里既不写正常，也不写不可用。
          </p>
        ) : null}

        <p className="min-w-0 break-words text-xs text-muted-foreground">
          最近检查（北京时间）：
          {checked ?? <Dashed reason={row.checkedAt ? "服务给的时间读不出时刻" : "服务未提供检查时刻"} />}
        </p>

        {technical.length ? <TechnicalDisclosure lines={technical} testId={`${testId}-details`} /> : null}
      </div>

      <Badge tone={row.status === "available" ? "success" : row.status === "unavailable" ? "destructive" : "secondary"}>
        {STATUS_LABEL[row.status]}
      </Badge>
    </div>
  );
}

export function ToolsPage(): ReactNode {
  const [params] = useSearchParams();
  const forced = forcedStateOf(params.get("state"));
  const tools = useToolsData(forced);
  const { phase, rows } = tools;

  const available = rows.filter((row) => row.status === "available").length;
  const unavailable = rows.filter((row) => row.status === "unavailable").length;
  const unknown = rows.filter((row) => row.status === "unknown").length;
  /** What the answer declared, or the rows themselves when it declared nothing. */
  const denominator = tools.declaredTotal ?? rows.length;

  const countLine = (() => {
    if (phase !== "ready") return null;
    const parts = [`正常 ${available}`, `不可用 ${unavailable}`];
    if (unknown) parts.push(`状态未说明 ${unknown}`);
    const tail =
      tools.declaredTotal === null
        ? "上游未声明一共有多少连接"
        : tools.declaredTotal > rows.length
          ? `服务说共 ${tools.declaredTotal} 条，这一页只回了 ${rows.length} 条`
          : `共 ${tools.declaredTotal} 条`;
    return (
      <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="tools-counts">
        {`列出 ${rows.length} / ${denominator} 个连接（${parts.join("，")}）；${tail}。`}
        {tools.unreadable
          ? `另有 ${tools.unreadable} 条回的内容读不出是哪个连接，没有算在上面。`
          : ""}
      </p>
    );
  })();

  const body = (() => {
    if (phase === "loading") return <LoadingPanel fixture={forced === "loading" ? "loading" : undefined} />;
    if (phase === "denied") return <DeniedPanel requestId={tools.failure?.requestId ?? null} fixture={forced === "denied" ? "denied" : undefined} />;
    if (phase === "error") {
      return (
        <ErrorPanel
          failure={tools.failure ?? { sentence: "读取连接时出了问题，请稍后重试。", requestId: null, technical: null }}
          onRetry={tools.reload}
          fixture={forced === "error" ? "error" : undefined}
        />
      );
    }
    if (phase === "empty") return <EmptyPanel onRetry={tools.reload} fixture={forced === "empty" ? "empty" : undefined} />;
    return (
      <Card className="border-border bg-card" data-testid="tools-list">
        <CardContent className="p-0">
          {rows.map((row, index) => (
            <ServerRowCard key={row.key} row={row} testId={`tools-row-${index}`} />
          ))}
        </CardContent>
      </Card>
    );
  })();

  return (
    <div
      className="flex min-w-0 w-full max-w-full flex-col gap-3"
      data-testid="tools-page"
      data-page="tools"
      data-fixture={forced ?? undefined}
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h1 className={`min-w-0 break-words text-xl ${themedBody}`}>工具与 MCP</h1>
          <p className="mt-1 min-w-0 break-words text-xs text-muted-foreground">
            这里只读已登记的 MCP 连接，不新建、不改配置、不连接任何服务。
          </p>
        </div>
        <Button
          size="sm"
          outlined
          onClick={tools.reload}
          disabled={phase === "loading" || forced !== null}
          title={forced !== null ? "复现腿不发起真实请求，去掉 ?state= 即为真实读取" : undefined}
          data-testid="tools-retry"
          prefix={phase === "loading" ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
        >
          重新读取
        </Button>
      </div>

      {forced ? <ReproNote state={forced} /> : null}

      <p className="min-w-0 break-words text-xs text-muted-foreground" aria-live="polite" data-testid="tools-status">
        {phase === "loading"
          ? "正在读取连接…"
          : phase === "denied"
            ? "这一面当前看不到内容"
            : phase === "error"
              ? "这次读取没有成功"
              : phase === "empty"
                ? "读取成功，清单是空的"
                : "读取成功"}
      </p>

      {countLine}

      {body}
    </div>
  );
}

export default ToolsPage;
