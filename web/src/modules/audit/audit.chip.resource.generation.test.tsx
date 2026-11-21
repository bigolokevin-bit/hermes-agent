/** @vitest-environment jsdom */

// R277 - the resource handle narrows the page, the chip widens it, and the file follows.
//
// Chosen cross (ticket 自选): resource 双轨本地再筛 × 摘 chip 换代 × 导出文件/复制句/Blob 计数.
// 查重（已覆盖只回证据，本文件一字不重写）：
// - 摘 resource chip 的账本与屏侧：audit.actor.resource.test.tsx :273 (R230②)——恰一次重取、
//   新请求不再带 resourceId、operator 留下、三值在新行集上重算；:256 (R214 同族) 交叠行集；
//   :297-328 (R230③) 本地清零具名句 aud9-local-empty、两门 disabled+title 字节、点击零请求。
// - resource 行集与「将导出 N 条」与首末行：AuditEventsModulePage.test.tsx :5438-5456 (audT)；
//   具名句不怪服务：同文件 :1403-1413。
// - 挂载时本地再筛×三值×文件：audit.filter.combo.test.tsx it① (R270①)——本波不复钉挂载三角。
// - 句随行走（actor 维）：audit.chip.copy.generation.test.tsx (R276)——本波是 resource 维 twin，
//   钉的是摘 chip 后返回行进场时幸存行句逐字节不变+外维句自守。
// 本波净新增：CSV 文件侧换代（旧 rid 零入新文件、两 blob 字节互不残留）×
//   本地清零语境强点两门 createObjectURL 计数 0（R230③ 只钉了账本零请求）×
//   aud9-local-empty 摘后消失腿。
// 现状登记（不弱化）：
// - 双轨：resourceId 随线路上报（AuditEventsModulePage.tsx :836），但服务端过滤效果本环境未单独实测
//   （:388-393 句面同口径），页面在已装载行里按编号本地 includes 再筛（:906-916）。
//   worst-shape 服务承诺登记（R243② 先例）：mock 一律整页回全量，换代只发生在本地匹配上。
// - 「空集/500 保旧行」≠现状（失败页整页替换清空表体，audit.export.window.detail.paging.test.tsx
//   :293 (R250①) 已登记；重试恰+1/非并集归 :302-326 (R213③)），本单未取 500 交叉，只回证据。
// - 「序号从 0 重建」概念不存在（列表无序号控件，行复制=开抽屉后 aud-detail-copy 一枚）——
//   诚实等价：行集换代完整唯一+计数从头。
// - 每摘一维恰一问（列表不重取≠现状）；开抽屉详情恰一问、列表零问（R243③ :369-390）。
// - 计数文本按现状取 aud5-export-count「将导出 N 条」：resource 维下 aud01-status 读数行含
//   「按编号本地筛（N/M）」两个数字（:1471），/(\d+)/ 首数字不是行数——按现状选面，不弱化。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { CSV_HEADER } from "@/modules/audit/csv";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));

vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

interface Actor {
  type?: string;
  id?: string;
  displayName?: string;
}

interface Resource {
  type?: string;
  id?: string;
}

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: Actor;
  resource: Resource;
  requestId: string | null;
  correlationId: string | null;
}

const WHO = "李思 · 6d7e8f90";
const WHO_B = "周航 · 33ee11ff";
const ACTION = "task.created";
const ACTION_WORDS = "创建任务";
const HANDLE = "ap_1122334455667788";
const OBJECT = "审批单 · 55667788";
const FOREIGN = "ap_11223344556600ff";
const OBJECT_F = "审批单 · 556600ff";
const NOPE = "ap_9988776655443322";
const ZONE = "北京时间（UTC+8）";

const ROW_1 = "evt_r277_nov_0000000001";
const ROW_2 = "evt_r277_mike_0000000001";
const ROW_F = "evt_r277_fox_0000000001";

function rowOf(eventId: string, occurredAt: string, actor: Actor, resourceId: string): Row {
  return {
    eventId,
    action: ACTION,
    occurredAt,
    outcome: "succeeded",
    actor,
    resource: { type: "approval", id: resourceId },
    requestId: `req-${eventId}`,
    correlationId: `cor-${eventId}`,
  };
}

const LI_SI: Actor = { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" };
const ZHOU: Actor = { type: "human", id: "user:77aa55cc33ee11ff", displayName: "周航" };

// 服务端效果未单独实测：mock 一律整页回全量（worst-shape），页面按编号本地 includes 再筛。
const SUPERSET: Row[] = [
  rowOf(ROW_1, "2026-11-19T01:20:00Z", LI_SI, HANDLE),
  rowOf(ROW_2, "2026-11-19T01:21:00Z", LI_SI, HANDLE),
  rowOf(ROW_F, "2026-11-19T01:25:00Z", ZHOU, FOREIGN),
];
const BY_ID = new Map(SUPERSET.map((row) => [row.eventId, row]));

function answer(target: string): unknown {
  if (target.startsWith("/agent-api/api/audit-detail")) {
    const url = new URL(target, "http://console.test");
    const id = url.searchParams.get("id");
    return { audit: id ? BY_ID.get(id) ?? null : null };
  }
  return { items: SUPERSET, nextCursor: null };
}

const NARROW = `/audit?window=30d&resource=${HANDLE}&limit=25`;
const DEAD = `/audit?window=30d&resource=${NOPE}&limit=25`;

let root: Root | null = null;

async function waitFor(check: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 3000;
  for (;;) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    if (check()) return;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
  }
}

async function render(entry: string): Promise<void> {
  if (root) {
    await act(async () => root?.unmount());
    root = null;
  }
  const host = document.createElement("div");
  document.body.replaceChildren(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <AuditEventsModulePage />
      </MemoryRouter>,
    );
  });
  await waitFor(() => document.querySelector(".animate-pulse") === null, "the skeleton to clear");
}

function node(testId: string): HTMLElement | null {
  return document.querySelector(`[data-testid='${testId}']`);
}

function textOf(testId: string): string {
  return node(testId)?.textContent ?? "";
}

function urls(): string[] {
  return api.fetchJSON.mock.calls.map((call) => String(call[0]));
}

function listReads(): number {
  return urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
}

function detailReads(): number {
  return urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length;
}

function paintedRows(): string[] {
  return Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((row) =>
    row.getAttribute("data-testid")?.replace("aud01-row-", "") ?? "",
  );
}

function exportCountDigits(): number {
  const match = textOf("aud5-export-count").match(/[0-9]+/);
  return match ? Number(match[0]) : -1;
}

async function clickNodeSync(testId: string, label = testId): Promise<void> {
  const target = node(testId);
  expect(target, label).not.toBeNull();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function openRecord(eventId: string): Promise<void> {
  await clickNodeSync(`aud01-cell-${eventId}-type`, "the action cell opens the drawer");
  await waitFor(() => node("aud02-detail") !== null, "the drawer opened");
}

async function closeRecord(): Promise<void> {
  await clickNodeSync("aud8-back-to-list", "the way back to the list");
  await waitFor(() => node("aud02-detail") === null, "the drawer closed");
}

const clip = { calls: [] as string[] };

async function copiedLine(): Promise<string> {
  await clickNodeSync("aud-detail-copy", "the copied sentence");
  await waitFor(() => clip.calls.length > 0, "the copy landed");
  return clip.calls[clip.calls.length - 1] ?? "";
}

const blobs = new Map<string, Blob>();
const made = { urls: 0 };
const captured = { name: "", text: "" };

function watchBlobs(): void {
  blobs.clear();
  made.urls = 0;
  captured.name = "";
  captured.text = "";
  URL.createObjectURL = ((blob: Blob) => {
    made.urls += 1;
    const url = `blob:r277-${made.urls}`;
    blobs.set(url, blob);
    return url;
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    if (!this.download) return;
    captured.name = this.download;
    const blob = blobs.get(this.href);
    if (blob) void blob.text().then((text) => (captured.text = text));
  });
}

function parseRecord(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

const BOM = String.fromCharCode(0xfeff);

function dataLines(): string[] {
  const raw = captured.text.startsWith(BOM) ? captured.text.slice(1) : captured.text;
  return raw
    .split("\r\n")
    .filter((line) => line !== "")
    .slice(1);
}

async function exportRecords(): Promise<string[][]> {
  captured.text = "";
  await clickNodeSync("aud01-export", "the CSV export door");
  await waitFor(() => captured.text !== "", "the export was handed over");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  return dataLines().map(parseRecord);
}

const COL = {
  rid: CSV_HEADER.indexOf("请求编号"),
  object: CSV_HEADER.indexOf("对象"),
};

async function clearResourceChip(): Promise<void> {
  // 账本本体（恰一问、resourceId 掉线、actorId 留存）归 R230② :273，这里只核换代当事人。
  const callsBefore = urls().length;
  await clickNodeSync("aud-chip-resource-clear", "the resource chip gives way");
  await waitFor(() => listReads() === 2, "the unfiltered page was asked");
  expect(urls().length).toBe(callsBefore + 1);
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(async (target: unknown) => answer(String(target)));
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.navigator, "clipboard", {
    value: { writeText: (text: string) => clip.calls.push(text) },
    configurable: true,
  });
  clip.calls = [];
  watchBlobs();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R277 - the resource chip comes off and the file rewrites itself", () => {
  it("holds every returning row in the new file and none of the narrowed view", async () => {
    await render(NARROW);
    expect(listReads()).toBe(1);
    // 本地再筛把外维行挡在屏外（挂载三角归 R270①/R230①，这里只按前提核）。
    expect(paintedRows()).toEqual([ROW_1, ROW_2]);

    const narrowed = await exportRecords();
    expect(narrowed.map((cells) => cells[COL.rid])).toEqual([`req-${ROW_1}`, `req-${ROW_2}`]);
    const narrowText = captured.text;
    expect(blobs.size).toBe(1);

    await clearResourceChip();
    expect(paintedRows()).toEqual([ROW_1, ROW_2, ROW_F]);

    const widened = await exportRecords();
    expect(widened.map((cells) => cells[COL.rid])).toEqual([`req-${ROW_1}`, `req-${ROW_2}`, `req-${ROW_F}`]);
    expect(widened).toHaveLength(paintedRows().length);
    expect(exportCountDigits()).toBe(widened.length);
    expect(captured.text).toContain(`req-${ROW_F}`);
    // 两 blob 互不残留：旧文件原样躺在旧名下，返回行没渗回去。
    expect(blobs.size).toBe(2);
    expect(captured.text).not.toBe(narrowText);
    let oldText = "";
    await act(async () => {
      oldText = await (blobs.get("blob:r277-1") ?? new Blob([])).text();
    });
    expect(oldText).toBe(narrowText);
    expect(oldText).not.toContain(`req-${ROW_F}`);
    // 导出零请求：文件两枚，列表只两问。
    expect(listReads()).toBe(2);
  });

  it("hands the returning row its own sentence while the survivor says the same words", async () => {
    await render(NARROW);
    await openRecord(ROW_1);
    const before = await copiedLine();
    expect(before.startsWith(`2026-11-19 09:20:00 ${ZONE}`)).toBe(true);
    expect(before).toContain(OBJECT);
    await closeRecord();

    await clearResourceChip();

    // 幸存行重开：句与摘前逐字节相同——句随行走，不随资源维变（R276① 的资源维 twin）。
    await openRecord(ROW_1);
    const after = await copiedLine();
    await closeRecord();
    expect(after).toBe(before);

    // 进场行各守其句：外维句带自己的名字与短码，不串李思。
    await openRecord(ROW_F);
    const foreign = await copiedLine();
    await closeRecord();
    expect(foreign.startsWith(`2026-11-19 09:25:00 ${ZONE}`)).toBe(true);
    expect(foreign).toContain(WHO_B);
    expect(foreign).toContain(OBJECT_F);
    expect(foreign).toContain(ACTION_WORDS);
    expect(foreign).not.toContain(WHO);
    expect(foreign).not.toContain("undefined");
    expect(foreign).not.toContain("null");

    // 开关抽屉列表零新增；每开一屉详情恰一问（口径归 R243③ :369-390，这里按维核）。
    expect(listReads()).toBe(2);
    expect(detailReads()).toBe(3);
  });

  it("builds no file for a handle nothing matches, then clears it back at one ask", async () => {
    await render(DEAD);
    expect(listReads()).toBe(1);
    expect(paintedRows()).toEqual([]);
    // 具名句与两门 disabled+title 字节本体归 R230③ :297-328 与 audT :1403-1413，这里只按前提核。
    expect(node("aud9-local-empty")).not.toBeNull();
    const csv = node("aud01-export") as HTMLButtonElement | null;
    const filtered = node("aud5-export") as HTMLButtonElement | null;
    expect(csv?.disabled).toBe(true);
    expect(filtered?.disabled).toBe(true);

    // 净新增：本地清零语境强点两门——文件一枚都不建（R230③ 只钉了账本零请求）。
    const ledger = urls();
    await clickNodeSync("aud01-export", "the CSV door under the dead handle");
    await clickNodeSync("aud5-export", "the filtered door under the dead handle");
    expect(made.urls).toBe(0);
    expect(blobs.size).toBe(0);
    expect(urls()).toEqual(ledger);
    expect(listReads()).toBe(1);

    await clearResourceChip();
    expect(paintedRows()).toEqual([ROW_1, ROW_2, ROW_F]);
    expect(node("aud9-local-empty")).toBeNull();
    expect(exportCountDigits()).toBe(paintedRows().length);

    const records = await exportRecords();
    expect(records.map((cells) => cells[COL.rid])).toEqual([`req-${ROW_1}`, `req-${ROW_2}`, `req-${ROW_F}`]);
    expect(records).toHaveLength(paintedRows().length);
    expect(exportCountDigits()).toBe(records.length);
    expect(blobs.size).toBe(1);

    // 清零时关着的复制，换代后重开可用。
    await openRecord(ROW_F);
    const line = await copiedLine();
    expect(line.startsWith(`2026-11-19 09:25:00 ${ZONE}`)).toBe(true);
    expect(line).toContain(WHO_B);
    await closeRecord();
    expect(listReads()).toBe(2);
  });
});
