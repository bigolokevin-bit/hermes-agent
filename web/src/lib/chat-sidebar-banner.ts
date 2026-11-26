/**
 * Copy for the ChatSidebar banner: the sidecar (JSON-RPC over /api/ws) and
 * the credential probe the gateway sends in `session.info`.
 *
 * Pure helpers so the wording is testable without React.
 */

/** The side panel could not connect; the chat itself is unaffected. */
export const SIDECAR_DISCONNECTED_MESSAGE =
  '模型与工具活动未能连接，对话本身仍可用。点「重试连接」再试一次。'

/**
 * This deployment has no activity-stream backend at all (the BFF answers the
 * ticket exchange with an unknown-route / read-only error, or the socket is
 * refused before it ever opens). That is an environment fact, not a fault the
 * user caused, so the sidebar shows one calm line instead of a red banner.
 *
 * 2026-11-26: the PTY clause is gone. 9122 now reverse-proxies `/api/pty`
 * (WebSocket relay + token injection), verified live: the terminal connects
 * and accepts input. Claiming「PTY 未开放，消息发不出去」would be false here,
 * so the line says only what is true — the activity stream is missing, the
 * conversation itself works.
 */
export const ACTIVITY_UNAVAILABLE_MESSAGE =
  '活动流未接入本环境（模型与工具活动暂不显示）；对话本身可用，消息可以发送。'

/** One-shot re-attempt offered beside ACTIVITY_UNAVAILABLE_MESSAGE. */
export const ACTIVITY_UNAVAILABLE_RETRY_LABEL = '重试接入'

/** Transport-level texts the shared JSON-RPC client can throw. All mean "sidecar down". */
const SIDECAR_TRANSPORT_ERRORS = [
  'WebSocket connection failed',
  'WebSocket closed',
  'gateway not connected',
  'Session token not available',
  'heartbeat acknowledgement timed out'
]

/**
 * Map a sidecar connect/RPC error to the banner sentence. Transport jargon
 * collapses to SIDECAR_DISCONNECTED_MESSAGE; anything else (a real gateway
 * error payload, e.g. a bad profile name) is shown as-is.
 */
export function sidecarErrorMessage(raw: string): string {
  return SIDECAR_TRANSPORT_ERRORS.some(needle => raw.includes(needle)) ? SIDECAR_DISCONNECTED_MESSAGE : raw
}

/** Parsed credential warning from the gateway's `_probe_credentials`. */
export interface CredentialWarning {
  provider: string | null
  message: string
}

const NO_KEY_RE = /No API key configured for provider '([^']+)'/

/**
 * Rewrite the gateway's "No API key configured for provider 'x'. First message
 * will fail." into a sentence that names the fix. Unknown warnings pass
 * through unchanged (provider null) so nothing is lost.
 */
export function credentialWarning(raw: string | undefined | null): CredentialWarning | null {
  if (!raw) return null
  const match = raw.match(NO_KEY_RE)
  if (!match) return { provider: null, message: raw }
  const provider = match[1]
  return {
    provider,
    message: `还没有为 ${provider} 配置 API Key，消息会发送失败。请在「密钥」里添加，或换一个模型。`
  }
}