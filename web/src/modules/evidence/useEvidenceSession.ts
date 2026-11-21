/**
 * P0-1 (UX r1) · one session truth, same source as the shell.
 *
 * The old gate read only `window.__HERMES_SESSION_TOKEN__`, a global the
 * server injects in loopback/static-preview deployments. Cookie-authed
 * deployments (the gated console) never inject it, so while the sidebar
 * identity widget read `/auth/whoami` and showed the signed-in account, this
 * pane declared 「需要登录」and refused to send the read — one session, two
 * identities on the same screen.
 *
 * The rule is now the same one `shell/Auth5Session.tsx` applies: an injected
 * token counts (cheap, synchronous, unchanged contract); otherwise a 2xx
 * `/auth/whoami` with a parsable JSON body is the evidence of a session.
 * A 401, a thrown fetch, or a 2xx that is not JSON (the SPA fallback serving
 * index.html on deployments without an auth route) all count as no session —
 * the pane then stays honest and sends no data read.
 */

export async function hasEvidenceSession(): Promise<boolean> {
  if ((window as { __HERMES_SESSION_TOKEN__?: string }).__HERMES_SESSION_TOKEN__) {
    return true;
  }
  try {
    const res = await fetch('/auth/whoami', { credentials: 'same-origin' });
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as unknown;
    return Boolean(body);
  } catch {
    return false;
  }
}
