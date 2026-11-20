// @vitest-environment jsdom
/**
 * R213 — 员工详情请求契约护栏（纯测试，零产品改动）。
 *
 * 先查台账（已覆盖只回证据，本文件不重复其断言面）：
 * - ① 开详情=恰 1 条独立读口且列表腿不重取：employees.parity.test.tsx
 *   「R134 ③④ opening the detail adds exactly its own read-port call, never a
 *   list refetch」逐字已锁；本文件把「成功路径零矩阵回落」这一细节并进入②场景
 *   一起断（R134 未分矩阵腿计数）。
 * - ④ 详情 500 → 列表行保留 + 错误锚带 rid（req-emp-d500 形制）+ 重试恰 +1 且
 *   成功后错误锚消失、字段就位：employees.detail.states.test.tsx（R209）②③ 组
 *   合用例与 ①b 全锁；rid 复制回环在 R209 ①a、req-copy 形态在 R211/R70 域。
 * - 早前窗声称的 employees.detail.error.test.tsx（R198）经当轮 ls 证实不在树，
 *   其面已由 R209 重建覆盖。
 *
 * 本文件新锁：
 * - ② 关闭再开同一人：每次挂载各发 1 条详情腿（读口无缓存，计数=2），且新容器
 *   的姓名/工号/创建时间三格与关闭前逐字相同；成功路径矩阵腿恒 0。
 * - ③ 同一挂载只换员工（rerender 改 employeeId prop，对应路由 :id 变化的组件
 *   复用路径）：只 +1 条新员工腿、旧员工腿不再多发；屏上姓名/工号短码换成新
 *   员工，前一位「小鲤/A3F1B2C4」零残留（useOverview 的 empId effect 会
 *   setState(loading) 重取，不留旧 ready 体）。
 */
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ fetchJSON: vi.fn() }));

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    onClick,
    ...rest
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    [k: string]: unknown;
  }) => (
    <button type="button" onClick={onClick} {...(rest as Record<string, never>)}>
      {children}
    </button>
  ),
  Card: ({ children, ...rest }: { children?: React.ReactNode; [k: string]: unknown }) => (
    <div {...(rest as Record<string, never>)}>{children}</div>
  ),
  CardContent: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

import { fetchJSON } from "@/lib/api";
import EmployeeDetailModulePage from "@/modules/employee-detail/EmployeeDetailModulePage";

const mock = vi.mocked(fetchJSON);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const EMP = "emp_A3F1B2C4D5E6";
const EMP2 = "emp_B2C4D6E8F0A1";

const DETAIL1 = {
  employeeId: EMP,
  name: "小鲤",
  title: "内容编辑",
  lifecycleState: "active",
  ownerUserId: "user:7",
  department: "增长组",
  updatedAt: "2026-11-17T05:52:48.030Z",
  createdAt: "2026-11-14T02:15:00Z",
};
const DETAIL2 = {
  employeeId: EMP2,
  name: "阿朝",
  title: "增长",
  lifecycleState: "paused",
  updatedAt: "2026-11-18T05:52:48Z",
  department: null,
};

const live: { root: Root; container: HTMLDivElement }[] = [];

const waitFor = async (cond: () => boolean, label: string): Promise<void> => {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
};

function serveBoth(): void {
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes(`/api/employees/${EMP}`)) return DETAIL1;
    if (u.includes(`/api/employees/${EMP2}`)) return DETAIL2;
    if (u.includes("/api/matrix")) {
      throw new Error("the success path must never fall back to the matrix leg");
    }
    return {};
  });
}

async function mountDetail(empId: string): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  live.push({ root, container });
  const node: ReactElement = (
    <MemoryRouter>
      <EmployeeDetailModulePage employeeId={empId} />
    </MemoryRouter>
  );
  await act(async () => {
    root.render(node);
  });
  await waitFor(() => !container.querySelector(".animate-pulse"), `detail ${empId} settled`);
  return container;
}

function closeOne(container: HTMLDivElement): void {
  const index = live.findIndex((slot) => slot.container === container);
  expect(index, "the detail mount is tracked").toBeGreaterThanOrEqual(0);
  const [slot] = live.splice(index, 1);
  act(() => {
    slot.root.unmount();
  });
  slot.container.remove();
}

const q = (id: string, scope: ParentNode): Element | null =>
  scope.querySelector(`[data-testid="${id}"]`);
const text = (id: string, scope: ParentNode): string => q(id, scope)?.textContent ?? "";
const urls = (): string[] => mock.mock.calls.map((call) => String(call[0]));
const detailUrls = (empId: string): string[] =>
  urls().filter((u) => u.includes(`/api/employees/${encodeURIComponent(empId)}`) || u.includes(`/api/employees/${empId}`));
const matrixCount = (): number => urls().filter((u) => u.includes("/api/matrix")).length;

afterEach(() => {
  for (const slot of live.splice(0)) {
    act(() => {
      slot.root.unmount();
    });
    slot.container.remove();
  }
  mock.mockReset();
  document.body.replaceChildren();
});

describe("R213 employees detail request contract guards", () => {
  it("② reopening the same employee pays exactly one fresh read and replays the same words", async () => {
    serveBoth();
    const first = await mountDetail(EMP);
    // ①'s un-pinned detail: a successful read never falls back to the matrix.
    expect(detailUrls(EMP)).toHaveLength(1);
    expect(matrixCount(), "success path uses no matrix leg").toBe(0);
    const cells = {
      name: text("ed1-identity-name", first),
      code: text("ed1-identity-code", first),
      created: text("ed1-identity-created", first),
    };
    expect(cells.name).toBe("小鲤");

    closeOne(first);
    const second = await mountDetail(EMP);
    // no cache on the read port: each open costs its own single call
    expect(detailUrls(EMP), "reopen asks again (2 reads, no caching)").toHaveLength(2);
    expect(matrixCount()).toBe(0);
    // the reopened screen reads byte-for-byte what the closed one showed
    expect(text("ed1-identity-name", second)).toBe(cells.name);
    expect(text("ed1-identity-code", second)).toBe(cells.code);
    expect(text("ed1-identity-created", second)).toBe(cells.created);
    expect(second.textContent).not.toMatch(/undefined|null/);
  });

  it("③ switching to another employee on the same mount costs one new read and keeps nothing of the old row", async () => {
    serveBoth();
    const container = await mountDetail(EMP);
    expect(detailUrls(EMP)).toHaveLength(1);
    expect(text("ed1-identity-name", container)).toBe("小鲤");

    // same root, same component instance, only the employee changes — this is
    // the route-param swap the shell performs between /employees/:id pages.
    const [, slot] = [0, live[live.length - 1]];
    await act(async () => {
      slot.root.render(
        <MemoryRouter>
          <EmployeeDetailModulePage employeeId={EMP2} />
        </MemoryRouter>,
      );
    });
    await waitFor(() => text("ed1-identity-name", container) === "阿朝", "second employee on screen");

    // exactly one extra request, aimed at the NEW employee only
    expect(detailUrls(EMP2), "one fresh read for the switched employee").toHaveLength(1);
    expect(detailUrls(EMP), "the previous employee is not re-read").toHaveLength(1);
    expect(matrixCount()).toBe(0);
    // no stale fields survive the swap: name, code and raw ids of the first
    // employee are fully off the screen
    expect(container.textContent).toContain("阿朝");
    expect(container.textContent).toContain("B2C4D6E8");
    expect(container.textContent).not.toContain("小鲤");
    expect(container.textContent).not.toContain("A3F1B2C4");
    expect(text("ed1-identity-code", container)).toContain("员工 · B2C4D6E8");
    expect(container.textContent).not.toMatch(/undefined|null/);
  });
});
