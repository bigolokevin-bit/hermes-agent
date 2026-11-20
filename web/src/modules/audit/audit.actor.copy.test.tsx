// @vitest-environment jsdom
// R235 — 行复制与导出在 actor 筛选下的同源：复制行、屏上面与 CSV 必须是同一句话的
// 三种投影；换一个人的筛选，行集与复制内容必须一起换代。
//
// 已覆盖、这里不重写（只回证据）：
// - `detailCopy.test.tsx`（R121）钉住了复制行本身的措辞族与三态回退；
// - `audit.filters.test.tsx`（R133）钉住了非法档/非法 limit 不改写地址；
// - `audit.export.columns.test.tsx`（R205②③）钉住了表体单元↔CSV 逐列与缺值阶梯
//   （actor「未指派」/resource「—」/时间与请求编号才是真空字段）；
// - `audit.detail.fields.parity.test.tsx`（R208①②）钉住了四处同词与【缺值四处同句】
//   —— 工单②的缺值拼接已由它持有，本文件只补现值段落的 复制↔CSV 直接逐字；
// - `audit.filter.counts.test.tsx`（R214②）与 `audit.detail.list.parity.test.tsx`
//   （R227④）分别钉住了 chip 移除三角与 tier-stack 下表体↔CSV+导出零请求。
//
// 口径差登记（按现状钉，不按工单措辞伪造）：
// (a) 工单写 `?actor=ou_x` —— 本页 actor 句柄形态是 `user:<16 位十六进制>`，短码取末 8 位；
//     示例占位句柄按现状换成真实形态。
// (b) 工单③说「复制序号」—— 复制行没有序号概念（它是单条事件的一句话），能钉的是
//     切 actor 后行序、计数与复制内容一起换代、旧人不残留。
// (c) 每行的复制件只有一枚：详情抽屉的 `aud-detail-copy`（行内预览的结论行是
//     `audC-copy`，同一句话的两条腿，R121 持有）；逐行复制 = 逐行开详情再复制。

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
const ACTION_WORDS = "创建任务";
const RESOURCE = "ap_1122334455667788";
const OBJECT = "审批单 · 55667788";
const ZONE = "北京时间（UTC+8）";

const ROW_A1 = "evt_r235_alpha1_00001";
const ROW_A2 = "evt_r235_alpha2_00001";
const ROW_B1 = "evt_r235_bravo1_00001";

const FILTERED = `/audit?window=7d&actor=${encodeURIComponent(ACTOR_A)}`;

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
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

function markValue(testId: string): string {
  return document.querySelector(`[data-testid='${testId}']`)?.getAttribute("data-audj-value") ?? "";
}

function shownCount(): number {
  const digits = /(\d+)/.exec(node("aud01-status")?.textContent ?? "");
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

async function openRecord(id: string): Promise<void> {
  clickNodeSync(`aud01-cell-${id}-type`, "row button");
  await waitFor(() => node("aud02-detail") !== null, "detail opened");
}

function clickNodeSync(testId: string, label: string): void {
  const target = node(testId);
  expect(target, label).not.toBeNull();
  (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

async function closeRecord(): Promise<void> {
  clickNodeSync("aud8-back-to-list", "back button");
  await waitFor(() => node("aud02-detail") === null, "detail closed");
}

// ── 复制件：与 R220/R227 同一套剪贴板桩 ──────────────────────────────────────
const clip = { calls: [] as string[] };

function stubClipboard(): void {
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.navigator, "clipboard", {
    value: { writeText: async (text: string) => void clip.calls.push(text) },
    configurable: true,
  });
}

async function copiedLine(): Promise<string> {
  const before = clip.calls.length;
  await clickNode(node("aud-detail-copy"), "aud-detail-copy");
  await waitFor(() => clip.calls.length > before, "the copy landed on the clipboard");
  return clip.calls[clip.calls.length - 1];
}

// ── 文件怎么到手：与 R205/R227 同一套下载捕获 ────────────────────────────────
const blobs = new Map<string, Blob>();
const captured: { name: string; text: string } = { name: "", text: "" };

function watchBlobs(): void {
  blobs.clear();
  captured.name = "";
  captured.text = "";
  URL.createObjectURL = ((blob: Blob) => {
    const url = `blob:r235-${blobs.size + 1}`;
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

async function exportFile(): Promise<string[][]> {
  captured.text = "";
  await clickNode(node("aud01-export"), "aud01-export");
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
};

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: { type?: string; id?: string; displayName?: string };
  resource: { type?: string; id?: string };
  requestId: string | null;
}

function rowOf(eventId: string, actor: Row["actor"], index: number): Row {
  return {
    eventId,
    action: ACTION,
    occurredAt: `2026-11-19T01:2${index}:00Z`,
    outcome: "succeeded",
    actor,
    resource: { type: "approval", id: RESOURCE },
    requestId: `req-${eventId}`,
  };
}

const ROWS_A: Row[] = [
  rowOf(ROW_A1, { type: "human", id: ACTOR_A, displayName: "李思" }, 0),
  rowOf(ROW_A2, { type: "human", id: ACTOR_A, displayName: "李思" }, 1),
];
const ROWS_ALL: Row[] = [...ROWS_A, rowOf(ROW_B1, { type: "human", id: ACTOR_B, displayName: "王五" }, 2)];

function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      const id = paramOf(target, "id");
      return { audit: ROWS_ALL.find((row) => row.eventId === id) ?? ROWS_ALL[0] };
    }
    const actorId = paramOf(target, "actorId");
    if (actorId === ACTOR_A) return { items: ROWS_A, nextCursor: null };
    if (actorId === ACTOR_B) return { items: [ROWS_ALL[2]], nextCursor: null };
    return { items: ROWS_ALL, nextCursor: null };
  });
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  clip.calls = [];
  stubClipboard();
  watchBlobs();
  answer();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R235 - the copied line is the row's own sentence", () => {
  it("copies time, operator, action and object exactly as the screen shows them", async () => {
    await render(FILTERED);
    expect(paramOf(lastListRead(), "actorId")).toBe(ACTOR_A);
    expect(paintedRows()).toEqual([ROW_A1, ROW_A2]);
    for (const [id, index] of [
      [ROW_A1, 0],
      [ROW_A2, 1],
    ] as const) {
      await openRecord(id);
      const line = await copiedLine();
      // 屏上那一秒原样进复制行，时区写法与屏面一致
      const face = markValue(`audJ-time-list-${id}`);
      expect(face).toBe(`2026-11-19 09:2${index}:00`);
      expect(line.startsWith(`${face} ${ZONE}`)).toBe(true);
      // actor 是「显示名 · 末 8 位短码」，动作是人话，对象带短码
      expect(line).toContain(WHO_A);
      expect(line).toContain(ACTION_WORDS);
      expect(line).toContain(OBJECT);
      // 裸句柄不进复制行
      expect(line).not.toContain(ACTOR_A);
      expect(line).not.toContain(RESOURCE);
      await closeRecord();
    }
  });
});

describe("R235 - the file and the copy speak the same words", () => {
  it("keeps the time and operator segments byte-equal between line and CSV, asking nothing", async () => {
    await render(FILTERED);
    await openRecord(ROW_A1);
    const line = await copiedLine();
    await closeRecord();
    const asksBefore = urls();
    const file = await exportFile();
    // 导出是纯本地动作：fetchJSON 的账本一字未增
    expect(urls()).toEqual(asksBefore);
    expect(listReads()).toBe(1);
    expect(file).toHaveLength(paintedRows().length);
    const record = file[0];
    // 时间：复制行到秒、文件到分钟 —— 前缀必须一致（现状口径，R153 持有分秒差）
    expect(line.startsWith(record[COL.time])).toBe(true);
    // actor：复制段与 CSV 列是同一串「显示名 · 短码」
    expect(record[COL.actor]).toBe(WHO_A);
    expect(line).toContain(WHO_A);
    expect(record[COL.type]).toBe(ACTION_WORDS);
    expect(record[COL.object]).toBe(OBJECT);
    // 缺值的两处阶梯（复制「未指派」/「—」 vs CSV 真空字段）由 R208②/R205③ 持有，不重写
    expect(record.join("|")).not.toContain("undefined");
    expect(record.join("|")).not.toContain(ACTOR_A);
  });
});

describe("R235 - switching the operator swaps rows and copies together", () => {
  it("leaves no trace of the previous operator once the new answer is on", async () => {
    await render("/audit?window=7d");
    expect(paintedRows()).toEqual([ROW_A1, ROW_A2, ROW_B1]);
    await pickByValue("aud01-filter-operator", ACTOR_B);
    await waitFor(() => listReads() === 2, "the operator question re-asked");
    expect(paramOf(lastListRead(), "actorId")).toBe(ACTOR_B);
    // 行集换代：整页替换（R161/R212 持有账本），旧人不残留
    expect(paintedRows()).toEqual([ROW_B1]);
    expect(shownCount()).toBe(paintedRows().length);
    expect(node("aud01-status")?.textContent ?? "").toContain("已显示 1 条");
    // 复制行跟着换人：新句里没有旧 actor
    await openRecord(ROW_B1);
    const line = await copiedLine();
    expect(line).toContain(WHO_B);
    expect(line).not.toContain(WHO_A);
    expect(line).not.toContain(ACTOR_A);
    // 导出也只带新人
    const file = await exportFile();
    expect(file).toHaveLength(1);
    expect(file[0][COL.actor]).toBe(WHO_B);
  });
});
