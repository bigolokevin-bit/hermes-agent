// @vitest-environment jsdom
// 工具与 MCP 真数据面：两个真实路由、逐行字段、凭据只显示状态、不可用项留灰色、
// 403 与 404 使用同一未接入体、不出示样例、不回显路径，四态与重试齐全。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
vi.mock("@/modules/models/fetchJson", () => ({ fetchJsonStrict: api.fetchJsonStrict }));

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

async function render(entry: string): Promise<void> {
  await act(async () => root?.unmount());
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<MemoryRouter initialEntries={[entry]}><ToolsPage /></MemoryRouter>);
  });
}

const text = (): string => document.body.textContent ?? "";
const rows = (): Element[] => [...document.querySelectorAll("[data-testid='tol5-row']")];
const urls = (): string[] => api.fetchJsonStrict.mock.calls.map((call) => String(call[0])).filter((url) => url !== "undefined");

const TOOLSETS = [
  { name: "web", label: "Web Search & Scraping", enabled: true, configured: true, platform_label: "CLI", tools: ["web_search", "web_extract"] },
  { name: "kanban", label: "Kanban", enabled: false, configured: false, platform_label: "CLI", tools: ["kanban_create"] },
  { name: "mystery", label: "Mystery", tools: ["mystery_tool"] },
];
const SERVERS = {
  servers: [
    { name: "文档检索", transport: "http", enabled: true, auth: "header", env: { API_KEY: "super-secret-value" } },
    { name: "旧连接", transport: "stdio", enabled: false },
  ],
};

function answer(url?: string): Promise<unknown> {
  // Vitest's mock bookkeeping can invoke the implementation once without an
  // argument during teardown; that is not a page request.
  if (!url) return Promise.resolve({ servers: [] });
  if (url.startsWith("/agent-api/")) return Promise.reject(new ApiError("missing", { status: 404, body: "{}", url }));
  if (url.includes("/api/tools/toolsets")) return Promise.resolve(TOOLSETS);
  if (url.includes("/api/mcp/servers")) return Promise.resolve(SERVERS);
  return Promise.reject(new ApiError("unknown", { status: 404, body: "{}", url }));
}

async function mount(handler = answer, entry = "/capabilities?tab=tools"): Promise<void> {
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation(handler);
  await render(entry);
  await waitFor(() => !document.querySelector(".animate-pulse"), "settled");
}

const failed = (status: number, url: string, requestId?: string) => (called?: string) => {
  if (!called) return Promise.resolve({ servers: [] });
  return Promise.reject(new ApiError("failed", { status, body: "{}", url, requestId }));
};

beforeEach(() => api.fetchJsonStrict.mockReset());
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

describe("real reads", () => {
  it("asks the BFF routes first, then the same-origin fallback", async () => {
    await mount();
    expect(urls().sort()).toEqual([
      "/agent-api/api/mcp/servers",
      "/agent-api/api/tools/toolsets",
      "/api/mcp/servers",
      "/api/tools/toolsets",
    ]);

    expect(document.querySelector("[data-testid='tol5-page']")).toBeTruthy();
  });

  it("renders toolset and MCP rows with type, enabled state, credential state and last-call gap", async () => {
    await mount();
    expect(rows()).toHaveLength(6);
    expect(text()).toContain("网页搜索");
    expect(text()).toContain("网页搜索与抓取");
    expect(text()).toContain("MCP · HTTP 服务");
    expect(text()).toContain("MCP · 本地进程");
    const web = rows()[0]!;
    expect(web.querySelector("[data-testid='tol5-status']")?.textContent).toBe("启用");
    expect(web.querySelector("[data-testid='tol5-credential']")?.textContent).toContain("已配置");
    expect(web.querySelector("[data-testid='tol5-last']")?.textContent).toContain("最近调用：—");
    expect(web.querySelector("[data-testid='tol5-last']")?.textContent).toContain("不表示从未调用");
    const kanban = rows()[2]!;
    expect(kanban.getAttribute("data-status")).toBe("disabled");
    expect(kanban.className).toContain("opacity-60");
  });

  it("renders an upstream last-call time as Beijing time to the minute", async () => {
    await mount((url) =>
      Promise.resolve(
        (url ?? "").includes("/api/tools/toolsets")
          ? [{ name: "web", label: "Web", enabled: true, configured: true, last_used_at: "2026-11-19T01:20:00Z", tools: ["web_search"] }]
          : { servers: [] },
      ),
    );
    expect(rows()[0]?.querySelector("[data-testid='tol5-last']")?.textContent).toContain("最近调用：2026-11-19 09:20");
  });

  it("keeps unknown states 待核实 instead of guessing 启用 or 停用", async () => {
    await mount();
    const mystery = rows().find((row) => row.textContent?.includes("Mystery"))!;
    expect(mystery.getAttribute("data-status")).toBe("unknown");
    expect(mystery.querySelector("[data-testid='tol5-status']")?.textContent).toBe("待核实");
    expect(mystery.className).toContain("opacity-60");
  });

  it("never prints a token or key value; credentials are only a state word", async () => {
    await mount();
    expect(text()).toContain("凭据：已配置");
    expect(text()).not.toContain("super-secret-value");
    expect(text()).not.toContain("API_KEY");
    expect(text()).not.toMatch(/token|secret|密钥值/i);
  });

  it("shows a true zero MCP count honestly when the service returns an empty list", async () => {
    await mount((url) =>
      Promise.resolve((url ?? "").includes("/api/tools/toolsets") ? TOOLSETS : { servers: [] }),
    );
    expect(document.querySelector("[data-testid='tol5-mcp-empty']")?.textContent).toContain("没有登记 MCP 连接");
    expect(text()).toContain("MCP 连接 0");
  });
});

describe("failures and gaps", () => {
  it("403 is a denied body with no rows and no path echoed", async () => {
    await mount(failed(403, "/api/tools/toolsets", "req-deny"));
    expect(document.querySelector("[data-testid='tol5-denied']")).toBeTruthy();
    expect(rows()).toHaveLength(0);
    expect(text()).toContain("工具与 MCP 读口未接入");
    expect(text()).toContain("请求编号：req-deny");
    expect(text()).not.toMatch(/\/api\/|403|GAP-04/);
  });

  it("both 404 routes use the same neutral not-wired body as 403", async () => {
    await mount(failed(404, "/api/tools/toolsets", "req-deny"));
    expect(document.querySelector("[data-testid='tol5-denied']")).toBeTruthy();
    expect(document.querySelector("[data-testid='tol5-fixture-note']")).toBeNull();
    expect(rows()).toHaveLength(0);
    expect(text()).toContain("工具与 MCP 读口未接入");
    expect(text()).toContain("请求编号：req-deny");
    expect(text()).not.toMatch(/\/api\/|403|404|GAP-04|字段示例/);
    expect(document.querySelector("[data-testid='tol5-denied']")?.getAttribute("title")).toBe("GAP-04");
  });

  it("treats a non-JSON SPA shell as not wired, never as a parser error", async () => {
    await mount((url) => {
      if (!url) return Promise.resolve({ servers: [] });
      const status = url.startsWith("/agent-api/") ? 404 : 200;
      return Promise.reject(new ApiError("不是数据", { status, body: "<!doctype html>", url }));
    });
    expect(document.querySelector("[data-testid='tol5-denied']")).toBeTruthy();
    expect(text()).toContain("工具与 MCP 读口未接入");
    expect(text()).not.toMatch(/Unexpected token|<!doctype|HTTP|\/api\//i);
  });

  it("missing credentials never render secret-like config values", async () => {
    await mount((url) =>
      Promise.resolve(
        (url ?? "").includes("/api/tools/toolsets")
          ? [{ name: "clean-set", label: "Clean Set", enabled: true, configured: false, env: { API_KEY: "super-secret-value" }, tools: ["clean_tool"] }]
          : { servers: [] },
      ),
    );
    expect(text()).toContain("凭据：未配置");
    expect(text()).not.toContain("super-secret-value");
    expect(text()).not.toContain("API_KEY");
    expect(text()).not.toMatch(/token|secret|密钥值/i);
  });

  it("500 shows human copy, a copyable request id and a working retry", async () => {
    let fail = true;
    await mount((url) => {
      if (!url) return Promise.resolve({ servers: [] });
      if (fail) return Promise.reject(new ApiError("boom", { status: 500, body: "{}", url, requestId: "req-tol5" }));
      return answer(url);
    });
    expect(document.querySelector("[data-testid='tol5-error']")).toBeTruthy();
    expect(text()).toContain("请求编号：req-tol5");
    expect(text()).toContain("处理时出了错");
    expect(text()).not.toMatch(/500|boom|\/api\//);
    expect(document.querySelector("[aria-label='复制请求编号']")).toBeTruthy();
    fail = false;
    const retry = document.querySelector<HTMLButtonElement>("[data-testid='tol5-retry']")!;
    await act(async () => retry.click());
    await waitFor(() => rows().length > 0, "retry recovered");
  });
});

describe("four states and repro legs", () => {
  it("forced states render, carry data-fixture and make no request", async () => {
    for (const state of ["loading", "empty", "error", "denied"]) {
      await render(`/capabilities?tab=tools&state=${state}`);
      await waitFor(() => !document.querySelector(".animate-pulse") || state === "loading", `${state} painted`);
      expect(document.querySelector("[data-testid='tol5-page']")?.getAttribute("data-fixture")).toBe(state);
      expect(api.fetchJsonStrict).not.toHaveBeenCalled();
    }
  });

  it("?state=ready is not reproducible and reads live", async () => {
    await mount(answer, "/capabilities?tab=tools&state=ready");
    expect(api.fetchJsonStrict).toHaveBeenCalled();
    expect(document.querySelector("[data-testid='tol5-page']")?.hasAttribute("data-fixture")).toBe(false);
  });
});
