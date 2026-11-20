// R226 — 类型/大小人话 × 三载体同源护栏（纯测试单：零产品改动，未造控件）。
// 名实：本模块无真 CSV（源级 createObjectURL/text/csv/a.download/new Blob 0，仅
// data-export="absent" ×4，R190/R220 不变量在位）→「导出 CSV 对应列」映射 knF-copy
// （详情面）/knG-copy（检索面）数据行；行钮分面 kn-row-copy-space-<i>（详情）/
// kn-row-copy-<i>（检索）；kn-doc-copy 单控件非行数。人话取既有单点：类型 docTypeLabel
// 族（未知→「其他类型」，裸 MIME 不上屏只进 title——knowledge.ts:661/:674）、大小
// formatBytes（:536，裸字节不上屏）；两套缺值口径不统一（表格/复制「—」 vs 预览/抽屉
// 「该字段未返回」）；时间 updatedText、短码大写尾段全 id 仅 title。
// 查重（引用不重写）：R204①（跨面五字段含类型/大小格）、R209（行钮↔knF 整行直对，
// 整行等则各列等）、R214②（knG/knF 列↔屏上格逐格、行钮 5 列事实）、R223（三面同源）、
// R218（计数）、R200（表头差集）。
// 新增维（点名，grep 此前零命中）：
//  ①-a **裸值负向扫描**：`application/*` 型 MIME 串与 ≥4 位裸字节数在两个表体 section
//      的可见全文中 0 命中（裸值只许进 title——既有正锁多、负扫无 pin）；含未知类型
//      样张（application/x-unknown-9x → 屏上「其他类型」）；
//  ①-b **检索面跨载体全列直对**：knG 数据行（去固定第 2 列所属空间，R71 口径）与
//      检索面行钮串数据行**逐行整行**对（R214 做过列↔屏上格与拼接口径，未做行间整链）。
// clipboard 桩 mockResolvedValue + afterEach unstubAllGlobals（Errors 0 硬要求）。
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

const SPACES = "/agent-api/api/knowledge/spaces?limit=20";
const DOCUMENTS_PLAIN = "/agent-api/api/documents?limit=50";
const docsUrlFor = (id: string) => `/agent-api/api/documents?limit=50&spaceId=${id}`;
const P1URL = docsUrlFor("sp_x");

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

async function clickNode(node: Element | null | undefined, label: string) {
  expect(node, label).toBeTruthy();
  await act(async () => {
    (node as Element).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {});
}

const q = (testid: string) => document.querySelector(`[data-testid="${testid}"]`);
const txt = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const detailRow = (name: string) =>
  [...container.querySelectorAll('[data-testid="kn3-docs-row"]')].find((r) => (r.textContent ?? "").includes(name)) ?? null;
const hitRow = (name: string) =>
  [...document.querySelectorAll('[data-testid="kn6-search-row"]')].find((r) => (r.textContent ?? "").includes(name)) ?? null;
const dataLines = (text: string) => text.split("\n").slice(1, -1);
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  return writeText;
};

const A = { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "application/pdf", sizeBytes: 2516582, updatedAt: "2026-11-19T07:10:00Z", spaceId: "sp_x", spaceName: "人事空间" };
const X = { documentId: "d_x", fileName: "X 未知格式.bin", mimeType: "application/x-unknown-9x", sizeBytes: 987654321, updatedAt: "2026-11-19T06:10:00Z", spaceId: "sp_x", spaceName: "人事空间" };
const M = { documentId: "d_m", fileName: "M 缺项档", updatedAt: "2026-11-19T05:10:00Z", spaceId: "sp_x", spaceName: "人事空间" }; // 缺 type+size
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "人事空间", docCount: 3, status: "synced" }],
};
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN || url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: [A, X, M] });
    return fail(404, "这个数据接口还没有接入。", "rid-r226");
  });
const BASE = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

describe("knowledge type/size label parity across three carriers (R226)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("① 三载体逐字 toBe + 新增维：裸 MIME/裸字节负向扫描 + 检索面 knG↔行钮整行直对", async () => {
    const writeText = clipStub();
    wire();
    await render(BASE); // 两面同屏
    // 详情面载体：列表格 × 行钮串 × knF 行（A）
    const rowA = detailRow("A 手册.pdf")!;
    await clickNode(rowA.querySelector('button[data-testid^="kn-row-copy-space-"]'), "row A");
    const btnCols = String(writeText.mock.calls[0][0]).split("\n")[1].split(" | ");
    expect(txt(rowA.querySelector('[data-testid="kn3-docs-type"]'))).toBe(btnCols[1]);
    expect(txt(rowA.querySelector('[data-testid="kn3-docs-size"]'))).toBe(btnCols[2]);
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF");
    const fA = dataLines(String(writeText.mock.calls[0][0])).find((l) => l.startsWith("A 手册.pdf"))!.split(" | ");
    expect(fA[1]).toBe(btnCols[1]);
    expect(fA[2]).toBe(btnCols[2]);
    expect(btnCols[1]).toBe("PDF"); // 人话样张逐字
    expect(btnCols[2]).toBe("2.4 MB");
    // 未知类型样张：屏上「其他类型」，裸 MIME 只在 title
    const rowX = detailRow("X 未知格式.bin")!;
    expect(txt(rowX.querySelector('[data-testid="kn3-docs-type"]'))).toBe("其他类型");
    expect(rowX.querySelector('[data-testid="kn3-docs-type"]')?.getAttribute("title")).toBe("application/x-unknown-9x");
    // 新增维 ①-a：负向扫描——两个表体 section 可见全文零裸 MIME、零 ≥4 位裸字节数
    const bodies = `${txt(q("kn3-docs"))}${txt(q("kn6-search"))}`;
    expect(bodies).not.toMatch(/application\/[a-z0-9.+-]+/i);
    expect(bodies).not.toMatch(/\b\d{4,}\b\s*(B|字节)/); // 无「987654321 B」式裸字节
    expect(bodies).not.toContain("987654321");
    expect(bodies).not.toContain("2516582");
    // 新增维 ①-b：检索面 knG 数据行（去所属空间列）↔ 检索面行钮串整行逐行直对
    writeText.mockClear();
    await clickNode(q("knG-copy"), "knG");
    const gLines = dataLines(String(writeText.mock.calls[0][0]));
    const hitBtn = hitRow("X 未知格式.bin")?.querySelector('button[data-testid^="kn-row-copy-"]:not([data-testid*="-space-"])');
    await clickNode(hitBtn, "hit row button X");
    const xBtnCols = String(writeText.mock.calls[1][0]).split("\n")[1].split(" | ");
    const xG = gLines.find((l) => l.startsWith("X 未知格式.bin"))!.split(" | ");
    expect([xG[0], ...xG.slice(2)]).toEqual(xBtnCols); // 5 列行钮 == 6 列清单去空间列
    expect(xBtnCols[1]).toBe("其他类型"); // 三面同字：清单列与行钮列都是人话
    expect(xBtnCols[2]).toBe(txt(hitRow("X 未知格式.bin")?.querySelector('[data-testid="kn6-search-size"]')));
  });

  it("② 缺 size/缺 type 行：三载体同句「—」，全页无 undefined/null", async () => {
    const writeText = clipStub();
    wire();
    await render(BASE);
    const rowM = detailRow("M 缺项档")!;
    const cellType = txt(rowM.querySelector('[data-testid="kn3-docs-type"]'));
    const cellSize = txt(rowM.querySelector('[data-testid="kn3-docs-size"]'));
    expect(cellType).toBe("—");
    expect(cellSize).toBe("—");
    await clickNode(rowM.querySelector('button[data-testid^="kn-row-copy-space-"]'), "row M");
    const mBtn = String(writeText.mock.calls[0][0]).split("\n")[1].split(" | ");
    expect(mBtn[1]).toBe(cellType);
    expect(mBtn[2]).toBe(cellSize);
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF");
    const mF = dataLines(String(writeText.mock.calls[0][0])).find((l) => l.startsWith("M 缺项档"))!.split(" | ");
    expect(mF[1]).toBe("—");
    expect(mF[2]).toBe("—");
    // 检索面清单行同句（同一 docLine 派生）
    writeText.mockClear();
    await clickNode(q("knG-copy"), "knG");
    const mG = dataLines(String(writeText.mock.calls[0][0])).find((l) => l.startsWith("M 缺项档"))!.split(" | ");
    expect([mG[2], mG[3]]).toEqual(["—", "—"]); // 去空间列后的 type/size 位
    expect(document.body.textContent ?? "").not.toMatch(/\bundefined\b|\bnull\b/);
  });

  // R227 追加（同文件，不新建）——R227 三腿经逐条比对已由本文件 ①②③ 锁死（见上），
  // 唯二未锁子维在此落地：④ image/* MIME 族（① 负扫正则仅覆盖 application/ 前缀）：
  //    人话「图片」三载体互等、屏上无 image/png 裸值；⑤ formatBytes 进位边界样张
  //    （999→"999 B"、1000-1023→"1.0 KB" 型）三载体互等且无裸字节。
  it("④ 新增维(R227)：image/* 族——屏上人话「图片」三载体逐字、裸 image/png 零出现", async () => {
    const writeText = clipStub();
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      const png = { documentId: "d_img", fileName: "P 截图.png", mimeType: "image/png", sizeBytes: 51200, updatedAt: "2026-11-19T04:10:00Z", spaceId: "sp_x", spaceName: "人事空间" };
      if (url === DOCUMENTS_PLAIN || url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: [png] });
      return fail(404, "这个数据接口还没有接入。", "rid-r227");
    });
    await render(BASE);
    const row = detailRow("P 截图.png")!;
    expect(txt(row.querySelector('[data-testid="kn3-docs-type"]'))).toBe("图片");
    expect(row.querySelector('[data-testid="kn3-docs-type"]')?.getAttribute("title")).toBe("image/png");
    await clickNode(row.querySelector('button[data-testid^="kn-row-copy-space-"]'), "row img");
    const cols = String(writeText.mock.calls[0][0]).split("\n")[1].split(" | ");
    expect(cols[1]).toBe("图片");
    writeText.mockClear();
    await clickNode(q("knG-copy"), "knG img");
    const gLine = dataLines(String(writeText.mock.calls[0][0]))[0].split(" | ");
    expect(gLine[2]).toBe(cols[1]); // 清单列 == 行钮列
    const bodies = `${txt(q("kn3-docs"))}${txt(q("kn6-search"))}`;
    expect(bodies).not.toMatch(/image\/[a-z0-9.+-]+/i); // image 族裸 MIME 不上屏
    expect(bodies).not.toContain("51200"); // 大小已人话化（50.0 KB 型）
    expect(cols[2]).toBe("50.0 KB");
  });

  it("⑤ 新增维(R227)：formatBytes 进位边界样张——999B 与 1.0KB 两侧三载体逐字互等、无裸字节", async () => {
    const writeText = clipStub();
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      const small = { documentId: "d_s", fileName: "S 小档.txt", mimeType: "text/plain", sizeBytes: 999, updatedAt: "2026-11-19T03:10:00Z", spaceId: "sp_x", spaceName: "人事空间" };
      const edge = { documentId: "d_e", fileName: "E 边界档.txt", mimeType: "text/plain", sizeBytes: 1024, updatedAt: "2026-11-19T02:10:00Z", spaceId: "sp_x", spaceName: "人事空间" };
      if (url === DOCUMENTS_PLAIN || url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: [small, edge] });
      return fail(404, "这个数据接口还没有接入。", "rid-r227");
    });
    await render(BASE);
    expect(txt(detailRow("S 小档.txt")!.querySelector('[data-testid="kn3-docs-size"]'))).toBe("999 B");
    await clickNode(detailRow("E 边界档.txt")!.querySelector('button[data-testid^="kn-row-copy-space-"]'), "row edge");
    const eCols = String(writeText.mock.calls[0][0]).split("\n")[1].split(" | ");
    expect(eCols[1]).toBe("其他类型"); // 现状：text/plain 的后缀 "plain" 不在人话映射表（映射键是 text）
    expect(detailRow("E 边界档.txt")!.querySelector('[data-testid="kn3-docs-type"]')?.getAttribute("title")).toBe("text/plain"); // 裸 MIME 只进 title
    expect(eCols[2]).toBe(txt(detailRow("E 边界档.txt")!.querySelector('[data-testid="kn3-docs-size"]')));
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF edges");
    const fLines = dataLines(String(writeText.mock.calls[0][0]));
    expect(fLines.some((l) => l.includes("999 B")) && fLines.some((l) => l.split(" | ")[0] === "E 边界档.txt")).toBe(true);
    const bodies = txt(q("kn3-docs"));
    expect(bodies).not.toContain("1024"); // 1024 已进位为 "1.0 KB"，裸值不上屏
    expect(eCols[2]).toBe("1.0 KB"); // 进位边界样张逐字
  });

  it("③ 复制链前后 urls 快照逐字不变；三值：-space- 钮数 == 表体行 == knF 数据行", async () => {
    const writeText = clipStub();
    wire();
    await render(BASE);
    const u0 = urls().slice().sort().join("|");
    await clickNode(q("knF-copy"), "knF");
    await clickNode(q("knG-copy"), "knG");
    await clickNode(detailRow("A 手册.pdf")?.querySelector('button[data-testid^="kn-row-copy-space-"]'), "row A");
    expect(writeText).toHaveBeenCalledTimes(3);
    expect(urls().slice().sort().join("|")).toBe(u0); // 全程本地零增量（引用 R207/R214 口径）
    const rows = container.querySelectorAll('[data-testid="kn3-docs-row"]').length;
    const btns = container.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length;
    const fLines = dataLines(String(writeText.mock.calls[0][0])).length;
    expect([rows, btns, fLines]).toEqual([3, 3, 3]);
  });
});
