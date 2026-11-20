// @vitest-environment jsdom
/**
 * R215 — 员工列表复制/导出与筛选同源护栏（纯测试，零产品改动）。
 *
 * 已覆盖只回证据（本文件不重复写）：
 *  - ④ 空集导出钮 disabled + title + 点击零请求 + createObjectURL 未调用
 *    = employees.export.test.tsx（R144）"a disabled button never triggers a
 *    request or a blob"；
 *  - 默认全量场景 CSV==表体==copy 三值、lifecycle 单维深链导出==筛选屏上行、
 *    翻页追加后首行逐字与零请求 = R144 ②③ + employees.paging.test.tsx（R175）③；
 *  - 部门三态默认场景逐字 = R144 ①（真值/未标注部门/该字段未返回 进末列）。
 * 本文件补缺口：
 *  - ①② ?lifecycle=&q= 组合深链下 三值相等 + 首行姓名逐字 + 请求带两个服务端
 *    参数逐字且无 cursor=、导出本身零请求；
 *  - ③ lifecycle 深链下 CSV 部门末列与屏上部门格逐字（真值行 + 键缺失行）。
 * 现场口径：CSV=五列英文键头，知识/预算列不在契约内（R144 注记）；last_active
 * 缺值 CSV=空字段而 copy=「—」，列间口径不同按现状断言。
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
import EmployeesModulePage, { FIELD_MISSING } from "@/modules/employees/EmployeesModulePage";

const mock = vi.mocked(fetchJSON);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const X1 = {
  employeeId: "emp_D4E6F8A0B1C2",
  name: "增长员工",
  title: "增长",
  lifecycleState: "active",
  updatedAt: "2026-11-19T01:00:00Z",
  department: "增长组", // 真值原样
};
const X2 = {
  employeeId: "emp_E5F7A9B1C2D3",
  name: "暂停员工",
  title: "运维",
  lifecycleState: "paused",
  updatedAt: "2026-11-18T00:00:00Z",
  department: null,
};
const X3 = {
  employeeId: "emp_F6A8B0C2D3E4",
  name: "缺键员工",
  title: "数据",
  lifecycleState: "active",
  updatedAt: "2026-11-18T02:00:00Z",
  // 无 department 键 = 该字段未返回
};

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

const renderList = (entry: string) => renderInto(entry, <EmployeesModulePage />);

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const rowIds = () =>
  Array.from(document.querySelectorAll('[data-testid^="employees-row-emp_"]')).map((el) =>
    String(el.getAttribute("data-testid")).replace("employees-row-", ""),
  );
const deptCell = (id: string) => {
  const row = q(`employees-row-${id}`);
  const cell = row ? Array.from(row.querySelectorAll('span[data-label="部门"]')).at(-1) : null;
  return (cell?.textContent ?? "").trim();
};
const urls = (): string[] => mock.mock.calls.map((c) => String(c[0]));
const listUrls = () => urls().filter((u) => u.includes("/api/employees?"));

// 组合筛选腿：lifecycleState=active 且 keyword=增长 → 只有 X1 命中。
function serveCombo(): void {
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (!u.includes("/api/employees?")) return {};
    const active = u.includes("lifecycleState=active");
    const kw = u.includes("keyword=%E5%A2%9E%E9%95%BF");
    if (active && kw) return { items: [X1] };
    if (active) return { items: [X1, X3] };
    if (kw) return { items: [X1, X2] };
    return { items: [X1, X2, X3] };
  });
}

function stubBoth() {
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
    return "blob:exp215";
  }) as typeof URL.createObjectURL;
  return {
    written,
    captured,
    downloads,
    async restore() {
      URL.createObjectURL = orig;
      clicks.mockRestore();
    },
  };
}

const csvLinesOf = async (blob: Blob) => (await blob.text()).split("\r\n").filter((l) => l !== "");
const copyLinesOf = (text: string) => text.split("\n").filter((l) => l !== "");

const click = async (id: string) => {
  const btn = q(id) as HTMLButtonElement | null;
  expect(btn, id).toBeTruthy();
  await act(async () => {
    btn!.click();
  });
};

describe("R215 employees export × filter parity", () => {
  it("①② a combined ?lifecycle=active&q= deep link keeps CSV/table/copy counts, order and requests honest", async () => {
    serveCombo();
    const stub = stubBoth();
    try {
      await renderList("/employees?lifecycle=active&q=%E5%A2%9E%E9%95%BF");
      const calls = listUrls();
      expect(calls, "one query on the combined deep link").toHaveLength(1);
      expect(calls[0], "server param lifecycleState is verbatim").toContain("lifecycleState=active");
      expect(calls[0], "server param keyword is verbatim").toContain("keyword=%E5%A2%9E%E9%95%BF");
      expect(calls[0], "no stale cursor on the first page").not.toContain("cursor=");
      expect(rowIds(), "screen shows the intersection").toEqual(["emp_D4E6F8A0B1C2"]);
      // 三值相等：表体 == copy == CSV（数据行）。
      await click("emp-list-copy");
      await click("emp-list-export");
      const copyLines = copyLinesOf(stub.written[0]);
      const csv = await csvLinesOf(stub.captured[0]);
      expect(csv[0], "five-key header is the contract").toBe(
        "name,employee_no,lifecycle,last_active,department",
      );
      expect(copyLines.length - 1, "table rows == copy data rows").toBe(rowIds().length);
      expect(csv.length - 1, "table rows == csv data rows").toBe(rowIds().length);
      expect(csv[1].split(",")[0], "csv 首行姓名 == 屏上首行（增长员工）").toBe("增长员工");
      expect(copyLines[1].split(",")[0]).toBe("增长员工");
      // 导出/复制本身零请求。
      expect(listUrls(), "copy/export never refetch").toHaveLength(1);
      expect(stub.downloads.length, "one download was produced").toBe(1);
    } finally {
      await stub.restore();
    }
  });

  it("③ under the lifecycle deep link the CSV department column matches the on-screen cells verbatim (truth + missing key)", async () => {
    serveCombo();
    const stub = stubBoth();
    try {
      await renderList("/employees?lifecycle=active");
      expect(rowIds()).toEqual(["emp_D4E6F8A0B1C2", "emp_F6A8B0C2D3E4"]);
      await click("emp-list-export");
      const csv = await csvLinesOf(stub.captured[0]);
      const line1 = csv[1].split(",");
      const line2 = csv[2].split(",");
      expect(line1.at(-1), "真值行末列原样").toBe(deptCell("emp_D4E6F8A0B1C2"));
      expect(line1.at(-1)).toBe("增长组");
      expect(line2.at(-1), "键缺失行走单点缺值句，不冒充空/未标注").toBe(
        deptCell("emp_F6A8B0C2D3E4"),
      );
      expect(line2.at(-1)).toBe(FIELD_MISSING);
      expect(listUrls(), "export itself stays request-free").toHaveLength(1);
    } finally {
      await stub.restore();
    }
  });
});
