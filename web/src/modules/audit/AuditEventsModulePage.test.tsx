// @vitest-environment jsdom
// T33 — 审计事件列表 + 详情抽屉。断言的是屏幕上的话：时间是北京时间且写明、
// 操作者只以短码出现、事件类型不认识就按原样、结果只有那三种说法；
// 四态由服务的回答驱动，403 与 404 同体且上面不留行；`?state=` 腿带 data-fixture。

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

async function render(entry: string, page: ReactNode): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<MemoryRouter initialEntries={[entry]}>{page}</MemoryRouter>);
  });
}

const text = (): string => document.body.textContent ?? "";
const html = (): string => document.body.innerHTML;
const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const skeleton = (): boolean => document.querySelector(".animate-pulse") !== null;

/** Two answers: the page, then one record. Every URL the pane asks is recorded. */
function answer(page: unknown, detail?: unknown): void {
  api.fetchJSON.mockImplementation(async (url: string) => {
    if (url.startsWith("/agent-api/api/audit/detail")) return detail ?? { audit: {} };
    return page;
  });
}

const EVENTS = {
  items: [
    {
      eventId: "evt_7c1f2a3b4d5e6f70",
      event_type: "approval_approved",
      occurredAt: "2026-11-19T01:20:00Z",
      outcome: "succeeded",
      actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" },
      resource: { type: "approval", id: "ap_1122334455667788" },
    },
    {
      event_id: "evt_8d2e3f4051627384",
      action: "run.failed",
      at: "2026-11-19T02:05:00Z",
      result: "error",
      actor_id: "employee:9f8e7d6c5b4a3f21",
      error: { code: "runtime.timeout", messageRedacted: "运行超时，被系统中止" },
    },
  ],
  nextCursor: "cur_page2",
};

async function mount(handler?: (url: string) => Promise<unknown>, entry = "/system?tab=events"): Promise<void> {
  api.fetchJSON.mockReset();
  if (handler) api.fetchJSON.mockImplementation(handler);
  else answer(EVENTS);
  await render(entry, <AuditEventsModulePage />);
  await waitFor(() => !skeleton(), "first page settled");
}

beforeEach(() => {
  api.fetchJSON.mockReset();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
});

describe("the ledger list", () => {
  it("asks the real route, /api/ segment included", async () => {
    await mount();
    expect(urls()[0]).toBe("/agent-api/api/audit?limit=50");
  });

  it("says the time in Beijing words and labels it", async () => {
    await mount();
    expect(text()).toContain("2026-11-19 09:20");
    expect(text()).toContain("2026-11-19 10:05");
    expect(text()).toContain("发生时间（北京时间）");
    expect(text()).toContain("时间为北京时间");
    // no ISO string anywhere on the surface
    expect(text()).not.toMatch(/2026-11-19T|:00:00\.?\d*Z/);
  });

  it("shows the actor as 姓名 · 8位短码 and never as a handle", async () => {
    await mount();
    expect(text()).toContain("李思 · 6d7e8f90");
    expect(text()).toContain("员工 · 5b4a3f21");
    expect(text()).not.toMatch(/user:2f3a4b5c|employee:9f8e7d6c|emp_|human:/);
    const titled = Array.from(document.querySelectorAll("[title]"))
      .map((node) => node.getAttribute("title") ?? "")
      .join(" ");
    expect(titled).toContain("user:2f3a4b5c6d7e8f90");
  });

  it("names known actions in Chinese and keeps an unknown one verbatim", async () => {
    await mount(async () => ({
      items: [
        { id: "e1", action: "employee_version_created", outcome: "success" },
        { id: "e2", action: "quantum.recalibration", outcome: "success" },
      ],
    }));
    expect(text()).toContain("发布数字员工新版本");
    expect(text()).toContain("quantum.recalibration");
  });

  it("has only the three outcome words, and a failure adds the reason in words", async () => {
    await mount();
    expect(text()).toContain("成功");
    expect(text()).toContain("失败（被拒）");
    expect(text()).toContain("原因：运行超时，被系统中止");
    expect(text()).not.toMatch(/runtime\.timeout|succeeded/i);
  });

  it("keeps engineering language off the surface, disclosure closed", async () => {
    await mount();
    expect(text()).not.toMatch(/HTTP|undefined|NaN|run_id|event_type|occurred_at|\b500\b|\b403\b/);
  });

  it("counts the page honestly and offers the next cursor only when one came", async () => {
    await mount();
    expect(text()).toContain("已显示 2 条审计事件");
    expect(text()).toContain("下面还有更多");
    await act(async () => {
      (Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes("加载更多")) as HTMLButtonElement).click();
    });
    await waitFor(() => urls().some((u) => u.includes("cursor=cur_page2")), "second page asked");
    expect(urls()).toContain("/agent-api/api/audit?limit=50&cursor=cur_page2");
  });

  it("a record with nothing readable is counted, not painted blank", async () => {
    await mount(async () => ({ items: [EVENTS.items[0], { note: "只有备注" }] }));
    expect(text()).toContain("有 1 / 2 条记录缺少可显示的内容");
    expect(document.querySelectorAll("[data-testid^='audit-row-']")).toHaveLength(1);
  });
});

describe("the event detail", () => {
  it("opens on click against the real route", async () => {
    await mount();
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='audit-row-evt_7c1f2a3b4d5e6f70'] button")?.click();
    });
    await waitFor(() => urls().some((u) => u.startsWith("/agent-api/api/audit/detail")), "detail asked");
    expect(urls()).toContain("/agent-api/api/audit/detail?id=evt_7c1f2a3b4d5e6f70");
  });

  it("a row without an identifier says the detail cannot open, and asks nothing", async () => {
    await mount(async () => ({ items: [{ action: "task_created", outcome: "success" }] }));
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid^='audit-row-'] button")?.click();
    });
    await waitFor(() => text().includes("详情没有打开"), "unaddressable row");
    expect(text()).toContain("这条记录没有给出可打开的事件标识");
    expect(urls().some((u) => u.startsWith("/agent-api/api/audit/detail"))).toBe(false);
  });

  const DETAIL = {
    audit: {
      eventId: "evt_D6FC9A2B4E6F8012",
      event_type: "grant_escalation",
      occurredAt: "2026-11-18T03:00:00Z",
      recordedAt: "2026-11-18T03:00:05Z",
      outcome: "rejected",
      actor: { type: "human", id: "user:1122334455667788", displayName: "郑涛" },
      resource: { type: "permission", id: "perm_99aabbccddeeff00" },
      sourceSystem: "agentos-core",
      tenantId: "tenant_0f1e2d3c4b5a6978",
      runId: "run_77aaee33ff001122",
      approvalId: "ap_1122334455667788",
      hash: "1a2b3c4d5e6f708192a3b4c5d6e7f809",
      prevHash: "0f1e2d3c4b5a6978a3b4c5d6e7f8091a",
      error: { code: "policy.denied", messageRedacted: "策略不允许在这台环境上提权" },
      change: { before: "只读", after: "可写" },
    },
  };

  async function openDetail(): Promise<void> {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url: string) =>
      url.startsWith("/agent-api/api/audit/detail") ? DETAIL : EVENTS,
    );
    await render("/system?tab=events&id=evt_D6FC9A2B4E6F8012", <AuditEventsModulePage />);
    await waitFor(() => text().includes("结果与原因"), "detail painted");
  }

  it("shows the seven human sections and no raw field name", async () => {
    await openDetail();
    for (const heading of ["事件", "操作者", "资源", "结果与原因", "变更", "关联", "完整性"]) {
      expect(text()).toContain(heading);
    }
    expect(text()).toContain("变更前");
    expect(text()).toContain("只读");
    expect(text()).toContain("可写");
    expect(text()).toContain("郑涛 · 55667788");
    expect(text()).toContain("策略不允许在这台环境上提权");
    expect(text()).not.toMatch(/event_type|occurredAt|recorded_at|prevHash|tenantId|runId|run_id|policy\.denied|agentos-core/);
  });

  it("technical values stay behind 技术详情: absent closed, present when opened", async () => {
    await openDetail();
    expect(text()).not.toContain("1a2b3c4d5e6f7081");
    expect(text()).not.toContain("evt_D6FC9A2B4E6F8012");
    const toggle = document.querySelector<HTMLButtonElement>("[data-testid='audit-detail-details'] button")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await act(async () => {
      toggle.click();
    });
    expect(text()).toContain("1a2b3c4d5e6f7081");
    expect(text()).toContain("前一条摘要：0f1e2d3c4b5a6978a3b4c5d6e7f8091a");
    expect(text()).toContain("事件标识：evt_D6FC9A2B4E6F8012");
  });

  it("the digest on the surface is masked, the whole one is only a title", async () => {
    await openDetail();
    expect(text()).toContain("1a2b3c4d5e…");
    const titled = Array.from(document.querySelectorAll("[title]"))
      .map((node) => node.getAttribute("title") ?? "")
      .join(" ");
    expect(titled).toContain("1a2b3c4d5e6f708192a3b4c5d6e7f809");
    expect(titled).toContain("run_77aaee33ff001122");
  });

  it("a record without a change does not invent a 变更 section", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url: string) =>
      url.startsWith("/agent-api/api/audit/detail") ? { id: "evt_9988776655443322", action: "task_created", outcome: "success" } : EVENTS,
    );
    await render("/system?tab=events&id=evt_9988776655443322", <AuditEventsModulePage />);
    await waitFor(() => text().includes("结果与原因"), "bare detail painted");
    expect(text()).not.toContain("变更前");
    expect(text()).toContain("这条记录没有带上完整性摘要");
  });

  it("403 and 404 read the same body on the detail too", async () => {
    const once = async (status: number): Promise<string> => {
      api.fetchJSON.mockReset();
      api.fetchJSON.mockImplementation(async (url: string) => {
        if (url.startsWith("/agent-api/api/audit/detail")) {
          throw new ApiError("denied", { status, body: '{"code":"console.forbidden"}', url, requestId: "dt-deny" });
        }
        return EVENTS;
      });
      await render("/system?tab=events&id=evt_D6FC9A2B4E6F8012", <AuditEventsModulePage />);
      await waitFor(() => document.querySelector("[data-testid='audit-denied']") !== null, `denied ${status}`);
      return document.querySelector("[data-testid='audit-denied']")?.outerHTML ?? "";
    };
    const forbidden = await once(403);
    expect(forbidden).toContain("暂时无法查看审计事件");
    expect(forbidden).toContain("请求编号：dt-deny");
    expect(await once(404)).toBe(forbidden);
  });
});

describe("whole-panel states", () => {
  it("loading is a skeleton, not an empty ledger", async () => {
    api.fetchJSON.mockImplementation(() => new Promise(() => {}));
    await render("/system?tab=events", <AuditEventsModulePage />);
    expect(skeleton()).toBe(true);
    expect(text()).toContain("正在读取审计事件…");
    expect(text()).not.toContain("审计事件为空");
    await act(async () => {
      root?.unmount();
    });
    root = null;
  });

  it("empty names the reason and the next step", async () => {
    await mount(async () => ({ items: [] }));
    expect(text()).toContain("服务回了这个环境里最近的审计事件为空");
    expect(text()).toContain("稍后再刷新一次");
    expect(text()).toContain("刷新");
  });

  it("error keeps the sentence and the trace id, and retry asks again", async () => {
    let asked = 0;
    await mount(async () => {
      asked += 1;
      throw new ApiError("gateway", { status: 500, body: "", url: "/agent-api/api/audit", requestId: "au-1101" });
    });
    expect(text()).toContain("审计事件没能加载出来");
    expect(text()).toContain("请求编号：au-1101");
    expect(text()).not.toMatch(/\b500\b|HTTP/);
    answer(EVENTS);
    await act(async () => {
      (Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes("重试")) as HTMLButtonElement).click();
    });
    await waitFor(() => asked === 1 && text().includes("已显示 2 条"), "retry loaded");
  });

  it("an error with no id gives the copy-and-report fallback instead of inventing one", async () => {
    await mount(async () => {
      throw new ApiError("gone", { status: 502, body: "bad gateway", url: "/agent-api/api/audit" });
    });
    expect(text()).toContain("本次请求未记录编号，可复制时间与操作路径反馈");
    expect(text()).not.toContain("未提供");
  });

  it("403 and 404 draw one identical body with no rows above it", async () => {
    const once = async (status: number): Promise<string> => {
      await mount(async () => {
        throw new ApiError("denied", {
          status,
          body: '{"code":"console.forbidden"}',
          url: "/agent-api/api/audit",
          requestId: "au-deny",
        });
      });
      return html();
    };
    const forbidden = await once(403);
    expect(text()).toContain("暂时无法查看审计事件");
    expect(text()).toContain("请求编号：au-deny");
    expect(document.querySelectorAll("[data-testid^='audit-row-']")).toHaveLength(0);
    expect(await once(404)).toBe(forbidden);
  });

  it("each state also opens from the URL, marked as a repro", async () => {
    api.fetchJSON.mockReset();
    const open = async (state: string): Promise<void> => {
      await render(`/system?tab=events&state=${state}`, <AuditEventsModulePage />);
      await waitFor(
        () => (document.body.textContent ?? "").includes("复现出来的状态") || state === "loading",
        `?state=${state} painted`,
      );
    };
    await open("loading");
    expect(document.querySelector("[data-fixture='loading']")).toBeTruthy();
    expect(api.fetchJSON).not.toHaveBeenCalled();
    await open("empty");
    expect(document.querySelector("[data-testid='audit-events-empty'][data-fixture='empty']")).toBeTruthy();
    await open("error");
    expect(text()).toContain("本次请求未记录编号，可复制时间与操作路径反馈");
    expect(document.querySelector("[data-fixture='error']")).toBeTruthy();
    await open("denied");
    expect(document.querySelector("[data-fixture='denied']")).toBeTruthy();
    expect(document.querySelectorAll("[data-testid^='audit-row-']")).toHaveLength(0);
    expect(api.fetchJSON).not.toHaveBeenCalled();
  });

  it("a real answer takes over once the repro is off", async () => {
    await mount(undefined, "/system?tab=events&state=empty");
    expect(document.querySelector("[data-fixture='empty']")).toBeTruthy();
    await mount();
    expect(text()).toContain("已显示 2 条审计事件");
    expect(document.querySelector("[data-fixture]")).toBeNull();
  });
});
