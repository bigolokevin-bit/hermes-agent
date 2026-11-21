// R266 — knE-page-stale / knE-page-reload 整表重载路径首测（纯测试单：零产品改动，未造控件）。
// 选题坐实（派工查重）：`knE-page-reload` 产品实存（KnowledgeModulePage.tsx:2662，
// onClick=surface.retry → :215 attempt++ 整表重取 P1），全模块 77 套测试对
// `knE-page-reload` **0 命中**（stale 仅注释级引用）——「坏/过期 cursor 静默重放首页」
// 的整表重读路径从未测（:2405-2410：fresh 全空 → setStale(true)，不合并、不推进游标）。
// 机制与实态锚：P2 返回行全部命中 seen 集合 → stale 面板在场、knE-page-more disabled
// 且文案「游标已过期」、行数不增无重复；点 knE-page-reload → 增量恰 1、URL==P1（**无
// cursor=**——cursor 只在组件态）。
// 名实（产品定版）：无真 CSV（源级 createObjectURL/text/csv/a.download/new Blob 0、
// absent ×4——R190①:113-119）→「导出」= knF 数据行（docCopyText 5 列），**spy 全程 0**；
// 行钮详情面 kn-row-copy-space-<i>（R132/R169）；cap=kn3-page-cap 50 常量槽+M 可变，
// error/true-0/denied/非法=**null**（R108/R157/R187/R231/R234）——③帧按实测断言；
// 无 ?source=/?preview=；缺值「—」、短码大写尾段全 id 仅 title；列表错误锚
// kn3-docs-error+RequestId 钮 button[aria-label="复制请求编号"]（引 R183/R210/R237③
// 单量位——本文件只并 stale/reload 组合帧）；clip 桩 mockResolvedValue +
// afterEach unstubAllGlobals（R214，Errors 0）；重试/计数族引 R131③/R216④/R237③。
// 三例皆新：stale 触发面、reload 成功面、reload 失败面（现场裁决：整表重读失败=换错误帧，
// 「保旧行」仅属 P2 窗口径——R131③/R237③ 不误用；恢复腿顺带钉「导出快照全程不变」。
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
const P1URL = "/agent-api/api/documents?limit=50&spaceId=sp_x";
const P2URL = `${P1URL}&cursor=cpg2`;
const BASE = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

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
const rowNodes = () => [...document.querySelectorAll('[data-testid="kn3-docs-row"]')];
const rowNames = () => rowNodes().map((r) => txt(r.querySelector('[data-testid="kn3-docs-name"]')));
const btnCount = () => document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length;
const dataLines = (text: string) => text.split("\n").slice(1, -1);
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.URL, "createObjectURL", { value: vi.fn(), configurable: true, writable: true });
  return writeText;
};

const page50 = Array.from({ length: 50 }, (_, i) => ({
  documentId: `p1_${String(i + 1).padStart(2, "0")}`,
  fileName: `卷 ${String(i + 1).padStart(2, "0")}.pdf`,
  mimeType: "pdf",
  sizeBytes: 100 + i,
  updatedAt: `2026-11-1${(i % 9) + 1}T07:00:00Z`,
}));
const SP = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 120, status: "synced" }] };
// P2 **回放同样 50 行 id**（全命中 seen）→ 产品判 stale；p1Fail 控制 ③ 的整表重读失败
const wire = (opts: { p1Fail?: boolean } = {}) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [page50[0]] });
    if (url === P1URL)
      return opts.p1Fail
        ? fail(500, "上游读取失败，请稍后重试。", "rid-r266-p1")
        : Promise.resolve({ asOf: SP.asOf, documents: page50, nextCursor: "cpg2" });
    if (url === P2URL) return Promise.resolve({ asOf: SP.asOf, documents: page50, nextCursor: "cpg3" });
    return fail(404, "这个数据接口还没有接入。", "rid-r266-x");
  });

describe("knowledge stale cursor reload guards (R266)", () => {
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

  it("① 回放首页=stale：knE-page-stale 在场 + -more disabled 且文案「游标已过期」+ 行数不增无重复 + 无错误锚 + 三值同源 50（表体==knE-page-count==knF 数据行）+ cap 仍「已加载 50 篇」", async () => {
    const writeText = clipStub();
    wire();
    await render(BASE);
    await clickNode(q("knE-page-more"), "append replays page1");
    expect(q("knE-page-stale")).toBeTruthy(); // 过期游标面板
    const more = q("knE-page-more") as HTMLButtonElement | null;
    expect(more?.disabled).toBe(true);
    expect(txt(more)).toContain("游标已过期"); // 实锁文案
    expect(rowNodes()).toHaveLength(50); // 不合并 → 无重复行
    expect(new Set(rowNames()).size).toBe(50);
    expect(q("knE-page-error")).toBeNull();
    expect(txt(q("knE-page-count"))).toContain("50"); // 计数位同源
    await clickNode(q("knF-copy"), "knF in stale frame");
    expect(dataLines(String(writeText.mock.calls[0][0]))).toHaveLength(50); // 导出同源
    expect(txt(q("kn3-page-cap"))).toContain("当前已加载 50 篇");
    expect(urls().filter((x) => x === P2URL)).toHaveLength(1); // P2 真发且仅此一条追加
  });

  it("② stale 面板点 knE-page-reload：增量恰 1 且 URL==P1 无 cursor= + stale 消失 + -more 恢复可用 + 行仍 50 无重复 + 三值 50==50==50 + blob spy 0（整表重读路径首测）", async () => {
    const writeText = clipStub();
    wire();
    await render(BASE);
    await clickNode(q("knE-page-more"), "make stale");
    expect(q("knE-page-stale")).toBeTruthy();
    const u0 = urls().join("|");
    await clickNode(q("knE-page-reload"), "reload");
    expect(urls().length).toBe(u0.split("|").length + 1); // 恰 +1
    expect(urls().at(-1)).toBe(P1URL); // 整表重取 P1（无 cursor=——URL 实检）
    expect(urls().at(-1)).not.toContain("cursor");
    expect(q("knE-page-stale")).toBeNull(); // 面板消失
    expect((q("knE-page-more") as HTMLButtonElement | null)?.disabled).toBe(false); // 恢复可用
    expect(rowNodes()).toHaveLength(50);
    expect(new Set(rowNames()).size).toBe(50);
    await clickNode(q("knF-copy"), "knF after reload");
    expect([rowNodes().length, btnCount(), dataLines(String(writeText.mock.calls[0][0])).length]).toEqual([50, 50, 50]);
    const spy = window.URL.createObjectURL as unknown as ReturnType<typeof vi.fn>;
    expect(spy).not.toHaveBeenCalled();
  });

  it("③ reload 整表重读 500（现场裁决：旧行不保留=换错误帧，「保旧行」仅属 P2 窗口径 R131③/R237③）：行/钮清零 + 列表错误锚 + cap null + rid 投递逐字 + knF disabled（R232③ 同帧）→ kn3-docs-retry 恰 +1 一键恢复：50 行无重复 + 导出 toBe 失败前快照 + cap 复原 + blob spy 0", async () => {
    const writeText = clipStub();
    wire();
    await render(BASE);
    await clickNode(q("knF-copy"), "knF pre");
    const textPre = String(writeText.mock.calls[0][0]);
    await clickNode(q("knE-page-more"), "make stale");
    expect(q("knE-page-stale")).toBeTruthy();
    // 让重读失败再点 reload
    fetchMock.mockClear();
    writeText.mockClear();
    wire({ p1Fail: true });
    const u0 = urls().length;
    await clickNode(q("knE-page-reload"), "reload (will fail)");
    expect(urls().length).toBe(u0 + 1); // 重试增量恰 +1
    expect(urls().at(-1)).toBe(P1URL);
    expect(q("knE-page-stale")).toBeNull(); // stale 面板不在场（错误接管）
    // —— 以下按产品现状：列表错误锚、旧行去留、cap——首跑红则按实修，禁改产品 ——
    expect(q("kn3-docs-error")).toBeTruthy();
    const ridBtn = q("kn3-docs-error")?.querySelector('button[aria-label="复制请求编号"]');
    await clickNode(ridBtn, "copy rid");
    expect(writeText.mock.calls.at(-1)![0]).toBe("rid-r266-p1"); // 逐字投递（引 R210④/R237③ 同式）
    expect(q("kn3-page-cap")).toBeNull(); // 错帧 cap=null 非 0（引 R157/R187）
    expect((q("knF-copy") as HTMLButtonElement | null)?.disabled).toBe(true); // 错帧复制侧被禁（R232③ 同帧）
    // **现场裁决（写文件头与本注释）**：整表重读失败=列表换错误帧——行 0/钮 0/cap null，
    // 「旧 50 行保留」仅对 P2 load-more 失败成立（R131③/R237③），两种 500 语义不同族，
    // 本例首次把 stale→reload 路径上的该实态钉死（禁改产品凑派工）。
    expect(rowNodes()).toHaveLength(0);
    expect(btnCount()).toBe(0);
    // 一键恢复：kn3-docs-retry → 再恰 +1（P1 ok）
    wire(); // 恢复正常读
    const u1 = urls().length;
    await clickNode(q("kn3-docs-retry"), "list retry");
    expect(urls().length).toBe(u1 + 1);
    expect(urls().at(-1)).toBe(P1URL);
    expect(q("kn3-docs-error")).toBeNull();
    expect(rowNodes()).toHaveLength(50);
    expect(new Set(rowNames()).size).toBe(50); // 无重复
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF after recovery");
    expect(String(writeText.mock.calls[0][0])).toBe(textPre); // 导出=失败前快照（行集全程未变）
    expect(txt(q("kn3-page-cap"))).toContain("当前已加载 50 篇"); // cap 复原
    expect(q("knE-page-stale")).toBeNull();
    const spy = window.URL.createObjectURL as unknown as ReturnType<typeof vi.fn>;
    expect(spy).not.toHaveBeenCalled();
  });
});
