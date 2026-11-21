// R255 — 全局导出 × 空间详情导出：筛选参数互不串写的**往返闭环**（纯测试单：零产品改动，未造控件）。
// 名实换算（实测口径，断言即现实）：
// · 无真 CSV（createObjectURL/text/csv/a.download/new Blob 源级 0、absent ×4、
//   kn-list-copy 不存在——R190①:113-119）→「导出」= 复制器数据行：全局/跨空间检索面
//   knG-copy（docHitCopyText 6 列，所属空间固定@2——R214②:158 等式域引用不复写）；
//   空间详情面 knF-copy（docCopyText→DOC_LINE_HEADER 5 列）；spy 全程 0。
// · **全局面无任何类型/来源/排序器械**（只有 ?q= 文档名搜）——派工「?type/?source 残留」
//   不可按字面断言：映射为两面具各自真实键（全局 ?q=；详情 ?ktype=×本地名筛×?ksort/
//   ?kdir），以「对侧参数绝不进入本侧导出行集」+ URL/请求密钥集实检证明隔离；无
//   ?source= 控件（任何面）未造。
// · 派工③「两侧都有 page-cap」半不成立：**kn3-page-cap 只属详情面**（全局面 cap 计数
//   实测 0——差异按实记录；R164/R242 cap 单具位引用）；详情面四值口径 表体==-space-
//   钮==knF 行==cap M 已由 R216①/R244/R248 分帧锁过——本例只作**往返帧内当帧复跑**。
// · 「两侧零额外读」半不成立：本地筛选/复制零请求，但 **space= 切换合法触发该空间
//   既有 documents 读**（密钥集恰 {limit,spaceId}——R164①:142）→ 按阶段如实计数，
//   不宣称全零。排序/筛选纯本地（R131①/R237②/R244γ′δ′）；cursor 只在组件态。
// · 缺值两式禁统一、短码尾段全 id 仅 title、行钮分面 -space-（R132/R169）——沿用；
//   clip 桩 mockResolvedValue + afterEach unstubAllGlobals（R214，Errors 0 硬要求）。
// 【查重（file:line；已锁只引用）】跨面行等式 R214②:158/R226①-b（knG 行↔行钮）/R233；
//   单面链同源 R142①:124/R209③/R197①；详情动作→全局面不染 R228①（行名/钮/行钮复制
//   文本三快照）与 R253②（排序跨面三物）；全局 q→详情不染 R242②；cap 单具/在屏 M
//   R242①/R244；换代/弃页 R207/R244γ′δ′/R247①。**未锁新维（本文件）**：把两向单步
//   免疫串成 **同一实例内 A→B→A 往返闭环**：全局导出快照 → 开空间+切桶（真实读+1、
//   密钥集实检、四值+cap 在场复跑）→ 返回全局再导出 **与最初快照逐字回环**（ktype/q
//   皆零残留），并同帧钉 **cap 在场性随面翻转（1→0）**与**逐阶段读计数账本**。
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
const loc = () => txt(q("loc"));
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const detailNames = () =>
  [...document.querySelectorAll('[data-testid="kn3-docs-row"]')].map((r) => txt(r.querySelector('[data-testid="kn3-docs-name"]')));
const hitNames = () =>
  [...document.querySelectorAll('[data-testid="kn6-search-row"]')].map((r) => txt(r.querySelector('[data-testid="kn6-search-name"]')));
const btnCount = () => document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length;
const capCount = () => document.querySelectorAll('[data-testid="kn3-page-cap"]').length;
const capM = () => {
  const m = /当前已加载 (\d+) 篇/.exec(txt(q("kn3-page-cap")));
  return m ? Number(m[1]) : null;
};
const dataLines = (text: string) => text.split("\n").slice(1, -1);
const bucketByLabel = (label: string) =>
  [...document.querySelectorAll('button[data-testid^="kn-type-"]')].find((b) => txt(b).startsWith(label)) ?? null;
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.URL, "createObjectURL", { value: vi.fn(), configurable: true, writable: true });
  return writeText;
};

const G1 = { documentId: "g_1", fileName: "全局一.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T04:00:00Z", spaceId: "sp_y", spaceName: "空间乙" };
const G2 = { documentId: "g_2", fileName: "全局二.xlsx", mimeType: "xlsx", sizeBytes: 512, updatedAt: "2026-11-19T03:00:00Z", spaceId: "sp_x", spaceName: "空间甲" };
const D1 = { documentId: "d_1", fileName: "甲册.pdf", mimeType: "pdf", sizeBytes: 4096, updatedAt: "2026-11-19T07:00:00Z" };
const D2 = { documentId: "d_2", fileName: "甲表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const D3 = { documentId: "d_3", fileName: "甲档.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T05:00:00Z" };
const SP2 = {
  asOf: "2026-11-19T08:00:00Z",
  items: [
    { spaceId: "sp_x", name: "空间甲", docCount: 3, status: "synced" },
    { spaceId: "sp_y", name: "空间乙", docCount: 1, status: "synced" },
  ],
};
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP2);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP2.asOf, documents: [G1, G2] });
    if (url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP2.asOf, documents: [D1, D2, D3], nextCursor: null });
    return fail(404, "这个数据接口还没有接入。", "rid-r255-x");
  });

describe("knowledge export cross-face filter isolation loop (R255)", () => {
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

  it("① A→B→A 往返闭环：全局导出快照 → 开空间甲（实测 +2 合法读：spaces 重读+docs {limit,spaceId}）+ 切 PDF 桶（四值+cap 在场复跑）→ 返回再导出与最初快照逐字回环、cap 随面归零", async () => {
    const writeText = clipStub();
    wire();
    // 阶段 A：全局面（无 space=）——knG 基线快照；cap 计数 0（面族差异按实记录）
    await render("/knowledge?tab=spaces");
    expect(capCount()).toBe(0); // 全局面无 page-cap（派工③「两侧都有」半不成立——引用位 R164/R242）
    expect(hitNames()).toEqual(["全局一.pdf", "全局二.xlsx"]);
    await clickNode(q("knG-copy"), "knG phase-A");
    const textG0 = String(writeText.mock.calls[0][0]);
    const readsA = urls().length;
    expect(readsA).toBe(2); // spaces + plain
    // 阶段 B：点空间行开详情（**合法触发该空间既有 documents 读**——禁全零话术）
    const opener = [...document.querySelectorAll('[data-testid="kn-space-open"]')].find((a) => (a.closest("tr")?.textContent ?? "").includes("空间甲"));
    await clickNode(opener, "open space 甲");
    expect(loc()).toContain("space=sp_x");
    expect(urls().slice(readsA)).toEqual([SPACES, docsUrlFor("sp_x")]); // 实测 +2：空间列表重读 + 该空间 documents 读（皆既存合法读，非全零）
    expect(urls().filter((u) => u === docsUrlFor("sp_x"))).toHaveLength(1);
    const qs = new URLSearchParams(docsUrlFor("sp_x").split("?")[1]);
    expect([...qs.keys()].sort()).toEqual(["limit", "spaceId"]); // 密钥集实检（R164①:142 同法）
    await clickNode(bucketByLabel("PDF"), "ktype PDF on detail face");
    expect(detailNames()).toEqual(["甲册.pdf", "甲档.pdf"]); // 详情面只含本空间行（对侧 q/全局行零混入）
    await clickNode(q("knF-copy"), "knF phase-B");
    const linesB = dataLines(String(writeText.mock.calls[1][0]));
    expect(linesB.map((l) => l.split(" | ")[0])).toEqual(detailNames()); // 链==本面屏上
    expect([detailNames().length, btnCount(), linesB.length, capM()]).toEqual([2, 2, 2, 2]); // 四值当帧复跑（R216①/R244 口径）
    expect(capCount()).toBe(1); // cap 随详情面在场
    expect(textG0).not.toContain("甲册"); // 阶段隔离双向自证：基线不含详情行
    const readsB = urls().length;
    // 阶段 A'：返回空间列表（kn3-docs-back）→ 再全局导出——**与最初快照逐字回环**
    await clickNode(q("kn3-docs-back"), "back to spaces");
    expect(loc()).not.toContain("space=sp_x");
    writeText.mockClear();
    await clickNode(q("knG-copy"), "knG phase-A2");
    expect(String(writeText.mock.calls[0][0])).toBe(textG0); // 闭环零残留（桶/ktype 不回染全局面）
    expect(urls().length).toBe(readsB + 1); // 导出本身 0 请求——读账本闭环：open+2、back+1、三次复制共 +0
    expect(urls().slice(readsB)).toEqual([SPACES]); // 实测返回亦 +1 既存 spaces 重读（面板级合法读）
  });

  it("② 反向：详情态（space+ktype 深链）导出后返回全局——knG 恢复全行集（含 xlsx，若 ktype 串写必被剔）、链==屏上、逐位行钮与清单互等（引用 R226①-b 不重写）", async () => {
    const writeText = clipStub();
    wire();
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x&ktype=PDF");
    expect(detailNames()).toEqual(["甲册.pdf", "甲档.pdf"]);
    await clickNode(q("knF-copy"), "knF detail first");
    const textF = String(writeText.mock.calls[0][0]);
    expect(textF).toContain("甲册.pdf");
    await clickNode(q("kn3-docs-back"), "back to global");
    // 实测记录返回后 URL：space 清除；ktype 留存位按实断言（不宣称全清）
    expect(loc()).not.toContain("space=sp_x");
    const hits = hitNames();
    expect(hits).toEqual(["全局一.pdf", "全局二.xlsx"]); // 全行集在场（xlsx 未被 ktype 剔）
    writeText.mockClear();
    await clickNode(q("knG-copy"), "knG after back");
    const lines = dataLines(String(writeText.mock.calls[0][0]));
    expect(lines.map((l) => l.split(" | ")[0])).toEqual(hits); // 链==全局屏上
    expect(lines).toHaveLength(2);
    expect(capCount()).toBe(0); // 全局帧 cap 归零（随面翻转的缺席位——闭环第二半）
    // 逐位行钮==清单行（隔离帧内互等复跑；一般式引 R226①-b）
    for (const i of [0, 1]) {
      writeText.mockClear();
      await clickNode(document.querySelector(`button[data-testid="kn-row-copy-${i}"]`), `hit btn ${i}`);
      expect(String(writeText.mock.calls[0][0]).split("\n")[1].split(" | ")[0]).toBe(hits[i]);
    }
  });
});
