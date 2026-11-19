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
  it("shows live probe status, unknown pilot and matching counts", async () => {
    fetchJSON.mockImplementation((url: string) => {
      if (url.includes("__health-probe__")) return Promise.resolve({});
      if (url.includes("hermes-summary")) return Promise.reject(new ApiError("failure", { status: 500, body: "", url, requestId: "req-runtime" }));
      return Promise.resolve({ items: [] });
    });
    await render();
    expect(container.textContent).toContain("健康 2");
    expect(container.textContent).toContain("异常 1");
    expect(container.textContent).toContain("未知 1");
    expect(container.textContent).not.toContain("状态码");
    expect(container.querySelector('[data-testid="hlt4-row-runtime"]')?.getAttribute("title")).toContain("500");
    expect(container.textContent).toContain("探针未接入");
  });

  it("marks a network failure unknown and keeps unknown distinct", async () => {
    fetchJSON.mockImplementation((url: string) => url.includes("hermes-summary") ? Promise.reject(new ApiError("offline", { status: 0, body: "", url })) : Promise.resolve({}));
    await render();
    expect(container.textContent).toContain("控制台不可达，无法判定");
    expect(container.querySelector('[data-testid="hlt4-row-bisheng"]')?.textContent).toContain("未知");
  });

  it("marks Hermes HTTP failures as exceptions without showing a raw status code", async () => {
    fetchJSON.mockImplementation((url: string) => url.includes("hermes-summary")
      ? Promise.reject(new ApiError("failure", { status: 500, body: "", url }))
      : Promise.resolve({}));
    await render();
    expect(container.querySelector('[data-testid="hlt4-row-runtime"]')?.textContent).toContain("异常");
    expect(container.textContent).toContain("上游返回异常，请看接入说明。");
    expect(container.textContent).not.toContain("500");
  });


  it("renders a missing read endpoint as not connected, with the raw status only in the title", async () => {
    fetchJSON.mockImplementation((url: string) => url.includes("hermes-summary")
      ? Promise.reject(new ApiError("missing", { status: 404, body: "", url }))
      : Promise.resolve({}));
    await render();
    const row = container.querySelector('[data-testid="hlt4-row-runtime"]');
    expect(row?.textContent).toContain("接口未接入");
    expect(row?.getAttribute("title")).toContain("404");
    expect(container.textContent).not.toContain("404");
  });

  it("writes an explicit unknown time and shows only the short request id, full id in title", async () => {
    const full = "0123456789abcdef0123456789abcdef";
    fetchJSON.mockImplementation((url: string) => url.includes("hermes-summary")
      ? Promise.reject(new ApiError("offline", { status: 0, body: "", url, requestId: full }))
      : Promise.resolve({}));
    await render();
    const row = container.querySelector('[data-testid="hlt4-row-runtime"]');
    expect(row?.textContent).toContain("控制台不可达");
    expect(row?.textContent).toContain("采集时刻：时间未知（本次没有收到可记录的时间）");
    expect(row?.textContent).not.toContain("—（未采集）");
    expect(row?.textContent).toContain("请求编号：01234567");
    expect(row?.textContent).not.toContain(full);
    expect(row?.querySelector('[data-testid="hlt4-reqid-short"]')?.getAttribute("title")).toBe(full);
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
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("重试"))?.click(); });
    await act(async () => {});
    expect(container.querySelector('[data-testid="hlt4-list"]')).toBeTruthy();
  });
});
