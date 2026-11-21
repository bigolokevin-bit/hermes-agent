// R256 — 空间详情导出×预览对账：三腿查重全锁 + 一真缺口新维（51 追加帧×抽屉三方首行+双帧钮序+账本分离）（纯测试单·零产品改动）。
// 【三腿裁决（file:line；已锁只引用，禁造重复用例——红线⑤预判成立）】
//  ①「导出行数==表体==-space- 钮 & 首行==屏上」＝**全锁**：R248①
//    (knowledge.space.export.filters.test.tsx:135-160 48 规模三方首行+全链+cap+键集) +
//    R249①(knowledge.export.space.paging.test.tsx:140-156 追加帧三方首行并置) +
//    R252①(knowledge.space.export.filters 叠载五量帧) + R226①/R142①:124 → 不复写；
//    行钮按面映射：详情面实名 **kn-row-copy-space-<i>**（indexBase 0..N-1——R132/R169），
//    派工「kn-row-copy-<i>」在测量面即此族（声明）。
//  ②「开预览后导出集合与序不变、关闭零请求」＝**全锁**：R230①
//    (knowledge.preview.export.parity.test.tsx 抽屉开帧三值+全文 toBe 开前) +
//    R233② (knowledge.detail.list.export.columns / 开关双帧三值+行名互等) +
//    R236① (knowledge.export.open.detail 开→关→重开三帧互等+详情读账本 2) +
//    R196③④/R149（详情读契约）→ 不复写。名实：「预览」=?doc= 抽屉（kn7-preview-*，
//    开恰 +1 既存详情读、关 0——R49）；?preview= 不存在（行内=本地 previewKey 零请求
//    不写 URL——R206③ 锁）；**禁宣称总量全零**（详情读 +1 如实入账）。
//  ③「缺值行 CSV 空字段 vs 屏上『—』」＝第二口径**不存在**（两产物共用 docLine 单源，
//    两侧同为「—」）且已锁：R200②/R226①②（表格/复制行「—」+无 undefined/null）+
//    R190③（同式）+ R233①（抽屉侧「该字段未返回」+逐字段 title 第三式）→ 不复写；
//    口径差异声明照落：断言单一实现现状，禁伪造「空字段」。
//    kn-space-page-cap 不存在→kn3-page-cap（50 常量/M 可变、true-0/错/拒/非法=null——
//    R108/R157/R187）；本例只在追加帧顺带复跑 M=51→开/关抽屉**逐字不动**（引 R233②
//    健康位，51 帧+抽屉双帧的 cap/钮序并置未测 → 计入新增维）。
// 【唯一真缺口=本文件新增维（点名）】R239① 锁了「抽屉开×M=51 四值+首行==屏上+listUrls
//  逐字」但**未点行钮做三方**；R249① 锁了三方但**无抽屉**；双帧（开/关）钮 id 序列
//  逐字互等与**读账本按阶段分离**（开 +1 只属详情读、关 +0、导出 +0）从未同单例：
//  本例钉「51 追加帧 + 抽屉开态三方首行（-space-0 串==屏上==链首）+ 关帧钮序
//  [0..50] 逐字互等 + cap 51 双帧不动 + urls 阶段账本」。
// 红线沿用：无真 CSV→导出=knF（DOC_LINE_HEADER 5 列）、kn-list-copy 不存在、
// createObjectURL spy 全程 0；cursor 只在组件态（从请求 URL 断言）；缺值两式禁统一；
// 短码尾段全 id 仅 title；clip 桩 mockResolvedValue + afterEach unstubAllGlobals（R214）。
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
const dataLines = (text: string) => text.split("\n").slice(1, -1);
const capM = () => {
  const m = /当前已加载 (\d+) 篇/.exec(txt(q("kn3-page-cap")));
  return m ? Number(m[1]) : null;
};
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  const createObjectUrl = vi.fn();
  Object.defineProperty(window.URL, "createObjectURL", { value: createObjectUrl, configurable: true, writable: true });
  return { writeText, createObjectUrl };
};

const page50 = Array.from({ length: 50 }, (_, i) => ({
  documentId: `p1_${String(i + 1).padStart(2, "0")}`,
  fileName: `卷 ${String(i + 1).padStart(2, "0")}.pdf`,
  mimeType: "pdf",
  sizeBytes: 100 + i,
  updatedAt: `2026-11-1${(i % 9) + 1}T07:00:00Z`,
}));
const ROW51 = { documentId: "p2_51", fileName: "卷 51.pdf", mimeType: "pdf", sizeBytes: 999, updatedAt: "2026-11-10T01:00:00Z" };
const SP = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 51, status: "synced" }] };
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [page50[0]] });
    if (url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: page50, nextCursor: "cpg2" });
    if (url === P2URL) return Promise.resolve({ asOf: SP.asOf, documents: [ROW51], nextCursor: null });
    if (url === detailUrl("p1_01")) return Promise.resolve({ sourceName: "原件一", status: "indexed" });
    return fail(404, "这个数据接口还没有接入。", "rid-r256-x");
  });

describe("knowledge space export × preview parity (R256)", () => {
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

  it("① 新增维：51 追加帧开抽屉——三方首行（-space-0 串==屏上==链首）+ 开/关双帧钮序 [0..50] 逐字互等 + cap M=51 双帧不动 + 读账本阶段分离（开 +1 仅详情读、关 +0、导出 +0；②③及①主面裁决见头注引用）", async () => {
    const { writeText, createObjectUrl } = clipStub();
    wire();
    await render(DETAIL);
    await clickNode(q("knE-page-more"), "append to 51");
    expect(urls().filter((u) => u === P2URL)).toHaveLength(1); // cursor 只在请求线（引用位）
    expect(loc()).not.toContain("cursor");
    const reads51 = urls().length;
    expect(capM()).toBe(51); // M=51（追加帧，引 R229③ 位）
    // 开抽屉（行名点 p1_01 对应「卷 01.pdf」）
    await clickNode(
      rowNodes().find((r) => (r.textContent ?? "").includes("卷 01.pdf"))?.querySelector('[data-testid="kn3-docs-name"]'),
      "open drawer 卷 01",
    );
    expect(q("kn7-preview-panel")).toBeTruthy();
    expect(loc()).toContain("doc=p1_01");
    expect(urls().length).toBe(reads51 + 1); // 账本：开=+1
    expect(urls().at(-1)).toBe(detailUrl("p1_01")); // 且新增只属既存详情读（R49）
    // 三方首行同帧（本例核心新位：R239① 帧 + 行钮点按）
    const names = rowNames();
    await clickNode(document.querySelector('button[data-testid="kn-row-copy-space-0"]'), "btn 0");
    const btnHead = String(writeText.mock.calls[0][0]).split("\n")[1].split(" | ")[0];
    await clickNode(q("knF-copy"), "knF drawer open");
    const lines = dataLines(String(writeText.mock.calls[1][0]));
    expect(btnHead).toBe(names[0]);
    expect(lines[0].split(" | ")[0]).toBe(names[0]);
    expect(lines.map((l) => l.split(" | ")[0])).toEqual(names); // 全链==屏上（开帧）
    const idsOpen = btnIds();
    expect([names.length, idsOpen.length, lines.length, capM()]).toEqual([51, 51, 51, 51]); // 四值（引 R239① 口径当帧）
    // 关抽屉：+0 请求；钮序与 cap 双帧逐字互等
    const readsOpen = urls().length;
    await clickNode(q("kn7-preview-close"), "close drawer");
    expect(loc()).not.toContain("doc=");
    expect(urls().length).toBe(readsOpen); // 关 +0（账本分离）
    expect(btnIds()).toEqual(idsOpen); // 双帧钮序逐字（R233② 的行名位扩到钮 id 序列）
    expect(capM()).toBe(51); // cap 双帧不动（51 帧+抽屉开关组合位）
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF closed");
    expect(dataLines(String(writeText.mock.calls[0][0])).map((l) => l.split(" | ")[0])).toEqual(names); // 关帧链==同屏上
    expect(urls().length).toBe(readsOpen); // 导出 +0（账本三段：开 +1/关 +0/导出 +0）
    expect(createObjectUrl).not.toHaveBeenCalled(); // 无 blob URL（R190① 不变量同帧收口）
  });
});
