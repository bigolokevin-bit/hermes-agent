// R209 — 导出 × 行复制**全行直对**护栏（纯测试单：零产品改动）。
// 名实映射（调度方确认 + 本文件跑前 grep 复核）：
// · 模块无真 CSV 导出（createObjectURL/text/csv/download= 0 命中、data-export="absent"
//   4 处、R190 源码级不变量在位）→「导出」= knF 列表复制器数据行；禁止造控件。
// · 无 ?source= 控件（source 仅空间行「来源」列标签）→ 叠加键 = ?ktype=（旧 type 兜底）
//   × 本地名筛 × ?q=。
// · 类型桶与名筛活在**空间详情面** → 本文件行钮族 = kn-row-copy-space-<i>；
//   kn-doc-copy 是单控件非行数（R114/R204 已锁其链）。
// · 因此派工 ③「导出空字段 vs 复制『—』」**名实不成立**：两产物同一实现（docLine），
//   缺值两处都是「—」——不存在可分别观测的两套口径。本文件按产品现状断言单一实现，
//   并把该差异写进证据/回执；缺值行顺带做**全行级**互等直对。
// 查重（锁过的引用不重写，行号 grep 核对）：
// · R207(a) knowledge.export.filter.test.tsx —— 叠加切换后 knF 数据行第 1 列集合逐元素
//   == 屏上行名 + 旧行零残留 + 三值链 + urls 快照不变；
// · R208 knowledge.rowcopy.filter.test.tsx —— 行钮级逐行 col1 链 + 跨态零漂移
//   == docSingleCopy 直出 + 换代首钮缺席；
// · R200①② export.columns —— 表头差集对账 + 逐单元格；R190③④ export.escape —— 缺值
//   两处逐字 + 空集 disabled/title/writeText 0/createObjectURL spy 0；R142② 三值筛选降数；
// · R169/R132 —— 行钮编号 0..N-1 连续与排序重编。
// 真缺口（本文件 1 例）：**两个产物之间的全行直对**——行钮 i 串的 data 行（整行，不止
// 第 1 列）与 knF 数据行 i **整行 toBe**（此前只各自对屏上过、传递闭包从未直接落钉），
// 覆盖首/中/末三行 + 末行为缺值行（「—」全行级互等）；叠加 ktype 态再走一遍短链。
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

const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const rowNames = () =>
  [...document.querySelectorAll('[data-testid="kn3-docs-row"] [data-testid="kn3-docs-name"]')].map((n) =>
    (n.textContent ?? "").replace(/\s+/g, " ").trim(),
  );
/** 取一个产物的数据行数组：knF 用列表；行钮用单行串的第 2 行。 */
async function knfLines(writes: ReturnType<typeof vi.fn>) {
  writes.mockClear();
  await click("knF-copy");
  return String(writes.mock.calls[0][0]).split("\n").slice(1, -1);
}
async function rowBtnLine(i: number, writes: ReturnType<typeof vi.fn>) {
  writes.mockClear();
  await click(`kn-row-copy-space-${i}`);
  return String(writes.mock.calls[0][0]).split("\n")[1];
}

const A = { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "application/pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const B = { documentId: "d_b", fileName: "B 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const M = { documentId: "d_m", fileName: "M 缺项档" }; // 缺值末行（updated/desc 下缺时垫底）
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 3, status: "synced" }],
};
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN || url === docsUrlFor("sp_x"))
      return Promise.resolve({ asOf: SP.asOf, documents: [A, B, M] });
    return fail(404, "这个数据接口还没有接入。", "rid-r209");
  });

describe("knowledge export × row-copy whole-line direct parity (R209, gap-only)", () => {
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

  it("whole data LINE direct match: row-button line i toBe knF data line i for first/middle/last (last = missing-value line, 「—」 on both by the same single derivation), and again under a stacked ktype state; zero churn throughout", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire();
    await render("/knowledge?tab=spaces&panel=spaces&space=sp_x");
    const u0 = urls().slice().sort().join("|");
    expect(rowNames()).toEqual(["A 手册.pdf", "B 表.xlsx", "M 缺项档"]); // 首/中/末
    const lines = await knfLines(writeText);
    expect(lines).toHaveLength(3);
    // 全行直对（首/中/末三行）：行钮整串 data 行 == knF 数据行（整行 toBe，非仅第 1 列）
    for (const i of [0, 1, 2]) {
      const one = await rowBtnLine(i, writeText);
      expect(one, `line ${i}`).toBe(lines[i]);
      expect(one.split(" | ")[0], `col1 ${i}`).toBe(rowNames()[i]); // 与屏上三点穿成一条直接链
    }
    // 末行 = 缺值行：两产物同一实现都是全「—」三列（③名实差异按现状断言——不存在
    // 「导出空字段」第二口径）；无 undefined/null/空字段
    expect(lines[2]).toBe("M 缺项档 | — | — | — | DM");
    expect(lines[2]).not.toMatch(/undefined|null|\|\s+\|/);
    // 叠加态复走短链：ktype=PDF → 只剩首行 A；两产物全行仍直对
    await click("kn-type-1"); // 桶序 [全部→all, PDF=1, 表格=2]
    expect(rowNames()).toEqual(["A 手册.pdf"]);
    const pdfLines = await knfLines(writeText);
    expect(pdfLines).toHaveLength(1);
    expect(await rowBtnLine(0, writeText)).toBe(pdfLines[0]);
    // 三值（引 R207 口径的当态复跑）：行 == 钮 == knF 行
    expect([rowNames().length, document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length, pdfLines.length]).toEqual([1, 1, 1]);
    // 全程零请求 + blob-URL 0 调用（④口径引 R190④：空态 disabled+title 已锁，本例只守
    // 「动作不新增请求、不碰 blob」两件事）
    expect(urls().slice().sort().join("|")).toBe(u0);
    expect(createObjectUrl).not.toHaveBeenCalled();
  });
});
