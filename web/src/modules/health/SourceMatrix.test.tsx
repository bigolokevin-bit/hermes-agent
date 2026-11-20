// @vitest-environment jsdom
import { act } from "react";
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
import { HealthPage } from "./HealthPage";
import { resetSourceMatrix } from "./sourceReads";

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
    expect(q("sys6-table")).toBeNull();
    await act(async () => { (q("sys6-toggle") as HTMLButtonElement).click(); });
    expect(q("sys6-table")).not.toBeNull();
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
    expect(healthAsOfTitle).toContain("asOf 原文：2026-11-19T15:17:09Z");
    expect(healthAsOfTitle).toContain("换算北京时间：2026-11-19 23:17");
    expect(healthAsOfTitle).toContain("来源：health.payload.asOf");
    expect(healthAsOfTitle).toContain("判据：只取 payload 顶层 ISO");
    expect(healthAsOfTitle).toContain("不使用本机时钟");
    expect(q("sys8-same-source-note")?.textContent).toContain("同源");
    expect(q("sys8-same-source-note")?.textContent).toContain("同一 ISO 值");
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
    await act(async () => { copyButton.click(); await Promise.resolve(); });
    await waitFor(() => q("sys10-copy-status")?.textContent === "已复制", "copied");

    expect(writeText).toHaveBeenCalledTimes(1);
    const text = writeText.mock.calls[0][0] as string;
    const lines = text.trimEnd().split("\n");
    expect(lines[0]).toBe("口径名 | 路径 | 状态 | 耗时 | 采集时刻");
    expect(lines).toHaveLength(5);
    expect(lines[1]).toContain("系统健康清单 | /agent-api/api/health | 成功 | ");
    expect(lines[1]).toMatch(/\| \d+ ms \| 2026-11-19 23:17$/);
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
    expect(q("sys6-asof-health")?.getAttribute("title")).toContain("不是 ISO");
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