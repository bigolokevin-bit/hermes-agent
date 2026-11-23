import { useCallback, useEffect, useRef, useState } from "react";
import {
  DUTY_RUNS_PAGE_LIMIT,
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
import { NO_COUNT, type ServerRowCount } from "./dutySlots";
import type { RowPage } from "./api";
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

/**
 * DU-02①：三卡「查看全部 (N)」的 N 只来自这里——服务端响应真带回的行数。
 * 走 hook 的旁路返回值而不是 DutyData：overview 等消费面对 DutyData 做
 * `Object.values(...).k` 扫描，塞一个非卡腿进去会污染它们的失败/加载判定。
 */
export interface DutyCounts {
  employees: ServerRowCount;
  todayRuns: ServerRowCount;
}

const EMPTY_DUTY_COUNTS: DutyCounts = {
  employees: NO_COUNT,
  todayRuns: NO_COUNT,
};

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

/** 行页 → 卡用的行数组（消费面形状不变）；错误腿原样透传，不降级成空数组。 */
function rowsLeg<T>(leg: Loadable<RowPage<T>>): Loadable<T[]> {
  return leg.k === "ready" ? { k: "ready", data: leg.data.rows } : leg;
}

/** 行页 → 服务端真给行数；这一腿没回答就是 NO_COUNT（N=null → 屏上「数量未提供」）。 */
function countOf<T>(leg: Loadable<RowPage<T>>): ServerRowCount {
  return leg.k === "ready" ? leg.data.count : NO_COUNT;
}

/**
 * One read of every card, started together and returned as one batch.
 * Cards are independent: a failed endpoint yields an error for that card only.
 */
/**
 * 一次性读取本页所有卡片。OM-04④：activity 腿加消费者开关——总览没有
 * 活动热力可渲染，默认不请求；关掉时 data.activity 停在「loading」这个
 * 未发起请求的中性占位上（总览的空态/错误态/截至行只数 coreStates 与
 * stats14，从不消费它），DutyPage 走默认档行为逐字不变。
 * DU-02：返回 { batch, counts }，counts 为三卡服务端真数（N 只从这里来）。
 */
async function collect(rangeId: DutyRangeId, opts: { activity?: boolean } = {}): Promise<{ batch: DutyData; counts: DutyCounts }> {
  const range = dutyRange(rangeId);
  const wantActivity = opts.activity !== false;
  const day = beijingDayWindow();
  const month = day.date.slice(0, 7);
  const w7 = daysAgoWindow(7);
  const w1 = daysAgoWindow(1);

  const employeesPageP = load(fetchEmployees);
  const statsP = load(fetchEmployeeStats);
  // 统计与趋势改吃 workbench 读模型：KPI 与时间序列由 BFF 聚合。
  const todayStatsP = load(async () => summaryStats(await fetchWorkbenchSummary("1d")));
  const stats14P = load(async () =>
    timeseriesStats(trimTimeseries(await fetchWorkbenchTimeseries({ range: range.tsRange, bucket: "day" }), range.days)),
  );
  const activityP = wantActivity
    ? load(() => fetchActivity(range.weeks))
    : Promise.resolve({ k: "loading" } as Loadable<ActivityBody>);
  // 待审队列一次取数给两张卡：计数与前三行同源。
  const queue = fetchWorkbenchQueue();
  const approvalStatsP = load(() => queue.then(queueStats));
  const approvalsP = load(() => queue.then(queueApprovals));
  const todayRunsPageP = load(() => fetchRuns(DUTY_RUNS_PAGE_LIMIT, day.from));
  const recentRunsPageP = load(() => fetchRuns(DUTY_RUNS_PAGE_LIMIT, w7.from));
  const failedRunsPageP = load(() => fetchRuns(DUTY_RUNS_PAGE_LIMIT, w1.from, "failed"));
  const blockedTasksP = load(() => fetchBlockedTasks(3));

  const employeesPage = await employeesPageP;
  const employees = rowsLeg(employeesPage);
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
    coverage: { covered: 0, requested: 0 },
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
    todayRunsPage,
    recentRunsPage,
    failedRunsPage,
    blockedTasks,
  ] = await Promise.all([
    statsP,
    todayStatsP,
    stats14P,
    activityP,
    approvalStatsP,
    approvalsP,
    todayRunsPageP,
    recentRunsPageP,
    failedRunsPageP,
    blockedTasksP,
  ]);

  return {
    batch: {
      employees,
      stats,
      todayStats,
      stats14,
      activity,
      budgetDay,
      budgetMonth,
      approvalStats,
      approvals,
      todayRuns: rowsLeg(todayRunsPage),
      recentRuns: rowsLeg(recentRunsPage),
      failedRuns: rowsLeg(failedRunsPage),
      blockedTasks,
      readiness,
    },
    counts: {
      employees: countOf(employeesPage),
      todayRuns: countOf(todayRunsPage),
    },
  };
}

/**
 * One refresh retries every card. Cards are independent: one failed endpoint
 * never blanks another card, and no card invents a zero for missing data.
 */
export function useDutyData(
  rangeId: DutyRangeId = DEFAULT_DUTY_RANGE,
  opts: { activity?: boolean } = {},
): {
  data: DutyData;
  counts: DutyCounts;
  reload: () => void;
  loading: boolean;
  refreshState: DutyRefresh;
} {
  const [nonce, setNonce] = useState(0);
  const [data, setData] = useState<DutyData>(initial);
  const [counts, setCounts] = useState<DutyCounts>(EMPTY_DUTY_COUNTS);
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
  const wantActivityRef = useRef(opts.activity !== false);
  wantActivityRef.current = opts.activity !== false;

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    let alive = true;
    setData(initial());
    setCounts(EMPTY_DUTY_COUNTS);
    setRefreshDelta(null);
    void collect(rangeRef.current, { activity: wantActivityRef.current }).then(({ batch, counts: next }) => {
      if (alive) {
        setData(batch);
        setCounts(next);
      }
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
    const wantActivity = wantActivityRef.current;
    setData((prev) => ({ ...prev, stats14: loading(), ...(wantActivity ? { activity: loading() as DutyData["activity"] } : {}) }));
    void Promise.all([
      load(async () => {
        const range = dutyRange(rangeId);
        return timeseriesStats(trimTimeseries(await fetchWorkbenchTimeseries({ range: range.tsRange, bucket: "day" }), range.days));
      }),
      wantActivity ? load(() => fetchActivity(dutyRange(rangeId).weeks)) : null,
    ]).then(([stats14, activity]) => {
      if (version !== rangeVersionRef.current) return;
      // 关掉的腿不重画：上一次的值（或占位）原样留在原处。
      setData((prev) => ({ ...prev, stats14, ...(activity ? { activity } : {}) }));
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
    void collect(rangeRef.current, { activity: wantActivityRef.current }).then(({ batch, counts: next }) => {
      // A cancelled batch must not write a stale screen or a read stamp.
      if (version !== versionRef.current) return;
      setData((prev) => ({ ...prev, ...batch }));
      setCounts(next);
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
    counts,
    reload,
    loading: loadingAny,
    refreshState: { refreshing, refreshAt, refreshError, refreshDelta, refresh, cancelRefresh },
  };
}