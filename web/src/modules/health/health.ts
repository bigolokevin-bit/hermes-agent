import { ApiError } from "@/lib/api-error";

export type ProbeStatus = "healthy" | "error" | "unknown";
export type ProbeRow = {
  id: string;
  name: string;
  status: ProbeStatus;
  reason: string;
  collectedAt: string | null;
  requestId: string | null;
};

export const PROBE_DEFINITIONS = [
  { id: "console", name: "控制台服务", path: "/agent-api/api/__health-probe__" },
  { id: "runtime", name: "Hermes 运行时", path: "/agent-api/api/hermes-summary" },
  { id: "domain", name: "域服务", path: "/agent-api/api/skills" },
] as const;

export const PILOT_ROW: ProbeRow = {
  id: "bisheng",
  name: "毕昇平台",
  status: "unknown",
  reason: "探针未接入（GAP-05），请看接入说明。",
  collectedAt: null,
  requestId: null,
};

export function formatBeijingTime(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(value));
}

export function probeResult(id: string, result: PromiseSettledResult<unknown>, returnedAt: number): ProbeRow {
  const name = PROBE_DEFINITIONS.find((probe) => probe.id === id)?.name ?? "—";
  if (result.status === "fulfilled") {
    return { id, name, status: "healthy", reason: "", collectedAt: formatBeijingTime(returnedAt), requestId: null };
  }
  const error = result.reason;
  const apiError = error instanceof ApiError ? error : null;
  const requestId = apiError?.requestId ?? (error && typeof error === "object" && "requestId" in error && typeof error.requestId === "string" ? error.requestId : null);
  if (id === "console") {
    if (apiError && apiError.status > 0) {
      return { id, name, status: "healthy", reason: "", collectedAt: formatBeijingTime(returnedAt), requestId };
    }
    return { id, name, status: "error", reason: "控制台服务未响应", collectedAt: null, requestId };
  }
  if (apiError?.status === 0 || !apiError) {
    return { id, name, status: "unknown", reason: "控制台不可达，无法判定", collectedAt: null, requestId };
  }
  return {
    id, name, status: "error", reason: `上游返回异常（状态码 ${apiError.status}）`,
    collectedAt: formatBeijingTime(returnedAt), requestId,
  };
}

export function summarize(rows: ProbeRow[]): { healthy: number; error: number; unknown: number } {
  return rows.reduce((counts, row) => {
    if (row.status === "healthy") counts.healthy += 1;
    else if (row.status === "error") counts.error += 1;
    else counts.unknown += 1;
    return counts;
  }, { healthy: 0, error: 0, unknown: 0 });
}
