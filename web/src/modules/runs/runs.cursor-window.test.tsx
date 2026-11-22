// @vitest-environment jsdom
// Backlog runs-16 — the keyboard cursor survives the time-window switch.
// The row list remounts when the window changes (ListRows key={sinceKey});
// before this fix the single tab stop restarted at row zero and the user had
// to walk the list again. The parent now remembers the run id under the cursor
// and the remount re-seeds from it. Two boundaries are pinned here and neither
// crosses into the server pagination cursor, which still drops to page one on
// any window change (runs.more.test.tsx owns that contract).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { RunsModulePage } from "./RunsModulePage";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn(() => Promise.resolve(true)) }));

vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clip.copyTextToClipboard }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function runRow(tail: string) {
  return {
    runId: `rn_01M7822CURSOR${tail}`,
    employeeId: "emp_aaaabbbbcccc",
    status: "completed",
    costUsd: 1,
    costStatus: "known",
    startedAt: "2026-11-18T02:00:00.000Z",
    endedAt: "2026-11-18T02:11:00.000Z",
  };
}

const ROW_A = runRow("0A");
const ROW_B = runRow("0B");
const ROW_C = runRow("0C");

/**
 * The list read carries `since=<ISO>` computed at fetch time, and two reads of
 * the same window differ by milliseconds — so the window is told apart by how
 * far back the instant reaches (>14 days = the 30d ask), not by string match.
 */
function isLongWindow(url: string): boolean {
  const match = /[?&]since=([^&]+)/.exec(url);
  if (!match) return false;
  const at = Date.parse(decodeURIComponent(match[1]));
  return !Number.isNaN(at) && Date.now() - at > 14 * 86_400_000;
}

let shortShape: unknown[];
let longShape: unknown[];
function dispatch(url: string) {
  if (url.includes("/api/runs")) {
    return Promise.resolve({ items: isLongWindow(url) ? longShape : shortShape, nextCursor: null });
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

function rowEl(i: number): HTMLLIElement {
  return document.querySelector(`[data-testid='run5-row-${i}']`) as HTMLLIElement;
}

function bodyRows(): number {
  return document.querySelectorAll("[data-testid^='run5-row-'][data-status]").length;
}

async function click(testid: string) {
  const node = document.querySelector(`[data-testid="${testid}"]`);
  if (!node) throw new Error(`node not found: ${testid}`);
  await act(async () => {
    (node as HTMLElement).click();
  });
}

async function press(el: Element, key: string) {
  await act(async () => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

/** The row holding the single tab stop, or -1 when none does. */
function tabStopIndex(): number {
  for (let i = 0; i < bodyRows(); i += 1) {
    if (rowEl(i).tabIndex === 0) return i;
  }
  return -1;
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  shortShape = [ROW_A, ROW_B, ROW_C];
  longShape = [ROW_A, ROW_B, ROW_C];
  api.fetchJSON.mockImplementation(dispatch);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  document.body.replaceChildren();
});

describe("runs window switch keeps the keyboard cursor", () => {
  it("re-seeds the tab stop onto the same run in the new window", async () => {
    await mount("/runs");
    await waitFor(() => bodyRows() === 3, "three rows");

    rowEl(0).focus();
    await press(rowEl(0), "ArrowDown");
    await press(rowEl(1), "ArrowDown"); // cursor lands on run C (index 2)
    expect(tabStopIndex()).toBe(2);

    await click("run-window-30d");
    await waitFor(() => bodyRows() === 3, "relisted under the new window");

    // Same three runs came back; the cursor must still be on run C's row.
    expect(tabStopIndex()).toBe(2);
    // And navigation continues from there, not from a lost position.
    await press(rowEl(2), "ArrowUp");
    expect(tabStopIndex()).toBe(1);
  });

  it("falls back to the first row when the remembered run left the window", async () => {
    longShape = [ROW_A, ROW_B]; // run C left the visible set
    await mount("/runs");
    await waitFor(() => bodyRows() === 3, "three rows");

    rowEl(0).focus();
    await press(rowEl(0), "ArrowDown");
    await press(rowEl(1), "ArrowDown"); // cursor on run C
    expect(tabStopIndex()).toBe(2);

    await click("run-window-30d");
    await waitFor(() => bodyRows() === 2, "shorter list under the new window");

    // Run C is gone: the cursor clamps to the first row instead of dangling.
    expect(tabStopIndex()).toBe(0);
  });

  it("leaves the initial tab stop on the first row when the window never changed", async () => {
    await mount("/runs");
    await waitFor(() => bodyRows() === 3, "three rows");
    expect(tabStopIndex()).toBe(0);
  });
});
