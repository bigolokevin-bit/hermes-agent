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

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
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
export function approverLabels(rec: Record<string, unknown>): { labels: string[]; raw: string | null } {
  const raw = pickText(rec, ["approvers", "approversJson"]);
  const list = rec.approvers;
  if (Array.isArray(list)) {
    // R31-obs: the label 「审批人：」 is rendered by the field itself; the
    // value must never echo it. Bare machine handles (human:1) read as
    // 人员/人员 · 短码 and the original handle is backfilled into `raw` so
    // the field's title still carries it.
    const handles: string[] = [];
    const labels = list.map((item) => {
      if (typeof item === "string") {
        handles.push(item);
        return maskHandle(item, "人员");
      }
      const rec2 = asRecord(item);
      if (!rec2) return "";
      const name = pickText(rec2, ["name", "displayName", "label"]);
      if (name && !isMachineHandle(name)) return name;
      const id = pickText(rec2, ["userId", "user_id", "id"]) ?? "";
      handles.push(id);
      return maskHandle(id, "人员");
    });
    const clean = labels.filter((x) => x);
    const rawBackfill = raw ?? (handles.length ? handles.join("、") : null);
    if (clean.length) return { labels: clean, raw: rawBackfill };
  }
  const count = pickNumber(rec, ["requiredApprovals", "approverCount"]);
  if (count !== null) return { labels: [`需要 ${count} 人审批`], raw };
  return { labels: [], raw };
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
  return {
    key: rawId ?? `approval-${index}`,
    rawId,
    title: title ?? "未写明事由的申请",
    status,
    requester: requesterView(rec),
    worker: workerView(rec),
    submitted: beijing(pick(rec, SUBMITTED_KEYS)),
    clock,
    clockLabel: status.pending ? "处理期限" : "处理于",
    amount: pickNumber(rec, AMOUNT_KEYS),
    reason: humanSentence(pickText(rec, REASON_KEYS)),
    risk: riskView(pickText(rec, ["riskLevel", "risk_level", "risk"])),
  };
}

export interface ApprovalPage {
  rows: ApprovalRow[];
  /** Records the answer carried but that could not be read — counted, never dressed up. */
  unreadable: number;
  next: string | null;
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
  return { rows, unreadable, next };
}

export interface DecisionEntry {
  who: string;
  whoRaw: string | null;
  verdict: string;
  verdictRaw: string | null;
  at: string | null;
  note: string | null;
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
      note: humanSentence(pickText(one, ["comment", "note", "reason"])),
    });
  }
  return out;
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
    remaining: countdown(pickNumber(body, ["remainingSeconds", "remaining_seconds", "ttlRemaining"])),
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
    technical,
  };
}
