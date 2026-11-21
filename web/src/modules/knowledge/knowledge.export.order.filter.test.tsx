// R235 — 导出序 × 叠加筛 × 空集往返护栏（纯测试单：零产品改动，未造控件）。
// 名实换算（产品定版）：①无真 CSV（源级四件套 0、data-export="absent" ×4——R190①:113-119）
// →「导出」= knF-copy 数据行（详情面 5 列，R200②/R214②列标准引用）；createObjectURL
// 全程 spy 0。②**无 ?source= 控件**（source 仅空间行列标签）——派工「?type=pdf&source=
// upload 叠加」换算为 ?ktype=（真实键，旧 type 兜底——:3549-3551）× 本地名筛（R157①）；
// 未造参数。③排序纯本地：?ksort/?kdir（旧 sort/dir 兜底）、请求不带排序参（R164①:142
// 密钥集 {limit,spaceId} 引用不重写）；**updated 降序=默认态**（ksort 缺省）。
// ④腿③「cap 显 0」按实测：true-0/错误/拒绝/非法=null（R108/R157/R187/R231②）；本轮
// 新测得**叠加筛空（ktype 在场×名筛清零）帧同样 null**（口径延伸入锁；更正 R234③
// 回执——其双分支当帧实走「缺席」支，「在场逐字」支未执行，此处按实重锁）；筛中帧
// cap 整句按实测串逐字往返复原。禁假 0 与裸「0 条/0 篇/0 个」（R215②:111 同法）。
// 缺值两口径不涉本轮；行钮分面 -space- 族（indexBase 连续，R132/R169）；kn-doc-copy
// 单控件非行数；clip 桩 mockResolvedValue + unstubAllGlobals（R214 教训）。
// 查重（引用不重写）：R229①:157-171（分页 51 帧首末行/全名链）、R223（行钮↔knF 逐行
// 链）、R142①:124（单页三值——无时间打散/无叠加态）、R234②（三叠加三值+交集行名——
// **排序维度未入**）、R234③（叠加筛空门+cap 在场位）、R221②（错误窗翻序零请求——非
// 导出侧）、R164①②、R190/R200②/R214②/R220/R226①/R227/R230/R231/R232/R233。
// 新增维（点名）：
//  A. **默认 updated 降序帧**首行三方同帧：knF 首行 == 屏上首行 == 行钮 0 串首段，且
//     夹具时间刻意打散（屏上序 ≠ 文件名字典序，防「首行=巧合」空转；R229 系分页帧、
//     R142 无三方首行）；
//  B. 叠加态（ktype×名筛）内**翻排序方向**：行集按 sorted-set 逐字不变、序逐字翻转、
//     导出名链跟随新序、urls 快照逐字（导出侧的行集不变性首次入锁）；
//  C. 叠加筛空→**清空恢复**：恢复后导出全文逐字==筛空前快照（字节级往返），叠加全程
//     零请求；true-0 对照帧 cap null 一行引用位。
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
const rowNames = () => rowNodes().map((r) => txt(r.querySelector('[data-testid="kn3-docs-name"]')));
const spaceBtns = () => document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length;
const dataLines = (text: string) => text.split("\n").slice(1, -1);
const firstNameOf = (line: string) => line.split(" | ")[0];
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
  const createObjectUrl = vi.fn();
  Object.defineProperty(window.URL, "createObjectURL", { value: createObjectUrl, configurable: true, writable: true });
  return { writeText, createObjectUrl };
};

// 时间刻意打散：updated 降序 [C,A,S,B,J] ≠ 文件名字典序 [A,B,C,J,S]（新增维 A 的反巧合哨兵）
const D = (id: string, fileName: string, mimeType: string, sizeBytes: number, hh: number, mm: number) => ({
  documentId: id, fileName, mimeType, sizeBytes, updatedAt: `2026-11-19T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`,
});
const ALL = [
  D("d_a", "甲手册.pdf", "pdf", 2048, 7, 0),
  D("d_b", "乙手册.pdf", "pdf", 4096, 6, 0),
  D("d_c", "丙手册.docx", "docx", 8192, 8, 0),
  D("d_j", "己记录.json", "json", 512, 5, 0),
  D("d_s", "戊表.csv", "csv", 1234567, 6, 30),
]; // updated desc: C,A,S,B,J
const SP = { asOf: "2026-11-19T09:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: ALL.length, status: "synced" }] };
const wire = (docs = ALL) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN || url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: docs });
    return fail(404, "这个数据接口还没有接入。", "rid-r235-x");
  });

describe("knowledge export order & filter guards (R235)", () => {
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

  it("① 默认 updated 降序帧：首行三方同帧（knF 首行==屏上首行==钮 0 串首段）+ 三值 [5,5,5]（新增维A；时间打散防首行巧合）", async () => {
    const { writeText, createObjectUrl } = clipStub();
    wire();
    await render(DETAIL);
    expect(rowNames()).toEqual(["丙手册.docx", "甲手册.pdf", "戊表.csv", "乙手册.pdf", "己记录.json"]); // 降序实测序（≠字典序哨兵）
    await clickNode(q("knF-copy"), "knF");
    const fLines = dataLines(String(writeText.mock.calls[0][0]));
    expect([rowNames().length, spaceBtns(), fLines.length]).toEqual([5, 5, 5]); // 三值
    await clickNode(document.querySelector('button[data-testid="kn-row-copy-space-0"]'), "row btn 0");
    const btnLine0 = String(writeText.mock.calls[1][0]).split("\n")[1];
    expect(firstNameOf(btnLine0)).toBe(rowNames()[0]); // 钮 0 归属首行（分面实名 -space-，R132 引用）
    expect(firstNameOf(fLines[0])).toBe(rowNames()[0]); // 三方同帧
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it("② ktype=PDF×名筛「手册」叠加：导出恰交集；翻排序方向行集 sorted-set 不变、序逐字翻转、导出跟随、urls 逐字（新增维B；q 面引 R234②不复写）", async () => {
    const { writeText, createObjectUrl } = clipStub();
    wire();
    await render(`${DETAIL}&ktype=${encodeURIComponent("PDF")}`);
    await typeIn("手册");
    expect(rowNames()).toEqual(["甲手册.pdf", "乙手册.pdf"]); // desc 叠加集（ktype∩名筛；source 无控件——换算声明）
    await clickNode(q("knF-copy"), "knF overlay");
    const textA = String(writeText.mock.calls[0][0]);
    expect(dataLines(textA).map(firstNameOf)).toEqual(["甲手册.pdf", "乙手册.pdf"]);
    const u0 = urls().join("|");
    // 翻 updated 方向（默认 desc→点列钮翻 asc）：行集不变、序翻转
    await clickNode(q("kn-sort-updated"), "flip direction");
    const namesB = rowNames();
    expect([...namesB].sort()).toEqual(["乙手册.pdf", "甲手册.pdf"].sort()); // sorted-set 逐字不变
    expect(namesB).toEqual(["乙手册.pdf", "甲手册.pdf"]); // 序逐字翻转
    writeText.mockClear();
    await clickNode(q("knF-copy"), "knF after flip");
    expect(dataLines(String(writeText.mock.calls[0][0])).map(firstNameOf)).toEqual(namesB); // 导出跟随新序
    expect(String(writeText.mock.calls[0][0])).not.toBe(textA); // 串确已变（防「无操作」空转）
    expect(urls().join("|")).toBe(u0); // 叠加+翻序全程零新请求（排序参不入线引 R164①:142）
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it("③ 叠加筛空→清空恢复字节级往返：恢复后导出全文逐字==筛空前 + 全程零请求；筛空帧 disabled+title（对照 true-0 帧 cap null 引 R231②）", async () => {
    const { writeText, createObjectUrl } = clipStub();
    wire();
    await render(`${DETAIL}&ktype=${encodeURIComponent("PDF")}`);
    await typeIn("手册");
    await clickNode(q("knF-copy"), "knF pre");
    const text0 = String(writeText.mock.calls[0][0]);
    const capMid = txt(q("kn3-page-cap")); // 筛中帧在场（实测整句见证据）
    const u0 = urls().join("|");
    // 筛空帧（ktype 在场，名筛清零）：**实测 cap=null**——与 true-0 同族（R108/R157/
    // R187/R231② 口径延伸到叠加筛空帧；更正 R234③ 回执：其双分支实走「缺席」支）
    await typeIn("火星不存在");
    const btn = q("knF-copy") as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(true);
    expect(btn?.getAttribute("title")).toContain("本地筛选没有留下行");
    expect(q("kn3-page-cap")).toBeNull(); // 现状按实入锁：筛空不渲染、无假 0
    expect(container.textContent ?? "").not.toMatch(/(^|[^0-9.])0\s*(条|篇|个)/);
    writeText.mockClear();
    await clickNode(btn, "click empty");
    expect(writeText).not.toHaveBeenCalled();
    // 清空恢复：导出全文**逐字**==筛空前快照（字节级往返，新增维C）；cap 复原逐字
    await typeIn("");
    expect(rowNames()).toEqual(["甲手册.pdf", "乙手册.pdf"]);
    expect(txt(q("kn3-page-cap"))).toBe(capMid); // 往返复原位
    await clickNode(q("knF-copy"), "knF restored");
    expect(String(writeText.mock.calls[0][0])).toBe(text0);
    expect(urls().join("|")).toBe(u0); // 筛空+恢复全程零新请求
    expect(createObjectUrl).not.toHaveBeenCalled();
    // true-0 对照帧（服务端空）：cap null 一行引用位（R231②:98-123 地盘，不重测门细节）
    wire([]);
    await render(DETAIL);
    expect(q("kn3-page-cap")).toBeNull();
  });
});
