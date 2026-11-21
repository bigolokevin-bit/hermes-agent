// @vitest-environment jsdom
// R259 — /system 事件表「翻页后换宽窗」与「翻车用换窗逃生」两站（纯测试，零产品改动）
//
// 派工三例与现状的对表（先 git grep 查重，已覆盖只回证据 —— 本卡自己的条款）：
// - ①「第 2 页后 CSV 数据行 == 已加载表体 == 计数三值且首行 == 屏上首行」——【已钉，不重写】：
//   我自己的 R240 `system.event.export.paging.test.tsx:462`（组合地址 /system?tab=events&window=30d，
//   无翻车的第 2 页）逐字持有：`records.length - 1 === rows.length`、`shownOf("aud01-status") === rows.length`、
//   `shownOf("aud5-export-count") === rows.length`、首行时间格 == 屏上 -time dd（秒形）折到分钟的前 16 字、
//   首行 rid 格 == `screenRid(MID)` == RID_MID、文件不含上一页的 RID_FRESH、blob/url 各 1、导出零取数、
//   `listReads() === 2`。另有 R235 `system.event.copy.paging.test.tsx:289`（第 2 页复制串 == 文件非空 rid 格、
//   位置序）、R221 `system.event.export.test.tsx:241`（首页三值 + 控件只数带 rid 的行）、
//   R124 `system.event.export.fulltext.test.tsx:300`（7d 站首页三角 + valueKeys/absentKeys 普查）。
// - ②「切 ?window=30d 导出换代无旧行、计数重算、零额外请求」——【净新站】：
//   R235 `:343` 钉的是翻页后【收窄】30d→24h；上游 `audit/audit.export.detailcopy.order.test.tsx:396`
//   （本波 wave-112 带入）钉的是【变宽到 30d】的文件换代 + 恰一记重问 —— 但它在裸 /audit 上、
//   且【没有翻页前情】（首页直换）。「先翻到第 2 页、再变宽回 30d」在组合地址 ?tab=events 上没人测过：
//   变宽那一问必须丢游标、行集是宽窗自己的第 1 页（替换非累加，窄页第 2 页的行离场即便 30d 覆盖它们）、
//   页码归 1、三值重算、文件只认新屏。本文件测试 A 钉这一站。
//   「零额外请求」与产品相反（上游 :396 自己的裁决原文：「a tier switch is exactly one re-ask」）：
//   换窗那一问就是一笔重取，字面为零的是【导出点击】—— 测试 A 按这个形制钉。
// - ③「第 2 页 500：只导成功页 + rid + 重试恰 +1、三值同步」——【两半已钉 + 一个未测迁移】：
//   「保旧行」与产品相反，这是第 10 次登记（R161 `audit.paging.test.tsx:339`/`:361` + 头 :19-21；
//   R244 `audit.copy.paging2.test.tsx` 条款 (b) + `:316`；R213 `audit.error.test.tsx:302`；
//   R250 `audit.export.window.detail.paging.test.tsx:287`；R240 `:334`；R257 `system.event.counts.paging.test.tsx:360`）：
//   走得通的 aud01-load-more 失败是整页清空，「保旧行」的追加腿唯一重试调用点在 aud01-page-failure 内、现界面够不到。
//   「只导成功页」在翻车当下也相反：什么都不导 —— 两扇门关死、`aud5-export-count` 老实「将导出 0 条」
//   （产品 `AuditEventsModulePage.tsx:1620` 无条件），由 R240 `:334` 钉；重试恰 +1 与恢复后文件只含这一页
//   由 R240 `:387` + R213 `:302` + R249 `:398` 钉；三值「同步」的正确形制是「一起动、一起对」，由 R257 `:360` 钉。
//   【没人测过的迁移】：翻车之后不按重试、而是【换一扇窗逃生】—— 错误面上的档位钮还在不在？
//   那一记宽窗重问能不能把错误面板带离、失败锚的 rid 是否随面板退休、坏掉的那页会不会被顺带重问？
//   本文件测试 B 实测并钉下这条迁移（无论产品给出哪种形制，按实测钉）。
//
// 其他口径（既有裁决，本文件照用）：
// - `sys-evt-count` / `sys-evt-copy-<i>` / `sys-evt-more` 整族缺席 —— 第 42 条道：
//   现查跟踪树 `git grep -n -E "sys-evt|sysEventCopyText|evt-copy|evt-more|evt-count" -- web/src`
//   = 97 处命中 / 24 个文件（全部是 health 的测试文件）/ health 产品码 0 命中（本文件自己那几处不计入）。
//   三值只能用真面：`shownOf("aud01-status")` == `paintedRows().length` == `shownOf("aud5-export-count")`，
//   复制钮普查只数 `[data-testid^='aud01-cell-']` 里的按钮（`RequestIdLine` 与行控件共享「复制请求编号」可及名，
//   R257 挣下的坑），且「钮数 == 表体行数」与产品相反 —— 裸行的 `-absent`  span「该字段未返回」没有按钮，
//   诚实等式是 钮数 == 带 rid 的行数。
// - 档位从不上线路：线路上只有 ISO from/to 对（`window.ts:22`/`:77`/`:105`），`paramOf(read,"window")` 恒 null；
//   7d = windowHours 168，30d = 720。
// - 本文件永不冻结计时器（不需要假时钟：假服务按请求自己的 from/to 跨度与 cursor 决定行集，不按墙上钟）。
// - 跨模块挂载声明：文件按派工落在 modules/health，被测组件是 modules/audit 的 AuditEventsModulePage
//   （R135/R221/R225/R228/R235/R240/R257 同款习语）；audit 只挂载/只读，从未编辑。
// - 本文件不新增任何产品 testid；probe-location 是私有证人节点。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { ApiError } from "@/lib/api-error";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let restoreDownload: (() => void) | null = null;
let captured = "";
let capturedName = "";
let blobCalls = 0;
let urlCalls = 0;
let failPage2 = false;

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
const address = (): string =>
  document.querySelector("[data-testid='probe-location']")?.textContent ?? "";
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

function paintedRows(): string[] {
  return Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((node) =>
    (node.getAttribute("data-testid") ?? "").replace("aud01-row-", ""),
  );
}
function valueKeys(): string[] {
  return Array.from(
    document.querySelectorAll("[data-testid^='aud01-cell-'][data-testid$='-request-value']"),
  ).map((node) =>
    (node.getAttribute("data-testid") ?? "")
      .replace("aud01-cell-", "")
      .replace("-request-value", ""),
  );
}
function absentKeys(): string[] {
  return Array.from(
    document.querySelectorAll("[data-testid^='aud01-cell-'][data-testid$='-request-value-absent']"),
  ).map((node) =>
    (node.getAttribute("data-testid") ?? "")
      .replace("aud01-cell-", "")
      .replace("-request-value-absent", ""),
  );
}
/** 逐行复制钮普查：必须 scoped 到行格 —— 失败锚的 RequestIdLine 共享同一个可及名（R257 挣下的坑）。 */
function ridButtons(): number {
  return document.querySelectorAll(
    "[data-testid^='aud01-cell-'] button[aria-label='复制请求编号']",
  ).length;
}
const q = <T extends Element>(testId: string): T | null =>
  document.querySelector<T>(`[data-testid='${testId}']`);
const textOf = (testId: string): string => q(testId)?.textContent?.trim() ?? "";
/** 读数条里的第一个「N 条」；没有数字（错误句）返回 -1。 */
function shownOf(testId: string): number {
  const match = textOf(testId).match(/(\d+)\s*条/);
  return match ? Number(match[1]) : -1;
}
async function clickTestId(testId: string, label: string): Promise<void> {
  const node = document.querySelector<HTMLButtonElement>(`[data-testid='${testId}']`);
  if (!node) throw new Error(`missing clickable node: ${label} (${testId})`);
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

const A = "evt_ecaaa000000001";
const B = "evt_ecbbb000000002";
const C = "evt_eccc0000000003";
const D = "evt_ecddd000000004";
const E = "evt_eceee000000005";
const RID_A = "req-ec-0001";
const RID_C = "req-ec-0003";
const RID_D = "req-ec-0004";
const FAIL_RID = "req-ec-p2-500";

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

/** 7d 窄窗：第 1 页两行（一行裸 rid），第 2 页三行；30d 宽窗自有其第 1/2 页。 */
const W7_PAGE1 = {
  items: [rowOf(A, "2026-11-20T18:00:00Z", RID_A), rowOf(B, "2026-11-20T06:00:00Z", null)],
  nextCursor: "cur_w7p2",
};
const W7_PAGE2 = {
  items: [
    rowOf(C, "2026-11-19T05:00:00Z", RID_C),
    rowOf(D, "2026-11-18T04:00:00Z", RID_D),
    rowOf(E, "2026-11-17T03:00:00Z", null),
  ],
  nextCursor: null,
};
const W30_PAGE1 = {
  items: [rowOf(A, "2026-11-20T18:00:00Z", RID_A), rowOf(B, "2026-11-20T06:00:00Z", null)],
  nextCursor: "cur_w30p2",
};
const W30_PAGE2 = {
  items: [
    rowOf(C, "2026-11-19T05:00:00Z", RID_C),
    rowOf(D, "2026-11-18T04:00:00Z", RID_D),
    rowOf(E, "2026-11-17T03:00:00Z", null),
  ],
  nextCursor: null,
};

/** 假服务按请求自己的 from/to 跨度与 cursor 决定行集，和真 BFF 一样由服务端筛。
 *  failPage2 按引用读（既有坑）：只闸窄页第 2 页那一问，宽窗的重问不受它影响。 */
function answerPaged(): void {
  api.fetchJSON.mockImplementation(async (url: unknown) => {
    const text = String(url ?? "undefined");
    if (text.includes("audit-detail")) return { audit: {} };
    if (windowHours(text) <= 200) {
      if (paramOf(text, "cursor") === "cur_w7p2") {
        if (failPage2) {
          throw new ApiError("audit upstream exploded", {
            status: 500,
            body: "{}",
            url: text,
            requestId: FAIL_RID,
          });
        }
        return W7_PAGE2;
      }
      return W7_PAGE1;
    }
    if (paramOf(text, "cursor") === "cur_w30p2") return W30_PAGE2;
    return W30_PAGE1;
  });
}

async function render(entry: string): Promise<void> {
  if (root) {
    await act(async () => {
      root?.unmount();
    });
  }
  root = null;
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.appendChild(container);
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
  failPage2 = false;
  answerPaged();
  await render(entry);
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  failPage2 = false;
  answerPaged();
  window.history.replaceState({}, "", "/");
});

afterEach(async () => {
  restoreDownload?.();
  restoreDownload = null;
  if (root) {
    await act(async () => {
      root?.unmount();
    });
  }
  root = null;
  document.body.replaceChildren();
  window.history.replaceState({}, "", "/");
  vi.useRealTimers();
});

describe("R259 - 翻页后变宽回 30d，与翻车用换窗逃生", () => {
  it("② 净新站：7d 翻到第 2 页后切 ?window=30d —— 宽窗那一问丢游标、行集换成宽窗自己的第 1 页、页码归 1、三值重算、文件换代无窄页残留；换窗恰一记重问（「零额外请求」与产品相反），字面为零的是导出点击", async () => {
    await mount("/system?tab=events&window=7d");
    const first = lastListRead();
    expect(paintedRows(), "首载是 7d 的第 1 页").toEqual([A, B]);
    expect(listReads()).toBe(1);
    expect(paramOf(first, "window"), "档位从不上线路").toBeNull();
    expect(windowHours(first), "7d = 168 小时的 from/to 对").toBe(168);
    expect(cursorsOf(first)).toEqual([]);
    expect(address()).toContain("tab=events");
    expect(address()).toContain("window=7d");

    await clickTestId("aud01-load-more", "下一页");
    await waitFor(() => paintedRows()[0] === C, "第 2 页上屏");
    const narrow = paintedRows();
    expect(narrow, "窄窗第 2 页三行（两带 rid 一裸）").toEqual([C, D, E]);
    expect(listReads()).toBe(2);
    expect(cursorsOf(lastListRead())).toEqual(["cur_w7p2"]);
    expect(textOf("aud2-page")).toContain("第 2 页");
    expect(shownOf("aud01-status"), "第 2 页三值先对齐").toBe(narrow.length);
    expect(shownOf("aud5-export-count")).toBe(narrow.length);
    expect(valueKeys()).toEqual([C, D]);
    expect(absentKeys()).toEqual([E]);
    expect(ridButtons(), "钮数 == 带 rid 的行数，不是表体行数").toBe(2);

    // 变宽回 30d：上游 :396 自己的裁决 —— 换窗恰是一记重问，「列表不重取」与产品相反。
    const ledger = urls().length;
    await clickTestId("aud01-filter-window-30d", "30d 档位钮");
    await waitFor(() => listReads() === 3, "宽窗那一问落定");
    expect(urls().length, "换窗恰 +1，不滴答").toBe(ledger + 1);
    const widened = lastListRead();
    expect(cursorsOf(widened), "变宽必须丢游标").toEqual([]);
    expect(paramOf(widened, "window")).toBeNull();
    expect(windowHours(widened), "30d = 720 小时").toBe(720);

    const wide = paintedRows();
    expect(wide, "行集换成宽窗自己的第 1 页 —— 替换非累加，窄页第 2 页的行离场（即便 30d 覆盖它们）").toEqual([A, B]);
    expect(wide.filter((key) => narrow.includes(key)), "窄页 C/D/E 一个都不许留在屏上").toEqual([]);
    expect(textOf("aud2-page"), "页码归 1").toContain("第 1 页");
    expect(shownOf("aud01-status"), "三值跟着新屏重算").toBe(wide.length);
    expect(shownOf("aud5-export-count")).toBe(wide.length);
    expect(valueKeys()).toEqual([A]);
    expect(absentKeys()).toEqual([B]);
    expect(ridButtons(), "裸行 B 没有钮：钮数仍是 1 == 带 rid 行数").toBe(1);

    captureDownload();
    const afterSwitch = urls().length;
    await clickTestId("aud01-export", "CSV 门");
    await waitFor(() => captured !== "", "文件交付");
    const records = csvRecords(captured);
    expect(records[0], "列头六字").toEqual(["时间", "类型", "结果", "操作者", "对象", "请求编号"]);
    expect(records.length - 1, "文件数据行 == 新表体 == 两枚读数条").toBe(wide.length);
    expect(records[1]?.[RID_COLUMN], "第 1 行 rid 格 == 宽窗第 1 页自己的行").toBe(RID_A);
    expect(records[2]?.[RID_COLUMN], "裸行在文件里是空格，不是占位").toBe("");
    expect(captured, "窄页第 2 页的 rid 一格都不许渗进新文件").not.toContain(RID_C);
    expect(captured).not.toContain(RID_D);
    expect(blobCalls).toBe(1);
    expect(urlCalls).toBe(1);
    expect(capturedName).toMatch(/^audit-.+-\d{8}-\d{4}\.csv$/);
    expect(urls().length, "导出点击字面为零 —— 这才是「零额外请求」的真实形制").toBe(afterSwitch);
    expect(listReads(), "账本停在首问 + 翻页 + 换窗").toBe(3);
    expect(
      document.querySelectorAll("[data-testid^='sys-evt']"),
      "sys-evt 族整族缺席（第 42 条道：97 处 / 24 个 health 测试文件 / health 产品码 0）",
    ).toHaveLength(0);
  });

  it("③ 未测迁移：第 2 页翻车后不按重试、按换窗逃生 —— 宽窗那一问把错误面板带离、失败锚随它退休、坏页没被顺带重问；三值落在宽窗第 1 页（「保旧行」第 10 次登记：翻车当下是整页清空）", async () => {
    await mount("/system?tab=events&window=7d");
    expect(paintedRows(), "首载第 1 页").toEqual([A, B]);
    failPage2 = true;
    await clickTestId("aud01-load-more", "会翻车的下一页");
    await waitFor(() => document.querySelector("[data-testid='aud01-error']") !== null, "错误面板");
    expect(paintedRows(), "「保旧行」与产品相反（第 10 次登记）：现状整页清空").toEqual([]);
    expect(textOf("aud01-error")).toContain("审计事件没能加载出来");
    expect(textOf("aud01-error-request-id"), "失败锚带全形 rid（前置，逐字钉归 R240 :334）").toContain(FAIL_RID);
    expect(textOf("aud01-status"), "错误句不带数字").toBe("审计事件读取失败");
    expect(shownOf("aud01-status"), "没有「N 条」可数").toBe(-1);
    expect(textOf("aud5-export-count"), "唯一的 0 面在导出读数（产品 :1620 无条件）").toBe("将导出 0 条");
    expect(q<HTMLButtonElement>("aud01-export")!.disabled, "翻车当下 CSV 门关死（逐字钉归 R240 :334）").toBe(true);
    expect(q<HTMLButtonElement>("aud5-export")!.disabled).toBe(true);
    expect(listReads(), "首问 + 坏掉的第二问").toBe(2);
    const brokenAsks = urls().filter((url) => cursorsOf(url).includes("cur_w7p2"));
    expect(brokenAsks, "坏页此刻只被问过一回").toHaveLength(1);

    // 逃生：错误面上档位钮还在吗？—— 实测钉（本文件的新事实；若产品撤了钮，这条 expect 会红，按实测改钉「撤钮」形制）。
    const wide = document.querySelector<HTMLButtonElement>("[data-testid='aud01-filter-window-30d']");
    expect(wide, "错误面上换窗出口还在（过滤器条不在错误面板之内）").not.toBeNull();
    const ledger = urls().length;
    await act(async () => {
      wide?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => document.querySelector("[data-testid='aud01-error']") === null, "面板随宽窗重问退休");
    expect(urls().length, "逃生恰一记重问，没有借机多问").toBe(ledger + 1);
    expect(listReads()).toBe(3);
    const widened = lastListRead();
    expect(cursorsOf(widened), "换窗丢游标").toEqual([]);
    expect(windowHours(widened)).toBe(720);
    expect(textOf("aud01-error-request-id"), "失败锚随面板一起退休，一个字都不剩").toBe("");
    const rows = paintedRows();
    expect(rows, "落在宽窗自己的第 1 页").toEqual([A, B]);
    expect(textOf("aud2-page")).toContain("第 1 页");
    expect(shownOf("aud01-status"), "三值一起对上新屏").toBe(rows.length);
    expect(shownOf("aud5-export-count")).toBe(rows.length);
    expect(valueKeys()).toEqual([A]);
    expect(absentKeys()).toEqual([B]);
    expect(ridButtons()).toBe(1);
    expect(
      urls().filter((url) => cursorsOf(url).includes("cur_w7p2")),
      "坏掉的那一页没有被顺带重问 —— 逃生走的是新问题，不是重试",
    ).toHaveLength(1);
    expect(
      document.querySelectorAll("[data-testid^='sys-evt']"),
      "sys-evt 族整族缺席（第 42 条道）",
    ).toHaveLength(0);
  });
});
