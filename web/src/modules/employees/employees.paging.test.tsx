// @vitest-environment jsdom
/**
 * R175 — 员工列表分页契约护栏（纯测试，零产品改动）。
 *
 * 已覆盖只回证据，不写重复用例：
 *  - ①去重+③末页 disabled/「已到末页」/计数文案：EmployeesModulePage.test.tsx
 *    describe「R58 pagination and honest total (emp-list-page-*)」已锁；
 *  - ②翻页后改筛选=恰一次新取数且不带旧 cursor=、行替换非累加：
 *    employees.filters.test.tsx（R115）已锁；
 *  - 未翻页场景 copy/CSV/表体三值相等+导出零请求：employees.export.test.tsx
 *    （R144）已锁——本文件③补「翻页追加后」的同款三值与首行逐字。
 *
 * 现场裁决（工单④与产品现状差异，按现状锁定并点名，不改产品）：
 *  第 2 页 500 时 loadMore 的 catch 把旧行保留在 state.items，但 phase=error
 *  的渲染分支互斥——屏上呈现整页错误卡：表体卸载、emp-list-page-count 变
 *  「总数不可读 · 已显示 — 人」、emp-list-copy 按 R69 gates 置 disabled。
 *  重试走 setReload → 首页腿全量替换（服务端游标只续不回头，重试不携带旧
 *  cursor），成功后错误卡与 rid 载体一并卸载。
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
const C = {
  employeeId: "emp_C3D4E5F6A7B8",
  name: "丙三",
  title: "数据",
  lifecycleState: "active",
  updatedAt: "2026-11-18T00:00:00Z",
  // 无 department 键 = 该字段未返回
};
const PAGE1 = { items: [A, B], nextCursor: "pc-2" };
const PAGE2 = { items: [B, C] }; // B 与首页重叠，末页不带 nextCursor

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
const rowIds = (): string[] =>
  Array.from(document.querySelectorAll('[data-testid^="employees-row-emp_"]')).map((el) =>
    String(el.getAttribute("data-testid")).replace("employees-row-", ""),
  );
const urls = (): string[] => mock.mock.calls.map((c) => String(c[0]));
const listUrls = (): string[] => urls().filter((u) => u.includes("/api/employees?"));

function servePaged(): void {
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("cursor=")) return PAGE2;
    if (u.includes("/api/employees?")) return PAGE1;
    return {};
  });
}

async function clickMore(): Promise<void> {
  const more = q("emp-list-page-more") as HTMLButtonElement | null;
  expect(more, "more button").toBeTruthy();
  await act(async () => {
    more!.click();
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), "more settled");
}

describe("R175 employees paging contract", () => {
  it("appends page two deduped by 工号 and states the end honestly", async () => {
    servePaged();
    await renderList();
    expect(rowIds()).toEqual(["emp_A1B2C3D4E5F6", "emp_B2C3D4E5F6A7"]);

    await clickMore();
    expect(rowIds(), "重叠行去重后=并集").toEqual([
      "emp_A1B2C3D4E5F6",
      "emp_B2C3D4E5F6A7",
      "emp_C3D4E5F6A7B8",
    ]);
    const more = q("emp-list-page-more") as HTMLButtonElement;
    expect(more.disabled, "末页禁用续取").toBe(true);
    expect(more.getAttribute("title"), "末页原因句").toContain("已到末页");
    expect(q("emp-list-page-end")?.textContent).toBe("已到末页");
    expect(q("emp-list-page-count")?.textContent).toBe("总数不可用 · 已显示 3 人");
    // 去重键：重复的乙二只出现一次。
    expect(rowIds().filter((id) => id === "emp_B2C3D4E5F6A7")).toHaveLength(1);
  });

  it("a failed page two keeps state rows while the screen shows the honest error card, and retry refetches page one without the stale cursor", async () => {
    let cursorTries = 0;
    mock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("cursor=")) {
        cursorTries += 1;
        throw new ApiError("boom", {
          status: 500,
          body: JSON.stringify({ message: "上游炸了" }),
          url: u,
          requestId: "req-emp-paging",
        });
      }
      if (u.includes("/api/employees?")) return PAGE1;
      return {};
    });
    await renderList();
    await clickMore();

    // 现场裁决：phase=error 的渲染分支互斥——整页错误卡上屏。
    expect(q("emp-list-state")?.getAttribute("data-phase")).toBe("error");
    expect(q("employees-error"), "错误卡上屏").toBeTruthy();
    expect(q("emp-list-state-rid")?.textContent, "错误行含可复制 rid").toContain("req-emp-paging");
    expect(q("req-copy"), "rid 可复制").toBeTruthy();
    expect(q("employees-error-retry"), "重试钮在场").toBeTruthy();
    // 与工单期望的现状差异（点名不改产品）：旧行保留在 state，但表体卸载、
    // 计数变「总数不可读」、复制钮按 gates 置灰。
    expect(q("employees-table"), "旧行不上屏（state 保留）").toBeNull();
    expect(q("emp-list-page-count")?.textContent).toBe("总数不可读 · 已显示 — 人");
    expect((q("emp-list-copy") as HTMLButtonElement).disabled, "错误态复制置灰（R69 gates）").toBe(true);

    const before = listUrls().length;
    await act(async () => {
      (q("employees-error-retry") as HTMLButtonElement).click();
    });
    await waitFor(() => rowIds().length === 2, "retry back to page one");
    const fresh = listUrls().slice(before);
    expect(fresh, "重试恰 +1 次请求").toHaveLength(1);
    expect(fresh[0], "重试走首页腿，不带旧 cursor").not.toContain("cursor=");
    expect(cursorTries, "重试不是续页追加而是全量重取").toBe(1);
    expect(q("emp-list-state-rid"), "成功后 rid 载体随错误卡卸载").toBeNull();
    const more = q("emp-list-page-more") as HTMLButtonElement;
    expect(more.disabled, "回到 ready 后翻页钮恢复").toBe(false);
  });

  it("after appending, copy/export/table row counts match and the first data row stays the top row verbatim", async () => {
    servePaged();
    await renderList();
    await clickMore();
    expect(rowIds()).toHaveLength(3);

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
    const captured: Blob[] = [];
    const downloads: string[] = [];
    const clicks = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.download);
      });
    const orig = URL.createObjectURL;
    URL.createObjectURL = ((blob: Blob) => {
      captured.push(blob);
      return "blob:emp175";
    }) as typeof URL.createObjectURL;
    const before = mock.mock.calls.length;
    try {
      await act(async () => {
        (q("emp-list-copy") as HTMLButtonElement).click();
      });
      await act(async () => {
        (q("emp-list-export") as HTMLButtonElement).click();
      });
    } finally {
      URL.createObjectURL = orig;
      clicks.mockRestore();
    }
    expect(mock.mock.calls.length, "复制/导出零新请求（R144 角度，追加后再锁）").toBe(before);
    expect(written).toHaveLength(1);
    expect(captured).toHaveLength(1);
    const copyLines = written[0].split("\n").filter((l) => l !== "");
    const csv = (await captured[0].text()).split("\r\n").filter((l) => l !== "");
    const bodyRows = rowIds().length;
    expect(copyLines.length - 1, "copy 数据行==表体行").toBe(bodyRows);
    expect(csv.length - 1, "CSV 数据行==表体行").toBe(bodyRows);
    expect(q("emp-list-export-count")?.textContent, "导出读数==表体行").toBe(`共 ${bodyRows} 行`);
    expect(csv[0]).toBe("name,employee_no,lifecycle,last_active,department");
    // 表头后的第一行=屏上第一行（甲一）逐字，追加不影响行首。
    expect(copyLines[1].startsWith("甲一,"), copyLines[1]).toBe(true);
    expect(csv[1].startsWith("甲一,"), csv[1]).toBe(true);
    expect(downloads[0], "文件名仍按导出时刻 BJT 到分").toMatch(/^employees-\d{8}-\d{4}\.csv$/);
  });
});
