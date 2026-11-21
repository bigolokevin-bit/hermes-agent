// @vitest-environment jsdom
// R259 — 导出与详情复制同源：同一条记录，抽屉里那句话说什么，文件那一行就写什么。
//
// 已覆盖、这里不重写（只回证据，文件:行）：
// - `audit.fields.edge.test.tsx:366-378`（R220①）钉住了【稀疏行】的 joint：复制句 contains
//   「未指派」，CSV 同格也写「未指派」，定位方式是 cells.includes("未指派")；
// - `audit.actor.copy.test.tsx`（R235② :326）钉住了筛选站点下 复制句↔CSV 的分秒前缀梯
//   （line.startsWith(record[COL.time])）与 actor/type/object 各格等于屏上人话；
// - `audit.export.detail.empty.test.tsx`（R254）钉住了裸 7d 抽屉开态 句↔格 对读与
//   跨站 fresh 挂载句 toBe 逐字（:266 站点腿），以及 404 失败面期间导出只含列表行
//   、账本冻结、读数行逐字、无换档关闭零请求；
// - `audit.export.dims.test.tsx`（R248① :286）钉住了 actor×档位 逐行位置 actor 列
//   ==屏上==`aud01-status` 三值；`audit.export.paging.detail.test.tsx`（R249① :326）
//   与 `audit.detail.export.paging.test.tsx`（R258 :315）钉住了第 2 页开态的三角与
//   句↔行对读；`audit.export.detail.window.test.tsx`（R251 :266）钉住了抽屉开态换宽
//   的文件位置序。
//
// 本文件只补一枚真正没钉过的字节：【完整行】的复制句逐段与该 CSV 行的四格【逐格 toBe
// 相等】——此前所有钉子都用 contains/startsWith 的弱式对读，从没有把
// 「时间(前缀梯)·操作者·动作·对象」四段一格一格地按等号钉死；
// 同时把工单①「resource 缺『—』」按现状钉：完整资源两侧同为
// 「审批单 · 55667788」，裸类型无编号的资源在模型里是人话名词而非破折号
// （`detailCopy.test.tsx:57-60` 已钉），破折号档只属于缺 correlation 的尾段。
// 口径登记：复制句是五段以「 · 」拼接，段标签自身也含「 · 」（如「李思 · 6d7e8f90」），
// 所以【不可 split】后逐段比——本波按格构造预期串；请求编号不在复制句里，CSV 却有一列，
// 这一处的不同口径归 R205③/R208②，不在本波改判。

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
const ACTION_WORDS = "创建任务";
const OBJECT = "审批单 · 55667788";
const ZONE = "北京时间（UTC+8）";

const FULL_ID = "evt_r259_full_00000001";
const SPARSE_ID = "evt_r259_sparse_000001";
const TIME_FULL = "2026-11-19 09:20:00";
const TIME_FULL_FILE = "2026-11-19 09:20";

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: { type?: string; id?: string; displayName?: string };
  resource: { type?: string; id?: string };
  requestId: string | null;
  correlationId?: string | null;
}

const FULL: Row = {
  eventId: FULL_ID,
  action: "task.created",
  occurredAt: "2026-11-19T01:20:00Z",
  outcome: "succeeded",
  actor: { type: "human", id: ACTOR, displayName: "李思" },
  resource: { type: "approval", id: "ap_1122334455667788" },
  requestId: `req-${FULL_ID}`,
  correlationId: "cor-00112233445566",
};

const SPARSE: Row = {
  eventId: SPARSE_ID,
  action: "task.created",
  occurredAt: "2026-11-19T01:21:00Z",
  outcome: "succeeded",
  actor: {},
  resource: { type: "approval" },
  requestId: null,
  correlationId: null,
};

const COL = {
  time: CSV_HEADER.indexOf("时间"),
  type: CSV_HEADER.indexOf("类型"),
  actor: CSV_HEADER.indexOf("操作者"),
  object: CSV_HEADER.indexOf("对象"),
  rid: CSV_HEADER.indexOf("请求编号"),
};

let root: Root | null = null;
const clip: { calls: string[] } = { calls: [] };
const blobs = new Map<string, Blob>();
const captured: { name: string; text: string } = { name: "", text: "" };

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

async function clickNodeSync(testId: string, label = testId): Promise<void> {
  const target = node(testId);
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
  await clickNodeSync(`aud01-cell-${eventId}-type`, `row ${eventId}`);
  await waitFor(() => node("aud02-detail") !== null, "the detail painted");
}

async function copiedLine(): Promise<string> {
  const before = clip.calls.length;
  await clickNodeSync("aud-detail-copy", "aud-detail-copy");
  await waitFor(() => clip.calls.length > before, "the copy landed");
  return clip.calls[clip.calls.length - 1] ?? "";
}

function watchClipboard(): void {
  clip.calls = [];
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (text: string) =>
        new Promise<void>((resolve) => {
          clip.calls.push(text);
          resolve();
        }),
    },
  });
}

function watchDownloads(): void {
  blobs.clear();
  captured.name = "";
  captured.text = "";
  URL.createObjectURL = ((blob: Blob) => {
    const url = `blob:r259-${blobs.size + 1}`;
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

beforeEach(() => {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      const wanted = new URL(target, "http://console.test").searchParams.get("id");
      return { audit: wanted === SPARSE_ID ? SPARSE : FULL };
    }
    return { items: [FULL, SPARSE], nextCursor: null };
  });
  watchClipboard();
  watchDownloads();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R259 - the sentence and the file row are one text", () => {
  it("holds every complete cell of the opened record's row in the file", async () => {
    await render("/audit?window=7d&limit=25");
    expect(node("aud01-row-" + FULL_ID)).not.toBeNull();

    await openRecord(FULL_ID);
    clip.calls = [];
    const line = await copiedLine();

    const records = await exportRecords();
    const row = records.find((cells) => cells[COL.rid] === `req-${FULL_ID}`);
    expect(row, "the opened event reached the file").toBeDefined();
    const cells = row as string[];

    // 四格逐格 toBe —— 此前只有 contains/startsWith 的弱式对读。
    // 时间是完整段（复制句到秒、文件到分钟，文件格是句子的前缀，口径归 R153）；
    // 操作者/类型/对象三段与复制句里的那一格逐字相等。
    expect(
      line.startsWith(`${TIME_FULL} ${ZONE}`),
      "复制句以完整秒值加时区标注开头",
    ).toBe(true);
    // 现状更正：文件那一格【不是】复制句的前缀——句子在分钟位直接接「:00 北京时间（UTC+8）」，
    // 格的「 :」与句的「:」不同形。可证的同源是【逐格对照】：每一格都是句子里的原文。
    expect(TIME_FULL.startsWith(`${cells[COL.time]}:`)).toBe(true);
    expect(cells[COL.time]).toBe(TIME_FULL_FILE);
    expect(cells[COL.actor]).toBe(WHO);
    expect(line).toContain(`${ZONE} · ${WHO} · `);
    expect(cells[COL.type]).toBe(ACTION_WORDS);
    expect(line).toContain(` · ${ACTION_WORDS} · `);
    expect(cells[COL.object]).toBe(OBJECT);
    expect(line).toStrictEqual(`${TIME_FULL} ${ZONE} · ${WHO} · ${ACTION_WORDS} · ${OBJECT} · 33445566`);

    // 工单①「resource 缺『—』」按现状钉：这条是完整资源，两侧同为
    // 「审批单 · 55667788」；裸类型无编号时模型给人话名词（R121 :57-60），
    // 破折号只出现在缺 correlation 的尾段——稀疏行的 joint 已由 R220① 持有
    // （本文件把那条记录也放进表体，只为让定位按请求编号那一格可判）。
    expect(line).not.toContain("—");
    expect(line).not.toContain(ACTOR);
    expect(cells[COL.actor]).not.toContain(ACTOR);
  });
});
