// R233 — 抽屉双载体（展示 dd × knL 元信息复制）对 knF 行字段级对账（纯测试单：零产品改动）。
// 名实（实测既定换算，禁造控件/禁改产品）：**无真 CSV 导出**（createObjectURL/text/csv/
// a.download/new Blob 源级 0，仅 data-export="absent"——R190①:113-119 不变量）→「列表
// 导出 CSV」= knF-copy 数据行（docCopyText→DOC_LINE_HEADER 5 列：文档名|类型|大小|更新|
// 短码）；「详情面板」= kn7 抽屉（?doc= 深链/行名点击，无独立路由），参与载体声明：
// (A) 展示字段 dd（kn7-preview-field-name/type/size/updated，源=同一派生 DocRow）与
// (B) knL-copy-meta 复制文本（docMetaCopyText 六行：文档名/所属空间/类型/大小/更新/文档
// 短码）——差异集如实记录：所属空间为 (B) 独有（knF 五列无此列；检索面 knG 第 2 列才是
// 空间口径 R71），原文位置/source/status 属 (A) 非 knF 字段（不参与对账）。
// **缺值两口径禁统一（产品定版）**：表格/复制行「—」 vs 抽屉 dd「该字段未返回」+
// 「<字段>：<原因>」title（R70 previewField）→ ①腿有值字段三方逐字 toBe，缺值字段
// 三方各断本书面。「导出」三腿全程 createObjectURL spy 0。
// 行钮分面：详情面 kn-row-copy-space-<i>（indexBase 连续，R169）；kn-doc-copy 单控件
// 不当行数。clip 桩 mockResolvedValue + afterEach unstubAllGlobals（R214 教训）。
// 查重（引用不重写）：R190①（缺席不变量）/④（空集 disabled+title+零写+零请求+spy——
// :190-205 系无抽屉帧）、R200②（列头差集）、R220（导出三缺口现状）、R226①（三载体
// type/size 人话互等+裸值负扫——系 列表×行钮×knF 三面，**抽屉双载体未入链**）、
// R230①（抽屉开帧三值+快照互等——未做**关闭帧复测**与开/关请求计数同帧）、R231②（空面
// 门，无抽屉帧）、R232（错误帧零传染）、R204①/R209/R214②/R223（跨面同源）。
// 新增维（点名 ≥2）：
//  A. **抽屉双载体 × knF 行字段级对账**：有值行 D1 的 名/类型/大小/更新/短码 五字段
//     三方逐字互等（dd 文本 == knF 列 == knL 行值），缺值行 D2 三方各书「—/该字段未
//     返回/—」+抽屉 title 原因句（226 只做过 表×钮×清单，抽屉 dd/knL 从未入链）；
//  B. 开帧与**关帧各取三值 + 首行同源**，并同帧钉「开恰 +1 详情读、关 0 增」（R49/R196
//     的计数在导出帧上的复现）；
//  C. **true-0 列表 × ?doc= 深链**双复制器同帧：knF 与 knL-copy-meta 双 disabled +
//     各 title（后者「不在已加载」句首次入锁）+ 双点击零写零请求 + cap null。
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
const loc = () => txt(q("loc"));
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const rowNodes = () => [...document.querySelectorAll('[data-testid="kn3-docs-row"]')];
const rowNames = () => rowNodes().map((r) => txt(r.querySelector('[data-testid="kn3-docs-name"]')));
const btnCount = () => document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length;
const dataLines = (text: string) => text.split("\n").slice(1, -1); // 去表头与尾空行（knF 口径）
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  const createObjectUrl = vi.fn();
  Object.defineProperty(window.URL, "createObjectURL", { value: createObjectUrl, configurable: true, writable: true });
  return { writeText, createObjectUrl };
};

const D1 = { documentId: "d_manual_m", fileName: "运维手册.pdf", mimeType: "application/pdf", sizeBytes: 2516582, updatedAt: "2026-11-19T07:10:00Z" };
const D2 = { documentId: "d_gap", fileName: "缺项档", updatedAt: "2026-11-19T05:00:00Z" }; // 缺 type+size
const SP = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 2, status: "synced" }] };
const okDetailBody = { sourceName: "运维手册原件", status: "indexed" };
const wire = (docs: unknown[]) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: docs.slice(0, 1) });
    if (url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: docs });
    if (url.startsWith("/agent-api/api/documents/d_")) return Promise.resolve(okDetailBody); // 详情读在场即可（字段对账不依赖体）
    return fail(404, "这个数据接口还没有接入。", "rid-r233-x");
  });
const openDrawer = async (name: string) => {
  await clickNode(
    rowNodes().find((r) => (r.textContent ?? "").includes(name))?.querySelector('[data-testid="kn3-docs-name"]'),
    `open drawer ${name}`,
  );
};

describe("knowledge drawer dual-carrier × list export column parity (R233)", () => {
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

  it("① 字段级三方对账（新增维A）：有值行 dd==knF 列==knL 行 五字段逐字互等 + 缺值行三书各表其身 + 抽屉/表体裸 MIME、裸字节负扫 0", async () => {
    const { writeText, createObjectUrl } = clipStub();
    wire([D1, D2]);
    await render(DETAIL);
    await openDrawer("运维手册.pdf");
    expect(q("kn7-preview-title")).toBeTruthy();
    // knF 行（载体0）
    await clickNode(q("knF-copy"), "knF");
    const f1 = dataLines(String(writeText.mock.calls[0][0])).find((l) => l.startsWith("运维手册.pdf"))!.split(" | ");
    expect(f1).toHaveLength(5); // DOC_LINE_HEADER 五列（引 R200②列标准不复写）
    // 载体A：抽屉展示 dd
    const ddName = txt(q("kn7-preview-field-name"));
    const ddType = txt(q("kn7-preview-field-type"));
    const ddSize = txt(q("kn7-preview-field-size"));
    const ddUpd = txt(q("kn7-preview-field-updated"));
    // 载体B：knL 元信息六行（前缀剥值）
    writeText.mockClear();
    await clickNode(q("knL-copy-meta"), "knL meta");
    const meta = String(writeText.mock.calls[0][0]).trim().split("\n");
    expect(meta).toHaveLength(6);
    expect(meta[1].startsWith("所属空间：")).toBe(true); // 差异集：(B) 独有列，knF 无——如实记录不判缺
    const m = (i: number) => meta[i].split("：").slice(1).join("：");
    expect([ddName, ddType, ddSize, ddUpd]).toEqual([f1[0], f1[1], f1[2], f1[3]]); // A==0 四字段
    expect([m(0), m(2), m(3), m(4)]).toEqual([f1[0], f1[1], f1[2], f1[3]]); // B==0
    expect(m(5)).toBe(f1[4]); // 短码互等（大写人尾段形制引 R197；全 id 只在 title）
    expect(f1[4]).not.toBe("d_manual_m"); // 屏上/串内非全 id
    // 人话样张 + 负向扫描（裸值只许进 title——R226①-a 同法，抽屉帧为新面）
    expect(ddType).toBe("PDF");
    expect(ddSize).toBe("2.4 MB");
    const visible = `${txt(q("kn3-docs"))}${txt(q("kn7-preview-panel"))}`;
    expect(visible).not.toMatch(/application\/[a-z0-9.+-]+/i);
    expect(visible).not.toContain("2516582");
    // 缺值行 D2：三书各表其身（两口径禁统一——按实拆，不伪造全等）
    await clickNode(q("kn7-preview-close"), "close");
    await openDrawer("缺项档");
    expect(txt(q("kn7-preview-field-type"))).toBe("该字段未返回");
    expect(q("kn7-preview-field-type")?.getAttribute("title")).toContain("类型："); // 「<字段>：<原因>」句形
    expect(txt(q("kn7-preview-field-size"))).toBe("该字段未返回");
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF gap");
    const f2 = dataLines(String(writeText.mock.calls[0][0])).find((l) => l.startsWith("缺项档"))!.split(" | ");
    expect([f2[1], f2[2]]).toEqual(["—", "—"]); // 复制行「—」
    const cellType = txt(rowNodes().find((r) => (r.textContent ?? "").includes("缺项档"))?.querySelector('[data-testid="kn3-docs-type"]'));
    expect(cellType).toBe("—"); // 表格「—」
    writeText.mockClear();
    await clickNode(q("knL-copy-meta"), "knL gap");
    const meta2 = String(writeText.mock.calls[0][0]).trim().split("\n");
    expect(meta2[2]).toBe("类型：—");
    expect(meta2[3]).toBe("大小：—"); // (B) 复制文本随复制行口径
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it("② 开帧与关帧各取三值+首行同源，开恰 +1 详情读、关 0 增（新增维B；快照互等形制引 R230①不复写）", async () => {
    const { writeText, createObjectUrl } = clipStub();
    wire([D1, D2]);
    const detailUrl = "/agent-api/api/documents/d_manual_m";
    await render(DETAIL);
    const c0 = urls().filter((u) => u === detailUrl).length;
    const u0 = urls().length;
    await openDrawer("运维手册.pdf");
    expect(loc()).toContain("doc=d_manual_m");
    expect(urls().filter((u) => u === detailUrl).length).toBe(c0 + 1); // 开恰 +1（R49 设计）
    expect(urls().length).toBe(u0 + 1); // 且只增这一条
    await clickNode(q("knF-copy"), "knF open");
    const openLines = dataLines(String(writeText.mock.calls[0][0]));
    expect([rowNames().length, btnCount(), openLines.length]).toEqual([2, 2, 2]); // 开帧三值
    expect(openLines[0].split(" | ")[0]).toBe(rowNames()[0]); // 首行同源
    writeText.mockClear();
    await clickNode(q("kn7-preview-close"), "close");
    expect(loc()).not.toContain("doc=");
    expect(urls().length).toBe(u0 + 1); // 关 0 增（R196 契约在导出帧上的复现）
    await clickNode(q("knF-copy"), "knF closed");
    const closedLines = dataLines(String(writeText.mock.calls[0][0]));
    expect([rowNames().length, btnCount(), closedLines.length]).toEqual([2, 2, 2]); // 关帧三值复测
    expect(closedLines[0].split(" | ")[0]).toBe(rowNames()[0]);
    expect(closedLines).toEqual(openLines); // 开/关两帧导出逐行互等
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it("③ true-0 列表 × ?doc= 深链：knF 与 knL-copy-meta 双 disabled+双 title（knL「不在已加载」句首次）+ 双点击零写零请求 + cap null（新增维C；R231② 无抽屉帧引用）", async () => {
    const { writeText, createObjectUrl } = clipStub();
    wire([]); // 列表真 0
    await render(`${DETAIL}&doc=d_manual_m`);
    expect(q("kn3-page-cap")).toBeNull(); // 空态不渲染（R108/R157/R187 口径，当帧在场性复跑）
    const f = q("knF-copy") as HTMLButtonElement | null;
    expect(f?.disabled).toBe(true);
    expect(f?.getAttribute("title")).toContain("没有可复制");
    const l = q("knL-copy-meta") as HTMLButtonElement | null;
    expect(l).toBeTruthy(); // 深链行缺席时抽屉仍开（row null 态）
    expect(l?.disabled).toBe(true); // 新增位：knL 门同帧 disabled
    expect(l?.getAttribute("title")).toContain("不在已加载"); // copyGates :150 句的模块套件首锁
    const c0 = urls().length;
    await clickNode(f, "click knF");
    await clickNode(l, "click knL");
    expect(writeText).not.toHaveBeenCalled(); // 双零写
    expect(urls().length).toBe(c0); // 双零请求（深链挂载读已在 c0 内）
    expect(createObjectUrl).not.toHaveBeenCalled();
  });
});
