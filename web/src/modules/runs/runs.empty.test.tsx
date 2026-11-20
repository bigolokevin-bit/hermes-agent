// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { RunsModulePage } from "./RunsModulePage";
import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn(() => Promise.resolve(true)) }));

vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clip.copyTextToClipboard }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function LocationProbe() {
  const loc = useLocation();
  return createElement("div", { "data-testid": "probe-location" }, `${loc.pathname}${loc.search}`);
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function okList(items: unknown[], extra: Record<string, unknown> = {}) {
  return () => {
    const url = String(api.fetchJSON.mock.calls.at(-1)?.[0] ?? "");
    if (url.includes("/api/runs")) return Promise.resolve({ items, nextCursor: null, ...extra });
    if (url.includes("/api/run-stats")) return Promise.resolve({ items: [], ...extra });
    return Promise.resolve({ items: [], ...extra });
  };
}

async function waitFor(cond: () => boolean, label: string) {
  for (let i = 0; i < 400; i += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  throw new Error(`timeout: ${label}`);
}

async function render(entry: string) {
  root?.unmount();
  host?.remove();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(
      createElement(
        MemoryRouter,
        { initialEntries: [entry] },
        createElement("div", null, createElement(RunsModulePage), createElement(LocationProbe)),
      ),
    );
  });
}

function node(testid: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${testid}"]`) as HTMLElement | null;
}

function urls(): string[] {
  return api.fetchJSON.mock.calls.map((call) => String(call[0]));
}

function requests(fragment: string): number {
  return urls().filter((url) => url.includes(fragment)).length;
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  clip.copyTextToClipboard.mockClear();
  document.body.innerHTML = "";
});

afterEach(() => {
  root?.unmount();
  root = null;
  host?.remove();
  host = null;
});

describe("runs empty state exclusivity", () => {
  it("shows the guide — and only the guide — when the window really is empty", async () => {
    api.fetchJSON.mockImplementation(okList([]));
    await render("/runs");
    await waitFor(() => node("run-state-empty") !== null, "empty panel");

    const guide = node("run-empty-guide");
    expect(guide).not.toBeNull();
    expect(node("run-state-clear")).toBeNull();

    const work = node("run-empty-guide-work");
    const metrics = node("run-empty-guide-metrics");
    expect(work?.tagName).toBe("A");
    expect(work?.getAttribute("href")).toBe("/work?tab=board");
    expect(metrics?.tagName).toBe("A");
    expect(metrics?.getAttribute("href")).toBe("/metrics");
    expect(work?.getAttribute("onclick")).toBeNull();

    const text = node("run5-empty")?.textContent ?? "";
    expect(text).toContain("确实没有运行");
    expect(text).not.toContain("$0.00");
    expect(text).not.toContain("当前筛选下没有运行记录");

    const before = urls().length;
    await act(async () => {
      (work as HTMLAnchorElement).click();
    });
    expect(urls().length).toBe(before);
  });

  it("shows the clear exit — and no guide — when a filter narrowed the window to zero", async () => {
    api.fetchJSON.mockImplementation(okList([]));
    await render("/runs?status=failed&window=7d");
    await waitFor(() => node("run-state-empty") !== null, "empty panel");

    expect(node("run-empty-guide")).toBeNull();
    expect(node("run-state-empty-text")?.textContent).toContain("当前筛选下没有运行记录");
    const clear = node("run-state-clear");
    expect(clear).not.toBeNull();

    const runsBefore = requests("/api/runs");
    await act(async () => {
      clear?.click();
    });
    await waitFor(() => (node("probe-location")?.textContent ?? "").includes("status=") === false, "status cleared");
    expect(node("probe-location")?.textContent).toContain("window=7d");
    await waitFor(() => requests("/api/runs") > runsBefore, "refetched after clearing");
    const lastRuns = urls().filter((url) => url.includes("/api/runs")).at(-1) ?? "";
    expect(lastRuns).not.toContain("status=failed");
  });

  it("shows neither one on a read failure, and still offers the request id and a retry", async () => {
    api.fetchJSON.mockImplementation((url: string) => {
      if (String(url).includes("/api/runs")) {
        return Promise.reject(new ApiError("boom", { status: 500, body: "", url: String(url), requestId: "req-empty-guard" }));
      }
      return Promise.resolve({ items: [], nextCursor: null });
    });
    await render("/runs");
    await waitFor(() => node("run-state-error") !== null, "error panel");

    expect(node("run-empty-guide")).toBeNull();
    expect(node("run-state-clear")).toBeNull();
    expect(node("run-state-empty")).toBeNull();
    expect(node("run-state-rid")?.textContent).toContain("req-empty-guard");
    expect(node("run5-error-retry")).not.toBeNull();
  });
});
