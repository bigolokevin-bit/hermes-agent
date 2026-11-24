/**
 * sessionsApi — 会话列表读口（SE-02）。
 *
 * 唯一数据源＝既有 BFF 真转发：`GET /agent-api/api/console-sessions`
 *   → BFF `apps/console/server.py` 白名单 `employeeId / limit / cursor`
 *   → runtime `GET /v1/console-sessions?employeeId&limit&cursor`
 *
 * 口径（见 services/runtime/CONSOLE-SESSIONS-SHAPE.md §2）：
 * - 排序由上游给定（updated_at DESC），本模块不重排；
 * - 上游 **没有 total**，只能靠 `nextCursor` 判「还有没有下一页」；
 * - 单条会话含 `messageCount`，但历史数据可能缺该字段 ⇒ 缺值必须是 null（上屏「—」），
 *   不得折成 0（0 是「确实没有消息」，与「不知道」不同）。
 *
 * 本文件不造样例、不兜底假数：形状不认识就抛，由调用方渲染「读口未接」。
 */

import { fetchJsonStrict } from "@/modules/models/fetchJson";

export const CONSOLE_SESSIONS_URL = "/agent-api/api/console-sessions";
export const DEFAULT_SESSIONS_LIMIT = 20;
/** 上游 limit 上限（BFF/runtime 同为 100，超出会被夹）。 */
export const MAX_SESSIONS_LIMIT = 100;

/** 一行会话：缺值一律 null，禁止用 0 / "" 冒充。 */
export interface SessionRow {
  sessionId: string;
  tenantId: string | null;
  employeeId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  messageCount: number | null;
}

export interface SessionsPage {
  items: SessionRow[];
  /** 仅在确有下一页时存在；缺键＝没有下一页。 */
  nextCursor: string | null;
}

export interface SessionsQuery {
  employeeId: string;
  limit?: number;
  cursor?: string | null;
}

function clampLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit) || limit < 1) {
    return DEFAULT_SESSIONS_LIMIT;
  }
  return Math.min(Math.floor(limit), MAX_SESSIONS_LIMIT);
}

/**
 * 组装读口 URL：只带白名单 query（employeeId / limit / cursor）。
 * 不带 offset、不带 total —— 上游不认这两项，带上会被 BFF 拒。
 */
export function buildSessionsUrl({ employeeId, limit, cursor }: SessionsQuery): string {
  const params = new URLSearchParams();
  params.set("employeeId", employeeId);
  params.set("limit", String(clampLimit(limit)));
  if (typeof cursor === "string" && cursor.trim()) params.set("cursor", cursor.trim());
  return `${CONSOLE_SESSIONS_URL}?${params.toString()}`;
}

function optString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function optCount(value: unknown): number | null {
  // 只有真正的有限数才算「知道条数」；字符串 "0"、null、缺键一律视为未知，
  // 避免把「上游没回传」洗成 0 条。
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readItem(raw: unknown, index: number): SessionRow {
  if (!raw || typeof raw !== "object") {
    throw new Error(`会话读口返回的第 ${index + 1} 项不是对象，无法判断字段。`);
  }
  const record = raw as Record<string, unknown>;
  const sessionId = optString(record.sessionId);
  if (!sessionId) {
    throw new Error(`会话读口返回的第 ${index + 1} 项缺少 sessionId，无法作为会话上屏。`);
  }
  return {
    sessionId,
    tenantId: optString(record.tenantId),
    employeeId: optString(record.employeeId),
    createdAt: optString(record.createdAt),
    updatedAt: optString(record.updatedAt),
    messageCount: optCount(record.messageCount),
  };
}

/** 严格解析读口载荷：items 必须是数组；nextCursor 只有在非空字符串时才算存在。 */
export function parseSessionsPage(body: unknown): SessionsPage {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("会话读口返回的不是对象载荷，无法识别形状。");
  }
  const record = body as Record<string, unknown>;
  const rawItems = record.items;
  if (!Array.isArray(rawItems)) {
    throw new Error("会话读口没有返回 items 数组（形状不认识）。");
  }
  return {
    items: rawItems.map(readItem),
    nextCursor: optString(record.nextCursor),
  };
}

/** 读一页会话。网络/状态/形状错误统一抛出，调用方决定「未接 / 失败 / 需登录」的文案。 */
export async function fetchSessionsPage(query: SessionsQuery): Promise<SessionsPage> {
  const body = await fetchJsonStrict(buildSessionsUrl(query));
  return parseSessionsPage(body);
}

/** sessionId 短形：保留前缀 3 字符 + 末尾 6 字符，中间省略（`cs_01M7…DCE0VW`）。 */
export function shortSessionId(sessionId: string): string {
  const value = sessionId.trim();
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}…${value.slice(-6)}`;
}

/** 更新时间：按 Asia/Shanghai 切到分钟；缺值/非法值一律「—」，不显示 "Invalid Date"。 */
export const MISSING_PLACEHOLDER = "\u2014";

const SESSION_TIME_FORMAT = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatSessionTime(value: string | null): string {
  if (!value) return MISSING_PLACEHOLDER;
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return MISSING_PLACEHOLDER;
  return SESSION_TIME_FORMAT.format(at);
}

/** 消息数：null ⇒ 「—」（未知），0 ⇒ 「0 条」（确实为空），两者不得混同。 */
export function formatMessageCount(value: number | null): string {
  if (value === null) return MISSING_PLACEHOLDER;
  return `${value} 条`;
}
/**
 * SE-06：会话列表的**本页筛选**（不是全局搜索）。
 *
 * 上游 `GET /v1/console-sessions` 的 query 白名单只有 `employeeId/limit/cursor`
 * （BFF 侧白名单外参数一律丢弃，server.py 注释口径），因此本模块只能在**已加载的
 * 行**上做客户端过滤，并在 UI 上明写「本页筛选」——不得谎称全局搜索。
 *
 * 匹配口径：会话编号 / 员工编号的大小写不敏感子串。空查询返回原数组（同一引用）。
 */
export function filterSessionRows(
  rows: readonly SessionRow[],
  query: string,
): SessionRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows as SessionRow[];
  return rows.filter(
    (row) =>
      row.sessionId.toLowerCase().includes(needle) ||
      (row.employeeId ? row.employeeId.toLowerCase().includes(needle) : false),
  );
}

/* ── SE-04：会话详情消费面（messages[].requestId + citations 展示） ────────
 *
 * 数据契约（services/runtime/CONSOLE-SESSIONS-SHAPE.md §3，只读核对，不改后端）：
 *  - detail = session 形状 + messageCount + messages[]（seq ASC 全量，无分页）；
 *  - 每条消息带 `requestId`（字符串；缺键=上游没给，上屏「—」，不编）；
 *  - `citations` 键「有才出现」：仅 Hermes 真回非空列表时存在于 assistant 消息；
 *    缺键/空数组/非列表/无 doc 字段一律视为「没有带回引用」——绝不拿 [] 冒充
 *    「有引用但读不出」，也绝不拿空数组说成「0 条引用存在」；
 *  - 跨租户与不存在逐字同体 404 `console_session.not_found`——前端不区分、
 *    不推断存在性，如实说「不存在或不可见」。
 *  - 顺序纪律同列表：上游给定（seq ASC），本模块不重排（牙齿例钉住）。
 */

export interface SessionMessageView {
  seq: number | null;
  role: "user" | "assistant" | null;
  content: string | null;
  requestId: string | null;
  /** null＝上游没有带回引用（缺键/空/形状不认识）；非 null＝上游确实给了条目。 */
  citations: string[] | null;
  createdAt: string | null;
}

export interface SessionDetailView {
  sessionId: string;
  messageCount: number | null;
  messages: SessionMessageView[];
}

export function sessionDetailUrl(sessionId: string): string {
  return `${CONSOLE_SESSIONS_URL}/${encodeURIComponent(sessionId)}`;
}

/** citations「有才出现」解析：非空数组且至少读出一条可读文本才算存在。 */
function readCitations(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) {
      out.push(item.trim());
      continue;
    }
    if (item && typeof item === "object") {
      const doc = (item as Record<string, unknown>).doc;
      if (typeof doc === "string" && doc.trim()) out.push(doc.trim());
    }
  }
  return out.length > 0 ? out : null;
}

export function parseSessionDetail(raw: unknown): SessionDetailView {
  if (!raw || typeof raw !== "object") {
    throw new Error("会话详情读口返回的不是对象载荷，无法识别形状。");
  }
  const record = raw as Record<string, unknown>;
  const sessionId = optString(record.sessionId);
  if (!sessionId) {
    throw new Error("会话详情读口没有回传 sessionId，无法作为详情上屏。");
  }
  const messagesRaw = record.messages;
  if (messagesRaw !== undefined && !Array.isArray(messagesRaw)) {
    throw new Error("会话详情读口的 messages 不是数组，形状不认识。");
  }
  const messages: SessionMessageView[] = (messagesRaw ?? []).map((item: unknown) => {
    if (!item || typeof item !== "object") {
      throw new Error("会话详情里有一条消息不是对象，无法判断字段。");
    }
    const m = item as Record<string, unknown>;
    const role = m.role === "user" || m.role === "assistant" ? m.role : null;
    return {
      seq: typeof m.seq === "number" && Number.isFinite(m.seq) ? m.seq : null,
      role,
      content: optString(m.content),
      requestId: optString(m.requestId),
      // user 行按契约永无 citations；真出现也不隐瞒，照读——上游违例时前端如实显示。
      citations: readCitations(m.citations),
      createdAt: optString(m.createdAt),
    };
  });
  return { sessionId, messageCount: optCount(record.messageCount), messages };
}

export async function fetchSessionDetail(sessionId: string): Promise<SessionDetailView> {
  if (!sessionId.trim()) {
    throw new Error("缺少会话编号，无法读取详情。");
  }
  const body = await fetchJsonStrict(sessionDetailUrl(sessionId));
  return parseSessionDetail(body);
}
