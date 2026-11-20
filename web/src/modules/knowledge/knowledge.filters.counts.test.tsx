// R218 — 类型/来源筛选 × 计数同源护栏（纯测试单：零产品改动，未造控件）。
// 名实换算（按派工四点实测口径，全部落进断言）：
// · ?source= 不存在（source 只是空间行「来源」列标签）→「类型×来源」叠加映射为
//   ?ktype=（旧 type 只读兜底、清除双删）× ?q= × 本地名筛的真实叠加。
// · 计数锚分面不可互换：**检索面** = kn9-count-docs（HitCount）+ kn-row-copy-<i>；
//   **空间详情面** = kn3-page-cap（50 常量位/「已加载 M 篇」可变位）+ kn-row-copy-space-<i>。
// · 「清空 type 恰 1 次取数」名实不符：筛选全本地（读口不吃 q/sort/ktype）——实测 0 次
//   新请求，按 0 断言（urls 快照逐字 + 无 cursor=），不制造请求。
// · 「切 source 时 type chip 不动」改测：切桶只动 ktype、其余 URL 参逐字（R118② 锁过，
//   本文件当态复跑）；非法枚举两路地址逐字不改写、空态不显裸 0、cap 不渲染（引 R108/R157）。
// 查重与新增维（不声称全部新发现）：
// · 已锁引用：R169①（检索面未筛态 count 文本==行==钮==knG 行四值）、R157③④（非法 loc/
//   cap null）、R197①（详情面翻页五读）、R146①（清除双删）、R118②（只动 ktype 余参逐字）、
//   R142②（三值降数复原）、R138①（无裸 0）、R214④（空态 disabled+spy）。
// · 新增维：① 检索面**命中态**三值链——从 HitCount 文案抽出「命中 M 项」的 M 与 data-len/
//   钮数/可见行 toBe（此前只锁过未筛态与文案子串）+ no-match 态三值同 0；
//   ② 详情面 **ktype 深链态**（非点击态）同帧五值 + cap 整句逐字（R197 是翻页态）；
//   ③ 清桶动线**当帧**五值复原 + 钮重编号 0..N-1；④ 非法枚举态 title 完整句与
//   「筛后空」分支同源复跑。
// 铁律：clipboard 桩返回 Promise（R214 教训，尾行 Errors 0）；导出族不存在；
// kn-doc-copy 单控件非行数；缺值「—」；时间 updatedText；短码尾段大写、全 id 仅 title。
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

async function typeInput(testid: string, value: string) {
  const node = document.querySelector(`[data-testid="${testid}"]`) as HTMLInputElement | null;
  expect(node, testid).toBeTruthy();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(node, value);
    node?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {});
}

const q = (testid: string) => document.querySelector(`[data-testid="${testid}"]`);
const txt = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const loc = () => (q("loc")?.textContent ?? "") as string;
const params = () => new URLSearchParams(loc());
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const spaceBtnIds = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')]
    .map((b) => Number((b.getAttribute("data-testid") ?? "").replace(/\D/g, "")))
    .sort((a, b) => a - b);
const hitBtnCount = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-"]')].filter(
    (b) => !(b.getAttribute("data-testid") ?? "").includes("-space-"),
  ).length;
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  return writeText;
};

const A = { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "application/pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const B = { documentId: "d_b", fileName: "B 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const C = { documentId: "d_c", fileName: "C 运维手册.pdf", mimeType: "application/pdf", sizeBytes: 512, updatedAt: "2026-11-19T05:00:00Z" };
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 3, status: "synced" }],
};
const wire = (docs: unknown[]) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN || url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP.asOf, documents: docs });
    return fail(404, "这个数据接口还没有接入。", "rid-r218");
  });
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

describe("knowledge filter counts same-source guards (R218)", () => {
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

  it("① 检索面命中态三值链：HitCount 抽出的命中数 == data-len == 可见行 == 命中钮数；no-match 三值同 0 且文案可读不显裸 0", async () => {
    wire([A, B, C]);
    await render("/knowledge?tab=spaces");
    await typeInput("kn6-search-input", "手册"); // q 命中 A、C
    const countText = txt(q("kn9-count-docs"));
    expect(countText).toContain("当前已加载 3 项内命中 2 项");
    const hitNum = Number(countText.match(/命中 (\d+) 项/)?.[1] ?? -1);
    const visible = document.querySelectorAll('[data-testid="kn6-search-row"]').length;
    expect(hitNum).toBe(visible);
    expect(hitNum).toBe(Number(q("kn6-search")?.getAttribute("data-len")));
    expect(hitNum).toBe(hitBtnCount());
    // no-match 态：三值同 0、可读句、禁裸「0 项/0 条/0 篇」
    await typeInput("kn6-search-input", "查无此名");
    expect(txt(q("kn9-count-docs"))).toContain("命中 0 项");
    expect(document.querySelectorAll('[data-testid="kn6-search-row"]').length).toBe(0);
    expect(Number(q("kn6-search")?.getAttribute("data-len"))).toBe(0);
    expect(hitBtnCount()).toBe(0);
    expect(txt(q("kn6-search-empty"))).toContain("没有匹配的文档");
    expect(container.textContent ?? "").not.toMatch(/(^|[^0-9.])0\s*(条|篇)/); // 空集句不显裸 0 计数
    // 全程本地：零新请求
    expect(urls().filter((u) => u === DOCUMENTS_PLAIN)).toHaveLength(1);
  });

  it("② 详情面 ktype 深链态同帧五值：data-len == 可见行 == space 钮 == knF 数据行 == cap 句「已加载 M 篇」（整句逐字，-more 不在场）", async () => {
    const writeText = clipStub();
    wire([A, B, C]);
    await render(`${DETAIL}&ktype=PDF`); // 深链态（非点击态；点击态 R142/R157 已锁）
    expect(spaceBtnIds()).toEqual([0, 1]); // 命中 A、C → 重编号连续
    const rows = document.querySelectorAll('[data-testid="kn3-docs-row"]').length;
    expect(rows).toBe(2);
    expect(q("kn3-docs")?.getAttribute("data-len")).toBe("2");
    expect(txt(q("kn3-page-cap"))).toBe("本页最多显示 50 篇（当前已加载 2 篇；复制清单也只含这些篇）");
    expect(q("kn3-page-cap-more")).toBeNull();
    await click("knF-copy");
    expect(String(writeText.mock.calls[0][0]).split("\n").length - 2).toBe(rows);
    expect(urls().slice().sort().join("|")).toBe([SPACES, DOCUMENTS_PLAIN, docsUrlFor("sp_x")].sort().join("|"));
  });

  it("③ 清桶动线实测零新请求（派工「恰 1 次」不成立）：快照逐字 + 无 cursor + URL 只剩非类型键 + 五值当帧复原、钮重编号", async () => {
    const writeText = clipStub();
    wire([A, B, C]);
    await render(`${DETAIL}&q=%E6%89%8B%E5%86%8C&ksort=updated&kdir=desc&ktype=PDF`);
    const c0 = urls().length;
    await click("kn-type-all"); // 清除 ktype
    expect(urls().length).toBe(c0); // 实测 0 次新取数（读口不吃 ktype）
    expect(urls().some((u) => u.includes("cursor="))).toBe(false); // cursor 从不落 URL
    const p = params();
    expect(p.has("ktype")).toBe(false);
    expect(p.has("type")).toBe(false);
    expect(p.get("q")).toBe("手册"); // 其余 URL 参逐字（引 R118② 口径的当态复跑）
    expect(p.get("ksort")).toBe("updated");
    expect(p.get("kdir")).toBe("desc");
    expect(p.get("space")).toBe("sp_x");
    // 五值当帧复原到全量 + 钮重编号连续
    const rows = document.querySelectorAll('[data-testid="kn3-docs-row"]').length;
    expect(rows).toBe(3);
    expect(spaceBtnIds()).toEqual([0, 1, 2]);
    expect(q("kn3-docs")?.getAttribute("data-len")).toBe("3");
    expect(txt(q("kn3-page-cap"))).toContain("当前已加载 3 篇");
    await click("knF-copy");
    expect(String(writeText.mock.calls[0][0]).split("\n").length - 2).toBe(3);
  });

  it("④ 非法枚举两路：地址逐字不改写、kn-type-empty 可读且无裸 0、cap 不渲染、knF disabled 完整句 + 点击零写 + createObjectURL 全程 0", async () => {
    const writeText = clipStub();
    wire([A, B, C]);
    for (const key of ["ktype", "type"]) {
      const url = `${DETAIL}&${key}=__nope__`;
      await render(url);
      expect(loc()).toBe(`?tab=spaces&panel=spaces&space=sp_x&${key}=__nope__`);
      const emptyLine = txt(q("kn-type-empty"));
      expect(emptyLine).toContain("该类型下没有文档");
      expect(emptyLine).toContain("__nope__"); // 点名地址里那个值，不吞不猜
      expect(container.textContent ?? "").not.toMatch(/(^|[^0-9.])0\s*(条|篇)/);
      expect(q("kn3-page-cap")).toBeNull(); // 空态不渲染（R108/R157 口径的当帧复证）
      const btn = q("knF-copy") as HTMLButtonElement | null;
      expect(btn?.disabled).toBe(true);
      expect(btn?.getAttribute("title")).toContain("没有可复制"); // 完整句引 R138②
      const c0 = urls().length;
      await click("knF-copy");
      expect(writeText).not.toHaveBeenCalled();
      expect(urls().length).toBe(c0);
    }
    expect(createObjectUrl).not.toHaveBeenCalled(); // 导出族不存在的行为面（引 R190 不变量）
  });
});
