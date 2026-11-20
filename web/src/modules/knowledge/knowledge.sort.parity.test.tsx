// R172 — 知识排序同源护栏（纯测试单：零产品改动）。
// 名实核对（实测）：
// · 「四处同源」的实面盘点：排序控件（kn-sort-<col>，SortableHead :1796）只挂在空间详情面
//   —— DocTable 活动头 :2045-2048 + DocHeadStrip 非 ready 禁用头 :1861-1864；
//   检索命中面与全局文档面同为 SearchDocTable（thead 固定列无排序）——「导出」族不存在
//   （data-export="absent" :1297/:1630/:2630/:3032 + copyGates NO_EXPORT），行序同源
//   断言映射为「表体行序 == 该面列表复制器数据行序」：详情面 knF-copy、命中面 knG-copy
//   （两族文本都走 R71 docLine 单点）。无排序面按派工降级：只锁其行序与复制行序一致，
//   并记「该面无排序控件」为事实缺口（不造控件）。
// · ?source= 非筛选参数、请求不带排序参数（产品本地排序，口径句 :2693「文档读口实测不接受
//   sort/order/orderBy」）——第②腿为断言请求集合逐字不变。
// 查重（锁过的引用不重写）：
// · 三态 URL/aria-sort/等键稳定/缺值垫底两向/粘链复现/复制首末行==表体/整循环零请求——
//   主测 kn-sort 段 :2194-2270（R58/R67 + 排序代次交付记录）已锁；
// · ktype×q×ksort×kdir 组合下请求参集合恰 {limit,spaceId} 且零增量——knowledge.type.source.test.tsx ①
//   （R164，即派工②）已锁 → 引用。
// 本文件新写：①三档排序每一步「行名序列 == 复制数据行序」逐行对账（主测只锁首末行）；
// ④切排序全程 kn3-page-cap 文案逐字不变（排序与「已加载 M 篇」正交，此前无 pin）；
// ②补命中面无排序事实下的行序==knG 复制行逐行一致 + 详情面排序动作不牵动命中面行序。
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
const detailNames = () =>
  [...document.querySelectorAll('[data-testid="kn3-docs-row"] [data-testid="kn3-docs-name"]')].map((n) =>
    (n.textContent ?? "").replace(/\s+/g, " ").trim(),
  );
const hitNames = () =>
  [...document.querySelectorAll('[data-testid="kn6-search-row"] [data-testid="kn6-search-name"]')].map((n) =>
    (n.textContent ?? "").replace(/\s+/g, " ").trim(),
  );
const capText = () => (q("kn3-page-cap")?.textContent ?? "").replace(/\s+/g, " ").trim();
/** 复制文本的数据行第 1 列（表头后、尾换行前）。 */
async function copyFirstColumn(testid: string, writes: ReturnType<typeof vi.fn>) {
  writes.mockClear();
  await click(testid);
  return String(writes.mock.calls[0][0])
    .split("\n")
    .slice(1, -1)
    .map((l) => l.split(" | ")[0]);
}

const D_SMALL = { documentId: "d_s", fileName: "小抄.pdf", mimeType: "application/pdf", sizeBytes: 10, updatedAt: "2026-11-19T05:00:00Z" };
const D_MID = { documentId: "d_m", fileName: "中册.xlsx", mimeType: "xlsx", sizeBytes: 2000, updatedAt: "2026-11-19T07:00:00Z" };
const D_NONE = { documentId: "d_n", fileName: "无 metadata 档" }; // 类型/大小/更新全缺
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 3, status: "synced" }],
};
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [D_SMALL, D_MID, D_NONE] });
    if (url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP.asOf, documents: [D_SMALL, D_MID, D_NONE] });
    return fail(404, "这个数据接口还没有接入。", "rid-r172");
  });

describe("knowledge sort parity guards (R172, gap-only)", () => {
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

  it("①④ every sort step keeps row-name order == knF copy line order row by row; the cap sentence and request set are byte-identical throughout", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire();
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x");
    const c0 = urls().length;
    const u0 = urls().slice().sort().join("|");
    const capFixed = capText();
    expect(capFixed).toContain("本页最多显示 50 篇（当前已加载 3 篇；复制清单也只含这些篇）");

    // none（默认 updated/desc：07:00 中册 → 05:00 小抄 → 缺值垫底）
    await step("none");
    // asc
    await click("kn-sort-name");
    await step("asc");
    // desc
    await click("kn-sort-name");
    await step("desc");
    // none（清除回默认）
    await click("kn-sort-name");
    await step("none-again");
    // size 与 updated 档各再走一遍逐行对账
    await click("kn-sort-size");
    await step("size-asc");
    await click("kn-sort-updated");
    await step("updated-asc");

    async function step(label: string) {
      const rows = detailNames();
      const copy = await copyFirstColumn("knF-copy", writeText);
      expect(copy, label).toEqual(rows); // 逐行 toEqual（主测只锁首末行）
      expect(capText(), label).toBe(capFixed); // ④ cap 句逐字不变（排序不触「已加载 M」）
    }
    // 全程零重取数（主测整循环零请求已锁语义；本例是逐行对账循环的同一快照口径）
    expect(urls().length).toBe(c0);
    expect(urls().slice().sort().join("|")).toBe(u0);
  });

  it("② hit face has no sort affordance (fact gap recorded) — its row order still equals its knG copy line order row by row and is untouched by detail-face sort churn", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire();
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x");
    // 名实：排序控件只在详情面（DocTable/DocHeadStrip）——命中面表头无 kn-sort
    expect(q("kn6-search-table")?.querySelectorAll('[data-testid^="kn-sort-"]')).toHaveLength(0);
    const hits0 = hitNames();
    const copy0 = await copyFirstColumn("knG-copy", writeText);
    expect(copy0).toEqual(hits0); // 命中面行序 == knG 数据行序（逐行）
    // 详情面切排序：命中面行序与自身复制行序都不被牵动（两面各自独立派生）
    await click("kn-sort-name");
    await click("kn-sort-name");
    expect(hitNames()).toEqual(hits0);
    expect(await copyFirstColumn("knG-copy", writeText)).toEqual(hits0);
    // 而详情面此刻确已换序（反证两面不互染）
    expect(detailNames()[0]).toBe("中册.xlsx"); // updated-desc 默认首行
    await click("kn-sort-name"); // 第三次点击清除回默认
  });
});
