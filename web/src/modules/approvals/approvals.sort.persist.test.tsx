// @vitest-environment jsdom
/**
 * R199 — 审批排序持久化护栏（纯测试，零产品改动）。
 *
 * 现场契约（R71/R186 既有裁决，本文件按现状锁定并点名）：
 * - asort/adir 是**本地排序维**：落 URL、从不进请求 query（列表读口白名单
 *   =(status,limit,cursor)，R44/R129 实测）。工单①「请求不带排序参」与现场
 *   一致，无需差异裁决。
 * - 非法 asort=__nope__/adir=up：approvalSortKeyOf 归 null → 不排 → 屏上保持
 *   服务端默认序；URL 原样保留不改写（R186 已锁链，此处按 persist 面复锁）。
 * - 页级锚=apr5-page-history（R52 交付）。
 *
 * 散点回证据不重复写：R186 approvals.sort.filter.test.tsx:195（深链排序×筛选
 * 请求参组合）、:221-226（点排序钮 asort 落 URL 差分保参）、非法值现状链；
 * R199 combo approvals.sortfilter.combo.test.tsx（全参深链回填/交换律/三值/
 * 非法组合清除）。本文件增量=同 URL 重挂复原排序、行序与 apr-row-copy-<i>
 * 逐行对应、切 status 后排序保持+服务端重取天然回第一页、非法排序参默认序。
 */
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

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

const api = vi.mocked(fetchJSON);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let roots: Root[] = [];
let mounted: HTMLDivElement[] = [];

function Probe() {
  const loc = useLocation();
  useEffect(() => {
    document.body.setAttribute("data-r199-search", loc.search);
  }, [loc.search]);
  return null;
}

function clearScreen(): void {
  for (const root of roots) {
    act(() => {
      root.unmount();
    });
  }
  roots = [];
  for (const el of mounted) el.remove();
  mounted = [];
  document.body.removeAttribute("data-r199-search");
}

afterEach(() => {
  clearScreen();
  api.mockReset();
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

async function renderInto(entry: string, node: ReactElement): Promise<void> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  mounted.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[entry]}>{node}</MemoryRouter>);
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), `${entry} settled`);
}

const page = (entry: string) =>
  renderInto(
    entry,
    <>
      <ApprovalsHistoryModulePage />
      <Probe />
    </>,
  );

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const search = () => document.body.getAttribute("data-r199-search") ?? "";
const rowIds = (): string[] =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_p"]')).map((el) =>
    String(el.getAttribute("data-testid")).replace("apr5-row-", ""),
  );
const listUrls = (): string[] =>
  api.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/api/approvals"));

// title 字典序（localeCompare zh）刻意与注入顺序错开：
// 注入 p1(丙) p2(甲) p3(乙)，升序应为 甲 乙 丙。
const P1 = {
  approvalId: "ap_p1",
  title: "丙字项目",
  status: "pending",
  riskLevel: "low",
  approvers: [{ userId: "human:7", name: "郑涛" }],
  requestId: "req-p1-10101010",
  createdAt: "2026-11-19T02:00:00Z",
};
const P2 = {
  approvalId: "ap_p2",
  title: "甲字项目",
  status: "pending",
  riskLevel: "high",
  approvers: [{ userId: "human:8", name: "阿朝" }],
  requestId: "req-p2-20202020",
  createdAt: "2026-11-18T02:00:00Z",
};
const P3 = {
  approvalId: "ap_p3",
  title: "乙字项目",
  status: "approved",
  riskLevel: "medium",
  approvers: [{ userId: "human:9", name: "阿象" }],
  requestId: "req-p3-30303030",
  createdAt: "2026-11-17T02:00:00Z",
  decidedAt: "2026-11-17T05:00:00Z",
};

function serve(): void {
  api.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("status=approved")) return { items: [P3] };
    if (u.includes("status=pending")) return { items: [P1, P2] };
    if (u.includes("status=")) return { items: [] };
    return { items: [P1, P2, P3] };
  });
}

describe("R199 approvals sort persistence guards", () => {
  it("① a sort deep link backfills aria-sort, orders the body, and never rides the request", async () => {
    serve();
    await page("/approvals?tab=history&asort=title&adir=asc");
    expect(q("apv-sort-title")?.getAttribute("aria-sort"), "aria-sort 回填").toBe(
      "ascending",
    );
    const last = listUrls().at(-1) ?? "";
    expect(last, "服务端请求不带本地排序参").not.toContain("asort=");
    expect(last).not.toContain("adir=");
    expect(rowIds(), "屏上按 title 升序（zh 拼音：丙 bing < 甲 jia < 乙 yi → p1, p2, p3）").toEqual([
      "ap_p1",
      "ap_p2",
      "ap_p3",
    ]);
    expect(search(), "URL 保排序参").toContain("asort=title");
  });

  it("② remounting the same URL replays the same order and copy buttons stay row-aligned", async () => {
    serve();
    await page("/approvals?tab=history&asort=title&adir=asc");
    const firstOrder = rowIds();
    const firstCount = listUrls().length;
    clearScreen();
    await page("/approvals?tab=history&asort=title&adir=asc");
    expect(q("apv-sort-title")?.getAttribute("aria-sort"), "重挂复原排序").toBe(
      "ascending",
    );
    expect(rowIds(), "重挂行序逐位复原").toEqual(firstOrder);
    // 每个行复制钮与同行标题对应（i 随可见行序）。
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (t: string) => {
          written.push(t);
          return Promise.resolve();
        },
      },
    });
    for (let i = 0; i < firstOrder.length; i += 1) {
      const btn = q(`apr-row-copy-${i}`) as HTMLButtonElement | null;
      expect(btn, `apr-row-copy-${i}`).toBeTruthy();
      const label = btn!.getAttribute("aria-label") ?? "";
      const title = firstOrder[i] === "ap_p1" ? "丙字项目" : firstOrder[i] === "ap_p2" ? "甲字项目" : "乙字项目";
      expect(label, `第 ${i} 个钮对应第 ${i} 行标题`).toContain(title);
      await act(async () => {
        btn!.click();
      });
      expect(written[written.length - 1], `第 ${i} 行复制首段=同行单号`).toContain(
        `单号：${firstOrder[i]}`,
      );
    }
    expect(listUrls().length, "重挂+复制全程零额外列表请求").toBe(firstCount + 1); // +1=重挂自身的首取
  });

  it("③ switching status keeps the sort params and the refetch starts from page one with a consistent count", async () => {
    serve();
    await page("/approvals?tab=history&asort=title&adir=asc");
    expect(rowIds(), "初态三行按 title 拼音升序").toEqual(["ap_p1", "ap_p2", "ap_p3"]);
    const before = listUrls().length;
    const approved = q("apv5-filter-status-approved") as HTMLButtonElement | null;
    expect(approved, "快捷状态钮在场").toBeTruthy();
    await act(async () => {
      approved!.click();
    });
    await waitFor(() => rowIds().join() === "ap_p3", "approved 腿只回 p3");
    expect(search(), "切 status 后排序参保持").toContain("asort=title");
    expect(search()).toContain("adir=asc");
    expect(search()).toContain("status=approved");
    const fresh = listUrls().slice(before);
    expect(fresh.length, "服务端维切换恰一次重取").toBe(1);
    expect(fresh[0]).toContain("status=approved");
    expect(fresh[0], "重取天然回第一页：不带旧游标").not.toContain("cursor=");
    expect(q("apv5-count")?.textContent, "计数与新集合一致").toBe(String(rowIds().length));
  });

  it("④ invalid sort params keep the address verbatim and render the default order", async () => {
    serve();
    await page("/approvals?tab=history&asort=__nope__&adir=up");
    expect(
      search(),
      "非法排序参不改写 URL",
    ).toBe("?tab=history&asort=__nope__&adir=up");
    expect(rowIds(), "未知 asort 归 null → 服务端默认序原样呈现").toEqual(["ap_p1", "ap_p2", "ap_p3"]);
    const sortBtns = Array.from(document.querySelectorAll('[data-testid^="apv-sort-"][aria-sort]'));
    expect(sortBtns.length, "排序钮在场").toBeGreaterThan(0);
    for (const btn of sortBtns) {
      expect(btn.getAttribute("aria-sort"), "非法排序参下无生效态").toBe("none");
    }
    expect(q("apr5-page-history"), "页级锚在").toBeTruthy();
    expect(listUrls().at(-1) ?? "", "非法参也不进请求").not.toContain("__nope__");
  });
});
