/**
 * 四门判定的行为契约（PRD v4 §2）。夹具取自 2026-11-23 :8092 BFF 真实回包
 * （F2B540 群绑定 active / A22649 仅 dm，无群绑定；审批 10×message.send 全过期）。
 */
import { describe, expect, it } from "vitest";
import {
  rollup,
  v1Verdict,
  v2Verdict,
  v3Verdict,
  v6Verdict,
  type ApprovalEvidence,
  type StationBinding,
} from "./readiness";
import { buildReadiness } from "./aggregate";
import type { EmployeeRow, Loadable } from "./types";
import type { ReadinessEvidence } from "./readiness";

const NOW = Date.parse("2026-11-23T08:00:00Z");

const groupStation: StationBinding = {
  bindingType: "group",
  channel: "feishu",
  status: "active",
  capabilities: ["reply", "stream"],
};
const dmStation: StationBinding = {
  bindingType: "dm",
  channel: "feishu",
  status: "active",
  capabilities: ["reply"],
};
const suspendedApp: StationBinding = {
  bindingType: "app",
  channel: "bisheng",
  status: "suspended",
};

describe("V1 群@", () => {
  it("群绑定 active 通过；仅 dm 或全部挂起不通过", () => {
    expect(v1Verdict([groupStation])).toBe("pass");
    expect(v1Verdict([dmStation, suspendedApp])).toBe("fail");
    expect(v1Verdict([])).toBe("fail");
  });
  it("群绑定存在但 suspended 不通过", () => {
    expect(v1Verdict([{ ...groupStation, status: "suspended" }])).toBe("fail");
  });
});

describe("V2 ReBAC", () => {
  it("scopes 非空且有未过期 grant 通过", () => {
    expect(
      v2Verdict({ scopes: ["product_assistant"], grants: [{ expiresAt: "2027-12-31T00:00:00Z" }], resolvedAt: null }, NOW),
    ).toBe("pass");
  });
  it("grant 全过期或 scopes 为空不通过；expiresAt 为 null 视为不过期", () => {
    expect(v2Verdict({ scopes: ["s"], grants: [{ expiresAt: "2026-01-01T00:00:00Z" }], resolvedAt: null }, NOW)).toBe("fail");
    expect(v2Verdict({ scopes: [], grants: [{ expiresAt: null }], resolvedAt: null }, NOW)).toBe("fail");
    expect(v2Verdict({ scopes: ["s"], grants: [{ expiresAt: null }], resolvedAt: null }, NOW)).toBe("pass");
  });
});

describe("V3 引用", () => {
  it("知识读侧未接线 → unknown（未接），不编造 0", () => {
    expect(v3Verdict({ wired: false, count: null, asOf: null })).toBe("unknown");
  });
  it("已接线且目录为空 → fail；有文档但策略腿未接 → 仍待核实", () => {
    expect(v3Verdict({ wired: true, count: 0, asOf: null })).toBe("fail");
    expect(v3Verdict({ wired: true, count: 3, asOf: null })).toBe("unknown");
  });
  it("最小真口径：文档>0 ∧ 强制引用策略可读 → pass；策略不可读绝不假 pass", () => {
    const docs = { wired: true, count: 3, asOf: null };
    expect(v3Verdict({ ...docs, policy: { wired: true, reason: "" } })).toBe("pass");
    expect(v3Verdict({ ...docs, policy: { wired: false, reason: "无读口" } })).toBe("unknown");
    expect(v3Verdict({ ...docs, policy: null })).toBe("unknown");
  });
  it("回包形状漂移（wired 但 count 缺失）→ unknown，不把缺数当 0 判 fail", () => {
    expect(v3Verdict({ wired: true, count: null, asOf: null })).toBe("unknown");
  });
});

describe("V6 审批", () => {
  const rows: ApprovalEvidence[] = [
    { subjectId: "emp_F2B540", status: "expired", expiresAt: "2026-11-10T00:00:00Z", hasApprover: true },
    { subjectId: "emp_F2B540", status: "consumed", expiresAt: "2026-11-14T22:18:00Z", hasApprover: true },
  ];
  it("过期/已消耗的 message_send 决策不构成有效审批（真实回包形态）", () => {
    expect(v6Verdict(rows, "emp_F2B540", NOW)).toBe("fail");
    expect(v6Verdict(rows, "emp_A22649", NOW)).toBe("fail");
  });
  it("有审批人且未过期的 approved 决策通过；无审批人不通过", () => {
    const live: ApprovalEvidence[] = [
      { subjectId: "emp_x", status: "approved", expiresAt: "2026-12-31T00:00:00Z", hasApprover: true },
    ];
    expect(v6Verdict(live, "emp_x", NOW)).toBe("pass");
    expect(v6Verdict([{ ...live[0], hasApprover: false }], "emp_x", NOW)).toBe("fail");
    expect(v6Verdict([{ ...live[0], expiresAt: "2026-11-01T00:00:00Z" }], "emp_x", NOW)).toBe("fail");
  });
});

describe("rollup", () => {
  it("无一行有证据 → pass=null（未接），全 unknown 也不给 0/0", () => {
    expect(rollup([null, null])).toEqual({ pass: null, fail: null, unknown: 2, state: "unknown" });
    expect(rollup(["unknown", "unknown"])).toEqual({ pass: null, fail: null, unknown: 2, state: "unknown" });
  });
  it("有 fail 即 fail；无 fail 有 unknown 为待核实", () => {
    expect(rollup(["pass", "fail"]).state).toBe("fail");
    expect(rollup(["pass", null]).state).toBe("unknown");
    expect(rollup(["pass", "pass"]).state).toBe("pass");
  });
});

/* ── buildReadiness 端到端（真实形态数据） ── */

const employees: EmployeeRow[] = [
  { employeeId: "emp_F2B540", name: "产品助理", lifecycleState: "active" },
  { employeeId: "emp_A22649", name: "助理B", lifecycleState: "active" },
  { employeeId: "emp_2E940B", name: "草稿", lifecycleState: "draft" },
];
const stats = { total: 3, byLifecycle: { draft: 1, active: 2, paused: 0, offboarding: 0 } };

const ready = <T,>(data: T): Loadable<T> => ({ k: "ready", data });

const evidence: ReadinessEvidence = {
  stations: {
    emp_F2B540: ready([groupStation]),
    emp_A22649: ready([dmStation, suspendedApp]),
  },
  configs: {
    emp_F2B540: ready({ scopes: ["product_assistant", "nist-ai-rmf-100-1"], grants: [{ expiresAt: "2026-12-31T00:00:00Z" }, { expiresAt: "2027-12-31T00:00:00Z" }], resolvedAt: null }),
    emp_A22649: ready({ scopes: ["product_assistant"], grants: [{ expiresAt: "2027-12-31T00:00:00Z" }], resolvedAt: null }),
  },
  approvals: ready([
    { subjectId: "emp_F2B540", status: "expired", expiresAt: "2026-11-10T00:00:00Z", hasApprover: true },
    { subjectId: "emp_F2B540", status: "consumed", expiresAt: "2026-11-14T22:18:00Z", hasApprover: true },
  ]),
  knowledge: ready({ wired: false, count: null, asOf: null }),
  coverage: { covered: 2, requested: 2 },
};

describe("buildReadiness — 2026-11-23 现网真实读数", () => {
  const view = buildReadiness(employees, stats, evidence, "2026-11-23 16:00", NOW);

  it("分母 = active+paused+offboarding = 2；draft 不入", () => {
    expect(view.total).toBe(2);
  });
  it("V1 1/2 通过、V2 2/2 通过、V6 0/2 通过（真实读数非占位）", () => {
    const g = Object.fromEntries(view.gates.map((x) => [x.key, x]));
    expect(g.V1.pass).toBe(1);
    expect(g.V1.fail).toBe(1);
    expect(g.V1.state).toBe("fail");
    expect(g.V2.pass).toBe(2);
    expect(g.V2.state).toBe("pass");
    expect(g.V6.pass).toBe(0);
    expect(g.V6.fail).toBe(2);
    expect(g.V6.inferred).toBeUndefined();
  });
  it("V3 知识读侧未接线 → 待核实且 pass=null（显示「未接」），计入 unknownGates", () => {
    const v3 = view.gates.find((g) => g.key === "V3");
    expect(v3?.state).toBe("unknown");
    expect(v3?.pass).toBeNull();
    expect(view.unknownGates).toBe(1);
  });
  it("存在 unknown 门时不给出伪权威总数：confirmed=null", () => {
    expect(view.confirmed).toBeNull();
  });
  it("四门全有证据且无 unknown 时才报分子", () => {
    const wired = structuredClone(evidence);
    wired.knowledge = { k: "ready", data: { wired: true, count: 2, asOf: null } }; // 仍 unknown（策略/运行腿）
    const failAll = buildReadiness(employees, stats, wired, "s", NOW);
    expect(failAll.unknownGates).toBe(1);
    expect(failAll.confirmed).toBeNull();

    const wired0 = structuredClone(evidence);
    wired0.knowledge = { k: "ready", data: { wired: true, count: 0, asOf: null } };
    wired0.approvals = {
      k: "ready",
      data: [
        { subjectId: "emp_F2B540", status: "approved", expiresAt: "2026-12-31T00:00:00Z", hasApprover: true },
        { subjectId: "emp_A22649", status: "approved", expiresAt: null, hasApprover: true },
      ],
    };
    wired0.stations.emp_A22649 = { k: "ready", data: [groupStation] };
    const allPass = buildReadiness(employees, stats, wired0, "s", NOW);
    // V3 wired+count>0 → 仍 unknown；count=0 → fail。构造 count>0 的通过态不可能，
    // 用 count=0 的 fail 验证「无 unknown 门时报分子」路径：
    expect(allPass.unknownGates).toBe(0);
    expect(allPass.confirmed).toBe(0); // V3 全 fail → 分子 0，分母 2
    expect(allPass.gates.find((g) => g.key === "V3")?.state).toBe("fail");
  });
  it("证据腿仍在途（evidence=null）时四门按未接处理，不报数", () => {
    const loading = buildReadiness(employees, stats, null, null, NOW);
    expect(loading.gates.every((g) => g.state === "unknown" && g.pass === null)).toBe(true);
    expect(loading.confirmed).toBeNull();
  });
});

/* ── DU-01④⑤：三分态、分母与扇出披露、V3 结论句、禁假数字 ── */

describe("三分态与分母披露（DU-01）", () => {
  it("三桶之和恒等于分母；有显式 fail 归「未达」，不冒充百分比", () => {
    const view = buildReadiness(employees, stats, evidence, "s", NOW);
    const b = view.buckets;
    expect(b).not.toBeNull();
    expect(b!.confirmed + b!.pending + b!.failing).toBe(2);
    // 真实形态：两人 V6 全 fail（决策过期）→ 双双「未达」；「已确认」一个不给。
    expect(b).toEqual({ confirmed: 0, pending: 0, failing: 2 });
    expect(view.confirmed).toBeNull(); // unknownGates>0 的 null 链保持
  });

  it("扇出未覆盖的分母行按待核实，并披露「本轮逐员工判定覆盖 n/N」", () => {
    const three = [...employees, { employeeId: "emp_C3C3C3", name: "第三员工", lifecycleState: "active" }];
    const stats3 = { total: 4, byLifecycle: { draft: 1, active: 3, paused: 0, offboarding: 0 } };
    const ev = structuredClone(evidence);
    ev.coverage = { covered: 2, requested: 3 };
    // 审批腿本轮没回答：未覆盖行才真正落「待核实」（若审批腿回答了而缺该员工行，
    // v6Verdict 给的是真 fail——「没有有效决策」是可证明的未达，不是猜测）。
    ev.approvals = { k: "error", status: 0, message: "审批腿未回答", requestId: null };
    const view = buildReadiness(three, stats3, ev, "s", NOW);
    // F2B540：V1 pass、V3 unknown、V6 未回答 → 待核实；A22649：V1 fail 是真读数 → 未达；
    // emp_C3C3C3：扇出未覆盖（工位/配置都没有回答）且无任何显式 fail → 待核实。
    expect(view.buckets).toEqual({ confirmed: 0, pending: 2, failing: 1 });
    expect(view.denominatorNote).toContain("本轮逐员工判定覆盖 2/3，其余 1 名按待核实");
  });

  it("目录单页拉满=证明不了全量：不给任何计数，整组按证据不完整并披露「非全量」", () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      employeeId: `emp_${i}`,
      name: `员工${i}`,
      lifecycleState: "active",
    }));
    const bigStats = { total: 100, byLifecycle: { draft: 0, active: 100, paused: 0, offboarding: 0 } };
    const view = buildReadiness(rows, bigStats, evidence, "s", NOW);
    expect(view.buckets).toBeNull();
    expect(view.confirmed).toBeNull();
    expect(view.gates.every((g) => g.state === "unknown" && g.pass === null)).toBe(true);
    expect(view.denominatorNote).toContain("非全量");
  });

  it("V3 unknown 的 whyNot 是给不出的原因句，source 不再谎称「取数失败」", () => {
    const view = buildReadiness(employees, stats, evidence, "s", NOW);
    const v3 = view.gates.find((g) => g.key === "V3");
    expect(v3?.state).toBe("unknown");
    expect(v3?.whyNot).toContain("可引用文档读口未接线");
    expect(v3?.whyNot).toContain("强制引用策略");
    expect(v3?.source).not.toContain("取数失败");
  });

  it("禁假数字：两腿真读数齐了 V3 才 pass，此时才报得出已确认", () => {
    const wired = structuredClone(evidence);
    wired.knowledge = ready({
      wired: true,
      count: 5,
      asOf: "2026-11-23T15:00:00Z",
      source: "bisheng:/api/v1/knowledge",
      policy: { wired: true, reason: "" },
    });
    wired.approvals = ready([
      { subjectId: "emp_F2B540", status: "approved", expiresAt: "2026-12-31T00:00:00Z", hasApprover: true },
      { subjectId: "emp_A22649", status: "approved", expiresAt: null, hasApprover: true },
    ]);
    wired.stations.emp_A22649 = ready([groupStation]);
    const view = buildReadiness(employees, stats, wired, "s", NOW);
    expect(view.gates.find((g) => g.key === "V3")?.state).toBe("pass");
    expect(view.unknownGates).toBe(0);
    expect(view.confirmed).toBe(2);
    expect(view.buckets).toEqual({ confirmed: 2, pending: 0, failing: 0 });
  });
});
