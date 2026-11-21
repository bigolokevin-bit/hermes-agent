// @vitest-environment jsdom
// R261（自选：空卡动作行的普查 × 那颗刷新的契约 × 失败面没有动作行）—— /system 事件面卡体那颗刷新。
// 净新声明（现查于 22878598）：
// - git grep -n "aud01-empty-actions\|aud01-empty-clear" -- src = 12 处命中，全在自己上一篇
//   system.event.empty.clear.test.tsx（R260），而 R260 只引用 CLEAR 那枚、从未数过这一行的钮。全库：
//   没有测试数过状态卡动作行的钮，没人按文本定位/点名/点击过空卡自己的刷新（那颗没 testid，文本是
//   唯一的路）。工具条 aud01-refresh（产品 :1583）是另一枚，早被 AuditEventsModulePage.test.tsx
//   :4716/:4721/:4762、system.refresh.race.test.tsx:481、system.event.copy.export.cross.test.tsx:389
//   点过；卡体那颗的最近邻是页面文本清扫 AuditEventsModulePage.test.tsx:429（it「empty names the
//   reason and the next step」），其 toContain("刷新")（:433）连钮的身份都没有。
// - git grep "outlined" -- src/modules/audit src/modules/health：74 处 = 产品码 28 + 46 处全在 health
//   测试的 bs-ui mock 里被解构 void/delete，0 条测试断言。mock 恰好抹掉要钉的
//   outlined={clear ? true : undefined} 翻转（states.tsx:695）——本文件因此不 mock @nous-research/ui，
//   真实 bs-ui 上场才看得见动作行的形制（两篇 donor 同款：不 mock、不假时钟、不 mock clipboard）。
// - 产品契约（states.tsx 逐字）：EmptyPanel :665-:705 doc：«With no filter to clear, 刷新 becomes that
//   sole primary instead. The named underline exits below the card (audB/audD) keep their exact
//   anchors.» 容器 :684-:701：有 clear 先摆 clear 钮（带 testid，:689），刷新随即退 outlined 次要
//   （:695）。⇒ 翻转：有筛选维行里两颗、刷新是描边次要；没有时只剩一颗、刷新就是那颗唯一实心主
//   操作。ErrorPanel :707-:748 无 -actions、无 clear、无刷新，只有一颗「重试是卡内唯一实心主操作」
//   （:731 注释、钮 :742）。接线 AuditEventsModulePage.tsx:1908-1914：clear 三元 custom > type >
//   undefined（注释 :1905-1907「单一主操作=清筛选：优先对应面板标题所述的那一维」）。
// 已覆盖不重写（只回证据）：R260 system.event.empty.clear.test.tsx:273/:325/:377 钉的是 CLEAR 钮（三
// 元优先、换词、擦 type=、失败面该钮缺席）；本文件钉 REFRESH 钮、行里钮数、失败面 -actions 容器级
// 缺席——R260 三处都没碰。R123 system.event.empty.test.tsx:346/:437；上游 audit.empty.test.tsx:246；
// R240 system.event.export.paging.test.tsx:334/:387/:462/:496；R257
// system.event.counts.paging.test.tsx:272/:314/:360；R259 system.event.export.counts.test.tsx:315/:381；
// 上游 R243 audit.filter.paging.export.test.tsx:311；上游 R276
// audit.chip.copy.generation.test.tsx:311/:344/:377；上游 R273
// audit.detail.copy.paging.filter.test.tsx:365-400；AuditEventsModulePage.test.tsx:429/:492/:506/:522；
// system.window.isolation.test.tsx:212/:239/:278。
// 口径裁决（与产品相反处按现状钉死并登记，不伪造）：
// (a) sys-evt-* 族整族缺席——第 44 条道：现查 git grep -n -E
//     "sys-evt|sysEventCopyText|evt-copy|evt-more|evt-count" -- src = 106 处 / 26 文件（全是 health
//     测试文件，本文件自己那几处不计入），health 非测试码 0 命中。三值如实钉 aud01-status ×
//     aud5-export-count（产品 :1620 无条件「将导出 N 条」，没门没「—」，空/败面唯一真 0 面）× 屏上
//     行数；「钮数 == 表体行数」与产品相反——裸行 -absent span「该字段未返回」没有钮，诚实等式是
//     钮数 == 带 rid 行数。
// (b) 「第 2 页 500 保旧行」与产品相反——第 12 次到站：翻页走地址 cursor（goNext :1291），失败是整页
//     替换（useAuditData.ts:184-191 清行），保行追加腿唯一重试调用点在 aud01-page-failure、现界面够
//     不到。持有者：R161 audit.paging.test.tsx:339/:361 + 头 :23-25；R244 audit.copy.paging2.test.tsx
//     条款 (b) + :316；R213 audit.error.test.tsx:302；R250 :287；R240 :334；R257 :360；R259 :381；
//     R260 :377。
// (c) 「导出只含成功页」翻车当下的诚实形制是「什么都不导出」（两扇门关死、读数老实 0），字面真形只
//     在重试后成立；③ 两段分开钉。
// (d) 档位从不上线：只有 ISO from/to 对（window.ts:22/:77/:105），paramOf(read,"window") 恒 null，7d
//     恰 7×24h；地址键 type=、请求键 action=（产品 :779/:832）。失败后 reload 重问带地址上的 cursor
//     （:844 startCursor + :1376 onRetry=list.reload）——按实测钉。
// 跨模块挂载披露：文件按派工落在 modules/health；被测组件是 modules/audit/AuditEventsModulePage，
// 只挂载、只读、从未编辑（R135/R221/R225/R228/R235/R240/R257/R259/R260 同习语）。
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
// 两个开关都按引用读（处理器挂载后不换闭包，既有坑）。
let failPage2 = false;
let emptyStation = false;

const DENIED = "approval.denied";

// 迭代封顶而非墙钟；本文件永不冻结计时器（复制件 2.5s 复位是真计时器）。
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
const spanOf = (url: string): number =>
  Date.parse(paramOf(url, "to") ?? "") - Date.parse(paramOf(url, "from") ?? "");
const urls = (): string[] =>
  api.fetchJSON.mock.calls.map((call) => String(call[0])).filter((url) => url !== "undefined");
const listReads = (): number => urls().filter((url) => /^\/agent-api\/api\/audit\?/.test(url)).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";
function paintedRows(): string[] {
  return all("[data-testid^='aud01-row-']").map((node) =>
    (node.getAttribute("data-testid") ?? "").replace("aud01-row-", ""));
}
function valueKeys(): string[] {
  return all("[data-testid^='aud01-cell-'][data-testid$='-request-value']").map((node) =>
    (node.getAttribute("data-testid") ?? "").replace("aud01-cell-", "").replace("-request-value", ""));
}
function absentKeys(): string[] {
  return all("[data-testid^='aud01-cell-'][data-testid$='-request-value-absent']").map((node) =>
    (node.getAttribute("data-testid") ?? "").replace("aud01-cell-", "").replace("-request-value-absent", ""));
}
// 逐行复制钮普查：限定行格族 —— 失败锚的 RequestIdLine 共用同一无障碍名（R257 的坑）。
const ridButtons = (): number =>
  all("[data-testid^='aud01-cell-'] button[aria-label='复制请求编号']").length;
// 第一枚「N 条」，没有就 -1：错误句与空句都不带数字。
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
// 净新 helper：卡内按文本找钮并点击——刷新与重试都没有 testid，文本是唯一的路；限定在卡容器内，因为空站/败面上工具条还各有一颗 aud01-refresh 同名钮（那是另一枚，早被点过）。
async function clickCardButton(containerTestId: string, labelText: string): Promise<void> {
  const buttons = [...(q(containerTestId)?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
  const target = buttons.find((node) => (node.textContent ?? "").trim() === labelText);
  if (!target) {
    throw new Error(`missing card button 「${labelText}」 in ${containerTestId}; saw [${
      buttons.map((node) => (node.textContent ?? "").trim()).join(" | ")}]`);
  }
  await act(async () => {
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
function captureDownload(): void {
  captured = "";
  capturedName = "";
  blobCalls = 0;
  urlCalls = 0;
  const OriginalBlob = window.Blob;
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
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
  URL.createObjectURL = vi.fn(() => { urlCalls += 1; return "blob://captured"; }) as typeof URL.createObjectURL;
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

const A = "evt_refresh000001";
const B = "evt_refresh000002";
const C = "evt_refresh000003";
const RID_A = "req-refresh-0001";
const RID_C = "req-refresh-0003";
const FAIL_RID = "req-refresh-p2-500";

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
// 第 1 页两行只一行带 rid —— 钮数与表体行数刻意错开，普查才看得见它俩不等。
const PAGE1 = {
  items: [rowOf(A, "2026-11-20T05:30:00Z", RID_A), rowOf(B, "2026-11-19T05:00:00Z", null)],
  nextCursor: "cur_refresh2",
};
const PAGE2 = { items: [rowOf(C, "2026-11-18T04:00:00Z", RID_C)], nextCursor: null };
const EMPTY = { items: [], nextCursor: null };
// 假服务按请求自己的 action 与 cursor 决定答案，和真 BFF 一样由服务端筛（地址键 type=，请求键 action=）。
function answerEvents(): void {
  api.fetchJSON.mockImplementation(async (url: unknown) => {
    const text = String(url ?? "undefined");
    if (text.includes("audit-detail")) return { audit: {} };
    if (emptyStation || paramOf(text, "action") === DENIED) return EMPTY;
    if (cursorsOf(text).includes("cur_refresh2")) {
      if (failPage2) {
        throw new ApiError("audit upstream exploded", { status: 500, body: "{}", url: text, requestId: FAIL_RID });
      }
      return PAGE2;
    }
    return PAGE1;
  });
}

async function render(entry: string): Promise<void> {
  if (root) {
    await act(async () => root?.unmount());
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
  answerEvents();
  await render(entry);
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  failPage2 = false;
  emptyStation = false;
  answerEvents();
  window.history.replaceState({}, "", "/");
});
afterEach(async () => {
  restoreDownload?.();
  restoreDownload = null;
  if (root) await act(async () => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  document.body.replaceChildren();
  window.history.replaceState({}, "", "/");
});

describe("R261 - 空卡动作行的普查与那颗刷新的契约，加上失败面的整级缺席", () => {
  it("① 无筛选维的空答：动作行只有一颗钮，那颗就是唯一主操作（刷新）——aud01-empty-clear 整枚不在场", async () => {
    emptyStation = true;
    await mount("/system?tab=events");
    await waitFor(() => q("aud01-empty") !== null, "空卡亮起");
    expect(listReads(), "首载恰一问").toBe(1);
    const read = lastListRead();
    expect(paramOf(read, "window"), "档位从不上线，上线的是 from/to 对").toBeNull();
    expect(spanOf(read), "默认档跨度恰七天").toBe(7 * 24 * 60 * 60 * 1000);
    expect(cursorsOf(read), "首问不带 cursor").toEqual([]);
    expect(paramOf(read, "action"), "无筛选维：action 不上线").toBeNull();
    expect(q("aud01-empty"), "空卡在屏").not.toBeNull();
    const row = q("aud01-empty-actions");
    expect(row, "动作容器在屏（states.tsx:686）").not.toBeNull();
    const rowButtons = row!.querySelectorAll("button");
    expect(rowButtons.length, "无 clear 维 → 行里只剩一颗钮；对照②：有筛选维时同一容器两颗 —— EmptyPanel 三元之形").toBe(1);
    expect((rowButtons[0]?.textContent ?? "").trim(), "那颗唯一钮就是刷新，没有 testid，按文本认").toBe("刷新");
    expect(q("aud01-empty-clear"), "三元 undefined 支：clear 钮整枚不在场（:688-:692 不渲染）").toBeNull();
    expect(paintedRows(), "空集没有行").toEqual([]);
    expect(textOf("aud01-status"), "空态状态行是句子").toBe("这个筛选条件里没有审计事件");
    expect(shownOf("aud01-status"), "句子里没有数字，不冒充「0 条」").toBe(-1);
    expect(textOf("aud5-export-count"), "唯一真 0 面在导出读数（产品 :1620 无条件）").toBe("将导出 0 条");
    expect(all("[data-testid^='sys-evt']").length, "sys-evt 族不存在（第 44 条道：106 处 / 26 文件 / health 产品码 0）").toBe(0);
    expect(all("[data-testid^='aud01-cell-']").length, "空集里没有行可挂逐行控件").toBe(0);
    const mainDoor = q<HTMLButtonElement>("aud01-export");
    const snapDoor = q<HTMLButtonElement>("aud5-export");
    expect(mainDoor!.disabled, "主导出门关死").toBe(true);
    expect(snapDoor!.disabled, "筛选快照门关死").toBe(true);
    expect(mainDoor!.getAttribute("title"), "主门自己的原因句（auditGates.ts:102）").toBe("当前筛选没有可导出的记录");
    expect(snapDoor!.getAttribute("title"), "筛选快照用另一句（auditGates.ts:107），两锁不共用文案").toBe("当前筛选无事件可导出");
  });

  it("② 那颗刷新钮的契约：再问一次同一个问题，什么都不擦 —— 与清空出口相反（R260 钉的是擦 type=），地址逐字、action 仍在线路、门仍关死、强点分文不花", async () => {
    await mount(`/system?tab=events&window=7d&type=${DENIED}`);
    await waitFor(() => q("aud01-empty") !== null, "空卡亮起");
    const row = q("aud01-empty-actions");
    expect(row!.querySelectorAll("button").length, "有筛选维 → 同一容器两颗钮：clear 实心、刷新退 outlined —— 与①那颗的翻转").toBe(2);
    expect(textOf("aud01-empty-clear"), "那颗主操作的语义已由 R260 钉死，这里只数形制").toBe("清掉类型筛选，回到全部类型");
    const addressAtEmpty = address();
    const ledger = urls().length;
    const readsAtEmpty = listReads();
    await clickCardButton("aud01-empty-actions", "刷新");
    await waitFor(() => listReads() === readsAtEmpty + 1 && q("aud01-empty") !== null, "刷新那一问落定、空卡回屏");
    expect(urls().length, "恰多一问（每摘一维恰一问是 chip/clear 的账，刷新是同一问题的重问）").toBe(ledger + 1);
    expect(listReads(), "列表账本 +1").toBe(readsAtEmpty + 1);
    const read = lastListRead();
    expect(paramOf(read, "action"), "action 仍在线路：刷新不摘任何维").toBe(DENIED);
    expect(paramOf(read, "window"), "档位仍不上线").toBeNull();
    expect(spanOf(read), "还是七天那一问，一字没改").toBe(7 * 24 * 60 * 60 * 1000);
    expect(cursorsOf(read), "不借机带 cursor").toEqual([]);
    expect(address(), "type= 活着——这与卡下清空出口相反（R260 只擦 type=），刷新不擦任何维度").toBe(addressAtEmpty);
    expect(q("aud01-empty"), "答案仍是空集，卡还在").not.toBeNull();
    expect(textOf("aud01-status"), "状态行仍是那句").toBe("这个筛选条件里没有审计事件");
    expect(textOf("aud5-export-count"), "唯一真 0 面仍在").toBe("将导出 0 条");
    const mainDoor = q<HTMLButtonElement>("aud01-export");
    const snapDoor = q<HTMLButtonElement>("aud5-export");
    expect(mainDoor!.disabled, "主导出门仍关死").toBe(true);
    expect(snapDoor!.disabled, "筛选快照门仍关死").toBe(true);
    expect(mainDoor!.getAttribute("title"), "原因句一字未动").toBe("当前筛选没有可导出的记录");
    expect(snapDoor!.getAttribute("title"), "两句原因仍各自独立").toBe("当前筛选无事件可导出");
    captureDownload();
    const baseAfterRefresh = urls().length;
    await act(async () => { mainDoor!.click(); snapDoor!.click(); });
    expect(urlCalls, "关死的门不建 URL").toBe(0);
    expect(blobCalls, "关死的门不建 Blob").toBe(0);
    expect(captured, "没有文件内容").toBe("");
    expect(capturedName, "没有文件名").toBe("");
    expect(urls().length, "强点两扇关死的门分文不花（零费基准重捕获在刷新落定之后）").toBe(baseAfterRefresh);
    expect(listReads(), "列表账本停在刷新那一笔").toBe(readsAtEmpty + 1);
    expect(all("[data-testid^='sys-evt']").length, "sys-evt 族到结尾仍不存在（第 44 条道）").toBe(0);
  });

  it("③ 500 面的动作行根本不存在：没有 `-actions`、没有刷新、没有空卡那颗主操作；只有一颗按文本找到的重试 —— 爬起来恰 +1 后导出只含成功页且三值同源", async () => {
    await mount("/system?tab=events");
    await waitFor(() => paintedRows().length === 2, "第 1 页两行上屏");
    expect(paintedRows(), "首载第 1 页").toEqual([A, B]);
    expect(valueKeys(), "只有 A 带 rid").toEqual([A]);
    expect(absentKeys(), "B 是裸行").toEqual([B]);
    expect(ridButtons(), "派工的「钮数 == 表体行数」与产品相反：裸行只给 -absent 说明节点，不给死按钮").toBe(1);
    expect(shownOf("aud01-status"), "状态读数 2").toBe(2);
    expect(shownOf("aud5-export-count"), "导出读数 2").toBe(2);
    expect(listReads(), "首载恰一问").toBe(1);
    failPage2 = true;
    await clickTestId("aud01-load-more", "下一页");
    await waitFor(() => q("aud01-error") !== null, "整页失败面板");
    expect(paintedRows(), "派工的「保旧行」与产品相反（第 12 次到站）：走 aud01-load-more 的失败是整页替换，失败的这一页什么都不留；真正保行的追加腿唯一调用点在 aud01-page-failure 里，现界面够不到（R161 audit.paging.test.tsx:339/:361 + 头 :23-25；R244 audit.copy.paging2.test.tsx 条款 (b) + :316；R213 audit.error.test.tsx:302；R250 :287；R240 :334；R257 :360；R259 :381；R260 :377）").toEqual([]);
    expect(textOf("aud01-error"), "失败面板标题逐字").toContain("审计事件没能加载出来");
    expect(textOf("aud01-error-sentence"), "失败句子非空").not.toBe("");
    expect(textOf("aud01-error-request-id"), "失败锚带可复制 rid").toContain(FAIL_RID);
    expect(q("aud01-empty"), "失败面没有空卡").toBeNull();
    expect(q("aud01-empty-actions"), "-actions 容器是 EmptyPanel 专属（states.tsx:686），失败面连容器都不存在——R260 只钉过那颗 clear 钮的缺席").toBeNull();
    expect(textOf("aud01-status"), "状态切到错误句").toBe("审计事件读取失败");
    expect(shownOf("aud01-status"), "错误句没有数字可数").toBe(-1);
    expect(/\d/.test(textOf("aud01-status")), "数字普查：错误句一字数字都没有").toBe(false);
    expect(textOf("aud5-export-count"), "唯一真 0 面仍在导出读数上").toBe("将导出 0 条");
    const mainDoor = q<HTMLButtonElement>("aud01-export");
    const snapDoor = q<HTMLButtonElement>("aud5-export");
    expect(mainDoor!.disabled, "主导出门关死").toBe(true);
    expect(snapDoor!.disabled, "筛选快照门关死").toBe(true);
    expect(mainDoor!.getAttribute("title"), "两句原因各自独立").toBe("当前筛选没有可导出的记录");
    expect(snapDoor!.getAttribute("title"), "筛选快照用自己的句").toBe("当前筛选无事件可导出");
    const ledgerFail = urls().length;
    const readsFail = listReads();
    expect(readsFail, "坏掉的那一问自己也花钱：账本到 2（首问 + 坏问，普查数每一问）").toBe(2);
    captureDownload();
    await act(async () => { mainDoor!.click(); snapDoor!.click(); });
    expect(urlCalls, "失败面强点不建 URL").toBe(0);
    expect(blobCalls, "失败面强点不建 Blob").toBe(0);
    expect(captured, "没有内容").toBe("");
    expect(capturedName, "没有文件名").toBe("");
    expect(urls().length, "「导出只含成功页」在翻车当下的诚实形制是「什么都不导出」（与派工字面相反，登记口径 (c)）").toBe(ledgerFail);
    restoreDownload?.();
    restoreDownload = null;
    failPage2 = false;
    const beforeRetry = urls().length;
    await clickCardButton("aud01-error", "重试");
    await waitFor(() => q("aud01-error") === null && paintedRows().length === 1, "面板退场、重试页上屏");
    expect(urls().length, "重试恰 +1").toBe(beforeRetry + 1);
    expect(listReads(), "实测钉死 3 = 首问 + 坏掉的那一问 + 重试：每一问都数").toBe(3);
    const retryRead = lastListRead();
    expect(cursorsOf(retryRead), "重试重问的是失败那一问：cursor 还在线路上（地址带它，:844/:1376）").toEqual(["cur_refresh2"]);
    expect(paramOf(retryRead, "action"), "这站没挂类型筛选：action 不在线路").toBeNull();
    expect(paintedRows(), "爬起来是重试那一页 [C]，不是并集 [A,B,C]").toEqual([C]);
    expect(new Set(paintedRows()).size, "屏上无重复行").toBe(paintedRows().length);
    expect(valueKeys(), "那一行带 rid").toEqual([C]);
    expect(absentKeys(), "这一页没有裸行").toEqual([]);
    expect(ridButtons(), "复制钮一枚").toBe(1);
    expect(shownOf("aud01-status"), "三值同源：状态读数").toBe(1);
    expect(shownOf("aud5-export-count"), "三值同源：导出读数").toBe(1);
    expect(textOf("aud5-export-count"), "读数逐字").toBe("将导出 1 条");
    expect(textOf("aud01-error-request-id"), "失败锚随面板退休，一个字都不剩").toBe("");
    captureDownload();
    const baseAfterRetry = urls().length;
    await clickTestId("aud01-export", "CSV 门");
    await waitFor(() => captured !== "", "文件交付");
    const records = csvRecords(captured);
    expect(records[0], "列头六词逐字").toEqual(["时间", "类型", "结果", "操作者", "对象", "请求编号"]);
    expect(records.length - 1, "「导出只含成功页」的字面真形（重试之后才成立）：文件数据行 == 屏上行数").toBe(paintedRows().length);
    expect(records.slice(1).map((cells) => cells[RID_COLUMN]), "rid 列去列头后只有 C 的 rid").toEqual([RID_C]);
    for (const banned of [FAIL_RID, "审计事件没能加载出来", "该字段未返回", A, B, RID_A]) {
      expect(captured, `${banned} 不进文件`).not.toContain(banned);
    }
    expect(blobCalls, "恰一个 Blob").toBe(1);
    expect(urlCalls, "恰一次 createObjectURL").toBe(1);
    expect(capturedName, "文件名带北京分钟的档名").toMatch(/^audit-.+-\d{8}-\d{4}\.csv$/);
    expect(urls().length, "导出点击字面零问（零费基准重捕获在重试之后）").toBe(baseAfterRetry);
    expect(listReads(), "列表账本仍停在重试那一笔").toBe(3);
    expect(all("[data-testid^='sys-evt']").length, "sys-evt 族到结尾仍不存在（第 44 条道）").toBe(0);
  });
});
