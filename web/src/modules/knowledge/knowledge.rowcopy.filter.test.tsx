// R208 — 行复制 × 筛选叠加护栏（纯测试单：零产品改动）。
// 名实映射（grep 复核，引用而非臆造）：
// · 无 ?source= 控件（source 只是空间行「来源」列标签）→ 叠加键 = ?ktype=（旧 type
//   只读兜底、清除双删——knowledge.ts/页面 :3359/:3479-3480）× 本地名筛
//   （kn3-docs-filter-input）× ?q=（只收敛命中面）；类型桶与本地名筛都活在**空间详情面**
//   → 本文件测的行钮族 = `kn-row-copy-space-<i>`（检索面 kn-row-copy-<i> 无这两类筛选，
//   R207/R169 已锁该面，不复跑）。
// 查重（锁过的引用不重写）：
// · ④空集/错误/ghost 下行钮 0 —— R138 knowledge.empty.test.tsx:213/:225 + R187
//   knowledge.space.error.test.tsx:149 已锁 → 引用不重跑；
// · ①id 连续 0..M-1（动线终态）—— R176 knowledge.space.filters.test.tsx:262-267 已锁 → 引用；
// · 排序重编 —— R132/R169（kn-row-copy 钮随可见序）已锁；
// · 清单复制（knF）元素级换代/零残留 —— R207 knowledge.export.filter.test.tsx (a) 已锁；
// · 单文档行钮==屏上==抽屉==kn-doc-copy 六路链 —— R204 knowledge.detail.parity.test.tsx ①；
// · 文本单点 docSingleCopy/docLine —— R71/R75/R114。
// 真缺口（本文件 1 例全腿覆盖）：行钮级**逐行文本链**——每步筛选态下「按可见行序逐个点
// 钮，所得文本第 1 列数组 == 屏上行名数组」逐元素 toEqual（R207 只走清单、R204 只走一行）；
// 叠加 ② 同一文档跨筛选态文本**不漂移**（且 == docSingleCopy(readSpaceDocuments) 直出）
// 与 ③ 换代后首钮文本 == 新集首行（旧首行文本缺席）。
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
import { docSingleCopy, readSpaceDocuments } from "./knowledge";

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
const spaceBtns = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')].sort(
    (a, b) => Number(a.getAttribute("data-testid")!.slice(-1)) - Number(b.getAttribute("data-testid")!.slice(-1)),
  );
/** 按可见行序逐个点击行钮，收每串第 1 列——逐行链。 */
async function perRowCol1(writes: ReturnType<typeof vi.fn>) {
  const out: string[] = [];
  for (let i = 0; i < spaceBtns().length; i++) {
    writes.mockClear();
    await act(async () => {
      spaceBtns()[i].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {});
    out.push(String(writes.mock.calls[0][0]).split("\n")[1].split(" | ")[0]);
  }
  return out;
}

const A = { documentId: "d_a", fileName: "A 人事手册.pdf", mimeType: "application/pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const B = { documentId: "d_b", fileName: "B 人事表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const C = { documentId: "d_c", fileName: "C 运维手册.pdf", mimeType: "application/pdf", sizeBytes: 512, updatedAt: "2026-11-19T05:00:00Z" };
const BODY = { asOf: "2026-11-19T08:00:00Z", documents: [A, B, C] };
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 3, status: "synced" }],
};
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN || url === docsUrlFor("sp_x")) return Promise.resolve(BODY);
    return fail(404, "这个数据接口还没有接入。", "rid-r208");
  });

describe("knowledge row-copy × filter stacking parity (R208, gap-only)", () => {
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

  it("row-button level chain under stacked filters: per-button text col1 == screen row names elementwise; same doc drifts zero across states and equals docSingleCopy; swapped head button equals the new set's first row", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire();
    const derived = readSpaceDocuments(BODY); // 直出对账锚（R71/R75 单点）
    const copyOf = (id: string) => docSingleCopy(derived.rows.find((r) => r.id === id)!);

    // 态 1：URL ktype=PDF（A、C）——逐行链 + id 连续（id 锁引 R176:262-267，此处序内复跑一遍在测态）
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x&ktype=PDF");
    const u0 = urls().slice().sort().join("|"); // 首屏既有读取之后的快照：之后所有动作必须零增量
    expect(rowNames()).toEqual(["A 人事手册.pdf", "C 运维手册.pdf"]);
    expect(await perRowCol1(writeText)).toEqual(rowNames()); // ① 逐行：钮序文本 == 屏上行名
    expect(spaceBtns().map((b) => b.getAttribute("data-testid"))).toEqual([
      "kn-row-copy-space-0",
      "kn-row-copy-space-1",
    ]);
    // ② A 的整串文本与 docSingleCopy 直出逐字等
    writeText.mockClear();
    await click("kn-row-copy-space-0");
    const aTextPdf = String(writeText.mock.calls[0][0]);
    expect(aTextPdf).toBe(copyOf("d_a"));

    // 态 2：清类型 + 本地名筛「人事」（A、B）——A 跨态文本零漂移（索引位置也仍在 0）
    await click("kn-type-all");
    await type("kn3-docs-filter-input", "人事");
    expect(rowNames()).toEqual(["A 人事手册.pdf", "B 人事表.xlsx"]);
    expect(await perRowCol1(writeText)).toEqual(rowNames());
    writeText.mockClear();
    await click("kn-row-copy-space-0");
    expect(String(writeText.mock.calls[0][0])).toBe(aTextPdf); // ② 字段不随筛选漂移

    // 态 3：切到「表格」桶（仅 B）——③ 首钮文本==新集首行；A 的首行文本缺席换代
    await click("kn-type-2"); // [全部→all, 表格=…按 combined 首现序：PDF 清筛后桶序变，2=表格 实测步]
    const names3 = rowNames();
    if (names3.length === 0) await click("kn-type-1"); // 桶 index 随桶序移动：兜底换一位再验
    expect(rowNames()).toEqual(["B 人事表.xlsx"]);
    writeText.mockClear();
    await click("kn-row-copy-space-0");
    const bText = String(writeText.mock.calls[0][0]);
    expect(bText.split("\n")[1].split(" | ")[0]).toBe("B 人事表.xlsx");
    expect(bText).toBe(copyOf("d_b")); // 与直出等
    expect(bText).not.toBe(aTextPdf); // 旧首行文本不再等于首钮文本（换代缺席验证）
    // 全程本地筛选/复制零请求：态 1 首屏之后快照逐字不变（首屏自身读取次数如实，不锁数）
    expect(urls().slice().sort().join("|")).toBe(u0);
  });
});
