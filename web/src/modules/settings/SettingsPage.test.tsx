// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({ fetchJSON: (...args: unknown[]) => fetchJSON(...args) }));
vi.mock("@/lib/api-error", () => ({
  ApiError: class ApiError extends Error {
    status: number; requestId?: string;
    constructor(message: string, init: { status: number; requestId?: string }) { super(message); this.status = init.status; this.requestId = init.requestId; }
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
import { SettingsPage } from "./SettingsPage";
import { ApiError } from "@/lib/api-error";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => {
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  fetchJSON.mockReset(); window.history.replaceState({}, "", "/");
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
async function render() { await act(async () => { root.render(<SettingsPage />); }); await act(async () => {}); }

describe("SettingsPage", () => {
  it("shows unavailable config as explicit read-only unknown state", async () => {
    fetchJSON.mockRejectedValue(new ApiError("missing", { status: 404, body: "", url: "config", requestId: "req-config" }));
    await render();
    expect(container.querySelector('[data-testid="set4-switch-approval"]')?.textContent).toContain("未启用");
    expect(container.querySelector('[data-testid="set4-switch-chat"]')?.textContent).toContain("未启用");
    expect(container.textContent).toContain("配置自检尚未接入，该项未启用");
    expect(container.textContent).toContain("上游连通自检");
    expect(container.textContent).toContain("配置自检尚未接入，该项未启用");
    expect(container.textContent).not.toContain("CR-M2-02");
    expect(container.textContent).not.toContain("HTTP");
    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect([...container.querySelectorAll("a")].every((link) => ["#/system", "#/employees"].includes(link.getAttribute("href") ?? ""))).toBe(true);
  });

  it("shows server-provided three-state values without writing controls", async () => {
    fetchJSON.mockResolvedValue({ writeSwitches: { approval: true, chat: null }, upstreams: [{ name: "Hermes", state: "disabled" }] });
    await render();
    expect(container.querySelector('[data-testid="set4-switch-approval"]')?.textContent).toContain("已开启");
    expect(container.querySelector('[data-testid="set4-switch-chat"]')?.textContent).toContain("未知（本次未能读取）");
    expect(container.querySelector('[data-testid="set4-upstreams"]')?.textContent).toContain("未开启");
    expect([...container.querySelectorAll("button")].some((button) => /保存|重置|开关/.test(button.textContent ?? ""))).toBe(false);
  });

  it("shows request id and retries on a server error", async () => {
    fetchJSON.mockRejectedValueOnce(new ApiError("failed", { status: 500, body: "", url: "config", requestId: "req-config-500" })).mockResolvedValueOnce({ writeSwitches: { approval: true, chat: false }, upstreams: [] });
    await render();
    expect(container.querySelector('[data-testid="set4-error"]')?.textContent).toContain("req-config-500");
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("重试"))?.click(); });
    await act(async () => {});
    expect(container.querySelector('[data-testid="set4-content"]')).toBeTruthy();
  });

  it("renders an empty state when the config schema explicitly has no items", async () => {
    fetchJSON.mockResolvedValue({ items: [] });
    await render();
    expect(container.querySelector('[data-testid="set4-empty"]')).toBeTruthy();
  });
});
