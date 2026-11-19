/**
 * audit read model — tolerant readers for whatever the BFF answers (T33).
 *
 * The same two laws the approvals module runs on, plus one of its own:
 *   1. A value the service did not send stays missing. It renders `—` with a
 *      reason in its `title`, never `0`, never `""`, never a guess.
 *   2. What reaches the screen is a sentence a person wrote or a number they
 *      can act on. Handles (`emp_…`, `human:1`, UUIDs), raw enum tokens,
 *      digests, tenant ids and HTTP codes stay off the surface: `title`
 *      attributes and the collapsed 「技术详情」 disclosure carry them.
 *   3. An event type we do not know is shown VERBATIM. We relabel only the
 *      codes this repo's own domain vocabulary names; anything else keeps its
 *      own spelling rather than being machine-translated into a guess.
 *
 * Field keys are read as a list of candidates (snake_case OR camelCase OR the
 * short BFF aliases) because the audit contract is not sampled in this repo —
 * see docs/_artifacts/appr/DONE.md §T33-7. Absent stays absent.
 */

/** The tones the vendored Badge accepts (its own union is not exported). */
export type Tone = "default" | "destructive" | "outline" | "secondary" | "success" | "warning";

// ── Formatting ───────────────────────────────────────────────────────

const BEIJING = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Beijing wall clock to the minute; null when the value is absent or unreadable. */
export function beijing(value: unknown): string | null {
  const raw = textOf(value);
  if (!raw) return null;
  let date: Date;
  if (/^\d{9,10}$/.test(raw)) date = new Date(Number(raw) * 1000);
  else if (/^\d{11,13}$/.test(raw)) date = new Date(Number(raw));
  else if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/.test(raw)) date = new Date(raw);
  else return null; // free text is not a timestamp
  if (Number.isNaN(date.getTime())) return null;
  return BEIJING.format(date).replace(/,\s*/, " ");
}

// ── Defensive readers ────────────────────────────────────────────────

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textOf(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function numberOf(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = typeof value === "string" ? value.trim().replace(/[,\s]/g, "") : "";
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** First key that actually carries something. Absent keys are skipped, not zeroed. */
export function pick(rec: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    const value = rec[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function pickText(rec: Record<string, unknown>, keys: readonly string[]): string | null {
  return textOf(pick(rec, keys));
}

function pickNumber(rec: Record<string, unknown>, keys: readonly string[]): number | null {
  return numberOf(pick(rec, keys));
}

/** A nested object under one of several key spellings (`actor`, `resource`, `error`). */
function pickRecord(rec: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> | null {
  for (const key of keys) {
    const hit = asRecord(rec[key]);
    if (hit) return hit;
  }
  return null;
}

// ── Identity ─────────────────────────────────────────────────────────

// `t_` is the tenant short form this deployment actually sends (`t_seakoi_pilot`,
// live-probed 2026-11-19); it must read as a handle so the workspace id is
// masked on the surface. It sits last so the longer words win first.
const SCHEME_PREFIX = /^(?:emp|employee|agent|human|user|member|staff|svc|service|run|task|approval|policy|tenant|corr|session|t)[_:=@/#-]/i;
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_HEX = /^[0-9a-f]{16,}$/i;

/**
 * Any scheme-prefixed handle, whether or not its scheme is in the list above:
 * `ap_123DE49B9A1F42A197679681F1` (an approval), `ce_01M7AJ3Q…`, `dl_01ABC…`.
 * The live audit answer carries `ap_` and `01A1LIVE…` handles, so a fixed
 * scheme list alone let them reach the screen in full (2026-11-20 defect).
 */
const SCHEME_HANDLE = /^[a-z][a-z0-9]{1,11}_[0-9A-Za-z]{4,}$/i;
/** A long separator-free token: a ULID-ish id (`01A1LIVE202611170000000002`). */
const OPAQUE_TOKEN = /^[0-9A-Za-z]{16,}$/;

export function isMachineHandle(value: string): boolean {
  return (
    SCHEME_PREFIX.test(value) ||
    UUID_SHAPE.test(value) ||
    LONG_HEX.test(value) ||
    SCHEME_HANDLE.test(value) ||
    OPAQUE_TOKEN.test(value) ||
    /^emp_/i.test(value)
  );
}

/**
 * The tail worth showing: the last segment of a scheme-prefixed handle
 * (`emp_9c1f2a3b4d5e6f70` → `9c1f2a3b4d5e6f70`), alphanumeric only, at most
 * `size` characters. Shorter than four characters is not a code worth
 * showing, so the caller falls back to the bare role instead of painting a
 * fragment of `human:1`.
 */
export function shortCode(value: string, size = 8): string {
  const tail = value
    .split(/[:_/@#-]/)
    .filter(Boolean)
    .pop();
  const clean = (tail ?? "").replace(/[^0-9A-Za-z]/g, "");
  if (clean.length < 4) return "";
  return clean.slice(-size);
}

/**
 * 「姓名 · 8位短码」 when a name came with the id, 「员工 · 短码」 when only the
 * handle arrived, and the bare role when there is not even a code worth
 * showing. A raw `emp_…` / `human:1` / UUID never becomes the label.
 */
export function maskedName(rawName: string | null, rawId: string | null, noun: string): { label: string; raw: string | null } {
  // Neither a name nor an id arrived: the record was never attributed to anyone,
  // and 「未指派」 says that plainly instead of showing a bare handle or a dash.
  if (!rawName && !rawId) return { label: "未指派", raw: null };
  const id = rawId ?? rawName ?? "";
  const code = shortCode(id);
  const name = rawName && !isMachineHandle(rawName) ? rawName : null;
  if (name && code) return { label: `${name} · ${code}`, raw: id || rawName };
  if (name) return { label: name, raw: id || rawName };
  if (code) return { label: `${noun} · ${code}`, raw: id };
  return { label: noun, raw: id || null };
}

export interface Person {
  /** What the screen shows — always masked, never a handle. */
  label: string;
  /** The raw identifier, for `title` / 「技术详情」 only. */
  raw: string | null;
  /** The actor kind as the service spelled it — technical, disclosure only. */
  kind: string | null;
  /** The same kind in the words this repo uses (员工 / 成员 / 系统 …), or null. */
  kindLabel: string | null;
}

const ACTOR_NOUN: Record<string, string> = {
  employee: "员工",
  agent: "员工",
  bot: "员工",
  human: "成员",
  user: "成员",
  member: "成员",
  staff: "成员",
  service: "服务账号",
  svc: "服务账号",
  system: "系统",
};

const ACTOR_KEYS = ["actor", "operator", "subject", "who"] as const;
const ACTOR_NAME_KEYS = ["displayName", "display_name", "name", "label", "fullName", "actorName", "actor_name"] as const;
const ACTOR_ID_KEYS = ["id", "userId", "user_id", "actorId", "actor_id", "key", "identifier"] as const;
const ACTOR_TYPE_KEYS = ["type", "kind", "actorType", "actor_type"] as const;
const FLAT_ACTOR_NAME_KEYS = ["actorDisplayName", "actor_display_name", "actorName", "actor_name", "operatorName", "operator_name", "byName", "by_name"] as const;
const FLAT_ACTOR_ID_KEYS = ["actorId", "actor_id", "actor", "actorRef", "operator", "operatorId", "operator_id", "by", "userId", "user_id"] as const;
const FLAT_ACTOR_TYPE_KEYS = ["actorType", "actor_type", "actorKind", "actor_kind", "operatorType", "operator_type"] as const;

const SCHEME_NOUN: Record<string, string> = {
  emp: "员工",
  employee: "员工",
  agent: "员工",
  bot: "员工",
  human: "成员",
  user: "成员",
  member: "成员",
  staff: "成员",
  svc: "服务账号",
  service: "服务账号",
  system: "系统",
};

/** The scheme inside a handle (`employee:8812…`) is the role the person means. */
function nounFromHandle(value: string): string | null {
  const prefix = /^([A-Za-z]+)[_:=@/#-]/.exec(value.trim());
  return prefix ? SCHEME_NOUN[prefix[1]!.toLowerCase()] ?? null : null;
}

export function actorView(rec: Record<string, unknown>): Person {
  const nested = pickRecord(rec, ACTOR_KEYS);
  const name = nested
    ? pickText(nested, ACTOR_NAME_KEYS) ?? pickText(rec, FLAT_ACTOR_NAME_KEYS)
    : pickText(rec, FLAT_ACTOR_NAME_KEYS);
  const id = nested
    ? pickText(nested, ACTOR_ID_KEYS) ?? pickText(rec, FLAT_ACTOR_ID_KEYS)
    : pickText(rec, FLAT_ACTOR_ID_KEYS);
  const typeRaw = (nested ? pickText(nested, ACTOR_TYPE_KEYS) : null) ?? pickText(rec, FLAT_ACTOR_TYPE_KEYS);
  const noun =
    (typeRaw ? ACTOR_NOUN[typeRaw.trim().toLowerCase()] : null) ??
    (id ? nounFromHandle(id) : null) ??
    "操作者";
  const view = maskedName(name, id, noun);
  return {
    label: view.label,
    raw: view.raw ?? id ?? name,
    kind: typeRaw,
    // The mapped word is shown; the spelling the service used is not.
    kindLabel: typeRaw ? noun : null,
  };
}

/** An id-shaped value spoken as 「名词 · 短码」, raw kept for `title`. */
export function maskedRef(value: string | null, noun: string, size = 8): { label: string; raw: string | null } {
  if (!value) return { label: "—", raw: null };
  if (!isMachineHandle(value) && !/[\dA-Fa-f]{12,}/.test(value)) {
    // A human-readable ref (a slug, a name) is data, not a handle: keep it.
    return { label: value, raw: value };
  }
  const code = shortCode(value, size);
  return { label: code ? `${noun} · ${code}` : noun, raw: value };
}

/** A digest: first characters only on the surface, the whole thing in `title`. */
export function maskedDigest(value: string | null, size = 10): { label: string; raw: string | null } {
  if (!value) return { label: "—", raw: null };
  const clean = value.trim();
  if (clean.length <= size) return { label: clean, raw: clean };
  return { label: `${clean.slice(0, size)}…`, raw: clean };
}

// ── Event type vocabulary ────────────────────────────────────────────

/**
 * Only the codes this repo's own domain names are relabelled: the approval
 * verbs and change kinds from `modules/approvals/model.ts`, and the entities
 * the panes in `shell/routes.ts` work on (runs, tasks, employees, skills,
 * knowledge, budget, policy, grants, messages, delegations, sessions, tools).
 * Anything else is shown verbatim — an unknown code is never machine-translated
 * into a claim we did not get. Provenance and the unverified enum are recorded
 * in docs/_artifacts/appr/DONE.md (§T33-2, §T33-7).
 *
 * The block marked LIVE (2026-11-19) was added from codes SAMPLED VERBATIM off
 * the running service (docs/_artifacts/aud/DONE.md closeout table); their
 * labels are mechanical translations of the service's own word parts plus the
 * outcome/decision fields that came with them — not invented semantics.
 * `dispatch.event` is deliberately NOT labelled: the name alone does not say
 * what was dispatched, so it stays verbatim.
 */
const ACTION_LABEL: Record<string, string> = {
  // approvals
  approval_requested: "提交审批申请",
  approval_created: "提交审批申请",
  approval_approved: "批准审批",
  approval_decision: "给出审批结论",
  approval_rejected: "驳回审批",
  approval_denied: "驳回审批",
  approval_revise_requested: "要求修改后重新提交",
  approval_expired: "审批超时未处理",
  approval_cancelled: "撤回审批申请",
  approval_consumed: "按审批结论执行",
  approval_executed: "按审批结论执行",
  approval_superseded: "用新单替代审批",
  // runs
  run_started: "启动一次运行",
  run_completed: "运行完成",
  run_succeeded: "运行完成",
  run_failed: "运行失败",
  run_cancelled: "取消运行",
  run_retried: "重试运行",
  run_events_flushed: "写入运行事件",
  // tasks
  task_created: "创建任务",
  task_updated: "更新任务",
  task_assigned: "指派任务",
  task_completed: "完成任务",
  task_failed: "任务失败",
  task_cancelled: "取消任务",
  // employees + versions
  employee_created: "新建数字员工",
  employee_updated: "修改数字员工配置",
  employee_paused: "停用数字员工",
  employee_resumed: "启用数字员工",
  employee_version_created: "发布数字员工新版本",
  employee_version_publish: "发布数字员工新版本",
  employee_version_rolled_back: "回滚数字员工版本",
  // capabilities
  skill_installed: "安装技能",
  skill_updated: "更新技能",
  skill_removed: "卸载技能",
  skill_proposal_created: "提交技能提案",
  skill_proposal_approved: "采纳技能提案",
  skill_proposal_rejected: "驳回技能提案",
  model_assigned: "调整模型分配",
  channel_updated: "变更接入渠道",
  // knowledge
  knowledge_source_created: "新增知识来源",
  knowledge_source_removed: "移除知识来源",
  document_uploaded: "上传文档",
  document_deleted: "删除文档",
  index_rebuilt: "重建索引",
  // money + rules
  budget_updated: "调整预算",
  budget_exceeded: "超出预算",
  policy_updated: "修改策略",
  policy_evaluated: "评估策略",
  grant_escalation: "提高权限",
  permission_granted: "授予权限",
  permission_revoked: "收回权限",
  owner_transfer: "移交负责人",
  // talking outward
  message_sent: "对外发送消息",
  message_send_failed: "对外发送消息失败",
  // collaboration + identity
  delegation_created: "发起委托",
  delegation_accepted: "接受委托",
  delegation_declined: "谢绝委托",
  session_created: "新建会话",
  session_ended: "结束会话",
  tool_invoked: "调用工具",
  member_added: "添加成员",
  member_removed: "移除成员",
  role_assigned: "分配角色",
  api_key_rotated: "轮换接口密钥",
  // integrity chain
  chain_verified: "核对完整性链",
  // ── LIVE additions, 2026-11-19. Each label is a direct composition of words
  // this table already approved (task/employee/approval/grant verbs); codes
  // whose subject token was not already named are left UNLABELLED and render
  // verbatim, never machine-translated into a claim (§T33-2 law 3).
  approval_decided: "给出审批结论",
  grant_created: "授予权限",
  employee_create_denied: "驳回新建数字员工",
  // ── LIVE additions, 2026-11-20 (R31). Seven codes the list rendered as bare
  // dotted machine words; each label is again a direct word-by-word reading of
  // the code, not an interpretation of what happened. `dispatch.event` is left
  // out on purpose: its two words name no object in this vocabulary, so it
  // falls to the shared unmapped label below and its raw spelling rides the
  // row title (never the other way round).
  employee_lifecycle_transitioned: "变更员工生命周期",
  employee_lifecycle_denied: "驳回员工生命周期变更",
  workstation_bound: "绑定工位",
  workstation_bind_conflict: "工位绑定冲突",
  budget_ledger_entry_applied: "记录一笔预算流水",
  budget_ledger_ensured: "核对预算账本",
  budget_soft_alert_sent: "发出预算提醒",
};

/**
 * The one label an unmapped `action` is allowed to show. R31: a screen never
 * prints the dotted machine spelling — an unlisted code reads 其他事件 and the
 * raw value lives in the row title and the technical fold, so a person sees
 * words and support still gets the exact code.
 */
export const OTHER_ACTION_LABEL = "其他事件";

/**
 * The `action` codes sampled verbatim off the running BFF (2026-11-19 session
 * probe — HTTP 200, distinct `action` values in docs/_artifacts/aud/DONE.md).
 * The filter dropdown offers these EXACT spellings because the service matches
 * `action` literally: the dotted `task.created` answers, the underscore
 * `task_created` (this file's own normalize key) answers ZERO, so the wire
 * must carry the dotted form.
 */
export const LIVE_ACTION_CODES: readonly string[] = [
  "employee.create.denied",
  "employee.created",
  "employee.version.created",
  "employee.lifecycle.transitioned",
  "employee.lifecycle.denied",
  "approval.decided",
  "approval.consumed",
  "approval.expired",
  "task.created",
  "grant.created",
  "dispatch.event",
  "workstation.bound",
  "workstation.bind_conflict",
  "budget.ledger_entry_applied",
  "budget.ledger_ensured",
  "budget.soft_alert_sent",
];

/**
 * Wire spellings of one code fold onto one key: `ApprovalRejected`,
 * `approval.rejected`, `approval-rejected` and `approval_rejected` are the same
 * action. camelCase is split before lowering, so no spelling escapes the map.
 */
function normalize(raw: string | null): string {
  return (raw ?? "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[.:/-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export interface ActionView {
  /** Chinese for a code we know; 其他事件 when we do not. Never the raw code. */
  label: string;
  raw: string | null;
  /** False = the code is unmapped, so the surface says 其他事件 and keeps raw in a title. */
  known: boolean;
}

export function actionView(raw: string | null): ActionView {
  const key = normalize(raw);
  const hit = key ? ACTION_LABEL[key] : undefined;
  if (hit) return { label: hit, raw, known: true };
  const text = (raw ?? "").trim();
  return { label: text ? OTHER_ACTION_LABEL : "—", raw, known: false };
}

/**
 * The 事件类型 filter's options: the live `action` codes the service was
 * probed to use (2026-11-19), sent VERBATIM so the exact-match `action`
 * parameter actually answers. A code we know in words gets its Chinese label;
 * one we do not is offered under its own spelling rather than a claim. Codes
 * from the internal vocabulary that were never seen on the wire are NOT
 * offered — a choice that would filter to zero rows is a control that
 * pretends.
 */
export function eventTypeChoices(): { value: string; label: string }[] {
  return LIVE_ACTION_CODES.map((value) => ({ value, label: actionView(value).label })).sort((a, b) =>
    a.label.localeCompare(b.label, "zh-CN"),
  );
}

// ── Outcome vocabulary ───────────────────────────────────────────────

export type OutcomeKind = "success" | "failure" | "pending" | "unknown";

const OUTCOME_SUCCESS: Record<string, true> = {
  success: true, succeeded: true, successful: true, ok: true, complete: true, completed: true,
  done: true, passed: true, accepted: true, approved: true, allowed: true, granted: true, executed: true,
};
const OUTCOME_FAILURE: Record<string, true> = {
  fail: true, failed: true, failure: true, error: true, rejected: true, denied: true, declined: true,
  blocked: true, aborted: true, timeout: true, timed_out: true, expired: true, cancelled: true, canceled: true,
};
const OUTCOME_PENDING: Record<string, true> = {
  pending: true, awaiting: true, waiting: true, queued: true, in_progress: true, inprogress: true,
  running: true, open: true, scheduled: true, needs_decision: true, started: true,
};

export interface OutcomeView {
  /** 成功 / 失败（被拒）/ 待完成 / 结果未识别. */
  label: string;
  kind: OutcomeKind;
  tone: Tone;
  raw: string | null;
}

export function outcomeView(raw: string | null): OutcomeView {
  const key = normalize(raw);
  if (key && OUTCOME_SUCCESS[key]) return { label: "成功", kind: "success", tone: "success", raw };
  if (key && OUTCOME_FAILURE[key]) return { label: "失败（被拒）", kind: "failure", tone: "destructive", raw };
  if (key && OUTCOME_PENDING[key]) return { label: "待完成", kind: "pending", tone: "warning", raw };
  return { label: "结果未识别", kind: "unknown", tone: "secondary", raw };
}

/** Sentences people wrote. A stack trace, a URL or a JSON blob is not one. */
export function humanSentence(value: string | null): string | null {
  if (!value) return null;
  const oneLine = value.replace(/\s+/g, " ").trim();
  if (!oneLine || oneLine.length > 220) return null;
  if (/[{}<>]|\bat\s+\S+\.\S+|https?:\/\//i.test(oneLine)) return null;
  if (/^\d{3}\s/.test(oneLine)) return null;
  // A bare vocabulary token (`not_applicable`, `dispatch.event`) is a machine
  // spelling, not a sentence: the screen says 「其他事件」/no reason line and the
  // token stays in the technical fold (R31, measured live on 22 rows).
  if (/^[a-z][a-z0-9]*(?:[._][a-z0-9]+)+$/i.test(oneLine)) return null;
  return oneLine;
}

// ── Key lists (the contract may answer snake_case or camelCase) ──────

const ID_KEYS = ["eventId", "event_id", "id", "auditId", "audit_id", "uuid"] as const;
const OCCURRED_KEYS = ["occurredAt", "occurred_at", "at", "created_at", "createdAt", "timestamp", "time", "eventTime", "event_time"] as const;
const RECORDED_KEYS = ["recordedAt", "recorded_at", "ingestedAt", "ingested_at", "writtenAt", "written_at"] as const;
const ACTION_KEYS = ["action", "event_type", "eventType", "type", "operation", "eventName", "event_name", "op"] as const;
const OUTCOME_KEYS = ["outcome", "result", "status", "state"] as const;
const REASON_KEYS = ["message", "reason", "reasonText", "reason_text", "detail", "description", "summary", "note", "comment"] as const;
const ERROR_MESSAGE_KEYS = ["messageRedacted", "message_redacted", "message", "detail", "reason"] as const;
const ERROR_CODE_KEYS = ["code", "errorCode", "error_code"] as const;
const RESOURCE_KEYS = ["resource", "target", "object", "entity"] as const;
const RESOURCE_ID_KEYS = ["id", "resourceId", "resource_id", "targetId", "target_id", "key", "uri", "path"] as const;
const RESOURCE_TYPE_KEYS = ["type", "kind", "resourceType", "resource_type", "category"] as const;
const SOURCE_KEYS = ["sourceSystem", "source_system", "source", "sourceName", "source_name", "service", "component"] as const;
const TENANT_KEYS = ["tenantId", "tenant_id", "tenant", "workspaceId", "workspace_id", "orgId", "org_id"] as const;
const HASH_KEYS = ["hash", "eventHash", "event_hash", "digest", "checksum", "signature"] as const;
const PREV_HASH_KEYS = ["prevHash", "prev_hash", "previousHash", "previous_hash", "parentHash", "parent_hash"] as const;
const LIST_KEYS = ["items", "events", "audit", "entries", "results", "records", "data", "list"] as const;
const CURSOR_KEYS = ["nextCursor", "next_cursor", "next", "cursor", "nextPage", "next_page"] as const;
const ERROR_KEYS = ["error", "failure", "errorInfo", "error_info"] as const;
/**
 * 请求编号 — the number a person quotes when something went wrong. Request-shaped
 * keys win over correlation/trace ones; an answer with neither shows 「未提供」.
 */
const REQUEST_ID_KEYS = ["requestId", "request_id", "reqId", "req_id", "requestNo", "request_no"] as const;
const TRACE_ID_KEYS = ["correlationId", "correlation_id", "traceId", "trace_id"] as const;

/** The related ids the console chains together, each named the way a person reads it. */
const LINK_SPECS: readonly { keys: readonly string[]; noun: string }[] = [
  { keys: ["runId", "run_id", "run"], noun: "运行" },
  { keys: ["taskId", "task_id", "task"], noun: "任务" },
  { keys: ["approvalId", "approval_id", "approval"], noun: "审批单" },
  { keys: ["policyDecisionId", "policy_decision_id", "policyDecision", "policy_decision"], noun: "策略判定" },
  { keys: ["employeeId", "employee_id", "employee"], noun: "员工" },
  { keys: ["sessionId", "session_id", "session"], noun: "会话" },
  { keys: ["skillId", "skill_id", "skill"], noun: "技能" },
  { keys: ["correlationId", "correlation_id", "traceId", "trace_id"], noun: "同一次操作" },
];

export interface AuditLink {
  noun: string;
  label: string;
  raw: string | null;
}

function linksOf(rec: Record<string, unknown>): AuditLink[] {
  const out: AuditLink[] = [];
  for (const spec of LINK_SPECS) {
    const raw = pickText(rec, spec.keys);
    if (!raw) continue;
    const view = maskedRef(raw, spec.noun);
    out.push({ noun: spec.noun, label: view.label, raw: view.raw });
  }
  return out;
}

// ── Row / page models ────────────────────────────────────────────────

export interface AuditRow {
  key: string;
  rawId: string | null;
  action: ActionView;
  outcome: OutcomeView;
  actor: Person;
  resource: { label: string; raw: string | null };
  occurredAt: string | null;
  /** Raw instant when the service sent one; the inline preview needs seconds. */
  occurredAtRaw?: string | null;
  recordedAt: string | null;
  /** 请求编号 — what the service called this request, or null when it said none. */
  requestId: string | null;
  /** The correlation handle, masked on screen and raw only in the fold. */
  correlation: string | null;
  /** Why it failed / what was decided, in human words only. */
  reason: string | null;
}

function resourceOf(rec: Record<string, unknown>): { label: string; raw: string | null } {
  const nested = pickRecord(rec, RESOURCE_KEYS);
  const rawId = (nested ? pickText(nested, RESOURCE_ID_KEYS) : null) ?? pickText(rec, ["resourceId", "resource_id", "targetId", "target_id"]);
  const type = (nested ? pickText(nested, RESOURCE_TYPE_KEYS) : null) ?? pickText(rec, ["resourceType", "resource_type"]);
  const noun = type ? resourceNoun(type) : "对象";
  if (!rawId) return type ? { label: noun, raw: null } : { label: "—", raw: null };
  // 「资源类型 · 短码」 — the type is a domain word, the id stays masked.
  const code = shortCode(rawId);
  if (code) return { label: `${noun} · ${code}`, raw: rawId };
  if (!isMachineHandle(rawId)) return { label: rawId, raw: rawId };
  return { label: noun, raw: rawId };
}

const RESOURCE_NOUN: Record<string, string> = {
  employee: "员工",
  agent: "员工",
  run: "运行",
  task: "任务",
  approval: "审批单",
  policy_decision: "策略判定",
  policy: "策略",
  skill: "技能",
  knowledge_source: "知识来源",
  document: "文档",
  budget: "预算",
  message: "消息",
  session: "会话",
  delegation: "委托",
  member: "成员",
  user: "成员",
  role: "角色",
  permission: "权限",
  model: "模型",
  channel: "接入渠道",
  webhook: "回调地址",
  api_key: "接口密钥",
  // ── Resource types sampled live 2026-11-19 (docs/_artifacts/aud/DONE.md);
  // without these the 对象 column / 资源 section would echo the English token.
  creation_attempt: "建号申请",
  channel_event: "渠道事件",
  workstation: "工位",
  grant: "授权",
};

function resourceNoun(type: string): string {
  // R31: an unmapped resource type used to print its English token (e.g.
  // `creation_attempt`) in the 对象 column. It now reads 对象; the raw type
  // stays in the resource id's title and in the technical fold.
  return RESOURCE_NOUN[normalize(type)] ?? "对象";
}

function errorText(rec: Record<string, unknown>): string | null {
  const nested = pickRecord(rec, ERROR_KEYS);
  return nested ? humanSentence(pickText(nested, ERROR_MESSAGE_KEYS)) : null;
}

function errorCode(rec: Record<string, unknown>): string | null {
  const nested = pickRecord(rec, ERROR_KEYS);
  return nested ? pickText(nested, ERROR_CODE_KEYS) : null;
}

/**
 * The reason line the screen shows: a person's words, or nothing at all.
 *
 * R31: it used to fall back to the `decision` vocabulary, so every successful
 * `task.created` painted 「原因：not_applicable」 — an enum spelling presented as
 * a cause. The decision is its own field (and its own badge where it belongs);
 * a row only carries a 原因 when the answer carries a sentence.
 */
function reasonOf(rec: Record<string, unknown>): string | null {
  const fromError = errorText(rec);
  if (fromError) return fromError;
  return humanSentence(pickText(rec, REASON_KEYS));
}

/**
 * The request number on the surface: a real identifier a person quotes to
 * support, so a genuine one (a short hex code from the BFF) is shown in full,
 * breakable, and paired with 「技术编号」 in the `title`. `null` = the answer
 * carried none, and the screen says 「未提供」 with the reason — it never
 * borrows a business handle to fill the line.
 */
function requestIdOf(rec: Record<string, unknown>): string | null {
  // Only a field the service calls a request number. It used to fall back to
  // `correlationId`, which in this tenant carries a business handle
  // (`ap_123DE49B9A1F42A197679681F1`, `01A1LIVE202611170000000002`) — that put a
  // full record handle on screen dressed as 「请求编号」. A correlation value is
  // still shown, but as the masked 同一次操作 link and in the technical fold.
  return pickText(rec, REQUEST_ID_KEYS);
}

/** The correlation handle, shown masked (同一次操作 · 短码) and raw in the fold. */
function correlationOf(rec: Record<string, unknown>): string | null {
  return pickText(rec, TRACE_ID_KEYS);
}

function rowFrom(item: unknown, index: number): AuditRow | null {
  const rec = asRecord(item);
  if (!rec) return null;
  const rawId = pickText(rec, ID_KEYS);
  const action = actionView(pickText(rec, ACTION_KEYS));
  // No identifier and no event type: nothing tells this record apart from the
  // next one, so it is counted as unreadable instead of painted as a blank row.
  if (!rawId && !(action.raw ?? "").trim()) return null;
  const outcome = outcomeView(pickText(rec, OUTCOME_KEYS));
  return {
    key: rawId ?? `audit-${index}`,
    rawId,
    action,
    outcome,
    actor: actorView(rec),
    resource: resourceOf(rec),
    occurredAt: beijing(pick(rec, OCCURRED_KEYS)),
    occurredAtRaw: pickText(rec, OCCURRED_KEYS),
    recordedAt: beijing(pick(rec, RECORDED_KEYS)),
    requestId: requestIdOf(rec),
    correlation: correlationOf(rec),
    reason: reasonOf(rec),
  };
}

export interface AuditPage {
  rows: AuditRow[];
  /** Records the answer carried but that could not be read — counted, never dressed up. */
  unreadable: number;
  next: string | null;
}

/** null = the answer is not a list at all, which is a failure, not an empty ledger. */
export function auditPageFrom(payload: unknown): AuditPage | null {
  let items: unknown[] | null = null;
  let next: string | null = null;
  if (Array.isArray(payload)) {
    items = payload;
  } else {
    const outer = asRecord(payload);
    if (!outer) return null;
    // Some gateways wrap the page: {audit: {items: []}}, {data: {entries: []}}.
    let rec = outer;
    for (const key of ["audit", "page", "data", "result", "payload"]) {
      const inner = asRecord(outer[key]);
      if (inner && LIST_KEYS.some((k) => Array.isArray(inner[k]))) {
        rec = inner;
        break;
      }
    }
    for (const key of LIST_KEYS) {
      const value = rec[key];
      if (Array.isArray(value)) {
        items = value;
        break;
      }
    }
    next = pickText(rec, CURSOR_KEYS);
    if (!items) return null;
  }
  const rows: AuditRow[] = [];
  let unreadable = 0;
  items.forEach((item, index) => {
    const row = rowFrom(item, index);
    if (row) rows.push(row);
    else unreadable += 1;
  });
  return { rows, unreadable, next };
}

// ── Detail model ─────────────────────────────────────────────────────

export interface AuditChange {
  /** Only true when the answer carried a before/after value to compare. */
  present: boolean;
  /** Human-readable sides only. A machine-shaped value is `null` here and
   *  lives in `technical` instead — the human layer never shows field names. */
  before: string | null;
  after: string | null;
  /** True when that side exists but was folded away as engineering text. */
  folded: { before: boolean; after: boolean };
  /** Field names the change touched — technical, disclosure-only. */
  technical: string[];
}

/**
 * A value spoken to a person, plus whether it is really engineering text.
 *
 * `machine` is true for anything that is a wire shape rather than a sentence:
 * a JSON blob, a bare list of field names, an id/handle. Those belong in
 * 「技术详情」, never on the human layer (T33 closeout, criterion 2).
 */
function humanValue(value: unknown): { text: string; machine: boolean } | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return { text: "", machine: false };
    if (/^[{[]/.test(text)) return { text, machine: true };
    if (isMachineHandle(text)) return { text, machine: true };
    return { text, machine: false };
  }
  if (typeof value === "number" || typeof value === "boolean") return { text: String(value), machine: false };
  const rec = asRecord(value);
  if (rec) {
    const named = pickText(rec, ["value", "display", "label", "text", "name"]);
    if (named && !isMachineHandle(named)) return { text: named, machine: false };
    const keys = Object.keys(rec);
    // No displayable value: only field names remain, which is engineering text.
    return { text: keys.length ? `{${keys.join("、")}}` : "", machine: true };
  }
  if (Array.isArray(value)) return { text: value.length ? `共 ${value.length} 项` : "", machine: false };
  return null;
}

function stringifyValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value.trim() || "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const rec = asRecord(value);
  if (rec) {
    const named = pickText(rec, ["value", "display", "label", "text", "name"]);
    if (named) return named;
    const keys = Object.keys(rec);
    return keys.length ? `{${keys.join("、")}}` : "";
  }
  if (Array.isArray(value)) return value.length ? `共 ${value.length} 项` : "";
  return null;
}

function changeOf(rec: Record<string, unknown>): AuditChange {
  const nested = pickRecord(rec, ["change", "changes", "diff", "delta", "modification"]);
  const source = nested ?? rec;
  const beforeRaw = pick(source, ["before", "previous", "oldValue", "old_value", "from", "previousValue", "previous_value"]);
  const afterRaw = pick(source, ["after", "newValue", "new_value", "to", "current", "currentValue", "current_value"]);
  const fields = asArray(source, ["fields", "changes"]);
  const beforeValue = beforeRaw === null ? null : humanValue(beforeRaw);
  const afterValue = afterRaw === null ? null : humanValue(afterRaw);
  // A machine-shaped side is folded into 「技术详情」 instead of being printed.
  const folded = { before: beforeValue?.machine === true, after: afterValue?.machine === true };
  const before = beforeValue && !beforeValue.machine ? beforeValue.text : null;
  const after = afterValue && !afterValue.machine ? afterValue.text : null;
  const technical: string[] = [];
  if (beforeValue?.machine) technical.push(`变更前原值：${beforeValue.text}`);
  if (afterValue?.machine) technical.push(`变更后原值：${afterValue.text}`);
  if (nested) {
    for (const item of fields) {
      const one = asRecord(item);
      if (!one) continue;
      const name = pickText(one, ["field", "name", "key", "path"]);
      if (!name) continue;
      const oldText = stringifyValue(pick(one, ["before", "oldValue", "old_value", "from"]));
      const newText = stringifyValue(pick(one, ["after", "newValue", "new_value", "to"]));
      technical.push(`${name}：${oldText ?? ""} → ${newText ?? ""}`);
    }
  }
  return {
    present: before !== null || after !== null || folded.before || folded.after || technical.length > 0,
    before,
    after,
    folded,
    technical,
  };
}

function asArray(rec: Record<string, unknown>, keys: readonly string[]): unknown[] {
  for (const key of keys) {
    if (Array.isArray(rec[key])) return rec[key] as unknown[];
  }
  return [];
}

export interface AuditDetail {
  rawId: string | null;
  action: ActionView;
  outcome: OutcomeView;
  actor: Person;
  resource: { label: string; raw: string | null };
  /** The event's own time and the time the ledger recorded it. */
  occurredAt: string | null;
  recordedAt: string | null;
  /** The raw instants the service sent, kept so the page can show seconds. */
  occurredAtRaw: string | null;
  recordedAtRaw: string | null;
  /** The service's own payload when it sent one; null when it only sent differences. */
  rawPayload: unknown;
  sourceSystem: string | null;
  /** 请求编号 shown on the human layer (copyable); null renders 「未提供」 + reason. */
  requestId: string | null;
  /** The correlation handle; the 关联 row shows it as 同一次操作 · 短码. */
  correlation: string | null;
  reason: string | null;
  /** The code the service gave for a failure — technical, never on the surface. */
  code: string | null;
  change: AuditChange;
  links: AuditLink[];
  integrity: { hash: { label: string; raw: string | null }; prevHash: { label: string; raw: string | null }; present: boolean };
  tenant: { label: string; raw: string | null };
  /** Everything engineering-shaped, for the 「技术详情」 disclosure only. */
  technical: string[];
}

export function auditDetailFrom(payload: unknown): AuditDetail | null {
  const outer = asRecord(payload);
  if (!outer) return null;
  let body = outer;
  for (const key of ["audit", "event", "detail", "record", "data", "result"]) {
    const inner = asRecord(outer[key]);
    if (inner) {
      body = inner;
      break;
    }
  }
  const rawId = pickText(body, ID_KEYS);
  const action = actionView(pickText(body, ACTION_KEYS));
  // Nothing to open this record by, and nothing naming what it was.
  if (!rawId && !action.raw) return null;
  const outcome = outcomeView(pickText(body, OUTCOME_KEYS));
  const actor = actorView(body);
  const resource = resourceOf(body);
  const code = errorCode(body);
  const hash = maskedDigest(pickText(body, HASH_KEYS));
  const prevHash = maskedDigest(pickText(body, PREV_HASH_KEYS));
  const tenantRaw = pickText(body, TENANT_KEYS);
  const tenant = maskedRef(tenantRaw, "工作区");
  const sourceSystem = pickText(body, SOURCE_KEYS);
  const requestId = requestIdOf(body);
  const correlation = correlationOf(body);

  const technical: string[] = [];
  if (rawId) technical.push(`事件标识：${rawId}`);
  technical.push(`事件类型原值：${action.raw ?? "未提供"}`);
  technical.push(`结果原值：${outcome.raw ?? "未提供"}`);
  if (actor.kind) technical.push(`操作者类型原值：${actor.kind}`);
  if (code) technical.push(`失败代码：${code}`);
  if (action.raw && !action.known) technical.push(`未识别的事件类型按原样显示：${action.raw}`);
  if (sourceSystem) technical.push(`来源系统：${sourceSystem}`);
  if (tenantRaw) technical.push(`租户标识：${tenantRaw}`);
  if (correlation) technical.push(`同一次操作原值：${correlation}`);
  if (hash.raw) technical.push(`本条摘要：${hash.raw}`);
  if (prevHash.raw) technical.push(`前一条摘要：${prevHash.raw}`);

  const change = changeOf(body);
  technical.push(...change.technical);

  return {
    rawId,
    action,
    outcome,
    actor,
    resource,
    occurredAt: beijing(pick(body, OCCURRED_KEYS)),
    recordedAt: beijing(pick(body, RECORDED_KEYS)),
    occurredAtRaw: typeof pick(body, OCCURRED_KEYS) === "string" ? (pick(body, OCCURRED_KEYS) as string) : null,
    recordedAtRaw: typeof pick(body, RECORDED_KEYS) === "string" ? (pick(body, RECORDED_KEYS) as string) : null,
    rawPayload: body.payload ?? body.raw ?? body.event ?? null,
    sourceSystem,
    requestId,
    correlation,
    reason: reasonOf(body),
    code,
    change,
    links: linksOf(body),
    integrity: { hash, prevHash, present: hash.raw !== null || prevHash.raw !== null },
    tenant,
    technical,
  };
}

// ── Verify model ─────────────────────────────────────────────────────

const V_SCANNED_KEYS = ["scanned", "scannedCount", "scanned_count", "checked", "checkedCount", "checked_count", "verified", "verifiedCount", "verified_count", "recordsScanned", "records_scanned", "processed", "eventsChecked", "events_checked"] as const;
const V_TOTAL_KEYS = ["total", "totalCount", "total_count", "records", "recordCount", "record_count", "events", "windowCount", "window_count", "candidates"] as const;
const V_BROKEN_KEYS = ["broken", "brokenCount", "broken_count", "mismatches", "mismatchCount", "mismatch_count", "gaps", "gapCount", "gap_count", "invalid", "invalidCount", "invalid_count", "failed", "failedCount", "failures"] as const;
const V_OK_KEYS = ["ok", "valid", "intact", "verified", "passed", "healthy", "chainValid", "chain_valid", "isChainValid", "result", "status", "verdict"] as const;
const V_FROM_KEYS = ["from", "windowFrom", "window_from", "start", "startTime", "start_time"] as const;
const V_TO_KEYS = ["to", "windowTo", "window_to", "end", "endTime", "end_time"] as const;
const V_MESSAGE_KEYS = ["message", "detail", "reason", "error"] as const;

function boolOf(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const text = textOf(value)?.toLowerCase() ?? "";
  if (["true", "ok", "valid", "intact", "pass", "passed", "yes", "1"].includes(text)) return true;
  if (["false", "invalid", "broken", "fail", "failed", "no", "0"].includes(text)) return false;
  return null;
}

export type VerifyVerdict = "intact" | "broken" | "unsure";

export interface VerifyResult {
  /** Explicit `ok`-shaped answer; null means the service did not say. */
  stated: boolean | null;
  verdict: VerifyVerdict;
  scanned: number | null;
  total: number | null;
  broken: number | null;
  /** How many records the window holds, as the service named it. */
  denominator: string | null;
  windowFrom: string | null;
  windowTo: string | null;
  /** A sentence the service wrote about the run, human only. */
  message: string | null;
  technical: string[];
}

/**
 * Honest reading of a chain-verify answer. A green claim needs the service's
 * own word or a counted zero — nothing else says 「没有发现断点」.
 */
export function verifyResultFrom(payload: unknown): VerifyResult | null {
  const outer = asRecord(payload);
  if (!outer) return null;
  let body = outer;
  for (const key of ["verify", "verification", "result", "audit", "data", "chain"]) {
    const inner = asRecord(outer[key]);
    if (inner) {
      body = inner;
      break;
    }
  }
  const scanned = pickNumber(body, V_SCANNED_KEYS);
  const total = pickNumber(body, V_TOTAL_KEYS);
  const broken = pickNumber(body, V_BROKEN_KEYS);
  const okValue = pick(body, V_OK_KEYS);
  const stated = boolOf(okValue);
  let verdict: VerifyVerdict;
  if (stated === true) verdict = "intact";
  else if (stated === false) verdict = "broken";
  else if (broken !== null) verdict = broken === 0 ? "intact" : "broken";
  else verdict = "unsure";
  const technical: string[] = [];
  const shown: string[] = [...V_SCANNED_KEYS, ...V_TOTAL_KEYS, ...V_BROKEN_KEYS, ...V_FROM_KEYS, ...V_TO_KEYS];
  for (const key of Object.keys(body)) {
    if (shown.includes(key)) continue;
    const value = body[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      technical.push(`${key}：${String(value)}`);
    }
  }
  return {
    stated,
    verdict,
    scanned,
    total,
    broken,
    denominator: total !== null ? `共 ${total} 条` : null,
    windowFrom: beijing(pick(body, V_FROM_KEYS)),
    windowTo: beijing(pick(body, V_TO_KEYS)),
    message: humanSentence(pickText(body, V_MESSAGE_KEYS)),
    technical,
  };
}

/** Beijing wall clock with seconds; null when the value is not a readable instant. */
export function beijingSeconds(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const ms = typeof value === "number" ? value : Date.parse(String(value));
  if (!Number.isFinite(ms)) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(ms));
    const get = (kind: string): string => parts.find((part) => part.type === kind)?.value ?? "";
    const stamp = get("year") + "-" + get("month") + "-" + get("day") + " " + get("hour") + ":" + get("minute") + ":" + get("second");
    return stamp.includes("NaN") || get("year") === "" ? null : stamp;
  } catch {
    return null;
  }
}

const SENSITIVE_KEY = /token|cookie|secret|password|authorization|api[-_]?key|credential/i;

/** Copy of a payload with credential-shaped keys replaced by stars, plus how many were hit. */
export function maskSensitive(input: unknown): { value: unknown; masked: number } {
  let masked = 0;
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
        if (SENSITIVE_KEY.test(key)) {
          out[key] = "***";
          masked += 1;
        } else {
          out[key] = walk(val);
        }
      }
      return out;
    }
    return node;
  };
  return { value: walk(input), masked };
}
