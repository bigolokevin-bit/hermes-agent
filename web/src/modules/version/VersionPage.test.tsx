// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
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
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ prices: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
async function render() { await act(async () => { root.render(<VersionPage />); }); await act(async () => {}); }

describe("VersionPage", () => {
  it("shows unknown with an explanation when build metadata is not injected", async () => {
    await render();
    expect(container.querySelector('[data-testid="ver4-page"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="ver4-build-rows"]')?.textContent).toContain("未知");
    expect(container.textContent).toContain("构建时没有写入这项信息；请让发布流程补齐构建标识");
    expect(container.textContent).not.toContain("0.0.0");
    expect([...container.querySelectorAll("button, input, select, textarea")]).toHaveLength(0);
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

  it("renders the price table with USD and asOf, separately from spend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
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
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    await render();
    expect(container.querySelector('[data-testid="ver4-price-table"]')?.textContent).toContain("DeepSeek V3");
    expect(container.textContent).toContain("$0.14 / 百万 token");
    expect(container.textContent).toContain("2026-11-19 10:00");
    expect(container.textContent).not.toContain("$0.00");
    expect(container.textContent).toContain("不用单价乘次数推算");
  });

  it("turns a non-JSON page into a human message, never a parser error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<!doctype html><html><body>SPA</body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );
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
});
