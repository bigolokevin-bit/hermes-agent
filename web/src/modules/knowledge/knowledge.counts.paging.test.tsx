// R197 — /knowledge 分页后计数与复制同源护栏（纯测试单：零产品改动）。
// 名实对齐（按实测，分面陈述）：
// · 分页控件 knE-page-* 只活在**空间详情文档列表**——该面逐行复制族是
//   `kn-row-copy-space-<i>`（R132 后缀）；`kn-row-copy-<i>` 属检索/全局面，
//   该面**不分页**（无 knE-page-*，见 knowledge.search 面断言 0 在场）——本文件
//   计数全用 -space- 族，id 连续性按 indexBase 全局行序（R169）锁 0..N-1。
// · 「导出数据行数」不存在（仅 data-export="absent"，R142/R190 映射先例）→
//   用清单复制器 knF-copy 数据行（docCopyText→docLine 单点）代位，未造控件。
// · 「kn-more」不存在：实名 knE-page-more/-count/-end/-stale/-error/-retry；
//   cursor 只在组件态不落 URL（R118）——翻页断言全走「点控件 + 读请求 URL」。
//   kn3-page-cap：50 常量位、M 可变位（R108）。
// 查重（锁过的引用不重写，file:line）：
// · R131① knowledge.paging.test.tsx:115-125 第 2 页后切桶归 1（计数文本、标识出局、
//   无旧 cursor 重放）；R131③ :150-163 失败保旧行+rid+重试整段增量恰 1；
//   R131② :128-146 末页 cap-M==count 读数互等 + disabled+「已到末页」；R152③ 两态 title；
//   R149② requests.test.tsx:116-136 重叠页去重四读（行==cap-M==data-len==knF 行）；
//   R152⑤ 合并态钮链；R169 跨组不重号。
// 真缺口（本文件 3 例）：
// ①翻页后**同屏**五读全链：knE-page-count 句 + 行 == data-len == 钮数（id 连续
//   0..N-1 跨页）== knF 数据行 == cap-M（R149 只锁四读、未与 count 文本和钮链同框）；
// ②筛选复位后三值对**新集**重算（R131① 只锁计数文本与行数，未锁 data-len/钮/knF
//   行同步重算）；
// ④错误窗口内三值**保持不塌**（R131③ 只锁行数与 rid，未锁窗口期 data-len==钮==knF==cap-M）。
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
const P2URL = `${P1URL}&cursor=p2`;

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
const txt = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const rowNames = () =>
  [...document.querySelectorAll('[data-testid="kn3-docs-row"] [data-testid="kn3-docs-name"]')].map((n) => txt(n));
const spaceBtnIds = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')]
    .map((b) => b.getAttribute("data-testid"))
    .sort((a, b) => Number(a!.slice(-1)) - Number(b!.slice(-1)));
/** 五读快照：行 / data-len / 钮 / cap-M /（复制行由调用方补）。 */
function fourReadings() {
  const rows = rowNames().length;
  return {
    rows,
    len: q("kn3-docs")?.getAttribute("data-len"),
    btns: spaceBtnIds().length,
    capM: (txt(q("kn3-page-cap")).match(/当前已加载 (\d+) 篇/)?.[1] ?? "—") as string,
  };
}

const P1DOCS = [
  { documentId: "d_1", fileName: "一 手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" },
  { documentId: "d_2", fileName: "二 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" },
];
const P2DOCS = [
  { documentId: "d_3", fileName: "三 说明.txt", mimeType: "txt", sizeBytes: 512, updatedAt: "2026-11-19T05:00:00Z" },
];
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 3, status: "synced" }],
};
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

describe("knowledge counts-after-paging guards (R197, gap-only)", () => {
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

  const wire = (p2: () => Promise<unknown>) =>
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [] });
      if (url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: P1DOCS, nextCursor: "p2" });
      if (url === P2URL) return p2();
      return fail(404, "这个数据接口还没有接入。", "rid-r197");
    });

  it("① after page 2 the five readings line up on one screen: count text == rows == data-len == row-copy ids contiguous 0..N-1 == cap-M == knF data lines", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire(() => Promise.resolve({ asOf: SP.asOf, documents: P2DOCS, nextCursor: null }));
    await render(DETAIL);
    await click("knE-page-more");
    // 页级计数文本如实（无 total 信封：只报已读条数，绝不「共 N」推算——R131 引文口径）
    expect(txt(q("knE-page-count"))).toBe("已显示 3 篇 · 总数不可用");
    const r = fourReadings();
    expect(r.rows).toBe(3);
    expect(r.len).toBe("3");
    expect(r.btns).toBe(3);
    expect(r.capM).toBe("3");
    // 钮 id 跨页连续 0..N-1（indexBase 语义在翻页后仍成立，R169 的分页面消费侧）
    expect(spaceBtnIds()).toEqual(["kn-row-copy-space-0", "kn-row-copy-space-1", "kn-row-copy-space-2"]);
    // 第五读：清单复制数据行与行名逐行同序
    await click("knF-copy");
    const lines = String(writeText.mock.calls[0][0]).split("\n");
    expect(lines.length - 2).toBe(3);
    expect(lines.slice(1, -1).map((l) => l.split(" | ")[0])).toEqual(rowNames());
  });

  it("② after a filter resets the cursor, the three values recompute against the new set (not stale merged numbers)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire(() => Promise.resolve({ asOf: SP.asOf, documents: P2DOCS, nextCursor: null }));
    await render(DETAIL);
    await click("knE-page-more"); // 合并态 3 行（R131① 锁过复位行替换，这里锁重算）
    expect(fourReadings().rows).toBe(3);
    // 切桶到「表格」（仅 d_2 xlsx）：页码归 1 的同一瞬，计数四读全对新集重算
    await click("kn-type-2"); // 桶序 [全部0→kn-type-all, PDF=1, 表格=2]
    const r = fourReadings();
    expect([r.rows, r.btns]).toEqual([1, 1]);
    expect(r.len).toBe("1");
    expect(r.capM).toBe("1"); // cap 的 M 跟着新集（不是合并态的 3——复位不只看行数）
    expect(spaceBtnIds()).toEqual(["kn-row-copy-space-0"]);
    await click("knF-copy");
    expect(String(writeText.mock.calls[0][0]).split("\n").length - 2).toBe(1); // knF 第五读同步
    // 回「全部」三值回到复位后的第一页集（游标回指 p2：再翻仍可读第三行）
    await click("kn-type-all");
    const back = fourReadings();
    expect([back.rows, back.btns, back.len, back.capM]).toEqual([2, 2, "2", "2"]);
  });

  it("④ a 500 on page 2 keeps rows, keeps all four readings intact inside the error window, shows the rid, and retry adds exactly one request", async () => {
    let ok = false;
    wire(() => (ok ? Promise.resolve({ asOf: SP.asOf, documents: P2DOCS, nextCursor: null }) : fail(500, "数据服务暂时没有响应，请稍后重试。", "rid-r197-500")));
    await render(DETAIL);
    await click("knE-page-more");
    expect(q("knE-page-error")).toBeTruthy();
    expect(document.body.textContent ?? "").toContain("请求编号：rid-r197-500"); // R131③ 锁 rid+重试恰一次——此处补窗口期四读
    const r = fourReadings();
    expect([r.rows, r.btns, r.len, r.capM]).toEqual([2, 2, "2", "2"]); // 旧行不塌、计数不冒充第三行
    ok = true;
    const c0 = fetchMock.mock.calls.length;
    await click("knE-page-retry");
    expect(fetchMock.mock.calls.length).toBe(c0 + 1); // 重试 +1（R131③ 同断言，此为五读联动的锚）
    expect(q("knE-page-error")).toBeNull();
    const r2 = fourReadings();
    expect([r2.rows, r2.btns, r2.len, r2.capM]).toEqual([3, 3, "3", "3"]); // 成功后四读同步跃迁
    expect(spaceBtnIds()).toEqual(["kn-row-copy-space-0", "kn-row-copy-space-1", "kn-row-copy-space-2"]);
  });

  it("the search/global face does not paginate: zero knE-page-* controls on it (mapping stated in header)", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [...P1DOCS, ...P2DOCS] });
      if (url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: P1DOCS, nextCursor: "p2" });
      return fail(404, "这个数据接口还没有接入。", "rid-r197");
    });
    await render("/knowledge?tab=spaces");
    expect(document.querySelectorAll('[data-testid^="knE-page"]').length).toBe(0);
    expect(document.querySelectorAll('button[data-testid^="kn-row-copy-"]').length).toBeGreaterThan(0); // 该面有行钮
    expect(document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]').length).toBe(0); // 无 -space- 族
  });
});
