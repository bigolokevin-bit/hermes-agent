// @vitest-environment jsdom
// R257（收窄重发）— /system 事件表在 ?window=7d 站的「三值」口径：计数、行集、逐行复制控件。
//
// 派工三例逐条对现状，两处与产品相反，本文件按现状钉死并当场登记，不伪造：
// (a) 「sys-evt-count / sys-evt-copy-<i>」这族锚不存在 —— 第 40 次遇到（现查跟踪树 89 行命中 /
//     23 个 health 测试文件 / health 产品码 0 命中；本文件自己那些不计入）。事件面上真实的三面是
//     `aud01-status`（「已显示 N 条审计事件（…）」）、`aud5-export-count`（「将导出 N 条」，产品
//     AuditEventsModulePage.tsx:1620 无条件，所以失败/空集时它是唯一那个诚实的 0 面）、屏上表体行；
//     逐行复制控件长在 `aud01-cell-<key>-request-value` 里（裸行给 -request-value-absent，无按钮）。
//     ⇒ 「复制钮数 == 表体行数」也与产品相反：诚实等式是 钮数 == 带请求编号的行数，
//       且 valueKeys + absentKeys == 表体行数。R221 :241 与 R124 :300 已各钉一半。
// (b) 「第 2 页 500 保旧行」—— 第 8 次遇到，现状是整页替换：走 aud01-load-more 的失败把行清空
//     （R161 audit.paging.test.tsx :339 / :361 与其头 :19-21；R244 audit.copy.paging2.test.tsx 头条款 (b)
//     与 :316；R213 audit.error.test.tsx :302；R250 audit.export.window.detail.paging.test.tsx :287；
//     R240 system.event.export.paging.test.tsx :334）。真正「保旧行」的追加腿，其唯一重试调用点在
//     aud01-page-failure 里面，现界面够不到。本文件钉清空，不钉保留。
// (c) 「三值不变」也反：失败这一页什么都不剩，三面一起动 —— 计数位切到 0、读数行切成不带数字的
//     「审计事件读取失败」（产品 :1355-1365）。诚实说法是「三值一起动、一起对」，本文件两段都钉。
//
// 已覆盖、这里不重写（只回证据，文件:行）：
// - R124 system.event.export.fulltext.test.tsx:300 —— 同一个 ?tab=events&window=7d 站的三面普查
//   （rows [FRESH, MID, BAREROW]、valueKeys [FRESH,MID]、absentKeys [BAREROW]、零 -status 节点、
//   32 位十六进制屏上折 8 位、title 持全形、裸行「该字段未返回」无按钮、文件六列、data.length ==
//   rows.length、rid 列 [RID_FRESH, RID_MID, ""]、blobCalls/urlCalls 各 1、导出零请求）；
// - R221 system.event.export.test.tsx:241（逐行可复制控件数 == 带请求编号的行数）/:276/:315/:365/:394；
// - R235 system.event.copy.paging.test.tsx:289（第 2 页复制串 == 文件非空 rid 格、同序、导出零成本）
//   与 :343/:357（翻页后切窗：游标清零、行替换非累加、页码归 1、两枚读数条跟着走、恰多一笔读）；
// - R225 system.event.rows.test.tsx:198/:202/:213/:227/:261（aud2-page 的面与逐行控件 1:1 重映射）；
// - R240 system.event.export.paging.test.tsx:334（失败锚 rid 在第 2 页失败下被点、写全形、零读）
//   /:387（重试恰 +1、listReads 3）/:462/:496；R213 :302、R249 audit.export.paging.detail.test.tsx:398、
//   R250 :287/:314、R229、R120 system.cross.failure.test.tsx:304（失败隔离与 rid 可复制）；
// - 上游本波 R270 audit.filter.combo.test.tsx:276（筛选态下 表体×读数×文件 一个数，裸 /audit）与 :305
//   （未知动作地址逐字不改、不建文件）；R267 audit.export.paging.sequence.test.tsx:275（翻页后换窗：
//   游标清零、行换代、页码归 1、文件无旧行）—— 都在裸 /audit 上，没有组合地址与逐行控件普查。
//
// 本文件净新只有一站一面：组合地址 ?window=7d 上，「加载更多」把三面一起推到第 2 页的数、
// 逐行控件数跟着带 rid 的行数走；换窗把页码打回 1 且三面一起重算；第 2 页翻车时三面一起塌到
// 0 与不带数字的那句，失败锚的 rid 一点就落全形且分文不花，爬起来恰多一笔读。
//
// 线路事实：档位从不上线，上线的是 ISO from/to 对（window.ts:22/:77/:105），所以 paramOf(read,"window")
// 恒为 null；7d 站的 span 恰 168 小时。跨模块挂载照旧：文件按派工放 modules/health，被测组件是
// modules/audit/AuditEventsModulePage，审计面只挂载/只读，从未编辑。
// 本文件不新增任何产品 testid；probe-location 是私有证人节点。
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));
const clipboard = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clipboard.copyTextToClipboard }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { ApiError } from "@/lib/api-error";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let failPage2 = false;

/** 迭代封顶而非墙钟：本文件永不冻结计时器（「已复制」的 2500 ms 复位是真 setTimeout，states.tsx:542）。 */
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
/** 带请求编号的行：值列存在（CopyValue 只在有值时渲染这个 testid）。 */
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
/** 逐行复制控件的真实数目（只数行内值列那颗；失败锚上的 RequestIdLine 用的是同一个 aria-label）。 */
const ridButtons = (): number =>
  document.querySelectorAll("[data-testid^='aud01-cell-'] button[aria-label='复制请求编号']").length;

const textOf = (testId: string): string =>
  document.querySelector(`[data-testid='${testId}']`)?.textContent?.trim() ?? "";
/** 读数行/导出读数里的第一个「N 条」；没有数字给 -1（失败态那句本来就不带数字）。 */
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

/** 失败锚上的请求编号复制：节点是 aud01-error-request-id-value 里的按钮，返回落到剪贴板的那一句。 */
async function copyErrorRid(): Promise<string> {
  const anchor = document.querySelector("[data-testid='aud01-error-request-id']");
  if (!anchor) throw new Error("missing the failing anchor's request-id line");
  const button = anchor.querySelector<HTMLButtonElement>("button[aria-label='复制请求编号']");
  if (!button) throw new Error("missing copy button inside the failing anchor");
  clipboard.copyTextToClipboard.mockClear();
  await act(async () => {
    button.click();
    await Promise.resolve();
  });
  await waitFor(() => clipboard.copyTextToClipboard.mock.calls.length > 0, "copy landed on the anchor");
  return String(clipboard.copyTextToClipboard.mock.lastCall?.[0] ?? "");
}

/** 面板里那颗「重试」Button 没有 testid，只能按文字找，再派发一次冒泡 click。 */
async function clickErrorRetry(): Promise<void> {
  const panel = document.querySelector("[data-testid='aud01-error']");
  if (!panel) throw new Error("missing the whole-page failure panel before retry");
  const buttons = Array.from(panel.querySelectorAll<HTMLButtonElement>("button"));
  const retry = buttons.find((node) => (node.textContent ?? "").includes("重试"));
  if (!retry) throw new Error(`no 重试 button among ${buttons.length} panel buttons`);
  await act(async () => {
    retry.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
}

const A = "evt_counts0000001";
const B = "evt_counts0000002";
const C = "evt_counts0000003";
const D = "evt_counts0000004";
const E = "evt_counts0000005";
const RID_A = "req-counts-0001";
const RID_C = "req-counts-0003";
const RID_D = "req-counts-0004";
const FAIL_RID = "req-counts-p2-500";

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

/** 7 天窗的第一页（两行，其中 B 裸）、第二页（三行，其中 E 裸），以及 24 天窗只认得 A。 */
const W7_PAGE1 = {
  items: [rowOf(A, "2026-11-20T18:00:00Z", RID_A), rowOf(B, "2026-11-20T06:00:00Z", null)],
  nextCursor: "cur_counts2",
};
const W7_PAGE2 = {
  items: [
    rowOf(C, "2026-11-19T20:00:00Z", RID_C),
    rowOf(D, "2026-11-19T08:00:00Z", RID_D),
    rowOf(E, "2026-11-18T22:00:00Z", null),
  ],
  nextCursor: null,
};
const W24_PAGE1 = { items: [rowOf(A, "2026-11-20T18:00:00Z", RID_A)], nextCursor: null };

/** 假服务按请求自己带的 from/to 与 cursor 决定行集，和真 BFF 一样由服务端筛；失败只咬带游标那一笔。 */
function answerPaged(): void {
  api.fetchJSON.mockImplementation(async (url: unknown) => {
    const text = String(url ?? "undefined");
    if (text.includes("audit-detail")) return { audit: {} };
    if (paramOf(text, "cursor") === "cur_counts2") {
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
    return windowHours(text) <= 25 ? W24_PAGE1 : W7_PAGE1;
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
  failPage2 = false;
  answerPaged();
  await render(entry);
}

const ENTRY = "/system?tab=events&window=7d";

beforeEach(() => {
  api.fetchJSON.mockReset();
  clipboard.copyTextToClipboard.mockReset();
  clipboard.copyTextToClipboard.mockResolvedValue(true);
  failPage2 = false;
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

describe("R257 — /system 事件表 ?window=7d 站的三值口径", () => {
  it("① 三值在 7d 站同一个数，复制钮只数带请求编号的行；sys-evt 族整族缺席", async () => {
    await mount(ENTRY);
    const rows = paintedRows();
    expect(rows, "首载是 7 天窗的第一页").toEqual([A, B]);
    expect(listReads(), "首载恰一问").toBe(1);

    const read = lastListRead();
    expect(paramOf(read, "window"), "档位从不上线，上线的是 from/to 对").toBeNull();
    expect(windowHours(read), "7d 站的跨度恰 168 小时").toBe(168);
    expect(cursorsOf(read), "首读不带游标").toEqual([]);
    expect(address(), "地址留着 tab=events 与 window=7d").toContain("tab=events");
    expect(address()).toContain("window=7d");

    // 派工点名的三面在这一站不存在，只断言缺席，绝不编造（第 40 次遇到）。
    expect(
      document.querySelectorAll("[data-testid^='sys-evt']"),
      "sys-evt-count / sys-evt-copy-<i> 无对应物：89 行命中全在 health 的测试文件里，产品码 0 命中",
    ).toHaveLength(0);

    // 诚实的三面：读数行、导出读数、屏上表体，同一个数。
    expect(textOf("aud01-status"), "读数行说的是第一页的两行").toContain("已显示 2 条");
    expect(shownOf("aud01-status"), "读数行的数字").toBe(rows.length);
    expect(textOf("aud5-export-count"), "导出读数无条件，同一个数").toBe("将导出 2 条");
    expect(shownOf("aud5-export-count"), "导出读数的数字").toBe(rows.length);

    // 逐行复制控件：钮只数带请求编号的行，裸行给说明节点不给按钮 —— 两半加起来才等于表体。
    expect(valueKeys(), "只有 A 带请求编号").toEqual([A]);
    expect(absentKeys(), "B 是裸行").toEqual([B]);
    expect(ridButtons(), "派工的「钮数 == 表体行数」与产品相反：诚实等式是钮数 == 带 rid 的行数").toBe(
      valueKeys().length,
    );
    expect(
      valueKeys().length + absentKeys().length,
      "值列 + 缺席列 == 表体行数",
    ).toBe(rows.length);
    expect(ridButtons(), "三值之外，控件数没有被这一页的裸行抬高").not.toBe(rows.length);
    expect(
      document.querySelectorAll("[data-testid^='aud01-cell-'][data-testid$='-status']"),
      "行内复制不给任何播报节点（CopyValue 只改按钮自己的字）",
    ).toHaveLength(0);
  });

  it("② 加载更多把三值一起推到第二页的数、页码进第 2 页；换窗后页码归 1 且三值一起重算，旧行一个不留", async () => {
    await mount(ENTRY);
    const first = paintedRows();
    expect(first, "第一页两行").toEqual([A, B]);
    expect(shownOf("aud01-status"), "第一页的读数").toBe(first.length);
    expect(shownOf("aud5-export-count"), "第一页的导出读数").toBe(first.length);
    expect(ridButtons(), "第一页一枚复制钮").toBe(1);

    await clickTestId("aud01-load-more", "下一页");
    await waitFor(() => paintedRows()[0] === C, "第 2 页上屏");
    const second = paintedRows();
    expect(second, "第 2 页是替换不是累加：三行里没有第一页的影子").toEqual([C, D, E]);
    expect(new Set(second).size, "行集唯一").toBe(second.length);
    expect(textOf("aud2-page"), "页码进到第 2 页").toContain("第 2 页");    // 三值一起增长：不是「2 变 3」这一个数动，而是三面同刻对上同一个数。
    expect(shownOf("aud01-status"), "读数行跟着涨").toBe(second.length);
    expect(shownOf("aud5-export-count"), "导出读数跟着涨").toBe(second.length);
    expect(textOf("aud5-export-count"), "导出读数逐字").toBe("将导出 3 条");
    expect(valueKeys(), "第 2 页两行带 rid").toEqual([C, D]);
    expect(absentKeys(), "第 2 页一行是裸的").toEqual([E]);
    expect(ridButtons(), "控件数跟着带 rid 的行数走，不跟表体行数走").toBe(2);
    expect(listReads(), "翻页花恰一笔读").toBe(2);
    expect(cursorsOf(lastListRead()), "这一问带着游标").toEqual(["cur_counts2"]);

    const beforeSwitch = urls().length;
    await clickTestId("aud01-filter-window-24h", "切到 24 小时档");
    await waitFor(() => paintedRows()[0] === A, "窄窗的第一页上屏");
    const narrow = paintedRows();
    expect(narrow, "换窗后行集换代，只有窄窗认得的那一行").toEqual([A]);
    expect(narrow.filter((key) => second.includes(key)), "旧页的行一个不留").toEqual([]);
    expect(textOf("aud2-page"), "换窗把页码打回第 1 页").toContain("第 1 页");
    expect(shownOf("aud01-status"), "三值在新窗一起重算：读数行").toBe(narrow.length);
    expect(shownOf("aud5-export-count"), "三值在新窗一起重算：导出读数").toBe(narrow.length);
    expect(ridButtons(), "控件数也重算").toBe(1);
    expect(listReads(), "换窗花恰一笔读").toBe(3);
    const switched = lastListRead();
    expect(cursorsOf(switched), "换窗把游标清零").toEqual([]);
    expect(paramOf(switched, "window"), "档位仍然不上线").toBeNull();
    expect(windowHours(switched), "24 小时档的跨度").toBeLessThanOrEqual(25);
    expect(urls(), "换窗只多那一问，没有夹带").toHaveLength(beforeSwitch + 1);
    expect(
      document.querySelectorAll("[data-testid^='sys-evt']"),
      "翻页与换窗之后 sys-evt 族仍整族缺席",
    ).toHaveLength(0);
  });

  it("③ 第 2 页翻车：现状是整页清空不是保旧行，三值一起塌到 0 与不带数字的那句；失败锚 rid 一点落全形且分文不花；爬起来恰 +1", async () => {
    await mount(ENTRY);
    expect(paintedRows(), "第一页两行先在眼前").toEqual([A, B]);
    failPage2 = true;

    await clickTestId("aud01-load-more", "翻到会翻车的那一页");
    await waitFor(() => document.querySelector("[data-testid='aud01-error']") !== null, "整页失败锚亮起");

    expect(
      paintedRows(),
      "派工的「第 2 页 500 保旧行」与产品相反（第 8 次）：这一页什么都不留 —— R161 :339/:361、R244 头条款 (b) 与 :316、R213 :302、R250 :287、R240 :334 都已钉同一事实",
    ).toEqual([]);
    expect(textOf("aud01-error"), "失败面板给的是人话").toContain("审计事件没能加载出来");
    expect(textOf("aud01-error-request-id"), "锚上带着这一问的请求编号").toContain(FAIL_RID);
    expect(valueKeys(), "行没了，值列整族不在").toEqual([]);
    expect(absentKeys(), "连缺席列也不在").toEqual([]);

    // 「三值不变」也反：三面一起动 —— 导出读数塌到诚实的 0，读数行切成不带数字的那句。
    expect(textOf("aud5-export-count"), "唯一的 0 面在导出读数上（产品 :1620 无条件）").toBe("将导出 0 条");
    expect(shownOf("aud5-export-count"), "导出读数的数字跟着行集塌").toBe(0);
    expect(textOf("aud01-status"), "读数行换成失败句").toBe("审计事件读取失败");
    expect(shownOf("aud01-status"), "失败句里没有任何数字：解析不出「N 条」").toBe(-1);
    expect(/\d/.test(textOf("aud01-status")), "逐字确认不带数字").toBe(false);
    expect(ridButtons(), "失败态一枚逐行复制钮都没有").toBe(0);

    // 失败锚上的 rid 是可复制的，而且写的是全形 —— 这一问之后再没有第二问。
    const ledger = urls().length;
    const readsBefore = listReads();
    expect(await copyErrorRid(), "锚上的那一句是完整 id（dash 形不被 R31 折叠）").toBe(FAIL_RID);
    expect(urls(), "复制锚上的请求编号不花任何请求").toHaveLength(ledger);
    expect(listReads(), "列表也没被补问").toBe(readsBefore);

    failPage2 = false;
    const beforeRetry = urls().length;
    await clickErrorRetry();
    await waitFor(() => document.querySelector("[data-testid='aud01-error']") === null, "面板消失");
    expect(urls(), "重试恰 +1：只重发这一页，不借机重读别的口").toHaveLength(beforeRetry + 1);
    expect(listReads(), "首载 + 翻页 + 重试 = 三问").toBe(3);
    expect(cursorsOf(lastListRead()), "重试读的还是那一页：游标原样在-line").toEqual(["cur_counts2"]);

    const back = paintedRows();
    expect(back, "爬起来画的是重试那一页的集合，不是并集（R213 :302 的裁决）").toEqual([C, D, E]);
    expect(new Set(back).size, "行集唯一").toBe(back.length);
    expect(textOf("aud01-error-request-id"), "失败锚连同标记一起消失").toBe("");
    // 三值重新对齐到同一个数 —— 「一起动、一起对」的两半都钉住了。
    expect(shownOf("aud01-status"), "恢复后读数行与表体同一个数").toBe(back.length);
    expect(shownOf("aud5-export-count"), "恢复后导出读数与表体同一个数").toBe(back.length);
    expect(valueKeys(), "恢复后带 rid 的两行").toEqual([C, D]);
    expect(absentKeys(), "恢复后裸的那一行").toEqual([E]);
    expect(ridButtons(), "控件数回到带 rid 的行数").toBe(2);
    expect(textOf("aud01-status"), "失败句不在读数行里了").not.toContain("审计事件读取失败");
    expect(
      document.querySelectorAll("[data-testid^='sys-evt']"),
      "失败与恢复全程 sys-evt 族仍整族缺席",
    ).toHaveLength(0);
  });
});
