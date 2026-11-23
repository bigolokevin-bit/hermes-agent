// @vitest-environment jsdom
// MT-04 phase 1 — the drill-to-runs honesty contract. Measured fact: /runs
// reads exactly `window|status|state|run|employee`; a `model` key does nothing
// there. So a model row must never *promise* a model filter — in the href, in
// the note, or in the aria-label. These cases pin «the promise does not
// exceed the delivery». Naming note (.tsx): the file holds both the pure
// runsDrill cases and the mounted DOM cases, mirroring the sibling
// MetricsModulePage.test.tsx fetch-stub shape.
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn((text: string) => Promise.resolve(Boolean(text))) }));
vi.mock('@/modules/models/fetchJson', () => ({ fetchJsonStrict: api.fetchJsonStrict }));
vi.mock('@/lib/clipboard', () => ({ copyTextToClipboard: clip.copyTextToClipboard }));

import { MetricsModulePage } from './MetricsModulePage';
import { runsDrill, type ModelCostRow } from './metrics';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MODEL_NOTE = '运行页暂不支持按模型筛选；打开的是同一时间窗的全部运行。';
const ANON_EMPLOYEE_NOTE = '这一行没有员工标识，运行页无法按人筛选；打开的是同一时间窗的全部运行。';

// ---- pure runsDrill ---------------------------------------------------------

describe('runsDrill — the href only carries filters /runs really reads', () => {
  const modelRow: ModelCostRow = { model: 'zeta', runs: 4, costUsd: 3 };
  const employeeRow: ModelCostRow = {
    model: '小鲤',
    key: 'aaaabbbb',
    rawId: 'emp a/b+c',
    runs: 7,
    costUsd: 3,
  };

  it('sends a model row unfiltered and says so verbatim', () => {
    const drill = runsDrill(modelRow, 'model', '7d');

    expect(drill.href.startsWith('/runs/?window=')).toBe(true);
    // The runs page ignores a model key, so one must never ride along.
    expect(drill.href).not.toContain('model=');
    expect(drill.filtered).toBe(false);
    expect(drill.note).toBe(MODEL_NOTE);
  });

  it('rides the employee filter through encodeURIComponent and claims the filter honestly', () => {
    const drill = runsDrill(employeeRow, 'employee', '30d');

    expect(drill.href).toBe(`/runs/?employee=${encodeURIComponent('emp a/b+c')}&window=30d`);
    expect(drill.href).toContain('employee=emp%20a%2Fb%2Bc');
    expect(drill.filtered).toBe(true);
    expect(drill.note).toBeNull();
  });

  it('drops to the unfiltered branch, with its own honest note, when the row has no id', () => {
    const anon: ModelCostRow = { model: '小满', key: 'dddd', runs: 3, costUsd: 1 };
    const drill = runsDrill(anon, 'employee', '24h');

    expect(drill.href).toBe('/runs/?window=24h');
    expect(drill.filtered).toBe(false);
    expect(drill.note).toBe(ANON_EMPLOYEE_NOTE);
  });

  it('keeps the window key inside the whitelist and falls back to 7d outside it', () => {
    const cases: [string, string][] = [
      ['24h', '24h'],
      ['7d', '7d'],
      ['30d', '30d'],
      ['14d', '7d'],
      ['', '7d'],
      ['7D', '7d'],
      ['乱串', '7d'],
    ];
    for (const [windowId, expected] of cases) {
      expect(runsDrill(modelRow, 'model', windowId).href).toBe(`/runs/?window=${expected}`);
      expect(runsDrill(employeeRow, 'employee', windowId).href).toBe(
        `/runs/?employee=${encodeURIComponent('emp a/b+c')}&window=${expected}`,
      );
    }
  });
});

// ---- mounted share tables ----------------------------------------------------

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

const STATS_24H = {
  from: '2026-11-18T16:00:00.000Z',
  to: '2026-11-19T16:00:00.000Z',
  bucket: 'hour',
  buckets: [],
  totals: { runs: 0, succeeded: 0, failed: 0, running: 0, sampleCount: 0, successRate: null },
};

const BUCKET_DAY_MS = 86_400_000;
const dayBucket = (daysBack: number): string => new Date(Date.now() - daysBack * BUCKET_DAY_MS).toISOString();

const STATS_7D = {
  from: '2026-11-12T16:00:00.000Z',
  to: '2026-11-19T16:00:00.000Z',
  bucket: 'day',
  buckets: [{ bucketStart: dayBucket(2), runs: 13 }],
  totals: { runs: 13, succeeded: 12, failed: 0, running: 1, sampleCount: 12, successRate: 1 },
};

const STATS_30D = {
  from: '2026-10-20T16:00:00.000Z',
  to: '2026-11-19T16:00:00.000Z',
  bucket: 'day',
  buckets: [
    { bucketStart: dayBucket(20), runs: 1 },
    { bucketStart: dayBucket(3), runs: 13 },
  ],
  totals: { runs: 14, succeeded: 13, failed: 0, running: 1, sampleCount: 13, successRate: 1 },
};

function statsFor(url: string): unknown {
  const from = new URL(url, 'http://local').searchParams.get('from');
  const hours = from ? (Date.now() - Date.parse(from)) / 3_600_000 : 0;
  if (hours <= 25) return STATS_24H;
  if (hours >= 600) return STATS_30D;
  return STATS_7D;
}

const EMPLOYEE_BODY = {
  items: [
    { employeeId: 'emp_aaaabbbbcccc', name: '小鲤' },
    { employeeId: 'emp_ddddeeeeffff', name: '小满' },
  ],
  nextCursor: null,
};

const LEDGER_MONTH = {
  items: [
    { employeeId: 'emp_aaaabbbbcccc', period: '2026-11', periodKind: 'month', costUsd: 0.121198, updatedAt: '2026-11-14T19:25:51.543Z' },
    { employeeId: 'emp_ddddeeeeffff', period: '2026-11', periodKind: 'month', costUsd: 0.011498, updatedAt: '2026-11-13T06:41:33.974Z' },
  ],
  missingEmployeeIds: [],
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

const SHARE_USAGE = {
  by_model: [
    { model: 'zeta', sessions: 4, actual_cost_usd: 3 },
    { model: 'alpha', sessions: 9, actual_cost_usd: 1 },
    { model: 'mid' },
  ],
  asOf: '2026-11-19T20:12:00.000Z',
};

const SHARE_MODEL_USAGE = {
  by_model: [{ model: 'zeta', sessions: 4, actual_cost_usd: 3 }],
  asOf: '2026-11-19T20:12:00.000Z',
};

const TWO_EMPLOYEE_LEDGER = {
  items: [
    { employeeId: 'emp_aaaabbbbcccc', costUsd: 3, runs: 7, updatedAt: '2026-11-19T03:20:00.000Z' },
    { employeeId: 'emp_ddddeeeeffff', costUsd: 1, runs: 3, updatedAt: '2026-11-19T02:10:00.000Z' },
  ],
  missingEmployeeIds: [],
};

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

async function mountShare(usage: unknown, entry = '/metrics'): Promise<void> {
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation(shareRouter(usage));
  await render(entry, <MetricsModulePage />);
  await waitFor(settled, 'state settled');
}

async function mountEmployeeShare(ledger: unknown, entry = '/metrics?groupBy=employee'): Promise<void> {
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation(employeeShareRouter(ledger));
  await render(entry, <MetricsModulePage />);
  await waitFor(settled, 'state settled');
}

const drillLinks = (): HTMLAnchorElement[] =>
  [...document.querySelectorAll('[data-testid^="met9-link-"]')];

describe('met9 mounted — no link promises a filter /runs cannot apply', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    root = null;
    document.body.replaceChildren();
  });

  it('keeps every drill href on the whitelist form in both share views', async () => {
    // Model view: three rows, none of them may carry a model key.
    await mountShare(SHARE_USAGE, '/metrics?window=30d');
    expect(document.querySelectorAll('a[href*="/runs/?model"]')).toHaveLength(0);
    const modelLinks = drillLinks();
    expect(modelLinks.length).toBe(3);
    for (const link of modelLinks) {
      const href = link.getAttribute('href') ?? '';
      expect(href).toMatch(/^\/runs\/\?window=|employee=/);
      // The whitelist half the regex cannot be satisfied by an employee key
      // sneaking into the model view, so pin the window form here directly.
      expect(href.startsWith('/runs/?window=')).toBe(true);
    }

    // Employee view: rows carry the one filter /runs really reads.
    await mountEmployeeShare(TWO_EMPLOYEE_LEDGER, '/metrics?groupBy=employee&window=7d');
    expect(document.querySelectorAll('a[href*="/runs/?model"]')).toHaveLength(0);
    const employeeLinks = drillLinks();
    expect(employeeLinks.length).toBe(2);
    for (const link of employeeLinks) {
      expect(link.getAttribute('href')).toMatch(/^\/runs\/\?window=|employee=/);
    }
  });

  it('fits the aria promise to what the link actually delivers', async () => {
    // filtered=true: the promise may claim the row really filters.
    await mountEmployeeShare(TWO_EMPLOYEE_LEDGER, '/metrics?groupBy=employee&window=7d');
    const filtered = document.querySelector('[data-testid="met9-link-aaaabbbb"]') as HTMLAnchorElement;
    const filteredLabel = filtered.getAttribute('aria-label') ?? '';
    expect(filteredLabel).toContain('已按该行过滤');
    expect(filteredLabel).toContain('小鲤');

    // filtered=false: the promise must not name the model as a filter; it
    // opens the same window unfiltered and says exactly that, note included.
    await mountShare(SHARE_USAGE, '/metrics?window=30d');
    const unfiltered = document.querySelector('[data-testid="met9-link-zeta"]') as HTMLAnchorElement;
    const unfilteredLabel = unfiltered.getAttribute('aria-label') ?? '';
    expect(unfilteredLabel).toContain('全部运行');
    expect(unfilteredLabel).toContain(MODEL_NOTE);
    expect(unfilteredLabel).not.toContain('已按该行过滤');
  });
});
