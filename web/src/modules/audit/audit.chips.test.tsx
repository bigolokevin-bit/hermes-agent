// @vitest-environment jsdom
// R224 — 筛选 chip 与计数联动：chip 是地址的镜子，× 只能动它自己那一项，
// 三枚读数（屏上、表体、将导出）在移除之后必须一起重算。
//
// 已覆盖、这里不重写（只回证据）：
// - audT（AuditEventsModulePage.test.tsx「the chips for the filters that are on」七例）
//   钉住了五枚 chip 的存在与排布、词面⊂席位句、× 是真按钮、句柄只在 title；默认值整条
//   不渲染；actor 与 from-to chip 的移除账本（1 次问、地址丢对应键、游标一起丢）；
//   未识别 window/limit 移除零问；resource 移除让「行数+将导出」两值同动；
// - R214②钉住了 actor chip 移除后的三值三角（aud01-status==表体==将导出==文件行数）；
// - R214④/R205⑤钉住了空态句「这个筛选条件里没有审计事件」、双导出 disabled+题句、
//   点击零请求与 createObjectURL 计数 0；
// - R161/R208 钉住了快捷档位上线是 from/to 对、window 参从不上线；
// - R181 钉住了页级锚与空态清筛选出口。
//
// 本文件只补真正没拼过的接口：
// ① 三枚 chip（window/action/actor）同屏各显当前值，且【window 与 action】的 × 只删
//    自己那一项 —— audT 只做过 actor 与 from-to 的移除隔离，window 档位 chip 的逐字
//    地址差分从未钉过；
// ② 删 window / action chip 后三值同步重算且恰 1 次问、线路不带被删参数（R214② 只做过 actor）；
// ③ `?actor=` 空串：不产 chip、地址一字不改、线路没有 actorId —— audT 的「默认值不渲染」
//    是值等于默认，空串这条腿没人钉；
// ④ 非法值：产 chip（原样词面+未识别题句）之外，还要有可读空态、双导出 disabled、
//    页级锚仍在 —— audT 只钉了 chip/线路/移除代价，没说空场时页面长什么样。
// 工单口径与现场差三处、按现状钉：(a) 地址里的动作键是 `type=`（线路才是 `action=`），
// 工单写的 `?action=__nope__` 按现场用 `?type=__nope__` 走；(b) chip 条序 action 在
// actor 前；(c) 不在类型选项目录里的码，chip 词面就是「动作类型：<原码>…」，人话在
// 表体与 CSV（R205②持有），题句写明「服务端按 action 精确匹配」 —— 「显示当前值」按
// 现状取原码口径；(d) 每次 × 同时走 resetPagingAndFolds：页码回 1、游标栈与展开行丢
// 掉（audT it3 已钉），「其余一字不动」只对筛选参成立。actor chip 词面同样不通名：
// 现状是「操作者：已按句柄筛（服务端 actorId）」，显示名与人话都不进 chip，原句柄只进 title。

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DAY = 86_400_000;
const ACTOR = "user:2f3a4b5c6d7e8f90";
const ACTION = "task.created";
const NOPE = "__nope__";

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: { type?: string; id?: string; displayName?: string };
  resource: { type?: string; id?: string };
  requestId: string | null;
}

function rowOf(eventId: string, minute: number): Row {
  return {
    eventId,
    action: ACTION,
    occurredAt: `2026-11-19T01:${String(20 + minute).padStart(2, "0")}:00Z`,
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: "ap_1122334455667788" },
    requestId: `req-${eventId}`,
  };
}

const ROW_A = rowOf("evt_r224_alpha_00001", 0);
const ROW_B = rowOf("evt_r224_beta_000001", 1);
const ROW_C = rowOf("evt_r224_gamma_000001", 2);

// 线路带 action 就回两行，被删掉就回三行 —— 重算必须是看得见的。
function answer(): void {
  api.fetchJSON.mockImplementation(async (url: unknown) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) return { audit: ROW_A };
    if (target.includes(NOPE)) return { items: [], nextCursor: null };
    if (target.includes("action=")) return { items: [ROW_A, ROW_B], nextCursor: null };
    return { items: [ROW_A, ROW_B, ROW_C], nextCursor: null };
  });
}

const STACKED = `/audit?window=30d&type=${ACTION}&actor=${encodeURIComponent(ACTOR)}`;

function Probe(): ReactNode {
  const location = useLocation();
  return <div data-testid="probe-location" data-search={location.search} />;
}

let root: Root | null = null;

function node(testId: string): Element | null {
  return document.querySelector(`[data-testid='${testId}']`);
}

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
        <Probe />
        <AuditEventsModulePage />
      </MemoryRouter>,
    );
  });
  await waitFor(() => document.querySelector(".animate-pulse") === null, "skeleton gone");
  await waitFor(() => node("aud01-status") !== null, "readout line painted");
}

function textOf(testId: string): string {
  return node(testId)?.textContent ?? "";
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}

function spanOf(url: string): number {
  const from = Date.parse(paramOf(url, "from") ?? "");
  const to = Date.parse(paramOf(url, "to") ?? "");
  return Number.isFinite(from) && Number.isFinite(to) ? to - from : -1;
}

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

/** 地址逐字（解码、不排序 —— 比较时两边一起 sort）。 */
function pairs(): string[] {
  const search = node("probe-location")?.getAttribute("data-search") ?? "";
  return Array.from(new URLSearchParams(search).entries()).map(
    ([key, value]) => `${key}=${value}`,
  );
}

const chipKeys = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud-chip-']"))
    .map((element) => String(element.getAttribute("data-testid")))
    .filter((testId) => !testId.endsWith("-clear"))
    .map((testId) => testId.replace("aud-chip-", ""));

/** chip 的词面：× 按钮的字要剥掉，句柄不该在词面上。 */
function chipWords(key: string): string {
  return (node(`aud-chip-${key}`)?.textContent ?? "").replace("×", "").trim();
}

/** 题句在 chip 那枚 span 上（states.tsx:409），× 按钮只有 aria-label。 */
function chipTitle(key: string): string {
  return node(`aud-chip-${key}`)?.getAttribute("title") ?? "";
}

async function clickNode(target: Element | null | undefined, label: string): Promise<void> {
  expect(target, label).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

/**
 * × 掉一枚 chip，并要求「恰 1 次新增取数、总账本只 +1」。
 * 账本一律取相对基线 —— 同一条 it 里重挂载本身也各算一次问。
 */
async function removeChipOneAsk(key: string): Promise<void> {
  const asks = listReads();
  const calls = urls().length;
  await clickNode(node(`aud-chip-${key}-clear`), `aud-chip-${key}-clear`);
  await waitFor(() => listReads() === asks + 1, `${key} removal re-asked`);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  expect(urls().length, `${key} removal asked exactly once`).toBe(calls + 1);
}

function shownCount(): number {
  const digits = /(\d+)/.exec(textOf("aud01-status"));
  return digits ? Number(digits[1]) : -1;
}

function exportCountDigits(): number {
  const digits = /(\d+)/.exec(textOf("aud5-export-count"));
  return digits ? Number(digits[1]) : -1;
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  answer();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R224 ① - three chips, each removal touches only its own key", () => {
  it("shows current values in all three and removes window/action without a stray byte", async () => {
    await render(STACKED);
    // 条序按现状：window 在 action 前、action 在 actor 前（audT 已钉全排布）
    expect(chipKeys()).toEqual(["window", "action", "actor"]);
    // 现状：目录外的码，chip 词面=动作类型：原码；人话在表体与 CSV（R205②持有）
    expect(chipWords("action")).toContain(`动作类型：${ACTION}`);
    // 现状：actor chip 词面是通语「已按句柄筛」，显示名不进 chip，原句柄在 title —— 工单
    // 「各显当前值」在 actor 这一枚的形态就是 title 携值（与 audT it1 的口径一致）
    expect(chipWords("actor")).toContain("已按句柄筛");
    expect(chipWords("actor")).not.toContain(ACTOR);
    expect(chipWords("actor")).not.toContain("李思");
    expect(chipTitle("actor")).toContain(ACTOR);
    expect(chipTitle("window")).toContain("window=30d");

    // window × ：地址只丢 window 一枚，其余 chip 与地址逐字不动；档位回默认 7d 重问一次
    const beforeWindow = [...pairs()].sort();
    await removeChipOneAsk("window");
    expect([...pairs()].sort()).toEqual(beforeWindow.filter((pair) => pair !== "window=30d"));
    expect(chipKeys()).toEqual(["action", "actor"]);
    expect(paramOf(lastListRead(), "window")).toBeNull(); // 现状：档位从不上线
    expect(spanOf(lastListRead())).toBe(7 * DAY);

    // action × ：地址只丢 type 一枚；线路从此没有 action=
    await render(STACKED);
    const beforeAction = [...pairs()].sort();
    await removeChipOneAsk("action");
    expect([...pairs()].sort()).toEqual(
      beforeAction.filter((pair) => pair !== `type=${ACTION}`),
    );
    expect(chipKeys()).toEqual(["window", "actor"]);
    expect(lastListRead()).not.toContain("action=");
    // actor × 的逐字与账本由 audT it3 + R214② 持有，这里不重写
  });
});

describe("R224 ② - after a removal the three counts recompute together", () => {
  it("keeps readout, table and export equal after window or action chip goes away", async () => {
    await render(STACKED);
    expect(shownCount()).toBe(paintedRows().length);
    expect(shownCount()).toBe(exportCountDigits());
    expect(shownCount()).toBe(2);

    // 删 action：线路不再带被删参数，答案变大，三值一起到 3
    await removeChipOneAsk("action");
    expect(lastListRead()).not.toContain("action=");
    expect(shownCount()).toBe(3);
    expect(paintedRows().length).toBe(3);
    expect(exportCountDigits()).toBe(3);
    expect(textOf("aud01-status")).toContain("已显示 3 条");

    // 删 window：档位在地址上，上线的一直是 from/to —— 移除后跨度从 30d 变 7d，
    // 答案不变，三值仍相等（重算口径按现状=同一个数，而不是数字必变）
    await render(STACKED);
    expect(spanOf(lastListRead())).toBe(30 * DAY);
    await removeChipOneAsk("window");
    expect(lastListRead()).toContain(`action=${ACTION}`);
    expect(spanOf(lastListRead())).toBe(7 * DAY);
    expect(shownCount()).toBe(paintedRows().length);
    expect(shownCount()).toBe(exportCountDigits());
    expect(shownCount()).toBe(2);
  });
});

describe("R224 ③ - an empty actor is no chip and no rewrite", () => {
  it("renders no chip for actor=, keeps the address byte and never sends actorId", async () => {
    await render(`/audit?window=7d&actor=&type=${ACTION}`);
    // 只有动作那一枚：空串不算「生效筛选」，默认档位也不产 chip
    expect(chipKeys()).toEqual(["action"]);
    // 地址一字不改：空串那枚原样留在 URL 上
    const kept = [...pairs()];
    expect(kept).toContain("actor=");
    expect(kept).toContain("window=7d");
    expect(kept).toContain(`type=${ACTION}`);
    // 线路也没被空串污染：没有 actorId=，也没有第二次问
    expect(listReads()).toBe(1);
    expect(lastListRead()).not.toContain("actorId=");
    expect(shownCount()).toBe(paintedRows().length);
    expect(shownCount()).toBe(2);
  });
});

describe("R224 ④ - an unknown action still gets a readable page", () => {
  it("chips it verbatim, reads once, then says empty and holds both exports shut", async () => {
    await render(`/audit?type=${NOPE}`);
    expect(chipKeys()).toEqual(["action"]);
    expect(chipWords("action")).toContain(NOPE);
    expect(chipTitle("action")).toContain("未被识别");
    // 原样发给服务，恰 1 次，不多试
    expect(paramOf(lastListRead(), "action")).toBe(NOPE);
    expect(listReads()).toBe(1);
    // 可读空态：不是裸 0、不是错误，是一句话说这个筛选没有答案
    expect(paintedRows()).toEqual([]);
    expect(shownCount()).toBe(-1);
    expect(textOf("aud01-status")).toContain("这个筛选条件里没有审计事件");
    expect(node("aud01-empty")).not.toBeNull();
    // 双导出关着、题句逐字；页级锚仍在
    const csv = node("aud01-export") as HTMLButtonElement | null;
    const filtered = node("aud5-export") as HTMLButtonElement | null;
    expect(csv?.disabled).toBe(true);
    expect(csv?.getAttribute("title")).toBe("当前筛选没有可导出的记录");
    expect(filtered?.disabled).toBe(true);
    expect(filtered?.getAttribute("title")).toBe("当前筛选无事件可导出");
    expect(
      document.querySelector("[data-testid='agent-v2-page-audit'], #agent-v2-page-audit"),
    ).not.toBeNull();
    // 点两枚 disabled 不产生任何请求（Blob 计数腿由 R205⑤/R214④ 持有，这里只钉账本）
    const before = urls();
    await clickNode(csv, "aud01-export");
    await clickNode(filtered, "aud5-export");
    expect(urls()).toEqual(before);
    expect(listReads()).toBe(1);
  });
});
