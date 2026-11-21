/** @vitest-environment jsdom */

// R276 - the operator chip comes off, and every sentence keeps its own row.
//
// Chosen cross (ticket 自选): actor chip 摘除 × 详情复制句换代 × 空态恢复.
// 查重（已覆盖只回证据，本文件一字不重写）：
// - chip 账本腿（摘一维恰一问、地址回写）：audit.filter.counts.test.tsx :287-313 (R214②)
//   与 audit.chips.test.tsx (R224) —— 两处都不碰复制句，本波把句接上。
// - 翻页态摘 chip 的换代×CSV：audit.detail.copy.paging.filter.test.tsx :365-400 (R273②)，
//   本波不带游标维，专做抽屉开合×句不变×空态恢复。
// - 换档×复制换代：audit.filter.paging.export.test.tsx :311-345 (R243①)；
//   换窗四处同读（重开对齐）：audit.window.copy.parity.test.tsx :301-335 (R261①) —— 本波是 chip 维等价。
// - 摘维下拉版复制句各守其行：audit.copy.paging2.test.tsx :276-311 (R244①)。
// - 空态句与两门 disabled+title：audit.export.empty.test.tsx :211-243 (R228①，句 :220、题 :225)。
// 现状登记（不弱化）：
// - 抽屉开着时列表换代，读数冻结按现状（R247②/R229②同款——开着的抽屉不自己变），
//   本波钉的是摘 chip 后【重开】幸存行的句与摘前逐字节相同：句随行走，不随筛选维变。
// - 「序号从 0 重建」概念在本控制台不存在（列表无序号控件，行复制=开抽屉后 aud-detail-copy 一枚；
//   audC-copy 仅详情独立页）——诚实等价：行集换代完整唯一+计数从头（shownCount==表体==CSV 行数）。
// - 每摘一维恰一问（列表不重取≠现状）；整页换代非并集；开抽屉详情恰一问、列表零问（R243③ :369-390）。
// - worst-shape 服务承诺登记（R243② 先例）：mock 按 actorId 有无换代，与线路合同一致；
//   导出=已装载行，非全量。

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

const ACTOR = "user:2f3a4b5c6d7e8f90";
// 地址 actor= 与线路 actorId= 用裸编号（selectHarness 选项值），不是带前缀的全 id。
const ACTOR_QUERY = "2f3a4b5c6d7e8f90";
const WHO = "李思 · 6d7e8f90";
const ACTOR_B = "user:77aa55cc33ee11ff";
const WHO_B = "周航 · 33ee11ff";
const ACTION = "task.created";
const ACTION_WORDS = "创建任务";
const RESOURCE = "ap_1122334455667788";
const OBJECT = "审批单 · 55667788";
const ZONE = "北京时间（UTC+8）";

const ROW_N = "evt_r276_nov_0000000001";
const ROW_M = "evt_r276_mike_0000000001";
const ROW_E = "evt_r276_echo_000000001";
const ROW_F = "evt_r276_fox_0000000001";

function rowOf(eventId: string, occurredAt: string, actor: Actor): Row {
  return {
    eventId,
    action: ACTION,
    occurredAt,
    outcome: "succeeded",
    actor,
    resource: { type: "approval", id: RESOURCE },
    requestId: `req-${eventId}`,
    correlationId: `cor-${eventId}`,
  };
}

const LI_SI: Actor = { type: "human", id: ACTOR, displayName: "李思" };
const ZHOU: Actor = { type: "human", id: ACTOR_B, displayName: "周航" };

// 摘掉 actor 维后线路无 actorId，服务应答换代为全量：幸存行 N 仍在，外维行 F 进场。
const FILTERED: Row[] = [
  rowOf(ROW_N, "2026-11-19T01:20:00Z", LI_SI),
  rowOf(ROW_M, "2026-11-19T01:21:00Z", LI_SI),
];
const UNFILTERED: Row[] = [
  rowOf(ROW_N, "2026-11-19T01:20:00Z", LI_SI),
  rowOf(ROW_E, "2026-11-19T01:24:00Z", LI_SI),
  rowOf(ROW_F, "2026-11-19T01:25:00Z", ZHOU),
];
const ALL_ROWS = [...FILTERED, ...UNFILTERED.filter((row) => !FILTERED.some((kept) => kept.eventId === row.eventId))];
const BY_ID = new Map(ALL_ROWS.map((row) => [row.eventId, row]));

const STACKED = `/audit?window=7d&actor=${ACTOR_QUERY}&limit=25`;

const mode = { empty: false };

function answer(target: string): unknown {
  if (target.startsWith("/agent-api/api/audit-detail")) {
    const url = new URL(target, "http://console.test");
    const id = url.searchParams.get("id");
    return { audit: id ? BY_ID.get(id) ?? null : null };
  }
  const url = new URL(target, "http://console.test");
  if (url.searchParams.get("actorId") === ACTOR_QUERY) {
    return { items: mode.empty ? [] : FILTERED, nextCursor: null };
  }
  return { items: UNFILTERED, nextCursor: null };
}

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

function paramOf(target: string, key: string): string | null {
  return new URL(target, "http://console.test").searchParams.get(key);
}

function paintedRows(): string[] {
  return Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((row) =>
    row.getAttribute("data-testid")?.replace("aud01-row-", "") ?? "",
  );
}

function shownCount(): number {
  const match = /(\d+)/.exec(textOf("aud01-status"));
  return match ? Number(match[1]) : -1;
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
const captured = { name: "", text: "" };

function watchBlobs(): void {
  blobs.clear();
  captured.name = "";
  captured.text = "";
  let seq = 0;
  URL.createObjectURL = ((blob: Blob) => {
    seq += 1;
    const url = `blob:r276-${seq}`;
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
  time: CSV_HEADER.indexOf("时间"),
  actor: CSV_HEADER.indexOf("操作者"),
  type: CSV_HEADER.indexOf("类型"),
  object: CSV_HEADER.indexOf("对象"),
  rid: CSV_HEADER.indexOf("请求编号"),
};

beforeEach(() => {
  mode.empty = false;
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

describe("R276 - the operator chip comes off and every sentence keeps its row", () => {
  it("holds the open drawer still while the chip goes, and the survivor says the same words after", async () => {
    await render(STACKED);
    expect(listReads()).toBe(1);
    expect(paintedRows()).toEqual([ROW_N, ROW_M]);

    await openRecord(ROW_N);
    const before = await copiedLine();
    expect(before.startsWith(`2026-11-19 09:20:00 ${ZONE}`)).toBe(true);
    await closeRecord();

    // 摘 actor chip：账本本体归 R214② :287-313，这里只核句的当事人。
    const callsBefore = urls().length;
    await clickNodeSync("aud-chip-actor-clear", "the operator chip gives way");
    await waitFor(() => listReads() === 2, "the unfiltered page was asked");
    expect(urls().length).toBe(callsBefore + 1);
    expect(paramOf(urls()[urls().length - 1] ?? "", "actorId")).toBeNull();
    expect(paintedRows()).toEqual([ROW_N, ROW_E, ROW_F]);

    // 幸存行重开：句与摘前逐字节相同——句随行走，不随筛选维变。
    await openRecord(ROW_N);
    const after = await copiedLine();
    await closeRecord();
    expect(after).toBe(before);
    expect(after).toContain(WHO);
    expect(after).not.toContain("undefined");
    expect(after).not.toContain("null");

    // 换代不进句里：外维行的时刻与名字没串进幸存行。
    expect(after).not.toContain("09:25:00");
    expect(after).not.toContain(WHO_B);
    expect(listReads()).toBe(2);
  });

  it("hands each new row its own sentence after the swap, one ask per drawer", async () => {
    await render(STACKED);
    await clickNodeSync("aud-chip-actor-clear", "the operator chip gives way");
    await waitFor(() => listReads() === 2, "the unfiltered page was asked");
    expect(paintedRows()).toEqual([ROW_N, ROW_E, ROW_F]);

    const asks = listReads();

    await openRecord(ROW_F);
    const zhouLine = await copiedLine();
    expect(zhouLine.startsWith(`2026-11-19 09:25:00 ${ZONE}`)).toBe(true);
    expect(zhouLine).toContain(WHO_B);
    expect(zhouLine).toContain(ACTION_WORDS);
    expect(zhouLine).toContain(OBJECT);
    expect(zhouLine).not.toContain(WHO);
    await closeRecord();

    await openRecord(ROW_E);
    const echoLine = await copiedLine();
    expect(echoLine.startsWith(`2026-11-19 09:24:00 ${ZONE}`)).toBe(true);
    expect(echoLine).toContain(WHO);
    expect(echoLine).not.toContain(WHO_B);
    await closeRecord();

    // 两句可辨，各自逐字节守着各自的行。
    expect(echoLine).not.toBe(zhouLine);

    // 开关抽屉列表零新增；每开一屉详情恰一问（账本口径归 R243③ :369-390，这里按维核）。
    expect(listReads()).toBe(asks);
    expect(urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length).toBe(asks);
    expect(urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length).toBe(2);
  });

  it("brings the counts back from an empty answer at one ask, sentences included", async () => {
    mode.empty = true;
    await render(STACKED);
    expect(listReads()).toBe(1);
    expect(paintedRows()).toEqual([]);
    // 空态句与两门 disabled 的字节本体归 R228① :211-243（句 :220、题 :225），这里只按前提核。
    const csv = node("aud01-export") as HTMLButtonElement | null;
    const filtered = node("aud5-export") as HTMLButtonElement | null;
    expect(csv?.disabled).toBe(true);
    expect(filtered?.disabled).toBe(true);

    await clickNodeSync("aud-chip-actor-clear", "the operator chip gives way");
    await waitFor(() => listReads() === 2, "the unfiltered page was asked");
    expect(paintedRows()).toEqual([ROW_N, ROW_E, ROW_F]);
    expect(shownCount()).toBe(paintedRows().length);

    const ledger = urls();
    const records = await exportRecords();
    expect(records.map((cell) => cell[COL.rid])).toEqual([`req-${ROW_N}`, `req-${ROW_E}`, `req-${ROW_F}`]);
    expect(records).toHaveLength(paintedRows().length);
    expect(shownCount()).toBe(records.length);
    expect(captured.text).not.toContain(`req-${ROW_M}`);
    expect(blobs.size).toBe(1);

    // 空态下关着的门，换代后重开可复制（唯一诚实 0 的「将导出 0 条」口径归 R228 头注）。
    await openRecord(ROW_F);
    const line = await copiedLine();
    expect(line.startsWith(`2026-11-19 09:25:00 ${ZONE}`)).toBe(true);
    expect(line).toContain(WHO_B);
    await closeRecord();

    // 导出与开关抽屉都不添列表问；详情恰一问（R243③ :369-390 口径）。
    expect(urls().filter((url) => url.startsWith("/agent-api/api/audit?"))).toEqual(ledger);
    expect(listReads()).toBe(2);
    expect(urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length).toBe(1);
  });
});
