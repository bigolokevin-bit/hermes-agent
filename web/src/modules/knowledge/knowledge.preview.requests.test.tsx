// R196 — 知识预览请求契约护栏（纯测试单：零产品改动）。
// 名实与查重（brief 三条对齐按实测执行）：
// ① 首屏恰 1 次 spaceId 读、无 cursor= —— 已锁：主测 knE 段 :2531「第一页绝不带
//   cursor：还是那一次 documentsUrl 读取」+ R142 ④ wire 口径 → 引用不重写。
// ② 「开预览 +1 详情」**只对遮罩抽屉 kn7-preview-*（?doc=）成立**（R49 设计）——
//   已锁：knowledge.parity.test.tsx:180-199（R125C：打开增量恰 [DETAIL_URL]、开着
//   零追加、关闭零增量、重开不叠加）；行内预览 kn-doc-preview-* 与检索展开
//   kn6-search-detail 实测零请求——已锁：knowledge.requests.test.tsx ③（R149：
//   行内预览开合 urls 快照逐字）+ R125B。分面陈述见本文件断言，绝不把行内报成 +1。
// ③ doc=a↔b 列表集合不变、详情各 1 指向自身 —— 已锁 R149 ④:149-166；
//   **真缺口**：抽屉标题（kn7-preview-title，源=row?.name 产品 :1537 区）跟随换文档——
//   本文件新写；行内预览无「抽屉标题」，其标题源为屏上字段行（previewField 族，R114/R125）。
// ④ 关闭零请求已锁（R125C/R149）；**真缺口**：开关一轮后列表行序与行钮 id 序列
//   开前=开后（indexBase 全局行序在交互间稳定的消费侧复证）——本文件新写。
// 失败路径：可读句+rid+重试恰 +1 已锁 R183 ③（DETAIL_A 计数 +1、spaces/列表零连带）
//   与 R187（空间侧四读互等）→ 引用。
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

const q = (testid: string) => document.querySelector(`[data-testid="${testid}"]`);
const txt = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const spaceRowNames = () =>
  [...document.querySelectorAll('[data-testid="kn3-docs-row"] [data-testid="kn3-docs-name"]')].map((n) => txt(n));
const spaceBtnIds = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')]
    .map((b) => b.getAttribute("data-testid"))
    .sort((a, b) => Number(a!.slice(-1)) - Number(b!.slice(-1)));

const D_A = { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const D_B = { documentId: "d_b", fileName: "B 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 2, status: "synced" }],
};
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

describe("knowledge preview-surface request contract, remainder (R196, gap-only)", () => {
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

  it("③ the drawer title follows the document on a doc=a↔b switch (drawer-only surface), detail reads one each", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [D_A, D_B] });
      if (url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: [D_A, D_B] });
      return fail(404, "文档详情未接入。", "rid-r196-d");
    });
    await render(DETAIL);
    const nameClick = (name: string) =>
      [...document.querySelectorAll('[data-testid="kn3-docs-row"]')]
        .find((r) => (r.textContent ?? "").includes(name))!
        .querySelector('[data-testid="kn3-docs-name"]');
    await clickNode(nameClick("A 手册.pdf"), "open A");
    expect(txt(q("kn7-preview-title"))).toBe("A 手册.pdf"); // 抽屉标题=行名（row?.name 源）
    await clickNode(nameClick("B 表.xlsx"), "switch to B");
    expect(txt(q("kn7-preview-title"))).toBe("B 表.xlsx"); // 标题随换文档更新（真缺口位）
    // 详情读各恰 1 指向自身（列表集合不变已由 R149④ 锁，这里只补 URL 计数）
    expect(urls().filter((u) => u === detailUrl("d_a"))).toHaveLength(1);
    expect(urls().filter((u) => u === detailUrl("d_b"))).toHaveLength(1);
  });

  it("④ a full open→close cycle of the inline preview leaves row order and row-copy id sequence byte-identical", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [D_A, D_B] });
      if (url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: [D_A, D_B] });
      return fail(404, "这个数据接口还没有接入。", "rid-r196");
    });
    await render(DETAIL);
    const order0 = spaceRowNames();
    const ids0 = spaceBtnIds();
    const u0 = urls().slice().sort().join("|");
    // 开 A 预览 → 关 → 开 B 预览 → 关：行内链全程零请求（R149③ 已锁快照，这里复锁一次
    // 并叠行序/id 维度），任何时刻抽屉标题位不存在（行内预览不冒充抽屉面——分面口径）
    const toggle = (name: string) =>
      [...document.querySelectorAll('[data-testid="kn3-docs-row"]')]
        .find((r) => (r.textContent ?? "").includes(name))!
        .querySelector('[data-testid="kn-doc-preview-toggle"]');
    await clickNode(toggle("A 手册.pdf"), "open A inline");
    expect(q("kn-doc-preview")).toBeTruthy();
    expect(q("kn7-preview-title")).toBeNull();
    await clickNode(toggle("A 手册.pdf"), "close A inline");
    await clickNode(toggle("B 表.xlsx"), "open B inline");
    expect(q("kn7-preview-title")).toBeNull();
    await clickNode(toggle("B 表.xlsx"), "close B inline");
    expect(spaceRowNames()).toEqual(order0); // 行序原样
    expect(spaceBtnIds()).toEqual(ids0); // 钮 id 序列原样（indexBase 全局序在交互间稳定）
    expect(urls().slice().sort().join("|")).toBe(u0); // 请求快照逐字（含无 cursor=/无详情读）
    expect(urls().some((u) => u.includes("cursor="))).toBe(false);
  });
});
