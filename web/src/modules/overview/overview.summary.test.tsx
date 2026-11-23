// @vitest-environment jsdom
// OM-13 摘要复制：纯函数零请求；复制成功/失败兜底；成本句与 metrics 口径单源逐字同。
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { COST_CALIBER_TEXT } from '../metrics/costCaliberNote';
import type { Loadable } from '../duty/types';
import { OverviewView, type OverviewState } from './OverviewModulePage';
import { overviewSummaryText } from './overview';

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
  vi.restoreAllMocks();
});

async function render(node: ReactNode, path = '/overview') {
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

function viewState(partial: Partial<OverviewState>): OverviewState {
  return {
    summary: { k: 'loading' },
    today: { k: 'loading' },
    trend: { k: 'loading' },
    ...partial,
  };
}

const SRC_EMP = 'domain GET /v1/employees?limit=100（单页）';
const SRC_RUNS = 'runtime GET /v1/runs/stats（from/to=北京日窗 bucket=day）';
const SUM = {
  employeeTotal: { value: 3, source: SRC_EMP, asOf: '2026-11-23T11:41:22Z' },
  activeTotal: { value: 2, source: `${SRC_EMP}（lifecycleState=active 计数）`, asOf: '2026-11-23T11:41:22Z' },
  todayRuns: { value: 0, source: SRC_RUNS, asOf: '2026-11-23T11:41:22Z' },
  todayCostUsd: { value: 0, source: SRC_RUNS, asOf: '2026-11-23T11:41:22Z' },
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
};
const TODAY = { buckets: [], totals: { runs: 0, failed: 0 }, asOf: '2026-11-23T12:53:15Z' };
const PROBE = {
  schema: 'runtime.hermes.summary.v1',
  gateway: { status: 'ok', updated_at: '2026-11-23T15:06:27.261032+00:00' },
};

function withClipboard(clipboard: { writeText?: (t: string) => Promise<void> } | undefined) {
  const nav = globalThis.navigator as Navigator & { clipboard?: Clipboard };
  const had = Object.prototype.hasOwnProperty.call(nav, 'clipboard');
  const prev = nav.clipboard;
  Object.defineProperty(nav, 'clipboard', { configurable: true, value: clipboard as Clipboard | undefined });
  return () => {
    if (had) Object.defineProperty(nav, 'clipboard', { configurable: true, value: prev });
    else delete nav.clipboard;
  };
}

describe('OM-13 摘要复制', () => {
  it('纯函数形制：缺值「—」，来源与采集时刻各归其位', () => {
    const text = overviewSummaryText({
      asOf: null,
      cards: [{ label: '今日成本', value: '—', source: null, stamp: null }],
      costCaliber: COST_CALIBER_TEXT,
    });
    expect(text).toContain('运营总览摘要');
    expect(text).toContain('数据截至 —（只认上游采集时间，前端时钟不顶替）');
    expect(text).toContain('- 今日成本：—｜来源 —｜采集时刻 —');
    expect(text).toBe(`运营总览摘要\n数据截至 —（只认上游采集时间，前端时钟不顶替）\n- 今日成本：—｜来源 —｜采集时刻 —\n成本口径：${COST_CALIBER_TEXT}`);
  });

  it('函数体零请求：调用期间 fetch 一次都不被触发', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    overviewSummaryText({
      asOf: '2026-11-23 20:53',
      cards: [
        { label: '员工', value: '在岗 2 / 在编 3', source: SRC_EMP, stamp: '2026-11-23 19:41' },
      ],
      costCaliber: COST_CALIBER_TEXT,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('复制成功：剪贴板文本含五卡行、采集时刻字样，成本句与 costCaliberNote 逐字同', async () => {
    const writeText = vi.fn(async () => {});
    const restore = withClipboard({ writeText });
    try {
      await render(
        <OverviewView
          state={viewState({
            summary: ready(SUM),
            today: ready(TODAY),
            trend: ready({ buckets: [] }),
            probe: ready(PROBE),
          })}
          todayDate="2026-11-23"
          onRetry={() => {}}
        />,
      );
      const btn = container.querySelector<HTMLButtonElement>('[data-testid="ov6-summary-copy"]');
      expect(btn).toBeTruthy();
      await act(async () => {
        btn?.click();
      });
      expect(container.querySelector('[data-testid="ov6-summary-copy-ok"]')).toBeTruthy();
      expect(writeText).toHaveBeenCalledTimes(1);
      const text = writeText.mock.calls[0][0];
      expect(text).toContain('- 员工：在岗 2 / 在编 3｜来源 ' + SRC_EMP);
      expect(text).toContain('- 今日运行：0｜来源 ' + SRC_RUNS);
      expect(text).toContain('- 今日成本：$0.00');
      expect(text).toContain('- 整体健康（服务探针）：正常｜来源 GET /api/hermes-summary');
      expect(text).toContain('采集时刻 2026-11-23 23:06');
      expect(text).toContain(`成本口径：${COST_CALIBER_TEXT}`);
      expect(text).not.toContain('未接');
    } finally {
      restore();
    }
  });

  it('复制失败：说失败并留可选中文本兜底，不假装成功', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('denied');
    });
    const restore = withClipboard({ writeText });
    try {
      await render(
        <OverviewView
          state={viewState({
            summary: ready(SUM),
            today: ready(TODAY),
            trend: ready({ buckets: [] }),
            probe: ready(PROBE),
          })}
          todayDate="2026-11-23"
          onRetry={() => {}}
        />,
      );
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-testid="ov6-summary-copy"]')?.click();
      });
      expect(container.querySelector('[data-testid="ov6-summary-copy-ok"]')).toBeNull();
      expect(container.querySelector('[data-testid="ov6-summary-copy-fail"]')).toBeTruthy();
      const ta = container.querySelector<HTMLTextAreaElement>('[data-testid="ov6-summary-fallback"]');
      expect(ta).toBeTruthy();
      expect(ta?.value).toContain(`成本口径：${COST_CALIBER_TEXT}`);
      expect(ta?.value).toContain('运营总览摘要');
    } finally {
      restore();
    }
  });

  it('空读数摘要不造数：缺值全走「—」，无假 0 假金额', async () => {
    const writeText = vi.fn(async () => {});
    const restore = withClipboard({ writeText });
    try {
      await render(
        <OverviewView
          state={viewState({
            summary: ready({}),
            today: ready({}),
            trend: ready({}),
            probe: ready({}),
          })}
          todayDate="2026-11-23"
          onRetry={() => {}}
        />,
      );
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-testid="ov6-summary-copy"]')?.click();
      });
      const text = writeText.mock.calls[0][0];
      const cardLines = text.split('\n').filter((l: string) => l.startsWith('- ')).join('\n');
      expect(cardLines).toContain('- 今日运行：—｜来源 —｜采集时刻 —');
      expect(cardLines).toContain('- 今日成本：—');
      expect(cardLines).not.toMatch(/\$\d/);
      expect(cardLines).not.toMatch(/：0(?!\.)/);
      expect(text).toContain(`成本口径：${COST_CALIBER_TEXT}`);
    } finally {
      restore();
    }
  });
});
