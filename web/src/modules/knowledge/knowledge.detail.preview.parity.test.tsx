// R219 — 详情×预览跨面同值扩展（纯测试单：零产品改动，未造控件/未造假路由）。
// 名实红线照落：
// 1) 无独立「详情页」——唯一详情面 = 抽屉 kn7-preview-*（?doc=）；「列表行/预览抽屉/详情」
//    映射为四处：列表格(kn3-docs-*) × 抽屉 dd × 行内预览(kn-doc-preview-*/kn-doc-copy) ×
//    行钮（详情面 kn-row-copy-space-<i>）。
// 2) kn-doc-copy 是 DocLineCopy 单控件（行内预览/命中展开内），不作行数。
// 3) ?source= 不存在 → 叠加键 = ?ktype=（旧 type 兜底）× ?q=。
// 4) kn3-page-cap 属详情面（50 常量位/M 可变位），kn9-count-docs 属检索面——不同面互等。
// 5) 缺值两套口径不得统一：表格/复制行「—」，预览/抽屉「该字段未返回」+ per-field title。
// 6) 导出族不存在（createObjectURL/text/csv/download= 0，仅 data-export="absent"）；
//    cursor 只在组件态；短码大写尾段、全 id 仅 title；时间 updatedText。
// 7) clipboard 桩一律返回 Promise（R214 教训）。
// 查重（四腿各自处置，不声称全新发现）：
// · ①六路同帧链 = R204 detail.parity:82-125 已锁（干净单参数态）→ 本文件不重写；
// · ②抽屉开 1/关 0/序列不变 = R196 + R125C:180-207 已锁 → 引用；
// · ③500/404 体+rid+重试 = R183:105-157 + R206(a) + R217④ 已锁 → 引用；
// · ④ktype 深链五值/cap 整句 = R218②、叠加换代 = R207(a) 已锁 → 引用。
// 本单新增维 = 两条「同帧更严组合」：
// (a) **ktype×q 叠加态 + 抽屉开合的同一测试内**：五字段四处链 toBe + cap 整句逐字不变 +
//     钮 id 0..M-1 连续 + 抽屉开合增量恰 [DETAIL]/[] + 筛选动作零请求（此前 R204 只干净态、
//     R218② 只深链无抽屉、R196 只抽屉无叠加——三条件同帧无 pin）；
// (b) **抽屉 500 窗内五字段链仍与列表逐字互等、重试成功后四处链再同步**（R206(a) 只锁复制
//     两串，抽屉 dd 与列表格在错误窗内的同帧互等 + 成功后再同步无 pin）。
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
const DETAIL_A = "/agent-api/api/documents/d_full1";

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
const click = (testid: string) => clickNode(document.querySelector(`[data-testid="${testid}"]`), testid);

const q = (testid: string) => document.querySelector(`[data-testid="${testid}"]`);
const txt = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const rowWith = (name: string) =>
  [...document.querySelectorAll('[data-testid="kn3-docs-row"]')].find((r) => (r.textContent ?? "").includes(name)) ?? null;
const spaceBtnIds = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')]
    .map((b) => Number((b.getAttribute("data-testid") ?? "").replace(/\D/g, "")))
    .sort((a, b) => a - b);
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined); // Promise 桩——R214 教训
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  return writeText;
};
/** 四处五字段采集（抽屉与行内预览互斥 → 顺序采）：返回 map<面, 四字段数组>。 */
async function fourFaces(writeText: ReturnType<typeof vi.fn>, name: string) {
  const row = rowWith(name)!;
  const list = ["name", "type", "size", "updated"].map((c) => txt(row.querySelector(`[data-testid="kn3-docs-${c}"]`)));
  await clickNode(row.querySelector('[data-testid="kn3-docs-name"]'), "open drawer");
  const drawer = ["name", "type", "size", "updated"].map((c) => txt(q(`kn7-preview-field-${c}`)));
  await click("kn7-preview-close");
  await clickNode(row.querySelector('button[data-testid^="kn-row-copy-space-"]'), "row copy");
  const rowLine = String(writeText.mock.calls.at(-1)?.[0] ?? "").split("\n")[1].split(" | ").slice(0, 4);
  await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "inline open");
  const inline = ["name", "type", "size", "updated"].map((c) => txt(q(`kn-doc-preview-${c}`)));
  await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "inline close");
  return { list, drawer, rowLine, inline };
}

const A = { documentId: "d_full1", fileName: "全项手册.pdf", mimeType: "application/pdf", sizeBytes: 2516582, updatedAt: "2026-11-19T07:10:00Z" };
const B = { documentId: "d_b", fileName: "B 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 2, status: "synced" }],
};
const wireDetail = (responder: () => Promise<unknown>) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN || url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP.asOf, documents: [A, B] });
    if (url === DETAIL_A) return responder();
    return fail(404, "这个数据接口还没有接入。", "rid-r219-x");
  });

describe("knowledge detail × preview cross parity, stricter same-frame combos (R219)", () => {
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

  it("(a) 叠加态 ktype=PDF×q=手册 的同一测试内：四处五字段链互等、cap 整句逐字不动、钮 id 连续、抽屉开合增量恰 [DETAIL_A]/[]、全程无多余请求", async () => {
    const writeText = clipStub();
    wireDetail(() => Promise.resolve({ sourceName: "全项手册原件.pdf", status: "indexed" }));
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x&ktype=PDF&q=%E6%89%8B%E5%86%8C");
    // 叠加生效态：详情表只剩 PDF 命中行；cap 整句（M=1）与钮连续
    expect(txt(q("kn3-page-cap"))).toBe("本页最多显示 50 篇（当前已加载 1 篇；复制清单也只含这些篇）");
    expect(spaceBtnIds()).toEqual([0]);
    const capStable = txt(q("kn3-page-cap"));
    // 四处采集（同帧顺序，互斥面按 R67 规矩开合）
    const faces = await fourFaces(writeText, "全项手册.pdf");
    expect(faces.list).toEqual(["全项手册.pdf", "PDF", "2.4 MB", "2026-11-19 15:10"]);
    expect(faces.drawer).toEqual(faces.list);
    expect(faces.rowLine).toEqual(faces.list);
    expect(faces.inline).toEqual(faces.list);
    // cap 句在开合与复制全程逐字不变（计数不被详情链牵动）
    expect(txt(q("kn3-page-cap"))).toBe(capStable);
    // 请求契约当帧复测：详情读=抽屉开次数、列表读=恰 1、无任何 cursor= 请求
    expect(urls().filter((u) => u === DETAIL_A)).toHaveLength(1);
    expect(urls().filter((u) => u === docsUrlFor("sp_x"))).toHaveLength(1);
    expect(urls().some((u) => u.includes("cursor="))).toBe(false);
    // 再开再关：增量恰 [DETAIL_A] 与 []
    const c0 = urls().length;
    await clickNode(rowWith("全项手册.pdf")?.querySelector('[data-testid="kn3-docs-name"]'), "reopen drawer");
    expect(urls().slice(c0)).toEqual([DETAIL_A]);
    const c1 = urls().length;
    await click("kn7-preview-close");
    expect(urls().length).toBe(c1);
    // 关后行序与钮序列仍逐字不变
    expect(spaceBtnIds()).toEqual([0]);
  });

  it("(b) 抽屉 500 错误窗内四处五字段仍与干净样张互等、cap 在、钮 id 不动、rid 可复制；重试成功后四处链再同步", async () => {
    const writeText = clipStub();
    let ok = false;
    wireDetail(() =>
      ok
        ? Promise.resolve({ sourceName: "全项手册原件.pdf", status: "indexed" })
        : fail(500, "数据服务暂时没有响应，请稍后重试。", "rid-r219-500"),
    );
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x&doc=d_full1");
    const row = rowWith("全项手册.pdf")!;
    expect(q("kn7-preview-error")).toBeTruthy(); // 抽屉开、错误锚在场
    expect(document.body.textContent ?? "").toContain("请求编号：rid-r219-500"); // 抽屉是 portal，挂 body
    // 错误窗内：列表四格 × 抽屉 dd 同帧互等（dd 字段来自已载行，错误不污染）
    const list = ["name", "type", "size", "updated"].map((c) => txt(row.querySelector(`[data-testid="kn3-docs-${c}"]`)));
    expect(list).toEqual(["全项手册.pdf", "PDF", "2.4 MB", "2026-11-19 15:10"]);
    const drawer = ["name", "type", "size", "updated"].map((c) => txt(q(`kn7-preview-field-${c}`)));
    expect(drawer).toEqual(list);
    // rid 可复制：writeText 恰收该 rid（此时抽屉仍开）
    const ridBtn = q("kn7-preview-error")?.querySelector('button[aria-label="复制请求编号"]');
    expect(ridBtn).toBeTruthy();
    writeText.mockClear();
    await clickNode(ridBtn, "copy rid");
    expect(writeText).toHaveBeenCalledWith("rid-r219-500");
    // 关抽屉后采另两处：行钮串与行内预览四格仍与样张互等；cap/钮 id 全程不动
    await click("kn7-preview-close");
    await clickNode(row.querySelector('button[data-testid^="kn-row-copy-space-"]'), "row copy in error window");
    expect(String(writeText.mock.calls.at(-1)?.[0] ?? "").split("\n")[1].split(" | ").slice(0, 4)).toEqual(list);
    await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "inline open");
    const inline = ["name", "type", "size", "updated"].map((c) => txt(q(`kn-doc-preview-${c}`)));
    expect(inline).toEqual(list);
    await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "inline close");
    expect(txt(q("kn3-page-cap"))).toBe("本页最多显示 50 篇（当前已加载 2 篇；复制清单也只含这些篇）");
    expect(spaceBtnIds()).toEqual([0, 1]);
    // 重开抽屉（再次 500，error 锚复现）→ 换 ok → 重试增量恰 [DETAIL_A]、成功后内容就位、四值再同步
    await clickNode(row.querySelector('[data-testid="kn3-docs-name"]'), "reopen drawer");
    const errNow = q("kn7-preview-error");
    expect(errNow).toBeTruthy();
    ok = true;
    const c0 = urls().length;
    await clickNode(errNow?.querySelector('[data-testid="kn7-preview-retry"]'), "retry");
    expect(urls().slice(c0)).toEqual([DETAIL_A]); // 重试只发详情读一条
    expect(q("kn7-preview-error")).toBeNull();
    expect(txt(q("kn7-preview-field-source"))).toContain("全项手册原件.pdf"); // 成功后详情内容就位
    expect(spaceBtnIds()).toEqual([0, 1]);
    expect(txt(q("kn3-page-cap"))).toBe("本页最多显示 50 篇（当前已加载 2 篇；复制清单也只含这些篇）");
  });
});
