import { ApiError } from "@/lib/api-error";
import { VERSION_MISSING_REASON, versionIdentity } from "./versionIdentity";

export const SYS3_PATH = "/agent-api/api/health";
export const SYS3_GAP = "GAP-SYS3-01";

export const ASOF_KEYS = [
  "asOf",
  "as_of",
  "collectedAt",
  "collected_at",
  "generatedAt",
  "generated_at",
] as const;

export const ASOF_MISSING_TITLE = "上游没带采集时刻，不用本机时间顶替";

export interface TopAsOf {
  shown: string | null;
  raw: string | null;
  source: string | null;
  reason: string | null;
  valid: boolean;
  title: string;
}

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
  endpoint: string | null;
  basis: string[];
  lastError: string | null;
  lastErrorReason: string | null;
  lastErrorRedactions: number;
  lastErrorTruncated: boolean;
}

export interface SystemHealthRead {
  rows: SystemHealthRow[];
  asOf: string | null;
  asOfReason: string | null;
  asOfTitle: string;
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

const ASOF_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

function asOfText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function missingAsOf(source: string | null): TopAsOf {
  return { shown: null, raw: null, source, reason: ASOF_MISSING_TITLE, valid: false, title: ASOF_MISSING_TITLE };
}

/** One top-level ISO reader for every console surface; never uses the browser clock. */
export function readTopAsOf(payload: unknown): TopAsOf {
  if (!isRecord(payload)) return missingAsOf(null);
  const source = asOfText(payload.asOfSource) ?? asOfText(payload.as_of_source);
  const raw = ASOF_KEYS.map((key) => asOfText(payload[key])).find((value) => value !== null) ?? null;
  if (!raw) return missingAsOf(source);
  const shown = beijingMinute(raw);
  if (!ASOF_ISO.test(raw) || !shown) return missingAsOf(source);
  const title = `UTC 原文：${raw} · 北京时间：${shown}${source ? ` · 来源：${source}` : ""}`;
  return { shown, raw, source, reason: null, valid: true, title };
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

export function redactError(value: string): { text: string; count: number; truncated: boolean } {
  let count = 0;
  let text = value.replace(/\bAuthorization\s*:\s*Bearer\s+[^\s,;]+/gi, () => {
    count += 1;
    return "Authorization: Bearer ***";
  });
  text = text.replace(/(token|cookie|secret|password|passwd|api[_-]?key|access[_-]?key|private[_-]?key)\s*[:=]\s*["']?([^\s,;，；"']+)/gi, (_match, label: string) => {
    count += 1;
    return `${label}: ***`;
  });
  text = text.replace(/\b(sk-[A-Za-z0-9_-]{6,}|ghp_[A-Za-z0-9]{6,}|eyJ[A-Za-z0-9._-]{10,})\b/g, () => {
    count += 1;
    return "***";
  });
  const truncated = text.length > 200;
  return { text: truncated ? `${text.slice(0, 200)}…` : text, count, truncated };
}

function errorOf(row: Rec): { text: string | null; reason: string | null; redactions: number; truncated: boolean } {
  const raw = row.lastError ?? row.last_error ?? row.error ?? row.errorSummary ?? row.error_summary ?? row.lastFailure ?? row.last_failure ?? row.lastErrorMessage ?? row.last_error_message;
  if (typeof raw === "string" && raw.trim()) {
    const redacted = redactError(raw.trim());
    return { text: redacted.text, reason: null, redactions: redacted.count, truncated: redacted.truncated };
  }
  if (isRecord(raw)) {
    const message = pickString(raw, ["message", "summary", "detail", "error"]);
    if (message) {
      const redacted = redactError(message);
      return { text: redacted.text, reason: null, redactions: redacted.count, truncated: redacted.truncated };
    }
  }
  return { text: null, reason: "健康接口没有给出最近一次错误摘要。", redactions: 0, truncated: false };
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
  const stamp = readTopAsOf(body);
  const asOf = stamp.shown;
  const asOfReason = stamp.reason;
  const asOfTitle = stamp.title;
  const sources = body.sources;
  const rows: SystemHealthRow[] = sources.map((entry, index) => {
    const row = isRecord(entry) ? entry : {};
    const name = pickString(row, ["name", "label", "id"]);
    const rawState = pickString(row, ["state", "status", "health", "result"]);
    const state = stateOf(rawState);
    const version = versionIdentity(row);
    const latencyMs = pickNumber(row, ["latencyMs", "latency_ms", "durationMs", "duration_ms", "responseTimeMs", "response_time_ms", "elapsedMs", "elapsed_ms"]);
    const key = (pickString(row, ["id"]) ?? name ?? `source-${index}`).replace(/[^a-zA-Z0-9_-]+/g, "-");
    const endpoint = pickString(row, ["path", "endpoint", "readPath", "read_path", "url"]) ?? SYS3_PATH;
    const error = errorOf(row);
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
      versionReason: version ? null : VERSION_MISSING_REASON,
      checkedAt: asOf,
      checkedReason: asOfReason,
      latency: latencyMs === null ? null : `${Math.round(latencyMs)} ms`,
      latencyReason: latencyMs === null ? "健康接口没有给出响应耗时。" : null,
      endpoint,
      basis: [],
      lastError: error.text,
      lastErrorReason: error.reason,
      lastErrorRedactions: error.redactions,
      lastErrorTruncated: error.truncated,
    };
  });
  const ok = typeof body.ok === "boolean" ? body.ok : null;
  const overall: Sys3State = ok === true ? "正常" : ok === false ? "降级" : "待核实";
  const overallReason = ok === null ? "健康接口没有给出整体状态。" : null;
  for (const row of rows) {
    row.basis = [
      row.state === "正常"
        ? "健康接口报告该服务为正常；没有降级或不可达标记。"
        : row.state === "降级"
          ? "健康接口把该服务标记为降级；本页按上游信号如实展示。"
          : row.state === "不可达"
            ? "健康接口把该服务标记为不可达；本页不把它当作正常。"
            : "健康接口没有给出可判定的状态；本页按待核实处理。",
      `整体健康：${overall}${overallReason ? `（${overallReason}）` : ""}。`,
      "判定只依据这次健康接口响应，没有用本机时钟或本地推断补齐。",
    ];
  }
  return {
    rows,
    asOf,
    asOfReason,
    asOfTitle,
    overall,
    overallReason,
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
