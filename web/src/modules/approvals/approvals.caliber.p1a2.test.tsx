// @vitest-environment jsdom
/**
 * P1-A2 — /approvals 数据口径三点的护栏用例（UX r2 工单 ①②③）。
 *
 * 先 git grep 现查既有覆盖，已覆盖只回证据、本文件不写重复用例：
 * ②「total 未知且末页不再并存两句话」的翻页路径 =
 *   approvals.paging.test.tsx L137-143（改判后锁「已到末页 · 已显示 4 条」+ end chip 缺席）
 *   与 ApprovalsHistoryModulePage.test.tsx R80/R82（改判后 more.disabled 轮询）；
 * ①「列表相对 vs 详情绝对」的渲染腿 = ApprovalsPendingModulePage.test.tsx
 *   opens the ticket…（deadline 优先改造判后锁 /剩 1 小时/，ttl 快照 99999 被压过）。
 * 本文件真增量：
 * ① 单点性单元断言——beijing() 必须与 plainMinute(epochOf()) 逐字同值（同一把尺），
 *   且 detail.remaining 在 deadline 与 ttl 快照并存时取 deadline 推导；
 * ② total 已知末页腿的「已到末页」角标仍须在（证明 ② 只消并存、不误伤已知总数腿）；
 * ③ 过滤 miss（rows>0 而 visibleRows=0）时整个 apv-page 分页条退场、空卡在场，
 *   清空关键字后分页条复位——R308b empty.refresh 护栏的页内过滤版。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/lib/api", () => ({ fetchJSON: vi.fn() }));

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    onClick,
    ...rest
  }: {
    children?: ReactNode;
    onClick?: () => void;
    [k: string]: unknown;
  }) => (
    <button type="button" onClick={onClick} {...(rest as Record<string, never>)}>
      {children}
    </button>
  ),
  Card: ({ children, ...rest }: { children?: ReactNode; [k: string]: unknown }) => (
    <div {...(rest as Record<string, never>)}>{children}</div>
  ),
  CardContent: ({ children, className }: { children?: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

import { fetchJSON } from "@/lib/api";
import ApprovalsHistoryModulePage from "@/modules/approvals/ApprovalsHistoryModulePage";
import { approvalDetailFrom, beijing, countdown } from "@/modules/approvals/model";
import { epochOf, plainMinute } from "@/modules/approvals/RelativeTime";

const mock = vi.mocked(fetchJSON);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let roots: Root[] = [];
let mounted: HTMLDivElement[] = [];

afterEach(() => {
  for (const root of roots) {
    act(() => {
      root.unmount();
    });
  }
  roots = [];
  for (const el of mounted) el.remove();
  mounted = [];
  mock.mockReset();
});

const waitFor = async (cond: () => boolean, label: string): Promise<void> => {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
};

async function render(entry: string): Promise<void> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  mounted.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <ApprovalsHistoryModulePage />
      </MemoryRouter>,
    );
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), `${entry} settled`);
}

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const rowCount = () => document.querySelectorAll('[data-testid^="apr5-row-ap_p"]').length;

const P1 = { approvalId: "ap_p1", title: "第一条", status: "approved", createdAt: "2026-11-19T01:00:00Z" };
const P2 = { approvalId: "ap_p2", title: "第二条", status: "approved", createdAt: "2026-11-19T01:10:00Z" };
const P3 = { approvalId: "ap_p3", title: "第三条", status: "approved", createdAt: "2026-11-19T01:20:00Z" };

describe("P1-A2 ① time formatting has a single source", () => {
  it("beijing() equals plainMinute(epochOf()) verbatim, and remaining prefers deadline over ttl snapshot", async () => {
    const raw = "2026-11-21T09:09:00+08:00";
    const ms = epochOf(raw);
    expect(ms, "epochOf parses the same three shapes").not.toBeNull();
    expect(beijing(raw), "详情绝对串与单点格式化逐字同值").toBe(plainMinute(ms as number));
    expect(beijing(raw)).toBe("2026-11-21 09:09");
    // 无效输入两路同 null（委托不吞 NaN）。
    expect(beijing("nonsense")).toBeNull();
    expect(epochOf("nonsense")).toBeNull();

    // deadline 与 ttl 快照并存：以 deadline 现场推导为准（同一把尺），ttl 快照只是回退。
    const detail = approvalDetailFrom({
      approvalId: "ap_cal_1",
      title: "口径单",
      status: "pending",
      createdAt: "2026-11-21T09:09:00Z",
      expiresAt: new Date(Date.now() + 3 * 3600_000 + 60_000).toISOString(),
      remainingSeconds: 99999,
    });
    expect(detail).not.toBeNull();
    const viaTtl = countdown(99999);
    expect(viaTtl?.text, "ttl 快照腿单独会给「剩 1 天」").toMatch(/剩 1 天/);
    expect(detail?.remaining?.text, "deadline 优先压过 ttl 快照").toMatch(/剩 3 小时/);
    expect(detail?.deadline, "绝对 deadline 也出自同一把尺").toBe(plainMinute(epochOf(detail?.deadlineAt ?? "") as number));
  });
});

describe("P1-A2 ② total known at end still shows the end chip", () => {
  it("known total + no cursor keeps 「已到末页」角标 while count stays 「共 N 条 / 已加载 M 条」", async () => {
    mock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) return {};
      return { items: [P1, P2], total: 9 };
    });
    await render("/approvals?tab=history");
    await waitFor(() => rowCount() === 2, "rows");
    // AP-01：已知总数腿仍报真总数（这是唯一允许出现「共 N 条」的腿），
    // 「已显示」措辞统一成「已加载」，与 denominatorReadout 单点同形。
    expect(q("apv-page-count")?.textContent).toBe("共 9 条 / 已加载 2 条");
    expect(q("apv-denominator-note"), "总数已知：截断说明退场").toBeNull();
    expect(q("apv-page-end")?.textContent, "已知总数到末页：end chip 不误伤").toBe("已到末页");
    expect((q("apv-page-more") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("P1-A2 ③ filter miss hides the whole pagination footer", () => {
  it("q miss keeps the empty card and drops apv-page; clearing restores it", async () => {
    mock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) return {};
      // 带 nextCursor：复位腿才有「已加载 n 条（非全量）」的有游标原因句，
      // 且 miss 腿的可见行=0 语义不变。
      return { items: [P1, P2, P3], nextCursor: "cal-2" };
    });
    // 深链 q=不存在：3 行 loaded、0 行可见。
    await render("/approvals?tab=history&q=zzz-不存在");
    await waitFor(() => !!q("apv8-search-empty"), "miss card");
    expect(rowCount(), "no visible rows on the miss leg").toBe(0);
    expect(q("apv-page"), "footer state machine: no dead 加载更多 on miss").toBeNull();
    // 清空关键字（URL 不再带 q）→ 分页条复位。
    await render("/approvals?tab=history");
    await waitFor(() => rowCount() === 3, "rows restored");
    expect(q("apv-page"), "footer back with visible rows").not.toBeNull();
    expect(q("apv-page-count")?.textContent).toBe("已加载 3 条（非全量）");
    expect(q("apv-page-end"), "有 next 时不挂末页角标（并存只在未知+末页曾发生）").toBeNull();
  });
});
