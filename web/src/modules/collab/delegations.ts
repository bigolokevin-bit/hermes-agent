/**
 * COLLAB (协作委托) — read-only list data layer on the real BFF route.
 *
 * THE ROUTE WAS PROBED, NOT INVENTED. Measured 2026-11-19 against the console
 * BFF on `127.0.0.1:8092` (`L4ConsoleBFF/0.1`, no identity header, a fresh
 * `X-Console-Request-Id` per ask):
 *
 *   /agent-api/api/delegations   -> 404 console.not_found 「static asset not
 *                                   found」 — the `/agent-api` prefix is the
 *                                   gateway mount, this port answers at
 *                                   `/api/…`, so the prefix never resolves
 *                                   when the port is addressed directly
 *   /api/delegations             -> 401 console.unauthenticated
 *                                   (X-Console-Reason: identity-check-failed)
 *
 * The browser asks `/agent-api/api/delegations` because the gateway strips
 * that prefix before the BFF sees it; the `/api/` segment is part of the route
 * and dropping it would address a static file. Evidence with both status codes
 * and request ids is recorded in `docs/_artifacts/aud/DONE.md`.
 *
 * Nothing here fabricates a row, a count, or a field. The frozen DELEGATION
 * v1.0 record carries delegationId / requestId / fromEmployeeId / toEmployeeId
 * / taskId / status / createdAt / updatedAt / budget — it has no scope, no
 * expiry and no source column, and the BFF answer was never sampled with an
 * identity. So those three columns read a candidate key list (snake_case OR
 * camelCase OR the short alias) and an absent value stays absent: the surface
 * shows 「未记录」 with the reason, and never a guess, never 0, never the empty
 * string. Field names awaiting a real 2xx sample are listed as unverified in
 * DONE.
 *
 * Engineering language (raw `emp_…` / `human:…` handles, raw enum tokens, ISO
 * instants, HTTP codes, full ids) reaches the screen only through `title`
 * attributes and the collapsed 「技术详情」 — a closed disclosure is absent from
 * the DOM.
 */
import { ApiError } from "@/lib/api-error";
import { fetchJSON } from "@/lib/api";

/**
 * The gap this page belongs to. GAP-01…GAP-09 are already carried by other
 * panes in `web/src/**` and `docs/_artifacts/**` (grepped before claiming);
 * GAP-10 was free, this lane takes it.
 */
export const GAP = "GAP-10";

/** The route the browser asks. `/api/` segment included, exactly as named. */
export const LIST_PATH = "/agent-api/api/delegations";

/** What this page asks for; the on-screen denominator is stated against it. */
export const PAGE_LIMIT = 50;

/** The 请求编号's own honest word when the answer carried none. */
export const NO_REQUEST_ID = "未提供";

/** The one surface text when an answer simply did not carry a value. */
export const NOT_RECORDED = "未记录";

/* ── shapes ─────────────────────────────────────────────────────────── */

/** One side of a delegation: whoever asked for it, or whoever received it. */
export interface Actor {
  /** Display name when the answer carried one; never a handle. */
  name: string | null;
  /** Raw handle (`emp_…`, `human:…`, UUID) — `title` and 「技术详情」 only. */
  id: string | null;
}

export interface DelegationRow {
  /** Raw delegation id; the surface only ever shows a code (or nothing). */
  delegationId: string;
  requestId: string | null;
  /** 委托方 — the employee that handed the work out. */
  from: Actor;
  /** 受托方 — the employee that received it; empty when unassigned. */
  to: Actor;
  taskId: string | null;
  /** Raw enum token; only 「技术详情」 sees it. */
  status: string | null;
  /** 范围 — what may be done, in the answer's own words. */
  scopeText: string | null;
  /** 范围 — how many capability items came with the answer, if any. */
  capabilityCount: number | null;
  /** 范围 — who it applies to, as a name or a handle. */
  audience: string | null;
  /** 动作 — raw token (assign / handoff / …); words on screen, raw in title. */
  action: string | null;
  /** 生效 — raw instant; rendered to the Beijing minute or 「未记录」. */
  effectiveFrom: string | null;
  /** 生效至 — raw instant; rendered to the Beijing minute or 「未记录」. */
  expiresAt: string | null;
  /** 来源 — raw token; mapped to words, raw only in `title`. */
  source: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type Phase = "loading" | "ready" | "empty" | "error" | "denied" | "login";

export interface Failure {
  sentence: string;
  requestId: string | null;
  /** Engineering line for 「技术详情」; null when even that would be a guess. */
  technical: string | null;
}

export interface ListState {
  phase: Phase;
  rows: DelegationRow[];
  /** Rows the answer carried but this reader could not attribute an id to. */
  unreadable: number;
  failure: Failure | null;
  /**
   * The service's own read stamp (`asOf` from the answer), verbatim. Absent or
   * malformed stays null — the page then says the time is unknown instead of
   * printing the browser clock as if the service had said it.
   */
  asOf?: string | null;
}

/* ── defensive reading ──────────────────────────────────────────────── */

function rec(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** First key that carries a non-empty string; absent stays absent. */
function pick(v: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = str(v[key]);
    if (value) return value;
  }
  return undefined;
}

const DELEGATION_ID_KEYS = ["delegationId", "delegation_id", "id"] as const;
const REQUEST_ID_KEYS = ["requestId", "request_id", "correlationId"] as const;
const FROM_ID_KEYS = ["fromEmployeeId", "from_employee_id", "fromId", "delegatorId", "from", "fromEmployee", "delegator"] as const;
const TO_ID_KEYS = ["toEmployeeId", "to_employee_id", "toId", "assigneeId", "to", "toEmployee", "assignee"] as const;
const FROM_NAME_KEYS = ["fromEmployeeName", "fromName", "delegatorName"] as const;
const TO_NAME_KEYS = ["toEmployeeName", "toName", "assigneeName"] as const;
const TASK_ID_KEYS = ["taskId", "task_id"] as const;
const STATUS_KEYS = ["status", "state"] as const;
const SCOPE_TEXT_KEYS = ["scope", "scopeText", "summary", "description", "intent"] as const;
const AUDIENCE_KEYS = ["audience", "forWhom", "appliesTo", "subject"] as const;
const ACTION_KEYS = ["action", "delegationAction", "delegation_action", "actionType", "action_type", "kind", "verb", "mode"] as const;
const EFFECTIVE_KEYS = ["effectiveFrom", "effective_from", "validFrom", "valid_from", "startsAt", "starts_at"] as const;
const EXPIRES_KEYS = ["expiresAt", "expires_at", "validUntil", "valid_until", "until"] as const;
const SOURCE_KEYS = ["source", "origin", "createdVia", "via"] as const;
const CREATED_KEYS = ["createdAt", "created_at"] as const;
const UPDATED_KEYS = ["updatedAt", "updated_at"] as const;

/** `human:1`, `emp_x`, UUIDs and digests are handles, never display names. */
const SCHEME_PREFIX = /^[a-z][a-z0-9_-]*:/i;
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_HEX = /^[0-9a-f]{16,}$/i;
const ID_PREFIX = /^(emp|dl|rn|tk|task|user|usr|agent)[_-][0-9a-z]/i;

export function isMachineHandle(value: string): boolean {
  return (
    SCHEME_PREFIX.test(value) ||
    UUID_SHAPE.test(value) ||
    LONG_HEX.test(value) ||
    ID_PREFIX.test(value)
  );
}

/**
 * One side of the delegation. A nested record (`{employeeId, displayName}`)
 * and a flat pair of keys are both read; a value that looks like a handle is
 * never used as a name.
 */
function actorOf(v: Record<string, unknown>, idKeys: readonly string[], nameKeys: readonly string[]): Actor {
  let id: string | null = null;
  let name: string | null = null;
  for (const key of idKeys) {
    const raw = v[key];
    if (typeof raw === "string" && raw.trim()) {
      id = raw.trim();
      break;
    }
    if (rec(raw)) {
      const nestedId = pick(raw, ["employeeId", "employee_id", "id", "userId"]);
      const nestedName = pick(raw, ["name", "displayName", "display_name", "fullName"]);
      if (nestedId || nestedName) {
        id = nestedId ?? null;
        name = nestedName ?? null;
        break;
      }
    }
  }
  for (const key of nameKeys) {
    const raw = str(v[key]);
    if (!raw) continue;
    if (isMachineHandle(raw)) {
      // A handle parked under a name key is still an attribution: read it as
      // the id, and let the surface mask it.
      id = id ?? raw;
    } else {
      name = raw;
      break;
    }
  }
  return { name, id };
}

/** True when a free-text value is words a person could read on screen. */
function humanSentence(value: string | undefined): string | null {
  if (!value) return null;
  if (isMachineHandle(value)) return null;
  // A single snake_case token is a code, not a sentence.
  if (/^[a-z][a-z0-9]*([_-][a-z0-9]+)+$/.test(value)) return null;
  return value;
}

export function normalizeDelegation(v: unknown): DelegationRow | null {
  if (!rec(v)) return null;
  const delegationId = pick(v, DELEGATION_ID_KEYS);
  // Without an id there is nothing a person could quote back; the row is
  // counted as unreadable and never painted.
  if (!delegationId) return null;
  const capabilities = Array.isArray(v.capabilities)
    ? v.capabilities.filter((item): item is string => typeof item === "string" && item.trim() !== "")
    : Array.isArray(v.allowedActions)
      ? v.allowedActions.filter((item): item is string => typeof item === "string" && item.trim() !== "")
      : null;
  return {
    delegationId,
    requestId: pick(v, REQUEST_ID_KEYS) ?? null,
    from: actorOf(v, FROM_ID_KEYS, FROM_NAME_KEYS),
    to: actorOf(v, TO_ID_KEYS, TO_NAME_KEYS),
    taskId: pick(v, TASK_ID_KEYS) ?? null,
    status: pick(v, STATUS_KEYS) ?? null,
    scopeText: humanSentence(pick(v, SCOPE_TEXT_KEYS)),
    capabilityCount: capabilities ? capabilities.length : null,
    audience: pick(v, AUDIENCE_KEYS) ?? null,
    action: pick(v, ACTION_KEYS) ?? null,
    effectiveFrom: pick(v, EFFECTIVE_KEYS) ?? null,
    expiresAt: pick(v, EXPIRES_KEYS) ?? null,
    source: pick(v, SOURCE_KEYS) ?? null,
    createdAt: pick(v, CREATED_KEYS) ?? null,
    updatedAt: pick(v, UPDATED_KEYS) ?? null,
  };
}

/* ── error reading ──────────────────────────────────────────────────── */

export type ErrorInfo = Failure & { status: number };

/**
 * Human words per code. A 401 is NOT an error here: the page owes a
 * 「需要登录」 state, so it gets its own status that the caller folds into
 * the login leg. 403 and 404 share one sentence, one code word and one
 * request id — and never repeat the path back.
 */
export function errorInfo(err: unknown): ErrorInfo {
  const status = err instanceof ApiError ? err.status : 0;
  const requestId = err instanceof ApiError ? err.requestId ?? null : null;
  // `err.url` is kept out of the technical line on the denied leg: the panel
  // must read the same whatever the route spelling was.
  const technical = err instanceof ApiError && err.status ? `HTTP ${err.status}` : null;
  if (status === 401) {
    return { status, sentence: "这个清单需要登录后才能看到。", requestId, technical };
  }
  if (status === 403 || status === 404) {
    // No code word at all: a panel that printed 403 for one answer and 404
    // for the other would hand back the difference between them.
    return { status, sentence: "这些委托现在看不到。", requestId, technical: null };
  }
  if (status === 400) {
    return { status, sentence: "这次读取缺少服务要求的条件，清单没有取回来。", requestId, technical };
  }
  if (status === 429) {
    return { status, sentence: "读取太频繁，稍等一会儿再试。", requestId, technical };
  }
  if (status >= 500) {
    return { status, sentence: "委托服务暂时没有响应，请稍后重试。", requestId, technical };
  }
  if (status === 0) {
    return { status, sentence: "当前网络不可达，请检查连接后重试。", requestId, technical };
  }
  return { status, sentence: "委托清单读取失败，请重试。", requestId, technical };
}

/* ── the read ───────────────────────────────────────────────────────── */

export function listUrl(limit = PAGE_LIMIT): string {
  return `${LIST_PATH}?limit=${encodeURIComponent(String(limit))}`;
}

/**
 * One honest read. Every outcome folds into a ListState — this never throws
 * at the page, and never returns rows that the answer did not carry.
 */
export async function loadDelegations(): Promise<ListState> {
  const url = listUrl();
  let body: unknown;
  try {
    // allowUnauthorized: a 401 is the expected local answer and must surface
    // as this page's「需要登录」state instead of the shared 401 reload path
    // (`/collab` is not one of the paths `lib/api.ts` reloads for).
    body = await fetchJSON<unknown>(url, undefined, { allowUnauthorized: true });
  } catch (err) {
    const info = errorInfo(err);
    const failure: Failure = { sentence: info.sentence, requestId: info.requestId, technical: info.technical };
    if (info.status === 401) return { phase: "login", rows: [], unreadable: 0, failure };
    if (info.status === 403 || info.status === 404) {
      return { phase: "denied", rows: [], unreadable: 0, failure };
    }
    return { phase: "error", rows: [], unreadable: 0, failure };
  }
  if (!rec(body) || !Array.isArray(body.items)) {
    // A 2xx that is not a delegation list says so; it never paints rows.
    return {
      phase: "error",
      rows: [],
      unreadable: 0,
      failure: {
        sentence: "这份回答不是委托清单，本页不按它展示。",
        requestId: null,
        technical: "shape check",
      },
    };
  }
  let unreadable = 0;
  const rows = body.items.map((item) => normalizeDelegation(item)).filter((row): row is DelegationRow => {
    if (row) return true;
    unreadable += 1;
    return false;
  });
  return {
    phase: rows.length ? "ready" : "empty",
    rows,
    unreadable,
    failure: null,
    asOf: typeof body.asOf === "string" ? body.asOf : null,
  };
}

/* ── display ────────────────────────────────────────────────────────── */

/**
 * The service's read stamp as a Beijing wall-clock minute (`MM-DD HH:mm`).
 * Anything the service did not stamp, or that does not parse, is null: the
 * page prints 「—」 plus a reason rather than substituting the local clock.
 */
export function readingStamp(asOf: string | null | undefined): string | null {
  if (typeof asOf !== "string" || asOf.trim() === "") return null;
  const ms = Date.parse(asOf);
  if (!Number.isFinite(ms)) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  if (!month || !day || !hour || !minute) return null;
  return `${month}-${day} ${hour}:${minute}`;
}

/**
 * The 8-character display code: last segment of a handle, alphanumerics only,
 * uppercase. Fewer than four usable characters is not a code worth showing,
 * so the caller falls back to the bare role instead of painting a fragment
 * of `human:1`.
 */
export function shortCode(value: string | null | undefined): string {
  if (!value) return "";
  const tail = value.split(/[:_/@#-]/).filter(Boolean).pop() ?? "";
  const clean = tail.replace(/[^0-9A-Za-z]/g, "");
  if (clean.length < 4) return "";
  return clean.slice(-8).toUpperCase();
}

/**
 * 委托方 / 受托方 as a person reads them: 「姓名 · 8 位短码」, or
 * 「员工 · 8 位短码」 when only the handle arrived, or 「未指派」 when the
 * delegation was never given to anybody. A bare `emp_…` / `human:…` never
 * reaches the surface — the full value goes to `title` and 「技术详情」.
 */
export function actorLabel(actor: Actor, role: "from" | "to"): { text: string; title: string | null } {
  const code = shortCode(actor.id);
  const title = [actor.name, actor.id].filter(Boolean).join(" · ") || null;
  if (actor.name && code) return { text: `${actor.name} · ${code}`, title };
  if (actor.name) return { text: actor.name, title };
  if (code) return { text: `${role === "to" ? "受托员工" : "委托员工"} · ${code}`, title };
  if (actor.id) {
    // A handle too short to code is still an attribution: say who in words,
    // keep the string in the title.
    return { text: role === "to" ? "受托员工（编号不完整）" : "委托员工（编号不完整）", title };
  }
  if (role === "to") return { text: "未指派", title: null };
  // An unnamed delegator is not 「未指派」: the record simply never said.
  return { text: NOT_RECORDED, title: null };
}

/** The tones the vendored Badge accepts (its own union is not exported). */
export type Tone = "default" | "destructive" | "outline" | "secondary" | "success" | "warning";

/** 状态人话. Unknown tokens read as 未识别 — the raw enum stays in `title`. */
export function statusWords(status: string | null): { text: string; tone: Tone; raw: string | null } {
  switch (status) {
    case "requested":
      return { text: "已提出，等待接受", tone: "warning", raw: status };
    case "accepted":
      return { text: "已接受", tone: "secondary", raw: status };
    case "handed_off":
      return { text: "已交接回发起方", tone: "secondary", raw: status };
    case "completed":
      return { text: "已完成", tone: "success", raw: status };
    case "rejected":
      return { text: "已拒绝", tone: "destructive", raw: status };
    case "expired":
      return { text: "已过期", tone: "outline", raw: status };
    case null:
      return { text: NOT_RECORDED, tone: "outline", raw: null };
    default:
      return { text: "状态未识别", tone: "outline", raw: status };
  }
}

/** 动作人话. The raw token only ever travels in `title`. */
export function actionWords(action: string | null): { text: string; raw: string | null } {
  switch (action) {
    case "assign":
      return { text: "指派", raw: action };
    case "handoff":
    case "hand_off":
      return { text: "交接", raw: action };
    case "borrow":
      return { text: "借调", raw: action };
    case "return":
      return { text: "交还", raw: action };
    case "request":
      return { text: "请求协助", raw: action };
    case "transfer":
      return { text: "转移", raw: action };
    case "delegate":
      return { text: "委托", raw: action };
    case null:
      return { text: NOT_RECORDED, raw: null };
    default:
      return { text: "动作未识别", raw: action };
  }
}

/** 来源人话. The raw token only ever travels in `title`. */
export function sourceWords(source: string | null): { text: string; raw: string | null } {
  switch (source) {
    case "console":
      return { text: "控制台发起", raw: source };
    case "api":
      return { text: "接口发起", raw: source };
    case "chat":
      return { text: "会话中发起", raw: source };
    case "scheduler":
    case "cron":
      return { text: "定时任务发起", raw: source };
    case "agent":
      return { text: "员工之间互派", raw: source };
    case "human":
      return { text: "人工发起", raw: source };
    case null:
      return { text: NOT_RECORDED, raw: null };
    default:
      return { text: "来源未识别", raw: source };
  }
}

/**
 * Beijing wall clock to the minute. A value that is not an instant reads as
 * 「未记录」 with the reason — never an ISO string, never `Invalid Date`.
 */
export function beijingMinute(value: string | null | undefined): { text: string | null; reason: string } {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return { text: null, reason: "服务没有给出这个时间" };
  let date: Date | null = null;
  if (/^\d{9,10}$/.test(raw)) date = new Date(Number(raw) * 1000);
  else if (/^\d{11,13}$/.test(raw)) date = new Date(Number(raw));
  else if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/.test(raw)) date = new Date(raw);
  if (!date) return { text: null, reason: "服务给的不是一个能读出的时间" };
  if (Number.isNaN(date.getTime())) return { text: null, reason: "服务给的时间读不出时刻" };
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const at = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";
  const [y, mo, da, hh, mi] = [at("year"), at("month"), at("day"), at("hour"), at("minute")];
  if (!y || !mo || !da) return { text: null, reason: "服务给的时间读不出时刻" };
  return { text: `${y}-${mo}-${da} ${hh}:${mi}`, reason: "" };
}

/**
 * 生效至 in three honest states: a future minute, a minute that has already
 * passed, and no instant at all. Frozen DELEGATION v1.0 has no expiry column,
 * so 「未记录」 is the expected local answer and is stated as such.
 */
export function validityCell(
  row: Pick<DelegationRow, "expiresAt">,
  now: number = Date.now(),
): { text: string | null; note: string | null; reason: string } {
  const at = beijingMinute(row.expiresAt);
  if (!at.text) return { text: null, note: null, reason: at.reason };
  const instant = row.expiresAt && /^\d{4}-\d{2}-\d{2}/.test(row.expiresAt.trim()) ? Date.parse(row.expiresAt.trim()) : NaN;
  if (Number.isFinite(instant) && instant <= now) {
    return { text: at.text, note: "已到期", reason: "" };
  }
  return { text: at.text, note: null, reason: "" };
}

/**
 * 范围 as one readable line: what may be done, for whom. A sentence the answer
 * carried is used verbatim; capability items are counted (their codes stay
 * technical); nothing is invented when neither arrived.
 */
export function scopeCell(row: DelegationRow): { text: string | null; detail: string | null; reason: string } {
  const audience = row.audience
    ? humanSentence(row.audience) ?? `对象 · ${shortCode(row.audience) || "未给出"}`
    : null;
  const what = row.scopeText;
  const count = row.capabilityCount;
  if (what && audience) return { text: `${what}（对 ${audience}）`, detail: null, reason: "" };
  if (what) return { text: what, detail: null, reason: "" };
  if (count !== null && count > 0) {
    return { text: `可执行 ${count} 项能力`, detail: audience ? `对 ${audience}` : null, reason: "" };
  }
  if (audience) return { text: `范围未写明（只写明对象：${audience}）`, detail: null, reason: "" };
  return { text: null, detail: null, reason: "服务没有随这条委托给出范围说明" };
}

/**
 * The chain the DELEGATION v1.0 record cannot carry: it has no parent
 * delegation id, so a row's upstream hand is simply not in the answer. The
 * chain view therefore groups by delegator and says the link is missing —
 * it never prints a depth, never invents a root, never shows 0.
 */
export const CHAIN_LINK_REASON =
  "服务没有给出这条委托的上一手编号（DELEGATION v1.0 记录里没有这个字段），链的上游接不上";

/** One delegator and the rows that started from them, in answer order. */
export interface ChainGroup {
  key: string;
  text: string;
  title: string | null;
  rows: DelegationRow[];
}

export function chainGroups(rows: DelegationRow[]): ChainGroup[] {
  const groups: ChainGroup[] = [];
  const index = new Map<string, ChainGroup>();
  for (const row of rows) {
    const label = actorLabel(row.from, "from");
    const key = label.text;
    const seen = index.get(key);
    if (seen) {
      seen.rows.push(row);
      continue;
    }
    const group: ChainGroup = { key, text: label.text, title: label.title, rows: [row] };
    index.set(key, group);
    groups.push(group);
  }
  return groups;
}

/** What the fallback chain never did: this page has exactly one route. */
export function askedLine(): string {
  return `route: ${LIST_PATH} (limit=${PAGE_LIMIT})`;
}
