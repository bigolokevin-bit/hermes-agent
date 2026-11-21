// R243 — 叠加筛下三方首行 + **单键移除**后的序号重建/代际换代（纯测试单：零产品改动，未造控件）。
// 名实换算（四条硬口径均产品定版）：①无 ?source= 控件（仅空间行列标签）——派工
//   `?type=pdf&source=upload&q=` 换算 ?ktype=PDF（旧 type 只读兜底、清除双删——
//   :3549-3551）× 本地名筛 × ?q= 真实叠加，未造参数；请求键集恰 {limit,spaceId}
//   （R164①:142 同法复跑一帧）。②无真 CSV（源级 createObjectURL/text/csv/a.download/
//   new Blob 全 0、data-export="absent" ×4——R190①:113-119）→「导出 CSV 行」= knF
//   数据行（DOC_LINE_HEADER 5 列）；kn-list-copy 不存在 → knF/knG；spy 全程 0。
//   行钮分面 -space-（详情，唯一分页面）/检索面（R132/R169）；kn-doc-copy 单控件非行数；
//   cap 50 常量/M 可变、true-0/错/拒/非法=null（R108/R157/R187/R231/R234③/R236③）；
//   缺值两口径不涉；clip 桩 mockResolvedValue + unstubAllGlobals（R214）。
// 【四腿判定（查重 file:line；已覆盖只引用——红线禁重复用例）】
//  · 腿① 主体（三叠加三值+交集行名）＝ R234②（knowledge.export.locale.cross.test.tsx
//    :175-195）已锁 → 本文件落新维 α。
//  · 腿② 主体（切桶序重建/换代零残留/往返）＝ R237②（knowledge.rowcopy.triple.test.tsx
//    :170-191）+ R235③（order.filter :~筛空往返字节级）已锁 → 本文件落新维 β（移除向）。
//  · 腿③ 「RFC4180 往返」不可兑现＝已锁：R236②（knowledge.export.open.detail.test.tsx
//    :155-181）怪名**四载体**（格/行钮/knF/knG）原样逐字、无 ""、物理行数后果+「将来落
//    真 CSV 转义该组转红」哨兵声明俱在 → **引用不复写**。
//  · 腿④ 空集门+cap 现状＝已锁：R190④（export.escape :190-205）+ R231②⑤
//    （empty.export :99/:⑤追加分支）+ R236③（两翼判别句 :182-210）+ R234③（叠加筛空）
//    ——cap 实测 null（「显 0」不可兑现）+ 零写零请求 + spy 0 → **引用不复写**。
// 【真新增维（点名 ≥2，皆未锁交互）】
//  α. **三叠加帧首行三方同帧**：行钮 0 串首段 == 屏上首行 == knF 首行（R234② 只锁
//     两方 lines==names，钮 0 未入）+ cap 整句在复制动作前后逐字冻结 + 请求键集复跑。
//  β. **从三叠加态移除 ktype 单键**（点当前桶「全部」清除=双删位）：其余筛选**原位
//     保留**（名筛本地态 + ?q= URL 逐字）→ 详情面钮序从 0 重建为「仅剩名筛」集
//     [0..2] 连续、三值 + 首行三方再同帧、导出换代纳入被桶筛掉的「丙」（无旧代际缺失
//     也无 q 面泄漏）、检索面行/钮逐字不动、全程 urls 快照逐字零新请求。
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
const Q = encodeURIComponent("人事");

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
const detailRows = () => [...document.querySelectorAll('[data-testid="kn3-docs-row"]')];
const detailNames = () => detailRows().map((r) => txt(r.querySelector('[data-testid="kn3-docs-name"]')));
const hitRows = () => [...document.querySelectorAll('[data-testid="kn6-search-row"]')];
const hitNames = () => hitRows().map((r) => txt(r.querySelector('[data-testid="kn6-search-name"]')));
const hitBtnIds = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-"]')]
    .filter((b) => !(b.getAttribute("data-testid") ?? "").includes("-space-"))
    .map((b) => Number((b.getAttribute("data-testid") ?? "").replace(/\D/g, "")))
    .sort((a, b) => a - b);
const detailBtnIds = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')]
    .map((b) => Number((b.getAttribute("data-testid") ?? "").replace(/\D/g, "")))
    .sort((a, b) => a - b);
const btn0 = () => document.querySelector('button[data-testid="kn-row-copy-space-0"]');
const dataLines = (text: string) => text.split("\n").slice(1, -1);
const typeIn = async (value: string) => {
  const el = q("kn3-docs-filter-input") as HTMLInputElement | null;
  expect(el, "kn3-docs-filter-input").toBeTruthy();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, value);
    el?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {});
};
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.URL, "createObjectURL", { value: vi.fn(), configurable: true, writable: true });
  return writeText;
};

const JIA = { documentId: "d_jia", fileName: "人事手册甲.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const YI = { documentId: "d_yi", fileName: "人事手册乙.pdf", mimeType: "pdf", sizeBytes: 4096, updatedAt: "2026-11-19T06:00:00Z" };
const BING = { documentId: "d_bing", fileName: "运维手册丙.docx", mimeType: "docx", sizeBytes: 8192, updatedAt: "2026-11-19T05:00:00Z" };
const DING = { documentId: "d_ding", fileName: "人事记录丁.pdf", mimeType: "pdf", sizeBytes: 512, updatedAt: "2026-11-19T04:00:00Z" };
const SP = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "人事空间", docCount: 4, status: "synced" }] };
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [JIA, DING] });
    if (url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: [JIA, YI, BING, DING], nextCursor: null });
    return fail(404, "这个数据接口还没有接入。", "rid-r243-x");
  });
const TRIPLE = `/knowledge?tab=spaces&panel=spaces&space=sp_x&q=${Q}&ktype=${encodeURIComponent("PDF")}`;

describe("knowledge filters-overlay rowcopy guards (R243)", () => {
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

  it("α 三叠加帧（ktype×名筛×q）：首行三方同帧（钮 0 串==屏上==knF 首行）+ 三值 + cap 复制前后逐字冻结 + 请求键集 {limit,spaceId}", async () => {
    const writeText = clipStub();
    wire();
    await render(TRIPLE);
    await typeIn("手册");
    const names = detailNames();
    expect(names).toEqual(expect.arrayContaining(["人事手册甲.pdf", "人事手册乙.pdf"]));
    expect(names.every((n) => n.endsWith(".pdf"))).toBe(true); // ktype∩名筛（q 不进详情表引 R164①:122）
    const cap0 = txt(q("kn3-page-cap"));
    expect(cap0).toContain("本页最多显示 50 篇"); // 常量槽位（M 语义不宣称——R108 地盘）
    await clickNode(btn0(), "row btn 0");
    const btnHead = String(writeText.mock.calls[0][0]).split("\n")[1].split(" | ")[0];
    await clickNode(q("knF-copy"), "knF");
    const lines = dataLines(String(writeText.mock.calls[1][0]));
    expect([names.length, detailBtnIds().length, lines.length]).toEqual([2, 2, 2]); // 三值
    expect(btnHead).toBe(names[0]); // **三方首行同帧**（R234② 的两方位补第三向）
    expect(lines[0].split(" | ")[0]).toBe(names[0]);
    expect(txt(q("kn3-page-cap"))).toBe(cap0); // 复制动作不扰动 cap（逐字冻结位）
    for (const req of urls().filter((u) => u.includes("spaceId="))) {
      expect([...new URLSearchParams(req.split("?")[1]).keys()].sort()).toEqual(["limit", "spaceId"]); // 键集复跑
    }
  });

  it("β 从三叠加态移除 ktype 单键（点「全部」清除）：名筛与 ?q= 原位保留 → 钮序自 0 重建为「仅名筛」集 [0..2] 三值 + 首行三方 + 丙入换代 + 检索面逐字不动 + urls 快照逐字", async () => {
    const writeText = clipStub();
    wire();
    await render(TRIPLE);
    await typeIn("手册");
    const u0 = urls().join("|");
    const hitNames0 = hitNames();
    const hitBtns0 = hitBtnIds();
    // 移除 ktype（当前桶 PDF 在场，点「全部」=清除双删位——:3660-3670）
    await clickNode(q("kn-type-all"), "clear ktype only");
    expect(params().get("ktype")).toBeNull();
    expect(params().get("q")).toBe("人事"); // 其余 URL 键原位（一键清除不牵连——引 R118②/R157②）
    const names = detailNames();
    expect(names).toEqual(expect.arrayContaining(["人事手册甲.pdf", "人事手册乙.pdf", "运维手册丙.docx"])); // 名筛本地态存活，丙回归
    expect(detailBtnIds()).toEqual([0, 1, 2]); // **序自 0 连续重建**（移除向新帧）
    await clickNode(btn0(), "btn 0 after removal");
    expect(String(writeText.mock.calls[0][0]).split("\n")[1].split(" | ")[0]).toBe(names[0]); // 三方首行再同帧
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF after removal");
    const lines = dataLines(String(writeText.mock.calls[0][0]));
    expect([names.length, detailBtnIds().length, lines.length]).toEqual([3, 3, 3]); // 三值随换代
    expect(lines.map((l) => l.split(" | ")[0])).toEqual(names); // 换代含丙、无 q 面泄漏
    expect(hitNames()).toEqual(hitNames0); // 检索面（q=人事 → 甲/丁）逐字不动
    expect(hitBtnIds()).toEqual(hitBtns0);
    expect(urls().join("|")).toBe(u0); // 移除+名筛存活+复制全程零新请求
  });
});
