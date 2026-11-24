/**
 * 示例租户构造数据集（2026-11-24）。
 *
 * 用途：给「示例租户页」提供与设计骨架 `console-v4-skeleton.html#/overview`
 * 同量级的稠密读数。⚠️ 这份数据**只允许**被示例租户路由读取；
 * 真租户（t_seakoi_pilot）页面任何读口拿不到值时必须显示 `—`，
 * 禁止 import 本文件、禁止把这里的数字当兜底（用户裁定 2026-11-24）。
 *
 * 数值取自骨架总览段的实测文本，保持 18 名员工 / 58 次运行 / $12.40 等
 * 「有生活痕迹」的量级，便于并排比对信息密度，不代表任何真实业务。
 */

export const DEMO_TENANT_LABEL = "示例租户";
export const DEMO_TENANT_AS_OF = "2026-11-18 14:32";
export const DEMO_TENANT_TIMEZONE = "Asia/Shanghai";

/** 可上岗卡：四门各自独立判定后取交集。 */
export const demoReadiness = {
  total: 18,
  ready: 12,
  restricted: 3,
  disabled: 3,
  restrictedBreakdown: [
    { reason: "预算", count: 1 },
    { reason: "模型回退", count: 1 },
    { reason: "权限收窄", count: 1 },
  ],
  gates: [
    { id: "V1", label: "群@", passed: 15, total: 18, missing: 3 },
    { id: "V2", label: "ReBAC", passed: 16, total: 18, missing: 2 },
    { id: "V3", label: "引用", passed: 14, total: 18, missing: 4 },
    { id: "V6", label: "审批", passed: 12, total: 18, missing: 6 },
  ],
} as const;

/** 今日运行卡。 */
export const demoTodayRuns = {
  total: 58,
  inFlight: 7,
  employeesRan: 15,
  failed: 2,
  throttledShare: "429 限流约占一半",
  inFlightRows: [
    { runId: "run_9f21ac", employee: "陈可", status: "运行中", elapsed: "1m 48s" },
    { runId: "run_9f2188", employee: "林一舟", status: "运行中", elapsed: "3m 06s" },
  ],
  failedRows: [
    { runId: "run_9f1e77", employee: "周颂", reason: "429 限流", at: "13:58" },
    { runId: "run_9e9a10", employee: "顾南", reason: "权限拒绝", at: "11:24" },
  ],
} as const;

/** 今日成本卡（含月配额与浪费口径）。 */
export const demoCost = {
  todayUsd: 12.4,
  dailyCapUsd: 40,
  usedShare: 0.31,
  monthUsd: 214.8,
  monthQuotaUsd: 800,
  monthShare: 0.268,
  forecastMonthUsd: 358,
  dailyCapsTotalUsd: 57,
  monthlyQuotasTotalUsd: 1140,
  topSpender: { employee: "顾南", share: 0.29 },
  waste: { todayUsd: 6.1, monthShare: 0.028 },
} as const;

/** 三条细长条：发布 / 出站 / 账本。 */
export const demoChains = [
  {
    key: "release",
    label: "发布",
    facts: ["3 草稿", "2 校验失败", "4 待批", "1 发布超时"],
  },
  {
    key: "outbound",
    label: "出站",
    facts: ["96.2% 成功", "拒绝 3", "回执 P95 1.8s", "网关在线"],
    subline: "14:32:08 app_id 一致",
  },
  {
    key: "ledger",
    label: "账本",
    facts: ["覆盖 100% 运行", "实际 $12.40（账本）/ 估算 $0.00", "最近对账 未接入"],
  },
] as const;

/** 近 14 天运行趋势（含缺口日，缺口用 null，不补零）。 */
export const demoTrend = {
  total: 512,
  peak: 58,
  peakDay: "11-18",
  dailyAvg: 36.6,
  points: [
    { day: "11-05", runs: 41 },
    { day: "11-06", runs: 44 },
    { day: "11-07", runs: 38 },
    { day: "11-08", runs: 22 },
    { day: "11-09", runs: 19 },
    { day: "11-10", runs: 46 },
    { day: "11-11", runs: 47 },
    { day: "11-12", runs: 35 },
    { day: "11-13", runs: 40 },
    { day: "11-14", runs: 33 },
    { day: "11-15", runs: 21 },
    { day: "11-16", runs: 24 },
    { day: "11-17", runs: 44 },
    { day: "11-18", runs: 58 },
  ],
} as const;

/** 24 小时活跃热力：24 格，future=未发生时段（画斜线）。 */
export const demoHeat = {
  peakHour: "09:00",
  peakBucketCount: 5,
  nowMarkHour: 14,
  legend: ["0", "1–2", "3–4", "5+"],
  cells: [
    { hour: 0, count: 0, future: true },
    { hour: 1, count: 0, future: true },
    { hour: 2, count: 0, future: true },
    { hour: 3, count: 0, future: true },
    { hour: 4, count: 0, future: true },
    { hour: 5, count: 0, future: true },
    { hour: 6, count: 1, future: true },
    { hour: 7, count: 2, future: true },
    { hour: 8, count: 3, future: true },
    { hour: 9, count: 5, future: false },
    { hour: 10, count: 4, future: false },
    { hour: 11, count: 3, future: false },
    { hour: 12, count: 1, future: false },
    { hour: 13, count: 2, future: false },
    { hour: 14, count: 3, future: false },
    { hour: 15, count: 0, future: true },
    { hour: 16, count: 0, future: true },
    { hour: 17, count: 0, future: true },
    { hour: 18, count: 0, future: true },
    { hour: 19, count: 0, future: true },
    { hour: 20, count: 0, future: true },
    { hour: 21, count: 0, future: true },
    { hour: 22, count: 0, future: true },
    { hour: 23, count: 0, future: true },
  ],
  vsYesterday: "较昨日同时段 +6 次（52 → 58）",
} as const;

/** 阻塞卡。 */
export const demoBlockers = {
  total: 4,
  topLine: "网关在线 · 5 服务 · 3 客户端 · 队列 7",
  rows: [
    { kind: "失败", detail: "run_9f1e77 / run_9e9a10 · 429 与权限拒绝", action: "去处理" },
    { kind: "超时", detail: "供应商报价邮件 · 等待 2h 51m", action: "去处理" },
    { kind: "滞后", detail: "知识索引滞后 32 分钟", action: "去处理" },
  ],
} as const;

/** 待我处理卡。 */
export const demoMyTodo = {
  total: 16,
  mine: 6,
  earliest: "09:41",
  rows: [
    { title: "供应商报价问询", who: "陈可", waited: "2h 51m" },
    { title: "投放预算追加 $2,400", who: "周颂", waited: "1h 12m" },
    { title: "删除「2024 旧价目表」", who: "林一舟", waited: "41m" },
  ],
} as const;

/** 最近运行卡。 */
export const demoRecentRuns = {
  version: "v0.9.2",
  asOf: "14:32:08",
  rows: [
    { runId: "run_9f21ac", employee: "陈可", status: "成功", duration: "1m 48s" },
    { runId: "run_9f2188", employee: "林一舟", status: "运行中", duration: "3m 06s" },
    { runId: "run_9f2140", employee: "周颂", status: "成功", duration: "2m 31s" },
    { runId: "run_9f20f2", employee: "顾南", status: "成功", duration: "1m 09s" },
    { runId: "run_9f2091", employee: "苏晚", status: "失败", duration: "0m 42s" },
    { runId: "run_9f1e77", employee: "周颂", status: "失败", duration: "0m 18s" },
  ],
} as const;

/** 页脚口径。 */
export const demoFooter = {
  note: "示例数据 · 构造租户，与真实租户完全隔离",
  asOf: "14:32:08",
  owner: "SEAKOI · kevin.seakoi.com",
} as const;

export const demoOverview = {
  readiness: demoReadiness,
  todayRuns: demoTodayRuns,
  cost: demoCost,
  chains: demoChains,
  trend: demoTrend,
  heat: demoHeat,
  blockers: demoBlockers,
  myTodo: demoMyTodo,
  recentRuns: demoRecentRuns,
  footer: demoFooter,
} as const;

export type DemoOverview = typeof demoOverview;