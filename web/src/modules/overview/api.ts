/**
 * Q11 总览 KPI 真读数：唯一数据层。
 *
 * 合同（工单）：总览 KPI 卡只允许来自现网 BFF 已存在的两个端点——
 *   GET /api/overview/summary   （聚合读数，每字段自带 source/asOf）
 *   GET /api/run-stats?from&to&bucket=day （今日桶 = 今日运行真读数；
 *                                          14 日窗 = 趋势条，无独立 daily-trend 端点，
 *                                          现网实测 404 console.unknown_route）
 *
 * 这里只描述响应形状；值取不到就是 null，由页面显示「未接」，禁止兜底假 0。
 */
import { fetchJSON } from "@/lib/api";
import { BFF } from "../duty/api";

export interface SummaryField<T = number> {
  value: T | null;
  /** 该字段的取数口径原文（BFF 自带，页面须如实上屏）。 */
  source?: string | null;
  asOf?: string | null;
}

export interface OverviewSummaryBody {
  employeeTotal?: SummaryField<number> | null;
  activeTotal?: SummaryField<number> | null;
  todayRuns?: SummaryField<number> | null;
  todayCostUsd?: SummaryField<number> | null;
  pendingApprovals?: SummaryField<number> | null;
  healthStatus?: SummaryField<string> | null;
  asOf?: string | null;
  asOfSource?: string | null;
}

/** 现网 BFF 聚合总览读数。 */
export function fetchOverviewSummary(): Promise<OverviewSummaryBody> {
  return fetchJSON<OverviewSummaryBody>(`${BFF}/overview/summary`);
}

/*
 * OM-07/OM-08 列表腿。KPI 卡口径不变（只允许 summary+run-stats）；
 * 以下端点均为现网 BFF 实测已存在（2026-11-23 登录态实测 200）：
 *   GET /api/runs?since&limit      近 7 天运行（run-activity 是热力格不是行列表，不用）
 *   GET /api/runs?status=failed    失败运行
 *   GET /api/tasks?status=blocked  受阻任务
 *   GET /api/workbench/queue       待审批队列
 * items 形状按 unknown 收，页面逐条防御取值；取不到就是未接，不造数。
 */

export interface RunsBody {
  items?: unknown;
  nextCursor?: unknown;
}

export interface TasksBody {
  items?: unknown;
}

export interface QueueBody {
  items?: unknown;
  total?: unknown;
  available?: unknown;
  note?: unknown;
  asOf?: unknown;
}

export function fetchRecentRuns(sinceIso: string, limit = 3): Promise<RunsBody> {
  return fetchJSON<RunsBody>(`${BFF}/runs?since=${encodeURIComponent(sinceIso)}&limit=${limit}`);
}

export function fetchFailedRuns(limit = 5): Promise<RunsBody> {
  return fetchJSON<RunsBody>(`${BFF}/runs?status=failed&limit=${limit}`);
}

export function fetchBlockedTasks(limit = 5): Promise<TasksBody> {
  return fetchJSON<TasksBody>(`${BFF}/tasks?status=blocked&limit=${limit}`);
}

export function fetchWorkbenchQueue(): Promise<QueueBody> {
  return fetchJSON<QueueBody>(`${BFF}/workbench/queue?page_size=5`);
}
