// @vitest-environment jsdom
import { act, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EvidenceModulePage } from './EvidenceModulePage';

vi.mock('@nous-research/ui', () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: ComponentProps<'button'>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Card: ({ children, ...props }: ComponentProps<'div'>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: ComponentProps<'div'>) => (
    <div {...props}>{children}</div>
  ),
}));

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  delete (window as { __HERMES_SESSION_TOKEN__?: string }).__HERMES_SESSION_TOKEN__;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (window as { __HERMES_SESSION_TOKEN__?: string }).__HERMES_SESSION_TOKEN__;
});

async function render(path = '/knowledge?tab=evidence') {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <EvidenceModulePage />
      </MemoryRouter>,
    );
  });
  await act(async () => {});
}

describe('EvidenceModulePage session gate', () => {
  it('renders 需要登录 and sends no request when the browser has no session token', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await render();

    expect(container.querySelector('[data-testid="evidence-login"]')).toBeTruthy();
    expect(container.textContent).toContain('需要登录');
    expect(container.textContent).toContain('引用读取没有发出');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still reads citations once a session token exists', async () => {
    (window as { __HERMES_SESSION_TOKEN__?: string }).__HERMES_SESSION_TOKEN__ = 'tok-evidence';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await render();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/agent-api/api/run-events?kind=citation&limit=50');
    expect(container.querySelector('[data-testid="evidence-empty"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="evidence-login"]')).toBeNull();
  });
});