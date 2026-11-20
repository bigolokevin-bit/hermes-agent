// @vitest-environment jsdom
// R221 — /system 事件表「导出 == 屏上」同源护栏（纯测试，零产品码改动）。
//
// 派工单点名的面与本代的真实面，先如实对齐：
// - `sys-evt-copy-<i>` 与 health 事件表在本代不存在（第 17 条道确认）：`git grep -n
//   "sys-evt\|sysEventCopyText\|evt-copy\|evt-more\|evt-count" -- web/src` 的命中全是
//   既有用例里记录「不存在」的注脚（system.cross.isolation.test.tsx:6/:7/:12、
//   system.empty.test.tsx:13、system.filters.test.tsx:14、system.matrix.export.test.tsx:6、
//   system.state.isolation.test.tsx:18、system.time.test.tsx:8）。health 模块没有事件表，
//   `?window=` 的产品读者只有 audit / duty / runs，health 一个都不读。
// - 事件表在 `/system?tab=events` 上由 `modules/audit/AuditEventsModulePage` 交付（shell 的
//   live slot，App.tsx:1628），所以本文件按派工单给的路径落在 health 目录，挂载的却是
//   audit 的真面 —— 跨模块 import 是刻意的，与 R135 `system.filters.test.tsx` 同一习语。
// - 该面没有「行复制列」：audit.empty.test.tsx:267 «has no row copy column to offer, and
//   keeps the record copy disabled with its reason» 已钉死。行内唯一的逐行复制 affordance
//   是请求编号那一列的 `aud01-cell-<key>-request-value`。所以 ① 的第三腿按现状实现为
//   「逐行可复制控件数 == 带请求编号的行数」，不带编号的行给原因句而不是死按钮。
//
// 已覆盖只回证据（派工单的 pre-check 纪律），本文件不重写这些：
// - R141 `audit.export.test.tsx` :199 «exports exactly what the table shows and what the
//   page says it will»、:215 «is built from the filters the addresses carries»、
//   :241 «a resource filter narrows the file with the table, not after it»、
//   :259/:283 absent cell / instant precision、:303 «disables the export with a reason and
//   asks for nothing on a click»、:323 «exporting what is already loaded sends no request».
// - R192 `audit.export.escape.test.tsx` :279 «locks the six names in the six positions»,
//   :302 «each layer's own word for a missing object and operator», :323 «genuinely empty,
//   never a placeholder», :343 «carries the stated window … and asks for nothing».
// - R206 `audit.empty.export.test.tsx` :202 «hands over no file from an empty range: off,
//   silent, and never a Blob»；R214 `audit.filter.counts.test.tsx` :271 四值一数 / :316 档位赢；
// - R161 `audit.paging.test.tsx` :254 切窗恰一问不带旧 cursor / :383 翻页后三值；
//   R203 `audit.window.bounds.test.tsx` :322 换档后三值同数；R213 :328 失败态两道门全关。
// 本文件补的是这些覆盖里没有人做的三件事：① 带 `tab=events` 的组合地址上的导出同源与
// 逐行可复制控件计数；② 换窗后**文件内容**换代（旧行的 id / 请求编号一字不剩，而不只是
// 行数变），且导出点击前后请求计数逐字不变、地址保 `tab`；③ 同一行的 CSV 单元格与屏上
// 单元格按 DOM 取值对撞（类型人话 / 结果人话 / 操作者显示名+8 位短码 / 对象），禁裸内部 id。
//
// 冻结族零破：`aud01-*` / `aud2-*` / `aud5-export*` / `audC-copy*` / `aud-detail-copy*` /
// `sys*` 全族只读不改；本文件不新增任何 testid。
//
// R222 增量（同一派工单的第三张单；①②④ 与 ③ 的前半已由 R221 本文件四例钉死，
// 见 :232/:267/:306/:356，本轮不重写）：
// - ③ 的新子句「时间不混 `sys-updated-at`」：`sys-updated-at` 是 health 页刷新条的锚
//   （systemRefresh.tsx），事件面上不存在 —— `git grep -n "sys-updated-at" -- web/src`
//   在产品码里只剩 rowCopy.ts:13 一句注脚。按现状钉两件事：本面零枚该锚；CSV 数据行
//   永不携带读取时钟（假时钟 2031 下逐格验），而文件名戳是本表唯一被允许的读取时刻。
// - `sys-evt-copy-*` 不存在已是第 18 条道（本轮 grep 命中 11 处，全是既有注脚）。

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** NOW 冻结住：windowBounds 与文件名戳都要能被逐字核对。 */
const NOW = new Date("2026-11-20T06:00:00.000Z");
const STAMP = "20261120-1400";

/** 三条事件：E1 落进 24h，E2/E3 只落进 30 天；E3 故意不带请求编号。 */
const E1 = {
  eventId: "evt_aaaa1111bbbb2222",
  event_type: "approval_approved",
  occurredAt: "2026-11-20T05:30:00Z",
  outcome: "succeeded",
  actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" },
  resource: { type: "approval", id: "ap_1122334455667788" },
  requestId: "req-20261120-aaaa",
};
const E2 = {
  event_id: "evt_cccc1111dddd2222",
  action: "run_failed",
  at: "2026-11-18T09:00:00Z",
  result: "failed",
  actor: { type: "system", id: "employee:1122334455667799", displayName: "值守机器人" },
  resource: { type: "run", id: "run_5566778899001122" },
  requestId: "req-20261118-bbbb",
};
const E3 = {
  event_id: "evt_eeee1111ffff2222",
  action: "task_created",
  at: "2026-11-01T03:00:00Z",
  result: "pending",
  actor_id: "employee:9f8e7d6c5b4a3f21",
  resource: { type: "task", id: "task_3344556677889900" },
};

/** 服务按 from/to 跨度回答：24 小时只给 E1，更宽的窗给三条。 */
function serveByWindow(url: string): unknown {
  const query = new URLSearchParams(url.slice(url.indexOf("?") + 1));
  const from = Date.parse(query.get("from") ?? "");
  const to = Date.parse(query.get("to") ?? "");
  const hours = Number.isFinite(from) && Number.isFinite(to) ? (to - from) / 3_600_000 : 0;
  const items = hours <= 25 ? [E1] : [E1, E2, E3];
  return { items, nextCursor: null };
}

let root: Root | null = null;
let restoreDownload: (() => void) | null = null;
let captured: string;
let capturedName: string;
let blobCalls: number;
let urlCalls: number;

const q = <T extends HTMLElement = HTMLElement>(testid: string): T | null =>
  document.querySelector<T>(`[data-testid='${testid}']`);
const all = (selector: string): Element[] => [...document.querySelectorAll(selector)];
const textOf = (testid: string): string => q(testid)?.textContent?.trim() ?? "";
/** Field 类单元格把标签和值放在一起，取值要读 dd，否则拿到「时间（北京时间）…」。 */
function cellValue(testid: string): string {
  const node = q(testid);
  if (!node) return "";
  const dd = node.querySelector("dd");
  return (dd ?? node).textContent?.trim() ?? "";
}
const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): string[] => urls().filter((u) => u.startsWith("/agent-api/api/audit?"));
const paintedRows = (): string[] => all("[data-testid^='aud01-row-']").map((n) => n.getAttribute("data-testid") ?? "");
const skeleton = (): boolean => document.querySelector(".animate-pulse") !== null;

function LocationProbe(): ReactNode {
  const loc = useLocation();
  return <span data-testid="probe-location">{`${loc.pathname}${loc.search}`}</span>;
}
const address = (): string => textOf("probe-location");

/** 冻结 Date 时 Date.now() 型 deadline 永不触发 —— 用迭代上界。 */
async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  for (let i = 0; i < 600; i += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error(`waitFor: ${label} never became true`);
}

async function render(entry: string): Promise<void> {
  await act(async () => {
    root?.unmount();
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
  await act(async () => {});
}

async function mount(entry: string): Promise<void> {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(async (url: string) => {
    if (String(url).startsWith("/agent-api/api/audit-detail")) return { audit: {} };
    return serveByWindow(String(url));
  });
  await render(entry);
  await waitFor(() => !skeleton(), "first page settled");
}

async function clickNode(testid: string, label = testid): Promise<void> {
  const node = q<HTMLButtonElement>(testid);
  if (!node) throw new Error(`missing clickable node: ${label}`);
  await act(async () => {
    node.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** 下载捕获：RecordingBlob 记内容，anchor 间谍记文件名，URL 桩记「有没有被调用」。 */
function captureDownload(): void {
  captured = "";
  capturedName = "";
  blobCalls = 0;
  urlCalls = 0;
  const OriginalBlob = window.Blob;
  const names: string[] = [];
  class RecordingBlob extends OriginalBlob {
    constructor(parts: BlobPart[], options?: BlobPropertyBag) {
      super(parts, options);
      captured = String(parts[0] ?? "");
      blobCalls += 1;
      names.push(String(options?.type ?? ""));
    }
  }
  void names;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const clickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      capturedName = this.download;
    });
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

/** 去掉 BOM 与表头，只留数据行；每行按逗号切列。 */
function csvRecords(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, "")
    .trimEnd()
    .split("\r\n")
    .map((line) => line.split(","));
}

beforeEach(() => {
  api.fetchJSON.mockReset();
});

afterEach(() => {
  restoreDownload?.();
  restoreDownload = null;
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("R221 ① — 导出文件、表体、读数条与逐行可复制控件是同一个数", () => {
  it("on the ?tab=events address the file, the table and both read-outs agree, and per-row copy controls count the rows that carry a request id", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    await mount("/system?tab=events&window=30d");
    const rows = paintedRows();
    expect(rows).toHaveLength(3);
    expect(textOf("aud01-status")).toContain("已显示 3 条审计事件");
    expect(textOf("aud5-export-count")).toBe("将导出 3 条");
    expect(q<HTMLButtonElement>("aud01-export")?.disabled).toBe(false);

    captureDownload();
    const before = urls().length;
    await clickNode("aud01-export", "中文表头导出钮");
    const records = csvRecords(captured);
    expect(records).toHaveLength(4);
    expect(records[0]).toEqual(["时间", "类型", "结果", "操作者", "对象", "请求编号"]);
    expect(records.slice(1)).toHaveLength(rows.length);
    expect(capturedName).toMatch(new RegExp(`^audit-.+-${STAMP}\\.csv$`));
    expect(urls()).toHaveLength(before);

    // 派工单的第三腿 `sys-evt-copy-<i>` 不存在；行内真实的逐行复制 affordance 是请求编号列。
    // 「带编号的行数」按文件自己的第六列数，不从屏上文案猜。
    const ridControls = all("[data-testid^='aud01-cell-'][data-testid$='-request-value'] button");
    const rowsWithRid = records.slice(1).filter((line) => (line[5] ?? "") !== "");
    expect(rowsWithRid).toHaveLength(2);
    expect(ridControls, "逐行可复制控件数 == 带请求编号的行数").toHaveLength(rowsWithRid.length);
    // 不带请求编号的那一行给原因，不给一枚死按钮（原因可能落在文案或 title，故读 innerHTML）
    const bare = rows.find((testid) => !q(`${testid.replace("aud01-row-", "aud01-cell-")}-request-value`)?.querySelector("button"));
    expect(bare, "第三行没有请求编号，应当没有逐行复制控件").toBeDefined();
    const bareCell = q(`${bare!.replace("aud01-row-", "aud01-cell-")}-request-id`);
    expect(bareCell?.querySelector("button"), "缺值的行不留死按钮").toBeNull();
    expect(bareCell?.innerHTML ?? "", "缺值要说出缺的是什么").toContain("没有回传请求编号");
  });
});

describe("R221 ② — 换窗后文件换代、地址保 tab、导出本身零请求", () => {
  it("a window switch regenerates the file with no stale row from the previous window, keeps tab byte-for-byte, and the export click asks for nothing", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    await mount("/system?tab=events&window=30d");
    captureDownload();
    expect(paintedRows()).toHaveLength(3);
    await clickNode("aud01-export", "30 天导出");
    const wide = csvRecords(captured);
    expect(wide).toHaveLength(4);
    // 上一窗独有行的标记（文件里对象/操作者只以人话+8 位短码出现，故用短码与请求编号做标记）
    expect(captured).toContain("req-20261118-bbbb");
    expect(captured).toContain("55667799");
    expect(captured).toContain("77889900");
    expect(captured).toContain("5b4a3f21");

    await clickNode("aud01-filter-window-24h", "24 小时档位");
    await waitFor(() => paintedRows().length === 1, "the narrow window repaints the table");
    expect(Object.fromEntries(new URLSearchParams(address().slice(address().indexOf("?") + 1)))).toEqual({
      tab: "events",
      window: "24h",
    });
    expect(textOf("aud01-status")).toContain("已显示 1 条审计事件");

    const beforeExport = urls().length;
    await clickNode("aud01-export", "24 小时导出");
    const narrow = csvRecords(captured);
    expect(narrow).toHaveLength(2);
    expect(narrow[1]?.[5]).toBe("req-20261120-aaaa");
    // 换代不是「行数变了」而已：上一窗独有的行在文件里一字不剩
    expect(captured).not.toContain("req-20261118-bbbb");
    expect(captured).not.toContain("55667799");
    expect(captured).not.toContain("值守机器人");
    expect(captured).not.toContain("77889900");
    expect(captured).not.toContain("5b4a3f21");
    expect(urls()).toHaveLength(beforeExport);
    expect(listReads()).toHaveLength(2);
  });
});

describe("R221 ③ — 同一行的 CSV 单元格与屏上单元格按 DOM 取值对撞", () => {
  it("type, result, operator and object cells are the same words in the file and on screen, the operator carries a display name plus an 8-char short code, and no bare internal id reaches the file", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    await mount("/system?tab=events&window=30d");
    captureDownload();
    await clickNode("aud01-export", "导出");
    const records = csvRecords(captured).slice(1);
    const rows = paintedRows();
    expect(records).toHaveLength(rows.length);

    rows.forEach((rowTestid, index) => {
      const cells = `aud01-cell-${rowTestid.replace("aud01-row-", "")}`;
      const line = records[index]!;
      const screenType = q(`${cells}-type`)?.textContent?.trim() ?? "";
      const screenResult = cellValue(`${cells}-result`);
      const screenActor = cellValue(`${cells}-actor`);
      const screenObject = cellValue(`${cells}-object`);
      const screenTime = cellValue(`${cells}-time`);
      expect(screenType, `第 ${index + 1} 行的类型锚在屏上`).not.toBe("");
      expect(screenActor, `第 ${index + 1} 行的操作者锚在屏上`).not.toBe("");
      expect(line[1], `第 ${index + 1} 行的类型两处同句`).toBe(screenType);
      expect(line[2], `第 ${index + 1} 行的结果两处同句`).toBe(screenResult);
      expect(line[3], `第 ${index + 1} 行的操作者两处同句`).toBe(screenActor);
      expect(line[4], `第 ${index + 1} 行的对象两处同句`).toBe(screenObject);
      // 已知类型给人话，不是裸码；结果同理
      expect(screenType).not.toContain("_");
      expect(screenResult).not.toContain("_");
      // 时间口径按文档维持两处：屏上到秒，文件到分钟 —— 文件格是屏上值的前缀
      expect(screenTime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(line[0]).toBe(screenTime.slice(0, 16));
      expect(line[0]).not.toContain("T");
      expect(line[0]).not.toContain("Z");
    });

    // 操作者 = 显示名 + 8 位短码，绝不裸内部 id
    expect(records[0]?.[3]).toMatch(/^.+ · [0-9a-f]{8}$/);
    expect(records[0]?.[3]).toContain("李思");
    for (const raw of ["user:2f3a4b5c6d7e8f90", "employee:1122334455667799", "employee:9f8e7d6c5b4a3f21"]) {
      expect(captured, `文件里不该出现裸操作者 id ${raw}`).not.toContain(raw);
    }
    for (const raw of ["evt_aaaa1111bbbb2222", "ap_1122334455667788", "approval_approved", "run_failed"]) {
      expect(captured, `文件里不该出现 ${raw}`).not.toContain(raw);
    }
    // 缺请求编号的那一行在文件里是真空格，不写 0 也不写占位
    expect(records[2]?.[5]).toBe("");
    expect(captured).not.toMatch(/undefined|null|NaN|\[object/);
    expect(api.fetchJSON).toHaveBeenCalledTimes(1);
  });
});

describe("R221 ④ — 空集不交文件（在带 tab 的组合地址上复核 R206 的那条腿）", () => {
  it("an empty answer disables the export with a reason, and a forced click sends nothing and builds no blob", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async () => ({ items: [], nextCursor: null }));
    await render("/system?tab=events&window=24h");
    await waitFor(() => !skeleton(), "empty page settled");
    expect(paintedRows()).toEqual([]);
    expect(q("aud01-empty")).not.toBeNull();
    const exportButton = q<HTMLButtonElement>("aud01-export");
    expect(exportButton?.disabled).toBe(true);
    const title = exportButton?.getAttribute("title") ?? "";
    expect(title.length, "禁用必须有可读原因，不能只是一枚灰钮").toBeGreaterThan(0);

    captureDownload();
    const before = urls().length;
    await act(async () => {
      exportButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(urlCalls, "createObjectURL 不得被调用").toBe(0);
    expect(blobCalls).toBe(0);
    expect(captured).toBe("");
    expect(capturedName).toBe("");
    expect(urls()).toHaveLength(before);
    expect(textOf("aud01-export-status")).toBe("");
  });
});

describe("R222 ③ 补 — 数据行里没有读取时钟：文件名才是戳，屏上锚不属于本面", () => {
  it("under a 2031 clock the file rows keep the events' own instants, no sys-updated-at anchor exists on this surface, and the export click asks for nothing", async () => {
    vi.useFakeTimers({ now: new Date("2031-03-01T00:00:00.000Z"), toFake: ["Date"] });
    await mount("/system?tab=events&window=30d");
    // 派工单点名的刷新锚住在 health 页（systemRefresh.tsx），事件面上一枚都不该有：
    // 先证明「无处可混」，再去验数据行本身——比对着一个不存在的锚比字符串更诚实。
    expect(all("[data-testid='sys-updated-at']"), "本面不该出现刷新时刻锚").toEqual([]);
    expect(all("[data-testid^='sys-refresh']"), "刷新条整族都不在本面").toEqual([]);

    const rows = paintedRows();
    expect(rows).toHaveLength(3);
    const screenTimes = rows.map(
      (rowTestid) => cellValue(`aud01-cell-${rowTestid.replace("aud01-row-", "")}-time`),
    );
    for (const value of screenTimes) {
      expect(value, "屏上时间格是事件自己的 2026 时刻，不是 2031 的读取时钟").toMatch(
        /^2026-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
      );
    }

    captureDownload();
    const before = urls().length;
    await clickNode("aud01-export", "导出");
    const records = csvRecords(captured).slice(1);
    expect(records).toHaveLength(rows.length);
    records.forEach((line, index) => {
      expect(line[0], `第 ${index + 1} 行的时间格仍是事件自己的时刻`).toBe(screenTimes[index]!.slice(0, 16));
      expect(line.join(","), `第 ${index + 1} 行任何一格都不该有读取年份`).not.toContain("2031");
    });
    expect(captured, "整个文件不许出现读取时钟的年份").not.toContain("2031");
    expect(captured, "刷新话术也不该渗进事件文件").not.toContain("刷新完成于");
    // 文件名戳是本表唯一被允许的读取时刻 token：它跟着假时钟走。
    expect(capturedName).toMatch(/^audit-.+-20310301-0800\.csv$/);
    expect(urls(), "导出点击零请求").toHaveLength(before);
    expect(listReads(), "整场只有首载那一问").toHaveLength(1);
  });
});
