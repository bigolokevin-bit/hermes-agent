// @vitest-environment jsdom
// R70 — 跨面同值 parity（纯测试波）：同一条文档记录从两个读口进来，两面的呈现必须逐字一致；
// 两面都属「预览类表面」的缺字段话术同样逐字一致。只加测试；测出的真缺陷（预览缺值话术
// 分裂、文档行预览与 ?sdoc= 未互斥）已在同单以共享 helper / 互斥接线收口，改前/改后见证据。
//
// 映射声明（派工名 → 实际面）：
//   「全库检索结果行」        = kn6-search-*（DocumentNameSearch 命中表）+ 行内展开 kn6-search-detail（?sdoc=）
//   「空间内文档行」          = kn3-docs-*（SpaceDetailSurface 文档表）+ 行内预览 kn-doc-preview-*
//   「空间侧预览」的另一面 kn-space-preview-* 属空间列表面（对象是空间不是文档），与详情面
//   路由互斥、不同屏，本文件的互斥矩阵以「同屏可达」为准。
//
// 设计性差异（excluded-by-design，只列不改产品）：
//   1. 检索表有「所属空间」列，详情表没有（详情按 spaceId 读，整表同空间）。
//   2. 详情行预览有「短码」列；检索行内展开没有短码列，它有「原文位置」列。
//   3. 表格单元格（非预览）的缺值口径仍是屏上「—」+title，不属于「该字段未返回」预览句式。
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

async function clickNth(testid: string, index: number) {
  const nodes = document.querySelectorAll(`[data-testid="${testid}"]`);
  expect(nodes.length > index, `${testid}[${index}]`).toBe(true);
  await act(async () => {
    nodes[index].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {});
}

const q = (testid: string) =>
  (container.querySelector(`[data-testid="${testid}"]`) ?? document.querySelector(`[data-testid="${testid}"]`)) as Element | null;
const qa = (testid: string) => container.querySelectorAll(`[data-testid="${testid}"]`);
const loc = () => (q("loc")?.textContent ?? "");

/** 读一个 dl 预览块：dt → { text, title }；search 侧「文档」键归一化为「文档名」。 */
function dlMap(testid: string): Record<string, { text: string; title: string | undefined }> {
  const dl = q(testid);
  expect(dl, testid).toBeTruthy();
  const out: Record<string, { text: string; title: string | undefined }> = {};
  for (const div of Array.from(dl?.querySelectorAll("div") ?? [])) {
    const dt = div.querySelector("dt")?.textContent?.trim() ?? "";
    const dd = div.querySelector("dd");
    if (!dt || !dd) continue;
    const key = dt === "文档" ? "文档名" : dt;
    out[key] = { text: dd.textContent?.trim() ?? "", title: dd.getAttribute("title") ?? undefined };
  }
  return out;
}

const COMPLETE = {
  documentId: "d_p",
  fileName: "同值文档.pdf",
  mimeType: "application/pdf",
  sizeBytes: 2516582,
  updatedAt: "2026-11-19T07:10:00Z",
};
const MISSING = { documentId: "d_m", fileName: "缺值文档.md" };

describe("knowledge cross-surface parity (kn6-search-* vs kn3-docs-*)", () => {
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

  const bothTablesFixture = () =>
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES)
        return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_hr", name: "人事制度空间", docCount: 2, status: "synced" }] });
      if (url === DOCUMENTS_PLAIN || url === docsUrlFor("sp_hr"))
        return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [COMPLETE, MISSING] });
      return fail(404, "这个数据接口还没有接入。", "rid-parity-x");
    });

  it("renders the same record identically in the search table and the space document table", async () => {
    bothTablesFixture();
    await render("/knowledge?tab=spaces&space=sp_hr");
    // 搜索表（读入序 d_p,d_m）与详情表（默认 updated/desc：d_p 有时间在前、d_m 缺时间恒末）行序对齐
    const searchRows = qa("kn6-search-row");
    const docRows = qa("kn3-docs-row");
    expect(searchRows).toHaveLength(2);
    expect(docRows).toHaveLength(2);
    const cell = (row: Element, testid: string) => {
      const node = row.querySelector(`[data-testid="${testid}"]`);
      return { text: node?.textContent?.trim() ?? "", title: node?.getAttribute("title") ?? undefined };
    };
    for (let i = 0; i < 2; i += 1) {
      const s = searchRows[i];
      const d = docRows[i];
      expect(d.getAttribute("title")).toBe(s.getAttribute("title")); // 行 title 全 id 一致
      const sName = cell(s, "kn6-search-name");
      const dName = { text: d.querySelector('[data-testid="kn3-docs-name"]')?.textContent?.trim() ?? "", title: d.querySelector('[data-testid="kn3-docs-name"]')?.getAttribute("title") ?? undefined };
      expect(dName.text).toBe(sName.text);
      expect(dName.title).toBe(sName.title);
      for (const [sTestid, dTestid] of [
        ["kn6-search-type", "kn3-docs-type"],
        ["kn6-search-size", "kn3-docs-size"],
        ["kn6-search-updated", "kn3-docs-updated"],
      ] as const) {
        const a = cell(s, sTestid);
        const b = cell(d, dTestid);
        expect(`${sTestid}#${i}:${b.text}|${b.title ?? ""}`).toBe(`${sTestid}#${i}:${a.text}|${a.title ?? ""}`);
      }
    }
    // 缺值行的表格口径两面都是「—」（表格口径本就不属于「该字段未返回」句式——exclusion 3）
    expect(cell(searchRows[1], "kn6-search-type").text).toBe("—");
    expect(cell(docRows[1], "kn3-docs-type").text).toBe("—");
  });

  it("keeps the two preview surfaces byte-identical for the same record, incl. the missing-field sentence", async () => {
    bothTablesFixture();
    await render("/knowledge?tab=spaces&space=sp_hr");
    const urlsBefore = fetchMock.mock.calls.length;

    // 完整记录：先取详情行预览，再取检索行内展开（互斥使两者不能同时在场——分两轮读数）
    await clickNth("kn-doc-preview-toggle", 0);
    const docPreview = dlMap("kn-doc-preview");
    await clickNth("kn6-search-name", 0); // 开 sdoc：详情预览作废（互斥方向②）
    expect(qa("kn-doc-preview")).toHaveLength(0);
    const searchDetail = dlMap("kn6-search-detail");
    for (const key of ["文档名", "类型", "大小", "更新"] as const) {
      expect(`${key}=${searchDetail[key]?.text}|${searchDetail[key]?.title ?? ""}`).toBe(
        `${key}=${docPreview[key]?.text}|${docPreview[key]?.title ?? ""}`,
      );
    }
    expect(docPreview["类型"].title).toBe("application/pdf"); // 在场字段的原始值仍只在 title

    // 缺值记录：两面同走「该字段未返回」+同句式 title（R70 收口后的共同口径）
    await clickNth("kn6-search-name", 1); // sdoc 换到 d_m
    const missingDetail = dlMap("kn6-search-detail");
    await clickNth("kn-doc-preview-toggle", 1); // 开 d_m 行预览（互斥：sdoc 静默删除）
    expect(loc()).not.toContain("sdoc");
    const missingPreview = dlMap("kn-doc-preview");
    for (const key of ["类型", "大小", "更新"] as const) {
      expect(missingPreview[key].text).toBe("该字段未返回");
      expect(`${key}|${missingDetail[key].title ?? ""}`).toBe(`${key}|${missingPreview[key].title ?? ""}`);
    }
    expect(fetchMock.mock.calls.length).toBe(urlsBefore); // 整个 parity 读数全程零新请求
  });

  it("holds the mutex matrix (doc preview / kn7 drawer / sdoc expand) with zero extra reads", async () => {
    bothTablesFixture();
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES)
        return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_hr", name: "人事制度空间", docCount: 2, status: "synced" }] });
      if (url === DOCUMENTS_PLAIN || url === docsUrlFor("sp_hr"))
        return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [COMPLETE, MISSING] });
      if (url === "/agent-api/api/documents/d_p") return fail(404, "文档详情未接入", "rid-parity-detail");
      return fail(404, "这个数据接口还没有接入。", "rid-parity-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");
    await act(async () => {});

    // 预览 → 抽屉：点行名开抽屉，预览收起
    await clickNth("kn-doc-preview-toggle", 0);
    expect(qa("kn-doc-preview")).toHaveLength(1);
    const urlsAfterPreview = fetchMock.mock.calls.length;
    await clickNth("kn3-docs-name", 0);
    expect(q("kn7-preview-panel")).toBeTruthy();
    expect(qa("kn-doc-preview")).toHaveLength(0);
    expect(loc()).toContain("doc=d_p");
    expect(fetchMock.mock.calls.length).toBe(urlsAfterPreview + 1); // 仅 R49 既有的开抽屉详情一读

    // 抽屉 → sdoc 展开：点检索命中；抽屉不受影响（现状如实：doc/sdoc 分属不同面可共存）
    await clickNth("kn6-search-name", 1);
    expect(loc()).toContain("doc=d_p");
    expect(loc()).toContain("sdoc=d_m");
    expect(q("kn7-preview-panel")).toBeTruthy();
    expect(qa("kn-doc-preview")).toHaveLength(0); // 预览保持收起且不会在 sdoc 关闭后复活
    const urlsAfterSdoc = fetchMock.mock.calls.length;

    // sdoc+抽屉在场 → 开预览：doc= 与 sdoc= 都静默删除，抽屉卸载，零新请求
    await clickNth("kn-doc-preview-toggle", 0);
    expect(loc()).not.toContain("doc=");
    expect(loc()).not.toContain("sdoc");
    expect(q("kn7-preview-panel")).toBeNull();
    expect(q("kn6-search-detail")).toBeNull();
    expect(qa("kn-doc-preview")).toHaveLength(1);
    expect(fetchMock.mock.calls.length).toBe(urlsAfterSdoc);

    // 预览开/关全程 URL 逐字不变（除互斥删除）；列表面永无 kn-space-toggle（路由互斥）
    const locWithPreview = loc();
    await clickNth("kn-doc-preview-toggle", 0); // 收起
    expect(loc()).toBe(locWithPreview);
    expect(qa("kn-doc-preview")).toHaveLength(0);
    expect(document.querySelectorAll('[data-testid^="kn-space-toggle-"]')).toHaveLength(0);
    expect(fetchMock.mock.calls.length).toBe(urlsAfterSdoc);
  });
});
