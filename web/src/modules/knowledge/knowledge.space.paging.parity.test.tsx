// R242 — 空间详情×全局列表：分页态跨面同源组合帧（纯测试单：零产品改动，未造控件）。
// 名实（硬口径）：**无 ?source= 控件**（source 仅空间行「来源」列标签——派工
// ?type=pdf&source=upload 换算 ?ktype= 族，本轮以深链 ktype 不涉，声明未造控件）；
// 检索面 kn6-search-* **无类型桶/无排序/无分页/无 cap**（knE-page-* 缺席由 R164 收尾例
// 「search face does not paginate」锁死、kn-space-page-cap 不存在由 R187——均引用），
// 故派工腿②「两侧各翻页」不可兑现：只有详情面有 knE-page-*，检索面断言「详情翻页
// 前后行集/data-len/钮序逐字不变」，禁宣称双侧翻页；**无真 CSV 导出族**（R190①:113-119
// 源级不变量）——本单不设导出腿；行钮分面 详情 kn-row-copy-space-<i>/检索 kn-row-copy-<i>
// （R132/R169）；kn-doc-copy 单控件非行数；缺值两口径不涉（全表「—」面引 R204①）；
// 短码大写尾段全 id 仅 title；cursor 只在组件态——从请求 URL 断言；本地动作零新请求
// （R164①:142 密钥集引用）；51 行跨页夹具（R216 先例）；cap 50 常量/M 可变（R108）；
// clip 桩 mockResolvedValue + unstubAllGlobals（R214）。
// 查重（引用不重写）：R213②③④（knowledge.space.parity.test.tsx:135 双器械行集互等、
// :156 **非分页态**跨面行钮文本逐字、:176 详情翻页不牵动检索面 rows/data-len）、
// R228（跨面互不污染内容级）、R229①②、R237①（51 钮全链对**本面**屏上格）、
// R238/R239/R240/R241、R205/R217/R223（逐行链）、R204①（跨面五字段非分页态）、
// R125/R131/R132/R138/R142/R152/R157/R164/R167/R172/R176（R176②⑤：详情 churn→检索
// data-len；R164①:122 注：q 不进详情表）。
// 真正未锁=「**详情面处于第 2 页（51 行）时**」的跨面组合，新增维点名：
//  A. 第 2 页态跨面五字段逐字（含**追加行「卷 51」的跨面入链**——R213③ 系 2 行非分页
//     帧、R237① 链只对本面）；且两面**计数不同帧各异**（详情 50→51 期间检索恒 51——
//     「互不冒充」的非对称取证）；
//  B. 详情 append 后检索面钮**序列 0..50 逐字不动** + 全程 urls 增量恰 [P2URL]
//     （R213④ 只查 rows/data-len，未查钮序与请求增量）；cap 单具在场位；
//  C. **检索面 q 动作反向不牵动详情面**（行名/钮数/cap 整句逐字——R176 是正向 churn
//     →检索位，反向在页 2 态未锁）+ 追加行两族钮串 toBe 同串（R213③ 跨面等值的
//     分页态延伸）+ 两串无裸全 id/undefined 负扫。
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
const detailRows = () => [...document.querySelectorAll('[data-testid="kn3-docs-row"]')];
const hitRows = () => [...document.querySelectorAll('[data-testid="kn6-search-row"]')];
const rowByName = (nodes: Element[], name: string) => nodes.find((r) => (r.textContent ?? "").includes(name)) ?? null;
const detailBtnIds = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')]
    .map((b) => Number((b.getAttribute("data-testid") ?? "").replace(/\D/g, "")))
    .sort((a, b) => a - b);
const hitBtnIds = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-"]')]
    .filter((b) => !(b.getAttribute("data-testid") ?? "").includes("-space-"))
    .map((b) => Number((b.getAttribute("data-testid") ?? "").replace(/\D/g, "")))
    .sort((a, b) => a - b);
const btnOf = (row: Element | null, space: boolean) =>
  row?.querySelector(`button[data-testid^="kn-row-copy${space ? "-space" : ""}-"]`) ?? null;
const cellsOf = (row: Element | null, pfx: "kn3-docs" | "kn6-search") => [
  txt(row?.querySelector(`[data-testid="${pfx}-name"]`)),
  txt(row?.querySelector(`[data-testid="${pfx}-type"]`)),
  txt(row?.querySelector(`[data-testid="${pfx}-size"]`)),
  txt(row?.querySelector(`[data-testid="${pfx}-updated"]`)),
];
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.URL, "createObjectURL", { value: vi.fn(), configurable: true, writable: true });
  return writeText;
};

// 51 行跨页夹具；两面包同一 51 集合（检索面一次全给、不分页——计数非对称的道具）
const page50 = Array.from({ length: 50 }, (_, i) => ({
  documentId: `p1_${String(i + 1).padStart(2, "0")}`,
  fileName: `卷 ${String(i + 1).padStart(2, "0")}.pdf`,
  mimeType: "pdf",
  sizeBytes: 1000 + i,
  updatedAt: `2026-11-1${(i % 9) + 1}T07:00:00Z`,
}));
const ROW51 = { documentId: "p2_51", fileName: "卷 51.pdf", mimeType: "pdf", sizeBytes: 999, updatedAt: "2026-11-10T01:00:00Z" };
const ALL51 = [...page50, ROW51];
const SP = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 51, status: "synced" }] };
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: ALL51 });
    if (url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: page50, nextCursor: "cpg2" });
    if (url === P2URL) return Promise.resolve({ asOf: SP.asOf, documents: [ROW51], nextCursor: null });
    return fail(404, "这个数据接口还没有接入。", "rid-r242-x");
  });

describe("knowledge space-detail × global-list paging parity (R242)", () => {
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

  it("① 新增维A+B：第 2 页态跨面五字段逐字（含追加行入链）+ 两族计数非对称互不冒充 + 检索钮序 0..50 不动、urls 增量恰 [P2URL]", async () => {
    clipStub();
    wire();
    await render(DETAIL);
    // 窗前：详情 50 / 检索恒 51 —— 计数各书其身（非对称取证「互不冒充」）
    expect(Number(q("kn3-docs")?.getAttribute("data-len"))).toBe(50);
    expect(Number(q("kn6-search")?.getAttribute("data-len"))).toBe(51);
    expect(txt(q("kn3-page-cap"))).toContain("当前已加载 50 篇");
    expect(document.querySelectorAll('[data-testid="kn3-page-cap"]').length).toBe(1); // cap 单具（检索面无 cap——knE-page-* 缺席引 R164）
    const hitIds0 = hitBtnIds();
    expect(hitIds0).toEqual(Array.from({ length: 51 }, (_, i) => i));
    const u0 = urls().length;
    await clickNode(q("knE-page-more"), "append");
    expect(urls().length).toBe(u0 + 1); // 增量恰一条
    expect(urls().at(-1)).toBe(P2URL); // cursor 在请求线、只这一条
    expect(Number(q("kn3-docs")?.getAttribute("data-len"))).toBe(51);
    expect(txt(q("kn3-page-cap"))).toContain("当前已加载 51 篇");
    expect(hitBtnIds()).toEqual(hitIds0); // 新增维B：他面 append 不动本面钮序（R213④ 的序位补强）
    // 跨面五字段（既有行 + **追加行卷 51 的跨面入链**）
    for (const name of ["卷 02.pdf", "卷 51.pdf"]) {
      const d = cellsOf(rowByName(detailRows(), name), "kn3-docs");
      const h = cellsOf(rowByName(hitRows(), name), "kn6-search");
      expect(d, name).toEqual(h); // 名/类型/大小/更新 四格跨面逐字
      expect(d[1]).toBe("PDF");
      expect(d[2]).toMatch(/B$/); // 人话大小（非裸字节位另引 R226）
    }
  });

  it("② 新增维C：追加行两族钮串 toBe 同串 + 两串裸全 id/undefined 负扫 + 检索 q 动作反向不牵动详情（行/钮/cap 逐字，页 2 态）", async () => {
    const writeText = clipStub();
    wire();
    await render(DETAIL);
    await clickNode(q("knE-page-more"), "append to 51");
    // 追加行：详情钮 ↔ 检索钮 同串逐字（R213③ 非分页帧的分页态延伸）
    await clickNode(btnOf(rowByName(detailRows(), "卷 51.pdf"), true), "detail row51 btn");
    const detailText = String(writeText.mock.calls[0][0]);
    await clickNode(btnOf(rowByName(hitRows(), "卷 51.pdf"), false), "hit row51 btn");
    const hitText = String(writeText.mock.calls[1][0]);
    expect(hitText).toBe(detailText); // 跨面同文档行钮串 toBe
    const joined = detailText + hitText;
    expect(joined).not.toContain("p2_51"); // 裸全 id 不上串（只进 title——R226① 族）
    expect(joined).not.toMatch(/undefined|null/); // 无 undefined/null 字面
    // 反向帧：检索面本地 q 动作（输入+提交）不牵动详情面 51 行态
    const names0 = detailRows().map((r) => txt(r.querySelector('[data-testid="kn3-docs-name"]')));
    const btns0 = detailBtnIds();
    const cap0 = txt(q("kn3-page-cap"));
    const u0 = urls().length;
    const box = q("kn6-search-input") as HTMLInputElement | null;
    expect(box, "kn6-search-input").toBeTruthy();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(box, "卷 3");
      box?.dispatchEvent(new Event("input", { bubbles: true }));
      box?.closest("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await act(async () => {});
    expect(detailRows().map((r) => txt(r.querySelector('[data-testid="kn3-docs-name"]')))).toEqual(names0); // 详情行集逐字
    expect(detailBtnIds()).toEqual(btns0); // 可复制数==自己表体 且不动（R164①:122「q 不进详情表」的钮位+页 2 态补强）
    expect(txt(q("kn3-page-cap"))).toBe(cap0); // cap 整句逐字
    expect(urls().length).toBe(u0); // q 本地：零新请求
    // 检索面自己收窄为「卷 3x」若干行（本面自书其数——互不冒充的收口位）
    expect(hitRows().length).toBeGreaterThan(0);
    expect(hitRows().length).toBeLessThan(51);
    expect(hitRows().every((r) => (r.textContent ?? "").includes("卷 3"))).toBe(true);
  });

  it("③ 腿④引用位+同帧收紧：两侧各选一行钮文==各自 knF/knG 对应行（链逐面引用 R223/R229①），跨面同文档 toBe——三串同帧互等", async () => {
    const writeText = clipStub();
    wire();
    await render(DETAIL);
    await clickNode(q("knE-page-more"), "append");
    // 同文档「卷 07.pdf」三载体同帧：详情钮串 == 检索钮串 == 详情 knF 行
    await clickNode(btnOf(rowByName(detailRows(), "卷 07.pdf"), true), "d7 btn");
    const btnD = String(writeText.mock.calls[0][0]).split("\n")[1];
    await clickNode(btnOf(rowByName(hitRows(), "卷 07.pdf"), false), "h7 btn");
    const btnH = String(writeText.mock.calls[1][0]).split("\n")[1];
    await clickNode(q("knF-copy"), "knF");
    const fLine = String(writeText.mock.calls[2][0]).split("\n").slice(1, -1).find((l) => l.startsWith("卷 07.pdf"))!;
    expect(btnH).toBe(btnD); // 跨面行钮逐字（分页态帧）
    expect(fLine).toBe(btnD); // 钮==清单行（R223 链在此帧的三方同帧位）
    expect(fLine.split(" | ")).toHaveLength(5); // 5 列形制（引 R200② 不复写）
  });
});
