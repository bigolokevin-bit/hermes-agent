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

beforeEach(() => {
  api.fetchJSON.mockReset();
  window.history.replaceState({}, "", "/");
});
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
    expect(container.querySelector("[data-testid='sys5-count-normal']")?.textContent).toContain("1");
    expect(container.querySelector("[data-testid='sys5-count-degraded']")?.textContent).toContain("1");
    expect(container.querySelector("[data-testid='sys5-count-unreachable']")?.textContent).toContain("1");
    expect(container.querySelector("[data-testid='sys5-count-unknown']")?.textContent).toContain("0");
    expect(container.querySelector("[data-testid='sys3-scrollhint']")?.textContent).toContain("左右滑动查看全部列");
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
      for (const key of ["normal", "degraded", "unreachable", "unknown"]) {
        const count = container.querySelector(`[data-testid='sys5-count-${key}']`)!;
        expect(count.textContent).toContain("—");
        expect(count.getAttribute("title")).toContain("读口未接入");
      }
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
    for (const key of ["normal", "degraded", "unreachable", "unknown"]) {
      const count = container.querySelector(`[data-testid='sys5-count-${key}']`)!;
      expect(count.textContent).toContain("0");
      expect(count.getAttribute("title")).toContain("空清单");
    }
  });

  it("counts from the same response and filters the list locally without another request", async () => {
    api.fetchJSON.mockResolvedValue(HEALTH);
    await render();
    await waitFor(() => !!container.querySelector("[data-testid='sys3-table']"), "table");
    expect(api.fetchJSON).toHaveBeenCalledTimes(1);
    const before = window.location.search;

    const normal = container.querySelector<HTMLButtonElement>("[data-testid='sys5-count-normal']")!;
    await act(async () => normal.click());
    expect(normal.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelectorAll("[data-testid^='sys3-row-']")).toHaveLength(1);
    expect(container.querySelector("[data-testid='sys3-row-console']")).toBeTruthy();
    expect(container.querySelector("[data-testid='sys3-row-runtime']")).toBeNull();
    expect(container.querySelector("[data-testid='sys5-filter-note']")?.textContent).toContain("已筛：正常 · 1 项");
    expect(window.location.search).toBe(before);
    expect(api.fetchJSON).toHaveBeenCalledTimes(1);

    await act(async () => normal.click());
    expect(normal.getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelectorAll("[data-testid^='sys3-row-']")).toHaveLength(3);
    expect(api.fetchJSON).toHaveBeenCalledTimes(1);

    const unknown = container.querySelector<HTMLButtonElement>("[data-testid='sys5-count-unknown']")!;
    await act(async () => unknown.click());
    expect(container.querySelector("[data-testid='sys5-filter-empty']")?.textContent).toContain("不补服务行");
    expect(container.querySelector("[data-testid='sys3-table']")).toBeNull();
    await act(async () => (container.querySelector("[data-testid='sys5-clear']") as HTMLButtonElement).click());
    expect(container.querySelectorAll("[data-testid^='sys3-row-']")).toHaveLength(3);
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

describe("SystemHealthSurface row detail", () => {
  const DETAIL = {
    ok: true,
    asOf: "2026-11-19T15:17:09Z",
    sources: [
      {
        id: "console",
        name: "控制台服务(BFF)",
        state: "ok",
        version: "4.2.1",
        latencyMs: 12,
        lastError: "token=abc123 cookie=sess456 api_key=sk-secret99 request failed",
      },
      { id: "runtime", name: "Hermes 运行时", state: "degraded", latencyMs: 47 },
    ],
  };

  it("opens one row detail with read path, basis, check time, latency and a redacted error summary", async () => {
    api.fetchJSON.mockResolvedValue(DETAIL);
    await render();
    await waitFor(() => !!container.querySelector("[data-testid='sys3-table']"), "table");
    const before = window.location.search;
    const first = container.querySelector<HTMLElement>("[data-testid='sys3-row-console']")!;
    await act(async () => first.click());
    const detail = container.querySelector("[data-testid='sys4-detail-console']")!;
    expect(detail.textContent).toContain("控制台服务(BFF)");
    expect(detail.querySelector("[data-testid='sys4-endpoint']")?.textContent).toBe("/agent-api/api/health");
    expect(detail.querySelector("[data-testid='sys4-basis']")?.textContent).toContain("健康接口报告该服务为正常");
    expect(detail.querySelector("[data-testid='sys4-checked']")?.textContent).toBe("2026-11-19 23:17");
    expect(detail.querySelector("[data-testid='sys4-latency']")?.textContent).toBe("12 ms");
    const error = detail.querySelector("[data-testid='sys4-error']")!;
    expect(error.textContent).toContain("***");
    expect(error.textContent).toContain("已脱敏 3 处");
    expect(error.textContent).not.toContain("abc123");
    expect(error.textContent).not.toContain("sess456");
    expect(error.textContent).not.toContain("sk-secret99");
    expect(window.location.search).toBe(before);

    const second = container.querySelector<HTMLElement>("[data-testid='sys3-row-runtime']")!;
    await act(async () => second.click());
    expect(container.querySelectorAll("[data-testid^='sys4-detail-row-']")).toHaveLength(1);
    expect(container.querySelector("[data-testid='sys4-detail-runtime']")).toBeTruthy();
    expect(container.querySelector("[data-testid='sys4-detail-console']")).toBeNull();
    expect(container.querySelector("[data-testid='sys4-detail-runtime'] [data-testid='sys4-error']")?.textContent).toContain("该字段未返回");
    expect(container.querySelector("[data-testid='sys4-detail-runtime'] [data-testid='sys4-error']")?.getAttribute("title")).toContain("没有给出最近一次错误摘要");
  });

  it("truncates long list values with the full title and shows the full value in the expanded row", async () => {
    const longName = "控制台服务（BFF）生产环境主接入网关与健康探针聚合节点";
    const longVersion = "2026.11.20-build-very-long-commit-abcdef1234567890";
    api.fetchJSON.mockResolvedValue({
      ok: true,
      asOf: "2026-11-19T15:17:09Z",
      sources: [
        {
          id: "long",
          name: longName,
          state: "ok",
          version: longVersion,
          lastError: "token=long-secret request failed",
        },
      ],
    });
    await render();
    await waitFor(() => !!container.querySelector("[data-testid='sys3-table']"), "table");

    const name = container.querySelector<HTMLElement>("[data-testid='sys15-trunc-name']")!;
    expect(name.className).toContain("sys15-trunc");
    expect(name.textContent).toBe(longName);
    expect(name.closest("[data-testid='sys3-name']")?.getAttribute("title")).toBe(longName);
    const version = container.querySelector<HTMLElement>("[data-testid='sys15-trunc-version']")!;
    expect(version.className).toContain("sys15-trunc");
    expect(version.textContent).toBe(longVersion);
    expect(version.closest("[data-testid='sys3-version']")?.getAttribute("title")).toBe(longVersion);

    await act(async () => { (container.querySelector("[data-testid='sys3-row-long']") as HTMLElement).click(); });
    const fullService = container.querySelector<HTMLElement>("[data-testid='sys15-full-service']")!;
    expect(fullService.className).toContain("sys15-full");
    expect(fullService.textContent).toBe(longName);
    expect(container.querySelector<HTMLElement>("[data-testid='sys15-full-endpoint']")?.className).toContain("sys15-full");
    expect(container.querySelector("[data-testid='sys15-full-endpoint']")?.textContent).toBe("/agent-api/api/health");
    const error = container.querySelector<HTMLElement>("[data-testid='sys15-full-error']")!;
    expect(error.className).toContain("sys15-full");
    expect(error.textContent).toContain("***");
    expect(error.textContent).not.toContain("long-secret");
    expect(container.querySelector("[data-testid='sys4-redacted']")?.textContent).toContain("已脱敏 1 处");
    expect(api.fetchJSON).toHaveBeenCalledTimes(1);
  });

  it("opens with Enter, closes with Escape and leaves the URL untouched", async () => {
    api.fetchJSON.mockResolvedValue(DETAIL);
    await render();
    await waitFor(() => !!container.querySelector("[data-testid='sys3-table']"), "table");
    const first = container.querySelector<HTMLElement>("[data-testid='sys3-row-console']")!;
    await act(async () => {
      first.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(container.querySelector("[data-testid='sys4-detail-console']")).toBeTruthy();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(container.querySelector("[data-testid='sys4-detail-console']")).toBeNull();
    expect(window.location.search).toBe("");
  });
});

describe("SystemHealthSurface svc deep link", () => {
  it("opens the matching row, marks it current, scrolls it into view and clears only svc on close", async () => {
    const scroll = vi.fn();
    const proto = HTMLElement.prototype as unknown as { scrollIntoView?: (arg?: ScrollIntoViewOptions) => void };
    const original = proto.scrollIntoView;
    proto.scrollIntoView = scroll;
    try {
      api.fetchJSON.mockResolvedValue(HEALTH);
      window.history.replaceState({}, "", "/#/system?tab=health&ssort=state&sdir=desc&svc=console");
      await render();
      await waitFor(() => !!container.querySelector("[data-testid='sys4-detail-console']"), "deep-link detail");

      const row = container.querySelector<HTMLElement>("[data-testid='sys3-row-console']")!;
      expect(row.getAttribute("aria-current")).toBe("true");
      expect(row.className).toContain("is-svc-target");
      expect(container.querySelector("[data-testid='sys14-link-target']")?.textContent).toContain("控制台服务(BFF)");
      await waitFor(() => scroll.mock.calls.length > 0, "scrollIntoView");
      expect(api.fetchJSON).toHaveBeenCalledTimes(1);

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      });
      expect(container.querySelector("[data-testid='sys4-detail-console']")).toBeNull();
      expect(window.location.hash).toBe("#/system?tab=health&ssort=state&sdir=desc");
      expect(window.location.hash).not.toContain("svc=");
      expect(api.fetchJSON).toHaveBeenCalledTimes(1);
    } finally {
      if (original) proto.scrollIntoView = original;
      else delete proto.scrollIntoView;
    }
  });

  it("matches a service by its human name", async () => {
    api.fetchJSON.mockResolvedValue(HEALTH);
    window.history.replaceState({}, "", `/#/system?tab=health&svc=${encodeURIComponent("Hermes 运行时")}`);
    await render();
    await waitFor(() => !!container.querySelector("[data-testid='sys4-detail-runtime']"), "named deep link");
    expect(container.querySelector("[data-testid='sys3-row-runtime']")?.getAttribute("aria-current")).toBe("true");
    expect(api.fetchJSON).toHaveBeenCalledTimes(1);
  });

  it("shows a human missing notice without inventing a row, and clearing keeps other params", async () => {
    api.fetchJSON.mockResolvedValue(HEALTH);
    window.history.replaceState({}, "", "/#/system?tab=health&ssort=ms&sdir=asc&svc=ghost");
    await render();
    await waitFor(() => !!container.querySelector("[data-testid='sys14-link-missing']"), "missing notice");
    const notice = container.querySelector("[data-testid='sys14-link-missing']")!;
    expect(notice.textContent).toContain("该服务不在当前清单里");
    expect(notice.textContent).toContain("ghost");
    expect(notice.textContent).toContain("没有匹配");
    expect(notice.getAttribute("title")).toBe("GAP-SYS14-01");
    expect(container.querySelectorAll("[data-testid^='sys3-row-']")).toHaveLength(3);
    expect(api.fetchJSON).toHaveBeenCalledTimes(1);

    await act(async () => {
      (container.querySelector("[data-testid='sys14-link-clear']") as HTMLAnchorElement).click();
    });
    expect(container.querySelector("[data-testid='sys14-link-missing']")).toBeNull();
    expect(window.location.hash).toBe("#/system?tab=health&ssort=ms&sdir=asc");
    expect(api.fetchJSON).toHaveBeenCalledTimes(1);
  });

  it("explains that an unavailable read port cannot locate the requested service", async () => {
    api.fetchJSON.mockRejectedValue(new ApiError("failed", { status: 404, body: "{}", url: "/agent-api/api/health", requestId: "req-sys14" }));
    window.history.replaceState({}, "", "/#/system?tab=health&svc=console");
    await render();
    await waitFor(() => !!container.querySelector("[data-testid='sys3-gap']"), "gap");
    const notice = container.querySelector("[data-testid='sys14-link-missing']")!;
    expect(notice.textContent).toContain("该服务不在当前清单里");
    expect(notice.textContent).toContain("健康读口未接入");
    expect(notice.textContent).toContain("console");
    expect(notice.getAttribute("title")).toBe("GAP-SYS14-01");
    expect(api.fetchJSON).toHaveBeenCalledTimes(1);
  });
});
