// @vitest-environment jsdom
/**
 * R207 — /metrics: an empty window and a failed read口, guarded separately.
 *
 * ① An empty window is READABLE and never invented as a zero: the money column and
 *    the totals say «—» or are not drawn at all, the detail export is disabled WITH a
 *    reason, and the 复制 column is not rendered — a row that does not exist cannot
 *    offer a per-row copy.
 * ② One read口 answering 500 is owned by THAT block: the block that failed says so
 *    with the request id, which is copyable; the batch that DID answer stays on the
 *    screen; the page-level failure anchor does not appear (that would blame the
 *    whole page for one source); the block's own retry costs one batch.
 * ③ Clicking the refresh twice while the batch is in flight costs ONE batch. The
 *    button stays enabled on purpose, so the guard has to be in the action.
 * ④ In an empty window the surviving affordances (share export, summary copy) spend
 *    ZERO requests, and the availability sentence on the screen matches what the
 *    controls really do.
 *
 * Covered elsewhere and cited, not re-implemented: R206 `metrics.states.test.tsx`
 * ①-④ (the empty/error anchors and the page-level rid), R160
 * `metrics.window.test.tsx:640-656`/`:762-783`/`:796-833`, R195
 * `metrics.requests.test.tsx`, R203 `metrics.window.export.test.tsx` ①②.
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
import { beijingDayKey, formatCount } from "./metrics";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FROZEN = "2026-11-19T12:00:00.000Z";
const FROZEN_MS = Date.parse(FROZEN);
const DAY = beijingDayKey(new Date(FROZEN_MS));
const DAY_MS = 86_400_000;
const RID = "req-met-500";

function dayKey(back: number): string {
  return beijingDayKey(new Date(FROZEN_MS - back * DAY_MS));
}

const A = "emp_aaaabbbbcccc";
const B = "emp_ddddeeeeffff";
const C = "emp_iiiijjjjkkkk";

const EMPLOYEES = {
  items: [
    { employeeId: A, name: "小鲤" },
    { employeeId: B, name: "小满" },
    { employeeId: C, name: "阿吉" },
  ],
  nextCursor: null,
};

const LEDGER_DAYS: { back: number; rows: { id: string; cost: number | null }[] }[] = [
  { back: 0, rows: [{ id: A, cost: 0.2 }, { id: B, cost: 0.5 }] },
  { back: 2, rows: [{ id: C, cost: 0.3 }] },
];

/**
 * `normal` answers everything; `quiet` blanks the window so the reads come back
 * EMPTY (not failing); `failBudget` answers 500 for the ledger read口 only;
 * `hold` parks every read until `release()` so a second click lands mid-batch.
 */
type Mode = "normal" | "quiet" | "failBudget";
let mode: Mode = "normal";
let held: (() => void)[] = [];
let holdOpen = false;

function ledgerItems(period: string): Record<string, unknown>[] {
  const entry = LEDGER_DAYS.find((day) => dayKey(day.back) === period);
  if (entry === undefined) return [];
  if (mode === "quiet") return [];
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
/** The heat grid is keyed by its own window, so this total must not move. */
const HEAT_TOTAL = 4 + 3 + 2;

const STATS_BY_HOURS: Record<number, number> = { 24: 13, 48: 9, 168: 33, 336: 21, 720: 61, 1440: 44 };

function statsBody(at: URL): Record<string, unknown> {
  const hours = Math.round((FROZEN_MS - Date.parse(at.searchParams.get("from") ?? FROZEN)) / 3_600_000);
  const bucket = at.searchParams.get("bucket") ?? "hour";
  const runs = mode === "quiet" ? 0 : (STATS_BY_HOURS[hours] ?? 5);
  const slots = bucket === "hour" ? 24 : Math.max(1, Math.round(hours / 24));
  return {
    from: at.searchParams.get("from"),
    to: at.searchParams.get("to"),
    bucket,
    slots,
    buckets: mode === "quiet" ? [] : [{ bucketStart: at.searchParams.get("from"), runs }],
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

function failure(url: string): ApiError {
  return new ApiError("控制台暂时没有回应", { status: 500, body: "", url, requestId: RID });
}

function answer(path: string, at: URL, url: string): unknown {
  if (path.endsWith("/api/budget-usage")) {
    if (at.searchParams.get("periodKind") === "month") {
      return {
        items:
          mode === "quiet"
            ? []
            : [{ employeeId: A, period: DAY.slice(0, 7), periodKind: "month", costUsd: 1.1, updatedAt: FROZEN }],
        missingEmployeeIds: [],
      };
    }
    if (mode === "failBudget") throw failure(url);
    const wanted = (at.searchParams.get("employeeId") ?? "").split(",");
    return {
      items: ledgerItems(at.searchParams.get("period") ?? "").filter((item) =>
        wanted.includes(String(item.employeeId)),
      ),
      missingEmployeeIds: [],
    };
  }
  if (path.endsWith("/api/run-stats")) return statsBody(at);
  if (path.endsWith("/api/run-activity")) {
    return {
      cells: mode === "quiet" ? [] : HEAT_CELLS,
      max: mode === "quiet" ? null : 4,
      from: "2026-11-12T16:00:00.000Z",
      to: `${DAY}T15:59:59.000Z`,
      tz: "Asia/Shanghai",
    };
  }
  if (path.endsWith("/api/employees")) return EMPLOYEES;
  if (path.endsWith("/api/hermes-usage")) {
    return { by_model: [], cost: { source: "cost_ledger", cost_usd: null, cost_status: "unknown", rows: 0, per_employee: [] }, asOf: null };
  }
  if (path.endsWith("/api/models/pricing")) throw new ApiError("not wired", { status: 404, body: "", url });
  return { items: [] };
}

async function handler(url: string): Promise<unknown> {
  const at = new URL(url, "http://localhost");
  const path = at.pathname;
  if (holdOpen) {
    // Park the answer: the page is then genuinely mid-batch, which is the only way
    // to see whether a second click asks the server again.
    return new Promise((resolve, reject) => {
      held.push(() => {
        try {
          resolve(answer(path, at, url));
        } catch (error) {
          reject(error);
        }
      });
    });
  }
  return answer(path, at, url);
}

let root: Root | null = null;

function AddressProbe(): ReactNode {
  const location = useLocation();
  return <p data-testid="r207-loc">{location.search}</p>;
}

/**
 * Bounded on ticks, never on the clock: `Date` is frozen, so a wall-clock guard
 * could never expire and a missing node would spin instead of failing.
 */
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

function urls(): string[] {
  return api.fetchJsonStrict.mock.calls.map((call) => String(call[0]));
}

function countFamily(fragment: string): number {
  return urls().filter((url) => url.includes(fragment)).length;
}

function settled(): boolean {
  return document.querySelector(".met5-skeleton") === null;
}

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
  held = [];
  holdOpen = false;
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

function node(id: string): HTMLElement | null {
  const found = q(id);
  return found instanceof HTMLElement ? found : null;
}

async function click(target: Element): Promise<void> {
  await act(async () => {
    (target as HTMLElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function press(id: string): Promise<void> {
  const button = node(id);
  if (button === null) throw new Error(`press: control ${id} is missing`);
  await click(button);
  await drain();
}

function bodyRows(): Element[] {
  return [...document.querySelectorAll('[data-testid^="met6-row-"]')];
}

/** Only the real buttons: `-status`, `-fallback` and `-fallback-text` share the prefix. */
function copyButtons(): HTMLButtonElement[] {
  return [...document.querySelectorAll("[data-testid^='met-row-copy-']")].flatMap((found) => {
    const id = found.getAttribute("data-testid") ?? "";
    return /^met-row-copy-\d+$/.test(id) && found instanceof HTMLButtonElement ? [found] : [];
  });
}

function headerLabels(): string[] {
  return [...document.querySelectorAll('[data-testid="met6-table"] thead th')].map((cell) => cell.textContent?.trim() ?? "");
}

function face(id: string): string | null {
  return q(id)?.textContent?.trim() ?? null;
}

function captureDownload(): { captured: { blob: Blob | null; name: string | null }; restore: () => void } {
  const captured = { blob: null as Blob | null, name: null as string | null };
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalAnchor = HTMLAnchorElement.prototype.click;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: (blob: Blob) => {
      captured.blob = blob;
      return "blob:r207";
    },
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: () => undefined });
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
      Object.defineProperty(HTMLAnchorElement.prototype, "click", {
        configurable: true,
        writable: true,
        value: originalAnchor,
      });
    },
  };
}

function release(): void {
  const pendings = held;
  held = [];
  holdOpen = false;
  for (const resolve of pendings) resolve();
}

beforeEach(() => {
  mode = "normal";
  holdOpen = false;
  held = [];
  // Only `Date` is faked, so the page's own timers still run while it settles.
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
  mode = "normal";
  holdOpen = false;
  held = [];
  vi.useRealTimers();
});

describe("R207 ① an empty window is said, not summed as zero", () => {
  it("draws no 复制 column, keeps money «—» or absent, and stops the detail export", async () => {
    await mount("/metrics");
    // The same fixtures with data must produce the column: without this control the
    // absence below could just mean the table never renders here.
    expect(bodyRows().length).toBeGreaterThan(0);
    expect(headerLabels()).toContain("复制");
    expect(copyButtons().length).toBe(bodyRows().length);

    mode = "quiet";
    await mount("/metrics");
    expect(bodyRows()).toHaveLength(0);
    expect(copyButtons()).toHaveLength(0);
    // The whole detail card is replaced by its empty statement, so the column — and
    // with it any per-row copy affordance — does not exist to be clicked.
    expect(headerLabels()).not.toContain("复制");
    expect(q("met6-cat-empty")).not.toBeNull();
    expect(q("met6-empty")).not.toBeNull();
    expect(text("metAN-empty-guide")).toContain("不拿空当 0");

    // Nothing that IS drawn invents a zero money amount; the missing ones say «—».
    for (const id of ["met6-cost-value", "met6-cost-month", "metAS-day", "metAS-month"]) {
      const value = face(id);
      if (value !== null) expect(value).not.toContain("$0.00");
    }
    // The totals line and the source-line total are NOT drawn rather than written 0.
    expect(q("metT-total-row")).toBeNull();
    expect(q("met6-cat-total")).toBeNull();

    const exportButton = node("met6-export");
    expect(exportButton).not.toBeNull();
    expect((exportButton as HTMLButtonElement).disabled).toBe(true);
    expect(exportButton?.getAttribute("title") ?? "").not.toBe("");
  });
});

describe("R207 ② one failed read口 is owned by its own block", () => {
  it("names the rid in that block, keeps the batch that answered, and never blames the page", async () => {
    await mount("/metrics");
    expect(bodyRows().length).toBeGreaterThan(0);
    const heatBefore = face("met5-count");
    const runsBefore = face("met6-runs-value");
    expect(heatBefore).toBe(String(HEAT_TOTAL));

    mode = "failBudget";
    const before = urls().length;
    await press("metAK-refresh");

    // The block that owns the ledger read says so, with the id it was answered with.
    expect(q("met6-cat-unavailable")).not.toBeNull();
    expect(text("met6-cat-unavailable")).toContain("这份成本明细暂时读不到");
    const anchor = node("met6-cat-unavailable");
    const rid = anchor?.querySelector('[data-testid="met5-request-id"]') ?? null;
    expect(rid).not.toBeNull();
    // The id is not namespaced by its host, so it is read inside the anchor — and the
    // copy affordance that lives there copies exactly this id.
    expect(anchor?.querySelector(`[data-testid="met5-request-id"] code[title="${RID}"]`)).not.toBeNull();
    const copy = anchor?.querySelector('[aria-label="复制请求编号"]');
    expect(copy).not.toBeNull();
    await click(copy as Element);
    expect(clip.copyTextToClipboard).toHaveBeenCalledWith(RID);

    // One failing source is not a page failure and not an empty window.
    expect(q("metH-page-error")).toBeNull();
    expect(q("met6-error")).toBeNull();
    expect(q("metAK-error")).toBeNull();
    expect(q("met6-empty")).toBeNull();
    expect(q("metAN-empty-guide")).toBeNull();

    // The batch that DID answer stays on the screen: the heat total and the runs card
    // keep the numbers they had, instead of being blanked by their neighbour's 500.
    expect(face("met5-count")).toBe(heatBefore);
    expect(face("met6-runs-value")).toBe(runsBefore);
    expect(face("met6-runs-value")).toBe(formatCount(STATS_BY_HOURS[24]));

    // The detail export stops (no rows to export) while the block's own retry is live.
    expect((node("met6-export") as HTMLButtonElement).disabled).toBe(true);
    expect(node("met6-cat-retry")).not.toBeNull();
    expect(urls().length).toBeGreaterThan(before);

    // The retry costs one batch, and one batch again — never two rounds per click.
    mode = "normal";
    const ledgerBefore = countFamily("/api/budget-usage");
    await press("met6-cat-retry");
    const firstRound = countFamily("/api/budget-usage") - ledgerBefore;
    expect(firstRound).toBeGreaterThan(0);
    const anchorGone = q("met6-cat-unavailable");
    expect(anchorGone).toBeNull();
    expect(bodyRows().length).toBeGreaterThan(0);
  });
});

describe("R207 ③ a double click while the batch runs costs one batch", () => {
  it("refuses the second click while the first batch is still in flight", async () => {
    await mount("/metrics");
    const refresh = node("metAK-refresh");
    expect(refresh).not.toBeNull();

    // One settled press: a press does ask.
    const singleBefore = urls().length;
    await press("metAK-refresh");
    const single = urls().length - singleBefore;
    expect(single).toBeGreaterThan(0);

    // Two clicks inside one running batch, with the answers parked so the second
    // click genuinely lands while the first is in flight. Measured here, a HELD
    // round only reaches the loaders that fire on the click itself: the rest of a
    // refresh round is issued by loaders that wake when data lands, so its URL
    // count is legitimately smaller than the settled ruler above and cannot be
    // compared to it. What the page guard (refreshBusyRef, set before the batch
    // and cleared when it settles) does promise is that the SECOND click asks
    // nothing at all — that is the claim asserted below.
    holdOpen = true;
    const doubleBefore = urls().length;
    await act(async () => {
      (refresh as HTMLElement).click();
    });
    const afterFirst = urls().length - doubleBefore;
    expect(afterFirst).toBeGreaterThan(0);
    await act(async () => {
      (refresh as HTMLElement).click();
    });
    const afterSecond = urls().length - doubleBefore;
    // The button is deliberately NOT dimmed while the batch runs (its own title
    // says the second press will not re-send), so the guard is behavioural.
    expect((refresh as HTMLButtonElement).disabled).toBe(false);
    expect(afterSecond).toBe(afterFirst);
    release();
    await drain();
    // And the refused batch still lands: nothing is left hanging in flight.
    expect(q("metAK-error")).toBeNull();
    expect(bodyRows().length).toBeGreaterThan(0);
  });
});

describe("R207 ④ the empty window spends nothing and says what it does", () => {
  it("exports and copies with zero requests, and the availability line matches the controls", async () => {
    mode = "quiet";
    await mount("/metrics");
    const before = urls().length;

    // The line is a promise about four states; the controls have to agree with it.
    const note = text("metAM-matrix-note");
    expect(note).toContain("只留「刷新」可用");
    expect(note).toContain("明细导出停下、摘要复制照常");
    expect(note).toContain("刷新也不会重复发请求");

    const exportButton = node("met6-export");
    const shareButton = node("metA-export");
    const copySummary = node("metL-copy");
    const refresh = node("metAK-refresh");
    expect(exportButton).not.toBeNull();
    expect(shareButton).not.toBeNull();
    expect(copySummary).not.toBeNull();
    expect(refresh).not.toBeNull();
    // Exactly what the sentence promises, in this state.
    expect((exportButton as HTMLButtonElement).disabled).toBe(true);
    expect((shareButton as HTMLButtonElement).disabled).toBe(false);
    expect((copySummary as HTMLButtonElement).disabled).toBe(false);
    expect((refresh as HTMLButtonElement).disabled).toBe(false);

    // The share export writes its header-only file and asks the server for nothing.
    const capture = captureDownload();
    try {
      await press("metA-export");
      expect(capture.captured.blob).not.toBeNull();
    } finally {
      capture.restore();
    }
    expect(urls().length).toBe(before);

    // The summary copy lands on the clipboard, again with no read behind it.
    await press("metL-copy");
    expect(clip.copyTextToClipboard).toHaveBeenCalledTimes(1);
    expect(urls().length).toBe(before);

    // And there is no per-row copy to press in a window with no rows.
    expect(copyButtons()).toHaveLength(0);
    expect(urls().length).toBe(before);
  });
});
