// @vitest-environment jsdom
// R135 — /system 的 tab 与时间窗 URL 保参护栏（纯测试，零产品码改动）。
//
// 现查结论（写前 grep 证据，全部只读）：
// - `?window=` 的唯一读者是 `modules/audit/AuditEventsModulePage`（`filterWindowOf(params.get("window"))`），
//   health 模块没有 window 参也没有事件表；`?tab=` 的解析在 shell（`resolveTab` + `ConsoleModulePage`
//   的 `active = tabs.find(...) ?? tabs[0]`），本页测试只读 shell 行为、不改 shell。
// - `agent-v2-page-audit` 是审计事件页根节点的 testid（AuditEventsModulePage.tsx:1552）。
// - 既有用例已覆盖：`/audit?window=7d` 等 URL 快照、custom 区间应用/倒置拒绝、R39 历史记录、
//   五参深链还原（见 AuditEventsModulePage.test.tsx 1155-1260、1679、1730-1770）。
// - 本文件只补四个缺口：① `?tab=events&window=24h` 时「请求参数 == 屏上按下的窗」逐字；
//   ② 写 window 保 tab、一次改动恰好一条历史；③ 非法 `?tab=` 回落首个 tab 且不改写 URL、
//   非法 `?window=` 静默回落 DEFAULT_WINDOW 且不改写 URL、页级锚仍在；④ 同 URL 重挂请求逐字相等。
// - 派工单提到的 `sys-evt-copy-*` 本代不存在（R124 放弃：health 模块无事件表），无从破起，如实记录。

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { DEFAULT_WINDOW, filterWindowOf, windowBounds } from "@/modules/audit/window";
import { ConsoleModulePage } from "@/shell/console";
import { resolveTab } from "@/shell/routes";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  // Iteration-bounded on purpose: several cases here freeze `Date`, so a
  // wall-clock deadline read via Date.now() would never fire and the loop
  // would spin until vitest kills the test — leaving React's act queue dirty
  // and every later test in the file rendering nothing. 600 ticks × 5 ms of
  // real setTimeout is the same ~3 s budget, immune to the frozen clock.
  for (let i = 0; i < 600; i += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error(`waitFor: ${label} never became true`);
}

async function render(entry: string | string[], page: ReactNode): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<MemoryRouter initialEntries={Array.isArray(entry) ? entry : [entry]}>{page}</MemoryRouter>);
  });
}

function LocationProbe(): ReactNode {
  const loc = useLocation();
  return <span data-testid="probe-location">{`${loc.pathname}${loc.search}`}</span>;
}

/** R39 idiom: a Back button, so a test walks the router's own history. */
function BackProbe(): ReactNode {
  const navigate = useNavigate();
  return (
    <button type="button" data-testid="probe-back" onClick={() => navigate(-1)}>
      back
    </button>
  );
}
const locationText = (): string =>
  document.querySelector("[data-testid='probe-location']")?.textContent ?? "";

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): string[] => urls().filter((url) => url.startsWith("/agent-api/api/audit?"));
const skeleton = (): boolean => document.querySelector(".animate-pulse") !== null;

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
  ],
  nextCursor: null,
};

/** Frozen clock so windowBounds(now) is deterministic against the request. */
const NOW = new Date("2026-11-20T06:00:00.000Z");

function arm(): void {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(async () => EVENTS);
}

async function mountAudit(entry: string | string[]): Promise<void> {
  arm();
  await render(
    entry,
    <>
      <LocationProbe />
      <BackProbe />
      <AuditEventsModulePage />
    </>,
  );
  await waitFor(() => !skeleton(), "first page settled");
}

/** Which quick window is pressed on screen (aria-pressed is the state). */
const pressedWindow = (): string | null => {
  for (const key of ["24h", "7d", "30d", "custom"]) {
    const node = document.querySelector<HTMLButtonElement>(`[data-testid='aud01-filter-window-${key}']`);
    if (node?.getAttribute("aria-pressed") === "true") return key;
  }
  return null;
};

async function chooseWindow(key: string): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>(`[data-testid='aud01-filter-window-${key}']`);
  if (!button) throw new Error(`window button aud01-filter-window-${key} not found`);
  await act(async () => {
    button.click();
  });
}

/** The from/to pair the last list request carried, decoded off the wire. */
function requestedBounds(url: string): { from: string; to: string } {
  const params = new URLSearchParams(url.slice(url.indexOf("?") + 1));
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  return { from, to };
}

beforeEach(() => {
  arm();
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("R135 — /system tab 与时间窗的 URL 保参", () => {
  it("① restores the pressed window from ?tab=events&window=24h and asks exactly those bounds", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    const entry = "/system?tab=events&window=24h";
    await mountAudit(entry);

    expect(pressedWindow()).toBe("24h");
    const reads = listReads();
    expect(reads).toHaveLength(1);
    const expected = windowBounds("24h", NOW);
    expect(requestedBounds(reads[0]!)).toEqual(expected);

    // The address the person pasted is what the page keeps: mount writes nothing.
    expect(locationText()).toBe(entry);
    expect(document.querySelector("[data-testid='agent-v2-page-audit']")).not.toBeNull();
  });

  it("② writing the window preserves tab byte-for-byte and replaces instead of pushing", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    // Two entries: the address before the paste, then the pasted one. A filter
    // write that pushed would land between them, so one Back would stop at
    // window=24h; the product replaces, so Back skips the write entirely.
    await mountAudit(["/system?tab=events", "/system?tab=events&window=24h"]);
    const before = listReads().length;

    await chooseWindow("7d");
    // The guard is 「a change re-asks」, not a literal +1: the page re-runs its
    // read per committed filter state, and a cursor reset committed beside the
    // window change would legitimately ask twice. Pin the last read instead.
    await waitFor(() => listReads().length > before, "a read for the new window");

    const params = new URLSearchParams(locationText().slice(locationText().indexOf("?") + 1));
    expect(Object.fromEntries(params)).toEqual({ tab: "events", window: "7d" });
    expect(pressedWindow()).toBe("7d");
    expect(requestedBounds(listReads()[listReads().length - 1]!)).toEqual(windowBounds("7d", NOW));

    // R39's push contract belongs to records (:1025), not to filter writes —
    // every other setParams in the page carries `replace: true`.
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='probe-back']")!.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    await waitFor(() => locationText() === "/system?tab=events", "back skips the replaced window write");
    expect(new URLSearchParams(locationText().slice(locationText().indexOf("?") + 1)).get("window")).toBeNull();
  });

  it("②b switching tabs keeps the window param byte-for-byte", async () => {
    const entry = "/system?tab=health&window=24h";
    await render(
      entry,
      <>
        <LocationProbe />
        <ConsoleModulePage module="system" />
      </>,
    );
    const tab = document.querySelector<HTMLAnchorElement>('[role="tab"][data-tab="events"]');
    expect(tab).not.toBeNull();
    await act(async () => {
      tab!.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    const params = new URLSearchParams(locationText().slice(locationText().indexOf("?") + 1));
    expect(params.get("tab")).toBe("events");
    expect(params.get("window")).toBe("24h");
  });

  it("③ an unknown ?tab= resolves to the first system pane and rewrites nothing", async () => {
    // The resolver itself: unmatched values pass through, and the console's
    // `active = tabs.find(...) ?? tabs[0]` fold means the FIRST tab renders.
    expect(resolveTab("system", "__nope__")).toEqual({ tab: "__nope__", view: "" });
    expect(resolveTab("system", "retention")).toEqual({ tab: "events", view: "" });

    // Mount the real shell page (read-only usage; no shell file is edited): the
    // fallback must land on 系统健康, the first declared system tab, and the
    // address must stand verbatim — the shell reads ?tab= but never writes it.
    const entry = "/system?tab=__nope__";
    await render(
      entry,
      <>
        <LocationProbe />
        <ConsoleModulePage module="system" />
      </>,
    );
    expect(document.querySelector(".pane")?.getAttribute("data-tabname")).toBe("系统健康");
    expect(locationText()).toBe(entry);
  });

  it("③b an unknown ?window= silently falls back to the default and rewrites nothing", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    expect(filterWindowOf("__nope__")).toBe(DEFAULT_WINDOW);
    const entry = "/system?tab=events&window=__nope__";
    await mountAudit(entry);

    expect(pressedWindow()).toBe(DEFAULT_WINDOW);
    const reads = listReads();
    expect(reads).toHaveLength(1);
    expect(requestedBounds(reads[0]!)).toEqual(windowBounds(DEFAULT_WINDOW, NOW));
    // No silent URL rewrite: the pasted address stands verbatim, invalid token included.
    expect(locationText()).toBe(entry);
    expect(document.querySelector("[data-testid='agent-v2-page-audit']")).not.toBeNull();
  });

  it("④ re-mounting the same URL asks the same questions, same count, same order", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    const entry = "/system?tab=events&window=24h";
    await mountAudit(entry);
    const first = listReads();
    expect(first.length).toBeGreaterThan(0);

    // Re-mount WITHOUT resetting the spy: the second batch must replay the first.
    await render(
      entry,
      <>
        <LocationProbe />
        <AuditEventsModulePage />
      </>,
    );
    await waitFor(() => !skeleton(), "second mount settled");
    const all = listReads();
    const second = all.slice(first.length);
    expect(second).toEqual(first);
    const countOf = (list: string[]): number => list.length;
    expect(countOf(second)).toBe(countOf(first));
    expect(locationText()).toBe(entry);
  });
});
