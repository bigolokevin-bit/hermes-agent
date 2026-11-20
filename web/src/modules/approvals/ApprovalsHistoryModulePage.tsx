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
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { History, RefreshCw } from "lucide-react";

import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { Spinner } from "@nous-research/ui/ui/components/spinner";

import { STATUS_FILTERS, approvalSortKeyOf, approvalsRowSearchText, isKnownStatus, sortApprovalRows, type ApprovalSortDir, type ApprovalSortKey } from "./model";
import { actionGates, announcement } from "./gates";
import { QueueSummaryBar } from "./QueueSummaryBar";
import { BackToList, restoreListScroll, saveListScroll } from "./BackToList";
import { QueueCsvExport } from "./QueueCsvExport";
import { QueueSortBar } from "./QueueSortBar";
import { ActorBuckets } from "./ActorBuckets";
import { SinceQuickFilter, isSinceValue, withinSince } from "./SinceQuickFilter";
import { RiskQuickFilter, isRiskValue, withinRisk, type RiskValue } from "./RiskQuickFilter";
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

/** R44: the shareable queue shortcuts travel as real server-side status
 * values through the same URL mechanism as the eight-state group. */
const QUEUE_SHORTCUTS: readonly { value: string; label: string; sends: string | null }[] = [
  { value: "status-all", label: "全部", sends: null },
  { value: "status-pending", label: "待办", sends: "pending" },
  { value: "status-approved", label: "已批", sends: "approved" },
  { value: "status-rejected", label: "已拒", sends: "rejected" },
];

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
  // R71: 列排序=本地能力（读口忽略 sort/order/orderBy/dir，实测同序同集合），
  // asort/adir 落 URL 且不动 tab/status/q；缺值恒排末。
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
  // R77: ?since= rides the same local-filter contract (read port ignores
  // since=/window=, measured 四组同集合). The comparison instant is captured
  // in state once per entry — never in the URL, never during render.
  const rawSince = params.get("since");
  const since = isSinceValue(rawSince) ? rawSince : null;
  const [sinceNow, setSinceNow] = useState<number | null>(null);
  useEffect(() => {
    if (since) setSinceNow(Date.now());
  }, [since]);
  const pickSince = useCallback(
    (value: string | null) => {
      const draft = new URLSearchParams(params);
      if (value === null) draft.delete("since");
      else draft.set("since", value);
      setParams(draft, { replace: true });
      if (value !== null) setSinceNow(Date.now());
    },
    [params, setParams],
  );
  // R83: ?risk= 是本地风险档维（读口丢参实测复证）；七参互不清除、粘链复现。
  const rawRisk = params.get("risk");
  const risk = isRiskValue(rawRisk) ? rawRisk : null;
  const pickRisk = useCallback(
    (value: RiskValue | null) => {
      const draft = new URLSearchParams(params);
      if (value === null) draft.delete("risk");
      else draft.set("risk", value);
      setParams(draft, { replace: true });
    },
    [params, setParams],
  );
  // R77: 计数/导出/分桶与列表同源——共同基底=q+时间窗过滤后的已加载行；
  // actor 维不锁分桶轨（否则选中一位后无法切到另一位）。
  const actorBaseRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? list.rows.filter((row) => approvalsRowSearchText(row).includes(needle))
      : list.rows;
    return since && sinceNow !== null
      ? filtered.filter((row) => withinSince(row.submittedAt, since, sinceNow))
      : filtered;
  }, [list.rows, q, since, sinceNow]);
  // R83: 风险档过滤与 actor 同级；分桶轨基线含 risk 不含 actor。
  const riskBaseRows = useMemo(
    () => (risk ? actorBaseRows.filter((row) => withinRisk(row, risk)) : actorBaseRows),
    [actorBaseRows, risk],
  );
  const visibleRows = useMemo(() => {
    const byActor = actor ? riskBaseRows.filter((row) => row.approverIds.includes(actor)) : riskBaseRows;
    return sortApprovalRows(byActor, asort, adir);
  }, [riskBaseRows, actor, asort, adir]);
  const [selected, setSelected] = useState<string | null>(() => params.get("id"));
  const [unaddressable, setUnaddressable] = useState(false);
  // R60: at most one row shows its inline preview; it never touches URL/filters.
  const [previewKey, setPreviewKey] = useState<string | null>(null);


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

  // R70: 空态「有筛选」分支的清空出口——一次写回，status 与 q 同删，
  // 其余参数不动。
  const clearFilters = useCallback(() => {
    const draft = new URLSearchParams(params);
    draft.delete("status");
    draft.delete("q");
    setSelected(null);
    setUnaddressable(false);
    setParams(draft, { replace: true });
  }, [params, setParams]);

  const openRow = useCallback(
    (row: { rawId: string | null }) => {
      // R55: remember where the list was, so 返回列表 can put us back there.
      // R60: 打开详情与行内预览互斥，收起所有预览。
      setPreviewKey(null);
      saveListScroll("approvals-history-scroll");
      setUnaddressable(row.rawId === null);
      setSelected(row.rawId);
      // R17 apd5 item 1: the selection lives in the URL too, so a refresh or
      // a shared link reopens the same detail.
      const draft = new URLSearchParams(params);
      if (row.rawId) draft.set("id", row.rawId);
      else draft.delete("id");
      setParams(draft, { replace: true });
    },
    [params, setParams],
  );

  const backToList = useCallback(() => {
    setSelected(null);
    setUnaddressable(false);
    const draft = new URLSearchParams(params);
    draft.delete("id");
    setParams(draft, { replace: true });
    restoreListScroll("approvals-history-scroll");
  }, [params, setParams]);

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
          title="这条记录没能加载出来"
          testId="apr5-detail-error"
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

  // R79: 聚合（全部状态）=扇出取齐无统一游标，到底原因要分开说。
  const singleAgg = status === null;  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-3" data-testid="apr5-page-history">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        {/* R86: 播报单点=下方 sr-only apv-live；这行只是屏上读数，不再自带
            aria-live（同一变化只播一次）。 */}
        <p className="sr-only" role="status" aria-live="polite" data-testid="apv-live">
          {announcement(list.phase, visibleRows.length)}
        </p>
        <p className="min-w-0 break-words text-xs text-muted-foreground">
          {list.phase === "loading"
            ? `正在按「${summary}」读取历史决策…`
            : list.phase === "empty"
              ? `「${summary}」没有记录`
              : list.phase === "denied"
                ? "审批历史暂不可用"
                : list.phase === "error"
                  ? "审批历史读取失败"
                  : q
                    ? `已显示 ${visibleRows.length} / ${list.rows.length} 条「${summary}」记录（关键字过滤中）`
                    : `已显示 ${list.rows.length} 条「${summary}」记录${list.next ? "，下面还有更多" : ""}`}
        </p>
        {list.phase === "ready" ? (
          <span className="font-mono text-xs text-muted-foreground" data-testid="apv5-count" title={q ? "计数与下方列表同源（关键字过滤后）" : "计数与下方列表同源：同一份服务端返回的行数"}>
            {visibleRows.length}
          </span>
        ) : null}
        {list.phase !== "denied" ? (
          <Button
            size="sm"
            outlined
            onClick={list.reload}
            data-testid="apv-gates-refresh"
            title={actionGates(list.phase, list.rows.length).retry.title}
            aria-disabled={!actionGates(list.phase, list.rows.length).retry.enabled}
            disabled={!actionGates(list.phase, list.rows.length).retry.enabled}
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

      <QueueSummaryBar phase={list.phase} rows={visibleRows} scope="history" singleStatus={status} />
      <QueueCsvExport rows={visibleRows} tab="history" status={status} phase={list.phase} sort={asort} dir={asort ? adir : null} />
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
        title="实测：本页读口带 q/keyword/title 任一参数都与不带时返回同一全量（同集合），后台不做关键字过滤；为避免「假服务端搜索」，这里只做前端本地过滤。"
      >
        仅在当前已加载 {list.rows.length} 条内搜索；关键字是前端本地过滤，不产生新请求（实测后台 q/keyword/title 参数被忽略）。
      </p>

      <QueueSortBar phase={list.phase} sort={asort} dir={adir} loadedCount={list.rows.length} onCycle={cycleSort} />
      <ActorBuckets rows={riskBaseRows} phase={list.phase} actor={actor} onPick={pickActor} />
      <SinceQuickFilter phase={list.phase} since={since} loadedCount={list.rows.length} onPick={pickSince} />
      <RiskQuickFilter rows={actorBaseRows} phase={list.phase} risk={risk} onPick={pickRisk} />


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

      {/* R44: risk and time-window axes are stated, not faked. The BFF
        * whitelist (status, limit, cursor) drops risk/window/since — live
        * probe measured the same set with and without them — so no client
        * side filtering happens here. */}
      <div className="flex min-w-0 flex-wrap items-center gap-1.5" role="group" aria-label="队列筛选（可分享）" data-testid="apv5-filter">
        {QUEUE_SHORTCUTS.map((choice) => {
          const active = choice.sends === null ? activeValue === "all" : activeValue === choice.sends;
          return (
            <Button
              key={choice.value}
              size="xs"
              outlined
              invert={active}
              aria-pressed={active}
              onClick={() => choose(choice.sends)}
              data-testid={`apv5-filter-${choice.value}`}
            >
              {choice.label}
            </Button>
          );
        })}
        <select
          aria-label="按时间窗筛选"
          data-testid="apv5-filter-window"
          disabled
          title="后台尚未开放时间窗筛选：带 window=24h/since=… 实测与不带参同集合，为避免假过滤此项暂不提供。"
          className="rounded-md border border-white/15 bg-transparent px-2 py-1 text-xs text-muted-foreground opacity-60"
        >
          <option value="">时间窗：暂不可筛</option>
        </select>
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

      <div
        className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]"
        data-testid="apv-state"
        data-phase={list.phase}
      >
        <section className="flex min-w-0 flex-col gap-2" data-testid="apr5-list" data-apv-nav="true" aria-label="历史决策列表">
          {list.phase === "loading" ? <LoadingPanel /> : null}

          {list.phase === "denied" ? <DeniedPanel failure={list.failure} /> : null}

          {list.phase === "error" && list.failure ? (
            <ErrorPanel failure={list.failure} onRetry={list.reload} retryTestId="apr5-retry" />
          ) : null}

          {list.phase === "empty" ? (
            <EmptyPanel
              reason={`该条件下无审批：「${summary}」结果下没有记录`}
              nextStep="换一个结果看看，或点「全部」把所有历史决策列出来。"
              onRefresh={list.reload}
              testId="apr5-empty-history"
              clear={status !== null ? { label: "清空筛选", onClear: clearFilters } : undefined}
            />
          ) : null}

          {list.phase === "ready" ? (
            <>
              {risk && visibleRows.length === 0 ? (
                <Card className="border-border bg-card" data-testid="apv-risk-empty">
                  <CardContent className="min-w-0 space-y-2 p-4 text-sm">
                    <p>该风险档下没有审批。</p>
                    <p className="text-xs text-muted-foreground">
                      这是当前已加载 {list.rows.length} 条里的真实结果：没有命中该风险档的行（严重风险没有独立档位，在「全部」下照常显示）；可只清空风险档，其余筛选保留。
                    </p>
                    <Button size="sm" outlined data-testid="apv-risk-clear" onClick={() => pickRisk(null)}>
                      清空风险档
                    </Button>
                  </CardContent>
                </Card>
              ) : null}
              {!risk && since && visibleRows.length === 0 ? (
                <Card className="border-border bg-card" data-testid="apv-since-empty">
                  <CardContent className="min-w-0 space-y-2 p-4 text-sm">
                    <p>该时间范围内没有审批。</p>
                    <p className="text-xs text-muted-foreground">
                      这是当前已加载 {list.rows.length} 条里的真实结果：没有提交时间落在该时间窗内的行（缺提交时间的行不属于任何窗口）；可放宽范围或清空时间筛选。
                    </p>
                    <Button size="sm" outlined data-testid="apv-since-clear" onClick={() => pickSince(null)}>
                      清空时间范围
                    </Button>
                  </CardContent>
                </Card>
              ) : null}
              {!risk && !since && actor && visibleRows.length === 0 ? (
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
              {q && !actor && !since && !risk && visibleRows.length === 0 ? (
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

              <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs" data-testid="apv-page">
                <Button
                  size="sm"
                  outlined
                  data-testid="apv-page-more"
                  disabled={!list.next || list.loadingMore}
                  onClick={list.loadMore}
                  title={
                    list.next
                      ? "带服务端游标续取下一页（追加时按单号去重，重复行不上屏）。"
                      : singleAgg
                        ? "聚合视图按状态扇出取齐，没有续页游标：已到末页。切到单一状态可按游标续取。"
                        : "服务端没有给出下一页游标：已到末页。"
                  }
                  prefix={list.loadingMore ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                >
                  {list.loadingMore ? "加载中…" : "加载更多"}
                </Button>
                <span
                  data-testid="apv-page-count"
                  title={
                    list.total === null
                      ? "读口响应顶层只有 items/nextCursor（无 total 键，实测本页响应）；按已加载条数推算会撒谎，故不推算。"
                      : "总数来自读口 total 键；已显示=当前已加载行数"
                  }
                >
                  {list.total !== null
                    ? `共 ${list.total} 条 / 已显示 ${list.rows.length} 条`
                    : `总数不可用 · 已显示 ${list.rows.length} 条`}
                </span>
                {!list.next && list.rows.length > 0 ? (
                  <span className="text-muted-foreground" data-testid="apv-page-end">
                    已到末页
                  </span>
                ) : null}
              </div>
            </>
          ) : null}
        </section>

        <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:self-start" aria-label="记录详情">
          {selected ? <BackToList onBack={backToList} /> : null}
          {drawer}
        </aside>
      </div>
    </div>
  );
}

export default ApprovalsHistoryModulePage;
