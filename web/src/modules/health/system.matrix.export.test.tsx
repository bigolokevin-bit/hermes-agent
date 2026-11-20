// @vitest-environment jsdom
/**
 * R204 — /system 导出与筛选/排序同源（纯测试，零产品码改动）。
 *
 * 派工单点名的面在本代不存在（第九次确认，如实记录，不编造）：
 * - `git grep -n "sys-evt\|sysEventCopyText\|evt-copy\|evt-more\|evt-count" -- web/src` 只有 3 处命中，
 *   全是记录缺席的注释：`health/system.state.isolation.test.tsx:18`、`health/system.time.test.tsx:8`、
 *   `health/system.filters.test.tsx:14`。health 模块没有事件表；`?window=` 只由
 *   `audit/AuditEventsModulePage` 读（R135/R194/R202 已证），事件行锚是 `aud01-row-*`。
 * - 事件面的导出护栏已由 aud 道 1:1 钉住，在 health 里重述是跨道重复：
 *   `audit.export.test.tsx`（R141 :199 文件/表体/计数三值同源、:215 与 :241 导出服从地址里的筛选、
 *   :259 缺值留空字段且落在自己的列、:283 时刻用屏上自己的读法、:303 空集 disabled 带原因且点击
 *   不发请求、:323 导出已加载的东西零自有请求）与 `audit.export.escape.test.tsx`（R192 :265 列数不被
 *   名字里的逗号撑破、:279 表头与列序按现状锁定、:302 与 :323 缺值各层用自己的词、:343 文件跟随
 *   问题且生成过程零成本）。
 *
 * 所以本文件只做本写域内真实存在的导出面——读源矩阵的 `sys7-export`，四个既有缺口：
 * ①CSV 数据行数 == 表体行数 == `sys7-export-count` 的 N 三值同源，表头与列序按现状锁定
 *   （`SourceMatrix.test.tsx` :98-108 只钉计数位与「`createObjectURL` 被调过一次」，没读文件内容）；
 * ②导出服从当前 `?q=` 与 `sys13` 排序：CSV 行序 == 表体行序、首行 == 屏上首行，零额外请求；
 * ③缺值在文件与屏上各有自己的用词：未接线/失败行的 `as_of` 是空字段而屏上是「—」，`elapsed_ms`
 *   是裸数字而屏上是「N ms」，`as_of` 是 UTC 原文而屏上是北京时间到分；且导出文本不得混入
 *   `sys-updated-at`（假时钟 2031 下复证，同 R112/R159 口径）；
 * ④空集：`sys7-export` disabled + 可读 title，点击零请求且 `createObjectURL` 一次都没被调用
 *   （R159 :373 只断言 disabled，从未点它；`SourceMatrix.test` :406-412 也没测「不生成文件」这一半）。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: (...args: unknown[]) => api.fetchJSON(...args) }));
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    const rest = props as React.ButtonHTMLAttributes<HTMLButtonElement> & { outlined?: boolean };
    delete rest.outlined;
    return <button {...rest}>{children}</button>;
  },
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

import { ApiError } from "@/lib/api-error";
import { HealthPage } from "./HealthPage";
import { resetSourceMatrix } from "./sourceReads";

/** `sourceMatrixCsv.ts` ships these five names in this order; locked as-is, not as it should be. */
const CSV_HEADER = ["name", "path", "state", "elapsed_ms", "as_of"];
const LABEL_HEALTH = "系统健康清单";
const LABEL_CONSOLE = "控制台服务探针";
const HEALTH_ISO = "2026-11-19T15:17:09Z";
const DOMAIN_ISO = "2026-11-19T22:15:01.655Z";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const HEALTH_BODY = {
  schema: "console.health.sources.v1",
  ok: true,
  asOf: HEALTH_ISO,
  asOfSource: "health.payload.asOf",
  sources: [
    { id: "console", name: "控制台服务(BFF)", status: "ok", version: "4.2.1" },
    { id: "runtime", name: "Hermes 运行时", status: "ok", version: "0.9.1" },
  ],
};

/** health 成功带时刻 · console 未接线 · runtime 失败带 rid · domain 成功带另一时刻。 */
function answer(url: unknown): Promise<unknown> {
  const key = String(url);
  if (key.includes("/agent-api/api/health")) return Promise.resolve(HEALTH_BODY);
  if (key.includes("__health-probe__")) {
    return Promise.reject(new ApiError("unavailable", { status: 404, body: "", url: key, requestId: "req-console-404" }));
  }
  if (key.includes("hermes-summary")) {
    return Promise.reject(new ApiError("upstream failed", { status: 500, body: "", url: key, requestId: "req-runtime-500" }));
  }
  return Promise.resolve({ items: [], asOf: DOMAIN_ISO });
}

function q<T extends HTMLElement = HTMLElement>(testid: string): T | null {
  return container.querySelector<T>(`[data-testid='${testid}']`);
}

function must<T extends HTMLElement = HTMLElement>(testid: string): T {
  const node = q<T>(testid);
  if (!node) throw new Error(`missing node [data-testid='${testid}']`);
  return node;
}

function textOf(testid: string): string {
  return q(testid)?.textContent?.trim() ?? "";
}

function rowIds(): string[] {
  return [...container.querySelectorAll("[data-testid^='sys6-row-']")].map(
    (el) => (el.getAttribute("data-testid") ?? "").slice("sys6-row-".length),
  );
}

function screenNames(): string[] {
  return rowIds().map((id) => textOf(`sys6-name-${id}`));
}

function reads(): number {
  return api.fetchJSON.mock.calls.length;
}

function digits(text: string): number | null {
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

/** Iteration-bounded on purpose: test ③ freezes `Date`, so a `Date.now()` deadline never fires and
 * would spin until vitest kills the test (the recorded trap). */
async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  for (let i = 0; i < 600; i += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error(`waitFor: ${label} never became true`);
}

type Download = {
  content: () => string;
  fileName: () => string;
  urlSpy: ReturnType<typeof vi.fn>;
  restore: () => void;
};

/** Capture what `downloadCsv` builds without letting a blob or an anchor touch the page.
 * The audit lane's proven idiom: subclass the global Blob so the parts are readable. */
function captureDownload(): Download {
  let recorded = "";
  let name = "";
  const OriginalBlob = window.Blob;
  const urlSpy = vi.fn(() => "blob:sys7");
  const revokeSpy = vi.fn();
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  class RecordingBlob extends OriginalBlob {
    constructor(parts: BlobPart[], options?: BlobPropertyBag) {
      super(parts, options);
      recorded = String(parts[0]);
    }
  }
  Object.defineProperty(window, "Blob", { value: RecordingBlob, configurable: true, writable: true });
  Object.defineProperty(URL, "createObjectURL", { value: urlSpy, configurable: true, writable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: revokeSpy, configurable: true, writable: true });
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    name = this.download;
  });
  return {
    content: () => recorded,
    fileName: () => name,
    urlSpy,
    restore: () => {
      clickSpy.mockRestore();
      Object.defineProperty(URL, "createObjectURL", { value: originalCreate, configurable: true, writable: true });
      Object.defineProperty(URL, "revokeObjectURL", { value: originalRevoke, configurable: true, writable: true });
      Object.defineProperty(window, "Blob", { value: OriginalBlob, configurable: true, writable: true });
    },
  };
}

/** Header line plus one record per row. The BOM `downloadCsv` prefixes is stripped here.
 * Fixture values need no RFC4180 quoting (no comma, quote or newline), asserted in test ①. */
function csvRecords(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n$/, "")
    .split("\r\n")
    .map((line) => line.split(","));
}

async function clickNode(testid: string): Promise<void> {
  const node = must<HTMLButtonElement>(testid);
  await act(async () => {
    node.click();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function render(): Promise<void> {
  await act(async () => {
    root.render(<HealthPage />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

/** The matrix is collapsed by default; the export toolbar reads the same sorted rows. */
async function expand(): Promise<void> {
  await waitFor(() => !!q("sys6-toggle"), "matrix toggle");
  await clickNode("sys6-toggle");
  await waitFor(() => rowIds().length > 0, "matrix rows on screen");
}

async function mount(): Promise<void> {
  await render();
  await expand();
}

beforeEach(() => {
  resetSourceMatrix();
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(answer);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  window.history.replaceState({}, "", "/system?tab=health");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.replaceChildren();
  resetSourceMatrix();
  window.history.replaceState({}, "", "/");
  vi.useRealTimers();
});

describe("R204 — /system 导出的三值同源、筛选服从、缺值用词与空集不生成", () => {
  it("exports exactly the rows the matrix shows and says it will, in the columns it ships today", async () => {
    const dl = captureDownload();
    await mount();
    const before = reads();
    const ids = rowIds();
    const names = screenNames();
    expect(ids).toHaveLength(4);
    expect(textOf("sys7-export-count")).toBe("4 行");
    expect(must<HTMLButtonElement>("sys7-export").disabled).toBe(false);

    await clickNode("sys7-export");
    const records = csvRecords(dl.content());
    expect(records[0]).toEqual(CSV_HEADER);
    const data = records.slice(1);
    // Three values, one fixture: file records, table body, and the count slot.
    expect(data).toHaveLength(ids.length);
    expect(digits(textOf("sys7-export-count"))).toBe(data.length);
    expect(data.map((row) => row[0])).toEqual(names);
    // Every record carries the five columns the header names — no column drift.
    for (const row of data) {
      expect(row).toHaveLength(CSV_HEADER.length);
    }
    expect(dl.content()).not.toContain('"');
    expect(dl.content().endsWith("\r\n")).toBe(true);
    expect(dl.urlSpy).toHaveBeenCalledTimes(1);
    expect(dl.fileName()).toMatch(/^system-sources-\d{8}-\d{4}\.csv$/);
    expect(dl.content()).not.toMatch(/undefined|null|NaN|\[object/);
    expect(reads()).toBe(before);
    dl.restore();
  });

  it("exports the filtered and sorted view in table order without reading again", async () => {
    const dl = captureDownload();
    window.history.replaceState({}, "", "/system?tab=health&q=%E6%8E%A2%E9%92%88");
    await render();
    await expand();
    const before = reads();
    const filtered = screenNames();
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.length).toBeLessThan(4);
    for (const name of filtered) {
      expect(name).toContain("探针");
    }
    expect(textOf("sys7-export-count")).toBe(`${filtered.length} 行`);

    // A sort click re-orders the body; the file must follow it, not precede it. Which order the
    // sort lands on is the product's business — the contract is 「file == body」.
    await clickNode("sys13-sort-asof");
    await waitFor(
      () => {
        const state = q("sys13-head-asof")?.getAttribute("aria-sort") ?? "none";
        return state === "ascending" || state === "descending";
      },
      "the asof sort applied",
    );
    const sorted = screenNames();
    expect([...sorted].sort()).toEqual([...filtered].sort());
    expect(must<HTMLButtonElement>("sys7-export").disabled).toBe(false);

    await clickNode("sys7-export");
    const records = csvRecords(dl.content());
    const data = records.slice(1);
    expect(data.map((row) => row[0])).toEqual(sorted);
    expect(data).toHaveLength(sorted.length);
    expect(digits(textOf("sys7-export-count"))).toBe(data.length);
    expect(reads()).toBe(before);
    dl.restore();
  });

  it("keeps the file's own words for absent values and never lets the read stamp in", async () => {
    vi.useFakeTimers({ now: new Date("2031-03-01T00:00:00Z"), toFake: ["Date"] });
    const dl = captureDownload();
    await mount();
    const before = reads();
    // Screen faces first, so the file is compared against what is actually on display.
    expect(textOf("sys8-asof-console")).toBe("—");
    expect(textOf("sys8-asof-runtime")).toBe("—");
    expect(textOf("sys8-asof-health")).toBe("2026-11-19 23:17");
    expect(textOf("sys15-trunc-status-console")).toBe("读口未接入");
    expect(textOf("sys6-duration-console")).toMatch(/^\d+ ms$/);

    await clickNode("sys-refresh");
    await waitFor(() => !!q("sys-updated-at"), "the read stamp");
    const stamp = textOf("sys-updated-at");
    expect(stamp).toContain("（读取时刻，不是数据时刻）");
    expect(stamp).toContain("2031");

    await clickNode("sys7-export");
    const records = csvRecords(dl.content());
    const data = records.slice(1);
    const rowOf = (label: string): string[] => {
      const found = data.find((row) => row[0] === label);
      if (!found) throw new Error(`no record for ${label}: ${JSON.stringify(data)}`);
      return found;
    };
    const consoleRow = rowOf(LABEL_CONSOLE);
    const healthRow = rowOf(LABEL_HEALTH);
    // An absent 采集时刻 is an EMPTY cell in the file and 「—」 on screen — two honest faces,
    // neither one inventing a value for the other.
    expect(consoleRow[4]).toBe("");
    expect(textOf("sys8-asof-console")).toBe("—");
    expect(rowOf("Hermes 运行时探针")[4]).toBe("");
    // The state word is the same human sentence in both places.
    expect(consoleRow[2]).toBe(textOf("sys15-trunc-status-console"));
    // Elapsed is a bare number in the file, a 「N ms」 reading on screen.
    expect(consoleRow[3]).toMatch(/^\d+$/);
    expect(textOf("sys6-duration-console")).toBe(`${consoleRow[3]} ms`);
    // 采集时刻 is the UTC original in the file, the Beijing minute on screen.
    expect(healthRow[4]).toBe(HEALTH_ISO);
    expect(textOf("sys8-asof-health")).toBe("2026-11-19 23:17");
    expect(rowOf("域服务探针")[4]).toBe(DOMAIN_ISO);
    // The read stamp belongs to `sys-updated-at` only.
    const file = dl.content();
    expect(file).not.toContain("2031");
    expect(file).not.toContain("刷新完成于");
    expect(file).not.toMatch(/undefined|null|NaN|\[object/);
    expect(reads()).toBe(before + 4);
    dl.restore();
  });

  it("hands over nothing when the search empties the matrix, and never builds a file", async () => {
    const dl = captureDownload();
    window.history.replaceState({}, "", "/system?tab=health&q=zzz-none");
    await render();
    await waitFor(() => !!q("sys-search-source-empty"), "the empty-search block");
    const before = reads();
    const node = must<HTMLButtonElement>("sys7-export");
    expect(node.disabled).toBe(true);
    expect(node.getAttribute("title") ?? "").toContain("没有可导出");
    expect(textOf("sys7-export-count")).toBe("—");
    expect(textOf("sys-search-source-empty").length).toBeGreaterThan(0);

    await clickNode("sys7-export");
    expect(dl.urlSpy).not.toHaveBeenCalled();
    expect(dl.content()).toBe("");
    expect(dl.fileName()).toBe("");
    expect(reads()).toBe(before);
    dl.restore();
  });
});
