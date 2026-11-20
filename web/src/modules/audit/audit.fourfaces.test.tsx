// @vitest-environment jsdom
// R143 — one event read by four faces, and the deep link that reaches it.
//
// What is NEW here, and therefore not re-pinned elsewhere: `audit.parity.test.tsx`
// (R137) compares the row, the record pane and the copied line; `audV`
// (`audit.crosssurface.test.tsx`) compares time / request id / state wording and
// request counts; `detailCopy.test.tsx` (R121) owns the copied line's wording,
// its refusal and its disabled state; `audit.filters.test.tsx` (R133) owns the
// filter address; `audit.deeplink.test.tsx` (R113) owns adding and removing
// `?event=`. This file adds the INLINE PREVIEW as a fourth face for all four
// values, the request-id compared across the three faces against the answer the
// service sent, and one walk: `?event=` locating a row, opening its record, and
// walking back — over an address that also carries a cursor.
//
// Two absence families, deliberately not merged: a missing TIME and a missing
// REQUEST ID read 「该字段未返回」 (`AUDJ_TIME_MISSING` === `NO_REQUEST_ID`), because
// those are fields the reader expects verbatim; a missing RESOURCE reads 「—」,
// because that cell shows a human name the model builds. And a resource TYPE
// without a number is NOT an absence: 「审批单」 is a real answer.
//
// Honest gap: the ticket asked that 「详情「关联」列表每条 rid 逐字等于该行自身字段与
// BFF 返回」. The shipped 关联 block (`views.tsx` links section) prints one line per
// linked resource — noun, masked short code, raw value only in the `title` — and
// carries NO per-line request id. There is no such face to make promise the same
// words, so this file pins what does ship: each linked line shows the model's own
// short code of the value the answer carried, the raw handle never appears on the
// surface, and the record's only request-id faces are the row, the preview and the
// pane. A product change that adds per-line ids must update this claim.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { auditCopyText, copyFieldValue } from "@/modules/audit/detailCopy";
import { NO_REQUEST_ID } from "@/modules/audit/states";
import { AUDJ_TIME_MISSING } from "@/modules/audit/timeActor";
import { auditDetailFrom, shortCode } from "@/modules/audit/model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
const clip: { calls: string[] } = { calls: [] };

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="probe-location">{`${location.pathname}${location.search}`}</span>;
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

beforeEach(() => {
  api.fetchJSON.mockReset();
  clip.calls = [];
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text: string) => void clip.calls.push(text) },
  });
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number => urls().filter((url) => /^\/agent-api\/api\/audit\?/.test(url)).length;
const detailReads = (): number => urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length;

/** The value of a `Field`: its `dd`. The container also carries the label. */
const fieldValue = (testId: string): string | null =>
  document.querySelector(`[data-testid='${testId}'] dd`)?.textContent?.trim() ?? null;
/** The value a `CopyValue` prints — the inner span, not the 复制 button next to it. */
const valueOf = (testId: string): string | null =>
  document.querySelector(`[data-testid='${testId}'] > span`)?.textContent?.trim() ?? null;
const markValue = (mark: string): string | null =>
  document.querySelector(`[data-testid='${mark}']`)?.getAttribute("data-audj-value") ?? null;
const markTitle = (mark: string): string | null =>
  document.querySelector(`[data-testid='${mark}']`)?.getAttribute("data-audj-title") ?? null;
const textOf = (testId: string): string | null =>
  document.querySelector(`[data-testid='${testId}']`)?.textContent?.trim() ?? null;

/** The address as the page left it, decoded, one string per `key=value` pair. */
function pairs(): string[] {
  const probe = document.querySelector("[data-testid='probe-location']")?.textContent ?? "";
  const query = probe.slice(probe.indexOf("?") + 1);
  return [...new URLSearchParams(query)].map(([key, value]) => `${key}=${value}`).sort();
}

const ID = "evt_present_00000001";
const ACTOR = "user:2f3a4b5c6d7e8f90";
const RESOURCE = "ap_1122334455667788";
const RID = "req-20261119-0a7b3c";
const CORRELATION = "cor-00112233445566";
const TIME = "2026-11-19 09:20:00";
const WHO = "李思 · 6d7e8f90";
const ACTION = "创建任务";
const OBJECT = "审批单 · 55667788";
const CODE = "33445566";
const LINE = `${TIME} 北京时间（UTC+8） · ${WHO} · ${ACTION} · ${OBJECT} · ${CODE}`;
const FROM = "2026-11-05T02:00:00Z";
const TO = "2026-11-07T02:00:00Z";

/** One event, answered by BOTH legs, so the four faces read one payload. */
function answer(body: Record<string, unknown> = RECORD): void {
  api.fetchJSON.mockImplementation(async (url) =>
    String(url).startsWith("/agent-api/api/audit-detail")
      ? { audit: body }
      : { items: [body], nextCursor: null },
  );
}

const RECORD: Record<string, unknown> = {
  eventId: ID,
  action: "task.created",
  occurredAt: "2026-11-19T01:20:00Z",
  recordedAt: "2026-11-19T01:20:01Z",
  outcome: "succeeded",
  actor: { type: "human", id: ACTOR, displayName: "李思" },
  resource: { type: "approval", id: RESOURCE },
  requestId: RID,
  correlationId: CORRELATION,
};

/** All four faces of one event at once: the row, its preview, the pane, the copy. */
async function mountFour(body?: Record<string, unknown>): Promise<void> {
  answer(body ?? RECORD);
  await render(`/audit?window=7d&preview=${ID}&detail=${ID}`);
  await waitFor(() => document.querySelector(`[data-testid='aud6-preview-${ID}']`) !== null, "preview painted");
  await waitFor(() => document.querySelector("[data-testid='aud02-detail']") !== null, "detail painted");
}

async function copyLine(): Promise<string> {
  const button = document.querySelector<HTMLButtonElement>("[data-testid='aud-detail-copy']");
  await act(async () => {
    button?.click();
  });
  await waitFor(() => clip.calls.length === 1, "the copy landed");
  return clip.calls[0];
}

describe("R143 - one event, four faces", () => {
  it("reads the same instant in the row, the preview and the pane — from one title", async () => {
    await mountFour();
    const marks = [`audJ-time-list-${ID}`, "audJ-time-preview", "audJ-time-detail"];
    expect(marks.map(markValue)).toEqual([TIME, TIME, TIME]);
    // one string, not three similar ones: the raw instant quoted identically
    expect(new Set(marks.map(markTitle)).size).toBe(1);
    expect(markTitle(marks[0])).toContain("2026-11-19T01:20:00Z");
  });

  it("names the same operator, action and object on all four faces", async () => {
    await mountFour();
    const actorMarks = [`audJ-actor-list-${ID}`, "audJ-actor-preview", "audJ-actor-detail"];
    expect(actorMarks.map(markValue)).toEqual([WHO, WHO, WHO]);
    expect(fieldValue(`aud01-cell-${ID}-actor`)).toBe(WHO);
    expect(fieldValue("audA-detail-actor")).toBe(WHO);

    expect(textOf(`aud01-cell-${ID}-type`)).toContain(ACTION);
    expect(textOf("audA-preview-type")).toContain(ACTION);
    expect(textOf("audA-detail-type")).toContain(ACTION);

    expect(fieldValue(`aud01-cell-${ID}-object`)).toBe(OBJECT);
    expect(fieldValue("audA-detail-resource")).toBe(OBJECT);
    expect(textOf("audA-preview-resource")).toContain(OBJECT);
  });

  it("copies those same four answers, in the same spelling, into one line", async () => {
    await mountFour();
    const line = await copyLine();
    expect(line).toBe(LINE);
    expect(textOf("aud-detail-copy-status")).toBe("已复制");
    for (const value of [TIME, WHO, ACTION, OBJECT, CODE]) expect(line).toContain(value);
  });

  it("keeps every machine handle off all four faces", async () => {
    await mountFour();
    const surface = document.body.textContent ?? "";
    expect(surface).not.toContain(ACTOR);
    expect(surface).not.toContain(RESOURCE);
    expect(surface).not.toContain(CORRELATION);
    const line = await copyLine();
    expect(line).not.toContain(ACTOR);
    expect(line).not.toContain(RESOURCE);
    expect(line).not.toContain(CORRELATION);
    expect(line).toContain("6d7e8f90");
    expect(line).toContain("55667788");
    expect(line).toContain(CODE);
  });
});

describe("R143 - the request id, three faces, one answer", () => {
  it("prints the id the service sent, identically everywhere it appears", async () => {
    await mountFour();
    expect(valueOf(`aud01-cell-${ID}-request-value`)).toBe(RID);
    expect(valueOf("audA-preview-rid")).toBe(RID);
    expect(valueOf("aud02-detail-request-value")).toBe(RID);
  });

  it("says 该字段未返回 when it is missing — never a dash, never a guess", async () => {
    await mountFour({ ...RECORD, requestId: undefined });
    expect(textOf(`aud01-cell-${ID}-request-value-absent`)).toBe(NO_REQUEST_ID);
    expect(textOf("audA-preview-rid-absent")).toBe(NO_REQUEST_ID);
    expect(textOf("aud02-detail-request-value-absent")).toBe(NO_REQUEST_ID);
    // one word for one kind of absent verbatim field, shared with the missing time
    expect(NO_REQUEST_ID).toBe(AUDJ_TIME_MISSING);
    expect(NO_REQUEST_ID).toBe("该字段未返回");
  });
});

describe("R143 - absence, said in the family's own voice", () => {
  it("a record with no time reads the missing word on all three faces", async () => {
    await mountFour({ ...RECORD, occurredAt: undefined, recordedAt: undefined });
    const marks = [`audJ-time-list-${ID}`, "audJ-time-preview", "audJ-time-detail"];
    expect(marks.map(markValue)).toEqual([AUDJ_TIME_MISSING, AUDJ_TIME_MISSING, AUDJ_TIME_MISSING]);
    for (const title of marks.map(markTitle)) expect(title).toContain("不拿浏览器时间顶替");
    const line = await copyLine();
    expect(line.startsWith(`${AUDJ_TIME_MISSING} · `)).toBe(true);
    expect(/\d{4}-\d{2}-\d{2}/.test(line)).toBe(false);
  });

  it("a type without a number is an answer, not an absence", async () => {
    await mountFour({ ...RECORD, resource: { type: "approval" } });
    expect(fieldValue(`aud01-cell-${ID}-object`)).toBe("审批单");
    expect(fieldValue("audA-detail-resource")).toBe("审批单");
    expect(textOf("audA-preview-resource")).toContain("审批单");
    const line = await copyLine();
    expect(line).toContain(" · 审批单 · ");
    expect(line).not.toContain("—");
  });

  it("an object the answer never named, and no correlation, read the dash", async () => {
    await mountFour({ ...RECORD, resource: undefined, correlationId: undefined });
    expect(fieldValue(`aud01-cell-${ID}-object`)).toBe("—");
    expect(fieldValue("audA-detail-resource")).toBe("—");
    const line = await copyLine();
    expect(line.endsWith(" · — · —")).toBe(true);
    // and a real zero stays a zero — the dash is for absence, not for nothing
    expect(copyFieldValue(0)).toBe("0");
    expect(copyFieldValue(null)).toBe("—");
  });
});

describe("R143 - the linked lines, and what they carry", () => {
  it("shows the model's own short code of each linked id, raw value only in the title", async () => {
    await mountFour();
    // The correlation is a linked line like any other: its face is the noun plus
    // the short code, its raw handle lives in the line's `title`, and it never
    // reaches the surface text.
    const codes = Array.from(document.querySelectorAll("[data-testid='aud02-detail'] dd")).filter((node) =>
      (node.textContent ?? "").includes(CODE),
    );
    expect(codes.length).toBeGreaterThanOrEqual(1);
    for (const code of codes) {
      expect(code.getAttribute("title") ?? "").toContain(CORRELATION);
    }
    expect(document.body.textContent ?? "").not.toContain(CORRELATION);
    // the honest gap, pinned so a product change cannot silently contradict it
    expect(document.querySelector("[data-testid*='related']")).toBeNull();
  });

  it("masks the same handle the answer sent, in the pane and in the copy", () => {
    const detail = auditDetailFrom({ audit: { ...RECORD, ...{ correlationId: CORRELATION } } });
    expect(detail?.correlation).toBe(CORRELATION);
    expect(shortCode(String(detail?.correlation))).toBe(CODE);
    expect(auditCopyText(detail!)).toBe(LINE);
  });
});

describe("R143 - a deep link, a record, and the way back", () => {
  it("opens only the record key and closes only it, with a cursor under the address", async () => {
    answer();
    const address = `/audit?window=custom&from=${FROM}&to=${TO}&limit=25&cursor=cur_page1&event=${ID}`;
    await render(address);
    const before = pairs();
    expect(before).toContain(`cursor=cur_page1`);
    expect(before).toContain(`event=${ID}`);
    expect(before.some((pair) => pair.startsWith("detail="))).toBe(false);
    expect(textOf("aud9-deeplink-found")).toContain("已按链接定位到这条事件并展开");
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(0);

    const open = document.querySelector<HTMLButtonElement>(`[data-testid='aud01-cell-${ID}-type']`);
    await act(async () => {
      open?.click();
    });
    await waitFor(() => document.querySelector("[data-testid='aud02-detail']") !== null, "detail painted");
    const opened = pairs();
    expect(opened).toEqual([...before, `detail=${ID}`].sort());
    expect(opened).toContain(`cursor=cur_page1`);
    expect(opened).toContain(`event=${ID}`);
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(1);
    const urlsAfterOpen = urls();

    const back = document.querySelector<HTMLButtonElement>("[data-testid='aud8-back-to-list']");
    await act(async () => {
      back?.click();
    });
    await waitFor(() => document.querySelector("[data-testid='aud02-detail']") === null, "record closed");
    expect(pairs()).toEqual(before);
    // walking back asks for nothing: the list was read once, the record once
    expect(urls()).toEqual(urlsAfterOpen);
    expect(listReads()).toBe(1);
    // 三档: the preview carries the same wrapping family as the chips it sits with
    expect(document.querySelector(`[data-testid='aud6-preview-${ID}']`)?.className).toContain("min-w-0");
  });
});
