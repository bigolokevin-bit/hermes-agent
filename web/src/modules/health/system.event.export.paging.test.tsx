// @vitest-environment jsdom
/**
 * R240（重签发）— /system 事件表导出「时间窗 × 分页」四腿护栏，全部走在组合地址
 * `/system?tab=events&window=30d` 上；上游同族（R249/R250/R244/R213/R161）都在裸 `/audit`。
 *
 * 工单四条与现状的对账（已覆盖的只回证据，不写重复用例）：
 * - ①「第 2 页后切窗：重置游标、行替换非累加、计数重算、导出只含新窗已加载行」——
 *   整条已在域内钉死：R235 `system.event.copy.paging.test.tsx`:343（翻页后切 24h 档：
 *   游标清零、行换代无残留、两枚读数条随新集合重算、恰 +1 读、窄文件零旧行）与 :289
 *   （第 2 页复制串 == 文件非空 rid 格 == 屏上那格，同序）；另有 R221 :276、R225 :198、
 *   上游 R243 `audit.filter.paging.export.test.tsx`:312。本文件不重写 ①。
 * - ②「导出遵 window 且首行时间落窗内、逐行复制与 CSV 同行逐字」——首行同源的【其余列】
 *   归上游 R249 :324（裸 /audit、抽屉开着：records == 表体 == 读数、rid 位置序、
 *   actor/type/object 逐字），但它【没有碰时间格】；屏上边界归 R203 `audit.window.bounds.test.tsx`:216。
 *   本文件净补两条：文件时间格 == 屏上 `-time` 格的 dd（例②），以及【每一条】文件时间格
 *   都落在该请求自己的 from/to 对内（分钟形校验；例③）——文件的时格对窗，此前无人钉过。
 * - ③「第 2 页 500：保旧行 + rid 可复制 + 重试恰 +1，导出仍只含已成功页、不产半页空行」——
 *   「保旧行」与产品相反（第六次到达）：可达的 load-more 失败是【整页替换】，失败的这一页
 *   什么都不留；保旧行的追加腿唯一重试调用点在 `aud01-page-failure` 内部，现界面够不到
 *   （R161 `audit.paging.test.tsx`:339/:361 与其头 :19-21；R244 头 (b) + :316；R213 :302；
 *   R250 :287 自己也按此口径登记）。门与零请求零 Blob 的裸 /audit 语境归 R250 :287，
 *   恢复页满列与重试账本归 R250 :314。本文件在组合地址净补：`aud5-export-count` 的
 *   「将导出 0 条」逐字（失败态唯一的真 0 面，产品 :1620 无条件；R181 :216 只在空态钉过）、
 *   `aud01-status` 的无数字错误句（组合地址首钉；裸 /audit 归 R213②）、失败锚 rid 的
 *   【点击】落全形且零取数（R250 只看了文本、R244 只看了按钮在场、R229 点的是首屏失败）、
 *   恢复集合里的 value/absent 分裂与裸行「该字段未返回」（R250 的恢复页两行都带 rid，没有这一层）、
 *   【物理行数】不产半页空行（R250 的 dataLines 把空行滤掉了，看不见这一层）。
 * - ④「末页 disabled + title」——后半句与产品相反，如实登记：`aud01-load-more` 确实按
 *   `!list.next` 禁用（产品 :2091），但它【没有 title】；末页的说法是一句看得见的
 *   「这一页就这些了。」（:2100-2102），「服务端没有再给下一页的游标」是技术详情折叠里的一行
 *   （:2117），不是悬停标题。裸 /audit 的「禁用为真 + 可见句在场 + title 缺位」归 R161
 *   `audit.paging.test.tsx` 头 :23-25 与 :317。本文件在组合地址重申，并净补两枚读数条与
 *   表体同一个数、状态句无「下面还有更多」、`sys-evt-more` 缺席。
 *
 * `sys-evt` 族缺席 —— 第 32 条道（基线 `6db4e647` 实测）：`git grep -E "sys-evt|
 * sysEventCopyText|evt-copy|evt-more|evt-count" -- src` 共 57 处命中，分布在 16 个文件且
 * 全部是 health 的【测试】文件（system.copy.crosstab / system.cross.failure /
 * system.cross.isolation / system.empty / system.event.combo / system.event.copy.paging /
 * system.event.empty / system.event.export / system.event.export.fulltext /
 * system.event.rows / system.filters / system.matrix.export / system.refresh.race /
 * system.state.isolation / system.time / system.window.isolation），health 产品码命中 0。
 * 工单点名的 `sys-evt-copy-<i>` / `sys-evt-count` / `sys-evt-more` 无对应物，只在 DOM 上
 * 断言「不存在」，绝不编造；三面诚实重形成 `aud01-status` + `aud5-export-count`（无条件
 * 「将导出 N 条」）+ 逐行 `aud01-cell-<key>-request-value`（有值）/ `-request-value-absent`（裸行）。
 *
 * 跨模块挂载声明：文件按工单落在 modules/health，被测组件是 modules/audit 的
 * `AuditEventsModulePage`，挂组合地址 —— R135/R221/R225/R228/R235/R236/R237 同款做法；
 * audit 与 shell 只挂载、只读，从未编辑。时钟只冻结 Date（toFake 一项），定时器是真的，
 * 迭代封顶的 waitFor 不受影响；NOW 钉在最新一行之后，相对 30 天窗把三行都包进去。
 * 本文件不新增任何产品 testid；`probe-location` 是私有证人节点。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));
const clipboard = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clipboard.copyTextToClipboard }));

import { ApiError } from "@/lib/api-error";
import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let restoreDownload: (() => void) | null = null;
let captured = "";
let capturedName = "";
let blobCalls = 0;
let urlCalls = 0;
let failPage2 = false;

/** 冻结的「现在」：晚于最新一行，30 天窗把 FRESH/MID/TAIL 全部包进去。 */
const NOW = Date.parse("2026-11-20T06:00:00Z");

/** 迭代封顶而非墙钟：Date 被冻，setTimeout 是真的。 */
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
const q = <T extends Element>(testId: string): T | null =>
  document.querySelector<T>(`[data-testid='${testId}']`);
const address = (): string => q("probe-location")?.textContent ?? "";
const paramOf = (url: string, key: string): string | null =>
  new URL(url, "http://console.test").searchParams.get(key);
const cursorsOf = (url: string): string[] =>
  [...new URL(url, "http://console.test").searchParams.getAll("cursor")];
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
    (node.getAttribute("data-testid") ?? "").replace("aud01-cell-", "").replace("-request-value", ""),
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
const textOf = (testId: string): string => q(testId)?.textContent?.trim() ?? "";
/** 值列屏上的那一句：`CopyValue` 外层是 testid 节点，内层 mono span 才是屏上形。 */
function screenRid(key: string): string {
  const cell = q(`aud01-cell-${key}-request-value`);
  return cell?.firstElementChild?.textContent?.trim() ?? "";
}
/** Field 格（-time/-actor/-object）渲染 dt+dd，屏上的值在 dd 里。 */
function fieldDd(key: string, field: string): string {
  const cell = q(`aud01-cell-${key}-${field}`);
  return cell?.querySelector("dd")?.textContent?.trim() ?? "";
}
/** 读数句里的第一个「N 条」；没有数字（错误句）返回 -1。 */
function shownOf(testId: string): number {
  const m = textOf(testId).match(/(\d+)\s*条/);
  return m ? Number(m[1]) : -1;
}
/** 文件时间格是北京时间分钟形，还原成毫秒以便与请求的 from/to 对表。 */
const beijingInstant = (cell: string): number => Date.parse(`${cell.replace(" ", "T")}:00+08:00`);

async function clickTestId(testId: string, label: string): Promise<void> {
  const node = q<HTMLButtonElement>(testId);
  if (!node) throw new Error(`missing clickable node: ${label} (${testId})`);
  await act(async () => {
    node.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
/** 复制某一行的请求编号，返回落到剪贴板的那一句。 */
async function copyRow(key: string): Promise<string> {
  const cell = q(`aud01-cell-${key}-request-value`);
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
/** 点失败锚上的复制钮，返回落剪贴板的整串（R229 的点法，用在翻页失败语境）。 */
async function copyErrorRid(): Promise<string> {
  const anchor = q("aud01-error-request-id");
  if (!anchor) throw new Error("missing failing anchor before copying its rid");
  const button = anchor.querySelector<HTMLButtonElement>("button[aria-label='复制请求编号']");
  if (!button) throw new Error("missing copy button on the failing anchor");
  clipboard.copyTextToClipboard.mockClear();
  await act(async () => {
    button.click();
    await Promise.resolve();
  });
  await waitFor(() => clipboard.copyTextToClipboard.mock.calls.length > 0, "anchor rid landed");
  return String(clipboard.copyTextToClipboard.mock.lastCall?.[0] ?? "");
}
/** 面板里的重试钮没有 testid，按文字找（R249/R245 的点法）。 */
async function clickErrorRetry(): Promise<void> {
  const panel = q("aud01-error");
  if (!panel) throw new Error("no failure panel to retry from");
  const buttons = Array.from(panel.querySelectorAll<HTMLButtonElement>("button"));
  const retry = buttons.find((element) => element.textContent?.includes("重试") ?? false);
  if (!retry) throw new Error(`no retry button in the panel (saw ${buttons.length} buttons)`);
  await act(async () => {
    retry.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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
/** 去掉 BOM，只留记录；每行按逗号切列。请求编号第 6 列（下标 5），时间第 1 列（下标 0）。 */
function csvRecords(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, "")
    .trimEnd()
    .split("\r\n")
    .map((line) => line.split(","));
}
const RID_COLUMN = 5;
const TIME_COLUMN = 0;

const FRESH = "evt_fresh00000001";
const MID = "evt_mid0000000002";
const TAIL = "evt_tail000000003";
const RID_FRESH = "req-fresh-0001";
const RID_MID = "req-mid-0002";
/** 破折号形 rid：不触发 R31 短码折叠，屏上 == title == 剪贴板 == 一个串。 */
const FAIL_RID = "req-window-p2-500";

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

/** 30 天窗的第一页与第二页（第二页一行带 rid、一行裸）。 */
const W30_PAGE1 = {
  items: [rowOf(FRESH, "2026-11-20T05:30:00Z", RID_FRESH), rowOf(MID, "2026-11-19T05:00:00Z", RID_MID)],
  nextCursor: "cur_rows2",
};
const W30_PAGE2 = {
  items: [rowOf(MID, "2026-11-19T05:00:00Z", RID_MID), rowOf(TAIL, "2026-11-18T04:00:00Z", null)],
  nextCursor: null,
};

/** 假服务按请求自己的游标决定行集；失败旗标按引用读，装一次就能中途翻档。 */
function answerWindow(): void {
  api.fetchJSON.mockImplementation(async (url: unknown) => {
    const text = String(url ?? "undefined");
    if (text.includes("audit-detail")) return { audit: {} };
    if (paramOf(text, "cursor") === "cur_rows2") {
      if (failPage2) {
        throw new ApiError("audit upstream exploded", {
          status: 500,
          body: "{}",
          url: text,
          requestId: FAIL_RID,
        });
      }
      return W30_PAGE2;
    }
    return W30_PAGE1;
  });
}

async function render(entry: string): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
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
  await waitFor(() => document.querySelector(".animate-pulse") === null, "first paint settled");
}
async function mount(entry: string): Promise<void> {
  api.fetchJSON.mockReset();
  answerWindow();
  await render(entry);
}

beforeEach(() => {
  failPage2 = false;
  api.fetchJSON.mockReset();
  clipboard.copyTextToClipboard.mockReset();
  clipboard.copyTextToClipboard.mockResolvedValue(true);
  answerWindow();
  window.history.replaceState({}, "", "/");
});

afterEach(async () => {
  restoreDownload?.();
  restoreDownload = null;
  await act(async () => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
  window.history.replaceState({}, "", "/");
  vi.useRealTimers();
});

describe("R240 - /system 事件表：翻页失败的两扇门、爬起来的一页、末页的一句实话", () => {
  it("第 2 页翻车：两枚导出门在组合地址各自关死，0 只落在导出读数上，强点零请求零 Blob，失败锚 rid 一点就落全形", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    await mount("/system?tab=events&window=30d");
    expect(paintedRows(), "首载是 30 天窗的第一页").toEqual([FRESH, MID]);
    failPage2 = true;
    await clickTestId("aud01-load-more", "下一页");
    await waitFor(() => q("aud01-error") !== null, "失败锚亮起");
    expect(
      paintedRows(),
      "整页替换：失败的这一页什么都不留 —— 工单「保旧行」与产品相反（第六次到达），口径归 R161 :339/:361 + R244 头 (b) + R213 :302，R250 :287 同此登记",
    ).toEqual([]);
    expect(textOf("aud01-error")).toContain("审计事件没能加载出来");
    expect(textOf("aud01-error-request-id")).toContain(FAIL_RID);
    expect(textOf("aud01-status"), "读数行切到错误句，一个数字都不带（裸 /audit 归 R213②，组合地址首钉）").toBe(
      "审计事件读取失败",
    );
    expect(shownOf("aud01-status"), "错误句里没有 N 可数").toBe(-1);
    expect(
      textOf("aud5-export-count"),
      "唯一的真 0 面：导出读数无条件报 0 条（产品 :1620；R181 :216 只在空态钉过，失败态首钉）",
    ).toBe("将导出 0 条");
    expect(
      document.querySelectorAll("[data-testid^='sys-evt']"),
      "sys-evt 族第 32 条道：57 命中全在 16 个 health 测试文件，产品码 0 —— 只断言缺席",
    ).toHaveLength(0);
    expect(document.querySelectorAll("[data-testid^='aud01-cell-']"), "行清空后一格 cell 都不留").toHaveLength(0);
    const csv = q<HTMLButtonElement>("aud01-export");
    const filtered = q<HTMLButtonElement>("aud5-export");
    expect(csv, "CSV 门在场").not.toBeNull();
    expect(filtered, "筛选门在场").not.toBeNull();
    expect(csv?.disabled).toBe(true);
    expect(csv?.getAttribute("title")).toBe("当前筛选没有可导出的记录");
    expect(filtered?.disabled).toBe(true);
    expect(filtered?.getAttribute("title")).toBe("当前筛选无事件可导出");
    captureDownload();
    const base = urls().length; // 基准必须在失败落定之后重取
    await clickTestId("aud01-export", "CSV 门（强点）");
    await clickTestId("aud5-export", "筛选门（强点）");
    expect(urlCalls, "强点不生成 URL").toBe(0);
    expect(blobCalls, "强点不生成 Blob").toBe(0);
    expect(captured).toBe("");
    expect(capturedName).toBe("");
    expect(urls().length, "账本一字不动（裸 /audit 的同款账归 R250 :287）").toBe(base);
    expect(listReads(), "失败不偷加一次读").toBe(2);
    const rid = await copyErrorRid();
    expect(rid, "失败锚的 rid 点一下就是完整 id —— 翻页失败语境的首次点击（R250 只看文本，R244 只看钮在场）").toBe(
      FAIL_RID,
    );
    expect(urls().length, "复制不花任何请求").toBe(base);
    expect(address()).toContain("tab=events");
    expect(address()).toContain("window=30d");
  });

  it("重试恰 +1 爬起来：物理行数不产半页空行，每一条文件时间都落在请求的窗内，逐行复制与文件同格", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    await mount("/system?tab=events&window=30d");
    failPage2 = true;
    await clickTestId("aud01-load-more", "下一页");
    await waitFor(() => q("aud01-error") !== null, "失败锚亮起");
    failPage2 = false; // 翻档必须在点重试之前
    const before = urls().length;
    await clickErrorRetry();
    await waitFor(() => urls().length === before + 1, "重试恰 +1（裸 /audit 的账本归 R250 :314 / R213 :302）");
    await waitFor(() => q("aud01-error") === null, "面板退场");
    expect(listReads(), "首问、坏页、重试共三问，不多不少").toBe(3);
    expect(cursorsOf(lastListRead()), "重试读的原地就是那一页，游标还在线路上").toEqual(["cur_rows2"]);
    const rows = paintedRows();
    expect(rows, "恢复的是重试那一页的集合，不是并集 —— 并集是追加腿的承诺，现界面够不到（R213③ 口径）").toEqual([
      MID,
      TAIL,
    ]);
    expect(new Set(rows).size, "重叠 id 只出现一次").toBe(rows.length);
    expect(shownOf("aud01-status"), "读数行重算回表体数").toBe(rows.length);
    expect(shownOf("aud5-export-count"), "导出读数与表体同一个数").toBe(rows.length);
    expect(valueKeys(), "恢复集合里一行带 rid、一行裸 —— 这个分裂 R250 的恢复页没有（两行都带 rid）").toEqual([MID]);
    expect(absentKeys()).toEqual([TAIL]);
    const bare = q(`aud01-cell-${TAIL}-request-value-absent`);
    expect(bare?.textContent?.trim(), "裸行只给一句说明，不给死按钮").toBe("该字段未返回");
    expect(bare?.querySelector("button")).toBeNull();
    captureDownload();
    const ledger = urls().length;
    await clickTestId("aud01-export", "CSV 门");
    await waitFor(() => captured !== "", "文件交付");
    const raw = captured.replace(/^\uFEFF/, "").split("\r\n");
    expect(raw[raw.length - 1], "文件以换行收尾").toBe("");
    expect(
      raw.length - 2,
      "物理行数 == 表体：没有半页空行混进来 —— R250 的 dataLines 把空行滤掉，看不见这一层",
    ).toBe(rows.length);
    expect(
      raw.slice(1, -1).every((line) => line !== ""),
      "数据行之间不许有空行",
    ).toBe(true);
    const records = csvRecords(captured);
    expect(records[0]).toEqual(["时间", "类型", "结果", "操作者", "对象", "请求编号"]);
    expect(records.length - 1).toBe(rows.length);
    expect(
      records.slice(1).map((cells) => cells[RID_COLUMN]),
      "rid 列按屏上顺序：有值行给全形，裸行给空格，不给占位值",
    ).toEqual([RID_MID, ""]);
    expect(captured).not.toContain(FAIL_RID);
    expect(captured).not.toContain("审计事件没能加载出来");
    expect(captured).not.toContain("该字段未返回");
    const read = lastListRead();
    const fromMs = Date.parse(paramOf(read, "from") ?? "");
    const toMs = Date.parse(paramOf(read, "to") ?? "");
    expect(Number.isNaN(fromMs), "请求带的是可读的 from").toBe(false);
    expect(Number.isNaN(toMs), "请求带的是可读的 to").toBe(false);
    for (const cells of records.slice(1)) {
      const t = cells[TIME_COLUMN] ?? "";
      expect(t, "文件时间格是北京时间分钟形").toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
      const ms = beijingInstant(t);
      expect(
        ms >= fromMs && ms <= toMs,
        "每一条（含首行）都落在这一页请求自己的 from/to 对内 —— 文件的时格对窗此前无人钉过；屏上边界归 R203 :216",
      ).toBe(true);
    }
    expect(screenRid(MID), "屏上那格就是全形").toBe(RID_MID);
    const copied = await copyRow(MID);
    expect(copied, "逐行复制与文件那一格同一个串，重试之后仍然成立（组合地址的恢复语境首钉）").toBe(RID_MID);
    expect(copied).toBe(records[1]?.[RID_COLUMN]);
    expect(blobCalls).toBe(1);
    expect(urlCalls).toBe(1);
    expect(capturedName).toMatch(/^audit-.+-\d{8}-\d{4}\.csv$/);
    expect(urls().length, "导出与复制都不花请求").toBe(ledger);
    expect(listReads(), "账本停在三问").toBe(3);
  });

  it("没有翻车的第 2 页：首行的时间与 rid 格逐字对得上屏上首行，文件里不许有上一页的 rid", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    await mount("/system?tab=events&window=30d");
    await clickTestId("aud01-load-more", "下一页");
    await waitFor(() => paintedRows()[0] === MID, "第 2 页上屏");
    const rows = paintedRows();
    expect(rows).toEqual([MID, TAIL]);
    captureDownload();
    const ledger = urls().length;
    await clickTestId("aud01-export", "CSV 门");
    await waitFor(() => captured !== "", "文件交付");
    const records = csvRecords(captured);
    expect(records.length - 1, "行数 == 表体（裸 /audit 的满列与位置序归 R249 :324）").toBe(rows.length);
    expect(shownOf("aud01-status"), "读数行同一个数").toBe(rows.length);
    expect(shownOf("aud5-export-count"), "导出读数同一个数").toBe(rows.length);
    const first = records[1];
    expect(first, "首条数据在场").toBeDefined();
    const screenTime = fieldDd(MID, "time");
    expect(screenTime, "屏上 -time 的 dd 是秒形（实测纠正：不是分钟形）").toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
    );
    expect(
      first?.[TIME_COLUMN],
      "首行时间格 == 屏上首行 dd 的同一时刻折到分钟 —— R249 钉了首行同源却没碰时间格",
    ).toBe(screenTime.slice(0, 16));
    expect(first?.[RID_COLUMN], "首行 rid 格 == 屏上首行的值列").toBe(screenRid(MID));
    expect(first?.[RID_COLUMN]).toBe(RID_MID);
    expect(captured, "上一页的 rid 不许渗进这一页的文件").not.toContain(RID_FRESH);
    expect(blobCalls).toBe(1);
    expect(urlCalls).toBe(1);
    expect(urls().length, "导出零取数").toBe(ledger);
    expect(listReads(), "账本停在首问 + 翻页").toBe(2);
  });

  it("末页如实禁用：钮还在但点不动、没有 title、看得见那句；两枚读数条与表体同一个数，sys-evt-more 缺席", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    await mount("/system?tab=events&window=30d");
    await clickTestId("aud01-load-more", "下一页");
    await waitFor(() => paintedRows()[0] === MID, "第 2 页上屏（也是末页，nextCursor 为 null）");
    const rows = paintedRows();
    const more = q<HTMLButtonElement>("aud01-load-more");
    expect(more, "末页不退休：控件还在，按 !list.next 禁用（产品 :2091；裸 /audit 归 R161 :317）").not.toBeNull();
    expect(more?.disabled).toBe(true);
    expect(
      more?.getAttribute("title"),
      "工单「disabled + title」的后半句与产品相反：它没有 title，末页的说法是一句看得见的文案（口径归 R161 头 :23-25）",
    ).toBeNull();
    expect(document.body.textContent, "看得见的末页句在场").toContain("这一页就这些了。");
    expect(textOf("aud01-status"), "状态句不再带「下面还有更多」").not.toContain("下面还有更多");
    expect(shownOf("aud01-status"), "读数行与表体同一个数").toBe(rows.length);
    expect(shownOf("aud5-export-count"), "导出读数与表体同一个数").toBe(rows.length);
    expect(document.querySelectorAll("[data-testid^='sys-evt']"), "sys-evt-more 同族缺席（第 32 条道）").toHaveLength(0);
    expect(address()).toContain("window=30d");
  });
});
