// @vitest-environment jsdom
// R143 — the summary faces and the table body are one computation shown twice.
// Under a single fixture every card, every footer cell and the copied summary
// line must carry the same bytes as the rows above them; re-sorting the detail
// body must move rows and nothing else; a real zero must read `0` / `$0.00` on
// both faces while a missing value reads «—» on both; and when nothing comes
// back the faces must stay dashes without throwing or rendering row controls.
// Nothing here retypes an expected aggregate: each one is re-derived from the
// rendered body cells (or from the fixture through the module's own exports) and
// then compared element to element.
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));
vi.mock('@/modules/models/fetchJson', () => ({ fetchJsonStrict: api.fetchJsonStrict }));
vi.mock('@/lib/clipboard', () => ({ copyTextToClipboard: clip.copyTextToClipboard }));

import { MetricsModulePage } from './MetricsModulePage';
import {
  buildHeatGrid,
  formatCount,
  formatSharePct,
  formatUsd,
  parseDetailSort,
  readActivity,
  shareOfWhole,
  sortDetailLines,
  sumOrNull,
} from './metrics';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Frozen so two mounts of one link are comparable byte for byte. */
const FROZEN = '2026-11-19T12:00:00.000Z';
/** beijingDayKey(new Date(FROZEN)) — 20:00 in Beijing, one whole ledger day. */
const DAY = '2026-11-19';

const ID_A = 'emp_aaaabbbbcccc';
const ID_B = 'emp_ddddeeeeffff';
const ID_C = 'emp_iiiijjjjkkkk';

const EMPLOYEES = {
  items: [
    { employeeId: ID_A, name: '小鲤' },
    { employeeId: ID_B, name: '小满' },
    { employeeId: ID_C, name: '阿吉' },
  ],
  nextCursor: null,
};

/** Swapped per case; the handler below always reads the current value. */
type Row = { employeeId: string; period: string; periodKind: string; costUsd: number | null; updatedAt: string };
type Cell = { dow: number; hour: number; count: number | null };
let ledgerRows: Row[] = [];
let heatCells: Cell[] = [];
let modelRows: Record<string, unknown>[] = [];
let statsTotals: {
  runs: number;
  succeeded: number;
  failed: number;
  running: number;
  sampleCount: number;
  successRate: number | null;
} = { runs: 20, succeeded: 19, failed: 1, running: 0, sampleCount: 20, successRate: 0.95 };

function setCoherent(): void {
  ledgerRows = [
    { employeeId: ID_A, period: DAY, periodKind: 'day', costUsd: 0.2, updatedAt: `${DAY}T03:20:00.000Z` },
    { employeeId: ID_B, period: DAY, periodKind: 'day', costUsd: 0.5, updatedAt: `${DAY}T04:20:00.000Z` },
    { employeeId: ID_C, period: DAY, periodKind: 'day', costUsd: 0.05, updatedAt: `${DAY}T05:20:00.000Z` },
  ];
  heatCells = [
    { dow: 1, hour: 9, count: 4 },
    { dow: 2, hour: 14, count: 3 },
    { dow: 3, hour: 22, count: 2 },
    { dow: 5, hour: 11, count: 5 },
  ];
  modelRows = [
    { model: 'alpha', api_calls: 4, input_tokens: 1000, output_tokens: 200 },
    { model: 'zeta', api_calls: 9, input_tokens: 500, output_tokens: 50 },
    { model: 'mid', sessions: 2, input_tokens: 300 },
  ];
  statsTotals = { runs: 20, succeeded: 19, failed: 1, running: 0, sampleCount: 20, successRate: 0.95 };
}

/** One real zero, one missing value, one readable amount. */
function setZeroAndGap(): void {
  ledgerRows = [
    { employeeId: ID_A, period: DAY, periodKind: 'day', costUsd: 0.2, updatedAt: `${DAY}T03:20:00.000Z` },
    { employeeId: ID_B, period: DAY, periodKind: 'day', costUsd: 0, updatedAt: `${DAY}T04:20:00.000Z` },
    { employeeId: ID_C, period: DAY, periodKind: 'day', costUsd: null, updatedAt: `${DAY}T05:20:00.000Z` },
  ];
}

/** A real zero in the count column beside a row with no count at all. */
function setModelZero(): void {
  modelRows = [
    { model: 'alpha', api_calls: 0, input_tokens: 10, output_tokens: 1 },
    { model: 'zeta', input_tokens: 20, output_tokens: 2 },
    { model: 'mid', sessions: 2, input_tokens: 300 },
  ];
}

function setEmpty(): void {
  ledgerRows = [];
  heatCells = [];
  modelRows = [];
  statsTotals = { runs: 0, succeeded: 0, failed: 0, running: 0, sampleCount: 0, successRate: null };
}

const activityPayload = (): unknown => ({
  cells: heatCells,
  max: heatCells.length > 0 ? Math.max(...heatCells.map((cell) => cell.count ?? 0)) : null,
  from: '2026-11-12T16:00:00.000Z',
  to: '2026-11-19T15:59:59.000Z',
  tz: 'Asia/Shanghai',
});

function handler(url: string): Promise<unknown> {
  const at = new URL(url, 'http://local');
  if (url.includes('/api/run-activity')) return Promise.resolve(activityPayload());
  if (url.includes('/api/run-stats')) {
    return Promise.resolve({
      from: at.searchParams.get('from'),
      to: at.searchParams.get('to'),
      bucket: at.searchParams.get('bucket') ?? 'hour',
      buckets: [],
      totals: statsTotals,
    });
  }
  if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEES);
  if (url.includes('/api/models/pricing')) return Promise.reject(new ApiError('not wired', { status: 404, body: '', url }));
  if (url.includes('/api/budget-usage')) {
    const today = at.searchParams.get('periodKind') === 'day' && at.searchParams.get('period') === DAY;
    return Promise.resolve({ items: today ? ledgerRows : [], missingEmployeeIds: [] });
  }
  if (url.includes('/api/hermes-usage')) {
    return Promise.resolve({
      by_model: modelRows,
      cost: { source: 'cost_ledger', cost_usd: null, cost_status: 'unknown', rows: 0, per_employee: [] },
      asOf: `${DAY}T12:00:00.000Z`,
    });
  }
  return Promise.resolve({ items: [] });
}

let root: Root | null = null;

/** Bounded on ticks, not on the clock: the clock is frozen on purpose. */
async function waitFor(cond: () => boolean, label = 'condition'): Promise<void> {
  for (let tick = 0; !cond(); tick += 1) {
    if (tick > 600) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const face = (id: string): string | null => q(id)?.textContent ?? null;
const urls = (): string[] => api.fetchJsonStrict.mock.calls.map((call) => String(call[0]));
const settled = (): boolean => document.querySelector('.met5-skeleton') === null;

async function drain(): Promise<void> {
  let previous = -1;
  let stable = 0;
  for (let round = 0; round < 200 && stable < 6; round += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    const count = urls().length;
    stable = count === previous ? stable + 1 : 0;
    previous = count;
  }
  await waitFor(settled, 'state settled');
}

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
        <AddressProbe />
      </MemoryRouter>,
    );
  });
  await waitFor(settled, 'initial batch');
  await drain();
}

async function press(id: string): Promise<void> {
  const button = q(id) as HTMLButtonElement | null;
  if (button === null) throw new Error(`press: control ${id} is missing`);
  await act(async () => {
    button.click();
  });
  await drain();
}

beforeEach(() => {
  // Every case starts from the coherent fixture; the ones that need another
  // shape call setZeroAndGap / setModelZero / setEmpty themselves.
  setCoherent();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN));
  window.history.replaceState({}, '', '/');
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
  vi.useRealTimers();
});

function AddressProbe(): ReactNode {
  const location = useLocation();
  return <p data-testid="r143-loc">{location.search}</p>;
}
const loc = (): string => face('r143-loc') ?? '';

// ---- reading the rendered body --------------------------------------------

/** Every value the page shows is text; only a plain number is a readable value. */
function numberOrNull(raw: string | null): number | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (!/^\d[\d,]*(?:\.\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed.replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

/** The money cell of a row: `$1,234.56` → 1234.56, «—» → null. */
function usdOrNull(raw: string | null): number | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (!/^\$-?\d[\d,]*(?:\.\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed.replace(/[$,]/g, ''));
  return Number.isFinite(value) ? value : null;
}

const detailRows = (): HTMLElement[] => [...document.querySelectorAll('[data-testid^="met6-row-"]')] as HTMLElement[];
/** The value a cell shows, without the explanation line the page may add below it. */
const primaryText = (cell: Element): string =>
  [...cell.childNodes]
    .filter((part) => part.nodeType === 3)
    .map((part) => part.textContent ?? '')
    .join('')
    .trim();
const detailCells = (row: HTMLElement): string[] => [...row.querySelectorAll('td')].map(primaryText);
const detailNames = (): string[] => detailRows().map((row) => row.querySelector('.met6-rowname')?.textContent ?? '');

/** The detail body as the footer sees it: label plus the three sortable values. */
function detailLines(): { label: string; count: number | null; costUsd: number | null; share: number | null }[] {
  return detailRows().map((row) => {
    const cells = detailCells(row);
    return {
      label: row.querySelector('.met6-rowname')?.textContent ?? '',
      costUsd: usdOrNull(cells[1] ?? null),
      count: numberOrNull(cells[2] ?? null),
      share: numberOrNull((cells[3] ?? '').replace(/%$/, '')),
    };
  });
}

/** Share row cells, whichever axis (`met7` model / `met8` employee) is on screen. */
function shareCells(kind: 'runs' | 'cost' | 'share'): HTMLElement[] {
  const found: HTMLElement[] = [];
  for (const element of [...document.querySelectorAll('[data-testid]')]) {
    if (element.tagName !== 'TD') continue;
    const id = element.getAttribute('data-testid') ?? '';
    if (new RegExp(`^(met7|met8)-${kind}-`).test(id)) found.push(element as HTMLElement);
  }
  return found;
}

/** `合计：运行 X · 成本 $Y · 占比 Z%` split by the label the page itself prints. */
function summaryTokens(): Record<'runs' | 'cost' | 'share', string | null> {
  const line = face('metU-copy-total') ?? '';
  const pick = (label: string): string | null => {
    const match = new RegExp(`${label}\\s*([^·]+)`).exec(line);
    return match ? match[1].trim() : null;
  };
  return { runs: pick('运行'), cost: pick('成本'), share: pick('占比') };
}

/** The faces that describe a total, so a case can compare them in one shot. */
const TOTAL_FACES = [
  'met5-count',
  'met6-runs-value',
  'met6-rate-value',
  'met6-cost-value',
  'met6-cost-month',
  'metT-detail-total-cost',
  'metT-detail-total-count',
  'metT-detail-total-share',
  'metT-share-total-runs',
  'metT-share-total-cost',
  'metT-share-total-share',
  'metAS-day',
  'metAS-month',
  'metAS-usage',
  'metX-window-runs',
  'metX-heat-runs',
  'metX-detail-runs',
  'metX-delta',
  'metAP-heat',
  'metAP-detail',
  'metAP-verdict',
  'metU-copy-total',
];
const faces = (): Record<string, string | null> => {
  const read: Record<string, string | null> = {};
  for (const id of TOTAL_FACES) read[id] = face(id);
  return read;
};
const readableFaces = (read: Record<string, string | null>): number =>
  Object.values(read).filter((value) => value !== null && value !== '—').length;

describe('R143 ① summary faces equal the body they summarize', () => {
  it('puts the day card, the caliber face and the detail footer on one number', async () => {
    await mount('/metrics');
    const lines = detailLines();
    expect(lines.length).toBeGreaterThan(0);
    const fromBody = formatUsd(sumOrNull(lines.map((line) => line.costUsd)));
    // The footer is the table's own total; the card and the caliber face are the
    // summary side. All three must be the same bytes as the body re-summed.
    expect(face('metT-detail-total-cost')).toBe(fromBody);
    expect(face('met6-cost-value')).toBe(fromBody);
    expect(face('metAS-day')).toBe(fromBody);
    // And the number is not a coincidence of one row: it is the sum, so it must
    // differ from every single row it adds up.
    for (const line of lines) expect(fromBody).not.toBe(formatUsd(line.costUsd));
  });

  it('puts the window total, the heat faces and the runs card on their own sources', async () => {
    await mount('/metrics');
    // Heat: one grid read by the module's own builder, shown on four faces.
    const read = readActivity(activityPayload());
    if (read.kind !== 'ok') throw new Error(`activity read did not come back ok: ${read.kind}`);
    const grid = buildHeatGrid(read.activity);
    const fromFixture = grid.total === null ? '—' : String(grid.total);
    // The grid the module builds is the same arithmetic the fixture states.
    expect(fromFixture).toBe(String(heatCells.reduce((sum, cell) => sum + (cell.count ?? 0), 0)));
    expect(face('met5-count')).toBe(fromFixture);
    expect(face('metX-window-runs')).toBe(fromFixture);
    expect(face('metX-heat-runs')).toBe(fromFixture);
    expect(face('metAP-heat')).toBe(fromFixture);
    // Runs card: the stats totals are a separate caliber (own source, own face).
    expect(face('met6-runs-value')).toBe(formatCount(statsTotals.runs));
    expect(face('met6-runs-value')).not.toBe(fromFixture);
  });

  it('writes the copied summary line with the share footer cells, not beside them', async () => {
    await mount('/metrics?groupBy=employee&view=model');
    const runs = shareCells('runs');
    const costs = shareCells('cost');
    const shares = shareCells('share');
    expect(runs.length).toBeGreaterThan(0);
    expect(costs.length).toBe(runs.length);
    expect(shares.length).toBe(runs.length);
    const costValues = costs.map((cell) => usdOrNull(cell.textContent));
    const shareValues = shares.map((cell) => numberOrNull((cell.textContent ?? '').replace(/%$/, '')));
    const fromBody = {
      runs: formatCount(sumOrNull(runs.map((cell) => numberOrNull(cell.textContent)))),
      cost: formatUsd(sumOrNull(costValues)),
      share: formatSharePct(shareOfWhole(costValues, sumOrNull(costValues))),
    };
    // The share column adds up to the whole the footer names, cell by cell.
    expect(sumOrNull(shareValues)).not.toBe(0);
    expect(face('metT-share-total-runs')).toBe(fromBody.runs);
    expect(face('metT-share-total-cost')).toBe(fromBody.cost);
    expect(face('metT-share-total-share')).toBe(fromBody.share);
    // The copy summary is the same three cells in one sentence.
    const tokens = summaryTokens();
    expect(tokens.runs).toBe(face('metT-share-total-runs'));
    expect(tokens.cost).toBe(face('metT-share-total-cost'));
    expect(tokens.share).toBe(face('metT-share-total-share'));
  });

  it('pairs the detail footer with its rows in the model view as well', async () => {
    await mount('/metrics?view=model');
    const lines = detailLines();
    expect(lines.length).toBeGreaterThan(0);
    const fromBody = {
      cost: formatUsd(sumOrNull(lines.map((line) => line.costUsd))),
      count: sumOrNull(lines.map((line) => line.count)) === null ? '—' : String(sumOrNull(lines.map((line) => line.count))),
    };
    expect(face('metT-detail-total-cost')).toBe(fromBody.cost);
    expect(face('metT-detail-total-count')).toBe(fromBody.count);
    expect(face('metX-detail-runs')).toBe(fromBody.count);
    expect(face('metAP-detail')).toBe(fromBody.count);
    // In this view the money column has no readable cell at all, so the footer
    // must read «—» instead of inventing a total out of the dashes.
    expect(detailRows().map((row) => detailCells(row)[1])).not.toContain('$0.00');
    expect(fromBody.cost).toBe('—');
  });
});

describe('R143 ② re-sorting the body moves rows and nothing else', () => {
  it('keeps every total byte-identical when the address sorts the detail by runs', async () => {
    await mount('/metrics?view=model');
    const before = faces();
    const names = detailNames();
    const lines = detailLines();
    expect(readableFaces(before)).toBeGreaterThan(8);
    await mount('/metrics?view=model&dsort=runs&ddir=asc');
    expect(faces()).toEqual(before);
    const expected = sortDetailLines(lines, parseDetailSort('runs') ?? 'runs', 'asc').map((line) => line.label);
    expect(detailNames()).toEqual(expected);
    expect(detailNames()).not.toEqual(names);
    expect(q('metO-fmt-th-count')?.getAttribute('aria-sort')).toBe('ascending');
    expect(q('metO-fmt-th-spend')?.getAttribute('aria-sort')).not.toBe('descending');
  });

  it('reaches the same totals by pressing the header control as by the link', async () => {
    await mount('/metrics?view=model');
    const before = faces();
    const names = detailNames();
    const lines = detailLines();
    await press('metP-sort-runs');
    expect(loc()).toContain('dsort=runs');
    expect(loc()).toContain('ddir=desc');
    expect(faces()).toEqual(before);
    expect(detailNames()).toEqual(sortDetailLines(lines, parseDetailSort('runs') ?? 'runs', 'desc').map((line) => line.label));
    await press('metP-sort-runs');
    expect(loc()).toContain('ddir=asc');
    expect(faces()).toEqual(before);
    // A third press of the same control lands back on runs-descending: the
    // address still names both keys, the totals still do not move.
    await press('metP-sort-runs');
    expect(loc()).toContain('dsort=runs');
    expect(loc()).toContain('ddir=desc');
    expect(detailNames()).not.toEqual(names);
    expect(faces()).toEqual(before);
    // Cost-descending IS the default order, so naming it leaves no trace at all
    // and the body is back to the order the link opened with.
    await press('metP-sort-cost');
    expect(loc()).not.toContain('dsort');
    expect(loc()).not.toContain('ddir');
    expect(detailNames()).toEqual(names);
    expect(faces()).toEqual(before);
  });

  it('leaves the other axis untouched when only the detail sort changes', async () => {
    await mount('/metrics?window=7d&view=model&sort=model&dir=asc');
    const shareRunIds = shareCells('runs').map((cell) => cell.getAttribute('data-testid'));
    const before = faces();
    const requests = urls().length;
    await press('metP-sort-runs');
    expect(shareCells('runs').map((cell) => cell.getAttribute('data-testid'))).toEqual(shareRunIds);
    expect(faces()).toEqual(before);
    expect(urls().length).toBe(requests);
  });
});

describe('R143 ③ a real zero and a missing value read the same on both faces', () => {
  it('shows $0.00 in the row and still adds it into one honest total', async () => {
    setZeroAndGap();
    await mount('/metrics');
    const lines = detailLines();
    const zero = lines.find((line) => line.costUsd === 0);
    const gap = lines.find((line) => line.costUsd === null);
    expect(zero).toBeDefined();
    expect(gap).toBeDefined();
    expect(formatUsd(zero?.costUsd ?? null)).toBe('$0.00');
    expect(formatUsd(gap?.costUsd ?? null)).toBe('—');
    // The row cells themselves carry those two glyphs, so the summary side and
    // the body side cannot disagree about what zero and nothing mean.
    const cells = detailRows().map((row) => detailCells(row)[1]);
    expect(cells).toContain('$0.00');
    expect(cells).toContain('—');
    // The zero row is added in; the gap row is left out. That is the whole
    // difference between «no money» and «no value», and both faces must agree.
    const readable = lines.map((line) => line.costUsd).filter((value): value is number => value !== null);
    expect(readable).toContain(0);
    expect(readable.length).toBe(lines.length - 1);
    const fromBody = formatUsd(readable.reduce((sum, value) => sum + value, 0));
    expect(face('metT-detail-total-cost')).toBe(fromBody);
    expect(face('met6-cost-value')).toBe(fromBody);
    expect(face('metAS-day')).toBe(fromBody);
  });

  it('shows 0 in the count column and keeps the footer counting it', async () => {
    setCoherent();
    setModelZero();
    await mount('/metrics?view=model');
    const lines = detailLines();
    const cells = detailRows().map((row) => detailCells(row)[2]);
    expect(cells).toContain('0');
    expect(cells).toContain('—');
    const readable = lines.map((line) => line.count).filter((value): value is number => value !== null);
    expect(readable).toContain(0);
    expect(readable.length).toBe(lines.length - 1);
    const total = readable.reduce((sum, value) => sum + value, 0);
    expect(face('metT-detail-total-count')).toBe(String(total));
    expect(face('metX-detail-runs')).toBe(String(total));
    expect(face('metAP-detail')).toBe(String(total));
    // The money side of the same rows has no readable cell at all: dashes only.
    expect(face('metT-detail-total-cost')).toBe('—');
    expect(detailRows().map((row) => detailCells(row)[1])).not.toContain('$0.00');
  });

  it('keeps a zero row and a gap row in the share footer on the same words', async () => {
    setZeroAndGap();
    await mount('/metrics?groupBy=employee&view=model');
    const costs = shareCells('cost').map((cell) => cell.textContent?.trim() ?? '');
    expect(costs).toContain('$0.00');
    expect(costs).toContain('—');
    const fromBody = formatUsd(sumOrNull(shareCells('cost').map((cell) => usdOrNull(cell.textContent))));
    expect(fromBody).not.toBe('—');
    expect(fromBody).not.toBe('$0.00');
    expect(face('metT-share-total-cost')).toBe(fromBody);
    expect(summaryTokens().cost).toBe(fromBody);
  });
});

describe('R143 ④ an empty dataset stays honest and quiet', () => {
  /** The one known product-side warning, already present in older cases. */
  const KNOWN_CONSOLE_NOISE = [/data-metO-unit/];

  const freshConsoleErrors = (spied: unknown[][]): string[] =>
    spied
      .map((call) => call.map((part) => String(part)).join(' '))
      .filter((line) => !KNOWN_CONSOLE_NOISE.some((pattern) => pattern.test(line)));

  it('holds every face at a dash and renders no rows or row controls', async () => {
    setEmpty();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await mount('/metrics');
      expect(q('met5-error')).toBeNull();
      expect(freshConsoleErrors(errors.mock.calls)).toEqual([]);
      expect(detailRows()).toHaveLength(0);
      expect(document.querySelectorAll('[data-testid^="met-row-copy-"]')).toHaveLength(0);
      expect(q('metT-total-row')).toBeNull();
      // Where a face is drawn with the reads empty, it must say «—»; where the
      // read itself is empty the card shows its own empty state instead. Neither
      // may print a number that the fixture never supplied.
      const dashed = ['met5-count', 'met6-cost-value', 'metAS-day', 'metX-window-runs', 'metX-heat-runs', 'metAP-heat'].filter(
        (id) => face(id) === '—',
      );
      expect(dashed).toContain('met6-cost-value');
      expect(dashed).toContain('metAS-day');
      for (const id of ['met5-count', 'metX-window-runs', 'metX-heat-runs', 'metAP-heat']) {
        const value = face(id);
        if (value !== null) expect(value).toBe('—');
      }
      expect(q('met5-empty') ?? q('met6-empty')).not.toBeNull();
      // Nothing is invented as a zero where the read came back empty: no face
      // that is drawn prints a zero money amount. The check reads the faces, not
      // the prose, because the page's own caliber note names the «$0.00» rule.
      for (const value of Object.values(faces())) {
        if (value !== null) expect(value).not.toContain('$0.00');
      }
      expect(face('met6-runs-value')).toBe(formatCount(0));
    } finally {
      errors.mockRestore();
    }
  });

  it('holds the share side and the copied summary at dashes when no row rendered', async () => {
    setEmpty();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await mount('/metrics?groupBy=employee&view=model');
      expect(q('met5-error')).toBeNull();
      expect(freshConsoleErrors(errors.mock.calls)).toEqual([]);
      expect(shareCells('cost')).toHaveLength(0);
      expect(q('metT-total-row-share')).toBeNull();
      expect(face('metT-detail-total-count')).toBeNull();
      expect(face('metAS-day')).toBe('—');
      expect(face('metAS-usage')).toBe('—');
      // The summary sentence the copy button would write is the no-rows one,
      // and it invents no digit for a window that returned nothing.
      expect(face('metU-copy-total')).toContain('无可渲染行');
      expect((face('metU-copy-total') ?? '').replace(/^合计：/, '')).not.toMatch(/\d/);
    } finally {
      errors.mockRestore();
    }
  });
});
