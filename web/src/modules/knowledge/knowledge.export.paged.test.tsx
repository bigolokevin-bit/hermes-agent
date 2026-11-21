// R229 — 分页态导出换代/三值/空筛文案数字护栏（纯测试单：零产品改动，未造控件）。
// 名实（产品定版事实）：本模块**无真 CSV 导出**（createObjectURL/text/csv/a.download/
// new Blob 源级 0，仅 4 处 data-export="absent"——R190①:113-119 不变量在位）→「导出行」
// 一律映射详情面 knF-copy 数据行（docCopyText→DOC_LINE_HEADER 5 列）；分页只属空间详情
// 面（knE-page-*），行钮实名 kn-row-copy-space-<i>（indexBase 全局 0..N-1，R169）；
// 类型真实键 ?ktype=（旧 ?type= 只读兜底、双删）、无 ?source= 控件；cursor 只在组件态
// 不写 URL——一律从**请求 URL** 断言（红线④）；本地筛选零请求（R157/R164）。缺值两套
// 口径不涉本轮。clip 桩 mockResolvedValue + unstubAllGlobals（R214 教训）。
// 查重（引用不重写）：R216① :134-148（51 行跨页四值计数+cap 整句）、R216② :150-169
// （第 2 页态**清全部**零请求+非法桶出局——当时全 pdf 夹具，真换桶+导出侧未测）、
// R216③ :171-183（末页 disabled 点击零请求）、R131① :115-125（2+1 夹具切筛选归页 1）、
// R197① :135-155（小夹具 knF 名链==表体名链）、R142① :124（单页三值）、R190（无 CSV
// 不变量+createObjectURL spy 形状 :35）、主套件 :3885（空筛文案「有 2 份文档」单位数版）、
// R114/R142 剪贴板拒绝路径（主套件 :2741 等）——本轮不复写。
// 新增维（点名）：
//  ① 分页态（M=51）**首行/末行逐字直对**：knF 首数据行名 toBe 屏上首行、末行 toBe 追加
//    行「卷 51」（R216① 只数行数，R197 名链系单页小夹具）+ cursor 不出现在 URL；
//  ② **第 2 页态真换桶**（表格桶 3 笔）：导出内容换代（knF 集==新表体集、旧行「卷 51」
//    「卷 01」按标识从导出串出局）+ 全程零新请求（「新请求不带 cursor」按现实=无新请求，
//    空集自证）——R216② 用清全部代证、未看导出侧；
//  ③ **分页态本地名筛筛空**：实测「筛空同时归位页 1」——门句数字位回落到 50（moreRows
//    被弃，与 R131①/R216② 的归位语义同源同帧；主套件 :3885 仅锁单页 2 笔版）+ knF
//    disabled + createObjectURL spy 0 + writeText 0 + urls 快照逐字不变。
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
const rowNodes = () => [...container.querySelectorAll('[data-testid="kn3-docs-row"]')];
const rowNames = () => rowNodes().map((r) => txt(r.querySelector('[data-testid="kn3-docs-name"]')));
const btnCount = () => container.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length;
const bucketByLabel = (label: string) =>
  [...container.querySelectorAll('button[data-testid^="kn-type-"]')].find((b) => txt(b).startsWith(label)) ?? null;
const typeIn = async (testid: string, value: string) => {
  const el = q(testid) as HTMLInputElement | null;
  expect(el, testid).toBeTruthy();
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
  const createObjectUrl = vi.fn();
  Object.defineProperty(window.URL, "createObjectURL", { value: createObjectUrl, configurable: true, writable: true });
  return { writeText, createObjectUrl };
};

// 51 行跨页夹具（R216 先例）：P1 恰满 DOCUMENTS_LIMIT=50（47 pdf + 3 xlsx 让「表格」桶在场）
const page50 = Array.from({ length: 50 }, (_, i) =>
  i % 15 === 7
    ? { documentId: `p1_x${i}`, fileName: `册 ${String(i + 1).padStart(2, "0")}.xlsx`, mimeType: "xlsx", sizeBytes: 100 + i, updatedAt: `2026-11-1${(i % 9) + 1}T07:00:00Z` }
    : { documentId: `p1_${i}`, fileName: `卷 ${String(i + 1).padStart(2, "0")}.pdf`, mimeType: "application/pdf", sizeBytes: 100 + i, updatedAt: `2026-11-1${(i % 9) + 1}T07:00:00Z` },
);
const P2_ROW = { documentId: "p2_51", fileName: "卷 51.pdf", mimeType: "application/pdf", sizeBytes: 1, updatedAt: "2026-11-10T01:00:00Z" };
const SP = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 51, status: "synced" }] };
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: page50.slice(0, 3) });
    if (url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: page50, nextCursor: "cpg2" });
    if (url === P2URL) return Promise.resolve({ asOf: SP.asOf, documents: [P2_ROW], nextCursor: null });
    return fail(404, "这个数据接口还没有接入。", "rid-r229");
  });

describe("knowledge export paged parity guards (R229)", () => {
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

  it("① 第 2 页态：knF 行数 == 表体行 == -space- 钮数（三值 toBe）+ 新增维首行/末行逐字直对、cursor 不写 URL", async () => {
    const { writeText } = clipStub();
    wire();
    await render(DETAIL);
    await clickNode(q("knE-page-more"), "load more");
    expect(urls().filter((u) => u === P2URL)).toHaveLength(1); // cursor 只在请求线（红线④）
    expect(loc()).not.toContain("cursor"); // 组件态游标不落 URL
    const names = rowNames();
    expect(names).toHaveLength(51);
    expect(btnCount()).toBe(51);
    await clickNode(q("knF-copy"), "knF paged");
    const lines = String(writeText.mock.calls[0][0]).split("\n").slice(1, -1);
    expect(lines.length).toBe(51); // 三值同帧（计数位引 R216①，不复写 cap）
    expect(lines[0].split(" | ")[0]).toBe(names[0]); // 新增维：首行逐字直对
    expect(lines.at(-1)!.split(" | ")[0]).toBe("卷 51.pdf"); // 末行 = append 新行入链
    expect(lines.map((l) => l.split(" | ")[0])).toEqual(names); // 51 笔分页态全名链（R197 名链的分页版）
  });

  it("② 第 2 页态真换桶（表格）：导出换代无旧行残留 + 全程零新请求（「新请求不带 cursor」现实=无新请求）", async () => {
    const { writeText } = clipStub();
    wire();
    await render(DETAIL);
    await clickNode(q("knE-page-more"), "load more");
    const u0 = urls().join("|");
    expect(bucketByLabel("表格"), "表格桶在场（3 笔 xlsx）").toBeTruthy();
    await clickNode(bucketByLabel("表格"), "bucket 表格 at page-2");
    const names = rowNames();
    expect(names).toHaveLength(3); // 表格桶收窄（屏上侧引 R216② 语义，本例锁导出侧）
    expect(names.every((n) => n.endsWith(".xlsx"))).toBe(true);
    await clickNode(q("knF-copy"), "knF after ktype");
    const text = String(writeText.mock.calls[0][0]);
    const lines = text.split("\n").slice(1, -1);
    expect(lines.map((l) => l.split(" | ")[0])).toEqual(names); // 导出集==新表体集
    expect(text).not.toContain("卷 51.pdf"); // 第 2 页独有行按标识从导出出局
    expect(text).not.toContain("卷 01.pdf"); // 旧 pdf 行零残留
    expect(urls().join("|")).toBe(u0); // 换代全程本地：零新请求 → 自然「无新 cursor 请求」
    expect(loc()).toContain("ktype="); // 真实键（无 ?source= 控件，未造）
  });

  it("③ 分页态本地筛空：名筛切回归位页 1（数字位随重置=50，新增维）+ knF disabled + createObjectURL spy 0 + writeText 0 + urls 逐字不变", async () => {
    const { writeText, createObjectUrl } = clipStub();
    wire();
    await render(DETAIL);
    await clickNode(q("knE-page-more"), "load more");
    expect(rowNames()).toHaveLength(51); // append 确已发生（否则本例空转）
    const u0 = urls().join("|");
    await typeIn("kn3-docs-filter-input", "火星不存在词");
    expect(rowNames()).toEqual([]);
    const btn = q("knF-copy");
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(true); // 空集 disabled（引 R114/R142 拒绝链不复写）
    // 新增维：本地名筛触发改条件归位——measured 数字位回落到 50（moreRows 被弃），
    // 门句与「切筛选回第 1 页」语义同源（主套件 :3885 仅锁单页 2 笔版）。
    expect(btn?.getAttribute("title")).toContain("本地筛选没有留下行：这份列表里有 50 份文档");
    await clickNode(btn, "attempt copy on empty");
    expect(writeText).not.toHaveBeenCalled(); // 零写
    expect(createObjectUrl).not.toHaveBeenCalled(); // 无导出机制（引 R190① 不变量）
    expect(urls().join("|")).toBe(u0); // 归位+筛空+空点击全程零请求（本地动作不吃线）
  });
});
