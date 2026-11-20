// R149 — /knowledge 预览与列表两条链的请求契约护栏（纯测试单：零产品改动）。
// 查重判定（先 git grep 后写，锁过的不重写）：
// · ①首屏「恰 1 次 documents?...spaceId 且不带 cursor」：主测 knE 段
//   KnowledgeModulePage.test.tsx:2531（cursorCalls()===0「第一页绝不带 cursor」）已锁 → 不重复。
// · ③行内预览开/关列表零增量、抽屉每次打开 +1（R49 详情读）/开着零追加/关闭零增量：
//   knowledge.parity.test.tsx:176-207（R125 C 段快照 toEqual 逐档）已锁 → 不重复。
// · ②「翻页后 cursor 原值」部分锁：主测 :2554 P2URL 字面含 cursor=c2 且恰 1 次；
//   行追加非替换：主测 B 段 rowCount 2→3。
// 真缺口（本文件补齐）：
// · ②跨页**部分重叠**时的 id 去重（loadMore 的 seen/fresh 逻辑——主测 E 段只锁「整页
//   重复落 stale」，正常部分重叠并回零 pin）与去重后三值（行数 == cap 句 M == data-len
//   == knF 数据行）；
// · ②末页 disabled 的 knE-page-more 点击零请求（R131 锁 disabled 态与文案，未锁点击行为面）；
// · ④抽屉在 doc=a↔doc=b 间切换：列表请求集合逐字不变、详情读各恰 1 次且 URL 分别指向
//   该文档（R125 只锁同文档开关）。
// cursor 在组件态不落 URL（R118 锁），本文件一律从请求 URL 断言。
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
const P2URL = `${P1URL}&cursor=pg2`;
const detailUrl = (id: string) => `/agent-api/api/documents/${id}`;

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
const click = (testid: string) => clickNode(document.querySelector(`[data-testid="${testid}"]`), testid);

const q = (testid: string) => document.querySelector(`[data-testid="${testid}"]`);
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const visibleRows = () => document.querySelectorAll('[data-testid="kn3-docs-row"]').length;
const capText = () => (q("kn3-page-cap")?.textContent ?? "").replace(/\s+/g, " ").trim();
const rowWith = (name: string) =>
  [...document.querySelectorAll('[data-testid="kn3-docs-row"]')].find((r) => (r.textContent ?? "").includes(name)) ?? null;

const D_A = { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const D_B = { documentId: "d_b", fileName: "B 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const D_C = { documentId: "d_c", fileName: "C 说明.txt", mimeType: "txt", sizeBytes: 512, updatedAt: "2026-11-19T05:00:00Z" };

const wirePages = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES)
      return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 3, status: "synced" }] });
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [] });
    if (url === P1URL) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [D_A, D_B], nextCursor: "pg2" });
    if (url === P2URL) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [D_B, D_C], nextCursor: null });
    return fail(404, "这个数据接口还没有接入。", "rid-r149");
  });

const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

describe("knowledge request-contract guards (R149, tests only)", () => {
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

  it("② paging with a partially overlapping page 2: request URL carries the previous nextCursor verbatim, rows dedupe by id, and the deduped count equals cap-M == data-len == knF data lines; end-of-page disabled click sends zero", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wirePages();
    await render(DETAIL);
    expect(visibleRows()).toBe(2);
    // 翻页：增量请求恰 1 条，URL 逐字带上一页 nextCursor 原值（cursor=pg2）
    const cMid = urls().length;
    await click("knE-page-more");
    const added = urls().slice(cMid);
    expect(added).toEqual([P2URL]);
    expect(added[0]).toContain("cursor=pg2");
    // 追加非替换 + id 去重：page2 的 [d_b(重叠), d_c(新)] 只并入 d_c → 3 行，且 d_b 单份
    expect(visibleRows()).toBe(3);
    expect([...document.querySelectorAll('[data-testid="kn3-docs-row"]')].filter((r) => (r.textContent ?? "").includes("B 表.xlsx"))).toHaveLength(1);
    // 三元相等：去重后行数 == cap 句 M == data-len（上限 50 只作常量在句内）
    expect(capText()).toContain("本页最多显示 50 篇（当前已加载 3 篇；复制清单也只含这些篇）");
    expect(q("kn3-docs")?.getAttribute("data-len")).toBe("3");
    writeText.mockClear();
    await click("knF-copy");
    expect(String(writeText.mock.calls[0][0]).split("\n").length - 2).toBe(visibleRows());
    // 到末页（P2.nextCursor=null）：按钮 disabled 在场；点击不发任何请求
    const moreBtn = q("knE-page-more") as HTMLButtonElement | null;
    expect(moreBtn?.disabled).toBe(true);
    const cEnd = urls().length;
    await clickNode(moreBtn, "knE-page-more (disabled)");
    expect(urls().length).toBe(cEnd);
  });

  it("④ switching the drawer between doc=a and doc=b: the list request set stays byte-identical; each document's detail read fires exactly once, pointing at itself", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES)
        return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 2, status: "synced" }] });
      if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [D_A, D_B] });
      if (url === P1URL) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [D_A, D_B] });
      return fail(404, "文档详情未接入。", "rid-r149-d");
    });
    await render(DETAIL);
    const listSetBefore = urls().filter((u) => u === SPACES || u === DOCUMENTS_PLAIN || u === P1URL).sort().join("|");
    const cBase = urls().length;
    // 开 A：列表零增量、详情读恰 1 次且指向 A（R49 既有设计，抽屉非零请求链）
    await clickNode(rowWith("A 手册.pdf")?.querySelector('[data-testid="kn3-docs-name"]') ?? null, "open A");
    expect(q("kn7-preview-panel")).toBeTruthy();
    expect(urls().slice(cBase)).toEqual([detailUrl("d_a")]);
    // 切 B：列表请求集合逐字不变；详情多 1 次且指向 B；A 的详情读不重发
    const cA = urls().length;
    await clickNode(rowWith("B 表.xlsx")?.querySelector('[data-testid="kn3-docs-name"]') ?? null, "switch to B");
    expect(urls().slice(cA)).toEqual([detailUrl("d_b")]);
    expect(urls().filter((u) => u === detailUrl("d_a"))).toHaveLength(1);
    expect(visibleRows()).toBe(2); // 行数不动：切换只换详情
    const listSetAfter = urls().filter((u) => u === SPACES || u === DOCUMENTS_PLAIN || u === P1URL).sort().join("|");
    expect(listSetAfter).toBe(listSetBefore);
    // 关闭抽屉：零增量收口（与 R125C 同口径，本链只锁切换段）
    const cB = urls().length;
    await clickNode(q("kn7-preview-close"), "close drawer");
    expect(urls().length).toBe(cB);
  });
});
