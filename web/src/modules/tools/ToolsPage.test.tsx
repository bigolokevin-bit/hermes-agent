// @vitest-environment jsdom
// 工具与 MCP 真数据面：两个真实路由、逐行字段、凭据只显示状态、不可用项留灰色、
// 403 与 404 使用同一未接入体、不出示样例、不回显路径，四态与重试齐全。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
vi.mock("@/modules/models/fetchJson", () => ({ fetchJsonStrict: api.fetchJsonStrict }));
const clipboard = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clipboard.copyTextToClipboard }));

import { ToolsPage } from "./ToolsPage";
import { resetToolsTabState } from "./useToolsData";
import { publishCapabilityCount, resetCapabilityCounts } from "../capabilities/counts";
import { resetTabView } from "../capabilities/tabView";

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

function LocationProbe(): React.ReactNode {
  const loc = useLocation();
  return <span data-testid="cap8-location">{loc.search}</span>;
}

async function render(entry: string): Promise<void> {
  await act(async () => root?.unmount());
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<MemoryRouter initialEntries={[entry]}><LocationProbe /><ToolsPage /></MemoryRouter>);
  });
}

const text = (): string => document.body.textContent ?? "";
const rows = (): Element[] => [...document.querySelectorAll("[data-testid='tol5-row']")];

async function downloadedName(): Promise<string> {
  let name = "";
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (() => "blob:cap8") as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  HTMLAnchorElement.prototype.click = function click() { name = this.download; };
  try {
    await act(async () => document.querySelector<HTMLButtonElement>("[data-testid='cap6-export']")!.click());
  } finally {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    HTMLAnchorElement.prototype.click = originalClick;
  }
  return name;
}

async function exportCsv(): Promise<string> {
  const blobs: Blob[] = [];
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = ((blob: Blob) => { blobs.push(blob); return "blob:cap8"; }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  HTMLAnchorElement.prototype.click = function click() { /* capture only */ };
  try {
    await act(async () => document.querySelector<HTMLButtonElement>("[data-testid='cap6-export']")!.click());
  } finally {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    HTMLAnchorElement.prototype.click = originalClick;
  }
  const blob = blobs[0];
  expect(blob).toBeTruthy();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob!);
  });
}

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

beforeEach(() => {
  api.fetchJsonStrict.mockReset();
  resetCapabilityCounts();
  resetToolsTabState();
  resetTabView();
  clipboard.copyTextToClipboard.mockReset();
  clipboard.copyTextToClipboard.mockResolvedValue(true);
});
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
      "/agent-api/api/tools",
      "/agent-api/api/tools/toolsets",
      "/api/mcp/servers",
      "/api/tools",
      "/api/tools/toolsets",
    ]);

    expect(document.querySelector("[data-testid='tol5-page']")).toBeTruthy();
    expect(document.querySelector("[data-testid='tl3-page']")).toBeTruthy();
    await waitFor(() => document.querySelector("[data-testid='cap4-count-tools']")?.textContent?.includes("6") ?? false, "tools count");
    expect(document.querySelector("[data-testid='cap4-count-tools']")?.textContent).toContain("有源");
    expect(document.querySelector("[data-testid='cap4-count-skills']")?.textContent).toContain("未取数");
    expect(document.querySelectorAll("[data-testid^='tl3-row-']")).toHaveLength(6);
    const planned = document.querySelector<HTMLButtonElement>("[data-testid='tl3-planned-create']")!;
    expect(planned.disabled).toBe(true);
    expect(planned.getAttribute("data-planned")).toBe("true");
    expect(planned.getAttribute("aria-disabled")).toBe("true");
    expect(planned.getAttribute("title")).toContain("还没有工具写入口");
  });

  it("renders toolset and MCP rows with type, enabled state, credential state and last-call gap", async () => {
    await mount();
    expect(rows()).toHaveLength(6);
    expect(text()).toContain("网页搜索");
    expect(text()).toContain("网页搜索与抓取");
    expect(text()).toContain("MCP · HTTP 服务");
    expect(text()).toContain("MCP · 本地进程");
    const web = rows()[0]!;
    expect(web.querySelector("[data-testid='tol5-status']")?.textContent).toBe("正常");
    expect(web.querySelector("[data-testid='tl3-name']")?.textContent).toContain("网页搜索");
    expect(web.querySelector("[data-testid='tl3-type']")?.textContent).toContain("内置");
    expect(web.querySelector("[data-testid='tl3-status']")?.textContent).toBe("正常");
    expect(web.querySelector("[data-testid='tl3-updated']")?.textContent).toContain("最近更新：—");
    expect(web.querySelector("[data-testid='tl3-updated']")?.textContent).toContain("没有提供最近更新时间");
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
    expect(text()).toContain("工具读口未接入");
    expect(text()).toContain("请求编号：req-deny");
    expect(document.querySelector("[data-testid='tl3-apply']")).toBeTruthy();
    expect(document.querySelector("[data-testid='tl3-request-id']")).toBeTruthy();
    expect(document.querySelector("[data-testid='tl3-retry']")).toBeTruthy();
    expect(document.querySelector("[data-testid='capF-retry']")).toBeTruthy();
    expect(document.querySelector("[data-testid='cap9-state-denied']")).toBeTruthy();
    expect(document.querySelector("[data-testid='cap9-state-unavailable']")).toBeNull();
    expect(document.querySelector("[data-testid='capF-state-unavailable']")).toBeTruthy();
    expect(document.querySelector("[data-testid='capF-state-unavailable']")?.textContent).toContain("工具读口未接入");
    expect(document.querySelector("[data-testid='tol5-page']")?.getAttribute("data-cap-state")).toBe("unavailable");
    const count = document.querySelector("[data-testid='cap4-count-tools']")!;
    expect(count.textContent).toContain("—");
    expect(count.textContent).toContain("无源");
    expect(count.getAttribute("title")).toContain("GAP-04");
    const copy = document.querySelector<HTMLButtonElement>('[data-testid="capC-copy"]')!;
    const csv = document.querySelector<HTMLButtonElement>('[data-testid="cap6-export"]')!;
    expect(copy.disabled).toBe(true);
    expect(csv.disabled).toBe(true);
    expect(copy.title).toContain("读口未接入");
    expect(copy.title).toContain("审批中心");
    expect(copy.title).toContain("GAP-04");
    expect(csv.title).toContain("读口未接入");
    expect(document.querySelector('[data-testid="cap6-export-count"]')?.textContent).toBe("—");
    expect(document.querySelector<HTMLInputElement>("[data-testid='cap5-search']")?.disabled).toBe(true);
    expect(document.querySelector("[data-testid='cap-gates-counts']")?.getAttribute("data-enabled")).toBe("false");
    expect(document.querySelector("[data-testid='cap-gates-sort']")?.getAttribute("data-enabled")).toBe("false");
    expect(document.querySelector("[data-testid='cap-gates-detail']")?.getAttribute("data-enabled")).toBe("false");
    expect(text()).not.toMatch(/\/api\/|403|GAP-04/);
  });

  it("both 404 routes use the same neutral not-wired body as 403", async () => {
    await mount(failed(404, "/api/tools/toolsets", "req-deny"));
    expect(document.querySelector("[data-testid='tol5-denied']")).toBeTruthy();
    expect(document.querySelector("[data-testid='tol5-fixture-note']")).toBeNull();
    expect(rows()).toHaveLength(0);
    expect(text()).toContain("工具读口未接入");
    expect(text()).toContain("请求编号：req-deny");
    expect(text()).not.toMatch(/\/api\/|403|404|GAP-04|字段示例/);
    expect(document.querySelector("[data-testid='tol5-denied']")?.getAttribute("title")).toBe("GAP-04");
    expect(document.querySelector("[data-testid='cap9-state-unavailable']")).toBeTruthy();
    expect(document.querySelector("[data-testid='cap9-state-denied']")).toBeNull();
    expect(document.querySelector("[data-testid='capF-state-unavailable']")).toBeTruthy();
    expect(document.querySelector("[data-testid='capF-state-unavailable']")?.textContent).toContain("工具读口未接入");
    const copy = document.querySelector<HTMLButtonElement>('[data-testid="capC-copy"]')!;
    const csv = document.querySelector<HTMLButtonElement>('[data-testid="cap6-export"]')!;
    expect(copy.disabled).toBe(true);
    expect(csv.disabled).toBe(true);
    expect(copy.title).toContain("读口未接入");
    expect(copy.title).toContain("审批中心");
    expect(copy.title).toContain("GAP-04");
    expect(csv.title).toContain("读口未接入");
    expect(document.querySelector("[data-testid='cap6-export-count']")?.textContent).toBe("—");
    expect(document.querySelectorAll("[data-testid='tol5-row'][tabindex]")).toHaveLength(0);
  });

  it("a 200 empty payload is an honest 0, not a not-wired state", async () => {
    await mount((url) => {
      if (!url) return Promise.resolve({ servers: [] });
      if (url.startsWith("/agent-api/")) return Promise.reject(new ApiError("missing", { status: 404, body: "{}", url }));
      if (url.includes("/api/tools/toolsets")) return Promise.resolve([]);
      if (url.includes("/api/mcp/servers")) return Promise.resolve({ servers: [] });
      return Promise.reject(new ApiError("unknown", { status: 404, body: "{}", url }));
    });
    expect(document.querySelector("[data-testid='tol5-empty']")).toBeTruthy();
    expect(document.querySelector("[data-testid='cap9-state-empty']")).toBeTruthy();
    expect(document.querySelector("[data-testid='capF-state-empty']")).toBeTruthy();
    expect(document.querySelector("[data-testid='capF-state-empty']")?.textContent).toContain("读口已接入，本次返回 0 条");
    expect(document.querySelector("[data-testid='capF-state-empty-text']")?.textContent).toBe("读口已接入，本次返回 0 条；不补样例。");
    expect(document.querySelector("[data-testid='tol5-page']")?.getAttribute("data-cap-state")).toBe("empty");
    expect(document.querySelector("[data-testid='tol5-denied']")).toBeNull();
    const count = document.querySelector("[data-testid='cap4-count-tools']")!;
    expect(count.textContent).toContain("0");
    expect(count.textContent).toContain("有源（空）");
    expect(count.textContent).not.toContain("无源");
    const csv = document.querySelector<HTMLButtonElement>('[data-testid="cap6-export"]')!;
    const copy = document.querySelector<HTMLButtonElement>('[data-testid="capC-copy"]')!;
    expect(csv.disabled).toBe(true);
    expect(copy.disabled).toBe(true);
    expect(csv.title).toBe("当前没有可导出的条目。");
    expect(copy.title).toBe("当前没有可导出的条目。");
    expect(document.querySelector('[data-testid="cap6-export-count"]')?.textContent).toBe("0 条");
    expect(document.querySelector<HTMLInputElement>("[data-testid='cap5-search']")?.disabled).toBe(true);
    expect(document.querySelector("[data-testid='cap-gates-counts']")?.getAttribute("data-enabled")).toBe("true");
    expect(document.querySelector("[data-testid='cap-gates-sort']")?.getAttribute("data-enabled")).toBe("true");
    expect(document.querySelector("[data-testid='cap-gates-detail']")?.getAttribute("data-enabled")).toBe("false");
  });

  it("treats a non-JSON SPA shell as not wired, never as a parser error", async () => {
    await mount((url) => {
      if (!url) return Promise.resolve({ servers: [] });
      const status = url.startsWith("/agent-api/") ? 404 : 200;
      return Promise.reject(new ApiError("不是数据", { status, body: "<!doctype html>", url }));
    });
    expect(document.querySelector("[data-testid='tol5-denied']")).toBeTruthy();
    expect(text()).toContain("工具读口未接入");
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

  it("keeps q/sort/dir in the URL through error and retry", async () => {
    let fail = true;
    api.fetchJsonStrict.mockImplementation((url: string) => {
      if (fail) return Promise.reject(new ApiError("boom", { status: 500, body: "{}", url, requestId: "req-tools-keep" }));
      return url.includes("/api/tools/toolsets") ? Promise.resolve(TOOLSETS) : Promise.resolve({ servers: [] });
    });
    await render("/capabilities?tab=tools&q=%E7%BD%91%E9%A1%B5&sort=name&dir=asc");
    const loc = document.querySelector('[data-testid="cap8-location"]')?.textContent ?? "";
    expect(loc).toContain("tab=tools");
    expect(decodeURIComponent(loc)).toContain("q=网页");
    expect(loc).toContain("sort=name");
    expect(loc).toContain("dir=asc");
    expect(document.querySelector<HTMLButtonElement>('[data-testid="cap6-export"]')?.disabled).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('[data-testid="capC-copy"]')?.disabled).toBe(true);
    const retry = document.querySelector<HTMLButtonElement>("[data-testid='tol5-retry']")!;
    fail = false;
    await act(async () => retry.click());
    await waitFor(() => rows().length > 0, "retry recovered");
    const after = document.querySelector('[data-testid="cap8-location"]')?.textContent ?? "";
    expect(after).toContain("tab=tools");
    expect(decodeURIComponent(after)).toContain("q=网页");
    expect(after).toContain("sort=name");
    expect(after).toContain("dir=asc");
  });

  it("500 shows human copy, a copyable request id and a working retry", async () => {
    let fail = true;
    await mount((url) => {
      if (!url) return Promise.resolve({ servers: [] });
      if (fail) return Promise.reject(new ApiError("boom", { status: 500, body: "{}", url, requestId: "req-tol5" }));
      return answer(url);
    });
    expect(document.querySelector("[data-testid='tol5-error']")).toBeTruthy();
    expect(document.querySelector("[data-testid='capF-state-error']")).toBeTruthy();
    expect(document.querySelector("[data-testid='capF-state-error']")?.textContent).toContain("工具与 MCP 清单没能加载出来");
    expect(document.querySelector("[data-testid='tol5-page']")?.getAttribute("data-cap-state")).toBe("error");
    expect(text()).toContain("请求编号：req-tol5");
    expect(text()).toContain("处理时出了错");
    expect(text()).not.toMatch(/500|boom|\/api\//);
    const count = document.querySelector("[data-testid='cap4-count-tools']")!;
    expect(count.textContent).toContain("—");
    expect(count.textContent).not.toContain("0");
    const csv = document.querySelector<HTMLButtonElement>('[data-testid="cap6-export"]')!;
    const copy = document.querySelector<HTMLButtonElement>('[data-testid="capC-copy"]')!;
    expect(csv.disabled).toBe(true);
    expect(copy.disabled).toBe(true);
    expect(csv.title).toContain("请求编号：req-tol5");
    expect(copy.title).toContain("请求编号：req-tol5");
    expect(document.querySelector('[data-testid="cap6-export-count"]')?.textContent).toBe("—");
    expect(document.querySelector("[aria-label='复制请求编号']")).toBeTruthy();
    fail = false;
    const before = urls().length;
    const retry = document.querySelector<HTMLButtonElement>("[data-testid='tol5-retry']")!;
    await act(async () => retry.click());
    await waitFor(() => rows().length > 0, "retry recovered");
    const retried = urls().slice(before);
    expect(retried.length).toBeGreaterThan(0);
    expect(retried.every((url) => /\/api\/(tools|mcp)(\/|$)/.test(url) && !url.includes("/api/skills"))).toBe(true);
    expect(csv.disabled).toBe(false);
    expect(copy.disabled).toBe(false);
    expect(document.querySelector('[data-testid="cap6-export-count"]')?.textContent).toBe("6 条");
  });

  it("replaces a stale count with 加载中 while the tab reads again", async () => {
    publishCapabilityCount("tools", { value: 99, source: "ready", reason: null, gap: null });
    api.fetchJsonStrict.mockImplementation(() => new Promise(() => undefined));
    await render("/capabilities?tab=tools");
    const count = document.querySelector("[data-testid='cap4-count-tools']")!;
    expect(count.textContent).toContain("加载中");
    expect(count.textContent).not.toContain("99");
  });
});

describe("four states and repro legs", () => {
  it("forced states render, carry data-fixture and make no request", async () => {
    for (const state of ["loading", "empty", "error", "denied"]) {
      await render(`/capabilities?tab=tools&state=${state}`);
      await waitFor(() => !document.querySelector(".animate-pulse") || state === "loading", `${state} painted`);
      expect(document.querySelector("[data-testid='tol5-page']")?.getAttribute("data-fixture")).toBe(state);
      const capState = state === "denied" ? "unavailable" : state;
      expect(document.querySelector(`[data-testid='capF-state-${capState}']`)).toBeTruthy();
      expect(document.querySelector(`[data-testid='capF-state-${capState}']`)?.textContent?.trim().length).toBeGreaterThan(0);
      if (capState === "empty") {
        expect(document.querySelector("[data-testid='capF-state-empty-text']")?.textContent?.trim().length).toBeGreaterThan(0);
      }
      expect(document.querySelector("[data-testid='tol5-page']")?.getAttribute("data-cap-state")).toBe(capState);
      expect(api.fetchJsonStrict).not.toHaveBeenCalled();
    }
  });

  it("?state=ready is not reproducible and reads live", async () => {
    await mount(answer, "/capabilities?tab=tools&state=ready");
    expect(api.fetchJsonStrict).toHaveBeenCalled();
    expect(document.querySelector("[data-testid='tol5-page']")?.hasAttribute("data-fixture")).toBe(false);
  });
});

describe("row detail", () => {
  it("opens one detail at a time and reports the read endpoint and missing asOf", async () => {
    await mount();
    const toggles = [...document.querySelectorAll<HTMLButtonElement>("[data-testid='cap7-detail-toggle']")];
    expect(toggles).toHaveLength(6);

    await act(async () => toggles[0]!.click());
    let details = [...document.querySelectorAll("[data-testid='cap7-detail-tools']")];
    expect(details).toHaveLength(1);
    expect(details[0]!.textContent).toContain("网页搜索");
    expect(details[0]!.textContent).toContain("/api/tools/toolsets");
    expect(document.querySelector("[data-testid='cap7-detail-asof']")?.textContent).toContain("—");
    expect(document.querySelector("[data-testid='cap7-detail-asof']")?.getAttribute("title")).toContain("上游没带采集时刻，不用本机时间顶替");
    expect(document.querySelector("[data-testid='cap7-detail-updated']")?.textContent).toContain("—");

    await act(async () => toggles[5]!.click());
    details = [...document.querySelectorAll("[data-testid='cap7-detail-tools']")];
    expect(details).toHaveLength(1);
    expect(details[0]!.textContent).toContain("旧连接");
    expect(details[0]!.textContent).toContain("/api/mcp/servers");
    expect(details[0]!.textContent).not.toContain("网页搜索");

    await act(async () => toggles[5]!.click());
    expect(document.querySelectorAll("[data-testid='cap7-detail-tools']")).toHaveLength(0);
    expect(rows()).toHaveLength(6);
  });

  it("keeps name, type, status and update time identical across row, detail and copy", async () => {
    const handler = (url?: string) => {
      if (!url) return Promise.resolve({ servers: [] });
      if (url === "/api/tools/toolsets") {
        return Promise.resolve([{ name: "ghost", label: "Ghost", enabled: "mystery", tools: ["ghost_tool"] }]);
      }
      if (url.includes("/api/mcp/servers")) return Promise.resolve({ servers: [] });
      return Promise.reject(new ApiError("missing", { status: 404, body: "{}", url }));
    };
    await mount(handler);
    const row = rows()[0]!;
    expect(row.querySelector("[data-testid='tol5-name']")?.textContent).toBe("ghost tool");
    expect(row.querySelector("[data-testid='tol5-type']")?.textContent).toBe("内置 · Ghost");
    expect(row.querySelector("[data-testid='tol5-status']")?.textContent).toBe("待核实");
    expect(row.querySelector("[data-testid='tol5-status']")?.closest("[title]")?.getAttribute("title")).toContain("mystery");
    expect(row.querySelector("[data-testid='tl3-updated']")?.textContent).toContain("最近更新：—");

    await act(async () => document.querySelector<HTMLButtonElement>("[data-testid='cap7-detail-toggle']")!.click());
    expect(document.querySelector("[data-testid='cap7-detail-name']")?.textContent).toBe("ghost tool");
    expect(document.querySelector("[data-testid='cap7-detail-type']")?.textContent).toBe("内置 · Ghost");
    expect(document.querySelector("[data-testid='cap7-detail-enabled']")?.textContent).toBe("待核实");
    expect(document.querySelector("[data-testid='cap7-detail-enabled']")?.getAttribute("title")).toContain("mystery");
    expect(document.querySelector("[data-testid='cap7-detail-updated']")?.textContent).toBe("—");
    expect(document.querySelector("[data-testid='cap7-detail-updated']")?.getAttribute("title")).toContain("没有提供最近更新时间");
    expect(document.querySelector("[data-testid='cap7-detail-asof']")?.textContent).toBe("—");
    expect(document.querySelector("[data-testid='cap7-detail-asof']")?.getAttribute("title")).toContain("上游没带采集时刻，不用本机时间顶替");
    expect(document.querySelector("[data-testid='cap7-detail-endpoint']")?.textContent).toBe("/api/tools/toolsets");

    const beforeCopy = api.fetchJsonStrict.mock.calls.length;
    await act(async () => document.querySelector<HTMLButtonElement>("[data-testid='capC-copy']")!.click());
    const copied = String(clipboard.copyTextToClipboard.mock.calls[0][0]).split("\n");
    expect(copied[1]).toBe("ghost tool,内置 · Ghost,待核实,—");
    expect(api.fetchJsonStrict.mock.calls.length).toBe(beforeCopy);
  });

  it("shows only a top-level ISO asOf from the inventory payload", async () => {
    const handler = (url?: string) => {
      if (!url) return Promise.resolve({});
      if (url === "/api/tools") {
        return Promise.resolve({
          items: [{ name: "alpha", enabled: true }],
          asOf: "2026-11-19T06:00:00Z",
          asOfSource: "清单快照",
        });
      }
      return Promise.reject(new ApiError("missing", { status: 404, body: "{}", url }));
    };
    await mount(handler);
    expect(document.querySelector("[data-testid='cap-row-copy']")).toBeNull();
    await act(async () => document.querySelector<HTMLButtonElement>("[data-testid='cap7-detail-toggle']")!.click());
    expect(document.querySelector("[data-testid='cap-row-copy']")).toBeTruthy();
    const asof = document.querySelector("[data-testid='cap7-detail-asof']");
    expect(asof?.textContent).toBe("2026-11-19 14:00");
    expect(asof?.getAttribute("title")).toContain("UTC 原文：2026-11-19T06:00:00Z · 北京时间：2026-11-19 14:00 · 来源：清单快照");
    expect(document.body.textContent).not.toContain("asOfSource");
  });

  it("closes on Escape and keeps the tab and search state", async () => {
    await mount(answer, "/capabilities?tab=tools&q=%E7%BD%91%E9%A1%B5");
    await act(async () => document.querySelector<HTMLButtonElement>("[data-testid='cap7-detail-toggle']")!.click());
    expect(document.querySelectorAll("[data-testid='cap7-detail-tools']")).toHaveLength(1);
    expect(document.querySelector("[data-testid='cap-row-copy']")).toBeTruthy();
    expect(document.querySelector<HTMLInputElement>("[data-testid='cap5-search']")?.value).toBe("网页");
    expect(rows()).toHaveLength(2);
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    expect(document.querySelectorAll("[data-testid='cap7-detail-tools']")).toHaveLength(0);
    expect(document.querySelector("[data-testid='cap-row-copy']")).toBeNull();
    expect(document.querySelector<HTMLInputElement>("[data-testid='cap5-search']")?.value).toBe("网页");
    expect(rows()).toHaveLength(2);
  });
});

describe("sortable columns", () => {
  it("previews the contract filename and downloads exactly that string", async () => {
    const handler = (url?: string) => {
      if (!url) return Promise.resolve({});
      if (url === "/api/tools") {
        return Promise.resolve({
          items: [
            { name: "网页搜索", enabled: true, updated_at: "2026-11-19T06:00:00Z" },
            { name: "文档写入", enabled: true, updated_at: "2026-11-18T06:00:00Z" },
          ],
          asOf: "2026-11-19T06:00:00Z",
        });
      }
      return Promise.reject(new ApiError("missing", { status: 404, body: "{}", url }));
    };
    await mount(handler, "/capabilities?tab=tools&q=网页&sort=name&dir=asc");
    const preview = () => document.querySelector("[data-testid='cap-export-name']")!;
    expect(preview().textContent).toMatch(/^capabilities-tools-default-name-asc-\d{8}-\d{4}\.csv$/);
    expect(preview().getAttribute("title")).toContain("tab=tools");
    expect(preview().getAttribute("title")).toContain("q=网页");
    expect(preview().getAttribute("title")).toContain("sort=name");
    expect(preview().getAttribute("title")).toContain("dir=asc");
    expect(await downloadedName()).toBe(preview().textContent);
    const calls = api.fetchJsonStrict.mock.calls.length;
    await act(async () => document.querySelector<HTMLButtonElement>("[data-testid='cap8-sort-name']")!.click());
    expect(preview().textContent).toMatch(/^capabilities-tools-default-name-desc-\d{8}-\d{4}\.csv$/);
    expect(await downloadedName()).toBe(preview().textContent);
    expect(api.fetchJsonStrict).toHaveBeenCalledTimes(calls);
  });

  it("sorts by URL, cycles aria-sort and never refetches on sort clicks", async () => {
    const handler = (url?: string) => {
      if (!url) return Promise.resolve({});
      if (url === "/api/tools") {
        return Promise.resolve({
          items: [
            { name: "B2", enabled: true, updated_at: "2026-11-18T06:00:00Z" },
            { name: "A1", enabled: true, updated_at: "2026-11-19T06:00:00Z" },
            { name: "C3", enabled: false, updated_at: "2026-11-17T06:00:00Z" },
          ],
          asOf: "2026-11-19T06:00:00Z",
        });
      }
      return Promise.reject(new ApiError("missing", { status: 404, body: "{}", url }));
    };
    await mount(handler, "/capabilities?tab=tools&sort=name&dir=asc");
    const order = () => rows().map((row) => row.textContent ?? "");
    expect(order()[0]).toContain("A1");
    expect(order()[2]).toContain("C3");
    const csv = await exportCsv();
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe("name,type,enabled,updated_at");
    expect(lines[1]).toMatch(/^A1,/);
    expect(order()[0]).toMatch(/^A1/);
    expect(lines[3]).toMatch(/^C3,/);
    expect(order()[2]).toMatch(/^C3/);
    expect(document.querySelector("[data-testid='cap8-location']")?.textContent).toContain("sort=name");
    expect(document.querySelector("[aria-sort='ascending']")?.textContent).toContain("名称");
    expect(api.fetchJsonStrict).toHaveBeenCalledTimes(4);
    await act(async () => document.querySelector<HTMLButtonElement>("[data-testid='cap8-sort-name']")!.click());
    expect(document.querySelector("[data-testid='cap8-location']")?.textContent).toContain("dir=desc");
    expect(order()[0]).toContain("C3");
    expect(order()[2]).toContain("A1");
    expect(document.querySelector("[aria-sort='descending']")?.textContent).toContain("名称");
    await act(async () => document.querySelector<HTMLButtonElement>("[data-testid='cap8-sort-name']")!.click());
    expect(document.querySelector("[data-testid='cap8-location']")?.textContent).not.toContain("sort=");
    expect(document.querySelector("[aria-sort='ascending']")).toBeNull();
    expect(document.querySelector("[aria-sort='none']")?.textContent).toContain("名称");
    expect(order()[0]).toContain("B2");
    expect(api.fetchJsonStrict).toHaveBeenCalledTimes(4);
    await act(async () => document.querySelector<HTMLButtonElement>("[data-testid='capC-copy']")!.click());
    expect(document.querySelector("[data-testid='capC-copy-status']")!.textContent).toBe("已复制 3 行");
    const copied = String(clipboard.copyTextToClipboard.mock.calls[0][0]);
    expect(copied.split("\n")[0]).toBe("name,type,enabled,updated_at");
    expect(copied.split("\n")[1]).toMatch(/^B2,内置 · /);
    expect(copied.split("\n")[1]).toContain(",正常,");
    expect(copied.split("\n")[3]).toMatch(/^C3,/);
    expect(api.fetchJsonStrict).toHaveBeenCalledTimes(4);
  });
});

describe("export order", () => {
  it("exports the same default order the table renders, including the MCP section tail", async () => {
    await mount();
    const order = rows().map((row) => row.textContent ?? "");
    const csv = await exportCsv();
    const lines = csv.trim().split("\r\n");
    expect(order[0]).toContain("网页搜索");
    expect(order[order.length - 1]).toContain("旧连接");
    expect(lines[1]).toContain("网页搜索");
    expect(lines[lines.length - 1]).toContain("旧连接");
    expect(lines.length - 1).toBe(order.length);
  });
});

describe("local name search", () => {
  it("filters the loaded rows by ?q= and reports the loaded-scope note without refetching", async () => {
    await mount(answer, "/capabilities?tab=tools&q=%E7%BD%91%E9%A1%B5");
    expect(rows().map((row) => row.textContent)).toHaveLength(2);
    expect(text()).toContain("网页搜索");
    expect(text()).toContain("网页内容提取");
    expect(text()).not.toContain("创建看板");
    expect(text()).toContain("仅在当前已加载 6 项内搜索");
    expect(document.querySelector("[data-testid='cap-page-scope']")?.textContent).toContain("表内全量渲染，共 2 项");
    expect(document.querySelector("[data-testid='cap6-export-count']")?.textContent).toContain("2 条");
    expect(document.querySelector<HTMLButtonElement>("[data-testid='cap6-export']")?.disabled).toBe(false);
    expect(document.querySelector("[data-testid='capA-export-order-note']")?.textContent).toContain("导出按当前排序与搜索");
    const csv = await exportCsv();
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines.slice(1).every((line) => line.includes("网页"))).toBe(true);
    expect(urls()).toHaveLength(6);
  });

  it("shows a no-match state with a clear button, then restores every row", async () => {
    await mount(answer, "/capabilities?tab=tools&q=zzz");
    const noMatch = document.querySelector("[data-testid='tl3-no-match']");
    expect(noMatch?.textContent).toContain("没有匹配项");
    expect(document.querySelector<HTMLInputElement>("[data-testid='cap5-search']")?.disabled).toBe(false);
    expect(document.querySelector("[data-testid='cap-gates-sort']")?.getAttribute("data-enabled")).toBe("true");
    expect(document.querySelector("[data-testid='cap-gates-detail']")?.getAttribute("data-enabled")).toBe("false");
    const clear = document.querySelector<HTMLButtonElement>("[data-testid='tl3-clear']");
    expect(clear).toBeTruthy();
    await act(async () => clear?.click());
    await waitFor(() => rows().length === 6, "rows restored");
    expect(urls()).toHaveLength(6);
  });
});

describe("tab state memory", () => {
  it("keeps the current tab, query and sort in the URL when the tab is the default", async () => {
    await mount(answer, "/capabilities?q=%E7%BD%91%E9%A1%B5&sort=name&dir=asc");
    const params = new URLSearchParams(document.querySelector("[data-testid='cap8-location']")?.textContent ?? "");
    expect(params.get("tab")).toBe("tools");
    expect(params.get("q")).toBe("网页");
    expect(params.get("sort")).toBe("name");
    expect(params.get("dir")).toBe("asc");
    expect(rows()).toHaveLength(2);
    expect(text()).toContain("网页搜索");
    expect(text()).not.toContain("创建看板");
  });

  it("restores the settled rows and the open detail after a remount without another read", async () => {
    await mount();
    expect(urls()).toHaveLength(6);
    const toggle = document.querySelector<HTMLButtonElement>("[data-testid='cap7-detail-toggle']");
    expect(toggle).toBeTruthy();
    await act(async () => toggle?.click());
    expect(document.querySelectorAll("[data-testid='cap7-detail-tools']")).toHaveLength(1);

    await render("/capabilities?tab=tools");
    await waitFor(() => !document.querySelector(".animate-pulse"), "settled again");

    expect(rows()).toHaveLength(6);
    expect(document.querySelectorAll("[data-testid='cap7-detail-tools']")).toHaveLength(1);
    expect(urls()).toHaveLength(6);
  });

  it("moves row focus with arrows, Home and End, and toggles detail with Enter without another read", async () => {
    await mount();
    const calls = api.fetchJsonStrict.mock.calls.length;
    const list = rows() as HTMLElement[];
    expect(list).toHaveLength(6);
    expect(list[0].tabIndex).toBe(0);
    expect(list[1].tabIndex).toBe(-1);

    const press = async (node: HTMLElement, key: string) => {
      await act(async () => {
        node.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      });
    };

    await act(async () => list[0].focus());
    expect(document.activeElement).toBe(list[0]);

    await press(list[0], "ArrowDown");
    expect(document.activeElement).toBe(list[1]);
    expect(list[1].tabIndex).toBe(0);
    expect(list[0].tabIndex).toBe(-1);

    await press(list[1], "Home");
    expect(document.activeElement).toBe(list[0]);
    await press(list[0], "End");
    expect(document.activeElement).toBe(list[5]);
    await press(list[5], "ArrowUp");
    expect(document.activeElement).toBe(list[4]);
    await press(list[4], "ArrowDown");

    await press(list[5], "Enter");
    expect(document.querySelectorAll("[data-testid='cap7-detail-tools']")).toHaveLength(1);
    expect(list[5].getAttribute("aria-expanded")).toBe("true");

    await press(list[5], "Escape");
    expect(document.querySelectorAll("[data-testid='cap7-detail-tools']")).toHaveLength(0);
    expect(list[5].getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(list[5]);
    expect(api.fetchJsonStrict.mock.calls.length).toBe(calls);
    const css = readFileSync(`${process.cwd()}/src/modules/tools/tools.css`, "utf8");
    expect(css).toContain(".tol5-row:focus-visible");
    expect(css).toContain("var(--color-ring)");
    expect(css).toContain(".capF-state");
    expect(css).toMatch(/min-height:\s*220px/);
  });
});

describe("row deep link", () => {
  it("writes the open row to the URL and closes without losing q/sort/dir", async () => {
    await mount(answer, "/capabilities?tab=tools&q=%E7%BD%91%E9%A1%B5&sort=name&dir=asc");
    const calls = urls().length;

    await act(async () => document.querySelector<HTMLButtonElement>("[data-testid='cap7-detail-toggle']")!.click());
    const afterOpen = new URLSearchParams(document.querySelector("[data-testid='cap8-location']")?.textContent ?? "");
    expect(afterOpen.get("row")).toBe("tools:网页内容提取");
    expect(afterOpen.get("q")).toBe("网页");
    expect(afterOpen.get("sort")).toBe("name");
    expect(afterOpen.get("dir")).toBe("asc");
    expect(document.querySelectorAll("[data-testid='cap7-detail-tools']")).toHaveLength(1);
    expect(document.querySelector("[data-testid='cap-row-expanded']")).toBeTruthy();
    expect(rows()[0].getAttribute("aria-current")).toBe("true");

    await act(async () => document.querySelector<HTMLButtonElement>("[data-testid='cap-row-close']")!.click());
    const afterClose = new URLSearchParams(document.querySelector("[data-testid='cap8-location']")?.textContent ?? "");
    expect(afterClose.get("row")).toBeNull();
    expect(afterClose.get("q")).toBe("网页");
    expect(afterClose.get("sort")).toBe("name");
    expect(afterClose.get("dir")).toBe("asc");
    expect(document.querySelectorAll("[data-testid='cap7-detail-tools']")).toHaveLength(0);
    expect(urls()).toHaveLength(calls);
  });

  it("opens and scrolls a pasted row link without another read", async () => {
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scroll });
    await mount(answer, `/capabilities?tab=tools&${new URLSearchParams({ row: "tools:网页搜索" }).toString()}`);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });

    expect(document.querySelectorAll("[data-testid='cap7-detail-tools']")).toHaveLength(1);
    const row = rows().find((node) => node.textContent?.includes("网页搜索"));
    expect(row?.getAttribute("aria-current")).toBe("true");
    expect(scroll).toHaveBeenCalled();
    expect(urls()).toHaveLength(6);
    delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it("reports a missing row without inventing one", async () => {
    await mount(answer, `/capabilities?tab=tools&${new URLSearchParams({ row: "tools:不存在" }).toString()}`);
    const missing = document.querySelector("[data-testid='cap-row-missing']");
    expect(missing?.textContent).toContain("该条目不在当前列表里");
    expect(missing?.getAttribute("title")).toBe("GAP-CAPROW-01");
    expect(document.querySelectorAll("[data-testid='cap7-detail-tools']")).toHaveLength(0);
    expect(rows()).toHaveLength(6);
    expect(urls()).toHaveLength(6);
  });
});
