// @vitest-environment jsdom
/**
 * 可上岗卡的门数学口径（2026-11-24 产品口径变更）：
 * - 交集只取有读口的门（V1/V2/V6）；V3 引用门无读口，整门排除但保留一行。
 * - 主数字分母 = 「可判定门能给出判定的员工数」，不是全部分母行。
 * - 三段条按真实计数画，未知段有值必须画出。
 *
 * 允许 V3 不进分母的理由：V3 的 pass 需要「强制引用策略可读」，而 BFF 从未接线
 * 这条策略读口（api.ts 恒 policy.wired:false）。把它留在分母会让整张卡恒为
 * 「— / —」，读者既看不到其它三门的真读数，也看不到真实的可上岗人数。
 */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OverviewView } from './OverviewPage';
import type { DutyData } from '../duty/useDutyData';
import type { ReadinessEvidence } from '../duty/readiness';

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
});

const ready = <T,>(data: T) => ({ k: 'ready' as const, data });

async function render(node: ReactNode) {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={['/overview']}>{node}</MemoryRouter>);
  });
  await act(async () => {});
}

function evidence(over: Partial<ReadinessEvidence> = {}): ReadinessEvidence {
  return {
    stations: {
      // emp_1 有群绑定；emp_2 只有 dm ⇒ V1 fail（真读数）
      emp_1: ready([{ bindingType: 'group', channel: 'feishu', status: 'active' }]),
      emp_2: ready([{ bindingType: 'dm', channel: 'feishu', status: 'active' }]),
    },
    configs: {
      emp_1: ready({ scopes: ['product_assistant'], grants: [{ expiresAt: '2027-12-31T00:00:00Z' }], resolvedAt: null }),
      emp_2: ready({ scopes: ['product_assistant'], grants: [{ expiresAt: '2027-12-31T00:00:00Z' }], resolvedAt: null }),
    },
    // V6：emp_1 有有效审批，emp_2 没有 ⇒ emp_1 三门全过
    approvals: ready([{ subjectId: 'emp_1', status: 'approved', expiresAt: '2027-01-31T00:00:00Z', hasApprover: true }]),
    // V3：文档腿未接线、策略腿无读口 ⇒ unknown，且整门不进交集
    knowledge: ready({ wired: false, count: null, asOf: null }),
    coverage: { covered: 2, requested: 2 },
    ...over,
  };
}

function data(readiness: ReadinessEvidence | null): DutyData {
  return {
    employees: ready([
      { employeeId: 'emp_1', name: '陈可', lifecycleState: 'active' },
      { employeeId: 'emp_2', name: '林一舟', lifecycleState: 'active' },
    ]),
    stats: ready({ byLifecycle: { active: 2, paused: 0, offboarding: 0 }, asOf: '2026-11-24T04:20:00Z' }),
    todayStats: ready({ totals: { runs: 0, failed: 0, succeeded: 0 }, asOf: '2026-11-24T04:21:00Z' }),
    stats14: ready({ asOf: '2026-11-24T04:22:00Z', buckets: [] }),
    activity: ready({ cells: [] }),
    budgetDay: ready({ items: [], missingEmployeeIds: [] }),
    budgetMonth: ready({ items: [], missingEmployeeIds: [] }),
    approvalStats: ready({ pending: 0 }),
    approvals: ready([]),
    todayRuns: ready([]),
    recentRuns: ready([]),
    failedRuns: ready([]),
    blockedTasks: ready([]),
    readiness: readiness ? ready(readiness) : { k: 'loading' },
  } as unknown as DutyData;
}

const card = () => container.querySelector('[data-testid="ov6-kpi-employees"]')!;
const text = (sel: string) => card().querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('可上岗卡：可判定门取交集（V3 不进分母）', () => {
  it('主数字位 = 可判定门全过人数 / 可判定门能给出判定的人数，并注明基于 3 门', async () => {
    await render(<OverviewView data={data(evidence())} matrix={ready({ items: [] })} loading={false} onRetry={() => {}} />);

    expect(card().querySelector('.ov5-kpi-value')?.textContent).toBe('1');
    expect(text('.ov5-unit')).toContain('/ 2 可上岗');
    expect(text('.ov5-kpi-note')).toBe('交集基于 3 门（V3 引用门无读口，未计入）');
    expect(text('.ov5-kpi-meta')).toContain('可判定 3 门交集');
  });

  it('四门表保留 V3 行：值写「未接策略」，行尾说明不影响其它三门交集', async () => {
    await render(<OverviewView data={data(evidence())} matrix={ready({ items: [] })} loading={false} onRetry={() => {}} />);

    const rows = Array.from(card().querySelectorAll('.ov5-gate')) as HTMLElement[];
    expect(rows).toHaveLength(4);
    const v3 = rows.find((row) => row.querySelector('.ov5-gv')?.textContent?.includes('未接策略'))!;
    expect(v3).toBeTruthy();
    expect(v3.textContent).toContain('上游无强制引用策略读口；不影响其它三门交集');
    // 其它三门是实数字，不是「— / —」
    const values = rows
      .map((row) => row.querySelector('.ov5-gv')?.textContent?.replace(/\s+/g, ' ').trim())
      .filter((v) => v && v !== '未接策略');
    expect(values).toEqual(['1 / 2', '2 / 2', '1 / 2']);
  });

  it('callout 只点没读口的门，并给出可判定门的交集人数', async () => {
    await render(<OverviewView data={data(evidence())} matrix={ready({ items: [] })} loading={false} onRetry={() => {}} />);
    const callout = text('.ov5-hnarrow');
    expect(callout).toContain('可判定 3 门交集 1 人可上岗');
    expect(callout).toContain('引用门无读口，未计入');
    // 有读口的三门不再被说成「无读口」
    expect(callout).not.toContain('群@、ReBAC');
  });

  it('三段条按真实计数画：绿 50% / 红 50%，未知 0 不画', async () => {
    await render(<OverviewView data={data(evidence())} matrix={ready({ items: [] })} loading={false} onRetry={() => {}} />);
    const svg = card().querySelector('.ov5-stack-svg')!;
    expect(svg.querySelector('rect.ok')?.getAttribute('width')).toBe('50');
    expect(svg.querySelector('rect.bad')?.getAttribute('width')).toBe('50');
    expect(svg.querySelector('rect.unknown')).toBeNull();
    expect(text('.ov5-legend')).toContain('1 可上岗');
    expect(text('.ov5-legend')).toContain('1 受限');
    expect(text('.ov5-legend')).toContain('0 未知');
  });

  it('未知段有值时也画出（缺一条读口 → 该员工进未知段，不进交集分母）', async () => {
    const partial = evidence();
    // emp_2 的有效配置腿没有回答 ⇒ V2 对 emp_2 给不出判定 ⇒ 该员工落「未知」，
    // 交集分母随之变成「能判定的 1 人」——这是分母口径，不是丢行。
    delete (partial.configs as Record<string, unknown>).emp_2;
    partial.stations = {
      ...partial.stations,
      emp_2: ready([{ bindingType: 'group', channel: 'feishu', status: 'active' }]),
    };
    partial.approvals = ready([
      { subjectId: 'emp_1', status: 'approved', expiresAt: '2027-01-31T00:00:00Z', hasApprover: true },
      { subjectId: 'emp_2', status: 'approved', expiresAt: '2027-01-31T00:00:00Z', hasApprover: true },
    ]);
    await render(<OverviewView data={data(partial)} matrix={ready({ items: [] })} loading={false} onRetry={() => {}} />);

    expect(card().querySelector('.ov5-kpi-value')?.textContent).toBe('1');
    expect(text('.ov5-unit')).toContain('/ 1 可上岗');
    const svg = card().querySelector('.ov5-stack-svg')!;
    expect(svg.querySelector('rect.ok')?.getAttribute('width')).toBe('50');
    expect(svg.querySelector('rect.unknown')?.getAttribute('width')).toBe('50');
    expect(text('.ov5-legend')).toContain('1 未知');
  });

  it('可判定门全未回答时才写「—」，并点名缺哪几门', async () => {
    const dark = evidence({ stations: {}, configs: {}, approvals: { k: 'error', status: 0, message: '审批腿没回答', requestId: null } });
    await render(<OverviewView data={data(dark)} matrix={ready({ items: [] })} loading={false} onRetry={() => {}} />);
    expect(card().querySelector('.ov5-kpi-value')?.textContent).toBe('—');
    expect(text('.ov5-kpi-note')).toContain('缺：');
    expect(text('.ov5-kpi-note')).toContain('群@');
    expect(text('.ov5-kpi-note')).toContain('ReBAC');
    expect(text('.ov5-kpi-note')).toContain('审批');
  });
});