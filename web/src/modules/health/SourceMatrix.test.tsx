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

    expect(q("sys6-name-health")?.textContent).toBe("系统健康清单");
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
    expect(q("sys6-asof-health")?.getAttribute("title")).toContain("不是 ISO");
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