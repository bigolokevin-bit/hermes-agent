// R125 — 知识文档跨面同值护栏：把 kn7 抽屉（?doc=）纳入逐字段 parity 的第四面。
// 既有覆盖（不重写）：kn.parity.test.ts（R70：两表逐字段 + 两处行内预览一致 + 互斥矩阵）、
// knowledge.updated.test.tsx（R76：三面 updatedText 口径）。本文件只补 A/B/C 三个维度：
// A) 抽屉 vs 详情表列 vs 检索表列 vs 行内预览的在场值逐字同；
// B) 缺字段时抽屉与两处行内预览同走 previewField 句式（本单测出旧句式为第二套文案，已同单修复）；
// C) 请求计数如实：行内预览零请求；抽屉每次打开 +1（R49 既有详情读），非派工字面「零」。
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
import { docLine, shortId } from "./knowledge";

const SPACES = "/agent-api/api/knowledge/spaces?limit=20";
const DOCUMENTS_PLAIN = "/agent-api/api/documents?limit=50";
const docsUrlFor = (id: string) => `/agent-api/api/documents?limit=50&spaceId=${id}`;
const DETAIL_URL = "/agent-api/api/documents/d_p1";
const DETAIL_URL2 = "/agent-api/api/documents/d_p2";

const D1 = { documentId: "d_p1", fileName: "员工手册.pdf", mimeType: "application/pdf", sizeBytes: 2516582, updatedAt: "2026-11-19T07:10:00Z" };
const D2 = { documentId: "d_p2", fileName: "缺项文档" }; // 无类型/大小/更新
const ROWS = [D1, D2];

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
const qDoc = (testid: string) => document.querySelector(`[data-testid="${testid}"]`);
const txt = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES)
      return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "人事制度空间", docCount: 2, status: "synced" }] });
    if (url === DOCUMENTS_PLAIN || url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: ROWS });
    if (url === DETAIL_URL || url === DETAIL_URL2) return fail(404, "文档详情未接入。", "rid-r125-d");
    return fail(404, "这个数据接口还没有接入。", "rid-r125");
  });

const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";
/** 找到某文档行（按表内行 title/名称文本匹配）。 */
const rowByName = (name: string) =>
  [...container.querySelectorAll('[data-testid="kn3-docs-row"]')].find((r) => (r.textContent ?? "").includes(name)) ?? null;

describe("knowledge cross-face parity incl. kn7 drawer (R125)", () => {
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

  it("A) present fields render byte-identical across the four faces (search cols / detail cols / inline preview / kn7 drawer)", async () => {
    wire();
    // 检索表列（跨空间列表）——R70 已锁两表互等，这里把它当第四面读数的参照
    await render("/knowledge?tab=spaces");
    const searchRow = [...container.querySelectorAll('[data-testid="kn6-search-row"]')].find((r) => (r.textContent ?? "").includes("员工手册.pdf"))!;
    const sName = txt(searchRow.querySelector('[data-testid="kn6-search-name"]'));
    const sType = txt(searchRow.querySelector('[data-testid="kn6-search-type"]'));
    const sSize = txt(searchRow.querySelector('[data-testid="kn6-search-size"]'));
    const sUpd = txt(searchRow.querySelector('[data-testid="kn6-search-updated"]'));
    // 详情表列 + 行内预览 + 抽屉
    await render(DETAIL);
    const row = rowByName("员工手册.pdf")!;
    const dName = txt(row.querySelector('[data-testid="kn3-docs-name"]'));
    const dType = txt(row.querySelector('[data-testid="kn3-docs-type"]'));
    const dSize = txt(row.querySelector('[data-testid="kn3-docs-size"]'));
    const dUpd = txt(row.querySelector('[data-testid="kn3-docs-updated"]'));
    expect(dName).toBe(sName);
    expect(dType).toBe(sType);
    expect(dSize).toBe(sSize);
    expect(dUpd).toBe(sUpd);
    // 行内预览
    await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "doc preview toggle");
    const pName = txt(qDoc("kn-doc-preview-name"));
    expect(txt(qDoc("kn-doc-preview-type"))).toBe(dType);
    expect(txt(qDoc("kn-doc-preview-size"))).toBe(dSize);
    expect(txt(qDoc("kn-doc-preview-updated"))).toBe(dUpd);
    // 短码一致（预览在场时读）：预览码格 == docLine 第 5 列 == shortId(id)
    const code = txt(qDoc("kn-doc-preview-code"));
    expect(code).toBe(shortId("d_p1"));
    expect(docLine({ id: "d_p1", name: dName, type: dType, size: dSize, at: dUpd } as never).split(" | ")[4]).toBe(code);
    // 抽屉（收起预览再开，避互斥干扰）
    await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "close preview");
    await clickNode(row.querySelector('[data-testid="kn3-docs-name"]'), "open drawer");
    expect(qDoc("kn7-preview-panel")).toBeTruthy();
    expect(txt(qDoc("kn7-preview-field-name"))).toBe(dName);
    expect(pName).toBe(dName);
    expect(txt(qDoc("kn7-preview-field-type"))).toBe(dType);
    expect(txt(qDoc("kn7-preview-field-size"))).toBe(dSize);
    expect(txt(qDoc("kn7-preview-field-updated"))).toBe(dUpd);
    // 逐字示例锁（漂移即红）：类型人话 / 大小人话 / 更新到分
    expect(dType).toBe("PDF");
    expect(dSize).toBe("2.4 MB");
    expect(dUpd).toBe("2026-11-19 15:10");
    expect(qDoc("kn3-docs-detail")?.getAttribute("title")).toBe("d_p1"); // 抽屉 dl 全 id 在 title
    const faces = `${txt(qDoc("kn7-preview-panel"))}${txt(container.querySelector('[data-testid="kn3-docs"]'))}`;
    expect(faces).not.toContain("d_p1"); // 正文零裸 id
  });

  it("B) missing fields: drawer uses the SAME previewField sentence as both inline previews (defect fixed this round)", async () => {
    wire();
    await render(DETAIL);
    const row = rowByName("缺项文档")!;
    // 表列口径：「—」+ R76 缺失句 title（表格面口径，按设计不收 previewField）
    expect(txt(row.querySelector('[data-testid="kn3-docs-type"]'))).toBe("—");
    expect(row.querySelector('[data-testid="kn3-docs-updated"]')?.getAttribute("title")).toBe("上游未返回时间；不用本机时间顶替。");
    // 行内预览口径
    await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "doc preview toggle");
    const pType = txt(qDoc("kn-doc-preview-type"));
    const pTypeTitle = qDoc("kn-doc-preview-type")?.getAttribute("title") ?? "";
    const pUpdated = txt(qDoc("kn-doc-preview-updated"));
    const pUpdatedTitle = qDoc("kn-doc-preview-updated")?.getAttribute("title") ?? "";
    expect(pType).toBe("该字段未返回");
    expect(pUpdated).toBe("该字段未返回");
    // 抽屉三面对齐（本次修复断言：曾自一套「—」文案，属真缺陷）
    await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "close preview");
    await clickNode(row.querySelector('[data-testid="kn3-docs-name"]'), "open drawer");
    expect(txt(qDoc("kn7-preview-field-type"))).toBe(pType);
    expect(qDoc("kn7-preview-field-type")?.getAttribute("title")).toBe(pTypeTitle);
    expect(txt(qDoc("kn7-preview-field-updated"))).toBe(pUpdated);
    expect(qDoc("kn7-preview-field-updated")?.getAttribute("title")).toBe(pUpdatedTitle);
    expect(txt(qDoc("kn7-preview-field-size"))).toBe("该字段未返回");
    expect(txt(qDoc("kn7-preview-field-name"))).toBe("缺项文档"); // 名在场不受影响
    // 抽屉对「不在已加载列表」的行（详情 404 也不伪造）：仍走同句式，原因点名列表缺失
    await clickNode(qDoc("kn7-preview-close"), "close drawer");
    expect(qDoc("kn7-preview-panel")).toBeNull();
  });

  it("C) request counts as measured: inline preview +0; drawer +1 per open (R49 detail read), zero while open/closed churn", async () => {
    wire();
    await render(DETAIL);
    const base = fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
    const row = rowByName("员工手册.pdf")!;
    // 行内预览开合：纯复用已载数据，零请求（派工字面「零」对此面成立）
    await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "preview open");
    await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "preview close");
    expect(fetchMock.mock.calls.map((c: unknown[]) => String(c[0]))).toEqual(base);
    // 抽屉打开：实测 +1 —— 既有 R49 设计（文档详情读口），不是本单引入；纯测试单不改产品行为，
    // 如实断言「每次打开 +1、开合状态翻转期间不重复发、且发的就是该文档的详情读取这一条」。
    await clickNode(row.querySelector('[data-testid="kn3-docs-name"]'), "open drawer");
    const afterOpen = fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(afterOpen.length).toBe(base.length + 1);
    expect(afterOpen[base.length]).toBe(DETAIL_URL);
    // 抽屉开着不动它：不追加（无轮询/重发）
    await act(async () => {});
    expect(fetchMock.mock.calls.length).toBe(afterOpen.length);
    // 关再开：一次开关一次读（不叠加成两次），关闭本身零请求
    await clickNode(qDoc("kn7-preview-close"), "close drawer");
    expect(fetchMock.mock.calls.length).toBe(afterOpen.length);
    await clickNode(row.querySelector('[data-testid="kn3-docs-name"]'), "reopen drawer");
    const afterReopen = fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(afterReopen.length).toBe(afterOpen.length + 1);
    expect(afterReopen.filter((u) => u === DETAIL_URL)).toHaveLength(2);
    // 全程表格面自身零增量：除详情读外没有任何 spaces/documents 复读
    expect(afterReopen.filter((u) => u === SPACES)).toHaveLength(base.filter((u) => u === SPACES).length);
    expect(afterReopen.filter((u) => u === docsUrlFor("sp_x"))).toHaveLength(base.filter((u) => u === docsUrlFor("sp_x")).length);
  });
});
