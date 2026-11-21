// R253 — 空间详情导出 × 全局导出一致性：跨面排序零传染帧（②新增维单例）；①③判定引用（纯测试·零产品改动）。
// 名实换算（产品定版，断言即现实，禁造控件/禁改产品）：
// · **无真 CSV 导出**（源级 createObjectURL/text/csv/a.download/new Blob 全 0、仅 4 处
//   data-export="absent"、kn-list-copy 不存在——R190①:113-119 不变量）→「导出」= 复制器
//   数据行：详情面 knF-copy（docCopyText→DOC_LINE_HEADER 5 列）、全局检索面 knG-copy
//   （docHitCopyText 6 列，**所属空间固定第 2 列**——R71/R200②）；createObjectURL spy
//   全程 0。
// · 排序器械**只存在于详情面**（?ksort/?kdir，旧 ?sort/?dir 只读兜底；检索面无排序参/
//   无分页/无 cap——R164/R166 面族）→ 派工「两侧各按自己的排序参」在检索面无参可施，
//   按现实断言为：详情排序只动详情侧（行序+knF 链），**全局面行序与 knG 导出文本与
//   列表读集合逐字不动、零新请求**（排序纯本地、后端忽略排序参引 R164①:142）。
// · 派工③「page-cap 显 0」不可兑现：kn3-page-cap 在 true-0/错误/拒绝/非法枚举实测
//   **null（不渲染）**——R108/R157/R187/R231②/R234③/R236③；kn-space-page-cap 不存在
//   （R187 断缺席）。
// 【三腿查重裁决（file:line；全锁只引用，禁造重复用例）】
//  ①「同文档五字段跨面逐字」＝**全锁**：R214②（knowledge.export.columns2.test.tsx
//    :158 `gCols.slice(2) toEqual cols.slice(1)`——knG 去所属空间列后与 knF 行逐位等，
//    名/类型/大小/更新/短码五字段俱在其内）+ R200②（列头差集）+ R209/R223/R226①/
//    R233（单面格↔串与抽屉双载体）→ 引用不复写。
//  ②「行序各随其排序不互染」＝半锁：详情侧排序→knF 跟随已锁 R235②（order.filter:
//    sorted-set+链跟随+零请求）与 R240②（M=51 弃页版）；检索面对详情侧动作的免疫
//    **只测过桶/名筛 churn 的 data-len 计数**（R176②⑤）——「详情排序后 **knG 导出
//    全文逐字 + 检索行名序列 + 列表读集合** 三物同帧不动、零新请求」未锁 → 新维单例
//    （本文件唯一用例）。
//  ③「两侧空集 disabled+title、cap、零调用」＝**全锁**：R231②（empty.export:99-123
//    同一空集帧 knF+knG 双 disabled+「没有可复制」+零写零请求+计数位「—」+cap null+
//    裸 0 扫描）+ R190④(escape:190-205) + R236③(open.detail:182-210 两翼判别句) +
//    R138 → 引用不复写；差异记录：cap=null 非 0。
// 其余红线：缺值两式禁统一；短码大写尾段全 id 仅 title；裸 MIME/字节只进 title；行钮
// 分面 -space-/检索面；kn-doc-copy 单控件非行数；?source= 无控件（未造）；clip 桩
// mockResolvedValue + afterEach unstubAllGlobals（R214，Errors 0 硬要求）。
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
const loc = () => txt(q("loc"));
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const detailRows = () => [...document.querySelectorAll('[data-testid="kn3-docs-row"]')];
const detailNames = () => detailRows().map((r) => txt(r.querySelector('[data-testid="kn3-docs-name"]')));
const hitNames = () => [...document.querySelectorAll('[data-testid="kn6-search-row"]')].map((r) => txt(r.querySelector('[data-testid="kn6-search-name"]')));
const dataLines = (text: string) => text.split("\n").slice(1, -1);
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.URL, "createObjectURL", { value: vi.fn(), configurable: true, writable: true });
  return writeText;
};

// 名序与大小序刻意错开（默认 updated 降序 [丁,丙,乙,甲] vs size 降序 [A400,B300,C200,D100]）
const D = (id: string, fileName: string, sizeBytes: number, hh: number) => ({
  documentId: id, fileName, mimeType: "pdf", sizeBytes, updatedAt: `2026-11-19T${String(hh).padStart(2, "0")}:00:00Z`,
});
const DOCS = [D("d_a", "甲大.pdf", 400000, 6), D("d_b", "乙中.pdf", 300000, 7), D("d_c", "丙小.pdf", 200000, 5), D("d_d", "丁微.pdf", 100000, 8)];
const SP = { asOf: "2026-11-19T09:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: DOCS.length, status: "synced" }] };
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN || url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: DOCS });
    return fail(404, "这个数据接口还没有接入。", "rid-r253-x");
  });

describe("knowledge space × global export consistency (R253)", () => {
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

  it("② 新增维：详情面点 size 排序——详情侧行序与 knF 链同步翻序，全局面行名序列 + knG 导出全文 + 列表读集合**三物逐字不动**、全程零新请求（①③裁决见头注：R214②:158 与 R231②:99-123 等全锁不复写）", async () => {
    const writeText = clipStub();
    wire();
    await render(DETAIL);
    const namesD0 = detailNames();
    expect(namesD0).toEqual(["丁微.pdf", "乙中.pdf", "甲大.pdf", "丙小.pdf"]); // 默认 updated 降序（打散位）
    const namesH0 = hitNames();
    await clickNode(q("knG-copy"), "knG before sort");
    const gText0 = String(writeText.mock.calls[0][0]);
    const u0 = urls().join("|");
    const list0 = urls().filter((x) => !x.startsWith("/agent-api/api/documents/d_")).join("|");
    // 详情面切 size 排序（首点=本列默认向）
    await clickNode(q("kn-sort-size"), "sort size on detail face");
    const namesD1 = detailNames();
    expect(namesD1).not.toEqual(namesD0); // 详情侧确已翻序
    expect(new Set(namesD1)).toEqual(new Set(namesD0)); // 行集不变只改序（引 R235② 口径）
    await clickNode(q("knF-copy"), "knF after sort");
    expect(dataLines(String(writeText.mock.calls[1][0])).map((l) => l.split(" | ")[0])).toEqual(namesD1); // knF 跟随新序
    // **跨面零传染三物**（新维本体）
    expect(hitNames()).toEqual(namesH0); // 全局面行名序列逐字
    writeText.mockClear();
    await clickNode(q("knG-copy"), "knG after sort");
    expect(String(writeText.mock.calls[0][0])).toBe(gText0); // knG 导出全文逐字
    expect(urls().filter((x) => !x.startsWith("/agent-api/api/documents/d_")).join("|")).toBe(list0); // 列表读集合逐字
    expect(urls().join("|")).toBe(u0); // 全程零新请求（排序纯本地——禁「恰 1 次」）
    expect(loc()).toContain("ksort=size"); // 写只写真实键（旧 sort/dir 兜底不涉本帧）
  });
});
