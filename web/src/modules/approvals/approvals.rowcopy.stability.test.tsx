// @vitest-environment jsdom
/**
 * R234 — 审批行复制在筛选/排序换站后的稳定性（纯测试，零产品改动，gap-only）。
 *
 * 已覆盖只回证据，不写重复用例：
 * ②「切排序后 apr-row-copy-0 指向新首行且与屏上首行同源」=
 *   approvals.detail.copy.test.tsx it「after a sort switch the button at
 *   index i still copies the row displayed at index i」（asc/desc 双向 +
 *   两向第 0 行确换数据）；「复制与导出零新增请求」= 同文件 it「copying
 *   with the drawer open triggers no extra request」+ R231/R182 导出计数锁。
 * 六段契约本体（单号/标题/状态/风险/更新时间/短码后8位）= R127/R162；
 * 跨页（pending vs history 双容器）同一行复制逐字 = R218 it②。
 *
 * 本文件真缺口：
 * ①同一页内切 ?status=（服务端维，各站一次重取）后，同一行 payload 的
 *   六段复制文本跨站逐字不变——R218 是双容器跨页形态，单页换站从未锁；
 * ③缺值行在 asc 与 desc 两站（index 随排序移动）复制文本互等且各段
 *   稳定（更新时间「—」、短码「—」、风险「未标注风险」，禁 undefined/
 *   null）——R162 it④ 只锁「钮与行不串」，同一行跨站的文本不变未锁。
 *
 * 现场事实：status= 是服务端维（切换必重取，本单不锁其计数）；asort/adir
 *   是本地维（R71/R186 契约，从不进请求，复制点击零请求照旧锁）；
 *   rail 计数/选择必须用 /^apr-row-copy-\d+$/（R211 教训：前缀会撞
 *   apr-row-copy-status/-fallback）；行卡选择器 apr5-row-ap* 需滤
 *   -details-（R44 撞前缀教训）；同 it 多次 render 前必 clearScreen
 *   防 document 级查询串台（R229 教训）。
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
import ApprovalsHistoryModulePage from "@/modules/approvals/ApprovalsHistoryModulePage";

const mock = vi.mocked(fetchJSON);
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

const render = (entry: string) => renderInto(entry, <ApprovalsHistoryModulePage />);

const rowIds = () =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap"]'))
    .map((el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""))
    .filter((id) => !id.startsWith("details-"));

const written: string[] = [];
const stubClipboard = (): void => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (t: string) => {
        written.push(t);
        return Promise.resolve();
      },
    },
  });
};

const copyRow = async (id: string): Promise<string> => {
  const index = rowIds().indexOf(id);
  expect(index, `row ${id} visible`).toBeGreaterThanOrEqual(0);
  const btn = document.querySelector(
    `[data-testid="apr-row-copy-${index}"]`,
  ) as HTMLButtonElement | null;
  expect(btn, `copy button at index ${index}`).toBeTruthy();
  const before = mock.mock.calls.length;
  await act(async () => {
    btn!.click();
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), "copy settled");
  expect(mock.mock.calls.length, "复制零新增请求").toBe(before);
  return written[written.length - 1] as string;
};

// —— ①跨 status 站的主角：同一 payload 出现在两条服务端腿里 ——
// 锁的是「同一行数据在两站渲染逐字不变」，不断言上游筛选语义
//（R218 同款裁决；status 字段本身在两站都渲染为同一人话段落）。
const S1 = {
  approvalId: "ap_st1",
  title: "Stable carrier",
  status: "pending",
  riskLevel: "medium",
  requestId: "req-st-11112222",
  createdAt: "2026-11-18T01:00:00Z",
};
const S2 = {
  approvalId: "ap_st2",
  title: "Approved mate",
  status: "approved",
  riskLevel: "low",
  requestId: "req-st-22223333",
  createdAt: "2026-11-18T02:00:00Z",
  decidedAt: "2026-11-19T02:00:00Z",
};

function serveStations(): void {
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent(u.split("id=")[1] ?? "");
      const row = [S1, S2].find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("status=approved")) return { items: [S1, S2] };
    if (u.includes("status=pending")) return { items: [S1] };
    if (u.includes("/api/approvals")) return { items: [S1, S2] };
    return {};
  });
}

describe("R234 row-copy stability across station switches (gap-only)", () => {
  it("① the same row's six segments are byte-identical across ?status= stations, with no drift", async () => {
    stubClipboard();
    serveStations();
    await render("/approvals?tab=history&status=pending");
    expect(rowIds()).toEqual(["ap_st1"]);
    const pendingText = await copyRow("ap_st1");
    const lines = pendingText.split("\n");
    expect(lines.length, "六段契约（R127）").toBe(6);
    expect(lines[0]).toBe("单号：ap_st1");
    expect(lines[1]).toBe("标题：Stable carrier");
    expect(lines[2]!.startsWith("状态：")).toBe(true);
    expect(lines[3]).toBe("风险：中等风险");
    expect(lines[5], "短码只后 8 位").toBe("短码：11112222");
    expect(pendingText).not.toContain("req-st-11112222");
    expect(pendingText).not.toMatch(/undefined|null|NaN/);

    clearScreen();
    await render("/approvals?tab=history&status=approved");
    expect(rowIds()).toEqual(["ap_st1", "ap_st2"]);
    const approvedText = await copyRow("ap_st1");
    expect(approvedText, "跨 status 站同一行复制逐字不变").toBe(pendingText);
  });

  it("③ the gap row copies identically at asc and desc stations, indexes move but segments do not", async () => {
    stubClipboard();
    // 复用 R231 的 ASCII 标题纪律：desc = Gamma, Beta, Alpha。
    // G1 = 缺值主角（无 riskLevel / 无 decidedAt 等 DECIDED 键 / 无 requestId）。
    mock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approvals")) {
        return {
          items: [
            { approvalId: "ap_gs1", title: "Beta rotation", status: "approved", createdAt: "2026-11-18T02:00:00Z" },
            {
              approvalId: "ap_gs2",
              title: "Alpha release",
              status: "approved",
              riskLevel: "high",
              requestId: "req-gs-11112222",
              createdAt: "2026-11-18T01:00:00Z",
              decidedAt: "2026-11-19T02:00:00Z",
            },
            {
              approvalId: "ap_gs3",
              title: "Gamma budget",
              status: "approved",
              riskLevel: "low",
              requestId: "req-gs-33334444",
              createdAt: "2026-11-18T03:00:00Z",
              decidedAt: "2026-11-19T04:00:00Z",
            },
          ],
        };
      }
      return {};
    });

    await render("/approvals?tab=history&asort=title&adir=asc");
    const ascOrder = rowIds();
    expect(ascOrder).toEqual(["ap_gs2", "ap_gs1", "ap_gs3"]);
    expect(ascOrder.indexOf("ap_gs1"), "缺值行在 asc 站居中间").toBe(1);
    const ascText = await copyRow("ap_gs1");

    clearScreen();
    await render("/approvals?tab=history&asort=title&adir=desc");
    const descOrder = rowIds();
    expect(descOrder).toEqual(["ap_gs3", "ap_gs1", "ap_gs2"]);
    expect(descOrder.indexOf("ap_gs1"), "desc 站 index 不变但邻居换了").toBe(1);
    const descText = await copyRow("ap_gs1");

    expect(descText, "同一缺值行跨排序方向复制逐字不变").toBe(ascText);
    const lines = ascText.split("\n");
    expect(lines.length).toBe(6);
    expect(lines[3], "风险缺值=人话（R107 契约，非空非裸词）").toBe("风险：未标注风险");
    expect(lines[4], "更新时间缺值=—").toBe("更新时间：—");
    expect(lines[5], "短码缺值=—").toBe("短码：—");
    expect(ascText).not.toMatch(/undefined|null|NaN|req-gs/);
  });
});
