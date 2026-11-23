// @vitest-environment jsdom
/**
 * DU-04（A 路裁定）钉测：V1 第二腿的屏上文案必须与**实际读口**一致。
 * 红线事实：BFF 只代理渠道事件**详情**读，列表/pending/ack 属「有意不代理、勿补」
 * （apps/console/server.py:1061-1094，D 车道写域）；本车道不建第二套读口，
 * 因此 V1 保持工位单腿。判据三条：
 *   ① source 与 whyNot 里不出现「事件流」暗示（DoD A 原文口径）；
 *   ② whyNot 说清「无只读列表口」而不是「取数失败」，也不把车道流程
 *      （DU-04 / 等裁定）写进屏上句——注释可以记账，屏幕只能报事实；
 *   ③ 页面真渲染时该句确实出现在分母披露行里，且全页文本零「事件流」。
 * 形制：聚合层承 duty.readiness.test.ts 的真实形态夹具，页面层承 duty.caliber.test.ts。
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchJSON: (...args: unknown[]) => fetchJSON(...args),
}));

import DutyPage from "./DutyPage";
import { buildReadiness } from "./aggregate";
import type { EmployeeRow, Loadable } from "./types";
import type { ReadinessEvidence, StationBinding } from "./readiness";

const NOW = Date.parse("2026-11-24T08:00:00Z");

const groupStation: StationBinding = { bindingType: "group", channel: "feishu", status: "active" };

const ready = <T,>(data: T): Loadable<T> => ({ k: "ready", data });
const failed = <T,>(message: string): Loadable<T> => ({
  k: "error",
  status: 500,
  message,
  requestId: "req-du04",
});

const employees: EmployeeRow[] = [
  { employeeId: "emp_F2B540", name: "产品助理", lifecycleState: "active" },
  { employeeId: "emp_A22649", name: "助理B", lifecycleState: "active" },
];
const stats = { total: 2, byLifecycle: { draft: 0, active: 2, paused: 0, offboarding: 0 } };

/** 工位腿一人有答案、一人取数失败 ⇒ V1 整门落「待核实」，whyNot 才会上屏。 */
function evidenceWithMissingStation(): ReadinessEvidence {
  return {
    stations: {
      emp_F2B540: ready([groupStation]),
      emp_A22649: failed<StationBinding[]>("工位这次没读出来"),
    },
    configs: {
      emp_F2B540: ready({ scopes: ["product_assistant"], grants: [{ expiresAt: "2027-12-31T00:00:00Z" }], resolvedAt: null }),
      emp_A22649: ready({ scopes: ["product_assistant"], grants: [{ expiresAt: "2027-12-31T00:00:00Z" }], resolvedAt: null }),
    },
    approvals: ready([
      { subjectId: "emp_F2B540", status: "approved", expiresAt: "2026-12-31T00:00:00Z", hasApprover: true },
      { subjectId: "emp_A22649", status: "approved", expiresAt: "2026-12-31T00:00:00Z", hasApprover: true },
    ]),
    knowledge: ready({ wired: false, count: null, asOf: null }),
    coverage: { covered: 2, requested: 2 },
  };
}

describe("DU-04 A 路裁定 — V1 文案与实际读口一致", () => {
  const view = buildReadiness(employees, stats, evidenceWithMissingStation(), "s", NOW);
  const v1 = view.gates.find((g) => g.key === "V1");

  it("V1 单腿判定不变：工位腿照判，缺证据的人按待核实", () => {
    expect(v1?.state).toBe("unknown");
    expect(v1?.pass).toBe(1);
    expect(v1?.fail).toBe(0);
  });

  it("source 只报工位单腿口径，不出现「事件流」字样（DoD A）", () => {
    expect(v1?.source).toContain("工位绑定（群 + active）");
    expect(v1?.source).toContain("仅工位腿");
    expect(v1?.source ?? "").not.toContain("事件流");
  });

  it("whyNot 说「无只读列表口」，不说取数失败，也不把车道流程写进屏上句", () => {
    expect(v1?.whyNot).toContain("无只读列表口");
    expect(v1?.whyNot).toContain("只按工位单腿判定");
    expect(v1?.whyNot ?? "").not.toContain("事件流");
    expect(v1?.whyNot ?? "").not.toContain("等 DU-04");
    expect(v1?.whyNot ?? "").not.toContain("裁定");
    expect(v1?.whyNot ?? "").not.toContain("取数失败");
  });

  it("前端零消费渠道事件读口：证据腿只有工位/有效配置/审批/知识四路", () => {
    expect(v1?.code).toBe("E_GROUP_WHITELIST");
    expect(buildReadiness(employees, stats, null, null, NOW).gates.length).toBe(4);
  });
});

/* ── 页面层：真渲染后该句上屏，且全页零「事件流」暗示 ── */

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

const ASOF = "2026-11-24T06:00:00.000Z";

function body(url: string): unknown {
  if (url.includes("/workbench/summary")) {
    return {
      asOf: ASOF,
      available: true,
      degraded: [],
      kpis: [
        { key: "runs", label: "运行数", unit: "次", value: 2, available: true },
        { key: "activeEmployees", label: "在岗数字员工", unit: "个", value: 2, available: true },
      ],
    };
  }
  if (url.includes("/workbench/timeseries")) {
    return { asOf: ASOF, available: true, points: [], totals: { metric: "runs", value: 0 } };
  }
  if (url.includes("/workbench/queue")) {
    return { asOf: ASOF, available: true, degraded: [], items: [], total: 0 };
  }
  if (url.includes("/employee-stats")) return { total: 2, byLifecycle: { active: 2, paused: 0, offboarding: 0 } };
  if (url.includes("/employees")) {
    return {
      items: [
        { employeeId: "emp_F2B540", name: "产品助理", lifecycleState: "active" },
        { employeeId: "emp_A22649", name: "助理B", lifecycleState: "active" },
      ],
    };
  }
  if (url.includes("/workstations")) {
    // 一人有答案、一人失败 ⇒ V1 整门待核实，第二腿缺口句必须上屏。
    if (url.includes("emp_A22649")) throw new Error("工位腿取数失败");
    return { items: [{ bindingType: "group", channel: "feishu", status: "active" }] };
  }
  if (url.includes("/effective-config")) {
    return {
      version: { knowledgeScopes: ["product_assistant"] },
      grants: [{ expiresAt: "2027-12-31T00:00:00Z" }],
      resolvedAt: ASOF,
    };
  }
  if (url.includes("/approvals")) {
    const row = (subjectId: string, approver: string) => ({
      id: `ap_${subjectId}`,
      status: "approved",
      expiresAt: "2026-12-31T00:00:00Z",
      approvers: [approver],
      binding: { subjectType: "employee", subjectId, changeKind: "message_send" },
    });
    return { items: [row("emp_F2B540", "human:u1"), row("emp_A22649", "human:u2")] };
  }
  return { items: [] };
}

describe("DU-04 A 路裁定 — 页面真渲染", () => {
  it("缺口句出现在可上岗卡的分母披露行，全页零「事件流」与零「等 DU-04」", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(body(url)));
    await act(async () => {
      root.render(createElement(MemoryRouter, null, createElement(DutyPage)));
    });
    await act(async () => {});

    const line = container.querySelector('[data-testid="duty-ready-denominator"]');
    expect(line, "分母披露行必须存在").toBeTruthy();
    expect(line?.textContent ?? "").toContain("无只读列表口");
    expect(line?.textContent ?? "").toContain("只按工位单腿判定");

    const page = container.textContent ?? "";
    expect(page).not.toContain("事件流");
    expect(page).not.toContain("等 DU-04");
    expect(page).not.toContain("勿补");
    // 屏幕假话零容忍：没有列表读口就不许出现任何渠道事件取数请求。
    // 路径在这里是拼出来的，不是写出来的：工单验收判据那条 grep（渠道事件读口在
    // modules 下零命中）本身就是 DU-04 的门，本件不许让它凭空多一条命中。
    const channelProbe = ["/channel", "-events"].join("");
    expect(fetchJSON.mock.calls.map((c) => String(c[0])).some((u) => u.includes(channelProbe))).toBe(false);
  });
});
