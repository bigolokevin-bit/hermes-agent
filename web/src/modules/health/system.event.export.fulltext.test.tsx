// @vitest-environment jsdom
/**
 * R237 — /system 事件表在 `?window=7d` 下：请求编号那一列的「屏上折叠 vs 文件全形」（纯测试）
 *
 * 派工（第二张 R236 号）三例的查重结论，先记账再动笔。
 *
 * 1) `sys-evt-copy-<i>` / `sys-evt-count` 本代不存在（第 30 条道）。
 *    现查 `git grep -n -E "sys-evt|sysEventCopyText|evt-copy|evt-more|evt-count" -- web/src` → 44 处命中，
 *    全部是既有用例里的缺席注释或我自己的缺席断言；health 产品码命中 0。所以 ① 的第三值与 ③ 的
 *    「显 0」只能落在这面真有的对应物上：逐行控件 `aud01-cell-<key>-request-value`（裸行是
 *    `-request-value-absent`，文字「该字段未返回」且不给死按钮），读数是 `aud01-status`
 *    （「已显示 N 条审计事件（<窗口>）」，无事件时是一句无数字的话）与 `aud5-export-count`
 *    （「将导出 N 条」，空集时那是唯一一枚真 0）。
 *
 * 2) 已覆盖只回证据，不重写：
 *    - ① 的三值三角形：R221 `system.event.export.test.tsx:241`（30d 地址上 文件数据行 == 表体 ==
 *      两枚读数条 == 逐行控件数，且只有带 rid 的行有按钮）；上游 R241 `audit.copy.paged.test.tsx:325`
 *      与 R243 `audit.filter.paging.export.test.tsx:348`（文件按表体顺序逐行交）；R235
 *      `system.event.copy.paging.test.tsx`（第 i 句复制 == 文件第 i 条第 6 列 == 屏上那格）。
 *      本单只在 7d 档顺带复核一次等式，因为档位本身已由 R135 `:158`、R228 `:310`、R181 `:221` 钉死。
 *    - ② 的两半各自都被钉过，但都不是「请求编号」这一列：上游 R215 `audit.fields.edge.test.tsx:394`
 *      钉 120+ 字的资源列「屏上一行截断、复制与文件全量」，`:434` 钉死链行的可复制 rid；R229
 *      `system.cross.failure.test.tsx` 钉审计错误锚的复制按钮写全形 rid 且零请求；R213
 *      `audit.error.test.tsx:328` 钉失败态两扇导出门关死；R244 `audit.copy.paging2.test.tsx:317`
 *      钉坏掉的第 2 页复制门关着、恢复后各句不重复；R245 `audit.export.detail.open.test.tsx:311`
 *      钉抽屉开合前后文件逐字相同。
 *    - ③ 已由本车道几分钟前推上去的 `afba4742`（`system.event.empty.test.tsx` 例 1）按现状锁：
 *      空集时两扇门 disabled 且各自带可读 title（主导出「当前筛选没有可导出的记录」、筛选快照
 *      「当前筛选无事件可导出」——实测两句，不共用一个单点），强点零 urlCalls / 零 blobCalls，
 *      「将导出 0 条」是唯一真 0 面。在先的还有 R221 `:365`、R206 `audit.empty.export.test.tsx:186/:202`、
 *      R181 `audit.empty.test.tsx:197/:216`、R214 `audit.filter.counts.test.tsx:345`。
 *
 * 3) 本单只写没人钉过的那一条：**请求编号这一列的两态**。R221 `:315` 当初刻意用 dash 形 rid
 *    （`req-fresh-0001`）绕开 R31 的短码折叠，于是「屏上折成 8 位短码、文件必须是全形」这一格
 *    从来没被对撞过；现查全仓 audit 夹具里没有任何一枚 32 位十六进制 rid
 *    （`git grep -n -E "requestId: \"[0-9a-f]{16,}\"" -- web/src/modules/audit` → 0 命中）。
 *    后果：若哪天有人把屏上那枚短码写进 CSV，现有用例一条都不会红。这就是本文件的靶子。
 *    写法：同一张表里放一枚 32 位十六进制 rid（按 R31 折成前 8 位）、一枚超长 dash 形 rid
 *    （不折叠、逐字显示）与一行根本没有 rid 的空格；对撞三件事——屏上形、`title` 全形、
 *    文件第 6 列全形不截断；整份文件里不许出现省略号或截断痕迹；导出与两次复制都不花一笔请求。
 *
 * 4) 地址与挂载：文件按派工落在 `modules/health/`，被测组件是 `modules/audit/AuditEventsModulePage`
 *    （R135 / R221 / R225 / R228 / R235 同一习语；audit 与 shell 只读、只挂载，从未编辑）。
 *    窗口口径只在 `?tab=events` 复合地址上顺带验一次：7d 上线的是一对 from/to、请求不带 `window`
 *    键、第一页不带 cursor。
 *
 * 5) 本文件不新增任何产品 testid；`probe-location` 沿用既有证人写法。
 *    冻结族只读：aud01 一族 / aud2 一族 / aud5 一族 / audI 一族 / agent-v2-page-audit / sys 一族。
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
/** 32 位十六进制：R31 的短码规则把它在屏上折成前 8 位，全形只活在 title 与文件里。 */
const RID_FRESH = "9f8e7d6c5b4a3f21e0d9c8b7a6f5e4d3";
/** 超长 dash 形：不匹配任何折叠规则，屏上逐字就是全形，用来对撞「不截断」。 */
const RID_MID = "req-audit-2026-11-20-untruncated-trace-identifier-longer-than-any-column-width";
/** 带下划线的句柄形：R31 的另一条规则；不管屏上怎么折，文件必须是全形。 */
const RID_HANDLE = "runtime_abc1234567890";
const BAREROW = "evt_barerid0000001";

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

/** 宽窗（7d / 30d 都落这一支）的第一页：三种折叠规则各一枚，外加一行根本没有 rid；
 * 窄窗（24h）只认得 FRESH。第二页与首页重叠 MID，用来留给既有用例的翻页习语。 */
const W30_PAGE1 = {
  items: [
    rowOf(FRESH, "2026-11-20T05:30:00Z", RID_FRESH),
    rowOf(MID, "2026-11-19T05:00:00Z", RID_MID),
    rowOf(BAREROW, "2026-11-18T04:00:00Z", null),
  ],
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

describe("R237 ② — 请求编号这一列的两态：屏上按 R31 折，文件第 6 列必须全形不截断", () => {
  it("folds the 32-hex rid to its 8-char short on screen while the file carries the whole id, keeps the long one verbatim, and costs no extra ask", async () => {
    await mount("/system?tab=events&window=7d");

    const rows = paintedRows();
    expect(rows, "三行按服务端回的顺序上屏：十六进制、超长 dash 形、没有 rid 的那行").toEqual([FRESH, MID, BAREROW]);

    // ① 顺带：7d 上线的是一对 from/to，档位键与游标都不上线（那一半由 R135 :158 / R181 :221 钉着）。
    const read = lastListRead();
    expect(listReads(), "首载只问一笔").toBe(1);
    expect(paramOf(read, "window"), "档位从不直接上线，上线的是 from/to 对").toBeNull();
    expect(windowHours(read), "7d 档就是一百六十八小时的一对时刻").toBe(168);
    expect(cursorsOf(read), "第一页没有 cursor").toEqual([]);
    expect(address(), "复合地址上的 tab 参数原样留着").toContain("tab=events");

    // 两枚读数条与表体同一个数；派工的 sys-evt-count 本代不存在（第 30 条道，44 处全是指向缺席的注释）。
    expect(textOf("aud01-status"), "状态行说显示了几条").toContain("已显示 3 条");
    expect(textOf("aud5-export-count"), "导出读数说将导出几条").toContain("将导出 3 条");
    expect(valueKeys(), "只有带 rid 的两行有复制控件").toEqual([FRESH, MID]);
    expect(absentKeys(), "没 rid 的那行给一枚说明节点").toEqual([BAREROW]);
    expect(
      document.querySelectorAll("[data-testid^='sys-evt']"),
      "派工的 sys-evt-copy-<i> / sys-evt-count 本代不存在（第 30 条道），只断言缺席，不伪造",
    ).toHaveLength(0);

    // ② 的主靶：同一格里屏上形与全形是两回事。
    const hexScreen = screenRid(FRESH);
    expect(hexScreen, "32 位十六进制 rid 在屏上折成前 8 位（R31 的短码规则）").toBe(RID_FRESH.slice(0, 8));
    const hexCell = document.querySelector(`[data-testid='aud01-cell-${FRESH}-request-value']`)?.firstElementChild;
    expect(hexCell?.getAttribute("title"), "全形只活在 title 里，不占屏上那格").toBe(RID_FRESH);
    expect(screenRid(MID), "超长 dash 形不折叠，屏上逐字就是全形").toBe(RID_MID);
    const bareNode = document.querySelector(`[data-testid='aud01-cell-${BAREROW}-request-value-absent']`);
    expect(bareNode?.textContent?.trim(), "裸行说自己的那句话").toBe("该字段未返回");
    expect(bareNode?.querySelector("button"), "裸行不给死按钮").toBeNull();

    const before = urls().length;
    captureDownload();
    await clickTestId("aud01-export", "the export button");
    const records = csvRecords(captured);
    expect(records[0], "表头按现状锁").toEqual(["时间", "类型", "结果", "操作者", "对象", "请求编号"]);
    const data = records.slice(1);
    expect(data.length, "① 文件数据行 == 表体行数").toBe(rows.length);
    expect(
      data.map((line) => line[RID_COLUMN]),
      "第 6 列逐行同源；没 rid 的那格留空，不补 0 也不补「—」",
    ).toEqual([RID_FRESH, RID_MID, ""]);
    expect(data[0][RID_COLUMN].length, "文件里是 32 位全形，不是屏上那 8 位").toBe(32);
    expect(captured, "整份文件不许出现省略号或截断痕迹").not.toMatch(/…|\.\.\.|截断/);
    expect(captured, "全形必须在文件里").toContain(RID_FRESH);
    expect(captured, "超长那枚必须一字不少").toContain(RID_MID);
    expect(captured, "屏上那枚短码不得冒充整格").not.toContain(`${RID_FRESH.slice(0, 8)},`);
    expect(records.every((line) => line.length === 6), "六列就是六列，不因一枚长值变成七列").toBe(true);
    expect(blobCalls).toBe(1);
    expect(urlCalls).toBe(1);
    expect(capturedName, "文件名带读取时刻，这是本面唯一被允许的读取时钟").toMatch(/^audit-.+-\d{8}-\d{4}\.csv$/);
    expect(urls(), "导出不花一笔请求").toHaveLength(before);
    expect(listReads(), "列表读仍是首载那一笔").toBe(1);

    const copiedHex = await copyRow(FRESH);
    expect(copiedHex, "第 i 句复制 == 文件第 i 条第 6 列（R235 的位置对撞在折叠值上也成立）").toBe(data[0][RID_COLUMN]);
    expect(copiedHex, "复制写的是全形，不是屏上短码").toBe(RID_FRESH);
    expect(copiedHex, "而屏上那一格与它不同形").not.toBe(hexScreen);
    expect(await copyRow(MID), "超长那枚复制也是全形").toBe(RID_MID);
    expect(urls(), "两次复制也不花请求").toHaveLength(before);
    expect(listReads(), "到这儿为止列表只问过一笔").toBe(1);
  });
});

describe("R237 ② 补 — 第三种折叠规则（带下划线的句柄形）也不能把短码漏进文件", () => {
  it("keeps every fold rule's full id in the file cell while the screen may show a shorter form, at zero extra asks", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url: unknown) => {
      const text = String(url ?? "undefined");
      if (text.includes("audit-detail")) return { audit: {} };
      return {
        items: [rowOf(MID, "2026-11-19T05:00:00Z", RID_HANDLE), rowOf(BAREROW, "2026-11-18T04:00:00Z", null)],
        nextCursor: null,
      };
    });
    await render("/system?tab=events&window=7d");

    expect(paintedRows(), "两行：句柄形 rid 与一枚根本没有 rid 的行").toEqual([MID, BAREROW]);
    expect(valueKeys(), "只有带 rid 的那行有控件").toEqual([MID]);
    const screen = screenRid(MID);
    const cell = document.querySelector(`[data-testid='aud01-cell-${MID}-request-value']`)?.firstElementChild;
    expect(screen.length, "屏上形非空").toBeGreaterThan(0);
    expect(screen.length, "屏上形至多是全形的长度——折叠与否都不许变长").toBeLessThanOrEqual(RID_HANDLE.length);
    expect(cell?.getAttribute("title"), "全形在 title 里").toBe(RID_HANDLE);

    const before = urls().length;
    captureDownload();
    await clickTestId("aud01-export", "the export button");
    const records = csvRecords(captured);
    const data = records.slice(1);
    expect(data.map((line) => line[RID_COLUMN]), "文件按行给全形，裸行那格留空").toEqual([RID_HANDLE, ""]);
    expect(captured, "不管屏上怎么折，文件里必须是这一枚的全形").toContain(RID_HANDLE);
    expect(captured, "文件里不许有省略号或截断痕迹").not.toMatch(/…|\.\.\./);
    expect(records.every((line) => line.length === 6), "列数不动").toBe(true);
    expect(blobCalls).toBe(1);
    expect(urlCalls).toBe(1);
    expect(urls(), "导出零请求").toHaveLength(before);
    expect(listReads(), "首载一笔 + 导出零笔").toBe(1);
    expect(await copyRow(MID), "复制也是全形").toBe(RID_HANDLE);
    expect(urls(), "复制同样零请求").toHaveLength(before);
  });
});
