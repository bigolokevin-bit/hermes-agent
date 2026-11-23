/**
 * approvals read model — tolerant readers for whatever the BFF answers.
 *
 * Two laws drive every function here:
 *   1. A value the service did not send stays missing. It renders `—` with a
 *      reason, never `0`, never an empty string, never a guess.
 *   2. What reaches the screen is a sentence a person wrote or a number they
 *      can act on. Handles (`emp_…`, `human:1`), raw enum tokens, `run_id`,
 *      digests and HTTP codes stay off the surface: they go into a `title`
 *      attribute or the 「详情」 disclosure only.
 */

import { epochOf, plainMinute } from "./RelativeTime";
import { shortRef } from "@/modules/tasks/tasksBoard";

/** The tones the vendored Badge accepts (its own union is not exported). */
export type Tone = "default" | "destructive" | "outline" | "secondary" | "success" | "warning";

// ── Formatting ───────────────────────────────────────────────────────

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Beijing wall clock to the minute; null when the value is absent or unreadable.
 *
 * P1-A2 ①：epoch 解析与 Intl 格式化都委托 RelativeTime 的单点
 * （epochOf + plainMinute），列表相对读数与详情绝对读数不再各算各的钟。
 */
export function beijing(value: unknown): string | null {
  const raw = textOf(value);
  if (!raw) return null;
  const ms = epochOf(raw);
  if (ms === null) return null;
  return plainMinute(ms);
}

/** Money in USD, the unit the ledger answers in. Missing is `—`, not `$0.00`. */
export function money(value: number | null): string {
  return value === null ? "—" : USD.format(value);
}

/** A wait, spoken: 「剩 3 小时 12 分」/「已到时」— never a bare second count. */
export function countdown(seconds: number | null): { text: string; overdue: boolean } | null {
  if (seconds === null) return null;
  if (seconds <= 0) return { text: "已到时", overdue: true };
  const total = Math.floor(seconds);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const parts: string[] = [];
  if (days) parts.push(`${days} 天`);
  if (hours) parts.push(`${hours} 小时`);
  if (!days && minutes) parts.push(`${minutes} 分`);
  if (!parts.length) parts.push("不到 1 分钟");
  return { text: `剩 ${parts.join(" ")}`, overdue: false };
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
  const raw = typeof value === "string" ? value.trim().replace(/[$,\s]/g, "") : "";
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

// ── Identity ─────────────────────────────────────────────────────────

const SCHEME_PREFIX = /^(?:emp|employee|agent|human|user|member|staff|svc|service)[_:=@/#-]/i;
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isMachineHandle(value: string): boolean {
  return SCHEME_PREFIX.test(value) || UUID_SHAPE.test(value) || /^emp_/i.test(value);
}

export interface Person {
  /** What the screen shows. Always a sentence, never a handle. */
  label: string;
  /** The raw handle, for `title` only. */
  raw: string | null;
}

function personView(
  rec: Record<string, unknown>,
  nameKeys: readonly string[],
  idKeys: readonly string[],
  noun: string,
): Person {
  // R24: the BFF sometimes answers with an object handle, e.g.
  // requestedBy: { type: "user", id: "1" } — unwrap it before picking.
  let rawId = pickText(rec, idKeys);
  let name = pickText(rec, nameKeys);
  if (!rawId || !name) {
    for (const k of idKeys) {
      const inner = asRecord(rec[k]);
      if (!inner) continue;
      rawId = rawId ?? pickText(inner, ["id", "userId", "user_id", "value", "handle"]);
      name = name ?? pickText(inner, ["name", "displayName", "label"]);
      if (rawId || name) break;
    }
  }
  if (name && !isMachineHandle(name)) return { label: name, raw: rawId };
  const handle = name ?? rawId;
  if (handle) {
    const tail = handle
      .split(/[:_/@#-]/)
      .filter(Boolean)
      .pop();
    const clean = (tail ?? "").replace(/[^0-9A-Za-z]/g, "");
    // R15 apd5: eight-digit code, matching the people-directory standard.
    if (clean.length >= 1) return { label: `${noun} · ${clean.slice(0, 8).toUpperCase()}`, raw: handle };
  }
  // R24: an absent person is an honest dash, never a confident 「未指派」.
  return { label: "—", raw: rawId };
}

const REQUESTER_NAME_KEYS = ["requestedByName", "applicantName", "requesterName", "humanName", "ownerName"] as const;
const REQUESTER_ID_KEYS = ["requestedBy", "requested_by", "applicant", "requester", "human", "userId", "user_id"] as const;
const WORKER_NAME_KEYS = ["employeeName", "employee_name", "agentName", "agent_name", "assigneeName"] as const;
const WORKER_ID_KEYS = ["employee", "employeeId", "employee_id", "agent", "agentId", "agent_id"] as const;

export const requesterView = (rec: Record<string, unknown>): Person =>
  personView(rec, REQUESTER_NAME_KEYS, REQUESTER_ID_KEYS, "成员");

export const workerView = (rec: Record<string, unknown>): Person =>
  personView(rec, WORKER_NAME_KEYS, WORKER_ID_KEYS, "员工");

/** A list of approvers, each spoken the same way; the count is honest, not guessed. */
export function approverLabels(rec: Record<string, unknown>): {
  labels: string[];
  raw: string | null;
  /** R74: 与原始项对齐的审批人 id（本地分桶键）；计数特例与无名单时为空。 */
  ids: string[];
} {
  const raw = pickText(rec, ["approvers", "approversJson"]);
  const list = rec.approvers;
  if (Array.isArray(list)) {
    // R31-obs: the label 「审批人：」 is rendered by the field itself; the
    // value must never echo it. Bare machine handles (human:1) read as
    // 人员/人员 · 短码 and the original handle is backfilled into `raw` so
    // the field's title still carries it.
    const handles: string[] = [];
    const pairs = list.map((item): { label: string; id: string } => {
      if (typeof item === "string") {
        handles.push(item);
        return { label: maskHandle(item, "人员"), id: item };
      }
      const rec2 = asRecord(item);
      if (!rec2) return { label: "", id: "" };
      const name = pickText(rec2, ["name", "displayName", "label"]);
      const id = pickText(rec2, ["userId", "user_id", "id"]) ?? "";
      if (name && !isMachineHandle(name)) return { label: name, id: id || name };
      handles.push(id);
      return { label: maskHandle(id, "人员"), id };
    });
    const clean = pairs.filter((p) => p.label);
    const rawBackfill = raw ?? (handles.length ? handles.join("、") : null);
    if (clean.length)
      return {
        labels: clean.map((p) => p.label),
        raw: rawBackfill,
        ids: clean.map((p) => p.id).filter((x) => x),
      };
  }
  const count = pickNumber(rec, ["requiredApprovals", "approverCount"]);
  if (count !== null) return { labels: [`需要 ${count} 人审批`], raw, ids: [] };
  return { labels: [], raw, ids: [] };
}

function maskHandle(handle: string, noun: string): string {
  if (!handle) return "";
  if (!isMachineHandle(handle)) return handle;
  const tail = handle.split(/[:_/@#-]/).filter(Boolean).pop() ?? "";
  const clean = tail.replace(/[^0-9A-Za-z]/g, "");
  // R15 apd5: eight-digit code so two people never collapse onto one tail.
  return clean.length >= 4 ? `${noun} · ${clean.slice(0, 8).toUpperCase()}` : noun;
}

// ── Status vocabulary ────────────────────────────────────────────────

/**
 * The eight states the approval domain answers with (`status=` on AP4):
 * pending / approved / rejected / revise_requested / expired / cancelled /
 * consumed / superseded. These are the FILTER VALUES — each one is sent to the
 * service verbatim; the label is what the person reads.
 */
export interface StatusFilter {
  value: string;
  label: string;
}

export const STATUS_FILTERS: readonly StatusFilter[] = [
  { value: "pending", label: "待处理" },
  { value: "approved", label: "已通过" },
  { value: "rejected", label: "已拒绝" },
  { value: "revise_requested", label: "要求修改" },
  { value: "expired", label: "已过期" },
  { value: "cancelled", label: "已撤回" },
  { value: "consumed", label: "已执行" },
  { value: "superseded", label: "已被新单替代" },
];

export const STATUS_FILTER_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_FILTERS.map((f) => [f.value, f.label]),
);

export function isKnownStatus(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(STATUS_FILTER_LABEL, value);
}

/**
 * Display copy per state. Aliases the gateway may answer with collapse onto the
 * same eight labels; anything unrecognised keeps its raw value for the 「详情」
 * disclosure and reads as 状态未识别 on the surface — it is never renamed into
 * a state we did not get.
 */
interface StatusCopy {
  label: string;
  tone: Tone;
  pending: boolean;
  settled: boolean;
}

const PENDING: StatusCopy = { label: "待处理", tone: "warning", pending: true, settled: false };
const APPROVED: StatusCopy = { label: "已通过", tone: "success", pending: false, settled: true };
const REJECTED: StatusCopy = { label: "已拒绝", tone: "destructive", pending: false, settled: true };
const REVISE: StatusCopy = { label: "要求修改", tone: "secondary", pending: false, settled: true };
const EXPIRED: StatusCopy = { label: "已过期", tone: "secondary", pending: false, settled: true };
const CANCELLED: StatusCopy = { label: "已撤回", tone: "secondary", pending: false, settled: true };
const CONSUMED: StatusCopy = { label: "已执行", tone: "success", pending: false, settled: true };
const SUPERSEDED: StatusCopy = { label: "已被新单替代", tone: "secondary", pending: false, settled: true };

/** The eight states the domain answers with, by their wire value. */
const CANONICAL: Record<string, StatusCopy> = {
  pending: PENDING,
  approved: APPROVED,
  rejected: REJECTED,
  revise_requested: REVISE,
  expired: EXPIRED,
  cancelled: CANCELLED,
  consumed: CONSUMED,
  superseded: SUPERSEDED,
};

/** Spellings other gateways answer with, folded onto the same eight labels. */
const ALIASES: Record<string, StatusCopy> = {
  awaiting: PENDING,
  awaiting_approval: PENDING,
  open: PENDING,
  needs_decision: PENDING,
  in_review: PENDING,
  accept: APPROVED,
  accepted: APPROVED,
  granted: APPROVED,
  allowed: APPROVED,
  denied: REJECTED,
  reject: REJECTED,
  declined: REJECTED,
  blocked: REJECTED,
  revise: REVISE,
  revision_requested: REVISE,
  lapsed: EXPIRED,
  timed_out: EXPIRED,
  withdrawn: CANCELLED,
  canceled: CANCELLED,
  revoked: CANCELLED,
  executed: CONSUMED,
  completed: CONSUMED,
  replaced: SUPERSEDED,
};

const UNKNOWN_STATUS: StatusCopy = { label: "状态未识别", tone: "secondary", pending: false, settled: false };

export interface StatusView extends StatusCopy {
  /** The raw token, for `title` / 「详情」 only. */
  raw: string | null;
}

/** R29 item 4: business text may quote raw operator handles (e.g. a seed
 * ticket reason saying "human:1"). On screen those handles read as 「人员」;
 * the untouched sentence goes to the card's title attribute. */
export function humanizeHandles(text: string): string;
export function humanizeHandles(text: string | null): string | null;
export function humanizeHandles(text: string | null): string | null {
  if (!text) return text;
  return text.replace(/\b(?:human|user):[0-9A-Za-z._-]+/g, "人员");
}

export function statusView(raw: string | null): StatusView {
  const key = raw?.trim().toLowerCase() ?? "";
  const hit = CANONICAL[key] ?? ALIASES[key];
  return { ...(hit ?? UNKNOWN_STATUS), raw };
}

// ── Action / risk vocabulary ─────────────────────────────────────────

const CHANGE_KIND_LABEL: Record<string, string> = {
  business_action: "业务动作",
  confirm: "即时确认",
  message_send: "对外发送消息",
  employee_version_create: "发布数字员工新版本",
  grant_escalation: "提高权限",
  owner_transfer: "移交负责人",
};

export function changeKindView(raw: string | null): { label: string; raw: string | null } {
  const key = raw?.trim().toLowerCase() ?? "";
  return { label: CHANGE_KIND_LABEL[key] ?? "未写明类型", raw };
}

const RISK_LABEL: Record<string, { label: string; tone: Tone }> = {
  low: { label: "低风险", tone: "secondary" },
  medium: { label: "中等风险", tone: "warning" },
  high: { label: "高风险", tone: "destructive" },
  critical: { label: "严重风险", tone: "destructive" },
};

export function riskView(raw: string | null): { label: string; tone: Tone; raw: string | null } {
  const hit = raw ? RISK_LABEL[raw.trim().toLowerCase()] : undefined;
  return { label: hit?.label ?? "未标注风险", tone: hit?.tone ?? "secondary", raw };
}

const VERDICT_LABEL: Record<string, string> = {
  // R15 apd5: the PRD §4.2 verdict words are 通过 / 驳回 / 要求修改.
  approve: "通过",
  approved: "通过",
  accept: "通过",
  reject: "驳回",
  rejected: "驳回",
  deny: "驳回",
  denied: "驳回",
  revise: "要求修改",
  revision: "要求修改",
};

export function verdictLabel(raw: string | null): string {
  const hit = raw ? VERDICT_LABEL[raw.trim().toLowerCase()] : undefined;
  return hit ?? "未给出结论";
}

/** Sentences people wrote. A stack trace, a URL or a JSON blob is not one. */
export function humanSentence(value: string | null): string | null {
  if (!value) return null;
  const oneLine = value.replace(/\s+/g, " ").trim();
  if (!oneLine || oneLine.length > 220) return null;
  if (/[{}<>]|\bat\s+\S+\.\S+|https?:\/\//i.test(oneLine)) return null;
  if (/^\d{3}\s/.test(oneLine)) return null;
  return oneLine;
}

// ── Row / page / detail models ───────────────────────────────────────

export interface ApprovalRow {
  key: string;
  rawId: string | null;
  title: string;
  status: StatusView;
  requester: Person;
  worker: Person;
  submitted: string | null;
  /** Pending rows: the deadline. Settled rows: the time it was decided. */
  clock: string | null;
  clockLabel: string;
  amount: number | null;
  reason: string | null;
  /** R50 summary bar: parsed risk of this row (label 人话, raw for titles). */
  risk: { label: string; tone: string; raw: string | null };
  /** R60: inline preview fields, parsed from the list row payload itself. */
  approvers: { labels: string[]; raw: string | null };
  /** R74: 审批人 id 列表（与原始项对齐），供本地分桶过滤。 */
  approverIds: string[];
  requestId: string | null;
  /** R71: raw ISO 决定时间（排序键用；屏上仍走 decided 人话）。 */
  decidedAt: string | null;
  /** R76: 相对时间 helper 的 raw 输入（与 submitted/clock 同源）。 */
  submittedAt: string | null;
  clockAt: string | null;
  /** R65 parity: exactly what the detail reads as 「决定时间」 — same keys,
   * same helper, so the preview and the detail can never disagree. */
  decided: string | null;
  /**
   * 批量 P0: the real change kind, honored only from changeKind/binding.changeKind
   * (R25 口径：顶层 kind/type 是审批类不是变更类型)。缺了就是缺了，raw 为 null，
   * 门控据此「判不了就不批量」，绝不推断。
   */
  changeKind: { label: string; raw: string | null };
  /**
   * 批量 P0: remaining seconds under the detail's same rule (P1-A2 ①) — derive
   * live from a readable deadline, fall back to the service snapshot only when
   * there is no deadline. Neither present = null, never a fabricated 0.
   */
  remainingSeconds: number | null;
  /** 批量 P0: 已投票审批人的 id 集（与 decisionEntries 的 whoRaw 同键序）。 */
  decidedByIds: string[];
}

const ID_KEYS = ["approvalId", "approval_id", "id", "uuid"] as const;
const TITLE_KEYS = ["title", "summary", "subject", "actionLabel", "action", "name", "tool", "request"] as const;
const STATUS_KEYS = ["status", "state"] as const;
const SUBMITTED_KEYS = ["createdAt", "created_at", "requestedAt", "requested_at", "submittedAt"] as const;
const DEADLINE_KEYS = ["expiresAt", "expires_at", "deadline", "validUntil"] as const;
const DECIDED_KEYS = ["decidedAt", "decided_at", "closedAt", "updatedAt", "updated_at"] as const;
const AMOUNT_KEYS = ["amountUsd", "amount_usd", "costUsd", "cost_usd", "amount"] as const;
const REASON_KEYS = ["reason", "reasonText", "note", "comment", "justification", "description"] as const;
const LIST_KEYS = ["items", "approvals", "results", "entries", "data", "list"] as const;
const CURSOR_KEYS = ["nextCursor", "next_cursor", "next", "cursor", "nextPage"] as const;

function rowFrom(item: unknown, index: number): ApprovalRow | null {
  const rec = asRecord(item);
  if (!rec) return null;
  const rawId = pickText(rec, ID_KEYS);
  const title = humanSentence(pickText(rec, TITLE_KEYS));
  // Neither a handle nor a caption: this row cannot be told apart from the next.
  if (!rawId && !title) return null;
  const status = statusView(pickText(rec, STATUS_KEYS));
  const clock = status.pending
    ? beijing(pick(rec, DEADLINE_KEYS))
    : beijing(pick(rec, DECIDED_KEYS)) ?? beijing(pick(rec, DEADLINE_KEYS));
  // R74: 分桶键与 labels 同源一次解析。
  const ap = approverLabels(rec);
  // 批量 P0 行级判据三件——变更类型只认真写的 changeKind/binding.changeKind
  // （与详情的 kind 腿同一键序，R25），缺了不推断；剩余秒与详情同尺（P1-A2 ①：
  // deadline 现场推导优先，服务端快照仅回退腿，两者皆无 = null 不是 0）；
  // 已投票人 id 复用 decisionEntries，与决策回放同一解析。
  const changeKindRaw =
    pickText(rec, ["changeKind", "change_kind"]) ?? pickText(asRecord(rec.binding) ?? {}, ["changeKind", "change_kind"]);
  const deadlineRaw = pickText(rec, DEADLINE_KEYS);
  const deadlineMs = deadlineRaw === null ? null : epochOf(deadlineRaw);
  const remainingSeconds =
    deadlineMs !== null
      ? Math.floor((deadlineMs - Date.now()) / 1000)
      : pickNumber(rec, ["remainingSeconds", "remaining_seconds", "ttlRemaining"]);
  const decidedByIds = decisionEntries(rec)
    .map((entry) => entry.whoRaw)
    .filter((raw): raw is string => raw !== null);
  return {
    key: rawId ?? `approval-${index}`,
    rawId,
    title: title ?? "未写明事由的申请",
    status,
    requester: requesterView(rec),
    worker: workerView(rec),
    submitted: beijing(pick(rec, SUBMITTED_KEYS)),
    // R76: raw ISO 原文（相对显示的单一输入）；屏上人话仍走上面的助手。
    submittedAt: pickText(rec, SUBMITTED_KEYS),
    clock,
    clockLabel: status.pending ? "处理期限" : "处理于",
    // R76: clock 的 raw 源与 clock 同一选择逻辑。
    clockAt: status.pending
      ? pickText(rec, DEADLINE_KEYS)
      : (pickText(rec, DECIDED_KEYS) ?? pickText(rec, DEADLINE_KEYS)),
    amount: pickNumber(rec, AMOUNT_KEYS),
    reason: humanSentence(pickText(rec, REASON_KEYS)),
    risk: riskView(pickText(rec, ["riskLevel", "risk_level", "risk"])),
    approvers: { labels: ap.labels, raw: ap.raw },
    approverIds: ap.ids,
    // R65: same key order as approvalDetailFrom — a ticket that only
    // carries consoleRequestId must not read missing here and present there.
    requestId: pickText(rec, ["requestId", "request_id", "consoleRequestId"]),
    decided: beijing(pick(rec, DECIDED_KEYS)),
    decidedAt: pickText(rec, DECIDED_KEYS),
    changeKind: changeKindView(changeKindRaw),
    remainingSeconds,
    decidedByIds,
  };
}

export interface ApprovalPage {
  rows: ApprovalRow[];
  /** Records the answer carried but that could not be read — counted, never dressed up. */
  unreadable: number;
  next: string | null;
  /* R79: 读口顶层无 total 键（实测 keys=[items,nextCursor]）——解析 total/count
   * 以备契约升级，缺省恒 null；UI 禁按已加载条数推算。 */
  total: number | null;
}

/** null = the answer is not a list at all, which is a failure, not an empty queue. */
export function approvalsPageFrom(payload: unknown): ApprovalPage | null {
  let items: unknown[] | null = null;
  let next: string | null = null;
  if (Array.isArray(payload)) {
    items = payload;
  } else {
    const rec = asRecord(payload);
    if (!rec) return null;
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
  const rows: ApprovalRow[] = [];
  let unreadable = 0;
  items.forEach((item, index) => {
    const row = rowFrom(item, index);
    if (row) rows.push(row);
    else unreadable += 1;
  });
  const totalRaw = (payload as Record<string, unknown>).total ?? (payload as Record<string, unknown>).count;
  const total = typeof totalRaw === "number" && Number.isFinite(totalRaw) ? totalRaw : null;
  return { rows, unreadable, next, total };
}

export interface DecisionEntry {
  /** R76: 决策时间的 raw ISO（at 的单一输入）。 */
  atRaw: string | null;
  who: string;
  whoRaw: string | null;
  verdict: string;
  verdictRaw: string | null;
  at: string | null;
  note: string | null;
}

/** Q13: one field-level before/after row, every cell a human sentence. */
export interface ApprovalDiffField {
  label: string;
  before: string;
  after: string;
  /** 原始句柄/枚举只进 title，不进正文（模型法则二）。 */
  raw: string | null;
}

/**
 * Q13: honest diff state read from the very detail payload the service answered.
 *  - `real`   — before/after rows derived from keys the service actually sent.
 *  - `absent` — a diff-shaped carrier came back but carries no changed fields.
 * Computed from the detail response only (`GET /api/approval?id=`); when the
 * response has no diff-shaped keys at all the value stays `null` — the UI then
 * says 「未接」 with a reason. No fixtures, no guesses.
 */
export interface ApprovalDiff {
  fields: ApprovalDiffField[];
  source: "real" | "absent";
}

export interface ApprovalDetail {
  rawId: string | null;
  title: string;
  status: StatusView;
  kind: { label: string; raw: string | null };
  risk: { label: string; tone: Tone; raw: string | null };
  requester: Person;
  worker: Person;
  approvers: { labels: string[]; raw: string | null };
  submitted: string | null;
  deadline: string | null;
  decided: string | null;
  /** R76: raw ISO（trail 与详情时间列共用相对 helper 的单一输入）。 */
  submittedAt: string | null;
  deadlineAt: string | null;
  decidedAt: string | null;
  remaining: { text: string; overdue: boolean } | null;
  amount: number | null;
  reason: string | null;
  decisions: DecisionEntry[];
  /** The ticket that replaced this one, when the service names it. */
  supersededBy: string | null;
  /** R15 apd5 — PRD §4.2 frozen fields; absent values render 「—」 with a reason. */
  actionHash: string | null;
  recipient: Person;
  dataScope: string | null;
  requestId: string | null;
  /** R46 apd6: related-object ids when the ticket carries them. */
  runId: string | null;
  taskId: string | null;
  /** Q13: 字段级前后差异；null=该单据响应未带回任何差异键（界面「未接」+原因）。 */
  diff: ApprovalDiff | null;
  /** Raw technical lines for the 「详情」 disclosure only. */
  technical: string[];
}

const DECISIONS_KEYS = ["decisions", "votes", "decisionHistory"] as const;

function decisionEntries(rec: Record<string, unknown>): DecisionEntry[] {
  const list = pick(rec, DECISIONS_KEYS);
  if (!Array.isArray(list)) return [];
  const out: DecisionEntry[] = [];
  for (const item of list) {
    const one = asRecord(item);
    if (!one) continue;
    const verdictRaw = pickText(one, ["verdict", "decision", "result"]);
    const whoRaw = pickText(one, ["userId", "user_id", "by", "actor", "approver"]);
    const whoName = pickText(one, ["name", "displayName", "userName"]);
    out.push({
      who: whoName && !isMachineHandle(whoName) ? whoName : maskHandle(whoRaw ?? "", "人员") || "未指派",
      whoRaw,
      verdict: verdictLabel(verdictRaw),
      verdictRaw,
      at: beijing(pick(one, ["decidedAt", "decided_at", "at", "createdAt", "ts"])),
      atRaw: pickText(one, ["decidedAt", "decided_at", "at", "createdAt", "ts"]),
      note: humanSentence(pickText(one, ["comment", "note", "reason"])),
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Q13 字段级差异读取。键形制全部来自 2026-11-23 本机金标准实测
 * （GET /agent-api/api/approval?id=ap_AEEC…，原文见 worktree evidence/）：
 *   detail.changeDetail { fromVersionId, toVersionNo, addedGrants[],
 *                         removedGrantIds[], effectiveFrom, source:"resource" }
 *   resource           同一载荷的 snake_case 镜像（from_version_id…）。
 * 探测未出现 changes/diffs/fieldChanges/proposal 之类泛型键，故不凭空支持：
 * 只认实测形制，缺失返回 null，前端渲染「未接」并给出原因句。
 * ------------------------------------------------------------------ */

const DIFF_FROM_KEYS = ["fromVersionId", "from_version_id"] as const;
const DIFF_TO_KEYS = ["toVersionNo", "to_version_no"] as const;
const DIFF_ADDED_KEYS = ["addedGrants", "added_grants"] as const;
const DIFF_REMOVED_KEYS = ["removedGrantIds", "removed_grant_ids"] as const;

const GRANT_SCOPE_LABEL: Record<string, string> = {
  business_api: "业务接口",
  channel: "渠道",
};

/** 授权对象的一行人话：范围类型 · 允许动作 · 到期（缺段就省段，不补造）。 */
function grantSentence(g: Record<string, unknown>): string {
  const scopeRaw = pickText(g, ["scopeType", "scope_type"]);
  const scope = scopeRaw ? GRANT_SCOPE_LABEL[scopeRaw.toLowerCase()] ?? scopeRaw : null;
  const actionsList = Array.isArray(g.actions ?? g.granted_actions)
    ? (g.actions as unknown[]).map(textOf).filter((x): x is string => Boolean(x))
    : [];
  const parts: string[] = [];
  if (scope) parts.push(scope);
  if (actionsList.length) parts.push(`允许 ${actionsList.join("、")}`);
  const expires = beijing(pick(g, ["expiresAt", "expires_at"]));
  if (expires) parts.push(`到期 ${expires}`);
  return parts.join(" · ") || "授权内容未带回细节";
}

function diffCarrierRecords(rec: Record<string, unknown>): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const inner = asRecord(rec.detail);
  for (const source of [inner, rec]) {
    if (!source) continue;
    for (const key of ["changeDetail", "change_detail"]) {
      const one = asRecord(source[key]);
      if (one) out.push(one);
    }
  }
  const resource = asRecord(rec.resource);
  if (resource) out.push(resource);
  return out;
}

export function approvalDiffFrom(payload: unknown): ApprovalDiff | null {
  const rec = asRecord(payload);
  if (!rec) return null;
  const fields: ApprovalDiffField[] = [];
  let carrierFound = false;
  for (const carrier of diffCarrierRecords(rec)) {
    const from = pickText(carrier, DIFF_FROM_KEYS);
    const to = pickText(carrier, DIFF_TO_KEYS);
    const added = Array.isArray(pick(carrier, DIFF_ADDED_KEYS)) ? (pick(carrier, DIFF_ADDED_KEYS) as unknown[]) : null;
    const removed = Array.isArray(pick(carrier, DIFF_REMOVED_KEYS)) ? (pick(carrier, DIFF_REMOVED_KEYS) as unknown[]) : null;
    if (from === null && to === null && added === null && removed === null) continue;
    // 同一变更在响应里可能同时有 camel（detail.changeDetail）与 snake
    // （resource）镜像——取首个命中载体，禁把同一差异数两遍。
    carrierFound = true;
    if (from !== null || to !== null) {
      fields.push({
        label: "员工版本",
        before: from !== null ? shortRef(from) : "—",
        after: to !== null ? `v${to}` : "—",
        raw: from ?? null,
      });
    }
    for (const item of added ?? []) {
      const one = asRecord(item);
      const id = one ? pickText(one, ["id", "grantId", "grant_id"]) : null;
      const body = one ? grantSentence(one) : "授权内容未带回细节";
      fields.push({
        label: `新增授权${id ? ` ${shortRef(id)}` : ""}`,
        before: "未持有",
        after: body,
        raw: id,
      });
    }
    for (const item of removed ?? []) {
      // 撤销项服务只带回 id——内容不在响应里，正文就只说 id，禁补写。
      const id = textOf(item);
      fields.push({
        label: `移除授权${id ? ` ${shortRef(id)}` : ""}`,
        before: "持有中（授权内容未随本单带回）",
        after: "已移除",
        raw: id,
      });
    }
    break;
  }
  if (!carrierFound) return null;
  return { fields, source: fields.length ? "real" : "absent" };
}

export function approvalDetailFrom(payload: unknown): ApprovalDetail | null {
  // Some gateways wrap the ticket (`{approval: {...}}`), some answer it bare.
  const rec = asRecord(payload);
  if (!rec) return null;
  const body = asRecord(rec.approval) ?? asRecord(rec.approvalDetail) ?? rec;
  const rawId = pickText(body, ID_KEYS);
  const title = humanSentence(pickText(body, TITLE_KEYS));
  if (!rawId && !title) return null;
  const status = statusView(pickText(body, STATUS_KEYS));
  const technical: string[] = [];
  const digest = pickText(body, ["payloadHash", "payload_hash", "argsDigest", "targetHash", "target_hash"]);
  if (digest) technical.push(`参数摘要：${digest}`);
  technical.push(`状态原值：${status.raw ?? "未提供"}`);
  if (rawId) technical.push(`单据标识：${rawId}`);
  // R15 apd5: PRD §4.2 frozen fields, extracted honestly.
  const actionHash = pickText(body, ["actionHash", "action_hash", "argsDigest"]);
  const requestId = pickText(body, ["requestId", "request_id", "consoleRequestId"]);
  if (actionHash) technical.push(`操作指纹：${actionHash}`);
  if (requestId) technical.push(`请求编号：${requestId}`);
  // P1-A2 ①: 「剩 X」与绝对/相对读数走同一把尺——有可读的 deadline 原值时
  // 现场推导剩余；服务端 remainingSeconds 只是快照（两次取数之间已走表），
  // 降级为无 deadline 时的回退腿。
  const deadlineMs = epochOf(pickText(body, DEADLINE_KEYS));
  const remainingSeconds =
    deadlineMs !== null
      ? Math.floor((deadlineMs - Date.now()) / 1000)
      : pickNumber(body, ["remainingSeconds", "remaining_seconds", "ttlRemaining"]);
  return {
    rawId,
    title: title ?? "未写明事由的申请",
    status,
    // R25: the real change kind lives in `binding.changeKind`; the top-level
    // `type` is the approval class (business_action) and must not win.
    kind: changeKindView(
      pickText(body, ["changeKind", "change_kind"]) ??
        pickText(asRecord(body.binding) ?? {}, ["changeKind", "change_kind"]) ??
        pickText(body, ["kind", "category"]) ??
        (pickText(body, ["type"]) !== "business_action" ? pickText(body, ["type"]) : null),
    ),
    risk: riskView(pickText(body, ["riskLevel", "risk_level", "risk"])),
    requester: requesterView(body),
    worker: workerView(body),
    approvers: approverLabels(body),
    submitted: beijing(pick(body, SUBMITTED_KEYS)),
    deadline: beijing(pick(body, DEADLINE_KEYS)),
    decided: beijing(pick(body, DECIDED_KEYS)),
    submittedAt: pickText(body, SUBMITTED_KEYS),
    deadlineAt: pickText(body, DEADLINE_KEYS),
    decidedAt: pickText(body, DECIDED_KEYS),
    remaining: countdown(remainingSeconds),
    amount: pickNumber(body, AMOUNT_KEYS),
    reason: humanSentence(pickText(body, REASON_KEYS)),
    decisions: decisionEntries(body),
    supersededBy: pickText(body, ["supersededBy", "superseded_by", "replacedBy"]),
    actionHash,
    recipient: personView(
      body,
      ["recipientName", "receiverName", "targetName"],
      ["recipient", "recipientId", "recipient_id", "receiver", "target", "to"],
      "成员",
    ),
    dataScope: pickText(body, ["dataScope", "data_scope"]),
    requestId,
    runId: pickText(body, ["runId", "run_id"]),
    taskId: pickText(body, ["taskId", "task_id"]),
    diff: approvalDiffFrom(body),
    technical,
  };
}

/** R59: keyword search is local-only — the read port ignores q/keyword/title
 * (measured: all three return the same full set). Searching exactly the
 * fields rendered on screen keeps the filter honest about what it matches. */
export function approvalsRowSearchText(row: ApprovalRow): string {
  return [row.title, row.reason ?? "", row.rawId ?? "", row.status.label, row.risk.label]
    .join(" ")
    .toLowerCase();
}

/* ------------------------------------------------------------------ *
 * R71: 列排序（本地）。读口实测忽略 sort/order/orderBy/dir（200 同序同集合），
 * 因此这里只做「当前已加载行」的排序，并在界面上如实标注范围。
 * ------------------------------------------------------------------ */

export type ApprovalSortKey = "title" | "status" | "risk" | "time";
export type ApprovalSortDir = "asc" | "desc";

const RISK_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** 排序键；缺值（null）恒排末，不当 0 参与比较。 */
function approvalSortValue(row: ApprovalRow, key: ApprovalSortKey): string | number | null {
  switch (key) {
    case "title": {
      const t = row.title.trim().toLowerCase();
      return t ? t : null;
    }
    case "status": {
      const raw = row.status.raw?.trim().toLowerCase();
      return raw ? raw : null;
    }
    case "risk": {
      const raw = row.risk.raw?.trim().toLowerCase();
      return raw && raw in RISK_RANK ? RISK_RANK[raw] : null;
    }
    case "time": {
      if (!row.decidedAt) return null;
      const ms = Date.parse(row.decidedAt);
      return Number.isFinite(ms) ? ms : null;
    }
  }
}

export function sortApprovalRows(
  rows: readonly ApprovalRow[],
  key: ApprovalSortKey | null,
  dir: ApprovalSortDir,
): ApprovalRow[] {
  if (!key) return [...rows];
  const withValue: ApprovalRow[] = [];
  const missing: ApprovalRow[] = [];
  for (const row of rows) {
    (approvalSortValue(row, key) === null ? missing : withValue).push(row);
  }
  const sign = dir === "asc" ? 1 : -1;
  withValue.sort((a, b) => {
    const va = approvalSortValue(a, key);
    const vb = approvalSortValue(b, key);
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * sign;
    return String(va).localeCompare(String(vb), "zh-Hans-CN") * sign;
  });
  return [...withValue, ...missing];
}

export function approvalSortKeyOf(value: string | null): ApprovalSortKey | null {
  return value === "title" || value === "status" || value === "risk" || value === "time" ? value : null;
}
