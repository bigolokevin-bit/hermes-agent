// @vitest-environment jsdom
// R246 — /system 的「数据保留与清理」面 × 时间窗 × events 往返的组合护栏（health 道首笔）。
//
// 产品真相（全部只读实测，未改任何产品码）：
// - retention 是真 system tab，但它是 App 级短路而不是 ConsoleModulePage 的 live 槽：
//   `App.tsx:1610-1640` 的 SystemAwareTabs 读 useSearchParams，`tab === "retention"` 时
//   整页换成 `<RetentionConsolePage />`（:109 lazy 导入本文件所测的同一个组件），
//   否则才渲染 ConsoleModulePage（四个 live 槽 health/defaults/version/events）。
//   ⇒ retention 亮着时没有 tab 条、没有事件面节点，二者互斥（本文件如实钉这两侧的缺席）。
// - retention 的别名 tab 在壳层折成 events：`shell/routes.ts:257`（compat-tab, visible:false,
//   to '#/system?tab=events'）与 :348 TAB_ALIAS `system: { retention: 'events' }`；
//   既有钉点：`shell/bridge.test.ts:55`、`shell/console.test.tsx:121-122`（引用不重写）。
//   visible:false ⇒ 屏上没有「保留策略」按钮可点，往返只能走深链/导航（本文件的 ② 照此实测）。
// - retention 面不读 URL 的时间窗：`RetentionModulePage.tsx:261-262` 只吃 state 与 rid
//   两枚预览参数；整个组件对 `?window=`（合法或非法）全盲 —— 派工①「请求带 window」
//   与产品相反，是「?window= 只被 audit/duty/runs 读」家族的又一站（retention 侧新测：
//   `git grep 'get("window")|searchParams'` 在 RetentionModulePage.tsx 与 retention.ts 均 0 命中）。
// - 它唯一的一次取数是 `:297` 的 `fetchJSON(RETENTION_PATH, undefined, { allowUnauthorized: true })`
//   —— 常量路径 `/agent-api/api/retention`（`retention.ts:26`），不带 query、不带 cursor。
// - 本部署后端对该路径 404 `{"code":"console.unknown_route"}`（`retention.ts:5-12` 记账的
//   「四区全部未接入」态）⇒ probeOf 判 unwired：四区卡片全列「未接入」、汇总句
//   「4 个区块都未接入：这个环境没有可读的保留策略源。」、无读取时刻锚（asOf 为 null）。
//
// 已覆盖、这里只回证据不重写（文件:行）：
// - `audit/RetentionModulePage.test.tsx`（aud 道）：:78 四区列未接入且缺值不记 0、
//   :104 两个写动作 disabled 占位、:126 缺口只进 title 与技术折叠、:177 403/404 同体可复制 id、
//   :199 失败句+rid+重试再问、:223 骨架、:243/:250/:258 强制预览三态、:270 阈值提示。
// - `audit/retention.test.ts`（纯函数道）：:31/:48/:83/:92 防御性读取与缺值不记 0、
//   :102 404 unknown_route 是未接入不是拒绝、:112/:118 拒绝与失败分家、:137/:146/:158 数字诚实、
//   :168/:182 未接入清单与写动作声明。
// - 组合地址上的非法窗护栏由 R123 `health/system.event.empty.test.tsx:437` 持有（events 侧：
//   地址逐字不改、折回默认档提问、两扇门关死、点击零请求零 Blob）—— ③ 补的是 retention 侧，
//   那里从未被任何测试碰过（health 道此前零 retention 用例）。
// - tab 往返取数算术归 `health/system.window.isolation.test.tsx:212/:278` 与 R241
//   `health/system.event.copy.export.cross.test.tsx` 例③；② 只钉 retention 方向的另一半：
//   它首读之后分文不花、离开它也不惊动 events。
//
// 派工口径与现状不一致处，按现状钉死并登记：
// (a) ①「请求带 window 无 cursor」——现状是请求连 query 串都没有；window 前提不成立，
//     钉「唯一一问 = 常量路径，无 window、无 cursor」，绝不编造带参请求。
// (b) ①「sys-evt-count==表体」——该锚不存在（第 35 站：70 处命中分布在 18 个 health 测试
//     文件里，health 产品码 0 命中），只在 DOM 上断言整族缺席；计数面改用产品真有的
//     `ret4-summary` 与四区卡数对撞。
// (c) ②「零新增取数、行集与页码复原」——与产品相反：events 面无模块缓存，回程要花它自己
//     的整批（恰 +1 问），而且重来的是第 1 页 —— 游标不幸存卸载，「页码复原」的诚实形态是
//     「页码回到 1、行集等于第一页集」。retention 侧的守恒另钉：它首读之后（含离开时）零问。
//
// 本文件不新增任何产品 testid；probe-location 与 nav 捕获是私有证人节点。
// App.tsx 与 shell 目录只读不碰：② 的挂载镜像 SystemAwareTabs 的短路逻辑，用测试本地
// 组件复刻（tab=retention → RetentionModulePage；否则 ConsoleModulePage 四槽），非产品码。

import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate, useSearchParams } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import { ApiError } from "@/lib/api-error";
import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import RetentionModulePage from "@/modules/audit/RetentionModulePage";
import { RETENTION_PATH } from "@/modules/audit/retention";
import { ConsoleModulePage } from "@/shell/console";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let navTo: ((to: string) => void) | null = null;

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
function NavProbe() {
  const navigate = useNavigate();
  // react-hooks/globals：渲染期不得改写组件外变量——捕获挪进 effect。
  useEffect(() => {
    navTo = navigate;
  }, [navigate]);
  return null;
}
/** 复刻 App.tsx:1610-1640 的短路：retention 整页替换，其余交给 ConsoleModulePage 四槽。 */
function SystemLike() {
  const [sp] = useSearchParams();
  if (sp.get("tab") === "retention") return <RetentionModulePage />;
  return (
    <ConsoleModulePage
      module="system"
      live={{
        health: <div data-testid="live-health" />,
        defaults: <div data-testid="live-defaults" />,
        version: <div data-testid="live-version" />,
        events: <AuditEventsModulePage />,
      }}
    />
  );
}

const q = (testId: string): HTMLElement | null =>
  document.querySelector(`[data-testid='${testId}']`);
const address = (): string => q("probe-location")?.textContent ?? "";
const textOf = (testId: string): string => q(testId)?.textContent?.trim() ?? "";
const pageText = (): string => q("ret4-page")?.textContent ?? "";
const countAll = (selector: string): number => document.querySelectorAll(selector).length;
const urls = (): string[] =>
  api.fetchJSON.mock.calls.map((call) => String(call[0])).filter((url) => url !== "undefined");
const retentionAsks = (): number => urls().filter((url) => url === RETENTION_PATH).length;
const auditAsks = (): number =>
  urls().filter((url) => /^\/agent-api\/api\/audit\?/.test(url)).length;
const lastAuditRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";
const cursorsOf = (url: string): string[] =>
  [...new URL(url, "http://console.test").searchParams.getAll("cursor")];
function paintedRows(): string[] {
  return Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((node) =>
    (node.getAttribute("data-testid") ?? "").replace("aud01-row-", ""),
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
async function goto(to: string, label: string): Promise<void> {
  if (!navTo) throw new Error(`navigator not captured for ${label}`);
  await act(async () => {
    navTo?.(to);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const FRESH = "evt_fresh00000001";
const MID = "evt_mid0000000002";
const TAIL = "evt_tail000000003";

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
const W30_PAGE1 = {
  items: [
    rowOf(FRESH, "2026-11-20T05:30:00Z", "req-fresh-0001"),
    rowOf(MID, "2026-11-19T05:00:00Z", "req-mid-0002"),
  ],
  nextCursor: "cur_rows2",
};
const W30_PAGE2 = {
  items: [
    rowOf(MID, "2026-11-19T05:00:00Z", "req-mid-0002"),
    rowOf(TAIL, "2026-11-18T04:00:00Z", null),
  ],
  nextCursor: null,
};

/** 本部署的真实后端形态：retention 恒 404 console.unknown_route（未接入）。 */
function unknownRoute(): ApiError {
  return new ApiError("missing route", {
    status: 404,
    body: JSON.stringify({ code: "console.unknown_route", message: "unknown console API route" }),
    url: RETENTION_PATH,
    requestId: "rid-unwired",
  });
}

function installHandler(): void {
  api.fetchJSON.mockImplementation(async (url: unknown) => {
    const text = String(url ?? "undefined");
    if (text === RETENTION_PATH) throw unknownRoute();
    if (text.includes("audit-detail")) return { audit: {} };
    if (cursorsOf(text).includes("cur_rows2")) return W30_PAGE2;
    return W30_PAGE1;
  });
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
        <NavProbe />
        <SystemLike />
      </MemoryRouter>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  installHandler();
  navTo = null;
  window.history.replaceState({}, "", "/");
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  navTo = null;
  document.body.replaceChildren();
  window.history.replaceState({}, "", "/");
});

describe("R246 - the retention pane beside the events pane on one /system address", () => {
  it("① 深链 ?tab=retention&window=7d：整页换成保留面，唯一一问不带任何参数，地址一字不改", async () => {
    await render("/system?tab=retention&window=7d");
    await waitFor(() => q("ret4-page") !== null, "retention face mounted");
    await waitFor(() => retentionAsks() === 1, "the one retention ask landed");
    expect(q("ret4-page")?.getAttribute("data-page")).toBe("retention");
    // 派工①的 window 前提与产品相反：唯一一问就是常量路径，没有 query、没有 cursor。
    expect(urls(), "请求线路逐字：只有 RETENTION_PATH").toEqual([RETENTION_PATH]);
    expect(cursorsOf(urls()[0] ?? ""), "线路上没有游标").toEqual([]);
    expect(auditAsks(), "events 面根本没被问").toBe(0);
    // 页面不重写地址：window 原样躺在地址里，只是没人读它。
    expect(address()).toBe("/system?tab=retention&window=7d");
    // 计数面用产品真有的两枚对撞（sys-evt-count 不存在——第 35 站，只在 DOM 断言整族缺席）：
    expect(textOf("ret4-summary")).toBe("4 个区块都未接入：这个环境没有可读的保留策略源。");
    expect(countAll("[data-testid^='ret4-section-']"), "汇总说的 4 与屏上区块卡同数").toBe(4);
    expect(q("ret4-asof"), "未接入态没有读取时刻锚").toBeNull();
    expect(q("ret4-unwired-note"), "未接入说明卡在场").not.toBeNull();
    expect(pageText(), "缺值记未接入，不记裸 0（口径归 aud 道 :78）").not.toContain("0 条");
    expect(countAll("[data-testid^='sys-evt']"), "sys-evt 整族缺席").toBe(0);
    // retention 是整页替换：没有 tab 条、没有任何事件面节点、没有健康表。
    expect(countAll('[role="tab"]'), "retention 亮着时没有 tab 条").toBe(0);
    expect(countAll("[data-testid^='aud01-']"), "事件面节点一个都不在").toBe(0);
    expect(q("sys3-table"), "健康表不在场（互斥的 live 槽）").toBeNull();
    expect(q("ret4-tech-details"), "技术折叠锚在场").not.toBeNull();
    expect(retentionAsks(), "看过一圈仍只花过那一问").toBe(1);
  });

  it("② events↔retention 往返：retention 首读之后分文不花；回程 events 花自己一整批且从第 1 页重来", async () => {
    await render("/system?tab=events&window=30d");
    await waitFor(() => paintedRows().length === 2, "events page one painted");
    expect(paintedRows()).toEqual([FRESH, MID]);
    expect(textOf("aud2-page")).toContain("第 1 页");
    await clickTestId("aud01-load-more", "下一页");
    await waitFor(() => paintedRows()[0] === MID && paintedRows().length === 2, "page two up");
    expect(paintedRows()).toEqual([MID, TAIL]);
    expect(textOf("aud2-page")).toContain("第 2 页");
    expect(retentionAsks()).toBe(0);
    const auditBeforeLeave = auditAsks();
    // retention 的别名 tab visible:false（routes.ts:257）——没有钮可点，往返走深链导航。
    await goto("/system?tab=retention&window=30d", "deep-link into retention");
    await waitFor(() => q("ret4-page") !== null, "retention face mounted");
    await waitFor(() => retentionAsks() === 1, "one retention ask");
    expect(auditAsks(), "离开 events 方向零流量：events 没有被补问").toBe(auditBeforeLeave);
    expect(countAll("[data-testid^='aud01-']"), "事件面整片随短路消失").toBe(0);
    expect(address()).toBe("/system?tab=retention&window=30d");
    const retentionBase = retentionAsks();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(retentionAsks(), "在它身上多待一会儿，不再花任何一问").toBe(retentionBase);
    // 回程：events 无模块缓存，恰花自己的一整批（派工②「零新增取数」与产品相反）。
    await goto("/system?tab=events&window=30d", "deep-link back to events");
    await waitFor(() => paintedRows().length === 2, "events re-read page one");
    expect(auditAsks(), "回程恰 +1 问——算术的另一半归 window.isolation").toBe(
      auditBeforeLeave + 1,
    );
    expect(retentionAsks(), "离开 retention 方向零流量：它不再被问也不会被补问").toBe(retentionBase);
    // 「行集与页码复原」的诚实形态：游标不幸存卸载，回来的是第 1 页的那一套行。
    expect(paintedRows(), "行集 = 第一页集，不是第 2 页的残影").toEqual([FRESH, MID]);
    expect(textOf("aud2-page")).toContain("第 1 页");
    expect(cursorsOf(lastAuditRead()), "回程请求不带游标").toEqual([]);
    expect(textOf("aud01-status")).toContain("已显示 2 条");
    expect(textOf("aud5-export-count")).toContain("将导出 2 条");
    expect(q("ret4-page"), "retention 面随回程消失").toBeNull();
    expect(countAll("[data-testid^='sys-evt']"), "全程 sys-evt 整族缺席").toBe(0);
  });

  it("③ 非法 ?window=__nope__ 落在 retention 面：令牌不上线路、地址逐字不改、页锚在、仍是句子不是裸 0", async () => {
    await render("/system?tab=retention&window=__nope__");
    await waitFor(() => q("ret4-page") !== null, "retention face mounted");
    await waitFor(() => retentionAsks() === 1, "the one retention ask landed");
    // events 侧的非法窗由 R123 :437 钉过（折回默认档提问）；retention 侧更彻底：
    // 它根本不读 window，非法令牌既不上线路也不进任何面文。
    expect(urls(), "线路只有常量路径，__nope__ 从未出网").toEqual([RETENTION_PATH]);
    expect(address(), "地址逐字不改——没人重写它，也没有折档改写").toBe(
      "/system?tab=retention&window=__nope__",
    );
    expect(q("ret4-page"), "页级锚在").not.toBeNull();
    expect(textOf("ret4-summary")).toBe("4 个区块都未接入：这个环境没有可读的保留策略源。");
    expect(pageText(), "可读空态：句子不是裸 0").not.toContain("0 条");
    expect(pageText(), "非法令牌不进任何面文").not.toContain("__nope__");
    expect(auditAsks(), "非法窗也没惊动 events").toBe(0);
    expect(countAll("[data-testid^='sys-evt']"), "sys-evt 整族缺席").toBe(0);
    expect(countAll('[role="tab"]'), "仍然没有 tab 条").toBe(0);
  });
});
