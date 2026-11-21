// R254 — 排序×筛选叠加载体下的行序一致（①三方单帧叠链、②翻向无重复换代、③缺值行尺寸排序定位）（纯测试单·零产品改动）。
// 名实换算（产品定版，断言即现实，禁造控件/禁改产品）：
// · URL 真实键 = ?ksort/?kdir/?ktype=；派工 `?sort=updated&dir=desc&type=pdf` 为**旧只读
//   兜底**（回填链已锁 R118①/R240①——本文件走规范键，不复写兜底位）；**无 ?source=
//   控件**（未造）。派工「kn-row-copy-<i>」在测量面（空间详情=唯一有排序/桶/分页的面）
//   实名映射为 **kn-row-copy-space-<i>**（声明；检索面族不参与本文件）。
// · 无真 CSV（源级四件套 0、absent ×4、kn-list-copy 不存在——R190①:113-119）→「导出」=
//   knF-copy 数据行（docCopyText→DOC_LINE_HEADER 5 列）；createObjectURL spy 全程 0。
// · 排序/筛选**纯本地**：零新请求、请求线无排序参（R164①:142 键集 {limit,spaceId} 复跑）、
//   改动归位页 1 替换行（R131①/R237②/R244γ′δ′）——禁「恰 1 次」话术。
// · cap：kn3-page-cap 50 常量/M=在屏数（R244γ′ 语义；true-0/error/denied/非法=null）；
//   kn-space-page-cap、kn-more 不存在。缺值两式禁统一（表格/复制「—」 vs 预览「该字段
//   未返回」+title）；短码大写尾段、全 id 仅 title；时间走 updatedText；行钮分面、
//   kn-doc-copy 单控件非行数。clip 桩 mockResolvedValue + afterEach unstubAllGlobals。
// 【查重与新增维（file:line；已锁只引用）】
//  ① 叠态**三方单帧序一致**（屏上名链==knF 全链==逐位行钮串首段）——旧锁各缺一角：
//    R243α/R247①/R248①/R249① 三方首行**无排序叠参**；R253② 排序跨面**未点行钮做首段**；
//    R235② 叠加态是名筛×翻向非深链三键叠载 → 本笔落「?ksort=updated&kdir=asc&ktype=PDF
//    深链叠载帧：逐位钮首段==屏上==全链 + 三值 + cap M=4 + 键集 + 零追加读」。
//  ② 筛选侧归位/换代全锁（R131①:115-125/R235③/R244γ′δ′/R237②）→ 只引用；排序侧
//    换代旧锁 R235②（sorted-set+串确变）——本笔补**无重复行**负断言（翻向后名字去重
//    集大小==长度，任何一处「换代夹带重复」都会转红）+ 钮续号 [0..3] 不脱节。
//  ③ 缺值行「—」在**尺寸排序双方向**下的定位（新增维：缺 size 行落位此前零 pin；
//    R172/R209③/R214③ 锁的是缺值句子/链位不锁排序定位）——**实测双帧直挂：
//    nulls-last 两向末位、不随翻向镜像**，有值段严格反向，两向该行导出句逐字相同 +
//    钮位==链位；顺带首锁「**深链 kdir=asc 态点活动列=清除回默认**（失 ksort/kdir、
//    留 ktype，零新请求）」——三拍语义的清除拍自翻向态的 URL 效果此前零 pin。
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

// 深链三键叠载基准帧：updated asc + ktype=PDF；缺 size 行丙（type=pdf 故入桶）；戊 xlsx 被桶排除
const A = { documentId: "d_a", fileName: "甲大.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const B = { documentId: "d_b", fileName: "乙中.pdf", mimeType: "pdf", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const C = { documentId: "d_c", fileName: "丙缺尺寸.pdf", mimeType: "pdf", updatedAt: "2026-11-19T05:00:00Z" }; // 缺 sizeBytes → 大小「—」
const DD = { documentId: "d_d", fileName: "丁微.pdf", mimeType: "pdf", sizeBytes: 512, updatedAt: "2026-11-19T08:00:00Z" };
const W = { documentId: "d_w", fileName: "戊表.xlsx", mimeType: "xlsx", sizeBytes: 4096, updatedAt: "2026-11-19T07:30:00Z" };
const SP = { asOf: "2026-11-19T09:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 5, status: "synced" }] };
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN || url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: [A, B, C, DD, W] });
    return fail(404, "这个数据接口还没有接入。", "rid-r254-x");
  });
const STACK = "/knowledge?tab=spaces&panel=spaces&space=sp_x&ksort=updated&kdir=asc&ktype=PDF";

describe("knowledge export order under stacked sort×filter (R254)", () => {
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

  it("① 新增维：深链三键叠载（ksort=updated&kdir=asc&ktype=PDF）——逐位钮首段==屏上==knF 全链 + 三值 [4,4,4] + cap M=4 + 键集 {limit,spaceId} 零追加读", async () => {
    const writeText = clipStub();
    wire();
    await render(STACK);
    const names = detailNames();
    expect(names).toEqual(["丙缺尺寸.pdf", "乙中.pdf", "甲大.pdf", "丁微.pdf"]); // asc 精确位（戊被 PDF 桶排除）
    expect(q("kn3-docs")).toBeTruthy();
    expect(capM()).toBe(4); // M=在屏数（R244γ′ 语义）
    expect(urls().length).toBe(3); // 首屏 spaces+plain+p1，深链叠载零追加
    for (const req of urls().filter((x) => x.includes("spaceId="))) {
      expect([...new URLSearchParams(req.split("?")[1]).keys()].sort()).toEqual(["limit", "spaceId"]); // 排序/筛选键不入线（R164①:142）
    }
    await clickNode(q("knF-copy"), "knF");
    const lines = dataLines(String(writeText.mock.calls[0][0]));
    expect(lines.map((l) => l.split(" | ")[0])).toEqual(names); // 全链==屏上
    expect([names.length, btnIds().length, lines.length]).toEqual([4, 4, 4]); // 三值
    for (const i of [0, 1, 2, 3]) {
      writeText.mockClear();
      await clickNode(document.querySelector(`button[data-testid="kn-row-copy-space-${i}"]`), `btn ${i}`);
      expect(String(writeText.mock.calls[0][0]).split("\n")[1].split(" | ")[0]).toBe(names[i]); // 逐位钮首段==屏上第 i 行
    }
  });

  it("② 翻排序方向换代：无重复行夹带（新增负断言位）+ 钮续号 [0..3] 不脱节 + 链跟随 + 零新请求（筛选侧归位/换代引 R131①:115-125/R237②:170-191/R244γ′δ′ 不复写）", async () => {
    const writeText = clipStub();
    wire();
    await render(STACK);
    const names0 = detailNames();
    const u0 = urls().join("|");
    await clickNode(q("kn-sort-updated"), "flip updated asc→desc");
    const names1 = detailNames();
    expect(names1).toEqual([...names0].reverse()); // 序翻转（updated 主键唯一，严格反序）
    expect(new Set(names1).size).toBe(names1.length); // **无重复夹带**（新负断言）
    expect([...names1].sort()).toEqual([...names0].sort()); // 集合不变只改序（引 R235② 口径）
    expect(btnIds()).toEqual([0, 1, 2, 3]); // 钮续号不脱节
    await clickNode(q("knF-copy"), "knF after flip");
    expect(dataLines(String(writeText.mock.calls[0][0])).map((l) => l.split(" | ")[0])).toEqual(names1); // 链跟随新序
    expect(urls().join("|")).toBe(u0); // 全程零新请求（纯本地——禁「恰 1 次」）
  });

  it("③ 新增维：缺 size 行「—」尺寸排序双向定位（实测 nulls-last 两向末位）+ **深链 asc 态点活动列=清除回默认**（URL 失 ksort/kdir 留 ktype，新锁语义）+ 两向导出句逐字相同 + 钮位==链位", async () => {
    const writeText = clipStub();
    const sp = () => new URLSearchParams(txt(q("loc")).replace(/^\?/, ""));
    // (a) 深链 asc 帧：有值段 512/1024/2048 升序在前，缺 size 丙实测**末位**
    wire();
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x&ksort=size&kdir=asc&ktype=PDF");
    const asc = detailNames();
    expect(asc).toEqual(["丁微.pdf", "乙中.pdf", "甲大.pdf", "丙缺尺寸.pdf"]);
    const idxAsc = asc.indexOf("丙缺尺寸.pdf");
    expect(idxAsc).toBe(3);
    await clickNode(q("knF-copy"), "knF asc");
    const lineAsc = dataLines(String(writeText.mock.calls[0][0]))[idxAsc];
    expect(lineAsc.split(" | ")[0]).toBe("丙缺尺寸.pdf");
    expect(lineAsc.split(" | ")[2]).toBe("—"); // 复制行「—」式（两式禁统一红线；表格格同式引 R226②）
    // (b) 活动列(asc)上再点：**实测为清除**——ksort/kdir 双双消失、ktype 逐字留存，
    //     行序回落默认 updated 降序（丙按 updated 恰亦末位）。与表头 title 三拍语义
    //     （默认→翻向→清除）自洽：深链 asc 已是「翻向后」态，一点即清除——此前零 pin。
    const uMid = urls().length;
    await clickNode(q("kn-sort-size"), "click active column from deep-link asc");
    expect(sp().get("ksort")).toBeNull();
    expect(sp().get("kdir")).toBeNull();
    expect(sp().get("ktype")).toBe("PDF");
    expect(detailNames()).toEqual(["丁微.pdf", "甲大.pdf", "乙中.pdf", "丙缺尺寸.pdf"]); // 默认 updated desc
    expect(urls().length).toBe(uMid); // 清除纯本地零新请求
    // (c) 深链 desc 帧（独立挂载）：缺 size 行仍**末位**（nulls-last 不随方向镜像）
    writeText.mockClear();
    fetchMock.mockClear();
    wire();
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x&ksort=size&kdir=desc&ktype=PDF");
    const desc = detailNames();
    const idxDesc = desc.indexOf("丙缺尺寸.pdf");
    expect(idxDesc).toBe(3);
    expect(desc.slice(0, 3)).toEqual(["甲大.pdf", "乙中.pdf", "丁微.pdf"]); // 有值段严格反向
    await clickNode(q("knF-copy"), "knF desc");
    const lineDesc = dataLines(String(writeText.mock.calls[0][0]))[idxDesc];
    expect(lineDesc).toBe(lineAsc); // 同一行两向导出句逐字相同
    writeText.mockClear();
    await clickNode(document.querySelector(`button[data-testid="kn-row-copy-space-${idxDesc}"]`), "btn at missing row");
    expect(String(writeText.mock.calls[0][0]).split("\n")[1]).toBe(lineDesc); // 钮位==链位
  });
});
