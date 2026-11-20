// R187 — 空间详情（查询态位）错误态护栏（纯测试单：零产品改动）。
// 名实对齐（实测）：
// · brief 的 `kn-space-page-cap` **不存在**（git grep "space-page-cap" 零命中）——真名
//   `kn3-page-cap`（「本页最多显示 50 篇（当前已加载 M 篇；复制清单也只含这些篇）」，
//   50 常量位、M 可变位，R108 口径）。按实名断言。
// · 空间详情非路由：查询态 ?tab=spaces&panel=spaces&space=<id>；读口
//   /agent-api/api/documents?limit=50&spaceId=<id>（DOCUMENTS_LIMIT=50，R164 锁参集合）。
// · 403≡404 同体——主测 :861-873 已锁 body 逐字同（「不存在/无权限」UI 不可区分，
//   既有反枚举设计，记缺口不造文案）；error 锚在场时 unwired null——主测 :892-895 已锁。
// · kn-space-preview 属**列表面**行（详情面零 kn-space-toggle，R70）；错误态无行 →
//   预览/行内 doc-copy 均无从挂载——④按「渲染数量 0」断言（非 disabled，名实记差异）。
// · 导出族不存在：仅 data-export="absent" 标记（:1297/:1630/:2630/:3032）。
// 查重（锁过的引用不重写）：主测 :855-895（unwired/error 锚、403≡404、retry 按钮在场、
//   裸 id 不上屏）、R138 ②（详情面三态 knF disabled+逐字 title+点击零写）、
//   R138 ④（ghost 深链预览/行钮零渲染）、R164 ①（请求参集合恰 {limit,spaceId}）。
// 真缺口（本文件 3 例）：①禁裸「404/500」数字与 undefined/null 上屏 + 错误句逐字 +
//   命中面等页级结构不卸载；②错误态与空态锚互斥（kn3-docs-empty /
//   knN-empty-text-space-docs 双缺席）+ 预览/复制锚 0 渲染（④并入）；
//   ③Surface 重试计数过渡：恰 +1、只重发本面读口、成功后行数==cap-M==data-len==行钮数。
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
const txt = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const visibleRows = () => document.querySelectorAll('[data-testid="kn3-docs-row"]').length;

const D1 = { documentId: "d_1", fileName: "一 手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const D2 = { documentId: "d_2", fileName: "二 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const D3 = { documentId: "d_3", fileName: "三 说明.txt", mimeType: "txt", sizeBytes: 512, updatedAt: "2026-11-19T05:00:00Z" };
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 3, status: "synced" }],
};
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

const wireDetail = (responder: () => Promise<unknown>) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [D1, D2, D3] });
    if (url === docsUrlFor("sp_x")) return responder();
    return fail(404, "这个数据接口还没有接入。", "rid-r187-x");
  });

describe("knowledge space-detail error-state guards (R187, gap-only)", () => {
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

  it("① both failure shapes read as sentences with a copyable rid — no bare status codes, no undefined/null on screen, page-level structures survive", async () => {
    // 路 A：500 → error 分支（主测 :892 锁了锚在场；此处锁逐字句、禁裸码与页级不卸载）
    wireDetail(() => fail(500, "数据服务暂时没有响应，请稍后重试。", "rid-r187-busy"));
    await render(DETAIL);
    const err = q("kn3-docs-error");
    expect(err).toBeTruthy();
    expect(txt(err)).toContain("这次没能读到知识数据");
    expect(txt(err)).toContain("数据服务暂时没有响应，请稍后重试。"); // 上游人话 message 透传
    expect(document.body.textContent ?? "").toContain("请求编号：rid-r187-busy");
    expect(container.textContent ?? "").not.toMatch(/\b(404|500)\b/); // 状态码只在信封层，不上屏
    expect(document.body.textContent ?? "").not.toMatch(/\bundefined\b|\bnull\b/);
    // 页级结构不卸载：命中面照常在场（它读的是另一个参集，不受本面失败牵连）
    expect(q("kn6-search")).toBeTruthy();
    expect(q("knw5-panel-spaces")).toBeTruthy();
    // 路 B：404 → unwired 分支（句逐字；403≡404 同体主测 :873 已锁 → 引用不重跑）
    wireDetail(() => fail(404, "这个数据接口还没有接入。", "rid-r187-gone"));
    await render(DETAIL);
    const unw = q("kn3-docs-unwired");
    expect(unw).toBeTruthy();
    expect(txt(unw)).toContain("空间不存在或未授权"); // SPACE_DOC_UNWIRED_HEAD 实测句——
    // 「不存在」与「无权限/已过期」在产品里就是同一句（反枚举设计，非缺陷）
    expect(document.body.textContent ?? "").toContain("请求编号：rid-r187-gone");
    expect(container.textContent ?? "").not.toMatch(/\b(404|500)\b/);
    expect(q("kn6-search")).toBeTruthy();
  });

  it("②+④ error state never wears the empty face, and the preview/copy affordances render nowhere (nothing to preview: zero rows)", async () => {
    wireDetail(() => fail(500, "数据服务暂时没有响应，请稍后重试。", "rid-r187-busy"));
    await render(DETAIL);
    expect(q("kn3-docs-error")).toBeTruthy();
    // 错误↔空态互斥：两把空态锚都不在场（0 行分支根本不进 empty）
    expect(q("kn3-docs-empty")).toBeNull();
    expect(q("knN-empty-text-space-docs")).toBeNull();
    // 错误↔unwired 互斥（主测 :893 已锁方向，这里对照补齐双路）
    expect(q("kn3-docs-unwired")).toBeNull();
    // ④ 名实：brief 说「kn-space-preview/kn-doc-copy disabled」——实测错误态零行，
    // 这些锚**不渲染**（无从 disabled）；详情面本就没有 kn-space-preview（列表面族，R70）
    expect(document.querySelectorAll('[data-testid^="kn-space-preview"]').length).toBe(0);
    expect(q("kn-doc-copy")).toBeNull();
    expect(document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length).toBe(0);
    expect(document.querySelectorAll('[data-testid="kn-doc-preview-toggle"]').length).toBe(0);
    // 清单复制锁死（R138 ② 已锁 disabled+逐字 title+零写——此处只对照在场性）
    expect((q("knF-copy") as HTMLButtonElement | null)?.disabled).toBe(true);
    // 导出族缺席标记仍在（不新增控件的既有口径）
    expect(q("kn-gates-knF")?.getAttribute("data-export")).toBe("absent");
  });

  it("③ retry on the failed space-docs read adds exactly one request; after success rows land and equal cap-M == data-len == row-copy buttons", async () => {
    let ok = false;
    wireDetail(() =>
      ok
        ? Promise.resolve({ asOf: SP.asOf, documents: [D1, D2, D3] })
        : fail(500, "数据服务暂时没有响应，请稍后重试。", "rid-r187-busy"),
    );
    await render(DETAIL);
    expect(q("kn3-docs-error")).toBeTruthy();
    const c0 = urls().length;
    ok = true;
    await click("kn3-docs-retry");
    // 恰 +1：只重发本面读口；spaces/命中面读零连带
    expect(urls().length).toBe(c0 + 1);
    expect(urls()[c0]).toBe(docsUrlFor("sp_x"));
    expect(urls().filter((u) => u === SPACES)).toHaveLength(1);
    // 成功过渡：错误锚消失、列表就位
    expect(q("kn3-docs-error")).toBeNull();
    const rows = visibleRows();
    expect(rows).toBe(3);
    // 四读互等（过渡终态把 R108/R142 的口径接上）：行数 == cap-M == data-len == 行钮数
    const cap = txt(q("kn3-page-cap"));
    expect(cap).toContain("本页最多显示 50 篇（当前已加载 3 篇；复制清单也只含这些篇）"); // kn-space-page-cap 不存在，实名 kn3-page-cap
    expect(cap).toContain(`当前已加载 ${rows} 篇`);
    expect(q("kn3-docs")?.getAttribute("data-len")).toBe(String(rows));
    expect(document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length).toBe(rows);
    // 空态锚在 ready 非空下也不在场（互斥的另一半）
    expect(q("kn3-docs-empty")).toBeNull();
  });
});
