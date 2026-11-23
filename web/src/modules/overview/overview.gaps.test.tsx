// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OverviewView } from './OverviewModulePage';
import type { OverviewSummaryBody } from './api';
import type { Loadable, RunStatsBody } from '../duty/types';

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
  vi.restoreAllMocks();
});

async function render(node: ReactNode) {
  await act(async () => {
    root.render(<MemoryRouter>{node}</MemoryRouter>);
  });
  await act(async () => {});
}

const ready = <T,>(data: T): Loadable<T> => ({ k: 'ready', data });

const err = (message: string, requestId: string): Loadable<never> => ({
  k: 'error',
  status: 503,
  message,
  requestId,
});

const TODAY: RunStatsBody = {
  buckets: [],
  totals: { runs: 10, failed: 2 },
  asOf: '2026-11-23T11:41:23Z',
} as RunStatsBody;

const TREND: RunStatsBody = { buckets: [], totals: { runs: 0 }, asOf: '2026-11-23T11:41:24Z' } as RunStatsBody;

function view(summary: Loadable<OverviewSummaryBody>, today: Loadable<RunStatsBody> = ready(TODAY)) {
  return <OverviewView state={{ summary, today, trend: ready(TREND) }} todayDate="2026-11-23" onRetry={() => {}} />;
}

const CARDS = ['employees', 'runs', 'pending', 'cost', 'health'] as const;

describe('OM-05 KPI 缺字段/错误态诚实线（ready-缺字段 ≠ error）', () => {
  it('summary 就绪但字段全缺：五卡值恰为「未接」，空串与假 0 都禁止', async () => {
    await render(view(ready({})));
    for (const id of CARDS) {
      const value = container.querySelector(`[data-testid="ov6-kpi-${id}-value"]`);
      expect(value, id).toBeTruthy();
      expect(value!.textContent, id).toBe('未接');
      expect(value!.textContent!.trim(), id).not.toBe('');
      expect(container.querySelector(`[data-testid="ov6-kpi-${id}"]`)!.textContent).not.toContain('$0.00');
    }
    // 缺字段不是链路故障：卡面不出现「未接入」issue
    expect(container.querySelectorAll('[data-testid$="-issue"]').length).toBe(0);
    // 但每张卡给出未接原因
    expect(container.querySelector('[data-testid="ov6-kpi-pending-note"]')?.textContent)
      .toContain('不以 0 冒充');
  });

  it('部分缺字段：有值的卡照常显示，缺的卡逐卡说明不冒充', async () => {
    await render(view(ready({ employeeTotal: { value: 3, source: 'domain GET /v1/employees?limit=100（单页）' } })));
    expect(container.querySelector('[data-testid="ov6-kpi-employees-value"]')?.textContent).toBe('3');
    expect(container.querySelector('[data-testid="ov6-kpi-runs-value"]')?.textContent).toBe('未接');
    expect(container.querySelector('[data-testid="ov6-kpi-runs-note"]')?.textContent)
      .toContain('未用 run-stats 桶合计冒充');
    expect(container.querySelector('[data-testid="ov6-kpi-employees"]')?.textContent).toContain('在岗 未接');
  });

  it('链路 error 与字段缺失话术分开：error 走「未接入」+请求编号+重试', async () => {
    await render(view(err('聚合总览链路失败', 'req-gap-1') as Loadable<OverviewSummaryBody>));
    const issue = container.querySelector('[data-testid="ov6-kpi-employees-issue"]');
    expect(issue).toBeTruthy();
    expect(issue!.textContent).toContain('聚合总览未接入：聚合总览链路失败');
    expect(issue!.textContent).toContain('req-gap-1');
    expect(container.querySelector('[data-testid="ov6-kpi-employees-issue-retry"]')).toBeTruthy();
    // error 态不渲染「置 null，不以 0 冒充」的缺字段注释
    expect(container.querySelector('[data-testid="ov6-kpi-employees-note"]')).toBeNull();
  });

  it('run-stats 今日窗缺 failed/无 totals：失败与失败率各自标未接，不算 0%', async () => {
    await render(view(ready({ todayRuns: { value: 5, source: 'runtime GET /v1/runs/stats（from/to=北京日窗 bucket=day）' } }),
      ready({ buckets: [], asOf: '2026-11-23T11:41:23Z' } as RunStatsBody)));
    const foot = container.querySelector('[data-testid="ov6-runs-detail"]');
    expect(foot?.textContent).toContain('失败 未接');
    expect(foot?.textContent).toContain('失败率 未接');
    expect(foot?.textContent).not.toContain('0%');
    expect(container.querySelector('[data-testid="ov6-kpi-runs-value"]')?.textContent).toBe('5');
  });

  it('健康状态字段缺失：值「未接」且不以本页取数成败计数冒充', async () => {
    await render(view(ready({ employeeTotal: { value: 3, source: 's' }, activeTotal: { value: 2, source: 's' }, todayRuns: { value: 0, source: 'runtime GET /v1/runs/stats（from/to=北京日窗 bucket=day）' }, pendingApprovals: { value: 0, source: 'domain GET /v1/approvals?status=pending&scope=tenant（租户收件箱）' }, todayCostUsd: { value: 0, source: 'runtime GET /v1/runs/stats（from/to=北京日窗 bucket=day）' } })));
    expect(container.querySelector('[data-testid="ov6-kpi-health-value"]')?.textContent).toBe('未接');
    expect(container.textContent).not.toMatch(/\d\/6\s*来源正常/);
  });
});
