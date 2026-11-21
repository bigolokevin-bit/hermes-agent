// R240 — 排序链导出三帧：旧键兜底整序 / 分页态切排序现场裁决 / 抽屉开关字段级（纯测试单·零产品改动）。
// 名实（产品定版+实测）：排序真实键 ?ksort/?kdir，旧 ?sort/?dir **只读兜底**
// （:3545-3546 `ksort ?? sort`——腿①深链旧键断言回填行序且 URL 不被改写）；排序**纯
// 本地派生**（后端忽略排序参、请求密钥集 {limit,spaceId} 引 R164①:142；点表头 0 新
// 请求 R52 口径）⇒ 派工腿②「列表腿恰 +1」**不成立**，现场裁决改写为「切排序零新请求
// （urls 快照逐字）+ 归位弃页」——:2344 依赖列含 sort/dir：**分页态切排序实测把 M 从
// 51 打回 50（追加页弃置、回全部不回，R237② 切桶弃页的排序同族新帧）**；「旧 Blob 不
// 残留」换算：无真 CSV（R190①:113-119 源级不变量）→ createObjectURL spy 全程 0 + 导出
// 换代后不含弃置行（「导出」=knF 数据行，禁造控件）；腿③「详情」=kn7 抽屉（开恰 +1
// 既存详情读、关 0——R49/R196）→「零额外列表请求」只断言**列表集合逐字**；三腿行钮
// 全落详情面 kn-row-copy-space-<i>（检索面无分页声明）；51 行跨页夹具（>DOCUMENTS_LIMIT
// =50——R216 先例）；cursor 只在组件态从请求 URL 断言；cap 50 常量/M 可变（R108）；
// 短码大写尾段全 id 仅 title；缺值两口径不涉；clip 桩 mockResolvedValue + unstubAllGlobals（R214）。
// 查重（引用不重写）：R235①②（默认 updated 降序三方首行+叠加翻序 sorted-set 不变——
// **旧键深链与 M=51 帧未测**）、R237①②③（51 钮全链对屏上格/切桶弃页序重建/500 窗）、
// R238A-C（前缀不变/换代==直链/窗冻结）、R239A-C（抽屉×51 四值/切桶过渡态/列表窗反向
// 互斥）、R236①（三帧全文互等——**同文档行字段级未显式**）、R229①/R230①②/R232、
// R216/R131①/R152/R172/R179/R142/R223/R190。
// 新增维（点名）：A 旧键 `?sort=size&dir=desc` **深链整序三载体同帧**（屏上名链==
//   导出行名链==逐钮首段，且 URL 不被改写为 ksort——兜底只读的写侧负断言）；
// B 分页态（M=51）切 size 排序：**归位弃页现场裁决**（50 行、不含卷 51、钮 0..49、
//   cap 回落「已加载 50 篇」、ksort=size 入 URL、urls 逐字零请求、spy 0）；
// C 抽屉开/关两帧**同一文档行五列逐字段** toEqual + 该行格层 4 值==列 0..3 + 列表集合
//   逐字（R236① 全文互等的字段级显式位）。
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
const loc = () => txt(q("loc"));
const params = () => new URLSearchParams(loc().replace(/^\?/, ""));
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const listUrls = () => urls().filter((u) => !u.startsWith("/agent-api/api/documents/d_")).join("|");
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
const openDrawer = async (name: string) => {
  await clickNode(
    rowNodes().find((r) => (r.textContent ?? "").includes(name))?.querySelector('[data-testid="kn3-docs-name"]'),
    `open drawer ${name}`,
  );
};

const SMALL = { documentId: "d_s", fileName: "小档.pdf", mimeType: "pdf", sizeBytes: 10240, updatedAt: "2026-11-19T07:00:00Z" };
const BIG = { documentId: "d_b", fileName: "大档.pdf", mimeType: "pdf", sizeBytes: 30720, updatedAt: "2026-11-19T06:00:00Z" };
const MID = { documentId: "d_m", fileName: "中档.pdf", mimeType: "pdf", sizeBytes: 20480, updatedAt: "2026-11-19T05:00:00Z" };
const SP = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 51, status: "synced" }] };
const wireSmall = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [SMALL] });
    if (url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: [SMALL, BIG, MID], nextCursor: null });
    if (url.startsWith("/agent-api/api/documents/d_")) return Promise.resolve({ sourceName: "原件", status: "indexed" });
    return fail(404, "这个数据接口还没有接入。", "rid-r240-x");
  });
const page50 = Array.from({ length: 50 }, (_, i) => ({
  documentId: `p1_${String(i + 1).padStart(2, "0")}`,
  fileName: `卷 ${String(i + 1).padStart(2, "0")}.pdf`,
  mimeType: "pdf",
  sizeBytes: 10000 + i, // 首屏插入序=升序尾巴——切 size 排序后序必变（防「无操作」空转）
  updatedAt: `2026-11-1${(i % 9) + 1}T07:00:00Z`,
}));
const ROW51 = { documentId: "p2_51", fileName: "卷 51.pdf", mimeType: "pdf", sizeBytes: 999999, updatedAt: "2026-11-10T01:00:00Z" };
const wirePaged = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [page50[0]] });
    if (url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: page50, nextCursor: "cpg2" });
    if (url === P2URL) return Promise.resolve({ asOf: SP.asOf, documents: [ROW51], nextCursor: null });
    return fail(404, "这个数据接口还没有接入。", "rid-r240-y");
  });

describe("knowledge export sort-chain guards (R240)", () => {
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

  it("① 新增维A：旧键 ?sort=size&dir=desc 兜底深链——屏上序==导出链==逐钮首段三载体同帧，URL 不被改写（只读兜底写侧负断言）", async () => {
    const writeText = clipStub();
    wireSmall();
    await render(`${DETAIL}&sort=size&dir=desc`); // 旧键插入序 [小,大,中]
    const names = rowNames();
    expect(names).toEqual(["大档.pdf", "中档.pdf", "小档.pdf"]); // 兜底回填生效（:3545-3546）
    expect(params().get("ksort")).toBeNull(); // 兜底只读：不被静默改写成新键
    expect(loc()).toContain("sort=size&dir=desc"); // 原样保留
    await clickNode(q("knF-copy"), "knF legacy");
    const lines = dataLines(String(writeText.mock.calls[0][0]));
    expect(lines.map((l) => l.split(" | ")[0])).toEqual(names); // 导出链==屏上
    expect(lines[0].split(" | ")[0]).toBe("大档.pdf"); // 首行三方 toBe 位
    for (const i of [0, 1, 2]) {
      writeText.mockClear();
      await clickNode(document.querySelector(`button[data-testid="kn-row-copy-space-${i}"]`), `btn ${i}`);
      expect(String(writeText.mock.calls[0][0]).split("\n")[1].split(" | ")[0]).toBe(names[i]); // 逐钮首段==屏上第 i 行
    }
  });

  it("② 新增维B：M=51 分页态切 size 排序——现场裁决「归位弃页 + 零新请求」（恰 +1 不成立，:2344 依赖列实测；R52/R164 口径）", async () => {
    const writeText = clipStub();
    wirePaged();
    await render(DETAIL);
    await clickNode(q("knE-page-more"), "append to 51");
    expect(urls().filter((u) => u === P2URL)).toHaveLength(1);
    const u0 = urls().join("|");
    await clickNode(q("kn-sort-size"), "sort by size at M=51");
    expect(params().get("ksort")).toBe("size"); // 写只写新键
    expect(rowNames()).toHaveLength(50); // **裁决：追加页被归位弃置**（卷 51 出局）
    expect(btnIds()).toEqual(Array.from({ length: 50 }, (_, i) => i)); // 序重建 0..49
    expect(txt(q("kn3-page-cap"))).toContain("当前已加载 50 篇"); // cap M 回落（R237② 切桶同族）
    await clickNode(q("knF-copy"), "knF after sort");
    const lines = dataLines(String(writeText.mock.calls[0][0]));
    expect(lines.map((l) => l.split(" | ")[0])).toEqual(rowNames()); // 导出遵新序==屏上
    expect(lines.some((l) => l.startsWith("卷 51"))).toBe(false); // 弃置行不入导出（「旧 Blob 不残留」换算位）
    expect(urls().join("|")).toBe(u0); // 切排序+复制零新请求（后端不吃排序参引 R164①:142）
  });

  it("③ 新增维C：抽屉开/关两帧同一文档行五列逐字段 toEqual + 该行屏上 4 格==列 0..3 + 列表集合逐字（R236① 全文互等的字段级显式）", async () => {
    const writeText = clipStub();
    wireSmall();
    await render(DETAIL);
    const list0 = listUrls();
    await openDrawer("大档.pdf");
    expect(q("kn7-preview-panel")).toBeTruthy();
    await clickNode(q("knF-copy"), "knF open frame");
    const openRow = dataLines(String(writeText.mock.calls[0][0])).find((l) => l.startsWith("大档.pdf"))!.split(" | ");
    const host = rowNodes().find((r) => (r.textContent ?? "").includes("大档.pdf"));
    expect([
      txt(host?.querySelector('[data-testid="kn3-docs-type"]')),
      txt(host?.querySelector('[data-testid="kn3-docs-size"]')),
      txt(host?.querySelector('[data-testid="kn3-docs-updated"]')),
    ]).toEqual([openRow[1], openRow[2], openRow[3]]); // 格层==列（30720→"30.0 KB"人话位）
    expect(openRow[2]).toBe("30.0 KB");
    expect(openRow[4]).toMatch(/^[A-Z0-9]+$/);
    await clickNode(q("kn7-preview-close"), "close");
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF closed frame");
    const closedRow = dataLines(String(writeText.mock.calls[0][0])).find((l) => l.startsWith("大档.pdf"))!.split(" | ");
    expect(closedRow).toEqual(openRow); // 同一文档行五列逐字段互等
    expect(listUrls()).toBe(list0); // 开合列表集合逐字（详情读 +1 属既存设计引 R49/R236①）
  });
});
