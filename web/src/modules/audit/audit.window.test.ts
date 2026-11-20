// @vitest-environment jsdom
/**
 * audU — the guards between the window this panel shows and the request it sends.
 *
 * The window is the one filter that is ALWAYS on the wire: `/api/audit` is gated
 * `require_any` over runId/taskId/actorId/resourceId/action/from/to, so a read
 * that carries nothing answers 400 `console.missing_filter` (live-probed on the
 * dev console). That makes five things worth pinning in one file, and each of
 * them is a sentence the panel already claims out loud:
 *
 * ① every tier maps to one real pair of instants (pasted ISO literals), and the
 *   tier table has one meaning — the bar, the chips, the summary line and the
 *   request all read the same `windowBounds`/`customBounds`;
 * ② 全部时间 does not exist here, so a filter-free scan is never sent: every
 *   list read carries both `from` and `to`;
 * ③ switching tiers re-asks exactly once and clears nothing the person did not
 *   touch (action / operator / resource / size stay on the address and the wire);
 * ④ the cursor stack and the open fold drop COMPLETELY on a tier change — page
 *   1 with no half-kept fold, never a stale page of the old window;
 * ⑤ an incomplete or inverted range asks NOTHING and says so in readable words
 *   (the audB sentence at draft time, the audR hint for a pasted address), so a
 *   half-typed window cannot degrade into a full-table scan.
 *
 * Existing coverage this file deliberately does not duplicate: `window.test.ts`
 * 「the audit window (R34)」, and in `AuditEventsModulePage.test.tsx` "asks the
 * real route, /api/ segment included, with the window it shows", "a wider time
 * window means a wider pair of instants on the wire", "every window keeps a
 * bounded pair on the wire — the service 400s a filter-free scan", R34 "keeps a
 * custom window in the address and asks exactly that span", "asks nothing while
 * a custom window is half filled, and says what is missing", "switching window,
 * type, operator or page asks exactly once each", the audB and audL describes.
 *
 * No fake timers anywhere in this module, so ① pins literals by handing
 * `windowBounds` an explicit clock; the page-level guards assert arithmetic
 * (the span equals the tier's hours) instead of wall-clock values.
 */
import { act, createElement as h, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { NO_FILTERS, listUrl } from "@/modules/audit/api";
import {
  DEFAULT_WINDOW,
  FILTER_WINDOW_CHOICES,
  WINDOW_CHOICES,
  customBounds,
  filterWindowOf,
  windowBounds,
  type WindowKey,
} from "@/modules/audit/window";

const EVENTS = {
  items: [
    {
      eventId: "evt_7c1f2a3b4d5e6f70",
      event_type: "approval_approved",
      occurredAt: "2026-11-19T01:20:00Z",
      outcome: "succeeded",
      actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" },
      resource: { type: "approval", id: "ap_1122334455667788" },
      requestId: "req-20261119-0a7b3c",
    },
    {
      event_id: "evt_8d2e3f4051627384",
      action: "run.failed",
      at: "2026-11-19T02:05:00Z",
      result: "error",
      actor_id: "employee:9f8e7d6c5b4a3f21",
      error: { code: "runtime.timeout", messageRedacted: "运行超时，被系统中止" },
    },
  ],
  nextCursor: "cur_page2",
};

const HOUR = 3_600_000;
const ISO_SHAPE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const QUICK_KEYS = WINDOW_CHOICES.map((choice) => choice.value);

function LocationProbe(): ReactNode {
  const location = useLocation();
  return h("span", { "data-testid": "probe-location" }, `${location.pathname}${location.search}`);
}

let root: Root | null = null;

async function waitFor(condition: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 3000;
  for (;;) {
    if (condition()) return;
    if (Date.now() > deadline) throw new Error(`等待超时：${label}`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

function urls(): string[] {
  return api.fetchJSON.mock.calls.map((call) => String(call[0]));
}

/** Only the list reads: the detail and verify routes are other people's traffic. */
function listReads(): string[] {
  return urls().filter((url) => url.startsWith("/agent-api/api/audit?"));
}

function lastListRead(): string {
  const reads = listReads();
  if (reads.length === 0) throw new Error("没有任何列表取数");
  return reads[reads.length - 1] as string;
}

function spanOf(url: string): number {
  const from = Date.parse(decodeURIComponent(/from=([^&]*)/.exec(url)?.[1] ?? ""));
  const to = Date.parse(decodeURIComponent(/to=([^&]*)/.exec(url)?.[1] ?? ""));
  return to - from;
}

function paramOf(url: string, key: string): string | null {
  const raw = new RegExp(`[?&]${key}=([^&]*)`).exec(url)?.[1];
  return raw === undefined ? null : decodeURIComponent(raw);
}

function text(): string {
  return document.body.textContent ?? "";
}

function present(testId: string): boolean {
  return document.querySelector(`[data-testid='${testId}']`) !== null;
}

function elementOf(testId: string): Element | null {
  return document.querySelector(`[data-testid='${testId}']`);
}

function render(entry: string, page: ReactNode): void {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root?.render(h(MemoryRouter, { initialEntries: [entry] }, page)));
}

function answer(page: unknown, detail: unknown = { audit: {} }): void {
  api.fetchJSON.mockImplementation(async (url: string) =>
    String(url).startsWith("/agent-api/api/audit-detail") ? detail : page,
  );
}

async function mountProbed(entry: string): Promise<void> {
  api.fetchJSON.mockReset();
  answer(EVENTS);
  render(entry, h("div", null, h(AuditEventsModulePage, {}), h(LocationProbe)));
  await waitFor(() => listReads().length > 0 && !present("aud01-loading"), `挂载 ${entry}`);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
}

function pressedWindow(): string | null {
  for (const key of [...QUICK_KEYS, "custom"]) {
    if (elementOf(`aud01-filter-window-${key}`)?.getAttribute("aria-pressed") === "true") return key;
  }
  return null;
}

async function chooseWindow(key: string): Promise<void> {
  await act(async () => {
    elementOf(`aud01-filter-window-${key}`)?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
}

async function clickInside(testId: string): Promise<void> {
  const target = testId.includes(" ")
    ? document.querySelector(testId)
    : elementOf(testId);
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
}

async function typeInto(testId: string, value: string): Promise<void> {
  const input = elementOf(testId) as HTMLInputElement | null;
  if (!input) throw new Error(`没有输入框 ${testId}`);
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setValue?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function locationText(): string {
  return elementOf("probe-location")?.textContent ?? "";
}

beforeEach(() => {
  api.fetchJSON.mockReset();
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

describe("audU - ① each window tier is one fixed pair of instants, from one table", () => {
  // ① the literals, pinned by handing the builder an explicit clock.
  it("pastes the exact from/to pair each quick tier sends", () => {
    const FIXED_NOW = new Date("2026-11-20T05:06:41.143Z");
    const PAIRS: Record<WindowKey, { from: string; to: string }> = {
      "24h": { from: "2026-11-19T05:06:41.143Z", to: "2026-11-20T05:06:41.143Z" },
      "7d": { from: "2026-11-13T05:06:41.143Z", to: "2026-11-20T05:06:41.143Z" },
      "30d": { from: "2026-10-21T05:06:41.143Z", to: "2026-11-20T05:06:41.143Z" },
    };
    for (const choice of WINDOW_CHOICES) {
      const bounds = windowBounds(choice.value, FIXED_NOW);
      expect(bounds).toEqual(PAIRS[choice.value]);
      expect(bounds.from).toMatch(ISO_SHAPE);
      expect(bounds.to).toMatch(ISO_SHAPE);
      // The pair is the tier's own hours, never a rounding of them.
      expect(Date.parse(bounds.to) - Date.parse(bounds.from)).toBe(choice.hours * HOUR);
    }
  });

  it("has one meaning per tier: one table, one default, three distinct spans", () => {
    // The bar's choices ARE the request's choices — no second tier list to drift.
    expect(FILTER_WINDOW_CHOICES.map((choice) => choice.value)).toEqual([...QUICK_KEYS, "custom"]);
    expect(FILTER_WINDOW_CHOICES.filter((choice) => choice.value !== "custom")).toEqual(
      WINDOW_CHOICES.map((choice) => ({ value: choice.value, label: choice.label })),
    );
    expect(QUICK_KEYS).toHaveLength(3);
    expect(QUICK_KEYS).not.toContain("all");
    expect(QUICK_KEYS).not.toContain("全部");
    expect(DEFAULT_WINDOW).toBe("7d");
    expect(QUICK_KEYS).toContain(DEFAULT_WINDOW);
    // 一档两义: three tiers, three different spans, and the same tier twice.
    const spans = new Set(
      WINDOW_CHOICES.map((choice) => {
        const bounds = windowBounds(choice.value);
        return Date.parse(bounds.to) - Date.parse(bounds.from);
      }),
    );
    expect(spans.size).toBe(3);
    expect(windowBounds(DEFAULT_WINDOW)).toEqual(windowBounds("7d"));
    // Whatever the address says, the resolved key is in the table, so a bounded
    // pair always exists (the only key that may lack one is custom, and that is
    // ⑤'s job to refuse).
    for (const raw of ["", "14d", "ALL", "24h", "7d", "30d", "custom", "0", "-1"]) {
      expect([...QUICK_KEYS, "custom"]).toContain(filterWindowOf(raw));
    }
    expect(filterWindowOf("14d")).toBe(DEFAULT_WINDOW);
    expect(filterWindowOf("")).toBe(DEFAULT_WINDOW);
  });

  it("reads a custom pair from Beijing wall clock and refuses an impossible one", () => {
    const bounds = customBounds("2026-11-01T08:00", "2026-11-02T08:00");
    expect(bounds).toEqual({ from: "2026-11-01T00:00:00.000Z", to: "2026-11-02T00:00:00.000Z" });
    // An absolute instant is taken as written, not shifted a second time.
    expect(customBounds("2026-11-01T00:00:00Z", "2026-11-02T00:00:00Z")).toEqual({
      from: "2026-11-01T00:00:00.000Z",
      to: "2026-11-02T00:00:00.000Z",
    });
    expect(customBounds(null, "2026-11-02T08:00")).toBeNull();
    expect(customBounds("2026-11-01T08:00", "")).toBeNull();
    expect(customBounds("2026-11-05T08:00", "2026-11-02T08:00")).toBeNull();
    expect(customBounds("2026-11-01T08:00", "2026-11-01T08:00")).toBeNull();
    expect(customBounds("昨天", "今天")).toBeNull();
  });
});

describe("audU - ② 全部时间 does not exist, so a filter-free scan is never sent", () => {
  it("the param-free URL this panel could build is the scan the service refuses", () => {
    const scan = listUrl(null, NO_FILTERS);
    expect(scan).not.toContain("from=");
    expect(scan).not.toContain("to=");
    expect(scan).not.toContain("action=");
    expect(scan).not.toContain("actorId=");
    expect(scan).not.toContain("resourceId=");
    // The shape a window read must instead carry: both ends, in that order.
    const bounded = listUrl(null, { ...NO_FILTERS, from: "2026-11-19T05:06:41.143Z", to: "2026-11-20T05:06:41.143Z" });
    expect(bounded).toContain("&from=2026-11-19T05%3A06%3A41.143Z&to=2026-11-20T05%3A06%3A41.143Z");
  });

  it("every list read the panel makes carries both ends of the window", async () => {
    for (const entry of [
      "/audit",
      "/audit?window=24h",
      "/audit?window=30d",
      "/audit?window=7d&type=run.failed",
      "/audit?window=custom&from=2026-11-01T08:00&to=2026-11-02T08:00",
      "/audit?window=14d",
    ]) {
      await mountProbed(entry);
      const reads = listReads();
      expect(reads.length).toBeGreaterThan(0);
      for (const url of reads) {
        expect(url).toMatch(/[?&]from=/);
        expect(url).toMatch(/[?&]to=/);
        expect(paramOf(url, "from")).toMatch(ISO_SHAPE);
        expect(paramOf(url, "to")).toMatch(ISO_SHAPE);
        expect(url).not.toBe(listUrl(null, NO_FILTERS));
      }
    }
  });

  it("a half-filled custom window sends nothing at all", async () => {
    await mountProbed("/audit?window=24h");
    expect(listReads()).toHaveLength(1);
    await chooseWindow("custom");
    // No bounds yet: the page refuses to ask rather than degrade to a scan.
    expect(listReads()).toHaveLength(1);
    expect(present("aud01-custom-hint")).toBe(true);
    expect(text()).toContain("不会退化成全表扫描");
  });
});

describe("audU - ③ changing the tier re-asks once and clears nothing else", () => {
  const MULTIPLE =
    "/audit?window=24h&type=run.failed&actor=user%3A2f3a4b5c6d7e8f90&resource=ap_1122334455667788&limit=100";

  it("each tier switch is exactly one read and keeps action, operator, resource and size", async () => {
    await mountProbed(MULTIPLE);
    const first = lastListRead();
    expect(paramOf(first, "action")).toBe("run.failed");
    expect(paramOf(first, "actorId")).toBe("user:2f3a4b5c6d7e8f90");
    expect(paramOf(first, "resourceId")).toBe("ap_1122334455667788");
    expect(paramOf(first, "limit")).toBe("100");
    expect(spanOf(first)).toBe(24 * HOUR);

    for (const [key, hours] of [
      ["30d", 30 * 24],
      ["7d", 7 * 24],
      ["24h", 24],
    ] as [string, number][]) {
      const before = listReads().length;
      await chooseWindow(key);
      expect(listReads()).toHaveLength(before + 1);
      const url = lastListRead();
      expect(spanOf(url)).toBe(hours * HOUR);
      expect(paramOf(url, "action")).toBe("run.failed");
      expect(paramOf(url, "actorId")).toBe("user:2f3a4b5c6d7e8f90");
      expect(paramOf(url, "resourceId")).toBe("ap_1122334455667788");
      expect(paramOf(url, "limit")).toBe("100");
      expect(pressedWindow()).toBe(key);
      expect(locationText()).toContain(`window=${key}`);
    }
  });

  it("the window chip removes the tier only, and the tier chip words match the bar", async () => {
    await mountProbed(MULTIPLE);
    expect(present("aud-filter-chips")).toBe(true);
    expect(elementOf("aud-chip-window")?.textContent?.replace("×", "").trim()).toBe("时间窗：最近 24 小时");
    const before = listReads().length;
    await clickInside("aud-chip-window-clear");
    expect(listReads()).toHaveLength(before + 1);
    const url = lastListRead();
    // Gone from the address, back to the default tier on the wire, nothing else lost.
    expect(paramOf(url, "from")).toMatch(ISO_SHAPE);
    expect(spanOf(url)).toBe(7 * 24 * HOUR);
    expect(paramOf(url, "action")).toBe("run.failed");
    expect(paramOf(url, "actorId")).toBe("user:2f3a4b5c6d7e8f90");
    expect(paramOf(url, "limit")).toBe("100");
    expect(locationText()).not.toContain("window=");
    expect(present("aud-chip-window")).toBe(false);
  });

  it("a custom tier asks once only when it is applied, and the presets share the setter", async () => {
    await mountProbed("/audit?window=24h&type=run.failed");
    const afterMount = listReads().length;

    await chooseWindow("custom");
    expect(listReads()).toHaveLength(afterMount); // applied ≠ chosen: nothing asked yet

    await typeInto("aud01-custom-from", "2026-11-05T10:00");
    await typeInto("aud01-custom-to", "2026-11-07T10:00");
    expect(elementOf("audB-apply")?.getAttribute("aria-disabled")).toBe("false");
    await clickInside("audB-apply");
    expect(listReads()).toHaveLength(afterMount + 1);
    expect(spanOf(lastListRead())).toBe(2 * 24 * HOUR);
    expect(paramOf(lastListRead(), "action")).toBe("run.failed");
    expect(pressedWindow()).toBe("custom");

    // The audL presets are the same three tiers, not a fourth way to ask.
    const beforePreset = listReads().length;
    await clickInside("audB-preset-7d");
    expect(listReads()).toHaveLength(beforePreset + 1);
    expect(spanOf(lastListRead())).toBe(7 * 24 * HOUR);
    expect(pressedWindow()).toBe("7d");
    expect(present("aud01-custom-window")).toBe(false);
    expect(locationText()).not.toContain("from=");
  });
});

describe("audU - ④ a tier change drops paging and folds completely", () => {
  it("page 3 with an open fold lands on page 1 with no fold, in one read", async () => {
    await mountProbed("/audit?window=30d&cursor=cur_page1&cursor=cur_page2&type=run.failed");
    expect(elementOf("aud2-page")?.textContent).toContain("第 3 页");
    expect(present("aud-chip-page")).toBe(true);

    await clickInside("aud6-toggle-evt_7c1f2a3b4d5e6f70");
    expect(present("aud6-preview-evt_7c1f2a3b4d5e6f70")).toBe(true);
    expect(locationText()).toContain("preview=");

    const before = listReads().length;
    await chooseWindow("24h");
    expect(listReads()).toHaveLength(before + 1);
    // 全清，不半生效: page 1, no cursor on the address, no leftover fold.
    expect(elementOf("aud2-page")?.textContent).toContain("第 1 页");
    expect(present("aud6-preview-evt_7c1f2a3b4d5e6f70")).toBe(false);
    expect(locationText()).not.toContain("cursor=");
    expect(locationText()).not.toContain("preview=");
    expect(locationText()).toContain("window=24h");
    expect(locationText()).toContain("type=run.failed");
    expect(present("aud-chip-page")).toBe(false);
    expect(spanOf(lastListRead())).toBe(24 * HOUR);
    expect(paramOf(lastListRead(), "cursor")).toBeNull();
  });
});

describe("audU - ⑤ an impossible range asks nothing and says why", () => {
  it("an inverted draft range cannot be applied", async () => {
    await mountProbed("/audit?window=24h");
    const before = listReads().length;

    await chooseWindow("custom");
    await typeInto("aud01-custom-from", "2026-11-05T10:00");
    await typeInto("aud01-custom-to", "2026-11-03T10:00");

    expect(elementOf("audB-range-error")?.textContent).toContain("开始时间不能晚于结束时间");
    expect(elementOf("audB-apply")?.getAttribute("aria-disabled")).toBe("true");
    await clickInside("audB-apply");
    expect(listReads()).toHaveLength(before); // 零请求
    expect(present("aud01-custom-hint")).toBe(true);

    // Fixing the two ends is what unlocks the read — exactly one.
    await typeInto("aud01-custom-to", "2026-11-07T10:00");
    expect(present("audB-range-error")).toBe(false);
    await clickInside("audB-apply");
    expect(listReads()).toHaveLength(before + 1);
    expect(spanOf(lastListRead())).toBe(2 * 24 * HOUR);
    expect(paramOf(lastListRead(), "from")).toBe("2026-11-05T02:00:00.000Z");
    expect(paramOf(lastListRead(), "to")).toBe("2026-11-07T02:00:00.000Z");
  });

  it("an inverted range pasted into the address asks nothing and never scans", async () => {
    api.fetchJSON.mockReset();
    answer(EVENTS);
    render(
      "/audit?window=custom&from=2026-11-05T10%3A00&to=2026-11-03T10%3A00",
      h("div", null, h(AuditEventsModulePage, {}), h(LocationProbe)),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });

    expect(listReads()).toHaveLength(0);
    expect(urls()).toHaveLength(0);
    expect(present("aud01-custom-hint")).toBe(true);
    expect(text()).toContain("不会退化成全表扫描");
    expect(elementOf("aud01-custom-error")?.textContent).toContain("开始早于结束");
    // No list state to show off, so no table chrome claims one either.
    for (const panel of ["aud01-loading", "aud01-denied", "aud01-error", "aud01-empty"]) {
      expect(present(panel)).toBe(false);
    }
    expect(present("aud-filter-chips")).toBe(true);
    expect(present("aud-chip-from-to")).toBe(true);
  });
});
