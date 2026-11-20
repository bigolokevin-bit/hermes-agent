/**
 * User-facing error shape for the dashboard REST layer.
 *
 * `fetchJSON` used to throw `new Error("<status>: <raw body>")`, and ~40 toast
 * call sites interpolated the Error object (`Error: ${e}`), so users saw
 * `Error: Error: 404: {"detail":"Server 'foo' not found"}`. This module turns
 * that into a plain sentence (`Server 'foo' not found`) while keeping the
 * status and raw body on the error object for diagnostics.
 */

/** The dashboard's own backend could not be reached at all (fetch rejected). */
export const API_UNREACHABLE_MESSAGE =
  "Hermes dashboard cannot reach the Hermes service. Is `hermes dashboard` still running?";

/**
 * 设计车道 ①（P0-① 收敛）：401 的页内句只留纯引导，不再复述状态。「会话已过期」
 * 这件事由全站唯一的 `shell/SessionExpiredBanner` 说一次；页面与模块的错误态引用
 * 本常量（`lib/api-error` 的 STATUS_COPY[401] 与 tenant/metrics/org/skills/models
 * 五处逐字重复的同句都 import 它），所以这句话在一屏里最多出现两次（横幅 + 空态）。
 * 新句必须保持纯引导：不得含「失效」「过期」「需要登录」等状态复述字样。
 */
export const SESSION_REQUIRED_GUIDANCE = "重新登录后回到这个页面，即可继续查看。";

/** Status → plain sentence, used when the body carries no usable `detail`. */
const STATUS_COPY: Record<number, string> = {
  400: "The dashboard sent a request the server could not understand.",
  // R5 item 1: 401 must read as plain Chinese on screen — every consumer
  // renders this sentence; the old English copy leaked raw text to users.
  401: SESSION_REQUIRED_GUIDANCE,
  403: "You are not allowed to do that on this dashboard.",
  404: "The server could not find what the dashboard asked for.",
  409: "That change conflicts with the current state on the server.",
  413: "That upload is too large for the server to accept.",
  422: "Some of the entered values are not valid.",
  429: "Too many requests. Wait a moment and try again.",
  500: "The Hermes service hit an internal error.",
  502: "The dashboard proxy could not reach the Hermes service.",
  503: "The Hermes service is not ready yet. Try again in a moment.",
  504: "The Hermes service took too long to respond.",
};

export function humanizeStatus(status: number): string {
  return STATUS_COPY[status] ?? `The Hermes service answered with an unexpected error (${status}).`;
}

/** Pull a human sentence out of a FastAPI-style error body, or null. */
export function extractDetail(body: string): string | null {
  const text = body.trim();
  if (!text) return null;
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        for (const key of ["detail", "message", "error"]) {
          const value = record[key];
          if (typeof value === "string" && value.trim()) return value.trim();
          // FastAPI validation errors: detail is a list of {msg, loc}.
          if (Array.isArray(value)) {
            const msgs = value
              .map((item) => (item && typeof item === "object" ? (item as { msg?: unknown }).msg : null))
              .filter((m): m is string => typeof m === "string");
            if (msgs.length) return msgs.join("; ");
          } else if (value && typeof value === "object") {
            // Structured detail ({error: "<code>", message: "<sentence>"}): the code is for
            // programs, the sentence is what the operator needs to act on.
            const message = (value as { message?: unknown }).message;
            if (typeof message === "string" && message.trim()) return message.trim();
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }
  if (text.startsWith("<")) return null; // HTML error page from a proxy
  return text.length <= 300 ? text : null;
}

export class ApiError extends Error {
  /** HTTP status; 0 when the request never reached the server. */
  readonly status: number;
  /** Raw response body (or the transport error text) for a Copy-details action. */
  readonly body: string;
  /** Request URL (path only), for diagnostics. */
  readonly url: string;
  /** Request id echoed by the BFF (x-console-request-id / x-request-id). */
  readonly requestId?: string;

  constructor(message: string, init: { status: number; body: string; url: string; requestId?: string }) {
    super(message);
    this.name = "ApiError";
    this.status = init.status;
    this.body = init.body;
    this.url = init.url;
    this.requestId = init.requestId;
  }

  /** Multi-line technical detail for a Copy-details action or console. */
  get details(): string {
    const head = this.status ? `HTTP ${this.status} ${this.url}` : `network failure ${this.url}`;
    return this.body ? `${head}\n${this.body}` : head;
  }
}

export function apiErrorFromResponse(
  status: number,
  body: string,
  url: string,
  requestId?: string,
): ApiError {
  // R5 item 1: a 401 is always the login sentence — never the gate's raw
  // English envelope (`unauthenticated`/`session_expired`), never a detail.
  if (status === 401) {
    return new ApiError(humanizeStatus(401), { status, body, url, requestId });
  }
  const detail = extractDetail(body);
  return new ApiError(detail ?? humanizeStatus(status), { status, body, url, requestId });
}

export function apiErrorFromNetworkFailure(cause: unknown, url: string): ApiError {
  const body = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
  return new ApiError(API_UNREACHABLE_MESSAGE, { status: 0, body, url });
}

/**
 * R5 item 1: the escape hatch for the two 401 paths that full-page navigate
 * (gate login_url / stale-token reload). Those navigations unload the page,
 * so the pending promise never matters — but when a browser blocks or the
 * reload does not fix the session, the SPA would hang on Loading forever.
 * This error rejects the pending call after a grace period so the UI shows
 * the plain 「需要登录」 state with its retry affordance instead.
 */
export function authExpiredError(url: string, requestId?: string): ApiError {
  return new ApiError(humanizeStatus(401), { status: 401, body: "", url, requestId });
}

/** Grace period before a pending full-page auth navigation is treated as failed. */
export const AUTH_NAVIGATION_GRACE_MS = 6000;

/**
 * The one way to turn a caught `unknown` into toast/inline text. Never yields
 * a `Error: Error:` double prefix because it reads `.message`, not `String(e)`.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === "string") return err;
  return String(err);
}
