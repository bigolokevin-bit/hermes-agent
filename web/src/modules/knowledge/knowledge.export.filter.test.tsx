// R207 — 导出 × 筛选叠加护栏（纯测试单：零产品改动，未造导出控件）。
// 现实映射（按实测，写进证据）：模块无真 CSV——createObjectURL/text/csv/download= 皆 0、
// 仅 data-export="absent"（R190 已锁不变量）→「导出」= knF-copy 数据行（详情面，
// docCopyText→docLine，5 列）；「?source=」无控件（source 只是空间行列标签）→ 叠加键
// 用 ?ktype=（旧 type 只读兜底）× 本地名筛（kn3-docs-filter-input，不落 URL）× ?q=
// （只收敛命中面）；请求参集合恰 {limit,spaceId} 已由 R164① 锁 → 引用不重跑。
// 查重（锁过的引用不重写）：
// · ①三值计数随筛选降/复原 —— R142②（space.export.test.tsx:164-176）已锁；
//   ②首行换代（lines[1] 含新行）—— R142② 同段已锁；导出零请求 —— R142⑤/R164①；
//   ④缺值两处同「—」不串口径 —— R200②（export.columns：表/copy 两侧逐字 + 无
//   undefined/null/空字段）已锁 → 引用；⑤空集 disabled+title+零写+零请求+spy 0 ——
//   R190④ 已锁；「cap 仍在」名实不符（空集/error/denied/非法枚举不渲染）—— R108/R157
//   已按产品锁为 **不渲染** → 引用（本文件不重跑，回执记差异）。
// 真缺口（本文件 2 例）：
// (a) 叠加切换后复制内容**元素级换代**：knF 数据行第 1 列集合 == 屏上可见行名集合
//     （逐元素 toEqual），且切换前那行**零残留**（R142② 只锁计数与首行包含）；
// (b) **旧 type 兜底键**态的三值链（kn-row-copy-space-<i> 族）：R146① 只锁桶回填，
//     该键态下钮数==行数==复制行未走。
// 面/族：主测在空间详情（kn3-docs-*），行钮族 kn-row-copy-space-<i>；`kn-row-copy-<i>`
// 属检索面（不在本文件）；`kn-doc-copy` 单控件不作行数（R114/R125 已锁其链）。
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

const createObjectUrl = vi.fn();
beforeEach(() => {
  createObjectUrl.mockClear();
  Object.defineProperty(window.URL, "createObjectURL", { value: createObjectUrl, configurable: true, writable: true });
});

const SPACES = "/agent-api/api/knowledge/spaces?limit=20";
const DOCUMENTS_PLAIN = "/agent-api/api/documents?limit=50";
const docsUrlFor = (id: string) => `/agent-api/api/documents?limit=50&spaceId=${id}`;

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

async function click(testid: string) {
  const node = document.querySelector(`[data-testid="${testid}"]`) as HTMLElement | null;
  expect(node, testid).toBeTruthy();
  await act(async () => {
    node?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {});
}

async function type(testid: string, value: string) {
  const node = document.querySelector(`[data-testid="${testid}"]`) as HTMLInputElement | null;
  expect(node, testid).toBeTruthy();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(node, value);
    node?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {});
}

const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const rowNames = () =>
  [...document.querySelectorAll('[data-testid="kn3-docs-row"] [data-testid="kn3-docs-name"]')].map((n) =>
    (n.textContent ?? "").replace(/\s+/g, " ").trim(),
  );
const spaceBtnCount = () => document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length;
/** 复制数据行第 1 列集合（表头与尾换行剥掉）。 */
async function copyCol1(writes: ReturnType<typeof vi.fn>) {
  writes.mockClear();
  await click("knF-copy");
  return String(writes.mock.calls[0][0]).split("\n").slice(1, -1).map((l) => l.split(" | ")[0]);
}

const A = { documentId: "d_a", fileName: "A 人事手册.pdf", mimeType: "application/pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const B = { documentId: "d_b", fileName: "B 人事表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const C = { documentId: "d_c", fileName: "C 运维手册.pdf", mimeType: "application/pdf", sizeBytes: 512, updatedAt: "2026-11-19T05:00:00Z" };
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 3, status: "synced" }],
};
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [A, B, C] });
    if (url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP.asOf, documents: [A, B, C] });
    return fail(404, "这个数据接口还没有接入。", "rid-r207");
  });

describe("knowledge export × filter stacking guards (R207, gap-only)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("(a) stacking switches re-generate the copy content element by element: 数据行集合==屏上行名集合、旧行零残留、每步三值与请求快照同步", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire();
    // 步 1：URL ktype=PDF（A、C）
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x&ktype=PDF");
    const u0 = urls().slice().sort().join("|"); // 首屏既有读取之后的快照
    expect(rowNames()).toEqual(["A 人事手册.pdf", "C 运维手册.pdf"]);
    expect(await copyCol1(writeText)).toEqual(rowNames()); // 元素级：集合逐项等且同序
    expect(spaceBtnCount()).toBe(2);
    // 步 2：叠加本地名筛「人事」→ 只剩 A；复制换代且 B/C 零残留
    await type("kn3-docs-filter-input", "人事");
    expect(rowNames()).toEqual(["A 人事手册.pdf"]);
    const col1 = await copyCol1(writeText);
    expect(col1).toEqual(["A 人事手册.pdf"]);
    expect(col1.join("\n")).not.toContain("C 运维手册.pdf"); // 残留验证（元素级，R142② 只锁计数+首行）
    expect(col1.join("\n")).not.toContain("B 人事表.xlsx");
    // 步 3：切桶到「表格」（d_2 落进 kn-type 族）→ 复制再换代、A 零残留
    await type("kn3-docs-filter-input", "");
    await click("kn-type-2"); // 桶序 [全部→kn-type-all, PDF=1, 表格=2]
    expect(rowNames()).toEqual(["B 人事表.xlsx"]);
    const col2 = await copyCol1(writeText);
    expect(col2).toEqual(["B 人事表.xlsx"]);
    expect(col2.join("\n")).not.toContain("人事手册");
    // 三值链在每一步都成立（步 3 终态完整测一次）：行==钮==复制行
    expect([rowNames().length, spaceBtnCount(), col2.length]).toEqual([1, 1, 1]);
    // 全程本地筛选/复制零请求（首屏读取后快照逐字不变；请求参集合口径引 R164①）
    expect(urls().slice().sort().join("|")).toBe(u0);
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it("(b) legacy ?type= fallback state carries the same three-value chain (buttons == rows == copy lines), 「—」 wording untouched", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire();
    // 旧键单飞：type=表格（无 ktype）→ 兜底读生效、桶按下（回填由 R146① 锁，此处补三值链）
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x&type=%E8%A1%A8%E6%A0%BC");
    const btn = [...document.querySelectorAll('[data-testid="kn-type-row"] button')].find(
      (b) => (b.childNodes[0]?.textContent ?? "").trim() === "表格",
    );
    expect(btn?.getAttribute("aria-pressed")).toBe("true");
    const names = rowNames();
    expect(names).toEqual(["B 人事表.xlsx"]);
    expect(spaceBtnCount()).toBe(names.length); // 值=1：钮数
    expect((await copyCol1(writeText)).length).toBe(names.length); // 复制行数
    // 缺值口径不串（引 R200② 的两侧「—」——此处旧键态复证一次在场性）：
    expect(String(writeText.mock.calls[0][0])).toContain("B 人事表.xlsx | 表格"); // 类型人话列在场
    expect(String(writeText.mock.calls[0][0])).not.toMatch(/undefined|null/);
    expect(createObjectUrl).not.toHaveBeenCalled();
  });
});
