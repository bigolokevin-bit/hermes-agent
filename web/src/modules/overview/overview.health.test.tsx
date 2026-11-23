// @vitest-environment jsdom
// OM-10 健康卡两段式：服务探针（hermes-summary）与本页 fan-out 合成态分列，不混算。
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OverviewView, type OverviewState } from './OverviewModulePage';
import type { HermesSummaryBody, OverviewSummaryBody } from './api';
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

function viewState(partial: Partial<OverviewState>): OverviewState {
  return {
    summary: { k: 'loading' },
    today: { k: 'loading' },
    trend: { k: 'loading' },
    ...partial,
  };
}

/** 现网 2026-11-23 GET /api/hermes-summary 实回节选（形状逐字保留）。 */
function probeBody(status: string | null, withAt = true): HermesSummaryBody {
  return {
    schema: 'runtime.hermes.summary.v1',
    gateway: {
      status,
      platform: 'hermes-agent',
      updated_at: withAt ? '2026-11-23T15:06:27.261032+00:00' : undefined,
    },
    sources: { gateway_health: { state: status } },
  };
}

const SUMMARY_FAN_OK: OverviewSummaryBody = {
  healthStatus: {
    value: 'ok',
    source: 'bff fan-out probe（本请求 employees/runs-stats/approvals 三路上游结果）',
    asOf: '2026-11-23T15:06:27Z',
  },
  asOf: '2026-11-23T15:06:27Z',
};

function healthCard(): Element | null {
  return container.querySelector('[data-testid="ov6-kpi-health"]');
}

describe('OM-10 健康卡两段式', () => {
  it('探针 ok + fan-out ok：值取探针、来源标 hermes-summary、合成态单列', async () => {
    await render(
      <OverviewView
        state={viewState({
          summary: ready(SUMMARY_FAN_OK),
          probe: ready(probeBody('ok')),
        })}
        todayDate="2026-11-23"
        onRetry={() => {}}
      />,
    );
    const card = healthCard();
    expect(card?.textContent).toContain('正常');
    expect(card?.textContent).toContain('GET /api/hermes-summary');
    expect(card?.textContent).toContain('bff fan-out probe（本请求 employees/runs-stats/approvals 三路上游结果）');
    // 采集时刻用探针 updated_at（UTC 15:06 → 北京 23:06）。
    expect(container.querySelector('[data-testid="ov6-kpi-health-stamp"]')?.textContent).toContain(
      '2026-11-23 23:06',
    );
  });

  it('探针 degraded 显示「降级」，不被 fan-out「正常」顶替', async () => {
    await render(
      <OverviewView
        state={viewState({
          summary: ready(SUMMARY_FAN_OK),
          probe: ready(probeBody('degraded')),
        })}
        todayDate="2026-11-23"
        onRetry={() => {}}
      />,
    );
    expect(healthCard()?.textContent).toContain('降级');
    expect(container.querySelector('[data-testid="ov6-kpi-health-value"]')?.textContent).toContain('降级');
  });

  it('探针未接：卡说「服务探针未接入」+请求编号+重试，值未接，绝不说 n/6', async () => {
    await render(
      <OverviewView
        state={viewState({
          summary: ready(SUMMARY_FAN_OK),
          probe: { k: 'error', status: 503, message: '探针网关不可达', requestId: 'req-probe-1' },
        })}
        todayDate="2026-11-23"
        onRetry={() => {}}
      />,
    );
    const card = healthCard();
    expect(card?.textContent).toContain('服务探针未接入：探针网关不可达');
    expect(card?.textContent).toContain('req-probe-1');
    expect(container.querySelector('[data-testid="ov6-kpi-health-issue-retry"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="ov6-kpi-health-value"]')?.textContent).toBe('未接');
    expect(card?.textContent).not.toMatch(/\d+\/\d+/);
  });

  it('探针 ready 但没带 gateway：值未接＋「不以本页读数冒充」，合成态行仍来自 summary', async () => {
    await render(
      <OverviewView
        state={viewState({ summary: ready(SUMMARY_FAN_OK), probe: ready({}) })}
        todayDate="2026-11-23"
        onRetry={() => {}}
      />,
    );
    const card = healthCard();
    expect(container.querySelector('[data-testid="ov6-kpi-health-value"]')?.textContent).toBe('未接');
    expect(card?.textContent).toContain('不以本页读数冒充');
    expect(card?.textContent).toContain('本页读数合成状态：正常');
  });

  it('探针响应没有带采集时间：时刻行给原因，不拿前端钟补', async () => {
    await render(
      <OverviewView
        state={viewState({ probe: ready(probeBody('ok', false)) })}
        todayDate="2026-11-23"
        onRetry={() => {}}
      />,
    );
    expect(container.querySelector('[data-testid="ov6-kpi-health-stamp"]')?.textContent).toContain(
      '服务探针响应没有带采集时间',
    );
  });
});
