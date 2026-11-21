// @vitest-environment jsdom
// R260（自选：空态 × 筛选 × 主操作的维度优先）— /system 事件面上那枚「从来没人点过」的按钮。
//
// 净新声明（现查于 d356be02，wave-114）：
// - 空卡的主体操作按钮 testid 由模板拼出（states.tsx:689 data-testid={`${testId}-clear}），
//   全 web/src 对字面量 aud01-empty-clear / aud01-empty-actions 的 grep 命中为 0 ——
//   本产品按钮从来没有测试引用过它。近邻各钉一边，都不碰这枚：
//   * R123 system.event.empty.test.tsx:346 点的是【卡下具名出口】audB-empty-clear（窗那一维），
//     钉了「清空出口恰多一问」、地址抹掉 from/to、tab=events 逐字、三值回来；
//   * 上游 audit.empty.test.tsx:246 点的是【卡下具名出口】audD-empty-clear（类型那一维），
//     在裸 /audit 上钉 pairs() == ["window=7d"] 与 action 消失；
//   * 空卡自己的那颗主操作、它的三元优先（custom > type，产品注释 :1905-1907
//     「优先对应面板标题所述的那一维……另一维的具名出口仍在卡下原处」）、
//     以及清掉一维之后主操作【换词】这件事，哪儿都没钉。
// - 错误面没有主操作出口：ErrorPanel（states.tsx:707）根本不吃 clear prop ——
//   空态才有那颗门；这一层缺席从未被断言过（R240 :334 / R257 :360 钉的是失败面的门与读数，没碰它）。
//
// 口径裁决（与产品相反处按现状钉死并登记，不伪造）：
// (a) sys-evt-count / sys-evt-copy-<i> 整族不存在 —— 第 43 条道现查 103 处命中 / 25 个文件
//     （全部是 health 的测试文件；本文件自己那几处不计入），health 产品码 0 命中。
//     三值如实钉在 aud01-status × aud5-export-count（产品 :1620 是无条件的「将导出 N 条」，
//     没有门也没有「—」，所以它是空态里唯一真 0 面）× 屏上行数；复制普查钉在
//     valueKeys + absentKeys（裸行的 -absent  span「该字段未返回」没有按钮 ——
//     「钮数 == 表体行数」与产品相反，诚实式是 钮数 == 带 rid 行数）。
// (b) 「第 2 页 500 保旧行」与产品相反 —— 第 11 次到站。走 aud01-load-more 的失败是整页替换：
//     行被清、错误锚带可复制 rid、重试恰 +1。持有者：R161 audit.paging.test.tsx:339/:361 + 头 :23-25、
//     R244 audit.copy.paging2.test.tsx 条款 (b) + :316、R213 audit.error.test.tsx:302、
//     R250 audit.export.window.detail.paging.test.tsx:287、R240 :334、R257 :360、R259 :381。
//     本文件第 ③ 例的 500 尾巴钉的是现状（整页清空），并在错误面上补一颗从未断言过的缺席：
//     aud01-empty-clear 在失败面为 null。
// (c) 档位从不上线：上线的是 from/to 对（window.ts:22/:77/:105）；7d 站请求 span 恰七天、
//     paramOf(read,"window") 恒 null。地址键是 type=，请求键是 action=（产品 :779/:832）。
//
// 已覆盖、这里不重写（只回证据，文件:行）：R123 :346（窗支具名出口全程）、:437（非法窗叠类型：
// action 照线上线、地址逐字、空答复是句子、两扇门各自关死）；上游 audit.empty:246（类型具名出口，
// 裸 /audit）；R221 system.event.export.test.tsx:241/:276/:315/:365/:394；R235 :289/:343/:357；
// R240 :334/:387/:462/:496；R241 :246/:279/:323/:366；R257 :272/:314/:360；R259 :315/:381（换窗逃生）；
// R213 :302；R225 :198/:261；R124 :300；system.window.isolation:212/:239/:278。
//
// 跨模块挂载披露：文件按派工落在 modules/health；被测组件是 modules/audit/AuditEventsModulePage，
// 只挂载、只读，从未编辑（R135/R221/R225/R228/R235/R240/R257/R259 同习语）。
// 本文件不新增任何产品 testid；probe-location 是私有证人节点。
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
let container: HTMLDivElement | null = null;
let restoreDownload: (() => void) | null = null;
let captured = "";
let capturedName = "";
let blobCalls = 0;
let urlCalls = 0;
/** 翻页失败开关：处理器按引用读它，装好之后不换闭包（既有坑）。 */
let failPage2 = false;

const DENIED = "approval.denied";
const FROM = "2026-10-01T00:00:00Z";
const TO = "2026-10-04T00:00:00Z";

/** 迭代封顶而非墙钟；本文件永不冻结计时器。 */
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
const address = (): string => container?.querySelector("[data-testid='probe-location']")?.textContent ?? "";
const q = <T extends Element>(testId: string): T | null =>
  (container?.querySelector(`[data-testid='${testId}']`) ?? null) as T | null;
const all = (selector: string): Element[] => Array.from(container?.querySelectorAll(selector) ?? []);
const textOf = (testId: string): string => q(testId)?.textContent?.trim() ?? "";
const paramOf = (url: string, key: string): string | null =>
  new URL(url, "http://console.test").searchParams.get(key);
const cursorsOf = (url: string): string[] =>
  [...new URL(url, "http://console.test").searchParams.getAll("cursor")];
const spanOf = (url: string): number => {
  const from = Date.parse(paramOf(url, "from") ?? "");
  const to = Date.parse(paramOf(url, "to") ?? "");
  return to - from;
};
const urls = (): string[] =>
  api.fetchJSON.mock.calls.map((call) => String(call[0])).filter((url) => url !== "undefined");
const listReads = (): number => urls().filter((url) => /^\/agent-api\/api\/audit\?/.test(url)).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";
function paintedRows(): string[] {
  return all("[data-testid^='aud01-row-']").map((node) =>
    (node.getAttribute("data-testid") ?? "").replace("aud01-row-", ""),
  );
}
function valueKeys(): string[] {
  return all("[data-testid^='aud01-cell-'][data-testid$='-request-value']").map((node) =>
    (node.getAttribute("data-testid") ?? "").replace("aud01-cell-", "").replace("-request-value", ""),
  );
}
function absentKeys(): string[] {
  return all("[data-testid^='aud01-cell-'][data-testid$='-request-value-absent']").map((node) =>
    (node.getAttribute("data-testid") ?? "").replace("aud01-cell-", "").replace("-request-value-absent", ""),
  );
}
/** 逐行复制钮普查：必须限定在行格族内 —— 失败锚的 RequestIdLine 共用同一个无障碍名（R257 的坑）。 */
const ridButtons = (): number =>
  all("[data-testid^='aud01-cell-'] button[aria-label='复制请求编号']").length;
/** 第一枚「N 条」，没有就 -1：错误句与空句都不带数字。 */
function shownOf(testId: string): number {
  const m = textOf(testId).match(/(\d+)\s*条/);
  return m ? Number(m[1]) : -1;
}
async function clickTestId(testId: string, label: string): Promise<void> {
  const node = q<HTMLButtonElement>(testId);
  if (!node) throw new Error(`missing clickable node: ${label} (${testId})`);
  await act(async () => {
    node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
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
function csvRecords(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, "")
    .trimEnd()
    .split("\r\n")
    .map((line) => line.split(","));
}
const RID_COLUMN = 5;

const A = "evt_clear0000001";
const B = "evt_clear0000002";
const C = "evt_clear0000003";
const RID_A = "req-clear-0001";
const RID_C = "req-clear-0003";
const FAIL_RID = "req-clear-p2-500";

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
const PAGE1 = {
  items: [rowOf(A, "2026-11-20T05:30:00Z", RID_A), rowOf(B, "2026-11-19T05:00:00Z", null)],
  nextCursor: "cur_clear2",
};
const PAGE2 = { items: [rowOf(C, "2026-11-18T04:00:00Z", RID_C)], nextCursor: null };
const EMPTY = { items: [], nextCursor: null };

/** 假服务按请求自己的 action 与 cursor 决定答案，和真 BFF 一样由服务端筛（地址键 type=，请求键 action=）。 */
function answerFiltered(): void {
  api.fetchJSON.mockImplementation(async (url: unknown) => {
    const text = String(url ?? "undefined");
    if (text.includes("audit-detail")) return { audit: {} };
    if (paramOf(text, "action") === DENIED) return EMPTY;
    if (cursorsOf(text).includes("cur_clear2")) {
      if (failPage2) {
        throw new ApiError("audit upstream exploded", {
          status: 500,
          body: "{}",
          url: text,
          requestId: FAIL_RID,
        });
      }
      return PAGE2;
    }
    return PAGE1;
  });
}

async function render(entry: string): Promise<void> {
  if (root) {
    await act(async () => {
      root?.unmount();
    });
    root = null;
  }
  container?.remove();
  container = document.createElement("div");
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
  await waitFor(() => container?.querySelector(".animate-pulse") === null, "skeleton gone");
}
async function mount(entry: string): Promise<void> {
  api.fetchJSON.mockReset();
  failPage2 = false;
  answerFiltered();
  await render(entry);
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  failPage2 = false;
  answerFiltered();
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
  container?.remove();
  container = null;
  document.body.replaceChildren();
  window.history.replaceState({}, "", "/");
});

describe("R260 - 空卡自己的主操作：类型支、三元优先与换词，加上失败面那颗缺席", () => {
  it("① 类型空态站：空卡自己的主操作按钮在场且说的是类型支，与卡下两条具名出口并存；门与 0 照旧，强点分文不花", async () => {
    await mount(`/system?tab=events&window=7d&type=${DENIED}`);
    await waitFor(() => q("aud01-empty") !== null, "空卡亮起");

    expect(listReads(), "首载恰一问").toBe(1);
    const read = lastListRead();
    expect(paramOf(read, "action"), "地址键 type= 上线成请求键 action=").toBe(DENIED);
    expect(paramOf(read, "window"), "档位从不上线，上线的是 from/to 对").toBeNull();
    expect(spanOf(read), "7d 站跨度恰七天").toBe(7 * 24 * 60 * 60 * 1000);
    expect(cursorsOf(read), "首问不带 cursor").toEqual([]);

    // 净新锚：空卡主体的那颗主操作按钮，产品由三元选出类型支。
    expect(q("aud01-empty-actions"), "空卡的动作容器在屏（states.tsx:686）").not.toBeNull();
    const primary = q<HTMLButtonElement>("aud01-empty-clear");
    expect(primary, "空卡自己的主操作在屏 —— 全库第一次有测试引用这枚锚").not.toBeNull();
    expect(textOf("aud01-empty-clear"), "三元按现状走类型支（windowChoice 非 custom 而 eventType 在）").toBe(
      "清掉类型筛选，回到全部类型",
    );
    // 卡下两条具名出口按产品原样并存（R123 点的是窗那枚，上游 audit.empty 点的是类型那枚）。
    expect(textOf("audD-empty-clear"), "卡下类型具名出口同词在场").toBe("清掉类型筛选，回到全部类型");
    expect(textOf("audB-empty-clear"), "卡下窗具名出口按产品原样在场（空态片段无条件渲染它）").toBe(
      "清空区间，回到最近 7 天",
    );

    expect(paintedRows(), "该条件下没有行").toEqual([]);
    expect(textOf("aud01-status"), "空态状态行是句子").toBe("这个筛选条件里没有审计事件");
    expect(shownOf("aud01-status"), "句子里没有数字，不冒充「0 条」").toBe(-1);
    expect(textOf("aud5-export-count"), "唯一真 0 面在导出读数上（产品 :1620 无条件）").toBe("将导出 0 条");
    expect(all("[data-testid^='sys-evt']"), "sys-evt 族不存在（第 43 条道：103 处 / 25 文件 / 产品码 0），只断言缺失").toHaveLength(0);
    expect(all("[data-testid^='aud01-cell-']"), "空集里没有行可挂逐行控件").toHaveLength(0);

    const exportDoor = q<HTMLButtonElement>("aud01-export");
    const filterDoor = q<HTMLButtonElement>("aud5-export");
    expect(exportDoor!.disabled, "主导出门关死").toBe(true);
    expect(filterDoor!.disabled, "筛选快照门关死").toBe(true);
    expect(exportDoor!.getAttribute("title"), "两句原因各自的锁（auditGates.ts:102/:107）").toBe(
      "当前筛选没有可导出的记录",
    );
    expect(filterDoor!.getAttribute("title"), "筛选快照用自己的原因句").toBe("当前筛选无事件可导出");

    const ledger = urls().length;
    captureDownload();
    await clickTestId("aud01-export", "被关死的主导出门");
    await clickTestId("aud5-export", "被关死的筛选快照门");
    expect(urlCalls, "createObjectURL 一次都没被调用").toBe(0);
    expect(blobCalls, "空集不建任何 Blob").toBe(0);
    expect(captured, "没有文件内容").toBe("");
    expect(capturedName, "没有文件名").toBe("");
    expect(urls().length, "点两扇关死的门不花任何请求").toBe(ledger);
    expect(listReads(), "列表读仍是空态那一笔").toBe(1);
  });

  it("② 主操作逃生：点空卡自己的那颗 → 恰多一问、action 下线窗不动、空卡撤走、地址只擦 type=（tab 与 window 逐字），三值与普查回来、门开、导出字面零问", async () => {
    await mount(`/system?tab=events&window=7d&type=${DENIED}`);
    await waitFor(() => q("aud01-empty") !== null, "空卡亮起");
    const ledgerAtEmpty = urls().length;

    await clickTestId("aud01-empty-clear", "空卡自己的主操作（类型支）");
    await waitFor(() => paintedRows().length === 2, "全量两行回来");

    expect(urls().length, "主操作恰多一问（基线取在空态那一笔之后）").toBe(ledgerAtEmpty + 1);
    expect(listReads(), "列表账本从 1 到 2").toBe(2);
    const after = lastListRead();
    expect(paramOf(after, "action"), "类型筛选下线：产品 :832 是 action: eventType || null").toBeNull();
    expect(spanOf(after), "窗那一维一字没动：还是七天的对").toBe(7 * 24 * 60 * 60 * 1000);
    expect(cursorsOf(after), "不借机带旧 cursor").toEqual([]);

    // 地址：type= 被擦，tab 与 window 逐字在场 —— 复合地址那一半是净新（上游 audit.empty:246 在裸 /audit 钉的 pairs）。
    const addr = address();
    expect(addr, "tab=events 一字未动").toContain("tab=events");
    expect(paramOf(addr, "type"), "type= 被主操作擦掉").toBeNull();
    expect(paramOf(addr, "window"), "window=7d 原样在").toBe("7d");

    expect(q("aud01-empty"), "空卡撤走").toBeNull();
    expect(q("aud01-empty-clear"), "主操作随卡撤走").toBeNull();
    expect(q("audD-empty-exit"), "卡下类型出口随筛选消失").toBeNull();

    const rows = paintedRows();
    expect(rows, "全量页是那两行").toEqual([A, B]);
    expect(shownOf("aud01-status"), "状态读数 == 表体行数").toBe(rows.length);
    expect(shownOf("aud5-export-count"), "导出读数 == 表体行数（空态时它是 0，此刻它是 2）").toBe(rows.length);
    expect(valueKeys(), "带 rid 的那行才有复制钮").toEqual([A]);
    expect(absentKeys(), "无 rid 的那行给缺席标记").toEqual([B]);
    expect(ridButtons(), "钮数 == 带 rid 行数；「钮数 == 表体行数」与产品相反").toBe(valueKeys().length);
    expect(ridButtons(), "裸行不给死按钮").not.toBe(rows.length);

    const openDoor = q<HTMLButtonElement>("aud01-export");
    expect(openDoor!.disabled, "门开了：筛选摘掉后有可导出的记录").toBe(false);
    const ledgerAfterClear = urls().length;
    captureDownload();
    await clickTestId("aud01-export", "开着的导出门");
    await waitFor(() => captured !== "", "文件交付");
    const records = csvRecords(captured);
    expect(records[0], "列头六词逐字").toEqual(["时间", "类型", "结果", "操作者", "对象", "请求编号"]);
    expect(records.length - 1, "文件数据行 == 表体行数").toBe(rows.length);
    expect(records.slice(1).map((cells) => cells[RID_COLUMN]), "rid 列按屏上序（去列头），裸行那格如实为空").toEqual([RID_A, ""]);
    expect(captured, "失败 rid 不在文件里（这一站根本没翻车）").not.toContain(FAIL_RID);
    expect(blobCalls, "恰一个 Blob").toBe(1);
    expect(urlCalls, "恰一次 createObjectURL").toBe(1);
    expect(capturedName, "文件名带北京分钟的档名").toMatch(/^audit-.+-\d{8}-\d{4}\.csv$/);
    expect(urls().length, "导出点击字面零问（换窗那一问才是「恰一记重问」，这里没换窗）").toBe(ledgerAfterClear);
    expect(listReads(), "列表账本停在逃生那一笔").toBe(2);
  });

  it("③ 两维叠站：主操作优先说窗支；清窗后仍空、主操作【换词】成类型支；再清类型才回来 —— 尾巴上 500 整页清空且失败面没有这颗门", async () => {
    await mount(`/system?tab=events&window=custom&from=${FROM}&to=${TO}&type=${DENIED}`);
    await waitFor(() => q("aud01-empty") !== null, "空卡亮起");
    expect(listReads(), "首载恰一问").toBe(1);
    expect(paramOf(lastListRead(), "action"), "类型照旧上线").toBe(DENIED);

    // 三元优先（产品注释 :1905-1907「优先对应面板标题所述的那一维」）—— 从未被钉过。
    expect(textOf("aud01-empty-clear"), "custom 叠类型时主操作说窗支，不说类型支").toBe("清空区间，回到最近 7 天");
    expect(textOf("audD-empty-clear"), "另一维的具名出口仍在卡下原处（类型支在场但不是主操作）").toBe(
      "清掉类型筛选，回到全部类型",
    );

    const ledger1 = urls().length;
    await clickTestId("aud01-empty-clear", "主操作（窗支）");
    await waitFor(() => listReads() === 2, "清窗那一问落定");
    expect(urls().length, "恰多一问").toBe(ledger1 + 1);
    const windowCleared = lastListRead();
    expect(paramOf(windowCleared, "window"), "回到默认档：上线的仍是 from/to 对").toBeNull();
    expect(spanOf(windowCleared), "跨度七天").toBe(7 * 24 * 60 * 60 * 1000);
    expect(
      paramOf(windowCleared, "action"),
      "只清了窗那一维：action 还在上线 —— 优先级的事实在线路上的形",
    ).toBe(DENIED);
    expect(paintedRows(), "答案仍是空集（类型还压着）").toEqual([]);
    expect(q("aud01-empty"), "空卡还在").not.toBeNull();
    // 净新的核心：主操作【换词】。
    expect(textOf("aud01-empty-clear"), "窗清掉后三元落到类型支 —— 换词从未被钉过").toBe(
      "清掉类型筛选，回到全部类型",
    );
    const addrMid = address();
    expect(paramOf(addrMid, "from"), "地址里的 from= 被清窗抹掉（R123 :346 同现状）").toBeNull();
    expect(paramOf(addrMid, "type"), "type= 还在：这一步没碰它").toBe(DENIED);
    expect(paramOf(addrMid, "tab"), "tab=events 逐字").toBe("events");

    const ledger2 = urls().length;
    await clickTestId("aud01-empty-clear", "换词后的主操作（类型支）");
    await waitFor(() => paintedRows().length === 2, "全量两行回来");
    expect(urls().length, "再恰多一问：两维各花一笔，谁也不顺带重问对方的维").toBe(ledger2 + 1);
    expect(listReads(), "1 → 2 → 3，每一问都是新账").toBe(3);
    const typeCleared = lastListRead();
    expect(paramOf(typeCleared, "action"), "这一问才真正把 action 下线").toBeNull();
    expect(paintedRows()).toEqual([A, B]);
    expect(shownOf("aud01-status"), "三值一起对：状态读数").toBe(2);
    expect(shownOf("aud5-export-count"), "导出读数").toBe(2);
    expect(ridButtons(), "复制钮只数带 rid 的那行").toBe(1);
    expect(q("aud01-empty"), "空卡终于撤走").toBeNull();

    // 尾巴：全量站上翻到第 2 页翻车 —— 整页清空（「保旧行」第 11 次登记，见文件头条款 (b)），
    // 并补一颗从未断言过的缺席：失败面没有空卡那颗主操作（ErrorPanel 不吃 clear，states.tsx:707）。
    failPage2 = true;
    await clickTestId("aud01-load-more", "下一页");
    await waitFor(() => q("aud01-error") !== null, "整页失败锚亮起");
    expect(paintedRows(), "现状是整页清空，不是保旧行（R161 :339/:361、R244 条款 (b)、R213 :302、R250 :287、R240 :334、R257 :360、R259 :381）").toEqual([]);
    expect(textOf("aud01-error"), "失败面板标题逐字").toContain("审计事件没能加载出来");
    expect(textOf("aud01-error-request-id"), "失败锚带可复制的 rid").toContain(FAIL_RID);
    expect(q("aud01-empty-clear"), "失败面没有空卡那颗主操作 —— ErrorPanel 不吃 clear prop，这层缺席第一次被钉").toBeNull();
    expect(q("aud01-empty"), "失败面也没有空卡").toBeNull();
    expect(textOf("aud01-status"), "状态切到不带数字的错误句").toBe("审计事件读取失败");
    expect(shownOf("aud01-status"), "句子里没有数字").toBe(-1);
    expect(textOf("aud5-export-count"), "唯一真 0 面仍在导出读数上").toBe("将导出 0 条");
    expect(q<HTMLButtonElement>("aud01-export")!.disabled, "主导出门关死").toBe(true);
    expect(q<HTMLButtonElement>("aud5-export")!.disabled, "筛选快照门关死").toBe(true);
    expect(all("[data-testid^='sys-evt']"), "sys-evt 族到结尾仍不存在（第 43 条道）").toHaveLength(0);

    failPage2 = false;
    const panel = q("aud01-error");
    const retry = [...(panel?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find(
      (node) => node.textContent?.trim() === "重试",
    );
    if (!retry) throw new Error("error panel retry button (by text 重试) not found");
    const ledgerRetry = urls().length;
    await act(async () => {
      retry.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => q("aud01-error") === null, "面板撤走");
    expect(urls().length, "重试恰 +1（R213 :302 / R240 :387 的同口径，组合地址再立一遍）").toBe(ledgerRetry + 1);
    expect(listReads(), "1 → 2 → 3 → 4（翻车那一问自己也花钱，普查数每一问）→ 5（重试恰 +1）").toBe(5);
    expect(paintedRows(), "爬起来是重试那一页，不是并集").toEqual([C]);
    expect(shownOf("aud01-status"), "三值一起动、一起对：状态").toBe(1);
    expect(shownOf("aud5-export-count"), "导出读数跟着").toBe(1);
    expect(valueKeys(), "那一行带 rid").toEqual([C]);
    expect(ridButtons(), "复制钮一个").toBe(1);
  });
});
