// @vitest-environment jsdom
// T33 — 审计事件列表 + 详情抽屉。断言的是屏幕上的话：时间是北京时间且写明、
// 操作者只以短码出现、事件类型不认识就按原样、结果只有那三种说法；
// 四态由服务的回答驱动，403 与 404 同体且上面不留行；R30 起不再有 `?state=` 复现腿。

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
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

/** Reads the address the pane itself wrote, so the deep link can be judged. */
function LocationProbe(): ReactNode {
  const loc = useLocation();
  return <span data-testid="probe-location">{`${loc.pathname}${loc.search}`}</span>;
}
const locationText = (): string => document.querySelector("[data-testid='probe-location']")?.textContent ?? "";

/** R39: a Back button, so a test can walk the history the way a person does. */
function BackProbe(): ReactNode {
  const navigate = useNavigate();
  return (
    <button type="button" data-testid="probe-back" onClick={() => navigate(-1)}>
      back
    </button>
  );
}

/** Two answers: the page, then one record. Every URL the pane asks is recorded. */
function answer(page: unknown, detail?: unknown): void {
  api.fetchJSON.mockImplementation(async (url: string) => {
    if (url.startsWith("/agent-api/api/audit-detail")) return detail ?? { audit: {} };
    return page;
  });
}

// R39: the detail read is mocked with an empty-but-valid detail body.
const DETAIL = { audit: {} };

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

/** Type into a datetime-local control the way React tracks the value. */
async function typeInto(testId: string, value: string): Promise<void> {
  const node = document.querySelector<HTMLInputElement>(`[data-testid='${testId}']`);
  if (!node) throw new Error(`input ${testId} not found`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
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

  it("names known actions in Chinese and calls an unmapped one 其他事件, its code only in title", async () => {
    await mount(async () => ({
      items: [
        { id: "e1", action: "employee_version_created", outcome: "success" },
        { id: "e2", action: "quantum.recalibration", outcome: "success" },
      ],
    }));
    expect(text()).toContain("发布数字员工新版本");
    expect(text()).toContain("其他事件");
    // the machine spelling never reaches the surface; it lives in the row title
    expect(text()).not.toContain("quantum.recalibration");
    const titled = Array.from(document.querySelectorAll("[title]"))
      .map((node) => node.getAttribute("title") ?? "")
      .join(" ");
    expect(titled).toContain("quantum.recalibration");
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
      (document.querySelector("[data-testid='aud01-load-more']") as HTMLButtonElement).click();
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
  it("the documented ?detail= spelling opens the same record on a cold load", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url: string) =>
      url.startsWith("/agent-api/api/audit-detail") ? DETAIL : EVENTS,
    );
    await render("/audit?detail=evt_D6FC9A2B4E6F8012", <AuditEventsModulePage />);
    await waitFor(() => text().includes("结果与原因"), "detail painted from ?detail=");
    expect(urls()).toContain("/agent-api/api/audit-detail?id=evt_D6FC9A2B4E6F8012");
  });

  it("opening a row writes ?detail= and clearing it drops both spellings", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url: string) =>
      url.startsWith("/agent-api/api/audit-detail") ? DETAIL : EVENTS,
    );
    await render(
      "/audit?window=7d",
      <>
        <AuditEventsModulePage />
        <LocationProbe />
      </>,
    );
    await waitFor(() => !skeleton(), "first page settled");
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud01-row-evt_7c1f2a3b4d5e6f70'] button")?.click();
    });
    await waitFor(() => locationText().includes("detail="), "detail written to the address");
    expect(locationText()).toContain("detail=evt_7c1f2a3b4d5e6f70");
    expect(locationText()).not.toContain("id=");
    // the window the person was reading survives the round trip
    expect(locationText()).toContain("window=7d");
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud02-detail-close']")?.click();
    });
    expect(locationText()).not.toContain("detail=");
    expect(locationText()).not.toContain("id=");
  });

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
    expect(options.map((o) => o.getAttribute("value"))).toEqual(["24h", "7d", "30d", "custom"]);
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

  it("the operator filter is a real control whose limits ride the title", async () => {
    await mount();
    const node = document.querySelector<HTMLSelectElement>("[data-testid='aud01-filter-operator']")!;
    // aud9: the read口 answers actorId (live probe #11: 200, 50/50 rows), so
    // the control is wired instead of 未接入. What it cannot do — name people —
    // is stated in words under it and in the title, never by a dead select.
    expect(node.disabled).toBe(false);
    const options = [...node.options].map((option) => option.value);
    expect(options[0]).toBe("");
    expect(options).toContain("user:2f3a4b5c6d7e8f90");
    // the option text is the human label; the handle stays in the value
    const labels = [...node.options].map((option) => option.text);
    expect(labels.join(" ")).toContain("李思");
    expect(node.selectedOptions[0]!.text).toBe("全部操作者");
    expect(text()).not.toContain("GAP-06");
    const titled = document.querySelector("[title*='GAP-06']")!;
    expect(titled.getAttribute("title")).toContain("actorId");
    // no filter chosen yet → no scope note, no handle on the wire
    expect(document.querySelector("[data-testid='aud9-scope-note']")).toBeNull();
    expect(lastUrl()).not.toMatch(/actorId=/);
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
    // an unmapped live code reads 其他事件 on the surface; its spelling stays in title
    expect(text()).toContain("其他事件");
    expect(text()).not.toContain("dispatch.event");
    const titled = Array.from(document.querySelectorAll("[title]"))
      .map((node) => node.getAttribute("title") ?? "")
      .join(" ");
    expect(titled).toContain("dispatch.event");
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

describe("R34 — a real window and an honest export", () => {
  it("keeps a custom window in the address and asks exactly that span", async () => {
    api.fetchJSON.mockReset();
    answer(EVENTS);
    await render(
      "/system?tab=events&window=custom&from=2026-11-17T01:00:00.000Z&to=2026-11-17T02:30:00.000Z",
      <><AuditEventsModulePage /><LocationProbe /></>,
    );
    await waitFor(() => urls().length > 0, "custom read asked");
    expect(spanOf(lastUrl())).toBe(90 * 60 * 1000);
    const decoded = decodeURIComponent(lastUrl());
    expect(decoded).toContain("from=2026-11-17T01:00:00.000Z");
    expect(decoded).toContain("to=2026-11-17T02:30:00.000Z");
    expect(document.querySelector<HTMLInputElement>("[data-testid='aud01-custom-from']")?.value).toBe("2026-11-17T09:00");
    expect(document.querySelector<HTMLInputElement>("[data-testid='aud01-custom-to']")?.value).toBe("2026-11-17T10:30");
    expect(locationText()).toContain("window=custom");
  });

  it("asks nothing while a custom window is half filled, and says what is missing", async () => {
    await mount(undefined, "/system?tab=events&window=custom");
    expect(urls()).toHaveLength(0);
    expect(document.querySelector("[data-testid='aud01-custom-hint']")).not.toBeNull();
    expect(text()).toContain("自定义时间窗还不完整");
    expect(document.querySelector("[data-testid='aud01-export']")?.getAttribute("aria-disabled")).toBe("true");
  });

  it("turning the two inputs into a valid range asks for that range", async () => {
    await mount(undefined, "/system?tab=events&window=custom");
    expect(urls()).toHaveLength(0);
    await typeInto("aud01-custom-from", "2026-11-17T09:00");
    await typeInto("aud01-custom-to", "2026-11-17T10:30");
    await waitFor(() => urls().length > 0 && spanOf(lastUrl()) === 90 * 60 * 1000, "custom range read");
    const decoded = decodeURIComponent(lastUrl());
    expect(decoded).toContain("from=2026-11-17T01:00:00.000Z");
    expect(decoded).toContain("to=2026-11-17T02:30:00.000Z");
  });

  it("exports the Chinese header and one line per row, without inventing a zero", async () => {
    const bodies: string[] = [];
    const RealBlob = window.Blob;
    const realCreate = URL.createObjectURL;
    const realRevoke = URL.revokeObjectURL;
    let fileName = "";
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        fileName = this.download;
      });
    class SpyBlob extends RealBlob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        bodies.push(String(parts[0] ?? ""));
      }
    }
    window.Blob = SpyBlob as unknown as typeof Blob;
    URL.createObjectURL = vi.fn(() => "blob:audit") as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
    try {
      await mount();
      const node = document.querySelector<HTMLElement>("[data-testid='aud01-export']");
      expect(node?.getAttribute("aria-disabled")).toBe("false");
      await act(async () => {
        node?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(bodies).toHaveLength(1);
      const lines = bodies[0].replace(/^\uFEFF/, "").split("\r\n").filter((line) => line !== "");
      expect(lines[0]).toBe("时间,类型,结果,操作者,对象,请求编号");
      expect(lines).toHaveLength(3);
      expect(lines[1]).toContain("2026-11-19 09:20");
      expect(lines[1]).toContain("李思 · 6d7e8f90");
      // the second event never carried a request number: the cell stays empty.
      expect(lines[2]?.endsWith(",")).toBe(true);
      expect(fileName).toMatch(/^audit-.+-\d{8}-\d{4}\.csv$/);
    } finally {
      window.Blob = RealBlob;
      URL.createObjectURL = realCreate;
      URL.revokeObjectURL = realRevoke;
      clickSpy.mockRestore();
    }
  });
});

/**
 * R38 — QA measured a single aud01-verify anchor on screen because the inline
 * panel only rendered the result body. The whole family is handed in now, so
 * one real run has to put at least seven of them in the DOM.
 */
describe("R38 — one real verify run paints the aud01-verify family", () => {
  it("a 200 verify answer yields at least seven aud01-verify anchors", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      const href = String(url);
      if (href.startsWith("/agent-api/api/audit-verify")) {
        return { ok: true, complete: true, scanned: 43, anchorCheckpointId: "cp_x", chainHeadHash: "ah_x" };
      }
      return EVENTS;
    });
    await render("/audit?window=7d", <AuditEventsModulePage />);
    await waitFor(() => text().includes("已显示 2 条"), "list loaded");
    expect(document.querySelectorAll("[data-testid^='aud01-verify']").length).toBe(1);

    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud01-verify']")!.click();
    });
    await waitFor(() => document.querySelector("[data-testid='aud01-verify-result']") !== null, "verify result");

    expect(document.querySelectorAll("[data-testid^='aud01-verify']").length).toBeGreaterThanOrEqual(7);
    for (const id of [
      "aud01-verify",
      "aud01-verify-status",
      "aud01-verify-rerun",
      "aud01-verify-result",
      "aud01-verify-result-body",
      "aud01-verify-counts",
      "aud01-verify-window",
      "aud01-verify-scanned",
      "aud01-verify-broken",
      "aud01-verify-detail",
      "aud01-verify-window-label",
      "aud01-verify-asof",
    ]) {
      expect(document.querySelector("[data-testid='" + id + "']"), id).not.toBeNull();
    }
    expect(document.querySelector("[data-testid='aud01-verify-result']")!.textContent ?? "").toContain("已核对");
  });
});

describe("R39 — a record is a history entry and the verify panel never echoes a route code", () => {
  it("open and back, three times over, always lands on the list with the filters kept", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url: string) =>
      url.startsWith("/agent-api/api/audit-detail") ? DETAIL : EVENTS,
    );
    await render(
      "/audit?window=7d",
      <>
        <AuditEventsModulePage />
        <LocationProbe />
        <BackProbe />
      </>,
    );
    await waitFor(() => !skeleton(), "first page settled");
    for (let cycle = 1; cycle <= 3; cycle += 1) {
      await act(async () => {
        document
          .querySelector<HTMLButtonElement>("[data-testid='aud01-row-evt_7c1f2a3b4d5e6f70'] button")
          ?.click();
      });
      await waitFor(() => locationText().includes("detail="), "cycle " + cycle + ": detail in the address");
      await act(async () => {
        document.querySelector<HTMLButtonElement>("[data-testid='probe-back']")?.click();
      });
      await waitFor(() => !locationText().includes("detail="), "cycle " + cycle + ": back on the list");
      expect(locationText()).toContain("window=7d");
      expect(document.querySelector("[data-testid='aud01-row-evt_7c1f2a3b4d5e6f70']")).not.toBeNull();
    }
  });


  it("an environment without the verify route says 本环境未启用 and never prints the route code", async () => {
    const verifyGone = async (url: string): Promise<unknown> => {
      if (String(url).startsWith("/agent-api/api/audit-verify")) {
        throw new ApiError("unknown route", {
          status: 404,
          body: '{"code":"console.unknown_route"}',
          url: String(url),
          requestId: "rid-verify-r39",
        });
      }
      return EVENTS;
    };

    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url: string) => {
      if (url.startsWith("/agent-api/api/audit-verify")) {
        throw new ApiError("unknown_route", {
          status: 404,
          body: JSON.stringify({ code: "console.unknown_route", message: "unknown console API route" }),
          url,
        });
      }
      return EVENTS;
    });
    await mount(verifyGone);
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud01-verify']")?.click();
    });
    await waitFor(
      () => document.querySelector("[data-testid='aud01-verify-not-enabled']") !== null,
      "not-enabled panel",
    );
    const panel = document.querySelector("[data-testid='aud01-verify-not-enabled']")!;
    expect(panel.textContent).toContain("本环境未启用");
    expect(panel.textContent).not.toContain("unknown_route");
    expect(panel.textContent).not.toContain("console.unknown");
  });
});

describe("R50 - the inline row preview", () => {
  it("opens in place, announces itself, links to the real detail, and Esc closes it", async () => {
    await mount();
    const toggle = document.querySelector<HTMLButtonElement>("[data-testid='aud6-toggle-evt_7c1f2a3b4d5e6f70']");
    expect(toggle).not.toBeNull();
    expect(toggle!.getAttribute("aria-expanded")).toBe("false");
    const before = urls().length;
    await act(async () => { toggle!.click(); });
    expect(toggle!.getAttribute("aria-expanded")).toBe("true");
    const preview = document.querySelector("[data-testid='aud6-preview-evt_7c1f2a3b4d5e6f70']");
    expect(preview).not.toBeNull();
    expect(preview!.textContent).toContain("事件类型");
    expect(preview!.textContent).toContain("李思");
    const link = preview!.querySelector("a[href]");
    // aud8 changed this contract on purpose: the link now carries the reading
    // state it sits in (the open fold, the page's filters) so opening a record
    // from a preview returns to the same place instead of a bare first page.
    expect(link!.getAttribute("href")).toContain("detail=evt_7c1f2a3b4d5e6f70");
    expect(link!.getAttribute("href")).toContain("preview=evt_7c1f2a3b4d5e6f70");
    expect(link!.getAttribute("href")!.startsWith("/audit?")).toBe(true);
    expect(urls().length).toBe(before);
    await act(async () => {
      (toggle!.closest("div") as HTMLElement).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.querySelector("[data-testid='aud6-preview-evt_7c1f2a3b4d5e6f70']")).toBeNull();
  });
});

describe("R51 - the event type distribution", () => {
  it("counts the loaded page by type, stays collapsed first, and asks nothing new", async () => {
    await mount();
    expect(document.querySelector("[data-testid='aud7-types-panel']")).toBeNull();
    const toggle = document.querySelector<HTMLButtonElement>("[data-testid='aud7-types-toggle']");
    expect(toggle).not.toBeNull();
    expect(toggle!.getAttribute("aria-expanded")).toBe("false");
    const before = urls().length;
    await act(async () => { toggle!.click(); });
    const panel = document.querySelector("[data-testid='aud7-types-panel']");
    expect(panel).not.toBeNull();
    const rows = document.querySelectorAll("[data-testid='aud7-types-row']");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(8);
    expect(document.querySelector("[data-testid='aud7-types']")!.textContent).toContain("按已加载的 2 条统计");
    expect(document.querySelectorAll("[data-testid='aud7-types-count']").length).toBe(rows.length);
    expect(urls().length).toBe(before);
  });
});

/**
 * aud8 — 跨页证据浏览的连续性。地址栏就是全部阅读状态：筛选（时间窗 / 事件类型 /
 * 地址带入的句柄筛选）+ 页码（cursor 栈）+ 行展开态（预览与技术折叠）在
 * 「详情→返回列表」之后原样复原；把恢复后的地址冷挂载（等价于粘贴刷新）也落在同一处。
 * 服务端带回 total 就用真值，没带回就继续说「总数不可用」并写明原因。
 */
describe("aud8 - cross-page evidence continuity", () => {
  /** The same mount, with the address the pane writes on screen for assertions. */
  async function mountProbed(entry: string): Promise<void> {
    api.fetchJSON.mockReset();
    answer(EVENTS);
    await render(
      entry,
      <>
        <AuditEventsModulePage />
        <LocationProbe />
      </>,
    );
    await waitFor(() => !skeleton(), "first page settled");
  }

  async function openPreviewOf(rowKey = "evt_7c1f2a3b4d5e6f70"): Promise<void> {
    await act(async () => {
      document.querySelector<HTMLButtonElement>(`[data-testid='aud6-toggle-${rowKey}']`)?.click();
    });
    await waitFor(() => document.querySelector(`[data-testid='aud6-preview-${rowKey}']`) !== null, "preview open");
  }

  async function openDetailOf(rowKey = "evt_7c1f2a3b4d5e6f70"): Promise<void> {
    await act(async () => {
      document.querySelector<HTMLButtonElement>(`[data-testid='aud01-row-${rowKey}'] button`)?.click();
    });
    await waitFor(() => locationText().includes("detail="), "detail written to the address");
  }

  it("the type filter and both inline folds are written into the address", async () => {
    await mountProbed("/audit?window=24h");
    await choose("aud01-filter-type", "task.created");
    await waitFor(() => locationText().includes("type=task.created"), "type written to the address");
    await openPreviewOf();
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud01-cell-evt_8d2e3f4051627384-details']")?.click();
    });
    const url = locationText();
    expect(url).toContain("window=24h");
    expect(url).toContain("type=task.created");
    expect(url).toContain("preview=evt_7c1f2a3b4d5e6f70");
    expect(url).toContain("tech=evt_8d2e3f4051627384");
    expect(lastUrl()).toContain("action=task.created");
    expect(text()).toContain("事件类型");
    expect(document.querySelector("[data-testid='aud01-row-tech-details']")).not.toBeNull();
  });

  it("详情→返回列表 puts the page, the filters and the open row back untouched", async () => {
    await mountProbed("/audit?window=24h&type=task.created");
    await act(async () => {
      (document.querySelector("[data-testid='aud01-load-more']") as HTMLButtonElement).click();
    });
    await waitFor(() => urls().some((u) => u.includes("cursor=cur_page2")), "second page asked");
    expect(document.querySelector("[data-testid='aud2-page']")!.textContent).toContain("第 2 页");
    await openPreviewOf();
    await openDetailOf();
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud8-back-to-list']")?.click();
    });
    await waitFor(() => !locationText().includes("detail="), "back on the list");
    const url = locationText();
    expect(url).toContain("window=24h");
    expect(url).toContain("type=task.created");
    expect(url).toContain("cursor=cur_page2");
    expect(url).toContain("preview=evt_7c1f2a3b4d5e6f70");
    expect(document.querySelector("[data-testid='aud2-page']")!.textContent).toContain("第 2 页");
    expect(document.querySelector("[data-testid='aud6-preview-evt_7c1f2a3b4d5e6f70']")).not.toBeNull();
    expect(document.querySelector("[data-testid='aud02-detail']")).toBeNull();
  });

  it("that restored address, pasted cold, lands in the same place", async () => {
    const entry =
      "/audit?window=24h&type=task.created&cursor=cur_page2&preview=evt_7c1f2a3b4d5e6f70&actor=employee-api";
    await mount(undefined, entry);
    await waitFor(() => !skeleton(), "cold address settled");
    expect(lastUrl()).toContain("cursor=cur_page2");
    expect(lastUrl()).toContain("action=task.created");
    expect(lastUrl()).toContain("actorId=employee-api");
    expect(document.querySelector("[data-testid='aud2-page']")!.textContent).toContain("第 2 页");
    expect(document.querySelector<HTMLInputElement>("[data-testid='aud01-filter-window']")!.value).toBe("24h");
    expect(document.querySelector<HTMLInputElement>("[data-testid='aud01-filter-type']")!.value).toBe("task.created");
    expect(document.querySelector("[data-testid='aud6-preview-evt_7c1f2a3b4d5e6f70']")).not.toBeNull();
    expect(document.querySelector("[data-testid='aud8-state-line']")!.textContent).toContain("第 2 页");
    // the handle itself stays off the human layer: it is on the wire, not on screen
    expect(text()).not.toContain("employee-api");
  });

  it("the address-borne handles go on the wire and 取消 re-reads without them", async () => {
    await mountProbed("/audit?window=7d&actor=employee-api&resource=ap_1122334455667788");
    expect(lastUrl()).toContain("actorId=employee-api");
    expect(lastUrl()).toContain("resourceId=ap_1122334455667788");
    expect(document.querySelector("[data-testid='aud8-actor-chip']")).not.toBeNull();
    expect(document.querySelector("[data-testid='aud8-resource-chip']")).not.toBeNull();
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud8-actor-clear']")?.click();
    });
    await waitFor(() => !/[?&]actor=/.test(locationText()), "actor dropped from the address");
    await waitFor(() => !urls()[urls().length - 1]!.includes("actorId="), "re-read without the handle");
    expect(urls()[urls().length - 1]).toContain("resourceId=ap_1122334455667788");
    expect(document.querySelector("[data-testid='aud8-actor-chip']")).toBeNull();
    expect(document.querySelector("[data-testid='aud8-resource-chip']")).not.toBeNull();
  });

  it("no handle in the address means no handle on the wire", async () => {
    await mount();
    for (const url of urls()) {
      expect(url).not.toMatch(/[?&](actorId|resourceId)=/);
    }
    expect(document.querySelector("[data-testid='aud8-url-filters']")).toBeNull();
  });

  it("a total the service states is printed as its own number", async () => {
    await mount(async (url) =>
      String(url).startsWith("/agent-api/api/audit-detail")
        ? DETAIL
        : { items: EVENTS.items, nextCursor: "cur_page2", total: 137 },
    );
    const node = document.querySelector("[data-testid='aud2-total']")!;
    expect(node.textContent).toBe("共 137 条");
    expect(node.getAttribute("title")).toContain("服务");
  });

  it("an answer without total, or with only a page count, stays 总数不可用", async () => {
    await mount();
    const node = document.querySelector("[data-testid='aud2-total']")!;
    expect(node.textContent).toBe("总数不可用");
    expect(node.getAttribute("title")).toContain("游标分页不能自算总数");
    await mount(async (url) =>
      String(url).startsWith("/agent-api/api/audit-detail") ? DETAIL : { items: EVENTS.items, count: 2 },
    );
    expect(document.querySelector("[data-testid='aud2-total']")!.textContent).toBe("总数不可用");
  });

  it("a changed filter drops the stale folds and the page stack together", async () => {
    await mountProbed("/audit?window=24h&cursor=cur_page2&preview=evt_7c1f2a3b4d5e6f70");
    await choose("aud01-filter-window", "30d");
    await waitFor(() => !locationText().includes("cursor="), "paging stack dropped with the window");
    expect(locationText()).not.toContain("preview=");
    expect(document.querySelector("[data-testid='aud2-page']")!.textContent).toContain("第 1 页");
  });
});

/**
 * aud9 — actor 联动筛选的组合、切条件重取恰一次（请求计数）、`?event=<id>` 深链
 * 定位展开与关闭保态、事件不存在的诚实文案 + 可复制 rid。
 * 断言的是地址栏与服务回答：筛选值上线（actorId），本地匹配写明范围，
 * 没有一次重复请求风暴，也没有一句服务没说过的话。
 */
describe("aud9 - actor filter, request count and the event deep link", () => {
  async function mountProbed(entry: string): Promise<void> {
    api.fetchJSON.mockReset();
    answer(EVENTS);
    await render(
      entry,
      <>
        <AuditEventsModulePage />
        <LocationProbe />
      </>,
    );
    await waitFor(() => !skeleton(), "first page settled");
  }

  /** Only the list reads, so a detail or verify leg never moves the count. */
  const listReads = (): string[] => urls().filter((u) => /^\/agent-api\/api\/audit\?/.test(u));

  /** Let the pane settle, then report how many reads the last action caused. */
  async function readsAfter(action: () => Promise<void> | void): Promise<number> {
    const before = listReads().length;
    await action();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    return listReads().length - before;
  }

  it("choosing an operator writes ?actor=, goes on the wire, and asks exactly once", async () => {
    await mountProbed("/audit?window=7d");
    const first = lastUrl();
    const asked = await readsAfter(() => choose("aud01-filter-operator", "user:2f3a4b5c6d7e8f90"));
    expect(asked).toBe(1);
    expect(locationText()).toContain("actor=user%3A2f3a4b5c6d7e8f90");
    expect(lastUrl()).toContain("actorId=user%3A2f3a4b5c6d7e8f90");
    expect(lastUrl()).not.toBe(first);
    // the scope of the filter is stated in words, not implied
    const note = document.querySelector("[data-testid='aud9-scope-note']")!.textContent ?? "";
    expect(note).toContain("服务端");
    expect(note).toContain("时间窗");
    expect(document.querySelector("[data-testid='aud8-actor-chip']")).not.toBeNull();
  });

  it("the operator choice survives 详情→返回列表 with the paging stack", async () => {
    await mountProbed("/audit?window=7d");
    await choose("aud01-filter-operator", "employee:9f8e7d6c5b4a3f21");
    await waitFor(() => locationText().includes("actor="), "actor written");
    await act(async () => {
      (document.querySelector("[data-testid='aud01-load-more']") as HTMLButtonElement).click();
    });
    await waitFor(() => urls().some((u) => u.includes("cursor=cur_page2")), "second page asked");
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud01-row-evt_8d2e3f4051627384'] button")?.click();
    });
    await waitFor(() => locationText().includes("detail="), "detail opened");
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud8-back-to-list']")?.click();
    });
    await waitFor(() => !locationText().includes("detail="), "back on the list");
    expect(locationText()).toContain("actor=employee%3A9f8e7d6c5b4a3f21");
    expect(locationText()).toContain("cursor=cur_page2");
    expect(document.querySelector("[data-testid='aud2-page']")!.textContent).toContain("第 2 页");
    expect(document.querySelector<HTMLInputElement>("[data-testid='aud01-filter-operator']")!.value).toBe(
      "employee:9f8e7d6c5b4a3f21",
    );
  });

  it("every filter, the page and the deep link live in one address that replays cold", async () => {
    const entry =
      "/audit?window=custom" +
      "&from=2026-11-17T01%3A00%3A00.000Z&to=2026-11-17T02%3A30%3A00.000Z" +
      "&type=task.created&actor=employee-api&resource=ap_1122334455667788" +
      "&cursor=cur_page1&cursor=cur_page2&event=evt_7c1f2a3b4d5e6f70";
    await mount(async (url) =>
      String(url).startsWith("/agent-api/api/audit-detail") ? DETAIL : { items: EVENTS.items, total: 137 },
    );
    await render(entry, <>
      <AuditEventsModulePage />
      <LocationProbe />
    </>);
    await waitFor(() => !skeleton(), "cold replay settled");
    const asked = lastUrl();
    expect(asked).toContain("action=task.created");
    expect(asked).toContain("from=2026-11-17T01");
    expect(asked).toContain("actorId=employee-api");
    expect(asked).toContain("resourceId=ap_1122334455667788");
    expect(asked).toContain("cursor=cur_page2");
    expect(document.querySelector<HTMLInputElement>("[data-testid='aud01-filter-window']")!.value).toBe("custom");
    expect(document.querySelector<HTMLInputElement>("[data-testid='aud01-filter-type']")!.value).toBe("task.created");
    expect(document.querySelector<HTMLInputElement>("[data-testid='aud01-filter-operator']")!.value).toBe("employee-api");
    expect(document.querySelector<HTMLInputElement>("[data-testid='aud8-filter-resource']")!.value).toBe("ap_1122334455667788");
    expect(document.querySelector("[data-testid='aud2-page']")!.textContent).toContain("第 3 页");
    expect(document.querySelector("[data-testid='aud2-total']")!.textContent).toBe("共 137 条");
    // the deep link opened that row's preview on the cold load
    expect(document.querySelector("[data-testid='aud6-preview-evt_7c1f2a3b4d5e6f70']")).not.toBeNull();
    expect(document.querySelector("[data-testid='aud9-deeplink-found']")).not.toBeNull();
    expect(document.querySelector("[data-testid='aud9-scope-note']")!.textContent).toContain("本地匹配");
  });

  it("a resource choice matches locally, says so, and asks exactly once", async () => {
    await mountProbed("/audit?window=7d");
    const before = listReads().length;
    await act(async () => {
      const node = document.querySelector<HTMLSelectElement>("[data-testid='aud8-filter-resource']")!;
      node.value = "ap_1122334455667788";
      node.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await waitFor(() => locationText().includes("resource="), "resource written to the address");
    expect(listReads().length).toBe(before + 1);
    expect(document.querySelectorAll("[data-testid^='aud01-row-']")).toHaveLength(1);
    expect(document.querySelector("[data-testid='aud5-export-count']")!.textContent).toBe("将导出 1 条");
    const note = document.querySelector("[data-testid='aud9-scope-note']")!.textContent ?? "";
    expect(note).toContain("本地匹配");
    expect(note).toContain("2 条");
    expect(note).toContain("1 条");
    // the handle stays off the surface itself (the probe prints the address,
    // so the assertion is scoped to the page, not to the whole document)
    expect(document.querySelector("[data-testid='agent-v2-page-audit']")!.textContent).not.toContain("ap_1122334455667788");
  });

  it("a resource nothing on this page matches says so, and does not blame the service", async () => {
    await mountProbed("/audit?window=7d&resource=no_such_thing_at_all");
    await waitFor(() => !skeleton(), "settled");
    const empty = document.querySelector("[data-testid='aud9-local-empty']");
    expect(empty).not.toBeNull();
    expect(empty!.textContent).toContain("本地匹配");
    expect(document.querySelectorAll("[data-testid^='aud01-row-']")).toHaveLength(0);
    // the ledger itself is not called empty: the service did answer two rows
    expect(document.querySelector("[data-testid='aud01-empty']")).toBeNull();
    expect(document.querySelector("[data-testid='aud9-scope-note']")!.textContent).toContain("筛出 0 条");
  });

  it("switching window, type, operator or page asks exactly once each", async () => {
    await mountProbed("/audit?window=7d");
    expect(await readsAfter(() => choose("aud01-filter-window", "30d"))).toBe(1);
    expect(await readsAfter(() => choose("aud01-filter-type", "task.created"))).toBe(1);
    expect(await readsAfter(() => choose("aud01-filter-operator", "user:2f3a4b5c6d7e8f90"))).toBe(1);
    expect(await readsAfter(() => (document.querySelector("[data-testid='aud01-load-more']") as HTMLButtonElement).click())).toBe(1);
    expect(await readsAfter(() => (document.querySelector("[data-testid='aud2-prev'] button") as HTMLButtonElement).click())).toBe(1);
  });

  it("opening a fold and closing the deep link ask nothing at all", async () => {
    await mountProbed("/audit?window=7d&event=evt_7c1f2a3b4d5e6f70");
    const before = listReads().length;
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud9-deeplink-close']")?.click();
    });
    expect(listReads().length).toBe(before);
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud6-toggle-evt_8d2e3f4051627384']")?.click();
    });
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud01-cell-evt_8d2e3f4051627384-details']")?.click();
    });
    expect(listReads().length).toBe(before);
    // and no existence check was ever needed: the row is right here
    expect(urls().filter((u) => u.startsWith("/agent-api/api/audit-detail"))).toHaveLength(0);
  });

  it("?event= on a row of this page locates and opens it, and closing keeps the filters and page", async () => {
    await mountProbed("/audit?window=24h&type=task.created&cursor=cur_page2&event=evt_8d2e3f4051627384");
    expect(document.querySelector("[data-testid='aud9-deeplink-found']")).not.toBeNull();
    expect(document.querySelector("[data-testid='aud6-preview-evt_8d2e3f4051627384']")).not.toBeNull();
    expect(document.querySelector("[data-testid='aud01-row-evt_8d2e3f4051627384']")).not.toBeNull();
    expect(document.querySelector("[data-testid='aud2-page']")!.textContent).toContain("第 2 页");
    expect(document.querySelector("[data-aud9-deeplink='true']")).not.toBeNull();
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud9-deeplink-close']")?.click();
    });
    expect(locationText()).not.toContain("event=");
    expect(locationText()).not.toContain("preview=");
    expect(locationText()).toContain("window=24h");
    expect(locationText()).toContain("type=task.created");
    expect(locationText()).toContain("cursor=cur_page2");
    expect(document.querySelector("[data-testid='aud6-preview-evt_8d2e3f4051627384']")).toBeNull();
    expect(document.querySelector("[data-testid='aud2-page']")!.textContent).toContain("第 2 页");
  });

  it("?event= the service cannot answer reads 该事件不存在或已过期 with its own copyable rid", async () => {
    const once = async (status: number): Promise<string> => {
      api.fetchJSON.mockReset();
      api.fetchJSON.mockImplementation(async (url: string) => {
        if (String(url).startsWith("/agent-api/api/audit-detail")) {
          throw new ApiError("gone", { status, body: '{"code":"console.unknown_event"}', url, requestId: "req-gone-01" });
        }
        return EVENTS;
      });
      await render("/audit?window=7d&event=evt_0000000000000000", <AuditEventsModulePage />);
      await waitFor(() => document.querySelector("[data-testid='aud9-event-missing']") !== null, `missing ${status}`);
      return document.querySelector("[data-testid='aud9-event-missing']")!.outerHTML;
    };
    const notFound = await once(404);
    expect(notFound).toContain("该事件不存在或已过期");
    expect(notFound).not.toContain("console.unknown_event");
    expect(document.querySelector("[data-testid='aud9-event-rid']")!.textContent).toContain("req-gone-01");
    expect(document.querySelector("[data-testid='aud9-event-rid-value']")).not.toBeNull();
    expect(urls().filter((u) => u.startsWith("/agent-api/api/audit-detail")).length).toBe(1);
    // 403 answers with the very same body: one sentence, one rid control
    expect(await once(403)).toBe(notFound);
  });

  it("a deep link that fails as a plain error is not called 不存在", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url: string) => {
      if (String(url).startsWith("/agent-api/api/audit-detail")) {
        throw new ApiError("boom", { status: 500, body: "{}", url, requestId: "req-500" });
      }
      return EVENTS;
    });
    await render("/audit?window=7d&event=evt_0000000000000000", <AuditEventsModulePage />);
    await waitFor(() => document.querySelector("[data-testid='aud9-event-error']") !== null, "error leg");
    expect(text()).not.toContain("该事件不存在或已过期");
  });
});

/**
 * audA — 预览与详情的字段一致性，与行内预览的键盘闭环。
 * 同一条事件同时挂在两处（?preview= 展开行内预览，?detail= 打开右侧详情），
 * 逐字段比对两处上屏的值：值不同就是红线，只有格式化差异与「详情多出来的
 * 集合」可以说明理由。键盘腿断 Enter 展开、Esc 收起并把焦点送回该行的控件、
 * 预览里的「打开详情」是可达且焦点可见的真链、aria-expanded 与实际展开同步。
 */
describe("audA - preview/detail field parity and the keyboard loop", () => {
  // One event, served to both reads, so the two legs can only differ if the
  // page itself says two different things about it.
  const EVENT = {
    eventId: "evt_parity_00000001",
    action: "task.created",
    occurredAt: "2026-11-19T01:20:00Z",
    recordedAt: "2026-11-19T01:20:01Z",
    outcome: "succeeded",
    actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" },
    resource: { type: "approval", id: "ap_1122334455667788" },
    requestId: "req-20261119-0a7b3c",
  };

  async function mountProbed(entry: string): Promise<void> {
    api.fetchJSON.mockReset();
    answer(EVENTS);
    await render(entry, <>
      <AuditEventsModulePage />
      <LocationProbe />
    </>);
    await waitFor(() => !skeleton(), "first page settled");
  }

  async function mountBoth(entry: string, body: unknown = EVENT): Promise<void> {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url: string) =>
      String(url).startsWith("/agent-api/api/audit-detail") ? { audit: body } : { items: [body] },
    );
    await render(entry, <>
      <AuditEventsModulePage />
      <LocationProbe />
    </>);
    await waitFor(() => document.querySelector("[data-testid='aud02-detail']") !== null, "detail painted");
    await waitFor(() => document.querySelector("[data-testid='aud6-preview-evt_parity_00000001']") !== null, "preview painted");
  }

  /** The value part of a preview line (the label sits in its own span). */
  function previewValue(field: string): string {
    const node = document.querySelector(`[data-testid='audA-preview-${field}']`)!;
    const label = node.querySelector("span")?.textContent ?? "";
    return (node.textContent ?? "").replace(label, "").trim();
  }

  /** The value part of a detail Field (its <dt> is the label, <dd> the value). */
  function detailValue(field: string): string {
    const node = document.querySelector(`[data-testid='audA-detail-${field}']`)!;
    return (node.querySelector("dd")?.textContent ?? node.textContent ?? "").trim();
  }

  it("the five shared fields read the same words in both legs", async () => {
    await mountBoth("/audit?window=7d&preview=evt_parity_00000001&detail=evt_parity_00000001");
    expect(previewValue("type")).toBe(detailValue("type"));
    expect(previewValue("actor")).toBe(detailValue("actor"));
    expect(previewValue("resource")).toBe(detailValue("resource"));
    // time: both legs speak Beijing seconds, off the same raw instant
    const previewTime = document.querySelector("[data-auda-parity='time']")!.textContent ?? "";
    expect(previewTime.replace("时间（北京时间）：", "").trim()).toBe(detailValue("time"));
    expect(previewTime).toContain("2026-11-19 09:20:00");
    expect(detailValue("time")).toContain("2026-11-19 09:20:00");
    // rid: the same copyable control, the same shown form, the same full value
    const ridPreview = document.querySelector("[data-testid='audA-preview-rid']")!;
    const ridDetail = document.querySelector("[data-auda-parity='rid'] [data-testid='aud02-detail-request-value']")!;
    expect(ridPreview.textContent).toBe(ridDetail.textContent);
    expect(ridPreview.querySelector("[title]")?.getAttribute("title")).toBe(
      ridDetail.querySelector("[title]")?.getAttribute("title"),
    );
    expect(previewValue("actor")).toContain("李思");
  });

  it("a field the service did not send reads the same missing sentence in both legs", async () => {
    const sparse = {
      eventId: "evt_parity_00000001",
      action: "task.created",
      outcome: "succeeded",
      actor: { type: "system", id: "employee-api" },
    };
    await mountBoth("/audit?window=7d&preview=evt_parity_00000001&detail=evt_parity_00000001", sparse);
    const previewTime = (document.querySelector("[data-auda-parity='time']")!.textContent ?? "").replace("时间（北京时间）：", "").trim();
    expect(previewTime).toBe(detailValue("time"));
    expect(previewTime).toBe("—");
    expect(document.querySelector("[data-auda-parity='time']")!.getAttribute("title")).toContain("服务未提供该时间");
    expect(document.querySelector("[data-testid='audA-preview-rid-absent']")).not.toBeNull();
    expect(document.querySelector("[data-testid='audA-preview-rid-absent']")!.textContent).toBe(
      document.querySelector("[data-auda-parity='rid'] [data-testid='aud02-detail-request-value-absent']")!.textContent,
    );
  });

  it("the detail carries the extra sections and says why they are not in the preview", async () => {
    await mountBoth("/audit?window=7d&preview=evt_parity_00000001&detail=evt_parity_00000001");
    // 集合差异是设计，不是不一致：详情有记账时间/工作区/完整性/原始载荷
    expect(document.querySelector("[data-testid='aud02-detail']")!.textContent).toContain("记账时间");
    expect(document.querySelector("[data-testid='aud02-detail']")!.textContent).toContain("所属工作区");
    expect(document.querySelector("[data-testid='aud6-preview-evt_parity_00000001']")!.textContent).not.toContain("记账时间");
  });

  it("Enter on the row opens the preview, aria-expanded follows, Esc closes and refocuses the row", async () => {
    await mountProbed("/audit?window=7d");
    const toggle = document.querySelector<HTMLButtonElement>("[data-testid='aud6-toggle-evt_7c1f2a3b4d5e6f70']")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await act(async () => {
      toggle.focus();
      toggle.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    });
    await waitFor(() => document.querySelector("[data-testid='aud6-preview-evt_7c1f2a3b4d5e6f70']") !== null, "Enter opened");
    expect(document.querySelector("[data-testid='aud6-preview-evt_7c1f2a3b4d5e6f70-open']")).not.toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(locationText()).toContain("preview=evt_7c1f2a3b4d5e6f70");
    // focus can land on the link inside the panel: it is a real anchor in tab order
    const link = document.querySelector<HTMLAnchorElement>("[data-testid='aud6-preview-evt_7c1f2a3b4d5e6f70-open']")!;
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toContain("detail=evt_7c1f2a3b4d5e6f70");
    expect(link.getAttribute("tabindex")).toBeNull();
    await act(async () => {
      link.focus();
    });
    expect(document.activeElement).toBe(link);
    // Esc anywhere inside the row closes the fold and hands focus back to the row handle
    await act(async () => {
      link.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    await waitFor(() => document.querySelector("[data-testid='aud6-preview-evt_7c1f2a3b4d5e6f70']") === null, "Esc closed");
    expect(document.activeElement).toBe(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(locationText()).not.toContain("preview=");
  });

  it("a refreshed preview keeps aria-expanded in sync with what is on screen", async () => {
    await mountProbed("/audit?window=7d&type=task.created&cursor=cur_page2&preview=evt_8d2e3f4051627384");
    expect(document.querySelector("[data-testid='aud6-preview-evt_8d2e3f4051627384']")).not.toBeNull();
    expect(document.querySelector("[data-testid='aud6-toggle-evt_8d2e3f4051627384']")!.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector("[data-testid='aud6-toggle-evt_7c1f2a3b4d5e6f70']")!.getAttribute("aria-expanded")).toBe("false");
    const controls = document.querySelector("[data-testid='aud6-toggle-evt_8d2e3f4051627384']")!.getAttribute("aria-controls");
    expect(document.querySelector(`[data-testid='${controls}']`)).not.toBeNull();
  });

  it("the row cell, the preview and the detail are the same instant at two precisions", async () => {
    await mountBoth("/audit?window=7d&preview=evt_parity_00000001&detail=evt_parity_00000001");
    const cell = document.querySelector("[data-testid='aud01-cell-evt_parity_00000001-time']")!.textContent ?? "";
    const preview = (document.querySelector("[data-auda-parity='time']")!.textContent ?? "").replace("时间（北京时间）：", "").trim();
    const detail = detailValue("time");
    // 列表行到分、预览与详情到秒：同一个瞬间的两种精度，秒值必须以分值开头
    const toMin = (value: string): string => value.slice(0, 16);
    expect(toMin(preview)).toBe(toMin(detail));
    expect(cell).toContain(toMin(preview));
    expect(cell).toContain("时间（北京时间）");
  });

  it("the preview keeps a keyboard path to its own controls", async () => {
    await mountProbed("/audit?window=7d");
    const toggle = document.querySelector<HTMLButtonElement>("[data-testid='aud6-toggle-evt_7c1f2a3b4d5e6f70']")!;
    await act(async () => {
      toggle.click();
    });
    const panel = document.querySelector<HTMLElement>("[data-testid='aud6-preview-evt_7c1f2a3b4d5e6f70']")!;
    const link = panel.querySelector<HTMLAnchorElement>("[data-testid='aud6-preview-evt_7c1f2a3b4d5e6f70-open']")!;
    const copy = panel.querySelector<HTMLButtonElement>("[data-testid='audA-preview-rid'] button")!;
    // focusable, unfaked: real href, no tabindex trap, a visible focus ring
    expect(link.getAttribute("href")).toContain("detail=evt_7c1f2a3b4d5e6f70");
    expect(link.getAttribute("tabindex")).toBeNull();
    expect(link.className).toContain("focus-visible:outline");
    expect(copy.getAttribute("aria-label")).toBe("复制请求编号");
    // tab order inside the row: the handle comes first, then the panel's own
    // controls, so one Tab from the handle walks into what it just opened
    const row = toggle.closest("[data-testid='audA-row-shell-evt_7c1f2a3b4d5e6f70']")!;
    const focusables = [...row.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
    expect(focusables[0]).toBe(toggle);
    expect(focusables).toContain(copy);
    expect(focusables).toContain(link);
    expect(focusables.indexOf(toggle)).toBeLessThan(focusables.indexOf(copy));
    expect(focusables.indexOf(copy)).toBeLessThan(focusables.indexOf(link));
    await act(async () => {
      copy.focus();
    });
    expect(document.activeElement).toBe(copy);
    await act(async () => {
      link.focus();
    });
    expect(document.activeElement).toBe(link);
  });

  it("opening and closing a preview never moves the filters, the page or the address beyond its own key", async () => {
    await mountProbed("/audit?window=24h&type=task.created&actor=employee-api&cursor=cur_page1&cursor=cur_page2");
    const before = urls().filter((u) => /^\/agent-api\/api\/audit\?/.test(u)).length;
    const held = () => {
      const p = new URLSearchParams(locationText().split("?")[1] ?? "");
      return [p.get("window"), p.get("type"), p.get("actor"), p.getAll("cursor").join(",")];
    };
    const snapshot = held();
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud6-toggle-evt_7c1f2a3b4d5e6f70']")?.click();
    });
    expect(held()).toEqual(snapshot);
    expect(locationText()).toContain("preview=evt_7c1f2a3b4d5e6f70");
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud6-toggle-evt_7c1f2a3b4d5e6f70']")?.click();
    });
    expect(held()).toEqual(snapshot);
    expect(locationText()).not.toContain("preview=");
    expect(urls().filter((u) => /^\/agent-api\/api\/audit\?/.test(u)).length).toBe(before);
    expect(document.querySelector("[data-testid='aud2-page']")!.textContent).toContain("第 3 页");
  });
});
