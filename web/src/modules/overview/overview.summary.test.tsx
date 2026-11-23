// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OverviewView } from './OverviewPage';
import { overviewSummaryText } from './overview';
import { COST_CALIBER_TEXT } from '../metrics/costCaliberNote';
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
  vi.restoreAllMocks();
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
    stats14: ready({ asOf: '2026-11-19T04:22:00Z', buckets: [] }),
    activity: ready({ cells: [] }),
    budgetDay: ready({ items: [{ employeeId: 'emp_1', costUsd: 1.5 }, { employeeId: 'emp_2', costUsd: 0 }], missingEmployeeIds: [], asOf: '2026-11-19T04:23:00Z' }),
    budgetMonth: ready({ items: [], missingEmployeeIds: [] }),
    approvalStats: ready({ pending: 3, dueSoon: 1, asOf: '2026-11-19T04:24:00Z' }),
    approvals: ready([]),
    todayRuns: ready([]),
    recentRuns: ready([]),
    failedRuns: ready([]),
    blockedTasks: ready([]),
  };
}

const matrixReady: Loadable<{ rows: unknown[] }> = ready({ rows: [] });
const probeOk = ready({
  schema: 'runtime.hermes.summary.v1',
  gateway: { status: 'ok', updated_at: '2026-11-23T15:06:27.261032+00:00' },
});

describe('OM-13 overviewSummaryText（纯函数）', () => {
  it('① 逐字拼装：标题/数据截至/卡行/成本口径，缺值为「—」', () => {
    const text = overviewSummaryText({
      asOf: '2026-11-23 23:06',
      rows: [
        { label: '待审批', value: '3', source: '审批统计', stamp: '2026-11-19 12:24' },
        { label: '今日成本', value: '—', source: null, stamp: null },
      ],
      costCaliber: COST_CALIBER_TEXT,
    });
    expect(text).toBe(
      [
        '运营总览摘要',
        '数据截至 2026-11-23 23:06（北京时间）',
        '- 待审批：3｜来源 审批统计｜采集时刻 2026-11-19 12:24',
        '- 今日成本：—｜来源 —｜采集时刻 —',
        `成本口径：${COST_CALIBER_TEXT}`,
      ].join('\n'),
    );
  });

  it('② 纯函数零请求：调用期间 fetch 桩不被触碰', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    overviewSummaryText({ asOf: null, rows: [{ label: '员工', value: '—', source: null, stamp: null }] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('③ 复制成功：writeText 收到含五卡行与成本口径全文', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await render(
      <OverviewView data={dataFixture()} matrix={matrixReady as never} probe={probeOk as never} loading={false} onRetry={() => {}} />,
    );
    const btn = container.querySelector<HTMLButtonElement>('[data-testid="ov6-summary-copy"]');
    expect(btn).toBeTruthy();
    await act(async () => {
      btn?.click();
    });
    expect(container.querySelector('[data-testid="ov6-summary-copy-ok"]')).toBeTruthy();
    expect(writeText).toHaveBeenCalledTimes(1);
    const arg = String((writeText.mock.calls[0] as unknown[] | undefined)?.[0] ?? '');
    expect(arg).toContain('运营总览摘要');
    expect(arg).toContain('- 员工：在编 2 · 在岗 1 · 有风险 —');
    expect(arg).toContain('- 今日运行：今日 10 · 失败 2 · 失败率 20%');
    expect(arg).toContain('- 待审批：3');
    expect(arg).toContain('- 今日成本：$1.50');
    expect(arg).toContain('- 健康检查（服务探针）：正常｜来源 GET /api/hermes-summary');
    expect(arg).toContain('采集时刻 2026-11-23 23:06');
    expect(arg).toContain(`成本口径：${COST_CALIBER_TEXT}`);
    expect(fetchMock).not.toHaveBeenCalled(); // 复制不产生新请求
  });

  it('④ 复制失败：给可选中文本兜底，不假装成功', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(async () => { throw new Error('denied'); }) },
      configurable: true,
    });
    await render(
      <OverviewView data={dataFixture()} matrix={matrixReady as never} probe={probeOk as never} loading={false} onRetry={() => {}} />,
    );
    const btn = container.querySelector<HTMLButtonElement>('[data-testid="ov6-summary-copy"]');
    await act(async () => {
      btn?.click();
    });
    expect(container.querySelector('[data-testid="ov6-summary-copy-ok"]')).toBeNull();
    expect(container.querySelector('[data-testid="ov6-summary-copy-fail"]')).toBeTruthy();
    const ta = container.querySelector<HTMLTextAreaElement>('[data-testid="ov6-summary-fallback"]');
    expect(ta?.value).toContain('运营总览摘要');
    expect(ta?.value).toContain('成本口径：');
  });

  it('⑤ 成本句与 metrics 单源逐字同（无第二套词汇）', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await render(
      <OverviewView data={dataFixture()} matrix={matrixReady as never} probe={probeOk as never} loading={false} onRetry={() => {}} />,
    );
    const btn = container.querySelector<HTMLButtonElement>('[data-testid="ov6-summary-copy"]');
    await act(async () => {
      btn?.click();
    });
    const arg = String((writeText.mock.calls[0] as unknown[] | undefined)?.[0] ?? '');
    const costLine = arg.split('\n').find((l) => l.startsWith('成本口径：')) ?? '';
    expect(costLine).toBe(`成本口径：${COST_CALIBER_TEXT}`);
  });
});
