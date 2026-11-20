// R157 — 空间详情 搜索×类型 组合护栏（纯测试单：零产品改动）。
// 查重判定（先 git grep，锁过的引用不重写）：
// · ①「键入零新请求 + 可见行/data-len 随 q 收敛」——knowledge.filters.test.tsx ⑤（R118：
//   名筛三跳+排序双点 urls 逐字不变）与 ①（:137-139 q=人事 → kn6-search data-len "1"）已锁；
//   「本面无服务端关键词过滤」由文档读口口径（DOCUMENTS_URL 注释）与 R118 共同锁 → 引用。
// · ②「ktype×q 同屏共存回填」—— knowledge.type.filter.test.tsx ①（R146 尾段：桶按下 +
//   kn6-search-input「人事」）已锁 → 引用；本文件补「互不清除」动线：清 q 后 ktype 在、
//   清 ktype 后 q 在（R146 只锁了 ktype 清除双删，未从 q 在场视角锁 q 保留）。
// · ③两路非法枚举 loc 逐字不改 + kn-type-empty —— knowledge.filters.test.tsx ④（:203-215）
//   已锁 → 引用；本文件补该态下 cap 不渲染的行（R118 未断 cap；R138 只在 ghost 路断过）。
// · ④重挂增量集合逐字 —— knowledge.type.filter.test.tsx ④（R146：slice 增量 toBe）已锁
//   单 ktype 态 → 本文件补「ktype×本地名筛×URL q」三重组合态的四读互等。
// · ⑤切空间重置——**实测与派工不符**：spaceLink/backLink（KnowledgeModulePage.tsx:3402-3404/
//   :3598-3603）只删 space/doc，q/ktype 逐字保留；唯一重置是 SpaceDetailSurface 组件本地名筛
//   框（useEffect prevSpace :2143-2150 setFilter("")）。不改产品，断言真实行为。
// 名实替换照派工：cap N=50 常量位/M 可变位；?source= 无控件；详情面行钮实名
// kn-row-copy-space-<i>；导出族仅 data-export="absent"。
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

async function clickNode(node: Element | null, label: string) {
  expect(node, label).toBeTruthy();
  await act(async () => {
    node?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {});
}
const click = (testid: string) => clickNode(document.querySelector(`[data-testid="${testid}"]`), testid);

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

async function submitForm(testid: string) {
  const form = document.querySelector(`[data-testid="${testid}"]`) as HTMLFormElement | null;
  expect(form, testid).toBeTruthy();
  await act(async () => {
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await act(async () => {});
}

const q = (testid: string) => document.querySelector(`[data-testid="${testid}"]`);
const loc = () => (q("loc")?.textContent ?? "") as string;
const params = () => new URLSearchParams(loc());
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const visibleRows = () => document.querySelectorAll('[data-testid="kn3-docs-row"]').length;
const capText = () => (q("kn3-page-cap")?.textContent ?? "").replace(/\s+/g, " ").trim();
const bucketPressed = (label: string) => {
  const buttons = [...document.querySelectorAll('[data-testid="kn-type-row"] button')] as HTMLButtonElement[];
  const hit = buttons.find((b) => (b.childNodes[0]?.textContent ?? "").trim() === label);
  return hit?.getAttribute("aria-pressed") ?? null;
};

const A = { documentId: "d_a", fileName: "人事手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const B = { documentId: "d_b", fileName: "人事表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const C = { documentId: "d_c", fileName: "运维手册.pdf", mimeType: "pdf", sizeBytes: 512, updatedAt: "2026-11-19T05:00:00Z" };
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES)
      return Promise.resolve({
        asOf: "2026-11-19T08:00:00Z",
        items: [
          { spaceId: "sp_x", name: "人事空间", docCount: 3, status: "synced" },
          { spaceId: "sp_y", name: "运维空间", docCount: 1, status: "synced" },
        ],
      });
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [A, B, C] });
    if (url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [A, B, C] });
    if (url === docsUrlFor("sp_y")) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [A] });
    return fail(404, "这个数据接口还没有接入。", "rid-r157");
  });

const K = encodeURIComponent("空间"); // 命中两个空间名，列表两行都在（q 是空间名/来源面过滤）
const KTYPE_PDF = "PDF";

describe("knowledge space-detail search×type combination guards (R157, gap-only)", () => {
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

  it("② clearing one filter never touches the other (q clear keeps ktype; ktype clear keeps q), both churn is zero-request", async () => {
    wire();
    await render(`/knowledge?tab=spaces&panel=spaces&space=sp_x&q=${K}&ktype=${KTYPE_PDF}`);
    expect(params().get("q")).toBe("空间");
    expect(bucketPressed("PDF")).toBe("true");
    const c0 = urls().length;
    // 清搜索（本地提交空词）：q 从 URL 消失，ktype 逐字在场
    await type("kn6-search-input", "");
    await submitForm("kn6-search-form");
    expect(params().has("q")).toBe(false);
    expect(params().get("ktype")).toBe("PDF");
    // 清类型（点「全部」）：ktype/type 双删（R146 已锁动线），q 不再写入也不复活
    await click("kn-type-all");
    expect(params().has("ktype")).toBe(false);
    expect(params().has("type")).toBe(false);
    // 全程本地：零新请求
    expect(urls().length).toBe(c0);
  });

  it("⑤ switching spaces keeps ?q/?ktype byte-identical in the URL (product truth: only space/doc are rewritten); the local name box resets; the new space costs exactly its own documents read", async () => {
    wire();
    // 列表 → 进 sp_x（q×ktype 在场）→ 本地名筛打字 → 返回列表 → 转进 sp_y：全程查参数存留
    await render(`/knowledge?tab=spaces&q=${K}&ktype=${KTYPE_PDF}`);
    await click("kn-space-open"); // sp_x 行（keepBase 带 q/ktype 下钻）
    expect(params().get("space")).toBe("sp_x");
    expect(params().get("q")).toBe("空间");
    expect(params().get("ktype")).toBe("PDF");
    expect(visibleRows()).toBe(2); // ktype=PDF → A、C（详情表不吃 URL q，只吃 ktype+本地名筛）
    await type("kn3-docs-filter-input", "人事"); // 组件本地名筛（非 URL）
    expect(visibleRows()).toBe(1); // PDF∩人事 → A 手册
    const cBeforeBack = urls().length;
    await clickNode((q("kn3-docs-back") ?? container.querySelector('a[href*="space="]')) as Element | null, "back to list");
    // 返回只删 space/doc：q/ktype 逐字保留（实测：backLink keepBase）
    expect(params().get("q")).toBe("空间");
    expect(params().get("ktype")).toBe("PDF");
    const listRows = document.querySelectorAll('[data-testid="knw5-spaces-row"]');
    expect(listRows.length).toBeGreaterThan(0);
    // 列表仍被 q/ktype 语境带着：进 sp_y（第二个行链接）
    const spaceLinks = [...document.querySelectorAll('a[data-testid="kn-space-open"]')];
    await clickNode(spaceLinks[1], "open sp_y");
    expect(params().get("space")).toBe("sp_y");
    expect(params().get("q")).toBe("空间"); // —— 名实不符记录：派工写「全部重置」，产品实为保留 ——
    expect(params().get("ktype")).toBe("PDF");
    // 组件本地名筛框随空间挂载回到空（setFilter("")）：sp_y 只有 A 一条 PDF，1 行在场
    expect((q("kn3-docs-filter-input") as HTMLInputElement).value).toBe("");
    expect(visibleRows()).toBe(1);
    // 请求口径：切空间增量恰为新空间 documents 读 + 返回列表时的既有读取——无 keyword/cursor 请求
    const added = urls().slice(cBeforeBack);
    expect(added.some((u) => u.includes("cursor="))).toBe(false);
    expect(added.filter((u) => u === docsUrlFor("sp_y")).length).toBe(1);
  });

  it("③④ combo state: ktype×q leaves one row and the four readings agree (visible == cap-M == data-len == knF lines); remount replays the same request set; illegal ktype shows empty and no cap; 50 stays the constant", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire();
    // 本用例的 q 用「人事」——命中面（kn6）按文档名过滤：A、B 两条命中（q 面口径按文档名）。
    const url = `/knowledge?tab=spaces&panel=spaces&space=sp_x&q=${encodeURIComponent("人事")}&ktype=${KTYPE_PDF}`;
    await render(url);
    // 详情表：ktype=PDF 得 2 行，再上本地名筛「人事」→ 1 行（A）。URL q 只收敛命中面（2）。
    expect(visibleRows()).toBe(2);
    await type("kn3-docs-filter-input", "人事");
    expect(visibleRows()).toBe(1);
    expect(capText()).toContain("本页最多显示 50 篇（当前已加载 1 篇；复制清单也只含这些篇）"); // 50=常量位，1=可变 M
    expect(q("kn3-docs")?.getAttribute("data-len")).toBe("1");
    await click("knF-copy");
    expect(String(writeText.mock.calls[0][0]).split("\n").length - 2).toBe(visibleRows());
    // 检索命中面同步收敛（URL q 生效面），且其 data-len 与详情面各说各的、都无 cursor
    expect(q("kn6-search")?.getAttribute("data-len")).toBe("2"); // q 命中 A,B（命中面不吃 ktype——分面口径）
    expect(urls().some((u) => u.includes("cursor="))).toBe(false);
    // 重挂同 URL：第二轮增量集合逐字等于第一轮（R146 口径的组合态复证）。
    // 如实记录：本地名筛不落 URL——重挂只复现 q/ktype（ktype 桶按下、行数回 2）。
    const c0 = urls().length;
    const firstSet = urls().slice().sort().join("|");
    await render(url);
    const secondSet = urls()
      .slice(c0)
      .sort()
      .join("|");
    expect(secondSet).toBe(firstSet);
    expect(bucketPressed("PDF")).toBe("true");
    expect(visibleRows()).toBe(2);
    // 非法 ktype（两路）：loc 不改写、kn-type-empty 可读、cap 不渲染（筛空 = 空集三态之一，R108 口径）
    for (const key of ["ktype", "type"]) {
      await render(`/knowledge?tab=spaces&panel=spaces&space=sp_x&${key}=__nope__`);
      expect(params().get(key)).toBe("__nope__");
      expect(q("kn-type-empty")).toBeTruthy();
      expect(q("kn3-page-cap")).toBeNull();
      expect(visibleRows()).toBe(0);
    }
  });
});
