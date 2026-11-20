// R230 — 预览（抽屉）打开态 × 导出数据行同帧护栏（纯测试单：零产品改动，未造控件）。
// 名实（实测既定换算）：本模块**无真 CSV 导出**（createObjectURL/text/csv/a.download/
// new Blob 产品源码 0，仅 4 处 data-export="absent"——R190①:113-119 不变量）→「导出
// 行数」= 详情面 knF-copy 数据行（docCopyText 5 列）；「预览打开态」取 **kn7 抽屉**
// （?doc=，行名点击开、portal 挂 body；每次打开恰一次既存详情读 /api/documents/<id>，
// 详情读失败抽屉仍开——R196③:104-124 夹具实证，本轮同法），非行内 previewKey 态；
// 行钮分面：详情面 kn-row-copy-space-<i>（R225/R229 同族）、检索面 kn-row-copy-<i>；
// kn-doc-copy 单控件非行数。第③腿名实换算（红线④）：kn3-page-cap 在 true-0/error/
// denied/非法态**不渲染**（R108/R157/R187 锁）→「cap 仍如实」按产品断言为**该帧 cap
// null**，此换算同时写注释与回执。无 ?source=；本地动作零请求；clip 桩 mockResolvedValue
// + unstubAllGlobals + Blob/createObjectURL spy（R214 教训，Errors 0 硬要求）。
// 查重（引用不重写）：R216①:134-148/R197①:135-155（分页/计数五读链）、R229①:157-171
// （分页态首末行直对）、R142①:124（单页三值——非预览帧）、R190④:190-205（空集 disabled
// +title+零写+零请求+spy 0 内容面）、R196③:104-124（抽屉标题随 a↔b 换、详情读各恰 1、
// 列表集合不变引 R149④）、R222/R223、R200/R214②。
// 新增维（点名）：
//  ① **抽屉打开帧**同帧三值直对（行钮数==表体行==knF 数据行）+ knF 首数据行名 toBe
//     屏上首行 + 导出文本与开抽屉前快照**逐字互等**（R142① 三值不在预览帧；R229 系
//     分页帧无抽屉）；
//  ② 抽屉 **a→b 换文档后导出侧内容级不变**：knF 文本逐字==切换前快照、表体名序逐字
//     不动；请求侧按现实**不宣称零**：换档增量恰 1（d_b×1，实测不重读 d_a——补强
//     R196③ 各恰 1 的定向断言为增量口径），列表读集合逐字不变；
//  ③ **失败站（列表 500）**复制侧：knF disabled + title 在场 + 点击零写/零 blob/零
//     请求（R190④ 只锁空集站；错误站复制钮此前无 pin）+ 双态（true-0 与 error）当帧
//     cap 缺席复跑（换算位，见上）。
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
const detailUrl = (id: string) => `/agent-api/api/documents/${id}`;
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
const nameLink = (name: string) =>
  rowNodes().find((r) => (r.textContent ?? "").includes(name))?.querySelector('[data-testid="kn3-docs-name"]') ?? null;
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  const createObjectUrl = vi.fn();
  Object.defineProperty(window.URL, "createObjectURL", { value: createObjectUrl, configurable: true, writable: true });
  return { writeText, createObjectUrl };
};

const D_A = { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const D_B = { documentId: "d_b", fileName: "B 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const SP = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 2, status: "synced" }] };
// 详情读按 R196③ 同法回 404：抽屉仍开（标题取行名），导出侧只依赖列表数据（名实注记）
const wire = (opts: { empty?: boolean; listFail?: boolean } = {}) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: opts.empty ? [] : [D_A, D_B] });
    if (url === P1URL)
      return opts.listFail
        ? fail(500, "上游读取失败，请稍后重试。", "rid-r230-l")
        : Promise.resolve({ asOf: SP.asOf, documents: opts.empty ? [] : [D_A, D_B] });
    return fail(404, "文档详情未接入。", "rid-r230-d");
  });

describe("knowledge drawer-open export parity guards (R230)", () => {
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

  it("① 抽屉打开帧：三值 toBe（表体==-space- 钮==knF 行）+ 首行逐字直对 + 导出文本与开抽屉前逐字互等（新增维①）", async () => {
    const { writeText } = clipStub();
    wire();
    await render(DETAIL);
    await clickNode(q("knF-copy"), "knF before drawer");
    const text0 = String(writeText.mock.calls[0][0]);
    writeText.mockClear();
    await clickNode(nameLink("A 手册.pdf"), "open drawer A");
    expect(loc()).toContain("doc=d_a"); // ?doc= 抽屉态（行内 previewKey 无 URL——名实）
    expect(q("kn7-preview-title")).toBeTruthy(); // 抽屉在场（标题句引 R196③ 不复写）
    expect(rowNames()).toHaveLength(2);
    expect(btnCount()).toBe(2);
    await clickNode(q("knF-copy"), "knF with drawer open");
    const lines = String(writeText.mock.calls[0][0]).split("\n").slice(1, -1);
    expect([rowNames().length, btnCount(), lines.length]).toEqual([2, 2, 2]); // 三值同帧
    expect(lines[0].split(" | ")[0]).toBe(rowNames()[0]); // 首行逐字直对屏上首行
    expect(String(writeText.mock.calls[0][0])).toBe(text0); // 开抽屉不触导出内容（逐字）
  });

  it("② 抽屉 a→b 换文档：knF 文本与表体名序逐字不变；请求侧不宣称零——换档增量恰 1（d_b），列表读集合逐字不动（新增维②）", async () => {
    const { writeText } = clipStub();
    wire();
    await render(DETAIL);
    await clickNode(nameLink("A 手册.pdf"), "open A");
    await clickNode(q("knF-copy"), "knF at A");
    const textA = String(writeText.mock.calls[0][0]);
    const names0 = rowNames();
    const listUrls0 = urls().filter((u) => !u.startsWith("/agent-api/api/documents/d_")).join("|");
    const c0 = urls().length;
    await clickNode(nameLink("B 表.xlsx"), "switch to B");
    expect(q("kn7-preview-title")).toBeTruthy(); // 标题随换（逐字句引 R196③:117-118 不复写）
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF at B");
    expect(String(writeText.mock.calls[0][0])).toBe(textA); // 导出内容级逐字不变（新维）
    expect(rowNames()).toEqual(names0); // 表体名序不动
    expect(urls().length).toBe(c0 + 1); // 实测：a→b 只重读新档（d_b×1），非零、非重读旧档
    expect(urls().filter((u) => u === detailUrl("d_a"))).toHaveLength(1);
    expect(urls().filter((u) => u === detailUrl("d_b"))).toHaveLength(1);
    expect(urls().filter((u) => !u.startsWith("/agent-api/api/documents/d_")).join("|")).toBe(listUrls0); // 列表读集合逐字不变
  });

  it("③ true-0 与失败站（列表 500）：knF disabled+title、点击零写/零 blob/零请求（错误站复制侧新位）；两态当帧 cap 为 null（红线④换算）", async () => {
    const { writeText, createObjectUrl } = clipStub();
    // (a) true-0 站（空集内容面引 R190④:190-198 不复写，本例补 cap 缺席换算位）
    wire({ empty: true });
    await render(DETAIL);
    expect(q("kn3-page-cap")).toBeNull(); // 派工「仍如实」按产品=不渲染（R108/R157/R187）
    let btn = q("knF-copy") as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(true);
    expect(btn?.getAttribute("title")).toContain("没有可复制");
    let c0 = urls().length;
    await clickNode(btn, "click empty knF");
    expect(writeText).not.toHaveBeenCalled();
    expect(urls().length).toBe(c0);
    // (b) 失败站：错误帧复制钮同 disabled 口径（错误站复制侧此前无 pin——新增维）
    vi.clearAllMocks();
    writeText.mockResolvedValue(undefined);
    wire({ listFail: true });
    await render(DETAIL);
    expect(q("kn3-page-cap")).toBeNull(); // error 态同不渲染（R157 族）
    btn = q("knF-copy") as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(true);
    expect((btn?.getAttribute("title") ?? "").length).toBeGreaterThan(0); // 具体原因句（逐字句不在本腿范围）
    c0 = urls().length;
    await clickNode(btn, "click errored knF");
    expect(writeText).not.toHaveBeenCalled();
    expect(urls().length).toBe(c0); // 失败站点击零连带（不触发重试读）
    expect(createObjectUrl).not.toHaveBeenCalled(); // 全帧 blob 零调用（引 R190④ 收口口径）
  });
});
