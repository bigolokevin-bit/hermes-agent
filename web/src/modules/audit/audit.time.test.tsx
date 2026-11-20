// @vitest-environment jsdom
// R153 — one instant, four places: the list column, the record pane, the copied
// line and the exported file.
//
// What is already pinned elsewhere, and is NOT repeated here: the three faces'
// equality for one instant (`audit.crosssurface.test.tsx`, audV;
// `audit.fourfaces.test.tsx` guard ①), the detail pane's own seconds (`AuditDetailModulePage.test.tsx`
// 「shows the event time to the second and says so」), the row column's Beijing
// wording (`AuditEventsModulePage.test.tsx` 「says the time in Beijing words and
// labels it」), the model's minute formatter (`api.test.ts` 「speaks Beijing time
// to the minute from a UTC instant」), the file's own columns (`csv.test.ts`), and
// the file-vs-screen precision claim at page level
// (`audit.export.test.tsx` 「writes the instant in the screen's own reading, to the
// precision the file documents」). What is NEW is the four places in ONE guard, on
// ONE event, under BOTH a quick window and a stated interval, together with the
// cost of reading all four.
//
// Two口径 the ticket states differently from what ships, pinned as shipped and
// registered rather than quietly unified (this wave changes no product code):
//  1. the file writes the Beijing MINUTE (csv.ts: 「Times are Beijing wall clock to
//     the minute」, column 1 is `cell(row.occurredAt)`) while the three faces write
//     SECONDS. So the four places are ONE reading at two precisions: the file cell
//     is exactly the first 16 characters of the face value.
//  2. a missing time reads 「该字段未返回」 on the faces (the time / request-id
//     family, `AUDJ_TIME_MISSING` === `NO_REQUEST_ID`, pinned by audV/R143) and an
//     EMPTY cell in the file — csv.ts promises 「a value the service did not send
//     stays an empty cell — never 0, never a placeholder」. 「—」 is the RESOURCE
//     family's word, and the record pane has no time to say at all when the answer
//     carried none.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { CSV_HEADER } from "@/modules/audit/csv";
import { AUDJ_TIME_MISSING } from "@/modules/audit/timeActor";

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
      </MemoryRouter>,
    );
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), "skeleton gone");
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number => urls().filter((url) => /^\/agent-api\/api\/audit\?/.test(url)).length;
const detailReads = (): number => urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length;

const fieldValue = (testId: string): string | null =>
  document.querySelector(`[data-testid='${testId}'] dd`)?.textContent?.trim() ?? null;
const markValue = (mark: string): string | null =>
  document.querySelector(`[data-testid='${mark}']`)?.getAttribute("data-audj-value") ?? null;
const markTitle = (mark: string): string | null =>
  document.querySelector(`[data-testid='${mark}']`)?.getAttribute("data-audj-title") ?? null;

/** The file the page hands over, read back out of the blob it built. */
const captured: { name: string; csv: string } = { name: "", csv: "" };

function captureDownloads(): void {
  captured.name = "";
  captured.csv = "";
  const blobs: Record<string, Blob> = {};
  let seq = 0;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: (blob: Blob) => {
      seq += 1;
      const url = `blob:time-${seq}`;
      blobs[url] = blob;
      return url;
    },
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: () => undefined });
  const original = HTMLAnchorElement.prototype.click;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    if (this.download && this.href.startsWith("blob:time-")) {
      const blob = blobs[this.href];
      captured.name = this.download;
      void blob?.text().then((text) => {
        captured.csv = text;
      });
      return;
    }
    original.call(this);
  });
}

/** Data lines of the handed-over file, header dropped, BOM and CRLF unwrapped. */
function dataLines(csv: string): string[] {
  return csv
    .replace(/^/, "")
    .split("\r\n")
    .filter((line) => line.trim() !== "")
    .slice(1);
}

async function exportCell(): Promise<string> {
  const button = document.querySelector<HTMLButtonElement>("[data-testid='aud01-export']");
  await act(async () => {
    button?.click();
  });
  await waitFor(() => captured.csv !== "", "the file was handed over");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  return dataLines(captured.csv)[0].split(",")[0];
}

async function copyLine(): Promise<string> {
  const button = document.querySelector<HTMLButtonElement>("[data-testid='aud-detail-copy']");
  await act(async () => {
    button?.click();
  });
  await waitFor(() => clip.calls.length === 1, "the copy landed");
  return clip.calls[0];
}

const ID = "evt_present_00000001";
const TIME = "2026-11-19 09:20:00";
const MINUTE = "2026-11-19 09:20";
const RAW_UTC = "2026-11-19T01:20:00Z";
/** A stated interval that contains the event, so the pair is byte-replayable. */
const CFROM = "2026-11-19T00:00:00Z";
const CTO = "2026-11-20T00:00:00Z";

const RECORD: Record<string, unknown> = {
  eventId: ID,
  action: "task.created",
  occurredAt: RAW_UTC,
  recordedAt: "2026-11-19T01:20:01Z",
  outcome: "succeeded",
  actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" },
  resource: { type: "approval", id: "ap_1122334455667788" },
  requestId: "req-20261119-0a7b3c",
  correlationId: "cor-00112233445566",
};

function answer(body: Record<string, unknown> = RECORD): void {
  api.fetchJSON.mockImplementation(async (url) =>
    String(url).startsWith("/agent-api/api/audit-detail")
      ? { audit: body }
      : { items: [body], nextCursor: null },
  );
}

/** Every place one event's time is read, in one mount. */
async function mountFour(entry: string, body?: Record<string, unknown>): Promise<void> {
  answer(body ?? RECORD);
  await render(entry);
  await waitFor(() => document.querySelector(`[data-testid='aud6-preview-${ID}']`) !== null, "preview painted");
  await waitFor(() => document.querySelector("[data-testid='aud02-detail']") !== null, "detail painted");
}

const THREE_MARKS = [`audJ-time-list-${ID}`, "audJ-time-preview", "audJ-time-detail"];

beforeEach(() => {
  api.fetchJSON.mockReset();
  clip.calls = [];
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text: string) => void clip.calls.push(text) },
  });
  captureDownloads();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R153 - one instant, four places", () => {
  it("says the same second in the column, the preview and the pane", async () => {
    await mountFour(`/audit?window=7d&preview=${ID}&detail=${ID}`);
    expect(THREE_MARKS.map(markValue)).toEqual([TIME, TIME, TIME]);
    expect(fieldValue(`aud01-cell-${ID}-time`)).toBe(TIME);
    expect(fieldValue("audA-detail-time")).toBe(TIME);
    // and each of them quotes the same instant the service sent
    for (const title of THREE_MARKS.map(markTitle)) expect(title).toContain(RAW_UTC);
  });

  it("carries that same second, with the same zone wording, into the copied line", async () => {
    await mountFour(`/audit?window=7d&preview=${ID}&detail=${ID}`);
    const line = await copyLine();
    expect(line.startsWith(`${TIME} 北京时间（UTC+8） · `)).toBe(true);
    // the copy is not a second reading of the clock: it is the face's own string
    expect(line.startsWith(`${markValue("audJ-time-detail")} `)).toBe(true);
  });

  it("writes the same reading into the file, to the precision the file documents", async () => {
    await mountFour(`/audit?window=7d&preview=${ID}&detail=${ID}`);
    const cell = await exportCell();
    expect(cell).toBe(MINUTE);
    // One instant, two precisions: the file's cell is exactly the screen's own
    // characters, cut where the file says it cuts. 口径 registered above.
    expect(TIME.startsWith(cell)).toBe(true);
    expect(TIME.slice(0, cell.length)).toBe(cell);
    expect(captured.name).toMatch(/^audit-.+-\d{8}-\d{4}\.csv$/);
    expect(dataLines(captured.csv)[0].split(",")[0]).toBe(cell);
  });

  it("keeps all four places on one reading under a stated interval too", async () => {
    await mountFour(`/audit?window=custom&from=${CFROM}&to=${CTO}&preview=${ID}&detail=${ID}`);
    expect(THREE_MARKS.map(markValue)).toEqual([TIME, TIME, TIME]);
    const line = await copyLine();
    expect(line.startsWith(`${TIME} 北京时间（UTC+8） · `)).toBe(true);
    const cell = await exportCell();
    expect(TIME.startsWith(cell)).toBe(true);
    expect(cell).toBe(MINUTE);
    // a stated interval is asked for exactly as written, once
    expect(listReads()).toBe(1);
    expect(urls()[0]).toContain("from=2026-11-19T00%3A00%3A00.000Z");
  });
});

describe("R153 - no time, said in each place's own voice", () => {
  it("reads the missing word in the column, the preview, the pane and the copy", async () => {
    await mountFour(`/audit?window=7d&preview=${ID}&detail=${ID}`, {
      ...RECORD,
      occurredAt: undefined,
      recordedAt: undefined,
    });
    expect(THREE_MARKS.map(markValue)).toEqual([
      AUDJ_TIME_MISSING,
      AUDJ_TIME_MISSING,
      AUDJ_TIME_MISSING,
    ]);
    for (const title of THREE_MARKS.map(markTitle)) expect(title).toContain("不拿浏览器时间顶替");
    const line = await copyLine();
    expect(line.startsWith(`${AUDJ_TIME_MISSING} · `)).toBe(true);
    expect(/\d{4}-\d{2}-\d{2}/.test(line)).toBe(false);
  });

  it("leaves the file's time cell empty rather than writing a placeholder", async () => {
    await mountFour(`/audit?window=7d&preview=${ID}&detail=${ID}`, {
      ...RECORD,
      occurredAt: undefined,
      recordedAt: undefined,
    });
    const cell = await exportCell();
    // csv.ts: a value the service did not send stays an empty cell — never 0,
    // never a placeholder that could be mistaken for data. The ticket asked for
    // 「—」 in all four places; 「—」 is this module's RESOURCE word, and the file
    // promises an empty cell, so both are pinned as shipped.
    expect(cell).toBe("");
    expect(dataLines(captured.csv)[0].split(",")[1]).toBe("创建任务");
    const line = await copyLine();
    expect(line).toContain(AUDJ_TIME_MISSING);
    expect(line).not.toContain("—");
  });
});

describe("R153 - reading four places costs what reading one costs", () => {
  it("asks once for the list, once for the record, and nothing for the copy or the file", async () => {
    answer();
    await render(`/audit?window=7d`);
    const afterList = urls();
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(0);

    const open = document.querySelector<HTMLButtonElement>(`[data-testid='aud01-cell-${ID}-type']`);
    await act(async () => {
      open?.click();
    });
    await waitFor(() => document.querySelector("[data-testid='aud02-detail']") !== null, "detail painted");
    expect(detailReads()).toBe(1);
    const afterOpen = urls();

    // the row column and the pane are already on screen: the file reads them
    const cell = await exportCell();
    expect(cell).toBe(MINUTE);
    expect(urls()).toEqual(afterOpen);

    const back = document.querySelector<HTMLButtonElement>("[data-testid='aud8-back-to-list']");
    await act(async () => {
      back?.click();
    });
    await waitFor(() => document.querySelector("[data-testid='aud02-detail']") === null, "record closed");
    expect(urls()).toEqual(afterOpen);
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(1);
    // 三档, structurally: the time sits in the wrapping family, not in a fixed box
    expect(document.querySelector(`[data-testid='aud01-cell-${ID}-time']`)?.className).toContain("min-w-0");
    expect(CSV_HEADER[0]).toBe("时间");
    expect(afterList).toHaveLength(1);
  });
});
