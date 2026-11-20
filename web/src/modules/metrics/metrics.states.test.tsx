// @vitest-environment jsdom
/**
 * R206 — /metrics empty and error state guards (pure test, no product change).
 *
 * Four legs, driven by fixtures rather than the `?state=` preview modes (those
 * issue zero requests, which would make every request-count claim vacuous):
 * ① a window with no data says so in readable words, keeps «—» instead of
 *    inventing a zero, and disarms the detail export;
 * ② a first-screen 500 says so in a readable sentence with a copyable request
 *    id, is never dressed up as an empty window, and writes no zero on a card;
 * ③ one retry press re-asks one round (never two), the anchor persists while
 *    the source still fails, and a healthy retry clears it and lands the data;
 * ④ an error state renders no row-copy control, and switching `?window` while
 *    failing leaves at most one live anchor — no stale error block behind.
 *
 * Cited, not duplicated: `metrics.window.test.tsx:640-656` (export rows vs body,
 * CSV header cell vs the table's first column), `:762-783` (empty-window export
 * gates and the header-only share file), `:796-833` (row-copy payloads),
 * `metrics.window.export.test.tsx` ①② (three-value agreement per window),
 * `metrics.requests.test.tsx` ④ (a failed switch discloses the rid and the batch
 * retry), `MetricsModulePage.test.tsx:154-176` (the heat card's own rid + retry).
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
import { beijingDayKey } from "./metrics";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FROZEN = "2026-11-19T12:00:00.000Z";
const FROZEN_MS = Date.parse(FROZEN);
const DAY = beijingDayKey(new Date(FROZEN_MS));
const DAY_MS = 86_400_000;
/** Whatever the failing read carries, the page must show it, verbatim. */
const RID = "rid-r206-9c1d47";

/** The Beijing day key `back` days before the frozen clock. */
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

/** One day row per employee, so a window holds exactly the days inside it. */
const LEDGER_DAYS: { back: number; rows: { id: string; cost: number | null }[] }[] = [
  { back: 0, rows: [{ id: A, cost: 0.2 }, { id: B, cost: 0.5 }] },
  { back: 2, rows: [{ id: C, cost: 0.3 }] },
];

/**
 * `normal` answers the ledger; `quiet` blanks the recent days so a window
 * really has no rows; `fail` rejects every read with a 500 carrying a request id.
 */
let mode: "normal" | "quiet" | "fail" = "normal";

function ledgerItems(period: string): Record<string, unknown>[] {
  const entry = LEDGER_DAYS.find((day) => dayKey(day.back) === period);
  if (entry === undefined) return [];
  if (mode === "quiet" && entry.back < 7) return [];
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
];

/** A quiet window answers zero runs and no buckets at all (the empty gate reads both). */
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

const STATS_BY_HOURS: Record<number, number> = { 24: 13, 48: 9, 168: 33, 336: 21, 720: 61, 1440: 44 };

function failure(url: string): ApiError {
  return new ApiError("控制台暂时没有回应", { status: 500, body: "", url, requestId: RID });
}

async function handler(url: string): Promise<unknown> {
  const at = new URL(url, "http://localhost");
  const path = at.pathname;
  if (mode === "fail" && !path.endsWith("/api/employees")) throw failure(url);
  if (path.endsWith("/api/budget-usage")) {
    const period = at.searchParams.get("period") ?? "";
    if (at.searchParams.get("periodKind") === "month") {
      return {
        items: mode === "quiet" ? [] : [{ employeeId: A, period: DAY.slice(0, 7), periodKind: "month", costUsd: 1.1, updatedAt: FROZEN }],
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
      cells: mode === "quiet" ? [] : HEAT_CELLS,
      max: 4,
      from: "2026-11-12T16:00:00.000Z",
      to: `${DAY}T15:59:59.000Z`,
      tz: "Asia/Shanghai",
    };
  }
  if (path.endsWith("/api/hermes-usage")) {
    return {
      by_model: [],
      cost: { source: "cost_ledger", cost_usd: null, cost_status: "unknown", rows: 0, per_employee: [] },
      asOf: `${DAY}T12:00:00.000Z`,
    };
  }
  if (path.endsWith("/api/employees")) return EMPLOYEES;
  if (path.endsWith("/api/models/pricing")) throw new ApiError("not wired", { status: 404, body: "", url });
  return { items: [] };
}

let root: Root | null = null;

function AddressProbe(): ReactNode {
  const location = useLocation();
  return <p data-testid="r206-loc">{location.search}</p>;
}

/**
 * Bounded on ticks, never on the clock: `Date` is frozen for the ledger keys,
 * so a wall-clock guard could never expire and a missing node would spin.
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

function q(id: string): HTMLElement | null {
  return document.querySelector(`[data-testid=${JSON.stringify(id)}]`);
}

function text(id: string): string {
  return (q(id)?.textContent ?? "").trim();
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

/** Pump until the request count stops moving, then until the skeletons are gone. */
async function drain(): Promise<void> {
  let stable = 0;
  let previous = urls().length;
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
  const button = q(id);
  if (button === null) throw new Error(`press: control ${id} is missing`);
  await act(async () => {
    (button as HTMLButtonElement).click();
  });
  await drain();
}

function bodyRows(): HTMLElement[] {
  return [...document.querySelectorAll("[data-testid^='met6-row-']")] as HTMLElement[];
}

/** Only the real buttons: `-status`, `-fallback` and `-fallback-text` share the prefix. */
function copyButtons(): HTMLButtonElement[] {
  return [...document.querySelectorAll("[data-testid^='met-row-copy-']")].flatMap((node) => {
    const id = node.getAttribute("data-testid") ?? "";
    return /^met-row-copy-\d+$/.test(id) && node instanceof HTMLButtonElement ? [node] : [];
  });
}

function face(id: string): string | null {
  return q(id)?.textContent?.trim() ?? null;
}

/**
 * One pair of hooks governs the whole file. A describe that declares its own
 * pair leaks real timers into a sibling that declares none, and the page then
 * derives an off-by-one window and reads nothing — a harness leak, not a defect.
 */
beforeEach(() => {
  mode = "normal";
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
  vi.useRealTimers();
});

/** The page builds the file behind `URL.createObjectURL` and an anchor click. */
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
      return "blob:r206";
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
      Object.defineProperty(HTMLAnchorElement.prototype, "click", { configurable: true, writable: true, value: originalAnchor });
    },
  };
}

const MONEY_FACES = [
  "met6-cost-value",
  "met6-cost-month",
  "metAS-day",
  "metAS-month",
  "metT-detail-total-cost",
  "met6-cat-total",
] as const;

describe("R206 ① a window with no data says so without writing zeros", () => {
  it("shows the readable empty state where a healthy window would show rows", async () => {
    // The same link and the same clock, only the data differs: without this
    // control the empty-state assertions could pass on a broken page too.
    await mount("/metrics");
    expect(bodyRows().length).toBeGreaterThan(0);
    expect(copyButtons().length).toBe(bodyRows().length);

    mode = "quiet";
    await mount("/metrics");
    expect(text("r206-loc")).toBe("");
    expect(bodyRows()).toHaveLength(0);
    expect(copyButtons()).toHaveLength(0);

    // The page-level empty card and its two actions.
    expect(q("met6-empty")).not.toBeNull();
    expect(q("metAN-empty-guide")).not.toBeNull();
    expect(q("metD-empty-retry")).not.toBeNull();
    // 24h is not the 7-day suggestion, so the offer to widen must be there.
    expect(q("metD-empty-window")).not.toBeNull();
    expect(text("met6-empty").length).toBeGreaterThan(0);
    expect(text("metD-card-reason")).toBe("");

    // The heat card has its own empty state and it names the same rule.
    expect(q("met5-empty")).not.toBeNull();
    expect(q("met6-cat-empty")).not.toBeNull();

    // Missing money is «—», never an invented $0.00.
    expect(face("met6-cost-value")).toBe("—");
    expect(face("metAS-day")).toBe("—");
    for (const id of MONEY_FACES) {
      const value = face(id);
      if (value !== null) expect(value).not.toContain("$0.00");
    }
    // With no lines the detail table and its totals row are not drawn at all.
    expect(q("metT-total-row")).toBeNull();
    expect(q("met6-cat-total")).toBeNull();

    // A real zero the server answered stays a real zero: the runs face reads the
    // answered totals, so «没有记录» is 0 here and that is not a fabrication.
    expect(face("met6-runs-value")).toBe("0");

    // The detail export is armed off, with a reason, and pressing it does nothing.
    const exportButton = q("met6-export") as HTMLButtonElement | null;
    expect(exportButton).not.toBeNull();
    expect(exportButton?.disabled).toBe(true);
    expect((exportButton?.getAttribute("title") ?? "").length).toBeGreaterThan(0);
    const capture = captureDownload();
    try {
      await press("met6-export");
      expect(capture.captured.blob).toBeNull();
      expect(capture.captured.name).toBeNull();
    } finally {
      capture.restore();
    }
  });
});

describe("R206 ② a failed first screen is said as a failure, not as an empty window", () => {
  it("names the read, discloses a copyable request id and keeps no zeros on the cards", async () => {
    mode = "fail";
    await mount("/metrics");

    expect(q("metH-page-error")).not.toBeNull();
    expect(q("met6-error")).not.toBeNull();
    // A 500 is not a permission gap, so the denied card must not stand in.
    expect(q("met6-denied")).toBeNull();
    expect(text("metD-card-reason").length).toBeGreaterThan(0);

    const ridInBlock = q("metD-card-rid")?.querySelector('[data-testid="met5-request-id"]') ?? null;
    expect(ridInBlock).not.toBeNull();
    expect(ridInBlock?.textContent ?? "").toContain(RID);
    const copy = ridInBlock?.querySelector('[aria-label="复制请求编号"]');
    expect(copy).not.toBeNull();
    await act(async () => {
      (copy as HTMLButtonElement).click();
    });
    expect(clip.copyTextToClipboard).toHaveBeenCalledWith(RID);

    // Nothing here may read as “this window is simply empty”.
    expect(q("met6-empty")).toBeNull();
    expect(q("metAN-empty-guide")).toBeNull();
    expect(q("met6-cat-empty")).toBeNull();
    expect(q("met5-empty")).toBeNull();

    // The cards do not answer 0 for data that never arrived.
    expect(face("met6-runs-value")).toBe("—");
    expect(face("met6-cost-value")).toBe("—");
    expect(face("metAS-day")).toBe("—");
    for (const id of MONEY_FACES) {
      const value = face(id);
      if (value !== null) expect(value).not.toMatch(/(^|[^.\d])0(\.0+)?(%|"|$)/);
    }
  });
});

describe("R206 ③ one retry press asks one round and a healthy retry clears the anchor", () => {
  it("re-asks once per click while the source still fails, then lands the data", async () => {
    mode = "fail";
    await mount("/metrics");
    expect(q("met6-error")).not.toBeNull();
    const statsAtFailure = countFamily("/api/run-stats");
    expect(statsAtFailure).toBeGreaterThan(0);

    const beforeFirst = urls().length;
    await press("met6-retry");
    const firstRound = urls().length - beforeFirst;
    expect(firstRound).toBeGreaterThan(0);
    expect(countFamily("/api/run-stats")).toBeGreaterThan(statsAtFailure);
    // Still failing: the anchor stays, and it never turns into an empty state.
    expect(q("met6-error")).not.toBeNull();
    expect(q("met6-empty")).toBeNull();

    // A second click costs the same round, not two.
    const beforeSecond = urls().length;
    await press("met6-retry");
    expect(urls().length - beforeSecond).toBe(firstRound);

    // Healthy retry: the anchor is gone and the rows are really there.
    mode = "normal";
    await press("met6-retry");
    expect(q("metH-page-error")).toBeNull();
    expect(q("met6-error")).toBeNull();
    expect(bodyRows().length).toBeGreaterThan(0);
    expect(copyButtons().length).toBe(bodyRows().length);
    expect(face("met6-cost-value")).not.toBe("—");
  });
});

describe("R206 ④ an error state has no row copy controls and no stale anchor", () => {
  it("renders no copy control while failing and keeps exactly one live anchor across a window switch", async () => {
    mode = "fail";
    await mount("/metrics?window=7d");
    expect(bodyRows()).toHaveLength(0);
    expect(copyButtons()).toHaveLength(0);
    expect(document.querySelectorAll('[data-testid="metH-page-error"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-testid="met6-error"]')).toHaveLength(1);

    // Switching the window while still failing must not leave the old block behind.
    await press("met6-window-30d");
    expect(text("r206-loc")).toBe("?window=30d");
    expect(document.querySelectorAll('[data-testid="metH-page-error"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-testid="met6-error"]')).toHaveLength(1);
    expect(q("met6-denied")).toBeNull();
    expect(q("met6-empty")).toBeNull();
    expect(copyButtons()).toHaveLength(0);

    // And the same switch from a healthy source carries no anchor at all.
    mode = "normal";
    await press("met6-window-24h");
    expect(q("metH-page-error")).toBeNull();
    expect(q("met6-error")).toBeNull();
    expect(bodyRows().length).toBeGreaterThan(0);
  });
});
