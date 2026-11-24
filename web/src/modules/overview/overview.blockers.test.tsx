// @vitest-environment jsdom
// OM-08 阻塞队列三路诚实线：真值表、空态门、href 三类、读取中无残影、overSLA 与 key 唯一。
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OverviewView } from './OverviewPage';
import { blockerRows } from './overview';
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
const loading = () => ({ k: 'loading' as const });
const errored = (requestId: string) => ({ k: 'error' as const, status: 503, message: '上游不可达', requestId });

const MATRIX = { k: 'ready' as const, data: { items: [] } };

function blockersData(over: Partial<DutyData> = {}): DutyData {
  // 其余腿给真数据：绕开页面级「全空」与「全错」早退分支，只测阻塞卡自身。
  return {
    employees: ready([
      { employeeId: 'emp_1', name: '陈可', lifecycleState: 'active' },
      { employeeId: 'emp_2', name: '林一舟', lifecycleState: 'active' },
    ]),
    stats: ready({ byLifecycle: { active: 1, paused: 1, offboarding: 0 }, asOf: '2026-11-19T04:20:00Z' }),
    todayStats: ready({ totals: { runs: 10, failed: 2, succeeded: 8 } }),
    stats14: ready({ buckets: [] }),
    activity: ready({ cells: [] }),
    budgetDay: ready({ items: [{ employeeId: 'emp_1', costUsd: 1.5 }], missingEmployeeIds: [] }),
    budgetMonth: ready({ items: [], missingEmployeeIds: [] }),
    approvalStats: ready({ pending: 3, dueSoon: 0 }),
    approvals: ready([]),
    todayRuns: ready([]),
    recentRuns: ready([]),
    failedRuns: ready([]),
    blockedTasks: ready([]),
    ...over,
  } as DutyData;
}

async function viewBlockers(over: Partial<DutyData> = {}) {
  await render(
    <OverviewView data={blockersData(over)} matrix={MATRIX as never} loading={false} onRetry={() => {}} />,
  );
  return container.querySelector('[data-testid="ov6-blockers"]') as HTMLElement;
}

const ERROR_LINE = '有阻塞源未接入，下面是已读到的部分，不代表全部。';
const EMPTY_LINE = '当前没有读到阻塞项。';

describe('OM-08 真值表：错误线当且仅当 ≥1 源 error', () => {
  it('三路全 ready（全空）：无错误线，空态出现', async () => {
    const card = await viewBlockers();
    expect(card.textContent).not.toContain(ERROR_LINE);
    expect(card.textContent).toContain(EMPTY_LINE);
  });

  it.each(['failedRuns', 'blockedTasks', 'approvals'] as const)('%s 单独 error：错误线出现且空态不冒充', async (leg) => {
    const card = await viewBlockers({ [leg]: errored(`req-${leg}`) } as Partial<DutyData>);
    expect(card.textContent).toContain(ERROR_LINE);
    expect(card.textContent).not.toContain(EMPTY_LINE);
    expect(card.querySelector('[data-testid="ov6-blockers-reading"]')).toBeTruthy();
  });

  it('三路皆 error：错误线出现（一次），无行无空态', async () => {
    const card = await viewBlockers({
      failedRuns: errored('req-f'),
      blockedTasks: errored('req-t'),
      approvals: errored('req-a'),
    });
    expect(card.textContent).toContain(ERROR_LINE);
    expect(card.textContent).not.toContain(EMPTY_LINE);
    expect(card.querySelectorAll('li')).toHaveLength(0);
  });
});

describe('OM-08 空态门：只在三路全 ready 时写「没有」', () => {
  it('任一源 loading（无 error）：不写空态，写到位状态', async () => {
    const card = await viewBlockers({ approvals: loading() });
    expect(card.textContent).not.toContain(EMPTY_LINE);
    expect(card.querySelector('[data-testid="ov6-blockers-reading"]')).toBeTruthy();
  });
});

describe('OM-08 行内 href 逐类可点', () => {
  it('failed→运行列表、task→任务详情、approval→审批中心带 id', async () => {
    const card = await viewBlockers({
      failedRuns: ready([{ runId: 'rn_bad', employeeId: 'emp_1', status: 'failed', startedAt: '2026-11-19T02:00:00Z' }]),
      blockedTasks: ready([{ taskId: 'tk_x', title: '阻塞任务甲' }]),
      approvals: ready([{ approvalId: 'ap_x', title: '审批乙' }]),
    });
    const hrefs = Array.from(card.querySelectorAll('li a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/runs?status=failed');
    expect(hrefs).toContain('/tasks/tk_x');
    expect(hrefs).toContain('/approvals?id=ap_x');
  });

  it('读取中不画半套行（recentRuns loading 门），也不留残影', async () => {
    const card = await viewBlockers({
      recentRuns: loading(),
      failedRuns: ready([{ runId: 'rn_bad', employeeId: 'emp_1', status: 'failed', startedAt: '2026-11-19T02:00:00Z' }]),
    });
    expect(card.querySelectorAll('li')).toHaveLength(0);
    expect(card.textContent).not.toContain(EMPTY_LINE);
    expect(card.querySelector('[data-testid="ov6-blockers-reading"]')).toBeTruthy();
  });
});

describe('OM-08 blockerRows 口径：overSLA、key 与条数上限', () => {
  it('任务 dueAt 过期→overSLA true，未过期→false；审批 expiresAt 过期→true', () => {
    const rows = blockerRows({
      failedRuns: null,
      blockedTasks: [
        { taskId: 'tk_late', title: '过期任务', dueAt: '2026-11-01T00:00:00Z' },
        { taskId: 'tk_early', title: '远期任务', dueAt: '2099-01-01T00:00:00Z' },
      ],
      approvals: [{ approvalId: 'ap_exp', title: '过期审批', expiresAt: '2026-11-01T00:00:00Z' }],
    });
    const byTitle = new Map(rows.map((r) => [r.object, r]));
    expect(byTitle.get('过期任务')?.overSLA).toBe(true);
    expect(byTitle.get('远期任务')?.overSLA).toBe(false);
    expect(byTitle.get('过期审批')?.overSLA).toBe(true);
    const keys = rows.map((r) => `${r.responsibleModule}-${r.object}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('失败运行合成一条分组行，href 指向失败列表', () => {
    const rows = blockerRows({
      failedRuns: [
        { runId: 'rn_1', employeeId: 'emp_1', status: 'failed', startedAt: '2026-11-19T02:00:00Z' },
        { runId: 'rn_2', employeeId: 'emp_2', status: 'failed', startedAt: '2026-11-19T03:00:00Z' },
      ],
      blockedTasks: null,
      approvals: null,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].object).toBe('2 次运行失败');
    expect(rows[0].href).toBe('/runs?status=failed');
    expect(rows[0].responsibleModule).toBe('运行');
  });

  it('渲染至多三条行（slice 上限在数据层），badge 文案为责任模块', async () => {
    const many = ['一', '二', '三', '四'].map((n) => ({ taskId: `tk_${n}`, title: `任务${n}` }));
    const card = await viewBlockers({ blockedTasks: ready(many as never) });
    const lis = card.querySelectorAll('li');
    expect(lis.length).toBeLessThanOrEqual(3);
    expect(lis.length).toBeGreaterThan(0);
    expect(lis[0].textContent).toContain('任务');
  });
});
