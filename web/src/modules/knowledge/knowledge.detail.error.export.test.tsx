// R232 — 抽屉（详情）错误态 × 导出隔离护栏（纯测试单：零产品改动，未造控件）。
// 名实（实测既定换算）：「详情」= kn7 抽屉（?doc= 深链可直达；详情读每开恰 1 次既存
// 请求——R49 设计，R196 契约）；**无真 CSV 导出**（createObjectURL/text/csv/a.download/
// new Blob 源级 0，仅 data-export="absent" ×4——R190①:113-119 不变量，本轮 spy 全程
// 0 收口）→「导出」= knF-copy 数据行（docCopyText 5 列）；详情面行钮实名
// kn-row-copy-space-<i>；kn-doc-copy 单控件非行数。①「列表仍可翻页/排序」腿已由
// R221②:149-166 锁（500 错误窗内点表头翻序零新请求 + knE-page-more 真实追加）→ 引用
// 不复写，本文件把该窗推到 **M=51 三值链 + 导出全文与干净帧逐字互等**（导出侧新位）。
// ③「换代」不成立（红线⑤）：重试详情读不动列表——按现实断言 **导出集逐字==重试前
// 快照** + 增量恰 [DETAIL_A]（R183③:135-158 已锁计数与锚消失，本例只补导出侧）；
// 禁造列表刷新。缺值两套口径不涉本轮；clip 桩 mockResolvedValue + unstubAllGlobals
// （R214 教训，Errors 0 硬要求）。
// 查重（引用不重写）：R183①②:107-133（404/500 句+rid 上屏+列表/cap 不卸载+空态不冒充）、
// R183③:135-158（重试恰 +1、锚消失、内容就位）、R183④:159+（错误态行内复制钮仍 ENABLED
// 的现实位）、R221①:133（500 当帧最小复跑）、R221②（错误窗列表交互全功能）、
// R221④:193（双失败 cap 过渡）、R230①:133-152（无故障抽屉三值+快照互等）、
// R231⑤/⑥（空/错帧锚互斥、三值链）、R216（51 行跨页夹具先例）、R142/R190（导出缺席、
// 空集 disabled）、R210/R211（双 rid 独立复制）。
// 新增维（点名）：
//  A. **抽屉 500 错误窗 × M=51 追加后**：三值 [表体, -space- 钮, knF 行]=[51,51,51] +
//     错误帧导出全文 toBe 干净帧同数据快照（抽屉故障零传染，同串跨两渲染互等）；
//  B. **抽屉 404 帧**：kn3-page-cap 整句逐字==开抽屉前快照（列表健康态 cap 在场由
//     R183①② 锁过存在性，本例锁**逐字不动**；列表故障帧 cap=null 的边界见 R231③）+
//     knF **不禁用**（disabled false）且点击写满 50 行——「导出不被禁用」实锁；
//  C. **重试成功后**：导出文本逐字==重试前快照（红线⑤换算位）+ 列表读集合逐字不动
//     + 详情读 1→2（计数形式引 R183③，本例仅加导出侧维度）。
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
const DETAIL_A = "/agent-api/api/documents/d_a";
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";
const DRAWER = `${DETAIL}&doc=d_a`;

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
const createObjectUrl = vi.fn();
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.URL, "createObjectURL", { value: createObjectUrl, configurable: true, writable: true });
  return writeText;
};

// 51 行跨页夹具（R216 先例；P1 恰满 50 触发 knE-page-more——红线③）
const page50 = Array.from({ length: 50 }, (_, i) => ({
  documentId: i === 0 ? "d_a" : `p1_${String(i + 1).padStart(2, "0")}`,
  fileName: `卷 ${String(i + 1).padStart(2, "0")}.pdf`,
  mimeType: "application/pdf",
  sizeBytes: 100 + i,
  updatedAt: `2026-11-1${(i % 9) + 1}T07:00:00Z`,
}));
const ROW51 = { documentId: "p2_51", fileName: "卷 51.pdf", mimeType: "application/pdf", sizeBytes: 1, updatedAt: "2026-11-10T01:00:00Z" };
const SP = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 51, status: "synced" }] };
const wire = (detail: () => Promise<unknown>) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [page50[0]] });
    if (url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: page50, nextCursor: "cpg2" });
    if (url === P2URL) return Promise.resolve({ asOf: SP.asOf, documents: [ROW51], nextCursor: null });
    if (url === DETAIL_A) return detail();
    return fail(404, "这个数据接口还没有接入。", "rid-r232-x");
  });
const failDetail = (status: number, rid: string) => () => fail(status, "数据服务暂时没有响应，请稍后重试。", rid);

describe("knowledge drawer-error × export isolation guards (R232)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    createObjectUrl.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("① 抽屉 500 错误窗 × 追加到 M=51：三值 [51,51,51] + 错误帧导出全文 toBe 干净帧快照（新增维A；翻页/排序腿引 R221②:149-166 不复写）", async () => {
    const writeText = clipStub();
    wire(failDetail(500, "rid-r232-500"));
    await render(DRAWER);
    expect(q("kn7-preview-error")).toBeTruthy(); // 错误锚在场（句/rid 上屏引 R183①②:107-133）
    expect(q("kn3-docs-error")).toBeNull(); // 列表腿健康（错误只属抽屉——R221① 锚互斥口径）
    await clickNode(q("knE-page-more"), "append under drawer-500"); // 窗内翻页可用（R221② 已锁语义，此处入三值帧）
    expect(urls().filter((u) => u === P2URL)).toHaveLength(1);
    expect(rowNames()).toHaveLength(51);
    await clickNode(q("knF-copy"), "knF in error window");
    const errText = String(writeText.mock.calls[0][0]);
    const lines = errText.split("\n").slice(1, -1);
    expect([rowNames().length, btnCount(), lines.length]).toEqual([51, 51, 51]); // 三值链
    expect(lines[0].split(" | ")[0]).toBe(rowNames()[0]); // 首行逐字==屏上首行
    // 干净帧同数据对照：错误帧导出与无抽屉帧**逐字互等**（零传染）
    writeText.mockClear();
    await render(DETAIL);
    await clickNode(q("knE-page-more"), "append clean");
    await clickNode(q("knF-copy"), "knF clean");
    expect(String(writeText.mock.calls[0][0])).toBe(errText);
    expect(createObjectUrl).not.toHaveBeenCalled(); // 全程无 blob（红线①）
  });

  it("② 抽屉 404 帧：cap 整句逐字==开抽屉前 + knF 不禁用且写满 50 行三值（新增维B；404 句与空态不冒充引 R183①②）", async () => {
    const writeText = clipStub();
    wire(failDetail(404, "rid-r232-404"));
    await render(DETAIL); // 先取健康帧基线快照
    const cap0 = txt(q("kn3-page-cap"));
    expect(cap0).toContain("本页最多显示 50 篇（当前已加载 50 篇；复制清单也只含这些篇）"); // 列表健康态在场（M=50 未追加；-more 子文本允许并入——R225 口径）
    await clickNode(q("knF-copy"), "knF clean baseline");
    const text0 = String(writeText.mock.calls[0][0]);
    writeText.mockClear();
    await render(DRAWER); // 同数据 + 抽屉 404
    expect(q("kn7-preview-unwired")).toBeTruthy(); // 404=unwired 分支（R183①②:126-128 锁的锚名，本例沿用非新维）
    expect(q("kn7-preview-error")).toBeNull(); // error/unwired 互斥（引 R183）
    expect(txt(q("kn3-page-cap"))).toBe(cap0); // 逐字不动（新位：R183 锁在场，R231③ 锁列表故障帧 null——本例锁健康帧抽屉故障的不动性）
    const btn = q("knF-copy") as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(false); // 导出不被禁用（实锁）
    await clickNode(btn, "knF in 404 frame");
    const lines = String(writeText.mock.calls[0][0]).split("\n").slice(1, -1);
    expect([rowNames().length, btnCount(), lines.length]).toEqual([50, 50, 50]); // 三值（未追加态）
    expect(String(writeText.mock.calls[0][0])).toBe(text0); // 与干净帧逐字互等
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it("③ 重试成功后：错误锚消失（引 R183③:135-158）+ 导出集逐字==重试前快照（红线⑤换算：换代不成立，按实断言）+ 详情读 1→2、列表读集合逐字不动（新增维C）", async () => {
    const writeText = clipStub();
    let mode = "fail";
    wire(() => (mode === "fail" ? fail(500, "数据服务暂时没有响应，请稍后重试。", "rid-r232-r") : Promise.resolve({ sourceName: "A 手册原件.pdf", status: "indexed" })));
    await render(DRAWER);
    expect(q("kn7-preview-error")).toBeTruthy();
    await clickNode(q("knF-copy"), "knF before retry");
    const text0 = String(writeText.mock.calls[0][0]);
    writeText.mockClear();
    const list0 = listUrls();
    const detail0 = urls().filter((u) => u === DETAIL_A).length;
    mode = "ok";
    await clickNode(q("kn7-preview-retry"), "retry");
    expect(q("kn7-preview-error")).toBeNull(); // 锚消失（R183③ 复跑位）
    expect(urls().filter((u) => u === DETAIL_A).length).toBe(detail0 + 1); // 详情读恰 +1
    expect(listUrls()).toBe(list0); // 列表读集合逐字不动（红线⑤：禁造刷新）
    await clickNode(q("knF-copy"), "knF after retry");
    expect(String(writeText.mock.calls[0][0])).toBe(text0); // 导出集逐字==重试前（换代不成立→按实锁）
    expect(rowNames()).toHaveLength(50); // 表体也不动（与导出互证）
    expect(createObjectUrl).not.toHaveBeenCalled();
  });
});
