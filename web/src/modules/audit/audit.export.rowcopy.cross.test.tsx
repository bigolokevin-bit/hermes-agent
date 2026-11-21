// @vitest-environment jsdom
// R252 — 跨站同源：同一个事件，在【不带筛选的窗口站】和【带操作者的筛选站】两次全新挂载里，
// 复制出去的那句话必须是同一串字节；两站各自导出的文件，不许含对方被筛掉的那一行。
//
// 已覆盖、这里不重写（只回证据）：
// - `audit.actor.copy.test.tsx`（R235）:299 钉了【一站之内】复制句与屏上时间/actor 名+8 位短码/
//   动作人话/对象逐字；:326 钉了同一站复制句与 CSV 行的分/秒前缀梯与导出击零请求；
//   :352 钉了【活切换操作者】后行复制不带上一个人残留 —— 那是同一次挂载内的换答，
//   不是两次挂载的逐字对账。
// - `audit.export.dims.test.tsx`（R248）:286 钉了 actor×档位下每行操作者列的位置序；
//   :330 钉了非法 actor 空站：两枚导出 disabled+逐字 title、urls 逐字、createObjectURL 调用数 0、
//   页级锚在 —— 工单④整例归它，本文件不重写，只补口径登记。
// - `audit.export.columns.test.tsx`（R205）:269 钉三值三角本体；缺值「—」/「未指派」梯归 R208②/R205③。
// - 时间与请求编号的【屏上到秒、文件到分钟】前缀梯归 R153，本文件按同一口径断言。
//
// 口径登记（工单措辞 vs 现状，按现状钉）：
// 1) 「行复制序号从 0 连续」——复制件没有序号概念：每行只有一个句子。这里钉成
//    【同一事件两站逐字相等】，等式本身就是「不残留上站文本」的最强形态。
// 2) 「aud01-status 显 0」——服务空答时读数行是句子没有数字（「这个筛选条件里没有审计事件」），
//    诚实的 0 只在「将导出 0 条」那一枚；该语境已由 R248:330 持有，本文件不重跑。
// 3) 「行复制」在产品里实为【点开抽屉后的 aud-detail-copy】一把；列表行上没有独立复制钮
//    （audC-copy 未接入表体行，grep 为证）——本文件按此形制操作。

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
const ACTOR_B = "user:cafe1234beef5678";
const WHO_B = "王五 · beef5678";
const ACTION = "task.created";
const ACTION_WORDS = "创建任务";
const RESOURCE = "ap_1122334455667788";
const OBJECT = "审批单 · 55667788";
const ZONE = "北京时间（UTC+8）";

const ROW_A = "evt_r252_alpha_000001";
const ROW_B = "evt_r252_bravo_00000001";

const STATION_A = "/audit?window=7d&limit=25";
const STATION_B = `/audit?window=7d&actor=${encodeURIComponent(ACTOR)}&limit=25`;

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: { type?: string; id?: string; displayName?: string };
  resource: { type?: string; id?: string };
  requestId: string | null;
}

function rowOf(eventId: string, actor: Row["actor"], instant: string): Row {
  return {
    eventId,
    action: ACTION,
    occurredAt: instant,
    outcome: "succeeded",
    actor,
    resource: { type: "approval", id: RESOURCE },
    requestId: `req-${eventId}`,
  };
}

const A = rowOf(ROW_A, { type: "human", id: ACTOR, displayName: "李思" }, "2026-11-19T01:20:00Z");
const B = rowOf(ROW_B, { type: "human", id: ACTOR_B, displayName: "王五" }, "2026-11-19T01:21:00Z");

function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      const id = new URL(target, "http://console.test").searchParams.get("id");
      return { audit: [A, B].find((row) => row.eventId === id) ?? A };
    }
    const actorId = new URL(target, "http://console.test").searchParams.get("actorId");
    return { items: actorId === ACTOR ? [A] : [A, B], nextCursor: null };
  });
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

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;

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
  await clickNodeSync(`aud01-cell-${eventId}-type`, `open ${eventId}`);
  await waitFor(() => node("aud02-detail") !== null, "the drawer painted");
}

async function closeRecord(): Promise<void> {
  await clickNodeSync("aud8-back-to-list", "fold the drawer");
  await waitFor(() => node("aud02-detail") === null, "the drawer folded away");
}

// ── 复制：点 aud-detail-copy，句子进剪贴板 ──────────────────────────────────
const clip = { calls: [] as string[] };

function stubClipboard(): void {
  clip.calls = [];
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window, "navigator", {
    value: { clipboard: { writeText: async (text: string) => clip.calls.push(text) } },
    configurable: true,
  });
}

async function copiedLine(): Promise<string> {
  const grew = clip.calls.length + 1;
  await clickNodeSync("aud-detail-copy", "copy this event");
  await waitFor(() => clip.calls.length >= grew, "the clipboard grew");
  return clip.calls[clip.calls.length - 1] ?? "";
}

// ── 文件：Blob 在页面这侧生成，下载经 <a download> ──────────────────────────
const blobs = new Map<string, Blob>();
const captured = { name: "", text: "" };

function watchBlobs(): void {
  blobs.clear();
  captured.name = "";
  captured.text = "";
  URL.createObjectURL = ((blob: Blob) => {
    const url = `blob:r252-${blobs.size + 1}`;
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
  await clickNodeSync("aud01-export", "export the CSV");
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

describe("R252 - one record, one sentence, across two stations", () => {
  it("says the same bytes at both stations, and each station's file row matches them", async () => {
    // 站 A：不带 actor 的窗口站，两行都回来。
    await render(STATION_A);
    expect(paintedRows()).toEqual([ROW_A, ROW_B]);
    await openRecord(ROW_A);
    const line1 = await copiedLine();
    expect(line1.startsWith(`2026-11-19 09:20:00 ${ZONE}`)).toBe(true);
    expect(line1).toContain(WHO);
    expect(line1).toContain(ACTION_WORDS);
    expect(line1).toContain(OBJECT);
    expect(line1).not.toContain(ACTOR);
    expect(line1).not.toContain(RESOURCE);
    await closeRecord();
    const fileA = await exportRecords();
    const rowA1 = fileA.find((cells) => cells[COL.rid] === `req-${ROW_A}`) ?? [];
    expect(line1.startsWith(rowA1[COL.time])).toBe(true); // 文件到分钟、句子到秒的前缀梯（R153）
    expect(rowA1[COL.actor]).toBe(WHO);
    expect(rowA1[COL.type]).toBe(ACTION_WORDS);
    expect(rowA1[COL.object]).toBe(OBJECT);

    // 站 B：换一条地址、换一次全新挂载，只有该操作者的那一行回来。
    await render(STATION_B);
    expect(paintedRows()).toEqual([ROW_A]);
    await openRecord(ROW_A);
    const line2 = await copiedLine();
    // 净新增的钉子：两站逐字相等——等价于「不残留上站文本」的最强形态。
    // 「行复制序号」在现状里不存在（复制件只有一个句子），登记见头部。
    expect(line2).toBe(line1);
    await closeRecord();
    const fileB = await exportRecords();
    expect(fileB).toHaveLength(1);
    const rowB1 = fileB[0] ?? [];
    expect(rowB1[COL.rid]).toBe(`req-${ROW_A}`);
    expect(line2.startsWith(rowB1[COL.time])).toBe(true);
    expect(rowB1[COL.actor]).toBe(WHO);
    expect(rowB1[COL.type]).toBe(ACTION_WORDS);
    expect(rowB1[COL.object]).toBe(OBJECT);
    expect(rowB1[COL.time]).toBe(rowA1[COL.time]);
    // 跨站账本：两次挂载各问过列表一次（共 2）；复制与导出两击都没有再问。
    expect(listReads()).toBe(2);
  });
});

describe("R252 - neither station leaks the other's excluded row", () => {
  it("hands over each station's own rows, positionally, and nothing of the other", async () => {
    await render(STATION_A);
    const fileA = await exportRecords();
    expect(fileA.map((cells) => cells[COL.rid])).toEqual([`req-${ROW_A}`, `req-${ROW_B}`]);
    expect(fileA[1]?.[COL.actor]).toBe(WHO_B); // 站 A 的第二行是另一位操作者，列值同样逐字
    expect(fileA).toHaveLength(paintedRows().length);
    expect(shownCount()).toBe(fileA.length);
    expect(captured.text).toContain(`req-${ROW_B}`); // 站 A 的账里有被站 B 筛掉的那一行

    await render(STATION_B);
    const fileB = await exportRecords();
    expect(fileB.map((cells) => cells[COL.rid])).toEqual([`req-${ROW_A}`]);
    expect(fileB).toHaveLength(paintedRows().length);
    expect(shownCount()).toBe(fileB.length);
    // 净新增的钉子：两次独立挂载的文件互不包含对方筛掉的行（活切换站归 R235:352，此处不同）。
    expect(captured.text).not.toContain(`req-${ROW_B}`);
    expect(captured.text).not.toContain(ACTOR_B);
  });
});
