// R223 — 复制文本跨三面直对护栏（纯测试单：零产品改动）。
// 名实换算（先 git grep 实测，按现状落）：
// · kn-doc-copy 不在 kn7 抽屉：grep 命中 KnowledgeModulePage.tsx:1992-2007——它是
//   DocLineCopy 单控件，只出现在行内预览（kn-doc-preview-*）与检索命中内联展开
//   （kn6-search-detail，?sdoc=）；抽屉区复制件是 kn-doc-permalink/knL-copy-meta。
//   派工「预览面 kn-doc-copy」按实落到这两个宿主，「导出/清单行」按 R142/R190 先例
//   映射 knF-copy/knG-copy 数据行（产品无 CSV：createObjectURL/text/csv/a.download/
//   new Blob 源码 0 命中，仅 data-export="absent" ×4——未造控件）。
// · 短码非固定 8 位：产品=大写人话尾段（shortId），全 id 仅 title——② 锁「三处逐字等、
//   全大写、非空」而非位数。
// · 三面互斥（R67/R68）：行内预览 × 抽屉 × sdoc 展开两两不同屏——「三面同帧」按实拆成
//   「同屏对（列表行 × 行钮）同帧 + 互斥对（行内预览 / 命中展开）顺序采集再比对」，
//   取证方式如下注释，不假装同帧。
// 查重（引用不重写）：行钮整行↔knF 整行=R209 export.rows:131-155；行钮↔kn-doc-copy
// 整串=R204 detail.parity ①；knG 列↔屏上格=R200 export.columns ②；三值=R142①②；
// 行钮编号连续=R132/R169；预览开合行序/钮 id=R196④；复制零请求=R207/R214④。
// 新增维（本文件，grep 此前零命中）：
//  ① kn-doc-copy（行内预览，详情面）与 knF 清单对应行**整行直对**；检索面命中展开块
//     的 kn-doc-copy 与 knG 清单对应行**整行直对**——两处「预览控件文本 ↔ 清单行」此前
//     只经行钮传递锁过，直接 toBe 无 pin；
//  ② 缺 updatedAt 的同一文档在三个产物（详情行钮串 / knF 行 / 命中展开串）短码与
//     缺值列三处互等（非空、全大写自等）；
//  ③ 整串复制链 urls 快照逐字 + 行内预览开合期间 kn3-page-cap 整句逐字不变（cap 位
//     此前未与预览开合同帧锁，行序位引 R196④ 不重写）。
// clipboard 桩 Promise（R214）+ afterEach unstubAllGlobals；isSecureContext 还原（R210）。
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
const DETAIL_A = "/agent-api/api/documents/d_a";

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
const rowsOf = (sel: string) => [...document.querySelectorAll(sel)];
const detailRow = (name: string) =>
  rowsOf('[data-testid="kn3-docs-row"]').find((r) => (r.textContent ?? "").includes(name)) ?? null;
const hitRow = (name: string) =>
  rowsOf('[data-testid="kn6-search-row"]').find((r) => (r.textContent ?? "").includes(name)) ?? null;
const dataLines = (text: string) => text.split("\n").slice(1, -1);
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  return writeText;
};

const A = { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const M = { documentId: "d_m", fileName: "M 缺项档", mimeType: "pdf", sizeBytes: 64 }; // 缺 updatedAt
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 2, status: "synced" }],
};
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN || url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP.asOf, documents: [A, M] });
    if (url === DETAIL_A) return Promise.resolve({ sourceName: "A 原件.pdf", status: "indexed" });
    return fail(404, "这个数据接口还没有接入。", "rid-r223");
  });
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

describe("knowledge copy cross-surface direct parity (R223)", () => {
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

  it("① kn-doc-copy ↔ 清单行整行直对（详情面 knF + 检索面 knG）：互斥面顺序采集再 toBe", async () => {
    const writeText = clipStub();
    wire();
    await render(DETAIL); // 两面同屏
    // 详情面：knF 清单行序基线 + 行内预览的 kn-doc-copy 直对
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF");
    const fLines = dataLines(String(writeText.mock.calls[0][0]));
    const rowA = detailRow("A 手册.pdf")!;
    await clickNode(rowA.querySelector('[data-testid="kn-doc-preview-toggle"]'), "inline open");
    await clickNode(q("kn-doc-copy"), "inline kn-doc-copy");
    const docText = String(writeText.mock.calls[1][0]);
    expect(dataLines(docText)[0]).toBe(fLines[0]); // 预览控件串 ↔ knF 首行整行直对（新增维）
    await clickNode(rowA.querySelector('[data-testid="kn-doc-preview-toggle"]'), "inline close");
    // 检索面：命中内联展开（?sdoc=）的 kn-doc-copy ↔ knG 清单对应行直对
    writeText.mockClear();
    await clickNode(q("knG-copy"), "knG");
    const gLines = dataLines(String(writeText.mock.calls[0][0]));
    await clickNode(hitRow("M 缺项档")?.querySelector('[data-testid="kn6-search-name"]'), "expand hit");
    expect(q("kn6-search-detail")).toBeTruthy();
    await clickNode(q("kn-doc-copy"), "expand kn-doc-copy");
    const mText = String(writeText.mock.calls[1][0]);
    const mLine = gLines.find((l) => l.startsWith("M 缺项档")) ?? "";
    expect(mLine).toBeTruthy();
    // knG 行含固定第 2 列「所属空间」，直对以「去掉该列后」为口径（R71 唯一列差）
    expect(mLine.split(" | ")[0] + "|" + mLine.split(" | ").slice(2).join("|")).toBe(
      dataLines(mText)[0].split(" | ")[0] + "|" + dataLines(mText)[0].split(" | ").slice(1).join("|"),
    );
  });

  it("② 缺 updatedAt 文档：三个产物的行首列与短码三处逐字一致（非空、全大写自等），全页无 undefined/null、正文无裸 d_m", async () => {
    const writeText = clipStub();
    wire();
    await render(DETAIL);
    // 产物一：详情行钮串；产物二：knF 清单行
    await clickNode(detailRow("M 缺项档")?.querySelector('button[data-testid^="kn-row-copy-space-"]'), "row button");
    const btnLine = String(writeText.mock.calls[0][0]).split("\n")[1];
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF");
    const fLine = dataLines(String(writeText.mock.calls[0][0])).find((l) => l.startsWith("M 缺项档"))!;
    expect(btnLine).toBe(fLine); // （R209 同调，当帧引用位）
    // 产物三：检索面命中展开的 kn-doc-copy 行
    writeText.mockClear();
    await clickNode(hitRow("M 缺项档")?.querySelector('[data-testid="kn6-search-name"]'), "expand hit M");
    await clickNode(q("kn-doc-copy"), "expand copy M");
    const expLine = String(writeText.mock.calls[0][0]).split("\n")[1];
    const cols = (l: string) => l.split(" | ");
    expect(cols(expLine)[0]).toBe(cols(fLine)[0]); // 名称同
    expect(cols(expLine)[3]).toBe(cols(fLine)[3]); // 更新时间缺值同句「—」
    expect(cols(expLine)[3]).toBe("—");
    // 短码形态三处一致：非空、全大写自等；全 id 不进正文
    const code = cols(fLine)[4];
    expect(code).not.toBe("");
    expect(code).toBe(code.toUpperCase());
    expect(code).toBe("DM");
    expect(document.body.textContent ?? "").not.toMatch(/\bundefined\b|\bnull\b/);
    // 裸全 id 不进表体正文（?sdoc=/&doc= 地址参数是合法的复现机制，不算上屏；与主测
    // drawerText 口径同——圈定两个表体 section）
    expect(txt(q("kn3-docs"))).not.toContain("d_m");
    expect(txt(q("kn6-search"))).not.toContain("d_m");
  });

  it("③ 复制链 fetch 快照逐字不变；行内预览开合期间 kn3-page-cap 整句逐字不动（cap 位新增，行序引 R196④）", async () => {
    const writeText = clipStub();
    wire();
    await render(DETAIL);
    const u0 = urls().slice().sort().join("|");
    const cap0 = txt(q("kn3-page-cap"));
    expect(cap0).toBe("本页最多显示 50 篇（当前已加载 2 篇；复制清单也只含这些篇）");
    const row = detailRow("A 手册.pdf")!;
    // 一整套复制动作：行钮 + 预览开 + kn-doc-copy + 预览关
    await clickNode(row.querySelector('button[data-testid^="kn-row-copy-space-"]'), "row copy");
    await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "inline open");
    await clickNode(q("kn-doc-copy"), "doc copy");
    await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "inline close");
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(urls().slice().sort().join("|")).toBe(u0); // 全程零网络
    expect(txt(q("kn3-page-cap"))).toBe(cap0); // cap 整句逐字不变（与预览开合同帧首锁）
    expect(detailRow("A 手册.pdf")).toBeTruthy(); // 行在场（行序不变引 R196④）
  });
});
