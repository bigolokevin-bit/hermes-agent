// @vitest-environment jsdom
// R263 — 导出与详情复制的字段配对，在带筛选的站点上逐格钉死。
//
// 已覆盖、这里不重写（只回证据，文件:行）：
// - `audit.export.detailcopy.same.test.tsx:268`（R259）钉住了【裸 7d 站点】完整行的强式配对：
//   复制句整句 toStrictEqual、CSV 四格逐格 toBe、时间按 re-join 前缀梯核对
//   （`TIME_FULL.startsWith(`${cell}:`)` —— 文件格不是加时区句子的字符串前缀，槽 16 一处
//   是「:」一处是空格，现状更正归该文件）；
// - `audit.fields.edge.test.tsx:366-378`（R220①）钉住了【裸站点】稀疏行的 joint：复制句
//   contains 「未指派」、CSV 同格也写 「未指派」；
// - `audit.actor.copy.test.tsx:326`（R235②）钉住了筛选站点下 复制句↔CSV 的弱式对读
//   （startsWith/contains），从未逐格按等号；
// - `audit.export.dims.test.tsx:286`（R248①）与 `audit.filter.counts.test.tsx`（R214①）
//   钉住了筛选站点 actor 列逐行位置==屏上==三值；`audit.export.detail.open.test.tsx:333`
//   （R245②）与 R260 钉住了开→关前后两次导出 toEqual。
//
// 本文件只补没钉过的字节：【筛选站点上】完整行与稀疏行的 复制句段↔CSV 格 逐格配对
// （line.includes(cell) 的等号形，两侧同词当场对），以及关闭抽屉后二次导出里同一行
// 同一配对的当场复跑。夹具口径登记：服务按 actorId 精确匹配是服务侧的承诺；本夹具按
// 最差形状回含一条无归属行（R243② 同款登记），钉的是页面拿到这种回行时两处仍同口径。
// 复制句五段以「 · 」拼接、段标签自身也含「 · 」⇒ 不可 split 后逐段比；请求编号不在
// 句内、CSV 却有一列——该口径差归 R205③/R208②，本波不改判。

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
const ACTION_WORDS = "创建任务";
const OBJECT = "审批单 · 55667788";
const ZONE = "北京时间（UTC+8）";

const FULL_ID = "evt_r263_full_00000001";
const SPARSE_ID = "evt_r263_sparse_000001";

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: { type?: string; id?: string; displayName?: string };
  resource: { type?: string; id?: string };
  requestId: string | null;
  correlationId?: string | null;
}

function rowOf(eventId: string, occurredAt: string, over: Partial<Row> = {}): Row {
  return {
    eventId,
    action: "task.created",
    occurredAt,
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: "ap_1122334455667788" },
    requestId: `req-${eventId}`,
    ...over,
  };
}

const FULL = rowOf(FULL_ID, "2026-11-19T01:20:00Z", { correlationId: "cor-00112233445566" });
const SPARSE = rowOf(SPARSE_ID, "2026-11-19T01:21:00Z", {
  actor: {},
  resource: { type: "approval" },
  requestId: null,
  correlationId: null,
});
const ALL = [FULL, SPARSE];

const STATION = `/audit?window=7d&actor=${encodeURIComponent(ACTOR)}&limit=25`;

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
    const url = `blob:r263-${blobs.size + 1}`;
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
  time: CSV_HEADER.indexOf("时间"),
  actor: CSV_HEADER.indexOf("操作者"),
  type: CSV_HEADER.indexOf("类型"),
  object: CSV_HEADER.indexOf("对象"),
  rid: CSV_HEADER.indexOf("请求编号"),
};

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
      return { audit: ALL.find((row) => row.eventId === id) ?? FULL };
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

describe("R263 - pairs the sentence and the row at the filtered station", () => {
  it("matches every complete cell of the opened row against the copied sentence, cell by cell", async () => {
    await render(STATION);
    expect(listReads()).toBe(1);
    expect(paramOf(urls()[0], "actorId")).toBe(ACTOR);
    expect(paintedRows()).toContain(FULL_ID);

    await openRecord(FULL_ID);
    clip.calls.length = 0;
    const line = await copiedLine();
    expect(line.startsWith(`2026-11-19 09:20:00 ${ZONE}`)).toBe(true);

    const ledger = urls();
    const asks = listReads();
    const records = await exportRecords();
    expect(listReads()).toBe(asks);
    expect(urls()).toEqual(ledger);

    const row = records.find((cells) => cells[COL.rid] === `req-${FULL_ID}`);
    expect(row, "the opened record reached the file").not.toBeUndefined();
    // 逐格配对：句子里说的，就是那一格写的（筛选站语境，等号形）。
    // 时间按 re-join 前缀梯核对（R259 现状更正持有：文件分钟格不是加时区句子的字符串前缀）。
    expect(`2026-11-19 09:20:00`.startsWith(`${row![COL.time]}:`)).toBe(true);
    expect(line.startsWith(`${row![COL.time]}:00 ${ZONE}`)).toBe(true);
    expect(row![COL.actor]).toBe(WHO);
    expect(line.includes(row![COL.actor])).toBe(true);
    expect(row![COL.type]).toBe(ACTION_WORDS);
    expect(line.includes(row![COL.type])).toBe(true);
    expect(row![COL.object]).toBe(OBJECT);
    expect(line.includes(row![COL.object])).toBe(true);
    expect(line).not.toContain(ACTOR);
    await closeRecord();
  });

  it("answers the sparse row in the same words on both faces, and the pairs replay after closing", async () => {
    await render(STATION);
    expect(paintedRows()).toContain(SPARSE_ID);

    await openRecord(SPARSE_ID);
    clip.calls.length = 0;
    const line = await copiedLine();
    const ledger = urls();
    const first = await exportRecords();
    expect(urls()).toEqual(ledger);
    const sparse = first.find((cells) => cells[COL.actor] === "未指派");
    expect(sparse, "the unassigned row is in the file").not.toBeUndefined();
    // 两侧同词：CSV 写「未指派」的那一格，复制句也带着这三个字（R205③/R208② 的梯在
    // 裸站与四面各自钉过，本行把【同一筛选站的句子与同一格】按等号对上）。
    expect(line.includes(sparse![COL.actor])).toBe(true);
    expect(sparse![COL.object]).toBe("审批单");
    expect(line.includes(sparse![COL.object])).toBe(true);
    // 请求编号：CSV 是真空的一格，句子里根本没有这一段——两套口径，不合并词条。
    expect(sparse![COL.rid]).toBe("");
    expect(line).not.toContain("该字段未返回");
    await closeRecord();

    // 关闭之后二次导出：同一行、同一格、同一句形——配对可复现（前后 toEqual 本体归 R245②/R260）。
    const second = await exportRecords();
    expect(second).toEqual(first);
    expect(urls()).toEqual(ledger);
    const again = second.find((cells) => cells[COL.actor] === "未指派");
    expect(again).toEqual(sparse);
  });
});
