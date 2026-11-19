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
      `/audit?id=${encodeURIComponent(EVENT.eventId)}`,
    );
    expect(q('ev5-summary')?.textContent).toContain('共 1 条记录');
  });

  it('never renders a bare employee id as text, only the code', async () => {
    api.fetchJSON.mockResolvedValue({ events: [EVENT] });
    await render();
    expect(container.textContent).not.toContain('emp_86A81CE8FF6F42E187BCF2B540');
    expect(q(`ev5-actor-${EVENT.eventId}`)?.getAttribute('title')).toBe(
      'emp_86A81CE8FF6F42E187BCF2B540',
    );
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
    await render();
    expect(q('ev5-login')).toBeTruthy();
    expect(container.textContent).toContain('需要登录');
    expect(api.fetchJSON).not.toHaveBeenCalled();
  });
});

describe('?state= reproduction legs', () => {
  it('paints repro rows with data-fixture and issues no request', async () => {
    await render('/knowledge?tab=evidence&state=ready');
    expect(q('ev5-page')?.getAttribute('data-fixture')).toBe('1');
    expect(q('ev5-fixture-note')?.textContent).toContain('复现态');
    expect(q('ev5-row-repro-1')).toBeTruthy();
    expect(q('ev5-row-repro-2')?.textContent).toContain('原文不可达');
    expect(api.fetchJSON).not.toHaveBeenCalled();
  });

  it('paints the other forced states without touching the network', async () => {
    await render('/knowledge?tab=evidence&state=denied&rid=rid-forced');
    expect(q('ev5-denied')).toBeTruthy();
    expect(q('ev5-denied-request-id')?.textContent).toContain('rid-forced');
    expect(api.fetchJSON).not.toHaveBeenCalled();
  });
});