// @vitest-environment jsdom
// R264 — 导出与详情复制在「缺值」上的双口径：CSV 一格与句子一段各写各的词，不许互串。
//
// 已覆盖、这里不重写（只回证据，文件:行）：
// - `audit.export.columns.test.tsx:327-329`（R205③）钉住了缺值梯：actor 缺写「未指派」
//   （非空列）、time/请求编号 才是真空格、resource 全缺写「—」；
// - `audit.fields.edge.test.tsx:366-378`（R220③）钉住了裸站稀疏行的 joint 弱式对读；
// - `audit.export.detailcopy.pairs.test.tsx`（R263）钉住了【筛选站】完整行与稀疏行的
//   句子段↔CSV 格逐格配对与关闭后复跑；
// - `audit.export.detailcopy.same.test.tsx:268`（R259）钉住了裸 7d 站完整行整句
//   toStrictEqual；`detailCopy.test.tsx:57-60`（R121）钉住了裸类型给人话名词与
//   correlationId 缺时句形；
// - 「列表行复制」控件不存在：行复制＝开抽屉后的 aud-detail-copy 一枚；
//   `AuditDetailModulePage.test.tsx:319-344` 的 audC-copy 仅详情独立页。
//   同 event 两面同句本体归 R208①/R235①/R259，这里不写重复用例。
//
// 本文件只补没钉过的字节：【无筛选混合窗口】上——
// ①缺 actor/resource/请求编号的行：CSV 写「未指派」「—」的两格与句子同词当场对，
//   真空格不借句子的词、句子不借邻行的词（缺值行↔完整行 双向不互串）；
// ②混合行集逐行按屏上 dd 格为源配对（缺值行不与完整行串位），三值当场
//   （CSV 行数==表体==aud01-status），二次导出逐字复现且零额外请求。
// 夹具口径登记：服务按窗口原样回行是承诺；本夹具混排一条稀疏行按最差形状回
// （R243② 同款登记），钉的是页面拿到混合回行时两处仍各守各的口径。

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
const OBJECT = "审批单 · 55667788";

const ALPHA_ID = "evt_r264_alpha_0000000";
const BRAVO_ID = "evt_r264_bravo_00000001";
const SPARSE_ID = "evt_r264_sparse_000001";

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

const ALPHA = rowOf(ALPHA_ID, "2026-11-19T01:20:00Z", { correlationId: "cor-00112233445566" });
const BRAVO = rowOf(BRAVO_ID, "2026-11-19T01:21:00Z");
const SPARSE = rowOf(SPARSE_ID, "2026-11-19T01:22:00Z", {
  actor: {},
  resource: {},
  requestId: null,
  correlationId: null,
});
const ALL = [ALPHA, BRAVO, SPARSE];

const PAIRS = `/audit?window=custom&from=2026-11-05T02:00:00Z&to=2026-11-19T02:00:00Z&limit=25`;

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
  return node(testId)?.textContent ?? "";
}

// aud01-status 的读数是句子；正常态「已显示 N 条」里的 N 是三值之一的口径。
function shownCount(): number {
  const match = /(\d+)/.exec(textOf("aud01-status"));
  return match ? Number(match[1]) : -1;
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

// 屏上格为准源：dd 里写什么，文件那一格就该是什么。
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
    const url = `blob:r264-${blobs.size + 1}`;
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

function recordFor(records: string[][], eventId: string): string[] | undefined {
  if (eventId === SPARSE_ID) return records.find((cells) => cells[COL.actor] === "未指派");
  return records.find((cells) => cells[COL.rid] === `req-${eventId}`);
}

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
      return { audit: ALL.find((row) => row.eventId === id) ?? ALPHA };
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

describe("R264 - the missing-value words stay on their own side of the two faces", () => {
  it("keeps the dash in its own face and the blank in its own column", async () => {
    await render(PAIRS);
    expect(paintedRows()).toEqual([ALPHA_ID, BRAVO_ID, SPARSE_ID]);

    await openRecord(SPARSE_ID);
    clip.calls.length = 0;
    const line = await copiedLine();
    await closeRecord();

    const records = await exportRecords();
    const sparse = records.find((cells) => cells[COL.actor] === "未指派");
    expect(sparse, "the unassigned row is in the file").not.toBeUndefined();
    // 两侧同词：actor 缺时 CSV 与句子都写「未指派」（R205③ 的梯，这里按混合窗口对上）。
    expect(sparse![COL.actor]).toBe("未指派");
    expect(line.includes("未指派")).toBe(true);
    // resource 全缺：文件格与句子段都写「—」，两处同词（现状口径，钉死在此）。
    expect(sparse![COL.object]).toBe("—");
    expect(line.includes("—")).toBe(true);
    // 请求编号：CSV 是真空的一格；句子没有这一段，也不借别的行的词。
    expect(sparse![COL.rid]).toBe("");
    expect(line).not.toContain("该字段未返回");
    expect(line).not.toContain("审批单");
    expect(line).not.toContain(ACTOR);

    // 反向不互串：完整行的两格带着自己的名字，不沾「—」也不沾「未指派」。
    const full = recordFor(records, ALPHA_ID);
    expect(full, "the complete row is in the file").not.toBeUndefined();
    expect(full![COL.actor]).toBe(WHO);
    expect(full![COL.object]).toBe(OBJECT);
    expect(full![COL.actor]).not.toContain("—");
    expect(full![COL.object]).not.toContain("—");
  });

  it("lets each mixed row keep its own words, position by position", async () => {
    await render(PAIRS);
    const painted = paintedRows();
    const ledger = urls();
    const asks = listReads();

    const records = await exportRecords();
    // 三值当场：CSV 行数 == 表体行数 == aud01-status 的读数。
    expect(records.length).toBe(painted.length);
    expect(shownCount()).toBe(painted.length);
    expect(records.length).toBe(shownCount());

    // 逐行配对：屏上 dd 为准源，缺值行不与完整行串位。
    for (const eventId of painted) {
      const record = recordFor(records, eventId);
      expect(record, `row ${eventId} reached the file`).not.toBeUndefined();
      expect(record![COL.actor]).toBe(cell(`aud01-cell-${eventId}-actor`));
      expect(record![COL.object]).toBe(cell(`aud01-cell-${eventId}-object`));
    }

    // 导出本身零请求；二次导出逐字复现，请求账本不动。
    expect(urls()).toEqual(ledger);
    expect(listReads()).toBe(asks);
    const second = await exportRecords();
    expect(second).toEqual(records);
    expect(urls()).toEqual(ledger);
    expect(listReads()).toBe(asks);
  });
});
