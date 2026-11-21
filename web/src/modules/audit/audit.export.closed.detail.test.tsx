// @vitest-environment jsdom
// R260（重发编号）— 详情开→关之后的导出：账还是那份账，一行不吞、一行不重。
//
// 已覆盖、这里不重写（只回证据与缺口）：
// - `audit.export.detail.open.test.tsx:333`（R245②）：【裸地址】打开前/关闭后两次导出的原文逐字相等
//   （records toEqual + exportText toBe + 行序 rid 映射 + 账本只多那一枚详情读）；
// - `audit.detail.copy.open.test.tsx:389`（R240③）：关闭后导出行数==表体==读数行、导出击零请求、
//   复制件回到 visible-disabled；
// - ②的「关闭态 ?window=7d&actor= 叠加导出仍遵筛选、三值同源」：本体归
//   `audit.export.columns.test.tsx`（R205④ 叠加计数+文件遵筛选）、
//   `audit.filter.counts.test.tsx`（R214① 三值三角）、`audit.export.dims.test.tsx`（R248① 逐行位置）；
// - ③的「aud-detail-copy 序号从 0 连续」：复制件是【一条事件一句话】，没有序号这个概念
//   （R236/R237/R241/R244 已四次登记），可钉形=逐行对应，本体在那四例里；关闭后行序与零额外请求
//   归 R245②/R240③。
//
// 本文件只补一枚真正没被拼过的：在【actor 筛选站】（而非裸地址）开→关之后——
// 两次导出结果数组逐字相等【且】被打开过的那条事件在文件里【恰出现一次】、请求编号列无重复
// （工单①「不被吞/不重复」的精确形），同时三值三角与「导出击零请求」当场复跑。
// 现状口径：档位不上线，线路只认 from/to 对；筛选在线路上是 actorId=。

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

const ROW_1 = "evt_r260_first_000001";
const ROW_2 = "evt_r260_second_00000";

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

const FIRST = rowOf(ROW_1, "2026-11-19T01:20:00Z");
const SECOND = rowOf(ROW_2, "2026-11-19T01:21:00Z");
const ALL = [FIRST, SECOND];

const STACKED = `/audit?window=7d&actor=${encodeURIComponent(ACTOR)}&limit=25`;

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

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
const detailReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length;

function lastListRead(): string {
  return [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";
}

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
    const url = `blob:r260-${blobs.size + 1}`;
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

const COL_RID = CSV_HEADER.indexOf("请求编号");

function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      const found = ALL.find((row) => paramOf(target, "id") === row.eventId);
      return { audit: found ?? ALL[0] };
    }
    return { items: ALL, nextCursor: null };
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

describe("R260 - the filtered station, opened then folded", () => {
  it("swallows nothing and duplicates nothing when the drawer closes", async () => {
    await render(STACKED);
    expect(listReads()).toBe(1);
    // 站本身就是筛选站：线路带着 actorId（档位不上线既有口径不在此重钉）。
    expect(paramOf(lastListRead(), "actorId")).toBe(ACTOR);
    expect(paintedRows()).toEqual([ROW_1, ROW_2]);

    const before = await exportRecords();
    expect(before).toHaveLength(paintedRows().length);
    expect(shownCount()).toBe(before.length);

    await openRecord(ROW_1);
    expect(detailReads()).toBe(1);
    await closeRecord();

    const ledger = urls();
    const asks = listReads();
    const after = await exportRecords();
    // 账还是那份账：行集、序、每格逐字，与关闭前相等（裸站形制归 R245②:333，此处筛选站）。
    expect(after).toEqual(before);
    const rids = after.map((cells) => cells[COL_RID]);
    // 工单①的精确形：请求编号列没有重复，而被打开过的那条恰出现一次——不吞、不重。
    expect(new Set(rids).size).toBe(rids.length);
    expect(rids.filter((rid) => rid === `req-${ROW_1}`)).toHaveLength(1);
    expect(shownCount()).toBe(after.length);
    // 导出这一击不问任何事（本体归 R245②/R240③，筛选站当场复跑一遍账本）。
    expect(urls()).toEqual(ledger);
    expect(listReads()).toBe(asks);
  });
});
