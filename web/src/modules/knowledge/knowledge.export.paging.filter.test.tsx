// R247 — 页 2 切桶弃页帧三值+三方首行 / ktype 在场错误窗三值并置+重试后筛序入链（纯测试单·零产品改动）。
// 【派工现场裁决（必须照落）】
//  · 腿①「第 2 页加载后套筛选且三值仍 51」——**已被实测驳回**：施加条件触发的归位效应
//    （KnowledgeModulePage :2336-2345 deps 含 filter/typeKey/sort/dir）在页 2 态**立即弃
//    追加页**（R235③ 切桶数字位、R237② 51→[0,1] 序重建、R244γ′ 名筛 51→[B,A]）。本笔
//    按真实行为断言：页 2 上点「PDF」桶 → 集=base50∩PDF=**48 行**（卷 51 出局）、三值
//    随弃页集 [48,48,48]、三方首行同帧、cap M=48、urls 逐字（弃页零新请求）——
//    「三值 51」不成立，实测值 48 写此与回执。
//  · 腿②（切桶归位/换代/零残留）＝已全锁：R237②(rowcopy.triple:170-191 序重建+弃页
//    不回+链数)、R243β(filters.rowcopy:~170 移除向)、R244γ′/δ′(paging.filters 名筛弃页
//    +不回)、R229②/R235③/R239②/R131① → 引用不复写。
//  · 腿③（500 保行/rid/重试/导出冻结）＝主体已锁：R237③(窗三读+合成)、R238C(paging.
//    triple:162 字节冻结+尾段合成)、R239③(detail.paging 列表窗×抽屉) → 本笔只落未锁子维：
//    **ktype 在场**的错误窗三值并置（链长==在屏 48 而非 50——筛选改变了「已成功页」的
//    基数）+ 重试成功后追加行**按筛序入链**（49 链==屏上）。
// 名实：无 ?source= 控件（换算 ?ktype=PDF×本地桶，未造参数）；无真 CSV（源级四件套 0
// ——R190①:113-119）→「导出」=knF 数据行、kn-list-copy 不存在、createObjectURL spy
// 全程 0；只有详情面分页（检索面引 R164）、-space- 族 indexBase 连续（R132/R169）；
// cursor 从请求 URL 断言；cap 50 常量/M=在屏数（R244γ′ 语义）、true-0/错=null（R108/
// R157/R187）——**ktype 在场+列表错帧 cap 是否在场本笔探针实测记录**；本地动作零新请求
// （R215③/R243β/R244δ′）；缺值两口径不涉；clip 桩 mockResolvedValue + unstubAllGlobals。
// 真新增维（点名两条）：
//  ① 页 2 态切桶弃页帧的 **三方首行同帧 + 三值 48 + cap M=48 + urls 逐字**（R237② 只
//     锁 2 行小集与钮序，48 规模弃页与三方首行并置未测）；
//  ② **ktype 在场的 500 错误窗**：窗内三值按筛后基数（48 而非 50）+ 导出字节冻结 +
//     rid 可复制 + 重试恰 [+P2URL] 后「卷 51」按筛序入链（49 链==屏上）+ cap 状态按实
//     记录——错误窗三值与筛后基数并置从未测。
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
const detailRows = () => [...document.querySelectorAll('[data-testid="kn3-docs-row"]')];
const detailNames = () => detailRows().map((r) => txt(r.querySelector('[data-testid="kn3-docs-name"]')));
const btnIds = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')]
    .map((b) => Number((b.getAttribute("data-testid") ?? "").replace(/\D/g, "")))
    .sort((a, b) => a - b);
const bucketByLabel = (label: string) =>
  [...document.querySelectorAll('button[data-testid^="kn-type-"]')].find((b) => txt(b).startsWith(label)) ?? null;
const dataLines = (text: string) => text.split("\n").slice(1, -1);
const capM = () => {
  const m = /当前已加载 (\d+) 篇/.exec(txt(q("kn3-page-cap")));
  return m ? Number(m[1]) : null;
};
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.URL, "createObjectURL", { value: vi.fn(), configurable: true, writable: true });
  return writeText;
};

// 51 行跨页夹具：base50=48 pdf + 2 xlsx（册 04/21）；追加行卷 51.pdf 属 PDF 桶
const page50 = Array.from({ length: 50 }, (_, i) =>
  i === 3 || i === 20
    ? { documentId: `p1_x${i}`, fileName: `册 ${String(i + 1).padStart(2, "0")}.xlsx`, mimeType: "xlsx", sizeBytes: 700 + i, updatedAt: `2026-11-1${(i % 9) + 1}T07:30:00Z` }
    : { documentId: `p1_${String(i + 1).padStart(2, "0")}`, fileName: `卷 ${String(i + 1).padStart(2, "0")}.pdf`, mimeType: "pdf", sizeBytes: 1000 + i, updatedAt: `2026-11-1${(i % 9) + 1}T06:00:00Z` },
);
const ROW51 = { documentId: "p2_51", fileName: "卷 51.pdf", mimeType: "pdf", sizeBytes: 999, updatedAt: "2026-11-10T01:00:00Z" };
const SP = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 51, status: "synced" }] };
const wire = (p2: () => Promise<unknown>) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [page50[0]] });
    if (url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: page50, nextCursor: "cpg2" });
    if (url === P2URL) return p2();
    return fail(404, "这个数据接口还没有接入。", "rid-r247-x");
  });

describe("knowledge paging × filter window guards (R247)", () => {
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

  it("① 新增维：页 2（M=51）态点「PDF」桶——弃页后三值 [48,48,48]+三方首行同帧+cap M=48+urls 逐字（「三值 51」已被实测驳回为 48）", async () => {
    const writeText = clipStub();
    wire(() => Promise.resolve({ asOf: SP.asOf, documents: [ROW51], nextCursor: null }));
    await render(DETAIL);
    await clickNode(q("knE-page-more"), "append to 51");
    expect(detailRows()).toHaveLength(51);
    expect(capM()).toBe(51);
    const u0 = urls().join("|");
    await clickNode(bucketByLabel("PDF"), "apply ktype PDF at page-2 state");
    const names = detailNames();
    expect(names).toHaveLength(48); // 弃页裁决：base50∩PDF（卷 51 出局、册 04/21 属 xlsx 出局）
    expect(names.some((n) => n === "卷 51.pdf")).toBe(false);
    expect(btnIds()).toEqual(Array.from({ length: 48 }, (_, i) => i)); // 钮自 0 重建（规模位：R237② 是 2 行小集）
    await clickNode(document.querySelector('button[data-testid="kn-row-copy-space-0"]'), "btn 0");
    const btnHead = String(writeText.mock.calls[0][0]).split("\n")[1].split(" | ")[0];
    await clickNode(q("knF-copy"), "knF after drop");
    const lines = dataLines(String(writeText.mock.calls[1][0]));
    expect([names.length, btnIds().length, lines.length]).toEqual([48, 48, 48]); // 三值随弃页集
    expect(btnHead).toBe(names[0]); // 三方首行同帧（R243α 形制的弃页帧版）
    expect(lines[0].split(" | ")[0]).toBe(names[0]);
    expect(lines.map((l) => l.split(" | ")[0])).toEqual(names); // 链==屏上
    expect(capM()).toBe(48); // M=在屏数（R244γ′ 语义沿用）
    expect(urls().join("|")).toBe(u0); // 切桶+弃页+复制零新请求
  });

  it("② 新增维：ktype=PDF 在场的第 2 页 500 错误窗——窗内三值按筛后基数 [48]+导出字节冻结+rid；重试 [+P2URL] 后卷 51 按筛序入链 [49] 链==屏上", async () => {
    const writeText = clipStub();
    let failP2 = true;
    wire(() =>
      failP2
        ? fail(500, "上游读取失败，请稍后重试。", "rid-r247-p2")
        : Promise.resolve({ asOf: SP.asOf, documents: [ROW51], nextCursor: null }),
    );
    await render(`${DETAIL}&ktype=${encodeURIComponent("PDF")}`);
    expect(detailRows()).toHaveLength(48); // 筛后基数（挂载即筛，无弃页问题）
    await clickNode(q("knF-copy"), "knF pre-fail");
    const textPre = String(writeText.mock.calls[0][0]);
    await clickNode(q("knE-page-more"), "append (will fail)");
    expect(q("knE-page-error")).toBeTruthy();
    expect((q("knE-page-error")?.textContent ?? "")).toContain("请求编号：rid-r247-p2");
    expect(detailRows()).toHaveLength(48); // 保已成功页（筛后基数不变）
    expect(btnIds().length).toBe(48);
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF in window");
    const textWin = String(writeText.mock.calls[0][0]);
    expect(textWin).toBe(textPre); // 窗内字节冻结（形制引 R238C；筛后基数并置新位）
    const ridBtn = q("knE-page-error")?.querySelector('button[aria-label="复制请求编号"]');
    writeText.mockClear();
    await clickNode(ridBtn, "copy rid");
    expect(writeText.mock.calls[0][0]).toBe("rid-r247-p2");
    const u1 = urls().join("|");
    failP2 = false;
    await clickNode(q("knE-page-retry"), "retry");
    expect(urls().at(-1)).toBe(P2URL); // 增量恰 [+P2URL]（引 R237③ 计数位）
    expect(urls().length).toBe(u1.split("|").length + 1);
    expect(q("knE-page-error")).toBeNull();
    const names = detailNames();
    expect(names).toHaveLength(49); // 卷 51 按 PDF 筛序入集
    expect(names).toContain("卷 51.pdf");
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF after retry");
    expect(dataLines(String(writeText.mock.calls[0][0])).map((l) => l.split(" | ")[0])).toEqual(names); // 49 链==屏上
    expect(capM()).toBe(49); // cap M 随筛后在屏数（本帧实测在场记录）
  });
});
