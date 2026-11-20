// @vitest-environment jsdom
// R215 — 缺值与超长字段在四面怎么落地：缺的四处同一句、长的四处各给各的口径、
// 死链不污染读数、翻页态开合详情什么都不动。
//
// 已覆盖、这里不重写（只回证据）：
// - `AuditEventsModulePage.test.tsx` audO（:4256+）钉住了截断件族：一行 truncate、
//   title 带「完整值：…」与逐格重算的「已省略 N 字符」、预览/详情的「展开全文」按钮、
//   展开只改本地态（地址与 urls() 一字不动）、短值无省略号无按钮、截断不回填掩码；
// - R113 `audit.deeplink.test.tsx` 钉住了死链句「该事件不存在或已过期」+ 可复制 rid +
//   筛选与地址逐字保留 + 列表仍在；
// - R137 三面缺值同词、R205③ 表体↔CSV 的「未指派」/「—」/真空字段、R201 it2 缺值的
//   复制行与 CSV 阶梯、R121/detailCopy.test.tsx 复制行本身与 correlation 缺尾「—」；
// - R208 it③ 与 R196 钉住了裸地址下开→关恰一笔详情读、`aud01-status` 逐字与行序不动、
//   返回只删记录键。
//
// 本文件只补真正没拼过的：
// ① actor+resource+correlation 三者【同时】缺位时，列表行×详情×复制行×CSV 一次渲染里
//    四面同读 —— 缺 trace 的那一面（详情无「同一次操作」行、CSV 压根没有 correlation 列）
//    在这里按现状登记为缺口，而不是硬造第四格；
// ② 120+ 字符的散文形态资源：列表仍一行截断（audO 的件），但复制行与 CSV 必须带【每一个
//    字符】—— audO 从未对过复制行和文件；工单说「屏上折行」，现状是一行 truncate+展开，
//    按现状钉；撑破容器在 jsdom 无量宽，只钉结构口径（truncate/min-w-0），不量像素；
// ③ 死链态下读数行三值仍自洽：`aud01-status`「已显示 N 条」不被缺失句替换、行数与
//    「将导出 N 条」与表体一致 —— R113 钉了句与地址，没钉这条计数三角；
// ④ 带筛选与游标栈的第 2 页上开→关：恰一笔详情读、`aud01-status` 逐字、行序逐字、
//    地址回到筛选+游标栈逐字 —— R208 是裸地址，R196 没对读数行，这一拼是新的。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import { ApiError } from "@/lib/api-error";
import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { CSV_HEADER } from "@/modules/audit/csv";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe(): React.ReactElement {
  const location = useLocation();
  return <div data-testid="probe-location" data-search={location.search} />;
}

const ACTOR = "user:2f3a4b5c6d7e8f90";
const ACTION = "task.created";
const RESOURCE = "ap_1122334455667788";
const FROM = "2026-11-05T02:00:00Z";
const TO = "2026-11-19T02:00:00Z";
const BASE = `/audit?window=custom&from=${FROM}&to=${TO}`;

// 散文形态：非机器句柄、没有 12+ 位十六进制连串 —— 按现状不掩码、原样上屏（audO 口径），
// 也因此必须走截断件。长度 153 个字符，稳过工单的 120 门槛。
const LONG_TEXT = Array.from(
  { length: 4 },
  () => "东侧的审批通道里由值班同事手工登记的一条超长备注说明文字示例补充内容部分",
).join("，分段");
const EDGE = "evt_r215_edge_0001";
const LONG_ID = "evt_r215_long_0001";
const GONE = "evt_r215_gone_0001";
const P1_A = "evt_r215_p1_a_0001";
const P1_B = "evt_r215_p1_b_0001";
const P2_A = "evt_r215_p2_a_0001";
const P2_B = "evt_r215_p2_b_0001";
const CUR2 = "cur_r215_page2";

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
        <Probe />
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
  return node(testId)?.textContent ?? "";
}

/** Field 的值只在 dd：dt 是标签。 */
function fieldValue(testId: string): string {
  return node(testId)?.querySelector("dd")?.textContent?.trim() ?? "";
}

/** 详情面板里按标签找那一行的 dd 文本；找不到标签返回 null。 */
function detailField(label: string): string | null {
  const panel = node("aud02-detail");
  if (!panel) return null;
  for (const dl of Array.from(panel.querySelectorAll("dl"))) {
    const dt = dl.querySelector("dt");
    if ((dt?.textContent ?? "").trim() !== label) continue;
    return dl.querySelector("dd")?.textContent?.trim() ?? null;
  }
  return null;
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
const detailReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length;

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}

function pairs(): string[] {
  const search = node("probe-location")?.getAttribute("data-search") ?? "";
  return search
    .replace(/^\?/, "")
    .split("&")
    .filter((pair) => pair !== "")
    .map((pair) => decodeURIComponent(pair));
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
    (target as HTMLElement).dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function openRecord(id: string): Promise<void> {
  await clickNode(node(`aud01-cell-${id}-type`), `open ${id}`);
  await waitFor(() => document.querySelector("[data-testid='aud02-detail']") !== null, "detail painted");
}

async function closeRecord(): Promise<void> {
  await clickNode(node("aud8-back-to-list"), "aud8-back-to-list");
  await waitFor(() => document.querySelector("[data-testid='aud02-detail']") === null, "detail gone");
}

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: { type?: string; id?: string; displayName?: string };
  resource: { type?: string; id?: string };
  requestId: string | null;
  correlationId?: string;
  details?: string;
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

const EDGE_ROW = rowOf(EDGE, {
  actor: {},
  resource: {},
  requestId: null,
  correlationId: undefined,
});
// 现状：资源 id 里只要有一段 ≥4 位的数字/字母（如「0007」），shortCode 就会把它取走
// 掩成「审批单 · 0007」的短标签 —— 超长散文必须纯汉字才走「原样上屏 + 一行截断」那一档。
const LONG_ROW = rowOf(LONG_ID, { resource: { type: "approval", id: LONG_TEXT } });
const PAGE_ONE = [rowOf(P1_A), rowOf(P1_B, { occurredAt: "2026-11-19T01:21:00Z" })];
const PAGE_TWO = [
  rowOf(P2_A, { occurredAt: "2026-11-18T23:58:00Z" }),
  rowOf(P2_B, { occurredAt: "2026-11-18T23:57:00Z", resource: {} }),
];

function answer(opts: { gone?: boolean; twoPages?: boolean } = {}): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      if (opts.gone) {
        throw new ApiError("gone", {
          status: 404,
          body: '{"code":"console.not_found"}',
          url: target,
          requestId: "rid-r215-gone",
        });
      }
      const id = paramOf(target, "id");
      const found = [EDGE_ROW, LONG_ROW, ...PAGE_ONE, ...PAGE_TWO].find(
        (row) => row.eventId === id,
      );
      return { audit: found ?? LONG_ROW };
    }
    if (opts.twoPages) {
      if (paramOf(target, "cursor") === CUR2) return { items: PAGE_TWO, nextCursor: null };
      return { items: PAGE_ONE, nextCursor: CUR2 };
    }
    const all = [EDGE_ROW, LONG_ROW];
    return { items: all, nextCursor: null };
  });
}

// ── 剪贴板与文件捕获 ──────────────────────────────────────────────────────────
const clip: { calls: string[] } = { calls: [] };

function stubClipboard(): void {
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text: string) => void clip.calls.push(text) },
  });
}

async function copiedLine(): Promise<string> {
  const before = clip.calls.length;
  await clickNode(node("aud-detail-copy"), "aud-detail-copy");
  await waitFor(() => clip.calls.length > before, "the copy landed");
  return clip.calls[clip.calls.length - 1];
}

const blobs = new Map<string, Blob>();
const captured: { name: string; text: string } = { name: "", text: "" };

function watchBlobs(): void {
  blobs.clear();
  captured.name = "";
  captured.text = "";
  URL.createObjectURL = ((blob: Blob) => {
    const url = `blob:r215-${blobs.size + 1}`;
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

async function exportRows(): Promise<string[][]> {
  captured.text = "";
  await clickNode(node("aud01-export"), "aud01-export");
  await waitFor(() => captured.text !== "", "the export was handed over");
  return dataLines().map(parseRecord);
}

const COL = {
  object: CSV_HEADER.indexOf("对象"),
  actor: CSV_HEADER.indexOf("操作者"),
  rid: CSV_HEADER.indexOf("请求编号"),
};

beforeEach(() => {
  api.fetchJSON.mockReset();
  clip.calls.length = 0;
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

describe("R215 ① - three fields absent at once, four faces", () => {
  it("reads one shared set of absence words in the row, the record, the copied line and the file", async () => {
    answer();
    await render(BASE);
    await openRecord(EDGE);
    const line = await copiedLine();
    const file = await exportRows();
    const record = file.find((cells) => cells.includes("未指派"));
    expect(record, "the event reached the file").toBeDefined();
    // 操作者与对象：屏上那两句人话就是文件里那两句（三套缺值口径的「未指派」与「—」档）
    expect(fieldValue(`aud01-cell-${EDGE}-actor`)).toBe("未指派");
    expect(fieldValue("audA-detail-actor")).toBe("未指派");
    expect(record![COL.actor]).toBe("未指派");
    expect(fieldValue(`aud01-cell-${EDGE}-object`)).toBe("—");
    expect(fieldValue("audA-detail-resource")).toBe("—");
    expect(record![COL.object]).toBe("—");
    // 请求编号缺位：屏上是「该字段未返回」那一档，文件里是真·空字段 —— 两套口径都按现状钉
    expect(line).toContain("未指派");
    expect(line.endsWith(" · —")).toBe(true);
    expect(record![COL.rid]).toBe("");
    // correlation 缺位的现状两面：详情没有「同一次操作」行，复制行尾段是「—」；
    // CSV 根本没有 correlation 列 —— 缺口登记在文件头，不为它硬造第四格
    expect(detailField("同一次操作")).toBeNull();
    expect(CSV_HEADER).not.toContain("同一次操作");
    // 缺值处处不许漏出 undefined / null 字样
    for (const surface of [line, record!.join(","), textOf("aud02-detail")]) {
      expect(surface).not.toContain("undefined");
      expect(surface).not.toContain("null");
    }
  });
});

describe("R215 ② - a 120+ character resource, face by face", () => {
  it("keeps the list on one truncated line while the copy and the file carry every character", async () => {
    expect(LONG_TEXT.length).toBeGreaterThan(120);
    answer();
    await render(BASE);
    // 列表口径（现状，工单的「折行」在此不成立）：一行 truncate + title 全文与省略数
    const cell = node(`aud01-cell-${LONG_ID}-object`);
    expect(cell, "resource cell").not.toBeNull();
    const mark = cell!.querySelector("[data-testid='aud-trunc']");
    expect(mark, "the truncation piece").not.toBeNull();
    expect(mark!.className).toContain("truncate");
    expect(mark!.className).toContain("min-w-0");
    expect(mark!.getAttribute("title")).toContain("完整值：");
    expect(Number(mark!.getAttribute("data-aud-trunc-omitted"))).toBeGreaterThan(0);
    const shown = mark!.textContent ?? "";
    expect(shown.length).toBeLessThan(LONG_TEXT.length);
    expect(shown).not.toContain("undefined");
    // 复制行给全文：散文形态不被掩码（现状），一个字符都不能少、不带省略号
    await openRecord(LONG_ID);
    const line = await copiedLine();
    expect(line).toContain(LONG_TEXT);
    expect(line).not.toContain("完整值：");
    // CSV 给全文：逐字节相等（无逗号引号，不该被转义改动），不许出现省略号或截断件
    const file = await exportRows();
    const record = file.find((cells) => cells[COL.object].length > 100);
    expect(record, "the long row reached the file").toBeDefined();
    expect(record![COL.object]).toContain(LONG_TEXT);
    expect(captured.text).not.toContain("…");
    // 详情面全文可展开、且展开不发请求（audO 钉过裸挂载态；这里是导出同一份文件的同一事件）
    const callsBefore = urls().length;
    const detail = node("aud02-detail")!;
    const toggle = detail.querySelector("[data-testid='aud-trunc-toggle-detail-resource']");
    expect(toggle, "detail expand handle").not.toBeNull();
    await clickNode(toggle, "expand resource in detail");
    expect(detail.textContent).toContain(LONG_TEXT);
    expect(toggle!.getAttribute("aria-expanded")).toBe("true");
    expect(urls()).toHaveLength(callsBefore);
  });
});

describe("R215 ③ - a dead deep link keeps the list's own ledger", () => {
  it("says its sentence with a copyable rid, and the readout line still counts the list", async () => {
    answer({ gone: true, twoPages: false });
    const address = `/audit?window=custom&from=${FROM}&to=${TO}&type=${ACTION}&limit=25&event=${GONE}`;
    await render(address);
    await waitFor(
      () => document.querySelector("[data-testid='aud9-event-missing']") !== null,
      "the missing panel said",
    );
    const panel = node("aud9-event-missing");
    expect(panel?.textContent).toContain("该事件不存在或已过期");
    expect(panel?.textContent).toContain("rid-r215-gone");
    // R113 钉过句与地址；这里补的是计数三角不被死链污染：读数行仍是「已显示 N 条」，
    // 不被替换成缺失句，且与表体、「将导出 N 条」同数
    const status = textOf("aud01-status");
    expect(status).toContain("已显示");
    expect(status).not.toContain("不存在");
    expect(shownCount()).toBe(paintedRows().length);
    expect(exportCountDigits()).toBe(shownCount());
    // 列表请求一笔、存在性核对一笔，不多
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(1);
    // 清掉定位后一切照旧：地址回到筛选逐字（R113 钉过「只删 event」，这里对读数行再核一遍）
    const clear = Array.from(panel?.querySelectorAll("button") ?? []).find(
      (button) => (button.textContent ?? "").includes("清除定位"),
    );
    await clickNode(clear, "clear the dead link");
    await waitFor(
      () => document.querySelector("[data-testid='aud9-event-missing']") === null,
      "the missing panel left",
    );
    expect([...pairs()].sort()).toEqual(
      ["limit=25", "type=" + ACTION, `from=${FROM}`, `to=${TO}`, "window=custom"].sort(),
    );
    expect(shownCount()).toBe(paintedRows().length);
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(1);
  });
});

describe("R215 ④ - open and close on a filtered second page", () => {
  it("asks exactly one detail read and moves nothing else", async () => {
    answer({ twoPages: true });
    const address = `/audit?window=custom&from=${FROM}&to=${TO}&type=${ACTION}&limit=25&cursor=${CUR2}`;
    await render(address);
    const rowsBefore = paintedRows();
    expect(rowsBefore).toEqual([P2_A, P2_B]);
    const statusBefore = textOf("aud01-status");
    expect(textOf("aud2-page")).toContain("第 2 页");
    const callsBefore = urls().length;
    await openRecord(P2_A);
    expect(detailReads()).toBe(1);
    expect(paramOf(urls().find((url) => url.startsWith("/agent-api/api/audit-detail")) ?? "", "id")).toBe(P2_A);
    expect(listReads()).toBe(1);
    // 读数行与行序逐字不动（R208 在裸地址钉过；带筛选与游标栈的这一拼是新的）
    expect(textOf("aud01-status")).toBe(statusBefore);
    expect(paintedRows()).toEqual(rowsBefore);
    expect(urls()).toHaveLength(callsBefore + 1);
    await closeRecord();
    expect(detailReads()).toBe(1);
    expect(listReads()).toBe(1);
    expect(urls()).toHaveLength(callsBefore + 1);
    expect(textOf("aud01-status")).toBe(statusBefore);
    expect(paintedRows()).toEqual(rowsBefore);
    // 地址回到筛选+游标栈逐字：只删记录键
    expect([...pairs()].sort()).toEqual(
      [
        "limit=25",
        "type=" + ACTION,
        "cursor=" + CUR2,
        `from=${FROM}`,
        `to=${TO}`,
        "window=custom",
      ].sort(),
    );
  });
});
