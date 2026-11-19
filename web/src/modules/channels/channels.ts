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
 *
 * THE LEDGER'S THREE WORDS (T24). A data-source row says 已接入 only where
 * entries actually arrived, 未接入 where the route is absent or refused, and
 * 待核实 for everything this page cannot verify — an empty answer, a 5xx, an
 * unreadable shape, a cycle that produced nothing. The ledger never prints
 * 「未知」: on a row that speaks for a whole source, an unverified state is an
 * instruction to go check, not a shrug. Every non-green row carries the gap
 * number that says which kind of gap it is (GAP-08 / GAP-11 / GAP-12, or MCP's
 * own GAP-04). 来源 names whose list the row speaks for, in human words.
 * 最近同步 is the newest instant the ANSWER carried, and 「—」 plus
 * `NO_SYNC_REASON` when it carried none — this page's own clock stays a separate
 * line (本次核验) and is never dressed up as a sync stamp.
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

/**
 * Two more numbers this page owes the 数据源 ledger, because 「未接入」 is the
 * wrong word for a route that DID answer. Numbered the way the other lanes
 * number theirs: grepped first — `web/src/**`, `docs/_artifacts/**` and
 * `apps/**` carry GAP-01…GAP-10 (GAP-09 = 运行列表, GAP-10 = 委托), so 11 and 12
 * were free on 2026-11-19.
 *
 *   GAP-11  路由有回答，但这一轮一条也没有 —— 接通与否无法判定 → 待核实
 *   GAP-12  服务回了错误，或回了读不出来的东西 —— 状态无法核实 → 待核实
 *
 * A ledger row that is not 已接入 always carries one of the three numbers
 * (GAP-08 / GAP-11 / GAP-12, or the source's own GAP-04 for MCP), never a bare
 * verdict. The meaning of each is written out in `docs/_artifacts/aud/DONE.md`.
 */
export const GAP_NO_ENTRIES = "GAP-11";
export const GAP_UNVERIFIABLE = "GAP-12";

/** Page size asked for; the denominator on screen is stated against it. */
export const PAGE_LIMIT = 50;

/**
 * 状态 on the screen. `available` is the only state that may look green, and it
 * is only reached from an upstream token that says the thing is connected.
 * `disabled` is its own word, not a flavour of 「未接入」: a platform somebody
 * switched off on purpose reads 「未启用」, so the person looking at the list
 * learns to turn it on rather than to wire it up.
 */
export type RowStatus = "available" | "disabled" | "unavailable" | "unknown";

/** Which section a source feeds. */
export type SourceRole = "channels" | "datasources";

export interface SourceSpec {
  /** Stable internal id. Never shown. */
  id: string;
  /** Plain-Chinese name of the data source, as it reads in the 数据源 ledger. */
  label: string;
  /** Plain-Chinese kind printed on rows that came from this source. */
  kindLabel: string;
  /**
   * 来源 in human words: whose list this row speaks for, in the terms a person
   * already uses for it. No route, no service name, no field name — those stay
   * in 「技术详情」. This is what the ledger shows as 来源, and it is a property of
   * the source, never a guess about an individual row.
   */
  originLabel: string;
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
    // The gateway's own runtime summary is the only answer on this machine that
    // names platforms (`gateway.platforms`). The messaging/channel routes below
    // were probed on 2026-11-19 and each one answered 404 console.unknown_route,
    // so they stay as fallbacks only.
    originLabel: "网关自己报告的运行状态",
    role: "channels",
    paths: ["/agent-api/api/hermes-summary", "/agent-api/api/messaging/platforms", "/agent-api/api/channels"],
    missingReason: "这份网关状态在本控制台读不到，平台清单也就无从核实",
    gap: GAP,
  },
  {
    id: "connectors",
    label: "外部连接器",
    kindLabel: "连接器",
    originLabel: "上游的连接器清单",
    role: "channels",
    paths: ["/agent-api/api/gateway-connections", "/agent-api/api/connectors"],
    missingReason: "本控制台还没有接通连接器清单的读取",
    gap: GAP,
  },
  {
    id: "datasources",
    label: "数据源目录",
    kindLabel: "数据源",
    originLabel: "本控制台的数据源目录",
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
    originLabel: "上游的工具与 MCP 服务清单",
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
 * Tokens that say somebody switched this platform off on purpose. They get a
 * word of their own — 「未启用」 — because 「未接入」 would send a person off to
 * wire something that is only switched off. The sentence says what is true
 * (禁用, and that it must be enabled again before anything can be read here) and
 * never names an actor the token did not name: `disabled` on its own does not
 * prove an admin touched it, so only `disabled_by_admin` says 管理员.
 * Checked before DOWN_TOKENS, so a `disabled` answer can never fall through to
 * 「未知」.
 */
const DISABLED_TOKENS: Record<string, string> = {
  disabled: "已被禁用，需要先启用后再读取",
  disabled_by_admin: "已被管理员禁用，需要先启用后再读取",
  disabled_by_config: "配置里已经把它禁用，需要先启用后再读取",
  switched_off: "这个平台处于禁用状态，开关是关着的，需要先启用后再读取",
};

/**
 * Tokens that say it is not talking, each with the plain-Chinese reason the
 * screen shows. This is a translation of a documented vocabulary
 * (`web/src/lib/api-messaging.ts:26-30`), not an invention: the raw token stays
 * in 「技术详情」. `disabled` used to be here; it now folds to 「未启用」 above.
 */
const DOWN_TOKENS: Record<string, string> = {
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
  const disabled = DISABLED_TOKENS[normalized];
  if (disabled) return { status: "disabled", reason: disabled };
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
  /**
   * Set only for rows that came from the gateway summary: the platform word the
   * screen uses instead of 已接入/未接入 (已连接/未连接/未配置/待核实).
   */
  platformStatus?: RowStatus;
  /** Credential STATE only — never a value, never a fragment of one. */
  credential?: CredentialState;
  /** Why the credential reads the way it does, in plain words. */
  credentialReason?: string;
  /** The service itself flagged this platform as needing attention. */
  attention?: boolean;
  /** Why the instant shown belongs to the gateway rather than this platform. */
  lastSeenNote?: string | null;
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

/* ------------------------------------------------------------------ *
 * Platform rows from the gateway summary
 * ------------------------------------------------------------------ */

/**
 * `GET /agent-api/api/hermes-summary` is the only live answer that names
 * platforms: `gateway.platforms` carries one entry per platform the gateway
 * reports about itself. It is not a list of connections and it carries no
 * credential value, so this page reads it as "what the gateway says about each
 * platform" and nothing more.
 */
const PLATFORM_LABELS: Record<string, string> = {
  api_server: "API 服务",
  api: "API 服务",
  feishu: "飞书",
  lark: "飞书",
  wecom: "企业微信",
  wechat: "微信",
  dingtalk: "钉钉",
  slack: "Slack",
  telegram: "Telegram",
  discord: "Discord",
  whatsapp: "WhatsApp",
  webhook: "回调地址",
};

const PLATFORM_KINDS: Record<string, string> = {
  api_server: "接口服务",
  api: "接口服务",
  feishu: "消息平台",
  lark: "消息平台",
  wecom: "消息平台",
  wechat: "消息平台",
  dingtalk: "消息平台",
  slack: "消息平台",
  telegram: "消息平台",
  discord: "消息平台",
  whatsapp: "消息平台",
  webhook: "回调地址",
};

/** The three words the page promises, plus the honest fourth. */
export const PLATFORM_STATUS_LABEL: Record<RowStatus, string> = {
  available: "已连接",
  unavailable: "未连接",
  disabled: "未配置",
  unknown: "待核实",
};

export type CredentialState = "configured" | "missing" | "unknown";

export const CREDENTIAL_LABEL: Record<CredentialState, string> = {
  configured: "已配置",
  missing: "未配置",
  unknown: "未知",
};

const CREDENTIAL_KEYS = [
  "credentialStatus",
  "credential_status",
  "credentials",
  "credential",
  "auth",
  "authentication",
  "tokenStatus",
  "token_status",
] as const;

const CREDENTIAL_PRESENT = ["configured", "present", "set", "ok", "ready", "valid"] as const;
const CREDENTIAL_ABSENT = [
  "missing",
  "absent",
  "none",
  "empty",
  "not_configured",
  "unconfigured",
  "required",
  "invalid",
  "expired",
  "revoked",
] as const;

/**
 * Only the STATE of a credential leaves this function. A value that happens to
 * be a token is never carried into a row, a title or 「技术详情」 — the page shows
 * what the service says about it, never what it is.
 */
export function credentialOf(rec: Record<string, unknown> | null): { state: CredentialState; reason: string } {
  if (!rec) return { state: "unknown", reason: "服务的回答里没有这段平台信息，凭据状态也就无从核实" };
  const raw = pick(rec, CREDENTIAL_KEYS);
  if (raw === null) {
    return { state: "unknown", reason: "服务的回答里没有给出这份凭据的状态，本页不替它猜，也不显示任何令牌内容" };
  }
  const normalized = raw.toLowerCase().replace(/[\s-]+/g, "_");
  if ((CREDENTIAL_PRESENT as readonly string[]).includes(normalized)) {
    return { state: "configured", reason: "服务说这份凭据已经配置好" };
  }
  if ((CREDENTIAL_ABSENT as readonly string[]).includes(normalized)) {
    const broken = normalized === "invalid" || normalized === "expired" || normalized === "revoked";
    return {
      state: "missing",
      reason: broken ? "服务说这份凭据已失效，需要重新配置" : "服务说这份凭据还没有配置",
    };
  }
  return { state: "unknown", reason: "服务的回答里这条凭据状态认不出来，本页不给它下结论" };
}

const PLATFORM_UNCONFIGURED = [
  "not_configured",
  "unconfigured",
  "missing_credentials",
  "no_credentials",
  "disabled",
] as const;

export function platformStatusOf(token: string | null): RowStatus {
  if (token === null) return "unknown";
  const normalized = token.toLowerCase().replace(/[\s-]+/g, "_");
  if ((CONNECTED_TOKENS as readonly string[]).includes(normalized)) return "available";
  if ((PLATFORM_UNCONFIGURED as readonly string[]).includes(normalized)) return "disabled";
  if (DOWN_TOKENS[normalized]) return "unavailable";
  return "unknown";
}

/** `gateway.platforms`, when the answer is the gateway summary. */
export function summaryPlatforms(payload: unknown): Record<string, unknown> | null {
  const outer = record(payload);
  if (!outer) return null;
  const gateway = record(outer["gateway"]);
  if (!gateway) return null;
  return record(gateway["platforms"]);
}

/** The gateway-level instant, used only where a platform carries none of its own. */
export function summaryStamp(payload: unknown): string | null {
  const outer = record(payload);
  const gateway = outer ? record(outer["gateway"]) : null;
  return gateway ? pick(gateway, SEEN_KEYS) : null;
}

function platformRow(
  key: string,
  value: unknown,
  source: SourceSpec,
  gatewayStamp: string | null,
): ChannelRow | null {
  const rec = record(value);
  if (!rec) return null;
  const token = pick(rec, STATE_KEYS);
  const status = platformStatusOf(token);
  const attention = flag(rec["needs_attention"]) === true;
  const credential = credentialOf(rec);
  const own = pick(rec, SEEN_KEYS);
  const typeToken = pick(rec, TYPE_KEYS);
  const normalized = key.toLowerCase().replace(/[\s-]+/g, "_");
  const name = pick(rec, NAME_KEYS) ?? PLATFORM_LABELS[normalized] ?? key;

  const reason =
    status === "available"
      ? attention
        ? "服务把这项平台标记为需要处理"
        : null
      : (reasonOf(rec) ??
        (status === "disabled"
          ? "服务的回答说这项平台还没有配置好"
          : status === "unavailable"
            ? "服务的回答说这项平台没有连上"
            : "服务的回答里没有说明这项平台当前的状态"));

  return {
    key: `${source.id}:${key}`,
    name,
    // The gateway summary always names the platform key, so a masked handle is
    // never the only thing on the row.
    masked: null,
    kindLabel: PLATFORM_KINDS[normalized] ?? (typeToken ? plainType(typeToken) : source.kindLabel),
    status,
    reason,
    lastSeen: own ?? gatewayStamp,
    lastSeenNote:
      own === null && gatewayStamp !== null
        ? "服务按网关整体给出更新时间，这项平台没有单独的时间"
        : null,
    sourceId: source.id,
    platformStatus: status,
    credential: credential.state,
    credentialReason: credential.reason,
    attention,
    rawId: key,
    rawState: token,
    rawReason: status === "available" ? null : pick(rec, REASON_KEYS),
    rawType: typeToken,
  };
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
  // The gateway summary is not a list at all: its platforms live in a record
  // under `gateway.platforms`. Read that shape first, for that source only.
  if (source.id === "platforms") {
    const platforms = summaryPlatforms(payload);
    if (platforms) {
      const gatewayStamp = summaryStamp(payload);
      const rows: ChannelRow[] = [];
      let unreadable = 0;
      for (const [key, value] of Object.entries(platforms)) {
        const row = platformRow(key, value, source, gatewayStamp);
        if (row) rows.push(row);
        else unreadable += 1;
      }
      if (!rows.length && !unreadable) return { kind: "empty", path };
      return { kind: "rows", rows, declaredTotal: rows.length + unreadable, unreadable, path };
    }
  }

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

/** The states the screen can ask for; `all` asks for everything. */
export type StatusFilter = "all" | "available" | "unavailable" | "disabled";

export const FILTERS: readonly { key: StatusFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "available", label: "已接入" },
  { key: "unavailable", label: "未接入与未知" },
  { key: "disabled", label: "未启用" },
];

export function filterOf(raw: string | null): StatusFilter {
  return raw === "available" || raw === "unavailable" || raw === "disabled" ? raw : "all";
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
  // 「未启用」 is its own question. 「未接入与未知」 keeps asking for everything
  // that is not working — so a switched-off platform still turns up there, and
  // no row can hide from both choices at once.
  if (filter === "disabled") return rows.filter((row) => row.status === "disabled");
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

/**
 * The status word on the badge. Unknown is 「未知」, never a favourable word, and
 * a platform somebody switched off says 「未启用」 instead of being called 未接入.
 */
export const STATUS_LABEL: Record<RowStatus, string> = {
  available: "已接入",
  disabled: "未启用",
  unavailable: "未接入",
  unknown: "未知",
};

/**
 * The 数据源 ledger's own three words. A ledger row speaks for a WHOLE source,
 * and this page cannot verify a source it could not read — so where a platform
 * row may honestly say 「状态未说明」, a ledger row says 「待核实」: the work left
 * to do is checking, not guessing. `disabled` never occurs here (no ledger read
 * folds to it) but is mapped so the table cannot fall back to the other word.
 * Never 正常, never green.
 */
export const LEDGER_STATUS_LABEL: Record<RowStatus, string> = {
  available: "已接入",
  disabled: "未启用",
  unavailable: "未接入",
  unknown: "待核实",
};

/* ------------------------------------------------------------------ *
 * Time
 * ------------------------------------------------------------------ */

/**
 * Parse the three forms an upstream instant arrives in: epoch seconds, epoch
 * milliseconds, or a date/datetime string. Anything else is not an instant and
 * returns null — the caller then writes 「—」 plus that reason. Shared by
 * `beijingMinute` and the ledger's newest-timestamp fold, so the two can never
 * disagree about what counts as a time.
 */
function toInstant(value: string | number | null): Date | null {
  if (value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{9,10}$/.test(raw)) return new Date(Number(raw) * 1000);
  if (/^\d{11,13}$/.test(raw)) return new Date(Number(raw));
  if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/.test(raw)) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * The newest instant the answer itself carried, in its raw wire form, or null
 * when nothing in it was an instant. Used for the ledger's 最近同步: a source
 * that never said when it last refreshed shows 「—」 with that said plainly, and
 * this page's own clock is never offered in its place.
 */
export function newestSeen(rows: readonly ChannelRow[]): string | null {
  let best: { raw: string; at: number } | null = null;
  for (const row of rows) {
    const raw = row.lastSeen;
    if (!raw) continue;
    const date = toInstant(raw);
    if (!date) continue;
    const at = date.getTime();
    if (best === null || at > best.at) best = { raw, at };
  }
  return best?.raw ?? null;
}

/** What the ledger's 「—」 means when the answer carried no instant at all. */
export const NO_SYNC_REASON = "这份回答没有说它最近是什么时候同步的";

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
  /** Plain-Chinese kind of this source (数据源 / MCP 连接 / …). */
  kindLabel: string;
  /** 来源 in human words: whose list this row speaks for. */
  originLabel: string;
  status: RowStatus;
  /** Plain sentence: what was tried, and what it said. */
  reason: string;
  /**
   * Every row that is not 已接入 carries the number that says which kind of gap
   * this is (GAP-08 路由缺席 / GAP-11 有回答但无条目 / GAP-12 读了个错出来, or the
   * source's own number). A verdict is never shown without one.
   */
  gap: string | null;
  /** 最近同步: the newest instant the ANSWER carried, in wire form. null → 「—」. */
  syncedAt: string | null;
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
 * with an empty list is not called 已接入 (it is 「待核实」, with that said
 * plainly), a missing route is 未接入 carrying its GAP number, and a read that
 * came back wrong or unreadable is 待核实 carrying GAP-12. Nothing here can be
 * green without an answer behind it, and no row that is not green is shown
 * without the gap number that says why.
 *
 * 最近同步 comes from the answer only (`newestSeen`). A source that never
 * carried an instant gets null and renders 「—」 plus the reason — this page's own
 * clock is kept separate as 本次核验, and is never offered as a sync stamp.
 */
export function ledgerRows(reads: Record<string, SourceRead>, checkedAt: Date | null): LedgerRow[] {
  return SOURCES.map((source) => {
    const read = reads[source.id];
    const base = {
      key: source.id,
      label: source.label,
      kindLabel: source.kindLabel,
      originLabel: source.originLabel,
      checkedAt,
    };
    const lastTried = source.paths[source.paths.length - 1] ?? null;

    if (!read) {
      return {
        ...base,
        status: "unknown" as RowStatus,
        reason: "这一轮没有读到它的结果，所以现在既不能说它接好了，也不能说它没接",
        gap: GAP_UNVERIFIABLE,
        syncedAt: null,
        rawPath: lastTried,
        rawDetail: null,
      };
    }
    if (read.kind === "rows") {
      return {
        ...base,
        status: "available" as RowStatus,
        reason: `这一次读到 ${read.rows.length} 条`,
        gap: null,
        syncedAt: newestSeen(read.rows),
        rawPath: read.path,
        rawDetail: read.declaredTotal === null ? null : `服务声明共 ${read.declaredTotal} 条`,
      };
    }
    if (read.kind === "empty") {
      return {
        ...base,
        status: "unknown" as RowStatus,
        reason: "这条读取路由有回答，只是这次清单里一条也没有，所以这里不写成已接入，要人工核实一次",
        gap: GAP_NO_ENTRIES,
        syncedAt: null,
        rawPath: read.path,
        rawDetail: null,
      };
    }
    if (read.kind === "shape") {
      return {
        ...base,
        // The route answered — so 未接入 would be a lie — but what it answered
        // with is not a list, so nothing here proves it works either.
        status: "unknown" as RowStatus,
        reason: "这条路由有回答，但回的内容不是一份清单，这里读不出它到底接没接通",
        gap: GAP_UNVERIFIABLE,
        syncedAt: null,
        rawPath: lastTried,
        rawDetail: "unexpected payload shape",
      };
    }
    if (read.denied) {
      return {
        ...base,
        status: "unavailable" as RowStatus,
        reason: source.missingReason,
        gap: source.gap,
        syncedAt: null,
        rawPath: lastTried,
        rawDetail: read.failure.technical,
      };
    }
    return {
      ...base,
      status: "unknown" as RowStatus,
      reason: read.failure.sentence,
      gap: GAP_UNVERIFIABLE,
      syncedAt: null,
      rawPath: lastTried,
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
