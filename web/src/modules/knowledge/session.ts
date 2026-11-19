/**
 * Whether this browser has a console session token to send with BFF reads.
 *
 * The static evidence preview is served without a token; issuing an
 * authenticated fetch there can only fail and leaves a 401 resource error in
 * the browser console. Callers should render the login-required state instead
 * of making a request that cannot succeed.
 */
export function hasConsoleSession(): boolean {
  return Boolean(window.__HERMES_SESSION_TOKEN__);
}