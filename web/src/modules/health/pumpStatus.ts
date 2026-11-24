import { ApiError } from "@/lib/api-error";

/**
 * Outbound pump heartbeat read point for the 系统健康 page.
 *
 * Why this file exists instead of reusing `@/lib/api`'s `fetchJSON`: the page's
 * four existing reads are pinned by contract tests that count every `fetchJSON`
 * call (`system.time`, `SourceMatrix`, `system.window.isolation` …). A fifth read
 * through that same seam would silently move those counts, so the pump leg is its
 * own same-origin read — same shape as `modules/models/fetchJson`'s strict reader
 * (session header, `mode: same-origin`, never a fake-JSON parse) but it keeps the
 * **raw response body** on the thrown `ApiError`, because 「未接入」 is decided by
 * the structured code inside that body, not by the status alone.
 */
export const PUMP_PATH = "/agent-api/api/pump-status";
export const PUMP_GAP = "GAP-PUMP-01";

/** A tick older than this is reported as an alarm, never as 正常. */
export const PUMP_STALE_MS = 90_000;

/**
 * Only these structured codes turn a 404 into the honest 「pump 状态未接入」.
 * Every other failure (500, timeout, fake-200 HTML, a 404 without one of these
 * codes) is 「这次没读到」 with a retry — an unproven read is not a missing wire.
 */
export const PUMP_NOT_WIRED_CODES = ["console.unknown_route", "pump.status_not_wired"] as const;

/** Engineering context: title tooltip only, never screen text. */
export const PUMP_NOT_WIRED_TITLE = "端点尚未接入（console.unknown_route）";

const SESSION_HEADER = "X-Hermes-Session-Token";

/** Tolerant key ladder, same convention as health.ts / systemHealth.ts readers. */
const TICK_KEYS = ["lastTickAt", "last_tick_at", "tickAt", "tick_at", "lastHeartbeat", "last_heartbeat"] as const;

type Rec = Record<string, unknown>;

function isRecord(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface PumpStatus {
  /** Raw ISO as the upstream wrote it; null when no usable tick came back. */
  tickAt: string | null;
  /** Upstream's own state word, passed through verbatim; never used to judge. */
  state: string | null;
}

/** Lenient payload reader: any known tick key, ISO-parseable, or nothing. */
export function readPumpStatus(payload: unknown): PumpStatus {
  if (!isRecord(payload)) return { tickAt: null, state: null };
  let tickAt: string | null = null;
  for (const key of TICK_KEYS) {
    const value = payload[key];
    if (typeof value !== "string" || !value.trim()) continue;
    const raw = value.trim();
    if (Number.isNaN(Date.parse(raw))) continue;
    tickAt = raw;
    break;
  }
  const label = payload.state ?? payload.status;
  const state = typeof label === "string" && label.trim() ? label.trim() : null;
  return { tickAt, state };
}

export type PumpVerdict = "notWired" | "unknown" | "alive" | "stale";

/**
 * Pure liveness verdict. `nowMs` comes from the caller so the rule is testable
 * without a clock; this is the one place the page compares against the present,
 * and it judges only 「还有没有心跳」 — the displayed moment stays the upstream's.
 */
export function pumpVerdict(status: PumpStatus | null, nowMs: number, notWired = false): PumpVerdict {
  if (notWired) return "notWired";
  const tickAt = status?.tickAt ?? null;
  const at = tickAt ? Date.parse(tickAt) : NaN;
  if (!Number.isFinite(at)) return "unknown";
  return nowMs - at > PUMP_STALE_MS ? "stale" : "alive";
}

function errorCode(body: unknown): string | null {
  if (typeof body !== "string") return null;
  const text = body.trim();
  if (!text.startsWith("{")) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) return null;
    return typeof parsed.code === "string" && parsed.code.trim() ? parsed.code.trim() : null;
  } catch {
    return null;
  }
}

/** 404 + a known 「没有这条路由 / 未接线」 code — and nothing else. */
export function isPumpNotWired(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 404) return false;
  const code = errorCode(error.body);
  return code !== null && (PUMP_NOT_WIRED_CODES as readonly string[]).includes(code);
}

/** Diagnostic sentence for a title tooltip; screen text stays in the component's own words. */
export function pumpFailureDetail(error: unknown): string {
  if (error instanceof ApiError) {
    const rid = error.requestId ? ` · 请求编号：${error.requestId}` : "";
    return error.status ? `HTTP ${error.status} ${error.url}${rid}` : `网络未连通 ${error.url}${rid}`;
  }
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

/** Reads the pump status endpoint; rejects with `ApiError` carrying the raw body. */
export async function loadPumpStatus(signal?: AbortSignal): Promise<unknown> {
  const headers = new Headers();
  const token = typeof window === "undefined" ? undefined : window.__HERMES_SESSION_TOKEN__;
  if (token) headers.set(SESSION_HEADER, token);

  let response: Response;
  try {
    response = await fetch(PUMP_PATH, {
      headers,
      credentials: "include",
      mode: "same-origin",
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError("pump 状态这一腿没有连上数据服务。", { status: 0, body: "", url: PUMP_PATH });
  }

  const requestId = response.headers.get("x-console-request-id") ?? response.headers.get("x-request-id") ?? undefined;
  const text = await response.text();

  if (!response.ok) {
    throw new ApiError("这次没读到 pump 状态。", { status: response.status, body: text, url: PUMP_PATH, requestId });
  }

  const trimmed = text.trim();
  if (trimmed.startsWith("<")) {
    // 假 200：代理回了一页 HTML。这是「没读到」，不是「未接入」，更不是 healthy。
    throw new ApiError("pump 状态接口返回的是页面，不是数据。", {
      status: response.status,
      body: trimmed,
      url: PUMP_PATH,
      requestId,
    });
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new ApiError("pump 状态的内容无法解析。", { status: response.status, body: trimmed, url: PUMP_PATH, requestId });
  }
}
