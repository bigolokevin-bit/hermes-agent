// @vitest-environment jsdom
// MT-02 — 分摊分组的「按供应商」维：只能禁着，不能猜。
//
// 现网 /agent-api/api/hermes-usage 的 by_model 行没有 provider 字段，BFF 也没有
// 模型→供应商映射读口（GAP-MET6-01）。所以这一维的正确形态是一个 disabled 钮加
// 一句原因，DOM 里绝不许出现任何编造的供应商份额行/百分比。夹具故意把模型名换成
// qwen-plus / gpt-4o / deepseek-v4 这种来自三家供应商的前缀，钉住「禁拿模型名前缀
// 猜供应商」这条线：前缀猜得出三组，页面一组都不许画。
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
vi.mock('@/modules/models/fetchJson', () => ({ fetchJsonStrict: api.fetchJsonStrict }));

import { MetricsModulePage } from './MetricsModulePage';
import { USAGE_GAP } from './metrics';

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
    root?.render(<MemoryRouter initialEntries={[entry]}>{page}</MemoryRouter>);
  });
}

const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const text = (): string => document.body.textContent ?? '';
const urls = (): string[] => api.fetchJsonStrict.mock.calls.map((call) => String(call[0]));
const settled = (): boolean => document.querySelector('.met5-skeleton') === null;
const loc = (): string => q('met02-loc')?.textContent ?? '';
/** 地址里的分组维与明细视图维：禁钮一下，这两项都不许动。 */
const paramOf = (search: string, key: string): string | null =>
  new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get(key);
const callsTo = (fragment: string): number => urls().filter((url) => url.includes(fragment)).length;

/**
 * 「没有偷发请求」要有可信的基线：整页有多个后台读口（对比、快照…）会陆续落位，
 * 所以计数只在请求量连续多轮不变之后才取。它等的是请求排空，不是挂钟。
 */
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

function LocationProbe(): ReactNode {
  const location = useLocation();
  return <p data-testid="met02-loc">{location.search}</p>;
}

async function mount(entry = '/metrics'): Promise<void> {
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation(handler);
  await render(
    entry,
    <>
      <MetricsModulePage />
      <LocationProbe />
    </>,
  );
  await waitFor(settled, 'state settled');
  await drain();
}

/** 原生 click：本仓没有 @testing-library/react，也没有 jest-dom，事件用 DOM 形制发。 */
async function press(id: string): Promise<void> {
  const button = q(id) as HTMLButtonElement | null;
  if (button === null) throw new Error(`press: control ${id} is missing`);
  await act(async () => {
    button.click();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 15));
  });
}

const DAY = '2026-11-19';

// 三个模型来自三家不同供应商，前缀一眼能分组——这正是本卡禁止的做法。
// by_model 行没有 provider 字段：与现网字节形制一致，不为了测试补一个假字段。
const PROVIDER_MIXED_USAGE = {
  by_model: [
    { model: 'qwen-plus', sessions: 30, api_calls: 40, actual_cost_usd: 3 },
    { model: 'gpt-4o', sessions: 10, api_calls: 12, actual_cost_usd: 1 },
    { model: 'deepseek-v4', sessions: 5, api_calls: 6, actual_cost_usd: 0.5 },
  ],
  asOf: `${DAY}T20:12:00.000Z`,
};

const EMPLOYEES = {
  items: [
    { employeeId: 'emp_aaaabbbbcccc', name: '小鲤' },
    { employeeId: 'emp_ddddeeeeffff', name: '小满' },
  ],
  nextCursor: null,
};

const LEDGER_DAY = {
  items: [
    { employeeId: 'emp_aaaabbbbcccc', period: DAY, periodKind: 'day', costUsd: 0.4, updatedAt: `${DAY}T03:20:00.000Z` },
    { employeeId: 'emp_ddddeeeeffff', period: DAY, periodKind: 'day', costUsd: 0.1, updatedAt: `${DAY}T04:00:00.000Z` },
  ],
  missingEmployeeIds: [],
};

const LEDGER_MONTH = {
  items: [
    { employeeId: 'emp_aaaabbbbcccc', period: '2026-11', periodKind: 'month', costUsd: 0.4, updatedAt: `${DAY}T03:20:00.000Z` },
    { employeeId: 'emp_ddddeeeeffff', period: '2026-11', periodKind: 'month', costUsd: 0.1, updatedAt: `${DAY}T04:00:00.000Z` },
  ],
  missingEmployeeIds: [],
};

function handler(url: string): Promise<unknown> {
  const at = new URL(url, 'http://local');
  if (url.includes('run-activity')) {
    return Promise.resolve({ cells: [], max: null, from: '2026-11-12T16:00:00Z', to: '2026-11-19T15:59:59Z', tz: 'Asia/Shanghai' });
  }
  if (url.includes('run-stats')) {
    return Promise.resolve({
      from: at.searchParams.get('from'),
      to: at.searchParams.get('to'),
      bucket: at.searchParams.get('bucket') ?? 'hour',
      buckets: [],
      totals: { runs: 5, succeeded: 5, failed: 0, running: 0, sampleCount: 5, successRate: 1 },
    });
  }
  if (url.includes('/api/employees')) return Promise.resolve(EMPLOYEES);
  // 单价读口未接入：份额行照常出现，金额走「—」，与供应商维无关。
  if (url.includes('models/pricing')) return Promise.reject(new ApiError('missing', { status: 404, body: '', url }));
  if (url.includes('hermes-usage')) return Promise.resolve(PROVIDER_MIXED_USAGE);
  if (url.includes('periodKind=month')) return Promise.resolve(LEDGER_MONTH);
  if (url.includes('periodKind=day')) return Promise.resolve(LEDGER_DAY);
  return Promise.resolve({ items: [] });
}

// ---- 判据 ------------------------------------------------------------------

/** 分摊份额行的 testid 全集：model 态 met7-row-*，employee 态 met8-row-*。 */
const shareRowIds = (): string[] =>
  [...document.querySelectorAll('[data-testid^="met7-row-"], [data-testid^="met8-row-"]')]
    .map((node) => node.getAttribute('data-testid') ?? '')
    .sort();
/** 占比格子的 testid 全集：份额只能有这几格，多一格就是编出来的。 */
const shareCellIds = (): string[] =>
  [...document.querySelectorAll('[data-testid^="met7-share-"], [data-testid^="met8-share-"]')]
    .map((node) => node.getAttribute('data-testid') ?? '')
    .sort();

/**
 * 「按供应商」这句话写在哪些元素自己身上：只看看这个串的文本节点的父元素。
 * 结果只剩禁用钮一个 = 份额表行、表头、合计、说明里都没有这一维。
 * title 是属性，不进文本节点，所以那句原因不会被算成第二处声明。
 */
const providerMentions = (): HTMLElement[] => {
  const hits: HTMLElement[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (!(node.nodeValue ?? '').includes('按供应商')) continue;
    const owner = node.parentElement;
    if (owner !== null && !hits.includes(owner)) hits.push(owner);
  }
  return hits;
};

beforeEach(() => {
  window.history.replaceState({}, '', '/');
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

describe('MT-02 — the by-provider group button is an honest gap, not a guess', () => {
  it('shows the by-provider button disabled and names the missing mapping in its title', async () => {
    await mount();

    const button = q('met8-view-provider') as HTMLButtonElement | null;
    expect(button).toBeTruthy();
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button?.getAttribute('aria-disabled')).toBe('true');
    // 禁钮不冒充已选中的分组：按下态只属于 model / employee 两态。
    expect(button?.getAttribute('aria-pressed')).not.toBe('true');
    expect(button?.getAttribute('title')).toBe(`按供应商拆分未接入：缺模型→供应商映射读口（${USAGE_GAP}）`);
    expect(button?.getAttribute('title')).toContain('按供应商拆分未接入');
    expect(button?.getAttribute('title')).toContain('缺模型→供应商映射读口');
    expect(button?.getAttribute('title')).toContain('GAP-MET6-01');
    // 屏上只说没接入，不报份额，也不把内部编号读成正文。
    expect(text()).not.toContain('GAP-');
  });

  it('pressing the by-provider button changes no state, no address, and asks for no bytes', async () => {
    await mount();

    const before = urls().length;
    const beforeUsage = callsTo('hermes-usage');
    const beforeEmployees = callsTo('/api/employees');
    const search = loc();
    expect(paramOf(search, 'groupBy')).toBeNull();
    expect(paramOf(search, 'view')).toBeNull();

    await press('met8-view-provider');

    // 状态没走：地址一个字节没动，两态钮的按下态原样。
    expect(loc()).toBe(search);
    expect(paramOf(loc(), 'groupBy')).toBeNull();
    expect(q('met8-view-model')?.getAttribute('aria-pressed')).toBe('true');
    expect(q('met8-view-employee')?.getAttribute('aria-pressed')).toBe('false');
    // 点它一次读取都没多发动，包括「模型→供应商映射」这个根本不存在的读口。
    expect(urls().length).toBe(before);
    expect(callsTo('hermes-usage')).toBe(beforeUsage);
    expect(callsTo('/api/employees')).toBe(beforeEmployees);
    expect(callsTo('provider')).toBe(0);

    // 同组两钮照常可用：切到按员工，地址与请求都真的跟着走。
    await press('met8-view-employee');
    await waitFor(() => q('met8-view-employee')?.getAttribute('aria-pressed') === 'true', 'employee group');
    expect(paramOf(loc(), 'groupBy')).toBe('employee');
    expect(callsTo('/api/employees')).toBeGreaterThan(beforeEmployees);

    const switched = loc();
    // 先把分组切换自己带起来的读取排空，再验禁钮不发动任何读取。
    await drain();
    const afterSwitch = urls().length;
    await press('met8-view-provider');
    expect(loc()).toBe(switched);
    expect(paramOf(loc(), 'groupBy')).toBe('employee');
    expect(urls().length).toBe(afterSwitch);
  });

  it('renders zero provider share rows even when model names hint at three vendors', async () => {
    await mount();

    // 夹具确实到位：三行模型份额，占比列只有这三格。
    await waitFor(() => shareRowIds().length === 3, 'model share rows');
    expect(shareRowIds()).toEqual(['met7-row-deepseek-v4', 'met7-row-gpt-4o', 'met7-row-qwen-plus']);
    expect(shareCellIds()).toEqual(['met7-share-deepseek-v4', 'met7-share-gpt-4o', 'met7-share-qwen-plus']);

    // 「按供应商」只长在禁用钮身上：份额表、表头、合计、说明里一处都没有。
    const mentions = providerMentions();
    expect(mentions).toHaveLength(1);
    expect(mentions[0]?.getAttribute('data-testid')).toBe('met8-view-provider');
    expect(mentions[0]?.closest('[role="group"][aria-label="分摊视图"]')).toBeTruthy();

    // 前缀猜出来的供应商名，一个也不许成为行、格子或任何 testid。
    for (const guessed of ['alibaba', 'openai', 'azure', 'dashscope', 'qwen-cloud', 'deepseek-ai', 'vendor']) {
      expect(document.querySelector(`[data-testid*="${guessed}"]`)).toBeNull();
      expect(text().toLowerCase()).not.toContain(guessed);
    }

    // 切到按员工态：分组换了，供应商维仍然一行都没有。
    await press('met8-view-employee');
    await waitFor(() => shareRowIds().some((id) => id.startsWith('met8-row-')), 'employee share rows');
    expect(shareRowIds().every((id) => id.startsWith('met8-row-'))).toBe(true);
    expect(shareRowIds()).toHaveLength(2);
    expect(document.querySelectorAll('[data-testid^="met7-row-"]')).toHaveLength(0);
    const afterSwitch = providerMentions();
    expect(afterSwitch).toHaveLength(1);
    expect(afterSwitch[0]?.getAttribute('data-testid')).toBe('met8-view-provider');
    for (const guessed of ['alibaba', 'openai', 'azure', 'dashscope', 'vendor']) {
      expect(document.querySelector(`[data-testid*="${guessed}"]`)).toBeNull();
      expect(text().toLowerCase()).not.toContain(guessed);
    }
  });
});
