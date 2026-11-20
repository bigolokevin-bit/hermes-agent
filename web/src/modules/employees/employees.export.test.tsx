// @vitest-environment jsdom
/**
 * R144 — 员工列表导出字段与屏上列同源护栏（纯测试，零产品改动）。
 *
 * 已覆盖只回证据（不重复写）：COPY_HEADER 逐字+零请求=R66
 * EmployeesModulePage.test.tsx L710；部门三态进 copy/CSV=R110 L1075；
 * copy/export 行与行格逐格对=R134 employees.parity L239；空集钮
 * disabled+title=R66 L738；请求侧无 cursor 残留=R115。本文件补缺口：
 * ①列头==屏上可见列的语义映射注记 + 三态句进 CSV 末列的集中复锁；
 * ②同一场景 CSV 数据行数==表体行数==copy 可复制行数三值 toBe；
 * ③lifecycle 深链与翻页追加后的导出行数==屏上行数、新请求无旧 cursor=；
 * ④空集钮点击零取数（disabled 已锁、点击不发请求为新增断言）。
 * 现场记录：导出列头是英文键名（name,employee_no,lifecycle,last_active,
 * department），屏上是中文列（姓名/短码/状态/最近活跃/部门）——语义映射
 * 按现状记录；知识/预算两列不在导出契约内，同样按现状记录，禁臆造新列。
 * last_active 缺值在 CSV=空字段（R66 契约）而 copy=「—」：列间口径不同，
 * 按现状断言。
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
import EmployeesModulePage, {
  DEPT_UNLABELED_LABEL,
  FIELD_MISSING,
} from "@/modules/employees/EmployeesModulePage";

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
  updatedAt: null, // 最近活跃缺值：CSV=空字段、copy=「—」
  department: null, // 键在值空 = 未标注部门
};
const X3 = {
  employeeId: "emp_F6A8B0C2D3E4",
  name: "缺键员工",
  title: "数据",
  lifecycleState: "active",
  updatedAt: "2026-11-18T00:00:00Z",
  // 无 department 键 = 该字段未返回
};
const ALL = [X1, X2, X3];
const PAGE1 = { items: [X1, X2], nextCursor: "pc-2" };
const PAGE2 = { items: [X3] }; // 末页：不带 nextCursor 键

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
const rowIds = () =>
  Array.from(document.querySelectorAll('[data-testid^="employees-row-emp_"]')).map((el) =>
    String(el.getAttribute("data-testid")).replace("employees-row-", ""),
  );
const urls = (): string[] => mock.mock.calls.map((c) => String(c[0]));
const listUrls = () => urls().filter((u) => u.includes("/api/employees?"));

function serveAll(): void {
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("cursor=")) return PAGE2;
    if (u.includes("lifecycleState=paused")) return { items: [X2] };
    if (u.includes("/api/employees?")) return { items: ALL };
    return {};
  });
}

function servePaged(): void {
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("cursor=")) return PAGE2;
    if (u.includes("/api/employees?")) return PAGE1;
    return {};
  });
}

function serveEmpty(): void {
  mock.mockImplementation(async () => ({ items: [] }));
}

/** 同屏拦截 copy 文本与导出 Blob，返回三个行数读数的采集器。 */
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
    return "blob:exp144";
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

describe("R144 ① header keys map to on-screen columns; missing dept uses the three-state sentences", () => {
  it("csv header is the fixed five keys and the department column never hides the three states", async () => {
    serveAll();
    const stub = stubBoth();
    try {
      await renderList();
      await click("emp-list-copy");
      await waitFor(() => stub.written.length === 1, "copy text");
      await click("emp-list-export");
      await waitFor(() => stub.captured.length === 1, "export blob");
      const csv = await csvLinesOf(stub.captured[0]);
      // 列头逐字（英文键契约，屏上中文列的语义映射见文件头注记）。
      expect(csv[0]).toBe("name,employee_no,lifecycle,last_active,department");
      // 三态句进末列，不写空、不写「—」：
      const x1 = csv.find((l) => l.startsWith("增长员工"));
      const x2 = csv.find((l) => l.startsWith("暂停员工"));
      const x3 = csv.find((l) => l.startsWith("缺键员工"));
      expect(x1?.split(",").at(-1), "真值原样").toBe("增长组");
      expect(x2?.split(",").at(-1), "键在值空").toBe(DEPT_UNLABELED_LABEL);
      expect(x3?.split(",").at(-1), "键缺失").toBe(FIELD_MISSING);
      // 最近活跃缺值：CSV=空字段（R66 契约），与屏上/copy 的「—」口径不同=现状记录。
      expect(x2?.endsWith(`,${DEPT_UNLABELED_LABEL}`), "last_active missing stays empty").toBe(true);
      // 屏上部门格与 CSV 末列逐字同句（表体为第三方对照）。
      const cell = document
        .querySelector(`[data-testid="emp-l-name-link-${X2.employeeId}"] [data-label="部门"]`)
        ?.textContent?.trim();
      expect(cell).toBe(DEPT_UNLABELED_LABEL);
    } finally {
      await stub.restore();
    }
  });
});

describe("R144 ② three same-source row counts", () => {
  it("csv rows == table body rows == copy rows, in one scene", async () => {
    serveAll();
    const stub = stubBoth();
    try {
      await renderList();
      await click("emp-list-copy");
      await waitFor(() => stub.written.length === 1, "copy text");
      await click("emp-list-export");
      await waitFor(() => stub.captured.length === 1, "export blob");
      const body = rowIds().length;
      const copy = copyLinesOf(stub.written[0]).length - 1; // 去掉表头行
      const csv = (await csvLinesOf(stub.captured[0])).length - 1;
      expect(body, "table body rows").toBe(3);
      expect(copy).toBe(body);
      expect(csv).toBe(body);
      expect(q("emp-list-export-count")?.textContent).toBe(`共 ${body} 行`);
    } finally {
      await stub.restore();
    }
  });
});

describe("R144 ③ export obeys the current filter and the loaded pages", () => {
  it("a ?lifecycle=paused deep link exports exactly the filtered screen rows", async () => {
    serveAll();
    const stub = stubBoth();
    try {
      await renderList("/employees?lifecycle=paused");
      await click("emp-list-export");
      await waitFor(() => stub.captured.length === 1, "export blob");
      const csv = await csvLinesOf(stub.captured[0]);
      expect(rowIds()).toEqual([X2.employeeId]);
      expect(csv.length - 1).toBe(rowIds().length);
      expect(csv[1]?.startsWith("暂停员工"), "only the paused row").toBe(true);
      expect(listUrls().every((u) => u.includes("lifecycleState=paused")), "server-side filter rides").toBe(true);
      expect(listUrls().every((u) => !u.includes("cursor=")), "no cursor on first page").toBe(true);
    } finally {
      await stub.restore();
    }
  });

  it("after loading page two the export holds the appended union with no stale cursor", async () => {
    servePaged();
    const stub = stubBoth();
    try {
      await renderList();
      expect(rowIds()).toEqual([X1.employeeId, X2.employeeId]);
      await click("emp-list-page-more");
      await waitFor(() => rowIds().length === 3, "page two appended");
      const before = listUrls().length;
      await click("emp-list-export");
      await waitFor(() => stub.captured.length === 1, "export blob");
      const csv = await csvLinesOf(stub.captured[0]);
      expect(csv.length - 1, "export covers every loaded row").toBe(3);
      expect(rowIds()).toEqual([X1.employeeId, X2.employeeId, X3.employeeId]);
      // 翻页请求带游标；导出不再产生任何列表请求，也没有旧 cursor 的重放。
      const after = listUrls();
      expect(after.length, "export fetches nothing").toBe(before);
      expect(after[1]?.includes("cursor=pc-2"), "page two rode its cursor").toBe(true);
      expect(after[2] === undefined, "no third list query").toBe(true);
    } finally {
      await stub.restore();
    }
  });
});

describe("R144 ④ empty answers disable export without any fetch", () => {
  it("a disabled button never triggers a request or a blob", async () => {
    serveEmpty();
    const stub = stubBoth();
    try {
      await renderList();
      const btn = q("emp-list-export") as HTMLButtonElement;
      expect(btn.disabled, "export disabled on empty").toBe(true);
      expect(btn.title.length, "a stated reason is on the button").toBeGreaterThan(0);
      const before = mock.mock.calls.length;
      await act(async () => {
        btn.click();
      });
      expect(mock.mock.calls.length, "the click fetched nothing").toBe(before);
      expect(stub.captured.length, "no blob was produced").toBe(0);
    } finally {
      await stub.restore();
    }
  });
});
