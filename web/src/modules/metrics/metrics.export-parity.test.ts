// @vitest-environment jsdom
// metAC — the screen and both CSV exports agree, pinned as regression guards:
//   P1  data rows == the count on screen == the rows in the file
//   P2  the `# 合计：…` comment repeats the footer verbatim and is not a row;
//       a missing-block note is always the last line
//   P3  as_of comes from a top-level ISO stamp only (six names), never the clock
//   P4  the window column is the active window id and follows a window switch
//   P5  a real zero exports as 0.00 / $0.00, a missing value as an empty cell / «—»
//   P6  the file keeps the table order, default and after ?dsort/?ddir
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
vi.mock('@/modules/models/fetchJson', () => ({ fetchJsonStrict: api.fetchJsonStrict }));
vi.mock('@/lib/clipboard', () => ({ copyTextToClipboard: vi.fn(() => Promise.resolve(true)) }));

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
    root?.render(createElement(MemoryRouter, { initialEntries: [entry] }, page));
  });
}

const settled = (): boolean => document.querySelector('.met5-skeleton') === null;
const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);

const STATS = {
  from: '2026-11-18T16:00:00.000Z',
  to: '2026-11-19T16:00:00.000Z',
  bucket: 'hour',
  buckets: [],
  totals: { runs: 0, succeeded: 0, failed: 0, running: 0, sampleCount: 0, successRate: null },
};

const ACTIVITY = {
  cells: [
    { dow: 1, hour: 0, count: 0 },
    { dow: 3, hour: 4, count: 6 },
  ],
  max: 6,
  from: '2026-11-12T16:00:00Z',
  to: '2026-11-19T15:59:59Z',
  tz: 'Asia/Shanghai',
};

const EMPLOYEES = {
  items: [
    { employeeId: 'emp_aaaabbbbcccc', name: '小鲤', title: '运营', lifecycleState: 'active', ownerUserId: 'u1', updatedAt: '2026-11-19T03:20:00.000Z' },
    { employeeId: 'emp_ddddeeeeffff', name: '小满', title: '运营', lifecycleState: 'active', ownerUserId: 'u1', updatedAt: '2026-11-19T02:10:00.000Z' },
  ],
  nextCursor: null,
};

const LEDGER = {
  items: [
    { employeeId: 'emp_aaaabbbbcccc', costUsd: 3, runs: 7, updatedAt: '2026-11-19T03:20:00.000Z' },
    { employeeId: 'emp_ddddeeeeffff', costUsd: 1, runs: 3, updatedAt: '2026-11-19T02:10:00.000Z' },
  ],
  missingEmployeeIds: [],
};

const USAGE = {
  by_model: [
    { model: 'qwen-plus', sessions: 3, api_calls: 9 },
    { model: 'deepseek-v4', sessions: 2, api_calls: 4 },
  ],
  asOf: '2026-11-19T20:12:00.000Z',
};

type Options = {
  ledger?: unknown;
  usage?: unknown;
  activity?: unknown;
  statsFails?: boolean;
  asOf?: string;
};

function parityRouter(options: Options = {}): (url: string) => Promise<unknown> {
  return (url: string): Promise<unknown> => {
    if (url.includes('run-activity')) return Promise.resolve(options.activity ?? ACTIVITY);
    if (url.includes('run-stats')) {
      if (options.statsFails) return Promise.reject(new Error('boom'));
      return Promise.resolve({ ...STATS, ...(options.asOf ? { asOf: options.asOf, asOfSource: 'bff' } : {}) });
    }
    if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEES);
    if (url.includes('models/pricing')) return Promise.resolve({ prices: [], ...(options.asOf ? { asOf: options.asOf } : {}) });
    if (url.includes('hermes-usage')) return Promise.resolve(options.usage ?? USAGE);
    if (url.includes('budget-usage')) return Promise.resolve(options.ledger ?? LEDGER);
    return Promise.resolve({});
  };
}

async function mount(handler: (url: string) => Promise<unknown>, entry = '/metrics'): Promise<void> {
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation(handler);
  await render(entry, createElement(MetricsModulePage));
  await waitFor(settled, 'state settled');
}

function captureDownload(): { captured: { blob: Blob | null; name: string | null } } {
  const captured: { blob: Blob | null; name: string | null } = { blob: null, name: null };
  Object.assign(URL, {
    createObjectURL: vi.fn((blob: Blob) => {
      captured.blob = blob;
      return 'blob:parity';
    }),
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    captured.name = this.download;
  });
  return { captured };
}

async function csvLines(blob: Blob | null): Promise<string[]> {
  expect(blob).not.toBeNull();
  const bytes = new Uint8Array(await blob!.arrayBuffer());
  expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
  const text = await blob!.text();
  return text.replace(/^\uFEFF/, '').split('\r\n').filter((line) => line.length > 0);
}

const dataRows = (lines: string[]): string[] => lines.filter((line) => !line.startsWith('#'));
const comments = (lines: string[]): string[] => lines.filter((line) => line.startsWith('#'));

function download(testId: string): Promise<void> {
  return act(async () => {
    (q(testId) as HTMLButtonElement).click();
  });
}

const column = (lines: string[], index: number): string[] =>
  dataRows(lines)
    .slice(1)
    .map((line) => line.split(',')[index] ?? '');

const firstNameCells = (selector: string): string[] =>
  [...document.querySelectorAll(selector)].map((row) => row.querySelector('td')?.textContent?.trim() ?? '');

beforeEach(() => {
  window.history.replaceState({}, '', '/');
});

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await act(async () => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

describe('metAC — P1: data rows match the count on screen', () => {
  it('P1 exports exactly the detail rows the page counted', async () => {
    const { captured } = captureDownload();
    await mount(parityRouter());
    const onScreen = document.querySelectorAll('[data-testid^="met6-row-"]').length;
    expect(onScreen).toBe(2);
    expect(q('met6-cat-source')?.textContent).toContain(`${onScreen} 行`);

    await download('met6-export');
    const lines = await csvLines(captured.blob);
    expect(dataRows(lines)).toHaveLength(onScreen + 1);
    expect(dataRows(lines).length - 1).toBe(onScreen);
  });

  it('P1 exports exactly the share rows the page counted', async () => {
    const { captured } = captureDownload();
    await mount(parityRouter());
    const onScreen = document.querySelectorAll('[data-testid^="met7-row-"]').length;
    expect(onScreen).toBe(2);
    expect(q('metA-export-count')?.textContent).toBe(`可导出 ${onScreen} 行`);

    await download('metA-export');
    const lines = await csvLines(captured.blob);
    expect(dataRows(lines)).toHaveLength(onScreen + 1);
  });
});

describe('metAC — P2: the totals comment repeats the footer and is not a row', () => {
  it('P2 writes the footer verbatim and keeps the gap note last', async () => {
    const { captured } = captureDownload();
    await mount(parityRouter({ statsFails: true }));
    const onScreen = document.querySelectorAll('[data-testid^="met6-row-"]').length;

    // The footer cells are the source of the comment text.
    const cost = q('metT-detail-total-cost')?.textContent;
    const count = q('metT-detail-total-count')?.textContent;
    const share = q('metT-detail-total-share')?.textContent;

    await download('met6-export');
    const lines = await csvLines(captured.blob);
    const note = comments(lines).find((line) => line.startsWith('# 合计：')) ?? '';
    expect(note).toBe(`# 合计：成本 ${cost} · 次数 ${count} · 占比 ${share}`);
    expect(lines.at(-1)).toContain('# 本次导出缺少 1 块：运行统计');
    // Neither comment counts as a data row.
    expect(dataRows(lines)).toHaveLength(onScreen + 1);
  });

  it('P2 does the same for the share file', async () => {
    const { captured } = captureDownload();
    await mount(parityRouter());
    const onScreen = document.querySelectorAll('[data-testid^="met7-row-"]').length;
    const runs = q('metT-share-total-runs')?.textContent;
    const cost = q('metT-share-total-cost')?.textContent;
    const share = q('metT-share-total-share')?.textContent;

    await download('metA-export');
    const lines = await csvLines(captured.blob);
    expect(comments(lines)).toEqual([`# 合计：运行 ${runs} · 成本 ${cost} · 占比 ${share}`]);
    expect(dataRows(lines)).toHaveLength(onScreen + 1);
  });
});

describe('metAC — P3: as_of is a top-level ISO stamp or nothing', () => {
  it('P3 carries the upstream stamp into the file', async () => {
    const { captured } = captureDownload();
    await mount(parityRouter({ asOf: '2026-11-19T20:12:00.000Z' }));

    await download('metA-export');
    const lines = await csvLines(captured.blob);
    expect(lines[0].endsWith('as_of,window')).toBe(true);
    expect(column(lines, 4).every((cell) => cell === '2026-11-19T20:12:00.000Z')).toBe(true);
  });

  it('P3 never substitutes the local clock for a missing stamp', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2031-03-04T05:06:07.000Z'));
    const { captured } = captureDownload();
    // Nothing upstream carries a collection time at all.
    await mount(parityRouter({ usage: { by_model: [{ model: 'qwen-plus', sessions: 1, actual_cost_usd: 2 }] } }));

    await act(async () => {
      q('metB-source-toggle')?.click();
    });
    const freshness = q('metB-source-table')?.textContent ?? '';
    expect(freshness).not.toContain('2031');

    await download('metA-export');
    const lines = await csvLines(captured.blob);
    // No stamp upstream means an empty cell — never the fake clock.
    expect(column(lines, 4).every((cell) => cell === '')).toBe(true);
    expect(lines.join('\n')).not.toContain('2031');
    // The page may say when it read (that is the read time); the collection
    // cells themselves must stay empty rather than borrow it.
    const asofCells = [...document.querySelectorAll('[data-testid^="metB-source-asof-"]')];
    expect(asofCells.length).toBeGreaterThan(0);
    expect(asofCells.every((cell) => cell.textContent === '—')).toBe(true);
  });
});

describe('metAC — P4: the window column follows the active window', () => {
  it('P4 writes 24h, then 7d after the switch, on screen and in the file', async () => {
    const { captured } = captureDownload();
    await mount(parityRouter());
    expect(q('met6-window-24h')?.getAttribute('aria-pressed')).toBe('true');

    await download('metA-export');
    const first = await csvLines(captured.blob);
    expect(column(first, 5).every((cell) => cell === '24h')).toBe(true);

    await act(async () => {
      (q('met6-window-7d') as HTMLButtonElement).click();
    });
    await waitFor(() => (q('met6-window-7d')?.getAttribute('aria-pressed') ?? '') === 'true', '7d window');

    await download('metA-export');
    const second = await csvLines(captured.blob);
    expect(column(second, 5).every((cell) => cell === '7d')).toBe(true);
  });
});

describe('metAC — P5: a real zero and a missing value stay apart', () => {
  it('P5 prints $0.00 / — on screen and 0.00 / empty in the file', async () => {
    const { captured } = captureDownload();
    await mount(
      parityRouter({
        ledger: {
          items: [
            { employeeId: 'emp_aaaabbbbcccc', costUsd: 0, runs: 2, updatedAt: '2026-11-19T03:20:00.000Z' },
            { employeeId: 'emp_ddddeeeeffff', updatedAt: '2026-11-19T02:10:00.000Z' },
          ],
          missingEmployeeIds: [],
        },
      }),
      '/metrics?groupBy=employee',
    );
    await waitFor(() => q('met8-row-aaaabbbb') !== null, 'share rows');

    expect(q('met8-cost-aaaabbbb')?.textContent).toBe('$0.00');
    expect(q('met8-cost-ddddeeee')?.textContent).toBe('—');

    await download('metA-export');
    const lines = await csvLines(captured.blob);
    const zero = lines.find((line) => line.startsWith('小鲤,')) ?? '';
    const none = lines.find((line) => line.startsWith('小满,')) ?? '';
    expect(zero.split(',')[2]).toBe('0.00');
    expect(none.split(',')[2]).toBe('');
  });
});

describe('metAC — P6: the file keeps the table order', () => {
  it('P6 matches the default order', async () => {
    const { captured } = captureDownload();
    await mount(parityRouter());
    const onScreen = firstNameCells('[data-testid^="met6-row-"]');

    await download('met6-export');
    const lines = await csvLines(captured.blob);
    expect(column(lines, 0)).toEqual(onScreen);
  });

  it('P6 matches ?dsort=runs&ddir=asc', async () => {
    const { captured } = captureDownload();
    await mount(parityRouter(), '/metrics?dsort=runs&ddir=asc');
    const onScreen = firstNameCells('[data-testid^="met6-row-"]');
    expect(onScreen.length).toBeGreaterThan(1);
    expect(q('metP-sort-runs')?.closest('th')?.getAttribute('aria-sort')).toBe('ascending');

    await download('met6-export');
    const lines = await csvLines(captured.blob);
    expect(column(lines, 0)).toEqual(onScreen);
  });
});
