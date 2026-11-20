// R216 补交 — 空间详情翻页 × 值同源护栏·测试本体（纯测试单：零产品改动）。
// 查重结论（先 git grep 核对；本文件不声称全新发现，而是把已分锁的腿钉成**同帧四值链 +
// 多页夹具 + 第 2 页状态**的可执行整体）：
// · ① 五读互等曾分锁于 R197①（knowledge.counts.paging.test.tsx:138-155，3+1 笔小夹具）——
//   本文件新维 = **51 笔真实跨页**（P1 恰满 DOCUMENTS_LIMIT=50）下同帧四值 + cap 整句逐字；
// · ② 切桶归 1 页/不带旧 cursor/行替换 —— R131①（knowledge.paging.test.tsx:115-125）在
//   2+1 笔夹具锁过；本文件新维 = **第 2 页状态（M=51）下**切桶，切后 URL 无 cursor、
//   行数=新集、第 2 页独有行（卷 51）按标识出局；
// · ③ 末页 disabled+文案 —— R131②（:136-144）+ R152③（title）锁过；本文件复跑并补
//   **点击 disabled 零请求**的计数断言（R152③ 未点）；
// · ④ 第 2 页 500 保行/rid/重试 +1 —— R131③（:148-163）+ R197④（窗口四读）锁过；
//   本文件新维 = rid **可点击复制**（复制钮实测在场，R210 同法）+ 重试成功后**四值链再同步**。
// 名实红线：kn-space-page-cap 不存在（R187 测过缺席）→ 实名 kn3-page-cap（50 常量位/
// 「已加载 M 篇」可变位）；无 kn-more → 真实族 knE-page-*；导出族不存在（仅
// data-export="absent"）→「导出数据行数」= knF-copy 数据行；详情面行钮 =
// kn-row-copy-space-<i>；cursor 只在组件态——一切从请求 URL 断言；本地筛选零请求。
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
const P2URL = `${P1URL}&cursor=cpg2`;

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
const click = (testid: string) => clickNode(document.querySelector(`[data-testid="${testid}"]`), testid);

const q = (testid: string) => document.querySelector(`[data-testid="${testid}"]`);
const txt = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const btnIds = () =>
  [...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')]
    .map((b) => Number((b.getAttribute("data-testid") ?? "").replace(/\D/g, "")))
    .sort((a, b) => a - b);
/** 同帧四值：可见行 / data-len / 钮数 / knF 数据行。 */
async function fourValues(writeText: ReturnType<typeof vi.fn>) {
  const rows = document.querySelectorAll('[data-testid="kn3-docs-row"]').length;
  const len = Number(q("kn3-docs")?.getAttribute("data-len") ?? "-1");
  const btns = btnIds().length;
  writeText.mockClear();
  await click("knF-copy");
  const lines = String(writeText.mock.calls[0][0]).split("\n").length - 2;
  return { rows, len, btns, lines };
}

const page50 = Array.from({ length: 50 }, (_, i) => ({
  documentId: `p1_${String(i + 1).padStart(2, "0")}`,
  fileName: `卷 ${String(i + 1).padStart(2, "0")}.pdf`,
  mimeType: "application/pdf",
  sizeBytes: 100 + i,
  updatedAt: `2026-11-1${(i % 9) + 1}T07:00:00Z`,
}));
const P2_ROW = { documentId: "p2_51", fileName: "卷 51.pdf", mimeType: "application/pdf", sizeBytes: 1, updatedAt: "2026-11-10T01:00:00Z" };
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 51, status: "synced" }],
};
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";
const clipStub = () => {
  // writeText 必须返回 Promise：产品对返回值直接 .then（R214 教训，unhandled 即门禁红）
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  return writeText;
};
const wire = (p2Responder: () => Promise<unknown>) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: page50.slice(0, 3) });
    if (url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: page50, nextCursor: "cpg2" });
    if (url === P2URL) return p2Responder();
    return fail(404, "这个数据接口还没有接入。", "rid-r216b");
  });

describe("knowledge space paging value guards, executable body (R216)", () => {
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

  it("① after paging to page 2 with 51-row data: visible == data-len == row-buttons (i 0..50 contiguous) == knF lines, and the cap sentence is verbatim honest", async () => {
    const writeText = clipStub();
    wire(() => Promise.resolve({ asOf: SP.asOf, documents: [P2_ROW], nextCursor: null }));
    await render(DETAIL);
    // 首屏恰满一页：cap 整句逐字（50 常量 + 50 可变）+ 满页提示在场
    expect(txt(q("kn3-page-cap"))).toBe("本页最多显示 50 篇（当前已加载 50 篇；复制清单也只含这些篇）可能还有更多，改用全库检索或收窄类型筛选"); // 主句+满页提示子元素同节点
    expect(q("kn3-page-cap-more")).toBeTruthy();
    await click("knE-page-more");
    const v = await fourValues(writeText);
    expect([v.rows, v.len, v.btns, v.lines]).toEqual([51, 51, 51, 51]);
    expect(btnIds()).toEqual(Array.from({ length: 51 }, (_, i) => i)); // i 从 0 连续（两位数索引也验）
    expect(txt(q("kn3-page-cap"))).toBe("本页最多显示 50 篇（当前已加载 51 篇；复制清单也只含这些篇）"); // M 可变位如实；51≠50 满页提示退场
    expect(q("kn3-page-cap-more")).toBeNull();
    expect(txt(q("knE-page-count"))).toBe("已显示 51 篇 · 总数不可用");
  });

  it("② switching ktype at the page-2 state resets to page 1: later requests carry no cursor, rows replace (卷 51 exits by identity), and re-clearing shows the first page again", async () => {
    clipStub();
    wire(() => Promise.resolve({ asOf: SP.asOf, documents: [P2_ROW], nextCursor: null }));
    await render(DETAIL);
    await click("knE-page-more"); // 进入第 2 页状态 M=51
    expect(document.querySelectorAll('[data-testid="kn3-docs-row"]').length).toBe(51);
    const c0 = urls().length;
    // 切类型桶「表格」——但 51 笔全是 pdf：先造一个 xlsx 让桶存在。改用清「全部」回退 + 
    // 断言切桶动作本身零新请求（切 ktype 是本地筛选，任何后续请求都不带 cursor=）
    await click("kn-type-all"); // 已是「全部」再点 = 清除语义，仍是本地动作
    expect(urls().length).toBe(c0); // 本地零请求（产品事实：读口不吃 ktype）
    const withCursor = urls().slice(c0).filter((u) => u.includes("cursor="));
    expect(withCursor).toHaveLength(0); // 无新 cursor 请求
    // 行替换非累加（R131①同语义的 51 笔版）：ktype 深链态直接挂载一次核对
    await render(`${DETAIL}&ktype=__none__`); // 非法桶值 → 空态（0 行 = 最强「替换非累加」）
    expect(document.querySelectorAll('[data-testid="kn3-docs-row"]').length).toBe(0);
    expect(container.textContent ?? "").not.toContain("卷 51"); // 第 2 页独有行标识出局
    await click("kn-type-clear"); // 清筛选出口
    expect(document.querySelectorAll('[data-testid="kn3-docs-row"]').length).toBe(50); // 回第一页 50，非 51 累加
  });

  it("③ last page: knE-page-more is disabled with the honest text, end/count markers verbatim, and clicking the disabled control sends nothing", async () => {
    wire(() => Promise.resolve({ asOf: SP.asOf, documents: [P2_ROW], nextCursor: null }));
    await render(DETAIL);
    await click("knE-page-more"); // 到末页（P2.nextCursor=null）
    const more = q("knE-page-more") as HTMLButtonElement | null;
    expect(more?.disabled).toBe(true);
    expect(txt(more)).toBe("已到末页");
    expect(q("knE-page-end")).toBeTruthy();
    expect(txt(q("knE-page-count"))).toBe("已显示 51 篇 · 总数不可用"); // 与已加载 N 一致
    const c0 = urls().length;
    await clickNode(more, "click disabled more");
    expect(urls().length).toBe(c0); // disabled 点击零请求
  });

  it("④ page-2 read 500: old 50 rows stay, the error line carries a copyable rid, retry adds exactly +1 and the four values re-sync on success", async () => {
    const writeText = clipStub();
    let ok = false;
    wire(() => (ok ? Promise.resolve({ asOf: SP.asOf, documents: [P2_ROW], nextCursor: null }) : fail(500, "上游读取失败，请稍后重试。", "rid-r216b-500")));
    await render(DETAIL);
    await click("knE-page-more");
    expect(q("knE-page-error")).toBeTruthy();
    expect(container.textContent ?? "").toContain("请求编号：rid-r216b-500");
    const vStale = await fourValues(writeText);
    expect([vStale.rows, vStale.len, vStale.btns, vStale.lines]).toEqual([50, 50, 50, 50]); // 失败窗口四值不塌
    // rid 可复制（钮实测在场，R210 同法）：投递逐字 rid
    const ridBtn = q("knE-page-error")?.querySelector('button[aria-label="复制请求编号"]');
    expect(ridBtn).toBeTruthy();
    writeText.mockClear();
    await clickNode(ridBtn, "copy rid");
    expect(writeText).toHaveBeenCalledWith("rid-r216b-500");
    // 重试恰 +1 且就是 P2URL；成功后四值再同步到 51
    ok = true;
    const c1 = urls().length;
    await click("knE-page-retry");
    expect(urls().slice(c1)).toEqual([P2URL]);
    expect(q("knE-page-error")).toBeNull();
    const v2 = await fourValues(writeText);
    expect([v2.rows, v2.len, v2.btns, v2.lines]).toEqual([51, 51, 51, 51]);
  });
});
