// @vitest-environment jsdom
/**
 * AP-01 — 待处理列表真数据与分母诚实（行为契约）。
 *
 * 契约面（源单 seakoi-agent-os-l0-board/docs/product/backlogs/approvals-duty.md §AP-01）：
 * ① 队列与汇总条里不存在任何「按已加载条数推算的总量」文案；分母句只有一个来源
 *    （QueueSummaryBar.denominatorReadout），措辞＝「已加载 n 条（非全量）」；
 * ② total=null（读口顶层无 total 键，实测 keys=[items,nextCursor]）时必须明说，
 *    unreadable>0 时在汇总条有出口（「n 条无法读取」），分页到底/截断态一句诚实说明；
 * ③ status 缺省（BFF _approvals_all 逐 8 态扇出）与单态透传（_approvals_alias_map）
 *    两路同形：同一份分母句、同一份分页句，只差原因。
 *
 * 接口面零新端点：断言里出现的 URL 只有 api.ts 的 LIST_PATH/DETAIL_PATH；写通道
 * 维持 DECISION_GATE 关闭（末条用例钉零请求）。mock 只打在 @/lib/api 的 fetchJSON
 * 这一条缝上，形制照 ApprovalsPendingModulePage.test.tsx / approvals.paging.test.tsx。
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import ApprovalsHistoryModulePage from "@/modules/approvals/ApprovalsHistoryModulePage";
import ApprovalsPendingModulePage from "@/modules/approvals/ApprovalsPendingModulePage";
import { approvalsPageFrom } from "@/modules/approvals/model";
import { PAGE_LIMIT } from "@/modules/approvals/api";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

async function render(entry: string, page: ReactNode): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<MemoryRouter initialEntries={[entry]}>{page}</MemoryRouter>);
  });
}

async function mount(handler: (url: string) => unknown, entry: string): Promise<void> {
  api.fetchJSON.mockClear(); // 一腿一屏：URL 断言只看这一次挂载自己发出的请求
  api.fetchJSON.mockImplementation(async (url: string) => handler(String(url)));
  await render(entry, entry.includes("tab=history") ? <ApprovalsHistoryModulePage /> : <ApprovalsPendingModulePage />);
  await waitFor(() => !document.querySelector(".animate-pulse"), `${entry} settled`);
}

const text = (): string => document.body.textContent ?? "";
const qa = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
const listUrls = (): string[] =>
  api.fetchJSON.mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith("/agent-api/api/approvals"));

/** Three readable rows — the loaded count that must never be dressed up as a total. */
const rowOf = (n: number, status = "pending") => ({
  approvalId: `ap_h${n}`,
  title: `分母诚实单 ${n}`,
  status,
  createdAt: `2026-11-19T0${n}:00:00Z`,
});
const THREE = [rowOf(1), rowOf(2), rowOf(3)];
/** 实测扇出腿响应顶层形状：只有 items/nextCursor，无 total 键。 */
const FANOUT_PAGE = { items: THREE, nextCursor: null };
/** 实测单态透传腿响应顶层形状：连 nextCursor 都不带，同样无 total 键。 */
const PASSTHROUGH_PAGE = { items: THREE };

beforeEach(() => {
  api.fetchJSON.mockReset();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
});

describe("AP-01 ① 队列里没有按已加载条数推算的总量", () => {
  it("the pending queue states the loaded count as 非全量, never as a total", async () => {
    await mount(() => ({ items: THREE, nextCursor: null }), "/approvals");
    // 行与请求都可追溯到 BFF 实口：URL 就是 api.ts 的 LIST_PATH＋status/limit。
    expect(listUrls()[0]).toBe(`/agent-api/api/approvals?status=pending&limit=${PAGE_LIMIT}`);
    expect(text()).toContain("分母诚实单 1");
    // 分母句在汇总条上屏，且是唯一口径。
    expect(qa("apv6-summary-scope")?.textContent).toBe("已加载 3 条（非全量）");
    expect(qa("apv6-summary-pending")?.textContent).toContain("3");
    // ① DoD：没有任何「共 <已加载条数> 条」形态的总量文案。
    expect(text(), "loaded count must never read as a total").not.toContain("共 3 条");
    expect(text()).not.toMatch(/总数\s*3/);
    // 「待办」桶的数字带着同源范围句（tooltip 里也是同一句话）。
    expect(qa("apv6-summary-pending")?.getAttribute("title")).toContain("非全量");
  });

  it("an empty read says the read port gives no total instead of 「共 0 条」", async () => {
    await mount(() => ({ items: [] }), "/approvals");
    expect(text()).not.toContain("共 0 条");
    expect(qa("apv6-summary-detail")?.textContent).toContain("读口不给总数");
    // 空态不假造数字：分母句随可见行一起退场（分页条本就不出）。
    expect(qa("apv-page")).toBeNull();
  });

  it("a real total key from the read port is the only leg that shows 共 N 条", async () => {
    await mount(() => ({ items: THREE, nextCursor: null, total: 42 }), "/approvals");
    expect(qa("apv6-summary-scope")?.textContent).toBe("共 42 条 / 已加载 3 条");
    expect(qa("apv-page-count")?.textContent).toBe("共 42 条 / 已加载 3 条");
    expect(qa("apv-denominator-note"), "total 已知：截断说明退场").toBeNull();
    expect(text()).not.toContain("非全量");
  });
});

describe("AP-01 ② total=null 明说 · unreadable 有出口 · 截断态有说明", () => {
  it("no total key is named out loud, with the measured response keys as the reason", async () => {
    await mount(() => FANOUT_PAGE, "/approvals?tab=history");
    const scope = qa("apv6-summary-scope");
    expect(scope?.getAttribute("title"), "reason names the missing total key").toContain("没有 total 键");
    expect(qa("apv-page-count")?.getAttribute("title")).toContain("不报总数");
    // 分页到底/截断态的诚实说明：无游标不等于全量。
    expect(qa("apv-denominator-note")?.textContent).toContain("截断");
    expect(qa("apv-denominator-note")?.getAttribute("title")).toBe(scope?.getAttribute("title"));
  });

  it("unreadable rows get an exit on the summary bar and are counted nowhere else", async () => {
    // 两条服务端确实返回、但读不出可显示形态的记录（既无单号也无标题）。
    await mount(
      () => ({ items: [...THREE, { status: "pending" }, { note: "没有可显示内容" }], nextCursor: null }),
      "/approvals",
    );
    expect(qa("apv6-summary-unreadable")?.textContent).toBe("2 条无法读取");
    // 无法读取的行不混进任何计数：分母句与桶计数都只数可读的 3 行。
    expect(qa("apv6-summary-scope")?.textContent).toBe("已加载 3 条（非全量）");
    expect(qa("apv6-summary-pending")?.textContent).toContain("3");
    expect(qa("apv6-summary-unreadable")?.getAttribute("title")).toContain("不计入");
  });

  it("the 已加载 count stays honest across appended pages", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) return {};
      if (u.includes("cursor=")) return { items: [rowOf(4)] };
      return { items: THREE, nextCursor: "h-ap-2" };
    });
    await render("/approvals", <ApprovalsPendingModulePage />);
    await waitFor(() => qa("apv6-summary-scope")?.textContent === "已加载 3 条（非全量）", "first page");
    // 有游标时不假装到底：句子仍是分母句，原因句说明还有下一页。
    expect(qa("apv6-summary-scope")?.getAttribute("title")).toContain("不是全部");
    expect(qa("apv-denominator-note")?.textContent).toContain("加载更多");
    await act(async () => {
      (qa("apv-page-more") as HTMLButtonElement).click();
    });
    await waitFor(() => qa("apv6-summary-scope")?.textContent === "已加载 4 条（非全量）", "appended page");
    expect(text(), "no inferred total after paging").not.toContain("共 4 条");
  });
});

describe("AP-01 ③ status=all 扇出与单态透传两路同形", () => {
  const fanOutUrls = (): string[] => listUrls();

  it("omitted status, status=all and a single status render the same denominator sentence", async () => {
    await mount(() => FANOUT_PAGE, "/approvals?tab=history");
    const scopeDefault = qa("apv6-summary-scope")?.textContent;
    const countDefault = qa("apv-page-count")?.textContent;
    expect(scopeDefault, "扇出腿分母句").toBe("已加载 3 条（非全量）");
    expect(fanOutUrls()[0], "缺省不带 status：BFF 走 _approvals_all").toBe(`/agent-api/api/approvals?limit=${PAGE_LIMIT}`);

    await mount(() => FANOUT_PAGE, "/approvals?tab=history&status=all");
    expect(listUrls()[0], "status=all 原样上线，由 BFF 扇出").toBe(
      `/agent-api/api/approvals?status=all&limit=${PAGE_LIMIT}`,
    );
    expect(qa("apv6-summary-scope")?.textContent).toBe(scopeDefault);
    expect(qa("apv-page-count")?.textContent).toBe(countDefault);

    await mount(() => PASSTHROUGH_PAGE, "/approvals?tab=history&status=expired");
    expect(listUrls()[0], "单态原样透传（服务端仅补行别名）").toBe(
      `/agent-api/api/approvals?status=expired&limit=${PAGE_LIMIT}`,
    );
    // 同形：可见句逐字相同；只有原因句按各自的游标语义分别说清。
    expect(qa("apv6-summary-scope")?.textContent, "两路同形").toBe(scopeDefault);
    expect(qa("apv-page-count")?.textContent).toBe(countDefault);
    expect(qa("apv-denominator-note")?.textContent, "单态腿的到底句讲的是游标，不是全量").toContain("总数不推算");
    const passthroughReason = qa("apv6-summary-scope")?.getAttribute("title") ?? "";
    expect(passthroughReason, "单态腿原因句不提扇出").not.toContain("扇出");
    expect(passthroughReason).toContain("没有 total 键");
  });

  it("the parser never invents a total for either measured response shape", () => {
    // 纯解析腿：两路实测顶层形状都必须 total=null，unreadable 单列。
    const fan = approvalsPageFrom(FANOUT_PAGE);
    const pas = approvalsPageFrom(PASSTHROUGH_PAGE);
    expect(fan?.total, "扇出腿无 total 键").toBeNull();
    expect(pas?.total, "单态腿无 total 键").toBeNull();
    expect(fan?.rows.length).toBe(3);
    expect(pas?.rows.length).toBe(3);
    // 契约升级腿只认读口自己给的键，缺省仍是 null 而不是 0。
    expect(approvalsPageFrom({ items: THREE, total: 42 })?.total).toBe(42);
    expect(approvalsPageFrom({ items: THREE, count: 7 })?.total).toBe(7);
    expect(approvalsPageFrom({ items: [] })?.total).toBeNull();
    expect(approvalsPageFrom([])?.total, "裸数组同样不推算").toBeNull();
  });
});

describe("AP-01 铁律 · 写开关保持关", () => {
  it("the gated decision buttons still issue zero requests", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) return { approvalId: "ap_h1", title: "分母诚实单 1", status: "pending" };
      return FANOUT_PAGE;
    });
    await render("/approvals", <ApprovalsPendingModulePage />);
    await waitFor(() => !!qa("apr5-row-ap_h1"), "row painted");
    await act(async () => {
      (qa("apr5-row-ap_h1") as HTMLElement).click();
    });
    await waitFor(() => !!qa("apr5-actions-readonly-note"), "drawer actions");
    const buttons = Array.from(document.querySelectorAll("button")).filter(
      (b) => (b.textContent ?? "").trim() === "批准" || (b.textContent ?? "").trim() === "驳回",
    ) as HTMLButtonElement[];
    expect(buttons.length, "批准/驳回在场").toBeGreaterThan(0);
    for (const btn of buttons) {
      expect(btn.disabled, "写门维持关闭").toBe(true);
      expect(btn.getAttribute("aria-disabled")).toBe("true");
      await act(async () => {
        btn.click();
      });
    }
    expect(
      api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approval/decision")),
      "禁用钮零写请求",
    ).toHaveLength(0);
  });
});
