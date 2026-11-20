// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { RunsModulePage } from "./RunsModulePage";
import { PAGE_LIMIT, pageCapMoreText, pageCapText, pageCapTitle } from "./runs";
import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn(() => Promise.resolve(true)) }));

vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clip.copyTextToClipboard }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function runRow(n: number) {
  const tail = String(n).padStart(4, "0");
  return {
    runId: `rn_01M7822CAP${tail}`,
    employeeId: "emp_aaaabbbbcccc",
    status: n % 2 === 0 ? "failed" : "completed",
    costUsd: n,
    costStatus: "known",
    startedAt: "2026-11-18T02:00:00.000Z",
    endedAt: "2026-11-18T02:11:00.000Z",
  };
}

function okList(items: unknown[], nextCursor: string | null = null) {
  return () => {
    const url = String(api.fetchJSON.mock.calls.at(-1)?.[0] ?? "");
    if (url.includes("/api/runs")) return Promise.resolve({ items, nextCursor });
    if (url.includes("/api/run-stats")) return Promise.resolve({ items: [] });
    return Promise.resolve({ items: [] });
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

async function mount(entry: string) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(
      createElement(MemoryRouter, { initialEntries: [entry] }, createElement(RunsModulePage)),
    );
  });
}

function node(testid: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${testid}"]`);
}

function textOf(testid: string): string {
  return node(testid)?.textContent ?? "";
}

function bodyRows(): number {
  return document.querySelectorAll("[data-testid^='run5-row-'][data-status]").length;
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  clip.copyTextToClipboard.mockClear();
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  document.body.replaceChildren();
});

describe("runs page cap honesty", () => {
  it("states the page cap once and warns when the page is full", async () => {
    const rows = Array.from({ length: PAGE_LIMIT }, (_, i) => runRow(i + 1));
    api.fetchJSON.mockImplementation(okList(rows, "cursor-2"));
    await mount("/runs");
    await waitFor(() => bodyRows() === PAGE_LIMIT, "30 rows");

    const cap = node("run-page-cap");
    expect(cap).not.toBeNull();
    expect(cap?.tagName).toBe("P");
    expect(textOf("run-page-cap")).toContain(pageCapText());
    expect(textOf("run-page-cap")).toContain(`已加载 ${PAGE_LIMIT} 行`);
    expect(cap?.getAttribute("title")).toBe(pageCapTitle());
    expect(cap?.getAttribute("title")).toContain(`limit=${PAGE_LIMIT}`);
    expect(cap?.getAttribute("title")).toContain("nextCursor");
    expect(cap?.getAttribute("title")).toContain("「加载更多」");

    expect(textOf("run-page-cap-more")).toBe(pageCapMoreText());

    expect(textOf("run-list-export-count")).toContain(`可导出 ${PAGE_LIMIT} 行`);
    expect(node("run-list-export-count")?.getAttribute("data-rows")).toBe(String(PAGE_LIMIT));
    expect(node("run-list-copy")?.getAttribute("title")).toContain(
      `当前已加载 ${PAGE_LIMIT} 行`,
    );
  });

  it("drops the more-warning when the page is short and keeps the same count", async () => {
    const rows = [runRow(1), runRow(2)];
    api.fetchJSON.mockImplementation(okList(rows));
    await mount("/runs");
    await waitFor(() => bodyRows() === 2, "2 rows");

    expect(textOf("run-page-cap")).toContain(pageCapText());
    expect(textOf("run-page-cap")).toContain("已加载 2 行");
    expect(node("run-page-cap-more")).toBeNull();
    expect(textOf("run-list-export-count")).toContain("可导出 2 行");
    expect(node("run-list-export-count")?.getAttribute("data-rows")).toBe("2");
  });

  it("keeps the cap line honest when the read fails", async () => {
    api.fetchJSON.mockImplementation(() => {
      const url = String(api.fetchJSON.mock.calls.at(-1)?.[0] ?? "");
      if (url.includes("/api/runs")) {
        return Promise.reject(new ApiError("boom", { status: 500, body: "", url, requestId: "req-cap" }));
      }
      return Promise.resolve({ items: [] });
    });
    await mount("/runs");
    await waitFor(() => node("run-state-error") !== null, "error state");

    expect(textOf("run-page-cap")).toContain(pageCapText());
    expect(textOf("run-page-cap")).toContain("已加载 — 行");
    expect(node("run-page-cap-more")).toBeNull();
  });
});