// R261 — 导出与复制「并发/交替」护栏：连击参数恒等 + 交替序列逐轮互等 + 拒绝态跨面免疫（纯测试单：零产品改动，未造控件）。
// 名实换算（产品定版，禁造/禁改）：
// · **无真 CSV、无 Blob 导出**（源级 createObjectURL/text/csv/a.download/new Blob 0、
//   absent ×4、kn-list-copy 不存在——R190①:113-119）→ 腿①「连续两次导出 blob 逐字
//   相等」换算为：同一复制器连点两次，两次 writeText **投递参数 toBe 相等**；「导出
//   数据行」= knF（DOC_LINE_HEADER 5 列）/knG（6 列，所属空间@2——R71 唯一列差）；
//   createObjectURL spy 全程 0。
// · 腿②主场=空间详情面（唯一分页面）：清单复制 ↔ 行钮复制**交替**——每轮取清单，其
//   第 k 行与 `kn-row-copy-space-<k>` 串逐字一致；检索面同型一遍（knG 行去第 2 列后
//   与 `kn-row-copy-<k>` 5 列整串 toBe）。全程 urls join 逐字（本地零请求——R215③/
//   R243β/R244δ′，禁「恰 1 次」）；kn-doc-copy 单控件不当行数（红线④）。
// · 腿③「导出失败重试」**无可触发路径（驳回）**→ 换算真实失败路径=剪贴板拒绝：
//   **单面拒绝环已全锁**（主套件 knF-fallback 环 :2712-2760；knG 环 :2844-2862；
//   行钮/预览兜底 R167③ copy.a11y:178-204 value==投递逐字+「剪贴板没接受」）→ 引用
//   不复写；本文件只打未锁的**交替拒绝跨面免疫**角（A 面拒绝出兜底期间，B 面成功
//   播报不抹 A 面兜底；A 面重试成功后自家兜底收起）。
// · cap 50/M（R108/R157/R187 null 态）、缺值两式禁统一、短码尾段全 id 仅 title、
//   行钮分面（R132/R169）沿用；clipboard 桩 Promise（首拒后 resolve：
//   mockRejectedValueOnce+mockResolvedValue）+ afterEach unstubAllGlobals（R214，
//   Errors 0 硬要求）。
// 【查重（file:line）】R223（行钮↔清单逐行直对——**单轮遍历**，交替再取未测）/
// R226①-b（knG 去列==行钮满值行）/R142①:124/R248①:135-160（三值）/R219（同值直对）/
// R167③（面内兜底）/R190④/R231②⑤/R254②（两族播报器归属）/R256①（账本阶段分离）/
// R260（缺值载体）/R114/R200②/R209/R214/R220/R233/R243/R257 —— 覆盖位只引用。
// 【真新增维（点名两条）】
//  A. **交替序列逐轮互等**：knF→钮 k→再 knF→钮 k+1（含检索面同型）——每次他控点
//     触发 copyState 变更后，清单文本仍逐轮恒等且第 k 行==钮 k 串逐字（R223 单轮
//     遍历之外的「状态扰动后不变性」位）。
//  B. **拒绝态跨面免疫**：检索行钮被拒→自家 fallback 在场；此时详情面 knF 成功
//     （播报「已复制」）不抹检索面 fallback、不改其「剪贴板没接受」状态；检索面重试
//     成功→自家 fallback 收起（面间状态机互不串写）。
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
const dataLines = (text: string) => text.split("\n").slice(1, -1);
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.URL, "createObjectURL", { value: vi.fn(), configurable: true, writable: true });
  return writeText;
};

const A = { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z", spaceId: "sp_x", spaceName: "测试空间" };
const B = { documentId: "d_b", fileName: "B 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z", spaceId: "sp_x", spaceName: "测试空间" };
const C = { documentId: "d_c", fileName: "C 稿.docx", mimeType: "docx", sizeBytes: 512, updatedAt: "2026-11-19T05:00:00Z", spaceId: "sp_x", spaceName: "测试空间" };
const SP = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 3, status: "synced" }] };
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN || url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: [A, B, C] });
    return fail(404, "这个数据接口还没有接入。", "rid-r261-x");
  });
const BASE = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

describe("knowledge export/copy interleaving guards (R261)", () => {
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

  it("A 新增维：交替序列逐轮互等——knF 连点两次投递参数 toBe 相等；knF→钮0→knF→钮1 每轮清单第 k 行==钮 k 串逐字；检索面 knG 同型（去所属空间@2 后整串 toBe）；urls 全程逐字、cap 冻结、spy 0", async () => {
    const writeText = clipStub();
    wire();
    await render(BASE);
    const u0 = urls().join("|");
    const cap0 = txt(q("kn3-page-cap"));
    // 连点同器两次：投递参数恒等（换算「两次导出逐字相等」）
    await clickNode(q("knF-copy"), "knF #1");
    await clickNode(q("knF-copy"), "knF #2");
    expect(String(writeText.mock.calls[1][0])).toBe(String(writeText.mock.calls[0][0]));
    // 交替：清单→钮0→清单→钮1→清单
    await clickNode(document.querySelector('button[data-testid="kn-row-copy-space-0"]'), "btn 0");
    await clickNode(q("knF-copy"), "knF #3");
    const f3 = String(writeText.mock.calls[3][0]);
    expect(f3).toBe(String(writeText.mock.calls[0][0])); // 他控扰动后清单文本不变
    expect(dataLines(f3)[0]).toBe(String(writeText.mock.calls[2][0]).split("\n").slice(1, -1)[0]); // 第 0 行==钮 0 串逐字（R223 单轮遍历之外的再取位）
    await clickNode(document.querySelector('button[data-testid="kn-row-copy-space-1"]'), "btn 1");
    await clickNode(q("knF-copy"), "knF #4");
    expect(dataLines(String(writeText.mock.calls[5][0]))[1]).toBe(String(writeText.mock.calls[4][0]).split("\n").slice(1, -1)[0]); // 第 1 行==钮 1 串（索引 4=btn1、5=knF#4）
    expect([detailNames().length, document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length, dataLines(f3).length]).toEqual([3, 3, 3]); // 三值不变
    // 检索面同型：knG 两次 + 钮 0
    await clickNode(q("knG-copy"), "knG #1");
    await clickNode(document.querySelector('button[data-testid="kn-row-copy-0"]'), "hit btn 0");
    await clickNode(q("knG-copy"), "knG #2");
    const gLines = dataLines(String(writeText.mock.calls[8][0]));
    const h0 = String(writeText.mock.calls[7][0]).split("\n").slice(1, -1)[0];
    const gCols = gLines[0].split(" | ");
    expect([gCols[0], ...gCols.slice(2)]).toEqual(h0.split(" | ")); // knG 去所属空间@2 == 行钮整串（R226①-b 交替再取位）
    expect(txt(q("kn3-page-cap"))).toBe(cap0); // cap 冻结（全程本地）
    expect(urls().join("|")).toBe(u0); // 全程零新请求
  });

  it("B 新增维：拒绝态跨面免疫——检索行钮被拒出 fallback（值==投递）期间，详情面 knF 成功播报不抹对面兜底/不改对面状态句；被拒面重试成功自家兜底收起；单面拒绝环本体引主套件 :2712-2760/:2844-2862 与 R167③ 不复写", async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error("denied")).mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    const spy = vi.fn();
    Object.defineProperty(window.URL, "createObjectURL", { value: spy, configurable: true, writable: true });
    wire();
    await render(BASE);
    const u0 = urls().join("|");
    // 检索面行钮首点被拒 → 自家兜底与状态句
    await clickNode(document.querySelector('button[data-testid="kn-row-copy-0"]'), "hit btn reject");
    expect(txt(q("kn-row-copy-status"))).toContain("剪贴板没接受"); // 句体引 R167③:194
    const ta = q("kn-row-copy-fallback") as HTMLTextAreaElement | null;
    expect(ta).toBeTruthy();
    const delivered = String(writeText.mock.calls[0][0]);
    expect(ta?.value).toBe(delivered); // 值==投递（R167③ 同式，交替帧在场性）
    // 对面成功不串写：详情面 knF 此刻 resolve
    await clickNode(q("knF-copy"), "knF on other face");
    expect(txt(q("knF-copy-status"))).toContain("已复制");
    expect(q("kn-row-copy-fallback")).toBeTruthy(); // A 面兜底未被 B 面成功抹掉
    expect(ta?.value).toBe(delivered);
    expect(txt(q("kn-row-copy-status"))).toContain("剪贴板没接受"); // 对面状态句不动
    // 被拒面重试成功 → 自家兜底收起、不留旧文本节点
    await clickNode(document.querySelector('button[data-testid="kn-row-copy-0"]'), "hit btn retry");
    expect(q("kn-row-copy-fallback")).toBeNull();
    expect(txt(q("kn-row-copy-status"))).toBe("已复制");
    expect(urls().join("|")).toBe(u0); // 全程零新请求（拒绝/成功皆本地）
    expect(spy).not.toHaveBeenCalled(); // 无 blob 路径（R190① 不变量收口）
  });
});
