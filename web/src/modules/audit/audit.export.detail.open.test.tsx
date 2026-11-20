// @vitest-environment jsdom
// R245 — 导出与详情打开态的交叉：抽屉开没开、换没换窗，文件只认列表这一份账。
//
// 已覆盖、这里不重写（只回证据，按工单要求）：
// - `audit.detail.fields.parity.test.tsx`（R208）：①的正面早已钉过 —— :335
//   「prints the same words in the row, the detail, the copied line and the file」把同一条记录的
//   时间/actor 名+8 位短码/action 人话/resource 在【行×详情×复制句×文件】四面逐字对过（含抽屉开启
//   时导出），:383 又对缺值四面（actor「未指派」、resource「—」、correlation 尾「—」、CSV 无「同一次
//   操作」列）；时间分秒是前缀梯（R153 持有：屏上到秒、文件到分钟）；
// - `audit.detail.counts.test.tsx`（R222 :305 / R223 :437）：打开态三值三角（读数行==表体==导出行数）
//   与「开着详情导出仍可用、文件里没有详情专属行、导出击零请求」；
// - `audit.export.columns.test.tsx`（R205①）：CSV 行数==表体==aud01-status 的三角本体；
// - `audit.detail.copy.open.test.tsx`（R240③）：关闭后复制件 visible-disabled 与导出==表体；
//   `audit.filter.paging.export.test.tsx`（R243①）：档位钮切换的换代主体。
//
// 本文件只补两枚真正没被拼过的：
// ② 抽屉【开着】时点档位钮把宽窗换成窄窗 —— 详情不关闭、保留旧读数（R229 的形制在 custom-apply
//    语境，按钮档位语境是首次），而导出换代：宽窗多出来的那一行从文件里整行消失；
// ③ 打开前与关闭后各导一次，两份文本【逐字相等】（行集、序、每格内容都不得漂）—— 此前只核过
//    行数/计数，从未把两次捕获的原文摆在一起比。
// 现状登记：工单② 「列表不重取」与现状相悖 —— 换窗是服务端问题，恰重取一次（R161/R243① 持有账本），
// 详情则【不】为换窗再问（detailReads 不变）。

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
const RESOURCE = "ap_1122334455667788";
const DAY = 86_400_000;

const ROW_N = "evt_r245_nova_000001";
const ROW_M = "evt_r245_mike_00000001";
const ROW_G = "evt_r245_golf_000001";
const OLD_DAY_TEXT = "2026-11-02";

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
    action: "task.created",
    occurredAt,
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: RESOURCE },
    requestId: `req-${eventId}`,
  };
}

const NEW_N = rowOf(ROW_N, "2026-11-19T01:20:00Z");
const NEW_M = rowOf(ROW_M, "2026-11-19T01:21:00Z");
const OLD_G = rowOf(ROW_G, `${OLD_DAY_TEXT}T01:30:00Z`);
const ALL = [NEW_N, NEW_M, OLD_G];

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

// ── 文件怎么到手：Blob 在页面这一侧生成 ─────────────────────────────────────
const blobs = new Map<string, Blob>();
const captured: { name: string; text: string } = { name: "", text: "" };

function watchBlobs(): void {
  blobs.clear();
  captured.name = "";
  captured.text = "";
  URL.createObjectURL = ((blob: Blob) => {
    const url = `blob:r245-${blobs.size + 1}`;
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

function exportText(): string {
  return captured.text;
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

const COL_RID = CSV_HEADER.indexOf("请求编号");

function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      const found = ALL.find((row) => paramOf(target, "id") === row.eventId);
      return { audit: found ?? ALL[0] };
    }
    const rows = spanOf(target) >= 29 ? [NEW_N, NEW_M, OLD_G] : [NEW_N, NEW_M];
    return { items: rows, nextCursor: null };
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

describe("R245 - narrowing the window while the drawer stays open", () => {
  it("keeps the open reading, re-asks the list once, and drops the old row from the file", async () => {
    await render("/audit?window=30d&limit=25");
    expect(listReads()).toBe(1);
    expect(paintedRows()).toEqual([ROW_N, ROW_M, ROW_G]);
    await openRecord(ROW_N);
    expect(detailReads()).toBe(1);
    const before = await exportRecords();
    expect(before.map((cells) => cells[COL_RID])).toContain(`req-${ROW_G}`);

    const asks = listReads();
    const drawerReads = detailReads();
    await clickNodeSync("aud01-filter-window-7d", "the 7d tier");
    await waitFor(() => listReads() === asks + 1, "the narrow window was asked for");
    const read = urls()[urls().length - 1] ?? "";
    expect(spanOf(read)).toBeLessThan(29);
    expect(paramOf(read, "window")).toBeNull();
    // 现状登记：工单「列表不重取」≠现状 —— 换窗是服务端问题，恰重取一次（账本归 R161/R243①）。
    expect(listReads()).toBe(2);

    // 抽屉不关闭，并且【保留打开时那一条的旧读数】（R229 的形制，第一次钉在档位钮语境）。
    expect(node("aud02-detail")).not.toBeNull();
    expect(markValue("audJ-time-detail")).toBe("2026-11-19 09:20:00");
    expect(detailReads()).toBe(drawerReads);

    // 导出换代：宽窗多出来的那一行整行消失，剩下的正是窄窗的集合。
    expect(paintedRows()).toEqual([ROW_N, ROW_M]);
    expect(shownCount()).toBe(paintedRows().length);
    const after = await exportRecords();
    expect(after).toHaveLength(2);
    expect(after.map((cells) => cells[COL_RID])).not.toContain(`req-${ROW_G}`);
    expect(exportText()).not.toContain(OLD_DAY_TEXT);
    await closeRecord();
  });
});

describe("R245 - the file the list hands over does not remember the drawer", () => {
  it("prints byte-identical text before opening and after closing, at zero extra asks", async () => {
    await render("/audit?window=7d&limit=25");
    expect(listReads()).toBe(1);
    const before = await exportRecords();
    const beforeText = exportText();
    const ledger = urls();

    await openRecord(ROW_N);
    expect(detailReads()).toBe(1);
    await closeRecord();
    expect(detailReads()).toBe(1);
    expect(listReads()).toBe(1);

    const after = await exportRecords();
    // 逐字相等：行集、序、每一格的内容，打开前后不许漂一个字（此前只比过行数）。
    expect(after).toEqual(before);
    expect(exportText()).toBe(beforeText);
    expect(paintedRows()).toEqual(before.map((cells) => cells[COL_RID]).map((rid) => String(rid).replace(/^req-/, "")));
    expect(shownCount()).toBe(after.length);
    // 两次导出击都零请求：账本只多了开抽屉的那一次详情读。
    expect(urls().length).toBe(ledger.length + 1);
    expect(urls().slice(ledger.length).filter((url) => url.startsWith("/agent-api/api/audit?"))).toHaveLength(0);
  });
});
