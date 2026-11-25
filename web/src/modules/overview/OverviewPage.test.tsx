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
    stats: ready({ byLifecycle: { active: 1, paused: 1, offboarding: 0 }, asOf: '2026-11-19T04:20:00Z' }),
    todayStats: ready({ totals: { runs: 10, failed: 2, succeeded: 8 }, asOf: '2026-11-19T04:21:00Z' }),
    stats14: ready({
      asOf: '2026-11-19T04:22:00Z',
      buckets: [
        { bucketStart: '2026-11-18T16:00:00Z', runs: 4, failed: 1 },
        { bucketStart: '2026-11-19T16:00:00Z', runs: 6, failed: 1 },
      ],
    }),
    activity: ready({ cells: [] }),
    budgetDay: ready({ items: [{ employeeId: 'emp_1', costUsd: 1.5 }, { employeeId: 'emp_2', costUsd: 0 }], missingEmployeeIds: [], asOf: '2026-11-19T04:23:00Z' }),
    budgetMonth: ready({ items: [{ employeeId: 'emp_1', costUsd: 12 }, { employeeId: 'emp_2', costUsd: 0 }], missingEmployeeIds: [] }),
    approvalStats: ready({ pending: 3, dueSoon: 1, asOf: '2026-11-19T04:24:00Z' }),
    approvals: ready([{ approvalId: 'a1', title: '开通频道' }]),
    todayRuns: ready([]),
    recentRuns: ready([{ runId: 'run_1', employeeId: 'emp_1', status: 'failed', startedAt: '2026-11-19T02:00:00Z' }]),
    failedRuns: ready([{ runId: 'run_1', employeeId: 'emp_1', status: 'failed', startedAt: '2026-11-19T02:00:00Z' }]),
    blockedTasks: ready([]),
  };
}

describe('OverviewPage forced states', () => {
  it.each([
    ['loading', 'ov6-loading'],
    ['empty', 'ov6-empty'],
    ['error', 'ov6-error'],
  ])('renders ?state=%s without fetching', async (state, testid) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await render(<OverviewPage />, `/overview?state=${state}`);
    expect(container.querySelector(`[data-testid="${testid}"]`)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('OverviewView', () => {
  it('R29: every overview card carries a source stamp and the page a top as-of', async () => {
    await render(
      <OverviewView
        data={dataFixture()}
        matrix={{ k: 'ready', data: { items: [{ employeeId: 'emp_2', risk: { failedRuns: 2 } }] } }}
        loading={false}
        onRetry={() => {}}
      />,
    );
    const ids = [
      'ov6-asof',
      // 首排三卡并成一条三段带：整带只留一处采集时刻（带底），不再每段一行。
      'ov6-kpi-strip-stamp',
      'ov6-kpi-pending-stamp',
      'ov6-kpi-health-stamp',
      'ov6-trend-stamp',
      'ov6-activity-stamp',
      'ov6-blockers-stamp',
    ];
    for (const id of ids) {
      expect(container.querySelector(`[data-testid="${id}"]`), id).toBeTruthy();
    }
    // R31: as-of shows the real minute stamp; KPI family keeps duty-* aliases.
    expect(container.querySelector('[data-testid="ov6-asof"]')?.textContent).toMatch(
      /北京时间 \d{4}-\d{2}-\d{2} \d{2}:\d{2}|采集时刻 —/,
    );
    // R41: among the fixture legs the newest stamp (approvalStats 04:24Z) wins.
    expect(container.querySelector('[data-testid="ov6-asof"]')?.textContent).toContain("2026-11-19 12:24");
    expect(container.querySelectorAll('[data-duty-testid^="duty-kpi-"]')).toHaveLength(5);
  });

  it('页头：模块内不再重复标题/不多出 h1；元数据为真值；搜索/导出无读口只给可见提示', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await render(
      <OverviewView
        data={dataFixture()}
        matrix={{ k: 'ready', data: { items: [] } }}
        loading={false}
        onRetry={() => {}}
      />,
    );
    // 外壳 TopBar 是全球唯一的 h1；模块内不得再出标题或第二个 h1。
    expect(container.querySelector('.ov5-title')).toBeNull();
    expect(container.querySelectorAll('h1')).toHaveLength(0);
    const facts = container.querySelector('.ov5-facts')?.textContent ?? '';
    expect(facts).toContain('2 名数字员工');
    expect(facts).toContain('在跑');

    const search = container.querySelector('[data-testid="ov6-search"]') as HTMLButtonElement;
    expect(search.disabled).toBe(true);
    expect(search.getAttribute('title')).toContain('搜索读口未接入');
    const exportBtn = container.querySelector('[data-testid="ov6-export"]') as HTMLButtonElement;
    expect(exportBtn.disabled).toBe(true);
    expect(exportBtn.getAttribute('title')).toContain('导出接口未接入');
    expect(container.querySelector('[data-testid="ov6-action-hint"]')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders KPIs, trend, recent activity and blockers from real data', async () => {
    await render(
      <OverviewView
        data={dataFixture()}
        matrix={{ k: 'ready', data: { items: [{ employeeId: 'emp_2', risk: { failedRuns: 2 } }] } }}
        loading={false}
        onRetry={() => {}}
      />,
    );
    const text = container.textContent ?? '';
    // 三段带：段名在屏，主数字只放真值（本夹具没有四门证据 ⇒ 可上岗主数「—」）。
    const strip = container.querySelector('[data-testid="ov6-kpi-strip"]')!;
    expect(strip.querySelectorAll('.ov5-seg')).toHaveLength(3);
    expect(container.querySelector('[data-testid="ov6-kpi-employees"]')?.textContent).toContain('可上岗');
    expect(container.querySelector('[data-testid="ov6-kpi-runs"] .ov5-kpi-value')?.textContent).toBe('10');
    // 夹具的运行统计没带在跑数 ⇒ 副行只写真得的「失败 2」，不补在跑 0。
    expect(container.querySelector('[data-testid="ov6-kpi-runs"]')?.textContent).toContain('失败 2');
    // 在编人数与在跑数留在页头 facts；段内主数字只放各自那一个核读数。
    expect(text).toContain('2 名数字员工');
    expect(text).toContain('今日运行');
    expect(text).toContain('待审批');
    expect(text).toContain('$1.50');
    expect(container.querySelector('[data-testid="ov6-trend"]')?.textContent).toContain('近 14 天运行趋势');
    expect(container.querySelectorAll('[data-testid="ov6-activity-row"]').length).toBe(1);
    expect(container.querySelector('[data-testid="ov6-blockers"]')?.textContent).toContain('运行');
    expect(text).not.toContain('$0.00');
    // 真读数段：今日运行 10 次 / 今日实扣 $1.50，都来自夹具真值。
    expect(text).not.toContain('GAP-');
    expect(text).toContain('数据截至 2026-11-19 12:20 · 来源 员工统计');
    expect((text.match(/数据截至/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(text).not.toContain('读取于');
  });

  it('shows — and the missing-reader collapse when the cost ledger does not cover every employee', async () => {
    const data = dataFixture();
    data.budgetDay = ready({ items: [{ employeeId: 'emp_1', costUsd: 1.5 }], missingEmployeeIds: ['emp_2'] });
    await render(
      <OverviewView
        data={data}
        matrix={{ k: 'error', status: 404, message: '未接入', requestId: null }}
        loading={false}
        onRetry={() => {}}
      />,
    );
    const cost = container.querySelector('[data-testid="ov6-kpi-cost"]')?.textContent ?? '';
    // 日账本覆盖不全 ⇒ 今日实扣不上屏，也不拿月数字顶位；主数字写「—」。
    expect(container.querySelector('[data-testid="ov6-kpi-cost"] .ov5-kpi-value')?.textContent).toBe('—');
    expect(cost).toContain('本月 $12.00');
    expect(cost).not.toContain('$1.50');
    // 缺读口只在带底声明一次（不再每段一个折叠区）。
    expect(container.querySelector('[data-testid="ov6-kpi-gaps"]')?.textContent).toContain('今日实扣');
    const employeeCard = container.querySelector('[data-testid="ov6-kpi-employees"]');
    expect(employeeCard?.textContent).not.toContain('GAP-');
    expect(container.querySelector('[data-testid="ov6-kpi-gaps"]')?.textContent).toContain('风险口径');
    expect(employeeCard?.querySelector('[data-testid="ov6-kpi-employees-status"]')?.getAttribute('title')).toContain('数据源');
    expect(employeeCard?.querySelector('.ov5-kpi-issue')?.textContent).toContain('风险矩阵未接入');
    expect(employeeCard?.querySelector('[data-testid="ov6-kpi-employees-issue-retry"]')).toBeTruthy();
  });

  it('never substitutes a client clock when the source has no collection time', async () => {
    const data = dataFixture();
    data.budgetDay = ready({ items: [{ employeeId: 'emp_1', costUsd: 1.5 }, { employeeId: 'emp_2', costUsd: 0 }], missingEmployeeIds: [] });
    await render(
      <OverviewView data={data} matrix={{ k: 'ready', data: { items: [] } }} loading={false} onRetry={() => {}} />,
    );
    // 带底唯一采集时刻只上屏真来源时间（员工统计 12:20），不拿浏览器时钟顶位。
    const stamp = container.querySelector('[data-testid="ov6-kpi-strip-stamp"]');
    expect(stamp?.textContent).toContain('数据截至 2026-11-19 12:20');
    // 成本账本自身没带 asOf ⇒ title 里如实写「采集时刻未返回」，不补一个编的时刻。
    expect(stamp?.getAttribute('title')).toContain('成本账本：采集时刻未返回');
    expect(container.textContent ?? '').not.toContain('读取于');
  });

  it('keeps partial blocks honest and retryable when one source fails', async () => {
    const data = dataFixture();
    data.todayStats = { k: 'error', status: 503, message: '数据服务暂时没有响应', requestId: 'req-run-9' };
    data.recentRuns = { k: 'error', status: 503, message: '数据服务暂时没有响应', requestId: 'req-act-9' };
    data.failedRuns = { k: 'error', status: 503, message: '数据服务暂时没有响应', requestId: 'req-blk-9' };
    await render(
      <OverviewView data={data} matrix={{ k: 'ready', data: { items: [] } }} loading={false} onRetry={() => {}} />,
    );
    const runs = container.querySelector('[data-testid="ov6-kpi-runs"]');
    expect(runs?.textContent).toContain('运行统计未接入');
    expect(runs?.textContent).toContain('req-run-9');
    expect(runs?.querySelector('[data-testid="ov6-kpi-runs-issue-retry"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="ov6-activity-retry"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="ov6-blockers-retry"]')).toBeTruthy();
  });

  it('renders a whole-page error when every core source fails', async () => {
    const data = dataFixture();
    for (const key of ['employees', 'stats', 'todayStats', 'approvalStats', 'budgetDay'] as const) {
      (data as unknown as Record<string, unknown>)[key] = {
        k: 'error', status: 503, message: '不可用', requestId: 'req-ov6-1',
      };
    }
    await render(
      <OverviewView data={data} matrix={{ k: 'loading' }} loading={false} onRetry={() => {}} />,
    );
    expect(container.querySelector('[data-testid="ov6-error"]')?.textContent).toContain('req-ov6-1');
    expect(container.textContent).toContain('没有编造任何数字');
  });
});