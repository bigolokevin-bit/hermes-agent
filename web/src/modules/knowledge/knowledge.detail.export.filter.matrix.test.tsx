// R263 — 详情开态×导出×筛选三链矩阵：腿②四量同帧（导出冻结+三值+rid 投递+重试账本）；腿①③全锁→引用（纯测试单：零产品改动，未造控件）。
// 【三腿查重裁决（file:line；已锁只引用，禁复写/禁空壳）】
//  ①「抽屉开态切 ktype×名筛：面板存续+双参同址+导出链==新屏上+三值+urls join 逐字」
//    ＝**全锁引用**：R262 A（knowledge.export.detail.filter.isolation.test.tsx:~120-150
//    三合一帧：链 toEqual 屏上 ∧ 钮自 0 重建 ∧ **全量** urls join 逐字 ∧ 详情读恒 1 ∧
//    doc/ktype 同址 ∧ 出局 dd「该字段未返回」）+ R224①(preview.filter.transition:125-140)
//    + R239②(export.detail.paging:165-176)。换算照落：无 ?source= 控件（仅空间行
//    「来源」列标签）、?preview= 不存在（行内=本地 previewKey——R206③）、旧 type 只读
//    兜底双删（:3549-3551）；「列表只重取 1 次」**驳回**为 0（本地派生，R251/R262 实测）。
//  ③「关闭零新请求+行序与 cap 整句复原（开前快照 toBe）」＝**全锁引用**：R262 B
//    （四帧回环：textClosed toBe textPre ∧ 钮序 前==关 ∧ cap 三帧逐字 ∧ 关 +0）+
//    R236①(open.detail:132-158) + R233② + R196④。
//  ②「详情 500：列表保留+导出只含列表行三值+rid 可复制+重试恰 +1」＝**三量分锁、
//    四量同帧未锁**：R232①(detail.error.export:152-176 错误窗三值+跨渲染 toBe 干净帧
//    快照——**未做 rid 投递与重试**)、R183③(detail.error:135-158 重试恰 +1+锚消失+
//    内容就位——**未查导出/三值**)、R237③/R239③(列表 500 窗 rid/重试——非抽屉窗)。
//    → 本文件唯一例：抽屉 500 窗内「导出 toBe 干净帧 ∧ 三值 [3,3,3] ∧ rid writeText
//    逐字 ∧ 重试 +1 末条==DETAIL_URL ∧ 重试后再导出仍 toBe 同快照」五量同帧。
// 产品定版：无真 CSV（源级四件套 0、absent ×4、kn-list-copy 不存在——R190①:113-119）
// →「导出」= knF 数据行（DOC_LINE_HEADER 5 列）、createObjectURL spy 全程 0；「详情」=
// kn7 抽屉（?doc=；500→kn7-preview-error+「请求编号：…」；开 +1 既存详情读、关 0——
// R49/R196）；行钮分面 -space-（R132/R169）；kn-doc-copy 非行数；cap 50/M、错误/空=
// null（R108/R157/R187）；缺值两式禁统一、短码尾段全 id 仅 title；clip 桩
// mockResolvedValue（retry 后 resolve）+ afterEach unstubAllGlobals（R214，Errors 0）。
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
const BASE = "/knowledge?tab=spaces&panel=spaces&space=sp_x";
const DETAIL_A = "/agent-api/api/documents/d_a";

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
const detailNames = () =>
  [...document.querySelectorAll('[data-testid="kn3-docs-row"]')].map((r) => txt(r.querySelector('[data-testid="kn3-docs-name"]')));
const btnIds = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')]
    .map((b) => Number((b.getAttribute("data-testid") ?? "").replace(/\D/g, "")))
    .sort((a, b) => a - b);
const dataLines = (text: string) => text.split("\n").slice(1, -1);
const RID = "rid-r263-500";
let detailMode = "fail";
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 3, status: "synced" }] });
    const docs = [
      { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" },
      { documentId: "d_b", fileName: "B 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" },
      { documentId: "d_c", fileName: "C 稿.docx", mimeType: "docx", sizeBytes: 512, updatedAt: "2026-11-19T05:00:00Z" },
    ];
    if (url === DOCUMENTS_PLAIN || url === P1URL) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: docs });
    if (url === DETAIL_A) return detailMode === "fail" ? fail(500, "数据服务暂时没有响应，请稍后重试。", RID) : Promise.resolve({ sourceName: "原件 A", status: "indexed" });
    return fail(404, "这个数据接口还没有接入。", "rid-r263-x");
  });

describe("knowledge drawer-500 quad-in-frame (R263)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    detailMode = "fail";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("② 五量同帧：抽屉 500 窗——导出 toBe 干净帧快照 ∧ 三值 [3,3,3] ∧ rid 投递逐字 ∧ 重试恰 +1 末条==DETAIL_A ∧ 重试后再导出仍 toBe 同快照（腿①③全锁引用 R262A/B+R224①+R236①；三量分锁 R232①/R183③ 不复写）", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    const spy = vi.fn();
    Object.defineProperty(window.URL, "createObjectURL", { value: spy, configurable: true, writable: true });
    // 量零：干净帧导出基线（无抽屉）
    wire();
    await render(BASE);
    await clickNode(q("knF-copy"), "knF clean baseline");
    const textClean = String(writeText.mock.calls[0][0]);
    expect(dataLines(textClean)).toHaveLength(3);
    // 故障帧：同数据 + ?doc= 深链 500
    writeText.mockClear();
    fetchMock.mockClear();
    wire();
    await render(`${BASE}&doc=d_a`);
    expect(q("kn7-preview-error")).toBeTruthy(); // 500→error 分支（R183）
    expect(txt(q("kn7-preview-error"))).toContain("这次没能读到这份文档的详情"); // 句体引 R183①②
    expect(txt(q("kn3-docs"))).toBeTruthy(); // 列表在场不卸载（R232① 语义引用位）
    // 量一/二：导出 toBe 干净帧 ∧ 三值
    await clickNode(q("knF-copy"), "knF in window");
    expect(String(writeText.mock.calls[0][0])).toBe(textClean); // 只含列表行、冻结到字节
    const names = detailNames();
    expect([names.length, btnIds().length, dataLines(String(writeText.mock.calls[0][0])).length]).toEqual([3, 3, 3]);
    // 量三：rid 可复制——投递逐字（钮本体引 R210④/R237③）
    const ridBtn = q("kn7-preview-error")?.querySelector('button[aria-label="复制请求编号"]');
    await clickNode(ridBtn, "copy rid");
    expect(writeText.mock.calls.at(-1)![0]).toBe(RID);
    // 量四：重试恰 +1、末条==DETAIL_A、锚消失、内容就位（计数引 R183③ 分锁位并入同帧）
    const c0 = urls().length;
    detailMode = "ok";
    await clickNode(q("kn7-preview-retry"), "retry");
    expect(urls().length).toBe(c0 + 1);
    expect(urls().at(-1)).toBe(DETAIL_A);
    expect(q("kn7-preview-error")).toBeNull();
    expect(q("kn7-preview-panel")).toBeTruthy();
    // 重试后再导出：列表未动 → 仍 toBe 同一干净快照
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF after retry");
    expect(String(writeText.mock.calls[0][0])).toBe(textClean);
    expect(spy).not.toHaveBeenCalled(); // 全程无 blob（R190① 收口）
  });
});
