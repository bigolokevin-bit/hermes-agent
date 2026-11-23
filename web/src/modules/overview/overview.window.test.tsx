// @vitest-environment jsdom
// OM-04：?range= 四档窗口深链、趋势标题随窗、切窗只重读时间敏感腿、
// 活动腿在总览不请求（不渲染则不请求）。
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OverviewPage, OverviewView } from './OverviewPage';
import type { DutyData } from '../duty/useDutyData';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let urls: string[];

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  urls = [];
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render(node: ReactNode, path = '/overview') {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>);
  });
  await act(async () => {});
}

/** 记录所有请求 URL，并按端点回一个最小可读形状（形状缺失只落错误态，不编数）。 */
function stubFetch() {
  const jsonFor = (url: string): unknown => {
    if (url.includes('/employees')) return { items: [{ employeeId: 'emp_1', name: '甲', lifecycleState: 'active' }] };
    if (url.includes('/employee-stats')) return { total: 1, byLifecycle: { draft: 0, active: 1, paused: 0, offboarding: 0 } };
    if (url.includes('/workbench/summary')) return { kpis: [], asOf: '2026-11-23T12:00:00Z' };
    if (url.includes('/workbench/timeseries')) {
      return {
        asOf: '2026-11-23T12:00:00Z',
        points: Array.from({ length: 30 }, (_, i) => ({
          ts: `2026-11-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
          value: i % 5 === 0 ? null : i,
        })),
      };
    }
    if (url.includes('/workbench/queue')) return { items: [], total: 0 };
    return {};
  };
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => jsonFor(url),
      text: async () => JSON.stringify(jsonFor(url)),
    } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const count = (needle: string) => urls.filter((u) => u.includes(needle)).length;

describe('OM-04 ?range= 深链与标题随窗', () => {
  it('?range=7d：趋势标题为「近 7 天」，卡内无「近 14 天」，且不请求活动腿', async () => {
    stubFetch();
    await render(<OverviewPage />, '/overview?range=7d');
    const trend = container.querySelector('[data-testid="ov6-trend"]')?.textContent ?? '';
    expect(trend).toContain('近 7 天运行趋势');
    expect(trend).not.toContain('近 14 天');
    expect(container.querySelector('[data-testid="ov6-range-7d"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(count('/workbench/timeseries')).toBe(1);
    expect(urls[urls.findIndex((u) => u.includes('/workbench/timeseries'))]).toContain('range=7d');
    // 总览没有热力卡可渲染 → 活动腿一次都不读（OM-04④「不请求」裁定）。
    expect(count('/run-activity')).toBe(0);
  });

  it('切窗只重读时间敏感腿：14d→30d 仅新增 timeseries 请求，无活动腿请求', async () => {
    stubFetch();
    await render(<OverviewPage />, '/overview');
    expect(container.querySelector('[data-testid="ov6-trend"]')?.textContent).toContain('近 14 天运行趋势');
    const before = urls.length;
    const btn = container.querySelector('[data-testid="ov6-range-30d"]') as HTMLButtonElement;
    await act(async () => {
      btn.click();
    });
    await act(async () => {});
    const added = urls.slice(before);
    expect(added.some((u) => u.includes('/workbench/timeseries') && u.includes('range=30d'))).toBe(true);
    expect(added.filter((u) => u.includes('/run-activity'))).toHaveLength(0);
    expect(added.filter((u) => u.includes('/employees')).length).toBe(0);
    expect(container.querySelector('[data-testid="ov6-trend"]')?.textContent).toContain('近 30 天运行趋势');
  });

  it.each([
    ['24h', '1d'],
    ['7d', '7d'],
    ['14d', '30d'],
    ['30d', '30d'],
  ] as const)('四档深链 ?range=%s 可用（读腿参数 range=%s，档位钮按下）', async (id, tsRange) => {
    stubFetch();
    await render(<OverviewPage />, `/overview?range=${id}`);
    expect(container.querySelector(`[data-testid="ov6-range-${id}"]`)?.getAttribute('aria-pressed')).toBe('true');
    const tsUrl = urls.find((u) => u.includes('/workbench/timeseries')) ?? '';
    expect(tsUrl).toContain(`range=${tsRange}`);
    expect(container.querySelector('[data-testid="ov6-trend"]')?.textContent).toContain(
      container.querySelector(`[data-testid="ov6-range-${id}"]`)?.textContent ?? '',
    );
  });

  it('非法 ?range=9d 回落默认档并带 title 说明', async () => {
    stubFetch();
    await render(<OverviewPage />, '/overview?range=9d');
    const hint = container.querySelector('[data-testid="ov6-range-fallback"]');
    expect(hint).toBeTruthy();
    expect(hint?.getAttribute('title')).toContain('9d');
    expect(container.querySelector('[data-testid="ov6-range-14d"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('[data-testid="ov6-trend"]')?.textContent).toContain('近 14 天运行趋势');
  });
});

describe('OM-04 趋势桶数与空态句随窗', () => {
  const ready = <T,>(data: T) => ({ k: 'ready' as const, data });

  function fixtureWithBuckets(n: number): DutyData {
    return {
      employees: ready([]),
      stats: ready({}),
      todayStats: ready({ totals: {} }),
      stats14: ready({
        asOf: '2026-11-23T12:00:00Z',
        buckets: Array.from({ length: n }, (_, i) => ({
          bucketStart: `2026-11-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
          runs: i,
          failed: 0,
        })),
      }),
      activity: ready({ cells: [] }),
      budgetDay: ready({ items: [], missingEmployeeIds: [] }),
      budgetMonth: ready({ items: [], missingEmployeeIds: [] }),
      approvalStats: ready({ pending: 0 }),
      approvals: ready([]),
      todayRuns: ready([]),
      recentRuns: ready([]),
      failedRuns: ready([]),
      blockedTasks: ready([]),
    } as unknown as DutyData;
  }

  it('trendPoints 按档位天数收口：30 桶输入 → 7d 画 7 根、14d 画 14 根', async () => {
    const data = fixtureWithBuckets(30);
    await render(<OverviewView data={data} matrix={ready({ items: [] })} loading={false} onRetry={() => {}} rangeId="7d" />);
    expect(container.querySelectorAll('.ov5-bar').length).toBe(7);
    await act(async () => {
      root.unmount();
    });
    container.remove();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await render(<OverviewView data={data} matrix={ready({ items: [] })} loading={false} onRetry={() => {}} rangeId="14d" />);
    expect(container.querySelectorAll('.ov5-bar').length).toBe(14);
  });

  it('空窗时提示句随窗：30d 档说「近 30 天还没有运行记录」', async () => {
    const data = fixtureWithBuckets(30);
    (data.stats14 as unknown as { data: { buckets: unknown[] } }).data.buckets = [];
    await render(<OverviewView data={data} matrix={ready({ items: [] })} loading={false} onRetry={() => {}} rangeId="30d" />);
    expect(container.querySelector('[data-testid="ov6-trend"]')?.textContent).toContain('近 30 天还没有运行记录');
  });
});
