// @vitest-environment jsdom
/**
 * R159 — /system 读源矩阵：复制文本与屏上四态锚同源（纯测试，零产品码改动）。
 *
 * 现查既有用例（派工单要求的 `git grep` 预检）：
 * - `SourceMatrix.test.tsx` :157-189 钉住竖线复制的表头、行数、第一列顺序与 health/console 两行的
 *   片段；:443-473 钉住制表符复制的表头、行数、第一列顺序；:273 与 :503-525 钉住排序/搜索后的
 *   复制顺序——但两处都只比第一列，没有人逐格比对「路径/状态/耗时/采集时刻」。
 * - :129-133 钉住失败行的状态人话与 `sys6-rid-runtime` 的 8 位短码存在性；:400-413 钉住全失败时
 *   `sys7-export` 与 `sys10-copy` 的 disabled 与「没有可导出/复制」标题——未覆盖 `sys-matrix-copy`。
 * - R112 `system.refresh.test.tsx` :104-123 钉住 `sys-updated-at` ≠ 每个采集时刻单元格；没有人
 *   断言「复制出去的文本里不含刷新时刻」。
 * - R148 `system.matrix.test.tsx` :248-251 钉住矩阵 rid 复制按钮写入完整编号；R151 :259/:270/:341/:374
 *   钉住各相位 `sys6-rid-health` 的有无；R122/R92 的 `sys-row-copy-<i>` 属 sys3 服务表，另一个面。
 *
 * 本文件因此只补四个缺口：①逐格同源（两种格式）；②失败行复制出去的状态格不带 rid、也不带上游原文；
 * ③复制文本排除刷新时刻；④未接线行 / 搜索空集 / 整表阻塞时的可读句与「不出现 undefined」。
 *
 * 如实记录：派工单 ② 写的是「失败行复制的状态句带 rid 而屏上不显裸 id」，与产品相反——复制出去的
 * 状态格只有人话「失败」，rid 是屏上控件（`CopyRid`，完整编号只进 title）。本文件按产品实际断言，
 * 并在 DONE 里更正口径。
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
import { COPY_SCOPE_TEXT } from "./copyScope";
import { HealthPage } from "./HealthPage";
import { resetSourceMatrix } from "./sourceReads";

const HEADER = ["口径名", "路径", "状态", "耗时", "采集时刻"];
const BLOCKED_TITLE = "当前没有可导出/复制的可用读口行：读口未接入或读取失败";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const HEALTH_BODY = {
  schema: "console.health.sources.v1",
  ok: true,
  asOf: "2026-11-19T15:17:09Z",
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
  return Promise.resolve({ items: [], asOf: "2026-11-19T22:15:01.655Z" });
}

function q<T extends HTMLElement = HTMLElement>(testid: string): T | null {
  return container.querySelector<T>(`[data-testid='${testid}']`);
}

function textOf(testid: string): string {
  return q(testid)?.textContent?.trim() ?? "";
}

/** Prefer the trunc span, fall back to the cell — the copied text is compared to what is on screen. */
function textOr(primary: string, fallback: string): string {
  const node = q(primary) ?? q(fallback);
  return node?.textContent?.trim() ?? "";
}

function rowIds(): string[] {
  return [...container.querySelectorAll("[data-testid^='sys6-row-']")].map(
    (el) => (el.getAttribute("data-testid") ?? "").slice("sys6-row-".length),
  );
}

/** The five on-screen anchors of one matrix row, in the order both copy helpers emit them. */
function domCells(id: string): string[] {
  return [
    textOf(`sys6-name-${id}`),
    textOr(`sys15-trunc-path-${id}`, `sys6-path-${id}`),
    textOr(`sys15-trunc-status-${id}`, `sys6-status-${id}`),
    textOf(`sys6-duration-${id}`),
    textOf(`sys8-asof-${id}`),
  ];
}

function reads(): number {
  return api.fetchJSON.mock.calls.length;
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

type WriteSpy = ReturnType<typeof vi.fn>;

function armClipboard(): WriteSpy {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  return writeText;
}

async function render(): Promise<void> {
  await act(async () => {
    root.render(<HealthPage />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function mount(): Promise<void> {
  await render();
  await waitFor(() => !!q("sys6-toggle"), "matrix toggle");
  const toggle = q<HTMLButtonElement>("sys6-toggle");
  await act(async () => {
    toggle?.click();
  });
  await waitFor(() => rowIds().length === 4, "four matrix rows");
}

async function clickCopy(testid: string, write: WriteSpy): Promise<void> {
  const node = q<HTMLButtonElement>(testid);
  if (!node) throw new Error(`${testid} is not on screen`);
  const before = write.mock.calls.length;
  await act(async () => {
    node.click();
  });
  await waitFor(() => write.mock.calls.length > before, `${testid} reached the clipboard`);
}

async function clickForce(testid: string): Promise<void> {
  const node = q<HTMLButtonElement>(testid);
  if (!node) throw new Error(`${testid} is not on screen`);
  await act(async () => {
    node.click();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}

function lines(text: string, sep: string): string[][] {
  return text.trimEnd().split("\n").map((line) => line.split(sep));
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

describe("R159 — /system 读源矩阵复制与四态同源", () => {
  it("copies every cell of every row exactly as the matrix shows it, in pipe and in tab form", async () => {
    const write = armClipboard();
    await mount();
    const before = reads();

    await clickCopy("sys10-copy", write);
    await clickCopy("sys-matrix-copy", write);
    expect(write.mock.calls.length).toBe(2);

    // The row order is whatever the matrix renders — the guard compares each copied line to the
    // anchor of the row sitting at the same index, so a re-order may not silently re-label a cell.
    const ids = rowIds();
    expect([...ids].sort()).toEqual(["console", "domain", "health", "runtime"]);
    const [pipe, tab] = write.mock.calls.map((call) => String(call[0]));
    for (const [text, sep] of [
      [pipe, " | "],
      [tab, "\t"],
    ] as const) {
      const grid = lines(text, sep);
      expect(grid[0]).toEqual(HEADER);
      expect(grid.length).toBe(ids.length + 1);
      ids.forEach((id, index) => {
        // The whole point of the guard: one copied cell may not drift from its own on-screen anchor.
        expect(grid[index + 1]).toEqual(domCells(id));
      });
    }
    // The two formats differ only by separator — same cells, same order.
    expect(lines(pipe, " | ")).toEqual(lines(tab, "\t"));
    expect(reads()).toBe(before);
  });

  it("copies the failed row as the plain state word, with the request id staying on screen only", async () => {
    const write = armClipboard();
    await mount();
    const before = reads();

    await clickCopy("sys10-copy", write);
    await clickCopy("sys-matrix-copy", write);
    const [pipe, tab] = write.mock.calls.map((call) => String(call[0]));
    const ids = rowIds();
    const at = ids.indexOf("runtime") + 1;
    const pipeCells = lines(pipe, " | ")[at]!;
    const tabCells = lines(tab, "\t")[at]!;

    // 状态人话，逐字，且只有人话。
    expect(pipeCells[2]).toBe("失败");
    expect(tabCells[2]).toBe("失败");
    expect(pipeCells[2]).toBe(textOr("sys15-trunc-status-runtime", "sys6-status-runtime"));
    // Neither the rid, nor the raw upstream sentence, nor the reason span may ride along.
    const reason = textOf("sys15-trunc-reason-runtime");
    expect(reason.length).toBeGreaterThan(0);
    for (const text of [pipe, tab]) {
      expect(text).not.toContain("req-runtime-500");
      expect(text).not.toContain("upstream failed");
      expect(text).not.toContain("请求编号");
    }
    expect(pipeCells.join(" | ")).not.toContain(reason);

    // On screen the bare id is never shown: only the 8-char short code, full id in the title.
    const rowText = q("sys6-row-runtime")?.textContent ?? "";
    expect(rowText).toContain("req-runt");
    expect(rowText).not.toContain("req-runtime-500");
    expect(q("sys6-rid-runtime")?.getAttribute("title")).toBe("req-runtime-500");
    expect(q("sys6-rid-console")).toBeNull();
    expect(q("sys6-rid-health")).toBeNull();

    // The rest of the row still equals its own anchors, and the copy cost nothing.
    expect(pipeCells[4]).toBe(textOf("sys8-asof-runtime"));
    expect(pipeCells[4]).toBe("—");
    expect(reads()).toBe(before);
  });

  it("keeps the refresh moment out of the copied text while the data stamps stay put", async () => {
    vi.useFakeTimers({ now: new Date("2031-03-01T00:00:00Z"), toFake: ["Date"] });
    const write = armClipboard();
    await mount();

    await clickForce("sys-refresh");
    await waitFor(() => !!q("sys-updated-at"), "refresh stamp");
    await waitFor(() => rowIds().length === 4, "rows after the refresh batch");
    const stamp = textOf("sys-updated-at");
    expect(stamp).toContain("（读取时刻，不是数据时刻）");
    expect(stamp).toContain("2031");
    const before = reads();

    await clickCopy("sys10-copy", write);
    await clickCopy("sys-matrix-copy", write);
    const [pipe, tab] = write.mock.calls.map((call) => String(call[0]));
    for (const text of [pipe, tab]) {
      expect(text).not.toContain("2031");
      expect(text).not.toContain(stamp);
      expect(text).not.toContain("刷新完成于");
    }
    // Copied cells still equal the on-screen data stamps — the refresh moment overwrites nothing.
    for (const id of rowIds()) {
      expect(textOf(`sys8-asof-${id}`)).not.toBe(stamp);
    }
    const ids = rowIds();
    const grid = lines(pipe, " | ");
    ids.forEach((id, index) => {
      expect(grid[index + 1]).toEqual(domCells(id));
    });
    expect(textOf("sys8-asof-health")).toBe("2026-11-19 23:17");
    expect(textOf("sys8-asof-domain")).toBe("2026-11-20 06:15");
    expect(reads()).toBe(before);
  });

  it("copies the unwired leg as readable words and never as undefined or a fabricated value", async () => {
    const write = armClipboard();
    await mount();
    const before = reads();

    await clickCopy("sys10-copy", write);
    await clickCopy("sys-matrix-copy", write);
    const [pipe, tab] = write.mock.calls.map((call) => String(call[0]));
    for (const text of [pipe, tab]) {
      expect(text).not.toMatch(/undefined|null|NaN|\[object/);
      expect(text).not.toContain("0 项");
    }
    const cells = domCells("console");
    expect(cells[2]).toBe("读口未接入");
    expect(cells[4]).toBe("—");
    // A real measured duration, not a invented 0 and not a dash pretending to be unknown.
    expect(cells[3]).toMatch(/^\d+ ms$/);
    expect(pipe).toContain(` | ${cells[2]} | `);
    expect(tab).toContain(`\t${cells[2]}\t`);
    // The two healthy legs keep their own upstream stamps.
    expect(textOf("sys8-asof-health")).toBe("2026-11-19 23:17");
    expect(textOf("sys8-asof-domain")).toBe("2026-11-20 06:15");
    expect(textOf("sys10-copy-status")).toBe("已复制");
    expect(q("sys10-fallback")).toBeNull();
    expect(reads()).toBe(before);
  });

  it("refuses to copy an emptied search result with one readable sentence and no request", async () => {
    const write = armClipboard();
    window.history.replaceState({}, "", "/system?tab=health&q=zzz-none");
    await render();
    await waitFor(() => !!q("sys-search-source-empty"), "the empty-search block");
    const before = reads();

    for (const testid of ["sys10-copy", "sys-matrix-copy"]) {
      const node = q<HTMLButtonElement>(testid)!;
      expect(node.disabled).toBe(true);
      // Honest finding: `usableRows` is filtered from `searchedRows`, so an emptied search also
      // leaves zero usable legs — the product then speaks the blocked sentence, not a search-only
      // one. Asserted as-is; the sentence is readable and names the reason either way.
      const title = node.getAttribute("title") ?? "";
      expect(title).toContain(BLOCKED_TITLE);
      expect(title).toContain(COPY_SCOPE_TEXT);
    }
    expect(textOf("sys-search-source-empty").length).toBeGreaterThan(0);
    expect(textOf("sys7-export-count")).toBe("—");
    await clickForce("sys10-copy");
    await clickForce("sys-matrix-copy");
    expect(write).not.toHaveBeenCalled();
    expect(textOf("sys10-copy-status")).toBe("");
    expect(textOf("sys-matrix-copy-status")).toBe("");
    expect(q("sys10-fallback")).toBeNull();
    expect(q("sys-matrix-copy-fallback")).toBeNull();
    expect(reads()).toBe(before);
  });

  it("marks a matrix with no usable leg blocked for both copy controls and writes nothing", async () => {
    const write = armClipboard();
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url: unknown) => {
      throw new ApiError("upstream exploded", {
        status: 500,
        body: "",
        url: String(url),
        requestId: "req-blocked-500",
      });
    });
    await mount();
    const before = reads();

    expect(textOf("sys7-export-count")).toBe("—");
    for (const testid of ["sys10-copy", "sys-matrix-copy", "sys7-export"]) {
      const node = q<HTMLButtonElement>(testid)!;
      expect(node.disabled).toBe(true);
      expect(node.getAttribute("title") ?? "").toContain(BLOCKED_TITLE);
    }
    expect(q<HTMLButtonElement>("sys10-copy")?.getAttribute("title")).toContain(COPY_SCOPE_TEXT);

    await clickForce("sys10-copy");
    await clickForce("sys-matrix-copy");
    expect(write).not.toHaveBeenCalled();
    expect(textOf("sys10-copy-status")).toBe("");
    expect(textOf("sys-matrix-copy-status")).toBe("");
    // Every leg is honestly marked, and the failed rows carry their rid on screen without leaking it.
    expect([...rowIds()].sort()).toEqual(["console", "domain", "health", "runtime"]);
    for (const id of rowIds()) {
      expect(q(`sys6-row-${id}`)?.getAttribute("data-status")).toBe("failed");
    }
    expect(textOf("sys6-summary")).toBe("4 个读口 · 成功 0 · 失败 4 · 读口未接入 0");
    expect(q("sys6-row-runtime")?.textContent).not.toContain("req-blocked-500");
    expect(q("sys6-rid-runtime")?.getAttribute("title")).toBe("req-blocked-500");
    expect(reads()).toBe(before);
  });
});
