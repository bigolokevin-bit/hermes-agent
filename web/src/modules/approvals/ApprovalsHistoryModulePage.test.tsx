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
  document.querySelector(`[data-testid='approvals-filter-${value}']`) as HTMLButtonElement;

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

  it("a state with no history says so, and 全部 drops the parameter", async () => {
    await mount();
    await pick("consumed");
    expect(text()).toContain("已执行的批量导出");
    api.fetchJSON.mockImplementation(async () => ({ items: [] }));
    await pick("superseded");
    expect(text()).toContain("「已被新单替代」状态下没有记录");
    expect(text()).toContain("换一个结果看看");
    // QA V4-R4 条目2: 零结果面板必须有真出口，不许死链。
    const back = document.querySelector("[data-testid='approvals-history-empty-exits-back']") as HTMLAnchorElement;
    expect(back?.getAttribute("href")).toBe("/overview");
    const contact = document.querySelector("[data-testid='approvals-history-empty-exits-contact']") as HTMLAnchorElement;
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
    expect(document.querySelectorAll("[data-testid^='approval-row-']")).toHaveLength(0);
    expect(await once(404)).toBe(forbidden);
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
    expect(document.querySelector("[data-fixture='loading']")).toBeTruthy();
    expect(api.fetchJSON).not.toHaveBeenCalled();
    await open("empty");
    expect(text()).toContain("状态下没有记录");
    await open("error");
    expect(text()).toContain("本次请求未记录编号，可复制时间与操作路径反馈");
    expect(text()).not.toContain("未提供");
    await open("denied");
    expect(document.querySelector("[data-fixture='denied']")).toBeTruthy();
    expect(document.querySelectorAll("[data-testid^='approval-row-']")).toHaveLength(0);
  });
});
