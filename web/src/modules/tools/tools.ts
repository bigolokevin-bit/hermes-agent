/**
 * tools & MCP data layer — T27 (lane console-aud closeout).
 *
 * One real read, no mock layer, no fallback rows:
 *   `GET /agent-api/api/mcp/servers`
 *
 * The `/api/` segment is part of the route: the console BFF only forwards
 * `/agent-api/api/…`, so dropping it addresses a static path instead. The local
 * BFF has not registered this proxy yet (GAP-04, docs/_artifacts/caps/DONE.md),
 * which is exactly why nothing here may invent a server: an unregistered route
 * answers 404 and the screen says so, it does not answer with a demo row.
 *
 * The BFF forwards the upstream shape verbatim and this repo carries no sample
 * of it, so every field is read defensively. An absent value stays absent and
 * renders 「—」 plus the reason — never `0`, never an empty string, never a
 * guessed name. Raw ids, upstream status tokens and field names go to `title`
 * attributes and the collapsed 「技术详情」, not to the sentence layer.
 */
import { ApiError, errorMessage } from "@/lib/api-error";
import { fetchJSON } from "@/lib/api";

export const SERVERS_PATH = "/agent-api/api/mcp/servers";

/** GAP that names why this pane has no live data source yet. */
export const GAP = "GAP-04";

/** Page size asked for; the denominator on screen is stated against it. */
export const PAGE_LIMIT = 50;

export type ServerStatus = "available" | "unavailable" | "unknown";

export interface ServerRow {
  /** Stable React key. Never shown. */
  key: string;
  /** Human name as the upstream sent it, or null when it sent none. */
  name: string | null;
  status: ServerStatus;
  /** Human sentence for why it is down; null when the upstream said nothing. */
  reason: string | null;
  /** Raw check instant (wire form); rendered through `beijingMinute` only. */
  checkedAt: string | null;
  /** Upstream id/handle — `title` and 「技术详情」 only. */
  rawId: string | null;
  /** Upstream status token — 「技术详情」 only. */
  rawStatus: string | null;
  /** The wire-shaped reason the human layer folded away — 「技术详情」 only. */
  rawReason: string | null;
}

export type ServersRead =
  | {
      kind: "rows";
      rows: ServerRow[];
      /** Total the answer declared, if it declared one. null renders 「—」. */
      declaredTotal: number | null;
      nextCursor: string | null;
      /** Rows the answer carried but that could not be read at all. */
      unreadable: number;
    }
  | { kind: "shape" };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function pick(rec: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const found = text(rec[key]);
    if (found !== null) return found;
  }
  return null;
}

function count(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  const raw = text(value);
  if (!raw || !/^\d+$/.test(raw)) return null;
  return Number.parseInt(raw, 10);
}

const NAME_KEYS = ["displayName", "display_name", "name", "title", "label", "serverName", "server_name"] as const;
const ID_KEYS = ["id", "serverId", "server_id", "slug", "key", "name", "url", "endpoint"] as const;
const STATUS_KEYS = ["status", "state", "connectionStatus", "connection_status", "health"] as const;
const REASON_KEYS = [
  "reason",
  "message",
  "detail",
  "error",
  "lastError",
  "last_error",
  "errorMessage",
  "error_message",
  "statusMessage",
] as const;
const CHECKED_KEYS = [
  "lastCheckedAt",
  "last_checked_at",
  "checkedAt",
  "checked_at",
  "lastSeen",
  "last_seen",
  "updatedAt",
  "updated_at",
  "connectedAt",
  "connected_at",
] as const;

/** The upstream spells liveness five different ways; anything else is unknown. */
function statusOf(value: string | null): { status: ServerStatus; token: string | null } {
  const token = value?.toLowerCase().replace(/[\s-]+/g, "_") ?? null;
  if (!token) return { status: "unknown", token: null };
  if (["available", "connected", "online", "ok", "healthy", "up", "active", "ready"].includes(token)) {
    return { status: "available", token: value };
  }
  if (["unavailable", "disconnected", "offline", "down", "error", "failed", "unhealthy", "degraded"].includes(token)) {
    return { status: "unavailable", token: value };
  }
  return { status: "unknown", token: value };
}

/**
 * A reason sentence a person can act on. The upstream's own words win when it
 * has them; a machine handle or an HTTP-looking string is folded away instead,
 * because putting it on the screen would be engineering language in the human
 * layer. When it said nothing, the caller renders 「—」 with the reason.
 */
function reasonOf(rec: Record<string, unknown>): string | null {
  const raw = pick(rec, REASON_KEYS);
  if (raw === null) return null;
  if (/^[{[]/.test(raw)) return null;
  if (/^\d{3}$/.test(raw)) return null;
  if (/^[a-z][a-z0-9_.-]{4,}$/i.test(raw) && !/[。，、；\s]/.test(raw)) return null;
  return raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
}

/** Raw reason, kept for 「技术详情」 when the human layer had to fold it away. */
function rawReasonOf(rec: Record<string, unknown>): string | null {
  return pick(rec, REASON_KEYS);
}

function rowOf(value: unknown, index: number): ServerRow | null {
  const rec = record(value);
  if (!rec) return null;
  const name = pick(rec, NAME_KEYS);
  const rawId = pick(rec, ID_KEYS);
  // A row that is neither named nor identified is not a row; it is counted.
  if (!name && !rawId) return null;
  const { status } = statusOf(pick(rec, STATUS_KEYS));
  const checked = pick(rec, CHECKED_KEYS);
  return {
    key: rawId ?? `row-${index}`,
    name,
    status,
    reason: status === "available" ? null : reasonOf(rec),
    checkedAt: checked,
    rawId,
    rawStatus: pick(rec, STATUS_KEYS),
    rawReason: status === "available" ? null : rawReasonOf(rec),
  };
}

/** The array of servers, wherever the answer chose to hang it. */
function rowsOf(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  const outer = record(payload);
  if (!outer) return null;
  for (const key of ["servers", "items", "data", "result", "mcpServers", "mcp_servers", "list"]) {
    const value = outer[key];
    if (Array.isArray(value)) return value;
    const nested = record(value);
    if (nested) {
      for (const inner of ["servers", "items", "list"]) {
        if (Array.isArray(nested[inner])) return nested[inner] as unknown[];
      }
    }
  }
  return null;
}

/**
 * The one read of the server list. `shape` means the answer was not a list of
 * servers at all: that is a failure the page reports, never an empty ledger and
 * never a row assembled from what seemed likely.
 */
export function readServers(payload: unknown): ServersRead {
  const list = rowsOf(payload);
  if (list === null) return { kind: "shape" };
  const rows: ServerRow[] = [];
  let unreadable = 0;
  list.forEach((value, index) => {
    const row = rowOf(value, index);
    if (row) rows.push(row);
    else unreadable += 1;
  });
  const outer = record(payload);
  const declared = outer ? count(outer["total"] ?? outer["totalCount"] ?? outer["total_count"] ?? outer["count"]) : null;
  const cursor = outer ? pick(outer, ["nextCursor", "next_cursor", "cursor"]) : null;
  return { kind: "rows", rows, declaredTotal: declared, nextCursor: cursor, unreadable };
}

/** The route, exactly as the task names it, `/api/` segment included. */
export function serversUrl(limit = PAGE_LIMIT): string {
  return `${SERVERS_PATH}?limit=${encodeURIComponent(String(limit))}`;
}

export async function fetchServers(): Promise<ServersRead> {
  return readServers(await fetchJSON<unknown>(serversUrl()));
}

/**
 * Beijing wall clock to the minute. `null` means the value was not an instant
 * at all, and the caller writes 「—」 plus that reason rather than a time.
 */
export function beijingMinute(value: string | null): string | null {
  if (!value) return null;
  const raw = value.trim();
  let date: Date | null = null;
  if (/^\d{9,10}$/.test(raw)) date = new Date(Number(raw) * 1000);
  else if (/^\d{11,13}$/.test(raw)) date = new Date(Number(raw));
  else if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/.test(raw)) date = new Date(raw);
  if (!date || Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(/\//g, "-");
}

/* ------------------------------------------------------------------ *
 * Failures — the four states the page owes a person
 * ------------------------------------------------------------------ */

export interface FailureInfo {
  status: number;
  requestId: string | null;
  /** Raw multi-line detail for 「技术详情」 and `title` only. */
  technical: string | null;
}

export function failureInfo(err: unknown): FailureInfo {
  if (err instanceof ApiError) return { status: err.status, requestId: err.requestId ?? null, technical: err.details };
  return { status: -1, requestId: null, technical: err instanceof Error ? err.message : String(err) };
}

/** 403 and 404 are the same body: neither is reachable for the person reading. */
export function isDenied(status: number): boolean {
  return status === 403 || status === 404;
}

export interface FailureCopy {
  /** What the panel says. Never a status code, a route or a field name. */
  sentence: string;
  requestId: string | null;
  technical: string | null;
}

/** Human wording per status; anything unnameable falls back to the service's own sentence. */
export function readFailure(err: unknown, info: FailureInfo): FailureCopy {
  const { status } = info;
  let sentence: string;
  if (status === 0 || status === -1) sentence = "连不上工具与 MCP 的服务，请确认它已经启动，然后重试。";
  else if (status === 400) sentence = "这次读取的筛选条件服务端没有接受，没能返回连接列表。请重试一次。";
  else if (status === 401) sentence = "登录状态已经失效，请刷新页面重新登录后再看这份连接清单。";
  else if (status === 429) sentence = "请求太频繁了，请稍等一会儿再试。";
  else if (status >= 500) sentence = "工具与 MCP 的服务在处理时出了错，请稍后重试。";
  else sentence = errorMessage(err) ?? "读取工具与 MCP 连接时出了问题，请稍后重试。";
  return { sentence, requestId: info.requestId, technical: info.technical };
}

/** The answer arrived but is not a list of servers: a failure, not an empty list. */
export function shapeFailure(): FailureCopy {
  return {
    sentence: "服务回的内容不是一份连接清单，这里没能读出任何 MCP 连接。",
    requestId: null,
    technical: "unexpected payload shape",
  };
}

/** The request-id line, shared so the wording never drifts between panels. */
export const requestIdLine = (id: string | null): string =>
  id ? `请求编号：${id}` : "本次请求未记录编号，可复制时间与操作路径反馈";

/** The status word on the badge. Unknown is 「—」, never a made-up state. */
export const STATUS_LABEL: Record<ServerStatus, string> = {
  available: "正常",
  unavailable: "不可用",
  unknown: "—",
};
