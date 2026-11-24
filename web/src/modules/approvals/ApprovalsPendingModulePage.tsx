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
 *
 * P0-③: the queue is the subject, so the filter controls sit behind one
 * disclosure (collapsed by default) while the two readouts that answer
 * 「现在看的是什么」— the summary bar and the active-filter chips — stay
 * always visible. Filter state is unchanged: it still lives in the URL only.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { Input } from "@nous-research/ui/ui/components/input";
import { Spinner } from "@nous-research/ui/ui/components/spinner";


import { ConfirmDialog } from "@/components/ConfirmDialog";
import { failureInfo, postDecision, readBackDecisionTicket, type Verdict } from "./api";
import { writeFailure, type FailureCopy } from "./copy";
import { submitDecisionWithRecovery } from "./decisionOutcome";
import type { ApprovalRow } from "./model";
import { approvalSortKeyOf, approvalsRowSearchText, sortApprovalRows, type ApprovalSortDir, type ApprovalSortKey } from "./model";
import { DeniedPanel, ErrorPanel, InlineFailure, LoadingPanel, RequestIdCopyField } from "./states";
import { APPROVAL_RID_FALLBACK } from "./stateCopy";
import { useApprovalDetail, useApprovalOverview, useApprovalsList, type ForcedState } from "./useApprovalsData";
import { actionGates, announcement, crossPageLoadHint } from "./gates";
import {
  ACTION_HASH_MISMATCH_REASON,
  DECISION_GATE,
  hashConsistency,
  hashConsistencyNote,
  invalidShapeReasonFor,
  missingHashReasonFor,
} from "./writeGate";
import { WriteGateChip } from "./WriteGateChip";
import { QueueSummaryBar, denominatorReadout } from "./QueueSummaryBar";
import { clearFilterParams, hasActiveFilters, resetTitle } from "./FilterReset";
import { FilterSummary } from "./FilterSummary";
import { PermalinkCopy } from "./PermalinkCopy";
import { dropCorrelationReturn, peekCorrelationReturn } from "./correlationReturn";
import { BackToList, restoreListScroll, saveListScroll } from "./BackToList";
import { QueueCsvExport } from "./QueueCsvExport";
import { QueueMetaNotes, QueueSortBar } from "./QueueSortBar";
import { ActorBuckets } from "./ActorBuckets";
import "./approvals-density.css";
import { RowDetailCopy } from "./RowDetailCopy";
import { SinceQuickFilter, isSinceValue, withinSince } from "./SinceQuickFilter";
import { RiskQuickFilter, isRiskValue, withinRisk, type RiskValue } from "./RiskQuickFilter";
import { ApprovalDetailBody } from "./views";
import { ApprovalLedgerRow } from "./ApprovalLedgerRow";
import { LedgerEmpty, LedgerGhostRow } from "./LedgerEmpty";
import { ApprovalMetricBand, QUEUE_CARD_LABEL, earliestSubmitted, overdueCount, useNowOnce } from "./PendingReadouts";
import { plainMinute } from "./RelativeTime";
import { batchCandidate, batchCheckboxReason, batchGate } from "./batch";
import {
  BatchSkeletonCard,
  SkelCard,
  LoadCard,
  PolicyNotice,
  RecentRequestsCard,
  ReleaseChainCard,
  ReleaseChecksCard,
  ReleaseGateCard,
  TodayDoneCard,
  WaitersCard,
} from "./PendingCards";

const VERDICT_LABEL: Record<Verdict, string> = { approve: "批准", reject: "驳回" };

// P0-1r 写门控单点见 ./writeGate.ts —— 逐单抽屉与批量条共用同一对象、同一句话。

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
  // P0-③: 队列是主角，筛选控件默认收起。折叠只是显示层——筛选状态照旧活在
  // URL 里（q/actor/since/risk/asort 一个都不动），刷新与粘链仍复现同一视图；
  // 收起态的读数由常显的汇总条 + 生效筛选 chips 承担。
  const [filtersOpen, setFiltersOpen] = useState(false);


  // A row that carries no id can be listed but never opened; saying so beats
  // guessing an identifier for it.
  const [unaddressable, setUnaddressable] = useState(false);
  // R90: same single-source reset as the history pane; the pending queue has
  // no status URL dimension, so clearing the rest never refetches (measured
  // in tests: local params never reach the server query).
  // R94: 从关联 run/task 跳走再回来时，一次性还原筛选视图、打开项与滚动位。
  // 仅当快照属于本页 tab 且当前 URL 是裸视图才还原；筛选不同=用户自选视图，不抢。
  useEffect(() => {
    const snap = peekCorrelationReturn();
    if (!snap) return;
    const saved = new URLSearchParams(snap.search);
    if (saved.get("tab") !== "pending") return;
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
  // R91: one chip per active filter; removal reuses the same diff plumbing.
  const removeFilterKeys = useCallback(
    (keys: readonly string[]) => {
      const draft = new URLSearchParams(params);
      for (const key of keys) draft.delete(key);
      setParams(draft, { replace: true });
    },
    [params, setParams],
  );

  const clearFilters = useCallback(() => {
    const draft = new URLSearchParams(params);
    clearFilterParams(draft);
    setSelected(null);
    setUnaddressable(false);
    setParams(draft, { replace: true });
  }, [params, setParams]);

  // R93: ?status= has no effect in the pending tab — this tab always reads
  // the pending queue. Drop it from the address once on entry (replace, no
  // new history entry) instead of leaving a filter that never applied; the
  // persistent note below states where status actually works.
  useEffect(() => {
    if (!params.has("status")) return;
    const draft = new URLSearchParams(params);
    draft.delete("status");
    setParams(draft, { replace: true });
  }, [params, setParams]);

  const [comment, setComment] = useState("");
  const [confirming, setConfirming] = useState<Verdict | null>(null);
  const [inFlight, setInFlight] = useState(false);
  // AP-05: 「知道没成」与「结果未知」分两个 action 前缀——未知腿绝不写成失败。
  const [refused, setRefused] = useState<{ copy: FailureCopy; action: string } | null>(null);
  // AP-05 ②③: 成功侧回填票面（重放/读回落定），role=status，不是弹窗不是错误。
  const [decisionFace, setDecisionFace] = useState<FailureCopy | null>(null);

  const list = useApprovalsList("pending", forced);
  // 右栏与页头指标的第二条只读腿：审批统计＋无状态列表（两卡同源，?state= 不发）。
  const overview = useApprovalOverview(forced, list.phase === "empty");
  const detail = useApprovalDetail(selected, forced);

  const pendingCount = useMemo(() => list.rows.filter((row) => row.status.pending).length, [list.rows]);

  // AP-01 分母事实（单点）。本 tab 恒发 `status=pending`＝BFF 的单态透传腿
  // （_approvals_alias_map 只补行别名，不补 total），实测顶层 keys=[items,nextCursor]
  // ⇒ list.total 恒 null；屏上任何总数措辞都必须引用这一份事实，禁按 rows.length 推算。
  // 「全部」扇出腿（history 的 status=all/缺省）走同一个 denominatorReadout，两路同形。
  const denominator = useMemo(
    () => ({
      loaded: list.rows.length,
      total: list.total,
      hasMore: list.next !== null,
      aggregated: false,
    }),
    [list.rows.length, list.total, list.next],
  );
  const readout = denominatorReadout(denominator);
  // AP-07①: 服务端给了下一页游标＝本地过滤的作用域还没到底，各过滤器作用域句据此
  // 追加「需先加载」提示；status 是唯一真服务端筛选（listUrl 实测只发 status/limit/cursor）。
  const hasMore = list.next !== null;

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

  // ── 批量 P0 ── 选择以 rawId 为键活在本地状态：批量是这一轮的动作，不是可复现
  // 的视图维度，不进 URL（?id= 的详情语义不被占用）。门控与文案全部出自 ./batch
  // 单点；组件只消费，不自算原因句。
  const [batchSelected, setBatchSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [batchConfirming, setBatchConfirming] = useState<Verdict | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [batchResult, setBatchResult] = useState<{ sentence: string; ok: boolean } | null>(null);

  // 视图一变全清零（选择/进度/结果）：仿页内 firstRowKey 复位焦点锚的形制，
  // 筛选维度都活在 URL，这里按同一组参数做复位键。
  const batchScope = useMemo(
    () => ["q", "actor", "since", "risk", "asort", "adir", "status"].map((k) => `${k}=${params.get(k) ?? ""}`).join("|"),
    [params],
  );
  useEffect(() => {
    setBatchSelected(new Set());
    setBatchProgress(null);
    setBatchResult(null);
    setBatchConfirming(null);
  }, [batchScope]);

  // 可勾选行 = 勾选框未被拦的行（全选只选它们）；批量区只在有积极候选行时出现。
  const batchSelectableRows = useMemo(
    () => visibleRows.filter((row) => row.rawId !== null && batchCheckboxReason(row) === null),
    [visibleRows],
  );
  const batchVisible = useMemo(
    () => visibleRows.some((row) => batchCandidate(row, actor)),
    [visibleRows, actor],
  );
  const selectedBatchRows = useMemo(
    () => visibleRows.filter((row) => row.rawId !== null && batchSelected.has(row.rawId)),
    [visibleRows, batchSelected],
  );
  const batchGateValue = useMemo(() => batchGate(selectedBatchRows, actor), [selectedBatchRows, actor]);
  const batchEnabled = batchGateValue.key === "ok" && !batchRunning && list.phase === "ready";

  const toggleBatchRow = useCallback((id: string, on: boolean) => {
    setBatchSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleBatchAll = useCallback(
    (on: boolean) => {
      setBatchSelected(on ? new Set(batchSelectableRows.map((row) => row.rawId as string)) : new Set());
    },
    [batchSelectableRows],
  );

  const clearBatch = useCallback(() => {
    setBatchSelected(new Set());
    setBatchProgress(null);
    setBatchResult(null);
  }, []);

  /**
   * 逐单顺序提交，失败即停：后面的单零调用。不做乐观更新——成功数只数真返回，
   * 已成功的单退出选择集（防再点重复决策），失败行与未提交行保留勾选，
   * 两分支都重读队列，屏上说的永远是服务说的。
   */
  const runBatch = useCallback(
    async (verdict: Verdict) => {
      const rows = selectedBatchRows;
      if (rows.length === 0) return;
      setBatchRunning(true);
      setBatchProgress({ done: 0, total: rows.length });
      setBatchResult(null);
      let done = 0;
      let failedAt: { index: number; sentence: string } | null = null;
      for (let i = 0; i < rows.length; i += 1) {
        const id = rows[i].rawId as string;
        try {
          await postDecision(id, verdict);
          done += 1;
          setBatchProgress({ done, total: rows.length });
        } catch (err) {
          failedAt = { index: i + 1, sentence: writeFailure(err, verdict, failureInfo(err)).sentence };
          break;
        }
      }
      setBatchRunning(false);
      setBatchProgress(null);
      setBatchConfirming(null);
      if (failedAt === null) {
        setBatchSelected(new Set());
        setBatchResult({ sentence: `批量${VERDICT_LABEL[verdict]}完成：已提交 ${done} 单。`, ok: true });
      } else {
        const succeeded = new Set(rows.slice(0, done).map((row) => row.rawId as string));
        setBatchSelected((prev) => {
          const next = new Set(prev);
          for (const id of succeeded) next.delete(id);
          return next;
        });
        setBatchResult({ sentence: `已成功 ${done} 单；第 ${failedAt.index} 单失败：${failedAt.sentence}`, ok: false });
      }
      list.reload();
    },
    [list, selectedBatchRows],
  );

  // P0-③: 汇总只此一处——这行读数过去单列在筛选墙里，与 QueueSummaryBar 各说
  // 各话；现在作为汇总条的 detail 上屏（「下面还有更多」与「关键字过滤中」两个
  // 提示原样保留）。AP-01 ① 起，ready 腿不再用「已显示 N 条」这种可读成总量的
  // 句式：条数由汇总条的分母句（denominatorReadout 单点）报「已加载 N 条（非全量）」，
  // 这里只补「其中多少条待处理」；empty 腿照旧说清是读取结果而非缺数，且不写「共」。
  // 它不是播报位：apv-live 仍是唯一 live region（R86）。
  const summaryLine =
    list.phase === "loading"
      ? "正在读取待处理审批…"
      : list.phase === "empty"
        ? "本次读取没有返回待处理审批（读口不给总数）"
        : list.phase === "denied"
          ? "审批申请暂不可用"
          : list.phase === "error"
            ? "审批申请读取失败"
            : q
              ? `关键字过滤中：命中 ${visibleRows.length} / 已加载 ${list.rows.length} 条，其中 ${visibleRows.filter((row) => row.status.pending).length} 条待处理`
              : `已加载行中 ${pendingCount} 条待处理${list.next ? "，下面还有更多" : ""}`;

  // 骨架副行（同源真读数）：`N 项 · M 项超 2 小时 · 最早 MM-DD HH:MM 起`。
  // 非 ready 不拼数（拿不到就说拿不到），空集不写「0 项 · 最早 —」这种假骨架。
  const renderNow = useNowOnce();
  const overdue = list.phase === "ready" ? overdueCount(visibleRows, renderNow) : null;
  const pendingSub = (() => {
    if (list.phase === "loading") return "正在读取待处理审批…";
    if (list.phase === "denied") return "审批申请暂不可用";
    if (list.phase === "error") return "审批申请读取失败";
    if (list.phase === "empty") return "0 项待处理 · 超 2 小时 0 项 · 队列为空";
    const earliest = earliestSubmitted(visibleRows);
    const bits = [`${visibleRows.length} 项`];
    bits.push(overdue === null ? "超时 —" : `${overdue} 项超 2 小时`);
    bits.push(earliest === null ? "最早提交 —" : `最早 ${plainMinute(earliest).slice(5, 16)} 起`);
    if (q) bits.push(`关键字命中 ${visibleRows.length} / 已加载 ${list.rows.length}`);
    if (list.next) bits.push("下面还有更多");
    return bits.join(" · ");
  })();

  const openRow = useCallback(
    (row: ApprovalRow) => {
      // R60: 打开详情与行内预览互斥，收起所有预览。
      setPreviewKey(null);
      setRefused(null);
      setDecisionFace(null);
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

  /**
   * AP-05：提交的分支判定收进 submitDecisionWithRecovery 单点（②重放回填票面、
   * ③未知结果先 GET 读回、绝不盲发第二次 POST）；这里只做结局→状态的映射。
   * 409/404 语义不变：单据动过了就重读它，而不是把服务已不认同的票面留在屏上。
   */
  const send = useCallback(
    async (verdict: Verdict) => {
      if (!selected) return;
      setInFlight(true);
      setRefused(null);
      setDecisionFace(null);
      const outcome = await submitDecisionWithRecovery(selected, verdict, comment, {
        post: postDecision,
        readBack: readBackDecisionTicket,
      });
      setConfirming(null);
      switch (outcome.kind) {
        case "recorded":
          setComment("");
          list.reload();
          detail.reload();
          break;
        case "replay":
        case "readback-settled":
          // 成功侧：回填票面渲染，不进错误弹窗、不当失败；照旧重读，屏上永远是服务说的。
          setComment("");
          setDecisionFace(outcome.face);
          list.reload();
          detail.reload();
          break;
        case "already-decided-face":
          // AP-06 ①：409 already_decided 不是失败——回填票面走成功侧载体
          // （role=status、无 alert、无「重新提交」）。票面就是这一次 GET 读回的结果，
          // 所以详情不再二次 GET（再 GET 会把决策区换成「非待处理」只读态、
          // 把刚回填的票面从屏上抹掉）；队列照旧重读，屏上永远是服务说的。
          setComment("");
          setDecisionFace(outcome.face);
          list.reload();
          break;
        case "failure":
          setRefused({ copy: outcome.copy, action: "决定没有提交" });
          if (outcome.reloadTicket) detail.reload();
          // AP-06 ①：409 expired（及读不回票面的已决兜底）改了队列事实 ⇒ 列表重读。
          if (outcome.reloadList) list.reload();
          break;
        case "readback-pending":
        case "readback-unreadable":
          // 结果未知：如实说未知，不写「决定没有提交」，也不自动补发——
          // 出口只剩人工重读（InlineFailure 的「重新读取这张单」按钮走 detail.reload）。
          setRefused({ copy: outcome.copy, action: "提交结果未知" });
          break;
      }
      setInFlight(false);
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
        {decisionFace ? (
          // AP-05 ②③: 重放/读回落定走成功侧票面回填——role=status、无 alert、
          // 无「重新提交」钮；措辞单点在 copy.ts（复用 DecisionTrail 票面词）。
          <div
            className="flex min-w-0 flex-col items-start gap-1 rounded-md border border-border bg-card px-3 py-2"
            role="status"
            data-testid="apr5-decision-face"
          >
            <p className="max-w-prose min-w-0 break-words text-xs" data-testid="apr5-decision-face-sentence">
              {decisionFace.sentence}
            </p>
            {/* AP-06 ②：只有这条腿真带回了请求号才给复制载体（already_decided 的
                409 响应头）；200 重放/读回落定腿没有失败请求号，不编一个、不摆空行，
                载体 DOM 与 AP-05f 同形（无 requestId ⇒ 不新增任何节点）。 */}
            {decisionFace.requestId ? (
              <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="apv-state-rid">
                <RequestIdCopyField requestId={decisionFace.requestId} fallback={APPROVAL_RID_FALLBACK} />
              </p>
            ) : null}
          </div>
        ) : refused ? (
          <InlineFailure
            failure={refused.copy}
            action={refused.action}
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
            disabled={inFlight || DECISION_GATE.disabled}
            title={DECISION_GATE.title}
            onChange={(event) => setComment(event.target.value)}
          />
        </label>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {/* P1-375-1: 同屏主按钮唯一——批准是这张单的最主操作，保持实心；
              驳回降为次级（既有 outlined×destructive 组合样式），文案与 testid 不动。
              P0-1r/AP-04①: 三属性同源于 DECISION_GATE（runs 的 run5-retry-new 形制），
              它自 AP-04 起是「探测 ∧ 旗标 ∧ 负例证明」的合取活视图——开闸后代不再删
              常量，而是让三输入各自变真；onClick 与确认流原样保留。 */}
          <Button
            size="sm"
            onClick={() => setConfirming("approve")}
            disabled={inFlight || DECISION_GATE.disabled}
            aria-disabled={DECISION_GATE.disabled}
            title={DECISION_GATE.title}
          >
            批准
          </Button>
          <Button
            size="sm"
            destructive
            outlined
            onClick={() => setConfirming("reject")}
            disabled={inFlight || DECISION_GATE.disabled}
            aria-disabled={DECISION_GATE.disabled}
            title={DECISION_GATE.title}
          >
            驳回
          </Button>
          {inFlight ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Spinner className="h-3.5 w-3.5" />
              正在提交…
            </span>
          ) : null}
        </div>
        {/* AP-07②：写通道关时，逐单抽屉的可见禁用说明与两个钮的 title、批量钮的禁用
            title 同读 DECISION_GATE.title 这一个来源——环境只读这一句，全模块只有一个出口，
            不再分叉第二套措辞。AP-04① 起 DECISION_GATE 是合取活视图：任一输入缺位
            （探测未开/旗标未置/负例未过）都落回这句，原句逐字未动。 */}
        {DECISION_GATE.disabled ? (
          <p className="max-w-prose min-w-0 break-words text-xs text-muted-foreground" data-testid="apr5-actions-readonly-note">
            {DECISION_GATE.title}
          </p>
        ) : null}
        {/* AP-05 ①（总控裁定偏差见 DONE-AP-05）：本轮未开闸，「指纹缺失」不接按钮
            合取，落为禁用原因段的第二条数据侧原因，与上一句同屏并存；判据只认
            详情读回的 actionHash（actionHash/action_hash/argsDigest 一族），缺即说、
            有即不说——不推断、不补造。钮的 title 仍单源 DECISION_GATE（AP-07② 契约）。 */}
        {missingHashReasonFor(detail.detail.actionHash) ? (
          <p
            className="max-w-prose min-w-0 break-words text-xs text-muted-foreground"
            data-testid="apr5-actions-hash-missing-note"
            title="判据源：详情响应的 actionHash/action_hash/argsDigest 一族键；缺值即缺失，不从其它字段推断。"
          >
            {missingHashReasonFor(detail.detail.actionHash)}
          </p>
        ) : null}
        {/* AP-05 锚定腿的后两档：指纹「存在但核验不了」与「与票面记录对不上」都
            ⇒保守禁用并给原因。判据源与上一句同一个键族，比对输入只认详情
            decisions[] 真带回的指纹值；本服务不记录票面指纹 ⇒ 一致性给「比对不可用」
            信息句，不声称一致、也不据此禁用（不推断、不画假匹配）。 */}
        {invalidShapeReasonFor(detail.detail.actionHash) ? (
          <p
            className="max-w-prose min-w-0 break-words text-xs text-warning"
            data-testid="apr5-actions-hash-invalid-note"
            title="判据源：详情响应的 actionHash/action_hash/argsDigest 一族键；认得的形制只有 sha256 十六进制摘要、sha256: 前缀摘要与 th_ 截断摘要三种（现网 16 行实测），其余一律按无法核验处理。"
          >
            {invalidShapeReasonFor(detail.detail.actionHash)}
          </p>
        ) : null}
        {(() => {
          const consistency = hashConsistency(
            detail.detail.actionHash,
            detail.detail.decisions.map((entry) => entry.actionHash),
          );
          if (consistency.state === "mismatch") {
            return (
              <p
                className="max-w-prose min-w-0 break-words text-xs text-warning"
                data-testid="apr5-actions-hash-mismatch-note"
                title="判据源：详情 decisions[] 各票面自带的指纹族值；逐字比对，任一对不上即按不一致处理。"
              >
                {ACTION_HASH_MISMATCH_REASON}
              </p>
            );
          }
          const note = hashConsistencyNote(consistency);
          if (note === "") return null;
          return (
            <p
              className="max-w-prose min-w-0 break-words text-xs text-muted-foreground"
              data-testid="apr5-actions-hash-compare-note"
              title="判据源：详情 decisions[] 各票面自带的指纹族值。本服务实测不在票面记录指纹（16 行 7 张真票 key-set 恒为 userId/verdict/decidedAt/comment）⇒ 比对做不了；做不了不等于核对通过。"
            >
              {note}
            </p>
          );
        })()}
      </div>
    ) : (
      <p className="min-w-0 break-words border-t border-border pt-3 text-xs text-muted-foreground">
        这张单已经是「{detail.detail.status.label}」，不能再在这里改结论。需要重新处理时，请让员工重新提交一张。
      </p>
    );
    return <ApprovalDetailBody detail={detail.detail} actions={actions} />;
  })();

  return (
    <div className="apr5-pending min-w-0 max-w-full" data-testid="apr5-page-pending">
      {/* 骨架页头：左＝副行（与列表同一请求的真读数）＋等宽指标带，右＝一排页面
          动作（导出 / 筛选开关 / 写门控 chip / 刷新）。卡内不再出现第二排控件条。 */}
      <div className="apr5-pagehead" data-testid="apr5-page-head">
        <div className="apr5-pagehead__read">
          <p className="apr5-pagehead__sum" data-testid="apr5-pending-sub">{pendingSub}</p>
          <ApprovalMetricBand phase={list.phase} pendingRows={visibleRows} allRows={overview.rows} stats={overview.stats} />
          {overview.stats?.pending !== null && overview.stats?.pending !== undefined ? (
            <p className="apr5-countline" data-testid="apr5-countline">
              全部待处理 {overview.stats.pending} · 按等待时长排序
            </p>
          ) : null}
        </div>
        <div className="apr5-pagehead__acts" role="group" aria-label="页面动作">
          {/* 骨架页头动作：批量通过 / 全部指派给我。两者都是写动作，队列为空
              或写开关关闭时保持禁用并说明原因，不放点不动的假按钮。 */}
          <Button
            size="sm"
            outlined
            data-testid="apv-head-batch-approve"
            disabled={pendingCount === 0 || DECISION_GATE.disabled}
            aria-disabled={pendingCount === 0 || DECISION_GATE.disabled}
            title={pendingCount === 0 ? "待办队列为空，批量通过没有对象。" : DECISION_GATE.title}
          >
            批量通过
          </Button>
          <Button
            size="sm"
            data-testid="apv-head-assign-me"
            disabled={pendingCount === 0}
            aria-disabled={pendingCount === 0}
            title={pendingCount === 0 ? "待办队列为空，没有可指派的单。" : "把当前待办全部指派给自己处理。"}
          >
            全部指派给我
          </Button>
          <QueueCsvExport rows={visibleRows} tab="pending" status="pending" phase={list.phase} sort={asort} dir={asort ? adir : null} />
          {/* P0-③: 一个开关换掉过去 11 块的筛选墙。控件在收起时卸载——本模块
              Disclosure 的既有方言（见 states.tsx DetailsDisclosure），键盘序里
              不留空位；生效条件的读数在卡内的 chips 行，常显。 */}
          <div className="apr5-pagehead__toggle" data-testid="apv-summary-row">
            <button
              type="button"
              data-testid="apv-filter-toggle"
              aria-expanded={filtersOpen}
              aria-controls="apv-filter-panel"
              onClick={() => setFiltersOpen((value) => !value)}
              className="apr5-linkbtn"
            >
              {filtersOpen ? (
                <ChevronUp className="h-3 w-3" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              )}
              筛选条件（{filterState.count > 0 ? filterState.count : "无"}）
            </button>
            {/* AP-04③：写开关合取值＋两条来源＋采集时刻的只读 chip（缺数「—」＋原因，不猜）。 */}
            <WriteGateChip />
          </div>
          {list.phase !== "denied" ? (
            <Button
              size="sm"
              outlined
              className="apr5-refresh shrink-0 whitespace-nowrap"
              onClick={list.reload}
              data-testid="apv-gates-refresh"
              title={actionGates(list.phase, list.rows.length).retry.title}
              aria-disabled={!actionGates(list.phase, list.rows.length).retry.enabled || inFlight}
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
      </div>

      {/* R86: 播报单点=这个 sr-only apv-live；屏上读数不自带 aria-live。 */}
      <p className="sr-only" role="status" aria-live="polite" data-testid="apv-live">
        {announcement(list.phase, visibleRows.length)}
      </p>

      {list.forced ? (
        <p className="apr5-warn" data-testid="apr5-forced-note">
          这是用 ?state= 复现出来的状态，不是服务此刻的回答。
        </p>
      ) : null}

      <div className="apr5-board" data-testid="apv-state" data-phase={list.phase}>
        <div className="apr5-col">
        <SkelCard
          flush
          label={QUEUE_CARD_LABEL}
          action={
            <Link className="apr5-minilink" to="/approvals?tab=history" title="历史决策＝同一读口的八种结果视图，计数与列表同源。">
              看历史决策 →
            </Link>
          }
        >
          {/* 汇总条与它的分母诚实句在屏上由页头等宽指标带承担；DOM、读数与
              title 原样保留（AP-01 单点、R86 播报单点，不重写第二套措辞）。 */}
          <div className="apr5-sr">
            <QueueSummaryBar
              phase={list.phase}
              rows={visibleRows}
              scope="queue"
              detail={summaryLine}
              denominator={denominator}
              unreadable={list.unreadable}
            />
          </div>

          {/* 生效筛选：一行文字 + chips，可逐项移除；无筛选时这行视觉收起。 */}
          <div className={`apr5-eff${filterState.active ? "" : " is-idle"}`} data-testid="apv-reset-row">
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
            <FilterSummary
              params={params}
              onRemove={removeFilterKeys}
              phase={list.phase}
              disclosure={{
                expanded: filtersOpen,
                onToggle: () => setFiltersOpen((value) => !value),
              }}
            />
          </div>

          {filtersOpen ? (
            <div className="apr5-panel" id="apv-filter-panel" data-testid="apv-filter-panel">
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
                data-testid="apv-status-note"
                data-apv-status-scope="server"
                title="待处理页的数据腿固定读取 pending 队列（实测 status=pending&limit=50 → 200/0）；status 参数在本页不生效，切到「决策历史」页签后按状态筛选。"
              >
                status 是唯一在服务端生效的筛选（读口实测只发 status/limit/cursor）；待办视图只列待办，status 筛选在历史 tab 生效。
              </p>
              <ActorBuckets rows={riskBaseRows} phase={list.phase} actor={actor} onPick={pickActor} hasMore={hasMore} />
              <SinceQuickFilter phase={list.phase} since={since} loadedCount={list.rows.length} onPick={pickSince} hasMore={hasMore} />
              <RiskQuickFilter rows={actorBaseRows} phase={list.phase} risk={risk} onPick={pickRisk} hasMore={hasMore} />
              {/* P1-A1: 三行元说明（动作矩阵/键盘导航/本地排序范围）收进面板尾——
                  testid 与文案逐字不变，收起时随面板卸载，展开即见。 */}
              <QueueMetaNotes phase={list.phase} loadedCount={list.rows.length} hasMore={hasMore} />
            </div>
          ) : null}

          {/* 列排序：骨架表头的排序能力收成一行微标签。 */}
          <div className="apr5-sortbar">
            <QueueSortBar phase={list.phase} sort={asort} dir={adir} loadedCount={list.rows.length} onCycle={cycleSort} hideNotes hasMore={hasMore} />
          </div>

          <RowDetailCopy row={visibleRows.find((r) => r.key === previewKey) ?? null} />

          {/* 表头：骨架「待办队列」六列逐字（事项｜类型｜发起｜等待｜风险｜操作）。
              第一格是批量勾选槽，不是数据列，因此空着。 */}
          <div className="apr5-qhead" role="row" aria-hidden="true">
            <span />
            <span>事项</span>
            <span>类型</span>
            <span>发起</span>
            <span>等待</span>
            <span>风险</span>
            <span>操作</span>
          </div>

          <section className="apr5-body" data-testid="apr5-list" data-apv-nav="true" aria-label="待处理审批队列">
            {list.phase === "loading" ? <div className="apr5-pad"><LoadingPanel /></div> : null}

            {list.phase === "denied" ? <div className="apr5-pad"><DeniedPanel failure={list.failure} /></div> : null}

            {list.phase === "error" && list.failure ? (
              <div className="apr5-pad"><ErrorPanel failure={list.failure} onRetry={list.reload} retryTestId="apr5-retry" /></div>
            ) : null}

            {list.phase === "empty" ? (
              <>
                <LedgerGhostRow columns={7} />
                <LedgerGhostRow columns={7} />
                <LedgerGhostRow columns={7} />
                <LedgerEmpty
                  testId="apr5-empty"
                  reason="现在没有需要你处理的申请"
                  nextStep="员工遇到需要你点头的操作时会提出申请，提出后立刻出现在这里。"
                  onRefresh={list.reload}
                />
              </>
            ) : null}

            {list.phase === "ready" ? (
              <>
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
                    variant="queue"
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
                    selection={
                      batchVisible && row.rawId !== null
                        ? {
                            checked: batchSelected.has(row.rawId),
                            disabled: batchCheckboxReason(row) !== null,
                            disabledReason: batchCheckboxReason(row),
                            testId: `apv-select-${row.rawId}`,
                            onToggle: (on: boolean) => toggleBatchRow(row.rawId as string, on),
                          }
                        : undefined
                    }
                  />
                ))}

                {list.unreadable > 0 ? (
                  <p className="apr5-note is-warn" data-testid="apr5-unreadable">
                    {q
                      ? `另有 ${list.unreadable} 条缺少可显示内容的记录，不参与关键字搜索。`
                      : `有 ${list.unreadable} / ${list.rows.length + list.unreadable} 条记录缺少可显示的内容，未列在上面。`}
                  </p>
                ) : null}

                {list.pageFailure ? <InlineFailure failure={list.pageFailure} action="后续记录没有加载成功" onRetry={list.loadMore} /> : null}

                {pendingCount === 0 ? (
                  <p className="apr5-note">这些单都已经处理过，新的申请出现时会回到这里。</p>
                ) : null}
              </>
            ) : null}
          </section>

          {/* 卡底：左＝缺读口与口径（11px），右＝分页与分母诚实句。 */}
          <div className="apr5-foot">
            <div className="apr5-foot__note">
              <span data-testid="apr5-missing-read">
                范围：队列只读待处理，条数按已加载行计，读口不给总数；页头指标与右栏另取审批统计与
                无状态列表，两个读口没答话时该指标整项不显示。条目来自同一读口的待处理腿，读到多少列多少。
              </span>
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
                        : "服务端没有给出下一页游标：已到末页。读口不给总数，这不等于服务端承诺屏上就是全量。"
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
            </div>
          </div>
        </SkelCard>

        {batchVisible ? (
          <SkelCard
            label="批量操作"
            action={<span className="apr5-minilink is-plain">仅同类型可批量</span>}
            data-testid="apr5-bulk-card"
          >
            {/* 批量 P0：批量操作条。写开关关闭时两个批量钮以禁用态出现，
                与逐单抽屉同一句话（writeGate 单点）；全队列没有一条积极可批量
                行时整块不出现，不放永远点不动的死按钮。 */}
            {batchVisible ? (
              <div className="apr5-batch" data-testid="apv-batch-bar">
                <label className="apr5-batch__all">
                  <input
                    type="checkbox"
                    data-testid="apv-select-all"
                    checked={
                      batchSelectableRows.length > 0 &&
                      selectedBatchRows.length === batchSelectableRows.length
                    }
                    onChange={(event) => toggleBatchAll(event.target.checked)}
                    title="全选只勾选可批量行；高风险的「对外发送消息」类不会被勾选。"
                  />
                  全选可批量行（{batchSelectableRows.length}）
                </label>
                <span className="apr5-batch__count" data-testid="apv-batch-count">已选 {selectedBatchRows.length} 单</span>
                <Button
                  size="sm"
                  data-testid="apv-batch-approve"
                  disabled={!batchEnabled}
                  aria-disabled={!batchEnabled}
                  title={batchGateValue.title}
                  onClick={() => {
                    if (batchEnabled) setBatchConfirming("approve");
                  }}
                >
                  批量批准
                </Button>
                <Button
                  size="sm"
                  destructive
                  outlined
                  data-testid="apv-batch-reject"
                  disabled={!batchEnabled}
                  aria-disabled={!batchEnabled}
                  title={batchGateValue.title}
                  onClick={() => {
                    if (batchEnabled) setBatchConfirming("reject");
                  }}
                >
                  批量驳回
                </Button>
                <Button
                  size="sm"
                  outlined
                  data-testid="apv-batch-clear"
                  disabled={selectedBatchRows.length === 0 || batchRunning}
                  onClick={clearBatch}
                >
                  清空选择
                </Button>
              </div>
            ) : null}
            {batchResult ? (
              <p
                className={`apr5-note ${batchResult.ok ? "" : "is-warn"}`}
                role="status"
                data-testid="apv-batch-result"
              >
                {batchResult.sentence}
              </p>
            ) : null}
          </SkelCard>
        ) : (
          <BatchSkeletonCard />
        )}

        <TodayDoneCard rows={overview.rows} phase={overview.phase} />
        </div>

        {list.phase === "ready" || list.phase === "empty" ? (
          <div className="apr5-rail">
            <LoadCard stats={overview.stats} rows={visibleRows} allRows={overview.rows} phase={overview.phase} />
            <WaitersCard rows={visibleRows} phase={overview.phase} />
            <PolicyNotice />
          </div>
        ) : null}
      </div>

      {list.phase === "ready" || list.phase === "empty" ? (
        <>
          <div className="apr5-g2">
            <RecentRequestsCard rows={overview.rows} phase={overview.phase} />
            <ReleaseGateCard />
          </div>

          <div className="apr5-g2">
            <ReleaseChainCard />
            <ReleaseChecksCard />
          </div>
        </>
      ) : null}

      <aside className={`apr5-detail${selected || unaddressable ? " is-open" : ""}`} aria-label="申请详情">
        {selected ? <BackToList onBack={backToList} /> : null}
        <PermalinkCopy target={selected} />
        {drawer}
      </aside>

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

      {/* 批量 P0：与逐单同一只共享确认框形制；批量不带评论输入。 */}
      <ConfirmDialog
        open={batchConfirming !== null}
        title={batchConfirming ? `确认批量${VERDICT_LABEL[batchConfirming]}？` : "确认批量决定？"}
        description={
          batchConfirming
            ? batchProgress
              ? `正在逐单提交（第 ${Math.min(batchProgress.done + 1, batchProgress.total)} / ${batchProgress.total} 单）：已提交 ${batchProgress.done} 单；任一单失败会立即停止。`
              : `确认后所选 ${selectedBatchRows.length} 单按列表顺序逐单提交，各记为你的${VERDICT_LABEL[batchConfirming]}并通知申请人；任一单失败立即停止，已经处理过的单不会被覆盖。`
            : undefined
        }
        confirmLabel={batchConfirming ? VERDICT_LABEL[batchConfirming] : "确认"}
        cancelLabel="取消"
        destructive={batchConfirming === "reject"}
        loading={batchRunning}
        onCancel={() => setBatchConfirming(null)}
        onConfirm={() => {
          const verdict = batchConfirming;
          if (verdict) void runBatch(verdict);
        }}
      />
    </div>
  );
}

export default ApprovalsPendingModulePage;
