/**
 * T16 — approvals 待处理 pane (lane console-approvals).
 *
 * Queue: `GET /agent-api/api/approvals?status=pending&limit=50` (plus
 * `&cursor=` for later pages). Ticket: `GET /agent-api/api/approval?id=`.
 * A decision is the BFF's single write route,
 * `POST /agent-api/api/approval/decision?id=`, with `{verdict, comment?}` and
 * the anti-forgery header it asks for. The paths come from
 * web/src/shell/routes.ts row 7 and
 * docs/_artifacts/D/T02-ENDPOINT-RECONCILIATION.md — nothing here is mocked.
 *
 * There is no optimistic success: after a decision both the queue and the
 * ticket are re-read, so what the screen says is what the service said.
 *
 * 1440px and up: queue + drawer side by side. Narrower (375px included) the
 * drawer stacks under the queue and nothing scrolls sideways.
 */
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { RefreshCw } from "lucide-react";

import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { Input } from "@nous-research/ui/ui/components/input";
import { Spinner } from "@nous-research/ui/ui/components/spinner";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { failureInfo, isWriteUnavailable, postDecision, type Verdict } from "./api";
import { writeFailure, type FailureCopy } from "./copy";
import type { ApprovalRow } from "./model";
import { DeniedPanel, EmptyPanel, ErrorPanel, InlineFailure, LoadingPanel } from "./states";
import { useApprovalDetail, useApprovalsList, type ForcedState } from "./useApprovalsData";
import { ApprovalDetailBody, ApprovalRowCard } from "./views";

const VERDICT_LABEL: Record<Verdict, string> = { approve: "批准", reject: "驳回" };

const FORCED_STATES: readonly string[] = ["loading", "empty", "error", "denied"];

function forcedStateOf(raw: string | null): ForcedState {
  return raw !== null && FORCED_STATES.includes(raw) ? (raw as ForcedState) : null;
}

export function ApprovalsPendingModulePage(): ReactNode {
  const [params] = useSearchParams();
  const forced = forcedStateOf(params.get("state"));

  const [selected, setSelected] = useState<string | null>(() => params.get("id"));
  // A row that carries no id can be listed but never opened; saying so beats
  // guessing an identifier for it.
  const [unaddressable, setUnaddressable] = useState(false);
  const [comment, setComment] = useState("");
  const [confirming, setConfirming] = useState<Verdict | null>(null);
  const [inFlight, setInFlight] = useState(false);
  const [refused, setRefused] = useState<FailureCopy | null>(null);

  const list = useApprovalsList("pending", forced);
  const detail = useApprovalDetail(selected, forced);

  const pendingCount = useMemo(() => list.rows.filter((row) => row.status.pending).length, [list.rows]);

  const openRow = useCallback((row: ApprovalRow) => {
    setRefused(null);
    setComment("");
    setConfirming(null);
    setUnaddressable(row.rawId === null);
    setSelected(row.rawId);
  }, []);

  const send = useCallback(
    async (verdict: Verdict) => {
      if (!selected) return;
      setInFlight(true);
      setRefused(null);
      try {
        await postDecision(selected, verdict, comment);
        setConfirming(null);
        setComment("");
        list.reload();
        detail.reload();
      } catch (err) {
        const info = failureInfo(err);
        setConfirming(null);
        setRefused(writeFailure(err, verdict, info));
        // 409/404 mean the ticket moved without us: re-read it rather than keep
        // a body on screen that the service no longer agrees with.
        if (info.status === 409 || info.status === 404 || isWriteUnavailable(info.status)) {
          detail.reload();
        }
      } finally {
        setInFlight(false);
      }
    },
    [comment, detail, list, selected],
  );

  const drawer = (() => {
    if (unaddressable) {
      return (
        <InlineFailure
          failure={{
            sentence: "这条记录没有给出可打开的单据标识，详情读不到。请刷新列表后再试。",
            requestId: null,
            technical: null,
          }}
          action="详情没有打开"
          onRetry={list.reload}
          retryLabel="刷新列表"
          testId="approval-detail-unaddressable"
        />
      );
    }
    if (!selected) {
      return (
        <Card className="border-border bg-card" data-testid="approval-detail-empty">
          <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">还没有选中申请</p>
            <p className="max-w-prose break-words text-xs text-muted-foreground">
              在队列里点开一张申请，这里会显示它的完整内容，并能直接给出结论。
            </p>
          </CardContent>
        </Card>
      );
    }
    if (detail.phase === "loading") {
      return <LoadingPanel testId="approval-detail-loading" fixture={detail.forced ? "loading" : undefined} />;
    }
    if (detail.phase === "denied") {
      return <DeniedPanel failure={detail.failure} fixture={detail.forced ? "denied" : undefined} />;
    }
    if (detail.phase === "error" || !detail.detail) {
      return (
        <ErrorPanel
          failure={detail.failure ?? { sentence: "详情没能加载出来。", requestId: null, technical: null }}
          onRetry={detail.reload}
          title="这张申请没能加载出来"
          testId="approval-detail-error"
          fixture={detail.forced ? "error" : undefined}
        />
      );
    }
    const actions = detail.detail.status.pending ? (
      <div className="flex min-w-0 flex-col gap-2 border-t border-border pt-3" data-testid="approval-actions">
        {refused ? (
          <InlineFailure
            failure={refused}
            action="决定没有提交"
            onRetry={detail.reload}
            retryLabel="重新读取这张单"
          />
        ) : null}
        <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground" htmlFor="approval-comment">
          备注（可选，会和决定一起记给申请人）
          <Input
            id="approval-comment"
            value={comment}
            placeholder="写一句理由"
            disabled={inFlight}
            onChange={(event) => setComment(event.target.value)}
          />
        </label>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setConfirming("approve")} disabled={inFlight}>
            批准
          </Button>
          <Button size="sm" destructive onClick={() => setConfirming("reject")} disabled={inFlight}>
            驳回
          </Button>
          {inFlight ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Spinner className="h-3.5 w-3.5" />
              正在提交…
            </span>
          ) : null}
        </div>
      </div>
    ) : (
      <p className="min-w-0 break-words border-t border-border pt-3 text-xs text-muted-foreground">
        这张单已经是「{detail.detail.status.label}」，不能再在这里改结论。需要重新处理时，请让员工重新提交一张。
      </p>
    );
    return <ApprovalDetailBody detail={detail.detail} actions={actions} />;
  })();

  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-3" data-testid="approvals-pending">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-words text-xs text-muted-foreground" aria-live="polite">
          {list.phase === "loading"
            ? "正在读取待处理审批…"
            : list.phase === "empty"
              ? "共 0 条待处理审批"
              : list.phase === "denied"
                ? "审批申请暂不可用"
                : list.phase === "error"
                  ? "审批申请读取失败"
                  : `已显示 ${list.rows.length} 条申请，其中 ${pendingCount} 条待处理${list.next ? "，下面还有更多" : ""}`}
        </p>
        {list.phase !== "denied" ? (
          <Button
            size="sm"
            outlined
            onClick={list.reload}
            disabled={list.phase === "loading" || inFlight}
            prefix={
              list.phase === "loading" ? (
                <Spinner className="h-3.5 w-3.5" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )
            }
          >
            刷新
          </Button>
        ) : null}
      </div>

      {list.forced ? (
        <p className="min-w-0 break-words text-xs text-warning" data-testid="approvals-forced-note">
          这是用 ?state= 复现出来的状态，不是服务此刻的回答。
        </p>
      ) : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <section className="flex min-w-0 flex-col gap-2" aria-label="待处理审批队列">
          {list.phase === "loading" ? <LoadingPanel fixture={list.forced ? "loading" : undefined} /> : null}

          {list.phase === "denied" ? <DeniedPanel failure={list.failure} fixture={list.forced ? "denied" : undefined} /> : null}

          {list.phase === "error" && list.failure ? (
            <ErrorPanel failure={list.failure} onRetry={list.reload} fixture={list.forced ? "error" : undefined} />
          ) : null}

          {list.phase === "empty" ? (
            <EmptyPanel
              reason="现在没有需要你处理的申请"
              nextStep="员工遇到需要你点头的操作时会提出申请，提出后立刻出现在这里。"
              onRefresh={list.reload}
              fixture={list.forced ? "empty" : undefined}
            />
          ) : null}

          {list.phase === "ready" ? (
            <>
              {list.rows.map((row) => (
                <ApprovalRowCard
                  key={row.key}
                  row={row}
                  selected={row.rawId !== null && row.rawId === selected}
                  onOpen={() => openRow(row)}
                />
              ))}

              {list.unreadable > 0 ? (
                <p className="min-w-0 break-words text-xs text-warning">
                  有 {list.unreadable} / {list.rows.length + list.unreadable} 条记录缺少可显示的内容，未列在上面。
                </p>
              ) : null}

              {list.pageFailure ? <InlineFailure failure={list.pageFailure} action="后续记录没有加载成功" onRetry={list.loadMore} /> : null}

              {list.next ? (
                <div>
                  <Button
                    size="sm"
                    outlined
                    disabled={list.loadingMore}
                    onClick={list.loadMore}
                    prefix={list.loadingMore ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  >
                    加载更多
                  </Button>
                </div>
              ) : list.rows.length > 0 ? (
                <p className="text-xs text-muted-foreground">没有更多待处理审批了。</p>
              ) : null}

              {pendingCount === 0 ? (
                <p className="min-w-0 break-words text-xs text-muted-foreground">
                  这些单都已经处理过，新的申请出现时会回到这里。
                </p>
              ) : null}
            </>
          ) : null}
        </section>

        <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:self-start" aria-label="申请详情">
          {drawer}
        </aside>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title={confirming ? `确认${VERDICT_LABEL[confirming]}？` : "确认决定？"}
        description={
          confirming
            ? `确认后这张申请会记为你的${VERDICT_LABEL[confirming]}，并通知申请人。已经处理过的单不会被覆盖。`
            : undefined
        }
        confirmLabel={confirming ? VERDICT_LABEL[confirming] : "确认"}
        cancelLabel="取消"
        destructive={confirming === "reject"}
        loading={inFlight}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          const verdict = confirming;
          if (verdict) void send(verdict);
        }}
      />
    </div>
  );
}

export default ApprovalsPendingModulePage;
