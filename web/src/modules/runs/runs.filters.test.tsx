// @vitest-environment jsdom
// R136 — the address is the only shared truth for the runs filters: a link that
// says 失败/近 7 天 must paint both controls, must ask the service for exactly
// those parameters, and must never be quietly rewritten. Four lanes already pin
// pieces of this (`runs.window.test.ts` for the window presets and their
// fallback, `runs.paging.test.tsx` for the cursor dropped by a chip removal,
// `runs.more.test.tsx` for the cursor dropped by a window change,
// `runs.pagecap.test.tsx` for the cap and export wording). What none of them
// ever did is the round trip this page actually offers: the status <select>,
// the 清除筛选 button, and an unrecognised status value. Those are the guards
// added here — written against the product's real behaviour, mirroring the
// chip-set and call-count discipline of `approvals.filterurl.test.tsx`.
//
// Contract facts these tests lean on, all from the product's single points:
//   - the filter keys are `RUN_PARAM_TABLE` (window, status, employee, state,
//     rsort, rdir) and 清除筛选 drops exactly those; foreign keys ride along
//     forever, which is the design, so it is asserted rather than assumed;
//   - `cursor` is never an address key — it only exists inside the outgoing
//     `/api/runs` read, so "page back to the start" is proven there;
//   - every filter write uses `{ replace: true }`, proven with
//     `useNavigationType()` because MemoryRouter does not drive window.history.

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigationType } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn(() => Promise.resolve(true)) }));

vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clip.copyTextToClipboard }));

import { RunsModulePage } from "./RunsModulePage";
import { PAGE_LIMIT, RUN_PARAM_TABLE } from "./runs";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The six address keys the filters own — taken from the product, not retyped. */
const FILTER_KEYS = RUN_PARAM_TABLE.map((spec) => spec.key).filter((key) => key !== "rdir");

let root: Root | null = null;
let host: HTMLDivElement | null = null;

/** Rows for one page, and a cursor so 查看更多 has something real to do. */
function runRow(n: number) {
  const tail = String(n).padStart(4, "0");
  return {
    runId: `rn_01M7822FILTER${tail}`,
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

let pages: (url: string) => Page = () => ({ items: FIRST, nextCursor: "c2" });

function dispatch(url: string) {
  if (url.includes("/api/runs")) return Promise.resolve(pages(url));
  return Promise.resolve({ items: [] });
}

function LocationProbe() {
  const location = useLocation();
  return createElement("div", { "data-testid": "probe-location" }, `${location.pathname}${location.search}`);
}

function NavProbe() {
  return createElement("div", { "data-testid": "probe-navtype" }, useNavigationType());
}

/** Bounded by ticks, never by wall clock, so a hung wait always fails loudly. */
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
  await act(async () => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(
      createElement(
        MemoryRouter,
        { initialEntries: [entry] },
        createElement(RunsModulePage),
        createElement(LocationProbe),
        createElement(NavProbe),
      ),
    );
  });
}

function node(testid: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${testid}"]`);
}

function textOf(testid: string): string {
  return node(testid)?.textContent ?? "";
}

async function click(testid: string) {
  await act(async () => {
    node(testid)?.click();
  });
}

async function selectStatus(value: string) {
  const select = node("run5-filter-status") as HTMLSelectElement;
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function urls(): string[] {
  return api.fetchJSON.mock.calls.map((call) => String(call[0] ?? ""));
}

function runsUrls(): string[] {
  return urls().filter((url) => url.includes("/api/runs"));
}

function lastRunsUrl(): string {
  return runsUrls().at(-1) ?? "";
}

function countOf(fragment: string): number {
  return urls().filter((url) => url.includes(fragment)).length;
}

/** Sorted `k=v` pairs — byte-for-byte comparison instead of substring probes. */
function pairs(target: string): string[] {
  const query = target.includes("?") ? target.slice(target.indexOf("?")) : "";
  return Array.from(new URLSearchParams(query).entries())
    .map(([key, value]) => `${key}=${value}`)
    .sort();
}

function valueOf(target: string, key: string): string | null {
  const query = target.includes("?") ? target.slice(target.indexOf("?")) : "";
  return new URLSearchParams(query).get(key);
}

const address = (): string => new URL(probeLocation(), "http://x").search;
const rows = (): number => document.querySelectorAll("[data-testid^='run5-row-'][data-status]").length;

function chipKeys(): string[] {
  return Array.from(document.querySelectorAll("[data-testid^='run-chip-']"))
    .map((el) => el.getAttribute("data-testid") ?? "")
    .filter((id) => !id.endsWith("-remove"))
    .map((id) => id.slice("run-chip-".length))
    .sort();
}

const pressedWindow = (): string =>
  document.querySelector("[data-testid^='run-window-'][aria-pressed='true']")?.getAttribute("data-testid") ?? "";

const navType = (): string => textOf("probe-navtype");

/** Digits the 已加载 N 行 line claims, so counts are compared as numbers. */
function loadedCount(): number {
  const raw = /已加载 (\d+) 行/.exec(textOf("run-page-cap"))?.[1];
  if (raw === undefined) throw new Error(`run-page-cap does not state a count: ${textOf("run-page-cap")}`);
  return Number(raw);
}

function exportCount(): number {
  const raw = /可导出 (\d+) 行/.exec(textOf("run-list-export-count"))?.[1];
  if (raw === undefined) throw new Error(`run-list-export-count does not state a count: ${textOf("run-list-export-count")}`);
  return Number(raw);
}

/**
 * The window's `since` is derived from the clock at read time, so any
 * byte-for-byte comparison of two reads — deep link against click path, or one
 * mount against the next — is only meaningful with a frozen instant. Date is
 * faked alone; the timers stay real so the tick-bounded waitFor below still
 * advances.
 */
const FROZEN = "2026-11-19T12:00:00.000Z";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(FROZEN));
  api.fetchJSON.mockReset();
  clip.copyTextToClipboard.mockClear();
  pages = () => ({ items: FIRST, nextCursor: "c2" });
  api.fetchJSON.mockImplementation((url: string) => dispatch(String(url)));
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  host?.remove();
  host = null;
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("R136 ① deep link paints both controls and asks for the same values", () => {
  it("backfills the window preset, the status select and the chips, then re-asks byte-identically", async () => {
    await mount("/runs?status=failed&window=7d");
    await waitFor(() => runsUrls().length > 0, "deep-link read");
    await waitFor(() => rows() === PAGE_LIMIT, "deep-link rows");

    expect(pressedWindow()).toBe("run-window-7d");
    expect((node("run5-filter-status") as HTMLSelectElement).value).toBe("failed");
    // One chip per filter key actually in the address — no more, no less.
    expect(chipKeys()).toEqual(["status", "window"]);
    expect(node("run-chip-status")?.getAttribute("title")).toBe("地址原值：failed");
    expect(textOf("run-chip-status")).toContain("失败");

    const asked = pairs(lastRunsUrl());
    expect(asked).toContain("status=failed");
    expect(valueOf(lastRunsUrl(), "since")).not.toBeNull();
    expect(asked).not.toContain("cursor=");
    expect(valueOf(lastRunsUrl(), "cursor")).toBeNull();

    const deepRead = runsUrls().length;
    expect(deepRead).toBe(1);

    // The same state reached by hand must produce the same read, parameter for
    // parameter — the link is not a second, softer code path.
    const linkRead = pairs(lastRunsUrl());
    await mount("/runs");
    await waitFor(() => runsUrls().length > 0, "plain read");
    await click("run-window-7d");
    await selectStatus("failed");
    await waitFor(() => valueOf(lastRunsUrl(), "status") === "failed", "status asked for");

    expect(pairs(lastRunsUrl())).toEqual(linkRead);
    expect(pressedWindow()).toBe("run-window-7d");
    expect(chipKeys()).toEqual(["status", "window"]);
    expect(deepRead).toBe(1);
  });

  it("backfills the employee and sort keys the address carries too", async () => {
    await mount("/runs?window=30d&employee=emp_aaaabbbbcccc&rsort=started&rdir=asc");
    await waitFor(() => runsUrls().length > 0, "wide deep link read");

    expect(pressedWindow()).toBe("run-window-30d");
    // rsort and rdir are one chip because the address always carries them together.
    expect(chipKeys()).toEqual(["employee", "sort", "window"]);
    expect(node("run-chip-sort")?.getAttribute("title")).toContain("地址原值：started / asc");
    expect(valueOf(lastRunsUrl(), "since")).not.toBeNull();
  });
});

describe("R136 ② changing only the status moves only the status", () => {
  it("keeps every other key, zeroes the cursor, and re-reads exactly once", async () => {
    pages = (url) =>
      url.includes("cursor=") ? { items: [runRow(PAGE_LIMIT + 1)], nextCursor: null } : { items: FIRST, nextCursor: "c2" };

    const LINK = "/runs?window=30d&rsort=started&rdir=asc&keep=1&zzextra=abc";
    await mount(LINK);
    await waitFor(() => rows() === PAGE_LIMIT, "first page");

    await click("run-more");
    await waitFor(() => rows() === PAGE_LIMIT + 1, "appended page");
    expect(valueOf(lastRunsUrl(), "cursor")).not.toBeNull();

    const before = runsUrls().length;
    const employeesBefore = countOf("/api/employees");
    const sinceBefore = valueOf(lastRunsUrl(), "since");
    const historyBefore = window.history.length;

    await selectStatus("failed");
    await waitFor(() => runsUrls().length === before + 1, "one new list read");

    // The address gains exactly one key; everything else keeps its spelling.
    expect(address()).toBe("?window=30d&rsort=started&rdir=asc&keep=1&zzextra=abc&status=failed");
    expect(pairs(`x${address()}`)).toEqual([...pairs(LINK), "status=failed"].sort());
    expect(valueOf(address(), "status")).toBe("failed");

    // Appended pages are gone, and the new read does not carry the old cursor.
    expect(rows()).toBe(PAGE_LIMIT);
    expect(runsUrls().length).toBe(before + 1);
    expect(valueOf(lastRunsUrl(), "cursor")).toBeNull();
    expect(valueOf(lastRunsUrl(), "status")).toBe("failed");
    expect(valueOf(lastRunsUrl(), "since")).toBe(sinceBefore);
    expect(loadedCount()).toBe(PAGE_LIMIT);

    // Nothing else re-reads, and the write replaced instead of pushing.
    expect(countOf("/api/employees")).toBe(employeesBefore);
    expect(navType()).toBe("REPLACE");
    expect(window.history.length).toBe(historyBefore);
    expect(chipKeys()).toEqual(["sort", "status", "window"]);
  });

  it("choosing 全部状态 removes the key instead of writing an empty one", async () => {
    await mount("/runs?status=failed&window=30d&keep=1");
    await waitFor(() => rows() === PAGE_LIMIT, "rows with the filter on");

    const before = runsUrls().length;
    await selectStatus("");
    await waitFor(() => runsUrls().length === before + 1, "read without the filter");

    expect(address()).toBe("?window=30d&keep=1");
    expect(valueOf(lastRunsUrl(), "status")).toBeNull();
    expect(rows()).toBe(PAGE_LIMIT);
    expect(navType()).toBe("REPLACE");
  });

  it("selecting the status that is already on is not a new read", async () => {
    await mount("/runs?status=failed&window=7d");
    await waitFor(() => rows() === PAGE_LIMIT, "first read");

    const before = urls().length;
    await selectStatus("failed");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(urls().length).toBe(before);
    expect(address()).toBe("?status=failed&window=7d");
  });
});

describe("R136 ③ an unrecognised value is disclosed, never rewritten", () => {
  it("keeps ?status=__nope__ in the address, never asks for it, and stays readable", async () => {
    pages = () => ({ items: [], nextCursor: null });
    await mount("/runs?status=__nope__");
    await waitFor(() => runsUrls().length > 0, "read under the unusable value");

    // Byte-identical: nothing was silently dropped or normalised away.
    expect(probeLocation()).toBe("/runs?status=__nope__");
    expect(pairs(lastRunsUrl())).not.toContain("status=__nope__");
    expect(lastRunsUrl()).not.toContain("__nope__");

    // The chip carries the raw value and says which read actually happened.
    expect(chipKeys()).toEqual(["status"]);
    expect(textOf("run-chip-status")).toContain("__nope__");
    expect(node("run-chip-status")?.getAttribute("title")).toContain("地址原值：__nope__");
    expect(node("run-chip-status")?.getAttribute("title")).toContain("该值未被识别，按全部状态读取");
    // …and the control shows the state the page really is in, not the link's claim.
    expect((node("run5-filter-status") as HTMLSelectElement).value).toBe("");

    // Honest finding, asserted as the product behaves: because an unusable
    // status parses to "no filter", the empty panel reports the WINDOW kind,
    // not the filtered kind — a link that names an unread status reads as
    // "this window has no runs".
    expect(textOf("run-state-empty-text")).toContain("这个时间窗口里确实没有运行");
    expect(textOf("run-state-empty-text")).not.toContain("当前筛选下没有运行记录");
    expect(node("run-state-clear")).toBeNull();

    // The page-level anchors all stay, and 查看更多 is not offered as enabled.
    expect(node("run5-filters")).not.toBeNull();
    expect(node("run-filter-chips")).not.toBeNull();
    expect(node("run5-status")).not.toBeNull();
    expect(node("run-list-export-count")).not.toBeNull();
    expect(pressedWindow()).toBe("run-window-7d");
    expect(document.querySelector("[data-testid='run-more']:not([disabled])")).toBeNull();
  });

  it("keeps ?window=__nope__ in the address and reads the fallback window", async () => {
    await mount("/runs?window=__nope__");
    await waitFor(() => runsUrls().length > 0, "read under the unusable window");

    expect(probeLocation()).toBe("/runs?window=__nope__");
    expect(lastRunsUrl()).not.toContain("__nope__");
    expect(pressedWindow()).toBe("run-window-7d");
    expect(chipKeys()).toEqual(["window"]);
    expect(node("run-chip-window")?.getAttribute("title")).toContain("该值未被识别，按近 7 天读取");
  });

  it("a recognised value never grows a note", async () => {
    await mount("/runs?status=failed&window=7d");
    await waitFor(() => runsUrls().length > 0, "read under a valid link");

    expect(node("run-chip-status")?.getAttribute("title")).toBe("地址原值：failed");
    expect(node("run-chip-window")?.getAttribute("title")).toBe("地址原值：7d");
    expect(textOf("run-chip-status")).not.toContain("未识别");
  });
});

describe("R136 ④ the same address re-reads the same way", () => {
  it("re-mounts with byte-identical reads, and rows = 已加载 N = 可导出 N = data-rows", async () => {
    const LINK = "/runs?status=failed&window=7d";
    await mount(LINK);
    await waitFor(() => rows() === PAGE_LIMIT, "first mount rows");

    const first = urls();
    const firstRows = rows();
    const firstCap = loadedCount();
    const firstExport = exportCount();
    const firstCodes = Array.from(document.querySelectorAll("[data-testid^='run5-row-'] [data-testid$='-code']")).map(
      (el) => el.textContent ?? "",
    );

    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation((url: string) => dispatch(String(url)));
    await mount(LINK);
    await waitFor(() => rows() === PAGE_LIMIT, "second mount rows");

    // Same ordered list of calls: no doubled read, no extra side-read, no drift.
    expect(urls()).toEqual(first);
    expect(rows()).toBe(firstRows);
    expect(
      Array.from(document.querySelectorAll("[data-testid^='run5-row-'] [data-testid$='-code']")).map(
        (el) => el.textContent ?? "",
      ),
    ).toEqual(firstCodes);

    // The three places that state a number agree with each other and with the
    // cap: the fixture offers more than one page, so 30 is the cap, not luck.
    expect(firstRows).toBe(PAGE_LIMIT);
    expect(loadedCount()).toBe(firstCap);
    expect(exportCount()).toBe(firstExport);
    expect(loadedCount()).toBe(rows());
    expect(exportCount()).toBe(rows());
    expect(node("run-list-export-count")?.getAttribute("data-rows")).toBe(String(rows()));
    expect(valueOf(first.at(0) ?? "", "cursor")).toBeNull();
    expect(runsUrls().length).toBe(1);
  });
});

describe("R136 ⑤ clearing all filters leaves no filter residue", () => {
  it("清除筛选 drops every key of RUN_PARAM_TABLE and keeps the foreign ones", async () => {
    pages = (url) =>
      url.includes("cursor=") ? { items: [runRow(PAGE_LIMIT + 1)], nextCursor: null } : { items: FIRST, nextCursor: "c2" };

    await mount("/runs?window=30d&status=failed&employee=emp_aaaabbbbcccc&rsort=started&rdir=asc&keep=1");
    await waitFor(() => rows() === PAGE_LIMIT, "filtered page");
    await click("run-more");
    await waitFor(() => rows() === PAGE_LIMIT + 1, "appended page");

    expect(chipKeys()).toEqual(["employee", "sort", "status", "window"]);
    const before = runsUrls().length;

    await click("run-reset-filters");
    await waitFor(() => runsUrls().length === before + 1, "one default read");

    // Only the foreign key survives — the six filter keys are all gone, and so
    // are the appended pages.
    expect(address()).toBe("?keep=1");
    for (const key of [...FILTER_KEYS, "rdir"]) expect(valueOf(address(), key)).toBeNull();
    expect(chipKeys()).toEqual([]);
    expect(node("run-filter-chips")).toBeNull();
    expect(pressedWindow()).toBe("run-window-7d");
    expect((node("run5-filter-status") as HTMLSelectElement).value).toBe("");
    expect(rows()).toBe(PAGE_LIMIT);

    const clean = pairs(lastRunsUrl());
    expect(clean).not.toContain("status=failed");
    expect(clean).not.toContain("employee=emp_aaaabbbbcccc");
    expect(clean).not.toContain("rsort=started");
    expect(clean).not.toContain("rdir=asc");
    expect(valueOf(lastRunsUrl(), "cursor")).toBeNull();
    expect(navType()).toBe("REPLACE");

    // With nothing left to clear, the button says so instead of re-reading.
    expect((node("run-reset-filters") as HTMLButtonElement).disabled).toBe(true);
    const afterReset = urls().length;
    await click("run-reset-filters");
    expect(urls().length).toBe(afterReset);
  });

  it("清除筛选 also drops the repro key, because it is a filter key", async () => {
    await mount("/runs?status=failed&state=empty&keep=1");
    await waitFor(() => pressedWindow() !== "", "selector painted under the forced state");

    expect(chipKeys()).toEqual(["state", "status"]);
    await click("run-reset-filters");
    await waitFor(() => address() === "?keep=1", "only the foreign key left");

    expect(valueOf(address(), "state")).toBeNull();
    expect(valueOf(address(), "status")).toBeNull();
    expect(chipKeys()).toEqual([]);
    // No read carried the unusable repro key at any point.
    for (const url of urls()) expect(url).not.toContain("state=__nope__");
  });

  it("the empty panel's clear is narrower: only status and employee", async () => {
    pages = () => ({ items: [], nextCursor: null });
    await mount("/runs?window=30d&status=failed&employee=emp_aaaabbbbcccc&keep=1");
    await waitFor(() => node("run-state-clear") !== null, "filtered empty panel");

    // This is the filter kind of empty: it names the filters and offers an exit.
    expect(textOf("run-state-empty-text")).toContain("当前筛选下没有运行记录");

    const before = runsUrls().length;
    await click("run-state-clear");
    await waitFor(() => runsUrls().length === before + 1, "one wider read");

    expect(address()).toBe("?window=30d&keep=1");
    expect(valueOf(address(), "status")).toBeNull();
    expect(valueOf(address(), "employee")).toBeNull();
    // The window is NOT part of that exit — it is the page's own scope, kept.
    expect(valueOf(address(), "window")).toBe("30d");
    expect(pressedWindow()).toBe("run-window-30d");
    expect(navType()).toBe("REPLACE");
  });
});

function probeLocation(): string {
  return textOf("probe-location");
}
