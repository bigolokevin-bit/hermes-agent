// @vitest-environment jsdom
// R241 — 复制与导出在分页态同源：翻到第 2 页之后，屏上那句复制话、表里那一格、
// 文件里那一行，说的还得是同一条事件的同一串词；切窗档回到第 1 页时也一样。
//
// 已覆盖、这里不重写（只回证据与文件:行）：
// - `audit.paging.test.tsx`（R161）钉住了 load-more 的行换代（:227-239）、游标只带
//   响应回传的那一枚、「第 2 页 · 已加载 N 条」读数（:249），以及切窗档按钮清游标回
//   第 1 页（:261-268，冷地址第 2 页语境）；那里没有复制腿；
// - `audit.fields.edge.test.tsx`（R220 例④）钉住了冷地址 `?cursor=` 第 2 页开合详情
//   时 `aud01-status` 与行序逐字（:476-502）；那里也没有复制↔CSV 的对照；
// - `audit.export.columns.test.tsx` 例⑤（R205，:~340 起）与 `audit.error.test.tsx`
//   例④（R213）：空集/失败态两枚导出 disabled+逐字 title、点击零请求、
//   `URL.createObjectURL` 调用数 0；`audit.error.empty.test.tsx` 例③（R226）补了
//   错误态行复制列整族不渲；`audit.empty.test.tsx` 例⑤（R181）钉住空态下
//   `aud-detail-copy` 是【可见但禁用】+ DETAIL_COPY_DISABLED_TITLE；
//   ⇒ 工单③整条已被既有例持有，本文件不写重复用例（工单「aud-detail-copy 不渲」
//   与现状相悖——现状是可见禁用，按既有钉子回证据）。
//
// 本文件只补真正没拼过的两枚：
// ① 经 load-more 到达第 2 页后，逐行开详情复制，句子与该行的屏上词、与 CSV 行逐字
//    对上；并当场核三值：`aud01-status` == 表体行数 == 导出文件行数（整页替换现状，
//    导出只交当前可见行——若与此不符按实测钉并登记）；
// ② 翻页之后【再切窗档】：游标清空、回第 1 页、行集换代，复制仍各归各行。
// 「复制序号从 0 连续」这个说法在屏上不存在——复制件是一条事件一句话，没有序号；
// 现状钉法是逐行对应（同 R236/R237 已登记的口径）。

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

const ROW_A = "evt_r241_alpha_000001";
const ROW_B = "evt_r241_bravo_000001";
const ROW_C = "evt_r241_charlie_00001";
const ROW_D = "evt_r241_delta_000001";
const CUR2 = "cur_r241_page2";

const FROM = "2026-11-05T02:00:00Z";
const TO = "2026-11-19T02:00:00Z";

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: { type?: string; id?: string; displayName?: string };
  resource: { type?: string; id?: string };
  requestId: string | null;
}

function rowOf(eventId: string, instant: string): Row {
  return {
    eventId,
    action: ACTION,
    occurredAt: instant,
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: RESOURCE },
    requestId: `req-${eventId}`,
  };
}

// 屏上到秒、文件到分钟（R153 持有分秒阶梯）：这里按逐字列对照时只用同一精度侧。
const A_ROW = rowOf(ROW_A, "2026-11-19T01:20:00Z");
const B_ROW = rowOf(ROW_B, "2026-11-19T01:21:00Z");
const C_ROW = rowOf(ROW_C, "2026-11-18T01:22:00Z");
const D_ROW = rowOf(ROW_D, "2026-11-19T01:23:00Z");
const TIME_B = "2026-11-19 09:21:00";
const TIME_D = "2026-11-19 09:23:00";
const TIME_B_FILE = "2026-11-19 09:21";

function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      const id = paramOf(target, "id");
      return { audit: ALL.find((row) => row.eventId === id) ?? ALL[0] };
    }
    const span = spanOf(target);
    const cursor = paramOf(target, "cursor");
    if (cursor === CUR2) return { items: [B_ROW, C_ROW], nextCursor: null };
    if (span !== null && span >= 29) return { items: [D_ROW], nextCursor: null };
    return { items: [A_ROW, B_ROW], nextCursor: CUR2 };
  });
}
const ALL: Row[] = [A_ROW, B_ROW, C_ROW, D_ROW];

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
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}

function cursorsOf(url: string): string[] {
  return [...new URL(url, "http://console.test").searchParams.getAll("cursor")];
}

function spanOf(url: string): number | null {
  const from = paramOf(url, "from");
  const to = paramOf(url, "to");
  if (!from || !to) return null;
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

async function clickNode(target: Element | null | undefined, label: string): Promise<void> {
  expect(target, label).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function clickNodeSync(testId: string, label = testId): Promise<void> {
  await clickNode(node(testId), label);
}

async function openRecord(eventId: string): Promise<void> {
  await clickNodeSync(`aud01-cell-${eventId}-type`, `row ${eventId}`);
  await waitFor(() => node("aud02-detail") !== null, `detail for ${eventId}`);
}

async function closeRecord(): Promise<void> {
  await clickNodeSync("aud8-back-to-list", "back to list");
  await waitFor(() => node("aud02-detail") === null, "detail folded away");
}

// ── 复制：剪贴板桩，句子就在 clip.calls 里 ──────────────────────────────────
const clip = { calls: [] as string[] };

function stubClipboard(): void {
  clip.calls = [];
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        clip.calls.push(text);
      },
    },
  });
}

async function copiedLine(): Promise<string> {
  const before = clip.calls.length;
  await clickNodeSync("aud-detail-copy", "aud-detail-copy");
  await waitFor(() => clip.calls.length > before, "the copied line");
  return clip.calls[clip.calls.length - 1] ?? "";
}

// ── 导出：Blob 在页面这一侧生成，逐行回读 ──────────────────────────────────
const blobs = new Map<string, Blob>();
const captured = { name: "", text: "" };

function watchBlobs(): void {
  blobs.clear();
  captured.name = "";
  captured.text = "";
  URL.createObjectURL = ((blob: Blob) => {
    const url = `blob:r241-${blobs.size + 1}`;
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

describe("R241 - the second page copies the same words the screen shows", () => {
  it("hands over one row per painted line, and the sentence matches both faces", async () => {
    await render(`/audit?window=custom&from=${FROM}&to=${TO}&limit=25`);
    expect(listReads()).toBe(1);
    expect(paintedRows()).toEqual([ROW_A, ROW_B]);
    const asks = listReads();
    await clickNodeSync("aud01-load-more", "aud01-load-more");
    await waitFor(() => listReads() === asks + 1, "the second page was asked");
    expect(cursorsOf(lastListRead())).toEqual([CUR2]);
    // 整页替换现状（R161 已钉）：第 2 页就是第 2 页那一套行
    expect(paintedRows()).toEqual([ROW_B, ROW_C]);
    expect(textOf("aud2-page")).toContain("第 2 页");
    expect(shownCount()).toBe(paintedRows().length);
    // 逐行：屏上的时间、复制的句子、文件的那一行，三处同一条事件
    for (const eventId of paintedRows()) {
      await openRecord(eventId);
      const line = await copiedLine();
      expect(line.startsWith(`${markValue(`audJ-time-list-${eventId}`)} ${ZONE}`)).toBe(true);
      expect(line).toContain(WHO);
      expect(line).toContain(ACTION_WORDS);
      expect(line).toContain(OBJECT);
      expect(line).not.toContain(ACTOR);
      expect(line).not.toContain(RESOURCE);
      await closeRecord();
    }
    const records = await exportRecords();
    expect(records).toHaveLength(paintedRows().length);
    const index = records.findIndex((cells) => cells[COL.rid] === `req-${ROW_B}`);
    expect(index, "row B reached the file").toBeGreaterThan(-1);
    // 文件与屏上的分秒阶梯（R153 持有）：文件到分钟，取第 2 行 B 的秒级屏值做前缀
    expect(markValue(`audJ-time-list-${ROW_B}`)).toBe(TIME_B);
    expect(records[index][COL.time]).toBe(TIME_B_FILE);
    expect(TIME_B.startsWith(records[index][COL.time])).toBe(true);
    expect(records[index][COL.actor]).toBe(WHO);
    expect(records[index][COL.type]).toBe(ACTION_WORDS);
    expect(records[index][COL.object]).toBe(OBJECT);
  });
});

describe("R241 - paging then widening still recomputes without residue", () => {
  it("drops the cursor on the window switch and keeps every row's copy its own", async () => {
    await render(`/audit?window=custom&from=${FROM}&to=${TO}&limit=25`);
    const asks = listReads();
    await clickNodeSync("aud01-load-more", "aud01-load-more");
    await waitFor(() => listReads() === asks + 1, "page two asked");
    expect(paintedRows()).toEqual([ROW_B, ROW_C]);
    // 翻页之后再切窗档：R161 在冷地址第 2 页钉过清游标回第 1 页；这里是活翻页后同一承诺
    await clickNodeSync("aud01-filter-window-30d", "30d tier");
    await waitFor(() => listReads() === asks + 2, "the wider window asked");
    const read = lastListRead();
    expect(cursorsOf(read)).toEqual([]);
    expect(spanOf(read)).not.toBeNull();
    expect(spanOf(read)!).toBeGreaterThanOrEqual(29);
    expect(textOf("aud2-page")).toContain("第 1 页");
    expect(paintedRows()).toEqual([ROW_D]);
    expect(shownCount()).toBe(paintedRows().length);
    // 「复制序号从 0 连续」在屏上不存在（复制件一句话无序号）——钉各归各行：
    await openRecord(ROW_D);
    const line = await copiedLine();
    expect(line.startsWith(`${TIME_D} ${ZONE}`)).toBe(true);
    expect(markValue(`audJ-time-list-${ROW_D}`)).toBe(TIME_D);
    expect(line).not.toContain(TIME_B);
    await closeRecord();
    const records = await exportRecords();
    expect(records).toHaveLength(1);
    expect(records[0][COL.rid]).toBe(`req-${ROW_D}`);
    expect(records[0][COL.time]).toBe("2026-11-19 09:23");
  });
});
