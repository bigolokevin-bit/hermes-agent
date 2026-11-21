// R244 — 分页×双叠筛合并帧三方首行 + 页 2 态移除桶键的弃页不回/全名链（纯测试单：零产品改动，未造控件）。
// 名实换算（前轮已证事实，逐条落）：①无 ?source= 控件（仅空间行列标签）→ 派工
//   `?type=pdf&source=upload` 换算 ?ktype=PDF（旧 type 只读兜底、清除双删 :3549-3551）
//   × 本地名筛（?q= 属检索面器械，两面具差异引 R228/R242——不可对齐处不宣称双侧同参）；
//   请求键集恰 {limit,spaceId}（R164①:142 同法复跑）。②无真 CSV（源级四件套 0、
//   data-export="absent" ×4——R190①:113-119）→「导出」= knF 数据行、spy 全程 0；
//   kn-list-copy 不存在→knF/knG。③只有详情面分页（knE-page-*、-space- 族 indexBase
//   连续 R132/R169；检索面无分页无 cap 引 R164/R187）；51 行跨页夹具（R216 先例）；
//   cursor 只在组件态——从请求 URL 断言。④派工「首行非第 1 页首行」不成立（R238A
//   实测追加保序）→按实断「首行==屏上首行」并在此记偏差；「移筛选恰 1 次取数」不成立
//   （R240②/R243β 实测零新请求+归位弃页）→按真实计数断言，禁制造请求；cap「0」不可
//   兑现（true-0/error/denied/非法=null——R108/R157/R187/R231/R234/R236）。缺值两口径
//   不涉；短码尾段全 id 仅 title；clip 桩 mockResolvedValue + unstubAllGlobals（R214）。
// 【四腿查重判定（file:line；已覆盖禁重复用例）】
//  · ①（第 2 页三值+首行==屏上）＝已全锁：R229①（export.paged:140-156 三值+首末行+
//    名链+cursor）+ R238A（paging.triple:124-140 前缀不变性+四值）→ 引用不复写。
//  · ②（ktype×名筛交集三值同步）主体＝R234②（locale.cross:175-195 三叠加三值+交集
//    行名）+ R243α（filters.rowcopy:~150 起 三方首行同帧+键集——**非分页帧**）→
//    本文件落新维 γ（合并进 **M=51 分页帧**）。
//  · ③（移筛选换代无旧行）主体＝R243β（移除向单键清除：名筛存活+序重建+链==屏上——
//    非分页帧）+ R237②（51 帧切桶弃页/回全部 0..49+cap 回落——但导出**全名链**未查、
//    无叠筛）→ 本文件落新维 δ（页 2 态 × 双叠筛移除桶键：弃页不回 + 导出 50 全名链）。
//  · ④（空集/失败 disabled+title、cap、spy）＝已全锁：R190④(escape:190-205)+
//    R231②⑤(empty:99/⑤)+R236③(open.detail:182-210 两翼判别)+R234③/R235③（叠加/往返
//    cap null）+R232③（错误站复制侧 disabled）→ 引用不复写。
// 【真新增维（点名两条）】
//  γ. **本地名筛的归位弃页实测帧**（:2344 deps 含 filter）：ktype 在场 append 成 51
//     （cap M=51）→ 打名筛**立即弃页**：集缩为页1 base∩ktype∩名筛=[B,A]、「手册51」
//     出局、cap M 双回落 51→2（M 语义实测=当前条件后在屏加载数）；该帧三值 [2,2,2]+
//     三方首行同帧+全名链==屏上+读口键集 {limit,spaceId}/+cursor 复跑——R235③ 的弃页
//     位从切桶扩到名筛、且首次发生在分页帧；
//  δ. **页 2 叠筛态移除桶键的弃页不回帧**（R243β 的分页合并位）：清 ktype 后名筛存活、
//     集仍 [B,A]、钮 [0,1] 逐字不动、被弃「手册51」不回归（不可逆性直证）、导出链==
//     屏上、cap M=2 复跑、q 面逐字、urls 快照逐字零新请求。
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
const detailRows = () => [...document.querySelectorAll('[data-testid="kn3-docs-row"]')];
const detailNames = () => detailRows().map((r) => txt(r.querySelector('[data-testid="kn3-docs-name"]')));
const btnIds = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')]
    .map((b) => Number((b.getAttribute("data-testid") ?? "").replace(/\D/g, "")))
    .sort((a, b) => a - b);
const hitNames = () => [...document.querySelectorAll('[data-testid="kn6-search-row"]')].map((r) => txt(r.querySelector('[data-testid="kn6-search-name"]')));
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

// 51 行跨页夹具：手册A(idx7)/手册B(idx35) 属 P1，追加行也是 pdf+手册 名——γ 集 [A,B,51]
const page50 = Array.from({ length: 50 }, (_, i) => ({
  documentId: `p1_${String(i + 1).padStart(2, "0")}`,
  fileName: i === 7 ? "手册A.pdf" : i === 35 ? "手册B.pdf" : `卷 ${String(i + 1).padStart(2, "0")}.pdf`,
  mimeType: "pdf",
  sizeBytes: 1000 + i,
  updatedAt: `2026-11-1${(i % 9) + 1}T0${(i % 8) + 1}:00:00Z`,
}));
const ROW51 = { documentId: "p2_51", fileName: "手册51.pdf", mimeType: "pdf", sizeBytes: 999, updatedAt: "2026-11-10T08:00:00Z" };
const SP = { asOf: "2026-11-19T09:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 51, status: "synced" }] };
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [page50[0], ROW51] });
    if (url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: page50, nextCursor: "cpg2" });
    if (url === P2URL) return Promise.resolve({ asOf: SP.asOf, documents: [ROW51], nextCursor: null });
    return fail(404, "这个数据接口还没有接入。", "rid-r244-x");
  });

describe("knowledge paging × filters merged-frame guards (R244)", () => {
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

  it("γ 新增维：ktype 在场 append 成 51（cap M=51）→ **名筛归位弃页**（51→[B,A]、cap M→2）三值 [2,2,2] + 三方首行同帧 + 全名链==屏上 + 读口键集复跑", async () => {
    const writeText = clipStub();
    wire();
    await render(`${DETAIL}&ktype=${encodeURIComponent("PDF")}`);
    await clickNode(q("knE-page-more"), "append to 51");
    expect(urls().filter((u) => u === P2URL)).toHaveLength(1); // cursor 从请求 URL 断言
    expect(detailNames()).toHaveLength(51); // ktype 在场时 append 正常并入（51 帧）
    expect(txt(q("kn3-page-cap"))).toContain("当前已加载 51 篇"); // M=51 位
    // **实测新现实（真新增维 γ′）**：本地名筛同列归位依赖（:2344 deps 含 filter）——
    // append 后打名筛**立即弃页**：51→50 base ∩ ktype ∩ 名筛 = [B,A]，cap M 随双回落
    // 51→2（M 语义实测=当前条件后在屏加载数；R235③ 的弃页位由切桶扩到名筛）。
    await typeIn("手册");
    const names = detailNames();
    expect(names).toEqual(["手册B.pdf", "手册A.pdf"]); // 弃页后集（updated 降序 B 先）
    expect(names.some((n) => n === "手册51.pdf")).toBe(false); // 追加行被名筛归位弃置
    const cap0 = txt(q("kn3-page-cap"));
    expect(cap0).toContain("当前已加载 2 篇");
    await clickNode(document.querySelector('button[data-testid="kn-row-copy-space-0"]'), "btn 0");
    const btnHead = String(writeText.mock.calls[0][0]).split("\n")[1].split(" | ")[0];
    await clickNode(q("knF-copy"), "knF gamma");
    const lines = dataLines(String(writeText.mock.calls[1][0]));
    expect([names.length, btnIds().length, lines.length]).toEqual([2, 2, 2]); // 三值（弃页合并帧）
    expect(btnHead).toBe(names[0]); // 三方首行同帧（R243α 的分页合并位）
    expect(lines[0].split(" | ")[0]).toBe(names[0]);
    expect(lines.map((l) => l.split(" | ")[0])).toEqual(names); // 全名链==屏上
    expect(txt(q("kn3-page-cap"))).toBe(cap0); // cap 逐字冻结
    const reqs = urls().filter((u) => u.includes("spaceId="));
    expect(reqs).toHaveLength(2); // P1+P2 两笔读
    expect([...new URLSearchParams(reqs[0].split("?")[1]).keys()].sort()).toEqual(["limit", "spaceId"]); // 首页恰 {limit,spaceId}（R164①:142 复跑位）
    expect([...new URLSearchParams(reqs[1].split("?")[1]).keys()].sort()).toEqual(["cursor", "limit", "spaceId"]); // 追加页且只多 cursor
  });

  it("δ 新增维：γ 态点「全部」移除桶键——名筛存活 + **弃页不回**（集仍 [B,A]、手册51 不回归、钮 [0,1] 不动）+ 导出全名链==屏上 + cap M=2 复跑 + q 面逐字 + urls 快照逐字", async () => {
    const writeText = clipStub();
    wire();
    await render(`${DETAIL}&ktype=${encodeURIComponent("PDF")}`);
    await clickNode(q("knE-page-more"), "append");
    await typeIn("手册");
    const u0 = urls().join("|");
    const hit0 = hitNames();
    await clickNode(q("kn-type-all"), "clear ktype at paging+overlay state");
    expect(params().get("ktype")).toBeNull();
    const names = detailNames();
    // **弃页不可逆（δ′）**：移除桶键后名筛存活、集仍=[B,A]；被弃的「手册51」不回、
    // 也不因 ktype 移除而扩容（51 帧 base 已归位 50）——钮 [0,1] 逐字不动
    expect(names).toEqual(["手册B.pdf", "手册A.pdf"]);
    expect(names.some((n) => n === "手册51.pdf")).toBe(false);
    expect(btnIds()).toEqual([0, 1]); // 钮序不因移除动作变化（弃页不回的直接取证）
    await clickNode(q("knF-copy"), "knF delta");
    expect(dataLines(String(writeText.mock.calls[0][0])).map((l) => l.split(" | ")[0])).toEqual(names); // 导出链==屏上（R237② 只数行/计 cap 的补强位）
    expect(txt(q("kn3-page-cap"))).toContain("当前已加载 2 篇"); // M 语义帧复跑（=在屏加载数，非 base50）
    expect(hitNames()).toEqual(hit0); // 检索面（q 面）逐字不动
    expect(urls().join("|")).toBe(u0); // 移除+复制零新请求（不制造「恰 1 次」）
  });
});
