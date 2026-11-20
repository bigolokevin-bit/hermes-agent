import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchActivity,
  fetchBlockedTasks,
  fetchBudget,
  fetchEmployeeStats,
  fetchEmployees,
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
} from "./workbench";
import { beijingDayWindow, daysAgoWindow } from "./format";
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
}

export interface DutyRefresh {
  refreshing: boolean;
  /** Read time of the last successful refresh; never a data time. */
  refreshAt: string | null;
  refreshError: { message: string; requestId: string | null } | null;
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
  };
}

function asError<T>(leg: Extract<Loadable<unknown>, { k: "error" }>): Loadable<T> {
  return { k: "error", status: leg.status, message: leg.message, requestId: leg.requestId };
}

/**
 * One read of every card, started together and returned as one batch.
 * Cards are independent: a failed endpoint yields an error for that card only.
 */
async function collect(): Promise<DutyData> {
  const day = beijingDayWindow();
  const month = day.date.slice(0, 7);
  const w7 = daysAgoWindow(7);
  const w1 = daysAgoWindow(1);

  const employeesP = load(fetchEmployees);
  const statsP = load(fetchEmployeeStats);
  // 统计与趋势改吃 workbench 读模型：KPI 与时间序列由 BFF 聚合。
  const todayStatsP = load(async () => summaryStats(await fetchWorkbenchSummary("1d")));
  const stats14P = load(async () =>
    timeseriesStats(await fetchWorkbenchTimeseries({ range: "14d", bucket: "day" })),
  );
  const activityP = load(() => fetchActivity(1));
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
  if (employees.k === "error") {
    budgetDay = asError<BudgetBody>(employees);
    budgetMonth = asError<BudgetBody>(employees);
  } else if (employees.k !== "ready" || employees.data.length === 0) {
    const empty: Loadable<BudgetBody> = {
      k: "ready",
      data: { items: [], missingEmployeeIds: [] },
    };
    budgetDay = empty;
    budgetMonth = empty;
  } else {
    const ids = employees.data.map((e) => e.employeeId);
    [budgetDay, budgetMonth] = await Promise.all([
      load(() => fetchBudget(ids, "day", day.date)),
      load(() => fetchBudget(ids, "month", month)),
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
  };
}

/**
 * One refresh retries every card. Cards are independent: one failed endpoint
 * never blanks another card, and no card invents a zero for missing data.
 */
export function useDutyData(): {
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
  const busyRef = useRef(false);
  const versionRef = useRef(0);

  useEffect(() => {
    let alive = true;
    setData(initial());
    void collect().then((batch) => {
      if (alive) setData(batch);
    });
    return () => {
      alive = false;
    };
  }, [nonce]);

  const refresh = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    setRefreshing(true);
    setRefreshError(null);
    const version = versionRef.current;
    void collect().then((batch) => {
      // A cancelled batch must not write a stale screen or a read stamp.
      if (version !== versionRef.current) return;
      setData((prev) => ({ ...prev, ...batch }));
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
    refreshState: { refreshing, refreshAt, refreshError, refresh, cancelRefresh },
  };
}