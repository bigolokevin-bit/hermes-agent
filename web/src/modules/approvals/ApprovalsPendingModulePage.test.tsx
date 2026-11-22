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
import { CsrfMissingError, postDecision } from "@/modules/approvals/api";
import { rawCorrelationReturn, saveCorrelationReturn } from "@/modules/approvals/correlationReturn";

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

/** P0-③: 筛选控件默认收起。行为契约＝「默认折叠，展开后全部可达」，所以
 *  碰面板里的控件（搜索/审批人/时间/风险/status 口径句）前要先点开；
 *  折叠态本就常显的读数（汇总条、chips、重置钮）不需要展开。 */
const openFilters = async (): Promise<void> => {
  const toggle = document.querySelector('[data-testid="apv-filter-toggle"]') as HTMLButtonElement | null;
  expect(toggle, "filter disclosure present").toBeTruthy();
  if (toggle!.getAttribute("aria-expanded") === "true") return;
  await act(async () => {
    toggle!.click();
  });
  await waitFor(() => toggle!.getAttribute("aria-expanded") === "true", "filter panel opened");
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
    // R76: 提交时间的绝对到秒在 title。
    expect(document.querySelector("[data-testid='apv-time-row-submitted-ap_9F3A1111']")?.getAttribute("title") ?? "").toContain("2026-11-19 09:20:00");
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
    // 文件名预览常驻（R75 apv-export-name），BJT HHmm 可能撞 503 字样——先剥文件名再断，语义不变（L461 同款）
    expect(text().replace(/-\d{8}-\d{4}\.csv/g, "")).not.toContain("503");
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
    // R75：导出文件名契约本就要求 tab/status 段——裸 token 不泄漏断言限定在
    // 文件名以外的界面文本。
    const nameEl = document.querySelector('[data-testid="apv-export-name"]')?.textContent ?? "";
    expect(text().replace(nameEl, "")).not.toContain("pending");
    expect(text()).not.toContain("message_send");

    // R100：页级新增「复制预览详情」钮——短文案查找改精确匹配，防抢占。
    const disclosure = Array.from(document.querySelectorAll("button")).find(
      (b) => (b.textContent ?? "").trim() === "详情",
    );
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
    const opener = document.querySelector("[data-testid='apr5-row-ap_9F3A1111'] button:not([data-testid^='apv9'])") as HTMLButtonElement;
    await act(async () => {
      opener.click();
    });
    await waitFor(() => urls().some((u) => u.startsWith("/agent-api/api/approval?")), "detail requested");
  };

  it("opens the ticket through the detail route", async () => {
    // P1-A2 ① — 同源读数：详情带上可读的 deadline（此刻起约 67 分钟后），同时
    // 服务端 ttl 快照故意给成 1 天。「剩…」必须由 deadline 现场推导，不回吐快照。
    await mount(async (url) => {
      if (url.startsWith("/agent-api/api/approval?")) {
        return { ...DETAIL, remainingSeconds: 99999, expiresAt: new Date(Date.now() + 4050 * 1000).toISOString() };
      }
      return queue()(url);
    });
    await openTicket();
    expect(urls()).toContain("/agent-api/api/approval?id=ap_9F3A1111");
    expect(text()).toContain("高风险");
    expect(text()).toContain("对外发送消息");
    expect(text()).toMatch(/剩 1 小时/);
    expect(text()).not.toContain("th_0123456789abcdef");
  });

  // P0-1r（2026-11-21）：L0 对终态单 ap_AEEC078E0C824E749513AFEC9A 实测
  // POST /agent-api/api/approval/decision → HTTP 405 console.read_only，写路径
  // 在此部署根本不存在。产品侧据此把批准/驳回/apr5-comment 恒禁用（三属性同源）
  // 并上人话说明段，口径对齐 runs 页 run5-retry-new（RunsModulePage.tsx
  // L1532-1547）。原先四案「点钮→弹窗→data-confirm→断请求」依赖的 UI 提交路径
  // 已按门控封死：门控契约在本文件首案验收「点击不产生任何请求」；请求形状契约
  // （POST/三头/body）改由 postDecision 数据层直测承接，不再经 UI 弹窗。
  it("decision actions are gated readonly: three attributes in sync, plain sentence on screen, click sends nothing", async () => {
    await mount(queue());
    await openTicket();
    const approve = buttonNamed("批准");
    const reject = buttonNamed("驳回");
    expect(approve).toBeTruthy();
    expect(reject).toBeTruthy();
    const comment = document.getElementById("apr5-comment") as HTMLInputElement | null;
    expect(comment?.disabled).toBe(true);
    expect(approve!.disabled).toBe(true);
    expect(approve!.getAttribute("aria-disabled")).toBe("true");
    expect(reject!.disabled).toBe(true);
    expect(reject!.getAttribute("aria-disabled")).toBe("true");
    // 三属性同源：title 与人话说明段是同一句话的两个出口。
    const note = document.querySelector("[data-testid='apr5-actions-readonly-note']") as HTMLElement | null;
    expect(note?.textContent).toContain("控制台是只读的");
    expect(note?.textContent).toContain("请走它原本产生决定的渠道");
    for (const el of [approve!, reject!, comment!]) {
      const title = el.getAttribute("title") ?? "";
      expect(title).toContain("这个环境的控制台只读");
      expect(title).toContain("点它不会发起任何请求");
    }
    // 不得裸显内部 code 与状态码。
    const spoken = text() + (approve!.getAttribute("title") ?? "");
    expect(spoken).not.toContain("console.read_only");
    expect(spoken).not.toContain("X-Console-CSRF");
    expect(spoken).not.toContain("405");
    // jsdom 不会像真浏览器那样拦截 disabled 钮的 click 派发——
    // 浏览器原生拦截 + 门控恒真（disabled={inFlight || DECISION_GATE.disabled}）
    // 共同保证：即便事件被强行派发，也不出弹窗、更不出决定请求。
    const before = urls().length;
    await act(async () => {
      approve!.click();
    });
    await act(async () => {
      reject!.click();
    });
    expect(document.querySelector("[role='dialog']")).toBeNull();
    expect(urls().filter((u) => u.startsWith("/agent-api/api/approval/decision"))).toHaveLength(0);
    expect(urls().length).toBe(before);
  });

  it("postDecision still shapes the write exactly as the BFF demands (kept for the day the gate opens)", async () => {
    document.cookie = "console_csrf=tok_p01r";
    api.fetchJSON.mockImplementation(async () => ({ ok: true }));
    await postDecision("ap_9F3A1111", "reject", "  先补一份数据出处  ");
    const call = api.fetchJSON.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe("/agent-api/api/approval/decision?id=ap_9F3A1111");
    expect(call[1].method).toBe("POST");
    const headers = new Headers(call[1].headers as HeadersInit);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-Console-Write")).toBe("1");
    expect(headers.get("X-Console-CSRF")).toBe("tok_p01r");
    expect(JSON.parse(String(call[1].body))).toEqual({ verdict: "reject", comment: "先补一份数据出处" });
    api.fetchJSON.mockClear();
    await postDecision("ap_9F3A1111", "approve", "   ");
    const second = api.fetchJSON.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(second[1].body))).toEqual({ verdict: "approve" });
    // 空 comment 省略，不是 ""。
    expect(String(second[1].body)).not.toContain("comment");
    // 撤销会话 cookie：应诚实拒发，不再产生任何决定请求。
    document.cookie = "console_csrf=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0";
    api.fetchJSON.mockClear();
    // 没有会话 cookie 就诚实拒发（api.test.ts 的 node 腿只测了拒发本身，
    // 这里补 jsdom 下「cookie 存在才发、撤销后不再发」的成对腿）。
    await expect(postDecision("ap_9F3A1111", "approve")).rejects.toBeInstanceOf(CsrfMissingError);
    expect(api.fetchJSON.mock.calls.filter((c) => String(c[0]).startsWith("/agent-api/api/approval/decision"))).toHaveLength(0);
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

describe("R59 pending queue search (apv8-*)", () => {
  it("carries the same local search box with a stated scope and no extra fetches", async () => {
    await mount(queue(), "/approvals?tab=pending");
    await openFilters();
    expect(document.querySelector('[data-testid="apv8-search"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="apv8-scope-note"]')?.textContent).toContain("条内搜索");
    const box = document.querySelector('[data-testid="apv8-search"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    const before = api.fetchJSON.mock.calls.length;
    await act(async () => {
      setter.call(box, "本周");
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(api.fetchJSON.mock.calls.length).toBe(before);
    expect(document.querySelectorAll('[data-testid^="apr5-row-ap"]').length).toBeGreaterThan(0);
    await act(async () => {
      setter.call(box, "nomatch-xyz");
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(api.fetchJSON.mock.calls.length).toBe(before);
    expect(document.querySelector('[data-testid="apv8-search-empty"]')?.textContent).toContain("没有匹配的审批");
    const urls = api.fetchJSON.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("q=nomatch"))).toBe(false); // 关键字从不进请求
  });

  // R60: 行内预览与历史页同构——展开只读已加载行，不发请求、不改 URL。
  it("R60: pending rows expand an inline preview without any extra request", async () => {
    await mount(queue());
    const calls = api.fetchJSON.mock.calls.length;
    const toggle = document.querySelector<HTMLButtonElement>('[data-testid^="apv9-toggle-"][data-record="ap_9F3A1111"]');
    expect(toggle).toBeTruthy();
    await act(async () => {
      toggle.click();
    });
    expect(api.fetchJSON.mock.calls.length).toBe(calls);
    const preview = document.querySelector('[data-testid="apv9-preview-ap_9F3A1111"]');
    expect(preview?.textContent).toContain("对外发送本周报表");
    expect(preview?.textContent).not.toContain("human:");
    expect(preview?.textContent).not.toContain("emp_");
  });

})

describe("R61 trail copy on the pending drawer", () => {
  it("mounts apd8-copy in the shared trail without touching data", async () => {
    await mount(queue());
    const before = api.fetchJSON.mock.calls.length;
    const card = document.querySelector("[data-testid='apr5-row-ap_9F3A1111']") as HTMLElement | null;
    expect(card, "row card").toBeTruthy();
    await act(async () => {
      card!.click();
    });
    await waitFor(() => document.querySelector("[data-testid='apd6-trail']") !== null, "trail mounted");
    expect(document.querySelector("[data-testid='apd8-copy']")).toBeTruthy();
    expect(document.querySelector("[data-testid='apd8-copy-status']")).toBeTruthy();
    expect(api.fetchJSON.mock.calls.length).toBeGreaterThanOrEqual(before);
  });
});

describe("R70 pending queue state consistency (apv-state-*)", () => {
  const qa = (id: string) => document.querySelector(`[data-testid="${id}"]`);

  it("true empty reads as a queue with nothing pending, without a fake clear exit", async () => {
    await mount(
      async (url: string) => {
        if (String(url).includes("/api/approval?id=")) return Promise.resolve({});
        return { items: [] };
      },
      "/approvals?tab=pending",
    );
    await waitFor(() => !!qa("apv-state-empty"), "empty panel");
    expect(qa("apv-state")?.getAttribute("data-phase")).toBe("empty");
    expect(qa("apv-state-empty-text")?.textContent).toContain("现在没有需要你处理的申请");
    expect(qa("apv-state-clear"), "no server filter on this pane").toBeNull();
    expect(qa("apv6-summary-pending")?.textContent, "summary never fakes 0").toContain("—");
    const btn = qa("apv7-export") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.title).toContain("真实空集");
  });

  it("error gates export and offers a copyable rid with retry", async () => {
    await mount(
      async (url: string) => {
        if (String(url).includes("/api/approval?id=")) return Promise.resolve({});
        throw new ApiError("boom", { status: 500, body: "", url: "/agent-api/api/approvals", requestId: "req-r70-p500" });
      },
      "/approvals?tab=pending",
    );
    await waitFor(() => !!qa("apv-state-error"), "error panel");
    expect(qa("apv-state-rid")?.textContent).toContain("req-r70-p500");
    expect(qa("apv-state-retry")).toBeTruthy();
    expect((qa("apv7-export") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("R71 pending column sorting", () => {
  it("gates on phase and sorts loaded rows without any refetch", async () => {
    await mount(queue(), "/approvals?tab=pending");
    await waitFor(() => !!document.querySelector('[data-testid^="apr5-row-ap"]'), "queue rows");
    const btn = document.querySelector('[data-testid="apv-sort-title"]') as HTMLButtonElement | null;
    expect(btn, "sort bar on pending too").toBeTruthy();
    expect(btn!.disabled, "ready pane enables sorting").toBe(false);
    const before = api.fetchJSON.mock.calls.length;
    await act(async () => {
      btn!.click();
    });
    await act(async () => {});
    expect(btn.getAttribute("aria-sort")).toBe("ascending");
    expect(api.fetchJSON.mock.calls.length, "sorting never fetches").toBe(before);
    // P1-A1: 元说明三行已移入筛选折叠面板——先展开再断言（口径断言原样保留）。
    await openFilters();
    expect(document.querySelector('[data-testid="apv-sort-scope-note"]')?.textContent).toContain("条内排序");
  });
});

describe("R73 pending keyboard navigation (apv-nav-*)", () => {
  const qa = (id: string) => document.querySelector(`[data-testid="${id}"]`);

  it("rows rove and Enter opens the preview without fetching", async () => {
    await mount(queue(), "/approvals?tab=pending");
    const row = qa("apr5-row-ap_9F3A1111");
    expect(row, "queue row present").toBeTruthy();
    expect(row!.getAttribute("tabindex"), "single tabbable row").toBe("0");
    const before = api.fetchJSON.mock.calls.length;
    (row as HTMLElement).focus();
    await act(async () => {
      row!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    });
    expect(qa("apv9-preview-ap_9F3A1111"), "Enter opens the inline preview").toBeTruthy();
    expect(row!.getAttribute("aria-expanded")).toBe("true");
    await act(async () => {
      row!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    expect(qa("apv9-preview-ap_9F3A1111"), "Esc closes").toBeNull();
    expect(document.activeElement).toBe(row);
    expect(api.fetchJSON.mock.calls.length, "no keyboard-triggered requests").toBe(before);
    // P1-A1: nav note 现居筛选折叠面板内——展开后再断其在场；键盘断言不受影响
    // （本行钮点开面板不产生任何请求，above 已证零增量取数）。
    await openFilters();
    expect(qa("apv-nav-note"), "nav note present").toBeTruthy();
  });
});

describe("R74 pending actor buckets (apv-actor-*)", () => {
  const qa = (id: string) => document.querySelector(`[data-testid="${id}"]`);

  it("the pending tab carries the same rail: local filter, zero new requests", async () => {
    await mount(queue(), "/approvals?tab=pending");
    await openFilters();
    await waitFor(() => !!qa("apv-actor-buckets"), "rail");
    expect(qa("apv-actor-scope-note")?.textContent).toContain("不是全量");
    const before = api.fetchJSON.mock.calls.length;
    const bucket = document.querySelector('[data-testid="apv-actor-bucket-0"]') as HTMLButtonElement | null;
    if (bucket) {
      await act(async () => {
        bucket.click();
      });
      expect(api.fetchJSON.mock.calls.length, "bucket click never refetches").toBe(before);
      await act(async () => {
        (qa("apv-actor-all") as HTMLButtonElement).click();
      });
      expect(api.fetchJSON.mock.calls.length, "clearing never refetches").toBe(before);
      await waitFor(() => !!qa("apr5-row-ap_9F3A1111"), "row back");
    }
    expect(document.body.textContent).not.toContain("human:");
  });
});

describe("R77 pending time range (apv-since-*)", () => {
  const qa = (id: string) => document.querySelector(`[data-testid="${id}"]`);

  it("the pending tab carries the same rail with zero new requests", async () => {
    await mount(queue(), "/approvals?tab=pending");
    await openFilters();
    await waitFor(() => !!qa("apv-since-rail"), "rail");
    const before = api.fetchJSON.mock.calls.length;
    await act(async () => {
      (qa("apv-since-24h") as HTMLButtonElement).click();
    });
    expect(api.fetchJSON.mock.calls.length, "chip never refetches").toBe(before);
    await act(async () => {
      (qa("apv-since-all") as HTMLButtonElement).click();
    });
    expect(api.fetchJSON.mock.calls.length, "clearing never refetches").toBe(before);
    expect(qa("apv-since-scope-note")?.textContent).toContain("不是全量");
  });
});

describe("R79 pending pagination rail (apv-page-*)", () => {
  const qa = (id: string) => document.querySelector(`[data-testid="${id}"]`);

  it("the pending tab shows the same rail: no-total sentence, end state disabled", async () => {
    await mount(queue(), "/approvals?tab=pending");
    await waitFor(() => !!qa("apv-page"), "rail");
    // P1-A2 ② — 改判：无 total 且已到末页时只出一句「已到末页 · 已显示 N 条」，
    // 「总数不可用」与「已到末页」不再并存；end chip 在此腿退出。
    expect(qa("apv-page-count")?.textContent, "末页单句，不并存").toBe("已到末页 · 已显示 1 条");
    const more = qa("apv-page-more") as HTMLButtonElement;
    expect(more.disabled, "queue fits one page — no cursor").toBe(true);
    expect(more.getAttribute("title")).toContain("已到末页");
    expect(qa("apv-page-end"), "end chip retired when total unavailable").toBeNull();
  });
});

describe("R83 pending risk rail (apv-risk-*)", () => {
  const qa = (id: string) => document.querySelector(`[data-testid="${id}"]`);

  it("the pending tab carries the same rail with zero new requests", async () => {
    await mount(queue(), "/approvals?tab=pending");
    await openFilters();
    await waitFor(() => !!qa("apv-risk-rail"), "rail");
    const before = api.fetchJSON.mock.calls.length;
    await act(async () => {
      (qa("apv-risk-high") as HTMLButtonElement).click();
    });
    expect(api.fetchJSON.mock.calls.length, "chip never refetches").toBe(before);
    await act(async () => {
      (qa("apv-risk-all") as HTMLButtonElement).click();
    });
    expect(api.fetchJSON.mock.calls.length, "clearing never refetches").toBe(before);
    expect(qa("apv-risk-scope-note")?.textContent).toContain("不是全量");
  });
});

describe("R88 pending permalink (apd10-*)", () => {
  const qa = (id: string) => document.querySelector(`[data-testid="${id}"]`);

  it("the pending tab copies a tab-preserving permalink for the opened ticket", async () => {
    await mount(queue(), "/approvals?tab=pending");
    await waitFor(() => !!qa("apr5-row-ap_9F3A1111"), "row");
    await act(async () => {
      qa("apr5-row-ap_9F3A1111")!.click();
    });
    await waitFor(() => !!qa("apd10-permalink"), "button");
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (t: string) => {
          written.push(t);
        },
      },
    });
    const before = api.fetchJSON.mock.calls.length;
    await act(async () => {
      (qa("apd10-permalink") as HTMLButtonElement).click();
    });
    await act(async () => {});
    expect(written[0]).toBe("/approvals?tab=pending&id=ap_9F3A1111");
    expect(qa("apd10-status")?.textContent).toContain("链接已复制");
    expect(api.fetchJSON.mock.calls.length, "copy never fetches").toBe(before);
  });
});

describe("R90 pending filter reset (apv-reset-filters)", () => {
  const qa = (id: string) => document.querySelector(`[data-testid="${id}"]`);

  it("clearing local-only params never refetches on the pending queue", async () => {
    await mount(queue(), "/approvals?tab=pending&risk=high&q=zz");
    const btn = qa("apv-reset-filters") as HTMLButtonElement | null;
    expect(btn, "reset button present").toBeTruthy();
    expect(btn!.disabled, "two active filters").toBe(false);
    expect(btn!.title).toContain("一次清除 2 项筛选");
    const before = api.fetchJSON.mock.calls.length;
    await act(async () => {
      btn!.click();
    });
    await act(async () => {});
    expect(api.fetchJSON.mock.calls.length, "local params never hit the server").toBe(before);
    expect((qa("apv-reset-filters") as HTMLButtonElement).disabled, "reset after reset").toBe(true);
    expect(qa("apv-reset-filters")?.getAttribute("title")).toBe("当前没有可清除的筛选条件");
  });
});

describe("R91 pending filter chips (apv-chip-*)", () => {
  const qa = (id: string) => document.querySelector(`[data-testid="${id}"]`);

  it("removing the search chip on the pending queue never refetches", async () => {
    await mount(queue(), "/approvals?tab=pending&q=9F3A");
    expect(qa("apv-chip-q")?.textContent).toContain("搜索：9F3A");
    const before = api.fetchJSON.mock.calls.length;
    await act(async () => {
      (qa("apv-chip-remove-q") as HTMLButtonElement).click();
    });
    await act(async () => {});
    expect(api.fetchJSON.mock.calls.length, "q is local on the queue too").toBe(before);
    expect(qa("apv-filter-summary")).toBeNull();
  });
});

describe("P0-③ filter disclosure (apv-filter-toggle)", () => {
  const qa = (id: string) => document.querySelector(`[data-testid="${id}"]`);

  it("stays collapsed by default while the active-condition summary keeps reading the URL", async () => {
    await mount(queue(), "/approvals?tab=pending&risk=high");
    expect(qa("apv-filter-toggle")?.getAttribute("aria-expanded"), "collapsed by default").toBe("false");
    expect(qa("apv-filter-summary")?.textContent, "折叠态的生效条件读数").toContain("风险：高风险");
  });

  it("keeps the empty face and the reset door visible while the panel stays collapsed", async () => {
    await mount(queue(), "/approvals?tab=pending&q=nomatch-xyz");
    expect(qa("apv-filter-toggle")?.getAttribute("aria-expanded"), "collapsed by default").toBe("false");
    expect(qa("apv-filter-panel"), "panel unmounted while collapsed").toBeNull();
    expect(qa("apv-summary-row"), "汇总条常显").toBeTruthy();
    const btn = qa("apv-reset-filters") as HTMLButtonElement | null;
    expect(btn, "清空/重置入口在折叠态可见").toBeTruthy();
    expect(btn!.disabled, "一个生效筛选").toBe(false);
    expect(qa("apv-filter-summary")?.textContent).toContain("搜索：nomatch-xyz");
    await waitFor(() => !!qa("apv8-search-empty"), "折叠态的关键字空态可见");
    expect(qa("apv8-search-empty")?.textContent).toContain("没有匹配的审批");
  });

  it("shows the risk-band empty sentence without opening the panel", async () => {
    await mount(queue(), "/approvals?tab=pending&risk=high");
    expect(qa("apv-filter-panel"), "panel unmounted while collapsed").toBeNull();
    await waitFor(() => !!qa("apv-risk-empty"), "折叠态的风险档空态可见");
    expect(qa("apv-risk-empty")?.textContent).toContain("该风险档下没有审批。");
  });
});

describe("R94 pending correlation return", () => {
  const qa = (id: string) => document.querySelector(`[data-testid="${id}"]`);

  it("the pending tab restores its own snapshot on a bare re-entry", async () => {
    sessionStorage.clear();
    saveCorrelationReturn("?tab=pending&q=本周&id=ap_9F3A1111", 321);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 321 });
    const scrolled = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    await mount(queue(), "/approvals?tab=pending");
    await waitFor(() => !!qa("apd5-detail"), "detail reopened");
    await openFilters();
    expect(qa("apv8-search")?.getAttribute("value")).toBe("本周");
    expect(scrolled.mock.calls.some((c) => c[1] === 321)).toBe(true);
    expect(rawCorrelationReturn()).toBeNull();
  });
});

describe("R93 pending tab status semantics (apv-status-note)", () => {
  const qa = (id: string) => document.querySelector(`[data-testid="${id}"]`);

  it("a pasted ?status= is dropped from the address and the note explains where it applies", async () => {
    await mount(queue(), "/approvals?tab=pending&status=expired");
    await openFilters();
    await waitFor(() => !!qa("apv-status-note"), "note");
    expect(qa("apv-status-note")?.textContent).toContain("待办视图只列待办");
    expect(qa("apv-status-note")?.getAttribute("title")).toContain("pending");
    // chip 投影：status 参已从地址移除后不再渲染「状态」chip（列表本就没按它过滤）
    await waitFor(() => !qa("apv-chip-status"), "status chip gone");
    const listUrls = api.fetchJSON.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/api/approvals"));
    expect(listUrls.length, "dropping the dead param never refetches the queue").toBe(1);
    expect(listUrls[0]).toContain("status=pending");
    expect(listUrls[0]).not.toContain("status=expired");
  });

  it("a clean pending entry keeps the note and touches nothing extra", async () => {
    await mount(queue(), "/approvals?tab=pending");
    await openFilters();
    await waitFor(() => !!qa("apv-status-note"), "note resident");
    expect(qa("apv-chip-status")).toBeNull();
    const listUrls = api.fetchJSON.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/api/approvals"));
    expect(listUrls.length).toBe(1);
  });
});

describe("R100 row detail copy (apd11-*)", () => {
  const P100_TEXT = [
    "标题：对外发送本周报表",
    "状态：待处理",
    "风险档：未标注风险",
    "提交时间：绝对 2026-11-19 09:20:00（北京时间） · ISO 2026-11-19T01:20:00Z",
    "更新时间：该字段未返回",
    "审批人：该字段未返回",
    "请求编号：该字段未返回",
  ].join("\n");

  it("R100: pending mirrors the gate collapsed, then copies the loaded row with zero requests", async () => {
    await mount(queue());
    const btn = document.querySelector('[data-testid="apd11-copy"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("title")).toBe("先展开一行审批再复制");
    const base = api.fetchJSON.mock.calls.length;
    const toggle = document.querySelector(
      '[data-testid^="apv9-toggle-"][data-record="ap_9F3A1111"]',
    ) as HTMLButtonElement;
    await act(async () => {
      toggle.click();
    });
    expect(btn.disabled).toBe(false);
    const writeText = vi.fn(async () => {});
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    await act(async () => {
      btn.click();
    });
    expect(writeText.mock.calls[0]?.[0]).toBe(P100_TEXT);
    await waitFor(
      () => (document.querySelector('[data-testid="apd11-copy-status"]')?.textContent ?? "") === "已复制",
    );
    expect(api.fetchJSON.mock.calls.length).toBe(base);
  });
});
