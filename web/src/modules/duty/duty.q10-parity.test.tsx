// @vitest-environment jsdom
// Q10 duty-filter-parity 契约钉测（条目 1/3/4/5/6）。先红后绿：每条钉住
// READY-BACKLOG「duty-filter-parity」的一项新行为，断言的是屏上可见形制，
// 不是实现细节。条目 2（能力矩阵四联筛选）归 matrix，不在此钉。
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchJSON: (...args: unknown[]) => fetchJSON(...args),
}));

import DutyPage from "./DutyPage";
import { buildReadiness } from "./aggregate";
import type { Loadable } from "./types";
import type { ReadinessEvidence } from "./readiness";

const ready = <T,>(data: T): Loadable<T> => ({ k: "ready", data } as Loadable<T>);

function emp(id: string): { employeeId: string; name: string; lifecycleState: string } {
  return { employeeId: id, name: id, lifecycleState: "active" };
}

const now = Date.parse("2026-11-23T06:00:00Z");

function evidenceFor(ids: string[], over: Partial<ReadinessEvidence> = {}): ReadinessEvidence {
  return {
    // V1 群@：全员有 active 群绑定 → pass
    stations: Object.fromEntries(ids.map((id) => [id, ready([{ bindingType: "group", status: "active" }])])),
    // V2 ReBAC：无 scopes → 全员 fail（最窄门候选）
    configs: Object.fromEntries(ids.map((id) => [id, ready({ scopes: [], grants: [], resolvedAt: null })])),
    // V3 引用：已接线且有文档 → 恒 unknown（第三腿未接）
    knowledge: ready({ wired: true, count: 5, asOf: null }),
    // V6 审批：无有效决策 → 全员 fail
    approvals: ready([]),
    // DU-01④：逐员工证据扇出覆盖 n/N（默认全员覆盖，非全量披露由 over 注入）
    coverage: { covered: ids.length, requested: ids.length },
    ...over,
  };
}

describe("Q10 条目4+5 · buildReadiness 纯函数", () => {
  it("最窄限制门置顶：gates[0] 是 fail 最多的已知门，其余保持原序", () => {
    const ids = ["e1", "e2", "e3"];
    const view = buildReadiness(
      ids.map(emp),
      { byLifecycle: { active: 3, paused: 0, offboarding: 0 } },
      evidenceFor(ids),
      null,
      now,
    );
    // V2 拦 3 人、V6 拦 3 人、V1 通过、V3 未知 → 最窄必是 V2/V6，且不在原序首位（原序 V1 在前）
    expect(view.narrowest).not.toBeNull();
    expect(view.gates[0].key).toBe(view.narrowest!.key);
    expect(["V2", "V6"]).toContain(view.gates[0].key);
    expect(view.gates.map((g) => g.key)).not.toEqual(["V1", "V2", "V3", "V6"]);
    expect(view.gates).toHaveLength(4);
  });

  it("交集句：人话说明四门叠加后的净效果，点名最窄门，且不编造净人数", () => {
    const ids = ["e1", "e2", "e3"];
    const view = buildReadiness(
      ids.map(emp),
      { byLifecycle: { active: 3, paused: 0, offboarding: 0 } },
      evidenceFor(ids),
      null,
      now,
    );
    // V3 恒 unknown → unknownGates=1 → confirmed=null，净效果句必须说「暂不给」而非给数
    expect(view.unknownGates).toBe(1);
    expect(view.confirmed).toBeNull();
    expect(view.netNote).toContain("最窄");
    expect(view.netNote).toContain(view.narrowest!.name);
    expect(view.netNote).toMatch(/暂不|未接|没有接入|不能判定/);
  });

  it("分母护栏：单页 limit 触顶时口径句点名「上限 100 · 非全量」", () => {
    const capped = Array.from({ length: 100 }, (_, i) => emp(`e${i}`));
    const view = buildReadiness(capped, { byLifecycle: { active: 100 } }, null, null, now);
    expect(view.denomNote).toContain("100");
    expect(view.denomNote).toMatch(/非全量|上限/);
    // 未触顶：如实说未触上限，不冒充「全量总数」以外的口径
    const small = buildReadiness([emp("e1")], { byLifecycle: { active: 1 } }, null, null, now);
    expect(small.denomNote).toContain("未触单页上限");
  });
});

// ── DOM 腿：整页挂载，mock 各读口 ──

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

async function render(ui: React.ReactNode) {
  await act(async () => {
    root.render(<MemoryRouter>{ui}</MemoryRouter>);
  });
  await act(async () => {});
}

function mountDuty() {
  fetchJSON.mockImplementation((url: string) => {
    if (url.includes("/workbench/queue")) {
      return Promise.resolve({
        asOf: "2026-11-23T05:00:00.000Z",
        asOfSource: "bff-read-time",
        available: true,
        degraded: [],
        items: [
          { id: "apr_1", type: "approval", title: "供应商报价", status: "pending", createdAt: "2026-11-23T01:00:00Z", timeoutAt: null },
          { id: "apr_2", type: "approval", title: "外发文案", status: "pending", createdAt: "2026-11-23T02:00:00Z", timeoutAt: null },
          { id: "apr_3", type: "approval", title: "退款确认", status: "pending", createdAt: "2026-11-23T03:00:00Z", timeoutAt: null },
        ],
        total: 7,
      });
    }
    if (url.includes("/approval-stats")) return Promise.resolve({ pending: 7, dueSoon: 0 });
    if (url.includes("/approvals")) {
      // 卡上阻塞源之一：pending 审批列表（status=all 的四门证据腿走默认空）
      return Promise.resolve({
        items: [
          { approvalId: "apr_1", title: "供应商报价", status: "pending", createdAt: "2026-11-23T01:00:00Z" },
          { approvalId: "apr_2", title: "外发文案", status: "pending", createdAt: "2026-11-23T02:00:00Z" },
          { approvalId: "apr_3", title: "退款确认", status: "pending", createdAt: "2026-11-23T03:00:00Z" },
        ],
      });
    }
    if (url.includes("/tasks")) {
      return Promise.resolve({
        items: [
          { taskId: "tsk_1", title: "整理周报", status: "blocked", updatedAt: "2026-11-22T01:00:00Z" },
          { taskId: "tsk_2", title: "对账", status: "blocked", updatedAt: "2026-11-22T02:00:00Z" },
          { taskId: "tsk_3", title: "素材补拍", status: "blocked", updatedAt: "2026-11-22T03:00:00Z" },
        ],
      });
    }
    if (url.includes("/runs")) {
      return Promise.resolve({
        items: [
          { runId: "run_aaaaaaaaaaaa", employeeId: "emp_1", status: "failed", startedAt: "2026-11-23T02:00:00Z" },
          { runId: "run_bbbbbbbbbbbb", employeeId: "emp_1", status: "completed", startedAt: "2026-11-23T03:00:00Z" },
          { runId: "run_cccccccccccc", employeeId: "emp_1", status: "completed", startedAt: "2026-11-23T04:00:00Z" },
        ],
      });
    }
    if (url.includes("/workstations")) {
      return Promise.resolve({ items: [{ bindingType: "group", status: "active" }] });
    }
    if (url.includes("/effective-config")) return Promise.resolve({});
    if (url.includes("/knowledge/documents")) {
      return Promise.resolve({ items: [{ id: "doc_1" }, { id: "doc_2" }] });
    }
    if (url.includes("/employee-stats")) return Promise.resolve({ byLifecycle: { active: 1, paused: 0, offboarding: 0 } });
    if (url.includes("/employees")) {
      return Promise.resolve({ items: [{ employeeId: "emp_1", name: "陈可", lifecycleState: "active", ownerUserId: "u_1" }] });
    }
    if (url.includes("/run-stats")) {
      return Promise.resolve({
        totals: { runs: 2, succeeded: 1, failed: 1, running: 0, costUsd: 1.5 },
        buckets: [{ bucketStart: "2026-11-23T00:00:00Z", runs: 2, failed: 1 }],
      });
    }
    if (url.includes("/run-activity")) return Promise.resolve({ max: 1, cells: [{ dow: 1, hour: 10, count: 1 }] });
    if (url.includes("/budget-usage")) return Promise.resolve({ items: [{ employeeId: "emp_1", costUsd: 1.5 }], missingEmployeeIds: [] });
    return Promise.resolve({ items: [] });
  });
  return render(<DutyPage />);
}

describe("Q10 条目1/3/4/5/6 · DutyPage 屏上形制", () => {
  it("条目1：页头时间范围筛选四档齐、默认 14d 按下", async () => {
    await mountDuty();
    const group = container.querySelector('[role="group"][aria-label="时间范围"]');
    expect(group, "页头必须有时间范围筛选组").not.toBeNull();
    for (const id of ["24h", "7d", "14d", "30d"]) {
      expect(container.querySelector(`[data-testid="duty-range-${id}"]`), `档位 ${id}`).not.toBeNull();
    }
    expect(container.querySelector('[data-testid="duty-range-14d"]')?.getAttribute("aria-pressed")).toBe("true");
  });

  it("条目3：三卡「查看全部 (N)」带总数，且披露被截条数", async () => {
    await mountDuty();
    const pending = container.querySelector('[data-testid="duty-route-pending"]');
    expect(pending?.textContent, "审批卡按钮须带服务端总数").toContain("查看全部 (7)");
    const blockers = container.querySelector('[data-testid="duty-route-blockers"]');
    // 1 组失败运行 + 3 任务 + 3 审批 = 7 项读到
    expect(blockers?.textContent).toContain("查看全部 (7)");
    const recent = container.querySelector('[data-testid="duty-route-recent"]');
    expect(recent?.textContent).toContain("查看全部 (3)");

    const pend = container.querySelector('[data-testid="duty-details-pending"]');
    expect(pend?.textContent).toContain("另有 4 条未在本页列出"); // 7 − 3
    const blk = container.querySelector('[data-testid="duty-details-blockers"]');
    expect(blk?.textContent).toContain("另有 4 条未在本页列出"); // 7 − 3
    expect(blk?.querySelectorAll(".duty-blocker")).toHaveLength(3); // 上限截断
    // 失真话术销案：明细在卡外且只列前 3，不得再写「已在本卡逐条列出」
    expect(container.textContent).not.toContain("阻塞项已在本卡逐条列出");
  });

  it("条目4：检查项区最窄门置顶 + 交集句上屏", async () => {
    await mountDuty();
    const first = container.querySelector(".duty-gates .duty-gate");
    // 1 员工：V2 fail 1 / V6 fail 1 / V1 pass / V3 unknown → 最窄=V2，原序首位 V1 被顶掉
    expect(first?.getAttribute("data-testid")).toBe("ov6-gate-V2");
    const net = container.querySelector('[data-testid="duty-gates-net"]');
    expect(net, "交集句必须有名有姓上屏").not.toBeNull();
    expect(net?.textContent).toContain("最窄");
    expect(net?.textContent).toContain("ReBAC");
  });

  it("条目5：分母口径句上屏（本页人数 + 上限/全量语义）", async () => {
    await mountDuty();
    const cal = container.querySelector('[data-testid="duty-denominator-caliber"]');
    expect(cal, "分母口径句必须存在").not.toBeNull();
    expect(cal?.textContent).toContain("本页 1 人");
    expect(cal?.textContent).toContain("未触单页上限");
  });

  it("条目6：页头刷新可点；导出日报无后端 → aria-disabled 且可辨", async () => {
    await mountDuty();
    expect(container.querySelector('[data-testid="duty-refresh"]')).not.toBeNull();
    const ex = container.querySelector('[data-testid="duty-export-daily"]') as HTMLButtonElement | null;
    expect(ex, "页头必须有导出日报动作位").not.toBeNull();
    expect(ex!.getAttribute("aria-disabled")).toBe("true");
    expect(ex!.disabled, "aria-disabled 不是原生 disabled：钮必须可聚焦可辨").toBe(false);
    expect(ex!.hasAttribute("data-planned"), "无后端占位须带 data-planned（参考 :6641-6649 形制）").toBe(true);
    expect(ex!.getAttribute("title")).toContain("后端");
    const head = container.querySelector(".duty-head-actions");
    expect(head?.textContent, "无动作原因必须可见，不能只藏 tooltip").toContain("计划中");
  });
});
