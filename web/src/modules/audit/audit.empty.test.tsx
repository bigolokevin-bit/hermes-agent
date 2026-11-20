// @vitest-environment jsdom
// R181 — the empty leg of /audit and the way back out of it.
//
// What this holds: an empty answer is a SENTENCE about the question that produced
// it, never a bare 「0 条」 posing as a state; the page keeps its anchors so the
// person is not dropped on an empty room with no door; both named exits — 清空区间
// and 清掉类型筛选 — go back through the page's ONE paging reset, so the deep link
// (`?event=`) and the cursor stack leave with the filter instead of lingering as a
// second, stale question; and with nothing on screen the row-level copy column is
// simply absent while the record copy control stays visible, disabled, and says why.
//
// The four-state words are not re-typed here: the guard reads the surface's own
// `audF-state-list-empty` mark and compares it to the exported `STATE_LABEL`, which
// is the single home every face already quotes (R106/R108 同句), and an attribute is
// an attribute — it is not in the text content (the R161 lesson).
//
// Not repeated: R113 (event add/remove pair-sets), R121 (the copy control's own
// line/refusal/disabled wording), R133 (filter URL backfill and illegal values),
// R137/R143 (cross-face value equality), R141 (the export triangle), R153 (the time
// ladder), R161 (the cursor stack and whole-page replace), R170 (the picker shape),
// R177 (the operator filter). What is new is the empty leg and its exits as one claim.

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { STATE_LABEL } from "@/modules/audit/stateCopy";
import { DETAIL_COPY_DISABLED_TITLE } from "@/modules/audit/detailCopy";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

const ID = "evt_present_00000001";
const ACTOR = "user:2f3a4b5c6d7e8f90";

/** An interval the ledger answers with nothing, and the default that answers with rows. */
const FROM = "2026-11-05T02:00:00Z";
const TO = "2026-11-05T02:30:00Z";
const EMPTY_RANGE = `?window=custom&from=${FROM}&to=${TO}`;

function rowOf(eventId: string, action: string) {
  return {
    eventId,
    action,
    occurredAt: "2026-11-19T01:20:00Z",
    recordedAt: "2026-11-19T01:20:01Z",
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: "ap_1122334455667788" },
    requestId: `req-${eventId}`,
  };
}

const TWO = [rowOf(ID, "task.created"), rowOf("evt_present_00000002", "run.failed")];

interface PageBody {
  items: Record<string, unknown>[];
  nextCursor?: string | null;
}

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}

/**
 * The ledger's answer, by what was asked. A stated interval of half an hour
 * around 2026-11-05 is empty; the quick windows carry the two rows. The type
 * filter is honoured too, so the 类型 exit has a real empty leg to leave.
 */
function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      return { audit: TWO[0] };
    }
    const action = paramOf(target, "action");
    if (action === "approval.denied") {
      const page: PageBody = { items: [], nextCursor: null };
      return page;
    }
    const from = paramOf(target, "from") ?? "";
    const emptyRange = from.startsWith("2026-11-05T02:00");
    const page: PageBody = { items: emptyRange ? [] : TWO, nextCursor: null };
    return page;
  });
}

/** Where the page put the address, so the exits can be read pair by pair. */
function LocationProbe(): ReactNode {
  const location = useLocation();
  return <span data-testid="probe-location">{`${location.pathname}${location.search}`}</span>;
}

async function render(entry: string): Promise<void> {
  await act(async () => {
    if (root) act(() => root?.unmount());
  });
  root = null;
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <AuditEventsModulePage />
        <LocationProbe />
      </MemoryRouter>,
    );
  });
  await waitFor(() => document.querySelector(".animate-pulse") === null, "skeleton gone");
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number => urls().filter((url) => /^\/agent-api\/api\/audit\?/.test(url)).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";
const textOf = (testId: string): string | null =>
  document.querySelector(`[data-testid='${testId}']`)?.textContent ?? null;
const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((node) =>
    String(node.getAttribute("data-testid")).replace("aud01-row-", ""),
  );
const address = (): string => document.querySelector("[data-testid='probe-location']")?.textContent ?? "";
const pairs = (): string[] => {
  const query = address().slice(address().indexOf("?") + 1);
  if (!address().includes("?")) return [];
  return [...new URLSearchParams(query)].map(([key, value]) => `${key}=${value}`).sort();
};
async function click(testId: string): Promise<void> {
  const node = document.querySelector(`[data-testid='${testId}']`) as HTMLElement | null;
  await act(async () => {
    node?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  answer();
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R181 - an empty answer is a sentence, not a number", () => {
  it("says what came back empty, keeps the page's anchors, and shows no bare count", async () => {
    await render(`/audit${EMPTY_RANGE}`);
    await waitFor(() => document.querySelector("[data-testid='aud01-empty']") !== null, "empty panel");

    const panel = textOf("aud01-empty") ?? "";
    expect(panel).toContain("该时间段内无事件");
    expect(panel).toContain("没有审计事件");
    // A state is words. The 「将导出 N 条」 line below belongs to the export
    // affordance and is pinned separately, below, as its own honest zero.
    expect(panel).not.toMatch(/0\s*条/);
    expect(paintedRows()).toEqual([]);

    // and the four-state word is the one the module exports, not a re-typed copy
    expect(
      document
        .querySelector("[data-testid='audF-state-list-empty']")
        ?.getAttribute("data-audf-label"),
    ).toBe(STATE_LABEL.empty);

    // the room is empty but the doors are where they always were
    for (const anchor of ["agent-v2-page-audit", "aud01-filters", "aud5-export-bar"]) {
      expect(document.querySelector(`[data-testid='${anchor}']`), anchor).not.toBeNull();
    }
    // with no rows there is no pager to pretend with (R161: it renders only for rows)
    expect(document.querySelector("[data-testid='aud2-pagination']")).toBeNull();
    expect(listReads()).toBe(1);
  });

  it("turns both export buttons off with the reason, and a click asks for nothing", async () => {
    await render(`/audit${EMPTY_RANGE}`);
    await waitFor(() => document.querySelector("[data-testid='aud01-empty']") !== null, "empty panel");

    const before = urls();
    for (const [testId, title] of [
      ["aud01-export", "当前筛选没有可导出的记录"],
      ["aud5-export", "当前筛选无事件可导出"],
    ] as const) {
      const button = document.querySelector(`[data-testid='${testId}']`) as HTMLButtonElement | null;
      expect(button, testId).not.toBeNull();
      expect(button?.disabled, `${testId} is off`).toBe(true);
      expect(button?.getAttribute("title"), `${testId} says why`).toBe(title);
      await click(testId);
    }
    // disabled means disabled: no file handed over, and no new question asked
    expect(urls()).toEqual(before);
    expect(listReads()).toBe(1);
    // the count line is the export bar's own number, honest about being zero
    expect(textOf("aud5-export-count")).toContain("将导出 0 条");
  });
});

describe("R181 - the named exits, and what they take with them", () => {
  it("清空区间 goes back to the default window, restores the rows, and drops the deep link", async () => {
    await render(`/audit${EMPTY_RANGE}&event=${ID}`);
    await waitFor(() => document.querySelector("[data-testid='aud01-empty']") !== null, "empty panel");
    expect(textOf("audB-empty-exit")).toContain("这一段里没有记录。");
    expect(address()).toContain(`event=${ID}`);

    const before = urls();
    await click("audB-empty-clear");
    await waitFor(() => listReads() === 2, "the default window was read");

    // one new question, one read: the exit did not leave a stale page behind
    expect(urls().length).toBe(before.length + 1);
    expect(pairs()).toEqual(["window=7d"]);
    expect(address()).not.toContain("from=");
    expect(address()).not.toContain("event=");
    // the rows came back, and the empty leg is gone with the range that made it
    await waitFor(() => paintedRows().length === 2, "rows restored");
    expect(document.querySelector("[data-testid='aud01-empty']")).toBeNull();
    const read = lastListRead();
    expect(
      Date.parse(decodeURIComponent(paramOf(read, "to") ?? "")) -
        Date.parse(decodeURIComponent(paramOf(read, "from") ?? "")),
    ).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("清掉类型筛选 is the other exit, and it clears the deep link the same way", async () => {
    await render(`/audit?window=7d&type=approval.denied&event=${ID}&preview=${ID}`);
    await waitFor(() => document.querySelector("[data-testid='aud01-empty']") !== null, "empty panel");
    await waitFor(() => document.querySelector("[data-testid='audD-empty-exit']") !== null, "the type exit");
    expect(textOf("audD-empty-exit")).toContain("该条件下无事件");
    expect(paintedRows()).toEqual([]);

    const before = urls();
    await click("audD-empty-clear");
    await waitFor(() => listReads() === 2, "all types were read");
    expect(urls().length).toBe(before.length + 1);
    // no type, no deep link, no fold left open against a set of rows that is gone
    expect(pairs()).toEqual(["window=7d"]);
    expect(address()).not.toContain("event=");
    expect(address()).not.toContain("preview=");
    await waitFor(() => paintedRows().length === 2, "rows restored");
    expect(paramOf(lastListRead(), "action")).toBeNull();
  });
});

describe("R181 - nothing on screen, and what that does to the copy controls", () => {
  it("has no row copy column to offer, and keeps the record copy disabled with its reason", async () => {
    await render(`/audit${EMPTY_RANGE}`);
    await waitFor(() => document.querySelector("[data-testid='aud01-empty']") !== null, "empty panel");

    // no rows ⇒ no row-level 关联资源 cell and no record anchor anywhere
    expect(paintedRows()).toEqual([]);
    expect(document.querySelectorAll("[data-testid='aud-resource-link']")).toHaveLength(0);
    // narrowed to the row-cell family: the filter's own input is legitimately
    // named …-resource (aud8-filter-resource) and is not a row column
    expect(
      document.querySelectorAll("[data-testid^='aud01-cell-'][data-testid$='-resource']"),
    ).toHaveLength(0);
    expect(document.querySelectorAll("[data-testid^='aud01-cell-']")).toHaveLength(0);

    // the record copy control is still there, disabled, and says why — a hidden
    // control teaches a person to hunt, a disabled one answers the question
    const copy = document.querySelector("[data-testid='aud-detail-copy']") as HTMLButtonElement | null;
    expect(copy, "the copy control is shown, not hidden").not.toBeNull();
    expect(copy?.disabled).toBe(true);
    expect(copy?.getAttribute("title")).toBe(DETAIL_COPY_DISABLED_TITLE);
    const before = urls();
    await click("aud-detail-copy");
    expect(urls()).toEqual(before);
    expect(textOf("aud-detail-copy-status")).toBe("");
    // an empty leg is a state about the question, never a reading of the clock
    expect(document.body.textContent).not.toContain("undefined");
  });
});
