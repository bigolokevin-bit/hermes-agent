// R190 — 「导出 CSV」转义与列序护栏（纯测试单：零产品改动、未造任何控件）。
// 实测前提（本文件跑前复核，git grep 计数）：知识模块**没有 CSV 导出**——
// createObjectURL 0 命中、text/csv 0 命中、download= 0 命中；导出族仅
// data-export="absent" 标记（KnowledgeModulePage.tsx 现 4 处）+ copyGates NO_EXPORT；
// knowledge.ts:1452 的 csv 只是文档类型标签「表格（CSV）」。按 R142 先例，
// 「导出」腿映射到真实表样产物：详情面 knF-copy / 检索面 knG-copy（同源 docLine）。
// ①把「缺席」锁成不变量：若未来真落 CSV，本文件的第一组断言会红，逼作者同步更新护栏。
// 查重（锁过的引用不重写）：文本单点与逐字对照 R114/R132/R142（docSingleCopy/docLine 同串、
//   fallback 值）、跨面同值含抽屉缺值句 R125、零请求契约 R149/R164、三值口径 R152/R157/R164、
//   复制键盘焦点 R167、计数同源 R169、错误/空态互斥 R183/R187。
//   本文件真缺口：源码缺席不变量、名称含逗号/引号/换行的**原字符不转义**呈现、
//   表头列序与 DOC_LINE_HEADER/knG 固定第 2 列的逐字对账、URL.createObjectURL 全程 0 调用。
import { readFileSync } from "node:fs";

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

// 全程 spy：任何一路都不许动 blob-URL（④腿与各腿末复查计数 0）
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

const q = (testid: string) => document.querySelector(`[data-testid="${testid}"]`);
const txt = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));

// 怪名：逗号 + 双引号 + 换行——真若走 CSV 转义必被加引号翻倍；本模块是竖线表样文本，
// 必须原字符不动、不转义、不截断。
const WEIRD = '报,告"表\n第二行.pdf';
const D_WEIRD = { documentId: "d_w", fileName: WEIRD, mimeType: "application/pdf", sizeBytes: 10, updatedAt: "2026-11-19T07:00:00Z" };
const D_MISS = { documentId: "d_m", fileName: "缺项档" }; // 类型/大小/更新全缺
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 2, status: "synced" }],
};
const wire = (documents: unknown[]) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents });
    if (url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP.asOf, documents });
    return fail(404, "这个数据接口还没有接入。", "rid-r190");
  });
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

describe("knowledge export-CSV absence, escaping & column-order guards (R190, tests only)", () => {
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

  it("① no CSV export exists in this module (locked as an invariant) — and a comma/quote/newline name survives the copy line byte-for-byte", async () => {
    // 源码级缺席（若将来真接 CSV，这些断言先红，逼更新护栏）
    const page = readFileSync("src/modules/knowledge/KnowledgeModulePage.tsx", "utf8");
    const core = readFileSync("src/modules/knowledge/knowledge.ts", "utf8");
    const gates = readFileSync("src/modules/knowledge/copyGates.ts", "utf8");
    const all = page + core + gates;
    expect(all).not.toContain("createObjectURL");
    expect(all).not.toContain("text/csv");
    expect(all).not.toContain("download=");
    expect(all).not.toMatch(/new Blob\(/);
    // 最近似表样产物：详情复制对怪名**原字符不转义**（无 CSV 引号翻倍、无截断）
    wire([D_WEIRD]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await render(DETAIL);
    // 闸门带仍在自报缺席（4 处之一即可证族在位；具体处数以 grep 为准）
    expect(q("kn-gates-knF")?.getAttribute("data-export")).toBe("absent");
    await click("kn-row-copy-space-0");
    const line = String(writeText.mock.calls[0][0]);
    expect(line).toContain(WEIRD); // 逗号、双引号、换行原样在场
    expect(line).not.toContain('""'); // 无 RFC4180 式引号翻倍（没做 CSV 转义的事实）
    // 后果事实一并锁：名字里的换行**照原样入行**——物理行数因此 +1（表头+名字两行+行尾=4）。
    // 若将来给复制加转义/折行处理，本断言变红逼作者回来对齐口径（当前无此功能，R142 先例）。
    expect(line.split("\n")).toHaveLength(4);
    expect(line).toContain("第二行.pdf"); // 未截断
    expect(line).toContain("| PDF"); // 名字前后的字段结构未被打散到别的列上
    // 屏上呈现：文本折叠空白但内容不丢（渲染归 CSS，非数据 mangling）
    expect(txt(container)).toContain("报,告");
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it("② measured column order: table headers verbatim == copy field order == DOC_LINE_HEADER, with knG's extra space column pinned at position 2", async () => {
    wire([D_WEIRD]);
    await render(DETAIL);
    // 屏上表头实测序（详情文档表；操作列为 R132 行复制位）
    // 表头文字去掉排序箭头字形（↕/▲/▼ 属 SortableHead 的视觉位）
    const bare = (el: Element) => txt(el).replace(/[↕▲▼]/g, "").trim();
    const ths = [...document.querySelectorAll('[data-testid="kn3-docs-table"] thead th')].map(bare);
    expect(ths).toEqual(["文档名", "类型", "大小", "更新", "操作"]);
    // 复制表头 = DOC_LINE_HEADER 逐字（含短码列——屏上没有的派生列）
    expect(DOC_LINE_HEADER).toEqual(["文档名", "类型", "大小", "更新", "短码"]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await click("knF-copy");
    expect(String(writeText.mock.calls[0][0]).split("\n")[0]).toBe(DOC_LINE_HEADER.join(" | "));
    // 检索面（knG）：多一列「所属空间」固定在第 2 位（R71 记录的唯一列差异）——
    // 命中表屏上列序与其复制表头对账
    await render("/knowledge?tab=spaces");
    const hitThs = [...document.querySelectorAll('[data-testid="kn6-search-table"] thead th')].map(bare);
    expect(hitThs).toEqual(["文档名", "所属空间", "类型", "大小", "更新", "操作"]);
    writeText.mockClear();
    await click("knG-copy");
    expect(String(writeText.mock.calls[0][0]).split("\n")[0]).toBe(
      ["文档名", "所属空间", ...DOC_LINE_HEADER.slice(1)].join(" | "),
    );
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it("③ missing type/size/updated: the row shows 「—」 on screen AND writes 「—」 in the copy line — never undefined/null/empty field", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire([D_MISS]);
    await render(DETAIL);
    const row = q("kn3-docs-row")!;
    // 屏上三列逐字「—」
    expect(txt(row.querySelector('[data-testid="kn3-docs-type"]'))).toBe("—");
    expect(txt(row.querySelector('[data-testid="kn3-docs-size"]'))).toBe("—");
    expect(txt(row.querySelector('[data-testid="kn3-docs-updated"]'))).toBe("—");
    // 复制行同三列「—」（同屏同串，R75/R76 派生单点的空值等价物）
    await click("kn-row-copy-space-0");
    const dataLine = String(writeText.mock.calls[0][0]).split("\n")[1];
    expect(dataLine).toBe("缺项档 | — | — | — | DM");
    expect(dataLine).not.toMatch(/undefined|null/);
    expect(dataLine).not.toContain(" |  | "); // 无空字段
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it("④ empty set: the copier is disabled with a concrete title; clicking performs zero clipboard writes and zero requests; blob URLs are never created all round", async () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire([]);
    await render(DETAIL);
    const btn = q("knF-copy") as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(true);
    expect(btn?.getAttribute("title")).toContain("没有可复制"); // 具体句（R138 逐字锁过全句，此处在场性）
    const c0 = urls().length;
    await click("knF-copy");
    expect(writeText).not.toHaveBeenCalled();
    expect(urls().length).toBe(c0);
    // 检索面空态同口径（命中面读同一空列表）
    await render("/knowledge?tab=spaces");
    const g = q("knG-copy") as HTMLButtonElement | null;
    expect(g?.disabled).toBe(true);
    const c1 = urls().length;
    await click("knG-copy");
    expect(writeText).not.toHaveBeenCalled();
    expect(urls().length).toBe(c1);
    expect(createObjectUrl).not.toHaveBeenCalled(); // 全腿收口：blob-URL 零调用
  });
});
