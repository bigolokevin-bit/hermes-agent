import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";

export const SEC_GAP = "GAP-SEC5-01";
export const SEC_SOURCE = "控制台配置与审计事件";

type Rec = Record<string, unknown>;
export type Tri = "configured" | "missing" | "unknown";

export interface SecurityItem {
  key: string;
  label: string;
  state: Tri;
  reason: string;
  source: string;
  asOf: string | null;
  asOfReason: string | null;
}

export interface RiskRow {
  id: string;
  action: string;
  object: string;
  objectReason: string | null;
  at: string | null;
  requestId: string;
}

export type RiskState =
  | { phase: "loading" }
  | { phase: "ready"; rows: RiskRow[] }
  | { phase: "empty" }
  | { phase: "gap"; message: string }
  | { phase: "error"; message: string; requestId: string | null };

const BJT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: false,
});

export function beijing(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return BJT.format(date).replace("T", " ");
}

function rec(value: unknown): Rec | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Rec : null;
}
function text(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}
function pick(root: Rec, keys: string[]): unknown {
  for (const key of keys) if (root[key] !== undefined) return root[key];
  return undefined;
}
function tri(value: unknown): Tri {
  if (typeof value === "number" && Number.isFinite(value)) return value > 0 ? "configured" : "missing";
  if (value === true || value === 1 || value === "enabled" || value === "configured" || value === "on") return "configured";
  if (value === false || value === 0 || value === "disabled" || value === "missing" || value === "off") return "missing";
  return "unknown";
}
function triLabel(state: Tri): string {
  return state === "configured" ? "已配置" : state === "missing" ? "未配置" : "未知";
}
function item(root: Rec, key: string, label: string, keys: string[], source = "控制台配置"): SecurityItem {
  const value = pick(root, keys);
  const state = tri(value);
  const asOfRaw = text(pick(root, ["asOf", "as_of", "generatedAt", "generated_at", "updatedAt", "updated_at"]));
  const asOf = beijing(asOfRaw);
  return {
    key, label, state,
    reason: state === "unknown" ? "上游配置没有给出这一项，按未知显示，不猜成已配置或未配置。" : "来自控制台配置（只读）",
    source,
    asOf,
    asOfReason: asOf ? null : asOfRaw ? "采集时间无法解析" : "上游配置没有带采集时间",
  };
}

export function readSecurity(payload: unknown): SecurityItem[] {
  const root = rec(payload) ?? {};
  const sec = rec(pick(root, ["security", "securitySettings", "security_settings"])) ?? root;
  const session = rec(pick(sec, ["session", "login", "loginSession"])) ?? sec;
  const secrets = rec(pick(sec, ["secrets", "credentials", "keys"])) ?? sec;
  return [
    item(session, "session", "会话有效期", ["sessionMinutes", "session_duration_minutes", "sessionDurationMinutes", "sessionTimeoutMinutes", "session_timeout_minutes"]),
    item(session, "concurrent", "并发登录", ["maxConcurrentSessions", "max_concurrent_sessions", "concurrentLogin", "concurrent_login", "maxSessions"]),
    item(session, "twoFactor", "双因素认证", ["twoFactor", "two_factor", "mfa", "mfaEnabled", "mfa_enabled"]),
    item(secrets, "modelKey", "模型密钥", ["modelKeyConfigured", "model_key_configured", "modelKey", "model_key"], "密钥配置"),
    item(secrets, "channelKey", "渠道密钥", ["channelKeyConfigured", "channel_key_configured", "channelKey", "channel_key"], "密钥配置"),
    item(secrets, "auditKey", "审计导出密钥", ["auditExportKeyConfigured", "audit_export_key_configured", "auditExportKey", "audit_export_key"], "密钥配置"),
  ];
}

export function itemLabel(state: Tri): string { return triLabel(state); }

const RISK_ACTIONS = ["grant.created", "employee.deleted", "credential.updated"];

function riskRow(raw: unknown): RiskRow | null {
  const row = rec(raw);
  if (!row) return null;
  const id = text(pick(row, ["eventId", "event_id"]));
  if (!id) return null;
  const action = text(pick(row, ["action"])) ?? "其他变更";
  const resource = rec(pick(row, ["resource"])) ?? {};
  const type = text(pick(resource, ["type"]));
  const objectId = text(pick(resource, ["id"]));
  const code = objectId ? objectId.replace(/[^0-9A-Za-z]/g, "").slice(-8).toUpperCase() : null;
  return {
    id,
    action: action === "grant.created" ? "新建授权" : action === "employee.deleted" ? "删除员工" : action === "credential.updated" ? "修改凭据" : "其他变更",
    object: type && code ? `${type} · ${code}` : code ?? type ?? "—",
    objectReason: type || code ? null : "上游未提供对象",
    at: beijing(text(pick(row, ["occurredAt", "occurred_at", "recordedAt", "recorded_at"]))),
    requestId: text(pick(row, ["correlationId", "correlation_id", "requestId", "request_id"])) ?? id,
  };
}

export async function loadRisk(): Promise<RiskState> {
  let ok = 0;
  let firstError: ApiError | null = null;
  const seen = new Set<string>();
  const rows: RiskRow[] = [];
  for (const action of RISK_ACTIONS) {
    try {
      const body = await fetchJSON<unknown>(`/agent-api/api/audit?action=${encodeURIComponent(action)}&limit=3`);
      ok += 1;
      const events = rec(body)?.events;
      if (Array.isArray(events)) {
        for (const raw of events) {
          const row = riskRow(raw);
          if (row && !seen.has(row.id)) { seen.add(row.id); rows.push(row); }
        }
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
        return { phase: "gap", message: "高危操作审计读取未接入，或当前账号无权读取；不展示样例。" };
      }
      if (err instanceof ApiError && !firstError) firstError = err;
    }
  }
  if (ok === 0) return { phase: "error", message: firstError?.message || "高危操作暂时无法读取。", requestId: firstError?.requestId ?? null };
  if (rows.length === 0) return { phase: "empty" };
  return { phase: "ready", rows: rows.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? "")).slice(0, 3) };
}
