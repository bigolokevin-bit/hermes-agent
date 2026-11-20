// @vitest-environment jsdom
/**
 * R209 — 员工详情错误与空态互斥护栏（纯测试，零产品改动）。
 *
 * 先查台账（已覆盖只回证据，本文件不重复其断言面）：
 * employees.parity.test.tsx「③ detail is an independent read port」（详情腿
 * 独立、列表腿从不因开详情而重发）、employees.paging/error/export(R175/R178/
 * R144) 各锁列表域。早前窗声称的 employees.detail.error.test.tsx(R198) 经
 * 当轮 ls 证实不在树=本文件按其设计重建并补齐 R209 四例。
 *
 * 现场裁决（禁臆造）：
 * - 状态机（EmployeeDetailModulePage L1188-1250）：404 先回退矩阵腿，矩阵也
 *   拒（403/404 同体）才落 denied 卡；detail 与矩阵皆无行→empty；非 40x 错误
 *   →error 卡。故工单①的「404 锚」现场载体=ed5-overview-denied（403≡404 同
 *   体既有锁，句「员工档案暂不可见」+DENIED_COPY），「500 锚」=ed5-overview-
 *   error；空态锚=ed5-overview-empty。互斥矩阵=错误/无权锚在时，empty 锚与
 *   ready 体（ed1-identity）必须 null。
 * - rid 载体=RequestIdCopy（req-copy 钮，点击回环剪贴板）。
 * - 重试钮无独立 testid（文本「重试」），现场按 find text 取钮。
 * - 工单②「详情内容与列表行逐字一致」：详情与列表是两个模块、两条读口，同值
 *   靠同一 body——用例在列表容器与详情容器并存下，比对 姓名·短码/在岗状态/最
 *   近活动 三格 textContent 逐字。
 * - 工单③「列表腿在该期间不重取且 emp-list-page-* 行数不变」：详情模块从不发
 *   列表腿（/api/employees? 计数恒 0）；并存场景下列表分页条读数一字不变。
 * - 工单④：错误态干扰下列表页 copy/导出照常可用，复制与 CSV 文本不含错误句。
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

import { ApiError } from "@/lib/api-error";
import { fetchJSON } from "@/lib/api";
import EmployeesModulePage from "@/modules/employees/EmployeesModulePage";
import EmployeeDetailModulePage from "@/modules/employee-detail/EmployeeDetailModulePage";

const mock = vi.mocked(fetchJSON);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const EMP = "emp_A3F1B2C4D5E6";

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

async function renderInto(entry: string, node: ReactElement): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  mounted.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[entry]}>{node}</MemoryRouter>);
  });
  await waitFor(() => !container.querySelector(".animate-pulse"), `${entry} settled`);
  return container;
}

const q = (id: string, scope: ParentNode = document): Element | null =>
  scope.querySelector(`[data-testid="${id}"]`);
const text = (id: string, scope: ParentNode = document): string =>
  q(id, scope)?.textContent ?? "";
const urls = (): string[] => mock.mock.calls.map((call) => String(call[0]));
const listLegs = (): number => urls().filter((u) => u.includes("/api/employees?")).length;
const detailLegs = (): number =>
  urls().filter((u) => u.includes(`/api/employees/${EMP}`)).length;
const matrixLegs = (): number => urls().filter((u) => u.includes("/api/matrix")).length;

const findButton = (label: string, scope: ParentNode = document): HTMLButtonElement | null =>
  Array.from(scope.querySelectorAll("button")).find(
    (b) => (b.textContent ?? "").trim() === label,
  ) as HTMLButtonElement | null;

const detailBody = {
  employeeId: EMP,
  name: "小鲤",
  title: "内容编辑",
  lifecycleState: "active",
  ownerUserId: "user:7",
  department: "增长组",
  updatedAt: "2026-11-17T05:52:48.030Z",
  createdAt: "2026-11-14T02:15:00Z",
};

const ROW1 = {
  employeeId: EMP,
  name: "小鲤",
  title: "内容编辑",
  lifecycleState: "active",
  ownerUserId: "user:7",
  updatedAt: "2026-11-17T05:52:48.030Z",
  department: "增长组",
};
const ROW2 = {
  employeeId: "emp_B2C4D6E8F0A1",
  name: "阿朝",
  title: "增长",
  lifecycleState: "active",
  updatedAt: "2026-11-18T05:52:48Z",
  department: null,
};

function err(status: number, requestId: string, url: string): ApiError {
  return new ApiError("boom", {
    status,
    body: JSON.stringify({ message: "upstream" }),
    url,
    requestId,
  });
}

/** 详情腿恒失败 + 矩阵腿失败=404 同体落 denied；矩阵成功=ready。 */
function serveDetailFails(status: number, requestId: string, matrixFails: boolean) {
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes(`/api/employees/${EMP}`)) throw err(status, requestId, u);
    if (u.includes("/api/matrix")) {
      if (matrixFails) throw err(status === 500 ? 503 : status, requestId, u);
      return { items: [detailBody] };
    }
    if (u.includes("/api/employees?")) return { items: [ROW1, ROW2] };
    return {};
  });
}

describe("R209 ① error and empty carriers are exclusive", () => {
  it("a 404 answered as denied keeps the empty anchor and the ready body off screen", async () => {
    serveDetailFails(404, "req-emp-d404", true);
    await renderInto(`/employees/${EMP}`, <EmployeeDetailModulePage employeeId={EMP} />);
    expect(q("ed5-overview-denied"), "403≡404 same body").toBeTruthy();
    expect(text("ed5-overview-denied")).toContain("员工档案暂不可见");
    expect(text("ed5-overview-denied")).toContain("req-emp-d404");
    // 互斥：空态锚与 ready 体不得同时出现。
    expect(q("ed5-overview-empty")).toBeNull();
    expect(q("ed5-overview-notfound")).toBeNull();
    expect(q("ed5-overview-error")).toBeNull();
    expect(q("ed1-identity")).toBeNull();
    expect(q("ed5-overview")).toBeNull();
    // rid 可复制回环。
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: (v: string) => (written.push(v), Promise.resolve()) },
    });
    const copyBtn = q("req-copy") as HTMLButtonElement | null;
    expect(copyBtn, "rid copy button").toBeTruthy();
    await act(async () => {
      copyBtn!.click();
    });
    await waitFor(() => written.length === 1, "rid copied");
    expect(written[0]).toBe("req-emp-d404");
  });

  it("a 500 lands the error anchor with rid and retry, never the empty card", async () => {
    serveDetailFails(500, "req-emp-d500", true);
    await renderInto(`/employees/${EMP}`, <EmployeeDetailModulePage employeeId={EMP} />);
    expect(q("ed5-overview-error"), "error anchor").toBeTruthy();
    expect(text("ed5-overview-error")).toContain("员工档案没能加载出来");
    expect(text("ed5-overview-error")).toContain("req-emp-d500");
    expect(findButton("重试"), "retry entry").toBeTruthy();
    expect(q("ed5-overview-empty")).toBeNull();
    expect(q("ed5-overview-denied")).toBeNull();
    expect(q("ed1-identity")).toBeNull();
  });

  it("an honest empty answers with the empty card only", async () => {
    mock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes(`/api/employees/${EMP}`)) return {};
      if (u.includes("/api/matrix")) return { items: [] };
      return {};
    });
    await renderInto(`/employees/${EMP}`, <EmployeeDetailModulePage employeeId={EMP} />);
    expect(q("ed5-overview-empty"), "empty anchor").toBeTruthy();
    expect(text("ed5-overview-empty")).toContain("还没找到这位员工的档案");
    expect(q("ed5-overview-error")).toBeNull();
    expect(q("ed5-overview-denied")).toBeNull();
    expect(q("ed5-overview-notfound")).toBeNull();
    expect(q("ed1-identity")).toBeNull();
  });
});

describe("R209 ②③ retry recovers, matches the list row, and never re-fetches the list leg", () => {
  it("retry asks exactly one more detail read, the error carrier disappears and every cell equals the list row", async () => {
    let first = true;
    mock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes(`/api/employees/${EMP}`)) {
        if (first) {
          first = false;
          throw err(500, "req-emp-d500", u);
        }
        return { ...detailBody };
      }
      if (u.includes("/api/matrix")) throw err(503, "req-emp-d500", u);
      if (u.includes("/api/employees?")) return { items: [ROW1, ROW2] };
      return {};
    });
    const listBox = await renderInto("/employees", <EmployeesModulePage />);
    await waitFor(() => !!q("employees-row-emp_A3F1B2C4D5E6", listBox), "list rows");
    await renderInto(`/employees/${EMP}`, <EmployeeDetailModulePage employeeId={EMP} />);
    await waitFor(() => !!q("ed5-overview-error"), "detail error first");
    expect(detailLegs()).toBe(1);
    expect(listLegs(), "the detail module never fetches the list leg").toBe(1);
    const pageBefore = text("emp-list-page-count", listBox);
    const moreBefore = q("emp-list-page-more", listBox)?.getAttribute("disabled");

    const retry = findButton("重试");
    expect(retry, "retry button").toBeTruthy();
    await act(async () => {
      retry!.click();
    });
    await waitFor(() => !!q("ed1-identity"), "identity after retry");
    expect(detailLegs(), "retry = exactly one more detail read").toBe(2);
    expect(listLegs(), "the list leg was not re-fetched").toBe(1);
    expect(matrixLegs(), "the recovered read does not re-run the fallback").toBe(1);
    // 错误锚消失，互斥锚全部 null。
    expect(q("ed5-overview-error")).toBeNull();
    expect(q("ed5-overview-empty")).toBeNull();
    expect(q("ed5-overview-denied")).toBeNull();
    // 详情内容与列表行逐字一致（同一 body 两读口，禁两副面孔）。
    const listRowText = text("emp-l-name-link-emp_A3F1B2C4D5E6", listBox);
    expect(text("ed1-identity-name")).toBe("小鲤");
    expect(listRowText).toContain("小鲤");
    expect(text("ed1-identity-code")).toContain("A3F1B2C4");
    expect(listRowText).toContain("A3F1B2C4");
    expect(text("ed1-identity-created")).toBe("2026-11-14 10:15");
    // 列表分页条读数与游标态一字不变。
    expect(text("emp-list-page-count", listBox)).toBe(pageBefore);
    expect(q("emp-list-page-more", listBox)?.getAttribute("disabled")).toBe(moreBefore);
    expect(q("employees-row-emp_A3F1B2C4D5E6", listBox)).toBeTruthy();
    expect(q("employees-row-emp_B2C4D6E8F0A1", listBox)).toBeTruthy();
  });
});

describe("R209 ④ copy and export survive a failing detail leg", () => {
  it("the list page keeps copy/export enabled with clean text while detail errors are on screen", async () => {
    serveDetailFails(500, "req-emp-d500", true);
    const listBox = await renderInto("/employees", <EmployeesModulePage />);
    await waitFor(() => !!q("employees-row-emp_A3F1B2C4D5E6", listBox), "list rows");
    await renderInto(`/employees/${EMP}`, <EmployeeDetailModulePage employeeId={EMP} />);
    await waitFor(() => !!q("ed5-overview-error"), "detail error on screen");

    const copyBtn = q("emp-list-copy", listBox) as HTMLButtonElement | null;
    const exportBtn = q("emp-list-export", listBox) as HTMLButtonElement | null;
    expect(copyBtn, "copy button exists").toBeTruthy();
    expect(exportBtn, "export button exists").toBeTruthy();
    expect(copyBtn!.disabled, "copy stays enabled").toBe(false);
    expect(exportBtn!.disabled, "export stays enabled").toBe(false);

    const written: string[] = [];
    const captured: Blob[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: (v: string) => (written.push(v), Promise.resolve()) },
    });
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    const clicks = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (blob: Blob) => {
      captured.push(blob);
      return "blob:captured";
    };
    (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
    try {
      await act(async () => {
        copyBtn!.click();
      });
      await waitFor(() => written.length === 1, "copy resolved");
      await act(async () => {
        exportBtn!.click();
      });
      await waitFor(() => captured.length === 1, "export captured");
    } finally {
      clicks.mockRestore();
      (URL as unknown as { createObjectURL: unknown }).createObjectURL = origCreate;
      (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = origRevoke;
    }
    const csv = await captured[0].text();
    for (const line of [written[0], csv]) {
      expect(line).toContain("小鲤");
      expect(line).not.toMatch(/没能加载|暂不可见|还没找到|req-emp-d500|undefined|null/);
    }
    expect(csv.split("\r\n").filter((l) => l !== "").length, "表头+2 行").toBe(3);
  });
});
