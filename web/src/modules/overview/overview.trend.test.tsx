// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OverviewView } from './OverviewModulePage';
import type { OverviewSummaryBody } from './api';
import type { Loadable, RunStatsBody } from '../duty/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

async function render(node: ReactNode) {
  await act(async () => {
    root.render(<MemoryRouter>{node}</MemoryRouter>);
  });
  await act(async () => {});
}

const ready = <T,>(data: T): Loadable<T> => ({ k: 'ready', data });

const SUMMARY: OverviewSummaryBody = {
  employeeTotal: { value: 3, source: 'domain GET /v1/employees?limit=100（单页）', asOf: '2026-11-23T11:41:22Z' },
  asOf: '2026-11-23T11:41:22Z',
};

function trendBody(buckets: Array<[string, number | null, number | null]>): RunStatsBody {
  return {
    buckets: buckets.map(([bucketStart, runs, failed]) => ({ bucketStart, runs, failed })),
    totals: { runs: 0 },
    asOf: '2026-11-23T11:41:24Z',
  } as unknown as RunStatsBody;
}

function view(trend: RunStatsBody) {
  return (
    <OverviewView
      state={{ summary: ready(SUMMARY), today: ready(trendBody([])), trend: ready(trend) }}
      todayDate="2026-11-23"
      onRetry={() => {}}
    />
  );
}

describe('OM-06 趋势数据契约（run-stats 桶→柱子图诚实映射）', () => {
  it('N 个桶渲染 N 根柱；null 桶标 is-missing 且不画柱体；真 0 桶不造假高度', async () => {
    await render(
      view(trendBody([
        ['2026-11-20T16:00:00Z', 44, 3],
        ['2026-11-21T16:00:00Z', null, null],
        ['2026-11-22T16:00:00Z', 0, 0],
        ['2026-11-23T16:00:00Z', 4, null],
      ])),
    );
    const bars = container.querySelectorAll('[data-testid="ov6-bars"] .ov5-bar');
    expect(bars.length).toBe(4);
    expect(container.querySelectorAll('.ov5-bar.is-missing').length).toBe(1);
    // 只有 >0 的真数才画柱体：44 与 4 两根
    expect(container.querySelectorAll('.ov5-bar-track i').length).toBe(2);
  });

  it('全部桶 runs=null：空态句替代柱图，bars=0，文案说明没有可用运行数', async () => {
    await render(view(trendBody([
      ['2026-11-21T16:00:00Z', null, null],
      ['2026-11-22T16:00:00Z', null, null],
    ])));
    expect(container.querySelector('[data-testid="ov6-bars"]')).toBeNull();
    expect(container.querySelector('[data-testid="ov6-trend-empty"]')?.textContent).toContain('没有可用的运行数');
  });

  it('整窗真数全 0：文案含「还没有运行记录」，bars=0，不以假柱充数', async () => {
    await render(view(trendBody([
      ['2026-11-21T16:00:00Z', 0, 0],
      ['2026-11-22T16:00:00Z', 0, 0],
    ])));
    expect(container.querySelector('[data-testid="ov6-bars"]')).toBeNull();
    expect(container.querySelector('[data-testid="ov6-trend-empty"]')?.textContent).toContain('还没有运行记录');
  });

  it('失败数只进悬停 title，不上版面文字；缺失败数标未接', async () => {
    await render(view(trendBody([
      ['2026-11-20T16:00:00Z', 44, 3],
      ['2026-11-22T16:00:00Z', 4, null],
    ])));
    expect(container.querySelector('[data-testid="ov6-bars"]')?.textContent).not.toContain('失败');
    const titles = [...container.querySelectorAll('.ov5-bar')].map((el) => el.getAttribute('title'));
    expect(titles[0]).toContain('失败 3');
    expect(titles[1]).toContain('失败 未接');
    expect(titles[0]).toContain('运行 44');
  });
});
