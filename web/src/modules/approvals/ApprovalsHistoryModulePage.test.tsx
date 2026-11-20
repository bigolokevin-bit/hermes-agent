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
import { approvalsCsvName, buildApprovalsCsv, csvEscape } from "@/modules/approvals/QueueCsvExport";
import { riskView, statusView, type ApprovalRow } from "@/modules/approvals/model";

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

describe("R54 CSV export", () => {
  const mkRow = (over: Partial<ApprovalRow> & { title: string }): ApprovalRow =>
    ({
      key: over.rawId ?? "k",
      rawId: over.rawId ?? "ap_X",
      status: statusView("pending"),
      requester: { name: "李思", handle: null },
      worker: { name: "小鲤", handle: null },
      submitted: "2026-11-19 09:20",
      clock: "2026-11-19 09:20",
      clockLabel: "处理期限",
      amount: null,
      reason: null,
      risk: riskView(null),
      ...over,
    } as unknown as ApprovalRow);

  it("escapes RFC4180 hazards, keeps missing times empty, and names the file in Beijing time", () => {
    const csv = buildApprovalsCsv([
      mkRow({ title: '预算, 含"引号"' }),
      mkRow({ rawId: "ap_Y", title: "无时间", clock: null, risk: riskView("high") }),
    ]);
    const lines = csv.replace(/^\uFEFF/, "").split("\r\n");
    expect(lines[0]).toBe("id,title,status,risk,updated_at");
    expect(lines[1]).toContain('"预算, 含""引号"""');
    expect(lines[1].endsWith(",2026-11-19 09:20")).toBe(true);
    expect(lines[2].endsWith(",高风险,")).toBe(true); // risk 屏上值；updated_at 缺=空，不补 0
    expect(csvEscape("plain")).toBe("plain");
    expect(approvalsCsvName("history", "pending", new Date("2026-11-20T02:00:00Z"))).toBe(
      "approvals-history-pending-20261120-1000.csv",
    );
    expect(approvalsCsvName("history", null, new Date("2026-11-20T16:05:00Z"))).toBe(
      "approvals-history-all-20261121-0005.csv",
    );
  });

  it("button mirrors the rendered rows; empty filters disable it with a reason", async () => {
    await mount();
    expect(document.querySelector('[data-testid="apv7-export-count"]')?.textContent).toContain("共 8 行");
    const btn = document.querySelector('[data-testid="apv7-export"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    // 导出点击=纯前端 Blob：拦 createObjectURL 核对内容，不发任何额外请求。
    let text = "";
    const before = api.fetchJSON.mock.calls.length;
    const orig = URL.createObjectURL;
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (b: Blob) => {
      void b.text().then((t) => {
        text = t;
      });
      return "blob:captured";
    };
    await act(async () => {
      btn.click();
    });
    await waitFor(() => text !== "", "blob text");
    expect(text.split("\r\n").filter((l) => l !== "").length).toBe(9); // header + 8 行=屏上同源
    expect(api.fetchJSON.mock.calls.length).toBe(before);
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = orig;

    await mount(async () => ({ items: [] }));
    const btn2 = document.querySelector('[data-testid="apv7-export"]') as HTMLButtonElement;
    expect(btn2.disabled).toBe(true);
    expect(btn2.getAttribute("title")).toContain("没有可导出的行");
  });
});

describe("R55 detail <-> list state preservation", () => {
  const DETAIL_SAMPLE = {
    approvalId: "ap_p",
    status: "pending",
    requestedBy: { type: "human", id: "human:9" },
    action: "publish.release",
    createdAt: "2026-11-19T01:00:00Z",
    approvers: [{ userId: "human:9" }],
    decisions: [],
  };

  it("opens from a row, returns via apd7-back with the filter URL and scroll restored", async () => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 123 });
    const scrolled: number[][] = [];
    const realScrollTo = window.scrollTo;
    window.scrollTo = ((x: number, y: number) => {
      scrolled.push([x, y]);
    }) as typeof window.scrollTo;
    await mount(async (url: string) => {
      if (url.includes("/api/approval?id=")) return DETAIL_SAMPLE;
      const match = /[?&]status=([^&]*)/.exec(url);
      const state = match ? decodeURIComponent(match[1]) : null;
      return { items: state === null ? [] : ((ROWS_BY_STATE[state] ?? []) as unknown[]) };
    }, "/approvals?tab=history&status=pending");
    const card = document.querySelector("[data-testid='apr5-row-ap_p']") as HTMLElement;
    await act(async () => {
      card.click();
    });
    await waitFor(() => document.querySelector("[data-testid='apr5-detail']") !== null, "detail opened");
    expect(window.sessionStorage.getItem("approvals-history-scroll")).toBe("123");
    const back = document.querySelector("[data-testid='apd7-back']") as HTMLButtonElement;
    expect(back).toBeTruthy();
    await act(async () => {
      back.click();
    });
    expect(document.querySelector("[data-testid='apr5-detail']")).toBeNull();
    // 筛选复原读数：pending 快捷键仍是按下态，列表仍是该筛选下的一行。
    expect(document.querySelector("[data-testid='apv5-filter-status-pending']")?.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector("[data-testid='apr5-row-ap_p']")).toBeTruthy();
    expect(scrolled).toEqual([[0, 123]]);
    window.scrollTo = realScrollTo;
  });

  it("a pasted ?id= URL opens that detail straight away, with the real back exit", async () => {
    await mount(async (url: string) => {
      if (url.includes("/api/approval?id=")) return DETAIL_SAMPLE;
      if (/[?&]status=/.test(url)) return { items: [] };
      return { items: [] };
    }, "/approvals?tab=history&id=ap_p");
    await waitFor(() => document.querySelector("[data-testid='apr5-detail']") !== null, "pasted url opened the detail");
    expect(document.querySelector("[data-testid='apd7-back']")).toBeTruthy();
  });

  it("loaded pages survive the round trip: no extra list fetch after 返回", async () => {
    await mount(async (url: string) => {
      if (url.includes("/api/approval?id=")) return DETAIL_SAMPLE;
      if (/[?&]cursor=/.test(url)) return { items: [{ approvalId: "ap_a", title: "第二页", status: "approved", decidedAt: "2026-11-17T02:00:00Z" }] };
      return { items: [{ approvalId: "ap_p", title: "等待你点头的发布", status: "pending" }], nextCursor: "c1" };
    });
    await waitFor(() => document.querySelector("[data-testid='apr5-row-ap_p']") !== null, "page one");
    const more = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes("加载更多")) as HTMLButtonElement;
    await act(async () => {
      more.click();
    });
    await waitFor(() => document.querySelector("[data-testid='apr5-row-ap_a']") !== null, "page two");
    const listCallsBefore = api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approvals")).length;
    const card = document.querySelector("[data-testid='apr5-row-ap_p']") as HTMLElement;
    await act(async () => {
      card.click();
    });
    await waitFor(() => document.querySelector("[data-testid='apr5-detail']") !== null, "detail opened");
    const back = document.querySelector("[data-testid='apd7-back']") as HTMLButtonElement;
    await act(async () => {
      back.click();
    });
    expect(document.querySelector("[data-testid='apr5-row-ap_p']")).toBeTruthy();
    expect(document.querySelector("[data-testid='apr5-row-ap_a']")).toBeTruthy();
    const listCallsAfter = api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approvals")).length;
    expect(listCallsAfter).toBe(listCallsBefore);
  });
});

describe("R50 queue summary bar", () => {
  it("counts the same result set, and single-status scopes stay — not fake zeros", async () => {
    await mount(); // status 未传 → BFF 聚合全状态，每态一行（8 行）
    const bar = document.querySelector('[data-testid="apv6-summary"]');
    expect(bar).toBeTruthy();
    const pending = document.querySelector('[data-testid="apv6-summary-pending"]');
    expect(pending?.getAttribute("href")).toBe("/approvals?tab=history&status=pending");
    expect(pending?.textContent).toContain("1");
    expect(document.querySelector('[data-testid="apv6-summary-approved"]')?.textContent).toContain("1");
    // 聚合夹具每态一行 → 已拒同为真计数。
    expect(document.querySelector('[data-testid="apv6-summary-rejected"]')?.textContent).toContain("1");
    // 夹具行没有 riskLevel 字段 → 风险桶在覆盖范围内为 0（真零），只读 span。
    expect(document.querySelector('[data-testid="apv6-summary-risk-high"]')?.textContent).toContain("0");
    expect(document.querySelector('[data-testid="apv6-summary-risk-high"]')?.getAttribute("title")).toContain("只读");
    // 单选状态下，其余状态桶不同源 → 「—」并写明原因。
    await mount(undefined, "/approvals?tab=history&status=pending");
    const approved2 = document.querySelector('[data-testid="apv6-summary-approved"]');
    expect(approved2?.textContent).toContain("—");
    expect(approved2?.getAttribute("title")).toContain("不同源");
    expect(document.querySelector('[data-testid="apv6-summary-pending"]')?.textContent).toContain("1");
  });
});

describe("R59 approvals queue search (apv8-*)", () => {
  const typeInto = async (value: string) => {
    const box = document.querySelector('[data-testid="apv8-search"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(box, value);
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const rowCards = () => document.querySelectorAll('[data-testid^="apr5-row-ap"]');

  it("typing filters the loaded rows locally with zero new requests and mirrors in the counts", async () => {
    await mount();
    expect(document.querySelector('[data-testid="apv8-search"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="apv8-scope-note"]')?.textContent).toContain("仅在当前已加载 8 条内搜索");
    expect(document.querySelector('[data-testid="apv8-scope-note"]')?.getAttribute("title")).toContain("q/keyword/title");
    expect(rowCards()).toHaveLength(8);
    const before = api.fetchJSON.mock.calls.length;
    await typeInto("预算");
    expect(api.fetchJSON.mock.calls.length).toBe(before); // 本地过滤=零新请求
    expect(rowCards()).toHaveLength(1);
    expect((document.querySelector('[data-testid="apv5-count"]') as HTMLElement).textContent).toBe("1");
    expect(document.body.textContent).toContain("关键字过滤中");
    expect(document.querySelector('[data-testid="apv6-summary"]')).toBeTruthy();
  });

  it("no match states the honest local result and the clear button restores the list", async () => {
    await mount(undefined, "/approvals?tab=history&q=nomatch-xyz");
    const empty = document.querySelector('[data-testid="apv8-search-empty"]');
    expect(empty).toBeTruthy();
    expect(empty?.textContent).toContain("没有匹配的审批");
    expect(empty?.textContent).toContain("nomatch-xyz");
    const clear = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes("清空搜索"))!;
    await act(async () => {
      clear.click();
    });
    expect(document.querySelector('[data-testid="apv8-search-empty"]')).toBeNull();
    expect(rowCards()).toHaveLength(8);
    expect((document.querySelector('[data-testid="apv8-search"]') as HTMLInputElement).value).toBe("");
  });

  it("a pasted ?q= deep link reopens straight into the filtered view", async () => {
    await mount(undefined, "/approvals?tab=history&q=预算");
    expect(rowCards()).toHaveLength(1);
    expect((document.querySelector('[data-testid="apv8-search"]') as HTMLInputElement).value).toBe("预算");
    expect((document.querySelector('[data-testid="apv5-count"]') as HTMLElement).textContent).toBe("1");
  });

  describe("R60 inline row preview (apv9-*)", () => {
    const ROWS_META = {
      items: [
        {
          approvalId: "ap_v1",
          type: "policy_update",
          status: "approved",
          requestedBy: "human:5",
          action: "rotate.secret",
          riskLevel: "high",
          approvers: [{ userId: "human:7", name: "郑涛" }],
          requestId: "req-v1-9",
          createdAt: "2026-11-19T01:00:00Z",
          decidedAt: "2026-11-19T02:00:00Z",
        },
      ],
    };

    it("expands in place from the row payload only — no new request, honest missing fields", async () => {
      await mount(async (url) =>
        url.includes("/api/approvals") ? ROWS_META : { items: [] },
      );
      const calls = api.fetchJSON.mock.calls.length;
      const toggle = (document.querySelector as (sel: string) => HTMLButtonElement | null)('[data-testid="apv9-toggle-ap_v1"]');
      expect(toggle).toBeTruthy();
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      await act(async () => {
        toggle.click();
      });
      expect(api.fetchJSON.mock.calls.length).toBe(calls); // 禁额外请求：数据全来自已加载行
      const preview = (document.querySelector as (sel: string) => HTMLElement | null)('[data-testid="apv9-preview-ap_v1"]');
      expect(preview?.textContent).toContain("rotate.secret");
      expect(preview?.textContent).toContain("郑涛");
      expect(preview?.textContent).toContain("req-v1-9");
      expect(preview?.textContent).toContain("2026-11-19 10:00"); // BJT 到分
      expect(preview?.textContent).toContain("高");
      expect((document.querySelector as (sel: string) => HTMLButtonElement | null)('[data-testid="apv9-toggle-ap_v1"]')?.getAttribute("aria-expanded")).toBe("true");
      // 展开不是打开详情：详情抽屉没被唤起。
      expect(document.querySelector("[data-testid='apr5-detail']")).toBeNull();
      // Esc 收起且焦点回到行内开关。
      await act(async () => {
        (document.querySelector as (sel: string) => HTMLButtonElement | null)('[data-testid="apv9-toggle-ap_v1"]')?.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
        );
      });
      expect(document.querySelector('[data-testid="apv9-preview-ap_v1"]')).toBeNull();
      expect(document.activeElement?.getAttribute("data-testid")).toBe("apv9-toggle-ap_v1");
    });

    it("falls back to 该字段未返回 when the row carries no approvers or request id", async () => {
      await mount(); // 默认 8 态夹具：无 approvers/requestId 键
      const toggle = (document.querySelector as (sel: string) => HTMLButtonElement | null)('[data-testid="apv9-toggle-ap_p"]');
      await act(async () => {
        toggle?.click();
      });
      const preview = (document.querySelector as (sel: string) => HTMLElement | null)('[data-testid="apv9-preview-ap_p"]');
      expect(preview?.textContent).toContain("该字段未返回");
      expect(preview?.textContent).toContain("请求编号");
      expect(preview?.textContent).not.toContain("human:");
    });

    it("keeps at most one preview open", async () => {
      await mount();
      const first = (document.querySelector as (sel: string) => HTMLButtonElement | null)('[data-testid="apv9-toggle-ap_p"]');
      await act(async () => {
        first?.click();
      });
      expect(document.querySelector('[data-testid="apv9-preview-ap_p"]')).toBeTruthy();
      const second = (document.querySelector as (sel: string) => HTMLButtonElement | null)('[data-testid="apv9-toggle-ap_a"]');
      await act(async () => {
        second?.click();
      });
      expect(document.querySelector('[data-testid="apv9-preview-ap_p"]')).toBeNull();
      expect(document.querySelector('[data-testid="apv9-preview-ap_a"]')).toBeTruthy();
    });
  });

})

describe("R61 trail copy (apd8-*)", () => {
  const TRAIL_SAMPLE = {
    approvalId: "ap_t8",
    status: "approved",
    requestedBy: { type: "human", id: "human:9" },
    action: "rotate.secret",
    createdAt: "2026-11-19T01:00:00Z",
    decidedAt: "2026-11-19T02:00:00Z",
    approvers: [
      { userId: "human:7", name: "郑涛" },
      { userId: "human:8", name: "阿朝" },
    ],
    decisions: [
      { userId: "human:7", name: "郑涛", verdict: "approve", decidedAt: "2026-11-19T01:50:00Z", comment: "可以，按计划轮换。" },
      { userId: "human:8", verdict: "approve", decidedAt: "2026-11-19T01:55:00Z" },
    ],
  };
  const EMPTY_TRAIL_SAMPLE = {
    approvalId: "ap_e8",
    status: "pending",
    requestedBy: { type: "human", id: "human:9" },
    action: "keepalive",
    createdAt: "2026-11-19T01:00:00Z",
    approvers: [],
    decisions: [],
  };

  async function openTrail(sample: unknown) {
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
    await waitFor(() => document.querySelector("[data-testid='apd6-trail']") !== null, "trail mounted");
  }

  it("copies the on-screen trail in order, with no extra request", async () => {
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: (t: string) => { written.push(t); return Promise.resolve(); } },
    });
    await openTrail(TRAIL_SAMPLE);
    const callsBefore = api.fetchJSON.mock.calls.length;
    const btn = document.querySelector("[data-testid='apd8-copy']") as HTMLButtonElement | null;
    expect(btn, "copy button").toBeTruthy();
    expect(btn!.disabled).toBe(false);
    await act(async () => {
      btn!.click();
    });
    await waitFor(() => (document.querySelector("[data-testid='apd8-copy-status']")?.textContent ?? "").includes("已复制"), "copied feedback");
    expect(api.fetchJSON.mock.calls.length, "copying never fetches").toBe(callsBefore);
    const text = written[0] ?? "";
    expect(text).toContain("提交 · 成员 · 9 · 2026-11-19 09:00");
    expect(text).toContain("节点 1 · 郑涛 · 通过 · 2026-11-19 09:50 · 意见：可以，按计划轮换。");
    // 裸 human:8 没有姓名 → 屏上口径「人员」；缺意见 → 「未填」。
    expect(text).toContain("节点 2 · 人员 · 通过 · 2026-11-19 09:55 · 意见：未填");
    expect(text).toContain("阿朝 · 待办 · 该段无记录 · 意见：未填");
    expect(text).toContain("终态 ·");
    expect(text).not.toContain("human:");
    expect(text).not.toContain("emp_");
    expect(text).not.toContain("ap_t8");
    expect(document.querySelector("[data-testid='apd8-fallback']")).toBeNull();
  });

  it("falls back to a read-only textarea when the clipboard refuses", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("denied")) },
    });
    await openTrail(TRAIL_SAMPLE);
    const btn = document.querySelector("[data-testid='apd8-copy']") as HTMLButtonElement | null;
    await act(async () => {
      btn!.click();
    });
    await waitFor(() => document.querySelector("[data-testid='apd8-fallback']") !== null, "fallback textarea");
    const box = document.querySelector("[data-testid='apd8-fallback']") as HTMLTextAreaElement;
    expect(box.readOnly).toBe(true);
    expect(box.value).toContain("节点 1 · 郑涛");
    expect((document.querySelector("[data-testid='apd8-copy-status']")?.textContent ?? "")).toContain("手动复制");
  });

  it("disables the copy for an empty trail, with the reason in the title", async () => {
    await openTrail(EMPTY_TRAIL_SAMPLE);
    const btn = document.querySelector("[data-testid='apd8-copy']") as HTMLButtonElement | null;
    expect(btn, "copy button").toBeTruthy();
    expect(btn!.disabled).toBe(true);
    expect(btn!.title).toContain("没有可复制的链路");
    expect(document.querySelector("[data-testid='apd8-fallback']")).toBeNull();
  });
});

describe("R65 preview-detail parity (apv9 vs apd5/apd6)", () => {
  const PARITY_ROW = {
    approvalId: "ap_p65",
    status: "pending",
    action: "rotate.secret",
    riskLevel: "high",
    expiresAt: "2026-11-21T02:00:00Z",
    consoleRequestId: "req-cr-65",
    createdAt: "2026-11-19T01:00:00Z",
    approvers: [{ userId: "human:7", name: "郑涛" }],
    decisions: [],
  };
  const SETTLED_ROW = {
    approvalId: "ap_s65",
    status: "approved",
    action: "publish.weekly",
    decidedAt: "2026-11-19T02:00:00Z",
    requestId: "req-plain-65",
    approvers: [{ userId: "human:8", name: "阿朝" }],
    decisions: [{ userId: "human:8", name: "阿朝", verdict: "approve", decidedAt: "2026-11-19T02:00:00Z" }],
  };
  const parityHandler = (url: string) => {
    if (url.includes("/api/approval?id=")) {
      return Promise.resolve(url.includes("ap_s65") ? SETTLED_ROW : PARITY_ROW);
    }
    return Promise.resolve({ items: [PARITY_ROW, SETTLED_ROW] });
  };
  const previewOf = (key: string) =>
    document.querySelector(`[data-testid='apv9-preview-${key}']`);
  const detailOf = () => document.querySelector("[data-testid='apr5-detail']");
  const toggleOf = (key: string) =>
    document.querySelector(`[data-testid='apv9-toggle-${key}']`) as HTMLButtonElement | null;

  it("pending ticket: same title/risk/rid/approver on both surfaces; preview never uses 「该段无记录」", async () => {
    await mount(parityHandler);
    const toggle = toggleOf("ap_p65");
    expect(toggle, "toggle").toBeTruthy();
    const before = api.fetchJSON.mock.calls.length;
    await act(async () => {
      toggle!.click();
    });
    expect(api.fetchJSON.mock.calls.length, "preview fetches nothing").toBe(before);
    // 打开同一单的详情（openRow 会收起预览，随后再展开一次=两屏同存）
    const card = document.querySelector("[data-testid='apr5-row-ap_p65']") as HTMLElement | null;
    expect(card, "row card").toBeTruthy();
    await act(async () => {
      card!.click();
    });
    await waitFor(() => !!detailOf(), "detail open");
    const mid = api.fetchJSON.mock.calls.length;
    await act(async () => {
      toggleOf("ap_p65")!.click();
    });
    expect(api.fetchJSON.mock.calls.length, "re-expanding still fetches nothing").toBe(mid);
    const pvText = previewOf("ap_p65")?.textContent ?? "";
    const dtText = detailOf()?.textContent ?? "";
    expect(pvText).toContain("rotate.secret");
    expect(dtText).toContain("rotate.secret");
    expect(pvText).toContain("高风险");
    expect(dtText).toContain("高风险");
    // 行体只带 consoleRequestId：键序对齐后两处都读到它
    expect(pvText).toContain("req-cr-65");
    expect(dtText).toContain("req-cr-65");
    expect(pvText).toContain("郑涛");
    expect(dtText).toContain("郑涛");
    // pending 无决定时间：详情「决定时间」为破折号，预览同值；缺字段口径写在
    // Field 的 title（不混入正文），且「该字段未返回/该段无记录」两处不互混。
    expect(pvText).not.toContain("该段无记录");
    expect(
      document.querySelector("[data-testid='apv9-preview-ap_p65'] [title='该字段未返回']"),
    ).toBeTruthy();
    const decided = document.querySelector("[data-testid='apd5-field-decided-at']");
    expect(decided?.textContent).toContain("—");
    // 预览「更新时间」不再拿处理期限冒充：expiresAt 的时间不得上屏
    expect(pvText).not.toContain("2026-11-21");
  });

  it("settled ticket: preview 更新时间 equals detail 决定时间 to the minute", async () => {
    await mount(parityHandler);
    const toggle = toggleOf("ap_s65");
    expect(toggle, "toggle").toBeTruthy();
    await act(async () => {
      toggle!.click();
    });
    const pvText = previewOf("ap_s65")?.textContent ?? "";
    expect(pvText).toContain("2026-11-19 10:00");
    const card = document.querySelector("[data-testid='apr5-row-ap_s65']") as HTMLElement | null;
    await act(async () => {
      card!.click();
    });
    await waitFor(() => !!detailOf(), "detail open");
    const decided = document.querySelector("[data-testid='apd5-field-decided-at']");
    expect(decided?.textContent).toContain("2026-11-19 10:00");
  });

  it("missing risk reads 「未标注风险」 on both sides — same value, distinct honesty labels", async () => {
    await mount((url: string) => {
      const bare = {
        approvalId: "ap_m65",
        status: "pending",
        action: "run.tool",
        createdAt: "2026-11-19T01:00:00Z",
        approvers: [],
      };
      if (url.includes("/api/approval?id=")) return Promise.resolve(bare);
      return Promise.resolve({ items: [bare] });
    });
    const toggle = toggleOf("ap_m65");
    expect(toggle, "toggle").toBeTruthy();
    await act(async () => {
      toggle!.click();
    });
    const card = document.querySelector("[data-testid='apr5-row-ap_m65']") as HTMLElement | null;
    await act(async () => {
      card!.click();
    });
    await waitFor(() => !!detailOf(), "detail open");
    await act(async () => {
      toggleOf("ap_m65")!.click();
    });
    const pvText = previewOf("ap_m65")?.textContent ?? "";
    const dtText = detailOf()?.textContent ?? "";
    expect(pvText).toContain("未标注风险");
    expect(dtText).toContain("未标注风险");
    expect(pvText).toContain("该字段未返回");
    expect(pvText).not.toContain("该段无记录");
    expect(dtText).toContain("该段无记录");
  });
});

describe("R70 queue state consistency (apv-state-*)", () => {
  const qa = (id: string) => document.querySelector(`[data-testid="${id}"]`);

  it("loading shows the equal-height skeleton and gates every action", async () => {
    api.fetchJSON.mockImplementation(() => new Promise(() => {}));
    await render("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await waitFor(() => !!qa("apv-state"), "state container");
    expect(qa("apv-state")?.getAttribute("data-phase")).toBe("loading");
    expect(document.querySelectorAll('[data-testid="apr5-loading"] .animate-pulse').length).toBe(4);
    const btn = qa("apv7-export") as HTMLButtonElement | null;
    expect(btn, "export button present").toBeTruthy();
    expect(btn!.disabled, "export gated while loading").toBe(true);
    expect(btn!.title).toContain("不能导出");
    expect(qa("apv7-export-count")?.textContent).toBe("—");
    expect(qa("apv6-summary-pending")?.textContent).toContain("—");
    expect(qa("apv6-summary-pending")?.getAttribute("title")).toContain("计数不作 0");
  });

  it("error: human sentence, copyable rid, retry, gated actions, URL kept", async () => {
    await mount(
      async (url: string) => {
        if (String(url).includes("/api/approval?id=")) return Promise.resolve({});
        throw new ApiError("boom", { status: 500, body: "", url: "/agent-api/api/approvals", requestId: "req-r70-500" });
      },
      "/approvals?tab=history&status=pending&q=zz",
    );
    await waitFor(() => !!qa("apv-state-error"), "error panel");
    expect(qa("apv-state")?.getAttribute("data-phase")).toBe("error");
    expect(qa("apv-state-rid")?.textContent).toContain("req-r70-500");
    expect(qa("apv-state-rid")?.querySelector('[data-testid="apr5-copy-request-id"]'), "copyable rid").toBeTruthy();
    expect(qa("apv-state-retry"), "retry carrier").toBeTruthy();
    expect(qa("apr5-retry"), "existing retry testid kept").toBeTruthy();
    const btn = qa("apv7-export") as HTMLButtonElement;
    expect(btn.disabled, "export gated on error").toBe(true);
    expect(btn.title).toContain("不能导出：列表没能加载");
    expect(qa("apv7-export-count")?.textContent).toBe("—");
    expect(qa("apv6-summary-risk-high")?.getAttribute("title"), "risk bucket title").toContain("列表读取失败");
    // denied/error 面不画行：预览入口不存在
    expect(qa("apr5-list")?.querySelector('[data-testid^="apv9-toggle-"]')).toBeNull();
    // URL 筛选态原样保留（MemoryRouter 下以受控输入值为准，面板不改写）
    expect(qa("apv8-search")?.getAttribute("value")).toBe("zz");
    expect(qa("apv8-search-group")).toBeTruthy();
  });

  it("empty with a filter offers the clear exit; clearing restores the full list", async () => {
    await mount(
      async (url: string) => {
        const u = String(url);
        if (u.includes("/api/approval?id=")) return Promise.resolve({});
        if (u.includes("status=pending")) return { items: [] };
        return { items: ALL };
      },
      "/approvals?tab=history&status=pending",
    );
    await waitFor(() => !!qa("apv-state-empty"), "empty panel");
    expect(qa("apv-state")?.getAttribute("data-phase")).toBe("empty");
    expect(qa("apv-state-empty-text")?.textContent).toContain("该条件下无审批");
    // 汇总条计数位不显 0 冒充空集
    expect(qa("apv6-summary-pending")?.textContent).toContain("—");
    expect(qa("apv6-summary-pending")?.getAttribute("title")).toContain("真实空集");
    const clear = qa("apv-state-clear") as HTMLButtonElement | null;
    expect(clear, "clear exit for filtered empty").toBeTruthy();
    await act(async () => {
      clear!.click();
    });
    await waitFor(() => !!qa("apr5-row-ap_p"), "restored list");
    expect(qa("apv-state-clear"), "empty panel gone").toBeNull();
  });

  it("empty without any filter has no fake clear exit", async () => {
    await mount(
      async (url: string) => {
        if (String(url).includes("/api/approval?id=")) return Promise.resolve({});
        return { items: [] };
      },
      "/approvals?tab=history",
    );
    await waitFor(() => !!qa("apv-state-empty"), "empty panel");
    expect(qa("apv-state-clear"), "no filter nothing to clear").toBeNull();
  });

  it("403 and 404 are one body: same panel, same sentence, rid kept, URL kept", async () => {
    const deniedText = async (status: number): Promise<string> => {
      await mount(
        async (url: string) => {
          if (String(url).includes("/api/approval?id=")) return Promise.resolve({});
          throw new ApiError("nope", { status, body: "", url: "/agent-api/api/approvals", requestId: `req-r70-${status}` });
        },
        "/approvals?tab=history&status=pending",
      );
      await waitFor(() => !!qa("apv-state-denied"), `denied ${status}`);
      // 同句=面板首行人话（请求编号每请求不同，不属于「同体」比对面）。
      return qa("apv-state-denied")?.querySelector("p")?.textContent ?? "";
    };
    const a = await deniedText(403);
    expect(a).toContain("暂时无法查看审批申请");
    const b = await deniedText(404);
    expect(b).toBe(a);
    expect(qa("apv-state-error"), "denied is not an error panel").toBeNull();
    const btn = qa("apv7-export") as HTMLButtonElement;
    expect(btn.disabled, "export gated on denied").toBe(true);
    expect(btn.title).toContain("不能导出：没有读取权限");
  });
});

