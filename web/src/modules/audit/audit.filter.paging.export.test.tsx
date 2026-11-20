// @vitest-environment jsdom
// R243 — 筛选组合下的分页换代与导出同源：档位切宽不是「再问一题加一页」，是换一整页答案；
// 叠加 actor+action 时文件的行序必须就是屏上的行序；开合抽屉不许动游标、页码和读数行。
//
// 已覆盖、这里不重写（只回证据与文件:行）：
// - `audit.paging.test.tsx`（R161）:268-290 钉住【第 2 页点档位钮 ⇒ 游标清空、回第 1 页、
//   其余参逐字】的主体账本；它的夹具不按跨度换行集，也没有复制/文件两腿 —— 本文件补的正是
//   「换代后屏上到底是什么、复制句跟没跟上」；
// - `audit.export.columns.test.tsx`（R205）:373-375 在叠加筛选下只核过【数量】三角
//   （文件行数==表体==读数行），从未按位置核行序 —— 本文件 ② 钉位置序；
// - `audit.list.order.stability.test.tsx`（R236）② 钉过无筛选语境的位置序，本波是叠加语境；
// - `audit.fields.edge.test.tsx`（R220）:476-502 开合账本属【冷地址 ?cursor=】语境；
// - R196/R201③/R208③ 各钉过开合 detailReads 恰 +1 与列表不重取。
//
// 现状口径（不在本波统一）：整页替换非并集（loadMore 追加腿在 UI 不可达，R161/R212 已登记）；
// 游标键在地址里只留最近一枚（R242 家族口径）；「复制序号」概念不存在 —— 复制件是一条事件
// 一句话，本文件钉的是【逐行对应】：开哪行、复制句就是哪行的话。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { CSV_HEADER } from "@/modules/audit/csv";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTOR = "user:2f3a4b5c6d7e8f90";
const WHO = "李思 · 6d7e8f90";
const ACTION = "task.created";
const ACTION_WORDS = "创建任务";
const RESOURCE = "ap_1122334455667788";
const OBJECT = "审批单 · 55667788";
const ZONE = "北京时间（UTC+8）";

const ROW_N = "evt_r243_nova_000001";
const ROW_M = "evt_r243_mike_00000001";
const ROW_G = "evt_r243_golf_000001";
const ROW_H = "evt_r243_hotel_000001";
// 7d 档叠加筛选只回这两行；30d 档换成另外两行 —— 行集不相交，换代才看得见。
const TIME_G = "2026-11-02 09:30:00";

const STACKED = `/audit?window=7d&actor=${encodeURIComponent(ACTOR)}&type=${ACTION}&limit=25`;
const STACKED_WIDE = `/audit?window=30d&actor=${encodeURIComponent(ACTOR)}&type=${ACTION}&limit=25`;

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: { type?: string; id?: string; displayName?: string };
  resource: { type?: string; id?: string };
  requestId: string | null;
}

function rowOf(eventId: string, occurredAt: string): Row {
  return {
    eventId,
    action: ACTION,
    occurredAt,
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: RESOURCE },
    requestId: `req-${eventId}`,
  };
}

const ROW_NOVA = rowOf(ROW_N, "2026-11-19T01:20:00Z");
const ROW_MIKE = rowOf(ROW_M, "2026-11-19T01:21:00Z");
const ROW_GOLF = rowOf(ROW_G, "2026-11-02T01:30:00Z");
const ROW_HOTEL = rowOf(ROW_H, "2026-11-05T01:20:00Z");

const NEAR = [ROW_NOVA, ROW_MIKE];
const WIDE = [ROW_GOLF, ROW_HOTEL];
const ALL = [...NEAR, ...WIDE];

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
  return node(testId)?.textContent?.trim() ?? "";
}

function markValue(testId: string): string {
  return node(testId)?.getAttribute("data-audj-value") ?? "";
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
const detailReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}

function cursorsOf(url: string): string[] {
  return [...new URL(url, "http://console.test").searchParams.getAll("cursor")];
}

function spanOf(url: string): number {
  const from = paramOf(url, "from");
  const to = paramOf(url, "to");
  if (from === null || to === null) return -1;
  return (Date.parse(to) - Date.parse(from)) / 86_400_000;
}

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

function shownCount(): number {
  const digits = /(\d+)/.exec(textOf("aud01-status"));
  return digits ? Number(digits[1]) : -1;
}

async function clickNodeSync(testId: string, label = testId): Promise<void> {
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
  await clickNodeSync(`aud01-cell-${eventId}-type`, `aud01-cell-${eventId}-type`);
  await waitFor(() => node("aud02-detail") !== null, "detail painted");
}

async function closeRecord(): Promise<void> {
  await clickNodeSync("aud8-back-to-list", "aud8-back-to-list");
  await waitFor(() => node("aud02-detail") === null, "detail folded");
}

// ── 复制件：一句话，跟着行走 ────────────────────────────────────────────────
const clip = { calls: [] as string[] };

function stubClipboard(): void {
  clip.calls = [];
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.navigator, "clipboard", {
    value: { writeText: (text: string) => clip.calls.push(text) },
    configurable: true,
  });
}

async function copiedLine(): Promise<string> {
  const before = clip.calls.length;
  await clickNodeSync("aud-detail-copy", "aud-detail-copy");
  await waitFor(() => clip.calls.length > before, "a copy was handed to the clipboard");
  return clip.calls[clip.calls.length - 1] ?? "";
}

// ── 文件：Blob → 文本 → 逐行逐格 ────────────────────────────────────────────
const blobs = new Map<string, Blob>();
const captured = { name: "", text: "" };

function watchBlobs(): void {
  blobs.clear();
  captured.name = "";
  captured.text = "";
  URL.createObjectURL = ((blob: Blob) => {
    const url = `blob:r243-${blobs.size + 1}`;
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

/** RFC4180 回解析：带引号的字段里可以有一逗号和翻倍的双引号。 */
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
  return captured.text
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .filter((line) => line !== "")
    .slice(1);
}

async function exportRecords(): Promise<string[][]> {
  captured.text = "";
  await clickNodeSync("aud01-export", "aud01-export");
  await waitFor(() => captured.text !== "", "the export was handed over");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  return dataLines().map(parseRecord);
}

const COL = {
  time: CSV_HEADER.indexOf("时间"),
  type: CSV_HEADER.indexOf("类型"),
  actor: CSV_HEADER.indexOf("操作者"),
  object: CSV_HEADER.indexOf("对象"),
  rid: CSV_HEADER.indexOf("请求编号"),
};

function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      return { audit: ALL.find((row) => row.eventId === paramOf(target, "id")) ?? ALL[0] };
    }
    const stacked = paramOf(target, "actorId") === ACTOR && paramOf(target, "action") === ACTION;
    if (stacked && spanOf(target) >= 29) return { items: WIDE, nextCursor: null };
    if (stacked) return { items: NEAR, nextCursor: null };
    return { items: ALL, nextCursor: null };
  });
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  answer();
  stubClipboard();
  watchBlobs();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R243 - widening the window swaps the whole page, copies follow", () => {
  it("clears the cursor, replaces the row set and leaves no reading of the narrow window", async () => {
    await render(STACKED);
    expect(listReads()).toBe(1);
    const first = lastListRead();
    expect(paramOf(first, "actorId")).toBe(ACTOR);
    expect(paramOf(first, "action")).toBe(ACTION);
    expect(paramOf(first, "window")).toBeNull(); // 档位不上线路，只以 from/to 对出现（既有口径）
    expect(paintedRows()).toEqual([ROW_N, ROW_M]);
    const callsBefore = urls().length;
    await clickNodeSync("aud01-filter-window-30d", "aud01-filter-window-30d");
    await waitFor(() => listReads() === 2, "the wider question was asked");
    const read = lastListRead();
    // R161 :268-290 已钉游标清空/回第 1 页的账本主体；这里钉的是换代【内容】
    expect(cursorsOf(read)).toEqual([]);
    expect(spanOf(read)).toBeGreaterThanOrEqual(29);
    expect(paramOf(read, "actorId")).toBe(ACTOR);
    expect(paramOf(read, "action")).toBe(ACTION);
    expect(urls().length).toBe(callsBefore + 1); // 恰一问，不是逐档补问
    // 整页替换现状：新行集就是 30d 的那两行，窄窗两行整页消失，绝不并回
    expect(paintedRows()).toEqual([ROW_G, ROW_H]);
    expect(shownCount()).toBe(paintedRows().length);
    expect(textOf("aud2-page")).toContain("第 1 页");
    for (const eventId of paintedRows()) {
      await openRecord(eventId);
      const line = await copiedLine();
      expect(
        line.startsWith(`${markValue(`audJ-time-list-${eventId}`)} ${ZONE}`),
      ).toBe(true);
      // 复制件无残留：窄窗那两行的日期一刻都不许出现在新行复制句里
      expect(line).not.toContain("2026-11-19");
      expect(line).not.toContain(ACTOR);
      await closeRecord();
    }
  });
});

describe("R243 - the file walks in the table's order under the stacked question", () => {
  it("hands over records row for row in exactly the painted order", async () => {
    await render(STACKED);
    const rows = paintedRows();
    expect(rows).toEqual([ROW_N, ROW_M]);
    const records = await exportRecords();
    // 位置序：第 i 行文件就是第 i 行屏上 —— R205 只按编号找过行，从没按序核过
    expect(records.map((cells) => cells[COL.rid])).toEqual(rows.map((id) => `req-${id}`));
    for (const cells of records) {
      expect(cells[COL.actor]).toBe(WHO);
      expect(cells[COL.type]).toBe(ACTION_WORDS);
      expect(cells[COL.object]).toBe(OBJECT);
    }
    expect(captured.text).not.toContain(ACTOR);
    expect(captured.text).not.toContain(RESOURCE);
    // 数量三角本体由 R205 :373-375 持有，这里只顺带确认换序没换数
    expect(records).toHaveLength(paintedRows().length);
    expect(shownCount()).toBe(paintedRows().length);
  });
});

describe("R243 - the drawer opens and folds without touching the page ledger", () => {
  it("keeps the cursor, the page and the readout exactly where they were", async () => {
    await render(STACKED_WIDE);
    expect(cursorsOf(lastListRead())).toEqual([]);
    const callsBefore = urls().length;
    const asksBefore = listReads();
    const statusBefore = textOf("aud01-status");
    const rowsBefore = paintedRows();
    await openRecord(ROW_G);
    expect(detailReads()).toBe(1);
    expect(paramOf(urls()[callsBefore] ?? "", "id")).toBe(ROW_G); // 线路参是 id=，既有口径
    expect(urls().length).toBe(callsBefore + 1); // 开抽屉只多这一问
    expect(cursorsOf(lastListRead())).toEqual([]); // 游标不被详情动
    const line = await copiedLine();
    expect(line).toContain(TIME_G);
    await closeRecord();
    expect(detailReads()).toBe(1);
    expect(listReads()).toBe(asksBefore);
    expect(urls().length).toBe(callsBefore + 1);
    expect(paintedRows()).toEqual(rowsBefore);
    expect(textOf("aud01-status")).toBe(statusBefore);
    expect(cursorsOf(lastListRead())).toEqual([]);
  });
});
