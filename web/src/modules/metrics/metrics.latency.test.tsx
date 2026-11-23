// @vitest-environment jsdom
// MT-03 — p95/p50 latency honesty. Two things are pinned here:
//   1. the parser reads run-stats' p95DurationMs instead of dropping it, and a
//      missing / malformed / zero value keeps its distinct meaning;
//   2. the window-comparison table shows a «P95 时长» column that never invents
//      a percentile: under 20 samples it says so, with no source at all it shows
//      «—», and P50 is declared unwired rather than silently absent.
// Naming note: the file is .tsx although it holds one pure-parser group too —
// the component group needs JSX-free createElement either way, and keeping both
// in one file is what the task asked for.
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn((text: string) => Promise.resolve(Boolean(text))) }));
vi.mock('@/modules/models/fetchJson', () => ({ fetchJsonStrict: api.fetchJsonStrict }));
vi.mock('@/lib/clipboard', () => ({ copyTextToClipboard: clip.copyTextToClipboard }));

import { MetricsModulePage } from './MetricsModulePage';
import { readRunStats } from './metrics';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ---- 1. the parser ----------------------------------------------------------

const statsOf = (payload: unknown) => {
  const parsed = readRunStats(payload);
  if (parsed.kind !== 'ok') throw new Error(`readRunStats rejected the body: ${parsed.reason}`);
  return parsed.stats.totals;
};

describe('readRunStats — p95DurationMs', () => {
  it('reads the percentile the contract returns', () => {
    expect(
      statsOf({
        totals: {
          runs: 12,
          succeeded: 12,
          failed: 0,
          running: 0,
          sampleCount: 40,
          successRate: 1,
          p95DurationMs: 850,
        },
      }).p95DurationMs,
    ).toBe(850);
  });

  it('keeps an omitted percentile null (the contract drops it under 20 samples)', () => {
    const totals = statsOf({ totals: { runs: 4, succeeded: 4, failed: 0, running: 0, sampleCount: 4, successRate: 1 } });
    expect(totals.p95DurationMs).toBeNull();
    expect(totals.sampleCount).toBe(4);
  });

  it('treats a non-number percentile as absent, never as a guess', () => {
    expect(statsOf({ totals: { p95DurationMs: '850' } }).p95DurationMs).toBeNull();
    expect(statsOf({ totals: { p95DurationMs: null } }).p95DurationMs).toBeNull();
  });

  it('keeps a real 0 as 0 — a fast window is not a missing one', () => {
    const totals = statsOf({ totals: { sampleCount: 40, p95DurationMs: 0 } });
    expect(totals.p95DurationMs).toBe(0);
  });
});

// ---- 2. the window-comparison table ----------------------------------------

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

const text = (): string => document.body.textContent ?? '';
const cell = (id: string): HTMLElement | null => document.querySelector(`[data-testid="met6-cmp-p95-${id}"]`);
const cmpReady = (): boolean => document.querySelector('[data-testid="met6-cmp-p95-24h"]') !== null;

/** totals carries the percentile only when the fixture should have one. */
function statsBody(totals: Record<string, unknown>): unknown {
  return {
    from: '2026-11-18T16:00:00.000Z',
    to: '2026-11-19T16:00:00.000Z',
    bucket: 'day',
    buckets: [],
    totals: { runs: 12, succeeded: 12, failed: 0, running: 0, successRate: 1, ...totals },
  };
}

async function mountStats(totals: Record<string, unknown>): Promise<void> {
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation((url: unknown) => {
    const href = String(url);
    if (href.includes('run-activity')) {
      return Promise.resolve({ cells: [], max: null, from: null, to: null, tz: 'Asia/Shanghai' });
    }
    if (href.includes('run-stats')) return Promise.resolve(statsBody(totals));
    if (href.includes('/api/employees')) return Promise.resolve({ items: [], nextCursor: null });
    if (href.includes('budget-usage')) return Promise.resolve({ items: [], missingEmployeeIds: [] });
    return Promise.resolve({});
  });
  await render('/metrics', createElement(MetricsModulePage));
  await waitFor(cmpReady, 'window comparison table');
}

beforeEach(() => {
  window.history.replaceState({}, '', '/');
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

describe('MetricsModulePage — P95 时长 column (MT-03)', () => {
  it('shows the returned percentile in its own column', async () => {
    await mountStats({ sampleCount: 40, p95DurationMs: 850 });
    expect(cell('24h')?.textContent).toBe('850ms');
    expect(cell('7d')?.textContent).toBe('850ms');
    expect(cell('30d')?.textContent).toBe('850ms');
    expect(text()).toContain('P95 时长');
  });

  it('says the sample is too small instead of showing a dash', async () => {
    await mountStats({ sampleCount: 15 });
    expect(cell('24h')?.textContent).toBe('样本不足（15/20）');
  });

  it('shows «—» when the source returned neither a percentile nor a sample count', async () => {
    await mountStats({});
    expect(cell('24h')?.textContent).toBe('—');
  });

  it('shows a real 0 as 0ms, not as a missing value', async () => {
    await mountStats({ sampleCount: 40, p95DurationMs: 0 });
    expect(cell('24h')?.textContent).toBe('0ms');
  });

  it('declares P50 unwired, and that is the only P50 on screen', async () => {
    await mountStats({ sampleCount: 40, p95DurationMs: 850 });
    const note = document.querySelector('[data-testid="met6-cmp-p50-note"]');
    expect(note?.textContent).toContain('P50');
    expect(note?.textContent).toContain('未接');
    // 屏上可见文案禁出现 GAP 编号（met6 文案合同），编号只进 title tooltip——与 MT-01 同形制。
    expect(note?.getAttribute('title') ?? '').toContain('GAP-MET5-01');
    expect(text().split('P50').length - 1).toBe(1);
  });

  it('never invents the current percentile from the previous window', async () => {
    await mountStats({ sampleCount: 15 });
    expect(cell('24h')?.getAttribute('title')).toBe('上窗口 P95：样本不足（15/20）');
  });
});
