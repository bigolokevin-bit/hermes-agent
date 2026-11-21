// R241 — 导出×排序×分页：三腿查重判定 + 「500 窗内切排序」新维本体（纯测试单·零产品改动）。
// 【逐腿判定（红线⑤/⑦：已覆盖只回证据，禁为凑名字造重复用例）】
// · 派工腿①（updated 降序第 2 页三值+首行==屏上）＝**已全覆盖**：R229①
//   （knowledge.export.paged.test.tsx:140-156：三值 toBe+首/末行逐字+名链+cursor 不写
//   URL）+ R238A（knowledge.export.paging.triple.test.tsx:124-140：前缀不变性+四值
//   同帧）+ R216①；且「首行非第 1 页首行」不成立——追加保序、屏上首行=第 1 页首行
//   （R238 头注已裁）。本文件不复写。
// · 派工腿②（翻页后切 sort=size 导出遵新序、无旧行、列表腿恰 1 次）＝**已全覆盖**：
//   R240②（knowledge.export.order.chain.test.tsx:171-188：M=51 切 size=归位弃页
//   51→50、卷 51 出局、钮 [0..49] 重建、cap 回落、urls 逐字零新请求——「恰 1 次取数」
//   当场裁决为 0，R52 口径）；排序真实键 ?ksort/?kdir（旧 sort/dir 只读兜底——R240①
//   :152-169）。本文件不复写。
// · 派工腿③（500 保行+rid+重试 +1+导出只含成功页）＝主体已锁：R237③
//   （knowledge.rowcopy.triple.test.tsx:193-224：窗三读+rid 投递+重试 [+P2URL]+合成）
//   + R238C:162（窗内字节冻结+尾段合成）+ R239③（列表窗×抽屉反向互斥）。
// 【本文件唯一真缺口=新维（点名）】
//  A. **500 窗内切排序**（:2336-2345 归位效应含 setMoreErr(null)——错误窗被排序动作
//     清除从未测）：knE-page-error 消失、50 行/钮 0..49 不动（窗内本无第 2 页）、
//     导出遵**新序**、cap M=50 冻结、urls 快照逐字（清错零网络）、-more 复现（cursor
//     退回首页信封位）；
//  B. 清错后**续翻仍通**：再点 -more → P2 成功、51 行、导出名链==新排序屏上链、
//     cap「已加载 51 篇」、P2URL 请求总数恰 2（败 1 + 成 1）。
// 名实：三腿全落详情面（-space- 族）；无真 CSV→「导出」=knF 数据行、createObjectURL
// spy 全程 0；cursor 只在组件态从请求 URL 断言；51 行跨页夹具（R216 先例）；cap 50
// 常量/M 可变（R108）；缺值两口径不涉；clip 桩 mockResolvedValue + unstubAllGlobals（R214）。
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
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

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
const params = () => new URLSearchParams(txt(q("loc")).replace(/^\?/, ""));
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const rowNodes = () => [...document.querySelectorAll('[data-testid="kn3-docs-row"]')];
const rowNames = () => rowNodes().map((r) => txt(r.querySelector('[data-testid="kn3-docs-name"]')));
const btnIds = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')]
    .map((b) => Number((b.getAttribute("data-testid") ?? "").replace(/\D/g, "")))
    .sort((a, b) => a - b);
const dataLines = (text: string) => text.split("\n").slice(1, -1);
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.URL, "createObjectURL", { value: vi.fn(), configurable: true, writable: true });
  return writeText;
};

// 51 行跨页夹具：size 打散（排序后序必变）；P2 首试 500、再试成功
const page50 = Array.from({ length: 50 }, (_, i) => ({
  documentId: `p1_${String(i + 1).padStart(2, "0")}`,
  fileName: `卷 ${String(i + 1).padStart(2, "0")}.pdf`,
  mimeType: "pdf",
  sizeBytes: 10000 + ((i * 37) % 50) * 100, // 非单调，切 size 必翻序
  updatedAt: `2026-11-1${(i % 9) + 1}T07:00:00Z`,
}));
const ROW51 = { documentId: "p2_51", fileName: "卷 51.pdf", mimeType: "pdf", sizeBytes: 19900, updatedAt: "2026-11-10T01:00:00Z" };
const SP = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 51, status: "synced" }] };
let p2Tries = 0;
const wire = () => {
  p2Tries = 0;
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [page50[0]] });
    if (url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: page50, nextCursor: "cpg2" });
    if (url === P2URL) {
      p2Tries += 1;
      return p2Tries === 1
        ? fail(500, "上游读取失败，请稍后重试。", "rid-r241-p2")
        : Promise.resolve({ asOf: SP.asOf, documents: [ROW51], nextCursor: null });
    }
    return fail(404, "这个数据接口还没有接入。", "rid-r241-x");
  });
};

describe("knowledge export sort×paging window guards (R241)", () => {
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

  it("① 新维A：500 窗内切 size 排序——错误锚被归位动作清除 + 行/钮不动 + 导出遵新序 + cap 冻结 + urls 逐字（零网络清错）", async () => {
    const writeText = clipStub();
    wire();
    await render(DETAIL);
    await clickNode(q("knE-page-more"), "append (will fail)");
    expect(q("knE-page-error")).toBeTruthy();
    expect((q("knE-page-error")?.textContent ?? "")).toContain("请求编号：rid-r241-p2"); // 窗体引用位（R237③）
    const uWin = urls().join("|");
    const capWin = txt(q("kn3-page-cap"));
    // **窗内切排序**（R240② 是健康帧切换；错误窗内切换从未测）
    await clickNode(q("kn-sort-size"), "flip sort=size inside 500 window");
    expect(params().get("ksort")).toBe("size");
    expect(q("knE-page-error")).toBeNull(); // 新位：归位效应 setMoreErr(null) ——错误锚随排序清场
    expect(rowNames()).toHaveLength(50); // 50 保行（本就只有成功页）
    expect(btnIds()).toEqual(Array.from({ length: 50 }, (_, i) => i)); // 钮 0..49 不动
    expect(txt(q("kn3-page-cap"))).toBe(capWin); // cap M=50 逐字冻结（清错不改加载数）
    await clickNode(q("knF-copy"), "knF after in-window sort");
    expect(dataLines(String(writeText.mock.calls[0][0])).map((l) => l.split(" | ")[0])).toEqual(rowNames()); // 导出遵新序
    expect(urls().join("|")).toBe(uWin); // 清错+切序零新请求（排序纯本地——R52/R164①:142）
    expect(q("knE-page-more")).toBeTruthy(); // cursor 退回首页信封位，-more 复现
  });

  it("② 新维B：清错后续翻仍通——再点 -more 成功、51 行钮 0..50、导出名链==新排序屏上链、cap 51、P2URL 恰 2 次（败 1+成 1）", async () => {
    const writeText = clipStub();
    wire();
    await render(DETAIL);
    await clickNode(q("knE-page-more"), "append fail #1");
    await clickNode(q("kn-sort-size"), "sort clears window");
    expect(q("knE-page-error")).toBeNull();
    await clickNode(q("knE-page-more"), "append again #2 (will succeed)");
    expect(urls().filter((u) => u === P2URL)).toHaveLength(2); // 首败 + 续成
    expect(rowNames()).toHaveLength(51);
    expect(btnIds()).toEqual(Array.from({ length: 51 }, (_, i) => i)); // 钮连续（含新行，indexBase 全局——R132/R169）
    expect(txt(q("kn3-page-cap"))).toContain("当前已加载 51 篇"); // cap M 同步
    await clickNode(q("knF-copy"), "knF after recovered paging");
    const lines = dataLines(String(writeText.mock.calls[0][0]));
    expect(lines.map((l) => l.split(" | ")[0])).toEqual(rowNames()); // 导出链==size 新排序屏上链
    expect(lines.some((l) => l.startsWith("卷 51"))).toBe(true); // 行 51 以排序位入链（非末尾拼接——序由列值定）
  });
});
