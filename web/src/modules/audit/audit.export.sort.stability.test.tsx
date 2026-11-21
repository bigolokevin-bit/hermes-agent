// @vitest-environment jsdom
// R266 — 排序翻转与导出/复制的同序：屏上翻一页，文件就跟着翻同一页；两个文件互不残留。
//
// 已覆盖、这里不重写（只回证据，文件:行）：
// - `audit.sort.filter.test.tsx:147-181`（R190①）钉住了切排序本体：点击 时间 写 asort/adir、
//   aria-sort 三态循环、行序精确翻转（缺值两向恒末）、清回服务原序，且 listReads 不变、
//   请求 URL 从不带 asort/adir/sort/order ——工单②「切排序零额外取数（本地维）」已全覆盖，
//   本文件只把【翻转×导出账本】这条缝折进导出用例，不写独立重复用例；
// - `audit.list.order.stability.test.tsx:364-409`（R236②）钉住了【默认服务序】下表体序==
//   文件位置序、首行居首、复制与导出零请求；本文件补的是【翻转后】的同序；
// - `sorting.test.ts:66-74` 钉住了纯函数层的并列稳定：并列行 asc/desc 都按入选原序 t1,t2,t3；
//   本文件把它长到 DOM×CSV×复制句三面；
// - 排序是本地维：`sorting.ts` 头注记录了 9122 带 sort/order 参探测 401 console.unauthenticated、
//   8092 404 console.not_found，账本读口 /api/audit 从不发排序参（现状钉，不弱化）。
// - 「复制序号」口径登记：列表上不存在行级复制钮与序号（行复制＝开抽屉后的 aud-detail-copy
//   一枚；audC-copy 仅详情独立页 `AuditDetailModulePage.test.tsx:319-344`）。工单③的
//   「复制序号同序」按现状钉诚实等价：并列行的复制句各守其句，asc 与 desc 之后逐字相同。
//
// 夹具口径：两条并列行共享同一时刻、不同操作者，复制句才有可辨的字节；服务按窗口原样回行
// 是承诺（R243② 同款登记）。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { CSV_HEADER } from "@/modules/audit/csv";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOVA_ID = "evt_r266_nova_00000001";
const MIKE_ID = "evt_r266_mike_00000002";
const TIE_A_ID = "evt_r266_tie_a_00000001";
const TIE_B_ID = "evt_r266_tie_b_00000002";
const TIE_AT = "2026-11-19T01:22:00Z";
const ZHOU = "周航 · 33ee11ff";

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: { type?: string; id?: string; displayName?: string };
  resource: { type?: string; id?: string };
  requestId: string | null;
}

function rowOf(eventId: string, occurredAt: string, over: Partial<Row> = {}): Row {
  return {
    eventId,
    action: "task.created",
    occurredAt,
    outcome: "succeeded",
    actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" },
    resource: { type: "approval", id: "ap_1122334455667788" },
    requestId: `req-${eventId}`,
    ...over,
  };
}

const NOVA = rowOf(NOVA_ID, "2026-11-19T01:20:00Z");
const MIKE = rowOf(MIKE_ID, "2026-11-19T01:21:00Z");
const TIE_A = rowOf(TIE_A_ID, TIE_AT);
const TIE_B = rowOf(TIE_B_ID, TIE_AT, {
  actor: { type: "human", id: "user:77aa55cc33ee11ff", displayName: "周航" },
});
const ALL = [NOVA, MIKE, TIE_A, TIE_B];

const BASE = `/audit?window=custom&from=2026-11-05T02:00:00Z&to=2026-11-19T02:00:00Z&limit=25`;

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

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

function cell(testId: string): string {
  return node(testId)?.querySelector("dd")?.textContent ?? "";
}

async function clickNodeSync(testId: string, label: string): Promise<void> {
  const target = node(testId);
  expect(target, label).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function flipTime(label: string): Promise<void> {
  await clickNodeSync("aud-sort-button-time", label);
}

async function openRecord(eventId: string): Promise<void> {
  await clickNodeSync(`aud01-cell-${eventId}-type`, `row ${eventId}`);
  await waitFor(() => node("aud02-detail") !== null, "the detail pane opened");
}

async function closeRecord(): Promise<void> {
  await clickNodeSync("aud8-back-to-list", "back to the list");
  await waitFor(() => node("aud02-detail") === null, "the detail pane closed");
}

// ── 复制句怎么到手 ─────────────────────────────────────────────────────────
const clip = { calls: [] as string[] };

async function copiedLine(): Promise<string> {
  const before = clip.calls.length;
  await clickNodeSync("aud-detail-copy", "copy button");
  await waitFor(() => clip.calls.length > before, "the copy landed");
  return clip.calls[clip.calls.length - 1] ?? "";
}

// ── 文件怎么到手 ───────────────────────────────────────────────────────────
const blobs = new Map<string, Blob>();
const captured = { name: "", text: "" };

function watchBlobs(): void {
  blobs.clear();
  captured.name = "";
  captured.text = "";
  URL.createObjectURL = ((blob: Blob) => {
    const url = `blob:r266-${blobs.size + 1}`;
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
  actor: CSV_HEADER.indexOf("操作者"),
  rid: CSV_HEADER.indexOf("请求编号"),
};

const ridOrder = (records: string[][]): string[] => records.map((cells) => cells[COL.rid]);

beforeEach(() => {
  api.fetchJSON.mockReset();
  clip.calls = [];
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.navigator, "clipboard", {
    value: {
      writeText: async (text: string) => {
        clip.calls.push(text);
      },
    },
    configurable: true,
  });
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      const id = paramOf(target, "id");
      return { audit: ALL.find((row) => row.eventId === id) ?? NOVA };
    }
    return { items: ALL, nextCursor: null };
  });
  watchBlobs();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R266 - the sort flip turns the table and the file together", () => {
  it("exports in the painted order after each flip, with two files that do not bleed", async () => {
    await render(BASE);
    expect(paintedRows()).toEqual([NOVA_ID, MIKE_ID, TIE_A_ID, TIE_B_ID]);
    // 翻转与导出都不该再向线路要一次列表（取数本体归 R190①:147-181，这里只缝上导出账本）。
    const ledger = urls();
    const asks = listReads();

    await flipTime("asc");
    const paintedAsc = paintedRows();
    expect(paintedAsc).toEqual([NOVA_ID, MIKE_ID, TIE_A_ID, TIE_B_ID]);
    const first = await exportRecords();
    const rawFirst = captured.text;
    // 行序==屏上序：逐位置按请求编号对齐，并带一格内容字节（操作者）当证。
    expect(ridOrder(first)).toEqual(paintedAsc.map((eventId) => `req-${eventId}`));
    for (let i = 0; i < paintedAsc.length; i += 1) {
      expect(first[i][COL.actor]).toBe(cell(`aud01-cell-${paintedAsc[i]}-actor`));
    }
    // 首行==屏上首行，按字节钉死。
    expect(first[0][COL.rid]).toBe(`req-${NOVA_ID}`);

    await flipTime("desc");
    const paintedDesc = paintedRows();
    expect(paintedDesc).toEqual([TIE_A_ID, TIE_B_ID, MIKE_ID, NOVA_ID]);
    const second = await exportRecords();
    expect(ridOrder(second)).toEqual(paintedDesc.map((eventId) => `req-${eventId}`));
    for (let i = 0; i < paintedDesc.length; i += 1) {
      expect(second[i][COL.actor]).toBe(cell(`aud01-cell-${paintedDesc[i]}-actor`));
    }
    expect(second[0][COL.rid]).toBe(`req-${TIE_A_ID}`);

    // 行集不变仅翻转：两次导出的行集是同一集合。
    expect([...ridOrder(first)].sort()).toEqual([...ridOrder(second)].sort());

    // 两 blob 互不残留：第二次导出之后，第一枚文件仍逐字是第一次那份。
    expect(blobs.size).toBe(2);
    expect(await blobs.get(`blob:r266-1`)?.text()).toBe(rawFirst);
    expect(await blobs.get(`blob:r266-2`)?.text()).toBe(captured.text);

    expect(urls()).toEqual(ledger);
    expect(listReads()).toBe(asks);
  });

  it("keeps tied timestamps in the same relative order in both directions, each row keeping its own sentence", async () => {
    await render(BASE);
    const before = listReads();

    await flipTime("asc");
    const asc = paintedRows();
    expect(asc.indexOf(TIE_A_ID)).toBeGreaterThanOrEqual(0);
    expect(asc.indexOf(TIE_A_ID)).toBeLessThan(asc.indexOf(TIE_B_ID));
    const ascFile = ridOrder(await exportRecords());
    expect(ascFile.indexOf(`req-${TIE_A_ID}`)).toBeLessThan(ascFile.indexOf(`req-${TIE_B_ID}`));

    await openRecord(TIE_A_ID);
    const lineAscA = await copiedLine();
    await closeRecord();
    await openRecord(TIE_B_ID);
    const lineAscB = await copiedLine();
    await closeRecord();
    // 并列是真的同一时刻：两句都写同一个屏上时间；两行各有各的操作者，句口才可辨。
    expect(lineAscA).toContain("2026-11-19 09:22:00");
    expect(lineAscB).toContain("2026-11-19 09:22:00");
    expect(lineAscA).not.toBe(lineAscB);
    expect(lineAscB).toContain(ZHOU);

    await flipTime("desc");
    const desc = paintedRows();
    // 翻转方向不重排并列行：tiebreak 用的是入选原序（sorting.ts a.index-b.index）。
    expect(desc.indexOf(TIE_A_ID)).toBeLessThan(desc.indexOf(TIE_B_ID));
    const descFile = ridOrder(await exportRecords());
    expect(descFile.indexOf(`req-${TIE_A_ID}`)).toBeLessThan(descFile.indexOf(`req-${TIE_B_ID}`));

    // 复制句各守其句：同一行在 desc 之后逐字仍是它 asc 之后那一句。
    await openRecord(TIE_A_ID);
    expect(await copiedLine()).toBe(lineAscA);
    await closeRecord();
    await openRecord(TIE_B_ID);
    expect(await copiedLine()).toBe(lineAscB);
    await closeRecord();

    expect(listReads()).toBe(before);
  });
});
