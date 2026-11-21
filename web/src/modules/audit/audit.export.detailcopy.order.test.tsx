// @vitest-environment jsdom
// R272 — the file's columns and the copied sentence keep one honest pairing,
// and a station swap or an actor filter sweeps BOTH faces the same way.
//
// 查重结论 (owners read first, cited by 文件:行, never rewritten here):
// - audit.export.detailcopy.same.test.tsx (R259) describe:267 it:268 — whole
//   sentence toStrictEqual at the bare 7d station + per-cell equality + the
//   time prefix ladder. What R259 does NOT own: the 结果 column has no sentence
//   counterpart, and the sentence's correlation tail has no CSV column — the
//  「两套口径互缺」 is net-new here (it①).
// - audit.export.detailcopy.pairs.test.tsx (R263) it:277 (cell↔segment pairing
//   at the FILTERED station, ledger frozen) and it:310 (sparse 未指派↔includes,
//   replay toEqual). Neither pairs the 结果 column nor the correlation.
// - audit.export.missing.pairs.test.tsx (R264) it:298/it:331 — the 缺值双口径
//   ladder (also audit.export.columns.test.tsx:320, bytes :327-329, and
//   detailCopy.test.tsx:57-60 for the bare-type/corr-absent sentence shapes).
//   缺值 here is CITE-ONLY, not re-pinned. R264 is also this file's harness
//   base (clipboard defined exactly once per beforeEach, copiedLine, open/
//   closeRecord, watchBlobs/parseRecord/dataLines/exportRecords).
// - audit.filter.paging.export.test.tsx (R243): it①:312 owns the 30d swap's
//   COPY side (every new row's line is its own, narrow dates gone) and the
//   恰一问 ledger at :329; it②:349 owns rid-order==painted; it③:370 owns the
//   drawer's exactly-one-detail-ask with the list frozen. R243① has NO
//   CSV-file leg — the 换代 side of the FILE is net-new (it②).
// - audit.filter.counts.test.tsx (R214) it:271/it:290 — 四数一角, chip-drop
//   exactly-one-reask. audit.copy.paging2.test.tsx (R244①) it:279 — copies
//   are the new page's own.
// 现状登记:
// - 工单② wording 「列表不重取」 ≠ reality: a window-tier switch is exactly
//   ONE re-ask (R243①:329 ledger owner); 「不重取」 holds for the drawer, the
//   copy and the export clicks.
// - 导出 = 当前装载非全量 (R243② precedent, worst shape): the file mirrors the
//   painted page, never a background full scan.
// - 序号/行级复制钮不存在 as a concept: the row copy IS the drawer's single
//   aud-detail-copy (R264 header :13-14 family line).
// - pairing is by anchor identity, not column position: the CSV walks
//   时间·类型·结果·操作者·对象·请求编号 while the sentence walks 时间·操作者·
//   动作·资源·关联 — one table's columns in two honest orders by design
//   (csv.ts:12, detailCopy.ts:75).

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "./AuditEventsModulePage";
import { CSV_HEADER } from "./csv";
import { AUDJ_TIME_ZONE } from "./timeActor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTOR = "user:2f3a4b5c6d7e8f90";
const WHO = "李思 · 6d7e8f90";
const FOREIGN_ID = "user:77aa55cc33ee11ff";
const FOREIGN_WHO = "周航 · 33ee11ff";
const OBJECT = "审批单 · 55667788";
const ACTION_WORDS = "创建任务";
const RESULT_WORD = "成功";
const ZONE = AUDJ_TIME_ZONE;
const TIME_HEAD = "2026-11-19 09:20:00";
const TIME_FILE = "2026-11-19 09:20";
const CORR = "cor-6677889900112233";
const CORR_SHORT = "00112233";

const FULL_ID = "evt_r272_full_00000001";
const PAIR_ID = "evt_r272_pair_00000001";
const NOVA_ID = "evt_r272_nova_00000001";
const MIKE_ID = "evt_r272_mike_00000001";
const GOLF_ID = "evt_r272_golf_00000001";
const HOTEL_ID = "evt_r272_hotel_00000001";
const ALI_1 = "evt_r272_ali_00000001";
const ALI_2 = "evt_r272_ali_00000002";
const ZHOU_ID = "evt_r272_zhou_00000001";

const BASE14 = "/audit?window=custom&from=2026-11-05T02:00:00Z&to=2026-11-19T02:00:00Z&limit=25";
const PAIRS_STATION = "/audit?window=custom&from=2026-11-18T02:00:00Z&to=2026-11-19T02:00:00Z&limit=25";
const CONTROL_STATION = `/audit?window=custom&from=2026-11-05T02:00:00Z&to=2026-11-19T02:00:00Z&type=task.created&limit=25`;
const FILTERED_STATION = `/audit?window=30d&actor=${encodeURIComponent(ACTOR)}&type=task.created&limit=25`;

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: { type?: string; id?: string; displayName?: string };
  resource: { type?: string; id?: string };
  requestId: string | null;
  correlationId?: string | null;
}

function rowOf(eventId: string, occurredAt: string, over: Partial<Row> = {}): Row {
  return {
    eventId,
    action: "task.created",
    occurredAt,
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: "ap_1122334455667788" },
    requestId: `req-${eventId}`,
    ...over,
  };
}

const FULL = rowOf(FULL_ID, "2026-11-19T01:20:00Z", { correlationId: CORR });
const PAIR = rowOf(PAIR_ID, "2026-11-19T01:21:00Z", { correlationId: "cor-9988776655443322" });
const NOVA = rowOf(NOVA_ID, "2026-11-19T01:20:00Z");
const MIKE = rowOf(MIKE_ID, "2026-11-19T01:21:00Z");
const GOLF = rowOf(GOLF_ID, "2026-11-02T01:00:00Z");
const HOTEL = rowOf(HOTEL_ID, "2026-11-05T01:00:00Z");
const ALI_ROWS = [rowOf(ALI_1, "2026-11-19T01:20:00Z"), rowOf(ALI_2, "2026-11-19T01:21:00Z")];
const ZHOU = rowOf(ZHOU_ID, "2026-11-19T01:22:00Z", {
  actor: { type: "human", id: FOREIGN_ID, displayName: "周航" },
});
const ALL = [FULL, PAIR, NOVA, MIKE, GOLF, HOTEL, ALI_ROWS[0], ALI_ROWS[1], ZHOU];

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
  root = null;
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
  await waitFor(() => document.querySelector(".animate-pulse") === null, "skeleton gone");
}

function node(testId: string): Element | null {
  return document.querySelector(`[data-testid='${testId}']`);
}

function textOf(testId: string): string {
  return node(testId)?.textContent ?? "";
}

function shownCount(): number {
  const match = /(\d+)/.exec(textOf("aud01-status"));
  return match ? Number(match[1]) : -1;
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number => urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
const detailReads = (): number => urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length;

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}

function spanOf(url: string): number {
  const from = paramOf(url, "from");
  const to = paramOf(url, "to");
  if (from === null || to === null) return -1;
  return (Date.parse(to) - Date.parse(from)) / 86_400_000;
}

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid]"))
    .map((element) => String(element.getAttribute("data-testid")))
    .filter((testId) => testId.startsWith("aud01-row-"))
    .map((testId) => testId.replace("aud01-row-", ""));

function cell(testId: string): string {
  return node(testId)?.querySelector("dd")?.textContent ?? "";
}

function markValue(testId: string): string {
  // the audJ probe is an aria-hidden span carrying the printed value as an
  // attribute (views.tsx Field) — the text content is deliberately empty
  return node(testId)?.getAttribute("data-audj-value") ?? "";
}

async function clickTestId(testId: string, label: string): Promise<void> {
  const target = node(testId);
  expect(target, label).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function openRecord(eventId: string): Promise<void> {
  await clickTestId(`aud01-cell-${eventId}-type`, `row ${eventId}`);
  await waitFor(() => node("aud02-detail") !== null, "the detail pane opened");
}

async function closeRecord(): Promise<void> {
  await clickTestId("aud8-back-to-list", "back to the list");
  await waitFor(() => node("aud02-detail") === null, "the detail pane closed");
}

// 复制句到手：抽屉里那唯一一枚 aud-detail-copy（行级复制钮不存在，R264 口径）。
const clip = { calls: [] as string[] };

async function copiedLine(): Promise<string> {
  const before = clip.calls.length;
  await clickTestId("aud-detail-copy", "copy button");
  await waitFor(() => clip.calls.length > before, "the copy landed");
  return clip.calls[clip.calls.length - 1] ?? "";
}

// 文件到手：blob 监听 + 解析（R264 夹具口径）。
const blobs = new Map<string, Blob>();
const captured = { name: "", text: "" };

function watchBlobs(): void {
  blobs.clear();
  captured.name = "";
  captured.text = "";
  URL.createObjectURL = ((blob: Blob) => {
    const url = `blob:r272-${blobs.size + 1}`;
    blobs.set(url, blob);
    return url;
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    if (!this.download) return;
    captured.name = this.download;
    const blob = blobs.get(this.href);
    if (blob) void blob.text().then((text) => (captured.text = text));
  });
}

function parseRecord(line: string): string[] {
  const cells: string[] = [];
  let index = 0;
  while (index <= line.length) {
    if (line[index] === '"') {
      let value = "";
      index += 1;
      while (index < line.length) {
        if (line[index] === '"') {
          if (line[index + 1] === '"') {
            value += '"';
            index += 2;
            continue;
          }
          index += 1;
          break;
        }
        value += line[index];
        index += 1;
      }
      cells.push(value);
      if (line[index] === ",") index += 1;
      continue;
    }
    const next = line.indexOf(",", index);
    if (next === -1) {
      cells.push(line.slice(index));
      break;
    }
    cells.push(line.slice(index, next));
    index = next + 1;
  }
  return cells;
}

function dataLines(): string[] {
  const bom = String.fromCharCode(0xfeff);
  const text = captured.text.startsWith(bom) ? captured.text.slice(1) : captured.text;
  return text.split("\r\n").filter((line) => line !== "").slice(1);
}

async function exportRecords(): Promise<string[][]> {
  captured.text = "";
  await clickTestId("aud01-export", "aud01-export");
  await waitFor(() => captured.text !== "", "the export was handed over");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  return dataLines().map(parseRecord);
}

const COL = {
  time: CSV_HEADER.indexOf("时间"),
  type: CSV_HEADER.indexOf("类型"),
  result: CSV_HEADER.indexOf("结果"),
  actor: CSV_HEADER.indexOf("操作者"),
  object: CSV_HEADER.indexOf("对象"),
  rid: CSV_HEADER.indexOf("请求编号"),
};

beforeEach(() => {
  api.fetchJSON.mockReset();
  clip.calls = [];
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.navigator, "clipboard", {
    value: {
      writeText: async (text: string) => {
        clip.calls.push(text);
      },
    },
    configurable: true,
  });
  // 站点分发按线路参数：actor → action 站 → from 站 → 窗口宽度。
  // 周航行只在无 actorId 的 CONTROL 站出现——按工单设计，筛选站永不回它。
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      const id = paramOf(target, "id");
      return { audit: ALL.find((row) => row.eventId === id) ?? null };
    }
    const actor = paramOf(target, "actorId");
    if (actor !== null) return { items: actor === ACTOR ? ALI_ROWS : [], nextCursor: null };
    if (paramOf(target, "action") === "task.created") {
      return { items: [...ALI_ROWS, ZHOU], nextCursor: null };
    }
    // 线路把 from 重新序列化成毫秒形（2026-11-18T02:00:00.000Z），所以按前缀认站。
    const from = paramOf(target, "from");
    if (from !== null && from.startsWith("2026-11-18")) {
      return { items: [FULL, PAIR], nextCursor: null };
    }
    if (spanOf(target) >= 29) return { items: [GOLF, HOTEL], nextCursor: null };
    return { items: [NOVA, MIKE], nextCursor: null };
  });
  watchBlobs();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R272 - the sentence and the file row stay one honest pair", () => {
  it("walks time/actor/action/resource/correlation against the row's cells, each口径 keeping its own extra", async () => {
    await render(PAIRS_STATION);
    expect(paintedRows()).toEqual([FULL_ID, PAIR_ID]);

    await openRecord(FULL_ID);
    const line = await copiedLine();
    await closeRecord();

    const records = await exportRecords();
    const row = records.find((cells) => cells[COL.rid] === `req-${FULL_ID}`);
    expect(row, "the opened event reached the file").not.toBeUndefined();

    // 段↔格锚点配对（顺序单调，锚点同一 —— 两面列序本就不同，见头部登记）
    expect(line.startsWith(`${TIME_HEAD} ${ZONE}`), "the sentence opens with the seconds the file truncates").toBe(true);
    expect(TIME_HEAD.startsWith(`${row![COL.time]}:`), "the file cell is the sentence head minus its seconds").toBe(true);
    expect(row![COL.time]).toBe(TIME_FILE);
    expect(row![COL.actor]).toBe(WHO);
    expect(row![COL.type]).toBe(ACTION_WORDS);
    expect(row![COL.object]).toBe(OBJECT);
    let last = -1;
    for (const anchor of [TIME_HEAD, WHO, ACTION_WORDS, OBJECT, CORR_SHORT]) {
      const at = line.indexOf(anchor, last + 1);
      expect(at, `「${anchor}」 sits after the previous segment`).toBeGreaterThan(last);
      last = at;
    }
    expect(line.endsWith(` · ${OBJECT} · ${CORR_SHORT}`), "the sentence ends with the correlation tail").toBe(true);

    // 两套口径互缺：CSV 的 结果 列没有句子对应段；句子的关联尾没有 CSV 列。
    expect(row![COL.result], "the file carries the outcome word").toBe(RESULT_WORD);
    expect(line, "the sentence never borrows the 结果 word").not.toContain(RESULT_WORD);
    expect((CSV_HEADER as readonly string[]).indexOf("关联"), "the file has no correlation column").toBe(-1);
    for (const cells of records) expect(cells).toHaveLength(CSV_HEADER.length);
    for (const cells of records) {
      for (const one of cells) {
        expect(one, "the correlation stays out of every file cell").not.toContain(CORR_SHORT);
      }
    }
    expect(line, "the sentence never carries the request id — that is the file's").not.toContain("req-");

    // 缺值双口径不在此重钉：R263 it:310、R264 it:298、columns :327-329 持有。
  });

  it("swaps the whole page at 30d and the file follows — old rows leave, exactly one re-ask", async () => {
    await render(BASE14);
    expect(paintedRows()).toEqual([NOVA_ID, MIKE_ID]);
    const ledger = urls();
    const asks = listReads();
    expect(asks, "the narrow page mounted on one 问").toBe(1);

    await clickTestId("aud01-filter-window-30d", "the 30d tier");
    await waitFor(() => listReads() === 2, "the wider question was asked");
    // 裁决 (工单②「列表不重取」≠现状): a tier switch is exactly one re-ask —
    // the ledger主体 owner is R243① it:312 with 「恰一问」 at :329. What is
    // net-new is the FILE side: the copy side of this sweep is R243①'s.
    expect(urls().length, "exactly one new question, no per-tier drip").toBe(ledger.length + 1);
    expect(paintedRows()).toEqual([GOLF_ID, HOTEL_ID]);
    expect(shownCount()).toBe(paintedRows().length);

    const blobsBefore = blobs.size;
    const records = await exportRecords();
    expect(records.map((cells) => cells[COL.rid])).toEqual([`req-${GOLF_ID}`, `req-${HOTEL_ID}`]);
    expect(records.length).toBe(paintedRows().length);
    expect(records.length).toBe(shownCount());
    expect(captured.text).toContain(`req-${GOLF_ID}`);
    expect(captured.text, "the narrow window leaves no row behind").not.toContain(`req-${NOVA_ID}`);
    expect(captured.text, "the narrow window leaves no row behind").not.toContain(`req-${MIKE_ID}`);
    expect(blobs.size, "one handover, one file").toBe(blobsBefore + 1);
    expect(urls().length, "the export click asked for nothing").toBe(ledger.length + 1);
    expect(detailReads(), "no drawer, no detail 问").toBe(0);
  });
});

describe("R272 - the actor filter sweeps screen, file and copy together", () => {
  it("exports exactly the filtered actor's rows, the first file row is the first painted row, and the copy asks for nothing", async () => {
    // control station first: the foreign actor exists in this ledger, so the
    // exclusion below is a sweep, not a silence by construction.
    await render(CONTROL_STATION);
    expect(paintedRows()).toEqual([ALI_1, ALI_2, ZHOU_ID]);
    const control = await exportRecords();
    expect(control.map((cells) => cells[COL.rid])).toContain(`req-${ZHOU_ID}`);
    expect(captured.text).toContain(FOREIGN_WHO);
    const controlReads = listReads();

    // the filtered station: 李思 only, screen and file alike, first row同源.
    await render(FILTERED_STATION);
    const painted = paintedRows();
    expect(painted).toEqual([ALI_1, ALI_2]);
    expect(shownCount()).toBe(painted.length);

    const ledger = urls();
    const asks = listReads();
    const records = await exportRecords();
    expect(records.length).toBe(painted.length);
    expect(asks - controlReads, "the filtered station mounted on exactly one 问").toBe(1);
    for (const cells of records) {
      expect(cells[COL.actor], "no foreign operator reached the file").toBe(WHO);
      expect(cells[COL.actor]).not.toBe(FOREIGN_WHO);
    }
    expect(captured.text).not.toContain(`req-${ZHOU_ID}`);
    expect(captured.text).not.toContain(FOREIGN_WHO);
    expect(captured.text, "the foreign handle never rides into the file").not.toContain(FOREIGN_ID);
    // 首行同源：文件第 1 行 == 屏上第 1 行，逐格就是屏上 dd 的脸（R264 的准源口径，筛选站版）。
    expect(records[0][COL.rid]).toBe(`req-${painted[0]}`);
    expect(records[0][COL.actor]).toBe(cell(`aud01-cell-${painted[0]}-actor`));
    expect(records[0][COL.object]).toBe(cell(`aud01-cell-${painted[0]}-object`));
    expect(urls().length, "the export cost nothing on top of the one load").toBe(ledger.length);

    // copy leg: opening the record is one detail 问 (R243③ it:370 owner), the
    // copy itself is free, and the list never re-asks.
    const beforeOpen = urls();
    await openRecord(painted[0]);
    expect(detailReads(), "the drawer asked exactly once").toBe(1);
    expect(listReads(), "the list was not re-asked").toBe(asks);
    expect(urls().length, "the drawer open was one 问 on top of the load").toBe(beforeOpen.length + 1);
    const opened = urls();
    const line = await copiedLine();
    expect(line.startsWith(`${markValue(`audJ-time-list-${painted[0]}`)} ${ZONE}`)).toBe(true);
    expect(line).toContain(WHO);
    expect(urls(), "the copy asked for nothing").toEqual(opened);
    expect(listReads()).toBe(asks);
    await closeRecord();
    const afterClose = await exportRecords();
    expect(afterClose).toEqual(records);
    expect(listReads(), "closing and re-exporting asked nothing new").toBe(asks);
  });
});
