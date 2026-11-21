// R206 — 预览请求契约余量护栏（纯测试单：零产品改动）。
// 查重判定（四腿逐条，锁过的引用不重写）：
// ①首屏恰 1 次列表读、无 cursor= —— 主测 knE 段 :2531 + R149 knowledge.requests.test.tsx
//   ①②（P2URL 逐字 cursor 原值、恰一次）已锁 → 引用。
// ②开抽屉恰 +1 详情读、列表腿不重取（R183 ③/R149④ listSet toBe）、预览内切文档每次
//   +1 且各指向自身（R149④ + R196 ③：d_a/d_b 各恰 1）已锁 → 引用；行内预览链 = 0 请求
//   （R125C/R149③/R196④ 快照逐字）→ 引用。
// ③关闭零请求已锁（R125C/R149/R196④）；**真缺口=「URL 只删预览参」参数面**：关抽屉后
//   loc == 开抽屉前逐字（仅少 doc=，q/ktype/space/tab/panel 原样）+ 行内预览开合全程
//   loc 一字不动（产品注释 R67/R68 声明此语义，测试侧此前零 pin——grep 无 loc 断言命中）。
// ④500 保列表+句+rid+重试恰 +1 且成功就位 —— R183 knowledge.detail.error.test.tsx
//   ①③（:105-157）已锁 → 引用；本腿吸收 R205 判定的两处窄面残差：
//   (a) 错误窗口内复制链（kn-row-copy-space-<i>/kn-doc-copy 的 docSingleCopy 串）与
//       错误发生前的样张逐字一致——错误不污染复制文本；
//   (b) 404 变体下抽屉 dl（kn3-docs-detail）title=全 id（R204 只在无错成功链锁过 title）。
// 面/族实名照旧：详情面行钮 -space- 族；kn-doc-copy=单 DocLineCopy；抽屉 kn7-preview-*；
// 缺值两式（表格/复制「—」、预览/抽屉「该字段未返回」+逐字段 title）与 403≡404 产品
// 定版未动。
// ── R251 追加（同文件、不新建；R206 例③④逐字保留）——三腿查重裁决与新增维 ──
// 腿①「抽屉开态切 ?type」拆解后仅剩一缝未锁：R224①(preview.filter.transition:125-140)
//   锁「doc+ktype 双参并立 + 面板存续 + 行换代 + 出局字段句式」；R224② 锁「关后**总
//   urls** 快照逐字」；R239②(export.detail.paging:165-176) 锁「开态切桶 **listUrls**
//   逐字 + 导出换代」——三段各锁一角，**「切桶当下总 urls 逐字 + 详情读计数不变(=1) +
//   双参同址 + 导出换代」四量同帧**未锁 → 例⑤落此。换算照落：?preview= 不存在
//   （行内预览=本地 previewKey——R206③ 已锁；带 URL 浮层=?doc=/?sdoc=）；「恰 1 次重取
//   列表」不成立→断 0 增量（本地派生，R131①/R237②）；?type→?ktype（本例点桶即写 ktype）。
// 腿②「关闭零请求+行序钮不变」＝全锁引用不复写：R196④(preview.requests:125-144) +
//   R224② + R206③（本文件，逐字保留）。
// 腿③「列表 500 预览控件 disabled+title」换算为现实：错误态复制/预览族渲染 **0 节点
//   （非 disabled）**＝R221②/R222②/R231⑤；排序头 disabled+逐字「这次没有读到这份
//   列表，现在不能排序。」＝R221②；rid 可复制＝R210④/R222②；重试恰 +1＝R183③/R221③
//   → 引用不复写（禁改产品）。
// 红线沿用：缺值两式禁统一；短码尾段全 id 仅 title；kn3-page-cap 50/M、空/null；
// 行钮分面 -space-；clipboard 桩 mockResolvedValue + unstubAllGlobals。
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
const loc = () => (q("loc")?.textContent ?? "") as string;
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const rowWith = (name: string) =>
  [...document.querySelectorAll('[data-testid="kn3-docs-row"]')].find((r) => (r.textContent ?? "").includes(name)) ?? null;

const D_FULL = { documentId: "d_full1", fileName: "全项手册.pdf", mimeType: "application/pdf", sizeBytes: 2516582, updatedAt: "2026-11-19T07:10:00Z" };
const D_MISS = { documentId: "d_miss9", fileName: "缺项档" };
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 2, status: "synced" }],
};
const wire = (detailResponder: (url: string) => Promise<unknown>) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN || url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP.asOf, documents: [D_FULL, D_MISS] });
    if (url.startsWith("/agent-api/api/documents/d_")) return detailResponder(url);
    return fail(404, "这个数据接口还没有接入。", "rid-r206");
  });
const okDetail = () => Promise.resolve({ sourceName: "全项手册原件.pdf", status: "indexed" });

describe("knowledge preview request-contract remainder (R206, gap-only)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals(); // R251 纪律位（红线：收尾 unstub；不触任何既有断言）
  });

  it("③ closing the drawer drops ONLY the doc param (q/ktype/space/tab/panel byte-identical); inline preview open/close never touches the URL at all", async () => {
    wire(okDetail);
    const BEFORE = "/knowledge?tab=spaces&panel=spaces&space=sp_x&q=%E5%A4%A7&ktype=PDF";
    const beforeLoc = "?tab=spaces&panel=spaces&space=sp_x&q=%E5%A4%A7&ktype=PDF";
    await render(BEFORE);
    expect(loc()).toBe(beforeLoc);
    const c0 = urls().length;
    // 开抽屉（点行名）：URL 多且只多 doc=
    await clickNode(rowWith("全项手册.pdf")?.querySelector('[data-testid="kn3-docs-name"]'), "open drawer");
    expect(q("kn7-preview-panel")).toBeTruthy();
    expect(loc()).toBe(`${beforeLoc}&doc=d_full1`);
    // 关抽屉：回到开抽屉前**逐字**——只删了 doc，其余参数一字未动
    await clickNode(q("kn7-preview-close"), "close drawer");
    expect(q("kn7-preview-panel")).toBeNull();
    expect(loc()).toBe(beforeLoc);
    // 行内预览开合：URL 全程一字不动（R67/R68 声明的语义首次落测试）
    const row = rowWith("全项手册.pdf")!;
    const toggle = () => row.querySelector('[data-testid="kn-doc-preview-toggle"]');
    await clickNode(toggle(), "inline open");
    expect(q("kn-doc-preview")).toBeTruthy();
    expect(loc()).toBe(beforeLoc);
    await clickNode(toggle(), "inline close");
    expect(loc()).toBe(beforeLoc);
    // 以上全链零列表重取：新增的只有两次抽屉详情读（开/关后不再+，计数由 R125C 锁语义，
    // 这里只锁「列表腿=0 增量」：spaces/documents 读条数与开抽屉前一致）
    expect(urls().filter((u) => u === SPACES).length).toBe(urls().slice(0, c0).filter((u) => u === SPACES).length);
    expect(urls().filter((u) => u === docsUrlFor("sp_x")).length).toBe(urls().slice(0, c0).filter((u) => u === docsUrlFor("sp_x")).length);
  });

  it("④(a,b) error-window copy chain stays byte-identical to the clean sample, and the 404 drawer still pins full id in dl title only", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    // 先取干净样张（无抽屉干扰的纯净渲染）
    wire(okDetail);
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x");
    const row = rowWith("全项手册.pdf")!;
    await clickNode(row.querySelector('button[data-testid^="kn-row-copy-space-"]'), "clean row copy");
    expect(writeText).toHaveBeenCalledTimes(1);
    const cleanLine = String(writeText.mock.calls[0][0]);
    await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "inline open");
    await clickNode(q("kn-doc-copy"), "clean doc copy");
    const cleanDoc = String(writeText.mock.calls[1][0]);
    expect(cleanDoc).toBe(cleanLine); // 基线自洽（R114 链）
    await clickNode(row.querySelector('[data-testid="kn-doc-preview-toggle"]'), "inline close");
    // 换入 500 错误窗（腿④(a)）：抽屉错误句在场（R183 已锁句体——只对照在场性），
    // 复制链两路仍与干净样张逐字等——错误不污染屏上数据与复制文本
    let mode: string = "busy";
    wire((url) => (url.includes("d_full1") && mode === "busy" ? fail(500, "数据服务暂时没有响应，请稍后重试。", "rid-r206-busy") : okDetail()));
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x&doc=d_full1");
    expect(q("kn7-preview-error")).toBeTruthy();
    const row500 = rowWith("全项手册.pdf")!;
    writeText.mockClear();
    await clickNode(row500.querySelector('button[data-testid^="kn-row-copy-space-"]'), "row copy in error window");
    expect(String(writeText.mock.calls[0][0])).toBe(cleanLine); // (a) 行钮串逐字不变
    await clickNode(row500.querySelector('[data-testid="kn-doc-preview-toggle"]'), "inline open (500 window)");
    await clickNode(q("kn-doc-copy"), "doc copy in error window");
    expect(String(writeText.mock.calls[1][0])).toBe(cleanDoc); // (a) 预览复制串逐字不变
    expect(row500.querySelector('[data-testid="kn3-docs-name"]')).toBeTruthy(); // 列表腿行仍在
    // (b) 404 变体：unwired 体感下 dl title 仍=全 id（正文无裸 id）——R204 只锁过成功链
    mode = "gone";
    wire((url) => (url.includes("d_full1") ? fail(404, "文档详情未接入。", "rid-r206-gone") : okDetail()));
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x&doc=d_full1");
    expect(q("kn7-preview-unwired")).toBeTruthy();
    expect(q("kn3-docs-detail")?.getAttribute("title")).toBe("d_full1"); // 全 id 仅在 title
    const panelText = (q("kn7-preview-panel")?.textContent ?? "").replace(/\s+/g, " ");
    expect(panelText).not.toContain("d_full1"); // 抽屉正文无裸 id（主测 :295 同口径的 404 变体）
  });

  // R251 例⑤（新增维）：抽屉开态（详情读成功在场）点「表格」桶——四量同帧：
  // 总 urls 逐字 + 详情读恰 1 不重取 + doc&ktype 双参同址 + 导出换代零残留。
  it("⑤ drawer open + ktype flip: TOTAL urls byte-identical, detail read count stays 1, doc&ktype coexist in URL, export regenerates (R251 appended)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    const BEFORE = "?tab=spaces&panel=spaces&space=sp_x&doc=d_full1";
    // 本例自带局部夹具（不动 R206 在库 wire/样例）：D_FULL(pdf) + 丙表.xlsx——
    // D_MISS 无 mimeType 按产品「缺值不占桶」不入场（knowledge.ts:348 注），故补 xlsx 使「表格」桶在场。
    const D_XLSX = { documentId: "d_x1", fileName: "丙表.xlsx", mimeType: "xlsx", sizeBytes: 512, updatedAt: "2026-11-19T06:00:00Z" };
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      if (url === DOCUMENTS_PLAIN || url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP.asOf, documents: [D_FULL, D_XLSX] });
      if (url === "/agent-api/api/documents/d_full1") return okDetail();
      return fail(404, "这个数据接口还没有接入。", "rid-r251");
    });
    await render(`/knowledge${BEFORE}`);
    expect(q("kn7-preview-panel")).toBeTruthy();
    const detailUrl = "/agent-api/api/documents/d_full1";
    const det0 = urls().filter((u) => u === detailUrl).length;
    expect(det0).toBe(1); // 挂载开抽屉恰一次详情读（R49/R149④ 语义在场）
    const u0 = urls().join("|");
    // 点「表格」桶（丙表入场、D_FULL(PDF) 出局）
    const norm = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
    const btn = [...document.querySelectorAll('button[data-testid^="kn-type-"]')].find((b) => norm(b).startsWith("表格"));
    await clickNode(btn, "bucket 表格 with drawer open");
    // 量一：双参同址（doc 保留 + ktype 新写）
    expect(loc()).toContain(`${BEFORE}&ktype=`);
    expect(loc()).toContain("doc=d_full1");
    // 量二/三：总 urls 逐字 + 详情读计数不变（不重取）
    expect(urls().join("|")).toBe(u0);
    expect(urls().filter((u) => u === detailUrl).length).toBe(1);
    // 面板存续 + 列表行换代零残留
    expect(q("kn7-preview-panel")).toBeTruthy();
    const visible = [...document.querySelectorAll('[data-testid="kn3-docs-row"]')].map((r) => (r.textContent ?? "").replace(/\s+/g, " ").trim());
    expect(visible.join("|")).toContain("丙表.xlsx");
    expect(visible.join("|")).not.toContain("全项手册");
    // 量四：导出换代——knF 数据行只剩缺项档行
    await clickNode(q("knF-copy"), "knF after flip");
    const lines = String(writeText.mock.calls[0][0]).split("\n").slice(1, -1);
    expect(lines).toHaveLength(1);
    expect(lines[0].startsWith("丙表.xlsx")).toBe(true);
  });


  // R251 例⑥（腿②同帧重述·可执行；语义本体锁于 R196④:104-124 与 R206③——此帧把
  // 「关抽屉零请求 + 行序与 -space- 钮 id 序列逐字不变」在**详情读成功的健康开态**上
  // 重钉一帧，非重复：R196④ 系行内 previewKey 链、R206③ 系参数面。）
  it("⑥ closing the drawer on the healthy frame: ZERO requests added and row order + row-copy ids byte-identical (R251 appended, restates R196④/R206③ in this frame)", async () => {
    const BEFORE = "?tab=spaces&panel=spaces&space=sp_x&doc=d_full1";
    wire(okDetail);
    await render(`/knowledge${BEFORE}`);
    expect(q("kn7-preview-panel")).toBeTruthy();
    const norm = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
    const names0 = [...document.querySelectorAll('[data-testid="kn3-docs-row"]')].map((r) => norm(r.querySelector('[data-testid="kn3-docs-name"]')));
    const ids0 = [...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')].map((b) => b.getAttribute("data-testid"));
    const u0 = urls().join("|");
    await clickNode(q("kn7-preview-close"), "close drawer (healthy)");
    expect(q("kn7-preview-panel")).toBeNull();
    expect(urls().join("|")).toBe(u0); // 关零请求（R49/R196 语义）
    expect([...document.querySelectorAll('[data-testid="kn3-docs-row"]')].map((r) => norm(r.querySelector('[data-testid="kn3-docs-name"]')))).toEqual(names0);
    expect([...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')].map((b) => b.getAttribute("data-testid"))).toEqual(ids0); // 钮 id 序列逐字
  });

  // R251 例⑦（腿③按现状断言：列表 500 时预览/复制族**渲染 0 节点（非 disabled）**——
  // 差异声明禁改产品；排序头才是 disabled+逐字句（句体锁于 error.isolation:199，此处
  // 同帧并置）；rid 可复制（R210④/R222②）、重试恰 +1（R183③/R221③）在本帧合并重述。）
  it("⑦ list 500 frame as-built: preview/row-copy families render ZERO nodes (not disabled), sort header disabled with verbatim sentence, rid copyable, retry adds exactly +1 (R251 appended)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    const RID = "rid-r251-list";
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [D_FULL] });
      if (url === docsUrlFor("sp_x")) return fail(500, "上游读取失败，请稍后重试。", RID);
      return fail(404, "这个数据接口还没有接入。", "rid-r251-x");
    });
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x");
    expect(q("kn3-docs-error")).toBeTruthy(); // 列表错误锚
    expect((q("kn3-docs-error")?.textContent ?? "")).toContain(`请求编号：${RID}`);
    // 现状断言：预览/复制族 0 节点（**非 disabled**——与派工措辞差异按实记录）
    expect(document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length).toBe(0);
    expect(document.querySelectorAll('[data-testid="kn-doc-preview-toggle"]').length).toBe(0);
    // 排序表头才是 disabled + 逐字句（句体引用 error.isolation:199）
    const sortHead = q("kn-sort-updated") as HTMLButtonElement | null;
    expect(sortHead?.disabled).toBe(true);
    expect(sortHead?.getAttribute("title")).toBe("这次没有读到这份列表，现在不能排序。");
    // rid 可复制：投递逐字
    const ridBtn = q("kn3-docs-error")?.querySelector('button[aria-label="复制请求编号"]');
    await clickNode(ridBtn, "copy list rid");
    expect(writeText.mock.calls[0][0]).toBe(RID);
    // 重试恰 +1 且只重取列表读（详情读不牵动）
    const u0 = urls().join("|");
    await clickNode(q("kn3-docs-retry"), "list retry");
    expect(urls().length).toBe(u0.split("|").length + 1);
    expect(urls().at(-1)).toBe(docsUrlFor("sp_x"));
  });

});
