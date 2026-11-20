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
    runId: `rn_01M7822MORE${tail}`,
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

function runsUrls(): string[] {
  return api.fetchJSON.mock.calls
    .map((call) => String(call[0] ?? ""))
    .filter((url) => url.includes("/api/runs"));
}

function lastRunsUrl(): string {
  const all = runsUrls();
  return all.at(-1) ?? "";
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

describe("runs load more", () => {
  it("asks once with the cursor, appends the page and keeps one row per run", async () => {
    const second = Array.from({ length: 5 }, (_, i) => runRow(PAGE_LIMIT + i + 1));
    pages = (url) =>
      url.includes("cursor=c2")
        ? // Repeats run 30 (already on screen) and adds five new ones.
          { items: [runRow(PAGE_LIMIT), ...second], nextCursor: null }
        : { items: FIRST, nextCursor: "c2" };

    await mount("/runs");
    await waitFor(() => bodyRows() === PAGE_LIMIT, "first page");
    const before = runsUrls().length;

    expect(textOf("run-page-cap-more")).not.toBe("");
    expect(textOf("run-page-cap")).toContain(`已加载 ${PAGE_LIMIT} 行`);

    await click("run-more");
    await waitFor(() => bodyRows() === PAGE_LIMIT + 5, "appended page");

    expect(runsUrls().length).toBe(before + 1);
    expect(lastRunsUrl()).toContain("cursor=c2");
    expect(lastRunsUrl()).toContain("limit=30");

    // The repeated run is not drawn twice.
    const codes = Array.from(
      document.querySelectorAll("[data-testid^='run5-row-'][data-status] [data-testid$='-code']"),
    ).map((cell) => cell.textContent ?? "");
    expect(new Set(codes).size).toBe(codes.length);

    expect(textOf("run-page-cap")).toContain(`已加载 ${PAGE_LIMIT + 5} 行`);
    expect(node("run-list-export-count")?.getAttribute("data-rows")).toBe(String(PAGE_LIMIT + 5));
    expect(textOf("run-list-export-count")).toContain(`可导出 ${PAGE_LIMIT + 5} 行`);
    expect(textOf("run-more-end")).toContain("已到末页");
  });

  it("marks the end when the service names no next page", async () => {
    await mount("/runs");
    await waitFor(() => bodyRows() === PAGE_LIMIT, "first page");

    expect((node("run-more") as HTMLButtonElement).disabled).toBe(true);
    expect(textOf("run-more-end")).toContain("已到末页");
    expect(node("run-page-cap-more")).toBeNull();
  });

  it("keeps the loaded rows when the next page fails, with a copyable id and retry", async () => {
    moreFail = new ApiError("boom", { status: 500, body: "", url: "/api/runs", requestId: "req-more" });
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
    expect(textOf("run-more-rid")).toBe("req-more");

    await click("run-more-copy");
    expect(clip.copyTextToClipboard).toHaveBeenCalledWith("req-more");

    moreFail = null;
    await click("run-more-retry");
    await waitFor(() => bodyRows() === PAGE_LIMIT + 1, "retry appended");
    expect(node("run-more-error")).toBeNull();
  });

  it("starts again from page one when the order changes, without asking again", async () => {
    pages = (url) =>
      url.includes("cursor=c2")
        ? { items: [runRow(PAGE_LIMIT + 1), runRow(PAGE_LIMIT + 2)], nextCursor: null }
        : { items: FIRST, nextCursor: "c2" };

    await mount("/runs");
    await waitFor(() => bodyRows() === PAGE_LIMIT, "first page");
    await click("run-more");
    await waitFor(() => bodyRows() === PAGE_LIMIT + 2, "appended page");
    const before = runsUrls().length;

    await click("run-sort-started");
    await waitFor(() => bodyRows() === PAGE_LIMIT, "back to page one");

    expect(runsUrls().length).toBe(before);
    expect(textOf("run-page-cap")).toContain(`已加载 ${PAGE_LIMIT} 行`);
  });

  it("does not reuse the old cursor after the window changes", async () => {
    pages = (url) =>
      url.includes("cursor=c2")
        ? { items: [runRow(PAGE_LIMIT + 1)], nextCursor: null }
        : { items: FIRST, nextCursor: "c2" };

    await mount("/runs");
    await waitFor(() => bodyRows() === PAGE_LIMIT, "first page");
    await click("run-more");
    await waitFor(() => bodyRows() === PAGE_LIMIT + 1, "appended page");
    const before = runsUrls().length;

    await click("run-window-30d");
    await waitFor(() => bodyRows() === PAGE_LIMIT, "new window first page");

    expect(runsUrls().length).toBe(before + 1);
    expect(lastRunsUrl()).not.toContain("cursor=");
    expect(lastRunsUrl()).toContain("since=");
  });
});
