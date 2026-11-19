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
// ---- met6: usage & cost (window switching, ledger money, unit price) -------
// The claims that matter: `?window=` really changes the request and the
// numbers, money only comes from the ledger (a real 0 is $0.00, no row is «—»),
// unit price is a separate source, and 403/404 are byte-identical.

const STATS_24H = {
  from: '2026-11-18T16:00:00.000Z',
  to: '2026-11-19T16:00:00.000Z',
  bucket: 'hour',
  buckets: [],
  totals: { runs: 0, succeeded: 0, failed: 0, running: 0, sampleCount: 0, successRate: null },
};

const STATS_7D = {
  from: '2026-11-12T16:00:00.000Z',
  to: '2026-11-19T16:00:00.000Z',
  bucket: 'day',
  buckets: [{ bucketStart: '2026-11-14T00:00:00.000Z', runs: 13 }],
  totals: { runs: 13, succeeded: 12, failed: 0, running: 1, sampleCount: 12, successRate: 1 },
};

const STATS_30D = {
  from: '2026-10-20T16:00:00.000Z',
  to: '2026-11-19T16:00:00.000Z',
  bucket: 'day',
  buckets: [
    { bucketStart: '2026-11-13T00:00:00.000Z', runs: 1 },
    { bucketStart: '2026-11-14T00:00:00.000Z', runs: 13 },
  ],
  totals: { runs: 14, succeeded: 13, failed: 0, running: 1, sampleCount: 13, successRate: 1 },
};

const EMPLOYEE_BODY = {
  items: [
    { employeeId: 'emp_aaaabbbbcccc', name: '小鲤' },
    { employeeId: 'emp_ddddeeeeffff', name: '小满' },
  ],
  nextCursor: null,
};

const LEDGER_DAY = {
  items: [
    {
      employeeId: 'emp_aaaabbbbcccc',
      period: '2026-11-19',
      periodKind: 'day',
      tokensUsed: 148176,
      costUsd: 0,
      reserved: 0,
      updatedAt: '2026-11-19T03:20:00.000Z',
    },
  ],
  missingEmployeeIds: ['emp_ddddeeeeffff'],
};

const LEDGER_MONTH = {
  items: [
    { employeeId: 'emp_aaaabbbbcccc', period: '2026-11', periodKind: 'month', costUsd: 0.121198, updatedAt: '2026-11-14T19:25:51.543Z' },
    { employeeId: 'emp_ddddeeeeffff', period: '2026-11', periodKind: 'month', costUsd: 0.011498, updatedAt: '2026-11-13T06:41:33.974Z' },
  ],
  missingEmployeeIds: [],
};

function statsFor(url: string): unknown {
  const from = new URL(url, 'http://local').searchParams.get('from');
  const hours = from ? (Date.now() - Date.parse(from)) / 3_600_000 : 0;
  if (hours <= 25) return STATS_24H;
  if (hours >= 600) return STATS_30D;
  return STATS_7D;
}

function usageRouter(
  overrides: { ledger?: (url: string) => Promise<unknown>; pricing?: () => Promise<unknown> } = {},
) {
  return (url: string): Promise<unknown> => {
    if (overrides.pricing && url.includes('models/pricing')) return overrides.pricing();
    if (overrides.ledger && url.includes('budget-usage')) return overrides.ledger(url);
    if (url.includes('run-activity')) return Promise.resolve(activityBody());
    if (url.includes('run-stats')) return Promise.resolve(statsFor(url));
    if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEE_BODY);
    if (url.includes('models/pricing')) {
      return Promise.reject(new ApiError('missing', { status: 404, body: '', url }));
    }
    if (url.includes('periodKind=month')) return Promise.resolve(LEDGER_MONTH);
    if (url.includes('periodKind=day')) return Promise.resolve(LEDGER_DAY);
    return Promise.resolve({});
  };
}

describe('MetricsModulePage — usage & cost (met6)', () => {
  it('reads the 24h window by default and keeps price and money apart', async () => {
    await mount(usageRouter());

    expect(document.querySelector('[data-testid="met6-runs-value"]')?.textContent).toBe('0');
    expect(document.querySelector('[data-testid="met6-rate-value"]')?.textContent).toBe('—');
    expect(document.querySelector('[data-testid="met6-trend-value"]')?.textContent).toBe('没有运行');
    // Ledger row with costUsd 0 is a real zero; month sums the two rows.
    expect(document.querySelector('[data-testid="met6-cost-value"]')?.textContent).toBe('$0.00');
    expect(document.querySelector('[data-testid="met6-cost-month"]')?.textContent).toBe('$0.13');
    expect(document.querySelectorAll('[data-testid="met6-cost-rows"] li')).toHaveLength(2);
    expect(document.querySelector('[data-testid="met6-cost-rows"]')?.textContent).toContain('小鲤 · AAAABBBB');
    // Unit price is its own source and is not connected here.
    expect(document.querySelector('[data-testid="met6-price-value"]')?.textContent).toBe('—');
    expect(document.querySelector('[data-testid="met6-price-gap"]')?.textContent).toContain('这项数据当前读不到');

    const called = urls();
    const statsCall = called.find((url) => url.includes('run-stats')) ?? '';
    expect(statsCall).toContain('bucket=hour');
    expect(statsCall).toContain('from=');
    expect(statsCall).toContain('to=');
    expect(called.some((url) => url.includes('budget-usage') && url.includes('periodKind=day'))).toBe(true);
    expect(called.some((url) => url.includes('budget-usage') && url.includes('periodKind=month'))).toBe(true);
    expect(document.querySelector('[data-testid="met5-page"]')?.getAttribute('data-fixture')).toBeNull();
  });

  it('really switches windows: 7d and 30d issue their own request and numbers', async () => {
    await mount(usageRouter());

    await act(async () => {
      (document.querySelector('[data-testid="met6-window-7d"]') as HTMLButtonElement).click();
    });
    await waitFor(() => document.querySelector('[data-testid="met6-runs-value"]')?.textContent === '13', '7d runs');
    const sevenDayUrl = urls().filter((url) => url.includes('run-stats')).at(-1) ?? '';
    expect(sevenDayUrl).toContain('bucket=day');
    const sevenFrom = new Date(
      new URL(sevenDayUrl, 'http://local').searchParams.get('from') as string,
    ).getTime();
    expect(Math.round((Date.now() - sevenFrom) / 3_600_000)).toBeGreaterThanOrEqual(167);
    expect(document.querySelectorAll('[data-testid="met6-sparkline"] rect')).toHaveLength(1);
    expect(document.querySelector('[data-testid="met6-rate-value"]')?.textContent).toBe('100%');

    await act(async () => {
      (document.querySelector('[data-testid="met6-window-30d"]') as HTMLButtonElement).click();
    });
    await waitFor(() => document.querySelector('[data-testid="met6-runs-value"]')?.textContent === '14', '30d runs');
    const monthUrl = urls().filter((url) => url.includes('run-stats')).at(-1) ?? '';
    const monthFrom = new Date(
      new URL(monthUrl, 'http://local').searchParams.get('from') as string,
    ).getTime();
    expect(Math.round((Date.now() - monthFrom) / 3_600_000)).toBeGreaterThanOrEqual(719);
    expect(document.querySelectorAll('[data-testid="met6-sparkline"] rect')).toHaveLength(2);
  });

  it('shows — with a reason when the ledger has no row for the period', async () => {
    await mount(
      usageRouter({
        ledger: (url) =>
          Promise.resolve(
            url.includes('periodKind=month')
              ? { items: [], missingEmployeeIds: [] }
              : { items: [], missingEmployeeIds: ['emp_aaaabbbbcccc'] },
          ),
      }),
    );

    expect(document.querySelector('[data-testid="met6-cost-value"]')?.textContent).toBe('—');
    expect(document.querySelector('[data-testid="met6-cost-month"]')?.textContent).toBe('—');
    expect(text()).toContain('今天还没有账本实扣记录');
    expect(text()).not.toContain('$0.00');
    expect(document.querySelector('[data-testid="met6-cost-rows"]')).toBeNull();
  });

  it('gives 403 and 404 the same block copy', async () => {
    const run = async (status: number): Promise<string> => {
      await mount((url) => {
        if (url.includes('run-activity')) return Promise.resolve(activityBody());
        if (url.includes('run-stats') || url.includes('/api/employees') || url.includes('models/pricing')) {
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

  it('renders the four preview states without issuing a request', async () => {
    api.fetchJsonStrict.mockReset();
    api.fetchJsonStrict.mockImplementation(() => Promise.resolve({}));

    await render('/metrics?state=loading', <MetricsModulePage />);
    expect(document.querySelector('[data-testid="met6-loading"]')).toBeTruthy();

    await render('/metrics?state=empty', <MetricsModulePage />);
    expect(document.querySelector('[data-testid="met6-empty"]')).toBeTruthy();

    await render('/metrics?state=error', <MetricsModulePage />);
    expect(document.querySelector('[data-testid="met6-error"]')).toBeTruthy();

    await render('/metrics?state=denied', <MetricsModulePage />);
    expect(document.querySelector('[data-testid="met6-denied"]')).toBeTruthy();

    expect(urls()).toEqual([]);
  });

  it('keeps engineering language and raw ids out of the visible copy', async () => {
    await mount(usageRouter());
    const section = document.querySelector('[data-testid="met6-section"]')?.textContent ?? '';
    for (const token of ['/api', 'run-stats', 'budget-usage', 'models/pricing', 'HTTP', 'ISO', 'GAP-', 'tokensUsed', 'emp_']) {
      expect(section).not.toContain(token);
    }
    expect(section).not.toContain('?? 0');
  });
});

// ---- met6: cost breakdown (by employee / by model) -------------------------

const DAY_SPLIT = {
  items: [
    { employeeId: 'emp_aaaabbbbcccc', period: '2026-11-19', periodKind: 'day', costUsd: 0.3, updatedAt: '2026-11-19T03:20:00.000Z' },
    { employeeId: 'emp_ddddeeeeffff', period: '2026-11-19', periodKind: 'day', costUsd: 0.1, updatedAt: '2026-11-19T02:00:00.000Z' },
  ],
  missingEmployeeIds: [],
};

const HERMES_USAGE = {
  by_model: [
    { model: 'qwen-plus', input_tokens: 1000, output_tokens: 200, sessions: 3, api_calls: 9 },
    { model: 'deepseek-v4', input_tokens: 500, output_tokens: 50 },
  ],
  cost: { source: 'cost_ledger', cost_usd: null, cost_status: 'unknown', rows: 0, per_employee: [] },
  asOf: '2026-11-19T20:12:00.000Z',
};

function breakdownRouter(
  overrides: { ledger?: (url: string) => Promise<unknown>; usage?: () => Promise<unknown> } = {},
) {
  return (url: string): Promise<unknown> => {
    if (overrides.usage && url.includes('hermes-usage')) return overrides.usage();
    if (overrides.ledger && url.includes('budget-usage')) return overrides.ledger(url);
    if (url.includes('run-activity')) return Promise.resolve(activityBody());
    if (url.includes('run-stats')) return Promise.resolve(statsFor(url));
    if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEE_BODY);
    if (url.includes('models/pricing')) return Promise.reject(new ApiError('missing', { status: 404, body: '', url }));
    if (url.includes('hermes-usage')) return Promise.resolve(HERMES_USAGE);
    if (url.includes('budget-usage')) return Promise.resolve(DAY_SPLIT);
    return Promise.resolve({});
  };
}

describe('MetricsModulePage — cost breakdown', () => {
  it('lists employees from the ledger with spend, a — count and a share', async () => {
    await mount(breakdownRouter());

    const rows = document.querySelectorAll('[data-testid^="met6-row-"]');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('小鲤 · AAAABBBB');
    expect(rows[0]?.textContent).toContain('$0.30');
    expect(rows[0]?.textContent).toContain('75%');
    expect(rows[1]?.textContent).toContain('$0.10');
    expect(rows[1]?.textContent).toContain('25%');
    // The ledger does not carry run counts: — with its reason, never 0.
    expect(rows[0]?.textContent).toContain('—');
    expect(rows[0]?.textContent).toContain('不记运行次数');
    expect(document.querySelector('[data-testid="met6-cat-total"]')?.textContent).toBe('$0.40');
    expect(document.querySelector('[data-testid="met6-cat-source"]')?.textContent).toContain('平台扣费账本');
    expect(document.querySelector('[data-testid="met6-cat-source"]')?.textContent).toContain('2026-11-19 11:20');
  });

  it('switches to the by-model view and keeps money at — when upstream omits it', async () => {
    await mount(breakdownRouter());

    await act(async () => {
      (document.querySelector('[data-testid="met6-cat-model"]') as HTMLButtonElement).click();
    });
    await waitFor(
      () => document.querySelector('[data-testid="met6-cat-source"]')?.textContent?.includes('Hermes 用量') === true,
      'model view',
    );

    const rows = document.querySelectorAll('[data-testid^="met6-row-"]');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('qwen-plus');
    expect(rows[0]?.textContent).toContain('9');
    expect(rows[1]?.textContent).toContain('上游没有给调用次数');
    // Per-model money is stripped upstream: — for both rows and the total.
    expect(document.querySelector('[data-testid="met6-cat-total"]')?.textContent).toBe('—');
    expect(text()).toContain('金额不按模型拆分');
  });

  it('replays window and view from the URL without losing state', async () => {
    await mount(breakdownRouter(), '/metrics?window=7d&view=model');

    expect(urls().some((url) => url.includes('hermes-usage?days=7'))).toBe(true);
    expect(
      (document.querySelector('[data-testid="met6-window-7d"]') as HTMLButtonElement).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      (document.querySelector('[data-testid="met6-cat-model"]') as HTMLButtonElement).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(document.querySelector('[data-testid="met6-cat-source"]')?.textContent).toContain('Hermes 用量');
  });

  it('gives 403 and 404 the same breakdown copy', async () => {
    const run = async (status: number): Promise<string> => {
      await mount(
        breakdownRouter({
          ledger: (url) => Promise.reject(new ApiError('denied', { status, body: '', url, requestId: 'req-same' })),
        }),
      );
      return document.querySelector('[data-testid="met6-cat"]')?.textContent ?? '';
    };

    const fourOhFour = await run(404);
    const fourOhThree = await run(403);
    expect(fourOhFour).toBe(fourOhThree);
    expect(fourOhFour).toContain('这份成本明细暂时读不到');
    expect(fourOhFour).not.toContain('404');
  });

  it('shows a real zero share instead of inventing one', async () => {
    await mount(
      breakdownRouter({
        ledger: () =>
          Promise.resolve({
            items: [
              { employeeId: 'emp_aaaabbbbcccc', period: '2026-11-19', periodKind: 'day', costUsd: 0, updatedAt: '2026-11-19T03:20:00.000Z' },
            ],
            missingEmployeeIds: [],
          }),
      }),
    );
    const row = document.querySelector('[data-testid="met6-row-0"]');
    expect(row?.textContent).toContain('$0.00');
    // Share of a zero total is undefined, not 0%.
    expect(row?.textContent).toContain('—');
  });
});

// ---- met6: CSV export + period-over-period delta ---------------------------

describe('MetricsModulePage — export and delta', () => {
  it('exports exactly the rows on screen with empty cells for missing values', async () => {
    const captured: { blob: Blob | null; name: string | null } = { blob: null, name: null };
    const createObjectURL = vi.fn((blob: Blob) => {
      captured.blob = blob;
      return 'blob:metrics';
    });
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      captured.name = this.download;
    });

    await mount(breakdownRouter());
    await act(async () => {
      (document.querySelector('[data-testid="met6-export"]') as HTMLButtonElement).click();
    });

    expect(click).toHaveBeenCalledTimes(1);
    expect(captured.name).toMatch(/^metrics-employee-24h-\d{8}-\d{4}\.csv$/);
    const text = await (captured.blob as Blob).text();
    const lines = text.replace(/^\uFEFF/, '').split('\r\n');
    expect(lines[0]).toBe('员工,支出USD,次数,占比%,账本截至,窗口,窗口开始,窗口结束');
    // Two ledger rows on screen → header + two data rows.
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('小鲤 · AAAABBBB');
    expect(lines[1]).toContain('0.30');
    expect(lines[1]).toContain('75');
    // The ledger has no run counts: an empty cell, never 0.
    expect(lines[1].split(',')[2]).toBe('');
    click.mockRestore();
  });

  it('uses the model header set and disables export when nothing is on screen', async () => {
    await mount(breakdownRouter(), '/metrics?view=model');
    expect(document.querySelector('[data-testid="met6-export"]')).toBeTruthy();

    await mount(
      breakdownRouter({
        ledger: () => Promise.resolve({ items: [], missingEmployeeIds: [] }),
      }),
    );
    const button = document.querySelector('[data-testid="met6-export"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('title')).toContain('当前没有可导出的行');
  });

  it('shows a signed delta per window and keeps a real zero distinct from missing', async () => {
    await mount((url) => {
      if (url.includes('run-activity')) return Promise.resolve(activityBody());
      if (url.includes('run-stats')) {
        const from = new URL(url, 'http://local').searchParams.get('from');
        const hours = from ? (Date.now() - Date.parse(from)) / 3_600_000 : 0;
        if (hours < 25) return Promise.resolve(STATS_24H);
        if (hours < 49) return Promise.resolve({ ...STATS_24H, totals: { ...STATS_24H.totals, runs: 5 } });
        if (hours < 200) return Promise.resolve(STATS_7D);
        return Promise.resolve(STATS_30D);
      }
      if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEE_BODY);
      if (url.includes('models/pricing')) return Promise.reject(new ApiError('missing', { status: 404, body: '', url }));
      if (url.includes('budget-usage')) return Promise.resolve(DAY_SPLIT);
      return Promise.resolve({});
    });

    await waitFor(
      () => (document.querySelector('[data-testid="met6-delta-runs"]')?.textContent ?? '').includes('-5'),
      'runs delta',
    );
    expect(document.querySelector('[data-testid="met6-delta-runs"]')?.textContent).toContain('-5');
    // Same ledger on both periods → a real ±$0.00, not «—».
    await waitFor(
      () => (document.querySelector('[data-testid="met6-delta-cost"]')?.textContent ?? '').includes('±$0.00'),
      'cost delta',
    );
    expect(document.querySelector('[data-testid="met6-delta-cost"]')?.textContent).toContain('±$0.00');
  });

  it('says — with a reason when the previous period cannot be compared', async () => {
    await mount((url) => {
      if (url.includes('run-activity')) return Promise.resolve(activityBody());
      if (url.includes('run-stats')) {
        const from = new URL(url, 'http://local').searchParams.get('from');
        const hours = from ? (Date.now() - Date.parse(from)) / 3_600_000 : 0;
        if (hours >= 25) return Promise.reject(new ApiError('missing', { status: 404, body: '', url }));
        return Promise.resolve(STATS_24H);
      }
      if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEE_BODY);
      if (url.includes('models/pricing')) return Promise.reject(new ApiError('missing', { status: 404, body: '', url }));
      if (url.includes('budget-usage')) return Promise.resolve(DAY_SPLIT);
      return Promise.resolve({});
    });

    const delta = document.querySelector('[data-testid="met6-delta-runs"]');
    expect(delta?.textContent).toContain('—');
    expect(delta?.getAttribute('title')).toContain('上一周期没有可比的运行数');
  });
});

// ---- met6: budget vs actual -------------------------------------------------

describe('MetricsModulePage — budget vs actual', () => {
  it('lists ledger spend per employee and keeps cap-derived cells at —', async () => {
    await mount(breakdownRouter());
    const row = document.querySelector('[data-testid="met6-budget-row-0"]');
    expect(row?.textContent).toContain('小鲤 · AAAABBBB');
    expect(row?.textContent).toContain('$0.30');
    // No cap in the ledger → budget, remaining and usage are «—» with a title reason.
    expect(document.querySelectorAll('[data-testid="met6-budget-table"] tbody tr')).toHaveLength(2);
    expect(row?.querySelectorAll('td')[1].textContent).toBe('—');
    expect(row?.querySelectorAll('td')[3].textContent).toBe('—');
    expect(row?.querySelectorAll('td')[4].textContent).toBe('—');
    expect(row?.querySelectorAll('td')[1].getAttribute('title')).toContain('账本没有给出预算上限');
    expect(document.querySelector('[data-testid="met6-budget-total"]')?.textContent).toBe('$0.40');
    expect(document.querySelector('[data-testid="met6-budget-source"]')?.textContent).toContain('平台扣费账本');
  });

  it('colours a cap when the row carries one', async () => {
    await mount(
      breakdownRouter({
        ledger: (url) =>
          Promise.resolve(
            url.includes('periodKind=month')
              ? {
                  items: [
                    { employeeId: 'emp_aaaabbbbcccc', period: '2026-11', periodKind: 'month', costUsd: 0.12, limitUsd: 0.1, updatedAt: '2026-11-14T19:25:51.543Z' },
                    { employeeId: 'emp_ddddeeeeffff', period: '2026-11', periodKind: 'month', costUsd: 0.085, limitUsd: 0.1, updatedAt: '2026-11-13T06:41:33.974Z' },
                  ],
                  missingEmployeeIds: [],
                }
              : { items: [], missingEmployeeIds: [] },
          ),
      }),
    );

    const first = document.querySelector('[data-testid="met6-budget-row-0"]');
    const second = document.querySelector('[data-testid="met6-budget-row-1"]');
    expect(first?.textContent).toContain('120%');
    expect(first?.querySelectorAll('td')[4].className).toContain('is-over');
    expect(second?.textContent).toContain('85%');
    expect(second?.querySelectorAll('td')[4].className).toContain('is-warn');
    expect(first?.querySelectorAll('td')[3].textContent).toBe('-$0.02');
  });

  it('says the budget read is not connected instead of drawing zeros', async () => {
    await mount(
      breakdownRouter({
        ledger: (url) =>
          Promise.resolve(
            url.includes('periodKind=month')
              ? { items: [], missingEmployeeIds: [] }
              : { items: [], missingEmployeeIds: [] },
          ),
      }),
    );
    const empty = document.querySelector('[data-testid="met6-budget-empty"]');
    expect(empty?.textContent).toContain('预算读口未接入');
    expect(empty?.textContent).not.toContain('$0.00');
    expect(document.querySelector('[data-testid="met6-budget-table"]')).toBeNull();
    expect(empty?.querySelector('p[title]')?.getAttribute('title')).toContain('GAP-MET6-01');
  });
});
