// @vitest-environment jsdom
// R238 — 时间四载体的时区一致性：同一个时刻在列表、详情、复制句与文件里，
// 只能是同一串绝对读数的不同精度，不许一处相对一处绝对混着说。
//
// 已覆盖、这里不重写（只回证据与缺口）：
// - `AuditEventsModulePage.test.tsx`「the list row, the preview and the record pane print
//   one identical instant」(:3265) 钉住了三个标记面值相等、mark title 带「（UTC）」与
//   「北京时间（UTC+8）」的来源注记，并断过整页无「分钟前/小时前/昨天/刚刚」；
// - `audit.time.test.tsx`（R153）四处同秒与【文件到分钟、屏上到秒】的精度口径、
//   复制句的同一 zone wording；`audit.export.columns.test.tsx`（R205②）表体↔CSV 前缀梯；
// - `audit.time.window.parity.test.tsx`（R229②）钉过【custom 区间 apply】后的行集换代
//   无残留（列表/复制腿）；`audit.list.order.stability.test.tsx`（R236）钉过档位参数字符串
//   变化时的表体与文件位置序；
// - 工单③「开合零额外请求、读数行与行序不变」由 R196/R201③/R208③/R222①②/R227② 整体
//   持有 —— 本波只把语境换成【无筛选的 7d 默认档】做一次防回归拼接，不发明新承诺。
//
// 本文件只补真正没拼过的 joints：
// ① 「混用而不标注」这一条的正向钉法：复制句【带】时区标注（ZONE 在句内）、
//   CSV 时间列【不写】任何时区后缀、屏上串以文件串为前缀 —— 三种形态同一次读数；
//   且 copied line、整份文件、详情正文里相对时段词零出现（面级无相对由 :3265 持有，
//   文件与复制句两载体此前没断过）。
// ② 【档位按钮】aud01-filter-window-7d 换窗后的换代：表体、读数行、重开的复制句、
//   新导出的 CSV 四处同时零旧时刻 —— R229② 换的是 custom apply，按钮腿没带过 CSV/复制。
// ③ 裸地址（无任何筛选）语境下的开合防回归。
//
// R239（同工单三例，本文件即其点名文件）：①②③已由上面 R238 三例整体持有，只回证据
// （tip 见车道历史）。净新增只有一处没拼过的口子：【冷地址直接挂 7d】（R238① 冷挂载是
// 30d，② 是档位按钮换到 7d）——深链/收藏直接进窄窗时，四载体必须当场就是窄窗的读数，
// 宽窗的时刻一格都不许出现。工单 commit 主语与本文件首波只差一个词（time vs detail
// timezone），按「已覆盖只回证据 + 净新增单独一枚 commit」处理。

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
const ZONE = "北京时间（UTC+8）";

const ROW_N = "evt_r238_nova_000001";
const ROW_M = "evt_r238_mike_00000001";
const ROW_G = "evt_r238_golf_000001";

const TIME_N = "2026-11-19 09:22:00";
const TIME_G = "2026-11-02 09:30:00";
// 相对口径的词族：不许出现在任何一个载体里（:3265 只在页面上断过）
const RELATIVES = ["分钟前", "小时前", "昨天", "刚刚", "今天"];

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

const NEW_N = rowOf(ROW_N, "2026-11-19T01:22:00Z");
const NEW_M = rowOf(ROW_M, "2026-11-19T01:21:00Z");
const OLD_G = rowOf(ROW_G, "2026-11-02T01:30:00Z");
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

/** 档位不上线，上线的是成对 from/to（R161/R208 口径）；这里用它反查档位跨度。 */
function spanOf(url: string): number {
  const from = paramOf(url, "from");
  const to = paramOf(url, "to");
  if (from === null || to === null) return -1;
  return (Date.parse(to) - Date.parse(from)) / 86_400_000;
}

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

function shownCount(): number {
  const digits = /(\d+)/.exec(textOf("aud01-status"));
  return digits ? Number(digits[1]) : -1;
}

function exportCountDigits(): number {
  const digits = /(\d+)/.exec(textOf("aud5-export-count"));
  return digits ? Number(digits[1]) : -1;
}

async function clickNode(target: Element | null | undefined, label: string): Promise<void> {
  expect(target, label).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function clickNodeSync(testId: string, label: string): Promise<void> {
  await clickNode(node(testId), label);
}

async function openRecord(eventId: string): Promise<void> {
  await clickNodeSync(`aud01-cell-${eventId}-type`, `row ${eventId}`);
  await waitFor(() => node("aud02-detail") !== null, "the detail pane opened");
}

async function closeRecord(): Promise<void> {
  await clickNodeSync("aud8-back-to-list", "back to the list");
  await waitFor(() => node("aud02-detail") === null, "the detail pane closed");
}

// ── 复制件怎么到手 ─────────────────────────────────────────────────────────
const clip = { calls: [] as string[] };

function stubClipboard(): void {
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
}

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
    const url = `blob:r238-${blobs.size + 1}`;
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
  rid: CSV_HEADER.indexOf("请求编号"),
};

function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      const id = paramOf(target, "id");
      return { audit: ALL.find((item) => item.eventId === id) ?? ALL[0] };
    }
    // 现状口径：宽档（>=29 天跨度）回全集，窄档把 11-02 那条留在窗外。
    const rows = spanOf(target) >= 29 ? [NEW_N, NEW_M, OLD_G] : [NEW_N, NEW_M];
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

describe("R238 - one absolute instant, four carriers", () => {
  it("prints one reading with the zone said in the copy, and nowhere as a relative phrase", async () => {
    await render("/audit?window=30d");
    expect(paintedRows()).toEqual([ROW_N, ROW_M, ROW_G]);
    await openRecord(ROW_N);
    // 屏上两处：列表标记与面板标记是同一串（面值与 title 时区注记归 :3265/R153）
    expect(markValue(`audJ-time-list-${ROW_N}`)).toBe(TIME_N);
    expect(markValue("audJ-time-detail")).toBe(TIME_N);
    // 复制句：同一串 + 时区就写在句里 —— 「带标注」的一半
    const line = await copiedLine();
    expect(line.startsWith(`${TIME_N} ${ZONE}`)).toBe(true);
    // 文件：同一读数的分钟精度，不写任何时区后缀 —— 「不标注」的另一半
    const records = await exportRecords();
    const record = records.find((cells) => cells[COL.rid] === `req-${ROW_N}`);
    expect(record, "the event reached the file").not.toBeUndefined();
    const cells = record as string[];
    expect(cells[COL.time]).toBe("2026-11-19 09:22");
    expect(TIME_N.startsWith(cells[COL.time])).toBe(true);
    for (const zoneless of ["UTC", "北京时间"]) {
      expect(cells[COL.time]).not.toContain(zoneless);
    }
    // 混用不标注=不许存在：相对时段词在三个载体里都零出现
    // （列表页面上的那条断言由主测试 :3265 持有，这里补复制句与文件两载体）
    await closeRecord();
    const detailBody = textOf("aud01-filters") + document.body.textContent;
    for (const phrase of RELATIVES) {
      expect(line).not.toContain(phrase);
      expect(captured.text).not.toContain(phrase);
      expect(detailBody).not.toContain(phrase);
    }
  });
});

describe("R238 - the tier button swaps every carrier at once", () => {
  it("leaves no old instant in the table, the readout, the copy or the file", async () => {
    await render("/audit?window=30d");
    expect(spanOf(urls()[0] ?? "")).toBeGreaterThanOrEqual(29);
    // 旧行先看一眼：复制句与文件里都带旧时刻 —— 换代承诺要有对照面
    await openRecord(ROW_G);
    const oldLine = await copiedLine();
    expect(oldLine).toContain(TIME_G);
    await closeRecord();
    const before = await exportRecords();
    expect(before.some((cells) => cells[COL.time].startsWith("2026-11-02"))).toBe(true);
    // 档位按钮换到 7d：档位不上线，上线的是新的 from/to 对（R161/R208 口径）
    await clickNodeSync("aud01-filter-window-7d", "7d tier button");
    await waitFor(() => listReads() === 2, "the narrowed question landed");
    const read = urls()[urls().length - 1] ?? "";
    expect(paramOf(read, "window")).toBeNull();
    expect(spanOf(read)).toBeLessThan(29);
    expect(paintedRows()).toEqual([ROW_N, ROW_M]);
    expect(shownCount()).toBe(paintedRows().length);
    // 文件换代：旧时刻在整份 CSV 里一处不留
    const after = await exportRecords();
    expect(after).toHaveLength(2);
    expect(captured.text).not.toContain("2026-11-02");
    // 复制句换代：重开留下的那一行，句里是它自己的时刻，旧串零出现
    await openRecord(ROW_N);
    const newLine = await copiedLine();
    expect(newLine.startsWith(`${TIME_N} ${ZONE}`)).toBe(true);
    expect(newLine).not.toContain(TIME_G);
    await closeRecord();
  });
});

describe("R238 - open and close on the bare default window", () => {
  it("asks once for the record, then asks nothing and moves nothing", async () => {
    await render("/audit?window=7d");
    // 无筛选裸档语境（形态归 R196/R201③/R208③/R222/R227②，这里只换语境防回归）
    expect(paintedRows()).toEqual([ROW_N, ROW_M]);
    const statusBefore = textOf("aud01-status");
    const rowsBefore = paintedRows();
    const callsBefore = urls().length;
    await openRecord(ROW_N);
    expect(detailReads()).toBe(1);
    expect(paramOf(urls()[callsBefore] ?? "", "id")).toBe(ROW_N);
    expect(listReads()).toBe(1);
    expect(urls().length).toBe(callsBefore + 1);
    expect(textOf("aud01-status")).toBe(statusBefore);
    expect(paintedRows()).toEqual(rowsBefore);
    await closeRecord();
    expect(detailReads()).toBe(1);
    expect(listReads()).toBe(1);
    expect(urls().length).toBe(callsBefore + 1);
    expect(textOf("aud01-status")).toBe(statusBefore);
    expect(paintedRows()).toEqual(rowsBefore);
    expect(exportCountDigits()).toBe(rowsBefore.length);
  });
});

describe("R239 - the cold address opens on the narrow window", () => {
  it("answers with the new window in every carrier and carries nothing of the wider one", async () => {
    await render("/audit?window=7d");
    // 冷挂载防残留：宽窗的那一格时刻不许在任何载体里出现
    const read = urls()[urls().length - 1] ?? "";
    expect(spanOf(read)).toBeLessThan(29);
    expect(paramOf(read, "window")).toBeNull();
    expect(paintedRows()).toEqual([ROW_N, ROW_M]);
    expect(shownCount()).toBe(2);
    await openRecord(ROW_N);
    expect(markValue(`audJ-time-list-${ROW_N}`)).toBe(TIME_N);
    expect(markValue("audJ-time-detail")).toBe(TIME_N);
    const line = await copiedLine();
    expect(line.startsWith(`${TIME_N} ${ZONE}`)).toBe(true);
    expect(line).not.toContain(TIME_G);
    const records = await exportRecords();
    expect(records).toHaveLength(2);
    expect(captured.text).not.toContain("2026-11-02");
    const index = records.findIndex((cells) => cells[COL.rid] === `req-${ROW_N}`);
    expect(index).toBeGreaterThan(-1);
    expect(records[index]?.[COL.time]).toBe("2026-11-19 09:22");
    expect(TIME_N.startsWith(records[index]?.[COL.time] ?? "")).toBe(true);
    await closeRecord();
  });
});
