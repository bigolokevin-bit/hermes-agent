/**
 * COLLAB（协作委托）— read-only delegation list on the upstream shell.
 *
 * What is on the screen is what the answer carried and nothing else:
 *   loading  a skeleton, not a list of zero
 *   ready    the delegations the service sent — 「姓名 · 8 位短码」 on both
 *            sides (「未指派」 when nobody received it), a scope sentence,
 *            a Chinese status, Beijing wall clock to the minute, a source
 *            in words; every raw value sits in `title` or 技术详情
 *   empty    the service answered and there really are none — reason, next
 *            step, and where such a request is made
 *   error    human words + a copyable 请求编号 (「未提供」 when there was
 *            none) + 重试
 *   denied   403 and 404 draw ONE identical body: no code word, no route,
 *            no row and no count line above it
 *   login    401 — the local truth with no identity: 「需要登录」, stated as
 *            a missing session rather than as a failure, with no rows
 *
 * Read-only by contract: there is no control here that writes. 接受 / 拒绝 /
 * 交接 / 完成 live on the task itself, and this page says so in words instead
 * of shipping a button that cannot do anything. The only affordances are
 * re-read and copy.
 *
 * The one request this page makes is `GET /agent-api/api/delegations` — the
 * `/api/` segment is part of the route. A `?state=` repro leg draws its state
 * from the URL, carries `data-fixture` plus the GAP number, and issues zero
 * requests: the URL alone decides what a repro shows.
 */
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { RefreshCw } from "lucide-react";

import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { Spinner } from "@nous-research/ui/ui/components/spinner";

import { themedBody } from "@/lib/utils";

import {
  DeniedPanel,
  EmptyPanel,
  ErrorPanel,
  LoadingPanel,
  LoginPanel,
  ReproNote,
  TechnicalDisclosure,
} from "./states";
import {
  GAP,
  NOT_RECORDED,
  PAGE_LIMIT,
  actorLabel,
  askedLine,
  beijingMinute,
  scopeCell,
  shortCode,
  sourceWords,
  statusWords,
  validityCell,
  type DelegationRow,
} from "./delegations";
import { forcedStateOf, useDelegations } from "./useDelegations";

/** 「—」 with the reason in its title: a gap reads as a gap, never as a zero. */
function Dashed({ reason }: { reason: string }): ReactNode {
  return (
    <span className="min-w-0 break-words text-muted-foreground" title={reason}>
      —
    </span>
  );
}

/** One person on the delegation: label on the surface, full value in `title`. */
function ActorCell({ row, side, testId }: { row: DelegationRow; side: "from" | "to"; testId: string }): ReactNode {
  const actor = side === "from" ? row.from : row.to;
  const label = actorLabel(actor, side);
  return (
    <span className="min-w-0 self-center break-words" data-testid={testId} title={label.title ?? undefined}>
      {label.text}
    </span>
  );
}

const GRID =
  "grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.9fr)]";

/** Mobile label text for the two-column stack; desktop shows a header row. */
const STACK_LABELS = ["委托方", "受托方", "范围", "状态", "生效至", "来源"] as const;

function RowCells({ row, index }: { row: DelegationRow; index: number }): ReactNode {
  const base = `col4-row-${index}`;
  const scope = scopeCell(row);
  const status = statusWords(row.status);
  const validity = validityCell(row);
  const source = sourceWords(row.source);
  const created = beijingMinute(row.createdAt);

  const technical = [
    `delegation ${row.delegationId}`,
    row.requestId ? `request ${row.requestId}` : "",
    row.taskId ? `task ${row.taskId}` : "",
    row.from.id ? `from ${row.from.id}` : "",
    row.to.id ? `to ${row.to.id}` : "",
    row.status ? `status ${row.status}` : "",
    row.source ? `source ${row.source}` : "",
    row.expiresAt ? `expires ${row.expiresAt}` : "",
    row.createdAt ? `created ${row.createdAt}` : "",
  ].filter(Boolean);

  return (
    <li className={GRID} data-testid={base} data-status={row.status ?? "unknown"}>
      <ActorCell row={row} side="from" testId={`${base}-from`} />
      <ActorCell row={row} side="to" testId={`${base}-to`} />
      <span className="min-w-0 self-center break-words" data-testid={`${base}-scope`} title={scope.reason || undefined}>
        {scope.text ? (
          <>
            <span>{scope.text}</span>
            {scope.detail ? <span className="text-muted-foreground"> · {scope.detail}</span> : null}
          </>
        ) : (
          <Dashed reason={scope.reason} />
        )}
      </span>
      <span className="min-w-0 self-center" data-testid={`${base}-status`}>
        <Badge tone={status.tone} title={status.raw ?? undefined}>
          {status.text}
        </Badge>
      </span>
      <span className="min-w-0 self-center break-words" data-testid={`${base}-validity`} title={row.expiresAt ?? validity.reason}>
        {validity.text ? (
          <span className="flex min-w-0 flex-wrap items-center gap-1">
            <span>{validity.text}</span>
            {validity.note ? (
              <Badge tone="outline" data-testid={`${base}-validity-note`}>
                {validity.note}
              </Badge>
            ) : null}
          </span>
        ) : (
          <Dashed reason={validity.reason} />
        )}
      </span>
      <span className="min-w-0 self-center break-words" data-testid={`${base}-source`} title={source.raw ?? undefined}>
        {source.text}
      </span>
      <div className="col-span-2 min-w-0 sm:col-span-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <TechnicalDisclosure lines={technical} testId={`${base}-tech`} />
          <span
            className="min-w-0 break-words text-[11px] text-muted-foreground"
            data-testid={`${base}-code`}
            title={row.delegationId}
          >
            {`委托 · ${shortCode(row.delegationId) || NOT_RECORDED}`}
          </span>
          <span className="min-w-0 break-words text-[11px] text-muted-foreground" title={row.createdAt ?? undefined}>
            {created.text ? `提出于 ${created.text}` : `提出时间${NOT_RECORDED}`}
          </span>
        </div>
      </div>
    </li>
  );
}

function ListRows({ rows }: { rows: DelegationRow[] }): ReactNode {
  return (
    <Card className="min-w-0 border-border bg-card" data-testid="col4-table">
      <CardContent className="p-0">
        <div className={`hidden ${GRID} border-b border-border px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground sm:grid`}>
          {STACK_LABELS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <ul className="divide-y divide-border">
          {rows.map((row, index) => (
            <RowCells key={row.delegationId} row={row} index={index} />
          ))}
        </ul>
        <div
          className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground"
          data-testid="col4-foot"
        >
          <span>只读清单 · 接受、拒绝、交接、完成都在任务详情里进行，本页不代为操作</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function CollabDelegationsModulePage(): ReactNode {
  const [params] = useSearchParams();
  const forced = forcedStateOf(params.get("state"));
  const data = useDelegations(forced);
  const { phase, rows, unreadable, failure, forced: isForced } = data;

  const reloadTitle = isForced ? "复现腿不发起真实请求，去掉 ?state= 即为真实读取" : "重新向服务要一次委托清单";

  const statusLine =
    phase === "loading"
      ? "正在读取协作委托…"
      : phase === "login"
        ? "需要登录后才能读取协作委托"
        : phase === "denied"
          ? "这一面当前看不到协作委托"
          : phase === "error"
            ? "这次读取没有成功"
            : phase === "empty"
              ? "读取成功，目前没有委托"
              : `读取成功，本页 ${rows.length} 条`;

  const countsKnown = phase === "ready" || phase === "empty";

  const technical = [askedLine(), !isForced && failure?.technical ? failure.technical : ""].filter(Boolean);

  return (
    <div
      className="flex min-w-0 w-full max-w-full flex-col gap-3"
      data-testid="col4-page"
      data-page="collab"
      data-fixture={forced ?? undefined}
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <nav aria-label="面包屑" className="min-w-0 break-words text-xs text-muted-foreground" data-testid="col4-breadcrumb">
            <Link to="/overview" className="underline decoration-dotted underline-offset-2 hover:text-foreground">
              控制台
            </Link>
            <span aria-hidden="true"> · </span>
            <span aria-current="page">协作委托</span>
          </nav>
          <h1 className={`mt-1 min-w-0 break-words text-xl ${themedBody}`}>协作委托</h1>
          <p className="mt-1 min-w-0 break-words text-xs text-muted-foreground">
            看谁把什么交给了谁、能做到哪、到什么时候。这一面只读：接受、拒绝、交接、完成都在任务详情里做。
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-end gap-2" role="group" aria-label="委托读取">
          <Button
            size="sm"
            outlined
            onClick={data.reload}
            disabled={phase === "loading" || isForced}
            title={reloadTitle}
            data-testid="col4-refresh"
            prefix={phase === "loading" ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
          >
            重新读取
          </Button>
        </div>
      </div>

      {forced !== null ? <ReproNote state={forced} /> : null}

      <p className="min-w-0 break-words text-xs text-muted-foreground" aria-live="polite" data-testid="col4-status">
        {statusLine}
      </p>

      <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="col4-counts">
        {countsKnown
          ? `本页 ${rows.length} 条（最多按 ${PAGE_LIMIT} 条读取，不是全量统计）`
          : "本页 — 条（暂时读不到委托数据，数字不作零处理）"}
        {unreadable > 0 && countsKnown ? `；另有 ${unreadable} 条回的内容没有可读的委托编号，没有算在上面` : ""}
      </p>

      {phase === "loading" ? <LoadingPanel fixture={forced ?? undefined} /> : null}

      {phase === "empty" ? <EmptyPanel onRetry={data.reload} filtered={false} fixture={forced ?? undefined} /> : null}

      {phase === "denied" ? (
        <DeniedPanel requestId={failure?.requestId ?? null} fixture={forced ?? undefined} />
      ) : null}

      {phase === "error" && failure ? (
        <ErrorPanel failure={failure} onRetry={data.reload} fixture={forced ?? undefined} />
      ) : null}

      {phase === "login" ? (
        <LoginPanel
          requestId={failure?.requestId ?? null}
          sentence={failure?.sentence ?? "这个清单需要登录后才能看到。"}
          onRetry={data.reload}
        />
      ) : null}

      {phase === "ready" ? <ListRows rows={rows} /> : null}

      {phase === "ready" && unreadable > 0 ? (
        <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="col4-unreadable">
          {`有 ${unreadable} 条回答没有带出可核对的委托编号，本页没有把它们画成委托。`}
        </p>
      ) : null}

      <div className="flex min-w-0 flex-col gap-1">
        <p className="max-w-prose break-words text-xs text-muted-foreground" data-testid="col4-write-note">
          {`这一页不提供接受、拒绝、交接、完成这些动作：它们属于任务本身，请在任务详情里由受托员工操作。` +
            `写入口在本控制台的接通情况尚未核实（${GAP}）。`}
        </p>
        <TechnicalDisclosure lines={technical} testId="col4-page-tech" />
      </div>
    </div>
  );
}

export default CollabDelegationsModulePage;
