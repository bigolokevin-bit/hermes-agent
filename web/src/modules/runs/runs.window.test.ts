// @vitest-environment jsdom
// The window selector is only honest if it changes the request. These guards
// pin the mapping from `?window=` to the `since` the list actually asks for —
// including 「全部时间」, which must send the epoch instant instead of dropping
// `since` (the read route answers 400 `request.missing_filter` without it).

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn((text: string) => Promise.resolve(Boolean(text))) }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clip.copyTextToClipboard }));

import { RunsModulePage } from "./RunsModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const HOUR = 3_600_000;
const MINUTE = 60_000;
const EPOCH = "1970-01-01T00:00:00.000Z";

let root: Root | null = null;

function LocationProbe(): ReturnType<typeof createElement> {
  const location = useLocation();
  return createElement("div", { "data-testid": "probe-location" }, `${location.pathname}${location.search}`);
}

const RUN_A = {
  runId: "rn_01M7822WINDOW00000000001",
  status: "completed",
  costStatus: "upstream",
  costUsd: 1,
  startedAt: "2026-11-18T02:00:00Z",
  endedAt: "2026-11-18T02:11:00Z",
};

const okList = (items: unknown[]) => async (url: string) => {
  if (url.includes("/api/runs") || url.includes("/api/run-stats")) return { items };
  if (url.includes("/api/employees")) return { items: [] };
  return { items: [] };
};

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

async function render(entry: string): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      createElement(MemoryRouter, { initialEntries: [entry] }, createElement(RunsModulePage), createElement(LocationProbe)),
    );
  });
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const runsUrls = (): string[] => urls().filter((url) => url.includes("/api/runs"));
const lastRunsUrl = (): string => runsUrls().at(-1) ?? "";
const probe = (): string =>
  (document.querySelector("[data-testid='probe-location']") as HTMLElement | null)?.textContent ?? "";
const pressedWindow = (): string =>
  (document.querySelector("[data-testid^='run-window-'][aria-pressed='true']") as HTMLElement | null)
    ?.getAttribute("data-testid") ?? "";
const countOf = (fragment: string): number => urls().filter((url) => url.includes(fragment)).length;

function sinceOf(url: string): number {
  const raw = /[?&]since=([^&]+)/.exec(url)?.[1];
  if (raw === undefined) throw new Error(`no since in ${url}`);
  return Date.parse(decodeURIComponent(raw));
}

async function click(testid: string): Promise<void> {
  await act(async () => {
    (document.querySelector(`[data-testid='${testid}']`) as HTMLButtonElement).click();
  });
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  clip.copyTextToClipboard.mockClear();
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
});

describe("runs window contract", () => {
  it("maps each preset to a since of roughly its own length, and all to the epoch", async () => {
    for (const [key, hours] of [
      ["24h", 24],
      ["7d", 168],
      ["30d", 720],
    ] as const) {
      api.fetchJSON.mockImplementation(okList([RUN_A]));
      await render(`/runs?window=${key}`);
      await waitFor(() => runsUrls().length > 0, `request for ${key}`);
      const since = sinceOf(lastRunsUrl());
      expect(Math.abs(Date.now() - since - hours * HOUR)).toBeLessThan(2 * MINUTE);
      expect(pressedWindow()).toBe(`run-window-${key}`);
    }

    api.fetchJSON.mockImplementation(okList([RUN_A]));
    await render("/runs?window=all");
    await waitFor(() => runsUrls().length > 0, "request for all");
    expect(lastRunsUrl()).toContain("since=");
    expect(decodeURIComponent(/[?&]since=([^&]+)/.exec(lastRunsUrl())?.[1] ?? "")).toBe(EPOCH);
    expect(pressedWindow()).toBe("run-window-all");
  });

  it("keeps every other filter in the address when the window changes", async () => {
    api.fetchJSON.mockImplementation(okList([RUN_A]));
    await render("/runs?window=7d&status=failed&employee=emp_aaaabbbbcccc&rsort=started&rdir=desc&keep=1");
    await waitFor(() => runsUrls().length > 0, "first read");

    const runsBefore = runsUrls().length;
    const employeesBefore = countOf("/api/employees");
    const statsBefore = countOf("/api/run-stats");

    await click("run-window-30d");
    await waitFor(() => runsUrls().length === runsBefore + 1, "one more list read");

    const search = new URL(probe(), "http://x").search;
    expect(search).toContain("window=30d");
    expect(search).toContain("status=failed");
    expect(search).toContain("employee=emp_aaaabbbbcccc");
    expect(search).toContain("rsort=started");
    expect(search).toContain("rdir=desc");
    expect(search).toContain("keep=1");
    expect(countOf("/api/employees")).toBe(employeesBefore);
    // 换窗口＝换统计窗口：运行构成卡跟着再读一次 run-stats，列表仍只读一次。
    expect(countOf("/api/run-stats")).toBe(statsBefore + 1);
    expect(runsUrls().length).toBe(runsBefore + 1);
  });

  it("falls back without rewriting an unrecognised window, and says so", async () => {
    api.fetchJSON.mockImplementation(okList([RUN_A]));
    await render("/runs?window=xxx");
    await waitFor(() => runsUrls().length > 0, "read with fallback");
    expect(pressedWindow()).toBe("run-window-7d");
    expect(probe()).toBe("/runs?window=xxx");
    const note = document.querySelector("[data-testid='run-source-note']")?.textContent ?? "";
    expect(note).toContain("未识别");
    expect(note).toContain("近 7 天");
    const since = sinceOf(lastRunsUrl());
    expect(Math.abs(Date.now() - since - 168 * HOUR)).toBeLessThan(2 * MINUTE);
  });

  it("defaults to seven days without writing the default into the address", async () => {
    api.fetchJSON.mockImplementation(okList([RUN_A]));
    await render("/runs");
    await waitFor(() => runsUrls().length > 0, "default read");
    expect(pressedWindow()).toBe("run-window-7d");
    expect(probe()).toBe("/runs");
    const since = sinceOf(lastRunsUrl());
    expect(Math.abs(Date.now() - since - 168 * HOUR)).toBeLessThan(2 * MINUTE);
  });

  it("keeps the repro leg inert while the selector stays self-consistent", async () => {
    api.fetchJSON.mockImplementation(okList([RUN_A]));
    await render("/runs?state=empty");
    await waitFor(() => pressedWindow() !== "", "selector painted");
    expect(document.querySelector("[data-testid='run-state']")?.getAttribute("data-phase")).toBe("empty");
    expect(document.querySelector("[data-testid='run-list-copy']")).toBeNull();
    expect(urls().length).toBe(0);
    expect(pressedWindow()).toBe("run-window-7d");

    await click("run-window-24h");
    await waitFor(() => pressedWindow() === "run-window-24h", "24h pressed");
    const search = new URL(probe(), "http://x").search;
    expect(search).toContain("window=24h");
    expect(search).toContain("state=empty");
    expect(urls().length).toBe(0);
    expect(document.querySelector("[data-testid='run-state']")?.getAttribute("data-phase")).toBe("empty");
  });
});