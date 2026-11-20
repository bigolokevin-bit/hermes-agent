// @vitest-environment jsdom
// R242 — 详情 × 分页稳定性：翻页不该被详情打断，详情失败不该把分页拖回第 1 页。
//
// 已覆盖、这里不重写（只回证据与文件:行）：
// - `audit.paging.test.tsx`（R161）钉住 load-more 行换代与游标（:227-239）、
//   「第 2 页 · 已加载 N 条」读数（:249）、切窗档清游标回第 1 页（:261-268）；
// - `audit.fields.edge.test.tsx`（R220 例④ :473-509）钉住【冷地址 ?cursor=】第 2 页
//   开合详情时读数行与行序逐字；本文件①补的是【经 load-more 按钮】抵达的第 2 页；
// - `audit.copy.paged.test.tsx`（R241 例①）钉住第 2 页逐行复制与屏上/CSV 对应——
//   工单①「aud-detail-copy 序号与行同序」的说法在屏上不存在（复制件一条事件一句话，
//   无序号概念，R236/R237/R241 同款口径登记），这里不重钉复制腿；
// - `audit.detail.counts.test.tsx`（R222 例④ :400-437）钉住详情 500 的可读句、
//   可复制 rid、重试恰 +1 与三值不动——那是不分页语境；本文件③补【第 2 页失败时
//   分页状态不重置】这一枚；
// - 开合账本本体归 R196/R201 it3/R208 例③；定位行冷开零详情读归 R113。
// 工单②「列表不重取」与现状相悖：load-more 每翻一次就是一次列表取数（R161 账本），
// 按现状钉每翻恰一问，登记口径差。
//
// 本文件只补三枚没拼过的：
// ① load-more 抵达第 2 页后开→关详情：仍停第 2 页、游标仍在、读数行与行序逐字；
// ② 定位态（?event=）连翻两页：地址随翻页落掉 event（实测更正）、游标键只留最近一枚，
//    第三页数据上屏而页码读数停在「第 2 页」（现状登记），抽屉不再被问；
// ③ 第 2 页详情 500：可读句+可复制 rid、分页不重置、重试恰 +1。

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { ApiError } from "@/lib/api-error";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTOR = "user:2f3a4b5c6d7e8f90";
const RESOURCE = "ap_1122334455667788";
const FROM = "2026-11-05T02:00:00Z";
const TO = "2026-11-19T02:00:00Z";
const BASE = `/audit?window=custom&from=${FROM}&to=${TO}&limit=25`;

const P1_A = "evt_r242_p1a_00000001";
const P1_B = "evt_r242_p1b_00000001";
const P2_A = "evt_r242_p2a_00000001";
const P2_B = "evt_r242_p2b_00000001";
const P3_A = "evt_r242_p3a_00000001";
const CUR2 = "cur_r242_page2";
const CUR3 = "cur_r242_page3";
const RID_FAIL = "rid-r242-detail-500";

let root: Root | null = null;
const mode = { failDetailOnce: false };
let detailTries = 0;

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
    action: "task.created",
    occurredAt: `2026-11-19T01:2${index}:00Z`,
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: RESOURCE },
    requestId: `req-${eventId}`,
  };
}

const ALL = [rowOf(P1_A, 0), rowOf(P1_B, 1), rowOf(P2_A, 2), rowOf(P2_B, 3), rowOf(P3_A, 4)];

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}

function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      detailTries += 1;
      if (mode.failDetailOnce && detailTries === 1) {
        throw new ApiError("detail down", {
          status: 500,
          body: "{}",
          url: target,
          requestId: RID_FAIL,
        });
      }
      const wanted = paramOf(target, "id");
      return { audit: ALL.find((item) => item.eventId === wanted) ?? ALL[0] };
    }
    const cursor = paramOf(target, "cursor");
    if (cursor === CUR2) return { items: [ALL[2], ALL[3]], nextCursor: CUR3 };
    if (cursor === CUR3) return { items: [ALL[4]], nextCursor: null };
    return { items: [ALL[0], ALL[1]], nextCursor: CUR2 };
  });
}

function Probe(): ReactNode {
  const location = useLocation();
  return <div data-testid="probe-location" data-search={location.search} />;
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
const listReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
const detailReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";

function cursorsOf(url: string): string[] {
  return [...new URL(url, "http://console.test").searchParams.getAll("cursor")];
}

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

function shownCount(): number {
  const digits = /(\d+)/.exec(textOf("aud01-status"));
  return digits ? Number(digits[1]) : -1;
}

function pairs(): string[] {
  const search = node("probe-location")?.getAttribute("data-search") ?? "";
  return [...new URLSearchParams(search).entries()].map(([key, value]) => `${key}=${value}`).sort();
}

async function clickNode(target: Element | null | undefined, label: string): Promise<void> {
  expect(target, label).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function clickNodeSync(testId: string, label: string): Promise<void> {
  await clickNode(node(testId), label);
}

async function openRecord(eventId: string): Promise<void> {
  await clickNodeSync(`aud01-cell-${eventId}-type`, `row ${eventId}`);
  await waitFor(() => document.querySelector("[data-testid='aud02-detail']") !== null, "detail painted");
}

async function closeRecord(): Promise<void> {
  await clickNodeSync("aud8-back-to-list", "aud8-back-to-list");
  await waitFor(() => document.querySelector("[data-testid='aud02-detail']") === null, "detail gone");
}

async function loadMore(asks: number): Promise<void> {
  await clickNodeSync("aud01-load-more", "aud01-load-more");
  await waitFor(() => listReads() === asks + 1, `list read #${asks + 1}`);
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  mode.failDetailOnce = false;
  detailTries = 0;
  answer();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R242 ① - a button-reached page two survives open and fold", () => {
  it("stays on page two, keeps its cursor, and moves nothing on the list", async () => {
    await render(BASE);
    expect(listReads()).toBe(1);
    expect(paintedRows()).toEqual([P1_A, P1_B]);
    await loadMore(1);
    expect(paintedRows()).toEqual([P2_A, P2_B]);
    expect(textOf("aud2-page")).toContain("第 2 页");
    const statusBefore = textOf("aud01-status");
    const rowsBefore = paintedRows();
    const callsBefore = urls().length;

    await openRecord(P2_A);
    expect(detailReads()).toBe(1);
    expect(paramOf(urls()[callsBefore] ?? "", "id")).toBe(P2_A);
    expect(listReads()).toBe(2);
    await closeRecord();
    // 开合之后这一页还是这一页：页码、游标、读数行、行序，一个都不动。
    expect(textOf("aud2-page")).toContain("第 2 页");
    expect(cursorsOf(lastListRead())).toEqual([CUR2]);
    expect(textOf("aud01-status")).toBe(statusBefore);
    expect(paintedRows()).toEqual(rowsBefore);
    expect(listReads()).toBe(2);
    expect(detailReads()).toBe(1);
    expect(urls().length).toBe(callsBefore + 1);
    // 工单「aud-detail-copy 序号与行同序」——复制件无序号概念（口径登记），
    // 第 2 页逐行复制对应已由 R241 例①持有，只回证据不重写。
  });
});

describe("R242 ② - paging deepens while the locate holds", () => {
  it("keeps every other filter down to page three, drops the locate key, and asks the drawer nothing", async () => {
    await render(`${BASE}&event=${P1_A}`);
    await waitFor(() => document.querySelector("[data-testid='aud9-deeplink-found']") !== null, "located");
    expect(listReads()).toBe(1);
    // 定位行冷开零详情读（R113 持有）；主动开一次才有一枚。
    await openRecord(P1_A);
    expect(detailReads()).toBe(1);
    const addressBefore = pairs();
    expect(addressBefore.some((entry) => entry === `event=${P1_A}`)).toBe(true);

    await loadMore(1);
    await loadMore(2);
    // 现状口径登记①：工单说「列表不重取」——翻页本身就是一次列表取数（R161 账本），
    // 每翻恰一问，这里按现状钉。
    expect(listReads()).toBe(3);
    expect(paintedRows()).toEqual([P3_A]);
    // 现状口径登记②：连翻两页后页码读数并不升到「第 3 页」——goNext 走
    // resetPagingAndFolds 再 append，地址只留最近一枚游标（R161 :239 同款），
    // 页码=游标数+1 因此停在「第 2 页」；第三页的数据在屏上（行集整页换代）。
    expect(textOf("aud2-page")).toContain("第 2 页");
    expect(textOf("aud2-page")).not.toContain("第 3 页");
    expect(shownCount()).toBe(paintedRows().length);
    const read = lastListRead();
    expect(paramOf(read, "cursor")).toBe(CUR3);
    // 现状口径登记③（本波实测更正）：goNext 走 resetPagingAndFolds ——
    // 定位键 event= 随翻页落掉，其余筛选参逐字仍在；游标键始终只留最近一枚。
    const addressAfter = pairs();
    expect(addressAfter.some((entry) => entry.startsWith("event="))).toBe(false);
    for (const entry of addressBefore) {
      if (entry.startsWith("cursor=") || entry.startsWith("event=")) continue;
      expect(addressAfter, `address keeps ${entry}`).toContain(entry);
    }
    const stack = addressAfter.filter((entry) => entry.startsWith("cursor="));
    expect(stack).toEqual([`cursor=${CUR3}`]);
    expect(detailReads()).toBe(1);
  });
});

describe("R242 ③ - a failing drawer on page two leaves the page alone", () => {
  it("says it failed with a copyable id and keeps page two where it was", async () => {
    mode.failDetailOnce = true;
    await render(BASE);
    await loadMore(1);
    const statusBefore = textOf("aud01-status");
    const rowsBefore = paintedRows();

    // 失败的那一枚抽屉不会渲染成功面，直接等错误面（openRecord 等的是 aud02-detail）。
    await clickNodeSync(`aud01-cell-${P2_A}-type`, `row ${P2_A}`);
    await waitFor(
      () => document.querySelector("[data-testid='aud02-detail-error']") !== null,
      "detail error painted",
    );
    expect(textOf("aud02-detail-error")).toContain("这条事件没能加载出来");
    expect(textOf("aud02-detail-error-request-id")).toContain(RID_FAIL);
    expect(node("aud02-detail-error-request-id-value")).not.toBeNull();
    // 分页状态不重置：还在第 2 页，游标还在，表体与读数行逐字，列表一问不多。
    expect(textOf("aud2-page")).toContain("第 2 页");
    expect(cursorsOf(lastListRead())).toEqual([CUR2]);
    expect(paintedRows()).toEqual(rowsBefore);
    expect(textOf("aud01-status")).toBe(statusBefore);
    expect(listReads()).toBe(2);

    const panel = node("aud02-detail-error");
    const retry = Array.from(panel?.querySelectorAll("button") ?? []).find((button) =>
      (button.textContent ?? "").includes("重试"),
    );
    await clickNode(retry, "detail retry");
    await waitFor(
      () => document.querySelector("[data-testid='aud02-detail-error']") === null,
      "error folded away",
    );
    expect(node("aud02-detail")).not.toBeNull();
    expect(detailReads()).toBe(2);
    expect(listReads()).toBe(2);
    expect(paintedRows()).toEqual(rowsBefore);
    await closeRecord();
    expect(textOf("aud2-page")).toContain("第 2 页");
  });
});
