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
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
import { approvalSortKeyOf, approvalsRowSearchText, sortApprovalRows, type ApprovalSortDir, type ApprovalSortKey } from "./model";
import { DeniedPanel, EmptyPanel, ErrorPanel, InlineFailure, LoadingPanel } from "./states";
import { useApprovalDetail, useApprovalsList, type ForcedState } from "./useApprovalsData";
import { actionGates } from "./gates";
import { QueueSummaryBar } from "./QueueSummaryBar";
import { BackToList, restoreListScroll, saveListScroll } from "./BackToList";
import { QueueCsvExport } from "./QueueCsvExport";
import { QueueSortBar } from "./QueueSortBar";
import { ActorBuckets } from "./ActorBuckets";
import { ApprovalDetailBody, ApprovalRowCard } from "./views";

const VERDICT_LABEL: Record<Verdict, string> = { approve: "批准", reject: "驳回" };

const FORCED_STATES: readonly string[] = ["loading", "empty", "error", "denied"];

function forcedStateOf(raw: string | null): ForcedState {
  return raw !== null && FORCED_STATES.includes(raw) ? (raw as ForcedState) : null;
}

export function ApprovalsPendingModulePage(): ReactNode {
  const [params, setParams] = useSearchParams();
  const forced = forcedStateOf(params.get("state"));

  const [selected, setSelected] = useState<string | null>(() => params.get("id"));
  // R60: at most one row shows its inline preview; it never touches URL/filters.
  const [previewKey, setPreviewKey] = useState<string | null>(null);


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

  // R59: keyword search is a local filter over the loaded rows (the read
  // port ignores q/keyword/title — measured), so typing never fetches.
  const q = params.get("q") ?? "";
  const setQ = useCallback(
    (value: string) => {
      const draft = new URLSearchParams(params);
      if (value) draft.set("q", value);
      else draft.delete("q");
      setParams(draft, { replace: true });
    },
    [params, setParams],
  );
  // R71: 同 history——本地列排序 + URL 复现，缺值恒排末。
  const asort = approvalSortKeyOf(params.get("asort"));
  const adir: ApprovalSortDir = params.get("adir") === "desc" ? "desc" : "asc";
  const cycleSort = useCallback(
    (key: ApprovalSortKey) => {
      const draft = new URLSearchParams(params);
      if (asort !== key) {
        draft.set("asort", key);
        draft.set("adir", "asc");
      } else if (adir === "asc") {
        draft.set("adir", "desc");
      } else {
        draft.delete("asort");
        draft.delete("adir");
      }
      setParams(draft, { replace: true });
    },
    [params, setParams, asort, adir],
  );
  // R74: ?actor= rides the URL like the other filters; picking a bucket never
  // refetches — the filter runs over the already-loaded rows (read port
  // ignores actor=, measured).
  const actor = params.get("actor");
  const pickActor = useCallback(
    (id: string | null) => {
      const draft = new URLSearchParams(params);
      if (id === null) draft.delete("actor");
      else draft.set("actor", id);
      setParams(draft, { replace: true });
    },
    [params, setParams],
  );
  const visibleRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? list.rows.filter((row) => approvalsRowSearchText(row).includes(needle))
      : list.rows;
    const byActor = actor ? filtered.filter((row) => row.approverIds.includes(actor)) : filtered;
    return sortApprovalRows(byActor, asort, adir);
  }, [list.rows, q, actor, asort, adir]);

  const openRow = useCallback(
    (row: ApprovalRow) => {
      // R60: 打开详情与行内预览互斥，收起所有预览。
      setPreviewKey(null);
      setRefused(null);
      setComment("");
      setConfirming(null);
      // R55: stash the list scroll so 返回列表 restores it.
      saveListScroll("approvals-pending-scroll");
      setUnaddressable(row.rawId === null);
      setSelected(row.rawId);
      // R17 apd5 item 1: selection lives in the URL, so refresh keeps it open.
      const draft = new URLSearchParams(params);
      if (row.rawId) draft.set("id", row.rawId);
      else draft.delete("id");
      setParams(draft, { replace: true });
    },
    [params, setParams],
  );

  // R73: roving tabindex — 焦点锚只活在本地，方向键/排序/筛选变化都不发请求。
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null);

  const navigateRows = useCallback(
    (action: "ArrowUp" | "ArrowDown" | "Home" | "End", fromKey: string) => {
      const keys = visibleRows.map((r) => r.key);
      if (keys.length === 0) return;
      // 锚=事件所在行（state 可能还没提交这一帧的 onFocus），再退回页级锚。
      const cur = keys.includes(fromKey) ? fromKey : activeRowKey;
      const i = cur ? keys.indexOf(cur) : -1;
      const next =
        i < 0
          ? 0
          : action === "ArrowDown"
            ? Math.min(i + 1, keys.length - 1)
            : action === "ArrowUp"
              ? Math.max(i - 1, 0)
              : action === "Home"
                ? 0
                : keys.length - 1;
      const k = keys[next];
      setActiveRowKey(k);
      (document.querySelector(`[data-testid="apr5-row-${k}"]`) as HTMLElement | null)?.focus();
    },
    [visibleRows, activeRowKey],
  );

  const closePreviewAndRefocus = useCallback(
    (key: string) => {
      setPreviewKey((current) => (current === key ? null : current));
      (document.querySelector(`[data-testid="apr5-row-${key}"]`) as HTMLElement | null)?.focus();
    },
    [],
  );

  // R73: 排序/筛选/搜索导致首行变化后，焦点锚回退到第一行。
  const firstRowKey = visibleRows.length > 0 ? visibleRows[0].key : null;
  useEffect(() => {
    setActiveRowKey(null);
  }, [firstRowKey]);

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

  const backToList = useCallback(() => {
    setSelected(null);
    setUnaddressable(false);
    const draft = new URLSearchParams(params);
    draft.delete("id");
    setParams(draft, { replace: true });
    restoreListScroll("approvals-pending-scroll");
  }, [params, setParams]);

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
            <p className="text-sm text-muted-foreground">还没有选中申请</p>
            <p className="max-w-prose break-words text-xs text-muted-foreground">
              在队列里点开一张申请，这里会显示它的完整内容，并能直接给出结论。
            </p>
          </CardContent>
        </Card>
      );
    }
    if (detail.phase === "loading") {
      return <LoadingPanel testId="apr5-detail-loading" />;
    }
    if (detail.phase === "denied") {
      return <DeniedPanel failure={detail.failure} />;
    }
    if (detail.phase === "error" || !detail.detail) {
      return (
        <ErrorPanel
          failure={detail.failure ?? { sentence: "详情没能加载出来。", requestId: null, technical: null }}
          onRetry={detail.reload}
          title="这张申请没能加载出来"
          testId="apr5-detail-error"
        />
      );
    }
    const actions = detail.detail.status.pending ? (
      <div className="flex min-w-0 flex-col gap-2 border-t border-border pt-3" data-testid="apr5-actions">
        {refused ? (
          <InlineFailure
            failure={refused}
            action="决定没有提交"
            onRetry={detail.reload}
            retryLabel="重新读取这张单"
          />
        ) : null}
        <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground" htmlFor="apr5-comment">
          备注（可选，会和决定一起记给申请人）
          <Input
            id="apr5-comment"
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
    <div className="flex min-w-0 w-full max-w-full flex-col gap-3" data-testid="apr5-page-pending">
      <QueueSummaryBar phase={list.phase} rows={visibleRows} scope="queue" />
      <QueueCsvExport rows={visibleRows} tab="pending" status="pending" phase={list.phase} sort={asort} dir={asort ? adir : null} />
      <div className="flex min-w-0 flex-wrap items-center gap-1.5" role="group" data-testid="apv8-search-group" aria-label="搜索审批">
        <input
          type="search"
          aria-label="搜索审批"
          data-testid="apv8-search"
          className="min-w-0 flex-1 rounded-sm border border-border bg-transparent px-2 py-1 text-xs"
          placeholder="关键字（标题/理由/编号）"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q ? (
          <Button size="sm" outlined data-testid="apv8-search-clear" onClick={() => setQ("")}>
            清空搜索
          </Button>
        ) : null}
      </div>
      <p
        className="min-w-0 break-words text-xs text-muted-foreground"
        data-testid="apv8-scope-note"
        title="实测：GET /api/approvals 带 q/keyword/title 任一参数都返回同一全量（200，8 条同集合），后台不做关键字过滤；为避免「假服务端搜索」，这里只做前端本地过滤。"
      >
        仅在当前已加载 {list.rows.length} 条内搜索；关键字是前端本地过滤，不产生新请求（实测后台 q/keyword/title 参数被忽略）。
      </p>

      <QueueSortBar phase={list.phase} sort={asort} dir={adir} loadedCount={list.rows.length} onCycle={cycleSort} />
      <ActorBuckets rows={list.rows} phase={list.phase} actor={actor} onPick={pickActor} />


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
                  : q
                    ? `已显示 ${visibleRows.length} / ${list.rows.length} 条申请，其中 ${visibleRows.filter((row) => row.status.pending).length} 条待处理（关键字过滤中）`
                    : `已显示 ${list.rows.length} 条申请，其中 ${pendingCount} 条待处理${list.next ? "，下面还有更多" : ""}`}
        </p>
        {list.phase !== "denied" ? (
          <Button
            size="sm"
            outlined
            onClick={list.reload}
            data-testid="apv-gates-refresh"
            title={actionGates(list.phase, list.rows.length).retry.title}
            disabled={!actionGates(list.phase, list.rows.length).retry.enabled || inFlight}
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
        <p className="min-w-0 break-words text-xs text-warning" data-testid="apr5-forced-note">
          这是用 ?state= 复现出来的状态，不是服务此刻的回答。
        </p>
      ) : null}

      <div
        className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]"
        data-testid="apv-state"
        data-phase={list.phase}
      >
        <section className="flex min-w-0 flex-col gap-2" data-testid="apr5-list" data-apv-nav="true" aria-label="待处理审批队列">
          {list.phase === "loading" ? <LoadingPanel /> : null}

          {list.phase === "denied" ? <DeniedPanel failure={list.failure} /> : null}

          {list.phase === "error" && list.failure ? (
            <ErrorPanel failure={list.failure} onRetry={list.reload} retryTestId="apr5-retry" />
          ) : null}

          {list.phase === "empty" ? (
            <EmptyPanel
              reason="现在没有需要你处理的申请"
              nextStep="员工遇到需要你点头的操作时会提出申请，提出后立刻出现在这里。"
              onRefresh={list.reload}
            />
          ) : null}

          {list.phase === "ready" ? (
            <>
              {actor && visibleRows.length === 0 ? (
                <Card className="border-border bg-card" data-testid="apv-actor-empty">
                  <CardContent className="min-w-0 space-y-2 p-4 text-sm">
                    <p>该审批人下没有审批。</p>
                    <p className="text-xs text-muted-foreground">
                      这是当前已加载 {list.rows.length} 条里的真实结果：没有该审批人名下的行；可清空审批人筛选或换条件。
                    </p>
                    <Button size="sm" outlined data-testid="apv-actor-clear" onClick={() => pickActor(null)}>
                      清空审批人筛选
                    </Button>
                  </CardContent>
                </Card>
              ) : null}
              {q && !actor && visibleRows.length === 0 ? (
                <Card className="border-border bg-card" data-testid="apv8-search-empty">
                  <CardContent className="min-w-0 space-y-2 p-4 text-sm">
                    <p>没有匹配的审批。</p>
                    <p className="text-xs text-muted-foreground">
                      这是前端本地过滤的真实结果：当前已加载 {list.rows.length} 条里没有包含「{q.trim()}」的行；可清空搜索或换服务器筛选条件。
                    </p>
                    <Button size="sm" outlined onClick={() => setQ("")}>
                      清空搜索
                    </Button>
                  </CardContent>
                </Card>
              ) : null}
              {visibleRows.map((row) => (
                <ApprovalRowCard
                  key={row.key}
                  row={row}
                  selected={row.rawId !== null && row.rawId === selected}
                  onOpen={() => openRow(row)}
                  previewOpen={previewKey === row.key}
                  onTogglePreview={() =>
                    setPreviewKey((current) => (current === row.key ? null : row.key))
                  }
                  active={(activeRowKey ?? (visibleRows.length > 0 ? visibleRows[0].key : null)) === row.key}
                  onActivate={() => setActiveRowKey(row.key)}
                  onNavKey={navigateRows}
                  onClosePreview={() => closePreviewAndRefocus(row.key)}
                />
              ))}

              {list.unreadable > 0 ? (
                <p className="min-w-0 break-words text-xs text-warning">
                  {q
                    ? `另有 ${list.unreadable} 条缺少可显示内容的记录，不参与关键字搜索。`
                    : `有 ${list.unreadable} / ${list.rows.length + list.unreadable} 条记录缺少可显示的内容，未列在上面。`}
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
          {selected ? <BackToList onBack={backToList} /> : null}
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
