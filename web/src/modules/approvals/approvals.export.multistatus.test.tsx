// @vitest-environment jsdom
/**
 * R246：审批导出的多状态一致性（纯测试，零产品改动）。
 *
 * 已覆盖只回证据（不写重复用例）：
 *  - approved 站「CSV status 列==屏上徽标人话逐字 + 行数==表体==apv5-count」
 *    = approvals.export.filter.test.tsx it①（R182）；
 *  - 导出前后 fetchJSON 不变 = R182 it②/R235/R243；空集强点零 Blob = R229 it①
 *    （已知 pending-0 站）；翻页后切 status 重置游标 = R245 it②。
 * 本文件缺口：
 *  ① rejected 站的 status 列==屏上徽标人话逐字对照（R182 只测 approved 站）；
 *  ② pending 站先导出、切 approved 再导出：两次 CSV 各自只含本站行、互不
 *    残留、每步计数（R235 it② 是翻页后切 pending 的反向单导出站）；
 *  ③ 未知 ?status=__nope__ 透传空站三件套组合：导出 disabled+title、强点零
 *    Blob 零请求、apv5-count 不渲染（现状锁；R229 是已知状态空站、R233 是
 *    非法 window 站，未知 status 站的导出闸未锁）。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Button: ({ onClick, children, ...rest }: { onClick?: () => void; children?: React.ReactNode }) => (
    <button type="button" onClick={onClick} {...rest}>
      {children}
    </button>
  ),
  Card: ({ children, ...rest }: { children?: React.ReactNode }) => <div {...rest}>{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

import ApprovalsHistoryModulePage from "./ApprovalsHistoryModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// 行集按 status 站拆分；id 前缀统一 ap_ms，行选择器不撞其他文件。
const P1 = { approvalId: "ap_msp1", title: "待定一件", status: "pending", createdAt: "2026-11-19T01:00:00Z" };
const P2 = { approvalId: "ap_msp2", title: "待定二件", status: "pending", createdAt: "2026-11-19T01:10:00Z" };
const A1 = { approvalId: "ap_msa1", title: "已批一件", status: "approved", createdAt: "2026-11-19T02:00:00Z", decidedAt: "2026-11-19T03:00:00Z" };
const A2 = { approvalId: "ap_msa2", title: "已批二件", status: "approved", createdAt: "2026-11-19T02:10:00Z", decidedAt: "2026-11-19T03:10:00Z" };
const R1 = { approvalId: "ap_msr1", title: "驳回一件", status: "rejected", riskLevel: "high", createdAt: "2026-11-19T04:00:00Z", decidedAt: "2026-11-19T05:00:00Z" };
const R2 = { approvalId: "ap_msr2", title: "驳回二件", status: "rejected", createdAt: "2026-11-19T04:10:00Z", decidedAt: "2026-11-19T05:10:00Z" };

function serveStations(): void {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) return {};
    if (u.includes("status=pending")) return { items: [P1, P2] };
    if (u.includes("status=approved")) return { items: [A1, A2] };
    if (u.includes("status=rejected")) return { items: [R1, R2] };
    if (u.includes("status=__nope__")) return { items: [] };
    return { items: [] };
  });
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

async function waitFor(condition: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 3000;
  for (;;) {
    let done = false;
    await act(async () => {
      done = condition();
      if (!done) await new Promise((resolve) => setTimeout(resolve, 5));
    });
    if (done) return;
    if (Date.now() > deadline) throw new Error(`waitFor: ${label} never became true`);
  }
}

async function render(entry: string): Promise<void> {
  if (root) root.unmount();
  container?.remove();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <ApprovalsHistoryModulePage />
      </MemoryRouter>,
    );
  });
  await waitFor(() => document.querySelectorAll(".animate-pulse").length === 0, "reads settled");
}

function q(testId: string): HTMLElement | null {
  return container?.querySelector(`[data-testid="${testId}"]`) ?? null;
}

function rowIds(): string[] {
  return Array.from(container?.querySelectorAll('[data-testid^="apr5-row-ap_ms"]') ?? []).map(
    (node) => node.getAttribute("data-testid")?.slice("apr5-row-".length) ?? "",
  );
}

/** 行状态徽标（R168/R182 公式：标题钮所在行的最后一个子元素）。 */
function rowBadge(id: string): string {
  const title = q(`apv-trunc-row-title-${id}`);
  const btn = title?.closest("button");
  return btn?.parentElement?.lastElementChild?.textContent ?? "";
}

function listCalls(): string[] {
  return api.fetchJSON.mock.calls.map((call: unknown[]) => String(call[0])).filter((u: string) => u.includes("/api/approvals"));
}

function clickIn(testId: string): void {
  const node = q(testId);
  if (!node) throw new Error(`找不到 ${testId}`);
  node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

/** 拦一次导出，返回 CSV 非空逻辑行（首行=表头）；断言导出零取数由调用方计。 */
async function grabCsvLines(): Promise<string[]> {
  const captured: Blob[] = [];
  const orig = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  URL.createObjectURL = ((blob: Blob) => {
    captured.push(blob);
    return "blob:appr246";
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  const clicks = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  try {
    const btn = q("apv7-export") as HTMLButtonElement | null;
    expect(btn, "export button").toBeTruthy();
    await act(async () => {
      btn!.click();
    });
  } finally {
    URL.createObjectURL = orig;
    URL.revokeObjectURL = origRevoke;
    clicks.mockRestore();
  }
  expect(captured).toHaveLength(1);
  const text = await captured[0].text();
  return text.replace(/^\uFEFF/, "").split("\r\n").filter((l) => l !== "");
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  api.fetchJSON.mockReset();
});

describe("approvals.export.multistatus (R246)", () => {
  it("① rejected 站：CSV status 列逐行==屏上徽标人话，行数==表体==apv5-count", async () => {
    serveStations();
    await render("/approvals?tab=history&status=rejected");
    await waitFor(() => rowIds().length === 2, "rejected rows ready");
    const leg = listCalls();
    expect(leg.every((u) => u.includes("status=rejected")), leg.join("|")).toBe(true);

    const callsBefore = api.fetchJSON.mock.calls.length;
    const csv = await grabCsvLines();
    expect(csv[0], "列头契约现状（R107）").toBe("id,title,status,risk,updated_at,correlation,rid");
    const dataRows = csv.slice(1);
    expect(dataRows.length, "CSV 数据行数==表体行数").toBe(rowIds().length);
    expect(q("apv5-count")?.textContent, "apv5-count==行数").toBe(String(rowIds().length));
    for (const id of rowIds()) {
      const line = dataRows.find((l) => l.startsWith(`${id},`));
      expect(line, `csv row ${id}`).toBeTruthy();
      const badge = rowBadge(id);
      expect(badge.length, "屏上状态人话非空").toBeGreaterThan(0);
      expect(line!.split(",")[2], `CSV status 列==屏上 label（${id}）`).toBe(badge);
      expect(line!.split(",")[2], "不写枚举原词").not.toBe("rejected");
    }
    expect(api.fetchJSON.mock.calls.length, "导出零额外请求").toBe(callsBefore);
  });

  it("② pending 站先导出，切 approved 再导出：两次各只含本站行、互不残留、每步计数", async () => {
    serveStations();
    await render("/approvals?tab=history&status=pending");
    await waitFor(() => rowIds().join(",") === "ap_msp1,ap_msp2", "pending rows ready");

    const csv1 = await grabCsvLines();
    const ids1 = csv1.slice(1).map((l) => l.split(",")[0]);
    expect(ids1.sort(), "第一次导出=pending 站行集").toEqual(["ap_msp1", "ap_msp2"]);
    expect(csv1.join("\n"), "第一次导出不残留 approved 行").not.toContain("ap_msa");

    const beforeSwitch = api.fetchJSON.mock.calls.length;
    clickIn("apv5-filter-status-approved");
    await waitFor(() => rowIds().join(",") === "ap_msa1,ap_msa2", "approved station replaced rows");
    const fresh = listCalls().slice(-1)[0];
    expect(fresh, "切换恰 1 次新取数").toContain("status=approved");
    expect(api.fetchJSON.mock.calls.length, "切换只多一条列表请求").toBe(beforeSwitch + 1);

    const csv2 = await grabCsvLines();
    const ids2 = csv2.slice(1).map((l) => l.split(",")[0]);
    expect(ids2.sort(), "第二次导出=approved 站行集").toEqual(["ap_msa1", "ap_msa2"]);
    expect(csv2.join("\n"), "第二次导出不残留 pending 行").not.toContain("ap_msp");
    expect(api.fetchJSON.mock.calls.length, "第二次导出零额外请求").toBe(beforeSwitch + 1);
  });

  it("③ 未知 ?status=__nope__ 透传空站：导出 disabled+title、强点零 Blob 零请求、apv5-count 不渲染（现状锁）", async () => {
    serveStations();
    await render("/approvals?tab=history&status=__nope__");
    await waitFor(() => rowIds().length === 0, "empty unknown-status station");

    expect(q("apv5-count"), "现状：空/未识别站不渲染 apv5-count（非假 0）").toBeNull();
    const btn = q("apv7-export") as HTMLButtonElement | null;
    expect(btn, "导出钮在位").toBeTruthy();
    expect(btn!.disabled, "未知空站导出 disabled").toBe(true);
    expect((btn!.title ?? "").length, "disabled 带原因句 title").toBeGreaterThan(0);

    const capturedBlobs: unknown[] = [];
    const orig = URL.createObjectURL;
    URL.createObjectURL = ((blob: unknown) => {
      capturedBlobs.push(blob);
      return "blob:noop";
    }) as typeof URL.createObjectURL;
    const clicks = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const before = api.fetchJSON.mock.calls.length;
    try {
      await act(async () => {
        btn!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
    } finally {
      URL.createObjectURL = orig;
      clicks.mockRestore();
    }
    expect(capturedBlobs, "强点零 Blob").toHaveLength(0);
    expect(api.fetchJSON.mock.calls.length, "强点零请求").toBe(before);
  });
});
