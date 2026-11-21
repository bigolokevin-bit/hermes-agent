// @vitest-environment jsdom
/**
 * R267：审批详情抽屉「关联运行/任务」链接可达性与缺失态（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款，已覆盖只回证据:行）：
 *  - href 精确形态（/runs?run=<全 id> 与 /work?tab=board&task=<全 id>）
 *    = ApprovalsHistoryModulePage.test.tsx L520-521（R46 交付）与 L2014
 *    （R82 correlation 首锁 rid 形态站）已逐字锁死；
 *  - 缺失态载体 apd6-link-run-none/-task-none、「该段无记录」与 title 原因句
 *    = approvals.detail.edge2.test.tsx L188-193（R226 系）已锁。
 * 真增量：
 *  ①同帧三锁——Link 是真 <a>（href 前缀 /runs?run=，禁 javascript:/裸 # 形态）、
 *    title=完整内部 id、屏上文本=「运行 · shortRef」短码腿，点击不触发任何
 *    fetchJSON（计数不变；现场注记：href 携完整 id 作为查询参数属合法载体，
 *    工单「href 含短码」按现状映射为 屏上文本=短码 + href=全 id）；
 *  ②缺失站补「不渲 a」（apd6-link-run toBeNull）与屏上无 undefined/null/rn_/tk_ 裸 id；
 *  ③status 换代后重开抽屉：链接随该单换代、旧 href 不残留，apd7-back 关闭
 *    后无可聚焦关联链接残留（R244 自动关抽屉语义沿用）。
 */
import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { shortRef } from "@/modules/tasks/tasksBoard";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Button: ({ onClick, children, ...rest }: { onClick?: () => void; children?: ReactNode }) => (
    <button type="button" onClick={onClick} {...rest}>
      {children}
    </button>
  ),
  Card: ({ children, ...rest }: { children?: ReactNode; [k: string]: unknown }) => (
    <div {...(rest as Record<string, unknown>)}>{children}</div>
  ),
  CardContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import ApprovalsHistoryModulePage from "./ApprovalsHistoryModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let roots: Root[] = [];
let mounted: HTMLDivElement[] = [];

const clearScreen = (): void => {
  for (const root of roots) {
    act(() => {
      root.unmount();
    });
  }
  roots = [];
  for (const el of mounted) el.remove();
  mounted = [];
};

afterEach(() => {
  clearScreen();
  api.fetchJSON.mockReset();
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

async function render(entry = "/approvals?tab=history"): Promise<void> {
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
const text = (id: string): string => q(id)?.textContent ?? "";
const clicks = (): number => api.fetchJSON.mock.calls.length;

const clickTestId = async (id: string): Promise<void> => {
  const el = q(id) as HTMLButtonElement | null;
  expect(el, id).toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

const openDetail = async (id: string): Promise<void> => {
  const card = q(`apr5-row-${id}`) as HTMLElement | null;
  expect(card, `row ${id}`).toBeTruthy();
  await act(async () => {
    card!.click();
  });
  await waitFor(() => !!q("apr5-detail"), `detail of ${id}`);
};

const RUN_A = "rn_lk2026alphafull";
const TASK_A = "tk_lk2026alphafull";
const LK1 = {
  approvalId: "ap_lk1",
  title: "链接可达性验证单",
  status: "approved",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
  requestId: "req-lk-11112222",
  runId: RUN_A,
  taskId: TASK_A,
  approvers: [{ userId: "human:7", name: "郑涛" }],
  decisions: [{ approver: "human:7", name: "郑涛", decision: "approve", at: "2026-11-19T02:00:00Z" }],
};
const LK2 = {
  approvalId: "ap_lk2",
  title: "无关联单",
  status: "approved",
  riskLevel: "low",
  decidedAt: "2026-11-19T03:00:00Z",
  createdAt: "2026-11-18T02:00:00Z",
};
const LKA = {
  approvalId: "ap_lk3a",
  title: "换代前单",
  status: "pending",
  runId: "rn_alpha9",
  createdAt: "2026-11-18T04:00:00Z",
};
const LKB = {
  approvalId: "ap_lk3b",
  title: "换代后单",
  status: "approved",
  runId: "rn_beta9",
  createdAt: "2026-11-18T05:00:00Z",
};

const serve = (rows: Array<Record<string, unknown>>): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = rows.find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    return { items: rows };
  });
};

describe("R267 approvals detail link reachability guards", () => {
  it("renders real anchors with the full id in title, a masked short code on screen, and clicking asks for nothing", async () => {
    serve([LK1, LK2]);
    await render("/approvals?tab=history");
    await openDetail("ap_lk1");
    const run = q("apd6-link-run") as HTMLAnchorElement | null;
    expect(run, "run link").toBeTruthy();
    expect(run!.tagName, "real anchor not a button").toBe("A");
    const href = run!.getAttribute("href") ?? "";
    expect(href.startsWith("/runs?run="), "real href, never javascript:/bare #").toBe(true);
    expect(href.includes("#"), "no bare hash").toBe(false);
    // 现场映射：href 携带完整 runId 作为查询参数（R46/R82 契约），
    // 「短码」腿在屏上文本：运行 · shortRef(全 id)
    expect(href).toContain(encodeURIComponent(RUN_A));
    expect(run!.getAttribute("title"), "title gives the full id").toBe(RUN_A);
    expect(text("apd6-link-run")).toContain(`运行 · ${shortRef(RUN_A)}`);
    const task = q("apd6-link-task") as HTMLAnchorElement | null;
    expect(task!.getAttribute("href") ?? "").toContain(encodeURIComponent(TASK_A));
    expect(task!.getAttribute("title")).toBe(TASK_A);
    const before = clicks();
    await act(async () => {
      run!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(clicks(), "the link click itself fetches nothing").toBe(before);
    expect(
      api.fetchJSON.mock.calls.some((c) => String(c[0]).includes("/api/runs")),
      "no run leg was ever asked",
    ).toBe(false);
  });

  it("keeps the missing-association station free of anchors and raw internal ids", async () => {
    serve([LK1, LK2]);
    await render("/approvals?tab=history");
    await openDetail("ap_lk2");
    expect(q("apd6-link-run"), "no run anchor when the field is absent").toBeNull();
    expect(q("apd6-link-task"), "no task anchor when the field is absent").toBeNull();
    expect(q("apd6-link-run-none"), "gap carrier present").toBeTruthy();
    expect(text("apd6-link-run-none")).toContain("该段无记录");
    const drawer = q("apr5-detail")?.textContent ?? "";
    expect(drawer).not.toMatch(/undefined|null/);
    expect(drawer).not.toContain(RUN_A);
    expect(drawer).not.toContain(TASK_A);
  });

  it("swaps the association link with the record after a status change and leaves nothing focusable once closed", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) {
        const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
        const row = [LKA, LKB].find((r) => r.approvalId === id);
        return row ? { ...row } : {};
      }
      if (u.includes("status=approved")) return { items: [LKB] };
      return { items: [LKA] };
    });
    await render("/approvals?tab=history&status=pending");
    await openDetail("ap_lk3a");
    expect((q("apd6-link-run") as HTMLAnchorElement).getAttribute("href") ?? "").toContain("rn_alpha9");
    // 切 status（服务端维）→ 抽屉自动关（R244 语义）→ 重开换代单
    await clickTestId("apr5-filter-approved");
    await waitFor(() => !q("apr5-detail"), "drawer auto-closed on status switch");
    await openDetail("ap_lk3b");
    const href = (q("apd6-link-run") as HTMLAnchorElement).getAttribute("href") ?? "";
    expect(href).toContain("rn_beta9");
    expect(href).not.toContain("rn_alpha9");
    expect(q("apr5-detail")?.textContent ?? "").not.toContain("rn_alpha9");
    await clickTestId("apd7-back");
    await waitFor(() => !q("apr5-detail"), "drawer closed");
    expect(q("apd6-link-run"), "no focusable association link after closing").toBeNull();
  });
});
