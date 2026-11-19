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
import { SystemHealthSurface } from "./SystemHealthSurface";

let root: Root | null = null;
let container: HTMLDivElement;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const text = () => container.textContent ?? "";

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 2500) throw new Error(`waitFor: ${label}`);
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
  }
}

async function render(preview?: "loading" | "empty" | "error") {
  await act(async () => { root?.unmount(); });
  document.body.replaceChildren();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => { root?.render(<SystemHealthSurface preview={preview ?? null} />); });
}

const HEALTH = {
  schema: "console.health.sources.v1",
  ok: true,
  asOf: "2026-11-19T15:17:09Z",
  sources: [
    { id: "console", name: "控制台服务(BFF)", state: "ok", version: "4.2.1", latencyMs: 12 },
    { id: "runtime", name: "Hermes 运行时", state: "degraded", latencyMs: 47 },
    { id: "bisheng", name: "毕昇知识库", state: "down" },
  ],
};

beforeEach(() => { api.fetchJSON.mockReset(); });
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

describe("SystemHealthSurface", () => {
  it("renders service rows with human status, top-level check time and missing reasons", async () => {
    api.fetchJSON.mockResolvedValue(HEALTH);
    await render();
    await waitFor(() => !!container.querySelector("[data-testid='sys3-table']"), "table");
    expect(container.querySelectorAll("[data-testid^='sys3-row-']")).toHaveLength(3);
    expect(text()).toContain("正常");
    expect(text()).toContain("降级");
    expect(text()).toContain("不可达");
    expect(text()).toContain("2026-11-19 23:17");
    expect(container.querySelector("[data-testid='sys3-overall']")?.textContent).toBe("正常");
    const runtime = container.querySelector("[data-testid='sys3-row-runtime']")!;
    expect(runtime.querySelector("[data-testid='sys3-version']")?.textContent).toBe("—");
    expect(runtime.querySelector("[data-testid='sys3-version']")?.getAttribute("title")).toContain("没有给出该服务的版本");
    expect(runtime.querySelector("[data-testid='sys3-latency']")?.textContent).toBe("47 ms");
    const bisheng = container.querySelector("[data-testid='sys3-row-bisheng']")!;
    expect(bisheng.querySelector("[data-testid='sys3-latency']")?.textContent).toBe("—");
    expect(bisheng.querySelector("[data-testid='sys3-latency']")?.getAttribute("title")).toContain("没有给出响应耗时");
  });

  it("uses 403 and 404 with the same neutral not-wired body", async () => {
    const bodies: string[] = [];
    for (const [status, rid] of [[403, "req-sys-gap"], [404, "req-sys-gap"]] as const) {
      api.fetchJSON.mockRejectedValue(new ApiError("failed", { status, body: "{}", url: "/agent-api/api/health", requestId: rid }));
      await render();
      await waitFor(() => !!container.querySelector("[data-testid='sys3-gap']"), "gap");
      const gap = container.querySelector("[data-testid='sys3-gap']")!;
      bodies.push(gap.textContent ?? "");
      expect(gap.getAttribute("title")).toBe("GAP-SYS3-01");
      expect(gap.textContent).toContain("健康读口未接入");
      expect(gap.textContent).toContain(rid);
      expect(gap.textContent).not.toContain("403");
      expect(gap.textContent).not.toContain("404");
      expect(container.querySelector("[data-testid='sys3-apply']")?.getAttribute("href")).toBe("#/approvals");
    }
    expect(bodies[0]).toBe(bodies[1]);
  });

  it("shows a human error, copyable request id and a working retry on 500", async () => {
    api.fetchJSON
      .mockRejectedValueOnce(new ApiError("failed", { status: 500, body: "{}", url: "/agent-api/api/health", requestId: "req-sys-500" }))
      .mockResolvedValueOnce(HEALTH);
    await render();
    await waitFor(() => !!container.querySelector("[data-testid='sys3-error']"), "error");
    expect(text()).toContain("健康清单暂时读不出来");
    expect(text()).toContain("req-sys-500");
    expect(text()).not.toContain("HTTP");
    await act(async () => { (container.querySelector("[data-testid='sys3-retry']") as HTMLButtonElement).click(); });
    await waitFor(() => !!container.querySelector("[data-testid='sys3-table']"), "table");
  });

  it("shows an empty list without inventing a green verdict", async () => {
    api.fetchJSON.mockResolvedValue({ ok: true, asOf: "2026-11-19T15:17:09Z", sources: [] });
    await render();
    await waitFor(() => !!container.querySelector("[data-testid='sys3-empty']"), "empty");
    expect(text()).toContain("健康接口返回了空清单");
    expect(text()).toContain("不补服务行");
    expect(container.querySelectorAll("[data-testid^='sys3-row-']")).toHaveLength(0);
    expect(container.querySelector("[data-testid='sys3-table']")).toBeNull();
  });

  it("keeps the top-level asOf as the only check time and never uses the browser clock", async () => {
    api.fetchJSON.mockResolvedValue({ ok: true, sources: [{ id: "console", name: "控制台", state: "ok" }] });
    await render();
    await waitFor(() => !!container.querySelector("[data-testid='sys3-table']"), "table");
    const checked = container.querySelector("[data-testid='sys3-checked']")!;
    expect(checked.textContent).toBe("—");
    expect(checked.getAttribute("title")).toContain("没有给出顶层采集时刻");
    expect(text()).not.toMatch(/2026-\d\d-\d\d \d\d:\d\d/);
  });

  it("renders preview states without a request and keeps the write control planned", async () => {
    await render("error");
    expect(container.querySelector("[data-testid='sys3-error']")).toBeTruthy();
    expect(api.fetchJSON).not.toHaveBeenCalled();
    const planned = container.querySelector<HTMLButtonElement>("[data-testid='sys3-planned-edit']")!;
    expect(planned.disabled).toBe(false);
    expect(planned.getAttribute("data-planned")).toBe("1");
    expect(planned.getAttribute("aria-disabled")).toBe("true");
    expect(planned.getAttribute("title")).toContain("还没有探针写入口");

    api.fetchJSON.mockClear();
    await render("empty");
    expect(container.querySelector("[data-testid='sys3-empty']")).toBeTruthy();
    expect(api.fetchJSON).not.toHaveBeenCalled();
  });
});
