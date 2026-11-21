// R249 — 页 2 追加帧三方首行并置（①残余）；②③全锁→判定引用（纯测试单·零产品改动）。
// 【三腿查重裁决（file:line；全锁禁复写）】
//  ①「第 2 页追加后三值 + 首行同源」主体已锁：R229①（export.paged:140-156：三值
//    [51,51,51]、首行==屏上、末行=追加行、全名链==屏上链、cursor 从请求 URL、cap 整句
//    逐字）+ R216①:134-148（四值+钮 [0..50]）+ R197①:138-155（五读小夹具）+ R248①
//    （space.export.filters:131 起：深链 48 规模三方首行帧）。
//    **唯一残余**=「append 至 51 的帧里，行钮 0 串首段是否也==屏上首行==导出链首」的
//    **三方并置**（R229① 锁了两方位+名链、R248① 的三方在**无追加**的 48 起点帧——
//    三方首行 × M=51 追加帧从未同帧）→ 本文件落此一位。
//  ②「切桶换代零残留+上限句如实」＝**全锁**：R237②(rowcopy.triple:170-191 序重建
//    [0,1]+pdf 零残留+链数+回全部复原) + R244γ′/δ′(paging.filters 名筛弃页+不回+链
//    ==屏上+cap M) + R247①(filters.test 48 弃页帧三方首行+capM48) + R235③/R239②/
//    R131① → 不复写。
//  ③「500 窗只导成功页+rid+重试 +1+三值同步」＝**全锁**：R237③(rowcopy.triple:193-224
//    窗三读+rid 投递+合成) + R238C(paging.triple:162 字节冻结+尾段合成) + R247②
//    (ktype 在场 48 基数窗+入链 49) + R239③(detail.paging 列表窗×抽屉) + R216④/R131③
//    → 不复写。
// 名实（红线照落）：`kn-space-page-cap` 不存在（R187 断缺席）——上限句实名 kn3-page-cap
// （50 常量槽/M 可变=当前条件后在屏数 R244γ′、行数 50 出 -more、true-0/error/denied/
// 非法=null）；无真 CSV（createObjectURL/text/csv/a.download/new Blob 源级 0、absent ×4、
// kn-list-copy 不存在——R190①:113-119）→「导出」= knF 数据行、spy 全程 0；?type=pdf→
// ?ktype=PDF（本笔不涉切桶，声明换算）；本地动作零新请求（禁「恰 1 次」）；只有详情面
// 分页（knE-page-*）、行钮 kn-row-copy-space-<i> indexBase 0..N-1（R132/R169）；51 行
// 夹具（R216 先例）；cursor 只在组件态从请求 URL 断言；缺值两口径不涉；短码尾段全 id
// 仅 title；clip 桩 mockResolvedValue + unstubAllGlobals（R214，Errors 0 硬要求）。
// 真新增维（点名 1 条）：**M=51 追加帧的三方首行并置**——钮 0 串首段 == 屏上首行 ==
// knF 链首行，与三值 [51,51,51]、P2 请求恰一、复制段零新请求同帧。
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
const rowNodes = () => [...document.querySelectorAll('[data-testid="kn3-docs-row"]')];
const rowNames = () => rowNodes().map((r) => txt(r.querySelector('[data-testid="kn3-docs-name"]')));
const btnCount = () => document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length;
const dataLines = (text: string) => text.split("\n").slice(1, -1);
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.URL, "createObjectURL", { value: vi.fn(), configurable: true, writable: true });
  return writeText;
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
    return fail(404, "这个数据接口还没有接入。", "rid-r249-x");
  });

describe("knowledge export space paging tripartite head frame (R249)", () => {
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

  it("① 新增维（唯一残余）：M=51 追加帧三方首行并置——钮 0 串首段==屏上首行==knF 链首 + 三值 [51,51,51] + P2 恰一 + cursor 不入 URL + 复制段零新请求（②③见头注：R237②/R244γ′δ′/R247①②/R237③/R238C/R239③ 全锁不复写）", async () => {
    const writeText = clipStub();
    wire();
    await render(DETAIL);
    await clickNode(q("knE-page-more"), "append to 51");
    expect(urls().filter((u) => u === P2URL)).toHaveLength(1); // cursor 从请求 URL（R229① 位引用）
    expect(loc()).not.toContain("cursor"); // 不入 URL（红线）
    expect(rowNames()).toHaveLength(51);
    await clickNode(document.querySelector('button[data-testid="kn-row-copy-space-0"]'), "btn 0");
    const btnHead = String(writeText.mock.calls[0][0]).split("\n")[1].split(" | ")[0];
    await clickNode(q("knF-copy"), "knF at 51");
    const lines = dataLines(String(writeText.mock.calls[1][0]));
    const names = rowNames();
    expect([names.length, btnCount(), lines.length]).toEqual([51, 51, 51]); // 三值（计数位引 R229① 不重测链全等）
    expect(btnHead).toBe(names[0]); // **三方并置新位**
    expect(lines[0].split(" | ")[0]).toBe(names[0]);
    expect(urls().length).toBe(4); // spaces+plain+p1+p2：复制段零新请求（R215③ 口径）
  });
});
