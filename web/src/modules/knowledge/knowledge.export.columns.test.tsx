// R200 — 「导出列 × 屏上列」同源 + 三值护栏（纯测试单：零产品改动，未造导出控件）。
// 实测复核（本文件跑前 git grep）：模块无真 CSV——createObjectURL/text/csv/download= 皆 0，
// 页面仅 data-export="absent"（R190 已锁为源码级不变量，本文件不重跑该锁）。
// 名实映射（R142/R190 先例）：「导出 CSV」= 详情面 knF-copy（DOC_LINE_HEADER+docLine，
// 5 列）与检索面 knG-copy（docHitCopyText，多「所属空间」固定第 2 列）代位。
// 查重（引用不重写）：
// · R190 ②（knowledge.export.escape.test.tsx）已锁两屏表头与两复制表头各自逐字；
// · R190 ①③④（缺席不变量/怪名逐字/缺值行复制列/空态 disabled+spy）、R142 ①②
//   （详情面三值+筛选联动）、R169 ①（检索面四值含钮数与第 1 列逐行）、R197 ①②④
//   （翻页五读/复位重算/窗口期）、R71（docLine 单点）、R75/R76（updatedText 时间列）、
//   R125（跨面同值含抽屉）、R167/R168（行钮键盘/编号）→ 均只引用。
// 真缺口（本文件 2 例）：
// ①「复制头 ↔ 屏上头」**对照式**差异锁：两列名集合的差集恰好是
//   {复制独有：短码} 与 {屏上独有：操作}，其余列名逐位同——把 R190 两侧各自逐字
//   升级为一张对账单（差异按现状记录，不臆造补齐）；
// ②逐单元格同源：同一文档复制行按 " | " 拆列后，每一列与屏上同列显示文本逐格
//   toBe（类型人话/大小人话/更新时间/所属空间/短码对 shortId），缺值行「—」两侧
//   逐字对，且短码只出现在复制文本不出现在屏上正文、全 id 只在 title。
// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const fetchMock = vi.fn();
vi.mock("@/modules/models/fetchJson", () => ({
  fetchJsonStrict: (url: string) => fetchMock(url),
}));

import KnowledgeModulePage from "./KnowledgeModulePage";
import { DOC_LINE_HEADER, shortId } from "./knowledge";

const createObjectUrl = vi.fn();
beforeEach(() => {
  createObjectUrl.mockClear();
  Object.defineProperty(window.URL, "createObjectURL", { value: createObjectUrl, configurable: true, writable: true });
});

const SPACES = "/agent-api/api/knowledge/spaces?limit=20";
const DOCUMENTS_PLAIN = "/agent-api/api/documents?limit=50";
const docsUrlFor = (id: string) => `/agent-api/api/documents?limit=50&spaceId=${id}`;

function fail(status: number, message: string, requestId?: string): Promise<never> {
  return Promise.reject(new ApiError(message, { status, body: "", url: "/agent-api/api/test", requestId }));
}

function LocationProbe(): ReactNode {
  return createElement("div", { "data-testid": "loc" }, useLocation().search);
}

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function render(path = "/knowledge") {
  act(() => root.unmount());
  root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: [path] },
        createElement(KnowledgeModulePage),
        createElement(LocationProbe),
      ),
    );
  });
  await act(async () => {});
}

async function click(testid: string) {
  const node = document.querySelector(`[data-testid="${testid}"]`) as HTMLElement | null;
  expect(node, testid).toBeTruthy();
  await act(async () => {
    node?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {});
}

const txt = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const bareHeads = (tableTestid: string) =>
  [...document.querySelectorAll(`[data-testid="${tableTestid}"] thead th`)]
    .map((th) => txt(th).replace(/[↕▲▼]/g, "").trim());
const rowWith = (name: string) =>
  [...document.querySelectorAll('[data-testid="kn3-docs-row"]')].find((r) => (r.textContent ?? "").includes(name)) ?? null;

const D_FULL = { documentId: "d_full1", fileName: "全项手册.pdf", mimeType: "application/pdf", sizeBytes: 2516582, updatedAt: "2026-11-19T07:10:00Z", spaceId: "sp_x", spaceName: "测试空间" };
const D_MISS = { documentId: "d_miss9", fileName: "缺项档" };
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 2, status: "synced" }],
};
const DOCS = [D_FULL, D_MISS];
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN || url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP.asOf, documents: DOCS });
    return fail(404, "这个数据接口还没有接入。", "rid-r200");
  });
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

describe("knowledge export-vs-screen column parity (R200, gap-only)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("① reconciliation table: copy header vs screen header differ ONLY by {复制独有:短码} and {屏上独有:操作}", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire();
    await render(DETAIL);
    // 详情面对账单：屏上四列与复制前四列逐位同；第 5 列两侧各异（按现状记录）
    const screen = bareHeads("kn3-docs-table"); // [文档名,类型,大小,更新,操作]（R190 已锁逐字）
    await click("knF-copy");
    const copy = String(writeText.mock.calls[0][0]).split("\n")[0].split(" | ");
    expect(copy.slice(0, 4)).toEqual(screen.slice(0, 4)); // 共有列逐位同
    expect(copy[4]).toBe("短码"); // 复制独有（屏上不可见的数据列）
    expect(screen[4]).toBe("操作"); // 屏上独有（行钮列，R132）
    expect(copy.length).toBe(DOC_LINE_HEADER.length); // 5 列单点
    // 检索面：所属空间固定第 2 位后，其余共有列继续逐位同；同样只差 短码/操作
    await render("/knowledge?tab=spaces");
    const hitScreen = bareHeads("kn6-search-table"); // [文档名,所属空间,类型,大小,更新,操作]
    writeText.mockClear();
    await click("knG-copy");
    const hitCopy = String(writeText.mock.calls[0][0]).split("\n")[0].split(" | ");
    expect(hitCopy.slice(0, 5)).toEqual(hitScreen.slice(0, 5));
    expect(hitCopy[5]).toBe("短码");
    expect(hitScreen[5]).toBe("操作");
  });

  it("② cell-by-cell parity for the same document: every copy field toBe the screen column text; 「—」 pairs match; short code lives only in the copy line", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire();
    await render(DETAIL);
    // 全项行：五格逐列对（时间列两侧同出 updatedText——R75 单点的单元格级收口）
    const rowFull = rowWith("全项手册.pdf")!;
    await clickNode(rowFull.querySelector('button[data-testid^="kn-row-copy-space-"]')!);
    const full = String(writeText.mock.calls[0][0]).split("\n")[1].split(" | ");
    expect(full[0]).toBe(txt(rowFull.querySelector('[data-testid="kn3-docs-name"]')));
    expect(full[1]).toBe(txt(rowFull.querySelector('[data-testid="kn3-docs-type"]')));
    expect(full[2]).toBe(txt(rowFull.querySelector('[data-testid="kn3-docs-size"]')));
    expect(full[3]).toBe(txt(rowFull.querySelector('[data-testid="kn3-docs-updated"]')));
    expect(full[1]).toBe("PDF");
    expect(full[2]).toBe("2.4 MB");
    expect(full[3]).toBe("2026-11-19 15:10"); // 北京时间到分（updatedText 单点）
    expect(full[4]).toBe(shortId("d_full1")); // 短码=大写尾段
    // 全 id 只在 title、正文无短码/无裸 id（现状记录）
    expect(txt(rowFull)).not.toContain("FULL1");
    expect(txt(rowFull)).not.toContain("d_full1");
    expect(rowFull.getAttribute("title")).toBe("d_full1"); // 整行 title=全 id
    // 缺值行：屏上三「—」与复制三「—」逐字成对
    const rowMiss = rowWith("缺项档")!;
    writeText.mockClear();
    await clickNode(rowMiss.querySelector('button[data-testid^="kn-row-copy-space-"]')!);
    const miss = String(writeText.mock.calls[0][0]).split("\n")[1].split(" | ");
    for (const col of ["type", "size", "updated"]) {
      expect(miss[col === "type" ? 1 : col === "size" ? 2 : 3]).toBe(
        txt(rowMiss.querySelector(`[data-testid="kn3-docs-${col}"]`)),
      );
      expect(miss[col === "type" ? 1 : col === "size" ? 2 : 3]).toBe("—");
    }
    expect(miss[4]).toBe(shortId("d_miss9")); // 短码缺不了：有 id 就有大写尾段
    // 检索面五格对账走 knG-copy 清单（6 列含所属空间）；行钮 kn-row-copy-<i> 是
    // 5 列单行文本（docSingleCopy）——两种产物列集不同，各对各的（按实记录）。
    await render("/knowledge?tab=spaces");
    const hitRow = [...document.querySelectorAll('[data-testid="kn6-search-row"]')].find((r) => (r.textContent ?? "").includes("全项手册.pdf"))!;
    writeText.mockClear();
    await click("knG-copy");
    const gLines = String(writeText.mock.calls[0][0]).split("\n");
    const cell = gLines[1].split(" | "); // knG 数据行（顺序=命中序，全项在前）
    expect(cell[0]).toBe(txt(hitRow.querySelector('[data-testid="kn6-search-name"]')));
    expect(cell[1]).toBe(txt(hitRow.querySelector('[data-testid="kn6-search-space"]'))); // 所属空间第 2 位
    expect(cell[2]).toBe(txt(hitRow.querySelector('[data-testid="kn6-search-type"]')));
    expect(cell[3]).toBe(txt(hitRow.querySelector('[data-testid="kn6-search-size"]')));
    expect(cell[4]).toBe(txt(hitRow.querySelector('[data-testid="kn6-search-updated"]')));
    // 该面行钮文本=5 列单行式（无所属空间列）——现状记录
    await clickNode(hitRow.querySelector('button[data-testid^="kn-row-copy-"]'));
    const rowLine = String(writeText.mock.calls.at(-1)?.[0] ?? "").split("\n")[1].split(" | ");
    expect(rowLine).toHaveLength(5);
    expect(rowLine[0]).toBe("全项手册.pdf");
    expect(rowLine[1]).toBe("PDF"); // 无空间列：短码在尾
    expect(rowLine[4]).toBe(shortId("d_full1"));
    async function clickNode(node: Element | null | undefined) {
      expect(node).toBeTruthy();
      await act(async () => {
        (node as Element).dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await act(async () => {});
    }
  });
});
