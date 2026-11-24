// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { isActivityBackendMissing } from './eventsFeedClient'

describe('isActivityBackendMissing', () => {
  it('recognises the BFF has no ws-ticket/events route', () => {
    expect(
      isActivityBackendMissing({
        status: 404,
        body: '{"code":"console.unknown_route","message":"no such route"}'
      })
    ).toBe(true)
  })

  it('recognises the read-only console BFF (405)', () => {
    expect(
      isActivityBackendMissing({
        status: 405,
        body: '{"code":"console.read_only","message":"only GET/HEAD allowed"}'
      })
    ).toBe(true)
  })

  it('recognises a page served without a WS credential', () => {
    expect(
      isActivityBackendMissing(
        new Error('Session token not available — page must be served by the Hermes dashboard server')
      )
    ).toBe(true)
  })

  it('keeps real failures out of the neutral state', () => {
    expect(isActivityBackendMissing({ status: 401, body: '{"code":"unauthenticated"}' })).toBe(false)
    expect(isActivityBackendMissing({ status: 500, body: '{"code":"console.error"}' })).toBe(false)
    expect(isActivityBackendMissing(new Error('WebSocket closed'))).toBe(false)
    expect(isActivityBackendMissing(null)).toBe(false)
    expect(isActivityBackendMissing(undefined)).toBe(false)
  })
})