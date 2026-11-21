// @vitest-environment jsdom
// R261 — 窗口 × 详情 × 复制的三向时间一致性。
//
// 已覆盖、这里不重写（只回证据）：
// - `audit.detail.timezone.test.tsx:321`（R238①）钉住了同一事件在 列表标记 × 详情标记 ×
//   复制句 × CSV 四处是同一绝对时刻、复制句带「北京时间（UTC+8）」标注、页面上相对词零出现；
//   标记 title 的「（UTC）/北京时间（UTC+8）/精确到秒」标注归主测试 :3265；
// - `audit.detail.timezone.test.tsx:354`（R238②）钉住了【宽换窄】档位按钮后 表体/读数行/
//   复制句/文件 四处零旧时刻残留；`audit.export.detail.open.test.tsx` 的换宽例（R247②）
//   钉住了【窄换宽】抽屉开着时——列表恰重取一次、导出换代带出宽窗独有行、抽屉读数冻结；
// - `audit.detail.timezone.test.tsx:380`（R238③）与 R196/R201③/R208③ 钉住了开合详情
//   的账本：恰一枚详情读、列表不重取、读数行与行序逐字不动。
//
// 本文件只补真正没钉过的一枚拼接：换宽之后【重开那条只有宽窗才回答的行】，
// 四处（行标记、详情标记、复制句、CSV 行）当场读同一时刻，且复制句不含窄窗那行的旧时刻。
// 现状登记（不弱化）：工单②「四处同步换代」按现状钉——已经打开着的抽屉不随换窗换代
// （读数冻结，R247②/R229② 两度实钉），同步发生在重开之后；所以本波断言的形状是
// 「重开后的四处」，而不是「抽屉里的旧读数自己会变」。
// 既有口径照抄：档位不上线路，线路上只有成对 from/to（R161/R208）；文件到分钟、屏上到秒
// ——CSV 格是秒值去掉「:ss」的精度（R153），按前缀梯核对，不伪造逐字相等。

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

const ROW_N = "evt_r261_nova_000001";
const ROW_M = "evt_r261_mike_00000001";
const ROW_G = "evt_r261_golf_000001";

const TIME_N = "2026-11-19 09:22:00";
const TIME_G = "2026-11-02 09:30:00";
const TIME_G_FILE = "2026-11-02 09:30";

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
    const url = `blob:r261-${blobs.size + 1}`;
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
      return { audit: ALL.find((row) => row.eventId === id) ?? ALL[0] };
    }
    const rows = spanOf(target) >= 29 ? ALL : [NEW_N, NEW_M];
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

describe("R261 - after widening, the reopened wide-only row reads one instant everywhere", () => {
  it("swaps the reading into the row, the pane, the copy and the file at once", async () => {
    await render("/audit?window=7d&limit=25");
    expect(listReads()).toBe(1);
    expect(paintedRows()).toEqual([ROW_N, ROW_M]);
    expect(shownCount()).toBe(2);

    // 窄窗基线：复制句说 TIME_N 与 ZONE（形制归 R238①，这里只留对照面）。
    await openRecord(ROW_N);
    const narrowLine = await copiedLine();
    expect(narrowLine.startsWith(`${TIME_N} ${ZONE}`)).toBe(true);
    await closeRecord();

    // 档位按钮换宽：列表恰重取一次、档位不上线只 from/to 对（R161/R247② 口径）。
    const asks = listReads();
    await clickNodeSync("aud01-filter-window-30d", "the 30d tier");
    await waitFor(() => listReads() === asks + 1, "the wide window was asked for");
    const read = urls()[urls().length - 1] ?? "";
    expect(spanOf(read)).toBeGreaterThanOrEqual(29);
    expect(paramOf(read, "window")).toBeNull();
    expect(paintedRows()).toEqual([ROW_N, ROW_M, ROW_G]);
    expect(shownCount()).toBe(paintedRows().length);

    // 重开那条只有宽窗才回答的行：四处当场同读 TIME_G。
    // 现状登记：换窗瞬间已开的抽屉读数冻结（R247②/R229② 两度实钉）——「同步」按现状
    // 钉为重开后的四处同读，而不是旧抽屉自己会变。
    await openRecord(ROW_G);
    expect(markValue(`audJ-time-list-${ROW_G}`)).toBe(TIME_G);
    expect(markValue("audJ-time-detail")).toBe(TIME_G);
    clip.calls.length = 0;
    const wideLine = await copiedLine();
    expect(wideLine.startsWith(`${TIME_G} ${ZONE}`)).toBe(true);
    expect(wideLine).not.toContain(TIME_N); // 旧行时刻不随复制句串台
    await closeRecord();

    // 文件面：宽窗独有行的时间格与屏上秒值是同一读数的两种精度（R153 前缀梯）。
    const records = await exportRecords();
    expect(records).toHaveLength(paintedRows().length);
    const index = records.findIndex((cells) => cells[COL.rid] === `req-${ROW_G}`);
    expect(index, "the wide-only row reached the file").toBeGreaterThan(-1);
    expect(records[index][COL.time]).toBe(TIME_G_FILE);
    expect(TIME_G.startsWith(records[index][COL.time])).toBe(true);
    expect(shownCount()).toBe(records.length);
  });
});
