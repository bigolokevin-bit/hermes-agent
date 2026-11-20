// @vitest-environment jsdom
// R244 — 分页 × 复制的稳定性：翻页之后换一个问题（actor），复制句子必须跟着
// 【眼前这一页】换代；第二页翻车再爬起来，也不许把复制串到别的行上去。
//
// 已覆盖、这里不重写（只回证据，文件:行）：
// - `audit.copy.paged.test.tsx`（R241）① 起 :325：aud01-load-more 到第 2 页后逐行
//   「开详情→复制」与屏上同值（时间+「北京时间（UTC+8）」前缀梯），三值当场核 ——
//   工单①【整段】由此持有，本文件不写重复用例；
// - `audit.paging.test.tsx`（R161）④ :338-380：第 2 页 500 是整页失败——行清空、
//   「审计事件没能加载出来」、rid 可复制、重试恰 +1（【保旧行】是追加腿的承诺，
//   追加腿在 UI 不可达，见 :19 注释）——本文件只补它没碰的两条：失败当下抽屉
//   复制钮的形制、重试成功后【逐行复制各归各行】；
// - `audit.requests.test.tsx`（R212）③ :252-274：选择钮（aud01-filter-operator）
//   确实是重置通道——但那是【冷地址带游标】的语境；本文件钉的是先在眼前翻页、
//   再切 actor 的活语境；
// - `audit.detail.copy.open.test.tsx`（R240）/ `audit.detail.counts.test.tsx`
//   （R222）：关闭后 aud-detail-copy 是 visible-disabled，不是不渲染。
//
// 工单口径与现状不一致处，按现状钉死并登记：
// (a) 「复制序号从 0 连续/不重复」——复制件没有【序号】这个概念：抽屉一句话只属于
//     当前选中的那条事件（R236/R237/R241 同款登记）。钉法：按表体逐行开详情再复制，
//     每句以【该行自己的】屏上秒值开头；行集本身唯一（Set 与长度相等）。
// (b) 「第 2 页 500 保旧行」——现状是整页替换：失败的这一页什么都不留（R161 已钉），
//     本文件沿用同一事实，不伪造保留。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { DETAIL_COPY_DISABLED_TITLE } from "@/modules/audit/detailCopy";
import { ApiError } from "@/lib/api-error";
import { pickByValue } from "@/shell/selectHarness";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTOR_A = "user:2f3a4b5c6d7e8f90";
const WHO_A = "李思 · 6d7e8f90";
const ACTOR_B = "user:cafe1234beef5678";
const WHO_B = "王五 · beef5678";
const ACTION = "task.created";
const RESOURCE = "ap_1122334455667788";
const ZONE = "北京时间（UTC+8）";
const FROM = "2026-11-05T02:00:00Z";
const TO = "2026-11-19T02:00:00Z";

const ROW_A = "evt_r244_alpha_000001";
const ROW_B = "evt_r244_bravo_000001";
const ROW_E = "evt_r244_echo_000001";
const ROW_F = "evt_r244_foxtrot_001";
const CUR2 = "cur_r244_page2";
const RID_FAIL = "rid-r244-page2-500";

/** 屏上秒值——与 occurredAt 的北京时间换算一一对应（11-19 对 李思，11-18 对 王五）。 */
const TIME_A = "2026-11-19 09:20:00";
const TIME_B = "2026-11-19 09:21:00";
const TIME_F = "2026-11-18 09:21:00";

let root: Root | null = null;
const mode = { failPage2: false };
let pageTwoTries = 0;

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

function markValue(testId: string): string {
  return node(testId)?.getAttribute("data-audj-value") ?? "";
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
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

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

function shownCount(): number {
  const digits = /(\d+)/.exec(textOf("aud01-status"));
  return digits ? Number(digits[1]) : -1;
}

async function clickNodeSync(testId: string, label = testId): Promise<void> {
  const target = node(testId);
  expect(target, label).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function openRecord(eventId: string): Promise<void> {
  await clickNodeSync(`aud01-cell-${eventId}-type`, `row ${eventId}`);
  await waitFor(() => node("aud02-detail") !== null, "detail painted");
}

async function closeRecord(): Promise<void> {
  await clickNodeSync("aud8-back-to-list", "aud8-back-to-list");
  await waitFor(() => node("aud02-detail") === null, "detail gone");
}

async function loadMore(asksBefore: number): Promise<void> {
  await clickNodeSync("aud01-load-more", "aud01-load-more");
  await waitFor(() => listReads() === asksBefore + 1, "the next page was asked");
}

async function retryInPanel(): Promise<void> {
  const retry = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-testid='aud01-error'] button"),
  ).find((element) => (element.textContent ?? "").includes("重试"));
  expect(retry, "a retry button in the error panel").toBeDefined();
  await act(async () => {
    retry?.click();
  });
}

// ── 复制：点 aud-detail-copy，剪贴板里拿到的那一句就是【当前选中行】的话 ──────
const clip = { calls: [] as string[] };

function stubClipboard(): void {
  clip.calls = [];
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        clip.calls.push(text);
      },
    },
  });
}

async function copiedLine(): Promise<string> {
  const grew = clip.calls.length + 1;
  await clickNodeSync("aud-detail-copy", "aud-detail-copy");
  await waitFor(() => clip.calls.length >= grew, "the clipboard got a line");
  return clip.calls[clip.calls.length - 1] ?? "";
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

function rowOf(eventId: string, handle: string, name: string, instant: string): Row {
  return {
    eventId,
    action: ACTION,
    occurredAt: instant,
    outcome: "succeeded",
    actor: { type: "human", id: handle, displayName: name },
    resource: { type: "approval", id: RESOURCE },
    requestId: `req-${eventId}`,
  };
}

// 不加筛选题：两页里两位操作者都有 —— 操作者下拉的项是从【已加载的行】里长出来的
// （R235 现状），这样 ② 才能用真实选择钮切到 王五。
const PAGE_ONE: Row[] = [
  rowOf(ROW_A, ACTOR_A, "李思", "2026-11-19T01:20:00Z"),
  rowOf(ROW_E, ACTOR_B, "王五", "2026-11-18T01:20:00Z"),
];
const PAGE_TWO: Row[] = [
  rowOf(ROW_B, ACTOR_A, "李思", "2026-11-19T01:21:00Z"),
  rowOf(ROW_F, ACTOR_B, "王五", "2026-11-18T01:21:00Z"),
];
// 只问 王五：拿到的仍是 11-18 那两条 —— 与 11-19 的行集整页换代。
const ONLY_B: Row[] = [PAGE_ONE[1], PAGE_TWO[1]];
const ALL_ROWS: Row[] = [PAGE_ONE[0], PAGE_ONE[1], PAGE_TWO[0], PAGE_TWO[1]];

function errorFor(url: string, requestId: string): ApiError {
  return new ApiError("service down", { status: 500, body: "{}", url, requestId });
}

function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      const wanted = paramOf(target, "id");
      return { audit: ALL_ROWS.find((row) => row.eventId === wanted) ?? ALL_ROWS[0] };
    }
    const actor = paramOf(target, "actorId");
    const cursor = paramOf(target, "cursor");
    if (actor === ACTOR_B) {
      return { items: ONLY_B, nextCursor: null };
    }
    if (cursor === CUR2) {
      if (mode.failPage2) {
        pageTwoTries += 1;
        if (pageTwoTries === 1) throw errorFor(target, RID_FAIL);
      }
      return { items: PAGE_TWO, nextCursor: null };
    }
    return { items: PAGE_ONE, nextCursor: CUR2 };
  });
}

const BASE = `/audit?window=custom&from=${FROM}&to=${TO}&limit=25`;

beforeEach(() => {
  api.fetchJSON.mockReset();
  mode.failPage2 = false;
  pageTwoTries = 0;
  answer();
  stubClipboard();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R244 - switching the operator after a live page flip", () => {
  it("rebuilds the row set at one ask, retires the cursor, and every copy line is the new page's own", async () => {
    await render(BASE);
    expect(listReads()).toBe(1);
    expect(paintedRows()).toEqual([ROW_A, ROW_E]);
    // 先在眼前翻页：这一枚游标是【活着翻出来的】，不是冷地址带的（冷地址腿归 R212③）
    await loadMore(listReads());
    expect(paintedRows()).toEqual([ROW_B, ROW_F]);
    expect(cursorsOf(lastListRead())).toEqual([CUR2]);
    const asksBefore = listReads();
    const callsBefore = urls().length;
    // 选择钮换 actor：这是一次新的问题，旧游标不许跟来
    await pickByValue("aud01-filter-operator", ACTOR_B);
    await waitFor(() => listReads() === asksBefore + 1, "the new question was asked");
    const read = lastListRead();
    expect(paramOf(read, "actorId")).toBe(ACTOR_B);
    expect(cursorsOf(read)).toEqual([]);
    expect(urls().length).toBe(callsBefore + 1);
    // 行集整页换代：上一份读数的行一条都不许留（整页替换现状，非并集）
    expect(paintedRows()).toEqual([ROW_E, ROW_F]);
    expect(shownCount()).toBe(paintedRows().length);
    expect(textOf("aud2-page")).toContain("第 1 页");
    // (a) 现状登记：复制件无序号概念 —— 钉【逐行各归各行】
    for (const eventId of paintedRows()) {
      await openRecord(eventId);
      const line = await copiedLine();
      expect(line.startsWith(`${markValue(`audJ-time-list-${eventId}`)} ${ZONE}`)).toBe(true);
      expect(line).toContain(WHO_B);
      expect(line).not.toContain(WHO_A);
      // 换代零残留：另一份行集（11-19）的时刻一条都不出现在新页面的句子里
      for (const stale of [TIME_A, TIME_B]) {
        expect(line).not.toContain(stale);
      }
      await closeRecord();
    }
  });
});

describe("R244 - a failed second page and the way back up", () => {
  it("keeps the copy door shut while it is broken, then copies its own lines without repeats", async () => {
    mode.failPage2 = true;
    await render(BASE);
    expect(paintedRows()).toEqual([ROW_A, ROW_E]);
    const drawerAsked = detailReads();
    await clickNodeSync("aud01-load-more", "aud01-load-more");
    await waitFor(() => node("aud01-error") !== null, "the whole-page failure panel");
    // 现状（R161 :338-380 已钉）：失败的这一页什么都不留 —— 工单【保旧行】≠现状
    expect(paintedRows()).toEqual([]);
    expect(textOf("aud01-error")).toContain("审计事件没能加载出来");
    const ridLine = node("aud01-error-request-id");
    expect(ridLine?.textContent).toContain(RID_FAIL);
    expect(ridLine?.querySelector("button")).not.toBeNull();
    // 净新增：失败当下，抽屉的复制钮仍在、但不开口（visible-disabled，R222② 形制）
    const door = node("aud-detail-copy") as HTMLButtonElement | null;
    expect(door).not.toBeNull();
    expect(door?.disabled).toBe(true);
    expect(door?.getAttribute("title")).toBe(DETAIL_COPY_DISABLED_TITLE);
    expect(detailReads()).toBe(drawerAsked);
    // 重试恰 +1（账本主体归 R161；这里只接它没钉的【重试后逐行复制】）
    mode.failPage2 = false;
    const before = urls().length;
    await retryInPanel();
    await waitFor(() => urls().length === before + 1, "one retry read");
    await waitFor(() => node("aud01-error") === null, "panel gone");
    expect(listReads()).toBe(3);
    const rows = paintedRows();
    expect(rows).toEqual([ROW_B, ROW_F]);
    // (a) 现状登记：无【序号】可言 —— 钉行集唯一 + 每句以该行自己的秒值开头
    expect(new Set(rows).size).toBe(rows.length);
    for (const eventId of rows) {
      await openRecord(eventId);
      const line = await copiedLine();
      expect(line.startsWith(`${markValue(`audJ-time-list-${eventId}`)} ${ZONE}`)).toBe(true);
      await closeRecord();
    }
    // 两句话各归各行：第一条不许串到第二条的时间
    const first = clip.calls[0] ?? "";
    const second = clip.calls[1] ?? "";
    expect(first).not.toBe(second);
    expect(first).not.toContain(TIME_F);
    expect(second).not.toContain(TIME_B);
  });
});
