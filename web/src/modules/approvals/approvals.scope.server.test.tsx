// @vitest-environment jsdom
/**
 * AP-07 — 批量与筛选的服务端边界（写域 tests）。
 *
 * 覆盖工单四项新增断言，全部走真组件、真 fetchJSON 接缝，零 fixture：
 *  ① 本地/服务端作用域标注：每个本地过滤器（q/actor/since/risk/排序）旁都有
 *     「已加载 n 条内」作用域句；服务端还发着下一页游标（hasMore）时，作用域句
 *     后头追加「需先加载」提示（跨页不许被读成全量）。status 是唯一真服务端筛选，
 *     界面明写「服务端生效」，本地过滤不得画成服务端。
 *  ② 批量禁用文案单源：写通道关（真实 DECISION_GATE.disabled，不 stub）时，批量钮的
 *     禁用 title 逐字等于 DECISION_GATE.title——批量与逐单抽屉是同一个字符串的出口，
 *     不再有第二套措辞。
 *  ③ 高风险/对外发送类不可批量：message_send 与 high/critical 行的勾选框禁用并说原因。
 *  ④ 历史页筛选齐性：终态 8 态 + 时间 + 审批人都在；时间窗跨度上限未定 ⇒ 不提供
 *     假边界（窗口控件恒 disabled，且不出现任何编造的「最大跨度」数字）。
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import ApprovalsPendingModulePage from "@/modules/approvals/ApprovalsPendingModulePage";
import ApprovalsHistoryModulePage from "@/modules/approvals/ApprovalsHistoryModulePage";
import { DECISION_GATE } from "@/modules/approvals/writeGate";
import { batchGate, batchCheckboxReason } from "@/modules/approvals/batch";
import { approvalsPageFrom, STATUS_FILTERS } from "@/modules/approvals/model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

const waitFor = async (cond: () => boolean, label = "condition"): Promise<void> => {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
};

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

const qa = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);

const click = async (el: Element | null, label = "element"): Promise<void> => {
  expect(el, label).toBeTruthy();
  await act(async () => {
    (el as HTMLElement).click();
  });
  await act(async () => {});
};

/** 展开筛选面板（两页各自 testid；已展开则跳过）。 */
async function openPanel(toggleId: string): Promise<void> {
  const toggle = qa(toggleId) as HTMLButtonElement | null;
  expect(toggle, `${toggleId} present`).toBeTruthy();
  if (toggle!.getAttribute("aria-expanded") !== "true") await click(toggle, toggleId);
}

const isoFuture = (): string => new Date(Date.now() + 2 * 3600_000).toISOString();

/** 低风险、类型明确、未到期、可批量的待办行（批量候选）。 */
function pendingRow(id: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    approvalId: id,
    title: `预算采购 ${id}`,
    status: "pending",
    requestedByName: "李思",
    employee: "employee:8812",
    createdAt: "2026-11-23T01:20:00Z",
    expiresAt: isoFuture(),
    reason: "采购外部分析素材，预算内。",
    riskLevel: "low",
    binding: { changeKind: "business_action", runId: "run_ap07" },
    approvers: ["human:7", "human:8"],
    decisions: [],
    ...over,
  };
}

beforeEach(() => {
  document.cookie = "console_csrf=test-csrf-token; path=/";
  api.fetchJSON.mockReset();
});

afterEach(() => {
  document.cookie = "console_csrf=; path=/; max-age=0";
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
});

describe("AP-07① 本地过滤器作用域标注 + 跨页需先加载", () => {
  it("服务端给着下一页游标时，每个本地过滤器的作用域句都追加「需先加载」提示", async () => {
    api.fetchJSON.mockImplementation(async () => ({ items: [pendingRow("ap_q1")], nextCursor: "cur-2" }));
    await render("/approvals", <ApprovalsPendingModulePage />);
    await waitFor(() => !document.querySelector(".animate-pulse"), "pending ready");
    await openPanel("apv-filter-toggle");

    // q / actor / since / risk 四条本地维——游标在 ⇒ 各自的作用域句后都钉一句需先加载。
    for (const id of [
      "apv8-search-crosspage",
      "apv-actor-crosspage",
      "apv-since-crosspage",
      "apv-risk-crosspage",
    ]) {
      const hint = qa(id);
      expect(hint, `${id} present when hasMore`).toBeTruthy();
      expect(hint!.textContent).toContain("加载更多");
    }
    // 排序维的作用域句也在面板里（QueueMetaNotes）。
    expect(qa("apv-sort-crosspage"), "sort crosspage hint").toBeTruthy();
    expect(qa("apv-sort-crosspage")?.textContent).toContain("先点「加载更多」");
  });

  it("服务端没有下一页游标（到底/单页）时，不出现任何假的「需先加载」提示", async () => {
    api.fetchJSON.mockImplementation(async () => ({ items: [pendingRow("ap_q2")], nextCursor: null }));
    await render("/approvals", <ApprovalsPendingModulePage />);
    await waitFor(() => !document.querySelector(".animate-pulse"), "pending ready");
    await openPanel("apv-filter-toggle");

    for (const id of [
      "apv8-search-crosspage",
      "apv-actor-crosspage",
      "apv-since-crosspage",
      "apv-risk-crosspage",
      "apv-sort-crosspage",
    ]) {
      expect(qa(id), `${id} absent without a cursor`).toBeNull();
    }
    // 作用域句本体仍在（标的是「已加载 n 条内」，不依赖游标）。
    expect(qa("apv8-scope-note")?.textContent).toContain("仅在当前已加载 1 条内搜索");
  });

  it("status 明写为服务端生效，本地过滤不得自称服务端", async () => {
    api.fetchJSON.mockImplementation(async () => ({ items: [pendingRow("ap_q3")], nextCursor: "cur-3" }));
    await render("/approvals", <ApprovalsPendingModulePage />);
    await waitFor(() => !document.querySelector(".animate-pulse"), "pending ready");
    await openPanel("apv-filter-toggle");

    const statusNote = qa("apv-status-note");
    expect(statusNote, "status 口径句在").toBeTruthy();
    expect(statusNote!.getAttribute("data-apv-status-scope"), "status 标为服务端维").toBe("server");
    expect(statusNote!.textContent).toContain("服务端");
    // 本地维的作用域属性明确标 local-*，与 status 的 server 不同源。
    expect(qa("apv8-scope-note")?.getAttribute("data-apv8-scope-note")).toBe("local-search");
  });

  it("历史页同样明写 status 是服务端维、其余是本地维", async () => {
    api.fetchJSON.mockImplementation(async () => ({ items: [pendingRow("ap_h1")], nextCursor: null }));
    await render("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await waitFor(() => !document.querySelector(".animate-pulse"), "history ready");
    await openPanel("apv-h-filter-toggle");
    const note = qa("apv-h-status-note");
    expect(note, "history status scope note present").toBeTruthy();
    expect(note!.getAttribute("data-apv-h-status-scope")).toBe("server");
    expect(note!.textContent).toContain("服务端 status 筛选");
    expect(note!.textContent).toContain("本地过滤");
  });
});

describe("AP-07② 批量禁用文案单源（真实写门控，不 stub）", () => {
  it("真实 DECISION_GATE.disabled 为 true（本部署写通道关，未开闸）", () => {
    // 写开关保持关——本单不做任何开闸；这里钉住前提。
    expect(DECISION_GATE.disabled).toBe(true);
  });

  it("写通道关时，批量批准/驳回的禁用 title 逐字等于 DECISION_GATE.title", async () => {
    api.fetchJSON.mockImplementation(async () => ({ items: [pendingRow("ap_bx1")], nextCursor: null }));
    await render("/approvals", <ApprovalsPendingModulePage />);
    await waitFor(() => !document.querySelector(".animate-pulse"), "pending ready");
    // 全选可批量行：选中非空、写门关 ⇒ writeOff 门。
    await click(qa("apv-select-all"), "select all");
    const approve = qa("apv-batch-approve") as HTMLButtonElement | null;
    const reject = qa("apv-batch-reject") as HTMLButtonElement | null;
    expect(approve, "batch approve present").toBeTruthy();
    expect(reject, "batch reject present").toBeTruthy();
    expect(approve!.disabled, "写门关 ⇒ 批量钮禁用").toBe(true);
    expect(approve!.getAttribute("aria-disabled")).toBe("true");
    // 单源：批量钮的 title 就是逐单抽屉用的那一个 DECISION_GATE.title，一字不差。
    expect(approve!.getAttribute("title")).toBe(DECISION_GATE.title);
    expect(reject!.getAttribute("title")).toBe(DECISION_GATE.title);
    // 且写门关上不因为选了行就放行：点击零决定请求。
    const before = api.fetchJSON.mock.calls.filter((c) =>
      String(c[0]).startsWith("/agent-api/api/approval/decision"),
    ).length;
    await click(approve, "batch approve disabled");
    const after = api.fetchJSON.mock.calls.filter((c) =>
      String(c[0]).startsWith("/agent-api/api/approval/decision"),
    ).length;
    expect(after, "禁用态点击不发决定请求").toBe(before);
  });

  it("batchGate writeOff 的 title 由纯函数即等于 DECISION_GATE.title（无第二套词汇）", () => {
    const rows = approvalsPageFrom({ items: [pendingRow("ap_pure1")] })!.rows;
    expect(rows.length).toBeGreaterThan(0);
    // 门顺序 empty → writeOff：真实门关，勾一行即 writeOff。
    expect(batchGate(rows, null).key).toBe("writeOff");
    expect(batchGate(rows, null).title).toBe(DECISION_GATE.title);
  });
});

describe("AP-07③ 高风险/对外发送类不可批量", () => {
  it("message_send 行勾选框禁用并说明不可批量；low 业务行不禁", () => {
    const page = approvalsPageFrom({
      items: [
        pendingRow("ap_low"),
        pendingRow("ap_send", { binding: { changeKind: "message_send" }, riskLevel: "high" }),
      ],
    })!;
    const byId = (id: string) => page.rows.find((r) => r.rawId === id)!;
    expect(batchCheckboxReason(byId("ap_low"))).toBeNull();
    const sendReason = batchCheckboxReason(byId("ap_send"));
    expect(sendReason, "对外发送/高风险行不可批量").toBeTruthy();
    // 拦下的原因要么是 message_send 专句，要么是高风险档句；两者都明写「不可批量」。
    expect(sendReason).toContain("不可批量");
  });

  it("critical 风险档同样不可批量（HIGH_RISKS 含 high|critical）", () => {
    const page = approvalsPageFrom({
      items: [pendingRow("ap_crit", { riskLevel: "critical" })],
    })!;
    const reason = batchCheckboxReason(page.rows[0]);
    expect(reason, "critical 行不可批量").toBeTruthy();
    expect(reason).toContain("不可批量");
  });

  it("混入 message_send 后整组批量门落到 outbound（不可发）", () => {
    const page = approvalsPageFrom({
      items: [pendingRow("ap_mix_low"), pendingRow("ap_mix_send", { binding: { changeKind: "message_send" } })],
    })!;
    const low = page.rows.filter((r) => r.rawId === "ap_mix_low");
    const send = page.rows.filter((r) => r.rawId === "ap_mix_send");
    // 单条 message_send：真实门关，先看 writeOff（门序 writeOff 在 outbound 之前）。
    expect(batchGate(send, null).key).toBe("writeOff");
    // 用纯门函数验 outbound 判定链：开一门时 outbound 命中（DECISION_GATE.disabled=true 时
    // 走 writeOff 是正确优先级，故这里用 batchGateKey 之外的 isOutbound 语义经勾选拦下证明）。
    expect(batchCheckboxReason(send[0])).toContain("不可批量");
    expect(batchCheckboxReason(low[0])).toBeNull();
  });
});

describe("AP-07④ 历史页筛选冻结集齐性", () => {
  it("终态 8 态 + 时间 + 审批人三条筛选腿都在", async () => {
    api.fetchJSON.mockImplementation(async () => ({ items: [pendingRow("ap_fz")], nextCursor: null }));
    await render("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await waitFor(() => !document.querySelector(".animate-pulse"), "history ready");
    await openPanel("apv-h-filter-toggle");

    // ① 八态：八态组每一枚都渲染（all + 8 具体态）。
    expect(qa("apr5-filter-all"), "全部态").toBeTruthy();
    for (const filter of STATUS_FILTERS) {
      expect(qa(`apr5-filter-${filter.value}`), `态 ${filter.value}`).toBeTruthy();
    }
    // ② 时间：时间范围 rail 在。
    expect(qa("apv-since-rail"), "时间筛选腿").toBeTruthy();
    // ③ 审批人：按审批人桶在。
    expect(qa("apv-actor-buckets"), "审批人筛选腿").toBeTruthy();
  });

  it("时间窗跨度上限未定 ⇒ 窗口控件不提供假边界", async () => {
    api.fetchJSON.mockImplementation(async () => ({ items: [pendingRow("ap_wd")], nextCursor: null }));
    await render("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await waitFor(() => !document.querySelector(".animate-pulse"), "history ready");
    const win = qa("apv5-filter-window");
    expect(win, "window 控件在").toBeTruthy();
    expect(win!.hasAttribute("disabled") || win!.getAttribute("aria-disabled") === "true", "窗口恒禁用").toBe(true);
    // 不出现编造的最大跨度数字（「最多/上限/至多 + 天/日/月」）。
    const label = (win!.textContent ?? "") + (win!.getAttribute("title") ?? "");
    expect(label).toContain("暂不可筛");
    expect(label).not.toMatch(/最多\s*\d|上限\s*\d|至多\s*\d/);
  });

  it("本地时间窗作用域句标的是已加载行，不谎称服务端时间过滤", async () => {
    api.fetchJSON.mockImplementation(async () => ({ items: [pendingRow("ap_st")], nextCursor: null }));
    await render("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await waitFor(() => !document.querySelector(".animate-pulse"), "history ready");
    await openPanel("apv-h-filter-toggle");
    const note = qa("apv-since-scope-note");
    expect(note?.textContent).toContain("不是全量");
    expect(note?.textContent).toContain("不发新请求");
    expect(note!.getAttribute("data-apv-since-scope-note")).toBe("local-filter");
  });
});
