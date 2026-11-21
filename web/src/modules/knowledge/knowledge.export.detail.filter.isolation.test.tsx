// R262 — 详情开态×导出×筛选隔离：切桶「链+序+账本」三合一帧 + 关态四帧回环（纯测试单：零产品改动，未造控件）。
// 名实换算（产品定版，禁造/禁改）：无 ?source= 控件（仅空间行「来源」列标签）→ 派工
// 「切类型桶」以 `?ktype=`（点桶即写，旧 type 只读兜底双删 :3549-3551）落地，未造参数；
// 「切筛选只重取一次列表」**驳回**——本地派生零新请求（R251/R258②实测），断 urls join
// 逐字；无真 CSV（源级 createObjectURL/text/csv/a.download/new Blob 0、absent ×4、
// kn-list-copy 不存在——R190①:113-119）→「导出」= knF 数据行、spy 全程 0；「详情」=
// kn7 抽屉 ?doc=（开恰 +1 既存详情读、关 0、重开再 +1——R49/R196/R236①），失败分支
// 500→kn7-preview-error、404→kn7-preview-unwired（R183），错误态列表不卸载；行钮分面
// 详情 -space-（indexBase 连续 R132/R169）、检索 kn-row-copy-<i>；kn-doc-copy 单控件
// 非行数；cap 50/M、true-0/错=null（R108/R157/R187）；缺值两式禁统一、短码尾段全 id
// 仅 title；clip 桩 mockResolvedValue + afterEach unstubAllGlobals（R214，Errors 0）。
// 【三腿查重裁决（file:line；半帧已锁→只并帧，禁整帧复写）】
//  ①主体半帧一＝R239②(export.detail.paging:165-176：抽屉开×切桶——面板存续、导出链
//    ==新屏上、旧行出局、listUrls 逐字；**未含钮序与详情读位**)；半帧二＝R258②
//    (preview.requests2 B′：同态钮自 0 重建 [0] + urls join 逐字 + 详情读不新增；
//    **未点 knF 做导出链**)——两半帧从未同帧 → **新增维 A：三合一**（链==屏上 ∧
//    钮序重建 ∧ urls 全量 join 逐字 ∧ 详情读恒 1 ∧ doc/ktype 同址，同例并钉）。
//  ②「详情失败时导出仍只含列表行+三值」＝**全锁引用不复写**：R232①
//    (detail.error.export:152-176 抽屉 500 窗×M=51 三值+全文与干净帧互等) + R232②
//    (404 unwired：cap 冻结+knF 不禁用+三值) + R245α(窗内切筛链==屏上)。
//  ③「关闭零请求、行序与钮序复原」半帧＝R236①(open.detail:132-158 开→关→重开三帧
//    全文互等+关 urls +0；**未取开抽屉前基线帧、未比钮序**) + R230①(开前==开帧文本)
//    → **新增维 B：四帧回环**——T(前)==T(开)==T(关) 三点逐字 + 钮序 前==关 复原 +
//    cap 三帧不动（R230①/R236① 两半的首尾合拢）。
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
const detailUrl = (id: string) => `/agent-api/api/documents/${id}`;

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
const detailRows = () => [...document.querySelectorAll('[data-testid="kn3-docs-row"]')];
const detailNames = () => detailRows().map((r) => txt(r.querySelector('[data-testid="kn3-docs-name"]')));
const btnIds = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')]
    .map((b) => Number((b.getAttribute("data-testid") ?? "").replace(/\D/g, "")))
    .sort((a, b) => a - b);
const bucketByLabel = (label: string) =>
  [...document.querySelectorAll('button[data-testid^="kn-type-"]')].find((b) => txt(b).startsWith(label)) ?? null;
const dataLines = (text: string) => text.split("\n").slice(1, -1);
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.URL, "createObjectURL", { value: vi.fn(), configurable: true, writable: true });
  return writeText;
};

const A = { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const B = { documentId: "d_b", fileName: "B 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const C = { documentId: "d_c", fileName: "C 稿.docx", mimeType: "docx", sizeBytes: 512, updatedAt: "2026-11-19T05:00:00Z" };
const SP = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 3, status: "synced" }] };
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN || url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: [A, B, C] });
    if (url.startsWith(detailUrl("d_"))) return Promise.resolve({ sourceName: "原件", status: "indexed" });
    return fail(404, "这个数据接口还没有接入。", "rid-r262-x");
  });

describe("knowledge drawer × export × filter isolation (R262)", () => {
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

  it("A 新增维（三合一帧）：抽屉开态切「表格」桶——导出链==新屏上 ∧ 钮自 0 重建 ∧ urls join 逐字 ∧ 详情读恒 1 ∧ doc/ktype 同址（R239② 与 R258② 两半帧首并）", async () => {
    const writeText = clipStub();
    wire();
    await render(`${BASE}&doc=d_a`);
    expect(q("kn7-preview-panel")).toBeTruthy();
    const det0 = urls().filter((x) => x === detailUrl("d_a")).length;
    expect(det0).toBe(1); // 开恰一次既存详情读（R49）
    const u0 = urls().join("|");
    await clickNode(bucketByLabel("表格"), "flip ktype with drawer open");
    expect(loc()).toContain("doc=d_a"); // 双参同址（引 R224①）
    expect(loc()).toContain("ktype=");
    expect(q("kn7-preview-panel")).toBeTruthy(); // 面板存续（引 R224①/R239②）
    const names = detailNames();
    expect(names).toEqual(["B 表.xlsx"]); // 换代零旧行（A 手册出局——引 R239② 语义）
    await clickNode(q("knF-copy"), "knF after flip");
    expect(dataLines(String(writeText.mock.calls[0][0])).map((l) => l.split(" | ")[0])).toEqual(names); // 链==屏上（半帧一）
    expect(btnIds()).toEqual([0]); // 钮自 0 重建（半帧二并入同帧）
    expect(urls().join("|")).toBe(u0); // 全量账本逐字（含详情读零新增的强式）
    expect(urls().filter((x) => x === detailUrl("d_a")).length).toBe(1); // 详情读恒 1（切桶不重取）
    expect(q("kn7-preview-field-type")?.textContent).toBe("该字段未返回"); // 出局文档第三式（引 R224①:134 不复写整链）
  });

  it("B 新增维（四帧回环）：开抽屉前基线==开态==关态导出全文逐字 + 钮序 前==关 复原 + cap 三帧不动 + 关 +0 请求（R230①/R236① 两半首尾合拢；腿②全锁引用：R232①:152-176/R232②/R245α）", async () => {
    const writeText = clipStub();
    wire();
    await render(BASE);
    await clickNode(q("knF-copy"), "knF pre-open");
    const textPre = String(writeText.mock.calls[0][0]);
    const idsPre = btnIds();
    const capPre = txt(q("kn3-page-cap"));
    // 开（+1 详情读）
    await clickNode(detailRows()[0].querySelector('[data-testid="kn3-docs-name"]'), "open drawer");
    expect(loc()).toContain("doc=");
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF open");
    const textOpen = String(writeText.mock.calls[0][0]);
    // 关（+0）
    const uOpen = urls().length;
    await clickNode(q("kn7-preview-close"), "close drawer");
    expect(loc()).not.toContain("doc=");
    expect(urls().length).toBe(uOpen); // 关零请求（R196④ 口径）
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF closed");
    const textClosed = String(writeText.mock.calls[0][0]);
    expect(textOpen).toBe(textPre); // 前==开（R230① 半）
    expect(textClosed).toBe(textPre); // 前==关（R236① 止于 开==关，此处首尾合拢）
    expect(btnIds()).toEqual(idsPre); // 钮序复原（R236① 未比位）
    expect(txt(q("kn3-page-cap"))).toBe(capPre); // cap 三帧不动
  });
});
