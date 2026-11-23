// @vitest-environment jsdom
// OM-09 成本口径：今日成本只认 summary.todayCostUsd（账本/运行时实扣），partial 不冒充、真 0 必 '$0.00'。
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OverviewView, type OverviewState } from './OverviewModulePage';
import type { OverviewSummaryBody } from './api';
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
  return { summary: { k: 'loading' }, today: { k: 'loading' }, trend: { k: 'loading' }, ...partial };
}

function summaryWithCost(cost: OverviewSummaryBody['todayCostUsd']): OverviewSummaryBody {
  return { todayCostUsd: cost, asOf: '2026-11-23T11:41:22Z', asOfSource: 'bff-aggregation-read-time' };
}

function mount(summary: OverviewSummaryBody | Loadable<never>) {
  return render(
    <OverviewView
      state={viewState({
        summary: summary as Loadable<OverviewSummaryBody>,
      })}
      todayDate="2026-11-23"
      onRetry={() => {}}
    />,
  );
}

const costCard = () => container.querySelector('[data-testid="ov6-kpi-cost"]');
const costValue = () => container.querySelector('[data-testid="ov6-kpi-cost-value"]')?.textContent;

const COST_SRC = 'runtime GET /v1/runs/stats（from/to=北京日窗 bucket=day）';

describe('OM-09 成本口径卡', () => {
  it('① 有值：美元两位小数上屏，来源口径原文随卡展示', async () => {
    await mount(ready(summaryWithCost({ value: 1.27018, source: COST_SRC })));
    expect(costValue()).toBe('$1.27');
    expect(costCard()?.textContent).toContain(COST_SRC);
  });

  it('② 真 0：显示 $0.00 并带来源说明，绝不退化成「—」', async () => {
    await mount(ready(summaryWithCost({ value: 0, source: COST_SRC })));
    expect(costValue()).toBe('$0.00');
    expect(costCard()?.textContent).toContain(`0 来自接口真实返回：${COST_SRC}`);
  });

  it('③ 缺账本字段：「未接」+ 不以 0 冒充，不出现金额', async () => {
    await mount(ready(summaryWithCost(null)));
    expect(costValue()).toBe('未接');
    expect(costCard()?.textContent).toContain('不以 0 冒充');
    expect(costCard()?.textContent).not.toMatch(/\$\d/);
  });

  it('④ 字段在但 value=null：同上，未接不是 0', async () => {
    await mount(ready(summaryWithCost({ value: null, source: COST_SRC })));
    expect(costValue()).toBe('未接');
    expect(costCard()?.textContent).not.toMatch(/\$\d/);
  });

  it('⑤ 总览腿故障：成本卡说「聚合总览未接入」+ 请求编号 + 重试，不造金额', async () => {
    await mount({ k: 'error', status: 503, message: '聚合服务不可达', requestId: 'req-cost-9' });
    const issue = container.querySelector('[data-testid="ov6-kpi-cost-issue"]');
    expect(issue?.textContent).toContain('聚合总览未接入：聚合服务不可达');
    expect(issue?.textContent).toContain('req-cost-9');
    expect(container.querySelector('[data-testid="ov6-kpi-cost-issue-retry"]')).toBeTruthy();
    expect(costCard()?.textContent).not.toMatch(/\$\d/);
  });

  it('⑥ 钱袋节点无估算话术：无 ≈/估算，无计价单价字段名外漏', async () => {
    await mount(ready(summaryWithCost({ value: 1.27018, source: COST_SRC })));
    const text = costCard()?.textContent ?? '';
    expect(text).not.toContain('≈');
    expect(text).not.toContain('估算');
    expect(text).not.toMatch(/pricing|unitPrice/);
  });
});
