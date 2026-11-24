// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OverviewView } from './OverviewPage';
import type { DutyData } from '../duty/useDutyData';
import type { Loadable } from '../duty/types';
import type { HermesSummaryBody } from './api';

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

function view(probe: Loadable<HermesSummaryBody>) {
  return (
    <OverviewView
      data={dataFixture()}
      matrix={{ k: 'ready', data: { items: [] } }}
      loading={false}
      onRetry={() => {}}
      probe={probe}
    />
  );
}

const healthCard = () => container.querySelector('[data-testid="ov6-kpi-health"]');
const healthValue = () => healthCard()?.querySelector('.ov5-kpi-value')?.textContent ?? '';

describe('OM-15 重放·健康卡两段式（服务探针 hermes-summary）', () => {
  it('探针 ok：值走探针态，来源标注 hermes-summary，采集时刻取 gateway.updated_at', async () => {
    await render(
      view(
        ready({
          schema: 'runtime.hermes.summary.v1',
          gateway: { status: 'ok', updated_at: '2026-11-23T15:06:27.261032+00:00' },
        }),
      ),
    );
    expect(healthValue()).toBe('正常');
    const card = healthCard()?.textContent ?? '';
    expect(card).toContain('GET /api/hermes-summary');
    expect(card).toContain('数据截至 2026-11-23 23:06 · 来源 服务探针');
    // 假探针话术绝迹：不再有「n/6 来源正常」计数值。
    expect(card).not.toContain('来源正常');
    // 本页合成状态分列展示，且明说不等于服务健康。
    expect(card).toContain('本页读数合成状态，不等于服务健康');
  });

  it('探针 degraded：值如实「降级」，不改写成正常', async () => {
    await render(
      view(ready({ gateway: { status: 'degraded', updated_at: '2026-11-23T15:06:27.261032+00:00' } })),
    );
    expect(healthValue()).toBe('降级');
  });

  it('探针 503：值「未接」+「服务探针未接入」带请求编号与重试，绝不冒充计数', async () => {
    await render(
      view({ k: 'error', status: 503, message: '探针网关不可达', requestId: 'req-probe-1' }),
    );
    expect(healthValue()).toBe('未接');
    const card = healthCard()?.textContent ?? '';
    expect(card).toContain('服务探针未接入：探针网关不可达');
    expect(card).toContain('req-probe-1');
    expect(healthCard()?.querySelector('[data-testid="ov6-kpi-health-issue-retry"]')).toBeTruthy();
    expect(card).not.toMatch(/\d\/\d/);
  });

  it('探针 ready 但无状态字段：「—」+「不以本页读数冒充」说明，采集时刻如实未知', async () => {
    await render(view(ready({})));
    expect(healthValue()).toBe('—');
    const card = healthCard()?.textContent ?? '';
    expect(card).toContain('服务探针未返回状态；不以本页读数冒充。');
    expect(card).toContain('原因：上游响应没有带采集时间');
  });

  it('探针读取中：不给出任何健康断言，只说数据还在读取', async () => {
    await render(view({ k: 'loading' }));
    expect(healthValue()).toBe('—');
    const card = healthCard()?.textContent ?? '';
    expect(card).toContain('原因：数据还在读取');
    expect(card).not.toMatch(/正常|降级|异常/);
  });
});
