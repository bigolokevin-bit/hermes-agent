// R152 — 空间详情分页护栏补缺（纯测试单：零产品改动）。
// 查重判定（先 git grep，锁过的引用不重写）：
// ①第二页追加后四读互等（行数==cap-M==data-len==knF 行）+ 跨页重叠去重
//   —— knowledge.requests.test.tsx ②（R149）已锁 → 引用。
// ②筛选切换新请求不带旧 cursor、行替换非累加 —— knowledge.paging.test.tsx ①（R131，
//   「C 说明」按标识出局 + cursor= 全程恰 1）+ knowledge.filters.test.tsx ②（R118）已锁 → 引用。
// ③末页 disabled+文案 —— 主测 :2540-2541 / R131②:135-137 已锁；cap 计数互等 R131② 已锁；
//   **缺口：knE-page-more 的 title 句**（末页态「信封给了游标字段且下一页为空：这就是末页。」
//   与无游标态「上游回答没给分页游标：有多少页无法判断，不猜、也不谎称末页。」只在产品侧
//   KnowledgeModulePage.tsx:2588-2594，无任何测试锁）→ 本文件补。
// ④第 2 页 500：保旧行/rid/重试恰一次 —— R131③ + 主测 F 段已锁 → 引用。
// ⑤加载更多后复制三值 —— R131④ 已锁 copy 行==rowCount==data-len==cap M；
//   **缺口：合并态下 kn-row-copy-space-<i> 钮数与 i 连续 0..M-1**（R142① 的 [0,1,2] 是同页
//   三行夹具，非翻页合并态）→ 本文件补。
// 名实替换照派工：cap 的 N=50 为常量位、M 为可变位；?source= 无控件（ktype/q 替）；
// 详情面行钮实名 kn-row-copy-space-<i>；导出族仅 data-export="absent"，不造。
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
const P2URL = `${P1URL}&cursor=c9`;

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
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const spaceBtnIds = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')]
    .map((b) => b.getAttribute("data-testid"))
    .sort((a, b) => Number(a!.slice(-1)) - Number(b!.slice(-1)));
const visibleRows = () => document.querySelectorAll('[data-testid="kn3-docs-row"]').length;
const moreBtn = () => q("knE-page-more") as HTMLButtonElement | null;

const D1 = { documentId: "d_1", fileName: "一 手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const D2 = { documentId: "d_2", fileName: "二 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const D3 = { documentId: "d_3", fileName: "三 说明.txt", mimeType: "txt", sizeBytes: 512, updatedAt: "2026-11-19T05:00:00Z" };
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 3, status: "synced" }],
};
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

const wire = (p1: Record<string, unknown>, p2?: Record<string, unknown>) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [] });
    if (url === P1URL) return Promise.resolve(p1);
    if (url === P2URL && p2) return Promise.resolve(p2);
    return fail(404, "这个数据接口还没有接入。", "rid-r152");
  });

describe("knowledge space-detail paging guards (R152, gap-only)", () => {
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

  it("③ knE-page-more carries the honest title in both end-shapes: real last page vs no-cursor envelope", async () => {
    // 态 A：信封给游标、下一页为空 —— 真末页
    wire({ asOf: SP.asOf, documents: [D1], nextCursor: "c9" }, { asOf: SP.asOf, documents: [], nextCursor: null });
    await render(DETAIL);
    await click("knE-page-more");
    expect(moreBtn()?.disabled).toBe(true); // R131②/主测已锁 disabled+文案——此处为 title 断言的前置在场证
    expect(moreBtn()?.getAttribute("title")).toBe("信封给了游标字段且下一页为空：这就是末页。");
    expect(q("knE-page-end")).toBeTruthy();
    // 态 B：信封根本没有游标字段 —— 不许谎称末页
    wire({ asOf: SP.asOf, documents: [D1, D2] }); // 无 nextCursor 键
    await render(DETAIL);
    expect(moreBtn()?.disabled).toBe(true);
    expect(moreBtn()?.getAttribute("title")).toBe("上游回答没给分页游标：有多少页无法判断，不猜、也不谎称末页。");
    expect(q("knE-page-end")).toBeNull();
    // 两态全程零多余请求：除态 A 那一次翻页读取外无任何增量
    expect(urls().filter((u) => u === P2URL)).toHaveLength(1);
  });

  it("⑤ after loading more, kn-row-copy-space buttons == visible rows with i contiguous 0..M-1 (merged state, complement of R142 first-page lock)", async () => {
    wire({ asOf: SP.asOf, documents: [D1, D2], nextCursor: "c9" }, { asOf: SP.asOf, documents: [D3], nextCursor: null });
    await render(DETAIL);
    expect(spaceBtnIds()).toEqual(["kn-row-copy-space-0", "kn-row-copy-space-1"]);
    await click("knE-page-more");
    expect(visibleRows()).toBe(3);
    expect(spaceBtnIds()).toEqual(["kn-row-copy-space-0", "kn-row-copy-space-1", "kn-row-copy-space-2"]);
    // 三值互等（合并态补齐：R131④ 锁了复制/data-len/cap M，此处补钮数入链）
    expect(spaceBtnIds().length).toBe(visibleRows());
    expect(q("kn3-docs")?.getAttribute("data-len")).toBe(String(visibleRows()));
    // 编号跟随当前可见行序：筛到 1 行后只剩 0 号（合并态行替换非累加的钮面复证）
    await click("kn-type-1"); // xlsx 桶
    expect(spaceBtnIds()).toEqual(["kn-row-copy-space-0"]);
    expect(visibleRows()).toBe(1);
  });
});
