// @vitest-environment jsdom
// R212 — 列表请求契约：一次开屏只问一次；下一页只多带服务自己给的游标；
// 换一个问题是新的一问（旧游标必须作废）；按链接定位是一条纯地址动作。
//
// 已覆盖、这里不重写（只回证据）：
// - `audit.paging.test.tsx`（R161）钉住了翻页/冷启动游标/换窗重置/末页话术/
//   总数不可用/500 页失败重试，并在文件头登记了现状：`useAuditData` 每次换问
//   或换页都整页替换，从不并集，UI 也走不到追加腿 —— 所以工单②「按 id 去重后
//   行数==并集」不是现状，这里按现状钉整页替换，缺口留给产品工单；
// - `audit.detail.requests.test.tsx`（R196）钉住了点开一行 +1 次详情读、
//   列表不重取、返回列表只删记录键且筛选逐字保留；
// - `audit.deeplink.test.tsx`（R113）钉住了冷链接定位「列表读就是唯一一次
//   请求」（detailReads 0）、其余筛选逐字保留、收起定位零请求只删 event ——
//   所以工单④「开 ?event= 详情只 +1 次请求」与现状不同：定位一条已在列表里
//   的行【零次】详情请求，这里按现状钉，并把没拼过的那半拼上：定位地址里
//   带着游标栈时，收起定位连游标一起原样保留；
// - `audit.window.guard.test.ts`（R155）与 R208 钉住了快捷档上线是 from/to
//   对、`window` 参本身不上线；`audit.export.*` 与 R161 钉过导出与计数三角。
//
// 本文件只补真正的新接缝：
// ① 首屏的总账 —— 全部网络动作恰好一次列表读（零详情、零其他），默认页量
//    limit=PAGE_LIMIT(50) 在线路参里逐字可见，且首读不带 cursor=；
// ② 下一页的「只多带游标」用两读线路参【逐字集合差】钉死：除 cursor 外任何
//    参数一动不动，且上线的游标字面等于上一页响应里的 nextCursor；
// ③ 换问题用真实 ConsoleSelect 点击腿（R161 只走过按钮换窗与地址带入操作者）：
//    从第 2 页点选事件类型/操作者后，旧游标既不上线也不留在地址，页码回 1；
// ④ ?event= 生命周期：定位零详情、收起定位除 event 外一字不改（含游标栈）。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { PAGE_LIMIT } from "@/modules/audit/api";
import { pickByValue } from "@/shell/selectHarness";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTOR = "user:2f3a4b5c6d7e8f90";
const ACTION = "task.created";
const FROM = "2026-11-05T02:00:00Z";
const TO = "2026-11-19T02:00:00Z";
const CUR2 = "cur_r212_page2";

const P1_A = "evt_r212_p1_a_0001";
const P1_SHARED = "evt_r212_p1_shared";
const P2_B = "evt_r212_p2_b_0001";
const ONE = "evt_r212_located_001";

let root: Root | null = null;

function Probe(): null {
  const location = useLocation();
  const holder = document.querySelector("[data-testid='probe-location']");
  if (holder) holder.setAttribute("data-search", location.search);
  return null;
}

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

async function render(entry: string): Promise<void> {
  await act(async () => {
    if (root) act(() => root?.unmount());
  });
  root = null;
  document.body.replaceChildren();
  const holder = document.createElement("div");
  holder.setAttribute("data-testid", "probe-location");
  document.body.append(holder);
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <Probe />
        <AuditEventsModulePage />
      </MemoryRouter>,
    );
  });
  await waitFor(() => document.querySelector(".animate-pulse") === null, "skeleton gone");
}

function node(testId: string): Element | null {
  return document.querySelector(`[data-testid='${testId}']`);
}

function textOf(testId: string): string {
  return node(testId)?.textContent?.trim() ?? "";
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number => urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
const detailReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";

function queryOf(url: string): URLSearchParams {
  return new URL(url, "http://console.test").searchParams;
}

function paramOf(url: string, key: string): string | null {
  return queryOf(url).get(key);
}

const cursorsOf = (url: string): string[] => queryOf(url).getAll("cursor");

/** 除 cursor 外的全部线路参，逐字、排序 —— ②的「其它一动不动」就这么钉。 */
function entriesWithoutCursor(url: string): string[] {
  return [...queryOf(url).entries()]
    .filter(([key]) => key !== "cursor")
    .map(([key, value]) => `${key}=${value}`)
    .sort();
}

function pairs(): string[] {
  const search = document.querySelector("[data-testid='probe-location']")?.getAttribute("data-search") ?? "";
  return [...new URLSearchParams(search).entries()]
    .map(([key, value]) => `${key}=${decodeURIComponent(value)}`)
    .sort();
}

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

async function clickNode(target: Element | null | undefined, label: string): Promise<void> {
  expect(target, label).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: { type?: string; id?: string; displayName?: string };
  resource: { type?: string; id?: string };
  requestId: string | null;
}

function rowOf(eventId: string, index: number): Row {
  return {
    eventId,
    action: ACTION,
    occurredAt: `2026-11-19T01:${String(20 + index).padStart(2, "0")}:00Z`,
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: "ap_1122334455667788" },
    requestId: `req-${eventId}`,
  };
}

const PAGE_ONE: Row[] = [rowOf(P1_A, 0), rowOf(P1_SHARED, 1)];
const PAGE_TWO: Row[] = [rowOf(P1_SHARED, 1), rowOf(P2_B, 2)];
const ONE_ROW: Row[] = [rowOf(ONE, 0)];

let pageRows: Row[] = PAGE_ONE;
let pageTwoRows: Row[] = PAGE_TWO;
let pageTwoCursor: string | null = CUR2;

function answerList(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      return { audit: (pageRows[0] ?? ONE_ROW[0]) as unknown as Record<string, unknown> };
    }
    const cursor = queryOf(target).get("cursor");
    if (cursor) {
      return { items: pageTwoRows, nextCursor: pageTwoCursor };
    }
    return { items: pageRows, nextCursor: pageRows === PAGE_ONE ? CUR2 : null };
  });
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  pageRows = PAGE_ONE;
  pageTwoRows = PAGE_TWO;
  pageTwoCursor = CUR2;
  answerList();
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R212 - first screen asks exactly once", () => {
  it("opens with one list read, the asked window as a from/to pair, and no cursor", async () => {
    await render("/audit?window=7d");
    // 总账：整屏到此为止只有一次网络动作，且那就是列表
    expect(urls().length).toBe(1);
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(0);
    const read = lastListRead();
    expect(cursorsOf(read)).toEqual([]);
    // 工单说「带当前 window」：现状是快捷档展开成 from/to 对，window 参本身不上线
    expect(paramOf(read, "window")).toBeNull();
    expect(paramOf(read, "from")).not.toBeNull();
    expect(paramOf(read, "to")).not.toBeNull();
    // 默认页量逐字上线（地址没写 limit 时）
    expect(paramOf(read, "limit")).toBe(String(PAGE_LIMIT));
    expect(textOf("aud2-page")).toContain("第 1 页");
    expect(paintedRows()).toEqual([P1_A, P1_SHARED]);
  });
});

describe("R212 - the next page adds nothing but the served cursor", () => {
  it("sends exactly the previous response's nextCursor and keeps every other parameter byte for byte", async () => {
    await render(`/audit?window=custom&from=${FROM}&to=${TO}&limit=25`);
    const first = lastListRead();
    expect(cursorsOf(first)).toEqual([]);
    await clickNode(node("aud01-load-more"), "aud01-load-more");
    await waitFor(() => listReads() === 2, "the second read");
    const second = lastListRead();
    // 上线的游标就是上一页响应给的那枚，一字不多
    expect(cursorsOf(second)).toEqual([CUR2]);
    // 除 cursor 外，两读的线路参集合逐字相等 —— 不多不少不换
    expect(entriesWithoutCursor(second)).toEqual(entriesWithoutCursor(first));
    // 现状（R161 文件头已登记）：整页替换，不是并集。工单②的「去重后==并集」
    // 不是现状，这里钉住现状的那半：行是下一页的，没有重复的 id。
    expect(paintedRows()).toEqual([P1_SHARED, P2_B]);
    expect(new Set(paintedRows()).size).toBe(paintedRows().length);
    expect(textOf("aud2-page")).toContain("第 2 页");
    expect(urls().length).toBe(2);
    expect(detailReads()).toBe(0);
  });
});

describe("R212 - a new question retires the old cursor", () => {
  it("resetting happens through the real select, not just an address rewrite: page back to 1, cursor gone from wire and address", async () => {
    await render(`/audit?window=custom&from=${FROM}&to=${TO}&type=${ACTION}&cursor=${CUR2}&limit=25`);
    expect(textOf("aud2-page")).toContain("第 2 页");
    expect(cursorsOf(lastListRead())).toEqual([CUR2]);
    const before = urls().length;
    // 从「全部事件类型」点成一个不同的问题（R161 只按过窗口按钮，没碰过这枚控件）
    await pickByValue("aud01-filter-operator", ACTOR);
    await waitFor(() => listReads() === 2, "the retried read");
    const read = lastListRead();
    // 旧游标不再上线，也不留在地址里；页码回到 1
    expect(cursorsOf(read)).toEqual([]);
    expect(pairs().some((pair) => pair.startsWith("cursor="))).toBe(false);
    expect(paramOf(read, "actorId")).toBe(ACTOR);
    // 原来那句问题逐字带着走
    expect(paramOf(read, "action")).toBe(ACTION);
    // 边界助手上线恒带毫秒（.000Z，R203 起登记的现状），逐字按上线形态对
    expect(paramOf(read, "from")).toBe(new Date(FROM).toISOString());
    expect(paramOf(read, "to")).toBe(new Date(TO).toISOString());
    expect(textOf("aud2-page")).toContain("第 1 页");
    expect(urls().length).toBe(before + 1);
  });
});

describe("R212 - ?event= is an addressing act, not a request", () => {
  it("locates from the list read alone, and closing the locate removes only the event key — cursor stack intact", async () => {
    pageRows = ONE_ROW;
    pageTwoRows = ONE_ROW;
    pageTwoCursor = null;
    await render(`/audit?window=custom&from=${FROM}&to=${TO}&cursor=${CUR2}&event=${ONE}&limit=25`);
    expect(textOf("aud9-deeplink-found")).toContain("已按链接定位到这条事件并展开");
    expect(document.querySelector("[data-testid^='aud6-preview-']")).not.toBeNull();
    // 现状（R113 钉过腿，这里把游标栈一起摆进来）：定位行不需要验存在性 ——
    // 全部网络动作就是一次列表读，详情请求零次。工单④的「+1 详情」不是这条腿的现状。
    expect(urls().length).toBe(1);
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(0);
    expect(paintedRows()).toEqual([ONE]);
    const addressBefore = pairs();
    expect(addressBefore).toContain(`event=${ONE}`);
    expect(addressBefore).toContain(`cursor=${CUR2}`);
    await clickNode(node("aud9-deeplink-close"), "aud9-deeplink-close");
    await waitFor(() => node("aud9-deeplink-found") === null, "the locate closed");
    // 零新增请求；除 event 外地址一字不改，游标栈原样保留
    expect(urls().length).toBe(1);
    expect(detailReads()).toBe(0);
    const after = pairs();
    expect(after).not.toContain(`event=${ONE}`);
    expect(after).toEqual(addressBefore.filter((pair) => pair !== `event=${ONE}`));
  });
});
