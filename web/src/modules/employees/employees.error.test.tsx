// @vitest-environment jsdom
/**
 * R178 — 员工列表错误态 rid 与重试护栏（纯测试，零产品改动）。
 *
 * 已覆盖只回证据（不写重复用例）：
 * - 首屏错误卡/rid 载体/重试钮/三钮置灰/URL 不吞参/403≡404 同体 = R69
 *   （EmployeesModulePage.test.tsx「R69 list state consistency」）；
 * - 翻页失败现状矩阵（state 保留旧行、屏上切整页错误卡、计数位变
 *   「总数不可读」、重试=首页腿恰 +1、成功后 rid 卸载）= R175
 *   （employees.paging.test.tsx it②）。
 * 本文件增量：①「错误 ≠ 空」的显式锁——employees-empty 与空态文案绝不
 * 在 500 时出现，rid 剪贴板回环逐字；②busy 连点三面锁（在飞只 +1、
 * disabled 闸、resolve 后不偷发、去重）。工单②「copy 仍可用」与 R69
 * 现场 gates（非 ready 一律置灰）冲突——按现状记录，不臆造第二套口径。
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
import { ApiError } from "@/lib/api-error";
import EmployeesModulePage from "@/modules/employees/EmployeesModulePage";

const mock = vi.mocked(fetchJSON);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const A = {
  employeeId: "emp_A1B2C3D4E5F6",
  name: "甲一",
  title: "增长",
  lifecycleState: "active",
  updatedAt: "2026-11-19T01:00:00Z",
  department: "增长组",
};
const B = {
  employeeId: "emp_B2C3D4E5F6A7",
  name: "乙二",
  title: "运维",
  lifecycleState: "paused",
  updatedAt: null,
  department: null,
};
const PAGE1 = { items: [A, B], nextCursor: "pc-2" };

let roots: Root[] = [];
let mounted: HTMLDivElement[] = [];

function clearScreen(): void {
  for (const root of roots) {
    act(() => {
      root.unmount();
    });
  }
  roots = [];
  for (const el of mounted) el.remove();
  mounted = [];
}

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

const renderList = (entry = "/employees") => renderInto(entry, <EmployeesModulePage />);

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const listUrls = (): string[] =>
  mock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/api/employees?"));
const rowIds = (): string[] =>
  Array.from(document.querySelectorAll('[data-testid^="employees-row-emp_"]')).map((el) =>
    String(el.getAttribute("data-testid")).replace("employees-row-", ""),
  );

describe("R178 ① a failed list reads as an error, never as an empty roster", () => {
  it("500 shows the plain sentence and a copyable rid; the empty card stays away", async () => {
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
    mock.mockImplementation(async (url: string) => {
      throw new ApiError("boom", {
        status: 500,
        body: JSON.stringify({ message: "上游炸了" }),
        url: String(url),
        requestId: "req-emp-err-500",
      });
    });
    await renderList("/employees?lifecycle=paused");

    // 错误态就位（载体形状=R69 既有锁；此处补「不是空集」的角度）。
    expect(q("emp-list-state")?.getAttribute("data-phase")).toBe("error");
    expect(q("employees-error"), "error card").toBeTruthy();
    expect(q("employees-error")?.textContent).toContain("员工列表没能加载出来");
    // 工单①核心：错误不得伪装成「无员工」。
    expect(q("employees-empty"), "no empty card on 500").toBeNull();
    expect(q("emp-list-empty-text"), "no empty sentence on 500").toBeNull();
    expect(q("emp-list-state-empty"), "no state-empty on 500").toBeNull();
    expect(document.body.textContent, "屏上不出现「还没有数字员工」").not.toContain("还没有数字员工");
    expect(document.body.textContent).not.toContain("没有匹配的员工");

    // rid 可读 + 可复制逐字回环。
    expect(q("emp-list-state-rid")?.textContent).toContain("req-emp-err-500");
    const copyBtn = q("req-copy") as HTMLButtonElement | null;
    expect(copyBtn, "rid copy control").toBeTruthy();
    await act(async () => {
      copyBtn!.click();
    });
    await waitFor(() => written.length === 1, "rid copied");
    expect(written[0], "剪贴板收到逐字 rid").toBe("req-emp-err-500");

    // 计数位单点句（不作 0）。
    expect(q("emp-list-count")?.textContent).toBe("—");
    expect(q("emp-list-page-count")?.textContent).toContain("总数不可读");
  });
});

describe("R178 ④ busy re-entry: two clicks while a page is in flight fetch once", () => {
  it("repeated clicks on 加载更多 never pile up requests; the release appends once", async () => {
    let release: ((v: unknown) => void) | null = null;
    mock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("cursor=")) {
        await new Promise((resolve) => {
          release = resolve;
        });
        return { items: [B] }; // 重叠行 B：追加按工号去重
      }
      return PAGE1;
    });
    await renderList();
    expect(rowIds()).toEqual([A.employeeId, B.employeeId]);
    const before = listUrls().length;

    const more = q("emp-list-page-more") as HTMLButtonElement;
    expect(more.disabled, "cursor present enables more").toBe(false);
    await act(async () => {
      more.click();
    });
    // 在飞：连点两次不得偷发第二腿。
    await act(async () => {
      more.click();
      more.click();
    });
    const during = listUrls();
    expect(during.length, "只多了一条在飞请求").toBe(before + 1);
    expect(during.filter((u) => u.includes("cursor=")).length, "cursor 腿恰一条").toBe(1);
    expect(more.disabled, "busy 期间按钮 disabled").toBe(true);

    await act(async () => {
      release?.({});
    });
    await waitFor(() => q("emp-list-page-end") !== null, "released and at end");
    expect(listUrls().length, "resolve 后不再补发").toBe(before + 1);
    expect(rowIds(), "重叠行去重：并集两行").toEqual([A.employeeId, B.employeeId]);
    expect(
      document.querySelectorAll(`[data-testid="employees-row-${B.employeeId}"]`).length,
      "乙二只有一张卡",
    ).toBe(1);
  });
});
