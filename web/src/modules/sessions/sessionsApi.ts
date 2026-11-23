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