// @vitest-environment jsdom
/**
 * R196 — 员工列表排序四处同源护栏（纯测试，零产品改动）。
 *
 * 现场裁决（R62 契约，按现状锁定，不放宽）：
 * - 排序是**本地维**：emp-list-sort-* 三态循环只作用在已加载行集上，
 *   不触发任何取数（R62「never refetches」已锁计数不变），请求 query
 *   从不带 sort=/dir=（本文件反锁参数面）；工单②「服务端维带排序参」
 *   分支不适用，差异在此点名。
 * - 「页码归 1」对本地维=排序既不重置也不污染服务端游标（R58 游标只随
 *   服务端腿走），按现状锁「排序切换后请求腿数量不变」代替字面归一。
 *
 * 已覆盖只回证据，不写重复用例：R62（三态循环/URL 保参/缺值排末/零新请求）、
 * R134 employees.parity（默认序下 copy/CSV 与行格逐格对照+重挂逐字）、
 * R115 employees.filters（lifecycle 深链回填与请求逐字）、R144/R58（三值
 * 计数与游标契约）、R110/R96（部门列口径）。本文件增量=切排序后
 * 表体行序==复制行序==CSV 行序三方逐字同步、升降序两向缺值行恒排末且
 * 其复制行逐字不变、排序参从不进请求、筛选×排序叠加行集与计数一致。
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
import EmployeesModulePage from "@/modules/employees/EmployeesModulePage";

const mock = vi.mocked(fetchJSON);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// 时间维字典序可控：E3(11-17) < E4(11-18) < E1(11-19)；E2 无 updatedAt（缺值主角）。
const E1 = { employeeId: "emp_A1B2C3D4E5F6", name: "甲一", lifecycleState: "active", updatedAt: "2026-11-19T01:00:00Z", department: "增长组" };
const E2 = { employeeId: "emp_B2C3D4E5F6A7", name: "乙二", lifecycleState: "paused", updatedAt: null, department: null };
const E3 = { employeeId: "emp_C3D4E5F6A7B8", name: "丙三", lifecycleState: "active", updatedAt: "2026-11-17T01:00:00Z" };
const E4 = { employeeId: "emp_D4E5F6A7B8C9", name: "丁四", lifecycleState: "active", updatedAt: "2026-11-18T01:00:00Z", department: "平台组" };
const ALL = [E1, E2, E3, E4];
const NAMES: Record<string, string> = {
  emp_A1B2C3D4E5F6: "甲一",
  emp_B2C3D4E5F6A7: "乙二",
  emp_C3D4E5F6A7B8: "丙三",
  emp_D4E5F6A7B8C9: "丁四",
};

function serve(): void {
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("lifecycleState=active")) return { items: [E1, E3, E4] };
    return { items: ALL };
  });
}

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
const bodyNames = () => rowIds().map((id) => NAMES[id] ?? "?");
const listUrls = (): string[] =>
  mock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/api/employees?"));

const click = async (id: string): Promise<void> => {
  const btn = q(id) as HTMLButtonElement | null;
  expect(btn, id).toBeTruthy();
  await act(async () => {
    btn!.click();
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), `${id} settled`);
};

// aria-sort 的载体=外层 span[role=columnheader]（按钮本身只带 testid）。
const sortOf = (key: string) =>
  q(`emp-list-sort-${key}`)?.parentElement?.getAttribute("aria-sort") ?? "";

/** 同屏拦复制文本与导出 Blob（employees.export.test.tsx 形制），返回三方行序。 */
async function threeOrders(): Promise<{ body: string[]; copy: string[]; csv: string[] }> {
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
  const orig = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  URL.createObjectURL = ((blob: Blob) => {
    captured.push(blob);
    return "blob:sort196";
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  const body = bodyNames();
  try {
    await click("emp-list-copy");
    await waitFor(() => written.length >= 1, "copy text");
    await click("emp-list-export");
    await waitFor(() => captured.length >= 1, "export blob");
  } finally {
    URL.createObjectURL = orig;
    URL.revokeObjectURL = origRevoke;
  }
  const copy = written[0]
    .split("\n")
    .filter((l) => l !== "")
    .slice(1)
    .map((l) => l.split(",")[0]);
  const csvLines = (await captured[0].text())
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .filter((l) => l !== "");
  const csv = csvLines.slice(1).map((l) => l.split(",")[0]);
  return { body, copy, csv, raw: csvLines };
}

describe("R196 employees sort parity (emp-list-sort-*)", () => {
  it("① after toggling the time sort, body order == copy order == CSV order, verbatim", async () => {
    serve();
    await renderList();
    // 升序（第一次点击）。
    await click("emp-list-sort-time");
    expect(sortOf("time"), "asc state").toBe("ascending");
    let three = await threeOrders();
    expect(three.copy, "copy follows the sorted body (asc)").toEqual(three.body);
    expect(three.csv, "csv follows the sorted body (asc)").toEqual(three.body);
    expect(three.body.at(0), "asc 首个是 11-17").toBe("丙三");
    // 降序（第二次点击）——三方随同一重排同步。
    await click("emp-list-sort-time");
    expect(sortOf("time"), "desc state").toBe("descending");
    three = await threeOrders();
    expect(three.copy, "copy follows the sorted body (desc)").toEqual(three.body);
    expect(three.csv, "csv follows the sorted body (desc)").toEqual(three.body);
    expect(three.body.at(0), "desc 首个是 11-19").toBe("甲一");
  });

  it("② sorting never refetches and sort/dir never ride the request (local dimension, R62)", async () => {
    serve();
    await renderList();
    const before = listUrls().length;
    await click("emp-list-sort-time");
    await click("emp-list-sort-time");
    await click("emp-list-sort-name");
    expect(listUrls().length, "sorting is pure-local: zero new queries").toBe(before);
    for (const u of listUrls()) {
      expect(u, "排序参从不进请求").not.toContain("sort=");
      expect(u).not.toContain("dir=");
    }
  });

  it("③ filter × sort stacked in the URL: row set, count and export agree", async () => {
    serve();
    await renderList("/employees?lifecycle=active&sort=time&dir=desc");
    // 服务端 lifecycleState=active 腿 + 本地时间降序（R62 契约：排序不重取）。
    const ids = rowIds();
    expect(ids, "paused 被服务端维筛掉；时间降序").toEqual([
      "emp_A1B2C3D4E5F6",
      "emp_D4E5F6A7B8C9",
      "emp_C3D4E5F6A7B8",
    ]);
    expect(q("emp-list-count")?.textContent).toBe(String(ids.length));
    const three = await threeOrders();
    expect(three.copy).toHaveLength(ids.length);
    expect(three.csv).toHaveLength(ids.length);
    expect(three.body, "三方同步").toEqual(three.copy);
    expect(listUrls(), "叠加深链只发一条查询").toHaveLength(1);
    expect(listUrls()[0]).toContain("lifecycleState=active");
    expect(listUrls()[0], "本地排序参不进请求").not.toContain("sort=");
  });

  it("④ the missing-time row sorts last in both directions and its copy line never changes", async () => {
    serve();
    await renderList();
    await click("emp-list-sort-time");
    expect(rowIds().at(-1), "asc: 缺值恒排末").toBe("emp_B2C3D4E5F6A7");
    const asc = await threeOrders();
    expect(asc.csv.at(-1), "csv 也把它留在末行").toBe("乙二");
    const ascLine = (asc as unknown as { rawCopy?: string[] }) && (await copyOnly()).find((l) => l.startsWith("乙二,"));

    await click("emp-list-sort-time");
    expect(rowIds().at(-1), "desc: 缺值仍恒排末，不置顶").toBe("emp_B2C3D4E5F6A7");
    const desc = await threeOrders();
    expect(desc.csv.at(-1), "csv 降序同样留末").toBe("乙二");
    const descLine = (await copyOnly()).find((l) => l.startsWith("乙二,"));
    expect(descLine, "缺值行的复制整行升/降序逐字不变").toBe(ascLine);
    expect(ascLine, "缺值时间列=「—」不是空也不是 0").toContain(",—,");
    async function copyOnly(): Promise<string[]> {
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
      await click("emp-list-copy");
      await waitFor(() => written.length >= 1, "copy");
      return written[0].split("\n").filter((l) => l !== "").slice(1);
    }
  });
});
