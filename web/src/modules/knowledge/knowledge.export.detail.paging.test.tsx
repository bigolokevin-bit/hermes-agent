// R239 — 抽屉 × 分页导出三组合帧护栏（纯测试单：零产品改动，未造控件）。
// 名实（产品定版）：三腿全落**空间详情面**（唯一分页面 knE-page-*、行钮 -space- 族，
// indexBase 全局连续；检索面无分页不参与——声明）；「详情」= kn7 抽屉（?doc=，行名点击
// 开；开恰 +1 既存详情读、关 0——R49/R196/R236①），**列表请求集合逐字不变**是唯一
// 合法口径（不宣称总量全零）；无真 CSV（源级四件套 0——R190①:113-119）→「导出」= knF
// 数据行（docCopyText 5 列）、createObjectURL 全程 spy 0、a.download/kn-export-name/
// Blob.type/BOM 四缺口维持缺席（R197/R220 锁）；?type=pdf 换算 ?ktype=（旧兜底双删
// ——:3549-3551）；cursor 只在组件态——从请求 URL 断言；51 行跨页夹具（R216/R229）；
// cap 50 常量槽/M 可变位、true-0/错/拒/非法=null（R108/R157/R187）；缺值两口径不统一
// （本轮不涉）；clip 桩 mockResolvedValue + unstubAllGlobals（R214）。
// 查重（引用不重写）：R229①（分页三值+名链+首末行）、R230①②（无分页抽屉开帧三值+
// 快照互等+换档 +1）、R236①（开→关→重开三帧互等）、R237②③（切桶序重建/弃页 +
// 500 窗三读冻结/重试合成）、R238A/B/C（前缀不变性/换代==直链互等/窗内字节冻结+尾段
// 合成）、R221①（**详情**错误窗×列表健康）、R232①（详情 500 窗内追加成功链）、
// R213/R216①④/R131①③/R142①/R183/R190/R197④/R204/R164/R169。
// 本文件只打三张**从未同帧**的组合牌（新增维点名）：
//  A. **抽屉开态 × M=51**：四值同帧（表体/data-len/钮/导出行）+ 首行==屏上首行 +
//     导出全文逐字==开抽屉前快照（R230① 形制在 2 行帧、R229① 无抽屉——51 帧×抽屉
//     组合未测）；
//  B. **抽屉开态切桶的源行出局过渡态**：中途 ktype 使抽屉源行离开 shown——抽屉**不卸载**
//     （列表级动作不改 ?doc=）而导出换代零旧行、行数==新表体、列表请求集合逐字
//     （R233③ 是深链出生缺席态、R229②/R237② 无抽屉——**过渡态**未测）；
//  C. **列表 500 窗 × 抽屉开态**（R221① 的反向互斥）：翻页失败不卸载已开抽屉、窗内
//     导出逐字节冻结==失败前且逐行==屏上（不产半页）、rid 可复制、重试恰 [+P2URL]
//     后四值与导出同步 51、抽屉全程在场。
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
const P2URL = `${P1URL}&cursor=cpg2`;
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
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const listUrls = () => urls().filter((u) => !u.startsWith("/agent-api/api/documents/d_")).join("|");
const rowNodes = () => [...document.querySelectorAll('[data-testid="kn3-docs-row"]')];
const rowNames = () => rowNodes().map((r) => txt(r.querySelector('[data-testid="kn3-docs-name"]')));
const btnCount = () => document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length;
const bucketByLabel = (label: string) =>
  [...document.querySelectorAll('button[data-testid^="kn-type-"]')].find((b) => txt(b).startsWith(label)) ?? null;
const dataLines = (text: string) => text.split("\n").slice(1, -1);
const openDrawer = async (name: string) => {
  await clickNode(
    rowNodes().find((r) => (r.textContent ?? "").includes(name))?.querySelector('[data-testid="kn3-docs-name"]'),
    `open drawer ${name}`,
  );
};
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.URL, "createObjectURL", { value: vi.fn(), configurable: true, writable: true });
  return writeText;
};

const page50 = Array.from({ length: 50 }, (_, i) =>
  i === 3 || i === 20
    ? { documentId: `p1_x${i}`, fileName: `册 ${String(i + 1).padStart(2, "0")}.xlsx`, mimeType: "xlsx", sizeBytes: 700 + i, updatedAt: `2026-11-1${(i % 9) + 1}T07:00:00Z` }
    : { documentId: `p1_${String(i + 1).padStart(2, "0")}`, fileName: `卷 ${String(i + 1).padStart(2, "0")}.pdf`, mimeType: "pdf", sizeBytes: 100 + i, updatedAt: `2026-11-1${(i % 9) + 1}T06:00:00Z` },
);
const ROW51 = { documentId: "p2_51", fileName: "卷 51.pdf", mimeType: "pdf", sizeBytes: 999, updatedAt: "2026-11-10T01:00:00Z" };
const SP = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 51, status: "synced" }] };
const wirePaged = (opts: { p2?: () => Promise<unknown> } = {}) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: page50.slice(0, 2) });
    if (url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: page50, nextCursor: "cpg2" });
    if (url === P2URL) return (opts.p2 ?? (() => Promise.resolve({ asOf: SP.asOf, documents: [ROW51], nextCursor: null })))();
    if (url.startsWith("/agent-api/api/documents/d_")) return Promise.resolve({ sourceName: "原件", status: "indexed" });
    return fail(404, "这个数据接口还没有接入。", "rid-r239-x");
  });

describe("knowledge drawer × paging export combo frames (R239)", () => {
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

  it("① 新增维A：抽屉开态 × M=51 四值同帧 + 首行==屏上首行 + 导出全文逐字==开前快照（形制引 R230①，51×抽屉组合首帧）", async () => {
    const writeText = clipStub();
    wirePaged();
    await render(DETAIL);
    await clickNode(q("knE-page-more"), "append to 51");
    expect(urls().filter((u) => u === P2URL)).toHaveLength(1);
    await clickNode(q("knF-copy"), "knF pre-drawer");
    const pre = String(writeText.mock.calls[0][0]);
    await openDrawer("卷 01.pdf");
    expect(q("kn7-preview-panel")).toBeTruthy(); // 抽屉开（标题句引 R196③）
    const list0 = listUrls();
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF drawer-open");
    const open = String(writeText.mock.calls[0][0]);
    expect(open).toBe(pre); // 开抽屉不动导出内容（51 帧组合位）
    expect(dataLines(open)).toHaveLength(51);
    expect([rowNames().length, Number(q("kn3-docs")?.getAttribute("data-len")), btnCount(), dataLines(open).length]).toEqual([51, 51, 51, 51]); // 四值同帧
    expect(dataLines(open)[0].split(" | ")[0]).toBe(rowNames()[0]); // 首行==屏上首行
    expect(listUrls()).toBe(list0); // 列表集合逐字（详情读 +1 属既存设计——引 R49/R236①）
  });

  it("② 新增维B：抽屉开态切桶「表格」=源行中途出局——抽屉不卸载 + 导出换代零旧行、行数==新表体、列表请求集合逐字（过渡态 vs R233③ 出生态）", async () => {
    const writeText = clipStub();
    wirePaged();
    await render(DETAIL);
    await clickNode(q("knE-page-more"), "append");
    await openDrawer("卷 01.pdf");
    const list0 = listUrls();
    await clickNode(bucketByLabel("表格"), "ktype 表格 with drawer open");
    expect(q("kn7-preview-panel")).toBeTruthy(); // 列表级切桶不改 ?doc=——抽屉在场（过渡态首锁）
    const names = rowNames();
    expect(names).toEqual(["册 04.xlsx", "册 21.xlsx"]); // 归位页 1 的表格集（弃页引 R237②）
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF after switch");
    const text = String(writeText.mock.calls[0][0]);
    expect(dataLines(text).map((l) => l.split(" | ")[0])).toEqual(names); // 行数==新表体
    expect(text).not.toContain("卷 01.pdf"); // 换代无旧行
    expect(text).not.toContain("卷 51"); // 追加页弃置位复跑（引 R237②）
    expect(listUrls()).toBe(list0); // 列表请求集合逐字（零新请求；不宣称详情读零）
  });

  it("③ 新增维C：列表 500 窗 × 抽屉开态（R221① 反向互斥）——翻页失败不卸载抽屉、窗内导出字节冻结逐行==屏上、rid 可复制、重试 [+P2URL] 后四值与导出同步 51", async () => {
    const writeText = clipStub();
    let failP2 = true;
    wirePaged({
      p2: () =>
        failP2
          ? fail(500, "上游读取失败，请稍后重试。", "rid-r239-p2")
          : Promise.resolve({ asOf: SP.asOf, documents: [ROW51], nextCursor: null }),
    });
    await render(DETAIL);
    await openDrawer("卷 01.pdf");
    await clickNode(q("knF-copy"), "knF pre-fail");
    const textPre = String(writeText.mock.calls[0][0]);
    await clickNode(q("knE-page-more"), "append (will fail)");
    expect(q("knE-page-error")).toBeTruthy();
    expect(q("kn7-preview-panel")).toBeTruthy(); // **反向互斥新位**：列表窗不卸载已开抽屉
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF in window");
    const textWin = String(writeText.mock.calls[0][0]);
    expect(textWin).toBe(textPre); // 窗内冻结到字节（形制引 R238C；组合帧新）
    expect(dataLines(textWin).map((l) => l.split(" | ")[0])).toEqual(rowNames()); // 逐行==屏上（不产半页/空页）
    expect(textWin).not.toContain("卷 51");
    const ridBtn = q("knE-page-error")?.querySelector('button[aria-label="复制请求编号"]');
    await clickNode(ridBtn, "copy rid");
    expect(writeText.mock.calls.at(-1)![0]).toBe("rid-r239-p2"); // rid 可复制（引 R237③）
    failP2 = false;
    const c0 = urls().length;
    await clickNode(q("knE-page-retry"), "retry");
    expect(urls().length).toBe(c0 + 1);
    expect(urls().at(-1)).toBe(P2URL); // 增量恰 [+P2URL]
    expect(q("knE-page-error")).toBeNull();
    expect([rowNames().length, Number(q("kn3-docs")?.getAttribute("data-len")), btnCount()]).toEqual([51, 51, 51]);
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF after retry");
    const post = dataLines(String(writeText.mock.calls[0][0]));
    expect(post).toHaveLength(51);
    expect(post.slice(0, 50)).toEqual(dataLines(textWin)); // 前缀==窗前（合成引 R238C）
    expect(post[50].split(" | ")[0]).toBe("卷 51.pdf");
    expect(q("kn7-preview-panel")).toBeTruthy(); // 抽屉全程在场
  });
});
