// @vitest-environment jsdom
/**
 * round8 P1 细节收口（只改呈现，不造读数）：
 * ① 门行 = 名称左 / 数值右 / 状态在数值后，名称旁不再挂第二枚红色徽章；
 * ② 阻塞行 = 主行「对象 · 阻塞原因」+ 11px 副行「责任 X · 等待 Y · 影响 Z」；
 * ③ 最近运行短码 = `run_` + runId 尾 6 位小写，完整 id 只进 title；耗时不足 1 秒写 <1s；
 * ④ 三条细长条右侧箭头不换行（CSS，见 overview.css，本文件钉 DOM 单行结构）。
 */
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

const ready = <T,>(data: T) => ({ k: 'ready' as const, data });

async function render(node: ReactNode) {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={['/overview']}>{node}</MemoryRouter>);
  });
  await act(async () => {});
}

function data(over: Partial<DutyData> = {}): DutyData {
  return {
    employees: ready([{ employeeId: 'emp_1', name: '陈可', lifecycleState: 'active' }]),
    stats: ready({ byLifecycle: { active: 1, paused: 0, offboarding: 0 }, asOf: '2026-11-24T04:20:00Z' }),
    todayStats: ready({ totals: { runs: 1, failed: 0, succeeded: 1 }, asOf: '2026-11-24T04:21:00Z' }),
    stats14: ready({ asOf: '2026-11-24T04:22:00Z', buckets: [] }),
    activity: ready({ cells: [] }),
    budgetDay: ready({ items: [], missingEmployeeIds: [] }),
    budgetMonth: ready({ items: [], missingEmployeeIds: [] }),
    approvalStats: ready({ pending: 0 }),
    approvals: ready([]),
    todayRuns: ready([]),
    recentRuns: ready([]),
    failedRuns: ready([]),
    blockedTasks: ready([]),
    ...over,
  } as DutyData;
}

async function view(over: Partial<DutyData>) {
  await render(<OverviewView data={data(over)} matrix={ready({ items: [] })} loading={false} onRetry={() => {}} />);
}

const card = (id: string) => container.querySelector(`[data-testid="${id}"]`)!;

describe('round8 ① 门行：名称左 / 数值右 / 状态在数值后，无第二枚色块', () => {
  it('门行只有标签、数值、状态、状态点各一份；名称旁没有红色徽章', async () => {
    await view({});
    const rows = Array.from(card('ov6-kpi-employees').querySelectorAll('.ov5-gate')) as HTMLElement[];
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.querySelectorAll('.ov5-gk')).toHaveLength(1);
      expect(row.querySelectorAll('.ov5-gv')).toHaveLength(1);
      expect(row.querySelectorAll('.ov5-gcut')).toHaveLength(1);
      expect(row.querySelectorAll('.ov5-gdot')).toHaveLength(1);
      expect(row.querySelectorAll('.ov5-gtag')).toHaveLength(0);
      // DOM 顺序：名称 → 数值 → 状态 → 点（数值在状态之前）。
      const kids = Array.from(row.children).map((el) => el.className.split(' ')[0]);
      expect(kids).toEqual(['ov5-gk', 'ov5-gv', 'ov5-gcut', 'ov5-gdot']);
    }
  });
});

describe('round8 ② 阻塞行：人话两行，不连写 schema 字段名', () => {
  it('主行 对象 · 原因；副行 责任 X · 等待 Y · 影响 Z', async () => {
    await view({
      blockedTasks: ready([
        { taskId: 'tsk_1', title: '验收用任务', status: 'blocked', updatedAt: new Date(Date.now() - 2 * 3600e3).toISOString() },
      ]),
    });
    const row = card('ov6-blockers').querySelector('.ov5-blkrow') as HTMLElement;
    expect(row.querySelector('.ov5-bline1')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      '验收用任务 · 任务处于阻塞状态',
    );
    const sub = row.querySelector('.ov5-bline2')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    expect(sub).toMatch(/^责任 任务负责人 · 等待 \d+h \d+m · 影响 派工$/);
    expect(sub).not.toContain('下一步');
    expect(sub).not.toContain('责任·任务');
  });
});

describe('round8 ③ 最近运行：run_ 短码 + 完整 id 进 title；0s 写 <1s', () => {
  it('runId 取末 6 位小写，前缀 run_；title 保留完整 id', async () => {
    const full = 'rn_01M7MNPABCDF1234';
    await view({
      recentRuns: ready([
        {
          runId: full,
          employeeId: 'emp_1',
          status: 'completed',
          startedAt: '2026-11-24T04:00:00Z',
          endedAt: '2026-11-24T04:00:00.400Z',
        },
      ]),
    });
    const link = card('ov6-activity').querySelector('.ov5-ht') as HTMLElement;
    expect(link.textContent?.trim().startsWith('run_df1234')).toBe(true);
    expect(link.getAttribute('title')).toContain(full);
    expect(card('ov6-activity').querySelector('.ov5-hm')?.textContent).toBe('<1s');
  });

  it('未结束的 run 不足 1 秒同样写 <1s，不写 0s', async () => {
    await view({
      recentRuns: ready([{ runId: 'rn_01M7MNPABCDF9999', status: 'running', startedAt: new Date().toISOString() }]),
    });
    expect(card('ov6-activity').querySelector('.ov5-hm')?.textContent).toBe('<1s');
  });
});