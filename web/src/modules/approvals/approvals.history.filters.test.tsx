// @vitest-environment jsdom
/**
 * R129 — 审批历史页时间窗口与状态筛选 URL 保参护栏（纯测试，零产品改动）。
 *
 * 现场裁决（按现状记录，禁臆造行为；先 git grep 现查过覆盖）：
 * - `window` 参现状=摆设：apv5-filter-window select 恒 disabled（诚实 title
 *   带实测），深链 `?window=` 不回填、不进请求、URL 不被改写；「改窗口只改
 *   window」不可执行，②按 status 维等价断（切状态其余参不动、新请求无
 *   cursor= 回第一页）。status 维「回填控件」=八态组 aria-pressed 投影。
 * - `apv7-back`（工单点名）全 src grep=0 —— 现场按 apv7-export（CSV 钮）与
 *   apv-state-clear（空态出口）断言，差异在此注明。
 * - 已覆盖不重写：export==count==行数 同源（wave-29 ①）、chips==URL==请求
 *   （R98）、游标翻页去重（R79）、status 移除 refetch 无 cursor（R90）、
 *   window disabled+title（R44 rail 用例 L230）。本文件补的是深链 window
 *   保参矩阵、非法值不改写、重挂逐字相等、翻页后切状态回第一页的集中锁。
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
  document.body.removeAttribute("data-r129-search");
});

function Probe() {
  const loc = useLocation();
  useEffect(() => {
    document.body.setAttribute("data-r129-search", loc.search);
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
const lastSearch = () => document.body.getAttribute("data-r129-search") ?? "";
const rowIds = () =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap"]')).map(
    (el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""),
  );

const H1 = {
  approvalId: "ap_h129",
  title: "历史护栏一",
  status: "approved",
  riskLevel: "low",
  approvers: [{ userId: "human:7", name: "郑涛" }],
  requestId: "req-h129-1",
  createdAt: "2026-11-19T01:00:00Z",
  decidedAt: "2026-11-19T02:00:00Z",
};
const H2 = {
  approvalId: "ap_h130",
  title: "历史护栏二",
  status: "approved",
  createdAt: "2026-11-19T03:00:00Z",
  decidedAt: "2026-11-19T04:00:00Z",
};
const H3 = {
  approvalId: "ap_h131",
  title: "历史护栏三",
  status: "approved",
  createdAt: "2026-11-18T03:00:00Z",
  decidedAt: "2026-11-18T05:00:00Z",
};

/** approved=第一页两行带游标；cursor=第二页一行；其余状态=空。 */
function servePaged() {
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) return {};
    if (u.includes("cursor=")) return { items: [H3] };
    if (u.includes("status=approved")) return { items: [H1, H2], nextCursor: "cg-r129" };
    return { items: [] };
  });
}

/** approved=空集（非法/空态分支用）；其余=空。 */
function serveEmpty() {
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) return {};
    return { items: [] };
  });
}

const listUrls = () =>
  mock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/api/approvals"));

/** 同用例内二次挂载前清掉第一实例（afterEach 只在用例间清）。 */
const clearScreen = async (): Promise<void> => {
  for (const root of roots) {
    await act(async () => {
      root.unmount();
    });
  }
  roots = [];
  for (const el of mounted) el.remove();
  mounted = [];
  document.body.removeAttribute("data-r129-search");
};

describe("R129 history filter url guards", () => {
  it("① a deep link keeps window verbatim in the URL, sends only whitelisted params, and never backfills the window control", async () => {
    servePaged();
    await render("/approvals?tab=history&window=7d&status=approved");
    // 请求参逐字=服务端白名单：带 status，不带 window=/cursor=。
    const first = listUrls()[0] ?? "";
    expect(first).toContain("status=approved");
    expect(first).not.toContain("window=");
    expect(first).not.toContain("cursor=");
    // window 控件=摆设：恒 disabled、不被深链回填（现状记录，非缺陷修复）。
    const win = q("apv5-filter-window");
    expect(win, "window control exists").toBeTruthy();
    // wave-36 moved this control onto ConsoleSelect, so the trigger is a BUTTON:
    // `.disabled` is still real, but `.value` on a button is ALWAYS the empty
    // string — the old 「not backfilled」 claim had stopped testing anything.
    // `data-value` is what the control actually holds.
    expect(selectDisabled("apv5-filter-window"), "window filter stays honestly disabled").toBe(true);
    expect(selectValue("apv5-filter-window"), "window is not backfilled").toBe("");
    // URL 不被前端改写（保参回放能力保留）。
    expect(lastSearch()).toBe("?tab=history&window=7d&status=approved");
    // status 维「回填」=八态组高亮投影。
    expect(q("apr5-filter-approved")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("② switching status keeps the other params and refetches page one without a cursor", async () => {
    servePaged();
    await render("/approvals?tab=history&window=7d&status=approved");
    const more = q("apv-page-more") as HTMLButtonElement | null;
    expect(more, "cursor enables page two").toBeTruthy();
    await act(async () => {
      more!.click();
    });
    await waitFor(() => rowIds().includes("ap_h131"), "page two appended");
    expect(listUrls().at(-1), "page two rides the cursor").toContain("cursor=cg-r129");
    const before = listUrls().length;

    const btn = q("apr5-filter-pending") as HTMLButtonElement | null;
    expect(btn, "eight-state group has pending").toBeTruthy();
    await act(async () => {
      btn!.click();
    });
    await waitFor(() => listUrls().length === before + 1, "status switch refetched once");
    const next = listUrls().at(-1) ?? "";
    expect(next).toContain("status=pending");
    expect(next, "returning to page one drops the cursor").not.toContain("cursor=");
    // 其余参不动=URL 保留 tab 与 window；游标是服务端续页态不落 URL。
    expect(lastSearch()).toBe("?tab=history&window=7d&status=pending");
    expect(rowIds(), "empty answer clears loaded pages").toHaveLength(0);
  });

  it("③ an unknown window value is neither rewritten away nor sent, and the empty state stays readable with its exits", async () => {
    serveEmpty();
    await render("/approvals?tab=history&window=__nope__&status=approved");
    expect(lastSearch(), "URL keeps the unknown value verbatim").toBe(
      "?tab=history&window=__nope__&status=approved",
    );
    for (const u of listUrls()) {
      expect(u).not.toContain("window=");
      expect(u).not.toContain("__nope__");
    }
    // 可读空态：apv-state 空集族 + 清筛选出口；apv7 导出钮在但 disabled
    //（工单点名的 apv7-back 全 src 不存在，按现场载体断言并在文件头注明）。
    expect(q("apv-state-empty"), "empty panel present").toBeTruthy();
    expect(q("apv-state-empty-text")?.textContent).toContain("该条件下无审批");
    expect(q("apv-state-clear"), "clear exit present").toBeTruthy();
    const exportBtn = q("apv7-export") as HTMLButtonElement | null;
    expect(exportBtn, "export control exists").toBeTruthy();
    expect(exportBtn!.disabled, "nothing to export on an empty answer").toBe(true);
  });

  it("④⑤ remounting the same URL repeats byte-identical requests and row/export/count agree with zero extra fetches", async () => {
    servePaged();
    await render("/approvals?tab=history&window=7d&status=approved");
    const urlsA = listUrls();
    expect(urlsA).toHaveLength(1);

    const callsBefore = mock.mock.calls.length;
    await clearScreen();
    servePaged();
    await render("/approvals?tab=history&window=7d&status=approved");
    const urlsB = mock.mock.calls
      .slice(callsBefore)
      .map((c) => String(c[0]))
      .filter((u) => u.includes("/api/approvals"));
    expect(urlsB, "remount issues exactly one list query").toHaveLength(1);
    expect(urlsB[0], "same URL replays the same query").toBe(urlsA[0]);

    // 行数 == apv5-count == 导出读数（三者同源；复制钮随行同序在 R127 已锁）。
    expect(rowIds()).toEqual(["ap_h129", "ap_h130"]);
    expect(q("apv5-count")?.textContent).toBe("2");
    expect(q("apv7-export-count")?.textContent).toBe("共 2 行");

    // ⑤前后计数不变：翻页前的读取不产生额外请求（详情/导出腿零请求）。
    const before = listUrls().length;
    const exportBtn = q("apv7-export") as HTMLButtonElement;
    expect(exportBtn.disabled).toBe(false);
    const orig = URL.createObjectURL;
    URL.createObjectURL = (() => "blob:r129") as typeof URL.createObjectURL;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    try {
      await act(async () => {
        exportBtn.click();
      });
    } finally {
      URL.createObjectURL = orig;
      clickSpy.mockRestore();
    }
    expect(listUrls().length, "exporting never refetches").toBe(before);
  });
});
