// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import type { ReactElement, ReactNode } from "react";

vi.mock("@/lib/api", () => ({ fetchJSON: vi.fn() }));

// @nous-research/ui ships .webp assets that node-sser vitest cannot load (no
// existing suite in this repo ever imported it — T12 included). Stub the four
// primitives with the DOM shapes the module relies on.
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
import EmployeeDetailModulePage from "@/modules/employee-detail/EmployeeDetailModulePage";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const EMP = "emp_A3F1B2C4D5E6";

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function mockApi(handler: (url: string) => Promise<unknown>) {
  vi.mocked(fetchJSON).mockImplementation(((url: string) => handler(url)) as never);
}

const silent502 = (url: string, requestId = "req-default") =>
  Promise.reject(new ApiError("服务暂时不可用。", { status: 502, body: "", url, requestId }));
const missing = (url: string) =>
  Promise.reject(new ApiError("not found", { status: 404, body: "", url }));
const forbidden = (url: string) =>
  Promise.reject(new ApiError("forbidden", { status: 403, body: "", url }));

async function renderAt(element: ReactElement, entry: string) {
  await act(async () => {
    root.render(
      <MemoryRouter key={entry} initialEntries={[entry]}>
        <Routes>
          <Route path="/employees/:employeeId" element={element} />
        </Routes>
      </MemoryRouter>,
    );
  });
  // flush the fetch promise chain
  for (let i = 0; i < 4; i += 1) await act(async () => {});
}

const at = (zone?: string) =>
  `/employees/${encodeURIComponent(EMP)}${zone ? `?zone=${zone}` : ""}`;

const page = <EmployeeDetailModulePage employeeId={EMP} />;

function SearchProbe() {
  const loc = useLocation();
  useEffect(() => {
    document.body.setAttribute("data-r47-search", loc.search);
  }, [loc.search]);
  return null;
}

async function renderStack(r: Root, entries: string[], element: ReactNode) {
  await act(async () => {
    r.render(
      <MemoryRouter initialEntries={entries}>
        <Routes>
          <Route path="/employees/:employeeId" element={element} />
        </Routes>
        <SearchProbe />
      </MemoryRouter>,
    );
  });
  for (let i = 0; i < 4; i += 1) await act(async () => {});
}

describe("EmployeeDetailModulePage — identity card (R45)", () => {
  const qid = (t: string) => container.querySelector(`[data-testid="${t}"]`);

  it("ed1-identity renders name/code/role/state/reports/created from the real detail body", async () => {
    mockApi((url) =>
      url.includes(`/api/employees/${encodeURIComponent(EMP)}`)
        ? Promise.resolve({
            id: EMP,
            name: "AgentOS 产品助理",
            title: "产品助理（数字员工 · Pilot）",
            lifecycleState: "active",
            ownerUserId: "1",
            createdAt: "2026-11-13T22:15:30Z",
            department: null,
            duty: null,
            asOf: "2026-11-20T07:00:00Z",
          })
        : silent502(url),
    );
    await renderAt(page, at());
    expect(qid("ed1-identity")).toBeTruthy();
    expect(qid("ed1-identity-name")?.textContent).toBe("AgentOS 产品助理");
    expect(qid("ed1-identity-code")?.textContent).toBe("A3F1B2C4");
    expect(qid("ed1-identity-code")?.getAttribute("title")).toBe(EMP);
    expect(qid("ed1-identity-role")?.textContent).toBe("产品助理（数字员工 · Pilot）");
    expect(qid("ed1-identity-state")?.textContent).toBe("在岗");
    expect(qid("ed1-identity-reports")?.textContent).toBe("—");
    expect(qid("ed1-identity-reports")?.getAttribute("title")).toContain("后台没有回传这位员工的汇报对象");
    expect(qid("ed1-identity-created")?.textContent).toBe("2026-11-14 06:15");
    expect(qid("ed1-identity")?.textContent).not.toContain("emp_");
  });

  it("an answered reports-to becomes a real /employees link with the masked label", async () => {
    const MGR = "emp_BEEF000011112222333344AA";
    mockApi((url) =>
      url.includes(`/api/employees/${encodeURIComponent(EMP)}`)
        ? Promise.resolve({ id: EMP, name: "小鲤", reportsTo: `employee:${MGR}`, reportsToName: "主管", lifecycleState: "active" })
        : silent502(url),
    );
    await renderAt(page, at());
    const link = qid("ed1-identity-reports")?.querySelector("a") as HTMLAnchorElement | null;
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toBe(`/employees/${MGR}`);
    expect(link?.textContent).toBe("主管 · BEEF0000");
    expect(link?.getAttribute("title")).toBe(`employee:${MGR}`);
  });

  it("unknown lifecycle reads 待核实 and every missing field dashes with a stated reason", async () => {
    mockApi((url) =>
      url.includes(`/api/employees/${encodeURIComponent(EMP)}`)
        ? Promise.resolve({ id: EMP, lifecycleState: "weird_state" })
        : silent502(url),
    );
    await renderAt(page, at());
    expect(qid("ed1-identity-state")?.textContent).toBe("待核实");
    expect(qid("ed1-identity-state")?.getAttribute("title")).toBe("weird_state");
    for (const id of ["name", "role", "reports", "created"]) {
      expect(qid(`ed1-identity-${id}`)?.textContent).toBe("—");
      expect(qid(`ed1-identity-${id}`)?.getAttribute("title")).toContain("后台没有回传");
    }
    expect(container.textContent).not.toMatch(/\?\? 0|undefined|null/);
  });
});

describe("EmployeeDetailModulePage — overview", () => {
  it("loading: skeleton, no engineering text", async () => {
    mockApi(() => new Promise(() => {}));
    await renderAt(page, at());
    expect(container.querySelector('[data-testid="ed5-overview-loading"]')).toBeTruthy();
    expect(container.textContent).not.toMatch(/emp_|human:|undefined/);
  });

  it("ready from the employee detail endpoint: name · code, lifecycle badge", async () => {
    mockApi((url) =>
      url.includes(`/api/employees/${encodeURIComponent(EMP)}`)
        ? Promise.resolve({ name: "小鲤", title: "客服专员", lifecycleState: "active", ownerUserId: "human:kevin", updatedAt: "2026-11-18T02:30:00Z" })
        : silent502(url),
    );
    await renderAt(page, at());
    const card = container.querySelector('[data-testid="ed5-overview"]');
    expect(card?.textContent).toContain("小鲤 · A3F1B2C4");
    expect(card?.textContent).toContain("在岗");
    expect(card?.textContent).toContain("真人操作");
    expect(card?.textContent).toContain("2026-11-18 10:30");
    expect(card?.textContent).not.toContain(`emp_`);
    expect(card?.querySelector("dd")?.getAttribute("title")).toBe(EMP);
  });

  it("detail 404 falls back to the matrix row before declaring missing", async () => {
    mockApi((url) =>
      url.includes(`/api/employees/`)
        ? missing(url)
        : url.includes("/api/matrix")
          ? Promise.resolve({ items: [{ name: "阿澜", lifecycleState: "paused", risk: "medium" }] })
          : silent502(url),
    );
    await renderAt(page, at());
    const card = container.querySelector('[data-testid="ed5-overview"]');
    expect(card?.textContent).toContain("阿澜");
    expect(card?.textContent).toContain("已暂停");
  });

  it("error carries the plain sentence, request id, and a retry", async () => {
    mockApi((url) => silent502(url, "req-77"));
    await renderAt(page, at());
    const err = container.querySelector('[data-testid="ed5-overview-error"]');
    expect(err?.textContent).toContain("请求编号：req-77");
    expect(err?.textContent).toContain("重试");
    expect(err?.textContent).not.toMatch(/HTTP 502|ApiError/);
  });

  it("empty overview: cause shown, never a blank pane", async () => {
    mockApi((url) => (url.includes("/api/employees/") ? Promise.resolve({}) : Promise.resolve({ items: [] })));
    await renderAt(page, at());
    const card = container.querySelector('[data-testid="ed5-overview-empty"]');
    expect(card?.textContent).toContain("还没找到这位员工的档案");
  });
});

describe("EmployeeDetailModulePage — capability (reuse: /v1/matrix/employees)", () => {
  it("missing values render 待核实, never a fake 0", async () => {
    mockApi((url) =>
      url.includes("/api/matrix")
        ? Promise.resolve({ items: [{ capabilities: ["数据查询", { name: "外呼" }], scope: "系统内置" }] })
        : Promise.resolve({ items: [] }),
    );
    await renderAt(page, at("config"));
    const card = container.querySelector('[data-testid="ed5-capability"]');
    expect(card?.textContent).toContain("数据查询");
    expect(card?.textContent).toContain("外呼");
    expect(card?.textContent).toContain("待核实");
    expect(card?.textContent).not.toMatch(/风险级别\s*0/);
  });

  it("403 → permission sentence, not a fake empty", async () => {
    mockApi((url) => forbidden(url));
    await renderAt(page, at("config"));
    const denied = container.querySelector('[data-testid="ed5-capability-denied"]');
    expect(denied?.textContent).toContain("这块数据还没接入，或你没有查看权限");
    expect(denied?.textContent).toContain("重试");
  });

  it("404 → honest not-connected state", async () => {
    mockApi((url) => missing(url));
    await renderAt(page, at("config"));
    const denied = container.querySelector('[data-testid="ed5-capability-denied"]');
    expect(denied?.textContent).toContain("还没接入");
  });
});

describe("EmployeeDetailModulePage — approvals / runs / audit", () => {
  it("approval rows link to the real approvals surface; raw task id stays in title", async () => {
    mockApi((url) =>
      url.includes("/api/approvals")
        ? Promise.resolve({
            items: [
              { taskId: "task_9F3A1B2C3D", status: "pending", title: "预算上调", createdAt: "2026-11-18T04:00:00Z", amountUsd: 300 },
            ],
          })
        : Promise.resolve({}),
    );
    await renderAt(page, at("approvals"));
    const card = container.querySelector('[data-testid="ed5-approvals"]');
    const link = card?.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/approvals");
    expect(link?.getAttribute("title")).toBe("task_9F3A1B2C3D");
    expect(card?.textContent).not.toContain("task_9F3A1B2C3D");
    expect(card?.textContent).toContain("待审批");
    expect(card?.textContent).toContain("2026-11-18 12:00");
    expect(card?.textContent).toContain("$300.00");
  });

  it("runs: USD money, Beijing minute time, zero tokens stay 0", async () => {
    mockApi((url) =>
      url.includes("/api/runs")
        ? Promise.resolve({
            items: [{ runId: "run_X1Y2Z3", status: "completed", startedAt: "2026-11-18T16:30:00Z", costUsd: 2.5, totalTokens: 0 }],
          })
        : Promise.resolve({}),
    );
    await renderAt(page, at("runs"));
    const card = container.querySelector('[data-testid="ed5-runs"]');
    // R48: 每行真深链。R48b: href 走 /runs 页支持的 run 查询参数
    // （/runs/<id> 无路由=死链；活体实证 /runs?run=<id> 渲出该运行的 run5-detail）。
    expect(card?.querySelector("a")?.getAttribute("href")).toBe("/runs?run=run_X1Y2Z3");
    expect(card?.textContent).toContain("$2.50");
    expect(card?.textContent).toContain("2026-11-19 00:30");
    expect(card?.textContent).toContain("已完成");
    expect(card?.textContent).not.toContain("run_X1Y2Z3");
  });

  it("R48: runs rows carry real deep links, duration, and 0-vs-missing cost", async () => {
    mockApi((url) =>
      url.includes("/api/runs")
        ? Promise.resolve({
            items: [
              { runId: "rn_01M7D7421P5PA27TEXMT9YVDZ8", status: "completed", startedAt: "2026-11-14T14:24:28.752Z", endedAt: "2026-11-14T14:36:28.752Z", costUsd: 0, totalTokens: 120 },
              { runId: "rn_02AAAA1111BBBB2222CCCC3333", status: "teleporting", startedAt: "2026-11-15T01:00:00Z", endedAt: null, totalTokens: 0 },
            ],
          })
        : Promise.resolve({}),
    );
    await renderAt(page, at("runs"));
    const card = container.querySelector('[data-testid="ed5-runs"]');
    expect(card?.querySelector("a")?.getAttribute("href")).toBe("/runs?run=rn_01M7D7421P5PA27TEXMT9YVDZ8");
    const text = card?.textContent ?? "";
    expect(text).toContain("12 分钟");
    // 真 0 与缺失可区分：$0.00 有金额，null 走「—」。
    expect(text).toContain("$0.00");
    expect(text).toContain("待核实");
    expect(text).not.toContain("teleporting");
    expect(text).not.toContain("rn_01M7");
    expect(text).toContain("01M7D742");
    expect(card?.querySelector('[data-testid="ed7-runs-duration-1"]')?.getAttribute("title")).toContain("还没有结束");
    // 查询腿带 employeeId（活体实证真过滤：13 行/0 行差集）。
    const runUrl = fetchJSON.mock.calls.map((c) => String(c[0])).find((u) => u.includes("/api/runs"));
    expect(runUrl).toContain("employeeId=");
  });

  it("audit: actor codes are masked, action verbs become words", async () => {
    mockApi((url) =>
      url.includes("/api/audit")
        ? Promise.resolve({
            items: [{ createdAt: "2026-11-18T01:00:00Z", actor: "emp_B2C4D6E8F0", action: "budget.update", detail: "上调预算" }],
          })
        : Promise.resolve({}),
    );
    await renderAt(page, at("evidence"));
    const card = container.querySelector('[data-testid="ed5-audit"]');
    expect(card?.textContent).toContain("预算调整");
    expect(card?.textContent).toContain("B2C4D6E8");
    expect(card?.textContent).not.toContain("emp_B2C4D6E8F0");
    expect(card?.querySelector('[title="emp_B2C4D6E8F0"]')).toBeTruthy();
  });

  it("R32: audit rows from the real events shape state outcome, system actor and a copyable request id slot", async () => {
    mockApi((url) =>
      url.includes("/api/audit")
        ? Promise.resolve({
            events: [
              {
                eventId: "ev_EED6C34F4CB140EABD674C42A0",
                occurredAt: "2026-11-16T14:46:56.464Z",
                actor: { type: "system", id: "employee-api" },
                action: "budget.ledger_ensured",
                outcome: "success",
              },
            ],
          })
        : Promise.resolve({}),
    );
    await renderAt(page, at("evidence"));
    const card = container.querySelector('[data-testid="ed5-audit"]');
    expect(card?.querySelector('[data-testid="ed5-zone-audit-row"]')).toBeTruthy();
    expect(card?.textContent).toContain("2026-11-16 22:46");
    expect(card?.textContent).toContain("系统操作");
    expect(card?.textContent).toContain("成功");
    expect(card?.textContent).toContain("这条记录未携带编号");
    expect(card?.textContent).not.toMatch(/emp_[0-9A-Fa-f]{8,}|human:/);
  });

  it("approvals empty names the reason", async () => {
    mockApi(() => Promise.resolve({ items: [] }));
    await renderAt(page, at("approvals"));
    const card = container.querySelector('[data-testid="ed5-approvals-empty"]');
    expect(card?.textContent).toContain("还没有审批事项");
  });
});

describe("EmployeeDetailModulePage — tabs", () => {
  it("five tabs, shell-zone spellings, overview lands on the bare path", async () => {
    mockApi(() => Promise.resolve({}));
    await renderAt(page, at("approvals"));
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs.map((t) => t.textContent)).toEqual(["概览", "能力与权限", "审批", "运行", "审计"]);
    expect(tabs[0]?.getAttribute("href")).toBe(`/employees/${encodeURIComponent(EMP)}`);
    expect(tabs[1]?.getAttribute("href")).toContain("?zone=capability");
    const active = tabs.find((t) => t.getAttribute("aria-selected") === "true");
    expect(active?.textContent).toBe("审批");
  });
  it("renders the capability panel for ?zone=capability and the approvals panel for ?zone=approvals", async () => {
    mockApi((url) =>
      url.includes("/api/matrix")
        ? Promise.resolve({ items: [{ capabilities: ["数据查询"] }] })
        : url.includes("/api/approvals")
          ? Promise.resolve({ items: [{ taskId: "task_1", status: "pending", title: "预算上调" }] })
          : Promise.resolve({ items: [] }),
    );
    await renderAt(page, at("capability"));
    expect(container.querySelector('[data-testid="ed5-capability"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="ed5-capability"]')?.textContent).toContain("数据查询");
    await renderAt(page, at("approvals"));
    expect(container.querySelector('[data-testid="ed5-approvals"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="ed5-approvals"]')?.textContent).toContain("预算上调");
  });

});

describe("EmployeeDetailModulePage — R28 not-found honesty", () => {
  const GHOST = "emp_000000000000000000000000";
  const ghostPage = <EmployeeDetailModulePage employeeId={GHOST} />;

  it("404 for an unknown id falls back to matrix, and a borrowed row is refused with an honest not-found card", async () => {
    mockApi((url) => {
      if (url.includes("/api/employees/")) {
        return Promise.reject(new ApiError("gone", { status: 404, body: "", url, requestId: "nf-rid-1" }));
      }
      if (url.includes("/api/matrix")) {
        return Promise.resolve({ items: [{ employeeId: "emp_OTHER9999AA", name: "别的人", lifecycle: "active", monthlyCostUsd: 10 }] });
      }
      return Promise.resolve({ items: [] });
    });
    await renderAt(ghostPage, `/employees/${GHOST}`);
    const card = container.querySelector('[data-testid="ed5-overview-notfound"]');
    expect(card).toBeTruthy();
    expect(card?.textContent).toContain("员工不存在或无权查看");
    expect(card?.textContent).toContain("nf-rid-1");
    expect(container.textContent).not.toContain("别的人");
    expect(container.textContent).not.toContain("$10.00");
  });

  it("a 200 detail body that is NOT this employee is refused, never rendered", async () => {
    mockApi((url) => {
      if (url.includes("/api/employees/")) {
        return Promise.resolve({ employeeId: "emp_OTHER9999AA", name: "别的人", lifecycleState: "active", monthlyBudgetUsd: 10 });
      }
      return Promise.resolve({ items: [] });
    });
    await renderAt(ghostPage, `/employees/${GHOST}`);
    const card = container.querySelector('[data-testid="ed5-overview-notfound"]');
    expect(card).toBeTruthy();
    expect(container.textContent).not.toContain("别的人");
    expect(container.textContent).not.toContain("$10.00");
  });

  it("a real employee whose detail route 404s still falls back to its own matrix row", async () => {
    mockApi((url) => {
      if (url.includes("/api/employees/")) {
        return Promise.reject(new ApiError("route missing", { status: 404, body: "", url, requestId: "fb-rid-2" }));
      }
      if (url.includes("/api/matrix")) {
        return Promise.resolve({ items: [{ employeeId: EMP, name: "小鲤", lifecycle: "active" }] });
      }
      return Promise.resolve({ items: [] });
    });
    await renderAt(page, at());
    expect(container.querySelector('[data-testid="ed5-overview"]')).toBeTruthy();
    expect(container.textContent).toContain("小鲤");
    expect(container.textContent).not.toContain("员工不存在");
  });

  // ---- R35 · PRD 聊天区：真数据或诚实未接入（只读摘要，禁第二 chat host） ----

  it("chat zone: real session rows render title/BJT minute/count/plain status", async () => {
    mockApi((url) => {
      if (url.includes("console-sessions")) {
        return Promise.resolve({
          items: [
            { sessionId: "sess_7C1D2E3F", title: "周报讨论", updatedAt: "2026-11-18T02:00:00Z", messageCount: 12, status: "active" },
            { sessionId: "sess_9A8B", status: "archived" },
          ],
        });
      }
      return Promise.resolve({ items: [] });
    });
    await renderAt(<EmployeeDetailModulePage />, `/employees/${EMP}?zone=chat`);
    expect(container.querySelector('[data-testid="ed5-zone-chat"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-testid="ed5-zone-chat-row"]')).toHaveLength(2);
    const text = container.textContent ?? "";
    expect(text).toContain("周报讨论");
    expect(text).toContain("2026-11-18 10:00");
    expect(text).toContain("12 条");
    expect(text).toContain("进行中");
    expect(text).toContain("已结束");
    expect(text).not.toContain("sess_9A8B");
    // ②本区不是宿主、不是消息流、零写入口
    expect(container.querySelector("[data-chat-host]")).toBeNull();
    expect(text).not.toContain("发送");
    // 导航条仍是五区
    const tabs = Array.from(container.querySelectorAll("[role='tab'], [data-zone]")).filter((el) => el.getAttribute("data-zone") !== "chat");
    expect(tabs.length).toBeGreaterThanOrEqual(5);
  });

  it("chat zone: an empty server answer states 尚未接入 with the reason in the title", async () => {
    mockApi((url) => Promise.resolve(url.includes("console-sessions") ? { items: [] } : { items: [] }));
    await renderAt(<EmployeeDetailModulePage />, `/employees/${EMP}?zone=chat`);
    const empty = container.querySelector('[data-testid="ed5-zone-chat-empty"]');
    expect(empty).toBeTruthy();
    expect(container.textContent).toContain("该员工的对话记录尚未接入");
    expect(container.textContent).not.toContain("会话摘要为空（bug");
  });

  it("chat zone: error keeps plain copy with a copyable rid and retry", async () => {
    mockApi((url) => (url.includes("console-sessions") ? silent502(url, "req-chat-1") : Promise.resolve({ items: [] })));
    await renderAt(<EmployeeDetailModulePage />, `/employees/${EMP}?zone=chat`);
    const err = container.querySelector('[data-testid="ed5-zone-chat-error"]');
    expect(err).toBeTruthy();
    expect(container.textContent).toContain("请求编号：req-chat-1");
    expect(container.textContent).toContain("重试");
  });

  it("chat zone: 403 and 404 share one denied body and echo no path", async () => {
    for (const fail of [forbidden, missing]) {
      mockApi((url) => (url.includes("console-sessions") ? fail(url) : Promise.resolve({ items: [] })));
      await renderAt(<EmployeeDetailModulePage />, `/employees/${EMP}?zone=chat`);
      expect(container.querySelector('[data-testid="ed5-zone-chat-denied"]')).toBeTruthy();
      expect(container.textContent).toContain("这块数据还没接入，或你没有查看权限");
      expect(container.textContent).not.toContain("console-sessions");
    }
  });
});

describe("EmployeeDetailModulePage — tasks zone (R43)", () => {
  it("queries by real assignee and renders title link, 待核实 status, priority words, BJT minute", async () => {
    const urls: string[] = [];
    mockApi((url) => {
      urls.push(url);
      if (url.includes("/api/tasks")) {
        return Promise.resolve({
          items: [
            { taskId: "tk_0762C4D5", title: "周报合并", status: "open", priority: "high", updatedAt: "2026-11-18T02:00:00Z" },
            { taskId: "tk_1B4EA3C9", status: "reviewing", priority: "normal", updatedAt: "2026-11-17T01:30:00Z" },
          ],
        });
      }
      return Promise.resolve({});
    });
    await renderAt(page, at("tasks"));
    const call = urls.find((u) => u.includes("/api/tasks"));
    expect(call).toContain("assignee=employee%3A" + EMP);
    expect(call).toContain("limit=20");
    const link = container.querySelector('[data-testid="ed5-zone-tasks-name-tk_0762C4D5"]');
    expect(link?.getAttribute("href")).toBe("/tasks/tk_0762C4D5");
    expect(link?.textContent).toBe("周报合并");
    expect(link?.getAttribute("title")).toBe("tk_0762C4D5");
    expect(container.textContent).toContain("待处理");
    expect(container.textContent).toContain("待核实");
    expect(container.textContent).toContain("高优先级");
    expect(container.textContent).toContain("2026-11-18 10:00");
    expect(container.textContent).toContain("2026-11-17 09:30");
    // untitled row falls back to a masked code, never a bare tk_ id
    expect(container.querySelector('[data-testid="ed5-zone-tasks-name-tk_1B4EA3C9"]')?.textContent).toBe("任务 · 1B4EA3C9");
    expect(container.querySelector('[data-testid="ed5-zone-tasks-list"]')).toBeTruthy();
  });

  it("an empty server answer states 该员工暂无任务 with the filter note", async () => {
    mockApi((url) => (url.includes("/api/tasks") ? Promise.resolve({ items: [] }) : Promise.resolve({})));
    await renderAt(page, at("tasks"));
    const card = container.querySelector('[data-testid="ed5-zone-tasks-empty"]');
    expect(card?.textContent).toContain("该员工暂无任务");
    expect(card?.textContent).toContain("不放宽筛选");
    expect(container.querySelector('[data-testid="ed5-zone-tasks"]')).toBeNull();
  });

  it("task error keeps plain copy with a copyable rid and retry; 403 and 404 share one body", async () => {
    mockApi((url) =>
      url.includes("/api/tasks")
        ? Promise.reject(new ApiError("服务暂时不可用。", { status: 502, body: "", url, requestId: "req-tsk-43" }))
        : Promise.resolve({}),
    );
    await renderAt(page, at("tasks"));
    const card = container.querySelector('[data-testid="ed5-zone-tasks-error"]');
    expect(card?.textContent).toContain("任务没能加载出来");
    expect(card?.textContent).toContain("请求编号：req-tsk-43");
    expect(card?.querySelector('[data-testid="req-copy"]')).toBeTruthy();
    expect(Array.from(card?.querySelectorAll("button") ?? []).some((b) => b.textContent?.includes("重试"))).toBe(true);
  });

  it("task zone 403 and 404 share one denied body with no path echo", async () => {
    mockApi((url) => (url.includes("/api/tasks") ? forbidden(url) : Promise.resolve({})));
    await renderAt(page, at("tasks"));
    const denied403 = container.querySelector('[data-testid="ed5-zone-tasks-denied"]')?.textContent;
    expect(denied403).toBeTruthy();
    expect(denied403).toContain("任务");
    expect(denied403).not.toContain("api/tasks");
    act(() => root.unmount());
    root = createRoot(container);
    mockApi((url) => (url.includes("/api/tasks") ? missing(url) : Promise.resolve({})));
    await renderAt(page, at("tasks"));
    const denied404 = container.querySelector('[data-testid="ed5-zone-tasks-denied"]')?.textContent;
    expect(denied404).toBe(denied403);
  });
});

describe("R47 cross-zone consistency (edx-*)", () => {
  const qq = (t: string) => container.querySelector(`[data-testid="${t}"]`);

  it("edx-back uses real history, keeping the list filter query on the way back", async () => {
    mockApi((url) =>
      url.includes(`/api/employees/${encodeURIComponent(EMP)}`)
        ? Promise.resolve({ id: EMP, name: "小鲤", lifecycleState: "active", createdAt: "2026-11-13T22:15:30Z" })
        : Promise.resolve({}),
    );
    document.body.removeAttribute("data-r47-search");
    await renderStack(root, ["/employees?q=%E5%B0%8F%E9%B2%A4&lifecycle=active", at()], page);
    expect(qq("edx-back")).toBeTruthy();
    const back = qq("edx-back") as HTMLButtonElement;
    await act(async () => {
      back.click();
    });
    await act(async () => {});
    expect(document.body.getAttribute("data-r47-search")).toBe("?q=%E5%B0%8F%E9%B2%A4&lifecycle=active");
  });

  it("denied zones carry the request id with a copy control that round-trips", async () => {
    mockApi((url) => {
      if (url.includes("/api/tasks?")) {
        return Promise.reject(
          new ApiError("forbidden", { status: 403, body: "", url, requestId: "req-d-1" }),
        );
      }
      if (url.includes(`/api/employees/${encodeURIComponent(EMP)}`)) {
        return Promise.resolve({ id: EMP, name: "小鲤", lifecycleState: "active" });
      }
      return Promise.resolve({});
    });
    let copied: string | null = null;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: (t: string) => { copied = t; return Promise.resolve(); } },
    });
    await renderAt(page, at("tasks"));
    const card = qq("ed5-zone-tasks-denied");
    expect(card).toBeTruthy();
    expect(card?.textContent).toContain("req-d-1");
    const copy = qq("req-copy") as HTMLButtonElement;
    expect(copy).toBeTruthy();
    await act(async () => {
      copy.click();
    });
    expect(copied).toBe("req-d-1");
    expect(document.body.textContent).toContain("已复制");
  });

  it("edx-back sits on the default zone without breaking existing families", async () => {
    mockApi((url) =>
      url.includes(`/api/employees/${encodeURIComponent(EMP)}`)
        ? Promise.resolve({ id: EMP, name: "小鲤", lifecycleState: "active" })
        : Promise.resolve({}),
    );
    await renderAt(page, at());
    expect(qq("edx-back")).toBeTruthy();
    expect(qq("ed1-identity-name")?.textContent).toContain("小鲤");
  });
});
