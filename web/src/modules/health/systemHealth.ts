import { ApiError } from "@/lib/api-error";

export const SYS3_PATH = "/agent-api/api/health";
export const SYS3_GAP = "GAP-SYS3-01";

export type Sys3State = "正常" | "降级" | "不可达" | "待核实";

export interface SystemHealthRow {
  key: string;
  name: string | null;
  nameReason: string | null;
  state: Sys3State;
  stateRaw: string | null;
  stateReason: string | null;
  version: string | null;
  versionReason: string | null;
  checkedAt: string | null;
  checkedReason: string | null;
  latency: string | null;
  latencyReason: string | null;
}

export interface SystemHealthRead {
  rows: SystemHealthRow[];
  asOf: string | null;
  asOfReason: string | null;
  overall: Sys3State;
  overallReason: string | null;
  sources: number | null;
}

type Rec = Record<string, unknown>;

function isRecord(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(rec: Rec, keys: string[]): string | null {
  for (const key of keys) {
    const value = rec[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function pickNumber(rec: Rec, keys: string[]): number | null {
  for (const key of keys) {
    const value = rec[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

export function beijingMinute(value: string | null): string | null {
  if (!value) return null;
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return null;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
}

function stateOf(raw: string | null): Sys3State {
  if (!raw) return "待核实";
  const value = raw.toLowerCase();
  if (["ok", "healthy", "up", "normal", "active", "ready", "pass", "green"].includes(value)) return "正常";
  if (["degraded", "warn", "warning", "partial", "slow"].includes(value)) return "降级";
  if (["down", "error", "unreachable", "failed", "failure", "unhealthy", "red"].includes(value)) return "不可达";
  return "待核实";
}

export function readSystemHealth(body: unknown): SystemHealthRead | null {
  if (!isRecord(body) || !Array.isArray(body.sources)) return null;
  const rawAsOf = pickString(body, ["asOf", "as_of"]);
  const asOf = beijingMinute(rawAsOf);
  const asOfReason = rawAsOf
    ? asOf ? null : "健康接口给出的顶层采集时刻无法解析。"
    : "健康接口没有给出顶层采集时刻。";
  const sources = body.sources;
  const rows = sources.map((entry, index) => {
    const row = isRecord(entry) ? entry : {};
    const name = pickString(row, ["name", "label", "id"]);
    const rawState = pickString(row, ["state", "status", "health", "result"]);
    const state = stateOf(rawState);
    const version = pickString(row, ["version", "build", "buildId", "build_id", "revision", "commit"]);
    const latencyMs = pickNumber(row, ["latencyMs", "latency_ms", "durationMs", "duration_ms", "responseTimeMs", "response_time_ms", "elapsedMs", "elapsed_ms"]);
    const key = (pickString(row, ["id"]) ?? name ?? `source-${index}`).replace(/[^a-zA-Z0-9_-]+/g, "-");
    return {
      key,
      name,
      nameReason: name ? null : "健康接口没有给出服务名。",
      state,
      stateRaw: rawState,
      stateReason: rawState
        ? state === "待核实" ? "上游状态值暂无法归类。" : null
        : "健康接口没有给出服务状态。",
      version,
      versionReason: version ? null : "健康接口没有给出该服务的版本或构建标识。",
      checkedAt: asOf,
      checkedReason: asOfReason,
      latency: latencyMs === null ? null : `${Math.round(latencyMs)} ms`,
      latencyReason: latencyMs === null ? "健康接口没有给出响应耗时。" : null,
    };
  });
  const ok = typeof body.ok === "boolean" ? body.ok : null;
  return {
    rows,
    asOf,
    asOfReason,
    overall: ok === true ? "正常" : ok === false ? "降级" : "待核实",
    overallReason: ok === null ? "健康接口没有给出整体状态。" : null,
    sources: rows.length,
  };
}

export function sys3Failure(error: unknown): { text: string; status: number; requestId: string | null } {
  if (error instanceof ApiError) {
    if (error.status === 401) return { text: "登录状态已失效，请重新登录后再看健康状况。", status: 401, requestId: error.requestId ?? null };
    if (error.status === 403 || error.status === 404) {
      return { text: "健康读口未接入：上游健康接口还没有接入本控制台，或当前账号无权查看。", status: error.status, requestId: error.requestId ?? null };
    }
    if (error.status === 0) return { text: "当前网络不可达，健康清单没有读出来。", status: 0, requestId: error.requestId ?? null };
    return { text: error.message || "健康清单暂时读不出来，请稍后重试。", status: error.status, requestId: error.requestId ?? null };
  }
  return { text: "健康清单暂时读不出来，请稍后重试。", status: 0, requestId: null };
}
