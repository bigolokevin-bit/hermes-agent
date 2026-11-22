// @vitest-environment jsdom
// metN — the six data-caliber rules the page already promises, pinned as
// regression guards. Each assertion names the rule it protects (R1–R6):
//   R1  a real zero stays $0.00 / 0.00; a missing value stays «—» / empty
//   R2  a collection time is a top-level ISO instant or nothing (never the clock)
//   R3  staleness needs a real ISO pair and more than 15 minutes
//   R4  an export's row order is the table's row order
//   R5  a missing-block note is the last line and never a data row
//   R6  as_of / window headers are always present; missing cells stay empty
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn((text: string) => Promise.resolve(Boolean(text))) }));
vi.mock('@/modules/models/fetchJson', () => ({ fetchJsonStrict: api.fetchJsonStrict }));
vi.mock('@/lib/clipboard', () => ({ copyTextToClipboard: clip.copyTextToClipboard }));

import { MetricsModulePage } from './MetricsModulePage';
import { COST_CALIBER_TEXT, costCaliberTitle } from './costCaliberNote';
import {
  EMPTY_SOURCE_STAMP,
  SOURCE_STALE_MS,
  SHARE_CSV_HEADER,
  exportGapNote,
  formatUsd,
  isoOrNull,
  readModelCost,
  readModelUsage,
  readPricing,
  readSourceStamp,
  readTopAsOf,
  shareCsv,
  shareCsvRows,
  sourceStaleness,
  toCsv,
  withGapNote,
} from './metrics';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ---- page harness (only what R1/R2/R4/R6 need to be checked end to end) ----

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

const STATS = {
  from: '2026-11-18T16:00:00.000Z',
  to: '2026-11-19T16:00:00.000Z',
  bucket: 'hour',
  buckets: [],
  totals: { runs: 0, succeeded: 0, failed: 0, running: 0, sampleCount: 0, successRate: null },
};

function pageRouter(usage: unknown): (url: string) => Promise<unknown> {
  return (url: string): Promise<unknown> => {
    if (url.includes('run-activity')) {
      return Promise.resolve({
        cells: [],
        max: null,
        from: '2026-11-12T16:00:00Z',
        to: '2026-11-19T15:59:59Z',
        tz: 'Asia/Shanghai',
      });
    }
    if (url.includes('run-stats')) return Promise.resolve(STATS);
    if (url.includes('/api/employees')) return Promise.resolve({ items: [], nextCursor: null });
    if (url.includes('models/pricing')) return Promise.resolve({ prices: [] });
    if (url.includes('hermes-usage')) return Promise.resolve(usage);
    if (url.includes('budget-usage')) return Promise.resolve({ items: [], missingEmployeeIds: [] });
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
      return 'blob:caliber';
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
  // R6: the file carries a UTF-8 BOM so spreadsheets read it as UTF-8.
  expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
  const text = await blob!.text();
  return text.replace(/^\uFEFF/, '').split('\r\n');
}

function shareDownload(): Promise<void> {
  return act(async () => {
    (document.querySelector('[data-testid="metA-export"]') as HTMLButtonElement).click();
  });
}

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

describe('metN — R1: a real zero is not a missing value', () => {
  it('R1 keeps $0.00 and — apart on screen and as 0.00 vs an empty cell in files', async () => {
    const { captured } = captureDownload();
    await mount(pageRouter({ by_model: [{ model: 'zero', sessions: 2, actual_cost_usd: 0 }, { model: 'none' }] }));
    await waitFor(
      () => document.querySelector('[data-testid="met7-row-zero"]') !== null,
      'share table ready',
    );

    // Screen: a ledger zero prints as a real amount, a missing cost as a dash.
    expect(document.querySelector('[data-testid="met7-cost-zero"]')?.textContent).toBe('$0.00');
    expect(document.querySelector('[data-testid="met7-cost-none"]')?.textContent).toBe('—');
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(null)).toBe('—');

    await shareDownload();
    const lines = await csvLines(captured.blob);
    const zero = lines.find((line) => line.startsWith('zero,'));
    const none = lines.find((line) => line.startsWith('none,'));
    // R1: the zero exports as `0.00`; the missing one exports as an empty cell.
    expect(zero?.split(',')[2]).toBe('0.00');
    expect(none?.split(',')[2]).toBe('');
  });
});

describe('metN — R2: the collection time is a top-level ISO instant or nothing', () => {
  const iso = '2026-11-19T20:12:00.000Z';

  it('R2 accepts all six top-level names, each only when it is a full ISO instant', () => {
    for (const key of ['asOf', 'as_of', 'collectedAt', 'collected_at', 'generatedAt', 'generated_at']) {
      expect(readTopAsOf({ [key]: iso })).toBe(iso);
      expect(readSourceStamp({ [key]: iso }).asOf).toBe(iso);
    }
    // A free-form or date-only value is not a collection time.
    for (const bad of ['yesterday', '2026-11-19', '', '  ']) {
      expect(readTopAsOf({ asOf: bad })).toBeNull();
      expect(readSourceStamp({ as_of: bad }).asOf).toBeNull();
      expect(isoOrNull(bad)).toBeNull();
    }
    expect(readTopAsOf(null)).toBeNull();
    expect(readTopAsOf({ asOf: iso, as_of: 'yesterday' })).toBe(iso);
    // Nested values are not top-level: the reader never digs for a stamp.
    expect(readTopAsOf({ data: { asOf: iso } })).toBeNull();
  });

  it('R2 makes the price/usage/breakdown readers carry only an ISO stamp', () => {
    const pricing = readPricing({ prices: [], as_of: iso });
    expect(pricing.kind).toBe('ok');
    if (pricing.kind === 'ok') expect(pricing.asOf).toBe(iso);
    expect(readPricing({ prices: [], asOf: 'yesterday' })).toMatchObject({ kind: 'ok', asOf: null });
    expect(readModelUsage({ by_model: [], collected_at: iso })).toMatchObject({ kind: 'ok', asOf: iso });
    expect(readModelUsage({ by_model: [], generatedAt: 'not-a-time' })).toMatchObject({ kind: 'ok', asOf: null });
    expect(readModelCost({ by_model: [], collectedAt: iso })).toMatchObject({ kind: 'ok', asOf: iso });
    expect(readModelCost({ by_model: [], asOf: 'not-a-time' })).toMatchObject({ kind: 'ok', asOf: null });
  });

  it('R2 never lets the local clock stand in for a missing collection time', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2031-03-04T05:06:07.000Z')); // 13:06 in Beijing
    const { captured } = captureDownload();
    // The upstream answers without any collection time at all.
    await mount(pageRouter({ by_model: [{ model: 'zero', sessions: 1, actual_cost_usd: 1 }] }));
    await waitFor(() => document.querySelector('[data-testid="met7-row-zero"]') !== null, 'share table ready');

    await act(async () => {
      (document.querySelector('[data-testid="metB-source-toggle"]') as HTMLButtonElement | null)?.click();
    });
    const freshness = document.querySelector('[data-testid="metB-source-table"]')?.textContent ?? '';
    expect(freshness).not.toContain('2031');
    // R2: a source with no collection time says so — in the cell's title, never with a clock value.
    const asofCells = Array.from(document.querySelectorAll('[data-testid^="metB-source-asof-"]'));
    expect(asofCells.length).toBeGreaterThan(0);
    for (const cell of asofCells) {
      expect(cell.textContent).toBe('—');
      expect(cell.getAttribute('title')).toBe('上游未返回采集时刻；不用本机时间顶替。');
    }

    await shareDownload();
    const lines = await csvLines(captured.blob);
    // R2 + R6: the column is there, the cell is empty, no invented clock value.
    expect(lines[0].endsWith('as_of,window')).toBe(true);
    expect(lines[1].split(',')[4]).toBe('');
    expect(lines.join('\n')).not.toContain('2031');
  });
});

describe('metN — R3: staleness needs a real ISO pair and more than fifteen minutes', () => {
  const asOf = '2026-11-19T20:00:00.000Z';

  it('R3 flags a gap over the threshold and stays quiet under or at it', () => {
    expect(SOURCE_STALE_MS).toBe(15 * 60 * 1000);
    expect(sourceStaleness({ asOf, fetchedAt: '2026-11-19T20:40:00.000Z' })).toEqual({
      stale: true,
      ageMs: 40 * 60 * 1000,
    });
    expect(sourceStaleness({ asOf, fetchedAt: '2026-11-19T20:01:00.000Z' }).stale).toBe(false);
    // Exactly fifteen minutes is not "more than" fifteen.
    expect(sourceStaleness({ asOf, fetchedAt: '2026-11-19T20:15:00.000Z' }).stale).toBe(false);
  });

  it('R3 never calls a source stale when either side is not a real ISO stamp', () => {
    expect(sourceStaleness({ asOf: null, fetchedAt: '2026-11-19T20:40:00.000Z' })).toEqual({
      stale: false,
      ageMs: null,
    });
    expect(sourceStaleness({ asOf: 'yesterday', fetchedAt: '2026-11-19T20:40:00.000Z' })).toEqual({
      stale: false,
      ageMs: null,
    });
    expect(sourceStaleness({ asOf, fetchedAt: null })).toEqual({ stale: false, ageMs: null });
    expect(sourceStaleness(EMPTY_SOURCE_STAMP)).toEqual({ stale: false, ageMs: null });
  });
});

describe('metN — R4: the file keeps the table order', () => {
  const usage = {
    by_model: [
      { model: 'zeta', sessions: 4, actual_cost_usd: 3 },
      { model: 'alpha', sessions: 9, actual_cost_usd: 1 },
      { model: 'mid' },
    ],
    asOf: '2026-11-19T20:12:00.000Z',
  };

  const screenOrder = (): string[] =>
    [...document.querySelectorAll('[data-testid^="met7-row-"]')].map(
      (node) => node.querySelector('td')?.textContent ?? '',
    );

  it('R4 exports the default cost-descending order the table shows', async () => {
    const { captured } = captureDownload();
    await mount(pageRouter(usage));
    await waitFor(() => document.querySelector('[data-testid="met7-row-zeta"]') !== null, 'share table ready');

    expect(screenOrder()).toEqual(['zeta', 'alpha', 'mid']);
    await shareDownload();
    const lines = await csvLines(captured.blob);
    expect(lines.slice(1).filter((line) => !line.startsWith('#')).map((line) => line.split(',')[0])).toEqual(['zeta', 'alpha', 'mid']);
  });

  it('R4 exports the ?sort/?dir order exactly as re-sorted on screen', async () => {
    const { captured } = captureDownload();
    await mount(pageRouter(usage), '/metrics?groupBy=model&sort=model&dir=asc');
    await waitFor(() => document.querySelector('[data-testid="met7-row-alpha"]') !== null, 'share table ready');

    expect(screenOrder()).toEqual(['alpha', 'mid', 'zeta']);
    await shareDownload();
    const lines = await csvLines(captured.blob);
    expect(lines.slice(1).filter((line) => !line.startsWith('#')).map((line) => line.split(',')[0])).toEqual(['alpha', 'mid', 'zeta']);
  });
});

describe('metN — R5: a missing-block note is the last line and never a data row', () => {
  const rows = [
    { name: 'zeta', runs: 4, costUsd: 3, sharePct: 75, asOf: '2026-11-19T20:12:00.000Z', window: '24h' },
    { name: 'alpha', runs: 9, costUsd: 1, sharePct: 25, asOf: '2026-11-19T20:12:00.000Z', window: '24h' },
  ];

  it('R5 keeps the row count identical and appends exactly one note line', () => {
    const body = shareCsv(rows);
    const gaps = [{ label: '运行统计', reason: '这次没能读取这项数据，请稍后重试。' }];
    const withNote = withGapNote(body, gaps);
    const before = body.split('\r\n');
    const after = withNote.split('\r\n');

    expect(before).toHaveLength(1 + rows.length); // R5: header + data only
    expect(after).toHaveLength(before.length + 1);
    expect(after.slice(0, before.length)).toEqual(before); // data rows untouched
    const note = after[after.length - 1];
    expect(note.startsWith('# 本次导出缺少 1 块：运行统计（')).toBe(true);
    // R5: the note never inflates the data-row count the page reports.
    expect(shareCsvRows(rows)).toHaveLength(rows.length);
  });

  it('R5 adds no line at all when nothing is missing', () => {
    expect(exportGapNote([])).toBeNull();
    expect(withGapNote('a\r\nb', [])).toBe('a\r\nb');
  });
});

describe('metN — R6: provenance headers are always present, missing cells stay empty', () => {
  it('R6 keeps the as_of / window header on an all-missing file', () => {
    expect(SHARE_CSV_HEADER.slice(-2)).toEqual(['as_of', 'window']);
    const body = shareCsv([{ name: 'none', runs: null, costUsd: null, sharePct: null, asOf: null, window: null }]);
    const lines = body.split('\r\n');
    expect(lines[0]).toBe('group,runs,cost_usd,share_pct,as_of,window');
    // R6: the header survives, and every missing cell is empty — never 0.
    expect(lines[1]).toBe('none,,,,,');
    expect(lines).toHaveLength(2);
  });

  it('R6 does not grow a header when the file has no rows', () => {
    expect(toCsv(SHARE_CSV_HEADER, [])).toBe('group,runs,cost_usd,share_pct,as_of,window');
    expect(shareCsv([])).toBe('group,runs,cost_usd,share_pct,as_of,window');
  });
});

describe('metN — R7: the cost rows carry the caliber sentence, and a gap stays a dash', () => {
  const ZERO = { employeeId: 'emp_aaaabbbbcccc', period: '2026-11', periodKind: 'month', costUsd: 0, updatedAt: '2026-11-20T02:00:00.000Z' };
  // A ledger row that names no period and carries no amount and no stamp: every
  // value face of it has to read as a gap, never as 0 and never as an empty cell.
  const GAP = { employeeId: 'emp_ddddeeeeffff', periodKind: 'month', costUsd: null };
  const PAID = { employeeId: 'emp_iiiijjjjkkkk', period: '2026-11', periodKind: 'month', costUsd: 0.5, updatedAt: '2026-11-20T03:00:00.000Z' };
  const MONTH_ROWS = [ZERO, GAP, PAID];
  const DAY_ROWS = MONTH_ROWS.map((row) => ({ ...row, period: '2026-11-20' }));

  function caliberRouter(): (url: string) => Promise<unknown> {
    return (url: string): Promise<unknown> => {
      if (url.includes('run-activity')) {
        return Promise.resolve({ cells: [], max: null, from: '2026-11-12T16:00:00Z', to: '2026-11-19T15:59:59Z', tz: 'Asia/Shanghai' });
      }
      if (url.includes('run-stats')) return Promise.resolve(STATS);
      if (url.includes('/api/employees')) {
        return Promise.resolve({
          items: [
            { employeeId: 'emp_aaaabbbbcccc', name: '小鲤' },
            { employeeId: 'emp_ddddeeeeffff', name: '小满' },
            { employeeId: 'emp_iiiijjjjkkkk', name: '阿吉' },
          ],
          nextCursor: null,
        });
      }
      if (url.includes('models/pricing')) return Promise.resolve({ prices: [] });
      if (url.includes('hermes-usage')) return Promise.resolve({ by_model: [], cost: { cost_status: 'unknown' }, asOf: null });
      if (url.includes('budget-usage')) {
        const periodKind = url.includes('periodKind=month') ? 'month' : 'day';
        return Promise.resolve({ items: periodKind === 'month' ? MONTH_ROWS : DAY_ROWS, missingEmployeeIds: [] });
      }
      return Promise.resolve({});
    };
  }

  function snapshotRow(name: string): Element | null {
    const rows = [...document.querySelectorAll('[data-testid="met6-cost-rows"] .met6-row')];
    return rows.find((row) => (row.querySelector('.met6-row-who')?.textContent ?? '').startsWith(name)) ?? null;
  }

  function face(row: Element, selector: string): string {
    return (row.querySelector(selector)?.textContent ?? '').trim();
  }

  it('R7 puts the caliber sentence on the rows card and says it in one voice', async () => {
    await mount(caliberRouter());
    await waitFor(() => document.querySelector('[data-testid="met6-cost-rows"]') !== null, 'cost rows ready');

    const card = document.querySelector('[data-testid="metAJ-cost-row-caliber"]');
    expect(card).not.toBeNull();
    // The words are the page's single source, not a second copy written for this card.
    expect(card?.textContent?.trim()).toBe(COST_CALIBER_TEXT);
    expect(card?.getAttribute('title')).toBe(costCaliberTitle('metrics'));
    // R7: the card names the other dimension, so a reader cannot divide money by calls.
    expect(card?.textContent ?? '').toContain('调用次数');
    const wide = document.querySelector('[data-testid="met-cost-caliber-note"]');
    expect(wide).not.toBeNull();
    expect(wide?.textContent?.trim()).toBe(card?.textContent?.trim());
  });

  it('R7 keeps a real zero an amount and an absent amount a dash on every face', async () => {
    await mount(caliberRouter());
    await waitFor(() => document.querySelector('[data-testid="met6-cost-rows"]') !== null, 'cost rows ready');

    const zero = snapshotRow('小鲤');
    const gap = snapshotRow('小满');
    expect(zero).not.toBeNull();
    expect(gap).not.toBeNull();
    // R1 again, this time on the rows card: a ledger zero is an amount.
    expect(face(zero!, '.met6-row-amount')).toBe('$0.00');
    expect(face(zero!, '.met6-row-period')).toBe('2026-11');
    expect(face(zero!, '.met6-row-asof')).not.toBe('');
    // A missing money, period or stamp prints the dash, never 0 and never a blank.
    expect(face(gap!, '.met6-row-amount')).toBe('—');
    expect(face(gap!, '.met6-row-period')).toBe('—');
    expect(face(gap!, '.met6-row-asof')).toBe('—');
    expect(face(gap!, '.met6-row-who')).toContain('小满');
  });
});
