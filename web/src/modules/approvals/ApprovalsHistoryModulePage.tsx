/**
 * T17 — approvals 历史决策 pane (lane console-approvals).
 *
 * The same list endpoint the queue uses, read through the eight states the
 * approval domain answers with: pending / approved / rejected /
 * revise_requested / expired / cancelled / consumed / superseded.
 *
 * The filter is not decoration: the chosen value goes into the request as
 * `GET /agent-api/api/approvals?status=<value>&limit=50[&cursor=]`, so which
 * rows appear is decided by the service, and a state with no history really
 * does come back empty. 「全部」 drops the parameter.
 *
 * A `?status=` value we do not recognise is kept verbatim in the request and
 * named as-is in the 「详情」 disclosure — it is never renamed into a state we
 * did not get, and it never silently disappears.
 *
 * History is a projection of the same records, so it stays read-only here:
 * a decision belongs to 待处理, where the ticket is still open.
 */
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { History, RefreshCw } from "lucide-react";

import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { Spinner } from "@nous-research/ui/ui/components/spinner";

import { STATUS_FILTERS, isKnownStatus } from "./model";
import { DeniedPanel, EmptyPanel, ErrorPanel, InlineFailure, LoadingPanel } from "./states";
import { useApprovalDetail, useApprovalsList, type ForcedState } from "./useApprovalsData";
import { ApprovalDetailBody, ApprovalRowCard } from "./views";

const FORCED_STATES: readonly string[] = ["loading", "empty", "error", "denied"];

function forcedStateOf(raw: string | null): ForcedState {
  return raw !== null && FORCED_STATES.includes(raw) ? (raw as ForcedState) : null;
}

/** Wire value ↔ human label, plus 「全部」 which sends no status at all. */
const CHOICES: readonly { value: string; label: string; sends: string | null }[] = [
  { value: "all", label: "全部", sends: null },
  ...STATUS_FILTERS.map((filter) => ({ value: filter.value, label: filter.label, sends: filter.value })),
];

const ALL_RAW = "全部状态";

export function ApprovalsHistoryModulePage(): ReactNode {
  const [params, setParams] = useSearchParams();
  const forced = forcedStateOf(params.get("state"));

  // The URL owns the filter, so a chosen state survives a refresh and a shared
  // link opens the same list. An unknown value is kept exactly as it arrived.
  const rawStatus = params.get("status");
  const status = rawStatus === "" ? null : rawStatus;
  const known = status === null || isKnownStatus(status);
  const activeValue = status === null ? "all" : status;

  const list = useApprovalsList(status, forced);
  const [selected, setSelected] = useState<string | null>(null);
  const [unaddressable, setUnaddressable] = useState(false);
  const detail = useApprovalDetail(selected, forced);

  const choose = useCallback(
    (next: string | null) => {
      setSelected(null);
      setUnaddressable(false);
      const draft = new URLSearchParams(params);
      if (next === null) draft.delete("status");
      else draft.set("status", next);
      draft.delete("id");
      setParams(draft, { replace: true });
    },
    [params, setParams],
  );

  const openRow = useCallback((row: { rawId: string | null }) => {
    setUnaddressable(row.rawId === null);
    setSelected(row.rawId);
  }, []);

  const summary = useMemo(() => {
    if (status === null) return ALL_RAW;
    return isKnownStatus(status) ? STATUS_FILTERS.find((f) => f.value === status)!.label : `「${status}」`;
  }, [status]);

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
          testId="apr5-detail-unaddressable"
        />
      );
    }
    if (!selected) {
      return (
        <Card className="border-border bg-card" data-testid="apr5-detail-empty">
          <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-10 text-center">
            <History className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">还没有选中记录</p>
            <p className="max-w-prose break-words text-xs text-muted-foreground">
              点开一条记录可以看到它当时的结论。要给结论，请去「待处理」里那张还没处理的单。
            </p>
          </CardContent>
        </Card>
      );
    }
    if (detail.phase === "loading") {
      return <LoadingPanel testId="apr5-detail-loading" fixture={detail.forced ? "loading" : undefined} />;
    }
    if (detail.phase === "denied") {
      return <DeniedPanel failure={detail.failure} fixture={detail.forced ? "denied" : undefined} />;
    }
    if (detail.phase === "error" || !detail.detail) {
      return (
        <ErrorPanel
          failure={detail.failure ?? { sentence: "详情没能加载出来。", requestId: null, technical: null }}
          onRetry={detail.reload}
          title="这条记录没能加载出来"
          testId="apr5-detail-error"
          fixture={detail.forced ? "error" : undefined}
        />
      );
    }
    return (
      <ApprovalDetailBody
        detail={detail.detail}
        testId="apr5-detail"
        actions={
          <p className="min-w-0 break-words border-t border-border pt-3 text-xs text-muted-foreground">
            历史决策只用于回看。这张单的处理已经结束，这里不再改动结论。
          </p>
        }
      />
    );
  })();

  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-3" data-testid="apr5-page-history">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-words text-xs text-muted-foreground" aria-live="polite">
          {list.phase === "loading"
            ? `正在按「${summary}」读取历史决策…`
            : list.phase === "empty"
              ? `「${summary}」没有记录`
              : list.phase === "denied"
                ? "审批历史暂不可用"
                : list.phase === "error"
                  ? "审批历史读取失败"
                  : `已显示 ${list.rows.length} 条「${summary}」记录${list.next ? "，下面还有更多" : ""}`}
        </p>
        {list.phase !== "denied" ? (
          <Button
            size="sm"
            outlined
            onClick={list.reload}
            disabled={list.phase === "loading"}
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

      <div className="flex min-w-0 flex-wrap gap-1.5" role="group" data-testid="apr5-filter" aria-label="按处理结果筛选">
        {CHOICES.map((choice) => {
          const active = choice.value === activeValue;
          return (
            <Button
              key={choice.value}
              size="xs"
              outlined
              invert={active}
              aria-pressed={active}
              onClick={() => choose(choice.sends)}
              data-testid={`apr5-filter-${choice.value}`}
            >
              {choice.label}
            </Button>
          );
        })}
      </div>

      {!known ? (
        <p className="min-w-0 break-words text-xs text-warning" data-testid="apr5-filter-unknown">
          这个筛选值不在已知的八种结果里，系统仍按原样去读；读到的内容可能与服务端的状态说法不一致。
        </p>
      ) : null}

      {list.forced ? (
        <p className="min-w-0 break-words text-xs text-warning" data-testid="apr5-forced-note">
          这是用 ?state= 复现出来的状态，不是服务此刻的回答。
        </p>
      ) : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <section className="flex min-w-0 flex-col gap-2" data-testid="apr5-list" aria-label="历史决策列表">
          {list.phase === "loading" ? <LoadingPanel fixture={list.forced ? "loading" : undefined} /> : null}

          {list.phase === "denied" ? <DeniedPanel failure={list.failure} fixture={list.forced ? "denied" : undefined} /> : null}

          {list.phase === "error" && list.failure ? (
            <ErrorPanel failure={list.failure} onRetry={list.reload} retryTestId="apr5-retry" fixture={list.forced ? "error" : undefined} />
          ) : null}

          {list.phase === "empty" ? (
            <EmptyPanel
              reason={`「${summary}」状态下没有记录`}
              nextStep="换一个结果看看，或点「全部」把所有历史决策列出来。"
              onRefresh={list.reload}
              testId="apr5-empty-history"
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
                <p className="text-xs text-muted-foreground">这个状态下就这些了。</p>
              ) : null}
            </>
          ) : null}
        </section>

        <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:self-start" aria-label="记录详情">
          {drawer}
        </aside>
      </div>
    </div>
  );
}

export default ApprovalsHistoryModulePage;
