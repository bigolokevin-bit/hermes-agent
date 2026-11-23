// @vitest-environment jsdom
/**
 * MT-01 — 价目读口诚实化（前端半边）。
 *
 * ① The pricing card owns its own sentence: an unwired price source
 *    (404/503 carrying models.pricing_not_wired, or the old unwired-route
 *    shape console.unknown_route) says 标价未接, never a bare HTTP status, and
 *    keeps the GAP-MET6-01 title and the «—» collection time.
 * ② When the price list IS ready, the model detail table grows a read-only
 *    标价 column matched by model id; a model without an input price prints
 *    «—». The money columns are provably untouched: every 支出 cell, and the
 *    footer total, is byte-equal whether pricing read or failed — the page
 *    never multiplies 标价 by usage.
 * ③ An empty ready list adds no column and keeps the 价目表为空 card state.
 * ④ Sentinel: the other legs (stats here) keep the shared blockFailure
 *    sentence untouched — this card only reworded pricing.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));
vi.mock('@/modules/models/fetchJson', () => ({ fetchJsonStrict: api.fetchJsonStrict }));
vi.mock('@/lib/clipboard', () => ({ copyTextToClipboard: clip.copyTextToClipboard }));

import { MetricsModulePage } from './MetricsModulePage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

function q(id: string): Element | null {
  return document.querySelector(`[data-testid="${id}"]`);
}

function text(id: string): string {
  return q(id)?.textContent?.trim() ?? '';
}

async function waitFor(cond: () => boolean, label = 'condition'): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

// ---- canned bodies -----------------------------------------------------------

const ACTIVITY = { cells: [], max: null, from: '2026-11-12T16:00:00Z', to: '2026-11-19T15:59:59Z', tz: 'Asia/Shanghai' };
const STATS = {
  from: '2026-11-18T16:00:00.000Z',
  to: '2026-11-19T15:59:59.000Z',
  bucket: 'hour',
  buckets: [],
  totals: { runs: 0, succeeded: 0, failed: 0, running: 0, sampleCount: 0, successRate: null },
};
const EMPLOYEES = { items: [], nextCursor: null };
const LEDGER = { items: [], missingEmployeeIds: [] };
const HERMES_USAGE = {
  by_model: [
    { model: 'alpha', input_tokens: 1000, output_tokens: 200, api_calls: 9 },
    { model: 'gpt-4o-mini', input_tokens: 500, output_tokens: 50, api_calls: 2 },
  ],
  asOf: '2026-11-19T20:12:00.000Z',
};

const NOT_WIRED_BODY = JSON.stringify({
  code: 'models.pricing_not_wired',
  message: '上游无可用价目端点：Bisheng(7860) /api/models/pricing 实测 404。',
  asOf: '2026-11-19T20:12:00.000Z',
  rid: 'req-mt01-upstream',
});
const UNKNOWN_ROUTE_BODY = JSON.stringify({ code: 'console.unknown_route', message: 'no such route' });

/** 标价就绪：alpha 有输入单价，gpt-4o-mini 缺 inputPerMillion。 */
const PRICING_OK = {
  prices: [
    { modelId: 'alpha', label: 'Alpha', inputPerMillion: 15, outputPerMillion: 60, currency: 'USD' },
    { modelId: 'gpt-4o-mini', label: 'GPT-4o-mini', inputPerMillion: null, outputPerMillion: null, currency: 'USD' },
  ],
  asOf: '2026-11-19T20:12:00.000Z',
};

type PricingAnswer = () => Promise<unknown>;

const pricingDown =
  (status: number, body: string): PricingAnswer =>
  () =>
    Promise.reject(
      new ApiError('not wired', { status, body, url: '/api/models/pricing', requestId: 'req-mt01-price' }),
    );

function router(pricing: PricingAnswer, stats?: PricingAnswer) {
  return (url: string): Promise<unknown> => {
    if (url.includes('run-activity')) return Promise.resolve(ACTIVITY);
    if (url.includes('run-stats')) return stats ? stats() : Promise.resolve(STATS);
    if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEES);
    if (url.includes('models/pricing')) return pricing();
    if (url.includes('hermes-usage')) return Promise.resolve(HERMES_USAGE);
    if (url.includes('budget-usage')) return Promise.resolve(LEDGER);
    return Promise.resolve({});
  };
}

async function mount(handler: (url: string) => Promise<unknown>, entry = '/metrics'): Promise<void> {
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
    root?.render(<MemoryRouter initialEntries={[entry]}><MetricsModulePage /></MemoryRouter>);
  });
  await waitFor(() => document.querySelector('.met5-skeleton') === null, 'state settled');
}

/** The 明细 table row whose 模型 cell says `name`. */
function detailRow(name: string): Element | null {
  return (
    [...document.querySelectorAll('[data-testid^="met6-row-"]')].find(
      (row) => row.querySelector('.met6-rowname')?.textContent === name,
    ) ?? null
  );
}

function cellOf(name: string, index: number): string {
  const cells = detailRow(name)?.querySelectorAll('td');
  return cells && cells.length > index ? (cells[index]?.textContent ?? '').trim() : '<<missing>>';
}

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

describe('MT-01 — 价目读口诚实化', () => {
  it('names 标价未接 on 404 models.pricing_not_wired, with no bare status and GAP title', async () => {
    await mount(router(pricingDown(404, NOT_WIRED_BODY)));

    const gap = text('met6-price-gap');
    expect(gap).toContain('标价未接：上游价目数据源还没有接入（models.pricing_not_wired）。');
    expect(q('met6-price-gap')?.getAttribute('title')).toBe('GAP-MET6-01');
    expect(q('met6-price')?.textContent).not.toContain('404');
    expect(q('metD-gap-rid-price')).not.toBeNull();
    // 采集时刻：不是就绪态就显「—」。
    expect(text('met6-price-source')).toContain('截至 —');
  });

  it('maps the old unwired-route shape console.unknown_route onto the same sentence', async () => {
    await mount(router(pricingDown(404, UNKNOWN_ROUTE_BODY)));

    expect(text('met6-price-gap')).toContain('标价未接：上游价目数据源还没有接入（models.pricing_not_wired）。');
    expect(q('met6-price-gap')?.getAttribute('title')).toBe('GAP-MET6-01');
  });

  it('treats 503 with the not-wired code the same way', async () => {
    await mount(router(pricingDown(503, NOT_WIRED_BODY)));

    expect(text('met6-price-gap')).toContain('标价未接：上游价目数据源还没有接入（models.pricing_not_wired）。');
  });

  it('adds a read-only 标价 column in the model view and keeps money cells byte-equal', async () => {
    // Baseline: pricing failed — no price column; record the money cells.
    await mount(router(pricingDown(404, NOT_WIRED_BODY)), '/metrics?view=model');
    expect(q('metO-fmt-th-price')).toBeNull();
    const costsDown = ['alpha', 'gpt-4o-mini'].map((name) => cellOf(name, 1));
    const totalDown = text('metT-detail-total-cost');
    expect(costsDown.length).toBe(2);

    // Same page with the price list ready: the column appears, money never moves.
    await mount(router(() => Promise.resolve(PRICING_OK)), '/metrics?view=model');
    expect(text('metO-fmt-th-price')).toContain('标价（美元/百万token）');
    const costsReady = ['alpha', 'gpt-4o-mini'].map((name) => cellOf(name, 1));
    expect(costsReady).toEqual(costsDown);
    expect(text('metT-detail-total-cost')).toBe(totalDown);

    // 标价按模型名匹配：命中显单价，缺 inputPerMillion 显「—」；合计格显「—」。
    expect(cellOf('alpha', 4)).toBe('$15.00 / 百万 token');
    expect(cellOf('gpt-4o-mini', 4)).toBe('—');
    expect(text('metT-detail-total-price')).toBe('—');
  });

  it('adds no column and keeps the empty-list card state when the price list is ready but empty', async () => {
    await mount(router(() => Promise.resolve({ prices: [], asOf: '2026-11-19T20:12:00.000Z' })), '/metrics?view=model');

    expect(q('metO-fmt-th-price')).toBeNull();
    expect(text('met6-price-value')).toBe('价目表为空');
    expect(q('metH-card-error-price')).toBeNull();
  });

  it('leaves the other legs on the untouched blockFailure sentence', async () => {
    const statsDown: PricingAnswer = () =>
      Promise.reject(new ApiError('denied', { status: 404, body: '', url: '/api/run-stats', requestId: 'req-mt01-stats' }));
    await mount(router(pricingDown(404, NOT_WIRED_BODY), statsDown));

    expect(text('met6-runs-gap')).toContain('这项数据当前读不到：可能还没有接入，也可能当前账号没有查看权限。');
    // The pricing leg next to it uses its own sentence — no drift in either direction.
    expect(text('met6-price-gap')).toContain('标价未接');
  });
});
