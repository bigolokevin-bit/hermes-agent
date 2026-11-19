/**
 * T22 · 访问控制 — identity sub-view (roles / members / administrators).
 *
 * Data: BFF aliases over 毕升 identity endpoints. GAP-02 is not closed yet:
 * every candidate is probed for real; when none answers, the group says
 * 「未接入」 and never renders a fabricated 0. Write controls are absent.
 */

import { fetchJSON } from "@/lib/api";
import { API_UNREACHABLE_MESSAGE, ApiError, humanizeStatus } from "@/lib/api-error";

export type Rec = Record<string, unknown>;

export type Resource<T> =
  | { phase: "loading" }
  | { phase: "ready"; data: T }
  | { phase: "empty" }
  | { phase: "unavailable"; message: string }
  | { phase: "denied"; message: string }
  | { phase: "error"; message: string; requestId: string | null };

export const GAP02_PEOPLE =
  "人员目录待核实（GAP-02）：上游用户中心接口尚未接入本控制台。接入后这里会自动显示真实名单。";
export const GAP02_ROLES =
  "角色与权限待核实：上游角色接口尚未接入本控制台。接入后这里会自动显示真实角色。";

export const ROLE_GAP = "GAP-ROL5-01";

export const PEOPLE_ENDPOINTS = [
  "/agent-api/api/v1/user/list",
  "/agent-api/api/v1/user/all",
];

export const ROLE_ENDPOINTS = [
  "/agent-api/api/v1/role/list?page=1&limit=200",
  "/agent-api/api/v1/roles?page=1&limit=200",
];

export function isRecord(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function itemsOf(body: unknown): Rec[] {
  if (Array.isArray(body)) return body.filter(isRecord);
  if (isRecord(body)) {
    if (Array.isArray(body.items)) return body.items.filter(isRecord);
    if (Array.isArray(body.data)) return body.data.filter(isRecord);
    if (isRecord(body.data) && Array.isArray(body.data.items)) return body.data.items.filter(isRecord);
    if (isRecord(body.data) && Array.isArray(body.data.list)) return body.data.list.filter(isRecord);
  }
  return [];
}

export function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

export function rawId(row: Rec): string {
  return (
    pickString(row.user_id, row.userId, row.id, row.role_id, row.roleId) ?? ""
  );
}

/** 8-char display code; never the raw id. Missing id → 未指派. */
export function shortCode(row: Rec): string {
  const raw = rawId(row);
  if (!raw) return "未指派";
  const body = raw.replace(/^[^:]*:/, "").replace(/[^0-9A-Za-z]/g, "");
  return (body.slice(-8) || "未指派").toUpperCase();
}

export function personName(row: Rec): string {
  return (
    pickString(row.realname, row.name, row.nick_name, row.nickname, row.user_name, row.username) ??
    "未指派"
  );
}

/** Permission provenance, in words. Unknown/missing → explicit reason. */
export function permissionSource(row: Rec): string {
  const raw = pickString(row.permission_source, row.grant_source, row.source, row.source_type);
  const word = (raw ?? "").toLowerCase();
  if (word === "role" || word === "role_grant") return "角色授权";
  if (word === "menu" || word === "web_menu") return "菜单授权";
  if (word === "department" || word === "dept") return "部门继承";
  if (word === "direct" || word === "user") return "直接授予";
  if (raw) return "其他来源";
  const role = pickString(row.role_name, row.roleName, row.role);
  return role ? `角色 · ${role}` : "—（来源未提供）";
}

export function roleName(row: Rec): string {
  return pickString(row.role_name, row.roleName, row.name, row.role_code, row.roleCode) ?? "待核实";
}

function isAdmin(row: Rec): boolean | null {
  const flag = row.is_admin ?? row.isAdmin ?? row.is_super_admin ?? row.isSuperAdmin;
  if (typeof flag === "boolean") return flag;
  if (typeof flag === "number") return flag === 1;
  const roles = row.roles ?? row.role_codes ?? row.roleCodes;
  if (Array.isArray(roles)) {
    const names = roles
      .map((r) => (typeof r === "string" ? r : isRecord(r) ? pickString(r.code, r.name) : null))
      .filter(Boolean)
      .map((r) => String(r).toLowerCase());
    if (names.length) return names.some((r) => r === "admin" || r === "platform_admin" || r === "super_admin");
  }
  return null;
}

export interface AdminView {
  rows: Rec[];
  known: boolean;
}

export function adminsOf(people: Rec[]): AdminView {
  let known = false;
  const rows = people.filter((p) => {
    const hit = isAdmin(p);
    if (hit !== null) known = true;
    return hit === true;
  });
  return { rows, known };
}

const BJT = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export interface RoleView {
  name: string;
  nameReason: string | null;
  scope: string;
  scopeReason: string | null;
  scopeRaw: string | null;
  memberCount: number | null;
  memberReason: string | null;
  updatedAt: string | null;
  updatedReason: string | null;
  rawId: string | null;
}

function numberOf(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
    if (Array.isArray(value)) return value.length;
  }
  return null;
}

function beijing(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return BJT.format(date);
}

export function roleView(row: Rec): RoleView {
  const name = pickString(row.role_name, row.roleName, row.name, row.role_code, row.roleCode);
  const scopeRaw = pickString(row.scope, row.scope_type, row.scopeType, row.data_scope, row.dataScope);
  const normalized = scopeRaw?.toLowerCase() ?? null;
  const scope =
    normalized === null
      ? '—'
      : ['tenant', 'global', 'all', 'tenant-shared', 'org', 'organization'].includes(normalized)
        ? '全租户'
        : ['department', 'dept', 'team'].includes(normalized)
          ? '按部门'
          : ['employee', 'self', 'personal', 'own'].includes(normalized)
            ? '仅本人'
            : normalized === 'custom'
              ? '自定义'
              : '其他范围';
  const memberCount = numberOf(
    row.member_count,
    row.memberCount,
    row.members_count,
    row.membersCount,
    row.user_count,
    row.userCount,
    row.members,
    row.users,
  );
  const updatedRaw = pickString(row.updated_at, row.updatedAt, row.modified_at, row.modifiedAt);
  const updatedAt = beijing(updatedRaw);
  return {
    name: name ?? '待核实',
    nameReason: name ? null : '上游未提供角色名',
    scope,
    scopeReason: scopeRaw ? (scope === '其他范围' ? '上游范围值暂无法归类' : null) : '上游未提供数据范围',
    scopeRaw,
    memberCount,
    memberReason: memberCount === null ? '上游未提供成员数' : null,
    updatedAt,
    updatedReason: updatedAt ? null : updatedRaw ? '更新时间无法解析' : '上游未提供更新时间',
    rawId: pickString(row.role_id, row.roleId, row.id, row.role_code, row.roleCode),
  };
}

export async function loadList(
  endpoints: string[],
  gapMessage: string,
): Promise<Resource<Rec[]>> {
  let denied = false;
  let firstError: ApiError | null = null;
  let answered = false;
  for (const url of endpoints) {
    try {
      const body = await fetchJSON<unknown>(url);
      answered = true;
      const items = itemsOf(body);
      return items.length === 0 ? { phase: "empty" } : { phase: "ready", data: items };
    } catch (err: unknown) {
      const api = err instanceof ApiError ? err : null;
      if (api?.status === 403) denied = true;
      else if (api && api.status !== 404 && !firstError) firstError = api;
    }
  }
  if (denied) return { phase: "denied", message: "你没有查看访问控制数据的权限。" };
  if (firstError) {
    return {
      phase: "error",
      message:
        firstError.status && firstError.status >= 500
          ? API_UNREACHABLE_MESSAGE
          : firstError.message || humanizeStatus(firstError.status),
      requestId: firstError.requestId ?? null,
    };
  }
  void answered;
  return { phase: "unavailable", message: gapMessage };
}