// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-error";

const apiMocks = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: apiMocks.fetchJSON }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

async function waitFor(cond: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor: condition never became true");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

async function render(page: ReactNode): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(page);
  });
  await waitFor(() => !document.querySelector("[aria-hidden='true'] .animate-pulse"));
}

function mountWith(handler: (url: string) => Promise<unknown>): Promise<void> {
  apiMocks.fetchJSON.mockImplementation(handler);
  return import("./ApprovalsPage").then(({ default: Page }) => render(<Page />));
}

const text = (): string => document.body.textContent ?? "";
const labels = (): string[] =>
  [...document.querySelectorAll("button")].map((b) => (b.textContent ?? "").trim());

beforeEach(() => {
  apiMocks.fetchJSON.mockReset();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
});

describe("ApprovalsPage denied state", () => {
  const deniedBody = '{"detail":"nope","request_id":"apr-9c31"}';

  const denied = (status: number) =>
    mountWith(async () => {
      throw new ApiError("denied", { status, body: deniedBody, url: "/agent-api/api/approvals" });
    });

  it("renders one whole panel for 403 and carries the trace id", async () => {
    await denied(403);
    expect(text()).toContain("暂时无法查看审批申请");
    expect(text()).toContain("请求编号：apr-9c31");
    expect(document.querySelectorAll("dl")).toHaveLength(0);
    expect(labels().filter((l) => l !== "复制")).toEqual([]); // copy control allowed; no refresh on a panel that cannot load
  });

  it("does not distinguish 404 from 403", async () => {
    await denied(403);
    const forbidden = document.body.innerHTML;
    await denied(404);
    expect(document.body.innerHTML).toBe(forbidden);
  });
});

describe("ApprovalsPage rows", () => {
  it("names people where it can and masks handles where it cannot", async () => {
    await mountWith(async () => ({
      approvals: [
        {
          approvalId: "apr_1",
          title: "对外发送本周报表",
          status: "pending",
          requestedByName: "李思",
          employee: "employee:8812",
          createdAt: "2026-11-18T01:20:00Z",
          expiresAt: "2026-11-18T03:00:00Z",
          amountUsd: 25,
          reason: "需要把结果发给外部对接人",
        },
        {
          id: "apr_2",
          summary: "读取生产数据库",
          state: "denied",
          human: "human:1",
          agentName: "小析",
        },
      ],
    }));
    expect(text()).toContain("对外发送本周报表");
    expect(text()).toContain("待处理");
    expect(text()).toContain("李思"); // resolved name, printed as-is
    expect(text()).toContain("员工 · 8812");
    expect(text()).toContain("已拒绝");
    expect(text()).toContain("小析");
    expect(text()).toContain("2026-11-18 09:20"); // Beijing, from a UTC instant
    expect(text()).toContain("$25.00");
    expect(text()).toContain("需要把结果发给外部对接人");
    // Nothing that leaks a scheme handle, and no bare ISO string.
    expect(text()).not.toContain("employee:8812");
    expect(text()).not.toContain("human:1");
    expect(text()).not.toContain("2026-11-18T01:20:00Z");
    expect(text()).not.toMatch(/pending|denied|undefined|NaN/);
    // A handle too short to mask honestly reads as unassigned, not as garbage.
    expect(text()).toContain("未指派");
    expect(text()).toContain("其中 1 条待处理");
  });

  it("relabels the deadline once the request is settled", async () => {
    await mountWith(async () => ({
      items: [{ id: "a", title: "已完成的申请", status: "approved", expiresAt: "2026-11-20T00:00:00Z" }],
    }));
    expect(text()).toContain("原定期限");
    expect(text()).not.toContain("处理期限");
  });

  it("shows 「—」 for values the service omitted, and a real zero as zero", async () => {
    await mountWith(async () => ({
      items: [
        { id: "a1", title: "没有金额的申请", status: "pending" },
        { id: "a2", title: "零金额的申请", status: "pending", amount: 0 },
      ],
    }));
    expect(text()).toContain("$0.00"); // the real zero
    expect((text().match(/—/g) ?? []).length).toBeGreaterThan(0); // the missing ones
    expect(text()).toContain("已显示 2 条审批申请");
  });

  it("explains an empty queue and offers the next step", async () => {
    await mountWith(async () => ({ items: [] }));
    expect(text()).toContain("当前没有审批申请");
    expect(text()).toContain("提出后立刻出现在这里");
    expect(labels()).toContain("刷新");
  });

  it("surfaces a plain sentence and a retry for a server failure", async () => {
    await mountWith(async () => {
      throw new ApiError("boom", { status: 503, body: '{"detail":"下游未就绪"}', url: "/x" });
    });
    expect(text()).toContain("审批申请没能加载出来");
    expect(text()).toContain("服务在处理时出了错");
    expect(text()).not.toMatch(/\b503\b/);
    expect(labels()).toContain("重试");
  });

  it("设计车道 ①: 401 不再自绘登录失效卡，只回落通用错误（那句话归全站横幅）", async () => {
    await mountWith(async () => {
      throw new ApiError("unauthenticated", { status: 401, body: "", url: "/x", requestId: "apr-401" });
    });
    expect(text()).not.toContain("登录状态已失效");
    expect(text()).not.toContain("需要登录");
    expect(document.querySelector('[data-testid="auth-reload-exit"]')).toBeNull();
    expect(text()).toContain("审批申请没能加载出来");
    expect(text()).toContain("请求编号：apr-401");
    expect(labels()).toContain("重试");
  });
});
