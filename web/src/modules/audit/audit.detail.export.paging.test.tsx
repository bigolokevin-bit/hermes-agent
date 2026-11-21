// @vitest-environment jsdom
// R258 — 导出 × 分页 × 详情开态：第 2 页上，抽屉里那句话和文件里那一行必须是同一套词。
//
// 已覆盖、这里不重写（只回证据）：
// - `audit.export.paging.detail.test.tsx`（R249）持有工单①的主体：第 2 页开抽屉后导出
//   行数==表体==`aud01-status`、rid 位置序==屏上序、逐行复制各归各行、面板句与 RID 不进文件；
// - `audit.export.detail.window.test.tsx`（R251）持有工单②的主体：抽屉开态换宽后
//   文件按屏上位置序换代（:266）、开与关交付同集合逐字（:294）、往返终局逐字（:316）；
// - `audit.export.window.detail.paging.test.tsx`（R250）持有工单③的主体：第 2 页 500 恢复后
//   文件整页满列、不产半行、零 Blob；`audit.copy.paging2.test.tsx`（R244）持有失败期的
//   doors+titles+urls 逐字+createObjectURL 计数 0；R161 持有 rid 可复制与三问账本本体；
// - 抽屉在换档时冻结旧读数（R245/R247、R229② 同规）——工单「复制随详情换代」与
//   「列表不重取」都不按承诺钉：现状是抽屉不动、每翻恰一问，注释里一并登记。
//
// 本波净新增只一枚：把【复制句】与【该事件在文件里那一行】逐格对读，放在第 2 页语境——
// R235 在操作者筛选的第 1 页对过，R254 在裸第 1 页对过，第 2 页没有人对过。

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
const FROM = "2026-11-05T02:00:00Z";
const TO = "2026-11-19T02:00:00Z";

const P1_A = "evt_r258_alpha_00000001";
const P1_B = "evt_r258_bravo_000000001";
const P2_C = "evt_r258_charlie_000001";
const P2_D = "evt_r258_delta_00000001";
const TIME_C = "2026-11-19 09:22:00";

const CUR2 = "cur_r258_page2";
const BASE = `/audit?window=custom&from=${FROM}&to=${TO}&limit=25`;

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: { type: string; id: string; displayName: string };
  resource: { type: string; id: string };
  requestId: string | null;
}

const rowOf = (eventId: string, minute: number): Row => ({
  eventId,
  action: ACTION,
  occurredAt: `2026-11-19T01:${minute.toString().padStart(2, "0")}:00Z`,
  outcome: "succeeded",
  actor: { type: "human", id: ACTOR, displayName: "李思" },
  resource: { type: "approval", id: RESOURCE },
  requestId: `req-${eventId}`,
});

const PAGE_ONE = [rowOf(P1_A, 20), rowOf(P1_B, 21)];
const PAGE_TWO = [rowOf(P2_C, 22), rowOf(P2_D, 23)];
const ALL = [...PAGE_ONE, ...PAGE_TWO];

function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      const wanted = new URL(target, "http://console.test").searchParams.get("id");
      return { audit: ALL.find((row) => row.eventId === wanted) ?? ALL[0] };
    }
    const cursor = new URL(target, "http://console.test").searchParams.get("cursor");
    if (cursor === null) return { items: PAGE_ONE, nextCursor: CUR2 };
    return { items: PAGE_TWO, nextCursor: null };
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

const node = (testId: string): Element | null =>
  document.querySelector(`[data-testid='${testId}']`);

const textOf = (testId: string): string => node(testId)?.textContent?.trim() ?? "";

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

function shownCount(): number {
  const digits = /(\d+)/.exec(textOf("aud01-status"));
  return digits ? Number(digits[1]) : -1;
}

function markValue(testId: string): string {
  return node(testId)?.getAttribute("data-audj-value") ?? "";
}

async function clickNodeSync(testId: string, label = testId): Promise<void> {
  const target = node(testId);
  expect(target, label).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function openRecord(eventId: string): Promise<void> {
  await clickNodeSync(`aud01-cell-${eventId}-type`, `row ${eventId}`);
  await waitFor(() => node("aud02-detail") !== null, "the detail painted");
}

async function closeRecord(): Promise<void> {
  await clickNodeSync("aud8-back-to-list", "返回列表");
  await waitFor(() => node("aud02-detail") === null, "the detail closed");
}

async function loadMore(asksBefore: number): Promise<void> {
  await clickNodeSync("aud01-load-more", "加载下一页");
  await waitFor(() => listReads() === asksBefore + 1, "the next page was asked for");
}

// 复制件只读不写：抽屉开着时它就是这一条事件的句子。
const clip: { calls: string[] } = { calls: [] };

function stubClipboard(): void {
  clip.calls = [];
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.navigator, "clipboard", {
    value: { writeText: (text: string) => clip.calls.push(text) },
    configurable: true,
  });
}

async function copiedLine(): Promise<string> {
  await clickNodeSync("aud-detail-copy", "复制该事件");
  await waitFor(() => clip.calls.length > 0, "the copy landed in the clipboard");
  return clip.calls[clip.calls.length - 1] ?? "";
}

const blobs = new Map<string, Blob>();
const captured: { name: string; text: string } = { name: "", text: "" };

function watchBlobs(): void {
  blobs.clear();
  captured.name = "";
  captured.text = "";
  URL.createObjectURL = ((blob: Blob) => {
    const url = `blob:r258-${blobs.size + 1}`;
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
  await clickNodeSync("aud01-export", "导出 CSV");
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

describe("R258 - page two puts the opened sentence into its own file row", () => {
  it("reads the opened sentence against its own row in the file, one page in", async () => {
    await render(BASE);
    expect(listReads()).toBe(1);
    expect(paintedRows()).toEqual([P1_A, P1_B]);
    await loadMore(1);
    expect(paintedRows()).toEqual([P2_C, P2_D]);
    expect(textOf("aud2-page")).toContain("第 2 页");

    await openRecord(P2_C);
    const line = await copiedLine();
    // 屏上那一格的秒值就是复制句的开头（现状无「相对时间」措辞，归 R153/主测试）。
    expect(markValue(`audJ-time-list-${P2_C}`)).toBe(TIME_C);
    expect(line.startsWith(`${TIME_C} ${ZONE}`)).toBe(true);

    const records = await exportRecords();
    // 三值当场核：导出行数 == 已加载表体 == 读数行。
    expect(records).toHaveLength(paintedRows().length);
    expect(shownCount()).toBe(records.length);
    expect(records.map((cells) => cells[COL.rid])).toEqual([`req-${P2_C}`, `req-${P2_D}`]);

    // 净新增：复制句与【它自己那一行】逐格对读——文件到分钟、句子到秒，
    // 按现状钉成前缀一致（分钟/秒阶梯归 R153），其余词逐字相等。
    const rowC = records[0];
    expect(line.startsWith(rowC[COL.time])).toBe(true);
    expect(rowC[COL.actor]).toBe(WHO);
    expect(line).toContain(WHO);
    expect(rowC[COL.type]).toBe(ACTION_WORDS);
    expect(line).toContain(ACTION_WORDS);
    expect(rowC[COL.object]).toBe(OBJECT);
    expect(line).toContain(OBJECT);
    // 裸句柄两侧都不出现。
    expect(line).not.toContain(ACTOR);
    expect(line).not.toContain(RESOURCE);

    await closeRecord();
  });
});
