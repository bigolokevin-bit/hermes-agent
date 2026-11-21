// R238 — 导出 × 分页三链·字节级前缀护栏（纯测试单：零产品改动，未造控件）。
// 名实（产品定版）：三腿全落**空间详情面**（唯一分页面 knE-page-*，行钮 kn-row-copy-space-<i>；
// 检索面无分页不参与——声明）；无真 CSV（源级四件套 0、data-export="absent"——R190①:113-119）
// →「导出」= knF-copy 数据行（docCopyText 5 列）；createObjectURL 全程 spy 0；?type=pdf 换算
// ?ktype=（旧 type 兜底——:3549-3551）；cursor 只在组件态——从**请求 URL** 断言；51 行跨页
// 夹具（R216/R229 先例：P1 恰满 50 触发 -more）；cap 50 常量槽/M 可变位（引 R108）。
// clip 桩 mockResolvedValue + unstubAllGlobals（R214）。缺值两口径不涉本轮。
// **已知重叠（引用不重写，红线⑤）**：①三值+首末行+名链=R229①:157-171 + R216①:134-148
// （四值含 data-len）；②换桶换代零旧行零请求=R229②:173-190 + R131①:115-125 + R237②:168-186
// （序重建/归位弃页）；③500 保行+rid+重试 +1+三值=R237③:188-220 + R216④ + R131③/R197④。
// 派工①「首行非第 1 页首行」不成立：追加保持序、屏上首行仍为第 1 页首行（R229① 已锁三方
// 互等）——按实记录不造假。本文件按红线⑦把三腿各自**唯一未锁的导出侧字节位**落死：
// 新增维（点名）：
//  A. **追加前缀不变性**：加载第 2 页后，导出前 50 行逐字节==追加前快照、第 51 行才新增
//     （R229① 只数追加后一帧，从未对追加前后做前缀等值）；
//  B. **切桶换代==直链态互等**：51 帧切「表格」后的导出全文，逐字节 == 全新挂载深链
//     ?ktype=表格 的导出全文（R229② 查集与零残留、R237② 查序与弃页，**两态等值**未测）；
//  C. **500 窗导出冻结到字节 + 重试尾段合成**：窗内导出全文逐字节==失败前快照（R237③ 只
//     数 50 行，未做文本冻结）且不含「卷 51」；重试成功后 51 行 = 前 50 行逐字节==窗前
//     + 尾行「卷 51」入链（增量合成式对账，非重算全链）。
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
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const rowNodes = () => [...document.querySelectorAll('[data-testid="kn3-docs-row"]')];
const btnCount = () => document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length;
const bucketByLabel = (label: string) =>
  [...document.querySelectorAll('button[data-testid^="kn-type-"]')].find((b) => txt(b).startsWith(label)) ?? null;
const dataLines = (text: string) => text.split("\n").slice(1, -1);
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.URL, "createObjectURL", { value: vi.fn(), configurable: true, writable: true });
  return writeText;
};

const page50 = Array.from({ length: 50 }, (_, i) =>
  i === 3 || i === 20
    ? { documentId: `p1_x${i}`, fileName: `册 ${String(i + 1).padStart(2, "0")}.xlsx`, mimeType: "xlsx", sizeBytes: 700 + i, updatedAt: `2026-11-1${(i % 9) + 1}T07:00:00Z` }
    : { documentId: `p1_${String(i + 1).padStart(2, "0")}`, fileName: `卷 ${String(i + 1).padStart(2, "0")}.pdf`, mimeType: "pdf", sizeBytes: 100 + i, updatedAt: `2026-11-1${(i % 9) + 1}T06:00:00Z` },
);
const ROW51 = { documentId: "p2_51", fileName: "卷 51.pdf", mimeType: "pdf", sizeBytes: 999, updatedAt: "2026-11-10T01:00:00Z" };
const SP = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 51, status: "synced" }] };
const wirePaged = (opts: { p2?: () => Promise<unknown> } = {}) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: page50.slice(0, 2) });
    if (url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: page50, nextCursor: "cpg2" });
    if (url === P2URL) return (opts.p2 ?? (() => Promise.resolve({ asOf: SP.asOf, documents: [ROW51], nextCursor: null })))();
    return fail(404, "这个数据接口还没有接入。", "rid-r238-x");
  });

describe("knowledge export paging byte-level guards (R238)", () => {
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

  it("① 追加前缀不变性（新增维A；三值/四值/名链/首行引 R229①+R216①不复写，屏上首行现状=第 1 页首行按实记录）", async () => {
    const writeText = clipStub();
    wirePaged();
    await render(DETAIL);
    await clickNode(q("knF-copy"), "knF before append");
    const pre = dataLines(String(writeText.mock.calls[0][0]));
    expect(pre).toHaveLength(50);
    await clickNode(q("knE-page-more"), "append");
    expect(urls().filter((u) => u === P2URL)).toHaveLength(1); // cursor 只在请求线
    await clickNode(q("knF-copy"), "knF after append");
    const post = dataLines(String(writeText.mock.calls[1][0]));
    expect(post).toHaveLength(51);
    expect(post.slice(0, 50)).toEqual(pre); // **前 50 行逐字节不变**（新增维A）
    expect(post[50].split(" | ")[0]).toBe("卷 51.pdf"); // 只增尾行
    expect(post[0].split(" | ")[0]).toBe(txt(rowNodes()[0].querySelector('[data-testid="kn3-docs-name"]'))); // 首行==屏上首行现状位（引 R229①）
    expect([rowNodes().length, btnCount(), Number(q("kn3-docs")?.getAttribute("data-len"))]).toEqual([51, 51, 51]); // 四值复跑引用位
  });

  it("② 切桶换代 == 直链深链态逐字互等（新增维B；换代集/序重建/弃页/零请求引 R229②+R237②不复写）", async () => {
    const writeText = clipStub();
    wirePaged();
    await render(DETAIL);
    await clickNode(q("knE-page-more"), "append");
    const u0 = urls().join("|");
    await clickNode(bucketByLabel("表格"), "ktype 表格 at M=51");
    await clickNode(q("knF-copy"), "knF after switch");
    const switched = String(writeText.mock.calls[0][0]);
    expect(urls().join("|")).toBe(u0); // 切桶+复制零新请求（本地动作读口不吃 ktype）
    // 全新挂载直链 ?ktype=表格：两态导出全文逐字节互等
    writeText.mockClear();
    fetchMock.mockClear();
    wirePaged();
    await render(`${DETAIL}&ktype=${encodeURIComponent("表格")}`);
    await clickNode(q("knF-copy"), "knF direct deep-link");
    expect(String(writeText.mock.calls[0][0])).toBe(switched); // 换代态==直链态（新增维B）
    expect(dataLines(String(writeText.mock.calls[0][0])).length).toBe(2); // 两态同为归位页 1 的 xlsx 集
  });

  it("③ 500 窗导出冻结到字节 + 重试尾段合成（新增维C；保行/rid/重试/三值引 R237③ 不复写）", async () => {
    const writeText = clipStub();
    let failP2 = true;
    wirePaged({
      p2: () =>
        failP2
          ? fail(500, "上游读取失败，请稍后重试。", "rid-r238-p2")
          : Promise.resolve({ asOf: SP.asOf, documents: [ROW51], nextCursor: null }),
    });
    await render(DETAIL);
    await clickNode(q("knF-copy"), "knF pre-fail");
    const textPre = String(writeText.mock.calls[0][0]);
    await clickNode(q("knE-page-more"), "append (will fail)");
    expect(q("knE-page-error")).toBeTruthy();
    expect((q("knE-page-error")?.textContent ?? "")).toContain("请求编号：rid-r238-p2"); // rid（R237③/R216④ 引用位）
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF in error window");
    const textWin = String(writeText.mock.calls[0][0]);
    expect(textWin).toBe(textPre); // **窗内导出全文逐字节冻结**（R237③ 只数行，文本冻结新位）
    expect(textWin).not.toContain("卷 51"); // 不含未成功页
    // 重试恰 +1（引 R237③ 计数位）后：51 行 = 窗前 50 行 + 尾行合成
    failP2 = false;
    const c0 = urls().length;
    await clickNode(q("knE-page-retry"), "retry");
    expect(urls().length).toBe(c0 + 1);
    expect(urls().at(-1)).toBe(P2URL);
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF after retry");
    const textPost = String(writeText.mock.calls[0][0]);
    const postLines = dataLines(textPost);
    expect(dataLines(textPost).length).toBe(51);
    expect(postLines.slice(0, 50)).toEqual(dataLines(textWin)); // 前缀==窗前快照
    expect(postLines[50].split(" | ")[0]).toBe("卷 51.pdf"); // 尾行入链
  });
});
