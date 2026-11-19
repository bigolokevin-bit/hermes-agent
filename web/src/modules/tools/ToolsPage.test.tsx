// @vitest-environment jsdom
// T27 — 工具与 MCP 只读列表。断言的是屏幕上的话：真实路由（`/api/` 段在内）、
// 不可用与状态未说明的连接留在表上并写灰、缺值写「—」并写明原因而不是 0；
// 四态由服务的回答驱动，403 与 404 逐字同体且上面不留行，读取失败绝不回落成
// 示例行；`?state=` 复现腿带 data-fixture 与 GAP 号且不发请求。

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import { ToolsPage } from "./ToolsPage";

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
const html = (): string => document.body.innerHTML;
const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const skeleton = (): boolean => document.querySelector(".animate-pulse") !== null;

const SERVERS = {
  servers: [
    {
      id: "srv_1a2b3c4d5e6f7081",
      name: "文档检索",
      status: "connected",
      lastCheckedAt: "2026-11-19T01:20:00Z",
    },
    {
      id: "srv_9f8e7d6c5b4a3f21",
      name: "远程仓库",
      status: "disconnected",
      reason: "远端拒绝了连接",
      lastCheckedAt: "2026-11-19T02:05:00Z",
    },
  ],
  total: 12,
};

/** Mount the pane against a given answer. */
async function mount(
  handler: (url: string) => Promise<unknown>,
  entry = "/capabilities?tab=tools",
): Promise<void> {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(handler);
  await render(entry, <ToolsPage />);
  await waitFor(() => !skeleton(), "state settled");
}

const denied = (status: number) => async (): Promise<never> => {
  throw new ApiError("denied", {
    status,
    body: '{"code":"console.forbidden"}',
    url: "/agent-api/api/mcp/servers",
    requestId: "tl-deny",
  });
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

describe("the read is the real route", () => {
  it("asks /api/mcp/servers through the BFF, /api/ segment included", async () => {
    await mount(async () => SERVERS);
    expect(urls()[0]).toBe("/agent-api/api/mcp/servers?limit=50");
    expect(document.querySelector("[data-testid='tools-page']")).toBeTruthy();
  });

  it("paints the rows the answer carried and nothing more", async () => {
    await mount(async () => SERVERS);
    expect(text()).toContain("文档检索");
    expect(text()).toContain("远程仓库");
    expect(document.querySelectorAll("[data-testid^='tools-row-'][data-status]")).toHaveLength(2);
  });
});

describe("the list keeps the bad rows visible", () => {
  it("an unavailable server stays on screen with its reason", async () => {
    await mount(async () => SERVERS);
    const row = document.querySelector("[data-testid='tools-row-1']")!;
    expect(row.getAttribute("data-status")).toBe("unavailable");
    expect(row.textContent).toContain("远端拒绝了连接");
    expect(row.textContent).toContain("不可用");
    // greyed, not hidden
    expect(row.className).toContain("opacity-60");
  });

  it("an unexplained unavailable reason reads 「—」, never a guess", async () => {
    await mount(async () => ({
      servers: [{ id: "srv_x", name: "旧连接", status: "offline" }],
    }));
    expect(text()).toContain("原因未说明");
    expect(document.querySelector("[data-testid='tools-row-0']")?.textContent).toContain("—");
    expect(text()).not.toMatch(/0 个|: 0|\bECONNREFUSED\b/);
  });

  it("a status the upstream never explains stays unknown and is never counted as working", async () => {
    await mount(async () => ({
      servers: [{ id: "srv_y", name: "日程查询", status: "probe-v2" }],
    }));
    const row = document.querySelector("[data-testid='tools-row-0']")!;
    expect(row.getAttribute("data-status")).toBe("unknown");
    expect(row.className).toContain("opacity-60");
    expect(row.textContent).toContain("上游没有说明这个连接现在的状态");
    const badge = row.lastElementChild!;
    expect(badge.textContent?.trim()).toBe("—");
    expect(badge.textContent).not.toContain("正常");
    expect(badge.textContent).not.toContain("不可用");
  });

  it("a missing check time is 「—」 with the reason, not a zero and not a blank", async () => {
    await mount(async () => ({ servers: [{ id: "srv_z", name: "无时间", status: "connected" }] }));
    expect(text()).toContain("最近检查（北京时间）");
    expect(text()).toContain("—");
    expect(text()).not.toMatch(/1970|0000|NaN/);
    const dashed = document.querySelector("[data-testid='tools-row-0'] [title='服务未提供检查时刻']");
    expect(dashed?.textContent).toBe("—");
  });

  it("shows the check time in Beijing wall clock to the minute", async () => {
    await mount(async () => SERVERS);
    expect(text()).toContain("2026-11-19 09:20");
    expect(text()).toContain("2026-11-19 10:05");
    // the wire form never reaches the screen
    expect(text()).not.toMatch(/2026-11-19T01:20|:00Z/);
  });

  it("counts against the denominator the answer declared", async () => {
    await mount(async () => SERVERS);
    expect(text()).toContain("列出 2 / 12");
    expect(text()).toContain("这一页只回了 2 条");
    expect(document.querySelectorAll("[data-testid^='tools-row-'][data-status]")).toHaveLength(2);
  });

  it("says so out loud when the answer declared no total", async () => {
    await mount(async () => ({ servers: [{ id: "a", name: "甲", status: "connected" }] }));
    expect(text()).toContain("上游未声明一共有多少连接");
    expect(text()).not.toMatch(/\/ 0\b/);
  });

  it("counts a row it could not read instead of painting it", async () => {
    await mount(async () => ({ servers: [{ id: "a", name: "甲", status: "connected" }, "读不出"] }));
    expect(document.querySelectorAll("[data-testid^='tools-row-'][data-status]")).toHaveLength(1);
    expect(text()).toContain("另有 1 条回的内容读不出是哪个连接");
  });
});

describe("engineering language stays off the human layer", () => {
  it("a raw id is reachable in the title only", async () => {
    await mount(async () => SERVERS);
    const name = document.querySelector("[data-testid='tools-row-0'] p")!;
    expect(name.getAttribute("title")).toBe("srv_1a2b3c4d5e6f7081");
    expect(text()).not.toContain("srv_1a2b3c4d5e6f7081");
    expect(text()).not.toContain("srv_9f8e7d6c5b4a3f21");
  });

  it("carries no field names, status tokens or codes on the surface", async () => {
    await mount(async () => SERVERS);
    expect(text()).not.toMatch(/lastCheckedAt|status|connected|disconnected|serverId|console\.forbidden|HTTP/);
  });

  it("the raw values are available behind 技术详情, closed by default", async () => {
    await mount(async () => SERVERS);
    const toggle = document.querySelector<HTMLButtonElement>("[data-testid='tools-row-0-details'] button")!;
    expect(text()).not.toContain("状态原值");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await act(async () => {
      toggle.click();
    });
    expect(text()).toContain("连接标识：srv_1a2b3c4d5e6f7081");
    expect(text()).toContain("状态原值：connected");
  });

  it("a reason folded away from the human layer is still reachable in 技术详情", async () => {
    await mount(async () => ({
      servers: [{ id: "srv_w", name: "归档服务", status: "unavailable", reason: '{"code":"mcp.refused"}' }],
    }));
    // the wire shape never prints on the row
    expect(text()).not.toContain("mcp.refused");
    expect(document.querySelector("[data-testid='tools-row-0']")?.textContent).toContain("原因未说明");
    const toggle = document.querySelector<HTMLButtonElement>("[data-testid='tools-row-0-details'] button")!;
    await act(async () => {
      toggle.click();
    });
    expect(text()).toContain('原因原值：{"code":"mcp.refused"}');
  });
});

describe("the four states", () => {
  it("loading is a skeleton, not an empty list", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(() => new Promise(() => {}));
    await render("/capabilities?tab=tools", <ToolsPage />);
    await waitFor(() => skeleton(), "skeleton painted");
    expect(document.querySelector("[data-testid='tools-loading']")).toBeTruthy();
    expect(document.querySelector("[data-testid='tools-list']")).toBeNull();
  });

  it("an empty answer explains itself and names the next step", async () => {
    await mount(async () => ({ servers: [], total: 0 }));
    expect(document.querySelector("[data-testid='tools-empty']")).toBeTruthy();
    expect(document.querySelector("[data-testid='tools-list']")).toBeNull();
    expect(text()).toContain("一条连接也没有");
    expect(text()).toContain("原生 MCP 管理页");
    expect(text()).toContain("不代表读取失败");
  });

  it("an answer that is not a connection list is a failure, not an empty list", async () => {
    await mount(async () => ({ status: "ok", note: "nothing to see" }));
    expect(document.querySelector("[data-testid='tools-error']")).toBeTruthy();
    expect(document.querySelector("[data-testid='tools-empty']")).toBeNull();
    expect(text()).toContain("不是一份连接清单");
  });

  it("an error speaks human words, quotes the request id, and offers a retry", async () => {
    await mount(async () => {
      throw new ApiError("boom", {
        status: 500,
        body: '{"detail":"upstream exploded"}',
        url: "/agent-api/api/mcp/servers",
        requestId: "tl-gw-fail",
      });
    });
    expect(document.querySelector("[data-testid='tools-error']")).toBeTruthy();
    expect(text()).toContain("连接清单没能加载出来");
    expect(text()).toContain("处理时出了错");
    expect(text()).toContain("请求编号：tl-gw-fail");
    expect(text()).not.toMatch(/500|upstream exploded|agent-api/);
    const copy = document.querySelector("[aria-label='复制请求编号']") as HTMLButtonElement | null;
    expect(copy).toBeTruthy();
    expect([...document.querySelectorAll("button")].some((b) => b.textContent?.includes("重试"))).toBe(true);
  });

  it("a failure with no request id says 「未提供」 and why", async () => {
    await mount(async () => {
      throw new ApiError("gone", { status: 502, body: "bad gateway", url: "/agent-api/api/mcp/servers" });
    });
    expect(document.querySelector("[data-testid='tools-error-request-id-value-absent']")).toBeTruthy();
    expect(text()).toContain("未提供");
    expect(text()).not.toContain("请求编号：");
    expect(text()).not.toMatch(/502|bad gateway|agent-api/);
  });

  it("a login gap tells the person what to do instead of showing a code", async () => {
    await mount(async () => {
      throw new ApiError("auth", {
        status: 401,
        body: '{"code":"console.unauthenticated","message":"identity check failed"}',
        url: "/agent-api/api/mcp/servers",
        requestId: "tl-auth",
      });
    });
    expect(text()).toContain("重新登录");
    expect(text()).not.toMatch(/401|console\.unauthenticated|identity check failed/);
  });

  it("a refused read falls back to no rows at all, never to sample data", async () => {
    await mount(denied(403));
    expect(document.querySelector("[data-testid='tools-list']")).toBeNull();
    expect(document.querySelectorAll("[data-testid^='tools-row-'][data-status]")).toHaveLength(0);
    expect(text()).not.toMatch(/文档检索|远程仓库|示例数据|fixture/);
    expect(html()).not.toContain("data-fixture");
  });

  it("403 and 404 draw one identical body with no rows above it", async () => {
    const once = async (status: number): Promise<string> => {
      await mount(denied(status));
      return html();
    };
    const forbidden = await once(403);
    expect(text()).toContain("暂时看不到工具与 MCP 连接");
    expect(text()).toContain("请求编号：tl-deny");
    expect(document.querySelectorAll("[data-testid^='tools-row-'][data-status]")).toHaveLength(0);
    // no echo of the wire in either body: no route, no status, no service code
    expect(forbidden).not.toMatch(/\/agent-api|api\/mcp|console\.forbidden|\b40[34]\b/);
    expect(await once(404)).toBe(forbidden);
  });

  it("the denied body names the GAP instead of guessing a route", async () => {
    await mount(denied(404));
    expect(text()).toContain("GAP-04");
    expect(text()).toContain("尚未在本控制台接通");
  });
});

describe("the repro legs the shell gives QA", () => {
  it("each forced state renders, carries data-fixture with its GAP, and asks nothing", async () => {
    api.fetchJSON.mockReset();
    const open = async (state: string): Promise<void> => {
      await render(`/capabilities?tab=tools&state=${state}`, <ToolsPage />);
      await waitFor(
        () => (document.body.textContent ?? "").includes("复现出来的状态") || state === "loading",
        `${state} painted`,
      );
    };
    for (const state of ["loading", "empty", "error", "denied"]) {
      await open(state);
      const page = document.querySelector("[data-testid='tools-page']")!;
      expect(page.getAttribute("data-fixture")).toBe(state);
      expect(text()).toContain("这是用 ?state=");
      expect(text()).toContain("GAP-04");
      expect(api.fetchJSON).not.toHaveBeenCalled();
      const retry = document.querySelector<HTMLButtonElement>("[data-testid='tools-retry']")!;
      expect(retry.disabled).toBe(true);
    }
  });

  it("a repro is never dressed up as real data", async () => {
    api.fetchJSON.mockReset();
    await render("/capabilities?tab=tools&state=ready", <ToolsPage />);
    await waitFor(() => !skeleton(), "real read settled");
    // `ready` is not reproducible: the pane asks the service instead
    expect(api.fetchJSON).toHaveBeenCalled();
    expect(html()).not.toContain("data-fixture");
  });
});
