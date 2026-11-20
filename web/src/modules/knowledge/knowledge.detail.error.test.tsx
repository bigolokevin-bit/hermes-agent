// R183 — 空间详情/文档抽屉的错误态护栏（纯测试单：零产品改动）。
// 名实对齐（按实测，不迁就派工文案）：
// · 「不存在/已过期文档」：产品无「已过期」文档语义（grep 仅空间凭据 lastError 文案含
//   「过期」，与文档详情无关），且 403≡404 同体（主测 :280-289 已锁 body 逐字同）——
//   「不存在」与「已过期/无权限」在 UI 上不可区分，如实记缺口，不造文案。
// · 详情读口=kn7 抽屉（?doc=）：每次打开恰 1 次 /api/documents/<id>（R49 设计，
//   R125C/R149 已锁计数）；行内预览 kn-doc-preview-* 只用已载行、零请求。
// · 第④腿名实不符：kn-doc-copy（DocLineCopy 单控件）挂在列表层行内预览里，抽屉错误态
//   不触碰列表——实测其**在场且可用**（非 disabled）；抽屉内没有「详情复制」控件，
//   抽屉层唯一复制件是 kn-doc-permalink 固定链接（主测 :293 已锁抽屉内零 form/textarea）。
//   本文件断言实测行为并记差异。
// 查重（锁过的引用不重写）：主测 :263-298 已锁——error 锚在场、error≠unwired 互斥、
//   「请求编号：rid-…」上屏、403≡404 body 逐字同、抽屉无写入控件、裸 id 不上屏、
//   ready 态 field-source/status 值；R125/R149 已锁打开抽屉 +1/关 0。
//   真缺口（本文件 3 例）：① 错误态下列表行与 kn3-page-cap 不卸载 + 屏上禁裸「404」/
//   「undefined」② 错误态与列表空态锚互斥 ③ 重试恰 +1 次请求（不连带列表/空间读）且
//   失败→成功过渡的错误锚消失与内容就位 ④ 错误态并行内预览可用 + 复制零新请求。
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
const DETAIL_A = "/agent-api/api/documents/d_a";

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

const q = (testid: string) => document.querySelector(`[data-testid="${testid}"]`);
const txt = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const visibleRows = () => document.querySelectorAll('[data-testid="kn3-docs-row"]').length;

const D_A = { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const D_B = { documentId: "d_b", fileName: "B 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 2, status: "synced" }],
};
const wireDetail = (detailResponder: (url: string) => Promise<unknown>) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [D_A, D_B] });
    if (url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP.asOf, documents: [D_A, D_B] });
    if (url === DETAIL_A) return detailResponder(url);
    return fail(404, "这个数据接口还没有接入。", "rid-r183-x");
  });
const DRAWER = "/knowledge?tab=spaces&panel=spaces&space=sp_x&doc=d_a";

describe("knowledge detail error-state guards (R183, gap-only)", () => {
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

  it("①② failed detail read shows the readable sentence and rid without unmounting the list/cap, without bare codes, and without wearing the empty-state face", async () => {
    // 路 A：500 —— error 分支（主测 :268 锁过锚在场，此处锁列表共存与禁裸码）
    wireDetail(() => fail(500, "数据服务暂时没有响应，请稍后重试。", "rid-r183-busy"));
    await render(DRAWER);
    expect(q("kn7-preview-error")).toBeTruthy();
    expect(txt(q("kn7-preview-error"))).toContain("这次没能读到这份文档的详情");
    expect(document.body.textContent ?? "").toContain("请求编号：rid-r183-busy"); // rid 走既有 RequestId 复制件（抽屉是 portal，挂 body）
    // 列表与 cap 不被抽屉错误卸载：两行仍在、上限句仍在
    expect(visibleRows()).toBe(2);
    expect(q("kn3-page-cap")).toBeTruthy();
    expect(txt(q("kn3-page-cap"))).toContain("当前已加载 2 篇");
    // 禁裸状态码/undefined 上屏（错误呈现只有人话句 + rid）
    expect(container.textContent ?? "").not.toMatch(/\b404\b|\b500\b/);
    expect(document.body.textContent ?? "").not.toContain("undefined");
    // ② 错误态不冒充空结果：列表有行 → 空态锚不在场；error 与 unwired 互斥（主测已锁方向 A）
    expect(q("knN-empty-text-space-docs")).toBeNull();
    expect(q("kn7-preview-unwired")).toBeNull();
    // 路 B：404 —— unwired 分支（不存在/未接入同体；产品无「已过期」区分，缺口记录）
    wireDetail(() => fail(404, "这个数据接口还没有接入。", "rid-r183-gone"));
    await render(DRAWER);
    expect(q("kn7-preview-unwired")).toBeTruthy();
    expect(q("kn7-preview-error")).toBeNull();
    expect(txt(q("kn7-preview-unwired"))).toContain("文档详情未接入");
    expect(visibleRows()).toBe(2);
    expect(q("kn3-page-cap")).toBeTruthy();
    expect(q("knN-empty-text-space-docs")).toBeNull();
  });

  it("③ retry on the failed detail read adds exactly one request and the success transition removes the error anchor and lands the content", async () => {
    let mode = "fail";
    wireDetail(() =>
      mode === "fail"
        ? fail(500, "数据服务暂时没有响应，请稍后重试。", "rid-r183-busy")
        : Promise.resolve({ sourceName: "A 手册原件.pdf", status: "indexed" }),
    );
    await render(DRAWER);
    expect(q("kn7-preview-error")).toBeTruthy();
    const c0 = urls().length;
    const detailReads0 = urls().filter((u) => u === DETAIL_A).length;
    mode = "ok";
    await clickNode(q("kn7-preview-retry"), "retry");
    // 恰 +1：新增的只有这一条详情读；列表/空间读零连带
    expect(urls().length).toBe(c0 + 1);
    expect(urls().filter((u) => u === DETAIL_A).length).toBe(detailReads0 + 1);
    expect(q("kn7-preview-error")).toBeNull(); // 错误锚消失
    // 内容就位：来源/状态字段读到真值（值口径主测 :259-262 已锁，此处只锁过渡后可见）
    expect(txt(q("kn7-preview-field-source"))).toContain("A 手册原件.pdf");
    // 成功后的屏面不再有空态冒充
    expect(q("knN-empty-text-space-docs")).toBeNull();
    expect(visibleRows()).toBe(2); // 列表全程未卸载
  });

  it("④ real behaviour in the error state: the inline preview copy control stays mounted and ENABLED (brief said disabled — recorded), drawer itself renders no detail-copy control", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wireDetail(() => fail(404, "这个数据接口还没有接入。", "rid-r183-gone"));
    await render(DRAWER);
    expect(q("kn7-preview-unwired")).toBeTruthy();
    // 抽屉里先验：没有「详情复制」控件；抽屉层唯一复制件是固定链接（kn-doc-permalink）。
    // （必须在开行内预览之前查——R67 互斥：开预览会静默收起抽屉。）
    const panel = q("kn7-preview-panel");
    expect(panel).toBeTruthy();
    expect(panel?.querySelector('[data-testid="kn-doc-copy"]')).toBeNull();
    expect(panel?.querySelector('[data-testid="kn-doc-permalink"]')).toBeTruthy();
    // 列表层行内预览在抽屉错误态照常可用（预览只用已载行，与详情读口无关）
    const rowA = [...document.querySelectorAll('[data-testid="kn3-docs-row"]')].find((r) => (r.textContent ?? "").includes("A 手册.pdf"))!;
    await clickNode(rowA.querySelector('[data-testid="kn-doc-preview-toggle"]'), "preview open");
    const copyBtn = q("kn-doc-copy") as HTMLButtonElement | null;
    expect(copyBtn).toBeTruthy();
    expect(copyBtn?.disabled).toBe(false); // ← 名实不符记录：错误态不影响该控件可用性
    const c0 = urls().length;
    await clickNode(copyBtn, "kn-doc-copy");
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(String(writeText.mock.calls[0][0])).toContain("A 手册.pdf | PDF");
    expect(urls().length).toBe(c0); // 复制零新请求
  });
});
