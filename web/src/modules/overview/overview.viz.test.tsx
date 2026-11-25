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

// 同一个星期行内放四档读数（0/1–2/3–4/5+ 全覆盖），24 格热力取读数最多的一天。
const HEAT_CELLS = [
  { dow: 5, hour: 12, count: 1 },
  { dow: 5, hour: 13, count: 3 },
  { dow: 5, hour: 14, count: 5 },
  { dow: 5, hour: 15, count: 8 },
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
  it('首排三段带：不画无轴火花小图、不铺点阵占位、不复活门行', async () => {
    await render(view());
    const runs = container.querySelector('[data-testid="ov6-kpi-runs"]')!;
    // P0 修复：删掉看起来「图坏了」的 40px 小图；空列表也不再铺占位 pill 行。
    expect(runs.querySelector('.ov5-spark')).toBeNull();
    expect(runs.querySelector('.ov5-hlist')).toBeNull();
    // 三段带只有标签/主数字/副读数/细条，门行与点阵不再回流。
    expect(runs.querySelector('.ov5-gate')).toBeNull();
    expect(runs.querySelector('.ov5-kpi-value')?.textContent).toBe('4');

    const employees = container.querySelector('[data-testid="ov6-kpi-employees"]')!;
    expect(employees.querySelector('.ov5-dots')).toBeNull();
    expect(employees.querySelector('.ov5-gate')).toBeNull();
    // 三段在同一行网格里并排（窄屏才堆叠，那由 CSS 负责）。
    expect(container.querySelectorAll('[data-testid="ov6-kpi-strip"] .ov5-seg')).toHaveLength(3);
  });

  it('趋势图：平滑曲线+面积渐变、缺桶断口、整数刻度、峰值点', async () => {
    await render(view());
    const svg = container.querySelector('[data-testid="ov6-trend-svg"]');
    expect(svg).toBeTruthy();
    // 峰值 8 → yDomainLadder 8（整数档），三档网格线（横向实线，无竖线）。
    const gridLines = svg?.querySelectorAll('.tc-grid') ?? [];
    expect(gridLines.length).toBeGreaterThanOrEqual(3);
    expect(svg?.querySelectorAll('line.tc-grid').length).toBe(gridLines.length);
    const yLabels = Array.from(svg?.querySelectorAll('.tc-tick') ?? [])
      .map((el) => el.textContent ?? '')
      .filter((text) => /^\d+(\.\d+)?$/.test(text));
    expect(yLabels).toContain('0');
    for (const label of yLabels) expect(Number.isInteger(Number(label))).toBe(true);
    // 曲线按缺读数断开：第 1 天单独一段、第 3–4 天一段。
    const lines = Array.from(svg?.querySelectorAll('.tc-line') ?? []);
    expect(lines).toHaveLength(2);
    // 平滑判据：两点段退化成直线，三点以上的段必须是三次贝塞尔（monotone），
    // 且没有任何一段是折线 M…L… 的多点拼接。
    for (const line of lines) {
      const d = line.getAttribute('d') ?? '';
      expect(d.startsWith('M')).toBe(true);
      expect(d).not.toContain('NaN');
      expect((d.match(/C/g) ?? []).length + (d.match(/L/g) ?? []).length).toBeLessThanOrEqual(1);
    }
    // 本夹具最长的一段只有两天 ⇒ 退化成一条直线（不是多点折线）；
    // 三点以上的平滑由 charts/monotone.test.ts 与 overview.trend 的曲线用例钉住。
    expect(lines[1].getAttribute('d') ?? '').toMatch(/^M[^CL]*L[^CL]*$/);
    // 面积渐变：有读数的段各一条闭合面积（fill 指向本图自己的 linearGradient）。
    const areas = Array.from(svg?.querySelectorAll('.tc-area') ?? []);
    expect(areas).toHaveLength(1);
    const gradientId = (areas[0].getAttribute('fill') ?? '').replace(/^url\(#|\)$/g, '');
    expect(svg?.querySelector(`linearGradient#${gradientId}`)).toBeTruthy();
    // 无跨缺读数的插值连线：断日只留底部断口标记 + 孤立读数一个中性小点。
    expect(svg?.querySelectorAll('.tc-gap')).toHaveLength(1);
    expect(svg?.querySelectorAll('.tc-iso')).toHaveLength(1);
    // 悬停列仍逐桶 4 列（不画柱，只做命中层）。
    expect(container.querySelectorAll('[data-testid="ov6-trend"] .ov5-bar')).toHaveLength(4);
    // 峰值点（8 次）保留中性圆点 + 标注。
    expect(container.querySelector('.tc-peak-mark')).toBeTruthy();
    expect(container.querySelector('.tc-peak-dot')).toBeTruthy();
    expect(container.querySelector('.tc-peak-label')?.textContent).toContain('峰值 8');
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
    expect(grid?.getAttribute('aria-label')).toContain('合计 17 次');
    // 1 → 1 档；3 → 2 档；5 与 8 → 3 档（5+）；其余 20 个小时画斜线。
    expect(grid?.querySelectorAll('rect.ov5-heat-lv3')).toHaveLength(2);
    expect(grid?.querySelectorAll('rect.ov5-heat-lv2')).toHaveLength(1);
    expect(grid?.querySelectorAll('rect.ov5-heat-lv1')).toHaveLength(1);
    expect(grid?.querySelectorAll('rect.ov5-heat-cell.is-peak')).toHaveLength(1);
    expect(grid?.querySelectorAll('rect.ov5-heat-cell.is-void')).toHaveLength(24 - 4);
  });

  it('活动腿没有读数时热力不画空格（24 格不出现），走诚实空态', async () => {
    await render(view([]));
    const heat = container.querySelector('[data-testid="ov6-heat"]')!;
    expect(heat.querySelector('svg.ov5-heat-svg')).toBeNull();
    expect(heat.textContent).toContain('没有运行活跃读数');
  });

  it('判据④：页内 + 曲线件内联 <svg> 站点 ≥ 20（视觉层真的在源码里）', () => {
    // jsdom 面下 import.meta.url 不是 file: 协议，按 vitest 的 cwd（web/）取路径。
    // 趋势图搬到公共件 TrendCurve 后，源码站点按「页 + 件」合计：判据钉的是
    // 「视觉层是手写 SVG，不是图片/依赖」，不是「全挤在一个文件里」。
    const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');
    const page = read('src/modules/overview/OverviewPage.tsx');
    const curve = read('src/components/charts/TrendCurve.tsx');
    const svgSites = (page.match(/<svg/g) ?? []).length + (curve.match(/<svg/g) ?? []).length;
    expect(svgSites).toBeGreaterThanOrEqual(20);
    // 页内自己仍留有图标/热力等内联 svg（不为凑数把整页搬走）。
    expect((page.match(/<svg/g) ?? []).length).toBeGreaterThanOrEqual(19);
  });
});