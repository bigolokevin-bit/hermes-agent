// R138 — /knowledge 空态与清筛选出口护栏（纯测试单：禁改产品行为）。
// 复用不重写（实测 grep）：主测 knN 段（KnowledgeModulePage.test.tsx:3395-3449）已锁
// 空间 404 详情态的 unavailable/rid/knF-copy disabled/返回出口；kn-gates 段（R57）已锁
// 六面四态 marker 与 data-reason；R108 已锁 cap 三态不渲染与在场四值相等；R131 已锁
// 两页合并三值。本文件只补：①检索无匹配的可读句+无裸 0 计数+cap 检索面不渲染；
// ②knF-copy 四态 disabled 下「点击不进剪贴板、零请求」的行为面（marker 已锁、点击未锁）；
// ③清空出口恢复后 kn-row-copy-<i>（R132）行数与可见行/命中复制三值同源；
// ④不存在 spaceId 深链（200 空与 404 两路）：地址不变、预览/行复制族整体不渲染。
// 派工两名实不符照录：kn-list-copy 不存在（清单复制是 knF-copy；检索面是 knG-copy）；
// 导出族不存在——仅 data-export="absent" 标记（KnowledgeModulePage.tsx:1297/:1630/:2630、
// copyGates.ts NO_EXPORT），本单只断言缺席不新增。
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
const loc = () => txt(q("loc"));
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));

const D1 = { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "application/pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const D2 = { documentId: "d_b", fileName: "B 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 2, status: "synced" }],
};

describe("knowledge empty states & filter-exit guards (R138, tests only)", () => {
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

  it("① no local match in the document search: readable sentence + clear exit, no bare 0-count, cap sentence absent on this surface", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [D1, D2] });
      return fail(404, "这个数据接口还没有接入。", "rid-r138");
    });
    await render("/knowledge?tab=spaces");
    expect(container.querySelectorAll('[data-testid="kn6-search-row"]')).toHaveLength(2);
    await type("kn6-search-input", "查无此名");
    const empty = q("knN-empty-text-doc-search");
    expect(empty).toBeTruthy();
    expect(empty?.getAttribute("data-knn-empty")).toBe("no-match");
    const sentence = txt(empty);
    expect(sentence).toContain("没有匹配的文档"); // 完整句子，非裸数
    expect(sentence).toContain("2 条"); // 说清是「这份列表里有 2 条筛完没剩」
    // 无裸「0 条/0 个/0 篇」冒充空集（全文正则，逐字防「共 0 条」句式回潮）
    expect(container.textContent ?? "").not.toMatch(/0\s*(条|个|篇)/);
    // 检索面本就不渲染空间详情的 cap 句（R108 属详情面；不搬过来、也不误报缺失）
    expect(q("kn3-page-cap")).toBeNull();
    // 清空出口在场且可用
    expect(q("kn6-search-empty-clear")).toBeTruthy();
  });

  it("② knF-copy stays disabled with a concrete title across error/unwired/denied/real-empty; a disabled click touches neither clipboard nor network", async () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const cases: Array<[string, () => Promise<never> | Promise<unknown>]> = [
      ["error", () => fail(500, "上游读取失败。", "rid-r138-err")],
      ["unwired", () => fail(404, "这个数据接口还没有接入。", "rid-r138-gone")],
      ["denied", () => fail(403, "没有查看这项数据的权限。", "rid-r138-denied")],
    ];
    for (const [label, responder] of cases) {
      fetchMock.mockImplementation((url: string) => {
        if (url === SPACES) return Promise.resolve(SP);
        if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [] });
        if (url === docsUrlFor("sp_x")) return responder();
        return fail(404, "这个数据接口还没有接入。", "rid-r138");
      });
      await render("/knowledge?tab=spaces&panel=spaces&space=sp_x");
      const btn = q("knF-copy") as HTMLButtonElement | null;
      expect(btn, label).toBeTruthy();
      expect(btn?.disabled, label).toBe(true);
      // 逐字锁：error 与 unwired≡denied（反枚举同句）的完整禁用句（copyGates 单点生成）
      expect(btn?.getAttribute("title"), label).toBe(
        label === "error"
          ? "这次没有读到文档列表，没有可复制的内容。"
          : "文档列表没读到（读口未接入或没有权限），没有可复制的内容。",
      );
      const before = urls().length;
      await click("knF-copy"); // disabled 原生吞点击：不进剪贴板、不发请求
      expect(writeText, label).not.toHaveBeenCalled();
      expect(urls().length, label).toBe(before);
    }
    // 真实 0 行（ready-空）：同 disabled + 句不同（空集不是读口故障）
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [] });
      if (url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP.asOf, documents: [] });
      return fail(404, "这个数据接口还没有接入。", "rid-r138");
    });
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x");
    const btn = q("knF-copy") as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(true);
    expect(txt(q("knN-empty-text-space-docs"))).toContain("该空间暂无文档"); // 可读空态句
    await click("knF-copy");
    expect(writeText).not.toHaveBeenCalled();
    // 导出族缺席按实断言（不新增控件）：闸门 marker 自报 absent
    expect(q("kn-gates-knF")?.getAttribute("data-export")).toBe("absent");
  });

  it("③ after clearing the failed filter: rows restore and kn-row-copy count == visible rows == search-copy line count", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [D1, D2] });
      return fail(404, "这个数据接口还没有接入。", "rid-r138");
    });
    await render("/knowledge?tab=spaces");
    await type("kn6-search-input", "查无此名");
    await click("kn6-search-empty-clear");
    const visible = container.querySelectorAll('[data-testid="kn6-search-row"]').length;
    expect(visible).toBe(2); // 行数恢复
    const rowCopies = container.querySelectorAll('button[data-testid^="kn-row-copy-"]');
    expect(rowCopies.length).toBe(visible); // R132 行复制按钮与可见行一一对应
    expect(rowCopies[0].getAttribute("data-testid")).toBe("kn-row-copy-0"); // 编号从 0 起按行序
    // 检索面复制（knG-copy——派工的 kn-list-copy 不存在，这面的清单复制实名 knG）：
    // 数据行数 == 可见行数
    await click("knG-copy");
    const lines = String(writeText.mock.calls[0][0]).split("\n");
    expect(lines.length - 2).toBe(visible);
    // 清空前后都是本地动作：零新请求（首次加载读取按实测在场，不宣称 0）
    expect(urls().filter((u) => u === DOCUMENTS_PLAIN)).toHaveLength(1);
  });

  it("④ deep link to a nonexistent space: URL bytes untouched, readable empty/unavailable state, preview & row-copy families never render (200-empty and 404)", async () => {
    const GHOST = "/knowledge?tab=spaces&panel=spaces&space=sp_ghost";
    const expectedLoc = "?tab=spaces&panel=spaces&space=sp_ghost";
    // 路 A：读口 200 但空列表
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [] });
      if (url === docsUrlFor("sp_ghost")) return Promise.resolve({ asOf: SP.asOf, documents: [] });
      return fail(404, "这个数据接口还没有接入。", "rid-r138");
    });
    await render(GHOST);
    expect(loc()).toBe(expectedLoc); // 地址字节不变：不改写、不猜、不回弹
    expect(q("knN-empty-text-space-docs")).toBeTruthy(); // 可读空态句在场
    expect(document.querySelectorAll('[data-testid^="kn-space-preview"]').length).toBe(0);
    expect(document.querySelectorAll('[data-testid^="kn-doc-preview"]').length).toBe(0);
    expect(document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length).toBe(0);
    expect(q("kn3-page-cap")).toBeNull(); // 空集不渲染上限句（R108 三态口径的深链复证）
    // 路 B：读口 404（不存在与未接入同体感，不泄露「这个空间不存在」的推断）
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [] });
      if (url === docsUrlFor("sp_ghost")) return fail(404, "这个数据接口还没有接入。", "rid-r138-ghost");
      return fail(404, "这个数据接口还没有接入。", "rid-r138");
    });
    await render(GHOST);
    expect(loc()).toBe(expectedLoc);
    expect(document.querySelectorAll('[data-testid^="kn-space-preview"]').length).toBe(0);
    expect(document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length).toBe(0);
    expect((q("knF-copy") as HTMLButtonElement | null)?.disabled).toBe(true); // 错误态复制条仍锁死
    // 两路全程：地址零改写、读口各按其次数——深链本身不多发一次 spaces 读
    expect(urls().filter((u) => u === SPACES).length).toBeLessThanOrEqual(2);
  });
});
