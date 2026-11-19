// @vitest-environment jsdom
// T17 — the history pane. The eight states are the filter, and the filter is
// the request: every choice has to land in `?status=` on the list route, and
// the rows shown have to be the rows that answer brought back.

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import ApprovalsHistoryModulePage from "@/modules/approvals/ApprovalsHistoryModulePage";
import { STATUS_FILTERS } from "@/modules/approvals/model";

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

const text = (): string => document.body.textContent ?? "";
const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const chip = (value: string): HTMLButtonElement =>
  document.querySelector(`[data-testid='apr5-filter-${value}']`) as HTMLButtonElement;

/** One record per state, so a filter that ignored `status=` would show 8 rows. */
const ROWS_BY_STATE: Record<string, unknown[]> = {
  pending: [{ approvalId: "ap_p", title: "等待你点头的发布", status: "pending" }],
  approved: [{ approvalId: "ap_a", title: "上月预算追加", status: "approved", decidedAt: "2026-11-17T02:00:00Z" }],
  rejected: [{ approvalId: "ap_r", title: "临时提权申请", status: "rejected", decidedAt: "2026-11-16T02:00:00Z" }],
  revise_requested: [{ approvalId: "ap_v", title: "对外报价单", status: "revise_requested" }],
  expired: [{ approvalId: "ap_e", title: "过期未处理的采购", status: "expired" }],
  cancelled: [{ approvalId: "ap_c", title: "发起人撤回的转账", status: "cancelled" }],
  consumed: [{ approvalId: "ap_x", title: "已执行的批量导出", status: "consumed" }],
  superseded: [{ approvalId: "ap_s", title: "被新单替代的发布", status: "superseded" }],
};

const ALL = Object.values(ROWS_BY_STATE).flat();

async function mount(handler?: (url: string) => Promise<unknown>, entry = "/approvals?tab=history"): Promise<void> {
  api.fetchJSON.mockImplementation(
    handler ??
      (async (url: string) => {
        const match = /[?&]status=([^&]*)/.exec(url);
        const state = match ? decodeURIComponent(match[1]) : null;
        return { items: state === null ? ALL : (ROWS_BY_STATE[state] ?? []) };
      }),
  );
  await render(entry, <ApprovalsHistoryModulePage />);
  await waitFor(() => !document.querySelector(".animate-pulse"), "first page settled");
}

const pick = async (value: string): Promise<void> => {
  await act(async () => {
    chip(value).click();
  });
  await waitFor(
    () => urls().some((u) => u.includes(`status=${encodeURIComponent(value)}`)) || (value === "all" && urls().some((u) => !u.includes("status="))),
    `filter ${value} requested`,
  );
};

/** The row CARDS only (not their 「详情」 disclosure, whose id also starts apr5-row-). */
const rowNodes = (): HTMLElement[] =>
  Array.from(document.querySelectorAll("[data-testid^='apr5-row-']")).filter(
    (el) => !(el.getAttribute("data-testid") ?? "").includes("-details-"),
  ) as HTMLElement[];

/** Stub navigator.clipboard (absent in jsdom) and hand back the writeText spy. */
const stubClipboard = (): ReturnType<typeof vi.fn> => {
  const writeText = vi.fn(async () => {});
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  return writeText;
};
const copyButton = (): HTMLButtonElement | null =>
  document.querySelector("[data-testid='apr5-copy-request-id']") as HTMLButtonElement | null;
const shownRequestId = (): string | null =>
  (document.querySelector("[data-testid='apr5-request-id']") as HTMLElement | null)?.textContent ?? null;

beforeEach(() => {
  api.fetchJSON.mockReset();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
});

describe("the eight states", () => {
  it("offers every state by its human name, plus 全部", async () => {
    await mount();
    expect(text()).toContain("待处理");
    expect(text()).toContain("已通过");
    expect(text()).toContain("已拒绝");
    expect(text()).toContain("要求修改");
    expect(text()).toContain("已过期");
    expect(text()).toContain("已撤回");
    expect(text()).toContain("已执行");
    expect(text()).toContain("已被新单替代");
    expect(text()).toContain("全部");
    // the wire token never becomes the label
    expect(chip("revise_requested").textContent).toBe("要求修改");
  });

  it("sends the chosen state to the service and paints only what comes back", async () => {
    for (const state of Object.keys(ROWS_BY_STATE)) {
      await mount();
      await pick(state);
      expect(urls()).toContain(`/agent-api/api/approvals?status=${state}&limit=50`);
    }
  });

  it("proves all eight canonical states are live: request, repaint, and 全部 drops status", async () => {
    // The eight values model.ts exposes are exactly the eight this test drives,
    // spelled on the wire, not renamed.
    const canonical = [...STATUS_FILTERS.map((f) => f.value)];
    expect([...canonical].sort()).toEqual(
      ["pending", "approved", "rejected", "revise_requested", "expired", "cancelled", "consumed", "superseded"].sort(),
    );

    await mount();
    for (const f of STATUS_FILTERS) {
      await pick(f.value);
      // (a) the chosen value reaches the request with exactly this spelling
      expect(urls()).toContain(`/agent-api/api/approvals?status=${f.value}&limit=50`);
      // (b) the rows repaint to just this state's distinguishable payload
      const expected = ROWS_BY_STATE[f.value] as { approvalId: string; title: string }[];
      expect(rowNodes()).toHaveLength(expected.length);
      for (const row of expected) {
        expect(text()).toContain(row.title);
        expect(document.querySelector(`[data-testid='apr5-row-${row.approvalId}']`)).toBeTruthy();
      }
      // no other state's row is painted while this filter is active
      for (const other of canonical) {
        if (other === f.value) continue;
        for (const row of ROWS_BY_STATE[other] as { title: string }[]) {
          expect(text()).not.toContain(row.title);
        }
      }
      expect(text()).toContain(`已显示 ${expected.length} 条「${f.label}」记录`);
    }

    // (c) 全部 sends no status-bearing request: the param is dropped, never
    // leaked as the literal `status=all`.
    await pick("expired");
    api.fetchJSON.mockClear();
    await pick("all");
    const listCalls = urls().filter((u) => u.startsWith("/agent-api/api/approvals"));
    expect(listCalls.length).toBeGreaterThan(0);
    for (const u of listCalls) {
      expect(u).not.toContain("status=");
      expect(u).not.toContain("status=all");
    }
    expect(rowNodes()).toHaveLength(Object.keys(ROWS_BY_STATE).length);
    expect(text()).toContain("已显示 8 条「全部状态」记录");
  });

  it("changes the rows when the state changes", async () => {
    await mount();
    expect(text()).toContain("已显示 8 条「全部状态」记录");
    await pick("expired");
    expect(text()).toContain("过期未处理的采购");
    expect(text()).not.toContain("上月预算追加");
    expect(text()).toContain("已显示 1 条「已过期」记录");
    await pick("approved");
    expect(text()).toContain("上月预算追加");
    expect(text()).not.toContain("过期未处理的采购");
  });

  it("R44: shareable queue shortcuts ride the real status parameter, count is same-source, honest axes stay disabled", async () => {
    await mount();
    const sc = (v: string) => document.querySelector(`[data-testid='apv5-filter-${v}']`) as HTMLButtonElement;
    expect(sc("status-pending")).toBeTruthy();
    expect(sc("status-all")).toBeTruthy();
    const before = urls().length;
    await act(async () => {
      sc("status-rejected").click();
    });
    await waitFor(() => text().includes("临时提权申请"), "rejected row");
    const fresh = urls().slice(before).filter((u) => u.includes("api/approvals"));
    expect(fresh).toHaveLength(1);
    expect(fresh[0]).toContain("status=rejected");
    // A shared/refreshed URL reopens exactly the same answer, and both the
    // shortcut and the eight-state chip read the same active source.
    await render("/approvals?tab=history&status=pending", <ApprovalsHistoryModulePage />);
    await waitFor(() => text().includes("等待你点头的发布"), "pending replay");
    expect(sc("status-pending").getAttribute("aria-pressed")).toBe("true");
    expect(chip("pending").getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector("[data-testid='apv5-count']")?.textContent).toBe("1");
    expect(text()).toContain("已显示 1 条「待处理」记录");
    // Risk and window are stated, never faked: disabled with the measured
    // reason in the title.
    const risk = document.querySelector("[data-testid='apv5-filter-risk']") as HTMLSelectElement;
    expect(risk.disabled).toBe(true);
    expect(risk.title).toContain("假过滤");
    const win = document.querySelector("[data-testid='apv5-filter-window']") as HTMLSelectElement;
    expect(win.disabled).toBe(true);
  });

  it("a state with no history says so, and 全部 drops the parameter", async () => {
    await mount();
    await pick("consumed");
    expect(text()).toContain("已执行的批量导出");
    api.fetchJSON.mockImplementation(async () => ({ items: [] }));
    await pick("superseded");
    expect(text()).toContain("该条件下无审批：「已被新单替代」结果下没有记录");
    expect(text()).toContain("换一个结果看看");
    // QA V4-R4 条目2: 零结果面板必须有真出口，不许死链。
    const back = document.querySelector("[data-testid='apr5-empty-history-exits-back']") as HTMLAnchorElement;
    expect(back?.getAttribute("href")).toBe("/overview");
    const contact = document.querySelector("[data-testid='apr5-empty-history-exits-contact']") as HTMLAnchorElement;
    expect(contact?.getAttribute("href")).toMatch(/^mailto:/);
  });

  it("opens from the URL with the state already chosen", async () => {
    await mount(undefined, "/approvals?tab=history&status=superseded");
    expect(urls()[0]).toBe("/agent-api/api/approvals?status=superseded&limit=50");
    expect(text()).toContain("被新单替代的发布");
    expect(text()).toContain("已显示 1 条「已被新单替代」记录");
  });

  it("keeps an unknown state verbatim in the request and says it is not one of the eight", async () => {
    await mount(undefined, "/approvals?tab=history&status=teleported");
    expect(urls()[0]).toBe("/agent-api/api/approvals?status=teleported&limit=50");
    expect(text()).toContain("这个筛选值不在已知的八种结果里");
    // and a row that answers with it is not renamed into a state we know
    await mount(async () => ({ items: [{ id: "z", title: "一条看不懂的状态", status: "teleported" }] }));
    await act(async () => {
      chip("all").click();
    });
    await waitFor(() => text().includes("一条看不懂的状态"), "unknown row painted");
    expect(text()).toContain("状态未识别");
  });

  it("relables the clock on settled rows and keeps a real zero honest", async () => {
    await mount();
    await pick("approved");
    expect(text()).toContain("处理于");
    expect(text()).toContain("2026-11-17 10:00");
    expect(text()).not.toContain("处理期限");
  });
});

describe("history whole-panel states", () => {
  it("error keeps the sentence and the trace id, and retry asks again", async () => {
    let asked = 0;
    await mount(async () => {
      asked += 1;
      throw new ApiError("gateway", { status: 500, body: "", url: "/agent-api/api/approvals", requestId: "hs-1101" });
    });
    expect(text()).toContain("审批申请没能加载出来");
    expect(text()).toContain("请求编号：hs-1101");
    expect(text()).not.toMatch(/\b500\b/);
    api.fetchJSON.mockImplementation(async () => ({ items: ALL }));
    await act(async () => {
      (Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes("重试")) as HTMLButtonElement).click();
    });
    await waitFor(() => asked === 1 && (document.body.textContent ?? "").includes("已显示 8 条"), "retry loaded");
  });

  it("403 and 404 read the same and draw nothing else", async () => {
    const once = async (status: number): Promise<string> => {
      await mount(async () => {
        throw new ApiError("denied", {
          status,
          body: '{"code":"console.forbidden"}',
          url: "/agent-api/api/approvals",
          requestId: "hs-deny",
        });
      });
      return document.body.innerHTML;
    };
    const forbidden = await once(403);
    expect(text()).toContain("暂时无法查看审批申请");
    expect(text()).toContain("请求编号：hs-deny");
    // one denied body, under the apr4 id, with no path echo
    expect(document.querySelector("[data-testid='apr5-denied']")).toBeTruthy();
    expect(forbidden).not.toContain("/agent-api");
    expect(document.querySelectorAll("[data-testid^='apr5-row-']")).toHaveLength(0);
    // overflow discipline: the page shrinks, the long sentence breaks
    const root = document.querySelector("[data-testid='apr5-page-history']") as HTMLElement;
    expect(root.className).toContain("min-w-0");
    expect(root.className).toContain("max-w-full");
    const denied = document.querySelector("[data-testid='apr5-denied']") as HTMLElement;
    expect(denied.querySelector("p.break-words")).toBeTruthy();
    // 404 is byte-identical to 403
    expect(await once(404)).toBe(forbidden);
  });

  it("copies the displayed request id verbatim on the error leg", async () => {
    const writeText = stubClipboard();
    await mount(async () => {
      throw new ApiError("gateway", { status: 500, body: "", url: "/agent-api/api/approvals", requestId: "hs-copy-err" });
    });
    expect(document.querySelector("[data-testid='apr5-error']")).toBeTruthy();
    expect(shownRequestId()).toBe("hs-copy-err");
    const btn = copyButton();
    expect(btn).toBeTruthy();
    await act(async () => {
      (btn as HTMLButtonElement).click();
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("hs-copy-err");
    // the copied value is byte-for-byte the value on screen
    expect(String(writeText.mock.calls[0][0])).toBe(shownRequestId());
  });

  it("copies the displayed request id verbatim on the denied leg", async () => {
    const writeText = stubClipboard();
    await mount(async () => {
      throw new ApiError("denied", { status: 403, body: "", url: "/agent-api/api/approvals", requestId: "hs-copy-deny" });
    });
    expect(document.querySelector("[data-testid='apr5-denied']")).toBeTruthy();
    expect(shownRequestId()).toBe("hs-copy-deny");
    const btn = copyButton();
    expect(btn).toBeTruthy();
    await act(async () => {
      (btn as HTMLButtonElement).click();
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("hs-copy-deny");
    expect(String(writeText.mock.calls[0][0])).toBe(shownRequestId());
  });

  it("a chosen state survives a reload and the filter stays pressed", async () => {
    await mount();
    await pick("rejected");
    expect(chip("rejected").getAttribute("aria-pressed")).toBe("true");
    expect(chip("pending").getAttribute("aria-pressed")).toBe("false");
    expect(text()).toContain("临时提权申请");
    expect(text()).not.toContain("等待你点头的发布");
  });

  it("each state can also be opened from the URL, marked as a repro", async () => {
    api.fetchJSON.mockReset();
    const open = async (state: string) => {
      await render(`/approvals?tab=history&state=${state}`, <ApprovalsHistoryModulePage />);
      await waitFor(
        () => (document.body.textContent ?? "").includes("复现出来的状态"),
        `?state=${state} painted`,
      );
    };
    await open("loading");
    expect(document.querySelector("[data-testid='apr5-forced-note']")).toBeTruthy();
    expect(document.querySelector("[data-testid='apr5-loading']")).toBeTruthy();
    expect(api.fetchJSON).not.toHaveBeenCalled();
    await open("empty");
    expect(text()).toContain("该条件下无审批");
    expect(document.querySelector("[data-testid='apr5-empty-history']")).toBeTruthy();
    await open("error");
    expect(text()).toContain("本次请求未记录编号，可复制时间与操作路径反馈");
    expect(text()).not.toContain("未提供");
    expect(document.querySelector("[data-testid='apr5-error']")).toBeTruthy();
    expect(document.querySelector("[data-testid='apr5-retry']")).toBeTruthy();
    await open("denied");
    expect(document.querySelector("[data-testid='apr5-forced-note']")).toBeTruthy();
    expect(document.querySelector("[data-testid='apr5-denied']")).toBeTruthy();
    expect(document.querySelectorAll("[data-testid^='apr5-row-']")).toHaveLength(0);
  });

  it("R26 F1: clicking the row card itself opens the detail with all eight PRD fields", async () => {
    const sample = {
      approvalId: "ap_123DE49B9A1F42A197679681F1",
      tenantId: "t_seakoi_pilot",
      type: "business_action",
      status: "expired",
      requestedBy: { type: "user", id: "human:1" },
      action: "message.send",
      resource: { employeeId: "emp_86A81CE8FF6F42E187BCF2B540", channel: "feishu" },
      argsDigest: "sha256:apr02",
      binding: { changeKind: "message_send", runId: "run_apr02_seed" },
      riskLevel: "high",
      reasonText: "APR-02 VG live seed",
      approvers: [{ userId: "human:1", role: "owner" }],
      requiredApprovals: 1,
      decisions: [],
      createdAt: "2026-11-16T13:09:04.322Z",
      decidedAt: "2026-11-17T13:09:04.322Z",
      expiresAt: "2026-11-17T13:09:04.322Z",
      remainingSeconds: 0,
      ttlSeconds: 86400,
      policyDecisionId: "pd_apr02_seed_20261116",
    };
    await mount(async (url) => {
      if (url.includes("/api/approval?id=")) return sample;
      return { items: [sample] };
    });
    const card = document.querySelector("[data-testid^='apr5-row-']") as HTMLElement | null;
    expect(card, "row card").toBeTruthy();
    await act(async () => {
      card!.click();
    });
    // The history pane passes testId="apr5-detail" explicitly; the eight
    // PRD fields inside carry the apd5-field-* family regardless.
    await waitFor(() => document.querySelector("[data-testid='apr5-detail']") !== null, "detail opened");
    expect(document.querySelector("[data-testid='apr5-detail-empty']")).toBeNull();
    for (const key of [
      "apd5-field-change-kind",
      "apd5-field-verdict",
      "apd5-field-decided-at",
      "apd5-field-recipient",
      "apd5-field-scope",
      "apd5-field-action-hash",
      "apd5-field-request-id",
      "apd5-approver",
    ]) {
      expect(document.querySelector(`[data-testid='${key}']`), key).toBeTruthy();
    }
    const detailText = document.querySelector("[data-testid='apr5-detail']")?.textContent ?? "";
    expect(detailText).not.toContain("human:");
    expect(document.querySelector("[data-testid='apd5-replay']")).toBeTruthy();
    expect(detailText).toContain("无决策记录");
    expect(detailText).not.toContain("emp_");
    expect(document.querySelector("[data-testid='apd5-field-change-kind']")?.textContent).toContain("对外发送消息");
  });

  it("R46: apd6 shows submit, recorded nodes in service order, outstanding approvers and honest gaps", async () => {
    const sample = {
      approvalId: "ap_trail_1",
      title: "批量导出",
      status: "pending",
      type: "data_export",
      requestedBy: { type: "user", id: "human:7", name: "张三" },
      createdAt: "2026-11-18T02:30:00Z",
      approvers: [
        { userId: "employee:emp_217A91BA995044DFBB3E2E940B", name: "小鲤" },
        { userId: "human:7", name: "张三" },
      ],
      requiredApprovals: 2,
      decisions: [{ verdict: "approve", by: "human:7", name: "张三", decidedAt: "2026-11-18T03:00:00Z" }],
      requestId: "req-trail",
    };
    await mount(async (url) => {
      if (url.includes("/api/approval?id=")) return sample;
      return { items: [sample] };
    });
    const card = document.querySelector("[data-testid^='apr5-row-']") as HTMLElement;
    await act(async () => {
      card.click();
    });
    await waitFor(() => document.querySelector("[data-testid='apd6-trail']") !== null, "trail mounted");
    const trail = document.querySelector("[data-testid='apd6-trail']");
    expect(trail?.textContent).toContain("提交 · 张三 · 2026-11-18 10:30");
    expect(document.querySelector("[data-testid='apd6-step-node-0']")?.textContent).toContain(
      "节点 1 · 张三 · 通过 · 2026-11-18 11:00 · 意见：未填",
    );
    expect(document.querySelector("[data-testid='apd6-step-node-1']")).toBeNull();
    const pending = document.querySelector("[data-testid='apd6-step-pending-0']");
    expect(pending?.textContent).toContain("小鲤");
    expect(pending?.textContent).toContain("待办");
    expect(pending?.textContent).toContain("该段无记录");
    expect(document.querySelector("[data-testid='apd6-step-final']")?.textContent).toContain("终态 ·");
    expect(document.querySelector("[data-testid='apd6-step-links']")?.textContent).toContain("该段无记录");
    // the trail never shows a bare handle or invents an order
    expect(trail?.textContent).not.toContain("human:");
    expect(trail?.textContent).not.toContain("emp_");
  });

  it("R46: when the ticket carries run/task ids the trail links them for real", async () => {
    const sample = {
      approvalId: "ap_trail_2",
      title: "清理过期文件",
      status: "approved",
      type: "cleanup",
      requestedBy: { type: "user", id: "human:1", name: "李四" },
      createdAt: "2026-11-17T01:00:00Z",
      approvers: [{ userId: "human:1", name: "李四" }],
      decisions: [{ verdict: "approve", by: "human:1", name: "李四", decidedAt: "2026-11-17T02:00:00Z", comment: "可以" }],
      runId: "run_217A91BA995044DF",
      taskId: "tk_217A91BA995044DF",
    };
    await mount(async (url) => {
      if (url.includes("/api/approval?id=")) return sample;
      return { items: [sample] };
    });
    const card = document.querySelector("[data-testid^='apr5-row-']") as HTMLElement;
    await act(async () => {
      card.click();
    });
    await waitFor(() => document.querySelector("[data-testid='apd6-trail']") !== null, "trail mounted");
    const run = document.querySelector("[data-testid='apd6-link-run']") as HTMLAnchorElement | null;
    expect(run?.getAttribute("href")).toBe("/runs/run_217A91BA995044DF");
    const task = document.querySelector("[data-testid='apd6-link-task']") as HTMLAnchorElement | null;
    expect(task?.getAttribute("href")).toBe("/tasks/tk_217A91BA995044DF");
    expect(document.querySelector("[data-testid='apd6-step-node-0']")?.textContent).toContain("意见：可以");
  });

  it("R31 obs: the approver field renders once and bare human:1 reads 人员 with the handle in the title", async () => {
    const sample = {
      approvalId: "ap_123DE49B9A1F42A197679681F1",
      tenantId: "t_seakoi_pilot",
      type: "business_action",
      status: "expired",
      requestedBy: { type: "user", id: "human:1" },
      action: "message.send",
      resource: { employeeId: "emp_86A81CE8FF6F42E187BCF2B540", channel: "feishu" },
      argsDigest: "sha256:apr02",
      binding: { changeKind: "message_send", runId: "run_apr02_seed" },
      riskLevel: "high",
      reasonText: "APR-02 VG live seed",
      approvers: [{ userId: "human:1", role: "owner" }],
      requiredApprovals: 1,
      decisions: [],
      createdAt: "2026-11-16T13:09:04.322Z",
      decidedAt: "2026-11-17T13:09:04.322Z",
      expiresAt: "2026-11-17T13:09:04.322Z",
      remainingSeconds: 0,
      ttlSeconds: 86400,
      policyDecisionId: "pd_apr02_seed_20261116",
    };
    await mount(async (url) => {
      if (url.includes("/api/approval?id=")) return sample;
      return { items: [sample] };
    });
    const card = document.querySelector("[data-testid^='apr5-row-']") as HTMLElement | null;
    expect(card, "row card").toBeTruthy();
    await act(async () => {
      card!.click();
    });
    await waitFor(() => document.querySelector("[data-testid='apr5-detail']") !== null, "detail opened");
    // The live defect was 「审批人：审批人」 — label plus echoing value.
    const detailText = document.querySelector("[data-testid='apr5-detail']")?.textContent ?? "";
    expect(detailText).not.toContain("审批人：审批人");
    expect(document.querySelectorAll("[data-testid='apd5-field-approver']")).toHaveLength(1);
    expect(document.querySelectorAll("[data-testid='apd5-approver']")).toHaveLength(1);
    expect(document.querySelector("[data-testid='apd5-approver']")?.textContent).toBe("人员");
    expect(document.querySelector("[data-testid='apd5-approver']")?.getAttribute("title")).toContain("human:1");
    expect(detailText).not.toContain("human:");
  });
});
