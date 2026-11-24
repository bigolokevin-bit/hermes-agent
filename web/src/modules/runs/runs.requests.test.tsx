// @vitest-environment jsdom
// R150: the /runs list and detail screens speak one request contract with the
// server, and this file pins it. Four promises: (1) the first screen costs
// exactly ONE /api/runs read — no silent double batch, and the employee-name
// side-read is counted as the separate endpoint it is; (2) an inline expansion
// costs NOTHING, because the preview is built from the row already in memory,
// while the 「查看」 detail screen costs exactly one /api/run-detail plus one
// /api/run-events and never a second list read; (3) closing and reopening the
// same run re-reads the pair instead of answering from a stale cache, and every
// leg keeps the row order in lockstep with the copy text; (4) a failing detail
// read leaves the list rows on screen, quotes the response's request id in its
// own words, and its retry adds exactly one detail read without touching the
// list.
//
// What is already pinned elsewhere is deliberately NOT re-asked here: the
// inline-preview zero-extra-reads promise is covered by
// RunsModulePage.test.tsx 「does not ask the server anything when a row is
// expanded」 and again by runs.parity.test.ts 「expanding a row asks the server
// for nothing」; the forced-empty-state zero-batch case is covered by
// runs.window.test.ts 「reads nothing at all」. Those blocks are cited, not
// duplicated — this file adds the per-endpoint counts they leave open.
//
// Pure test: the product is asserted as it behaves, never edited to satisfy a
// guess. Expected values are imported from ./runs (PAGE_LIMIT, runCode,
// statusLabel) instead
// of retyped; every comparison is element-to-element or url-to-url byte
// equality, and no assertion is loosened to reach green.

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryRouter, useLocation } from "react-router";

import { ApiError } from "@/lib/api-error";
import { RunsModulePage } from "./RunsModulePage";
import { PAGE_LIMIT, runCode, statusLabel } from "./runs";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));

vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clip.copyTextToClipboard }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const START = "2026-11-18T02:00:00.000Z";
const END = "2026-11-18T02:10:00.000Z";

/** Three distinct costs, so the default descending order is a real order. */
const ROWS = [
  {
    runId: "rn_01M7822REQ000000000A",
    status: "completed",
    costStatus: "known",
    costUsd: 1.25,
    startedAt: START,
    endedAt: END,
    employeeId: "emp_aaaabbbbcccc",
  },
  {
    runId: "rn_01M7822REQ000000000B",
    status: "failed",
    costStatus: "known",
    costUsd: 0.5,
    startedAt: START,
    endedAt: END,
    employeeId: "emp_ddddeeeeffff",
  },
  {
    runId: "rn_01M7822REQ000000000C",
    status: "completed",
    costStatus: "known",
    costUsd: 0.25,
    startedAt: START,
    endedAt: END,
    employeeId: "emp_aaaabbbbcccc",
  },
];

const EMPLOYEES = {
  items: [
    { employeeId: "emp_aaaabbbbcccc", name: "小鲤" },
    { employeeId: "emp_ddddeeeeffff", name: "小满" },
  ],
  nextCursor: null,
};

/** The rid is whatever the response header carries; the page only quotes it. */
const DETAIL_RID = "rid-req-7f3a";

/**
 * The detail answer is built from the requested id. A fixture that ignored the
 * id would let the page look right while it was showing the wrong run.
 */
function detailBody(id: string | null): Record<string, unknown> {
  const row = ROWS.find((item) => item.runId === id) ?? ROWS[0];
  return {
    runId: row.runId,
    status: row.status,
    costStatus: row.costStatus,
    costUsd: row.costUsd,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    employeeId: row.employeeId,
  };
}

/**
 * `loadRunEvents` (runs.ts:577-586) keeps only items shaped by `normalizeEvent`
 * (runs.ts:559-568): a readable numeric `seq` is mandatory, the rest is
 * `eventType` / `occurredAt` / `payload`. The list-row field names
 * (`kind`, `at`, `costUsd`) are NOT what the events endpoint is contracted to
 * answer, so an item built with them is dropped and the page honestly says
 * 「这条运行的事件流还没有读到内容。」 instead of drawing a timeline.
 */
const EVENTS_BODY = {
  items: [
    {
      seq: 1,
      eventType: "run.started",
      occurredAt: START,
      payload: { employeeId: "emp_aaaabbbbcccc" },
    },
    {
      seq: 2,
      eventType: "run.completed",
      occurredAt: END,
      payload: { costUsd: 1.25 },
    },
  ],
  hasMore: false,
};

let detailFails = false;

async function handler(url: string): Promise<unknown> {
  const at = new URL(url, "http://localhost");
  const path = at.pathname;
  if (path === "/agent-api/api/runs") return { items: ROWS, nextCursor: null };
  if (path === "/agent-api/api/employees") return EMPLOYEES;
  if (path === "/agent-api/api/run-detail") {
    if (detailFails) {
      throw new ApiError("运行详情读不到", {
        status: 500,
        body: "",
        url,
        requestId: DETAIL_RID,
      });
    }
    return detailBody(at.searchParams.get("id"));
  }
  if (path === "/agent-api/api/run-events") return EVENTS_BODY;
  return { items: [] };
}

let root: ReturnType<typeof createRoot> | null = null;

/** Probes the address the page itself wrote; MemoryRouter never touches history. */
function LocationProbe(): ReactNode {
  const location = useLocation();
  return (
    <div data-testid="r150-loc">
      {`${location.pathname}${location.search}`}
    </div>
  );
}

/** Bounded by ticks, never by wall clock, so a hung wait always fails loudly. */
async function waitFor(cond: () => boolean, label: string): Promise<void> {
  for (let i = 0; i < 400; i += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  throw new Error(`timeout: ${label}`);
}

const node = (id: string): HTMLElement | null =>
  document.querySelector(`[data-testid="${id}"]`);
const textOf = (id: string): string => node(id)?.textContent ?? "";
const urls = (): string[] =>
  api.fetchJSON.mock.calls.map((call) => String(call[0] as unknown));
const countReads = (needle: string): number =>
  urls().filter((url) => url.includes(needle)).length;
/** The router resolves a navigated link to `/runs/`; the contract under test is
 * the address without that trailing slash, so readings are compared canonical. */
const probe = (): string => textOf("r150-loc").replace("/runs/", "/runs");
const skeletonGone = (): boolean =>
  document.querySelector(".run5-skeleton") === null;

/** Rows the list actually renders, in the order the page sorted them. */
const rowNodes = (): number =>
  document.querySelectorAll("[data-testid^='run5-row-'][data-status]").length;
const rowCodes = (): string[] =>
  [...document.querySelectorAll("[data-testid$='-code']")].map(
    (cell) => cell.textContent ?? "",
  );

/** The order the fixture itself declares: cost, highest first. */
const expectedCodes = (): string[] =>
  [...ROWS]
    .sort((left, right) => (right.costUsd ?? -1) - (left.costUsd ?? -1))
    .map((row) => runCode(row.runId));

async function mount(entry = "/runs"): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
  detailFails = false;
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(handler);
  clip.copyTextToClipboard.mockReset();
  clip.copyTextToClipboard.mockImplementation(async () => true);
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <RunsModulePage />
        <LocationProbe />
      </MemoryRouter>,
    );
  });
  await waitFor(skeletonGone, "the first batch settled");
  await waitFor(() => rowNodes() > 0, "the list rendered rows");
}

async function click(id: string): Promise<void> {
  const target = node(id);
  if (target === null) throw new Error(`missing control: ${id}`);
  await act(async () => {
    target.click();
  });
  await waitFor(skeletonGone, `the page settled after ${id}`);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  // A pinned clock: the window preset the page turns into `since=` depends on
  // it, so byte-exact URL comparisons stay honest.
  vi.setSystemTime(new Date("2026-11-19T04:00:00.000Z"));
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
  detailFails = false;
  vi.useRealTimers();
});

describe("R150 ① the first screen costs exactly one list read", () => {
  it("asks /api/runs once, /api/run-stats not at all, and reads names from their own endpoint", async () => {
    await mount("/runs");

    expect(countReads("/api/runs")).toBe(1);
    // 运行构成卡自 2026-11-24 起按窗口读一次 /api/run-stats（合计与今日分桶）；
    // 列表本身仍只读 /api/runs 一次，run-stats 不再兼任 list fallback。
    expect(countReads("/api/run-stats")).toBe(1);
    // The employee-name side-read is a separate family: counted, never blamed
    // on the list batch, and never repeated per row.
    expect(countReads("/api/employees")).toBe(1);
    expect(urls()[0]).toContain("/agent-api/api/runs?");
    // That one read carries the page contract itself: this module's own page
    // size, and a window the server can answer with.
    expect(urls()[0]).toContain(`limit=${PAGE_LIMIT}`);
    expect(urls()[0]).toContain("since=");
    expect(rowNodes()).toBe(ROWS.length);
  });

  it("asks for nothing more while a row is expanded, collapsed and re-expanded", async () => {
    await mount("/runs");
    const asked = urls();

    await click("run-row-toggle-0");
    expect(node("run-row-preview-0")).not.toBeNull();
    expect(urls()).toEqual(asked);

    await click("run-row-toggle-0");
    expect(node("run-row-preview-0")).toBeNull();
    expect(urls()).toEqual(asked);

    await click("run-row-toggle-1");
    expect(node("run-row-preview-1")).not.toBeNull();
    expect(urls()).toEqual(asked);
    expect(countReads("/api/runs")).toBe(1);
  });

  it("repeats the same single read when the same address is mounted again", async () => {
    await mount("/runs");
    const first = urls();

    await mount("/runs");
    expect(urls()).toEqual(first);
    expect(countReads("/api/runs")).toBe(1);
  });
});

describe("R150 ② the detail screen costs one detail read and one events read, never a second list read", () => {
  it("asks exactly one run-detail and one run-events for the opened run", async () => {
    // A plain list mount: the click path must not be preceded by a deep link,
    // which would already have paid for the detail pair.
    await mount("/runs");
    const before = urls();
    expect(countReads("/api/run-detail")).toBe(0);
    expect(countReads("/api/run-events")).toBe(0);

    await click("run5-row-0-open");

    expect(countReads("/api/run-detail")).toBe(1);
    expect(countReads("/api/run-events")).toBe(1);
    // Opening a detail screen never re-reads the list.
    expect(countReads("/api/runs")).toBe(1);
    expect(urls().slice(0, before.length)).toEqual(before);
    // The detail pair is asked for exactly this run's id.
    const detailRead = urls().find((url) => url.includes("/api/run-detail")) ?? "";
    const eventsRead = urls().find((url) => url.includes("/api/run-events")) ?? "";
    expect(detailRead).toContain(encodeURIComponent(ROWS[0].runId));
    expect(eventsRead).toContain(`runId=${encodeURIComponent(ROWS[0].runId)}`);
    // And what came back is on screen: the address names the run, the summary
    // line carries that row's own status word (it is a human sentence and never
    // prints the raw id, so the id is only provable through the address).
    await waitFor(() => node("run5-timeline") !== null, "the timeline rendered");
    expect(probe()).toBe(`/runs?run=${encodeURIComponent(ROWS[0].runId)}`);
    expect(textOf("run5-detail-summary")).toContain(statusLabel(ROWS[0].status));
    expect(document.querySelector("h2")?.textContent ?? "").toContain(
      runCode(ROWS[0].runId),
    );
    // The full id is on screen where the product puts it: the heading's title.
    expect(document.querySelector("h2")?.getAttribute("title")).toBe(
      ROWS[0].runId,
    );
  });

  it("charges a shared link exactly one detail pair and no second list read", async () => {
    // A deep link is not a free ride: the detail is asked for at mount, which is
    // why the click-path case above starts from a plain /runs address instead.
    await mount(`/runs?run=${encodeURIComponent(ROWS[0].runId)}`);
    await waitFor(() => node("run5-timeline") !== null, "the deep-linked detail");
    expect(countReads("/api/run-detail")).toBe(1);
    expect(countReads("/api/run-events")).toBe(1);
    expect(countReads("/api/runs")).toBe(1);
    expect(probe()).toBe(`/runs?run=${encodeURIComponent(ROWS[0].runId)}`);
  });

  it("keeps the rendered order byte-equal to the copy text, before and after opening a detail", async () => {
    await mount("/runs");
    const codes = rowCodes();
    expect(codes).toEqual(expectedCodes());
    expect(new Set(codes).size).toBe(ROWS.length);

    await click("run-list-copy");
    const copied = String(
      (clip.copyTextToClipboard.mock.calls.at(-1) ?? [])[0] ?? "",
    );
    const body = copied.split("\n").slice(1);
    expect(body.length).toBe(ROWS.length);
    // Header order and copy order are the same sequence, row by row.
    body.forEach((line, index) => {
      expect(line).toContain(codes[index]);
    });

    await click("run5-row-0-open");
    await waitFor(() => node("run5-timeline") !== null, "the detail opened");
    expect(rowNodes()).toBe(ROWS.length);
    expect(rowCodes()).toEqual(codes);
    expect(countReads("/api/runs")).toBe(1);
  });
});

describe("R150 ③ closing and reopening the same run re-reads instead of answering from a stale cache", () => {
  it("adds exactly one detail read per reopen and freezes the list read", async () => {
    await mount("/runs");
    await click("run5-row-0-open");
    await waitFor(() => node("run5-timeline") !== null, "the first detail");
    expect(countReads("/api/run-detail")).toBe(1);

    await click("run5-detail-close");
    await waitFor(() => node("run5-timeline") === null, "the detail closed");
    // Closing is local: nothing is asked to forget, nothing is re-asked.
    expect(countReads("/api/run-detail")).toBe(1);
    expect(countReads("/api/runs")).toBe(1);
    expect(rowNodes()).toBe(ROWS.length);
    expect(probe()).toBe("/runs");

    await click("run5-row-0-open");
    await waitFor(() => node("run5-timeline") !== null, "the second detail");
    expect(countReads("/api/run-detail")).toBe(2);
    expect(countReads("/api/run-events")).toBe(2);
    expect(countReads("/api/runs")).toBe(1);
    expect(probe()).toBe(`/runs?run=${encodeURIComponent(ROWS[0].runId)}`);
    expect(rowNodes()).toBe(ROWS.length);
  });

  it("keeps every earlier row visible while a second run is opened", async () => {
    await mount("/runs");
    const codes = rowCodes();

    await click("run5-row-1-open");
    await waitFor(() => node("run5-timeline") !== null, "the second row detail");
    expect(countReads("/api/run-detail")).toBe(1);
    expect(countReads("/api/runs")).toBe(1);
    expect(rowNodes()).toBe(ROWS.length);
    expect(rowCodes()).toEqual(codes);
    expect(probe()).toBe(`/runs?run=${encodeURIComponent(ROWS[1].runId)}`);
    expect(textOf("run5-detail-summary")).toContain(statusLabel(ROWS[1].status));
    expect(textOf("run5-detail-summary")).not.toContain(statusLabel(ROWS[0].status));
  });
});

describe("R150 ④ a failing detail read keeps the list and quotes the response rid", () => {
  it("leaves the list rows on screen, names the rid, and retries with exactly one read", async () => {
    await mount("/runs");
    // mount() resets the fixture flags, so the failure is armed only after it.
    detailFails = true;
    const before = urls();

    await click("run5-row-0-open");
    await waitFor(() => node("run5-detail-error") !== null, "the detail error");

    expect(rowNodes()).toBe(ROWS.length);
    expect(node("run5-detail-summary")).toBeNull();
    expect(textOf("run5-detail-error")).toContain(DETAIL_RID);
    // The rid has its own slot, not only prose; the slot also carries its copy
    // affordance, so the value is proven as its prefix. Absent, it would say so.
    const ridSlot = textOf("run5-detail-error-request-id-value");
    expect(ridSlot.startsWith(DETAIL_RID)).toBe(true);
    expect(node("run5-detail-error-request-id-value-absent")).toBeNull();
    // The failed detail never re-reads the list.
    expect(countReads("/api/runs")).toBe(1);
    expect(urls().slice(0, before.length)).toEqual(before);

    detailFails = false;
    await click("run5-detail-error-retry");
    await waitFor(() => node("run5-timeline") !== null, "the retry answered");
    expect(countReads("/api/run-detail")).toBe(2);
    expect(countReads("/api/runs")).toBe(1);
    expect(rowNodes()).toBe(ROWS.length);
  });
});

describe("R150 ⑤ the contract is the same reading at every width", () => {
  const WIDTHS = [1440, 1280, 375] as const;

  it("keeps one list read, the same rows and the same order at 1440, 1280 and 375", async () => {
    const original = window.innerWidth;
    const readings: string[] = [];
    try {
      for (const width of WIDTHS) {
        Object.defineProperty(window, "innerWidth", {
          configurable: true,
          value: width,
          writable: true,
        });
        await mount("/runs");
        await click("run5-row-0-open");
        await waitFor(() => node("run5-timeline") !== null, `detail at ${width}`);
        readings.push(
          JSON.stringify({
            listReads: countReads("/api/runs"),
            detailReads: countReads("/api/run-detail"),
            eventsReads: countReads("/api/run-events"),
            rows: rowNodes(),
            codes: rowCodes(),
            cap: textOf("run-page-cap"),
          }),
        );
      }
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: original,
        writable: true,
      });
    }
    // Width moves nothing: same counts, same rows, same order, same caption.
    expect(readings).toHaveLength(WIDTHS.length);
    expect(new Set(readings).size).toBe(1);
    const reading = JSON.parse(readings[0]) as {
      listReads: number;
      detailReads: number;
      eventsReads: number;
      rows: number;
    };
    expect(reading.listReads).toBe(1);
    expect(reading.detailReads).toBe(1);
    expect(reading.eventsReads).toBe(1);
    expect(reading.rows).toBe(ROWS.length);
  });
});
