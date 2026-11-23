// @vitest-environment jsdom
// w192 条款5 收口：闸同款判据的 jsdom 行级钉测（scripts/assert-ui-contract.mjs clause5 的
// 卡内明细残留 = 空、缺查看明细 = 空两条，在强制数据下先红后绿）。
// 形制承 dutyPage.test.tsx（同一夹具骨架；只动本文件与 DutyPage.tsx，不改判定强度）。
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchJSON: (...args: unknown[]) => fetchJSON(...args),
}));

import DutyPage from "./DutyPage";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  fetchJSON.mockReset();
});

const WB_ASOF = "2026-11-18T06:00:00.000Z";

function ok(url: string): unknown {
  if (url.includes("/workbench/summary")) {
    return {
      asOf: WB_ASOF,
      asOfSource: "bff-aggregation-read-time",
      available: true,
      degraded: [],
      kpis: [
        { key: "runs", label: "运行数", unit: "次", value: 2, available: true },
        { key: "failed", label: "失败数", unit: "次", value: 1, available: true },
        { key: "failureRate", label: "失败率", unit: "ratio", value: 0.5, available: true },
        { key: "costUsd", label: "成本", unit: "USD", value: 1.5, available: true },
        { key: "activeEmployees", label: "在岗数字员工", unit: "个", value: 1, available: true },
        { key: "pendingApprovals", label: "待审批", unit: "条", value: 1, available: true },
      ],
    };
  }
  if (url.includes("/workbench/timeseries")) {
    return {
      asOf: WB_ASOF,
      asOfSource: "bff-read-time",
      available: true,
      points: [
        { ts: "2026-11-17T00:00:00.000Z", label: "11-17", value: 1 },
        { ts: "2026-11-18T00:00:00.000Z", label: "11-18", value: 2 },
      ],
      totals: { metric: "runs", value: 3 },
    };
  }
  if (url.includes("/workbench/queue")) {
    return {
      asOf: WB_ASOF,
      available: true,
      degraded: [],
      items: [
        { id: "apr_1", type: "approval", title: "供应商报价", status: "pending", createdAt: "2026-11-18T01:00:00.000Z", timeoutAt: null },
      ],
      total: 1,
    };
  }
  if (url.includes("/employee-stats")) {
    return { byLifecycle: { active: 1, paused: 0, offboarding: 0 } };
  }
  if (url.includes("/employees")) {
    return { items: [{ employeeId: "emp_1", name: "陈可", lifecycleState: "active", ownerUserId: "u_1" }] };
  }
  if (url.includes("/run-stats")) {
    return {
      totals: { runs: 2, succeeded: 1, failed: 1, running: 0, costUsd: 1.5 },
      buckets: [{ bucketStart: "2026-11-18T00:00:00Z", runs: 2, failed: 1 }],
    };
  }
  if (url.includes("/run-activity")) {
    return { max: 2, cells: [{ dow: 2, hour: 10, count: 2 }] };
  }
  if (url.includes("/budget-usage")) {
    return { items: [{ employeeId: "emp_1", costUsd: 1.5 }], missingEmployeeIds: [] };
  }
  if (url.includes("/approval-stats")) return { pending: 1, dueSoon: 0 };
  if (url.includes("/approvals")) {
    return { items: [{ approvalId: "apr_1", title: "供应商报价", status: "pending" }] };
  }
  if (url.includes("/tasks")) {
    return { items: [{ taskId: "tsk_1", title: "整理周报", status: "blocked" }] };
  }
  if (url.includes("/runs")) {
    return {
      items: [
        { runId: "run_abcdef123456", employeeId: "emp_1", status: "failed", startedAt: "2026-11-18T02:00:00Z" },
      ],
    };
  }
  return { items: [] };
}

async function render(ui: React.ReactNode) {
  await act(async () => {
    root.render(<MemoryRouter>{ui}</MemoryRouter>);
  });
  await act(async () => {});
}

// 闸同款探针（assert-ui-contract.mjs clause5 的选择器逐字复制）。
const FORBIDDEN = [".duty-gates", ".duty-list", ".duty-ranges", ".duty-runs-caliber", ".duty-notes"];

function dutyCards(): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-duty-testid^="duty-"][class*="duty-card"]'));
}

async function mount(): Promise<void> {
  fetchJSON.mockImplementation(async (u: unknown) => ok(String(u)));
  await render(<DutyPage />);
  expect(dutyCards().length, "非空转闸：页面必须渲染出 duty 卡").toBeGreaterThanOrEqual(3);
}

describe("条款5 收口（w192：卡内明细出卡 + 查看明细深链）", () => {
  it("卡内不残留明细结构（闸判据一：残留 = 空）", async () => {
    await mount();
    const offenders = dutyCards()
      .filter((card) => FORBIDDEN.some((sel) => card.querySelector(sel)))
      .map((card) => card.dataset.dutyTestid ?? "");
    expect(offenders).toEqual([]);
  });

  it("每张 duty 卡都有查看明细出口（闸判据二：缺查看明细 = 空）", async () => {
    await mount();
    const missing = dutyCards()
      .filter((card) => !card.querySelector("a.duty-card-foot, [data-testid^='duty-route-']"))
      .map((card) => card.dataset.dutyTestid ?? "");
    expect(missing).toEqual([]);
  });

  it("信息不删：出卡的明细由卡外折叠区承接，卡内留一行状态句", async () => {
    await mount();
    for (const id of ["duty-details-blockers", "duty-details-pending", "duty-details-recent"]) {
      const block = container.querySelector(`[data-testid="${id}"]`);
      expect(block, `卡外折叠区必须承接 ${id}`).not.toBeNull();
      expect(block!.querySelector(".duty-list"), `${id} 内必须有 .duty-list 明细`).not.toBeNull();
    }
    for (const id of ["duty-blockers-say", "duty-pending-say", "duty-recent-say"]) {
      expect(container.querySelector(`[data-testid="${id}"]`), `卡内必须有 ${id} 状态句`).not.toBeNull();
    }
    // 明细文案真的搬到了卡外（逐条内容在折叠区内可见）
    expect(container.querySelector('[data-testid="duty-details-pending"]')!.textContent).toContain("供应商报价");
    expect(container.querySelector('[data-testid="duty-details-blockers"]')!.textContent).toContain("整理周报");
  });
});
