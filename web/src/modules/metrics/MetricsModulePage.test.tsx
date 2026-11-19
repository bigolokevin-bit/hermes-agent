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
    expect(urls()).toContain('/agent-api/api/run-activity?weeks=1&tz=Asia/Shanghai');
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
    expect(document.querySelector('[data-testid="met5-page"]')?.getAttribute('data-fixture')).toBeNull();
    expect(document.querySelector('[data-testid="met5-error"]')).toBeTruthy();
  });

  it('keeps engineering language off the page', async () => {
    await mount(() => Promise.resolve(activityBody()));
    for (const token of ['/api', 'run-activity', 'HTTP', 'dow', 'hour', 'count', 'ISO', 'GAP-']) {
      expect(text()).not.toContain(token);
    }
  });
});
// ---- met6: usage & cost -----------------------------------------------------
// The claims that matter: run counts and the success rate come from one read,
// money only from the ledger (a real 0 is $0.00, no row is «—»), the 24h spark
// only draws hours the endpoint returned, and 403/404 are byte-identical.

const RUN_TOTALS = {
  runs: 13,
  succeeded: 12,
  failed: 0,
  cancelled: 0,
  interrupted: 0,
  running: 1,
  pending: 0,
  costUsd: 0.12,
  unknownRuns: 0,
  sampleCount: 12,
  successRate: 0.9967,
};

const TODAY_STATS = {
  from: '2026-11-18T16:00:00.000Z',
  to: '2026-11-19T12:00:00.000Z',
  bucket: 'day',
  buckets: [{ bucketStart: '2026-11-19T00:00:00.000Z', runs: 13, succeeded: 12, failed: 0 }],
  totals: RUN_TOTALS,
};

const TREND_STATS = {
  from: '2026-11-18T12:00:00.000Z',
  to: '2026-11-19T12:00:00.000Z',
  bucket: 'hour',
  buckets: [
    { bucketStart: '2026-11-18T18:00:00.000Z', runs: 4 },
    { bucketStart: '2026-11-19T02:00:00.000Z', runs: 9 },
  ],
  totals: RUN_TOTALS,
};

const EMPLOYEE_BODY = { items: [{ employeeId: 'emp_a' }, { employeeId: 'emp_b' }], nextCursor: null };

const LEDGER_DAY = {
  items: [
    {
      employeeId: 'emp_a',
      period: '2026-11-19',
      periodKind: 'day',
      tokensUsed: 148176,
      costUsd: 0,
      reserved: 0,
      updatedAt: '2026-11-19T03:20:00.000Z',
    },
  ],
  missingEmployeeIds: ['emp_b'],
};

const LEDGER_MONTH = {
  items: [
    { employeeId: 'emp_a', period: '2026-11', periodKind: 'month', costUsd: 0.121198, updatedAt: '2026-11-14T19:25:51.543Z' },
    { employeeId: 'emp_b', period: '2026-11', periodKind: 'month', costUsd: 0.011498, updatedAt: '2026-11-13T06:41:33.974Z' },
  ],
  missingEmployeeIds: [],
};

function usageRouter(overrides: { ledger?: (url: string) => Promise<unknown> } = {}) {
  return (url: string): Promise<unknown> => {
    if (overrides.ledger && url.includes('budget-usage')) return overrides.ledger(url);
    if (url.includes('run-activity')) return Promise.resolve(activityBody());
    if (url.includes('run-stats')) return Promise.resolve(url.includes('bucket=hour') ? TREND_STATS : TODAY_STATS);
    if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEE_BODY);
    if (url.includes('periodKind=month')) return Promise.resolve(LEDGER_MONTH);
    if (url.includes('periodKind=day')) return Promise.resolve(LEDGER_DAY);
    return Promise.resolve({});
  };
}

describe('MetricsModulePage — usage & cost (met6)', () => {
  it('renders run counts, the rate and ledger money from their own reads', async () => {
    await mount(usageRouter());

    expect(document.querySelector('[data-testid="met6-runs-value"]')?.textContent).toBe('13');
    expect(document.querySelector('[data-testid="met6-rate-value"]')?.textContent).toBe('99.7%');
    // A ledger row that says 0 is a real zero.
    expect(document.querySelector('[data-testid="met6-cost-value"]')?.textContent).toBe('$0.00');
    // Month total = the two ledger rows that exist.
    expect(document.querySelector('[data-testid="met6-cost-month"]')?.textContent).toBe('$0.13');
    expect(document.querySelectorAll('[data-testid="met6-sparkline"] rect')).toHaveLength(2);

    const called = urls();
    expect(called.some((url) => url.includes('/api/run-stats?') && url.includes('bucket=day'))).toBe(true);
    expect(called.some((url) => url.includes('/api/run-stats?') && url.includes('bucket=hour'))).toBe(true);
    expect(called.some((url) => url.includes('/api/employees?limit=200'))).toBe(true);
    expect(called.some((url) => url.includes('budget-usage') && url.includes('employeeId=emp_a,emp_b'))).toBe(true);
    expect(called.some((url) => url.includes('periodKind=day'))).toBe(true);

    // The fixture marker is gone for good.
    expect(document.querySelector('[data-testid="met5-page"]')?.getAttribute('data-fixture')).toBeNull();
  });

  it('shows — with a reason when the ledger has no row for the period', async () => {
    await mount(
      usageRouter({
        ledger: (url) =>
          Promise.resolve(
            url.includes('periodKind=month')
              ? { items: [], missingEmployeeIds: [] }
              : { items: [], missingEmployeeIds: ['emp_a', 'emp_b'] },
          ),
      }),
    );

    expect(document.querySelector('[data-testid="met6-cost-value"]')?.textContent).toBe('—');
    expect(document.querySelector('[data-testid="met6-cost-month"]')?.textContent).toBe('—');
    expect(text()).toContain('今天还没有账本实扣记录');
    expect(text()).not.toContain('$0.00');
    expect(document.querySelector('[data-testid="met6-runs-value"]')?.textContent).toBe('13');
  });

  it('gives 403 and 404 the same block copy', async () => {
    const run = async (status: number): Promise<string> => {
      await mount((url) => {
        if (url.includes('run-activity')) return Promise.resolve(activityBody());
        if (url.includes('run-stats') || url.includes('/api/employees')) {
          return Promise.reject(new ApiError('denied', { status, body: '', url, requestId: 'req-same' }));
        }
        return Promise.resolve(LEDGER_DAY);
      });
      return document.querySelector('[data-testid="met6-section"]')?.textContent ?? '';
    };

    const fourOhFour = await run(404);
    const fourOhThree = await run(403);
    expect(fourOhFour).toBe(fourOhThree);
    expect(fourOhFour).toContain('这项数据当前读不到');
    expect(fourOhFour).not.toContain('404');
    expect(fourOhFour).not.toContain('GAP-');
  });

  it('says there is no trend when the 24h window returned no buckets', async () => {
    // The router answers run-stats with data; force the empty 24h body instead.
    await mount((url) => {
      if (url.includes('run-activity')) return Promise.resolve(activityBody());
      if (url.includes('bucket=hour')) {
        return Promise.resolve({ ...TREND_STATS, buckets: [], totals: { ...RUN_TOTALS, runs: 0 } });
      }
      if (url.includes('run-stats')) return Promise.resolve(TODAY_STATS);
      if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEE_BODY);
      if (url.includes('periodKind=month')) return Promise.resolve(LEDGER_MONTH);
      return Promise.resolve(LEDGER_DAY);
    });

    expect(document.querySelector('[data-testid="met6-sparkline"]')).toBeNull();
    expect(document.querySelector('[data-testid="met6-trend-value"]')?.textContent).toBe('没有运行');
    expect(text()).toContain('最近 24 小时没有运行记录');
  });

  it('keeps engineering language and raw amounts out of the visible copy', async () => {
    await mount(usageRouter());
    const section = document.querySelector('[data-testid="met6-section"]')?.textContent ?? '';
    for (const token of ['/api', 'run-stats', 'budget-usage', 'HTTP', 'ISO', 'GAP-', 'tokensUsed', 'emp_']) {
      expect(section).not.toContain(token);
    }
  });
});
