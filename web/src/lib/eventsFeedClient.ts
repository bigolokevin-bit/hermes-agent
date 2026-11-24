/**
 * `/api/events` subscriber for the dashboard chat sidebar.
 *
 * A notification-only view of the shared JSON-RPC client: the server never
 * answers requests on this socket (subscribers don't speak), so replay is
 * off and `request()` is not part of the surface. One instance lives for
 * the component's whole life — the owner calls `connect()` again after a
 * drop instead of building a new client — so the shared per-generation
 * guards (stale-socket close, connect timeout, `error`+`close` collapsed
 * into one `closed` transition) apply to every attempt.
 */

import { JsonRpcGatewayClient, type ConnectionState, type GatewayEvent, type GatewayEventName } from '@hermes/shared'

import { buildWsUrl } from '@/lib/api'
import { maybeReloadForLoopbackWsAuthFailure } from '@/lib/dashboard-auth-reload'
import { EVENTS_CONNECT_TIMEOUT_MS } from '@/lib/events-reconnect'

export type { ConnectionState, GatewayEvent, GatewayEventName }

type CloseHandler = (code: number | undefined) => void

export class EventsFeedClient extends JsonRpcGatewayClient {
  private readonly closeHandlers = new Set<CloseHandler>()
  private closeCode: number | null | undefined = undefined

  constructor() {
    super({
      closedErrorMessage: 'events feed closed',
      connectErrorMessage: 'events feed connection failed',
      connectTimeoutMs: EVENTS_CONNECT_TIMEOUT_MS,
      heartbeatDeadlineMs: 0,
      heartbeatIntervalMs: 0,
      onSocketClose: event => {
        this.closeCode = event.code
        // Loopback + stale token: the page reloads; nobody should retry.
        return maybeReloadForLoopbackWsAuthFailure(event.code)
      },
      replay: false,
      requestIdPrefix: 'e'
    })
    this.onState(state => {
      if (state === 'closed' || state === 'error') {
        const code = this.closeCode ?? undefined
        this.closeCode = undefined
        for (const handler of this.closeHandlers) {
          handler(code)
        }
      }
    })
  }

  /** Close code of the most recent drop; `null` before any socket was dialed. */
  get lastCloseCode(): number | null | undefined {
    return this.closeCode
  }

  /**
   * Called once per generation that ends without opening or after opening:
   * `code` is the WebSocket close code, or `undefined` when the handshake
   * timed out / errored without a close frame.
   */
  onClose(handler: CloseHandler): () => void {
    this.closeHandlers.add(handler)
    return () => this.closeHandlers.delete(handler)
  }

  /** Mint a fresh single-use ticket and dial `/api/events` for `channel`. */
  async connect(channel: string): Promise<void> {
    this.closeCode = null
    // Cover ticket minting with the same deadline as the handshake: a stalled
    // pre-socket request otherwise emits no close event and strands the retry
    // loop at its last "reconnecting in …" banner.
    const url = await withTimeout(buildWsUrl('/api/events', { channel }), EVENTS_CONNECT_TIMEOUT_MS)
    await super.connect(url)
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('events feed ticket request timed out')), ms)
    promise.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    )
  })
}

/**
 * BFF answers that mean "this deployment does not provide a WebSocket
 * backend", as opposed to "the connection failed and is worth retrying":
 *
 *  - `404 console.unknown_route` — the BFF has no ticket/events route;
 *  - `405 console.read_only` — the console BFF only serves GET/HEAD, so no
 *    POST ticket exchange and no upgrade can ever succeed;
 *  - the loopback client's "Session token not available" — the page was not
 *    served by the Hermes dashboard server, so it has no WS credential.
 *
 * All three are environment facts, surfaced as the calm「活动流未接入」line
 * instead of a red reconnect banner. Real failures (401/403/5xx, a socket
 * that opened and then died) keep the fault tone.
 */
const MISSING_BACKEND_CODES = ['console.unknown_route', 'console.read_only']

export function isActivityBackendMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const record = error as { body?: unknown; message?: unknown; status?: unknown }
  const status = typeof record.status === 'number' ? record.status : undefined
  const text = `${typeof record.body === 'string' ? record.body : ''} ${
    typeof record.message === 'string' ? record.message : ''
  }`
  if (text.includes('Session token not available')) return true
  if (status !== 404 && status !== 405) return false
  return MISSING_BACKEND_CODES.some(code => text.includes(code))
}
