// @vitest-environment jsdom
// R213 — /audit 错误态与重试护栏。
//
// 已覆盖、这里不重写（只回证据）：
// - `AuditEventsModulePage.test.tsx` :436 钉住了首屏 500 的可读句 +「请求编号：au-1101」
//   + `aud01-error-request-id-value` 可复制 + 不显裸 500/HTTP 字样 + 重试后再读到记录；
//   :454 钉住了无 rid 的 502 走「本次请求未记录编号…」兜底；:470 钉住了 403/404 同体、
//   零行、不回显线路；:2487/:2523/:2541 钉住了一句话三个面与各口重试恰 +1 且互不串台；
//   audQ 强制态那一族已钉：error 时两枚导出 disabled（flag=off）、镜像源 off、
//   `aud01-error-sentence` 与 rid 在面板上、刷新仍活。
// - R161 `audit.paging.test.tsx` 钉住了第 2 页 500 是整页失败：旧行【不保留】
//   （「the failed page leaves nothing painted above the panel」）、句子、audF 标记、
//   rid 行、重试恰 +1、共三次读取；并在文件头登记了追加腿（保旧行）不可达 = 现状缺口。
// - R205 `audit.export.columns.test.tsx` 例⑤ 在【空集】面钉了 title 逐字 + 零新增请求 +
//   `URL.createObjectURL` 调用数为 0。
//
// 本文件只补真正没拼过的接缝：
// ① 错误落在屏上时，读数行 `aud01-status` 说的是「审计事件读取失败」——不是裸 0、
//    不是「已显示 0 条」、也不是空列表伪装正常；且页级锚 `agent-v2-page-audit` 仍在
//    （R181 只在空态钉过锚，错误态没人钉）；rid 用 500 + req-aud-500 逐字（:436 是 au-1101）；
// ② 翻页失败时读数行切到错误句且**不含任何数字**（R161 没断过读数行），
//    错误行的 rid 恰是这次失败回传的 req-aud-P2，地址里的 cursor 栈不动；
// ③ 面板重试恰 +1、锚消失、行数回到【该页集合】——工单说「行数==并集」，现状是
//    整页替换（R161/R212 已钉追加腿不可达），按现状钉并在此登记缺口；
//    且「已显示 N 条」的 N 与表体行数在恢复后重新对上（R205 的三角在错误恢复面的复验）；
// ④ 错误态下两枚导出的 title 逐字（门表单一来源 auditGates：error 与空集共用
//    「当前筛选没有可导出的记录」/「当前筛选无事件可导出」——错误态此前只钉过 disabled，
//    没钉过话），点击后请求账本一字不增、`URL.createObjectURL` 调用数为 0。
//
// 句子现状：面板标题「审计事件没能加载出来」恒定，正文按状态类走
// copy.ts readFailure —— status>=500 ⇒「审计服务在处理时出了错，请稍后重试。」；
// 读数行另有五档（error ⇒「审计事件读取失败」，empty 才是「这个筛选条件里没有审计事件」）。

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
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

const P1_A = "evt_r213_p1_a_00001";
const P1_B = "evt_r213_p1_b_00001";
const P2_C = "evt_r213_p2_c_00001";
const CUR2 = "cur_r213_page2";

const SENTENCE_500 = "审计服务在处理时出了错，请稍后重试。";

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
}

function node(testId: string): Element | null {
  return document.querySelector(`[data-testid='${testId}']`);
}

function textOf(testId: string): string {
  return node(testId)?.textContent?.trim() ?? "";
}

/** 地址读数（与 R113/R196 同法：从探针元素读 location.search）。 */
function pairs(): string[] {
  const holder = document.querySelector("[data-testid='probe-location']");
  const search = holder?.getAttribute("data-search") ?? "";
  return Array.from(new URLSearchParams(search))
    .map(([key, value]) => `${key}=${decodeURIComponent(value)}`)
    .sort();
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

/** 在错误面板里按字样找「重试」那颗（与 :436/R161 同法，不猜 testid）。 */
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

// ── 文件到手没有：错误态根本不该造出 Blob ────────────────────────────────
const blobs = new Map<string, Blob>();
const made = { urls: 0 };

function watchBlobs(): void {
  blobs.clear();
  made.urls = 0;
  URL.createObjectURL = ((blob: Blob) => {
    made.urls += 1;
    const url = `blob:aud-error-${blobs.size + 1}`;
    blobs.set(url, blob);
    return url;
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    void this;
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
    action: "task.created",
    occurredAt: `2026-11-19T01:2${index}:00Z`,
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: "ap_1122334455667788" },
    requestId: `req-${eventId}`,
  };
}

const PAGE_ONE: Row[] = [rowOf(P1_A, 0), rowOf(P1_B, 1)];
const PAGE_TWO: Row[] = [rowOf(P2_C, 2)];

/** 线路行为开关：谁在失败、下一刀回什么，全由它决定。 */
const mode = { failFirst: false, failPageTwo: false, pageTwoLive: false };

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
      throw errorFor("req-aud-detail-unused");
    }
    const hasCursor = paramOf(target, "cursor") !== null;
    if (hasCursor) {
      if (mode.failPageTwo && !mode.pageTwoLive) throw errorFor("req-aud-P2");
      return { items: PAGE_TWO, nextCursor: null };
    }
    if (mode.failFirst) throw errorFor("req-aud-500");
    return { items: PAGE_ONE, nextCursor: CUR2 };
  });
}

beforeEach(() => {
  mode.failFirst = false;
  mode.failPageTwo = false;
  mode.pageTwoLive = false;
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

describe("R213 - the failure says so on screen", () => {
  it("shows a readable failure with the trace id, never a fake zero-row success", async () => {
    mode.failFirst = true;
    await render(BASE);
    await waitFor(() => node("aud01-error") !== null, "the error panel");
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(0);
    // 面板：标题恒定 + 500 走服务侧句子 + rid 逐字可复制
    expect(textOf("aud01-error")).toContain("审计事件没能加载出来");
    expect(textOf("aud01-error-sentence")).toBe(SENTENCE_500);
    expect(textOf("aud01-error-request-id")).toContain("req-aud-500");
    expect(node("aud01-error-request-id-value")).not.toBeNull();
    // 读数行不伪装正常：说的是读取失败，且一个数字都不许出现
    expect(textOf("aud01-status")).toBe("审计事件读取失败");
    expect(shownCount()).toBe(-1);
    expect(paintedRows()).toEqual([]);
    // 页级锚在错误态仍在（此前只有空态钉过）
    expect(node("agent-v2-page-audit")).not.toBeNull();
  });

  it("keeps the address still while the failed page wipes the rows and the status line", async () => {
    await render(BASE);
    await waitFor(() => paintedRows().length === 2, "page one painted");
    const addressBefore = pairs();
    mode.failPageTwo = true;
    await clickTestId("aud01-load-more");
    await waitFor(() => node("aud01-error") !== null, "the error panel after page two failed");
    // 现状（R161 已钉整页替换）：旧行不保留 —— 工单「保留已有行」是追加腿的承诺，不可达
    expect(paintedRows()).toEqual([]);
    // 读数行切到错误句，且不带任何数字（这条 R161 没断过）
    expect(textOf("aud01-status")).toBe("审计事件读取失败");
    expect(shownCount()).toBe(-1);
    // 错误行回的是【这次失败】的编号，不是首屏那次的
    expect(textOf("aud01-error-request-id")).toContain("req-aud-P2");
    expect(listReads()).toBe(2);
    expect(detailReads()).toBe(0);
    // 失败不改地址：cursor 栈原样（翻页写栈在先，失败只是没把行换上来）
    expect(pairs()).toEqual([...addressBefore, `cursor=${CUR2}`].sort());
  });
});

describe("R213 - the way back out of a failure", () => {
  it("retries exactly once, drops the panel, and paints the retried page set (not a union)", async () => {
    await render(BASE);
    await waitFor(() => paintedRows().length === 2, "page one painted");
    mode.failPageTwo = true;
    await clickTestId("aud01-load-more");
    await waitFor(() => node("aud01-error") !== null, "the error panel");
    const before = urls().length;
    mode.pageTwoLive = true;
    await clickPanelRetry();
    await waitFor(() => node("aud01-error") === null, "the panel gone");
    // 恰 +1：重试只重发这一页，不借机重读别的口
    expect(urls().length).toBe(before + 1);
    expect(listReads()).toBe(3);
    expect(detailReads()).toBe(0);
    // 错误锚与标记一起消失
    expect(node("audF-state-list-error")).toBeNull();
    // 行数 = 重试那一页的集合 —— 并集是追加腿的承诺，现状不可达（R161/R212 登记）
    expect(paintedRows()).toEqual([P2_C]);
    // 恢复后读数行与表体重新对上：N 就是屏上的行数，且带「下面还有更多」缺席
    expect(textOf("aud01-status")).toContain("已显示");
    expect(shownCount()).toBe(paintedRows().length);
    expect(textOf("aud01-status")).not.toContain("下面还有更多");
    // 重试读的还是那一页：游标原样在地址与线路上
    expect(cursorsOf(lastListRead())).toEqual([CUR2]);
  });

  it("closes both export doors in the failure, asks nothing on click, builds no file", async () => {
    mode.failFirst = true;
    await render(BASE);
    await waitFor(() => node("aud01-error") !== null, "the error panel");
    const csv = node("aud01-export") as HTMLButtonElement | null;
    const filtered = node("aud5-export") as HTMLButtonElement | null;
    expect(csv?.disabled).toBe(true);
    expect(filtered?.disabled).toBe(true);
    // 错误态的话与空集同源（门表单一来源 auditGates）：话此前只在空态钉过逐字
    expect(csv?.getAttribute("title")).toBe("当前筛选没有可导出的记录");
    expect(filtered?.getAttribute("title")).toBe("当前筛选无事件可导出");
    const before = urls();
    await clickTestId("aud01-export");
    await clickTestId("aud5-export");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    // 禁用的钮不该有任何后果：请求账本一字不增，连 Blob 都不曾生成
    expect(urls()).toEqual(before);
    expect(listReads()).toBe(1);
    expect(made.urls).toBe(0);
  });
});
