import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchActivity,
  fetchBlockedTasks,
  fetchBudget,
  fetchEmployeeStats,
  fetchEmployees,
  fetchReadinessEvidence,
  fetchRuns,
  load,
} from "./api";
import {
  fetchWorkbenchQueue,
  fetchWorkbenchSummary,
  fetchWorkbenchTimeseries,
  queueApprovals,
  queueStats,
  summaryStats,
  timeseriesStats,
  trimTimeseries,
} from "./workbench";
import { beijingDayWindow, daysAgoWindow } from "./format";
import { diffDuty, type DutyDelta } from "./dutyDelta";
import { DEFAULT_DUTY_RANGE, dutyRange, type DutyRangeId } from "./dutyRange";
import type {
  ActivityBody,
  ApprovalRow,
  ApprovalStatsBody,
  BudgetBody,
  EmployeeRow,
  Loadable,
  RunRow,
  RunStatsBody,
  TaskRow,
} from "./types";
import { DENOMINATOR_STATES, type ReadinessEvidence } from "./readiness";

export interface DutyData {
  employees: Loadable<EmployeeRow[]>;
  stats: Loadable<Record<string, unknown>>;
  todayStats: Loadable<RunStatsBody>;
  stats14: Loadable<RunStatsBody>;
  activity: Loadable<ActivityBody>;
  budgetDay: Loadable<BudgetBody>;
  budgetMonth: Loadable<BudgetBody>;
  approvalStats: Loadable<ApprovalStatsBody>;
  approvals: Loadable<ApprovalRow[]>;
  todayRuns: Loadable<RunRow[]>;
  recentRuns: Loadable<RunRow[]>;
  failedRuns: Loadable<RunRow[]>;
  blockedTasks: Loadable<TaskRow[]>;
  /** 四门证据（工位/有效配置/审批/知识），员工目录就绪后第二相扇出。
   * 可选：overview 的复用夹具没有这一腿，缺省按「未就绪」处理。 */
  readiness?: Loadable<ReadinessEvidence>;
}

export interface DutyRefresh {
  refreshing: boolean;
  /** Read time of the last successful refresh; never a data time. */
  refreshAt: string | null;
  refreshError: { message: string; requestId: string | null } | null;
  /** Card-by-card changes between the last two batches; null until a refresh succeeds. */
  refreshDelta: DutyDelta | null;
  refresh: () => void;
  cancelRefresh: () => void;
}

const loading = <T,>(): Loadable<T> => ({ k: "loading" });

function initial(): DutyData {
  return {
    employees: loading(),
    stats: loading(),
    todayStats: loading(),
    stats14: loading(),
    activity: loading(),
    budgetDay: loading(),
    budgetMonth: loading(),
    approvalStats: loading(),
    approvals: loading(),
    todayRuns: loading(),
    recentRuns: loading(),
    failedRuns: loading(),
    blockedTasks: loading(),
    readiness: loading(),
  };
}

function asError<T>(leg: Extract<Loadable<unknown>, { k: "error" }>): Loadable<T> {
  return { k: "error", status: leg.status, message: leg.message, requestId: leg.requestId };
}

/**
 * One read of every card, started together and returned as one batch.
 * Cards are independent: a failed endpoint yields an error for that card only.
 */
async function collect(rangeId: DutyRangeId): Promise<DutyData> {
  const range = dutyRange(rangeId);
  const day = beijingDayWindow();
  const month = day.date.slice(0, 7);
  const w7 = daysAgoWindow(7);
  const w1 = daysAgoWindow(1);

  const employeesP = load(fetchEmployees);
  const statsP = load(fetchEmployeeStats);
  // 统计与趋势改吃 workbench 读模型：KPI 与时间序列由 BFF 聚合。
  const todayStatsP = load(async () => summaryStats(await fetchWorkbenchSummary("1d")));
  const stats14P = load(async () =>
    timeseriesStats(trimTimeseries(await fetchWorkbenchTimeseries({ range: range.tsRange, bucket: "day" }), range.days)),
  );
  const activityP = load(() => fetchActivity(range.weeks));
  // 待审队列一次取数给两张卡：计数与前三行同源。
  const queue = fetchWorkbenchQueue();
  const approvalStatsP = load(() => queue.then(queueStats));
  const approvalsP = load(() => queue.then(queueApprovals));
  const todayRunsP = load(() => fetchRuns(3, day.from));
  const recentRunsP = load(() => fetchRuns(3, w7.from));
  const failedRunsP = load(() => fetchRuns(3, w1.from, "failed"));
  const blockedTasksP = load(() => fetchBlockedTasks(3));

  const employees = await employeesP;
  let budgetDay: Loadable<BudgetBody>;
  let budgetMonth: Loadable<BudgetBody>;
  let readiness: Loadable<ReadinessEvidence>;
  const emptyEvidence = (knowledgeWired: boolean): ReadinessEvidence => ({
    stations: {},
    configs: {},
    approvals: { k: "ready", data: [] },
    knowledge: {
      k: "ready",
      data: knowledgeWired ? { wired: true, count: 0, asOf: null } : { wired: false, count: null, asOf: null },
    },
  });
  if (employees.k === "error") {
    budgetDay = asError<BudgetBody>(employees);
    budgetMonth = asError<BudgetBody>(employees);
    readiness = asError<ReadinessEvidence>(employees);
  } else if (employees.k !== "ready" || employees.data.length === 0) {
    const empty: Loadable<BudgetBody> = {
      k: "ready",
      data: { items: [], missingEmployeeIds: [] },
    };
    budgetDay = empty;
    budgetMonth = empty;
    // 目录为空：没有分母行可判，证据面留空（不编造知识读口状态）。
    readiness = { k: "ready", data: emptyEvidence(false) };
  } else {
    const ids = employees.data.map((e) => e.employeeId);
    const denomIds = employees.data
      .filter((e) => DENOMINATOR_STATES.has(e.lifecycleState ?? "active"))
      .map((e) => e.employeeId);
    [budgetDay, budgetMonth, readiness] = await Promise.all([
      load(() => fetchBudget(ids, "day", day.date)),
      load(() => fetchBudget(ids, "month", month)),
      load(() => fetchReadinessEvidence(denomIds)),
    ]);
  }

  const [
    stats,
    todayStats,
    stats14,
    activity,
    approvalStats,
    approvals,
    todayRuns,
    recentRuns,
    failedRuns,
    blockedTasks,
  ] = await Promise.all([
    statsP,
    todayStatsP,
    stats14P,
    activityP,
    approvalStatsP,
    approvalsP,
    todayRunsP,
    recentRunsP,
    failedRunsP,
    blockedTasksP,
  ]);

  return {
    employees,
    stats,
    todayStats,
    stats14,
    activity,
    budgetDay,
    budgetMonth,
    approvalStats,
    approvals,
    todayRuns,
    recentRuns,
    failedRuns,
    blockedTasks,
    readiness,
  };
}

/**
 * One refresh retries every card. Cards are independent: one failed endpoint
 * never blanks another card, and no card invents a zero for missing data.
 */
export function useDutyData(rangeId: DutyRangeId = DEFAULT_DUTY_RANGE): {
  data: DutyData;
  reload: () => void;
  loading: boolean;
  refreshState: DutyRefresh;
} {
  const [nonce, setNonce] = useState(0);
  const [data, setData] = useState<DutyData>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshAt, setRefreshAt] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<DutyRefresh["refreshError"]>(null);
  const [refreshDelta, setRefreshDelta] = useState<DutyDelta | null>(null);
  const dataRef = useRef<DutyData>(initial());
  const busyRef = useRef(false);
  const versionRef = useRef(0);
  // Range changes bring their own generation counter: a late answer from the
  // previous window must never paint over the new one.
  const rangeRef = useRef<DutyRangeId>(rangeId);
  const rangeVersionRef = useRef(0);
  const mountedRef = useRef(false);
  rangeRef.current = rangeId;

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    let alive = true;
    setData(initial());
    setRefreshDelta(null);
    void collect(rangeRef.current).then((batch) => {
      if (alive) setData(batch);
    });
    return () => {
      alive = false;
    };
  }, [nonce]);

  // Switching the range re-reads only the two readers whose answer depends on
  // it. Everything else in the batch (directory, staff stats, queue, month
  // ledger, runs, tasks) keeps what it already read.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const version = ++rangeVersionRef.current;
    // A refresh still in flight belongs to the old window: drop it whole.
    versionRef.current += 1;
    busyRef.current = false;
    setRefreshing(false);
    setRefreshError(null);
    setRefreshDelta(null);
    setRefreshAt(null);
    setRefreshDelta(null);
    setData((prev) => ({ ...prev, stats14: loading(), activity: loading() }));
    void Promise.all([
      load(async () => {
        const range = dutyRange(rangeId);
        return timeseriesStats(trimTimeseries(await fetchWorkbenchTimeseries({ range: range.tsRange, bucket: "day" }), range.days));
      }),
      load(() => fetchActivity(dutyRange(rangeId).weeks)),
    ]).then(([stats14, activity]) => {
      if (version !== rangeVersionRef.current) return;
      setData((prev) => ({ ...prev, stats14, activity }));
    });
  }, [rangeId]);

  const refresh = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    setRefreshing(true);
    setRefreshError(null);
    setRefreshDelta(null);
    const before = dataRef.current;
    const version = versionRef.current;
    void collect(rangeRef.current).then((batch) => {
      // A cancelled batch must not write a stale screen or a read stamp.
      if (version !== versionRef.current) return;
      setData((prev) => ({ ...prev, ...batch }));
      // A failed card drops out of the comparison (it reads as missing, not 0),
      // the cards that did answer still report their change.
      setRefreshDelta(diffDuty(before, batch));
      const failed = Object.values(batch).find(
        (v): v is Extract<Loadable<unknown>, { k: "error" }> => v.k === "error",
      );
      if (failed) {
        setRefreshError({ message: failed.message, requestId: failed.requestId });
      } else {
        setRefreshAt(new Date().toISOString());
      }
      busyRef.current = false;
      setRefreshing(false);
    });
  }, []);

  const cancelRefresh = useCallback(() => {
    versionRef.current += 1;
    busyRef.current = false;
    setRefreshing(false);
    setRefreshError(null);
    setRefreshDelta(null);
  }, []);

  const reload = useCallback(() => {
    cancelRefresh();
    setNonce((n) => n + 1);
  }, [cancelRefresh]);

  const loadingAny = Object.values(data).some((v) => v.k === "loading");
  return {
    data,
    reload,
    loading: loadingAny,
    refreshState: { refreshing, refreshAt, refreshError, refreshDelta, refresh, cancelRefresh },
  };
}