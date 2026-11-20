// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({ fetchJSON: (...args: unknown[]) => fetchJSON(...args) }));
vi.mock("@/lib/api-error", () => ({
  ApiError: class ApiError extends Error {
    status: number; requestId?: string;
    constructor(message: string, init: { status: number; body?: string; url?: string; requestId?: string }) { super(message); this.status = init.status; this.requestId = init.requestId; }
  },
}));
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { outlined?: boolean }) => {
    const { outlined, ...rest } = props; void outlined; return <button {...rest}>{children}</button>;
  },
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));
import { HealthPage } from "./HealthPage";
import { ApiError } from "@/lib/api-error";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => {
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  fetchJSON.mockReset(); window.history.replaceState({}, "", "/");
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

async function render() { await act(async () => { root.render(<HealthPage />); }); await act(async () => {}); }

describe("HealthPage", () => {
  it("shows per-source status, source metadata and matching counts", async () => {
    fetchJSON.mockImplementation((url: string) => {
      if (url.includes("__health-probe__")) return Promise.resolve({
        status: "healthy",
        asOf: "2026-11-19T06:00:00Z",
        lastSuccessAt: "2026-11-19T05:50:00Z",
        lastFailureAt: "2026-11-19T04:30:00Z",
        consecutiveSuccesses: 3,
      });
      if (url.includes("hermes-summary")) return Promise.reject(new ApiError("failure", { status: 500, body: "", url, requestId: "req-runtime" }));
      return Promise.resolve({ items: [] });
    });
    await render();
    expect(container.textContent).toContain("正常 2");
    expect(container.textContent).toContain("异常 1");
    expect(container.textContent).toContain("未知 1");
    expect(container.textContent).not.toContain("状态码");
    const row = container.querySelector('[data-testid="hlt5-row-console"]');
    expect(row?.querySelector('[data-testid="hlt5-last-success-console"]')?.textContent).toBe("2026-11-19 13:50");
    expect(row?.querySelector('[data-testid="hlt5-last-failure-console"]')?.textContent).toBe("2026-11-19 12:30");
    expect(row?.querySelector('[data-testid="hlt5-streak-console"]')?.textContent).toBe("3 次");
    expect(row?.querySelector('[data-testid="hlt5-asof-console"]')?.textContent).toBe("2026-11-19 14:00");
    expect(container.querySelector('[data-testid="hlt5-row-bisheng"]')?.textContent).toContain("未知");
  });

  it("marks a network failure unknown and keeps missing metadata as dashes with reasons", async () => {
    fetchJSON.mockImplementation((url: string) => url.includes("hermes-summary") ? Promise.reject(new ApiError("offline", { status: 0, body: "", url })) : Promise.resolve({}));
    await render();
    const row = container.querySelector('[data-testid="hlt5-row-runtime"]');
    expect(row?.textContent).toContain("控制台不可达，无法判定");
    expect(row?.querySelector('[data-testid="hlt5-last-success-runtime"]')?.textContent).toBe("—");
    expect(row?.querySelector('[data-testid="hlt5-last-failure-runtime"]')?.textContent).toBe("—");
    expect(row?.querySelector('[data-testid="hlt5-asof-runtime"]')?.textContent).toBe("—");
    expect(row?.querySelector('[data-testid="hlt5-asof-runtime"]')?.getAttribute("title")).toContain("没有采集时间");
  });

  it("marks Hermes HTTP failures as exceptions without showing a raw status code", async () => {
    fetchJSON.mockImplementation((url: string) => url.includes("hermes-summary")
      ? Promise.reject(new ApiError("failure", { status: 500, body: "", url }))
      : Promise.resolve({}));
    await render();
    const row = container.querySelector('[data-testid="hlt5-row-runtime"]');
    expect(row?.textContent).toContain("异常");
    expect(container.textContent).toContain("上游返回异常，请看接入说明。");
    expect(container.textContent).not.toContain("500");
    expect(row?.querySelector('[data-testid="hlt5-last-failure-runtime"]')?.textContent).not.toBe("—");
  });

  it("renders 403 and 404 with the same neutral body and raw status only in the title", async () => {
    for (const status of [403, 404]) {
      fetchJSON.mockReset();
      fetchJSON.mockImplementation((url: string) => url.includes("hermes-summary")
        ? Promise.reject(new ApiError("missing", { status, body: "", url }))
        : Promise.resolve({}));
      await render();
      const row = container.querySelector('[data-testid="hlt5-row-runtime"]');
      expect(row?.textContent).toContain("接口未接入：这个读取口还没有对控制台开放。");
      expect(row?.getAttribute("title")).toContain(String(status));
      expect(container.textContent).not.toContain(String(status));
      act(() => root.unmount());
      root = createRoot(container);
    }
  });

  it("never substitutes a browser clock for a missing source asOf", async () => {
    fetchJSON.mockImplementation(() => Promise.resolve({}));
    await render();
    const asOf = container.querySelector('[data-testid="hlt5-asof-console"]');
    expect(asOf?.textContent).toBe("—");
    expect(asOf?.getAttribute("title")).toContain("不能用浏览器时间代替");
    expect(container.querySelector('[data-testid="hlt5-streak-console"]')?.textContent).toBe("—");
    expect(container.textContent).not.toMatch(/采集时间：\d{4}/);
  });

  it("shows a copyable full request id and only the short id in the body", async () => {
    const full = "0123456789abcdef0123456789abcdef";
    fetchJSON.mockImplementation((url: string) => url.includes("hermes-summary")
      ? Promise.reject(new ApiError("offline", { status: 0, body: "", url, requestId: full }))
      : Promise.resolve({}));
    await render();
    const row = container.querySelector('[data-testid="hlt5-row-runtime"]');
    expect(row?.textContent).toContain("请求编号：01234567");
    expect(row?.textContent).not.toContain(full);
    expect(row?.querySelector('[data-testid="hlt5-reqid-short"]')?.getAttribute("title")).toBe(full);
    expect(row?.querySelector("button")?.getAttribute("aria-label")).toContain("复制完整请求编号");
  });

  it("shows a whole-page error and retries when every live probe has no response", async () => {
    fetchJSON.mockRejectedValueOnce(new ApiError("offline", { status: 0, body: "", url: "probe", requestId: "req-dead" }))
      .mockRejectedValueOnce(new ApiError("offline", { status: 0, body: "", url: "summary" }))
      .mockRejectedValueOnce(new ApiError("offline", { status: 0, body: "", url: "skills" }))
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    await render();
    expect(container.textContent).toContain("请求编号：req-dead");
    await act(async () => { container.querySelector('[data-testid="hlt5-retry"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    await act(async () => {});
    expect(container.querySelector('[data-testid="hlt5-list"]')).toBeTruthy();
  });


  it("refreshes the service list and all probes once, keeping old data while busy", async () => {
    let phase: "init" | "refresh" = "init";
    const counts = { health: 0, console: 0, runtime: 0, domain: 0 };
    const pending: Array<() => void> = [];
    const payload = (key: keyof typeof counts) => {
      if (key === "health") return { ok: true, asOf: "2026-11-19T06:00:00Z", sources: [{ id: "console", name: "控制台服务", status: "ok" }] };
      if (key === "console") return { status: "healthy", asOf: "2026-11-19T06:00:00Z" };
      if (key === "runtime") return { status: "healthy", asOf: "2026-11-19T06:00:00Z" };
      return { items: [], asOf: "2026-11-19T06:00:00Z" };
    };
    fetchJSON.mockImplementation((url: string) => {
      const key = url.includes("/api/health") ? "health" : url.includes("__health-probe__") ? "console" : url.includes("hermes-summary") ? "runtime" : "domain";
      counts[key] += 1;
      if (phase === "init") return Promise.resolve(payload(key));
      return new Promise((resolve) => { pending.push(() => resolve(payload(key))); });
    });
    await render();
    expect(counts).toEqual({ health: 1, console: 1, runtime: 1, domain: 1 });
    phase = "refresh";
    await act(async () => { (container.querySelector("[data-testid='sys-refresh']") as HTMLButtonElement).click(); });
    expect(container.querySelector("[data-testid='sys-busy-note']")?.textContent).toContain("更新中");
    expect(container.querySelector("[data-testid='sys-refresh']")?.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector("[data-testid='hlt5-list']")).toBeTruthy();
    expect(container.querySelector("[data-testid='sys3-table']")).toBeTruthy();
    await act(async () => { pending.splice(0).forEach((resolve) => resolve()); await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });
    expect(counts).toEqual({ health: 2, console: 2, runtime: 2, domain: 2 });
    expect(container.querySelector("[data-testid='sys-updated-at']")?.textContent).toContain("刷新完成于");
    expect(container.querySelector("[data-testid='sys-updated-at']")?.textContent).toContain("读取时刻");
  });

  it("keeps the old batch and shows a copyable refresh error when the health read fails", async () => {
    let phase: "init" | "refresh" = "init";
    const pending: Array<() => void> = [];
    fetchJSON.mockImplementation((url: string) => {
      if (phase === "init") {
        if (url.includes("/api/health")) return Promise.resolve({ ok: true, asOf: "2026-11-19T06:00:00Z", sources: [{ id: "console", name: "控制台服务", status: "ok" }] });
        return Promise.resolve({ status: "healthy", asOf: "2026-11-19T06:00:00Z" });
      }
      if (url.includes("/api/health")) return Promise.reject(new ApiError("boom", { status: 500, body: "", url, requestId: "req-refresh-500" }));
      return new Promise((resolve) => { pending.push(() => resolve({ status: "healthy", asOf: "2026-11-19T06:00:00Z" })); });
    });
    await render();
    phase = "refresh";
    await act(async () => { (container.querySelector("[data-testid='sys-refresh']") as HTMLButtonElement).click(); });
    await act(async () => { pending.splice(0).forEach((resolve) => resolve()); await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector("[data-testid='sys-refresh-error']")?.textContent).toContain("请求编号");
    expect(container.querySelector("[data-testid='sys-refresh-request-id']")?.textContent).toContain("req-refresh-500");
    expect(container.querySelector("[data-testid='sys-refresh-copy']")).toBeTruthy();
    expect(container.querySelector("[data-testid='sys-updated-at']")).toBeNull();
    expect(container.querySelector("[data-testid='sys3-table']")).toBeTruthy();
    expect(container.querySelector("[data-testid='hlt5-list']")).toBeTruthy();
  });

  it("previews loading and empty without fetching", async () => {
    window.history.replaceState({}, "", "/?state=empty");
    await render();
    expect(fetchJSON).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="hlt5-empty"]')).toBeTruthy();
  });
});
