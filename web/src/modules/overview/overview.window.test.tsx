// @vitest-environment jsdom
// OM-04 时间窗切换合同：四档复用 DUTY_RANGES；?range= 深链；换档只重发趋势腿；
// 24h 走 run-stats hour 桶（现网实测 200）；非法档回落默认并说明。
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OverviewModulePage } from './OverviewModulePage';
import type { OverviewSummaryBody } from './api';
import type { RunStatsBody } from '../duty/types';

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

async function renderAt(path: string) {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[path]}><OverviewModulePage /></MemoryRouter>);
  });
  await act(async () => {});
}

const SUMMARY_BODY = {
  employeeTotal: { value: 3, source: 'domain GET /v1/employees?limit=100（单页）', asOf: '2026-11-23T11:41:22Z' },
  activeTotal: { value: 2, source: 'domain GET /v1/employees?limit=100（单页）（lifecycleState=active 计数）', asOf: '2026-11-23T11:41:22Z' },
  todayRuns: { value: 0, source: 'runtime GET /v1/runs/stats（from/to=北京日窗 bucket=day）', asOf: '2026-11-23T11:41:22Z' },
  todayCostUsd: { value: 0, source: 'runtime GET /v1/runs/stats（from/to=北京日窗 bucket=day）', asOf: '2026-11-23T11:41:22Z' },
  pendingApprovals: { value: 0, source: 'domain GET /v1/approvals?status=pending&scope=tenant（租户收件箱）', asOf: '2026-11-23T11:41:22Z' },
  healthStatus: { value: 'ok', source: 'bff fan-out probe（本请求 employees/runs-stats/approvals 三路上游结果）', asOf: '2026-11-23T11:41:22Z' },
  asOf: '2026-11-23T11:41:22Z',
  asOfSource: 'bff-aggregation-read-time',
} as OverviewSummaryBody;

const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

/** 按 URL 分类计数；run-stats 第 1 次视为今日窗，之后的视为趋势腿。 */
function stubFetch() {
  const calls = { summary: 0, runStats: [] as URL[] };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const u = new URL(String(input), 'http://localhost');
      if (u.pathname === '/agent-api/api/overview/summary') {
        calls.summary += 1;
        return json(SUMMARY_BODY);
      }
      if (u.pathname !== '/agent-api/api/run-stats') {
        // OM-07/08 列表腿：回空 items，不计入趋势计数。
        return json({ items: [] });
      }
      calls.runStats.push(u);
      if (calls.runStats.length === 1) {
        return json({ buckets: [{ bucketStart: '2026-11-23T16:00:00Z', runs: 0, failed: 0 }], totals: { runs: 0, failed: 0 } });
      }
      if (u.searchParams.get('bucket') === 'hour') {
        return json({ bucket: 'hour', buckets: [], totals: { runs: 0 }, asOf: '2026-11-23T13:30:00Z' });
      }
      return json({
        buckets: [
          { bucketStart: '2026-11-20T16:00:00Z', runs: 44, failed: 0 },
          { bucketStart: '2026-11-21T16:00:00Z', runs: 24, failed: 0 },
          { bucketStart: '2026-11-22T16:00:00Z', runs: 4, failed: 0 },
        ],
        totals: { runs: 72, failed: 0 },
        asOf: '2026-11-23T13:30:00Z',
      } as RunStatsBody);
    }),
  );
  return calls;
}

const DAY = 86_400_000;

describe('OM-04 时间窗切换', () => {
  it('深链 ?range=7d：窗口字样全部跟随，不再出现 14 天话术', async () => {
    stubFetch();
    await renderAt('/overview?range=7d');
    const text = container.textContent ?? '';
    expect(text).toContain('近 7 天运行趋势（run-stats 日桶）');
    expect(text).toContain('GET /api/run-stats?from&to&bucket=day');
    // 趋势区（标题+空态+注脚）不得残留 14 天话术；档位在 pill 上出现属正常。
    const trend = container.querySelector('[aria-label="近 7 天运行趋势"]');
    expect(trend?.textContent).toContain('近 7 天');
    expect(trend?.textContent).not.toContain('近 14 天');
  });

  it('7d 趋势请求窗从 6 天前起、bucket=day', async () => {
    const calls = stubFetch();
    await renderAt('/overview?range=7d');
    expect(calls.runStats).toHaveLength(2);
    const tr = calls.runStats[1];
    expect(tr.searchParams.get('bucket')).toBe('day');
    const from = Date.parse(tr.searchParams.get('from')!);
    expect(Math.abs(from - (Date.now() - 6 * DAY))).toBeLessThan(DAY);
  });

  it('24h 档走 hour 桶、from 为 ISO 时刻；空桶如实空态不画柱', async () => {
    const calls = stubFetch();
    await renderAt('/overview?range=24h');
    const tr = calls.runStats[1];
    expect(tr.searchParams.get('bucket')).toBe('hour');
    expect(tr.searchParams.get('from')).toContain('T');
    expect(Math.abs(Date.parse(tr.searchParams.get('from')!) - (Date.now() - DAY))).toBeLessThan(2 * 3600 * 1000);
    const text = container.textContent ?? '';
    expect(text).toContain('近 24 小时运行趋势（run-stats 小时桶）');
    const empty = container.querySelector('[data-testid="ov6-trend-empty"]');
    expect(empty?.textContent).toContain('近 24 小时');
    expect(empty?.textContent).toContain('小时桶');
    expect(container.querySelector('[data-testid="ov6-bars"]')).toBeFalsy();
  });

  it('点档换 30d：只重发趋势腿一次，汇总/今日腿计数不变，当前档 aria-pressed 迁移', async () => {
    const calls = stubFetch();
    await renderAt('/overview');
    expect(calls.summary).toBe(1);
    expect(calls.runStats).toHaveLength(2);
    const btn = container.querySelector<HTMLButtonElement>('[data-testid="ov6-range-30d"]')!;
    await act(async () => {
      btn.click();
    });
    await act(async () => {});
    expect(calls.summary).toBe(1);
    expect(calls.runStats).toHaveLength(3);
    const tr = calls.runStats[2];
    expect(tr.searchParams.get('bucket')).toBe('day');
    expect(Math.abs(Date.parse(tr.searchParams.get('from')!) - (Date.now() - 29 * DAY))).toBeLessThan(DAY);
    const text = container.textContent ?? '';
    expect(text).toContain('近 30 天运行趋势');
    expect(container.querySelector('[data-testid="ov6-range-30d"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('[data-testid="ov6-range-14d"]')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('非法 ?range=99d 回落默认档并写明原因', async () => {
    stubFetch();
    await renderAt('/overview?range=99d');
    const note = container.querySelector('[data-testid="ov6-range-fallback"]');
    expect(note?.textContent).toContain('99d');
    expect(note?.textContent).toContain('近 14 天');
    expect(container.textContent).toContain('近 14 天运行趋势');
  });

  it('四档 pill 齐挂，导航有语义标签', async () => {
    stubFetch();
    await renderAt('/overview');
    const nav = container.querySelector('[data-testid="ov6-range"]');
    expect(nav?.getAttribute('aria-label')).toBe('时间窗切换');
    for (const id of ['24h', '7d', '14d', '30d']) {
      expect(container.querySelector(`[data-testid="ov6-range-${id}"]`), id).toBeTruthy();
    }
    expect(container.querySelector('[data-testid="ov6-range-14d"]')?.getAttribute('aria-pressed')).toBe('true');
  });
});

