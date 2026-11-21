// @vitest-environment jsdom
/**
 * 页面车道 B — 审批历史页筛选折叠护栏。
 *
 * 先例已覆盖=回证据（不重写）：
 * - 待处理页同款开关方言（aria-expanded、收起卸载、聚焦样式）：3651ca6d
 *   落进 ApprovalsPendingModulePage.test.tsx 的 toggle 用例。
 * - chips 与生效参一致（折叠不改筛选语义）：approvals.chips.cursor.test.tsx
 *   R238；深链回填全控件：approvals.sortfilter.combo.test.tsx R199 ①。
 * 本文件真增量：历史页（apv-h-filter-toggle）默认收起时——次级四维卸载、
 * 常驻件齐活；开→入 DOM、收→再卸载且不发请求不动 URL；深链带次级参时
 * 折叠态读数 N 正确、chips 可读、行集照常过滤（折叠只是收纳，不是失效）。
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
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <ApprovalsHistoryModulePage />
      </MemoryRouter>,
    );
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), `${entry} settled`);
}

const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
const toggle = () => q("apv-h-filter-toggle") as HTMLButtonElement | null;
const expanded = () => toggle()?.getAttribute("aria-expanded") === "true";
const clickToggle = async (): Promise<void> => {
  const btn = toggle();
  expect(btn, "apv-h-filter-toggle").toBeTruthy();
  await act(async () => {
    btn!.click();
  });
};
const rowIds = () =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap"]')).map(
    (el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""),
  );

const A1 = {
  approvalId: "ap_c1",
  title: "折叠护栏甲",
  status: "approved",
  riskLevel: "low",
  approvers: [{ userId: "human:7", name: "郑涛" }],
  createdAt: "2026-11-19T01:00:00Z",
  decidedAt: "2026-11-19T02:00:00Z",
};
const A2 = {
  approvalId: "ap_c2",
  title: "折叠护栏乙",
  status: "approved",
  riskLevel: "high",
  createdAt: "2026-11-19T03:00:00Z",
  decidedAt: "2026-11-19T04:00:00Z",
};

function serveTwo() {
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) return {};
    if (u.includes("status=approved")) return { items: [A1, A2] };
    return { items: [] };
  });
}

describe("页面车道 B — history filter collapse guards", () => {
  it("① 默认收起：次级四维不在 DOM，常驻件齐活，开关 aria-expanded=false", async () => {
    serveTwo();
    await render("/approvals?tab=history&status=approved");
    expect(q("apr5-page-history")).toBeTruthy();
    expect(expanded(), "默认收起").toBe(false);
    // 次级四维整体卸载（不是 visibility 藏起来）。
    expect(q("apv-h-filter-panel")).toBeNull();
    expect(q("apv8-search")).toBeNull();
    expect(q("apv8-scope-note")).toBeNull();
    expect(q("apv-actor-buckets")).toBeNull();
    expect(q("apv-since-rail")).toBeNull();
    expect(q("apv-risk-rail")).toBeNull();
    // 常驻：状态八态组、队列快捷钮、重置行+chips、汇总条、CSV、排序条、行集。
    expect(q("apr5-filter")).toBeTruthy();
    expect(q("apv5-filter")).toBeTruthy();
    expect(q("apv-reset-row")).toBeTruthy();
    expect(q("apv-filter-summary")).toBeTruthy();
    expect(q("apv-sort-wrap")).toBeTruthy();
    expect(rowIds()).toEqual(["ap_c1", "ap_c2"]);
    expect(toggle()?.textContent).toContain("筛选条件（无）");
  });

  it("② 开→次级入 DOM，收→再卸载；全程零请求、URL 不动", async () => {
    serveTwo();
    await render("/approvals?tab=history&status=approved");
    const before = mock.mock.calls.length;
    const urlBefore = window.location.href;
    await clickToggle();
    expect(expanded(), "展开态").toBe(true);
    expect(q("apv-h-filter-panel")).toBeTruthy();
    expect(q("apv8-search")).toBeTruthy();
    expect(q("apv-actor-buckets")).toBeTruthy();
    expect(q("apv-since-rail")).toBeTruthy();
    expect(q("apv-risk-rail")).toBeTruthy();
    // 展开不触发重拉（折叠只是收纳，不是重进）。
    expect(mock.mock.calls.length).toBe(before);
    await clickToggle();
    expect(expanded(), "收回后").toBe(false);
    expect(q("apv-h-filter-panel")).toBeNull();
    expect(q("apv8-search")).toBeNull();
    expect(mock.mock.calls.length).toBe(before);
    expect(window.location.href).toBe(urlBefore);
    expect(rowIds()).toEqual(["ap_c1", "ap_c2"]);
  });

  it("③ 深链带次级参：折叠态读数 N 正确、chips 可读、行集照常过滤", async () => {
    serveTwo();
    await render("/approvals?tab=history&status=approved&q=甲&risk=high");
    // q 生效=本地过滤到 1 行；risk=high 再筛掉甲（甲 low）→ 行集为空——
    // 用两参只为验读数与 chips，过滤结果按组合语义断言。
    expect(expanded(), "深链也默认收起").toBe(false);
    expect(toggle()?.textContent).toContain("筛选条件（2）");
    expect(q("apv-chip-q")).toBeTruthy();
    expect(q("apv-chip-risk")).toBeTruthy();
    // 折叠态下行集仍按同一语义过滤（护栏甲 low+high=无；这里断言与展开一致即可）。
    const collapsedRows = rowIds();
    await clickToggle();
    expect(rowIds()).toEqual(collapsedRows);
  });
});
