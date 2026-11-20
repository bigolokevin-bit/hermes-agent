// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { RunsModulePage } from "./RunsModulePage";
import { PAGE_LIMIT } from "./runs";
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
    runId: `rn_01M7822PAGE${tail}`,
    employeeId: "emp_aaaabbbbcccc",
    status: n % 2 === 0 ? "completed" : "failed",
    costUsd: n,
    costStatus: "known",
    startedAt: "2026-11-18T02:00:00.000Z",
    endedAt: "2026-11-18T02:11:00.000Z",
  };
}

const FIRST = Array.from({ length: PAGE_LIMIT }, (_, i) => runRow(i + 1));

type Page = { items: unknown[]; nextCursor: string | null };

let pages: (url: string) => Page | Promise<Page>;
let moreFail: ApiError | null = null;

function dispatch(url: string) {
  if (url.includes("/api/runs")) {
    if (url.includes("cursor=") && moreFail) return Promise.reject(moreFail);
    return Promise.resolve(pages(url));
  }
  return Promise.resolve({ items: [] });
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

function codes(): string[] {
  return Array.from(
    document.querySelectorAll("[data-testid^='run5-row-'][data-status] [data-testid$='-code']"),
  ).map((cell) => cell.textContent ?? "");
}

function runsUrls(): string[] {
  return api.fetchJSON.mock.calls
    .map((call) => String(call[0] ?? ""))
    .filter((url) => url.includes("/api/runs"));
}

function lastRunsUrl(): string {
  return runsUrls().at(-1) ?? "";
}

async function click(testid: string) {
  await act(async () => {
    node(testid)?.click();
  });
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  clip.copyTextToClipboard.mockClear();
  moreFail = null;
  pages = () => ({ items: FIRST, nextCursor: null });
  api.fetchJSON.mockImplementation(dispatch);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  document.body.replaceChildren();
});

describe("runs paging contract", () => {
  it("draws one row per run when a page repeats rows already on screen", async () => {
    pages = (url) =>
      url.includes("cursor=c2")
        ? // The whole first page comes back again, plus five new runs.
          { items: [...FIRST, ...Array.from({ length: 5 }, (_, i) => runRow(PAGE_LIMIT + i + 1))], nextCursor: null }
        : { items: FIRST, nextCursor: "c2" };

    await mount("/runs");
    await waitFor(() => bodyRows() === PAGE_LIMIT, "first page");

    await click("run-more");
    await waitFor(() => bodyRows() === PAGE_LIMIT + 5, "appended page");

    const drawn = codes();
    expect(drawn.length).toBe(PAGE_LIMIT + 5);
    expect(new Set(drawn).size).toBe(drawn.length);
    expect(textOf("run-page-cap")).toContain(`已加载 ${PAGE_LIMIT + 5} 行`);
  });

  it("drops the old cursor when a filter chip is removed", async () => {
    pages = (url) =>
      url.includes("cursor=c2")
        ? { items: [runRow(PAGE_LIMIT + 1)], nextCursor: null }
        : { items: FIRST, nextCursor: "c2" };

    await mount("/runs?status=failed&window=7d");
    await waitFor(() => bodyRows() === PAGE_LIMIT, "first page");
    await click("run-more");
    await waitFor(() => bodyRows() === PAGE_LIMIT + 1, "appended page");
    const before = runsUrls().length;

    await click("run-chip-status-remove");
    await waitFor(() => bodyRows() === PAGE_LIMIT, "back to page one");
    await waitFor(() => runsUrls().length > before, "new first page");

    expect(runsUrls().length).toBe(before + 1);
    expect(lastRunsUrl()).not.toContain("cursor=");
    expect(lastRunsUrl()).not.toContain("status=");
    expect(lastRunsUrl()).toContain("since=");
    expect(textOf("run-page-cap")).toContain(`已加载 ${PAGE_LIMIT} 行`);
  });

  it("marks the last page and keeps the count it shows", async () => {
    await mount("/runs");
    await waitFor(() => bodyRows() === PAGE_LIMIT, "first page");

    const more = node("run-more") as HTMLButtonElement;
    expect(more.disabled).toBe(true);
    expect(more.getAttribute("title")).toContain("到底");
    expect(textOf("run-more-end")).toContain("已到末页");
    expect(textOf("run-page-cap")).toContain(`已加载 ${PAGE_LIMIT} 行`);
    expect(node("run-page-cap-more")).toBeNull();
  });

  it("keeps the loaded rows on failure and retries exactly once", async () => {
    moreFail = new ApiError("boom", {
      status: 500,
      body: "",
      url: "/api/runs",
      requestId: "req-paging",
    });
    pages = (url) =>
      url.includes("cursor=c2")
        ? { items: [runRow(PAGE_LIMIT + 1)], nextCursor: null }
        : { items: FIRST, nextCursor: "c2" };

    await mount("/runs");
    await waitFor(() => bodyRows() === PAGE_LIMIT, "first page");

    await click("run-more");
    await waitFor(() => node("run-more-error") !== null, "more error");

    expect(bodyRows()).toBe(PAGE_LIMIT);
    expect(textOf("run-more-error")).toContain("已加载的行仍然保留");
    expect(textOf("run-more-rid")).toBe("req-paging");

    moreFail = null;
    const before = runsUrls().length;
    await click("run-more-retry");
    await waitFor(() => bodyRows() === PAGE_LIMIT + 1, "retry appended");

    expect(runsUrls().length).toBe(before + 1);
    expect(node("run-more-error")).toBeNull();
  });

  it("keeps the copy and export counts equal to the rows on screen", async () => {
    pages = (url) =>
      url.includes("cursor=c2")
        ? { items: Array.from({ length: 5 }, (_, i) => runRow(PAGE_LIMIT + i + 1)), nextCursor: null }
        : { items: FIRST, nextCursor: "c2" };

    await mount("/runs");
    await waitFor(() => bodyRows() === PAGE_LIMIT, "first page");
    await click("run-more");
    await waitFor(() => bodyRows() === PAGE_LIMIT + 5, "appended page");

    const drawn = bodyRows();
    expect(drawn).toBe(PAGE_LIMIT + 5);
    expect(node("run-list-export-count")?.getAttribute("data-rows")).toBe(String(drawn));
    expect(textOf("run-list-export-count")).toContain(`可导出 ${drawn} 行`);
    expect(textOf("run-page-cap")).toContain(`已加载 ${drawn} 行`);

    // The copy bar reads the same rows: its button stays enabled and the
    // clipboard text starts with the same header followed by one line per row.
    await click("run-list-copy");
    const lastCall = (clip.copyTextToClipboard.mock.calls as unknown as Array<[string]>).at(-1);
    const copied = String(lastCall?.[0] ?? "");
    const lines = copied.split("\n");
    expect(lines[0]).toBe("run,status,started,ended,elapsed,cost,employee");
    expect(lines.length - 1).toBe(drawn);
  });
});