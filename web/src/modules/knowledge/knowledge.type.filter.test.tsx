// R146 — 类型筛选同源护栏（纯测试单：零产品改动）。派工两名实不符按实测落：
// · ?source= 在本模块无任何控件（source 只是空间行「来源」列标签）——①映射为
//   「?ktype= 与旧 ?type= 双键共存」+「?ktype= 与 ?q= 同屏共存回填」。
//   实测参数集（KnowledgeModulePage.tsx:3345/:3353-3354/:3359）：q、ktype（旧 type
//   只读回退、清除双删 :3468-3476）、ksort/kdir（旧 sort/dir）、space/doc、panel/tab/
//   cursor/sdoc/ref。
// · kn-list-copy 不存在——④映射为「可见行数 == knF-copy 数据行数」；导出族仅
//   data-export="absent" 标记，不造控件。
// 覆盖判定（先 grep 后写，锁过的不重写）：
// · ②改 ktype 只写该键+其余参不动+cursor 翻转+行替换：R118 ②（knowledge.filters.test.tsx
//   :159-186 has("type")=false、余参逐字、末页标记消失、data-len 回第一页）+ R131 ①
//   （knowledge.paging.test.tsx 第 2 页行按标识出局、旧 cursor 无重放）→ 已覆盖，本文件不重复。
// · ③非法 ktype/type：R118 ④（:203-215 两路地址逐字不改 + kn-type-empty + kn-type-all/
//   kn-type-clear 在场）→ 已覆盖；本文件补的是「点 clear 真删双键」的动线（R118 只查在场）。
// · ④重挂：R118 ③锁 loc/pressed/data-len 复原；本文件补「两轮请求 URL 集合逐字相等 +
//   重挂后 可见行==knF 数据行」。
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

async function click(testid: string) {
  const node = document.querySelector(`[data-testid="${testid}"]`) as HTMLElement | null;
  expect(node, testid).toBeTruthy();
  await act(async () => {
    node?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {});
}

const q = (testid: string) => document.querySelector(`[data-testid="${testid}"]`);
const loc = () => (q("loc")?.textContent ?? "") as string;
const params = () => new URLSearchParams(loc());
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0])).sort().join("|");
const visibleRows = () => document.querySelectorAll('[data-testid="kn3-docs-row"]').length;
const bucketPressed = (label: string) => {
  const buttons = [...document.querySelectorAll('[data-testid="kn-type-row"] button')] as HTMLButtonElement[];
  const hit = buttons.find((b) => (b.childNodes[0]?.textContent ?? "").trim() === label);
  return hit?.getAttribute("aria-pressed") ?? null;
};

const D1 = { documentId: "d_p", fileName: "P 手册.pdf", mimeType: "application/pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const D2 = { documentId: "d_q", fileName: "Q 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES)
      return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 2, status: "synced" }] });
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [D1, D2] });
    if (url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [D1, D2] });
    return fail(404, "这个数据接口还没有接入。", "rid-r146");
  });

const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

describe("knowledge type-filter coexistence & remount guards (R146, tests only)", () => {
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

  it("① ktype wins over legacy type when both are in the URL; the address is never rewritten; clearing removes BOTH keys; ktype×q co-backfill", async () => {
    wire();
    const BOTH = `${DETAIL}&q=%E4%BA%BA%E4%BA%8B&ktype=${encodeURIComponent("PDF")}&type=${encodeURIComponent("表格")}`;
    await render(BOTH);
    // 生效的是 ktype：PDF 桶按下、表格桶未按下（旧键值「表格」被忽略但不报错）
    expect(bucketPressed("PDF")).toBe("true");
    expect(bucketPressed("表格")).toBe("false");
    // 地址逐字不改写：不静默删旧键、不把 type 提升为 ktype
    expect(loc()).toBe("?tab=spaces&panel=spaces&space=sp_x&q=%E4%BA%BA%E4%BA%8B&ktype=PDF&type=%E8%A1%A8%E6%A0%BC");
    expect(params().get("type")).toBe("表格");
    // 点「全部」清除：ktype 与旧 type 双删，其余键原样在场
    await click("kn-type-all");
    const p = params();
    expect(p.has("ktype")).toBe(false);
    expect(p.has("type")).toBe(false);
    for (const key of ["q", "space", "tab", "panel"]) expect(p.get(key), key).not.toBeNull();
    expect(p.get("q")).toBe("人事");
    // 清除是本地动作：零新请求
    expect(urls()).toBe([SPACES, DOCUMENTS_PLAIN, docsUrlFor("sp_x")].sort().join("|"));
    // ktype×q 同屏共存回填：桶按下 + 检索框 value 逐字同 ?q=（两控件同 URL 各回各的）
    await render(`${DETAIL}&ktype=${encodeURIComponent("表格")}&q=%E4%BA%BA%E4%BA%8B`);
    expect(bucketPressed("表格")).toBe("true");
    expect((q("kn6-search-input") as HTMLInputElement).value).toBe("人事");
    expect(params().get("ktype")).toBe("表格");
  });

  it("④ remounting the same URL replays the identical request-URL set and keeps visible rows == knF data lines", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire();
    const url = `${DETAIL}&ktype=${encodeURIComponent("PDF")}`;
    await render(url);
    const firstRound = { u: urls(), len: q("kn3-docs")?.getAttribute("data-len"), visible: visibleRows() };
    writeText.mockClear();
    await click("knF-copy");
    const firstLines = String(writeText.mock.calls[0][0]).split("\n").length - 2;
    // 重挂同 URL：第二轮的增量请求集合与第一轮逐字相等（同 URL 同读口，无多发无换形），
    // data-len 与行数复原
    const cMid = fetchMock.mock.calls.length;
    await render(url);
    const secondRound = fetchMock.mock.calls.slice(cMid).map((x: unknown[]) => String(x[0])).sort().join("|");
    expect(secondRound).toBe(firstRound.u);
    expect(q("kn3-docs")?.getAttribute("data-len")).toBe(firstRound.len);
    expect(visibleRows()).toBe(firstRound.visible);
    // 重挂路径上三值复证：可见行 == knF 数据行（可见行被 ktype 筛到 1，两值同源同降）
    writeText.mockClear();
    await click("knF-copy");
    const secondLines = String(writeText.mock.calls[0][0]).split("\n").length - 2;
    expect(secondLines).toBe(firstLines);
    expect(visibleRows()).toBe(secondLines);
  });
});
