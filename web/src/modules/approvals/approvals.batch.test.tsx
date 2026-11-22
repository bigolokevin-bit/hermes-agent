// @vitest-environment jsdom
// 批量 P0 — 审批待办页的行级勾选 + 批量批准/驳回（逐单顺序提交、失败即停）。
// 形制照抄 ApprovalsPendingModulePage.test.tsx：fetchJSON 是唯一接缝，
// 不 stub 任何本应用不会调用的端点；写门控用模块内单点 writeGate 的替身。

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

// P0-1r 写门控单点的替身：默认与现网一致（disabled=true，本部署实测写 405），
// 批量流程用例把 disabled 翻开模拟「写通道开闸的后代」，关着的用例直接
// 验收 writeOff 禁用态。DECISION_GATE 对象本身是稳定引用，页面与 batch.ts
// 读到的都是它。
const writeGateStub = vi.hoisted(() => ({
  DECISION_GATE: {
    disabled: true,
    title: "这个环境的控制台只读：实测决定提交一律被拒（服务端当前只允许读请求，写请求没有入口）。所以批准、驳回在这里以禁用态出现，点它不会发起任何请求；要处理这张单，请走它原本产生决定的渠道。",
  },
}));
vi.mock("@/modules/approvals/writeGate", () => writeGateStub);

import ApprovalsPendingModulePage from "@/modules/approvals/ApprovalsPendingModulePage";
import { approvalsPageFrom } from "@/modules/approvals/model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

async function render(entry: string, page: ReactNode): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<MemoryRouter initialEntries={[entry]}>{page}</MemoryRouter>);
  });
}

/** decisionFailures：这些单号的 POST 抛 502；decisionAlwaysFail 覆盖全部。 */
interface Scenario {
  fail?: (id: string) => boolean;
}

function routeRows(items: readonly Record<string, unknown>[], scenario: Scenario = {}) {
  return async (url: string): Promise<unknown> => {
    if (url.startsWith("/agent-api/api/approval/decision")) {
      const id = url.slice(url.indexOf("id=") + 3);
      if (scenario.fail && scenario.fail(id)) {
        throw new ApiError("downstream not ready", {
          status: 502,
          body: '{"detail":"downstream not ready"}',
          url,
          requestId: "bat-502",
        });
      }
      return { ok: true };
    }
    if (url.startsWith("/agent-api/api/approval?")) {
      // 批量流不打开抽屉；给出可解析的单，防意外路径不撒谎。
      return { approvalId: "ap_b1", title: "预算采购：分析素材包", status: "pending", decisions: [] };
    }
    return { items, nextCursor: null };
  };
}

const mount = async (handler: (url: string, init?: RequestInit) => Promise<unknown>, entry = "/approvals") => {
  api.fetchJSON.mockImplementation(handler);
  await render(entry, <ApprovalsPendingModulePage />);
  await waitFor(() => !document.querySelector(".animate-pulse"), "initial load settled");
};

const qa = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const box = (id: string): HTMLInputElement | null =>
  document.querySelector(`[data-testid="apv-select-${id}"]`) as HTMLInputElement | null;
const decisionCalls = (): string[] =>
  api.fetchJSON.mock.calls
    .map((call) => String(call[0]))
    .filter((u) => u.startsWith("/agent-api/api/approval/decision"))
    .map((u) => u.slice(u.indexOf("id=") + 3));
const listCallCount = (): number =>
  api.fetchJSON.mock.calls.filter((c) => String(c[0]).startsWith("/agent-api/api/approvals")).length;

const click = async (el: Element | null, label = "element"): Promise<void> => {
  expect(el, label).toBeTruthy();
  await act(async () => {
    (el as HTMLElement).click();
  });
  await act(async () => {});
};

const confirmDialog = (): HTMLButtonElement | null =>
  document.querySelector("[role='dialog'] [data-confirm]") as HTMLButtonElement | null;

/** 行工厂：低风险、类型明确（binding.changeKind）、未到期、审批人含 human:7。 */
const isoFuture = (): string => new Date(Date.now() + 2 * 3600_000).toISOString();
const isoPast = (): string => new Date(Date.now() - 3600_000).toISOString();

function pendingRow(id: string, title: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    approvalId: id,
    title,
    status: "pending",
    requestedByName: "李思",
    employee: "employee:8812",
    createdAt: "2026-11-23T01:20:00Z",
    expiresAt: isoFuture(),
    amountUsd: 260,
    reason: "采购外部分析素材，预算内。",
    riskLevel: "low",
    binding: { changeKind: "business_action", runId: "run_batch_seed" },
    approvers: ["human:7", "human:8"],
    decisions: [],
    ...over,
  };
}

/** 流程夹具：两条可批量预算类 + 一条高风险对外发送（不可勾选）。 */
const FLOW_ROWS = [
  pendingRow("ap_b1", "预算采购：分析素材包"),
  pendingRow("ap_b2", "预算采购：数据标注服务"),
  pendingRow("ap_send", "对外发送本周报表", {
    binding: { changeKind: "message_send" },
    riskLevel: "high",
    reason: "需要把结果发给外部对接人",
  }),
];

/** 门控夹具：再补非审批人、已投票、缺类型、已到时、已终态各一。 */
const FULL_ROWS = [
  ...FLOW_ROWS,
  pendingRow("ap_notme", "预算采购：外包设计", { approvers: ["human:9"] }),
  pendingRow("ap_voted", "预算采购：存储扩容", {
    decisions: [{ userId: "human:7", verdict: "approve", decidedAt: "2026-11-23T02:00:00Z" }],
  }),
  pendingRow("ap_kindless", "没写变更类型的申请", { binding: null }),
  pendingRow("ap_expired", "已过处理期限的预算申请", { expiresAt: isoPast() }),
  pendingRow("ap_settled", "已执行的预算申请", { status: "consumed", decidedAt: "2026-11-23T02:30:00Z" }),
];

beforeEach(() => {
  document.cookie = "console_csrf=test-csrf-token; path=/";
  api.fetchJSON.mockReset();
  writeGateStub.DECISION_GATE.disabled = true;
});

afterEach(() => {
  document.cookie = "console_csrf=; path=/; max-age=0";
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
});

describe("批量选择：行级 checkbox（apv-select-*）", () => {
  it("① 可批量行有勾选框；高风险「对外发送」行勾选框禁用且说明原因；终态行同理", async () => {
    writeGateStub.DECISION_GATE.disabled = false;
    await mount(routeRows(FLOW_ROWS));
    const b1 = box("ap_b1");
    expect(b1, "row checkbox apv-select-ap_b1").toBeTruthy();
    expect(b1!.disabled, "低风险预算行可勾选").toBe(false);
    const send = box("ap_send");
    expect(send, "高风险行也有勾选框（禁用态）").toBeTruthy();
    expect(send!.disabled).toBe(true);
    expect(send!.getAttribute("title")).toContain("不可批量");
    expect(send!.getAttribute("title")).toContain("对外发送消息");
    // 终态行不参与批量：禁用 + 与抽屉同一词汇说明去向。
    await mount(routeRows([pendingRow("ap_settled", "已执行的预算申请", { status: "consumed" })]));
    expect(qa("apv-batch-bar"), "全是终态行时批量区不出现死按钮").toBeNull();
  });

  it("② 全选只选可批量行，高风险行不被勾选", async () => {
    writeGateStub.DECISION_GATE.disabled = false;
    await mount(routeRows(FLOW_ROWS));
    await click(qa("apv-select-all"), "select-all");
    expect(box("ap_b1")!.checked).toBe(true);
    expect(box("ap_b2")!.checked).toBe(true);
    expect(box("ap_send")!.checked, "高风险对外发送不被全选勾入").toBe(false);
    expect(qa("apv-batch-count")?.textContent).toContain("已选 2 单");
  });
});

describe("批量门控（单一枚举，逐态一条诚实文案）", () => {
  it("③ writeOff：写开关关时批量钮 disabled+aria-disabled+同一句只读原因", async () => {
    await mount(routeRows(FLOW_ROWS));
    await click(qa("apv-select-all"), "select-all");
    const approve = qa("apv-batch-approve") as HTMLButtonElement;
    const reject = qa("apv-batch-reject") as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
    expect(approve.getAttribute("aria-disabled")).toBe("true");
    expect(approve.getAttribute("title")).toContain("这个环境的控制台只读");
    expect(reject.disabled).toBe(true);
    expect(reject.getAttribute("aria-disabled")).toBe("true");
    expect(reject.getAttribute("title")).toContain("点它不会发起任何请求");
    // 关掉写门后点它不产生任何决定请求（与逐单 P0-1r 同口径）。
    const before = decisionCalls().length;
    await click(approve, "批量批准（禁用态）");
    expect(decisionCalls().length).toBe(before);
  });

  it("③ empty：没有勾选时批量钮禁用并说明", async () => {
    writeGateStub.DECISION_GATE.disabled = false;
    await mount(routeRows(FLOW_ROWS));
    const approve = qa("apv-batch-approve") as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
    expect(approve.getAttribute("aria-disabled")).toBe("true");
    expect(approve.getAttribute("title")).toContain("还没有勾选");
  });

  it("③ noKind：勾选缺 changeKind 的行后批量钮禁用（不推断类型）", async () => {
    writeGateStub.DECISION_GATE.disabled = false;
    await mount(routeRows(FULL_ROWS));
    await click(box("ap_kindless"), "勾选缺类型行");
    const approve = qa("apv-batch-approve") as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
    expect(approve.getAttribute("title")).toContain("没写明变更类型");
  });

  it("③ ended：勾选已到时的行后批量钮禁用", async () => {
    writeGateStub.DECISION_GATE.disabled = false;
    await mount(routeRows(FULL_ROWS));
    await click(box("ap_expired"), "勾选已到时行");
    const reject = qa("apv-batch-reject") as HTMLButtonElement;
    expect(reject.disabled).toBe(true);
    expect(reject.getAttribute("title")).toContain("已到时");
  });

  it("③ voted：带 ?actor= 时本人已投的行勾选后批量钮禁用", async () => {
    writeGateStub.DECISION_GATE.disabled = false;
    await mount(routeRows(FULL_ROWS), "/approvals?actor=human%3A7");
    // actor 分桶本就藏起「本人不在名单」的行（既有 ?actor= 过滤形制），
    // 所以 notApprover 在 UI 上只可能以门函数存在（见下面的单元用例）。
    expect(box("ap_notme"), "非本人审批行被 actor 过滤挡住").toBeNull();
    await click(box("ap_voted"), "勾选已投票行");
    const approve = qa("apv-batch-approve") as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
    expect(approve.getAttribute("title")).toContain("已经投过");
    // 取消已投行、改勾可批量行：回到 ok 门。
    await click(box("ap_voted"), "取消已投票行");
    await click(box("ap_b1"), "勾选可批量行");
    expect(approve.disabled).toBe(false);
  });

  it("③ 门函数逐键：empty 优先、outbound/notApprover 在勾选框拦不到的层仍如实", async () => {
    const { batchGate } = await import("@/modules/approvals/batch");
    const page = approvalsPageFrom({
      items: [
        pendingRow("ap_b1", "预算采购：分析素材包"),
        pendingRow("ap_send", "对外发送本周报表", {
          binding: { changeKind: "message_send" },
          riskLevel: "high",
        }),
        pendingRow("ap_notme", "预算采购：外包设计", { approvers: ["human:9"] }),
        pendingRow("ap_voted", "预算采购：存储扩容", {
          decisions: [{ userId: "human:7", verdict: "approve", decidedAt: "2026-11-23T02:00:00Z" }],
        }),
        pendingRow("ap_expired", "已过处理期限的预算申请", { expiresAt: isoPast() }),
        pendingRow("ap_kindless", "没写变更类型的申请", { binding: null }),
      ],
    });
    expect(page).toBeTruthy();
    const rows = page!.rows;
    const byId = (id: string) => rows.filter((r) => r.rawId === id);
    // 门控开关关着时，一切以 writeOff 之前先看 empty：枚举顺序 empty→writeOff。
    writeGateStub.DECISION_GATE.disabled = true;
    expect(batchGate([], null).key).toBe("empty");
    expect(batchGate(byId("ap_b1"), null).key).toBe("writeOff");
    writeGateStub.DECISION_GATE.disabled = false;
    expect(batchGate(byId("ap_b1"), null).key).toBe("ok");
    expect(batchGate(byId("ap_send"), null).key).toBe("outbound");
    expect(batchGate(byId("ap_send"), null).title).toContain("对外发送");
    expect(batchGate(byId("ap_notme"), "human:7").key).toBe("notApprover");
    expect(batchGate(byId("ap_voted"), "human:7").key).toBe("voted");
    expect(batchGate(byId("ap_expired"), null).key).toBe("ended");
    expect(batchGate(byId("ap_kindless"), null).key).toBe("noKind");
    expect(batchGate(byId("ap_kindless"), null).title).toContain("没写明变更类型");
    // 混选：一条不可判定就整组禁用，取枚举里第一个命中键。
    expect(batchGate([...byId("ap_b1"), ...byId("ap_send")], null).key).toBe("outbound");
  });
});

describe("批量提交：逐单顺序、失败即停", () => {
  it("④ 全选可批量行→批量批准启用→确认框（无评论输入）→两次 POST 按序、verdict=approve", async () => {
    writeGateStub.DECISION_GATE.disabled = false;
    await mount(routeRows(FLOW_ROWS));
    await click(qa("apv-select-all"), "select-all");
    const approve = qa("apv-batch-approve") as HTMLButtonElement;
    expect(approve.disabled, "全可判定则批量批准启用").toBe(false);
    await click(approve, "批量批准");
    expect(document.querySelector("[role='dialog']"), "确认框出现").toBeTruthy();
    expect(document.querySelector("[role='dialog'] textarea"), "批量确认框没有评论输入").toBeNull();
    expect(document.querySelector("[role='dialog'] #apr5-comment")).toBeNull();
    await click(confirmDialog(), "确认按钮");
    await waitFor(() => (qa("apv-batch-result")?.textContent ?? "").length > 0, "结果读数出现");
    expect(decisionCalls()).toEqual(["ap_b1", "ap_b2"]);
    const writeCalls = api.fetchJSON.mock.calls.filter((c) =>
      String(c[0]).startsWith("/agent-api/api/approval/decision"),
    ) as [string, RequestInit][];
    expect(JSON.parse(String(writeCalls[0]![1].body))).toEqual({ verdict: "approve" });
    expect(JSON.parse(String(writeCalls[1]![1].body))).toEqual({ verdict: "approve" });
  });

  it("⑤ 第一单失败：第二单零调用；已成功 0 单+原因；两行仍勾选", async () => {
    writeGateStub.DECISION_GATE.disabled = false;
    await mount(routeRows(FLOW_ROWS, { fail: () => true }));
    await click(qa("apv-select-all"), "select-all");
    await click(qa("apv-batch-approve"), "批量批准");
    await click(confirmDialog(), "确认按钮");
    await waitFor(() => (qa("apv-batch-result")?.textContent ?? "").includes("第 1 单失败"), "失败读数");
    expect(decisionCalls(), "失败即停：后续零调用").toEqual(["ap_b1"]);
    const result = qa("apv-batch-result")!.textContent ?? "";
    expect(result).toContain("已成功 0 单");
    expect(result).toContain("审批服务在处理这次批准时出了错");
    expect(document.querySelector("[role='dialog']"), "确认框已关闭").toBeNull();
    expect(box("ap_b1")!.checked, "失败行保留选中").toBe(true);
    expect(box("ap_b2")!.checked, "未提交行保留选中").toBe(true);
  });

  it("⑥ 第二单失败：第一单不回到选择集（防重复决策）", async () => {
    writeGateStub.DECISION_GATE.disabled = false;
    await mount(routeRows(FLOW_ROWS, { fail: (id) => id === "ap_b2" }));
    await click(qa("apv-select-all"), "select-all");
    await click(qa("apv-batch-approve"), "批量批准");
    await click(confirmDialog(), "确认按钮");
    await waitFor(() => (qa("apv-batch-result")?.textContent ?? "").includes("第 2 单失败"), "失败读数");
    expect(decisionCalls()).toEqual(["ap_b1", "ap_b2"]);
    expect(qa("apv-batch-result")?.textContent).toContain("已成功 1 单");
    expect(box("ap_b1")!.checked, "已成功单退出选择集").toBe(false);
    expect(box("ap_b2")!.checked, "失败行保留选中").toBe(true);
  });

  it("⑦ 全部成功：清空选择+成功读数+队列重读", async () => {
    writeGateStub.DECISION_GATE.disabled = false;
    await mount(routeRows(FLOW_ROWS));
    await click(qa("apv-select-all"), "select-all");
    const listsBefore = listCallCount();
    await click(qa("apv-batch-approve"), "批量批准");
    await click(confirmDialog(), "确认按钮");
    await waitFor(() => (qa("apv-batch-result")?.textContent ?? "").includes("已提交 2 单"), "成功读数");
    expect(box("ap_b1")!.checked, "选择清空").toBe(false);
    expect(box("ap_b2")!.checked).toBe(false);
    expect(qa("apv-batch-count")?.textContent).toContain("已选 0 单");
    await waitFor(() => listCallCount() === listsBefore + 1, "queue refetch after batch");
  });

  it("清空选择钮清掉勾选", async () => {
    writeGateStub.DECISION_GATE.disabled = false;
    await mount(routeRows(FLOW_ROWS));
    await click(qa("apv-select-all"), "select-all");
    await click(qa("apv-batch-clear"), "清空选择");
    expect(qa("apv-batch-count")?.textContent).toContain("已选 0 单");
    expect(box("ap_b1")!.checked).toBe(false);
  });

  it("⑧ 筛选（URL 参数）变化重置选择集", async () => {
    writeGateStub.DECISION_GATE.disabled = false;
    await mount(routeRows(FLOW_ROWS), "/approvals?tab=pending");
    await click(qa("apv-select-all"), "select-all");
    expect(qa("apv-batch-count")?.textContent).toContain("已选 2 单");
    // 打开筛选面板，输入关键字 → ?q= 变化 → 选择/进度/结果全部重置。
    const toggle = qa("apv-filter-toggle") as HTMLButtonElement;
    await click(toggle, "展开筛选");
    const search = qa("apv8-search") as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(search, "素材");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {});
    expect(qa("apv-batch-count")?.textContent).toContain("已选 0 单");
    const b1 = box("ap_b1");
    expect(b1 ? b1.checked : false, "筛选变化后不再保留勾选").toBe(false);
  });
});
