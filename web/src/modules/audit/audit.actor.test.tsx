// @vitest-environment jsdom
// R177 — the operator filter, followed through every place it appears.
//
// `?actor=` is the one filter that leaves this page as a machine handle and comes
// back as a person: the address says `actor`, the wire says `actorId`, and the
// surface says 「姓名 · 8位短码」. R113/R121/R133/R137/R141/R143/R153/R161/R170
// already pin the address discipline, the copied line, the export triangle and
// the picker's shape; what had never been pinned in one place is the operator
// itself — that the handle you put in the address is the handle that goes out,
// that the rows on screen are that operator's, that the four surfaces print the
// SAME masked words (row / record / copied line / exported file), and that an
// operator nobody knows is answered with a readable emptiness instead of a
// rewritten address. The 操作者 picker is a ConsoleSelect, so the handle is read
// through `@/shell/selectHarness`, never `select.value`.

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { CSV_HEADER } from "@/modules/audit/csv";
import { pickByValue, selectText, selectValue } from "@/shell/selectHarness";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTOR = "user:2f3a4b5c6d7e8f90";
const WHO = "李思 · 6d7e8f90";
const OTHER = "employee:9f8e7d6c5b4a3f21";
const NOBODY = "user:nobody-at-all";
const LI = "evt_actor_li_0000001";
const WU = "evt_actor_wu_0000001";
const RESOURCE = "ap_1122334455667788";

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

/** Where the page left the address, so 「not rewritten」 is a claim about bytes. */
function LocationProbe(): ReactNode {
  const location = useLocation();
  return <span data-testid="probe-location">{`${location.pathname}${location.search}`}</span>;
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
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <AuditEventsModulePage />
        <LocationProbe />
      </MemoryRouter>,
    );
  });
  await waitFor(() => document.querySelector(".animate-pulse") === null, "skeleton gone");
}

/** The address as sorted decoded pairs, repeated keys and all. */
function pairs(): string[] {
  const text = document.querySelector("[data-testid='probe-location']")?.textContent ?? "";
  const query = text.includes("?") ? text.slice(text.indexOf("?") + 1) : "";
  return [...new URLSearchParams(query)].map(([key, value]) => `${key}=${value}`).sort();
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number => urls().filter((url) => /^\/agent-api\/api\/audit\?/.test(url)).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";
const paramOf = (url: string, key: string): string | null =>
  new URL(url, "http://console.test").searchParams.get(key);
const cursorsOf = (url: string): string[] =>
  new URL(url, "http://console.test").searchParams.getAll("cursor");
const textOf = (testId: string): string | null =>
  document.querySelector(`[data-testid='${testId}']`)?.textContent ?? null;
const markValue = (mark: string): string | null =>
  document.querySelector(`[data-testid='${mark}']`)?.getAttribute("data-audj-value") ?? null;
const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((node) =>
    (node.getAttribute("data-testid") ?? "").replace("aud01-row-", ""),
  );

async function click(testId: string): Promise<void> {
  const node = document.querySelector(`[data-testid='${testId}']`);
  await act(async () => {
    (node as HTMLElement | null)?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: { type: string; id: string; displayName?: string };
  resource: { type: string; id: string };
  requestId: string;
}

function rowOf(eventId: string, actor: Row["actor"], requestId: string): Row {
  return {
    eventId,
    action: "task.created",
    occurredAt: "2026-11-19T01:20:00Z",
    outcome: "succeeded",
    actor,
    resource: { type: "approval", id: RESOURCE },
    requestId,
  };
}

const LI_ROW = rowOf(LI, { type: "human", id: ACTOR, displayName: "李思" }, "req-actor-li-0001");
const WU_ROW = rowOf(WU, { type: "employee", id: OTHER }, "req-actor-wu-0001");

/**
 * One ledger, three honest answers: the handle asked for decides which rows come
 * back, so 「屏上只该 actor 的行」 is a claim about the page AND the wire at once.
 */
function answerByActor(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    // The record pane reads its own route; without this leg the drawer has
    // nothing to show and the detail faces simply are not painted.
    if (target.startsWith("/agent-api/api/audit-detail")) {
      return { audit: paramOf(target, "id") === WU ? WU_ROW : LI_ROW };
    }
    const asked = paramOf(target, "actorId");
    if (asked === NOBODY) return { items: [], nextCursor: null };
    const items = asked === ACTOR ? [LI_ROW] : asked === OTHER ? [WU_ROW] : [WU_ROW, LI_ROW];
    return { items, nextCursor: cursorsOf(target).length ? null : "cur_page2" };
  });
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  answerByActor();
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

/** The clipboard is the only way to read the copied line; it never sends a request. */
const clip: { calls: string[] } = { calls: [] };
function stubClipboard(): void {
  clip.calls = [];
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text: string) => void clip.calls.push(text) },
  });
}

const blobs = new Map<string, Blob>();
let captured: { name: string; csv: string } = { name: "", csv: "" };

/** The exported file is read back the way the browser hands it over. */
function captureDownloads(): void {
  blobs.clear();
  captured = { name: "", csv: "" };
  URL.createObjectURL = (blob: Blob) => {
    const url = `blob:actor-${blobs.size}`;
    blobs.set(url, blob);
    return url;
  };
  URL.revokeObjectURL = () => undefined;
  const original = HTMLAnchorElement.prototype.click;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    if (!this.download) return original.call(this);
    captured.name = this.download;
    const blob = blobs.get(this.href);
    if (blob) void blob.text().then((text) => (captured.csv = text));
  });
}

function dataLines(csv: string): string[] {
  return csv
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .filter((line) => line !== "")
    .slice(1);
}

async function exportFile(): Promise<{ name: string; lines: string[] }> {
  await click("aud01-export");
  await waitFor(() => captured.csv !== "", "the file was handed over");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  return { name: captured.name, lines: dataLines(captured.csv) };
}

describe("R177 - the operator in the address is the operator on the wire", () => {
  it("backfills the control, sends the handle verbatim, and shows only their rows", async () => {
    await render(`/audit?actor=${encodeURIComponent(ACTOR)}`);
    // The picker carries the handle, the person is what it shows.
    expect(selectValue("aud01-filter-operator")).toBe(ACTOR);
    expect(selectText("aud01-filter-operator")).toContain("李思");
    // The address key is `actor`; the wire key is `actorId`. One reading, both spellings.
    expect(paramOf(lastListRead(), "actorId")).toBe(ACTOR);
    expect(paintedRows()).toEqual([LI]);
    // A handle the surface cannot name stays off the surface.
    expect(document.body.textContent ?? "").not.toContain(ACTOR);
  });

  it("stacks with the window and the stated interval without swallowing either", async () => {
    await render(
      `/audit?window=custom&from=2026-11-05T02:00:00Z&to=2026-11-07T02:00:00Z&actor=${encodeURIComponent(ACTOR)}&type=task.created`,
    );
    const first = lastListRead();
    expect(paramOf(first, "actorId")).toBe(ACTOR);
    expect(paramOf(first, "action")).toBe("task.created");
    expect(paramOf(first, "from")).toBe("2026-11-05T02:00:00.000Z");
    expect(paramOf(first, "to")).toBe("2026-11-07T02:00:00.000Z");
    // Widening the window is one new question, and the operator rides along.
    const before = listReads();
    await click("aud01-filter-window-30d");
    await waitFor(() => listReads() > before, "the wider window was asked");
    expect(listReads()).toBe(before + 1);
    const wider = lastListRead();
    expect(paramOf(wider, "actorId")).toBe(ACTOR);
    expect(paramOf(wider, "action")).toBe("task.created");
    const from = Date.parse(paramOf(wider, "from") ?? "");
    const to = Date.parse(paramOf(wider, "to") ?? "");
    expect(to - from).toBe(30 * 24 * 60 * 60 * 1000);
    expect(selectValue("aud01-filter-operator")).toBe(ACTOR);
  });

  it("changing the operator is a new question: page one, no stale cursor", async () => {
    // Two cursors deep, with both operators already on screen so both are offered.
    await render("/audit?cursor=cur_page1&cursor=cur_page2");
    expect(paintedRows()).toEqual([WU, LI]);
    expect(textOf("aud2-page")).toContain("第 3 页");
    expect(cursorsOf(lastListRead())).toEqual(["cur_page2"]);

    const before = listReads();
    // ConsoleSelect: the sanctioned way to choose is the harness's — open the
    // combobox and take the option by the machine value it carries.
    await pickByValue("aud01-filter-operator", OTHER);
    await waitFor(() => listReads() > before, "the new operator was asked");

    expect(listReads()).toBe(before + 1);
    const asked = lastListRead();
    expect(paramOf(asked, "actorId")).toBe(OTHER);
    expect(cursorsOf(asked)).toEqual([]);
    expect(textOf("aud2-page")).toContain("第 1 页");
    expect(selectValue("aud01-filter-operator")).toBe(OTHER);
  });
});

describe("R177 - the operator, said the same way in four places", () => {
  it("row, record, copied line and exported file print one masked name", async () => {
    stubClipboard();
    captureDownloads();
    await render(
      `/audit?actor=${encodeURIComponent(ACTOR)}&preview=${LI}&detail=${LI}`,
    );
    expect(markValue(`audJ-actor-list-${LI}`)).toBe(WHO);
    expect(markValue("audJ-actor-detail")).toBe(WHO);
    expect(textOf(`aud01-cell-${LI}-actor`)).toContain(WHO);

    await click("aud-detail-copy");
    await waitFor(() => clip.calls.length === 1, "the line was copied");
    expect(clip.calls[0]).toContain(WHO);

    const file = await exportFile();
    expect(file.lines).toHaveLength(1);
    const columns = file.lines[0].split(",");
    expect(columns[CSV_HEADER.indexOf("操作者")]).toBe(WHO);

    for (const text of [document.body.textContent ?? "", clip.calls[0], file.lines[0]]) {
      expect(text).not.toContain(ACTOR);
      expect(text).not.toContain(RESOURCE);
    }
    expect(textOf("aud-detail-copy-status")).toBe("已复制");
  });

  it("an unattributed operator is 「未指派」 in all four places, not a blank or a dash", async () => {
    stubClipboard();
    captureDownloads();
    api.fetchJSON.mockReset();
    const UNATTRIBUTED = {
      eventId: LI,
      action: "task.created",
      occurredAt: "2026-11-19T01:20:00Z",
      outcome: "succeeded",
      resource: { type: "approval", id: RESOURCE },
      requestId: "req-actor-none-001",
    };
    api.fetchJSON.mockImplementation(async (url) =>
      String(url).startsWith("/agent-api/api/audit-detail")
        ? { audit: UNATTRIBUTED }
        : { items: [UNATTRIBUTED], nextCursor: null },
    );
    await render(`/audit?preview=${LI}&detail=${LI}`);
    expect(markValue(`audJ-actor-list-${LI}`)).toBe("未指派");
    expect(markValue("audJ-actor-detail")).toBe("未指派");

    await click("aud-detail-copy");
    await waitFor(() => clip.calls.length === 1, "the line was copied");
    // The actor's own absence word is 「未指派」 where it sits — segment two.
    // The 「—」 at the end is the ABSENT CORRELATION segment, which is this line's
    // own family's word (pinned by R121/R153), not a second spelling of the
    // operator's absence. Three families, three jobs: 「未指派」 who, 「—」 what
    // resource/correlation, 「该字段未返回」 time and request id.
    expect(clip.calls[0]).toContain(" · 未指派 · ");

    const file = await exportFile();
    expect(file.lines[0].split(",")[CSV_HEADER.indexOf("操作者")]).toBe("未指派");
    // and the reason travels where a person can ask for it
    expect(
      document.querySelector(`[data-testid='aud01-cell-${LI}-actor']`)?.getAttribute("title") ??
        document.querySelector(`[data-testid='audJ-actor-list-${LI}']`)?.getAttribute("data-audj-title"),
    ).toContain("服务没有带回这条记录的操作者");
  });
});

describe("R177 - an operator nobody knows", () => {
  it("answers with a readable empty state, keeps the address, and loses no anchor", async () => {
    await render(`/audit?actor=${encodeURIComponent(NOBODY)}`);
    // The handle asked for is the handle sent — no silent widening to a full scan.
    expect(listReads()).toBe(1);
    expect(paramOf(lastListRead(), "actorId")).toBe(NOBODY);
    // The address is exactly what was pasted: a filter that matched nothing is not
    // a reason to rewrite the person's link.
    expect(pairs()).toEqual([`actor=${NOBODY}`]);
    expect(document.querySelector("[data-testid='aud01-empty']")).not.toBeNull();
    const empty = textOf("aud01-empty") ?? "";
    expect(empty.length).toBeGreaterThan(0);
    // the picker still holds what the address said, named as an address-borne handle
    expect(selectValue("aud01-filter-operator")).toBe(NOBODY);
    // and the page-level anchors are all still standing
    for (const anchor of ["agent-v2-page-audit", "aud01-filters", "aud5-export-bar"]) {
      expect(document.querySelector(`[data-testid='${anchor}']`), `${anchor} still rendered`).not.toBeNull();
    }
    // the raw handle never reaches the surface
    expect(document.body.textContent ?? "").not.toContain(NOBODY);
  });
});
