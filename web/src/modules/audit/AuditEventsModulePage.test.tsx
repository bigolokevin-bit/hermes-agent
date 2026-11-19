// @vitest-environment jsdom
// T33 — 审计事件列表 + 详情抽屉。断言的是屏幕上的话：时间是北京时间且写明、
// 操作者只以短码出现、事件类型不认识就按原样、结果只有那三种说法；
// 四态由服务的回答驱动，403 与 404 同体且上面不留行；R30 起不再有 `?state=` 复现腿。

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
    if (url.startsWith("/agent-api/api/audit-detail")) return detail ?? { audit: {} };
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
      requestId: "req-20261119-0a7b3c",
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

/** Choose an option in one of the filter selects, the way a person does. */
async function choose(testId: string, value: string): Promise<void> {
  const node = document.querySelector<HTMLSelectElement>(`[data-testid='${testId}']`);
  if (!node) throw new Error(`select ${testId} not found`);
  await act(async () => {
    node.value = value;
    node.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const lastUrl = (): string => {
  const all = urls();
  return all[all.length - 1] ?? "";
};

/** The window a URL asked for, in milliseconds. */
const spanOf = (url: string): number => {
  const from = Date.parse(decodeURIComponent(/from=([^&]*)/.exec(url)?.[1] ?? ""));
  const to = Date.parse(decodeURIComponent(/to=([^&]*)/.exec(url)?.[1] ?? ""));
  return to - from;
};

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
  it("asks the real route, /api/ segment included, with the window it shows", async () => {
    await mount();
    expect(urls()[0]).toMatch(/^\/agent-api\/api\/audit\?limit=50&from=\d{4}-\d{2}-\d{2}T.*&to=\d{4}-\d{2}-\d{2}T/);
  });

  it("says the time in Beijing words and labels it", async () => {
    await mount();
    expect(text()).toContain("2026-11-19 09:20");
    expect(text()).toContain("2026-11-19 10:05");
    expect(text()).toContain("时间（北京时间）");
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
    expect(urls().some((u) => /^\/agent-api\/api\/audit\?limit=50&from=.*&to=.*&cursor=cur_page2$/.test(u))).toBe(true);
  });

  it("a record with nothing readable is counted, not painted blank", async () => {
    await mount(async () => ({ items: [EVENTS.items[0], { note: "只有备注" }] }));
    expect(text()).toContain("有 1 / 2 条记录缺少可显示的内容");
    expect(document.querySelectorAll("[data-testid^='aud01-row-']")).toHaveLength(1);
  });
});

describe("the event detail", () => {
  it("opens on click against the real route", async () => {
    await mount();
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud01-row-evt_7c1f2a3b4d5e6f70'] button")?.click();
    });
    await waitFor(() => urls().some((u) => u.startsWith("/agent-api/api/audit-detail")), "detail asked");
    expect(urls()).toContain("/agent-api/api/audit-detail?id=evt_7c1f2a3b4d5e6f70");
  });

  it("a row without an identifier says the detail cannot open, and asks nothing", async () => {
    await mount(async () => ({ items: [{ action: "task_created", outcome: "success" }] }));
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid^='aud01-row-'] button")?.click();
    });
    await waitFor(() => text().includes("详情没有打开"), "unaddressable row");
    expect(text()).toContain("这条记录没有给出可打开的事件标识");
    expect(urls().some((u) => u.startsWith("/agent-api/api/audit-detail"))).toBe(false);
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
      url.startsWith("/agent-api/api/audit-detail") ? DETAIL : EVENTS,
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
    const toggle = document.querySelector<HTMLButtonElement>("[data-testid='aud02-detail-details'] button")!;
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
      url.startsWith("/agent-api/api/audit-detail") ? { id: "evt_9988776655443322", action: "task_created", outcome: "success" } : EVENTS,
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
        if (url.startsWith("/agent-api/api/audit-detail")) {
          throw new ApiError("denied", { status, body: '{"code":"console.forbidden"}', url, requestId: "dt-deny" });
        }
        return EVENTS;
      });
      await render("/system?tab=events&id=evt_D6FC9A2B4E6F8012", <AuditEventsModulePage />);
      await waitFor(() => document.querySelector("[data-testid='aud02-detail-denied']") !== null, `denied ${status}`);
      return document.querySelector("[data-testid='aud02-detail-denied']")?.outerHTML ?? "";
    };
    const forbidden = await once(403);
    expect(forbidden).toContain("暂时无法查看审计事件");
    expect(forbidden).toContain("请求编号：");
    expect(forbidden).toContain("dt-deny");
    // and the same sentence carries no trace of which route was asked for
    expect(forbidden).not.toMatch(/\/agent-api|api\/audit|console\.forbidden|\b40[34]\b/);
    expect(await once(404)).toBe(forbidden);
  });
});

describe("whole-panel states", () => {
  it("loading is a skeleton, not an empty ledger", async () => {
    api.fetchJSON.mockImplementation(() => new Promise(() => {}));
    await render("/system?tab=events", <AuditEventsModulePage />);
    expect(skeleton()).toBe(true);
    expect(text()).toContain("正在读取审计事件（");
    expect(text()).not.toContain("审计事件为空");
    await act(async () => {
      root?.unmount();
    });
    root = null;
  });

  it("empty names the reason and the next step", async () => {
    await mount(async () => ({ items: [] }));
    expect(text()).toContain("按现在的筛选条件，这个时间窗里没有审计事件");
    expect(text()).toContain("把时间窗放宽一格");
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
    // the number is there to be copied, not to be retyped
    expect(document.querySelector("[data-testid='aud01-error-request-id-value'] button")).toBeTruthy();
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
    expect(document.querySelectorAll("[data-testid^='aud01-row-']")).toHaveLength(0);
    // 同体 also means neither body may echo the wire: no path, no service code,
    // no status number — a 404's path would tell a person what is missing.
    expect(forbidden).not.toMatch(/\/agent-api|api\/audit|console\.forbidden|\b40[34]\b/);
    expect(await once(404)).toBe(forbidden);
  });

  it("the ?state= repro leg is gone: a stray query never fakes a state", async () => {
    await mount(undefined, "/system?tab=events&state=empty");
    expect(text()).toContain("已显示 2 条审计事件");
    expect(document.querySelector("[data-" + "fixture]")).toBeNull();
  });
});

describe("the filters change the request (aud01)", () => {
  it("carries action=<the live dotted code> when a type is chosen", async () => {
    await mount();
    const before = urls().length;
    await choose("aud01-filter-type", "task.created");
    await waitFor(() => urls().length > before, "filtered read asked");
    const asked = urls().slice(before).join(" ");
    // the wire name the service ACTS on (probed 2026-11-19: `event_type` is
    // accepted and ignored; `action` exact-matches the dotted code)
    expect(asked).toContain("action=task.created");
    expect(asked).not.toContain("event_type");
    // and the surface says the same thing it asked for
    expect(document.querySelector("[data-testid='aud01-filters']")).toBeTruthy();
  });

  it("the dropdown only offers codes the live service was seen using", async () => {
    await mount();
    const options = Array.from(document.querySelectorAll("[data-testid='aud01-filter-type'] option")).map((o) => o.getAttribute("value"));
    expect(options[0]).toBe(""); // 全部事件类型
    const sent = options.slice(1).filter(Boolean);
    expect(sent.length).toBeGreaterThan(0);
    // underscore spellings return ZERO rows on the live `action` match — a
    // choice like that would be a filter that pretends
    for (const value of sent) {
      expect(value).toMatch(/^[a-z][a-z0-9_]*\.[a-z0-9_.]+$/);
      expect(value).not.toMatch(/approval_approved|task_created/);
    }
  });

  it("dropping the type filter again stops sending the parameter", async () => {
    await mount();
    await choose("aud01-filter-type", "task.created");
    await waitFor(() => urls().some((u) => u.includes("action=task.created")), "filtered once");
    const before = urls().length;
    await choose("aud01-filter-type", "");
    await waitFor(() => urls().length > before, "unfiltered read asked");
    expect(lastUrl()).not.toContain("action=");
  });

  it("a wider time window means a wider pair of instants on the wire", async () => {
    await mount();
    const narrow = lastUrl();
    expect(narrow).toMatch(/from=&|from=\d{4}/);
    const before = urls().length;
    await choose("aud01-filter-window", "30d");
    await waitFor(() => urls().length > before, "wider window asked");
    const wide = lastUrl();
    expect(wide).toMatch(/from=/);
    // default is the 7-day window; 30 天 is ~30/7 times as wide
    expect(spanOf(wide) / spanOf(narrow)).toBeCloseTo(30 / 7, 1);
  });

  it("every window keeps a bounded pair on the wire — the service 400s a filter-free scan", async () => {
    // require_any was probed live: `?limit=50` alone answers HTTP 400
    // console.missing_filter, so the page never asks for an unbounded scan
    // and there is no 不限时间 option to pick.
    const SPANS: Record<string, number> = { "24h": 86_400_000, "7d": 604_800_000, "30d": 2_592_000_000 };
    await mount(); // the default IS 7d — it already carries a bounded pair
    expect(spanOf(lastUrl())).toBe(SPANS["7d"]);
    for (const key of ["24h", "30d"]) {
      const before = urls().length;
      await choose("aud01-filter-window", key);
      await waitFor(() => urls().length > before && spanOf(lastUrl()) === SPANS[key], `bounded ${key}`);
      expect(lastUrl()).toMatch(/from=\d{4}-\d{2}-\d{2}T/);
      expect(lastUrl()).toMatch(/&to=\d{4}-\d{2}-\d{2}T/);
    }
    const options = Array.from(document.querySelectorAll("[data-testid='aud01-filter-window'] option"));
    expect(options.map((o) => o.getAttribute("value"))).toEqual(["24h", "7d", "30d"]);
    expect(text()).not.toContain("不限时间");
  });

  it("never puts an ignored spelling on the wire — only the parameters the service acts on", async () => {
    // Probed live 2026-11-19 against the session-authenticated BFF: `?type=`,
    // `?since=` and `?actor=` each answer HTTP 400 console.missing_filter on
    // their own, i.e. the route does not apply them. A control wired to any of
    // those names would be theatre, so no request this page makes may carry one.
    await mount();
    let asked = urls().length;
    await choose("aud01-filter-type", "task.created");
    await waitFor(() => urls().length > asked, "the type choice asks again");
    asked = urls().length;
    await choose("aud01-filter-window", "30d");
    await waitFor(() => urls().length > asked, "the window choice asks again");

    const all = urls();
    expect(all.length).toBeGreaterThanOrEqual(3);
    for (const url of all) {
      expect(url).toMatch(/[?&]from=\d{4}-\d{2}-\d{2}T/);
      expect(url).toMatch(/[?&]to=\d{4}-\d{2}-\d{2}T/);
      expect(url).not.toMatch(/[?&](type|since|actor|event_type)=/);
    }
  });

  it("the operator filter is disabled-by-design with its GAP number, not a dead control", async () => {
    await mount();
    const node = document.querySelector<HTMLSelectElement>("[data-testid='aud01-filter-operator']")!;
    expect(node.disabled).toBe(true);
    expect(text()).toContain("未接入");
    expect(text()).not.toContain("GAP-06");
    // the GAP number rides the title only — and the title states the REAL
    // reason since the probe: actorId exists, the named-operator picker does not
    const titled = document.querySelector("[title*='GAP-06']")!;
    expect(titled.getAttribute("title")).toContain("actorId");
  });

  it("a live-sampled record reads in human words, codes and handles stay hidden", async () => {
    // the exact shape / payload from the 2026-11-19 session probe
    await mount(async () => ({
      events: [
        {
          eventId: "ev_2BAA7DD7F3BC4767AF39764D91",
          tenantId: "t_seakoi_pilot",
          occurredAt: "2026-11-17T18:18:10.723Z",
          recordedAt: "2026-11-17T18:18:10.723Z",
          sourceSystem: "employee",
          actor: { type: "system", id: "employee-api" },
          action: "employee.create.denied",
          resource: { type: "creation_attempt", id: "l6-shape2-H-021810", ownerRef: "1" },
          outcome: "denied",
          responsibleHumanId: "1",
          decision: "deny",
          correlationId: "l6-shape2-H-021810",
          error: { code: "employee.invalid_initial_version", messageRedacted: "denied by domain validation" },
        },
        {
          eventId: "ev_DISPATCH0001",
          occurredAt: "2026-11-17T18:18:11Z",
          action: "dispatch.event",
          resource: { type: "channel_event", id: "evt_9f8e7d6c5b4a3f21" },
          outcome: "success",
          actor: { type: "human", id: "1" },
        },
      ],
    }));
    expect(text()).toContain("驳回新建数字员工");
    expect(text()).toContain("建号申请 · 021810");
    expect(text()).toContain("2026-11-18 02:18");
    expect(text()).toContain("系统");
    expect(text()).toContain("失败（被拒）");
    // the unknown live code passes through verbatim, exactly as the service spells it
    expect(text()).toContain("dispatch.event");
    // no wire token on the surface
    expect(text()).not.toMatch(/t_seakoi_pilot|employee\.invalid_initial_version|creation_attempt|"system"|schemaVersion/);
    // a bare numeric human id never becomes a bare handle either
    expect(text()).toContain("成员");
  });
});

describe("请求编号 (aud01)", () => {
  it("shows the number the service gave, copyable", async () => {
    await mount();
    const cell = document.querySelector("[data-testid='aud01-cell-evt_7c1f2a3b4d5e6f70-request-id']")!;
    expect(cell.textContent).toContain("req-20261119-0a7b3c");
    expect(cell.querySelector("button")).toBeTruthy();
  });

  it("an answer with no number says 未提供 and the reason, and never a blank or a 0", async () => {
    await mount();
    const cell = document.querySelector("[data-testid='aud01-cell-evt_8d2e3f4051627384-request-id']")!;
    expect(cell.textContent).toContain("未提供");
    const titled = Array.from(cell.querySelectorAll("[title]")).map((n) => n.getAttribute("title") ?? "").join(" ");
    expect(titled).toContain("服务这次没有回传请求编号");
  });

  it("an unattributed operator reads 未指派, never a bare handle", async () => {
    await mount(async () => ({ items: [{ eventId: "e9", action: "task_created", outcome: "success" }] }));
    expect(text()).toContain("未指派");
    expect(text()).not.toMatch(/emp_|human:|user:/);
  });
});

/**
 * R19 PASS tail b — the two things a reviewer tried to click and could not see:
 * the row's 详情 cell (it opened nothing) and the 完整性校验 control (it was not
 * there at all). Both are asserted by what lands in the DOM, with the text
 * length measured before and after the click so "expanded" is a number, not a
 * claim.
 */
describe("R19 tail b — the 详情 cell expands, the window check exists", () => {
  it("the 详情 cell opens a real technical panel and grows the text by a measured amount", async () => {
    await mount();
    const cell = document.querySelector<HTMLButtonElement>("[data-testid='aud01-cell-evt_7c1f2a3b4d5e6f70-details']");
    expect(cell).not.toBeNull();
    expect(cell!.getAttribute("aria-expanded")).toBe("false");

    const before = (document.body.textContent ?? "").length;
    await act(async () => {
      cell!.click();
    });
    const panel = document.querySelector("[data-testid='aud01-row-tech-details']");
    expect(panel).not.toBeNull();
    expect(panel!.textContent).toContain("事件标识");
    expect(panel!.textContent).toContain("evt_7c1f2a3b4d5e6f70");
    const after = (document.body.textContent ?? "").length;
    // The panel carries six labelled lines; anything under 40 chars would mean
    // it opened onto nothing.
    expect(after - before).toBeGreaterThan(40);
    expect(cell!.getAttribute("aria-expanded")).toBe("true");

    // One row owns the fold at a time, so the panel id stays unique.
    const other = document.querySelector<HTMLButtonElement>("[data-testid='aud01-cell-evt_8d2e3f4051627384-details']");
    await act(async () => {
      other!.click();
    });
    expect(document.querySelectorAll("[data-testid='aud01-row-tech-details']")).toHaveLength(1);
  });

  it("the window check is present and clickable, and a missing route reads 本环境未启用 with a reason", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      if (String(url).startsWith("/agent-api/api/audit-verify")) {
        throw new ApiError("unknown route", {
          status: 404,
          body: '{"code":"console.unknown_route"}',
          url: String(url),
          requestId: "rid-verify-r19",
        });
      }
      return EVENTS;
    });
    await render("/audit", <AuditEventsModulePage />);
    await waitFor(() => text().includes("已显示 2 条"), "list loaded");

    const lenBefore = (document.body.textContent ?? "").length;
    const button = document.querySelector<HTMLButtonElement>("[data-testid='aud01-verify']");
    expect(button).not.toBeNull();
    expect(button!.disabled).toBe(false);
    expect(button!.textContent).toContain("完整性校验");

    await act(async () => {
      button!.click();
    });
    await waitFor(() => document.querySelector("[data-testid='aud01-verify-not-enabled']") !== null, "not-enabled panel");

    // The request really went out, carrying the window the page shows.
    expect(urls().some((url) => /^\/agent-api\/api\/audit-verify\?from=.*&to=/.test(url))).toBe(true);

    const panel = document.querySelector("[data-testid='aud01-verify-not-enabled']")!;
    const lenAfter = (document.body.textContent ?? "").length;
    expect(lenAfter - lenBefore).toBeGreaterThan(20);
    const said = panel.textContent ?? "";
    expect(said).toContain("本环境未启用");
    expect(said).toContain("这套环境没有提供完整性校验"); // the reason
    expect(said).toContain("下一步"); // where to go from here
    expect(said).toContain("rid-verify-r19");
    // No route echo and no engineering code on the surface.
    expect(said).not.toContain("audit-verify");
    expect(said).not.toContain("console.unknown_route");
    expect(said).not.toContain("404");
    // It is not a generic error panel.
    expect(document.querySelector("[data-testid='aud01-verify-error']")).toBeNull();
  });
});

describe("R19 tail b — the window check never calls an empty scan a pass", () => {
  it("a real 200 with scanned 0 says 没有核对到记录, never 没有发现断点", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      if (String(url).startsWith("/agent-api/api/audit-verify")) {
        return { ok: true, complete: true, scanned: 0, anchorCheckpointId: "cp_x", chainHeadHash: "ah_x" };
      }
      return EVENTS;
    });
    await render("/audit", <AuditEventsModulePage />);
    await waitFor(() => text().includes("已显示 2 条"), "list loaded");

    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud01-verify']")!.click();
    });
    await waitFor(() => document.querySelector("[data-testid='aud01-verify-result']") !== null, "result panel");

    const panel = document.querySelector("[data-testid='aud01-verify-result']")!;
    const said = panel.textContent ?? "";
    expect(said).toContain("这一段没有核对到记录");
    expect(said).toContain("这不等于「完整」");
    expect(said).not.toContain("没有发现断点");
  });
});

/**
 * R21 b — the page a reviewer reaches at /audit must be this page, and its
 * page-level 技术详情 must really open. Lengths are measured so "expanded" is a
 * number rather than a claim.
 */
describe("R21 b — the page-level 技术详情 opens and survives the compat entry", () => {
  it("the page-level fold grows the DOM and reports its state in a data attribute", async () => {
    await mount();
    const trigger = document.querySelector<HTMLButtonElement>("[data-testid='aud01-tech-details'] button");
    expect(trigger).not.toBeNull();
    expect(trigger!.getAttribute("data-expanded")).toBe("false");

    const before = (document.body.textContent ?? "").length;
    await act(async () => {
      trigger!.click();
    });
    const after = (document.body.textContent ?? "").length;
    expect(after - before).toBeGreaterThan(0);
    expect(trigger!.getAttribute("data-expanded")).toBe("true");
    console.log("R21-PAGE-FOLD before=" + before + " after=" + after + " diff=" + (after - before));
  });

  it("also renders when the entry carries ?tab=events", async () => {
    await mount(undefined, "/audit?tab=events");
    expect(document.querySelector("[data-testid='agent-v2-page-audit']")).not.toBeNull();
    expect(document.querySelector("[data-testid='aud01-tech-details']")).not.toBeNull();
    await waitFor(() => text().includes("已显示 2 条"), "rows on the tab entry");
  });

  it("the row-level fold keeps its own state attribute, so an outside probe can read it", async () => {
    await mount();
    const cell = document.querySelector<HTMLButtonElement>(
      "[data-testid='aud01-cell-evt_7c1f2a3b4d5e6f70-details']",
    )!;
    expect(cell.getAttribute("data-expanded")).toBe("false");
    await act(async () => {
      cell.click();
    });
    expect(cell.getAttribute("data-expanded")).toBe("true");
    expect(document.querySelector("[data-testid='aud01-row-tech-details']")).not.toBeNull();
  });
});

describe("R21 b — a refused window check stays human", () => {
  it("a 400 from the verify route reads as a sentence, never as counts", async () => {
    await mount(async (url: string) => {
      if (String(url).startsWith("/agent-api/api/audit-verify")) {
        throw new ApiError("missing filter", {
          status: 400,
          body: '{"code":"request.missing_filter"}',
          url: String(url),
          requestId: "rid-verify-400",
        });
      }
      return EVENTS;
    });
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud01-verify']")!.click();
    });
    await waitFor(() => document.querySelector("[data-testid='aud01-verify-error']") !== null, "verify error panel");
    const panel = document.querySelector("[data-testid='aud01-verify-error']")!;
    const said = panel.textContent ?? "";
    expect(said).toContain("缺一个服务端要求的筛选条件");
    expect(said).toContain("rid-verify-400");
    expect(said).not.toContain("没有发现断点");
    expect(said).not.toContain("request.missing_filter");
  });
});

describe("retention tab dispatch", () => {
  it("renders the ret4 retention surface when ?tab=retention resolves to the events slot", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockRejectedValue(new ApiError("missing route", { status: 404, body: JSON.stringify({ code: "console.unknown_route" }), url: "/agent-api/api/retention" }));
    await render("/system?tab=retention", <AuditEventsModulePage />);
    await waitFor(() => !!document.querySelector('[data-testid="ret4-page"]'), "retention page");
    await waitFor(() => !!document.querySelector('[data-testid="ret4-unwired-note"]'), "retention unwired note");
    expect(document.querySelector('[data-testid="ret4-page"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="ret4-unwired-note"]')).toBeTruthy();
    expect(document.body.textContent).not.toContain("agent-v2-page-audit");
  });
});
