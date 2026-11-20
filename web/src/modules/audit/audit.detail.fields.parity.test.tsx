// @vitest-environment jsdom
// R208 — 审计详情字段四处同源（决策面）：同一条事件的时间、操作者、动作、对象、
// 同一次操作，在【列表行】【详情面板】【aud-detail-copy 复制行】【导出 CSV】四处读到的
// 必须是同一句话，缺值时也是同一个词，而不是每面各自格式化一遍。
//
// 已覆盖、这里不重写（只回证据与缺口）：
// - `audit.parity.test.tsx`（R137）钉住了 actor/action/resource/时间在【行×详情×复制】
//   三面逐字、缺值三面同词、correlation 行↔详情同原值同短码、开→关行序与 chip 原样 —— 但没有 CSV 面；
// - `audit.detail.crossfilter.test.tsx`（R201）钉住了带全套筛选+深链时三面同句、窗档改写后
//   详情不动、缺值阶梯的复制行与 CSV、开关只一笔详情读 —— 但 present 行没对过 CSV，也没有 correlation；
// - `audit.time.test.tsx`（R153）钉住时间四处与【文件到分钟、屏上到秒】的精度差；
// - `audit.actor.test.tsx`（R177）钉住 actor 掩码四处同词含「未指派」；
// - `audit.export.columns.test.tsx`（R205）钉住表体单元↔CSV 逐列、空集 createObjectURL 为 0；
// - `detailCopy.test.tsx`（R121）钉住复制行本身的文案、status、fallback、disabled。
//
// 本文件补的真正新_joint：①一条记录五个字段【同时】过四面（R137 三面、R205 两面、谁也没把
// 四面摆在一个断言里）；②缺值时四面同词的联合口径（CSV 的空字段是真空字符串，屏上是词，
// 这是现状分层，不在本波统一）；③开→关不仅行序与地址，读数行 `aud01-status` 也逐字不变
// （R137/R201 都没钉这句）；④`?window=7d` 与 `?actor=` 叠加下四面仍同源（R201 用的是全套
// 筛选加深链，地址形状不同）。
//
// 缺口登记（现状，按实钉）：CSV 没有 correlation 列 —— 工单①的 correlation 只活在
// 【详情 关联 行】【复制行尾段】（外加 R137 已钉的模型层与折页原值）；复制行没有请求编号、
// 没有结果两节。这两条在回执里如实报，不假装四面全含。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { CSV_HEADER } from "@/modules/audit/csv";
import { shortCode } from "@/modules/audit/model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTOR = "user:2f3a4b5c6d7e8f90";
const WHO = "李思 · 6d7e8f90";
const ACTION = "task.created";
const ACTION_WORDS = "创建任务";
const RESOURCE = "ap_1122334455667788";
const OBJECT = "审批单 · 55667788";
// 现状：只有带 12 位以上十六进制串或机器句柄的值才会被掩码成「同一次操作 · 短码」，
// 短 slug 被视为人类可读数据原样保留 —— 夹具用可判定掩码的那一类。
const CORRELATION = "cor-7f3a9c21d4e8b056";
const CODE = shortCode(CORRELATION);

const FIRST = "evt_r208_first_0001";
const SECOND = "evt_r208_second_0001";
const BLANK_ID = "evt_r208_blank_0001";
const RID_FIRST = "req-a1b2c3d4e5f6";
const RID_SECOND = "req-77889900aabb";

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: { type?: string; id?: string; displayName?: string };
  resource: { type?: string; id?: string };
  requestId: string | null;
  correlationId?: string;
}

function rowOf(eventId: string, over: Partial<Row> = {}): Row {
  return {
    eventId,
    action: ACTION,
    occurredAt: "2026-11-19T01:20:00Z",
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: RESOURCE },
    requestId: `req-${eventId}`,
    correlationId: CORRELATION,
    ...over,
  };
}

const TWO: Row[] = [
  rowOf(FIRST, { requestId: RID_FIRST }),
  rowOf(SECOND, { occurredAt: "2026-11-19T01:21:00Z", requestId: RID_SECOND }),
];

const BLANK: Row[] = [
  rowOf(BLANK_ID, {
    actor: {},
    resource: {},
    requestId: null,
    correlationId: undefined,
    occurredAt: "2026-11-19T01:22:00Z",
  }),
];

function answer(rows: Row[]): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      const wanted = new URL(target, "http://console.test").searchParams.get("id");
      const found = rows.find((row) => row.eventId === wanted) ?? rows[0];
      return { audit: found };
    }
    return { items: rows, nextCursor: null };
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

function textOf(testId: string): string {
  return node(testId)?.textContent?.trim() ?? "";
}

/** Field 的值只在 dd：dt 是标签，读值必须落到 dd。 */
function fieldValue(testId: string): string {
  return document.querySelector(`[data-testid='${testId}'] dd`)?.textContent?.trim() ?? "";
}

/** 同源标记的机读值（data-audj-value），与屏上文本是一对。 */
function markValue(testId: string): string {
  return document.querySelector(`[data-testid='${testId}']`)?.getAttribute("data-audj-value") ?? "";
}

/** 详情面板里按标签找一格（关联 · 同一次操作 这类没有专属 testid 的面）。 */
function detailField(label: string): string {
  const pane = node("aud02-detail");
  if (!pane) return "";
  for (const dl of Array.from(pane.querySelectorAll("dl"))) {
    const dt = dl.querySelector("dt");
    if ((dt?.textContent ?? "").trim() !== label) continue;
    const dd = dl.querySelector("dd");
    return (dd?.textContent ?? "").trim();
  }
  return "";
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number =>
  urls().filter((url) => /^\/agent-api\/api\/audit\?/.test(url)).length;
const detailReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => /^\/agent-api\/api\/audit\?/.test(url)) ?? "";
const lastDetailRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit-detail")) ?? "";

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

async function clickNode(target: Element | null | undefined, label: string): Promise<void> {
  expect(target, label).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function openRecord(eventId: string): Promise<void> {
  await clickNode(node(`aud01-cell-${eventId}-type`), `open ${eventId}`);
  await waitFor(() => node("aud02-detail") !== null, "detail opened");
}

async function closeRecord(): Promise<void> {
  await clickNode(node("aud8-back-to-list"), "aud8-back-to-list");
  await waitFor(() => node("aud02-detail") === null, "detail closed");
}

// ── 复制行：剪贴板是第四个读者 ───────────────────────────────────────────────
const clip: { calls: string[] } = { calls: [] };

function stubClipboard(): void {
  clip.calls = [];
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: async (text: string) => clip.calls.push(text) },
    configurable: true,
  });
}

async function copiedLine(): Promise<string> {
  const before = clip.calls.length;
  await clickNode(node("aud-detail-copy"), "aud-detail-copy");
  await waitFor(() => clip.calls.length > before, "clipboard written");
  return clip.calls[clip.calls.length - 1];
}

// ── CSV：第五个读者是文件本身 ────────────────────────────────────────────────
const blobs = new Map<string, Blob>();
const captured: { text: string } = { text: "" };

function captureDownloads(): void {
  blobs.clear();
  captured.text = "";
  URL.createObjectURL = ((blob: Blob) => {
    const url = `blob:parity-${blobs.size + 1}`;
    blobs.set(url, blob);
    return url;
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    if (!this.download) return;
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
  rid: CSV_HEADER.indexOf("请求编号"),
};

function rowIn(file: string[][], rid: string): string[] {
  const found = file.find((record) => record[COL.rid] === rid);
  expect(found, `the event with ${rid} reached the file`).toBeDefined();
  return found as string[];
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  stubClipboard();
  captureDownloads();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R208 - one event, all faces, at once", () => {
  it("prints the same words in the row, the detail, the copied line and the file", async () => {
    answer(TWO);
    await render("/audit?window=7d");
    await openRecord(FIRST);
    const file = await exportFile();
    const columns = rowIn(file, RID_FIRST);

    // 时间：行、详情、复制行是同一句到秒；文件到分钟 —— 前缀必须一致（精度差由 R153 持有）
    const face = markValue(`audJ-time-list-${FIRST}`);
    expect(face).toBe("2026-11-19 09:20:00");
    expect(markValue("audJ-time-detail")).toBe(face);
    expect(face.startsWith(columns[COL.time])).toBe(true);
    expect(columns[COL.time]).toBe("2026-11-19 09:20");

    // 操作者：显示名 + 8 位短码，四面同一串，裸句柄哪面都不出现
    expect(fieldValue(`aud01-cell-${FIRST}-actor`)).toBe(WHO);
    expect(markValue("audJ-actor-detail")).toBe(WHO);
    expect(columns[COL.actor]).toBe(WHO);

    // 动作：表体、详情、文件都是那句人话，不是原始事件码
    expect(textOf("audA-detail-type")).toContain(ACTION_WORDS);
    expect(columns[COL.type]).toBe(ACTION_WORDS);

    // 对象：类型人话 + 短码，四面一致
    expect(fieldValue(`aud01-cell-${FIRST}-object`)).toBe(OBJECT);
    expect(fieldValue("audA-detail-resource")).toBe(OBJECT);
    expect(columns[COL.object]).toBe(OBJECT);

    // 同一次操作：详情 关联 行给短码，复制行尾段给同一个短码；CSV 没有这一列（现状缺口）
    expect(detailField("同一次操作")).toContain(CODE);
    expect(CSV_HEADER).not.toContain("同一次操作");

    const line = await copiedLine();
    expect(line).toContain("2026-11-19 09:20:00");
    expect(line).toContain(WHO);
    expect(line).toContain(ACTION_WORDS);
    expect(line).toContain(OBJECT);
    expect(line.split(" · ").pop()).toBe(CODE);

    for (const surface of [line, ...columns, detailField("同一次操作")]) {
      expect(surface).not.toContain(ACTOR);
      expect(surface).not.toContain(RESOURCE);
      expect(surface).not.toContain(CORRELATION);
    }
  });
});

describe("R208 - the same absence, word for word", () => {
  it("uses the table's words in every face when actor, object and correlation are missing", async () => {
    answer(BLANK);
    await render("/audit?window=7d");
    await openRecord(BLANK_ID);
    const file = await exportFile();
    const columns = rowIn(file, "");

    // 屏上没有归属写「未指派」，没有对象写「—」，四面都是这两个词
    expect(fieldValue(`aud01-cell-${BLANK_ID}-actor`)).toBe("未指派");
    expect(fieldValue("audA-detail-actor")).toBe("未指派");
    expect(columns[COL.actor]).toBe("未指派");

    expect(fieldValue(`aud01-cell-${BLANK_ID}-object`)).toBe("—");
    expect(fieldValue("audA-detail-resource")).toBe("—");
    expect(columns[COL.object]).toBe("—");

    // 复制行：缺位的对象与同一次操作都是「 —」，尾段也是「—」（现状：复制行用 —，结论行用未返回，分层不统一）
    const line = await copiedLine();
    expect(line).toContain("未指派");
    expect(line.split(" · ").pop()).toBe("—");

    // CSV 的请求编号是真空字符串：服务没回就不填任何东西
    expect(columns[COL.rid]).toBe("");

    for (const surface of [line, ...columns]) {
      expect(surface).not.toContain("undefined");
      expect(surface).not.toContain("null");
      expect(surface).not.toContain(ACTOR);
    }
  });
});

describe("R208 - opening and closing moves nothing the reader counts", () => {
  it("costs exactly one detail read and leaves the status line and row order untouched", async () => {
    answer(TWO);
    await render("/audit?window=7d");
    expect(listReads()).toBe(1);
    const statusBefore = textOf("aud01-status");
    expect(statusBefore).toContain("已显示");
    const orderBefore = paintedRows();
    const callsBefore = urls().length;
    const detailBefore = detailReads();

    await openRecord(FIRST);
    expect(detailReads()).toBe(detailBefore + 1);
    expect(detailReads()).toBe(1);
    expect(paramOf(lastDetailRead(), "id")).toBe(FIRST);
    // 读数行逐字不变 —— R137/R201 钉过行序与地址，这句是新增的第三枚不动项
    expect(textOf("aud01-status")).toBe(statusBefore);
    expect(paintedRows()).toEqual(orderBefore);

    await closeRecord();
    expect(detailReads()).toBe(1);
    expect(listReads()).toBe(1);
    expect(urls().length).toBe(callsBefore + 1);
    expect(textOf("aud01-status")).toBe(statusBefore);
    expect(paintedRows()).toEqual(orderBefore);
  });
});

describe("R208 - the combo keeps all faces agreeing", () => {
  it("holds the four-way parity under window=7d plus an actor filter", async () => {
    answer(TWO);
    await render(`/audit?window=7d&actor=${encodeURIComponent(ACTOR)}`);
    const read = lastListRead();
    // 现状：快捷窗档上线是 from/to 一对（audU 钉过），地址里的 7d 不直接上线路
    expect(paramOf(read, "from")).not.toBeNull();
    expect(paramOf(read, "to")).not.toBeNull();
    expect(paramOf(read, "actorId")).toBe(ACTOR);
    await openRecord(FIRST);
    const file = await exportFile();
    const columns = rowIn(file, RID_FIRST);

    const face = markValue(`audJ-time-list-${FIRST}`);
    expect(face.startsWith(columns[COL.time])).toBe(true);
    expect(markValue("audJ-time-detail")).toBe(face);
    expect(markValue("audJ-actor-detail")).toBe(WHO);
    expect(columns[COL.actor]).toBe(WHO);
    expect(columns[COL.type]).toBe(ACTION_WORDS);
    expect(fieldValue("audA-detail-resource")).toBe(OBJECT);
    expect(columns[COL.object]).toBe(OBJECT);
    expect(detailField("同一次操作")).toContain(CODE);

    const line = await copiedLine();
    expect(line).toContain(WHO);
    expect(line.split(" · ").pop()).toBe(CODE);
    for (const surface of [line, ...columns]) {
      expect(surface).not.toContain(ACTOR);
      expect(surface).not.toContain(RESOURCE);
    }
  });
});
