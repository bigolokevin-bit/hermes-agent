// @vitest-environment jsdom
/**
 * 示例租户总览页最小契约（owner 裁定 2026-11-24）。
 *
 * 钉三件事：
 *   1. 与骨架同构的 11 块全部在（三卡 / 三细条 / 趋势 / 热力 / 三列表卡）；
 *   2. 顶部「示例租户」徽章可见——不能只靠页脚说明；
 *   3. 页面不依赖任何 data-fixture（示例数字只来自 ./dataset.ts，
 *      真页 fixture 一律不得渗进本页）。
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DemoOverviewPage } from './DemoOverviewPage';

/** 与骨架总览同构的 11 块（head / tabs / footer 是外壳，不在计数内）。 */
const BLOCK_TESTIDS = [
  'dt5-ready',
  'dt5-runs',
  'dt5-cost',
  'dt5-chain-release',
  'dt5-chain-outbound',
  'dt5-chain-ledger',
  'dt5-trend',
  'dt5-heat',
  'dt5-blockers',
  'dt5-pending',
  'dt5-recent',
] as const;

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
});

async function render() {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/demo/overview']}>
        <DemoOverviewPage />
      </MemoryRouter>,
    );
  });
  await act(async () => {});
}

describe('示例租户总览页', () => {
  it('骨架同构的 11 块全部渲染', async () => {
    await render();
    for (const testid of BLOCK_TESTIDS) {
      expect(container.querySelector(`[data-testid="${testid}"]`), `缺块：${testid}`).not.toBeNull();
    }
    expect(BLOCK_TESTIDS).toHaveLength(11);
    // 外壳三件：页头 / 一排 2 tab / 页脚。
    expect(container.querySelector('[data-testid="dt5-head"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="dt5-tabs"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="dt5-foot"]')).not.toBeNull();
  });

  it('顶部「示例租户」徽章可见，页脚写明隔离口径', async () => {
    await render();
    const badge = container.querySelector('[data-testid="dt5-demo-badge"]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent ?? '').toContain('示例租户');

    const foot = container.querySelector('[data-testid="dt5-foot"]')?.textContent ?? '';
    expect(foot).toContain('示例数据');
    expect(foot).toContain('与真实租户完全隔离');
  });

  it('不依赖任何 data-fixture（真页 fixture 不得渗进示例页）', async () => {
    await render();
    expect(container.querySelectorAll('[data-fixture]')).toHaveLength(0);
  });

  it('一排 2 tab：值班台 → 用量与成本为诚实占位，可返回', async () => {
    await render();
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs.map((tab) => tab.textContent)).toEqual(['值班台', '用量与成本']);

    const usageTab = tabs[1] as HTMLButtonElement;
    await act(async () => usageTab.click());
    expect(container.querySelector('[data-testid="dt5-usage-placeholder"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="dt5-ready"]')).toBeNull();

    const back = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === '返回值班台',
    ) as HTMLButtonElement;
    await act(async () => back.click());
    expect(container.querySelector('[data-testid="dt5-ready"]')).not.toBeNull();
  });
});