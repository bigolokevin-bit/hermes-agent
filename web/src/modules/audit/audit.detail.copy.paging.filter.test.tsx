// @vitest-environment jsdom
// R273 — 叠加问句翻进第 2 页之后，两件事必须仍然成立：详情复制句与文件里那一行逐格同源；
// 以及在此刻摘掉操作者 chip，换代必须干净、只多一问。两头单腿早有人钉死，这里只补没被拼过的组合：
//
// 已覆盖、这里不重写（只回证据）：
// - ① 的字节本体：`audit.detail.export.paging.test.tsx`（R258）:284-316 已在【未叠加】的
//   BASE 上钉过【第 2 页 × 开详情复制句 startsWith 秒值+时区、文件到分钟/句子到秒的前缀梯
//   × 同句逐格 actor/类型/对象 toBe × 裸句柄两侧不出现 × 导出行数==表体==aud01-status】。
//   叠加问句的三角（不含第 2 页、不含逐格对读）在 `audit.filter.counts.test.tsx`（R214）① :269-285。
//   本波补的是【?window=7d&actor= 叠加语境 × 第 2 页 × 同句逐格】这条当场线——两头都有、中段没人拼过。
// - ② 净新增：摘 actor chip 的账本腿（恰一重取、三数同落）归 R214② :287-313，但它从第 1 页摘；
//   `aud-chip-actor-clear` 全库只在那一处被点。翻页态（游标激活）下摘 chip 的换代、零旧行、
//   回第 1 页、导出跟着换——从未有人钉。换档侧的换代可参照 `audit.export.paging.sequence.test.tsx`
//   （R267，档位维）与 `audit.filter.paging.export.test.tsx`（R243① :311-345，切档恰一问 :327），
//   下拉摘维复制侧另有 `audit.copy.paging2.test.tsx`（R244① :276-311，操作者下拉维）。
// - ③ 第 2 页 500：`audit.export.window.detail.paging.test.tsx`（R250）② :313-340 钉过
//   【恢复页整页进文件、屏上序、一个数（导出只含成功页、三值相等）】；:286-308 钉过失败态两门关闭、
//   错误面 rid 可复制（:296），并在 :293 登记【工单「保旧行」≠现状：整页替换让失败页清空表体】；
//   重试恰 +1、非并集、游标原样在 `audit.error.test.tsx`（R213）③ :302-326。本波一字不重写。
// - 「序号从 0 重建」：列表没有序号控件，「复制序号」概念不存在（行复制＝开抽屉后的 aud-detail-copy
//   一枚；audC-copy 仅详情独立页 `AuditDetailModulePage.test.tsx` :319-344）。诚实等价＝游标清零、
//   回第 1 页、行集换代完整唯一、计数从头——本 it② 钉的就是这个等价。
//
// 现状口径（不在本波统一）：分页整页替换非并集、每翻恰一问；档位不上线、只以 from/to 对出现
// （R243① :318 口径）；开抽屉会恰一次详情问、列表零新增（R243③ :369-390）；导出反映当前已装载的行。
// 夹具按 actorId/游标换行集、不按窗宽本地再筛——窗内行集以应答为准（服务承诺，R243② 先例）。

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
const ACTOR_B = "user:77aa55cc33ee11ff";
const WHO_B = "周航 · 33ee11ff";
const ACTION = "task.created";
const ACTION_WORDS = "创建任务";
const RESOURCE = "ap_1122334455667788";
const OBJECT = "审批单 · 55667788";
const ZONE = "北京时间（UTC+8）";

const ROW_N = "evt_r273_nova_00000001";
const ROW_M = "evt_r273_mike_00000002";
const ROW_P2A = "evt_r273_papa_00000001";
const ROW_P2B = "evt_r273_kilo_00000002";
const ROW_E = "evt_r273_echo_00000001";
const ROW_F = "evt_r273_foxt_00000001";
const CUR = "cur_r273_page2";

// 7d 快档 + 操作者叠加；窗宽由页面折算成 from/to 上线，夹具按 actorId/游标换行集。
const STACKED = `/audit?window=7d&actor=${encodeURIComponent(ACTOR)}&limit=25`;

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
// 摘掉 chip 之后的「全量」应答：掺一条别的操作者，换代是否干净才看得见。
const UNFILTERED = [
  rowOf(ROW_E, "2026-11-19T01:24:00Z"),
  { ...rowOf(ROW_F, "2026-11-19T01:25:00Z"), actor: { type: "human", id: ACTOR_B, displayName: "周航" } },
];
const ALL_ROWS = [...PAGE_ONE, ...PAGE_TWO, ...UNFILTERED];
const BY_ID = new Map(ALL_ROWS.map((row) => [row.eventId, row]));

const TIME_P2A = "2026-11-19 09:22:00";

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
  await clickNodeSync(`aud01-cell-${eventId}-type`, `row ${eventId}`);
  await waitFor(() => node("aud02-detail") !== null, "the detail pane opened");
}

async function closeRecord(): Promise<void> {
  await clickNodeSync("aud8-back-to-list", "back to the list");
  await waitFor(() => node("aud02-detail") === null, "the detail pane closed");
}

// ── 复制句：开抽屉后点 aud-detail-copy（列表没有独立的行复制钮） ─────────────
const clip = { calls: [] as string[] };

async function copiedLine(): Promise<string> {
  const before = clip.calls.length;
  await clickNodeSync("aud-detail-copy", "copy button");
  await waitFor(() => clip.calls.length > before, "the copy landed");
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
    const url = `blob:r273-${blobs.size + 1}`;
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

const BOM = String.fromCharCode(0xfeff);

function dataLines(): string[] {
  const raw = captured.text;
  const text = raw.startsWith(BOM) ? raw.slice(1) : raw;
  return text
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
  actor: CSV_HEADER.indexOf("操作者"),
  type: CSV_HEADER.indexOf("类型"),
  object: CSV_HEADER.indexOf("对象"),
  rid: CSV_HEADER.indexOf("请求编号"),
};

function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      const id = paramOf(target, "id");
      return { audit: id === null ? null : (BY_ID.get(id) ?? null) };
    }
    // 游标激活的第 2 页（叠加问句下的下一页，以应答为准）。
    if (cursorsOf(target).includes(CUR)) return { items: PAGE_TWO, nextCursor: null };
    // chip 还在：只有这条操作者的两页。
    if (paramOf(target, "actorId") === ACTOR) return { items: PAGE_ONE, nextCursor: CUR };
    // chip 摘掉：换代成不带筛选的应答，行集与旧页不相交。
    return { items: UNFILTERED, nextCursor: null };
  });
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.navigator, "clipboard", {
    value: {
      writeText: async (text: string) => {
        clip.calls.push(text);
      },
    },
    configurable: true,
  });
  clip.calls.length = 0;
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

describe("R273 - the stacked question, page two, and the chip that goes away", () => {
  it("keeps the opened sentence and its own file row one text, two pages deep under the stack", async () => {
    await render(STACKED);
    expect(listReads()).toBe(1);
    expect(paintedRows()).toEqual([ROW_N, ROW_M]);

    // 游标激活：翻进第 2 页（整页替换，每翻恰一问是现状）。
    await clickNodeSync("aud01-load-more", "load more");
    await waitFor(() => listReads() === 2, "the second page was asked");
    expect(paintedRows()).toEqual([ROW_P2A, ROW_P2B]);
    expect(textOf("aud2-page")).toContain("第 2 页");

    // 在第 2 页开详情、复制，再导出——句子和文件里那一行必须逐格同源（R258 的字节本体，
    // 这里只把它搬进 7d&actor 的叠加语境当场核）。
    await openRecord(ROW_P2A);
    const line = await copiedLine();
    expect(line.startsWith(`${TIME_P2A} ${ZONE}`)).toBe(true);

    const ledger = urls();
    const records = await exportRecords();
    const rowA = records.find((cells) => cells[COL.rid] === `req-${ROW_P2A}`);
    expect(rowA, "the opened row in the file").not.toBeUndefined();
    // 文件到分钟、句子到秒：前缀梯按现状钉（分钟/秒阶梯归 R153/R258）。
    expect(line.startsWith(String(rowA?.[COL.time]))).toBe(true);
    expect(rowA?.[COL.actor]).toBe(WHO);
    expect(line).toContain(WHO);
    expect(rowA?.[COL.type]).toBe(ACTION_WORDS);
    expect(line).toContain(ACTION_WORDS);
    expect(rowA?.[COL.object]).toBe(OBJECT);
    expect(line).toContain(OBJECT);
    expect(line).not.toContain(ACTOR);
    expect(line).not.toContain(RESOURCE);

    // 三值当场：导出行数 == 已加载表体 == aud01-status。
    expect(records).toHaveLength(paintedRows().length);
    expect(shownCount()).toBe(records.length);
    expect(records.map((cells) => cells[COL.rid])).toEqual([`req-${ROW_P2A}`, `req-${ROW_P2B}`]);
    // 复制与导出这一路零新增列表问（详情恰一问的账归 R243③，不重写）。
    expect(urls().filter((url) => url.startsWith("/agent-api/api/audit?"))).toHaveLength(2);
    expect(listReads()).toBe(2);
    expect(captured.text).not.toContain("undefined");
    expect(captured.text).not.toContain("null");
    await closeRecord();
    expect(urls().length).toBe(ledger.length);
  });

  it("drops the operator chip mid-pagination at exactly one re-ask, rewrites the page and the file from scratch", async () => {
    await render(STACKED);
    await clickNodeSync("aud01-load-more", "load more");
    await waitFor(() => listReads() === 2, "the second page was asked");
    expect(paintedRows()).toEqual([ROW_P2A, ROW_P2B]);
    expect(cursorsOf(lastListRead())).toEqual([CUR]);

    // ── 换代：在翻页态摘掉操作者 chip（chip 账本本体归 R214② :287-313，那里从第 1 页摘） ──
    const callsBefore = urls().length;
    await clickNodeSync("aud-chip-actor-clear", "the operator chip door");
    await waitFor(() => listReads() === 3, "the unfiltered question was asked");
    expect(urls().length).toBe(callsBefore + 1);

    const read = lastListRead();
    expect(paramOf(read, "actorId")).toBeNull();
    // 「序号从 0 重建」的诚实等价：游标清零、回第 1 页、行集完整换代。
    expect(cursorsOf(read)).toEqual([]);
    expect(paintedRows()).toEqual([ROW_E, ROW_F]);
    expect(textOf("aud2-page")).toContain("第 1 页");
    expect(shownCount()).toBe(paintedRows().length);

    // ── 文件跟着换代：旧四行一字不留，新行集逐位对上屏上 ──
    const ledger = urls();
    const records = await exportRecords();
    expect(records.map((cells) => cells[COL.rid])).toEqual([`req-${ROW_E}`, `req-${ROW_F}`]);
    expect(records).toHaveLength(paintedRows().length);
    expect(shownCount()).toBe(records.length);
    for (const stale of [ROW_N, ROW_M, ROW_P2A, ROW_P2B]) {
      expect(captured.text).not.toContain(`req-${stale}`);
    }
    expect(records.map((cells) => cells[COL.actor])).toEqual([WHO, WHO_B]);
    expect(blobs.size).toBe(1);
    // 导出零请求。
    expect(urls()).toEqual(ledger);
    expect(listReads()).toBe(3);
  });
});
