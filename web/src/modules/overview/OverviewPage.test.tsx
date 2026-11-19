// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OverviewPage, OverviewView } from './OverviewPage';
import type { DutyData } from '../duty/useDutyData';

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
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

const ready = <T,>(data: T) => ({ k: 'ready' as const, data });

function dataFixture(): DutyData {
  return {
    employees: ready([
      { employeeId: 'emp_1', name: '陈可', lifecycleState: 'active' },
      { employeeId: 'emp_2', name: '林一舟', lifecycleState: 'active' },
    ]),
    stats: ready({ byLifecycle: { active: 1, paused: 1, offboarding: 0 } }),
    todayStats: ready({ totals: { runs: 10, failed: 2, succeeded: 8 } }),
    stats14: ready({
      buckets: [
        { bucketStart: '2026-11-18T16:00:00Z', runs: 4, failed: 1 },
        { bucketStart: '2026-11-19T16:00:00Z', runs: 6, failed: 1 },
      ],
    }),
    activity: ready({ cells: [] }),
    budgetDay: ready({ items: [{ employeeId: 'emp_1', costUsd: 1.5 }, { employeeId: 'emp_2', costUsd: 0 }], missingEmployeeIds: [] }),
    budgetMonth: ready({ items: [{ employeeId: 'emp_1', costUsd: 12 }, { employeeId: 'emp_2', costUsd: 0 }], missingEmployeeIds: [] }),
    approvalStats: ready({ pending: 3, dueSoon: 1 }),
    approvals: ready([{ approvalId: 'a1', title: '开通频道' }]),
    todayRuns: ready([]),
    recentRuns: ready([{ runId: 'run_1', employeeId: 'emp_1', status: 'failed', startedAt: '2026-11-19T02:00:00Z' }]),
    failedRuns: ready([{ runId: 'run_1', employeeId: 'emp_1', status: 'failed', startedAt: '2026-11-19T02:00:00Z' }]),
    blockedTasks: ready([]),
  };
}

describe('OverviewPage forced states', () => {
  it.each([
    ['loading', 'ov5-loading'],
    ['empty', 'ov5-empty'],
    ['error', 'ov5-error'],
  ])('renders ?state=%s without fetching', async (state, testid) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await render(<OverviewPage />, `/overview?state=${state}`);
    expect(container.querySelector(`[data-testid="${testid}"]`)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('OverviewView', () => {
  it('renders KPIs, trend, recent activity and blockers from real data', async () => {
    await render(
      <OverviewView
        data={dataFixture()}
        matrix={{ k: 'ready', data: { items: [{ employeeId: 'emp_2', risk: { failedRuns: 2 } }] } }}
        readAt="2026-11-19 12:20"
        loading={false}
        onRetry={() => {}}
      />,
    );
    const text = container.textContent ?? '';
    expect(container.querySelector('[data-testid="ov5-kpi-employees"]')?.textContent).toContain('2');
    expect(text).toContain('在岗 1');
    expect(text).toContain('有风险 1');
    expect(text).toContain('今日运行');
    expect(text).toContain('失败率 20%');
    expect(text).toContain('待审批');
    expect(text).toContain('$1.50');
    expect(container.querySelector('[data-testid="ov5-trend"]')?.textContent).toContain('近 14 天运行趋势');
    expect(container.querySelectorAll('[data-testid="ov5-activity-row"]').length).toBe(1);
    expect(container.querySelector('[data-testid="ov5-blockers"]')?.textContent).toContain('运行');
    expect(text).not.toContain('$0.00');
    expect(text).not.toContain('GAP-');
    expect((text.match(/读取于/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it('shows — and a GAP note when the cost ledger does not cover every employee', async () => {
    const data = dataFixture();
    data.budgetDay = ready({ items: [{ employeeId: 'emp_1', costUsd: 1.5 }], missingEmployeeIds: ['emp_2'] });
    await render(
      <OverviewView
        data={data}
        matrix={{ k: 'error', status: 404, message: '未接入', requestId: null }}
        readAt="2026-11-19 12:20"
        loading={false}
        onRetry={() => {}}
      />,
    );
    const cost = container.querySelector('[data-testid="ov5-kpi-cost"]')?.textContent ?? '';
    expect(cost).toContain('—');
    expect(cost).not.toContain('$1.50');
    const employeeCard = container.querySelector('[data-testid="ov5-kpi-employees"]');
    expect(employeeCard?.textContent).not.toContain('GAP-');
    expect(employeeCard?.querySelector('.ov5-note')?.getAttribute('title')).toContain('GAP-OV5-RISK');
    expect(employeeCard?.querySelector('.ov5-kpi-issue')?.textContent).toContain('风险矩阵未接入');
    expect(employeeCard?.querySelector('[data-testid="ov5-kpi-employees-issue-retry"]')).toBeTruthy();
  });

  it('keeps partial blocks honest and retryable when one source fails', async () => {
    const data = dataFixture();
    data.todayStats = { k: 'error', status: 503, message: '数据服务暂时没有响应', requestId: 'req-run-9' };
    data.recentRuns = { k: 'error', status: 503, message: '数据服务暂时没有响应', requestId: 'req-act-9' };
    data.failedRuns = { k: 'error', status: 503, message: '数据服务暂时没有响应', requestId: 'req-blk-9' };
    await render(
      <OverviewView data={data} matrix={{ k: 'ready', data: { items: [] } }} readAt="2026-11-19 12:20" loading={false} onRetry={() => {}} />,
    );
    const runs = container.querySelector('[data-testid="ov5-kpi-runs"]');
    expect(runs?.textContent).toContain('运行统计未接入');
    expect(runs?.textContent).toContain('req-run-9');
    expect(runs?.querySelector('[data-testid="ov5-kpi-runs-issue-retry"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="ov5-activity-retry"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="ov5-blockers-retry"]')).toBeTruthy();
  });

  it('renders a whole-page error when every core source fails', async () => {
    const data = dataFixture();
    for (const key of ['employees', 'stats', 'todayStats', 'approvalStats', 'budgetDay'] as const) {
      (data as unknown as Record<string, unknown>)[key] = {
        k: 'error', status: 503, message: '不可用', requestId: 'req-ov5-1',
      };
    }
    await render(
      <OverviewView data={data} matrix={{ k: 'loading' }} readAt="" loading={false} onRetry={() => {}} />,
    );
    expect(container.querySelector('[data-testid="ov5-error"]')?.textContent).toContain('req-ov5-1');
    expect(container.textContent).toContain('没有编造任何数字');
  });
});