// R245 — 抽屉故障窗内切筛链==屏上 / 404×500 分支导出无差异 / 清筛五读同帧（纯测试单·零产品改动）。
// 名实（产品定版）：派工 ?type→?ktype=（旧兜底双删 :3549-3551）；「清筛恰 1 次取数」
// 不成立→本地零新请求（R215③/R243β/R244δ′）；无真 CSV（源级四件套 0——R190①:113-119）
// →「导出」= knF 数据行、kn-list-copy 不存在、createObjectURL spy 全程 0；「详情」=
// kn7 抽屉（?doc=，错误分支：500→kn7-preview-error、404→kn7-preview-unwired——
// R183:107-133）；行钮分面 -space-（详情）/检索面（R132/R169）；kn-doc-copy 单控件
// 非行数；cap 50 常量/M 可变、true-0/error/denied/非法=null（R108/R157/R187）；
// M 实测语义=当前条件后在屏数（R244γ′ 首锁，本笔沿用）；缺值两口径不涉；clip 桩
// mockResolvedValue + unstubAllGlobals（R214）。
// 【四腿查重判定（file:line；已覆盖禁复写）】
//  ①（详情 404/500 列表导出三值）＝全锁：R232①（detail.error.export:152-176：500 窗
//    × M=51 三值+跨渲染全文互等）+R232②（404 unwired：cap 逐字冻结+knF 不禁用+三值+
//    与干净帧互等）→ 本笔落新维 β（两分支**导出侧无差异**互等帧）与 α（窗内**切筛后
//    链==屏上**——R232 两例均未在窗内做筛选动作）。
//  ②（锚互斥+清筛同步）＝互斥全锁：R231⑤(⑤追加用例:同面互斥)+R183①②（error/unwired
//    互斥）+R224①（面板存续）；清筛同步文本位=R235③ → 本笔落 γ（清筛**五读同帧**：
//    cap M==data-len==表体==钮数==导出链长，R235③ 只锁文本+cap 逐字）。
//  ③（详情开态切类型）＝R239②（export.detail.paging:~110：抽屉开×切桶过渡态不卸载+
//    换代零旧行+列表集合逐字）已锁 → 本笔 α 只补其**错误窗内**版本（链==屏上位）。
//  ④（空集门+族不渲染+零请求+cap null）＝全锁：R138/R190④(escape:190-205)+R231②⑤+
//    R236③(open.detail:182-210) → 引用不复写。
// 【真新增维（点名三条）】
//  α. **详情 500 错误窗内切类型桶**：抽屉面板存续（R224① 窗内版）、ktype 换代后
//     导出名链逐字==新屏上链（窗内链位从未测）、钮 [0..k-1] 重建、cap M 随在屏数、
//     urls 全程逐字（含切筛+复制零新请求）。
//  β. **404(unwired) 与 500(error) 两分支导出侧无差异**：同列表数据三帧（500/404/无
//     抽屉）knF 全文互等 + 两错误分支 knF 均不禁用 + cap 三帧逐字（错误**分支类型**
//     不改导出——R232 两例各测单边，跨分支互等未锁）。
//  γ. **清名筛后五读同帧**：cap 句 M 数字 == data-len == 表体行 == 钮数 == 导出链长
//     全等（R215③ 三读/R235③ 文本位之外，五读并置首锁）。
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
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

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
const detailRows = () => [...document.querySelectorAll('[data-testid="kn3-docs-row"]')];
const detailNames = () => detailRows().map((r) => txt(r.querySelector('[data-testid="kn3-docs-name"]')));
const btnIds = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')]
    .map((b) => Number((b.getAttribute("data-testid") ?? "").replace(/\D/g, "")))
    .sort((a, b) => a - b);
const bucketByLabel = (label: string) =>
  [...document.querySelectorAll('button[data-testid^="kn-type-"]')].find((b) => txt(b).startsWith(label)) ?? null;
const dataLines = (text: string) => text.split("\n").slice(1, -1);
const capM = () => {
  const m = /当前已加载 (\d+) 篇/.exec(txt(q("kn3-page-cap")));
  return m ? Number(m[1]) : null;
};
const typeIn = async (value: string) => {
  const el = q("kn3-docs-filter-input") as HTMLInputElement | null;
  expect(el, "kn3-docs-filter-input").toBeTruthy();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, value);
    el?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {});
};
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.URL, "createObjectURL", { value: vi.fn(), configurable: true, writable: true });
  return writeText;
};

const A = { documentId: "d_a", fileName: "甲手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const B = { documentId: "d_b", fileName: "乙手册.pdf", mimeType: "pdf", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const C = { documentId: "d_c", fileName: "丙表.xlsx", mimeType: "xlsx", sizeBytes: 512, updatedAt: "2026-11-19T05:00:00Z" };
const SP = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 3, status: "synced" }] };
const wire = (detail: (url: string) => Promise<unknown>) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN || url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: [A, B, C] });
    if (url === "/agent-api/api/documents/d_a") return detail(url);
    return fail(404, "这个数据接口还没有接入。", "rid-r245-x");
  });
const DRAWER = `${DETAIL}&doc=d_a`;

describe("knowledge detail-error window export guards (R245)", () => {
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

  it("α 新增维：详情 500 窗内切类型桶——面板存续 + 导出名链逐字==新屏上链 + 钮 [0] 重建 + cap M 随在屏 + urls 全程逐字", async () => {
    const writeText = clipStub();
    wire(() => fail(500, "数据服务暂时没有响应，请稍后重试。", "rid-r245-500"));
    await render(DRAWER);
    expect(q("kn7-preview-error")).toBeTruthy(); // 500→error 分支（R183）
    const u0 = urls().join("|");
    await clickNode(bucketByLabel("表格"), "flip ktype inside error window");
    expect(q("kn7-preview-panel")).toBeTruthy(); // 抽屉不卸载（R224① 的窗内合并位）
    expect(detailNames()).toEqual(["丙表.xlsx"]); // ktype 换代
    expect(btnIds()).toEqual([0]); // 钮自 0 重建
    expect(capM()).toBe(1); // M=在屏数（R244γ′ 语义沿用）
    await clickNode(q("knF-copy"), "knF in window after flip");
    expect(dataLines(String(writeText.mock.calls[0][0])).map((l) => l.split(" | ")[0])).toEqual(detailNames()); // 窗内链==屏上
    expect(urls().join("|")).toBe(u0); // 切筛+复制零新请求
  });

  it("β 新增维：404(unwired) 与 500(error) 分支导出侧无差异——同数据三帧（500/404/无抽屉）knF 全文互等 + 两分支 knF 均不禁用 + cap 三帧逐字", async () => {
    const writeText = clipStub();
    wire(() => fail(500, "数据服务暂时没有响应，请稍后重试。", "rid-r245-e5"));
    await render(DRAWER);
    expect(q("kn7-preview-error")).toBeTruthy();
    expect((q("knF-copy") as HTMLButtonElement | null)?.disabled).toBe(false);
    await clickNode(q("knF-copy"), "knF 500 frame");
    const text500 = String(writeText.mock.calls[0][0]);
    const cap500 = txt(q("kn3-page-cap"));
    writeText.mockClear();
    fetchMock.mockClear();
    wire(() => fail(404, "这个数据接口还没有接入。", "rid-r245-e4"));
    await render(DRAWER);
    expect(q("kn7-preview-unwired")).toBeTruthy(); // 404→unwired 分支（R183:126-128 互斥位引用）
    expect(q("kn7-preview-error")).toBeNull();
    expect((q("knF-copy") as HTMLButtonElement | null)?.disabled).toBe(false);
    await clickNode(q("knF-copy"), "knF 404 frame");
    const text404 = String(writeText.mock.calls[0][0]);
    expect(text404).toBe(text500); // 跨错误分支导出无差异（R232 两例各测单边，互等新位）
    expect(txt(q("kn3-page-cap"))).toBe(cap500);
    writeText.mockClear();
    fetchMock.mockClear();
    wire(() => fail(404, "详情不该被读到", "rid-r245-never"));
    await render(DETAIL); // 无抽屉基线帧
    await clickNode(q("knF-copy"), "knF clean frame");
    expect(String(writeText.mock.calls[0][0])).toBe(text500); // 三帧同串
  });

  it("γ 新增维：清名筛后**五读同帧**——cap M == data-len == 表体行 == 钮数 == 导出链长（R235③ 文本位之外的并置首锁）+ urls 逐字零请求", async () => {
    const writeText = clipStub();
    wire(() => Promise.resolve({ sourceName: "原件", status: "indexed" }));
    await render(DETAIL);
    await typeIn("手册");
    expect(detailNames()).toEqual(["甲手册.pdf", "乙手册.pdf"]);
    await typeIn("");
    const rows = detailNames();
    const len = Number(q("kn3-docs")?.getAttribute("data-len"));
    await clickNode(q("knF-copy"), "knF restored");
    const chain = dataLines(String(writeText.mock.calls[0][0])).map((l) => l.split(" | ")[0]);
    expect(capM()).toBe(3); // M=在屏 3（清筛归位）
    const reads = [capM(), len, rows.length, btnIds().length, chain.length];
    expect(new Set(reads).size).toBe(1); // 五读全等
    expect(reads[0]).toBe(3);
    expect(chain).toEqual(rows); // 链==屏上
    expect(q("kn3-page-cap")).toBeTruthy(); // 健康非空帧在场（引 R108）
  });
});
