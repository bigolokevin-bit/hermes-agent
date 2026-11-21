// R217 — 预览/详情同帧 parity 护栏（纯测试单：零产品改动）。
// 名实换算（先 grep 后写，按产品现状，禁改产品）：
// · 本模块**没有独立"详情页"路由**——唯一详情面 = 遮罩抽屉 kn7-preview-*（?doc=，
//   kn7-preview-panel/title）。派工"预览抽屉与详情页"是同一面；对照腿落到真实四处：
//   抽屉 dd × 空间详情列表格（kn3-docs-*）× 行级钮（详情面 kn-row-copy-space-<i>）×
//   kn-doc-copy 单控件（行内预览/命中展开内，非行数）。
// · 缺值两套口径是产品现实：表格/复制行「—」，预览/抽屉 previewField「该字段未返回」
//   + 逐字段 title（R70/R125 定版）——禁统一。
// · 导出族不存在（createObjectURL/text/csv/download= 0，仅 data-export="absent"）；
//   无 ?source= 控件。时间单点 updatedText；短码大写尾段、全 id 仅 title。
// 查重（引用不重写）：R204 knowledge.detail.parity.test.tsx ①:82-125（六路 toBe 链+样张）
//   /②:127-178（两套缺值句收口）；R196（抽屉开 1 关 0、行序/钮序列不变、标题随换）；
//   R183/R206（详情 500/404 句+rid+不卸载+复制串不污染+dl title）；R125C/R149（计数契约）；
//   R213/R215/R216（跨面/分页链）。
// 新增维=（a）**抽屉 404 错误态下行内预览仍可用且五字段与干净态逐字相同**：R206 只锁了
//   500 窗内复制串相等；404 + 关抽屉→开行内预览→五字段两套口径逐字 + 行序/`-space-` 钮
//   序列逐字不变，此前无 pin。本文件四腿均有可执行断言，①②③为同帧基线（引用他处锁过
//   的语义在此整体复跑，不声称新发现），④承载新增维。
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
const RID_404 = "rid-r217-gone";

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
const detailOrder = () =>
  [...document.querySelectorAll('[data-testid="kn3-docs-row"] [data-testid="kn3-docs-name"]')].map((n) => txt(n));
const spaceBtnIds = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')]
    .map((b) => Number((b.getAttribute("data-testid") ?? "").replace(/\D/g, "")))
    .sort((a, b) => a - b);

const D_FULL = { documentId: "d_full1", fileName: "全项手册.pdf", mimeType: "application/pdf", sizeBytes: 2516582, updatedAt: "2026-11-19T07:10:00Z" };
const D_MISS = { documentId: "d_miss9", fileName: "缺项档" };
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 2, status: "synced" }],
};
const wire = (detailResponder: () => Promise<unknown>) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN || url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP.asOf, documents: [D_FULL, D_MISS] });
    if (url === DETAIL_A) return detailResponder();
    return fail(404, "这个数据接口还没有接入。", "rid-r217-x");
  });
const okDetail = () => Promise.resolve({ sourceName: "全项手册原件.pdf", status: "indexed" });
const goneDetail = () => fail(404, "这个数据接口还没有接入。", RID_404);
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined); // Promise 桩——R214 教训：裸 vi.fn() 让产品 .then 抛 unhandled
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  return writeText;
};
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

describe("knowledge preview/detail same-frame parity (R217)", () => {
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

  it("① 五字段逐字四处：列表格 == 抽屉 dd == 行钮列 == kn-doc-copy 列（短码列 + title 全 id、正文无裸 id）", async () => {
    const writeText = clipStub();
    wire(okDetail);
    await render(DETAIL);
    const row = rowWith("全项手册.pdf")!;
    const cells = {
      name: txt(row.querySelector('[data-testid="kn3-docs-name"]')),
      type: txt(row.querySelector('[data-testid="kn3-docs-type"]')),
      size: txt(row.querySelector('[data-testid="kn3-docs-size"]')),
      updated: txt(row.querySelector('[data-testid="kn3-docs-updated"]')),
    };
    expect(Object.values(cells)).toEqual(["全项手册.pdf", "PDF", "2.4 MB", "2026-11-19 15:10"]);
    // 抽屉（点行名开；与行内预览互斥 → 顺序采集）
    await clickNode(row.querySelector('[data-testid="kn3-docs-name"]'), "open drawer");
    for (const [dd, val] of [
      ["kn7-preview-field-name", cells.name],
      ["kn7-preview-field-type", cells.type],
      ["kn7-preview-field-size", cells.size],
      ["kn7-preview-field-updated", cells.updated],
    ] as const) {
      expect(txt(q(dd)), dd).toBe(val);
    }
    expect(q("kn3-docs-detail")?.getAttribute("title")).toBe("d_full1");
    await click("kn7-preview-close");
    // 行钮与 kn-doc-copy 的列
    await clickNode(row.querySelector('button[data-testid^="kn-row-copy-space-"]'), "row copy");
    const lineCols = String(writeText.mock.calls[0][0]).split("\n")[1].split(" | ");
    expect(lineCols).toEqual([cells.name, cells.type, cells.size, cells.updated, "DFULL1"]); // 短码列
    await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "inline preview");
    await click("kn-doc-copy");
    expect(String(writeText.mock.calls[1][0])).toBe(String(writeText.mock.calls[0][0]));
    expect(txt(row)).not.toContain("d_full1");
    expect(txt(row)).not.toContain("DFULL1"); // 短码与全 id 都不在正文（R204 同口径的当帧复跑）
  });

  it("② 缺值两套口径同帧：表格/复制行「—」，行内预览与抽屉「该字段未返回」+ 逐字段 title；全页禁 undefined/null/裸 id", async () => {
    clipStub();
    wire(okDetail);
    await render(DETAIL);
    const row = rowWith("缺项档")!;
    for (const col of ["type", "size", "updated"] as const) {
      expect(txt(row.querySelector(`[data-testid="kn3-docs-${col}"]`)), col).toBe("—");
    }
    await clickNode(row.querySelector('button[data-testid^="kn-row-copy-space-"]'), "row copy miss");
    await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "inline preview");
    for (const dd of ["kn-doc-preview-type", "kn-doc-preview-size", "kn-doc-preview-updated"]) {
      expect(txt(q(dd)), dd).toBe("该字段未返回");
      expect(q(dd)?.getAttribute("title") ?? "", dd).toContain("："); // 「<字段>：<原因>」句式
    }
    expect(q("kn-doc-preview-updated")?.getAttribute("title")).toBe("更新：上游没有给出更新时间");
    await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "close preview");
    await clickNode(row.querySelector('[data-testid="kn3-docs-name"]'), "open drawer");
    expect(txt(q("kn7-preview-field-type"))).toBe("该字段未返回");
    expect(q("kn7-preview-field-type")?.getAttribute("title")).toBe("类型：上游没有给出文档类型");
    expect(q("kn3-docs-detail")?.getAttribute("title")).toBe("d_miss9");
    await click("kn7-preview-close");
    expect(document.body.textContent ?? "").not.toMatch(/\bundefined\b|\bnull\b|d_full1|d_miss9/);
  });

  it("③ 开抽屉恰 +1 次该文档详情读、列表腿与行内预览腿零增量、关抽屉零增量（同帧计数，列表读如实报数不宣称 0）", async () => {
    clipStub();
    wire(okDetail);
    await render(DETAIL);
    const listReads0 = urls().filter((u) => u === docsUrlFor("sp_x")).length;
    expect(listReads0).toBe(1); // 首屏列表读恰 1 次（既有口径，当帧复测）
    const c0 = urls().length;
    await clickNode(rowWith("全项手册.pdf")?.querySelector('[data-testid="kn3-docs-name"]'), "open drawer");
    expect(urls().slice(c0)).toEqual([DETAIL_A]); // 抽屉开 = 恰 1 详情读
    expect(urls().filter((u) => u === docsUrlFor("sp_x")).length).toBe(listReads0); // 列表腿零重取
    const row = rowWith("全项手册.pdf")!;
    await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "inline open (closes drawer, R67)");
    await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "inline close");
    expect(urls().length).toBe(c0 + 1); // 行内预览开合零增量
    await clickNode(row.querySelector('[data-testid="kn3-docs-name"]'), "reopen drawer");
    const c1 = urls().length;
    await click("kn7-preview-close");
    expect(urls().length).toBe(c1); // 关抽屉零增量
  });

  it("④ 详情 404：可读句+rid 可复制（writeText 恰收 rid）；列表行序与 -space- 钮序列逐字不变；新增维(a)= 关抽屉后行内预览仍可用、五字段与干净态逐字相同", async () => {
    const writeText = clipStub();
    // 干净态样张（先行采集，R206 只锁 500 窗复制串——404 + 预览可用是新维）
    wire(okDetail);
    await render(DETAIL);
    const row0 = rowWith("全项手册.pdf")!;
    await clickNode(row0.querySelector('button[data-testid^="kn-row-copy-space-"]'), "clean row copy");
    const cleanLine = String(writeText.mock.calls[0][0]);
    await clickNode(row0.querySelector('[data-testid="kn-doc-preview-toggle"]'), "clean inline open");
    const cleanFields = ["name", "type", "size", "updated"].map((c) => txt(q(`kn-doc-preview-${c}`)));
    const cleanCode = txt(q("kn-doc-preview-code"));
    await clickNode(row0.querySelector('[data-testid="kn-doc-preview-toggle"]'), "clean inline close");

    // 404 错误态
    wire(goneDetail);
    await render(`${DETAIL}&doc=d_full1`);
    expect(q("kn7-preview-unwired")).toBeTruthy();
    expect(txt(q("kn7-preview-unwired"))).toContain("文档详情未接入");
    expect(document.body.textContent ?? "").toContain(`请求编号：${RID_404}`);
    const ridBtn = q("kn7-preview-unwired")?.querySelector('button[aria-label="复制请求编号"]');
    expect(ridBtn).toBeTruthy();
    writeText.mockClear();
    await clickNode(ridBtn, "copy rid");
    expect(writeText).toHaveBeenCalledWith(RID_404);
    // 列表侧不受牵连：行数、行序、钮序列逐字不变
    expect(detailOrder()).toEqual(["全项手册.pdf", "缺项档"]);
    expect(spaceBtnIds()).toEqual([0, 1]);
    expect(q("kn3-page-cap")).toBeTruthy();
    // 新增维(a)：关抽屉→行内预览照常可用，五字段（含两套口径）与干净态逐字相同、复制串逐字等
    await click("kn7-preview-close");
    const row = rowWith("全项手册.pdf")!;
    await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "inline open in 404 aftermath");
    expect(q("kn-doc-preview")).toBeTruthy();
    expect(["name", "type", "size", "updated"].map((c) => txt(q(`kn-doc-preview-${c}`)))).toEqual(cleanFields);
    expect(txt(q("kn-doc-preview-code"))).toBe(cleanCode);
    writeText.mockClear();
    await click("kn-doc-copy");
    expect(String(writeText.mock.calls[0][0])).toBe(cleanLine);
  });
});
