/**
 * 员工详情「配置」三族写口（身份 / 生命周期 / 授权）——纯校验 + 请求封装。
 *
 * 后端契约（BFF 已接线并实测，2026-11-26）：
 *  - PATCH /api/employee?id=<id>
 *      头：If-Match=当前 revision（裸数字，W/"5" 会 409）、Idempotency-Key、
 *      Content-Type: application/json、X-Console-CSRF（cookie 双提交）。
 *      体：只允许 name/avatarRef/title/ownerUserId/managerEmployeeId/approvalRef/
 *      department；ownerUserId 恒 409 employee.approval_verification_unavailable，
 *      因此本模块不提供「转交责任人」写入，只给禁用说明。
 *      成功 200 回完整 employee，新 revision 只在响应体里（无 ETag 头）。
 *  - POST /api/employee-transitions {employeeId,to,reason,handoverTo?}
 *      offboarding→archived 域侧未实现（恒 409）⇒ UI 置灰说明。
 *  - POST /api/employee-grants / DELETE /api/employee-grants/<gid>?employeeId=
 *      新建返回 200（不是 201）grant_public；有效授权的唯一读口是
 *      GET /api/effective-config 的 grants[]，新 grant 要随下一版发布才可见。
 *
 * 纪律：本文不做任何「假装成功」的兜底；上游 code 原样交给界面显示。
 */
import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { csrfWriteHeaders } from "@/lib/csrf";

type Rec = Record<string, unknown>;

const EMPLOYEE_PATCH_URL = "/agent-api/api/employee";
const TRANSITIONS_URL = "/agent-api/api/employee-transitions";
const GRANTS_URL = "/agent-api/api/employee-grants";

/* ------------------------------------------------------------------ *
 * 通用：幂等键 / 错误投影
 * ------------------------------------------------------------------ */

/** 一次写入一个幂等键；失败重试同一动作时复用（由调用方持引）。 */
export function newIdempotencyKey(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `edw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export type WriteFailure = {
  status: number;
  /** 上游机器码（`employee.immutable_field` 等）；无 JSON 信封时 null。 */
  code: string | null;
  /** 上游/前端的人话句。 */
  message: string;
  requestId: string | null;
  /** 405，或「404 且上游没给业务码」= 路由本身没接。 */
  readOnly: boolean;
  /** 409 request.precondition_failed：revision 过期，需重读。 */
  staleRevision: boolean;
  /** 428 request.precondition_required：没带 If-Match。 */
  missingPrecondition: boolean;
};

function bodyCode(body: string | null | undefined): string | null {
  if (!body) return null;
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === "object") {
      const code = (parsed as Rec).code;
      if (typeof code === "string" && code.trim()) return code.trim();
      const detail = (parsed as Rec).detail;
      if (detail && typeof detail === "object") {
        const nested = (detail as Rec).code;
        if (typeof nested === "string" && nested.trim()) return nested.trim();
      }
    }
  } catch {
    /* 非 JSON 信封 */
  }
  return null;
}

/** ApiError → 界面可直接显示的失败投影。绝不给写操作造「成功」。 */
export function writeFailure(err: unknown): WriteFailure {
  const api = err instanceof ApiError ? err : null;
  const status = api?.status ?? 0;
  const code = api ? bodyCode(api.body) : null;
  return {
    status,
    code,
    message: api?.message ?? (err instanceof Error ? err.message : String(err)),
    requestId: api?.requestId ?? null,
    readOnly: status === 405 || (status === 404 && code === null),
    staleRevision: status === 409 && code === "request.precondition_failed",
    missingPrecondition: status === 428 || code === "request.precondition_required",
  };
}

/** 屏上一行：`code · message`；没有 code 时只给 message。 */
export function failureLine(f: WriteFailure): string {
  return f.code ? `${f.code} · ${f.message}` : f.message;
}

/** 没有 CSRF cookie 时不发网络（与 tasks/approvals 同款纪律）。 */
export class NoWriteSessionError extends Error {
  constructor() {
    super("需要登录后才能提交。当前没有可用的写入会话，请先登录。");
    this.name = "NoWriteSessionError";
  }
}

function writeHeaders(extra: Record<string, string>): Record<string, string> {
  const csrf = csrfWriteHeaders();
  if (!csrf) throw new NoWriteSessionError();
  return {
    "content-type": "application/json",
    "Idempotency-Key": newIdempotencyKey(),
    ...csrf,
    ...extra,
  };
}

/* ------------------------------------------------------------------ *
 * 身份与组织：草稿校验 + PATCH
 * ------------------------------------------------------------------ */

export const NAME_MAX = 40;
export const TITLE_MAX = 60;
export const DEPARTMENT_MAX = 64;

export type IdentityDraft = { name: string; title: string; department: string };

export type FieldIssue = { field: "name" | "title" | "department"; message: string };

/** 本地校验：name/title 非空且限长；department 可空（空=清空），非空 1..64。 */
export function validateIdentityDraft(draft: IdentityDraft): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const name = draft.name.trim();
  const title = draft.title.trim();
  const department = draft.department.trim();
  if (!name) issues.push({ field: "name", message: "姓名不能为空。" });
  else if (name.length > NAME_MAX) issues.push({ field: "name", message: `姓名最多 ${NAME_MAX} 字。` });
  if (!title) issues.push({ field: "title", message: "岗位不能为空。" });
  else if (title.length > TITLE_MAX) issues.push({ field: "title", message: `岗位最多 ${TITLE_MAX} 字。` });
  if (department.length > DEPARTMENT_MAX) {
    issues.push({ field: "department", message: `部门最多 ${DEPARTMENT_MAX} 字；留空表示清空部门。` });
  }
  return issues;
}

export type IdentityPatch = { name?: string; title?: string; department?: string | null };

/** 只发真正变化的键；部门清空发 null（契约里 null/空串都=清空）。 */
export function buildIdentityPatch(original: IdentityDraft, draft: IdentityDraft): IdentityPatch {
  const patch: IdentityPatch = {};
  if (draft.name.trim() !== original.name.trim()) patch.name = draft.name.trim();
  if (draft.title.trim() !== original.title.trim()) patch.title = draft.title.trim();
  if (draft.department.trim() !== original.department.trim()) {
    const next = draft.department.trim();
    patch.department = next ? next : null;
  }
  return patch;
}

export function patchIsEmpty(patch: IdentityPatch): boolean {
  return Object.keys(patch).length === 0;
}

/** 成功后回包里取 revision（旧 revision + 1 仅作回包缺字段时的诚实兜底）。 */
export function revisionFrom(body: unknown, fallback: number | null): number | null {
  if (body && typeof body === "object") {
    const rev = (body as Rec).revision;
    if (typeof rev === "number" && Number.isFinite(rev)) return rev;
  }
  return fallback === null ? null : fallback + 1;
}

export async function saveEmployeeIdentity(
  empId: string,
  revision: number,
  patch: IdentityPatch,
): Promise<Rec> {
  if (patchIsEmpty(patch)) throw new Error("没有修改，未提交。");
  const body = await fetchJSON<unknown>(`${EMPLOYEE_PATCH_URL}?id=${encodeURIComponent(empId)}`, {
    method: "PATCH",
    headers: writeHeaders({ "If-Match": String(revision) }),
    body: JSON.stringify(patch),
  });
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("后台说保存成功，但回包不是员工档案；请刷新页面核对。");
  }
  return body as Rec;
}

/* ------------------------------------------------------------------ *
 * 生命周期：合法边 + POST transitions
 * ------------------------------------------------------------------ */

export const LIFECYCLE_STATES = ["draft", "onboarding", "active", "paused", "offboarding", "archived"] as const;
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

/** 合法迁移边（域侧口径）。offboarding→archived 未实现，单独标记。 */
const EDGES: Record<LifecycleState, LifecycleState[]> = {
  draft: ["onboarding"],
  onboarding: ["active"],
  active: ["paused", "offboarding"],
  paused: ["active", "offboarding"],
  offboarding: ["archived"],
  archived: [],
};

export type TransitionOption = {
  to: LifecycleState;
  label: string;
  enabled: boolean;
  /** 置灰原因（不 enabled 时必填，上屏 + title）。 */
  reason: string | null;
};

const TRANSITION_LABEL: Record<LifecycleState, string> = {
  draft: "转草稿",
  onboarding: "进入入职",
  active: "恢复在岗",
  paused: "暂停",
  offboarding: "开始离职交接",
  archived: "归档",
};

export function isLifecycleState(value: string | null | undefined): value is LifecycleState {
  return typeof value === "string" && (LIFECYCLE_STATES as readonly string[]).includes(value);
}

/** 当前态可达的按钮；offboarding→archived 恒 409 所以置灰并注明。 */
export function transitionOptions(state: string | null | undefined): TransitionOption[] {
  if (!isLifecycleState(state)) return [];
  return EDGES[state].map((to) => {
    if (state === "offboarding" && to === "archived") {
      return {
        to,
        label: TRANSITION_LABEL[to],
        enabled: false,
        reason: "域侧尚未实现「离职中 → 已归档」这条迁移（调用恒 409），先置灰。",
      };
    }
    return { to, label: TRANSITION_LABEL[to], enabled: true, reason: null };
  });
}

export function transitionNeedsHandover(to: LifecycleState): boolean {
  return to === "offboarding";
}

export type HandoverCandidate = { employeeId: string; name: string | null };

/** /api/employees 回包 → 交接候选（排除当前员工）。 */
export function readHandoverCandidates(body: unknown, selfId: string): HandoverCandidate[] {
  const items = body && typeof body === "object" && Array.isArray((body as Rec).items)
    ? ((body as Rec).items as unknown[])
    : [];
  const out: HandoverCandidate[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Rec;
    const id = rec.employeeId;
    if (typeof id !== "string" || !id.trim() || id === selfId) continue;
    const name = typeof rec.name === "string" && rec.name.trim() ? rec.name.trim() : null;
    out.push({ employeeId: id.trim(), name });
  }
  return out;
}

export async function postTransition(
  empId: string,
  to: LifecycleState,
  reason: string,
  handoverTo?: string | null,
): Promise<Rec> {
  const payload: Rec = { employeeId: empId, to, reason: reason.trim() };
  if (transitionNeedsHandover(to)) payload.handoverTo = (handoverTo ?? "").trim();
  const body = await fetchJSON<unknown>(TRANSITIONS_URL, {
    method: "POST",
    headers: writeHeaders({}),
    body: JSON.stringify(payload),
  });
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Rec) : {};
}

/* ------------------------------------------------------------------ *
 * 授权：表单校验 + 创建 / 撤销
 * ------------------------------------------------------------------ */

export const SCOPE_TYPES = ["business_api", "data", "tool", "channel", "budget", "knowledge"] as const;
export const GRANT_SOURCES = ["role", "temporary", "delegation", "break_glass"] as const;
export type ScopeType = (typeof SCOPE_TYPES)[number];
export type GrantSource = (typeof GRANT_SOURCES)[number];

export const SCOPE_LABEL: Record<ScopeType, string> = {
  business_api: "业务接口",
  data: "数据",
  tool: "工具",
  channel: "通信渠道",
  budget: "预算",
  knowledge: "知识",
};

export const SOURCE_LABEL: Record<GrantSource, string> = {
  role: "角色",
  temporary: "临时",
  delegation: "委派",
  break_glass: "破玻璃",
};

export type GrantDraft = {
  scopeType: string;
  source: string;
  actions: string;
  expiresAt: string;
  approvalRef: string;
  selectorText: string;
};

export type GrantIssue = { field: keyof GrantDraft; message: string };

/** 递归查 `*`（选择器任何层级出现通配都被域侧拒）。 */
export function selectorHasWildcard(value: unknown): boolean {
  if (value === "*") return true;
  if (Array.isArray(value)) return value.some(selectorHasWildcard);
  if (value && typeof value === "object") return Object.values(value).some(selectorHasWildcard);
  return false;
}

/** 选择器文本 → 对象；失败给人话。空对象/通配都在本地拦下。 */
export function parseSelector(text: string): { value: Rec | null; error: string | null } {
  const trimmed = text.trim();
  if (!trimmed) return { value: null, error: "资源选择器不能为空（要一个 JSON 对象）。" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { value: null, error: "资源选择器不是合法 JSON，请检查括号与引号。" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { value: null, error: "资源选择器必须是 JSON 对象，例如 {\"types\":[\"tool\"]}。" };
  }
  if (Object.keys(parsed as Rec).length === 0) {
    return { value: null, error: "资源选择器不能是空对象。" };
  }
  if (selectorHasWildcard(parsed)) {
    return { value: null, error: "资源选择器里不能出现通配符 *（域侧会拒绝）。" };
  }
  return { value: parsed as Rec, error: null };
}

/** actions 逗号/空白分隔 → 去重非空数组。 */
export function parseActions(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[,，\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
}

export function validateGrantDraft(draft: GrantDraft): GrantIssue[] {
  const issues: GrantIssue[] = [];
  if (!SCOPE_TYPES.includes(draft.scopeType as ScopeType)) {
    issues.push({ field: "scopeType", message: "先选授权范围。" });
  }
  if (!GRANT_SOURCES.includes(draft.source as GrantSource)) {
    issues.push({ field: "source", message: "先选授权来源。" });
  }
  if (parseActions(draft.actions).length === 0) {
    issues.push({ field: "actions", message: "动作至少填一个（逗号或空格分隔）。" });
  }
  const selector = parseSelector(draft.selectorText);
  if (selector.error) issues.push({ field: "selectorText", message: selector.error });
  if (!draft.expiresAt.trim()) {
    issues.push({ field: "expiresAt", message: "有效期是必填的（服务端没有默认值）。" });
  } else if (!Number.isFinite(Date.parse(draft.expiresAt))) {
    issues.push({ field: "expiresAt", message: "有效期格式无法识别，请重新选择时间。" });
  }
  if (draft.source !== "role" && draft.source.trim() && !draft.approvalRef.trim()) {
    issues.push({ field: "approvalRef", message: "非角色来源必须填审批引用（approvalRef）。" });
  }
  return issues;
}

/** datetime-local（本机时区）→ ISO-8601；空/非法回 null。 */
export function toIsoOrNull(local: string): string | null {
  if (!local.trim()) return null;
  const ms = Date.parse(local);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** datetime-local 的默认值：现在 + days 天（本机时区，供表单预填）。 */
export function defaultExpiryLocal(now: number, days = 7): string {
  const d = new Date(now + days * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type GrantBody = {
  employeeId: string;
  scopeType: ScopeType;
  source: GrantSource;
  resourceSelector: Rec;
  actions: string[];
  expiresAt: string;
  approvalRef?: string;
};

/** 校验通过的草稿 → 请求体（不含 scopeId；契约里没有这个字段）。 */
export function buildGrantBody(empId: string, draft: GrantDraft): GrantBody {
  const selector = parseSelector(draft.selectorText);
  if (selector.error || !selector.value) throw new Error(selector.error ?? "资源选择器无效。");
  const expiresAt = toIsoOrNull(draft.expiresAt);
  if (!expiresAt) throw new Error("有效期无效。");
  const body: GrantBody = {
    employeeId: empId,
    scopeType: draft.scopeType as ScopeType,
    source: draft.source as GrantSource,
    resourceSelector: selector.value,
    actions: parseActions(draft.actions),
    expiresAt,
  };
  if (draft.source !== "role" && draft.approvalRef.trim()) body.approvalRef = draft.approvalRef.trim();
  return body;
}

export type CreatedGrant = { id: string | null; raw: Rec };

/** 200 回包 → grant_public（id 形如 gr_…）；取不到 id 不编造。 */
export function readCreatedGrant(body: unknown): CreatedGrant {
  const raw = body && typeof body === "object" && !Array.isArray(body) ? (body as Rec) : {};
  const direct = raw.id;
  if (typeof direct === "string" && direct.trim()) return { id: direct.trim(), raw };
  const grant = raw.grant;
  if (grant && typeof grant === "object") {
    const nested = (grant as Rec).id;
    if (typeof nested === "string" && nested.trim()) return { id: nested.trim(), raw };
  }
  return { id: null, raw };
}

export async function createGrant(empId: string, draft: GrantDraft): Promise<CreatedGrant> {
  const body = buildGrantBody(empId, draft);
  const res = await fetchJSON<unknown>(GRANTS_URL, {
    method: "POST",
    headers: writeHeaders({}),
    body: JSON.stringify(body),
  });
  return readCreatedGrant(res);
}

export type RevokedGrant = { grantId: string; revokedAt: string | null };

export async function revokeGrant(empId: string, grantId: string): Promise<RevokedGrant> {
  const res = await fetchJSON<unknown>(
    `${GRANTS_URL}/${encodeURIComponent(grantId)}?employeeId=${encodeURIComponent(empId)}`,
    {
      method: "DELETE",
      headers: writeHeaders({}),
    },
  );
  const revokedAt =
    res && typeof res === "object" && typeof (res as Rec).revokedAt === "string"
      ? ((res as Rec).revokedAt as string)
      : null;
  return { grantId, revokedAt };
}

/* ------------------------------------------------------------------ *
 * 表单取值（与既有读口同一拼写宽容度）
 * ------------------------------------------------------------------ */

export function readIdentityDraft(d: Rec): IdentityDraft {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return { name: str(d.name), title: str(d.title), department: str(d.department) };
}

export function readRevision(d: Rec): number | null {
  const rev = d.revision;
  return typeof rev === "number" && Number.isFinite(rev) ? rev : null;
}
