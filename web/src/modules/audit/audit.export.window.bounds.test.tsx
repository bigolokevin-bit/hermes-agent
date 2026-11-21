// @vitest-environment jsdom
// R268 — 窗口把「文件」也关在边界里：两种窗形态下导出的首末事件都在 from/to 之内，
// 正好坐在边界上的那条事件必须算进文件、也算进三个数。第三枚钉【有效但为空的窗】：
// 两扇门关着是 R228 的功劳，但【强行点击也不建 Blob（createObjectURL 计数为 0）、
// 账本一步不动】这条计数腿此前只在「倒置窗」语境钉过（R203② 的 captured.count），
// 空答复窗语境从没数过 Blob —— 本波补的正是这一枚计数器。
//
// 已覆盖、这里不重写（只回证据）：
// - ① 的表体腿：`audit.window.bounds.test.tsx`（R203）① :216-251 —— 7d 与 custom 两形态下
//   应答行全部落在 from/to 之内、坐在端点上的事件被画上并计入读数（只到表体，没有文件腿）；
//   包含关系的守卫口径另见 `audit.window.guard.test.tsx`（R155）。
// - ①④ 的计数三角（切档后 file==table==count）：同文件 :322-347 —— 但它没有窗内边界腿、
//   也没有零旧行字面腿；行集换代零旧行由 `audit.export.paging.sequence.test.tsx`（R267）
//   在翻页态钉死，默认序位置同源由 `audit.filter.paging.export.test.tsx`（R243）② :348 起。
// - ②「切窗后导出换代无旧行」：R203④ :321-347 + R267（游标激活×30d 换代 CSV 零旧行）+
//   R243① :311-345（第 1 页切档行集换代）—— 已覆盖，本波不重写。
//   「同时间戳按 id 稳定」≠现状，按现状钉：tie-break 是 sorting.ts 的 `a.index - b.index`
//   （服务应答序，不随方向翻转），不是 id 字典序；并列行的 asc/desc 相对序稳定
//   已由 `audit.export.sort.stability.test.tsx`（R266）② 在 DOM×CSV×复制句三面钉死。
// - ③ 的门与句：`audit.export.empty.test.tsx`（R228）① :211-243 —— 空窗两枚导出 disabled
//   且标题逐字「当前筛选没有可导出的记录」「当前筛选无事件可导出」；倒置窗的零请求、
//   地址不动、门各自关着的理由与不建文件，归 R203② :253-284（那里数的是 captured.count）；
//   「将导出 0 条」是全页唯一诚实的 0（R228 头部既有口径）。本波只补【有效空窗强点两门
//   ⇒ createObjectURL 计数 0 × Blob 零枚 × 账本冻结】，disabled 只作前置不复钉句面。
// - 「序号」概念在列表不存在（行复制=开抽屉后的 aud-detail-copy 一枚；audC-copy 仅详情独立页
//   `AuditDetailModulePage.test.tsx` :319-344）—— 家族既有登记，不复述。
//
// 现状口径：档位不上线路，只以 from/to 对出现；导出=当前已装载的行而非全量历史
// （最坏形状按服务承诺登记，R243② 先例）；服务端排序参未证实（9122 401 / 8092 404，
// sorting.ts 头注既有），本波全部走本地口径。

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

const EDGE_A = "evt_r268_edge_a_0000001";
const MIDN = "evt_r268_midn_00000001";
const EDGE_B = "evt_r268_edge_b_00000002";

// custom 形态的一对边界（与家族夹具同窗）；7d 形态的边界由页面按当下算，从请求里取。
const FROM = "2026-11-05T02:00:00Z";
const TO = "2026-11-19T02:00:00Z";
// 未来闸：from 越过这天就当作「有效但为空」的窗（it② 专用），其余窗按请求边界造行。
const FUTURE_GATE = "2026-12-01T00:00:00Z";

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

// 按【请求边界】造三行：两条正坐在 from/to 上，一条在正中——两形态共用，7d 的动态边界
// 也能拿到确定性的「端点在文件里」。服务应答序＝边界升序，页面原样画（默认序，R236② 口径）。
function rowsForBounds(from: string, to: string): Row[] {
  const mid = new Date((Date.parse(from) + Date.parse(to)) / 2).toISOString();
  return [rowOf(EDGE_A, from), rowOf(MIDN, mid), rowOf(EDGE_B, to)];
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

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}

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

async function clickNodeSync(testId: string, label = testId): Promise<void> {
  const target = node(testId);
  expect(target, label).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

// ── 文件：Blob → 文本 → 逐行；外加 createObjectURL 计数（本波净新增腿） ──────
const blobs = new Map<string, Blob>();
const made = { urls: 0 };
const captured = { name: "", text: "" };

function watchBlobs(): void {
  blobs.clear();
  made.urls = 0;
  captured.name = "";
  captured.text = "";
  URL.createObjectURL = ((blob: Blob) => {
    made.urls += 1;
    const url = `blob:r268-${blobs.size + 1}`;
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
  type: CSV_HEADER.indexOf("类型"),
  actor: CSV_HEADER.indexOf("操作者"),
  object: CSV_HEADER.indexOf("对象"),
  rid: CSV_HEADER.indexOf("请求编号"),
};

function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    const from = paramOf(target, "from");
    const to = paramOf(target, "to");
    if (from === null || to === null) return { items: rowsForBounds(FROM, TO), nextCursor: null };
    if (Date.parse(from) > Date.parse(FUTURE_GATE)) return { items: [], nextCursor: null };
    return { items: rowsForBounds(from, to), nextCursor: null };
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

describe("R268 - the window the file keeps", () => {
  it("keeps its first and last event inside the pair, and counts the one that sits on the edge", async () => {
    // ── 形态 A：7d 快窗，边界由页面按当下算 ──
    await render(`/audit?window=7d&limit=25`);
    expect(listReads()).toBe(1);
    const quick = lastListRead();
    const f7 = paramOf(quick, "from") ?? "";
    const t7 = paramOf(quick, "to") ?? "";
    expect(spanOf(quick)).toBeCloseTo(7, 5);
    expect(paintedRows()).toEqual([EDGE_A, MIDN, EDGE_B]);
    const records7 = await exportRecords();
    expect(records7).toHaveLength(paintedRows().length);
    expect(shownCount()).toBe(records7.length);
    expect(records7.map((cells) => cells[COL.rid])).toEqual(paintedRows().map((id) => `req-${id}`));
    // 每条 CSV 行对应的事件时刻都落在请求边界之内（含坐在边界上的两条）。
    const at7 = new Map(rowsForBounds(f7, t7).map((row) => [`req-${row.eventId}`, row.occurredAt]));
    for (const cells of records7) {
      const at = at7.get(cells[COL.rid]) ?? "";
      expect(Date.parse(at)).toBeGreaterThanOrEqual(Date.parse(f7));
      expect(Date.parse(at)).toBeLessThanOrEqual(Date.parse(t7));
    }
    expect(records7.map((cells) => cells[COL.rid])).toContain(`req-${EDGE_A}`);
    expect(records7.map((cells) => cells[COL.rid])).toContain(`req-${EDGE_B}`);
    expect(made.urls).toBe(1);
    const ledger7 = urls();
    expect(listReads()).toBe(1);
    expect(urls()).toEqual(ledger7);

    // ── 形态 B：custom 的 from/to 对（字节拼写归 R203①，不复钉） ──
    // 同一个 it 里换形态重挂：mock 历史累计，恰一问按「再 +1」核，不按归零核。
    await render(`/audit?window=custom&from=${FROM}&to=${TO}&limit=25`);
    expect(listReads()).toBe(2);
    expect(paintedRows()).toEqual([EDGE_A, MIDN, EDGE_B]);
    const recordsC = await exportRecords();
    expect(recordsC).toHaveLength(paintedRows().length);
    expect(shownCount()).toBe(recordsC.length);
    expect(recordsC.map((cells) => cells[COL.rid])).toEqual([
      `req-${EDGE_A}`,
      `req-${MIDN}`,
      `req-${EDGE_B}`,
    ]);
    // 首行==屏上首行、末行==屏上末行；首末正是坐在 from/to 上的那两条。
    const atC = new Map(rowsForBounds(FROM, TO).map((row) => [`req-${row.eventId}`, row.occurredAt]));
    for (const cells of recordsC) {
      const at = atC.get(cells[COL.rid]) ?? "";
      expect(Date.parse(at)).toBeGreaterThanOrEqual(Date.parse(FROM));
      expect(Date.parse(at)).toBeLessThanOrEqual(Date.parse(TO));
    }
    expect(atC.get(`req-${EDGE_A}`)).toBe(FROM);
    expect(atC.get(`req-${EDGE_B}`)).toBe(TO);
    expect(made.urls).toBe(2); // 每个形态各建一枚，两形态累计两枚
    expect(listReads()).toBe(2);
  });

  it("builds no file for a valid but empty window: the doors stay shut and nothing is asked", async () => {
    await render(`/audit?window=custom&from=2027-01-05T02:00:00Z&to=2027-01-19T02:00:00Z&limit=25`);
    expect(paintedRows()).toEqual([]);
    // 门与句归 R228① :211-243、R203② :253-284 —— 这里只取 disabled 作前置，不复钉句面。
    const csv = node("aud01-export") as HTMLButtonElement | null;
    const filtered = node("aud5-export") as HTMLButtonElement | null;
    expect(csv?.disabled).toBe(true);
    expect(filtered?.disabled).toBe(true);
    const ledger = urls();
    const asks = listReads();
    // 强行点击两扇关着的门：不建 Blob、不发请求、账本一步不动。
    await clickNodeSync("aud01-export", "the closed CSV door");
    await clickNodeSync("aud5-export", "the closed filtered door");
    expect(made.urls).toBe(0);
    expect(blobs.size).toBe(0);
    expect(urls()).toEqual(ledger);
    expect(listReads()).toBe(asks);
  });
});
