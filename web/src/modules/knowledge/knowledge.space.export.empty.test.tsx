// R257 — 空态×分页全族零渲染 + 详情 500 帧全局导出全文零染（两真缺口）；三腿其余为判定引用（纯测试单·零产品改动）。
// 【三腿查重裁决（file:line；已锁只引用，禁造重复用例）】
//  ①「空列表 disabled+title、零 Blob 零请求」＝门体全锁：R138②④ + R190④
//    (knowledge.export.escape.test.tsx:190-205 双 disabled+「没有可复制」+零写零请求+
//    spy 0) + R231②⑤(empty.export:99 起/追加⑤双族钮 0) + R236③(open.detail:182-210
//    两翼判别句) → 引用；**换算（红线①）**：`kn-space-page-cap` 不存在 → 实名
//    `kn3-page-cap`，且 true-0/error/denied/非法枚举实测 **null（不渲染）**——brief
//    「显 0」不可兑现，按 null 断言（R108/R157/R187）。
//  ②「详情 500 全局不受影响、rid、重试 +1」＝主体全锁：R221①②(错误锚互斥×列表交互
//    全功能)、R232①(knowledge.detail.error.export:152-176 错误窗×M=51 三值+knF 全文
//    与干净帧互等)、R187①③、R183③(重试恰 +1) → 引用。
//  ③「锚互斥+恢复三值」＝全锁：R187② + R231⑤(同面互斥首锁) + R232③(错误站复制侧
//    disabled 链) + R221④(**cap 由缺席到逐字整句复原**——候选「过渡位」已被此例锁，
//    不再重复)。
// 【本文件两条真缺口（grep 实证零 pin，新增维点名）】
//  A. **true-0 详情帧 × `knE-page-*` 整族零渲染同帧**：现有套件只在检索面锁过无分页
//     （R164 收尾例）；空空间的详情面 `[data-testid^="knE-page-"]` 计数（bar/count/
//     more/end/stale/error/retry 全族）从未断 0——配同帧 cap null + knF disabled +
//     「没有可复制」+ 双族行钮 0 + 点击零写零请求 + spy 0（引用位在帧内最小在场复跑）。
//  B. **详情 500（?doc= 深链抽屉错误锚）帧：全局面 knG 导出全文逐字==无抽屉基线 +
//     hit 行名序列不动 + 列表读集合逐字**：R232① 只做过详情面 knF 侧，knG 全文跨
//     抽屉故障位零 pin；rid 投递逐字同帧并置（钮本体引 R183/R221）。
// 红线沿用：无真 CSV→「导出」=knF/knG 数据行、kn-list-copy 不存在、createObjectURL
// spy 全程 0；行钮分面 -space-/检索面、空态 0 节点非 disabled；本地动作零请求（禁
// 「恰 1 次」）；抽屉开恰 +1 既存详情读、关 0（禁总量全零话术）；缺值两式不统一；
// 短码尾段全 id 仅 title；clip 桩 mockResolvedValue + afterEach unstubAllGlobals
// （jsdom isSecureContext=true 走 https 复制主路径——R210 教训）。
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
const detailUrl = (id: string) => `/agent-api/api/documents/${id}`;

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
const hitNames = () =>
  [...document.querySelectorAll('[data-testid="kn6-search-row"]')].map((r) => txt(r.querySelector('[data-testid="kn6-search-name"]')));
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  const createObjectUrl = vi.fn();
  Object.defineProperty(window.URL, "createObjectURL", { value: createObjectUrl, configurable: true, writable: true });
  return { writeText, createObjectUrl };
};

const G1 = { documentId: "g_1", fileName: "全局一.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T04:00:00Z" };
const G2 = { documentId: "g_2", fileName: "全局二.xlsx", mimeType: "xlsx", sizeBytes: 512, updatedAt: "2026-11-19T03:00:00Z" };
const DET = { documentId: "d_1", fileName: "册一.pdf", mimeType: "pdf", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };

describe("knowledge space empty-state & drawer-500 global export isolation (R257)", () => {
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

  it("A 新增维：true-0 空间详情帧——`knE-page-*` 整族 0 渲染 + cap null（brief「显 0」不可兑现按实记）+ knF disabled/双族行钮 0 + 点击零写零请求 spy 0（门体引 R190④/R231②⑤）", async () => {
    const { writeText, createObjectUrl } = clipStub();
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "空空间", docCount: 0, status: "synced" }] });
      if (url === DOCUMENTS_PLAIN || url === P1URL) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [] });
      return fail(404, "这个数据接口还没有接入。", "rid-r257-a");
    });
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x");
    // 新增维 A：分页全族在场性为 0（bar/count/more/end/stale/error/retry 皆不渲染）
    expect(document.querySelectorAll('[data-testid^="knE-page-"]').length).toBe(0);
    expect(q("kn3-page-cap")).toBeNull(); // null 非 0（换算位）
    expect(container.textContent ?? "").not.toMatch(/(^|[^0-9.])0\s*(条|篇|个)/); // 禁裸 0（R215②:111 同法）
    const f = q("knF-copy") as HTMLButtonElement | null;
    expect(f?.disabled).toBe(true); // 引用位（全句门 R190④）
    expect(f?.getAttribute("title")).toContain("没有可复制");
    expect(document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length).toBe(0); // 空态 0 节点非 disabled
    expect(document.querySelectorAll('button[data-testid^="kn-row-copy-"]').length).toBe(0);
    const c0 = urls().length;
    await clickNode(f, "click empty knF");
    expect(writeText).not.toHaveBeenCalled();
    expect(urls().length).toBe(c0);
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it("B 新增维：详情 500（?doc= 抽屉错误锚+rid 可投）帧——全局面 knG 导出全文 toBe 无抽屉基线 + hit 行名逐字 + 列表读集合不动（knF 侧引 R232①，重试契约引 R183③ 不复写）", async () => {
    const { writeText, createObjectUrl } = clipStub();
    const wireBoth = () =>
      fetchMock.mockImplementation((url: string) => {
        if (url === SPACES) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 1, status: "synced" }] });
        if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [G1, G2] });
        if (url === P1URL) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [DET], nextCursor: null });
        if (url === detailUrl("d_1")) return fail(500, "数据服务暂时没有响应，请稍后重试。", "rid-r257-d");
        return fail(404, "这个数据接口还没有接入。", "rid-r257-b");
      });
    // 基线帧（无抽屉）：knG 全文快照
    wireBoth();
    await render("/knowledge?tab=spaces");
    await clickNode(q("knG-copy"), "knG baseline");
    const gBase = String(writeText.mock.calls[0][0]);
    const hitsBase = hitNames();
    expect(hitsBase).toEqual(["全局一.pdf", "全局二.xlsx"]);
    // 故障帧：space 详情 + ?doc= 深链（详情读 500）
    writeText.mockClear();
    fetchMock.mockClear();
    wireBoth();
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x&doc=d_1");
    expect(q("kn7-preview-error")).toBeTruthy(); // 抽屉错锚（句/互斥引 R183①②/R187②）
    const ridBtn = q("kn7-preview-error")?.querySelector('button[aria-label="复制请求编号"]');
    await clickNode(ridBtn, "copy drawer rid");
    expect(writeText.mock.calls[0][0]).toBe("rid-r257-d"); // rid 可投（钮本体引 R183/R221）
    writeText.mockClear();
    await clickNode(q("knG-copy"), "knG in drawer-500 frame");
    expect(String(writeText.mock.calls[0][0])).toBe(gBase); // **knG 全文逐字零染**（新位）
    expect(hitNames()).toEqual(hitsBase); // 行名序列不动
    expect(urls().filter((u) => u === SPACES || u === DOCUMENTS_PLAIN || u === P1URL).length).toBe(3); // 列表读集合各 1
    expect(urls().filter((u) => u === detailUrl("d_1"))).toHaveLength(1); // 详情读恰 1（失败不自动重试——引 R183③）
    expect(createObjectUrl).not.toHaveBeenCalled();
  });
});
