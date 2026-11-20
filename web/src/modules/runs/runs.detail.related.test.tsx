// @vitest-environment jsdom
// R227 · the association fields of a run row across its three carriers —
// screen cells, the copied text, and the exported CSV — plus a payload whose
// association values carry the wrong JSON types.
//
// Scope read against the existing files (covered, deliberately NOT rewritten):
//
//   ② deep link asks exactly one detail pair and no second list read —
//      `runs.requests.test.tsx` 「asks exactly one run-detail and one run-events
//      for the opened run」/「charges a shared link exactly one detail pair and
//      no second list read」; the pane itself is opened in
//      `RunsModulePage.test.tsx` 「the deep link opens the same pane and 关闭
//      clears it」. Below only a consolidated reopen-count lock rides along.
//   ③ closing keeps filters/cursor, reopening costs no extra list read —
//      `runs.requests.test.tsx` 「adds exactly one detail read per reopen and
//      freezes the list read」; byte-equal order across detail open/close is its
//      「keeps the rendered order byte-equal to the copy text, before and after
//      opening a detail」.
//   ① partial (screen vs preview per field, including the two documented
//      divergences dash/「该字段未返回」) — `runs.parity.test.tsx` it C;
//      preview↔copy↔CSV for complete rows — `runs.parity.test.ts`
//      「says the same thing in the preview, the copied text and the CSV」.
//
// What was missing, and is closed here:
//
//   A. ONE gap row seen through all three carriers in the same frame: the row
//      copy uses label mode (「该字段未返回」words on status/ends), the list copy
//      uses dash mode (「—」), the CSV leaves empty fields — and none of the
//      three may impersonate another. The full run id exists on NO carrier:
//      runCode masks the screen, the copies and the CSV alike (masked-code
//      contract measured below).
//   B. wrong-typed association values (taskId an array, status a number,
//      costUsd a word-string, employeeId an object, startedAt a word-string)
//      normalize to gaps on all carriers: no raw nope/42/cheap/abc/[object
//      leaks to screen, copy or CSV.
//
// Field mapping stated as-is: the runs list has no rid column and no approval
// column — the association fields that exist are 运行编号(runCode), 任务号
// (taskLabel, detail disclosure only), 员工(employeeLabel) and 成本(costText);
// 「审批单号」 has no carrier in this domain and is recorded, not invented.

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));
vi.mock("@/lib/clipboard", () => clip);

import { RunsModulePage } from "./RunsModulePage";
import { employeeLabel, runCode } from "./runs";

const FIELD_MISSING = "该字段未返回";
const DASH = "—";
const RAW = "rn_01M7822REL0000000000000A1";
const BAD_RAW = "rn_01M7822BAD0000000000000B2";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  let guard = 0;
  while (!cond()) {
    if (++guard > 600) throw new Error(`waitFor: ${label} never became true`);
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
    root?.render(createElement(MemoryRouter, { initialEntries: [entry] }, createElement(RunsModulePage)));
  });
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const runsReads = (): number => urls().filter((url) => url.includes("/api/runs")).length;
const detailReads = (): number => urls().filter((url) => url.includes("/api/run-detail")).length;
const rows = (): number => document.querySelectorAll("[data-testid^='run5-row-'][data-status]").length;
const node = (testid: string): HTMLElement | null =>
  document.querySelector(`[data-testid='${testid}']`) as HTMLElement | null;
const cell = (index: number, field: string): string => node(`run5-row-${index}-${field}`)?.textContent ?? "";
const preview = (index: number, field: string): string =>
  node(`run-row-preview-${index}-${field}`)?.querySelector("dd")?.textContent ?? "";

/** `/api/runs` is the list leg; the two detail legs answer for `?run=`. */
const okList = (items: unknown[]) => async (url: string) => {
  if (url.includes("/api/run-detail")) return { ...(items[0] as object) };
  if (url.includes("/api/run-events")) return { items: [], hasMore: false };
  if (url.includes("/api/runs") || url.includes("/api/run-stats")) return { items, nextCursor: null };
  return { items: [] };
};

async function clickNode(testid: string): Promise<void> {
  const el = node(testid) as HTMLElement;
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/**
 * The exported CSV as logical lines. jsdom has no object URLs, so the export
 * click is intercepted at createObjectURL and the anchor click is neutralised.
 */
async function grabCsv(): Promise<string[]> {
  const captured: Blob[] = [];
  const origCreate = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  const origClick = HTMLAnchorElement.prototype.click;
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = ((b: Blob) => {
    captured.push(b);
    return "blob:intercepted";
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL;
  HTMLAnchorElement.prototype.click = () => {};
  try {
    await clickNode("run-list-export");
  } finally {
    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
    HTMLAnchorElement.prototype.click = origClick;
  }
  expect(captured.length).toBe(1);
  const text = await captured[0].text();
  return text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line !== "");
}

// A gap row: status/employee/ended/cost all absent, only started exists.
const REL = {
  runId: RAW,
  startedAt: "2026-11-18T02:00:00.000Z",
};
// Same shape with the association values carrying the wrong JSON types.
// (Measured on the way: n() accepts a numeric string like 「12.5」 as a figure,
// so the wrong-type fixture uses values no coercion can read: an array, a
// number for status, a word-string for cost, an object, a word-string time.)
const BAD = {
  runId: BAD_RAW,
  startedAt: "abc",
  taskId: ["nope"],
  status: 42,
  costUsd: "cheap",
  costStatus: "known",
  employeeId: { a: 1 },
};

beforeEach(() => {
  api.fetchJSON.mockReset();
  clip.copyTextToClipboard.mockReset();
  clip.copyTextToClipboard.mockResolvedValue(true);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("R227 run association carriers — one gap, three shapes", () => {
  it("① a gap row reads screen words, copy words and empty CSV fields without impersonating each other", async () => {
    api.fetchJSON.mockImplementation(okList([REL]));
    await render("/runs");
    await waitFor(() => rows() === 1, "one row");
    await clickNode("run-row-toggle-0");

    // Screen carrier: column dash, region gap word (documented divergence, it C).
    expect(cell(0, "status")).toBe(DASH);
    expect(preview(0, "status")).toBe(FIELD_MISSING);
    expect(preview(0, "ended")).toBe(FIELD_MISSING);
    expect(cell(0, "employee")).toBe("未指派");
    expect(preview(0, "employee")).toBe("未指派");
    // 任务号 has no list column; the approval concept never renders here.
    expect(document.body.textContent).not.toContain("审批单");

    // Row-copy carrier: label mode — 「该字段未返回」words, elapsed/cost keep
    // their own two-ends-or-dash rule; nothing impersonates the CSV or list.
    await clickNode("run-row-copy");
    await waitFor(() => clip.copyTextToClipboard.mock.calls.length === 1, "row copy written");
    const line = String(clip.copyTextToClipboard.mock.calls[0][0]);
    // runCode itself contains 「 · 」, so the segments are matched as a prefix,
    // never by splitting the whole line on the separator.
    expect(line.startsWith(`${runCode(RAW)} · ${FIELD_MISSING} · `)).toBe(true); // code + status gap word
    expect(line).toContain(FIELD_MISSING);
    expect(line).not.toContain(RAW); // masked-code contract on the copy face too
    expect(line).not.match(/undefined|null|NaN/);

    // List-copy carrier: dash mode — 「—」everywhere a gap sits, and also masked.
    await clickNode("run-list-copy");
    await waitFor(() => clip.copyTextToClipboard.mock.calls.length === 2, "list copy written");
    const listText = String(clip.copyTextToClipboard.mock.calls[1][0]);
    expect(listText).not.toContain(RAW);
    const dataRow = listText.split("\n")[1] ?? "";
    expect(dataRow.startsWith(`${runCode(RAW)},`)).toBe(true);
    expect(dataRow.split(",")[1]).toBe(DASH); // status dash, not the gap word
    expect(dataRow).not.toContain(FIELD_MISSING); // dash mode, not label mode
    expect(dataRow).not.match(/undefined|null/);

    // CSV carrier: gaps are empty fields, never 「—」 nor 「该字段未返回」.
    const grid = await grabCsv();
    expect(grid[0]).toBe("run,status,started,ended,elapsed,cost,employee");
    const cells = (grid[1] ?? "").split(",");
    expect(cells[0]).toBe(runCode(RAW));
    expect(cells[1]).toBe(""); // status
    expect(cells[2]).toBe("2026-11-18 10:00"); // started, the only value
    expect(cells[3]).toBe(""); // ended
    expect(cells[4]).toBe(""); // elapsed — one end open leaves the CSV field empty
    expect(cells[5]).toBe(""); // cost
    expect(cells[6]).toBe("未指派");
    expect(grid.join("\n")).not.toContain(DASH);
    expect(grid.join("\n")).not.toContain(FIELD_MISSING);
    expect(grid.join("\n")).not.toContain(RAW);

    // Employee label ownership: one helper, the same word everywhere.
    expect(cell(0, "employee")).toBe(employeeLabel(null, new Map()));

    // Consolidated deep-link lock (contract owner: runs.requests — this only
    // re-locks the counts in one fresh mount): a `?run=` cold load costs one
    // detail pair and its own single list read, and closing asks for nothing.
    const runsBefore = runsReads();
    await render(`/runs?run=${RAW}`);
    await waitFor(() => node("run5-detail") !== null, "detail pane from ?run=");
    expect(runsReads()).toBe(runsBefore + 1); // its own mount's list read, no more
    expect(detailReads()).toBe(1);
    const readsBefore = urls().length;
    await clickNode("run5-detail-close");
    await waitFor(() => node("run5-detail") === null, "detail closed");
    expect(urls().length).toBe(readsBefore); // closing asks for nothing
  });

  it("④ wrong-typed association values normalize to gaps on every carrier", async () => {
    api.fetchJSON.mockImplementation(okList([BAD]));
    await render("/runs");
    await waitFor(() => rows() === 1, "one row");

    const screen = document.body.textContent ?? "";
    expect(screen).not.toContain("nope");
    expect(screen).not.toContain("[object");
    expect(screen).not.toContain("cheap");
    expect(screen).not.toContain("abc");

    await clickNode("run-row-toggle-0");
    const region = node("run-row-preview-0")?.textContent ?? "";
    expect(region).not.toContain("nope");
    expect(region).not.toContain("cheap");
    expect(region).not.toContain("abc");

    await clickNode("run-row-copy");
    await waitFor(() => clip.copyTextToClipboard.mock.calls.length === 1, "row copy");
    const line = String(clip.copyTextToClipboard.mock.calls[0][0]);
    expect(line).not.toContain("nope");
    expect(line).not.toContain("cheap");
    expect(line).not.toContain("abc");

    const grid = await grabCsv();
    const row = grid[1] ?? "";
    expect(row).not.toContain("nope");
    expect(row).not.toContain("cheap");
    expect(row).not.toContain("abc");
    expect(row.startsWith(`${runCode(BAD_RAW)},`)).toBe(true);
  });

  it("③ wrong-typed fields collapse to gap wording without changing the row's identity", async () => {
    api.fetchJSON.mockImplementation(okList([BAD]));
    await render("/runs");
    await waitFor(() => rows() === 1, "row kept");
    // numeric status → falsy → column dash, region gap word
    expect(cell(0, "status")).toBe(DASH);
    await clickNode("run-row-toggle-0");
    expect(preview(0, "status")).toBe(FIELD_MISSING);
    // word-string cost never fabricates a figure even with costStatus known
    expect(node("run5-row-0-cost")?.textContent ?? "").not.toContain("$");
    // word-string time collapses to the gap wording on both faces
    expect(cell(0, "start")).toBe(DASH);
    expect(preview(0, "started")).toBe(FIELD_MISSING);
    // employee object collapses to 未指派 on both faces
    expect(cell(0, "employee")).toBe("未指派");
    expect(preview(0, "employee")).toBe("未指派");
    // no second list read happened just by rendering the bad row
    expect(runsReads()).toBe(1);
  });
});
