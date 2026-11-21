// R214 — 导出列「双口径」护栏·测试本体（纯测试单：零产品改动，禁造控件）。
// L0 判定前笔（evidence-only）不算交付——本文件落四条可执行断言，且形成**跨产物直对**
// 的新组合（既有套件各自只锁过单边或单面）。
// 名实红线：本模块无真 CSV（createObjectURL/text/csv/download= 源码 0 命中，仅
// data-export="absent"，R190 escape 已锁不变量）→「导出」= 列表复制器数据行：
// 详情面 knF-copy（DOC_LINE_HEADER 5 列）+ 行钮 kn-row-copy-space-<i>；检索面 knG-copy
// （6 列，所属空间固定第 2）。第③腿「双口径」**实测不存在**：两产物共用同一 docLine
// 单点（R71），缺值两侧同为「—」——按现状锁单口径，禁伪称第二口径。
// 查重引用（不重写）：R200 columns:125/:149-152（单面差集+逐格）、R190 escape:151-157/
// 171-180/④（缺席不变量+空态）、R209 rows:137（详情面整行直对）、R142 space.export:164-176
// （三值联动）。本文件新组合：同一测试内**两面同时**做 列头→行数三值→跨面整行/逐格→
// 缺值单口径→空态 disabled+零请求+spy 0 的全链。
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
import { DOC_LINE_HEADER } from "./knowledge";

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

const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const heads = (table: string) =>
  [...document.querySelectorAll(`[data-testid="${table}"] thead th`)].map((th) =>
    (th.textContent ?? "").replace(/[↕▲▼]/g, "").trim(),
  );
const dataLines = (text: string) => text.split("\n").slice(1, -1);

const A = { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "application/pdf", sizeBytes: 2516582, updatedAt: "2026-11-19T07:10:00Z" };
const B = { documentId: "d_b", fileName: "B 人事表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const M = { documentId: "d_m", fileName: "M 缺项档" }; // 类型/大小/更新全缺
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 3, status: "synced" }],
};
const DOCS = [A, B, M];
const wire = (documents: unknown[]) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN || url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP.asOf, documents });
    return fail(404, "这个数据接口还没有接入。", "rid-r214");
  });
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x"; // 两面同屏（R132 实证）

describe("knowledge export column dual-standard guards (R214, executable body)", () => {
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

  it("① column headers verbatim BOTH faces, and rows == body rows == row-button count on each face", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire(DOCS);
    await render(DETAIL);
    // 表头实测序（详情面 4 数据列+操作；检索面 5 数据列+操作——「短码」只活在复制文本，
    // R200 差集口径在此同帧两面复跑）
    expect(heads("kn3-docs-table")).toEqual(["文档名", "类型", "大小", "更新", "操作"]);
    expect(heads("kn6-search-table")).toEqual(["文档名", "所属空间", "类型", "大小", "更新", "操作"]);
    expect(DOC_LINE_HEADER).toEqual(["文档名", "类型", "大小", "更新", "短码"]);
    // 两面行数三值：表体行数 == 行钮数 == 该面复制器数据行数
    await click("knF-copy");
    const fLines = dataLines(String(writeText.mock.calls[0][0]));
    const detailRows = container.querySelectorAll('[data-testid="kn3-docs-row"]').length;
    const detailBtns = container.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length;
    expect([detailRows, detailBtns, fLines.length]).toEqual([3, 3, 3]);
    writeText.mockClear();
    await click("knG-copy");
    const gLines = dataLines(String(writeText.mock.calls[0][0]));
    const hitRows = document.querySelectorAll('[data-testid="kn6-search-row"]').length;
    const hitBtns = [...document.querySelectorAll('button[data-testid^="kn-row-copy-"]')].filter(
      (b) => !(b.getAttribute("data-testid") ?? "").includes("-space-"),
    ).length;
    expect([hitRows, hitBtns, gLines.length]).toEqual([3, 3, 3]);
  });

  it("② same document: 类型人话/大小人话/updatedText 在导出与屏上逐字相等，两面同测（跨面导出行也互等）", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire(DOCS);
    await render(DETAIL);
    await click("knF-copy");
    const fRow = dataLines(String(writeText.mock.calls[0][0])).find((l) => l.startsWith("A 手册.pdf"))!;
    const cols = fRow.split(" | ");
    const row = [...container.querySelectorAll('[data-testid="kn3-docs-row"]')].find((r) => (r.textContent ?? "").includes("A 手册.pdf"))!;
    expect(cols[1]).toBe((row.querySelector('[data-testid="kn3-docs-type"]')?.textContent ?? "").trim());
    expect(cols[2]).toBe((row.querySelector('[data-testid="kn3-docs-size"]')?.textContent ?? "").trim());
    expect(cols[3]).toBe((row.querySelector('[data-testid="kn3-docs-updated"]')?.textContent ?? "").trim());
    expect(cols[1]).toBe("PDF");
    expect(cols[2]).toBe("2.4 MB");
    expect(cols[3]).toBe("2026-11-19 15:10"); // 北京时间到分（updatedText 单点，R75）
    // 跨面：检索面导出对同一文档的同列值互等（列差仅第 2 列所属空间——R71/R200 口径）
    writeText.mockClear();
    await click("knG-copy");
    const gRow = dataLines(String(writeText.mock.calls[0][0])).find((l) => l.startsWith("A 手册.pdf"))!;
    const gCols = gRow.split(" | ");
    expect(gCols[0]).toBe(cols[0]);
    expect(gCols.slice(2)).toEqual(cols.slice(1)); // 去掉所属空间后其余列逐位等
  });

  it("③ missing-value columns: 「—」 on BOTH derivations (single shared docLine implementation — 第二口径实测不存在，按现状锁)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire(DOCS);
    await render(DETAIL);
    const row = [...container.querySelectorAll('[data-testid="kn3-docs-row"]')].find((r) => (r.textContent ?? "").includes("M 缺项档"))!;
    expect((row.querySelector('[data-testid="kn3-docs-type"]')?.textContent ?? "").trim()).toBe("—");
    expect((row.querySelector('[data-testid="kn3-docs-size"]')?.textContent ?? "").trim()).toBe("—");
    expect((row.querySelector('[data-testid="kn3-docs-updated"]')?.textContent ?? "").trim()).toBe("—");
    await click("knF-copy");
    const mCols = dataLines(String(writeText.mock.calls[0][0]))
      .find((l) => l.startsWith("M 缺项档"))!
      .split(" | ");
    expect(mCols.slice(1, 4)).toEqual(["—", "—", "—"]);
    expect(mCols.join("")).not.toMatch(/undefined|null/);
    expect(mCols.join("|")).not.toMatch(/\|\s*\|/); // 无空字段（第三口径不存在）
    writeText.mockClear();
    await click("knG-copy");
    const gmCols = dataLines(String(writeText.mock.calls[0][0]))
      .find((l) => l.startsWith("M 缺项档"))!
      .split(" | ");
    expect(gmCols.slice(2, 5)).toEqual(["—", "—", "—"]); // 检索面同实现同「—」
  });

  it("④ export/copy adds zero requests; empty set disables both copiers with honest titles; createObjectURL never called", async () => {
    // writeText 必须返回 Promise：产品 copyList/copyHits 对 writeText(...) 直接 .then，
    // 裸 vi.fn() 返回 undefined 会在 unhandled 里炸出 2 条 error（复核归因，修桩不修产品）
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    // 有数据：导出动作零请求
    wire(DOCS);
    await render(DETAIL);
    const c0 = urls().length;
    await click("knF-copy");
    await click("knG-copy");
    expect(urls().length).toBe(c0);
    // 空集：两面复制器 disabled + 具体 title，点击零写零请求
    wire([]);
    await render(DETAIL);
    const fBtn = document.querySelector('[data-testid="knF-copy"]') as HTMLButtonElement | null;
    const gBtn = document.querySelector('[data-testid="knG-copy"]') as HTMLButtonElement | null;
    expect(fBtn?.disabled).toBe(true);
    expect(fBtn?.getAttribute("title")).toContain("没有可复制");
    expect(gBtn?.disabled).toBe(true);
    const c1 = urls().length;
    writeText.mockClear(); // 前半有数据时的两次成功复制属合法行为，清零后再锁空态零写
    await click("knF-copy");
    await click("knG-copy");
    expect(writeText).not.toHaveBeenCalled();
    expect(urls().length).toBe(c1);
    // 全程（两渲染含复制与空态点击）从未走 blob-URL——无 CSV 实现的直接行为证据
    expect(createObjectUrl).not.toHaveBeenCalled();
  });
});
