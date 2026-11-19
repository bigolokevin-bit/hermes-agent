// @vitest-environment jsdom
// ten4 — tenant & quota. The page must not invent tenant data or quota limits;
// live usage is shown separately, a missing number stays —, and a 404 from both
// reads is a human error with a request id and retry.
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
vi.mock('@/modules/models/fetchJson', () => ({ fetchJsonStrict: api.fetchJsonStrict }));
vi.mock('@/lib/clipboard', () => ({ copyTextToClipboard: () => Promise.resolve(true) }));

import { TenantQuotaPage } from './TenantQuotaPage';

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
const urls = (): string[] => api.fetchJsonStrict.mock.calls.map((call) => String(call[0]));
const settled = (): boolean => document.querySelector('.ten4-skeleton') === null;

const EMPLOYEE_OK = { byLifecycle: { active: 2, paused: 1, offboarding: 0 }, asOf: '2026-11-19T05:30:00Z' };
const RUNS_OK = { totals: { runs: 12 }, asOf: '2026-11-19T05:31:00Z' };

async function mount(handler: (url: string) => Promise<unknown>, entry = '/tenant-quota'): Promise<void> {
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation(handler);
  await render(entry, <TenantQuotaPage />);
}

beforeEach(() => {
  window.history.replaceState({}, '', '/');
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
});

describe('TenantQuotaPage', () => {
  it('shows live usage apart from unavailable tenant profile and quota limits', async () => {
    await mount((url) => Promise.resolve(url.includes('employee-stats') ? EMPLOYEE_OK : RUNS_OK));
    await waitFor(settled, 'settled');
    await waitFor(() => document.querySelector('[data-testid="ten4-quotas"]') !== null, 'quotas');
    expect(urls()[0]).toContain('/agent-api/api/employee-stats');
    expect(urls()[1]).toContain('/agent-api/api/run-stats?');
    expect(urls()[1]).toContain('bucket=day');
    expect(text()).toContain('租户与配额');
    expect(text()).toContain('租户名称');
    expect(text()).toContain('接口未接入');
    expect(text()).toContain('员工数');
    expect(text()).toContain('3 人');
    expect(text()).toContain('运行数（近 7 天）');
    expect(text()).toContain('12 次');
    expect(text()).toContain('来源：员工统计 · 数据截至 2026-11-19 13:30');
    expect(text()).toContain('来源：运行统计 · 数据截至 2026-11-19 13:31');
    expect(text()).toContain('来源：租户资料 · 未接入 · 数据截至 时间未知');
    expect(text()).toContain('来源：额度上限 · 待核实');
    expect(text()).toContain('存储与 token');
    expect(text()).toContain('并发');
    expect(text()).toContain('月度预算');
    expect(text()).toContain('来源：存储与 token 用量 · 未接入 · 数据截至 时间未知');
    expect(text()).toContain('无法判断是否已用尽');
    expect(text()).not.toContain('$0.00');
    expect(text()).not.toContain('GAP-TEN-01');
    expect(document.querySelector('[data-testid="ten4-gap"]')?.getAttribute('title')).toContain('GAP-TEN-01');
    expect(document.querySelector('[data-testid="ten4-profile"] .ten4-gap-pill')?.getAttribute('title')).toContain('GAP-TEN-01');
  });

  it('shows a true zero as 0 with its unit instead of converting it to empty', async () => {
    await mount((url) =>
      Promise.resolve(
        url.includes('employee-stats')
          ? { byLifecycle: { active: 0, paused: 0, offboarding: 0 }, asOf: '2026-11-19T05:30:00Z' }
          : { totals: { runs: 0 }, asOf: '2026-11-19T05:31:00Z' },
      ),
    );
    await waitFor(settled, 'settled');
    await waitFor(() => document.querySelector('[data-testid="ten4-quotas"]') !== null, 'quotas');
    expect(document.querySelector('[data-testid="ten4-quota-employees"]')?.textContent).toContain('0 人');
    expect(document.querySelector('[data-testid="ten4-quota-runs"]')?.textContent).toContain('0 次');
    expect(document.querySelector('[data-testid="ten4-empty"]')).toBeNull();
    expect(text()).not.toContain('GAP-TEN-01');
  });

  it('renders a real empty state when neither live usage carries a usable total', async () => {
    await mount((url) =>
      Promise.resolve(url.includes('employee-stats') ? { byLifecycle: {} } : { totals: {} }),
    );
    await waitFor(settled, 'settled');
    await waitFor(() => document.querySelector('[data-testid="ten4-empty"]') !== null, 'empty');
    expect(text()).toContain('当前还没有可展示的用量');
    expect(text()).toContain('不用 0 代替缺失的额度');
    expect(document.querySelector('[data-testid="ten4-quotas"]')).toBeNull();
  });

  it('never substitutes the browser clock when a usage payload has no source timestamp', async () => {
    await mount((url) =>
      Promise.resolve(url.includes('employee-stats') ? { total: 4 } : { totals: { runs: 9 } }),
    );
    await waitFor(settled, 'settled');
    await waitFor(() => document.querySelector('[data-testid="ten4-quotas"]') !== null, 'quotas');
    expect(text()).toContain('数据截至 时间未知');
    expect(document.querySelector('[data-testid="ten4-asof-employees"]')?.textContent).toContain('不能用浏览器时间代替');
    expect(document.querySelector('[data-testid="ten4-asof-runs"]')?.textContent).toContain('不能用浏览器时间代替');
    expect(text()).not.toMatch(/数据截至 20\d\d-\d\d-\d\d/);
  });

  it('turns two failed reads into human copy, a request id and retry', async () => {
    await mount(() =>
      Promise.reject(
        new ApiError('这个数据接口还没有接入。', {
          status: 404,
          body: '',
          url: '/agent-api/api/employee-stats',
          requestId: 'req-ten-missing',
        }),
      ),
    );
    await waitFor(settled, 'settled');
    await waitFor(() => document.querySelector('[data-testid="ten4-error"]') !== null, 'error');
    expect(text()).toContain('这次没能读取租户用量');
    expect(text()).toContain('这块数据还没有接入');
    expect(text()).toContain('请求编号');
    expect(text()).toContain('req-ten-missing');
    expect(text()).not.toContain('404');
    expect(text()).not.toContain('HTTP');
    expect(document.querySelector('[data-testid="ten4-error"] button')).not.toBeNull();
  });

  it('keeps the successful usage row when only one read fails', async () => {
    await mount((url) => {
      if (url.includes('employee-stats')) {
        return Promise.reject(
          new ApiError('没有查看这项数据的权限；请联系管理员开通。', {
            status: 403,
            body: '',
            url,
            requestId: 'req-ten-403',
          }),
        );
      }
      return Promise.resolve(RUNS_OK);
    });
    await waitFor(settled, 'settled');
    await waitFor(() => document.querySelector('[data-testid="ten4-quotas"]') !== null, 'quotas');
    const employeeRow = document.querySelector('[data-testid="ten4-quota-employees"]');
    const runRow = document.querySelector('[data-testid="ten4-quota-runs"]');
    expect(employeeRow?.textContent).toContain('—');
    expect(employeeRow?.textContent).toContain('权限');
    expect(employeeRow?.textContent).toContain('req-ten-403');
    expect(runRow?.textContent).toContain('12');
  });

  it('serves zero-fetch preview states', async () => {
    await mount(() => Promise.resolve(EMPLOYEE_OK), '/tenant-quota?state=error');
    await waitFor(() => document.querySelector('[data-testid="ten4-error"]') !== null, 'forced error');
    expect(api.fetchJsonStrict).not.toHaveBeenCalled();
    expect(text()).toContain('预览状态');
  });

  it('does not leak engineering names into the page body', async () => {
    await mount((url) => Promise.resolve(url.includes('employee-stats') ? EMPLOYEE_OK : RUNS_OK));
    await waitFor(() => document.querySelector('[data-testid="ten4-quotas"]') !== null, 'quotas');
    const body = text();
    for (const token of ['/api', 'employee-stats', 'run-stats', 'HTTP', 'tenant_id', 'asOf', 'byLifecycle', 'totals']) {
      expect(body).not.toContain(token);
    }
  });

  it('keeps the quota grid inside the page at narrow widths', async () => {
    const css = await import('node:fs').then((fs) =>
      fs.readFileSync(`${process.cwd()}/src/modules/tenant/tenant.css`, 'utf8'),
    );
    expect(css).toContain('@media (max-width: 720px)');
    expect(css).toContain('grid-template-columns: 1fr');
    expect(css).toContain('overflow-wrap: anywhere');
  });
});
