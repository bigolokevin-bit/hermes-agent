/**
 * R25 · 管理员与高危操作只读面.
 *
 * The BFF exposes no administrator directory (role/user candidates are 404).
 * High-risk operations are real audit events: each action is queried
 * separately and merged. Nothing here fabricates an empty 0 or a sample row.
 */
import { fetchJSON } from "@/lib/api";
import { API_UNREACHABLE_MESSAGE, ApiError } from "@/lib/api-error";
import { isRecord, pickString, rawId, shortCode, type Rec } from "./access";

export const ADMIN_GAP = "GAP-ADM5-01";
export const ADMIN_GAP_MESSAGE =
  "管理员名单未接入：上游人员与角色接口尚未对控制台开放。接入后这里显示真实账号与角色；现在不展示样例。";
export const RISK_GAP = "GAP-ADM5-02";

export const ADMIN_ACTIONS: { action: string; category: string; label: string }[] = [
  { action: "employee.deleted", category: "删除", label: "删除员工" },
  { action: "grant.created", category: "授权变更", label: "新建授权" },
  { action: "grant.revoked", category: "授权变更", label: "撤销授权" },
  { action: "credential.updated", category: "凭据变更", label: "修改凭据" },
  { action: "credential.rotated", category: "凭据变更", label: "轮换凭据" },
  { action: "secret.updated", category: "凭据变更", label: "修改密钥" },
];

export interface AdminRow {
  name: string;
  code: string;
  role: string;
  roleReason: string | null;
  lastLogin: string | null;
  lastLoginReason: string | null;
  lastRisk: string | null;
  lastRiskReason: string | null;
  status: string;
  statusReason: string | null;
  rawId: string | null;
}

export interface HighRiskRow {
  eventId: string;
  category: string;
  action: string;
  object: string;
  objectReason: string | null;
  actor: string;
  actorReason: string | null;
  at: string | null;
  atReason: string;
  requestId: string;
  rawAction: string;
}

export type AdminState =
  | { phase: "loading" }
  | { phase: "ready"; rows: HighRiskRow[] }
  | { phase: "empty" }
  | { phase: "unavailable"; message: string }
  | { phase: "denied"; message: string }
  | { phase: "error"; message: string; requestId: string | null };

const BJT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function beijing(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return BJT.format(date).replace("T", " ");
}

function roleWords(row: Rec): string | null {
  const names = row.roles ?? row.role_names ?? row.roleNames;
  if (Array.isArray(names)) {
    const values = names
      .map((item) => (typeof item === "string" ? item : isRecord(item) ? pickString(item.name, item.code) : null))
      .filter((x): x is string => Boolean(x));
    if (values.length) return values.join("、");
  }
  return pickString(row.role_name, row.roleName, row.role, row.role_code, row.roleCode);
}

function statusOf(row: Rec): { label: string; reason: string | null } {
  const raw = pickString(row.status, row.account_status, row.accountStatus);
  if (raw) {
    const lower = raw.toLowerCase();
    if (["active", "enabled", "ok", "normal", "available"].includes(lower)) return { label: "正常", reason: null };
    if (["disabled", "inactive", "suspended", "blocked", "offline"].includes(lower)) return { label: "停用", reason: null };
    return { label: "待核实", reason: "状态值暂无法归类" };
  }
  const enabled = row.enabled ?? row.is_enabled ?? row.active;
  if (typeof enabled === "boolean") return { label: enabled ? "正常" : "停用", reason: null };
  return { label: "待核实", reason: "上游未提供账号状态" };
}

export function adminView(row: Rec): AdminRow {
  const lastLoginRaw = pickString(row.last_login_at, row.lastLoginAt, row.last_login, row.lastLogin, row.last_seen_at, row.lastSeenAt);
  const lastRiskRaw = pickString(row.last_high_risk_at, row.lastHighRiskAt, row.last_risk_at, row.lastRiskAt);
  const lastLogin = beijing(lastLoginRaw);
  const lastRisk = beijing(lastRiskRaw);
  const role = roleWords(row);
  const status = statusOf(row);
  return {
    name: pickString(row.realname, row.name, row.nick_name, row.nickname, row.user_name, row.username) ?? "未指派",
    code: shortCode(row),
    role: role ?? "—",
    roleReason: role ? null : "上游未提供角色",
    lastLogin,
    lastLoginReason: lastLogin ? null : lastLoginRaw ? "最近登录时间无法解析" : "上游未提供最近登录",
    lastRisk,
    lastRiskReason: lastRisk ? null : lastRiskRaw ? "最近高危操作时间无法解析" : "上游未提供最近高危操作",
    status: status.label,
    statusReason: status.reason,
    rawId: rawId(row) || null,
  };
}

function actorWords(event: Rec): { actor: string; reason: string | null } {
  const actor = isRecord(event.actor) ? event.actor : null;
  const type = actor ? pickString(actor.type)?.toLowerCase() : null;
  const id = actor ? pickString(actor.id) : null;
  if (type === "system") return { actor: pickString(actor?.name) ?? "系统", reason: null };
  if (type === "human" || type === "employee") {
    const named = actor ? pickString(actor.name, actor.display_name, actor.displayName) : null;
    if (named) return { actor: named, reason: null };
    if (id) return { actor: shortCode({ id } as Rec), reason: null };
    return { actor: "操作者待核实", reason: "上游未提供操作者" };
  }
  const human = pickString(event.responsibleHumanId, event.responsible_human_id);
  if (human) return { actor: shortCode({ id: human } as Rec), reason: null };
  return { actor: "操作者待核实", reason: "上游未提供操作者" };
}

function objectWords(event: Rec): { object: string; reason: string | null } {
  const resource = isRecord(event.resource) ? event.resource : null;
  const type = resource ? pickString(resource.type) : null;
  const id = resource ? pickString(resource.id) : null;
  if (type && id) return { object: `${type} · ${shortCode({ id } as Rec)}`, reason: null };
  if (id) return { object: shortCode({ id } as Rec), reason: null };
  if (type) return { object: type, reason: "上游未提供对象编号" };
  return { object: "—", reason: "上游未提供操作对象" };
}

function actionMeta(raw: string) {
  return ADMIN_ACTIONS.find((a) => a.action === raw) ?? { action: raw, category: "其他变更", label: "其他高危操作" };
}

function eventOf(raw: Rec): HighRiskRow | null {
  const eventId = pickString(raw.eventId, raw.event_id);
  if (!eventId) return null;
  const rawAction = pickString(raw.action) ?? "其他变更";
  const meta = actionMeta(rawAction);
  const atRaw = pickString(raw.occurredAt, raw.occurred_at, raw.recordedAt, raw.recorded_at);
  const at = beijing(atRaw);
  const actor = actorWords(raw);
  const object = objectWords(raw);
  return {
    eventId,
    category: meta.category,
    action: meta.label,
    object: object.object,
    objectReason: object.reason,
    actor: actor.actor,
    actorReason: actor.reason,
    at,
    atReason: at ? "" : atRaw ? "操作时间无法解析" : "上游未提供操作时间",
    requestId: pickString(raw.correlationId, raw.correlation_id, raw.requestId, raw.request_id) ?? eventId,
    rawAction,
  };
}

export async function loadHighRisk(): Promise<AdminState> {
  let denied = false;
  let firstError: ApiError | null = null;
  let success = 0;
  const seen = new Set<string>();
  const rows: HighRiskRow[] = [];

  for (const meta of ADMIN_ACTIONS) {
    const url = `/agent-api/api/audit?action=${encodeURIComponent(meta.action)}&limit=20`;
    try {
      const body = await fetchJSON<unknown>(url);
      success += 1;
      const events = isRecord(body) && Array.isArray(body.events) ? body.events : [];
      for (const raw of events) {
        if (!isRecord(raw)) continue;
        const row = eventOf(raw);
        if (!row || seen.has(row.eventId)) continue;
        seen.add(row.eventId);
        rows.push(row);
      }
    } catch (err: unknown) {
      const api = err instanceof ApiError ? err : null;
      if (api?.status === 403 || api?.status === 404) denied = true;
      else if (api && !firstError) firstError = api;
    }
  }

  if (success === 0) {
    if (denied) return { phase: "denied", message: "高危操作记录未接入：接口没有对当前账号开放。" };
    return {
      phase: "error",
      message:
        firstError?.status && firstError.status >= 500
          ? API_UNREACHABLE_MESSAGE
          : firstError?.message || "高危操作记录暂时无法读取。",
      requestId: firstError?.requestId ?? null,
    };
  }
  if (rows.length === 0) return { phase: "empty" };
  rows.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
  return { phase: "ready", rows };
}
