// @vitest-environment jsdom
// R222 — 详情开合不许动计数：三值三角（读数行 / 表体 / 导出行数）在详情开着、关上、
// 详情自己读失败时，都必须一个字都不变。
//
// 已覆盖、这里不重写（只回证据）：
// - R220 it④（`audit.fields.edge.test.tsx`）钉住了筛选+游标栈第 2 页上开→关：恰一笔详情读、
//   `aud01-status` 逐字、行序逐字、地址只删记录键 —— 但没有导出行数这条边，也没有复制件；
// - R208 it③ / R196 it1-2 钉住了裸地址与单类型筛选下开→关的请求账本与地址腿；
// - R201 it1 钉住了 7d 档 + 四参叠加下 行×详情×复制行 的逐字同源；R113 it2 钉住了
//   `?event=` 定位时地址逐字保留与「定位不加详情读」的现状；
// - 主测 `AuditEventsModulePage.test.tsx` :2487/:2523/:2541 钉住了详情读口三面同句、
//   每口重试恰 +1 且不动别的读口；R213 钉住了列表读口的错误态四件套。
//
// 本文件只补真正没拼过的：
// ① window+actor+action 三参叠加下【开着详情】时三值三角仍逐字不动，且开着详情导出的
//    文件行数还是同一个 N（详情不改变筛选集合 —— R220 只关了没开过第二次，也没碰文件）；
// ② 关闭后三值仍相等、行序逐字；复制件按现状钉：关闭会把选中态的复制件整个卸载，
//    回到的是「未选中」那枚 disabled+原因句的新实例（states.tsx 的 drawer 两个分支），
//    工单说的「内容不变」在现状里能兑现的形式是【重开同一条，复制行逐字相同】—— 照这个钉；
// ③ `?event=` 与筛选叠加：定位零详情读（R113 现状），行点开后才 +1；详情标记与列表标记
//    逐字（时间/操作者）、对象与动作同词，地址保住其余参 —— R201 是 7d 档无 event，这一拼新；
// ④ 详情读 500 时【列表三值不动】：错误面板带可复制 rid，重试恰 +1 一笔（只动详情读口），
//    成功后三角复原 —— 主测钉了句与每口 +1，没把三值三角摆进来。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import { ApiError } from "@/lib/api-error";
import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { DETAIL_COPY_DISABLED_TITLE } from "@/modules/audit/detailCopy";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe(): React.ReactElement {
  const location = useLocation();
  return <div data-testid="probe-location" data-search={location.search} />;
}

const ACTOR = "user:2f3a4b5c6d7e8f90";
const WHO = "李思 · 6d7e8f90";
const ACTION = "task.created";
const ACTION_WORDS = "创建任务";
const RESOURCE = "ap_1122334455667788";
const OBJECT = "审批单 · 55667788";
const FROM = "2026-11-05T02:00:00Z";
const TO = "2026-11-19T02:00:00Z";
const BASE = `/audit?window=custom&from=${FROM}&to=${TO}`;
const FILTERED = `${BASE}&actor=${encodeURIComponent(ACTOR)}&type=${ACTION}&limit=25`;

const ROW_A = "evt_r222_alpha_00001";
const ROW_B = "evt_r222_beta_000001";
const ROW_L = "evt_r222_locus_00001";
const RID_FAIL = "rid-r222-d500";

let root: Root | null = null;
const mode = { failDetailOnce: false };
let detailTries = 0;

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
  return node(testId)?.textContent ?? "";
}

/** Field 的值只在 dd：dt 是标签。 */
function fieldValue(testId: string): string {
  return node(testId)?.querySelector("dd")?.textContent?.trim() ?? "";
}

/** 同源标记：data-audj-value 是这一族刻在件上的原值。 */
function markValue(testId: string): string {
  return node(testId)?.getAttribute("data-audj-value") ?? "";
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
const detailReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length;

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}

function pairs(): string[] {
  const search = node("probe-location")?.getAttribute("data-search") ?? "";
  return search
    .replace(/^\?/, "")
    .split("&")
    .filter((pair) => pair !== "")
    .map((pair) => decodeURIComponent(pair));
}

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

function shownCount(): number {
  const digits = /(\d+)/.exec(textOf("aud01-status"));
  return digits ? Number(digits[1]) : -1;
}

function exportCountDigits(): number {
  const digits = /(\d+)/.exec(textOf("aud5-export-count"));
  return digits ? Number(digits[1]) : -1;
}

/** 三值三角的当前读数：读数行数字、表体行数、导出计数 —— 一起取，一起比。 */
function triangle(): { status: number; rows: number; exportCount: number } {
  return { status: shownCount(), rows: paintedRows().length, exportCount: exportCountDigits() };
}

async function clickNode(target: Element | null | undefined, label: string): Promise<void> {
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

async function openRecord(id: string): Promise<void> {
  await clickNode(node(`aud01-cell-${id}-type`), `open ${id}`);
}

async function closeRecord(): Promise<void> {
  await clickNode(node("aud8-back-to-list"), "aud8-back-to-list");
  await waitFor(() => document.querySelector("[data-testid='aud02-detail']") === null, "detail gone");
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

function rowOf(eventId: string, over: Partial<Row> = {}): Row {
  return {
    eventId,
    action: ACTION,
    occurredAt: "2026-11-19T01:20:00Z",
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: RESOURCE },
    requestId: `req-${eventId}`,
    ...over,
  };
}

const ROWS: Row[] = [
  rowOf(ROW_A),
  rowOf(ROW_B, { occurredAt: "2026-11-19T01:21:00Z" }),
  rowOf(ROW_L, { occurredAt: "2026-11-19T01:22:00Z" }),
];

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
      const id = paramOf(target, "id");
      const found = ROWS.find((row) => row.eventId === id);
      return { audit: found ?? ROWS[0] };
    }
    return { items: ROWS, nextCursor: null };
  });
}

// ── 文件怎么到手（①要用文件行数当第三条边）──────────────────────────────────
const blobs = new Map<string, Blob>();
const captured: { name: string; text: string } = { name: "", text: "" };

function watchBlobs(): void {
  blobs.clear();
  captured.name = "";
  captured.text = "";
  URL.createObjectURL = ((blob: Blob) => {
    const url = `blob:r222-${blobs.size + 1}`;
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
    if (blob) void blob.text().then((text) => (captured.text = text));
  });
}

function dataLines(): string[] {
  return captured.text
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .filter((line) => line !== "")
    .slice(1);
}

async function exportRowCount(): Promise<number> {
  captured.text = "";
  await clickNode(node("aud01-export"), "aud01-export");
  await waitFor(() => captured.text !== "", "the export was handed over");
  return dataLines().length;
}

// ── 复制件（②要用）：剪贴板收进 clip.calls ──────────────────────────────────
const clip: { calls: string[] } = { calls: [] };

function stubClipboard(): void {
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text: string) => void clip.calls.push(text) },
  });
}

async function copiedLine(): Promise<string> {
  const before = clip.calls.length;
  await clickNode(node("aud-detail-copy"), "aud-detail-copy");
  await waitFor(() => clip.calls.length > before, "the copy landed");
  return clip.calls[clip.calls.length - 1];
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  clip.calls.length = 0;
  detailTries = 0;
  mode.failDetailOnce = false;
  stubClipboard();
  watchBlobs();
  answer();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R222 ① - an open record moves none of the three counts", () => {
  it("keeps readout, table and export at one number while the detail is open", async () => {
    await render(FILTERED);
    const read = urls().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";
    expect(paramOf(read, "actorId")).toBe(ACTOR);
    expect(paramOf(read, "action")).toBe(ACTION);
    const before = triangle();
    expect(before.status).toBe(3);
    expect(before.status).toBe(before.rows);
    expect(before.rows).toBe(before.exportCount);
    expect(await exportRowCount()).toBe(before.rows);

    await openRecord(ROW_A);
    await waitFor(() => document.querySelector("[data-testid='aud02-detail']") !== null, "detail painted");
    // 列表一个字节都没重取，详情恰一笔
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(1);
    // 三值逐项逐字不动
    expect(shownCount()).toBe(before.status);
    expect(textOf("aud01-status")).toContain(`已显示 ${before.status} 条`);
    expect(paintedRows()).toEqual([ROW_A, ROW_B, ROW_L]);
    expect(exportCountDigits()).toBe(before.exportCount);
    // 开着详情导出，文件行数还是同一个数
    expect(await exportRowCount()).toBe(before.rows);
  });
});

describe("R222 ② - closing keeps the counts, the order, and the copied line", () => {
  it("still agrees on all three after the record is folded away", async () => {
    await render(FILTERED);
    const before = triangle();
    const line1 = await (async () => {
      await openRecord(ROW_A);
      await waitFor(() => document.querySelector("[data-testid='aud02-detail']") !== null, "detail painted");
      return copiedLine();
    })();
    expect(line1).toContain(WHO);
    expect(line1).toContain(ACTION_WORDS);
    expect(line1).toContain(OBJECT);

    await closeRecord();
    // 三值仍相等、行序逐字 —— 地址里不再有记录键
    expect(shownCount()).toBe(before.status);
    expect(paintedRows()).toEqual([ROW_A, ROW_B, ROW_L]);
    expect(exportCountDigits()).toBe(before.exportCount);
    expect(listReads()).toBe(1);
    expect([...pairs()].some((pair) => pair.startsWith("detail="))).toBe(false);
    // 现状：关闭把选中态的复制件整个卸载，回到的是「未选中」实例 —— disabled + 原因句，
    // 状态句清空。工单说的「内容不变」在现状里兑现的形式是下一条：重开逐字同一条。
    const copy = node("aud-detail-copy") as HTMLButtonElement | null;
    expect(copy?.disabled).toBe(true);
    expect(copy?.getAttribute("title")).toBe(DETAIL_COPY_DISABLED_TITLE);
    expect(textOf("aud-detail-copy-status")).toBe("");

    await openRecord(ROW_A);
    await waitFor(() => document.querySelector("[data-testid='aud02-detail']") !== null, "detail repainted");
    expect(await copiedLine()).toBe(line1);
  });
});

describe("R222 ③ - a located row opens without moving anything", () => {
  it("prints the same words in row and detail and keeps the rest of the address", async () => {
    await render(`${FILTERED}&event=${ROW_L}`);
    // R113 现状：定位到表内的行不加详情读，只是把那行翻开并展开
    expect(textOf("aud9-deeplink-found")).toContain("已按链接定位到这条事件并展开");
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(0);
    const before = triangle();
    expect(before.status).toBe(3);

    await openRecord(ROW_L);
    await waitFor(() => document.querySelector("[data-testid='aud02-detail']") !== null, "detail painted");
    expect(detailReads()).toBe(1);
    expect(listReads()).toBe(1);
    // 逐字：时间与操作者的同源标记、对象与动作的词
    expect(markValue(`audJ-time-list-${ROW_L}`)).toBe(markValue("audJ-time-detail"));
    expect(markValue(`audJ-actor-list-${ROW_L}`)).toBe(markValue("audJ-actor-detail"));
    expect(markValue("audJ-time-detail")).toBe("2026-11-19 09:22:00");
    expect(fieldValue("audA-detail-actor")).toBe(WHO);
    expect(fieldValue("audA-detail-resource")).toBe(OBJECT);
    expect(textOf("audA-detail-type")).toContain(ACTION_WORDS);
    // 三值不动，地址保住其余参
    expect(triangle()).toEqual(before);
    const kept = [...pairs()];
    for (const pair of [
      "window=custom",
      `from=${FROM}`,
      `to=${TO}`,
      `actor=${ACTOR}`,
      `type=${ACTION}`,
      "limit=25",
    ]) {
      expect(kept, `address keeps ${pair}`).toContain(pair);
    }
  });
});

describe("R222 ④ - a failing detail leaves the list untouched", () => {
  it("holds the three counts, offers a copyable trace id, and retries exactly once", async () => {
    mode.failDetailOnce = true;
    await render(FILTERED);
    const before = triangle();

    await openRecord(ROW_B);
    await waitFor(() => document.querySelector("[data-testid='aud02-detail-error']") !== null, "detail error painted");
    expect(textOf("aud02-detail-error")).toContain("这条事件没能加载出来");
    // rid 上屏且可复制
    expect(textOf("aud02-detail-error-request-id")).toContain(RID_FAIL);
    expect(node("aud02-detail-error-request-id-value")).not.toBeNull();
    // 列表三值一个不动：详情失败不许把表拖成裸 0 或空面板
    expect(textOf("aud01-status")).toContain(`已显示 ${before.status} 条`);
    expect(shownCount()).toBe(before.status);
    expect(paintedRows()).toEqual([ROW_A, ROW_B, ROW_L]);
    expect(exportCountDigits()).toBe(before.exportCount);
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(1);

    const panel = node("aud02-detail-error");
    const retry = Array.from(panel?.querySelectorAll("button") ?? []).find((button) =>
      (button.textContent ?? "").includes("重试"),
    );
    await clickNode(retry, "detail retry");
    await waitFor(() => document.querySelector("[data-testid='aud02-detail']") !== null, "detail painted");
    // 重试恰 +1，且只动详情读口
    expect(detailReads()).toBe(2);
    expect(listReads()).toBe(1);
    expect(node("aud02-detail-error")).toBeNull();
    expect(triangle()).toEqual(before);
  });
});
