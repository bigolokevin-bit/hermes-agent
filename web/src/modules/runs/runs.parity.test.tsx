// @vitest-environment jsdom
// R126 · the list row's own cells versus the same row's expand region, one DOM
// node against one DOM node, per field. `runs.parity.test.ts` already owns
// preview↔copy↔CSV (incl. the true-0 `$0.00`/`"0.00"` pair and the missing-value
// contrast, :154-186) and the zero-extra-read claim on expand (:240-252), and
// `runs.pagecap.test.tsx` owns the cap's honesty states (:90-142) — none of that
// is repeated here. What was missing, and is closed below:
//
//   A. cell↔field equality per surface pair (`run5-row-N-*` versus
//      `run-row-preview-N-*`), instead of the bulk `toContain` the older
//      `RunsModulePage.test.tsx:1588-1605` settles for;
//   B. the `run-page-cap` line staying byte-identical across an expand —
//      `runs.pagecap.test.tsx` never clicks a toggle;
//   C. a true zero and a gap rendering the same words on both faces;
//   D. a negative control, so the equalities above cannot pass vacuously.
//
// Each pair below names the helper that owns its format, and the assertion goes
// cell → helper → dd, so the DOM equality is a proof of single-format rather
// than a restatement of one. Where the two faces legitimately differ, the test
// asserts what the product actually prints and the comment says it is a
// divergence (see the open-run 耗时 column and the missing-status wording).

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import { RunsModulePage } from "./RunsModulePage";
import {
  PAGE_LIMIT,
  beijingMinute,
  costText,
  elapsedMinute,
  employeeLabel,
  pageCapText,
  runCode,
  runPreview,
  statusLabel,
} from "./runs";

const FIELD_MISSING = "该字段未返回";
const DASH = "—";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

/**
 * Bounded by attempts, not by `Date.now()`: two cases below freeze the clock with
 * `vi.useFakeTimers({ toFake: ["Date"] })`, and a wall-clock guard would never
 * expire there — a genuinely missing node would spin instead of failing fast.
 * 600 ticks of the 5 ms sleep is the same 3 s budget the other runs files use.
 */
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
const rows = (): number => document.querySelectorAll("[data-testid^='run5-row-'][data-status]").length;
const node = (testid: string): HTMLElement | null =>
  document.querySelector(`[data-testid='${testid}']`) as HTMLElement | null;

/** `/api/runs` is the list leg; the two detail legs answer for `?run=`. */
const okList = (items: unknown[], nextCursor: string | null = null) => async (url: string) => {
  if (url.includes("/api/run-detail")) return { ...(items[0] as object) };
  if (url.includes("/api/run-events")) return { items: [], hasMore: false };
  if (url.includes("/api/runs") || url.includes("/api/run-stats")) return { items, nextCursor };
  return { items: [] };
};

/** The list row's own cell text (`-start`, not `-started`: the column ids). */
const cell = (index: number, field: string): string => node(`run5-row-${index}-${field}`)?.textContent ?? "";
/** The expand region's `<dd>` for the same row. */
const preview = (index: number, field: string): string =>
  node(`run-row-preview-${index}-${field}`)?.querySelector("dd")?.textContent ?? "";

/** The short code the run cell prints, without the copy button's icon. */
const codeOf = (testid: string): string => node(testid)?.querySelector(":scope > span")?.textContent ?? "";

/**
 * The USD figure inside a cost cell. The cell is the figure plus a badge, and
 * for a gap plus a reason line, so the figure is the first span of the first
 * span — the same shape on the list (`run5-row-N-cost`) and the detail
 * (`run5-detail-cost`), because both render `CostCell`.
 */
const costFigureOf = (testid: string): string => {
  const line = node(testid)?.querySelector(":scope > span");
  return line?.querySelector(":scope > span")?.textContent ?? "";
};

async function openPreview(index: number): Promise<void> {
  const toggle = node(`run-row-toggle-${index}`) as HTMLButtonElement;
  await act(async () => {
    toggle.click();
  });
}

const P_FULL = {
  runId: "rn_01M7822PARITY00000000001",
  status: "completed",
  costStatus: "upstream",
  costUsd: 0,
  startedAt: "2026-11-18T02:00:00Z",
  endedAt: "2026-11-18T02:11:00Z",
  employeeId: "emp_aaaabbbbcccc",
};
const P_HALF = {
  runId: "rn_01M7822PARITY00000000002",
  status: "running",
  costStatus: "unknown",
  costUsd: null,
  startedAt: "2026-11-18T03:30:00Z",
  employeeId: "emp_ddddeeeeffff",
};
const P_BARE = {
  runId: "rn_01M7822PARITY00000000003",
  startedAt: "2026-11-18T04:00:00Z",
};

/** The page-cap fixture, mirroring `runs.pagecap.test.tsx:21-32`. */
function capRow(n: number) {
  return {
    runId: `rn_01M7822CAP${String(n).padStart(4, "0")}`,
    employeeId: "emp_aaaabbbbcccc",
    status: n % 2 === 0 ? "failed" : "completed",
    costUsd: n,
    costStatus: "known",
    startedAt: "2026-11-18T02:00:00.000Z",
    endedAt: "2026-11-18T02:11:00.000Z",
  };
}

beforeEach(() => {
  api.fetchJSON.mockReset();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("runs parity — the row's cells against its own expand region", () => {
  it("A. prints one text per field on both faces of a complete row", async () => {
    api.fetchJSON.mockImplementation(okList([P_FULL]));
    await render("/runs");
    await waitFor(() => rows() === 1, "one row");
    await openPreview(0);
    // The region the toggle points at is the one being compared.
    expect(node("run-row-toggle-0")?.getAttribute("aria-controls")).toBe("run-row-preview-0");
    expect(node("run5-row-0")?.getAttribute("aria-expanded")).toBe("true");

    const view = runPreview(P_FULL, new Map());

    // runId short code — `runCode` owns it; the second face is the row label,
    // since the expand region carries no code field of its own.
    expect(codeOf("run5-row-0-code")).toBe(runCode(P_FULL.runId));
    expect(node("run5-row-0")?.getAttribute("aria-label")).toBe(`${codeOf("run5-row-0-code")}：${cell(0, "status")}`);

    // status 人话 — `statusLabel`, list :633 and preview :787 read the same call.
    expect(cell(0, "status")).toBe(statusLabel(P_FULL.status));
    expect(preview(0, "status")).toBe(statusLabel(P_FULL.status));
    expect(cell(0, "status")).toBe(preview(0, "status"));

    // started — `beijingMinute`, list :579/:636 and preview :791.
    expect(cell(0, "start")).toBe(beijingMinute(P_FULL.startedAt).text);
    expect(preview(0, "started")).toBe(beijingMinute(P_FULL.startedAt).text);
    expect(cell(0, "start")).toBe(preview(0, "started"));

    // ended — `beijingMinute` again; the list has no 结束 column, so this pair's
    // second face is the detail page (below) and the copy text (parity.ts:156).
    expect(preview(0, "ended")).toBe(beijingMinute(P_FULL.endedAt).text);

    // elapsed — `elapsedMinute`, list :580/:638 and preview :804.
    expect(cell(0, "elapsed")).toBe(elapsedMinute(P_FULL.startedAt, P_FULL.endedAt).text);
    expect(preview(0, "elapsed")).toBe(elapsedMinute(P_FULL.startedAt, P_FULL.endedAt).text);
    expect(cell(0, "elapsed")).toBe(preview(0, "elapsed"));

    // cost — `costText`, list `CostCell` :209 and preview :813.
    expect(costFigureOf("run5-row-0-cost")).toBe(costText(P_FULL));
    expect(preview(0, "cost")).toBe(costText(P_FULL));
    expect(costFigureOf("run5-row-0-cost")).toBe(preview(0, "cost"));

    // employee — `employeeLabel`, list :651 and preview :817.
    expect(cell(0, "employee")).toBe(employeeLabel(P_FULL.employeeId, new Map()));
    expect(preview(0, "employee")).toBe(employeeLabel(P_FULL.employeeId, new Map()));
    expect(cell(0, "employee")).toBe(preview(0, "employee"));

    // Every dd is the shared helper's own string, so the cell↔dd equalities above
    // ride on one source of truth rather than on two renderings that happen to match.
    expect(preview(0, "status")).toBe(view.status.text);
    expect(preview(0, "started")).toBe(view.started.text);
    expect(preview(0, "ended")).toBe(view.ended.text);
    expect(preview(0, "elapsed")).toBe(view.elapsed.text);
    expect(preview(0, "cost")).toBe(view.cost.text);
    expect(preview(0, "employee")).toBe(view.employee.text);

    // Six different strings: one field's text can never answer for another's,
    // which is exactly what a bulk `detailText().toContain(value)` allows.
    const six = [
      cell(0, "status"),
      cell(0, "start"),
      preview(0, "ended"),
      cell(0, "elapsed"),
      costFigureOf("run5-row-0-cost"),
      cell(0, "employee"),
    ];
    expect(new Set(six).size).toBe(6);
  });

  it("C. reads a true zero as $0.00 on both faces, never as a gap", async () => {
    api.fetchJSON.mockImplementation(okList([P_FULL, P_HALF]));
    await render("/runs");
    await waitFor(() => rows() === 2, "two rows");
    await openPreview(0);

    expect(P_FULL.costUsd).toBe(0);
    expect(costFigureOf("run5-row-0-cost")).toBe("$0.00");
    expect(preview(0, "cost")).toBe("$0.00");
    expect(costFigureOf("run5-row-0-cost")).toBe(preview(0, "cost"));
    for (const text of [costFigureOf("run5-row-0-cost"), preview(0, "cost")]) {
      expect(text).not.toBe(DASH);
      expect(text).not.toBe(FIELD_MISSING);
    }
    // The 0 is priced, not missing: the cell carries 已计价 and no reason line.
    expect(node("run5-row-0-cost")?.textContent).toContain("已计价");
    expect(node("run5-row-0-cost")?.textContent).not.toContain("未记录");
    expect(node("run5-row-0-cost")?.querySelector(":scope > span:nth-child(2)")).toBeNull();
  });

  it("C. keeps one wording per gap the two faces share, and says where they do not", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-18T04:00:00Z"));
    api.fetchJSON.mockImplementation(okList([P_BARE]));
    await render("/runs");
    await waitFor(() => rows() === 1, "one row");
    await openPreview(0);

    // cost: costStatus absent → `costText` dashes on both faces, and the list
    // badge says 未记录. Same words, same owner.
    expect(costFigureOf("run5-row-0-cost")).toBe(DASH);
    expect(preview(0, "cost")).toBe(DASH);
    expect(costFigureOf("run5-row-0-cost")).toBe(preview(0, "cost"));
    expect(node("run5-row-0-cost")?.textContent).toContain("未记录");

    // employee: `employeeLabel` gives 未指派 to both faces.
    expect(cell(0, "employee")).toBe("未指派");
    expect(preview(0, "employee")).toBe("未指派");

    // DIVERGENCE (asserted, not papered over): a missing status reads 「—」 in
    // the column (statusLabel's own dash) and 「该字段未返回」 in the region
    // (runPreview :788). The spec asked for one wording; the product has two,
    // each owned by a different call site.
    expect(cell(0, "status")).toBe(statusLabel(undefined));
    expect(cell(0, "status")).toBe(DASH);
    expect(preview(0, "status")).toBe(FIELD_MISSING);
    expect(cell(0, "status")).not.toBe(preview(0, "status"));

    // DIVERGENCE: the 耗时 column closes an open run with the wall clock
    // (elapsedMinute's `openRun` branch, list :580) while the region refuses to
    // borrow it (runPreview :802). Same fixture, two answers.
    expect(cell(0, "elapsed")).toBe("刚开始，不足 1 分钟");
    expect(preview(0, "elapsed")).toBe(DASH);
    expect(cell(0, "elapsed")).not.toBe(preview(0, "elapsed"));

    // ended has no list column at all, so only the region states the gap here.
    expect(preview(0, "ended")).toBe(FIELD_MISSING);
  });

  it("C. dashes an open run's cost the same way on both faces", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-18T04:00:00Z"));
    api.fetchJSON.mockImplementation(okList([P_HALF]));
    await render("/runs");
    await waitFor(() => rows() === 1, "one row");
    await openPreview(0);

    // costUsd null with costStatus unknown: the figure stays a dash on both
    // faces, with 未知 and the reason only in the column.
    expect(costFigureOf("run5-row-0-cost")).toBe(DASH);
    expect(preview(0, "cost")).toBe(DASH);
    expect(node("run5-row-0-cost")?.textContent).toContain("未知");
    // A priced null never leaks a figure.
    expect(node("run5-row-0-cost")?.textContent).not.toContain("$0.00");
    expect(preview(0, "cost")).not.toContain("$");
    // status/started still pair exactly for this row.
    expect(cell(0, "status")).toBe(preview(0, "status"));
    expect(cell(0, "start")).toBe(preview(0, "started"));
  });

  it("B. leaves the page-cap line byte-identical when a row opens", async () => {
    api.fetchJSON.mockImplementation(okList(Array.from({ length: PAGE_LIMIT }, (_, i) => capRow(i + 1)), "cursor-2"));
    await render("/runs");
    await waitFor(() => rows() === PAGE_LIMIT, `${PAGE_LIMIT} rows`);

    const before = node("run-page-cap")?.textContent ?? "";
    expect(before).toContain(`已加载 ${PAGE_LIMIT} 行`);
    expect(before).toContain(pageCapText());
    // The warning span rides inside the same node, so it is covered too.
    expect(node("run-page-cap-more")?.textContent ?? "").not.toBe("");
    const reads = urls();
    const runsBefore = runsReads();
    expect(runsBefore).toBeGreaterThan(0);

    await openPreview(0);
    expect(node("run-row-preview-0")).not.toBeNull();
    expect(node("run-row-toggle-0")?.getAttribute("aria-expanded")).toBe("true");

    expect(node("run-page-cap")?.textContent ?? "").toBe(before);
    expect(node("run-page-cap")?.textContent ?? "").toContain(`已加载 ${PAGE_LIMIT} 行`);
    expect(node("run-page-cap")?.getAttribute("title")).toBeDefined();
    // Opening a row is not a page event either: no new read of any kind.
    expect(runsReads()).toBe(runsBefore);
    expect(urls()).toEqual(reads);
  });

  it("D. moves both faces together when the data moves, and fails the old pair", async () => {
    api.fetchJSON.mockImplementation(okList([P_FULL]));
    await render("/runs");
    await waitFor(() => rows() === 1, "one row");
    await openPreview(0);
    const oldStart = cell(0, "start");
    const oldPreviewStart = preview(0, "started");
    const oldElapsed = cell(0, "elapsed");
    expect(oldStart).toBe(oldPreviewStart);
    expect(oldStart).toBe("2026-11-18 10:00");

    // One field changes: the earlier start moves 开始 and 耗时 together.
    const later = { ...P_FULL, startedAt: "2026-11-18T01:45:00Z" };
    api.fetchJSON.mockImplementation(okList([later]));
    await render("/runs");
    await waitFor(() => rows() === 1, "one row after the change");
    await openPreview(0);

    expect(cell(0, "start")).toBe("2026-11-18 09:45");
    expect(preview(0, "started")).toBe("2026-11-18 09:45");
    expect(cell(0, "elapsed")).toBe("26 分钟");
    expect(preview(0, "elapsed")).toBe("26 分钟");
    // The old paired text no longer matches anything on either face — the
    // equality in A is not a constant two nodes happen to share.
    expect(cell(0, "start")).not.toBe(oldStart);
    expect(preview(0, "started")).not.toBe(oldPreviewStart);
    expect(cell(0, "start")).not.toBe(oldPreviewStart);
    expect(node("run-row-preview-0")?.textContent ?? "").not.toContain(oldStart);
    expect(cell(0, "elapsed")).not.toBe(oldElapsed);
    expect(node("run5-row-0-start")?.parentElement?.textContent ?? "").not.toContain(oldStart);
    // Unchanged fields keep matching, so the control did not just blank the row.
    expect(cell(0, "status")).toBe(preview(0, "status"));
    expect(costFigureOf("run5-row-0-cost")).toBe(preview(0, "cost"));
  });

  it("detail. gives the same text as the row's cells to /runs/:runId's own elements", async () => {
    api.fetchJSON.mockImplementation(okList([P_FULL]));
    // This route legitimately asks twice more (loadRunDetail + loadRunEvents);
    // no zero-request claim belongs here, only field equality.
    await render(`/runs?run=${encodeURIComponent(P_FULL.runId)}`);
    await waitFor(() => rows() === 1, "row ready");
    await waitFor(() => node("run5-detail") !== null, "detail ready");
    await openPreview(0);

    // Literal anchors first: an absent node reads "" on both sides of a pair,
    // so each face is proven non-empty before it is compared.
    expect(node("run5-detail-status")?.textContent).toBe("成功");
    expect(node("run5-detail-ended")?.textContent).toBe("2026-11-18 10:11");
    expect(node("run5-detail-employee")?.textContent).toBe("员工 · AAAABBBB");
    expect(costFigureOf("run5-detail-cost")).toBe("$0.00");
    expect(node("run5-detail-status")?.textContent).toBe(cell(0, "status"));
    expect(node("run5-detail-ended")?.textContent).toBe(preview(0, "ended"));
    expect(node("run5-detail-employee")?.textContent).toBe(cell(0, "employee"));
    expect(costFigureOf("run5-detail-cost")).toBe(costFigureOf("run5-row-0-cost"));
    // 开始 and 耗时 reach the detail page inside one composed summary line, so
    // the pair is read out of that element rather than searched in the page body.
    const summary = node("run5-detail-summary")?.textContent ?? "";
    const matched = /·\s*开始\s*(.+?)\s*·\s*耗时\s*(.+)$/.exec(summary);
    expect(matched).not.toBeNull();
    expect(matched?.[1]).toBe(cell(0, "start"));
    expect(matched?.[2]).toBe(cell(0, "elapsed"));
    // The detail h2 is the same runCode the row cell printed.
    expect(node("run5-detail")?.querySelector("h2")?.textContent).toBe(codeOf("run5-row-0-code"));
  });
});
