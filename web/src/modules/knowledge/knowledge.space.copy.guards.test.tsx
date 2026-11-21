// R265 — 空间列表「复制清单」面（knI）首次覆核：内容与行数同源 × ?q= 换代零请求 × 无命中门（纯测试单·零产品改动）。
// 选题依据（派工已核）：`knI-*` 四锚在产品实存（:1316-1346）而全模块测试零引用
// （knowledge.counts.parity.test.tsx:224 注释「knI 面不在本轮范围」）——整面从未覆核。
// 名实（产品定版，断言即现实，禁造控件）：
// · 复制文本**单点** `spaceCopyText(rows, loadedTotal, keyword)`（knowledge.ts:1717，
//   调用点 :1196 实参 `(shown, loaded.length, text)`——测试按此口径构造期望/校准行，
//   禁第二套格式）；行=空间名|文档数|最近更新|短码（SPACE_COPY_HEADER knowledge.ts:1715），
//   首行=「当前已加载 N 个空间；本清单只覆盖这份回答，不冒充全库。」，`?q=` 非空时
//   另有「以下为检索词「kw」筛后的可见行。」句——逐字按产品原文断言。
// · 空间面筛选**只有 ?q=**（kn8-global-input 本地过滤，零新请求——R215③ 同族口径）；
//   **无 ?source=**；?ktype= 属详情面不涉本题；kn8-global-clear 只清输入不回写 URL
//   （R259 C 实测同族）——本文件按实测断言，不假设 URL 被改写。
// · 空间面**无 kn3-page-cap**（详情面专属；本题校准句走清单首行，按实断言）；
// · 无真 CSV（源级 createObjectURL/text/csv/a.download/new Blob 0、absent ×4——
//   R190①:113-119）→ 只测 knI-copy，**createObjectURL spy 全程 0**；
// · 门句单点 copyGates knI（:114-119）：enabledTitle 尾句「屏上数据，不会再发请求。」、
//   zeroTitle「当前没有可复制的空间」、copied `已复制 N 行`；
// · 缺值「—」；短码=大写人尾段（shortId），**全 id 不上屏也不入复制文本**（负断言）；
// · 行钮分面/两式缺值/kn-doc-copy 非行数——本面不涉，纪律沿用；
// · clipboard 桩 `vi.fn().mockResolvedValue(undefined)` + afterEach unstubAllGlobals
//   （R214，Errors 0 硬要求）。
// 【查重（file:line）】R255 B/§、R259 C（kn8-global-clear 同族 URL 实态——本文件不重复
//   清除钮位）；R215③（本地筛选零请求口径引用）；knI 面本体（内容/行数同源、?q= 换代、
//   无命中门）——**全模块零覆盖，三例皆新**（首覆核轮，非重复断言）。
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
import { SPACE_COPY_HEADER } from "./knowledge";

const SPACES = "/agent-api/api/knowledge/spaces?limit=20";

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
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const spaceRows = () => [...document.querySelectorAll('[data-testid="knw5-spaces-row"]')];
const nameCell = (r: Element) => r.querySelector('[data-testid="kn-space-open"]') ?? r.querySelector('[data-testid="knw5-space-name"]');
const spaceNames = () => spaceRows().map((r) => txt(nameCell(r)));
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.URL, "createObjectURL", { value: vi.fn(), configurable: true, writable: true });
  return writeText;
};
const typeQ = async (value: string) => {
  const box = q("kn8-global-input") as HTMLInputElement | null;
  expect(box, "kn8-global-input").toBeTruthy();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(box, value);
    box?.dispatchEvent(new Event("input", { bubbles: true }));
    box?.closest("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await act(async () => {});
};

const SP_OK_A = { spaceId: "sp_alpha", name: "阿尔法空间", docCount: 5, status: "synced", updatedAt: "2026-11-19T07:00:00Z", source: "upload" };
const SP_OK_B = { spaceId: "sp_beta", name: "贝塔空间", docCount: 12, status: "synced", updatedAt: "2026-11-19T06:00:00Z", source: "sync" };
const SP_MISS = { spaceId: "sp_gamma", name: "伽马缺值空间" }; // 无 docCount/status/updatedAt → 缺值「—」行
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", items: [SP_OK_A, SP_OK_B, SP_MISS] });
    return fail(404, "这个数据接口还没有接入。", "rid-r265-x");
  });

describe("knowledge space-list copy (knI) guards (R265)", () => {
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

  it("① 内容与行数同源：knI 投递 4 行结构（校准首行==「当前已加载 3 个空间；…」原文 + 表头 == SPACE_COPY_HEADER）；逐行第 1 列==屏上行名 toEqual；缺值行文档列「—」；短码列==去 sp_ 大写尾段、全文无裸 sp_", async () => {
    const writeText = clipStub();
    wire();
    await render("/knowledge?tab=spaces");
    await clickNode(q("knI-copy"), "knI copy");
    const lines = String(writeText.mock.calls[0][0]).trim().split("\n");
    expect(lines[0]).toBe("当前已加载 3 个空间；本清单只覆盖这份回答，不冒充全库。"); // 校准行按产品原文（禁臆造——spaceCopyText :1719）
    expect(lines[1]).toBe(SPACE_COPY_HEADER.join(" | ")); // 表头单源（R200② 同族，空间面首锁）
    const hIdx = lines.indexOf(SPACE_COPY_HEADER.join(" | "));
    expect(hIdx).toBeGreaterThan(0);
    const rowLines = lines.slice(hIdx + 1);
    expect(rowLines).toHaveLength(spaceNames().length); // 行数==屏上可见空间行
    expect(rowLines.map((l) => l.split(" | ")[0])).toEqual(spaceNames()); // 逐行第 1 列==屏上名逐位
    const gamma = rowLines.find((l) => l.startsWith("伽马缺值空间"))!;
    expect(gamma.split(" | ")[1]).toBe("—"); // 缺值文档数列「—」（两式禁统一：本面是复制行式）
    for (const l of rowLines) {
      const code = l.split(" | ")[3];
      expect(code).toMatch(/^[A-Z0-9]+$/); // 大写人尾段形制
      const row = spaceRows().find((r) => txt(nameCell(r)) === l.split(" | ")[0]);
      expect(code).toBe((row?.getAttribute("title") ?? "").replace(/_/g, "").toUpperCase()); // 实测：shortId=全 id 去下划线大写（sp_alpha→SPALPHA），全 id（带 sp_）只在 title
    }
    const all = writeText.mock.calls.map((c) => String(c[0])).join("\n") + loc() + txt(container);
    expect(all).not.toContain("sp_"); // 裸 id/前缀不上屏不入串（负断言）
    expect(txt(q("knI-copy-status"))).toBe("已复制 3 行"); // copyGates copied(n) 单源句（:116）
  });

  it("② ?q= 换代元素级且零请求：筛「贝塔」→ 清单数据行集合==屏上、旧行零残留（阿尔法/伽马 not.toContain）；urls join 逐字==筛前（零新请求，R215③ 口径）；清空 → 清单与行数复原", async () => {
    const writeText = clipStub();
    wire();
    await render("/knowledge?tab=spaces");
    const u0 = urls().join("|");
    await typeQ("贝塔");
    expect(spaceNames()).toEqual(["贝塔空间"]);
    await clickNode(q("knI-copy"), "knI filtered");
    const filtered = String(writeText.mock.calls[0][0]);
    const fLines = filtered.trim().split("\n");
    expect(fLines[1]).toBe("以下为检索词「贝塔」筛后的可见行。"); // 检索句按产品原文（spaceCopyText :1720）
    const fhIdx = fLines.indexOf(SPACE_COPY_HEADER.join(" | "));
    expect(fLines[2]).toBe(SPACE_COPY_HEADER.join(" | ")); // 检索句插位后表头下移一行（行区起点动态定位）
    const rows = fLines.slice(fhIdx + 1);
    expect(rows.map((l) => l.split(" | ")[0])).toEqual(spaceNames()); // 集合逐元素==屏上
    expect(rows).toHaveLength(1);
    expect(filtered).not.toContain("阿尔法空间"); // 旧行零残留
    expect(filtered).not.toContain("伽马缺值空间");
    expect(urls().join("|")).toBe(u0); // 键入+提交+复制零新请求
    expect(txt(q("knI-lines"))).toContain("1"); // 计数位随筛（读 kniGates.lines 单点）
    await typeQ("");
    expect(spaceNames()).toHaveLength(3);
    writeText.mockClear();
    await clickNode(q("knI-copy"), "knI restored");
    const back = String(writeText.mock.calls[0][0]).trim().split("\n");
    expect(back.slice(back.indexOf(SPACE_COPY_HEADER.join(" | ")) + 1)).toHaveLength(3); // 复原全量
    expect(back[0]).toBe("当前已加载 3 个空间；本清单只覆盖这份回答，不冒充全库。"); // 校准行不变
    expect(urls().join("|")).toBe(u0); // 全程零请求
  });

  it("③ 无命中门：q=不存在 → knI-copy disabled===true 且 title 逐字「当前没有可复制的空间」（copyGates :117 实测原文）；点击 writeText 0 调用、urls 不变、blob spy 0；有命中对照 disabled===false", async () => {
    const writeText = clipStub();
    wire();
    await render("/knowledge?tab=spaces");
    const btn = q("knI-copy") as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(false); // 有命中对照位
    await typeQ("火星不存在");
    expect(spaceNames()).toHaveLength(0);
    const f = q("knI-copy") as HTMLButtonElement | null;
    expect(f?.disabled).toBe(true);
    expect(f?.getAttribute("title")).toBe("当前没有可复制的空间"); // 实测锁定原文（回执同步记录）
    expect(txt(q("knI-lines"))).toBe("—"); // 计数位空帧「—」
    expect(q("kn3-page-cap")).toBeNull(); // 空间面无 cap（不存在该锚——非 0 断言）
    const c0 = urls().length;
    await clickNode(f, "click gated knI");
    expect(writeText).not.toHaveBeenCalled(); // 零写
    expect(urls().length).toBe(c0); // 零请求
    const spy = window.URL.createObjectURL as unknown as ReturnType<typeof vi.fn>;
    expect(spy).not.toHaveBeenCalled(); // 无 blob（R190① 不变量）
    expect(q("knI-copy-fallback")).toBeNull(); // 未点不弹兜底（兜底环属拒绝腿他域）
  });
});
