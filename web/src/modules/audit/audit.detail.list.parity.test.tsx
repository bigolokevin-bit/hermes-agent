// @vitest-environment jsdom
// R227 — 详情与列表同值的扩展护栏。工单①②的大部分承诺早已在道，这里只补真正没拼过的角，
// 并把口径差登记在纸面上：
//
// 已覆盖、只回证据（不重写）：
// - `audit.parity.test.tsx`（R137）八例整体持有一、②的三面同词与缺值梯子 —— 但它挂载的是
//   `?window=7d&detail=<id>` 这种地址直开形，没在「档位+动作+操作者」叠加语境下拼过；
// - `audit.detail.requests.test.tsx`（R196）持有开=恰 +1 次详情读、关=零请求、地址只删记录键；
// - `audit.detail.crossfilter.test.tsx`（R201 it3）与 `audit.detail.fields.parity.test.tsx`
//   （R208 it③）持有开合账本与 `aud01-status` 逐字不变（R208 裸地址、R201 全参自定义窗）；
// - `audit.detail.counts.test.tsx`（R222 it①②）持有叠窗三值三角与关闭后 aud-detail-copy 回到
//   未选中态（visible-disabled + DETAIL_COPY_DISABLED_TITLE）；
// - `audit.deeplink.test.tsx`（R113）持有冷定位零详情读与 GONE 的 404 句+rid。
//
// 口径差登记（现状，不在本波统一）：
// (a) 详情的线路参是 `?id=`，`?event=` 只是深链地址键 —— 工单②「+1 次 ?event=」按现状钉成
//     「恰 +1 次带 id= 的详情读」；冷定位那条例外（零详情读）归 R113。
// (b) 时间屏上到秒、文件到分钟，钉成前缀一致（R153/R205 持有口径）。
//
// 本波净新增：
// ① 档位+动作+操作者叠加语境下，行×详情×复制行三面同词一起过一遍；
// ③ 行点开详情遇 404：详情面给可读句+可复制 rid，列表行与地址逐字保留（R113 只钉冷深链 404，
//    R222 it④ 只钉 500 的计数不钉地址）；
// ④ 同一叠加语境下 表体↔CSV 六列逐字 + 导出击 urls 账本逐字（R205 用自定义窗，没在档位叠
//    actor/action 时拼过逐列）。

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { CSV_HEADER } from "@/modules/audit/csv";
import { DETAIL_COPY_DISABLED_TITLE } from "@/modules/audit/detailCopy";
import { ApiError } from "@/lib/api-error";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTOR = "user:2f3a4b5c6d7e8f90";
const WHO = "李思 · 6d7e8f90";
const ACTION = "task.created";
const ACTION_WORDS = "创建任务";
const OUTCOME_WORDS = "成功";
const RESOURCE = "ap_1122334455667788";
const OBJECT = "审批单 · 55667788";
const FIRST = "evt_r227_first_000001";
const SECOND = "evt_r227_second_000001";
const RID_404 = "rid-r227-404";
// 档位+动作+操作者：R137 从未用过的叠加语境（它用 7d+detail= 地址直开）。
const STACK = `/audit?window=30d&type=${ACTION}&actor=${encodeURIComponent(ACTOR)}`;

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: { type?: string; id?: string; displayName?: string };
  resource: { type?: string; id?: string };
  requestId: string | null;
}

function rowOf(eventId: string, index: number): Row {
  return {
    eventId,
    action: ACTION,
    occurredAt: `2026-11-19T01:2${index}:00Z`,
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: RESOURCE },
    requestId: `req-${eventId}`,
  };
}

const ROWS: Row[] = [rowOf(FIRST, 0), rowOf(SECOND, 1)];

const mode = { failDetail404: false };

function notFound(url: string): ApiError {
  return new ApiError("not found", {
    status: 404,
    body: JSON.stringify({ code: "console.not_found" }),
    url,
    requestId: RID_404,
  });
}

function answer(): void {
  api.fetchJSON.mockImplementation(async (path) => {
    const target = String(path);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      if (mode.failDetail404) throw notFound(target);
      const id = paramOf(target, "id");
      return { audit: ROWS.find((item) => item.eventId === id) ?? ROWS[0] };
    }
    return { items: ROWS, nextCursor: null };
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

function Probe(): ReactNode {
  const location = useLocation();
  return <div data-testid="probe-location" data-search={location.search} />;
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
        <Probe />
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

function fieldValue(testId: string): string {
  return document.querySelector(`[data-testid='${testId}'] dd`)?.textContent?.trim() ?? "";
}

function markValue(testId: string): string {
  return document.querySelector(`[data-testid='${testId}']`)?.getAttribute("data-audj-value") ?? "";
}

/** Field 在表体里的那一格：值在 dd。 */
function cell(testId: string): string {
  return document.querySelector(`[data-testid='${testId}'] dd`)?.textContent?.trim() ?? "";
}

/** 结果徽章的人话：holder 里第一个 data-slot。 */
function badge(testId: string): string {
  const holder = node(testId);
  return holder?.querySelector("[data-slot]")?.textContent?.trim() ?? holder?.textContent?.trim() ?? "";
}

/** 复制件的可读一半：CopyValue 的值在内层 span。 */
function face(testId: string): string {
  return document.querySelector(`[data-testid='${testId}'] > span`)?.textContent?.trim() ?? "";
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
const detailReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length;
const lastDetailRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit-detail")) ?? "";

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

function pairs(): string[] {
  const search = node("probe-location")?.getAttribute("data-search") ?? "";
  return Array.from(new URLSearchParams(search).entries())
    .map(([key, value]) => `${key}=${decodeURIComponent(value)}`)
    .sort();
}

function shownCount(): number {
  const digits = /(\d+)/.exec(textOf("aud01-status"));
  return digits ? Number(digits[1]) : -1;
}

function exportCountDigits(): number {
  const digits = /(\d+)/.exec(textOf("aud5-export-count"));
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

async function openRecord(id: string): Promise<void> {
  await clickNode(node(`aud01-cell-${id}-type`), `aud01-cell-${id}-type`);
  await waitFor(() => node("aud02-detail") !== null, "detail opened");
}

async function closeRecord(): Promise<void> {
  await clickNode(node("aud8-back-to-list"), "aud8-back-to-list");
  await waitFor(() => node("aud02-detail") === null, "detail closed");
}

// ── 复制行 ────────────────────────────────────────────────────────────────
const clip = { calls: [] as string[] };

function stubClipboard(): void {
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: async (text: string) => {
        clip.calls.push(text);
      },
    },
    configurable: true,
  });
}

async function copiedLine(): Promise<string> {
  const grew = clip.calls.length + 1;
  await clickNode(node("aud-detail-copy"), "aud-detail-copy");
  await waitFor(() => clip.calls.length >= grew, "the copy landed");
  return clip.calls[clip.calls.length - 1];
}

// ── 文件怎么到手 ──────────────────────────────────────────────────────────
const blobs = new Map<string, Blob>();
const captured = { name: "", text: "" };

function watchBlobs(): void {
  blobs.clear();
  captured.name = "";
  captured.text = "";
  URL.createObjectURL = ((blob: Blob) => {
    const url = `blob:r227-${blobs.size + 1}`;
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

async function exportFile(): Promise<{ head: string; rows: string[][] }> {
  captured.text = "";
  await clickNode(node("aud01-export"), "aud01-export");
  await waitFor(() => captured.text !== "", "the export was handed over");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  const head = captured.text.replace(/^\uFEFF/, "").split("\r\n")[0];
  return { head, rows: dataLines().map(parseRecord) };
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
  mode.failDetail404 = false;
  clip.calls = [];
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

describe("R227 ① - the stacked tier question keeps the three faces in one voice", () => {
  it("prints the same words in the row, the panel and the copied line", async () => {
    await render(STACK);
    // 档位叠筛选确实上了线：actor 走 actorId、动作走 action、档位化为 from/to 对（R161/R208）
    const read = urls().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";
    expect(paramOf(read, "actorId")).toBe(ACTOR);
    expect(paramOf(read, "action")).toBe(ACTION);
    expect(paramOf(read, "window")).toBeNull();
    await openRecord(FIRST);
    // 时间：列表标记与详情标记同一串（到秒）
    expect(markValue(`audJ-time-list-${FIRST}`)).toBe("2026-11-19 09:20:00");
    expect(markValue("audJ-time-detail")).toBe(markValue(`audJ-time-list-${FIRST}`));
    // actor：显示名 + 8 位短码，三面同一串
    expect(cell(`aud01-cell-${FIRST}-actor`)).toBe(WHO);
    expect(markValue("audJ-actor-detail")).toBe(WHO);
    expect(fieldValue("audA-detail-actor")).toBe(WHO);
    // 动作人话与对象：三面同词
    expect(textOf("audA-detail-type")).toContain(ACTION_WORDS);
    expect(fieldValue("audA-detail-resource")).toBe(OBJECT);
    const line = await copiedLine();
    expect(line).toContain("2026-11-19 09:20:00");
    expect(line).toContain(WHO);
    expect(line).toContain(ACTION_WORDS);
    expect(line).toContain(OBJECT);
    // 裸句柄哪儿都不许出现
    for (const text of [cell(`aud01-cell-${FIRST}-actor`), fieldValue("audA-detail-actor"), line]) {
      expect(text).not.toContain(ACTOR);
      expect(text).not.toContain(RESOURCE);
    }
  });
});

describe("R227 ② - the open/close ledger, pinned as shipped", () => {
  it("costs exactly one id= read and leaves the list untouched", async () => {
    await render(STACK);
    const statusBefore = textOf("aud01-status");
    const rowsBefore = paintedRows();
    const callsBefore = urls().length;
    expect(detailReads()).toBe(0);
    await openRecord(FIRST);
    // 口径差 (a)：详情线路参是 id= —— 工单写的 ?event= 只是深链地址键（R113/R196 持有）
    expect(detailReads()).toBe(1);
    expect(paramOf(lastDetailRead(), "id")).toBe(FIRST);
    expect(listReads()).toBe(1);
    expect(urls().length).toBe(callsBefore + 1);
    await closeRecord();
    expect(detailReads()).toBe(1);
    expect(listReads()).toBe(1);
    expect(urls().length).toBe(callsBefore + 1);
    expect(paintedRows()).toEqual(rowsBefore);
    expect(textOf("aud01-status")).toBe(statusBefore);
    // 关闭后回到未选中态：复制钮可见但禁用（R222 it② 持有该现状）
    const copy = node("aud-detail-copy") as HTMLButtonElement | null;
    expect(copy).not.toBeNull();
    expect(copy?.disabled).toBe(true);
    expect(copy?.getAttribute("title")).toBe(DETAIL_COPY_DISABLED_TITLE);
  });
});

describe("R227 ③ - a detail that answers 404 leaves the list and the address alone", () => {
  it("keeps rows, filters and the trace id readable when the panel fails", async () => {
    mode.failDetail404 = true;
    await render(STACK);
    const addressBefore = pairs();
    const rowsBefore = paintedRows();
    const readsBefore = listReads();
    await clickNode(node(`aud01-cell-${FIRST}-type`), `aud01-cell-${FIRST}-type`);
    // 现状钉法：详情面出现一块失败面板（error 或 denied，按现场形状），列表与地址纹丝不动
    await waitFor(() => {
      const faces = Array.from(document.querySelectorAll("[data-testid]"))
        .map((element) => String(element.getAttribute("data-testid")))
        .filter((testId) => testId.startsWith("aud02-detail-") && testId !== "aud02-detail");
      return faces.length > 0;
    }, "a failure face took over the detail area");
    expect(document.body.textContent ?? "").toContain(RID_404);
    // rid 可复制：请求编号复制件在场
    const copyRid = Array.from(document.querySelectorAll("[data-testid]")).some((element) =>
      String(element.getAttribute("data-testid")).endsWith("-request-id-value"),
    );
    expect(copyRid).toBe(true);
    // 列表腿不重取、行还在、地址逐字不动
    expect(listReads()).toBe(readsBefore);
    expect(paintedRows()).toEqual(rowsBefore);
    expect(shownCount()).toBe(rowsBefore.length);
    // 现状：打开记录会在地址上写一枚 detail=（R196 持有），筛选参逐字不动
    expect(pairs()).toEqual([...addressBefore, `detail=${FIRST}`].sort());
  });
});

describe("R227 ④ - under the same stacked question the file prints the row's own words", () => {
  it("matches table cells column by column and asks nothing to export", async () => {
    await render(STACK);
    const before = urls();
    const file = await exportFile();
    // 导出零新增请求（档位叠筛选语境，R205 的同类腿用的是自定义窗）
    expect(urls()).toEqual(before);
    expect(listReads()).toBe(1);
    // 列头逐字锁现状（R192/R205① 持有口径，这里只在新语境再过一遍）
    expect(file.head).toBe(CSV_HEADER.join(","));
    expect(file.rows).toHaveLength(paintedRows().length);
    expect(exportCountDigits()).toBe(file.rows.length);
    for (const row of ROWS) {
      const record = file.rows.find((line) => line[COL.rid] === `req-${row.eventId}`);
      expect(record, `the file carries ${row.eventId}`).toBeDefined();
      const found = record as string[];
      // 时间：屏上到秒、文件到分钟 —— 前缀一致（口径差 (b)，R153 持有）
      expect(cell(`aud01-cell-${row.eventId}-time`).startsWith(found[COL.time])).toBe(true);
      expect(cell(`aud01-cell-${row.eventId}-actor`)).toBe(found[COL.actor]);
      expect(found[COL.actor]).toBe(WHO);
      expect(found[COL.type]).toBe(ACTION_WORDS);
      expect(badge(`aud01-cell-${row.eventId}-result`)).toBe(OUTCOME_WORDS);
      expect(found[COL.result]).toBe(OUTCOME_WORDS);
      expect(cell(`aud01-cell-${row.eventId}-object`)).toBe(found[COL.object]);
      expect(found[COL.object]).toBe(OBJECT);
      expect(face(`aud01-cell-${row.eventId}-request-value`)).toBe(found[COL.rid]);
    }
    // 裸句柄不进文件
    expect(captured.text).not.toContain(ACTOR);
    expect(captured.text).not.toContain(RESOURCE);
  });
});
