// R260 — 缺值三态 × 交集筛选 × 双面六载体并置（纯测试单：零产品改动，未造控件）。
// 名实换算（产品定版，断言即现实）：
// · 无真 CSV（createObjectURL/text/csv/a.download/new Blob 源级 0、absent ×4、
//   kn-list-copy 不存在——R190①:113-119）→「导出数据行」= knF（DOC_LINE_HEADER 5 列）/
//   knG（6 列，所属空间@2）复制器数据行；spy 全程 0。
// · **腿①双口径驳回**：派工「复制『—』 vs CSV 空字段」的第二口径不存在——两产物共用
//   同一 docLine（R214②/R226②/R233 单源链）→ 按单一现实断言「—」，无
//   undefined/null/空字段（" |  | "）；该差异记录于此与回执，禁伪造。
// · **无 ?source= 控件**（仅空间行「来源」列标签）→ 派工 `?type=pdf&source=upload`
//   换算 `?ktype=PDF`（旧 type 只读兜底双删 :3549-3551）× `?q=`（检索面本地过滤）；
//   未造参数/控件。
// · 行钮分面：详情 `kn-row-copy-space-<i>`（唯一分页面）、检索 `kn-row-copy-<i>`
//   （R132/R169）；kn-doc-copy 单控件非行数；本地动作零新请求（R215③/R243β/R244δ′，
//   禁「恰 1 次」）、请求键集 {limit,spaceId}（R164①:142）、cursor 只在组件态；
//   cap 50/M、true-0/错/拒/非法=**null**（腿③「上限句」在空帧按 null 断——R108/R157/
//   R187/R231②/R236③）；缺值两式禁统一（表格/复制「—」 vs 预览「该字段未返回」+title
//   ——本文件不触预览面）；短码=大写尾段、全 id 仅 title；clip 桩 mockResolvedValue +
//   afterEach unstubAllGlobals（R214，Errors 0 硬要求）。
// 【查重（file:line；已锁只引用）】腿①单面全缺＝**R190③(escape:171-188 详情面三格
//   「—」+复制行「—」+无空字段)**、三面载体互等＝R226②(:143-172 cell/行钮/knF/knG
//   去列位——**非交集帧、检索面缺值格未查**)、抽屉第三式＝R233①；三值同源＝R142①:124/
//   R248①:135-160/R249①；空集门＝R190④:190-205/R231②⑤/R236③:182-210 → 腿③与①的
//   单面位不复写。
// 【真新增维（点名两条）】
//  A. **交集帧（ktype=PDF×q=人事）内“两缺行”（缺 size+updated）六载体并置**：详情
//     3 格/行钮串/knF 行 × 检索 3 格/行钮串/knG 行——「—」逐格 + 同文档行钮串**跨面
//     逐字互等**（R226①-b 是 full 值行、此缺值位零 pin）+ 两面三值同帧 + urls 逐字。
//  B. **全缺行（type/size/updated 三缺）在检索面的三载体**（hit 格×行钮×knG 行逐格
//     「—」+无空字段+无 undefined/null）——R190③ 只锁详情面，检索面全缺位首锁；并
//     与详情面同文档行钮**同串互等**（双面全缺同一 docLine 单源直证）。
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
const Q = encodeURIComponent("人事");

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
const rowBy = (pfx: "kn3-docs" | "kn6-search", name: string) =>
  [...document.querySelectorAll(`[data-testid="${pfx}-row"]`)].find((r) => (r.textContent ?? "").includes(name)) ?? null;
const cells = (pfx: "kn3-docs" | "kn6-search", name: string) => {
  const r = rowBy(pfx, name);
  return [
    txt(r?.querySelector(`[data-testid="${pfx}-type"]`)),
    txt(r?.querySelector(`[data-testid="${pfx}-size"]`)),
    txt(r?.querySelector(`[data-testid="${pfx}-updated"]`)),
  ];
};
const btnOf = (pfx: "kn3-docs" | "kn6-search", name: string) =>
  rowBy(pfx, name)?.querySelector(`button[data-testid^="kn-row-copy${pfx === "kn3-docs" ? "-space" : ""}-"]`) ?? null;
const dataLines = (text: string) => text.split("\n").slice(1, -1);
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.URL, "createObjectURL", { value: vi.fn(), configurable: true, writable: true });
  return writeText;
};

// 两缺行：type=pdf 入桶、缺 size+updated；全缺行：三缺（不入桶，只经 q 在检索面出场）
const P = { documentId: "d_p", fileName: "人事两缺.pdf", mimeType: "pdf", spaceId: "sp_x", spaceName: "人事空间" }; // 缺 size+updated（updated 不带给——A 帧三格 [PDF,—,—]）
const F = { documentId: "d_f", fileName: "人事全缺", spaceId: "sp_x", spaceName: "人事空间" };
const OK = { documentId: "d_ok", fileName: "运维齐备.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T06:00:00Z", spaceId: "sp_x", spaceName: "人事空间" };
const SP = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "人事空间", docCount: 3, status: "synced" }] };
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN || url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: [P, F, OK] });
    return fail(404, "这个数据接口还没有接入。", "rid-r260-x");
  });

describe("knowledge export missing-value triple carriers (R260)", () => {
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

  it("A 新增维：交集帧（?ktype=PDF&q=人事）两缺行六载体并置——格×行钮×清单「—」逐格 + 跨面行钮串逐字互等 + 两面三值同帧 + urls 逐字（双口径驳回见头注）", async () => {
    const writeText = clipStub();
    wire();
    await render(`/knowledge?tab=spaces&panel=spaces&space=sp_x&q=${Q}&ktype=${encodeURIComponent("PDF")}`);
    // 详情面：ktype=PDF 剔全缺行 F（缺值不占桶），剩 P、OK；q 不进详情表（R164①:122 引）
    expect(cells("kn3-docs", "人事两缺.pdf")).toEqual(["PDF", "—", "—"]);
    const u0 = urls().join("|");
    await clickNode(btnOf("kn3-docs", "人事两缺.pdf"), "detail btn P");
    const dLine = String(writeText.mock.calls[0][0]).split("\n")[1];
    expect(dLine.split(" | ").slice(1, 4)).toEqual(["PDF", "—", "—"]); // 行钮串缺格同「—」
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF");
    const fLines = dataLines(String(writeText.mock.calls[0][0]));
    expect(fLines.find((l) => l.startsWith("人事两缺.pdf"))).toBe(dLine); // 行钮==knF 行
    expect([fLines.length, document.querySelectorAll('[data-testid="kn3-docs-row"]').length, document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length]).toEqual([2, 2, 2]); // 详情三值
    // 检索面（只吃 q）：P、F 出场（OK 名不含人事）
    expect(cells("kn6-search", "人事两缺.pdf")).toEqual(["PDF", "—", "—"]); // 检索面缺值格首并置
    await clickNode(btnOf("kn6-search", "人事两缺.pdf"), "hit btn P");
    const hLine = String(writeText.mock.calls[1][0]).split("\n")[1];
    expect(hLine).toBe(dLine); // **跨面同文档缺值行钮串逐字互等**（新位）
    writeText.mockClear();
    await clickNode(q("knG-copy"), "knG");
    const gLines = dataLines(String(writeText.mock.calls[0][0]));
    const hitBtns = [...document.querySelectorAll('button[data-testid^="kn-row-copy-"]')].filter((b) => !(b.getAttribute("data-testid") ?? "").includes("-space-")).length;
    expect([gLines.length, document.querySelectorAll('[data-testid="kn6-search-row"]').length, hitBtns]).toEqual([2, 2, 2]); // 检索三值
    expect(gLines.find((l) => l.startsWith("人事两缺.pdf"))?.split(" | ").slice(2, 5)).toEqual(["PDF", "—", "—"]); // knG 6 列去所属空间@2 后对齐
    expect(urls().join("|")).toBe(u0); // 交集+复制全程零新请求
    expect(dLine).not.toMatch(/undefined|null|\| *\|/); // 无空字段伪造
  });

  it("B 新增维：全缺行（三缺）检索面三载体首锁——hit 格「—」×行钮串×knG 行逐格 + 无空字段 + 与详情面同文档行钮同串（R190③ 详情面位的检索面镜像）", async () => {
    const writeText = clipStub();
    wire();
    await render(`/knowledge?tab=spaces&panel=spaces&space=sp_x&q=${Q}`); // 无 ktype：F 在详情面出场（不入桶只涉桶筛；space 在场详情表才渲染）
    expect(cells("kn6-search", "人事全缺")).toEqual(["—", "—", "—"]); // 检索面全缺三格首锁
    await clickNode(btnOf("kn6-search", "人事全缺"), "hit btn F");
    const hLine = String(writeText.mock.calls[0][0]).split("\n")[1];
    expect(hLine).toBe("人事全缺 | — | — | — | DF"); // 实测 5 列：名+三「—」+短码（无空字段、无 undefined）
    expect(hLine.split(" | ")[4]).toMatch(/^[A-Z0-9]+$/); // 短码尾段仍在（缺值不吞短码）
    expect(hLine).not.toMatch(/undefined|null|\| *\|/);
    writeText.mockClear();
    await clickNode(q("knG-copy"), "knG all");
    const gLine = dataLines(String(writeText.mock.calls[0][0])).find((l) => l.startsWith("人事全缺"))!;
    const gCols = gLine.split(" | ");
    expect([gCols[0], ...gCols.slice(2)]).toEqual(hLine.split(" | ")); // knG 6 列去所属空间@2 == 行钮 5 列（R226①-b 形制的全缺镜像）
    // 详情面同文档行钮同串（双面单源直证；F 无 space 过滤时也在详情表）
    await clickNode(btnOf("kn3-docs", "人事全缺"), "detail btn F");
    expect(String(writeText.mock.calls[1][0]).split("\n")[1]).toBe(hLine);
  });

  // 腿③判定引用（不复写）：空集导出 disabled+title、cap null（「上限句」在空帧按实
  //   null——R108/R157/R187）、零请求、createObjectURL 未调用＝R190④:190-205 +
  //   R231②⑤ + R236③:182-210 全锁；本文件 spy 位由 clipStub 注入并在 A/B 帧保持 0。
});
