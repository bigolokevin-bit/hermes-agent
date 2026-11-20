// @vitest-environment jsdom
// R116 — the detail CSV, the detail table and the per-row copy buttons must
// describe the same rows: same count, same order, same zero/missing semantics.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn((text: string) => Promise.resolve(Boolean(text))) }));
vi.mock('@/modules/models/fetchJson', () => ({ fetchJsonStrict: api.fetchJsonStrict }));
vi.mock('@/lib/clipboard', () => ({ copyTextToClipboard: clip.copyTextToClipboard }));

import { MetricsModulePage } from './MetricsModulePage';
import { beijingDayKey } from './metrics';

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

const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const text = (): string => document.body.textContent ?? '';
const urls = (): string[] => api.fetchJsonStrict.mock.calls.map((call) => String(call[0]));
const settled = (): boolean => document.querySelector('.met5-skeleton') === null;

async function mount(entry = '/metrics'): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation(handler);
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <MetricsModulePage />
      </MemoryRouter>,
    );
  });
  await waitFor(settled, 'initial batch');
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
}

const EMPLOYEES = {
  items: [
    { employeeId: 'emp_aaaabbbbcccc', name: '小鲤' },
    { employeeId: 'emp_ddddeeeeffff', name: '小满' },
    { employeeId: 'emp_iiiijjjjkkkk', name: '阿吉' },
  ],
  nextCursor: null,
};

// 小鲤 is a real zero, 小满 has money, 阿吉 has a row with no cost at all.
const LEDGER_ROWS = [
  { employeeId: 'emp_aaaabbbbcccc', period: '2026-11-19', periodKind: 'day', costUsd: 0, updatedAt: '2026-11-19T03:20:00.000Z' },
  { employeeId: 'emp_ddddeeeeffff', period: '2026-11-19', periodKind: 'day', costUsd: 5, updatedAt: '2026-11-19T04:20:00.000Z' },
  { employeeId: 'emp_iiiijjjjkkkk', period: '2026-11-19', periodKind: 'day', updatedAt: '2026-11-19T05:20:00.000Z' },
];

let emptyLedger = false;

function handler(url: string): Promise<unknown> {
  if (url.includes('/api/run-activity')) {
    return Promise.resolve({ cells: [], max: null, from: '2026-11-12T16:00:00.000Z', to: '2026-11-19T15:59:59.000Z', tz: 'Asia/Shanghai' });
  }
  if (url.includes('/api/run-stats')) {
    return Promise.resolve({
      from: '2026-11-18T16:00:00.000Z',
      to: '2026-11-19T16:00:00.000Z',
      bucket: 'hour',
      buckets: [],
      totals: { runs: 5, succeeded: 5, failed: 0, running: 0, sampleCount: 5, successRate: 1 },
    });
  }
  if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEES);
  if (url.includes('/api/models/pricing')) {
    return Promise.reject(new ApiError('not wired', { status: 404, body: '', url }));
  }
  if (url.includes('/api/budget-usage')) {
    const params = new URL(url, 'http://local').searchParams;
    const kind = params.get('periodKind');
    const period = params.get('period');
    if (kind === 'day' && !emptyLedger && period === beijingDayKey(new Date())) {
      return Promise.resolve({ items: LEDGER_ROWS, missingEmployeeIds: [] });
    }
    return Promise.resolve({ items: [], missingEmployeeIds: [] });
  }
  return Promise.resolve({ items: [] });
}

/** RFC 4180 row split of a captured export: comments and the header removed. */
function dataRows(body: string): string[] {
  const lines = body.replace(/^\uFEFF/, '').split('\r\n');
  return lines.slice(1).filter((line) => line.length > 0 && !line.startsWith('#'));
}

type Captured = { blob: Blob; name: string };
function captureDownload(): { captured: Captured; restore: () => void } {
  const captured: Captured = { blob: new Blob([]), name: '' };
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = ((blob: Blob) => {
    captured.blob = blob;
    return 'blob:r116';
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function mock(this: HTMLAnchorElement) {
    captured.name = this.download;
  });
  return {
    captured,
    restore: () => {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      click.mockRestore();
    },
  };
}

const bodyRows = (): number => document.querySelectorAll('[data-testid^="met6-row-"]').length;
const copyButtons = (): number => document.querySelectorAll('[data-testid^="met-row-copy-"]').length;
const rowNames = (): string[] =>
  Array.from(document.querySelectorAll('[data-testid^="met6-row-"] .met6-rowname')).map((node) => node.textContent ?? '');

beforeEach(() => {
  emptyLedger = false;
  clip.copyTextToClipboard.mockReset();
  clip.copyTextToClipboard.mockImplementation((value: string) => Promise.resolve(Boolean(value)));
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('R116 — detail export, table and row copy describe the same rows', () => {
  it('keeps the three row counts identical on one fixture', async () => {
    const { captured, restore } = captureDownload();
    await mount();
    expect(bodyRows()).toBe(3);
    expect(copyButtons()).toBe(bodyRows());
    expect(q('metR-export-state')?.textContent).toContain('明细可导 3 行');
    await act(async () => {
      (q('met6-export') as HTMLButtonElement).click();
    });
    expect(captured.name).toMatch(/^metrics-detail-24h-employee-cost-desc-\d{8}-\d{4}\.csv$/);
    expect(dataRows(await captured.blob.text())).toHaveLength(bodyRows());
    restore();
  });

  it('exports in the screen order the current sort produced', async () => {
    const { captured, restore } = captureDownload();
    await mount('/metrics?dsort=cost&ddir=asc');
    expect(rowNames()[0]).toContain('小鲤');
    await act(async () => {
      (q('met6-export') as HTMLButtonElement).click();
    });
    const rows = dataRows(await captured.blob.text());
    expect(rows[0].split(',')[0]).toBe(rowNames()[0]);
    expect(rows[rows.length - 1].split(',')[0]).toBe(rowNames()[rowNames().length - 1]);
    restore();

    const second = captureDownload();
    await mount('/metrics?dsort=cost&ddir=desc');
    expect(rowNames()[0]).toContain('小满');
    await act(async () => {
      (q('met6-export') as HTMLButtonElement).click();
    });
    const descRows = dataRows(await second.captured.blob.text());
    expect(descRows[0].split(',')[0]).toBe(rowNames()[0]);
    second.restore();
  });

  it('keeps a real zero and a missing cost apart in both the file and the copy', async () => {
    const { captured, restore } = captureDownload();
    await mount('/metrics?dsort=cost&ddir=asc');
    await act(async () => {
      (q('met6-export') as HTMLButtonElement).click();
    });
    const rows = dataRows(await captured.blob.text());
    // 小鲤: real zero -> 0.00 in the file, $0.00 on screen; counts are not in
    // the ledger view, so both write the missing marker (empty cell / —).
    const fields = rows[0].split(',');
    expect(fields[0]).toBe('小鲤 · AAAABBBB');
    expect(fields[1]).toBe('0.00');
    expect(fields[2]).toBe('');
    // The file keeps the raw share number; the screen prints one decimal and a %.
    expect(fields[3]).toBe('0');
    expect(fields.at(-1)).toBe('24h');
    // 阿吉: no cost at all -> empty cells; share cannot be computed either.
    const missing = rows.find((line) => line.startsWith('阿吉'));
    expect(missing).toBeTruthy();
    expect(missing?.split(',')[1]).toBe('');
    expect(missing?.split(',')[3]).toBe('');

    await act(async () => {
      (q('met-row-copy-0') as HTMLButtonElement).click();
    });
    const copied = String((clip.copyTextToClipboard.mock.calls as unknown as Array<[string]>).at(-1)?.[0] ?? '');
    expect(copied).toBe('小鲤 · AAAABBBB · — · $0.00 · 0.0%');
    restore();
  });

  it('issues no request when exporting or copying a row', async () => {
    const { restore } = captureDownload();
    await mount();
    const before = urls().length;
    await act(async () => {
      (q('met6-export') as HTMLButtonElement).click();
    });
    await act(async () => {
      (q('met-row-copy-1') as HTMLButtonElement).click();
    });
    expect(urls().length).toBe(before);
    expect(q('met-row-copy-status')?.textContent).toContain('已复制');
    restore();
  });

  it('disables the export and renders no copy button when there is no row', async () => {
    emptyLedger = true;
    await mount();
    expect(bodyRows()).toBe(0);
    expect(copyButtons()).toBe(0);
    expect(q('met6-table')).toBeNull();
    const button = q('met6-export') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('title')).toContain('没有可导出的数据');
    expect(text()).not.toContain('只写表头');
  });
});
