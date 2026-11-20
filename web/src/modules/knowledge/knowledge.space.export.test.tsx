// R142 — 空间详情文档列表「清单复制 × 行复制 × 可见行」三值同源护栏（纯测试单：零产品改动）。
// 名实核对（派工三处按 grep 现状落，勿造控件）：
// · 导出族不存在：全页仅 data-export="absent" 标记（KnowledgeModulePage.tsx:1297/:1630/
//   :2630/:3032）与 copyGates NO_EXPORT——「导出」一律以清单复制 knF-copy 为代表。
// · kn-doc-copy*（DocLineCopy，R114）只挂行内预览与检索展开块，一次一份；本面逐行复制
//   是 R132 的 kn-row-copy-space-<i>。三值 = 可见行数 == 行钮数 == knF 文本数据行数。
// · 本面「筛选」可用维度：类型桶 kn-type-*（?ktype=）与本地名筛选（kn3-docs-filter-input，
//   组件本地态非 URL）；都零请求（R118/R54 已锁口径，本文件只补三值同步面）。
// 复用不重写：R108 已锁 cap 三值单页态；R131 已锁两页合并三值；R132 已锁行钮==文本同源
// 与排序随序；R138 已锁 knF 四态禁用句——本文件 ④ 只在「ghost/ktype 非法」组合位点复证
// 不渲染伪造行，禁用句断言引用同句逐字但不重跑四态循环。
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

async function clickNode(node: Element | null, label: string) {
  expect(node, label).toBeTruthy();
  await act(async () => {
    node?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {});
}
const click = (testid: string) => clickNode(document.querySelector(`[data-testid="${testid}"]`), testid);

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
const spaceRows = () => [...document.querySelectorAll('[data-testid="kn3-docs-row"]')];
const spaceBtns = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')]
    .sort((a, b) => Number(a.getAttribute("data-testid")!.slice(-1)) - Number(b.getAttribute("data-testid")!.slice(-1)));
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));

const D1 = { documentId: "d_p", fileName: "P 手册.pdf", mimeType: "application/pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const D2 = { documentId: "d_q", fileName: "Q 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const D3 = { documentId: "d_r", fileName: "R 缺项" }; // 类型/大小/时间全缺
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 3, status: "synced" }],
};
const wireSpace = (documents: unknown[]) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [] });
    if (url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP.asOf, documents });
    return fail(404, "这个数据接口还没有接入。", "rid-r142");
  });

/** 三值读数：可见行 / 行钮 / knF 清单数据行数。 */
async function triple(writes: ReturnType<typeof vi.fn>) {
  const visible = spaceRows().length;
  const btns = spaceBtns().length;
  writes.mockClear();
  await click("knF-copy");
  const lines = String(writes.mock.calls[0][0]).split("\n");
  return { visible, btns, listLines: lines.length - 2, lines };
}

describe("knowledge space-docs copy triple-source guards (R142, tests only)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("① visible rows == kn-row-copy-space-<i> buttons == knF list data lines, with i contiguous from 0; preview kn-doc-copy text is that row's button text byte-equal", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wireSpace([D1, D2, D3]);
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x");
    const t = await triple(writeText);
    expect(t.visible).toBe(3);
    expect(t.btns).toBe(3);
    expect(t.listLines).toBe(3);
    expect(spaceBtns().map((b) => b.getAttribute("data-testid"))).toEqual([
      "kn-row-copy-space-0",
      "kn-row-copy-space-1",
      "kn-row-copy-space-2",
    ]); // i 连续 0..N-1
    // 预览单行 vs 行钮：打开第 1 行（Q 表）预览，kn-doc-copy 文本 == kn-row-copy-space-? 同钮文本
    const rowQ = spaceRows().find((r) => (r.textContent ?? "").includes("Q 表.xlsx"))!;
    const idx = spaceRows().indexOf(rowQ);
    await clickNode(rowQ.querySelector('[data-testid="kn-doc-preview-toggle"]'), "preview toggle");
    writeText.mockClear();
    await click("kn-doc-copy");
    const previewLine = String(writeText.mock.calls[0][0]);
    writeText.mockClear();
    await clickNode(spaceBtns()[idx], `kn-row-copy-space-${idx}`);
    const buttonLine = String(writeText.mock.calls[0][0]);
    expect(buttonLine).toBe(previewLine); // 逐字 toBe：同一 docSingleCopy
    // 清单同体：列表 lines[idx+1] == 单行 split("\n")[1]
    expect(t.lines[idx + 1]).toBe(previewLine.split("\n")[1]);
  });

  it("② both filter faces keep the triple locked to one number; clearing returns to the original; zero requests", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wireSpace([D1, D2, D3]);
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x");
    const base = await triple(writeText);
    expect([base.visible, base.btns, base.listLines]).toEqual([3, 3, 3]);
    const c0 = urls().length;
    // 类型桶：只看 PDF（1 行）
    await click("kn-type-1"); // 桶序按出现序：1=PDF（D1 首现）；若序变，下面按在场断言自纠
    const btnsAfter = spaceBtns();
    const tPdf = await triple(writeText);
    expect(tPdf.visible).toBe(tPdf.btns);
    expect(tPdf.btns).toBe(tPdf.listLines);
    expect(tPdf.visible).toBeLessThan(3);
    // 清回全部
    await click("kn-type-all");
    const back = await triple(writeText);
    expect([back.visible, back.btns, back.listLines]).toEqual([3, 3, 3]);
    // 本地名筛：留 1 行
    await type("kn3-docs-filter-input", "Q 表");
    const tOne = await triple(writeText);
    expect([tOne.visible, tOne.btns, tOne.listLines]).toEqual([1, 1, 1]);
    expect(tOne.lines[1]).toContain("Q 表.xlsx");
    await type("kn3-docs-filter-input", "");
    const cleared = await triple(writeText);
    expect([cleared.visible, cleared.btns, cleared.listLines]).toEqual([3, 3, 3]);
    expect(spaceBtns()[0].getAttribute("data-testid")).toBe("kn-row-copy-space-0"); // 清空后编号仍 0 起重排
    expect(urls().length).toBe(c0); // 全程本地：零请求
    void btnsAfter;
  });

  it("③ missing type/size/updated: list line and row-button line byte-equal with 「—」 columns, and a fake 2031 clock never leaks", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    vi.useFakeTimers({ now: new Date("2031-03-04T09:12:00Z") });
    wireSpace([D1, D3]);
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x");
    const rowR = spaceRows().find((r) => (r.textContent ?? "").includes("R 缺项"))!;
    const idx = spaceRows().indexOf(rowR);
    writeText.mockClear();
    await clickNode(spaceBtns()[idx], "row button for R");
    const single = String(writeText.mock.calls[0][0]).split("\n")[1];
    expect(single).toBe("R 缺项 | — | — | — | DR"); // 缺值三列皆「—」，短码=shortId("d_r")
    writeText.mockClear();
    await click("knF-copy");
    const list = String(writeText.mock.calls[0][0]).split("\n");
    expect(list[idx + 1]).toBe(single); // 清单与行钮对同一行逐字等
    // 本机时钟零参与：整屏文本无 2031（假时钟在场渲染）
    expect(document.body.textContent ?? "").not.toContain("2031");
    vi.useRealTimers();
  });

  it("④ empty and read-failure: knF stays disabled with the locked sentence, click writes nothing, fetch churn zero; ktype-illegal/ghost render no fabricated rows", async () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    // 真 0 行
    wireSpace([]);
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x");
    let btn = q("knF-copy") as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(true);
    const c0 = urls().length;
    await click("knF-copy");
    expect(writeText).not.toHaveBeenCalled();
    expect(urls().length).toBe(c0);
    expect(spaceBtns()).toHaveLength(0); // 无行 = 无钮：不渲染伪造行钮
    // 读口失败
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [] });
      if (url === docsUrlFor("sp_x")) return fail(500, "上游读取失败。", "rid-r142-500");
      return fail(404, "这个数据接口还没有接入。", "rid-r142");
    });
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x");
    btn = q("knF-copy") as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(true);
    expect(btn?.getAttribute("title")).toBe("这次没有读到文档列表，没有可复制的内容。"); // R138 逐字句复证
    const c1 = urls().length;
    await click("knF-copy");
    expect(writeText).not.toHaveBeenCalled();
    expect(urls().length).toBe(c1);
    // ktype 非法：空态句在场、零行零钮（不渲染伪造数据行）
    wireSpace([D1, D2, D3]);
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x&ktype=__nope__");
    expect(q("kn-type-empty")).toBeTruthy();
    expect(spaceRows()).toHaveLength(0);
    expect(spaceBtns()).toHaveLength(0);
    // ghost space（读口 200 空）：同上，地址不改写
    const GHOST = "/knowledge?tab=spaces&panel=spaces&space=sp_ghost";
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [] });
      if (url === docsUrlFor("sp_ghost")) return Promise.resolve({ asOf: SP.asOf, documents: [] });
      return fail(404, "这个数据接口还没有接入。", "rid-r142");
    });
    await render(GHOST);
    expect((q("loc")?.textContent ?? "")).toBe("?tab=spaces&panel=spaces&space=sp_ghost");
    expect(spaceRows()).toHaveLength(0);
    expect(spaceBtns()).toHaveLength(0);
    expect(q("kn3-page-cap")).toBeNull();
  });
});
