// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OverviewView } from './OverviewPage';
import type { DutyData } from '../duty/useDutyData';
import type { ApprovalStatsBody, Loadable } from '../duty/types';

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

/** 其余腿保持就绪有数，只有待审批腿按用例换形制，空页早退不会劫持断言。 */
function dataFixture(approvalStats: Loadable<ApprovalStatsBody>): DutyData {
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
    approvalStats,
    approvals: ready([]),
    todayRuns: ready([]),
    recentRuns: ready([{ runId: 'run_1', employeeId: 'emp_1', status: 'failed', startedAt: '2026-11-19T02:00:00Z' }]),
    failedRuns: ready([{ runId: 'run_1', employeeId: 'emp_1', status: 'failed', startedAt: '2026-11-19T02:00:00Z' }]),
    blockedTasks: ready([]),
  };
}

function view(approvalStats: Loadable<ApprovalStatsBody>) {
  return (
    <OverviewView
      data={dataFixture(approvalStats)}
      matrix={{ k: 'ready', data: { items: [] } }}
      loading={false}
      onRetry={() => {}}
      probe={{ k: 'ready', data: { schema: 'runtime.hermes.summary.v1', gateway: { status: 'ok', updated_at: '2026-11-23T15:06:27.261032+00:00' } } }}
    />
  );
}

const seg = () => container.querySelector('[data-testid="ov6-pending-seg"]');
const dot = () => container.querySelector('[data-testid="ov6-pending-seg"] .ov5-dot');
const pendingCard = () => container.querySelector('[data-testid="ov6-kpi-pending"]');

describe('OM-19 审批视角真零 + tone-attention（T2D 件2）', () => {
  it('真 0：seg 必带 tone-success，dot data-appearance=success，不是裸 0', async () => {
    await render(view(ready({ pending: 0, asOf: '2026-11-19T04:24:00Z' })));
    expect(seg()?.getAttribute('class')).toContain('tone-success');
    expect(seg()?.getAttribute('class')).not.toContain('tone-attention');
    expect(dot()?.getAttribute('data-appearance')).toBe('success');
    expect(seg()?.textContent).toContain('0');
    expect(pendingCard()?.textContent).not.toContain('未接入');
  });

  it('有数（pending>0）：tone-attention + appearance=attention', async () => {
    await render(view(ready({ pending: 3, dueSoon: 1, asOf: '2026-11-19T04:24:00Z' })));
    expect(seg()?.getAttribute('class')).toContain('tone-attention');
    expect(dot()?.getAttribute('data-appearance')).toBe('attention');
    expect(seg()?.textContent).toContain('3');
  });

  it('partial 明说降级覆盖：degraded 透传上屏，不编覆盖率分母；真 0+降级仍是 success 绿', async () => {
    await render(view(ready({ pending: 2, degraded: ['audit', 'sla'], asOf: '2026-11-19T04:24:00Z' })));
    const text = pendingCard()?.textContent ?? '';
    expect(text).toContain('上游降级 2 路（audit、sla）');
    expect(text).toContain('只覆盖已接通上游');
    expect(text).not.toMatch(/覆盖率\s*\d+%/);
    expect(seg()?.textContent).toContain('2');

    await render(view(ready({ pending: 0, degraded: ['audit'], asOf: '2026-11-19T04:24:00Z' })));
    expect(seg()?.getAttribute('class')).toContain('tone-success');
    expect(dot()?.getAttribute('data-appearance')).toBe('success');
    expect(pendingCard()?.textContent).toContain('上游降级 1 路');
  });

  it('故障≠真零：error 说未接入，seg 走 appearance=missing，绝不 tone-success', async () => {
    await render(view({ k: 'error', status: 503, message: '队列上游不可达', requestId: 'req-pd-1' }));
    expect(pendingCard()?.textContent).toContain('审批统计未接入：队列上游不可达');
    expect(seg()?.getAttribute('class') ?? '').not.toContain('tone-success');
    expect(dot()?.getAttribute('data-appearance')).toBe('missing');
  });

  it('读取中不吐 0：available 未到前 appearance=missing，屏上是「—」', async () => {
    await render(view({ k: 'loading' }));
    expect(dot()?.getAttribute('data-appearance')).toBe('missing');
    expect(seg()?.textContent).toContain('—');
    expect(seg()?.textContent).not.toContain('0');
  });

  it('dot/seg 类名零 bg-*-900 硬色（T2D 纪律）', async () => {
    await render(view(ready({ pending: 0 })));
    expect(seg()?.getAttribute('class') ?? '').not.toMatch(/bg-.*900/);
    expect(dot()?.getAttribute('class') ?? '').not.toMatch(/bg-.*900/);
  });
});
