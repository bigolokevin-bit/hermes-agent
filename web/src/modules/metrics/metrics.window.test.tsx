// @vitest-environment jsdom
/**
 * R160 — /metrics window and view consistency guards (pure test, no product change).
 *
 * The page reads the statistical window straight out of the address and re-reads
 * every window-keyed endpoint when it changes. Four things are worth nailing down
 * that no existing file does together:
 *  ① one window switch moves the table body, the summary faces and the export
 *     counts in the SAME render, and nothing from the previous window survives;
 *  ② a detail sort switch only re-orders — it never costs a request;
 *  ③ switching into a window that has no rows keeps the gaps as «—» and says so
 *     in a readable empty state instead of inventing zeros;
 *  ④ the per-row copy controls follow the switch: same count, same order, and
 *     each payload is the text of the row rendered at that index.
 *
 * Covered elsewhere and deliberately NOT re-implemented: the refetch-free sort
 * write (`MetricsModulePage.test.tsx:2560`), the totals-are-sort-invariant sweep
 * and the link↔click identity (`metrics.summary.parity.test.tsx:417`, `:432`,
 * `:461`), the per-window CSV `窗口` column (`metrics.export-parity.test.ts:275`)
 * and the deep-link backfill (`metrics.viewurl.test.tsx`).
 *
 * Expected values are imported from ./metrics instead of retyped, and every
 * number the page shows is compared against the same fixture the page was given.
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigationType } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));

vi.mock("@/modules/models/fetchJson", () => ({ fetchJsonStrict: api.fetchJsonStrict }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clip.copyTextToClipboard }));

import { MetricsModulePage } from "./MetricsModulePage";
import {
  beijingDayKey,
  formatCount,
  formatSharePct,
  formatUsd,
  fanoutCoveredDays,
  FANOUT_REQUEST_BUDGET,
  shareCoverageNote,
  shareOf,
  sortDetailLines,
  sumOrNull,
  windowRange,
  type DetailSort,
  type SortDir,
} from "./metrics";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FROZEN = "2026-11-19T12:00:00.000Z";
const FROZEN_MS = Date.parse(FROZEN);
const DAY = beijingDayKey(new Date(FROZEN_MS));
const DAILY_MS = 86_400_000;

/** The Beijing ledger day `back` whole days before the frozen clock. */
function dayKey(back: number): string {
  return beijingDayKey(new Date(FROZEN_MS - back * DAILY_MS));
}

// --- fixture: five employees, ledger rows keyed by how many days back they sit ---

const A = "emp_aaaabbbbcccc";
const B = "emp_ddddeeeeffff";
const C = "emp_iiiijjjjkkkk";
const D = "emp_ffff00001111";
const E = "emp_222233334444";

const EMPLOYEES = {
  items: [
    { employeeId: A, name: "小鲤" },
    { employeeId: B, name: "小满" },
    { employeeId: C, name: "阿吉" },
    { employeeId: D, name: "阿元" },
    { employeeId: E, name: "小锦" },
  ],
  nextCursor: null,
};

/** A day of the ledger: `cost: null` means the upstream row has no money at all. */
type DayEntry = { back: number; rows: { id: string; cost: number | null }[] };

const LEDGER_DAYS: DayEntry[] = [
  { back: 0, rows: [{ id: A, cost: 0.2 }, { id: B, cost: 0.5 }, { id: C, cost: 0.05 }, { id: D, cost: 0 }] },
  { back: 1, rows: [{ id: A, cost: 0.1 }, { id: C, cost: null }, { id: E, cost: null }] },
  { back: 2, rows: [{ id: B, cost: 0.4 }] },
  { back: 10, rows: [{ id: C, cost: 1.2 }] },
  { back: 20, rows: [{ id: E, cost: 3 }] },
  { back: 24, rows: [{ id: A, cost: 0.6 }] },
];

/**
 * `normal` answers every day; `oldOnly` keeps only the days older than a week,
 * which is how a switch into 最近 24 小时 reaches a genuinely empty ledger.
 */
let ledgerMode: "normal" | "oldOnly" = "normal";

function ledgerItems(period: string): Record<string, unknown>[] {
  if (ledgerMode === "oldOnly" && dayAgeBack(period) < 7) return [];
  const entry = LEDGER_DAYS.find((day) => dayKey(day.back) === period);
  if (entry === undefined) return [];
  return entry.rows.map((row) => {
    const item: Record<string, unknown> = {
      employeeId: row.id,
      period,
      periodKind: "day",
      updatedAt: `${period}T03:20:00.000Z`,
    };
    // A missing value is the ABSENCE of the field, never a zero.
    if (row.cost !== null) item.costUsd = row.cost;
    return item;
  });
}

/** How many days back this Beijing ledger day sits from the frozen clock. */
function dayAgeBack(period: string): number {
  const found = LEDGER_DAYS.find((day) => dayKey(day.back) === period);
  if (found !== undefined) return found.back;
  return Math.round((FROZEN_MS - Date.parse(`${period}T00:00:00+08:00`)) / DAILY_MS);
}

const MONTH_ITEMS = [
  {
    employeeId: A,
    period: DAY.slice(0, 7),
    periodKind: "month",
    costUsd: 1.1,
    updatedAt: `${DAY}T02:00:00.000Z`,
  },
];

// --- run-stats: the answer depends only on how far back `from` reaches ---

const STATS_BY_HOURS: Record<number, number> = {
  24: 13,
  48: 9,
  168: 33,
  336: 21,
  720: 61,
  1440: 44,
};

function statsBody(at: URL): Record<string, unknown> {
  const from = at.searchParams.get("from") ?? FROZEN;
  const to = at.searchParams.get("to") ?? FROZEN;
  const bucket = at.searchParams.get("bucket") ?? "hour";
  const hours = Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 3_600_000));
  const runs = STATS_BY_HOURS[hours] ?? 0;
  const slots = bucket === "hour" ? 24 : Math.max(1, Math.round(hours / 24));
  const buckets = Array.from({ length: slots }, (_unused, index) => ({
    bucketStart: new Date(Date.parse(to) - (slots - 1 - index) * (bucket === "hour" ? 3_600_000 : DAILY_MS)).toISOString(),
    runs: index === 0 ? runs : 0,
  }));
  return {
    from,
    to,
    bucket,
    buckets,
    totals: {
      runs,
      succeeded: runs,
      failed: 0,
      running: 0,
      sampleCount: runs,
      successRate: runs === 0 ? null : 1,
    },
  };
}

// --- hermes-usage: `days=` is the window knob for the model axis ---

function usageBody(days: string): Record<string, unknown> {
  if (ledgerMode === "oldOnly" && days !== "30") return { by_model: [], cost: {}, asOf: null };
  const by_model =
    days === "1"
      ? [{ model: "alpha", api_calls: 9, input_tokens: 900, output_tokens: 90 }]
      : days === "7"
        ? [
            { model: "alpha", api_calls: 4, input_tokens: 400, output_tokens: 40 },
            { model: "zeta", api_calls: 6, input_tokens: 600, output_tokens: 60 },
          ]
        : [
            { model: "alpha", api_calls: 11, input_tokens: 1_100, output_tokens: 110 },
            { model: "zeta", api_calls: 6, input_tokens: 600, output_tokens: 60 },
            { model: "mid", sessions: 3, input_tokens: 300, output_tokens: 30 },
          ];
  return {
    by_model,
    cost: { source: "cost_ledger", cost_usd: null, cost_status: "unknown", rows: 0, per_employee: [] },
    asOf: `${DAY}T12:00:00.000Z`,
  };
}

// The heat grid has its own window key and never moves with `?window=`; four
// fixed cells make it a visible constant the sweep can point at.
const ACTIVITY = {
  cells: [
    { dow: 1, hour: 9, count: 4 },
    { dow: 2, hour: 10, count: 3 },
    { dow: 3, hour: 11, count: 2 },
    { dow: 4, hour: 14, count: 5 },
  ],
  max: 5,
  from: "2026-11-12T16:00:00.000Z",
  to: "2026-11-19T15:59:59.000Z",
  tz: "Asia/Shanghai",
};
const HEAT_TOTAL = ACTIVITY.cells.reduce((sum, cell) => sum + cell.count, 0);

async function handler(url: string): Promise<unknown> {
  const at = new URL(url, "http://localhost");
  const path = at.pathname;
  if (path.endsWith("/api/budget-usage")) {
    const period = at.searchParams.get("period") ?? "";
    if (at.searchParams.get("periodKind") === "month") return { items: MONTH_ITEMS, missingEmployeeIds: [] };
    const wanted = (at.searchParams.get("employeeId") ?? "").split(",");
    const items = ledgerItems(period).filter((item) => wanted.includes(String(item.employeeId)));
    return { items, missingEmployeeIds: [] };
  }
  if (path.endsWith("/api/run-stats")) return statsBody(at);
  if (path.endsWith("/api/hermes-usage")) return usageBody(at.searchParams.get("days") ?? "1");
  if (path.endsWith("/api/run-activity")) return ACTIVITY;
  if (path.endsWith("/api/employees")) return EMPLOYEES;
  if (path.endsWith("/api/models/pricing")) {
    throw new ApiError("not wired", { status: 404, body: "", url });
  }
  return { items: [] };
}

// --- harness ---

let root: Root | null = null;

function AddressProbe(): ReactNode {
  const location = useLocation();
  const navigation = useNavigationType();
  return (
    <>
      <p data-testid="r160-loc">{location.search}</p>
      <p data-testid="r160-nav">{navigation}</p>
    </>
  );
}

/**
 * Bounded on ticks, never on the clock: `Date` is frozen for the ledger keys,
 * so a wall-clock deadline would never expire.
 */
async function waitFor(condition: () => boolean, label: string): Promise<void> {
  for (let tick = 0; tick < 600; tick += 1) {
    if (condition()) return;
    await act(async () => {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 5);
      });
    });
  }
  throw new Error(`waitFor: ${label} never became true`);
}

function q(id: string): Element | null {
  return document.querySelector(`[data-testid="${id}"]`);
}

function text(id: string): string {
  return q(id)?.textContent ?? "";
}

function face(id: string): string | null {
  const node = q(id);
  return node === null ? null : (node.textContent ?? "");
}

function urls(): string[] {
  return api.fetchJsonStrict.mock.calls.map((call) => String(call[0]));
}

function settled(): boolean {
  return document.querySelector(".met5-skeleton") === null;
}

/** Pump until the request count stops moving, then until the page settles. */
async function drain(): Promise<void> {
  let stable = 0;
  let previous = urls().length;
  for (let round = 0; round < 240 && stable < 6; round += 1) {
    await act(async () => {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 10);
      });
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
  api.fetchJsonStrict.mockImplementation(handler);
  clip.copyTextToClipboard.mockReset();
  clip.copyTextToClipboard.mockImplementation(async () => true);
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <MetricsModulePage />
        <AddressProbe />
      </MemoryRouter>,
    );
  });
  await waitFor(settled, "initial batch");
  await drain();
}

async function press(id: string): Promise<void> {
  const button = q(id) as HTMLButtonElement | null;
  if (button === null) throw new Error(`press: control ${id} is missing`);
  await act(async () => {
    button.click();
  });
  await drain();
}

function loc(): string {
  return text("r160-loc");
}

function navType(): string {
  return text("r160-nav");
}

// --- DOM readings ---

function bodyRows(): Element[] {
  return [...document.querySelectorAll('[data-testid^="met6-row-"]')];
}

/** Text nodes only: the `.met6-rowsub` note under a figure is not the figure. */
function rowCells(row: Element): string[] {
  return [...row.querySelectorAll("td")].map((cell) =>
    [...cell.childNodes]
      .filter((part) => part.nodeType === 3)
      .map((part) => part.textContent ?? "")
      .join("")
      .trim(),
  );
}

function rowName(row: Element): string {
  return row.querySelector(".met6-rowname")?.textContent ?? "";
}

/** Only the real buttons: `met-row-copy-status`, `-fallback` and
 * `-fallback-text` share the same prefix and are not copy controls. */
function copyButtons(): HTMLButtonElement[] {
  return [...document.querySelectorAll("[data-testid^='met-row-copy-']")].flatMap(
    (node) => {
      const id = node.getAttribute("data-testid") ?? "";
      if (!/^met-row-copy-\d+$/.test(id)) return [];
      return node instanceof HTMLButtonElement ? [node] : [];
    },
  );
}

/** The money the body really shows, re-summed with the product's own reducer. */
function bodyMoney(): number | null {
  return sumOrNull(bodyRows().map((row) => usdOrNull(rowCells(row)[1] ?? "")));
}

function usdOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\$-?\d[\d,]*(\.\d+)?$/.test(trimmed)) return null;
  const parsed = Number(trimmed.slice(1).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d[\d,]*(\.\d+)?$/.test(trimmed)) return null;
  const parsed = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/** The percent a cell prints, or null when the cell is a gap marker. */
function pctOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?%$/.test(trimmed)) return null;
  const parsed = Number(trimmed.slice(0, -1));
  return Number.isFinite(parsed) ? parsed : null;
}

/** The page hands its CSV to `URL.createObjectURL` and an anchor click, so a
 * real export is captured from the blob rather than from a status line. */
function captureDownload(): {
  captured: { blob: Blob | null; name: string | null };
  restore: () => void;
} {
  const captured: { blob: Blob | null; name: string | null } = {
    blob: null,
    name: null,
  };
  const create = URL.createObjectURL;
  const revoke = URL.revokeObjectURL;
  const anchor = HTMLAnchorElement.prototype.click;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: (blob: Blob) => {
      captured.blob = blob;
      return "blob:r160";
    },
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: () => {},
  });
  Object.defineProperty(HTMLAnchorElement.prototype, "click", {
    configurable: true,
    writable: true,
    value: function (this: HTMLAnchorElement) {
      captured.name = this.download;
    },
  });
  return {
    captured,
    restore: () => {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        writable: true,
        value: create,
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        writable: true,
        value: revoke,
      });
      Object.defineProperty(HTMLAnchorElement.prototype, "click", {
        configurable: true,
        writable: true,
        value: anchor,
      });
    },
  };
}

/** The product prepends a UTF-8 BOM and joins rows with line breaks. The BOM is
 * proved on the raw bytes, because jsdom's `Blob#text()` decodes it away. */
async function csvLines(blob: Blob | null): Promise<string[]> {
  expect(blob).not.toBeNull();
  const bytes = new Uint8Array(await blob!.arrayBuffer());
  expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const text = await blob!.text();
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.length > 0);
}

const csvData = (lines: string[]): string[] =>
  lines.filter((line) => !line.startsWith("#"));
const csvComments = (lines: string[]): string[] =>
  lines.filter((line) => line.startsWith("#"));
const splitCsv = (line: string): string[] => line.split(",");

function shareRowIds(): string[] {
  return [...document.querySelectorAll("[data-testid]")]
    .map((node) => node.getAttribute("data-testid") ?? "")
    .filter((id) => /^(met7|met8)-row-/.test(id));
}

/** Faces that must move when the window moves. */
const MOVING_FACES = [
  "met6-runs-value",
  "met6-rate-value",
  "met6-cat-total",
  "metT-detail-total-cost",
  "metT-detail-total-share",
  "metX-detail-runs",
  "metAP-detail",
  "metR-export-state",
  "metA-export-count",
  "metU-copy-total",
];

/** Faces that are window-independent by design and must not move. */
const FIXED_FACES = [
  "met5-count",
  "metX-window-runs",
  "metX-heat-runs",
  "metAP-heat",
  "met6-cost-value",
  "met6-cost-month",
  "metAS-day",
  "metAS-month",
];

function faces(ids: string[]): Record<string, string | null> {
  const reading: Record<string, string | null> = {};
  for (const id of ids) reading[id] = face(id);
  return reading;
}

function readable(reading: Record<string, string | null>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, value] of Object.entries(reading)) {
    if (value !== null) out[id] = value;
  }
  return out;
}

/** Click a row's copy button and hand back what went to the clipboard. */
async function copiedPayload(index: number): Promise<string> {
  const button = copyButtons()[index];
  if (button === undefined) throw new Error(`copiedPayload: no copy button at index ${index}`);
  const before = urls().length;
  await act(async () => {
    button.click();
  });
  await drain();
  expect(urls().length).toBe(before);
  const last = clip.copyTextToClipboard.mock.calls.at(-1)?.[0];
  return String(last ?? "");
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

describe("R160 ① one window switch moves body, summaries and export counts together", () => {
  it("carries every window face to its own numbers and leaves no stale total behind", async () => {
    await mount("/metrics");
    // The default window is 最近 24 小时 and is NOT written into the address.
    expect(loc()).toBe("");
    expect(face("met6-window-24h")).not.toBeNull();
    expect(q("met6-window-24h")?.getAttribute("aria-pressed")).toBe("true");

    const heatBefore = face("met5-count");
    expect(heatBefore).toBe(String(HEAT_TOTAL));

    type Step = { id: string; window: string; runs: number; money: string | null; rows: number };
    const steps: Step[] = [
      { id: "met6-window-7d", window: "?window=7d", runs: STATS_BY_HOURS[168], money: "$1.25", rows: 5 },
      { id: "met6-window-30d", window: "?window=30d", runs: STATS_BY_HOURS[720], money: "$6.05", rows: 5 },
      { id: "met6-window-24h", window: "", runs: STATS_BY_HOURS[24], money: "$0.75", rows: 4 },
    ];

    let staleTotal: string | null = face("met6-cat-total");
    for (const step of steps) {
      const before = faces(MOVING_FACES);
      await press(step.id);

      // The address carries exactly this window and nothing else changed.
      expect(loc()).toBe(step.window);
      expect(navType()).toBe("REPLACE");
      expect(q(step.id)?.getAttribute("aria-pressed")).toBe("true");

      // 表体：行数与金额都换了代。
      expect(bodyRows().length).toBe(step.rows);
      const money = bodyMoney();
      expect(face("met6-cat-total")).toBe(formatUsd(money));
      expect(money === null ? null : formatUsd(money)).toBe(step.money);

      // 汇总卡：运行数与表体同源，各自跟着窗口走。
      expect(face("met6-runs-value")).toBe(formatCount(step.runs));
      // The window really is what was asked for, in the request itself.
      const range = windowRange(new Date(FROZEN_MS), step.window === "?window=7d" ? "7d" : step.window === "?window=30d" ? "30d" : "24h");
      expect(urls().some((url) => url.includes(`from=${encodeURIComponent(range.from)}`) && url.includes(`to=${encodeURIComponent(range.to)}`))).toBe(true);

      // 合计行与来源行是同一个表达式，两处都不残留上一窗口。
      expect(face("metT-detail-total-cost")).toBe(face("met6-cat-total"));
      for (const id of ["met6-cat-total", "metT-detail-total-cost"]) {
        if (staleTotal !== null && step.money !== null) expect(face(id)).not.toBe(staleTotal);
      }
      // The stale-value check reads the line that carries the TOTAL, not the
      // whole grid: one employee's own window sum may legitimately equal
      // another window's grand total, and that is not a stale face.
      const detailTable = q("met6-table");
      if (detailTable !== null && staleTotal !== null && staleTotal !== step.money) {
        const totalLine = q("met6-cat-source")?.textContent ?? "";
        expect(totalLine.includes(staleTotal)).toBe(false);
      }
      staleTotal = step.money;

      // 只有该换的才换：窗口无关的面一字不动。
      const fixed = faces(FIXED_FACES);
      expect(fixed["met5-count"]).toBe(heatBefore);
      expect(fixed["metX-window-runs"]).toBe(heatBefore);
      expect(fixed["metX-heat-runs"]).toBe(heatBefore);
      expect(fixed["metAP-heat"]).toBe(heatBefore);

      // 每个该动的面确实动了（防 vacuous 的整页对照）。
      const after = readable(faces(MOVING_FACES));
      const moved = Object.keys(readable(before)).filter((id) => after[id] !== readable(before)[id]);
      expect(moved.length).toBeGreaterThan(0);
    }
  });

  it("moves the export and share faces with the same switch", async () => {
    await mount("/metrics?window=7d");
    const shareCount = Number(text("metA-export-count").match(/\d+/)?.[0] ?? "-1");
    expect(shareCount).toBe(shareRowIds().length);
    expect(text("metR-export-state")).toContain(`可导 ${bodyRows().length} 行`);

    // 复制摘要的三个 token 与分摊合计行逐项同源。
    const summary = text("metU-copy-total");
    expect(summary).toContain(face("metT-share-total-runs") ?? "");
    expect(summary).toContain(face("metT-share-total-cost") ?? "");
    expect(summary).toContain(face("metT-share-total-share") ?? "");

    // 导出注释里的合计 = 屏上明细合计。The comment line only exists inside the
    // generated file, so the CSV itself is captured from the blob.
    const first = captureDownload();
    try {
      await press("met6-export");
      const lines = await csvLines(first.captured.blob);
      expect(csvData(lines).length).toBe(bodyRows().length + 1);
      expect(splitCsv(csvData(lines)[0] ?? "")[0]).toBe(q("met6-table")?.querySelector("th")?.textContent?.trim() ?? "");
      expect(csvComments(lines).some((line) => line.includes(face("metT-detail-total-cost") ?? ""))).toBe(true);
      expect(first.captured.name ?? "").toContain("metrics-detail-");
    } finally {
      first.restore();
    }

    await press("met6-window-30d");
    expect(shareRowIds().length).toBe(Number(text("metA-export-count").match(/\d+/)?.[0] ?? "-1"));
    expect(text("metR-export-state")).toContain(`可导 ${bodyRows().length} 行`);
    const second = captureDownload();
    try {
      await press("met6-export");
      const lines = await csvLines(second.captured.blob);
      expect(csvData(lines).length).toBe(bodyRows().length + 1);
      expect(splitCsv(csvData(lines)[0] ?? "")[0]).toBe(q("met6-table")?.querySelector("th")?.textContent?.trim() ?? "");
      expect(csvComments(lines).some((line) => line.includes(face("metT-detail-total-cost") ?? ""))).toBe(true);
    } finally {
      second.restore();
    }
  });
});

describe("R160 ② a detail sort switch re-orders without re-reading", () => {
  it("keeps every request count and every total frozen while the rows re-order", async () => {
    await mount("/metrics?window=30d");
    const before = urls();
    const names = bodyRows().map(rowName);
    const totalsBefore = {
      cost: face("metT-detail-total-cost"),
      count: face("metT-detail-total-count"),
      share: face("metT-detail-total-share"),
      cat: face("met6-cat-total"),
    };

    await press("metP-sort-runs");
    expect(loc()).toContain("dsort=runs");
    expect(navType()).toBe("REPLACE");
    // Not one new request, per endpoint family as well as in total.
    expect(urls()).toEqual(before);
    expect(q("metO-fmt-th-count")?.getAttribute("aria-sort")).toBe("descending");
    expect(paramsDir(loc())).toBe("desc");

    // The order on screen is exactly the product's own permutation.
    const key: DetailSort = "runs";
    const dir: SortDir = paramsDir(loc());
    const cells = bodyRows().map(rowCells);
    const lines = names.map((label, index) => ({
      label,
      count: numberOrNull(cells[index][2] ?? ""),
      costUsd: usdOrNull(cells[index][1] ?? ""),
      share: pctOrNull(cells[index][3] ?? ""),
    }));
    expect(bodyRows().map(rowName)).toEqual(sortDetailLines(lines, key, dir).map((line) => line.label));
    // …while nothing that aggregates moved.
    expect({
      cost: face("metT-detail-total-cost"),
      count: face("metT-detail-total-count"),
      share: face("metT-detail-total-share"),
      cat: face("met6-cat-total"),
    }).toEqual(totalsBefore);

    // A second press of the same column flips the direction — still no read.
    await press("metP-sort-runs");
    expect(loc()).toContain("ddir=asc");
    expect(q("metO-fmt-th-count")?.getAttribute("aria-sort")).toBe("ascending");
    expect(urls()).toEqual(before);
    expect({
      cost: face("metT-detail-total-cost"),
      count: face("metT-detail-total-count"),
      share: face("metT-detail-total-share"),
      cat: face("met6-cat-total"),
    }).toEqual(totalsBefore);

    // Back to the default sort: the keys leave the address, still no new read.
    await press("metP-sort-cost");
    expect(loc()).not.toContain("dsort");
    expect(loc()).not.toContain("ddir");
    expect(urls()).toEqual(before);
    expect(bodyRows().map(rowName)).toEqual(names);
  });
});

describe("R160 ③ switching into an empty window keeps gaps as gaps", () => {
  it("says the window is empty instead of writing zeros, and disarms the exports", async () => {
    ledgerMode = "oldOnly";
    await mount("/metrics?window=30d");
    // There IS money in the older days, so the switch has something to lose.
    const richMoney = face("met6-cat-total");
    expect(richMoney).not.toBeNull();
    expect(richMoney).not.toBe("—");
    expect(bodyRows().length).toBeGreaterThan(0);

    await press("met6-window-24h");

    // 空态可读，且表体、合计行、行复制控件一起退场。
    expect(q("met6-cat-empty")).not.toBeNull();
    expect(bodyRows()).toHaveLength(0);
    expect(copyButtons()).toHaveLength(0);
    expect(q("metT-total-row")).toBeNull();
    // With no lines the detail table and its source line unmount: the faces are
    // absent rather than drawn as a fabricated dash. The dash evidence comes
    // from the faces that DO stay on screen.
    expect(q("met6-cat-total")).toBeNull();
    expect(q("metT-detail-total-cost")).toBeNull();
    expect(q("metT-detail-total-count")).toBeNull();
    expect(face("met6-cost-value")).toBe("—");
    expect(face("metAS-day")).toBe("—");
    // 缺失不是 0：没有任何在显示的面写出 $0.00。
    for (const value of Object.values(readable(faces(MOVING_FACES)))) {
      expect(value).not.toContain("$0.00");
    }
    expect(text("metU-copy-total")).toContain("无可渲染行");
    // 上一窗口的金额不再出现在任何一处合计面上。
    for (const id of ["met6-cat-source", "metU-copy-total", "met6-cost-value"]) {
      const value = face(id);
      if (value !== null && richMoney !== null) expect(value).not.toContain(richMoney);
    }
    // 导出与复制都不可用，并给出可读理由。
    // 明细导出在无行时关闭；分摊导出的门不同：分摊视图回答了空集仍算「可用」，
    // 它只写表头并把计数报成 0 行，所以这里断言的是产品真实的门，不是想象的门。
    expect((q("met6-export") as HTMLButtonElement | null)?.disabled).toBe(true);
    expect((q("metA-export") as HTMLButtonElement | null)?.disabled).toBe(false);
    expect((q("met6-export")?.getAttribute("title") ?? "").length).toBeGreaterThan(0);
    expect((q("metA-export")?.getAttribute("title") ?? "").length).toBeGreaterThan(0);
    expect(Number(text("metA-export-count").match(/\d+/)?.[0] ?? "-1")).toBe(0);
    // 关闭的按钮按下去不产生任何文件，也不多发一次请求。
    const idle = captureDownload();
    try {
      const asked = urls().length;
      await press("met6-export");
      expect(idle.captured.blob).toBeNull();
      expect(idle.captured.name).toBeNull();
      expect(urls().length).toBe(asked);
    } finally {
      idle.restore();
    }
    // 分摊导出仍可出文件，只是只含表头。
    const headerOnly = captureDownload();
    try {
      await press("metA-export");
      const lines = await csvLines(headerOnly.captured.blob);
      expect(csvData(lines).length).toBe(1);
      expect(headerOnly.captured.name ?? "").toContain("metrics-share-");
    } finally {
      headerOnly.restore();
    }
    // 窗口无关的面按设计不动。
    expect(face("met5-count")).toBe(String(HEAT_TOTAL));
  });
});

describe("R160 ④ the row copy controls follow the window switch", () => {
  it("copies exactly what the row at the same index shows", async () => {
    await mount("/metrics?window=7d");
    const rows = bodyRows();
    expect(rows.length).toBe(5);
    expect(copyButtons().length).toBe(rows.length);

    // 真 0 的一行：屏上是 $0.00，复制也是 $0.00，不是「—」也不是空。
    const zeroIndex = rows.findIndex((row) => rowCells(row)[1] === "$0.00");
    expect(zeroIndex).toBeGreaterThan(-1);
    const zeroCells = rowCells(rows[zeroIndex]);
    expect(await copiedPayload(zeroIndex)).toBe(
      [rowName(rows[zeroIndex]), formatCount(numberOrNull(zeroCells[2] ?? "")), formatUsd(usdOrNull(zeroCells[1] ?? "")), formatSharePct(pctOrNull(zeroCells[3] ?? ""))].join(" · "),
    );

    // 缺失的一行：屏上是「—」，复制同一句。
    const gapIndex = rows.findIndex((row) => rowCells(row)[1] === "—");
    expect(gapIndex).toBeGreaterThan(-1);
    const gapCells = rowCells(rows[gapIndex]);
    expect(await copiedPayload(gapIndex)).toBe(
      [rowName(rows[gapIndex]), formatCount(numberOrNull(gapCells[2] ?? "")), formatUsd(usdOrNull(gapCells[1] ?? "")), formatSharePct(pctOrNull(gapCells[3] ?? ""))].join(" · "),
    );

    // 占比确实按同窗口合计算出，复制里的百分数与表体同源。
    const firstCells = rowCells(rows[0]);
    expect(pctOrNull(firstCells[3] ?? "")).toBe(shareOf(usdOrNull(firstCells[1] ?? ""), bodyMoney()));
  });

  it("keeps count, order and payload aligned with the body after a window switch", async () => {
    await mount("/metrics?window=7d");
    const payloadsBefore = [];
    for (let index = 0; index < bodyRows().length; index += 1) payloadsBefore.push(await copiedPayload(index));
    expect(payloadsBefore.length).toBe(bodyRows().length);
    const before = urls();

    await press("met6-window-30d");
    // 换窗口本身不额外取数（除了窗口键该取的那一批，已由 drain 收敛）。
    expect(urls().length).toBeGreaterThan(before.length);

    const rows = bodyRows();
    const buttons = copyButtons();
    expect(buttons.length).toBe(rows.length);
    expect(rows.length).toBe(5);
    for (let index = 0; index < rows.length; index += 1) {
      // 控件与行同序：按钮的 aria-label 点名的就是同序那行的名字。
      expect(buttons[index].getAttribute("aria-label")).toContain(rowName(rows[index]));
      const cells = rowCells(rows[index]);
      const payload = await copiedPayload(index);
      expect(payload).toBe(
        [rowName(rows[index]), formatCount(numberOrNull(cells[2] ?? "")), formatUsd(usdOrNull(cells[1] ?? "")), formatSharePct(pctOrNull(cells[3] ?? ""))].join(" · "),
      );
      // 复制不再产生任何请求。
      expect(urls().length).not.toBe(0);
    }
    // 与 7d 时的载荷不同：说明复制读的是当前窗口的行，不是缓存的旧行。
    const thirtyFirst = await copiedPayload(0);
    expect(thirtyFirst).not.toBe(payloadsBefore[0]);
  });
});

describe("R160 ⑤ the same readings at three widths", () => {
  it("keeps window switching identical at 1440, 1280 and 375", async () => {
    const original = window.innerWidth;
    const readings: string[] = [];
    try {
      for (const width of [1440, 1280, 375]) {
        Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
        await mount("/metrics?window=7d");
        const beforeSwitch = {
          runs: face("met6-runs-value"),
          cat: face("met6-cat-total"),
          rows: bodyRows().length,
          copies: copyButtons().length,
          export: text("metR-export-state"),
        };
        await press("met6-window-30d");
        readings.push(
          JSON.stringify({
            ...beforeSwitch,
            after: {
              runs: face("met6-runs-value"),
              cat: face("met6-cat-total"),
              rows: bodyRows().length,
              copies: copyButtons().length,
              loc: loc(),
            },
          }),
        );
      }
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: original });
    }
    expect(readings[1]).toBe(readings[0]);
    expect(readings[2]).toBe(readings[0]);
    expect(JSON.parse(readings[0]).after.rows).toBe(5);
  });
});

/** The direction the address carries for the detail axis (default is descending). */
function paramsDir(search: string): SortDir {
  return new URLSearchParams(search).get("ddir") === "asc" ? "asc" : "desc";
}

/*
 * MT-05 取数策略债的第一条：24 小时档在用量读口上被折叠成整天（days=1 的今日
 * 整日账）。卡里裁定「不改行为，只明示」，所以这里钉的是屏上那句话的在场与缺席，
 * 不是请求形制——请求仍走 `?days=1`，那是上面 R160 ① 已经钉过的契约。
 */
describe("MT-05 ⑥ the 24h window says it reads whole days", () => {
  it("writes the day caliber under the window buttons, verbatim", async () => {
    await mount("/metrics");
    // 默认档就是 24 小时，明示句才有理由出现。
    expect(q("met6-window-24h")?.getAttribute("aria-pressed")).toBe("true");
    const note = q("metU-24h-daycaliber-note");
    expect(note).not.toBeNull();
    expect(note?.textContent ?? "").toContain("该读口按整天记账，24 小时档取的是今日整日账。");
  });

  it("says nothing extra for a window that is whole days anyway", async () => {
    await mount("/metrics?window=7d");
    expect(q("met6-window-7d")?.getAttribute("aria-pressed")).toBe("true");
    expect(q("metU-24h-daycaliber-note")).toBeNull();
  });
});

/*
 * MT-05 的第二条：员工份额扇出的请求预算。纯函数例留在这里，是因为口径（预算、
 * 截断方向、什么时候才有这句话）本身就是这条腿的契约；DOM 侧的请求增量在
 * `metrics.requests.test.tsx` 里数。
 */
describe("MT-05 ⑦ the fan-out budget as a pure contract", () => {
  it("keeps the most recent days when the fan-out would exceed the budget", () => {
    expect(FANOUT_REQUEST_BUDGET).toBe(12);
    // 12 天 × 4 片 = 48 次 ⇒ 每片只保 3 天。
    expect(fanoutCoveredDays(12, 4)).toBe(3);
    // 预算内不动：7 天 × 1 片 = 7 次。
    expect(fanoutCoveredDays(7, 1)).toBe(7);
    // 30 天单片也要砍：30 > 12 ⇒ 12 天（每个分片至少保 1 天）。
    expect(fanoutCoveredDays(30, 1)).toBe(12);
    expect(fanoutCoveredDays(30, 4)).toBe(3);
    // 没有分片就没有扇出，整窗照读。
    expect(fanoutCoveredDays(30, 0)).toBe(30);
  });

  it("only speaks when a cut actually happened", () => {
    expect(shareCoverageNote(12, 3)).toBe("仅覆盖近 3 天，非全窗");
    expect(shareCoverageNote(30, 12)).toBe("仅覆盖近 12 天，非全窗");
    expect(shareCoverageNote(7, 7)).toBeNull();
  });
});
