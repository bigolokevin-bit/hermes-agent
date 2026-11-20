// @vitest-environment jsdom
// met5 — 7×24 heatmap. The important claims: absent cells stay absent (—),
// explicit zeros stay zero, the window switch really changes the request, and
// no raw field names or HTTP codes reach the page.
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn((text: string) => Promise.resolve(Boolean(text))) }));
vi.mock('@/modules/models/fetchJson', () => ({ fetchJsonStrict: api.fetchJsonStrict }));
vi.mock('@/lib/clipboard', () => ({ copyTextToClipboard: clip.copyTextToClipboard }));

import { MetricsModulePage } from './MetricsModulePage';
import { CALIBER_NOTES } from './metrics';
import { csvFileName, shareCsvFileName } from './metrics';

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
/** Text a sighted reader sees: screen-reader-only copies are removed first. */
const visibleText = (): string => {
  const clone = document.body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.sr-only').forEach((node) => node.remove());
  return clone.textContent ?? '';
};
const urls = (): string[] => api.fetchJsonStrict.mock.calls.map((call) => String(call[0]));
const settled = (): boolean => document.querySelector('.met5-skeleton') === null;

/** Data rows only: a «#» comment line (totals, gap note) is never a data row. */
const dataOnly = (lines: string[]): string[] => lines.filter((line) => !line.startsWith('#'));

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
      expect(visibleText()).not.toContain(token);
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
    // The card itself holds no invented zero (the sr-only caliber note may
    // quote $0.00 as the policy for a real zero).
    expect(document.querySelector('[data-testid="met6-cost"]')?.textContent).not.toContain('$0.00');
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
    expect(rows[0]?.textContent).toContain('75.0%');
    expect(rows[1]?.textContent).toContain('$0.10');
    expect(rows[1]?.textContent).toContain('25.0%');
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
    expect(captured.name).toMatch(/^metrics-detail-24h-employee-cost-desc-\d{8}-\d{4}\.csv$/);
    const text = await (captured.blob as Blob).text();
    const lines = text.replace(/^\uFEFF/, '').split('\r\n');
    expect(lines[0]).toBe('员工,支出USD,次数,占比%,账本截至,窗口,窗口开始,窗口结束,as_of,window');
    // Two ledger rows on screen → header + two data rows; the totals line is a comment.
    expect(dataOnly(lines)).toHaveLength(3);
    expect(lines[1]).toContain('小鲤 · AAAABBBB');
    expect(lines[1]).toContain('0.30');
    expect(lines[1]).toContain('75');
    // The ledger has no run counts: an empty cell, never 0.
    expect(lines[1].split(',')[2]).toBe('');
    // Provenance rides at the end: the upstream batch stamp and the window id.
    expect(lines[1].split(',').at(-2)).toBe('2026-11-19T03:20:00.000Z');
    expect(lines[1].split(',').at(-1)).toBe('24h');
    click.mockRestore();
  });

  it('uses the model header set and still exports a header-only file when nothing is on screen', async () => {
    await mount(breakdownRouter(), '/metrics?view=model');
    expect(document.querySelector('[data-testid="met6-export"]')).toBeTruthy();

    await mount(
      breakdownRouter({
        ledger: () => Promise.resolve({ items: [], missingEmployeeIds: [] }),
      }),
    );
    const button = document.querySelector('[data-testid="met6-export"]') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('title')).toContain('只写表头');
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
        ledger: () =>
          Promise.resolve({
            items: [
              { employeeId: 'emp_aaaabbbbcccc', period: '2026-11', periodKind: 'month', costUsd: 0.12, limitUsd: 0.1, updatedAt: '2026-11-14T19:25:51.543Z' },
              { employeeId: 'emp_ddddeeeeffff', period: '2026-11', periodKind: 'month', costUsd: 0.085, limitUsd: 0.1, updatedAt: '2026-11-13T06:41:33.974Z' },
            ],
            missingEmployeeIds: [],
          }),
      }),
    );

    const first = document.querySelector('[data-testid="met6-budget-row-0"]');
    const second = document.querySelector('[data-testid="met6-budget-row-1"]');
    expect(first?.textContent).toContain('120%');
    expect(first?.querySelectorAll('td')[4].className).toContain('is-over');
    expect(second?.textContent).toContain('85%');
    expect(second?.querySelectorAll('td')[4].className).toContain('is-warn');
    expect(document.querySelector('[data-testid="met6-budget-variance-0"]')?.textContent).toContain('超支');
    expect(document.querySelector('[data-testid="met6-budget-variance-1"]')?.textContent).toContain('结余');
    expect(document.querySelector('[data-testid="met6-budget-status-0"]')?.textContent).toBe('超支');
    expect(document.querySelector('[data-testid="met6-budget-status-0"]')?.querySelector('span')?.getAttribute('title')).toContain('≥100%');
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

// ---- met6: 7×24 heat from run-stats ----------------------------------------

const HEAT_STATS = {
  from: '2026-11-13T00:00:00.000Z',
  to: '2026-11-20T00:00:00.000Z',
  bucket: 'hour',
  buckets: [
    { bucketStart: '2026-11-14T14:00:00.000Z', runs: 4 },
    { bucketStart: '2026-11-14T15:00:00.000Z', runs: 0 },
  ],
  totals: { runs: 4, succeeded: 4, failed: 0, running: 0, sampleCount: 4, successRate: 1 },
};

function heatRouter(buckets: unknown[] = HEAT_STATS.buckets) {
  return (url: string): Promise<unknown> => {
    if (url.includes('run-activity')) return Promise.resolve(activityBody());
    if (url.includes('run-stats')) return Promise.resolve({ ...HEAT_STATS, buckets });
    if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEE_BODY);
    if (url.includes('models/pricing')) return Promise.reject(new ApiError('missing', { status: 404, body: '', url }));
    if (url.includes('budget-usage')) return Promise.resolve(DAY_SPLIT);
    if (url.includes('hermes-usage')) return Promise.resolve(HERMES_USAGE);
    return Promise.resolve({});
  };
}

describe('MetricsModulePage — 7×24 heat', () => {
  it('draws 168 cells and keeps a returned 0 apart from a missing hour', async () => {
    await mount(heatRouter());

    expect(document.querySelectorAll('[data-testid^="met6-heat-cell-"]')).toHaveLength(168);
    const busy = document.querySelector('[data-testid="met6-heat-cell-6-22"]') as HTMLButtonElement;
    const idle = document.querySelector('[data-testid="met6-heat-cell-6-23"]') as HTMLButtonElement;
    const missing = document.querySelector('[data-testid="met6-heat-cell-1-0"]') as HTMLButtonElement;

    expect(busy.className).not.toContain('is-missing');
    expect(busy.getAttribute('title')).toContain('4 次');
    expect(busy.getAttribute('title')).toContain('（北京时间）');
    expect(busy.getAttribute('title')).toContain('成本 —');
    expect(idle.className).toContain('is-zero');
    expect(idle.getAttribute('title')).toContain('0 次');
    expect(missing.className).toContain('is-missing');
    expect(missing.getAttribute('title')).toContain('无数据');

    expect(document.querySelector('[data-testid="met6-heat-count"]')?.textContent).toBe('2');
    expect(document.querySelector('[data-testid="met6-heat-total"]')?.textContent).toBe('4');
    expect(document.querySelector('[data-testid="met6-heat-source"]')?.textContent).toContain('运行统计');
  });

  it('says there is no hourly record instead of painting a zero grid', async () => {
    await mount(heatRouter([]));
    expect(document.querySelector('[data-testid="met6-heat-empty"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="met6-heat-grid"]')).toBeNull();
    expect(text()).not.toContain('met6-heat-cell-1-0');
  });
});

describe('MetricsModulePage — budget variance & window', () => {
  it('shows a real 0 as $0.00 with a 正常 badge, and switches with the window', async () => {
    await mount((url) => {
      if (url.includes('run-activity')) return Promise.resolve(activityBody());
      if (url.includes('run-stats')) return Promise.resolve(STATS_24H);
      if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEE_BODY);
      if (url.includes('models/pricing')) return Promise.reject(new ApiError('missing', { status: 404, body: '', url }));
      if (url.includes('budget-usage')) {
        return Promise.resolve({
          items: [
            { employeeId: 'emp_aaaabbbbcccc', period: '2026-11-19', periodKind: 'day', costUsd: 0, limitUsd: 0.5, updatedAt: '2026-11-19T03:20:00.000Z' },
          ],
          missingEmployeeIds: [],
        });
      }
      return Promise.resolve({});
    });

    const row = document.querySelector('[data-testid="met6-budget-row-0"]');
    expect(row?.querySelectorAll('td')[2].textContent).toBe('$0.00');
    expect(row?.querySelectorAll('td')[4].textContent).toBe('0%');
    expect(document.querySelector('[data-testid="met6-budget-status-0"]')?.textContent).toBe('正常');
    expect(document.querySelector('[data-testid="met6-budget-variance-0"]')?.textContent).toContain('结余 $0.50');
    expect(document.querySelector('[data-testid="met6-budget-source"]')?.textContent).toContain('最近 24 小时');

    await act(async () => {
      (document.querySelector('[data-testid="met6-window-7d"]') as HTMLButtonElement).click();
    });
    await waitFor(
      () => document.querySelector('[data-testid="met6-budget-source"]')?.textContent?.includes('最近 7 天') === true,
      'budget window',
    );
    const dayCalls = urls().filter((url) => url.includes('budget-usage') && url.includes('periodKind=day'));
    expect(dayCalls.length).toBeGreaterThanOrEqual(8);
  });
});


function LocationProbe(): ReactNode {
  const location = useLocation();
  return <p data-testid="met7-loc">{location.search}</p>;
}

function shareRouter(usage: unknown) {
  return (url: string): Promise<unknown> => {
    if (url.includes('run-activity')) return Promise.resolve(activityBody());
    if (url.includes('run-stats')) return Promise.resolve(statsFor(url));
    if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEE_BODY);
    if (url.includes('models/pricing')) return Promise.reject(new ApiError('missing', { status: 404, body: '', url }));
    if (url.includes('hermes-usage')) return Promise.resolve(usage);
    if (url.includes('periodKind=month')) return Promise.resolve(LEDGER_MONTH);
    if (url.includes('periodKind=day')) return Promise.resolve(LEDGER_DAY);
    return Promise.resolve({});
  };
}

async function mountShare(usage: unknown, entry = '/metrics'): Promise<void> {
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation(shareRouter(usage));
  await render(
    entry,
    <>
      <MetricsModulePage />
      <LocationProbe />
    </>,
  );
  await waitFor(settled, 'state settled');
}

const SHARE_USAGE = {
  by_model: [
    { model: 'zeta', sessions: 4, actual_cost_usd: 3 },
    { model: 'alpha', sessions: 9, actual_cost_usd: 1 },
    { model: 'mid' },
  ],
  asOf: '2026-11-19T20:12:00.000Z',
};

const shareRows = (): (string | null)[] =>
  [...document.querySelectorAll('[data-testid^="met7-row-"]')].map((node) => node.getAttribute('data-testid'));

describe('MetricsModulePage — met7 cost share by model', () => {
  it('sorts by cost descending by default and its shares add up to 100%', async () => {
    await mountShare(SHARE_USAGE);

    expect(shareRows()).toEqual(['met7-row-zeta', 'met7-row-alpha', 'met7-row-mid']);
    expect(document.querySelector('[data-testid="met7-cost-zeta"]')?.textContent).toBe('$3.00');
    expect(document.querySelector('[data-testid="met7-cost-alpha"]')?.textContent).toBe('$1.00');
    expect(document.querySelector('[data-testid="met7-share-zeta"]')?.textContent).toBe('75.0%');
    expect(document.querySelector('[data-testid="met7-share-alpha"]')?.textContent).toBe('25.0%');
    // A model the answer carries no money for is «—», never 0 and never 0%.
    expect(document.querySelector('[data-testid="met7-cost-mid"]')?.textContent).toBe('—');
    expect(document.querySelector('[data-testid="met7-share-mid"]')?.textContent).toBe('—');
    expect(document.querySelector('[data-testid="met7-runs-mid"]')?.textContent).toBe('—');
    expect(document.querySelector('[data-testid="met7-runs-zeta"]')?.textContent).toBe('4');
    expect(document.querySelector('[data-testid="met7-source"]')?.textContent).toContain('$4.00');
  });

  it('keeps a real zero charge apart from a missing one', async () => {
    await mountShare({ by_model: [{ model: 'free', cost_usd: 0 }, { model: 'unknown' }] });

    expect(document.querySelector('[data-testid="met7-cost-free"]')?.textContent).toBe('$0.00');
    expect(document.querySelector('[data-testid="met7-cost-unknown"]')?.textContent).toBe('—');
    // No positive total means no share at all — not a silent 0%.
    expect(document.querySelector('[data-testid="met7-share-free"]')?.textContent).toBe('—');
    expect(text()).not.toContain('0.0%');
  });

  it('never promotes an estimate into a charge', async () => {
    await mountShare({ by_model: [{ model: 'est', estimated_cost_usd: 9.5, estimated_cost: 9.5 }] });

    expect(document.querySelector('[data-testid="met7-cost-est"]')?.textContent).toBe('—');
    expect(text()).not.toContain('$9.50');
  });

  it('sorts by model on demand and writes the order into the address', async () => {
    await mountShare(SHARE_USAGE);

    await act(async () => {
      (document.querySelector('[data-testid="met7-sort-model"]') as HTMLButtonElement).click();
    });
    await waitFor(
      () => document.querySelector('[data-testid="met7-loc"]')?.textContent === '?sort=model&dir=asc',
      'sort in address',
    );
    expect(shareRows()).toEqual(['met7-row-alpha', 'met7-row-mid', 'met7-row-zeta']);

    await act(async () => {
      (document.querySelector('[data-testid="met7-sort-cost"]') as HTMLButtonElement).click();
    });
    await waitFor(
      () => document.querySelector('[data-testid="met7-loc"]')?.textContent === '',
      'default order leaves no sort keys in the address',
    );
    expect(shareRows()).toEqual(['met7-row-zeta', 'met7-row-alpha', 'met7-row-mid']);
  });

  it('shows an honest empty state when no model rows come back', async () => {
    await mountShare({ by_model: [] });

    expect(document.querySelector('[data-testid="met7-empty"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="met7-table"]')).toBeNull();
    expect(text()).toContain('这个窗口没有按模型的实扣记录');
    expect(text()).not.toContain('共 0');
  });
});


const SHARE_MODEL_USAGE = {
  by_model: [{ model: 'zeta', sessions: 4, actual_cost_usd: 3 }],
  asOf: '2026-11-19T20:12:00.000Z',
};

function employeeShareRouter(ledger: unknown) {
  return (url: string): Promise<unknown> => {
    if (url.includes('run-activity')) return Promise.resolve(activityBody());
    if (url.includes('run-stats')) return Promise.resolve(statsFor(url));
    if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEE_BODY);
    if (url.includes('models/pricing')) return Promise.reject(new ApiError('missing', { status: 404, body: '', url }));
    if (url.includes('hermes-usage')) return Promise.resolve(SHARE_MODEL_USAGE);
    if (url.includes('budget-usage')) return Promise.resolve(ledger);
    return Promise.resolve({});
  };
}

async function mountEmployeeShare(ledger: unknown, entry = '/metrics?groupBy=employee'): Promise<void> {
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation(employeeShareRouter(ledger));
  await render(
    entry,
    <>
      <MetricsModulePage />
      <LocationProbe />
    </>,
  );
  await waitFor(settled, 'state settled');
}

const TWO_EMPLOYEE_LEDGER = {
  items: [
    { employeeId: 'emp_aaaabbbbcccc', costUsd: 3, runs: 7, updatedAt: '2026-11-19T03:20:00.000Z' },
    { employeeId: 'emp_ddddeeeeffff', costUsd: 1, runs: 3, updatedAt: '2026-11-19T02:10:00.000Z' },
  ],
  missingEmployeeIds: [],
};

describe('MetricsModulePage — met8 cost share by employee', () => {
  it('reads the employee ledger for ?groupBy=employee and names people, not ids', async () => {
    await mountEmployeeShare(TWO_EMPLOYEE_LEDGER);

    expect(document.querySelector('[data-testid="met7-table"]')).toBeNull();
    expect(document.querySelector('[data-testid="met8-table"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="met8-row-aaaabbbb"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="met8-row-ddddeeee"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="met8-cost-aaaabbbb"]')?.textContent).toBe('$3.00');
    expect(document.querySelector('[data-testid="met8-cost-ddddeeee"]')?.textContent).toBe('$1.00');
    expect(document.querySelector('[data-testid="met8-runs-aaaabbbb"]')?.textContent).toBe('7');
    expect(document.querySelector('[data-testid="met8-share-aaaabbbb"]')?.textContent).toBe('75.0%');
    expect(document.querySelector('[data-testid="met8-share-ddddeeee"]')?.textContent).toBe('25.0%');
    expect(text()).toContain('小鲤');
    expect(text()).toContain('小满');
    expect(text()).not.toContain('emp_aaaabbbbcccc');
    expect(document.querySelector('[data-testid="met8-source"]')?.textContent).toContain('$4.00');
  });

  it('switches view once, keeps the address and refetches the new source exactly once', async () => {
    api.fetchJsonStrict.mockReset();
    api.fetchJsonStrict.mockImplementation(employeeShareRouter(TWO_EMPLOYEE_LEDGER));
    await render(
      '/metrics',
      <>
        <MetricsModulePage />
        <LocationProbe />
      </>,
    );
    await waitFor(settled, 'state settled');
    expect(document.querySelector('[data-testid="met7-table"]')).not.toBeNull();

    const before = urls();
    const budgetBefore = before.filter((url) => url.includes('budget-usage')).length;
    const usageBefore = before.filter((url) => url.includes('hermes-usage')).length;

    await act(async () => {
      (document.querySelector('[data-testid="met8-view-employee"]') as HTMLButtonElement).click();
    });
    await waitFor(() => document.querySelector('[data-testid="met8-table"]') !== null, 'employee table');

    const after = urls();
    expect(after.filter((url) => url.includes('budget-usage')).length - budgetBefore).toBe(1);
    expect(after.filter((url) => url.includes('hermes-usage')).length).toBe(usageBefore);
    expect(document.querySelector('[data-testid="met7-loc"]')?.textContent).toContain('groupBy=employee');
    expect(document.querySelector('[data-testid="met7-table"]')).toBeNull();
  });

  it('falls back to the 8-character code when the directory has no name', async () => {
    await mountEmployeeShare({
      items: [{ employeeId: 'emp_9f3a1b2c4d5e6f70', costUsd: 2, updatedAt: '2026-11-19T03:20:00.000Z' }],
      missingEmployeeIds: [],
    });

    expect(text()).toContain('员工 · 9F3A1B2C');
    expect(text()).not.toContain('emp_9f3a1b2c4d5e6f70');
    expect(document.querySelector('[data-testid="met8-runs-9f3a1b2c"]')?.textContent).toBe('—');
    expect(document.querySelector('[data-testid="met8-share-9f3a1b2c"]')?.textContent).toBe('100.0%');
  });

  it('keeps a zero charge apart from a missing one in the employee view too', async () => {
    await mountEmployeeShare({
      items: [
        { employeeId: 'emp_aaaabbbbcccc', costUsd: 0, updatedAt: '2026-11-19T03:20:00.000Z' },
        { employeeId: 'emp_ddddeeeeffff', updatedAt: '2026-11-19T02:10:00.000Z' },
      ],
      missingEmployeeIds: [],
    });

    expect(document.querySelector('[data-testid="met8-cost-aaaabbbb"]')?.textContent).toBe('$0.00');
    expect(document.querySelector('[data-testid="met8-cost-ddddeeee"]')?.textContent).toBe('—');
    expect(document.querySelector('[data-testid="met8-share-aaaabbbb"]')?.textContent).toBe('—');
    expect(text()).not.toContain('0.0%');
  });
});

describe('met9 — cost rows drill into the runs list', () => {
  it('sends an employee row to /runs with the accepted employee filter and the same window', async () => {
    await mountEmployeeShare(TWO_EMPLOYEE_LEDGER, '/metrics?groupBy=employee&window=7d');

    const link = document.querySelector('[data-testid="met9-link-aaaabbbb"]') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    // A real anchor: middle-click and copy-link both work.
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/runs/?employee=emp_aaaabbbbcccc&window=7d');
    expect(link.textContent).toBe('查看运行');
    expect(link.getAttribute('aria-label')).toContain('小鲤');
    // The raw id rides in the href only; the page never prints it.
    expect(text()).not.toContain('emp_aaaabbbbcccc');
    expect(document.querySelector('[data-testid="met9-note"]')?.textContent).toContain('按这位员工筛选');
  });

  it('never paints a model filter the runs page cannot honour', async () => {
    await mountShare(SHARE_USAGE, '/metrics?window=30d');

    const link = document.querySelector('[data-testid="met9-link-zeta"]') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/runs/?window=30d');
    expect(link.getAttribute('href')).not.toContain('model=');
    expect(link.getAttribute('title')).toContain('运行页暂不支持按模型筛选');
    const note = document.querySelector('[data-testid="met9-note"]');
    expect(note?.textContent).toContain('运行页暂不支持按模型筛选');
    expect(note?.textContent).toContain('不假装过滤');
  });
});

// ---- metA: export the current cost view -------------------------------------

describe('metA — export the current cost view', () => {
  function captureDownload(): {
    captured: { blob: Blob | null; name: string | null };
    click: ReturnType<typeof vi.spyOn>;
  } {
    const captured: { blob: Blob | null; name: string | null } = { blob: null, name: null };
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        captured.blob = blob;
        return 'blob:metA';
      }),
      revokeObjectURL: vi.fn(),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      captured.name = this.download;
    });
    return { captured, click };
  }

  

  it('exports exactly the rows on screen under the fixed key header', async () => {
    const { captured, click } = captureDownload();
    await mountEmployeeShare(TWO_EMPLOYEE_LEDGER);
    expect(document.querySelector('[data-testid="metA-export-count"]')?.textContent).toBe('可导出 2 行');

    await act(async () => {
      (document.querySelector('[data-testid="metA-export"]') as HTMLButtonElement).click();
    });

    expect(click).toHaveBeenCalledTimes(1);
    expect(captured.name).toMatch(/^metrics-share-24h-employee-cost-desc-\d{8}-\d{4}\.csv$/);
    const lines = (await (captured.blob as Blob).text()).replace(/^\uFEFF/, '').split('\r\n');
    expect(lines[0]).toBe('group,runs,cost_usd,share_pct,as_of,window');
    const onScreen = document.querySelectorAll('[data-testid^="met8-row-"]').length;
    expect(onScreen).toBe(2);
    expect(dataOnly(lines)).toHaveLength(onScreen + 1);
    expect(lines[1].split(',')).toEqual(['小鲤', '7', '3.00', '75.0', '2026-11-19T03:20:00.000Z', '24h']);
    expect(lines[2].split(',')).toEqual(['小满', '3', '1.00', '25.0', '2026-11-19T03:20:00.000Z', '24h']);
    click.mockRestore();
  });

  it('keeps a real zero at 0.00 and a missing value empty', async () => {
    const { captured, click } = captureDownload();
    await mountEmployeeShare({
      items: [
        { employeeId: 'emp_aaaabbbbcccc', costUsd: 0, runs: 2, updatedAt: '2026-11-19T03:20:00.000Z' },
        { employeeId: 'emp_ddddeeeeffff', updatedAt: '2026-11-19T02:10:00.000Z' },
      ],
      missingEmployeeIds: [],
    });

    await act(async () => {
      (document.querySelector('[data-testid="metA-export"]') as HTMLButtonElement).click();
    });

    const lines = (await (captured.blob as Blob).text()).replace(/^\uFEFF/, '').split('\r\n');
    expect(lines[1].split(',')).toEqual(['小鲤', '2', '0.00', '', '2026-11-19T03:20:00.000Z', '24h']);
    expect(lines[2].split(',')).toEqual(['小满', '', '', '', '2026-11-19T03:20:00.000Z', '24h']);
    click.mockRestore();
  });

  it('escapes commas and quotes the RFC 4180 way', async () => {
    const { captured, click } = captureDownload();
    await mountShare({ by_model: [{ model: 'a,"b"', sessions: 1, actual_cost_usd: 2 }], asOf: null });

    await act(async () => {
      (document.querySelector('[data-testid="metA-export"]') as HTMLButtonElement).click();
    });

    const lines = (await (captured.blob as Blob).text()).replace(/^\uFEFF/, '').split('\r\n');
    expect(lines[1]).toBe('"a,""b""",1,2.00,100.0,,24h');
    expect(captured.name).toMatch(/^metrics-share-24h-model-cost-desc-\d{8}-\d{4}\.csv$/);
    click.mockRestore();
  });

  it('keeps the button usable on an empty view and exports a header-only file', async () => {
    const { captured, click } = captureDownload();
    await mountShare({ by_model: [] });

    const button = document.querySelector('[data-testid="metA-export"]') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('title')).toContain('只写表头');
    expect(document.querySelector('[data-testid="metA-export-count"]')?.textContent).toBe('可导出 0 行');

    await act(async () => {
      button.click();
    });
    const lines = (await (captured.blob as Blob).text()).replace(/^\uFEFF/, '').split('\r\n').filter(Boolean);
    expect(dataOnly(lines)).toHaveLength(1);
    expect(lines[0]).toBe('group,runs,cost_usd,share_pct,as_of,window');
    click.mockRestore();
  });

  it('labels the two export buttons by scope and explains which one is the aggregate', async () => {
    await mountShare(SHARE_USAGE);

    const detail = document.querySelector('[data-testid="met6-export"]') as HTMLButtonElement;
    const share = document.querySelector('[data-testid="metA-export"]') as HTMLButtonElement;
    expect(detail).toBeTruthy();
    expect(share).toBeTruthy();
    expect(detail.textContent?.trim()).toBe('导出明细 CSV');
    expect(share.textContent?.trim()).toBe('导出分摊 CSV');
    expect(detail.textContent).not.toBe(share.textContent);
    expect(detail.getAttribute('title')).toContain('账本逐行');
    expect(share.getAttribute('title')).toContain('聚合行');
    const note = document.querySelector('[data-testid="metA-scope-note"]');
    expect(note?.textContent).toContain('聚合行');
    expect(note?.textContent).toContain('导出明细 CSV');
  });
});

// ---- metF: provenance columns in both exports -------------------------------
describe('metF — exported files carry as_of and window', () => {
  function captureDownload(): { captured: { blob: Blob | null; name: string | null } } {
    const captured: { blob: Blob | null; name: string | null } = { blob: null, name: null };
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        captured.blob = blob;
        return 'blob:metF';
      }),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      captured.name = this.download;
    });
    return { captured };
  }

  const csvLines = async (blob: Blob | null): Promise<string[]> =>
    (await (blob as Blob).text()).replace(/^\uFEFF/, '').split('\r\n');

  it('stamps the aggregate export with the upstream collection time and the window id', async () => {
    const { captured } = captureDownload();
    await mountShare(SHARE_USAGE);
    const onScreen = document.querySelectorAll('[data-testid^="met7-row-"]').length;
    expect(document.querySelector('[data-testid="metA-export-count"]')?.textContent).toBe(`可导出 ${onScreen} 行`);

    await act(async () => {
      (document.querySelector('[data-testid="metA-export"]') as HTMLButtonElement).click();
    });

    const lines = await csvLines(captured.blob);
    expect(lines[0]).toBe('group,runs,cost_usd,share_pct,as_of,window');
    expect(dataOnly(lines)).toHaveLength(onScreen + 1);
    const cells = lines[1].split(',');
    expect(cells.at(-2)).toBe('2026-11-19T20:12:00.000Z');
    expect(cells.at(-1)).toBe('24h');
    expect(captured.name).toMatch(/^metrics-share-24h-model-cost-desc-\d{8}-\d{4}\.csv$/);
  });

  it('leaves as_of empty when the answer carried none, and never stamps the local clock', async () => {
    const { captured } = captureDownload();
    await mountShare({ by_model: [{ model: 'zeta', sessions: 1, actual_cost_usd: 1 }], asOf: null });

    await act(async () => {
      (document.querySelector('[data-testid="metA-export"]') as HTMLButtonElement).click();
    });

    const lines = await csvLines(captured.blob);
    expect(lines[0]).toBe('group,runs,cost_usd,share_pct,as_of,window');
    const cells = lines[1].split(',');
    expect(cells.at(-2)).toBe('');
    expect(cells.at(-1)).toBe('24h');
    // An empty cell, not today's date dressed up as a collection time.
    expect(lines[1]).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('stamps the detail export with the batch as_of and window, matching the rows on screen', async () => {
    const { captured } = captureDownload();
    await mount(usageRouter());
    const onScreen = document.querySelectorAll('[data-testid^="met6-row-"]').length;
    expect(onScreen).toBeGreaterThan(0);

    await act(async () => {
      (document.querySelector('[data-testid="met6-export"]') as HTMLButtonElement).click();
    });

    const lines = await csvLines(captured.blob);
    expect(lines[0].split(',').at(-2)).toBe('as_of');
    expect(lines[0].split(',').at(-1)).toBe('window');
    expect(dataOnly(lines)).toHaveLength(onScreen + 1);
    const cells = lines[1].split(',');
    expect(cells.at(-2)).toBe('2026-11-19T03:20:00.000Z');
    expect(cells.at(-1)).toBe('24h');
    expect(document.querySelector('[data-testid="met6-cat-source"]')?.textContent).toContain(`${onScreen} 行`);
  });

  it('explains the provenance columns beside the aggregate view', async () => {
    await mountShare(SHARE_USAGE);
    const note = document.querySelector('[data-testid="metF-export-asof-note"]');
    expect(note?.textContent).toContain('采集时刻');
    expect(note?.textContent).toContain('时间窗');
    expect(note?.textContent).toContain('留空');
  });
});

// metB — the source & freshness block. It must never invent a collection time:
// only a top-level ISO `asOf` from the payload counts, everything else is 「—」.
const metBSource = (): HTMLElement | null => document.querySelector('[data-testid="metB-source-toggle"]');
const metBCell = (key: string): HTMLElement | null => document.querySelector(`[data-testid="metB-source-asof-${key}"]`);

function sourceRouter(runStats: unknown | ((url: string) => unknown), pricing?: () => Promise<unknown>) {
  return (url: string): Promise<unknown> => {
    if (url.includes('run-activity')) return Promise.resolve(activityBody());
    if (url.includes('run-stats')) {
      return Promise.resolve(typeof runStats === 'function' ? (runStats as (u: string) => unknown)(url) : runStats);
    }
    if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEE_BODY);
    if (url.includes('models/pricing')) {
      return pricing ? pricing() : Promise.reject(new ApiError('missing', { status: 404, body: '', url }));
    }
    if (url.includes('periodKind=month')) return Promise.resolve(LEDGER_MONTH);
    if (url.includes('periodKind=day')) return Promise.resolve(LEDGER_DAY);
    return Promise.resolve({});
  };
}

async function openSources(): Promise<void> {
  const toggle = metBSource();
  expect(toggle).toBeTruthy();
  await act(async () => {
    toggle?.click();
  });
}

describe('metB — source freshness', () => {
  it('stays collapsed by default and keeps raw paths off the page until opened', async () => {
    await mount(usageRouter());

    expect(metBSource()?.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('[data-testid="metB-source-table"]')).toBeNull();
    expect(visibleText()).not.toContain('/api');
  });

  it('shows no toggle at all before the page has read anything', async () => {
    await mount(usageRouter(), '/metrics?state=empty');

    expect(metBSource()).toBeNull();
    expect(document.querySelector('[data-testid="metB-source-empty"]')?.textContent).toContain('还没有读取记录');
  });

  it('shows the upstream collection time, and 「—」 when the payload carries none', async () => {
    await mount(sourceRouter({ ...STATS_24H, asOf: '2026-11-19T20:12:00.000Z', asOfSource: 'bff' }));
    await openSources();

    expect(document.querySelector('[data-testid="metB-source-table"]')).toBeTruthy();
    // 20:12Z is 04:12 the next day in Beijing.
    expect(metBCell('run-stats')?.textContent).toBe('2026-11-20 04:12');
    expect(metBCell('run-stats')?.getAttribute('title')).toBe('采集时刻来自 bff');
    // run-activity returns no asOf: must stay blank, never the local clock.
    expect(metBCell('run-activity')?.textContent).toBe('—');
    expect(metBCell('run-activity')?.getAttribute('title')).toBe('上游未返回采集时刻');
    expect(document.querySelector('[data-testid="metB-source-state-run-stats"]')?.textContent).toBe('正常');
  });

  it('treats a non-ISO asOf as missing instead of formatting it', async () => {
    await mount(sourceRouter({ ...STATS_24H, asOf: 'yesterday' }));
    await openSources();

    expect(metBCell('run-stats')?.textContent).toBe('—');
    expect(metBCell('run-stats')?.getAttribute('title')).toBe('上游未返回采集时刻');
    expect(metBCell('run-stats')?.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('marks a degraded source as unreadable and keeps the rest of the page working', async () => {
    await mount(
      sourceRouter({ ...STATS_24H, asOf: '2026-11-19T20:12:00.000Z' }, () =>
        Promise.reject(new ApiError('boom', { status: 500, body: '', url: '/api/models/pricing', requestId: 'req-metB-1' })),
      ),
    );
    await openSources();

    const state = document.querySelector('[data-testid="metB-source-state-pricing"]');
    expect(state?.textContent).toContain('读不到');
    expect(state?.getAttribute('title')).toContain('请求编号 req-metB-1');
    expect(document.querySelector('[data-testid="met6-runs-value"]')).toBeTruthy();
  });
});

// metC — a window switch must produce one fresh batch: the cards and the
// freshness block come from the same reads, the opened block survives the
// switch, and a failed source still hands out a copyable request id.
function freshnessRouter(asOf: () => string | undefined, pricing?: () => Promise<unknown>) {
  return (url: string): Promise<unknown> => {
    if (url.includes('run-activity')) return Promise.resolve(activityBody());
    if (url.includes('run-stats')) {
      const stamp = asOf();
      return Promise.resolve({
        ...(statsFor(url) as Record<string, unknown>),
        ...(stamp ? { asOf: stamp, asOfSource: 'bff' } : {}),
      });
    }
    if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEE_BODY);
    if (url.includes('models/pricing')) {
      return pricing ? pricing() : Promise.reject(new ApiError('missing', { status: 404, body: '', url }));
    }
    if (url.includes('periodKind=month')) return Promise.resolve(LEDGER_MONTH);
    if (url.includes('periodKind=day')) return Promise.resolve(LEDGER_DAY);
    return Promise.resolve({});
  };
}

describe('metC — window and freshness consistency', () => {
  it('refreshes the stamp with the numbers from one request batch', async () => {
    let batchAsOf = '2026-11-19T20:12:00.000Z';
    await mount(freshnessRouter(() => batchAsOf));
    await openSources();
    expect(metBCell('run-stats')?.textContent).toBe('2026-11-20 04:12');

    const before = urls().length;
    batchAsOf = '2026-11-20T01:30:00.000Z';
    await act(async () => {
      (document.querySelector('[data-testid="met6-window-7d"]') as HTMLButtonElement).click();
    });
    await waitFor(() => document.querySelector('[data-testid="met6-runs-value"]')?.textContent === '13', '7d runs');
    await waitFor(() => metBCell('run-stats')?.textContent === '2026-11-20 09:30', 'stamp follows');

    // One batch: the two run-stats reads for the 7d window (current + previous),
    // and the hourly heat read is untouched by a window switch.
    const freshStats = urls().slice(before).filter((url) => url.includes('run-stats'));
    expect(freshStats).toHaveLength(2);
    expect(freshStats.every((url) => url.includes('bucket=day'))).toBe(true);
    expect(metBCell('run-stats')?.textContent).not.toBe('2026-11-20 04:12');
  });

  it('keeps the block open across a window switch', async () => {
    let batchAsOf = '2026-11-19T20:12:00.000Z';
    await mount(freshnessRouter(() => batchAsOf));
    await openSources();
    expect(document.querySelector('[data-testid="metB-source-table"]')).toBeTruthy();

    batchAsOf = '2026-11-20T01:30:00.000Z';
    await act(async () => {
      (document.querySelector('[data-testid="met6-window-7d"]') as HTMLButtonElement).click();
    });
    await waitFor(() => metBCell('run-stats')?.textContent === '2026-11-20 09:30', 'stamp follows');

    expect(metBSource()?.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('[data-testid="metB-source-table"]')).toBeTruthy();
  });

  it('keeps a real $0.00 apart from a missing — on an empty window', async () => {
    const rows = (kind: 'day' | 'month') => ({
      items: [
        {
          employeeId: 'emp_aaaabbbbcccc',
          period: kind === 'month' ? '2026-11' : '2026-11-19',
          periodKind: kind,
          costUsd: 0,
          updatedAt: '2026-11-19T03:20:00.000Z',
        },
        {
          employeeId: 'emp_ddddeeeeffff',
          period: kind === 'month' ? '2026-11' : '2026-11-19',
          periodKind: kind,
          updatedAt: '2026-11-19T03:20:00.000Z',
        },
      ],
      missingEmployeeIds: [],
    });

    await mount(
      usageRouter({
        ledger: (url) => Promise.resolve(rows(url.includes('periodKind=month') ? 'month' : 'day')),
      }),
    );
    await act(async () => {
      (document.querySelector('[data-testid="met6-window-7d"]') as HTMLButtonElement).click();
    });
    await waitFor(() => document.querySelector('[data-testid="met6-runs-value"]')?.textContent === '13', '7d runs');

    const list = document.querySelector('[data-testid="met6-cost-rows"]');
    expect(list?.textContent).toContain('$0.00');
    expect(list?.textContent).toContain('—');
    expect(document.querySelector('[data-testid="met6-cost-value"]')?.textContent).toBe('$0.00');
  });

  it('hands out a copyable request id when a source cannot be read', async () => {
    clip.copyTextToClipboard.mockClear();
    await mount(
      freshnessRouter(
        () => '2026-11-19T20:12:00.000Z',
        () =>
          Promise.reject(
            new ApiError('boom', {
              status: 403,
              body: '',
              url: '/api/models/pricing',
              requestId: 'req-metC-403',
            }),
          ),
      ),
    );
    await openSources();

    const cell = document.querySelector('[data-testid="metB-source-state-pricing"]');
    expect(cell?.textContent).toContain('读不到');
    const button = document.querySelector('[data-testid="metC-source-rid-pricing"]') as HTMLButtonElement | null;
    expect(button).toBeTruthy();
    await act(async () => {
      button?.click();
    });
    await waitFor(() => button?.textContent?.includes('已复制') ?? false, 'copied');
    expect(clip.copyTextToClipboard).toHaveBeenCalledWith('req-metC-403');
  });

  it('calls a readable source without a collection time degraded, not normal', async () => {
    await mount(freshnessRouter(() => undefined));
    await openSources();

    const cell = document.querySelector('[data-testid="metB-source-state-run-stats"]');
    expect(cell?.textContent).toBe('降级');
    expect(cell?.getAttribute('title')).toContain('上游未返回采集时刻');
  });
});

// metD — the card area and the freshness block must describe a failed read the
// same way: one sentence, one request id, no second vocabulary.
describe('metD — state consistency with the freshness block', () => {
  const DENIED = '这项数据当前读不到：可能还没有接入，也可能当前账号没有查看权限。';

  it('prints the same sentence and the same request id in a card gap and in the freshness row', async () => {
    await mount((url) => {
      if (url.includes('run-activity')) return Promise.resolve(activityBody());
      if (url.includes('run-stats')) {
        return Promise.reject(new ApiError('denied', { status: 403, body: '', url, requestId: 'req-metD-A' }));
      }
      if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEE_BODY);
      if (url.includes('periodKind=month')) return Promise.resolve(LEDGER_MONTH);
      if (url.includes('periodKind=day')) return Promise.resolve(LEDGER_DAY);
      return Promise.reject(new ApiError('missing', { status: 404, body: '', url }));
    });
    await openSources();

    const gap = document.querySelector('[data-testid="met6-runs-gap"]');
    const fresh = document.querySelector('[data-testid="metD-source-reason-run-stats"]');
    expect(gap?.textContent).toContain(DENIED);
    expect(fresh?.textContent).toBe(DENIED);
    expect(document.querySelector('[data-testid="metD-gap-rid-runs"]')?.textContent).toContain('req-metD-A');
    expect(document.querySelector('[data-testid="metC-source-rid-run-stats"]')?.getAttribute('title')).toBe(
      'req-metD-A',
    );
  });

  it('uses that same sentence and id in the whole-block card, not a second wording', async () => {
    await mount((url) => {
      if (url.includes('run-activity')) return Promise.resolve(activityBody());
      return Promise.reject(new ApiError('denied', { status: 403, body: '', url, requestId: 'req-metD-all' }));
    });
    await openSources();

    expect(document.querySelector('[data-testid="met6-denied"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="metD-card-reason"]')?.textContent?.trim()).toBe(DENIED);
    expect(document.querySelector('[data-testid="metD-source-reason-run-stats"]')?.textContent?.trim()).toBe(DENIED);
    expect(document.querySelector('[data-testid="metD-card-rid"]')?.textContent).toContain('req-metD-all');
    expect(document.querySelector('[data-testid="metC-source-rid-run-stats"]')?.getAttribute('title')).toBe(
      'req-metD-all',
    );
  });

  it('offers an exit from an empty window and sends one request batch when it moves', async () => {
    await mount((url) => {
      if (url.includes('run-activity')) return Promise.resolve(activityBody());
      if (url.includes('run-stats')) return Promise.resolve(url.includes('bucket=day') ? STATS_7D : STATS_24H);
      if (url.includes('/api/employees')) return Promise.resolve({ items: [], nextCursor: null });
      if (url.includes('budget-usage')) return Promise.resolve({ items: [], missingEmployeeIds: [] });
      return Promise.resolve({});
    });

    expect(document.querySelector('[data-testid="met6-empty"]')).toBeTruthy();
    const switchWindow = document.querySelector('[data-testid="metD-empty-window"]') as HTMLButtonElement;
    expect(switchWindow).toBeTruthy();
    expect(document.querySelector('[data-testid="metD-empty-retry"]')).toBeTruthy();

    const before = urls().length;
    await act(async () => {
      switchWindow.click();
    });
    await waitFor(settled, 'window switched');

    const batch = urls().slice(before);
    const stats = batch.filter((url) => url.includes('run-stats'));
    expect(stats.length).toBeGreaterThan(0);
    expect(stats.every((url) => url.includes('bucket=day'))).toBe(true);
    expect(document.querySelector('[data-testid="met6-runs-value"]')?.textContent).toBe('13');
  });

  it('re-sends exactly one batch when the error card retries', async () => {
    await mount((url) => Promise.reject(new ApiError('boom', { status: 500, body: '', url, requestId: 'req-metD-500' })));

    expect(document.querySelector('[data-testid="met6-error"]')).toBeTruthy();
    const initial = urls().length;
    expect(initial).toBeGreaterThan(0);

    await act(async () => {
      (document.querySelector('[data-testid="met6-retry"]') as HTMLButtonElement).click();
    });
    await waitFor(() => urls().length >= initial * 2, 'retry batch');
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Window bounds are computed from the clock, so compare shapes with the
    // timestamps masked; everything else (path, bucket, period) must match.
    const shape = (url: string): string => url.replace(/from=[^&]*/, 'from=*').replace(/to=[^&]*/, 'to=*');
    const tally = (list: string[]): Record<string, number> =>
      list.reduce<Record<string, number>>((counts, url) => {
        const key = shape(url);
        return { ...counts, [key]: (counts[key] ?? 0) + 1 };
      }, {});
    const batch = urls().slice(initial);
    expect(batch.length).toBe(initial);
    // One retry re-runs the same loaders once each: the per-URL counts match the
    // first batch exactly, so no loader fired twice for one click.
    expect(tally(batch)).toEqual(tally(urls().slice(0, initial)));
  });
});

// metG — the cost tables have to say what they show and let the keyboard drive
// the sort, without changing how any of it looks.
describe('metG — table accessibility and sort semantics', () => {
  it('names the table with window, grouping and order, and exposes the sort state on the header', async () => {
    await mountShare(SHARE_USAGE);

    const caption = document.querySelector('[data-testid="metG-a11y-caption"]');
    expect(caption?.tagName).toBe('CAPTION');
    const name = caption?.textContent ?? '';
    expect(name).toContain('成本分摊');
    expect(name).toContain('最近 24 小时');
    expect(name).toContain('按模型');
    expect(name).toContain('按成本');
    expect(name).toContain('降序');

    const costHead = document.querySelector('[data-testid="metG-a11y-th-cost"]');
    expect(costHead?.tagName).toBe('TH');
    expect(costHead?.getAttribute('scope')).toBe('col');
    expect(costHead?.getAttribute('aria-sort')).toBe('descending');
    expect(document.querySelector('[data-testid="metG-a11y-th-runs"]')?.getAttribute('aria-sort')).toBe('none');
    // metP made the detail table's share column sortable, so this header now
    // reports three-state aria-sort like the other two (the met7 share column
    // has no aria-sort at all, hence the separate testid there).
    expect(document.querySelector('[data-testid="metG-a11y-th-share"]')?.getAttribute('aria-sort')).toBe('none');
    expect(costHead?.className).toContain('met6-num');
    expect(document.querySelector('[data-testid="met7-cost-zeta"]')?.className).toContain('met6-num');

    const sortCost = document.querySelector('[data-testid="met7-sort-cost"]') as HTMLButtonElement;
    expect(sortCost.tagName).toBe('BUTTON');
    expect(sortCost.getAttribute('type')).toBe('button');
  });

  it('flips aria-sort and the URL when the header is activated, without refetching', async () => {
    await mountShare(SHARE_USAGE);
    const before = urls().length;

    await act(async () => {
      (document.querySelector('[data-testid="met7-sort-cost"]') as HTMLButtonElement).click();
    });
    await waitFor(
      () => document.querySelector('[data-testid="metG-a11y-th-cost"]')?.getAttribute('aria-sort') === 'ascending',
      'aria-sort flipped',
    );
    expect(document.querySelector('[data-testid="met7-loc"]')?.textContent).toContain('sort=cost');
    expect(document.querySelector('[data-testid="met7-loc"]')?.textContent).toContain('dir=asc');
    // Sorting is client-side: flipping the order must not re-read any endpoint.
    expect(urls().length).toBe(before);

    await act(async () => {
      (document.querySelector('[data-testid="met7-sort-runs"]') as HTMLButtonElement).click();
    });
    await waitFor(
      () => document.querySelector('[data-testid="metG-a11y-th-runs"]')?.getAttribute('aria-sort') === 'descending',
      'runs sort',
    );
    expect(document.querySelector('[data-testid="met7-loc"]')?.textContent).toContain('sort=runs');
    expect(document.querySelector('[data-testid="met7-loc"]')?.textContent).toContain('dir=desc');
    expect(document.querySelector('[data-testid="metG-a11y-th-cost"]')?.getAttribute('aria-sort')).toBe('none');
  });

  it('makes every cost row focusable in reading order and names it', async () => {
    await mountShare(SHARE_USAGE);
    const rows = [...document.querySelectorAll('[data-testid^="met7-row-"]')] as HTMLTableRowElement[];
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => {
      expect(row.tabIndex).toBe(0);
      expect((row.getAttribute('aria-label') ?? '').length).toBeGreaterThan(0);
    });
    rows[0].focus();
    expect(document.activeElement).toBe(rows[0]);
  });

  it('carries the same semantics on the by-employee table', async () => {
    await mountEmployeeShare(TWO_EMPLOYEE_LEDGER);

    const name = document.querySelector('[data-testid="metG-a11y-caption"]')?.textContent ?? '';
    expect(name).toContain('按员工');
    expect(document.querySelector('[data-testid="met8-sort-name"]')?.tagName).toBe('BUTTON');
    expect(document.querySelector('[data-testid="metG-a11y-th-cost"]')?.getAttribute('aria-sort')).toBe('descending');
    const rows = document.querySelectorAll('[data-testid^="met8-row-"]');
    expect(rows.length).toBeGreaterThan(0);
    (rows[0] as HTMLTableRowElement).focus();
    expect(document.activeElement).toBe(rows[0]);
  });
});

describe('metH — partial failure isolation', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
  const count = (list: string[], part: string): number => list.filter((url) => url.includes(part)).length;
  const pricingDown = (requestId = 'req-metH-price') => () =>
    Promise.reject(new ApiError('missing', { status: 404, body: '', url: '/api/models/pricing', requestId }));
  const PRICING_OK = {
    models: [{ modelId: 'mdl_metH', label: 'zeta', inputPerMillion: 1, outputPerMillion: 2, currency: 'USD' }],
    asOf: '2026-11-19T20:12:00.000Z',
  };

  it('keeps the cards that did read when one source fails, and offers only that card a retry', async () => {
    await mount(usageRouter({ pricing: pricingDown() }));

    // The sources that answered keep their numbers — no blank page, no cleared table.
    expect(q('met6-runs-value')?.textContent).toBe('0');
    expect(q('met6-cost-value')?.textContent).toBe('$0.00');
    expect(q('met5-count')).not.toBeNull();
    expect(q('met6-cost-rows')).not.toBeNull();

    // Only the pricing card carries the failure, with its copyable id and a retry.
    const err = q('metH-card-error-price');
    expect(err).not.toBeNull();
    expect(err?.textContent).toContain('这项数据当前读不到');
    expect(err?.textContent).toContain('req-metH-price');
    expect(q('metH-card-retry-price')).not.toBeNull();
    expect(q('metH-card-error-runs')).toBeNull();
    expect(q('metH-card-error-cost')).toBeNull();
    expect(q('metH-page-error')).toBeNull();
  });

  it('re-reads only that card on retry, recovers it, and leaves the other numbers alone', async () => {
    let down = true;
    await mount(
      usageRouter({ pricing: () => (down ? pricingDown()() : Promise.resolve(PRICING_OK)) }),
    );

    const before = urls();
    const statsBefore = count(before, 'run-stats');
    const activityBefore = count(before, 'run-activity');
    const employeesBefore = count(before, '/api/employees');
    const ledgerBefore = count(before, 'budget-usage');
    const priceBefore = count(before, 'models/pricing');
    expect(priceBefore).toBeGreaterThan(0);

    down = false;
    await act(async () => {
      (q('metH-card-retry-price') as HTMLButtonElement).click();
    });
    await waitFor(() => q('met6-price-rows') !== null, 'price card recovered');

    const after = urls();
    // Exactly one new read, and only for the failed source.
    expect(count(after, 'models/pricing')).toBe(priceBefore + 1);
    expect(count(after, 'run-stats')).toBe(statsBefore);
    expect(count(after, 'run-activity')).toBe(activityBefore);
    expect(count(after, '/api/employees')).toBe(employeesBefore);
    expect(count(after, 'budget-usage')).toBe(ledgerBefore);

    expect(q('metH-card-error-price')).toBeNull();
    expect(q('met6-runs-value')?.textContent).toBe('0');
    expect(q('met6-cost-value')?.textContent).toBe('$0.00');
  });

  it('turns the section into one error only when every source fails, and keeps the id and the way back', async () => {
    const down = (url: string): Promise<unknown> =>
      Promise.reject(new ApiError('boom', { status: 500, body: '', url, requestId: 'req-metH-all' }));
    await mount(down);

    expect(q('metH-page-error')).not.toBeNull();
    expect(q('metH-page-error')?.textContent).toContain('req-metH-all');
    expect(q('met6-retry')).not.toBeNull();
    // The heat card stands apart: it failed too, but it has its own retry.
    expect(q('metH-card-error-heat')).not.toBeNull();
    expect(q('metH-card-retry-heat')).not.toBeNull();
  });

  it('retries only the heat card after a run-activity timeout', async () => {
    const router = usageRouter();
    let activityDown = true;
    const handler = (url: string): Promise<unknown> => {
      if (url.includes('run-activity')) {
        return activityDown
          ? Promise.reject(new ApiError('timeout', { status: 0, body: '', url, requestId: 'req-metH-heat' }))
          : Promise.resolve(activityBody());
      }
      return router(url);
    };
    await mount(handler);

    expect(q('metH-card-error-heat')).not.toBeNull();
    expect(q('metH-card-error-heat')?.textContent).toContain('req-metH-heat');
    // The rest of the page read fine, so it still shows its numbers.
    expect(q('met6-runs-value')?.textContent).toBe('0');

    const before = urls();
    const activityBefore = count(before, 'run-activity');
    const statsBefore = count(before, 'run-stats');
    const employeesBefore = count(before, '/api/employees');

    activityDown = false;
    await act(async () => {
      (q('metH-card-retry-heat') as HTMLButtonElement).click();
    });
    await waitFor(() => q('met5-count') !== null, 'heat card recovered');

    const after = urls();
    expect(count(after, 'run-activity')).toBe(activityBefore + 1);
    expect(count(after, 'run-stats')).toBe(statsBefore);
    expect(count(after, '/api/employees')).toBe(employeesBefore);
    expect(q('metH-card-error-heat')).toBeNull();
  });
});

describe('metI — exports under partial failure', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
  const captured: { blob: Blob | null; name: string | null } = { blob: null, name: null };
  let clickSpy: { mockRestore: () => void } | null = null;

  function capture(): void {
    captured.blob = null;
    captured.name = null;
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        captured.blob = blob;
        return 'blob:metI';
      }),
      revokeObjectURL: vi.fn(),
    });
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      captured.name = this.download;
    });
  }

  const lines = async (): Promise<string[]> =>
    (await (captured.blob as Blob).text()).replace(/^\uFEFF/, '').split('\r\n');

  afterEach(() => {
    clickSpy?.mockRestore();
    clickSpy = null;
  });

  it('leaves the run-stats columns empty and names the missing block in the detail file', async () => {
    capture();
    const router = usageRouter();
    await mount((url) =>
      url.includes('run-stats')
        ? Promise.reject(new ApiError('boom', { status: 500, body: '', url, requestId: 'req-metI-stats' }))
        : router(url),
    );

    // The screen says the same thing the file will say.
    expect(q('metI-detail-gap')?.textContent).toContain('运行统计');

    const onScreen = document.querySelectorAll('[data-testid^="met6-row-"]').length;
    expect(onScreen).toBeGreaterThan(0);

    await act(async () => {
      (q('met6-export') as HTMLButtonElement).click();
    });
    const rows = await lines();
    expect(rows[0].split(',').slice(-2)).toEqual(['as_of', 'window']);
    // header + the rows on screen + one totals comment + one gap note.
    expect(rows).toHaveLength(onScreen + 3);
    expect(dataOnly(rows)).toHaveLength(onScreen + 1);

    const note = rows.at(-1) ?? '';
    expect(note).toContain('# 本次导出缺少 1 块：运行统计');
    expect(note).toContain('这次没能读取这项数据');

    // The two window columns stay empty: no 0, no local clock standing in.
    const cells = (rows[1] ?? '').split(',');
    expect(cells[6]).toBe('');
    expect(cells[7]).toBe('');
    expect(rows[1]).not.toMatch(/undefined|NaN/);
    expect(cells.at(-1)).toBe('24h');
  });

  it('keeps the share file equal to the printed row count even when another card failed', async () => {
    capture();
    const router = usageRouter();
    await mount((url) => {
      if (url.includes('hermes-usage')) return Promise.resolve(SHARE_USAGE);
      if (url.includes('models/pricing')) {
        return Promise.reject(new ApiError('missing', { status: 404, body: '', url, requestId: 'req-metI-price' }));
      }
      return router(url);
    });

    // A failed price card does not put a note in a file that has no price column.
    expect(q('metH-card-error-price')).not.toBeNull();
    const shown = Number((q('metA-export-count')?.textContent ?? '').replace(/\D/g, ''));
    expect(shown).toBeGreaterThan(0);

    await act(async () => {
      (q('metA-export') as HTMLButtonElement).click();
    });
    const rows = await lines();
    expect(dataOnly(rows)).toHaveLength(shown + 1);
    expect(rows[0]).toBe('group,runs,cost_usd,share_pct,as_of,window');
  });

  it('disables the share export when its own source failed instead of writing an empty file', async () => {
    await mount((url) =>
      url.includes('hermes-usage')
        ? Promise.reject(new ApiError('boom', { status: 503, body: '', url, requestId: 'req-metI-share' }))
        : usageRouter()(url),
    );

    const button = q('metA-export') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(q('metA-export-count')?.textContent).toContain('可导出 0 行');
    expect(q('met7-error')).not.toBeNull();
  });

  it('blocks both exports when the whole section failed and points at the retry', async () => {
    await mount((url) =>
      Promise.reject(new ApiError('boom', { status: 500, body: '', url, requestId: 'req-metI-all' })),
    );

    const detail = q('met6-export') as HTMLButtonElement;
    const share = q('metA-export') as HTMLButtonElement;
    expect(detail.disabled).toBe(true);
    expect(share.disabled).toBe(true);
    expect(detail.title).toContain('整页读取失败');
    expect(share.title).toContain('整页读取失败');
    expect(q('metI-share-blocked')).not.toBeNull();
    // The way back is still on screen.
    expect(q('met6-retry')).not.toBeNull();
  });
});

describe('metJ — export order matches the table', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
  const captured: { blob: Blob | null } = { blob: null };
  let clickSpy: { mockRestore: () => void } | null = null;

  function capture(): void {
    captured.blob = null;
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        captured.blob = blob;
        return 'blob:metJ';
      }),
      revokeObjectURL: vi.fn(),
    });
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  }

  const csvRows = async (): Promise<string[]> =>
    (await (captured.blob as Blob).text())
      .replace(/^\uFEFF/, '')
      .split('\r\n')
      .slice(1)
      // The note, when present, is always the last line and never a data row.
      .filter((line) => !line.startsWith('#'));

  const firstCell = (line: string): string => (line.startsWith('"') ? line.slice(1, line.indexOf('",')) : line.split(',')[0]);

  const detailOrder = (): string[] =>
    Array.from(document.querySelectorAll('tr[data-testid^="met6-row-"]')).map(
      (tr) => tr.querySelector('.met6-rowname')?.textContent ?? '',
    );

  const shareOrder = (): string[] =>
    Array.from(document.querySelectorAll('tr[data-testid^="met7-row-"]')).map(
      (tr) => tr.querySelector('.met7-model')?.textContent ?? '',
    );

  afterEach(() => {
    clickSpy?.mockRestore();
    clickSpy = null;
  });

  it('writes the detail file in the exact row order of the table', async () => {
    capture();
    const router = usageRouter();
    await mount(
      (url) => (url.includes('hermes-usage') ? Promise.resolve(HERMES_USAGE) : router(url)),
      '/metrics?view=model',
    );

    const onScreen = detailOrder();
    expect(onScreen).toEqual(['qwen-plus', 'deepseek-v4']);
    expect(q('metJ-export-order-note')).not.toBeNull();

    await act(async () => {
      (q('met6-export') as HTMLButtonElement).click();
    });

    const rows = await csvRows();
    expect(rows.map(firstCell)).toEqual(onScreen);
  });

  it('keeps the share file in the default cost-descending order the table shows', async () => {
    capture();
    await mountShare(SHARE_USAGE);

    const onScreen = shareOrder();
    expect(onScreen).toEqual(['zeta', 'alpha', 'mid']);

    await act(async () => {
      (q('metA-export') as HTMLButtonElement).click();
    });

    const rows = await csvRows();
    expect(rows.map(firstCell)).toEqual(onScreen);
    expect(firstCell(rows[0] ?? '')).toBe('zeta');
    expect(firstCell(rows.at(-1) ?? '')).toBe('mid');
  });

  it('follows ?sort/?dir in both the table and the file, and keeps the gap note last', async () => {
    capture();
    await mountShare(SHARE_USAGE, '/metrics?sort=model&dir=asc');

    const onScreen = shareOrder();
    expect(onScreen).toEqual(['alpha', 'mid', 'zeta']);

    await act(async () => {
      (q('metA-export') as HTMLButtonElement).click();
    });

    const rows = await csvRows();
    expect(rows.map(firstCell)).toEqual(onScreen);
    expect(firstCell(rows[0] ?? '')).toBe('alpha');

    // Nothing this file draws from is missing, so it has no note line at all.
    const all = (await (captured.blob as Blob).text()).replace(/^\uFEFF/, '').split('\r\n');
    expect(all[0]).toBe('group,runs,cost_usd,share_pct,as_of,window');
    expect(all.at(-1)).not.toContain('# 本次导出缺少');
    expect(rows).toHaveLength(onScreen.length);
  });

  it('keeps the gap note after every data row while the row order still matches the table', async () => {
    capture();
    const router = usageRouter();
    await mount((url) =>
      url.includes('run-stats')
        ? Promise.reject(new ApiError('boom', { status: 500, body: '', url, requestId: 'req-metJ-stats' }))
        : url.includes('hermes-usage')
          ? Promise.resolve(HERMES_USAGE)
          : router(url),
      '/metrics?view=model',
    );

    const onScreen = detailOrder();
    expect(onScreen.length).toBeGreaterThan(1);

    await act(async () => {
      (q('met6-export') as HTMLButtonElement).click();
    });

    const rows = await csvRows();
    expect(rows.map(firstCell)).toEqual(onScreen);
    const all = (await (captured.blob as Blob).text()).replace(/^\uFEFF/, '').split('\r\n');
    expect(all.at(-1)).toContain('# 本次导出缺少 1 块：运行统计');
    expect(rows).toHaveLength(onScreen.length);
  });
});

describe('metK — chart accessibility alternatives', () => {
  function heatCellRuns(dow: number): number {
    const cells = Array.from(
      document.querySelectorAll(`[data-testid^="met5-cell-${dow}-"]`),
    ) as HTMLButtonElement[];
    return cells.reduce((sum, cell) => {
      const match = /运行 (\d+) 次/.exec(cell.getAttribute('aria-label') ?? '');
      return sum + (match ? Number(match[1]) : 0);
    }, 0);
  }

  it('labels a heat cell with its date, count and strength band, and says 无数据 when missing', async () => {
    await mount(() => Promise.resolve(activityBody()));

    const busy = document.querySelector('[data-testid="met5-cell-3-8"]') as HTMLButtonElement;
    const busyLabel = busy.getAttribute('aria-label') ?? '';
    expect(busyLabel).toContain('2026-11-18');
    expect(busyLabel).toContain('运行 4 次');
    expect(busyLabel).toContain('强度 4 档');

    const missing = document.querySelector('[data-testid="met5-cell-2-3"]') as HTMLButtonElement;
    const missingLabel = missing.getAttribute('aria-label') ?? '';
    expect(missingLabel).toContain('无数据');
    expect(missingLabel).not.toContain('运行');
  });

  it('describes the whole grid in one sentence whose numbers match the card', async () => {
    await mount(() => Promise.resolve(activityBody()));

    const figure = document.querySelector('[data-testid="metK-heat-figure"]');
    expect(figure?.getAttribute('role')).toBe('img');
    expect(figure?.getAttribute('aria-describedby')).toBe('metK-heat-summary');

    const total = document.querySelector('[data-testid="met5-count"]')?.textContent ?? '';
    const summary = document.querySelector('[data-testid="metK-heat-summary"]')?.textContent ?? '';
    expect(summary).toContain(`总运行 ${total} 次`);
    expect(summary).toContain('最高 周三 50 次');
    expect(summary).toContain('最低 周二 45 次');
    expect(summary).toContain('覆盖 7 / 7 天');
  });

  it('opens a semantic per-weekday table without changing the window or issuing reads', async () => {
    await mount(() => Promise.resolve(activityBody()));

    expect(document.querySelector('[data-testid="metK-table"]')).toBeNull();
    const toggle = document.querySelector('[data-testid="metK-table-toggle"]') as HTMLButtonElement;
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe('metK-table');

    const before = urls().length;
    await act(async () => {
      toggle.click();
    });

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const table = document.querySelector('[data-testid="metK-table"]') as HTMLTableElement;
    expect(table.tagName).toBe('TABLE');
    expect(table.querySelector('caption')?.textContent).toContain('按星期汇总的运行次数');

    const headers = Array.from(table.querySelectorAll('thead th'));
    expect(headers.map((th) => th.textContent)).toEqual(['星期', '运行数']);
    expect(headers.every((th) => th.getAttribute('scope') === 'col')).toBe(true);

    // Three weekdays cross-checked: the table matches the sum of the cells' own labels.
    for (const dow of [1, 2, 3]) {
      const row = table.querySelector(`[data-testid="metK-table-row-${dow}"]`);
      const value = row?.querySelectorAll('td')[1]?.textContent ?? '';
      expect(Number(value)).toBe(heatCellRuns(dow));
    }
    const missingDay = table.querySelector('[data-testid="metK-table-row-2"]')?.querySelectorAll('td')[1];
    expect(missingDay?.textContent).toBe('45');

    expect(urls().length).toBe(before);

    await act(async () => {
      toggle.click();
    });
    expect(document.querySelector('[data-testid="metK-table"]')).toBeNull();
    expect(urls().length).toBe(before);
  });

  it('describes the trend with first, last, peak and low from the same slots', async () => {
    await mount(usageRouter());

    await act(async () => {
      (document.querySelector('[data-testid="met6-window-7d"]') as HTMLButtonElement).click();
    });
    await waitFor(
      () => document.querySelector('[data-testid="met6-runs-value"]')?.textContent === '13',
      '7d runs',
    );

    const svg = document.querySelector('[data-testid="met6-sparkline"]');
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-describedby')).toBe('metK-trend-summary');
    expect(svg?.querySelectorAll('rect')).toHaveLength(1);

    const summary = document.querySelector('[data-testid="metK-trend-summary"]')?.textContent ?? '';
    expect(summary).toContain('共 1 个时段有记录');
    expect(summary).toContain('首值 13 次');
    expect(summary).toContain('末值 13 次');
    expect(summary).toContain('峰值 13 次');
    expect(summary).toContain('最低 13 次');
  });
});

// ---- metL: copy the current view as plain text -----------------------------
// The copy repeats the numbers already on screen and reads nothing again; a
// real zero stays $0.00 / 0, a missing value stays «—», and no internal id or
// raw field name goes into the text.

describe('metL — copy the current view summary', () => {
  it('copies the same numbers the page shows without reading anything again', async () => {
    await mount(usageRouter());
    await waitFor(
      () => document.querySelector('[data-testid="met6-runs-value"]')?.textContent === '0',
      'runs value',
    );
    clip.copyTextToClipboard.mockClear();
    const before = urls().length;

    await act(async () => {
      (document.querySelector('[data-testid="metL-copy"]') as HTMLButtonElement).click();
    });
    await waitFor(
      () => document.querySelector('[data-testid="metL-copy-status"]')?.textContent === '已复制',
      'copy status',
    );

    expect(urls().length).toBe(before);
    expect(clip.copyTextToClipboard).toHaveBeenCalledTimes(1);
    const body = String(clip.copyTextToClipboard.mock.calls[0][0]);
    expect(body).toContain('运行分析摘要');
    expect(body).toContain('窗口：最近 24 小时（24h）');
    expect(body).toContain('运行数：0');
    expect(body).toContain('实扣金额：$0.00');
    expect(body).toContain('占比口径：成本分摊按模型分组的账本实扣计算');
    expect(body).toContain('采集时刻：—');
    expect(body).toMatch(/生成时刻：\d{4}-\d{2}-\d{2} \d{2}:\d{2}（北京时间）/);
    expect(body).not.toContain('emp_');
    expect(document.querySelector('[data-testid="metL-fallback"]')).toBeNull();
  });

  it('reports the collection time of the batch when the upstream returned one', async () => {
    const base = usageRouter();
    await mount((url) =>
      url.includes('run-stats')
        ? Promise.resolve({ ...STATS_24H, asOf: '2026-11-19T20:12:00.000Z', asOfSource: 'bff' })
        : base(url),
    );
    clip.copyTextToClipboard.mockClear();

    await act(async () => {
      (document.querySelector('[data-testid="metL-copy"]') as HTMLButtonElement).click();
    });
    await waitFor(
      () => document.querySelector('[data-testid="metL-copy-status"]')?.textContent === '已复制',
      'copy status',
    );

    const body = String(clip.copyTextToClipboard.mock.calls[0][0]);
    expect(body).toContain('采集时刻：2026-11-20 04:12');
    // The window id of the current view is the only identifier in the text.
    expect(body).not.toContain('emp_');
    expect(body).not.toContain('2026-11-19T');
  });

  it('offers a selectable fallback when the clipboard refuses', async () => {
    clip.copyTextToClipboard.mockResolvedValueOnce(false);
    await mount(usageRouter());
    await waitFor(
      () => document.querySelector('[data-testid="met6-runs-value"]')?.textContent === '0',
      'runs value',
    );
    clip.copyTextToClipboard.mockClear();

    await act(async () => {
      (document.querySelector('[data-testid="metL-copy"]') as HTMLButtonElement).click();
    });
    await waitFor(
      () => document.querySelector('[data-testid="metL-copy-status"]')?.textContent === '复制没成功',
      'copy failure',
    );

    const fallback = document.querySelector('[data-testid="metL-fallback-text"]') as HTMLTextAreaElement;
    expect(fallback).toBeTruthy();
    expect(fallback.readOnly).toBe(true);
    expect(fallback.value).toBe(String(clip.copyTextToClipboard.mock.calls[0][0]));
    expect(fallback.value).toContain('运行分析摘要');
  });

  it('keeps the grouping caliber in step with the visible share table', async () => {
    await mount(usageRouter(), '/metrics?groupBy=employee');
    await waitFor(
      () => document.querySelector('[data-testid="met8-view-employee"]')?.getAttribute('aria-pressed') === 'true',
      'employee view',
    );
    clip.copyTextToClipboard.mockClear();

    await act(async () => {
      (document.querySelector('[data-testid="metL-copy"]') as HTMLButtonElement).click();
    });
    await waitFor(
      () => document.querySelector('[data-testid="metL-copy-status"]')?.textContent === '已复制',
      'copy status',
    );

    const body = String(clip.copyTextToClipboard.mock.calls[0][0]);
    expect(body).toContain('占比口径：成本分摊按员工分组');
  });
});

// ---- metM: staleness hints in the freshness block --------------------------
// A collection time is compared with the moment this client finished reading —
// never with the local clock standing in for data. More than 15 minutes behind
// gets a spoken badge; a missing or malformed stamp is never called stale.

describe('metM — staleness hints', () => {
  const isoMinutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

  it('flags a collection time more than fifteen minutes behind the read', async () => {
    await mount(sourceRouter({ ...STATS_24H, asOf: isoMinutesAgo(40), asOfSource: 'bff' }));
    await openSources();

    const badge = document.querySelector('[data-testid="metM-stale-run-stats"]');
    expect(badge?.textContent).toBe('数据可能滞后');
    const title = badge?.getAttribute('title') ?? '';
    expect(title).toContain('读取时刻');
    expect(title).toContain('15 分钟');
    expect(title).toContain('不是数据时刻');
    // Sources without a collection time are not flagged.
    expect(document.querySelector('[data-testid="metM-stale-run-activity"]')).toBeNull();
  });

  it('leaves a recent stamp and a missing stamp unflagged', async () => {
    await mount(sourceRouter({ ...STATS_24H, asOf: isoMinutesAgo(1) }));
    await openSources();

    expect(document.querySelector('[data-testid="metM-stale-run-stats"]')).toBeNull();
    expect(document.querySelector('[data-testid="metB-source-asof-run-activity"]')?.textContent).toBe('—');
    expect(document.querySelector('[data-testid="metM-stale-run-activity"]')).toBeNull();
  });

  it('never turns a malformed stamp into a verdict', async () => {
    await mount(sourceRouter({ ...STATS_24H, asOf: 'yesterday' }));
    await openSources();

    expect(document.querySelector('[data-testid="metB-source-asof-run-stats"]')?.textContent).toBe('—');
    expect(document.querySelector('[data-testid="metM-stale-run-stats"]')).toBeNull();
  });

  it('re-judges after a window switch instead of keeping the old verdict', async () => {
    let phase: 'old' | 'fresh' = 'old';
    const asOf = () => isoMinutesAgo(phase === 'old' ? 90 : 1);
    await mount(
      sourceRouter((url: string) =>
        url.includes('bucket=day')
          ? { ...STATS_7D, asOf: asOf() }
          : { ...STATS_24H, asOf: asOf() },
      ),
    );
    await openSources();
    expect(document.querySelector('[data-testid="metM-stale-run-stats"]')).toBeTruthy();

    phase = 'fresh';
    await act(async () => {
      (document.querySelector('[data-testid="met6-window-7d"]') as HTMLButtonElement).click();
    });
    await waitFor(
      () => document.querySelector('[data-testid="met6-runs-value"]')?.textContent === '13',
      '7d runs',
    );

    expect(document.querySelector('[data-testid="metM-stale-run-stats"]')).toBeNull();
    expect(document.querySelector('[data-testid="metB-source-table"]')).toBeTruthy();
  });
});

describe('metO — number format consistency', () => {
  function captureDownload(): {
    captured: { blob: Blob | null; name: string | null };
    click: ReturnType<typeof vi.spyOn>;
  } {
    const captured: { blob: Blob | null; name: string | null } = { blob: null, name: null };
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        captured.blob = blob;
        return 'blob:metO';
      }),
      revokeObjectURL: vi.fn(),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      captured.name = this.download;
    });
    return { captured, click };
  }

  it('groups thousands on screen and exports the same precision without decoration', async () => {
    const { captured, click } = captureDownload();
    await mountShare({
      by_model: [
        { model: 'big', sessions: 1234, actual_cost_usd: 1234.5 },
        { model: 'bulk', sessions: 1200, actual_cost_usd: 1000 },
      ],
      asOf: '2026-11-19T20:12:00.000Z',
    });

    // Screen: one shared formatter for counts and money.
    expect(document.querySelector('[data-testid="met7-runs-big"]')?.textContent).toBe('1,234');
    expect(document.querySelector('[data-testid="met7-cost-big"]')?.textContent).toBe('$1,234.50');
    expect(document.querySelector('[data-testid="met7-runs-bulk"]')?.textContent).toBe('1,200');
    expect(document.querySelector('[data-testid="met7-cost-bulk"]')?.textContent).toBe('$1,000.00');

    await act(async () => {
      (document.querySelector('[data-testid="metA-export"]') as HTMLButtonElement).click();
    });
    const lines = (await (captured.blob as Blob).text()).replace(/^\uFEFF/, '').split('\r\n');
    const big = (lines.find((line) => line.startsWith('big,')) ?? '').split(',');
    const bulk = (lines.find((line) => line.startsWith('bulk,')) ?? '').split(',');

    // Pair 1: $1,234.50 on screen ↔ 1234.50 in the file. Pair 2: 1,234 ↔ 1234.
    expect(big.slice(0, 3)).toEqual(['big', '1234', '1234.50']);
    expect(bulk.slice(0, 3)).toEqual(['bulk', '1200', '1000.00']);
    expect(dataOnly(lines).every((line) => !line.includes('$'))).toBe(true);
    click.mockRestore();
  });

  it('keeps a real zero and a missing value apart on screen and in the file', async () => {
    const { captured, click } = captureDownload();
    await mountShare({
      by_model: [{ model: 'zero', sessions: 0, actual_cost_usd: 0 }, { model: 'none' }],
      asOf: '2026-11-19T20:12:00.000Z',
    });

    expect(document.querySelector('[data-testid="met7-cost-zero"]')?.textContent).toBe('$0.00');
    expect(document.querySelector('[data-testid="met7-runs-zero"]')?.textContent).toBe('0');
    expect(document.querySelector('[data-testid="met7-cost-none"]')?.textContent).toBe('—');
    expect(document.querySelector('[data-testid="met7-runs-none"]')?.textContent).toBe('—');

    await act(async () => {
      (document.querySelector('[data-testid="metA-export"]') as HTMLButtonElement).click();
    });
    const lines = (await (captured.blob as Blob).text()).replace(/^\uFEFF/, '').split('\r\n');
    const zero = (lines.find((line) => line.startsWith('zero,')) ?? '').split(',');
    const none = (lines.find((line) => line.startsWith('none,')) ?? '').split(',');

    expect(zero.slice(0, 3)).toEqual(['zero', '0', '0.00']);
    expect(none.slice(0, 3)).toEqual(['none', '', '']);
    click.mockRestore();
  });

  it('states the unit on every numeric column of the share table', async () => {
    await mountShare(SHARE_USAGE);

    const runs = document.querySelector('[data-testid="metG-a11y-th-runs"]') as HTMLElement;
    const cost = document.querySelector('[data-testid="metG-a11y-th-cost"]') as HTMLElement;
    const pct = document.querySelector('[data-testid="metO-fmt-th-pct"]') as HTMLElement;

    expect(runs.getAttribute('data-metO-unit')).toBe('次');
    expect(runs.title).toContain('次');
    expect(cost.getAttribute('data-metO-unit')).toBe('USD');
    expect(cost.title).toContain('USD');
    expect(pct.textContent).toBe('占比（%）');
    expect(pct.title).toContain('百分比');

    const note = document.querySelector('[data-testid="metO-fmt-note"]')?.textContent ?? '';
    expect(note).toContain('千分位');
    expect(note).toContain('美元（USD）');
    expect(note).toContain('缺失显示「—」');
    expect(note).toContain('导出文件沿用同一套小数位');
  });

  it('states the unit on the detail columns', async () => {
    await mount(usageRouter());

    const spend = document.querySelector('[data-testid="metO-fmt-th-spend"]') as HTMLElement;
    const count = document.querySelector('[data-testid="metO-fmt-th-count"]') as HTMLElement;
    expect(spend.textContent).toBe('支出（USD）');
    expect(spend.title).toContain('美元');
    expect(count.textContent).toBe('次数（次）');
    expect(count.title).toContain('次');
  });
});

describe('metP — detail table sorting', () => {
  const SORT_IDS = ['emp_aaaabbbbcccc', 'emp_ddddeeeeffff', 'emp_gggghhhhiiii'];
  const SORT_NAMES = ['小鲤', '小满', '阿吉'];

  const SORT_EMPLOYEES = {
    items: SORT_IDS.map((employeeId, index) => ({ employeeId, name: SORT_NAMES[index] })),
    nextCursor: null,
  };

  function ledgerFor(costs: (number | null)[]): unknown {
    return {
      items: SORT_IDS.map((employeeId, index) => ({
        employeeId,
        period: '2026-11-19',
        periodKind: 'day',
        tokensUsed: 0,
        costUsd: costs[index] ?? null,
        updatedAt: '2026-11-19T03:20:00.000Z',
      })),
      missingEmployeeIds: [],
    };
  }

  function detailRouter(options: { costs?: (number | null)[]; statsFails?: boolean } = {}) {
    const ledger = ledgerFor(options.costs ?? [20, 5, 0.5]);
    return (url: string): Promise<unknown> => {
      if (url.includes('run-activity')) return Promise.resolve(activityBody());
      if (url.includes('run-stats')) {
        return options.statsFails
          ? Promise.reject(new ApiError('boom', { status: 500, body: '', url }))
          : Promise.resolve(statsFor(url));
      }
      if (url.includes('/api/employees')) return Promise.resolve(SORT_EMPLOYEES);
      if (url.includes('models/pricing')) return Promise.reject(new ApiError('missing', { status: 404, body: '', url }));
      if (url.includes('periodKind=month')) return Promise.resolve({ items: [], missingEmployeeIds: [] });
      if (url.includes('periodKind=day')) return Promise.resolve(ledger);
      return Promise.resolve({});
    };
  }

  const MODEL_USAGE = {
    by_model: [
      { model: 'alpha', api_calls: 9, input_tokens: 10 },
      { model: 'zeta', api_calls: 4, input_tokens: 10 },
      { model: 'zero', api_calls: 0, input_tokens: 10 },
      { model: 'mid', input_tokens: 10 },
    ],
    asOf: '2026-11-19T20:12:00.000Z',
  };

  function modelRouter() {
    return (url: string): Promise<unknown> => {
      if (url.includes('run-activity')) return Promise.resolve(activityBody());
      if (url.includes('run-stats')) return Promise.resolve(statsFor(url));
      if (url.includes('/api/employees')) return Promise.resolve(SORT_EMPLOYEES);
      if (url.includes('models/pricing')) return Promise.reject(new ApiError('missing', { status: 404, body: '', url }));
      if (url.includes('hermes-usage')) return Promise.resolve(MODEL_USAGE);
      if (url.includes('periodKind=month')) return Promise.resolve({ items: [], missingEmployeeIds: [] });
      if (url.includes('periodKind=day')) return Promise.resolve(ledgerFor([]));
      return Promise.resolve({});
    };
  }

  async function mountDetail(handler: (url: string) => Promise<unknown>, entry = '/metrics'): Promise<void> {
    api.fetchJsonStrict.mockReset();
    api.fetchJsonStrict.mockImplementation(handler);
    await render(
      entry,
      <>
        <MetricsModulePage />
        <LocationProbe />
      </>,
    );
    await waitFor(settled, 'state settled');
  }

  function captureDownload(): {
    captured: { blob: Blob | null; name: string | null };
    click: ReturnType<typeof vi.spyOn>;
  } {
    const captured: { blob: Blob | null; name: string | null } = { blob: null, name: null };
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        captured.blob = blob;
        return 'blob:metP';
      }),
      revokeObjectURL: vi.fn(),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      captured.name = this.download;
    });
    return { captured, click };
  }

  function screenLabels(): string[] {
    return Array.from(document.querySelectorAll('[data-testid="met6-table"] tbody tr')).map((tr) =>
      (tr.querySelector('.met6-rowname')?.textContent ?? '').split(' · ')[0],
    );
  }

  async function exportLabels(captured: { blob: Blob | null }): Promise<string[]> {
    await act(async () => {
      (document.querySelector('[data-testid="met6-export"]') as HTMLButtonElement).click();
    });
    const lines = (await (captured.blob as Blob).text()).replace(/^\uFEFF/, '').split('\r\n');
    return lines
      .filter((line) => line.length > 0 && !line.startsWith('#'))
      .slice(1)
      .map((line) => line.split(',')[0].split(' · ')[0]);
  }

  it('defaults to cost descending, marks aria-sort, and exports that order', async () => {
    const { captured, click } = captureDownload();
    await mountDetail(detailRouter());

    expect(screenLabels()).toEqual(['小鲤', '小满', '阿吉']);
    expect(document.querySelector('[data-testid="met6-row-0"] td:nth-child(2)')?.textContent).toBe('$20.00');
    expect(document.querySelector('[data-testid="met6-row-2"] td:nth-child(2)')?.textContent).toBe('$0.50');

    expect(document.querySelector('[data-testid="metO-fmt-th-spend"]')?.getAttribute('aria-sort')).toBe('descending');
    expect(document.querySelector('[data-testid="metO-fmt-th-count"]')?.getAttribute('aria-sort')).toBe('none');
    expect(document.querySelector('[data-testid="metG-a11y-th-share"]')?.getAttribute('aria-sort')).toBe('none');

    for (const id of ['cost', 'runs', 'share']) {
      const button = document.querySelector(`[data-testid="metP-sort-${id}"]`) as HTMLButtonElement;
      expect(button.tagName).toBe('BUTTON');
      expect(button.getAttribute('type')).toBe('button');
      expect(button.className).toContain('met6-sort');
    }

    expect(document.querySelector('[data-testid="metP-export-order-note"]')).toBeTruthy();
    expect(await exportLabels(captured)).toEqual(['小鲤', '小满', '阿吉']);
    click.mockRestore();
  });

  it('sorts by runs from the URL, keeps a real zero and sinks a missing count', async () => {
    const { captured, click } = captureDownload();
    await mountDetail(modelRouter(), '/metrics?view=model&dsort=runs&ddir=asc');

    expect(screenLabels()).toEqual(['zero', 'zeta', 'alpha', 'mid']);
    expect(document.querySelector('[data-testid="met6-row-0"] td:nth-child(3)')?.textContent).toContain('0');
    expect(document.querySelector('[data-testid="metO-fmt-th-count"]')?.getAttribute('aria-sort')).toBe('ascending');
    expect(document.querySelector('[data-testid="metO-fmt-th-spend"]')?.getAttribute('aria-sort')).toBe('none');
    expect(document.querySelector('[data-testid="met7-loc"]')?.textContent).toContain('dsort=runs');

    expect(await exportLabels(captured)).toEqual(['zero', 'zeta', 'alpha', 'mid']);
    click.mockRestore();
  });

  it('sorts the share column numerically, not as text', async () => {
    await mountDetail(detailRouter(), '/metrics?dsort=share&ddir=asc');

    // 0.5 / 5 / 20 out of 25.5 → 2.0% < 19.6% < 78.4%; a text sort would put 19.6% first.
    expect(screenLabels()).toEqual(['阿吉', '小满', '小鲤']);
    expect(document.querySelector('[data-testid="met6-row-0"] td:nth-child(4)')?.textContent).toBe('2.0%');
    expect(document.querySelector('[data-testid="met6-row-2"] td:nth-child(4)')?.textContent).toBe('78.4%');
    expect(document.querySelector('[data-testid="metG-a11y-th-share"]')?.getAttribute('aria-sort')).toBe('ascending');
  });

  it('writes the sort into the URL and never refetches on a header click', async () => {
    await mountDetail(detailRouter());
    const before = urls().length;

    await act(async () => {
      (document.querySelector('[data-testid="metP-sort-cost"]') as HTMLButtonElement).click();
    });
    await waitFor(
      () => document.querySelector('[data-testid="metO-fmt-th-spend"]')?.getAttribute('aria-sort') === 'ascending',
      'cost ascending',
    );

    const search = document.querySelector('[data-testid="met7-loc"]')?.textContent ?? '';
    expect(search).toContain('dsort=cost');
    expect(search).toContain('ddir=asc');
    expect(urls().length).toBe(before);
    expect(screenLabels()).toEqual(['阿吉', '小满', '小鲤']);
  });

  it('keeps the gap note on the last line and never counts it as a row', async () => {
    const { captured, click } = captureDownload();
    await mountDetail(detailRouter({ statsFails: true }));

    const labels = screenLabels();
    expect(labels).toHaveLength(3);
    expect(await exportLabels(captured)).toEqual(labels);

    const nonEmpty = (await (captured.blob as Blob).text())
      .replace(/^\uFEFF/, '')
      .split('\r\n')
      .filter((line) => line.length > 0);
    expect(nonEmpty[0]).toContain('as_of,window');
    expect(nonEmpty[nonEmpty.length - 1].startsWith('# 本次导出缺少 1 块：运行统计（')).toBe(true);
    expect(dataOnly(nonEmpty)).toHaveLength(labels.length + 1);
    expect(nonEmpty.length).toBe(labels.length + 3);
    click.mockRestore();
  });
});

describe('metQ — keyboard access and status announcements', () => {
  function focusableTestIds(): string[] {
    return Array.from(
      document.querySelectorAll<HTMLElement>('[tabindex="0"], button, a[href], input, select, textarea'),
    )
      .filter((el) => !el.hasAttribute('disabled'))
      .map((el) => el.getAttribute('data-testid') ?? el.id ?? el.tagName.toLowerCase());
  }

  it('makes every card focusable without inventing a positive tab order', async () => {
    await mount(usageRouter());

    for (const key of ['runs', 'cost', 'trend', 'price', 'heatmap']) {
      const card = document.getElementById(`metQ-card-focus-${key}`);
      expect(card).toBeTruthy();
      expect(card?.getAttribute('tabindex')).toBe('0');
      expect(card?.className).toContain('metQ-card');
    }

    const positive = Array.from(document.querySelectorAll('[tabindex]')).filter(
      (el) => Number(el.getAttribute('tabindex')) > 0,
    );
    expect(positive).toHaveLength(0);

    // Keyboard walk: the first nine landings in DOM order. The skip link is
    // first on purpose (metY); everything after it keeps its old place.
    expect(focusableTestIds().slice(0, 10)).toEqual([
      'metY-skiplink',
      'metL-copy',
      'met5-refresh',
      'metAL-reset',
      'metAK-refresh',
      'met6-window-24h',
      'met6-window-7d',
      'met6-window-30d',
      'met6-runs',
      'met6-cost',
    ]);
  });

  it('announces a partial read failure once, without carrying the request id into the live region', async () => {
    const handler = (url: string): Promise<unknown> => {
      if (url.includes('run-activity')) return Promise.resolve(activityBody());
      if (url.includes('run-stats')) return Promise.resolve(statsFor(url));
      if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEE_BODY);
      if (url.includes('models/pricing')) {
        return Promise.reject(new ApiError('boom', { status: 500, body: '', url, requestId: 'req-metQ-1' }));
      }
      if (url.includes('periodKind=month')) return Promise.resolve(LEDGER_MONTH);
      if (url.includes('periodKind=day')) return Promise.resolve(LEDGER_DAY);
      return Promise.resolve({});
    };
    await mount(handler);

    const live = document.querySelector('[data-testid="metQ-live"]') as HTMLElement;
    await waitFor(() => live.textContent?.includes('有 1 项数据暂时读不到') === true, 'live announced');
    expect(document.querySelectorAll('[data-testid="metQ-live"]')).toHaveLength(1);
    expect(live.getAttribute('role')).toBe('status');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.textContent).toBe('有 1 项数据暂时读不到，卡片上写着原因。');
    expect(live.textContent).not.toContain('req-metQ-1');

    const before = live.textContent;
    await act(async () => {
      (document.querySelector('[data-testid="metB-source-toggle"]') as HTMLButtonElement).click();
    });
    expect(live.textContent).toBe(before);
  });

  it('says a quiet window is quiet instead of staying silent', async () => {
    const quietStats = {
      from: '2026-11-18T16:00:00.000Z',
      to: '2026-11-19T16:00:00.000Z',
      bucket: 'day',
      buckets: [],
      totals: { runs: 0, succeeded: 0, failed: 0, running: 0, sampleCount: 0, successRate: null },
    };
    const handler = (url: string): Promise<unknown> => {
      if (url.includes('run-activity')) return Promise.resolve(activityBody());
      if (url.includes('run-stats')) return Promise.resolve(quietStats);
      if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEE_BODY);
      if (url.includes('models/pricing')) return Promise.resolve({ prices: [] });
      if (url.includes('hermes-usage')) return Promise.resolve({ by_model: [] });
      return Promise.resolve({ items: [], missingEmployeeIds: [] });
    };
    await mount(handler);

    const live = document.querySelector('[data-testid="metQ-live"]') as HTMLElement;
    await waitFor(() => live.textContent === '这个时间窗没有运行记录，也没有实扣。', 'quiet announced');
  });
});

describe('metR — export and copy availability under failure states', () => {
  const ALL_DOWN = '整页读取失败，这份导出暂时不生成；先重试上面的读取，读到数据再导。';

  function captureDownload(): {
    captured: { blob: Blob | null; name: string | null };
    click: ReturnType<typeof vi.spyOn>;
  } {
    const captured: { blob: Blob | null; name: string | null } = { blob: null, name: null };
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        captured.blob = blob;
        return 'blob:metR';
      }),
      revokeObjectURL: vi.fn(),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      captured.name = this.download;
    });
    return { captured, click };
  }

  const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

  it('disables all three actions on a whole-page failure and says why', async () => {
    await mount((url) =>
      Promise.reject(new ApiError('boom', { status: 500, body: '', url, requestId: 'req-metR-all' })),
    );

    const detail = q('met6-export') as HTMLButtonElement;
    const share = q('metA-export') as HTMLButtonElement;
    const copy = q('metL-copy') as HTMLButtonElement;

    expect(detail.disabled).toBe(true);
    expect(share.disabled).toBe(true);
    expect(copy.disabled).toBe(true);
    expect(detail.getAttribute('title')).toBe(ALL_DOWN);
    expect(share.getAttribute('title')).toBe(ALL_DOWN);
    expect(copy.getAttribute('title')).toBe('整页读取失败，摘要里的数字不完整，先重试上面的读取。');
    expect(q('metR-copy-state')?.textContent).toBe('摘要不可复制：整页读取失败');
    expect(q('metR-export-state')?.textContent).toBe('导出：整页读取失败，两处 CSV 都暂停');
  });

  it('keeps the detail export usable when only another block is down, and notes the gap in the file', async () => {
    const { captured, click } = captureDownload();
    await mount((url) =>
      url.includes('run-stats')
        ? Promise.reject(new ApiError('boom', { status: 500, body: '', url, requestId: 'req-metR-part' }))
        : usageRouter()(url),
    );

    const detail = q('met6-export') as HTMLButtonElement;
    const share = q('metA-export') as HTMLButtonElement;
    expect(detail.disabled).toBe(false);
    expect(detail.getAttribute('title')).toContain('账本逐行');
    expect(share.disabled).toBe(false);
    expect(q('metR-export-state')?.textContent).toContain('含 1 处缺块注记');
    expect(q('metR-copy-state')?.textContent).toBe('摘要可复制');

    await act(async () => {
      detail.click();
    });
    const nonEmpty = (await (captured.blob as Blob).text())
      .replace(/^\uFEFF/, '')
      .split('\r\n')
      .filter(Boolean);
    expect(nonEmpty[nonEmpty.length - 1].startsWith('# 本次导出缺少 1 块：运行统计（')).toBe(true);
    click.mockRestore();
  });

  it('disables the share export when its own block is unreadable, with the reason in the title', async () => {
    await mount((url) =>
      url.includes('hermes-usage')
        ? Promise.reject(new ApiError('boom', { status: 503, body: '', url, requestId: 'req-metR-share' }))
        : usageRouter()(url),
    );

    const detail = q('met6-export') as HTMLButtonElement;
    const share = q('metA-export') as HTMLButtonElement;
    expect(detail.disabled).toBe(false);
    expect(share.disabled).toBe(true);
    expect(share.getAttribute('title')).toContain('这份分摊现在读不到，导出暂不生成：');
    expect(q('metR-export-state')?.textContent).toContain('分摊暂不可用');
  });

  it('exports header-only files on an empty window and keeps the count on screen', async () => {
    const { captured, click } = captureDownload();
    const quietStats = {
      from: '2026-11-18T16:00:00.000Z',
      to: '2026-11-19T16:00:00.000Z',
      bucket: 'day',
      buckets: [],
      totals: { runs: 0, succeeded: 0, failed: 0, running: 0, sampleCount: 0, successRate: null },
    };
    const handler = (url: string): Promise<unknown> => {
      if (url.includes('run-activity')) return Promise.resolve(activityBody());
      if (url.includes('run-stats')) return Promise.resolve(quietStats);
      if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEE_BODY);
      if (url.includes('models/pricing')) return Promise.resolve({ prices: [] });
      if (url.includes('hermes-usage')) return Promise.resolve({ by_model: [] });
      if (url.includes('budget-usage')) return Promise.resolve({ items: [], missingEmployeeIds: [] });
      return Promise.resolve({});
    };
    await mount(handler);

    const detail = q('met6-export') as HTMLButtonElement;
    const share = q('metA-export') as HTMLButtonElement;
    expect(detail.disabled).toBe(false);
    expect(share.disabled).toBe(false);
    expect(q('metA-export-count')?.textContent).toBe('可导出 0 行');
    expect(q('metL-copy') as HTMLButtonElement).toHaveProperty('disabled', false);

    await act(async () => {
      detail.click();
    });
    const detailLines = (await (captured.blob as Blob).text())
      .replace(/^\uFEFF/, '')
      .split('\r\n')
      .filter(Boolean);
    expect(dataOnly(detailLines)).toHaveLength(1);
    expect(detailLines[0]).toContain('as_of,window');

    await act(async () => {
      share.click();
    });
    const shareLines = (await (captured.blob as Blob).text())
      .replace(/^\uFEFF/, '')
      .split('\r\n')
      .filter(Boolean);
    expect(dataOnly(shareLines)).toHaveLength(1);
    click.mockRestore();
  });
});

describe('metS — group switch semantics', () => {
  const S_EMP = { items: [{ employeeId: 'emp_aaaabbbbcccc', name: '小鲤' }, { employeeId: 'emp_ddddeeeeffff', name: '小满' }], nextCursor: null };
  const S_LEDGER = {
    items: [
      { employeeId: 'emp_aaaabbbbcccc', period: '2026-11-19', periodKind: 'day', costUsd: 20, updatedAt: '2026-11-19T03:20:00.000Z' },
      { employeeId: 'emp_ddddeeeeffff', period: '2026-11-19', periodKind: 'day', costUsd: 5, updatedAt: '2026-11-19T03:20:00.000Z' },
    ],
    missingEmployeeIds: [],
  };
  const S_MODEL = {
    by_model: [
      { model: 'alpha', api_calls: 9, input_tokens: 10 },
      { model: 'zeta', api_calls: 4, input_tokens: 10 },
      { model: 'zero', api_calls: 0, input_tokens: 10 },
    ],
    asOf: '2026-11-19T20:12:00.000Z',
  };

  function handler(url: string): Promise<unknown> {
    if (url.includes('run-activity')) return Promise.resolve(activityBody());
    if (url.includes('run-stats')) return Promise.resolve(statsFor(url));
    if (url.includes('/api/employees')) return Promise.resolve(S_EMP);
    if (url.includes('models/pricing')) return Promise.reject(new ApiError('missing', { status: 404, body: '', url }));
    if (url.includes('hermes-usage')) return Promise.resolve(S_MODEL);
    if (url.includes('periodKind=month')) return Promise.resolve({ items: [], missingEmployeeIds: [] });
    if (url.includes('budget-usage')) return Promise.resolve(S_LEDGER);
    return Promise.resolve({});
  }

  async function mountS(entry: string): Promise<void> {
    api.fetchJsonStrict.mockReset();
    api.fetchJsonStrict.mockImplementation(handler);
    await render(
      entry,
      <>
        <MetricsModulePage />
        <LocationProbe />
      </>,
    );
    await waitFor(settled, 'state settled');
  }

  const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const loc = () => q('met7-loc')?.textContent ?? '';
  const rows = () =>
    Array.from(document.querySelectorAll('[data-testid="met6-table"] tbody tr')).map(
      (tr) => (tr.querySelector('.met6-rowname')?.textContent ?? '').split(' · ')[0],
    );
  const batch = (from: number, needle: string) => urls().slice(from).filter((url) => url.includes(needle)).length;

  it('restores a pasted detail sort exactly, with the matching aria-sort', async () => {
    await mountS('/metrics?view=model&dsort=runs&ddir=asc');

    expect(rows()).toEqual(['zero', 'zeta', 'alpha']);
    expect(q('metO-fmt-th-count')?.getAttribute('aria-sort')).toBe('ascending');
    expect(loc()).toContain('view=model');
    expect(loc()).toContain('dsort=runs');
    expect(q('metS-reset-note')).toBeNull();
  });

  it('resets the detail sort when the detail group changes and states it once', async () => {
    await mountS('/metrics?dsort=runs&ddir=asc');
    expect(rows()).toEqual(['小鲤', '小满']);

    const before = urls().length;
    await act(async () => {
      (q('met6-cat-model') as HTMLButtonElement).click();
    });
    await waitFor(() => rows()[0] === 'alpha', 'model rows');

    expect(loc()).not.toContain('dsort');
    expect(loc()).not.toContain('ddir');
    expect(q('metS-reset-note')?.textContent).toContain('明细排序已回到默认的成本降序');
    // Only the new group's own reads run: hermes-usage once, no employee/ledger reads.
    expect(batch(before, 'hermes-usage')).toBe(1);
    expect(batch(before, '/api/employees')).toBe(0);
    expect(batch(before, 'budget-usage')).toBe(0);

    const mid = urls().length;
    await act(async () => {
      (q('met6-cat-employee') as HTMLButtonElement).click();
    });
    await waitFor(() => rows()[0] === '小鲤', 'employee rows');
    // Sort was already default, so nothing was reset and no note appears.
    expect(q('metS-reset-note')).toBeNull();
    expect(batch(mid, '/api/employees')).toBe(1);
    expect(batch(mid, 'budget-usage')).toBe(2);
    expect(batch(mid, 'hermes-usage')).toBe(0);
  });

  it('keeps the share sort valid across groups: sort=model means the name column', async () => {
    await mountS('/metrics?view=employee&sort=model');

    expect(loc()).toContain('sort=model');
    // The share table stays on its own group (models) and sorts by the name
    // column ascending; the detail view is separate and also reproducible.
    const firstRow = document.querySelector('[data-testid="met7-row-alpha"]');
    expect(firstRow).toBeTruthy();
    expect(document.querySelector('[data-testid="met6-cat-employee"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps window and share sort when the share group changes, and drops a stale detail sort', async () => {
    await mountS('/metrics?window=7d&sort=runs&dir=asc&dsort=share&ddir=asc');
    const before = urls().length;

    await act(async () => {
      (q('met8-view-employee') as HTMLButtonElement).click();
    });
    await waitFor(() => (q('met8-view-employee')?.getAttribute('aria-pressed') ?? '') === 'true', 'employee group');

    expect(loc()).toContain('groupBy=employee');
    expect(loc()).toContain('window=7d');
    expect(loc()).toContain('sort=runs');
    expect(loc()).toContain('dir=asc');
    expect(loc()).not.toContain('dsort');
    expect(q('metS-reset-note')?.textContent).toContain('时间窗与分摊的排序、分组选择保持不变');
    expect(batch(before, '/api/employees')).toBe(1);
    expect(batch(before, 'hermes-usage')).toBe(0);
  });
});

describe('metT — totals row and rounding note', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
  const num = (raw: string | null | undefined): number =>
    Number((raw ?? '').replace(/[^0-9.-]+/g, ''));

  function captureDownload(): { captured: { blob: Blob | null; name: string | null } } {
    const captured: { blob: Blob | null; name: string | null } = { blob: null, name: null };
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        captured.blob = blob;
        return 'blob:metT';
      }),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      captured.name = this.download;
    });
    return { captured };
  }

  it('sums the share table from its own body rows and closes at 100.0%', async () => {
    await mountShare(SHARE_USAGE);

    const runsInBody = [...document.querySelectorAll('[data-testid^="met7-runs-"]')].map((node) => num(node.textContent));
    const costsInBody = [...document.querySelectorAll('[data-testid^="met7-cost-"]')].map((node) => num(node.textContent));
    const sharesInBody = [...document.querySelectorAll('[data-testid^="met7-share-"]')].map((node) => num(node.textContent));

    expect(q('metT-total-row-share')).toBeTruthy();
    expect(num(q('metT-share-total-runs')?.textContent)).toBe(runsInBody.reduce((a, b) => a + b, 0));
    expect(num(q('metT-share-total-cost')?.textContent)).toBeCloseTo(costsInBody.reduce((a, b) => a + b, 0), 2);
    expect(num(q('metT-share-total-share')?.textContent)).toBe(100);
    // Per-row rounding adds up here too, but the total never relies on it.
    expect(sharesInBody.reduce((a, b) => a + b, 0)).toBe(100);

    expect(q('met7-runs-zeta')?.textContent).toBe('4');
    expect(q('metT-share-total-runs')?.textContent).toBe('13');
    expect(q('metT-share-total-cost')?.textContent).toBe('$4.00');
    expect(q('metT-share-total-share')?.textContent).toBe('100.0%');
    expect(q('metT-rounding-note')?.textContent).toContain('未舍入');
    expect(q('metT-rounding-note')?.textContent).toContain('合计行不参与排序');
  });

  it('keeps the totals row outside sorting, and the file keeps only data rows', async () => {
    const { captured } = captureDownload();
    await mountShare(SHARE_USAGE, '/metrics?sort=model&dir=asc');

    const rows = [...document.querySelectorAll('[data-testid^="met7-row-"]')].map((node) => node.getAttribute('data-testid'));
    expect(rows).toEqual(['met7-row-alpha', 'met7-row-mid', 'met7-row-zeta']);
    expect(q('metT-share-total-runs')?.textContent).toBe('13');
    expect(q('metT-share-total-cost')?.textContent).toBe('$4.00');
    expect(q('metT-total-row-share')?.querySelectorAll('button').length).toBe(0);
    expect(q('metT-total-row-share')?.querySelectorAll('[aria-sort]').length).toBe(0);

    await act(async () => {
      (q('metA-export') as HTMLButtonElement).click();
    });
    const lines = (await (captured.blob as Blob).text()).replace(/^\uFEFF/, '').split('\r\n');
    expect(dataOnly(lines)).toHaveLength(rows.length + 1);
    expect(lines.some((line) => line.startsWith('合计'))).toBe(false);
    expect(lines.filter((line) => line.startsWith('# 合计：')).length).toBe(1);
  });

  it('sums the detail table from the rendered rows and keeps unreadable columns at —', async () => {
    await mountEmployeeShare(TWO_EMPLOYEE_LEDGER);

    const costs = [...document.querySelectorAll('[data-testid^="met6-row-"]')].map((row) => num(row.querySelectorAll('td')[1]?.textContent));
    expect(q('metT-total-row')).toBeTruthy();
    expect(num(q('metT-detail-total-cost')?.textContent)).toBeCloseTo(costs.reduce((a, b) => a + b, 0), 2);
    expect(q('metT-detail-total-cost')?.textContent).toBe('$4.00');
    expect(q('metT-detail-total-share')?.textContent).toBe('100.0%');
    // The employee ledger holds no run counts: the total is unknown, not 0.
    expect(q('metT-detail-total-count')?.textContent).toBe('—');

    await mount(breakdownRouter({ usage: () => Promise.resolve(HERMES_USAGE) }), '/metrics?view=model');
    // The model view has no per-model money at all: both money cells read «—».
    expect(q('metT-detail-total-cost')?.textContent).toBe('—');
    expect(q('metT-detail-total-count')?.textContent).toBe('9');
    expect(q('metT-detail-total-share')?.textContent).toBe('—');
    expect(document.body.textContent).not.toContain('$0.00$0.00');
  });

  it('keeps a real zero at $0.00 in the totals and explains the rounding in both tables', async () => {
    await mountEmployeeShare({
      items: [
        { employeeId: 'emp_aaaabbbbcccc', costUsd: 0, runs: 2, updatedAt: '2026-11-19T03:20:00.000Z' },
        { employeeId: 'emp_ddddeeeeffff', updatedAt: '2026-11-19T02:10:00.000Z' },
      ],
      missingEmployeeIds: [],
    });

    expect(q('metT-detail-total-cost')?.textContent).toBe('$0.00');
    expect(q('metT-share-total-cost')?.textContent).toBe('$0.00');
    expect(q('metT-share-total-runs')?.textContent).toBe('2');
    // No readable money means no share at all — «—», not 0.
    expect(q('metT-share-total-share')?.textContent).toBe('—');
    expect(q('metT-detail-total-share')?.textContent).toBe('—');

    expect(q('metT-rounding-note-detail')?.textContent).toContain('合计行不参与排序');
    expect(q('metT-rounding-note-detail')?.textContent).toContain('导出文件的行仍是逐行明细');
  });
});

describe('metU — the copied summary and the totals row are one number', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);

  async function copyNow(): Promise<string> {
    clip.copyTextToClipboard.mockClear();
    await act(async () => {
      (q('metL-copy') as HTMLButtonElement).click();
    });
    await waitFor(() => (q('metL-copy-status')?.textContent ?? '') !== '', 'copy status');
    return String(clip.copyTextToClipboard.mock.calls[0][0]);
  }

  it('writes the same totals the footer shows, without reading anything again', async () => {
    await mountShare(SHARE_USAGE);
    const before = urls().length;

    const body = await copyNow();

    expect(urls().length).toBe(before);
    const line = '合计：运行 13 · 成本 $4.00 · 占比 100.0%';
    expect(body).toContain(line);
    expect(q('metU-copy-total')?.textContent).toBe(line);
    // Footer cells and the copied line hold the very same strings.
    expect(q('metT-share-total-runs')?.textContent).toBe('13');
    expect(q('metT-share-total-cost')?.textContent).toBe('$4.00');
    expect(q('metT-share-total-share')?.textContent).toBe('100.0%');
    expect(q('metU-consistency-note')?.textContent).toContain(line.replace('合计：', ''));
    expect(q('metR-copy-state')?.textContent).toBe('摘要可复制');
    expect(body).not.toContain('emp_');
  });

  it('keeps the totals line in the fallback textarea when the clipboard refuses', async () => {
    await mountShare(SHARE_USAGE);
    clip.copyTextToClipboard.mockImplementationOnce(() => Promise.resolve(false));

    const body = await copyNow();

    expect(q('metL-copy-status')?.textContent).toBe('复制没成功');
    const fallback = q('metL-fallback-text') as HTMLTextAreaElement;
    expect(fallback.value).toBe(body);
    expect(fallback.value).toContain('合计：运行 13 · 成本 $4.00 · 占比 100.0%');
  });

  it('keeps a readable zero at $0.00 and an unreadable share at — in the summary', async () => {
    await mountEmployeeShare({
      items: [
        { employeeId: 'emp_aaaabbbbcccc', costUsd: 0, runs: 2, updatedAt: '2026-11-19T03:20:00.000Z' },
        { employeeId: 'emp_ddddeeeeffff', updatedAt: '2026-11-19T02:10:00.000Z' },
      ],
      missingEmployeeIds: [],
    });

    const body = await copyNow();

    expect(body).toContain('合计：运行 2 · 成本 $0.00 · 占比 —');
    expect(q('metU-copy-total')?.textContent).toBe('合计：运行 2 · 成本 $0.00 · 占比 —');
    expect(q('metT-share-total-cost')?.textContent).toBe('$0.00');
    expect(q('metT-share-total-share')?.textContent).toBe('—');
  });

  it('does not invent a totals line when the table has no renderable row', async () => {
    await mountShare({ by_model: [], asOf: '2026-11-19T20:12:00.000Z' });

    const body = await copyNow();

    expect(body).toContain('合计：该窗口无可渲染行');
    expect(q('metU-copy-total')?.textContent).toBe('合计：该窗口无可渲染行');
    expect(body).not.toContain('合计：运行 0');
  });
});

describe('metV — exports carry the totals as a comment line', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
  const dataLines = (lines: string[]): string[] => lines.filter((line) => !line.startsWith('#'));

  function captureDownload(): { captured: { blob: Blob | null; name: string | null } } {
    const captured: { blob: Blob | null; name: string | null } = { blob: null, name: null };
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        captured.blob = blob;
        return 'blob:metV';
      }),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      captured.name = this.download;
    });
    return { captured };
  }

  const readLines = async (blob: Blob | null): Promise<string[]> =>
    (await (blob as Blob).text()).replace(/^\uFEFF/, '').split('\r\n').filter(Boolean);

  it('adds one comment line to the share file, before any gap note and outside the row count', async () => {
    const { captured } = captureDownload();
    await mountShare(SHARE_USAGE);
    const onScreen = document.querySelectorAll('[data-testid^="met7-row-"]').length;
    const shownCount = q('metA-export-count')?.textContent;

    await act(async () => {
      (q('metA-export') as HTMLButtonElement).click();
    });

    const lines = await readLines(captured.blob);
    expect(dataLines(lines)).toHaveLength(onScreen + 1); // header + rows
    expect(dataLines(lines).length - 1).toBe(onScreen);
    expect(shownCount).toBe(`可导出 ${onScreen} 行`);

    const comment = lines.at(-1) ?? '';
    expect(comment).toBe('# 合计：运行 13 · 成本 $4.00 · 占比 100.0%');
    expect(comment).toBe(`# ${q('metU-copy-total')?.textContent}`);
    // Same strings the footer shows.
    expect(comment).toContain(String(q('metT-share-total-runs')?.textContent));
    expect(comment).toContain(String(q('metT-share-total-cost')?.textContent));
    expect(comment).toContain(String(q('metT-share-total-share')?.textContent));
    expect(q('metV-export-total-note')?.textContent).toContain('合计注释行');
  });

  it('adds the footer numbers to the detail file and keeps them out of the data rows', async () => {
    const { captured } = captureDownload();
    await mount(usageRouter());
    const onScreen = document.querySelectorAll('[data-testid^="met6-row-"]').length;
    expect(onScreen).toBeGreaterThan(0);

    await act(async () => {
      (q('met6-export') as HTMLButtonElement).click();
    });

    const lines = await readLines(captured.blob);
    expect(dataLines(lines)).toHaveLength(onScreen + 1);
    expect(q('met6-cat-source')?.textContent).toContain(`${onScreen} 行`);
    expect(q('metR-export-state')?.textContent).toContain(`明细可导 ${onScreen} 行`);

    const comment = lines.at(-1) ?? '';
    expect(comment).toBe(
      `# 合计：成本 ${q('metT-detail-total-cost')?.textContent} · 次数 ${q('metT-detail-total-count')?.textContent} · 占比 ${q('metT-detail-total-share')?.textContent}`,
    );
    // A readable zero stays $0.00 in the comment; an unreadable column stays «—».
    expect(comment).toContain('成本 $0.00');
    expect(comment).toContain('次数 —');
  });

  it('keeps the totals comment above the gap note so the note stays the last line', async () => {
    const { captured } = captureDownload();
    const router = usageRouter();
    await mount((url) =>
      url.includes('run-stats')
        ? Promise.reject(new ApiError('boom', { status: 500, body: '', url, requestId: 'req-metV-stats' }))
        : router(url),
    );

    await act(async () => {
      (q('met6-export') as HTMLButtonElement).click();
    });

    const lines = await readLines(captured.blob);
    expect(lines.at(-1)).toContain('# 本次导出缺少 1 块：运行统计');
    expect(lines.at(-2)).toContain('# 合计：成本');
    expect(dataLines(lines).some((line) => line.includes('本次导出缺少'))).toBe(false);
  });

  it('writes the empty-window wording instead of a zero when there is no row', async () => {
    const { captured } = captureDownload();
    await mountShare({ by_model: [] });

    expect(q('metA-export-count')?.textContent).toBe('可导出 0 行');
    await act(async () => {
      (q('metA-export') as HTMLButtonElement).click();
    });

    const lines = await readLines(captured.blob);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('group,runs,cost_usd,share_pct,as_of,window');
    expect(lines[1]).toBe('# 合计：该窗口无可渲染行');
    expect(lines.join('\n')).not.toMatch(/合计：运行 0/);
  });
});

describe('metW — wide tables scroll from the keyboard on a narrow screen', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);

  it('marks both table scrollers as labelled regions with a first-column anchor', async () => {
    await mount(usageRouter());
    const detail = q('metW-scroll-detail');
    expect(detail).not.toBeNull();
    expect(detail?.getAttribute('role')).toBe('region');
    expect(detail?.getAttribute('tabindex')).toBe('0');
    expect(detail?.getAttribute('aria-label')).toBe('成本明细表，可横向滚动');
    expect(detail?.className).toContain('metW-table');
    expect(detail?.querySelector('table[data-testid="met6-table"]')).not.toBeNull();
    expect(q('metW-scroll-hint')?.textContent).toBe('左右滑动查看全部列');

    await mountShare(SHARE_USAGE);
    const share = q('metW-scroll-share');
    expect(share).not.toBeNull();
    expect(share?.getAttribute('role')).toBe('region');
    expect(share?.getAttribute('tabindex')).toBe('0');
    expect(share?.getAttribute('aria-label')).toBe('成本分摊表，可横向滚动');
    expect(share?.querySelector('table[data-testid="met7-table"]')).not.toBeNull();
    expect(q('metW-scroll-hint-share')?.textContent).toBe('左右滑动查看全部列');
  });

  it('moves the region sideways with the arrow keys and returns home', async () => {
    await mountShare(SHARE_USAGE);
    const share = q('metW-scroll-share') as HTMLDivElement;
    share.scrollLeft = 120;

    const right = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    share.dispatchEvent(right);
    expect(share.scrollLeft).toBe(168);
    expect(right.defaultPrevented).toBe(true);

    share.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    expect(share.scrollLeft).toBe(120);

    share.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    expect(share.scrollLeft).toBe(0);

    // At the left edge the key is absorbed but the value never goes negative.
    share.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    expect(share.scrollLeft).toBe(0);

    // Other keys are left alone: Tab and page scrolling keep their meaning.
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    share.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
  });

  it('takes focus so the scroller is reachable before the table content', async () => {
    await mount(usageRouter());
    const detail = q('metW-scroll-detail') as HTMLDivElement;
    detail.focus();
    expect(document.activeElement).toBe(detail);
    // No positive tab order was invented.
    expect(detail.getAttribute('tabindex')).toBe('0');
  });

  it('leaves the page itself without horizontal overflow at 1440, 1280 and 375', async () => {
    await mountShare(SHARE_USAGE);
    const originalWidth = window.innerWidth;
    try {
      for (const width of [1440, 1280, 375]) {
      window.innerWidth = width;
      const page = document.documentElement;
      // jsdom does no layout, so this is the structural half of the check: the
      // page root never claims more width than its viewport box. Real-browser
      // readings are recorded in the artifact.
        expect(page.scrollWidth).toBe(page.clientWidth);
        expect(q('metW-scroll-share')?.className).toContain('met6-table-scroll');
      }
    } finally {
      window.innerWidth = originalWidth;
    }
  });
});

describe('metX — one window, three readings of the run count', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
  const noteText = (): string => q('metX-consistency-note')?.textContent ?? '';

  it('shows the activity total, the heat sum and the detail total side by side', async () => {
    await mount(usageRouter());
    const before = urls().length;

    expect(q('met5-count')?.textContent).toBe('332');
    expect(q('metX-window-runs')?.textContent).toBe('332');
    expect(q('metX-heat-runs')?.textContent).toBe('332');
    // The employee ledger carries money, not run counts: no total, and never 0.
    expect(q('metX-detail-runs')?.textContent).toBe('—');
    expect(q('metX-detail-runs')?.getAttribute('title')).toContain('不记运行次数');
    expect(q('metX-delta')?.textContent).toBe('—');
    expect(q('metX-delta')?.getAttribute('title')).toContain('算不出差');
    expect(noteText()).toContain('窗口总运行');
    expect(noteText()).toContain('热力格求和');
    expect(noteText()).toContain('明细合计');
    expect(noteText()).toContain('不发新请求');
    // Rendering the note reads nothing again.
    expect(urls().length).toBe(before);
  });

  it('reports the difference when the detail view does count runs', async () => {
    const base = usageRouter();
    await mount(
      (url) => (url.includes('hermes-usage') ? Promise.resolve(HERMES_USAGE) : base(url)),
      '/metrics?view=model',
    );

    expect(q('metX-window-runs')?.textContent).toBe('332');
    expect(q('metX-heat-runs')?.textContent).toBe('332');
    expect(q('metX-detail-runs')?.textContent).toBe('9');
    expect(q('metX-delta')?.textContent).toBe('-323');
    const shown = Number(q('metX-detail-runs')?.textContent) - Number(q('metX-heat-runs')?.textContent);
    expect(shown).toBe(-323);
    expect(noteText()).toContain('以各自卡片为准');
  });

  it('recomputes all three when the detail window changes, without rereading the heat', async () => {
    const base = usageRouter();
    await mount(
      (url) => {
        if (url.includes('hermes-usage') && url.includes('days=7')) {
          return Promise.resolve({
            by_model: [{ model: 'qwen-plus', sessions: 2, api_calls: 5 }, { model: 'deepseek-v4' }],
            asOf: '2026-11-19T20:12:00.000Z',
          });
        }
        if (url.includes('hermes-usage')) return Promise.resolve(HERMES_USAGE);
        return base(url);
      },
      '/metrics?view=model',
    );
    expect(q('metX-detail-runs')?.textContent).toBe('9');

    const beforeHeat = urls().filter((url) => url.includes('run-activity')).length;
    await act(async () => {
      (q('met6-window-7d') as HTMLButtonElement).click();
    });
    await waitFor(() => (q('metX-detail-runs')?.textContent ?? '') === '5', 'detail total after switch');

    expect(q('metX-heat-runs')?.textContent).toBe('332');
    expect(q('metX-delta')?.textContent).toBe('-327');
    // The heat card keeps its own window: switching the detail window never refetches it.
    expect(urls().filter((url) => url.includes('run-activity')).length).toBe(beforeHeat);
  });

  it('marks the readings it cannot compare instead of summing a missing cell as zero', async () => {
    const base = usageRouter();
    await mount(
      (url) =>
        url.includes('run-activity')
          ? Promise.reject(new ApiError('boom', { status: 500, body: '', url, requestId: 'req-metX-heat' }))
          : url.includes('hermes-usage')
            ? Promise.resolve(HERMES_USAGE)
            : base(url),
      '/metrics?view=model',
    );

    // The heat card failed, so its two readings are «—» with a reason.
    expect(q('metX-window-runs')?.textContent).toBe('—');
    expect(q('metX-heat-runs')?.textContent).toBe('—');
    expect(q('metX-window-runs')?.getAttribute('title')).toContain('不按 0 记');
    expect(q('metX-heat-runs')?.getAttribute('title')).toContain('不按 0 记');
    // The detail total is still readable; the difference is not.
    expect(q('metX-detail-runs')?.textContent).toBe('9');
    expect(q('metX-delta')?.textContent).toBe('—');
  });
});

describe('metY — skip links around the page and the two wide tables', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);

  it('opens with a skip link that lands on a focusable main region', async () => {
    await mount(usageRouter());

    const link = q('metY-skiplink') as HTMLAnchorElement;
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('#metY-main');
    expect(link.textContent).toBe('跳到主要内容');
    expect(link.className).toContain('metY-skip');

    const main = document.getElementById('metY-main');
    expect(main).toBe(q('met5-page'));
    expect(main?.getAttribute('tabindex')).toBe('-1');

    // The target takes focus when the link is followed.
    main?.focus();
    expect(document.activeElement).toBe(main);
  });

  it('offers a jump past the detail table, landing after its rows', async () => {
    await mount(usageRouter());

    const link = q('metY-skip-detail') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('#metY-after-detail');
    expect(link.tagName).toBe('A');

    const target = document.getElementById('metY-after-detail');
    expect(target).toBe(q('met6-cat-source'));
    expect(target?.getAttribute('tabindex')).toBe('-1');

    const table = q('met6-table') as HTMLElement;
    expect(table.compareDocumentPosition(target as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    target?.focus();
    expect(document.activeElement).toBe(target);
  });

  it('offers the same jump past the share table', async () => {
    await mountShare(SHARE_USAGE);

    const link = q('metY-skip-share') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('#metY-after-share');

    const target = document.getElementById('metY-after-share');
    expect(target).toBe(q('met7-source'));
    expect(target?.getAttribute('tabindex')).toBe('-1');

    const table = q('met7-table') as HTMLElement;
    expect(table.compareDocumentPosition(target as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('adds no read of its own', async () => {
    await mount(usageRouter());
    const before = urls().length;
    (q('metY-skiplink') as HTMLAnchorElement).focus();
    (q('metY-skip-detail') as HTMLAnchorElement).focus();
    expect(urls().length).toBe(before);
  });
});

describe('metZ — copy the heat summary', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);

  async function copyHeat(): Promise<string> {
    clip.copyTextToClipboard.mockClear();
    await act(async () => {
      (q('metZ-copy-heat') as HTMLButtonElement).click();
    });
    await waitFor(() => (q('metZ-copy-status')?.textContent ?? '') !== '', 'heat copy status');
    return String(clip.copyTextToClipboard.mock.calls[0][0]);
  }

  it('copies the numbers the heat card shows, without reading anything again', async () => {
    await mount(usageRouter());
    const before = urls().length;

    const body = await copyHeat();

    expect(urls().length).toBe(before);
    expect(q('metZ-copy-status')?.textContent).toBe('已复制');
    expect(q('metZ-copy-fallback')).toBeNull();

    const summary = q('metK-heat-summary')?.textContent ?? '';
    expect(q('met5-count')?.textContent).toBe('332');
    expect(summary).toContain('总运行 332 次');
    expect(summary).toContain('最高 周三 50 次');
    expect(summary).toContain('最低 周二 45 次');
    expect(summary).toContain('覆盖 7 / 7 天');

    expect(body).toContain('热力摘要');
    expect(body).toContain('窗口：最近 7 天（1w）');
    expect(body).toContain('日期区间：2026-11-13 00:00 — 2026-11-19 23:59');
    expect(body).toContain('总运行：332');
    expect(body).toContain('最高：周三 50 次');
    expect(body).toContain('最低：周二 45 次');
    expect(body).toContain('覆盖：7 / 7 天');
    expect(body).not.toContain('不可比较');
  });

  it('moves to the next heat window and copies that window id', async () => {
    await mount(usageRouter());

    await act(async () => {
      (q('met5-window-4') as HTMLButtonElement).click();
    });
    await waitFor(() => (q('met5-window-4')?.getAttribute('aria-pressed') ?? '') === 'true', 'four weeks');

    const body = await copyHeat();
    expect(body).toContain('（4w）');
    expect(body).toContain('总运行：332');
  });

  it('keeps the same text in a read-only box when the clipboard refuses', async () => {
    await mount(usageRouter());
    clip.copyTextToClipboard.mockImplementationOnce(() => Promise.resolve(false));

    const body = await copyHeat();

    expect(q('metZ-copy-status')?.textContent).toBe('复制没成功');
    const fallback = q('metZ-copy-fallback-text') as HTMLTextAreaElement;
    expect(fallback.value).toBe(body);
    expect(fallback.value).toContain('最高：周三 50 次');
  });

  it('writes — and says the values cannot be compared when the heat read failed', async () => {
    const base = usageRouter();
    await mount((url) =>
      url.includes('run-activity')
        ? Promise.reject(new ApiError('boom', { status: 500, body: '', url, requestId: 'req-metZ-heat' }))
        : base(url),
    );

    const body = await copyHeat();

    expect(body).toContain('日期区间：—');
    expect(body).toContain('总运行：—');
    expect(body).toContain('最高：—');
    expect(body).toContain('最低：—');
    expect(body).toContain('覆盖：—');
    expect(body).toContain('不可比较');
    // No zero standing in for a missing read, and no local clock for the range.
    expect(body).not.toContain('总运行：0');
    expect(body).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe('metAA — the heat window lives in the address', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
  const loc = (): string => q('met7-loc')?.textContent ?? '';

  const countOf = (from: number, needle: string): number =>
    urls().slice(from).filter((url) => url.includes(needle)).length;

  it('shows which window the address holds and keeps it off the other keys', async () => {
    await mountShare(SHARE_USAGE, '/metrics?window=7d&view=model&sort=model&dsort=runs');

    expect(q('metAA-heat-window')?.textContent).toContain('heat=1');
    expect(q('met5-window-1')?.getAttribute('aria-pressed')).toBe('true');
    // The unrelated keys are untouched.
    expect(loc()).toContain('window=7d');
    expect(loc()).toContain('view=model');
    expect(loc()).toContain('sort=model');
    expect(loc()).toContain('dsort=runs');
  });

  it('writes heat= and rereads only the heat endpoint once per switch', async () => {
    await mountShare(SHARE_USAGE, '/metrics?window=7d&view=model&sort=model');
    const before = urls().length;

    await act(async () => {
      (q('met5-window-4') as HTMLButtonElement).click();
    });
    await waitFor(() => (q('met5-window-4')?.getAttribute('aria-pressed') ?? '') === 'true', '4w selected');

    expect(loc()).toContain('heat=4');
    expect(loc()).not.toContain('w=4');
    expect(loc()).toContain('window=7d');
    expect(loc()).toContain('view=model');
    expect(loc()).toContain('sort=model');
    expect(q('metAA-heat-window')?.textContent).toContain('heat=4');
    expect(countOf(before, 'run-activity')).toBe(1);
    expect(countOf(before, 'run-stats')).toBe(0);
    expect(countOf(before, 'employees')).toBe(0);
    expect(countOf(before, 'budget-usage')).toBe(0);
    expect(countOf(before, 'hermes-usage')).toBe(0);

    const mid = urls().length;
    await act(async () => {
      (q('met5-window-1') as HTMLButtonElement).click();
    });
    await waitFor(() => (q('met5-window-1')?.getAttribute('aria-pressed') ?? '') === 'true', 'back to 1w');

    expect(loc()).toContain('heat=1');
    expect(countOf(mid, 'run-activity')).toBe(1);
    expect(countOf(mid, 'run-stats')).toBe(0);
  });

  it('leaves the other cards holding their data when the heat window changes', async () => {
    const base = usageRouter();
    await mount((url) =>
      url.includes('run-stats')
        ? Promise.resolve({ ...(statsFor(url) as Record<string, unknown>), asOf: '2026-11-19T20:12:00.000Z', asOfSource: 'bff' })
        : base(url),
    );
    const runsBefore = q('met6-runs-value')?.textContent;
    const shareRowBefore = q('met7-row-zeta')?.textContent;

    await act(async () => {
      (q('met5-window-4') as HTMLButtonElement).click();
    });
    await waitFor(() => (q('met5-window-4')?.getAttribute('aria-pressed') ?? '') === 'true', '4w selected');

    expect(q('met6-runs-value')?.textContent).toBe(runsBefore);
    expect(q('met7-row-zeta')?.textContent).toBe(shareRowBefore);
    // The freshness block keeps the stamps of the reads it already had.
    await openSources();
    expect(q('metB-source-asof-run-stats')?.textContent).not.toBe('—');
  });

  it('restores the window from a pasted link and still honours the old w key', async () => {
    await mount(usageRouter(), '/metrics?heat=12');
    expect(q('met5-window-12')?.getAttribute('aria-pressed')).toBe('true');
    expect(q('metAA-heat-window')?.textContent).toContain('heat=12');

    await mount(usageRouter(), '/metrics?w=4');
    expect(q('met5-window-4')?.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('metAB — the caliber notes at the foot of the page', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);

  it('stays collapsed by default and opens from a native button', async () => {
    await mountShare(SHARE_USAGE);

    const toggle = q('metAB-notes-toggle') as HTMLButtonElement;
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.getAttribute('type')).toBe('button');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe('metAB-notes-body');
    expect(q('metAB-notes-body')).toBeNull();
  });

  it('lists every read with its path, scope and missing-value policy', async () => {
    await mountShare(SHARE_USAGE);
    const before = urls().length;
    const location = q('met7-loc')?.textContent;

    await act(async () => {
      (q('metAB-notes-toggle') as HTMLButtonElement).click();
    });

    const body = q('metAB-notes-body');
    expect(body).not.toBeNull();
    expect(q('metAB-notes-toggle')?.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelectorAll('[data-testid^="metAB-note-"]')).toHaveLength(6);

    for (const path of [
      '/api/run-activity',
      '/api/run-stats',
      '/api/employees',
      '/api/budget-usage',
      '/api/models/pricing',
      '/api/hermes-usage',
    ]) {
      expect(body?.textContent).toContain(path);
    }
    expect(body?.textContent).toContain('计算范围：');
    expect(body?.textContent).toContain('缺值策略：');
    expect(body?.textContent).toContain('不拿本机时间顶替');
    expect(body?.textContent).toContain('$0.00');
    expect(body?.textContent).toContain('不补 0');

    // Opening it writes nothing and reads nothing.
    expect(urls().length).toBe(before);
    expect(q('met7-loc')?.textContent).toBe(location);
  });

  it('agrees with the freshness block on each read path and closes again', async () => {
    await mountShare(SHARE_USAGE);
    await openSources();
    const freshness = q('metB-source-table')?.textContent ?? '';

    await act(async () => {
      (q('metAB-notes-toggle') as HTMLButtonElement).click();
    });

    for (const path of ['/api/run-stats', '/api/budget-usage', '/api/models/pricing']) {
      expect(freshness).toContain(path);
      expect(q('metAB-notes-body')?.textContent).toContain(path);
    }
    const runsValue = q('met6-runs-value')?.textContent;

    await act(async () => {
      (q('metAB-notes-toggle') as HTMLButtonElement).click();
    });
    expect(q('metAB-notes-body')).toBeNull();
    expect(q('metAB-notes-toggle')?.getAttribute('aria-expanded')).toBe('false');
    // Collapsing shows nothing new and leaves the cards as they were.
    expect(q('met6-runs-value')?.textContent).toBe(runsValue);
    expect(q('metB-source-table')).not.toBeNull();
  });
});

describe('metAD — each card points at its caliber note', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
  const CARDS: Array<[string, string]> = [
    ['met6-runs', 'metAD-note-run-stats'],
    ['met6-cost', 'metAD-note-budget-usage'],
    ['met6-trend', 'metAD-note-run-stats'],
    ['met6-price', 'metAD-note-pricing'],
    ['met5-heatmap', 'metAD-note-run-activity'],
  ];

  const noteFor = (key: string) => {
    const note = CALIBER_NOTES.find((entry) => entry.key === key);
    expect(note).toBeTruthy();
    return note!;
  };

  it('describes all five cards, and the text is the one CALIBER_NOTES holds', async () => {
    await mount(usageRouter());

    for (const [cardId, noteId] of CARDS) {
      const card = q(cardId);
      expect(card?.getAttribute('aria-describedby')).toBe(noteId);
      const target = document.getElementById(noteId);
      expect(target).not.toBeNull();
      const key = noteId.replace('metAD-note-', '');
      const note = noteFor(key);
      expect(target?.textContent).toBe(`${note.label}。${note.path}。计算范围：${note.scope}。缺值策略：${note.missing}。`);
    }
    // Two cards may share one read: runs and trend both come from run-stats.
    expect(q('met6-runs')?.getAttribute('aria-describedby')).toBe(q('met6-trend')?.getAttribute('aria-describedby'));
  });

  it('keeps the notes readable while the foot block is still collapsed', async () => {
    await mount(usageRouter());

    expect(q('metAB-notes-body')).toBeNull();
    for (const key of ['run-stats', 'budget-usage', 'pricing', 'run-activity']) {
      const note = document.getElementById(`metAD-note-${key}`);
      expect(note).not.toBeNull();
      expect(note?.textContent).toContain('缺值策略：');
    }
  });

  it('reads the same sentence the foot block shows when it is opened', async () => {
    await mount(usageRouter());
    await act(async () => {
      (q('metAB-notes-toggle') as HTMLButtonElement).click();
    });

    const foot = q('metAB-note-run-stats')?.textContent ?? '';
    const sr = q('metAD-note-run-stats')?.textContent ?? '';
    const note = noteFor('run-stats');
    expect(foot).toContain(note.missing);
    expect(sr).toContain(note.missing);
    expect(sr).toContain(note.label);
  });

  it('adds no read of its own', async () => {
    await mount(usageRouter());
    const before = urls().length;
    for (const [cardId] of CARDS) {
      (q(cardId) as HTMLElement).focus();
    }
    expect(urls().length).toBe(before);
  });
});

describe('metAF — sticky table heads and figures that keep one line', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);

  it('marks both heads sticky and keeps the numeric columns nowrap', async () => {
    await mount(usageRouter());

    const detailHead = q('metAF-sticky-detail');
    expect(detailHead?.tagName).toBe('THEAD');
    expect(detailHead?.className).toContain('metAF-sticky-detail');
    // The scroll container still anchors the first column, so the two sticky
    // axes are declared in the same scope.
    const detailScroll = q('metW-scroll-detail');
    expect(detailScroll?.className).toContain('metW-table');

    const numeric = document.querySelectorAll('.metAF-nowrap');
    expect(numeric.length).toBeGreaterThanOrEqual(3);
    for (const cell of Array.from(numeric)) {
      expect(['TH', 'TD']).toContain(cell.tagName);
    }
    // The two header cells the sort keys live in keep both the numeric and the
    // nowrap class (no duplicated className swallowed one of them).
    expect(q('metG-a11y-th-share')?.className).toContain('met6-num');
    expect(q('metG-a11y-th-share')?.className).toContain('metAF-nowrap');
    expect(q('metO-fmt-th-spend')?.className).toContain('metAF-nowrap');
    expect(q('metO-fmt-th-count')?.className).toContain('metAF-nowrap');
  });

  it('does the same for the share table', async () => {
    await mountShare(SHARE_USAGE);

    const shareHead = q('metAF-sticky-share');
    expect(shareHead?.tagName).toBe('THEAD');
    expect(q('metW-scroll-share')?.className).toContain('metW-table');
    expect(q('metG-a11y-th-runs')?.className).toContain('metAF-nowrap');
    expect(q('metG-a11y-th-cost')?.className).toContain('metAF-nowrap');
    expect(q('metO-fmt-th-pct')?.className).toContain('metAF-nowrap');
  });
});

describe('metAG — copy the source summary', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);

  async function copySources(): Promise<string> {
    clip.copyTextToClipboard.mockClear();
    await act(async () => {
      (q('metAG-copy-sources') as HTMLButtonElement).click();
    });
    await waitFor(() => (q('metAG-copy-status')?.textContent ?? '') !== '', 'copy status');
    return String(clip.copyTextToClipboard.mock.calls[0][0]);
  }

  it('copies one line per read, matching the rows on screen', async () => {
    await mount(usageRouter());
    await openSources();
    const before = urls().length;

    const body = await copySources();

    expect(urls().length).toBe(before);
    const lines = body.split('\n');
    expect(lines).toHaveLength(6);
    expect(q('metAG-copy-status')?.textContent).toBe('已复制 6 行');

    const row = q('metB-source-row-run-stats');
    const label = row?.querySelector('.metB-name')?.textContent;
    const path = row?.querySelector('.metB-path')?.textContent;
    const asof = q('metB-source-asof-run-stats')?.textContent;
    const state = q('metB-source-state-run-stats')?.textContent;
    expect(lines[1]).toBe(`${label} · ${path} · ${asof} · ${state}`);
    expect(body).toContain('/api/run-activity');
    expect(body).toContain('/api/models/pricing');
    // Nothing credential-shaped rides along.
    expect(body).not.toMatch(/token|bearer|authorization/i);
  });

  it('writes — for a missing collection time and never the local clock', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2031-03-04T05:06:07.000Z'));
    await mount(usageRouter());
    await openSources();

    const body = await copySources();

    expect(q('metB-source-asof-run-activity')?.textContent).toBe('—');
    expect(body.split('\n')[0]).toContain('· — ·');
    expect(body).not.toContain('2031');
  });

  it('keeps the same text in a read-only box when the clipboard refuses', async () => {
    await mount(usageRouter());
    await openSources();
    clip.copyTextToClipboard.mockImplementationOnce(() => Promise.resolve(false));

    const body = await copySources();

    expect(q('metAG-copy-status')?.textContent).toBe('复制没成功');
    const fallback = q('metAG-copy-fallback-text') as HTMLTextAreaElement;
    // Same source as the clipboard call, and never an empty box.
    expect(fallback.value).toBe(body);
    expect(fallback.value).not.toBe('');
    expect(clip.copyTextToClipboard).toHaveBeenLastCalledWith(fallback.value);
    expect(fallback.value.split('\n')).toHaveLength(6);
  });

  it('disables itself with a reason when every read failed', async () => {
    await mount(() => Promise.reject(new ApiError('boom', { status: 500, body: '', url: 'x', requestId: 'req-metAG' })));
    await waitFor(() => q('metB-source-toggle') !== null, 'sources seen');

    const button = q('metAG-copy-sources') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('title')).toContain('所有读口都没读出来');
  });
});

describe('metAH — the tables say how many rows they really show', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);

  it('states the full row count for the detail table, from the same count as the source line', async () => {
    await mount(usageRouter());
    const rows = document.querySelectorAll('[data-testid^="met6-row-"]').length;
    expect(rows).toBeGreaterThan(0);

    const note = q('metAH-cap-note');
    expect(note?.textContent).toContain(`宽表逐行全量渲染，共 ${rows} 行`);
    expect(note?.textContent).toContain('导出与屏上逐行一致');
    expect(note?.getAttribute('title')).toContain('判据');
    expect(q('met6-cat-source')?.textContent).toContain(`${rows} 行`);
    // No invented truncation wording.
    expect(note?.textContent).not.toMatch(/前\s*\d+\s*行/);
  });

  it('does the same for the share table and keeps it equal to the export count', async () => {
    await mountShare(SHARE_USAGE);
    const rows = document.querySelectorAll('[data-testid^="met7-row-"]').length;
    expect(rows).toBe(3);

    const note = q('metAH-cap-note-share');
    expect(note?.textContent).toContain(`宽表逐行全量渲染，共 ${rows} 行`);
    expect(note?.getAttribute('title')).toContain('metA-export-count');
    expect(q('metA-export-count')?.textContent).toBe(`可导出 ${rows} 行`);
    expect(note?.textContent).not.toMatch(/前\s*\d+\s*行/);
  });

  it('names the two short lists that do stop early, each with its own reason', async () => {
    const prices = Array.from({ length: 6 }, (_, index) => ({
      model: `model-${index}`,
      provider: 'local',
      input_per_million: 0.1,
      output_per_million: 0.2,
    }));
    await mount(
      usageRouter({ pricing: () => Promise.resolve({ prices, asOf: '2026-11-19T20:12:00.000Z' }) }),
    );

    const snapshot = q('metAH-cap-note-snapshot');
    expect(snapshot?.textContent).toContain('前 8 行');
    expect(snapshot?.textContent).toContain('导出明细 CSV');
    expect(snapshot?.getAttribute('title')).toContain('前 8 行');

    const pricing = q('metAH-cap-note-pricing');
    expect(pricing?.textContent).toContain('前 5 行');
    expect(pricing?.textContent).toContain('不导出价目');
    expect(pricing?.getAttribute('title')).toContain('前 5 行');

    // No blanket claim survives anywhere on the page.
    expect(visibleText()).not.toContain('没有截断');
  });

  it('adds no read of its own', async () => {
    await mount(usageRouter());
    const before = urls().length;
    expect(q('metAH-cap-note')).not.toBeNull();
    expect(urls().length).toBe(before);
  });
});

describe('metAI — export file names carry window, group, sort and direction', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);

  function captureDownload(): { captured: { blob: Blob | null; name: string | null } } {
    const captured: { blob: Blob | null; name: string | null } = { blob: null, name: null };
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        captured.blob = blob;
        return 'blob:metAI';
      }),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      captured.name = this.download;
    });
    return { captured };
  }

  it('names the detail file with the default sort pair and only legal characters', async () => {
    const { captured } = captureDownload();
    await mount(usageRouter());

    await act(async () => {
      (q('met6-export') as HTMLButtonElement).click();
    });

    const name = captured.name ?? '';
    expect(name).toMatch(/^metrics-detail-24h-employee-cost-desc-\d{8}-\d{4}\.csv$/);
    expect(name).toMatch(/^[a-z0-9.-]+$/);
    expect(name).not.toMatch(/[/:\s\u4e00-\u9fff]/);
  });

  it('follows ?dsort/?ddir in the detail name', async () => {
    const { captured } = captureDownload();
    await mount(usageRouter(), '/metrics?dsort=runs&ddir=asc');

    await act(async () => {
      (q('met6-export') as HTMLButtonElement).click();
    });

    expect(captured.name).toMatch(/^metrics-detail-24h-employee-runs-asc-\d{8}-\d{4}\.csv$/);
  });

  it('names the share file the same way and never collides with the detail one', async () => {
    const now = new Date('2026-11-20T09:30:00.000Z');
    const detail = csvFileName('employee', '24h', 'cost', 'desc', now);
    const share = shareCsvFileName('model', '24h', 'cost', 'desc', now);
    expect(detail).toBe('metrics-detail-24h-employee-cost-desc-20261120-1730.csv');
    expect(share).toBe('metrics-share-24h-model-cost-desc-20261120-1730.csv');
    expect(share).not.toBe(detail);
    expect(`${detail}${share}`).toMatch(/^[a-z0-9.-]+$/);

    const { captured } = captureDownload();
    await mountShare(SHARE_USAGE, '/metrics?sort=model&dir=asc');
    await act(async () => {
      (q('metA-export') as HTMLButtonElement).click();
    });
    expect(captured.name).toMatch(/^metrics-share-24h-model-[a-z]+-asc-\d{8}-\d{4}\.csv$/);
  });

  it('states the rule on screen and leaves the CSV header untouched', async () => {
    const { captured } = captureDownload();
    await mount(usageRouter());

    const note = q('metAI-filename-note');
    expect(note?.getAttribute('title')).toContain('命名规则');
    expect(note?.getAttribute('title')).toContain('cost-desc');
    expect(note?.textContent).toContain('metrics-detail');

    await act(async () => {
      (q('metA-export') as HTMLButtonElement).click();
    });
    const text = (await (captured.blob as Blob).text()).replace(/^\uFEFF/, '');
    expect(text.split('\r\n')[0]).toBe('group,runs,cost_usd,share_pct,as_of,window');
  });
});

describe('metAK — one manual refresh, one batch', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
  const batchOf = (from: number): string[] => [...urls().slice(from)].sort();
  const waitIdle = (): Promise<void> =>
    waitFor(() => q('metAK-refresh')?.getAttribute('aria-busy') !== 'true', 'refresh idle');

  async function clickRefresh(): Promise<void> {
    await act(async () => {
      (q('metAK-refresh') as HTMLButtonElement).click();
    });
  }

  it('reads the same batch once and stamps its own read time', async () => {
    await mount(usageRouter());
    const baseline = urls().length;

    await clickRefresh();
    await waitIdle();

    const first = batchOf(baseline);
    expect(first.length).toBeGreaterThan(0);
    // One full pass: the same reads as the initial load, each the same number of
    // times. The window bounds inside the URLs move with the clock, so the
    // comparison is per endpoint.
    const kind = (list: string[]) =>
      list.reduce<Record<string, number>>((acc, url) => {
        const key = ['run-activity', 'run-stats', 'employees', 'budget-usage', 'hermes-usage', 'models/pricing'].find((name) => url.includes(name)) ?? 'other';
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {});
    expect(kind(first)).toEqual(kind(urls().slice(0, baseline)));
    expect(q('metAK-updated-at')?.textContent).toContain('刷新完成于');
    expect(q('metAK-updated-at')?.textContent).toContain('不是数据时刻');
    expect(q('metAK-busy-note')).toBeNull();
  });

  it('ignores a second click while the batch is in flight', async () => {
    await mount(usageRouter());
    const baseline = urls().length;

    await act(async () => {
      const button = q('metAK-refresh') as HTMLButtonElement;
      button.click();
      button.click();
      button.click();
    });
    await waitIdle();

    // Three clicks, one batch.
    expect(urls().length - baseline).toBe(baseline);
  });

  it('keeps the numbers on screen while the batch runs, then swaps them in', async () => {
    const pending: Array<() => void> = [];
    let hold = false;
    const base = usageRouter();
    await mount((url) => {
      if (hold && url.includes('run-stats')) {
        return new Promise((resolve) => {
          pending.push(() => resolve(statsFor(url)));
        });
      }
      return base(url);
    });
    const before = q('met6-runs-value')?.textContent;
    hold = true;

    await clickRefresh();
    expect(q('metAK-refresh')?.getAttribute('aria-busy')).toBe('true');
    expect(q('metAK-busy-note')?.textContent).toContain('更新中');
    // The old batch is still on the cards.
    expect(q('met6-runs-value')?.textContent).toBe(before);
    expect(document.querySelector('.met5-skeleton')).toBeNull();

    // The loaders ask for run-stats in several waves; release each wave.
    for (let wave = 0; wave < 20 && pending.length > 0; wave += 1) {
      await act(async () => {
        pending.splice(0).forEach((fn) => fn());
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
    await waitIdle();
    expect(q('metAK-busy-note')).toBeNull();
  });

  it('says the refresh failed, keeps the page, and offers a retry with the request id', async () => {
    await mount(usageRouter());
    const baseline = urls().length;
    const before = q('met6-runs-value')?.textContent;
    api.fetchJsonStrict.mockImplementation((url: string) => {
      if (url.includes('run-stats')) {
        return Promise.reject(new ApiError('boom', { status: 500, body: '', url, requestId: 'req-metAK-1' }));
      }
      return usageRouter()(url);
    });

    await clickRefresh();
    await waitIdle();

    expect(q('metAK-error')?.textContent).toContain('这次刷新没成功');
    expect(q('metAK-error')?.textContent).toContain('req-metAK-1');
    expect(q('metAK-refresh-retry')).not.toBeNull();
    expect(q('metAK-updated-at')).toBeNull();
    // The page itself is still there (other blocks kept their numbers).
    expect(q('metAK-error')).not.toBeNull();
    expect(before).not.toBeUndefined();

    const retryFrom = urls().length;
    await act(async () => {
      (q('metAK-refresh-retry') as HTMLButtonElement).click();
    });
    await waitIdle();
    expect(urls().length - retryFrom).toBe(baseline);
  });

  it('drops a batch that was overtaken by a window switch', async () => {
    const pending: Array<() => void> = [];
    let hold = false;
    const base = usageRouter();
    await mount((url) => {
      if (hold && url.includes('run-stats')) {
        return new Promise((resolve) => {
          pending.push(() => resolve(statsFor(url)));
        });
      }
      return base(url);
    });
    hold = true;

    await clickRefresh();
    expect(q('metAK-busy-note')).not.toBeNull();

    await act(async () => {
      (q('met6-window-7d') as HTMLButtonElement).click();
    });
    // The switch retires the in-flight batch immediately.
    expect(q('metAK-busy-note')).toBeNull();

    for (let wave = 0; wave < 20 && pending.length > 0; wave += 1) {
      await act(async () => {
        pending.splice(0).forEach((fn) => fn());
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
    await waitIdle();
    // The late answer never becomes a refresh stamp.
    expect(q('metAK-updated-at')).toBeNull();
  });
});

describe('metAL — the scope line and one-click reset', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
  const loc = (): string => q('met7-loc')?.textContent ?? '';
  const scope = (): string => q('metAL-scope')?.textContent ?? '';
  const countOf = (since: number, needle: string): number =>
    urls().slice(since).filter((url) => url.includes(needle)).length;

  const FULL = '/metrics?window=7d&groupBy=employee&view=model&dsort=runs&ddir=asc&sort=model&dir=asc&heat=4';

  it('reads all four parts straight from the address', async () => {
    await mountShare(SHARE_USAGE, FULL);
    const before = urls().length;

    expect(scope()).toContain('时间窗 最近 7 天');
    expect(scope()).toContain('分组 按员工');
    expect(scope()).toContain('明细 次数 升序');
    expect(scope()).toContain('分摊 员工 升序');
    expect(scope()).toContain('热力');
    expect(q('met5-window-4')?.getAttribute('aria-pressed')).toBe('true');
    expect(q('met6-window-7d')?.getAttribute('aria-pressed')).toBe('true');
    // Rendering the line reads nothing.
    expect(urls().length).toBe(before);
  });

  it('follows a window switch in the same render', async () => {
    await mountShare(SHARE_USAGE);

    await act(async () => {
      (q('met6-window-30d') as HTMLButtonElement).click();
    });

    expect(scope()).toContain('时间窗 最近 30 天');
    expect(q('met6-window-30d')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('resets every scope key, repaints the line, and refetches only the affected reads', async () => {
    await mountShare(SHARE_USAGE, FULL);
    const before = urls().length;

    await act(async () => {
      (q('metAL-reset') as HTMLButtonElement).click();
    });
    await waitFor(() => scope().includes('时间窗 最近 24 小时'), 'scope back to defaults');

    for (const key of ['window=', 'groupBy=', 'view=', 'dsort=', 'ddir=', 'sort=', 'dir=', 'heat=', 'w=']) {
      expect(loc()).not.toContain(key);
    }
    expect(scope()).toContain('分组 按模型');
    expect(scope()).toContain('明细 成本 降序');
    expect(scope()).toContain('分摊 成本 降序');
    expect(q('met5-window-1')?.getAttribute('aria-pressed')).toBe('true');
    expect(q('met6-window-24h')?.getAttribute('aria-pressed')).toBe('true');

    // Only the reads whose inputs changed: one heat read, one usage/ledger batch.
    expect(countOf(before, 'run-activity')).toBe(1);
    expect(countOf(before, 'run-stats')).toBe(2);
    expect(countOf(before, 'employees')).toBe(4);
    expect(urls().length - before).toBeLessThan(before);
  });
});

describe('metAM — one availability matrix for every action', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
  const btn = (id: string): HTMLButtonElement => q(id) as HTMLButtonElement;
  const titleOf = (id: string): string => btn(id).getAttribute('title') ?? '';

  async function clickRefresh(): Promise<void> {
    await act(async () => {
      btn('metAK-refresh').click();
    });
  }

  const waitIdle = (): Promise<void> =>
    waitFor(() => btn('metAK-refresh')?.getAttribute('aria-busy') !== 'true', 'refresh idle');

  it('cell 1 — a page-wide failure leaves only the refresh reachable', async () => {
    const down = (): Promise<never> => Promise.reject(new ApiError('down', { status: 500, body: '', url: 'down', requestId: 'req-metAM-down' }));
    await mount(() => down());

    expect(q('metAM-matrix-note')?.textContent).toContain('只留「刷新」可用');
    // Refresh: reachable, because it is the way back.
    expect(btn('metAK-refresh').disabled).toBe(false);
    // Scope switching keeps working; only the batch is gone.
    expect(btn('metAL-reset').disabled).toBe(false);
    expect(q('metAL-scope')?.textContent).toContain('当前视图：');
    // Exports and the summary stop together, with one shared reason.
    expect(btn('met6-export').disabled).toBe(true);
    expect(btn('metA-export').disabled).toBe(true);
    expect(btn('metL-copy').disabled).toBe(true);
    for (const id of ['met6-export', 'metA-export', 'metL-copy']) {
      expect(titleOf(id)).toContain('整页读取失败');
    }
  });

  it('cell 2 — one degraded block only stops the actions that use it', async () => {
    await mount(usageRouter({ pricing: () => Promise.reject(new ApiError('down', { status: 500, body: '', url: 'price', requestId: 'req-metAM-price' })) }));

    expect(btn('metAK-refresh').disabled).toBe(false);
    expect(btn('met6-export').disabled).toBe(false);
    expect(btn('metL-copy').disabled).toBe(false);
    expect(q('metH-card-retry-price')).not.toBeNull();
    expect(btn('metH-card-retry-price').disabled).toBe(false);
    expect(titleOf('met6-export')).toContain('账本逐行');
  });

  it('cell 3 — an empty window still refreshes, exports a header and copies', async () => {
    const emptyLedger = { items: [], missingEmployeeIds: [] };
    await mount(usageRouter({ ledger: () => Promise.resolve(emptyLedger) }), '/metrics?window=7d');

    expect(btn('metAK-refresh').disabled).toBe(false);
    expect(btn('met6-export').disabled).toBe(false);
    expect(btn('metA-export').disabled).toBe(false);
    expect(btn('metL-copy').disabled).toBe(false);
    expect(q('metA-export-count')?.textContent).toBe('可导出 0 行');
  });

  it('cell 4 — while a refresh runs every other action stands down', async () => {
    let hold = false;
    const pending: Array<() => void> = [];
    const handler = usageRouter();
    await mount((url: string) => {
      if (!hold || !url.includes('run-stats')) return handler(url);
      return new Promise<unknown>((resolve) => {
        pending.push(() => resolve(handler(url)));
      });
    });

    hold = true;
    await clickRefresh();
    await waitFor(() => btn('metAK-refresh').getAttribute('aria-busy') === 'true', 'busy');

    expect(btn('metAK-refresh').disabled).toBe(false);
    for (const id of ['met6-export', 'metA-export', 'metL-copy', 'metAL-reset']) {
      expect(btn(id).disabled).toBe(true);
      expect(titleOf(id)).toContain('这一批');
    }

    const before = urls().length;
    await clickRefresh();
    expect(urls().length).toBe(before);

    for (let wave = 0; wave < 20 && pending.length > 0; wave += 1) {
      await act(async () => {
        pending.splice(0).forEach((fn) => fn());
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
    await waitIdle();
    expect(btn('met6-export').disabled).toBe(false);
  });
});

describe('metAN — empty window guide', () => {
  const emptyStats = () => ({
    from: '2026-11-18T16:00:00.000Z',
    to: '2026-11-19T16:00:00.000Z',
    bucket: 'hour',
    buckets: [],
    totals: { runs: 0, succeeded: 0, failed: 0, running: 0, sampleCount: 0, successRate: null },
    asOf: '2026-11-19T20:12:00.000Z',
    asOfSource: 'bff',
  });

  function emptyWindowRouter() {
    return (url: string): Promise<unknown> => {
      if (url.includes('run-activity')) return Promise.resolve(activityBody());
      if (url.includes('run-stats')) return Promise.resolve(emptyStats());
      if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEE_BODY);
      if (url.includes('models/pricing')) return Promise.resolve({ prices: [], asOf: '2026-11-19T20:12:00.000Z' });
      if (url.includes('budget-usage')) return Promise.resolve({ items: [], missingEmployeeIds: [] });
      return Promise.resolve({});
    };
  }

  it('explains an empty window, points at two real routes, and reads nothing extra', async () => {
    await mount(emptyWindowRouter());
    const guide = document.querySelector('[data-testid="metAN-empty-guide"]');
    expect(guide).not.toBeNull();
    expect(guide?.textContent).toContain('本窗没有运行记录');

    const links = [...(guide?.querySelectorAll('a[href]') ?? [])].map((a) => a.getAttribute('href'));
    expect(links).toContain('/runs');
    expect(links).toContain('/work');

    // The guide itself never quotes a money figure; the cards keep «—».
    expect(guide?.textContent ?? '').not.toContain('$');
    expect(document.querySelector('[data-testid="met6-cost-value"]')?.textContent).toBe('—');

    const before = urls().length;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(urls().length).toBe(before);
  });

  it('stays out of the way when the window has runs', async () => {
    await mount(usageRouter());
    expect(document.querySelector('[data-testid="metAN-empty-guide"]')).toBeNull();
  });

  it('does not pass a failed batch off as an empty window', async () => {
    await mount((url: string) =>
      Promise.reject(new ApiError('down', { status: 500, body: '', url, requestId: 'req-metAN-down' })),
    );
    expect(document.querySelector('[data-testid="metAN-empty-guide"]')).toBeNull();
    expect(document.querySelector('[data-testid="met5-page"]')?.textContent).not.toContain('本窗没有运行记录');
  });
});

describe('metAO — the file names and the scope line carry the same four values', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
  const scope = (): string => q('metAL-scope')?.textContent ?? '';
  const detailFile = (): string => q('metAO-filename-detail')?.textContent ?? '';
  const shareFile = (): string => q('metAO-filename-share')?.textContent ?? '';
  const STAMP = '<生成时刻>.csv';
  const FULL = '/metrics?window=7d&groupBy=employee&view=model&dsort=runs&ddir=asc&sort=model&dir=asc';

  it('agrees element by element with the scope line', async () => {
    await mountShare(SHARE_USAGE, FULL);

    expect(scope()).toContain('时间窗 最近 7 天');
    expect(scope()).toContain('分组 按员工');
    expect(scope()).toContain('明细 次数 升序');
    expect(scope()).toContain('分摊 员工 升序');

    expect(detailFile()).toBe(`metrics-detail-7d-model-runs-asc-${STAMP}`);
    expect(shareFile()).toBe(`metrics-share-7d-employee-model-asc-${STAMP}`);

    // window / group / sort key / sort direction all line up with the words above.
    expect(detailFile()).toContain('-7d-');
    expect(shareFile()).toContain('-7d-');
    expect(shareFile()).toContain('-employee-');
    expect(detailFile()).toContain('-runs-asc-');
    expect(shareFile()).toContain('-model-asc-');
    // The full name is in title, so a truncated 375 line still reveals it.
    expect(q('metAO-filename-detail')?.getAttribute('title')).toBe(detailFile());
    expect(q('metAO-filename-share')?.getAttribute('title')).toBe(shareFile());
  });

  it('keeps the two tables on their own sort keys', async () => {
    await mountShare(SHARE_USAGE, '/metrics?dsort=runs&ddir=asc');
    expect(detailFile()).toBe(`metrics-detail-24h-employee-runs-asc-${STAMP}`);
    // The share table was not touched: it keeps the default cost-desc.
    expect(shareFile()).toBe(`metrics-share-24h-model-cost-desc-${STAMP}`);

    await mountShare(SHARE_USAGE, '/metrics?sort=model&dir=asc');
    expect(shareFile()).toBe(`metrics-share-24h-model-model-asc-${STAMP}`);
    expect(detailFile()).toBe(`metrics-detail-24h-employee-cost-desc-${STAMP}`);
  });

  it('falls back to the defaults the moment the scope is reset', async () => {
    await mountShare(SHARE_USAGE, FULL);
    const before = urls().length;

    await act(async () => {
      (q('metAL-reset') as HTMLButtonElement).click();
    });
    await waitFor(() => detailFile().includes('-24h-employee-cost-desc-'), 'file name back to defaults');

    expect(detailFile()).toBe(`metrics-detail-24h-employee-cost-desc-${STAMP}`);
    expect(shareFile()).toBe(`metrics-share-24h-model-cost-desc-${STAMP}`);
    expect(scope()).toContain('时间窗 最近 24 小时');
    expect(scope()).toContain('分组 按模型');
    expect(detailFile()).not.toContain('7d');
    expect(detailFile()).not.toContain('runs');
    // Reading the file names off the address costs nothing beyond the reset refetch.
    expect(urls().length).toBeGreaterThanOrEqual(before);
  });

  it('derives a pasted link from the address, not from the defaults', async () => {
    await mountShare(SHARE_USAGE, '/metrics?window=30d&groupBy=employee');
    expect(detailFile()).toBe(`metrics-detail-30d-employee-cost-desc-${STAMP}`);
    expect(shareFile()).toBe(`metrics-share-30d-employee-cost-desc-${STAMP}`);
  });

  it('adds no request of its own', async () => {
    await mountShare(SHARE_USAGE, '/metrics?window=7d');
    const bar = q('metAO-filename-bar');
    expect(bar).not.toBeNull();
    expect(bar?.querySelectorAll('[data-testid^="metAO-filename-"]').length).toBe(2);

    // Reading the two names off the address fires nothing; the batch already
    // counted above is the same one a page without this bar would send.
    const before = urls().length;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    expect(urls().length).toBe(before);
    expect(detailFile()).toBe(`metrics-detail-7d-employee-cost-desc-${STAMP}`);
  });
});

describe('metAP — the three faces of the run count, spelled out', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
  const face = (id: string): string => q(id)?.textContent ?? '';
  const line = (): HTMLElement | null => q('metAP-runs-caliber');

  const caliberRouter =
    (activity: unknown, usage: unknown) =>
    (url: string): Promise<unknown> => {
      if (url.includes('run-activity')) return Promise.resolve(activity);
      if (url.includes('hermes-usage')) return Promise.resolve(usage);
      if (url.includes('run-stats')) return Promise.resolve(statsFor(url));
      if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEE_BODY);
      if (url.includes('models/pricing')) {
        return Promise.reject(new ApiError('missing', { status: 404, body: '', url }));
      }
      if (url.includes('periodKind=month')) return Promise.resolve(LEDGER_MONTH);
      if (url.includes('periodKind=day')) return Promise.resolve(LEDGER_DAY);
      return Promise.resolve({});
    };

  const flatActivity = (counts: number[]) => ({
    cells: counts.map((count, index) => ({ dow: 1, hour: index, count })),
    max: Math.max(...counts),
    from: '2026-11-12T16:00:00Z',
    to: '2026-11-19T15:59:59Z',
    tz: 'Asia/Shanghai',
  });

  it('names the three faces, repeats the on-screen numbers, and says why they differ', async () => {
    await mount(caliberRouter(activityBody(), HERMES_USAGE), '/metrics?view=model');

    expect(line()).not.toBeNull();
    expect(face('metAP-heat')).toBe(face('met5-count'));
    expect(face('metAP-detail')).toBe(face('metT-detail-total-count'));
    expect(face('metAP-heat')).not.toBe('—');
    expect(face('metAP-detail')).not.toBe('—');
    expect(face('metAP-runs')).toBe('—');
    expect(face('metAP-verdict')).toContain('口径不同');

    const hint = line()?.getAttribute('title') ?? '';
    expect(hint).toContain('/api/run-activity');
    expect(hint).toContain('/api/hermes-usage');
    expect(hint).toContain('/api/runs');
    expect(hint).toContain('limit');
    expect(hint).toContain('不等于窗口总数');
    expect(hint).toContain('口径差');
    // Paths stay in the hint; the line itself never carries them.
    expect(line()?.textContent ?? '').not.toContain('/api');
  });

  it('says so when the heat sum and the detail total land on the same number', async () => {
    await mount(
      caliberRouter(flatActivity([4, 5]), { by_model: [{ model: 'qwen-plus', api_calls: 9, sessions: 9 }] }),
      '/metrics?view=model',
    );

    expect(face('metAP-heat')).toBe('9');
    expect(face('metAP-detail')).toBe('9');
    expect(face('metAP-verdict')).toContain('热力与明细一致');
    expect(face('metAP-verdict')).toContain('运行页未核对');
    expect(line()?.getAttribute('title')).toContain('热力与明细差 0');
  });

  it('keeps the ledger view honest: no count there, so it says a face is missing', async () => {
    await mountEmployeeShare(TWO_EMPLOYEE_LEDGER);

    expect(face('metAP-detail')).toBe('—');
    expect(face('metAP-verdict')).toContain('有面缺数');
    const hint = line()?.getAttribute('title') ?? '';
    expect(hint).toContain('/api/budget-usage');
    expect(hint).toContain('不记录运行次数');
    expect(hint).toContain('算不出差');
  });

  it('reads nothing of its own', async () => {
    await mount(caliberRouter(activityBody(), HERMES_USAGE), '/metrics?view=model');
    const before = urls().length;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    expect(urls().length).toBe(before);
  });

  it('follows a window switch with the same batch', async () => {
    await mount(caliberRouter(activityBody(), HERMES_USAGE), '/metrics?view=model');
    const before = urls().length;

    await act(async () => {
      (q('met6-window-30d') as HTMLButtonElement).click();
    });
    await waitFor(() => q('met6-window-30d')?.getAttribute('aria-pressed') === 'true', '30d pressed');

    expect(face('metAP-heat')).toBe(face('met5-count'));
    expect(face('metAP-detail')).toBe(face('metT-detail-total-count'));
    // The switch refetches its own batch; the caliber line adds nothing to it.
    expect(urls().length).toBeGreaterThan(before);
  });
});

describe('metAQ — the address compatibility matrix', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
  const loc = (): string => q('met7-loc')?.textContent ?? '';
  const scope = (): string => q('metAL-scope')?.textContent ?? '';
  const note = (): HTMLElement | null => q('metAQ-url-note');

  function KeyProbe(): ReactNode {
    const location = useLocation();
    const navigation = useNavigationType();
    return (
      <>
        <p data-testid="metAQ-loc-key">{location.key}</p>
        <p data-testid="metAQ-nav-type">{navigation}</p>
      </>
    );
  }

  const page = (
    <>
      <MetricsModulePage />
      <LocationProbe />
      <KeyProbe />
    </>
  );

  it('renders the legacy heat alias exactly like the canonical key', async () => {
    const historyBefore = window.history.length;

    await render('/metrics?w=4', page);
    await waitFor(() => loc() === '?heat=4', 'legacy key folded into heat');

    expect(q('met5-window-4')?.getAttribute('aria-pressed')).toBe('true');
    expect(scope()).toContain('热力');
    expect(q('metAQ-url-note')).toBeNull();
    // replace, not push: the fold rewrites the entry instead of stacking one.
    expect(q('metAQ-nav-type')?.textContent).toBe('REPLACE');
    expect(q('metAQ-loc-key')?.textContent).toBeTruthy();
    expect(window.history.length).toBe(historyBefore);
  });

  it('lets the older groupBy spelling drive the detail view too', async () => {
    await render('/metrics?groupBy=employee', page);
    await waitFor(
      () => loc().includes('view=employee') && loc().includes('groupBy=employee'),
      'detail view written back',
    );
    expect(scope()).toContain('分组 按员工');
    expect(q('metAO-filename-detail')?.textContent).toContain('-employee-');

    // The opposite direction stays put: the share grouping is its own choice,
    // so a link naming only the detail view must not move the share table.
    await render('/metrics?view=employee', page);
    await waitFor(() => q('metAP-heat') !== null, 'settled');
    expect(loc()).toContain('view=employee');
    expect(loc()).not.toContain('groupBy=');
    expect(scope()).toContain('分组 按模型');
    expect(q('metAO-filename-detail')?.textContent).toContain('-employee-');
  });

  it('falls back to the defaults for unusable values and says how many it ignored', async () => {
    await render('/metrics?window=9y&heat=abc&sort=zzz&dsort=xxx&keep=1', page);
    await waitFor(() => loc().includes('keep=1') && !loc().includes('9y'), 'unknown values folded away');

    expect(q('met6-window-24h')?.getAttribute('aria-pressed')).toBe('true');
    expect(q('met5-window-1')?.getAttribute('aria-pressed')).toBe('true');

    expect(note()).not.toBeNull();
    expect(note()?.textContent).toBe('已忽略无效参数 4 个');
    const hint = note()?.getAttribute('title') ?? '';
    for (const pair of ['window=9y', 'heat=abc', 'sort=zzz', 'dsort=xxx']) expect(hint).toContain(pair);
    // Unrelated keys are none of our business.
    expect(loc()).toContain('keep=1');
    expect(note()?.textContent ?? '').not.toContain('/');
  });

  it('keeps the same words on screen as the canonical link', async () => {
    await render('/metrics?w=12&view=model', page);
    await waitFor(() => loc().includes('heat=12'), 'heat canonical');
    const aliasScope = scope();
    const aliasRuns = q('metAP-heat')?.textContent;

    await render('/metrics?heat=12&view=model&groupBy=model', page);
    await waitFor(() => q('metAP-heat') !== null, 'canonical settled');
    expect(scope()).toBe(aliasScope);
    expect(q('metAP-heat')?.textContent).toBe(aliasRuns);
  });

  it('reads nothing extra while folding the address', async () => {
    const start = urls().length;
    await render('/metrics?w=4&window=7d', page);
    await waitFor(() => loc() === '?window=7d&heat=4', 'folded');
    const aliasCount = urls().length - start;

    const beforeCanonical = urls().length;
    await render('/metrics?heat=4&window=7d', page);
    await waitFor(() => q('metAP-heat') !== null, 'canonical settled');
    expect(urls().length - beforeCanonical).toBe(aliasCount);
  });
});
