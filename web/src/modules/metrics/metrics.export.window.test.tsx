// @vitest-environment jsdom
/**
 * R264 — /metrics 导出×窗口×排序三值.
 *
 * A coverage sweep first, as the ticket requires, because most of this face is
 * already guarded and this file does NOT repeat it:
 * - `metrics.window.export.test.tsx:384` already proves 表体行数 == `met-row-copy-*`
 *   数 == 导出数据行数 and 首行分组名同源 at 24h, 7d and 30d, and `:413` proves the
 *   deep link and the control reach the same three values;
 * - the same file `:495` already proves a detail sort writes the sorted screen order
 *   into the file with no new read, and `:518` that the file stays the same generation
 *   as the table when the window moves under a chosen sort;
 * - and `:434`/`:464`/`:473` already prove an empty window keeps «—» instead of 0 and
 *   disarms the export with a title.
 *
 * What was genuinely unpinned, and is what this file adds:
 * 1. a REAL zero money amount inside an EXPORTED row at a non-default window. R116
 *    (`metrics.export.test.tsx`) proves the zero/gap wording only at the default 24h
 *    window, and R203's fixture has no zero row at all — so nothing held that a
 *    ledger row of exactly 0 reaches the CSV as `0.00` and the screen as `$0.00`
 *    while a MISSING amount stays «—» on screen and an empty field in the file.
 * 2. an explicit spy on `URL.createObjectURL` itself in the empty window. R203 proves
 *    the inert click captures no blob; this proves the download helper was never
 *    reached at all, and that the click costs no read either.
 *
 * Product behaviour only; nothing here changes the page or a testid.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));

vi.mock("@/modules/models/fetchJson", () => ({ fetchJsonStrict: api.fetchJsonStrict }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clip.copyTextToClipboard }));

import { MetricsModulePage } from "./MetricsModulePage";
import { beijingDayKey, formatUsd, usdDigits } from "./metrics";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FROZEN = "2026-11-19T12:00:00.000Z";
const FROZEN_MS = Date.parse(FROZEN);
const DAY = beijingDayKey(new Date(FROZEN_MS));
const DAY_MS = 86_400_000;

/** The Beijing ledger key `back` days before the frozen clock. */
function dayKey(back: number): string {
  return beijingDayKey(new Date(FROZEN_MS - back * DAY_MS));
}

const A = "emp_aaaabbbbcccc";
const B = "emp_ddddeeeeffff";
const C = "emp_iiiijjjjkkkk";
const D = "emp_ffff00001111";

const EMPLOYEES = {
  items: [
    { employeeId: A, name: "小鲤" },
    { employeeId: B, name: "小满" },
    { employeeId: C, name: "阿吉" },
    { employeeId: D, name: "阿元" },
  ],
  nextCursor: null,
};

/**
 * One row per employee, placed so the windows differ: 24h sees 小鲤/小满, 7d adds
 * 阿吉 with a REAL zero and 阿元 whose amount the ledger never returned. A missing
 * amount is the ABSENCE of `costUsd`, never a zero — that distinction is the whole
 * subject of the first case.
 */
const LEDGER_DAYS: { back: number; rows: { id: string; cost: number | null }[] }[] = [
  { back: 0, rows: [{ id: A, cost: 0.2 }, { id: B, cost: 0.5 }] },
  { back: 3, rows: [{ id: C, cost: 0 }] },
  { back: 5, rows: [{ id: D, cost: null }] },
];

/** `normal` answers every day; `recentBlank` blanks the last week's ledger only. */
let ledgerMode: "normal" | "recentBlank" = "normal";

function ledgerItems(period: string): Record<string, unknown>[] {
  const entry = LEDGER_DAYS.find((day) => dayKey(day.back) === period);
  if (entry === undefined) return [];
  if (ledgerMode === "recentBlank" && entry.back < 7) return [];
  return entry.rows.map((row) => {
    const item: Record<string, unknown> = {
      employeeId: row.id,
      period,
      periodKind: "day",
      updatedAt: `${period}T03:20:00.000Z`,
    };
    if (row.cost !== null) item.costUsd = row.cost;
    return item;
  });
}

const HEAT_CELLS = [
  { dow: 1, hour: 9, count: 4 },
  { dow: 2, hour: 10, count: 3 },
  { dow: 3, hour: 11, count: 2 },
];

/** Runs per window length, so the runs face is never what is under test. */
const STATS_BY_HOURS: Record<number, number> = { 24: 13, 48: 9, 168: 33, 336: 21, 720: 61, 1440: 44 };

function statsBody(at: URL): Record<string, unknown> {
  const hours = Math.round((FROZEN_MS - Date.parse(at.searchParams.get("from") ?? FROZEN)) / 3_600_000);
  const bucket = at.searchParams.get("bucket") ?? "hour";
  const runs = STATS_BY_HOURS[hours] ?? 5;
  const slots = bucket === "hour" ? 24 : Math.max(1, Math.round(hours / 24));
  return {
    from: at.searchParams.get("from"),
    to: at.searchParams.get("to"),
    bucket,
    slots,
    buckets: [{ bucketStart: dayKey(1), runs }],
    totals: { runs, succeeded: runs, failed: 0, running: 0, sampleCount: runs, successRate: 1 },
  };
}

async function handler(url: string): Promise<unknown> {
  const at = new URL(url, "http://localhost");
  const path = at.pathname;
  if (path.endsWith("/api/budget-usage")) {
    const period = at.searchParams.get("period") ?? "";
    if (at.searchParams.get("periodKind") === "month") {
      return {
        items: [{ employeeId: A, period: DAY.slice(0, 7), periodKind: "month", costUsd: 1.1, updatedAt: FROZEN }],
        missingEmployeeIds: [],
      };
    }
    const wanted = (at.searchParams.get("employeeId") ?? "").split(",");
    return {
      items: ledgerItems(period).filter((item) => wanted.includes(String(item.employeeId))),
      missingEmployeeIds: [],
    };
  }
  if (path.endsWith("/api/run-stats")) return statsBody(at);
  if (path.endsWith("/api/run-activity")) {
    return {
      cells: HEAT_CELLS,
      max: 4,
      from: "2026-11-12T16:00:00.000Z",
      to: `${DAY}T15:59:59.000Z`,
      tz: "Asia/Shanghai",
    };
  }
  if (path.endsWith("/api/employees")) return EMPLOYEES;
  if (path.endsWith("/api/hermes-usage")) {
    return { by_model: [], cost: { source: "cost_ledger", cost_usd: null, cost_status: "unknown", rows: 0, per_employee: [] }, asOf: `${DAY}T12:00:00.000Z` };
  }
  if (path.endsWith("/api/models/pricing")) throw new ApiError("not wired", { status: 404, body: "", url });
  return { items: [] };
}

let root: Root | null = null;

/** Bounded on ticks, never on the clock: `Date` is frozen for the ledger keys. */
async function waitFor(condition: () => boolean, label: string): Promise<void> {
  for (let tick = 0; tick < 600; tick += 1) {
    if (condition()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error(`waitFor: ${label} never became true`);
}

function q(id: string): Element | null {
  return document.querySelector(`[data-testid="${id}"]`);
}

function text(id: string): string {
  return (q(id)?.textContent ?? "").trim();
}

function urls(): string[] {
  return api.fetchJsonStrict.mock.calls.map((call) => String(call[0]));
}

function settled(): boolean {
  return document.querySelector(".met5-skeleton") === null;
}

/** A window switch fans out; wait until the batch has stopped growing. */
async function drain(): Promise<void> {
  let previous = -1;
  let stable = 0;
  for (let round = 0; round < 240 && stable < 6; round += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    const count = urls().length;
    stable = count === previous ? stable + 1 : 0;
    previous = count;
  }
  await waitFor(settled, "state settled");
}

async function mount(entry = "/metrics"): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation((url: unknown) => handler(String(url)));
  clip.copyTextToClipboard.mockReset();
  clip.copyTextToClipboard.mockImplementation(async () => true);
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <MetricsModulePage />
      </MemoryRouter>,
    );
  });
  await waitFor(settled, "initial batch");
  await drain();
}

async function click(id: string): Promise<void> {
  const button = q(id);
  if (button === null) throw new Error(`click: ${id} is missing`);
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await drain();
}

/** The page builds its CSV through `URL.createObjectURL` and an anchor click. */
function captureDownload(): {
  captured: { blob: Blob | null; name: string | null; created: number };
  restore: () => void;
} {
  const captured: { blob: Blob | null; name: string | null; created: number } = { blob: null, name: null, created: 0 };
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalAnchor = HTMLAnchorElement.prototype.click;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: (blob: Blob) => {
      captured.created += 1;
      captured.blob = blob;
      return "blob:r264";
    },
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: () => undefined });
  Object.defineProperty(HTMLAnchorElement.prototype, "click", {
    configurable: true,
    writable: true,
    value: function download(this: HTMLAnchorElement) {
      captured.name = this.download;
    },
  });
  return {
    captured,
    restore: () => {
      Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: originalCreate });
      Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: originalRevoke });
      Object.defineProperty(HTMLAnchorElement.prototype, "click", {
        configurable: true,
        writable: true,
        value: originalAnchor,
      });
    },
  };
}

/**
 * jsdom's `Blob#text()` decodes the UTF-8 BOM away, so the byte-order mark the
 * product writes is proved from the raw bytes above it.
 */
async function csvLines(blob: Blob | null): Promise<string[]> {
  expect(blob).not.toBeNull();
  const bytes = new Uint8Array(await blob!.arrayBuffer());
  expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const raw = await blob!.text();
  return raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.length > 0);
}

/** `#` lines are the totals and gap notes, never data. */
const csvData = (lines: string[]): string[] => lines.filter((line) => !line.startsWith("#"));
const splitCsv = (line: string): string[] => line.split(",");

/** The CSV money column, from the product's own header row. */
function csvMoneyColumn(header: string[]): number {
  const index = header.findIndex((cell) => cell.includes("USD") || cell.includes("成本"));
  expect(index).toBeGreaterThan(-1);
  return index;
}

function bodyRows(): Element[] {
  return [...document.querySelectorAll('[data-testid^="met6-row-"]')];
}

function rowName(row: Element): string {
  return (row.querySelector(".met6-rowname")?.textContent ?? "").trim();
}

/** Only the cell's own text nodes: `.met6-rowsub` is a note line, not the amount. */
function rowCells(row: Element): string[] {
  return [...row.querySelectorAll("td")].map((cell) =>
    [...cell.childNodes]
      .filter((part) => part.nodeType === 3)
      .map((part) => part.textContent ?? "")
      .join("")
      .trim(),
  );
}

/** Only the real buttons: `-status`, `-fallback` and `-fallback-text` share the prefix. */
function copyButtons(): HTMLButtonElement[] {
  return [...document.querySelectorAll('[data-testid^="met-row-copy-"]')].flatMap((node) => {
    const id = node.getAttribute("data-testid") ?? "";
    return /^met-row-copy-\d+$/.test(id) && node instanceof HTMLButtonElement ? [node] : [];
  });
}

beforeEach(() => {
  ledgerMode = "normal";
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(FROZEN));
  window.history.replaceState({}, "", "/");
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
  ledgerMode = "normal";
  vi.useRealTimers();
});

describe("R264 ① a real zero and a missing amount stay apart inside the exported file", () => {
  it("prints $0.00 on screen and 0.00 in the CSV for a zero, «—» and an empty field for a gap, at a non-default window", async () => {
    await mount("/metrics?window=7d");

    const rows = bodyRows();
    expect(rows.length).toBeGreaterThan(0);
    const money = rows.map((row) => rowCells(row)[1] ?? "");

    // The fixture's zero row and its gap row both have to be on screen, or the
    // rest of this case would prove nothing.
    const zeroIndex = money.findIndex((cell) => cell === formatUsd(0));
    const gapIndex = money.findIndex((cell) => cell === "—");
    expect(zeroIndex).toBeGreaterThan(-1);
    expect(gapIndex).toBeGreaterThan(-1);
    expect(zeroIndex).not.toBe(gapIndex);

    const capture = captureDownload();
    try {
      await click("met6-export");
      const lines = await csvLines(capture.captured.blob);
      const header = splitCsv(csvData(lines)[0] ?? "");
      const column = csvMoneyColumn(header);
      const data = csvData(lines).slice(1);

      // The file's row order is the table's row order, so the same index is the
      // same employee on both faces.
      expect(data.length).toBe(rows.length);
      expect(splitCsv(data[zeroIndex] ?? "")[0]).toBe(rowName(rows[zeroIndex]));
      expect(splitCsv(data[gapIndex] ?? "")[0]).toBe(rowName(rows[gapIndex]));

      // A zero is written as a number; a missing amount is written as nothing.
      expect(splitCsv(data[zeroIndex] ?? "")[column]).toBe(usdDigits(0));
      expect(splitCsv(data[gapIndex] ?? "")[column]).toBe("");

      // And the counts still agree across all three faces at this window.
      expect(copyButtons().length).toBe(rows.length);
      expect(data.length).toBe(copyButtons().length);
    } finally {
      capture.restore();
    }

    // The row copy carries the same split: the zero row says $0.00, the gap row
    // says «—» and never a money amount.
    const buttons = copyButtons();
    await act(async () => {
      buttons[zeroIndex]?.click();
    });
    const zeroPayload = String(clip.copyTextToClipboard.mock.calls.at(-1)?.[0] ?? "");
    expect(zeroPayload).toContain(formatUsd(0));
    await act(async () => {
      buttons[gapIndex]?.click();
    });
    const gapPayload = String(clip.copyTextToClipboard.mock.calls.at(-1)?.[0] ?? "");
    expect(gapPayload).toContain("—");
    expect(gapPayload).not.toContain(formatUsd(0));
  });
});

describe("R264 ② an empty window never reaches the download helper", () => {
  it("keeps the export disabled with a reason and spends no object URL and no request on a click", async () => {
    ledgerMode = "recentBlank";
    await mount("/metrics?window=7d");

    expect(bodyRows()).toHaveLength(0);
    expect(copyButtons()).toHaveLength(0);
    const exportButton = q("met6-export") as HTMLButtonElement | null;
    expect(exportButton).not.toBeNull();
    expect(exportButton?.disabled).toBe(true);
    expect(exportButton?.getAttribute("title") ?? "").not.toBe("");

    const before = urls().length;
    const capture = captureDownload();
    try {
      await click("met6-export");
      // Nothing was built, so nothing was ever handed to the download helper.
      expect(capture.captured.created).toBe(0);
      expect(capture.captured.blob).toBeNull();
      expect(capture.captured.name).toBeNull();
    } finally {
      capture.restore();
    }
    expect(urls().length).toBe(before);

    // The window still has runs; it is the ledger that is empty, so the page must
    // say «no rows» rather than inventing a zero-amount row.
    expect(text("met6-runs-value")).not.toBe("");
    expect(text("met6-table")).not.toContain("$0.00");
  });
});
