// R220 — 导出命名/字符集缺席护栏（纯测试单：零产品改动，未造任何导出件）。
// 派工点名的三件产物**按现状缺口**逐条记录（本节同时抄入证据文档）：
//  (a) `a.download` 文件名词表——不存在：无 kn-export-name（grep 0）、无 download= 属性、
//      产品源码无任何导出文件名构造；
//  (b) `Blob.type` "text/csv;charset=utf-8"——不存在：产品从不 new Blob；
//  (c) BOM（\uFEFF）——不存在：没有导出字节流可言。
// 本文件把这些缺席锁成**变红即提醒**的不变量：若将来真落 CSV 导出，①②③ 的相关断言会
// 变红，逼作者回来对齐口径（R190 源码级不变量的行为面延伸）。
// 名实映射（R142/R190 先例）：「导出」= 真实复制器——详情面 knF-copy、检索面 knG-copy、
// 行钮 kn-row-copy-space-<i>/kn-row-copy-<i>；文本单点 DOC_LINE_HEADER/docLine/
// docSingleCopy；缺值表/复制「—」、预览/抽屉「该字段未返回」（两套口径不统一）；
// 时间 updatedText；导出标记仅 data-export="absent" ×4（诚实陈述，非假按钮）。
// 查重：R190①④（源码 createObjectURL/text/csv/download=/new Blob 零命中 + 空态 spy）、
// R214④（空态两面 disabled+title+零写）、R142/R207（复制零请求快照）→ 引用不重写；
// 新维=**Blob 构造 spy 全程 0 + 任何时刻无 a[download] 被挂进 DOM + absent 标记非交互
// （SPAN/aria-hidden/无 href）逐面锁**（R190 只锁源码文本，本文件锁行为面）。
// clipboard/Blob/createObjectURL 桩一律 Promise/安全替身（R214 教训，尾行 Errors 0）。
// @vitest-environment jsdom
import { readFileSync } from "node:fs";
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
const blobCtor = vi.fn();
beforeEach(() => {
  createObjectUrl.mockClear();
  blobCtor.mockClear();
  Object.defineProperty(window.URL, "createObjectURL", { value: createObjectUrl, configurable: true, writable: true });
  vi.stubGlobal("Blob", blobCtor); // 产品从不调用它；若调用计数立刻可见
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

const q = (testid: string) => document.querySelector(`[data-testid="${testid}"]`);
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  return writeText;
};

const A = { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "application/pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const M = { documentId: "d_m", fileName: "M 缺项档" }; // 类型/大小/更新全缺
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 2, status: "synced" }],
};
const wire = (docs: unknown[]) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN || url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP.asOf, documents: docs });
    return fail(404, "这个数据接口还没有接入。", "rid-r220");
  });
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

describe("knowledge export naming/charset absence guards (R220)", () => {
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

  it("① absence as invariant + the 4 data-export=absent markers are honest statements, not interactive controls", async () => {
    // 源码级缺席（R190 同法，补 a.download/new Blob 两形）：命名/字节流产物不存在
    const src = ["KnowledgeModulePage.tsx", "knowledge.ts", "copyGates.ts", "updated.ts"]
      .map((f) => readFileSync(`src/modules/knowledge/${f}`, "utf8"))
      .join("\n");
    expect(src).not.toContain("createObjectURL");
    expect(src).not.toMatch(/a\.download|\.download\s*=/);
    expect(src).not.toMatch(/new Blob\(/);
    expect(src).not.toContain("text/csv");
    expect(src).not.toContain("\uFEFF"); // 无 BOM 可言：没有导出字节流
    // DOM 级缺席：kn-export-name 在所有面 0 个
    wire([A, M]);
    await render(DETAIL); // 两面同屏帧
    expect(document.querySelectorAll('[data-testid="kn-export-name"]').length).toBe(0);
    expect(document.querySelectorAll("a[download]").length).toBe(0);
    // absent 标记逐面：是 aria-hidden 的 span 记号，不是 button/带 href 的 a
    for (const gateId of ["kn-gates-knF", "kn-gates-knG"]) {
      const marker = q(gateId);
      expect(marker, gateId).toBeTruthy();
      expect(marker?.getAttribute("data-export")).toBe("absent");
      expect(marker?.tagName).toBe("SPAN");
      expect(marker?.getAttribute("aria-hidden")).toBe("true");
      expect(marker?.querySelector("button, a[href]")).toBeNull(); // 不可交互：诚实陈述非假按钮
    }
  });

  it("② the nearest real artifacts are text-only copiers: Blob/createObjectURL/a[download] stay at ZERO across knF/knG/row-button copies, and clipboard receives the 「—」-calibrated text", async () => {
    const writeText = clipStub();
    wire([A, M]);
    await render(DETAIL);
    // 三类复制器各点一次：文本入剪贴板，字节流三件套零调用
    await click("knF-copy");
    const fText = String(writeText.mock.calls[0][0]);
    expect(fText.split("\n")[0]).toBe("文档名 | 类型 | 大小 | 更新 | 短码");
    expect(fText).toContain("M 缺项档 | — | — | — | DM"); // 缺值「—」口径进文本
    await click("knG-copy");
    expect(String(writeText.mock.calls[1][0]).split("\n")[0]).toBe("文档名 | 所属空间 | 类型 | 大小 | 更新 | 短码");
    const rowBtn = document.querySelector('button[data-testid^="kn-row-copy-space-"]') as HTMLElement;
    await act(async () => {
      rowBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {});
    expect(writeText).toHaveBeenCalledTimes(3);
    expect(createObjectUrl).not.toHaveBeenCalled(); // spy 全程 0
    expect(blobCtor).not.toHaveBeenCalled(); // Blob 构造 0
    expect(document.querySelectorAll("a[download]").length).toBe(0); // 无导出锚被挂进 DOM
  });

  it("③ copy costs zero requests (byte-equal snapshot) and the empty set keeps copiers disabled-honest with all byte-stream counters at zero", async () => {
    const writeText = clipStub();
    wire([A, M]);
    await render(DETAIL);
    const u0 = urls().slice().sort().join("|");
    await click("knF-copy");
    await click("knG-copy");
    expect(urls().slice().sort().join("|")).toBe(u0); // 本地复制零增量（引 R207/R142 口径的当帧复测）
    // 空集：两面 disabled + 逐字 title，点击不进剪贴板、不产字节流
    wire([]);
    await render(DETAIL);
    const fBtn = q("knF-copy") as HTMLButtonElement | null;
    const gBtn = q("knG-copy") as HTMLButtonElement | null;
    expect(fBtn?.disabled).toBe(true);
    expect(fBtn?.getAttribute("title")).toContain("没有可复制");
    expect(gBtn?.disabled).toBe(true);
    const c1 = urls().length;
    writeText.mockClear();
    await click("knF-copy");
    await click("knG-copy");
    expect(writeText).not.toHaveBeenCalled();
    expect(urls().length).toBe(c1);
    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(blobCtor).not.toHaveBeenCalled();
    expect(document.querySelectorAll("a[download]").length).toBe(0);
  });
});
