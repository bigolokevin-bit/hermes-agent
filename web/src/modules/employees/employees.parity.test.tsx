// @vitest-environment jsdom
/**
 * R134 — 员工列表 ↔ 行内预览 ↔ 详情身份卡 逐字同源护栏（纯测试，零产品改动）。
 *
 * 已覆盖只回证据（不重复写）：preview↔identity 六字段逐字 = R68
 * edx-parity；identity 部门三态 = R96 ed1-identity-department 用例；列表行
 * 三态与桶 = R96；copy/CSV department 列值 = R110。本文件补缺口：
 * ①行格（表体）作为第三方与 preview/identity 的逐字同屏对照；②copy 与
 * export 的该行 department 列与屏上行格逐字同句（R110 断的是常量不是 DOM）；
 * ③详情走独立读口（现状裁决，同 R120：详情不是复用列表行数据，列表腿从不
 * 重取）；④路由离开再回来 = URL 参数为唯一状态源，重挂请求逐字相等、行序
 * 一致（内存游标不持久化 = R79 裁决）。
 * 现场记录：行内预览没有部门位、identity 没有「最近活跃」位（其时间是
 * createdAt 语义，R68 裁决），对应字段按两位比对。
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
import EmployeeDetailModulePage from "@/modules/employee-detail/EmployeeDetailModulePage";
import EmployeesModulePage, {
  DEPT_UNLABELED_LABEL,
  FIELD_MISSING,
} from "@/modules/employees/EmployeesModulePage";

const mock = vi.mocked(fetchJSON);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const E1 = "emp_A3F1B2C4D5E6";
const E2 = "emp_B2C4D6E8F0A1";
const E3 = "emp_C3D5E7F9A1B2";

const ROW1 = {
  employeeId: E1,
  name: "小鲤",
  title: "内容编辑",
  lifecycleState: "active",
  updatedAt: "2026-11-17T05:52:48.030Z",
  department: "增长组",
};
const ROW2 = {
  employeeId: E2,
  name: "阿朝",
  title: "增长",
  lifecycleState: "active",
  updatedAt: "2026-11-18T05:52:48.030Z",
  department: null, // 键在值空 = 未标注部门
};
const ROW3 = {
  employeeId: E3,
  name: "新工",
  title: "数据",
  lifecycleState: "weird_state",
  updatedAt: "2026-11-19T01:00:00Z",
  // 无 department 键 = 该字段未返回
};

const ROWS = [ROW1, ROW2, ROW3];

/** 详情读口对三个员工返回同值 body（列表=详情同一真值源）。 */
const detailBody = (row: (typeof ROWS)[number]) => ({
  id: row.employeeId,
  tenantId: "t_seakoi_pilot",
  name: row.name,
  title: row.title,
  lifecycleState: row.lifecycleState,
  ownerUserId: "1",
  createdAt: "2026-11-14T02:15:00Z",
  updatedAt: row.updatedAt,
  ...("department" in row ? { department: row.department } : {}),
});

function serve() {
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/employees?")) return { items: ROWS };
    for (const row of ROWS) {
      if (u.includes(`/api/employees/${row.employeeId}`)) return detailBody(row);
    }
    return {};
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

const renderList = (entry = "/employees") =>
  renderInto(entry, <EmployeesModulePage />);
const renderDetail = (id: string) =>
  renderInto(`/employees/${id}`, <EmployeeDetailModulePage employeeId={id} />);

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const urls = (): string[] => mock.mock.calls.map((c) => String(c[0]));
const listUrls = () => urls().filter((u) => u.includes("/api/employees?"));
const detailUrls = (id: string) =>
  urls().filter((u) => u.includes(`/api/employees/${id}`));

/** 表体行格：姓名/工号/状态/部门/最近活跃（部门与活跃格用 data-label）。 */
const rowCell = (id: string, label: "部门" | "最近活跃") =>
  document.querySelector(`[data-testid="emp-l-name-link-${id}"] [data-label="${label}"]`)
    ?.textContent ?? "";
const rowName = (id: string) =>
  document.querySelector(`[data-testid="emp-l-name-link-${id}"] span span`)?.textContent ?? "";
const rowCode = (id: string) => q(`employees-code-${id}`)?.textContent ?? "";
/** 状态格=独立「可上岗」格子（骨架八列里的第三列）。 */
const rowState = (id: string) => q(`emp-life-${id}`)?.textContent ?? "";

const openPreview = async (id: string) => {
  const btn = q(`emp-row-preview-toggle-${id}`) as HTMLButtonElement | null;
  expect(btn, `preview toggle of ${id}`).toBeTruthy();
  await act(async () => {
    btn!.click();
  });
  await waitFor(() => !!q(`emp-row-preview-${id}`), `preview of ${id}`);
};
const previewDds = (id: string) =>
  Array.from(q(`emp-row-preview-${id}`)?.querySelectorAll("dd") ?? []).map(
    (el) => el.textContent ?? "",
  );

const rowOrder = () =>
  Array.from(document.querySelectorAll('[data-testid^="employees-row-emp_"]')).map((el) =>
    String(el.getAttribute("data-testid")).replace("employees-row-", ""),
  );

describe("R134 ① row cell joins the preview/detail verbatim matrix", () => {
  it("name, masked code and lifecycle read the same in all three surfaces", async () => {
    serve();
    await renderList();
    await openPreview(E1);
    const pv = previewDds(E1);
    await renderDetail(E1);

    const name = rowName(E1);
    expect(name, "row name is 小鲤").toBe("小鲤");
    expect(pv[0], "preview name == row").toBe(name);
    expect(q("ed1-identity-name")?.textContent, "identity name == row").toBe(name);

    const code = rowCode(E1);
    expect(code, "masked code on the row").toBe("员工 · A3F1B2C4");
    expect(pv[1], "preview code == row").toBe(code);
    expect(q("ed1-identity-code")?.textContent, "identity code == row").toBe(code);

    // 生命周期人话：行徽标、预览状态位、identity 在职态三处逐字。
    // 生命周期人话：行徽标格、预览在职态位、identity 在职态三处逐字。
    const state = rowState(E1);
    expect(state.length, "row lifecycle badge has a human label").toBeGreaterThan(0);
    expect(pv[2], "preview state == row").toBe(state);
    expect(q("ed1-identity-state")?.textContent, "identity state == row").toBe(state);
    const dept = rowCell(E1, "部门");
    expect(dept, "row department verbatim").toBe("增长组");
    expect(q("ed1-identity-department")?.textContent, "identity dept == row").toBe(dept);
    // 最近活跃：骨架八列里不再单占一列，口径值挂整行链接 title；预览里仍是同一句。
    const link = q(`emp-l-name-link-${E1}`) as HTMLAnchorElement | null;
    expect(link?.getAttribute("title"), "row active is a BJT minute").toContain("2026-11-17 13:52");
    expect(pv[4], "preview active == row").toBe("2026-11-17 13:52");
  });

  it("the three-state department sentence is identical in row and identity", async () => {
    serve();
    await renderList();
    expect(rowCell(E2, "部门"), "key present, empty value").toBe(DEPT_UNLABELED_LABEL);
    expect(rowCell(E3, "部门"), "key missing").toBe(FIELD_MISSING);
    await renderDetail(E2);
    expect(q("ed1-identity-department")?.textContent).toBe(DEPT_UNLABELED_LABEL);
    clearScreen();
    await renderDetail(E3);
    expect(q("ed1-identity-department")?.textContent).toBe(FIELD_MISSING);
  });
});

describe("R134 ② copy and export carry the on-screen department sentence", () => {
  it("emp-list-copy and emp-list-export lines match the row cells", async () => {
    serve();
    await renderList();
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: (t: string) => { written.push(t); return Promise.resolve(); } },
    });
    await act(async () => {
      (q("emp-list-copy") as HTMLButtonElement).click();
    });
    await waitFor(() => written.length === 1, "copy text");

    const captured: Blob[] = [];
    const clicks = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        void this.download;
      });
    const orig = URL.createObjectURL;
    URL.createObjectURL = ((blob: Blob) => {
      captured.push(blob);
      return "blob:emp134";
    }) as typeof URL.createObjectURL;
    try {
      await act(async () => {
        (q("emp-list-export") as HTMLButtonElement).click();
      });
    } finally {
      URL.createObjectURL = orig;
      clicks.mockRestore();
    }
    expect(captured).toHaveLength(1);

    const copyLines = written[0].split("\n").filter((l) => l !== "");
    const csvText = await captured[0].text();
    const csvLines = csvText.split("\r\n").filter((l) => l !== "");
    expect(copyLines[0], "copy header carries department").toContain("department");
    expect(csvLines[0], "csv header carries department").toContain("department");

    const cell = (lines: string[], rowStart: string) => {
      const line = lines.find((l) => l.includes(rowStart));
      expect(line, `line for ${rowStart}`).toBeTruthy();
      return (line as string).split(",").at(-1)?.replace(/^"|"$/g, "");
    };
    expect(cell(copyLines, "阿朝")).toBe(DEPT_UNLABELED_LABEL);
    expect(cell(csvLines, "阿朝")).toBe(DEPT_UNLABELED_LABEL);
    // 键缺失的行：copy 与导出都落「该字段未返回」（与行格同句）。
    expect(cell(copyLines, "新工")).toBe(FIELD_MISSING);
    expect(cell(csvLines, "新工")).toBe(FIELD_MISSING);
    // 真值行逐字。
    expect(cell(copyLines, "小鲤")).toBe("增长组");
    expect(cell(csvLines, "小鲤")).toBe("增长组");
  });
});

describe("R134 ③④ the detail leg never touches the list; remount replays", () => {
  it("opening the detail adds exactly its own read-port call, never a list refetch", async () => {
    serve();
    await renderList();
    const listBefore = listUrls().length;
    await renderDetail(E1);
    expect(listUrls().length, "the list leg never refetches").toBe(listBefore);
    expect(detailUrls(E1).length, "one dedicated detail read").toBe(1);
  });

  it("a remount with the same URL sends a byte-identical query and keeps row order", async () => {
    serve();
    const entry = "/employees?lifecycle=active&sort=name&dir=desc";
    await renderList(entry);
    const firstQuery = listUrls()[0];
    const orderBefore = rowOrder();
    clearScreen();
    mock.mockClear();
    serve();
    await renderList(entry);
    expect(listUrls()[0], "same URL replays the same query").toBe(firstQuery);
    expect(rowOrder(), "row order replays identically").toEqual(orderBefore);
  });
});
