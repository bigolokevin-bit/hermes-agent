// R221 — 详情错误隔离扩展（纯测试单：零产品改动，未造控件/假路由）。
// 名实红线：唯一详情面 = 抽屉 kn7-preview-*（?doc=），无独立详情页；列表与复制文本缺值
// 「—」、预览/抽屉走 previewField「该字段未返回」+per-field title——两套口径不统一；
// 导出族与 ?source= 不存在；详情面行钮 = kn-row-copy-space-<i>（派工①的 kn-row-copy-*
// 按实测面换算到本族）；预览/抽屉错误态下 cap 属列表读口——列表成功时 cap 在、列表失败
// 时不渲染（R108/R157/R187），本文件④锁「恢复后复原」的过渡。clipboard 桩全 Promise。
// 查重（引用不重写，逐条 file:line）：
// · 腿①（详情 500：错误锚×空态锚互斥、列表/行钮不卸载仍可用、rid 上屏）=
//   R183 detail.error:105-132（kn7 error 锚 + knN-empty null + 列表与 cap 在场）+
//   R219(b)（500 窗内行钮可用与四处链互等）+ R206（404 变体）→ 本文件①只做当帧最小
//   复跑（错误锚在场 + 空锚 null + 行钮一点成功），不声称新发现；
// · 腿③（两处重试各 +1 互不牵连、双 rid 独立复制钮）= R210/R211
//   knowledge.error.isolation.test.tsx ③④ 已锁 → 引用不重写；
// 新增维（与上述行互补，此前 grep 零命中）：
// · 腿② = **抽屉 500 错误窗内列表交互仍全功能**：点排序表头翻序（本地零新请求）+
//   点 knE-page-more 真实追加第二页（增量恰 [P2URL]）——R206/R219 锁了「行钮可用」但
//   从未锁「排序/翻页控件在详情错误窗内的可用性」；
// · 腿④ = **双失败恢复过渡**：列表 500 时 cap 不渲染 → 列表重试成功后 cap 以逐字整句
//   复原、两枚错误锚各自随重试消失且互不牵连（R210 锁了「两锚同消」但没锁 cap 从
//   缺席→在场的复原位）。
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
const P2URL = `${P1URL}&cursor=cw62`;
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

async function clickNode(node: Element | null | undefined, label: string) {
  expect(node, label).toBeTruthy();
  await act(async () => {
    (node as Element).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {});
}

const q = (testid: string) => document.querySelector(`[data-testid="${testid}"]`);
const txt = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const rowNames = () =>
  [...document.querySelectorAll('[data-testid="kn3-docs-row"] [data-testid="kn3-docs-name"]')].map((n) => txt(n));
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined); // Promise 桩——R214 教训
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  return writeText;
};

const A = { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const B = { documentId: "d_b", fileName: "B 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const C = { documentId: "d_c", fileName: "C 说明.txt", mimeType: "txt", sizeBytes: 512, updatedAt: "2026-11-19T05:00:00Z" };
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 3, status: "synced" }],
};
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";
const wire = (opts: { listOk?: boolean; detailOk?: boolean; p2Ok?: boolean }) => {
  const listOk = opts.listOk ?? true;
  const detailOk = opts.detailOk ?? true;
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [A, B, C] });
    if (url === P1URL)
      return listOk
        ? Promise.resolve({ asOf: SP.asOf, documents: [A, B], nextCursor: "cw62" })
        : fail(500, "上游读取失败，请稍后重试。", "rid-r221-list");
    if (url === P2URL)
      return opts.p2Ok === false
        ? fail(500, "上游读取失败，请稍后重试。", "rid-r221-p2")
        : Promise.resolve({ asOf: SP.asOf, documents: [C], nextCursor: null });
    if (url === DETAIL_A)
      return detailOk
        ? Promise.resolve({ sourceName: "A 原件.pdf", status: "indexed" })
        : fail(500, "上游读取失败，请稍后重试。", "rid-r221-d");
    return fail(404, "这个数据接口还没有接入。", "rid-r221-x");
  });
};

describe("knowledge detail error isolation, cross-face interaction & recovery transitions (R221)", () => {
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

  it("① 抽屉 500 当帧最小复跑（引 R183:105-132）：错误锚在场×空锚 null、列表行与 -space- 钮仍可用、rid 上屏", async () => {
    const writeText = clipStub();
    wire({ detailOk: false });
    await render(`${DETAIL}&doc=d_a`);
    expect(q("kn7-preview-error")).toBeTruthy();
    expect(q("kn7-preview-unwired")).toBeNull(); // 错误≠未接入（R183 互斥口径）
    expect(q("knN-empty-text-space-docs")).toBeNull(); // 错误≠空态
    expect(document.body.textContent ?? "").toContain("请求编号：rid-r221-d");
    expect(rowNames()).toEqual(["A 手册.pdf", "B 表.xlsx"]); // 列表未卸载
    await clickNode(
      container.querySelectorAll('[data-testid="kn3-docs-row"]')[1].querySelector('button[data-testid^="kn-row-copy-space-"]'),
      "row copy while drawer failed",
    );
    expect(writeText).toHaveBeenCalledTimes(1); // 行钮可用（R219(b) 口径当帧复证）
  });

  it("② 新增维：抽屉 500 错误窗内列表交互全功能——点表头排序翻序零新请求、点 knE-page-more 真实追加第二页", async () => {
    wire({ detailOk: false });
    await render(`${DETAIL}&doc=d_a`);
    expect(q("kn7-preview-error")).toBeTruthy();
    // 排序表头此刻可用（列表 ready；与 R211 列表失败态 disabled 形成对照位）
    const head = q("kn-sort-updated") as HTMLButtonElement | null;
    expect(head?.disabled).toBe(false);
    const order0 = rowNames();
    const c0 = urls().length;
    await clickNode(head, "sort updated flip");
    expect(rowNames()).not.toEqual(order0); // 翻序生效
    expect(urls().length).toBe(c0); // 本地排序零新请求——详情错误不冻结列表
    // 翻页控件在错误窗内照常：增量恰 [P2URL]、行数追加
    await clickNode(q("knE-page-more"), "page more");
    expect(urls().slice(c0)).toEqual([P2URL]);
    expect(rowNames()).toHaveLength(3);
    expect(q("kn7-preview-error")).toBeTruthy(); // 列表动作不吞抽屉错误锚
  });

  it("③ 引用位（R210/R211 ③④ 已锁双重试各 +1 与双 rid 独立复制）——本文件仅复跑列表腿半段：重试增量恰 [P1URL]", async () => {
    let listOk = false;
    const wireToggle = () =>
      fetchMock.mockImplementation((url: string) => {
        if (url === SPACES) return Promise.resolve(SP);
        if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [A, B, C] });
        if (url === P1URL)
          return listOk
            ? Promise.resolve({ asOf: SP.asOf, documents: [A, B], nextCursor: "cw62" })
            : fail(500, "上游读取失败，请稍后重试。", "rid-r221-list");
        if (url === DETAIL_A) return fail(500, "上游读取失败，请稍后重试。", "rid-r221-d");
        return fail(404, "这个数据接口还没有接入。", "rid-r221-x");
      });
    wireToggle();
    await render(`${DETAIL}&doc=d_a`);
    expect(q("kn3-docs-error")).toBeTruthy();
    expect(q("kn7-preview-error")).toBeTruthy();
    listOk = true;
    wireToggle();
    const c0 = urls().length;
    await clickNode(q("kn3-docs-retry"), "retry list");
    expect(urls().slice(c0)).toEqual([P1URL]); // 列表重试只 +1 自己（详情不重发——R210 同断言的当帧位）
    expect(q("kn7-preview-error")).toBeTruthy(); // 另一面错误锚不被误清
  });

  it("④ 新增维：双失败恢复过渡——列表 cap 从缺席到逐字整句复原、两锚各自随重试消失、抽屉源字段回正", async () => {
    let listOk = false;
    let detailOk = false;
    const wireToggle = () =>
      fetchMock.mockImplementation((url: string) => {
        if (url === SPACES) return Promise.resolve(SP);
        if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [A, B, C] });
        if (url === P1URL)
          return listOk
            ? Promise.resolve({ asOf: SP.asOf, documents: [A, B], nextCursor: "cw62" })
            : fail(500, "上游读取失败，请稍后重试。", "rid-r221-list");
        if (url === DETAIL_A)
          return detailOk
            ? Promise.resolve({ sourceName: "A 原件.pdf", status: "indexed" })
            : fail(500, "上游读取失败，请稍后重试。", "rid-r221-d");
        return fail(404, "这个数据接口还没有接入。", "rid-r221-x");
      });
    wireToggle();
    await render(`${DETAIL}&doc=d_a`);
    // 双失败当帧：两锚在场；列表失败 → cap 不渲染（R108/R187 口径的缺席位）
    expect(q("kn3-docs-error")).toBeTruthy();
    expect(q("kn7-preview-error")).toBeTruthy();
    expect(q("kn3-page-cap")).toBeNull();
    // 恢复列表：cap 以逐字整句复原（此前锁过缺席与在场，没锁过「复原过渡」）
    listOk = true;
    wireToggle();
    await clickNode(q("kn3-docs-retry"), "recover list");
    expect(q("kn3-docs-error")).toBeNull();
    expect(txt(q("kn3-page-cap"))).toBe("本页最多显示 50 篇（当前已加载 2 篇；复制清单也只含这些篇）");
    expect(q("kn7-preview-error")).toBeTruthy(); // cap 复原不牵连抽屉锚
    // 恢复详情：第二锚消失、源字段回正——两锚同消且各有其时
    detailOk = true;
    wireToggle();
    await clickNode(q("kn7-preview-retry"), "recover drawer");
    expect(q("kn7-preview-error")).toBeNull();
    expect(txt(q("kn7-preview-field-source"))).toContain("A 原件.pdf");
    expect(q("kn3-docs-error")).toBeNull();
  });
});
