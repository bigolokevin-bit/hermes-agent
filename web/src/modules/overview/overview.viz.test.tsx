// @vitest-environment jsdom
// OM-17 视觉层门：火花线／点阵／趋势 svg／悬停读数／7×24 热力逐块在位，
// 且诚实态不被视觉层洗掉（缺桶画虚线框、无源画点阵、空窗口不画 168 个空格）。
// 另钉判据④：OverviewPage.tsx 源码里的内联 <svg> 站点 ≥ 20。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

const BUCKETS = [
  { bucketStart: '2026-11-01T00:00:00Z', runs: 3, failed: 1 },
  { bucketStart: '2026-11-02T00:00:00Z', runs: null, failed: null },
  { bucketStart: '2026-11-03T00:00:00Z', runs: 8, failed: 0 },
  { bucketStart: '2026-11-04T00:00:00Z', runs: 5, failed: 2 },
];

// 同一个星期行内放三档读数，24 格热力取读数最多的一天，档位断言才落在同一行。
const HEAT_CELLS = [
  { dow: 5, hour: 13, count: 1 },
  { dow: 5, hour: 14, count: 8 },
  { dow: 5, hour: 15, count: 5 },
];

function fixture(cells: Array<{ dow: number; hour: number; count: number }> = HEAT_CELLS): DutyData {
  return {
    employees: ready([{ employeeId: 'emp_1', name: '甲', lifecycleState: 'active' }]),
    stats: ready({ byLifecycle: { active: 1 }, asOf: '2026-11-19T04:20:00Z' }),
    todayStats: ready({ totals: { runs: 4, failed: 1, succeeded: 3 } }),
    stats14: ready({ asOf: '2026-11-19T04:22:00Z', buckets: BUCKETS }),
    activity: ready({ cells }),
    budgetDay: ready({ items: [{ employeeId: 'emp_1', costUsd: 1.5 }], missingEmployeeIds: [] }),
    budgetMonth: ready({ items: [{ employeeId: 'emp_1', costUsd: 12 }], missingEmployeeIds: [] }),
    approvalStats: ready({ pending: 2 }),
    approvals: ready([]),
    todayRuns: ready([]),
    recentRuns: ready([]),
    failedRuns: ready([]),
    blockedTasks: ready([]),
  } as unknown as DutyData;
}

function view(cells?: Array<{ dow: number; hour: number; count: number }>) {
  return (
    <OverviewView
      data={fixture(cells)}
      matrix={ready({ items: [] })}
      loading={false}
      onRetry={() => {}}
      rangeId="7d"
    />
  );
}

describe('OM-17 视觉层：火花／点阵／趋势／热力', () => {
  it('运行卡有面积火花线（闭合面积 + 折线 + 末点圆），员工卡无趋势源就不画点阵', async () => {
    await render(view());
    const runs = container.querySelector('[data-testid="ov6-kpi-runs"]')!;
    const area = runs.querySelector('.ov5-spark-area');
    expect(area).toBeTruthy();
    // 面积路径必须闭合到底边（Z 结尾），否则不是基线 spark() 的 area 分支。
    expect(area?.getAttribute('d')).toMatch(/^M[-\d.]+ [-\d.]+( L[-\d.]+ [-\d.]+)+ L[-\d.]+ [-\d.]+ Z$/);
    expect(runs.querySelector('.ov5-spark-line')?.getAttribute('stroke-width')).toBeNull();
    expect(runs.querySelector('.ov5-spark-dot')?.getAttribute('r')).toBe('2.4');

    // 无趋势源的卡不拿点阵占位：员工卡换成一排四门真读数行。
    const employees = container.querySelector('[data-testid="ov6-kpi-employees"]')!;
    expect(employees.querySelector('.ov5-dots')).toBeNull();
    expect(employees.querySelectorAll('.ov5-gate')).toHaveLength(4);
  });

  it('趋势图：4 条网格线、逐桶柱、缺桶虚线框、峰值标记、失败子段', async () => {
    await render(view());
    const svg = container.querySelector('.ov5-trend-svg');
    expect(svg).toBeTruthy();
    expect(svg?.querySelectorAll('.ov5-grid-line')).toHaveLength(4);
    // 逐桶：4 个桶 → 3 根柱 + 1 个虚线框；overlay 仍保持逐桶 4 列契约。
    expect(container.querySelectorAll('[data-testid="ov6-trend"] .ov5-trend-bar')).toHaveLength(3);
    expect(container.querySelectorAll('[data-testid="ov6-trend"] .ov5-trend-void')).toHaveLength(1);
    expect(container.querySelectorAll('[data-testid="ov6-trend"] .ov5-bar')).toHaveLength(4);
    // 失败子段：failed 1 与 2 两根柱有，failed 0 那根没有。
    expect(container.querySelectorAll('[data-testid="ov6-trend"] .ov5-trend-fail')).toHaveLength(2);
    // 峰值柱（8 次）画虚线标记 + 圆点。
    expect(container.querySelector('.ov5-peak-mark')).toBeTruthy();
    expect(container.querySelector('.ov5-peak-dot')).toBeTruthy();
  });

  it('趋势悬停读数走 role=status aria-live=polite，缺桶不折 0', async () => {
    await render(view());
    const tip = container.querySelector('[data-testid="ov6-trend-tip"]');
    expect(tip?.getAttribute('role')).toBe('status');
    expect(tip?.getAttribute('aria-live')).toBe('polite');
    // 缺桶的 title 明说「未返回」，且该列没有柱芯。
    const missing = container.querySelector('[data-testid="ov6-trend"] .ov5-bar.is-missing')!;
    expect(missing.getAttribute('title')).toContain('未返回');
    expect(missing.querySelector('.ov5-bar-track i')).toBeNull();
  });

  it('热力：24 格单排，档位随次数分档，峰值格描边，aria-label 带窗口合计', async () => {
    await render(view());
    const grid = container.querySelector('[data-testid="ov6-heat"] svg.ov5-heat-svg');
    expect(grid).toBeTruthy();
    expect(grid?.querySelectorAll('rect.ov5-heat-cell')).toHaveLength(24);
    expect(grid?.getAttribute('aria-label')).toContain('合计 14 次');
    // 8 次 → 第 3 档；5 次 → 第 2 档；1 次 → 第 1 档；其余小时画斜线，不留白面。
    expect(grid?.querySelectorAll('rect.ov5-heat-lv3')).toHaveLength(1);
    expect(grid?.querySelectorAll('rect.ov5-heat-lv2')).toHaveLength(1);
    expect(grid?.querySelectorAll('rect.ov5-heat-lv1')).toHaveLength(1);
    expect(grid?.querySelectorAll('rect.ov5-heat-cell.is-peak')).toHaveLength(1);
    expect(grid?.querySelectorAll('rect.ov5-heat-cell.is-void')).toHaveLength(24 - 3);
  });

  it('活动腿没有读数时热力不画空格（24 格不出现），走诚实空态', async () => {
    await render(view([]));
    const heat = container.querySelector('[data-testid="ov6-heat"]')!;
    expect(heat.querySelector('svg.ov5-heat-svg')).toBeNull();
    expect(heat.textContent).toContain('没有运行活跃读数');
  });

  it('判据④：OverviewPage.tsx 内联 <svg> 站点 ≥ 20（视觉层真的在源码里）', () => {
    // jsdom 面下 import.meta.url 不是 file: 协议，按 vitest 的 cwd（web/）取路径。
    const source = readFileSync(resolve(process.cwd(), 'src/modules/overview/OverviewPage.tsx'), 'utf8');
    const svgSites = source.match(/<svg/g) ?? [];
    expect(svgSites.length).toBeGreaterThanOrEqual(20);
  });
});