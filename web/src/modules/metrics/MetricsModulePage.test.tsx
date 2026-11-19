// @vitest-environment jsdom
// met5 — 7×24 heatmap. The important claims: absent cells stay absent (—),
// explicit zeros stay zero, the window switch really changes the request, and
// no raw field names or HTTP codes reach the page.
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
vi.mock('@/modules/models/fetchJson', () => ({ fetchJsonStrict: api.fetchJsonStrict }));
vi.mock('@/lib/clipboard', () => ({ copyTextToClipboard: () => Promise.resolve(true) }));

import { MetricsModulePage } from './MetricsModulePage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

async function waitFor(cond: () => boolean, label = 'condition'): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

async function render(entry: string, page: ReactNode): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<MemoryRouter initialEntries={[entry]}>{page}</MemoryRouter>);
  });
}

const text = (): string => document.body.textContent ?? '';
const urls = (): string[] => api.fetchJsonStrict.mock.calls.map((call) => String(call[0]));
const settled = (): boolean => document.querySelector('.met5-skeleton') === null;

function activityBody(): Record<string, unknown> {
  const cells: { dow: number; hour: number; count: number }[] = [];
  for (let dow = 1; dow <= 7; dow += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      if (dow === 2 && hour === 3) continue; // absent — never returned
      const count = dow === 1 && hour === 0 ? 0 : (dow * 7 + hour) % 5;
      cells.push({ dow, hour, count });
    }
  }
  return {
    cells,
    max: 4,
    from: '2026-11-12T16:00:00Z',
    to: '2026-11-19T15:59:59Z',
    tz: 'Asia/Shanghai',
  };
}

async function mount(handler: (url: string) => Promise<unknown>, entry = '/metrics'): Promise<void> {
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation(handler);
  await render(entry, <MetricsModulePage />);
  await waitFor(settled, 'state settled');
}

beforeEach(() => {
  window.history.replaceState({}, '', '/');
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

describe('MetricsModulePage', () => {
  it('reads the activity endpoint for the selected window and draws 168 cells', async () => {
    await mount(() => Promise.resolve(activityBody()));
    expect(urls()).toEqual(['/agent-api/api/run-activity?weeks=1&tz=Asia/Shanghai']);
    expect(document.querySelectorAll('[data-testid^="met5-cell-"]')).toHaveLength(168);
    expect(document.querySelector('[data-testid="met5-page"]')?.getAttribute('data-fixture')).toBeNull();
    expect(text()).toContain('运行分析');
    expect(text()).toContain('来源：运行活动热力');
    expect(text()).toContain('窗口总运行');
    expect(text()).toContain('峰值格');
  });

  it('keeps an explicit zero and an absent cell visibly different', async () => {
    await mount(() => Promise.resolve(activityBody()));
    const zero = document.querySelector('[data-testid="met5-cell-1-0"]') as HTMLButtonElement;
    const missing = document.querySelector('[data-testid="met5-cell-2-3"]') as HTMLButtonElement;
    expect(zero.className).toContain('is-zero');
    expect(missing.className).toContain('is-missing');
    expect(zero.getAttribute('title')).toContain('0 次');
    expect(missing.getAttribute('title')).toContain('接口未返回');
    expect(text()).toContain('0 次');
    expect(text()).toContain('接口未返回（—）');

    await act(async () => {
      zero.click();
    });
    expect(document.querySelector('[data-testid="met5-selected"]')?.textContent).toContain('0 次');
    expect(document.querySelector('[data-testid="met5-selected"]')?.textContent).toContain('（北京时间）');

    await act(async () => {
      missing.click();
    });
    expect(document.querySelector('[data-testid="met5-selected"]')?.textContent).toContain('不能当作 0');
  });

  it('switches the real window and asks for four weeks', async () => {
    await mount(() => Promise.resolve(activityBody()));
    const four = document.querySelector('[data-testid="met5-window-4"]') as HTMLButtonElement;
    expect(four).toBeTruthy();
    await act(async () => {
      four.click();
    });
    await waitFor(() => urls().some((url) => url.includes('weeks=4')), 'weeks=4 request');
    expect(urls()).toContain('/agent-api/api/run-activity?weeks=4&tz=Asia/Shanghai');
    expect(text()).toContain('最近 4 周');
  });

  it('states that the activity endpoint is not connected instead of drawing an empty 0 grid', async () => {
    await mount((url) => Promise.reject(new ApiError('missing', { status: 404, body: '', url })));
    expect(text()).toContain('这项数据还没有接入');
    expect(document.querySelector('[data-testid="met5-error"] p[title]')?.getAttribute('title')).toContain('GAP-MET5-01');
    expect(text()).not.toContain('GAP-');
    expect(text()).not.toContain('404');
    expect(document.querySelector('[data-testid="met5-empty"]')).toBeNull();
    expect(document.querySelector('[data-testid="met5-error"]')).toBeTruthy();
  });

  it('keeps a human error, a copyable request number and a working retry on failure', async () => {
    let calls = 0;
    await mount((url) => {
      calls += 1;
      if (calls === 1) return Promise.reject(new ApiError('down', { status: 503, body: '', url, requestId: 'req-met-7' }));
      return Promise.resolve(activityBody());
    });
    expect(text()).toContain('这次没能读取运行活动');
    expect(text()).toContain('req-met-7');
    expect(text()).toContain('请求编号：');
    expect(text()).not.toContain('503');
    expect(text()).not.toContain('HTTP');
    const copy = document.querySelector('[aria-label="复制请求编号"]') as HTMLButtonElement;
    expect(copy).toBeTruthy();
    await act(async () => {
      copy.click();
    });
    expect(text()).toContain('已复制');
    await act(async () => {
      (document.querySelector('[data-testid="met5-retry"]') as HTMLButtonElement).click();
    });
    await waitFor(() => document.querySelectorAll('[data-testid^="met5-cell-"]').length === 168, 'retry grid');
  });

  it('labels a forced preview and does not issue a request', async () => {
    await mount(() => Promise.resolve(activityBody()), '/metrics?state=error');
    expect(text()).toContain('预览状态');
    expect(urls()).toEqual([]);
    expect(document.querySelector('[data-testid="met5-page"]')?.getAttribute('data-fixture')).toBe('1');
    expect(document.querySelector('[data-testid="met5-error"]')).toBeTruthy();
  });

  it('keeps engineering language off the page', async () => {
    await mount(() => Promise.resolve(activityBody()));
    for (const token of ['/api', 'run-activity', 'HTTP', 'dow', 'hour', 'count', 'ISO', 'GAP-']) {
      expect(text()).not.toContain(token);
    }
  });
});