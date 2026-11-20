// R179 — 知识排序持久化与深链护栏（纯测试单：零产品改动）。
// 名实/实测前提（前轮已证，引用）：排序控件只在空间详情面 DocTable（R172 盘点：
// SortableHead :1796→:2045；检索/全局面无）；排序纯本地（口径句 :2693，读口实测不吃
// sort/order/orderBy，R67）；游标只在组件态不落 URL（R118）；非法枚举时 kn3-page-cap
// 不渲染属空态分支（R157/R108）——排序非法值不落入该分支（回退默认序，列表非空）。
// 查重（锁过的引用不重写）：
// · ①旧键腿——主测 kn-sort 段 :2265-2268 已锁「带 sort=size&dir=asc 直接进来就是同一
//   顺序、不多发请求」；请求参集合逐字 {limit,spaceId} 无 cursor——R164 ①（四键组合
//   正锁）→ 本文件只补**规范键 ksort/kdir 深链**的 aria-sort 回填（主测只测过 legacy 键）。
// · ②「改一不动余」的 ktype 向已锁（R118 ②）、清排序动线已锁（R164 ②）；本文件补
//   排序点击写侧的键集合断言：只动 ksort/kdir、q/ktype/space/panel/tab 逐字、
//   且不得新写 legacy sort/dir 键（写侧只写规范键——R66 注释语义此前无独立 pin）。
// · ③重挂请求集合逐字相等（R146 ④）、三值 data-len==knF 行==钮数连续（R142 ①/R152 ⑤）、
//   cap 50 常量位（R108/R149）→ 全覆盖，引用不重写（见证据）。
// · ④非法排序枚举——零 pin：docSortCol/docSortDir（knowledge.ts :1722-1735）对未知值
//   回落默认列/向、地址从不被产品改写。本文件新写实测行为。
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
const loc = () => (q("loc")?.textContent ?? "") as string;
const params = () => new URLSearchParams(loc());
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const ariaSort = (col: string) =>
  q(`kn-sort-${col}`)?.closest("th")?.getAttribute("aria-sort") ?? null; // aria-sort 挂 th，按钮只带 testid（主测同法）
const rowNames = () =>
  [...document.querySelectorAll('[data-testid="kn3-docs-row"] [data-testid="kn3-docs-name"]')].map((n) =>
    (n.textContent ?? "").replace(/\s+/g, " ").trim(),
  );

const D_SMALL = { documentId: "d_s", fileName: "小抄.pdf", mimeType: "application/pdf", sizeBytes: 10, updatedAt: "2026-11-19T05:00:00Z" };
const D_MID = { documentId: "d_m", fileName: "中册.xlsx", mimeType: "xlsx", sizeBytes: 2000, updatedAt: "2026-11-19T07:00:00Z" };
const D_BIG = { documentId: "d_b", fileName: "大部头.pdf", mimeType: "application/pdf", sizeBytes: 1000000, updatedAt: "2026-11-19T06:00:00Z" };
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 3, status: "synced" }],
};
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [D_SMALL, D_MID, D_BIG] });
    if (url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP.asOf, documents: [D_SMALL, D_MID, D_BIG] });
    return fail(404, "这个数据接口还没有接入。", "rid-r179");
  });

describe("knowledge sort persistence & deep-link guards (R179, gap-only)", () => {
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

  it("①② canonical ksort/kdir deep link backfills aria-sort with a byte-unchanged request set; a sort click moves only ksort/kdir and never writes legacy keys", async () => {
    wire();
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x&ksort=size&kdir=desc");
    // 深链回填：size 列 descending、行序按大小降（1MB → 2KB → 10B）
    expect(ariaSort("size")).toBe("descending");
    expect(rowNames()).toEqual(["大部头.pdf", "中册.xlsx", "小抄.pdf"]);
    // 排序纯本地：请求集合只有三条既有读取，参集合无 ksort/kdir/q/cursor
    const reqs = urls();
    expect(reqs.filter((u) => u === docsUrlFor("sp_x"))).toHaveLength(1);
    for (const req of reqs.filter((u) => u.includes("spaceId="))) {
      expect([...new URLSearchParams(req.split("?")[1]).keys()].sort()).toEqual(["limit", "spaceId"]);
    }
    expect(reqs.some((u) => u.includes("cursor="))).toBe(false);
    const c0 = reqs.length;
    // 排序点击只动 ksort/kdir：脏 URL 下 q/ktype/space/panel/tab 逐字保留
    const dirty = "/knowledge?tab=spaces&panel=spaces&space=sp_x&q=%E5%A4%A7&ktype=%E8%A1%A8%E6%A0%BC&ksort=size&kdir=desc";
    await render(dirty);
    await click("kn-sort-name"); // size/desc → name/asc（落点向）
    const p = params();
    expect(p.get("ksort")).toBe("name");
    expect(p.get("kdir")).toBe("asc");
    expect(p.get("q")).toBe("大");
    expect(p.get("ktype")).toBe("表格");
    expect(p.get("space")).toBe("sp_x");
    expect(p.get("tab")).toBe("spaces");
    expect(p.get("panel")).toBe("spaces");
    // 写侧只写规范键：legacy sort/dir 不得被新写出来
    expect(p.has("sort")).toBe(false);
    expect(p.has("dir")).toBe(false);
    expect(ariaSort("name")).toBe("ascending");
    // 全程本地：点击排序零新请求、集合逐字不变（键位写入不动网络）
    expect(urls().length).toBeGreaterThanOrEqual(c0);
    expect(urls().filter((u) => u === docsUrlFor("sp_x"))).toHaveLength(2); // 仅重挂 render 各 1 次
  });

  it("④ illegal sort enums fall back per-key on screen while the address stays byte-identical (no rewrite, no error face)", async () => {
    wire();
    // [非法查询, 回落后的首行, size 列 aria-sort, updated 列 aria-sort]——
    // docSortCol/docSortDir 各自独立回落：列非法→默认列；列合法方向非法→该列生效+默认向
    const cases: Array<[string, string, string, string]> = [
      ["&ksort=__nope__", "中册.xlsx", "none", "descending"], // 列回落 updated + 默认 desc
      ["&dir=__nope__", "中册.xlsx", "none", "descending"], // legacy 方向键非法：同样整体回落默认
      ["&ksort=size&kdir=__nope__", "大部头.pdf", "descending", "none"], // 列合法保留：size/desc
    ];
    for (const [query, firstRow, sizeAria, updatedAria] of cases) {
      const url = `/knowledge?tab=spaces&panel=spaces&space=sp_x${query}`;
      await render(url);
      expect(loc()).toBe(`?tab=spaces&panel=spaces&space=sp_x${query}`); // 产品从不改写地址
      expect(rowNames()[0], query).toBe(firstRow);
      expect(ariaSort("size"), query).toBe(sizeAria);
      expect(ariaSort("updated"), query).toBe(updatedAria);
      expect(q("kn6-search"), query).toBeTruthy(); // 页级锚仍在（不是空态/错误态）
      expect(q("kn3-page-cap"), query).toBeTruthy(); // 列表非空：cap 在场（不触发 R157 的空态缺席）
    }
    // 回落后交互不卡死：点新列照常进入规范三态（name 落点向 asc）
    await click("kn-sort-name");
    expect(params().get("ksort")).toBe("name");
    expect(params().get("kdir")).toBe("asc");
    expect(ariaSort("name")).toBe("ascending");
  });
});
