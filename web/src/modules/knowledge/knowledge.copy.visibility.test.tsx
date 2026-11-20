// R222 — 行复制与批量入口可见性护栏（纯测试单：零产品改动，未造控件/假路由）。
// 名实红线：kn-list-copy 不存在→批量复制实名 knF-copy（详情面）/knG-copy（检索面）；
// 导出族不存在（仅 data-export="absent" SPAN+aria-hidden ×4，R190/R220 锁过）；无 ?source=；
// 行钮分面 kn-row-copy-<i>（检索）/kn-row-copy-space-<i>（详情，indexBase 全局连续）；
// 唯一详情面=抽屉 kn7-preview-*；两套缺值口径不得统一；kn3-page-cap 在 empty/error/
// denied/非法枚举止不渲染（R108/R157/R187）；clipboard 桩全 Promise（R214 教训）。
// 查重（引用不重写）：①空态行钮 0+复制器 disabled+title+零写零请求=R138④/R190④/R187；
// ②按失败面分族=R210/R211（列表 500：族渲染 0、rid 复制钮、双 rid 独立）+ R219(b)/R221①
// （抽屉 500：列表与行钮保留、独立 rid）；③三值=R142②/R176/R164②；④行内预览开合
// 序列不变=R196④。以上仅当帧最小复跑，不声称新发现。
// 新增维（本文件 (a)(b)，文件头点名）：
//  (a) **整列（kn3-docs-table 含「操作」列头）在空/错误态随体不渲染**——行钮 0 与列头
//      缺席是同一可见性事实；此前只有 R200 锁过正常态列头，缺席态零 pin（grep 无命中）；
//  (b) **抽屉开→关路径**下行复制序列、行名与 kn3-page-cap 整句逐字不变——R196④ 锁的是
//      行内预览路径，抽屉（?doc=）开合对序列/cap 的影响无 pin。
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
const rowNames = () =>
  [...document.querySelectorAll('[data-testid="kn3-docs-row"] [data-testid="kn3-docs-name"]')].map((n) => txt(n));
const btnSeq = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')]
    .map((b) => Number((b.getAttribute("data-testid") ?? "").replace(/\D/g, "")))
    .sort((a, b) => a - b);
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined); // Promise 桩——R214 教训
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  return writeText;
};

const A = { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const B = { documentId: "d_b", fileName: "B 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 2, status: "synced" }],
};
const wire = (opts: { docs?: unknown[]; listOk?: boolean; detailOk?: boolean } = {}) => {
  const listOk = opts.listOk ?? true;
  const detailOk = opts.detailOk ?? true;
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: opts.docs ?? [A, B] });
    if (url === P1URL)
      return listOk
        ? Promise.resolve({ asOf: SP.asOf, documents: opts.docs ?? [A, B] })
        : fail(500, "上游读取失败，请稍后重试。", "rid-r222-list");
    if (url === DETAIL_A)
      return detailOk
        ? Promise.resolve({ sourceName: "A 原件.pdf", status: "indexed" })
        : fail(500, "上游读取失败，请稍后重试。", "rid-r222-d");
    return fail(404, "这个数据接口还没有接入。", "rid-r222-x");
  });
};
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

describe("knowledge copy & bulk-entry visibility guards (R222)", () => {
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

  it("① 空列表（引 R138/R190④/R187 当帧复跑）+ 新增维(a)：整表含「操作」列头随体不渲染，非仅按钮消失", async () => {
    const writeText = clipStub();
    wire({ docs: [] });
    await render(DETAIL);
    // 两族行钮 0（检索面与详情面）
    expect(document.querySelectorAll('button[data-testid^="kn-row-copy"]').length).toBe(0);
    // 新增维(a)：表格与列头整体缺席（kn3-docs-table 不渲染——列可见性与钮同源）
    expect(q("kn3-docs-table")).toBeNull();
    expect(q("kn3-page-cap")).toBeNull(); // 空态 cap 不渲染（R108 口径）
    expect(q("knN-empty-text-space-docs")).toBeTruthy(); // 可读空态在位
    // 批量复制器 disabled + 逐字可读原因，点击零写零请求
    const fBtn = q("knF-copy") as HTMLButtonElement | null;
    const gBtn = q("knG-copy") as HTMLButtonElement | null;
    expect(fBtn?.disabled).toBe(true);
    expect(fBtn?.getAttribute("title")).toContain("没有可复制");
    expect(gBtn?.disabled).toBe(true);
    const c0 = urls().length;
    writeText.mockClear();
    await clickNode(fBtn, "click disabled knF");
    await clickNode(gBtn, "click disabled knG");
    expect(writeText).not.toHaveBeenCalled();
    expect(urls().length).toBe(c0);
  });

  it("② 按失败读口分面（引 R210/R219(b) 当帧复跑）：列表 500 → 族渲染 0+knF disabled+rid 可复制；抽屉 500 → 列表/行钮照常+两枚 rid 独立", async () => {
    const writeText = clipStub();
    // 路 A：列表读口 500
    wire({ listOk: false, detailOk: false });
    await render(`${DETAIL}&doc=d_a`);
    expect(q("kn3-docs-error")).toBeTruthy();
    expect(q("kn3-docs-table")).toBeNull(); // 新增维(a)在错误态同源：整表随体缺席
    // 按失败读口分面：详情面族 0；检索面另一读口成功 → 其行钮照常 2（隔离即证据）
    expect(document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length).toBe(0);
    expect(document.querySelectorAll('button[data-testid^="kn-row-copy-"]:not([data-testid*="-space-"])').length).toBe(2);
    const ridListBtn = q("kn3-docs-error")?.querySelector('button[aria-label="复制请求编号"]');
    expect(ridListBtn).toBeTruthy();
    await clickNode(ridListBtn, "copy list rid");
    expect(writeText).toHaveBeenLastCalledWith("rid-r222-list");
    // 路 B：仅抽屉详情读 500——列表/行钮保留可用
    writeText.mockClear();
    wire({ listOk: true, detailOk: false });
    await render(`${DETAIL}&doc=d_a`);
    expect(rowNames()).toEqual(["A 手册.pdf", "B 表.xlsx"]);
    expect(btnSeq()).toEqual([0, 1]);
    await clickNode(
      container.querySelectorAll('[data-testid="kn3-docs-row"]')[1].querySelector('button[data-testid^="kn-row-copy-space-"]'),
      "row copy in drawer-error window",
    );
    expect(writeText).toHaveBeenCalledTimes(1); // 行钮照常
    expect(q("kn7-preview-error")).toBeTruthy();
    const ridDrawerBtn = q("kn7-preview-error")?.querySelector('button[aria-label="复制请求编号"]');
    expect(ridDrawerBtn).toBeTruthy();
    writeText.mockClear();
    await clickNode(ridDrawerBtn, "copy drawer rid");
    expect(writeText).toHaveBeenCalledWith("rid-r222-d"); // 两枚 rid 各自独立（引 R210④）
  });

  it("③ 筛选后三值同帧（引 R142②/R176）：可见行 == 行钮数 == knF 数据行", async () => {
    const writeText = clipStub();
    wire();
    await render(`${DETAIL}&ktype=PDF`); // 只剩 A（pdf）
    const rows = rowNames().length;
    expect(rows).toBe(1);
    expect(btnSeq()).toEqual([0]); // indexBase 重编号连续
    await clickNode(q("knF-copy"), "knF copy filtered");
    expect(String(writeText.mock.calls[0][0]).split("\n").length - 2).toBe(rows);
  });

  it("④ 新增维(b)：抽屉开→关路径后，行复制序列、行名与 kn3-page-cap 整句逐字不变", async () => {
    clipStub();
    wire();
    await render(DETAIL);
    const names0 = rowNames();
    const seq0 = btnSeq();
    const cap0 = txt(q("kn3-page-cap"));
    expect(cap0).toBe("本页最多显示 50 篇（当前已加载 2 篇；复制清单也只含这些篇）");
    // 开抽屉（点行名，?doc= 写入）→ 关抽屉（close，只删 doc）
    await clickNode(rowNames0FirstRow().querySelector('[data-testid="kn3-docs-name"]'), "open drawer");
    expect(q("kn7-preview-panel")).toBeTruthy();
    expect(locOf()).toContain("doc=d_a");
    await clickNode(q("kn7-preview-close"), "close drawer");
    expect(q("kn7-preview-panel")).toBeNull();
    // 行复制序列与 cap 整句逐字不变——抽屉路径的可见性免疫（R196④ 的行内预览版对位）
    expect(rowNames()).toEqual(names0);
    expect(btnSeq()).toEqual(seq0);
    expect(txt(q("kn3-page-cap"))).toBe(cap0);
    function rowNames0FirstRow() {
      return document.querySelector('[data-testid="kn3-docs-row"]') as Element;
    }
    function locOf() {
      return (q("loc")?.textContent ?? "") as string;
    }
  });
});
