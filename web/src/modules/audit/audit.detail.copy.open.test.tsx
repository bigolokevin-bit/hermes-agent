// @vitest-environment jsdom
// R240 — 详情打开态下的复制与导出同源：深链定位的那条记录，复制出去的那句话与文件里
// 那一行必须是同一串字；档位换宽时抽屉里读到的仍是它自己那次读数；收起来之后，复制门
// 站着但不开，文件依旧只是列表。
//
// 已覆盖、这里不重写（只回证据）：
// - `audit.detail.crossfilter.test.tsx`（R201 it1）钉住冷定位 + 筛选叠加下行×详情×复制
//   三面逐字 —— 但没有 CSV 这一面；
// - `audit.detail.counts.test.tsx`（R222）钉住开/关三角不变、收起后复制件 visible-disabled、
//   定位态行×详情逐字与地址保留、详情 500 三腿、（R223）开着详情导出只来自列表；
// - `audit.actor.copy.test.tsx`（R235 it②）钉住 actor 语境下复制句与 CSV 行直接同源 ——
//   但没有 `?event=` 定位态；
// - `audit.deeplink.test.tsx`（R113）钉住定位 found/missing/收起三段的地址与请求账本；
// - `audit.time.test.tsx`（R153）持有【屏上到秒、文件到分钟】的精度阶梯；
// - `audit.window.parity`（R229 it②）钉住自定义区间应用后【开着不动的详情保留旧读数】。
//
// 本文件只补真正没被拼过的：
// ① 冷定位态（?event=，展开后）复制句 ↔ CSV 同一行四段逐字（时间按前缀梯、操作者/类型/
//    对象三段同词、裸句柄零出现）；
// ② 档位按钮把窗换宽时，现状三腿一起钉：列表恰重取一次（窗口是服务端问题）、抽屉不为换窗
//    再问也不换代（保留自己那次读数）、读数行随之重算 —— 工单承诺的【复制换代 / 列表不重取 /
//    aud01-status 不变】与现状相悖，按现状钉并登记；
// ③ `?event=` 语境收起后：复制门 visible-disabled（工单「隐去」≠现状），导出【表体行数 ==
//    读数行 == 文件数据行】三值三角在定位语境第一次对账，且导出前后零新增请求。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { CSV_HEADER } from "@/modules/audit/csv";
import { DETAIL_COPY_DISABLED_TITLE } from "@/modules/audit/detailCopy";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTOR = "user:2f3a4b5c6d7e8f90";
const WHO = "李思 · 6d7e8f90";
const ACTION = "task.created";
const ACTION_WORDS = "创建任务";
const RESOURCE = "ap_1122334455667788";
const OBJECT = "审批单 · 55667788";
const ZONE = "北京时间（UTC+8）";
const DAY = 86_400_000;

const NEW_N = "evt_r240_nova_000001";
const NEW_M = "evt_r240_mike_00000001";
const OLD_G = "evt_r240_golf_000001";

const TIME_N = "2026-11-19 09:20:00";
const TIME_N_FILE = "2026-11-19 09:20";

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

const NEW_N_ROW = rowOf(NEW_N, "2026-11-19T01:20:00Z");
const NEW_M_ROW = rowOf(NEW_M, "2026-11-19T01:21:00Z");
const OLD_G_ROW = rowOf(OLD_G, "2026-11-02T01:30:00Z");
const ALL = [NEW_N_ROW, NEW_M_ROW, OLD_G_ROW];

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

/** Field 的面：值只落在 dd。 */

function markValue(testId: string): string {
  return String(node(testId)?.getAttribute("data-audj-value") ?? "");
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
const detailReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length;

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}

/** 线路上的区间跨度（天）——档位不上线，只以 from/to 对出现（既有口径）。 */
function spanOf(url: string): number {
  const from = Date.parse(String(paramOf(url, "from")));
  const to = Date.parse(String(paramOf(url, "to")));
  return Number.isNaN(from) || Number.isNaN(to) ? -1 : (to - from) / DAY;
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
    (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
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

// ── 复制到哪儿去了：剪贴板落在页这一侧 ──────────────────────────────────────
const clip = { calls: [] as string[] };

function stubClipboard(): void {
  clip.calls = [];
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window, "navigator", {
    configurable: true,
    value: {
      clipboard: {
        writeText: (text: string) => {
          clip.calls.push(text);
          return Promise.resolve();
        },
      },
    },
  });
}

async function copiedLine(): Promise<string> {
  const grew = clip.calls.length + 1;
  await clickNodeSync("aud-detail-copy", "copy this event");
  await waitFor(() => clip.calls.length >= grew, "the clipboard was handed the sentence");
  return clip.calls[clip.calls.length - 1] ?? "";
}

// ── 文件怎么到手：Blob 在页面这一侧生成 ─────────────────────────────────────
const blobs = new Map<string, Blob>();
const captured = { name: "", text: "" };

function watchBlobs(): void {
  blobs.clear();
  captured.name = "";
  captured.text = "";
  URL.createObjectURL = ((blob: Blob) => {
    const url = `blob:r240-${blobs.size + 1}`;
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
      const found = ALL.find((row) => paramOf(target, "id") === row.eventId);
      return { audit: found ?? ALL[0] };
    }
    const rows = spanOf(target) >= 29 ? [NEW_N_ROW, NEW_M_ROW, OLD_G_ROW] : [NEW_N_ROW, NEW_M_ROW];
    return { items: rows, nextCursor: null };
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

describe("R240 - the located record copies what the file prints", () => {
  it("says the same words in the copied sentence and in the row of the file", async () => {
    await render(`/audit?window=7d&event=${NEW_N}`);
    expect(listReads()).toBe(1);
    await waitFor(() => node("aud9-deeplink-found") !== null, "the row was located");
    await openRecord(NEW_N);
    expect(detailReads()).toBe(1);
    const line = await copiedLine();
    const records = await exportRecords();
    const index = records.findIndex((cells) => cells[COL.rid] === `req-${NEW_N}`);
    expect(index, "the located event reached the file").toBeGreaterThan(-1);
    const cells = records[index];
    // 精度阶梯按现状：文件到分钟、屏上到秒（R153 持有这一口径，这里只对齐两面的那一行）
    expect(cells[COL.time]).toBe(TIME_N_FILE);
    expect(TIME_N.startsWith(cells[COL.time])).toBe(true);
    // 现状口径（R153 持有）：复制句到秒、文件到分钟 —— 文件那一格是复制句的前缀，
    // 两处不是同一串逐字，而是同一读数的两种精度；这里钉前缀梯而不是伪造逐字相等。
    expect(line.startsWith(`${TIME_N} ${ZONE}`)).toBe(true);
    expect(line.startsWith(cells[COL.time])).toBe(true);
    // 操作者、类型、对象三段：文件那一格就是复制句里那几个字
    expect(cells[COL.actor]).toBe(WHO);
    expect(line).toContain(WHO);
    expect(cells[COL.type]).toBe(ACTION_WORDS);
    expect(line).toContain(ACTION_WORDS);
    expect(cells[COL.object]).toBe(OBJECT);
    expect(line).toContain(OBJECT);
    // 裸句柄哪儿都不许出现 —— 复制句里也不该有
    expect(line).not.toContain(ACTOR);
    expect(line).not.toContain(RESOURCE);
    await closeRecord();
  });
});

describe("R240 - widening the window while the drawer is open", () => {
  it("re-asks the list once, while the drawer keeps its own reading", async () => {
    await render("/audit?window=7d");
    expect(paintedRows()).toEqual([NEW_N, NEW_M]);
    await openRecord(NEW_N);
    const line1 = await copiedLine();
    expect(line1).toContain(TIME_N);
    const callsBefore = urls().length;
    await clickNodeSync("aud01-filter-window-30d", "wider tier");
    await waitFor(() => listReads() === 2, "the list re-asked once");
    // 现状登记：窗口是服务端问题，列表必须重取一次（R161/R212 的既有阶梯）；
    // 工单承诺【列表不重取 / 复制换代 / 读数行不变】与现状相悖，这里按现状钉死。
    const read = urls()[urls().length - 1] ?? "";
    expect(spanOf(read)).toBeGreaterThanOrEqual(29);
    expect(paramOf(read, "window")).toBeNull();
    expect(detailReads()).toBe(1); // 抽屉不为换窗再问一次
    expect(markValue("audJ-time-detail")).toBe(TIME_N); // 也不换代：保留自己那次读数
    const line2 = await copiedLine();
    expect(line2).toBe(line1);
    // 列表侧换了宽窗的答案：旧行回到表体，读数行诚实重算（不是「不变」）
    expect(paintedRows()).toEqual([NEW_N, NEW_M, OLD_G]);
    expect(shownCount()).toBe(3);
    expect(textOf("aud01-status")).toContain("已显示 3 条");
    expect(urls().length).toBe(callsBefore + 1); // 只多了那一次列表问
    await closeRecord();
  });
});

describe("R240 - folded away, the copy door stands there shut", () => {
  it("leaves the copy control visible but disabled and hands over just the list", async () => {
    await render(`/audit?window=7d&event=${NEW_N}`);
    await waitFor(() => node("aud9-deeplink-found") !== null, "the row was located");
    await openRecord(NEW_N);
    await closeRecord();
    // 现状：收起后复制门仍在，只是不开 —— 工单「隐去」与现状相悖，按现状钉
    const door = node("aud-detail-copy") as HTMLButtonElement | null;
    expect(door).not.toBeNull();
    expect(door?.disabled).toBe(true);
    expect(door?.getAttribute("title")).toBe(DETAIL_COPY_DISABLED_TITLE);
    const calls = urls();
    const asks = listReads();
    const records = await exportRecords();
    // 导出前后零新增请求（账本逐字）
    expect(urls()).toEqual(calls);
    expect(listReads()).toBe(asks);
    // 定位语境下三值三角第一次对账：文件数据行 == 表体 == 读数行
    expect(records).toHaveLength(paintedRows().length);
    expect(shownCount()).toBe(paintedRows().length);
  });
});
