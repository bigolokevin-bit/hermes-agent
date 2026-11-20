// R204 — 文档详情字段四面同源护栏（纯测试单：零产品改动）。
// 面与族实测（先 grep 后写）：分页面=空间详情，行复制族 `kn-row-copy-space-<i>`
// （`kn-row-copy-<i>` 属检索面）；`kn-doc-copy`=DocLineCopy 单控件（行内预览/命中展开内，
// 非行级）；抽屉=`kn7-preview-*`（?doc=）。**互斥事实**：R67 设计下抽屉与行内预览不同时
// 在场（开一个静默关另一个）——「四面同框」落实为同一用例内**顺序采集**四面读数再对账，
// 本注释即名实记录。
// 查重（引用不重写）：
// · 腿③——R196 knowledge.preview.requests.test.tsx（打开恰 1 详情读、关 0、行序/钮 id
//   原样、标题随换）+ R125C（开关计数快照）已锁 → 引用；
// · 腿④——R183 knowledge.detail.error.test.tsx（404/500 可读句、请求编号：rid-…、
//   列表行与 kn3-page-cap 不卸载、空态锚互斥、重试恰 +1）已锁 → 引用；
// · R70/R125 kn.parity + knowledge.parity（列表/检索/两预览/抽屉的 DOM 同值与缺值句）、
//   R114（行钮==kn-doc-copy 同串）、R200（复制列↔屏上列逐格）各自锁了半边。
// 真缺口（本文件 2 例）：同一文档把 **列表格 × 抽屉 dd × 行钮文本 × kn-doc-copy 文本**
// 四路读数接成一条 toBe 链（含短码列与全 id 仅在 title 的落点），以及缺值行四面
// 「两种句式（表格/复制「—」 vs 预览/抽屉「该字段未返回」）」的同案对账。
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
import { DOC_LINE_HEADER, shortId } from "./knowledge";

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

async function clickNode(node: Element | null | undefined, label: string) {
  expect(node, label).toBeTruthy();
  await act(async () => {
    (node as Element).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {});
}

const q = (testid: string) => document.querySelector(`[data-testid="${testid}"]`);
const txt = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const rowWith = (name: string) =>
  [...document.querySelectorAll('[data-testid="kn3-docs-row"]')].find((r) => (r.textContent ?? "").includes(name)) ?? null;
const cellText = (row: Element, col: "name" | "type" | "size" | "updated") =>
  txt(row.querySelector(`[data-testid="kn3-docs-${col}"]`));

const D_FULL = { documentId: "d_full1", fileName: "全项手册.pdf", mimeType: "application/pdf", sizeBytes: 2516582, updatedAt: "2026-11-19T07:10:00Z" };
const D_MISS = { documentId: "d_miss9", fileName: "缺项档" };
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 2, status: "synced" }],
};
const wire = (docs: unknown[]) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: docs });
    if (url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP.asOf, documents: docs });
    if (url.startsWith("/agent-api/api/documents/d_")) return fail(404, "文档详情未接入。", "rid-r204-d");
    return fail(404, "这个数据接口还没有接入。", "rid-r204");
  });
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

describe("knowledge detail field four-way parity (R204, gap-only)", () => {
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

  it("① one document, four surfaces in one chain: list cells == drawer dd == row-copy line == kn-doc-copy line, field by field toBe", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire([D_FULL, D_MISS]);
    await render(DETAIL);
    const row = rowWith("全项手册.pdf")!;
    const idx = [...container.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')].indexOf(
      row.querySelector('button[data-testid^="kn-row-copy-space-"]') as HTMLButtonElement,
    );
    // (a) 抽屉四面之一：点行名开抽屉，读 dd 四格与 dl title（全 id 位）
    await clickNode(row.querySelector('[data-testid="kn3-docs-name"]'), "open drawer");
    expect(q("kn7-preview-panel")).toBeTruthy();
    expect(txt(q("kn7-preview-field-name"))).toBe(cellText(row, "name"));
    expect(txt(q("kn7-preview-field-type"))).toBe(cellText(row, "type"));
    expect(txt(q("kn7-preview-field-size"))).toBe(cellText(row, "size"));
    expect(txt(q("kn7-preview-field-updated"))).toBe(cellText(row, "updated"));
    expect(q("kn3-docs-detail")?.getAttribute("title")).toBe("d_full1"); // 全 id 只在抽屉 dl title
    await clickNode(q("kn7-preview-close"), "close drawer"); // R67 互斥：关抽屉才能开行内预览
    // (b) 行钮文本逐列 == 屏上格 + 短码列
    await clickNode(container.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')[idx], "row copy");
    const line = String(writeText.mock.calls[0][0]);
    expect(line.split("\n")[0]).toBe(DOC_LINE_HEADER.join(" | "));
    const fields = line.split("\n")[1].split(" | ");
    expect(fields[0]).toBe(cellText(row, "name"));
    expect(fields[1]).toBe(cellText(row, "type"));
    expect(fields[2]).toBe(cellText(row, "size"));
    expect(fields[3]).toBe(cellText(row, "updated"));
    expect(fields[4]).toBe(shortId("d_full1")); // 短码=大写尾段，仅此列在复制文本
    // (c) kn-doc-copy（行内预览单控件）与行钮同串（R114 链在本案内再续）
    await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "inline preview");
    await clickNode(q("kn-doc-copy"), "doc copy");
    expect(String(writeText.mock.calls[1][0])).toBe(line);
    // 逐字样张锁（漂移即红）：
    expect(fields).toEqual(["全项手册.pdf", "PDF", "2.4 MB", "2026-11-19 15:10", "DFULL1"]);
    // 屏上无裸 id / 无短码正文 / 无 undefined-null
    expect(txt(row)).not.toContain("d_full1");
    expect(txt(row)).not.toContain("DFULL1");
    expect(document.body.textContent ?? "").not.toMatch(/\bundefined\b|\bnull\b/);
  });

  it("② missing fields keep the two registered wordings across the four surfaces: table/copy 「—」 vs preview/drawer 「该字段未返回」+ per-field title", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire([D_FULL, D_MISS]);
    await render(DETAIL);
    const row = rowWith("缺项档")!;
    // 表格三列「—」；行钮复制同三列「—」
    expect(cellText(row, "type")).toBe("—");
    expect(cellText(row, "size")).toBe("—");
    expect(cellText(row, "updated")).toBe("—");
    const btn = row.querySelector('button[data-testid^="kn-row-copy-space-"]');
    await clickNode(btn, "row copy missing");
    const fields = String(writeText.mock.calls[0][0]).split("\n")[1].split(" | ");
    expect(fields.slice(1, 4)).toEqual(["—", "—", "—"]);
    expect(fields[4]).toBe(shortId("d_miss9"));
    // 行内预览：previewField 句式（R70）——「该字段未返回」+「<字段>：<原因>」
    await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "inline preview");
    expect(txt(q("kn-doc-preview-type"))).toBe("该字段未返回");
    expect(q("kn-doc-preview-type")?.getAttribute("title")).toContain("类型：");
    expect(txt(q("kn-doc-preview-updated"))).toBe("该字段未返回");
    expect(q("kn-doc-preview-updated")?.getAttribute("title")).toContain("更新：");
    await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "close preview");
    // 抽屉：同 previewField 句式（R125 修复后四面两式定版——本案收口对账）
    await clickNode(row.querySelector('[data-testid="kn3-docs-name"]'), "open drawer");
    expect(txt(q("kn7-preview-field-type"))).toBe("该字段未返回");
    expect(q("kn7-preview-field-type")?.getAttribute("title")).toBe("类型：上游没有给出文档类型");
    // 两式之间：预览句式 == 抽屉句式（逐字段），表格句式 == 复制句式
    expect(txt(q("kn7-preview-field-updated"))).toBe("该字段未返回");
    expect(q("kn7-preview-field-updated")?.getAttribute("title")).toBe("更新：上游没有给出更新时间");
    expect(q("kn3-docs-detail")?.getAttribute("title")).toBe("d_miss9"); // 全 id 只在抽屉 dl title（关闭前采）
    await clickNode(q("kn7-preview-close"), "close drawer");
    // 屏上无 undefined/null/裸 id
    expect(document.body.textContent ?? "").not.toMatch(/\bundefined\b|\bnull\b|d_miss9/);
  });
});
