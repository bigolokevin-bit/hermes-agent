import { describe, expect, it } from 'vitest'

import {
  ACTIVITY_UNAVAILABLE_MESSAGE,
  ACTIVITY_UNAVAILABLE_RETRY_LABEL,
  SIDECAR_DISCONNECTED_MESSAGE,
  credentialWarning,
  sidecarErrorMessage
} from './chat-sidebar-banner'

describe('activity unavailable copy', () => {
  it('states the environment fact without fault language', () => {
    expect(ACTIVITY_UNAVAILABLE_MESSAGE).toContain('活动流未接入本环境')
    expect(ACTIVITY_UNAVAILABLE_MESSAGE).toContain('对话本身可用')
    expect(ACTIVITY_UNAVAILABLE_MESSAGE).not.toMatch(/could not connect/i)
    expect(ACTIVITY_UNAVAILABLE_RETRY_LABEL).toBe('重试接入')
  })

  it('keeps the side-panel failure copy in Chinese', () => {
    expect(SIDECAR_DISCONNECTED_MESSAGE).toContain('模型与工具活动未能连接')
  })
})

describe('credentialWarning', () => {
  it('rewrites the gateway probe into a sentence that names the provider and the fix', () => {
    const w = credentialWarning("No API key configured for provider 'openrouter'. First message will fail.")
    expect(w?.provider).toBe('openrouter')
    expect(w?.message).toContain('openrouter')
    expect(w?.message).not.toContain('First message will fail')
  })

  it('passes unknown warnings through untouched and ignores empty input', () => {
    expect(credentialWarning('OAuth token for anthropic expires in 2 minutes')?.message).toBe(
      'OAuth token for anthropic expires in 2 minutes'
    )
    expect(credentialWarning(undefined)).toBeNull()
    expect(credentialWarning('')).toBeNull()
  })
})

describe('sidecarErrorMessage', () => {
  it('collapses transport jargon into the side-panel sentence and keeps real errors', () => {
    for (const raw of [
      'WebSocket connection failed',
      'WebSocket closed',
      'gateway not connected',
      'Session token not available — page must be served by the Hermes dashboard server'
    ]) {
      expect(sidecarErrorMessage(raw)).toBe(SIDECAR_DISCONNECTED_MESSAGE)
    }
    expect(sidecarErrorMessage("Profile 'nope' not found")).toBe("Profile 'nope' not found")
  })
})
