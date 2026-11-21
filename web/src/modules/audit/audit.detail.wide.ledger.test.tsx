// @vitest-environment jsdom
// R255 — 宽窗开详情账本：抽屉打开时换窗，列表只问一次、抽屉不再被问、读数冻结；
// 关闭走 navigate(-1) 回到开抽屉前的那条地址，列表补问【旧档】恰一次。
//
// 已覆盖、这里不重写（只回证据）：
// - audit.export.detail.open.test.tsx（R247/R245，tip a52be295/ab4a942b）：
//   「gives the file the wider set while the open drawer keeps its frozen reading」钉过
//   开抽屉换宽【后导出】三行含 req-G 与关闭补问旧档一枚；navigate(-1) 机制在
//   AuditEventsModulePage.tsx :1093-1108（locationState?.fromList===true 走后退）。
//   「prints byte-identical text before opening and after closing」钉过无换档时
//   开合逐字、零额外请求。
// - audit.export.paging.detail.test.tsx（R249，tip fc9df360）：分页×抽屉×导出三面。
// - audit.detail.timezone.test.tsx（R238，tip 475910b1）：换窗四处换代无残留（不开抽屉）。
// - R254（audit.detail.wide.test.tsx，工单引 tip 5837d642）在本工作区不可达：
//   该对象与文件均不存在（git cat-file fatal；ls-tree 无 wide），无法逐行核对，
//   故按工单重建本文件并如实登记——不是【跳过重写】的证据，是【证据不可达】。
//
// 本文件净新增：
// ① 不开导出、只钉账本本身：换窗恰 1 次列表问、详情 0 次新增、抽屉读数冻结；
// ② 关闭后的现状整体重算：补问的是【旧档 7d】——工单写「按新窗重算」，现状是
//    退回开抽屉前的档位再重算（行序两行、读数行「已显示 2 条」），按现状钉并登记；
// ③ 全程 detail 请求账本==开抽屉次数：开→关→换宽→再开→关，两次开两次读，
//    换窗与关闭都不给详情记账。
//
// 现状口径不在这里改：档位不上线路（只有 from/to 对）、列表整页替换非并集、
// 关闭后退导致列表补问一次（R247 已钉，本波在纯账本语境复用）。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTOR = "user:2f3a4b5c6d7e8f90";
const ACTION = "task.created";
const RESOURCE = "ap_1122334455667788";
const DAY = 86_400_000;

const ROW_N = "evt_r255_nova_000001";
const ROW_M = "evt_r255_mike_00000001";
const ROW_G = "evt_r255_golf_000001";

const TIME_N = "2026-11-19 09:20:00";
const TIME_M = "2026-11-19 09:21:00";

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
const listReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
const detailReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}

function spanOf(url: string): number {
  const from = Date.parse(String(paramOf(url, "from")));
  const to = Date.parse(String(paramOf(url, "to")));
  return (to - from) / DAY;
}

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

function shownCount(): number {
  const digits = /(\d+)/.exec(textOf("aud01-status"));
  return digits ? Number(digits[1]) : -1;
}

function markValue(testId: string): string {
  return node(testId)?.getAttribute("data-audj-value") ?? "";
}

async function clickNodeSync(testId: string, label = testId): Promise<void> {
  const target = node(testId);
  expect(target, label).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function openRecord(eventId: string): Promise<void> {
  await clickNodeSync(`aud01-cell-${eventId}-type`, `row ${eventId}`);
  await waitFor(() => node("aud02-detail") !== null, `detail of ${eventId}`);
}

async function closeRecord(): Promise<void> {
  await clickNodeSync("aud8-back-to-list", "back to list");
  await waitFor(() => node("aud02-detail") === null, "the detail folded away");
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

function rowOf(eventId: string, occurredAt: string): Row {
  return {
    eventId,
    action: ACTION,
    occurredAt,
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: RESOURCE },
    requestId: `req-${eventId}`,
  };
}

const ROW_N_ROW = rowOf(ROW_N, "2026-11-19T01:20:00Z");
const ROW_M_ROW = rowOf(ROW_M, "2026-11-19T01:21:00Z");
const ROW_G_ROW = rowOf(ROW_G, "2026-11-02T01:30:00Z");

const NARROW = [ROW_N_ROW, ROW_M_ROW];
const WIDE = [ROW_N_ROW, ROW_M_ROW, ROW_G_ROW];

function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      const wanted = new URL(target, "http://console.test").searchParams.get("id");
      return { audit: WIDE.find((row) => row.eventId === wanted) ?? WIDE[0] };
    }
    const span = (Date.parse(
      String(new URL(target, "http://console.test").searchParams.get("to")),
    ) -
      Date.parse(
        String(new URL(target, "http://console.test").searchParams.get("from")),
      )) /
      DAY;
    return { items: span >= 29 ? WIDE : NARROW, nextCursor: null };
  });
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  answer();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R255 - the list pays for a widened window, the drawer does not", () => {
  it("asks once for the wider window and freezes the open record's reading", async () => {
    await render("/audit?window=7d&limit=25");
    expect(listReads()).toBe(1);
    expect(paintedRows()).toEqual([ROW_N, ROW_M]);
    await openRecord(ROW_N);
    expect(detailReads()).toBe(1);

    const asks = listReads();
    const drawerReads = detailReads();
    await clickNodeSync("aud01-filter-window-30d", "the 30d tier");
    await waitFor(() => listReads() === asks + 1, "the wide window was asked for");
    // 换窗恰 1 次列表问；档位不上线路，只有 from/to 对（既有口径）。
    expect(listReads()).toBe(2);
    expect(detailReads()).toBe(drawerReads);
    const read = lastListRead();
    expect(spanOf(read)).toBeGreaterThanOrEqual(29);
    expect(paramOf(read, "window")).toBeNull();
    // 列表整页换代为宽窗三行；抽屉还开着，读数冻结在打开那一刻。
    expect(paintedRows()).toEqual([ROW_N, ROW_M, ROW_G]);
    expect(shownCount()).toBe(3);
    expect(node("aud02-detail")).not.toBeNull();
    expect(markValue("audJ-time-detail")).toBe(TIME_N);
  });
});

describe("R255 - folding away rewinds to the address before the drawer", () => {
  it("catches the list up exactly once and recomputes on the OLD tier, not the new one", async () => {
    await render("/audit?window=7d&limit=25");
    await openRecord(ROW_N);
    const asks = listReads();
    await clickNodeSync("aud01-filter-window-30d", "the 30d tier");
    await waitFor(() => listReads() === asks + 1, "the wide window was asked for");
    expect(listReads()).toBe(2);
    expect(detailReads()).toBe(1);

    const drawerReads = detailReads();
    const before = urls().length;
    await closeRecord();
    await waitFor(() => listReads() === 3, "the close caught the list up");
    // 现状登记：工单写「行序与读数行按新窗重算」——现状是后退回到【开抽屉前】那条
    // 地址（7d 档），列表补问【旧档】恰一次并整体重算：行序回到窄窗两行、
    // 读数行按 2 条重算。机制在 AuditEventsModulePage.tsx :1093-1108（R247 已钉）。
    expect(urls().length).toBe(before + 1);
    const read = lastListRead();
    expect(spanOf(read)).toBeLessThan(29);
    expect(paintedRows()).toEqual([ROW_N, ROW_M]);
    expect(shownCount()).toBe(2);
    expect(markValue(`audJ-time-list-${ROW_M}`)).toBe(TIME_M);
    expect(detailReads()).toBe(drawerReads);
    expect(node("aud02-detail")).toBeNull();
  });
});

describe("R255 - the detail bill equals the number of times a record was opened", () => {
  it("charges one read per open and nothing for switching, closing or switching again", async () => {
    await render("/audit?window=7d&limit=25");
    // 第一次开：窄窗，开→关。无换档的关闭零补问（R245 已钉），这里只记总账。
    await openRecord(ROW_N);
    expect(detailReads()).toBe(1);
    await closeRecord();
    expect(detailReads()).toBe(1);
    expect(listReads()).toBe(1);

    // 第二次开：先换宽再开另一条，然后关闭。
    const asks = listReads();
    await clickNodeSync("aud01-filter-window-30d", "the 30d tier");
    await waitFor(() => listReads() === asks + 1, "the wide window was asked for");
    await openRecord(ROW_G);
    expect(detailReads()).toBe(2);
    expect(markValue("audJ-time-detail")).toBe("2026-11-02 09:30:00");
    await closeRecord();
    // 现状：换窗发生在【开抽屉之前】时，后退落回的就是当前生效的那条 30d 地址，
    // 没有差异要追平——关闭零补问。补问一枚只发生在【开着抽屉换窗】之后
    // （it② / R247 同规）。这里钉两条腿的分界。
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(listReads()).toBe(2);

    // 全程：开抽屉两次 = 详情读两次；换窗与关闭都只进列表账。
    expect(detailReads()).toBe(2);
    expect(listReads()).toBe(2);
    const listReadsAfter = listReads();
    const detailReadsAfter = detailReads();
    await clickNodeSync("aud01-filter-window-7d", "the 7d tier");
    await waitFor(() => listReads() === listReadsAfter + 1, "narrowed back once");
    expect(detailReads()).toBe(detailReadsAfter);
    expect(paintedRows()).toEqual([ROW_N, ROW_M]);
  });
});
