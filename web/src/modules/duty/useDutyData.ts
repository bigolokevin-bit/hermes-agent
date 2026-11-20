import { useCallback, useEffect, useState } from "react";
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

/**
 * One refresh retries every card. Cards are independent: one failed endpoint
 * never blanks another card, and no card invents a zero for missing data.
 */
export function useDutyData(): { data: DutyData; reload: () => void; loading: boolean } {
  const [nonce, setNonce] = useState(0);
  const [data, setData] = useState<DutyData>(initial);

  useEffect(() => {
    let alive = true;
    setData(initial());
    const day = beijingDayWindow();
    const month = day.date.slice(0, 7);
    const w7 = daysAgoWindow(7);
    const w1 = daysAgoWindow(1);

    const employeesP = load(fetchEmployees);
    void Promise.all([
      employeesP.then((employees) => {
        if (!alive) return;
        void (async () => {
          if (employees.k === "error") {
            if (alive) setData((d) => ({ ...d, budgetDay: employees, budgetMonth: employees }));
            return;
          }
          if (employees.k !== "ready" || employees.data.length === 0) {
            const empty: Loadable<BudgetBody> = {
              k: "ready",
              data: { items: [], missingEmployeeIds: [] },
            };
            if (alive) setData((d) => ({ ...d, budgetDay: empty, budgetMonth: empty }));
            return;
          }
          const ids = employees.data.map((e) => e.employeeId);
          const [bd, bm] = await Promise.all([
            load(() => fetchBudget(ids, "day", day.date)),
            load(() => fetchBudget(ids, "month", month)),
          ]);
          if (alive) setData((d) => ({ ...d, budgetDay: bd, budgetMonth: bm }));
        })();
      }),
      load(fetchEmployeeStats).then((v) => alive && setData((d) => ({ ...d, stats: v }))),
      // 统计与趋势改吃 workbench 读模型：KPI 与时间序列由 BFF 聚合，
      // 页面不再自己拼 /run-stats 的两个窗口。
      load(async () => summaryStats(await fetchWorkbenchSummary("1d"))).then(
        (v) => alive && setData((d) => ({ ...d, todayStats: v })),
      ),
      load(async () =>
        timeseriesStats(await fetchWorkbenchTimeseries({ range: "14d", bucket: "day" })),
      ).then((v) => alive && setData((d) => ({ ...d, stats14: v }))),
      load(() => fetchActivity(1)).then(
        (v) => alive && setData((d) => ({ ...d, activity: v })),
      ),
      // 待审队列一次取数给两张卡：计数与前三行同源，避免两处数字打架。
      (() => {
        const queue = fetchWorkbenchQueue();
        load(() => queue.then(queueStats)).then(
          (v) => alive && setData((d) => ({ ...d, approvalStats: v })),
        );
        load(() => queue.then(queueApprovals)).then(
          (v) => alive && setData((d) => ({ ...d, approvals: v })),
        );
      })(),
      load(() => fetchRuns(3, day.from)).then(
        (v) => alive && setData((d) => ({ ...d, todayRuns: v })),
      ),
      load(() => fetchRuns(3, w7.from)).then(
        (v) => alive && setData((d) => ({ ...d, recentRuns: v })),
      ),
      load(() => fetchRuns(3, w1.from, "failed")).then(
        (v) => alive && setData((d) => ({ ...d, failedRuns: v })),
      ),
      load(() => fetchBlockedTasks(3)).then(
        (v) => alive && setData((d) => ({ ...d, blockedTasks: v })),
      ),
    ]);
    employeesP.then((v) => alive && setData((d) => ({ ...d, employees: v })));
    return () => {
      alive = false;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const loadingAny = Object.values(data).some((v) => v.k === "loading");
  return { data, reload, loading: loadingAny };
}