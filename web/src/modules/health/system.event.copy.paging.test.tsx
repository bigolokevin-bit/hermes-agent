// @vitest-environment jsdom
/**
 * R235 — 事件表「第 2 页 / 切窗」后复制串与导出文件按位置一一对应的护栏（纯测试，产品码零改动）。
 *
 * 派工面与实际面（如实记账，不编造锚点）：
 * - `sys-evt-copy-<i>` / `sys-evt-count` 本代不存在（第 28 条道确认）：
 *   `git grep -n -E "sys-evt|sysEventCopyText|evt-copy|evt-more|evt-count" -- web/src`
 *   共 30 处命中，全部是既有注脚与我自己写的缺席断言（`system.window.isolation:6/7/231/299`、
 *   `system.event.export:5/6/46/260`、`system.event.combo:6/12/304/347`、
 *   `system.cross.failure:6/10/390-391`、`system.refresh.race:44/485/527`、
 *   `system.event.rows:6/7/207`、`system.cross.isolation:6/7/12`、`system.time:8`、
 *   `system.state.isolation:18`、`system.matrix.export:6`、`system.filters:14`、`system.empty:13`）；
 *   health 产品码里 `sys-evt` 命中数为 0。事件表真面在 `modules/audit/AuditEventsModulePage`，
 *   本文件按派工单的文件名落在 health 目录下、挂载 audit 页面（R135 / R221 / R225 已立的习语，在此声明）。
 * - 「序号连续」在产品里没有序号：逐行复制 affordance 是按行 id 键控的
 *   `aud01-cell-<key>-request-value`（有值才渲染，按钮 aria-label「复制请求编号」，走可 mock 的
 *   `copyTextToClipboard` 助手），无值行给 `-request-value-absent`（文案「该字段未返回」，不给死按钮）。
 *   所以本文件把「序号」如实钉成【控件集合与屏上行按 DOM 序 1:1 同序】，并再加一层
 *   【第 i 句复制 == 文件第 i 条记录的请求编号格】——这一层是本文件的真缺口。
 *
 * 既有用例已覆盖，本文件不重写（派工单「已覆盖只回证据 + 文件:行」纪律）：
 * - 本波上游刚落地的三份 audit 用例几乎逐条对上派工三例，先记账：
 *   `audit.copy.paged.test.tsx`（上游标 R241）:325/:326 «the second page copies the same words
 *   the screen shows / hands over one row per painted line, and the sentence matches both faces»
 *   与 :364/:365 «paging then widening still recomputes without residue / drops the cursor on the
 *   window switch and keeps every row's copy its own»；
 *   `audit.filter.paging.export.test.tsx`（上游标 R243）:311/:312 «widening the window swaps the
 *   whole page, copies follow / clears the cursor, replaces the row set and leaves no reading of
 *   the narrow window»、:348/:349 «the file walks in the table's order under the stacked question»、
 *   :369/:370 抽屉开合不动页账；`audit.detail.paging.stability.test.tsx`（上游标 R242）:291/:292
 *   «a failing drawer on page two leaves the page alone»。它们都挂在裸 `/audit` 单面挂载上，
 *   且没有把「复制串」与「文件那一格」按位置对撞；本文件的两条都在 `?tab=events` 组合地址上做这件事。
 * - 我自己的 R225 `system.event.rows.test.tsx`:198（切窗行集换代、两枚读数条同数、`cursorsOf === []`、
 *   字面 +1 读）与 :261（翻页与切窗后逐行复制控件 1:1 重映射、复制就是该行自己的 id、零额外请求）；
 *   R221 `system.event.export.test.tsx`:241（首页三值同源 + 逐行控件数只数带 rid 的行）、:276（切窗后
 *   文件换代、五个旧窗标记逐项缺席、tab 逐字、导出点击零请求）、:365（空集门关死、强点零 Blob）。
 * - ③「第 2 页 500 保旧行」与产品相反，不在此伪造：走 `aud01-load-more` 的失败是非追加失败，
 *   rows 被清、rid 可复制、重试恰 +1 —— 上游 R161 `audit.paging.test.tsx`:339 已钉，且 :361 断言
 *   `aud01-page-failure` 为 null；真正「保旧行」的追加腿唯一调用点是它自己那颗重试按钮，现界面够不到
 *   （R161 头 :19-21 记账）。失败态两枚导出门关掉、点击不建文件由 R213 `audit.error.test.tsx`:328 钉，
 *   抽屉读失败而列表不动由 R242 :292 钉。本文件因此不写 ③，只回证据。
 * - ①的三值与②的换代本身也已覆盖（R221 :241 / R225 :198 / R241 :326 / R243 :312 / R236
 *   `audit.list.order.stability.test.tsx`:327-362 的位置序复制 parity）；本文件只补上面声明的
 *   「复制串 ≡ 文件请求编号格」这一层，以及它在第 2 页与切窗后两次成立。
 *
 * 本文件不新增任何 testid。冻结族只读：`aud01-row-*`、`aud01-cell-<key>-*`、`aud01-status`、
 * `aud01-export`、`aud01-export-status`、`aud5-export-count`、`aud01-load-more`、`aud2-page`、
 * `aud2-prev`、`aud01-filter-window-<key>`、`agent-v2-page-audit`、`sys*`。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));
const clipboard = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clipboard.copyTextToClipboard }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let restoreDownload: (() => void) | null = null;
let captured = "";
let capturedName = "";
let blobCalls = 0;
let urlCalls = 0;

/** 迭代封顶而非墙钟：本文件不冻结 Date，但既有坑要求写法一致。 */
async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  for (let i = 0; i < 600; i += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error(`waitFor: ${label} never became true`);
}

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="probe-location">{`${loc.pathname}${loc.search}`}</span>;
}
const address = (): string => document.querySelector("[data-testid='probe-location']")?.textContent ?? "";
const paramOf = (url: string, key: string): string | null =>
  new URL(url, "http://console.test").searchParams.get(key);
const cursorsOf = (url: string): string[] =>
  [...new URL(url, "http://console.test").searchParams.getAll("cursor")];
const windowHours = (url: string): number => {
  const from = Date.parse(paramOf(url, "from") ?? "");
  const to = Date.parse(paramOf(url, "to") ?? "");
  return (to - from) / 3_600_000;
};

const urls = (): string[] =>
  api.fetchJSON.mock.calls.map((call) => String(call[0])).filter((url) => url !== "undefined");
const listReads = (): number => urls().filter((url) => /^\/agent-api\/api\/audit\?/.test(url)).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";

/** 屏上真实行，DOM 序，取事件 id。 */
function paintedRows(): string[] {
  return Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((node) =>
    (node.getAttribute("data-testid") ?? "").replace("aud01-row-", ""),
  );
}
/** 带请求编号的行：值列存在（`CopyValue` 只在有值时渲染这个 testid）。 */
function valueKeys(): string[] {
  return Array.from(
    document.querySelectorAll("[data-testid^='aud01-cell-'][data-testid$='-request-value']"),
  ).map((node) =>
    (node.getAttribute("data-testid") ?? "").replace("aud01-cell-", "").replace("-request-value", ""),
  );
}
/** 没带请求编号的行：只给一枚说明节点，不给死按钮。 */
function absentKeys(): string[] {
  return Array.from(
    document.querySelectorAll("[data-testid^='aud01-cell-'][data-testid$='-request-value-absent']"),
  ).map((node) =>
    (node.getAttribute("data-testid") ?? "")
      .replace("aud01-cell-", "")
      .replace("-request-value-absent", ""),
  );
}
const textOf = (testId: string): string =>
  document.querySelector(`[data-testid='${testId}']`)?.textContent?.trim() ?? "";
/** 值列屏上的那一句文字：`CopyValue` 的外层是 testid 节点，内层 mono span 才是屏上形，title 是全形。 */
function screenRid(key: string): string {
  const cell = document.querySelector(`[data-testid='aud01-cell-${key}-request-value']`);
  return cell?.firstElementChild?.textContent?.trim() ?? "";
}

async function clickTestId(testId: string, label: string): Promise<void> {
  const node = document.querySelector<HTMLButtonElement>(`[data-testid='${testId}']`);
  if (!node) throw new Error(`missing clickable node: ${label} (${testId})`);
  await act(async () => {
    node.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** 复制某一行的请求编号，返回落到剪贴板的那一句。 */
async function copyRow(key: string): Promise<string> {
  const cell = document.querySelector(`[data-testid='aud01-cell-${key}-request-value']`);
  if (!cell) throw new Error(`missing copy affordance for row ${key}`);
  const button = cell.querySelector<HTMLButtonElement>("button[aria-label='复制请求编号']");
  if (!button) throw new Error(`missing copy button inside row ${key}`);
  clipboard.copyTextToClipboard.mockClear();
  await act(async () => {
    button.click();
    await Promise.resolve();
  });
  await waitFor(() => clipboard.copyTextToClipboard.mock.calls.length > 0, `copy landed for ${key}`);
  return String(clipboard.copyTextToClipboard.mock.lastCall?.[0] ?? "");
}

/** 下载捕获：RecordingBlob 记内容，anchor 间谍记文件名，URL 桩记「有没有被调用」。 */
function captureDownload(): void {
  captured = "";
  capturedName = "";
  blobCalls = 0;
  urlCalls = 0;
  const OriginalBlob = window.Blob;
  const clickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      capturedName = this.download;
    });
  class RecordingBlob extends OriginalBlob {
    constructor(parts: BlobPart[], options?: BlobPropertyBag) {
      super(parts, options);
      captured = String(parts[0] ?? "");
      blobCalls += 1;
    }
  }
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  Object.defineProperty(window, "Blob", { configurable: true, writable: true, value: RecordingBlob });
  URL.createObjectURL = vi.fn(() => {
    urlCalls += 1;
    return "blob://captured";
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
  restoreDownload = () => {
    Object.defineProperty(window, "Blob", { configurable: true, writable: true, value: OriginalBlob });
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    clickSpy.mockRestore();
  };
}

/** 去掉 BOM，只留记录；每行按逗号切列。请求编号是第 6 列（下标 5）。 */
function csvRecords(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, "")
    .trimEnd()
    .split("\r\n")
    .map((line) => line.split(","));
}
const RID_COLUMN = 5;

const FRESH = "evt_fresh00000001";
const MID = "evt_mid0000000002";
const TAIL = "evt_tail000000003";
const RID_FRESH = "req-fresh-0001";
const RID_MID = "req-mid-0002";

function rowOf(eventId: string, at: string, requestId: string | null): Record<string, unknown> {
  return {
    eventId,
    action: "task.created",
    occurredAt: at,
    outcome: "succeeded",
    actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" },
    resource: { type: "approval", id: "ap_1122334455667788" },
    ...(requestId ? { requestId } : {}),
  };
}

/** 30 天窗的第一页、第二页（与首页重叠 MID），以及 24 天窗只认得 FRESH。 */
const W30_PAGE1 = {
  items: [rowOf(FRESH, "2026-11-20T05:30:00Z", RID_FRESH), rowOf(MID, "2026-11-19T05:00:00Z", RID_MID)],
  nextCursor: "cur_rows2",
};
const W30_PAGE2 = {
  items: [rowOf(MID, "2026-11-19T05:00:00Z", RID_MID), rowOf(TAIL, "2026-11-18T04:00:00Z", null)],
  nextCursor: null,
};
const W24_PAGE1 = { items: [rowOf(FRESH, "2026-11-20T05:30:00Z", RID_FRESH)], nextCursor: null };

/** 假服务按请求自己带的 from/to 与 cursor 决定行集，和真 BFF 一样由服务端筛。 */
function answerPaged(): void {
  api.fetchJSON.mockImplementation(async (url: unknown) => {
    const text = String(url ?? "undefined");
    if (text.includes("audit-detail")) return { audit: {} };
    if (paramOf(text, "cursor") === "cur_rows2") return W30_PAGE2;
    return windowHours(text) <= 25 ? W24_PAGE1 : W30_PAGE1;
  });
}

async function render(entry: string): Promise<void> {
  await act(async () => {
    if (root) act(() => root?.unmount());
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <LocationProbe />
        <AuditEventsModulePage />
      </MemoryRouter>,
    );
  });
  await waitFor(() => document.querySelector(".animate-pulse") === null, "skeleton gone");
}

async function mount(entry: string): Promise<void> {
  api.fetchJSON.mockReset();
  answerPaged();
  await render(entry);
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  clipboard.copyTextToClipboard.mockReset();
  clipboard.copyTextToClipboard.mockResolvedValue(true);
  answerPaged();
  window.history.replaceState({}, "", "/");
});

afterEach(async () => {
  restoreDownload?.();
  restoreDownload = null;
  await act(async () => {
    if (root) act(() => root?.unmount());
  });
  root = null;
  document.body.replaceChildren();
  window.history.replaceState({}, "", "/");
  vi.useRealTimers();
});

describe("R235 ① — 第 2 页：复制句与文件请求编号格按位置一一对应，三值与两枚读数条同一个数", () => {
  it("page two's copy strings are exactly the file's non-empty rid cells, in the same order, and the export costs nothing", async () => {
    await mount("/system?tab=events&window=30d");
    expect(paintedRows(), "首载是 30 天窗的第一页").toEqual([FRESH, MID]);
    expect(valueKeys(), "首页两行都带请求编号").toEqual([FRESH, MID]);

    await clickTestId("aud01-load-more", "下一页");
    await waitFor(() => paintedRows()[0] === MID, "第 2 页上屏");
    const rows = paintedRows();
    expect(rows, "第 2 页是重叠行加尾巴行").toEqual([MID, TAIL]);
    expect(new Set(rows).size, "重叠 id 只出现一次").toBe(rows.length);

    expect(textOf("aud01-status")).toContain("已显示 2 条");
    expect(textOf("aud5-export-count"), "派工的 sys-evt-count 本代不存在，真面是这枚导出读数")
      .toBe("将导出 2 条");

    expect(valueKeys(), "控件集合 == 带 rid 的行，按 DOM 序 1:1").toEqual([MID]);
    expect(absentKeys(), "裸行只给说明节点").toEqual([TAIL]);
    const bareNode = document.querySelector(`[data-testid='aud01-cell-${TAIL}-request-value-absent']`);
    expect(bareNode?.querySelector("button"), "裸行不给死按钮").toBeNull();
    expect(bareNode?.textContent?.trim(), "裸行的说法是「该字段未返回」").toBe("该字段未返回");

    const readsBefore = urls().length;
    captureDownload();
    await clickTestId("aud01-export", "导出 CSV");
    const records = csvRecords(captured);
    expect(records[0], "表头按现状").toEqual(["时间", "类型", "结果", "操作者", "对象", "请求编号"]);
    const data = records.slice(1);
    expect(data, "文件数据行数 == 表体行数").toHaveLength(rows.length);
    expect(data[0]![RID_COLUMN], "第 1 条记录的请求编号格是 MID 自己的 id").toBe(RID_MID);
    expect(data[1]![RID_COLUMN], "裸行那一格是空的，不是 0 也不是占位").toBe("");
    expect(
      screenRid(MID),
      "屏上那一格的文字 == 文件第 1 条记录的编号格（R225 只钉了屏上≡复制，这一层没人钉）",
    ).toBe(data[0]![RID_COLUMN]!);

    const copied = await copyRow(MID);
    expect(copied, "复制的就是屏上那一句，也是文件第 1 条记录的编号格").toBe(
      data[0]![RID_COLUMN]!,
    );
    expect(copied).toBe(RID_MID);
    expect(
      data.map((line) => line[RID_COLUMN]!).filter((cell) => cell !== ""),
      "可复制句集合 == 文件非空编号格，同序",
    ).toEqual([copied]);

    expect(urls(), "导出与复制都不再花一笔请求").toHaveLength(readsBefore);
    expect(urlCalls, "只建了一次对象 URL").toBe(1);
    expect(blobCalls, "只建了一个 Blob").toBe(1);
    expect(capturedName).toMatch(/^audit-.+-\d{8}-\d{4}\.csv$/);
    expect(document.querySelectorAll("[data-testid^='sys-evt']"), "本代不存在 sys-evt 族").toHaveLength(0);
  });
});

describe("R235 ② — 第 2 页之后切窗：复制序号重建、文件换代，宽窗与第 2 页的东西一项都不留", () => {
  it("after a page turn the window switch rebuilds the affordances and the file together, with zero residue and one extra read", async () => {
    await mount("/system?tab=events&window=30d");
    await clickTestId("aud01-load-more", "下一页");
    await waitFor(() => paintedRows()[0] === MID, "第 2 页上屏");
    expect(paintedRows()).toEqual([MID, TAIL]);
    const readsBefore = urls().length;

    await clickTestId("aud01-filter-window-24h", "切到 24h 窗");
    await waitFor(() => paintedRows().length === 1 && paintedRows()[0] === FRESH, "窄窗行集上屏");

    const rows = paintedRows();
    expect(rows, "换代后只剩窄窗那一行").toEqual([FRESH]);
    expect(rows, "上一页的重叠行不留").not.toContain(MID);
    expect(rows, "上一页的尾巴行不留").not.toContain(TAIL);
    expect(textOf("aud2-page"), "页码归 1").toContain("第 1 页");
    expect(textOf("aud01-status")).toContain("已显示 1 条");
    expect(textOf("aud5-export-count"), "导出读数跟着回到 1").toBe("将导出 1 条");

    const url = lastListRead();
    expect(cursorsOf(url), "新提问不带旧游标").toEqual([]);
    expect(windowHours(url), "请求真的按 24h 窗提问").toBe(24);
    expect(urls(), "切窗只多它自己这一笔读").toHaveLength(readsBefore + 1);
    expect(listReads(), "首载 + 翻页 + 切窗 = 三笔列表读，中间没有多余的一笔").toBe(3);

    expect(valueKeys(), "控件集合按新行集重建").toEqual([FRESH]);
    expect(absentKeys(), "窄窗这页没有裸行").toEqual([]);

    const readsAtExport = urls().length;
    captureDownload();
    await clickTestId("aud01-export", "导出 CSV");
    const records = csvRecords(captured);
    const data = records.slice(1);
    expect(data, "文件数据行数 == 新表体行数").toHaveLength(rows.length);
    expect(data[0]![RID_COLUMN], "文件那格是窄窗行自己的 id").toBe(RID_FRESH);
    expect(screenRid(FRESH), "屏上那格 == 文件那格（重建后仍然同源）").toBe(data[0]![RID_COLUMN]!);
    const copiedStr = await copyRow(FRESH);
    expect(copiedStr, "复制句与文件那格逐字相同").toBe(data[0]![RID_COLUMN]!);
    expect(captured, "宽窗的编号不进文件").not.toContain(RID_MID);
    expect(captured, "上一页的尾巴事件 id 不进文件").not.toContain(TAIL);
    expect(urls(), "导出不花请求").toHaveLength(readsAtExport);

    expect(paramOf(address(), "tab"), "tab 逐字还在地址里").toBe("events");
    expect(paramOf(address(), "window"), "地址落在新窗").toBe("24h");
    expect(document.querySelectorAll("[data-testid^='sys-evt']"), "本代不存在 sys-evt 族").toHaveLength(0);
  });
});
