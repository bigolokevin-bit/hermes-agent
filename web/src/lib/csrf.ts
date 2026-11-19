/**
 * Double-submit CSRF helper for console write requests.
 *
 * The bridge stores the session CSRF token in the non-HttpOnly cookie
 * `console_csrf`; every write must echo it in the `X-Console-CSRF` header.
 * When the cookie is absent (anonymous or expired session) we never send the
 * write — the caller shows an honest plain-Chinese state instead. The token
 * is read from the cookie per request and is never copied into
 * localStorage. Failures carrying `console.csrf_origin` /
 * `console.csrf_token_mismatch` map to plain sentences with a copyable
 * request id; the raw code never reaches the screen.
 */

export const CSRF_COOKIE = "console_csrf";
export const CSRF_HEADER = "X-Console-CSRF";

/** Read the CSRF token from the document cookie; null when absent/empty. */
export function readCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (name !== CSRF_COOKIE) continue;
    const value = part.slice(eq + 1).trim();
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

/** Headers for a write request, or null when there is no session to write with. */
export function csrfWriteHeaders(): Record<string, string> | null {
  const token = readCsrfToken();
  if (!token) return null;
  return { [CSRF_HEADER]: token };
}

/** Plain sentence for a blocked write (no cookie); link target is /login. */
export const NOT_LOGGED_IN_COPY = "需要登录后才能提交。";
export const WRITE_UNAVAILABLE_COPY = "当前环境暂不可写，请稍后重试。";

export type CsrfFailureCopy = { sentence: string; requestId: string | null };

/**
 * Map a write failure to an honest sentence plus a copyable request id.
 * Returns null when this helper has nothing better than the caller's own
 * generic mapping. Never echoes internal codes or raw bodies.
 */
export function csrfFailureCopy(status: number, bodyText: string | null | undefined, headerRid?: string | null): CsrfFailureCopy | null {
  if (status !== 403) return null;
  let code: string | null = null;
  let rid: string | null = null;
  if (bodyText) {
    try {
      const parsed: unknown = JSON.parse(bodyText);
      if (parsed && typeof parsed === "object") {
        const rec = parsed as Record<string, unknown>;
        if (typeof rec.code === "string") code = rec.code;
        const nested = rec.detail;
        if (code === null && nested && typeof nested === "object") {
          const n = nested as Record<string, unknown>;
          if (typeof n.code === "string") code = n.code;
        }
        if (typeof rec.rid === "string" && rec.rid.trim()) rid = rec.rid.trim();
        else if (typeof rec.request_id === "string" && rec.request_id.trim()) rid = rec.request_id.trim();
      }
    } catch {
      // non-JSON body: fall through to the generic 403 mapping below
    }
  }
  if (!rid && headerRid && headerRid.trim()) rid = headerRid.trim();
  if (code === "console.csrf_origin") {
    return { sentence: "当前访问来源不被允许写入，请联系管理员开通后再试。", requestId: rid };
  }
  if (code === "console.csrf_token_mismatch") {
    return { sentence: "登录状态已过期，写入被拦下了。请重新登录后再试。", requestId: rid };
  }
  return null;
}
