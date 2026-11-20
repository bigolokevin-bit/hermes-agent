// R210 — 双错误面隔离护栏（纯测试单：零产品改动）。
// 查重（锁过的引用不重写，行号 grep 核对）：
// · ①列表读口 500：句「这次没能读到知识数据」+「请求编号：rid-…」、行/行钮/预览族
//   **渲染数 0**（非 disabled——名实在 R187 已记：knowledge.space.error.test.tsx:149 等
//   querySelectorAll length 0）、knF-copy disabled+逐字 title、错误≠空态互斥
//   （R187 ② + R183 ①② + R138）→ 引用不重跑；
// · ②抽屉读口失败：列表与 kn3-page-cap 不卸载（R183 ①）、抽屉错误窗内行钮与行内预览
//   照常可用且复制串不漂移（R206 ④ + R183 ④）→ 引用；
// · R190④（空态 writeText 0 / createObjectURL spy 0）、R125C/R196（抽屉开 1 关 0）。
// 真缺口（本文件 2 例，③④隔离腿）：
// · 两处同时 5xx 时两枚 rid **各自独立在场**（列表锚 rid-L、抽屉锚 rid-D 互不覆盖），
//   rid 带可点击复制钮（实测 RequestId 有 aria-label="复制请求编号" 的 button）；
// · 各自重试只 +1 自己那条读口：列表重试增量恰 [documents?…spaceId]（详情不重发）、
//   抽屉重试增量恰 [/api/documents/<id>]（列表不重发）；恢复分步进行时，另一面错误锚
//   **不被误清**，两面各自恢复后两锚同时消失。
// 名实红线全按产品：无 ?source=、无导出族（「导出」=knF 行）；行钮族在详情面
// = kn-row-copy-space-<i>；排序本地零请求（引主测 kn-sort 段）。
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
const DETAIL_URL = "/agent-api/api/documents/d_a";
const RID_LIST = "rid-r210-list";
const RID_DRAWER = "rid-r210-drawer";

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

const A = { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "application/pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
const B = { documentId: "d_b", fileName: "B 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
const SP = {
  asOf: "2026-11-19T08:00:00Z",
  items: [{ spaceId: "sp_x", name: "测试空间", docCount: 2, status: "synced" }],
};
// 三面独立开关：spaces 恒好；列表读口与详情读口各自 fail/ok
const wireBoth = (opts: { listOk: boolean; detailOk: boolean }) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: SP.asOf, documents: [] });
    if (url === docsUrlFor("sp_x"))
      return opts.listOk
        ? Promise.resolve({ asOf: SP.asOf, documents: [A, B] })
        : fail(500, "上游读取失败，请稍后重试。", RID_LIST);
    if (url === DETAIL_URL)
      return opts.detailOk
        ? Promise.resolve({ sourceName: "A 原件.pdf", status: "indexed" })
        : fail(500, "上游读取失败，请稍后重试。", RID_DRAWER);
    return fail(404, "这个数据接口还没有接入。", "rid-r210-x");
  });
const DRAWER = "/knowledge?tab=spaces&panel=spaces&space=sp_x&doc=d_a";

describe("knowledge dual-failure isolation guards (R210, gap-only)", () => {
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

  it("④ both surfaces failing at once: two independent rids on screen (no clobber), rid is click-copyable, and recovering one leaves the other's error anchor standing", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    // 真实控制台跑在 https 下（isSecureContext=true）；jsdom 默认无此标志会让
    // copyTextToClipboard 走 textarea 选抄 fallback——补环境标志，断言剪贴板主路径。
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    wireBoth({ listOk: false, detailOk: false });
    await render(DRAWER);
    expect(q("kn3-docs-error")).toBeTruthy();
    expect(q("kn7-preview-error")).toBeTruthy();
    // 两枚 rid 各自独立在场：列表锚含 rid-L、抽屉锚含 rid-D，互不覆盖
    expect((q("kn3-docs-error")?.textContent ?? "")).toContain(`请求编号：${RID_LIST}`);
    expect((q("kn7-preview-error")?.textContent ?? "")).toContain(`请求编号：${RID_DRAWER}`);
    expect((q("kn3-docs-error")?.textContent ?? "")).not.toContain(RID_DRAWER);
    // rid 可点击复制（实测 RequestId 自带钮——不是伪称）：点抽屉锚的钮，投递的是 rid-D
    const drawerCopyBtn = q("kn7-preview-error")?.querySelector('button[aria-label="复制请求编号"]');
    expect(drawerCopyBtn).toBeTruthy();
    await act(async () => {
      (drawerCopyBtn as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {});
    expect(writeText).toHaveBeenCalledWith(RID_DRAWER);
    // 恢复只发生在被重试的那一面：列表重试后列表锚消失，抽屉锚**不被误清**（隔离）
    wireBoth({ listOk: true, detailOk: false });
    const c0 = urls().length;
    await click("kn3-docs-retry");
    expect(urls().length).toBe(c0 + 1);
    expect(urls()[c0]).toBe(docsUrlFor("sp_x")); // 只 +1 列表读口（详情不重发）
    expect(q("kn3-docs-error")).toBeNull();
    expect(q("kn7-preview-error")).toBeTruthy();
    expect(document.querySelectorAll('[data-testid="kn3-docs-row"]').length).toBe(2); // 列表就位
  });

  it("③ retries are independent per surface: drawer retry adds exactly the detail read (list leg untouched) and both anchors clear once each recovered", async () => {
    wireBoth({ listOk: false, detailOk: false });
    await render(DRAWER);
    expect(q("kn3-docs-error")).toBeTruthy();
    expect(q("kn7-preview-error")).toBeTruthy();
    // 先修抽屉：增量恰为详情读一条，列表读口零重发、列表锚仍在（不牵连）
    fetchMock.mockImplementation((url: string) => {
      if (url === DETAIL_URL) return Promise.resolve({ sourceName: "A 原件.pdf", status: "indexed" });
      return wireDead();
    });
    const c0 = urls().length;
    await click("kn7-preview-retry");
    const added = urls().slice(c0);
    expect(added).toEqual([DETAIL_URL]); // 只 +1 详情（列表/spaces 零连带）
    expect(q("kn7-preview-error")).toBeNull();
    expect(q("kn7-preview-field-source")?.textContent ?? "").toContain("A 原件.pdf"); // 内容就位
    expect(q("kn3-docs-error")).toBeTruthy(); // 列表锚独立存留
    // 再修列表：两锚同时消失
    fetchMock.mockImplementation((url: string) => {
      if (url === docsUrlFor("sp_x")) return Promise.resolve({ asOf: SP.asOf, documents: [A, B] });
      if (url === DETAIL_URL) return Promise.resolve({ sourceName: "A 原件.pdf", status: "indexed" });
      return wireDead();
    });
    const c1 = urls().length;
    await click("kn3-docs-retry");
    expect(urls().slice(c1)).toEqual([docsUrlFor("sp_x")]); // 只 +1 列表（详情不重发）
    expect(q("kn3-docs-error")).toBeNull();
    expect(q("kn7-preview-error")).toBeNull(); // 各自恢复后两锚同清
    expect(document.querySelectorAll('[data-testid="kn3-docs-row"]').length).toBe(2);
    function wireDead(): Promise<never> {
      return fail(500, "上游读取失败，请稍后重试。", "rid-r210-x");
    }
  });
});
