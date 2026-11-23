// @vitest-environment jsdom
/**
 * R238（审批筛选 chip 与游标页归零护栏，纯测试）——只加测试，零产品改动。
 *
 * 查重结论（已覆盖只回证据，本文件只写缺口）：
 *  - 未翻页态移除 status chip=恰 1 次新取数且新请求无 status=/cursor=，本地维移除零请求
 *    → approvals.filterurl.test.tsx L202「removing the status chip refetches exactly once
 *       without status/cursor; local chips refetch nothing」+
 *       ApprovalsHistoryModulePage.test.tsx R91「renders human labels; removing status
 *       refetches once, removing sort stays local」=回证据。
 *  - 翻页后切 status 快捷钮重置游标 → ApprovalsHistoryModulePage.test.tsx L1848
 *    「a status switch resets the list and never carries the stale cursor」=回证据。
 *  - 重置钮七参清空/URL 只剩 tab/回 disabled → R90 describe「apv-reset-filters」
 *    两 it=回证据（本文件③只补「翻页态点重置」站+导出读数回全量）。
 *  - chip 集合==生效参（纯函数面）→ R98 L158「chips mirror the URL dimensions」=回证据。
 *
 * 本文件缺口三站：
 *  ① 第 2 页已加载（服务端游标已消费）后移除 status chip：新请求必不含 cursor=、
 *     行集换代无旧页残留、apv5-count 与表体同步（游标只在请求腿不在地址，R79 现场）；
 *  ② 连续两维（status 服务端维→risk 本地维）：status 步恰 +1、risk 步零请求，
 *     chip 集合与 URL 生效参集合一致（恰 status+risk 两枚，无幽灵）；
 *  ③ 翻页态+多参深链下点「重置筛选」：恰 1 次取数、URL 只剩 tab、
 *     导出读数与行集回全量。
 *
 * 等待策略教训（本文件首跑 3 FAIL 根因）：loadMore/chip 移除不显 .animate-pulse，
 * 只轮询骨架的 waitFor 会立即放行——全部改为条件轮询 until()。
 */
import { useEffect, type ReactNode } from "react";
import { act, createElement } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { createRoot, type Root } from "react-dom/client";

import { describe, it, expect, vi, afterEach } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));
// 与 approvals.parity.test.tsx 同形：只拆 children，其余（含 onClick/disabled/data-*）
// 原样透传到原生元素，避免 eslint no-unused-vars 拦解构丢弃项。
vi.mock("@nous-research/ui", () => ({
  Badge: (props: { children?: ReactNode; [k: string]: unknown }) => {
    const { children, ...rest } = props;
    return createElement("span", rest as Record<string, unknown>, children);
  },
  Button: (props: { children?: ReactNode; [k: string]: unknown }) => {
    const { children, ...rest } = props;
    return createElement("button", { type: "button", ...(rest as object) }, children);
  },
  Card: (props: { children?: ReactNode; [k: string]: unknown }) => {
    const { children, ...rest } = props;
    return createElement("div", rest as Record<string, unknown>, children);
  },
  CardContent: (props: { children?: ReactNode; [k: string]: unknown }) => {
    const { children, ...rest } = props;
    return createElement("div", rest as Record<string, unknown>, children);
  },
}));

import ApprovalsHistoryModulePage from "@/modules/approvals/ApprovalsHistoryModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let node: HTMLDivElement | null = null;

/** 条件轮询：3s 预算，5ms/轮；条件里禁 expect/toEqual（waitFor 条件非断言上下文教训）。 */
async function until(what: string, cond: () => boolean): Promise<void> {
  for (let i = 0; i < 600; i += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  }
  throw new Error(`until: ${what} never became true`);
}

function mount(handler: (url: string) => Promise<unknown>, entry: string): void {
  api.fetchJSON.mockImplementation(handler);
  if (node) node.remove();
  node = document.createElement("div");
  document.body.appendChild(node);
  root?.unmount();
  root = createRoot(node);
  function Probe() {
    const loc = useLocation();
    useEffect(() => {
      document.body.setAttribute("data-r238-search", loc.search);
    }, [loc.search]);
    return null;
  }
  act(() => {
    root!.render(
      createElement(
        MemoryRouter,
        { initialEntries: [entry] },
        createElement(Probe),
        createElement(ApprovalsHistoryModulePage),
      ),
    );
  });
  // 车道 B（审批筛选折叠）：本文件断言写在筛选墙全展开之上，挂载后统一点开新折叠开关。
  const historyToggle = document.querySelector(
    "[data-testid='apv-h-filter-toggle']",
  ) as HTMLButtonElement | null;
  if (historyToggle && historyToggle.getAttribute("aria-expanded") !== "true") {
    act(() => {
      historyToggle.click();
    });
  }
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  node?.remove();
  node = null;
  document.body.removeAttribute("data-r238-search");
  api.fetchJSON.mockReset();
});

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const lastSearch = (): string => document.body.getAttribute("data-r238-search") ?? "";
/** 表体行 id（前缀选择器滤 apr5-row-details-* 撞前缀坑，R71 教训）。 */
const rowIds = (): string[] =>
  [...document.querySelectorAll('[data-testid^="apr5-row-ap"]')]
    .map((el) => el.getAttribute("data-testid") ?? "")
    .filter((id) => !id.includes("-details-"))
    .map((id) => id.replace(/^apr5-row-/, ""));
const listCalls = (): string[] =>
  api.fetchJSON.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/api/approvals"));
const click = (el: Element | null): void => {
  el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
};

/**
 * 三腿夹具：
 *  - status=pending 第一页：P1 + nextCursor=pc-2；
 *  - cursor=pc-2：P2（追加后屏上 2 行）；
 *  - 无 status（chip 移除/重置后的腿）：F1,F2,F3 全量。
 */
// P1-A2 ③ 配套：risk=high 深链案要求首屏仍有可见行（分页条只服务有行状态），
// 给游标页一号补 riskLevel=high，其余用例不受该字段影响。
const P1 = { approvalId: "ap_r238p1", status: "pending", title: "游标页一号", createdAt: "2026-11-18T01:00:00Z", riskLevel: "high" };
const P2 = { approvalId: "ap_r238p2", status: "pending", title: "游标页二号", createdAt: "2026-11-18T02:00:00Z" };
const F1 = { approvalId: "ap_r238f1", status: "approved", title: "全量一号", decidedAt: "2026-11-18T03:00:00Z", riskLevel: "low" };
const F2 = { approvalId: "ap_r238f2", status: "rejected", title: "全量二号", decidedAt: "2026-11-18T04:00:00Z", riskLevel: "high" };
const F3 = { approvalId: "ap_r238f3", status: "approved", title: "全量三号", decidedAt: "2026-11-18T05:00:00Z" };

function serveByCursor(url: string): Promise<unknown> {
  const u = String(url);
  if (u.includes("/api/approval?id=")) return Promise.resolve({});
  if (u.includes("cursor=")) return Promise.resolve({ items: [P2] });
  if (u.includes("status=pending")) return Promise.resolve({ items: [P1], nextCursor: "pc-2" });
  return Promise.resolve({ items: [F1, F2, F3] });
}

describe("R238 chip × cursor zero-reset guards (approvals.chips.cursor)", () => {
  it("① 第 2 页已加载后移除 status chip：新请求不带 cursor=、行集换代无旧页残留、计数同步", async () => {
    mount(serveByCursor, "/approvals?tab=history&status=pending");
    await until("首屏", () => rowIds().join(",") === "ap_r238p1");

    // 真实翻页：apv-page-more 消费服务端 nextCursor（游标只在请求腿，不进地址=R79 现场）。
    const more = q("apv-page-more") as HTMLButtonElement | null;
    expect(more, "more button").toBeTruthy();
    expect(more!.disabled, "page 2 is offered").toBe(false);
    click(more);
    await until("第 2 页", () => rowIds().join(",") === "ap_r238p1,ap_r238p2");
    expect(q("apv5-count")?.textContent).toBe("2");

    expect(q("apv-chip-status"), "status chip rendered").toBeTruthy();

    const before = api.fetchJSON.mock.calls.length;
    click(q("apv-chip-remove-status"));
    await until("chip 移除重取", () => api.fetchJSON.mock.calls.length === before + 1);
    await until("换代渲染", () => rowIds().join(",") === "ap_r238f1,ap_r238f2,ap_r238f3");
    const fresh = listCalls()[listCalls().length - 1] ?? "";
    expect(fresh, "fresh read after chip removal carries the cursor").not.toContain("cursor=");
    expect(fresh).not.toContain("status=");
    // 换代：旧页两行零残留。
    expect(rowIds()).not.toContain("ap_r238p1");
    expect(rowIds()).not.toContain("ap_r238p2");
    expect(q("apv5-count")?.textContent).toBe("3");
    expect(lastSearch(), "status dropped from the address, tab stays").not.toContain("status=");
    expect(lastSearch()).toContain("tab=history");
  });

  it("② 连续两维 status→risk：status 步恰 +1、risk 步零请求，chip 集合与生效参一致", async () => {
    mount(serveByCursor, "/approvals?tab=history");
    await until("首屏", () => rowIds().length === 3);
    const c0 = api.fetchJSON.mock.calls.length;

    // status 维：服务端参，切换必重取恰 1。
    click(q("apv5-filter-status-pending"));
    await until("status 切换重取", () => api.fetchJSON.mock.calls.length === c0 + 1);
    const afterStatus = listCalls()[listCalls().length - 1] ?? "";
    expect(afterStatus).toContain("status=pending");

    // risk 维：本地筛，零请求（R204/R231 契约在组合链复锁一步）。
    const c1 = api.fetchJSON.mock.calls.length;
    click(q("apv-risk-high"));
    await until("risk chip 出现", () => !!q("apv-chip-risk"));
    expect(api.fetchJSON.mock.calls.length, "risk rail never fetches").toBe(c1);

    // chip 行与 URL 生效参集合一致：恰 status+risk 两枚，无幽灵。
    expect(lastSearch()).toContain("status=pending");
    expect(lastSearch()).toContain("risk=high");
    const chips = [...document.querySelectorAll('[data-testid^="apv-chip-"]')]
      .map((el) => (el.getAttribute("data-testid") ?? "").replace(/^apv-chip-/, ""))
      .filter((k) => !k.startsWith("remove-"));
    expect(chips.sort()).toEqual(["risk", "status"]);
  });

  it("③ 翻页态+多参深链下重置筛选：恰 1 次取数、URL 只剩 tab、导出读数与行集回全量", async () => {
    mount(serveByCursor, "/approvals?tab=history&status=pending&risk=high");
    await until("首屏落定", () => !document.querySelector(".animate-pulse"));
    const more = q("apv-page-more") as HTMLButtonElement | null;
    expect(more, "more button on the pending leg").toBeTruthy();
    if (!more!.disabled) {
      click(more);
      await until("第 2 页追加", () => listCalls().some((u) => u.includes("cursor=")));
    }
    expect(q("apv-reset-filters"), "reset button is live").toBeTruthy();

    const before = api.fetchJSON.mock.calls.length;
    click(q("apv-reset-filters"));
    await until("重置重取", () => api.fetchJSON.mock.calls.length === before + 1);
    await until("全量回屏", () => rowIds().join(",") === "ap_r238f1,ap_r238f2,ap_r238f3");
    const last = listCalls()[listCalls().length - 1] ?? "";
    expect(last).not.toContain("status=");
    expect(last, "reset from a paged state must not inherit the cursor").not.toContain("cursor=");
    expect(lastSearch(), "only the tab survives in the address").toBe("?tab=history");

    // 行集与导出读数回全量（R90 未翻页态之外的组合站增量）。
    const n = rowIds().length;
    expect(n).toBe(3);
    expect(q("apv5-count")?.textContent).toBe(String(n));
    expect(q("apv7-export-count")?.textContent).toBe(`共 ${n} 行`);
  });
});
