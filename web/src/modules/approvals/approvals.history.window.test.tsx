// @vitest-environment jsdom
/**
 * R233 — 审批历史页 window 档位与计数护栏（纯测试，零产品改动）。
 *
 * 现场裁决（按现状记录，禁臆造行为）：
 * - `window` 参现状=摆设（R129/R139 契约）：apv5-filter-window 恒 disabled，
 *   深链 `?window=` 不回填、不进请求、URL 不被改写；本文件按现状断言。
 * - 工单点名的页级锚 `apv7-page` 全 src grep=0 —— 现场页级锚实名
 *   `apr5-page-history`（ApprovalsHistoryModulePage.tsx L383），按现场载体断言
 *   （同 R129 对 `apv7-back` 幻影名的处置先例）。
 * - 已覆盖只回证据，不重写：
 *   ② `?status=approved&asort=title&adir=desc` 的行序==CSV 序==复制逐位、
 *     apv5-count/「共 N 行」三值、导出前后 fetchJSON 不变 =
 *     approvals.export.order.test.tsx（R231）单站全链已锁；
 *   window=7d+status 深链保参/不回填矩阵 = approvals.history.filters（R129 it①）；
 *   非法 window 不重写不进请求+空态出口 = R129 it③；
 *   空集导出 disabled+零 Blob = approvals.empty it② + export.bounds it①。
 * - 本文件补的缺口：无 status 裸 `?window=30d` 站点的计数同 Trio
 *   （apv5-count == 表体行 == apr-row-copy-* 数）与请求无 window=/status= 的
 *   现状锁；非法 window 站的页级锚在位 + 空态无裸 0 计数。
 */
import { act } from "react";
import { useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
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
import { selectDisabled, selectValue } from "@/shell/selectHarness";

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
  document.body.removeAttribute("data-r233-search");
});

function Probe() {
  const loc = useLocation();
  useEffect(() => {
    document.body.setAttribute("data-r233-search", loc.search);
  }, [loc.search]);
  return null;
}

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
        <Probe />
      </MemoryRouter>,
    );
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), `${entry} settled`);
}

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const lastSearch = () => document.body.getAttribute("data-r233-search") ?? "";
const rowIds = () =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap"]')).map(
    (el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""),
  );
/** 行末复制钮按数字尾计数（apr-row-copy-status/-fallback 同前缀，必须滤掉）。 */
const railCount = () =>
  Array.from(document.querySelectorAll("button")).filter((b) =>
    /^apr-row-copy-\d+$/.test(String(b.getAttribute("data-testid"))),
  ).length;

const W1 = {
  approvalId: "ap_w331",
  title: "窗口护栏一",
  status: "approved",
  riskLevel: "low",
  approvers: [{ userId: "human:7", name: "郑涛" }],
  requestId: "req-w331-1",
  createdAt: "2026-11-19T01:00:00Z",
  decidedAt: "2026-11-19T02:00:00Z",
};
const W2 = {
  approvalId: "ap_w332",
  title: "窗口护栏二",
  status: "approved",
  createdAt: "2026-11-19T03:00:00Z",
  decidedAt: "2026-11-19T04:00:00Z",
};

/** 默认（无 status）读口=两行；详情腿给空体保持安静。 */
function serveRows() {
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) return {};
    return { items: [W1, W2] };
  });
}

function serveEmpty() {
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) return {};
    return { items: [] };
  });
}

const listUrls = () =>
  mock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/api/approvals"));

describe("R233 history window guards", () => {
  it("① a bare ?window=30d deep link keeps the URL, never sends window, and the three counters agree with the rail", async () => {
    serveRows();
    await render("/approvals?tab=history&window=30d");
    // 请求参现状：不带 window=，也不带 status=（无深链 status 时产品不发该参）。
    const first = listUrls()[0] ?? "";
    expect(first, "window never rides the request").not.toContain("window=");
    expect(first).not.toContain("status=");
    // URL 不被前端改写（保参回放能力保留，R129 同款现状）。
    expect(lastSearch()).toBe("?tab=history&window=30d");
    // window 控件=摆设：恒 disabled、不被深链回填（wave-36 起在 ConsoleSelect 上，
    // 用 selectHarness 读真实载体状态，同 R129 it①）。
    expect(q("apv5-filter-window"), "window control exists").toBeTruthy();
    expect(selectDisabled("apv5-filter-window"), "window filter stays honestly disabled").toBe(true);
    expect(selectValue("apv5-filter-window"), "window is not backfilled").toBe("");
    // 三值同源：apv5-count == 表体行 == 行末复制钮数。
    await waitFor(() => rowIds().length === 2, "rows painted");
    expect(rowIds(), "both rows on screen").toEqual(["ap_w331", "ap_w332"]);
    const count = q("apv5-count")?.textContent ?? "";
    expect(count, "apv5-count matches the body rows").toBe(String(rowIds().length));
    expect(railCount(), "the copy rail follows the rows").toBe(rowIds().length);
    expect(count, "the counter is never a bare 0 while rows stand").not.toBe("0");
  });

  it("③ an unknown window value keeps the URL and the page anchor, and the empty answer shows no bare 0", async () => {
    serveEmpty();
    await render("/approvals?tab=history&window=__nope__");
    // 不改写 URL（未知值原样保留，可分享回放）。
    expect(lastSearch(), "URL keeps the unknown value verbatim").toBe(
      "?tab=history&window=__nope__",
    );
    for (const u of listUrls()) {
      expect(u).not.toContain("window=");
      expect(u).not.toContain("__nope__");
    }
    // 页级锚在位（工单点名 apv7-page 全 src 不存在，按现场实名断，差异见文件头）。
    expect(q("apr5-page-history"), "the page-level anchor is on screen").toBeTruthy();
    // 空态可读：面板与说明句在位；计数位不出现裸 0（apv5-count 只在有行的 ready
    // 站渲染，空站必须缺席而不是 0）。
    expect(q("apv-state-empty"), "empty panel present").toBeTruthy();
    expect(q("apv-state-empty-text")?.textContent).toContain("该条件下无审批");
    expect(q("apv5-count"), "no bare-zero counter on an empty answer").toBeNull();
  });
});
