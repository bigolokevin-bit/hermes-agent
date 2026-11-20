// @vitest-environment jsdom
// R237 — 审计行复制在筛选叠加下的稳定性。复制这句话不是第二套格式化：
// 它读的就是屏幕上那几段话本身，筛选换了、行集换代了，它也必须跟着换，
// 而且一句都不多——筛选参的原文不该混进复制句里。
//
// 已覆盖、这里不重写（只回证据）：
// - `audit.actor.copy.test.tsx`（R235）钉住了 ?window=7d&actor= 语境下逐行复制
//   与屏上时间/actor 名+短码逐字、缺值两处各自口径、切 actor 后整页换代无残留；
// - `audit.list.order.stability.test.tsx`（R236）钉住了 CSV 数据行【按位置】==表体序、
//   复制与导出点击的 fetchJSON 账本逐字不变（本文件的行序主张不再重写）；
// - `audit.filters.test.tsx`（R133）钉住了非法档位/limit 从不改写地址；
// - `audit.export.test.tsx`（R141）钉住了导出三角与资源本地收窄；
// - `audit.empty.test.tsx`（R181⑤）钉住了空态下 aud-detail-copy 的形制——
//   【可见但禁用】，不是不渲染；`audit.error.empty.test.tsx`（R226③）把同一形制
//   移进了错误态；`audit.export.empty.test.tsx`（R228）钉住了 doors 的禁用↔放行转换；
// - `audit.export.columns.test.tsx`（R205⑤）钉住了空集时 createObjectURL 调用数为 0。
// 工单提到的 R193 经现场 `git grep` 不在本道，不臆测其范围。
//
// 本文件只补真正的新东西：
// ① 7d+actor+action 【三参】叠加时逐行复制与屏上逐字，且复制句不含筛选参原文
//    （R235 是 7d+actor 两参，且从不钉过 `actor=`/`type=` 这类参数字面）；
// ② 移掉 actor chip 之后复制文本【随行换代】：A 行的句子还是 A 的，B 行的句子是 B 的，
//    无串号无残留（R214②/R236③ 重算的是计数与行集，没跟过复制句）；
// ③ 三参叠加而服务空答时：doors 禁用+原文标题+点击零请求+连 Blob 都不建，
//    并把 aud-detail-copy 的【visible-disabled】现状钉进这个语境——工单说「不渲复制钮」
//    与现状不符，按现状钉并在此登记（口径差）。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { DETAIL_COPY_DISABLED_TITLE } from "@/modules/audit/detailCopy";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTOR_A = "user:2f3a4b5c6d7e8f90";
const WHO_A = "李思 · 6d7e8f90";
const ACTOR_B = "user:cafe1234beef5678";
const WHO_B = "王五 · beef5678";
const ACTION = "task.created";
const ACTION_WORDS = "创建任务";
const NOPE = "__nope__";
const RESOURCE = "ap_1122334455667788";
const OBJECT = "审批单 · 55667788";
const ZONE = "北京时间（UTC+8）";

const ROW_N = "evt_r237_nov1_00000001";
const ROW_M = "evt_r237_mike1_00000001";
const ROW_K = "evt_r237_kilo1_00000001";

const STACKED = `/audit?window=7d&actor=${encodeURIComponent(ACTOR_A)}&type=${ACTION}&limit=25`;
const NOPED = `/audit?window=7d&actor=${encodeURIComponent(ACTOR_A)}&type=${NOPE}&limit=25`;

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
    occurredAt: `2026-11-19T01:${instant}:00Z`,
    outcome: "succeeded",
    actor: { type: "human", id: handle, displayName: name },
    resource: { type: "approval", id: RESOURCE },
    requestId: `req-${eventId}`,
  };
}

const ROWS: Row[] = [
  rowOf(ROW_N, ACTOR_A, "李思", "22"),
  rowOf(ROW_M, ACTOR_A, "李思", "21"),
  rowOf(ROW_K, ACTOR_B, "王五", "20"),
];

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

/** Field 的值只在 dd。 */
function fieldValue(testId: string): string {
  return node(testId)?.querySelector("dd")?.textContent?.trim() ?? "";
}

function markValue(testId: string): string {
  return node(testId)?.getAttribute("data-audj-value") ?? "";
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

const cellsCount = (): number =>
  document.querySelectorAll("[data-testid^='aud01-cell-']").length;

function chipKeys(): string[] {
  return Array.from(document.querySelectorAll("[data-testid^='aud-chip-']"))
    .map((element) => String(element.getAttribute("data-testid")).replace("aud-chip-", ""))
    .filter((key) => !key.endsWith("-clear"));
}

/** 读数行「已显示 N 条」里的 N；句子档没有数字。 */
function shownCount(): number {
  const digits = /(\d+)/.exec(textOf("aud01-status"));
  return digits ? Number(digits[1]) : -1;
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

function clickNodeSync(testId: string): void {
  const target = node(testId);
  expect(target, testId).not.toBeNull();
  (target as HTMLElement).dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true }),
  );
}

async function openRecord(eventId: string): Promise<void> {
  clickNodeSync(`aud01-cell-${eventId}-type`);
  await waitFor(() => node("aud02-detail") !== null, "the record pane opened");
}

async function closeRecord(): Promise<void> {
  clickNodeSync("aud8-back-to-list");
  await waitFor(() => node("aud02-detail") === null, "the record pane closed");
}

// ── 剪贴板：复制句从 navigator.clipboard 里读，不发任何请求 ──────────────────
const clip: { calls: string[] } = { calls: [] };

function stubClipboard(): void {
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: true,
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (text: string) => {
        clip.calls.push(text);
        return Promise.resolve();
      },
    },
  });
}

async function copiedLine(): Promise<string> {
  const grew = clip.calls.length;
  await clickNode(node("aud-detail-copy"), "aud-detail-copy");
  await waitFor(() => clip.calls.length > grew, "the copied line landed in the clipboard");
  return clip.calls[clip.calls.length - 1];
}

// ── Blob 账本：空答时连一个文件都不该被造出来 ───────────────────────────────
const made = { urls: 0 };

function watchBlobs(): void {
  made.urls = 0;
  URL.createObjectURL = (() => {
    made.urls += 1;
    return `blob:r237-${made.urls}`;
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
}

/**
 * 移除一枚 chip 的账本钉子（相对基线，R224 同款）：
 * 问题变了 ⇒ 恰一次新的列表取数，总请求账也只 +1。
 */
async function removeChipOneAsk(key: string): Promise<void> {
  const asks = listReads();
  const calls = urls().length;
  await clickNode(node(`aud-chip-${key}-clear`), `aud-chip-${key}-clear`);
  await waitFor(() => listReads() === asks + 1, `one new read after removing the ${key} chip`);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  expect(urls().length).toBe(calls + 1);
}

function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      return { audit: ROWS.find((row) => row.eventId === paramOf(target, "id")) ?? ROWS[0] };
    }
    const actor = paramOf(target, "actorId");
    const action = paramOf(target, "action");
    if (actor === ACTOR_A && action === ACTION) return { items: [ROWS[0], ROWS[1]], nextCursor: null };
    if (actor === ACTOR_A && action === NOPE) return { items: [], nextCursor: null };
    return { items: ROWS, nextCursor: null };
  });
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  clip.calls = [];
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

describe("R237 - the copied sentence is the screen's own words, with the action filter on too", () => {
  it("copies what the row shows — and carries nothing of the query that produced it", async () => {
    await render(STACKED);
    // 三参各走各的键：档位化成 from/to 对，地址 type= 上线才 action=（既有口径）
    const read = lastListRead();
    expect(paramOf(read, "actorId")).toBe(ACTOR_A);
    expect(paramOf(read, "action")).toBe(ACTION);
    expect(paramOf(read, "window")).toBeNull();
    expect(paintedRows()).toEqual([ROW_N, ROW_M]);
    for (const eventId of paintedRows()) {
      const row = ROWS.find((item) => item.eventId === eventId) as Row;
      await openRecord(eventId);
      const line = await copiedLine();
      // 时间：屏上到秒的那一段逐字开头（分秒阶梯由 R153 持有，CSV 侧不重写）
      const instant = markValue(`audJ-time-list-${eventId}`);
      expect(line.startsWith(`${instant} ${ZONE}`)).toBe(true);
      // actor：显示名+8 位短码，就是表体那一格的原文；动作是人话不是事件码
      expect(fieldValue(`aud01-cell-${eventId}-actor`)).toBe(WHO_A);
      expect(line).toContain(WHO_A);
      expect(line).toContain(ACTION_WORDS);
      expect(line).toContain(OBJECT);
      // 筛选参的原文一个字都不该混进来：句柄、键名、事件码都不是这句话的词
      expect(line).not.toContain(ACTOR_A);
      expect(line).not.toContain(ACTOR_B);
      expect(line).not.toContain("actor=");
      expect(line).not.toContain("type=");
      expect(line).not.toContain("window=");
      expect(line).not.toContain(row.action);
      await closeRecord();
    }
  });
});

describe("R237 - when the operator chip goes, the sentences change rows with the rows", () => {
  it("replaces the page at one ask and every row's copy becomes that row's own", async () => {
    await render(STACKED);
    expect(paintedRows()).toEqual([ROW_N, ROW_M]);
    expect(chipKeys()).toContain("actor");
    // 换代前：每一句都是 A 的行，句里只有李思
    await openRecord(ROW_N);
    expect(await copiedLine()).toContain(WHO_A);
    await closeRecord();

    await removeChipOneAsk("actor");
    // 恰一次重新提问（账本在 helper 里）；线路不再问这个人，action 逐字留着
    expect(paramOf(lastListRead(), "actorId")).toBeNull();
    expect(paramOf(lastListRead(), "action")).toBe(ACTION);
    expect(paintedRows()).toEqual([ROW_N, ROW_M, ROW_K]);
    expect(chipKeys()).not.toContain("actor");

    // 读数行与表体一致（三角本体由 R205①/R214② 持有，这里只钉换代后的这一眼）
    expect(shownCount()).toBe(paintedRows().length);

    // 复制文本随行换代：A 的行仍是 A 的句子，B 的行是 B 的句子，谁也不串谁
    for (const eventId of paintedRows()) {
      await openRecord(eventId);
      const line = await copiedLine();
      const owner = eventId === ROW_K ? WHO_B : WHO_A;
      const other = eventId === ROW_K ? WHO_A : WHO_B;
      expect(line.startsWith(`${markValue(`audJ-time-list-${eventId}`)} ${ZONE}`)).toBe(true);
      expect(line).toContain(owner);
      expect(line).not.toContain(other);
      await closeRecord();
    }
  });
});

describe("R237 - a stacked question with nothing in the answer", () => {
  it("keeps both doors shut, builds nothing, and leaves the copy button visible but disabled", async () => {
    await render(NOPED);
    expect(listReads()).toBe(1);
    // 服务的空答：这一档是句子没有数字（本地清零是另一档，见 R230 登记）
    expect(paintedRows()).toEqual([]);
    expect(cellsCount()).toBe(0);
    expect(shownCount()).toBe(-1);
    expect(textOf("aud01-status")).toContain("这个筛选条件里没有审计事件");
    const csv = node("aud01-export") as HTMLButtonElement | null;
    const filtered = node("aud5-export") as HTMLButtonElement | null;
    expect(csv?.disabled).toBe(true);
    expect(csv?.getAttribute("title")).toBe("当前筛选没有可导出的记录");
    expect(filtered?.disabled).toBe(true);
    expect(filtered?.getAttribute("title")).toBe("当前筛选无事件可导出");
    const before = urls();
    await clickNode(csv, "aud01-export");
    await clickNode(filtered, "aud5-export");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(urls()).toEqual(before);
    expect(listReads()).toBe(1);
    expect(made.urls).toBe(0);
    // 工单说「无结果时不渲复制钮」——现状是【渲染但禁用】，按现状钉（口径差在文件头登记）
    const copy = node("aud-detail-copy") as HTMLButtonElement | null;
    expect(copy).not.toBeNull();
    expect(copy?.disabled).toBe(true);
    expect(copy?.getAttribute("title")).toBe(DETAIL_COPY_DISABLED_TITLE);
  });
});
