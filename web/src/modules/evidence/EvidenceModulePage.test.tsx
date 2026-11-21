// @vitest-environment jsdom
import { act, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';

import { EvidenceModulePage } from './EvidenceModulePage';

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));

vi.mock('@/lib/api', () => ({ fetchJSON: api.fetchJSON }));

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

const EVENT = {
  eventId: 'ev_01M7DEY8ZQ4R7T2V8X0Y2A4B6C',
  schemaVersion: 1,
  tenantId: 't_seakoi_pilot',
  occurredAt: '2026-11-17T18:18:10.723Z',
  recordedAt: '2026-11-17T18:18:11.023Z',
  sourceSystem: 'employee',
  action: 'employee.create.denied',
  outcome: 'denied',
  actor: { type: 'employee', id: 'emp_86A81CE8FF6F42E187BCF2B540', displayName: '小鲤' },
  resource: { type: 'employee', id: 'emp_86A81CE8FF6F42E187BCF2B540' },
};

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  api.fetchJSON.mockReset();
  // The page reads the console session token itself.
  (window as { __HERMES_SESSION_TOKEN__?: string }).__HERMES_SESSION_TOKEN__ = 'tok-evidence';
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
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

const q = (id: string) => container.querySelector(`[data-testid="${id}"]`);

describe('the real audit surface', () => {
  it('reads a bounded audit window and paints one row per event', async () => {
    api.fetchJSON.mockResolvedValue({ events: [EVENT] });
    await render();

    const url = String(api.fetchJSON.mock.calls[0][0]);
    expect(url).toContain('/agent-api/api/audit?');
    expect(url).toContain('from=');
    expect(url).toContain('to=');
    expect(url).toContain('limit=50');
    expect(url).not.toContain('run-events');

    const row = q(`ev5-row-${EVENT.eventId}`);
    expect(row).toBeTruthy();
    expect(row?.textContent).toContain('员工操作');
    expect(row?.textContent).toContain('小鲤 · 86A81CE8');
    expect(row?.textContent).toContain('目标对象');
    expect(row?.textContent).toContain('2026-11-18 02:18');
    expect(q(`ev5-open-${EVENT.eventId}`)?.getAttribute('href')).toBe(
      `/audit?detail=${encodeURIComponent(EVENT.eventId)}`,
    );
    expect(q(`ev5-source-${EVENT.eventId}`)?.textContent).toContain('来源 · 审计');
    expect(q('ev5-summary')?.textContent).toContain('共 1 条记录');
    expect(q('ev5-summary')?.textContent).toContain('可回原文 1');
  });

  it('never renders a bare employee id as text, only the code', async () => {
    api.fetchJSON.mockResolvedValue({ events: [EVENT] });
    await render();
    expect(container.textContent).not.toContain('emp_86A81CE8FF6F42E187BCF2B540');
    expect(q(`ev5-actor-${EVENT.eventId}`)?.getAttribute('title')).toBe(
      'emp_86A81CE8FF6F42E187BCF2B540',
    );
  });

  it('resolves the target person to 「姓名 · 8 位短码」 from the directory side read', async () => {
    api.fetchJSON.mockImplementation((url: string) =>
      String(url).includes('/employees')
        ? Promise.resolve({ items: [{ employeeId: 'emp_86A81CE8FF6F42E187BCF2B540', name: '小鲤' }] })
        : Promise.resolve({ events: [{ ...EVENT, actor: { type: 'employee', id: 'emp_86A81CE8FF6F42E187BCF2B540' }, resource: { type: 'employee', id: 'emp_86A81CE8FF6F42E187BCF2B540' } }] }),
    );
    await render();
    const row = q(`ev5-row-${EVENT.eventId}`);
    expect(row?.textContent).toContain('小鲤 · 86A81CE8');
    expect(q(`ev5-target-${EVENT.eventId}`)?.textContent).toContain('小鲤 · 86A81CE8');
    expect(row?.textContent).not.toContain('emp_86A81CE8FF6F42E187BCF2B540');
  });

  it('a person-shaped target without an id reads 未指派, never a made-up code', async () => {
    api.fetchJSON.mockResolvedValue({ events: [{ ...EVENT, resource: { type: 'employee' } }] });
    await render();
    expect(q(`ev5-target-${EVENT.eventId}`)?.textContent).toContain('未指派');
  });

  it('marks a row 待核实 and says why when an identifier is missing', async () => {
    api.fetchJSON.mockResolvedValue({
      events: [{ ...EVENT, eventId: '', actor: {}, resource: { type: 'run' } }],
    });
    await render();

    const row = q('ev5-row-ev5-row-1');
    expect(row).toBeTruthy();
    expect(row?.textContent).toContain('待核实');
    expect(row?.textContent).toContain('未指派');
    expect(q('ev5-open-ev5-row-1')).toBeNull();
    const unreachable = q('ev5-unreachable-ev5-row-1');
    expect(unreachable?.textContent).toContain('原文不可达');
    expect(unreachable?.textContent).toContain('没有给出这条记录的事件编号');
    // GAP numbering rides in the title, never as visible copy.
    expect(container.textContent).not.toContain('GAP-1');
    expect(q('ev5-unverified-ev5-row-1')?.getAttribute('title')).toContain('GAP-1');
  });

  it('counts 待核实 and 原文不可达 in the summary', async () => {
    api.fetchJSON.mockResolvedValue({
      events: [EVENT, { ...EVENT, eventId: '', resource: { type: 'employee' } }],
    });
    await render();
    expect(q('ev5-summary')?.textContent).toContain('待核实 1');
    expect(q('ev5-summary')?.textContent).toContain('原文不可达 1');
  });
});

describe('the four states', () => {
  it('paints an empty state when the window has no events', async () => {
    api.fetchJSON.mockResolvedValue({ events: [] });
    await render();
    expect(q('ev5-empty')).toBeTruthy();
    expect(q('ev5-list')).toBeNull();
  });

  it('renders one identical body for 403 and 404', async () => {
    api.fetchJSON.mockRejectedValue(
      new ApiError('denied', { status: 403, body: '{"code":"console.forbidden"}', url: '/x', requestId: 'rid-a' }),
    );
    await render();
    const first = q('ev5-denied')?.outerHTML ?? '';
    expect(first).toContain('你看不到这些引用');
    expect(first).toContain('rid-a');

    act(() => root.unmount());
    root = createRoot(container);
    api.fetchJSON.mockRejectedValue(
      new ApiError('missing', { status: 404, body: '{"code":"console.not_found"}', url: '/x', requestId: 'rid-a' }),
    );
    await render();
    expect(q('ev5-denied')?.outerHTML).toBe(first);
    expect(container.textContent).not.toContain('/agent-api');
  });

  it('shows the request id and retries after a real failure', async () => {
    api.fetchJSON.mockRejectedValueOnce(
      new ApiError('boom', { status: 500, body: '', url: '/x', requestId: 'rid-500' }),
    );
    await render();
    expect(q('ev5-error')).toBeTruthy();
    expect(q('ev5-error-request-id')?.textContent).toContain('rid-500');

    api.fetchJSON.mockResolvedValue({ events: [EVENT] });
    await act(async () => {
      (q('ev5-error-retry') as HTMLButtonElement).click();
    });
    await act(async () => {});
    expect(q(`ev5-row-${EVENT.eventId}`)).toBeTruthy();
  });

  it('states 未提供 when the failure carried no request id', async () => {
    api.fetchJSON.mockRejectedValue(
      new ApiError('boom', { status: 500, body: '', url: '/x' }),
    );
    await render();
    expect(q('ev5-error-request-id-absent')).toBeTruthy();
  });

  it('gates on the console session without sending a request', async () => {
    delete (window as { __HERMES_SESSION_TOKEN__?: string }).__HERMES_SESSION_TOKEN__;
    vi.stubGlobal('fetch', whoamiStub({ status: 401 }));
    await render();
    expect(q('ev5-login')).toBeTruthy();
    expect(container.textContent).toContain('需要登录');
    expect(api.fetchJSON).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

// P0-1 (UX r1): the pane must reach the same session verdict as the shell's
// identity widget — the injected token OR a 2xx /auth/whoami. These cases pin
// both halves and the traps (fallback HTML, dead auth route) that must read
// as logged-out instead of false-green.
function whoamiStub(init: { status?: number; json?: unknown; reject?: boolean }) {
  return vi.fn((url: string) => {
    if (!String(url).includes('/auth/whoami')) {
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }
    if (init.reject) return Promise.reject(new TypeError('Failed to fetch'));
    const status = init.status ?? 200;
    const body =
      init.json === undefined
        ? null
        : typeof init.json === 'string'
          ? init.json
          : JSON.stringify(init.json);
    return Promise.resolve(
      new Response(body, {
        status,
        headers: typeof init.json === 'string' ? { 'content-type': 'text/html' } : undefined,
      }),
    );
  });
}

describe('session verdict is the same source as the shell (P0-1)', () => {
  beforeEach(() => {
    delete (window as { __HERMES_SESSION_TOKEN__?: string }).__HERMES_SESSION_TOKEN__;
  });

  it('a cookie-authed session (whoami 2xx, no token) reads citations — never 需要登录', async () => {
    vi.stubGlobal('fetch', whoamiStub({ json: { display: 'opsadmin' } }));
    api.fetchJSON.mockResolvedValue({ events: [EVENT] });
    await render();
    expect(q('ev5-login')).toBeNull();
    expect(container.textContent).not.toContain('需要登录');
    expect(q(`ev5-row-${EVENT.eventId}`)).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it('a 401 whoami shows the login state and sends no data read', async () => {
    vi.stubGlobal('fetch', whoamiStub({ status: 401 }));
    await render();
    expect(q('ev5-login')).toBeTruthy();
    expect(api.fetchJSON).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('the 200-HTML SPA fallback on /auth/whoami reads as logged-out, not as a session', async () => {
    vi.stubGlobal('fetch', whoamiStub({ json: '<!doctype html><html><body>index</body></html>' }));
    await render();
    expect(q('ev5-login')).toBeTruthy();
    expect(api.fetchJSON).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('an unreachable auth route fails closed into the login state', async () => {
    vi.stubGlobal('fetch', whoamiStub({ reject: true }));
    await render();
    expect(q('ev5-login')).toBeTruthy();
    expect(api.fetchJSON).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('waits for the verdict before any read, saying so honestly', async () => {
    let release: ((v: Response) => void) | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      ),
    );
    await render();
    expect(q('ev5-checking')).toBeTruthy();
    expect(container.textContent).toContain('正在确认登录状态');
    expect(api.fetchJSON).not.toHaveBeenCalled();
    release?.(
      new Response(JSON.stringify({ display: 'opsadmin' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    api.fetchJSON.mockResolvedValue({ events: [EVENT] });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {});
    expect(q('ev5-checking')).toBeNull();
    expect(q(`ev5-row-${EVENT.eventId}`)).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it('「重新检查登录状态」 re-probes and recovers into the list', async () => {
    const stub = whoamiStub({ status: 401 });
    vi.stubGlobal('fetch', stub);
    await render();
    expect(q('ev5-login')).toBeTruthy();
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', whoamiStub({ json: { display: 'opsadmin' } }));
    api.fetchJSON.mockResolvedValue({ events: [EVENT] });
    await act(async () => {
      (q('ev5-login-retry') as HTMLButtonElement).click();
    });
    await act(async () => {});
    expect(q(`ev5-row-${EVENT.eventId}`)).toBeTruthy();
    expect(q('ev5-login')).toBeNull();
    vi.unstubAllGlobals();
  });
});
