// @vitest-environment jsdom
// R251 — 导出与详情跨窗口一致性：抽屉是读数，不是导出域的一部分；换窗每一跳恰一问，
// 往返回到同一份文件。
//
// 已覆盖、这里不重写（只回证据，文件:行 = audit.export.detail.open.test.tsx，tip ab4a942b/a52be295）：
// - R245 it :298 「keeps the open reading, re-asks the list once, and drops the old row from
//   the file」——抽屉开着做窄化（30d→7d），文件去掉宽窗那一行；
// - R245 it :334 「prints byte-identical text before opening and after closing, at zero extra
//   asks」——开抽屉前 vs 关闭后的两次导出逐字相等；
// - R247 it :360 「gives the file the wider set while the open drawer keeps its frozen
//   reading」——宽换时文件【含】req-golf（toContain），抽屉冻结在旧读数（现状：换窗不换代）；
// - R247 it :404 详情 500 期间导出只认列表账；
// - R238 :22 单向换窗的四载体换代；R196/R240③ 无换档开合账本。
//
// 本文件只补真正没拼过的三处：
// ① 抽屉开着换到宽窗后，文件与表体【按位置逐行同序】（R247 只钉了 toContain）；
// ② 【开态】导出与【关闭后】导出逐字相等（R245 比的是「打开前 vs 关闭后」；详情不改变导出域）；
// ③ 7d→30d→7d 往返：终局 CSV 与首站逐字 toEqual、每一跳恰一次列表取数（从未钉过）。
// 现状口径照旧登记：档位不上线路（只有 from/to 对）；换窗时抽屉冻结旧读数（不为换窗再问）。

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
const ACTION = "task.created";
const RESOURCE = "ap_1122334455667788";
const BASE = "/audit?window=7d&limit=25";

const ROW_N = "evt_r251_nova_000001";
const ROW_M = "evt_r251_mike_00000001";
const ROW_G = "evt_r251_golf_000001";

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

const NARROW = [rowOf(ROW_N, "2026-11-19T01:20:00Z"), rowOf(ROW_M, "2026-11-19T01:21:00Z")];
// 宽窗行集 = 窄窗 + 一条只有 30d 才够得到的旧事件（DISJOINT 残差让换代可见）。
const WIDE = [...NARROW, rowOf(ROW_G, "2026-11-02T01:30:00Z")];

let root: Root | null = null;

function answer(): void {
  api.fetchJSON.mockImplementation(async (path) => {
    const target = String(path);
    const params = new URL(target, "http://console.test").searchParams;
    if (target.startsWith("/agent-api/api/audit-detail")) {
      const found = WIDE.find((row) => row.eventId === params.get("id"));
      return { audit: found ?? WIDE[0] };
    }
    const from = Date.parse(params.get("from") ?? "");
    const to = Date.parse(params.get("to") ?? "");
    const spanDays = (to - from) / 86_400_000;
    // 档位不上线路：7d/30d 都表现为 from/to 对（既有口径，R161/R208/R238）。
    return spanDays >= 29 ? { items: WIDE, nextCursor: null } : { items: NARROW, nextCursor: null };
  });
}

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

function spanOf(url: string): number {
  const from = Date.parse(paramOf(url, "from") ?? "");
  const to = Date.parse(paramOf(url, "to") ?? "");
  return (to - from) / 86_400_000;
}

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

function shownCount(): number {
  const digits = /(\d+)/.exec(node("aud01-status")?.textContent ?? "");
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
  await waitFor(() => node("aud02-detail") !== null, "the detail painted");
}

async function closeRecord(): Promise<void> {
  await clickNodeSync("aud8-back-to-list", "back to the list");
  await waitFor(() => node("aud02-detail") === null, "the drawer folded away");
}

// ── 文件怎么到手：Blob 计数 + 锚点点击捕获 ──────────────────────────────────
const blobs = new Map<string, Blob>();
const made = { urls: 0 };
const captured = { name: "", text: "" };

function watchBlobs(): void {
  blobs.clear();
  captured.name = "";
  captured.text = "";
  made.urls = 0;
  URL.createObjectURL = ((blob: Blob) => {
    made.urls += 1;
    const url = `blob:r251-${blobs.size + 1}`;
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

const exportText = (): string => captured.text;
const COL_RID = CSV_HEADER.indexOf("请求编号");

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

describe("R251 - the widened file keeps the screen's own order", () => {
  it("exports while the drawer is open, row for row, in table order", async () => {
    await render(BASE);
    expect(paintedRows()).toEqual([ROW_N, ROW_M]);
    await openRecord(ROW_N);
    expect(detailReads()).toBe(1);

    const asks = listReads();
    await clickNodeSync("aud01-filter-window-30d", "the 30d tier");
    await waitFor(() => listReads() === asks + 1, "the wide window was asked for");
    // 每一跳恰一问（账本归 R161/R243①）；档位本身不上线路。
    const read = lastListRead();
    expect(spanOf(read)).toBeGreaterThanOrEqual(29);
    expect(paramOf(read, "window")).toBeNull();
    expect(paintedRows()).toEqual([ROW_N, ROW_M, ROW_G]);

    const records = await exportRecords();
    // 净新增：位置逐行同序（R247 :360 只钉了 toContain）。
    expect(records).toHaveLength(paintedRows().length);
    expect(shownCount()).toBe(records.length);
    expect(records.map((cells) => cells[COL_RID])).toEqual(
      paintedRows().map((eventId) => `req-${eventId}`),
    );
    // 首行==新窗屏上首行；旧窗之外没有多出来的行。
    expect(records[0][COL_RID]).toBe(`req-${ROW_N}`);
  });
});

describe("R251 - the open drawer does not change the file's domain", () => {
  it("hands the same bytes while open and after closing, asking nothing on the way", async () => {
    await render(BASE);
    await openRecord(ROW_N);
    const openRecords = await exportRecords();
    const openText = exportText();
    const ledger = urls();
    const asks = listReads();

    // 无换档语境关闭零请求（本体归 R245②/R196；换档补问的例外见 R247 :388）。
    await closeRecord();
    expect(listReads()).toBe(asks);
    expect(detailReads()).toBe(1);

    const after = await exportRecords();
    // 净新增：R245 比的是「打开前 vs 关闭后」；这里钉「开态 vs 关闭后」逐字。
    expect(after).toEqual(openRecords);
    expect(exportText()).toBe(openText);
    expect(urls()).toEqual(ledger);
  });
});

describe("R251 - a round trip returns the same file", () => {
  it("asks once per hop and lands byte-identical to where it started", async () => {
    await render(BASE);
    const first = await exportRecords();
    const firstText = exportText();
    expect(first).toHaveLength(2);

    const a1 = listReads();
    await clickNodeSync("aud01-filter-window-30d", "the 30d tier");
    await waitFor(() => listReads() === a1 + 1, "the wide hop asked once");
    expect(spanOf(lastListRead())).toBeGreaterThanOrEqual(29);

    const a2 = listReads();
    await clickNodeSync("aud01-filter-window-7d", "the 7d tier");
    await waitFor(() => listReads() === a2 + 1, "the narrow hop asked once");
    expect(spanOf(lastListRead())).toBeLessThan(29);
    expect(paramOf(lastListRead(), "window")).toBeNull();
    expect(paintedRows()).toEqual([ROW_N, ROW_M]);

    const back = await exportRecords();
    // 净新增：往返终局与首站逐字相等（此前只有单向换代钉子）。
    expect(back).toEqual(first);
    expect(exportText()).toBe(firstText);
    expect(shownCount()).toBe(back.length);
  });
});
