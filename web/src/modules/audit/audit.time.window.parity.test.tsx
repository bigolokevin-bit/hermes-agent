// @vitest-environment jsdom
// R229 — 时间窗与详情时间同源：换了窗就是换了答案，四处读数的必须是新答案，
// 旧答案【一处都不该留】。
//
// 已覆盖、这里不重写（只回证据）：
// - `audit.time.test.tsx`（R153）钉住了同一时刻在列/预览/面板/复制行四处同秒，
//   并登记【文件到分钟、屏上到秒】的精度口径（文件腿归 R153③/R205②）；
// - `audit.detail.fields.parity.test.tsx`（R208①④）钉住了四面逐字与 7d+actor 叠加；
// - `audit.export.columns.test.tsx`（R205④）钉住了 custom+actor+action 叠加下的三值与
//   文件每行同词；`audit.detail.counts.test.tsx`（R222①②）钉住了详情开合时三值不动；
// - `audit.detail.requests.test.tsx`（R196）/`audit.detail.crossfilter.test.tsx`（R201③）/
//   `audit.detail.list.parity.test.tsx`（R227②）钉住了开合恰一次 id= 详情读、列表不重取、
//   行序与读数行逐字 —— 工单④由此整体持有，本波只在换窗后的新语境里做防回归拼接。
//
// 本文件只补真正没拼过的 joints：
// ① 叠加 actor+action 语境下四面一次拼（时间上屏形态：列表标记=面板标记=读数行=复制行）；
// ② 【页内换窗】（aud01-filter-window-custom→audB-apply）后行集换代：新行上屏、
//   旧行整条消失、旧时刻不再出现在任何读数里，重开新记录后复制行是新时刻 ——
//   R201② 换的是同集窗（四面【不变】），换代无残留此前从未钉；
// ③ 换窗后三值三角（读数行==表体==「将导出 N 条」）在新行集上重新成立；
// ④ 新语境下开合防回归：恰 +1 详情读、列表零重取、行序与读数行逐字、关闭后复制钮回到
//   可见禁用。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
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
const RESOURCE = "ap_1122334455667788";
const OBJECT = "审批单 · 55667788";
const TIME_A = "2026-11-20 09:00:00";
const TIME_B1 = "2026-11-18 13:00:00";

const A1 = "evt_r229_alpha1_00001";
const A2 = "evt_r229_alpha2_00001";
const B1 = "evt_r229_bravo1_00001";
const B2 = "evt_r229_bravo2_00001";

// 换窗用的自定义区间：只罩住 B 日。输入写的是裸串，上线按现状换算成 ISO
// （R161/R208 口径：快捷档不上线，成对 from/to 才上线，且恒带毫秒）。
const CUSTOM_FROM = "2026-11-18T00:00";
const CUSTOM_TO = "2026-11-19T10:00";

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

function markValue(testId: string): string {
  return String(node(testId)?.getAttribute("data-audj-value") ?? "");
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
const detailReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";
const lastDetailUrl = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit-detail")) ?? "";

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
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

async function clickNode(target: Element | null | undefined, label: string): Promise<void> {
  expect(target, label).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function openRecord(id: string): Promise<void> {
  await clickNode(node(`aud01-cell-${id}-type`), `aud01-cell-${id}-type`);
  await waitFor(() => node("aud02-detail") !== null, `the detail of ${id} opened`);
}

async function closeRecord(): Promise<void> {
  await clickNode(node("aud8-back-to-list"), "aud8-back-to-list");
  await waitFor(() => node("aud02-detail") === null, "the detail closed");
}

async function setInput(testId: string, value: string): Promise<void> {
  const input = node(testId) as HTMLInputElement | null;
  expect(input, `${testId} exists`).toBeTruthy();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, value);
    input?.dispatchEvent(new Event("input", { bubbles: true }));
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

const ALL: Row[] = [
  rowOf(A1, "2026-11-20T01:00:00Z"),
  rowOf(A2, "2026-11-20T01:30:00Z"),
  rowOf(B1, "2026-11-18T05:00:00Z"),
  rowOf(B2, "2026-11-18T06:00:00Z"),
];

// 线路按 from 分集：罩住 11-18 的那一问回 B，其余（快捷 7 天≈11-14 起）回 A。
// 自定义两栏按现状换算是机器本地时区的裸串（+8 ⇒ from 落成 2026-11-17T16:00:00.000Z），
// 所以下界写在 11-17，不写成肉眼看到的 11-18。
function rowsFor(url: string): Row[] {
  const from = paramOf(url, "from") ?? "";
  return from >= "2026-11-17" && from < "2026-11-19"
    ? ALL.filter((row) => row.eventId.startsWith("evt_r229_b"))
    : ALL.filter((row) => row.eventId.startsWith("evt_r229_a"));
}

function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      const id = paramOf(target, "id");
      return { audit: ALL.find((row) => row.eventId === id) ?? ALL[0] };
    }
    return { items: rowsFor(target), nextCursor: null };
  });
}

// ── 复制行怎么到手：剪贴板在本侧留一份账 ─────────────────────────────────────
const clip = { calls: [] as string[] };

function stubClipboard(): void {
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.navigator, "clipboard", {
    value: {
      writeText: async (text: string) => {
        clip.calls.push(text);
      },
    },
    configurable: true,
  });
}

async function copiedLine(): Promise<string> {
  const grew = () => clip.calls.length > 0;
  const before = clip.calls.length;
  await clickNode(node("aud-detail-copy"), "aud-detail-copy");
  await waitFor(() => clip.calls.length > before || grew(), "the line was copied");
  return clip.calls[clip.calls.length - 1] ?? "";
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  clip.calls = [];
  stubClipboard();
  answer();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R229 - the stacked question, four faces at once", () => {
  it("prints the same instant in the row mark, the pane, the readout and the copied line", async () => {
    await render(`/audit?window=7d&actor=${encodeURIComponent(ACTOR)}&type=${ACTION}&limit=25`);
    const read = lastListRead();
    expect(paramOf(read, "actorId")).toBe(ACTOR);
    expect(paramOf(read, "action")).toBe(ACTION);
    // 现状：快捷档不上线，成对 from/to 才上线（audU/R161 口径，文件腿归 R153③/R205②）
    expect(paramOf(read, "window")).toBeNull();
    expect(paramOf(read, "from")).not.toBeNull();
    expect(paintedRows()).toEqual([A1, A2]);
    await openRecord(A1);
    expect(markValue(`audJ-time-list-${A1}`)).toBe(TIME_A);
    expect(markValue("audJ-time-detail")).toBe(TIME_A);
    expect(textOf("aud01-status")).toContain("已显示 2 条");
    const line = await copiedLine();
    expect(line).toContain(TIME_A);
    expect(line).toContain(WHO);
    expect(line).toContain(ACTION_WORDS);
    expect(line).toContain(OBJECT);
    // CSV 逐列腿由 R205②/R208④持有，这里不重跑文件
    for (const surface of [line, markValue("audJ-time-detail")]) {
      expect(surface).not.toContain(ACTOR);
      expect(surface).not.toContain(RESOURCE);
    }
  });
});

describe("R229 - changing the window changes the answer, everywhere at once", () => {
  it("swaps the row set and leaves no reading of the old window behind", async () => {
    await render(`/audit?window=7d&actor=${encodeURIComponent(ACTOR)}&type=${ACTION}&limit=25`);
    await openRecord(A1);
    expect(markValue("audJ-time-detail")).toBe(TIME_A);
    const lineA = await copiedLine();
    expect(lineA).toContain(TIME_A);

    const asks = listReads();
    await clickNode(node("aud01-filter-window-custom"), "aud01-filter-window-custom");
    await setInput("aud01-custom-from", CUSTOM_FROM);
    await setInput("aud01-custom-to", CUSTOM_TO);
    await clickNode(node("audB-apply"), "audB-apply");
    await waitFor(() => listReads() === asks + 1, "the new window asked exactly once");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    const read = lastListRead();
    expect(Date.parse(String(paramOf(read, "from")))).toBeLessThanOrEqual(
      Date.parse("2026-11-18T05:00:00Z"),
    );
    expect(Date.parse(String(paramOf(read, "to")))).toBeGreaterThanOrEqual(
      Date.parse("2026-11-18T06:00:00Z"),
    );
    // 换代：旧行整条消失，新行上屏 —— 行集【不并排】（整页替换现状归 R161/R212②）
    expect(paintedRows()).toEqual([B1, B2]);
    expect(node(`aud01-row-${A1}`)).toBeNull();
    // 现状钉：换窗时展开着的详情【留在屏上】，展示的还是那条旧记录 ——
    // 「换代无残留」的承诺落在列表与读数上，不落在已展开的抽屉上（若产品此后改了这条，钉子先红）。
    expect(markValue("audJ-time-detail")).toBe(TIME_A);
    // 读数行与导出计数在新行集上重新对齐（三值三角，CSV 行数腿归 R205①）
    expect(shownCount()).toBe(paintedRows().length);
    expect(exportCountDigits()).toBe(paintedRows().length);
    expect(textOf("aud01-status")).toContain("已显示 2 条");
    // 重开新记录：四处读的是新时刻，旧时刻从所有【当前】读数里退场
    await openRecord(B1);
    expect(markValue(`audJ-time-list-${B1}`)).toBe(TIME_B1);
    expect(markValue("audJ-time-detail")).toBe(TIME_B1);
    const lineB = await copiedLine();
    expect(lineB).toContain(TIME_B1);
    expect(lineB).not.toContain(TIME_A);
  });
});

describe("R229 - the new answer holds under close and reopen", () => {
  it("costs one read to open, nothing to close, and moves nothing else", async () => {
    await render(`/audit?window=7d&actor=${encodeURIComponent(ACTOR)}&type=${ACTION}&limit=25`);
    const rowsBefore = paintedRows();
    const statusBefore = textOf("aud01-status");
    const callsBefore = urls().length;
    await openRecord(A1);
    expect(detailReads()).toBe(1);
    expect(paramOf(lastDetailUrl(), "id")).toBe(A1);
    expect(listReads()).toBe(1);
    await closeRecord();
    // 工单④主体由 R196/R201③/R208③/R222①②/R227②持有；这条是换不了语境也跑一遍的防回归
    expect(detailReads()).toBe(1);
    expect(listReads()).toBe(1);
    expect(urls().length).toBe(callsBefore + 1);
    expect(paintedRows()).toEqual(rowsBefore);
    expect(textOf("aud01-status")).toBe(statusBefore);
    // 现状：关闭后复制钮回到【未选中】那张脸 —— 可见且禁用，带原因（R222②口径）
    const copy = node("aud-detail-copy") as HTMLButtonElement | null;
    expect(copy).not.toBeNull();
    expect(copy?.disabled).toBe(true);
    expect(copy?.getAttribute("title")).toBe(DETAIL_COPY_DISABLED_TITLE);
  });
});
