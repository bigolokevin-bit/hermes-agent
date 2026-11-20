// R228 — 类型筛选跨面互不污染 + 非法枚举双路 + 旧键兜底换桶共存（纯测试单：零产品改动）。
// 名实（先实测换算，未造控件）：本模块**无 ?source= 控件**（source 只是空间行「来源」列
// 标签），类型筛选真实键 = ?ktype=（人话桶名），旧 ?type= 只读兜底、清除双删
// （KnowledgeModulePage :3549-3551/:3660-3670 实测）；「全局列表」= 检索面 kn6-search-*
// （行钮 kn-row-copy-<i>，q 按文件名本地过滤，引 R164 夹具实证）；「空间详情」=
// ?tab=spaces&panel=spaces&space=<id>（kn3-docs-*、桶 kn-type-*、行钮 -space- 族）；
// 只有详情面有 knE-page-*。本地筛选零请求；documents 读密钥集恰 {limit,spaceId}
// （R164①:142 已锁 → 引用不重写）。两套缺值口径未涉本轮；clip 桩 Promise+unstub。
// 查重（引用不重写）：R118①（:143/:148 ktype/type 回填）、R118②（一键写余键逐字）、
// R118④（非法枚举不改写 URL+空态+面锚，单路单面）、R146（:111-119 双键共存回填 +
// 「both-keys 起链」清除双删）、R157③④（非法 ktype 空态、cap 不渲染）、R164①②、
// R176（:240-257 桶/名筛 churn 下命中面 **data-len 计数** 不串面）、R213/R218。
// 新增维（点名）：
//  ① churn 下命中面**内容级**逐字不串面：行名数组 + kn-row-copy-<i> 钮序列 + 某行钮
//    复制文本三快照逐字不变（R176 只锁 data-len 计数，行内容与钮未锁）；
//  ② 非法值**双路**（ktype=非法 vs 旧 type=非法兜底）同帧读数逐字相等：两路 loc 逐字
//    保留、kn3-docs 与 kn-type-empty 与命中面锚同时在场、kn-row-copy* **两族**钮 0
//    （R118④ 只走一路、未查双族钮数与双路互等）；
//  ③ **旧单键起链换桶**：type=PDF（无 ktype）点他桶 → 旧 type 键**原样残留**且 ktype
//    新写、行集随 ktype 优先切换、终回「全部」双删（R146 只测 both-keys 起链；单键
//    起链写路径的旧键残留态无人锁）+ 全程命中面行名不受详情类型筛选传染（面貌差异）。
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
const loc = () => txt(q("loc"));
const params = () => new URLSearchParams(loc().replace(/^\?/, ""));
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
// 除指定键外的全部查询键逐字快照（键序 + 编码值）
const locExcept = (drop: string) =>
  [...params().entries()].filter(([k]) => k !== drop).map(([k, v]) => `${k}=${v}`).join("&");
const detailNames = () =>
  [...container.querySelectorAll('[data-testid="kn3-docs-row"]')]
    .map((r) => txt(r.querySelector('[data-testid="kn3-docs-name"]')));
const hitRows = () => [...document.querySelectorAll('[data-testid="kn6-search-row"]')];
const hitNames = () => hitRows().map((r) => txt(r.querySelector('[data-testid="kn6-search-name"]')));
const hitBtnIds = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-"]')]
    .filter((b) => !String(b.getAttribute("data-testid")).includes("-space-"))
    .map((b) => Number((b.getAttribute("data-testid") ?? "").replace(/\D/g, "")))
    .sort((a, b) => a - b);
const detailBtnIds = () =>
  [...container.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')].length;
const bucketByLabel = (label: string) =>
  [...container.querySelectorAll('button[data-testid^="kn-type-"]')].find((b) =>
    txt(b).startsWith(label),
  ) ?? null;
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  return writeText;
};

const A = { documentId: "d_a", fileName: "人事手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const B = { documentId: "d_b", fileName: "人事表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const C = { documentId: "d_c", fileName: "运维手册.pdf", mimeType: "pdf", sizeBytes: 512, updatedAt: "2026-11-19T05:00:00Z" };
const wire = (docs = [A, B, C]) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES)
      return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "人事空间", docCount: docs.length, status: "synced" }] });
    if (url === DOCUMENTS_PLAIN || url === P1URL) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: docs });
    return fail(404, "这个数据接口还没有接入。", "rid-r228");
  });
const BASE = "/knowledge?tab=spaces&panel=spaces&space=sp_x";
const Q = `q=${encodeURIComponent("人事")}`;

describe("knowledge filters cross-surface guards (R228)", () => {
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

  it("① 详情面切桶：命中面内容级三快照（行名/钮序列/行钮复制文本）逐字不串面 + 除 ktype 外全键逐字（新增维①）", async () => {
    const writeText = clipStub();
    wire();
    await render(`${BASE}&${Q}&ktype=${encodeURIComponent("PDF")}`);
    expect(detailNames()).toEqual(["人事手册.pdf", "运维手册.pdf"]); // ktype=PDF 详情面收窄
    const names0 = hitNames();
    const ids0 = hitBtnIds();
    expect(names0).toEqual(["人事手册.pdf", "人事表.xlsx"]); // 命中面只吃 q，不吃 ktype
    await clickNode(document.querySelector('button[data-testid="kn-row-copy-0"]'), "hit row0 copy");
    const copy0 = String(writeText.mock.calls[0][0]);
    const others0 = locExcept("ktype");
    const c0 = urls().length;
    // 详情面切到「表格」桶：只动 ktype 一键
    await clickNode(bucketByLabel("表格"), "bucket 表格");
    expect(params().get("ktype")).toBe("表格");
    expect(locExcept("ktype")).toBe(others0); // 余键逐字（引 R118②口径，本例锁跨面帧）
    // 新增维：命中面行名数组、钮 id 序列逐字不变（R176 只锁 data-len）
    expect(hitNames()).toEqual(names0);
    expect(hitBtnIds()).toEqual(ids0);
    // 同一钮复制文本逐字不变（内容级）
    writeText.mockClear();
    await clickNode(document.querySelector('button[data-testid="kn-row-copy-0"]'), "hit row0 copy again");
    expect(String(writeText.mock.calls[0][0])).toBe(copy0);
    // 详情面自身换集（证明确实发生了切换而非无操作）
    expect(detailNames()).toEqual(["人事表.xlsx"]);
    expect(urls().length).toBe(c0); // 全程本地零请求（密钥集维度引 R164①:142 不重写）
  });

  it("② 非法值双路（ktype=非法 / 旧 type=非法兜底）：两路 loc 逐字保留、双族行钮 0、三面锚同帧、空态句逐字互等（新增维②）", async () => {
    const BAD = encodeURIComponent("紫皮蒜桶");
    wire();
    await render(`${BASE}&q=${encodeURIComponent("火星不存在")}&ktype=${BAD}`);
    const locA = loc();
    expect(locA).toContain(`ktype=${BAD}`); // 不改写 URL（R118④ 单路已锁 → 本例锁双路互等）
    expect(q("kn-type-empty")).toBeTruthy();
    expect(q("kn3-docs")).toBeTruthy();
    expect(hitBtnIds()).toEqual([]); // 检索面钮族 0（q 无命中）
    expect(detailBtnIds()).toBe(0); // 详情面钮族 0（非法桶收窄）
    expect(detailNames()).toEqual([]);
    const emptyA = txt(q("kn-type-empty"));
    // 第二路：非法值放**旧兜底键**（无 ktype），同帧读数逐字相等
    await render(`${BASE}&q=${encodeURIComponent("火星不存在")}&type=${BAD}`);
    expect(loc()).toBe(locA.replace(`ktype=${BAD}`, `type=${BAD}`)); // 该路同样不改写
    expect(txt(q("kn-type-empty"))).toBe(emptyA); // 两路空态句逐字互等（新增维）
    expect(hitBtnIds()).toEqual([]);
    expect(detailBtnIds()).toBe(0);
    // 命中面锚在场性按实测记录（面级容器在 ready 帧恒渲染）
    expect(q("kn6-search")).toBeTruthy();
  });

  it("③ 旧单键起链换桶：type=PDF 残留逐字 + ktype 新写优先、回全部双删、全程命中面不传染（新增维③）", async () => {
    wire();
    await render(`${BASE}&${Q}&type=${encodeURIComponent("PDF")}`); // 仅旧键，无 ktype
    expect(detailNames()).toEqual(["人事手册.pdf", "运维手册.pdf"]); // 兜底回填生效（回填视觉引 R118①:148）
    const names0 = hitNames();
    expect(names0).toEqual(["人事手册.pdf", "人事表.xlsx"]); // 面貌差异：type 不触检索面
    const c0 = urls().length;
    // 换桶到「表格」：写路径只 set ktype —— 旧 type 键**原样残留**（R146 未锁此态）
    const others0 = locExcept("ktype"); // 此刻含 type=PDF（共存帧）
    await clickNode(bucketByLabel("表格"), "bucket 表格");
    expect(params().get("type")).toBe("PDF"); // 旧键残留逐字（R146 未锁此态）
    expect(params().get("ktype")).toBe("表格"); // 新键写入
    expect(locExcept("ktype")).toBe(others0); // 除 ktype 外余键（含 type=PDF）逐字不动
    expect(detailNames()).toEqual(["人事表.xlsx"]); // 优先链 ktype ?? type：行集随 ktype
    expect(hitNames()).toEqual(names0); // 命中面仍不传染
    // 回「全部」：双删（从单键起链衍生的共存态清除）
    await clickNode(q("kn-type-all"), "clear all");
    expect(params().get("ktype")).toBeNull();
    expect(params().get("type")).toBeNull();
    expect(locExcept("ktype")).toBe(`tab=spaces&panel=spaces&space=sp_x&${decodeURIComponent(Q)}`); // 双删后余键原样
    expect(detailNames()).toEqual(["人事手册.pdf", "人事表.xlsx", "运维手册.pdf"]); // 全量复原
    expect(urls().length).toBe(c0); // 全程本地零请求
  });
});
