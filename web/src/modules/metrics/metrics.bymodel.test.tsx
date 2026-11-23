// @vitest-environment jsdom
/**
 * Q14 — 「按模型拆解」行为契约（tokens / 成本 / 成功率）。
 *
 * 这组测试钉住四条口径，不钉实现细节：
 * ① 成本只认账本实扣：顶层 `cost.source` 缺失或为 `cost_ledger` 时行内实扣键才采信；
 *    声明成别的来源（现网的 `est_model_ledger`）时，即便行里带钱也不升级为成本。
 * ② 成功率只认行内值：行内 `success_rate` 优先，其次 `succeeded/failed` 推导，
 *    两者皆缺就是 null —— 现网没有按模型成功率，整窗数值不会顶替它。
 * ③ 「未接」与真 0 是两件事：读不到的格子写「未接」，上游给的 0 原样是 0 / $0.00。
 * ④ 空窗口与读取失败各有自己的面孔：空不画空表、不报 0 条；失败只归这个区块，
 *    并留下可用的重试。
 *
 * 其它区块（热力、运行统计、账本、价目表）只拿安全桩，为的是不打扰它们的腿。
 */
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
import {
  COST_LEDGER_SOURCE,
  readModelBreakdown,
  sortModelBreakdown,
  type ModelBreakdownRow,
} from './metrics';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ---------------------------------------------------------------- 解析层

function breakdown(payload: unknown): Extract<ReturnType<typeof readModelBreakdown>, { kind: 'ok' }> {
  const parsed = readModelBreakdown(payload);
  if (parsed.kind !== 'ok') throw new Error(`readModelBreakdown 判成 invalid：${parsed.reason}`);
  return parsed;
}

/** 现网形制：来源声明是估算账本，行内既没有实扣键也没有成功率键。 */
const LIVE_PAYLOAD = {
  by_model: [
    { model: 'qwen3-max', input_tokens: 120_000, output_tokens: 30_000, api_calls: 42, sessions: 7 },
    { model: 'deepseek-v4', input_tokens: 5_000, output_tokens: 1_500, api_calls: 8, sessions: 3 },
  ],
  cost: { source: 'est_model_ledger', cost_usd: 12.34, rows: 2 },
  asOf: '2026-11-19T20:12:00.000Z',
};

describe('readModelBreakdown — 现网形制与账本门', () => {
  it('来源声明为估算时，成本与成功率都不编造，token／调用数／会话数照常读', () => {
    const parsed = breakdown(LIVE_PAYLOAD);

    expect(parsed.costSource).toBe('est_model_ledger');
    expect(parsed.rows).toHaveLength(2);
    for (const row of parsed.rows) {
      // 顶层估算金额与行内缺失都不能变成一行成本。
      expect(row.costUsd).toBeNull();
      // 现网没有按模型成功率：宁可为 null，也不拿整窗聚合顶替。
      expect(row.successRate).toBeNull();
    }
    const [first, second] = parsed.rows;
    expect(first?.inputTokens).toBe(120_000);
    expect(first?.outputTokens).toBe(30_000);
    expect(first?.tokenTotal).toBe(150_000);
    expect(first?.apiCalls).toBe(42);
    expect(first?.sessions).toBe(7);
    expect(second?.tokenTotal).toBe(6_500);
  });

  it('cost_ledger（或未声明来源）才采信实扣；行内成功率优先，其次按 succeeded/failed 推导', () => {
    const ledger = breakdown({
      by_model: [
        { model: 'inline-rate', input_tokens: 10, output_tokens: 1, actual_cost_usd: 0.5, success_rate: 0.985 },
        { model: 'derived-rate', input_tokens: 10, output_tokens: 1, cost_usd: 2, succeeded: 8, failed: 2 },
      ],
      cost: { source: COST_LEDGER_SOURCE },
    });
    expect(ledger.rows.map((row) => [row.costUsd, row.successRate])).toEqual([
      [0.5, 0.985],
      [2, 0.8],
    ]);

    // 没有 source 键同样按账本处理：来源未标注不等于来源不可信。
    const silent = breakdown({ by_model: [{ model: 'no-source', actual_cost_usd: 0.25 }] });
    expect(silent.costSource).toBeNull();
    expect(silent.rows[0]?.costUsd).toBe(0.25);

    // 行内值赢过推导值，两者都不给才是 null。
    const both = breakdown({
      by_model: [{ model: 'both', success_rate: 0.4, succeeded: 9, failed: 1 }],
    });
    expect(both.rows[0]?.successRate).toBe(0.4);
  });

  it('估算键、分母 0 与别的声明来源都不生产数字', () => {
    const gated = breakdown({
      by_model: [
        { model: 'estimate-only', estimated_cost_usd: 9.5, estimated_cost: 9.5 },
        { model: 'zero-denominator', succeeded: 0, failed: 0 },
        { model: 'half-known', succeeded: 3 },
      ],
      cost: { source: COST_LEDGER_SOURCE },
    });
    expect(gated.rows.map((row) => row.costUsd)).toEqual([null, null, null]);
    // 0 次成功 0 次失败不是 0% 也不是 100%，是「没有可比样本」。
    expect(gated.rows.map((row) => row.successRate)).toEqual([null, null, null]);

    // 来源声明为别的：即便行内带 actual_cost_usd 也不升级为成本。
    const declared = breakdown({
      by_model: [{ model: 'money-but-est', input_tokens: 1, actual_cost_usd: 9.5, success_rate: 0.5 }],
      cost: { source: 'est_model_ledger' },
    });
    expect(declared.rows[0]?.costUsd).toBeNull();
    // 成功率与成本来源无关：门只管钱。
    expect(declared.rows[0]?.successRate).toBe(0.5);
  });

  it('坏行跳过、坏容器给空表、非对象判 invalid', () => {
    const skipped = breakdown({
      by_model: [{ model: 42 }, { model: '   ' }, 'not-a-row', null, { model: 'good', input_tokens: 1 }],
    });
    expect(skipped.rows.map((row) => row.model)).toEqual(['good']);

    // 没有 by_model 是「这一窗没有模型行」，不是读取失败，也不是 0 条造假。
    const absent = breakdown({ cost: { source: COST_LEDGER_SOURCE } });
    expect(absent.rows).toEqual([]);
    const notArray = breakdown({ by_model: 'nope' });
    expect(notArray.rows).toEqual([]);

    for (const junk of [null, undefined, 'plain text', 7, []]) {
      const parsed = readModelBreakdown(junk);
      expect(parsed.kind).toBe('invalid');
    }
  });
});

function row(model: string, tokenTotal: number | null, costUsd: number | null): ModelBreakdownRow {
  return {
    model,
    inputTokens: tokenTotal,
    outputTokens: null,
    tokenTotal,
    apiCalls: null,
    sessions: null,
    costUsd,
    successRate: null,
  };
}

describe('sortModelBreakdown — 排序口径', () => {
  it('tokenTotal 领先，同分看账本成本，读不到的沉底，最后按模型名', () => {
    const input = [
      row('mid', 1_000, 0.1),
      row('cheap', 1_000, 0.9),
      row('no-numbers', null, null),
      row('big', 5_000, 0.01),
      row('also-none', null, null),
    ];

    expect(sortModelBreakdown(input).map((line) => line.model)).toEqual([
      'big',
      'cheap',
      'mid',
      'also-none',
      'no-numbers',
    ]);
    // 排的是副本：调用方拿到的顺序不会被就地改掉。
    expect(input.map((line) => line.model)).toEqual(['mid', 'cheap', 'no-numbers', 'big', 'also-none']);
  });
});

// ---------------------------------------------------------------- 渲染层

let root: Root | null = null;

const ACTIVITY = (() => {
  const cells: { dow: number; hour: number; count: number }[] = [];
  for (let dow = 1; dow <= 7; dow += 1) {
    for (let hour = 0; hour < 24; hour += 1) cells.push({ dow, hour, count: (dow + hour) % 3 });
  }
  return { cells, max: 2, from: '2026-11-12T16:00:00Z', to: '2026-11-19T15:59:59Z', tz: 'Asia/Shanghai' };
})();

const STATS = {
  from: '2026-11-18T16:00:00.000Z',
  to: '2026-11-19T16:00:00.000Z',
  bucket: 'hour',
  buckets: [],
  totals: { runs: 4, succeeded: 4, failed: 0, running: 0, sampleCount: 4, successRate: 1 },
};

/** hermes-usage 走被测分支，其余 URL 给别区的桩，按 URL 分发。 */
function byModelRouter(usage: (url: string) => Promise<unknown>) {
  return (url: string): Promise<unknown> => {
    if (url.includes('run-activity')) return Promise.resolve(ACTIVITY);
    if (url.includes('run-stats')) return Promise.resolve(STATS);
    if (url.includes('/api/employees')) return Promise.resolve({ items: [], nextCursor: null });
    if (url.includes('models/pricing')) return Promise.reject(new ApiError('missing', { status: 404, body: '', url }));
    if (url.includes('budget-usage')) return Promise.resolve({ items: [], missingEmployeeIds: [] });
    if (url.includes('hermes-usage')) return usage(url);
    return Promise.resolve({});
  };
}

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const face = (id: string): string | null => q(id)?.textContent?.trim() ?? null;
const urls = (): string[] => api.fetchJsonStrict.mock.calls.map((call) => String(call[0]));
const settled = (): boolean => document.querySelector('.met5-skeleton') === null;

async function waitFor(cond: () => boolean, label: string): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 4_000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

async function mount(usage: (url: string) => Promise<unknown>, entry = '/metrics'): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation((url: unknown) => byModelRouter(usage)(String(url)));
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
  await waitFor(settled, 'state settled');
}

async function press(id: string): Promise<void> {
  const button = q(id);
  if (button === null) throw new Error(`press: ${id} 不在页面上`);
  await act(async () => {
    (button as HTMLElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(settled, `${id} 之后落定`);
}

beforeEach(() => {
  window.history.replaceState({}, '', '/');
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
});

describe('按模型拆解表 — 格子口径', () => {
  it('一行全字段、一行四样缺：缺的写「未接」，有的按格式写，合计成功率恒「未接」', async () => {
    await mount(() =>
      Promise.resolve({
        by_model: [
          {
            model: 'alpha-one',
            input_tokens: 1_500,
            output_tokens: 500,
            api_calls: 12,
            sessions: 4,
            actual_cost_usd: 1.5,
            success_rate: 0.985,
          },
          { model: 'beta-two', input_tokens: 300, output_tokens: 100 },
        ],
        cost: { source: COST_LEDGER_SOURCE },
        asOf: '2026-11-19T20:12:00.000Z',
      }),
    );

    // tokenTotal 领先：2,000 的 alpha 排在 400 的 beta 前面。
    expect([...document.querySelectorAll('[data-testid^="metBM-row-"]')].map((node) => node.getAttribute('data-testid'))).toEqual([
      'metBM-row-alpha-one',
      'metBM-row-beta-two',
    ]);

    expect(face('metBM-tokIn-alpha-one')).toBe('1,500');
    expect(face('metBM-tokOut-alpha-one')).toBe('500');
    expect(face('metBM-tokTotal-alpha-one')).toBe('2,000');
    expect(face('metBM-calls-alpha-one')).toBe('12');
    expect(face('metBM-sessions-alpha-one')).toBe('4');
    expect(face('metBM-cost-alpha-one')).toBe('$1.50');
    expect(face('metBM-share-alpha-one')).toBe('100.0%');
    expect(face('metBM-rate-alpha-one')).toBe('98.5%');

    expect(face('metBM-tokTotal-beta-two')).toBe('400');
    expect(face('metBM-calls-beta-two')).toBe('未接');
    expect(face('metBM-sessions-beta-two')).toBe('未接');
    expect(face('metBM-cost-beta-two')).toBe('未接');
    expect(face('metBM-rate-beta-two')).toBe('未接');
    // 没有可读金额的一行不摊占比，也不写成 0%。
    expect(face('metBM-share-beta-two')).toBe('—');
    expect(face('metBM-row-beta-two')).not.toContain('0.0%');

    expect(face('metBM-total-tokTotal')).toBe('2,400');
    // 合计跳过错格：12 次调用来自 alpha 一行，beta 没有的那格不按 0 计。
    expect(face('metBM-total-calls')).toBe('12');
    expect(face('metBM-total-sessions')).toBe('4');
    expect(face('metBM-total-cost')).toBe('$1.50');
    expect(face('metBM-total-rate')).toBe('未接');
    expect(face('metBM-source')).toContain(COST_LEDGER_SOURCE);
  });

  it('上游给的 0 原样显示 0 与 $0.00，不写「未接」', async () => {
    await mount(() =>
      Promise.resolve({
        by_model: [
          {
            model: 'idle-model',
            input_tokens: 0,
            output_tokens: 0,
            api_calls: 0,
            sessions: 0,
            succeeded: 0,
            failed: 0,
            actual_cost_usd: 0,
          },
        ],
        cost: { source: COST_LEDGER_SOURCE },
      }),
    );

    expect(face('metBM-tokIn-idle-model')).toBe('0');
    expect(face('metBM-tokTotal-idle-model')).toBe('0');
    expect(face('metBM-calls-idle-model')).toBe('0');
    expect(face('metBM-sessions-idle-model')).toBe('0');
    expect(face('metBM-cost-idle-model')).toBe('$0.00');
    // 0 成 0 败仍是「没有可比样本」，不是 0%。
    expect(face('metBM-rate-idle-model')).toBe('未接');
    expect(face('metBM-total-calls')).toBe('0');
    expect(face('metBM-total-tokTotal')).toBe('0');
    expect(face('metBM-total-cost')).toBe('$0.00');
  });

  it('现网估算来源：整列成本保持「未接」，并说明声明的来源不是账本', async () => {
    await mount(() => Promise.resolve(LIVE_PAYLOAD));

    expect(q('metBM-table')).not.toBeNull();
    expect(face('metBM-cost-qwen3-max')).toBe('未接');
    expect(face('metBM-rate-qwen3-max')).toBe('未接');
    expect(face('metBM-total-cost')).toBe('未接');
    const title = q('metBM-cost-qwen3-max')?.getAttribute('title') ?? '';
    expect(title).toContain('est_model_ledger');
    expect(title).toContain(COST_LEDGER_SOURCE);
    // 估算金额绝不借道进这一列。
    expect(face('metBM-by-model')).not.toContain('$12.34');
  });

  it('空 rows 只说没有记录：不画空表、不报 0 条、不写 $0.00', async () => {
    await mount(() => Promise.resolve({ by_model: [], cost: { source: COST_LEDGER_SOURCE } }));

    expect(q('metBM-empty')).not.toBeNull();
    expect(q('metBM-table')).toBeNull();
    expect(q('metBM-total-row')).toBeNull();
    expect(face('metBM-empty')).toContain('这个窗口没有按模型的用量记录');
    expect(face('metBM-empty')).not.toContain('$0.00');
  });

  it('读取失败：这个区块自己认错并给出可用的重试，别的区块不受牵连', async () => {
    // 同一个 URL 也喂给成本占比那条腿，所以失败按「批次」开关，不按调用次数：
    // 第一整个批次都回 503，放行后每一次读取都成功。
    let failing = true;
    const usageCalls = (): number => urls().filter((url) => url.includes('hermes-usage')).length;
    await mount(() =>
      failing
        ? Promise.reject(
            new ApiError('数据服务暂时没有响应，请稍后重试。', {
              status: 503,
              body: '',
              url: '/agent-api/api/hermes-usage',
              requestId: 'req-bm-1',
            }),
          )
        : Promise.resolve({
            by_model: [{ model: 'late-model', input_tokens: 10, output_tokens: 5 }],
            cost: { source: COST_LEDGER_SOURCE },
          }),
    );

    expect(q('metBM-error')).not.toBeNull();
    expect(face('metBM-error')).toContain('暂时读不到');
    expect(q('metBM-table')).toBeNull();
    expect(q('metBM-empty')).toBeNull();
    expect(face('metBM-error')).not.toContain('503');
    // 一次失败只归这一个区块：整页与运行统计不受牵连。
    expect(q('met5-page')).not.toBeNull();
    expect(q('met6-section')).not.toBeNull();

    const firstBatch = usageCalls();
    expect(firstBatch).toBeGreaterThan(0);
    failing = false;
    await press('metBM-retry');
    await waitFor(() => q('metBM-row-late-model') !== null, 'retry 之后有行');
    expect(usageCalls()).toBeGreaterThan(firstBatch);
  });

  it('上游把页面当数据回：仍是这个区块「暂时读不到」，不是空窗口', async () => {
    await mount(() => Promise.resolve('<!doctype html><html><body>控制台</body></html>'));

    expect(q('metBM-error')).not.toBeNull();
    expect(face('metBM-error')).toContain('暂时读不到');
    expect(q('metBM-empty')).toBeNull();
    expect(q('metBM-table')).toBeNull();
  });

  it('时间窗改的是这个读取的 days，其余区块照旧', async () => {
    await mount(() => Promise.resolve({ by_model: [], cost: { source: COST_LEDGER_SOURCE } }));
    expect(urls().some((url) => url === '/agent-api/api/hermes-usage?days=1')).toBe(true);

    await press('met6-window-7d');
    await waitFor(() => urls().some((url) => url === '/agent-api/api/hermes-usage?days=7'), 'days=7 请求');

    await press('met6-window-30d');
    await waitFor(() => urls().some((url) => url === '/agent-api/api/hermes-usage?days=30'), 'days=30 请求');
  });
});
