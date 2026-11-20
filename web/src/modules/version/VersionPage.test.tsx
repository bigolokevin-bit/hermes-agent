// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));
import { VersionPage } from "./VersionPage";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => {
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  vi.stubEnv("VITE_BUILD_IDENTITY", "");
  vi.stubEnv("VITE_BUILD_REF", "");
  vi.stubEnv("VITE_BUILD_COMMIT", "");
  vi.stubEnv("VITE_BUILD_TIME", "");
  window.history.replaceState({}, "", "/");
  stubFetch(() => json({ prices: [] }));
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
async function render() { await act(async () => { root.render(<VersionPage />); }); await act(async () => {}); }

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

function stubFetch(handler: (url: string) => Response): void {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes("/agent-api/api/version")) return Promise.resolve(json({ components: [] }));
    if (url.includes("/agent-api/api/health")) return Promise.resolve(json({ ok: true, asOf: "2026-11-19T16:00:00Z", sources: [] }));
    return Promise.resolve(handler(url));
  }));
}

describe("VersionPage", () => {
  it("shows unknown with an explanation when build metadata is not injected", async () => {
    await render();
    expect(container.querySelector('[data-testid="ver4-page"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="ver4-build-rows"]')?.textContent).toContain("未知");
    expect(container.textContent).toContain("构建时没有写入这项信息；请让发布流程补齐构建标识");
    expect(container.textContent).not.toContain("0.0.0");
    const controls = [...container.querySelectorAll("button, input, select, textarea")];
    // The real copy control is read-only; every write-shaped control stays planned.
    const planned = controls.filter((el) => el.getAttribute("data-testid") !== "ver-copy" && el.getAttribute("data-testid") !== "sys-refresh");
    expect(planned.every((el) => el.getAttribute("data-planned") === "1" && el.getAttribute("aria-disabled") === "true")).toBe(true);
    expect(container.querySelector('[data-testid="ver4-planned-export"]')?.getAttribute("title")).toContain("还没有接上");
  });


  it("refreshes the version surface and price table once each, keeping old data while busy", async () => {
    let phase: "init" | "refresh" = "init";
    const calls = { health: 0, pricing: 0 };
    const pending: Array<() => void> = [];
    const health = () => json({ ok: true, asOf: "2026-11-19T16:00:00Z", sources: [{ id: "console", name: "控制台服务", status: "ok", version: "9.9.9" }] });
    const pricing = () => json({ prices: [{ modelId: "m1", label: "模型一", provider: "提供方", inputPerMillion: 1, outputPerMillion: 2, asOf: "2026-11-19T15:00:00Z" }] });
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const key = url.includes("/api/health") ? "health" : url.includes("/api/models/pricing") ? "pricing" : null;
      if (!key) return Promise.resolve(json({ components: [] }));
      calls[key] += 1;
      if (phase === "init") return Promise.resolve(key === "health" ? health() : pricing());
      return new Promise((resolve) => { pending.push(() => resolve(key === "health" ? health() : pricing())); });
    }));
    await render();
    expect(calls).toEqual({ health: 1, pricing: 1 });
    expect(container.querySelector("[data-testid='ver5-table']")).toBeTruthy();
    expect(container.querySelector("[data-testid='ver4-price-table']")).toBeTruthy();
    phase = "refresh";
    await act(async () => { (container.querySelector("[data-testid='sys-refresh']") as HTMLButtonElement).click(); });
    expect(container.querySelector("[data-testid='sys-busy-note']")?.textContent).toContain("更新中");
    expect(container.querySelector("[data-testid='ver5-table']")).toBeTruthy();
    expect(container.querySelector("[data-testid='ver4-price-table']")).toBeTruthy();
    await act(async () => { pending.splice(0).forEach((resolve) => resolve()); await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });
    expect(calls).toEqual({ health: 2, pricing: 2 });
    expect(container.querySelector("[data-testid='sys-updated-at']")?.textContent).toContain("刷新完成于");
  });

  it("renders injected values and formats the build time in Beijing time", async () => {
    vi.stubEnv("VITE_BUILD_IDENTITY", "build-20261118");
    vi.stubEnv("VITE_BUILD_REF", "release-candidate");
    vi.stubEnv("VITE_BUILD_COMMIT", "0123456789abcdef");
    vi.stubEnv("VITE_BUILD_TIME", "2026-11-18T16:30:00Z");
    await render();
    expect(container.textContent).toContain("build-20261118");
    expect(container.textContent).toContain("release-candidate");
    expect(container.textContent).toContain("01234567");
    expect(container.textContent).toContain("2026-11-19 00:30");
    expect(container.querySelector('[data-testid="ver4-build-rows"] [title="0123456789abcdef"]')).toBeTruthy();
  });

  it("switches the whole error state from ?state= and retries into content", async () => {
    window.history.replaceState({}, "", "/?state=error");
    await render();
    const error = container.querySelector('[data-testid="ver4-error"]');
    expect(error).toBeTruthy();
    expect(error?.textContent).toContain("本地版本信息暂不可用");
    expect(error?.textContent).toContain("请求编号");
    expect(container.querySelector('[data-testid="ver4-dep-react"]')).toBeNull();
    await act(async () => {
      (container.querySelector('[data-testid="ver4-retry"]') as HTMLButtonElement).click();
    });
    expect(container.querySelector('[data-testid="ver4-error"]')).toBeNull();
    expect(container.querySelector('[data-testid="ver4-dep-react"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="ver4-dep-vite"]')).toBeTruthy();
  });

  it("renders the price table with USD and asOf, separately from spend", async () => {
    stubFetch(() => json({
      prices: [
        {
          modelId: "m1",
          label: "DeepSeek V3",
          provider: "deepseek",
          inputPerMillion: 0.14,
          outputPerMillion: 0.28,
          currency: "USD",
          asOf: "2026-11-19T02:00:00Z",
        },
      ],
    }));
    await render();
    expect(container.querySelector('[data-testid="ver4-price-table"]')?.textContent).toContain("DeepSeek V3");
    expect(container.textContent).toContain("$0.14 / 百万 token");
    expect(container.textContent).toContain("2026-11-19 10:00");
    expect(container.textContent).not.toContain("$0.00");
    expect(container.textContent).toContain("不用单价乘次数推算");
  });

  it("turns a non-JSON page into a human message, never a parser error", async () => {
    stubFetch(() => new Response("<!doctype html><html><body>SPA</body></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    }));
    await render();
    const block = container.querySelector('[data-testid="ver4-prices-error"]')?.textContent ?? "";
    expect(block).toContain("页面，不是数据");
    expect(block).toContain("请求编号：未提供");
    expect(block).not.toContain("Unexpected token");
    expect(block).not.toContain("<!doctype");
  });

  it("offers the four-state empty preview without inventing data", async () => {
    window.history.replaceState({}, "", "/?state=empty");
    await render();
    expect(container.querySelector('[data-testid="ver4-empty"]')?.textContent).toContain("这项信息未提供");
  });
  it("uses one neutral price body for 403 and 404 with a copyable request id", async () => {
    const bodies: string[] = [];
    for (const status of [403, 404]) {
      stubFetch(() => json({ code: "console.forbidden" }, status, { "x-console-request-id": "req-ver-1" }));
      await render();
      const block = container.querySelector('[data-testid="ver4-prices-error"]');
      bodies.push(block?.textContent ?? "");
      expect(block?.textContent).toContain("单价表未接入");
      expect(block?.textContent).toContain("req-ver-1");
      expect(block?.getAttribute("title")).toBe("GAP-07");
      expect(block?.textContent).not.toContain("/api/");
      expect(block?.querySelector('[data-testid="ver4-prices-retry"]')).toBeTruthy();
    }
    expect(bodies[0]).toBe(bodies[1]);
  });

});
