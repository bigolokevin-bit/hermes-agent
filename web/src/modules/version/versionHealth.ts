import { ApiError } from "@/lib/api-error";
import { readSystemHealth, readTopAsOf } from "../health/systemHealth";
import { VERSION_MISSING_REASON, versionIdentity } from "../health/versionIdentity";

export const VERSION_API_PATH = "/agent-api/api/version";
export const HEALTH_API_PATH = "/agent-api/api/health";
export const VERSION_GAP = "GAP-VER5-01";
export const HEALTH_GAP = "GAP-VER5-02";

export type VersionStatus = "正常" | "降级" | "待核实";

export interface VersionRow {
  key: string;
  name: string | null;
  nameReason: string | null;
  version: string | null;
  versionReason: string | null;
  builtAt: string | null;
  builtReason: string | null;
  status: VersionStatus;
  statusRaw: string | null;
  statusReason: string | null;
}

export interface HealthView {
  state: "正常" | "降级" | "待核实";
  reason: string | null;
  asOf: string | null;
  asOfReason: string | null;
  asOfTitle: string;
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

export function beijingMinute(value: string | null): string | null {
  if (!value) return null;
  const numeric = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function listOf(body: unknown): unknown[] | null {
  if (Array.isArray(body)) return body;
  if (!isRecord(body)) return null;
  for (const key of ["components", "items", "versions", "data", "rows"]) {
    const value = body[key];
    if (Array.isArray(value)) return value;
  }
  return null;
}

export function readVersionRows(body: unknown): VersionRow[] | null {
  const list = listOf(body);
  if (list === null) return null;
  return list.map((entry, index) => {
    const row = isRecord(entry) ? entry : {};
    const name = pickString(row, ["name", "component", "componentName", "component_name", "label", "id"]);
    const rawVersion = versionIdentity(row);
    const builtRaw = pickString(row, ["builtAt", "built_at", "buildTime", "build_time", "createdAt", "created_at"]);
    const builtAt = beijingMinute(builtRaw);
    const rawStatus = pickString(row, ["status", "state", "health", "result"]);
    const normalized = rawStatus?.toLowerCase() ?? null;
    const status: VersionStatus = normalized === null
      ? "待核实"
      : ["ok", "healthy", "normal", "active", "up", "ready"].includes(normalized)
        ? "正常"
        : ["degraded", "warn", "warning", "partial", "down", "failed"].includes(normalized)
          ? "降级"
          : "待核实";
    const key = (name ?? `row-${index}`).replace(/[^a-zA-Z0-9_-]+/g, "-");
    return {
      key,
      name,
      nameReason: name ? null : "上游没有提供组件名。",
      version: rawVersion,
      versionReason: rawVersion ? null : VERSION_MISSING_REASON,
      builtAt,
      builtReason: builtRaw ? (builtAt ? null : "上游给出的构建时刻无法解析。") : "上游没有提供构建时刻。",
      status,
      statusRaw: rawStatus,
      statusReason: rawStatus
        ? status === "待核实" ? "上游状态值暂无法归类。" : null
        : "上游没有说明组件状态。",
    };
  });
}


/** The version table prefers the health rows so /system and ver5 read the same value. */
export function readVersionRowsFromHealth(body: unknown): VersionRow[] | null {
  const read = readSystemHealth(body);
  if (read === null) return null;
  return read.rows.map((row) => ({
    key: row.key,
    name: row.name,
    nameReason: row.nameReason,
    version: row.version,
    versionReason: row.versionReason,
    builtAt: null,
    builtReason: "健康接口没有提供构建时刻；不把检查时刻当构建时间。",
    status: row.state === "不可达" ? "降级" : row.state,
    statusRaw: row.stateRaw,
    statusReason: row.stateReason,
  }));
}

export function readHealth(body: unknown): HealthView | null {
  if (!isRecord(body)) return null;
  const ok = typeof body.ok === "boolean" ? body.ok : null;
  const stamp = readTopAsOf(body);
  const sourcesValue = body.sources;
  const sources = Array.isArray(sourcesValue)
    ? sourcesValue.length
    : typeof sourcesValue === "number" && Number.isFinite(sourcesValue)
      ? sourcesValue
      : null;
  return {
    state: ok === true ? "正常" : ok === false ? "降级" : "待核实",
    reason: ok === null ? "健康接口没有给出整体状态。" : null,
    asOf: stamp.shown,
    asOfReason: stamp.reason,
    asOfTitle: stamp.title,
    sources,
  };
}

export function versionMessage(error: unknown): { text: string; requestId: string | null; status: number } {
  if (error instanceof ApiError) {
    if (error.status === 401) return { text: "登录状态已失效，请重新登录后再看。", requestId: error.requestId ?? null, status: 401 };
    if (error.status === 403 || error.status === 404) {
      return { text: "版本读口未接入：上游版本接口还没有接入本控制台，或当前账号无权查看。", requestId: error.requestId ?? null, status: error.status };
    }
    if (error.status === 0) return { text: "当前网络不可达，版本表没有读出来。", requestId: error.requestId ?? null, status: 0 };
    return { text: error.message || "版本表暂时读不出来，请稍后重试。", requestId: error.requestId ?? null, status: error.status };
  }
  return { text: "版本表暂时读不出来，请稍后重试。", requestId: null, status: 0 };
}

export function healthMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403 || error.status === 404) return "健康读口未接入，不影响上方版本表。";
    if (error.status === 401) return "登录状态已失效，健康状态无法读取。";
    if (error.status === 0) return "当前网络不可达，健康状态无法读取。";
    return "健康接口暂时不可读，不影响上方版本表。";
  }
  return "健康接口暂时不可读，不影响上方版本表。";
}
