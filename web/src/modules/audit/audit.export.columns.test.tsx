// @vitest-environment jsdom
// R205 — 列表与导出列同源：文件、表体与屏上那条读数行必须是同一个数，同一事件在每个
// 列里的写法必须是表上那句话本身，而不是另起一套格式化。
//
// 已覆盖、这里不重写（只回证据）：
// - `audit.export.escape.test.tsx`（R192）钉住了列头逐字、每行六列、列序与屏面一一对照、
//   RFC4180 转义回解析、以及「导出遵 window/actor/action 且 urls() 不变」；
// - `audit.export.test.tsx`（R141）钉住了「文件行数==表体==将导出 N 条」这条三角、
//   资源本地筛选让文件同步变窄、空态两枚导出钮 disabled+title、导出零新增请求；
// - `audit.time.test.tsx`（R153）钉住了时间在四处同源，并登记了【文件到分钟、屏上到秒】；
// - `audit.actor.test.tsx`（R177）钉住了 actor 掩码在四处同词，含「未指派」。
//
// 本文件只补真正的新东西：
// ① 读数行 `aud01-status`（「已显示 N 条审计事件」）也进三角 —— 此前只在 R141 里对过
//    「将导出 N 条」那一枚；
// ② 同一条事件的四个字段【一起】对表体与 CSV（此前时间、actor、列序各自被钉过，
//    但没有一条记录同时把四列摆在一起看）；
// ③ 筛选生效时三值同步；
// ④ 空集时不仅「没下载、没请求」，连 `URL.createObjectURL` 都不曾被调用 —— 也就是
//    页面根本没有生成过一个空文件。
// 现状口径不在这里统一：文件写北京时间到分钟，屏上写到的秒，两者是同一次读数的两种精度。

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
const ACTION = "task.created";
const ACTION_WORDS = "创建任务";
const OUTCOME_WORDS = "成功";
const RESOURCE = "ap_1122334455667788";
const OBJECT = "审批单 · 55667788";
const FROM = "2026-11-05T02:00:00Z";
const TO = "2026-11-19T02:00:00Z";

const ID_ONE = "evt_col_one_000001";
const ID_TWO = "evt_col_two_000001";
const ID_BLANK = "evt_col_blank_0001";

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

/** 表体里那一格的原文：Field 的文本从 dt 标签开始，值只在 dd。 */
function cell(testId: string): string {
  return (
    document
      .querySelector(`[data-testid='${testId}'] dd`)
      ?.textContent?.trim() ?? ""
  );
}

/** 复制件里读得出的一半：CopyValue 的值是内层 span，按钮文本是「复制」。 */
function face(testId: string): string {
  return document.querySelector(`[data-testid='${testId}'] > span`)?.textContent?.trim() ?? "";
}

function badge(testId: string): string {
  const holder = node(testId);
  return holder?.querySelector("[data-slot]")?.textContent?.trim() ?? holder?.textContent ?? "";
}

/** 屏上那条读数行 —— 「已显示 N 条审计事件」；空态时它没有数字。 */
function shownCount(): number {
  const digits = /(\d+)/.exec(node("aud01-status")?.textContent ?? "");
  return digits ? Number(digits[1]) : -1;
}

async function clickNode(target: Element | null | undefined, label: string): Promise<void> {
  expect(target, label).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: { type?: string; id?: string; displayName?: string };
  resource: { type?: string; id?: string };
  requestId: string | null;
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
    ...over,
  };
}

const TWO: Row[] = [
  rowOf(ID_ONE),
  rowOf(ID_TWO, { occurredAt: "2026-11-19T01:21:00Z", requestId: `req-${ID_TWO}` }),
];

function answer(rows: Row[]): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      return { audit: rows[0] };
    }
    return { items: rows, nextCursor: null };
  });
}

// ── 文件怎么到手：Blob 必须在页面这一侧生成，没生成就该看得见 ────────────────
const blobs = new Map<string, Blob>();
const made = { urls: 0 };
const captured: { name: string; text: string } = { name: "", text: "" };

function captureDownloads(): void {
  blobs.clear();
  captured.name = "";
  captured.text = "";
  made.urls = 0;
  URL.createObjectURL = ((blob: Blob) => {
    made.urls += 1;
    const url = `blob:export-columns-${blobs.size + 1}`;
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

async function exportFile(): Promise<{ name: string; rows: string[][]; raw: string[] }> {
  captured.text = "";
  await clickNode(node("aud01-export"), "aud01-export");
  await waitFor(() => captured.text !== "", "the export was handed over");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  const raw = dataLines();
  return { name: captured.name, rows: raw.map(parseRecord), raw };
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  captureDownloads();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R205 - one number, in three places", () => {
  it("matches the file, the table and the status line the page reads out", async () => {
    answer(TWO);
    await render(`/audit?window=custom&from=${FROM}&to=${TO}&limit=25`);
    expect(listReads()).toBe(1);
    // 读数行说的是同一个数，不是「将导出」那一枚的复读
    expect(node("aud01-status")?.textContent ?? "").toContain("已显示");
    const status = shownCount();
    expect(status).toBe(paintedRows().length);
    const file = await exportFile();
    expect(file.raw).toHaveLength(status);
    expect(file.rows).toHaveLength(paintedRows().length);
    // 列头与列序按现状锁住：换列名或换顺序必须先把这条钉子拔了再说
    expect(captured.text.replace(/^\uFEFF/, "").split("\r\n")[0]).toBe(CSV_HEADER.join(","));
    for (const record of file.rows) expect(record).toHaveLength(CSV_HEADER.length);
  });
});

describe("R205 - one event, column by column", () => {
  it("prints the same words in the table cell and in the file, for every column", async () => {
    answer(TWO);
    await render(`/audit?window=custom&from=${FROM}&to=${TO}&limit=25`);
    const file = await exportFile();
    const index = file.raw.findIndex((line) => line.includes(ID_ONE));
    expect(index, "the event reached the file").toBeGreaterThan(-1);
    const columns = file.rows[index];
    // 时间：屏上到秒，文件到分钟 —— 同一个读数的两种精度，前缀必须一致（现状，不在本波统一）
    expect(cell(`aud01-cell-${ID_ONE}-time`).startsWith(columns[0])).toBe(true);
    expect(columns[0]).toBe("2026-11-19 09:20");
    // 动作：表体按钮与文件都是那句人话，不是原始事件码
    expect(node(`aud01-cell-${ID_ONE}-type`)?.textContent ?? "").toContain(ACTION_WORDS);
    expect(columns[1]).toBe(ACTION_WORDS);
    // 结果：徽章与文件同词
    expect(badge(`aud01-cell-${ID_ONE}-result`)).toBe(OUTCOME_WORDS);
    expect(columns[2]).toBe(OUTCOME_WORDS);
    // 操作者：显示名 + 8 位短码，两侧同一串，裸句柄一处都不出现
    expect(cell(`aud01-cell-${ID_ONE}-actor`)).toBe(WHO);
    expect(columns[3]).toBe(WHO);
    // 对象：类型人话 + 短码；缺了编号也只写类型名，不写「—」
    expect(cell(`aud01-cell-${ID_ONE}-object`)).toBe(OBJECT);
    expect(columns[4]).toBe(OBJECT);
    // 请求编号：复制件的值就是文件那一格
    expect(face(`aud01-cell-${ID_ONE}-request-value`)).toBe(columns[5]);
    for (const cellText of [
      cell(`aud01-cell-${ID_ONE}-actor`),
      cell(`aud01-cell-${ID_ONE}-object`),
      ...columns,
    ]) {
      expect(cellText).not.toContain(ACTOR);
      expect(cellText).not.toContain(RESOURCE);
    }
  });

  it("leaves a missing resource and operator with the words the table uses", async () => {
    answer([rowOf(ID_BLANK, { actor: {}, resource: {}, requestId: null, occurredAt: "" })]);
    await render(`/audit?window=custom&from=${FROM}&to=${TO}&limit=25`);
    const file = await exportFile();
    expect(file.raw).toHaveLength(1);
    const columns = file.rows[0];
    // 屏上没有归属写「未指派」，没有对象写「—」，文件里就是这两个词 —— 不是空白，也不是第二套说法
    expect(cell(`aud01-cell-${ID_BLANK}-actor`)).toBe("未指派");
    expect(columns[3]).toBe("未指派");
    expect(cell(`aud01-cell-${ID_BLANK}-object`)).toBe("—");
    expect(columns[4]).toBe("—");
    // 时间与请求编号是真·空字段：服务没回就不填任何东西
    expect(columns[0]).toBe("");
    expect(columns[5]).toBe("");
    const joined = file.raw[0];
    expect(joined).not.toContain("undefined");
    expect(joined).not.toContain("该字段未返回");
  });
});

describe("R205 - the file follows the filters", () => {
  it("keeps the three counts equal while window, actor and action are all set", async () => {
    answer(TWO);
    const address =
      `/audit?window=custom&from=${FROM}&to=${TO}` +
      `&actor=${encodeURIComponent(ACTOR)}&type=${ACTION}&limit=25`;
    await render(address);
    const read = lastListRead();
    expect(paramOf(read, "actorId")).toBe(ACTOR);
    expect(paramOf(read, "action")).toBe(ACTION);
    expect(paramOf(read, "from")).toBe(new Date(FROM).toISOString());
    expect(paramOf(read, "to")).toBe(new Date(TO).toISOString());
    const status = shownCount();
    const file = await exportFile();
    expect(file.raw).toHaveLength(status);
    expect(file.raw).toHaveLength(paintedRows().length);
    // 文件里只有这一个人、这一类动作的事件
    for (const record of file.rows) {
      expect(record[1]).toBe(ACTION_WORDS);
      expect(record[3]).toBe(WHO);
    }
  });

  it("disables both exports on an empty set, asks nothing, and never builds a file", async () => {
    answer([]);
    await render(`/audit?window=custom&from=${FROM}&to=${TO}&type=${ACTION}&limit=25`);
    expect(paintedRows()).toEqual([]);
    expect(listReads()).toBe(1);
    const csv = node("aud01-export") as HTMLButtonElement | null;
    const filtered = node("aud5-export") as HTMLButtonElement | null;
    expect(csv?.disabled).toBe(true);
    expect(csv?.getAttribute("title")).toBe("当前筛选没有可导出的记录");
    expect(filtered?.disabled).toBe(true);
    expect(filtered?.getAttribute("title")).toBe("当前筛选无事件可导出");
    const before = urls();
    await clickNode(csv, "aud01-export");
    await clickNode(filtered, "aud5-export");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    // 没生成过 Blob，也没多问一次 —— 空集不该产出一个 0 行的文件
    expect(made.urls).toBe(0);
    expect(captured.name).toBe("");
    expect(captured.text).toBe("");
    expect(urls()).toEqual(before);
    expect(listReads()).toBe(1);
  });
});
