// @vitest-environment jsdom
/**
 * R92 — 口径回归护栏（纯测试，不改产品行为）。
 *
 * 锁三件事：
 * ①员工审批区（ed8）聚合口径行在、不伪造「加载更多」、队列去处 href 真值；
 * ②FilterReset 的 FILTER_PARAM_KEYS 与 FilterSummary 的 chip 移除键集合
 *   完全相等（单点参数表，禁两套），且 status 维 refetch / 本地维零请求；
 * ③无筛选时 apv-filter-summary 整条不渲染、apv-reset-filters 的 disabled
 *   title 与 RESET_NONE_TITLE 逐字相等（import 值非硬编码）。
 *
 * 注：①里口径载体的本仓形态是 data-testid="ed8-appr-scope"（工单所写
 * data-ed8-appr-scope 属性名在 DOM 形态中不存在；ed 模块不在本单写域，
 * 按 testid 判等义——DONE 记录）。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
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
import EmployeeDetailModulePage from "@/modules/employee-detail/EmployeeDetailModulePage";
import ApprovalsHistoryModulePage from "@/modules/approvals/ApprovalsHistoryModulePage";
import {
  FILTER_PARAM_KEYS,
  RESET_NONE_TITLE,
  hasActiveFilters,
} from "@/modules/approvals/FilterReset";
import { chipsFor } from "@/modules/approvals/FilterSummary";
import { ApiError } from "@/lib/api-error";
import {
  APPROVAL_DENIED_BODY,
  APPROVAL_DENIED_TITLE,
  APPROVAL_EMPTY_SENTENCE,
  APPROVAL_FAILED_TITLE,
} from "@/modules/approvals/stateCopy";

const mock = vi.mocked(fetchJSON);
const EMP = "emp_A3F1B2C4D5E6";

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

function serve(items: unknown[]) {
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approvals")) return { items };
    if (u.includes("/api/approval?id=")) return {};
    return {};
  });
}

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const approvalsUrlCount = () =>
  mock.mock.calls.filter((c) => String(c[0]).includes("/api/approvals")).length;

describe("R92 ① ed8 aggregate cap sentence", () => {
  it("states the fixed page cap, never fakes 加载更多, and links to the queue", async () => {
    serve([
      { approvalId: "ap_c92a", title: "口径护栏", status: "pending", createdAt: "2026-11-19T02:00:00Z" },
    ]);
    await renderInto(`/employees/${encodeURIComponent(EMP)}?zone=approvals`, <EmployeeDetailModulePage employeeId={EMP} />);
    const scope = q("ed8-appr-scope");
    expect(scope, "cap sentence on screen").toBeTruthy();
    expect(scope?.textContent).toContain("本区按聚合口径读取，单页最多 20 条");
    expect(scope?.getAttribute("title")).toContain("nextCursor 恒 null");
    expect(q("ed8-appr-more"), "no fake paging control").toBeNull();
    expect(document.body.textContent).not.toContain("加载更多");
    const queue = q("ed8-appr-scope-queue") as HTMLAnchorElement | null;
    expect(queue, "real queue exit").toBeTruthy();
    expect(queue!.getAttribute("href")).toBe("/approvals?status=all");
  });
});

describe("R92 ② one parameter table", () => {
  it("chip removal keys flatten exactly onto FILTER_PARAM_KEYS", () => {
    const params = new URLSearchParams(
      "status=pending&q=%E9%A2%84%E7%AE%97&actor=human%3A7&since=24h&risk=purple&asort=title&adir=desc",
    );
    const flat = chipsFor(params)
      .flatMap((chip) => [...chip.remove])
      .sort();
    expect(flat).toEqual([...FILTER_PARAM_KEYS].sort());
    expect(chipsFor(new URLSearchParams("tab=history&state=error"))).toHaveLength(0);
    const sortChip = chipsFor(new URLSearchParams("asort=title&adir=desc")).find((c) => c.key === "sort");
    expect([...(sortChip?.remove ?? [])].sort()).toEqual(["adir", "asort"]);
  });

  it("unknown purple stays verbatim with the 未被识别 title", async () => {
    serve([{ approvalId: "ap_c92b", title: "带风险", status: "pending", riskLevel: "low" }]);
    await renderInto("/approvals?tab=history&risk=purple", <ApprovalsHistoryModulePage />);
    await waitFor(() => !!q("apv-chip-risk"), "risk chip");
    expect(q("apv-chip-risk")?.textContent).toContain("purple");
    expect(q("apv-chip-risk")?.getAttribute("title")).toContain("该值未被识别");
  });

  it("status removal refetches exactly once without cursor; local chips refetch nothing", async () => {
    serve([
      { approvalId: "ap_c92c", title: "组合行", status: "approved", riskLevel: "high", createdAt: "2026-11-19T02:00:00Z" },
      { approvalId: "ap_c92d", title: "组合行二", status: "pending", createdAt: "2026-11-19T03:00:00Z" },
    ]);
    await renderInto(
      "/approvals?tab=history&status=pending&actor=human%3A7&since=24h&risk=high&asort=title&adir=asc",
      <ApprovalsHistoryModulePage />,
    );
    await waitFor(() => !!q("apv-chip-status"), "chips rendered");
    const n0 = approvalsUrlCount();
    for (const key of ["actor", "since", "risk", "sort"]) {
      await act(async () => {
        (q(`apv-chip-remove-${key}`) as HTMLButtonElement).click();
      });
      expect(approvalsUrlCount(), `local chip ${key} never refetches`).toBe(n0);
    }
    await act(async () => {
      (q("apv-chip-remove-status") as HTMLButtonElement).click();
    });
    await waitFor(() => approvalsUrlCount() === n0 + 1, "status removal refetches once");
    const fresh = mock.mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.includes("/api/approvals"))
      .slice(-1)[0];
    expect(fresh).not.toContain("status=");
    expect(fresh).not.toContain("cursor=");
    await waitFor(() => !q("apv-filter-summary"), "summary gone after last chip");
    expect(q("apv-reset-filters")?.getAttribute("title")).toBe(RESET_NONE_TITLE);
  });
});

describe("R92 ③ idle state", () => {
  it("no filters: the summary row is not rendered and reset carries the single-source sentence", async () => {
    serve([{ approvalId: "ap_c92e", title: "干净页", status: "pending", createdAt: "2026-11-19T02:00:00Z" }]);
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await waitFor(() => !!q("apr5-row-ap_c92e"), "row ready");
    expect(q("apv-filter-summary"), "summary absent without filters").toBeNull();
    const btn = q("apv-reset-filters") as HTMLButtonElement | null;
    expect(btn, "reset button present").toBeTruthy();
    expect(btn!.disabled).toBe(true);
    expect(btn!.getAttribute("title")).toBe(RESET_NONE_TITLE);
    expect(hasActiveFilters(new URLSearchParams("tab=history")).active).toBe(false);
  });
});

describe("R93 approvals zone ↔ queue state sentences (same failure, same words)", () => {
  const q = (id: string) => document.querySelector(`[data-testid="${id}"]`);
  const down = () => {
    vi.mocked(fetchJSON).mockImplementation((url: unknown) =>
      Promise.reject(
        new ApiError("boom", { status: 500, body: "{}", url: String(url), requestId: "req-r93-caliber" }),
      ),
    );
  };
  const deniedBoth = () => {
    vi.mocked(fetchJSON).mockImplementation((url: unknown) =>
      Promise.reject(new ApiError("forbidden", { status: 403, body: "", url: String(url) })),
    );
  };

  it("failure first sentence is byte-equal on both surfaces", async () => {
    down();
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    const queueSentence = q("apv-state-error")?.querySelector("span")?.textContent ?? "";
    expect(queueSentence).toBe(APPROVAL_FAILED_TITLE);
    down();
    await renderInto(`/employees/${encodeURIComponent(EMP)}?zone=approvals`, <EmployeeDetailModulePage employeeId={EMP} />);
    const edSentence = q("ed5-approvals-error")?.querySelector("p")?.textContent ?? "";
    expect(edSentence).toBe(queueSentence);
  });

  it("denied title and body are byte-equal on both surfaces", async () => {
    deniedBoth();
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    const queuePs = Array.from(q("apv-state-denied")?.querySelectorAll("p") ?? []);
    expect(queuePs[0]?.textContent).toBe(APPROVAL_DENIED_TITLE);
    expect(queuePs[1]?.textContent).toBe(APPROVAL_DENIED_BODY);
    deniedBoth();
    await renderInto(`/employees/${encodeURIComponent(EMP)}?zone=approvals`, <EmployeeDetailModulePage employeeId={EMP} />);
    const edPs = Array.from(q("ed5-approvals-denied")?.querySelectorAll("p") ?? []);
    expect(edPs[0]?.textContent).toBe(queuePs[0]?.textContent);
    expect(edPs[1]?.textContent).toBe(queuePs[1]?.textContent);
  });

  it("the empty sentence is the shared prefix on both surfaces", async () => {
    vi.mocked(fetchJSON).mockImplementation(async () => ({ items: [] }));
    await renderInto("/approvals?tab=history&status=cancelled", <ApprovalsHistoryModulePage />);
    expect(q("apv-state-empty-text")?.textContent).toContain(APPROVAL_EMPTY_SENTENCE);
    vi.mocked(fetchJSON).mockImplementation(async () => ({ items: [] }));
    await renderInto(`/employees/${encodeURIComponent(EMP)}?zone=approvals`, <EmployeeDetailModulePage employeeId={EMP} />);
    expect(q("ed5-approvals-empty")?.querySelector("p")?.textContent).toBe(APPROVAL_EMPTY_SENTENCE);
  });
});
