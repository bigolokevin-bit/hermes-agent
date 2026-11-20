// R206 — 预览请求契约余量护栏（纯测试单：零产品改动）。
// 查重判定（四腿逐条，锁过的引用不重写）：
// ①首屏恰 1 次列表读、无 cursor= —— 主测 knE 段 :2531 + R149 knowledge.requests.test.tsx
//   ①②（P2URL 逐字 cursor 原值、恰一次）已锁 → 引用。
// ②开抽屉恰 +1 详情读、列表腿不重取（R183 ③/R149④ listSet toBe）、预览内切文档每次
//   +1 且各指向自身（R149④ + R196 ③：d_a/d_b 各恰 1）已锁 → 引用；行内预览链 = 0 请求
//   （R125C/R149③/R196④ 快照逐字）→ 引用。
// ③关闭零请求已锁（R125C/R149/R196④）；**真缺口=「URL 只删预览参」参数面**：关抽屉后
//   loc == 开抽屉前逐字（仅少 doc=，q/ktype/space/tab/panel 原样）+ 行内预览开合全程
//   loc 一字不动（产品注释 R67/R68 声明此语义，测试侧此前零 pin——grep 无 loc 断言命中）。
// ④500 保列表+句+rid+重试恰 +1 且成功就位 —— R183 knowledge.detail.error.test.tsx
//   ①③（:105-157）已锁 → 引用；本腿吸收 R205 判定的两处窄面残差：
//   (a) 错误窗口内复制链（kn-row-copy-space-<i>/kn-doc-copy 的 docSingleCopy 串）与
//       错误发生前的样张逐字一致——错误不污染复制文本；
//   (b) 404 变体下抽屉 dl（kn3-docs-detail）title=全 id（R204 只在无错成功链锁过 title）。
// 面/族实名照旧：详情面行钮 -space- 族；kn-doc-copy=单 DocLineCopy；抽屉 kn7-preview-*；
// 缺值两式（表格/复制「—」、预览/抽屉「该字段未返回」+逐字段 title）与 403≡404 产品
// 定版未动。
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

async function clickNode(node: Element | null | undefined, label: string) {
  expect(node, label).toBeTruthy();
  await act(async () => {
    (node as Element).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {});
}

const q = (testid: string) => document.querySelector(`[data-testid="${testid}"]`);
const loc = () => (q("loc")?.textContent ?? "") as string;
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const rowWith = (name: string) =>
  [...document.querySelectorAll('[data-testid="kn3-docs-row"]')].find((r) => (r.textContent ?? "").includes(name)) ?? null;

const D_FULL = { documentId: "d_full1", fileName: "全项手册.pdf", mimeType: "application/pdf", sizeBytes: 2516582, updatedAt: "2026-11-19T07:10:00Z" };
const D_MISS = { documentId: "d_miss9", fileName: "缺项档" };
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 2, status: "synced" }],
};
const wire = (detailResponder: (url: string) => Promise<unknown>) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN || url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP.asOf, documents: [D_FULL, D_MISS] });
    if (url.startsWith("/agent-api/api/documents/d_")) return detailResponder(url);
    return fail(404, "这个数据接口还没有接入。", "rid-r206");
  });
const okDetail = () => Promise.resolve({ sourceName: "全项手册原件.pdf", status: "indexed" });

describe("knowledge preview request-contract remainder (R206, gap-only)", () => {
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

  it("③ closing the drawer drops ONLY the doc param (q/ktype/space/tab/panel byte-identical); inline preview open/close never touches the URL at all", async () => {
    wire(okDetail);
    const BEFORE = "/knowledge?tab=spaces&panel=spaces&space=sp_x&q=%E5%A4%A7&ktype=PDF";
    const beforeLoc = "?tab=spaces&panel=spaces&space=sp_x&q=%E5%A4%A7&ktype=PDF";
    await render(BEFORE);
    expect(loc()).toBe(beforeLoc);
    const c0 = urls().length;
    // 开抽屉（点行名）：URL 多且只多 doc=
    await clickNode(rowWith("全项手册.pdf")?.querySelector('[data-testid="kn3-docs-name"]'), "open drawer");
    expect(q("kn7-preview-panel")).toBeTruthy();
    expect(loc()).toBe(`${beforeLoc}&doc=d_full1`);
    // 关抽屉：回到开抽屉前**逐字**——只删了 doc，其余参数一字未动
    await clickNode(q("kn7-preview-close"), "close drawer");
    expect(q("kn7-preview-panel")).toBeNull();
    expect(loc()).toBe(beforeLoc);
    // 行内预览开合：URL 全程一字不动（R67/R68 声明的语义首次落测试）
    const row = rowWith("全项手册.pdf")!;
    const toggle = () => row.querySelector('[data-testid="kn-doc-preview-toggle"]');
    await clickNode(toggle(), "inline open");
    expect(q("kn-doc-preview")).toBeTruthy();
    expect(loc()).toBe(beforeLoc);
    await clickNode(toggle(), "inline close");
    expect(loc()).toBe(beforeLoc);
    // 以上全链零列表重取：新增的只有两次抽屉详情读（开/关后不再+，计数由 R125C 锁语义，
    // 这里只锁「列表腿=0 增量」：spaces/documents 读条数与开抽屉前一致）
    expect(urls().filter((u) => u === SPACES).length).toBe(urls().slice(0, c0).filter((u) => u === SPACES).length);
    expect(urls().filter((u) => u === docsUrlFor("sp_x")).length).toBe(urls().slice(0, c0).filter((u) => u === docsUrlFor("sp_x")).length);
  });

  it("④(a,b) error-window copy chain stays byte-identical to the clean sample, and the 404 drawer still pins full id in dl title only", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    // 先取干净样张（无抽屉干扰的纯净渲染）
    wire(okDetail);
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x");
    const row = rowWith("全项手册.pdf")!;
    await clickNode(row.querySelector('button[data-testid^="kn-row-copy-space-"]'), "clean row copy");
    expect(writeText).toHaveBeenCalledTimes(1);
    const cleanLine = String(writeText.mock.calls[0][0]);
    await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "inline open");
    await clickNode(q("kn-doc-copy"), "clean doc copy");
    const cleanDoc = String(writeText.mock.calls[1][0]);
    expect(cleanDoc).toBe(cleanLine); // 基线自洽（R114 链）
    await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "inline close");
    // 换入 500 错误窗（腿④(a)）：抽屉错误句在场（R183 已锁句体——只对照在场性），
    // 复制链两路仍与干净样张逐字等——错误不污染屏上数据与复制文本
    let mode: string = "busy";
    wire((url) => (url.includes("d_full1") && mode === "busy" ? fail(500, "数据服务暂时没有响应，请稍后重试。", "rid-r206-busy") : okDetail()));
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x&doc=d_full1");
    expect(q("kn7-preview-error")).toBeTruthy();
    const row500 = rowWith("全项手册.pdf")!;
    writeText.mockClear();
    await clickNode(row500.querySelector('button[data-testid^="kn-row-copy-space-"]'), "row copy in error window");
    expect(String(writeText.mock.calls[0][0])).toBe(cleanLine); // (a) 行钮串逐字不变
    await clickNode(row500.querySelector('[data-testid="kn-doc-preview-toggle"]'), "inline open (500 window)");
    await clickNode(q("kn-doc-copy"), "doc copy in error window");
    expect(String(writeText.mock.calls[1][0])).toBe(cleanDoc); // (a) 预览复制串逐字不变
    expect(row500.querySelector('[data-testid="kn3-docs-name"]')).toBeTruthy(); // 列表腿行仍在
    // (b) 404 变体：unwired 体感下 dl title 仍=全 id（正文无裸 id）——R204 只锁过成功链
    mode = "gone";
    wire((url) => (url.includes("d_full1") ? fail(404, "文档详情未接入。", "rid-r206-gone") : okDetail()));
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x&doc=d_full1");
    expect(q("kn7-preview-unwired")).toBeTruthy();
    expect(q("kn3-docs-detail")?.getAttribute("title")).toBe("d_full1"); // 全 id 仅在 title
    const panelText = (q("kn7-preview-panel")?.textContent ?? "").replace(/\s+/g, " ");
    expect(panelText).not.toContain("d_full1"); // 抽屉正文无裸 id（主测 :295 同口径的 404 变体）
  });
});
