// @vitest-environment jsdom
// metAJ — the copy/summary/filename contracts already shipped, pinned as guards:
//   C1  metAG source summary follows the metB row order, four segments per row
//   C2  the metL summary and the metZ heat summary never mix, and a missing
//       value is «—», never $0.00 standing in for it
//   C3  the two CSV file names follow the metAI template; different sorts never
//       collide, and the whole name is lowercase ASCII
//   C4  the metAD sr-only note and the expanded metAB item read verbatim the same
//   C5  none of the above issues a read
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn((text: string) => Promise.resolve(Boolean(text))) }));
vi.mock('@/modules/models/fetchJson', () => ({ fetchJsonStrict: api.fetchJsonStrict }));
vi.mock('@/lib/clipboard', () => ({ copyTextToClipboard: clip.copyTextToClipboard }));

import { MetricsModulePage } from './MetricsModulePage';
import { CALIBER_NOTES, csvFileName, shareCsvFileName } from './metrics';

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
const urls = (): string[] => api.fetchJsonStrict.mock.calls.map((call) => String(call[0]));

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

const STATS = {
  from: '2026-11-18T16:00:00.000Z',
  to: '2026-11-19T16:00:00.000Z',
  bucket: 'hour',
  buckets: [],
  totals: { runs: 4, succeeded: 4, failed: 0, running: 0, sampleCount: 4, successRate: null },
  asOf: '2026-11-19T20:12:00.000Z',
  asOfSource: 'bff',
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
  by_model: [{ model: 'qwen-plus', sessions: 3, api_calls: 9 }],
  asOf: '2026-11-19T20:12:00.000Z',
};

type Options = { activity?: unknown; stats?: unknown; ledger?: unknown; pricing?: unknown };

function router(options: Options = {}): (url: string) => Promise<unknown> {
  return (url: string): Promise<unknown> => {
    if (url.includes('run-activity')) return Promise.resolve(options.activity ?? ACTIVITY);
    if (url.includes('run-stats')) return Promise.resolve(options.stats ?? STATS);
    if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEES);
    if (url.includes('models/pricing')) return Promise.resolve(options.pricing ?? { prices: [], asOf: '2026-11-19T20:12:00.000Z' });
    if (url.includes('hermes-usage')) return Promise.resolve(USAGE);
    if (url.includes('budget-usage')) return Promise.resolve(options.ledger ?? LEDGER);
    return Promise.resolve({});
  };
}

async function mount(handler: (url: string) => Promise<unknown>, entry = '/metrics'): Promise<void> {
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation(handler);
  clip.copyTextToClipboard.mockClear();
  await render(entry, createElement(MetricsModulePage));
  await waitFor(settled, 'state settled');
}

async function copyWith(testId: string, statusId: string): Promise<string> {
  clip.copyTextToClipboard.mockClear();
  await act(async () => {
    (q(testId) as HTMLButtonElement).click();
  });
  await waitFor(() => (q(statusId)?.textContent ?? '') !== '', `${statusId} settled`);
  return String(clip.copyTextToClipboard.mock.calls[0]?.[0] ?? '');
}

const dataLines = (body: string): string[] => body.split('\n').filter((line) => line.length > 0);

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

describe('metAJ — C1: the source summary follows the freshness rows', () => {
  it('C1 copies one line per metB row, in the same order and with the same segments', async () => {
    await mount(router());
    const before = urls().length;
    await act(async () => {
      q('metB-source-toggle')?.click();
    });

    const rows = [...document.querySelectorAll('[data-testid^="metB-source-row-"]')];
    expect(rows.length).toBeGreaterThan(0);

    const body = await copyWith('metAG-copy-sources', 'metAG-copy-status');
    const lines = dataLines(body);
    expect(lines).toHaveLength(rows.length);
    expect(q('metAG-copy-status')?.textContent).toBe(`已复制 ${rows.length} 行`);

    rows.forEach((row, index) => {
      const cells = row.querySelectorAll('[role="cell"]');
      const key = row.getAttribute('data-testid')!.replace('metB-source-row-', '');
      const asOf = q(`metB-source-asof-${key}`)?.textContent;
      const stateCell = cells[3]?.textContent?.trim() ?? '';
      const stateWord = ['正常', '降级', '读不到'].find((word) => stateCell.startsWith(word)) ?? stateCell;
      expect(lines[index]).toBe(
        `${cells[0]?.textContent?.trim()} · ${cells[1]?.textContent?.trim()} · ${asOf} · ${stateWord}`,
      );
    });

    // C5: expanding the block and copying read nothing again.
    expect(urls().length).toBe(before);
  });
});

describe('metAJ — C2: the two summaries never bleed into each other', () => {
  it('C2 keeps the view summary and the heat summary apart', async () => {
    await mount(router());
    const before = urls().length;

    const view = await copyWith('metL-copy', 'metL-copy-status');
    const heat = await copyWith('metZ-copy-heat', 'metZ-copy-status');

    expect(view).toContain('运行分析摘要');
    expect(view).not.toContain('热力摘要');
    expect(heat).toContain('热力摘要');
    expect(heat).not.toContain('运行分析摘要');

    expect(urls().length).toBe(before);
  });

  it('C2 writes — for a missing value and never borrows $0.00 for it', async () => {
    await mount(
      router({
        // The ledger answers with rows that carry no money at all.
        ledger: { items: [{ employeeId: 'emp_aaaabbbbcccc', updatedAt: '2026-11-19T03:20:00.000Z' }], missingEmployeeIds: [] },
        // The activity answers with no usable cell.
        activity: { cells: [], max: null, from: '2026-11-12T16:00:00Z', to: '2026-11-19T15:59:59Z', tz: 'Asia/Shanghai' },
      }),
    );

    const view = await copyWith('metL-copy', 'metL-copy-status');
    expect(view).toContain('实扣金额：—');
    expect(view).not.toContain('$0.00');

    const heat = await copyWith('metZ-copy-heat', 'metZ-copy-status');
    expect(heat).toContain('总运行：—');
    expect(heat).toContain('不可比较');
    expect(heat).not.toContain('$0.00');
  });
});

describe('metAJ — C3: the export file names follow the metAI contract', () => {
  const now = new Date('2026-11-20T09:30:00.000Z');

  it('C3 builds the documented detail and share names', () => {
    expect(csvFileName('employee', '24h', 'cost', 'desc', now)).toBe(
      'metrics-detail-24h-employee-cost-desc-20261120-1730.csv',
    );
    expect(shareCsvFileName('model', '24h', 'cost', 'desc', now)).toBe(
      'metrics-share-24h-model-cost-desc-20261120-1730.csv',
    );
  });

  it('C3 never lets two sorts share one name, and keeps every name lowercase ASCII', () => {
    const detailNames = new Set([
      csvFileName('employee', '7d', 'cost', 'desc', now),
      csvFileName('employee', '7d', 'runs', 'asc', now),
      csvFileName('employee', '7d', 'share', 'asc', now),
    ]);
    expect(detailNames.size).toBe(3);

    const shareNames = new Set([
      shareCsvFileName('model', '7d', 'cost', 'desc', now),
      shareCsvFileName('model', '7d', 'runs', 'desc', now),
      shareCsvFileName('model', '7d', 'model', 'asc', now),
    ]);
    expect(shareNames.size).toBe(3);

    for (const name of [...detailNames, ...shareNames]) {
      expect(name).toMatch(/^[a-z0-9.-]+$/);
      expect(name).not.toMatch(/[\s/:\\]/);
      expect(name).not.toMatch(/[\u4e00-\u9fff]/);
    }
  });
});

describe('metAJ — C4: the card note and the foot note read verbatim the same', () => {
  it('C4 matches every shared key once the foot block is open', async () => {
    await mount(router());
    const before = urls().length;
    await act(async () => {
      (q('metAB-notes-toggle') as HTMLButtonElement).click();
    });

    const shared = ['run-stats', 'budget-usage', 'pricing', 'run-activity'];
    for (const key of shared) {
      expect(CALIBER_NOTES.some((note) => note.key === key)).toBe(true);
      const sr = q(`metAD-note-${key}`)?.textContent;
      const foot = q(`metAB-note-${key}`)?.textContent;
      expect(sr).toBeTruthy();
      expect(foot).toBeTruthy();
      expect(sr).toBe(foot);
    }
    expect(urls().length).toBe(before);
  });
});
