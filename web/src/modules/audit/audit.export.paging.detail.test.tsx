// @vitest-environment jsdom
// R249 — 导出 × 分页 × 详情开态：第 2 页之后的文件必须是屏上那一页，抽屉坏了也不许脏。
//
// 已覆盖、这里不重写（只回证据）：
// - `audit.copy.paged.test.tsx`（R241）钉住 load-more 到第 2 页后逐行复制与屏上同词、
//   导出行数==表体==「将导出 N 条」、rid 位置序==表体序（工单①的主体归它）；
// - `audit.detail.paging.stability.test.tsx`（R242）钉住第 2 页开合详情停留第 2 页、
//   每翻恰一问、地址游标键只留最近一枚、翻页即丢 event、详情 500 分页不重置；
// - `audit.filter.paging.export.test.tsx`（R243）钉住档位切换换代×CSV 位置序×游标账本；
// - `audit.export.detail.open.test.tsx`（R245/R247）钉住抽屉冻结旧读数、开态导出三值、
//   导出期间详情 500 时文件只含列表行、关闭走 navigate(-1) 的补问现状；
// - R222④ 持有详情 500 的句、rid 与重试恰 +1 本体；R227③ 持有行开 404 保留列表与地址；
//   R205①/R153 持有三角与分钟/秒阶梯；R181⑤ 持有空态复制件 visible-disabled。
//
// 本波只补真正没拼过的：
// ① 第 2 页之后【抽屉开着】把文件交付出去 —— 三值当场核 + 逐行复制各归各行 +
//    首行同源 + 错误面板的句与 RID 一个字都不许进文件（R241① 导出时抽屉是关的）；
// ② 第 2 页翻向第 3 页时抽屉还开着：列表每翻恰一问（工单「列表不重取」≠现状，按现状钉）、
//    页码读数按现状登记、抽屉冻结不换代、关闭不新增请求（本语境无换档、navigate(-1)
//    回同一地址，与 R247 的换档补问语境不同）；工单「URL 保 ?event=」不成立——
//    打开抽屉写的是 detail=，event= 是深链定位键且翻页即丢（R242/R220④ 持有），一并登记；
// ③ 详情 500 展示期间翻到第 3 页：分页照走、抽屉仍坏、导出仍只含新页两行、重试恰 +1。
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import { ApiError } from "@/lib/api-error";
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

const P1_A = "evt_r249_alpha_00000001";
const P1_B = "evt_r249_bravo_000000001";
const P2_A = "evt_r249_charlie_000001";
const P2_B = "evt_r249_delta_00000001";
const P3_A = "evt_r249_echo_000000001";
const P3_B = "evt_r249_foxtrot_00001";

const CUR2 = "cur_r249_page2";
const CUR3 = "cur_r249_page3";
const RID_FAIL = "rid-r249-detail-500";

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
const PAGE_TWO = [rowOf(P2_A, 22), rowOf(P2_B, 23)];
const PAGE_THREE = [rowOf(P3_A, 24), rowOf(P3_B, 25)];
const ALL = [...PAGE_ONE, ...PAGE_TWO, ...PAGE_THREE];

const mode = { failDetailOnce: false };
let detailTries = 0;

function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      detailTries += 1;
      if (mode.failDetailOnce && detailTries === 1) {
        throw new ApiError("detail down", {
          status: 500,
          body: "{}",
          url: target,
          requestId: RID_FAIL,
        });
      }
      const wanted = new URL(target, "http://console.test").searchParams.get("id");
      const found = ALL.find((row) => row.eventId === wanted);
      return { audit: found ?? ALL[0] };
    }
    const cursor = new URL(target, "http://console.test").searchParams.get("cursor");
    // 分页链按游标走：第一页回 CUR2，带 CUR2 回第二页+CUR3，带 CUR3 回第三页收尾。
    if (cursor === CUR2) return { items: PAGE_TWO, nextCursor: CUR3 };
    if (cursor === CUR3) return { items: PAGE_THREE, nextCursor: null };
    return { items: PAGE_ONE, nextCursor: CUR2 };
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
const detailReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";

function cursorsOf(url: string): string[] {
  return [...new URL(url, "http://console.test").searchParams.getAll("cursor")];
}

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
  await waitFor(() => listReads() === asksBefore + 1, "page two or three was asked for");
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
const made = { urls: 0 };

function watchBlobs(): void {
  blobs.clear();
  captured.name = "";
  captured.text = "";
  made.urls = 0;
  URL.createObjectURL = ((blob: Blob) => {
    made.urls += 1;
    const url = `blob:r249-${blobs.size + 1}`;
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
  mode.failDetailOnce = false;
  detailTries = 0;
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

describe("R249 - the second page hands over its own file while the drawer is open", () => {
  it("counts one number in three places, keeps each row's copy its own, and refuses the error face", async () => {
    await render(BASE);
    expect(paintedRows()).toEqual([P1_A, P1_B]);
    await loadMore(1);
    expect(paintedRows()).toEqual([P2_A, P2_B]);
    expect(node("aud2-page")?.textContent ?? "").toContain("第 2 页");

    await openRecord(P2_A);
    const line = await copiedLine();
    // 复制件说的是抽屉这一条，各归各行（「序号同序」在现状里没有这个概念）。
    expect(line.startsWith(`${markValue(`audJ-time-list-${P2_A}`)} ${ZONE}`)).toBe(true);
    clip.calls.length = 0;
    await closeRecord();
    await openRecord(P2_B);
    const second = await copiedLine();
    expect(second.startsWith(`${markValue(`audJ-time-list-${P2_B}`)} ${ZONE}`)).toBe(true);
    expect(second).not.toContain(markValue(`audJ-time-list-${P2_A}`).slice(11));
    await closeRecord();

    const calls = urls().length;
    const records = await exportRecords();
    expect(records).toHaveLength(paintedRows().length);
    expect(shownCount()).toBe(records.length);
    // 首行同源：文件的第一条数据就是表体的第一行。
    expect(records[0][COL.rid]).toBe(`req-${P2_A}`);
    expect(records.map((cells) => cells[COL.rid])).toEqual(paintedRows().map((id) => `req-${id}`));
    for (const cells of records) {
      expect(cells[COL.actor]).toBe(WHO);
      expect(cells[COL.type]).toBe(ACTION_WORDS);
      expect(cells[COL.object]).toBe(OBJECT);
    }
    // 抽屉的句与 RID 不进文件；导出这一击不发任何请求。
    expect(captured.text).not.toContain("这条事件没能加载出来");
    expect(captured.text).not.toContain(RID_FAIL);
    expect(urls()).toHaveLength(calls);
    expect(listReads()).toBe(2);
  });
});

describe("R249 - paging the third page with the drawer open", () => {
  it("asks once per flip, freezes the open reading, and costs nothing to fold away", async () => {
    await render(BASE);
    await loadMore(1);
    await openRecord(P2_A);
    const frozen = markValue("audJ-time-detail");
    expect(frozen).toBe(markValue(`audJ-time-list-${P2_A}`));

    const asks = listReads();
    await loadMore(asks);
    // 工单「列表不重取」≠现状：每一翻恰问一次（账本归 R161/R242 口径）。
    expect(listReads()).toBe(3);
    expect(paintedRows()).toEqual([P3_A, P3_B]);
    expect(cursorsOf(lastListRead())).toEqual([CUR3]);
    // 页码读数按现状可停「第 2 页」——地址游标键只留最近一枚（R242 已钉口径）。
    expect(textOf("aud2-page")).toContain("第 2 页");
    // 抽屉不随翻页换代：冻结在打开那一刻。
    expect(node("aud02-detail")).not.toBeNull();
    expect(markValue("audJ-time-detail")).toBe(frozen);
    expect(detailReads()).toBe(1);

    const calls = urls().length;
    await closeRecord();
    // 本语境没有换档改写栈顶：navigate(-1) 回到同一地址，关闭零请求。
    expect(urls().length).toBe(calls);
    expect(listReads()).toBe(3);
    expect(detailReads()).toBe(1);
    // 工单「URL 保 ?event=」不成立：打开写的是 detail=，event= 是深链定位键
    // 且翻页即丢（R242/R220④ 持有），这里只钉 detail= 已随关闭落掉。
    expect(paintedRows()).toEqual([P3_A, P3_B]);
    expect(shownCount()).toBe(2);
  });
});

describe("R249 - a broken drawer does not contaminate later pages", () => {
  it("keeps paging live, holds the second page in the file, and retries exactly once", async () => {
    mode.failDetailOnce = true;
    await render(BASE);
    await loadMore(1);
    await clickNodeSync(`aud01-cell-${P2_A}-type`, `row ${P2_A}`);
    await waitFor(() => node("aud02-detail-error") !== null, "the detail error face");
    expect(textOf("aud02-detail-error")).toContain("这条事件没能加载出来");
    expect(textOf("aud02-detail-error-request-id")).toContain(RID_FAIL);
    expect(node("aud02-detail-error-request-id-value")).not.toBeNull();

    await loadMore(2);
    expect(paintedRows()).toEqual([P3_A, P3_B]);
    // 列表保留分页推进；抽屉仍是错的——分页不替它遮丑。
    expect(node("aud02-detail-error")).not.toBeNull();
    expect(detailReads()).toBe(1);

    const calls = urls().length;
    const records = await exportRecords();
    // 导出仍只含列表行：当前页两行、按序、三值一致。
    expect(records.map((cells) => cells[COL.rid])).toEqual([`req-${P3_A}`, `req-${P3_B}`]);
    expect(shownCount()).toBe(records.length);
    expect(paintedRows()).toHaveLength(records.length);
    expect(captured.text).not.toContain(RID_FAIL);
    expect(listReads()).toBe(3);
    expect(urls()).toHaveLength(calls);

    const panel = node("aud02-detail-error");
    const retry = Array.from(panel!.querySelectorAll("button")).find(
      (element) => element.textContent?.includes("重试") ?? false,
    );
    expect(retry, "retry button").not.toBeNull();
    await act(async () => {
      (retry as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await waitFor(() => node("aud02-detail") !== null, "the retry painted the detail");
    expect(node("aud02-detail-error")).toBeNull();
    expect(detailReads()).toBe(2);
    expect(listReads()).toBe(3);
  });
});
