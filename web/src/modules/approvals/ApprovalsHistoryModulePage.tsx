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
import { ChevronDown, ChevronUp, RefreshCw, Search } from "lucide-react";

import { Button } from "@nous-research/ui/ui/components/button";
import { Spinner } from "@nous-research/ui/ui/components/spinner";

import { STATUS_FILTERS, approvalSortKeyOf, approvalsRowSearchText, isKnownStatus, sortApprovalRows, type ApprovalSortDir, type ApprovalSortKey } from "./model";
import { actionGates, announcement, crossPageLoadHint } from "./gates";
import { QueueSummaryBar, denominatorReadout } from "./QueueSummaryBar";
import { clearFilterParams, hasActiveFilters, resetTitle } from "./FilterReset";
import { FilterSummary } from "./FilterSummary";
import { PermalinkCopy } from "./PermalinkCopy";
import { RowDetailCopy } from "./RowDetailCopy";
import { dropCorrelationReturn, peekCorrelationReturn } from "./correlationReturn";
import { BackToList, restoreListScroll, saveListScroll } from "./BackToList";
import { QueueCsvExport } from "./QueueCsvExport";
import { QueueSortBar } from "./QueueSortBar";
import { ActorBuckets } from "./ActorBuckets";
import { SinceQuickFilter, isSinceValue, withinSince } from "./SinceQuickFilter";
import { RiskQuickFilter, isRiskValue, withinRisk, type RiskValue } from "./RiskQuickFilter";
import { DeniedPanel, ErrorPanel, InlineFailure, LoadingPanel } from "./states";
import { APPROVAL_EMPTY_SENTENCE } from "./stateCopy";
import { useApprovalDetail, useApprovalsList, type ForcedState } from "./useApprovalsData";
import { ApprovalDetailBody } from "./views";
import { ApprovalLedgerRow } from "./ApprovalLedgerRow";
import { LedgerEmpty } from "./LedgerEmpty";
import { ConsoleCard } from "@/components/console/ConsoleCard";
import { ConsoleSelect } from "@/shell/ConsoleSelect";
import "./approvals-density.css";

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
  // 2026-11-24 密度车道：骨架 filterbar 的「类型」下拉＝本地变更类型维
  // （读口不支持 kind 过滤，实测只发 status/limit/cursor，故只在已加载行内筛）。
  const [kind, setKind] = useState<string>("");
  const kindOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of list.rows) {
      const raw = row.changeKind.raw;
      if (raw) seen.set(raw, row.changeKind.label);
    }
    return [{ value: "", label: "全部类型" }, ...[...seen].map(([value, label]) => ({ value, label }))];
  }, [list.rows]);
  const kindBaseRows = useMemo(
    () => (kind ? riskBaseRows.filter((row) => row.changeKind.raw === kind) : riskBaseRows),
    [riskBaseRows, kind],
  );
  const visibleRows = useMemo(() => {
    const byActor = actor ? kindBaseRows.filter((row) => row.approverIds.includes(actor)) : kindBaseRows;
    return sortApprovalRows(byActor, asort, adir);
  }, [kindBaseRows, actor, asort, adir]);
  const [selected, setSelected] = useState<string | null>(() => params.get("id"));
  const [unaddressable, setUnaddressable] = useState(false);
  // R60: at most one row shows its inline preview; it never touches URL/filters.
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  // 页面车道 B: 次级筛选默认折叠，先例=3651ca6d 在待处理页的同款开关。
  const [filtersOpen, setFiltersOpen] = useState(false);


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
    // R90: one parameter table for every reset entry (FilterReset.ts).
    clearFilterParams(draft);
    setSelected(null);
    setUnaddressable(false);
    setParams(draft, { replace: true });
  }, [params, setParams]);
  // R94: 从关联 run/task 跳走再回来时，一次性还原筛选视图、打开项与滚动位。
  // 仅当快照属于本页 tab 且当前 URL 是裸视图才还原；筛选不同=用户自选视图，不抢。
  useEffect(() => {
    const snap = peekCorrelationReturn();
    if (!snap) return;
    const saved = new URLSearchParams(snap.search);
    if (saved.get("tab") !== "history") return;
    const cur = new URLSearchParams(params);
    cur.delete("tab");
    if ([...cur.entries()].length > 0) return;
    dropCorrelationReturn();
    const id = saved.get("id");
    saved.delete("id");
    const draft = new URLSearchParams(saved);
    if (id) {
      draft.set("id", id);
      setSelected(id);
    }
    setParams(draft, { replace: true });
    try {
      window.scrollTo(0, snap.scrollY);
    } catch {
      /* jsdom/无滚动环境忽略 */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filterState = hasActiveFilters(params);
  // 折叠开关上的读数只算面板里的四维（q/actor/since/risk）；status 维常驻，
  // 不计入「藏起来几条」的语义。
  const secondaryCount = [q, actor, since, risk].filter(Boolean).length;
  // R91: one chip per active filter; removal reuses the same diff plumbing.
  const removeFilterKeys = useCallback(
    (keys: readonly string[]) => {
      const draft = new URLSearchParams(params);
      for (const key of keys) draft.delete(key);
      setParams(draft, { replace: true });
    },
    [params, setParams],
  );


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
      // 骨架历史页没有常驻空详情卡；未选中时整块详情不挂载。
      return null;
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

  // AP-01③（含 R79「聚合腿到底原因要分开说」）：BFF 对 status 缺省与 status=all
  // 都走 _approvals_all 逐状态扇出（跨态 cursor 恒置 None、合并后按 limit 截断），
  // 其余状态值原样透传；两条腿的顶层实测都没有 total 键（扇出 keys=[items,nextCursor]、
  // 单态 keys=[items]），所以分母句必须由同一个 denominatorReadout 派生——两路同形，
  // 只差原因句。旧变量名 singleAgg（=status===null）覆盖面不足 "all"，已由
  // aggregated 取代，不再单独保留。
  const aggregated = status === null || status.trim().toLowerCase() === "all";
  const denominator = useMemo(
    () => ({
      loaded: list.rows.length,
      total: list.total,
      hasMore: list.next !== null,
      aggregated,
    }),
    [list.rows.length, list.total, list.next, aggregated],
  );
  const readout = denominatorReadout(denominator);
  // AP-07①: 服务端给了下一页游标＝本地过滤作用域还没到底，各过滤器作用域句据此追加
  // 「需先加载」提示；status 是唯一真服务端筛选（读口实测只发 status/limit/cursor）。
  const hasMore = list.next !== null;
  // 页头副行的状态分布：只数已加载行（读口无 total），分档按真实状态人话，
  // 0 条不写（骨架副行不列空桶），未就绪时整段不出。
  const statusParts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of list.rows) {
      if (row.status.label === "状态未识别") continue;
      counts.set(row.status.label, (counts.get(row.status.label) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, count]) => `${label} ${count}`);
  }, [list.rows]);
  return (
    <div className="apr5-history min-w-0 w-full max-w-full" data-testid="apr5-page-history">
      {/* R86: 播报单点=下方 sr-only apv-live；屏上读数不自带 aria-live。 */}
      <p className="sr-only" role="status" aria-live="polite" data-testid="apv-live">
        {announcement(list.phase, visibleRows.length)}
      </p>

      {/* 骨架页头副行：真读数（已显示句 + 状态分布）；拿不到真值就只剩已显示句，
          不写 0。右侧＝页面动作（导出 CSV / 筛选 / 刷新）。 */}
      <div className="apr5-pagehead" data-testid="apr5-page-head">
        <p className="apr5-pagehead__sum">
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
          {list.phase === "ready" && statusParts.length > 0 ? (
            <span className="apr5-pagehead__counts"> · {statusParts.join(" · ")}</span>
          ) : null}
        </p>
        <div className="apr5-pagehead__acts" role="group" aria-label="页面动作">
          <span className="apr5-pagehead__export">
            <QueueCsvExport rows={visibleRows} tab="history" status={status} phase={list.phase} sort={asort} dir={asort ? adir : null} />
          </span>
          <button
            type="button"
            data-testid="apv-h-filter-toggle"
            aria-expanded={filtersOpen}
            aria-controls="apv-history-filter-panel"
            onClick={() => setFiltersOpen((value) => !value)}
            className="apr5-linkbtn"
          >
            {filtersOpen ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />}
            筛选条件（{secondaryCount > 0 ? secondaryCount : "无"}）
          </button>
          {list.phase !== "denied" ? (
            <Button
              size="sm"
              outlined
              className="apr5-refresh shrink-0 whitespace-nowrap"
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
      </div>

      <div className="apr5-main" data-testid="apv-state" data-phase={list.phase}>
        <ConsoleCard
          flush
          data-testid="apr5-list"
          data-apv-nav="true"
          aria-label="历史决策列表"
        >
          {/* 骨架 filterbar：搜索 + 结果 + 类型 + 右侧同源读数。 */}
          <div className="apr5-filterbar" data-testid="apr5-filterbar">
            <label className="apr5-search">
              <Search className="apr5-search__icon h-3.5 w-3.5" aria-hidden="true" />
              <input
                type="search"
                aria-label="搜索审批"
                data-testid="apr5-h-search"
                className="apr5-search__input"
                placeholder="搜索事项、发起人、审批人"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <ConsoleSelect
              aria-label="按处理结果筛选"
              data-testid="apr5-status-select"
              value={activeValue}
              onChange={(value) => choose(value === "all" ? null : value)}
              className="apr5-select"
              title="结果＝服务端 status 筛选（切换会重新请求）；「全部」不发 status 参数。"
              options={CHOICES.map((choice) => ({ value: choice.value, label: choice.label === "全部" ? "全部结果" : choice.label }))}
            />
            <ConsoleSelect
              aria-label="按类型筛选"
              data-testid="apr5-kind-select"
              value={kind}
              onChange={(value) => setKind(value)}
              className="apr5-select"
              title="类型＝当前已加载行内的变更类型过滤（读口不支持 kind 参数，本地筛选不产生新请求）。"
              options={kindOptions}
            />
            <span className="apr5-filterbar__grow" />
            {list.phase === "ready" ? (
              <>
                <span
                  className="apr5-filterbar__meta"
                  data-testid="apv5-count"
                  title={q ? "计数与下方列表同源（关键字过滤后）" : "计数与下方列表同源：同一份服务端返回的行数"}
                >
                  {visibleRows.length}
                </span>
                <span className="apr5-filterbar__meta" data-testid="apr5-count-note">
                  {list.rows.length} 条 · 显示 {visibleRows.length}
                </span>
              </>
            ) : null}
          </div>

          {/* 生效筛选：一行文字 + chips，可逐项移除；无筛选时这行视觉收起。 */}
          <div
            className={`apr5-eff${filterState.active ? "" : " is-idle"}`}
            data-testid="apv-reset-row"
          >
            <button
              type="button"
              data-testid="apv-reset-filters"
              disabled={!filterState.active}
              title={resetTitle(filterState.count)}
              onClick={clearFilters}
              className="apr5-linkbtn"
            >
              重置筛选{filterState.active ? `（${filterState.count}）` : ""}
            </button>
            <FilterSummary params={params} onRemove={removeFilterKeys} phase={list.phase} />
          </div>

          {/* 汇总/八态组/队列快捷钮：既有能力与读数保留在无障碍树
              （屏上由 filterbar 的下拉与页头真读数承担同一选择）。 */}
          <div className="apr5-sr">
            <QueueSummaryBar
              phase={list.phase}
              rows={visibleRows}
              scope="history"
              singleStatus={status}
              denominator={denominator}
              unreadable={list.unreadable}
            />
            <div className="flex min-w-0 flex-wrap gap-1.5" role="group" data-testid="apr5-filter" aria-label="按处理结果筛选">
              {CHOICES.map((choice) => {
                const active = choice.value === activeValue;
                return (
                  <button
                    key={choice.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => choose(choice.sends)}
                    data-testid={`apr5-filter-${choice.value}`}
                  >
                    {choice.label}
                  </button>
                );
              })}
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5" role="group" aria-label="队列筛选（可分享）" data-testid="apv5-filter">
              {QUEUE_SHORTCUTS.map((choice) => {
                const active = choice.sends === null ? activeValue === "all" : activeValue === choice.sends;
                return (
                  <button
                    key={choice.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => choose(choice.sends)}
                    data-testid={`apv5-filter-${choice.value}`}
                  >
                    {choice.label}
                  </button>
                );
              })}
              <ConsoleSelect
                aria-label="按时间窗筛选"
                data-testid="apv5-filter-window"
                value=""
                onChange={() => undefined}
                disabled
                title="后台尚未开放时间窗筛选：带 window=24h/since=… 实测与不带参同集合，为避免假过滤此项暂不提供。"
                className="apr5-select"
                options={[{ value: "", label: "时间窗：暂不可筛" }]}
              />
            </div>
            <RowDetailCopy row={visibleRows.find((r) => r.key === previewKey) ?? null} />
          </div>

          {/* 列排序：骨架表头的排序能力收成一行微标签；三行元说明留给读屏。 */}
          <div className="apr5-sortbar">
            <QueueSortBar phase={list.phase} sort={asort} dir={adir} loadedCount={list.rows.length} onCycle={cycleSort} hasMore={hasMore} />
          </div>

          {filtersOpen ? (
            <div
              id="apv-history-filter-panel"
              data-testid="apv-h-filter-panel"
              className="apv-h-filter-panel apr5-panel"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-1.5" role="group" data-testid="apv8-search-group" aria-label="搜索审批">
                <input
                  type="search"
                  aria-label="搜索审批（面板内镜像）"
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
                data-apv8-scope-note="local-search"
                title="实测：本页读口带 q/keyword/title 任一参数都与不带时返回同一全量（同集合），后台不做关键字过滤；为避免「假服务端搜索」，这里只做前端本地过滤。"
              >
                仅在当前已加载 {list.rows.length} 条内搜索；关键字是前端本地过滤，不产生新请求（实测后台 q/keyword/title 参数被忽略）。
                {hasMore ? (
                  <span data-testid="apv8-search-crosspage" data-apv8-search-crosspage="needs-load">
                    {` ${crossPageLoadHint(true)}`}
                  </span>
                ) : null}
              </p>
              <p
                className="min-w-0 break-words text-xs text-muted-foreground"
                data-testid="apv-h-status-note"
                data-apv-h-status-scope="server"
                title="本页的「按处理结果筛选」八态组是真正发到服务端的 status 维度（实测 listUrl 只发 status/limit/cursor）；上面搜索/审批人/时间/风险与排序都是当前已加载行上的本地过滤，二者不同源。"
              >
                结果下拉＝服务端 status 筛选（切换会重新请求）；搜索、审批人、时间窗、风险档、排序都是本地过滤，只在已加载行内生效。
              </p>
              <ActorBuckets rows={riskBaseRows} phase={list.phase} actor={actor} onPick={pickActor} hasMore={hasMore} />
              <SinceQuickFilter phase={list.phase} since={since} loadedCount={list.rows.length} onPick={pickSince} hasMore={hasMore} />
              <RiskQuickFilter rows={actorBaseRows} phase={list.phase} risk={risk} onPick={pickRisk} hasMore={hasMore} />
              <p className="apr5-panel__note">风险档、时间窗、审批人、排序都只在当前已加载行内过滤，不会发新请求。</p>
            </div>
          ) : null}

          {!known ? (
            <p className="apr5-warn" data-testid="apr5-filter-unknown">
              这个筛选值不在已知的八种结果里，系统仍按原样去读；读到的内容可能与服务端的状态说法不一致。
            </p>
          ) : null}
          {list.forced ? (
            <p className="apr5-warn" data-testid="apr5-forced-note">
              这是用 ?state= 复现出来的状态，不是服务此刻的回答。
            </p>
          ) : null}

          {/* 表头：8 列 + 行末工具位。空态/加载态都保留它，行形制不塌。 */}
          <div className="apr5-thead" role="row" aria-hidden="true">
            <span>时间</span>
            <span>事项</span>
            <span>发起</span>
            <span>审批人</span>
            <span>结果</span>
            <span>耗时</span>
            <span>编号</span>
            <span>备注</span>
            <span className="apr5-thead__tools">操作</span>
          </div>

          {list.phase === "loading" ? <div className="apr5-body"><LoadingPanel /></div> : null}

          {list.phase === "denied" ? <div className="apr5-body"><DeniedPanel failure={list.failure} /></div> : null}

          {list.phase === "error" && list.failure ? (
            <div className="apr5-body"><ErrorPanel failure={list.failure} onRetry={list.reload} retryTestId="apr5-retry" /></div>
          ) : null}

          {list.phase === "empty" ? (
            <LedgerEmpty
              reason={`${APPROVAL_EMPTY_SENTENCE}：「${summary}」结果下没有记录`}
              nextStep="换一个结果看看，或点「全部结果」把所有历史决策列出来。"
              onRefresh={list.reload}
              testId="apr5-empty-history"
              clear={filterState.active ? { label: "清空筛选", onClear: clearFilters } : undefined}
            />
          ) : null}

          {list.phase === "ready" ? (
            <div className="apr5-body" data-testid="apr5-rows">
              {risk && visibleRows.length === 0 ? (
                <div className="apr5-inlineempty" data-testid="apv-risk-empty">
                  <p>该风险档下没有审批。</p>
                  <p className="apr5-inlineempty__note">
                    这是当前已加载 {list.rows.length} 条里的真实结果：没有命中该风险档的行（严重风险没有独立档位，在「全部」下照常显示）；可只清空风险档，其余筛选保留。
                  </p>
                  <Button size="sm" outlined data-testid="apv-risk-clear" onClick={() => pickRisk(null)}>
                    清空风险档
                  </Button>
                </div>
              ) : null}
              {!risk && since && visibleRows.length === 0 ? (
                <div className="apr5-inlineempty" data-testid="apv-since-empty">
                  <p>该时间范围内没有审批。</p>
                  <p className="apr5-inlineempty__note">
                    这是当前已加载 {list.rows.length} 条里的真实结果：没有提交时间落在该时间窗内的行（缺提交时间的行不属于任何窗口）；可放宽范围或清空时间筛选。
                  </p>
                  <Button size="sm" outlined data-testid="apv-since-clear" onClick={() => pickSince(null)}>
                    清空时间范围
                  </Button>
                </div>
              ) : null}
              {!risk && !since && actor && visibleRows.length === 0 ? (
                <div className="apr5-inlineempty" data-testid="apv-actor-empty">
                  <p>该审批人下没有审批。</p>
                  <p className="apr5-inlineempty__note">
                    这是当前已加载 {list.rows.length} 条里的真实结果：没有该审批人名下的行；可清空审批人筛选或换条件。
                  </p>
                  <Button size="sm" outlined data-testid="apv-actor-clear" onClick={() => pickActor(null)}>
                    清空审批人筛选
                  </Button>
                </div>
              ) : null}
              {q && !actor && !since && !risk && visibleRows.length === 0 ? (
                <div className="apr5-inlineempty" data-testid="apv8-search-empty">
                  <p>没有匹配的审批。</p>
                  <p className="apr5-inlineempty__note">
                    这是前端本地过滤的真实结果：当前已加载 {list.rows.length} 条里没有包含「{q.trim()}」的行；可清空搜索或换服务器筛选条件。
                  </p>
                  <Button size="sm" outlined onClick={() => setQ("")}>
                    清空搜索
                  </Button>
                </div>
              ) : null}
              {visibleRows.map((row, i) => (
                <ApprovalLedgerRow
                  key={row.key}
                  index={i}
                  row={row}
                  selected={row.rawId !== null && row.rawId === selected}
                  onOpen={() => openRow(row)}
                  previewOpen={previewKey === row.key}
                  onTogglePreview={() => setPreviewKey((current) => (current === row.key ? null : row.key))}
                  active={(activeRowKey ?? (visibleRows.length > 0 ? visibleRows[0].key : null)) === row.key}
                  onActivate={() => setActiveRowKey(row.key)}
                  onNavKey={navigateRows}
                  onClosePreview={() => closePreviewAndRefocus(row.key)}
                />
              ))}

              {list.unreadable > 0 ? (
                <p className="apr5-warn" data-testid="apr5-unreadable">
                  {q
                    ? `另有 ${list.unreadable} 条缺少可显示内容的记录，不参与关键字搜索。`
                    : `有 ${list.unreadable} / ${list.rows.length + list.unreadable} 条记录缺少可显示的内容，未列在上面。`}
                </p>
              ) : null}

              {list.pageFailure ? <InlineFailure failure={list.pageFailure} action="后续记录没有加载成功" onRetry={list.loadMore} /> : null}
            </div>
          ) : null}

          {/* 页脚：骨架的左注脚 + 右页码；分页与分母诚实句同一行收口。 */}
          <div className="apr5-foot">
            <div className="apr5-foot__note">
              <span>审批记录与审计事件同源，可在审计与安全中按编号反查。</span>
              {list.phase === "ready" && list.total === null && readout.note ? (
                <span className="apr5-foot__caliber" data-testid="apv-denominator-note" title={readout.reason}>
                  {readout.note}
                </span>
              ) : null}
            </div>
            <div className="apr5-foot__pager">
              {visibleRows.length > 0 ? (
                <div className="apr5-foot__pagerinner" data-testid="apv-page">
                  <Button
                    size="sm"
                    outlined
                    className="shrink-0 whitespace-nowrap"
                    data-testid="apv-page-more"
                    disabled={!list.next || list.loadingMore}
                    onClick={list.loadMore}
                    title={
                      list.next
                        ? "带服务端游标续取下一页（追加时按单号去重，重复行不上屏）。"
                        : aggregated
                          ? "聚合视图按 8 个状态扇出取齐，跨状态没有续页游标：这里已到末页，但合并结果按单页上限截断，服务端并不承诺这就是全量。切到单一状态可按游标续取。"
                          : "服务端没有给出下一页游标：已到末页。读口不给总数，这不等于服务端承诺屏上这些就是全量。"
                    }
                    prefix={list.loadingMore ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  >
                    {list.loadingMore ? "加载中…" : "加载更多"}
                  </Button>
                  <span className="apr5-foot__count" data-testid="apv-page-count" title={readout.reason}>
                    {readout.text}
                  </span>
                  {!list.next && list.total !== null ? (
                    <span className="apr5-foot__count" data-testid="apv-page-end">
                      已到末页
                    </span>
                  ) : null}
                </div>
              ) : null}
              <span className="apr5-foot__page" data-testid="apr5-page-indicator">
                第 1 / {hasMore ? "…" : 1} 页
              </span>
            </div>
          </div>
        </ConsoleCard>

        <aside className={`apr5-detail${selected || unaddressable ? " is-open" : ""}`} aria-label="记录详情">
          {selected ? <BackToList onBack={backToList} /> : null}
          <PermalinkCopy target={selected} />
          {selected || unaddressable ? drawer : null}
        </aside>
      </div>
    </div>
  );
}
export default ApprovalsHistoryModulePage;
