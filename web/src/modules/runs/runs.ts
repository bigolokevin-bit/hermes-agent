/**
 * T15 (PRD v4.1) runs data layer — read-only list reads on the real BFF
 * routes. No retry/cancel write is exposed from this file yet (the detail
 * leg owns it), and nothing here ever fabricates a row or a total.
 *
 * THE ROUTES WERE DISCOVERED, NOT INVENTED. Probed on 2026-11-19 against
 * the console BFF on `127.0.0.1:8092` (`L4ConsoleBFF/0.1`, no identity
 * header): every path — registered or not — answers 401
 * `console.unauthenticated` because the identity gate runs before routing
 * (recorded in `docs/_artifacts/aud/DONE.md` §6/§T4). So existence of a
 * route cannot be told from outside; the screen reads whatever code the
 * answer really carried and says so in human words.
 *
 *   route               where it comes from
 *   ------------------  ----------------------------------------------------
 *   /api/runs           the list contract route for this task; the same
 *                       route is read by the duty module
 *                       (`web/src/modules/duty/api.ts` → `fetchRuns`,
 *                       params `since` / `limit` / `status`) — probe: 401
 *   /api/run-stats      the declared fallback; duty reads it as a STATS
 *                       route (`fetchRunStats(from, to, bucket)` — it
 *                       answered 400 to a window/`since` parameter in the
 *                       RUNS-01 audit, so the ask uses its real names
 *                       `from`/`to`) — probe: 401. A 2xx here counts as a
 *                       list ONLY if `items` really is an array of run-
 *                       shaped records; buckets or totals read as 「这份回
 *                       答不是运行列表」, never as invented rows.
 *
 * The `/api/` segment is part of every URL: the dev proxy forwards
 * `/agent-api/api/…` and nothing else, so dropping the segment would
 * address a static file instead of the BFF.
 *
 * Field reading is defensive: an absent value stays absent and renders
 * 「—」 plus the reason — never `0`, never an empty string, never a guess.
 * Raw ids, codes and ISO instants live in `title` attributes and the
 * collapsed 「技术详情」, never in the sentence layer.
 */
import { ApiError } from "@/lib/api-error";
import { fetchJSON } from "@/lib/api";

/**
 * The gap this page belongs to. GAP-01…GAP-08 are already carried by other
 * panes in `web/src/**` and `docs/_artifacts/**` (checked before claiming),
 * so this lane takes the next free number.
 */
export const GAP = "GAP-09";

/** Page size asked for; the on-screen denominator is stated against it. */
export const PAGE_LIMIT = 30;

/** Time-window filter. The ISO instant is computed when the ask happens. */
export const SINCE_OPTIONS = [
  { key: "24h", label: "近 24 小时", hours: 24 },
  { key: "7d", label: "近 7 天", hours: 24 * 7 },
  { key: "30d", label: "近 30 天", hours: 24 * 30 },
] as const;

export type SinceKey = (typeof SINCE_OPTIONS)[number]["key"];

export const DEFAULT_SINCE: SinceKey = "7d";

export function sinceKeyOf(raw: string | null): SinceKey {
  return SINCE_OPTIONS.some((option) => option.key === raw) ? (raw as SinceKey) : DEFAULT_SINCE;
}

export function sinceIso(key: SinceKey): string {
  const hours = SINCE_OPTIONS.find((option) => option.key === key)?.hours ?? 24;
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

export function sinceLabel(key: SinceKey): string {
  return SINCE_OPTIONS.find((option) => option.key === key)?.label ?? key;
}

/** List routes tried in order. `/api/` segment kept on every one. */
export const LIST_ROUTES = ["/agent-api/api/runs", "/agent-api/api/run-stats"] as const;

/* ── shapes ─────────────────────────────────────────────────────────── */

export interface RunRow {
  runId: string;
  employeeId?: string;
  taskId?: string;
  status?: string;
  reasonCode?: string;
  costUsd?: number | null;
  costStatus?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  employeeVersionNo?: number;
  attemptNo?: number;
  budgetCapUsd?: number | null;
}

export type Phase = "loading" | "ready" | "empty" | "error" | "denied";

export interface Failure {
  sentence: string;
  requestId: string | null;
  technical: string | null;
}

export interface ListState {
  phase: Phase;
  rows: RunRow[];
  cursor: string | null;
  /** The route whose answer produced this state; null = nothing answered. */
  answeredBy: string | null;
  /** Rows dropped because the answer carried no readable run id. */
  unreadable: number;
  failure: Failure | null;
}

export interface ListQuery {
  status?: string;
  /** Accepted by the BFF under exactly this name (contract: employeeId/status/since). */
  employeeId?: string;
  since: string;
  cursor?: string;
}

/** Status values the select can ask for; 「全部」 sends no status at all. */
export const STATUS_KEYS = ["running", "completed", "failed", "cancelled", "interrupted"] as const;

export function statusFilterOf(raw: string | null): string | null {
  return raw !== null && (STATUS_KEYS as readonly string[]).includes(raw) ? raw : null;
}

/* ── normalisation ──────────────────────────────────────────────────── */

function rec(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function n(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  }
  return null;
}

export function normalizeRun(v: unknown): RunRow | null {
  if (!rec(v)) return null;
  const runId = str(v.runId) ?? str(v.id);
  if (!runId) return null;
  return {
    runId,
    employeeId: str(v.employeeId),
    taskId: str(v.taskId),
    status: str(v.status),
    reasonCode: str(v.reasonCode),
    costUsd: n(v.costUsd),
    costStatus: str(v.costStatus),
    startedAt: str(v.startedAt),
    endedAt: str(v.endedAt),
    createdAt: str(v.createdAt),
    updatedAt: str(v.updatedAt),
    employeeVersionNo: n(v.employeeVersionNo) ?? undefined,
    attemptNo: n(v.attemptNo) ?? undefined,
    budgetCapUsd: n(v.budgetCapUsd),
  };
}

/* ── error reading ──────────────────────────────────────────────────── */

export type ErrorInfo = Failure & { status: number };

/** Human words per code. Never an HTTP code, a route or a raw body. */
export function errorInfo(err: unknown): ErrorInfo {
  const status = err instanceof ApiError ? err.status : 0;
  const requestId = err instanceof ApiError ? err.requestId ?? null : null;
  const technical = err instanceof ApiError && err.status ? `HTTP ${err.status} ${err.url}` : null;
  if (status === 401) return { status, sentence: "登录状态已过期，重新登录后再刷新就能看到。", requestId, technical };
  if (status === 403 || status === 404) return { status, sentence: "这些运行记录现在看不到。", requestId, technical };
  if (status === 400) return { status, sentence: "这次筛选没有被接受，请调整状态或时间范围后重试。", requestId, technical };
  if (status === 0) return { status, sentence: "当前网络不可达，请检查连接后重试。", requestId, technical };
  if (status === 429) return { status, sentence: "请求太频繁，请稍后再试。", requestId, technical };
  if (status >= 500) return { status, sentence: "运行服务暂时没有响应，请稍后重试。", requestId, technical };
  return { status, sentence: "运行数据读取失败，请重试。", requestId, technical };
}

/* ── list read with the declared fallback ───────────────────────────── */

/** What one route answered, folded into a ListState. */
type RouteAnswer =
  | { k: "list"; items: unknown[]; cursor: string | null; answeredBy: string }
  | { k: "absent"; error: ErrorInfo }
  | { k: "failed"; error: ErrorInfo };

async function askListRoute(path: string, q: ListQuery): Promise<RouteAnswer> {
  // `/api/runs` is documented with since/limit/status (the duty read uses
  // the same names). `/api/run-stats` is the stats route — it answered 400
  // to a window parameter in the RUNS-01 audit, and its accepted names are
  // from/to, so the fallback asks with THOSE and nothing else.
  const params = path.includes("run-stats")
    ? new URLSearchParams({ from: q.since, to: new Date().toISOString() })
    : new URLSearchParams({ since: q.since, limit: String(PAGE_LIMIT) });
  if (!path.includes("run-stats")) {
    if (q.status) params.set("status", q.status);
    // The BFF accepts exactly employeeId/status/since. Never send a display-level
    // alias such as createdByEmpIdEquals — it is not a known key and the read fails
    // with 400 request.missing_filter.
    if (q.employeeId) params.set("employeeId", q.employeeId);
    if (q.cursor) params.set("cursor", q.cursor);
  }
  const url = `${path}?${params.toString()}`;
  let body: unknown;
  try {
    body = await fetchJSON<unknown>(url);
  } catch (err) {
    const info = errorInfo(err);
    // 404 on one spelling = this route is not here; the other route may be.
    // 403 and every other code = this is the real answer, do not retry elsewhere.
    if (info.status === 404) return { k: "absent", error: info };
    return { k: "failed", error: info };
  }
  if (rec(body) && Array.isArray(body.items)) {
    return { k: "list", items: body.items, cursor: str(body.nextCursor) ?? null, answeredBy: path };
  }
  // A 2xx that is not a list shape says so; it never paints invented rows.
  return {
    k: "failed",
    error: {
      status: 502,
      sentence: "这个回答不是运行列表，本页不按它展示。",
      requestId: null,
      technical: `shape check GET ${path}`,
    },
  };
}

export async function loadRuns(q: ListQuery): Promise<ListState> {
  let lastAbsent: ErrorInfo | null = null;
  for (const path of LIST_ROUTES) {
    const answer = await askListRoute(path, q);
    if (answer.k === "list") {
      let unreadable = 0;
      const rows = answer.items.map(normalizeRun).filter((row): row is RunRow => {
        if (row) return true;
        unreadable += 1;
        return false;
      });
      return {
        phase: rows.length ? "ready" : "empty",
        rows,
        cursor: answer.cursor,
        answeredBy: answer.answeredBy,
        unreadable,
        failure: null,
      };
    }
    if (answer.k === "failed") {
      return {
        phase: answer.error.status === 403 ? "denied" : "error",
        rows: [],
        cursor: null,
        answeredBy: null,
        unreadable: 0,
        failure: {
          sentence: answer.error.sentence,
          requestId: answer.error.requestId,
          technical: answer.error.technical,
        },
      };
    }
    lastAbsent = lastAbsent ?? answer.error; // the primary route's id is the quotable one
  }
  // Every list route answered 404: not a failure to reach the service —
  // the service itself says this content is not here. 403 and 404 draw
  // ONE body, so the state is denied with whatever id the answer carried.
  return {
    phase: "denied",
    rows: [],
    cursor: null,
    answeredBy: null,
    unreadable: 0,
    failure: {
      sentence: "运行记录清单暂时不可见。",
      requestId: lastAbsent?.requestId ?? null,
      technical: lastAbsent?.technical ?? null,
    },
  };
}

/* ── display ────────────────────────────────────────────────────────── */

/** Beijing wall clock to the minute; null = not an instant, with the reason. */
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
  return { text: `${y}-${mo}-${da} ${hh}:${mi}`, reason: "服务给的时间读不出时刻" };
}

/** Elapsed, to the minute (PRD v4.1: started AND elapsed read to the minute). */
export function elapsedMinute(
  startedAt: string | null | undefined,
  endedAt: string | null | undefined,
): { text: string | null; reason: string } {
  const start = beijingMinute(startedAt);
  if (!start.text) return { text: null, reason: "没有开始时间，算不出耗时" };
  const a = Date.parse(startedAt ?? "");
  const openRun = endedAt === undefined || endedAt === null || String(endedAt).trim() === "";
  const b = openRun ? Date.now() : Date.parse(endedAt ?? "");
  if (!openRun && !Number.isFinite(b)) return { text: null, reason: "结束时间不是一个能读出的时刻" };
  if (!Number.isFinite(a)) return { text: null, reason: "开始时间不是一个能读出的时刻" };
  if (b < a) return { text: null, reason: "结束时间早于开始时间，这里不作猜" };
  const totalMinutes = Math.floor((b - a) / 60_000);
  if (totalMinutes < 1) return { text: openRun ? "刚开始，不足 1 分钟" : "不足 1 分钟", reason: "" };
  if (totalMinutes < 60) return { text: `${totalMinutes} 分钟`, reason: "" };
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { text: minutes ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`, reason: "" };
}

export type CostState = "known" | "unknown" | "missing";

/** costStatus is the only authority for whether a cost figure is usable. */
export function costState(run: Pick<RunRow, "costStatus" | "costUsd">): CostState {
  if (run.costStatus === "unknown") return "unknown";
  if (!run.costStatus) return "missing";
  return "known";
}

/**
 * The cost cell. A known figure prints in USD — a true 0 prints $0.00;
 * unknown and missing print 「—」 and never touch costUsd, so a figure the
 * ledger did not price can never leak onto screen as 0.
 */
export function costText(run: Pick<RunRow, "costStatus" | "costUsd">): string {
  return costState(run) === "known" ? usd(run.costUsd) : "—";
}

export function costBadgeLabel(run: Pick<RunRow, "costStatus">): string {
  const state = costState(run);
  if (state === "unknown") return "未知";
  if (state === "missing") return "未记录";
  return "已计价";
}

export function costReason(run: Pick<RunRow, "costStatus" | "costUsd">): string {
  const state = costState(run);
  if (state === "unknown") return "账本没有这条运行的计价记录，金额按未知处理";
  if (state === "missing") return "服务未返回计价状态，金额按未记录处理";
  if (run.costStatus === "estimated") return "金额为估算值";
  if (run.costStatus === "mixed") return "金额含上游账本与估算两种来源";
  if (run.costUsd === null || run.costUsd === undefined) return "服务未返回金额";
  return "金额来自上游账本";
}

export function usd(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * The run id as a person can quote: 「运行 · 后4位」. The full value goes in
 * the `title`, never on the surface — a bare full id is engineering noise.
 */
export function runCode(raw: string | null | undefined): string {
  if (!raw) return "运行";
  const bare = raw.replace(/^[^:]*:/, "").replace(/[^0-9A-Za-z]/g, "");
  const tail = bare.slice(-4).toUpperCase();
  return tail ? `运行 · ${tail}` : "运行";
}

/** A technical short form for links; full value stays in `title`. */
export function shortId(raw?: string): string {
  if (!raw) return "—";
  const bare = raw.replace(/^[^:]*:/, "");
  return bare.length > 12 ? `${bare.slice(0, 6)}…${bare.slice(-4)}` : bare;
}

export function statusLabel(raw?: string): string {
  switch (raw) {
    case "pending": return "待派发";
    case "running": return "运行中";
    case "completed": return "成功";
    case "failed": return "失败";
    case "cancelled": return "已取消";
    case "interrupted": return "已中断";
    // An unlisted word is not the same thing as an absent one: a status this
    // table has not met reads 「待核实」 (raw value in the cell title), while a
    // genuinely missing status keeps the missing-value dash.
    case undefined:
    case "":
      return "—";
    default: return "待核实";
  }
}

export function statusTone(raw?: string): "success" | "warning" | "destructive" | "secondary" | "outline" {
  if (raw === "completed") return "success";
  if (raw === "failed") return "destructive";
  if (raw === "running" || raw === "pending") return "secondary";
  if (raw === "interrupted") return "warning";
  return "outline";
}

export function reasonLabel(raw?: string): string {
  switch (raw) {
    case "run.budget_exhausted": return "预算耗尽";
    case "run.timeout": return "运行超时";
    case "run.cancelled": return "运行已取消";
    case "run.approval_rejected": return "审批被拒";
    default: return "—";
  }
}

/** The 失败原因 column: words for failures, an honest gap otherwise — never a code. */
export function failureSummary(row: Pick<RunRow, "status" | "reasonCode">): { text: string; reason: string } {
  if (row.status === "failed" || row.status === "cancelled" || row.status === "interrupted") {
    if (!row.reasonCode) return { text: "未记录", reason: "服务没有给出失败原因" };
    const known = reasonLabel(row.reasonCode);
    if (known !== "—") return { text: known, reason: "" };
    return { text: "原因代码未识别", reason: "服务给的原因不在这份对照表里" };
  }
  if (row.status === "completed") return { text: "—", reason: "这条运行成功了" };
  return { text: "—", reason: "这条运行还没有失败" };
}

/** Task handles are technical ids; show a short labelled tail, full value in title. */
export function taskLabel(raw?: string): string {
  if (!raw) return "—";
  const bare = raw.replace(/^[^:]*:/, "").replace(/[^0-9A-Za-z]/g, "");
  return bare ? `任务 · ${bare.slice(-4).toUpperCase()}` : "任务";
}

/**
 * The employee cell speaks the same way as the rest of the console: a display
 * name plus an 8-character code, or 「未指派」 when the run carries no owner.
 * The full id never becomes a text node — it rides the cell `title`/copy.
 */
export function employeeCode(id: string | null | undefined): string {
  if (!id) return "";
  // `emp_9F42…`, `human:u_10001` and a bare hex id all reduce to the same
  // thing: the ledger's own characters, prefix dropped.
  const bare = id.replace(/^[A-Za-z]+[_:]/, "").replace(/[^0-9A-Za-z]/g, "");
  if (!bare) return "";
  return bare.length >= 8 ? bare.slice(0, 8).toUpperCase() : bare.toUpperCase();
}

/** Employees may be unnamed in this read; the code still identifies them. */
export function employeeLabel(id: string | null | undefined, names: Map<string, string>): string {
  if (!id) return "未指派";
  const code = employeeCode(id);
  const named = names.get(id);
  if (named && code) return `${named} · ${code}`;
  if (named) return named;
  return code ? `员工 · ${code}` : "员工";
}

/* ── detail leg: the one run, its events, and a retry that means a NEW run ── */

export interface RunEvent {
  seq: number;
  eventType?: string;
  occurredAt?: string;
  payload?: Record<string, unknown>;
}

export interface RunDetail extends RunRow {
  upstreamRunId?: string;
  channelEventId?: string;
  previousRunId?: string;
  policySnapshotRef?: string;
  lastEventSeq?: number;
}

export function normalizeDetail(v: unknown): RunDetail | null {
  const base = normalizeRun(v);
  if (!base || !rec(v)) return null;
  return {
    ...base,
    upstreamRunId: str(v.upstreamRunId),
    channelEventId: str(v.channelEventId),
    previousRunId: str(v.previousRunId),
    policySnapshotRef: str(v.policySnapshotRef),
    lastEventSeq: n(v.lastEventSeq) ?? undefined,
  };
}

export function normalizeEvent(v: unknown): RunEvent | null {
  if (!rec(v)) return null;
  const seq = n(v.seq);
  if (seq === null) return null;
  return {
    seq,
    eventType: str(v.eventType),
    occurredAt: str(v.occurredAt),
    payload: rec(v.payload) ? v.payload : undefined,
  };
}

export async function loadRunDetail(runId: string): Promise<RunDetail> {
  const body = await fetchJSON<unknown>(`/agent-api/api/run-detail?id=${encodeURIComponent(runId)}`);
  const detail = normalizeDetail(body);
  if (!detail) throw new ApiError("shape", { status: 502, body: "", url: "/agent-api/api/run-detail" });
  return detail;
}

export async function loadRunEvents(runId: string): Promise<{ items: RunEvent[]; hasMore: boolean }> {
  const body = await fetchJSON<unknown>(`/agent-api/api/run-events?runId=${encodeURIComponent(runId)}&limit=50`);
  if (!rec(body) || !Array.isArray(body.items)) {
    throw new ApiError("shape", { status: 502, body: "", url: "/agent-api/api/run-events" });
  }
  return {
    items: body.items.map(normalizeEvent).filter((e): e is RunEvent => e !== null),
    hasMore: body.hasMore === true,
  };
}

/**
 * Retry means a NEW run: a fresh id is created upstream and the page would
 * navigate to it — the current runId is never reused or rewritten. The answer
 * must carry the new id; without one there is nothing honest to navigate to,
 * and this throws instead of pretending.
 *
 * Measured 2026-11-20 on the served console: POST /api/run-retry answers
 * HTTP 405 {"code":"console.read_only"} and GET answers 404
 * {"code":"console.unknown_route"} — the write channel is closed at the
 * console, so the page renders the entry disabled with that reason instead of
 * calling this. The helper stays for the generation that opens the channel.
 */
export async function requestRetryRun(runId: string): Promise<string> {
  const body = await fetchJSON<unknown>("/agent-api/api/run-retry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ runId }),
  });
  const newId = rec(body) ? str(body.runId) ?? str(body.id) : null;
  if (!newId) {
    throw new ApiError("shape", { status: 502, body: "", url: "/agent-api/api/run-retry" });
  }
  return newId;
}

export function eventLabel(raw?: string): string {
  switch (raw) {
    case "token": return "模型输出";
    case "tool_intent": return "工具意图";
    case "tool_call": return "工具调用";
    case "tool_result": return "工具结果";
    case "approval_requested": return "发起审批";
    case "message": return "消息";
    case "started": return "开始";
    case "completed": return "完成";
    case "failed": return "失败";
    case "in_progress": return "进行中";
    // An unlisted event type is not "other" — the screen has to say it could
    // not be read and keep the service's own spelling in the title.
    default: return "待核实";
  }
}

/**
 * The tool family carries the result reference. The intent event holds it once
 * the tool has answered, and a result event may repeat it; a plain message
 * event never carries one. Matching is case-insensitive because the wire
 * spelling is not guaranteed.
 */
const TOOL_EVENTS = new Set(["tool_intent", "tool_call", "tool_result"]);

export function isToolEvent(raw?: string): boolean {
  return TOOL_EVENTS.has((raw ?? "").trim().toLowerCase());
}

/** resultRef is stored on the tool intent; the event API does not always echo it. */
export function resultRef(ev: Pick<RunEvent, "eventType" | "payload">): string | null {
  if (!isToolEvent(ev.eventType)) return null;
  const raw = ev.payload?.resultRef ?? ev.payload?.result_ref;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

/** The 请求编号's own honest word when the answer carried none. */
/** A short, human line for one timeline event; never an empty cell. */
export function eventSummary(ev: Pick<RunEvent, "payload">): { text: string; reason: string } {
  const payload = ev.payload ?? {};
  for (const key of ["delta", "message", "summary", "text", "note", "reason"]) {
    const raw = payload[key];
    if (typeof raw !== "string") continue;
    const text = raw.replace(/\s+/g, " ").trim();
    if (!text) continue;
    return { text: text.length > 120 ? `${text.slice(0, 120)}…` : text, reason: "" };
  }
  return {
    text: "未记录",
    reason: "这条事件没有带回可读的摘要（期望字段 delta / message / summary / text / note / reason）",
  };
}

/** True when this event is the failure of a step, so a cause may exist. */
export function isFailureEvent(ev: Pick<RunEvent, "eventType" | "payload">): boolean {
  const type = (ev.eventType ?? "").trim().toLowerCase();
  if (type.includes("fail") || type.includes("error") || type === "denied") return true;
  const error = ev.payload?.error;
  return typeof error === "object" && error !== null;
}

/** The cause a failed step carries, with the field it was read from. */
export function eventReason(
  ev: Pick<RunEvent, "eventType" | "payload">,
): { text: string; reason: string } | null {
  if (!isFailureEvent(ev)) return null;
  const payload = ev.payload ?? {};
  const error = (payload.error ?? {}) as Record<string, unknown>;
  const codeRaw = error.code ?? payload.errorCode ?? payload.reasonCode ?? payload.reason;
  const code = typeof codeRaw === "string" ? codeRaw.trim() : "";
  const said = error.messageRedacted ?? error.message;
  const sentence = typeof said === "string" ? said.replace(/\s+/g, " ").trim() : "";
  const known = code ? reasonLabel(code) : "—";
  if (known !== "—") return { text: sentence ? `${known}：${sentence}` : known, reason: "" };
  if (code) {
    return {
      text: `原因代码未识别（${shortId(code)}）`,
      reason: "服务给的原因不在这份对照表里",
    };
  }
  return {
    text: "未记录",
    reason: "服务没有给出失败原因（期望字段 error.code / reasonCode / reason）",
  };
}

/**
 * Where a tool event's result reference points, when the console can read it.
 * Only audit-event ids have a page on this generation; anything else is said
 * to be unreachable instead of becoming a link that lands nowhere.
 */
export function resultRefHref(ref: string | null): string | null {
  if (!ref) return null;
  return /^(ev|evt)_[A-Za-z0-9]{6,}$/.test(ref) ? `/audit?detail=${encodeURIComponent(ref)}` : null;
}

/** R40: the human word for what this step was doing, never the service spelling. */
export function eventStatus(ev: Pick<RunEvent, "eventType">): { text: string; reason: string } {
  switch ((ev.eventType ?? "").trim().toLowerCase()) {
    case "started": return { text: "已开始", reason: "" };
    case "in_progress":
    case "running": return { text: "进行中", reason: "" };
    case "completed": return { text: "已完成", reason: "" };
    case "failed": return { text: "失败", reason: "" };
    case "denied": return { text: "被拒", reason: "" };
    case "tool_intent": return { text: "拟调用工具", reason: "" };
    case "tool_call": return { text: "调用中", reason: "" };
    case "tool_result": return { text: "已返回", reason: "" };
    case "message": return { text: "消息", reason: "" };
    case "token": return { text: "模型输出", reason: "" };
    default:
      return { text: "待核实", reason: "服务给的事件类型不在这份对照表里，原值在标题里" };
  }
}

/** R40: how long this step took against the one before it. No previous step, no number. */
export function eventElapsed(
  ev: Pick<RunEvent, "occurredAt">,
  prev: Pick<RunEvent, "occurredAt"> | null,
): { text: string | null; reason: string } {
  if (!prev) return { text: null, reason: "这是第一条事件，前面没有可比较的时刻" };
  const end = Date.parse(ev.occurredAt ?? "");
  const start = Date.parse(prev.occurredAt ?? "");
  if (!Number.isFinite(end) || !Number.isFinite(start)) {
    return { text: null, reason: "这一条或上一条没有可读的时刻" };
  }
  const ms = end - start;
  if (ms < 0) return { text: null, reason: "这一条的时刻早于上一条，本页不写成负数" };
  if (ms < 1000) return { text: (ms / 1000).toFixed(1) + "s", reason: "" };
  if (ms < 60_000) return { text: Math.round(ms / 1000) + "s", reason: "" };
  if (ms < 3_600_000) {
    const m = Math.floor(ms / 60_000);
    const sec = Math.round((ms % 60_000) / 1000);
    return { text: sec ? m + "m " + sec + "s" : m + "m", reason: "" };
  }
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  return { text: m ? h + "h " + m + "m" : h + "h", reason: "" };
}

export const NO_REQUEST_ID = "未提供";

/** What the fallback chain did, as one collapsed technical line. */
export function askedLine(): string {
  return `routes: ${LIST_ROUTES.join(", ")}`;
}

/** A field the answer did not carry; the gap is named, never filled in. */
export interface PreviewField {
  text: string;
  title: string;
}

export interface RunPreview {
  status: PreviewField;
  started: PreviewField;
  ended: PreviewField;
  elapsed: PreviewField;
  cost: PreviewField;
  employee: PreviewField;
}

const FIELD_MISSING = "该字段未返回";

/**
 * The inline preview reads ONLY the row the list already has: no second read,
 * no client clock. Elapsed time needs both ends; without them it stays a dash
 * with the reason, never an "open run" estimate.
 */
export function runPreview(row: RunRow, names: Map<string, string>): RunPreview {
  const rawStatus = typeof row.status === "string" ? row.status.trim() : "";
  const status: PreviewField = rawStatus
    ? { text: statusLabel(row.status), title: `服务返回的原始状态：${rawStatus}` }
    : { text: FIELD_MISSING, title: "服务没有返回运行状态；不代填、不猜" };

  const start = beijingMinute(row.startedAt);
  const started: PreviewField = start.text
    ? { text: start.text, title: String(row.startedAt) }
    : { text: FIELD_MISSING, title: `开始时间${start.reason}` };

  const end = beijingMinute(row.endedAt);
  const ended: PreviewField = end.text
    ? { text: end.text, title: String(row.endedAt) }
    : { text: FIELD_MISSING, title: `结束时间${end.reason}` };

  let elapsed: PreviewField;
  if (!start.text || !end.text) {
    elapsed = { text: "—", title: "开始与结束时间不齐，耗时不计算；不拿本机时间补一端" };
  } else {
    const span = elapsedMinute(row.startedAt, row.endedAt);
    elapsed = span.text
      ? { text: span.text, title: `${String(row.startedAt)} → ${String(row.endedAt)}` }
      : { text: "—", title: span.reason || "这段耗时读不出来" };
  }

  const state = costState(row);
  const cost: PreviewField =
    state === "known"
      ? { text: costText(row), title: "已计价，金额单位：美元（USD）" }
      : { text: "—", title: costReason(row) };

  const employee: PreviewField = row.employeeId
    ? { text: employeeLabel(row.employeeId, names), title: row.employeeId }
    : { text: employeeLabel(row.employeeId, names), title: "这条运行没有带回负责人；不代填、不猜" };

  return { status, started, ended, elapsed, cost, employee };
}

/* ── list copy: the same rows, as plain text ─────────────────────────────── */

/** Column names of the copied text; the header row is exactly this. */
export const RUN_LIST_HEADER = ["run", "status", "started", "ended", "elapsed", "cost", "employee"] as const;

/**
 * Renders the rows the list already holds as plain text. Nothing is re-read:
 * no clock, no request, no page beyond what is on screen.
 */
export function runListText(rows: RunRow[], names: Map<string, string>): string {
  const lines: string[] = [RUN_LIST_HEADER.join(",")];
  for (const row of rows) {
    const start = beijingMinute(row.startedAt);
    const end = beijingMinute(row.endedAt);
    // Two ends or nothing: a half-known span is never closed with `Date.now()`.
    const elapsed = start.text && end.text ? elapsedMinute(row.startedAt, row.endedAt).text ?? "—" : "—";
    const cost = costState(row) === "known" ? costText(row) : "—";
    const status = row.status ? statusLabel(row.status) : "—";
    lines.push(
      [
        runCode(row.runId),
        status,
        start.text ?? "—",
        end.text ?? "—",
        elapsed,
        cost,
        employeeLabel(row.employeeId, names),
      ].join(","),
    );
  }
  return lines.join("\n");
}

/** One decision per phase, so no two entries on the pane disagree about whether the list is usable. */
export interface ListGate {
  disabled: boolean;
  title: string;
}

export function listActionGate(phase: ListState["phase"]): { copy: ListGate; preview: ListGate } {
  switch (phase) {
    case "loading":
      return {
        copy: { disabled: true, title: "还在读取运行记录：等这一页读完再复制。" },
        preview: { disabled: true, title: "还在读取运行记录：等这一页读完再展开。" },
      };
    case "empty":
      return {
        copy: { disabled: true, title: "这一页没有行：没有可复制的文本。" },
        preview: { disabled: true, title: "这一页没有行：没有可展开的预览。" },
      };
    case "error":
      return {
        copy: { disabled: true, title: "这次读取没有成功：先重试，读到数据再复制。" },
        preview: { disabled: true, title: "这次读取没有成功：先重试，读到数据再展开。" },
      };
    case "denied":
      return {
        copy: { disabled: true, title: "当前看不到运行记录：没有可复制的文本。" },
        preview: { disabled: true, title: "当前看不到运行记录：没有可展开的预览。" },
      };
    default:
      return {
        copy: { disabled: false, title: "复制当前列表为纯文本" },
        preview: { disabled: false, title: "展开这一行的预览" },
      };
  }
}
