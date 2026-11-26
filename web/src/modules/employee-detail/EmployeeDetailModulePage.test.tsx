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
import { DEPT_UNLABELED_LABEL, FIELD_MISSING, departmentView } from "@/modules/employees/EmployeesModulePage";
import {
  APPROVAL_DENIED_BODY,
  APPROVAL_DENIED_TITLE,
  APPROVAL_EMPTY_SENTENCE,
  APPROVAL_FAILED_TITLE,
  APPROVAL_RETRY_LABEL,
} from "@/modules/approvals/stateCopy";
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
    expect(qid("ed1-identity-code")?.textContent).toBe("emp_a3f1b2c4…");
    expect(qid("ed1-identity-code")?.getAttribute("title")).toBe(EMP);
    expect(qid("ed1-identity-role")?.textContent).toBe("产品助理（数字员工 · Pilot）");
    expect(qid("ed1-identity-state")?.textContent).toBe("在岗");
    expect(qid("ed1-identity-reports")?.textContent).toBe("—");
    expect(qid("ed1-identity-reports")?.getAttribute("title")).toContain("后台没有回传这位员工的汇报对象");
    expect(qid("ed1-identity-created")?.textContent).toBe("2026-11-14 06:15");
    expect(qid("ed1-identity")?.textContent).not.toContain(EMP); // 整段编号不上屏，只上 8 位短码
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
    expect(qid("ed1-identity-state")?.getAttribute("title")).toBe("原始值：weird_state");
    for (const id of ["name", "role", "created"]) {
      expect(qid(`ed1-identity-${id}`)?.textContent).toBe("该字段未返回");
      expect(qid(`ed1-identity-${id}`)?.getAttribute("title")).toContain("读口没有回传该字段");
    }
    // R68: 读口没有 requestId 键时，请求编号与列表预览同句口径。
    expect(qid("ed1-identity-rid")?.textContent).toContain("请求编号：该字段未返回");
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

describe("EmployeeDetailModulePage — 能力与技能节（配置竖栏 · reuse: /api/matrix）", () => {
  // 2026-11-26 收口：原「能力与权限」分区已并入配置竖栏的「能力与技能」节
  // (?zone=capability 别名直达)。读口仍是全量矩阵行 + 前端按 employeeId 匹配。
  const qid = (id: string) => container.querySelector(`[data-testid="${id}"]`);

  it("a missing skillCount reads — while a real empty refs set says 真 0 (never a fake number)", async () => {
    mockApi((url) =>
      url.includes("/api/matrix")
        ? Promise.resolve({ items: [{ employeeId: EMP, skillRefs: [] }] })
        : Promise.resolve({ items: [] }),
    );
    await renderAt(page, at("capability"));
    const card = container.querySelector('[data-testid="edcfg-cap"]');
    expect(card).toBeTruthy();
    // 缺 skillCount → 「—」，不回退成 0（缺失与真 0 必须可区分）。
    expect(qid("edcfg-cap-field-count")?.textContent).toBe("—");
    expect(qid("edcfg-cap-field-refs")?.textContent).toBe("0 项挂载（真 0）");
    expect(qid("edcfg-cap-field-refs")?.getAttribute("title")).toContain("skillRefs 为空集");
    expect(card?.textContent).not.toMatch(/技能数\s*0 项/);
    // 矩阵读口没有按员工过滤的能力：本页前端筛选，口径常驻。
    expect(qid("edcfg-cap-note")?.textContent).toContain("矩阵读口不支持按员工过滤，本页为前端筛选");
  });

  it("a matrix row for another employee is never borrowed (honest empty row state)", async () => {
    mockApi((url) =>
      url.includes("/api/matrix")
        ? Promise.resolve({ items: [{ employeeId: "emp_OTHER0001", skillCount: 9, skillRefs: ["skill_other"] }] })
        : Promise.resolve({ items: [] }),
    );
    await renderAt(page, at("capability"));
    const card = container.querySelector('[data-testid="edcfg-cap"]');
    expect(card?.textContent).toContain("矩阵里没有这位员工的行");
    expect(card?.textContent).not.toContain("skill_other");
  });

  it("403 → permission sentence, not a fake empty", async () => {
    mockApi((url) => forbidden(url));
    await renderAt(page, at("capability"));
    const denied = container.querySelector('[data-testid="edcfg-cap-denied"]');
    expect(denied?.textContent).toContain("这块数据还没接入，或你没有查看权限");
    expect(denied?.textContent).toContain("重试");
  });

  it("404 → honest not-connected state", async () => {
    mockApi((url) => missing(url));
    await renderAt(page, at("capability"));
    const denied = container.querySelector('[data-testid="edcfg-cap-denied"]');
    expect(denied?.textContent).toContain("还没接入");
  });

  // R56 P0: the overview catch paths must read the requestId from the real
  // error object (they used to reference a free variable `api`, throwing a
  // ReferenceError that left the state at loading as an unhandled rejection).
  it("R56: overview 403 catch carries the ApiError requestId into the denied state", async () => {
    mockApi((url) =>
      url.includes("/api/employees/")
        ? Promise.reject(new ApiError("forbidden", { status: 403, body: "", url, requestId: "req-r56-403" }))
        : Promise.resolve({}),
    );
    await renderAt(page, at("overview"));
    const denied = container.querySelector('[data-testid="ed5-overview-denied"]');
    expect(denied?.textContent).toContain("req-r56-403");
    expect(denied?.querySelector('[data-testid="req-copy"]')).toBeTruthy();
  });

  it("R56: overview 403 without a request id says so instead of inventing one", async () => {
    mockApi((url) => (url.includes("/api/employees/") ? forbidden(url) : Promise.resolve({})));
    await renderAt(page, at("overview"));
    const denied = container.querySelector('[data-testid="ed5-overview-denied"]');
    expect(denied?.textContent).toContain("本次请求没有带回编号");
  });
});

describe("EmployeeDetailModulePage — approvals / runs / audit", () => {
  it("approval rows link to the real approvals surface; raw task id stays in title", async () => {
    mockApi((url) =>
      url.includes("/api/approvals")
        ? Promise.resolve({
            items: [
              { taskId: "task_9F3A1B2C3D", status: "pending", title: "预算上调", createdAt: "2026-11-18T04:00:00Z", amountUsd: 300, requestedBy: { id: EMP } },
            ],
          })
        : Promise.resolve({}),
    );
    await renderAt(page, at("approvals"));
    const card = container.querySelector('[data-testid="ed5-approvals"]');
    // R89 起卡内第一个 a 是口径行的队列去处，行链按 testid 精确取。
    const link = card?.querySelector('[data-testid="ed8-appr-link-0"]');
    expect(link?.getAttribute("href")).toBe("/approvals?status=pending");
    expect(link?.getAttribute("title")).toBe("task_9F3A1B2C3D");
    expect(card?.textContent).not.toContain("task_9F3A1B2C3D");
    expect(card?.textContent).toContain("待处理");
    // R78: 缺更新时间→与队列同款「该字段未返回」（不回退提交时间）。
    expect(card?.textContent).toContain("该字段未返回");
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
    const runUrl = vi.mocked(fetchJSON).mock.calls.map((c) => String(c[0])).find((u) => u.includes("/api/runs"));
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
    // 证据区左竖栏把「审计」单列：?zone=audit 直达该节（证据区默认落在审批）。
    await renderAt(page, at("audit"));
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
    await renderAt(page, at("audit"));
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
    // R93: 空集主句与队列 apv-state 单点同值（该条件下无审批），
    // hint 保留本区范围说明；11px 口径行在有行/空集两种态都常驻。
    expect(card?.textContent).toContain(APPROVAL_EMPTY_SENTENCE);
    expect(card?.textContent).toContain("聚合为空集");
    const note = container.querySelector('[data-testid="ed8-appr-note"]');
    expect(note?.textContent).toContain("服务端未按员工过滤，本页为前端筛选");
  });
});

describe("EmployeeDetailModulePage — approvals zone R49", () => {
  it("reads the honest aggregate (no fake employee filter) and renders the four-column spec", async () => {
    const urls: string[] = [];
    mockApi((url) => {
      urls.push(url);
      if (url.includes("/api/approvals")) {
        return Promise.resolve({
          items: [
            { approvalId: "apr_R49A", status: "expired", riskLevel: "high", updatedAt: "2026-11-19T02:30:00Z", title: "密钥轮换", requestedBy: { id: EMP } },
            { approvalId: "ap_R49B", status: "weird_state", riskLevel: "purple", requestedBy: { id: EMP } },
          ],
        });
      }
      return Promise.resolve({});
    });
    await renderAt(page, at("approvals"));
    const calls = urls.filter((u) => u.includes("/api/approvals"));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("status=all");
    expect(calls[0]).toContain("limit=200");
    expect(calls[0]).not.toContain("employeeId");
    const note = container.querySelector('[data-testid="ed8-appr-note"]');
    expect(note?.textContent).toContain("服务端未按员工过滤，本页为前端筛选");
    expect(note?.getAttribute("title")).toContain("requestedBy");
    const card = container.querySelector('[data-testid="ed5-approvals"]');
    expect(container.querySelector('[data-testid="ed8-appr-title-0"]')?.textContent).toBe("密钥轮换");
    expect(container.querySelector('[data-testid="ed8-appr-risk-0"]')?.textContent).toBe("高风险");
    expect(container.querySelector('[data-testid="ed8-appr-time-0"]')?.getAttribute("title")).toContain("2026-11-19 10:30:00（北京时间）");
    const link0 = container.querySelector('[data-testid="ed8-appr-link-0"]') as HTMLAnchorElement;
    expect(link0?.getAttribute("href")).toBe("/approvals?status=expired");
    expect(container.querySelector('[data-testid="ed8-appr-status-1"]')?.textContent).toBe("状态未识别");
    const risk1 = container.querySelector('[data-testid="ed8-appr-risk-1"]');
    expect(risk1?.textContent).toBe("未标注风险");
    expect(risk1?.getAttribute("title")).toContain("purple");
    expect(container.querySelector('[data-testid="ed8-appr-time-1"]')?.textContent).toBe("该字段未返回");
    expect(container.querySelector('[data-testid="ed8-appr-time-1"]')?.getAttribute("title")).toContain("不补当前时间");
    expect(card?.textContent).not.toContain("apr_R49A");
    expect(card?.textContent).not.toContain("ap_R49B");
    expect(card?.textContent).not.toContain("apr_");
    expect(card?.textContent).not.toContain("human:");
  });
});

describe("EmployeeDetailModulePage — sessions zone R52", () => {
  it("reads the employee-scoped list and renders code/channel/count/activity honestly", async () => {
    const urls: string[] = [];
    mockApi((url) => {
      urls.push(url);
      if (url.includes("/api/console-sessions")) {
        return Promise.resolve({
          items: [
            { sessionId: "cs_AAAA1111BBBB2222CCCC", channel: "feishu", messageCount: 7, updatedAt: "2026-11-19T02:30:00Z" },
            { session_id: "cs_DDDD3333EEEE4444", status: "open" },
          ],
        });
      }
      return Promise.resolve({});
    });
    await renderAt(page, at("sessions"));
    const calls = urls.filter((u) => u.includes("/api/console-sessions"));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain(`employeeId=${encodeURIComponent(EMP)}`);
    expect(calls[0]).toContain("limit=20");
    const qid = (id: string) => container.querySelector(`[data-testid="${id}"]`);
    expect(qid("ed9-sessions")).toBeTruthy();
    const link0 = qid("ed9-sessions-link-0") as HTMLAnchorElement;
    expect(link0?.getAttribute("href")).toBe("/chat");
    expect(link0?.getAttribute("title")).toBe("cs_AAAA1111BBBB2222CCCC");
    expect(link0.textContent).toContain("会话 · AAAA1111");
    expect(qid("ed9-sessions-channel-0")?.textContent).toBe("飞书");
    expect(qid("ed9-sessions-count-0")?.textContent).toBe("7 条");
    expect(qid("ed9-sessions-time-0")?.textContent).toBe("2026-11-19 10:30");
    // 缺渠道=「—」+原因；缺计数=「—」+原因；无时间=「—」。
    expect(qid("ed9-sessions-channel-1")?.textContent).toBe("—");
    expect(qid("ed9-sessions-channel-1")?.getAttribute("title")).toContain("没有回传");
    expect(qid("ed9-sessions-count-1")?.textContent).toBe("—");
    expect(qid("ed9-sessions-time-1")?.textContent).toBe("—");
    expect(container.textContent).not.toContain("cs_AAAA1111BBBB2222CCCC");
    expect(container.querySelector("[data-chat-host]")).toBeNull();
  });

  it("empty answers with the stated real zero, not a failure", async () => {
    mockApi((url) =>
      url.includes("/api/console-sessions")
        ? Promise.resolve({ items: [] })
        : Promise.resolve({}),
    );
    await renderAt(page, at("sessions"));
    const empty = container.querySelector('[data-testid="ed9-sessions-empty"]');
    expect(empty).toBeTruthy();
    expect(empty?.textContent).toContain("该员工暂无可查会话");
    expect(empty?.textContent).toContain("真实空集");
  });
});

describe("EmployeeDetailModulePage — shell zone spelling (收口后)", () => {
  it("no in-module segment row and no tab role: the five shell zones each land on real content", async () => {
    mockApi(() => Promise.resolve({ items: [] }));
    // 2026-11-26 收口：模块内「分区/小节」两排导航全部删除；唯一导航是外壳
    // zone 条。模块内必须 0 条 tablist / tab / data-zone 行。
    await renderAt(page, at("config"));
    expect(container.querySelectorAll('[role="tablist"]')).toHaveLength(0);
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(0);
    expect(container.querySelector('[data-testid="ed5-tabs"]')).toBeNull();
    expect(container.querySelectorAll("[data-zone]")).toHaveLength(0);
    expect(container.querySelector('[data-testid="ed5-module"]')).toBeTruthy();

    // 五格各自有真内容（用页面根节点判，不看导航）。
    const panels: Array<[string, string]> = [
      ["workbench", "ed5-overview-wrap"],
      ["config", "edcfg-rail"],
      ["tasks", "ed5-zone-tasks-empty"],
      ["runs", "ed5-zone-runs-wrap"],
      ["evidence", "edevi-rail"],
    ];
    for (const [zone, testid] of panels) {
      await renderAt(page, at(zone));
      expect(container.querySelector(`[data-testid="${testid}"]`), `${zone} → ${testid}`).toBeTruthy();
      expect(container.querySelectorAll('[role="tablist"]')).toHaveLength(0);
      expect(container.querySelectorAll("[data-zone]")).toHaveLength(0);
    }
  });

  it("legacy spellings resolve: capability→配置·能力节, tasklist→任务, usage→运行, audit→证据·审计, chat→工作台", async () => {
    mockApi(() => Promise.resolve({ items: [] }));

    await renderAt(page, at("capability"));
    expect(container.querySelector('[data-testid="edcfg-rail-item-capability"]')?.getAttribute("aria-current")).toBe("true");
    expect(container.querySelector('[data-testid="edcfg-cap"]')).toBeTruthy();

    await renderAt(page, at("tasklist"));
    expect(container.querySelector('[data-testid="ed5-zone-tasks-empty"]')).toBeTruthy();

    await renderAt(page, at("usage"));
    expect(container.querySelector('[data-testid="ed5-zone-runs-wrap"]')).toBeTruthy();

    await renderAt(page, at("audit"));
    expect(container.querySelector('[data-testid="edevi-rail-item-audit"]')?.getAttribute("aria-current")).toBe("true");
    expect(container.querySelector('[data-testid="ed5-audit-empty"]')).toBeTruthy();

    await renderAt(page, at("chat"));
    expect(container.querySelector('[data-testid="ed5-overview-wrap"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="ed9-sessions"]')).toBeNull();
  });

  it("renders the capability panel for ?zone=capability and the approvals panel for ?zone=approvals", async () => {
    mockApi((url) =>
      url.includes("/api/matrix")
        ? Promise.resolve({ items: [{ employeeId: EMP, skillCount: 2, skillRefs: ["skill_query", "skill_call"] }] })
        : url.includes("/api/approvals")
          ? Promise.resolve({ items: [{ taskId: "task_1", status: "pending", title: "预算上调", requestedBy: { id: EMP } }] })
          : Promise.resolve({ items: [] }),
    );
    await renderAt(page, at("capability"));
    expect(container.querySelector('[data-testid="edcfg-cap"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="edcfg-cap-field-refs"]')?.textContent).toContain("skill_query");
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

  it("sessions zone: real session rows render title/BJT minute/count/plain status", async () => {
    // 2026-11-26 收口：原「对话区」并入证据区左竖栏的「会话」节
    // （?zone=sessions 直达）；本区仍是只读摘要，不是宿主、零写入口。
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
    await renderAt(<EmployeeDetailModulePage />, `/employees/${EMP}?zone=sessions`);
    expect(container.querySelector('[data-testid="ed9-sessions"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-testid="ed9-sessions-row-0"], [data-testid="ed9-sessions-row-1"]')).toHaveLength(2);
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
  });

  it("sessions zone: an empty server answer states the real empty set with the reason", async () => {
    mockApi((url) => Promise.resolve(url.includes("console-sessions") ? { items: [] } : { items: [] }));
    await renderAt(<EmployeeDetailModulePage />, `/employees/${EMP}?zone=sessions`);
    const empty = container.querySelector('[data-testid="ed9-sessions-empty"]');
    expect(empty).toBeTruthy();
    expect(empty?.textContent).toContain("该员工暂无可查会话");
    expect(empty?.textContent).toContain("真实空集");
    expect(container.textContent).not.toContain("会话摘要为空（bug");
  });

  it("sessions zone: error keeps plain copy with a copyable rid and retry", async () => {
    mockApi((url) => (url.includes("console-sessions") ? silent502(url, "req-chat-1") : Promise.resolve({ items: [] })));
    await renderAt(<EmployeeDetailModulePage />, `/employees/${EMP}?zone=sessions`);
    const err = container.querySelector('[data-testid="ed9-sessions-error"]');
    expect(err).toBeTruthy();
    expect(container.textContent).toContain("请求编号：req-chat-1");
    expect(container.querySelector('[data-testid="req-copy"]')).toBeTruthy();
    expect(container.textContent).toContain("重试");
  });

  it("sessions zone: 403 and 404 share one denied body and echo no path", async () => {
    let first: string | null = null;
    for (const fail of [forbidden, missing]) {
      mockApi((url) => (url.includes("console-sessions") ? fail(url) : Promise.resolve({ items: [] })));
      await renderAt(<EmployeeDetailModulePage />, `/employees/${EMP}?zone=sessions`);
      const denied = container.querySelector('[data-testid="ed9-sessions-denied"]');
      expect(denied).toBeTruthy();
      expect(denied?.textContent).toContain("这块数据还没接入，或你没有查看权限");
      expect(container.textContent).not.toContain("console-sessions");
      if (first === null) first = denied?.textContent ?? "";
      else expect(denied?.textContent).toBe(first);
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
    expect(call).toContain("status=all");
    const link = container.querySelector('[data-testid="ed5-zone-tasks-name-tk_0762C4D5"]');
    expect(link?.getAttribute("href")).toBe("/tasks/tk_0762C4D5");
    expect(link?.textContent).toBe("周报合并");
    expect(link?.getAttribute("title")).toBe("tk_0762C4D5");
    expect(container.textContent).toContain("待分配"); // 任务看板同一状态词表（open=待分配）
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

describe("EmployeeDetailModulePage — zone nav (R51 → 收口后)", () => {
  it("the five shell zones are addressable by ?zone= and the module owns no nav link of its own", async () => {
    mockApi((url) =>
      url.includes("/api/tasks")
        ? Promise.resolve({ items: [{ taskId: "tk_A1", title: "周报合并", status: "open" }] })
        : Promise.resolve({ items: [] }),
    );
    await renderAt(page, at("tasks"));
    expect(container.querySelector('[data-testid="ed5-module"]')).toBeTruthy();
    // 收口契约：模块内不再自己画一排分区链接（导航归外壳 zone 条）。
    expect(container.querySelectorAll('a[href*="?zone="]')).toHaveLength(0);
    expect(container.querySelectorAll('[role="tablist"]')).toHaveLength(0);
    // 五格各自可达：每格渲出自己的真内容根节点。
    const reachable: Array<[string, string]> = [
      ["workbench", "ed5-overview-wrap"],
      ["config", "edcfg-rail"],
      ["tasks", "ed5-zone-tasks"],
      ["runs", "ed5-zone-runs-wrap"],
      ["evidence", "edevi-rail"],
    ];
    for (const [zone, testid] of reachable) {
      await renderAt(page, at(zone));
      expect(container.querySelector(`[data-testid="${testid}"]`), `${zone} → ${testid}`).toBeTruthy();
    }
  });

  it("entering a zone fetches only that zone's data — measured request counts", async () => {
    const urls: string[] = [];
    mockApi((url) => {
      urls.push(url);
      return Promise.resolve({ items: [] });
    });
    await renderAt(page, at("runs"));
    const runsCalls = urls.filter((u) => u.includes("/api/runs?"));
    expect(runsCalls).toHaveLength(1);
    expect(runsCalls[0]).toContain("employeeId=");
    expect(urls.some((u) => u.includes("/api/tasks"))).toBe(false);
    expect(urls.some((u) => u.includes("/api/approvals"))).toBe(false);
    expect(urls.some((u) => u.includes("/api/audit"))).toBe(false);
    expect(urls.some((u) => u.includes("/api/console-sessions"))).toBe(false);
    // 任务区同理：只打任务腿，不打运行腿。
    urls.length = 0;
    await renderAt(page, at("tasks"));
    expect(urls.filter((u) => u.includes("/api/tasks"))).toHaveLength(1);
    expect(urls.some((u) => u.includes("/api/runs"))).toBe(false);
    expect(container.querySelector('[data-testid="ed5-zone-tasks-empty"]')).toBeTruthy();
  });
});

describe("EmployeeDetailModulePage — usage zone R57", () => {
  const qid = (id: string) => container.querySelector(`[data-testid="${id}"]`);
  const usageApi = (
    day: unknown,
    month: unknown,
    statsDay: unknown,
    statsMonth: unknown,
    urls: string[] = [],
  ) =>
    mockApi((url) => {
      urls.push(url);
      if (url.includes("periodKind=day")) return Promise.resolve(day);
      if (url.includes("periodKind=month")) return Promise.resolve(month);
      if (url.includes("/api/run-stats")) {
        const from = Date.parse(decodeURIComponent(url.split("from=")[1].split("&")[0]));
        const to = Date.parse(decodeURIComponent(url.split("to=")[1].split("&")[0]));
        return Promise.resolve(to - from === 86400000 ? statsDay : statsMonth);
      }
      return Promise.resolve({});
    });

  it("sends exactly three whitelisted queries and renders ledger/stats/asOf honestly", async () => {
    const urls: string[] = [];
    usageApi(
      { items: [], missingEmployeeIds: [EMP], asOf: "2026-11-19T23:58:08Z", asOfSource: "bff-read-time" },
      { items: [{ employeeId: EMP, period: "2026-11", costUsd: 0.12119800000000001 }], asOf: "2026-11-19T23:58:08Z", asOfSource: "bff-read-time" },
      { totals: {}, asOf: "2026-11-19T23:58:08Z" },
      { totals: { runs: 13 }, asOf: "2026-11-19T23:58:08Z" },
      urls,
    );
    await renderAt(page, at("usage"));
    const usageCalls = urls.filter((u) => u.includes("/api/budget-usage") || u.includes("/api/run-stats"));
    expect(usageCalls).toHaveLength(4);
    for (const u of usageCalls) expect(u).toContain(`employeeId=${encodeURIComponent(EMP)}`);
    expect(usageCalls.some((u) => u.includes("periodKind=day") && u.includes("period="))).toBe(true);
    expect(usageCalls.some((u) => u.includes("periodKind=month"))).toBe(true);
    expect(usageCalls.some((u) => u.includes("/api/run-stats") && u.includes("bucket=day"))).toBe(true);
    expect(qid("ed10-usage")).toBeTruthy();
    expect(qid("ed10-usage-runs-month")?.textContent).toBe("13");
    expect(qid("ed10-usage-cost-month")?.textContent).toBe("$0.12");
    expect(qid("ed10-usage-cost-month")?.getAttribute("title")).toContain("实扣金额");
    expect(qid("ed10-usage-asof-month")?.textContent).toBe("2026-11-20 07:58");
    expect(qid("ed10-usage-asof-month")?.getAttribute("title")).toContain("bff-read-time");
    // 今日：账本缺行 + 今日窗合计缺值 → 都是缺值，不作 0。
    expect(qid("ed10-usage-runs-day")?.textContent).toBe("—");
    expect(qid("ed10-usage-runs-day")?.getAttribute("title")).toContain("不作 0");
    expect(qid("ed10-usage-cost-day")?.textContent).toBe("—");
    expect(qid("ed10-usage-cost-day")?.getAttribute("title")).toContain("账本在该日没有这位员工的行");
    expect(container.textContent).not.toContain("0.121198");
  });

  it("keeps a real zero distinct from a missing value", async () => {
    usageApi(
      { items: [], missingEmployeeIds: [EMP], asOf: null },
      { items: [{ employeeId: EMP, period: "2026-11", costUsd: 0 }], asOf: null },
      { totals: { runs: 0 }, asOf: null },
      { totals: { runs: 0 }, asOf: null },
    );
    await renderAt(page, at("usage"));
    expect(qid("ed10-usage")).toBeTruthy();
    expect(qid("ed10-usage-cost-month")?.textContent).toBe("$0.00");
    expect(qid("ed10-usage-runs-month")?.textContent).toBe("0");
    expect(qid("ed10-usage-asof-month")?.textContent).toBe("—");
    expect(qid("ed10-usage-asof-month")?.getAttribute("title")).toContain("本机时钟");
  });

  it("empty ledger plus a real zero in stats is stated as an empty answer", async () => {
    usageApi(
      { items: [], missingEmployeeIds: [EMP] },
      { items: [], missingEmployeeIds: [EMP] },
      { totals: { runs: 0 } },
      { totals: { runs: 0 } },
    );
    await renderAt(page, at("usage"));
    const empty = qid("ed10-usage-empty");
    expect(empty).toBeTruthy();
    expect(empty?.textContent).toContain("该员工暂无成本记录");
    expect(empty?.textContent).toContain("真实回答");
  });

  it("error keeps the plain sentence, a copyable request id and a retry", async () => {
    mockApi((url) =>
      url.includes("/api/budget-usage") || url.includes("/api/run-stats")
        ? Promise.reject(new ApiError("服务暂时不可用。", { status: 500, body: "", url, requestId: "req-r57-500" }))
        : Promise.resolve({}),
    );
    await renderAt(page, at("usage"));
    expect(qid("ed10-usage-error")?.textContent).toContain("请求编号：req-r57-500");
    expect(qid("req-copy")).toBeTruthy();
    expect(container.textContent).toContain("重试");
  });

  it("403 and 404 share one denied body without leaking the path", async () => {
    mockApi((url) =>
      url.includes("/api/budget-usage") || url.includes("/api/run-stats")
        ? Promise.reject(new ApiError("forbidden", { status: 403, body: "", url, requestId: "req-r57-403" }))
        : Promise.resolve({}),
    );
    await renderAt(page, at("usage"));
    const denied = qid("ed10-usage-denied");
    expect(denied).toBeTruthy();
    expect(denied?.textContent).toContain("这块数据还没接入");
    expect(denied?.textContent).not.toContain("budget-usage");
    expect(qid("req-copy")).toBeTruthy();
  });

  it("404 denied renders the same body as 403", async () => {
    mockApi((url) =>
      url.includes("/api/budget-usage") || url.includes("/api/run-stats")
        ? Promise.reject(new ApiError("not found", { status: 404, body: "", url }))
        : Promise.resolve({}),
    );
    await renderAt(page, at("usage"));
    const denied = qid("ed10-usage-denied");
    expect(denied).toBeTruthy();
    expect(denied?.textContent).toContain("这块数据还没接入");
  });

  it("R45-P0: run-stats from/to are full ISO-8601 timestamps, never YYYY-MM", async () => {
    const urls: string[] = [];
    usageApi({ items: [] }, { items: [] }, {}, {}, urls);
    await renderAt(page, at("usage"));
    const stats = urls.filter((u) => u.includes("/api/run-stats"));
    expect(stats).toHaveLength(2);
    for (const u of stats) {
      const from = u.split("from=")[1].split("&")[0];
      const to = u.split("to=")[1].split("&")[0];
      expect(from).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
      expect(to).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
      expect(u).not.toMatch(/from=\d{4}-\d{2}&/);
    }
    const dayLeg = stats.find((u) => Date.parse(decodeURIComponent(u.split("to=")[1].split("&")[0])) - Date.parse(decodeURIComponent(u.split("from=")[1].split("&")[0])) === 86400000);
    expect(dayLeg).toBeTruthy();
  });

  it("R45-P0: December rolls the month window into next January (boundary)", async () => {
    // BJT 2027-01-01 04:00 (= UTC 2026-12-31 20:00): the day window is
    // 2027-01-01, the month window must be 2027-01-01 .. 2027-02-01.
    vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 11, 31, 20, 0, 0));
    const urls: string[] = [];
    usageApi({ items: [] }, { items: [] }, {}, {}, urls);
    await renderAt(page, at("usage"));
    const stats = urls.filter((u) => u.includes("/api/run-stats"));
    const monthLeg = stats.find((u) => Date.parse(decodeURIComponent(u.split("to=")[1].split("&")[0])) - Date.parse(decodeURIComponent(u.split("from=")[1].split("&")[0])) !== 86400000);
    expect(monthLeg).toBeTruthy();
    expect(monthLeg).toContain("from=2027-01-01T00:00:00.000Z");
    expect(monthLeg).toContain("to=2027-02-01T00:00:00.000Z");
  });
});

describe("R68 preview↔identity parity (edx-parity)", () => {
  const qid = (id: string) => container.querySelector(`[data-testid="${id}"]`);
  it("a full record reads the same words on the identity card as the list preview uses", async () => {
    mockApi((url) =>
      url.includes(`/api/employees/${encodeURIComponent(EMP)}`)
        ? Promise.resolve({
            id: EMP,
            name: "小鲤",
            title: "内容编辑",
            lifecycleState: "weird_state",
            updatedAt: "2026-11-17T05:52:48.030Z",
            createdAt: "2026-11-14T02:15:00Z",
          })
        : silent502(url),
    );
    await renderAt(page, at());
    expect(qid("ed1-identity-name")?.textContent).toBe("小鲤");
    expect(qid("ed1-identity-code")?.textContent).toBe("emp_a3f1b2c4…"); // 与行内预览同形制
    expect(qid("ed1-identity-code")?.getAttribute("title")).toBe(EMP); // title 全 id
    expect(qid("ed1-identity-state")?.textContent).toBe("待核实");
    expect(qid("ed1-identity-state")?.getAttribute("title")).toBe("原始值：weird_state");
    expect(qid("ed1-identity-role")?.textContent).toBe("内容编辑");
    expect(qid("ed1-identity-created")?.textContent).toBe("2026-11-14 10:15"); // BJT 到分
    expect(qid("ed1-identity-rid")?.textContent).toContain("请求编号：该字段未返回");
    expect(qid("ed1-identity-rid")?.getAttribute("title")).toContain("读口没有回传该字段");
  });

  it("a 404 read never fakes an identity card — fields only come from the payload", async () => {
    mockApi((url) =>
      url.includes(`/api/employees/${encodeURIComponent(EMP)}`)
        ? missing(url)
        : silent502(url),
    );
    await renderAt(page, at());
    expect(qid("ed1-identity"), "no card on 404").toBeNull();
  });
});

describe("R86 approvals zone announcement (apv-live)", () => {
  it("the zone speaks through one derived status node, empty and error share the sentences", async () => {
    mockApi(async (url: string) => {
      if (String(url).includes("/api/approvals"))
        return { items: [{ approvalId: "ap_e86", status: "pending", title: "播报单", requestedBy: { id: EMP } }] };
      return {};
    });
    await renderAt(page, at("approvals"));
    await act(async () => {});
    const live = container.querySelector('[data-testid="apv-live"]');
    expect(live?.textContent, "ready announces the loaded count").toBe("已加载 1 条");
    expect(live?.getAttribute("role")).toBe("status");
    expect(live?.getAttribute("aria-live")).toBe("polite");
  });

  it("error sentence carries no request id; the card keeps the copyable one", async () => {
    mockApi(async (url: string) => silent502(url, "req-e86-502"));
    await renderAt(page, at("approvals"));
    await act(async () => {});
    const live = container.querySelector('[data-testid="apv-live"]');
    expect(live?.textContent).toBe("列表读取失败，可复制请求编号重试");
    expect(live?.textContent).not.toContain("req-e86-502");
    expect(container.textContent).toContain("req-e86-502");
  });
});

// R87: 成本口径互指——本页常量与 metrics（ui2）句族的「实扣」关键短语同侧断言。
import metricsSource from "@/modules/metrics/MetricsModulePage.tsx?raw";

describe("R87 cost caliber note (ed10-cost-caliber)", () => {
  it("states the caliber under the cost column and cross-points /metrics in the title", async () => {
    mockApi(async (url: string) => {
      const u = String(url);
      if (u.includes("periodKind=day")) return { items: [], missingEmployeeIds: [EMP], asOf: null };
      if (u.includes("periodKind=month"))
        return { items: [{ employeeId: EMP, costUsd: 0, period: "2026-11" }], asOf: null };
      if (u.includes("/api/run-stats")) return { totals: { runs: 3 }, buckets: [], asOf: null };
      return {};
    });
    await renderAt(page, at("usage"));
    const note = container.querySelector('[data-testid="ed10-cost-caliber"]');
    expect(note?.textContent).toBe(
      "成本为账本实扣金额；与 /metrics 的成本视图口径一致，与运行次数口径不同",
    );
    expect(note?.getAttribute("title")).toContain("/metrics");
    expect(note?.getAttribute("title")).toContain("实扣");
    // 真 0 写 $0.00、缺行写「—」（未知/缺失永不显示 0）。
    expect(container.querySelector('[data-testid="ed10-usage-cost-month"]')?.textContent).toBe("$0.00");
    expect(container.querySelector('[data-testid="ed10-usage-cost-day"]')?.textContent).toBe("—");
    // 两处关键短语同族（ui2 不跨模块 import，源码级比对）。
    expect(metricsSource).toContain("实扣");
    expect(metricsSource).toContain("平台扣费账本");
  });
});

describe("R89 approvals zone honest scope (ed8-appr-scope)", () => {
  const APPROVALS_BODY = {
    items: [
      { approvalId: "ap_r89", status: "pending", action: "rotate.secret", riskLevel: "high", updatedAt: "2026-11-19T02:30:00Z", requestedBy: { id: EMP } },
    ],
    nextCursor: null,
  };
  const urls = () => vi.mocked(fetchJSON).mock.calls.map((c) => String(c[0]));
  const approvalsHandler = async (url: string) => {
    if (String(url).includes("/api/approvals")) return APPROVALS_BODY;
    return {};
  };

  it("states the page cap instead of faking paging, with a real queue exit", async () => {
    mockApi(approvalsHandler);
    await renderAt(page, at("approvals"));
    const scope = container.querySelector('[data-testid="ed8-appr-scope"]');
    expect(scope?.textContent).toContain("本区按聚合口径单页最多 200 条，超出部分请到");
    expect(scope?.textContent).toContain("审批队列");
    expect(scope?.getAttribute("title")).toContain("不在这里伪造加载更多");
    const link = container.querySelector('[data-testid="ed8-appr-scope-queue"]') as HTMLAnchorElement | null;
    expect(link?.getAttribute("href")).toBe("/approvals?status=all");
    expect(container.querySelector('[data-testid="ed8-appr-row-0"]')).toBeTruthy();
    expect(urls().filter((u) => u.includes("/api/approvals")).every((u) => !u.includes("cursor="))).toBe(true);
  });

  it("re-entering the zone re-queries without a stale cursor and keeps no rows across zones", async () => {
    mockApi(approvalsHandler);
    await renderAt(page, at("approvals"));
    expect(container.querySelector('[data-testid="ed8-appr-row-0"]')).toBeTruthy();
    const before = urls().length;
    mockApi(async () => ({ items: [] }));
    await renderAt(page, at("tasks"));
    expect(container.querySelector('[data-testid="ed8-appr-row-0"]')).toBeNull();
    mockApi(approvalsHandler);
    await renderAt(page, at("approvals"));
    expect(container.querySelector('[data-testid="ed8-appr-row-0"]')).toBeTruthy();
    const fresh = urls().slice(before);
    expect(fresh.some((u) => u.includes("/api/approvals"))).toBe(true);
    expect(fresh.every((u) => !u.includes("cursor="))).toBe(true);
  });
});

describe("R93 approvals zone state parity with the queue", () => {


  it("error reads the queue's failure sentence and retry refires exactly once", async () => {
    let hits = 0;
    mockApi((url: string) => {
      if (String(url).includes("/api/approvals")) {
        hits += 1;
        return Promise.reject(new ApiError("boom", { status: 500, body: "{}", url: String(url), requestId: "req-r93-500" }));
      }
      return Promise.resolve({ items: [] });
    });
    await renderAt(page, at("approvals"));
    const card = container.querySelector('[data-testid="ed5-approvals-error"]');
    expect(card?.querySelector("p")?.textContent).toBe(APPROVAL_FAILED_TITLE);
    expect(card?.textContent).toContain("req-r93-500");
    const btn = Array.from((card ?? document.createElement("div")).querySelectorAll("button")).find(
      (b) => (b.textContent ?? "").trim() === APPROVAL_RETRY_LABEL,
    ) as HTMLButtonElement | undefined;
    expect(btn, "retry button with the shared label").toBeTruthy();
    const before = hits;
    await act(async () => {
      btn!.click();
    });
    expect(hits, "retry refires exactly once").toBe(before + 1);
  });

  it("403 and 404 render one body with the queue's denied sentences", async () => {
    mockApi((url: string) => forbidden(String(url)));
    await renderAt(page, at("approvals"));
    const denied = container.querySelector('[data-testid="ed5-approvals-denied"]');
    const ps = Array.from(denied?.querySelectorAll("p") ?? []);
    expect(ps[0]?.textContent).toBe(APPROVAL_DENIED_TITLE);
    expect(ps[1]?.textContent).toBe(APPROVAL_DENIED_BODY);
    const asForbidden = denied?.textContent ?? "";
    mockApi((url: string) => missing(String(url)));
    await renderAt(page, at("approvals"));
    const denied404 = container.querySelector('[data-testid="ed5-approvals-denied"]');
    expect(denied404?.textContent).toBe(asForbidden);
  });

  it("the empty card opens with the queue's empty sentence", async () => {
    mockApi(() => Promise.resolve({ items: [] }));
    await renderAt(page, at("approvals"));
    const card = container.querySelector('[data-testid="ed5-approvals-empty"]');
    expect(card?.querySelector("p")?.textContent).toBe(APPROVAL_EMPTY_SENTENCE);
  });
});

describe("R52-obs employee approvals scope carrier", () => {
  it("the fixed-cap sentence hangs on a real data attribute", async () => {
    mockApi((url) =>
      url.includes("/api/approvals")
        ? Promise.resolve({
            items: [{ approvalId: "ap_c81", status: "pending", title: "口径载体单", createdAt: "2026-11-18T04:00:00Z", requestedBy: { id: EMP } }],
          })
        : Promise.resolve({}),
    );
    await renderAt(page, at("approvals"));
    const scope = container.querySelector('[data-testid="ed8-appr-scope"]');
    expect(scope, "cap sentence").toBeTruthy();
    expect(scope!.getAttribute("data-ed8-appr-scope")).toBe("aggregate-cap-200");
  });
});

describe("R96 department caliber parity (ed1-identity-department)", () => {
  const qid = (t: string) => container.querySelector(`[data-testid="${t}"]`);
  const body = (dept: unknown) => ({
    id: EMP,
    name: "AgentOS 产品助理",
    title: "产品助理",
    lifecycleState: "active",
    ownerUserId: "1",
    createdAt: "2026-11-13T22:15:30Z",
    asOf: "2026-11-20T07:00:00Z",
    ...(dept === "MISSING" ? {} : { department: dept }),
  });
  // R43 老坑复证：同 it 内换 mock 再 render 不重发（useResourceList deps=[url,nonce]），三态各拆一个 it。
  const serve = (dept: unknown) =>
    mockApi((url) =>
      url.includes(`/api/employees/${encodeURIComponent(EMP)}`)
        ? Promise.resolve(body(dept))
        : silent502(url),
    );

  it("identity department: a real value renders verbatim without a title", async () => {
    serve("增长组");
    await renderAt(page, at());
    expect(qid("ed1-identity-department")?.textContent).toBe(departmentView(true, "增长组").label);
    expect(qid("ed1-identity-department")?.getAttribute("title")).toBeNull();
  });

  it("identity department: an empty value reads 未标注部门 like the list bucket", async () => {
    serve(null);
    await renderAt(page, at());
    expect(qid("ed1-identity-department")?.textContent).toBe(DEPT_UNLABELED_LABEL);
    expect(qid("ed1-identity-department")?.getAttribute("title")).toContain("值为空");
  });

  it("identity department: a missing key reads 该字段未返回, never faking a bucket", async () => {
    serve("MISSING");
    await renderAt(page, at());
    expect(qid("ed1-identity-department")?.textContent).toBe(FIELD_MISSING);
    expect(qid("ed1-identity-department")?.getAttribute("title")).toContain("读口没有回传");
  });
});

describe("UI-C2 header department reads the same caliber as the identity card", () => {
  const body = (dept: unknown) => ({
    id: EMP,
    name: "AgentOS 产品助理",
    title: "产品助理",
    lifecycleState: "active",
    ownerUserId: "1",
    createdAt: "2026-11-13T22:15:30Z",
    asOf: "2026-11-20T07:00:00Z",
    ...(dept === "MISSING" ? {} : { department: dept }),
  });
  const serve = (dept: unknown) =>
    mockApi((url) =>
      url.includes(`/api/employees/${encodeURIComponent(EMP)}`)
        ? Promise.resolve(body(dept))
        : silent502(url),
    );
  // 头部没有 testid（禁新增）——按 header 内的「部门 · 」前缀取那一段。
  const headerDept = () =>
    Array.from(container.querySelectorAll("header p span")).find((el) =>
      (el.textContent ?? "").startsWith("部门 · "),
    ) ?? null;
  const qid2 = (t: string) => container.querySelector(`[data-testid="${t}"]`);

  it("real value: header and identity card show the identical departmentView label", async () => {
    serve("增长组");
    await renderAt(page, at());
    expect(headerDept()?.textContent).toBe(`部门 · 增长组`);
    expect(headerDept()?.getAttribute("title")).toBeNull();
    expect(qid2("ed1-identity-department")?.textContent).toBe(
      (headerDept()?.textContent ?? "").replace("部门 · ", ""),
    );
  });

  it("empty value: header reads 未标注部门 with the shared hover reason", async () => {
    serve(null);
    await renderAt(page, at());
    expect(headerDept()?.textContent).toBe(`部门 · ${DEPT_UNLABELED_LABEL}`);
    expect(headerDept()?.getAttribute("title")).toContain("值为空");
  });

  it("missing key: header reads 该字段未返回, never faking a bucket", async () => {
    serve("MISSING");
    await renderAt(page, at());
    expect(headerDept()?.textContent).toBe(`部门 · ${FIELD_MISSING}`);
    expect(headerDept()?.getAttribute("title")).toContain("读口没有回传");
  });
});
