/**
 * OM-15（新基重放）：总览模块自带读数腿。
 * 健康卡两段式的服务探针走现网实测端点 GET /api/hermes-summary
 * （schema runtime.hermes.summary.v1；gateway.status + gateway.updated_at）。
 * 取不到就是未接，不拿本页读数成败冒充服务健康。
 */
import { fetchJSON } from '@/lib/api';
import { BFF } from '../duty/api';

export interface HermesSummaryBody {
  schema?: string | null;
  gateway?: {
    status?: unknown;
    updated_at?: unknown;
  } | null;
  sources?: unknown;
  system?: unknown;
  sessions_stats?: unknown;
}

export function fetchHermesSummary(): Promise<HermesSummaryBody> {
  return fetchJSON<HermesSummaryBody>(`${BFF}/hermes-summary`);
}
