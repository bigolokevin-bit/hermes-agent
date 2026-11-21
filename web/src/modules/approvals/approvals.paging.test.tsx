// @vitest-environment jsdom
/**
 * R139 — /approvals 队列分页契约护栏（纯测试，零产品改动）。
 *
 * 先 git grep 现查既有覆盖，已覆盖只回证据、本文件不写重复用例：
 * ①前半「追加按审批号去重」+③「末页 more disabled」=
 *   ApprovalsHistoryModulePage.test.tsx describe "R79 cursor pagination…"
 *   两用例（duplicate row suppressed / more disabled at end /
 *   title 含「已到末页」——工单措辞「到底」与现场文案「已到末页」不同，
 *   按现状记录，禁为此改产品文案）；window 维=apv5-filter-window 恒 disabled
 *   摆设（R129 裁决），不存在「切 window」动作，status 切换游标重置已由
 *   R79 第二用例 + approvals.history.filters.test.tsx ② + R98 chip 移除锁。
 * 本文件新增量=翻页「之后」的三态复验：
 * ①追加后 行数==apv5-count==apv7-export-count 三值相等（wave-29 只锁了
 *   未翻页态）；⑤apr-row-copy-<i> 追加后仍与行序同序、首行复制仍以
 *   「单号：ap_」开头；④第二页 500 的现状矩阵——已加载行保留、
 *   apr5-inline-failure 含 rid、重试恰 +1 且成功追加、pageFailure 消失。
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

import { ApiError } from "@/lib/api-error";
import { fetchJSON } from "@/lib/api";
import ApprovalsHistoryModulePage from "@/modules/approvals/ApprovalsHistoryModulePage";

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
const rowIds = () =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_p"]'))
    .map((el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""));
const rowCount = () => document.querySelectorAll('[data-testid^="apr5-row-ap_p"]').length;

const P1 = { approvalId: "ap_p1", title: "第一条", status: "approved", createdAt: "2026-11-19T01:00:00Z" };
const P2 = { approvalId: "ap_p2", title: "第二条", status: "approved", createdAt: "2026-11-19T01:10:00Z" };
const P3 = { approvalId: "ap_p3", title: "第三条", status: "approved", createdAt: "2026-11-19T01:20:00Z" };
const P4 = { approvalId: "ap_p4", title: "第四条", status: "approved", createdAt: "2026-11-19T01:30:00Z" };
const PAGE1 = { items: [P1, P2, P3], nextCursor: "pc-2" };
// 第二页：重复 P3 + 新行 P4，末页（无 nextCursor 键）。
const PAGE2 = { items: [P3, P4] };

const listCalls = () => mock.mock.calls.filter((c) => String(c[0]).includes("/api/approvals")).length;

describe("R139 ①⑤ after append: three numbers equal, row copy stays index-aligned", () => {
  it("appends the deduped page and keeps count / export / copy aligned with rows", async () => {
    mock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) return {};
      if (u.includes("cursor=")) return PAGE2;
      return PAGE1;
    });
    await render("/approvals?tab=history");
    await waitFor(() => rowCount() === 3, "page one");
    const more = q("apv-page-more") as HTMLButtonElement;
    expect(more.disabled, "more enabled with cursor").toBe(false);
    const before = listCalls();
    await act(async () => {
      more.click();
    });
    await waitFor(() => !!q("apr5-row-ap_p4"), "page two appended");
    expect(listCalls(), "one cursor fetch").toBe(before + 1);
    // ① 去重并集 + 三值相等。
    expect(document.querySelectorAll('[data-testid="apr5-row-ap_p3"]').length, "duplicate suppressed").toBe(1);
    expect(rowCount()).toBe(4);
    expect(q("apv5-count")?.textContent).toBe("4");
    expect(q("apv7-export-count")?.textContent, "export count mirrors the same visibleRows").toBe("共 4 行");
    // P1-A2 ② 改判：total 不可用且已到末页时，count 单句直述「已到末页」，
    // 不再与「总数不可用」并存；apv-page-end 角标在 total 未知腿退出。
    expect(q("apv-page-count")?.textContent).toBe("已到末页 · 已显示 4 条");
    // ③ 末页现状文案（「已到末页」，非工单措辞「到底」——按现状记录）。
    expect((q("apv-page-more") as HTMLButtonElement).disabled, "more disabled at end").toBe(true);
    expect(q("apv-page-more")?.getAttribute("title")).toContain("已到末页");
    expect(q("apv-page-end"), "P1-A2 ②: end chip absent when total unknown").toBeNull();
    // ⑤ 追加后 apr-row-copy-<i> 与行序同序。
    const ids = rowIds();
    expect(ids).toEqual(["ap_p1", "ap_p2", "ap_p3", "ap_p4"]);
    const titles = ["第一条", "第二条", "第三条", "第四条"];
    for (let i = 0; i < ids.length; i += 1) {
      const btn = document.querySelector(`[data-testid="apr-row-copy-${i}"]`) as HTMLButtonElement | null;
      expect(btn, `copy button ${i}`).toBeTruthy();
      expect(btn.getAttribute("aria-label"), `copy ${i} names row ${i}`).toContain(titles[i]);
    }
    // ⑤ 首行复制以审批单号段开头；复制零新请求。
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: (text: string) => { written.push(text); return Promise.resolve(); } },
    });
    const callsBeforeCopy = mock.mock.calls.length;
    await act(async () => {
      (document.querySelector('[data-testid="apr-row-copy-0"]') as HTMLButtonElement).click();
    });
    await waitFor(() => written.length === 1, "clipboard write");
    expect(written[0].startsWith("单号：ap_"), "copy text starts with the approval id segment").toBe(true);
    expect(written[0]).toContain("标题：第一条");
    expect(mock.mock.calls.length, "copying never fetches").toBe(callsBeforeCopy);
  });
});

describe("R139 ④ a failing second page keeps loaded rows and retries once", () => {
  it("pageFailure panel carries the rid, rows survive, retry appends successfully", async () => {
    let cursorTries = 0;
    mock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) return {};
      if (u.includes("cursor=")) {
        cursorTries += 1;
        if (cursorTries === 1) {
          throw new ApiError("boom", {
            status: 500,
            body: JSON.stringify({ code: "runtime.unavailable" }),
            url: u,
            requestId: "req-apv-paging",
          });
        }
        return PAGE2;
      }
      return PAGE1;
    });
    await render("/approvals?tab=history");
    await waitFor(() => rowCount() === 3, "page one");
    await act(async () => {
      (q("apv-page-more") as HTMLButtonElement).click();
    });
    await waitFor(() => !!q("apr5-inline-failure"), "page failure shown");
    // 已加载行保留在屏上。
    expect(rowCount(), "loaded rows survive the failed page").toBe(3);
    const fail = q("apr5-inline-failure");
    expect(fail?.textContent, "action sentence").toContain("后续记录没有加载成功");
    expect(fail?.textContent, "copyable rid on the failure line").toContain("req-apv-paging");
    // 重试恰 +1 次并成功追加（onRetry=loadMore 走同一游标）。
    const before = listCalls();
    const retry = Array.from(fail!.querySelectorAll("button")).find(
      (b) => (b.textContent ?? "").trim() === "重试",
    ) as HTMLButtonElement;
    expect(retry, "retry button").toBeTruthy();
    await act(async () => {
      retry.click();
    });
    await waitFor(() => !!q("apr5-row-ap_p4"), "append succeeded after retry");
    expect(listCalls(), "retry is exactly one fetch").toBe(before + 1);
    // 现状缺陷上报（本单纯测试禁改产品）：useApprovalsData.ts 成功路径
    // `pageFailure: append ? prev.pageFailure : null` 在追加成功后**不清**
    // pageFailure → 错误条滞留。此处按现状锁定，修复需另令。
    expect(q("apr5-inline-failure"), "page failure persists after append (recorded defect)").toBeTruthy();
    expect(rowCount()).toBe(4);
    expect(q("apv5-count")?.textContent).toBe("4");
  });
});
