// @vitest-environment jsdom
// R133 — 筛选参数的地址保真护栏（纯测试，产品码零改动）。
//
// What is NEW here, and what the suite already owns (checked with git grep before writing):
//  · 地址回填与上线参数一一对应，散在 AuditEventsModulePage.test.tsx:1784（自定义区间 + 类型/操作者/资源/分页）
//    与 :1339（复合冷挂）里，但没有一条把「七项同挂」的地址值与请求值逐字比过；
//  · :1258 pins 换窗丢游标回第 1 页，但没有断言其余参数一字不动；
//  · :2358/:2400 pin 非法 limit 的提示与「不发出去」，但没有断言地址不被改写、页级锚仍在；
//  · :1195 重挂同一地址核对控件值，但没有断言两次挂载的请求串逐字相等；
//  · 导出条数与行数同源在 :1382/:3136/:3180 各自场景里 pin 过，但没有一条把它和「同一地址重挂」放在一起；
//  · audit.deeplink.test.tsx (R113) 只管 event 这一个键的增删；这里管 event 与筛选共存时开详情后的整体保参。
//
// 每条护栏只读屏幕与 mock 的请求串，不产生任何额外请求。

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { beijingInputValue, customBounds } from "@/modules/audit/window";
import { PAGE_LIMIT } from "@/modules/audit/api";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

/** Where the page put the address, so the guards can compare it pair for pair. */
function LocationProbe(): ReactNode {
  const location = useLocation();
  return <span data-testid="probe-location">{`${location.pathname}${location.search}`}</span>;
}

async function render(entry: string): Promise<void> {
  await act(async () => {
    if (root) act(() => root?.unmount());
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <AuditEventsModulePage />
        <LocationProbe />
      </MemoryRouter>,
    );
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), "skeleton gone");
}

beforeEach(() => {
  api.fetchJSON.mockReset();
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number => urls().filter((url) => /^\/agent-api\/api\/audit\?/.test(url)).length;
const detailReads = (): number => urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => /^\/agent-api\/api\/audit\?/.test(url)) ?? "";

/** The address as a sorted, decoded pair set — repeats included, because cursor repeats. */
function pairs(): string[] {
  const text = document.querySelector("[data-testid='probe-location']")?.textContent ?? "";
  const query = text.includes("?") ? text.slice(text.indexOf("?") + 1) : "";
  return [...new URLSearchParams(query)]
    .map(([key, value]) => `${key}=${value}`)
    .sort();
}

/** One decoded query parameter of a request URL, or null when it is absent. */
function paramOf(url: string, key: string): string | null {
  const query = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  const found = new URLSearchParams(query).get(key);
  return found;
}

const valueOf = (testId: string): string | null =>
  (document.querySelector(`[data-testid='${testId}']`) as HTMLInputElement | HTMLSelectElement | null)?.value ?? null;
const textOf = (testId: string): string | null =>
  document.querySelector(`[data-testid='${testId}']`)?.textContent ?? null;
const pressed = (): string | null => {
  for (const key of ["24h", "7d", "30d", "custom"]) {
    if (document.querySelector(`[data-testid='aud01-filter-window-${key}']`)?.getAttribute("aria-pressed") === "true") {
      return key;
    }
  }
  return null;
};

const ID = "evt_present_00000001";
const FROM = "2026-11-05T02:00:00Z";
const TO = "2026-11-07T02:00:00Z";
const ACTOR = "user:2f3a4b5c6d7e8f90";
const RESOURCE = "ap_1122334455667788";

const ROWS = {
  items: [
    {
      eventId: ID,
      action: "task.created",
      occurredAt: "2026-11-05T03:00:00Z",
      outcome: "succeeded",
      actor: { type: "human", id: ACTOR, displayName: "李思" },
      resource: { type: "approval", id: RESOURCE },
      requestId: "req-20261105-0a7b3c",
    },
    {
      eventId: "evt_second_0000000002",
      action: "run.failed",
      occurredAt: "2026-11-06T03:00:00Z",
      outcome: "error",
      actor_id: "employee:9f8e7d6c5b4a3f21",
      at: "2026-11-06T03:00:00Z",
    },
  ],
  nextCursor: "cur_page2",
};

function answer(body: unknown = ROWS): void {
  api.fetchJSON.mockImplementation(async (url) =>
    String(url).startsWith("/agent-api/api/audit-detail") ? { audit: body.items[0] } : { items: body.items, nextCursor: body.nextCursor },
  );
}

async function click(testId: string): Promise<void> {
  const node = document.querySelector(`[data-testid='${testId}']`) as HTMLElement | null;
  await act(async () => {
    node?.click();
  });
}

/** The seven filter keys written the way the page reads them. */
const SEVEN =
  `?window=custom&from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}` +
  `&type=task.created&actor=${encodeURIComponent(ACTOR)}&resource=${encodeURIComponent(RESOURCE)}&limit=25`;

describe("R133 - a pasted filter set fills every control and goes out verbatim", () => {
  it("fills the controls with what the address says, in the control's own words", async () => {
    answer();
    await render(`/audit${SEVEN}`);
    expect(pressed()).toBe("custom");
    // the two instants come back as Beijing wall clock, which is what the control speaks
    expect(valueOf("aud01-custom-from")).toBe(beijingInputValue(FROM));
    expect(valueOf("aud01-custom-to")).toBe(beijingInputValue(TO));
    expect(valueOf("aud01-filter-type")).toBe("task.created");
    expect(valueOf("aud01-filter-operator")).toBe(ACTOR);
    expect(valueOf("aud8-filter-resource")).toBe(RESOURCE);
    expect(valueOf("audH-page-size")).toBe("25");
    // and the address itself was not rewritten by opening it
    expect(pairs()).toEqual(
      [
        "from=2026-11-05T02:00:00Z",
        "limit=25",
        "resource=ap_1122334455667788",
        "actor=user:2f3a4b5c6d7e8f90",
        "to=2026-11-07T02:00:00Z",
        "type=task.created",
        "window=custom",
      ].sort(),
    );
  });

  it("asks the route with the same values, built by the same single source", async () => {
    answer();
    await render(`/audit${SEVEN}`);
    expect(listReads()).toBe(1);
    const url = lastListRead();
    expect(paramOf(url, "limit")).toBe("25");
    expect(paramOf(url, "action")).toBe("task.created");
    expect(paramOf(url, "actorId")).toBe(ACTOR);
    expect(paramOf(url, "resourceId")).toBe(RESOURCE);
    // the pair on the wire is exactly what the module's own builder makes from the address —
    // no second arithmetic that could round, shift or drop one end
    const bounds = customBounds(FROM, TO);
    expect(paramOf(url, "from")).toBe(bounds?.from);
    expect(paramOf(url, "to")).toBe(bounds?.to);
    expect(paramOf(url, "cursor")).toBeNull();
  });
});

describe("R133 - changing only the window changes only the window", () => {
  it("keeps every other parameter byte for byte and lands back on page 1", async () => {
    answer();
    await render(
      `/audit?window=24h&type=task.created&actor=${encodeURIComponent(ACTOR)}&limit=100&cursor=cur_page1`,
    );
    expect(textOf("aud2-page")).toContain("第 2 页");
    const before = listReads();
    await click("aud01-filter-window-30d");
    await waitFor(() => listReads() > before, "the wider window was asked");
    expect(listReads()).toBe(before + 1);
    // what the person did not touch is still there, in the same spelling
    expect(pairs()).toEqual(["actor=user:2f3a4b5c6d7e8f90", "limit=100", "type=task.created", "window=30d"]);
    expect(valueOf("aud01-filter-type")).toBe("task.created");
    expect(valueOf("aud01-filter-operator")).toBe(ACTOR);
    expect(valueOf("audH-page-size")).toBe("100");
    expect(textOf("aud2-page")).toContain("第 1 页");
    const url = lastListRead();
    expect(paramOf(url, "action")).toBe("task.created");
    expect(paramOf(url, "actorId")).toBe(ACTOR);
    expect(paramOf(url, "limit")).toBe("100");
    expect(paramOf(url, "cursor")).toBeNull();
    expect(Date.parse(paramOf(url, "to") ?? "") - Date.parse(paramOf(url, "from") ?? "")).toBe(30 * 86_400_000);
  });

  it("clicking the window that is already on does not ask again", async () => {
    answer();
    await render("/audit?window=24h");
    const before = urls();
    await click("aud01-filter-window-24h");
    expect(urls()).toEqual(before);
  });
});

describe("R133 - a value this panel cannot use is said, not silently rewritten", () => {
  it("an unknown window stays in the address, is shown as unrecognised, and reads the default span", async () => {
    answer();
    await render("/audit?window=__nope__");
    // the address was not cleaned up behind the person's back
    expect(pairs()).toContain("window=__nope__");
    // the control pressed is the honest default, not a guess at the pasted word
    expect(pressed()).toBe("7d");
    // and the screen says what it cannot use, in the chip row that mirrors the address
    const chip = document.querySelector("[data-testid='aud-chip-window']");
    expect(chip?.textContent).toContain("时间窗：__nope__");
    expect(chip?.getAttribute("title")).toContain("该值未被识别");
    const url = lastListRead();
    expect(Date.parse(paramOf(url, "to") ?? "") - Date.parse(paramOf(url, "from") ?? "")).toBe(7 * 86_400_000);
    // readable page, not a blank shell: the page-level anchors are all still there
    for (const anchor of ["agent-v2-page-audit", "aud01-filters", "aud2-pagination", "aud5-export-bar"]) {
      expect(document.querySelector(`[data-testid='${anchor}']`), anchor).not.toBeNull();
    }
    expect(document.querySelectorAll("[data-testid^='aud01-row-']").length).toBe(2);
  });

  it("a limit that is not an offered size is not put on the wire, not rewritten, and says so", async () => {
    answer();
    await render("/audit?limit=-1");
    expect(pairs()).toEqual(["limit=-1"]);
    const note = textOf("audH-clamp-note") ?? "";
    expect(note).toContain("-1");
    expect(note).toContain("没有把它发出去");
    expect(valueOf("audH-page-size")).toBe(String(PAGE_LIMIT));
    expect(listReads()).toBe(1);
    expect(paramOf(lastListRead(), "limit")).toBe(String(PAGE_LIMIT));
    for (const anchor of ["agent-v2-page-audit", "aud01-filters", "aud2-pagination", "aud5-export-bar"]) {
      expect(document.querySelector(`[data-testid='${anchor}']`), anchor).not.toBeNull();
    }
  });
});

describe("R133 - the same address is one question, asked the same way", () => {
  // A stated interval, so nothing in the request depends on when the test ran:
  // an address is one question, and one question is one identical request.
  const REPLAY =
    "/audit?window=custom&from=" +
    encodeURIComponent(FROM) +
    "&to=" +
    encodeURIComponent(TO) +
    "&type=task.created&actor=" +
    encodeURIComponent(ACTOR) +
    "&limit=100";

  it("re-mounting the address asks the identical request, and the rows and the export are one count", async () => {
    answer();
    await render(REPLAY);
    expect(listReads()).toBe(1);
    const first = lastListRead();
    const rows = document.querySelectorAll("[data-testid^='aud01-row-']").length;
    expect(rows).toBe(2);
    expect(textOf("aud5-export-count")).toBe(`将导出 ${rows} 条`);

    // the same address, mounted again from scratch: one more call, and the same question
    answer();
    await render(REPLAY);
    expect(listReads()).toBe(2);
    expect(lastListRead()).toBe(first);
    expect(document.querySelectorAll("[data-testid^='aud01-row-']").length).toBe(rows);
    expect(textOf("aud5-export-count")).toBe(`将导出 ${rows} 条`);
  });

  it("when the resource filter leaves one row, the export count moves with it", async () => {
    answer();
    await render(`/audit?window=24h&resource=${encodeURIComponent(RESOURCE)}`);
    const rows = document.querySelectorAll("[data-testid^='aud01-row-']").length;
    expect(rows).toBe(1);
    expect(textOf("aud5-export-count")).toBe("将导出 1 条");
  });
});

describe("R133 - the deep link and the filters open a record without spending a key", () => {
  it("opening the record adds only detail=, and keeps window/from/to/type/actor/resource/limit/event", async () => {
    answer();
    await render(`/audit${SEVEN}&event=${ID}`);
    expect(textOf("aud9-deeplink-found")).toContain("已按链接定位到这条事件并展开");
    const before = pairs();
    const listBefore = listReads();
    // the row's own 打开详情: the button inside the row card
    await click(`aud01-cell-${ID}-type`);
    await waitFor(
      () => document.querySelector("[data-testid='aud02-detail']") !== null,
      "the record pane painted",
    );
    const after = pairs();
    // only one pair may be new, and nothing that was there may have changed
    expect(after.filter((pair) => !before.includes(pair))).toEqual([`detail=${ID}`]);
    expect(before.filter((pair) => !after.includes(pair))).toEqual([]);
    // the list was asked once for this address; opening the record re-asks nothing of it
    expect(listReads()).toBe(listBefore);
    expect(detailReads()).toBe(1);
    expect(paramOf(lastListRead(), "resourceId")).toBe(RESOURCE);
    expect(valueOf("audH-page-size")).toBe("25");
  });
});
