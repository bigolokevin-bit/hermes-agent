// R164 — 类型筛选×分页交叉护栏（纯测试单：零产品改动）。
// 查重判定（先 git grep，锁过的引用不重写）：
// · 「第 2 页后切类型桶 → 归 1 页、无旧 cursor 重放、行替换非累加」——空间详情面已锁：
//   knowledge.paging.test.tsx:115-125（R131①：切「表格」后计数文本、第 2 页行按标识出局、
//   cursor= 全程恰 1）+ knowledge.space.paging.test.tsx ⑤（R152：合并态钮面替换）→ 引用。
// · 「清 ktype 双删+其余参不动」—— knowledge.type.filter.test.tsx ①（R146）；
//   「清 q 保 ktype」—— knowledge.space.filters.test.tsx ②（R157）→ 本文件不重跑单键动线，
//   只补「一路清全部」的组合终态（五键皆无残留 + 行回全量）。
// · 名实替换照派工：①?source= 无控件（source 只是空间行列标签）——映射为 ktype×q 共存时
//   documents 请求参集合恰 {limit, spaceId}（本地过滤不入请求，正锁 R157 只反锁过无 cursor）；
//   ③非法 ktype/type 下 cap 不渲染——R157 已锁（knowledge.space.filters.test.tsx ③④ 尾段），
//   派工「cap 如实」名实不符，引用不重写；④三值实名 kn-row-copy-space-<i>/knF-copy、
//   cap 50 为常量位——R152⑤/R142 已锁 → 引用。导出族仅 data-export="absent"。
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

async function submitForm(testid: string) {
  const form = document.querySelector(`[data-testid="${testid}"]`) as HTMLFormElement | null;
  expect(form, testid).toBeTruthy();
  await act(async () => {
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await act(async () => {});
}

const q = (testid: string) => document.querySelector(`[data-testid="${testid}"]`);
const loc = () => (q("loc")?.textContent ?? "") as string;
const params = () => new URLSearchParams(loc());
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const visibleRows = () => document.querySelectorAll('[data-testid="kn3-docs-row"]').length;

const A = { documentId: "d_a", fileName: "人事手册.pdf", mimeType: "application/pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const B = { documentId: "d_b", fileName: "人事表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const C = { documentId: "d_c", fileName: "运维手册.pdf", mimeType: "pdf", sizeBytes: 512, updatedAt: "2026-11-19T05:00:00Z" };
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES)
      return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "人事空间", docCount: 3, status: "synced" }] });
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [A, B, C] });
    if (url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [A, B, C] });
    return fail(404, "这个数据接口还没有接入。", "rid-r164");
  });

describe("knowledge type×paging cross guards (R164, gap-only)", () => {
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

  it("① ktype×q coexist on the address but the documents request carries exactly {limit, spaceId} — local filters never enter the wire, zero churn", async () => {
    wire();
    await render(`/knowledge?tab=spaces&panel=spaces&space=sp_x&q=${encodeURIComponent("人事")}&ktype=${encodeURIComponent("PDF")}&ksort=updated&kdir=asc`);
    // 地址四个筛选键齐在场；请求里只应有读口参数
    expect(params().get("q")).toBe("人事");
    expect(params().get("ktype")).toBe("PDF");
    expect(params().get("ksort")).toBe("updated");
    const docReqs = urls().filter((u) => u.includes("spaceId="));
    expect(docReqs.length).toBeGreaterThan(0);
    for (const req of docReqs) {
      const qs = new URLSearchParams(req.split("?")[1]);
      expect([...qs.keys()].sort()).toEqual(["limit", "spaceId"]); // q/ktype/ksort/kdir/cursor 皆不入线
      expect(qs.get("limit")).toBe("50");
      expect(qs.get("spaceId")).toBe("sp_x");
    }
    // 切桶+改词都不追加请求（交叉 R131/R157 已锁语义，这里锁的是「请求参集合」维度）
    const c0 = urls().length;
    await click("kn-type-all");
    await type("kn6-search-input", "手册");
    await submitForm("kn6-search-form");
    expect(urls().length).toBe(c0);
    for (const req of urls().filter((u) => u.includes("spaceId="))) {
      expect([...new URLSearchParams(req.split("?")[1]).keys()].sort()).toEqual(["limit", "spaceId"]);
    }
  });

  it("② clear-all walk: after clearing q, ktype and sort one by one, no ktype/q/ksort/kdir/cursor residue in the URL and rows return to the full set", async () => {
    wire();
    await render(`/knowledge?tab=spaces&panel=spaces&space=sp_x&q=${encodeURIComponent("人事")}&ktype=${encodeURIComponent("表格")}&ksort=updated&kdir=desc`);
    expect(visibleRows()).toBe(1); // q 不进详情表：ktype=表格 → 仅 B
    // 清 q（提交空词，R157 ② 同动线）
    await type("kn6-search-input", "");
    await submitForm("kn6-search-form");
    // 清 ktype（点全部；type 兜底键也一并删——R146 ①）
    await click("kn-type-all");
    // 清排序：kn-sort 第三态清除（主测 kn-sort 段已锁表头三态；此处走真实点击回默认）
    await click("kn-sort-updated"); // desc→asc（本就在 updated/desc：换向）
    await click("kn-sort-updated"); // asc→默认清除
    const p = params();
    expect(p.has("q")).toBe(false);
    expect(p.has("ktype")).toBe(false);
    expect(p.has("type")).toBe(false);
    expect(p.has("ksort")).toBe(false);
    expect(p.has("kdir")).toBe(false);
    expect(p.has("cursor")).toBe(false); // cursor 本就从不落 URL（R118）——终态复证
    expect(loc()).toBe("?tab=spaces&panel=spaces&space=sp_x"); // 只剩位置键
    // 行回全量默认序（updated/desc：A 07:00 先）
    expect(visibleRows()).toBe(3);
    expect((document.querySelector('[data-testid="kn3-docs-row"]')?.textContent ?? "")).toContain("人事手册.pdf");
    expect(q("kn3-page-cap")).toBeTruthy(); // 非空 ready 态 cap 回归（对照 R157 空态不渲染）
  });
});
