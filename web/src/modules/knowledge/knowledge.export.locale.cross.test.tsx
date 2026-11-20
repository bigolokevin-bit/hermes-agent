// R234 — 人话标签导出侧负扫 × 三叠加同帧三值 × 筛空态现状（纯测试单：零产品改动）。
// 名实换算（产品定版，禁造控件/禁改产品）：
// · 无真 CSV（createObjectURL/text/csv/a.download/new Blob 源级 0，仅 data-export=
//   "absent"——R190①:113-119）→「导出 CSV」= knF-copy 数据行（详情面 5 列）/knG-copy
//   （检索面 6 列，所属空间@2——R71/R200②）；本轮 createObjectURL spy 全程 0。
// · **无 ?source= 控件**（source 仅空间行「来源」列标签）→ 派工「?type=&source= 叠加」
//   换算为 ?ktype=（真实键，旧 type 只读兜底——:3549-3551）× 本地名筛 × ?q= 三叠加。
// · 派工①「缺值 CSV 空字段 vs 屏上『—』」的**第二口径不存在**：两产物共用 docLine
//   单一实现（R214②/R226②锁互等、R233 抽屉双载体再锁）→ 按现状断言「—」并在此记录
//   该差异，禁伪造第二口径。
// · 派工③「cap 显 0」不可兑现：true-0/error/拒绝/非法枚举 cap 不渲染（R108/R157/
//   R187/R231②）；本轮补测**筛空但已加载>0** 帧的 cap 现状（R229③未查位，按实测锁）。
// 查重（引用不重写）：R226①（列表×行钮×knF 三载体逐字+表体裸值负扫——**导出串全文
// 未扫**）、R227④⑤（image/* 族与 text/plain 现状+进位边界）、R214②/R220（列头/列序）、
// R157③④（ktype×q 两叠加四值链——**名筛三叠加未入链**）、R164①②（密钥集/清全键）、
// R231②（真 0 帧门+裸 0 扫描 :111）、R229③（分页帧筛空数字位）、R233（抽屉侧负扫）、
// R132/R169（钮族分面）、R190/R230/R232。
// 新增维（点名）：
//  A. **导出串全文负向裸值扫描**：knF 与 knG 两份剪贴板全文对 application/*、image/*、
//     ≥4 位裸字节（1234567 样张）0 命中 + docx/json/csv 新族标签「导出侧==屏上格」逐字
//     （R226 样张族为 pdf/xlsx/unknown，三新族首次跨到导出串）；
//  B. **ktype×名筛×q 三叠加同帧**：详情面三值 [表体==-space- 钮==knF 行] 且行名集
//     恰为 ktype∩名筛 交（按标识点名）、检索面三值独立不互染、全程 urls 快照逐字；
//  C. 三叠加态再筛空：knF disabled +「本地筛选没有留下行」×检索面（?q=）健康对照 +
//     cap 现状按实入锁 + 裸 0 扫描 + 零写零请求。
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
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

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
const rowNodes = () => [...document.querySelectorAll('[data-testid="kn3-docs-row"]')];
const rowNames = () => rowNodes().map((r) => txt(r.querySelector('[data-testid="kn3-docs-name"]')));
const spaceBtns = () => document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length;
const hitNodes = () => [...document.querySelectorAll('[data-testid="kn6-search-row"]')];
const hitNames = () => hitNodes().map((r) => txt(r.querySelector('[data-testid="kn6-search-name"]')));
const hitBtns = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-"]')]
    .filter((b) => !(b.getAttribute("data-testid") ?? "").includes("-space-")).length;
const dataLines = (text: string) => text.split("\n").slice(1, -1);
const cellType = (name: string) =>
  txt(rowNodes().find((r) => (r.textContent ?? "").includes(name))?.querySelector('[data-testid="kn3-docs-type"]'));
const cellSize = (name: string) =>
  txt(rowNodes().find((r) => (r.textContent ?? "").includes(name))?.querySelector('[data-testid="kn3-docs-size"]'));
const typeIn = async (value: string) => {
  const el = q("kn3-docs-filter-input") as HTMLInputElement | null;
  expect(el, "kn3-docs-filter-input").toBeTruthy();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, value);
    el?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {});
};
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  const createObjectUrl = vi.fn();
  Object.defineProperty(window.URL, "createObjectURL", { value: createObjectUrl, configurable: true, writable: true });
  return { writeText, createObjectUrl };
};

// 样张族：docx/json/csv（R226/R227 未跨导出串的三族）+ 裸字节样张 1234567
const DOCS = [
  { documentId: "d_a1", fileName: "人事手册A.pdf", mimeType: "application/pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" },
  { documentId: "d_a2", fileName: "人事手册B.pdf", mimeType: "application/pdf", sizeBytes: 4096, updatedAt: "2026-11-19T06:30:00Z" },
  { documentId: "d_c", fileName: "运维手册C.docx", mimeType: "docx", sizeBytes: 8192, updatedAt: "2026-11-19T06:00:00Z" },
  { documentId: "d_j", fileName: "人事记录.json", mimeType: "json", sizeBytes: 512, updatedAt: "2026-11-19T05:30:00Z" },
  { documentId: "d_s", fileName: "预算表.csv", mimeType: "text/csv", sizeBytes: 1234567, updatedAt: "2026-11-19T05:00:00Z" },
];
const SP = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "人事空间", docCount: DOCS.length, status: "synced" }] };
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN || url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: DOCS });
    return fail(404, "这个数据接口还没有接入。", "rid-r234-x");
  });

describe("knowledge export locale cross guards (R234)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("① 新族标签三载体逐字（导出串==屏上格，行钮形制引 R226 不复写）+ 新增维A：knF/knG 两份剪贴板全文裸 MIME/裸字节负扫", async () => {
    const { writeText, createObjectUrl } = clipStub();
    wire();
    await render(DETAIL);
    await clickNode(q("knF-copy"), "knF all");
    const fText = String(writeText.mock.calls[0][0]);
    const f = (name: string) => dataLines(fText).find((l) => l.startsWith(name))!.split(" | ");
    // docx/json/csv 三新族：屏上格 == 导出串逐字（人话单源 docTypeLabel，R227 现状族不重复）
    expect(cellType("运维手册C.docx")).toBe("Word 文档");
    expect(f("运维手册C.docx")[1]).toBe(cellType("运维手册C.docx"));
    expect(cellType("人事记录.json")).toBe("结构化数据");
    expect(f("人事记录.json")[1]).toBe(cellType("人事记录.json"));
    expect(cellType("预算表.csv")).toBe("表格（CSV）");
    expect(f("预算表.csv")[1]).toBe(cellType("预算表.csv"));
    expect(f("预算表.csv")[2]).toBe(cellSize("预算表.csv")); // 大小人话互等
    expect(f("预算表.csv")[2]).toBe("1.2 MB"); // 1234567 的人话位
    // 新增维A：导出串全文负扫（两 carrier 全串，非仅表体——R226①-a 是可见层地盘）
    await clickNode(q("knG-copy"), "knG all");
    const gText = String(writeText.mock.calls[1][0]);
    for (const text of [fText, gText]) {
      expect(text).not.toMatch(/application\/[a-z0-9.+-]+/i);
      expect(text).not.toMatch(/image\/[a-z0-9.+-]+/i);
      expect(text).not.toMatch(/text\/[a-z0-9.+-]+/i);
      expect(text).not.toContain("1234567"); // 裸字节不入导出串（只许进 title——格 title 断言引 R226）
    }
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it("② 新增维B：?ktype=PDF ×名筛「手册」×?q=人事 三叠加同帧——详情面三值且行名恰交集、检索面三值独立、全程零请求", async () => {
    const { writeText, createObjectUrl } = clipStub();
    wire();
    await render(`${DETAIL}&q=${encodeURIComponent("人事")}&ktype=${encodeURIComponent("PDF")}`);
    const u0 = urls().join("|"); // 首屏三次读为既有基线；被测的是叠加段的零新增
    expect(urls()).toHaveLength(3); // spaces + plain + p1（无第四读）
    await typeIn("手册");
    const names = rowNames();
    expect(names).toEqual(["人事手册A.pdf", "人事手册B.pdf"]); // 恰 ktype∩名筛 交（q 不进详情表——R164①:122 口径引用）
    await clickNode(q("knF-copy"), "knF triple");
    const lines = dataLines(String(writeText.mock.calls[0][0]));
    expect([names.length, spaceBtns(), lines.length]).toEqual([2, 2, 2]); // 同帧三值
    expect(lines.map((l) => l.split(" | ")[0])).toEqual(names); // 行名集==屏上序
    // 检索面独立帧：只吃 q（名筛属详情面——面界按实）；q=人事 命中 A/B/json 三行
    expect(hitNames()).toEqual(expect.arrayContaining(["人事手册A.pdf", "人事手册B.pdf", "人事记录.json"]));
    expect([hitNames().length, hitBtns()]).toEqual([3, 3]);
    await clickNode(q("knG-copy"), "knG triple");
    expect(dataLines(String(writeText.mock.calls[1][0])).map((l) => l.split(" | ")[0])).toEqual(hitNames());
    expect(urls().join("|")).toBe(u0); // 三叠加全本地：零新请求（读口密钥集引 R164①:142）
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it("③ 新增维C：三叠加再筛空——knF disabled+「本地筛选没有留下行」×检索面健康对照×cap 现状按实×裸 0 扫描×零写零请求", async () => {
    const { writeText, createObjectUrl } = clipStub();
    wire();
    await render(`${DETAIL}&q=${encodeURIComponent("人事")}&ktype=${encodeURIComponent("PDF")}`);
    await typeIn("手册");
    const capMid = q("kn3-page-cap"); // 筛中帧（2/5 行）cap 现状快照
    await typeIn("火星不存在");
    expect(rowNames()).toEqual([]); // 名筛清零（ktype 在场）
    const btn = q("knF-copy") as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(true);
    expect(btn?.getAttribute("title")).toContain("本地筛选没有留下行"); // 单页/分页版已锁（主套件 :3885/R229③），本帧为**叠加态**版
    const cap = q("kn3-page-cap"); // 筛空帧 cap 现状（R229③ 未查位，按实测入锁）
    if (cap) expect(txt(cap)).toBe(txt(capMid)); // 在场：M 取已加载非可见 → 逐字不动
    else expect(capMid).toBeTruthy(); // 缺席：筛中帧须在场过（两分支皆钉死现状，不留空转）
    expect(container.textContent ?? "").not.toMatch(/(^|[^0-9.])0\s*(条|篇|个)/); // 禁裸 0（R215②:111 同法）
    // 检索面健康对照：详情面筛空不拖染 q 面（面隔离在筛空态版）
    expect(hitNames()).toEqual(["人事手册A.pdf", "人事手册B.pdf", "人事记录.json"]);
    expect((q("knG-copy") as HTMLButtonElement | null)?.disabled).toBe(false);
    const c0 = urls().length;
    await clickNode(btn, "click empty knF");
    expect(writeText).not.toHaveBeenCalled();
    expect(urls().length).toBe(c0);
    expect(createObjectUrl).not.toHaveBeenCalled();
  });
});
