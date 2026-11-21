// @vitest-environment jsdom
// R226 — 错误态与空态互斥：一页不能同时说「没能加载」和「这一段里没有」，也不能在
// 失败时把行级复制的入口照常端上桌。
//
// 已覆盖、这里不重写（只回证据）：
// - R213 `audit.error.test.tsx`：首屏 500 的面板标题/句子/可复制 rid/读数行无数字、
//   翻页失败整页清空、重试恰一次非并集、失败态两枚导出 disabled+title+点击零请求+
//   `URL.createObjectURL` 计数 0；
// - R181 `audit.empty.test.tsx`：空态句子不显裸 0、页级锚在场、两枚具名清筛选出口
//   （`audB-empty-clear` 恰 1 次取数、地址回 `window=7d`、`event=`/`from=` 同落）、
//   空态下行复制列零渲染且 `aud-detail-copy` visible-disabled；
// - R214④/audQ：空态读数行是句子无数字、「将导出 0 条」是唯一诚实的 0、导出禁用梯子；
// - R161（整页替换与游标）、R205①（CSV==表体==读数行三角）。
//
// 本文件只补真正没拼过的接头：
// ① 错误面板在场时 `aud01-empty` 必须【不在场】—— R213 从未提过空态锚；
// ② 空态面板在场时 `aud01-error` 必须【不在场】—— R181 也从未提过错误锚；
// ③ 错误态下行复制列不渲、`aud-detail-copy` 照 R181⑤ 的空态形制 visible-disabled ——
//    这一形此前只在空态钉过；
// ④ 清筛选回默认后的三值对账（读数行==表体==「将导出 N 条」）—— R181③ 钉了行数
//    恢复与地址账本，但没有把这三枚数摆在一起核过。
//
// 工单②「aud01-status=0」与现状不符：空态读数行是无数字的句子，按现状钉死并在此登记；
// 唯一的 0 出现在「将导出 0 条」。

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { DETAIL_COPY_DISABLED_TITLE } from "@/modules/audit/detailCopy";
import { ApiError } from "@/lib/api-error";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

const ID = "evt_r226_present_0001";
const ACTOR = "user:2f3a4b5c6d7e8f90";
const BASE = "/audit?window=7d";
const FROM = "2026-11-05T02:00:00Z";
const TO = "2026-11-05T02:30:00Z";
const EMPTY_RANGE = `/audit?window=custom&from=${FROM}&to=${TO}`;
const RID_FAIL = "req-aud-500";

function rowOf(eventId: string, action: string) {
  return {
    eventId,
    action,
    occurredAt: "2026-11-19T01:20:00Z",
    recordedAt: "2026-11-19T01:20:01Z",
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: "ap_1122334455667788" },
    requestId: `req-${eventId}`,
  };
}

const TWO = [rowOf(ID, "task.created"), rowOf("evt_r226_present_0002", "run.failed")];

interface PageBody {
  items: Record<string, unknown>[];
  nextCursor?: string | null;
}

/** 线路开关：首屏是否 500；空的半小时区间与默认的 7d 档各回什么（同 R181 的答法）。 */
const mode = { failFirst: false };

function errorFor(requestId: string): ApiError {
  return new ApiError("service down", {
    status: 500,
    body: "{}",
    url: "/agent-api/api/audit",
    requestId,
  });
}

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}

function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      return { audit: TWO[0] };
    }
    if (mode.failFirst) throw errorFor(RID_FAIL);
    const from = paramOf(target, "from") ?? "";
    const empty = from.startsWith("2026-11-05T02:00");
    const page: PageBody = { items: empty ? [] : TWO, nextCursor: null };
    return page;
  });
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

function Probe(): ReactNode {
  const location = useLocation();
  return <div data-testid="probe-location" data-search={location.search} className="hidden" />;
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
        <Probe />
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

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

/** 行级复制列的全部形状：任何 `aud01-cell-` 都不该在。 */
const cellsCount = (): number =>
  document.querySelectorAll("[data-testid^='aud01-cell-']").length;

/** 读数行里的数字；句子（空态/错误态）没有数字，返回 -1。 */
function shownCount(): number {
  const digits = /(\d+)/.exec(textOf("aud01-status"));
  return digits ? Number(digits[1]) : -1;
}

function exportCountDigits(): number {
  const digits = /(\d+)/.exec(textOf("aud5-export-count"));
  return digits ? Number(digits[1]) : -1;
}

function pairs(): string[] {
  const search = node("probe-location")?.getAttribute("data-search") ?? "";
  return Array.from(new URLSearchParams(search))
    .map(([key, value]) => `${key}=${value}`)
    .sort();
}

async function click(testId: string): Promise<void> {
  const target = node(testId);
  expect(target, testId).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

beforeEach(() => {
  mode.failFirst = false;
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

describe("R226 - a failure never poses as an empty answer", () => {
  it("shows the error panel and keeps the empty panel off the page", async () => {
    mode.failFirst = true;
    await render(BASE);
    await waitFor(() => node("aud01-error") !== null, "the error panel");
    // 互斥新腿：错误在场，空态锚必须缺席 —— 没能读到的东西不能被说成读了且是空
    expect(node("aud01-empty")).toBeNull();
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(0);
    expect(textOf("aud01-error")).toContain("审计事件没能加载出来");
    // rid 逐字可复制（面板自带复制件）
    expect(textOf("aud01-error-request-id")).toContain(RID_FAIL);
    expect(node("aud01-error-request-id-value")).not.toBeNull();
    // 读数行说的是失败本身，不伪装成任何计数（R213 同句，这里只核它没数字）
    expect(shownCount()).toBe(-1);
    expect(paintedRows()).toEqual([]);
    // 页级锚仍在：失败不该把人丢出房间
    expect(
      document.querySelector("[data-testid='agent-v2-page-audit'], #agent-v2-page-audit"),
    ).not.toBeNull();
  });
});

describe("R226 - an empty answer never poses as a failure", () => {
  it("shows the empty sentence and keeps the error panel off the page", async () => {
    await render(EMPTY_RANGE);
    await waitFor(() => node("aud01-empty") !== null, "the empty panel");
    // 互斥新腿：空态在场，错误锚必须缺席
    expect(node("aud01-error")).toBeNull();
    expect(listReads()).toBe(1);
    expect(textOf("aud01-empty")).toContain("该时间段内无事件");
    // 现状登记：工单说「aud01-status=0」，现状是【无数字的句子】—— 按现状钉。
    // 面板与读数行都不许出现裸 0 计数；唯一的诚实 0 在「将导出 0 条」。
    expect(shownCount()).toBe(-1);
    expect(textOf("aud01-status")).toContain("这个筛选条件里没有审计事件");
    expect(textOf("aud01-empty")).not.toMatch(/0\s*条/);
    expect(exportCountDigits()).toBe(0);
    expect(paintedRows()).toEqual([]);
  });
});

describe("R226 - the failure closes every door that needs rows", () => {
  it("disables both exports and offers no row copy column while erroring", async () => {
    mode.failFirst = true;
    await render(BASE);
    await waitFor(() => node("aud01-error") !== null, "the error panel");
    const csv = node("aud01-export") as HTMLButtonElement | null;
    const filtered = node("aud5-export") as HTMLButtonElement | null;
    expect(csv?.disabled).toBe(true);
    expect(csv?.getAttribute("title")).toBe("当前筛选没有可导出的记录");
    expect(filtered?.disabled).toBe(true);
    expect(filtered?.getAttribute("title")).toBe("当前筛选无事件可导出");
    // 点击不改账本（请求与 Blob 的逐字账由 R213④ 持有，这里只核一次点击）
    const before = urls();
    await click("aud01-export");
    expect(urls()).toEqual(before);
    expect(listReads()).toBe(1);
    // 新腿：错误态下行复制列整族不渲 —— 这个形此前只在空态钉过（R181⑤）
    expect(cellsCount()).toBe(0);
    expect(paintedRows()).toEqual([]);
    const copy = node("aud-detail-copy") as HTMLButtonElement | null;
    expect(copy).not.toBeNull();
    expect(copy?.disabled).toBe(true);
    expect(copy?.getAttribute("title")).toBe(DETAIL_COPY_DISABLED_TITLE);
  });
});

describe("R226 - clearing the question restores one reconciled count", () => {
  it("reconciles readout, table and export after the named exit, event included", async () => {
    // 清筛选的取数账本、地址回 `window=7d`、`event=` 同落 —— 全部由 R181③ 持有；
    // 这里只补它没拼过的那一段：恢复之后三枚数必须当场对得上。
    await render(`${EMPTY_RANGE}&event=${ID}`);
    await waitFor(() => node("aud01-empty") !== null, "the empty panel");
    expect(node("aud01-error")).toBeNull();
    expect(pairs()).toContain(`event=${ID}`);
    await click("audB-empty-clear");
    await waitFor(() => listReads() === 2, "the default question asked again");
    expect(pairs()).not.toContain(`event=${ID}`);
    // 新拼接：读数行 == 表体行数 == 「将导出 N 条」
    const status = shownCount();
    expect(status).toBe(paintedRows().length);
    expect(status).toBe(exportCountDigits());
    expect(textOf("aud01-status")).toContain("已显示");
    expect(node("aud01-empty")).toBeNull();
    expect(node("aud01-error")).toBeNull();
  });
});
