import { ApiError } from "@/lib/api-error";

export type ProbeStatus = "healthy" | "error" | "unknown";

export type ProbeRow = {
  id: string;
  name: string;
  status: ProbeStatus;
  reason: string;
  requestId: string | null;
  /** Engineering detail; only ever rendered as a title, never as body copy. */
  detail: string | null;
  lastSuccessAt: string | null;
  lastSuccessReason: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
  consecutiveSuccesses: number | null;
  consecutiveReason: string | null;
  asOf: string | null;
  asOfReason: string | null;
};

export const PROBE_DEFINITIONS = [
  { id: "console", name: "控制台服务", path: "/agent-api/api/__health-probe__" },
  { id: "runtime", name: "Hermes 运行时", path: "/agent-api/api/hermes-summary" },
  { id: "domain", name: "域服务", path: "/agent-api/api/skills" },
] as const;

const AS_OF_KEYS = ["asOf", "as_of", "collectedAt", "collected_at", "generatedAt", "generated_at", "updatedAt", "updated_at"];
const LAST_SUCCESS_KEYS = ["lastSuccessAt", "last_success_at", "lastSuccess", "last_success", "lastOkAt", "last_ok_at"];
const LAST_FAILURE_KEYS = ["lastFailureAt", "last_failure_at", "lastFailure", "last_failure", "lastErrorAt", "last_error_at"];
const STREAK_KEYS = ["consecutiveSuccesses", "consecutive_successes", "successStreak", "success_streak", "consecutiveOk", "consecutive_ok"];

export const PILOT_ROW: ProbeRow = {
  id: "bisheng",
  name: "上游业务平台",
  status: "unknown",
  reason: "探针未接入，请看接入说明。",
  requestId: null,
  detail: "GAP-05",
  lastSuccessAt: null,
  lastSuccessReason: "探针未接入，没有上次成功记录。",
  lastFailureAt: null,
  lastFailureReason: "探针未接入，没有上次失败记录。",
  consecutiveSuccesses: null,
  consecutiveReason: "探针未接入，没有连续成功次数。",
  asOf: null,
  asOfReason: "探针未接入，没有采集时间。",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nestedRecords(payload: unknown): Record<string, unknown>[] {
  if (!isRecord(payload)) return [];
  const out: Record<string, unknown>[] = [payload];
  for (const key of ["health", "probe", "meta", "source", "status"]) {
    const value = payload[key];
    if (isRecord(value)) out.push(value);
  }
  return out;
}

function pick(payload: unknown, keys: string[]): unknown {
  for (const record of nestedRecords(payload)) {
    for (const key of keys) {
      const value = record[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
  }
  return null;
}

function pickString(payload: unknown, keys: string[]): string | null {
  const value = pick(payload, keys);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pickNumber(payload: unknown, keys: string[]): number | null {
  const value = pick(payload, keys);
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.trunc(value));
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Math.max(0, Math.trunc(Number(value)));
  return null;
}

function toDate(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value < 1_000_000_000_000 ? value * 1000 : value;
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim();
  const numeric = Number(text);
  if (Number.isFinite(numeric) && /^\d+$/.test(text)) return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
  const at = new Date(text).getTime();
  return Number.isNaN(at) ? null : at;
}

export function formatBeijingTime(value: number | string | null): string | null {
  const at = toDate(value);
  if (at === null) return null;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(at));
}

function payloadTime(payload: unknown, keys: string[]): string | null {
  return formatBeijingTime(pickString(payload, keys) ?? pickNumber(payload, keys));
}

function statusFromPayload(payload: unknown): ProbeStatus | null {
  const raw = pickString(payload, ["status", "state", "health", "result"]);
  if (!raw) return null;
  const value = raw.toLowerCase();
  if (["healthy", "ok", "up", "normal", "active", "ready", "pass", "green"].includes(value)) return "healthy";
  if (["error", "down", "failed", "failure", "unhealthy", "red"].includes(value)) return "error";
  return "unknown";
}

function emptyRow(id: string, name: string, status: ProbeStatus, reason: string, requestId: string | null, detail: string | null): ProbeRow {
  return {
    id, name, status, reason, requestId, detail,
    lastSuccessAt: null,
    lastSuccessReason: "上游未回显上次成功时间。",
    lastFailureAt: null,
    lastFailureReason: "上游未回显上次失败时间。",
    consecutiveSuccesses: null,
    consecutiveReason: "上游未回显连续成功次数。",
    asOf: null,
    asOfReason: "上游未回显采集时间，不能用浏览器时间代替。",
  };
}

export function probeResult(id: string, result: PromiseSettledResult<unknown>, returnedAt: number): ProbeRow {
  const name = PROBE_DEFINITIONS.find((probe) => probe.id === id)?.name ?? "—";
  const responseTime = formatBeijingTime(returnedAt);
  if (result.status === "fulfilled") {
    const payload = result.value;
    const status = statusFromPayload(payload) ?? "healthy";
    const row = emptyRow(id, name, status, status === "error" ? "上游自报异常，请看接入说明。" : "", null, null);
    row.lastSuccessAt = payloadTime(payload, LAST_SUCCESS_KEYS) ?? (status === "healthy" ? responseTime : null);
    row.lastSuccessReason = row.lastSuccessAt ? null : "上游未回显上次成功时间；本次探测也不是成功状态。";
    row.lastFailureAt = payloadTime(payload, LAST_FAILURE_KEYS) ?? (status === "error" ? responseTime : null);
    row.lastFailureReason = row.lastFailureAt ? null : "上游未回显上次失败时间；本次探测没有失败。";
    row.consecutiveSuccesses = pickNumber(payload, STREAK_KEYS);
    row.consecutiveReason = row.consecutiveSuccesses === null ? "上游未回显连续成功次数。" : null;
    row.asOf = payloadTime(payload, AS_OF_KEYS);
    row.asOfReason = row.asOf ? null : "上游未回显采集时间，不能用浏览器时间代替。";
    return row;
  }

  const error = result.reason;
  const apiError = error instanceof ApiError ? error : null;
  const requestId = apiError?.requestId ?? (error && typeof error === "object" && "requestId" in error && typeof error.requestId === "string" ? error.requestId : null);

  if (id === "console") {
    if (apiError && apiError.status > 0) {
      const row = emptyRow(id, name, "healthy", "", requestId, `HTTP ${apiError.status}`);
      row.lastSuccessAt = responseTime;
      row.lastSuccessReason = null;
      row.lastFailureReason = "本次返回的是错误响应；上游没有回显上次失败时间。";
      row.asOfReason = "上游返回错误响应，没有可读取的采集时间。";
      return row;
    }
    const row = emptyRow(id, name, "error", "控制台服务未响应", requestId, null);
    row.lastFailureAt = responseTime;
    row.lastFailureReason = null;
    row.lastSuccessReason = "本次没有连上控制台，也没有上游记录可读。";
    row.asOfReason = "本次没有连上控制台，没有采集时间。";
    return row;
  }

  if (apiError?.status === 0 || !apiError) {
    const row = emptyRow(id, name, "unknown", "控制台不可达，无法判定", requestId, null);
    row.lastSuccessReason = "控制台不可达，没有上游记录可读。";
    row.lastFailureReason = "控制台不可达，没有上游记录可读。";
    row.asOfReason = "控制台不可达，没有采集时间。";
    return row;
  }

  if (apiError.status === 401 || apiError.status === 403 || apiError.status === 404) {
    const row = emptyRow(id, name, "unknown", "接口未接入：这个读取口还没有对控制台开放。", requestId, `HTTP ${apiError.status}`);
    row.lastSuccessReason = "接口未接入，没有可判定的上次成功记录。";
    row.lastFailureReason = "接口未接入，没有可判定的上次失败记录。";
    row.asOfReason = "接口未接入，没有采集时间。";
    return row;
  }

  const row = emptyRow(id, name, "error", "上游返回异常，请看接入说明。", requestId, `HTTP ${apiError.status}`);
  row.lastFailureAt = responseTime;
  row.lastFailureReason = null;
  row.lastSuccessReason = "本次没有成功，也没有上游记录可读。";
  row.asOfReason = "上游返回异常，没有可读取的采集时间。";
  return row;
}

export function summarize(rows: ProbeRow[]): { healthy: number; error: number; unknown: number } {
  return rows.reduce((counts, row) => {
    if (row.status === "healthy") counts.healthy += 1;
    else if (row.status === "error") counts.error += 1;
    else counts.unknown += 1;
    return counts;
  }, { healthy: 0, error: 0, unknown: 0 });
}