// @vitest-environment jsdom
/**
 * AP-04 — 决策写开关：探测形制＋禁用形态（本轮不开闸，默认仍为关）。
 *
 * 钉死的四件事（工单④步＋DoD）：
 * ① 合取判据：disabled = ¬(服务端探测「开且拒绝」 ∧ 构建期旗标 ∧ AP-05/06 负例证明)，
 *    缺任一 ⇒ disabled:true，且原因句仍是 P0-1r 原句逐字（禁第二套词汇）。
 * ② 探测腿的请求形制：只对写路由发 OPTIONS，永不发 POST（零真写尝试红线）；
 *    判据只认确定性答复——405+console.read_only=关、401=未鉴权、403+approval.*=开且拒绝、
 *    其余（含 2xx OPTIONS：代理层替答，不是写路由在场）= unknown，按关处理；
 *    探测失败/超时= unknown=关，不猜成功，也不拿失败当 405 报。
 * ③ 页头只读 chip：值＋来源＋采集时刻；探测没回话时「—」＋原因句，不拿当前时间冒充。
 * ④ 关态形态：决策钮 disabled＋aria-disabled＋同一句话，点击零决定请求、零 dialog。
 *
 * 形制注记（本 fork 实态，非臆造）：决策区只有「批准/驳回」两个写钮
 * （api.ts Verdict="approve"|"reject"）；「要求修改」在本仓只是状态标签
 * （model.ts REVISE），没有提交钮实体——DoD 的三钮口径按两钮＋备注输入落地。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import {
  DECISION_PATH,
  PROBE_METHOD,
  PROBE_SOURCE,
  classifyProbeResponse,
  probeWriteDecisionRoute,
} from "@/modules/approvals/api";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** P0-1r 原句——合取缺位时必须逐字回到它，禁第二套词汇。 */
const READONLY_SENTENCE =
  "这个环境的控制台只读：实测决定提交一律被拒（服务端当前只允许读请求，写请求没有入口）。所以批准、驳回在这里以禁用态出现，点它不会发起任何请求；要处理这张单，请走它原本产生决定的渠道。";

/** 现网写路由关时的真答复形制（AP-06 存证 raw-decision-route-options）。 */
const readOnlyResponse = (): Response =>
  new Response('{"code": "console.read_only", "message": "first console is read-only; only GET/HEAD allowed"}', {
    status: 405,
    headers: { "Content-Type": "application/json", Allow: "GET, HEAD" },
  });

interface ProbeCall {
  url: string;
  method: string;
}

/** 替 global fetch 装上可计数的嘴：记录请求形制，按剧本答复。 */
function stubFetch(responder: () => Promise<Response> | Response): ProbeCall[] {
  const calls: ProbeCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), method: (init?.method ?? "GET").toUpperCase() });
      return responder();
    }),
  );
  return calls;
}

beforeEach(() => {
  api.fetchJSON.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("AP-04② 分类器：只有确定性答复才算数", () => {
  it("405+console.read_only=关；401=未鉴权；403+approval.*=开且拒绝；其余一律 unknown", () => {
    expect(classifyProbeResponse(405, "console.read_only")).toBe("closed");
    expect(classifyProbeResponse(401, "console.unauthenticated")).toBe("unauthenticated");
    expect(classifyProbeResponse(403, "approval.not_approver")).toBe("open-denied");
    // 2xx OPTIONS 不许当「开」：代理层替源站答探测，是常见假阳性。
    expect(classifyProbeResponse(200, null)).toBe("unknown");
    expect(classifyProbeResponse(204, null)).toBe("unknown");
    // 非专码的 403（CSRF 闸等）说明不了审批名单在场。
    expect(classifyProbeResponse(403, "console.csrf_origin")).toBe("unknown");
    expect(classifyProbeResponse(403, null)).toBe("unknown");
    // 502/404/500 都不是能力证明。
    expect(classifyProbeResponse(502, "console.upstream_unavailable")).toBe("unknown");
    expect(classifyProbeResponse(405, "something.else")).toBe("unknown");
  });
});

describe("AP-04② 探测腿：OPTIONS 只读、永不发写、失败按关", () => {
  it("写路由关（现网态）：405 console.read_only ⇒ closed，来源与时刻齐", async () => {
    const calls = stubFetch(readOnlyResponse);
    const evidence = await probeWriteDecisionRoute();
    expect(evidence.verdict).toBe("closed");
    expect(evidence.status).toBe(405);
    expect(evidence.code).toBe("console.read_only");
    expect(typeof evidence.observedAt).toBe("number");
    expect(evidence.source).toBe(PROBE_SOURCE);
    // 恰好一发、只发 OPTIONS、发在写路由本身。
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe(PROBE_METHOD);
    expect(calls[0].url).toBe(DECISION_PATH);
  });

  it("上游 502/断连/超时 ⇒ unknown＋无采集时刻——不猜成功，也不拿尝试时间冒充", async () => {
    for (const responder of [
      () => new Response('{"code":"console.upstream_unavailable"}', { status: 502 }),
      () => Promise.reject(new Error("ConnectionRefused: 7860 down since 01:12")),
    ]) {
      stubFetch(responder);
      const evidence = await probeWriteDecisionRoute();
      expect(evidence.verdict).toBe("unknown");
      expect(evidence.observedAt).toBeNull();
    }
  });

  it("401（BFF 活着、会话没建）⇒ unauthenticated，单独一档不混进 closed", async () => {
    stubFetch(() => new Response('{"code":"console.unauthenticated"}', { status: 401 }));
    const evidence = await probeWriteDecisionRoute();
    expect(evidence.verdict).toBe("unauthenticated");
    expect(evidence.observedAt).not.toBeNull();
  });
});

describe("AP-04① 合取判据：缺任一输入即关，原因句逐字不动", () => {
  /** 干净模块态的 writeGate（探测结果/旗标随各用例剧本注入）。 */
  async function freshGate(envWriteFlag?: string): Promise<typeof import("@/modules/approvals/writeGate")> {
    vi.resetModules();
    if (envWriteFlag !== undefined) {
      vi.stubEnv("VITE_AGENT_APPROVAL_WRITE", envWriteFlag);
    } else {
      vi.stubEnv("VITE_AGENT_APPROVAL_WRITE", "");
    }
    return import("@/modules/approvals/writeGate");
  }

  it("默认（无 env、无探测）：disabled:true＋原句；构建期旗标读取=false、负例证明=false", async () => {
    stubFetch(readOnlyResponse);
    const gate = await freshGate();
    expect(gate.FRONTEND_WRITE_FLAG).toBe(false);
    expect(gate.NEGATIVE_PROOFS_ACCEPTED).toBe(false);
    expect(gate.DECISION_GATE.disabled).toBe(true);
    expect(gate.DECISION_GATE.title).toBe(READONLY_SENTENCE);
    expect(gate.decisionBlockReasons("hash")).toEqual([READONLY_SENTENCE]);
  });

  it("服务端探测「关」＋旗标「开」⇒ 仍关——探测是必要条件，构建旗标开不动它", async () => {
    stubFetch(readOnlyResponse);
    const gate = await freshGate("1");
    await gate.runWriteProbe();
    expect(gate.getWriteGateSnapshot().serverOpen).toBe(false);
    expect(gate.FRONTEND_WRITE_FLAG).toBe(true);
    expect(gate.DECISION_GATE.disabled).toBe(true);
    expect(gate.DECISION_GATE.title).toBe(READONLY_SENTENCE);
  });

  it("服务端探测「开且拒绝」＋旗标开，但 AP-05/06 未过 ⇒ 仍为关（DoD 语义保持）", async () => {
    stubFetch(() => new Response('{"code":"approval.not_approver"}', { status: 403 }));
    const gate = await freshGate("1");
    await gate.runWriteProbe();
    expect(gate.getWriteGateSnapshot().serverOpen).toBe(true);
    expect(gate.NEGATIVE_PROOFS_ACCEPTED).toBe(false);
    expect(gate.DECISION_GATE.disabled).toBe(true);
    expect(gate.DECISION_GATE.title).toBe(READONLY_SENTENCE);
  });

  it("探测腿失败（超时/502）⇒ unknown⇒关，与 closed 同禁用不同读数", async () => {
    stubFetch(() => Promise.reject(new Error("abort")));
    const gate = await freshGate();
    await gate.runWriteProbe();
    const readout = gate.writeGateChipReadout(gate.getWriteGateSnapshot());
    expect(readout.server).toBe("未知（按关）");
    expect(readout.asOfMs).toBeNull();
    expect(readout.missingReason).toContain("没有拿到答复");
    expect(gate.DECISION_GATE.disabled).toBe(true);
  });

  it("runWriteProbe 幂等：多订阅者多调用，网络只发一发", async () => {
    const calls = stubFetch(readOnlyResponse);
    const gate = await freshGate();
    await Promise.all([gate.runWriteProbe(), gate.runWriteProbe(), gate.runWriteProbe()]);
    expect(calls).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ *
 * 页面级：禁用形态＋chip（真 writeGate、fetchJSON 唯一数据缝、fetch 探测缝）。
 *
 * runWriteProbe 的幂等缓存活在 writeGate 模块实例上，所以每条用例都
 * resetModules＋动态 import 一份干净的门控与页面——否则第二条用例的 fetch
 * 剧本永远轮不到重探（这钉的正是「同一次加载只发一发探测」的反面）。
 * ------------------------------------------------------------------ */

const isoFuture = (): string => new Date(Date.now() + 2 * 3600_000).toISOString();

// 批量积极候选的行形制与 approvals.batch.test.tsx pendingRow 同谱
// （类型明确、低风险、未到期、审批人含 human:7）——writeOff 句要在批量条上验。
const ROW = {
  approvalId: "ap_9F3A1111",
  title: "预算采购：分析素材包",
  status: "pending",
  requestedByName: "李思",
  employee: "employee:8812",
  createdAt: "2026-11-23T01:20:00Z",
  expiresAt: isoFuture(),
  amountUsd: 260,
  reason: "采购外部分析素材，预算内。",
  riskLevel: "low",
  binding: { changeKind: "business_action", runId: "run_ap04_seed" },
  approvers: ["human:7", "human:8"],
  decisions: [],
};

const PENDING_PAGE = { items: [ROW], nextCursor: null };

const DETAIL = { ...ROW, employeeName: "小析", remainingSeconds: 4020 };

function queue() {
  return async (url: string): Promise<unknown> => {
    if (url.startsWith("/agent-api/api/approval/decision")) {
      throw new Error("写请求不该发生：本轮零真写尝试");
    }
    if (url.startsWith("/agent-api/api/approval?")) return DETAIL;
    return PENDING_PAGE;
  };
}

let root: Root | null = null;

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

async function mount(): Promise<void> {
  vi.resetModules();
  vi.stubEnv("VITE_AGENT_APPROVAL_WRITE", "");
  const { default: PendingPage } = await import("@/modules/approvals/ApprovalsPendingModulePage");
  api.fetchJSON.mockImplementation(queue());
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<MemoryRouter initialEntries={["/approvals"]}>{<PendingPage />}</MemoryRouter>);
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), "initial load settled");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
// 精确文本匹配：本行的批量资格让「批量批准/批量驳回」也在场上，
// 含式匹配会先撞批量钮——抽屉钮按逐字文本取。
const buttonNamed = (label: string): HTMLButtonElement | undefined =>
  Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").trim() === label);

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
});

describe("AP-04 DoD 关态形态＋页头 chip（真写路由关的现网剧本）", () => {
  beforeEach(() => {
    stubFetch(readOnlyResponse);
  });

  it("chip：值=关、来源句、探测真答复⇒采集时刻有值；页面文本不裸显 code/状态码/路由", async () => {
    await mount();
    const chip = q("apv-write-gate-chip") as HTMLElement | null;
    expect(chip, "write gate chip present").toBeTruthy();
    expect(chip?.getAttribute("data-gate-state")).toBe("关");
    expect(chip?.getAttribute("data-probe-state")).toBe("closed");
    expect(chip?.textContent).toContain("写开关：关");
    expect(chip?.textContent).toContain("服务端：写路由未开");
    expect(chip?.textContent).toContain("前端旗标：关");
    expect(chip?.textContent).not.toContain("采集时刻：—");
    const spoken = document.body.textContent ?? "";
    expect(spoken).not.toContain("console.read_only");
    expect(spoken).not.toContain("405");
    // no path echo 契约（本道新增的腿不得成为首个破约者）：屏面与 tooltip 都不许出现路由字面量。
    const chipHtml = chip?.outerHTML ?? "";
    expect(chipHtml).not.toContain("/agent-api");
    expect(chipHtml).toContain("OPTIONS");
  });

  it("三属性同源＋点击零决定请求、零 dialog", async () => {
    await mount();
    const card = q("apr5-row-ap_9F3A1111") as HTMLElement | null;
    expect(card, "pending row").toBeTruthy();
    await act(async () => {
      card!.click();
    });
    await waitFor(() => !!q("apr5-actions"), "drawer actions");
    const approve = buttonNamed("批准");
    const reject = buttonNamed("驳回");
    expect(approve).toBeTruthy();
    expect(reject).toBeTruthy();
    const comment = document.getElementById("apr5-comment") as HTMLInputElement | null;
    for (const el of [approve!, reject!]) {
      expect(el.disabled, "native disabled").toBe(true);
      expect(el.getAttribute("aria-disabled")).toBe("true");
      expect(el.getAttribute("title")).toBe(READONLY_SENTENCE);
    }
    expect(comment?.disabled).toBe(true);
    expect(comment?.getAttribute("title")).toBe(READONLY_SENTENCE);
    // 可见说明段与钮同源同句。
    const note = q("apr5-actions-readonly-note");
    expect(note?.textContent?.trim()).toBe(READONLY_SENTENCE);
    // jsdom 不像真浏览器拦截 disabled 点击——强派事件正是判零的腿。
    const before = api.fetchJSON.mock.calls.length;
    await act(async () => {
      approve!.click();
    });
    await act(async () => {
      reject!.click();
    });
    expect(document.querySelector("[role='dialog']")).toBeNull();
    expect(api.fetchJSON.mock.calls.length, "click sends nothing").toBe(before);
    const urls = api.fetchJSON.mock.calls.map((c) => String(c[0]));
    expect(urls.filter((u) => u.startsWith("/agent-api/api/approval/decision"))).toHaveLength(0);
  });

  it("探测没回话（上游 502/下线剧本）⇒ chip「未知（按关）」＋采集时刻「—」＋原因句，钮仍三属性禁用", async () => {
    vi.unstubAllGlobals();
    stubFetch(() => Promise.reject(new Error("upstream down since 01:12")));
    await mount();
    const chip = q("apv-write-gate-chip") as HTMLElement | null;
    expect(chip?.getAttribute("data-probe-state")).toBe("unknown");
    expect(chip?.textContent).toContain("服务端：未知（按关）");
    expect(chip?.textContent).toContain("采集时刻：—");
    expect(chip?.getAttribute("title")).toContain("没有拿到答复");
    const card = q("apr5-row-ap_9F3A1111") as HTMLElement | null;
    await act(async () => {
      card!.click();
    });
    await waitFor(() => !!q("apr5-actions"), "drawer actions");
    const approve = buttonNamed("批准")!;
    expect(approve.disabled).toBe(true);
    expect(approve.getAttribute("aria-disabled")).toBe("true");
    expect(approve.getAttribute("title")).toBe(READONLY_SENTENCE);
  });

  it("批量 writeOff 与逐单同一句话（DECISION_GATE 单源，grep 级契约的行为面）", async () => {
    await mount();
    const checkbox = q("apv-select-ap_9F3A1111") as HTMLInputElement | null;
    expect(checkbox, "batch checkbox").toBeTruthy();
    await act(async () => {
      checkbox!.click();
    });
    await waitFor(() => !!q("apv-batch-approve"), "batch bar");
    const batch = q("apv-batch-approve") as HTMLButtonElement | null;
    expect(batch?.disabled).toBe(true);
    expect(batch?.getAttribute("aria-disabled")).toBe("true");
    expect(batch?.getAttribute("title")).toBe(READONLY_SENTENCE);
  });
});
