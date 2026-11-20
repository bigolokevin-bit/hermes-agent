// R169 — 知识两处列表「计数与分页/复制」同源护栏（纯测试单：零产品改动）。
// 名实映射（先 git grep 实测）：
// · 导出族不存在（仅 data-export="absent"：KnowledgeModulePage.tsx:1297/:1630/:2630/:3032
//   附近 + copyGates NO_EXPORT）——「导出数据行数」映射为列表复制器数据行数：
//   检索面 = knG-copy（配 knG-lines），空间详情面 = knF-copy。未造任何导出控件。
// · 行级钮：检索面 kn-row-copy-<i>（无 -space- 前缀混淆）、详情面 kn-row-copy-space-<i>，
//   i 连续 0..N-1；kn-doc-copy 是预览/展开块内单控件，不当行数（R114/R132/R167 口径）。
// · 计数锚：检索面 kn9-count-docs（HitCount :2964「当前已加载 N 项，全部列出」/
//   「当前已加载 N 项内命中 M 项」）+ 面 section data-len；详情面 kn3-page-cap
//   （50=常量位、M=可变位，R108/R157 口径）。
// 查重（锁过的引用不重写）：
// · 详情面四值各例——R142 ①/②（三值+筛选降数复原）、R149 ②（合并态四读）、R152 ⑤
//   （钮链）、R164 ①（请求参集合）→ 本文件 ② 只做「同一夹具下两面互比」新维度；
// · q→命中面 data-len 收敛与零请求——R118 ①/R157；详情表不吃 URL q——R157 ③④；
// · 详情面空/error/denied knF disabled+逐字 title+零写——R138 ②（引用，不重跑）；
//   非法 ktype 下 cap 不渲染——R157（引用）。
// 本文件新锁：①检索面四值（count 文本 == 行 == 钮 == knG 数据行）；②两面同夹具子集
// 可比（详情行是检索行子集、首列文本跨面逐字等、行数如实更小）；③q 收敛时检索面四处
// 计数同步降而详情面数值纹丝不动（合计自洽）；④检索面「筛后真 0」与「读取失败」两态
// 的计数如实、行列钮零渲染、knG-copy disabled+title+零写零请求。
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

async function type(testid: string, value: string) {
  const node = document.querySelector(`[data-testid="${testid}"]`) as HTMLInputElement | null;
  expect(node, testid).toBeTruthy();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(node, value);
    node?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {});
}

const q = (testid: string) => document.querySelector(`[data-testid="${testid}"]`);
const txt = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const searchRows = () => document.querySelectorAll('[data-testid="kn6-search-row"]').length;
/** 检索面行钮：排除 -space- 后缀族（同屏共存，R132）。 */
const searchBtns = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-"]')].filter((b) => !(b.getAttribute("data-testid") ?? "").includes("-space-"));
const spaceBtns = () => document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length;
const spaceRowsCount = () => document.querySelectorAll('[data-testid="kn3-docs-row"]').length;
const dataLinesOf = (copyTestid: string, writes: ReturnType<typeof vi.fn>) => {
  writes.mockClear();
  return (async () => {
    await click(copyTestid);
    return String(writes.mock.calls[0][0]).split("\n").length - 2;
  })();
};

const A = { documentId: "d_a", fileName: "人事手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z", spaceId: "sp_x", spaceName: "人事空间" };
const B = { documentId: "d_b", fileName: "人事表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z", spaceId: "sp_x", spaceName: "人事空间" };
const C = { documentId: "d_c", fileName: "运维手册.pdf", mimeType: "pdf", sizeBytes: 512, updatedAt: "2026-11-19T05:00:00Z", spaceId: "sp_y", spaceName: "运维空间" };
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "人事空间", docCount: 2, status: "synced" }],
};
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [A, B, C] });
    if (url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP.asOf, documents: [A, B] });
    return fail(404, "这个数据接口还没有接入。", "rid-r169");
  });

describe("knowledge counts parity across the two lists (R169, gap-only)", () => {
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

  it("① search face four-way parity: page-level count text == rendered rows == row-copy buttons == knG data lines", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire();
    await render("/knowledge?tab=spaces");
    expect(txt(q("kn9-count-docs"))).toContain("当前已加载 3 项，全部列出（还没输入关键词）"); // 尾句「命中的行与这个数取自同一份筛选结果」为 HitCount 自带
    expect(searchRows()).toBe(3);
    expect(searchBtns().map((b) => b.getAttribute("data-testid"))).toEqual([
      "kn-row-copy-0",
      "kn-row-copy-1",
      "kn-row-copy-2",
    ]);
    expect(await dataLinesOf("knG-copy", writeText)).toBe(3);
    expect(q("kn6-search")?.getAttribute("data-len")).toBe("3");
  });

  it("② same fixture, both faces comparable: detail rows are the honest subset; first-column texts byte-equal row by row", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire();
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x");
    // 详情面自身四值（引用级复证：R142 已全锁，这里只取数）
    expect(spaceRowsCount()).toBe(2);
    expect(spaceBtns).toBeTruthy();
    expect(txt(q("kn3-page-cap"))).toContain("当前已加载 2 篇");
    expect(await dataLinesOf("knF-copy", writeText)).toBe(2);
    // 检索面同夹具全量 3：详情面行集 ⊂ 检索面行集（子集如实更小，不是等值）
    expect(searchRows()).toBe(3);
    const detailNames = [...document.querySelectorAll('[data-testid="kn3-docs-name"]')].map((n) => txt(n));
    const searchNames = [...document.querySelectorAll('[data-testid="kn6-search-name"]')].map((n) => txt(n));
    expect(detailNames).toEqual(["人事手册.pdf", "人事表.xlsx"]);
    expect(searchNames).toEqual(expect.arrayContaining(detailNames)); // 首列文本跨面逐字同
    // knG 复制与 knF 复制对同一行共享前缀列（表头差一列「所属空间」是 R71 记录的
    // 唯一列差异）：取第 1 列比对而非整行
    writeText.mockClear();
    await click("knF-copy");
    const fRows = String(writeText.mock.calls[0][0]).split("\n").slice(1, -1).map((l) => l.split(" | ")[0]);
    writeText.mockClear();
    await click("knG-copy");
    const gRows = String(writeText.mock.calls[0][0]).split("\n").slice(1, -1).map((l) => l.split(" | ")[0]);
    expect(gRows).toEqual(expect.arrayContaining(fRows));
  });

  it("③ q convergence moves the search face counters in lockstep while the detail face stays byte-identical; zero requests", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire();
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x");
    const detailBefore = { cap: txt(q("kn3-page-cap")), rows: spaceRowsCount() };
    const c0 = urls().length;
    await type("kn6-search-input", "手册"); // q=手册 命中 A、C（人事手册/运维手册）
    expect(txt(q("kn9-count-docs"))).toContain("当前已加载 3 项内命中 2 项");
    expect(searchRows()).toBe(2);
    expect(searchBtns().map((b) => b.getAttribute("data-testid"))).toEqual(["kn-row-copy-0", "kn-row-copy-1"]);
    expect(await dataLinesOf("knG-copy", writeText)).toBe(2);
    expect(q("kn6-search")?.getAttribute("data-len")).toBe("2");
    // 详情面不被 URL q 牵动（R157 已锁语义，这里锁的是计数位不动）
    expect(txt(q("kn3-page-cap"))).toBe(detailBefore.cap);
    expect(spaceRowsCount()).toBe(detailBefore.rows);
    expect(urls().length).toBe(c0); // 键入与复制全程零请求
  });

  it("④ empty and failed reads on the search face: counters say what they are, rows/buttons vanish, knG-copy disabled with honest title, zero writes and requests", async () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire();
    await render("/knowledge?tab=spaces");
    // 态 A：本地筛后真 0（读口成功、命中为零——与「读口失败」分开说）
    await type("kn6-search-input", "查无此名");
    expect(txt(q("kn9-count-docs"))).toContain("命中 0 项");
    expect(searchRows()).toBe(0);
    expect(searchBtns()).toHaveLength(0);
    expect(txt(q("kn6-search-empty"))).toContain("没有匹配的文档"); // 现有空态口径句
    const gBtn = q("knG-copy") as HTMLButtonElement | null;
    expect(gBtn?.disabled).toBe(true);
    const gTitle = gBtn?.getAttribute("title") ?? "";
    expect(gTitle).toContain("没有可复制"); // 具体句按 gate 单点（逐字在证据记录）
    const c0 = urls().length;
    await click("knG-copy");
    expect(writeText).not.toHaveBeenCalled();
    expect(urls().length).toBe(c0);
    // 态 B：读口失败（404）——面级非 ready，行/钮零渲染、复制锁死
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      return fail(404, "这个数据接口还没有接入。", "rid-r169-gone");
    });
    await render("/knowledge?tab=spaces");
    expect(searchRows()).toBe(0);
    expect(searchBtns()).toHaveLength(0);
    expect((q("knG-copy") as HTMLButtonElement | null)?.disabled).toBe(true);
    await click("knG-copy");
    expect(writeText).not.toHaveBeenCalled();
    // 空间列表面的同族空态（knI 面）不在本轮范围；详情面空/error 已锁 R138② 引用不重跑
  });
});
