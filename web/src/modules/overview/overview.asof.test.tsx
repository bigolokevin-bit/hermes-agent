// @vitest-environment jsdom
// OM-11 采集时刻纪律：as-of 只认上游自带 asOf；页内永不以浏览器时钟顶替。
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OverviewView, type OverviewState } from './OverviewModulePage';
import type { OverviewSummaryBody } from './api';
import type { Loadable, RunStatsBody } from '../duty/types';

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
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function render(node: ReactNode) {
  await act(async () => {
    root.unmount();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    root.render(<MemoryRouter initialEntries={['/overview']}>{node}</MemoryRouter>);
  });
  await act(async () => {});
}

const ready = <T,>(data: T): Loadable<T> => ({ k: 'ready', data });
const err = (message: string): Loadable<never> => ({
  k: 'error',
  status: 503,
  message,
  requestId: null,
});

function viewState(partial: Partial<OverviewState>): OverviewState {
  return {
    summary: { k: 'loading' },
    today: { k: 'loading' },
    trend: { k: 'loading' },
    ...partial,
  };
}

function summaryWith(asOf: string | null): OverviewSummaryBody {
  const field = { value: 3, source: 'domain GET /v1/employees?limit=100（单页）' };
  return {
    employeeTotal: asOf ? { ...field, asOf } : field,
    activeTotal: asOf ? { ...field, asOf, value: 2 } : { ...field, value: 2 },
    // 现网真形状：顶层自带采集时间，新鲜度行读的就是它。
    ...(asOf ? { asOf, asOfSource: 'bff-aggregation-read-time' } : {}),
  };
}

describe('OM-11 采集时刻纪律', () => {
  it('① 系统时钟前移 24 小时，屏上采集时刻不变（证明不是客户端钟）', async () => {
    await render(
      <OverviewView
        state={viewState({ summary: ready(summaryWith('2026-11-23T11:41:22Z')) })}
        todayDate="2026-11-23"
        onRetry={() => {}}
      />,
    );
    const before = container.querySelector('[data-testid="ov6-kpi-employees-stamp"]')?.textContent;
    expect(before).toContain('2026-11-23 19:41'); // 北京 = UTC+8，来自响应 asOf 原文
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-05-01T00:00:00Z'));
    await render(
      <OverviewView
        state={viewState({ summary: ready(summaryWith('2026-11-23T11:41:22Z')) })}
        todayDate="2026-11-23"
        onRetry={() => {}}
      />,
    );
    const after = container.querySelector('[data-testid="ov6-kpi-employees-stamp"]')?.textContent;
    expect(after).toBe(before);
    expect(after).not.toContain('2027');
  });

  it('② 多来源时刻取最新（R41），不是最先到达的', async () => {
    await render(
      <OverviewView
        state={viewState({
          summary: ready(summaryWith('2026-11-23T11:41:22Z')),
          today: ready({ buckets: [], totals: { runs: 0, failed: 0 }, asOf: '2026-11-23T12:53:15Z' } as RunStatsBody),
        })}
        todayDate="2026-11-23"
        onRetry={() => {}}
      />,
    );
    const asof = container.querySelector('[data-testid="ov6-asof"]');
    expect(asof?.textContent).toContain('2026-11-23 20:53');
    expect(asof?.textContent).not.toContain('19:41');
  });

  it('③ 全腿 error 时 as-of 行仍在 DOM 且值为「—」，不给假时刻（R31 永不缺席）', async () => {
    await render(
      <OverviewView
        state={viewState({
          summary: err('聚合总览不可达'),
          today: err('运行统计不可达'),
          trend: err('趋势窗口不可达'),
        })}
        todayDate="2026-11-23"
        onRetry={() => {}}
      />,
    );
    const asof = container.querySelector('[data-testid="ov6-asof"]');
    expect(asof).toBeTruthy();
    expect(asof?.textContent).toContain('数据截至 —');
    expect(asof?.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('④ ready 但上游没带 asOf：卡内时刻行给「时间未知（原因）」，不拿前端时间补', async () => {
    await render(
      <OverviewView
        state={viewState({ summary: ready(summaryWith(null)) })}
        todayDate="2026-11-23"
        onRetry={() => {}}
      />,
    );
    const stamp = container.querySelector('[data-testid="ov6-kpi-employees-stamp"]');
    expect(stamp?.textContent).toContain('时间未知（上游响应没有带采集时间）');
  });

  it('⑤ loading 态 as-of 行同样在场；原文面板不再印浏览器时钟', async () => {
    await render(<OverviewView state={viewState({})} todayDate="2026-11-23" onRetry={() => {}} />);
    const asof = container.querySelector('[data-testid="ov6-asof"]');
    expect(asof).toBeTruthy();
    expect(asof?.textContent).toContain('数据截至 —');
    const panel = container.querySelector('[data-testid="ov6-source"]');
    expect(panel?.textContent).toContain('页面时间不参与新鲜度判定');
    expect(panel?.textContent).not.toMatch(/页面时间 \d{4}/);
  });
});
