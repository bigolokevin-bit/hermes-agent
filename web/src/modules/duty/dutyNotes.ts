/**
 * 值班台读口清单块（duty-notes）的数据源（单一常量，页面只渲染这一份，不另写第二套文案）。
 * 每行四段：区块名 · 实际读口路径 · 时间窗/计算范围 · 缺值策略。
 * DU-08①·D7：这一段「是什么」的解释句已收进 glossary duty.notes，屏上只留清单本体。
 */
export type DutyNote = {
  key: string;
  area: string;
  path: string;
  scope: string;
  missing: string;
};

const MISSING_COMMON = "缺值显示「—」，不当 0";
const ASOF_POLICY = "采集时刻只取上游返回的时间，缺失显示「—」，不拿本机时间顶替";

export const DUTY_NOTES: DutyNote[] = [
  {
    key: "today-runs",
    area: "今日运行",
    path: "workbench/summary?range=1d（BFF 聚合的一日运行数 KPI）；卡内最近几条另读 /api/runs?since=今日&limit=3",
    scope: "今日 00:00 起（北京时间），合计取服务端窗口统计，不是本页相加",
    missing: `${MISSING_COMMON}；${ASOF_POLICY}`,
  },
  {
    key: "trend",
    area: "趋势",
    path: "workbench/timeseries?range=<当前时间范围>&bucket=day",
    scope: "当前所选范围（24 小时 / 7 天 / 14 天 / 30 天）逐日；摘要五项与表体来自同一批",
    missing: `缺读数的日期保留轴位并显示「—」，不当 0；整个区间没有读数时写「该区间没有运行记录」`,
  },
  {
    key: "readiness",
    area: "可上岗",
    path: "/api/employees?limit=100 + /api/employee-stats",
    scope: "当前员工目录与在岗 / 暂停 / 离职聚合；总数要求三项计数齐全",
    missing: `名单被截断或统计缺项时总数显示「—」，不当 0`,
  },
  {
    key: "cost",
    area: "成本",
    path: "/api/budget-usage?periodKind=day（及 periodKind=month）",
    scope: "今日 00:00 起账本实扣与本月累计，按员工日账/月账合计",
    missing: `没有实扣行时显示「—」，不按 0 记；${ASOF_POLICY}`,
  },
  {
    key: "recent-runs",
    area: "最近运行",
    path: "/api/runs?since=近 7 天&limit=3",
    scope: "最近若干条运行，用来看最近发生了什么，不是窗口合计",
    missing: `接口没返回时显示「—」与说明，不用空列表冒充「没有运行」`,
  },
  {
    key: "pending",
    area: "待我处理",
    path: "workbench/queue",
    scope: "当前排队待办的审批；计数与行来自同一批响应",
    missing: `审批源不可用时计数显示「—」并给出原因，不当 0、不当空队列`,
  },
  {
    key: "blockers",
    area: "阻塞",
    path: "/api/tasks?status=blocked&limit=3",
    scope: "当前阻塞任务与失败运行，各取最近 3 条",
    missing: MISSING_COMMON,
  },
  {
    key: "matrix",
    area: "矩阵",
    path: "/api/matrix?limit=50（上游 /v1/matrix/employees）",
    scope: "只读的能力与职权矩阵",
    missing: `上游未就绪时显示「未接入」，不回落样例数据；单格未知显示「待核实」，不猜授权`,
  },
];