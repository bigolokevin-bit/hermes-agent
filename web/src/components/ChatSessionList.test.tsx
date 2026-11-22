// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ChatSessionList } from './ChatSessionList'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const { getSessions } = vi.hoisted(() => ({ getSessions: vi.fn() }))

vi.mock('@nous-research/ui/ui/components/button', () => ({
  Button: ({
    children,
    ghost,
    onClick,
    outlined,
    prefix,
    size,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { ghost?: boolean; outlined?: boolean; size?: string }) => {
    void ghost
    void outlined
    void prefix
    void size
    return (
      <button type="button" onClick={onClick} {...props}>
        {children}
      </button>
    )
  }
}))

vi.mock('@nous-research/ui/ui/components/list-item', () => ({
  ListItem: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  )
}))

vi.mock('@nous-research/ui/ui/components/spinner', () => ({
  Spinner: () => <span>Loading</span>
}))

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      common: { loading: 'Loading', refresh: 'Refresh', retry: 'Retry' },
      sessions: {
        newChat: 'New chat',
        noSessions: 'No sessions',
        title: 'Sessions',
        untitledSession: 'Untitled session'
      }
    }
  })
}))

vi.mock('@/lib/api', () => ({ api: { getSessions } }))

vi.mock('@/lib/utils', async (importOriginal) => {
  // Keep the REAL timeAgo so the NaN assertions below exercise the same
  // arithmetic production runs (a stubbed 'just now' would mask regressions).
  const actual = await importOriginal<typeof import('@/lib/utils')>()
  return {
    ...actual,
    cn: (...classes: Array<string | false | null | undefined>) =>
      classes.filter(Boolean).join(' ')
  }
})

function session(id: string, title: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    source: 'cli',
    model: null,
    title,
    started_at: 0,
    ended_at: null,
    last_active: 0,
    is_active: false,
    message_count: 0,
    tool_call_count: 0,
    input_tokens: 0,
    output_tokens: 0,
    preview: null,
    ...overrides
  }
}

function response(id: string, title: string) {
  return { sessions: [session(id, title)], total: 1, limit: 30, offset: 0 }
}

describe('ChatSessionList', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers()
    getSessions.mockReset()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible'
    })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  it('renders sessions returned by an automatic refresh', async () => {
    getSessions
      .mockResolvedValueOnce(response('first', 'First session'))
      .mockResolvedValueOnce(response('second', 'Newly created session'))

    await act(async () => {
      root.render(
        <MemoryRouter>
          <ChatSessionList activeSessionId={null} />
        </MemoryRouter>
      )
    })

    expect(container.textContent).toContain('First session')
    expect(getSessions).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })

    expect(getSessions).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('Newly created session')
  })

  it('refreshes immediately when the tab becomes visible', async () => {
    getSessions
      .mockResolvedValueOnce(response('first', 'First session'))
      .mockResolvedValueOnce(response('second', 'Newly created session'))

    await act(async () => {
      root.render(
        <MemoryRouter>
          <ChatSessionList activeSessionId={null} />
        </MemoryRouter>
      )
    })

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible'
    })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(getSessions).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('Newly created session')
  })

  it('waits for the Chat tab to become active before loading or polling', async () => {
    getSessions
      .mockResolvedValueOnce(response('first', 'First session'))
      .mockResolvedValueOnce(response('second', 'Newly created session'))

    await act(async () => {
      root.render(
        <MemoryRouter>
          <ChatSessionList activeSessionId={null} isActive={false} />
        </MemoryRouter>
      )
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })
    expect(getSessions).not.toHaveBeenCalled()

    await act(async () => {
      root.render(
        <MemoryRouter>
          <ChatSessionList activeSessionId={null} isActive />
        </MemoryRouter>
      )
    })

    expect(getSessions).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('First session')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })

    expect(getSessions).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('Newly created session')
  })

  it('never renders literal NaN when the API omits last_active or message_count', async () => {
    getSessions.mockResolvedValueOnce({
      sessions: [
        session('no-time', 'Missing time', { last_active: undefined }),
        session('bad-time', 'Invalid time', { last_active: 'not-a-date' }),
        session('no-count', 'Missing count', { message_count: undefined }),
        session('zero-count', 'Zero count', {
          message_count: 0,
          last_active: Math.floor(Date.now() / 1000) - 120
        })
      ],
      total: 4,
      limit: 30,
      offset: 0
    })

    await act(async () => {
      root.render(
        <MemoryRouter>
          <ChatSessionList activeSessionId={null} />
        </MemoryRouter>
      )
    })

    const text = container.textContent ?? ''
    expect(text).not.toContain('NaN')
    expect(text).not.toContain('undefined')
    // Missing/invalid timestamps degrade to the em-dash placeholder...
    expect(text).toContain('—')
    // ...and a legitimate zero count is shown as zero, not swallowed.
    expect(text).toContain('0 msgs')
  })
})
