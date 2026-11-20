// @vitest-environment jsdom
// R119 — the address is the one source of truth for the statistics window and
// the detail view. A shared link must backfill the same controls, ask for the
// same bytes and land on the same rows as pressing those controls by hand;
// values the page cannot use are disclosed instead of silently dropped; and one
// mount fetches exactly one batch.
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
vi.mock('@/modules/models/fetchJson', () => ({ fetchJsonStrict: api.fetchJsonStrict }));

import { MetricsModulePage } from './MetricsModulePage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The clock stands still: `from`/`to` are derived from `new Date()`, so two
 * mounts of one link are only comparable byte-for-byte when the wall clock
 * cannot drift between them.
 */
const FROZEN = '2026-11-19T12:00:00.000Z';
const FROZEN_MS = Date.parse(FROZEN);
/** beijingDayKey(new Date(FROZEN)) — 20:00 in Beijing, so one whole ledger day. */
const DAY = '2026-11-19';

const PRESETS = [
  { id: '24h', hours: 24, days: 1, bucket: 'hour' },
  { id: '7d', hours: 168, days: 7, bucket: 'day' },
  { id: '30d', hours: 720, days: 30, bucket: 'day' },
] as const;
type PresetId = (typeof PRESETS)[number]['id'];
type ViewId = 'employee' | 'model';
const WINDOW_BUTTONS = ['met6-window-24h', 'met6-window-7d', 'met6-window-30d'];
const VIEW_BUTTONS = ['met6-cat-employee', 'met6-cat-model'];

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
const text = (): string => document.body.textContent ?? '';
const urls = (): string[] => api.fetchJsonStrict.mock.calls.map((call) => String(call[0]));
const settled = (): boolean => document.querySelector('.met5-skeleton') === null;

/** Keep pumping until no further request arrives and no skeleton is left. */
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

function AddressProbe(): ReactNode {
  const location = useLocation();
  const navigation = useNavigationType();
  return (
    <>
      <p data-testid="r119-loc">{location.search}</p>
      <p data-testid="r119-nav">{navigation}</p>
    </>
  );
}

const EMPLOYEES = {
  items: [
    { employeeId: 'emp_aaaabbbbcccc', name: '小鲤' },
    { employeeId: 'emp_ddddeeeeffff', name: '小满' },
    { employeeId: 'emp_iiiijjjjkkkk', name: '阿吉' },
  ],
  nextCursor: null,
};

// Distinct money so the detail order is observable, and only on the frozen day
// so every window preset reads the same three rows.
const LEDGER = [
  { employeeId: 'emp_aaaabbbbcccc', period: DAY, periodKind: 'day', costUsd: 0.2, updatedAt: `${DAY}T03:20:00.000Z` },
  { employeeId: 'emp_ddddeeeeffff', period: DAY, periodKind: 'day', costUsd: 0.5, updatedAt: `${DAY}T04:20:00.000Z` },
  { employeeId: 'emp_iiiijjjjkkkk', period: DAY, periodKind: 'day', costUsd: 0.05, updatedAt: `${DAY}T05:20:00.000Z` },
];

const USAGE = {
  by_model: [
    { model: 'alpha', api_calls: 9, input_tokens: 1000, output_tokens: 200 },
    { model: 'zeta', api_calls: 4, input_tokens: 500, output_tokens: 50 },
    { model: 'mid', sessions: 2, input_tokens: 300 },
  ],
  cost: { source: 'cost_ledger', cost_usd: null, cost_status: 'unknown', rows: 0, per_employee: [] },
  asOf: `${DAY}T12:00:00.000Z`,
};

function handler(url: string): Promise<unknown> {
  const at = new URL(url, 'http://local');
  if (url.includes('/api/run-activity')) {
    return Promise.resolve({ cells: [], max: null, from: '2026-11-12T16:00:00.000Z', to: '2026-11-19T15:59:59.000Z', tz: 'Asia/Shanghai' });
  }
  if (url.includes('/api/run-stats')) {
    return Promise.resolve({
      from: at.searchParams.get('from'),
      to: at.searchParams.get('to'),
      bucket: at.searchParams.get('bucket') ?? 'hour',
      buckets: [],
      totals: { runs: 5, succeeded: 5, failed: 0, running: 0, sampleCount: 5, successRate: 1 },
    });
  }
  if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEES);
  if (url.includes('/api/models/pricing')) return Promise.reject(new ApiError('not wired', { status: 404, body: '', url }));
  if (url.includes('/api/budget-usage')) {
    const today = at.searchParams.get('periodKind') === 'day' && at.searchParams.get('period') === DAY;
    return Promise.resolve({ items: today ? LEDGER : [], missingEmployeeIds: [] });
  }
  if (url.includes('/api/hermes-usage')) return Promise.resolve(USAGE);
  return Promise.resolve({ items: [] });
}

// ---- projections over a captured batch ------------------------------------

const paramsOf = (url: string): URLSearchParams => new URL(url, 'http://local').searchParams;
const pathOf = (url: string): string => new URL(url, 'http://local').pathname;
const sorted = (list: Iterable<string>): string[] => [...new Set(list)].sort();

/**
 * The byte-exact read of one preset's window: the half-open range that ends at
 * the frozen now, at that preset's own bucket. Which window the page actually
 * picked is pinned by `hermes-usage?days=` below (only the window-derived
 * loaders read it); this pins the spelling of the range it asked for.
 */
const statsReadOf = (presetId: PresetId): string => {
  const preset = PRESETS.find((item) => item.id === presetId);
  if (!preset) throw new Error(`statsReadOf: unknown preset ${presetId}`);
  return (
    `/agent-api/api/run-stats?from=${encodeURIComponent(new Date(FROZEN_MS - preset.hours * 3_600_000).toISOString())}` +
    `&to=${encodeURIComponent(FROZEN)}&bucket=${preset.bucket}`
  );
};
const usageDays = (list: string[]): string[] =>
  sorted(list.filter((url) => pathOf(url).endsWith('/api/hermes-usage')).map((url) => paramsOf(url).get('days') ?? '—'));
const lastUsageDays = (...batches: string[][]): string[] => {
  for (let index = batches.length - 1; index >= 0; index -= 1) {
    const days = usageDays(batches[index]);
    if (days.length > 0) return days;
  }
  return [];
};
const pressedFrom = (ids: string[]): string[] => ids.filter((id) => q(id)?.getAttribute('aria-pressed') === 'true');
const headerFirstColumn = (): string => q('met6-table')?.querySelector('th')?.textContent ?? '';
const bodyRows = (): number => document.querySelectorAll('[data-testid^="met6-row-"]').length;
const loc = (): string => q('r119-loc')?.textContent ?? '';
const pairs = (search: string): string[] => sorted(new URLSearchParams(search).toString().split('&').filter(Boolean));
const perEndpoint = (list: string[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const url of list) counts[pathOf(url)] = (counts[pathOf(url)] ?? 0) + 1;
  return counts;
};

beforeEach(() => {
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
  vi.restoreAllMocks();
});

describe('R119 — a deep link backfills the same state the controls write', () => {
  for (const preset of PRESETS) {
    for (const view of ['employee', 'model'] as ViewId[]) {
      it(`?window=${preset.id}&view=${view} presses the same controls and asks for the same bytes`, async () => {
        const entry = `/metrics?window=${preset.id}&view=${view}`;
        await mount(entry);
        const deep = urls();

        expect(pressedFrom(WINDOW_BUTTONS)).toEqual([`met6-window-${preset.id}`]);
        expect(pressedFrom(VIEW_BUTTONS)).toEqual([`met6-cat-${view}`]);
        expect(headerFirstColumn()).toBe(view === 'model' ? '模型' : '员工');
        expect(bodyRows()).toBe(3);
        // The link alone already asks for this preset's exact half-open window.
        expect(deep).toContain(statsReadOf(preset.id));
        expect(usageDays(deep)).toEqual([String(preset.days)]);

        // Same state reached by hand from the bare address.
        await mount('/metrics');
        const base = urls();
        await press(`met6-window-${preset.id}`);
        const movedWindow = urls().slice(base.length);
        await press(`met6-cat-${view}`);
        const movedView = urls().slice(base.length + movedWindow.length);
        const pressed = [...base, ...movedWindow, ...movedView];

        // The intermediate state the clicks passed through, as its own link.
        await mount(`/metrics?window=${preset.id}`);
        const mid = urls();

        expect(pressed).toContain(statsReadOf(preset.id));
        // `hermes-usage` carries the window as `days=`: the last batch the click
        // path asked for that endpoint — the one reflecting the target state —
        // matches what the link asked for, byte for byte.
        expect(lastUsageDays(base, movedWindow, movedView)).toEqual(usageDays(deep));
        // Everything the link asked for is byte-identical to a request the
        // control path made, and vice versa up to the states it passed through.
        expect(sorted(deep).filter((url) => !pressed.includes(url))).toEqual([]);
        expect(sorted(pressed).filter((url) => !deep.includes(url) && !base.includes(url) && !mid.includes(url))).toEqual([]);
      });
    }
  }
});

describe('R119 — moving the detail view moves that one key only', () => {
  const LINK = '/metrics?window=7d&groupBy=employee&sort=model&dir=asc&heat=4&keep=me';
  const KEPT = ['dir=asc', 'groupBy=employee', 'heat=4', 'keep=me', 'sort=model', 'window=7d'];

  it('leaves every other key, including a foreign one, untouched', async () => {
    const historyBefore = window.history.length;
    await mount(LINK);
    // `groupBy` is the older spelling of the detail axis: the link is folded
    // into view=employee, which is why the press has somewhere to move from.
    expect(pairs(loc())).toEqual(sorted([...KEPT, 'view=employee']));

    await press('met6-cat-model');
    expect(pairs(loc())).toEqual(sorted([...KEPT, 'view=model']));
    expect(pressedFrom(VIEW_BUTTONS)).toEqual(['met6-cat-model']);
    expect(loc()).not.toContain('dsort');
    expect(loc()).not.toContain('ddir');
    // Nothing was reset, so the page does not claim a reset happened.
    expect(q('metS-reset-note')).toBeNull();
    expect(q('r119-nav')?.textContent).toBe('REPLACE');
    expect(window.history.length).toBe(historyBefore);

    await press('met6-cat-employee');
    expect(pairs(loc())).toEqual(sorted(KEPT));
    expect(loc()).not.toContain('view=');
    expect(pressedFrom(VIEW_BUTTONS)).toEqual(['met6-cat-employee']);
    expect(window.history.length).toBe(historyBefore);
  });

  it('resets the detail sort and says so once when the link carried one', async () => {
    await mount(`${LINK}&dsort=runs&ddir=asc`);
    expect(loc()).toContain('dsort=runs');

    await press('met6-cat-model');
    expect(pairs(loc())).toEqual(sorted([...KEPT, 'view=model']));
    expect(q('metS-reset-note')).not.toBeNull();
    expect(document.querySelectorAll('[data-testid="metS-reset-note"]')).toHaveLength(1);
    expect(text()).toContain('切换分组后，明细排序已回到默认的成本降序');
  });

  it('does nothing at all when the pressed view is already the active one', async () => {
    await mount('/metrics?window=7d&view=model');
    const before = urls();
    const search = loc();

    await press('met6-cat-model');
    expect(loc()).toBe(search);
    expect(urls()).toEqual(before);
  });
});

describe('R119 — an unusable enum value is disclosed, not swallowed', () => {
  const readable = (): void => {
    expect(q('met6-section')).not.toBeNull();
    expect(bodyRows()).toBeGreaterThan(0);
    expect(text()).not.toContain('undefined');
    expect(text()).not.toContain('NaN');
  };

  it('drops a bad view value and names it in the note', async () => {
    await mount('/metrics?view=__nope__');
    readable();

    const note = q('metAQ-url-note');
    expect(note).not.toBeNull();
    expect(note?.className).toContain('metAQ-note');
    expect(note?.textContent).toBe('已忽略无效参数 1 个');
    expect(note?.getAttribute('title')).toContain('view=__nope__');
    // The address never keeps a value the page did not honour.
    expect(loc()).not.toContain('__nope__');
    expect(urls().some((url) => url.includes('__nope__'))).toBe(false);
    // And it falls back to the readable default view, visibly pressed.
    expect(pressedFrom(VIEW_BUTTONS)).toEqual(['met6-cat-employee']);
    expect(headerFirstColumn()).toBe('员工');
  });

  it('drops a bad window value and keeps the default window', async () => {
    await mount('/metrics?window=__nope__');
    readable();

    const note = q('metAQ-url-note');
    expect(note?.textContent).toBe('已忽略无效参数 1 个');
    expect(note?.getAttribute('title')).toContain('window=__nope__');
    expect(loc()).not.toContain('__nope__');
    expect(urls().some((url) => url.includes('__nope__'))).toBe(false);
    expect(pressedFrom(WINDOW_BUTTONS)).toEqual(['met6-window-24h']);
    expect(urls()).toContain(statsReadOf('24h'));
  });

  it('says nothing when the link is one it can honour', async () => {
    await mount('/metrics?view=model&window=7d');
    expect(q('metAQ-url-note')).toBeNull();
    expect(text()).not.toContain('已忽略无效参数');
    expect(pressedFrom(VIEW_BUTTONS)).toEqual(['met6-cat-model']);
  });
});

describe('R119 — one mount reads one batch', () => {
  const ENTRY = '/metrics?window=7d&view=model';

  type Batch = {
    urls: string[];
    reads: Record<string, number>;
    rows: number;
    header: string;
    window: string[];
    view: string[];
  };

  const snapshot = (): Batch => ({
    urls: [...urls()],
    reads: perEndpoint(urls()),
    rows: bodyRows(),
    header: headerFirstColumn(),
    window: pressedFrom(WINDOW_BUTTONS),
    view: pressedFrom(VIEW_BUTTONS),
  });

  it('reads the same batch again on a fresh mount of the same link', async () => {
    await mount(ENTRY);
    const first = snapshot();

    await mount(ENTRY);
    const second = snapshot();

    // One link, one batch: the same requests, in the same order.
    expect(second.urls).toEqual(first.urls);
    expect(second.rows).toBe(first.rows);
    expect(second.header).toBe(first.header);
    expect(second.window).toEqual(['met6-window-7d']);
    expect(second.view).toEqual(['met6-cat-model']);

    // And per endpoint the second mount never doubles a read: the page asks
    // each family exactly as often as the first mount asked it.
    expect(Object.keys(second.reads).sort()).toEqual([
      '/agent-api/api/budget-usage',
      '/agent-api/api/employees',
      '/agent-api/api/hermes-usage',
      '/agent-api/api/models/pricing',
      '/agent-api/api/run-activity',
      '/agent-api/api/run-stats',
    ]);
    for (const path of Object.keys(first.reads)) {
      expect(second.reads[path]).toBe(first.reads[path]);
    }
    expect(second.reads['/agent-api/api/run-activity']).toBe(1);
  });

  it('backfills the same state at 1440, 1280 and 375 wide', async () => {
    const originalWidth = window.innerWidth;
    type Reading = { rows: number; header: string; pressed: string[]; urls: string[] };
    const readings: Reading[] = [];
    try {
      for (const width of [1440, 1280, 375]) {
        window.innerWidth = width;
        await mount(ENTRY);
        readings.push({
          rows: bodyRows(),
          header: headerFirstColumn(),
          pressed: [...pressedFrom(WINDOW_BUTTONS), ...pressedFrom(VIEW_BUTTONS)],
          urls: [...urls()].sort(),
        });
      }
    } finally {
      window.innerWidth = originalWidth;
    }
    const [wide, medium, narrow] = readings;
    expect(medium).toEqual(wide);
    expect(narrow).toEqual(wide);
    expect(wide.rows).toBe(3);
    expect(wide.header).toBe('模型');
    expect(wide.pressed).toEqual(['met6-window-7d', 'met6-cat-model']);
    expect(wide.urls).toContain(statsReadOf('7d'));
  });
});
