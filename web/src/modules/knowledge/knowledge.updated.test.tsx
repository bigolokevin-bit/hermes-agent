// R76 — 「最近更新」口径护栏（纯测试单：禁改产品行为；测出真缺陷需同单修并列改前/改后）。
// 口径声明：空间列按 R75 保留语义前缀（最近同步/最近更新由记录键选择），护栏锁的是前缀后的
// 时间值本体与 title 两句——三处的前缀剥离段、两处表格列的全文，都与 updatedText 逐字对账。
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
import { UPDATED_MISSING_TITLE, updatedText } from "./updated";

const SPACES = "/agent-api/api/knowledge/spaces?limit=20";

const ISO = "2026-11-14T06:33:18+08:00"; // +08:00 原带北京时区：到分钟仍是 06:33（不是 14:33——那是把 +08:00 当 UTC 的错算）
const BAD = "yesterday";
const EXPECT = updatedText(ISO); // 单一实现的对账锚

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

async function click(testid: string, index = 0) {
  const nodes = document.querySelectorAll(`[data-testid="${testid}"]`);
  expect(nodes.length > index, `${testid}[${index}]`).toBe(true);
  await act(async () => {
    nodes[index].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {});
}

const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0])).sort().join("|");

const DOC_ROWS = [
  { documentId: "t_iso", fileName: "同刻文档.pdf", mimeType: "pdf", sizeBytes: 10, ...{ updatedAt: ISO } },
  { documentId: "t_bad", fileName: "坏刻文档.pdf", mimeType: "pdf", sizeBytes: 10, updatedAt: BAD },
  { documentId: "t_empty", fileName: "空刻文档.pdf", mimeType: "pdf", sizeBytes: 10, updatedAt: "" },
  { documentId: "t_none", fileName: "无刻文档.pdf", mimeType: "pdf", sizeBytes: 10 },
];
const DOC_BODY = { asOf: "2026-11-20T07:00:00Z", documents: DOC_ROWS };

const wire = () =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES)
      return Promise.resolve({
        asOf: "2026-11-20T07:00:00Z",
        items: [
          { spaceId: "sp_iso", name: "同刻空间", docCount: 4, lastSyncAt: ISO },
          { spaceId: "sp_bad", name: "坏刻空间", docCount: 1, updatedAt: BAD },
          { spaceId: "sp_empty", name: "空刻空间", docCount: 1, updatedAt: "" },
          { spaceId: "sp_none", name: "无刻空间", docCount: 1 },
        ],
      });
    if (url.startsWith("/agent-api/api/documents?")) return Promise.resolve(DOC_BODY);
    return fail(404, "这个数据接口还没有接入。", "rid-cal-x");
  });

describe("knowledge updated-at caliber guards (R76, tests only)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("① three surfaces render the identical value for the same ISO, byte-equal to updatedText", async () => {
    wire();
    await render("/knowledge?tab=spaces&space=sp_iso");
    await act(async () => {});
    const searchVals = [...container.querySelectorAll('[data-testid="kn6-search-updated"]')].map((n) => n.textContent?.trim() ?? "");
    const docVals = [...container.querySelectorAll('[data-testid="kn3-docs-updated"]')].map((n) => n.textContent?.trim() ?? "");
    // 同刻行在两处表格列的值逐字等于 helper 输出
    expect(searchVals).toContain(EXPECT.value);
    expect(docVals).toContain(EXPECT.value);
    expect(searchVals[searchVals.indexOf(EXPECT.value)]).toBe(docVals[docVals.indexOf(EXPECT.value)]);
    // 空间列（列表面）：剥语义前缀后的值本体同字
    await render("/knowledge?tab=spaces");
    const spaceTimes = [...container.querySelectorAll('[data-testid="knw5-space-time"]')];
    const isoCell = spaceTimes.find((n) => (n.getAttribute("title") ?? "").includes(ISO));
    expect(isoCell).toBeTruthy();
    const parts = (isoCell?.textContent ?? "").split("：");
    expect(["最近同步", "最近更新", "登记时间"].includes((parts[0] ?? "").trim())).toBe(true);
    expect(parts.slice(1).join("：").trim()).toBe(EXPECT.value);
    // 全页不得出现「—」之外的第三种写法（同一 ISO 的分钟口径只有一个）
    expect(EXPECT.value).toBe("2026-11-14 06:33");
  });

  it("② missing / empty-string / invalid all render — with the fixed no-local-clock title, and a fake 2031 clock never leaks", async () => {
    wire();
    // 假系统时钟钉在 2031：若任何一处拿本机时间顶替，屏上必然冒出 2031
    vi.useFakeTimers({ now: new Date("2031-03-04T09:12:00Z") });
    await render("/knowledge?tab=spaces&space=sp_iso");
    await act(async () => {});
    const docVals = [...container.querySelectorAll('[data-testid="kn3-docs-updated"]')].map((n) => n.textContent?.trim() ?? "");
    const docTitles = [...container.querySelectorAll('[data-testid="kn3-docs-updated"]')].map((n) => n.getAttribute("title") ?? "");
    const searchVals = [...container.querySelectorAll('[data-testid="kn6-search-updated"]')].map((n) => n.textContent?.trim() ?? "");
    const searchTitles = [...container.querySelectorAll('[data-testid="kn6-search-updated"]')].map((n) => n.getAttribute("title") ?? "");
    // 三态（非法 yesterday / 空串 "" / 缺字段）在两张表各出现且同落「—」+ 缺失句
    const dashDoc = docVals.filter((v) => v === "—").length;
    const dashSearch = searchVals.filter((v) => v === "—").length;
    expect(dashDoc).toBe(3);
    expect(dashSearch).toBe(3);
    for (const t of [...docTitles, ...searchTitles]) {
      if (t.includes(UPDATED_MISSING_TITLE)) expect(t).toContain("不用本机时间顶替");
    }
    expect(docTitles.filter((t) => t === UPDATED_MISSING_TITLE)).toHaveLength(3);
    expect(searchTitles.filter((t) => t === UPDATED_MISSING_TITLE)).toHaveLength(3);
    // 假时钟不泄漏：整页任何时间格都不含 2031
    const pageText = container.textContent ?? "";
    expect(pageText).not.toContain("2031");
    // 列表面同样三态齐 + 无 2031
    await render("/knowledge?tab=spaces");
    const spaceTimes = [...container.querySelectorAll('[data-testid="knw5-space-time"]')];
    expect(spaceTimes.filter((n) => (n.getAttribute("title") ?? "") === UPDATED_MISSING_TITLE)).toHaveLength(3);
    expect((container.textContent ?? "")).not.toContain("2031");
    vi.useRealTimers();
    expect(updatedText(BAD)).toEqual({ value: "—", title: UPDATED_MISSING_TITLE });
    expect(updatedText("")).toEqual({ value: "—", title: UPDATED_MISSING_TITLE });
    expect(updatedText(null)).toEqual({ value: "—", title: UPDATED_MISSING_TITLE });
  });

  it("③ title carries the raw ISO and the value is its Beijing minute; they correspond", async () => {
    wire();
    await render("/knowledge?tab=spaces&space=sp_iso");
    await act(async () => {});
    const cells = [...container.querySelectorAll('[data-testid="kn3-docs-updated"], [data-testid="kn6-search-updated"]')];
    const isoCell = cells.find((n) => (n.getAttribute("title") ?? "").includes(ISO));
    expect(isoCell).toBeTruthy();
    expect(isoCell?.getAttribute("title")).toContain(ISO); // 原样 ISO 在 title
    expect(isoCell?.getAttribute("title")).toBe(`时间 ${ISO}（UTC）`);
    expect(isoCell?.textContent?.trim()).toBe("2026-11-14 06:33"); // 带 +08:00 的 ISO 折到北京时区即原分钟
    await render("/knowledge?tab=spaces");
    const spIso = [...container.querySelectorAll('[data-testid="knw5-space-time"]')].find((n) => (n.getAttribute("title") ?? "").includes(ISO));
    expect(spIso?.getAttribute("title")).toBe(`时间 ${ISO}（UTC）`);
    expect((spIso?.textContent ?? "").endsWith("06:33")).toBe(true);
  });

  it("④ read-only interactions never add requests: sorted snapshot stays byte-identical across sorts, buckets, preview toggles, ledger, keyword", async () => {
    wire();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    await render("/knowledge?tab=spaces&space=sp_iso");
    await act(async () => {});
    const u0 = urls();
    const c0 = fetchMock.mock.calls.length;
    // 排序（表头三态）、类型桶开关、行内预览开合、台账展开、关键词键入、复制——全部只读动作
    await click("kn-sort-updated");
    await click("kn-sort-updated");
    await click("kn-type-1");
    await click("kn-type-1");
    await click("kn-doc-preview-toggle");
    await click("kn-doc-preview-toggle");
    await click("knM-source-toggle");
    await click("knM-source-toggle");
    await click("knF-copy");
    expect(fetchMock.mock.calls.length).toBe(c0);
    expect(urls()).toBe(u0);
  });
});
