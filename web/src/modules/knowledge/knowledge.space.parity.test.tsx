// R213 — 全局面 × 空间详情面 parity 护栏（纯测试单：零产品改动）。
// 名实红线（按实测，禁造控件）：
// · 「全局列表」= 跨空间文档搜索面 kn6-search-*（SearchDocTable，R66 分组）：**无分页控件**
//   （knE-page-* 0 渲染，R197 末腿已锁）、**无上限句**（kn-space-page-cap 不存在——R187
//   只断言过其缺席；上限句实名 kn3-page-cap 属详情面）；行钮族 kn-row-copy-<i>。
// · 「空间详情」= kn3-docs-*/DocTable：knE-page-* 分页、kn3-page-cap（50 常量位/M 可变位）、
//   行钮族 kn-row-copy-space-<i>。
// · 筛选器械两面不同：全局面 = 文档名搜索框 ?q=（读口不吃 q，本地）；详情面 = 类型桶
//   ?ktype=（旧 type 兜底）+ 组件本地名筛（不落 URL）。第②腿只锁「同词过滤后的行集
//   跨面相等」，器械差异如实记录，不伪称筛选等价。无 ?source= 控件。
// · 两面同屏共存实测：详情 URL 下 DocumentNameSearch 恒挂页顶（R132/R196 已证）——
//   本文件直接利用同屏，一次渲染取两面。
// 查重（引用不重写）：
// · ①四字段跨面逐字（名/类型/大小/更新 + title 口径）——kn.parity.ts:138-141（R70）
//   + 短码为复制独有列 —— R200 columns:125 差集已锁 → 本文件不重跑，只做行钮文本对；
// · 超子集关系 —— R169 counts.parity:158；详情翻页自身的行/钮/cap 联动 —— R197；
//   两面钮 id 族同屏互不吞并 —— 主测 R132 段 :5069；行钮==行内预览==抽屉 六路链 —— R204①。
// 真缺口（本文件 3 例）：②同词过滤两面行集逐元素等；③同一文档**两面行钮文本整串
// toBe**（跨面产物直对，此前只各自对屏上）；④详情翻页时命中面行数/data-len 不被串
// （全局面不具翻页能力——只测单向隔离并记录）。
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
const P2URL = `${P1URL}&cursor=cpg2`;

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

const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const q2 = (testid: string) => document.querySelector(`[data-testid="${testid}"]`);
const detailNames = () =>
  [...document.querySelectorAll('[data-testid="kn3-docs-row"] [data-testid="kn3-docs-name"]')].map((n) =>
    (n.textContent ?? "").replace(/\s+/g, " ").trim(),
  );
const hitNames = () =>
  [...document.querySelectorAll('[data-testid="kn6-search-row"] [data-testid="kn6-search-name"]')].map((n) =>
    (n.textContent ?? "").replace(/\s+/g, " ").trim(),
  );
const btnText = async (testid: string, writes: ReturnType<typeof vi.fn>) => {
  writes.mockClear();
  await click(testid);
  return String(writes.mock.calls[0][0]);
};

const A = { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "application/pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const B = { documentId: "d_b", fileName: "B 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const C = { documentId: "d_c", fileName: "C 运维手册.pdf", mimeType: "application/pdf", sizeBytes: 512, updatedAt: "2026-11-19T05:00:00Z" };
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 3, status: "synced" }],
};
const wire = (p1Extra: Record<string, unknown> = {}, p2: unknown[] | null = null) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [A, B, C] });
    if (url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: [A, B, C], ...p1Extra });
    if (p2 && url === P2URL) return Promise.resolve({ asOf: SP.asOf, documents: p2, nextCursor: null });
    return fail(404, "这个数据接口还没有接入。", "rid-r213");
  });
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

describe("knowledge global × space-detail parity remainder (R213, gap-only)", () => {
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

  it("② same word through the two different filter devices yields byte-equal row sets (device difference recorded, not equivalence claimed)", async () => {
    wire();
    await render(DETAIL);
    const u0 = urls().slice().sort().join("|");
    // 全局面：q=手册（读口不吃 q，键入即本地收敛——R118 口径）
    await type("kn6-search-input", "手册");
    const hits = hitNames();
    // 详情面：组件本地名筛同词
    await type("kn3-docs-filter-input", "手册");
    const details = detailNames();
    expect(hits).toEqual(["A 手册.pdf", "C 运维手册.pdf"]);
    expect(details).toEqual(hits); // 同词两面行集逐元素等（同夹具同数据源）
    // 器械差异记录：全局面框清空即回全量；详情面名筛是组件态（清 ktype 桶不影响它、
    // 清空它不影响命中面）——各面独立，无跨面筛选等价承诺
    await type("kn3-docs-filter-input", "");
    expect(detailNames()).toEqual(["A 手册.pdf", "B 表.xlsx", "C 运维手册.pdf"]);
    expect(hitNames()).toEqual(hits); // 详情清筛不串命中面
    // 全程本地：零新请求（快照逐字）
    expect(urls().slice().sort().join("|")).toBe(u0);
  });

  it("③ the same document's row-button text is byte-identical ACROSS the two faces (global kn-row-copy-<i> vs detail kn-row-copy-space-<i>), zero requests throughout", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire();
    await render(DETAIL); // 两面同屏（R132/R196 已证的共存在效性）
    const hitText = await btnText("kn-row-copy-0", writeText); // 全局面首行 A
    const detailText = await btnText("kn-row-copy-space-0", writeText); // 详情面首行 A（默认 updated/desc）
    expect(hitText.split("\n")[1].split(" | ")[0]).toBe("A 手册.pdf");
    expect(detailText.split("\n")[1].split(" | ")[0]).toBe("A 手册.pdf");
    expect(detailText).toBe(hitText); // 跨面同文档整串逐字（R71 单点派生的跨面直接证据）
    // 两族 id 各自独立连续（同屏不吞并 —— R132 锁族，此处序内复跑当态）
    expect(document.querySelector('button[data-testid="kn-row-copy-0"]')).toBeTruthy();
    expect(document.querySelector('button[data-testid="kn-row-copy-space-0"]')).toBeTruthy();
    // 复制全程零请求
    expect(urls().filter((u) => u.includes("cursor="))).toHaveLength(0);
    const c0 = urls().length;
    await btnText("kn-row-copy-1", writeText);
    expect(urls().length).toBe(c0);
  });

  it("④ paging the detail face leaves the global face untouched (rows, data-len) — the global face has NO paging affordance (recorded, not claimed)", async () => {
    // 派工字面：详情面第一页**恰满 50 笔上限**（DOCUMENTS_LIMIT）、第二页 1 笔——
    // 51 笔真实跨页数据，翻页才发生「M 可变位 50→51」与 cap-more 提示的进退场。
    const page1 = Array.from({ length: 50 }, (_, i) => ({
      documentId: `p1_${String(i + 1).padStart(2, "0")}`,
      fileName: `卷 ${String(i + 1).padStart(2, "0")}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 100 + i,
      updatedAt: `2026-11-1${i % 9}T07:00:00Z`,
    }));
    const page2 = [{ documentId: "p2_51", fileName: "卷 51.pdf", mimeType: "application/pdf", sizeBytes: 1, updatedAt: "2026-11-10T01:00:00Z" }];
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [A, B, C] });
      if (url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: page1, nextCursor: "cpg2" });
      if (url === P2URL) return Promise.resolve({ asOf: SP.asOf, documents: page2, nextCursor: null });
      return fail(404, "这个数据接口还没有接入。", "rid-r213");
    });
    await render(DETAIL);
    // 名实：全局面零分页控件（R197 末腿同口径——此处按当态复跑一句）
    expect(document.querySelectorAll('[data-testid^="knE-page"]').length).toBeGreaterThan(0); // 详情面有分页族
    expect(document.querySelectorAll('[data-testid="kn6-search-table"] [data-testid^="knE-page"]').length).toBe(0); // 全局面零分页控件（名实）
    const hitRowsBefore = hitNames();
    const hitLenBefore = document.querySelector('[data-testid="kn6-search"]')?.getAttribute("data-len");
    const capBefore = (document.querySelector('[data-testid="kn3-page-cap"]')?.textContent ?? "").replace(/\s+/g, " ");
    expect(capBefore).toContain("本页最多显示 50 篇（当前已加载 50 篇；复制清单也只含这些篇）"); // M 满页
    expect(q2("kn3-page-cap-more")).toBeTruthy(); // 恰满 50：「可能还有更多」提示在场
    // 详情翻页：增量恰为 P2URL 一条；命中面行数与 data-len 逐字不动
    const c0 = urls().length;
    await click("knE-page-more");
    expect(urls().slice(c0)).toEqual([P2URL]);
    expect(hitNames()).toEqual(hitRowsBefore);
    expect(document.querySelector('[data-testid="kn6-search"]')?.getAttribute("data-len")).toBe(hitLenBefore);
    // 详情面自身：行数与 cap M 随翻页增长（50 为常量位）；满页提示随 51>50 退场
    expect(detailNames()).toHaveLength(51);
    const capAfter = (document.querySelector('[data-testid="kn3-page-cap"]')?.textContent ?? "").replace(/\s+/g, " ");
    expect(capAfter).toContain("本页最多显示 50 篇（当前已加载 51 篇；复制清单也只含这些篇）");
    expect(capAfter).not.toBe(capBefore); // M 可变位 50→51；50 常量位不动
    // 全局面没有上限句（kn3-page-cap 只属详情面）
    expect(document.querySelectorAll('[data-testid="kn3-page-cap"]').length).toBe(1);
  });
});
