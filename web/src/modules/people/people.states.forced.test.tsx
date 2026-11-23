// @vitest-environment jsdom
/**
 * PE-07 — `?state=` 四态贯通契约（档案名册 / 组织 / 员工详情）。
 *
 * 每页×每态断言三件事：
 *  1) 专属文案腿（testid 锚 + 该态句），互斥锚与 ready 体一律不在场；
 *  2) 禁词互斥（字面量口径）：denied 腿 ⊄「未接入」，unavailable 腿 ⊄「无权限」
 *     ——403/404 整页话术逐字抄 EmployeesPage.tsx:391,625-655 标杆
 *     （「该数据源尚未开放，或你没有查看权限。请确认后台已接入对应服务，或联系管理员开通权限。」）；
 *  3) 失败腿请求号上屏且可复制（PeopleModulePage.tsx:209-234 RequestId 模式 /
 *     RequestIdCopy req-copy 钮）。
 * 全程 consoleErrors=0（vi.spyOn console.error 计数）。
 *
 * 边界（DONE 记档）：现网无 403 fixture，jsdom 强制态即本契约的真相源；
 * 活体 403/404 腿沿用既有钉（PeopleModulePage.test.tsx L129、
 * OrgModulePage.test.tsx L190），本文件只补禁词互斥的一半。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/lib/api", () => ({ fetchJSON: vi.fn() }));

// 根 barrel 带 vitest 载不动的 .webp 资产（与 people/org 既有测试同一 stub 集）；
// 详情分区走 ui/ui/* 子路径，不受此 mock 影响（employees.detail.zones 实证）。
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
  }) => {
    // 形制剥离：outlined/variant/size 不透传给 DOM（避免未知属性 console 噪声）
    const dom: Record<string, unknown> = { ...rest };
    delete dom.outlined;
    delete dom.variant;
    delete dom.size;
    return (
      <button type="button" onClick={onClick} {...(dom as Record<string, never>)}>
        {children}
      </button>
    );
  },
  Card: ({ children, ...rest }: { children?: ReactNode; [k: string]: unknown }) => (
    <div {...(rest as Record<string, never>)}>{children}</div>
  ),
  CardContent: ({ children, ...rest }: { children?: ReactNode; [k: string]: unknown }) => (
    <div {...(rest as Record<string, never>)}>{children}</div>
  ),
}));

import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import PeopleModulePage from "@/modules/people/PeopleModulePage";
import OrgModulePage from "@/modules/org/OrgModulePage";
import EmployeeDetailPage from "@/pages/EmployeeDetailPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** 标杆口径的 403/404 整页句（EmployeesPage.tsx:655 逐字）。 */
const BENCH_DENIED = "该数据源尚未开放，或你没有查看权限。请确认后台已接入对应服务，或联系管理员开通权限。";

const EMP = "emp_PE07FORCEDSTATE01";
const DETAIL = { employeeId: EMP, name: "小鲤", lifecycleState: "active", createdAt: "2026-11-20T02:00:00Z" };

let container: HTMLDivElement;
let root: Root;
let errorSpy: { mock: { calls: unknown[] }; mockRestore: () => void };

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.mocked(fetchJSON).mockReset();
  expect(errorSpy.mock.calls.length, "consoleErrors=0").toBe(0);
  errorSpy.mockRestore();
  window.history.replaceState({}, "", "/");
});

const q = (id: string): Element | null => container.querySelector(`[data-testid="${id}"]`);
const text = (): string => container.textContent ?? "";

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) await act(async () => {});
}

async function renderPeople(entry: string): Promise<void> {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <PeopleModulePage />
      </MemoryRouter>,
    );
  });
  await settle();
}

async function renderOrg(): Promise<void> {
  await act(async () => {
    root.render(<OrgModulePage />);
  });
  await settle();
}

async function renderDetail(entry: string): Promise<void> {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/employees/:id" element={<EmployeeDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  await settle();
}

const noFetch = (): void => {
  expect(fetchJSON, "强制预览腿一根请求都不发").not.toHaveBeenCalled();
};

// ── 名册 PeopleModulePage ────────────────────────────────────────────────

describe("PE-07 名册 ?state= 四态贯通", () => {
  it("state=loading：骨架腿独占，无其它态锚，零请求", async () => {
    await renderPeople("/identity?tab=people&state=loading");
    expect(q("ppl5-loading")).toBeTruthy();
    expect(q("ppl5-unwired")).toBeNull();
    expect(q("ppl5-denied")).toBeNull();
    expect(q("ppl5-error")).toBeNull();
    expect(q("ppl5-empty")).toBeNull();
    expect(q("ppl5-list")).toBeNull();
    expect(text()).not.toMatch(/undefined|NaN/);
    noFetch();
  });

  it("state=empty：空态腿专属文案，两套禁词都不沾", async () => {
    await renderPeople("/identity?tab=people&state=empty");
    expect(q("ppl5-empty")?.textContent).toContain("目录暂时是空的");
    expect(q("ppl5-empty")?.textContent).toContain("后台还没有登记在册人员");
    expect(text()).not.toContain("未接入");
    expect(text()).not.toContain("无权限");
    expect(q("ppl5-denied")).toBeNull();
    expect(q("ppl5-unwired")).toBeNull();
    expect(q("ppl5-list")).toBeNull();
    noFetch();
  });

  it("state=error：错误腿渲染请求号且可复制（RequestId 模式）", async () => {
    await renderPeople("/identity?tab=people&state=error&rid=PE07-PEOPLE-ERR");
    const error = q("ppl5-error");
    expect(error?.textContent).toContain("没能加载出人员目录");
    expect(error?.textContent).toContain("请求编号 PE07-PEOPLE-ERR");
    expect(q("ppl5-request-id-copy"), "rid 复制钮").toBeTruthy();
    expect(error?.textContent).toContain("重试");
    expect(q("ppl5-unwired")).toBeNull();
    expect(q("ppl5-denied")).toBeNull();
    noFetch();
  });

  it("state=denied：无权限腿专属文案，屏上永不出现「未接入」", async () => {
    await renderPeople("/identity?tab=people&state=denied&rid=PE07-PEOPLE-403");
    const denied = q("ppl5-denied");
    expect(denied?.textContent).toContain("人员目录暂不可见");
    expect(denied?.textContent).toContain(BENCH_DENIED);
    expect(denied?.textContent).toContain("请求编号 PE07-PEOPLE-403");
    expect(q("ppl5-request-id-copy"), "denied 腿 rid 也可复制").toBeTruthy();
    expect(text(), "denied ⊄ 未接入").not.toContain("未接入");
    expect(text()).not.toContain("GAP-");
    expect(q("ppl5-unwired"), "两腿互斥").toBeNull();
    expect(q("ppl5-error")).toBeNull();
    expect(q("ppl5-list")).toBeNull();
    expect(q("ppl5-apply")?.getAttribute("href"), "真出口：开通申请通道").toBe("/approvals");
    noFetch();
  });

  it("活体 403/404 → 未接入腿原样保留，且永不出现「无权限」", async () => {
    for (const status of [403, 404]) {
      vi.mocked(fetchJSON).mockImplementation(((url: string) =>
        Promise.reject(new ApiError("nope", { status, body: "", url }))) as never);
      await renderPeople("/identity?tab=people");
      const unwired = q("ppl5-unwired");
      expect(unwired?.textContent).toContain("人员目录未接入");
      expect(text(), "unavailable ⊄ 无权限").not.toContain("无权限");
      expect(q("ppl5-denied"), "活体 403/404 不冒充 denied 腿").toBeNull();
      expect(q("ppl5-list")).toBeNull();
      vi.mocked(fetchJSON).mockReset();
    }
  });
});

// ── 组织 OrgModulePage ───────────────────────────────────────────────────

describe("PE-07 组织 ?state= 四态贯通", () => {
  it("state=loading：骨架腿独占，零请求", async () => {
    window.history.replaceState({}, "", "/?state=loading");
    await renderOrg();
    expect(q("org5-loading")).toBeTruthy();
    expect(q("org5-denied")).toBeNull();
    expect(q("org5-error")).toBeNull();
    expect(q("org5-empty")).toBeNull();
    expect(q("org5-list")).toBeNull();
    noFetch();
  });

  it("state=empty：空态腿专属文案，不沾两套禁词", async () => {
    window.history.replaceState({}, "", "/?state=empty");
    await renderOrg();
    expect(q("org5-empty")?.textContent).toContain("部门树暂时是空的");
    expect(text()).not.toContain("未接入");
    expect(text()).not.toContain("无权限");
    expect(q("org5-list")).toBeNull();
    noFetch();
  });

  it("state=error&rid=：错误腿把请求号上屏且给复制钮", async () => {
    window.history.replaceState({}, "", "/?state=error&rid=PE07-ORG-ERR");
    await renderOrg();
    const error = q("org5-error");
    expect(error?.textContent).toContain("没能加载出组织架构");
    expect(error?.textContent).toContain("请求编号：PE07-ORG-ERR");
    expect(q("org5-copy-req"), "rid 复制钮").toBeTruthy();
    expect(error?.textContent).toContain("重试");
    noFetch();
  });

  it("state=denied：无权限腿独立成文案，「未接入」与 GAP 编号一律不上屏", async () => {
    window.history.replaceState({}, "", "/?state=denied");
    await renderOrg();
    const denied = q("org5-denied");
    expect(denied?.textContent).toContain("组织与部门暂不可见");
    expect(denied?.textContent).toContain(BENCH_DENIED);
    expect(text(), "denied ⊄ 未接入").not.toContain("未接入");
    expect(text()).not.toContain("GAP-");
    expect(q("org5-apply")?.textContent).toContain("开通申请");
    expect(denied?.textContent, "强制态要有真出口").toContain("重试");
    expect(q("org5-list")).toBeNull();
    noFetch();
  });

  it("活体 403 → 未接入腿合并口径保留（OrgModulePage.test L190 同钉），⊄「无权限」字面", async () => {
    vi.mocked(fetchJSON).mockImplementation(((url: string) =>
      Promise.reject(new ApiError("forbidden", { status: 403, body: "", url }))) as never);
    await renderOrg();
    const denied = q("org5-denied");
    expect(denied?.textContent).toContain("上游部门接口还没有接入本控制台");
    expect(denied?.getAttribute("title"), "GAP-02 只挂活体未接入腿").toBe("GAP-02");
    expect(text()).not.toContain("无权限");
    expect(q("org5-list")).toBeNull();
  });
});

// ── 员工详情 EmployeeDetailPage ──────────────────────────────────────────

describe("PE-07 详情 ?state= 四态贯通（整块替换，分区 Tab 不渲染）", () => {
  const preview = (): Element | null => q("emp-detail-preview");
  const noZones = (): void => {
    expect(container.querySelectorAll('[role="tab"]').length, "强制态下无分区 Tab").toBe(0);
    expect(container.querySelector('[data-testid^="emp-detail-zone-"]')).toBeNull();
  };

  it("state=loading：骨架预览腿独占且零请求", async () => {
    await renderDetail(`/employees/${EMP}?state=loading`);
    expect(preview()?.getAttribute("data-phase")).toBe("loading");
    expect(q("emp-detail-loading")).toBeTruthy();
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
    noZones();
    noFetch();
  });

  it("state=empty：空态腿专属文案，两套禁词都不沾", async () => {
    await renderDetail(`/employees/${EMP}?state=empty`);
    expect(preview()?.getAttribute("data-phase")).toBe("empty");
    expect(text()).toContain("还没找到这位员工的档案");
    expect(text()).not.toContain("未接入");
    expect(text()).not.toContain("无权限");
    noZones();
    noFetch();
  });

  it("state=error&rid=：失败腿请求号上屏且可复制", async () => {
    await renderDetail(`/employees/${EMP}?state=error&rid=PE07-DETAIL-ERR`);
    expect(preview()?.getAttribute("data-phase")).toBe("error");
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("该员工档案没能加载出来");
    expect(alert?.textContent).toContain("请求编号：PE07-DETAIL-ERR");
    expect(q("req-copy"), "rid 复制钮").toBeTruthy();
    expect(alert?.textContent).toContain("重试");
    noZones();
    noFetch();
  });

  it("state=denied：无权限腿标杆口径，屏上永不出现「未接入」", async () => {
    await renderDetail(`/employees/${EMP}?state=denied`);
    expect(preview()?.getAttribute("data-phase")).toBe("denied");
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("该员工档案暂不可见");
    expect(alert?.textContent).toContain(BENCH_DENIED);
    expect(q("req-copy"), "denied 腿也带 rid 复制钮").toBeTruthy();
    expect(text(), "denied ⊄ 未接入").not.toContain("未接入");
    expect(text()).not.toContain("GAP-");
    noZones();
    noFetch();
  });

  it("分区活体失败腿：X-Console-Request-Id 上屏，点击复制回环剪贴板", async () => {
    vi.mocked(fetchJSON).mockImplementation((async (url: string) => {
      const u = String(url);
      if (u.startsWith("/agent-api/api/employees/")) return DETAIL;
      if (u.includes("/api/workstations")) {
        throw new ApiError("网关炸了", { status: 502, body: "", url: u, requestId: "req-ws-7" });
      }
      return { items: [] };
    }) as never);
    await renderDetail(`/employees/${EMP}?zone=assignment`);
    const zone = q("emp-detail-zone-assignment");
    expect(zone, "任职分区挂载").toBeTruthy();
    const alert = zone?.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("任职信息加载失败");
    expect(alert?.textContent).toContain("请求编号：req-ws-7");
    const copy = q("req-copy") as HTMLButtonElement | null;
    expect(copy, "rid 可复制").toBeTruthy();
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: (v: string) => (written.push(v), Promise.resolve()) },
    });
    await act(async () => {
      copy!.click();
    });
    await act(async () => {});
    expect(written, "剪贴板回环写入 rid").toEqual(["req-ws-7"]);
    expect(q("req-copy-state")?.textContent).toContain("已复制");
  });
});
