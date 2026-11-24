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
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { outlined?: boolean }) => {
    const { outlined, ...rest } = props; void outlined; return <button {...rest}>{children}</button>;
  },
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Switch: ({ checked, disabled, ...rest }: { checked?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button role="switch" aria-checked={checked} disabled={disabled} {...rest} />
  ),
  Select: ({ children, value, disabled }: { children?: React.ReactNode; value?: string; disabled?: boolean }) => (
    <button type="button" role="combobox" disabled={disabled} data-value={value}>{value}{children}</button>
  ),
  SelectOption: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));
import { SettingsPage } from "./SettingsPage";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => {
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  fetchJSON.mockReset(); window.history.replaceState({}, "", "/");
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
async function render() { await act(async () => { root.render(<SettingsPage />); }); await act(async () => {}); }

function liveReads() {
  fetchJSON.mockImplementation((url: string) => {
    if (url.includes("/api/hermes-summary")) {
      return Promise.resolve({
        gateway: {
          platform: "hermes-agent",
          version: "unknown",
          gateway_state: "running",
          status: "ok",
          active_agents: 0,
          updated_at: "2026-11-24T09:00:27Z",
        },
      });
    }
    return Promise.resolve({
      asOf: "2026-11-24T09:00:31Z",
      sources: [
        { id: "console", port: 8092, state: "ok" },
        { id: "runtime", port: 8103, state: "down" },
        { id: "bisheng", port: 7860, state: "ok" },
      ],
    });
  });
}

const val = (key: string) =>
  (container.querySelector(`[data-testid="set5-ctl-${key}"]`) as HTMLInputElement | null)?.value;

describe("SettingsPage", () => {
  it("renders a skeleton-shaped read-only form: toolbar + 13 cards, every control disabled", async () => {
    liveReads();
    await render();
    const cards = container.querySelectorAll('[data-testid^="set5-card-"]');
    expect(cards.length).toBeGreaterThanOrEqual(10);
    expect(container.querySelector('[data-testid="set5-save"]')).toHaveProperty("disabled", true);
    expect(container.querySelector('[data-testid="set5-reset"]')).toHaveProperty("disabled", true);
    // 每个块 2–5 行。
    for (const card of cards) {
      const rows = card.querySelectorAll(".set5-field");
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows.length).toBeLessThanOrEqual(5);
    }
    // 控件一律 disabled（input / switch / select），没有可点的写控件。
    const controls = [...container.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
      'input, button[role="switch"], button[role="combobox"]',
    )];
    expect(controls.length).toBeGreaterThan(30);
    expect(controls.every((control) => control.disabled)).toBe(true);
  });

  it("fills real values from runtime summary and service probe", async () => {
    liveReads();
    await render();
    // 平台工程标识转人话，原值不上屏。
    expect(val("runtime-platform")).toBe("Hermes 运行时");
    expect(val("runtime-gateway")).toBe("运行中");
    expect(val("runtime-status")).toBe("正常");
    expect(val("runtime-active")).toBe("0");
    // 版本上游报 unknown → 未读到，不编版本号。
    expect(val("runtime-version")).toBe("未读到");
    // 真端口与连通态。
    expect(val("source-console")).toBe("8092 · 正常");
    expect(val("source-runtime")).toBe("8103 · 探测失败");
    expect(val("source-bisheng")).toBe("7860 · 正常");
  });

  it("keeps engineering enums off screen and has no em dash / tablist", async () => {
    liveReads();
    await render();
    const text = container.textContent ?? "";
    expect(text).not.toContain("hermes-agent");
    expect(text).not.toContain("running");
    expect(text).not.toContain("—");
    expect(container.querySelector('[role="tablist"]')).toBeNull();
    expect(container.querySelectorAll("[data-fixture]")).toHaveLength(0);
    expect(container.querySelector("h2")?.textContent).toContain("默认设置");
  });

  it("says 未读到 (not zero) when both read ports fail", async () => {
    fetchJSON.mockRejectedValue(new Error("down"));
    await render();
    expect(val("runtime-platform")).toBe("未读到");
    expect(val("source-console")).toBe("未读到");
    expect(container.textContent).toContain("数据可用性");
    expect(container.textContent).toContain("不代表 0 或停止");
  });

  it("shows 读取中 while the read ports are still pending", async () => {
    fetchJSON.mockImplementation(() => new Promise(() => {}));
    await render();
    expect(val("runtime-platform")).toBe("读取中…");
    expect(container.querySelector('[data-testid="set5-caliber"]')?.textContent).toContain("读取中…");
  });
});