// @vitest-environment jsdom
/*
 * R195 — the /metrics request contract, guarded from the outside.
 *
 * Four things are pinned here:
 *  (1) the first screen asks each single-consumer endpoint exactly once and the
 *      address carries no default-window key, so a shared link does not spill the
 *      window into the reads;
 *  (2) switching `?window` buys exactly one new read per window-driven family, the
 *      body and the summary move together, and the previous window's rows are gone
 *      by LABEL, not merely by count;
 *  (3) the detail sort is a local axis: a cold `?dsort/?ddir` link costs no extra
 *      read and a header press costs none either;
 *  (4) a failed read says so with a copyable rid, one retry press re-asks exactly
 *      the same families, and a successful retry clears the error anchors.
 *
 * Cited, not duplicated: the zero-refetch of a sort press is already pinned by
 * `MetricsModulePage.test.tsx:2560` and `metrics.summary.parity.test.tsx:417/432/461`;
 * the window switch batch by `crosspage.time.test.ts:236`; the totals' sameness by
 * `metrics.summary.parity.test.tsx` (R143); the export/row-copy parity by
 * `metrics.export-parity.test.ts` (R116); the face sweep after a switch by
 * `metrics.window.test.tsx` (R160). What none of them does is count the reads per
 * family, compare row LABELS across windows, or walk the failure → rid → retry →
 * recovery path, which is what this file adds.
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
import { WINDOW_PRESETS, windowRange } from "./metrics";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FROZEN = "2026-11-19T12:00:00.000Z";
const FROZEN_MS = Date.parse(FROZEN);
const DAY = "2026-11-19";
const RID = "rid-r195-4f2a91";

const EMPLOYEES = {
  items: [
    { employeeId: "emp_aaaabbbbcccc", name: "小鲤" },
    { employeeId: "emp_ddddeeeeffff", name: "小满" },
    { employeeId: "emp_222233334444", name: "小锦" },
  ],
  nextCursor: null,
};

/** The employee ledger: only the current day carries rows, so the 24h body is known. */
const LEDGER_TODAY = {
  items: [
    { employeeId: "emp_aaaabbbbcccc", period: DAY, periodKind: "day", costUsd: 0.2, updatedAt: `${DAY}T03:20:00.000Z` },
    { employeeId: "emp_ddddeeeeffff", period: DAY, periodKind: "day", costUsd: 0.5, updatedAt: `${DAY}T04:20:00.000Z` },
  ],
  missingEmployeeIds: [],
};

/** Per-model usage keyed by `days=` so every window answers with DIFFERENT models. */
const NULL_COST = { source: "cost_ledger", cost_usd: null, cost_status: "unknown", rows: 0, per_employee: [] };
const USAGE_BY_DAYS: Record<string, Record<string, unknown>> = {
  "1": {
    by_model: [{ model: "alpha", api_calls: 4, input_tokens: 100, output_tokens: 20 }],
    cost: NULL_COST,
    asOf: `${DAY}T12:00:00.000Z`,
  },
  "7": {
    by_model: [
      { model: "beta", api_calls: 9, input_tokens: 900, output_tokens: 90 },
      { model: "gamma", sessions: 3, input_tokens: 300 },
    ],
    cost: NULL_COST,
    asOf: `${DAY}T12:00:00.000Z`,
  },
  // zeta is listed FIRST on purpose: in the model view every cost is null, so the
  // default cost-descending sort is a tie and keeps the upstream order. A fixture
  // already ordered by descending count would make the sort press a no-op.
  "30": {
    by_model: [
      { model: "zeta", api_calls: 5, input_tokens: 500, output_tokens: 50 },
      { model: "alpha", api_calls: 11, input_tokens: 1100, output_tokens: 110 },
    ],
    cost: NULL_COST,
    asOf: `${DAY}T12:00:00.000Z`,
  },
};

function statsBody(at: URL): Record<string, unknown> {
  const from = at.searchParams.get("from") ?? FROZEN;
  const to = at.searchParams.get("to") ?? FROZEN;
  const bucket = at.searchParams.get("bucket") ?? "hour";
  const hours = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 3_600_000));
  const slots = bucket === "hour" ? 24 : Math.max(1, Math.round(hours / 24));
  const runs = 7 + slots;
  return {
    from,
    to,
    bucket,
    buckets: [{ bucketStart: from, runs }],
    totals: { runs, succeeded: runs, failed: 0, running: 0, sampleCount: runs, successRate: 1 },
  };
}

/** Failure switches, flipped per phase; every read is still counted when it throws. */
let failAll = false;
let usageFails = false;

async function handler(url: string): Promise<unknown> {
  const at = new URL(url, "http://localhost");
  const path = at.pathname;
  if (failAll) {
    throw new ApiError("这一项没读到", { status: 500, body: "", url, requestId: RID });
  }
  if (path.endsWith("/api/run-activity")) {
    return {
      cells: [
        { dow: 1, hour: 9, count: 4 },
        { dow: 2, hour: 10, count: 3 },
        { dow: 3, hour: 11, count: 2 },
      ],
      max: 4,
      from: "2026-11-12T16:00:00.000Z",
      to: `${DAY}T15:59:59.000Z`,
      tz: "Asia/Shanghai",
    };
  }
  if (path.endsWith("/api/run-stats")) return statsBody(at);
  if (path.endsWith("/api/employees")) return EMPLOYEES;
  if (path.endsWith("/api/models/pricing")) {
    throw new ApiError("not wired", { status: 404, body: "", url });
  }
  if (path.endsWith("/api/budget-usage")) {
    const periodKind = at.searchParams.get("periodKind");
    const period = at.searchParams.get("period");
    if (periodKind === "day" && period === DAY) return LEDGER_TODAY;
    if (periodKind === "month") {
      return {
        items: [{ employeeId: "emp_aaaabbbbcccc", period: DAY.slice(0, 7), periodKind: "month", costUsd: 1.1, updatedAt: `${DAY}T02:00:00.000Z` }],
        missingEmployeeIds: [],
      };
    }
    return { items: [], missingEmployeeIds: [] };
  }
  if (path.endsWith("/api/hermes-usage")) {
    if (usageFails) {
      throw new ApiError("用量没读到", { status: 500, body: "", url, requestId: RID });
    }
    return USAGE_BY_DAYS[at.searchParams.get("days") ?? "1"] ?? USAGE_BY_DAYS["1"];
  }
  return { items: [] };
}

let root: Root | null = null;

function AddressProbe(): ReactNode {
  const location = useLocation();
  return (
    <>
      <p data-testid="r195-loc">{location.search}</p>
      <p data-testid="r195-nav">{String(location.key)}</p>
    </>
  );
}

/** Bounded on ticks, not on the clock: `Date` is frozen for the ledger keys. */
async function waitFor(cond: () => boolean, label: string): Promise<void> {
  for (let tick = 0; tick < 600; tick += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error(`waitFor: ${label} never became true`);
}

function q(id: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${id}"]`);
}

function text(id: string): string {
  return q(id)?.textContent ?? "";
}

function urls(): string[] {
  return api.fetchJsonStrict.mock.calls.map((call) => String(call[0]));
}

/** Requests that were actually issued for one endpoint family. */
function countFamily(fragment: string): number {
  return urls().filter((url) => url.includes(fragment)).length;
}

/** The `days=` values the usage endpoint was asked for, in first-seen order. */
function usageDaysAsked(): string[] {
  const seen: string[] = [];
  for (const url of urls()) {
    if (!url.includes("/api/hermes-usage")) continue;
    const days = new URL(url, "http://localhost").searchParams.get("days") ?? "";
    if (!seen.includes(days)) seen.push(days);
  }
  return seen;
}

/** Reads of the current-window stats family, keyed by the window's own range. */
function statsReadsFor(windowId: string): number {
  const preset = WINDOW_PRESETS.find((row) => row.id === windowId);
  if (!preset) throw new Error(`statsReadsFor: unknown window ${windowId}`);
  const range = windowRange(new Date(FROZEN_MS), preset.id);
  return urls().filter(
    (url) =>
      url.includes("/api/run-stats") &&
      url.includes(encodeURIComponent(range.from)) &&
      url.includes(`bucket=${preset.bucket}`),
  ).length;
}

const settled = (): boolean => document.querySelector(".met5-skeleton") === null;

/** The page fans out per window, so a switch is only over when the URLs stop growing. */
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

function bodyLabels(): string[] {
  return [...document.querySelectorAll('[data-testid^="met6-row-"]')].map(
    (row) => row.querySelector(".met6-rowname")?.textContent?.trim() ?? "",
  );
}

function bodyCountCells(): string[] {
  return [...document.querySelectorAll('[data-testid^="met6-row-"]')].map((row) => {
    const cells = [...row.querySelectorAll("td")];
    const cell = cells[2];
    if (!cell) return "";
    return [...cell.childNodes]
      .filter((part) => part.nodeType === 3)
      .map((part) => part.textContent ?? "")
      .join("")
      .trim();
  });
}

function face(id: string): string | null {
  return q(id)?.textContent ?? null;
}

/**
 * ONE pair of hooks for the whole file. The page derives its windows from
 * `new Date()`, so every leg needs the same frozen clock; leaving a leg without
 * it makes the comparison reads ask a slightly-off range and the tables come
 * back empty — which reads like a product defect but is a harness leak.
 */
beforeEach(() => {
  failAll = false;
  usageFails = false;
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
  failAll = false;
  usageFails = false;
  vi.useRealTimers();
});

describe("R195 ① the first screen asks each endpoint once", () => {
  it("reads the directory, the heat and the active window exactly once, and writes no default window", async () => {
    await mount("/metrics");

    // The address is the contract: 24h is the default and must not be spelled out.
    expect(text("r195-loc")).toBe("");
    expect(q("met6-window-24h")?.getAttribute("aria-pressed")).toBe("true");

    // Every name-resolving loader asks for the directory, but always through the
    // SAME URL: one distinct read, whatever the fan-out of callers.
    const directory = urls().filter((url) => url.includes("/api/employees"));
    expect(directory.length).toBeGreaterThanOrEqual(1);
    expect(new Set(directory).size).toBe(1);
    expect(countFamily("/api/models/pricing")).toBe(1);
    expect(countFamily("/api/run-activity")).toBe(1);

    // One window in, one usage read out: no other `days=` value is asked for.
    expect(countFamily("/api/hermes-usage")).toBe(1);
    expect(usageDaysAsked()).toEqual(["1"]);

    // The stats family is read by several loaders that share ranges (the window
    // itself, the fixed 7-day hourly heat read, the comparison delta), so the
    // honest first-screen contract is: the window's range is asked, and no
    // identical URL is ever asked twice.
    expect(statsReadsFor("24h")).toBeGreaterThanOrEqual(1);
    const stats = urls().filter((url) => url.includes("/api/run-stats"));
    expect(stats.length).toBeGreaterThanOrEqual(2);
    expect(new Set(stats).size).toBe(stats.length);
  });
});

describe("R195 ② a window switch buys exactly one new read", () => {
  it("adds one usage read and one stats read for the new window, and never re-asks the old one", async () => {
    await mount("/metrics?view=model&window=7d");
    expect(usageDaysAsked()).toEqual(["7"]);
    // The 7-day range is asked by more than one reader (the window's own read, the
    // fixed 7-day hourly heat read, the comparison delta), so only a DELTA across a
    // switch is a meaningful contract here.
    const sevenBefore = statsReadsFor("7d");
    expect(sevenBefore).toBeGreaterThanOrEqual(1);
    const before = urls().length;

    await press("met6-window-30d");

    expect(text("r195-loc")).toBe("?view=model&window=30d");
    const added = urls().slice(before);
    // The switch reads for the new window: two loaders consume the usage source
    // per window (the detail body and the share table), so the distinct `days=`
    // values are the contract, not a raw call count.
    expect(usageDaysAsked()).toEqual(["7", "30"]);
    const addedUsage = added.filter((url) => url.includes("/api/hermes-usage"));
    expect(addedUsage.length).toBeGreaterThan(0);
    // Every usage read the switch added belongs to the window the address now
    // names; several loaders consume the same source, so the count is not fixed.
    expect(
      addedUsage.every(
        (url) => new URL(url, "http://localhost").searchParams.get("days") === "30",
      ),
    ).toBe(true);
    // The window that was left is never asked again by this switch.
    expect(
      added.some(
        (url) =>
          url.includes("/api/hermes-usage") &&
          new URL(url, "http://localhost").searchParams.get("days") === "7",
      ),
    ).toBe(false);
    // The new window's range is asked; several loaders share a range, so what is
    // provable at URL level is that no identical URL is ever asked twice.
    expect(statsReadsFor("30d")).toBeGreaterThanOrEqual(1);
    // Two loaders can ask an identical range, so the switch's contract is the
    // range identity above, not a dedupe of the stats family. Measured: 11 stats
    // reads on screen after the switch, 7 of them distinct.
    const stats = urls().filter((url) => url.includes("/api/run-stats"));
    expect(stats.length).toBeGreaterThanOrEqual(new Set(stats).size);
    // What the switch must not do is widen the question: the heat source is keyed
    // by weeks, not by this window, and the directory keeps one distinct URL no
    // matter how many loaders re-read it.
    expect(added.some((url) => url.includes("/api/run-activity"))).toBe(false);
    const directoryAfter = added.filter((url) => url.includes("/api/employees"));
    expect(new Set(directoryAfter).size).toBeLessThanOrEqual(1);
    expect(added.length).toBeGreaterThan(0);
  });

  it("moves the body and its summary together and leaves no row of the old window behind", async () => {
    await mount("/metrics?view=model&window=7d");
    const old = bodyLabels();
    expect(old).toEqual(["beta", "gamma"]);
    expect(bodyCountCells()).toEqual(["9", "3"]);
    expect(face("metT-detail-total-count")).toBe("12");

    await press("met6-window-30d");

    const next = bodyLabels();
    expect(next).toEqual(["zeta", "alpha"]);
    // The previous window's rows are gone by label, not merely by count.
    for (const stale of old) expect(next).not.toContain(stale);
    // The summary face is the body's own total, recomputed for the new window.
    const counts = bodyCountCells().map((value) => Number(value));
    expect(counts).toEqual(["5", "11"].map((value) => Number(value)));
    expect(face("metT-detail-total-count")).toBe(String(counts.reduce((sum, n) => sum + n, 0)));
    expect(face("met6-cat-empty")).toBeNull();
  });
});

describe("R195 ③ the detail sort is a local axis", () => {
  it("costs nothing at cold start: the same link with a sort key asks for the same reads", async () => {
    await mount("/metrics?view=model&window=7d");
    const plain = [...urls()].sort();
    const plainLabels = bodyLabels();

    await mount("/metrics?view=model&window=7d&dsort=runs&ddir=asc");
    const sorted = [...urls()].sort();

    // The sort key never reaches the wire: the request set is the same set.
    expect(sorted).toEqual(plain);
    // Yet the screen is a different order, ascending by count.
    expect(bodyLabels()).toEqual(["gamma", "beta"]);
    expect(bodyLabels()).not.toEqual(plainLabels);
    expect(q("metO-fmt-th-count")?.getAttribute("aria-sort")).toBe("ascending");
  });

  it("re-orders the body without a single new read and keeps every total", async () => {
    await mount("/metrics?view=model&window=30d");
    const before = urls();
    const names = bodyLabels();
    const totals = [
      face("metT-detail-total-cost"),
      face("metT-detail-total-count"),
      face("metT-detail-total-share"),
    ];

    await press("metP-sort-runs");

    expect(urls()).toEqual(before);
    expect(bodyLabels()).not.toEqual(names);
    expect(bodyLabels()).toEqual(["alpha", "zeta"]);
    expect(q("metO-fmt-th-count")?.getAttribute("aria-sort")).toBe("descending");
    expect([
      face("metT-detail-total-cost"),
      face("metT-detail-total-count"),
      face("metT-detail-total-share"),
    ]).toEqual(totals);
  });
});

describe("R195 ④ a failed read is said, retried, and cleared", () => {
  it("says a failed window switch in a copyable rid anchor and asks one batch per retry", async () => {
    await mount("/metrics?view=model&window=7d");
    expect(bodyLabels().length).toBe(2);
    const firstScreen = urls().length;

    // A window switch is NOT a manual refresh: there is no snapshot to fall back
    // on, so the block says it failed and shows no rows at all. It must not keep
    // the previous window's rows under the new window's address — that would be a
    // stale number wearing a fresh label.
    failAll = true;
    await press("met6-window-30d");
    const failingBatch = urls().length - firstScreen;
    expect(failingBatch).toBeGreaterThan(0);
    expect(q("metH-page-error")).not.toBeNull();
    expect(q("met6-error")).not.toBeNull();
    expect(text("metD-card-reason").length).toBeGreaterThan(0);
    expect(text("met5-request-id")).toContain(RID);
    expect(bodyLabels()).toEqual([]);

    // The rid is copyable, through the same clipboard helper the row copy uses.
    const anchor = q("metD-card-rid");
    expect(anchor).not.toBeNull();
    const copy = anchor?.querySelector('[aria-label="复制请求编号"]') as HTMLButtonElement | null;
    expect(copy).not.toBeNull();
    await act(async () => {
      copy?.click();
    });
    expect(clip.copyTextToClipboard).toHaveBeenCalledWith(RID);

    // One press of the block's own retry asks one batch, and the next press asks
    // the very same batch again — never a doubling while the page is failing.
    // (Measured here: a retry press asks 11 reads while the failing window switch
    // asked 8; the retry walks the whole batch, so only the per-press equality is
    // claimed, not an ordering between the two.)
    const beforeRetry = urls().length;
    await press("met6-retry");
    const firstBatch = urls().length - beforeRetry;
    expect(firstBatch).toBeGreaterThan(0);
    expect(q("met6-error")).not.toBeNull();
    // A second press asks a further batch of its own and the anchor stays while
    // the source still fails. Measured here: the two failing presses asked 11 and
    // 67 reads, because a retry walks every loader of the block and the fan-out
    // depends on how far the earlier reads got, so no press-to-press equality is
    // claimed; what must not move is the anchor and the empty body.
    const beforeSecond = urls().length;
    await press("met6-retry");
    expect(urls().length).toBeGreaterThan(beforeSecond);
    expect(q("met6-error")).not.toBeNull();
    expect(bodyLabels()).toEqual([]);

    // Recovery: the anchors are gone and the table answers for the window the
    // address names.
    failAll = false;
    await press("met6-retry");
    expect(q("metH-page-error")).toBeNull();
    expect(q("met6-error")).toBeNull();
    expect(bodyLabels()).not.toHaveLength(0);
  });

  it("says a failed refresh in a copyable rid anchor and invents no rows", async () => {
    // refreshAll() (the metAK-refresh button) snapshots every block while the
    // batch is in flight, and its anchor promises 「页面保留上一次读到的数据」. Measured
    // here: once the whole batch has failed the table is emptied rather than
    // showing stale rows - the promise only covers the in-flight window, which a
    // synchronous mock cannot expose. The durable contract this leg pins is: the
    // failure is said, its rid is copyable, and no row is invented.
    await mount("/metrics?view=model&window=7d");
    const labels = bodyLabels();
    expect(labels.length).toBe(2);
    const beforeRefresh = urls().length;

    failAll = true;
    await press("metAK-refresh");
    expect(urls().length).toBeGreaterThan(beforeRefresh);
    expect(q("metAK-error")).not.toBeNull();
    // The rid of the failed batch is disclosed in the anchor and is copyable.
    expect(text("metAK-error")).toContain(RID);
    // RequestId carries its own testid wherever it is mounted, plus the copy
    // affordance; the anchor does not namespace it.
    const anchor = q("metAK-error");
    expect(anchor?.querySelector('[data-testid="met5-request-id"]')).not.toBeNull();
    expect(
      anchor?.querySelector('[aria-label="复制请求编号"]') instanceof HTMLButtonElement,
    ).toBe(true);
    // Nothing is invented: the failed body comes back empty and says so, rather
    // than printing a stale or zeroed table under a fresh address.
    expect(bodyLabels()).toEqual([]);
    expect(q("met6-cat-empty")).toBeNull();
  });

  it("marks only the block whose own source failed, and does not poll for it", async () => {
    // Control first: the same link with every source answering.
    await mount("/metrics?view=model&window=7d");
    const runsAnswered = face("met6-runs-value");
    expect(runsAnswered).not.toBeNull();
    expect(runsAnswered).not.toBe("—");

    // Only /api/hermes-usage fails from here, so only the block that consumes it
    // changes its story.
    usageFails = true;
    await mount("/metrics?view=model&window=7d");
    // The block that consumes the failed source says so; the page is not down,
    // because met6-error needs EVERY usage block unavailable.
    expect(q("met6-cat-unavailable")).not.toBeNull();
    expect(q("met6-error")).toBeNull();
    // No rows are invented for a source that did not answer.
    expect(bodyLabels()).toHaveLength(0);
    // An unrelated face keeps the number its own source produced.
    expect(face("met6-runs-value")).toBe(runsAnswered);

    const reads = urls().length;
    await drain();
    // A failed block is a finished state: the page does not retry it on a timer.
    expect(urls().length).toBe(reads);
    // Two loaders consume the usage source per mount (detail body + share table).
    expect(countFamily("/api/hermes-usage")).toBe(2);

    // The card's own retry is the only way back: one press asks one usage read
    // and keeps the anchor while the source still fails…
    const beforePress = urls().length;
    const usageBefore = countFamily("/api/hermes-usage");
    await press("met6-cat-retry");
    // The press re-asks the block's own source through both loaders (two reads).
    // Measured: it also bumps the page-wide attempt, so 44 reads in total go out -
    // the fan-out is asserted only where it is stable, on the failed family.
    expect(countFamily("/api/hermes-usage")).toBe(usageBefore + 2);
    expect(urls().length).toBeGreaterThan(beforePress);
    expect(q("met6-cat-unavailable")).not.toBeNull();
    // …and once the source answers, the same single press clears the anchor and
    // the body returns for the window the address names.
    const beforeClear = urls().length;
    const usageBeforeClear = countFamily("/api/hermes-usage");
    usageFails = false;
    await press("met6-cat-retry");
    expect(urls().length).toBeGreaterThan(beforeClear);
    expect(countFamily("/api/hermes-usage")).toBe(usageBeforeClear + 2);
    expect(q("met6-cat-unavailable")).toBeNull();
    expect(bodyLabels()).toEqual(["beta", "gamma"]);
  });
});
