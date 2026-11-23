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
import { DUTY_REFRESH_MIN_INTERVAL_MS } from "./dutyGates";
import { DEFAULT_DUTY_RANGE, dutyRange, type DutyRangeId } from "./dutyRange";
import type { ForcedState } from "./usage";
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

/** 页面上每一条可独立重试的卡腿。retryLeg 与 health chip 都按这个名单点名。 */
export type DutyLegKey = keyof DutyData;

/**
 * OM-04④：本页读取的消费者开关。activity 只在有活动热力可渲染的消费面上
 * 才请求；默认（不传）为请求，DutyPage 因此保持原行为逐字不变。
 */
export interface DutyReadOpts {
  activity?: boolean;
}

const LEG_KEYS: readonly DutyLegKey[] = [
  "employees",
  "stats",
  "todayStats",
  "stats14",
  "activity",
  "budgetDay",
  "budgetMonth",
  "approvalStats",
  "approvals",
  "todayRuns",
  "recentRuns",
  "failedRuns",
  "blockedTasks",
  "readiness",
];

/**
 * 依赖员工目录先回答的腿：目录本身没回答时「原请求」根本不存在，
 * 这时单卡重试如实退成整批重读（重试的不是一个没发过的请求）。
 */
const DEPENDENT_LEGS: readonly DutyLegKey[] = ["budgetDay", "budgetMonth", "readiness"];

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
  /**
   * DU-06①：上一批全量读已经读完，但距今还没到 `DUTY_REFRESH_MIN_INTERVAL_MS`。
   * 窗口内的刷新点击一条请求都不发，界面用 aria-disabled＋原因句说明为什么。
   */
  cooling: boolean;
  /** Read time of the last successful batch; never a data time. */
  refreshAt: string | null;
  refreshError: { message: string; requestId: string | null } | null;
  /** Card-by-card changes between the last two batches; null until a refresh succeeds. */
  refreshDelta: DutyDelta | null;
  refresh: () => void;
  cancelRefresh: () => void;
  /**
   * DU-05②：单卡错误重试＝重发这些腿的**原请求**（同 URL、同参数），只更新
   * 点名的卡，其余卡保留既有读数。队列一次请求喂两卡：重试任一格都重发那
   * 一条 queue 请求并同时回填两卡（与首读同一形状，不多发一条）。
   */
  retryLegs: (keys: readonly DutyLegKey[]) => void;
  /** 本页此刻是 `?state=` 复现腿：不发起任何真实请求（与 usage 同纪律）。 */
  forced: boolean;
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
  return { k: "error", status: leg.status, message: leg.message, requestId: leg.requestId, notWired: leg.notWired };
}

/** 行页 → 卡用的行数组（消费面形状不变）；错误腿原样透传，不降级成空数组。 */
function rowsLeg<T>(leg: Loadable<RowPage<T>>): Loadable<T[]> {
  return leg.k === "ready" ? { k: "ready", data: leg.data.rows } : leg;
}

/** 行页 → 服务端真给行数；这一腿没回答就是 NO_COUNT（N=null → 屏上「数量未提供」）。 */
function countOf<T>(leg: Loadable<RowPage<T>>): ServerRowCount {
  return leg.k === "ready" ? leg.data.count : NO_COUNT;
}

/** 首读相：还没人回答目录时的空依赖（budget/readiness 这一相不会被调用）。 */
interface LegDeps {
  employeeIds: string[];
  denominatorIds: string[];
}

/**
 * 单腿「原请求」的唯一出处：collect 首读与 retryLegs 重试都从这张表取闭包，
 * 保证重试重发的就是原请求（同 URL、同参数、同窗口推导），不存在第二套拼法。
 * OM-04④：activity 的消费者开关也挂在这张表上，于是首读与单卡重试走的是
 * 同一条受开关约束的路，不会出现「首读不发、重试却发」的第二套走法。
 */
function legRequests(rangeId: DutyRangeId, deps: LegDeps, opts: DutyReadOpts = {}) {
  const range = dutyRange(rangeId);
  const wantActivity = opts.activity !== false;
  const day = beijingDayWindow();
  const month = day.date.slice(0, 7);
  const w7 = daysAgoWindow(7);
  const w1 = daysAgoWindow(1);
  return {
    employees: () => load(fetchEmployees),
    stats: () => load(fetchEmployeeStats),
    // 统计与趋势改吃 workbench 读模型：KPI 与时间序列由 BFF 聚合。
    todayStats: () => load(async () => summaryStats(await fetchWorkbenchSummary("1d"))),
    stats14: () =>
      load(async () =>
        timeseriesStats(trimTimeseries(await fetchWorkbenchTimeseries({ range: range.tsRange, bucket: "day" }), range.days)),
      ),
    // OM-04④：关掉时不发请求，停在「loading」这个未发起的中性占位上。
    activity: () =>
      wantActivity
        ? load(() => fetchActivity(range.weeks))
        : Promise.resolve({ k: "loading" } as Loadable<ActivityBody>),
    budgetDay: () => load(() => fetchBudget(deps.employeeIds, "day", day.date)),
    budgetMonth: () => load(() => fetchBudget(deps.employeeIds, "month", month)),
    readiness: () => load(() => fetchReadinessEvidence(deps.denominatorIds)),
    todayRuns: () => load(() => fetchRuns(DUTY_RUNS_PAGE_LIMIT, day.from)),
    recentRuns: () => load(() => fetchRuns(DUTY_RUNS_PAGE_LIMIT, w7.from)),
    failedRuns: () => load(() => fetchRuns(DUTY_RUNS_PAGE_LIMIT, w1.from, "failed")),
    blockedTasks: () => load(() => fetchBlockedTasks(3)),
  };
}

const NO_DEPS: LegDeps = { employeeIds: [], denominatorIds: [] };

/** 行页腿（重试时要顺带回填服务端真行数）：目录与今日运行。 */
function isRowsCountLeg(key: DutyLegKey): boolean {
  return key === "employees" || key === "todayRuns";
}

/**
 * 一批里第一条没回答的腿。首读与手动刷共用同一个判据：有腿失败就不记读取时刻
 * （DU-06②「失败时不更新」），谁也不另定一套「算不算成功」。
 */
function failedLeg(batch: DutyData): Extract<Loadable<unknown>, { k: "error" }> | undefined {
  return Object.values(batch).find(
    (v): v is Extract<Loadable<unknown>, { k: "error" }> => v.k === "error",
  );
}

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

/**
 * DU-05③：`?state=` 四态复现批。只画形制，不发真实请求（与 usage 的复现腿
 * 同纪律）；error/denied 的措辞分开钉——denied 是「无权限」，不是「失败」，
 * 更不是「未接入」；请求号一律 null（复现腿没发过请求，不能假装有编号）。
 */
function forcedBatch(state: ForcedState): DutyData {
  if (state === "loading") return initial();
  if (state === "empty") {
    return {
      employees: { k: "ready", data: [] },
      stats: { k: "ready", data: {} },
      todayStats: { k: "ready", data: {} },
      stats14: { k: "ready", data: {} },
      activity: { k: "ready", data: {} },
      budgetDay: { k: "ready", data: { items: [], missingEmployeeIds: [] } },
      budgetMonth: { k: "ready", data: { items: [], missingEmployeeIds: [] } },
      approvalStats: { k: "ready", data: {} },
      approvals: { k: "ready", data: [] },
      todayRuns: { k: "ready", data: [] },
      recentRuns: { k: "ready", data: [] },
      failedRuns: { k: "ready", data: [] },
      blockedTasks: { k: "ready", data: [] },
      readiness: { k: "ready", data: emptyEvidence(false) },
    };
  }
  const leg: Loadable<unknown> =
    state === "error"
      ? {
          k: "error",
          status: 500,
          message: "这条腿是用 ?state=error 复现的，服务此刻没有回答过；复现腿不发起真实请求。",
          requestId: null,
        }
      : {
          k: "error",
          status: 403,
          message: "你没有查看这块数据的权限（这条腿是用 ?state=denied 复现的，服务此刻没有回答过）。",
          requestId: null,
        };
  return Object.fromEntries(LEG_KEYS.map((k) => [k, leg])) as unknown as DutyData;
}

/**
 * One read of every card, started together and returned as one batch.
 * Cards are independent: a failed endpoint yields an error for that card only.
 * OM-04④：activity 腿加消费者开关——总览没有活动热力可渲染，默认不请求；
 * 关掉时 data.activity 停在「loading」这个未发起请求的中性占位上（总览的
 * 空态/错误态/截至行只数 coreStates 与 stats14，从不消费它），DutyPage 走
 * 默认档行为逐字不变。开关经 legRequests 同一张表生效，重试与首读同路。
 * DU-02：返回 { batch, counts }，counts 为三卡服务端真数（N 只从这里来）。
 */
async function collect(rangeId: DutyRangeId, opts: DutyReadOpts = {}): Promise<{ batch: DutyData; counts: DutyCounts }> {
  const reqs = legRequests(rangeId, NO_DEPS, opts);

  const employeesPageP = reqs.employees();
  const statsP = reqs.stats();
  const todayStatsP = reqs.todayStats();
  const stats14P = reqs.stats14();
  const activityP = reqs.activity();
  // 待审队列一次取数给两张卡：计数与前三行同源。
  const queue = fetchWorkbenchQueue();
  const approvalStatsP = load(() => queue.then(queueStats));
  const approvalsP = load(() => queue.then(queueApprovals));
  const todayRunsPageP = reqs.todayRuns();
  const recentRunsPageP = reqs.recentRuns();
  const failedRunsPageP = reqs.failedRuns();
  const blockedTasksP = reqs.blockedTasks();

  const employeesPage = await employeesPageP;
  const employees = rowsLeg(employeesPage);
  let budgetDay: Loadable<BudgetBody>;
  let budgetMonth: Loadable<BudgetBody>;
  let readiness: Loadable<ReadinessEvidence>;
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
    const withIds = legRequests(rangeId, { employeeIds: ids, denominatorIds: denomIds }, opts);
    [budgetDay, budgetMonth, readiness] = await Promise.all([
      withIds.budgetDay(),
      withIds.budgetMonth(),
      withIds.readiness(),
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
  opts: DutyReadOpts = {},
  forced: ForcedState | null = null,
): {
  data: DutyData;
  counts: DutyCounts;
  reload: () => void;
  loading: boolean;
  refreshState: DutyRefresh;
} {
  const [nonce, setNonce] = useState(0);
  const [data, setData] = useState<DutyData>(() => (forced !== null ? forcedBatch(forced) : initial()));
  const [counts, setCounts] = useState<DutyCounts>(EMPTY_DUTY_COUNTS);
  const [refreshing, setRefreshing] = useState(false);
  const [cooling, setCooling] = useState(false);
  const [refreshAt, setRefreshAt] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<DutyRefresh["refreshError"]>(null);
  const [refreshDelta, setRefreshDelta] = useState<DutyDelta | null>(null);
  const dataRef = useRef<DutyData>(forced !== null ? forcedBatch(forced) : initial());
  const busyRef = useRef(false);
  const versionRef = useRef(0);
  // Range changes bring their own generation counter: a late answer from the
  // previous window must never paint over the new one.
  const rangeRef = useRef<DutyRangeId>(rangeId);
  const rangeVersionRef = useRef(0);
  const mountedRef = useRef(false);
  // DU-06③：一整批全量读（首读或手动刷新）的代号。同一时刻只允许一批活着，
  // 晚到的上一批既不写屏也不放锁——锁归最新那批解。
  const batchSeqRef = useRef(0);
  // DU-06①：上一批**读成功**的全量读起点。节流窗口从这里算，没读到东西的
  // 失败批不开窗口（失败后的「再试」是出路，不能被窗口挡住）。
  const lastBatchStartRef = useRef(0);
  const cooldownTimerRef = useRef<number | null>(null);
  // DU-05②：正在单腿重试的卡名。同一腿的重试不叠加，批次刷新在飞时也不另发。
  const retryingRef = useRef<Set<DutyLegKey>>(new Set());
  const forcedRef = useRef(forced);
  const wantActivityRef = useRef(opts.activity !== false);
  rangeRef.current = rangeId;
  forcedRef.current = forced;
  wantActivityRef.current = opts.activity !== false;

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const clearCooldown = useCallback(() => {
    if (cooldownTimerRef.current !== null) {
      window.clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    lastBatchStartRef.current = 0;
    setCooling(false);
  }, []);

  /**
   * DU-06①：一批**读成功**后开节流窗口。窗口从这批的起点算起，所以落地时只剩
   * `间隔 − 批耗时`；已经过完就干脆不开（下一次点照常发）。失败批不开窗口——
   * 失败后的「再试」是出路，不能自己被门挡住。
   */
  const armCooldown = useCallback((startedAt: number) => {
    const remaining = DUTY_REFRESH_MIN_INTERVAL_MS - (Date.now() - startedAt);
    if (remaining <= 0) return;
    lastBatchStartRef.current = startedAt;
    setCooling(true);
    if (cooldownTimerRef.current !== null) window.clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = window.setTimeout(() => {
      cooldownTimerRef.current = null;
      setCooling(false);
    }, remaining);
  }, []);

  // 卸载收掉定时器：窗口不该在页面没了之后还点着 state。
  useEffect(() => () => {
    if (cooldownTimerRef.current !== null) window.clearTimeout(cooldownTimerRef.current);
  }, []);

  useEffect(() => {
    let alive = true;
    setRefreshAt(null);
    setRefreshError(null);
    if (forced !== null) {
      // 复现腿：不读服务，形制直接落屏（真实请求一条都不发）。
      setData(forcedBatch(forced));
      setCounts(EMPTY_DUTY_COUNTS);
      setRefreshDelta(null);
      return () => {
        alive = false;
      };
    }
    setData(initial());
    setCounts(EMPTY_DUTY_COUNTS);
    setRefreshDelta(null);
    clearCooldown();
    // DU-06③：首读也是一整批全量读，占住同一把单飞锁。原实现只锁手动刷新，
    // 首读还在飞时点刷新会再起一批 ⇒ mount 期间并发两遍全量读。
    const seq = ++batchSeqRef.current;
    busyRef.current = true;
    // OM-04④：首读同样经带消费者开关的新签名，与手动刷新/重试同一条路。
    void collect(rangeRef.current, { activity: wantActivityRef.current }).then(({ batch, counts: next }) => {
      // 被更新的一批取代：既不写屏，也不替那一批解锁（锁归最新一批）。
      if (seq !== batchSeqRef.current) return;
      busyRef.current = false;
      if (!alive) return;
      setData(batch);
      setCounts(next);
    });
    return () => {
      alive = false;
    };
  }, [nonce, forced, clearCooldown]);

  // Switching the range re-reads only the two readers whose answer depends on
  // it. Everything else in the batch (directory, staff stats, queue, month
  // ledger, runs, tasks) keeps what it already read.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (forced !== null) {
      // 复现态下切窗口只重画形制，不发真实请求。
      setData(forcedBatch(forced));
      return;
    }
    const version = ++rangeVersionRef.current;
    // A refresh still in flight belongs to the old window: drop it whole.
    versionRef.current += 1;
    busyRef.current = false;
    // 那一批被作废了，它欠的节流窗口也不该继续挡用户——窗口只属于真读到的一批。
    clearCooldown();
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
  }, [rangeId, forced]);

  const refresh = useCallback(() => {
    if (forcedRef.current !== null) return; // 复现腿不发真实请求
    if (busyRef.current) return; // 单飞锁：这一批还没落地
    // DU-06①：最小间隔——上一批读成功到现在不足窗口，这一条请求根本不发。
    if (Date.now() - lastBatchStartRef.current < DUTY_REFRESH_MIN_INTERVAL_MS) return;
    busyRef.current = true;
    setRefreshing(true);
    setRefreshError(null);
    setRefreshDelta(null);
    const startedAt = Date.now();
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
      const failed = failedLeg(batch);
      if (failed) {
        setRefreshError({ message: failed.message, requestId: failed.requestId });
      } else {
        // DU-06②：只有整批没失败才记真实读取时刻；失败批保留上一批的时刻（不更新）。
        setRefreshAt(new Date().toISOString());
        // DU-06①：读到东西的这批开窗口；失败批不开，「再试」立刻可用。
        armCooldown(startedAt);
      }
      busyRef.current = false;
      setRefreshing(false);
    });
  }, [armCooldown]);

  const cancelRefresh = useCallback(() => {
    versionRef.current += 1;
    busyRef.current = false;
    clearCooldown();
    setRefreshing(false);
    setRefreshError(null);
    setRefreshDelta(null);
  }, [clearCooldown]);

  const reload = useCallback(() => {
    cancelRefresh();
    setNonce((n) => n + 1);
  }, [cancelRefresh]);

  /**
   * DU-05②：单卡错误重试＝重发这些腿的原请求（legRequests 同一张表），只回写
   * 点名卡，其余卡保留既有读数。约定：
   * - 队列腿（approvalStats/approvals）一次请求喂两卡，重试整对重发那一条；
   * - 依赖目录的腿（budget/readiness）在目录没回答时「原请求」本就不存在，
   *   如实退成整批重读，不假装发过一条没发过的请求；
   * - 复现腿与在飞批次期间一律不发（刷新已经涵盖重试）。
   */
  const retryLegs = useCallback(
    (keys: readonly DutyLegKey[]) => {
      if (forcedRef.current !== null) return;
      if (busyRef.current) return;
      const prev = dataRef.current;
      const queuePair = keys.includes("approvalStats") || keys.includes("approvals");
      const targets = new Set<DutyLegKey>(queuePair ? ["approvalStats", "approvals"] : keys);
      for (const k of [...targets]) if (retryingRef.current.has(k)) targets.delete(k);
      if (queuePair && (retryingRef.current.has("approvalStats") || retryingRef.current.has("approvals"))) {
        targets.delete("approvalStats");
        targets.delete("approvals");
      }
      if (targets.size === 0) return;
      if ([...targets].some((k) => DEPENDENT_LEGS.includes(k)) && prev.employees.k !== "ready") {
        reload();
        return;
      }
      const version = rangeVersionRef.current;
      for (const k of targets) retryingRef.current.add(k);
      setData((p) => {
        const next = { ...p } as Record<DutyLegKey, unknown>;
        for (const k of targets) next[k] = loading();
        return next as unknown as DutyData;
      });
      const ids = prev.employees.k === "ready" ? prev.employees.data.map((e) => e.employeeId) : [];
      const denomIds =
        prev.employees.k === "ready"
          ? prev.employees.data
              .filter((e) => DENOMINATOR_STATES.has(e.lifecycleState ?? "active"))
              .map((e) => e.employeeId)
          : [];
      // OM-04④：重试与首读共用同一张受开关约束的表，关掉的腿不会被重试点亮。
      const reqs = legRequests(rangeRef.current, { employeeIds: ids, denominatorIds: denomIds }, {
        activity: wantActivityRef.current,
      });
      const done = () => {
        for (const k of targets) retryingRef.current.delete(k);
      };
      void (async () => {
        const patch: Record<string, Loadable<unknown>> = {};
        const rowCounts: Partial<DutyCounts> = {};
        const queue = targets.has("approvalStats") ? fetchWorkbenchQueue() : null;
        const jobs: Array<Promise<void>> = [];
        for (const k of targets) {
          if (k === "approvals") {
            if (queue) jobs.push(load(() => queue.then(queueApprovals)).then((leg) => void (patch[k] = leg)));
            continue;
          }
          if (k === "approvalStats") {
            if (queue) jobs.push(load(() => queue.then(queueStats)).then((leg) => void (patch[k] = leg)));
            continue;
          }
          jobs.push(
            (reqs[k as Exclude<DutyLegKey, "approvalStats" | "approvals">] as () => Promise<Loadable<unknown>>)().then(
              (raw) => {
                if (isRowsCountLeg(k)) {
                  patch[k] = rowsLeg(raw as Loadable<RowPage<never>>);
                  rowCounts[k as keyof DutyCounts] = countOf(raw as Loadable<RowPage<never>>);
                } else {
                  patch[k] = raw;
                }
              },
            ),
          );
        }
        await Promise.all(jobs);
        done();
        if (version !== rangeVersionRef.current) return;
        setData((p) => ({ ...p, ...patch }) as DutyData);
        if (rowCounts.employees !== undefined || rowCounts.todayRuns !== undefined) {
          setCounts((c) => ({ ...c, ...rowCounts }));
        }
      })();
    },
    [reload],
  );

  const loadingAny = Object.values(data).some((v) => v.k === "loading");
  return {
    data,
    counts,
    reload,
    loading: loadingAny,
    refreshState: {
      refreshing,
      cooling,
      refreshAt,
      refreshError,
      refreshDelta,
      refresh,
      cancelRefresh,
      retryLegs,
      forced: forced !== null,
    },
  };
}