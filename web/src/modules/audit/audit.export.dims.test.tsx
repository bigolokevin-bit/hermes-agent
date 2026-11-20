// @vitest-environment jsdom
// R248 — 导出 × actor × window 双维交叉：只有操作者这一维、只有档位窗的时候，文件仍然是表体这一份账。
//
// 已覆盖、这里不重写（只回证据，按工单查重要求）：
// - `audit.export.columns.test.tsx`（R205）：:269 「matches the file, the table and the status line
//   the page reads out」三角本体（CSV 数据行==表体==aud01-status）；:287 「prints the same words in
//   the table cell and in the file, for every column」单事件逐列 表体↔CSV（自定义窗语境、按 rid 定位）；
//   :382 空集 `URL.createObjectURL` 调用数为 0；
// - `audit.filter.counts.test.tsx`（R214 :290 「drops the operator chip at exactly one ask and all
//   three counts move together」）：移除 actor chip 恰 1 次取数 + 三计数重算 —— 但只重算计数，
//   【新文件里到底是哪些行】从未钉过；
// - `audit.list.order.stability.test.tsx`（R236②）：CSV 位置序==表体序（无筛选语境）；
// - `audit.export.empty.test.tsx`（R228）/`audit.error.empty.test.tsx`（R226③）：空态 doors+title、
//   「这个筛选条件里没有审计事件」句子无数字（读数行没有裸 0 —— 工单③的「空态」按现状钉成句子）；
//   `AuditEventsModulePage.test.tsx`（R181①）：页级锚 agent-v2-page-audit 在空态存在；
// - `audit.window.bounds.test.tsx`（R203）：自定义区间与档位互斥、非法区间零取数。
//
// 本文件只补三枚真正没被拼过的：
// ① 纯 actor×档位窗（无 action、无自定义区间）下【逐行、按位置】对 表体 actor 格 ↔ CSV actor 列，
//    并钉首条文件记录与首条上屏记录同源 —— R205② 是单事件按 rid 查找，这里是整表位置序；
// ② 移除 actor chip 之后，文件【换代】：行集换成没有操作者筛选的那一份，旧记录的请求编号在文件里
//    一个都不许出现（计数腿归 R214②，内容腿是首次）；
// ③ 【非法 actor】（不存在的句柄）整链从未钉过：现状是它【会】原样上线当 actorId 问（与非法
//    window 值不发出去不同，R224⑤-family 口径），服务空答 ⇒ 空态句子 + doors + title + 零 Blob + 页级锚。
// 既有口径复跑：档位不上线，只以 from/to 对出现；空态读数行是句子、无数字。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { CSV_HEADER } from "@/modules/audit/csv";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTOR_A = "user:2f3a4b5c6d7e8f90";
const WHO_A = "李思 · 6d7e8f90";
const ACTOR_B = "user:cafe1234beef5678";
const WHO_B = "王五 · beef5678";
const ILLEGAL_ACTOR = "user:deadbeefcafe0000";
const RESOURCE = "ap_1122334455667788";

const ROW_P = "evt_r248_papa_00000001";
const ROW_Q = "evt_r248_quebec_000001";
const ROW_R = "evt_r248_romeo_0000001";
const ROW_S = "evt_r248_sierra_00000001";

const STACKED = `/audit?window=7d&actor=${encodeURIComponent(ACTOR_A)}&limit=25`;
const BROKEN = `/audit?window=7d&actor=${encodeURIComponent(ILLEGAL_ACTOR)}&limit=25`;

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: { type?: string; id?: string; displayName?: string };
  resource: { type?: string; id?: string };
  requestId: string | null;
}

function rowOf(eventId: string, occurredAt: string, handle: string, name: string): Row {
  return {
    eventId,
    action: "task.created",
    occurredAt,
    outcome: "succeeded",
    actor: { type: "human", id: handle, displayName: name },
    resource: { type: "approval", id: RESOURCE },
    requestId: `req-${eventId}`,
  };
}

const NARROW: Row[] = [
  rowOf(ROW_P, "2026-11-19T01:20:00Z", ACTOR_A, "李思"),
  rowOf(ROW_Q, "2026-11-19T01:21:00Z", ACTOR_A, "李思"),
];
const OTHER: Row[] = [
  rowOf(ROW_R, "2026-11-19T01:22:00Z", ACTOR_B, "王五"),
  rowOf(ROW_S, "2026-11-19T01:23:00Z", ACTOR_B, "王五"),
];

function whoOf(eventId: string): string {
  return eventId === ROW_P || eventId === ROW_Q ? WHO_A : WHO_B;
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

function node(testId: string): Element | null {
  return document.querySelector(`[data-testid='${testId}']`);
}

function textOf(testId: string): string {
  return node(testId)?.textContent?.trim() ?? "";
}

/** 表体里那一格的原文：Field 的值只在 dd。 */
function cell(testId: string): string {
  return document.querySelector(`[data-testid='${testId}'] dd`)?.textContent?.trim() ?? "";
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
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
    (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

/** chip 移除的账本用相对基线（R224 教训：同文内合法的重渲染也会加账）。 */
async function removeChipOneAsk(key: string): Promise<void> {
  const asks = listReads();
  const calls = urls().length;
  await clickNode(node(`aud-chip-${key}-clear`), `aud-chip-${key}-clear`);
  await waitFor(() => listReads() === asks + 1, `removing ${key} asks the service once`);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  expect(urls().length, "the removal costs exactly one request in total").toBe(calls + 1);
}

// ── 文件怎么到手：Blob 必须在页面这一侧生成，没生成就该看得见 ────────────────
const blobs = new Map<string, Blob>();
const made = { urls: 0 };
const captured: { name: string; text: string } = { name: "", text: "" };

function watchBlobs(): void {
  blobs.clear();
  captured.name = "";
  captured.text = "";
  made.urls = 0;
  URL.createObjectURL = ((blob: Blob) => {
    made.urls += 1;
    const url = `blob:r248-${blobs.size + 1}`;
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
          if (index + 1 < line.length && line[index + 1] === '"') {
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
  await clickNode(node("aud01-export"), "aud01-export");
  await waitFor(() => captured.text !== "", "the export was handed over");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  return dataLines().map(parseRecord);
}

const COL_ACTOR = CSV_HEADER.indexOf("操作者");
const COL_RID = CSV_HEADER.indexOf("请求编号");

function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    const actorId = paramOf(target, "actorId");
    if (actorId === ACTOR_A) return { items: NARROW, nextCursor: null };
    if (actorId === null) return { items: OTHER, nextCursor: null };
    // 陌生句柄原样上线（与非法 window 值不发出去不同）——服务按它筛，空集回来。
    return { items: [], nextCursor: null };
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

describe("R248 - one actor, one window, and the file follows row by row", () => {
  it("keeps the three counts and puts each row's own operator words in each file row", async () => {
    await render(STACKED);
    expect(listReads()).toBe(1);
    const read = lastListRead();
    expect(paramOf(read, "actorId")).toBe(ACTOR_A);
    // 既有口径：档位不上线，只以 from/to 对出现。
    expect(paramOf(read, "window")).toBeNull();
    expect(paintedRows()).toEqual([ROW_P, ROW_Q]);

    const records = await exportRecords();
    expect(records).toHaveLength(paintedRows().length);
    expect(shownCount()).toBe(paintedRows().length);
    // 逐行、按位置：第 i 条文件记录的 actor 列 == 第 i 条上屏记录的 actor 格。
    const ids = paintedRows();
    expect(records.map((cells) => cells[COL_ACTOR])).toEqual(ids.map((eventId) => whoOf(eventId)));
    // 首行同源：文件第一条就是屏上第一条，不是换序后的第一。
    expect(records[0][COL_RID]).toBe(`req-${ids[0]}`);
    // 裸句柄哪儿都不出现（两侧都只写名+8 位短码）。
    for (const cells of records) expect(cells[COL_ACTOR]).not.toContain(ACTOR_A);
    expect(cell(`aud01-cell-${ROW_P}-actor`)).toBe(WHO_A);
  });
});

describe("R248 - dropping the operator chip re-generates the file, not just the counts", () => {
  it("hands over the new row set with nothing of the filtered page left in it", async () => {
    await render(STACKED);
    expect(paintedRows()).toEqual([ROW_P, ROW_Q]);
    const stale = [`req-${ROW_P}`, `req-${ROW_Q}`];

    await removeChipOneAsk("actor");
    expect(paramOf(lastListRead(), "actorId")).toBeNull();
    expect(paintedRows()).toEqual([ROW_R, ROW_S]);

    const records = await exportRecords();
    // 内容腿（计数腿归 R214②）：文件行集按位置换成换代后的那两份。
    expect(records.map((cells) => cells[COL_RID])).toEqual([`req-${ROW_R}`, `req-${ROW_S}`]);
    expect(records.map((cells) => cells[COL_ACTOR])).toEqual([WHO_B, WHO_B]);
    for (const rid of stale) expect(captured.text).not.toContain(rid);
    expect(shownCount()).toBe(paintedRows().length);
    expect(node("aud-chip-actor")).toBeNull();
  });
});

describe("R248 - an operator the service has never heard of", () => {
  it("is asked for verbatim, answered as an empty set the page can read, with no file built", async () => {
    await render(BROKEN);
    // 现状：非法 actor 与非法 window 值不同 —— 它会原样上线当 actorId 问。
    expect(paramOf(lastListRead(), "actorId")).toBe(ILLEGAL_ACTOR);
    expect(listReads()).toBe(1);
    expect(paintedRows()).toEqual([]);

    // 空态读数行是句子、没有数字（工单③的「空态」按现状钉；honest-0 只在「将导出 0 条」）。
    expect(textOf("aud01-status")).toContain("这个筛选条件里没有审计事件");
    expect(shownCount()).toBe(-1);

    const csv = node("aud01-export") as HTMLButtonElement | null;
    const filtered = node("aud5-export") as HTMLButtonElement | null;
    expect(csv?.disabled).toBe(true);
    expect(csv?.getAttribute("title")).toBe("当前筛选没有可导出的记录");
    expect(filtered?.disabled).toBe(true);
    expect(filtered?.getAttribute("title")).toBe("当前筛选无事件可导出");

    const before = urls();
    await clickNode(csv, "aud01-export");
    await clickNode(filtered, "aud5-export");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(urls()).toEqual(before);
    expect(listReads()).toBe(1);
    expect(made.urls).toBe(0);
    expect(captured.text).toBe("");

    // 页级锚不因为空态而消失。
    expect(
      document.querySelector("[data-testid='agent-v2-page-audit'], #agent-v2-page-audit"),
    ).not.toBeNull();
  });
});
