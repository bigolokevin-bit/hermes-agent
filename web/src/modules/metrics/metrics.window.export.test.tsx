// @vitest-environment jsdom
/**
 * R203 — /metrics window switch keeps the exported CSV the same generation as the
 * table it mirrors (pure test, no product change).
 *
 * The four guards:
 *  ① after a window press the body row count, the `met-row-copy-*` count and the
 *     exported CSV's data-row count are the SAME number, and the CSV's first data
 *     row names the employee that is first on screen;
 *  ② switching INTO an empty window keeps missing money as «—» rather than 0,
 *     disarms both exports with a readable title, and switching back to a window
 *     that does have rows restores the same three-way agreement;
 *  ③ a detail-sort switch re-orders the export without asking the server anything;
 *  ④ an export click and a row-copy click cost zero requests.
 *
 * Cited, not duplicated: the 24h-only three-way equality
 * (`metrics.export.test.tsx:153-168`), the window switch's CSV row count and
 * header cell without the copy-button leg (`metrics.window.test.tsx:640-656`),
 * the row-copy payload after a switch (`:796-833`), the empty-window disabled +
 * title gate (`:762-783`), the file order against the DOM without a press
 * (`metrics.export-parity.test.ts:325-347`) and the sort-write-without-refetch
 * (`MetricsModulePage.test.tsx:2560`).
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));

vi.mock("@/modules/models/fetchJson", () => ({ fetchJsonStrict: api.fetchJsonStrict }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clip.copyTextToClipboard }));

import { MetricsModulePage } from "./MetricsModulePage";
import { beijingDayKey, formatCount, formatSharePct, formatUsd, sumOrNull } from "./metrics";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FROZEN = "2026-11-19T12:00:00.000Z";
const FROZEN_MS = Date.parse(FROZEN);
const DAY = beijingDayKey(new Date(FROZEN_MS));
const DAY_MS = 86_400_000;

/** The Beijing day key `back` days before the frozen clock. */
function dayKey(back: number): string {
  return beijingDayKey(new Date(FROZEN_MS - back * DAY_MS));
}

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

/**
 * Each employee holds one day row, so an employee appears in a window exactly when
 * that day is inside the window: 24h → 小鲤+小满, 7d adds 阿吉/阿元, 30d adds 小锦.
 * A missing cost is the ABSENCE of `costUsd`, never a zero.
 */
const LEDGER_DAYS: { back: number; rows: { id: string; cost: number | null }[] }[] = [
  { back: 0, rows: [{ id: A, cost: 0.2 }, { id: B, cost: 0.5 }] },
  { back: 2, rows: [{ id: C, cost: 0.3 }] },
  { back: 5, rows: [{ id: D, cost: null }] },
  { back: 20, rows: [{ id: E, cost: 0.4 }] },
];

/** `normal` answers every day; `emptyRecent` blanks the last week to reach an empty window. */
let ledgerMode: "normal" | "emptyRecent" = "normal";

function ledgerItems(period: string): Record<string, unknown>[] {
  const entry = LEDGER_DAYS.find((day) => dayKey(day.back) === period);
  if (entry === undefined) return [];
  if (ledgerMode === "emptyRecent" && entry.back < 7) return [];
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

/** Runs per window length, so the runs face really moves with the window. */
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
    totals: { runs, succeeded: runs, failed: 0, running: 0, sampleCount: runs, successRate: 1 },
  };
}

async function handler(url: string): Promise<unknown> {
  const at = new URL(url, "http://localhost");
  const path = at.pathname;
  if (path.endsWith("/api/budget-usage")) {
    const period = at.searchParams.get("period") ?? "";
    if (at.searchParams.get("periodKind") === "month") {
      return { items: [{ employeeId: A, period: DAY.slice(0, 7), periodKind: "month", costUsd: 1.1, updatedAt: FROZEN }], missingEmployeeIds: [] };
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
  if (path.endsWith("/api/models/pricing")) throw new ApiError("not wired", { status: 404, body: "", url });
  return { items: [] };
}
let root: Root | null = null;

function AddressProbe(): ReactNode {
  const location = useLocation();
  return <p data-testid="r203-loc">{location.search}</p>;
}

/** Bounded on ticks, never on the clock: `Date` is frozen in these tests. */
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
  return q(id)?.textContent?.trim() ?? "";
}

function face(id: string): string | null {
  const node = q(id);
  return node === null ? null : (node.textContent ?? "").trim();
}

function urls(): string[] {
  return api.fetchJsonStrict.mock.calls.map((call) => String(call[0]));
}

function settled(): boolean {
  return document.querySelector(".met5-skeleton") === null;
}

/** A window press fans out to several loaders; wait for the batch to quiet down. */
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
        <AddressProbe />
      </MemoryRouter>,
    );
  });
  await waitFor(settled, "initial batch");
  await drain();
}

async function click(node: Element): Promise<void> {
  await act(async () => {
    (node as HTMLElement).click();
  });
}

async function press(id: string): Promise<void> {
  const node = q(id);
  if (node === null) throw new Error(`press: control ${id} is missing`);
  await click(node);
  await drain();
}

function bodyRows(): Element[] {
  return [...document.querySelectorAll('[data-testid^="met6-row-"]')];
}

/** Share rows are keyed by slug in both groupings (met7 = model, met8 = employee). */
function shareRowIds(): string[] {
  return [...document.querySelectorAll('[data-testid]')]
    .map((node) => node.getAttribute("data-testid") ?? "")
    .filter((id) => /^(met7|met8)-row-/.test(id));
}

function rowName(row: Element): string {
  return row.querySelector(".met6-rowname")?.textContent?.trim() ?? "";
}

/** The value line of each cell only; `.met6-rowsub` carries a note, not a value. */
function rowCells(row: Element): string[] {
  return [...row.querySelectorAll("td")].map((cell) =>
    [...cell.childNodes]
      .filter((part) => part.nodeType === 3)
      .map((part) => part.textContent ?? "")
      .join("")
      .trim(),
  );
}

/** Only the real buttons: `met-row-copy-status`, `-fallback`, `-fallback-text` share the prefix. */
function copyButtons(): HTMLButtonElement[] {
  return [...document.querySelectorAll('[data-testid^="met-row-copy-"]')].flatMap((node) => {
    const id = node.getAttribute("data-testid") ?? "";
    return /^met-row-copy-\d+$/.test(id) && node instanceof HTMLButtonElement ? [node] : [];
  });
}

function screenRows(): { label: string; cost: string; count: string; share: string }[] {
  return bodyRows().map((row) => {
    const cells = rowCells(row);
    return { label: rowName(row), cost: cells[1] ?? "", count: cells[2] ?? "", share: cells[3] ?? "" };
  });
}

function usdOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\$-?\d[\d,]*(\.\d+)?$/.test(trimmed)) return null;
  const parsed = Number(trimmed.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function pctOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?%$/.test(trimmed)) return null;
  const parsed = Number(trimmed.slice(0, -1));
  return Number.isFinite(parsed) ? parsed : null;
}

/** The count column prints a plain integer or «—»; nothing else is readable. */
function countOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d[\d,]*$/.test(trimmed)) return null;
  const parsed = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/** The page builds its CSV through `URL.createObjectURL` and an anchor click. */
function captureDownload(): { captured: { blob: Blob | null; name: string | null }; restore: () => void } {
  const captured: { blob: Blob | null; name: string | null } = { blob: null, name: null };
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalAnchor = HTMLAnchorElement.prototype.click;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn((blob: Blob) => {
      captured.blob = blob;
      return "blob:r203";
    }),
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: vi.fn() });
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
      Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: originalCreate });
      Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: originalRevoke });
      Object.defineProperty(HTMLAnchorElement.prototype, "click", { configurable: true, writable: true, value: originalAnchor });
    },
  };
}

/** The BOM is proved on the raw bytes, because jsdom's `Blob#text()` decodes it away. */
async function csvLines(blob: Blob | null): Promise<string[]> {
  expect(blob).not.toBeNull();
  const bytes = new Uint8Array(await blob!.arrayBuffer());
  expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const raw = await blob!.text();
  return raw.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.length > 0);
}

const csvData = (lines: string[]): string[] => lines.filter((line) => !line.startsWith("#"));
const splitCsv = (line: string): string[] => line.split(",");

async function exportDetailCsv(): Promise<{ lines: string[]; name: string | null }> {
  const capture = captureDownload();
  try {
    await press("met6-export");
    const lines = await csvLines(capture.captured.blob);
    return { lines, name: capture.captured.name };
  } finally {
    capture.restore();
  }
}

/** The number the page itself claims it can export, read from its own state line. */
function claimedExportRows(): number | null {
  const match = text("metR-export-state").match(/可导 (\d+) 行/);
  return match === null ? null : Number(match[1]);
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

describe("R203 ① the table, the row copy controls and the exported file agree per window", () => {
  it("keeps three identical counts and the same first name at 24h, 7d and 30d", async () => {
    const expected = [
      { window: "24h", rows: 2, button: "met6-window-7d" },
      { window: "7d", rows: 4, button: "met6-window-30d" },
      { window: "30d", rows: 5, button: "met6-window-24h" },
    ];
    await mount("/metrics");
    const seen: number[] = [];
    for (const step of expected) {
      const rows = bodyRows().length;
      const copies = copyButtons().length;
      // One export per window: the file is generated locally, so asking twice
      // would only prove that nothing changes between two identical calls.
      const result = await exportDetailCsv();
      const data = csvData(result.lines);
      // 逐字三值相等：表体行数 == 行复制控件数 == 导出数据行数（表头除外）。
      expect(rows).toBe(step.rows);
      expect(copies).toBe(rows);
      expect(data.length - 1).toBe(rows);
      // 导出的第一条数据行（不是表头）点名的就是屏上第一行。
      expect(splitCsv(data[1] ?? "")[0]).toBe(rowName(bodyRows()[0] as Element));
      expect(claimedExportRows()).toBe(rows);
      seen.push(rows);
      await press(step.button);
    }
    // 非空壳护栏：三个窗口给出的行数确实不同，等式不是巧合。
    expect(new Set(seen).size).toBe(3);
  });

  it("reaches the same three values through the address as through the control", async () => {
    await mount("/metrics?window=30d");
    const linkRows = bodyRows().length;
    const linkCopies = copyButtons().length;
    const linkExport = csvData((await exportDetailCsv()).lines).length - 1;

    await mount("/metrics");
    await press("met6-window-30d");
    const pressRows = bodyRows().length;
    const pressCopies = copyButtons().length;
    const pressExport = csvData((await exportDetailCsv()).lines).length - 1;

    expect(pressRows).toBe(linkRows);
    expect(pressCopies).toBe(linkCopies);
    expect(pressExport).toBe(linkExport);
    expect(linkRows).toBe(5);
    expect(text("r203-loc")).toBe("?window=30d");
  });
});

describe("R203 ② an empty window says so without inventing zeros, and the agreement returns", () => {
  it("keeps «—» for missing money, disarms both exports, and re-agrees when the rows come back", async () => {
    ledgerMode = "emptyRecent";
    await mount("/metrics?window=30d");
    const richRows = bodyRows().length;
    expect(richRows).toBeGreaterThan(0);
    const richTotal = face("met6-cat-total");
    expect(richTotal).not.toBeNull();
    const richFirst = rowName(bodyRows()[0]);
    const richShare = shareRowIds().length;

    await press("met6-window-24h");
    // 空窗口：没有行，也没有行复制控件；合计行整块不渲（不是造一个 0）。
    expect(q("met6-cat-empty")).not.toBeNull();
    expect(bodyRows()).toHaveLength(0);
    expect(copyButtons()).toHaveLength(0);
    expect(q("metT-total-row")).toBeNull();
    for (const id of ["met6-cat-total", "metT-detail-total-cost", "metT-detail-total-count"]) {
      expect(q(id)).toBeNull();
    }
    // 缺失不是 0：任何在显示的面都不写 $0.00。
    // 空窗口没有任何行，所以“不造 0”只在还留在屏上的面上主张。
    expect(screenRows()).toHaveLength(0);
    for (const id of ["met6-runs-value", "met6-cost-value", "metAS-day"]) {
      const value = face(id);
      if (value !== null) expect(value).not.toContain("$0.00");
    }
    expect(text("met6-table")).not.toContain("$0.00");
    // 两个导出都不可用，并给出可读理由。
    const detailExport = q("met6-export") as HTMLButtonElement | null;
    const shareExport = q("metA-export") as HTMLButtonElement | null;
    expect(detailExport?.disabled).toBe(true);
    expect((detailExport?.getAttribute("title") ?? "").length).toBeGreaterThan(0);
    if (shareExport !== null) {
      expect((shareExport.getAttribute("title") ?? "").length).toBeGreaterThan(0);
    }
    // 不可用的控件按下去什么都不产生。
    const idleCapture = captureDownload();
    try {
      await press("met6-export");
      expect(idleCapture.captured.blob).toBeNull();
    } finally {
      idleCapture.restore();
    }
    const beforeReturn = urls().length;

    await press("met6-window-30d");
    // 切回有数据的窗口：三值重新逐字相等，且用的是这个窗口自己的数字。
    const rows = bodyRows().length;
    expect(rows).toBeGreaterThan(0);
    expect(copyButtons()).toHaveLength(rows);
    const lines = (await exportDetailCsv()).lines;
    expect(csvData(lines).length - 1).toBe(rows);
    expect(splitCsv(csvData(lines)[1] ?? "")[0]).toBe(richFirst);
    expect(shareRowIds().length).toBe(richShare);
    expect(claimedExportRows()).toBe(rows);
    expect(face("met6-cat-total")).toBe(richTotal);
    expect(urls().length).toBeGreaterThan(beforeReturn);
  });
});

describe("R203 ③ a detail sort re-orders the export without asking the server again", () => {
  it("writes the sorted screen order into the file and costs no new read", async () => {
    await mount("/metrics?window=30d");
    const before = urls();
    const namesBefore = screenRows().map((row) => row.label);
    const money = screenRows().map((row) => usdOrNull(row.cost));
    const ascending = [...namesBefore].slice().sort((left, right) => {
      const index = (name: string) => namesBefore.indexOf(name);
      return (money[index(left)] ?? Number.POSITIVE_INFINITY) - (money[index(right)] ?? Number.POSITIVE_INFINITY);
    });

    await press("metP-sort-cost");
    expect(text("r203-loc")).toBe("?window=30d&dsort=cost&ddir=asc");
    expect(q("metO-fmt-th-spend")?.getAttribute("aria-sort")).toBe("ascending");
    // 本地维：一次排序按下不许问服务器任何东西，连参数都不许多一个。
    expect(urls()).toEqual(before);

    const sorted = screenRows().map((row) => row.label);
    expect(sorted).toEqual(ascending);
    const lines = (await exportDetailCsv()).lines;
    expect(csvData(lines).slice(1).map((line) => splitCsv(line)[0])).toEqual(sorted);
    expect(csvData(lines).length - 1).toBe(copyButtons().length);
  });

  it("keeps the file the same generation as the table when the window moves under a chosen sort", async () => {
    await mount("/metrics?window=30d&dsort=cost&ddir=asc");
    expect(text("r203-loc")).toBe("?window=30d&dsort=cost&ddir=asc");
    const sortedNames = screenRows().map((row) => row.label);
    const lines = (await exportDetailCsv()).lines;
    expect(csvData(lines).slice(1).map((line) => splitCsv(line)[0])).toEqual(sortedNames);
    expect(csvData(lines).length - 1).toBe(bodyRows().length);
    expect(csvData(lines).length - 1).toBe(copyButtons().length);
  });
});

describe("R203 ④ exporting and copying are local: neither spends a request", () => {
  it("asks nothing new for a detail export, a row copy or a share export", async () => {
    await mount("/metrics?window=7d");
    const rows = bodyRows().length;
    expect(rows).toBeGreaterThan(0);

    const beforeExport = urls().length;
    const capture = captureDownload();
    try {
      await press("met6-export");
      expect(capture.captured.blob).not.toBeNull();
    } finally {
      capture.restore();
    }
    expect(urls().length).toBe(beforeExport);

    const beforeCopy = urls().length;
    const buttons = copyButtons();
    expect(buttons).toHaveLength(rows);
    for (const [index, button] of buttons.entries()) {
      await click(button);
      const payload = String(clip.copyTextToClipboard.mock.calls.at(-1)?.[0] ?? "");
      const row = screenRows()[index] as { label: string; cost: string; count: string; share: string };
      // 复制内容就是这一行屏上的四个值，用产品自己的格式化器算出来。
      expect(payload).toBe(
        [
          row.label,
          formatCount(countOrNull(row.count)),
          formatUsd(usdOrNull(row.cost)) ?? row.cost,
          formatSharePct(pctOrNull(row.share)) ?? row.share,
        ].join(" · "),
      );
    }
    expect(urls().length).toBe(beforeCopy);

    const share = q("metA-export");
    if (share !== null) {
      const beforeShare = urls().length;
      const shareCapture = captureDownload();
      try {
        await press("metA-export");
      } finally {
        shareCapture.restore();
      }
      expect(urls().length).toBe(beforeShare);
    }
  });

  it("counts the same money twice: the exported total line equals the on-screen total", async () => {
    await mount("/metrics?window=7d");
    const lines = (await exportDetailCsv()).lines;
    const comments = lines.filter((line) => line.startsWith("#"));
    const fromBody = formatUsd(sumOrNull(screenRows().map((row) => usdOrNull(row.cost))));
    expect(fromBody).not.toBeNull();
    expect(comments.some((line) => line.includes(fromBody ?? "###"))).toBe(true);
    expect(face("metT-detail-total-cost")).toBe(fromBody);
    // 小满那一行有真金额，另一行是缺失；两者在导出与屏上同句。
    expect(screenRows().some((row) => row.cost === "—")).toBe(true);
    // The same money the fixture puts inside a seven-day window, read from the
    // fixture itself instead of being retyped here.
    const fixtureMoney = LEDGER_DAYS.filter((day) => day.back < 7)
      .flatMap((day) => day.rows.map((row) => row.cost));
    expect(sumOrNull(screenRows().map((row) => usdOrNull(row.cost)))).toBe(
      sumOrNull(fixtureMoney),
    );
  });
});
