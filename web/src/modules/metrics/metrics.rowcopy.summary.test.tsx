// @vitest-environment jsdom
/**
 * R267 — /metrics 汇总与行复制同值（纯测试）。
 *
 * Three guards, all on faces the page already shows:
 *  ① the names the cost card lists as its ledger snapshot are exactly the names the
 *     row-copy text begins with, and the money a copy carries is the money the row
 *     prints — same source, so neither face can rename or re-price an employee.
 *  ② after a detail sort the copy texts come in the table's new order, and the sort
 *     spends no request.
 *  ③ a real zero copies as `$0.00` and a missing amount copies as 「—」, each the
 *     same sentence the row shows, and copying spends no request.
 *
 * Deliberately NOT repeated (already pinned, cited rather than re-written):
 *  - `metrics.export.test.tsx:218-237` (R116) — a zero row's copy text at the
 *    default 24h window, and that exporting/copying issues no request.
 *  - `metrics.window.test.tsx:794-851` (R160) — a copy payload equals the four cells
 *    of its own row, before and after a WINDOW switch.
 *  - `metrics.window.export.test.tsx:494-527` (R203) — a sort press writes the
 *    sorted order into the exported file with no new read.
 *  - `metrics.export.window.test.tsx:394-399` (R264) — zero vs missing surviving into
 *    the CSV at a non-default window.
 * There is no `R109` anywhere in `web/src` (git grep: 0 hits); the metrics lineage is
 * metC / metK / metAA / metAJ / metAQ, which is what this file continues.
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
import { beijingDayKey, employeeLabel, formatUsd } from "./metrics";

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

/** The label each face prints for an employee, built by the product's own function. */
const idByLabel = new Map(
  EMPLOYEES.items.map((person) => [employeeLabel(person.name, person.employeeId), person.employeeId]),
);

/**
 * One employee per day, so an employee is in a window exactly when its day is:
 * 24h → 小鲤+小满, 7d adds 阿吉/阿元(real 0)/小锦(no amount at all). A missing amount
 * is the ABSENCE of `costUsd`; a zero is the number 0.
 */
const LEDGER_DAYS: { back: number; rows: { id: string; cost: number | null }[] }[] = [
  { back: 0, rows: [{ id: A, cost: 0.2 }, { id: B, cost: 0.5 }] },
  { back: 2, rows: [{ id: C, cost: 0.3 }] },
  { back: 3, rows: [{ id: E, cost: null }] },
  { back: 5, rows: [{ id: D, cost: 0 }] },
];

/**
 * The card's ledger snapshot is a MONTH read, which the page keeps window-independent.
 * Only employees that also hold a day row inside every window appear here, so the
 * snapshot names must be a subset of the copied names whatever the window says.
 */
const MONTH_ROWS = [
  { employeeId: A, costUsd: 1.1 },
  { employeeId: B, costUsd: 2.2 },
];

function ledgerItems(period: string): Record<string, unknown>[] {
  const entry = LEDGER_DAYS.find((day) => dayKey(day.back) === period);
  if (entry === undefined) return [];
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
        items: MONTH_ROWS.map((row) => ({
          employeeId: row.employeeId,
          period: DAY.slice(0, 7),
          periodKind: "month",
          costUsd: row.costUsd,
          updatedAt: FROZEN,
        })),
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
    // No `view` member: jsdom brand-checks it and vitest's jsdom globals are proxies.
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await drain();
}

function bodyRows(): Element[] {
  return [...document.querySelectorAll('[data-testid^="met6-row-"]')];
}

function rowName(row: Element): string {
  return (row.querySelector(".met6-rowname")?.textContent ?? "").trim();
}

/** The cell's own text, without the `.met6-rowsub` note line the count cell carries. */
function rowCells(row: Element): string[] {
  return [...row.querySelectorAll("td")].map((cell) =>
    [...cell.childNodes]
      .filter((part) => part.nodeType === 3)
      .map((part) => part.textContent ?? "")
      .join("")
      .trim(),
  );
}

/** `-status`, `-fallback` and `-fallback-text` share the prefix and are not buttons. */
function copyButtons(): HTMLButtonElement[] {
  return [...document.querySelectorAll('[data-testid^="met-row-copy-"]')].flatMap((node) => {
    const id = node.getAttribute("data-testid") ?? "";
    return /^met-row-copy-\d+$/.test(id) && node instanceof HTMLButtonElement ? [node] : [];
  });
}

/**
 * The copy text is `label · 次数 · 金额 · 占比`, and an employee label is itself
 * `名字 · 编号`, so the label is NOT one comma-free segment: the last three segments
 * are the values and everything before them is the name the row shows.
 */
function splitPayload(payload: string): { label: string; count: string; money: string; share: string } {
  const parts = payload.split(" · ");
  expect(parts.length).toBeGreaterThanOrEqual(4);
  const tail = parts.slice(-3);
  return { label: parts.slice(0, -3).join(" · "), count: tail[0] ?? "", money: tail[1] ?? "", share: tail[2] ?? "" };
}

async function copyOf(index: number): Promise<string> {
  const buttons = copyButtons();
  const button = buttons[index];
  if (button === undefined) throw new Error(`copyOf: button ${index} is missing`);
  const before = urls().length;
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  // Copying is local: it must never spend a read, whatever the row says.
  expect(urls().length).toBe(before);
  return String(clip.copyTextToClipboard.mock.calls.at(-1)?.[0] ?? "");
}

/** The names the cost card lists in its own ledger snapshot. */
/**
 * Payloads in row order. The reads have to be sequential: each copy press is
 * recognised through the LAST clipboard call, so a concurrent batch would read
 * whichever press finished last and report an order the screen never had.
 */
async function allPayloads(): Promise<string[]> {
  const out: string[] = [];
  for (let index = 0; index < copyButtons().length; index += 1) out.push(await copyOf(index));
  return out;
}

function snapshotNames(): string[] {
  return [...document.querySelectorAll('[data-testid="met6-cost-rows"] li .met6-row-who')].map(
    (who) => (who.textContent ?? "").trim(),
  );
}

/** The money the fixture says an employee spent inside a window, printed the product's way. */
function fixtureMoney(id: string, windowHours: number): string {
  expect(id).not.toBe(""); // an unmapped label means the two faces stopped agreeing
  const days = Math.max(1, Math.round(windowHours / 24));
  const costs = LEDGER_DAYS.filter((day) => day.back < days)
    .flatMap((day) => day.rows)
    .filter((row) => row.id === id)
    .map((row) => row.cost)
    .filter((cost): cost is number => cost !== null);
  return costs.length === 0 ? "—" : formatUsd(costs.reduce((sum, cost) => sum + cost, 0));
}

beforeEach(() => {
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
  vi.useRealTimers();
});

describe("R267 ① the card's ledger snapshot and the row copy names are the same list", () => {
  it("copies the name the snapshot shows, priced the way the row prices it, at 24h and at 7d", async () => {
    for (const [entry, hours] of [["/metrics", 24], ["/metrics?window=7d", 168]] as const) {
      await mount(entry);
      const snapshot = snapshotNames();
      expect(snapshot.length).toBeGreaterThan(0);
      const rows = bodyRows();
      expect(rows.length).toBeGreaterThan(1);
      expect(copyButtons().length).toBe(rows.length);

      const onScreen = rows.map(rowName);
      // Every name the summary card lists is exactly one row's copy label — the two
      // faces cannot invent or drop an employee.
      for (const name of snapshot) expect(onScreen).toContain(name);
      const labels: string[] = [];
      for (let index = 0; index < rows.length; index += 1) {
        const parsed = splitPayload(await copyOf(index));
        labels.push(parsed.label);
        // The copied money is the money that row prints, and that money is what the
        // ledger holds for the same employee inside the same window — never a
        // re-priced or re-summed copy of it.
        const cell = rowCells(rows[index] ?? document.createElement("div"))[1] ?? "";
        expect(parsed.money).toBe(cell);
        expect(parsed.money).toBe(fixtureMoney(idByLabel.get(parsed.label) ?? "", hours));
      }
      expect(labels.length).toBe(onScreen.length);
      expect(new Set(labels).size).toBe(labels.length);
      for (const name of snapshot) expect(labels).toContain(name);
    }
  });
});

describe("R267 ② a sort moves the copy texts with the table and asks for nothing", () => {
  it("keeps the copy order equal to the row order through a detail sort press, with no new read", async () => {
    await mount("/metrics?window=7d");
    const before = urls();
    const ordered = (await allPayloads()).map((payload) => splitPayload(payload).label);
    expect(ordered).toEqual(bodyRows().map(rowName));

    // The default sort IS 成本 descending with no keys in the address, so one press of
    // that header is the active column flipping to ascending.
    await click("metP-sort-cost");
    expect(urls()).toEqual(before);

    const rows = bodyRows();
    const after = await allPayloads();
    expect(after.map((payload) => splitPayload(payload).label)).toEqual(rows.map(rowName));
    expect(rows.length).toBe(ordered.length);
    // Ascending by amount: the amount-free row sinks, so the order really moved.
    expect(after.map((payload) => splitPayload(payload).label)).not.toEqual(ordered);
  });
});

describe("R267 ③ a zero and a gap copy the sentence the row shows", () => {
  it("prints $0.00 for a real zero and 「—」 for a missing amount, on both faces", async () => {
    await mount("/metrics?window=7d");
    const rows = bodyRows();
    const zeroIndex = rows.findIndex((row) => rowCells(row)[1] === formatUsd(0));
    expect(zeroIndex).toBeGreaterThan(-1);
    const gapIndex = rows.findIndex((row) => rowCells(row)[1] === "—");
    expect(gapIndex).toBeGreaterThan(-1);
    expect(gapIndex).not.toBe(zeroIndex);

    const zero = splitPayload(await copyOf(zeroIndex));
    expect(zero.money).toBe(formatUsd(0));
    expect(zero.money).toBe("$0.00");
    // A real zero is still a number the share can be computed against, never a blank.
    expect(zero.share).not.toBe("");

    const gap = splitPayload(await copyOf(gapIndex));
    expect(gap.money).toBe("—");
    expect(gap.money).not.toBe(zero.money);
    // 员工账本不记运行次数，所以两份的次数段都是「—」，复制不编一个 0。
    expect(gap.count).toBe("—");
    expect(zero.count).toBe("—");
    expect(urls().length).toBeGreaterThan(0);
  });
});
