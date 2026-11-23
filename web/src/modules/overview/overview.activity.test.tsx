// @vitest-environment jsdom
// OM-07 最近活动：恒 ≤3 行（读 3 显 3 单源）、每行钻取 /runs/<id>、
// 状态四词表封闭（成功/失败/运行中/—，未知原值只进 title）、空态文案精确。
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OverviewPage, OverviewView } from './OverviewPage';
import type { DutyData } from '../duty/useDutyData';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let urls: string[];

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  urls = [];
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render(node: ReactNode, path = '/overview') {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>);
  });
  await act(async () => {});
}

const ready = <T,>(data: T) => ({ k: 'ready' as const, data });

function activityFixture(runs: unknown) {
  return {
    employees: ready([]),
    stats: ready({}),
    todayStats: ready({ totals: {} }),
    stats14: ready({ asOf: '2026-11-23T12:00:00Z', buckets: [] }),
    activity: ready({ cells: [] }),
    budgetDay: ready({ items: [], missingEmployeeIds: [] }),
    budgetMonth: ready({ items: [], missingEmployeeIds: [] }),
    approvalStats: ready({ pending: 0 }),
    approvals: ready([]),
    todayRuns: ready([]),
    recentRuns: runs,
    failedRuns: ready([]),
    blockedTasks: ready([]),
  } as unknown as DutyData;
}

function activityCard() {
  return container.querySelector('[data-testid="ov6-activity"]');
}

const VOCAB = ['成功', '失败', '运行中', '—'];

describe('OM-07 最近活动三行与状态词表', () => {
  it('5 行输入只显 3 行，每行可点达 /runs/<id>', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      runId: `run_${i}`,
      employeeId: 'emp_1',
      status: 'completed',
      startedAt: '2026-11-22T04:00:00Z',
    }));
    await render(<OverviewView data={activityFixture(ready(rows))} matrix={ready({ items: [] })} loading={false} onRetry={() => {}} />);
    const cards = activityCard();
    expect(cards).toBeTruthy();
    const listRows = cards!.querySelectorAll('[data-testid="ov6-activity-row"]');
    expect(listRows.length).toBe(3);
    for (const row of Array.from(listRows)) {
      const href = row.querySelector('a')?.getAttribute('href') ?? '';
      expect(href).toContain('/runs/');
    }
    expect(listRows[0].querySelector('a')?.getAttribute('href')).toContain('/runs/run_0');
  });

  it('状态四词表封闭：completed/failed/running → 成功/失败/运行中；缺值 → 「—」', async () => {
    const rows = [
      { runId: 'a', status: 'completed' },
      { runId: 'b', status: 'failed' },
      { runId: 'c', status: 'running' },
    ];
    await render(<OverviewView data={activityFixture(ready(rows))} matrix={ready({ items: [] })} loading={false} onRetry={() => {}} />);
    const badges = Array.from(activityCard()!.querySelectorAll('[data-testid="ov6-activity-row"]')).map(
      (r) => r.querySelector('[class*="badge"], span:nth-child(2)')?.textContent ?? '',
    );
    expect(badges).toEqual(['成功', '失败', '运行中']);
  });

  it('未知原值（cancelled / 缺 status）不进徽标文本，词表外文本为 0，原值落 title', async () => {
    const rows = [
      { runId: 'x', status: 'cancelled' },
      { runId: 'y' },
      { runId: 'z', status: 'queued' },
    ];
    await render(<OverviewView data={activityFixture(ready(rows))} matrix={ready({ items: [] })} loading={false} onRetry={() => {}} />);
    const listRows = Array.from(activityCard()!.querySelectorAll('[data-testid="ov6-activity-row"]'));
    expect(listRows.length).toBe(3);
    const texts = listRows.map((r) => Array.from(r.querySelectorAll('span')).map((s) => s.textContent).join('|'));
    for (const t of texts) {
      // 行内除钻取链接与时间外只有四词表徽标；cancelled/queued 原文不得出现在任何节点文本。
      expect(t).not.toContain('cancelled');
      expect(t).not.toContain('queued');
    }
    const badgeTexts = listRows.map((r) => r.querySelector('span[title^="上游状态"]')?.textContent ?? r.querySelectorAll('span')[1]?.textContent ?? '');
    for (const b of badgeTexts) expect(VOCAB).toContain(b.trim());
    // 未知状态徽标是「—」，并带可核对的 title。
    expect(listRows[0].querySelector('span[title*="上游状态：cancelled"]')).toBeTruthy();
    expect(listRows[1].querySelector('span[title*="上游状态"]')).toBeNull();
  });

  it('空态文案精确「近 7 天没有运行记录。」且导向 /employees', async () => {
    await render(<OverviewView data={activityFixture(ready([]))} matrix={ready({ items: [] })} loading={false} onRetry={() => {}} />);
    const empty = activityCard()!.querySelector('.ov5-empty-line');
    expect(empty?.querySelector('span')?.textContent).toBe('近 7 天没有运行记录。');
    expect(empty?.querySelector('a')?.getAttribute('href')).toContain('/employees');
  });

  it('错误态带 RequestId 与重试钮；「全部运行」链接带 window=7d 与卡同窗', async () => {
    let retries = 0;
    const onRetry = () => {
      retries += 1;
    };
    const data = activityFixture({ k: 'error' as const, status: 502, message: '网关超时', requestId: 'req-act-7' });
    await render(<OverviewView data={data} matrix={ready({ items: [] })} loading={false} onRetry={onRetry} />);
    const card = activityCard()!;
    expect(card.querySelector('[role="alert"]')?.textContent).toContain('req-act-7');
    (card.querySelector('[data-testid="ov6-activity-retry"]') as HTMLButtonElement).click();
    expect(retries).toBe(1);
    // 词表与窗参断言与卡状态无关，空态下同样可查「全部运行」。
    await act(async () => {
      root.unmount();
    });
    container.remove();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await render(<OverviewView data={activityFixture(ready([]))} matrix={ready({ items: [] })} loading={false} onRetry={() => {}} />);
    const all = Array.from(activityCard()!.querySelectorAll('a')).find((a) => a.textContent?.includes('全部运行'));
    expect(all?.getAttribute('href')).toContain('/runs?window=7d');
  });
});

describe('OM-07 读 3 显 3 单源（LiveOverview 真腿）', () => {
  it('数据腿按 limit=3 读取：URL 含 limit=3，页面行数不超过读口上限', async () => {
    const jsonFor = (url: string): unknown => {
      if (url.includes('/employees?')) return { items: [{ employeeId: 'emp_1', name: '甲', lifecycleState: 'active' }] };
      if (url.includes('/employee-stats')) return { total: 1, byLifecycle: { active: 1 } };
      if (url.includes('/workbench/summary')) return { kpis: [], asOf: '2026-11-23T12:00:00Z' };
      if (url.includes('/workbench/timeseries')) return { asOf: '2026-11-23T12:00:00Z', points: [] };
      if (url.includes('/workbench/queue')) return { items: [], total: 0 };
      if (url.includes('/runs?')) {
        return { items: Array.from({ length: 9 }, (_, i) => ({ runId: `srv_${i}`, status: 'completed', startedAt: '2026-11-22T04:00:00Z' })) };
      }
      return {};
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => jsonFor(url),
          text: async () => JSON.stringify(jsonFor(url)),
        } as Response;
      }),
    );
    await render(<OverviewPage />, '/overview');
    const runsUrls = urls.filter((u) => u.includes('/runs?'));
    expect(runsUrls.length).toBeGreaterThan(0);
    for (const u of runsUrls) expect(u).toContain('limit=3');
    const rows = container.querySelectorAll('[data-testid="ov6-activity-row"]');
    expect(rows.length).toBeLessThanOrEqual(3);
    expect(rows.length).toBe(3);
  });
});
