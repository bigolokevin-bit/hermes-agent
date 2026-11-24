/**
 * 总览模块自带读数腿（只读 BFF 现成端点，不造接口）：
 * - GET /api/hermes-summary：服务探针（gateway.status/updated_at），健康芯片用。
 * - GET /api/health/sources：骨架阻塞条的「服务数」来源（sources.length）。
 * - GET /api/overview/summary：BFF 聚合的今日成本/待批等真读数，给主数字位兜底。
 */
import { fetchJSON } from '@/lib/api';
import { BFF } from '../duty/api';
import { beijingDayWindow } from '../duty/format';
import type { RunStatsBody } from '../duty/types';

export interface HermesSummaryBody {
  schema?: string | null;
  gateway?: {
    status?: unknown;
    updated_at?: unknown;
    active_agents?: unknown;
    gateway_state?: unknown;
    platforms?: unknown;
  } | null;
  sources?: unknown;
  system?: unknown;
  sessions_stats?: unknown;
}

export interface HealthSourceRow {
  id?: string;
  name?: string;
  state?: string;
  asOf?: string;
}

export interface HealthSourcesBody {
  schema?: string | null;
  ok?: boolean;
  asOf?: string | null;
  sources?: HealthSourceRow[];
  note?: string | null;
}

export interface OverviewSummaryMetric {
  value?: unknown;
  source?: string | null;
  asOf?: string | null;
}

export interface OverviewSummaryBody {
  employeeTotal?: OverviewSummaryMetric;
  activeTotal?: OverviewSummaryMetric;
  todayRuns?: OverviewSummaryMetric;
  todayCostUsd?: OverviewSummaryMetric;
  pendingApprovals?: OverviewSummaryMetric;
  healthStatus?: OverviewSummaryMetric;
  asOf?: string | null;
}

export function fetchHermesSummary(): Promise<HermesSummaryBody> {
  return fetchJSON<HermesSummaryBody>(`${BFF}/hermes-summary`);
}

export function fetchHealthSources(): Promise<HealthSourcesBody> {
  return fetchJSON<HealthSourcesBody>(`${BFF}/health/sources`);
}

export function fetchOverviewSummary(): Promise<OverviewSummaryBody> {
  return fetchJSON<OverviewSummaryBody>(`${BFF}/overview/summary`);
}

/**
 * 趋势块专用读口：`/api/run-stats` 按北京日窗返回逐日桶 + totals。
 * 与 workbench/timeseries 的差别只有一个：这里保留 totals，于是「未返回的日子」
 * 可以用「各桶之和＝totals」算术闭合证明为 0（provenZeroFill），不必把折线
 * 画成一串虚线断口；证不出来（缺 totals / 桶无读数）就仍按缺读数断开。
 */
export function fetchTrendRuns(days: number): Promise<RunStatsBody> {
  const win = beijingDayWindow();
  const dayStart = Date.parse(win.from);
  const span = Math.max(0, Math.trunc(days) - 1) * 24 * 3600 * 1000;
  const q = new URLSearchParams({
    from: new Date(dayStart - span).toISOString(),
    to: win.to,
    bucket: 'day',
  });
  return fetchJSON<RunStatsBody>(`${BFF}/run-stats?${q.toString()}`);
}