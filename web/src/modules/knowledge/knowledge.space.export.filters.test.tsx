// R248 — 详情面深链 ktype 48 规模三方首行同帧（①残余子维）；②③全锁→判定引用（纯测试单·零产品改动）。
// 【三腿查重裁决（file:line；全锁禁复写——红线：不为凑文件名造重复用例）】
//  ①「套筛选后三值+首行同源」：主体已锁——R243α（knowledge.export.filters.rowcopy.test.tsx
//    :157 起，三叠加 2 行帧：钮 0 串首段==屏上==knF 首行+三值+键集）+ R247①
//    （knowledge.export.paging.filter.test.tsx:~140，**页 2 弃页后** 48 规模三方首行+
//    三值 48+cap M=48）+ R234②（locale.cross:175，深链三叠加两方位）。
//    **唯一残余**=「深链直接挂载 ktype（非点击、非弃页）」在 **48 规模** 下的三方首行
//    同帧并置（R243α 是 2 行小集+点击叠名筛；R247① 起点是页 2 弃页帧）→ 本文件落此位。
//  ②「移除一项筛选换代零残留+序自 0 重建」＝**全锁**：R243β（filters.rowcopy:~185，
//    单键移除：名筛存活+序重建+链==屏上+零请求）+ R244δ′（paging.filters:~175，页 2
//    移除向弃页不回）+ R237②(rowcopy.triple:170-191，回全部 0..49+cap 回落) +
//    R229③/R235③/R131① → 本文件不复写。
//  ③「第 2 页 500 导出只含成功页+rid+重试 +1+三值同步」＝**全锁**：R237③
//    (rowcopy.triple:193-224) + R238C(paging.triple:162 字节冻结+尾段合成) +
//    R247②（ktype 在场窗 48 基数冻结+入链 49）+ R239③(detail.paging 列表窗×抽屉) +
//    R231⑤/R216④/R131③ → 本文件不复写。
// 名实（产品定版）：无 ?source= 控件（派工 ?type=pdf&source=upload→?ktype=PDF，旧 type
// 只读兜底双删 :3549-3551，未造参数/控件）；无真 CSV（源级四件套 0、absent ×4、
// kn-list-copy 不存在——R190①:113-119）→「导出」=knF 数据行、spy 全程 0；详情面行钮
// kn-row-copy-space-<i>（indexBase 0..N-1 随筛重排——R132/R169）；只有详情面分页
// （R216 51 行夹具与 cursor 请求线断言在 R247 覆盖，本帧不分页）；本地动作零新请求
// （R215③/R243β/R244δ′，禁「恰 1 次」）；cap 50 常量/M=在屏数（R244γ′ 语义）、true-0/
// 错/拒/非法=null（R108/R157/R187）；缺值两口径不涉；短码尾段全 id 仅 title；clip 桩
// mockResolvedValue + unstubAllGlobals（R214，Errors 0 硬要求）。
// 真新增维（点名 1 条）：深链 ?ktype=PDF 直接挂载于 48 规模集——三值 [48,48,48] +
// 三方首行同帧（钮 0 串首段==屏上首行==knF 链首）+ 全链==屏上 + cap M=48 + 首屏
// urls 键集 {limit,spaceId} 且深链后零追加读——把 R243α 的形制在「非点击、非弃页、
// 大基数」起点帧钉死。
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

// 50 行 base：48 pdf + 2 xlsx（深链 ktype=PDF → 48 规模集；不分页、不点击桶）
const page50 = Array.from({ length: 50 }, (_, i) =>
  i === 3 || i === 20
    ? { documentId: `p1_x${i}`, fileName: `册 ${String(i + 1).padStart(2, "0")}.xlsx`, mimeType: "xlsx", sizeBytes: 700 + i, updatedAt: `2026-11-1${(i % 9) + 1}T07:30:00Z` }
    : { documentId: `p1_${String(i + 1).padStart(2, "0")}`, fileName: `卷 ${String(i + 1).padStart(2, "0")}.pdf`, mimeType: "pdf", sizeBytes: 1000 + i, updatedAt: `2026-11-1${(i % 9) + 1}T06:00:00Z` },
);
const SP = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 50, status: "synced" }] };
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [page50[0]] });
    if (url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: page50, nextCursor: null });
    return fail(404, "这个数据接口还没有接入。", "rid-r248-x");
  });

describe("knowledge space detail deep-link filter scale frame (R248)", () => {
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

  it("① 新增维（唯一残余子维）：深链 ?ktype=PDF 直接挂载 48 规模帧——三值 [48,48,48] + 三方首行同帧 + 全链==屏上 + cap M=48 + 键集 {limit,spaceId} 零追加读（②③见头注裁决：R243β/R244δ′/R237②③/R238C/R247② 全锁不复写）", async () => {
    const writeText = clipStub();
    wire();
    await render(`${"/knowledge?tab=spaces&panel=spaces&space=sp_x"}&ktype=${encodeURIComponent("PDF")}`);
    const names = detailNames();
    expect(names).toHaveLength(48); // 深链回填基数（非点击、非弃页起点帧）
    expect(names.every((n) => n.endsWith(".pdf"))).toBe(true);
    expect(detailNames().length).toBe(Number(q("kn3-docs")?.getAttribute("data-len"))); // 表体==data-len 位（R216 族沿用）
    const u0 = urls().length;
    // 首屏请求线：spaces+plain+p1 共三读，键集恰 {limit,spaceId}（深链不触发追加读）
    expect(u0).toBe(3);
    for (const req of urls().filter((x) => x.includes("spaceId="))) {
      expect([...new URLSearchParams(req.split("?")[1]).keys()].sort()).toEqual(["limit", "spaceId"]);
    }
    await clickNode(document.querySelector('button[data-testid="kn-row-copy-space-0"]'), "btn 0");
    const btnHead = String(writeText.mock.calls[0][0]).split("\n")[1].split(" | ")[0];
    await clickNode(q("knF-copy"), "knF");
    const lines = dataLines(String(writeText.mock.calls[1][0]));
    expect([names.length, btnIds().length, lines.length]).toEqual([48, 48, 48]); // 三值
    expect(btnIds()).toEqual(Array.from({ length: 48 }, (_, i) => i)); // 钮 0..47 连续（筛后重排）
    expect(btnHead).toBe(names[0]); // 三方首行同帧
    expect(lines[0].split(" | ")[0]).toBe(names[0]);
    expect(lines.map((l) => l.split(" | ")[0])).toEqual(names); // 全链==屏上
    expect(capM()).toBe(48); // M=在屏数（R244γ′ 语义沿用）
    expect(urls().length).toBe(u0); // 两次复制零新请求（R215③ 口径）
  });
});
