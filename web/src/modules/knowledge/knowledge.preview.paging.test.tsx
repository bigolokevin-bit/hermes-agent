// R258 — 预览×分页：行内预览追加帧 + 抽屉×切桶序账本同帧（两真缺口）；腿③判定引用（纯测试单·零产品改动）。
// 宿主声明（红线①，两腿分开）：腿①用**行内预览** `kn-doc-preview-*`（组件本地
// previewKey，开合不写 URL、零请求——?preview= 不存在）；腿②用 **kn7 抽屉** `?doc=`
// （`kn7-preview-*`，每次打开恰 +1 既存详情读、关 0、切桶不重取——R49/R196/R256 账本）。
// 【三腿查重裁决（file:line；已锁只引用）】
//  ①主体：R225① 锁「预览打开态钮↔宿主行几何+播报归属」、R225② 锁「关预览复原」、
//    R225③ 锁「append 后开新行预览再点钮」——但**「行内预览先开 → 再点 -more 追加」
//    的存续/字段不变/详情读恒 0/钮 [0..50]/cap M=51/增量恰 [P2URL] 同帧**未锁
//    （R225③ 顺序是 append→开预览）→ 真缺口 A，落例①。
//  ②主体：R224①(preview.filter.transition:125-140) 已锁「抽屉开态切桶：doc+ktype 双参
//    同址（现状裁决=**面板存续保留**，实测非猜测）+ 行换代 + 出局文档 previewField
//    缺失句 + cap 随新 M」；R237②/R244 锁无抽屉版序重建。**「序自 0 重建 + 全程零新
//    请求 + 详情读计数不新增」并入同一切桶帧**未锁 → 真缺口 B′，落例②。
//  ③「页 2 500 保旧行+rid+重试恰 +1+序号不重复」＝**全锁不复写**：R237③
//    (rowcopy.triple:193-224 窗内钮序 [0..49] 连续+rid 投递+重试 [+P2URL]+导出合成) +
//    R247②(ktype 在场 48 基数版) + R239③(列表窗×抽屉开 panel 存续+字节冻结) +
//    R131③/R216④。序号不重复即 R237③「钮 [0..49] 连续」断言本体。
// 名实红线：详情面行钮实名 **kn-row-copy-space-<i>**（派工 kn-row-copy-<i> 属检索面；
// indexBase 0..N-1——R132/R169）；kn-doc-copy 单控件非行数；51 行跨页夹具
// （DOCUMENTS_LIMIT=50），cursor 只在组件态、从请求 URL 断言；cap「本页最多显示 50 篇
// （当前已加载 M 篇；复制清单也只含这些篇）」50 常量/M 变量、行数==50 才出 -more、
// true-0/error/denied/非法=null（非 0）；kn-space-page-cap/kn-more/kn-list-copy/
// ?source=/?preview= 均不存在；本地切桶零新请求禁「恰 1 次」，唯 -more 真发一页；
// 无真 CSV→任何「导出」=knF 数据行、createObjectURL spy 全程 0；缺值两式禁统一、
// 短码尾段全 id 仅 title；clip 桩 mockResolvedValue + afterEach unstubAllGlobals
// （R214，Errors 0 硬要求）。
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
const P2URL = `${P1URL}&cursor=cpg2`;
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";
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
const rowNodes = () => [...document.querySelectorAll('[data-testid="kn3-docs-row"]')];
const rowNames = () => rowNodes().map((r) => txt(r.querySelector('[data-testid="kn3-docs-name"]')));
const btnIds = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')]
    .map((b) => Number((b.getAttribute("data-testid") ?? "").replace(/\D/g, "")))
    .sort((a, b) => a - b);
const capM = () => {
  const m = /当前已加载 (\d+) 篇/.exec(txt(q("kn3-page-cap")));
  return m ? Number(m[1]) : null;
};
const bucketByLabel = (label: string) =>
  [...document.querySelectorAll('button[data-testid^="kn-type-"]')].find((b) => txt(b).startsWith(label)) ?? null;
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.URL, "createObjectURL", { value: vi.fn(), configurable: true, writable: true });
  return writeText;
};

const mkRow = (i: number) => ({
  documentId: `p1_${String(i + 1).padStart(2, "0")}`,
  fileName: `卷 ${String(i + 1).padStart(2, "0")}.pdf`,
  mimeType: "pdf",
  sizeBytes: 100 + i,
  updatedAt: `2026-11-1${(i % 9) + 1}T07:00:00Z`,
});
const page50 = Array.from({ length: 50 }, (_, i) => mkRow(i));
const ROW51 = { documentId: "p2_51", fileName: "卷 51.pdf", mimeType: "pdf", sizeBytes: 999, updatedAt: "2026-11-10T01:00:00Z" };
const SP51 = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 51, status: "synced" }] };
const wire51 = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP51);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP51.asOf, documents: [page50[0]] });
    if (url === P1URL) return Promise.resolve({ asOf: SP51.asOf, documents: page50, nextCursor: "cpg2" });
    if (url === P2URL) return Promise.resolve({ asOf: SP51.asOf, documents: [ROW51], nextCursor: null });
    return fail(404, "这个数据接口还没有接入。", "rid-r258-x");
  });
const A = { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const B = { documentId: "d_b", fileName: "B 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const SP2 = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 2, status: "synced" }] };
const wire2 = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP2);
    if (url === DOCUMENTS_PLAIN || url === P1URL) return Promise.resolve({ asOf: SP2.asOf, documents: [A, B] });
    if (url === detailUrl("d_a")) return Promise.resolve({ sourceName: "原件 A", status: "indexed" });
    return fail(404, "这个数据接口还没有接入。", "rid-r258-y");
  });

describe("knowledge preview × paging guards (R258)", () => {
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

  it("① 新增维A：行内预览先开 → 点「加载更多」追加第 2 页——预览块存续字段逐字不变 + 详情读恒 0 + url 增量恰 [P2URL] + cap M=51 + 钮 [0..50] 去重连续", async () => {
    clipStub();
    wire51();
    await render(DETAIL);
    // 开行内预览（第一行）
    await clickNode(rowNodes()[0].querySelector('[data-testid="kn-doc-preview-toggle"]'), "open inline preview");
    expect(q("kn-doc-preview")).toBeTruthy();
    const previewSnap = txt(q("kn-doc-preview"));
    expect(previewSnap.length).toBeGreaterThan(0);
    const u0 = urls().length;
    // 预览打开态下追加
    await clickNode(q("knE-page-more"), "append while inline preview open");
    expect(urls().filter((x) => x === P2URL)).toHaveLength(1); // 增量只此一条真取数
    expect(urls().length).toBe(u0 + 1);
    expect(loc()).not.toContain("cursor"); // cursor 只在组件态（请求 URL 已含）
    // 预览存续且内容逐字（previewKey 不随追加漂移）
    expect(q("kn-doc-preview")).toBeTruthy();
    expect(txt(q("kn-doc-preview"))).toBe(previewSnap);
    // 行内预览全链详情读恒 0（与抽屉账本分离——R49/R256 引用位）
    expect(urls().filter((x) => x.startsWith("/agent-api/api/documents/d_"))).toHaveLength(0);
    // 追加去重 + 钮连续 + cap M=51
    const names = rowNames();
    expect(names).toHaveLength(51);
    expect(new Set(names).size).toBe(51);
    expect(btnIds()).toEqual(Array.from({ length: 51 }, (_, i) => i));
    expect(capM()).toBe(51);
  });

  it("② 新增维B′：抽屉开态（?doc=）切「表格」桶——地址双参保留 + 面板存续（现状裁决=保留，R224① 实测）+ 钮自 0 重建 [0] + 全程零新请求 + 详情读计数不新增（R224① 未含序/账本角）", async () => {
    clipStub();
    wire2();
    await render(`${DETAIL}&doc=d_a`);
    expect(q("kn7-preview-panel")).toBeTruthy();
    const det0 = urls().filter((x) => x === detailUrl("d_a")).length;
    expect(det0).toBe(1); // 打开恰一次既存详情读（R49）
    const u0 = urls().join("|");
    await clickNode(bucketByLabel("表格"), "flip ktype with drawer open");
    // 地址双参保留（doc 不被列表级动作抹掉）
    expect(loc()).toContain("doc=d_a");
    expect(loc()).toContain("ktype=");
    // 面板存续（按现状断言，非猜测——R224① 同裁决）
    expect(q("kn7-preview-panel")).toBeTruthy();
    // 新角①：序自 0 重建且与表体一一对应（表格桶=B 一行）
    expect(rowNames()).toEqual(["B 表.xlsx"]);
    expect(btnIds()).toEqual([0]);
    // 新角②：账本——全程零新请求，详情读计数不新增（切桶不重取）
    expect(urls().join("|")).toBe(u0);
    expect(urls().filter((x) => x === detailUrl("d_a")).length).toBe(det0);
  });

  // ③ 判定引用（不复写）：页 2 500 保旧行 + rid 可复制 + 重试恰 +1 + 序号不重复＝
  //   R237③(knowledge.rowcopy.triple.test.tsx:193-224 窗内钮序 [0..49] 连续即
  //   「不重复」断言本体+rid 投递+重试 [+P2URL]) + R247②(48 基数版) + R239③
  //   (抽屉开×列表窗反向互斥+字节冻结) + R131③/R216④。裁决：全锁，零新码。
});
