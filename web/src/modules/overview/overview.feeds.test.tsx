// @vitest-environment jsdom
// OM-07 最近运行 + OM-08 阻塞三路：只走现网已存在端点，真 0 与未接分开说。
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OverviewModulePage, OverviewView, type OverviewState } from './OverviewModulePage';
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
    root.unmount();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    root.render(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>);
  });
  await act(async () => {});
}

const ready = <T,>(data: T): Loadable<T> => ({ k: 'ready', data });
const err = (message: string, requestId: string | null = null): Loadable<never> => ({
  k: 'error',
  status: 503,
  message,
  requestId,
});

function viewState(partial: Partial<OverviewState>): OverviewState {
  return {
    summary: { k: 'loading' },
    today: { k: 'loading' },
    trend: { k: 'loading' },
    ...partial,
  };
}

describe('OM-07 最近运行（runs?since&limit）', () => {
  it('行来自接口原样：有 runId 才上屏并链到 /runs/<id>，缺 runId 的行丢弃', async () => {
    await render(
      <OverviewView
        state={viewState({
          act: ready({
            items: [
              {
                runId: 'rn_alpha',
                status: 'completed',
                startedAt: '2026-11-20T10:26:29.885Z',
              },
              { status: 'running' },
              { runId: 'rn_beta', endedAt: '2026-11-21T01:00:00.000Z' },
            ],
          }),
        })}
        todayDate="2026-11-23"
        onRetry={() => {}}
      />,
    );
    const rows = container.querySelectorAll('[data-testid="ov6-activity-row"]');
    expect(rows).toHaveLength(2);
    const link = container.querySelector('a[href="/runs/rn_alpha"]');
    expect(link).toBeTruthy();
    expect(link?.textContent).toContain('rn_alpha');
    // 北京时间换算如实呈现（UTC 10:26 → 北京 18:26）。
    expect(rows[0].textContent).toContain('2026-11-20 18:26');
    expect(rows[0].textContent).toContain('completed');
    // 缺 startedAt/endedAt 不造时间（rn_beta 只带 endedAt：UTC 01:00 → 北京 09:00）。
    expect(rows[1].textContent).toContain('2026-11-21 09:00');
    expect(rows[1].textContent).toContain('状态未带');
  });

  it('空 items 是真 0，不是占位；错误腿说未接入并给重试', async () => {
    await render(
      <OverviewView
        state={viewState({ act: ready({ items: [] }) })}
        todayDate="2026-11-23"
        onRetry={() => {}}
      />,
    );
    expect(container.querySelector('[data-testid="ov6-activity-empty"]')?.textContent).toContain(
      '真 0，不是占位',
    );
    expect(container.querySelector('[data-testid="ov6-activity-issue"]')).toBeNull();
  });

  it('act 腿错误 → 「最近运行未接入」+ 请求编号 + 重试钮', async () => {
    await render(
      <OverviewView
        state={viewState({
          act: { k: 'error', status: 502, message: '网关抖动', requestId: 'req-act-1' },
        })}
        todayDate="2026-11-23"
        onRetry={() => {}}
      />,
    );
    const issue = container.querySelector('[data-testid="ov6-activity-issue"]');
    expect(issue?.textContent).toContain('最近运行未接入：网关抖动');
    expect(issue?.textContent).toContain('req-act-1');
    expect(container.querySelector('[data-testid="ov6-activity-issue-retry"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="ov6-activity-empty"]')).toBeNull();
  });
});

describe('OM-08 阻塞三路合并', () => {
  it('失败运行/受阻任务/审批各按原接口条数成行，链到各自详情页', async () => {
    await render(
      <OverviewView
        state={viewState({
          fail: ready({
            items: [{ runId: 'rn_bad', status: 'failed', reasonCode: 'run.upstream_error' }],
          }),
          blocked: ready({
            items: [{ taskId: 'tk_9', title: '验收用任务 · 受阻', status: 'blocked' }],
          }),
          queue: ready({ items: [{ id: 'ap_1', title: '预算超限审批' }], total: 1 }),
        })}
        todayDate="2026-11-23"
        onRetry={() => {}}
      />,
    );
    const rows = container.querySelectorAll('[data-testid="ov6-blocker-row"]');
    expect(rows).toHaveLength(3);
    expect(container.querySelector('a[href="/runs/rn_bad"]')).toBeTruthy();
    expect(container.querySelector('a[href="/tasks/tk_9"]')?.textContent).toContain(
      '验收用任务 · 受阻',
    );
    expect(rows[0].textContent).toContain('失败运行');
    expect(rows[0].textContent).toContain('run.upstream_error');
    // 审批项没有现网详情页：列文不造链。
    expect(rows[2].textContent).toContain('预算超限审批');
    expect(rows[2].querySelector('a')).toBeNull();
    expect(container.querySelector('[data-testid="ov6-blockers-count"]')?.textContent).toContain(
      '失败运行 1 · 受阻任务 1 · 待审批 1',
    );
  });

  it('三路 ready 且全空 → 真 0 句；未全通时只列已接通部分并注明不合并猜测', async () => {
    await render(
      <OverviewView
        state={viewState({
          fail: ready({ items: [] }),
          blocked: ready({ items: [] }),
          queue: ready({ items: [] }),
        })}
        todayDate="2026-11-23"
        onRetry={() => {}}
      />,
    );
    expect(container.querySelector('[data-testid="ov6-blockers-empty"]')?.textContent).toContain(
      '三路接口都接通了',
    );

    await render(
      <OverviewView
        state={viewState({
          fail: err('队列上游不可达', 'req-blk-2'),
          blocked: ready({ items: [] }),
          queue: { k: 'loading' },
        })}
        todayDate="2026-11-23"
        onRetry={() => {}}
      />,
    );
    const issue = container.querySelector('[data-testid="ov6-blockers-issue-fail"]');
    expect(issue?.textContent).toContain('失败运行未接入：队列上游不可达');
    expect(issue?.textContent).toContain('req-blk-2');
    expect(container.querySelector('[data-testid="ov6-blockers-pending"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="ov6-blockers-empty"]')).toBeNull();
    expect(container.querySelector('[data-testid="ov6-blockers-count"]')?.textContent).toContain(
      '失败运行 未接 · 受阻任务 0 · 待审批 未接',
    );
  });
});

describe('OM-07/08 页面挂载与原文面板', () => {
  function stubFetch(urls: string[]) {
    let runStatsSeq = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);
        const p = new URL(url, 'http://localhost').pathname;
        const body =
          p === '/agent-api/api/overview/summary'
            ? {}
            : p === '/agent-api/api/run-stats'
              ? runStatsSeq++ === 0
                ? { buckets: [], totals: { runs: 0, failed: 0 } }
                : { buckets: [] }
              : { items: [{ runId: 'rn_live_1', status: 'completed', startedAt: '2026-11-22T00:00:00.000Z' }] };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
  }

  it('挂载即发全部读数腿；列表腿各一次，原文面板列出接口名', async () => {
    const urls: string[] = [];
    stubFetch(urls);
    await render(<OverviewModulePage />);
    // 列表腿经 fetchJSON→load 双层 promise，多清几轮微任务保证已渲染。
    for (let i = 0; i < 3; i++) await act(async () => {});
    const paths = urls.map((u) => new URL(u, 'http://localhost').pathname);
    expect(paths.filter((p) => p === '/agent-api/api/runs')).toHaveLength(2);
    expect(paths).toContain('/agent-api/api/tasks');
    expect(paths).toContain('/agent-api/api/workbench/queue');
    const panel = container.querySelector('[data-testid="ov6-source"]');
    console.log("ACT:", JSON.stringify(container.querySelector(`[data-testid="ov6-activity"]`)?.textContent ?? "NONE"), "RAWLEN:", container.querySelectorAll("[data-testid=\"ov6-source\"] details").length);
    expect(panel?.textContent).toContain('GET /api/runs?since&limit（近 7 天）');
    expect(panel?.textContent).toContain('GET /api/workbench/queue');
  });
});
