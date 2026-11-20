// R118 — /knowledge 类型与来源筛选 URL 保参护栏（纯测试单：禁改产品行为）。
// 口径（派工补正确认）：本模块真实筛选键只有 q、ktype（旧 type 只读兜底、清除双删）、
// ksort/kdir（旧 sort/dir 只读兜底）、space/doc/sdoc/ref/panel/tab；?source= 无对应控件，
// 本单以 ktype 新键 + type 旧键覆盖，不造参数。分页游标只在组件 state（URL 无 cursor 参数），
// 翻页累加与复位以 knE-page-end / knE-page-more 的可观测翻转作证「页码归 1」。
// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
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
const page2UrlFor = (id: string, cursor: string) => `${docsUrlFor(id)}&cursor=${cursor}`;

const DETAIL_X = "/knowledge?tab=spaces&panel=spaces&space=sp_x&q=%E4%BA%BA%E4%BA%8B&ksort=updated&kdir=asc";

function fail(status: number, message: string, requestId?: string): Promise<never> {
  return Promise.reject(new ApiError(message, { status, body: "", url: "/agent-api/api/test", requestId }));
}

function LocationProbe(): ReactNode {
  return createElement("div", { "data-testid": "loc" }, useLocation().search);
}

function SpaceJumpProbe(): ReactNode {
  const navigate = useNavigate();
  return createElement(
    "button",
    { "data-testid": "jump-sp-y", onClick: () => navigate(`/knowledge?${new URLSearchParams({ tab: "spaces", panel: "spaces", space: "sp_y", q: "人事", ksort: "updated", kdir: "asc" }).toString()}`) },
    "go sp_y",
  );
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
        createElement(SpaceJumpProbe),
      ),
    );
  });
  await act(async () => {});
}

async function click(testid: string) {
  const node = container.querySelector(`[data-testid="${testid}"]`) as HTMLElement | null;
  expect(node, testid).toBeTruthy();
  await act(async () => {
    node?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {});
}

/** 桶按钮按标签找（testid 的 index 随桶序，不作断言依赖）。 */
async function clickBucket(label: string) {
  const buttons = [...container.querySelectorAll('[data-testid="kn-type-row"] button')] as HTMLButtonElement[];
  const hit = buttons.find((b) => (b.childNodes[0]?.textContent ?? "").trim() === label);
  expect(hit, `bucket ${label}`).toBeTruthy();
  await act(async () => {
    hit?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {});
}
const bucketPressed = (label: string) => {
  const buttons = [...container.querySelectorAll('[data-testid="kn-type-row"] button')] as HTMLButtonElement[];
  const hit = buttons.find((b) => (b.childNodes[0]?.textContent ?? "").trim() === label);
  return hit?.getAttribute("aria-pressed") ?? null;
};

async function type(testid: string, value: string) {
  const node = container.querySelector(`[data-testid="${testid}"]`) as HTMLInputElement | null;
  expect(node, testid).toBeTruthy();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(node, value);
    node?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {});
}

const loc = () => (container.querySelector('[data-testid="loc"]')?.textContent ?? "") as string;
const params = () => new URLSearchParams(loc());
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0])).sort().join("|");
const attr = (testid: string, name: string) => container.querySelector(`[data-testid="${testid}"]`)?.getAttribute(name) ?? null;

const D1 = { documentId: "d1", fileName: "员工手册.pdf", mimeType: "application/pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:10:00Z" };
const D2 = { documentId: "d2", fileName: "考勤表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:10:00Z" };
const D3 = { documentId: "d3", fileName: "培训材料.pdf", mimeType: "application/pdf", sizeBytes: 512, updatedAt: "2026-11-19T05:10:00Z" };

const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES)
      return Promise.resolve({
        asOf: "2026-11-19T08:00:00Z",
        items: [
          { spaceId: "sp_x", name: "人事制度空间", docCount: 3, status: "synced" },
          { spaceId: "sp_y", name: "运维手册空间", docCount: 1, status: "synced" },
        ],
      });
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [D1, D2, D3] });
    if (url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [D1, D2], nextCursor: "c2" });
    if (url === page2UrlFor("sp_x", "c2")) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [D3], nextCursor: null });
    if (url === docsUrlFor("sp_y")) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [D2] });
    return fail(404, "这个数据接口还没有接入。", "rid-r118");
  });

describe("knowledge filter URL guards (R118, tests only)", () => {
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

  it("① deep links backfill controls byte-equal to the URL params (ktype 新键 / type 旧键 / space / q)", async () => {
    wire();
    // 新键 ktype=表格（xlsx 的人话桶名）：按钮 aria-pressed 回填，值与 URL 参数逐字等
    await render(`${DETAIL_X}&ktype=${encodeURIComponent("表格")}`);
    expect(params().get("ktype")).toBe("表格");
    expect(bucketPressed("表格")).toBe("true");
    expect(bucketPressed("PDF")).toBe("false");
    // 旧键 type 兜底：同值回填同一个桶
    await render(`${DETAIL_X}&type=${encodeURIComponent("PDF")}`);
    expect(params().get("ktype")).toBeNull(); // 旧地址原样在场，不被静默改写
    expect(bucketPressed("PDF")).toBe("true");
    // space=：选中即详情槽位——该空间文档表挂载，且真实请求 URL 的 spaceId 与参数逐字同
    await render(DETAIL_X);
    expect(params().get("space")).toBe("sp_x");
    expect(container.querySelector('[data-testid="kn3-docs"]')).toBeTruthy();
    const docReq = fetchMock.mock.calls.map((c: unknown[]) => String(c[0])).find((u) => u.startsWith(docsUrlFor("sp_x")));
    expect(new URLSearchParams(docReq?.split("?")[1] ?? "").get("spaceId")).toBe(params().get("space"));
    // q=人事：两个关键词框都从 URL 回填（值与请求参数无关：q 是纯本地，不发请求）
    await render("/knowledge?tab=spaces&q=%E4%BA%BA%E4%BA%8B");
    expect(params().get("q")).toBe("人事");
    expect((container.querySelector('[data-testid="kn8-global-input"]') as HTMLInputElement).value).toBe("人事");
    expect((container.querySelector('[data-testid="kn6-search-input"]') as HTMLInputElement).value).toBe("人事");
  });

  it("② one filter write touches only its own key; the rest stay byte-identical; paging falls back to page 1", async () => {
    wire();
    await render(`${DETAIL_X}&ktype=${encodeURIComponent("表格")}`);
    // 先翻到第二页（信封给游标才能翻）：末页标记在场 = 游标已走到尾
    await click("knE-page-more");
    expect(container.querySelector('[data-testid="knE-page-end"]')).toBeTruthy();
    const before = params();
    await clickBucket("PDF");
    const after = params();
    expect(after.get("ktype")).toBe("PDF"); // 只写 ktype
    expect(after.has("type")).toBe(false); // 旧键不得冒头
    for (const key of ["q", "ksort", "kdir", "space", "tab", "panel"]) {
      expect(after.get(key), key).toBe(before.get(key)); // 其余参数逐字不动
    }
    // 页码归 1：游标只存组件 state（URL 从来不带 cursor 参数），复位以可观测翻转作证——
    // 末页标记消失、「显示更多」回可点（pageMeta 退回第一页的游标）。
    expect(after.has("cursor")).toBe(false);
    expect(container.querySelector('[data-testid="knE-page-end"]')).toBeNull();
    expect((container.querySelector('[data-testid="knE-page-more"]')?.textContent ?? "")).toContain("显示更多");
    // 行集回第一页口径：游标复位时第二页累加行一并弃（combined 退回 baseRows），
    // PDF 桶只剩第一页的 d1——len=1 本身就是「页码归 1」的行级证据。
    expect(attr("kn3-docs", "data-len")).toBe("1");
  });

  it("③ remounting the same URL restores the identical filter state and identical row count", async () => {
    wire();
    const url = `${DETAIL_X}&ktype=${encodeURIComponent("PDF")}`;
    await render(url);
    const first = { len: attr("kn3-docs", "data-len"), pdf: bucketPressed("PDF"), all: bucketPressed("全部"), loc: loc() };
    await render(url);
    expect(loc()).toBe(first.loc); // 地址逐字复原
    expect(bucketPressed("PDF")).toBe("true");
    expect(bucketPressed("PDF")).toBe(first.pdf);
    expect(bucketPressed("全部")).toBe(first.all);
    expect(attr("kn3-docs", "data-len")).toBe(first.len);
  });

  it("④ illegal enums (ktype and legacy type) never rewrite the URL, show the readable empty state, keep page anchors", async () => {
    wire();
    for (const key of ["ktype", "type"]) {
      const path = `${DETAIL_X}&${key}=__nope__`;
      await render(path);
      expect(loc()).toBe(`?tab=spaces&panel=spaces&space=sp_x&q=%E4%BA%BA%E4%BA%8B&ksort=updated&kdir=asc&${key}=__nope__`);
      const empty = container.querySelector('[data-testid="kn-type-empty"]');
      expect(empty, key).toBeTruthy();
      expect((empty?.textContent ?? "").replace(/\s+/g, " ")).toContain("该类型下没有文档");
      expect((empty?.textContent ?? "")).toContain("__nope__"); // 点名的就是地址里那个值，不吞不猜
      // 页级锚仍在：桶排、空间详情表骨架、清除入口都查得到
      expect(container.querySelector('[data-testid="kn-type-all"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="kn-type-clear"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="kn3-docs"]')).toBeTruthy();
    }
  });

  it("⑤ local filter churn adds zero requests; space switch adds exactly that space's document read once", async () => {
    wire();
    await render(`${DETAIL_X}&ktype=${encodeURIComponent("表格")}`);
    const c0 = fetchMock.mock.calls.length;
    const u0 = urls();
    // ktype 三跳 + 本地名筛 + 排序双点：全本地，urls() 逐字不变
    await clickBucket("PDF");
    await clickBucket("全部");
    await clickBucket("表格");
    await type("kn3-docs-filter-input", "手册");
    await click("kn-sort-updated");
    await click("kn-sort-updated");
    expect(fetchMock.mock.calls.length).toBe(c0);
    expect(urls()).toBe(u0);
    // 同 URL 合法 vs 非法枚举：每轮 render 的增量读取逐字一致（筛选纯本地，枚举合法性不改请求）
    const cR1 = fetchMock.mock.calls.length;
    await render(`${DETAIL_X}&ktype=__nope__`);
    const cR2 = fetchMock.mock.calls.length;
    const addBad = fetchMock.mock.calls.slice(cR1).map((x: unknown[]) => String(x[0])).sort();
    await render(`${DETAIL_X}&ktype=${encodeURIComponent("PDF")}`);
    const cR3 = fetchMock.mock.calls.length;
    const addGood = fetchMock.mock.calls.slice(cR2).map((x: unknown[]) => String(x[0])).sort();
    expect(cR2 - cR1).toBe(cR3 - cR2);
    expect(addGood).toEqual(addBad);
    // space= 切换（不重挂页面、只改查询态）：增量恰为 sp_y 的文档读取一次；
    // 这不是零请求——是既有设计里该空间文档的读取；sp_x 的读取不再叠加。
    await render(DETAIL_X);
    const cA = fetchMock.mock.calls.length;
    const beforeY = fetchMock.mock.calls.map((x: unknown[]) => String(x[0])).filter((x) => x === docsUrlFor("sp_y")).length;
    await act(async () => {
      (container.querySelector('[data-testid="jump-sp-y"]') as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {});
    const added = fetchMock.mock.calls.slice(cA).map((x: unknown[]) => String(x[0]));
    const afterY = fetchMock.mock.calls.map((x: unknown[]) => String(x[0])).filter((x) => x === docsUrlFor("sp_y")).length;
    expect(added.filter((u) => u === docsUrlFor("sp_y"))).toHaveLength(1);
    expect(afterY - beforeY).toBe(1);
    expect(added.filter((u) => u === docsUrlFor("sp_x"))).toHaveLength(0); // 旧空间不叠加
    expect(added.filter((u) => u === SPACES)).toHaveLength(0); // 空间名读取不随 space 重发
    expect(loc()).toContain("space=sp_y");
  });
});
