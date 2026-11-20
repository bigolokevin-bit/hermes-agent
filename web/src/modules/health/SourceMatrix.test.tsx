// @vitest-environment jsdom
import { act } from "react";
import { readFileSync } from "node:fs";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: (...args: unknown[]) => api.fetchJSON(...args) }));
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { outlined?: boolean }) => {
    const { outlined, ...rest } = props; void outlined; return <button {...rest}>{children}</button>;
  },
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));
import { ApiError } from "@/lib/api-error";
import { ASOF_KEYS, ASOF_MISSING_TITLE, readTopAsOf } from "./systemHealth";
import { HealthPage } from "./HealthPage";
import { resetSourceMatrix } from "./sourceReads";
import { COPY_SCOPE_TEXT } from "./copyScope";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const HEALTH = {
  schema: "console.health.sources.v1",
  ok: true,
  asOf: "2026-11-19T15:17:09Z",
  asOfSource: "health.payload.asOf",
  sources: [
    { id: "console", name: "控制台服务(BFF)", state: "ok", version: "4.2.1" },
    { id: "runtime", name: "Hermes 运行时", state: "ok", version: "0.9.1" },
  ],
};

function answer(url: string) {
  if (url === "/agent-api/api/health") return Promise.resolve(HEALTH);
  if (url.includes("__health-probe__")) {
    return Promise.reject(new ApiError("unavailable", { status: 404, body: "", url, requestId: "req-console-404" }));
  }
  if (url.includes("hermes-summary")) {
    return Promise.reject(new ApiError("upstream failed", { status: 500, body: "", url, requestId: "req-runtime-500" }));
  }
  return Promise.resolve({ items: [], asOf: "2026-11-19T22:15:01.655Z" });
}

async function render() {
  await act(async () => { root.render(<HealthPage />); });
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
}

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  const started = Date.now();
  while (!cond()) {
    if (Date.now() - started > 2500) throw new Error(`waitFor: ${label}`);
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
  }
}

const q = (id: string) => container.querySelector(`[data-testid='${id}']`);
const rowIds = () => Array.from(container.querySelectorAll("[data-testid^='sys6-row-']"))
  .map((node) => (node.getAttribute("data-testid") ?? "").replace("sys6-row-", ""));

beforeEach(() => {
  resetSourceMatrix();
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(answer);
  window.history.replaceState({}, "", "/system?tab=health");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.history.replaceState({}, "", "/");
});

describe("source matrix", () => {
  it("reuses the four reads, shows paths, status, duration and top-level ISO asOf", async () => {
    await render();
    const scroll = q("sys6-scroll") as HTMLElement;
    expect(scroll).not.toBeNull();
    expect(scroll.hidden).toBe(true);
    expect(q("sys6-table")).not.toBeNull();
    expect(q("sys9-src-link-health")?.getAttribute("href")).toBe("#/system?tab=health");
    expect(q("sys9-src-nolink-console")).not.toBeNull();
    expect(q("sys8-asof-health")?.getAttribute("title")).toContain("UTC 原文");
    await act(async () => { (q("sys6-toggle") as HTMLButtonElement).click(); });
    expect(q("sys6-table")).not.toBeNull();
    expect((q("sys6-scroll") as HTMLElement).hidden).toBe(false);
    await waitFor(() => q("sys6-status-health")?.textContent?.includes("成功") ?? false, "health row");
    expect(api.fetchJSON).toHaveBeenCalledTimes(4);
    expect(container.querySelectorAll("[data-testid^='sys6-row-']")).toHaveLength(4);
    expect(api.fetchJSON).toHaveBeenCalledTimes(4);
    expect(q("sys7-export-count")?.textContent).toBe("4 行");
    const exportButton = q("sys7-export") as HTMLButtonElement;
    expect(exportButton.disabled).toBe(false);
    const createObjectURL = vi.fn(() => "blob:sys7");
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await act(async () => { exportButton.click(); });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(api.fetchJSON).toHaveBeenCalledTimes(4);
    clickSpy.mockRestore();

    expect(q("sys6-name-health")?.textContent).toBe("系统健康清单");
    expect(q("sys9-src-link-health")?.getAttribute("href")).toBe("#/system?tab=health");
    expect(q("sys9-src-link-runtime")?.getAttribute("href")).toBe("#/capabilities?tab=channels");
    expect(q("sys9-src-link-domain")?.getAttribute("href")).toBe("#/capabilities?tab=skills");
    expect(q("sys9-src-link-console")).toBeNull();
    expect(q("sys9-src-nolink-console")?.textContent).toBe("该读口无对应页面");
    expect(q("sys9-src-nolink-console")?.getAttribute("title")).toContain("不造死链");
    expect(q("sys6-path-health")?.textContent).toBe("/agent-api/api/health");
    expect(q("sys6-status-health")?.textContent).toContain("成功");
    expect(q("sys6-asof-health")?.textContent).toBe("2026-11-19 23:17");
    expect(q("sys6-duration-health")?.textContent).toMatch(/^\d+ ms$/);

    expect(q("sys6-status-console")?.textContent).toContain("读口未接入");
    expect(q("sys6-status-console")?.textContent).toContain("去申请开通");
    expect(q("sys6-apply-console")?.getAttribute("href")).toBe("#/approvals");
    expect(q("sys6-status-console")?.getAttribute("title")).toBe("GAP-SYS6-01");
    expect(q("sys6-duration-console")?.textContent).toMatch(/^\d+ ms$/);

    expect(q("sys6-status-runtime")?.textContent).toContain("失败");
    expect(q("sys6-status-runtime")?.textContent).not.toContain("upstream failed");
    expect(q("sys6-status-runtime")?.getAttribute("title")).toContain("upstream failed");
    expect(q("sys6-rid-runtime")?.textContent).toContain("req-runt");
    expect(q("sys6-rid-runtime-copy")?.getAttribute("aria-label")).toBe("复制完整请求编号");

    expect(q("sys6-status-domain")?.textContent).toContain("成功");
    expect(q("sys6-asof-domain")?.textContent).toBe("2026-11-20 06:15");

    // Same read, same ISO, same Beijing minute: the health list column and the matrix row.
    expect(q("sys3-checked")?.textContent).toBe("2026-11-19 23:17");
    expect(q("sys8-asof-health")?.textContent).toBe(q("sys3-checked")?.textContent);
    const healthAsOfTitle = q("sys6-asof-health")?.getAttribute("title") ?? "";
    expect(healthAsOfTitle).toContain("UTC 原文：2026-11-19T15:17:09Z");
    expect(healthAsOfTitle).toContain("北京时间：2026-11-19 23:17");
    expect(healthAsOfTitle).toContain("来源：health.payload.asOf");
    expect(healthAsOfTitle).toContain("判据：只取 payload 顶层 ISO");
    expect(healthAsOfTitle).toContain("不使用本机时钟");
    expect(q("sys8-same-source-note")?.textContent).toContain("同源");
    expect(q("sys8-same-source-note")?.textContent).toContain("同一 ISO 值");
    expect(q("gov-asof-note")?.textContent).toContain("采集时刻只取接口响应顶层时间");
    expect(q("gov-asof-note")?.textContent).toContain("不用本机时间顶替");
    // Probe rows keep their own asOf and never borrow the health list time.
    expect(q("sys8-asof-console")?.textContent).toBe("—");
    expect(q("sys8-asof-runtime")?.textContent).toBe("—");
    expect(api.fetchJSON).toHaveBeenCalledTimes(4);
  });

  it("copies the on-screen matrix as plain text without another request", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await render();
    await act(async () => { (q("sys6-toggle") as HTMLButtonElement).click(); });
    await waitFor(() => q("sys6-status-health")?.textContent?.includes("成功") ?? false, "health row");
    expect(api.fetchJSON).toHaveBeenCalledTimes(4);
    const copyButton = q("sys10-copy") as HTMLButtonElement;
    expect(copyButton.disabled).toBe(false);
    expect(copyButton.getAttribute("title")).toContain("不会再发请求");
    expect(copyButton.getAttribute("title")).toContain(COPY_SCOPE_TEXT);
    expect(q("sys-copy-scope")?.textContent).toBe(COPY_SCOPE_TEXT);
    await act(async () => { copyButton.click(); await Promise.resolve(); });
    await waitFor(() => q("sys10-copy-status")?.textContent === "已复制", "copied");

    expect(writeText).toHaveBeenCalledTimes(1);
    const text = writeText.mock.calls[0][0] as string;
    const lines = text.trimEnd().split("\n");
    expect(lines[0]).toBe("口径名 | 路径 | 状态 | 耗时 | 采集时刻");
    expect(lines).toHaveLength(5);
    const tableNames = rowIds().map((id) => q(`sys6-name-${id}`)?.textContent ?? "");
    expect(lines.slice(1).map((line) => line.split(" | ")[0])).toEqual(tableNames);
    expect(lines[1].startsWith(tableNames[0])).toBe(true);
    expect(lines[lines.length - 1].startsWith(tableNames[tableNames.length - 1])).toBe(true);
    const healthLine = lines.find((line) => line.includes("系统健康清单"));
    expect(healthLine).toContain("系统健康清单 | /agent-api/api/health | 成功 | ");
    expect(healthLine).toMatch(/\| \d+ ms \| 2026-11-19 23:17$/);
    const consoleLine = lines.find((line) => line.includes("控制台服务探针"));
    expect(consoleLine).toContain("| 读口未接入 |");
    expect(consoleLine?.endsWith("| —")).toBe(true);
    expect(api.fetchJSON).toHaveBeenCalledTimes(4);
    expect(q("sys10-fallback")).toBeNull();
  });

  it("offers a read-only textarea when the clipboard rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await render();
    await act(async () => { (q("sys6-toggle") as HTMLButtonElement).click(); });
    await waitFor(() => q("sys6-status-health")?.textContent?.includes("成功") ?? false, "health row");
    await act(async () => { (q("sys10-copy") as HTMLButtonElement).click(); await Promise.resolve(); });
    await waitFor(() => q("sys10-fallback") !== null, "fallback");
    expect(q("sys10-copy-status")?.textContent).toContain("复制失败");
    const fallback = q("sys10-fallback") as HTMLTextAreaElement;
    expect(fallback.readOnly).toBe(true);
    expect(fallback.value).toContain("口径名 | 路径 | 状态 | 耗时 | 采集时刻");
    expect(fallback.value).toContain("系统健康清单 | /agent-api/api/health | 成功 | ");
    expect(api.fetchJSON).toHaveBeenCalledTimes(4);
  });

  it("only accepts a top-level ISO asOf and never substitutes the browser clock", async () => {
    api.fetchJSON.mockImplementation((url: string) => {
      if (url === "/agent-api/api/health") return Promise.resolve({ ...HEALTH, asOf: "昨天" });
      return answer(url);
    });
    await render();
    await act(async () => { (q("sys6-toggle") as HTMLButtonElement).click(); });
    await waitFor(() => q("sys6-status-health")?.textContent?.includes("成功") ?? false, "health row");
    expect(q("sys6-asof-health")?.textContent).toBe("—");
    expect(q("sys3-checked")?.textContent).toBe("—");
    expect(q("sys6-asof-health")?.getAttribute("title")).toContain("上游没带采集时刻");
    expect(q("sys6-asof-health")?.getAttribute("title")).toContain("判据：只取 payload 顶层 ISO");
    expect(q("sys9-src-link-health")?.getAttribute("href")).toBe("#/system?tab=health");
    expect(q("sys6-asof-console")?.textContent).toBe("—");
    expect(q("sys6-asof-runtime")?.textContent).toBe("—");
  });

  it("keeps the expanded state across remounts without writing the URL", async () => {
    await render();
    await act(async () => { (q("sys6-toggle") as HTMLButtonElement).click(); });
    await waitFor(() => q("sys6-status-health")?.textContent?.includes("成功") ?? false, "health row");
    expect(q("sys6-toggle")?.getAttribute("aria-expanded")).toBe("true");
    expect(window.location.search).toBe("?tab=health");
    act(() => root.unmount());
    root = createRoot(container);
    await render();
    expect(q("sys6-toggle")?.getAttribute("aria-expanded")).toBe("true");
    expect(q("sys6-table")).not.toBeNull();
  });

  it("sorts status, elapsed and asOf columns from the URL without another request", async () => {
    await render();
    await act(async () => { (q("sys6-toggle") as HTMLButtonElement).click(); });
    await waitFor(() => q("sys6-status-health")?.textContent?.includes("成功") ?? false, "health row");
    expect(api.fetchJSON).toHaveBeenCalledTimes(4);
    expect(rowIds()).toEqual(["console", "health", "domain", "runtime"]);
    expect(q("sys13-head-name")?.getAttribute("aria-sort")).toBe("ascending");
    expect(q("sys13-head-state")?.getAttribute("aria-sort")).toBe("none");
    expect(window.location.search).toBe("?tab=health");

    await act(async () => { (q("sys13-sort-state") as HTMLButtonElement).click(); });
    expect(q("sys13-head-state")?.getAttribute("aria-sort")).toBe("ascending");
    expect(q("sys13-head-name")?.getAttribute("aria-sort")).toBe("none");
    expect(rowIds()).toEqual(["health", "domain", "runtime", "console"]);
    expect(window.location.search).toBe("?tab=health&ssort=state&sdir=asc");

    await act(async () => { (q("sys13-sort-state") as HTMLButtonElement).click(); });
    expect(q("sys13-head-state")?.getAttribute("aria-sort")).toBe("descending");
    expect(rowIds()).toEqual(["console", "runtime", "health", "domain"]);
    expect(window.location.search).toBe("?tab=health&ssort=state&sdir=desc");

    await act(async () => { (q("sys13-sort-state") as HTMLButtonElement).click(); });
    expect(q("sys13-head-state")?.getAttribute("aria-sort")).toBe("none");
    expect(q("sys13-head-name")?.getAttribute("aria-sort")).toBe("ascending");
    expect(window.location.search).toBe("?tab=health");

    await act(async () => { (q("sys13-sort-asof") as HTMLButtonElement).click(); });
    expect(q("sys13-head-asof")?.getAttribute("aria-sort")).toBe("ascending");
    expect(rowIds()).toEqual(["health", "domain", "console", "runtime"]);
    await act(async () => { (q("sys13-sort-asof") as HTMLButtonElement).click(); });
    expect(q("sys13-head-asof")?.getAttribute("aria-sort")).toBe("descending");
    expect(rowIds()).toEqual(["domain", "health", "console", "runtime"]);
    expect(window.location.search).toBe("?tab=health&ssort=asof&sdir=desc");
    expect(api.fetchJSON).toHaveBeenCalledTimes(4);
  });

  it("restores a pasted ssort/sdir URL and copies rows in the same order", async () => {
    window.history.replaceState({}, "", "/system?tab=health&ssort=asof&sdir=desc");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await render();
    await act(async () => { (q("sys6-toggle") as HTMLButtonElement).click(); });
    await waitFor(() => q("sys6-status-health")?.textContent?.includes("成功") ?? false, "health row");
    expect(q("sys13-head-asof")?.getAttribute("aria-sort")).toBe("descending");
    expect(rowIds()).toEqual(["domain", "health", "console", "runtime"]);
    expect(window.location.search).toBe("?tab=health&ssort=asof&sdir=desc");
    const firstLabel = q("sys6-name-domain")?.textContent;
    const lastLabel = q("sys6-name-runtime")?.textContent;
    await act(async () => { (q("sys10-copy") as HTMLButtonElement).click(); await Promise.resolve(); });
    await waitFor(() => q("sys10-copy-status")?.textContent === "已复制", "copied");
    const lines = (writeText.mock.calls[0][0] as string).trimEnd().split("\n");
    expect(lines[1].startsWith(`${firstLabel} | `)).toBe(true);
    expect(lines[4].startsWith(`${lastLabel} | `)).toBe(true);
    expect(api.fetchJSON).toHaveBeenCalledTimes(4);
  });

  it("truncates long matrix values with full titles and reveals them in the row detail without another request", async () => {
    api.fetchJSON.mockImplementation((url: string) => {
      if (url.includes("hermes-summary")) {
        return Promise.reject(new ApiError("token=matrix-secret-very-long upstream failure with a long diagnostic suffix", {
          status: 500,
          body: "",
          url,
          requestId: "req-runtime-long",
        }));
      }
      return answer(url);
    });
    await render();
    await act(async () => { (q("sys6-toggle") as HTMLButtonElement).click(); });
    await waitFor(() => q("sys6-status-health")?.textContent?.includes("成功") ?? false, "health row");
    expect(api.fetchJSON).toHaveBeenCalledTimes(4);

    const path = q("sys15-trunc-path-health") as HTMLElement;
    expect(path.className).toContain("sys15-trunc");
    expect(path.textContent).toBe("/agent-api/api/health");
    expect(q("sys6-path-health")?.getAttribute("title")).toBe("/agent-api/api/health");
    expect(q("sys6-status-runtime")?.getAttribute("title")).toContain("***");
    expect(q("sys6-status-runtime")?.getAttribute("title")).not.toContain("matrix-secret");

    await act(async () => { (q("sys15-row-toggle-health") as HTMLButtonElement).click(); });
    expect(q("sys15-detail-health")).not.toBeNull();
    const fullPath = q("sys15-full-path-health") as HTMLElement;
    expect(fullPath.className).toContain("sys15-full");
    expect(fullPath.textContent).toBe("/agent-api/api/health");
    expect(q("sys15-full-name-health")?.textContent).toBe("系统健康清单");
    expect(api.fetchJSON).toHaveBeenCalledTimes(4);

    await act(async () => { (q("sys15-row-toggle-runtime") as HTMLButtonElement).click(); });
    expect(q("sys15-detail-runtime")).not.toBeNull();
    expect(q("sys15-full-status-runtime")?.textContent).toContain("失败");
    expect(q("sys15-full-status-runtime")?.textContent).toContain("***");
    expect(q("sys15-full-status-runtime")?.textContent).not.toContain("matrix-secret");
    expect(q("sys15-redacted-runtime")?.textContent).toContain("已脱敏 1 处");
    expect(api.fetchJSON).toHaveBeenCalledTimes(4);
  });

  it("ships truncation and full-value CSS and keeps the table layout fixed", () => {
    const css = readFileSync(`${process.cwd()}/src/modules/health/health.css`, "utf8");
    expect(css).toContain(".sys15-trunc");
    expect(css).toContain("text-overflow: ellipsis");
    expect(css).toContain("white-space: nowrap");
    expect(css).toContain(".sys15-full");
    expect(css).toContain("white-space: normal");
    expect(css).toContain("word-break: break-word");
    expect(css).toContain(".sys3-table,");
    expect(css).toContain("table-layout: fixed");
  });

  it("shows preview rows without issuing a read when a forced state is active", async () => {
    window.history.replaceState({}, "", "/system?tab=health&state=error");
    await render();
    expect(api.fetchJSON).not.toHaveBeenCalled();
    await act(async () => { (q("sys6-toggle") as HTMLButtonElement).click(); });
    expect(container.querySelectorAll("[data-testid^='sys6-row-']")).toHaveLength(4);
    expect(q("sys6-status-health")?.textContent).toContain("预览未读取");
    expect(q("sys6-status-console")?.textContent).toContain("预览未读取");
    expect(q("sys6-duration-health")?.textContent).toBe("—");
  });
});
describe("readTopAsOf", () => {
  const RAW = "2026-11-20T02:34:56Z";
  const BJT = "2026-11-20 10:34";

  it("matches all six top-level aliases to the same Beijing minute", () => {
    for (const key of ASOF_KEYS) {
      const out = readTopAsOf({ [key]: RAW });
      expect(out.valid, key).toBe(true);
      expect(out.shown, key).toBe(BJT);
      expect(out.raw, key).toBe(RAW);
      expect(out.title, key).toBe(`UTC 原文：${RAW} · 北京时间：${BJT}`);
    }
  });

  it("keeps the raw UTC value and source in the title", () => {
    const out = readTopAsOf({ collectedAt: RAW, asOfSource: "health.payload.collectedAt" });
    expect(out.shown).toBe(BJT);
    expect(out.source).toBe("health.payload.collectedAt");
    expect(out.title).toBe(`UTC 原文：${RAW} · 北京时间：${BJT} · 来源：health.payload.collectedAt`);
  });

  it("shows a dash and the shared reason for an invalid timestamp", () => {
    for (const value of ["not-a-date", "2026-11-20 10:34", 1790000000]) {
      const out = readTopAsOf({ asOf: value });
      expect(out.valid).toBe(false);
      expect(out.shown).toBeNull();
      expect(out.raw).toBeNull();
      expect(out.reason).toBe(ASOF_MISSING_TITLE);
      expect(out.title).toBe(ASOF_MISSING_TITLE);
    }
  });

  it("treats a missing key, an array and a non-object as missing without a browser clock", () => {
    for (const payload of [{}, [], null, "2026-11-20T02:34:56Z", 42]) {
      const out = readTopAsOf(payload);
      expect(out.valid).toBe(false);
      expect(out.shown).toBeNull();
      expect(out.reason).toBe(ASOF_MISSING_TITLE);
    }
  });
});

describe("source matrix state gates", () => {
  it("disables export and copy when no read point is usable and never shows a row count", async () => {
    api.fetchJSON.mockImplementation((url: string) => Promise.reject(
      new ApiError("failed", { status: 500, body: "{}", url, requestId: "req-matrix-500" }),
    ));
    await render();
    await waitFor(() => !!q("sys6-row-domain"), "matrix rows");
    const exportButton = q("sys7-export") as HTMLButtonElement;
    const copyButton = q("sys10-copy") as HTMLButtonElement;
    expect(exportButton.disabled).toBe(true);
    expect(copyButton.disabled).toBe(true);
    expect(exportButton.getAttribute("title")).toContain("没有可导出/复制");
    expect(copyButton.getAttribute("title")).toContain("没有可导出/复制");
    expect(q("sys7-export-count")?.textContent).toBe("—");
  });
});

describe("local source search", () => {
  it("filters matrix rows and copy order from the shared q without another request", async () => {
    window.history.replaceState({}, "", "/#/system?tab=health&q=runtime");
    await render();
    await waitFor(() => !!q("sys6-toggle"), "matrix toggle");
    await act(async () => (q("sys6-toggle") as HTMLButtonElement).click());
    await waitFor(() => !!q("sys6-table"), "matrix table");
    expect(rowIds()).toEqual(["runtime"]);
    expect(q("sys6-summary")?.textContent).toContain("搜索命中 1 / 4 个读口");
    const calls = api.fetchJSON.mock.calls.length;
    await act(async () => (q("sys10-copy") as HTMLButtonElement).click());
    expect(api.fetchJSON).toHaveBeenCalledTimes(calls);
  });

  it("shows a matrix no-match state and clears the shared q", async () => {
    window.history.replaceState({}, "", "/#/system?tab=health&q=zzz");
    await render();
    await waitFor(() => !!q("sys6-toggle"), "matrix toggle");
    await act(async () => (q("sys6-toggle") as HTMLButtonElement).click());
    await waitFor(() => !!q("sys-search-source-empty"), "source search empty");
    expect(q("sys-search-source-empty")?.textContent).toContain("没有匹配的读口");
    await act(async () => (q("sys-search-source-empty")?.querySelector("[data-testid='sys-search-clear']") as HTMLButtonElement).click());
    await waitFor(() => rowIds().length === 4, "four rows after clear");
    expect(window.location.hash).not.toContain("q=");
  });
});
