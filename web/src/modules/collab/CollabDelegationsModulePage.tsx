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
 * `/api/` segment is part of the route. R32 fixture debt burn removed the
 * `?state=` repro leg: this route answered 200 on this deployment (an empty
 * tenant), so the page paints the service's own answer and nothing else.
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
  TechnicalDisclosure,
} from "./states";
import {
  GAP,
  NOT_RECORDED,
  PAGE_LIMIT,
  CHAIN_LINK_REASON,
  actionWords,
  actorLabel,
  askedLine,
  beijingMinute,
  chainGroups,
  readingStamp,
  scopeCell,
  shortCode,
  sourceWords,
  statusWords,
  validityCell,
  type DelegationRow,
} from "./delegations";
import { useDelegations } from "./useDelegations";

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
  "grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.9fr)]";

/** Mobile label text for the two-column stack; desktop shows a header row. */
const STACK_LABELS = ["委托方", "受托方", "范围", "动作", "状态", "生效 / 到期", "来源"] as const;

function RowCells({ row, index }: { row: DelegationRow; index: number }): ReactNode {
  const base = `col5-row-${index}`;
  const scope = scopeCell(row);
  const action = actionWords(row.action);
  const effective = beijingMinute(row.effectiveFrom);
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
    row.action ? `action ${row.action}` : "",
    row.effectiveFrom ? `effective ${row.effectiveFrom}` : "",
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
      <span className="min-w-0 self-center break-words" data-testid={`${base}-action`} title={action.raw ?? undefined}>
        {action.text}
      </span>
      <span className="min-w-0 self-center" data-testid={`${base}-status`}>
        <Badge tone={status.tone} title={status.raw ?? undefined}>
          {status.text}
        </Badge>
      </span>
      <span
        className="min-w-0 self-center break-words"
        data-testid={`${base}-validity`}
        title={[row.effectiveFrom, row.expiresAt].filter(Boolean).join(" → ") || validity.reason}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span data-testid={`${base}-effective`} title={effective.reason || undefined}>
            {effective.text ? `起 ${effective.text}` : <Dashed reason={effective.reason} />}
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-1" data-testid={`${base}-expiry`}>
            {validity.text ? (
              <>
                <span>{`至 ${validity.text}`}</span>
                {validity.note ? (
                  <Badge tone="outline" data-testid={`${base}-validity-note`}>
                    {validity.note}
                  </Badge>
                ) : null}
              </>
            ) : (
              <Dashed reason={validity.reason} />
            )}
          </span>
        </span>
      </span>
      <span className="min-w-0 self-center break-words" data-testid={`${base}-source`} title={source.raw ?? undefined}>
        {source.text}
      </span>
      <div className="col-span-2 min-w-0 sm:col-span-7">
        <details className="min-w-0" data-testid={`${base}-more`}>
          <summary className="cursor-pointer select-none text-[11px] text-muted-foreground underline underline-offset-2">
            展开明细
          </summary>
          <dl className="mt-1 grid min-w-0 grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
            <DetailLine label="范围" testId={`${base}-detail-scope`} title={scope.reason || undefined}>
              {scope.text ? (
                <>
                  {scope.text}
                  {scope.detail ? <span className="text-muted-foreground"> · {scope.detail}</span> : null}
                </>
              ) : (
                <Dashed reason={scope.reason} />
              )}
            </DetailLine>
            <DetailLine label="动作" testId={`${base}-detail-action`} title={action.raw ?? undefined}>
              {action.text}
            </DetailLine>
            <DetailLine label="状态" testId={`${base}-detail-status`} title={status.raw ?? undefined}>
              {status.text}
            </DetailLine>
            <DetailLine label="生效（北京时间）" testId={`${base}-detail-effective`} title={effective.reason || undefined}>
              {effective.text ? `起 ${effective.text}` : <Dashed reason={effective.reason} />}
            </DetailLine>
            <DetailLine label="到期（北京时间）" testId={`${base}-detail-expiry`} title={validity.reason || undefined}>
              {validity.text ? (
                <>
                  {`至 ${validity.text}`}
                  {validity.note ? <span className="text-muted-foreground"> · {validity.note}</span> : null}
                </>
              ) : (
                <Dashed reason={validity.reason} />
              )}
            </DetailLine>
            <DetailLine label="来源" testId={`${base}-detail-source`} title={source.raw ?? undefined}>
              {source.text}
            </DetailLine>
            <DetailLine label="提出时间（北京时间）" testId={`${base}-detail-created`} title={created.reason || undefined}>
              {created.text ?? <Dashed reason={created.reason} />}
            </DetailLine>
            <DetailLine label="委托编号" testId={`${base}-detail-code`} title={row.delegationId}>
              {shortCode(row.delegationId) || <Dashed reason="服务没有给出这条委托的编号" />}
            </DetailLine>
          </dl>
        </details>
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

function DetailLine({
  label,
  testId,
  title,
  children,
}: {
  label: string;
  testId: string;
  title?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2" data-testid={testId} title={title}>
      <dt className="shrink-0 text-[11px] text-muted-foreground">{label}</dt>
      <dd className="m-0 min-w-0 break-words">{children}</dd>
    </div>
  );
}

function ListRows({ rows }: { rows: DelegationRow[] }): ReactNode {
  return (
    <Card className="min-w-0 border-border bg-card" data-testid="col5-table">
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
          data-testid="col5-foot"
        >
          <span>只读清单 · 接受、拒绝、交接、完成都在任务详情里进行，本页不代为操作</span>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 委托链 — grouped by delegator, never a depth.
 *
 * The frozen DELEGATION v1.0 record has no parent delegation id, so the link
 * above each row is not in the answer at all. The view says 「链未接入」 with
 * that reason and groups by 委托方; it never prints a level, a root count or
 * 0, because none of those were read.
 */
function ChainView({ rows }: { rows: DelegationRow[] }): ReactNode {
  const groups = chainGroups(rows);
  return (
    <section className="flex min-w-0 flex-col gap-2" data-testid="col5-chain" data-chain="unavailable">
      <div
        className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground"
        data-testid="col5-chain-gap"
        title={CHAIN_LINK_REASON}
      >
        <Badge tone="outline">链未接入</Badge>
        <span className="min-w-0 break-words">
          服务没有给出每条委托的上一手编号，链的上游接不上；这里只按委托方分组，不推断层级、不补造上游。
        </span>
      </div>
      <ul className="flex min-w-0 flex-col gap-2">
        {groups.map((group, gIndex) => (
          <li key={group.key} className="min-w-0">
            <Card className="min-w-0 border-border bg-card" data-testid={`col5-chain-group-${gIndex}`}>
              <CardContent className="flex min-w-0 flex-col gap-2 p-3">
                <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
                  <span className="min-w-0 break-words text-sm font-medium" title={group.title ?? undefined}>
                    {`委托方 · ${group.text}`}
                  </span>
                  <span className="min-w-0 break-words text-[11px] text-muted-foreground">
                    {`本页 ${group.rows.length} 条（只数这一页，不是全量）`}
                  </span>
                </div>
                <ul className="flex min-w-0 flex-col gap-1">
                  {group.rows.map((row, rIndex) => {
                    const to = actorLabel(row.to, "to");
                    const action = actionWords(row.action);
                    const status = statusWords(row.status);
                    const at = beijingMinute(row.createdAt);
                    return (
                      <li
                        key={row.delegationId}
                        className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-1 text-xs"
                        data-testid={`col5-chain-node-${gIndex}-${rIndex}`}
                        data-status={row.status ?? "unknown"}
                      >
                        <span className="min-w-0 break-words" data-testid={`col5-chain-node-${gIndex}-${rIndex}-to`} title={to.title ?? undefined}>
                          {`→ 受托方 · ${to.text}`}
                        </span>
                        <span className="min-w-0 break-words" data-testid={`col5-chain-node-${gIndex}-${rIndex}-action`} title={action.raw ?? undefined}>
                          {action.text}
                        </span>
                        <Badge tone={status.tone} title={status.raw ?? undefined}>
                          {status.text}
                        </Badge>
                        <span className="min-w-0 break-words text-muted-foreground" data-testid={`col5-chain-node-${gIndex}-${rIndex}-at`} title={row.createdAt ?? undefined}>
                          {at.text ? at.text : `提出时间${NOT_RECORDED}`}
                        </span>
                        <span className="min-w-0 break-words text-[11px] text-muted-foreground" title={row.delegationId}>
                          {`委托 · ${shortCode(row.delegationId) || NOT_RECORDED}`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CollabDelegationsModulePage(): ReactNode {
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "chain" ? "chain" : "list";
  // The view lives in the URL so a refresh or a shared link keeps the pane the
  // reader was on. `replace` keeps the back button on the page they came from.
  const setView = (next: "list" | "chain"): void => {
    const search = new URLSearchParams(params);
    if (next === "chain") search.set("view", "chain");
    else search.delete("view");
    setParams(search, { replace: true });
  };
  const data = useDelegations();
  const { phase, rows, unreadable, failure } = data;

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
  const stamp = readingStamp(data.asOf);

  const technical = [askedLine(), failure?.technical ?? ""].filter(Boolean);

  return (
    <div
      className="flex min-w-0 w-full max-w-full flex-col gap-3"
      data-testid="col5-page"
      data-page="collab"
      data-view={view}
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <nav aria-label="面包屑" className="min-w-0 break-words text-xs text-muted-foreground" data-testid="col5-breadcrumb">
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
          <div className="flex min-w-0 flex-wrap items-center gap-1" role="group" aria-label="视图">
            <Button
              size="sm"
              outlined={view !== "list"}
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              title="按一条一条的委托看"
              data-testid="col5-view-list"
            >
              清单
            </Button>
            <Button
              size="sm"
              outlined={view !== "chain"}
              onClick={() => setView("chain")}
              aria-pressed={view === "chain"}
              title="按委托方分组看这条链；上游编号服务没有给出，链未接入"
              data-testid="col5-view-chain"
            >
              委托链
            </Button>
          </div>
          <Button
            size="sm"
            outlined
            onClick={data.reload}
            disabled={phase === "loading"}
            title="重新向服务要一次委托清单"
            data-testid="col5-refresh"
            prefix={phase === "loading" ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
          >
            重新读取
          </Button>
        </div>
      </div>

      <p className="min-w-0 break-words text-xs text-muted-foreground" aria-live="polite" data-testid="col5-status">
        {statusLine}
      </p>

      <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="col5-counts">
        {countsKnown
          ? `本页 ${rows.length} 条（最多按 ${PAGE_LIMIT} 条读取，不是全量统计）`
          : "本页 — 条（暂时读不到委托数据，数字不作零处理）"}
        {unreadable > 0 && countsKnown ? `；另有 ${unreadable} 条回的内容没有可读的委托编号，没有算在上面` : ""}
      </p>

      <p
        className="min-w-0 break-words text-xs text-muted-foreground"
        data-testid="col5-asof"
        title={stamp ? "这个时间是服务在回答里给出的读取时刻" : "服务的回答没有带读取时刻，本页不用浏览器时间代替"}
      >
        {`读取于 ${stamp ?? "—"}`}
      </p>

      {phase === "loading" ? <LoadingPanel /> : null}

      {phase === "empty" ? <EmptyPanel onRetry={data.reload} filtered={false} /> : null}

      {phase === "denied" ? <DeniedPanel requestId={failure?.requestId ?? null} /> : null}

      {phase === "error" && failure ? <ErrorPanel failure={failure} onRetry={data.reload} /> : null}

      {phase === "login" ? (
        <LoginPanel
          requestId={failure?.requestId ?? null}
          sentence={failure?.sentence ?? "这个清单需要登录后才能看到。"}
          onRetry={data.reload}
        />
      ) : null}

      {phase === "ready" && view === "chain" ? <ChainView rows={rows} /> : null}
      {phase === "ready" && view === "list" ? <ListRows rows={rows} /> : null}

      {phase === "ready" && unreadable > 0 ? (
        <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="col5-unreadable">
          {`有 ${unreadable} 条回答没有带出可核对的委托编号，本页没有把它们画成委托。`}
        </p>
      ) : null}

      <div className="flex min-w-0 flex-col gap-1">
        <p className="max-w-prose break-words text-xs text-muted-foreground" data-testid="col5-write-note">
          {`这一页是只读的，不提供接受、拒绝、交接、完成这些动作：它们属于任务本身，请在任务详情里由受托员工操作。` +
            `写入口在本控制台的接通情况尚未核实（${GAP}）。`}
        </p>
        <TechnicalDisclosure lines={technical} testId="col5-page-tech" />
      </div>
    </div>
  );
}

export default CollabDelegationsModulePage;
