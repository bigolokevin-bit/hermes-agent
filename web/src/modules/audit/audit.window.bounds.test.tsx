// @vitest-environment jsdom
// R203 - 时间窗边界护栏：窗口说什么，请求就带什么，端点上的事件就算落在边界上也还在表体里。
// 钉的是现状：`windowBounds` 用 `from = now - hours`、`to = now`，`customBounds` 在
// 任一端不可解析或 `from >= to` 时返回 null ⇒ 倒置与非法日期都进入同一诚实状态
// 「不发请求」（不是把倒置当成一次空查询，也不是悄悄改回默认档）。页级锚与地址一字不动。
//
// 与既有用例不重复：
// - `audit.window.test.ts`（audU）钉的是纯函数每档 ISO 对与 span，不动页面；
// - `audit.window.guard.test.ts`（R155）钉服务端返回行的包含关系与「倒置不发出」；
// - `audit.filters.test.tsx`（R133）钉非法档与非法条数不改写地址；
// - `audit.paging.test.tsx`（R161）钉换档掉游标；`audit.export.test.tsx`（R141）钉导出同源。
// 这里补的缺口：粘贴进来的倒置区间与非法日期串的【页面】诚实状态（0 请求 + 提示 +
// 地址一字不动 + 导出两枚各自的原因），以及【端点上的事件仍算在窗内】这条现状。

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { beijingSeconds } from "@/modules/audit/model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTOR = "user:2f3a4b5c6d7e8f90";
const ACTION = "task.created";
const RESOURCE = "ap_1122334455667788";
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** A stated interval, because a quick window recomputes its bounds from the clock. */
const FROM = "2026-11-05T02:00:00Z";
const TO = "2026-11-19T02:00:00Z";

let root: Root | null = null;

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

/** Where the address actually is, so 「未改写」 is a claim about the router, not the window. */
function LocationProbe(): ReactNode {
  const location = useLocation();
  return <span data-testid="probe-location">{`${location.pathname}${location.search}`}</span>;
}

async function render(entry: string): Promise<void> {
  await act(async () => {
    if (root) act(() => root?.unmount());
  });
  root = null;
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <>
          <AuditEventsModulePage />
          <LocationProbe />
        </>
      </MemoryRouter>,
    );
  });
  await waitFor(() => document.querySelector(".animate-pulse") === null, "skeleton gone");
}

function node(testId: string): Element | null {
  return document.querySelector(`[data-testid='${testId}']`);
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number => urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}

function pairs(): string[] {
  const text = node("probe-location")?.textContent ?? "";
  const query = text.includes("?") ? text.slice(text.indexOf("?") + 1) : "";
  return [...new URLSearchParams(query)]
    .map(([key, value]) => `${key}=${value}`)
    .sort();
}

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    element.getAttribute("data-testid")!.replace("aud01-row-", ""),
  );

async function click(testId: string): Promise<void> {
  await clickNode(node(testId), testId);
}

async function clickNode(
  target: Element | null | undefined,
  label: string,
): Promise<void> {
  expect(target, label).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

/** Rows placed ON the requested bounds, so an endpoint claim is about real material. */
function rowsForBounds(from: string, to: string): Record<string, unknown>[] {
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  const mid = new Date(Math.round((fromMs + toMs) / 2)).toISOString();
  const ids = ["from", "mid", "to"];
  return [from, mid, to].map((instant, index) => ({
    eventId: `evt_wb_${ids[index]}_${fromMs}`,
    action: ACTION,
    occurredAt: instant,
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: `${RESOURCE.slice(0, 3)}1122334455667788` },
    requestId: `req-wb-${ids[index]}-${fromMs}`,
  }));
}

function answerByBounds(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      const found = rowsForBounds(FROM, TO)[1];
      return { audit: found };
    }
    const from = paramOf(target, "from") ?? FROM;
    const to = paramOf(target, "to") ?? TO;
    return { items: rowsForBounds(from, to), nextCursor: null };
  });
}

// ── the exported file, captured the way a browser hands it over ──────────────
const captured: { name: string; text: string; count: number } = { name: "", text: "", count: 0 };
const blobs = new Map<string, Blob>();

function captureDownloads(): void {
  captured.name = "";
  captured.text = "";
  captured.count = 0;
  blobs.clear();
  URL.createObjectURL = ((blob: Blob) => {
    const url = `blob:window-bounds-${blobs.size + 1}`;
    blobs.set(url, blob);
    return url;
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    if (!this.download) return;
    captured.name = this.download;
    captured.count += 1;
    const blob = blobs.get(this.href);
    if (blob) void blob.text().then((text) => (captured.text = text));
  });
}

/** Data lines only — BOM and the header row go, blank tail lines go. */
function dataLines(): string[] {
  return captured.text
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .filter((line) => line !== "")
    .slice(1);
}

async function exportFile(): Promise<{ name: string; lines: string[] }> {
  captured.text = "";
  await click("aud01-export");
  await waitFor(() => captured.text !== "", "the export was handed over");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  return { name: captured.name, lines: dataLines() };
}

function screenCount(): number {
  const digits = /(\d+)/.exec(node("aud5-export-count")?.textContent ?? "");
  return digits ? Number(digits[1]) : -1;
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  answerByBounds();
  captureDownloads();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R203 - the window the page asks with", () => {
  it("keeps every served event inside the bounds, and counts an event ON a bound", async () => {
    // A quick tier: the pair is exactly one week wide, and the rows on screen are the
    // rows that pair returned — the page adds no time filter of its own.
    await render(`/audit?window=7d&type=${ACTION}&actor=${encodeURIComponent(ACTOR)}`);
    const quick = lastListRead();
    const quickFrom = String(paramOf(quick, "from"));
    const quickTo = String(paramOf(quick, "to"));
    expect(Date.parse(quickTo) - Date.parse(quickFrom)).toBe(7 * DAY);
    const quickRows = paintedRows();
    expect(quickRows).toHaveLength(3);
    // The row that sits ON `from` is painted: an endpoint is inside the window.
    const onBound = rowsForBounds(quickFrom, quickTo)[0];
    expect(quickRows).toContain(onBound.eventId);
    expect(markTime(String(onBound.eventId))).toBe(beijingSeconds(quickFrom));
    // and every served instant is within the pair, both ends included
    for (const row of rowsForBounds(quickFrom, quickTo)) {
      const at = Date.parse(String(row.occurredAt));
      expect(at >= Date.parse(quickFrom) && at <= Date.parse(quickTo)).toBe(true);
    }

    // A stated interval: the same claim, with the bounds the address itself named.
    await render(`/audit?window=custom&from=${FROM}&to=${TO}&type=${ACTION}&limit=25`);
    const stated = lastListRead();
    // The address says the instant, the request says the same instant through the
    // module's one bounds helper — ISO with the milliseconds `toISOString` always writes.
    expect(paramOf(stated, "from")).toBe(new Date(FROM).toISOString());
    expect(paramOf(stated, "to")).toBe(new Date(TO).toISOString());
    expect(paintedRows()).toHaveLength(3);
    const ends = rowsForBounds(FROM, TO);
    expect(markTime(String(ends[0].eventId))).toBe(beijingSeconds(FROM));
    expect(markTime(String(ends[2].eventId))).toBe(beijingSeconds(TO));
    // the middle row is strictly between the two boundary readings
    const middle = String(markTime(String(ends[1].eventId)));
    expect(middle > String(beijingSeconds(FROM))).toBe(true);
    expect(middle < String(beijingSeconds(TO))).toBe(true);
  });

  it("refuses an inverted stated interval instead of asking: no request, same address, export off", async () => {
    // from later than to — pasted cold, never touched the 应用 button.
    const address = `/audit?window=custom&from=${TO}&to=${FROM}&type=${ACTION}`;
    await render(address);
    expect(listReads()).toBe(0);
    expect(urls()).toEqual([]);
    expect(paintedRows()).toEqual([]);
    // the page says so, in words, and does not call it an empty answer
    const hint = node("aud01-custom-hint")?.textContent ?? "";
    expect(hint).toContain("自定义时间窗还不完整");
    expect(hint).toContain("不会退化成全表扫描");
    for (const panel of ["aud01-empty", "aud01-loading", "aud01-error", "aud01-denied"]) {
      expect(node(panel), `${panel} must not paint while nothing is asked`).toBeNull();
    }
    // the address keeps what the person pasted, pair for pair
    expect(pairs()).toEqual(
      [
        `from=${TO}`,
        `to=${FROM}`,
        `type=${ACTION}`,
        "window=custom",
      ].sort(),
    );
    // the page is still the page
    for (const anchor of ["agent-v2-page-audit", "aud01-filters", "aud5-export-bar"]) {
      expect(node(anchor), anchor).not.toBeNull();
    }
    // and both exports are off with the reason that belongs to this state
    const csv = node("aud01-export") as HTMLButtonElement | null;
    expect(csv?.disabled, "the plain CSV export is off").toBe(true);
    expect(csv?.getAttribute("title")).toBe("自定义时间窗不完整，没有可导出的记录");
    const filtered = node("aud5-export") as HTMLButtonElement | null;
    expect(filtered?.disabled, "the filtered export is off").toBe(true);
    expect(filtered?.getAttribute("title")).toBe("当前筛选无事件可导出");
    // a click on a disabled export asks for nothing and hands over nothing
    const before = urls();
    await clickNode(csv, "aud01-export");
    expect(urls()).toEqual(before);
    expect(captured.count).toBe(0);
  });

  it("refuses a date that cannot be read the same way, and keeps the illegal text", async () => {
    await render(`/audit?window=custom&from=2026-13-40&to=${TO}&type=${ACTION}`);
    // no throw on the way here, and nothing asked on the way out
    expect(listReads()).toBe(0);
    expect(urls()).toEqual([]);
    const hint = node("aud01-custom-hint")?.textContent ?? "";
    expect(hint).toContain("自定义时间窗还不完整");
    // the address is not corrected, not cleared, not re-serialised
    expect(pairs()).toEqual(
      ["from=2026-13-40", `to=${TO}`, `type=${ACTION}`, "window=custom"].sort(),
    );
    for (const anchor of ["agent-v2-page-audit", "aud01-filters", "aud5-export-bar"]) {
      expect(node(anchor), anchor).not.toBeNull();
    }
    const csv = node("aud01-export") as HTMLButtonElement | null;
    expect(csv?.disabled).toBe(true);
    expect(csv?.getAttribute("title")).toBe("自定义时间窗不完整，没有可导出的记录");
    // a half-readable range is refused the same way: one side missing is not a question
    await render(`/audit?window=custom&from=${FROM}&to=${TO}`);
    await render(`/audit?window=custom&from=${FROM}&type=${ACTION}`);
    const partial = urls().filter((url) => url.startsWith("/agent-api/api/audit?"));
    expect(partial.length, "the readable pair was asked once, the half pair never").toBe(1);
    // once more the helper's own spelling, not the address's shorthand
    expect(paramOf(String(partial.at(-1)), "to")).toBe(new Date(TO).toISOString());
  });
});

describe("R203 - the window and the exported file", () => {
  it("keeps the file, the table and the count the same number after a tier change", async () => {
    await render(`/audit?window=custom&from=${FROM}&to=${TO}&type=${ACTION}&limit=25`);
    expect(listReads()).toBe(1);
    expect(screenCount()).toBe(paintedRows().length);

    // 换档 = 一个新问题：多一次列表读，地址回到那一档该有的形状
    await click("aud01-filter-window-30d");
    await waitFor(() => listReads() === 2, "the new tier was asked for");
    const switched = lastListRead();
    expect(paramOf(switched, "action")).toBe(ACTION);
    expect(paramOf(switched, "limit")).toBe("25");
    const switchedFrom = paramOf(switched, "from");
    const switchedTo = paramOf(switched, "to");
    expect(switchedFrom, "the new tier still asks a bounded pair").not.toBeNull();
    expect(switchedTo, "the new tier still asks a bounded pair").not.toBeNull();
    expect(String(switchedFrom)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Date.parse(String(switchedTo)) - Date.parse(String(switchedFrom))).toBe(30 * DAY);
    // 屏上计数跟着表体走，不是上一次的答案
    expect(screenCount()).toBe(paintedRows().length);

    // 导出：文件行数 == 表体行数 == 屏上计数，且这一步不再问任何东西
    const after = urls();
    const file = await exportFile();
    expect(file.lines).toHaveLength(paintedRows().length);
    expect(file.lines).toHaveLength(screenCount());
    expect(urls()).toEqual(after);
  });
});

/** The screen's own Beijing reading for one row's time cell. */
function markTime(eventId: string): string | null | undefined {
  return document.querySelector(`[data-testid='audJ-time-list-${eventId}']`)?.getAttribute(
    "data-audj-value",
  );
}
