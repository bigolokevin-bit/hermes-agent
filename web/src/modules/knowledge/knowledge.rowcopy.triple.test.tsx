// R237 — 行钮 × 分页 × 切桶三链护栏（纯测试单：零产品改动，未造控件）。
// 名实换算（产品定版）：三腿**全落空间详情面**（唯一分页面 knE-page-*，行钮实名
// kn-row-copy-space-<i>，indexBase 全局 0..N-1——R132/R169；检索面 kn6 无分页不参与）；
// 派工「?type=pdf」换算 ?ktype=（旧 type 只读兜底——:3549-3551）；kn-doc-copy 单控件
// 非行数；**cursor 只在组件态不入 URL**——追加/失败一律从请求 URL 断言；cap 的 50 为
// 常量槽、M 为「当前已加载」可变位（true-0/错误/拒绝/非法=null——R108/R157/R187 引用）；
// 表格仅 4 个值格（名/类型/大小/更新，:2136-2147 实读）——**短码无表内格**，按钮串第
// 5 列的大写尾段形制 + 全 id 不上屏（R197 口径 + 本例负断言）断言，禁造第五格对账。
// 本地动作零新请求：切桶零请求且归位页 1、行替换非累加（R131①/R229②③ 引用+复跑）。
// 51 行跨页夹具（R216 先例）：P1 恰满 50（48 pdf + 2 xlsx）、P2「卷 51.xlsx」（追加行
// 属表格桶——②的换桶集跨页取证）。clip 桩 mockResolvedValue + unstubAllGlobals（R214）。
// 查重（引用不重写）：R229①:157-171（分页 knF 全名链+首末行）、R229②:173-190（第 2
// 页态真换桶导出换代——**钮序重建/零残留未查**）、R223（行钮↔knF 逐行链·非分页帧）、
// R216①④（51 帧四值计数+500 保行 rid 重试——**钮序连续与导出侧未入窗**）、R225（预览
// 帧序列）、R197①/R131③/R142①/R152/R164/R191（无此文件——grep 证实）/R132/R169/
// R226①/R227/R233/R234/R235/R236。
// 新增维（点名）：
//  A. 第 2 页入链后**逐钮×屏上 4 值格全链**（51 钮全量：钮 i 的第 0..3 列逐字==其宿主
//     行的名/类型人话/大小/更新格；短码列形制+全 id 负断言——R223 链是钮↔knF 文本，
//     从未对到**屏上格**且非分页态）；
//  B. 51 帧切桶「表格」后**钮序从 0 重建** + **归位即弃追加页**（实测更强现实：卷 51
//     出局、回「全部」复原为 0..49 而非 0..50..51，cap M 随归位回落）+ pdf 零残留 +
//     全程 urls 逐字（R229② 查了导出换代，序重建/追加页弃留未查）；
//  C. 500 错误窗内**钮序连续 [0..49] + cap 逐字冻结 + 导出行集不动**（三读同窗），
//     重试恰 [+P2URL] 成功后三值与导出**同步到 51**（导出侧入窗入链为 R216④ 未测位）。
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
const btnIds = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')]
    .map((b) => Number((b.getAttribute("data-testid") ?? "").replace(/\D/g, "")))
    .sort((a, b) => a - b);
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

// P1 50 笔（48 pdf + 2 xlsx）；P2 追加「卷 51.xlsx」入表格桶（②跨页取证位）
const page50 = Array.from({ length: 50 }, (_, i) =>
  i === 3 || i === 20
    ? { documentId: `p1_x${i}`, fileName: `册 ${String(i + 1).padStart(2, "0")}.xlsx`, mimeType: "xlsx", sizeBytes: 700 + i, updatedAt: `2026-11-1${(i % 9) + 1}T07:00:00Z` }
    : { documentId: `p1_${String(i + 1).padStart(2, "0")}`, fileName: `卷 ${String(i + 1).padStart(2, "0")}.pdf`, mimeType: "pdf", sizeBytes: 100 + i, updatedAt: `2026-11-1${(i % 9) + 1}T06:00:00Z` },
);
const ROW51 = { documentId: "p2_51", fileName: "卷 51.xlsx", mimeType: "xlsx", sizeBytes: 999, updatedAt: "2026-11-10T01:00:00Z" };
const SP = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 51, status: "synced" }] };
const wirePaged = (opts: { p2Responder?: () => Promise<unknown> } = {}) => {
  let p2Attempts = 0;
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: page50.slice(0, 2) });
    if (url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: page50, nextCursor: "cpg2" });
    if (url === P2URL) {
      p2Attempts += 1;
      return (opts.p2Responder ?? (() => Promise.resolve({ asOf: SP.asOf, documents: [ROW51], nextCursor: null })) )();
    }
    return fail(404, "这个数据接口还没有接入。", "rid-r237-x");
  });
  return () => p2Attempts;
};

describe("knowledge rowcopy paging & filter triple chains (R237)", () => {
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

  it("① 51 钮全链（新增维A）：每钮第 0..3 列逐字==其宿主行 名/类型/大小/更新 格，序 0..50 连续；短码列形制+全 id 负断言", async () => {
    const writeText = clipStub();
    wirePaged();
    await render(DETAIL);
    await clickNode(q("knE-page-more"), "append");
    expect(urls().filter((u) => u === P2URL)).toHaveLength(1); // cursor 从请求 URL 断言（不入 URL）
    expect(q("loc")?.textContent ?? "").not.toContain("cursor");
    expect(btnIds()).toEqual(Array.from({ length: 51 }, (_, i) => i)); // 连续（引 R229①复跑）
    // 全量逐钮：宿主行四值格逐字互等（屏上格层首次整链；行钮↔knF 链引 R223 不复写）
    for (const i of Array.from({ length: 51 }, (_, k) => k)) {
      const btn = document.querySelector(`button[data-testid="kn-row-copy-space-${i}"]`);
      const host = btn?.closest("tr");
      expect(host, `host row ${i}`).toBeTruthy();
      writeText.mockClear();
      await clickNode(btn, `row copy ${i}`);
      const c = String(writeText.mock.calls[0][0]).split("\n")[1].split(" | ");
      expect(c[0]).toBe(txt(host?.querySelector('[data-testid="kn3-docs-name"]')));
      expect(c[1]).toBe(txt(host?.querySelector('[data-testid="kn3-docs-type"]')));
      expect(c[2]).toBe(txt(host?.querySelector('[data-testid="kn3-docs-size"]')));
      expect(c[3]).toBe(txt(host?.querySelector('[data-testid="kn3-docs-updated"]')));
      expect(c[4]).toMatch(/^[A-Z0-9]+$/); // 短码大写尾段形制（无表内格——名实注记）
    }
    // 全 id 不上屏（负扫：任一 documentId 不出现在任一钮串）
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF all");
    const fAll = String(writeText.mock.calls[0][0]);
    expect(fAll).not.toContain("p1_07");
    expect(fAll).not.toContain("p2_51");
    expect(dataLines(fAll)).toHaveLength(51); // 三值同步（表体 51==钮 51==导出 51）
  });

  it("② 51 帧切桶「表格」钮序从 0 重建恰 [0,1,2]（含追加行）+ pdf 零残留 + 回全部复原（新增维B；导出换代引 R229②不复写）", async () => {
    const writeText = clipStub();
    wirePaged();
    await render(DETAIL);
    await clickNode(q("knE-page-more"), "append");
    expect(rowNodes()).toHaveLength(51);
    const u0 = urls().join("|");
    await clickNode(bucketByLabel("表格"), "ktype 表格 at M=51");
    // 实测更强现实（新增维升级）：切桶归位页 1 即**弃追加页**——卷 51 出局且回全部不回
    expect(btnIds()).toEqual([0, 1]); // 序从 0 重建（P1 的 2 笔 xlsx）
    const names = rowNodes().map((r) => txt(r.querySelector('[data-testid="kn3-docs-name"]')));
    expect(names).toEqual(["册 04.xlsx", "册 21.xlsx"]); // 行替换非累加（R131①/R229③ 口径）
    expect(txt(q("kn3-docs"))).not.toMatch(/卷 \d+\.pdf|卷 51/); // 详情面内 pdf 零残留 + 追加行出局（检索面同屏不参与——名实分面）
    expect(urls().join("|")).toBe(u0); // 切桶+归位零新请求（读口不吃 ktype）
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF bucketed");
    expect(dataLines(String(writeText.mock.calls[0][0]))).toHaveLength(2); // 导出随集
    await clickNode(q("kn-type-all"), "back to 全部");
    expect(btnIds()).toEqual(Array.from({ length: 50 }, (_, i) => i)); // 归位后全部=50（非 51）
    expect(txt(q("kn3-page-cap"))).toContain("当前已加载 50 篇"); // cap M 随归位回落
    expect(urls().join("|")).toBe(u0); // 全程零请求
  });

  it("③ 第 2 页 500 窗三读同窗（钮序 [0..49] 连续+cap 冻结+导出不动）→ 重试恰 [+P2URL] 成功后三值与导出同步 51（新增维C；保行/rid/重试腿引 R216④/R131③）", async () => {
    const writeText = clipStub();
    let failP2 = true;
    wirePaged({
      p2Responder: () =>
        failP2
          ? fail(500, "上游读取失败，请稍后重试。", "rid-r237-p2")
          : Promise.resolve({ asOf: SP.asOf, documents: [ROW51], nextCursor: null }),
    });
    await render(DETAIL);
    const cap0 = txt(q("kn3-page-cap"));
    expect(cap0).toContain("当前已加载 50 篇");
    await clickNode(q("knE-page-more"), "append (will fail)");
    expect(q("knE-page-error")).toBeTruthy(); // 错误行在场（引 R131③）
    expect((q("knE-page-error")?.textContent ?? "")).toContain("请求编号：rid-r237-p2"); // rid 上屏（R216④）
    expect(rowNodes()).toHaveLength(50); // 保旧行
    expect(btnIds()).toEqual(Array.from({ length: 50 }, (_, i) => i)); // 窗内钮序连续（新位）
    expect(txt(q("kn3-page-cap"))).toBe(cap0); // 窗内 cap 逐字冻结（四读在窗引 R197④，逐字位新锁）
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF in error window");
    expect(dataLines(String(writeText.mock.calls[0][0]))).toHaveLength(50); // 导出行集不动（导出入窗新位）
    // rid 可复制（钮在场引 R216④；投递逐字 rid 位）
    const ridBtn = q("knE-page-error")?.querySelector('button[aria-label="复制请求编号"]');
    await clickNode(ridBtn, "copy rid");
    expect(writeText.mock.calls.at(-1)![0]).toBe("rid-r237-p2");
    // 重试：恰 +1 且只加 P2 请求
    const u1 = urls().join("|");
    failP2 = false;
    await clickNode(q("knE-page-retry"), "retry");
    expect(urls().filter((u) => u === P2URL).length).toBe(2); // 首失败 1 + 重试 1（增量恰 [P2URL]）
    expect(urls().slice(0, -1).join("|")).toBe(u1); // 只新增这一条
    expect(q("knE-page-error")).toBeNull(); // 错误锚消失
    expect([rowNodes().length, btnIds().length]).toEqual([51, 51]); // 三值同步
    expect(txt(q("kn3-page-cap"))).toContain("当前已加载 51 篇"); // cap M 跟随
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF after retry");
    expect(dataLines(String(writeText.mock.calls[0][0]))).toHaveLength(51); // 导出同步到 51
  });
});
