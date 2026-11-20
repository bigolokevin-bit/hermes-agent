// R167 — 知识复制控件的键盘与焦点护栏（纯测试单：禁改产品；缺属性只记缺口）。
// 查重（R114/R132/R142/R152/R157/R164 已锁面）：文本同串与值逐字（R114/R132/R142）、
// 计数契约（R125C/R149）、三值与编号（R131/R142/R152/R157/R164）均已锁 → 引用不重写。
// 本文件四例全是新维度：原生标签/键盘激活/播报器数量/fallback 可聚焦性/disabled 出列。
// 实测缺口（只记不改）：
//  G1 kn-doc-copy（DocLineCopy）的状态 <span data-testid="kn-doc-copy-status"> 带
//     aria-live="polite" 但**缺 role="status"**（列表面 bar 的 <p> 有 role）——同为播报器
//     两套属性，产品侧 KnowledgeModulePage.tsx:1980；本文件只断言既有 aria-live 并记录。
//  G2 复制入口是 @nous-research Button 渲染（有无显式 type 属性按实测定格），行钮
//     RowCopyButton 是原生 <button type="button">。
//  G3 键盘 Enter/Space：原生 BUTTON 的按键激活是 UA 行为，jsdom 不实现 keydown→click
//     合成——本文件按 R102 同口径以「tagName=BUTTON + 无自绑 keydown 重复触发」代证
//     「一次按键一次复制」，不虚构按键事件断言。
//  G4 行复制钮未纳入 roving tab 序（R132/R138 自述），为原生 tab 流——disabled 出列
//     由 UA 原生保证，断言 disabled 属性代证。
// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
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
  return createElement("div", { "data-testid": "loc" }, "");
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

const btn = (testid: string) => document.querySelector(`button[data-testid="${testid}"]`) as HTMLButtonElement | null;
const anyEl = (testid: string) => document.querySelector(`[data-testid="${testid}"]`);
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));

async function fireClick(node: Element | null, label: string) {
  expect(node, label).toBeTruthy();
  await act(async () => {
    node?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {});
}

const A = { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const B = { documentId: "d_b", fileName: "B 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const EMPTY = { mimeType: "pdf", sizeBytes: 9 }; // 无名无标识
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 2, status: "synced" }],
};
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [A, B, EMPTY] });
    if (url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP.asOf, documents: [A, EMPTY] });
    return fail(404, "这个数据接口还没有接入。", "rid-r167");
  });
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";
const rowWith = (name: string) =>
  [...document.querySelectorAll('[data-testid="kn3-docs-row"]')].find((r) => (r.textContent ?? "").includes(name)) ?? null;

describe("knowledge copy controls keyboard & focus guards (R167, tests only)", () => {
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

  it("① all copy affordances are native BUTTONs reachable by Tab; keydown does not double-fire; click copies exactly once with zero requests", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire();
    await render(DETAIL);
    const searchBtn = btn("kn-row-copy-0")!; // 检索面（同屏顶部）
    const spaceBtn = btn("kn-row-copy-space-0")!; // 空间详情面（后缀族）
    // 原生标签与可达性：BUTTON、未禁用、无负 tabIndex（原生 tab 序 = 可 Tab 到达；
    // 未纳入 roving 是已记缺口 G4，不影响可到达性）
    expect(searchBtn.tagName).toBe("BUTTON");
    expect(searchBtn.disabled).toBe(false);
    expect(searchBtn.tabIndex).toBeGreaterThanOrEqual(0);
    expect(spaceBtn.tagName).toBe("BUTTON");
    // 行钮是显式 type="button"（不裹 submit 语义）；kn-doc-copy 走 UI 库 Button——
    // type 属性只实测记录（G2），不作为断言
    expect(searchBtn.getAttribute("type")).toBe("button");
    expect(spaceBtn.getAttribute("type")).toBe("button");
    const c0 = urls().length;
    // 键盘激活（G3 口径）：jsdom 不合成 keydown→click——先证「自绑 handler 不会重复触发」：
    // 对聚焦按钮 dispatch Enter/Space keydown 各一次，writeText 计数不动（无第二套按键通路）
    searchBtn.focus();
    for (const key of ["Enter", " "]) {
      await act(async () => {
        searchBtn.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      });
    }
    expect(writeText).not.toHaveBeenCalled();
    // 激活一次 = 恰一次复制（原生 BUTTON 的 UA 按键激活走同一条 click 路径）
    await fireClick(searchBtn, "kn-row-copy-0");
    expect(writeText).toHaveBeenCalledTimes(1);
    await fireClick(spaceBtn, "kn-row-copy-space-0");
    expect(writeText).toHaveBeenCalledTimes(2);
    // 预览内单控件 kn-doc-copy：展开首行预览后同为 BUTTON 且同样一键一次
    const rowA = rowWith("A 手册.pdf")!;
    await fireClick(rowA.querySelector('[data-testid="kn-doc-preview-toggle"]'), "preview toggle");
    const docCopy = btn("kn-doc-copy")!;
    expect(docCopy.tagName).toBe("BUTTON");
    await fireClick(docCopy, "kn-doc-copy");
    expect(writeText).toHaveBeenCalledTimes(3);
    expect(urls().length).toBe(c0); // 全程零请求
  });

  it("② success reads out 已复制 once on the clicked face's status; each face owns exactly one live region for copy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire();
    await render(DETAIL);
    // 每面复制播报器唯一（「aria-live 只出现一次」按面锁定）
    expect(document.querySelectorAll('[data-testid="kn-row-copy-status"]').length).toBe(1);
    expect(document.querySelectorAll('[data-testid="kn-row-copy-space-status"]').length).toBe(1);
    const spaceStatus = anyEl("kn-row-copy-space-status")!;
    expect(spaceStatus.getAttribute("role")).toBe("status");
    expect(spaceStatus.getAttribute("aria-live")).toBe("polite");
    expect((spaceStatus.textContent ?? "").trim()).toBe("");
    // 点检索面按钮：只有被点面的 status 变文本，另一面保持空（不重复播报）
    await fireClick(btn("kn-row-copy-0"), "search copy");
    await act(async () => {});
    expect((anyEl("kn-row-copy-status")?.textContent ?? "").trim()).toBe("已复制");
    expect((spaceStatus.textContent ?? "").trim()).toBe("");
    // 再点详情面（可用行）：本面播报「已复制」（同串一次），检索面文本不叠加变化
    await fireClick(btn("kn-row-copy-space-0"), "space copy");
    await act(async () => {});
    expect((spaceStatus.textContent ?? "").trim()).toBe("已复制");
    // 缺口 G1 记录：kn-doc-copy-status 有 aria-live 无 role="status"——断言既有属性，
    // 缺 role 只记不改（产品行 1980）。预览展开后该播报器才在场。
    const rowA = rowWith("A 手册.pdf")!;
    await fireClick(rowA.querySelector('[data-testid="kn-doc-preview-toggle"]'), "preview toggle");
    const docStatus = anyEl("kn-doc-copy-status");
    expect(docStatus?.getAttribute("aria-live")).toBe("polite");
    expect(docStatus?.getAttribute("role")).toBeNull(); // ← G1：列表面有 role、预览面没有，两套属性
  });

  it("③ rejection fallback: read-only focusable textarea whose value is byte-equal to the delivered text (list faces + preview control)", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire();
    await render(DETAIL);
    await fireClick(btn("kn-row-copy-0"), "search copy (reject)");
    await act(async () => {});
    const ta = document.querySelector('[data-testid="kn-row-copy-fallback"]') as HTMLTextAreaElement | null;
    expect(ta).toBeTruthy();
    expect(ta?.tagName).toBe("TEXTAREA");
    expect(ta?.readOnly).toBe(true);
    expect(ta?.tabIndex).toBeGreaterThanOrEqual(0); // 可聚焦：用户能选文手动复制
    expect(ta?.value.split("\n")[1]).toContain("A 手册.pdf");
    expect(ta?.value).toBe(String(writeText.mock.calls[0][0])); // 值==投递文本逐字
    expect((anyEl("kn-row-copy-status")?.textContent ?? "")).toContain("剪贴板没接受");
    // 详情面同族同断言（一次点击只在自己的面上出兜底）
    await fireClick(btn("kn-row-copy-space-0"), "space copy (reject)");
    await act(async () => {});
    const taSpace = document.querySelector('[data-testid="kn-row-copy-space-fallback"]') as HTMLTextAreaElement | null;
    expect(taSpace?.readOnly).toBe(true);
    expect(taSpace?.value).toBe(String(writeText.mock.calls[1][0]));
    // 预览控件的兜底：打开预览 → 拒写 → fallback 与投递逐字等
    const rowA = rowWith("A 手册.pdf")!;
    await fireClick(rowA.querySelector('[data-testid="kn-doc-preview-toggle"]'), "preview toggle");
    await fireClick(btn("kn-doc-copy"), "doc copy (reject)");
    await act(async () => {});
    const taDoc = document.querySelector('[data-testid="kn-doc-copy-fallback"]') as HTMLTextAreaElement | null;
    expect(taDoc?.readOnly).toBe(true);
    expect(taDoc?.value).toBe(String(writeText.mock.calls.at(-1)?.[0] ?? ""));
  });

  it("④ uncopyable row: button is native-disabled (thus out of the tab order per UA), with the verbatim honest title on both list faces", async () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire();
    await render(DETAIL);
    // 检索面第 3 行 = EMPTY（无名无 id）
    const emptySearch = btn("kn-row-copy-2");
    expect(emptySearch).toBeTruthy();
    expect(emptySearch?.disabled).toBe(true);
    // disabled 的原生 button 不进可聚焦序列（UA 保证；jsdom 以 disabled 属性代证，
    // tabIndex 数值不改——G4 同源记录）
    expect(emptySearch?.getAttribute("title")).toBe("这一行没有可复制的文档内容：文档名与标识都没给出。");
    await fireClick(emptySearch, "disabled search copy"); // 点击无效：不进剪贴板
    expect(writeText).not.toHaveBeenCalled();
    // 详情面的空行钮：同为 disabled + 逐字 title
    const emptySpace = btn("kn-row-copy-space-1");
    expect(emptySpace?.disabled).toBe(true);
    expect(emptySpace?.getAttribute("title")).toBe("这一行没有可复制的文档内容：文档名与标识都没给出。");
    await fireClick(emptySpace, "disabled space copy");
    expect(writeText).not.toHaveBeenCalled();
  });
});
