// @vitest-environment jsdom
// R236 - 列表序与复制对应：这一页回到「服务怎么回，就怎么排」，行序、读数行、复制句
// 与导出文件必须按同一个顺序说话。
//
// 已覆盖、这里不重写（只回证据）：
// - `audit.actor.copy.test.tsx`（R235）钉住了 actor 筛选下逐行复制句与 CSV 同源、切 actor
//   后整页换代无残留；
// - `audit.export.columns.test.tsx`（R205）钉住了「文件行数==表体==读数行」三角与逐列对照
//   —— 但它是按请求编号【查找】行的，从没钉过【位置序】；
// - `audit.filter.counts.test.tsx`（R214）与 `audit.actor.resource.test.tsx`（R230）钉住了
//   chip 移除恰 1 次取数与三值重算；`audit.chips.test.tsx`（R224）持有 removeChip 的账本手法；
// - `audit.paging.test.tsx`（R161）与 `audit.window.bounds.test.tsx`（R203）钉住了档位边界
//   与切档保维；sorting 家族（R190 + `sorting.test.ts`）钉住了「清排序回到服务回行顺序」。
// - R233/R234 从未在本道落盘（现查文件不存在），本波不引用其口径。
//
// 本文件只补真正的新东西：
// ① 切 7d/30d 后公共行相对序不变（30d 在尾部追加更旧的行 —— 现状：服务固定新在前，
//    清排序就回服务序），读数行逐次与表体对账，且按表体顺序逐行复制、第 i 句就是第 i 行；
// ② 切 actor 后屏上首行就是回行集的首行，复制与导出按【位置】对齐表体，复制点击与导出
//    点击都不新增任何请求（fetchJSON 账本逐字不动）；
// ③ 移除动作 chip 恰 1 次取数回到全量，行唯一、无重复无残留，每行复制句只含自己。
// 口径差登记：工单说「aud-detail-copy 序号」/「复制序号从 0 连续」—— 复制件是单条事件的
// 一句话，页面上没有序号这个概念（R235 已登记同款）。诚实的钉法是按表体逐行开详情再复制，
// 第 i 行的复制句只含第 i 行自身的时间与操作者（各归各行、无串号、无重复）。
// 地址动作键是 type=、线路才是 action=；档位从不直接上线，上线的是 from/to 对（既有口径）。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { CSV_HEADER } from "@/modules/audit/csv";
import { pickByValue } from "@/shell/selectHarness";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTOR_A = "user:2f3a4b5c6d7e8f90";
const WHO_A = "李思 · 6d7e8f90";
const ACTOR_B = "user:cafe1234beef5678";
const WHO_B = "王五 · beef5678";
const ACTION = "task.created";
const ZONE = "北京时间（UTC+8）";
const DAY = 86_400_000;

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: { type?: string; id?: string; displayName?: string };
  resource: { type?: string; id?: string };
  requestId: string | null;
}

function rowOf(eventId: string, actorHandle: string, displayName: string, instant: string): Row {
  return {
    eventId,
    action: ACTION,
    occurredAt: instant,
    outcome: "succeeded",
    actor: { type: "human", id: actorHandle, displayName },
    resource: { type: "approval", id: "ap_1122334455667788" },
    requestId: `req-${eventId}`,
  };
}

// 服务回行的顺序就是最终上屏的顺序（新在前，现状合同：清排序回到服务回行顺序）。
const ROW_N = rowOf("evt_r236_nova_000001", ACTOR_A, "李思", "2026-11-19T01:22:00Z");
const ROW_M = rowOf("evt_r236_mike_0000001", ACTOR_A, "李思", "2026-11-19T01:21:00Z");
const ROW_K = rowOf("evt_r236_kilo_0000001", ACTOR_B, "王五", "2026-11-19T01:20:00Z");
const ALL = [ROW_N, ROW_M, ROW_K];

const RID_COL = CSV_HEADER.indexOf("请求编号");

let root: Root | null = null;
const clip = { calls: [] as string[] };

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
  return node(testId)?.getAttribute("data-audj-value") ?? "";
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}

/** 档位上线的是 from/to 对；用两端之差认出当前问的是哪一档。 */
function spanOf(url: string): number {
  const from = Date.parse(paramOf(url, "from") ?? "");
  const to = Date.parse(paramOf(url, "to") ?? "");
  return Number.isNaN(from) || Number.isNaN(to) ? -1 : (to - from) / DAY;
}

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

/** 读数行「已显示 N 条」里的那个 N；句子档（空态/错误态）没有数字。 */
function shownCount(): number {
  const digits = /(\d+)/.exec(textOf("aud01-status"));
  return digits ? Number(digits[1]) : -1;
}

async function clickNodeSync(testId: string, label: string): Promise<void> {
  const target = node(testId);
  expect(target, label).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function openRecord(eventId: string): Promise<void> {
  await clickNodeSync(`aud01-cell-${eventId}-type`, "row action");
  await waitFor(() => node("aud02-detail") !== null, "the drawer opened");
}

async function closeRecord(): Promise<void> {
  await clickNodeSync("aud8-back-to-list", "back to list");
  await waitFor(() => node("aud02-detail") === null, "the drawer closed");
}

function stubClipboard(): void {
  clip.calls = [];
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.navigator, "clipboard", {
    value: {
      writeText: (text: string) => {
        clip.calls.push(text);
        return Promise.resolve();
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

// ── 文件怎么到手 ────────────────────────────────────────────────────────────
const blobs = new Map<string, Blob>();
const captured = { name: "", text: "" };

function watchBlobs(): void {
  blobs.clear();
  captured.name = "";
  captured.text = "";
  URL.createObjectURL = ((blob: Blob) => {
    const url = `blob:r236-${blobs.size + 1}`;
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

async function exportFile(): Promise<string[][]> {
  captured.text = "";
  await clickNodeSync("aud01-export", "aud01-export");
  await waitFor(() => captured.text !== "", "the export was handed over");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  return dataLines().map(parseRecord);
}

const chipKeys = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud-chip-']"))
    .map((element) => String(element.getAttribute("data-testid")))
    .filter((testId) => !testId.endsWith("-clear"))
    .map((testId) => testId.replace("aud-chip-", ""));

/** 移除一枚 chip 的账本按相对基线记：问句变了才允许恰 1 次重新提问。 */
async function removeChipOneAsk(key: string): Promise<void> {
  const asks = listReads();
  const calls = urls().length;
  await clickNodeSync(`aud-chip-${key}-clear`, `chip ${key} clear`);
  await waitFor(() => listReads() === asks + 1, `removing ${key} re-asked once`);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  expect(urls().length).toBe(calls + 1);
}

function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      const wanted = paramOf(target, "id");
      return { audit: ALL.find((row) => row.eventId === wanted) ?? ROW_N };
    }
    const actor = paramOf(target, "actorId");
    const action = paramOf(target, "action");
    const items =
      actor === ACTOR_B
        ? [ROW_K]
        : actor === ACTOR_A
          ? action !== null
            ? [ROW_N]
            : [ROW_N, ROW_M]
          : spanOf(target) >= 29
            ? [ROW_N, ROW_M, ROW_K]
            : [ROW_N, ROW_M];
    return { items, nextCursor: null };
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

describe("R236 - widening the window keeps the answered order", () => {
  it("appends the older rows, reconciles the readout, and the copies follow the table", async () => {
    await render(`/audit?window=7d`);
    const week = lastListRead();
    // 档位不上线，上线的是 from/to 对（R161/R208 口径）
    expect(paramOf(week, "window")).toBeNull();
    expect(paramOf(week, "from")).not.toBeNull();
    expect(spanOf(week)).toBeLessThan(29);
    const narrow = paintedRows();
    expect(narrow).toEqual(["evt_r236_nova_000001", "evt_r236_mike_0000001"]);
    expect(shownCount()).toBe(narrow.length);

    await render(`/audit?window=30d`);
    expect(spanOf(lastListRead())).toBeGreaterThanOrEqual(29);
    const wide = paintedRows();
    // 公共行相对序不变，更旧的行按「新在前」追加在尾部 —— 行序稳定 = 对应，不是冻数
    expect(wide.slice(0, narrow.length)).toEqual(narrow);
    expect(wide).toEqual([
      "evt_r236_nova_000001",
      "evt_r236_mike_0000001",
      "evt_r236_kilo_0000001",
    ]);
    expect(shownCount()).toBe(wide.length);

    // 复制件没有序号（现状），诚实的钉法：按表体顺序逐行开详情再复制，第 i 句就是第 i 行
    for (const eventId of wide) {
      await openRecord(eventId);
      const line = await copiedLine();
      const own = markValue(`audJ-time-list-${eventId}`);
      expect(own).not.toBe("");
      expect(line.startsWith(`${own} ${ZONE}`)).toBe(true);
      expect(line).toContain(eventId === "evt_r236_kilo_0000001" ? WHO_B : WHO_A);
      await closeRecord();
    }
  });
});

describe("R236 - the operator switch keeps every projection first-row-first", () => {
  it("puts the served head on top, aligns copies and file by position, and asks nothing to copy or export", async () => {
    await render(`/audit?window=30d`);
    expect(paintedRows()).toEqual([
      "evt_r236_nova_000001",
      "evt_r236_mike_0000001",
      "evt_r236_kilo_0000001",
    ]);

    await act(async () => {
      await pickByValue("aud01-filter-operator", ACTOR_A);
    });
    await waitFor(() => listReads() === 2, "the operator question asked once");
    expect(paramOf(lastListRead(), "actorId")).toBe(ACTOR_A);
    const rows = paintedRows();
    expect(rows).toEqual(["evt_r236_nova_000001", "evt_r236_mike_0000001"]);
    // 屏上首行就是回行集的首行
    expect(rows[0]).toBe("evt_r236_nova_000001");

    await openRecord(rows[0] as string);
    const calls = urls();
    const asks = listReads();
    const line = await copiedLine();
    expect(line).toContain(markValue(`audJ-time-list-${rows[0]}`));
    // 复制不是重新提问的理由：账本逐字不动
    expect(urls()).toEqual(calls);
    expect(listReads()).toBe(asks);
    await closeRecord();
    expect(urls()).toEqual(calls);

    const records = await exportFile();
    // 导出同样零请求，且【位置序】与表体逐位对齐（净新增：R205② 只按编号查找过）
    expect(urls()).toEqual(calls);
    expect(listReads()).toBe(asks);
    expect(records.map((record) => record[RID_COL])).toEqual([
      "req-evt_r236_nova_000001",
      "req-evt_r236_mike_0000001",
    ]);
    expect(records[0]?.join(",")).toContain(WHO_A);
    for (const record of records) {
      expect(record.join(",")).not.toContain(ACTOR_A);
      expect(record.join(",")).not.toContain(ACTOR_B);
    }
  });
});

describe("R236 - clearing the action chip returns the full page", () => {
  it("re-asks exactly once, keeps rows unique without residue, and each copy stays its own", async () => {
    await render(
      `/audit?window=7d&actor=${encodeURIComponent(ACTOR_A)}&type=${ACTION}`,
    );
    expect(paintedRows()).toEqual(["evt_r236_nova_000001"]);
    expect(chipKeys()).toContain("action");

    await removeChipOneAsk("action");
    const after = lastListRead();
    expect(paramOf(after, "action")).toBeNull();
    expect(paramOf(after, "actorId")).toBe(ACTOR_A);
    expect(node("aud-chip-action")).toBeNull();

    const rows = paintedRows();
    expect(rows).toEqual(["evt_r236_nova_000001", "evt_r236_mike_0000001"]);
    expect(new Set(rows).size).toBe(rows.length); // 无重复
    expect(shownCount()).toBe(rows.length); // 无残留：读数行与表体同为全量

    for (let index = 0; index < rows.length; index += 1) {
      const eventId = rows[index] as string;
      const other = rows[index === 0 ? 1 : 0] as string;
      await openRecord(eventId);
      const line = await copiedLine();
      expect(line).toContain(markValue(`audJ-time-list-${eventId}`));
      expect(line).not.toContain(markValue(`audJ-time-list-${other}`));
      await closeRecord();
    }

    const records = await exportFile();
    expect(records.map((record) => record[RID_COL])).toEqual([
      "req-evt_r236_nova_000001",
      "req-evt_r236_mike_0000001",
    ]);
    expect(listReads()).toBe(2);
  });
});
