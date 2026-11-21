// R264 — 导出×预览/详情对账矩阵：三腿主体全锁→引用；落唯一未锁「抽屉 500 窗内**关闭**过渡帧」（纯测试单：零产品改动，未造控件）。
// 名实换算（产品定版，断言即现实）：无真 CSV（源级 createObjectURL/text/csv/a.download/
// new Blob 0、absent ×4、kn-list-copy 不存在——R190①:113-119）→「CSV 行」= knF 复制器
// 数据行（docCopyText→docLine 5 列：文档名|类型|大小|更新|短码），检索面 knG 仅对照不在
// 本腿；无独立详情路由、无 ?preview=——唯一带 URL 详情面 = kn7 抽屉（?doc=；500→
// kn7-preview-error、404→kn7-preview-unwired——R183），行内预览=本地 previewKey（R206③），
// 「预览抽屉/详情」按「抽屉=详情面」实现（声明）；抽屉开恰 +1 既存详情读（R49）、关 0、
// 重开再 +1——**禁宣称全零**（本例账本如实记开 +1 fail / 关 +0）；列表读集合逐字
// （键集 {limit,spaceId}——R164①:142）；行钮分面 -space-（R132/R169）、kn-doc-copy
// 单控件非行数；cap 50/M、true-0/error/denied/非法=**null**；缺值两式禁统一；短码大写
// 尾段全 id 仅 title、裸 MIME/字节只进 title；clip 桩 mockResolvedValue +
// afterEach unstubAllGlobals（R214，Errors 0）。
// 【三腿查重裁决（file:line；全锁只引用，禁复写）】
//  ①「同一文档 预览抽屉×CSV 行 五字段逐字」＝**全锁**：R233①
//    (knowledge.detail.list.export.columns.test.tsx——抽屉 dd × knL-copy-meta × knF
//    三方逐字 + 缺值三书各位 + 抽屉帧负扫) + R200②/R209/R223/R226①（列/行逐字族）+
//    R204①（四面六路）。
//  ②「开/关不动行集与序、关零请求、三值」＝**全锁**：R230①(抽屉开帧三值+全文 toBe
//    开前) + R262 B(四帧回环 前==开==关+钮序 前==关+cap 三帧逐字+关 0) + R256(51 追加
//    ×抽屉三方首行+四值+开/关账本阶段分离)。
//  ③「空集/500 导出 disabled+title、未调 createObjectURL」＝**全锁**：R190④:190-205
//    + R231②⑤ + R236③:182-210（两翼判别句）+ R138 + R257A(true-0×knE-page 整族 0)。
// 【唯一未锁组合（本例，候选①坐实）】**抽屉 500 错误窗内点「关闭」的过渡帧**：
//    R263 锁窗内五量、R262 B 锁健康帧关合——「错误窗关闭后导出 toBe 干净基线 ∧ 三值
//    复原 ∧ 钮序==开前 ∧ cap 逐字复原 ∧ 错锚随卸载消失 ∧ 关段 0 请求 ∧ 全链详情读
//    恒 1（那一次失败的开读）」从未同帧。
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
const loc = () => txt(q("loc"));
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const detailNames = () =>
  [...document.querySelectorAll('[data-testid="kn3-docs-row"]')].map((r) => txt(r.querySelector('[data-testid="kn3-docs-name"]')));
const btnIds = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')]
    .map((b) => Number((b.getAttribute("data-testid") ?? "").replace(/\D/g, "")))
    .sort((a, b) => a - b);
const dataLines = (text: string) => text.split("\n").slice(1, -1);

describe("knowledge export preview-detail matrix (R264)", () => {
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

  it("① 唯一未锁组合：抽屉 500 错误窗内点关闭的过渡帧——错锚随卸载消失 + 导出 toBe 干净基线 ∧ 三值 [3,3,3] ∧ 钮序==开前 ∧ cap 逐字复原 + 关段 0 请求 + 全链详情读恒 1（三腿主体全锁引用：R233①/R230①/R262B/R256/R190④/R257A；禁宣称全零——开 +1 fail 如实入账）", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    const spy = vi.fn();
    Object.defineProperty(window.URL, "createObjectURL", { value: spy, configurable: true, writable: true });
    const DOCS = [
      { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" },
      { documentId: "d_b", fileName: "B 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" },
      { documentId: "d_c", fileName: "C 稿.docx", mimeType: "docx", sizeBytes: 512, updatedAt: "2026-11-19T05:00:00Z" },
    ];
    const wire = () =>
      fetchMock.mockImplementation((url: string) => {
        if (url === SPACES) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 3, status: "synced" }] });
        if (url === DOCUMENTS_PLAIN || url === P1URL) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: DOCS });
        if (url === DETAIL_A) return fail(500, "数据服务暂时没有响应，请稍后重试。", "rid-r264-500"); // 恒失败：本例无重试腿
        return fail(404, "这个数据接口还没有接入。", "rid-r264-x");
      });
    // 基线帧（无抽屉）：导出快照/钮序/cap
    wire();
    await render(BASE);
    await clickNode(q("knF-copy"), "knF baseline");
    const textPre = String(writeText.mock.calls[0][0]);
    const idsPre = btnIds();
    const capPre = txt(q("kn3-page-cap"));
    // 深链开抽屉=错误窗（账本：开段 +1 既存详情读、且失败）
    writeText.mockClear();
    fetchMock.mockClear();
    wire();
    await render(`${BASE}&doc=d_a`);
    expect(q("kn7-preview-error")).toBeTruthy(); // 窗内（引 R263 五量域，不复写）
    expect(urls().filter((x) => x === DETAIL_A)).toHaveLength(1); // 开恰 +1（失败不自动重试）
    const uWin = urls().length;
    const listWin = urls().filter((x) => x === SPACES || x === DOCUMENTS_PLAIN || x === P1URL).join("|");
    // **关闭过渡帧**（本例主位）
    await clickNode(q("kn7-preview-close"), "close inside error window");
    expect(q("kn7-preview-panel")).toBeNull(); // 抽屉随关卸载
    expect(q("kn7-preview-error")).toBeNull(); // 错锚同帧消失（无幽灵锚）
    expect(loc()).not.toContain("doc="); // URL 只删 doc（引 R206③ 参数面）
    expect(urls().length).toBe(uWin); // 关段 0 请求
    expect(urls().filter((x) => x === SPACES || x === DOCUMENTS_PLAIN || x === P1URL).join("|")).toBe(listWin); // 列表读集合逐字
    await clickNode(q("knF-copy"), "knF after close");
    const textPost = String(writeText.mock.calls[0][0]); // clear 后首记即关帧导出
    expect(textPost).toBe(textPre); // 导出复原==干净基线（错误窗不留痕）
    expect(btnIds()).toEqual(idsPre); // 钮序复原
    expect(txt(q("kn3-page-cap"))).toBe(capPre); // cap 逐字复原
    expect([detailNames().length, btnIds().length, dataLines(textPost).length]).toEqual([3, 3, 3]); // 三值
    expect(urls().filter((x) => x === DETAIL_A)).toHaveLength(1); // 全链详情读恒 1（关/导出皆不再读）
    expect(spy).not.toHaveBeenCalled(); // blob 零调用（R190① 不变量收口）
  });
});
