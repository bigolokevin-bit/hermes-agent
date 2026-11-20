// @vitest-environment jsdom
// R201 — the same event, read under a live filter set, says one thing in four
// places: the list row, the record pane, the row's copied line (aud-detail-copy)
// and the exported file.
//
// What is already owned elsewhere and is deliberately NOT re-pinned: value
// equality on an UNFILTERED mount (R137 「say one actor, one action, one object,
// byte for byte」 and R143 「copies those same four answers」), the four-place
// OPERATOR including the file (R177 「row, record, copied line and exported file
// print one masked name」), the time four places (R153), the RFC4180 escaping and
// the column order of the file (R192), the deep link's own add/remove ledger and
// the 「keeps the list」 leg (R113), the ConsoleSelect shape (R170), the paging
// ledger (R161), the URL backfill and illegal values (R133), the export triangle
// (R141), the empty-state exits (R181), the per-leg fetch guards (R196).
//
// R201's own claims: the equality held WHILE `?actor=` / `?type=` / `?resource=`
// / `?limit=` are live (a filtered answer is a different answer set, and a copy
// built from the wrong one is exactly the bug that would hide here); the same
// equality after MUTATING the quick window into a stated interval rather than
// mounting cold; and the absence ladder in the copy and the file pinned as
// SHIPPED — see the note above the second case.

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { CSV_HEADER } from "@/modules/audit/csv";
import { DETAIL_COPY_DISABLED_TITLE } from "@/modules/audit/detailCopy";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTOR = "user:2f3a4b5c6d7e8f90";
const WHO = "李思 · 6d7e8f90";
const ACTION = "task.created";
const ACTION_WORDS = "创建任务";
const RESOURCE = "ap_1122334455667788";
const OBJECT = "审批单 · 55667788";
const FIRST = "evt_dc_first_00001";
const SECOND = "evt_dc_second_00001";
const GONE = "evt_dc_absent_000001";
const FROM = "2026-11-05T02:00:00Z";
const TO = "2026-11-19T02:00:00Z";

/** The filter set these guards run under — the address keys, not the wire keys. */
const FILTERS = `actor=${encodeURIComponent(ACTOR)}&type=${ACTION}&resource=${RESOURCE}&limit=25`;

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: { type?: string; id?: string; displayName?: string };
  resource: { type?: string; id?: string };
  requestId: string | null;
  correlationId?: string;
}

/** Two events that both answer the filter set, so a row order exists to hold. */
const rowOf = (eventId: string, index: number, instant: string): Row => ({
  eventId,
  action: ACTION,
  // 2026-11-19T01:20:00Z = 09:20:00 北京 — the face prints seconds, the file a minute.
  occurredAt: instant,
  outcome: "succeeded",
  actor: { type: "human", id: ACTOR, displayName: "李思" },
  resource: { type: "approval", id: RESOURCE },
  requestId: `req-dc-${index}-0a7b3c`,
  correlationId: `cor-001122334455${index}6`,
});

/** An answer that names nobody and nothing: the absence ladder, in one row. */
const BLANK_ROW: Row = {
  eventId: "evt_dc_blank_0000001",
  action: ACTION,
  occurredAt: "2026-11-19T01:20:00Z",
  outcome: "succeeded",
  actor: {},
  resource: {},
  requestId: null,
};

interface PageBody {
  items: Row[];
  nextCursor?: string | null;
}

/**
 * The list answers the filtered question; the record route answers for itself.
 * Without that second leg the pane has nothing to parse and none of its faces
 * exist — a mistake R177 already cost this lane.
 */
function answer(rows: Row[]): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      const id = paramOf(target, "id");
      if (id === GONE) {
        throw new ApiError("gone", {
          status: 403,
          body: '{"code":"console.forbidden","rid":"rid-dc-absent"}',
          url: target,
          requestId: "rid-dc-absent",
        });
      }
      return { audit: rows.find((row) => row.eventId === id) ?? rows[0] };
    }
    const page: PageBody = { items: rows, nextCursor: null };
    return page;
  });
}

let root: Root | null = null;

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

async function render(entry: string): Promise<void> {
  await act(async () => {
    if (root) act(() => root?.unmount());
  });
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
  await waitFor(() => !document.querySelector(".animate-pulse"), "skeleton gone");
}

/** Where the page put the address, so the guards can compare it pair for pair. */
function LocationProbe(): ReactNode {
  const location = useLocation();
  return <span data-testid="probe-location">{`${location.pathname}${location.search}`}</span>;
}

const node = (testId: string): Element | null =>
  document.querySelector(`[data-testid='${testId}']`);
const textOf = (testId: string): string | null => node(testId)?.textContent ?? null;
/** A Field prints its label and its value; only the `dd` may be compared. */
const fieldValue = (testId: string): string | null =>
  node(testId)?.querySelector("dd")?.textContent?.trim() ?? null;
const markValue = (mark: string): string | null => node(mark)?.getAttribute("data-audj-value") ?? null;
const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number => urls().filter((url) => /^\/agent-api\/api\/audit\?/.test(url)).length;
const detailReads = (): number => urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length;
const paramOf = (url: string, key: string): string | null =>
  new URL(url, "http://console.test").searchParams.get(key);
/** Every query pair, decoded, in sort order — repeated keys each appear once. */
const pairs = (): string[] => {
  const address = document.querySelector("[data-testid='probe-location']")?.textContent ?? "";
  const query = address.slice(address.indexOf("?") + 1);
  if (!address.includes("?")) return [];
  return [...new URLSearchParams(query)].map(([key, value]) => `${key}=${value}`).sort();
};
const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    element.getAttribute("data-testid")?.replace("aud01-row-", "") ?? "",
  );

async function clickNode(element: Element | null | undefined, label: string): Promise<void> {
  expect(element, label).toBeTruthy();
  await act(async () => {
    (element as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

const click = (testId: string): Promise<void> => clickNode(node(testId), `${testId} exists`);

/** The row's own way into the record pane, under any filter set. */
async function openRecord(eventId: string): Promise<void> {
  await click(`aud01-cell-${eventId}-type`);
  await waitFor(() => node("aud02-detail") !== null, "the record pane painted");
}

const clip: { calls: string[] } = { calls: [] };

function stubClipboard(): void {
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text: string) => void clip.calls.push(text) },
  });
}

async function copiedLine(): Promise<string> {
  const before = clip.calls.length;
  await click("aud-detail-copy");
  await waitFor(() => clip.calls.length > before, "the line was copied");
  return clip.calls[clip.calls.length - 1] ?? "";
}

const downloads: { store: Map<string, Blob>; last: { name: string; csv: string } } = {
  store: new Map(),
  last: { name: "", csv: "" },
};

function captureDownloads(): void {
  downloads.store = new Map();
  downloads.last = { name: "", csv: "" };
  let seq = 0;
  URL.createObjectURL = ((blob: Blob) => {
    seq += 1;
    const url = `blob:crossfilter-${seq}`;
    downloads.store.set(url, blob);
    return url;
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    if (!this.download) return;
    downloads.last.name = this.download;
    const blob = downloads.store.get(this.href);
    if (blob) void blob.text().then((text) => (downloads.last.csv = text));
  });
}

/** One CSV record, quoted fields and doubled inner quotes honoured. */
function parseRecord(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else current += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  return cells;
}

function dataLines(csv: string): string[] {
  return csv
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .filter((line) => line !== "");
}

async function exportFile(): Promise<{ name: string; head: string; lines: string[][] }> {
  const before = urls();
  await click("aud01-export");
  await waitFor(() => downloads.last.csv !== "", "the file was handed over");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  const all = dataLines(downloads.last.csv);
  expect(urls()).toEqual(before);
  return { name: downloads.last.name, head: all[0] ?? "", lines: all.slice(1).map(parseRecord) };
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  clip.calls = [];
  stubClipboard();
  captureDownloads();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R201 - the same event under a live filter set", () => {
  it("matches the copied line byte for byte in all four answers", async () => {
    answer([rowOf(FIRST, 1, "2026-11-19T01:20:00Z"), rowOf(SECOND, 2, "2026-11-19T01:21:00Z")]);
    await render(`/audit?window=7d&${FILTERS}&event=${FIRST}`);
    await waitFor(() => node("aud9-deeplink-found") !== null, "the deep link located the row");
    // The question the page is asking really is the filtered one.
    expect(paramOf(urls().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "", "actorId")).toBe(ACTOR);
    expect(paramOf(urls().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "", "action")).toBe(ACTION);
    expect(paintedRows()).toEqual([FIRST, SECOND]);

    await openRecord(FIRST);
    const when = markValue("audJ-time-detail");
    const who = markValue("audJ-actor-detail");
    expect(when).toBe("2026-11-19 09:20:00");
    expect(who).toBe(WHO);
    // the row's own probe agrees with the pane's — one reading under one filter
    expect(markValue(`audJ-time-list-${FIRST}`)).toBe(when);
    expect(markValue(`audJ-actor-list-${FIRST}`)).toBe(who);
    const object = fieldValue("audA-detail-resource");
    expect(object).toBe(OBJECT);
    expect(textOf("audA-detail-type")).toContain(ACTION_WORDS);

    const line = await copiedLine();
    expect(line).toContain(when ?? "");
    expect(line).toContain(who ?? "");
    expect(line).toContain(ACTION_WORDS);
    expect(line).toContain(object ?? "");
    expect(textOf("aud-detail-copy-status")).toBe("已复制");
    // and no machine handle travelled into the copy
    expect(line).not.toContain(ACTOR);
    expect(line).not.toContain(RESOURCE);
  });

  it("still agrees after the quick window becomes a stated interval", async () => {
    answer([rowOf(FIRST, 1, "2026-11-19T01:20:00Z"), rowOf(SECOND, 2, "2026-11-19T01:21:00Z")]);
    await render(`/audit?window=7d&${FILTERS}`);
    await openRecord(FIRST);
    const faces = [
      markValue("audJ-time-detail"),
      markValue("audJ-actor-detail"),
      fieldValue("audA-detail-resource"),
      textOf("audA-detail-type"),
    ];
    expect(faces).toEqual(["2026-11-19 09:20:00", WHO, OBJECT, ACTION_WORDS]);

    // Mutate the window: 最近 7 天 → a stated pair of instants.
    await click("aud01-filter-window-custom");
    const set = async (testId: string, value: string) => {
      const input = node(testId) as HTMLInputElement | null;
      expect(input, `${testId} exists`).toBeTruthy();
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        )?.set;
        setter?.call(input, value);
        input?.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };
    await set("aud01-custom-from", "2026-11-04T10:00");
    await set("aud01-custom-to", "2026-11-18T10:00");
    await click("audB-apply");
    const read = urls().filter((url) => /^\/agent-api\/api\/audit\?/.test(url)).at(-1) ?? "";
    await waitFor(() => (paramOf(read, "from") ?? "").startsWith("2026-11-04T"), "the interval was asked");

    // The filters that were already there survive the window change verbatim.
    expect(paramOf(read, "actorId")).toBe(ACTOR);
    expect(paramOf(read, "action")).toBe(ACTION);
    expect(paramOf(read, "from")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Date.parse(String(paramOf(read, "to")))).toBeGreaterThan(
      Date.parse(String(paramOf(read, "from"))),
    );
    // and the same event still says the same four things, copied included
    expect([
      markValue("audJ-time-detail"),
      markValue("audJ-actor-detail"),
      fieldValue("audA-detail-resource"),
      textOf("audA-detail-type"),
    ]).toEqual(faces);
    const line = await copiedLine();
    for (const face of faces) expect(line).toContain(face ?? "");

    // The absence ladder, as shipped: the copy carries the model's own words and
    // the file carries the SAME words in its label columns; only 时间/请求编号 go
    // empty. (The ticket describes 「—」/「空字段」; 未指派 and 「—」 are what the
    // operator and object columns really hold — pinned here so nobody unifies
    // them by accident.)
    answer([BLANK_ROW]);
    await render(`/audit?window=custom&from=${FROM}&to=${TO}&type=${ACTION}`);
    await openRecord("evt_dc_blank_0000001");
    const blank = await copiedLine();
    expect(blank).toContain("未指派");
    expect(blank).toContain(" · —");
    expect(blank).not.toContain("undefined");
    const file = await exportFile();
    const columns = file.lines[0] ?? [];
    expect(columns[CSV_HEADER.indexOf("操作者")]).toBe("未指派");
    expect(columns[CSV_HEADER.indexOf("对象")]).toBe("—");
    expect(columns[CSV_HEADER.indexOf("类型")]).toBe(ACTION_WORDS);
  });

  it("opening and closing the record re-asks nothing and moves nothing", async () => {
    answer([rowOf(FIRST, 1, "2026-11-19T01:20:00Z"), rowOf(SECOND, 2, "2026-11-19T01:21:00Z")]);
    await render(`/audit?window=7d&${FILTERS}`);
    const callsBefore = urls();
    const rowsBefore = paintedRows();
    const pairsBefore = pairs();
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(0);

    await openRecord(FIRST);
    expect(detailReads()).toBe(1);
    expect(listReads()).toBe(1);
    expect(pairs()).toEqual([...pairsBefore, `detail=${FIRST}`].sort());

    await clickNode(node("aud8-back-to-list"), "the way back exists");
    await waitFor(() => node("aud02-detail") === null, "the record closed");

    expect(detailReads()).toBe(1);
    expect(listReads()).toBe(1);
    // closing costed nothing, and the list is exactly where it was
    expect(urls().length).toBe(callsBefore.length + 1);
    expect(paintedRows()).toEqual(rowsBefore);
    expect(pairs()).toEqual(pairsBefore);
  });

  it("an event that cannot be read keeps the filters and does not empty the list", async () => {
    answer([rowOf(FIRST, 1, "2026-11-19T01:20:00Z"), rowOf(SECOND, 2, "2026-11-19T01:21:00Z")]);
    // The deep link asks the record route once, for itself: an existence check,
    // not a second consumer of the same id.
    await render(`/audit?window=7d&${FILTERS}&event=${GONE}`);
    await waitFor(() => node("aud9-event-missing") !== null, "the honest absence was said");

    const said = textOf("aud9-event-missing") ?? "";
    expect(said).toContain("该事件不存在或已过期");
    expect(said).toContain("rid-dc-absent");
    await clickNode(node("aud9-event-rid")?.querySelector("button"), "the rid can be copied");
    await waitFor(() => clip.calls.length > 0, "the rid was copied");
    expect(clip.calls[0]).toContain("rid-dc-absent");

    // every filter pair is still in the address, and the list did not collapse
    const kept = pairs();
    expect(kept).toContain(`actor=${ACTOR}`);
    expect(kept).toContain(`type=${ACTION}`);
    expect(kept).toContain(`resource=${RESOURCE}`);
    expect(kept).toContain("limit=25");
    expect(kept).toContain(`event=${GONE}`);
    expect(paintedRows()).toEqual([FIRST, SECOND]);
    expect(node("aud01-empty")).toBeNull();
    // and the copy control on that pane is the honest no-selection one: there,
    // but disabled with its reason — it never invents a line for a record that
    // cannot be read, and nothing more was handed to the clipboard.
    const copy = node("aud-detail-copy") as HTMLButtonElement | null;
    expect(copy, "the pane offers its copy control").not.toBeNull();
    expect(copy?.disabled, "disabled without a readable record").toBe(true);
    expect(copy?.getAttribute("title")).toBe(DETAIL_COPY_DISABLED_TITLE);
    expect(clip.calls.every((text) => text.includes("rid-dc-absent"))).toBe(true);
    expect(document.body.textContent).not.toContain("undefined");
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(1);
  });
});
