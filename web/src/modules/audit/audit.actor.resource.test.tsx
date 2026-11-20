// @vitest-environment jsdom
// R230 — actor × resource 组合：句柄问句与资源问句叠在一起时，交集、账本与空态
// 必须还是那一套现成的话，不多问、也不少筛。
//
// 已覆盖、这里不重写（只回证据）：
// - `audit.export.test.tsx`（R141「a resource filter narrows the file with the table,
//   not after it」）钉住了资源本地筛选让文件随表体同步收窄；
// - `audit.filter.counts.test.tsx`（R214②）钉住了 actor chip 移除=恰一次重取+三值三角；
// - 主用例集 audT it6（「导出计数与 chip 同源」）钉住了【资源 chip 移除也重取一次】——
//   资源是混合语义：线上带 resourceId（api.ts:148），但服务端效果本环境未单独实测，
//   页面同时在已加载的行里本地匹配（AuditEventsModulePage.tsx :906/:1502 现状）；
// - `audit.empty.test.tsx`（R181⑤）/`audit.export.empty.test.tsx`（R228④）钉住了空态下
//   aud-detail-copy 是【可见禁用】而非不渲染 —— 工单③「不渲」按现状钉并登记；
// - `audit.paging.test.tsx`（R161）钉住了换窗保留其余参、快捷档不上线只成对 from/to；
// - 时间在四处同秒归 R153/R208①，本波只在换窗后的新语境里对三处做防回归拼接。
//
// 本文件只补真正没拼过的 joints：
// ① actor+resource 双参叠加：请求逐字带 actorId 与 resourceId，表体只含本地交集，
//    读数行==表体==「将导出 N 条」三值同数；
// ② 资源 chip 移除：恰一次重取、新请求不再带 resourceId、actorId 留下，地址只掉
//    这一项，三值（含读数行）在新行集上重算 —— audT it6 只对了行集与「将导出」两值；
// ③ 双参无交集：服务按最坏形状回全量、本地匹配清零 ⇒ 现状两档阶梯 ——
//    服务空答才是无数字句子+aud01-empty；本地清零是读数行「已显示 0 条」+aud9-local-empty
//    具名句（工单「不显裸 0」只对服务空答成立，按现状钉）。
//    两枚导出 disabled 各带原句、点击零请求，行复制列整族不渲、复制钮可见禁用；
// ④ 换 30 天档：actor/resource 参逐字保留、线上跨度换代、行/详情/复制行三处同一时刻。

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { DETAIL_COPY_DISABLED_TITLE } from "@/modules/audit/detailCopy";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTOR = "user:2f3a4b5c6d7e8f90";
const WHO = "李思 · 6d7e8f90";
const ACTION = "task.created";
const ACTION_WORDS = "创建任务";
const RESOURCE_A = "ap_1122334455667788";
const OBJECT_A = "审批单 · 55667788";
// 一个谁都对不上的资源句柄：用来摆出「双参无交集」的最坏形状。
const RESOURCE_NONE = "ap_1029384756abcdef";
const TIME_A = "2026-11-19 09:20:00";

const ROW_A = "evt_r230_alpha_000001";
const ROW_B = "evt_r230_bravo_0000001";

const STACK2 = `/audit?window=7d&actor=${encodeURIComponent(ACTOR)}&resource=${RESOURCE_A}&limit=25`;
const STACK_NONE = `/audit?window=7d&actor=${encodeURIComponent(ACTOR)}&resource=${RESOURCE_NONE}&limit=25`;

const DAY_MS = 86_400_000;

let root: Root | null = null;

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

function markValue(testId: string): string {
  return String(node(testId)?.getAttribute("data-audj-value") ?? "");
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}

function spanOf(url: string): number {
  const from = Date.parse(paramOf(url, "from") ?? "");
  const to = Date.parse(paramOf(url, "to") ?? "");
  return Number.isNaN(from) || Number.isNaN(to) ? -1 : (to - from) / DAY_MS;
}

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

const cellsCount = (): number =>
  document.querySelectorAll("[data-testid^='aud01-cell-']").length;

function chipKeys(): string[] {
  return Array.from(document.querySelectorAll("[data-testid^='aud-chip-']"))
    .map((element) => String(element.getAttribute("data-testid")))
    .filter((testId) => !testId.endsWith("-clear"))
    .map((testId) => testId.replace("aud-chip-", ""));
}

function pairs(): string[] {
  const search = String(node("probe-location")?.getAttribute("data-search") ?? "");
  return Array.from(new URLSearchParams(search).entries())
    .map(([key, value]) => `${key}=${decodeURIComponent(value)}`)
    .sort();
}

function shownCount(): number {
  const digits = /(\d+)/.exec(textOf("aud01-status"));
  return digits ? Number(digits[1]) : -1;
}

function exportCountDigits(): number {
  const digits = /(\d+)/.exec(textOf("aud5-export-count"));
  return digits ? Number(digits[1]) : -1;
}

async function clickNode(target: Element | null | undefined, label: string): Promise<void> {
  expect(target, label).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

/** 摘掉一枚 chip：相对基线 —— 恰好重取一次、总账本也只多这一条。 */
async function removeChipOneAsk(key: string): Promise<void> {
  const asks = listReads();
  const calls = urls().length;
  await clickNode(node(`aud-chip-${key}-clear`), `aud-chip-${key}-clear`);
  await waitFor(() => listReads() === asks + 1, `removing ${key} re-asked once`);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  expect(urls().length).toBe(calls + 1);
}

async function openRecord(id: string): Promise<void> {
  await clickNode(node(`aud01-cell-${id}-type`), `aud01-cell-${id}-type`);
  await waitFor(() => node("aud02-detail") !== null, `the detail of ${id} opened`);
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

function rowOf(eventId: string, resource: string, occurredAt: string): Row {
  return {
    eventId,
    action: ACTION,
    occurredAt,
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: resource },
    requestId: `req-${eventId}`,
  };
}

const ALL: Row[] = [
  rowOf(ROW_A, RESOURCE_A, "2026-11-19T01:20:00Z"),
  rowOf(ROW_B, "ap_5566778899aabbcc", "2026-11-19T01:21:00Z"),
];

// 最坏形状：服务【不按】resourceId 收窄，一律回全量 —— 交集由页面本地匹配负责
// （:906 现状：服务端 resourceId 效果本环境未单独实测）。
function answer(): void {
  api.fetchJSON.mockImplementation(async (url: unknown) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      const id = paramOf(target, "id");
      return { audit: ALL.find((row) => row.eventId === id) ?? ALL[0] };
    }
    return { items: ALL, nextCursor: null };
  });
}

const clip: { calls: string[] } = { calls: [] };

function stubClipboard(): void {
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: async (text: string) => void clip.calls.push(text) },
    configurable: true,
  });
}

async function copiedLine(): Promise<string> {
  const before = clip.calls.length;
  await clickNode(node("aud-detail-copy"), "aud-detail-copy");
  await waitFor(() => clip.calls.length > before, "the line was copied");
  return clip.calls[clip.calls.length - 1];
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  clip.calls = [];
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

describe("R230 - the stacked question asks once and answers one intersection", () => {
  it("carries actorId and resourceId verbatim and paints only the overlap", async () => {
    await render(STACK2);
    expect(listReads()).toBe(1);
    const read = lastListRead();
    expect(paramOf(read, "actorId")).toBe(ACTOR);
    expect(paramOf(read, "resourceId")).toBe(RESOURCE_A);
    // 交集：服务回了两条，本地匹配只留下对得上句柄的那一条
    expect(paintedRows()).toEqual([ROW_A]);
    // 三值同数：读数行==表体==「将导出 N 条」
    expect(shownCount()).toBe(paintedRows().length);
    expect(exportCountDigits()).toBe(paintedRows().length);
    expect(textOf("aud01-status")).toContain("已显示 1 条");
    expect(chipKeys()).toContain("resource");
  });
});

describe("R230 - dropping the resource chip widens the answer at one ask", () => {
  it("re-asks exactly once without resourceId, keeps the operator, and recomputes all three", async () => {
    await render(STACK2);
    expect(paintedRows()).toEqual([ROW_A]);
    const before = pairs();
    const resourcePair = before.find((pair) => pair.startsWith("resource="));
    expect(resourcePair).toBeDefined();
    await removeChipOneAsk("resource");
    const read = lastListRead();
    // 被删的参数不再出现，留下的一字不动
    expect(paramOf(read, "resourceId")).toBeNull();
    expect(paramOf(read, "actorId")).toBe(ACTOR);
    // 地址只掉这一项
    const after = pairs();
    expect(after).toEqual(before.filter((pair) => pair !== resourcePair));
    // 行集与三值在新集合上重算 —— audT it6 只对了行集与「将导出」，读数行这枚是净新增
    expect(paintedRows()).toEqual([ROW_A, ROW_B]);
    expect(shownCount()).toBe(2);
    expect(exportCountDigits()).toBe(2);
    expect(textOf("aud01-status")).toContain("已显示 2 条");
    expect(chipKeys()).not.toContain("resource");
  });
});

describe("R230 - a stacked question with no overlap", () => {
  it("names the local miss in its own sentence and closes both doors", async () => {
    await render(STACK_NONE);
    expect(listReads()).toBe(1);
    expect(paramOf(lastListRead(), "resourceId")).toBe(RESOURCE_NONE);
    // 本地匹配清零：服务回了全量，页上一条都不留
    expect(paintedRows()).toEqual([]);
    expect(cellsCount()).toBe(0);
    // 现状两档阶梯：服务空答⇒句子无数字 + aud01-empty（R228①持有）；
    // 本地清零⇒读数行诚实报「已显示 0 条」（phase 还是 ready）+ aud9-local-empty 具名句，
    // 空态面板不抢话。工单③「不显裸 0」只对服务空答成立，这里按现状钉。
    expect(shownCount()).toBe(0);
    expect(textOf("aud01-status")).toContain("已显示 0 条");
    expect(textOf("aud9-local-empty")).toContain("这一页里没有对得上的记录");
    expect(textOf("aud9-local-empty")).toContain("本地匹配");
    expect(node("aud01-empty")).toBeNull();
    // 两枚导出各带原句，点了什么都不问
    const csv = node("aud01-export") as HTMLButtonElement | null;
    const filtered = node("aud5-export") as HTMLButtonElement | null;
    expect(csv?.disabled).toBe(true);
    expect(csv?.getAttribute("title")).toBe("当前筛选没有可导出的记录");
    expect(filtered?.disabled).toBe(true);
    expect(filtered?.getAttribute("title")).toBe("当前筛选无事件可导出");
    const before = urls();
    await clickNode(csv, "aud01-export");
    await clickNode(filtered, "aud5-export");
    expect(urls()).toEqual(before);
    expect(listReads()).toBe(1);
    // 工单③「aud-detail-copy 不渲」≠现状：它是可见禁用（R181⑤/R228④ 形制）
    const copy = node("aud-detail-copy") as HTMLButtonElement | null;
    expect(copy).not.toBeNull();
    expect(copy?.disabled).toBe(true);
    expect(copy?.getAttribute("title")).toBe(DETAIL_COPY_DISABLED_TITLE);
  });
});

describe("R230 - a new window keeps the pairing", () => {
  it("keeps actor and resource byte for byte while the span changes, and the instant stays one instant", async () => {
    await render(STACK2);
    const asks = listReads();
    await clickNode(node("aud01-filter-window-30d"), "aud01-filter-window-30d");
    await waitFor(() => listReads() === asks + 1, "the new span was asked");
    // 地址里两个参逐字保留
    const after = pairs();
    expect(after).toContain(`actor=${ACTOR}`);
    expect(after).toContain(`resource=${RESOURCE_A}`);
    // 线上：档位不上线，成对 from/to 换代为 30 天跨度，两参还在
    const read = lastListRead();
    expect(paramOf(read, "window")).toBeNull();
    expect(paramOf(read, "actorId")).toBe(ACTOR);
    expect(paramOf(read, "resourceId")).toBe(RESOURCE_A);
    expect(spanOf(read)).toBe(30);
    // 地址上的 window 按现状换代（7d→30d），两个问句参不受牵连
    expect(after).toContain("window=30d");
    // 换窗后的新语境里，行/详情/复制行三处还是同一时刻（四处口径归 R153/R208①）
    expect(paintedRows()).toEqual([ROW_A]);
    await openRecord(ROW_A);
    expect(markValue(`audJ-time-list-${ROW_A}`)).toBe(TIME_A);
    expect(markValue("audJ-time-detail")).toBe(TIME_A);
    const line = await copiedLine();
    expect(line).toContain(TIME_A);
    expect(line).toContain(WHO);
    expect(line).toContain(OBJECT_A);
    expect(line).toContain(ACTION_WORDS);
  });
});
