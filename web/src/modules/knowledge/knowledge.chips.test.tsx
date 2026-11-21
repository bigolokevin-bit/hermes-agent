// R259 — 「筛选 chip ↔ URL 一一对应」按真实标记面落地（纯测试单：零产品改动，未造控件）。
// 名实冲突与映射（产品定版，禁造 chip/全清按钮）：
// · **本模块无 chip 控件**（产品源 grep 0）→ 「标记面」映射为三件真实器械：类型桶
//   `kn-type-*`（aria-pressed）、检索面名搜 `kn6-search-input`/`kn6-search-clear`、
//   排序表头 `kn-sort-*` 的 th `aria-sort`（:1843 实存）；「一键清空全部」不存在——
//   真实清除入口仅 kn-type-all（回全部并双删 ktype/type——:3660-3670）、
//   kn6-search-clear、本地名筛清空（kn3-docs-filter-input 置空）。
// · **无 ?source= 参数**（仅空间行「来源」列标签）；派工 `?type=pdf&source=upload&q=x`
//   换算 `?ktype=PDF`（旧 type 只读兜底）+`?q=`(+规范排序键 ksort/kdir)；负断言：可见
//   全文与 URL 无 "source" 工程串、无 "chip"。无真 CSV→「导出」=knF/knG 数据行、
//   createObjectURL spy 全程 0；kn-list-copy/kn-space-page-cap/kn-more 不存在。
// · **「恰 1 次新取数」驳回**：本地筛选/清除/切桶实测 0 新请求（R215③/R243β/R244δ′/
//   R247①）——本文件逐例 urls join 逐字断言；cursor 只在组件态、归位弃页（R131①）。
// · cap 50 常量/M 可变、true-0/error=null（R108/R157/R187）；行钮分面 -space-/检索面；
//   缺值两式禁统一；短码尾段全 id 仅 title；clip 桩 mockResolvedValue +
//   unstubAllGlobals（R214，Errors 0 硬要求）。
// 【查重（file:line；已锁只引用，禁复写）】R118①:140-163（单参深链回填 aria-pressed/
//   输入值逐字）与⑤:218-235（本地零请求/space 单读）、R146①:111-127（双键共存+双删）、
//   R157②:140-158（q/ktype 互清不牵连·两参简帧）、R164②:146-160（清全键无残留）、
//   R243β（单键移除名筛存活·非叠载帧）、R244γ′δ′/R247①（弃页/序重建/账本）、
//   R235③（筛空往返文本互等）、R218②（计数同源五读）、R249①/R255/R256①。
// 【新增维（点名三条，皆组合位）】
//  A. **三参叠载同帧一一对应唯一性**：ktype+q+ksort/kdir 并载时——恰一键 true 的桶
//     唯一（非 R118① 单参帧）、`aria-sort` 随 ksort/kdir 落位（th 层零 pin）、
//     kn6 输入回填与详情面 data-len 与生效集同源、可见层无工程串负断言。
//  B. **叠载帧单键清除的余参逐字含排序键**：点 kn-type-all → ktype 双删、q/ksort/kdir
//     三键逐字留场（R157② 系双参简帧不含排序键）+ aria-pressed 回「全部」+ 零请求。
//  C. **kn6-search-clear 实态首锁**：清空钮**只清输入框与检索态、不回写 URL**——?q=
//     逐字留场（“移除筛选=删 URL 参”的直觉在位不成立；ksort/kdir/桶态自然不染、零
//     请求）；③复原段并钉 **knF disabled true→false 可用性翻转回正 + 点击恢复写入**
//     （R235③ 只锁文本往返未锁可用性位）、筛空帧 cap=null 复跑与 cap 整句==筛前基线。
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
const btnCount = () => document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length;
const bucketBtns = () => [...document.querySelectorAll('button[data-testid^="kn-type-"]')];
const pressedBuckets = () => bucketBtns().filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => txt(b).replace(/\d+$/, ""));
const capSentence = () => txt(q("kn3-page-cap"));
const dataLines = (text: string) => text.split("\n").slice(1, -1);
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.URL, "createObjectURL", { value: vi.fn(), configurable: true, writable: true });
  return writeText;
};
const typeIn = async (testid: string, value: string, submit = false) => {
  const el = q(testid) as HTMLInputElement | null;
  expect(el, testid).toBeTruthy();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, value);
    el?.dispatchEvent(new Event("input", { bubbles: true }));
    if (submit) el?.closest("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await act(async () => {});
};

const A = { documentId: "d_a", fileName: "人事手册A.pdf", mimeType: "pdf", sizeBytes: 3000, updatedAt: "2026-11-19T07:00:00Z" };
const B2 = { documentId: "d_b", fileName: "人事手册B.pdf", mimeType: "pdf", sizeBytes: 1000, updatedAt: "2026-11-19T06:00:00Z" };
const C = { documentId: "d_c", fileName: "运维手册C.pdf", mimeType: "pdf", sizeBytes: 2000, updatedAt: "2026-11-19T05:00:00Z" };
const X = { documentId: "d_x", fileName: "人事表.xlsx", mimeType: "xlsx", sizeBytes: 4000, updatedAt: "2026-11-19T04:00:00Z" };
const SP = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "人事空间", docCount: 4, status: "synced" }] };
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN || url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: [A, B2, C, X] });
    return fail(404, "这个数据接口还没有接入。", "rid-r259-x");
  });
const STACK = `/knowledge?tab=spaces&panel=spaces&space=sp_x&q=${Q}&ktype=${encodeURIComponent("PDF")}&ksort=size&kdir=asc`;

describe("knowledge filter markers ↔ URL guards (R259)", () => {
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

  it("A 新增维：三参叠载同帧一一对应——桶唯一 pressed=PDF + 表头 aria-sort=ascending(size) + 检索框回填 + data-len 与生效集合同源 + 无工程串/无 source/chip 负断言", async () => {
    clipStub();
    wire();
    await render(STACK);
    expect(pressedBuckets()).toEqual(["PDF"]); // 恰一键 true（唯一性；单参回填引 R118①:142）
    const th = q("kn-sort-size")?.closest("th");
    expect(th?.getAttribute("aria-sort")).toBe("ascending"); // th aria-sort 层首 pin
    expect((q("kn6-search-input") as HTMLInputElement | null)?.value).toBe("人事"); // 检索框回填
    const names = detailNames();
    expect(names).toEqual(["人事手册B.pdf", "运维手册C.pdf", "人事手册A.pdf"]); // ktype=PDF∩size 升序（X 出局）
    expect(Number(q("kn3-docs")?.getAttribute("data-len"))).toBe(names.length); // 计数同源（五读引 R218②）
    expect(capSentence()).toContain("当前已加载 3 篇");
    const visible = txt(container);
    expect(visible).not.toMatch(/source=|chip|application\//i); // 工程串/裸 MIME 不上屏
    expect(loc()).not.toContain("source=");
    expect(params().get("type")).toBeNull(); // 深链走规范键（旧 type 兜底引 R240①）
  });

  it("B+C 新增维：叠载帧单键清除——kn-type-all 双删后 q/ksort/kdir 三键逐字留场 + 零请求；kn6-search-clear 只删 q、排序键与桶态不染（互不串面）", async () => {
    clipStub();
    wire();
    await render(STACK);
    const u0 = urls().join("|");
    // 清类型桶（当前 PDF 在场 → 双删位）
    await clickNode(q("kn-type-all"), "clear ktype");
    expect(params().get("ktype")).toBeNull();
    expect(params().get("type")).toBeNull(); // 双删（引 R146①:119——both-keys 起链位，此为单键起链复跑）
    expect(params().get("q")).toBe("人事"); // 余参逐字含排序键（R157② 简帧不含 ksort/kdir 的首并置）
    expect(params().get("ksort")).toBe("size");
    expect(params().get("kdir")).toBe("asc");
    expect(pressedBuckets()).toEqual(["全部"]);
    expect(detailNames()).toHaveLength(4); // 桶撤后全集回归（排序态存活）
    expect(urls().join("|")).toBe(u0); // 清除零新请求（驳回「恰 1 次」——R215③/R243β 口径）
    // 清检索词——**实态**：kn6-search-clear 只清输入框与检索态，**不回写 URL**（?q= 留场，
    // 首锁入头注 C 维）；排序键与桶态自然不染；零请求。
    await clickNode(q("kn6-search-clear"), "clear q input");
    expect((q("kn6-search-input") as HTMLInputElement | null)?.value).toBe(""); // 输入框清空
    expect(params().get("q")).toBe("人事"); // URL 键留场（clear 非 URL 移除器——实测记录）
    expect(params().get("ksort")).toBe("size");
    expect(params().get("kdir")).toBe("asc");
    expect(pressedBuckets()).toEqual(["全部"]);
    expect(urls().join("|")).toBe(u0); // 再零请求（驳回「恰 1 次」）
  });

  it("C后半 新增维：本地名筛筛空→复原——knF disabled true→**false 回正且点击恢复写入** + cap 整句逐字复原 + 三值==data-len==钮==链 + urls 逐字 + spy 0", async () => {
    const writeText = clipStub();
    wire();
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x");
    const capPre = capSentence(); // 筛前基线（4 篇）
    expect(capPre).toContain("当前已加载 4 篇");
    await typeIn("kn3-docs-filter-input", "手册");
    const names0 = detailNames();
    expect(names0).toEqual(["人事手册A.pdf", "人事手册B.pdf", "运维手册C.pdf"]); // 默认 updated 降序中筛「手册」
    expect(capSentence()).toContain("当前已加载 3 篇"); // M=在屏数（R244γ′ 语义）
    await typeIn("kn3-docs-filter-input", "火星没有");
    const f = q("knF-copy") as HTMLButtonElement | null;
    expect(f?.disabled).toBe(true); // 门（句体与两翼引 R236③:182-210 不复写）
    expect(q("kn3-page-cap")).toBeNull(); // 筛空帧 cap=null 非 0（R234③/R108 位复跑）
    await typeIn("kn3-docs-filter-input", "");
    expect((q("knF-copy") as HTMLButtonElement | null)?.disabled).toBe(false); // **可用性翻转回正**（R235③ 只锁文本往返的新角）
    await clickNode(q("knF-copy"), "knF restored");
    expect(writeText).toHaveBeenCalledTimes(1); // 恢复写入
    const lines = dataLines(String(writeText.mock.calls[0][0]));
    expect(lines.map((l) => l.split(" | ")[0])).toEqual(detailNames());
    expect(capSentence()).toBe(capPre); // cap 整句逐字==筛前基线
    expect([detailNames().length, btnCount(), lines.length, Number(q("kn3-docs")?.getAttribute("data-len"))]).toEqual([4, 4, 4, 4]); // 清筛复原=全集 4（本例无 ktype 叠载）
    expect(urls().length).toBe(3); // 全程本地零新请求（spaces+plain+p1）
  });
});
