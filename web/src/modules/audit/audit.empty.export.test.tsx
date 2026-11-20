// @vitest-environment jsdom
// R206 — 空态与导出、与清筛选之后的对账，钉在一条链上。
//
// 已覆盖、这里不重写（只回证据）：
// - `audit.empty.test.tsx`（R181）钉住了空态是句子不是裸 0、三枚页级锚在位、
//   `audF-state-list-empty` 用导出的 `STATE_LABEL`、两枚具名出口（`audB-empty-clear` /
//   `audD-empty-clear`）回默认窗并带走 `?event=`/`?preview=`、空态下行复制列不渲且
//   `aud-detail-copy` 可见禁用带原因、空态导出钮 disabled+title+点击零请求；
// - `audit.export.columns.test.tsx`（R205 例⑤）钉住了按类型筛出空集时
//   `URL.createObjectURL` 调用数为 0；
// - `audit.deeplink.test.tsx`（R113）钉住了深链本身三态；`detailCopy.test.tsx`（R121）
//   钉住了复制控件自己的行、拒绝与 disabled 文案；R141/R192 钉住了导出三角与列头。
//
// 本文件只补这条链上真正没钉过的接缝：
// ① 读数行 `aud01-status` 在空态【自己】说什么 —— 现状是句子「这个筛选条件里没有审计
//    事件」，不是数字；屏上那个诚实的 0 只出现在导出条的「将导出 0 条」里。
//    （工单原文写「aud01-status 显 0」，与现状不符，按现状钉，不改产品。）
// ② 空【区间】场景下导出不但安静，而且从未生成过 Blob —— 与 R205 按类型筛空的那条
//    互为交叉验证，触发路径不同；
// ③ 从带深链的空态点「清空区间」回来之后，读数行的数字与表体行数【重新对上】；
// ④ 行回来了，行复制列跟着回来，而记录复制仍是可见、禁用、带原因 —— 空态消失不是
//    靠把控件藏起来。

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { DETAIL_COPY_DISABLED_TITLE } from "@/modules/audit/detailCopy";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ID = "evt_r206_present_001";
const ACTOR = "user:2f3a4b5c6d7e8f90";

/** 半小时的空区间会带回空答案；默认 7 天档带回两行。与 R181 同一套答案口径。 */
const FROM = "2026-11-05T02:00:00Z";
const TO = "2026-11-05T02:30:00Z";
const EMPTY_RANGE = `?window=custom&from=${FROM}&to=${TO}`;

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

const TWO = [rowOf(ID, "task.created"), rowOf("evt_r206_present_002", "run.failed")];

interface PageBody {
  items: Record<string, unknown>[];
  nextCursor?: string | null;
}

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

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}

function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      return { audit: TWO[0] };
    }
    const from = paramOf(target, "from") ?? "";
    const emptyRange = from.startsWith("2026-11-05T02:00");
    const page: PageBody = { items: emptyRange ? [] : TWO, nextCursor: null };
    return page;
  });
}

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
        <AuditEventsModulePage />
        <LocationProbe />
      </MemoryRouter>,
    );
  });
  await waitFor(() => document.querySelector(".animate-pulse") === null, "skeleton gone");
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
const textOf = (testId: string): string =>
  document.querySelector(`[data-testid='${testId}']`)?.textContent ?? "";
const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((node) =>
    String(node.getAttribute("data-testid")).replace("aud01-row-", ""),
  );
const address = (): string =>
  document.querySelector("[data-testid='probe-location']")?.textContent ?? "";
const pairs = (): string[] => {
  const query = address().slice(address().indexOf("?") + 1);
  if (!address().includes("?")) return [];
  return [...new URLSearchParams(query)].map(([key, value]) => `${key}=${value}`).sort();
};

/** 读数行里的数字；句子没有数字时是 -1 —— 这本身就是被钉的现状。 */
function shownCount(): number {
  const digits = /(\d+)/.exec(textOf("aud01-status"));
  return digits ? Number(digits[1]) : -1;
}

async function click(testId: string): Promise<void> {
  const node = document.querySelector(`[data-testid='${testId}']`) as HTMLElement | null;
  expect(node, testId).not.toBeNull();
  await act(async () => {
    (node as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

// ── Blob 有没有被生成过，要数得出来（与 R205 同一手法，触发场景不同）──────────
const made = { urls: 0, downloads: 0 };

function watchBlobs(): void {
  made.urls = 0;
  made.downloads = 0;
  URL.createObjectURL = (() => {
    made.urls += 1;
    return "blob:empty-export-never";
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    if (this.download) made.downloads += 1;
  });
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  answer();
  watchBlobs();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R206 - what the read-out line says when nothing came back", () => {
  it("keeps the status line a sentence and leaves the only zero to the export bar", async () => {
    await render(`/audit${EMPTY_RANGE}`);
    await waitFor(() => document.querySelector("[data-testid='aud01-empty']") !== null, "empty panel");

    // 读数行自己说什么：现状是句子，不是「已显示 0 条」，也不含任何数字
    const status = textOf("aud01-status");
    expect(status).toBe("这个筛选条件里没有审计事件");
    expect(status).not.toContain("已显示");
    expect(shownCount()).toBe(-1);
    // 屏上那个诚实的 0 只有导出条一处（「将导出 0 条」在 R181 已钉，这里是唯一性对照）
    expect(textOf("aud5-export-count")).toContain("将导出 0 条");
    // 房间是空的，门还在原位（锚点族本身由 R181 钉死，这里只数页级那一枚）
    expect(document.querySelector("[data-testid='agent-v2-page-audit']")).not.toBeNull();
    expect(paintedRows()).toEqual([]);
  });

  it("hands over no file from an empty range: off, silent, and never a Blob", async () => {
    await render(`/audit${EMPTY_RANGE}`);
    await waitFor(() => document.querySelector("[data-testid='aud01-empty']") !== null, "empty panel");

    const before = urls();
    for (const testId of ["aud01-export", "aud5-export"]) {
      const button = document.querySelector(`[data-testid='${testId}']`) as HTMLButtonElement | null;
      expect(button?.disabled, `${testId} is off`).toBe(true);
      await click(testId);
    }
    // 没多问一次，也没生成过一个 0 行的文件（disabled+title 原文与按类型筛空的同断言见 R181/R205）
    expect(urls()).toEqual(before);
    expect(listReads()).toBe(1);
    expect(made.urls).toBe(0);
    expect(made.downloads).toBe(0);
  });
});

describe("R206 - what the exit restores, and whether it adds up", () => {
  it("clears the deep link and makes the read-out line count the rows again", async () => {
    await render(`/audit${EMPTY_RANGE}&event=${ID}`);
    await waitFor(() => document.querySelector("[data-testid='aud01-empty']") !== null, "empty panel");
    expect(address()).toContain(`event=${ID}`);
    expect(shownCount()).toBe(-1);

    await click("audB-empty-clear");
    await waitFor(() => listReads() === 2, "the default window was read");
    await waitFor(() => paintedRows().length === 2, "rows restored");

    // 出口只问了一次列表（深链挂载自带的那次 detail 读数不算在里），地址回到默认一档，
    // 深链随筛选一起走（配对细节 R181 已钉）
    expect(listReads()).toBe(2);
    expect(pairs()).toEqual(["window=7d"]);
    expect(address()).not.toContain("event=");
    // 新接缝：回来后读数行的数字与表体行数重新对上 —— 空态那句句子不是永久状态
    expect(shownCount()).toBe(paintedRows().length);
    expect(textOf("aud01-status")).toContain("已显示 2 条");
  });

  it("brings the row copy column back while the record copy stays visible and disabled", async () => {
    await render(`/audit${EMPTY_RANGE}&event=${ID}`);
    await waitFor(() => document.querySelector("[data-testid='aud01-empty']") !== null, "empty panel");
    // 空态里行复制列一家都不在（这条本身 R181 已钉，此处是同渲染的入口对照）
    expect(document.querySelectorAll("[data-testid^='aud01-cell-']")).toHaveLength(0);

    await click("audB-empty-clear");
    await waitFor(() => paintedRows().length === 2, "rows restored");

    // 行回来了，列也回来了：每行都有六族单元格，不再是空渲染
    expect(document.querySelectorAll("[data-testid^='aud01-cell-']").length).toBeGreaterThan(0);
    // 记录复制没被藏起来：仍可见、禁用、带着同一句原因（文案本体 R121 钉）
    const copy = document.querySelector("[data-testid='aud-detail-copy']") as HTMLButtonElement | null;
    expect(copy, "the copy control is shown, not hidden").not.toBeNull();
    expect(copy?.disabled).toBe(true);
    expect(copy?.getAttribute("title")).toBe(DETAIL_COPY_DISABLED_TITLE);
  });
});
