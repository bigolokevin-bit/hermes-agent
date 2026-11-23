// @vitest-environment jsdom
// OM-06 趋势数据契约：缺读数桶画「未返回」形且逐桶对齐；全缺/全真零各走空态不画骨架；
// 失败数只进悬停 title；max(1,…) 除零防线。
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OverviewView } from './OverviewPage';
import type { DutyData } from '../duty/useDutyData';

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
});

async function render(node: ReactNode, path = '/overview') {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>);
  });
  await act(async () => {});
}

const ready = <T,>(data: T) => ({ k: 'ready' as const, data });

type BucketSpec = { runs: number | null; failed?: number | null };

/** 用给定逐桶形状搭一份最小 DutyData（其余腿就绪空值，不干扰趋势卡断言）。 */
function fixtureBuckets(specs: BucketSpec[]): DutyData {
  return {
    employees: ready([]),
    stats: ready({}),
    todayStats: ready({ totals: {} }),
    stats14: ready({
      asOf: '2026-11-23T12:00:00Z',
      buckets: specs.map((s, i) => ({
        bucketStart: `2026-11-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
        runs: s.runs,
        failed: s.failed === undefined ? 0 : s.failed,
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

function view(specs: BucketSpec[], days: 7 | 14 | 30 = 14) {
  return (
    <OverviewView
      data={fixtureBuckets(specs)}
      matrix={ready({ items: [] })}
      loading={false}
      onRetry={() => {}}
      rangeId={days === 7 ? '7d' : days === 30 ? '30d' : '14d'}
    />
  );
}

describe('OM-06 趋势柱与读口逐桶对齐', () => {
  it('12 桶含 2 个 null：柱子总数 12，is-missing 恰 2，缺桶 title 说「未返回」', async () => {
    const specs: BucketSpec[] = Array.from({ length: 12 }, (_, i) =>
      i === 3 || i === 9 ? { runs: null } : { runs: i + 1, failed: 0 },
    );
    await render(view(specs));
    const bars = container.querySelectorAll('.ov5-bar');
    expect(bars.length).toBe(12);
    const missing = container.querySelectorAll('.ov5-bar.is-missing');
    expect(missing.length).toBe(2);
    // 缺桶不画内芯柱（不以 0 高柱冒充「没有」，也不以缺值冒充 0 次运行）。
    for (const m of Array.from(missing)) {
      expect(m.querySelector('.ov5-bar-track i')).toBeNull();
      expect(m.getAttribute('title')).toContain('未返回');
    }
    // 逐桶对齐：第 4、第 10 根（0 基 3、9）是缺桶。
    expect(bars[3].classList.contains('is-missing')).toBe(true);
    expect(bars[9].classList.contains('is-missing')).toBe(true);
    expect(bars[4].classList.contains('is-missing')).toBe(false);
  });

  it('悬停 title 含「失败 n」，失败数不进柱高（只进说明）', async () => {
    const specs: BucketSpec[] = [
      { runs: 10, failed: 3 },
      { runs: 20, failed: null },
    ];
    await render(view(specs));
    const bars = container.querySelectorAll('.ov5-bar');
    expect(bars[0].getAttribute('title')).toContain('失败 3');
    expect(bars[1].getAttribute('title')).toContain('失败 —');
    const trendText = container.querySelector('[data-testid="ov6-trend"]')?.textContent ?? '';
    expect(trendText).toContain('失败次数在悬停说明里');
  });

  it('全 null 桶：不画骨架（bars=0），空态说「没有返回」而不是「还没有运行记录」', async () => {
    await render(view(Array.from({ length: 5 }, () => ({ runs: null }))));
    expect(container.querySelectorAll('.ov5-bar').length).toBe(0);
    expect(container.querySelector('[data-testid="ov6-trend-missing"]')).toBeTruthy();
    const trendText = container.querySelector('[data-testid="ov6-trend"]')?.textContent ?? '';
    expect(trendText).toContain('没有返回');
    expect(trendText).not.toContain('还没有运行记录');
  });

  it('全 0 桶（真零）：bars=0，走「还没有运行记录」空态，不以 4px  stub 冒充读数', async () => {
    await render(view(Array.from({ length: 7 }, () => ({ runs: 0, failed: 0 }))));
    expect(container.querySelectorAll('.ov5-bar').length).toBe(0);
    const trendText = container.querySelector('[data-testid="ov6-trend"]')?.textContent ?? '';
    expect(trendText).toContain('还没有运行记录');
    expect(container.querySelector('[data-testid="ov6-trend-missing"]')).toBeNull();
  });

  it('桶上限随档位：30 桶输入 → 30d 画 30 根、14d 画 14 根、7d 画 7 根', async () => {
    const specs: BucketSpec[] = Array.from({ length: 30 }, (_, i) => ({ runs: i + 1 }));
    await render(view(specs, 30));
    expect(container.querySelectorAll('.ov5-bar').length).toBe(30);
    await act(async () => {
      root.unmount();
    });
    container.remove();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await render(view(specs, 14));
    expect(container.querySelectorAll('.ov5-bar').length).toBe(14);
    await act(async () => {
      root.unmount();
    });
    container.remove();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await render(view(specs, 7));
    expect(container.querySelectorAll('.ov5-bar').length).toBe(7);
  });

  it('除零防线与混合窗：0/正数/null 混排不崩，柱高全是合法百分比（无 NaN）', async () => {
    await render(view([{ runs: 0 }, { runs: 10 }, { runs: null }]));
    const bars = container.querySelectorAll('.ov5-bar');
    expect(bars.length).toBe(3);
    const heights = Array.from(container.querySelectorAll('.ov5-bar-track i')).map(
      (el) => (el as HTMLElement).style.height,
    );
    expect(heights.length).toBe(2); // null 桶没有内芯柱
    for (const h of heights) expect(h).toMatch(/^\d+(\.\d+)?%$/);
    expect(heights[0]).toBe('4%'); // 0 次运行 → 最小可视 4%，不是 NaN、不是 0 不可见
    expect(heights[1]).toBe('100%'); // 峰值归一
  });
});
