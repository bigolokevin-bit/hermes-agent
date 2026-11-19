/**
 * 平台接入 / 数据源 (T29 + T24) — a read-only view of which platforms and channels
 * are wired, and which data sources this console can actually read.
 *
 * What is on the screen is what the answers carried, and nothing else:
 *   loading  a skeleton, not a list of zero
 *   ready    the platforms the service sent, plus the 数据源 ledger for this read
 *   empty    the service sent an empty list, with the reason and where to go
 *   error    human wording + a copyable 请求编号 (「未提供」 when there was none) + retry
 *   denied   403 and 404 draw one identical body, no row above it, no path echoed
 *
 * A platform that is down, or whose state the upstream never explained, stays
 * on the list: greyed, with its reason, and its badge reads 未接入 or 未知 —
 * never 正常 and never a green 「已接入」. `enabled: true` is not read as
 * connected anywhere in this module, because a switched-on but broken platform
 * is not a working one. Raw ids, upstream state tokens and HTTP statuses live
 * in `title` attributes and the collapsed 「技术详情」, not in the sentence layer;
 * an id that has to appear at all appears as 「连接 · 后4位」.
 *
 * The 数据源 ledger is the T24 half: one row per data source this page asked,
 * saying what that ask returned. Where the endpoint does not exist, the row
 * carries the GAP number instead of a status it cannot prove. Its acceptance
 * ids are the `ds4-*` family (`ds4-ledger`, `ds4-row`, `ds4-status`, `ds4-gap`
 * — no 申请入口 exists on this read-only surface, so no `ds4-request`); every
 * `chn4-*` id on the same elements stays exactly as it was.
 *
 * Read-only by design: no enable, no test-connection, no save, no delete.
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
  FILTERS,
  GAP,
  STATUS_LABEL,
  applyFilter,
  beijingMinute,
  filterOf,
  type ChannelRow,
  type LedgerRow,
  type RowStatus,
} from "./channels";
import { forcedStateOf, useChannelsData } from "./useChannelsData";

/** 「—」 with the reason in its `title`, so a gap reads as a gap and not as a zero. */
function Dashed({ reason }: { reason: string }): ReactNode {
  return (
    <span className="min-w-0 break-words text-muted-foreground" title={reason}>
      —
    </span>
  );
}

/**
 * The only badge vocabulary this page has. Never a word that means 「健康」.
 * `marker` is the stable `ds4-*` id the acceptance harness queries; it sits on
 * a layout-invisible `contents` wrapper so the badge keeps its own `chn4-*`
 * testid untouched. Only the ledger passes one.
 */
function StatusBadge({ status, testId, marker }: { status: RowStatus; testId: string; marker?: string }): ReactNode {
  const tone = status === "available" ? "success" : status === "unavailable" ? "destructive" : "secondary";
  const badge = (
    <Badge tone={tone} data-testid={testId}>
      {STATUS_LABEL[status]}
    </Badge>
  );
  if (!marker) return badge;
  return (
    <span className="contents" data-testid={marker}>
      {badge}
    </span>
  );
}

function technicalLines(row: ChannelRow): string[] {
  return [
    row.rawId ? `标识原值：${row.rawId}` : null,
    row.rawState ? `状态原值：${row.rawState}` : null,
    row.rawType ? `类型原值：${row.rawType}` : null,
    row.rawReason ? `原因原值：${row.rawReason}` : null,
    row.lastSeen ? `最近可见原值：${row.lastSeen}` : null,
  ].filter((line): line is string => line !== null);
}

function ChannelRowCard({ row, testId }: { row: ChannelRow; testId: string }): ReactNode {
  const dimmed = row.status !== "available";
  const seen = beijingMinute(row.lastSeen);
  const technical = technicalLines(row);

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
          {row.name ?? <span className="min-w-0 break-words">{row.masked ?? "名称未提供"}</span>}
        </p>

        <p className="min-w-0 break-words text-xs text-muted-foreground">
          类型：{row.kindLabel}
        </p>

        {row.status === "unavailable" ? (
          <p className="min-w-0 break-words text-xs text-muted-foreground">
            {row.reason ?? (
              <>
                原因未说明<Dashed reason="上游没有解释这个平台为什么不可用" />
              </>
            )}
          </p>
        ) : null}

        {row.status === "unknown" ? (
          <p className="min-w-0 break-words text-xs text-muted-foreground">
            {row.reason ?? "上游没有说明这个平台现在的状态，所以这里既不写已接入，也不写未接入。"}
          </p>
        ) : null}

        <p className="min-w-0 break-words text-xs text-muted-foreground">
          最近可见（北京时间）：
          {seen.text ?? <Dashed reason={seen.reason} />}
        </p>

        {technical.length ? <TechnicalDisclosure lines={technical} testId={`${testId}-details`} /> : null}
      </div>

      <StatusBadge status={row.status} testId={`${testId}-badge`} />
    </div>
  );
}

function LedgerRowCard({ row, testId }: { row: LedgerRow; testId: string }): ReactNode {
  const dimmed = row.status !== "available";
  const seen = beijingMinute(row.checkedAt);
  const technical = [
    row.rawPath ? `读取地址：${row.rawPath}` : null,
    row.rawDetail ? `详情原值：${row.rawDetail}` : null,
    row.gap ? `缺口编号：${row.gap}` : null,
  ].filter((line): line is string => line !== null);

  return (
    <div
      className={`flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-3 last:border-b-0 ${
        dimmed ? "opacity-60" : ""
      }`}
      data-testid={testId}
      data-status={row.status}
      data-gap={row.gap ?? undefined}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1" data-testid="ds4-row">
        <p className="min-w-0 break-words text-sm">{row.label}</p>
        <p className="min-w-0 break-words text-xs text-muted-foreground">{row.reason}</p>
        {row.gap ? (
          <p className="min-w-0 break-words text-xs text-muted-foreground" title={row.rawPath ?? undefined} data-testid="ds4-gap">
            {`缺口编号 ${row.gap}`}
          </p>
        ) : null}
        <p className="min-w-0 break-words text-xs text-muted-foreground">
          本次核验（北京时间）：
          {seen.text ?? <Dashed reason={seen.reason} />}
        </p>
        {technical.length ? <TechnicalDisclosure lines={technical} testId={`${testId}-details`} /> : null}
      </div>
      <StatusBadge status={row.status} testId={`${testId}-badge`} marker="ds4-status" />
    </div>
  );
}

function SourcesLedger({ ledger }: { ledger: LedgerRow[] }): ReactNode {
  if (!ledger.length) return null;
  return (
    <Card className="min-w-0 border-border bg-card" data-testid="chn4-sources">
      <CardContent className="min-w-0 p-0" data-testid="ds4-ledger">
        <div className="flex min-w-0 flex-col gap-1 border-b border-border px-4 py-3">
          <p className={`min-w-0 break-words text-sm ${themedBody}`}>数据源</p>
          <p className="min-w-0 break-words text-xs text-muted-foreground">
            这一轮读取里，每个数据源各自回答了什么。没接通的那几行留在这里，写明原因与缺口编号，不记成零个。
          </p>
        </div>
        {ledger.map((row, index) => (
          <LedgerRowCard key={row.key} row={row} testId={`chn4-source-${index}`} />
        ))}
      </CardContent>
    </Card>
  );
}

export function ChannelsPage(): ReactNode {
  const [params, setParams] = useSearchParams();
  const forced = forcedStateOf(params.get("state"));
  const filter = filterOf(params.get("status"));
  const data = useChannelsData(forced, filter);
  const { phase, rows, ledger } = data;
  const shown = applyFilter(rows, filter);

  const isForced = forced !== null;
  const forcedTitle = isForced ? "复现腿不发起真实请求，去掉 ?state= 即为真实读取" : undefined;

  const availableCount = shown.filter((row) => row.status === "available").length;
  const downCount = shown.filter((row) => row.status === "unavailable").length;
  const unknownCount = shown.filter((row) => row.status === "unknown").length;
  /** Every denominator the answers declared; null means the upstream said nothing. */
  const declared = data.declaredTotals.reduce<number | null>(
    (sum, item) => (item.declared === null ? sum : sum === null ? item.declared : sum + item.declared),
    null,
  );

  const countLine =
    phase === "ready" ? (
      <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="chn4-counts">
        {`列出 ${shown.length} 个渠道或平台（已接入 ${availableCount}，未接入 ${downCount}，状态未说明 ${unknownCount}）`}
        {declared === null
          ? "；上游未声明一共有多少条"
          : declared > rows.length
            ? `；服务说共 ${declared} 条，这一轮只回了 ${rows.length} 条`
            : `；服务说共 ${declared} 条`}
        {filter === "all" ? "。" : "；已按所选状态筛选。"}
        {data.unreadable ? `另有 ${data.unreadable} 条回的内容读不出是哪个平台，没有算在上面。` : ""}
      </p>
    ) : null;

  const filterBar = (
    <div className="flex min-w-0 flex-wrap items-end gap-2" role="group" aria-label="平台接入筛选" data-testid="chn4-filters">
      <label className="flex min-w-0 flex-col gap-1 text-xs" htmlFor="chn4-filter-status">
        <span className="text-muted-foreground">接入状态</span>
        <select
          id="chn4-filter-status"
          data-testid="chn4-filter-status"
          className="h-8 min-w-0 max-w-40 rounded-md border border-border bg-transparent px-2 text-sm"
          value={filter}
          disabled={isForced}
          title={isForced ? forcedTitle : "换这个条件会重新向服务要一次数据"}
          onChange={(event) => {
            const next = new URLSearchParams(params);
            if (event.target.value === "all") next.delete("status");
            else next.set("status", event.target.value);
            setParams(next, { replace: true });
          }}
        >
          {FILTERS.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <Button
        size="sm"
        outlined
        onClick={data.reload}
        disabled={phase === "loading" || isForced}
        title={forcedTitle}
        data-testid="chn4-retry"
        prefix={phase === "loading" ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
      >
        重新读取
      </Button>
    </div>
  );

  const body = (() => {
    if (phase === "loading") return <LoadingPanel fixture={forced === "loading" ? "loading" : undefined} />;
    // Denied and error are the two states where nothing else may be painted:
    // the platform rows are not there, and neither are the source rows, because
    // a pane that could not read anything has nothing honest to say per source.
    if (phase === "denied") {
      return <DeniedPanel requestId={data.failure?.requestId ?? null} fixture={forced === "denied" ? "denied" : undefined} />;
    }
    if (phase === "error") {
      return (
        <ErrorPanel
          failure={data.failure ?? { sentence: "读取接入清单时出了问题，请稍后重试。", requestId: null, technical: null }}
          onRetry={data.reload}
          fixture={forced === "error" ? "error" : undefined}
        />
      );
    }
    if (phase === "empty") {
      return (
        <div className="flex min-w-0 flex-col gap-3">
          <EmptyPanel onRetry={data.reload} fixture={forced === "empty" ? "empty" : undefined} />
          <SourcesLedger ledger={ledger} />
        </div>
      );
    }
    return (
      <div className="min-w-0 flex flex-col gap-3">
        {shown.length ? (
          <Card className="min-w-0 border-border bg-card" data-testid="chn4-list">
            <CardContent className="p-0">
              {shown.map((row, index) => (
                <ChannelRowCard key={row.key} row={row} testId={`chn4-row-${index}`} />
              ))}
            </CardContent>
          </Card>
        ) : (
          // The list is not empty — the CHOICE emptied it. Said as that, with
          // the way back, so a filter never reads like a missing integration.
          <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="chn4-filter-empty">
            {`按「${FILTERS.find((item) => item.key === filter)?.label ?? ""}」这一轮没有条目可列；` +
              `服务其实回了 ${rows.length} 条，把上面的条件改回「全部」就能看到。`}
          </p>
        )}

        <SourcesLedger ledger={ledger} />
      </div>
    );
  })();

  return (
    <div
      className="flex min-w-0 w-full max-w-full flex-col gap-3"
      data-testid="chn4-page"
      data-page="channels"
      data-fixture={forced ?? undefined}
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h1 className={`min-w-0 break-words text-xl ${themedBody}`}>平台接入与数据源</h1>
          <p className="mt-1 min-w-0 break-words text-xs text-muted-foreground">
            这里只读平台、渠道与数据源的接入情况，不启用、不测试、不保存任何配置。
          </p>
        </div>
        {filterBar}
      </div>

      {isForced ? <ReproNote state={forced} /> : null}

      <p className="min-w-0 break-words text-xs text-muted-foreground" aria-live="polite" data-testid="chn4-status">
        {phase === "loading"
          ? "正在读取平台接入与数据源…"
          : phase === "denied"
            ? "这一面当前看不到内容"
            : phase === "error"
              ? "这次读取没有成功"
              : phase === "empty"
                ? "读取成功，清单是空的"
                : "读取成功"}
      </p>

      {phase === "ready" ? (
        <p
          className="min-w-0 break-words text-xs text-muted-foreground"
          title={`条件会写进请求：${GAP}，本控制台尚未接通这些读取`}
        >
          {`接入状态这个筛选是把这一轮已经读到的条目再挑一遍，选它的时候也会把条件一并告诉服务；` +
            `服务是不是按条件返回的，还没有核实过。`}
        </p>
      ) : null}

      {countLine}

      {body}
    </div>
  );
}

export default ChannelsPage;
