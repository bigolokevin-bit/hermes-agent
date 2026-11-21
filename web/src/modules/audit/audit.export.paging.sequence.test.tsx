// @vitest-environment jsdom
// R267 — 翻页态下游标激活，再把档位切宽：换代必须把「文件」也一起重写。
// 本波钉的是【游标激活的第 2 页 × 30d 切档换代 × CSV 全新行集零旧行 × 三值从头数】这条
// 组合线；两头的单腿早已有人钉死，这里一律不重写，只回证据与文件:行：
//
// 已覆盖、这里不重写（只回证据）：
// - ① 第 2 页装载后【导出行数==表体==aud01-status、首行同源、rid 位置序==屏上】：
//   `audit.export.paging.detail.test.tsx`（R249）:323-360 —— 屏上换页、文件逐行、导出击零请求，
//   都在那里；叠加筛选语境的位置序另有 `audit.filter.paging.export.test.tsx`（R243）② :348 起；
//   第 2 页导出行数的三角更早由 `audit.copy.paged.test.tsx`（R241）① 钉过。
// - ③ 第 2 页 500 → 重试：`audit.export.window.detail.paging.test.tsx`（R250）② :313-340 钉过
//   【恢复页整页进文件、屏上序、一个数】；:286-308 钉过失败态两门关闭、错误面 rid、
//   并在 :293 登记【工单「保旧行」≠现状：整页替换让失败页清空表体，追加腿不可达】；
//   重试恰 +1、非并集、游标原样在 `audit.error.test.tsx`（R213）③ :302-326。
// - ② 的账本腿（第 2 页点档位 ⇒ 游标清空、回第 1 页、其余参逐字）归 `audit.paging.test.tsx`
//   （R161）:268-290；它的夹具不按跨度换行集、也没有文件腿 —— 本波补的正是换代后
//   【CSV 里到底是谁】：零旧行、行集换新、计数从头。
// - 「序号从 0 连续」：列表没有序号控件，「复制序号」概念不存在（复制件是一条事件一句话，
//   行级复制=开抽屉后的 aud-detail-copy 一枚；audC-copy 仅详情独立页
//   `AuditDetailModulePage.test.tsx` :319-344）。诚实等价＝行集完整换代 + 计数从头，本 it 钉它。
//
// 现状口径（不在本波统一）：分页是整页替换非并集（每翻恰一问）；档位不上线路，
// 只以 from/to 对出现（R243① :318 既有口径）；导出反映当前已装载的行，不是全量历史。

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

const ROW_N = "evt_r267_nova_00000001";
const ROW_M = "evt_r267_mike_00000002";
const ROW_P2A = "evt_r267_papa_00000001";
const ROW_P2B = "evt_r267_kilo_00000002";
const ROW_G = "evt_r267_golf_00000001";
const ROW_H = "evt_r267_hotel_00000002";
const CUR2 = "cur_r267_page2";

// 自定义窗 span=14d<29：页 1 两行 + 游标；30d 档换成行集不相交的另两行，换代才看得见。
const CUSTOM = `/audit?window=custom&from=2026-11-05T02:00:00Z&to=2026-11-19T02:00:00Z&limit=25`;

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

const PAGE_ONE = [rowOf(ROW_N, "2026-11-19T01:20:00Z"), rowOf(ROW_M, "2026-11-19T01:21:00Z")];
const PAGE_TWO = [rowOf(ROW_P2A, "2026-11-19T01:22:00Z"), rowOf(ROW_P2B, "2026-11-19T01:23:00Z")];
const WIDE = [rowOf(ROW_G, "2026-11-02T01:30:00Z"), rowOf(ROW_H, "2026-11-05T01:20:00Z")];

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

// ── 文件：Blob → 文本 → 逐行逐格 ────────────────────────────────────────────
const blobs = new Map<string, Blob>();
const captured = { name: "", text: "" };

function watchBlobs(): void {
  blobs.clear();
  captured.name = "";
  captured.text = "";
  URL.createObjectURL = ((blob: Blob) => {
    const url = `blob:r267-${blobs.size + 1}`;
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
    // 30d 档：行集不相交的另一页，且不再给游标。
    if (spanOf(target) >= 29) return { items: WIDE, nextCursor: null };
    // 游标激活的第 2 页。
    if (cursorsOf(target).includes(CUR2)) return { items: PAGE_TWO, nextCursor: null };
    return { items: PAGE_ONE, nextCursor: CUR2 };
  });
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  answer();
  watchBlobs();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R267 - the wide window rewrites the file page and all", () => {
  it("hands over the new page whole with nothing of the old left in the file", async () => {
    await render(CUSTOM);
    expect(listReads()).toBe(1);
    expect(paintedRows()).toEqual([ROW_N, ROW_M]);

    // ── 游标激活：翻到第 2 页，整页替换、页码读数跟上 ──
    await clickNodeSync("aud01-load-more", "load more");
    await waitFor(() => listReads() === 2, "the second page was asked");
    expect(paintedRows()).toEqual([ROW_P2A, ROW_P2B]);
    expect(textOf("aud2-page")).toContain("第 2 页");
    expect(cursorsOf(lastListRead())).toEqual([CUR2]);

    // ── 换代：在第 2 页把档位切宽 ──
    await clickNodeSync("aud01-filter-window-30d", "the wider window");
    await waitFor(() => listReads() === 3, "the wider question was asked");
    const wide = lastListRead();
    // 游标清零是 R161 :268-290 的账本本体，这里只顺带确认翻页态下同样清零。
    expect(cursorsOf(wide)).toEqual([]);
    expect(spanOf(wide)).toBeGreaterThanOrEqual(29);
    expect(paintedRows()).toEqual([ROW_G, ROW_H]);
    expect(textOf("aud2-page")).toContain("第 1 页");
    expect(shownCount()).toBe(2);

    // ── 文件必须跟着换代：全新行集，旧四行一字不留 ──
    const ledger = urls();
    const records = await exportRecords();
    expect(records.map((cells) => cells[COL.rid])).toEqual([`req-${ROW_G}`, `req-${ROW_H}`]);
    expect(records).toHaveLength(paintedRows().length);
    expect(shownCount()).toBe(records.length);
    expect(blobs.size).toBe(1);
    for (const stale of [ROW_N, ROW_M, ROW_P2A, ROW_P2B]) {
      expect(captured.text).not.toContain(`req-${stale}`);
    }
    for (const cells of records) {
      expect(cells[COL.actor]).toBe(WHO);
      expect(cells[COL.type]).toBe(ACTION_WORDS);
      expect(cells[COL.object]).toBe(OBJECT);
    }
    // 导出这一击零请求。
    expect(urls()).toEqual(ledger);
    expect(listReads()).toBe(3);
  });
});
