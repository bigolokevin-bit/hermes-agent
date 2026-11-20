// R224 — 浮层 × 筛选变更过渡护栏（纯测试单：零产品改动）。
// 名实换算（grep 实测，文件头逐条）：
// · **无 ?preview= 参数**（"preview" 在产品源零命中）：行内预览是组件本地态 previewKey
//   （KnowledgeModulePage.tsx:921/:931/:950 一带），开合不写 URL——派工①的「URL 保
//   preview 与 type 两参」换算为：在真实带 URL 的浮层=抽屉 ?doc= 打开态下切 ?ktype=，
//   断言 URL 同含 doc= 与 ktype=；
// · 类型键实名 ktype（旧 type 只读兜底、清除双删）；「切筛选后取数」实测 0 次新增
//   （本地过滤，读口不吃 q/ktype）——③按真实计数断言，不制造请求；
// · kn3-page-cap：有行随 M 更新整句、筛空/非法态不渲染（R108/R157/R187）；-more 仅
//   M==50；抽屉浮层在行被筛掉时**面板不消失**、字段落「这条不在当前已加载的列表里」
//   句式（openRow=null 分支）——按产品现状断言；
// · kn-doc-copy 不在抽屉（R223 已记）；两套缺值口径不统一；短码大写尾段、全 id 仅 title；
//   行钮族 kn-row-copy-space-<i>；导出族 absent ×4 未造控件；clipboard 桩 Promise +
//   afterEach unstubAllGlobals。
// 查重（引用不重写）：R149/R183/R205/R217/R223（复制与请求链）、R196④（行内预览开合
// 行序不变）、R222④（抽屉开→关 序列/cap 免疫——同筛选态版本）、R207(a)（筛选后复制
// 列换代）、R218（筛选×计数）、R138/R190④（空态 disabled+零写）。
// 新增维（grep 零命中）：(a) **抽屉打开态下切类型桶的交互**——面板存续 + 行出局时 dd
// 落「不在已加载列表」句式 + cap 随新 M 更新 + URL 双参并立；(b) **非法枚举清空回退
// 过渡**——0 行→2 行全程 urls 零增量、面板存续无错误锚（派工「浮层若原开则已关闭」
// 与产品不符：清筛选不动 doc 参，按现状断言并记差异）。
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
const click = (testid: string) => clickNode(document.querySelector(`[data-testid="${testid}"]`), testid);

const q = (testid: string) => document.querySelector(`[data-testid="${testid}"]`);
const txt = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const loc = () => (q("loc")?.textContent ?? "") as string;
const params = () => new URLSearchParams(loc());
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const rowNames = () =>
  [...document.querySelectorAll('[data-testid="kn3-docs-row"] [data-testid="kn3-docs-name"]')].map((n) => txt(n));
const btnSeq = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')]
    .map((b) => Number((b.getAttribute("data-testid") ?? "").replace(/\D/g, "")))
    .sort((a, b) => a - b);
const bucketBtn = (label: string) => {
  const buttons = [...document.querySelectorAll('[data-testid="kn-type-row"] button')] as HTMLButtonElement[];
  return buttons.find((b) => (b.childNodes[0]?.textContent ?? "").trim() === label);
};

const A = { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "application/pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const B = { documentId: "d_b", fileName: "B 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 2, status: "synced" }],
};
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN || url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: [A, B] });
    return fail(404, "这个数据接口还没有接入。", "rid-r224");
  });
const BASE = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

describe("knowledge overlay × filter transition guards (R224)", () => {
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

  it("①+新增维(a) 抽屉打开态下切类型桶：面板存续（行出局→不在列表句式）、列表换代、cap 随 M 更新、URL 同含 doc 与 ktype", async () => {
    wire();
    await render(`${BASE}&doc=d_a`); // 抽屉开（A）
    expect(q("kn7-preview-panel")).toBeTruthy();
    expect(txt(q("kn7-preview-title"))).toBe("A 手册.pdf");
    // 切「表格」桶：A 出局、B 入场
    await clickNode(bucketBtn("表格"), "bucket 表格");
    const p = params();
    expect(p.get("doc")).toBe("d_a"); // URL 双参并立（浮层参与筛选参）
    expect(p.get("ktype")).toBe("表格");
    expect(rowNames()).toEqual(["B 表.xlsx"]); // 逐元素换代
    // 面板不消失；行出局后字段落「不在已加载列表」句式（openRow=null 分支现状）
    expect(q("kn7-preview-panel")).toBeTruthy();
    expect(txt(q("kn7-preview-field-type"))).toBe("该字段未返回");
    expect(q("kn7-preview-field-type")?.getAttribute("title")).toBe("类型：这条不在当前已加载的列表里"); // previewField 合成句式（R125 统一）
    // cap 随新 M 整句更新（有行态）
    expect(txt(q("kn3-page-cap"))).toBe("本页最多显示 50 篇（当前已加载 1 篇；复制清单也只含这些篇）");
    expect(q("kn3-page-cap-more")).toBeNull();
  });

  it("②+新增维(a)续 关闭浮层后序列复原：行名/钮号与关前逐字等、urls 排序快照零增量（贴前后计数）", async () => {
    wire();
    await render(`${BASE}&doc=d_a`);
    await clickNode(bucketBtn("表格"), "bucket 表格"); // 先进入筛选变更后的状态
    const namesBefore = rowNames();
    const seqBefore = btnSeq();
    const c0 = urls().length;
    const u0 = urls().slice().sort().join("|");
    await click("kn7-preview-close");
    expect(q("kn7-preview-panel")).toBeNull();
    expect(params().has("doc")).toBe(false); // 关只删 doc，ktype 留场
    expect(params().get("ktype")).toBe("表格");
    expect(rowNames()).toEqual(namesBefore);
    expect(btnSeq()).toEqual(seqBefore); // 连续 [0]
    expect(urls().length).toBe(c0);
    expect(urls().slice().sort().join("|")).toBe(u0); // 前后计数：c0→c0（关闭零请求）
  });

  it("③ 非法枚举筛到 0 行再清除：全程 urls 零增量（实测 0 次，非「恰 1 次」）、空态句与 data-len 同源、面板存续无错误锚（清筛选不动 doc——与派工预期差异按现状记）", async () => {
    wire();
    await render(`${BASE}&doc=d_a&ktype=__nope__`);
    const c0 = urls().length;
    expect(rowNames()).toEqual([]);
    expect(q("kn3-docs")?.getAttribute("data-len")).toBe("0"); // 空态句与 data-len 同源
    expect(q("kn-type-empty")).toBeTruthy();
    expect(q("kn3-page-cap")).toBeNull(); // 筛空不渲染（R108/R157 口径）
    expect(q("kn7-preview-panel")).toBeTruthy(); // 抽屉仍在（doc 参合法在场，行不在集内）
    expect(q("kn7-preview-error")).toBeNull();
    expect(q("kn3-docs-error")).toBeNull();
    // 清筛选出口 → 2 行复原、cap 回来、钮号 [0,1] 连续
    await click("kn-type-clear");
    expect(rowNames()).toEqual(["A 手册.pdf", "B 表.xlsx"]);
    expect(btnSeq()).toEqual([0, 1]);
    expect(txt(q("kn3-page-cap"))).toBe("本页最多显示 50 篇（当前已加载 2 篇；复制清单也只含这些篇）");
    // 真实增量：0（本地清线不触发任何取数；派工「恰 1 次」不成立）
    expect(urls().length).toBe(c0);
    expect(urls().some((u2) => u2.includes("cursor="))).toBe(false);
    expect(q("kn7-preview-panel")).toBeTruthy(); // 现状：清筛选不动 doc——面板存续
  });
});
