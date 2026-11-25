// @vitest-environment jsdom
// OM-05：KPI 缺失/错误态测试面补齐。
// 每个 GAP 编号至少一条点名断言：error 态与 ready-缺字段态分开钉；
// 主数字未知时写「—」（禁裸破折号、禁空串、禁 0）；每条 issue 带 gap title 与可复制 rid。
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OverviewPage, OverviewView } from './OverviewPage';
import type { DutyData } from '../duty/useDutyData';
import { OVERVIEW_GAP } from './overview';

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
  vi.unstubAllGlobals();
});

async function render(node: ReactNode, path = '/overview') {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>);
  });
  await act(async () => {});
}

const ready = <T,>(data: T) => ({ k: 'ready' as const, data });
const err = (status: number, message: string, requestId: string | null) => ({ k: 'error' as const, status, message, requestId });

function base(): DutyData {
  return {
    employees: ready([
      { employeeId: 'emp_1', name: '陈可', lifecycleState: 'active' },
      { employeeId: 'emp_2', name: '林一舟', lifecycleState: 'active' },
    ]),
    stats: ready({ total: 2, byLifecycle: { active: 1, paused: 1, offboarding: 0 }, asOf: '2026-11-19T04:20:00Z' }),
    todayStats: ready({ totals: { runs: 10, failed: 2, succeeded: 8 }, asOf: '2026-11-19T04:21:00Z' }),
    stats14: ready({ asOf: '2026-11-19T04:22:00Z', buckets: [{ bucketStart: '2026-11-18T16:00:00Z', runs: 4, failed: 1 }] }),
    activity: ready({ cells: [] }),
    budgetDay: ready({ items: [{ employeeId: 'emp_1', costUsd: 1.5 }, { employeeId: 'emp_2', costUsd: 0 }], missingEmployeeIds: [], asOf: '2026-11-19T04:23:00Z' }),
    budgetMonth: ready({ items: [{ employeeId: 'emp_1', costUsd: 12 }, { employeeId: 'emp_2', costUsd: 0 }], missingEmployeeIds: [] }),
    approvalStats: ready({ pending: 3, dueSoon: 1, asOf: '2026-11-19T04:24:00Z' }),
    approvals: ready([{ approvalId: 'a1', title: '开通频道' }]),
    todayRuns: ready([]),
    recentRuns: ready([]),
    failedRuns: ready([]),
    blockedTasks: ready([]),
  };
}

const card = (id: string) => container.querySelector(`[data-testid="${id}"]`);
const valueText = (id: string) => card(id)?.querySelector('.ov5-kpi-value')?.textContent ?? '';
const issues = () => Array.from(container.querySelectorAll('.ov5-kpi-issue')) as HTMLElement[];

function view(data: DutyData, matrix: unknown = ready({ items: [] }), onRetry = () => {}) {
  return <OverviewView data={data} matrix={matrix as never} loading={false} onRetry={onRetry} />;
}

describe('OM-05 GAP-OV5-EMPLOYEES：员工目录错误与连坐', () => {
  it('employees error → 员工卡值恰「—」、issue 行带 gap 号与 rid、重试可点', async () => {
    const onRetry = vi.fn();
    const data = base();
    data.employees = err(500, '员工目录暂时读不到', 'req-emp-1') as never;
    data.stats = err(500, '员工统计暂时读不到', 'req-emp-1b') as never;
    await render(view(data, ready({ items: [] }), onRetry));
    const emp = card('ov6-kpi-employees')!;
    expect(emp.querySelector('.ov5-kpi-value')!.textContent).toBe('—');
    const row = emp.querySelector('.ov5-kpi-issue') as HTMLElement;
    expect(row.title).toBe(OVERVIEW_GAP.employees);
    expect(row.textContent).toContain('员工统计未接入：员工目录暂时读不到');
    expect(row.textContent).toContain('req-emp-1');
    await act(async () => {
      (emp.querySelector('[data-testid="ov6-kpi-employees-issue-retry"]') as HTMLButtonElement).click();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('employees error 连坐预算腿：成本卡 issue 行沿用同一失败与 rid（不另编来源）', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const u = String(input);
      urls.push(u);
      if (u.includes('/employees') && !u.includes('/employee-stats')) {
        return { ok: false, status: 500, statusText: 'boom', headers: new Headers({ 'content-type': 'application/json', 'x-request-id': 'req-emp-9' }), json: async () => ({ code: 'boom' }), text: async () => '{}' } as Response;
      }
      return { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({}), text: async () => '{}' } as Response;
    }));
    await render(<OverviewPage />);
    const cost = card('ov6-kpi-cost')!;
    expect(cost.querySelector('.ov5-kpi-value')!.textContent).toBe('—');
    const row = cost.querySelector('.ov5-kpi-issue') as HTMLElement;
    expect(row.textContent).toContain('成本账本未接入');
    expect(row.textContent).toContain('req-emp-9');
    expect(row.title).toBe(OVERVIEW_GAP.cost);
    // 预算腿本身一次都没请求：连坐失败来自目录腿，不发无根请求。
    expect(urls.filter((u) => u.includes('/budget-usage'))).toHaveLength(0);
  });

  it('stats ready 但缺 byLifecycle → 交集判不出就整段留「—」，不补 0', async () => {
    const data = base();
    data.stats = ready({ total: 2, asOf: '2026-11-19T04:20:00Z' }) as never;
    await render(view(data));
    const emp = card('ov6-kpi-employees')!;
    expect(emp.querySelector('.ov5-kpi-value')!.textContent).toBe('—');
    // 交集判不出时「受限 0」是假读数（0 人在此＝没判，不是没人受限）⇒ 副行整句省略。
    const sub = emp.querySelector('[data-testid="ov6-kpi-employees-sub"]')!.textContent;
    expect(sub).toBe('—');
    expect(sub).not.toContain('受限');
  });
});

describe('OM-05 GAP-OV5-RISK：风险矩阵缺与错', () => {
  it('matrix ready 但 items 缺口径 → 带底缺读口声明点名「风险口径」', async () => {
    await render(view(base(), ready({}) as never));
    const emp = card('ov6-kpi-employees')!;
    const gaps = container.querySelector('[data-testid="ov6-kpi-gaps"]') as HTMLElement;
    expect(gaps.textContent).toContain('风险口径');
    expect(emp.querySelector('[data-testid="ov6-kpi-employees-status"]')?.getAttribute('title')).toContain('数据源');
  });

  it('matrix error → issue 行「风险矩阵未接入」带 rid 与 GAP-OV5-RISK', async () => {
    await render(view(base(), err(503, '风险矩阵不可用', 'req-mx-2') as never));
    const row = card('ov6-kpi-employees')!.querySelector('.ov5-kpi-issue') as HTMLElement;
    expect(row.title).toBe(OVERVIEW_GAP.risk);
    expect(row.textContent).toContain('风险矩阵未接入：风险矩阵不可用');
    expect(row.textContent).toContain('req-mx-2');
  });
});

describe('OM-05 GAP-OV5-RUNS：运行统计缺与错', () => {
  it('todayStats error → 今日运行「—」，issue 带 GAP-OV5-RUNS 与 rid', async () => {
    const data = base();
    data.todayStats = err(502, '运行统计网关超时', 'req-run-3') as never;
    await render(view(data));
    expect(valueText('ov6-kpi-runs')).toBe('—');
    const row = card('ov6-kpi-runs')!.querySelector('.ov5-kpi-issue') as HTMLElement;
    expect(row.title).toBe(OVERVIEW_GAP.runs);
    expect(row.textContent).toContain('运行统计未接入：运行统计网关超时');
    expect(row.textContent).toContain('req-run-3');
  });

  it('todayStats ready 缺 totals.runs → 值「—」；runs=0 且失败率无定义 → note 说明不算失败率', async () => {
    const missing = base();
    missing.todayStats = ready({ totals: {}, asOf: '2026-11-19T04:21:00Z' }) as never;
    await render(view(missing));
    expect(valueText('ov6-kpi-runs')).toBe('—');
    act(() => root.unmount());
    root = createRoot(container);
    const zero = base();
    zero.todayStats = ready({ totals: { runs: 0, failed: 0 }, asOf: '2026-11-19T04:21:00Z' }) as never;
    await render(view(zero));
    expect(valueText('ov6-kpi-runs')).toBe('0'); // 真 0 允许显示 0
    // round9：失败率没有分母就整项不渲染（不写「不计算」），读数行只留在跑/失败。
    const foot = card('ov6-kpi-runs')!.querySelector('.ov5-kpi-foot')!.textContent ?? '';
    expect(foot).toContain('在跑 0');
    expect(foot).toContain('失败 0');
    expect(foot).not.toContain('失败率');
  });
});

describe('OM-05 GAP-OV5-APPROVALS：审批统计缺与错', () => {
  it('approvalStats error → 待审批「—」，issue 行带 gap 号、rid、重试钮', async () => {
    const onRetry = vi.fn();
    const data = base();
    data.approvalStats = err(500, '审批统计读不到', 'req-ap-4') as never;
    await render(view(data, ready({ items: [] }), onRetry));
    expect(card('ov6-kpi-pending')!.textContent).toContain('— 待批');
    const row = card('ov6-kpi-pending')!.querySelector('.ov5-kpi-issue') as HTMLElement;
    expect(row.title).toBe(OVERVIEW_GAP.approvals);
    expect(row.textContent).toContain('审批统计未接入：审批统计读不到');
    expect(row.textContent).toContain('req-ap-4');
    expect(card('ov6-kpi-pending')!.querySelector('[data-testid="ov6-kpi-pending-issue-retry"]')).toBeTruthy();
  });

  it('approvalStats ready 但缺 pending 字段 → 「—」，不以 0 冒充', async () => {
    const data = base();
    data.approvalStats = ready({ dueSoon: 1 }) as never;
    await render(view(data));
    expect(card('ov6-kpi-pending')!.textContent).toContain('— 待批');
  });
});

describe('OM-05 GAP-OV5-COST：成本账本缺与错', () => {
  it('budgetDay error → 成本「—」＋note「成本口径未齐」带 gap title，issue 带 rid', async () => {
    const data = base();
    data.budgetDay = err(500, '账本服务不可用', 'req-cost-5') as never;
    await render(view(data));
    expect(valueText('ov6-kpi-cost')).toBe('—');
    const row = card('ov6-kpi-cost')!.querySelector('.ov5-kpi-issue') as HTMLElement;
    expect(row.title).toBe(OVERVIEW_GAP.cost);
    expect(row.textContent).toContain('req-cost-5');
    const gaps = container.querySelector('[data-testid="ov6-kpi-gaps"]') as HTMLElement;
    expect(gaps.textContent).toContain('本月实扣');
    expect(card('ov6-kpi-cost')!.querySelector('[data-testid="ov6-kpi-cost-status"]')?.getAttribute('title')).toContain('数据源');
  });

  it('budgetDay ready 但形状缺失 → 「—」而非 $0.00', async () => {
    const data = base();
    data.budgetDay = ready({ asOf: '2026-11-19T04:23:00Z' }) as never;
    await render(view(data));
    expect(valueText('ov6-kpi-cost')).toBe('—');
  });
});

describe('OM-05 issue 行通规', () => {
  it('五路全坏时每条可见 issue 行都带 GAP-OV5-* title（无裸 issue）', async () => {
    const data = base();
    data.employees = err(500, '目录坏', 'r1') as never;
    data.todayStats = err(502, '运行坏', 'r2') as never;
    data.approvalStats = err(500, '审批坏', 'r3') as never;
    data.budgetDay = err(500, '账本坏', 'r4') as never;
    await render(view(data, err(503, '矩阵坏', 'r5') as never));
    const rows = issues();
    expect(rows.length).toBeGreaterThanOrEqual(5);
    for (const row of rows) {
      expect(row.getAttribute('title')).toMatch(/^GAP-OV5-/);
    }
  });
});
