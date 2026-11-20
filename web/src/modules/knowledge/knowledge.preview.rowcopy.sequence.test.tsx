// R225 — 行内预览打开态下行复制序列/播报器归属护栏（纯测试单：零产品改动）。
// 名实（按实测，禁造 id）：派工三例全部落**空间详情面**——该行钮实名 `kn-row-copy-space-<i>`
// （`kn-row-copy-<i>` 属检索/全局面）；行内预览宿主也是详情面（kn-doc-preview-toggle →
// kn-doc-preview-*），knE-page-* 分页与 kn3-page-cap 同在此面。播报器为**每面单具**
// （kn-row-copy-space-status / kn-row-copy-status，role=status+aria-live）——「归属
// 不错位」= 点本面行钮只动本面播报器（单具形状 R167 已锁 → 引用；跨面在预览打开态下
// 的归属为本文件新增维）。无 ?preview=（行内预览=本地 previewKey，R68 锁）；本地动作
// 与复制点击零请求；cap 整句 50 常量/M 可变、empty/error/非法态不渲染；kn-doc-copy
// 单控件非行数；文本单点 docSingleCopy/docLine、时间 updatedText、缺值「—」。
// ③ 按 R216 先例用 51 行跨页夹具（P1 恰 50）让 knE-page-more 真渲染。
// 查重（引用不重写）：R132（indexBase 重编/后缀族）、R167:114-127 附近（每面单播报器
// 形状 + 键盘面）、R169（跨组不重号）、R196④（预览开合行序/钮快照不变）、R216①
// （51 行 append 后四值+钮 [0..50]）、R223（逐行链）、R224（浮层×筛选过渡）。
// 新增维（逐条点名）：
//  ① 预览打开态下「钮 i 与表体第 i 行一一归属」几何对（button.closest("tr") 与行名
//     数组同序——R216 只数序列连续，未锁行内归属）+ 预览打开态下跨面播报器归属
//     （点详情面钮 → 检索面 status 不响）；
//  ② 关闭预览后**播报器文本保持**（不随预览卸载被清——R167 只锁成功播报，未锁关后
//     留存位）+ 行序/钮/cap 逐字 + 零请求；
//  ③ append 后对**新行**（第 51 行）的行钮文本与 knF 清单新行逐字直对（R216 锁了链的
//     旧页行，未锁 append 新增行入链）+ append 后开新行预览再点钮，播报器仍只归详情面。
// clipboard 桩全 Promise，afterEach unstubAllGlobals（R214/R210 教训）。
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
const P2URL = `${P1URL}&cursor=cs5`;

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
const detailRows = () => [...container.querySelectorAll('[data-testid="kn3-docs-row"]')];
const rowNames = () => detailRows().map((r) => txt(r.querySelector('[data-testid="kn3-docs-name"]')));
const btnAt = (i: number) => container.querySelector(`button[data-testid="kn-row-copy-space-${i}"]`);
const btnIds = () =>
  [...container.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')]
    .map((b) => Number((b.getAttribute("data-testid") ?? "").replace(/\D/g, "")))
    .sort((a, b) => a - b);
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  return writeText;
};

const page50 = Array.from({ length: 50 }, (_, i) => ({
  documentId: `p1_${String(i + 1).padStart(2, "0")}`,
  fileName: `册 ${String(i + 1).padStart(2, "0")}.pdf`,
  mimeType: "application/pdf",
  sizeBytes: 100 + i,
  updatedAt: `2026-11-1${(i % 9) + 1}T07:00:00Z`,
}));
const ROW51 = { documentId: "p2_51", fileName: "册 51.pdf", mimeType: "pdf", sizeBytes: 999, updatedAt: "2026-11-10T02:00:00Z" };
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 51, status: "synced" }],
};
const wirePaged = (opts: { p2Fail?: boolean } = {}) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [page50[0], page50[1]] }); // 检索面小样，供播报器归属
    if (url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: page50, nextCursor: "cs5" });
    if (url === P2URL)
      return opts.p2Fail
        ? fail(500, "上游读取失败，请稍后重试。", "rid-r225-p2")
        : Promise.resolve({ asOf: SP.asOf, documents: [ROW51], nextCursor: null });
    return fail(404, "这个数据接口还没有接入。", "rid-r225-x");
  });
const BASE = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

describe("knowledge inline-preview rowcopy sequence & announcer attribution (R225)", () => {
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

  it("① 预览打开态：钮 i 与表体第 i 行一一归属（closest tr 同序）+ 点本面钮只响本面播报器（跨面归属新增维）", async () => {
    const writeText = clipStub();
    wirePaged();
    await render(BASE);
    // 打开第 0 行的行内预览（本地态，不写 URL——R68/R196 口径引用）
    await clickNode(btnAt(0)?.closest("tr")?.querySelector('[data-testid="kn-doc-preview-toggle"]'), "open inline preview row0");
    expect(q("kn-doc-preview")).toBeTruthy();
    const names = rowNames();
    // 几何对：每颗钮的宿主行 == 表体同序号行（新增维：预览打开态下）
    for (const i of [0, 1]) {
      const host = btnAt(i)?.closest("tr");
      expect(host, `button ${i} hosted`).toBe(detailRows()[i]);
      expect(txt(host?.querySelector('[data-testid="kn3-docs-name"]'))).toBe(names[i]);
    }
    expect(btnIds()).toEqual(Array.from({ length: 50 }, (_, i) => i)); // 首屏即满一页 50 条
    // 播报器归属：点详情面钮 → 详情面 status 变「已复制」、检索面 status 保持空
    await clickNode(btnAt(1), "row copy idx1");
    expect(txt(q("kn-row-copy-space-status"))).toBe("已复制");
    expect(txt(q("kn-row-copy-status"))).toBe("");
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it("② 关闭预览后：播报器文本保持（R167 成功播报关后留存位）、行序/钮序列/cap 整句逐字不变、urls 零增量", async () => {
    const writeText = clipStub();
    wirePaged();
    await render(BASE);
    await clickNode(btnAt(0), "row copy idx0");
    expect(txt(q("kn-row-copy-space-status"))).toBe("已复制");
    await clickNode(detailRows()[0].querySelector('[data-testid="kn-doc-preview-toggle"]'), "open preview");
    const names0 = rowNames();
    const ids0 = btnIds();
    const cap0 = txt(q("kn3-page-cap"));
    const c0 = urls().length;
    await clickNode(detailRows()[0].querySelector('[data-testid="kn-doc-preview-toggle"]'), "close preview");
    expect(q("kn-doc-preview")).toBeNull();
    // 播报器不随预览卸载清空（新增维）
    expect(txt(q("kn-row-copy-space-status"))).toBe("已复制");
    expect(rowNames()).toEqual(names0);
    expect(btnIds()).toEqual(ids0);
    expect(txt(q("kn3-page-cap"))).toBe(cap0);
    expect(urls().length).toBe(c0); // 预览开合与关闭全程零请求
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it("③ append 后（51 行跨页夹具）：钮 0..50 连续无重复、新行钮文本与 knF 新行逐字直对、append 后开新行预览再点钮播报器仍只归详情面", async () => {
    const writeText = clipStub();
    wirePaged();
    await render(BASE);
    await clickNode(q("knE-page-more"), "load more");
    expect(urls().filter((u) => u === P2URL)).toHaveLength(1); // append 恰一次翻页读
    expect(rowNames()).toHaveLength(51);
    expect(btnIds()).toEqual(Array.from({ length: 51 }, (_, i) => i)); // 0..50 连续（引 R216 再复跑）
    expect(txt(q("kn3-page-cap"))).toBe("本页最多显示 50 篇（当前已加载 51 篇；复制清单也只含这些篇）"); // cap 与可复制行数一致
    // 新行（第 51 行「册 51.pdf」）入链：其钮文本 == knF 清单对应行（新增维）
    await clickNode(btnAt(50), "row copy idx50 (appended)");
    const appendedLine = String(writeText.mock.calls[0][0]).split("\n")[1];
    expect(appendedLine.split(" | ")[0]).toBe("册 51.pdf");
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF after append");
    const fLines = String(writeText.mock.calls[0][0]).split("\n").slice(1, -1);
    expect(fLines[50]).toBe(appendedLine); // 逐字直对
    expect(fLines).toHaveLength(51);
    // append 后开新行预览再点钮：详情面 status 独响、检索面保持空（跨面归属在 51 行态仍成立）
    await clickNode(detailRows().find((r) => (r.textContent ?? "").includes("册 51.pdf"))?.querySelector('[data-testid="kn-doc-preview-toggle"]'), "open preview row51");
    writeText.mockClear();
    await clickNode(btnAt(0), "row copy idx0 after append+preview");
    expect(txt(q("kn-row-copy-space-status"))).toBe("已复制");
    expect(txt(q("kn-row-copy-status"))).toBe("");
    // 复制/预览全程零网络（除那一次真实的下一页读）
    expect(urls().filter((u) => u.includes("cursor="))).toHaveLength(1);
  });
});
