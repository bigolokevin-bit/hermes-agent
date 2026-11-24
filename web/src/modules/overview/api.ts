/**
 * 总览模块自带读数腿（只读 BFF 现成端点，不造接口）：
 * - GET /api/hermes-summary：服务探针（gateway.status/updated_at），健康芯片用。
 * - GET /api/health/sources：骨架阻塞条的「服务数」来源（sources.length）。
 * - GET /api/overview/summary：BFF 聚合的今日成本/待批等真读数，给主数字位兜底。
 */
import { fetchJSON } from '@/lib/api';
import { BFF } from '../duty/api';

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