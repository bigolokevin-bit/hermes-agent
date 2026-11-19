/**
 * 平台接入 / 数据源 data layer — T29 + T24 (lane console-aud).
 *
 * Same-origin BFF only, and the `/api/` segment is part of every route: the
 * shell's proxy forwards `/agent-api/api/…` and nothing else, so dropping the
 * segment would address a static file instead of the BFF.
 *
 * THE ROUTES WERE DISCOVERED, NOT INVENTED. Probed on 2026-11-19 against the
 * console BFF on 127.0.0.1:8092 and cross-checked against two route tables in
 * this repo:
 *
 *   route                                    where it comes from
 *   ---------------------------------------  ---------------------------------
 *   /api/channels                            named by the task; NOT in any route
 *                                            table of this repo or of
 *                                            `apps/console/server.py`
 *   /api/messaging/platforms                 REAL upstream route
 *                                            (`hermes_cli/web_routers/messaging.py:987`,
 *                                            read by `web/src/lib/api.ts:971` and
 *                                            `web/src/pages/ChannelsPage.tsx`);
 *                                            NOT registered by the console BFF
 *   /api/connectors                          named by the task; no such route
 *                                            anywhere in this repo
 *   /api/gateway-connections                 REAL upstream route
 *                                            (`hermes_cli/web_routers/gateway_connections.py:41`);
 *                                            NOT registered by the console BFF
 *   /api/mcp/servers                         REAL upstream route
 *                                            (`hermes_cli/web_routers/mcp.py:94`);
 *                                            NOT registered by the console BFF
 *                                            (that gap is GAP-04, owned by T27)
 *   /api/datasources                         named by the task; no such route in
 *                                            this repo, and the shell's own tab
 *                                            table says 数据源「尚无读取接口」
 *                                            (`web/src/shell/routes.ts:159`)
 *
 * So: the console BFF registers none of them (its `PROXY_ROUTES` table holds
 * employees/approvals/audit/tasks/runs/skills/sessions/… and nothing channel-,
 * connector- or data-source-shaped). A route that is not registered answers 404
 * and the screen says 「未接入」 — it does not answer with a demo row, a demo
 * count, or a green badge. Candidate paths are tried in order per source and
 * the first answer that really is a list wins; the upstream-proven spelling is
 * tried first because it is the one a mounted proxy can actually reach, and the
 * task's own spelling is tried after it as the contract name.
 *
 * Field reading is defensive because the BFF forwards upstream shapes
 * verbatim and this repo holds no sample of an answer: an absent value stays
 * absent and renders 「—」 plus the reason — never `0`, never an empty string,
 * never a guessed name. `available` is reached only from a state token that
 * says the thing is actually connected; `enabled: true` is never read as
 * connected, because a switched-on but broken platform is not working. Raw
 * ids, upstream state tokens and field names live in `title` attributes and
 * the collapsed 「技术详情」, never in the sentence layer.
 */
import { ApiError, errorMessage } from "@/lib/api-error";
import { fetchJSON } from "@/lib/api";

/**
 * The gap this page belongs to. New number: `docs/_artifacts/**` and
 * `web/src/**` carry GAP-01…GAP-07 (GAP-04 = MCP 路由未注册, GAP-07 = 用量成本)
 * and the legacy `GAP-1` label in the evidence module is a different, older
 * spelling. Checked before claiming this id.
 */
export const GAP = "GAP-08";

/** Page size asked for; the denominator on screen is stated against it. */
export const PAGE_LIMIT = 50;

/**
 * 状态 on the screen. `available` is the only state that may look green, and it
 * is only reached from an upstream token that says the thing is connected.
 */
export type RowStatus = "available" | "unavailable" | "unknown";

/** Which section a source feeds. */
export type SourceRole = "channels" | "datasources";

export interface SourceSpec {
  /** Stable internal id. Never shown. */
  id: string;
  /** Plain-Chinese name of the data source, as it reads in the 数据源 ledger. */
  label: string;
  /** Plain-Chinese kind printed on rows that came from this source. */
  kindLabel: string;
  role: SourceRole;
  /** Routes tried in order. Each is repo-discovered or task-named — none invented. */
  paths: readonly string[];
  /** The reason this source reads 「未接入」 when no route answers it. */
  missingReason: string;
  /** Which gap number explains the missing endpoint, when one already exists. */
  gap: string;
}

/**
 * The four sources this page knows about, all of them evidenced above.
 * `mcp` is listed as a data source only: the MCP list itself is T27's pane, and
 * repeating its rows here would be a second copy of the same surface.
 */
export const SOURCES: readonly SourceSpec[] = [
  {
    id: "platforms",
    label: "平台与渠道接入",
    kindLabel: "消息平台",
    role: "channels",
    paths: ["/agent-api/api/messaging/platforms", "/agent-api/api/channels"],
    missingReason: "本控制台还没有接通这份平台清单的读取",
    gap: GAP,
  },
  {
    id: "connectors",
    label: "外部连接器",
    kindLabel: "连接器",
    role: "channels",
    paths: ["/agent-api/api/gateway-connections", "/agent-api/api/connectors"],
    missingReason: "本控制台还没有接通连接器清单的读取",
    gap: GAP,
  },
  {
    id: "datasources",
    label: "数据源目录",
    kindLabel: "数据源",
    role: "datasources",
    paths: ["/agent-api/api/datasources"],
    // This repo's own tab table already says 数据源「尚无读取接口」
    // (`web/src/shell/routes.ts:159`), which is what lets this row be a fact
    // rather than a guess.
    missingReason: "这个数据源还没有接通：上下游都还没有提供读取它的入口",
    gap: GAP,
  },
  {
    id: "mcp",
    label: "MCP 工具连接",
    kindLabel: "MCP 连接",
    role: "datasources",
    paths: ["/agent-api/api/mcp/servers"],
    missingReason: "上游有这份清单，本控制台还没有把它接通（与工具与 MCP 页是同一条缺口）",
    gap: "GAP-04",
  },
];

export const CHANNEL_SOURCES = SOURCES.filter((source) => source.role === "channels");
export const LEDGER_SOURCES = SOURCES.filter((source) => source.role === "datasources");

/* ------------------------------------------------------------------ *
 * Defensive reading
 * ------------------------------------------------------------------ */

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

function flag(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
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

const NAME_KEYS = ["displayName", "display_name", "name", "title", "label", "platformName"] as const;
const ID_KEYS = ["id", "platform", "platformId", "platform_id", "slug", "key", "connectionId", "serverName", "url"] as const;
const STATE_KEYS = ["state", "status", "connectionStatus", "connection_status", "health"] as const;
const TYPE_KEYS = ["type", "kind", "category", "transport"] as const;
const REASON_KEYS = [
  "error_message",
  "errorMessage",
  "error",
  "reason",
  "message",
  "detail",
  "lastError",
  "last_error",
] as const;
const SEEN_KEYS = [
  "last_seen",
  "lastSeen",
  "updated_at",
  "updatedAt",
  "checkedAt",
  "last_checked_at",
  "connectedAt",
  "connected_at",
] as const;

/**
 * Tokens that say the platform is actually talking. `connected` is the token
 * the upstream platform catalog documents; the rest are the general spellings
 * other sources use. Anything not listed is unknown, never a favourable guess.
 */
const CONNECTED_TOKENS = ["connected", "available", "online", "ok", "healthy", "active", "ready", "up"] as const;

/**
 * Tokens that say it is not talking, each with the plain-Chinese reason the
 * screen shows. This is a translation of a documented vocabulary
 * (`web/src/lib/api-messaging.ts:26-30`), not an invention: the raw token stays
 * in 「技术详情」.
 */
const DOWN_TOKENS: Record<string, string> = {
  disabled: "这个平台的开关是关着的",
  not_configured: "还缺必要的配置，平台没有真正接上",
  pending_restart: "改动还没生效，要等网关重启",
  gateway_stopped: "网关没有在运行",
  startup_failed: "启动时失败了",
  fatal: "启动遇到无法继续的错误",
  disconnected: "连接已经断开",
  unavailable: "当前不可用",
  offline: "现在是离线状态",
  down: "现在是停止状态",
  error: "读取到这个平台的错误状态",
  failed: "上一次尝试失败了",
  unhealthy: "健康检查没有通过",
  degraded: "只能部分工作",
};

/** Fold a state token; unknown tokens stay unknown instead of becoming green. */
export function statusOf(
  token: string | null,
): { status: RowStatus; reason: string | null } {
  if (token === null) return { status: "unknown", reason: null };
  const normalized = token.toLowerCase().replace(/[\s-]+/g, "_");
  if ((CONNECTED_TOKENS as readonly string[]).includes(normalized)) {
    return { status: "available", reason: null };
  }
  const down = DOWN_TOKENS[normalized];
  if (down) return { status: "unavailable", reason: down };
  return { status: "unknown", reason: null };
}

/**
 * A reason a person can act on. The upstream's own sentence wins when it has
 * one; a machine handle, a JSON blob or an HTTP-looking string is folded away
 * rather than printed, because that would be engineering language in the human
 * layer. It stays reachable in 「技术详情」.
 */
function reasonOf(rec: Record<string, unknown>): string | null {
  const raw = pick(rec, REASON_KEYS);
  if (raw === null) return null;
  if (/^[{[]/.test(raw)) return null;
  if (/^\d{3}$/.test(raw)) return null;
  if (/^[a-z][a-z0-9_.-]{4,}$/i.test(raw) && !/[。，、；\s]/.test(raw)) return null;
  return raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
}

/** The last four characters, for the only id form the screen is allowed to show. */
export function maskId(id: string | null): string | null {
  if (!id) return null;
  const tail = id.replace(/\s+/g, "").slice(-4);
  return tail ? `连接 · 后4位 ${tail}` : null;
}

export interface ChannelRow {
  /** Stable React key. Never shown. */
  key: string;
  /** Human name, or null when the answer sent none. */
  name: string | null;
  /** What to show when there is no name: the masked handle, or nothing. */
  masked: string | null;
  /** Plain-Chinese kind. From the source that answered, never guessed per row. */
  kindLabel: string;
  status: RowStatus;
  /** Plain sentence for why it is down or unexplained. */
  reason: string | null;
  /** Raw instant (wire form); rendered through `beijingMinute` only. */
  lastSeen: string | null;
  /** Which source produced this row. */
  sourceId: string;
  /** Raw id/handle — `title` and 「技术详情」 only. */
  rawId: string | null;
  /** Raw state token — 「技术详情」 only. */
  rawState: string | null;
  /** Raw reason folded away from the human layer — 「技术详情」 only. */
  rawReason: string | null;
  /** Raw 「技术详情」 lines for the type the answer named. */
  rawType: string | null;
}

function rowOf(value: unknown, source: SourceSpec, index: number): ChannelRow | null {
  const rec = record(value);
  if (!rec) return null;

  const name = pick(rec, NAME_KEYS);
  const rawId = pick(rec, ID_KEYS);
  // Neither named nor identified: not a row, counted as unreadable instead.
  if (!name && !rawId) return null;

  const token = pick(rec, STATE_KEYS);
  const { status, reason: tokenReason } = statusOf(token);

  // A switched-on platform is not a working one. `enabled`/`configured` are
  // never read as connected; their only use here is to explain an unrecognised
  // state a little better, and even then the row stays 「未知」 rather than
  // becoming a fake green.
  const enabled = flag(rec["enabled"]);
  const configured = flag(rec["configured"]);

  // The upstream's own sentence about what went wrong beats the translation of
  // its state token — 「凭据已过期」 tells a person more than 「开关是关着的」 does,
  // and both are human language. The raw token stays reachable in 「技术详情」.
  const reason =
    status === "available"
      ? null
      : (reasonOf(rec) ?? tokenReason ?? unknownWhy(status, enabled, configured, token));

  const typeToken = pick(rec, TYPE_KEYS);

  return {
    key: rawId ? `${source.id}:${rawId}` : `${source.id}:row-${index}`,
    name,
    masked: name ? null : maskId(rawId),
    // The kind comes from the answer when it named one, and from the source
    // that answered when it did not — never from a guess about the row.
    kindLabel: typeToken ? plainType(typeToken) : source.kindLabel,
    status,
    reason,
    lastSeen: pick(rec, SEEN_KEYS),
    sourceId: source.id,
    rawId,
    rawState: token,
    rawReason: status === "available" ? null : pick(rec, REASON_KEYS),
    rawType: typeToken,
  };
}

/**
 * Why a row reads 「未知」 or 「未接入」 when the answer gave no explanation.
 * Sentences about what the answer did not say — never a invented cause.
 */
function unknownWhy(
  status: RowStatus,
  enabled: boolean | null,
  configured: boolean | null,
  token: string | null,
): string | null {
  if (status === "available") return null;
  if (token !== null) return null; // `statusOf` already explained a known token
  if (configured === false) return "服务说这个平台还缺配置，但没有说明现在的连接状态";
  if (enabled === false) return "服务说这个平台的开关是关着的，但没有说明现在的连接状态";
  return null;
}

/** The few type words the upstream uses, in plain Chinese; anything else reads 「未说明」. */
const TYPE_LABELS: Record<string, string> = {
  messaging: "消息平台",
  platform: "消息平台",
  channel: "消息平台",
  connector: "连接器",
  mcp: "MCP 连接",
  datasource: "数据源",
  data_source: "数据源",
  database: "数据库",
  http: "网络服务",
  webhook: "回调地址",
  local: "本机服务",
};

function plainType(token: string): string {
  const normalized = token.toLowerCase().replace(/[\s-]+/g, "_");
  return TYPE_LABELS[normalized] ?? "类型未说明";
}

/** The list of entries, wherever the answer chose to hang it. */
function listIn(payload: unknown, keys: readonly string[]): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  const outer = record(payload);
  if (!outer) return null;
  for (const key of keys) {
    const value = outer[key];
    if (Array.isArray(value)) return value;
    const nested = record(value);
    if (nested) {
      for (const inner of keys) {
        if (Array.isArray(nested[inner])) return nested[inner] as unknown[];
      }
    }
  }
  return null;
}

const PLATFORM_KEYS = ["platforms", "channels", "connections", "servers", "items", "data", "list", "result", "sources"] as const;

/**
 * One source's answer, read. `shape` means the answer was not a list at all:
 * that is a failure this page reports, never an empty ledger and never a row
 * assembled from what seemed likely.
 */
export type SourceRead =
  | {
      kind: "rows";
      rows: ChannelRow[];
      /** Total the answer declared, if it declared one. null renders 「—」. */
      declaredTotal: number | null;
      /** Entries the answer carried that could not be read at all. */
      unreadable: number;
      /** The route that actually answered. */
      path: string;
    }
  | { kind: "empty"; path: string }
  | { kind: "shape" }
  | { kind: "failed"; failure: FailureCopy; denied: boolean };

export function readSource(payload: unknown, source: SourceSpec, path: string): SourceRead {
  const list = listIn(payload, PLATFORM_KEYS);
  if (list === null) return { kind: "shape" };
  const rows: ChannelRow[] = [];
  let unreadable = 0;
  list.forEach((value, index) => {
    const row = rowOf(value, source, index);
    if (row) rows.push(row);
    else unreadable += 1;
  });
  if (!rows.length && !unreadable) return { kind: "empty", path };
  const outer = record(payload);
  const declared = outer
    ? count(outer["total"] ?? outer["totalCount"] ?? outer["total_count"] ?? outer["count"])
    : null;
  return { kind: "rows", rows, declaredTotal: declared, unreadable, path };
}

/* ------------------------------------------------------------------ *
 * The request
 * ------------------------------------------------------------------ */

/** The three states the screen can ask for; `all` asks for everything. */
export type StatusFilter = "all" | "available" | "unavailable";

export const FILTERS: readonly { key: StatusFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "available", label: "已接入" },
  { key: "unavailable", label: "未接入与未知" },
];

export function filterOf(raw: string | null): StatusFilter {
  return raw === "available" || raw === "unavailable" ? raw : "all";
}

/**
 * The route for one source, with the page's own parameters. `limit` is always
 * sent so the denominator on screen matches what was asked for, and `status` is
 * sent only when a filter is chosen — so 「全部」 asks the plain route and every
 * other choice asks a demonstrably different URL (asserted in `channels.test.ts`).
 * Whether the service honours `status` is recorded as unverified
 * (`docs/_artifacts/aud/DONE.md`); the page narrows the rows it got by the same
 * condition, so what is on screen always matches what was picked.
 */
export function sourceUrl(path: string, filter: StatusFilter, limit = PAGE_LIMIT): string {
  const url = `${path}?limit=${encodeURIComponent(String(limit))}`;
  return filter === "all" ? url : `${url}&status=${encodeURIComponent(filter)}`;
}

/** Rows the filter asks for; applied to what actually arrived. */
export function applyFilter(rows: ChannelRow[], filter: StatusFilter): ChannelRow[] {
  if (filter === "all") return rows;
  if (filter === "available") return rows.filter((row) => row.status === "available");
  return rows.filter((row) => row.status !== "available");
}

async function probe(source: SourceSpec, filter: StatusFilter): Promise<SourceRead> {
  let lastShape = false;
  let lastFailure: SourceRead | null = null;
  for (const path of source.paths) {
    try {
      const read = readSource(await fetchJSON<unknown>(sourceUrl(path, filter)), source, path);
      if (read.kind === "rows" || read.kind === "empty") return read;
      // The route answered but did not send a list. Keep trying the source's
      // other candidate name; if none of them produced a list, the wrong shape
      // outranks the other name's 404, because a route that answered in an
      // unexpected shape is a different problem from a route that is missing.
      lastShape = true;
    } catch (err) {
      const info = failureInfo(err);
      lastFailure = { kind: "failed", failure: readFailure(err, info), denied: isDenied(info.status) };
    }
  }
  if (lastShape) return { kind: "shape" };
  if (lastFailure) return lastFailure;
  return { kind: "shape" };
}

/** Read every source. Each source tries its own candidates in order. */
export function readAll(filter: StatusFilter): Promise<Record<string, SourceRead>> {
  return Promise.all(SOURCES.map(async (source) => [source.id, await probe(source, filter)] as const)).then(
    (entries) => Object.fromEntries(entries) as Record<string, SourceRead>,
  );
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
  if (err instanceof ApiError) {
    return { status: err.status, requestId: err.requestId ?? null, technical: err.details };
  }
  return { status: -1, requestId: null, technical: err instanceof Error ? err.message : String(err) };
}

/** 403 and 404 are one state: neither says anything a person can act on differently. */
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
  if (status === 0 || status === -1) sentence = "连不上提供平台接入与数据源的服务，请确认它已经启动，然后重试。";
  else if (status === 400) sentence = "这次读取的筛选条件服务端没有接受，没能返回清单。请重试一次。";
  else if (status === 401) sentence = "登录状态已经失效，请刷新页面重新登录后再看这份接入清单。";
  else if (status === 429) sentence = "请求太频繁了，请稍等一会儿再试。";
  else if (status >= 500) sentence = "提供平台接入与数据源的服务在处理时出了错，请稍后重试。";
  else sentence = errorMessage(err) ?? "读取平台接入与数据源时出了问题，请稍后重试。";
  return { sentence, requestId: info.requestId, technical: info.technical };
}

/** The answer arrived but is not a list: a failure, not an empty list. */
export function shapeFailure(): FailureCopy {
  return {
    sentence: "服务回的内容不是一份接入清单，这里没能读出任何平台或数据源。",
    requestId: null,
    technical: "unexpected payload shape",
  };
}

/** The request-id line, shared so the wording never drifts between panels. */
export const requestIdLine = (id: string | null): string =>
  id ? `请求编号：${id}` : "本次请求未记录编号，可复制时间与操作路径反馈";

/** The status word on the badge. Unknown is 「未知」, never a favourable word. */
export const STATUS_LABEL: Record<RowStatus, string> = {
  available: "已接入",
  unavailable: "未接入",
  unknown: "未知",
};

/* ------------------------------------------------------------------ *
 * Time
 * ------------------------------------------------------------------ */

/**
 * Beijing wall clock to the minute. `null` means the value was not an instant
 * at all, and the caller writes 「—」 plus that reason rather than a time.
 */
export function beijingMinute(value: string | number | Date | null): { text: string | null; reason: string } {
  if (value === null) return { text: null, reason: "服务未提供最近可见时间" };
  if (value instanceof Date) {
    return { text: Number.isNaN(value.getTime()) ? null : format(value), reason: "这个时间读不出时刻" };
  }
  const raw = String(value).trim();
  if (!raw) return { text: null, reason: "服务未提供最近可见时间" };
  let date: Date | null = null;
  if (/^\d{9,10}$/.test(raw)) date = new Date(Number(raw) * 1000);
  else if (/^\d{11,13}$/.test(raw)) date = new Date(Number(raw));
  else if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/.test(raw)) date = new Date(raw);
  if (!date) return { text: null, reason: "服务给的不是一个能读出的时间" };
  if (Number.isNaN(date.getTime())) return { text: null, reason: "服务给的时间读不出时刻" };
  return { text: format(date), reason: "服务给的时间读不出时刻" };
}

function format(date: Date): string {
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
 * The 数据源 ledger (T24)
 * ------------------------------------------------------------------ */

export interface LedgerRow {
  key: string;
  /** Plain-Chinese name of the data source. */
  label: string;
  status: RowStatus;
  /** Plain sentence: what was tried, and what it said. */
  reason: string;
  /** Set only where the endpoint is genuinely missing. */
  gap: string | null;
  /** This page's own verification instant, never an upstream timestamp. */
  checkedAt: Date | null;
  /** The route that answered, or the last one tried — 「技术详情」 only. */
  rawPath: string | null;
  /** Raw state/failure wording folded away from the human layer. */
  rawDetail: string | null;
}

/**
 * One row per data source, saying what THIS read cycle observed.
 *
 * `available` requires entries to have actually arrived; a route that answers
 * with an empty list is not called 已接入 (it is 「未知」, with that said plainly),
 * and a missing route is 未接入 carrying its GAP number. Nothing here can be
 * green without an answer behind it.
 */
export function ledgerRows(reads: Record<string, SourceRead>, checkedAt: Date | null): LedgerRow[] {
  return SOURCES.map((source) => {
    const read = reads[source.id];
    const base = { key: source.id, label: source.label, checkedAt };

    if (!read) {
      return {
        ...base,
        status: "unknown" as RowStatus,
        reason: "这一轮没有读到它的结果",
        gap: source.gap,
        rawPath: source.paths[source.paths.length - 1] ?? null,
        rawDetail: null,
      };
    }
    if (read.kind === "rows") {
      return {
        ...base,
        status: "available" as RowStatus,
        reason: `这一次读到 ${read.rows.length} 条`,
        gap: null,
        rawPath: read.path,
        rawDetail: read.declaredTotal === null ? null : `服务声明共 ${read.declaredTotal} 条`,
      };
    }
    if (read.kind === "empty") {
      return {
        ...base,
        status: "unknown" as RowStatus,
        reason: "这条读取路由有回答，只是这次清单里一条也没有，所以这里不写成已接入",
        gap: null,
        rawPath: read.path,
        rawDetail: null,
      };
    }
    if (read.kind === "shape") {
      return {
        ...base,
        status: "unavailable" as RowStatus,
        reason: `${source.missingReason}（回的内容不是一份清单）`,
        gap: source.gap,
        rawPath: source.paths[source.paths.length - 1] ?? null,
        rawDetail: "unexpected payload shape",
      };
    }
    if (read.denied) {
      return {
        ...base,
        status: "unavailable" as RowStatus,
        reason: source.missingReason,
        gap: source.gap,
        rawPath: source.paths[source.paths.length - 1] ?? null,
        rawDetail: read.failure.technical,
      };
    }
    return {
      ...base,
      status: "unknown" as RowStatus,
      reason: read.failure.sentence,
      gap: null,
      rawPath: source.paths[source.paths.length - 1] ?? null,
      rawDetail: read.failure.technical,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Phase
 * ------------------------------------------------------------------ */

export type Phase = "loading" | "ready" | "empty" | "error" | "denied";

export interface ChannelsReadResult {
  phase: Phase;
  /** The rows the platform/connector sources actually sent. */
  rows: ChannelRow[];
  /** Per-source totals the answer declared, for the count line. */
  declaredTotals: { sourceId: string; label: string; declared: number | null }[];
  /** Entries carried but unreadable, counted rather than painted. */
  unreadable: number;
  ledger: LedgerRow[];
  failure: FailureCopy | null;
}

const NO_ROWS: ChannelsReadResult = {
  phase: "loading",
  rows: [],
  declaredTotals: [],
  unreadable: 0,
  ledger: [],
  failure: null,
};

export const PENDING_RESULT: ChannelsReadResult = NO_ROWS;

/**
 * The page's state comes from the CHANNEL sources, because they are what the
 * list on this page claims to show. A data-source route that answered while the
 * platform routes stayed missing does not turn a refused pane into a ready one:
 * the ledger rows for it are still computed, they are just not painted above a
 * denied body, which is the state the person has to see first.
 *
 * rows > empty > denied > error, and the failure keeps its own request id.
 */
export function settle(reads: Record<string, SourceRead>, checkedAt: Date | null): ChannelsReadResult {
  const ledger = ledgerRows(reads, checkedAt);
  const channelReads = CHANNEL_SOURCES.map((source) => reads[source.id]).filter((read): read is SourceRead => Boolean(read));
  const withRows = channelReads.filter((read) => read.kind === "rows");

  if (withRows.length) {
    const rows = withRows.flatMap((read) => (read.kind === "rows" ? read.rows : []));
    return {
      phase: "ready",
      rows,
      declaredTotals: CHANNEL_SOURCES.map((source) => {
        const read = reads[source.id];
        return {
          sourceId: source.id,
          label: source.label,
          declared: read && read.kind === "rows" ? read.declaredTotal : null,
        };
      }),
      unreadable: withRows.reduce((sum, read) => sum + (read.kind === "rows" ? read.unreadable : 0), 0),
      ledger,
      failure: null,
    };
  }

  // A channel source that answered with an empty list proved its route exists,
  // so that reads ahead of another candidate name's 404: the honest state is
  // 「empty」, not 「not wired」.
  const empties = channelReads.filter((read) => read.kind === "empty");
  if (empties.length) {
    return { ...NO_ROWS, phase: "empty", ledger };
  }

  // An answer in the wrong shape is the loudest truth here: a route answered
  // and what it said made no sense as a list. That outranks another candidate
  // name's 404, because 「the service said something unreadable」 must never be
  // presented as the calmer 「this is simply not wired」.
  const shapes = channelReads.filter((read) => read.kind === "shape");
  if (shapes.length) {
    return { ...NO_ROWS, phase: "error", ledger, failure: shapeFailure() };
  }

  // Nothing arrived. 403/404 is one answer; anything else — a 5xx, a timeout —
  // is a failure with a sentence and a request id a person can quote.
  const failures = channelReads.filter((read) => read.kind === "failed");
  if (failures.length && failures.every((read) => read.kind === "failed" && read.denied)) {
    const first = failures[0];
    return {
      ...NO_ROWS,
      phase: "denied",
      ledger,
      failure: first && first.kind === "failed" ? first.failure : null,
    };
  }
  if (failures.length) {
    const first = failures[0];
    return {
      ...NO_ROWS,
      phase: "error",
      ledger,
      failure: first && first.kind === "failed" ? first.failure : null,
    };
  }
  return { ...NO_ROWS, phase: "error", ledger, failure: shapeFailure() };
}
