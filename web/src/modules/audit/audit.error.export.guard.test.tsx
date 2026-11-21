// @vitest-environment jsdom
// R265（收窄重发）— 审计首屏 500 的导出与复制守卫：只补「首屏失败 → 面板重试 → 恢复」
// 这一条现行线路上的拼缝，关闭态本体不重写。
//
// 已覆盖、这里只回证据（禁写重复用例）：
// ①首屏 500 的四个面全部有主——
// - 可读句 + 500 服务侧句子 + rid 逐字 + rid 可复制 + 读数行不伪装正常 + 页级锚：
//   `audit.error.test.tsx`（R213①）:261-278（:268 标题句、:269 SENTENCE_500、
//   :270 「req-aud-500」、:271 `aud01-error-request-id-value` 非空）；
// - 导出两钮 disabled + title 逐字 + 强点零请求 + `URL.createObjectURL` 计数 0：
//   `audit.error.test.tsx`（R213④）:328-349（:334-335 disabled、:337-338 title、
//   :346 账本一字不增、:348 made.urls 为 0）；
// - 「行复制列不渲」：`audit.error.empty.test.tsx`（R226③）:243-263——错误态整个
//   `aud01-cell-*` 行族缺席（计数口径 :154-156），抽屉侧行复制钮是 visible-disabled
//   而非不渲（:261-263），两种说法都已有主。
// ②恢复线此前只钉过【第 2 页失败】的语境：R213③ :302-326 重试的是翻页失败
// （failPageTwo，断言恰 +1、锚消失、行数回到该页集合）；R250②
// `audit.export.window.detail.paging.test.tsx` :314-329 拼的是翻页失败恢复后的导出三角。
// 首屏 500 自己经面板重试回来后——两钮解禁、CSV 行数==表体==aud01-status 三值当场对上、
// 且恢复复核零新增请求——没有人拼过。本文件就钉这一段。
//
// 现状口径（不弱化）：重试恰 +1 只重发列表这一口；恢复后 nextCursor 为空 ⇒ 读数行
// 是「已显示 N 条」且无「下面还有更多」；导出的 CSV 行数 = 数据行（表头与尾空行除外）。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTOR = "user:2f3a4b5c6d7e8f90";
const FROM = "2026-11-05T02:00:00Z";
const TO = "2026-11-19T02:00:00Z";
const BASE = `/audit?window=custom&from=${FROM}&to=${TO}&limit=25`;

const ROW_1 = "evt_r265_nova_0000001";
const ROW_2 = "evt_r265_mike_00000001";

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

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

/** 读数行里的数字；错误句没有数字，返回 -1。 */
function shownCount(): number {
  const digits = /(\d+)/.exec(textOf("aud01-status"));
  return digits ? Number(digits[1]) : -1;
}

async function clickTestId(testId: string): Promise<void> {
  const target = node(testId);
  expect(target, testId).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

/** 在错误面板里按字样找「重试」那颗（与 R213③ 同法，不猜 testid）。 */
async function clickPanelRetry(): Promise<void> {
  const panel = node("aud01-error");
  expect(panel, "aud01-error").not.toBeNull();
  const button = Array.from(panel?.querySelectorAll("button") ?? []).find((element) =>
    String(element.textContent ?? "").includes("重试"),
  );
  expect(button, "重试 button inside the panel").not.toBeUndefined();
  await act(async () => {
    (button as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

// ── Blob 观察：计数与到手文本都要（恢复前一枚不许有，恢复后一枚恰好是那份文件）──
const blobs = new Map<string, Blob>();
const made = { urls: 0 };
const captured = { name: "", text: "" };

function watchBlobs(): void {
  blobs.clear();
  made.urls = 0;
  captured.name = "";
  captured.text = "";
  URL.createObjectURL = ((blob: Blob) => {
    made.urls += 1;
    const url = `blob:r265-${blobs.size + 1}`;
    blobs.set(url, blob);
    return url;
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    if (!this.download) return;
    captured.name = this.download;
    const blob = blobs.get(this.href);
    if (blob) void blob.text().then((value) => (captured.text = value));
  });
}

/** 点导出、拿到文件文本、数数据行（剥 BOM、去表头与尾空行）。 */
async function exportDataLines(): Promise<string[]> {
  captured.text = "";
  await clickTestId("aud01-export");
  await waitFor(() => captured.text !== "", "the export was handed over");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  return captured.text
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .filter((line) => line !== "")
    .slice(1);
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
    action: "task.created",
    occurredAt: `2026-11-19T01:2${index}:00Z`,
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: "ap_1122334455667788" },
    requestId: `req-${eventId}`,
  };
}

const ROWS: Row[] = [rowOf(ROW_1, 0), rowOf(ROW_2, 1)];

/** 线路开关：首屏那一刀失败，重试那一刀放回活线。 */
const mode = { failFirst: false };

function errorFor(requestId: string): ApiError {
  return new ApiError("service down", {
    status: 500,
    body: "{}",
    url: "/agent-api/api/audit",
    requestId,
  });
}

function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      return { audit: ROWS.find((row) => target.includes(row.eventId)) ?? ROWS[0] };
    }
    if (mode.failFirst) throw errorFor("req-r265-500");
    return { items: ROWS, nextCursor: null };
  });
}

beforeEach(() => {
  mode.failFirst = false;
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

describe("R265 - the failed first screen, brought back honest", () => {
  it("reopens both doors, reconciles the three counts, and asks for nothing else", async () => {
    // 首屏失败：面板立起来（关闭态四个面归 R213①④/R226③，此处不重写）。
    mode.failFirst = true;
    await render(BASE);
    await waitFor(() => node("aud01-error") !== null, "the error panel");
    const before = urls().length;
    expect(made.urls).toBe(0);
    // 线路回来：面板「重试」恰重发这一口。
    mode.failFirst = false;
    await clickPanelRetry();
    await waitFor(() => node("aud01-error") === null, "the panel gone");
    expect(urls().length).toBe(before + 1);
    expect(listReads()).toBe(2);
    // 错误锚随恢复消失。
    expect(node("audF-state-list-error")).toBeNull();
    expect(paintedRows()).toEqual([ROW_1, ROW_2]);
    // 两钮解禁：错误态的 disabled 到这里必须翻面（恢复语境的解禁此前没人钉）。
    const csv = node("aud01-export") as HTMLButtonElement | null;
    const filtered = node("aud5-export") as HTMLButtonElement | null;
    expect(csv?.disabled).toBe(false);
    expect(filtered?.disabled).toBe(false);
    // 三值当场对上：CSV 行数 == 表体行数 == aud01-status 的数字。
    const ledger = urls();
    const asks = listReads();
    const lines = await exportDataLines();
    expect(lines).toHaveLength(paintedRows().length);
    expect(lines).toHaveLength(shownCount());
    expect(made.urls).toBe(1);
    // 恢复复核零新增：导出这一路不借机重读列表。
    expect(urls()).toEqual(ledger);
    expect(listReads()).toBe(asks);
  });
});
