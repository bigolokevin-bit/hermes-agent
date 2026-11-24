// @vitest-environment jsdom
// OM-11 采集时刻纪律：屏上时刻只认上游 asOf，浏览器时钟永不顶替；三态 as-of 在场；与 metrics 侧换算逐字同。
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OverviewView } from './OverviewPage';
import { sourceStamp } from './overview';
import { asOfText } from '../metrics/asof';
import type { DutyData } from '../duty/useDutyData';
import type { Loadable } from '../duty/types';

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
  vi.useRealTimers();
});

async function render(node: ReactNode, path = '/overview') {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>);
  });
  await act(async () => {});
}

const ready = <T,>(data: T) => ({ k: 'ready' as const, data });
const loading = () => ({ k: 'loading' }) as Loadable<never>;
const errored = (requestId: string) =>
  ({ k: 'error', status: 503, message: '上游不可达', requestId }) as Loadable<never>;

const MATRIX = { k: 'ready' as const, data: { items: [] } };

function timedFixture(): DutyData {
  return {
    employees: ready([
      { employeeId: 'emp_1', name: '陈可', lifecycleState: 'active' },
      { employeeId: 'emp_2', name: '林一舟', lifecycleState: 'active' },
    ]),
    stats: ready({ byLifecycle: { active: 1, paused: 1, offboarding: 0 }, asOf: '2026-11-19T04:20:00Z' }),
    todayStats: ready({ totals: { runs: 10, failed: 2, succeeded: 8 }, asOf: '2026-11-19T04:21:00Z' }),
    stats14: ready({ buckets: [], asOf: '2026-11-19T04:22:00Z' }),
    activity: ready({ cells: [] }),
    budgetDay: ready({ items: [{ employeeId: 'emp_1', costUsd: 1.5 }], missingEmployeeIds: [], asOf: '2026-11-19T04:23:00Z' }),
    budgetMonth: ready({ items: [], missingEmployeeIds: [] }),
    approvalStats: ready({ pending: 3, dueSoon: 0, asOf: '2026-11-19T04:24:00Z' }),
    approvals: ready([]),
    todayRuns: ready([]),
    recentRuns: ready([]),
    failedRuns: ready([]),
    blockedTasks: ready([]),
  } as unknown as DutyData;
}

async function viewAsof(data: DutyData) {
  await render(<OverviewView data={data} matrix={MATRIX as never} loading={false} onRetry={() => {}} />);
  return container.querySelector('[data-testid="ov6-asof"]') as HTMLElement;
}

describe('OM-11 只认上游 asOf', () => {
  it('系统时钟拨前 24h：屏上采集时刻逐字不变，也不出现漂移日', async () => {
    const baseline = await viewAsof(timedFixture());
    const baselineText = baseline.textContent;
    expect(baselineText).toContain('2026-11-19 12:24');

    vi.useFakeTimers({ now: new Date('2026-11-20T12:30:00Z') });
    act(() => root.unmount());
    container.remove();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const shifted = await viewAsof(timedFixture());
    expect(shifted.textContent).toBe(baselineText);
    expect(shifted.textContent).not.toContain('2026-11-20');
  });

  it('R41 多源取最新：as-of 行只挂最大分钟，不挂旧值', async () => {
    const line = await viewAsof(timedFixture());
    expect(line.textContent).toContain('2026-11-19 12:24');
    expect(line.textContent).not.toContain('12:20');
    expect(line.textContent).not.toContain('12:21');
  });

  it('与 metrics 侧换算逐字同（跨页 parity）：同一 ISO 两页同一分钟串', () => {
    const iso = '2026-11-19T04:24:00Z';
    const overviewShown = sourceStamp(ready({ asOf: iso })).shown;
    expect(overviewShown).toBe(asOfText(iso));
    expect(overviewShown).toBe('2026-11-19 12:24');
    const empty = sourceStamp(ready({ totals: {} })).shown;
    expect(empty).toBeNull();
    expect(asOfText(null)).toBe('—');
  });
});

describe('OM-11 as-of 行三态永不缺席', () => {
  it('ready：显示上游分钟', async () => {
    const line = await viewAsof(timedFixture());
    expect(line.textContent).toMatch(/北京时间 2026-11-19 12:24/);
  });

  it('loading：值写「—」且 title 给原因，不拿浏览器时钟顶替', async () => {
    const data = timedFixture();
    data.employees = loading();
    data.stats = loading();
    data.todayStats = loading();
    data.approvalStats = loading();
    data.budgetDay = loading();
    const line = await viewAsof(data);
    expect(line.textContent).toContain('采集时刻 —（北京时间）');
    expect(line.getAttribute('title') ?? '').toContain('取不到采集时间：');
  });

  it('error：全源失败时 as-of 行仍在 DOM 且值为「—」', async () => {
    const data = timedFixture();
    data.employees = errored('req-e1');
    data.stats = errored('req-e2');
    data.todayStats = errored('req-e3');
    data.approvalStats = errored('req-e4');
    data.budgetDay = errored('req-e5');
    const line = await viewAsof(data);
    expect(line).toBeTruthy();
    expect(line.textContent).toContain('采集时刻 —（北京时间）');
  });
});
