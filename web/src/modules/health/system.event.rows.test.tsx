// @vitest-environment jsdom
/**
 * R225 — 事件表翻页与窗口叠加的行集/逐行复制护栏（纯测试，产品码零改动）。
 *
 * 派工面与实际面（如实记账，不编造锚点）：
 * - `sys-evt-count` / `sys-evt-copy-<i>` / `sys-evt-more` 本代不存在（第 20 条道确认）：
 *   `git grep -n "sys-evt|sysEventCopyText|evt-copy|evt-more|evt-count" -- web/src`
 *   的命中全是既有注脚与我自己写的缺席断言（`system.cross.isolation:6/7/12`、
 *   `system.empty:13`、`system.event.export:5/6/46/260`、`system.filters:14`、
 *   `system.matrix.export:6`、`system.state.isolation:18`、`system.time:8`、
 *   `system.window.isolation:6/7/231/299`）。health 模块没有事件表；事件表真面在
 *   `modules/audit/AuditEventsModulePage`，本文件按派工单给的文件名落在 health 目录下、
 *   挂载 audit 页面（R135 / R221 已立的跨模块挂载习语，在此声明）。
 * - 真实锚点：行数读数 `aud01-status`（「已显示 N 条审计事件（窗口）」）与 `aud2-page`
 *   （「第 N 页 · 已加载 M 条」）、总数位 `aud2-total`（「总数不可用」）、行 `aud01-row-<key>`、
 *   下一页 `aud01-load-more`、上一页 `aud2-prev`、窗口按钮 `aud01-filter-window-<key>`；
 *   逐行复制 affordance 是请求编号列 `aud01-cell-<key>-request-value`（有值才渲染，
 *   按钮 aria-label「复制请求编号」，走 `copyTextToClipboard` 助手），无值行给
 *   `-request-value-absent`（文案「该字段未返回」，title 是原因句）。
 *
 * 既有用例已覆盖，本文件不重写（派工单的「已覆盖只回证据」纪律）：
 * - ②「翻页后重叠行去重、屏上唯一」＝上游 R161 `audit/audit.paging.test.tsx`
 *   :218 «shows this page's rows, with the overlapping id once» 与 :243 «a cold address
 *   that names a cursor reads that page only, once»：重叠 id 只出现一次、首页独有的行不再
 *   出现、集合唯一、`第 2 页`、游标栈只一枚、+1 读。派工单的「==去重后并集」与产品相反，
 *   该文件头 :8-19 已把这条口径更正钉在案。
 * - ③「第 2 页 500 保旧行」在可达路径上与产品相反：R161 ④ :339 «clears the rows, shows
 *   the reason with a copyable rid, and retries exactly once» 钉了现场事实——走
 *   `aud01-load-more` 的失败是非追加失败，rows 被清、`aud01-error` 上屏、rid 可复制、
 *   重试恰 +1 且不重复追加（`listReads()` 三笔、屏上仍是去重后的第二页两行），并且
 *   :361 断言 `aud01-page-failure` 为 null。真正「保旧行」的追加腿 `aud01-page-failure`
 *   （`AuditEventsModulePage.tsx:2049`）在现界面上够不到：唯一调用点是它自己那颗重试按钮，
 *   而那块只在追加失败之后才渲染——这条缺腿由 R161 头 :19-21 记账，不在此伪造。
 * - ①的一半（切窗丢游标、页码归 1、其余参数逐字保留、只多一笔读）＝ R161 ② :254 / :280，
 *   但那两条挂在裸地址 `/audit` 上且只看请求侧。
 *
 * 本文件填的两处真缺口：
 * (a) ①的行集侧：在 `?tab=events` 组合地址上，翻页再切窗后屏上行集换代——上一窗/上一页
 *     独有行零残留、页数与两枚读数条与表体同一个数、`aud2-prev` 回到禁用；
 * (b) ④的序号侧：逐行复制 affordance 在翻页与切窗重排后仍与行一一对应（值列集合 ==
 *     带 rid 的行、缺值列集合 == 裸行，按 DOM 序），复制串就是该行自己的请求编号
 *     （屏上短形、title 全形，R31 两口径），且复制零额外请求。
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

/** 迭代封顶而非墙钟：本文件的断言不冻结 Date，但既有坑要求写法一致。 */
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

const urls = (): string[] =>
  api.fetchJSON.mock.calls.map((call) => String(call[0])).filter((url) => url !== "undefined");
const listReads = (): number => urls().filter((url) => /^\/agent-api\/api\/audit\?/.test(url)).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}
function cursorsOf(url: string): string[] {
  return [...new URL(url, "http://console.test").searchParams.getAll("cursor")];
}
function windowHours(url: string): number {
  const from = Date.parse(paramOf(url, "from") ?? "");
  const to = Date.parse(paramOf(url, "to") ?? "");
  return (to - from) / 3_600_000;
}

const textOf = (testId: string): string =>
  document.querySelector(`[data-testid='${testId}']`)?.textContent?.trim() ?? "";

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
  ).map((node) => (node.getAttribute("data-testid") ?? "").replace("aud01-cell-", "").replace("-request-value", ""));
}
/** 没带请求编号的行：只给一枚说明节点，不给死按钮。 */
function absentKeys(): string[] {
  return Array.from(
    document.querySelectorAll("[data-testid^='aud01-cell-'][data-testid$='-request-value-absent']"),
  ).map((node) =>
    (node.getAttribute("data-testid") ?? "").replace("aud01-cell-", "").replace("-request-value-absent", ""),
  );
}

async function clickTestId(testId: string, label: string): Promise<void> {
  const node = document.querySelector<HTMLButtonElement>(`[data-testid='${testId}']`);
  if (!node) throw new Error(`missing clickable node: ${label} (${testId})`);
  await act(async () => {
    node.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

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
const W30_PAGE1 = { items: [rowOf(FRESH, "2026-11-20T05:30:00Z", RID_FRESH), rowOf(MID, "2026-11-19T05:00:00Z", RID_MID)], nextCursor: "cur_rows2" };
const W30_PAGE2 = { items: [rowOf(MID, "2026-11-19T05:00:00Z", RID_MID), rowOf(TAIL, "2026-11-18T04:00:00Z", null)], nextCursor: null };
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

beforeEach(() => {
  api.fetchJSON.mockReset();
  clipboard.copyTextToClipboard.mockReset();
  clipboard.copyTextToClipboard.mockResolvedValue(true);
  answerPaged();
  window.history.replaceState({}, "", "/");
});

afterEach(async () => {
  await act(async () => {
    if (root) act(() => root?.unmount());
  });
  root = null;
  document.body.replaceChildren();
  window.history.replaceState({}, "", "/");
  vi.useRealTimers();
});

describe("R225 ① — 翻页后切窗：行集换代、页码归 1、两枚读数条与表体同一个数", () => {
  it("replaces the row set with no stale row from the previous window or page, and moves both read-outs with it", async () => {
    await render("/system?tab=events&window=30d");
    expect(paintedRows(), "首载是 30 天窗的第一页").toEqual([FRESH, MID]);
    expect(textOf("aud01-status")).toContain("已显示 2 条");
    expect(textOf("aud2-page")).toContain("第 1 页 · 已加载 2 条");
    expect(textOf("aud2-total")).toBe("总数不可用");
    expect(
      document.querySelector<HTMLButtonElement>("[data-testid='aud2-prev'] button")?.disabled,
    ).toBe(true);
    expect(document.querySelectorAll("[data-testid^='sys-evt']"), "派工面的 sys-evt-* 本代不存在（第 20 条道）").toHaveLength(0);

    // 翻到第二页：与首页重叠 MID，首页独有的 FRESH 退场。
    await clickTestId("aud01-load-more", "下一页");
    await waitFor(() => paintedRows()[0] === MID, "page two painted");
    expect(paintedRows()).toEqual([MID, TAIL]);
    expect(textOf("aud2-page")).toContain("第 2 页");
    expect(textOf("aud01-status")).toContain("已显示 2 条");
    expect(
      document.querySelector<HTMLButtonElement>("[data-testid='aud2-prev'] button")?.disabled,
    ).toBe(false);
    const before = urls().length;

    // 在第 2 页上切窗：只多一笔读，行集换代，上一页/上一窗的行一枚不剩。
    await clickTestId("aud01-filter-window-24h", "24 小时窗");
    await waitFor(() => paintedRows().join(",") === FRESH, "the 24h page painted");
    expect(paintedRows(), "屏上只剩 24 天窗认得的行").toEqual([FRESH]);
    expect(paintedRows()).not.toContain(MID);
    expect(paintedRows()).not.toContain(TAIL);
    expect(new Set(paintedRows()).size).toBe(paintedRows().length);
    expect(textOf("aud2-page")).toContain("第 1 页");
    expect(textOf("aud01-status")).toContain("已显示 1 条");
    expect(
      document.querySelector<HTMLButtonElement>("[data-testid='aud2-prev'] button")?.disabled,
    ).toBe(true);

    const url = lastListRead();
    expect(cursorsOf(url), "换问题是新问题，游标栈不带过去").toEqual([]);
    expect(windowHours(url)).toBe(24);
    expect(urls().length).toBe(before + 1);
    expect(listReads()).toBe(3);

    // 组合地址：窗换了，tab 一字未动。
    const address = textOf("probe-location");
    expect(address).toContain("tab=events");
    expect(new URLSearchParams(address.slice(address.indexOf("?") + 1)).get("window")).toBe("24h");
  });
});

async function copyRow(key: string): Promise<string> {
  const cell = document.querySelector(`[data-testid='aud01-cell-${key}-request-value']`);
  if (!cell) throw new Error(`missing request-value cell for ${key}`);
  const button = cell.querySelector<HTMLButtonElement>("button[aria-label='复制请求编号']");
  if (!button) throw new Error(`missing copy button in the ${key} request-value cell`);
  clipboard.copyTextToClipboard.mockClear();
  await act(async () => {
    button.click();
    await Promise.resolve();
  });
  await waitFor(() => clipboard.copyTextToClipboard.mock.calls.length > 0, `the ${key} copy landed`);
  return String(clipboard.copyTextToClipboard.mock.lastCall?.[0] ?? "");
}

describe("R225 ④ — 逐行复制 affordance 随翻页/切窗重排后仍与行一一对应、文本同源", () => {
  it("re-maps the per-row copy controls to the painted rows after a page turn and a window switch, and each copy is that row's own id with zero extra reads", async () => {
    await render("/system?tab=events&window=30d");
    expect(paintedRows()).toEqual([FRESH, MID]);
    expect(valueKeys(), "两行都带编号 → 值列与行同序同数，一枚不多一枚不少").toEqual(paintedRows());
    expect(absentKeys()).toEqual([]);
    const readsAfterFirstLoad = urls().length;

    // 文本同源：屏上那一串、title 里的全形与复制出去的串是同一个值。
    const freshCell = document.querySelector(`[data-testid='aud01-cell-${FRESH}-request-value']`)!;
    const freshShown = freshCell.querySelector("span")?.textContent?.trim() ?? "";
    expect(freshCell.querySelector("span")?.getAttribute("title"), "全形只在 title（R31）").toBe(RID_FRESH);
    expect(freshShown).toBe(RID_FRESH);
    expect(await copyRow(FRESH)).toBe(freshShown);
    expect(
      freshCell.querySelector("button[aria-label='复制请求编号']")?.textContent,
    ).toContain("已复制");
    expect(urls(), "复制是本地动作，一请求都不发").toHaveLength(readsAfterFirstLoad);

    // 翻到第二页：MID 带着编号留下，TAIL 没有编号。
    await clickTestId("aud01-load-more", "下一页");
    await waitFor(() => paintedRows()[0] === MID, "page two painted");
    expect(paintedRows()).toEqual([MID, TAIL]);
    expect(valueKeys(), "序号跟着行重排：值列只剩这一页带编号的那行").toEqual([MID]);
    expect(absentKeys(), "没编号的行给说明节点，不给死按钮").toEqual([TAIL]);
    const bare = document.querySelector(`[data-testid='aud01-cell-${TAIL}-request-value-absent']`)!;
    expect(bare.textContent).toBe("该字段未返回");
    expect(bare.getAttribute("title")).toBe("服务这次没有回传请求编号");
    expect(bare.querySelector("button")).toBeNull();
    expect(await copyRow(MID)).toBe(RID_MID);
    expect(urls()).toHaveLength(readsAfterFirstLoad + 1);

    // 切窗再重排：24 天窗只认得 FRESH，值列跟着回到它，复制串仍是它自己的编号。
    await clickTestId("aud01-filter-window-24h", "24 小时窗");
    await waitFor(() => paintedRows().join(",") === FRESH, "the 24h page painted");
    expect(paintedRows()).toEqual([FRESH]);
    expect(valueKeys()).toEqual([FRESH]);
    expect(absentKeys()).toEqual([]);
    const beforeCopy = urls().length;
    expect(await copyRow(FRESH)).toBe(RID_FRESH);
    expect(urls(), "两次复制都没有换来一次读").toHaveLength(beforeCopy);
    expect(listReads(), "首载一页 + 下一页 + 切窗，一共三笔，复制零笔").toBe(3);
  });
});
