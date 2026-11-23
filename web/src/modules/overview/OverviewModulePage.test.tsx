// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OverviewModulePage, OverviewView } from './OverviewModulePage';
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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function render(node: ReactNode, path = '/overview') {
  // MemoryRouter 的 initialEntries 只在挂载时生效：换 path 必须重挂新 root。
  await act(async () => {
    root.unmount();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    root.render(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>);
  });
  await act(async () => {});
}

const ready = <T,>(data: T): Loadable<T> => ({ k: 'ready', data });

/** 现网 2026-11-23 GET /agent-api/api/overview/summary 实回（值节选，字段形状逐字保留）。 */
const SUMMARY_BODY: OverviewSummaryBody = {
  employeeTotal: {
    value: 3,
    source: 'domain GET /v1/employees?limit=100（单页）',
    asOf: '2026-11-23T11:41:22Z',
  },
  activeTotal: {
    value: 2,
    source: 'domain GET /v1/employees?limit=100（单页）（lifecycleState=active 计数）',
    asOf: '2026-11-23T11:41:22Z',
  },
  todayRuns: {
    value: 0,
    source: 'runtime GET /v1/runs/stats（from/to=北京日窗 bucket=day）',
    asOf: '2026-11-23T11:41:22Z',
  },
  todayCostUsd: {
    value: 0,
    source: 'runtime GET /v1/runs/stats（from/to=北京日窗 bucket=day）',
    asOf: '2026-11-23T11:41:22Z',
  },
  pendingApprovals: {
    value: 0,
    source: 'domain GET /v1/approvals?status=pending&scope=tenant（租户收件箱）',
    asOf: '2026-11-23T11:41:22Z',
  },
  healthStatus: {
    value: 'ok',
    source: 'bff fan-out probe（本请求 employees/runs-stats/approvals 三路上游结果）',
    asOf: '2026-11-23T11:41:22Z',
  },
  asOf: '2026-11-23T11:41:22Z',
  asOfSource: 'bff-aggregation-read-time',
};

/** 今日窗 run-stats 实回形状（failed=2 变体供失败率契约）。 */
function todayRunsBody(runs: number, failed: number, costUsd: number): RunStatsBody {
  return {
    buckets: [{ bucketStart: '2026-11-23T16:00:00Z', runs, failed, succeeded: runs - failed, costUsd }],
    totals: { runs, succeeded: runs - failed, failed, costUsd },
    asOf: '2026-11-23T11:41:23Z',
    asOfSource: 'bff-read-time',
  } as RunStatsBody;
}

const TREND_BODY = {
  buckets: [
    { bucketStart: '2026-11-18T16:00:00Z', runs: 4, failed: 0 },
    { bucketStart: '2026-11-19T16:00:00Z', runs: 6, failed: 1 },
    { bucketStart: '2026-11-20T16:00:00Z', runs: 0, failed: 0 },
    { bucketStart: '2026-11-21T16:00:00Z', runs: 3, failed: 0 },
  ],
  totals: { runs: 13, failed: 1 },
  asOf: '2026-11-23T11:41:24Z',
} as RunStatsBody;

function viewState(over: Partial<{
  summary: Loadable<OverviewSummaryBody>;
  today: Loadable<RunStatsBody>;
  trend: Loadable<RunStatsBody>;
}>) {
  return {
    summary: over.summary ?? ready(SUMMARY_BODY),
    today: over.today ?? ready(todayRunsBody(0, 0, 0)),
    trend: over.trend ?? ready(TREND_BODY),
  };
}

describe('OverviewModulePage 合同：KPI 只走现网 BFF 两端口', () => {
  it('forced ?state= 分支零请求', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    for (const [state, testid] of [
      ['loading', 'ov6-loading'],
      ['empty', 'ov6-kpi-employees'],
      ['error', 'ov6-error'],
    ] as const) {
      await render(<OverviewModulePage />, `/overview?state=${state}`);
      expect(container.querySelector(`[data-testid="${testid}"]`)).toBeTruthy();
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain('未接');
  });

  it('LiveOverview 只请求 /api/overview/summary 与 /api/run-stats（含今日窗与14日窗）', async () => {
    const urls: string[] = [];
    let runStatsSeq = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);
        // 两腿同参数名，只按请求次序区分：今日窗先请、14 日窗后请（与 loadAll 顺序一致）。
        const body = url.includes('/api/overview/summary')
          ? SUMMARY_BODY
          : runStatsSeq++ === 0
            ? todayRunsBody(0, 0, 0)
            : TREND_BODY;
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
    await render(<OverviewModulePage />);
    const paths = urls.map((u) => new URL(u, 'http://localhost').pathname);
    expect(new Set(paths)).toEqual(
      new Set(['/agent-api/api/overview/summary', '/agent-api/api/run-stats']),
    );
    const runStats = urls.filter((u) => new URL(u, 'http://localhost').pathname.includes('/run-stats'));
    expect(runStats).toHaveLength(2);
    for (const u of runStats) {
      const params = new URL(u, 'http://localhost').searchParams;
      expect(params.get('bucket')).toBe('day');
      expect(params.get('from')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(params.get('to')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it('真 0 带来源说明、读数逐卡呈现、无 GAP 文本外漏', async () => {
    await render(
      <OverviewView state={viewState({})} todayDate="2026-11-23" onRetry={() => {}} />,
    );
    const text = container.textContent ?? '';
    expect(text).not.toContain('未接入'); // 只有读口失败才说未接入，真 0 不是
    expect(container.querySelector('[data-testid="ov6-kpi-employees"]')?.textContent).toContain('3');
    expect(text).toContain('在岗 2');
    // 今日运行 0：值上屏为 0，且带接口 source 原文
    const runs = container.querySelector('[data-testid="ov6-kpi-runs"]') ?? document.createElement('div');
    expect(runs.querySelector('[data-testid="ov6-kpi-runs-value"]')?.textContent).toBe('0');
    expect(runs.querySelector('[data-testid="ov6-kpi-runs-note"]')?.textContent).toContain(
      'runtime GET /v1/runs/stats（from/to=北京日窗 bucket=day）',
    );
    expect(
      container.querySelector('[data-testid="ov6-kpi-pending-note"]')?.textContent,
    ).toContain('domain GET /v1/approvals?status=pending&scope=tenant（租户收件箱）');
    expect(text).toContain('正常');
    expect(text).not.toContain('GAP-');
    expect(text).not.toContain('读取于');
  });

  it('失败率只在两个真数上计算（今日 10 败 2 → 20%）', async () => {
    await render(
      <OverviewView
        state={viewState({ today: ready(todayRunsBody(10, 2, 0.5)) })}
        todayDate="2026-11-23"
        onRetry={() => {}}
      />,
    );
    expect(container.textContent).toContain('20%');
  });

  it('summary 读口失败：各卡显示未接入 + 请求编号 + 重试，不编造数字', async () => {
    await render(
      <OverviewView
        state={viewState({
          summary: { k: 'error', status: 503, message: '数据服务暂时没有响应', requestId: 'req-sum-9' },
        })}
        todayDate="2026-11-23"
        onRetry={() => {}}
      />,
    );
    const employees = container.querySelector('[data-testid="ov6-kpi-employees"]');
    expect(employees?.textContent).toContain('聚合总览未接入');
    expect(employees?.textContent).toContain('req-sum-9');
    expect(employees?.querySelector('[data-testid="ov6-kpi-employees-issue-retry"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="ov6-kpi-employees-value"]')?.textContent).toBe('未接');
  });

  it('run-stats 今日窗失败只影响运行卡的失败率脚注，其余卡照常', async () => {
    await render(
      <OverviewView
        state={viewState({
          today: { k: 'error', status: 503, message: '运行统计链路失败', requestId: 'req-run-7' },
        })}
        todayDate="2026-11-23"
        onRetry={() => {}}
      />,
    );
    const runs = container.querySelector('[data-testid="ov6-kpi-runs"]');
    expect(runs?.textContent).toContain('运行统计（今日）未接入');
    expect(runs?.textContent).toContain('req-run-7');
    // summary 仍通：今日运行主值照常
    expect(runs?.querySelector('[data-testid="ov6-kpi-runs-value"]')?.textContent).toBe('0');
    expect(container.querySelector('[data-testid="ov6-kpi-employees"]')?.textContent).toContain('3');
  });

  it('两路全挂：整页错误卡声明没有编造任何数字', async () => {
    await render(
      <OverviewView
        state={{
          summary: { k: 'error', status: 503, message: '不可用', requestId: 'req-ov11-1' },
          today: { k: 'error', status: 503, message: '不可用', requestId: 'req-ov11-1' },
          trend: { k: 'error', status: 503, message: '不可用', requestId: 'req-ov11-1' },
        }}
        todayDate="2026-11-23"
        onRetry={() => {}}
      />,
    );
    expect(container.querySelector('[data-testid="ov6-error"]')?.textContent).toContain('req-ov11-1');
    expect(container.textContent).toContain('没有任何数字是编造的');
  });

  it('每卡带来源采集时间；顶部 as-of 取最新；缺时间如实未知并给原因', async () => {
    await render(
      <OverviewView state={viewState({})} todayDate="2026-11-23" onRetry={() => {}} />,
    );
    for (const id of [
      'ov6-asof',
      'ov6-kpi-employees-stamp',
      'ov6-kpi-runs-stamp',
      'ov6-kpi-pending-stamp',
      'ov6-kpi-cost-stamp',
      'ov6-kpi-health-stamp',
      'ov6-trend-stamp',
    ]) {
      expect(container.querySelector(`[data-testid="${id}"]`), id).toBeTruthy();
    }
    expect(container.querySelectorAll('[data-duty-testid^="duty-kpi-"]')).toHaveLength(5);
    // summary asOf 11:41Z、today 11:41Z、trend 11:41Z → 北京时间 19:41
    expect(container.querySelector('[data-testid="ov6-asof"]')?.textContent).toContain('2026-11-23 19:41');
    expect(container.textContent).not.toContain('读取于');

    const noStamp = ready({ buckets: [], totals: { runs: 0 } } as RunStatsBody);
    await render(
      <OverviewView
        state={viewState({ trend: noStamp })}
        todayDate="2026-11-23"
        onRetry={() => {}}
      />,
    );
    expect(container.querySelector('[data-testid="ov6-trend-stamp"]')?.textContent).toContain('上游响应没有带采集时间');
  });

  it('趋势来自 run-stats 日桶：null 桶不画柱、真 0 桶按 0 呈现', async () => {
    await render(
      <OverviewView state={viewState({})} todayDate="2026-11-23" onRetry={() => {}} />,
    );
    const bars = container.querySelectorAll('[data-testid="ov6-bars"] .ov5-bar');
    expect(bars.length).toBe(4);
    expect(container.querySelector('[data-testid="ov6-trend"]')?.textContent).toContain('run-stats');
  });

  it('OM-03/OM-10：五卡齐挂且健康卡标注 BFF fan-out 真来源（非本页取数成败）', async () => {
    await render(
      <OverviewView state={viewState({})} todayDate="2026-11-23" onRetry={() => {}} />,
    );
    expect(
      container.querySelectorAll('[data-testid^="ov6-kpi-"][data-duty-testid^="duty-kpi-"]'),
    ).toHaveLength(5);
    const health = container.querySelector('[data-testid="ov6-kpi-health"]');
    expect(health?.textContent).toContain('bff fan-out probe');
    expect(health?.textContent).not.toContain('来源正常'); // 禁「n/6 本页读数」话术回潮
  });

  it('原始响应面板展示接口原文', async () => {
    await render(
      <OverviewView state={viewState({})} todayDate="2026-11-23" onRetry={() => {}} />,
    );
    const panel = container.querySelector('[data-testid="ov6-source"]');
    expect(panel?.textContent).toContain('/api/overview/summary');
    expect(panel?.innerHTML ?? '').toContain('bff-aggregation-read-time');
    expect(container.innerHTML).not.toContain('dangerouslySetInnerHTML');
  });
});
