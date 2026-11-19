// @vitest-environment jsdom
// T16 — the pending pane. These run against the pane's real request layer
// (`@/lib/api`.fetchJSON is the only seam): which URL it asks for, what it
// shows for each answer, and what a decision actually sends. Nothing here
// stubs an endpoint the app then would not call.

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import ApprovalsPendingModulePage from "@/modules/approvals/ApprovalsPendingModulePage";

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

const mount = async (handler: (url: string, init?: RequestInit) => Promise<unknown>, entry = "/approvals") => {
  api.fetchJSON.mockImplementation(handler);
  await render(entry, <ApprovalsPendingModulePage />);
  await waitFor(() => !document.querySelector(".animate-pulse"), "initial load settled");
};

const text = (): string => document.body.textContent ?? "";
const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const buttonNamed = (label: string): HTMLButtonElement | undefined =>
  Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes(label));

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

const PENDING_PAGE = {
  items: [
    {
      approvalId: "ap_9F3A1111",
      title: "对外发送本周报表",
      status: "pending",
      requestedByName: "李思",
      employee: "employee:8812",
      createdAt: "2026-11-19T01:20:00Z",
      expiresAt: "2026-11-19T03:00:00Z",
      amountUsd: 25,
      reason: "需要把结果发给外部对接人",
    },
  ],
  nextCursor: null,
};

const DETAIL = {
  approvalId: "ap_9F3A1111",
  title: "对外发送本周报表",
  status: "pending",
  changeKind: "message_send",
  riskLevel: "high",
  requestedByName: "李思",
  employeeName: "小析",
  amountUsd: 25,
  reason: "需要把结果发给外部对接人",
  remainingSeconds: 4020,
  runId: "run_77aaee33",
  targetHash: "th_0123456789abcdef0123456789abcdef",
  decisions: [],
};

/** Route the three calls the pane makes; the shape of each answer is the knob. */
function queue(handler?: (url: string, init?: RequestInit) => Promise<unknown>) {
  return async (url: string, init?: RequestInit): Promise<unknown> => {
    if (handler) return handler(url, init);
    if (url.startsWith("/agent-api/api/approval?")) return DETAIL;
    if (url.startsWith("/agent-api/api/approval/decision")) return { approval: { ...DETAIL, status: "approved" } };
    return PENDING_PAGE;
  };
}

beforeEach(() => {
  // CSRF double-submit: the decision write needs a session cookie.
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

describe("pending queue states", () => {
  it("asks the pending list route and renders what comes back", async () => {
    await mount(queue());
    expect(urls()[0]).toBe("/agent-api/api/approvals?status=pending&limit=50");
    expect(text()).toContain("对外发送本周报表");
    expect(text()).toContain("待处理");
    expect(text()).toContain("李思");
    expect(text()).toContain("员工 · 8812");
    expect(text()).toContain("2026-11-19 09:20");
    expect(text()).toContain("$25.00");
    expect(text()).toContain("已显示 1 条申请，其中 1 条待处理");
  });

  it("R54: the pending tab carries the same-source CSV control", async () => {
    await mount(queue());
    expect(document.querySelector('[data-testid="apv7-export-count"]')?.textContent).toContain("共 1 行");
    const btn = document.querySelector('[data-testid="apv7-export"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.getAttribute("title")).toContain("零新后端端点");
  });

  it("R55: apd7-back closes the drawer over the same URL minus the id", async () => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 66 });
    await mount(queue());
    const card = document.querySelector("[data-testid='apr5-row-ap_9F3A1111']") as HTMLElement;
    expect(card).toBeTruthy();
    await act(async () => {
      card.click();
    });
    await waitFor(() => document.querySelector("[data-testid='apd7-back']") !== null, "back exit appeared");
    expect(window.sessionStorage.getItem("approvals-pending-scroll")).toBe("66");
    const back = document.querySelector("[data-testid='apd7-back']") as HTMLButtonElement;
    await act(async () => {
      back.click();
    });
    expect(document.querySelector("[data-testid='apr5-detail-empty']")).toBeTruthy();
  });

  it("R50: the queue summary keeps off-scope counts at — with a stated reason", async () => {
    await mount(queue());
    const pending = document.querySelector('[data-testid="apv6-summary-pending"]');
    expect(pending?.getAttribute("href")).toBe("/approvals?tab=history&status=pending");
    expect(pending?.textContent).toContain("1");
    const approved = document.querySelector('[data-testid="apv6-summary-approved"]');
    expect(approved?.tagName).toBe("SPAN");
    expect(approved?.textContent).toContain("—");
    expect(approved?.getAttribute("title")).toContain("决策历史");
    expect(document.querySelector('[data-testid="apv6-summary-risk-low"]')).toBeTruthy();
  });

  it("loading is a skeleton, not an empty queue", async () => {
    let release: (value: unknown) => void = () => {};
    api.fetchJSON.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    await render("/approvals", <ApprovalsPendingModulePage />);
    expect(document.querySelector(".animate-pulse")).toBeTruthy();
    expect(text()).toContain("正在读取待处理审批…");
    expect(text()).not.toContain("现在没有需要你处理的申请");

    release(PENDING_PAGE);
    await waitFor(() => (document.body.textContent ?? "").includes("对外发送本周报表"), "rows painted");
  });

  it("empty names the reason and the next step, and carries a real way out", async () => {
    await mount(async () => ({ items: [] }));
    expect(text()).toContain("现在没有需要你处理的申请");
    expect(text()).toContain("提出后立刻出现在这里");
    expect(buttonNamed("刷新")).toBeTruthy();
    // QA V4-R4 条目2: 零结果面板必须有真出口，不许死链。
    const back = document.querySelector("[data-testid='apr5-empty-exits-back']") as HTMLAnchorElement;
    expect(back?.getAttribute("href")).toBe("/overview");
    expect(back?.textContent).toContain("返回控制台");
    const contact = document.querySelector("[data-testid='apr5-empty-exits-contact']") as HTMLAnchorElement;
    expect(contact?.getAttribute("href")).toMatch(/^mailto:/);
    expect(contact?.textContent).toContain("联系管理员");
  });

  it("a failed read with no request id gives the copy-and-report fallback, never 「未提供」", async () => {
    await mount(async (url) => {
      throw new ApiError("down", { status: 0, body: "", url });
    });
    expect(text()).toContain("连不上审批服务");
    expect(text()).toContain("本次请求未记录编号，可复制时间与操作路径反馈");
    expect(text()).not.toContain("未提供");
    // a missing id is honest: there is a fallback line but no copy button, and no
    // value is invented for it
    expect(document.querySelector("[data-testid='apr5-request-id-missing']")).toBeTruthy();
    expect(document.querySelector("[data-testid='apr5-request-id']")).toBeNull();
    expect(copyButton()).toBeNull();
    // 失败时队列不给任何数字口径，不给假零。
    expect(text()).not.toContain("共 0 条");
  });

  it("an unreadable answer is a failure, not an empty queue", async () => {
    await mount(async () => ({ message: "hello" }));
    expect(text()).toContain("服务回的内容不是一份审批列表");
    expect(text()).not.toContain("现在没有需要你处理的申请");
  });

  it("error says it in a sentence, with the trace id and a retry", async () => {
    const writeText = stubClipboard();
    await mount(async () => {
      throw new ApiError("downstream not ready", {
        status: 503,
        body: '{"detail":"downstream not ready"}',
        url: "/agent-api/api/approvals",
        requestId: "b6g1c2d3",
      });
    });
    expect(text()).toContain("审批申请没能加载出来");
    expect(text()).toContain("审批服务在处理时出了错");
    expect(text()).toContain("请求编号：b6g1c2d3");
    expect(text()).not.toContain("503");
    expect(document.querySelector("[data-testid='apr5-error']")).toBeTruthy();
    expect(shownRequestId()).toBe("b6g1c2d3");
    // the copy control writes the SAME string that is shown
    await act(async () => {
      (copyButton() as HTMLButtonElement).click();
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("b6g1c2d3");
    expect(String(writeText.mock.calls[0][0])).toBe(shownRequestId());
    const retry = document.querySelector("[data-testid='apr5-retry']") as HTMLButtonElement;
    expect(retry).toBeTruthy();
    api.fetchJSON.mockImplementation(queue());
    await act(async () => {
      retry.click();
    });
    await waitFor(() => (document.body.textContent ?? "").includes("对外发送本周报表"), "retry loaded rows");
  });

  it("403 and 404 draw the same body, with no rows above it", async () => {
    const denied = async (status: number) => {
      await mount(async () => {
        throw new ApiError("no", {
          status,
          body: '{"code":"console.forbidden","request_id":"ap-9c31"}',
          url: "/agent-api/api/approvals",
          requestId: "ap-9c31",
        });
      });
      return document.body.innerHTML;
    };
    const forbidden = await denied(403);
    expect(text()).toContain("暂时无法查看审批申请");
    expect(text()).toContain("请求编号：ap-9c31");
    expect(text()).not.toContain("对外发送本周报表");
    expect(document.querySelectorAll("dl")).toHaveLength(0);
    // one denied body, under the apr4 id, with no path echo
    expect(document.querySelector("[data-testid='apr5-denied']")).toBeTruthy();
    expect(forbidden).not.toContain("/agent-api");
    // overflow discipline: the page shrinks, the long sentence breaks
    const root = document.querySelector("[data-testid='apr5-page-pending']") as HTMLElement;
    expect(root.className).toContain("min-w-0");
    expect(root.className).toContain("max-w-full");
    const deniedPanel = document.querySelector("[data-testid='apr5-denied']") as HTMLElement;
    expect(deniedPanel.querySelector("p.break-words")).toBeTruthy();
    // the denied id is on screen and copyable
    expect(shownRequestId()).toBe("ap-9c31");
    expect(copyButton()).toBeTruthy();
    const missing = await denied(404);
    expect(missing).toBe(forbidden);
  });

  it("keeps handles, state tokens and run ids off the surface until 详情 is opened", async () => {
    await mount(queue());
    expect(text()).not.toContain("ap_9F3A1111");
    expect(text()).not.toContain("employee:8812");
    expect(text()).not.toContain("human:1");
    expect(text()).not.toContain("run_77aaee33");
    expect(text()).not.toContain("pending");
    expect(text()).not.toContain("message_send");

    const disclosure = buttonNamed("详情");
    expect(disclosure).toBeTruthy();
    await act(async () => {
      (disclosure as HTMLButtonElement).click();
    });
    // Only now does the technical line exist, and it still carries no run id.
    expect(text()).toContain("单据标识：ap_9F3A1111");
    expect(text()).not.toContain("run_77aaee33");
  });

  it("shows 「—」 with a reason for a value the service omitted", async () => {
    await mount(async () => ({
      items: [{ id: "ap_min", title: "没有金额和时间的申请", status: "pending" }],
    }));
    expect(text()).toContain("—");
    expect(text()).not.toContain("$0.00");
    const cell = document.querySelector("dd[title]") as HTMLElement | null;
    expect(cell?.getAttribute("title")).toContain("服务未提供");
  });
});

describe("decision writes", () => {
  const openTicket = async () => {
    const opener = document.querySelector("[data-testid='apr5-row-ap_9F3A1111'] button") as HTMLButtonElement;
    await act(async () => {
      opener.click();
    });
    await waitFor(() => urls().some((u) => u.startsWith("/agent-api/api/approval?")), "detail requested");
  };

  it("opens the ticket through the detail route", async () => {
    await mount(queue());
    await openTicket();
    expect(urls()).toContain("/agent-api/api/approval?id=ap_9F3A1111");
    expect(text()).toContain("高风险");
    expect(text()).toContain("对外发送消息");
    expect(text()).toContain("剩 1 小时 7 分");
    expect(text()).not.toContain("th_0123456789abcdef");
  });

  it("confirms, then posts the decision the BFF asks for, and re-reads instead of assuming", async () => {
    await mount(queue());
    await openTicket();
    const before = urls().length;

    const approve = buttonNamed("批准");
    expect(approve).toBeTruthy();
    await act(async () => {
      (approve as HTMLButtonElement).click();
    });
    // The confirm step asks first and sends nothing yet.
    expect(document.querySelector("[role='dialog']")).toBeTruthy();
    expect(urls().length).toBe(before);

    const confirm = document.querySelector("[data-confirm]") as HTMLButtonElement;
    await act(async () => {
      confirm.click();
    });
    await waitFor(() => urls().some((u) => u.startsWith("/agent-api/api/approval/decision")), "decision sent");

    const call = api.fetchJSON.mock.calls.find((c) => String(c[0]).startsWith("/agent-api/api/approval/decision"));
    const [url, init] = call as [string, RequestInit];
    expect(url).toBe("/agent-api/api/approval/decision?id=ap_9F3A1111");
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers as HeadersInit);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-Console-Write")).toBe("1");
    expect(JSON.parse(String(init.body))).toEqual({ verdict: "approve" });
    // An empty comment is dropped, not sent as "".
    expect(String(init.body)).not.toContain("comment");

    await waitFor(() => !document.querySelector("[role='dialog']"), "dialog closed");
    // Success is proven by re-reading: both surfaces asked again.
    expect(urls().filter((u) => u.startsWith("/agent-api/api/approvals"))).toHaveLength(2);
    expect(urls().filter((u) => u.startsWith("/agent-api/api/approval?id="))).toHaveLength(2);
    expect(document.querySelector("[role='dialog']")).toBeNull();
  });

  it("sends a written comment with the rejection", async () => {
    await mount(queue());
    await openTicket();
    const field = document.getElementById("apr5-comment") as HTMLInputElement;
    // React owns the value: write it through the native setter so the change
    // reaches the controlled input the same way typing would.
    const writeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      writeValue?.call(field, "先补一份数据出处");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(field.value).toBe("先补一份数据出处");
    await act(async () => {
      (buttonNamed("驳回") as HTMLButtonElement).click();
    });
    await act(async () => {
      (document.querySelector("[data-confirm]") as HTMLButtonElement).click();
    });
    await waitFor(() => urls().some((u) => u.startsWith("/agent-api/api/approval/decision")), "rejection sent");
    const call = api.fetchJSON.mock.calls.find((c) => String(c[0]).startsWith("/agent-api/api/approval/decision"));
    expect(JSON.parse(String((call as [string, RequestInit])[1].body))).toEqual({
      verdict: "reject",
      comment: "先补一份数据出处",
    });
  });

  it("a refused decision shows the sentence and trace id, and the list is not touched", async () => {
    let decisions = 0;
    await mount(async (url) => {
      if (url.startsWith("/agent-api/api/approval/decision")) {
        decisions += 1;
        throw new ApiError("not_approver", {
          status: 403,
          body: '{"code":"approval.not_approver","request_id":"wr-7791"}',
          url,
          requestId: "wr-7791",
        });
      }
      if (url.startsWith("/agent-api/api/approval?")) return DETAIL;
      return PENDING_PAGE;
    });
    const listBefore = urls().filter((u) => u.startsWith("/agent-api/api/approvals")).length;
    await openTicket();
    await act(async () => {
      (buttonNamed("批准") as HTMLButtonElement).click();
    });
    await act(async () => {
      (document.querySelector("[data-confirm]") as HTMLButtonElement).click();
    });
    await waitFor(() => decisions === 1, "decision attempted");
    expect(text()).toContain("决定没有提交");
    expect(text()).toContain("这张单据不归你审批");
    expect(text()).toContain("请求编号：wr-7791");
    expect(text()).not.toContain("403");
    // No optimistic move: the ticket still reads 待处理 and the queue was not rewritten.
    expect(text()).toContain("待处理");
    expect(urls().filter((u) => u.startsWith("/agent-api/api/approvals"))).toHaveLength(listBefore);
  });

  it("buttons are disabled while the decision is in flight", async () => {
    let releaseDecision: (value: unknown) => void = () => {};
    await mount(async (url) => {
      if (url.startsWith("/agent-api/api/approval/decision")) {
        return new Promise((resolve) => {
          releaseDecision = resolve;
        });
      }
      if (url.startsWith("/agent-api/api/approval?")) return DETAIL;
      return PENDING_PAGE;
    });
    await openTicket();
    await act(async () => {
      (buttonNamed("批准") as HTMLButtonElement).click();
    });
    await act(async () => {
      (document.querySelector("[data-confirm]") as HTMLButtonElement).click();
    });
    await waitFor(() => text().includes("正在提交…"), "in flight");
    expect(buttonNamed("批准")?.disabled).toBe(true);
    expect(buttonNamed("驳回")?.disabled).toBe(true);
    releaseDecision({ ok: true });
    await waitFor(() => !text().includes("正在提交…"), "flight over");
  });

  it("a settled ticket offers no decision at all", async () => {
    await mount(async (url) => {
      if (url.startsWith("/agent-api/api/approval?")) return { ...DETAIL, status: "consumed", remainingSeconds: 0 };
      return PENDING_PAGE;
    });
    await openTicket();
    expect(text()).toContain("已执行");
    expect(text()).toContain("不能再在这里改结论");
    expect(buttonNamed("批准")).toBeUndefined();
  });
});

describe("the ?state= repro switch (web/src/shell/fixtures.ts)", () => {
  // The live BFF answers 401 without a session, so the QA leg opens each state
  // from the URL. These must be marked: a repro is never presented as an answer.
  const forcedMount = async (state: string) => {
    api.fetchJSON.mockImplementation(queue());
    await render(`/approvals?state=${state}`, <ApprovalsPendingModulePage />);
    await waitFor(() => (document.body.textContent ?? "").includes("复现出来的状态"), `?state=${state} painted`);
  };

  it("shows each state on demand and marks it as a repro", async () => {
    await forcedMount("loading");
    expect(document.querySelector("[data-testid='apr5-forced-note']")).toBeTruthy();
    expect(document.querySelector("[data-testid='apr5-loading']")).toBeTruthy();
    expect(text()).toContain("正在读取待处理审批…");
    expect(api.fetchJSON).not.toHaveBeenCalled();

    await forcedMount("empty");
    expect(document.querySelector("[data-testid='apr5-forced-note']")).toBeTruthy();
    expect(document.querySelector("[data-testid='apr5-empty']")).toBeTruthy();
    expect(text()).toContain("现在没有需要你处理的申请");

    await forcedMount("error");
    expect(document.querySelector("[data-testid='apr5-forced-note']")).toBeTruthy();
    expect(document.querySelector("[data-testid='apr5-error']")).toBeTruthy();
    expect(document.querySelector("[data-testid='apr5-retry']")).toBeTruthy();
    expect(text()).toContain("本次请求未记录编号，可复制时间与操作路径反馈");
    expect(text()).not.toContain("未提供");

    await forcedMount("denied");
    expect(document.querySelector("[data-testid='apr5-forced-note']")).toBeTruthy();
    expect(document.querySelector("[data-testid='apr5-denied']")).toBeTruthy();
    expect(text()).toContain("暂时无法查看审批申请");
    expect(document.querySelectorAll("[data-testid^='apr5-row-']")).toHaveLength(0);
    // Denied keeps no refresh affordance: re-asking cannot change the answer.
    expect(buttonNamed("刷新")).toBeUndefined();
  });

  it("a real answer takes over as soon as the switch is off", async () => {
    await forcedMount("denied");
    await mount(queue());
    expect(document.querySelector("[data-fixture]")).toBeNull();
    expect(text()).toContain("对外发送本周报表");
  });
});

describe("paging", () => {
  it("follows the cursor the answer names, and keeps the loaded rows if the next page fails", async () => {
    let second = false;
    await mount(async (url) => {
      if (url.includes("cursor=cur_2")) {
        second = true;
        throw new ApiError("boom", { status: 502, body: "", url, requestId: "pg-502" });
      }
      return { ...PENDING_PAGE, nextCursor: "cur_2" };
    });
    expect(text()).toContain("下面还有更多");
    const more = buttonNamed("加载更多");
    expect(more).toBeTruthy();
    await act(async () => {
      (more as HTMLButtonElement).click();
    });
    await waitFor(() => second, "second page requested");
    expect(urls()).toContain("/agent-api/api/approvals?status=pending&limit=50&cursor=cur_2");
    expect(text()).toContain("后续记录没有加载成功");
    expect(text()).toContain("请求编号：pg-502");
    expect(text()).toContain("对外发送本周报表");
  });
});
