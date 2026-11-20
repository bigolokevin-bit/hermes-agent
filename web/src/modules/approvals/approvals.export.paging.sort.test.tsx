// @vitest-environment jsdom
/**
 * R251 — 审批导出×分页×排序三值终锁（纯测试，零产品改动，gap-only）。
 *
 * 已覆盖只回证据，不写重复用例：
 * ① 第 2 页后导出三值 + 首行==屏上首行（非第 1 页首行语义在此指
 *   「导出跟着屏上集合走」）= approvals.export.paged.test.tsx it①
 *   （R235：数据行==已加载表体==apv5-count、首行==rowIds()[0]）。
 *   本文件在组合站的中间步骤顺带复锁（同一站点链内），不另建单站。
 * ③ 分页中途 500 后导出只含成功页行、不含半页行、错误行 rid 可
 *   复制、重试恰 +1 且成功后三值换代 = approvals.export.fail.
 *   isolation.test.tsx it①②③（R243，含半页 ap_p4 不漏、两次导出
 *   逐字相等、重试换代 4 行）+ approvals.paging.test.tsx it②
 *   （R139：rid req-r235-page 复制、重试 +1）。回证据不重写。
 * 真缺口 = ②：翻页态之后现场切排序（点 apv-sort-risk 两下 →
 *   asort=risk&adir=desc）再导出——R248 的排序切换站在「未翻页」
 *   形态，R235/R243 的翻页站从未切排序；「翻页后行集 + 本地排序」
 *   两维叠加时导出序==屏上序、两次导出互不残留、切换零新取数，
 *   从未同帧锁过。本文件补该组合链。
 *
 * 现场事实：status=服务端维（本文件不切站，恒默认腿）；asort/adir
 * 为本地维、从不进请求（R71/R186）；sortApprovalRows 对缺值行双向
 * 恒排末（R71 partition）；追加按 row.key 去重（R79）。
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
    root.render(<MemoryRouter initialEntries={[entry]}>{<ApprovalsHistoryModulePage />}</MemoryRouter>);
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), `${entry} settled`);
}

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
let urlsAll: string[] = [];
const listCalls = () => urlsAll.filter((u) => u.includes("/api/approvals"));

const P1 = { approvalId: "ap_pg1", title: "丙档低危", status: "approved", riskLevel: "low", createdAt: "2026-11-18T01:00:00Z", decidedAt: "2026-11-19T02:00:00Z" };
const P2 = { approvalId: "ap_pg2", title: "无档缺项", status: "approved", createdAt: "2026-11-18T02:00:00Z", decidedAt: "2026-11-19T03:00:00Z" };
const P3 = { approvalId: "ap_pg3", title: "甲档高危", status: "approved", riskLevel: "high", createdAt: "2026-11-18T03:00:00Z", decidedAt: "2026-11-19T04:00:00Z" };
const P4 = { approvalId: "ap_pg4", title: "乙档中危", status: "approved", riskLevel: "medium", createdAt: "2026-11-18T04:00:00Z", decidedAt: "2026-11-19T05:00:00Z" };

const PAGE1 = { items: [P1, P2, P3], nextCursor: "pg-c-2" };
// 第 2 页含重复 P2（R79 去重复锁）且无 nextCursor 键（末页）。
const PAGE2 = { items: [P2, P4] };

function servePaged() {
  urlsAll = [];
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    urlsAll.push(u);
    if (u.includes("/api/approval?id=")) return {};
    if (u.includes("cursor=")) return { ...PAGE2 };
    if (u.includes("/api/approvals")) return { ...PAGE1 };
    return {};
  });
}

const rowIds = () =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap"]'))
    .map((el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""))
    .filter((id) => !id.startsWith("details-"));

describe("R251 ② 翻页态现场切 risk/desc 再导出：序==屏上、两次互不残留、切换零取数", () => {
  it("paged rows + flipped risk-desc sort keeps CSV order equal to the screen across two exports with no refetch", async () => {
    servePaged();
    await render("/approvals?tab=history");
    await waitFor(() => rowIds().length === 3, "first page shows three rows");

    // 翻页链（①薄复锁：追加去重 + 三值）。
    const more = q("apv-page-more") as HTMLButtonElement | null;
    expect(more, "more button").toBeTruthy();
    expect(more!.disabled, "首页有游标可续").toBe(false);
    await act(async () => {
      more!.click();
    });
    await waitFor(() => rowIds().length === 4, "appended station shows four rows");
    expect(rowIds().filter((id) => id === "ap_pg2"), "重复行去重只剩一条").toHaveLength(1);
    expect(listCalls(), "首取 + 一次游标").toHaveLength(2);
    expect(listCalls()[1], "第二条请求带游标").toContain("cursor=pg-c-2");
    expect(q("apv5-count")?.textContent, "三值：apv5-count==表体").toBe("4");
    expect(q("apv7-export-count")?.textContent).toContain("共 4 行");
    const callsAfterPaging = mock.mock.calls.length;

    const captured: Blob[] = [];
    const orig = URL.createObjectURL;
    URL.createObjectURL = ((blob: Blob) => {
      captured.push(blob);
      return "blob:appr251";
    }) as typeof URL.createObjectURL;
    const clicks = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    const grabIds = async (): Promise<string[]> => {
      const btn = q("apv7-export") as HTMLButtonElement | null;
      expect(btn, "export button").toBeTruthy();
      expect(btn!.disabled, "有行站导出可用").toBe(false);
      await act(async () => {
        btn!.click();
      });
      const text = await captured[captured.length - 1].text();
      return text
        .replace(/^\uFEFF/, "")
        .split("\r\n")
        .filter((line) => line !== "")
        .slice(1)
        .map((line) => line.split(",")[0]);
    };

    try {
      // 导出①：翻页后的当前屏序。
      const orderBefore = rowIds();
      const ids1 = await grabIds();
      expect(ids1, "导出①==屏上序").toEqual(orderBefore);
      expect(ids1).toEqual(["ap_pg1", "ap_pg2", "ap_pg3", "ap_pg4"]);
      expect(mock.mock.calls.length, "导出①零取数").toBe(callsAfterPaging);

      // 现场切排序：点两下 apv-sort-risk（asc→desc，R71 循环）。
      const sortBtn = q("apv-sort-risk") as HTMLButtonElement | null;
      expect(sortBtn, "risk sort button").toBeTruthy();
      await act(async () => {
        sortBtn!.click();
      });
      await waitFor(
        () => q("apv-sort-risk")?.getAttribute("aria-sort") === "ascending",
        "first click ascends",
      );
      await act(async () => {
        (q("apv-sort-risk") as HTMLButtonElement).click();
      });
      await waitFor(
        () => q("apv-sort-risk")?.getAttribute("aria-sort") === "descending",
        "second click descends",
      );
      expect(listCalls(), "切排序零新取数（本地维）").toHaveLength(2);
      expect(mock.mock.calls.length, "切换动作零取数").toBe(callsAfterPaging);
      expect(q("apv5-count")?.textContent, "切换后计数仍 4").toBe("4");

      const orderAfter = rowIds();
      expect(orderAfter, "排序生效（序确实变了）").not.toEqual(orderBefore);
      expect(orderAfter[orderAfter.length - 1], "缺 risk 行双向恒排末（R71）").toBe("ap_pg2");
      expect([...orderAfter].sort(), "行集不变仅顺序变").toEqual([...orderBefore].sort());

      // 导出②：新屏序；两次 Blob 互不残留。
      const ids2 = await grabIds();
      expect(ids2, "导出②==切换后屏上序").toEqual(orderAfter);
      expect(captured, "两次导出两个 Blob").toHaveLength(2);
      const ids1Again = (await captured[0].text())
        .replace(/^\uFEFF/, "")
        .split("\r\n")
        .filter((line) => line !== "")
        .slice(1)
        .map((line) => line.split(",")[0]);
      expect(ids1Again, "导出①内容不被导出②污染").toEqual(ids1);
      expect(ids2.join(",")).not.toBe(ids1.join(","));
      expect(mock.mock.calls.length, "导出②仍零取数").toBe(callsAfterPaging);
      expect(q("apv7-export-count")?.textContent, "终局三值同步").toContain("共 4 行");
      expect(rowIds().length, "终局表体仍 4").toBe(4);
    } finally {
      URL.createObjectURL = orig;
      clicks.mockRestore();
    }
  });
});
