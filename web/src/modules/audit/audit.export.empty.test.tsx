// @vitest-environment jsdom
// R228 — 导出空集与被筛选排除的区分：0 行有三张完全不同的脸 —— 「这个窗里没人」、
// 「这个人不在这个窗里」和「这两端点根本还没发过问」。它们的话术、门的状态与请求账本
// 各自不同，不能因为都是 0 行就混写成一句话。
//
// 已覆盖、这里不重写（只回证据）：
// - `audit.empty.test.tsx`（R181）钉住了自定义区间空态的面板句（「该时间段内无事件…」）、
//   两枚导出 disabled+title+点击零请求+「将导出 0 条」、清筛选腿，以及空态下行复制列整族
//   不渲、`aud-detail-copy` visible-disabled+DETAIL_COPY_DISABLED_TITLE；
// - `audit.filter.counts.test.tsx`（R214）钉住了档位叠加筛选下的三值三角与空集时的
//   读数行句子/门/零 Blob，② 里「移一枚 chip 三值重算」已由 R214②（操作者腿）持有；
// - `audit.window.bounds.test.tsx`（R203）钉住了反向区间 0 次取数+提示句+地址不动+
//   两枚导出 disabled 各带原因；`audit.chips.test.tsx`（R224）钉住了 chip 移除的账本。
//
// 本文件只补真正没拼过的 joints：
// ① 两种 0 行【逐字并存】：被筛选排除（30d+actor+action 问不到东西）与档位真空（24h 无筛选）
//   —— 现状的面板话术只有两支：custom ⇒「该时间段内无事件…」，其余一律 ⇒「按现在的筛选条件，
//   这个时间窗里没有审计事件」。主文件「empty names the reason and the next step」已钉过无筛选
//   档位的这句，本波拼的是【叠加筛选下同一句 + 无筛选档位腿的 audB 出口文案「这一档里没有记录。」
//   ——只钉过 custom 支「这一段里没有记录。」（R181 :224）—— + 无类型时 audD 出口整族缺席】。
//   工单说的「无任何事件」这句在产品源码里【并不存在】，两支实为 custom-vs-其余，按现场钉。
// ② 门从 disabled 变回 enabled 这条【转换】本身从未被钉：0 行时门带原因关闭，
//   移掉一枚 chip 出数后两枚门都开了，且导出行数==表体==读数行==「将导出 N 条」。
// ③ 反向区间时【面板与出口整族缺席】（aud01-empty、audB/audD 两枚出口都不在），读数行是
//   customInvalid 那句、零取数 —— 主体由 R203 持有，本波只把【族级缺席】这一拼接补上。
// ④ 被筛选排除的 0 行同样没有行复制列，但复制钮仍是【可见且禁用】—— 工单写「不渲染」，
//   与现状不符，按现状钉（形制归 R181⑤，本波把它搬到筛选排除语境）。

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
const ACTION = "task.created";
const STACKED = `/audit?window=30d&type=${ACTION}&actor=${encodeURIComponent(ACTOR)}&limit=25`;
const TIER_EMPTY = "/audit?window=24h&limit=25";
// 端点写反：开始晚于结束 —— 这一页不该向服务问任何东西（现状由 R203 持有主体）
const INVERTED = "/audit?window=custom&from=2026-11-19T02:00:00Z&to=2026-11-05T02:00:00Z&limit=25";

const ROW_ONE = "evt_r228_first_000001";
const ROW_TWO = "evt_r228_second_00001";

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

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

/** 读数行里的数字；空态/提示态都是句子，没有数字 —— 返回 -1 让它自己说。 */
function shownCount(): number {
  const digits = /(\d+)/.exec(textOf("aud01-status"));
  return digits ? Number(digits[1]) : -1;
}

function exportCountDigits(): number {
  const digits = /(\d+)/.exec(textOf("aud5-export-count"));
  return digits ? Number(digits[1]) : -1;
}

function cellsCount(): number {
  return document.querySelectorAll("[data-testid^='aud01-cell-']").length;
}

const chipKeys = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud-chip-']"))
    .filter((element) => !String(element.getAttribute("data-testid")).endsWith("-clear"))
    .map((element) => String(element.getAttribute("data-testid")).replace("aud-chip-", ""));

async function clickNode(target: Element | null | undefined, label: string): Promise<void> {
  expect(target, label).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

/** 相对账本：一次移除「只多问一次」，不受这一腿之前挂载问过几次影响。 */
async function removeChipOneAsk(key: string): Promise<void> {
  const asks = listReads();
  const calls = urls().length;
  await clickNode(node(`aud-chip-${key}-clear`), `aud-chip-${key}-clear`);
  await waitFor(() => listReads() === asks + 1, `the ${key} removal re-asked once`);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  expect(urls().length, "the removal costs exactly one ask, nothing else").toBe(calls + 1);
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

function rowOf(eventId: string, index: number): Row {
  return {
    eventId,
    action: ACTION,
    occurredAt: `2026-11-19T01:2${index}:00Z`,
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: "ap_1122334455667788" },
    requestId: `req-${eventId}`,
  };
}

const TWO: Row[] = [rowOf(ROW_ONE, 0), rowOf(ROW_TWO, 1)];

interface Mode {
  /** 服务端如何回答叠加筛选：被筛选排除时回 0 行。 */
  excludeStacked: boolean;
  /** 无筛选的档位真空：服务对纯档位一问也回 0 行。 */
  emptyPlain: boolean;
}

const mode: Mode = { excludeStacked: true, emptyPlain: true };

function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      return { audit: TWO[0] };
    }
    // 线路参是动作原码 + actorId（R224 口径）：这一问没人答得上 ⇒ 0 行
    const hasAction = target.includes("action=");
    const hasActor = target.includes("actorId=");
    if (hasAction && hasActor && mode.excludeStacked) {
      return { items: [], nextCursor: null };
    }
    // 纯档位一问（无动作无操作者）：档位真空也回 0 行
    if (!hasAction && !hasActor && mode.emptyPlain) {
      return { items: [], nextCursor: null };
    }
    return { items: TWO, nextCursor: null };
  });
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  mode.excludeStacked = true;
  mode.emptyPlain = true;
  answer();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R228 - two kinds of zero, in two verbatim sentences", () => {
  it("tells an empty window apart from a filtered-away answer", async () => {
    await render(STACKED);
    // 被筛选排除：0 行不是「没有数据」，是「现在的条件问不到东西」
    expect(listReads()).toBe(1);
    expect(paintedRows()).toEqual([]);
    expect(textOf("aud01-empty")).toContain("按现在的筛选条件，这个时间窗里没有审计事件");
    expect(textOf("aud01-empty")).not.toMatch(/0\s*条/);
    // 读数行没有第二个 0：它是句子，不是计数
    expect(shownCount()).toBe(-1);
    expect(textOf("aud01-status")).toContain("这个筛选条件里没有审计事件");
    // 两枚门各自带着原因关着，点一下既不问也不下载
    const csv = node("aud01-export") as HTMLButtonElement | null;
    const filtered = node("aud5-export") as HTMLButtonElement | null;
    expect(csv?.disabled).toBe(true);
    expect(csv?.getAttribute("title")).toBe("当前筛选没有可导出的记录");
    expect(filtered?.disabled).toBe(true);
    expect(filtered?.getAttribute("title")).toBe("当前筛选无事件可导出");
    const before = urls();
    await clickNode(csv, "aud01-export");
    await clickNode(filtered, "aud5-export");
    expect(urls()).toEqual(before);
    expect(listReads()).toBe(1);

    // 档位真空（无筛选）：面板仍说「按现在的筛选条件…」（两分支梯子的其余支，主文件已钉这句）；
    // 本腿净新增 = audB 出口的【档位支】文案与 audD 出口整族缺席。
    await render(TIER_EMPTY);
    expect(textOf("aud01-empty")).toContain("按现在的筛选条件，这个时间窗里没有审计事件");
    expect(textOf("audB-empty-exit")).toContain("这一档里没有记录。");
    expect(node("audD-empty-exit")).toBeNull();
    expect(node("audD-empty-clear")).toBeNull();
  });
});

describe("R228 - the door reopens when the answer returns", () => {
  it("flips both exports from disabled to live and reconciles all four counts", async () => {
    await render(STACKED);
    const csv = node("aud01-export") as HTMLButtonElement | null;
    const filtered = node("aud5-export") as HTMLButtonElement | null;
    expect(csv?.disabled).toBe(true);
    expect(filtered?.disabled).toBe(true);
    // 移除动作 chip —— 这一问只剩时间窗与操作者，服务端就有答案了
    mode.excludeStacked = false;
    await removeChipOneAsk("action");
    expect(paintedRows()).toEqual([ROW_ONE, ROW_TWO]);
    // 净新增的腿：门从关到开这条【转换】此前从未钉过（R214② 只重算过三值）
    expect((node("aud01-export") as HTMLButtonElement).disabled).toBe(false);
    expect((node("aud5-export") as HTMLButtonElement).disabled).toBe(false);
    // 三值三角：读数行 == 表体 == 「将导出 N 条」（CSV 行数==表体归 R205①/R141 持有）
    expect(shownCount()).toBe(2);
    expect(exportCountDigits()).toBe(paintedRows().length);
    expect(textOf("aud01-status")).toContain("已显示 2 条");
    // 面板族换脸：空态句整族消失
    expect(node("aud01-empty")).toBeNull();
    expect(chipKeys()).not.toContain("action");
  });
});

describe("R228 - an inverted range never becomes an empty answer", () => {
  it("asks nothing, keeps the address byte for byte, and renders no panel family at all", async () => {
    await render(INVERTED);
    // 现状：反向区间是【提示句】，不是空态面板 —— 一次问都没问过（主体由 R203 持有）
    expect(listReads()).toBe(0);
    expect(node("aud01-custom-hint")).not.toBeNull();
    expect(textOf("aud01-custom-hint")).toContain("自定义时间窗还不完整");
    expect(node("aud01-empty")).toBeNull();
    expect(node("aud01-status")).not.toBeNull();
    expect(textOf("aud01-status")).toContain("自定义时间窗还不完整：");
    expect(shownCount()).toBe(-1);
    // 本波新拼接：面板与两枚出口【整族缺席】—— 反向区间不是「一个空答案」，
    // 是「根本没发问」，所以空态族（面板 + 两枚清筛选出口）一个都不该存在。
    expect(node("audB-empty-exit")).toBeNull();
    expect(node("audD-empty-exit")).toBeNull();
    expect(node("audB-empty-clear")).toBeNull();
    expect(node("audD-empty-clear")).toBeNull();
    // 两枚门带着 customInvalid 专属原因关着
    const csv = node("aud01-export") as HTMLButtonElement | null;
    expect(csv?.disabled).toBe(true);
    expect(csv?.getAttribute("title")).toBe("自定义时间窗不完整，没有可导出的记录");
  });
});

describe("R228 - a filtered-away zero has no row to copy", () => {
  it("renders no row copy cells but keeps the copy button visible and disabled", async () => {
    await render(STACKED);
    // 0 行 ⇒ 行复制列整族不渲 —— 面板里也不该有任何「undefined」
    expect(paintedRows()).toEqual([]);
    expect(cellsCount()).toBe(0);
    // 工单写「aud-detail-copy 不渲染」；现状是【可见且禁用】并带原因 —— 按现状钉
    const copy = node("aud-detail-copy") as HTMLButtonElement | null;
    expect(copy).not.toBeNull();
    expect(copy?.disabled).toBe(true);
    expect(copy?.getAttribute("title")).toBe(DETAIL_COPY_DISABLED_TITLE);
    expect(document.body.textContent).not.toContain("undefined");
  });
});
