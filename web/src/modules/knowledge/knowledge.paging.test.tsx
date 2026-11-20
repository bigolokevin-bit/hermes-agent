// R131 — /knowledge 分页与筛选组合护栏（纯测试单：禁改产品行为）。
// 复用不重写（既有 pin，实测 grep 为证）：
// · KnowledgeModulePage.test.tsx knE 段：第一页不带 cursor（:2514）、排序/名称筛选重置+计数
//   （:2558-2563）、无 total「总数不可用」（:2573-2578）、无游标字段态（:2588-2592）、
//   坏 cursor 不并回（:2596-2610）、403≡404/rid 在场/旧行保留/重试后并回（:2612-2667）。
// · knowledge.filters.test.tsx（R118）：切类型后游标复位翻转 + URL 无 cursor 参数。
// · knowledge.updated 系列与 R108：kn3-page-cap 49/50 边界与三值（单页态）。
// 本文件只补未锁组合：①第 2 页后切 ktype 的行替换语义（第 2 页独有行出局、计数文本、
// 复位后不再出现旧 cursor 请求）；②末页态下 cap 文案与 knE 计数同源共存；③失败→重试
// 的请求 URL 粒度计数（恰发 1 次且就是下一页那条、失败窗口零其它增量）+ 重试并入行身份；
// ④两页合并态下 knF-copy == 可见行 == cap M 三值。导出族不存在：页面只有
// data-export="absent"（KnowledgeModulePage.tsx:1297/:1630/:2630），按派工落三值断言。
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
const docsUrlFor = (id: string) => `/agent-api/api/documents?limit=50&spaceId=${id}`;
const P1URL = docsUrlFor("sp_x");
const P2URL = `${P1URL}&cursor=c2`;

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
const rows = () => [...container.querySelectorAll('[data-testid="kn3-docs-row"]')];
const rowCount = () => rows().length;
const capText = () => txt(q("kn3-page-cap"));
const moreBtn = () => q("knE-page-more") as HTMLButtonElement | null;
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

const A_PDF = { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "application/pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const B_XLS = { documentId: "d_b", fileName: "B 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const C_TXT = { documentId: "d_c", fileName: "C 说明.txt", mimeType: "txt", sizeBytes: 512, updatedAt: "2026-11-19T05:00:00Z" };
const P1 = { asOf: "2026-11-19T08:00:00Z", documents: [A_PDF, B_XLS], nextCursor: "c2" };
const P2 = { asOf: "2026-11-19T08:00:00Z", documents: [C_TXT], nextCursor: null };

const wire = (p2: () => Promise<unknown>) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES)
      return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 3, status: "synced" }] });
    if (url === "/agent-api/api/documents?limit=50") return Promise.resolve({ asOf: P1.asOf, documents: [] });
    if (url === P1URL) return Promise.resolve(P1);
    if (url === P2URL) return p2();
    return fail(404, "这个数据接口还没有接入。", "rid-r131");
  });

describe("knowledge paging × filters guards (R131, tests only)", () => {
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

  it("① loading page 2 then switching ktype REPLACES rows back to page 1: count text, no stale-cursor request, page-2 row gone", async () => {
    wire(() => Promise.resolve(P2));
    await render(DETAIL);
    expect(rowCount()).toBe(2);
    await click("knE-page-more");
    expect(rowCount()).toBe(3); // d_c 并入
    expect(capText()).toContain("当前已加载 3 篇");
    const before = urls().length;
    // 切类型桶（xlsx 人话桶「表格」）：页码归 1 的行替换
    await clickBucket("表格");
    expect(txt(q("knE-page-count"))).toBe("已显示 2 篇 · 总数不可用"); // 回到第一页 M=2
    expect(rowCount()).toBe(1);
    expect(txt(rows()[0])).toContain("B 表.xlsx");
    // 第 2 页独有行按标识出局：不在屏上任一角落
    expect(container.textContent ?? "").not.toContain("C 说明");
    expect(container.textContent ?? "").not.toContain("d_c");
    // 本地切桶零新请求；复位后既去筛选回全部，也不该冒出带旧 cursor 的请求
    expect(urls().length).toBe(before);
    await clickBucket("全部");
    expect(urls().filter((u) => u.includes("cursor=")).length).toBe(1); // 全程只有那一次 c2 读取，无旧 cursor 重放
    expect(urls().filter((u) => u === P2URL)).toHaveLength(1);
  });

  it("② at the last page: knE-page-more is disabled in place (not hidden), and the cap sentence stays truthful about M", async () => {
    wire(() => Promise.resolve(P2));
    await render(DETAIL);
    await click("knE-page-more"); // 到末页（P2.nextCursor=null）
    const btn = moreBtn();
    expect(btn).toBeTruthy(); // 派工问「disabled 还是隐藏」——实测：在场、disabled、文本改口
    expect(btn?.disabled).toBe(true);
    expect(txt(btn)).toBe("已到末页");
    expect(q("knE-page-end")).toBeTruthy();
    // cap 与末页计数同屏且同源：M=3（已加载全量），上限 50 在场，行数未到上限不出「可能还有更多」
    expect(capText()).toContain("本页最多显示 50 篇（当前已加载 3 篇；复制清单也只含这些篇）");
    expect(q("kn3-page-cap-more")).toBeNull();
    expect(txt(q("knE-page-count"))).toBe("已显示 3 篇 · 总数不可用");
    const mCap = capText().match(/当前已加载 (\d+) 篇/)?.[1];
    expect(mCap).toBe(txt(q("knE-page-count")).match(/已显示 (\d+) 篇/)?.[1]); // 两句读数互等
  });

  it("③ next-page failure keeps rows, shows rid; retry fires EXACTLY one request and it is the next-page URL; success merges by identity", async () => {
    wire(() => fail(500, "数据服务暂时没有响应，请稍后重试。", "rid-r131-500"));
    await render(DETAIL);
    await click("knE-page-more");
    expect(q("knE-page-error")).toBeTruthy();
    expect(container.textContent ?? "").toContain("请求编号：rid-r131-500");
    expect(rowCount()).toBe(2); // 旧行仍在（主测已锁「不受影响」，这里是重试并入的前置在场证）
    const cBefore = urls().length;
    // 错误窗口内不自动重发：静置一拍计数不动
    await act(async () => {});
    expect(urls().length).toBe(cBefore);
    // 换回答后点「重试」：URL 粒度恰 1 次，且就是下一页那条（P1/空间读口不连带）
    wire(() => Promise.resolve(P2));
    const p1Before = urls().filter((u) => u === P1URL).length;
    await click("knE-page-retry");
    const added = urls().slice(cBefore);
    expect(added).toHaveLength(1); // 派工「恰发一次」：整段增量只有 1 条请求
    expect(added[0]).toBe(P2URL);
    expect(urls().filter((u) => u === P1URL).length).toBe(p1Before);
    expect(q("knE-page-error")).toBeNull();
    // 并入的是那条行（身份级断言，非只数数）
    expect(rowCount()).toBe(3);
    expect(rows().some((r) => txt(r).includes("C 说明.txt"))).toBe(true);
  });

  it("④ two-page merged state: knF-copy data rows == visible rows == cap M (and the export family is absent by design)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire(() => Promise.resolve(P2));
    await render(DETAIL);
    await click("knE-page-more");
    await click("knF-copy");
    expect(writeText).toHaveBeenCalledTimes(1);
    const lines = String(writeText.mock.calls[0][0]).split("\n");
    const dataLines = lines.length - 2; // 表头 + 尾换行
    expect(dataLines).toBe(3);
    expect(rowCount()).toBe(dataLines);
    expect(capText()).toContain(`当前已加载 ${dataLines} 篇`);
    expect(q("kn3-docs")?.getAttribute("data-len")).toBe(String(dataLines));
    // 导出族不存在：复制闸门自报 absent（回执贴此命中）——不新增控件，按三值相等口径锁
    const gate = q("kn-gates-knF");
    expect(gate?.getAttribute("data-export")).toBe("absent");
  });
});

/** 桶按钮按标签找。 */
async function clickBucket(label: string) {
  const buttons = [...document.querySelectorAll('[data-testid="kn-type-row"] button')] as HTMLButtonElement[];
  const hit = buttons.find((b) => (b.childNodes[0]?.textContent ?? "").trim() === label);
  expect(hit, `bucket ${label}`).toBeTruthy();
  await act(async () => {
    hit?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {});
}
