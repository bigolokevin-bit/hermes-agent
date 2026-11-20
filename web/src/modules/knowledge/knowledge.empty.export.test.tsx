// R215 — 知识列表空态 × 清筛选出口护栏（纯测试单：零产品改动）。
// 名实换算（按实测，禁造控件/禁改产品凑 brief）：
// · 「导出」族不存在：仅 data-export="absent" ×4（R190 源码级不变量）——清单复制实名
//   knF-copy（详情面）/knG-copy（检索面）；`kn-list-copy` 不存在。
// · ②「空态不显裸 0」+「计数位显 —」：kn3-page-cap 在真 0/error/denied/非法枚举实测
//   **不渲染**（R108⑥/R157/R187 已锁）——不为此造第二句；可执行的新落点是计数位
//   knF-lines/knG-lines（此前 grep 零命中=未锁），按产品真值断言。
// · ③清筛选：读口不吃 q/sort/ktype——本地清零请求是产品事实（R207/R169/R118/R157
//   已锁零增量与三值复原）→ 引用；本文件只做当态复跑，不制造也不宣称「一次重取」。
// · ④错误↔空态锚互斥 + 详情面 rid 复制：R187②/R183①/R210④ 已锁 → 引用；
//   检索面失败态的 rid 逐字与复制钮点击此前零 pin → 本文件新写。
// 行钮族按面：详情 kn-row-copy-space-<i>、检索 kn-row-copy-<i>（indexBase 连续，R169）。
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

const createObjectUrl = vi.fn();
beforeEach(() => {
  createObjectUrl.mockClear();
  Object.defineProperty(window.URL, "createObjectURL", { value: createObjectUrl, configurable: true, writable: true });
});

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
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));

const A = { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "application/pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const B = { documentId: "d_b", fileName: "B 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 2, status: "synced" }],
};
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

describe("knowledge empty-state export counters & search-face rid guards (R215, gap-only)", () => {
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

  it("② real-zero rows: the counters read 0 条/0 篇 sentences — never a bare 「0」 digit standing alone; copiers disabled with 「没有可复制」 titles (cap absence cited R108/R157, not re-locked)", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      if (url === DOCUMENTS_PLAIN || url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP.asOf, documents: [] });
      return fail(404, "这个数据接口还没有接入。", "rid-r215");
    });
    await render(DETAIL);
    // 计数位（本轮新锁）：ready-0 行时两面 lines 计数位的真值按产品现状钉死
    const fLines = (q("knF-lines")?.textContent ?? "").trim();
    const gLines = (q("knG-lines")?.textContent ?? "").trim();
    expect(fLines).toBe("—"); // 产品真值：零行不显 0，计数位落「—」（R138 只在 error 态锁过，真 0 未锁）
    expect(gLines).toBe("—");
    // 禁裸 0 冒充空集（全文）；空态句在场
    expect(container.textContent ?? "").not.toMatch(/(^|[^0-9.])0\s*(条|篇|个)/);
    expect(q("knN-empty-text-space-docs")).toBeTruthy();
    // ① 双腿引用位：cap 不渲染（R108⑥）、复制器 disabled+title（R214④）——当态在场性复跑
    expect(q("kn3-page-cap")).toBeNull();
    expect((q("knF-copy") as HTMLButtonElement | null)?.disabled).toBe(true);
    expect((q("knF-copy") as HTMLButtonElement)?.getAttribute("title")).toContain("没有可复制");
    expect((q("knG-copy") as HTMLButtonElement | null)?.disabled).toBe(true);
    const c0 = urls().length;
    await click("knF-copy");
    await click("knG-copy");
    expect(urls().length).toBe(c0); // 空态点击零请求
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it("④ search face failure: rid 逐字上屏且带可点击复制钮（详情面 R210 已锁，检索面是缺口），点击只写 rid 零额外请求", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true }); // 真实控制台为 https，RequestId 走剪贴板主路径（R210 同款注记）
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      if (url === DOCUMENTS_PLAIN) return fail(500, "上游读取失败，请稍后重试。", "rid-r215-search");
      if (url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP.asOf, documents: [A, B] });
      return fail(404, "这个数据接口还没有接入。", "rid-r215-x");
    });
    await render("/knowledge?tab=spaces");
    // 错误锚与 rid 逐字；行/钮零渲染（引用 R138 口径的当面复跑）
    expect(q("kn6-search-error")).toBeTruthy();
    expect((q("kn6-search-error")?.textContent ?? "")).toContain("请求编号：rid-r215-search");
    expect(document.querySelectorAll('[data-testid="kn6-search-row"]').length).toBe(0);
    // rid 复制钮：点击后投递逐字 rid，零额外网络
    const copyBtn = q("kn6-search-error")?.querySelector('button[aria-label="复制请求编号"]');
    expect(copyBtn).toBeTruthy();
    const c0 = urls().length;
    await act(async () => {
      (copyBtn as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {});
    expect(writeText).toHaveBeenCalledWith("rid-r215-search");
    expect(urls().length).toBe(c0);
    // 名实：两面不混——此路由（列表态）本就不渲染详情表；详情面的成功/失败互不牵连已由
    // R210④ 双败隔离与 R187②（一面失败不卸载另一面）锁死，此处不重复铺。
    expect(container.querySelectorAll('[data-testid="kn3-docs"]').length).toBe(0);
    expect(q("kn6-search-error")).toBeTruthy(); // 错误锚仍独立在场（复制不改变任何面状态）
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it("③ clear-filter walk stays at ZERO refetches (local-only reads; no re-fetch is manufactured) and row buttons == body rows after clearing on both faces", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      if (url === DOCUMENTS_PLAIN || url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP.asOf, documents: [A, B] });
      return fail(404, "这个数据接口还没有接入。", "rid-r215");
    });
    await render(DETAIL);
    const u0 = urls().slice().sort().join("|");
    const rows0 = container.querySelectorAll('[data-testid="kn3-docs-row"]').length;
    // 叠加本地名筛再清空：全程零请求（清筛选不是「恰 1 次取数」——产品读口不吃 q，如实为 0）
    const box = container.querySelector('[data-testid="kn3-docs-filter-input"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(box, "手册");
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {});
    expect(container.querySelectorAll('[data-testid="kn3-docs-row"]').length).toBe(1);
    await act(async () => {
      setter?.call(box, "");
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {});
    const rowsBack = container.querySelectorAll('[data-testid="kn3-docs-row"]').length;
    expect(rowsBack).toBe(rows0);
    // 钮数 == 行数（详情面族；检索面同屏复跑一次计数一致性）
    const spaceBtns = container.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length;
    expect(spaceBtns).toBe(rowsBack);
    const hitRows = document.querySelectorAll('[data-testid="kn6-search-row"]').length;
    const hitBtns = [...document.querySelectorAll('button[data-testid^="kn-row-copy-"]')].filter(
      (b) => !(b.getAttribute("data-testid") ?? "").includes("-space-"),
    ).length;
    expect(hitBtns).toBe(hitRows);
    // 全程快照逐字：清/开筛选零增量（首屏读取条数如实——不宣称也不制造重取）
    expect(urls().slice().sort().join("|")).toBe(u0);
  });
});
