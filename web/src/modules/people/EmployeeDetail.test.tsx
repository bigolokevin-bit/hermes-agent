// @vitest-environment jsdom
/**
 * Q12 · 名册行内五页签详情（ppl5d-*）行为契约。
 *
 * 只测真实读取面：每个页签首次激活才打自己的端点（URL 逐字断言，含
 * /agent-api 前缀与 query）；失败态写「未取到」+ humanize 原因且互相独立；
 * 真实空集按页签写明原因；权限 409 employee.no_effective_version 是真实状态
 * 而不是崩溃；审计「共 N 条」只认 payload total。数据形制取自实测 probe 样本
 * （q12/probe_*.json），只作为 mock 返回值，不进产线。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/lib/api", () => ({ fetchJSON: vi.fn() }));

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Button: ({ children, onClick, ...rest }: { children?: ReactNode; onClick?: () => void; [k: string]: unknown }) => (
    <button type="button" onClick={onClick} {...(rest as Record<string, never>)}>{children}</button>
  ),
  Card: ({ children, ...rest }: { children?: ReactNode; [k: string]: unknown }) => (
    <div {...(rest as Record<string, never>)}>{children}</div>
  ),
  CardContent: ({ children, className, ...rest }: { children?: ReactNode; className?: string; [k: string]: unknown }) => (
    <div className={className} {...(rest as Record<string, never>)}>{children}</div>
  ),
}));

import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import PeopleModulePage from "@/modules/people/PeopleModulePage";

let container: HTMLDivElement;
let root: Root;
const calls: string[] = [];
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  calls.length = 0;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

const EMP = "emp_86A81CE8FF6F42E142E940B";

const LEDGER = {
  items: [
    {
      employeeId: EMP,
      name: "AgentOS 产品助理",
      lifecycleState: "active",
      department: "产品部",
      updatedAt: "2026-11-21T18:39:20.010Z",
    },
  ],
};

const PROFILE = {
  id: EMP,
  tenantId: "t_seakoi_pilot",
  name: "AgentOS 产品助理",
  title: "产品助理（数字员工 · Pilot）",
  lifecycleState: "active",
  currentVersionId: "empv_037096D42F194AF6B38A3D8F62",
  ownerUserId: "1",
  createdAt: "2026-11-13T22:15:11.641Z",
  updatedAt: "2026-11-21T18:39:20.010Z",
  revision: 5,
  department: "产品部",
};

const WORKSTATIONS = {
  items: [
    {
      id: "ws_7E2653CFA7434BE096344CEAC2",
      employeeId: EMP,
      bindingType: "group",
      channel: "feishu",
      externalRef: "oc_0adeac8168d48d413693f1e64a330db5",
      capabilities: ["reply", "stream"],
      status: "active",
    },
    {
      id: "ws_8D6580432F9A4B38B51337C4FC",
      employeeId: EMP,
      bindingType: "app",
      channel: "feishu",
      externalRef: "2139572cd5c64a2da2e8b000e57ca7ea",
      capabilities: [],
      status: "active",
    },
  ],
};

const EFFECTIVE = {
  employee: PROFILE,
  version: {
    id: "empv_037096D42F194AF6B38A3D8F62",
    employeeId: EMP,
    versionNo: 5,
    effectiveFrom: "2026-11-21T18:39:20.008Z",
    jobDescription: "负责产品助理工作。",
    grantIds: ["gr_3A384C3D17154889A609670E8C", "gr_C5C617BFF9944EF0AE1269667E"],
  },
  grants: [
    {
      id: "gr_3A384C3D17154889A609670E8C",
      employeeId: EMP,
      scopeType: "channel",
      resourceSelector: { types: ["chat"] },
      actions: ["send"],
      source: "role",
      expiresAt: "2026-12-31T00:00:00.000Z",
    },
    {
      id: "gr_C5C617BFF9944EF0AE1269667E",
      employeeId: EMP,
      scopeType: "business_api",
      resourceSelector: { type: "channel_event" },
      actions: ["execute"],
      source: "temporary",
      expiresAt: "2027-12-31T00:00:00.000Z",
    },
  ],
  resolvedAt: "2026-11-23T11:38:24.746Z",
  snapshotRef: "snap_7d6dfe803428c0920db8ec8521e3a5f4",
};

const TASKS = {
  items: [
    {
      taskId: "tk_89F5AEF75D814C17BD1FDFC8BB",
      title: "L6 TSK03 R2 探针任务",
      assignee: { type: "employee", id: EMP },
      createdBy: { type: "human", id: "1" },
      source: { kind: "manual" },
      priority: "normal",
      status: "open",
      progressNote: null,
      createdAt: "2026-11-17T16:58:50.210Z",
      updatedAt: "2026-11-17T16:58:50.210Z",
    },
  ],
};

const AUDIT = {
  events: [
    {
      eventId: "ev_32305B3550034BD3877494A0D7",
      occurredAt: "2026-11-22T09:56:56.621Z",
      sourceSystem: "policy",
      actor: { type: "system", id: "employee-api" },
      action: "budget.ledger_entry_applied",
      resource: { type: "employee", id: EMP },
      outcome: "success",
      runId: "rn_01M81AZV6P7TAX8KGXKKTEVZG1",
    },
  ],
  total: 137,
  hasMore: true,
};

type Router = (url: string) => Promise<unknown>;

/** 默认：名册走员工台账回退（前两探测 404），五个详情端点给实测形制样本。 */
const defaultRoute: Router = (url) => {
  if (url.includes("/api/employees")) return Promise.resolve(LEDGER);
  if (url.startsWith("/agent-api/api/employee?id=")) return Promise.resolve(PROFILE);
  if (url.startsWith("/agent-api/api/workstations?id=")) return Promise.resolve(WORKSTATIONS);
  if (url.startsWith("/agent-api/api/effective-config?id=")) return Promise.resolve(EFFECTIVE);
  if (url.startsWith("/agent-api/api/tasks?assignee=")) return Promise.resolve(TASKS);
  if (url.startsWith("/agent-api/api/audit?resourceId=")) return Promise.resolve(AUDIT);
  return Promise.reject(new ApiError("not found", { status: 404, body: "", url }));
};

function mockApi(route: Router = defaultRoute) {
  vi.mocked(fetchJSON).mockImplementation(((url: string) => {
    calls.push(url);
    return route(url);
  }) as never);
}

async function settle() {
  for (let i = 0; i < 4; i += 1) await act(async () => {});
}

async function render() {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/identity?tab=people"]}>
        <PeopleModulePage />
      </MemoryRouter>,
    );
  });
  await settle();
}

async function click(testid: string) {
  const el = container.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
  if (!el) throw new Error(`missing testid: ${testid}`);
  await act(async () => {
    el.click();
  });
  await settle();
}

const openDetail = () => click(`ppl5d-open-${EMP}`);
const text = (testid: string) => container.querySelector(`[data-testid="${testid}"]`)?.textContent ?? "";
/** 键值行的「值」：dt 是标签，dd 才是载荷里的真值。 */
const value = (key: string) => container.querySelector(`[data-testid="ppl5d-row-${key}"] dd`)?.textContent ?? "";
const had = (prefix: string) => calls.some((u) => u.startsWith(prefix) || u.includes(prefix));

describe("people roster in-page employee detail (ppl5d)", () => {
  it("opens from a roster row: five tabs, lazy 档案 with real fields", async () => {
    mockApi();
    await render();
    expect(container.querySelector('[data-testid="ppl5-list"]')).toBeTruthy();

    await openDetail();

    const detail = container.querySelector('[data-testid="ppl5d-detail"]');
    expect(detail).toBeTruthy();
    // 名册视图让位给页内详情（零路由：URL 不变、无新页面）。
    expect(container.querySelector('[data-testid="ppl5-list"]')).toBeNull();
    for (const id of ["profile", "assignments", "permissions", "tasks", "audit"]) {
      expect(container.querySelector(`[data-testid="ppl5d-tab-${id}"]`)).toBeTruthy();
    }
    expect(container.querySelector('[data-testid="ppl5d-tab-profile"]')?.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector('[role="tablist"]')).toBeTruthy();
    expect(container.querySelector('[role="tabpanel"]')).toBeTruthy();

    // 首次激活只打档案端点；其余四端点不得预取。
    expect(calls).toContain(`/agent-api/api/employee?id=${EMP}`);
    expect(had("/api/workstations")).toBe(false);
    expect(had("/api/effective-config")).toBe(false);
    expect(had("/api/tasks?assignee")).toBe(false);
    expect(had("/api/audit?resourceId")).toBe(false);

    // 真实字段：姓名与部门来自 /api/employee 载荷，不是造出来的。
    expect(value("name")).toBe("AgentOS 产品助理");
    expect(value("department")).toBe("产品部");
    expect(value("title")).toBe("产品助理（数字员工 · Pilot）");
    expect(value("status")).toContain("在岗");
    expect(value("version")).toContain("第 5 版");
    expect(value("created")).toBe("2026-11-14 06:15");
    expect(text("ppl5d-panel-profile")).toBeTruthy();
  });

  it("missing profile values render 「—」, never 0", async () => {
    mockApi((url) => {
      if (url.includes("/api/employees")) return Promise.resolve(LEDGER);
      if (url.startsWith("/agent-api/api/employee?id=")) {
        return Promise.resolve({ id: EMP, name: "小鲤", lifecycleState: "active" });
      }
      return defaultRoute(url);
    });
    await render();
    await openDetail();
    expect(value("title")).toBe("—");
    expect(value("department")).toBe("—");
    expect(value("owner")).toBe("—");
    expect(value("version")).toBe("—");
    expect(value("created")).toBe("—");
    expect(value("updated")).toBe("—");
    expect(text("ppl5d-panel-profile")).not.toMatch(/第 0 版|: 0|\b0\b/);
  });

  it("each tab switch hits its exact endpoint URL", async () => {
    mockApi();
    await render();
    await openDetail();

    await click("ppl5d-tab-assignments");
    expect(calls).toContain(`/agent-api/api/workstations?id=${EMP}&limit=20`);
    expect(container.querySelector('[data-testid="ppl5d-row-assignment-0"]')?.textContent).toContain("feishu");
    expect(container.querySelector('[data-testid="ppl5d-row-assignment-0"]')?.textContent).toContain("reply / stream");

    await click("ppl5d-tab-permissions");
    expect(calls).toContain(`/agent-api/api/effective-config?id=${EMP}`);
    expect(value("resolved")).toBe("2026-11-23 19:38");
    expect(value("version")).toContain("v5");
    expect(container.querySelector('[data-testid="ppl5d-row-grant-0"]')?.textContent).toContain("渠道");
    expect(container.querySelector('[data-testid="ppl5d-row-grant-1"]')?.textContent).toContain("业务接口");
    expect(container.querySelector('[data-testid="ppl5d-row-grant-1"]')?.textContent).toContain("channel_event");

    await click("ppl5d-tab-tasks");
    expect(calls).toContain(`/agent-api/api/tasks?assignee=${encodeURIComponent(`employee:${EMP}`)}&limit=20`);
    expect(container.querySelector('[data-testid="ppl5d-row-task-0"]')?.textContent).toContain("L6 TSK03 R2 探针任务");
    expect(container.querySelector('[data-testid="ppl5d-row-task-0"]')?.textContent).toContain("待处理");
    expect(container.querySelector('[data-testid="ppl5d-row-task-0"]')?.textContent).toContain("手动");

    await click("ppl5d-tab-audit");
    expect(calls).toContain(`/agent-api/api/audit?resourceId=${EMP}&limit=50`);
    expect(container.querySelector('[data-testid="ppl5d-row-audit-0"]')?.textContent).toContain("budget.ledger_entry_applied");
    expect(container.querySelector('[data-testid="ppl5d-row-audit-0"]')?.textContent).toContain("policy");

    // 切回已取到的页签走缓存：档案端点仍只有首次那一次。
    await click("ppl5d-tab-profile");
    expect(calls.filter((u) => u === `/agent-api/api/employee?id=${EMP}`)).toHaveLength(1);
  });

  it("audit 「共 N 条」comes from payload total; absent total writes no count", async () => {
    mockApi((url) => {
      if (url.startsWith("/agent-api/api/audit?resourceId=")) {
        return Promise.resolve({ events: AUDIT.events, hasMore: false });
      }
      return defaultRoute(url);
    });
    await render();
    await openDetail();
    await click("ppl5d-tab-audit");
    expect(container.querySelector('[data-testid="ppl5d-audit-total"]')).toBeNull();
    expect(container.querySelector('[data-testid="ppl5d-detail"]')?.textContent).not.toContain("共 1 条");

    mockApi();
    await click("ppl5d-back");
    await openDetail();
    await click("ppl5d-tab-audit");
    expect(text("ppl5d-audit-total")).toContain("共 137 条");
  });

  it("权限 409 employee.no_effective_version is a real state, not a crash", async () => {
    mockApi((url) => {
      if (url.startsWith("/agent-api/api/effective-config?id=")) {
        return Promise.reject(
          new ApiError("该员工尚无生效版本。", {
            status: 409,
            body: JSON.stringify({ detail: { error: "employee.no_effective_version", message: "该员工尚无生效版本。" } }),
            url,
          }),
        );
      }
      return defaultRoute(url);
    });
    await render();
    await openDetail();
    await click("ppl5d-tab-permissions");

    expect(text("ppl5d-empty")).toContain("该员工尚无生效版本");
    expect(container.querySelector('[data-testid="ppl5d-failed"]')).toBeNull();
    // 其它页签照常可用（互不牵连）。
    await click("ppl5d-tab-audit");
    expect(container.querySelector('[data-testid="ppl5d-row-audit-0"]')).toBeTruthy();
  });

  it("任务 failure shows 未取到 + humanized reason with no fake 0, other tabs unaffected", async () => {
    mockApi((url) => {
      if (url.startsWith("/agent-api/api/tasks?assignee=")) {
        return Promise.reject(
          new ApiError("服务暂时不可用。", { status: 502, body: "", url, requestId: "req-q12-tasks" }),
        );
      }
      return defaultRoute(url);
    });
    await render();
    await openDetail();
    await click("ppl5d-tab-tasks");

    const failed = container.querySelector('[data-testid="ppl5d-failed"]');
    expect(failed).toBeTruthy();
    expect(text("ppl5d-failed")).toContain("未取到");
    expect(text("ppl5d-failed-reason")).toContain("服务暂时不可用。");
    expect(text("ppl5d-failed-req")).toContain("req-q12-tasks");
    expect(text("ppl5d-failed")).not.toMatch(/共 0|0 条|0 人/);
    expect(container.querySelector('[data-testid="ppl5d-empty"]')).toBeNull();

    // 独立：换到审计仍能取到真数据。
    await click("ppl5d-tab-audit");
    expect(container.querySelector('[data-testid="ppl5d-row-audit-0"]')).toBeTruthy();

    // 重试按钮再打一次同一端点。
    await click("ppl5d-tab-tasks");
    const before = calls.filter((u) => u.startsWith("/agent-api/api/tasks")).length;
    await click("ppl5d-retry-tasks");
    expect(calls.filter((u) => u.startsWith("/agent-api/api/tasks")).length).toBe(before + 1);
  });

  it("genuine empty lists state the concrete reason per tab", async () => {
    mockApi((url) => {
      if (url.startsWith("/agent-api/api/workstations?id=")) return Promise.resolve({ items: [] });
      if (url.startsWith("/agent-api/api/effective-config?id=")) {
        return Promise.resolve({ ...EFFECTIVE, grants: [] });
      }
      if (url.startsWith("/agent-api/api/tasks?assignee=")) return Promise.resolve({ items: [] });
      if (url.startsWith("/agent-api/api/audit?resourceId=")) return Promise.resolve({ events: [], total: 0, hasMore: false });
      return defaultRoute(url);
    });
    await render();
    await openDetail();

    await click("ppl5d-tab-assignments");
    expect(text("ppl5d-empty")).toContain("该员工暂无绑定的工作站");

    await click("ppl5d-tab-permissions");
    expect(text("ppl5d-empty")).toContain("当前生效配置未返回任何授权");

    await click("ppl5d-tab-tasks");
    expect(text("ppl5d-empty")).toContain("暂无指派给该员工的任务");

    await click("ppl5d-tab-audit");
    expect(text("ppl5d-empty")).toContain("暂无该员工的审计事件");
    // 空集不写「共 0 条」冒充计数。
    expect(container.querySelector('[data-testid="ppl5d-audit-total"]')).toBeNull();
  });

  it("back restores the roster view without refetching the list", async () => {
    mockApi();
    await render();
    const rosterFetches = calls.filter((u) => u.includes("/api/employees")).length;
    await openDetail();
    expect(container.querySelector('[data-testid="ppl5d-detail"]')).toBeTruthy();

    await click("ppl5d-back");

    expect(container.querySelector('[data-testid="ppl5d-detail"]')).toBeNull();
    expect(container.querySelector('[data-testid="ppl5-list"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="ppl5-name"]')?.textContent).toContain("AgentOS 产品助理");
    expect(calls.filter((u) => u.includes("/api/employees")).length).toBe(rosterFetches);
  });
});
