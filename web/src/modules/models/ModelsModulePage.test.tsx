// @vitest-environment jsdom
// T28 — 模型目录、单价表、账本三块各自读、各自标来源；一块未接入不影响另外两块。
// 这里断言屏幕上的话：没有示例数字、没有 $0.00、没有单价 × 用量，也没有裸字段名。
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock('@/lib/api', () => ({ fetchJSON: api.fetchJSON }));
vi.mock('@/lib/clipboard', () => ({ copyTextToClipboard: () => Promise.resolve(true) }));

import { ModelsModulePage } from './ModelsModulePage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

async function waitFor(cond: () => boolean, label = 'condition'): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

async function render(entry: string, page: ReactNode): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<MemoryRouter initialEntries={[entry]}>{page}</MemoryRouter>);
  });
}

const text = (): string => document.body.textContent ?? '';
const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const busy = (): boolean => document.querySelector('.animate-pulse') !== null;

async function mount(handler: (url: string) => Promise<unknown>, entry = '/models'): Promise<void> {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(handler);
  await render(entry, <ModelsModulePage />);
  await waitFor(() => !busy(), 'state settled');
}

const CATALOG = {
  models: [
    { modelId: 'mdl_deepseek_v41_flash', label: 'DeepSeek V4.1 Flash', provider: 'alibaba-cn' },
    { modelId: 'mdl_qwen38_flash', label: 'Qwen3.8 Flash', provider: 'alibaba-cn' },
  ],
  asOf: '2026-11-19T02:00:00Z',
};

const PRICING = {
  prices: [
    {
      modelId: 'mdl_deepseek_v41_flash',
      label: 'DeepSeek V4.1 Flash',
      provider: 'alibaba-cn',
      inputPerMillion: 0.14,
      outputPerMillion: 0.28,
      currency: 'USD',
      asOf: '2026-11-19T02:00:00Z',
    },
    {
      modelId: 'mdl_local_strata',
      label: 'Strata（本地）',
      provider: 'self-hosted',
      inputPerMillion: null,
      outputPerMillion: null,
      currency: null,
      asOf: null,
    },
  ],
  asOf: '2026-11-19T02:00:00Z',
};

const USAGE = {
  period_days: 30,
  cost: { source: 'cost_ledger', cost_usd: 12.48, cost_status: 'upstream', rows: 9 },
  as_of: '2026-11-19T02:30:00Z',
};

beforeEach(() => {
  window.history.replaceState({}, '', '/');
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

describe('ModelsModulePage', () => {
  it('reads the three sources from their own BFF paths and never shares one state', async () => {
    await mount((url) => {
      if (url.includes('/models/pricing')) return Promise.resolve(PRICING);
      if (url.includes('/models')) return Promise.resolve(CATALOG);
      return Promise.resolve(USAGE);
    });
    expect(urls()).toEqual([
      '/agent-api/api/models',
      '/agent-api/api/models/pricing',
      '/agent-api/api/hermes-usage?days=30',
    ]);
    expect(text()).toContain('模型目录');
    expect(text()).toContain('单价（价目表）');
    expect(text()).toContain('实际扣费（账本）');
  });

  it('shows catalog, price and ledger values without pretending the missing price is zero', async () => {
    await mount((url) => {
      if (url.includes('/models/pricing')) return Promise.resolve(PRICING);
      if (url.includes('/models')) return Promise.resolve(CATALOG);
      return Promise.resolve(USAGE);
    });
    expect(text()).toContain('DeepSeek V4.1 Flash');
    expect(text()).toContain('$0.14 / 百万 token');
    expect(text()).toContain('Strata（本地）');
    expect(text()).toContain('$12.48');
    expect(text()).toContain('账本实测');
    expect(text()).not.toContain('$0.00');
    expect(text()).not.toContain('mdl_deepseek_v41_flash');
    expect(text()).not.toContain('inputPerMillion');
    expect(text()).not.toContain('示例数据');
  });

  it('marks only the price block as not connected when the price endpoint is missing', async () => {
    await mount((url) => {
      if (url.includes('/models/pricing')) return Promise.reject(new ApiError('missing', { status: 404, body: '', url }));
      if (url.includes('/models')) return Promise.resolve(CATALOG);
      return Promise.resolve(USAGE);
    });
    expect(text()).toContain('单价表未接入（GAP-07）');
    expect(text()).toContain('DeepSeek V4.1 Flash');
    expect(text()).toContain('$12.48');
    expect(text()).not.toContain('$0.00');
    expect(text()).not.toContain('404');
  });

  it('shows honest not-connected blocks instead of fixture data when all three endpoints are missing', async () => {
    await mount((url) => Promise.reject(new ApiError('missing', { status: 404, body: '', url })));
    expect(text()).toContain('模型目录未接入（GAP-07）');
    expect(text()).toContain('单价表未接入（GAP-07）');
    expect(text()).toContain('扣费账本未接入（GAP-07）');
    expect(text()).not.toContain('示例数据');
    expect(text()).not.toContain('$0.00');
    expect(document.querySelector('[data-testid="mdl4-page"]')).toBeTruthy();
  });

  it('keeps a human error, a copyable request number and a retry when every read fails hard', async () => {
    await mount((url) => Promise.reject(new ApiError('down', { status: 503, body: '', url, requestId: 'req-mdl-7' })));
    expect(text()).toContain('这次没能读取模型与账本');
    expect(text()).toContain('req-mdl-7');
    expect(text()).toContain('请求编号：');
    expect(text()).not.toContain('503');
    expect(text()).not.toContain('HTTP');
    const copy = document.querySelector('[aria-label="复制请求编号"]');
    expect(copy).toBeTruthy();
    await act(async () => {
      (copy as HTMLButtonElement).click();
    });
    expect(text()).toContain('已复制');
  });

  it('labels a forced ?state= screen as a preview and does not issue a request', async () => {
    await mount(() => Promise.resolve(CATALOG), '/models?state=error');
    expect(text()).toContain('预览状态');
    expect(text()).toContain('GAP-07');
    expect(urls()).toEqual([]);
    expect(document.querySelector('[data-testid="mdl4-error"]')).toBeTruthy();
  });

  it('keeps the page header copy explicit about not multiplying price by usage', async () => {
    await mount((url) => {
      if (url.includes('/models/pricing')) return Promise.resolve(PRICING);
      if (url.includes('/models')) return Promise.resolve(CATALOG);
      return Promise.resolve(USAGE);
    });
    expect(text()).toContain('不用单价乘用量');
    expect(text()).toContain('不把两块数字相互换算');
  });
});