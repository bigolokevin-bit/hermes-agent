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

/**
 * Choose a filter value the way a person does: a select gets its change event,
 * a pressed-state group (audB: the quick windows) gets a click on its button.
 */
async function choose(testId: string, value: string): Promise<void> {
  const node = document.querySelector<HTMLElement>(`[data-testid='${testId}']`);
  if (node && node.tagName === "SELECT") {
    const select = node as HTMLSelectElement;
    await act(async () => {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    return;
  }
  const button = document.querySelector<HTMLButtonElement>(`[data-testid='${testId}-${value}']`);
  if (!button) throw new Error(`control ${testId} / ${testId}-${value} not found`);
  await act(async () => {
    button.click();
  });
}

/** Which quick window is pressed (audB: aria-pressed is the on-screen state). */
const pressedWindow = (): string | null => {
  for (const key of ["24h", "7d", "30d", "custom"]) {
    const node = document.querySelector<HTMLButtonElement>(`[data-testid='aud01-filter-window-${key}']`);
    if (node?.getAttribute("aria-pressed") === "true") return key;
  }
  return null;
};

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
    // audB: the four quick windows are pressed-state buttons, in the same order
    // the select used to list them, and none of them is 不限时间.
    const choices = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-testid^='aud01-filter-window-']"));
    expect(choices.map((node) => node.getAttribute("data-testid")?.replace("aud01-filter-window-", ""))).toEqual([
      "24h",
      "7d",
      "30d",
      "custom",
    ]);
    expect(choices.every((node) => node.hasAttribute("aria-pressed"))).toBe(true);
    expect(pressedWindow()).toBe("30d");
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

  it("turning the two inputs into a valid range asks for it once 应用 is pressed (audB)", async () => {
    await mount(undefined, "/system?tab=events&window=custom");
    expect(urls()).toHaveLength(0);
    await typeInto("aud01-custom-from", "2026-11-17T09:00");
    await typeInto("aud01-custom-to", "2026-11-17T10:30");
    // audB contract: typing is a draft. Nothing is asked until 应用.
    expect(urls()).toHaveLength(0);
    expect(document.querySelector("[data-testid='audB-range-error']")).toBeNull();
    const apply = document.querySelector<HTMLButtonElement>("[data-testid='audB-apply']")!;
    expect(apply.getAttribute("aria-disabled")).toBe("false");
    await act(async () => {
      apply.click();
    });
    await waitFor(() => urls().length > 0 && spanOf(lastUrl()) === 90 * 60 * 1000, "custom range read");
    const decoded = decodeURIComponent(lastUrl());
    expect(decoded).toContain("from=2026-11-17T01:00:00.000Z");
    expect(decoded).toContain("to=2026-11-17T02:30:00.000Z");
    expect(urls()).toHaveLength(1);
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
    expect(pressedWindow()).toBe("24h");
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
    expect(pressedWindow()).toBe("custom");
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

/**
 * audB — 自定义起止时间。口径：打字是草稿，应用才是一次读取；起>止 不发请求并给
 * 人话校验错；快捷档与自定义互斥高亮（aria-pressed）；from/to 与 类型/actor/资源/
 * cursor 栈 全落 URL、冷挂载可复现；空区间回答「该时间段内无事件」并给清空出口。
 */
describe("audB - custom time range", () => {
  async function mountProbed(entry: string): Promise<void> {
    api.fetchJSON.mockReset();
    answer(EVENTS);
    await render(entry, <>
      <AuditEventsModulePage />
      <LocationProbe />
    </>);
    await waitFor(() => !skeleton(), "first page settled");
  }

  const listReads = (): number => urls().filter((u) => /^\/agent-api\/api\/audit\?/.test(u)).length;

  const pressed = (key: string): string | null =>
    document.querySelector(`[data-testid='aud01-filter-window-${key}']`)?.getAttribute("aria-pressed") ?? null;

  async function apply(): Promise<void> {
    const node = document.querySelector<HTMLButtonElement>("[data-testid='audB-apply']")!;
    await act(async () => {
      node.click();
    });
  }

  it("typing asks nothing, applying asks exactly once, re-applying asks once more", async () => {
    await mountProbed("/audit?window=7d");
    const start = listReads();
    await choose("aud01-filter-window", "custom");
    await waitFor(() => pressed("custom") === "true", "custom pressed");
    expect(listReads()).toBe(start); // an empty range is not a question
    await typeInto("aud01-custom-from", "2026-11-17T09:00");
    await typeInto("aud01-custom-to", "2026-11-17T10:30");
    expect(listReads()).toBe(start);
    await apply();
    await waitFor(() => listReads() === start + 1, "one read for the applied range");
    expect(listReads()).toBe(start + 1);
    expect(locationText()).toContain("window=custom");
    expect(locationText()).toContain("from=2026-11-17T01%3A00%3A00.000Z");
    expect(locationText()).toContain("to=2026-11-17T02%3A30%3A00.000Z");
    // a second, different range is a second question — still one read each
    await typeInto("aud01-custom-to", "2026-11-17T11:30");
    expect(listReads()).toBe(start + 1);
    await apply();
    await waitFor(() => listReads() === start + 2, "second applied range asked once");
    expect(listReads()).toBe(start + 2);
    expect(spanOf(lastUrl())).toBe(150 * 60 * 1000);
  });

  it("an inverted range says why in words and never reaches the service", async () => {
    await mountProbed("/audit?window=custom&from=2026-11-17T01%3A00%3A00.000Z&to=2026-11-17T02%3A30%3A00.000Z");
    const before = listReads();
    await typeInto("aud01-custom-from", "2026-11-17T14:00");
    await typeInto("aud01-custom-to", "2026-11-17T08:00");
    const note = document.querySelector("[data-testid='audB-range-error']");
    expect(note).not.toBeNull();
    expect(note!.textContent).toContain("开始时间不能晚于结束时间");
    expect(document.querySelector<HTMLButtonElement>("[data-testid='audB-apply']")!.getAttribute("aria-disabled")).toBe("true");
    await apply();
    expect(listReads()).toBe(before);
    // the applied range on the wire is still the valid pair from the address
    expect(decodeURIComponent(lastUrl())).toContain("to=2026-11-17T02:30:00.000Z");
    expect(listReads()).toBe(before);
  });

  it("choosing a quick window un-presses 自定义 and drops the draft range", async () => {
    await mountProbed("/audit?window=custom&from=2026-11-17T01%3A00%3A00.000Z&to=2026-11-17T02%3A30%3A00.000Z");
    expect(pressed("custom")).toBe("true");
    expect(pressed("7d")).toBe("false");
    await choose("aud01-filter-window", "30d");
    await waitFor(() => pressed("30d") === "true", "30d pressed");
    expect(pressed("custom")).toBe("false");
    expect(pressed("7d")).toBe("false");
    expect(pressed("24h")).toBe("false");
    expect(locationText()).not.toContain("from=");
    expect(locationText()).not.toContain("to=");
    expect(document.querySelector("[data-testid='audB-scope-note']")).toBeNull();
    expect(spanOf(lastUrl())).toBe(30 * 24 * 3_600_000);
  });

  it("the custom range combines with type, actor, resource and paging in one replayable address", async () => {
    const entry =
      "/audit?window=custom" +
      "&from=2026-11-17T01%3A00%3A00.000Z&to=2026-11-17T02%3A30%3A00.000Z" +
      "&type=task.created&actor=employee-api&resource=ap_1122334455667788" +
      "&cursor=cur_page1&cursor=cur_page2&preview=evt_7c1f2a3b4d5e6f70";
    await mountProbed(entry);
    const asked = decodeURIComponent(lastUrl());
    expect(asked).toContain("from=2026-11-17T01:00:00.000Z");
    expect(asked).toContain("to=2026-11-17T02:30:00.000Z");
    expect(asked).toContain("action=task.created");
    expect(asked).toContain("actorId=employee-api");
    expect(asked).toContain("resourceId=ap_1122334455667788");
    expect(asked).toContain("cursor=cur_page2");
    expect(pressed("custom")).toBe("true");
    expect(document.querySelector<HTMLInputElement>("[data-testid='aud01-custom-from']")!.value).toBe("2026-11-17T09:00");
    expect(document.querySelector<HTMLInputElement>("[data-testid='aud01-custom-to']")!.value).toBe("2026-11-17T10:30");
    expect(document.querySelector<HTMLInputElement>("[data-testid='aud01-filter-type']")!.value).toBe("task.created");
    expect(document.querySelector<HTMLInputElement>("[data-testid='aud01-filter-operator']")!.value).toBe("employee-api");
    expect(document.querySelector("[data-testid='aud2-page']")!.textContent).toContain("第 3 页");
    expect(document.querySelector("[data-testid='aud6-preview-evt_7c1f2a3b4d5e6f70']")).not.toBeNull();
    expect(document.querySelector("[data-testid='audB-scope-note']")!.textContent).toContain("服务端");
    expect(document.querySelector("[data-testid='aud8-state-line']")!.textContent).toContain("自定义");
    // the inputs are still a draft: no further read was asked on this cold load
    expect(listReads()).toBe(1);
  });

  it("an empty custom range answers 该时间段内无事件 and 清空 gets back to the quick window", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async () => ({ items: [], nextCursor: null }));
    await render(
      "/audit?window=custom&from=2026-11-01T01%3A00%3A00.000Z&to=2026-11-01T02%3A00%3A00.000Z",
      <>
        <AuditEventsModulePage />
        <LocationProbe />
      </>,
    );
    await waitFor(() => document.querySelector("[data-testid='aud01-empty']") !== null, "empty answer");
    expect(text()).toContain("该时间段内无事件");
    expect(document.querySelector("[data-testid='audB-empty-clear']")).not.toBeNull();
    const before = listReads();
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='audB-empty-clear']")?.click();
    });
    await waitFor(() => listReads() === before + 1, "one read after clearing");
    expect(locationText()).toContain("window=7d");
    expect(locationText()).not.toContain("from=");
    expect(pressed("7d")).toBe("true");
    expect(pressed("custom")).toBe("false");
  });

  it("the range says what it filters, and never passes itself off as a page-local pick", async () => {
    await mountProbed("/audit?window=custom&from=2026-11-17T01%3A00%3A00.000Z&to=2026-11-17T02%3A30%3A00.000Z");
    const note = document.querySelector("[data-testid='audB-scope-note']")!.textContent ?? "";
    expect(note).toContain("服务端按起止时间过滤");
    expect(note).toContain("不是只在这页已加载的行里挑");
    expect(note).toContain("北京时间");
    // 总数仍走服务端 total：这份回答没带回 total
    expect(document.querySelector("[data-testid='aud2-total']")!.textContent).toBe("总数不可用");
    expect(document.querySelector("[data-testid='aud2-total']")!.getAttribute("title")).toContain("游标分页不能自算总数");
  });
});

/**
 * audC — 事件摘要复制。断言的是：预览与详情两处都有「复制结论行」，同一事件
 * 两处复制出的一模一样；复制不向服务发任何请求；成功走 aria-live「已复制」，
 * 剪贴板拒绝时给只读 textarea 兜底；缺字段在结论行里写「该字段未返回」。
 */
describe("audC - the copyable conclusion line", () => {
  const PARITY_EVENT = {
    eventId: "evt_copy_0000000001",
    action: "task.created",
    occurredAt: "2026-11-19T01:20:00Z",
    recordedAt: "2026-11-19T01:20:01Z",
    outcome: "succeeded",
    actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" },
    resource: { type: "approval", id: "ap_1122334455667788" },
    requestId: "req-20261119-0a7b3c",
  };

  /**
   * jsdom gives a clipboard only if we say the context is secure. Both legs of
   * the probe go through the real path the page takes: 已复制 when writeText
   * answers, and the read-only textarea when it refuses (jsdom has no
   * execCommand either, so the fallback is what a person actually gets).
   */
  function stubClipboard(ok: boolean): { calls: string[] } {
    const box: { calls: string[] } = { calls: [] };
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          box.calls.push(text);
          if (!ok) throw new Error("denied");
        },
      },
    });
    return box;
  }

  async function mountParity(body: unknown = PARITY_EVENT): Promise<void> {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url: string) =>
      String(url).startsWith("/agent-api/api/audit-detail") ? { audit: body } : { items: [body] },
    );
    await render("/audit?window=7d&preview=evt_copy_0000000001&detail=evt_copy_0000000001", <AuditEventsModulePage />);
    await waitFor(() => document.querySelector("[data-testid='aud02-detail']") !== null, "detail painted");
    await waitFor(() => document.querySelector("[data-testid='aud6-preview-evt_copy_0000000001']") !== null, "preview painted");
  }

  const clickCopy = async (root: Element): Promise<void> => {
    const node = root.querySelector<HTMLButtonElement>("[data-testid='audC-copy']")!;
    await act(async () => {
      node.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  };

  it("both legs offer 复制结论行, and one event copies one identical sentence", async () => {
    const clip = stubClipboard(true);
    await mountParity();
    const preview = document.querySelector("[data-testid='aud6-preview-evt_copy_0000000001']")!;
    const detail = document.querySelector("[data-testid='aud02-detail']")!;
    expect(preview.querySelector("[data-testid='audC-copy']")).not.toBeNull();
    expect(detail.querySelector("[data-testid='audC-copy']")).not.toBeNull();
    const reads = urls().length;
    await clickCopy(preview);
    await clickCopy(detail);
    expect(clip.calls).toHaveLength(2);
    expect(clip.calls[0]).toBe(clip.calls[1]);
    // 时间 BJT 到秒 · 操作者 · 动作 · 资源 · rid
    expect(clip.calls[0]).toBe("2026-11-19 09:20:00 · 李思 · 6d7e8f90 · 创建任务 · 审批单 · 55667788 · req-20261119-0a7b3c");
    expect(clip.calls[0]).not.toMatch(/undefined|null|NaN/);
    // copying is a read of the screen: no second question to the service
    expect(urls()).toHaveLength(reads);
  });

  it("a successful copy is announced, not silently done", async () => {
    stubClipboard(true);
    await mountParity();
    const preview = document.querySelector("[data-testid='aud6-preview-evt_copy_0000000001']")!;
    expect(preview.querySelector("[data-testid='audC-copy-status']")!.getAttribute("aria-live")).toBe("polite");
    expect(preview.querySelector("[data-testid='audC-copy-status']")!.textContent).toBe("");
    await clickCopy(preview);
    expect(preview.querySelector("[data-testid='audC-copy-status']")!.textContent).toBe("已复制");
    expect(preview.querySelector("[data-testid='audC-fallback']")).toBeNull();
  });

  it("a refused clipboard hands back a read-only line, with the same words", async () => {
    const clip = stubClipboard(false);
    await mountParity();
    const detail = document.querySelector("[data-testid='aud02-detail']")!;
    await clickCopy(detail);
    const box = detail.querySelector<HTMLTextAreaElement>("[data-testid='audC-fallback']")!;
    expect(box.getAttribute("readonly")).not.toBeNull();
    expect(box.value).toBe(clip.calls[0]);
    expect(box.value).toContain("req-20261119-0a7b3c");
    expect(detail.querySelector("[data-testid='audC-copy-status']")!.textContent).toContain("选中复制");
  });

  it("fields the service did not send read 该字段未返回 in the copied line", async () => {
    const clip = stubClipboard(true);
    await mountParity({
      eventId: "evt_copy_0000000001",
      action: "dispatch.event",
      outcome: "succeeded",
      actor: { type: "system", id: "employee-api" },
    });
    const preview = document.querySelector("[data-testid='aud6-preview-evt_copy_0000000001']")!;
    await clickCopy(preview);
    expect(clip.calls[0]).toContain("该字段未返回");
    expect(clip.calls[0].endsWith("· 该字段未返回")).toBe(true);
    expect(clip.calls[0]).not.toMatch(/· ·|— · $/);
    const detail = document.querySelector("[data-testid='aud02-detail']")!;
    await clickCopy(detail);
    expect(clip.calls[1]).toBe(clip.calls[0]);
  });

  it("the three field tiers all copy a line that says what is absent", async () => {
    const clip = stubClipboard(true);
    // ① 有 rid：完整一行
    await mountParity();
    const preview = document.querySelector("[data-testid='aud6-preview-evt_copy_0000000001']")!;
    await clickCopy(preview);
    const full = clip.calls[0];
    expect(full).toContain("req-20261119-0a7b3c");
    expect(full).not.toContain("该字段未返回");
    // ② 无 rid：rid 那一格写「该字段未返回」
    await mountParity({ ...PARITY_EVENT, requestId: undefined });
    await clickCopy(document.querySelector("[data-testid='aud6-preview-evt_copy_0000000001']")!);
    expect(clip.calls[1].endsWith("· 该字段未返回")).toBe(true);
    expect(clip.calls[1].startsWith(full.slice(0, full.lastIndexOf(" · ")+3))).toBe(true);
    // ③ 时间缺：第一格写「该字段未返回」，其余照旧
    await mountParity({ ...PARITY_EVENT, occurredAt: undefined });
    await clickCopy(document.querySelector("[data-testid='aud6-preview-evt_copy_0000000001']")!);
    expect(clip.calls[2].startsWith("该字段未返回 · ")).toBe(true);
    expect(clip.calls[2]).toContain("req-20261119-0a7b3c");
    // and the detail leg says the same thing for the same sparse answer
    await clickCopy(document.querySelector("[data-testid='aud02-detail']")!);
    expect(clip.calls[3]).toBe(clip.calls[2]);
  });

  it("a copy needs no open detail and no open preview beyond its own leg", async () => {
    const clip = stubClipboard(true);
    await mountParity();
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud02-detail-close']")?.click();
    });
    const preview = document.querySelector("[data-testid='aud6-preview-evt_copy_0000000001']")!;
    await clickCopy(preview);
    expect(clip.calls).toHaveLength(1);
    expect(clip.calls[0]).toContain("2026-11-19 09:20:00");
    expect(document.querySelector("[data-testid='aud02-detail']")).toBeNull();
  });
});

/**
 * audD — 类型分布桶即筛选。断言的是：桶是真按钮（aria-pressed、键盘可触发、
 * 焦点可见），点击写入地址的类型键并作为服务端的 action 发出、重取恰一次；
 * 桶的计数与点完后的列表条数同源；与时间窗/操作者/资源组合时其它参数保留、
 * 分页回到第 1 页；再点同一个桶回全量；该类型没记录时给「该条件下无事件」与
 * 清出口；三档（加载中/有记录/空记录）各自的桶态都对。
 */
describe("audD - the type buckets filter the ledger", () => {
  const ROW = (id: string, action: string, outcome = "succeeded") => ({
    eventId: id,
    action,
    occurredAt: "2026-11-19T01:20:00Z",
    outcome,
    actor: { type: "system", id: "employee-api" },
    resource: { type: "task", id: id.replace("evt_", "ts_") },
    requestId: "req-" + id,
  });
  const MIXED = {
    items: [
      ROW("evt_a1", "task.created"),
      ROW("evt_a2", "task.created"),
      ROW("evt_a3", "task.created"),
      ROW("evt_b1", "run.failed", "error"),
    ],
    nextCursor: "cur_page2",
  };

  /** A service that really filters: the count claim is only real against one. */
  function filterByAction(source: { items: unknown[]; nextCursor?: string | null }): (url: string) => Promise<unknown> {
    return async (url: string) => {
      const asked = new URLSearchParams(url.split("?")[1] ?? "");
      const action = asked.get("action");
      const items = action
        ? (source.items as { action: string }[]).filter((item) => item.action === action)
        : [...source.items];
      // a cursor is the second page: the same rows again, nothing more behind it
      return { items, nextCursor: asked.get("cursor") || asked.get("action") ? null : source.nextCursor ?? null };
    };
  }

  async function mountProbed(entry: string, handler?: (url: string) => Promise<unknown>): Promise<void> {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(handler ?? filterByAction(MIXED));
    await render(
      entry,
      <>
        <AuditEventsModulePage />
        <LocationProbe />
      </>,
    );
    await waitFor(() => !skeleton(), "first page settled");
  }

  const listReads = (): number => urls().filter((u) => /^\/agent-api\/api\/audit\?/.test(u)).length;
  const bucketCount = (code: string): number =>
    Number(
      document
        .querySelector(`[data-testid='audD-bucket-${code}']`)
        ?.closest("li")
        ?.querySelector("[data-testid='aud7-types-count']")?.textContent ?? "-1",
    );
  const rowCount = (): number => document.querySelectorAll("[data-testid^='aud01-row-evt_']").length;

  async function expand(): Promise<void> {
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud7-types-toggle']")?.click();
    });
    await waitFor(() => document.querySelector("[data-testid='aud7-types-panel']") !== null, "panel open");
  }

  async function pick(code: string): Promise<void> {
    await act(async () => {
      document.querySelector<HTMLButtonElement>(`[data-testid='audD-bucket-${code}']`)?.click();
    });
    await waitFor(() => locationText().includes("type="), "type written to the address");
  }

  it("a bucket is a real pressed button that says how to use it", async () => {
    await mountProbed("/audit?window=7d");
    await expand();
    const node = document.querySelector<HTMLButtonElement>("[data-testid='audD-bucket-task.created']")!;
    expect(node.tagName).toBe("BUTTON");
    expect(node.getAttribute("aria-pressed")).toBe("false");
    expect(node.className).toContain("focus-visible:outline");
    expect(document.querySelector("[data-testid='audD-filter-hint']")!.textContent).toContain("再点一次回到全部类型");
    expect(bucketCount("task.created")).toBe(3);
    // the hint sits with the panel, so a closed fold never hides the contract
    expect(document.querySelector("[data-testid='aud7-types-toggle']")!.getAttribute("aria-expanded")).toBe("true");
  });

  it("picking a bucket filters for exactly one read and the count was the truth", async () => {
    await mountProbed("/audit?window=7d");
    await expand();
    const counted = bucketCount("task.created");
    const before = listReads();
    await pick("task.created");
    expect(listReads()).toBe(before + 1);
    expect(locationText()).toContain("type=task.created");
    expect(lastUrl()).toContain("action=task.created");
    expect(rowCount()).toBe(counted);
    expect(document.querySelector<HTMLButtonElement>("[data-testid='audD-bucket-task.created']")!.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector("[data-testid='aud01-status']")!.textContent).toContain("已显示 3 条");
    // the distribution is counted from the loaded rows, so the type that is no
    // longer on screen has no bucket any more — and the pressed one is the way
    // back out (asserted in the next case).
    expect(document.querySelectorAll("[data-testid^='audD-bucket-']")).toHaveLength(1);
    expect(bucketCount("task.created")).toBe(3);
  });

  it("picking the pressed bucket again goes back to every type, once", async () => {
    await mountProbed("/audit?window=7d&type=run.failed");
    await expand();
    expect(document.querySelector<HTMLButtonElement>("[data-testid='audD-bucket-run.failed']")!.getAttribute("aria-pressed")).toBe("true");
    const before = listReads();
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='audD-bucket-run.failed']")?.click();
    });
    await waitFor(() => !locationText().includes("type="), "type dropped from the address");
    expect(listReads()).toBe(before + 1);
    expect(lastUrl()).not.toContain("action=");
    expect(rowCount()).toBe(4);
  });

  it("Enter and Space on a bucket filter the same way a click does", async () => {
    await mountProbed("/audit?window=7d");
    await expand();
    const node = document.querySelector<HTMLButtonElement>("[data-testid='audD-bucket-task.created']")!;
    const before = listReads();
    await act(async () => {
      node.focus();
      node.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    });
    await waitFor(() => locationText().includes("type=task.created"), "Enter picked the bucket");
    expect(listReads()).toBe(before + 1);
    await waitFor(
      () => document.activeElement?.getAttribute("data-testid") === "audD-bucket-task.created",
      "focus comes back to the pressed bucket",
    );
  });

  it("Space picks without scrolling the page", async () => {
    await mountProbed("/audit?window=7d");
    await expand();
    const node = document.querySelector<HTMLButtonElement>("[data-testid='audD-bucket-run.failed']")!;
    const before = listReads();
    await act(async () => {
      node.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
    });
    await waitFor(() => locationText().includes("type=run.failed"), "Space picked the bucket");
    expect(listReads()).toBe(before + 1);
    await waitFor(
      () => document.activeElement?.getAttribute("data-testid") === "audD-bucket-run.failed",
      "Space leaves the focus on the bucket it pressed",
    );
  });

  it("a pick keeps the window, the operator and the resource, and starts the type on page 1", async () => {
    await mountProbed("/audit?window=24h&actor=employee-api&resource=ts_a1");
    await act(async () => {
      (document.querySelector("[data-testid='aud01-load-more']") as HTMLButtonElement).click();
    });
    await waitFor(() => locationText().includes("cursor="), "page 2 in the address");
    expect(document.querySelector("[data-testid='aud2-page']")!.textContent).toContain("第 2 页");
    // picking a type is a new question: the paging stack must not carry over
    const before = listReads();
    await expand();
    await pick("task.created");
    expect(listReads()).toBe(before + 1);
    const url = locationText();
    expect(url).toContain("window=24h");
    expect(url).toContain("actor=employee-api");
    expect(url).toContain("resource=ts_a1");
    expect(url).not.toContain("cursor=");
    expect(document.querySelector("[data-testid='aud2-page']")!.textContent).toContain("第 1 页");
    const asked = decodeURIComponent(lastUrl());
    expect(asked).toContain("from=");
    expect(asked).toContain("actorId=employee-api");
    expect(asked).toContain("resourceId=ts_a1");
    expect(asked).toContain("action=task.created");
  });

  it("a pasted or refreshed type address replays: bucket pressed, select filled, one read", async () => {
    await mountProbed("/audit?window=7d&type=task.created");
    expect(listReads()).toBe(1);
    expect(lastUrl()).toContain("action=task.created");
    expect(document.querySelector<HTMLInputElement>("[data-testid='aud01-filter-type']")!.value).toBe("task.created");
    // the fold is collapsed by default, so open it to see the pressed state
    await expand();
    expect(document.querySelector<HTMLButtonElement>("[data-testid='audD-bucket-task.created']")!.getAttribute("aria-pressed")).toBe("true");
    expect(rowCount()).toBe(3);
    expect(document.querySelector("[data-testid='aud8-state-line']")!.textContent).toContain("类型：task.created");
  });

  it("a type the sampled choices never carried still shows which filter is on", async () => {
    await mountProbed("/audit?window=7d&type=quantum.recalibration", async (url) => {
      if (String(url).includes("action=quantum.recalibration")) return { items: [ROW("evt_c1", "quantum.recalibration")], nextCursor: null };
      return { items: [], nextCursor: null };
    });
    expect(document.querySelector<HTMLInputElement>("[data-testid='aud01-filter-type']")!.value).toBe("quantum.recalibration");
    expect([...document.querySelectorAll<HTMLOptionElement>("[data-testid='aud01-filter-type'] option")].map((o) => o.text)).toContain(
      "按地址带入的类型",
    );
  });

  it("an empty answer for a picked type says 该条件下无事件 and clears back, once", async () => {
    // the ledger shows run.failed on the mixed page, but asking for that type
    // alone answers empty: the honest outcome is the empty leg with its exit
    await mountProbed("/audit?window=7d", async (url) => {
      const asked = new URLSearchParams(String(url).split("?")[1] ?? "");
      if (asked.get("action") === "run.failed") return { items: [], nextCursor: null };
      return { items: [...MIXED.items], nextCursor: null };
    });
    await expand();
    await pick("run.failed");
    await waitFor(() => document.querySelector("[data-testid='audD-empty-exit']") !== null, "the empty leg with its exit");
    expect(document.querySelector("[data-testid='aud01-empty']")).not.toBeNull();
    expect(text()).toContain("该条件下无事件");
    const before = listReads();
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='audD-empty-clear']")?.click();
    });
    await waitFor(() => !locationText().includes("type="), "type cleared");
    expect(listReads()).toBe(before + 1);
    expect(rowCount()).toBe(4);
    expect(document.querySelector("[data-testid='audD-empty-exit']")).toBeNull();
  });

  it("the three legs each get their own bucket state", async () => {
    // loading: no buckets to press yet
    let release: ((value: unknown) => void) | null = null;
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(
      () => new Promise((resolve) => { release = resolve; }),
    );
    await render("/audit?window=7d", <AuditEventsModulePage />);
    expect(document.querySelector("[data-testid='aud7-types']")).toBeNull();
    expect(document.querySelector("[data-testid^='audD-bucket-']")).toBeNull();
    await act(async () => {
      release?.({ items: MIXED.items, nextCursor: null });
    });
    await waitFor(() => !skeleton(), "ready");
    // ready: the section is there, collapsed, with nothing pressed
    expect(document.querySelector("[data-testid='aud7-types']")).not.toBeNull();
    expect(document.querySelector("[data-testid^='audD-bucket-']")).toBeNull();
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud7-types-toggle']")?.click();
    });
    const buckets = document.querySelectorAll("[data-testid^='audD-bucket-task'], [data-testid^='audD-bucket-run']");
    expect(buckets).toHaveLength(2);
    expect(document.querySelectorAll("[data-testid^='audD-bucket'][aria-pressed='true']")).toHaveLength(0);
    // denied: no rows above the panel, and no buckets either
    api.fetchJSON.mockReset();
    api.fetchJSON.mockRejectedValue(
      new ApiError("no", { status: 403, body: '{"code":"console.forbidden"}', url: "/agent-api/api/audit" }),
    );
    await render("/audit?window=7d", <AuditEventsModulePage />);
    await waitFor(() => document.querySelector("[data-testid='aud01-denied']") !== null, "denied");
    expect(document.querySelector("[data-testid^='audD-bucket-']")).toBeNull();
  });
});

/**
 * audE — 事件固定链接复制。两处（行内预览 aud6、记录体 aud3/aud02）各有一个
 * 「复制事件链接」；链接=当前页 origin + `/audit?event=<eventId>`（`?event=` 是
 * 本模块实测在读的深链键）；复制不向服务发任何请求；成功走 aria-live「链接已复制」，
 * 被拒给只读 textarea；行上没有可用标识时 disabled 并说明原因，不编造 id；
 * 粘这个链接能回到同一事件——回不到时走 aud9 的诚实档，不假称可达。
 */
describe("audE - the event permalink", () => {
  const LINKED = {
    eventId: "evt_link_0000000001",
    action: "task.created",
    occurredAt: "2026-11-19T01:20:00Z",
    outcome: "succeeded",
    actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" },
    resource: { type: "task", id: "ts_1122334455667788" },
    requestId: "req-link-01",
  };

  function stubClipboard(ok: boolean): { calls: string[] } {
    const box: { calls: string[] } = { calls: [] };
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          box.calls.push(text);
          if (!ok) throw new Error("denied");
        },
      },
    });
    return box;
  }

  async function mountBoth(entry: string, body: unknown = LINKED): Promise<void> {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url: string) =>
      String(url).startsWith("/agent-api/api/audit-detail") ? { audit: body } : { items: [body] },
    );
    await render(entry, <>
      <AuditEventsModulePage />
      <LocationProbe />
    </>);
    // whichever legs the address asks for: a preview-only link has no record pane
    await waitFor(
      () =>
        (!entry.includes("detail=") || document.querySelector("[data-testid='aud02-detail']") !== null) &&
        (!entry.includes("preview=") || document.querySelector("[data-testid='aud6-preview-evt_link_0000000001']") !== null),
      "the legs the address asks for",
    );
  }

  async function copyFrom(root: Element | null): Promise<void> {
    const node = root?.querySelector<HTMLButtonElement>("[data-testid='audE-link']");
    if (!node) throw new Error("no permalink control");
    await act(async () => {
      node.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }

  it("both legs offer the link and one event gives one identical address", async () => {
    const clip = stubClipboard(true);
    await mountBoth("/audit?window=7d&preview=evt_link_0000000001&detail=evt_link_0000000001");
    const preview = document.querySelector("[data-testid='aud6-preview-evt_link_0000000001']")!;
    const detail = document.querySelector("[data-testid='aud02-detail']")!;
    expect(preview.querySelector("[data-testid='audE-link']")).not.toBeNull();
    expect(detail.querySelector("[data-testid='audE-link']")).not.toBeNull();
    const reads = urls().length;
    await copyFrom(preview);
    await copyFrom(detail);
    expect(clip.calls).toHaveLength(2);
    expect(clip.calls[0]).toBe(clip.calls[1]);
    expect(clip.calls[0]).toBe(`${window.location.origin}/audit?event=evt_link_0000000001`);
    // 只读屏上已有标识：复制前后一条请求都没多
    expect(urls()).toHaveLength(reads);
  });

  it("a copied link is announced, and pasting it lands back on the same event", async () => {
    stubClipboard(true);
    await mountBoth("/audit?window=7d&preview=evt_link_0000000001&detail=evt_link_0000000001");
    const preview = document.querySelector("[data-testid='aud6-preview-evt_link_0000000001']")!;
    await copyFrom(preview);
    const status = preview.querySelector("[data-testid='audE-link-status']")!;
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("链接已复制");
    expect(preview.querySelector("[data-testid='audE-link-fallback']")).toBeNull();
    // the link as handed out, cold: /audit?event=<id> with no filter at all
    const cold = new URL(`${window.location.origin}/audit?event=evt_link_0000000001`);
    await render(`${cold.pathname}${cold.search}`, <AuditEventsModulePage />);
    await waitFor(() => document.querySelector("[data-testid='aud9-deeplink-found']") !== null, "the link located the event");
    expect(document.querySelector("[data-testid='aud6-preview-evt_link_0000000001']")).not.toBeNull();
    expect(document.querySelector("[data-testid='aud01-row-evt_link_0000000001']")).not.toBeNull();
  });

  it("a refused clipboard leaves the exact link selectable", async () => {
    const clip = stubClipboard(false);
    await mountBoth("/audit?window=7d&preview=evt_link_0000000001&detail=evt_link_0000000001");
    // the record body carries its own copy control, so the fallback shows there
    const detail = document.querySelector("[data-testid='audE-link-block']")!;
    const reads = urls().length;
    await copyFrom(detail);
    const box = detail.querySelector<HTMLTextAreaElement>("[data-testid='audE-link-fallback']")!;
    expect(box.getAttribute("readonly")).not.toBeNull();
    expect(box.value).toBe(clip.calls[0]);
    expect(box.value).toContain("/audit?event=evt_link_0000000001");
    expect(detail.querySelector("[data-testid='audE-link-status']")!.textContent).toContain("选中复制");
    expect(urls()).toHaveLength(reads);
  });

  it("a row with no identifier says so instead of inventing one", async () => {
    const clip = stubClipboard(true);
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async () => ({
      items: [{ action: "dispatch.event", occurredAt: "2026-11-19T03:00:00Z", outcome: "succeeded" }],
    }));
    await render("/audit?window=7d&preview=audit-0", <AuditEventsModulePage />);
    await waitFor(() => document.querySelector("[data-testid='aud6-preview-audit-0']") !== null, "preview of the id-less row");
    const node = document.querySelector<HTMLButtonElement>("[data-testid='audE-link']")!;
    expect(node.disabled).toBe(true);
    expect(node.getAttribute("aria-disabled")).toBe("true");
    expect(node.getAttribute("title")).toBe("该行没有可用的固定标识");
    await act(async () => {
      node.click();
    });
    expect(clip.calls).toHaveLength(0);
    expect(document.querySelector("[data-testid='audE-link-fallback']")).toBeNull();
    expect(document.querySelector("[data-testid='audE-link-status']")!.textContent).toBe("");
  });

  it("an event that is not on this page gets the honest leg, not a promise", async () => {
    // the list answers a different record; the detail read knows the linked one
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url) => {
      if (String(url).startsWith("/agent-api/api/audit-detail")) return { audit: LINKED };
      return { items: [{ ...LINKED, eventId: "evt_other_0000000002", requestId: "req-other" }] };
    });
    await render("/audit?window=7d&event=evt_link_0000000001", <AuditEventsModulePage />);
    await waitFor(() => document.querySelector("[data-testid='aud9-event-elsewhere']") !== null, "the elsewhere leg");
    expect(document.querySelector("[data-testid='aud9-event-open']")).not.toBeNull();
    expect(document.querySelector("[data-testid='aud6-preview-evt_link_0000000001']")).toBeNull();
    expect(text()).toContain("只是不在当前页");
  });

  it("an event the service cannot answer says 不存在或已过期", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url) => {
      if (String(url).startsWith("/agent-api/api/audit-detail")) {
        throw new ApiError("gone", { status: 404, body: '{"code":"audit.event_not_found"}', url, requestId: "req-gone-e" });
      }
      return { items: [{ ...LINKED, eventId: "evt_other_0000000002" }] };
    });
    await render("/audit?window=7d&event=evt_link_0000000001", <AuditEventsModulePage />);
    await waitFor(() => document.querySelector("[data-testid='aud9-event-missing']") !== null, "the missing leg");
    expect(text()).toContain("该事件不存在或已过期");
  });

  it("a denied ledger offers no link to copy", async () => {
    stubClipboard(true);
    api.fetchJSON.mockReset();
    api.fetchJSON.mockRejectedValue(
      new ApiError("no", { status: 403, body: '{"code":"console.forbidden"}', url: "/agent-api/api/audit", requestId: "rid-403" }),
    );
    await render("/audit?window=7d", <AuditEventsModulePage />);
    await waitFor(() => document.querySelector("[data-testid='aud01-denied']") !== null, "denied");
    expect(document.querySelector("[data-testid='audE-link']")).toBeNull();
    expect(text()).not.toContain("复制事件链接");
  });
});

/**
 * audF — 三处四态同一套话。断言的是：同一种失败在列表、行内预览、事件详情里
 * 说的是同一句原因（不是「一处加载失败、一处读取错误」），三处都带上可复制的
 * rid 与重试；重试只重发它自己那个读口、恰一次；被拒时筛选/页码/地址原样还在，
 * 恢复后回到原位；「该条件下无事件」与「读口未接入」是两句话，未接入不显 0。
 */
describe("audF - the four states say the same thing everywhere", () => {
  const listReads = (): number => urls().filter((u) => /^\/agent-api\/api\/audit\?/.test(u)).length;
  const detailReads = (): number => urls().filter((u) => u.startsWith("/agent-api/api/audit-detail")).length;
  const verifyReads = (): number => urls().filter((u) => u.startsWith("/agent-api/api/audit-verify")).length;
  const sentence = (testId: string): string =>
    document.querySelector(`[data-testid='${testId}-sentence']`)?.textContent?.trim() ?? "";
  const mark = (slot: string, phase: string): string | null =>
    document.querySelector(`[data-testid='audF-state-${slot}-${phase}']`)?.getAttribute("data-audf-label") ?? null;

  /** The retry button of one state panel, found by the word on it. */
  async function clickRetry(testId: string): Promise<void> {
    const panel = document.querySelector(`[data-testid='${testId}']`);
    const button = [...(panel?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((node) => {
      const words = node.textContent ?? "";
      return words.includes("重试") || words.includes("再读一次");
    });
    if (!button) throw new Error(`no retry button in ${testId}`);
    await act(async () => {
      button.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
  }

  const serviceDown = (url: string, rid: string): ApiError =>
    new ApiError("down", { status: 503, body: '{"code":"console.unavailable"}', url, requestId: rid });

  it("one failure, three surfaces, one sentence — each with its rid and its retry", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url) => {
      throw serviceDown(String(url), "rid-shared");
    });
    await render("/audit?window=7d", <>
      <AuditEventsModulePage />
      <LocationProbe />
    </>);
    await waitFor(() => document.querySelector("[data-testid='aud01-error']") !== null, "the list failed");
    const listLine = sentence("aud01-error");
    expect(listLine).toContain("审计服务在处理时出了错");
    expect(mark("list", "error")).toBe("读取没有完成");
    expect(document.querySelector("[data-testid='aud01-error-request-id']")!.textContent).toContain("rid-shared");

    // the same answer on the record read: the preview and the record pane
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url) => {
      if (String(url).startsWith("/agent-api/api/audit-detail")) throw serviceDown(String(url), "rid-shared");
      return EVENTS;
    });
    await render("/audit?window=7d&preview=evt_7c1f2a3b4d5e6f70&detail=evt_7c1f2a3b4d5e6f70", <AuditEventsModulePage />);
    await waitFor(() => document.querySelector("[data-testid='aud02-detail-error']") !== null, "the record failed");
    await waitFor(() => document.querySelector("[data-testid='audF-preview-error']") !== null, "the preview says so too");
    expect(sentence("aud02-detail-error")).toBe(listLine);
    expect(sentence("audF-preview-error")).toBe(listLine);
    expect(mark("detail", "error")).toBe("读取没有完成");
    expect(mark("preview", "error")).toBe("读取没有完成");
    // both record legs carry the copyable rid and a retry, in the same words
    for (const id of ["aud02-detail-error", "audF-preview-error"]) {
      expect(document.querySelector(`[data-testid='${id}-request-id-value']`)?.textContent).toContain("rid-shared");
    }
    expect(document.querySelectorAll("[data-testid='audF-preview-error'] button").length).toBeGreaterThan(0);
    expect(text()).toContain("重试");
  });

  it("each retry re-asks exactly its own read口, once", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url) => {
      if (String(url).startsWith("/agent-api/api/audit-detail")) throw serviceDown(String(url), "rid-d");
      return EVENTS;
    });
    await render("/audit?window=7d&preview=evt_7c1f2a3b4d5e6f70&detail=evt_7c1f2a3b4d5e6f70", <AuditEventsModulePage />);
    await waitFor(() => document.querySelector("[data-testid='audF-preview-error']") !== null, "preview failed");
    const lists = listReads();
    const details = detailReads();
    const verifies = verifyReads();
    // the preview's retry and the record pane's retry are the SAME read口
    await clickRetry("audF-preview-error");
    expect(detailReads()).toBe(details + 1);
    expect(listReads()).toBe(lists);
    expect(verifyReads()).toBe(verifies);
  });

  it("the list retry re-reads the ledger once and touches no other read口", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url) => {
      throw serviceDown(String(url), "rid-l");
    });
    await render("/audit?window=7d&type=task.created", <AuditEventsModulePage />);
    await waitFor(() => document.querySelector("[data-testid='aud01-error']") !== null, "list failed");
    const before = listReads();
    const details = detailReads();
    await clickRetry("aud01-error");
    expect(listReads()).toBe(before + 1);
    expect(detailReads()).toBe(details);
  });

  it("a denied ledger keeps the filters, the page and the address, and lands back where it was", async () => {
    const entry = "/audit?window=24h&type=task.created&actor=employee-api&cursor=cur_page2&preview=evt_7c1f2a3b4d5e6f70";
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url) => {
      throw new ApiError("closed", { status: 403, body: '{"code":"console.forbidden"}', url, requestId: "rid-403" });
    });
    await render(entry, <>
      <AuditEventsModulePage />
      <LocationProbe />
    </>);
    await waitFor(() => document.querySelector("[data-testid='aud01-denied']") !== null, "denied");
    expect(locationText()).toContain("window=24h");
    expect(locationText()).toContain("type=task.created");
    expect(locationText()).toContain("cursor=cur_page2");
    expect(locationText()).toContain("preview=evt_7c1f2a3b4d5e6f70");
    expect(document.querySelectorAll("[data-testid^='aud01-row-']")).toHaveLength(0);
    expect(mark("list", "denied")).toBe("暂时无法查看审计事件");
    // recovery: the denied body carries its own way back to THIS read口
    expect(document.querySelector("[data-testid='aud01-denied-retry-block']")).not.toBeNull();
    const reads = listReads();
    api.fetchJSON.mockImplementation(async () => EVENTS);
    await clickRetry("aud01-denied");
    expect(listReads()).toBe(reads + 1);
    await waitFor(() => document.querySelector("[data-testid='aud01-row-evt_7c1f2a3b4d5e6f70']") !== null, "rows back");
    expect(document.querySelector("[data-testid='aud2-page']")!.textContent).toContain("第 2 页");
    expect(document.querySelector("[data-testid='aud6-preview-evt_7c1f2a3b4d5e6f70']")).not.toBeNull();
    expect(locationText()).toContain("actor=employee-api");
  });

  it("403 and 404 stay one body, and only a missing route is 未接入", async () => {
    const leg = async (status: number, code: string): Promise<string> => {
      api.fetchJSON.mockReset();
      api.fetchJSON.mockImplementation(async (url) => {
        throw new ApiError("no", { status, body: `{"code":"${code}"}`, url, requestId: "rid-x" });
      });
      await render("/audit?window=7d", <AuditEventsModulePage />);
      await waitFor(() => document.querySelector("[data-testid='aud01-denied']") !== null, `denied ${status}`);
      return document.querySelector("[data-testid='aud01-denied']")!.textContent ?? "";
    };
    const closed = await leg(403, "console.forbidden");
    expect(document.querySelector("[data-testid='audF-state-list-unwired']")).toBeNull();
    const missing = await leg(404, "console.unknown_route");
    // one body for both codes — the state text does not split them
    expect(missing).toBe(closed);
    // and only the route that is not here is called 未接入, in the title
    expect(document.querySelector("[data-testid='audF-state-list-unwired']")!.getAttribute("data-audf-label")).toBe(
      "这个读口在本环境未接入",
    );
    expect(document.querySelector("[data-testid='aud01-denied']")!.getAttribute("title")).toContain("读口未接入");
    // never dressed up as zero records
    expect(document.querySelector("[data-testid='aud01-empty']")).toBeNull();
    expect(missing).not.toContain("无事件");
    expect(missing).not.toMatch(/0 条/);
  });

  it("the two empties are two different statements", async () => {
    // ① a real answer of no records under these filters
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async () => ({ items: [], nextCursor: null }));
    await render("/audit?window=custom&from=2026-11-01T01%3A00%3A00.000Z&to=2026-11-01T02%3A00%3A00.000Z", <AuditEventsModulePage />);
    await waitFor(() => document.querySelector("[data-testid='aud01-empty']") !== null, "filtered empty");
    expect(mark("list", "empty")).toBe("该条件下无事件");
    expect(document.querySelector("[data-testid='audF-state-list-unwired']")).toBeNull();
    expect(document.querySelector("[data-testid='aud01-empty']")!.textContent).toContain("该时间段内无事件");
    // ② a read口 that is not here at all
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url) => {
      throw new ApiError("no route", { status: 404, body: '{"code":"console.unknown_route"}', url, requestId: "rid-route" });
    });
    await render("/audit?window=7d", <AuditEventsModulePage />);
    await waitFor(() => document.querySelector("[data-testid='audF-state-list-unwired']") !== null, "unwired");
    expect(mark("list", "empty")).toBeNull();
    expect(document.querySelector("[data-testid='aud01-empty']")).toBeNull();
  });

  it("a chain check that cannot run is the same 未接入 statement", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url) => {
      if (String(url).startsWith("/agent-api/api/audit-verify")) {
        throw new ApiError("no route", { status: 404, body: '{"code":"console.unknown_route"}', url, requestId: "rid-v" });
      }
      return EVENTS;
    });
    await render("/audit?window=7d", <AuditEventsModulePage />);
    await waitFor(() => !skeleton(), "list settled");
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud01-verify']")?.click();
    });
    await waitFor(() => document.querySelector("[data-testid='aud01-verify-not-enabled']") !== null, "check could not run");
    expect(mark("verify", "unwired")).toBe("这个读口在本环境未接入");
    expect(sentence("aud01-verify-not-enabled")).toContain("没有提供完整性校验");
    expect(document.querySelector("[data-testid='aud01-verify-not-enabled-request-id']")!.textContent).toContain("rid-v");
  });
});

/**
 * audG — 筛选条件可分享摘要。断言的是：摘要里写的是地址上真正生效的口径，
 * 附的是这一页实际发出的那条相对路径（逐字与 mock 收到的请求一致，不含 origin、
 * 不含凭据）；打开/复制/兜底全程零额外请求；没有可分享口径时 disabled 并说明原因；
 * 加载中与被拒时不给摘要控件。
 */
describe("audG - the shareable filter summary", () => {
  const listReads = (): number => urls().filter((u) => /^\/agent-api\/api\/audit\?/.test(u)).length;
  const detailReads = (): number => urls().filter((u) => u.startsWith("/agent-api/api/audit-detail")).length;
  const verifyReads = (): number => urls().filter((u) => u.startsWith("/agent-api/api/audit-verify")).length;

  function stubClipboard(ok: boolean): { calls: string[] } {
    const box: { calls: string[] } = { calls: [] };
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          box.calls.push(text);
          if (!ok) throw new Error("denied");
        },
      },
    });
    return box;
  }

  async function mountProbed(entry: string): Promise<void> {
    api.fetchJSON.mockReset();
    answer(EVENTS);
    await render(entry, <>
      <AuditEventsModulePage />
      <LocationProbe />
    </>);
    await waitFor(() => !skeleton(), "first page settled");
  }

  async function copy(): Promise<void> {
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='audG-filter-copy']")?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }

  it("copies the address-borne question and the path this page really asked", async () => {
    const clip = stubClipboard(true);
    await mountProbed(
      "/audit?window=24h&type=task.created&actor=employee-api&resource=ap_1122334455667788&cursor=cur_page1&cursor=cur_page2",
    );
    const reads = listReads();
    const details = detailReads();
    const verifies = verifyReads();
    const button = document.querySelector<HTMLButtonElement>("[data-testid='audG-filter-copy']")!;
    expect(button.disabled).toBe(false);
    await copy();
    expect(clip.calls).toHaveLength(1);
    const line = clip.calls[0];
    expect(line).toContain("时间窗：最近 24 小时");
    expect(line).toContain("动作类型：task.created（服务端按 action 精确匹配）");
    expect(line).toContain("操作者：employee-api（服务端 actorId，机器句柄）");
    expect(line).toContain("资源：ap_1122334455667788（本页已加载的记录里本地匹配");
    expect(line).toContain("第 3 页（游标 ×2）");
    // 同源性：摘要里的请求就是实收的那一条，逐字相同
    const asked = urls().filter((u) => /^\/agent-api\/api\/audit\?/.test(u)).pop() ?? "";
    expect(line).toContain(`请求：${asked}`);
    expect(line).toContain("cursor=cur_page2");
    expect(asked).toContain("action=task.created");
    expect(asked).toContain("actorId=employee-api");
    // 零额外请求：复制前后三个读口的计数都没动
    expect(listReads()).toBe(reads);
    expect(detailReads()).toBe(details);
    expect(verifyReads()).toBe(verifies);
    expect(document.querySelector("[data-testid='audG-filter-copy-status']")!.textContent).toBe("筛选条件已复制");
    expect(document.querySelector("[data-testid='audG-filter-copy-status']")!.getAttribute("aria-live")).toBe("polite");
  });

  it("the summary never carries an origin and never carries a credential", async () => {
    const clip = stubClipboard(true);
    await mountProbed("/audit?window=7d&actor=employee-api");
    await copy();
    const line = clip.calls[0];
    expect(line).not.toMatch(/https?:\/\//);
    expect(line).not.toContain("localhost");
    expect(line).not.toContain("token");
    expect(line).not.toContain("session");
    expect(line.split("请求：")[1]!.startsWith("/agent-api/api/audit?")).toBe(true);
  });

  it("with nothing but the default window there is nothing to share, and it says why", async () => {
    const clip = stubClipboard(true);
    await mountProbed("/audit?window=7d");
    const reads = listReads();
    const button = document.querySelector<HTMLButtonElement>("[data-testid='audG-filter-copy']")!;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("title")).toBe("当前没有筛选条件可复制");
    await copy();
    expect(clip.calls).toHaveLength(0);
    expect(listReads()).toBe(reads);
    expect(document.querySelector("[data-testid='audG-filter-copy-fallback']")).toBeNull();
    // and the moment a filter exists, the same control is live
    await choose("aud01-filter-type", "task.created");
    await waitFor(() => document.querySelector<HTMLButtonElement>("[data-testid='audG-filter-copy']")?.disabled === false, "live once filtered");
    const after = listReads();
    await copy();
    expect(clip.calls).toHaveLength(1);
    expect(listReads()).toBe(after);
    expect(clip.calls[0]).toContain("动作类型：task.created");
    expect(clip.calls[0]).toContain(`操作者：${"未设置"}`);
  });

  it("a custom range is quoted in Beijing words, a half-filled one says 未设置", async () => {
    const clip = stubClipboard(true);
    await mountProbed(
      "/audit?window=custom&from=2026-11-17T01%3A00%3A00.000Z&to=2026-11-17T02%3A30%3A00.000Z&type=task.created",
    );
    await copy();
    expect(clip.calls[0]).toContain("时间窗：自定义 2026-11-17T09:00 → 2026-11-17T10:30（北京时间）");
    clip.calls.length = 0;
    await mountProbed("/audit?window=custom&from=2026-11-17T01%3A00%3A00.000Z&type=task.created");
    await copy();
    expect(clip.calls[0]).toContain("自定义 2026-11-17T09:00 → 未设置（北京时间）");
    // that half of the question was never asked, so the path seat stays honest
    expect(clip.calls[0]).toContain("请求：未设置");
    expect(clip.calls[0]).not.toContain("agent-api");
  });

  it("a refused clipboard hands the same line back as selectable text, still asking nothing", async () => {
    const clip = stubClipboard(false);
    await mountProbed("/audit?window=7d&type=task.created");
    const reads = listReads();
    await copy();
    const box = document.querySelector<HTMLTextAreaElement>("[data-testid='audG-filter-copy-fallback']")!;
    expect(box.getAttribute("readonly")).not.toBeNull();
    expect(box.value).toBe(clip.calls[0]);
    expect(box.value).toContain("动作类型：task.created");
    expect(listReads()).toBe(reads);
    expect(document.querySelector("[data-testid='audG-filter-copy-status']")!.textContent).toContain("选中复制");
  });

  it("loading offers no summary, an empty answer still does, and a denied ledger does not", async () => {
    let release: ((value: unknown) => void) | null = null;
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    await render("/audit?window=7d&type=task.created", <AuditEventsModulePage />);
    await waitFor(() => document.querySelector("[data-testid='aud01-loading']") !== null, "loading");
    expect(document.querySelector("[data-testid='audG-filter-copy-block']")).toBeNull();
    await act(async () => {
      release?.({ items: EVENTS.items, nextCursor: null });
    });
    await waitFor(() => !skeleton(), "ready");
    expect(document.querySelector("[data-testid='audG-filter-copy-block']")).not.toBeNull();
    // an empty answer is still a real question worth handing over
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async () => ({ items: [], nextCursor: null }));
    await render("/audit?window=7d&type=task.created", <AuditEventsModulePage />);
    await waitFor(() => document.querySelector("[data-testid='aud01-empty']") !== null, "empty answer");
    expect(document.querySelector("[data-testid='audG-filter-copy']")).not.toBeNull();
    // a closed ledger has no question to describe
    api.fetchJSON.mockReset();
    api.fetchJSON.mockRejectedValue(
      new ApiError("no", { status: 403, body: '{"code":"console.forbidden"}', url: "/agent-api/api/audit", requestId: "rid-g" }),
    );
    await render("/audit?window=7d&type=task.created", <AuditEventsModulePage />);
    await waitFor(() => document.querySelector("[data-testid='aud01-denied']") !== null, "denied");
    expect(document.querySelector("[data-testid='audG-filter-copy-block']")).toBeNull();
  });
});

/**
 * audH — 每页条数选择器。断言的是：选择落 `?limit=`、切条数重取恰一次并回到第 1 页
 * 清掉游标栈、与时间窗/类型/操作者/资源组合冷挂载可复现；服务带回生效值时按生效值
 * 回显并说明，服务没带回时只报「请求值 + 实收条数」两个数；地址里的非法/超大值
 * 一律不发出去并如实说明；空集控件 disabled+title；加载中与被拒时没有该控件；
 * total 仍走服务端字段，缺则「总数不可用」。
 */
describe("audH - the page size selector", () => {
  const many = (n: number): unknown[] =>
    Array.from({ length: n }, (_unused, index) => ({
      eventId: `evt_size_${String(index).padStart(4, "0")}`,
      action: "task.created",
      occurredAt: "2026-11-19T01:20:00Z",
      outcome: "succeeded",
      actor: { type: "system", id: "employee-api" },
    }));

  const listReads = (): string[] => urls().filter((u) => /^\/agent-api\/api\/audit\?/.test(u));
  const sizeValue = (): string =>
    (document.querySelector<HTMLSelectElement>("[data-testid='audH-page-size']")?.value ?? "").trim();

  async function pickSize(size: string): Promise<void> {
    const node = document.querySelector<HTMLSelectElement>("[data-testid='audH-page-size']")!;
    await act(async () => {
      node.value = size;
      node.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  async function mountProbed(entry: string, handler?: (url: string) => Promise<unknown>): Promise<void> {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(
      handler ??
        (async (url: string) => {
          const asked = Number(new URLSearchParams(String(url).split("?")[1] ?? "").get("limit") ?? "50");
          return { items: many(asked), nextCursor: "cur_page2" };
        }),
    );
    await render(entry, <>
      <AuditEventsModulePage />
      <LocationProbe />
    </>);
    await waitFor(() => !skeleton(), "first page settled");
  }

  it("changing the size asks once, at that size, and starts the page over", async () => {
    await mountProbed("/audit?window=7d&cursor=cur_page1&cursor=cur_page2");
    expect(sizeValue()).toBe("50");
    expect(document.querySelector("[data-testid='aud2-page']")!.textContent).toContain("第 3 页");
    const before = listReads().length;
    await pickSize("100");
    await waitFor(() => listReads().length === before + 1, "one read at the new size");
    expect(listReads().length).toBe(before + 1);
    expect(locationText()).toContain("limit=100");
    expect(locationText()).not.toContain("cursor=");
    expect(document.querySelector("[data-testid='aud2-page']")!.textContent).toContain("第 1 页");
    expect(listReads().pop()).toContain("limit=100");
    expect(sizeValue()).toBe("100");
    expect(document.querySelector("[data-testid='audH-clamp-note']")).toBeNull();
  });

  it("a pasted size replays cold: control filled, first read at that size", async () => {
    await mountProbed(
      "/audit?window=custom&from=2026-11-17T01%3A00%3A00.000Z&to=2026-11-17T02%3A30%3A00.000Z" +
        "&type=task.created&actor=employee-api&resource=ap_1&limit=25",
    );
    expect(sizeValue()).toBe("25");
    const asked = listReads().pop() ?? "";
    expect(asked).toContain("limit=25");
    expect(asked).toContain("action=task.created");
    expect(asked).toContain("actorId=employee-api");
    expect(asked).toContain("from=2026-11-17T01");
    expect(listReads()).toHaveLength(1);
    // audG 的摘要同源：请求路径就是这条，limit 已在里面
    const clip = stubClipboardForSummary();
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='audG-filter-copy']")?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(clip.calls[0]).toContain(`请求：${asked}`);
  });

  function stubClipboardForSummary(): { calls: string[] } {
    const box: { calls: string[] } = { calls: [] };
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => void box.calls.push(text) },
    });
    return box;
  }

  it("a size the service clamped is echoed as the size in force", async () => {
    await mountProbed("/audit?window=7d", async (url) => {
      const asked = new URLSearchParams(String(url).split("?")[1] ?? "");
      if (asked.get("limit") === "100") return { items: many(50), limit: 50, nextCursor: null };
      return { items: many(50), nextCursor: null };
    });
    await pickSize("100");
    await waitFor(() => sizeValue() === "50", "the served size is what the control shows");
    const note = document.querySelector("[data-testid='audH-clamp-note']");
    expect(note).not.toBeNull();
    expect(note!.textContent).toContain("请求按每页 100 条发出");
    expect(note!.textContent).toContain("服务这一页带回的是每页 50 条");
    // the control does not offer 100 as if it were in force
    expect(document.querySelector<HTMLSelectElement>("[data-testid='audH-page-size']")!.selectedOptions[0]!.text).toBe("50 条");
    expect(document.querySelector("[data-testid='aud2-page']")!.textContent).toContain("已加载 50 条");
  });

  it("a service that states no size gets only the two numbers the screen has", async () => {
    await mountProbed("/audit?window=7d", async () => ({ items: many(30), nextCursor: null }));
    const note = document.querySelector("[data-testid='audH-clamp-note']");
    expect(note).not.toBeNull();
    expect(note!.textContent).toContain("服务没有带回这一页按多少条读");
    expect(note!.textContent).toContain("limit=50");
    expect(note!.textContent).toContain("实收 30 条");
    expect(sizeValue()).toBe("50");
    expect(document.querySelector("[data-testid='aud2-total']")!.textContent).toBe("总数不可用");
    expect(document.querySelector("[data-testid='aud2-total']")!.getAttribute("title")).toContain("游标分页不能自算总数");
  });

  it("an address size nobody offered is reported, not requested", async () => {
    for (const written of ["999", "abc", "0"]) {
      await mountProbed(`/audit?window=7d&limit=${written}`);
      expect(listReads().pop()).toContain("limit=50");
      expect(listReads().pop()).not.toContain(`limit=${written}`);
      expect(sizeValue()).toBe("50");
      const note = document.querySelector("[data-testid='audH-clamp-note']");
      expect(note).not.toBeNull();
      expect(note!.textContent).toContain("没有把它发出去");
      expect(document.querySelector<HTMLSelectElement>("[data-testid='audH-page-size']")!.getAttribute("title")).toContain(
        "没有把它发出去",
      );
    }
  });

  it("an empty answer leaves the size selector on screen but unusable", async () => {
    await mountProbed("/audit?window=24h", async () => ({ items: [], nextCursor: null }));
    const node = document.querySelector<HTMLSelectElement>("[data-testid='audH-page-size']")!;
    expect(node.disabled).toBe(true);
    expect(node.getAttribute("title")).toContain("没有事件");
    expect(document.querySelector("[data-testid='aud01-empty']")).not.toBeNull();
    // the empty answer keeps the SAME control (one widget, not a second one) and
    // marks it unusable with its reason. jsdom dispatches change even on a
    // disabled node, so the contract proven here is the disabled state and its
    // title, not a click-through request count.
    expect(document.querySelectorAll("[data-testid='audH-page-size']")).toHaveLength(1);
    expect(document.querySelectorAll("[data-testid='audH-clamp-note']")).toHaveLength(0);
  });

  it("loading and denied offer no size to choose", async () => {
    let release: ((value: unknown) => void) | null = null;
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    await render("/audit?window=7d", <AuditEventsModulePage />);
    await waitFor(() => document.querySelector("[data-testid='aud01-loading']") !== null, "loading");
    expect(document.querySelector("[data-testid='audH-page-size']")).toBeNull();
    await act(async () => {
      release?.({ items: many(2), nextCursor: null });
    });
    await waitFor(() => !skeleton(), "ready");
    expect(document.querySelector("[data-testid='audH-page-size']")).not.toBeNull();
    api.fetchJSON.mockReset();
    api.fetchJSON.mockRejectedValue(
      new ApiError("no", { status: 403, body: '{"code":"console.forbidden"}', url: "/agent-api/api/audit", requestId: "rid-h" }),
    );
    await render("/audit?window=7d", <AuditEventsModulePage />);
    await waitFor(() => document.querySelector("[data-testid='aud01-denied']") !== null, "denied");
    expect(document.querySelector("[data-testid='audH-page-size']")).toBeNull();
  });

  it("a stated total still reads as the service's own number", async () => {
    await mountProbed("/audit?window=7d", async () => ({ items: many(5), total: 137, limit: 25, nextCursor: null }));
    await pickSize("25");
    await waitFor(() => document.querySelector("[data-testid='aud2-total']")!.textContent === "共 137 条", "total painted");
    expect(document.querySelector("[data-testid='aud2-total']")!.getAttribute("title")).toContain("顶层 total");
    expect(sizeValue()).toBe("25");
  });
});

/**
 * audI — 类型分布与导出集合同源。断言的是：点一个类型桶之后，屏上「已显示 N 条」
 * ＝该桶计数＝导出 CSV 的数据行数（三值对照）；清掉类型后同一口径重算再对照一次；
 * 分布在游标分页下上屏写明「按已加载 N 条统计」而不是冒充整窗；导出文件名带当前
 * 筛选快照（时间窗/actor/资源/动作/行数）；导出集合口径上屏（audI-export-scope）；
 * 空集导出按钮 disabled 并写明原因；展开分布、点导出都不多发一次请求。
 */
describe("audI - the distribution and the export answer for one set", () => {
  const ROW = (id: string, action: string): unknown => ({
    eventId: id,
    action,
    occurredAt: "2026-11-19T01:20:00Z",
    outcome: "succeeded",
    actor: { type: "system", id: "employee-api" },
    resource: { type: "task", id: "ts_" + id },
    requestId: "req-" + id,
  });
  const MIXED = [ROW("evt_i_a1", "task.created"), ROW("evt_i_a2", "task.created"), ROW("evt_i_b1", "run.failed")];

  /** A service that really filters by action, so the three numbers can be compared. */
  const byAction = async (url: string): Promise<unknown> => {
    const asked = new URLSearchParams(String(url).split("?")[1] ?? "");
    const action = asked.get("action");
    return { items: action ? MIXED.filter((row) => (row as { action: string }).action === action) : [...MIXED], nextCursor: null };
  };

  const reads = (prefix: RegExp): number => urls().filter((u) => prefix.test(u)).length;
  const auditReads = (): number => reads(/^\/agent-api\/api\/audit\?/);

  async function expand(): Promise<void> {
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud7-types-toggle']")?.click();
    });
    await waitFor(() => document.querySelector("[data-testid='aud7-types-panel']") !== null, "panel open");
  }

  async function pick(code: string): Promise<void> {
    await act(async () => {
      document.querySelector<HTMLButtonElement>(`[data-testid='audD-bucket-${code}']`)?.click();
    });
    await waitFor(() => locationText().includes("type=" + code) || !locationText().includes("type="), "the bucket answered");
  }

  /** Everything the download would have carried, without letting it leave the page. */
  function captureDownload(): { lines: () => string[]; name: () => string } {
    const bodies: string[] = [];
    const realBlob = window.Blob;
    const realCreate = URL.createObjectURL;
    const realRevoke = URL.revokeObjectURL;
    let fileName = "";
    const spy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      fileName = this.download;
    });
    class SpyBlob extends realBlob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        bodies.push(String(parts[0] ?? ""));
      }
    }
    window.Blob = SpyBlob as unknown as typeof Blob;
    URL.createObjectURL = vi.fn(() => "blob:audit-i") as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
    afterEachSpy.push(() => {
      window.Blob = realBlob;
      URL.createObjectURL = realCreate;
      URL.revokeObjectURL = realRevoke;
      spy.mockRestore();
    });
    return {
      lines: () => (bodies[0] ?? "").replace(/^\uFEFF/, "").split("\r\n").filter((line) => line !== ""),
      name: () => fileName,
    };
  }

  const afterEachSpy: Array<() => void> = [];
  afterEach(() => {
    for (const restore of afterEachSpy.splice(0)) restore();
  });

  async function mountProbed(entry: string): Promise<void> {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(byAction);
    await render(entry, <>
      <AuditEventsModulePage />
      <LocationProbe />
    </>);
    await waitFor(() => !skeleton(), "first page settled");
  }

  it("one bucket: the count on screen, the bucket and the CSV are the same set", async () => {
    await mountProbed("/audit?window=7d");
    await expand();
    const bucket = Number(
      document
        .querySelector("[data-testid='audD-bucket-task.created']")!
        .closest("li")!
        .querySelector("[data-testid='aud7-types-count']")!.textContent,
    );
    expect(bucket).toBe(2);
    const download = captureDownload();
    await pick("task.created");
    await waitFor(() => document.querySelectorAll("[data-testid^='aud01-row-']").length === bucket, "only this type on screen");
    expect(document.querySelector("[data-testid='aud01-status']")!.textContent).toContain("已显示 2 条");
    expect(document.querySelector("[data-testid='aud5-export-count']")!.textContent).toContain("将导出 2 条");
    // 导出 = 屏上那份集合
    await act(async () => {
      document
        .querySelector<HTMLElement>("[data-testid='aud5-export']")!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(download.lines()).toHaveLength(bucket + 1); // header + rows
    // audI: the name is a name and the body is the body (they were swapped)
    expect(download.name()).toMatch(/^audit-[A-Za-z0-9._-]+\.csv$/);
    expect(download.lines()[0]).toBe("time,actor,action,resource,rid");
    expect(download.lines().slice(1).every((line) => line.includes("创建任务"))).toBe(true);
    expect(download.name()).toContain("task-created");
    expect(download.name()).toContain("n2-");
    // 口径上屏
    const scope = document.querySelector("[data-testid='audI-export-scope']")!.textContent ?? "";
    expect(scope).toContain("只含「创建任务」这一类");
    expect(scope).toContain("共 2 行");
    const note = document.querySelector("[data-testid='audI-scope-note']")!.textContent ?? "";
    expect(note).toContain("按已加载的 2 条统计");
    expect(note).toContain("已按这一类筛");
    // 桶点击 + 展开 + 导出：除那一读之外没多发任何请求
    expect(auditReads()).toBe(2);
    expect(reads(/^\/agent-api\/api\/audit-detail/)).toBe(0);
    expect(reads(/^\/agent-api\/api\/audit-verify/)).toBe(0);
  });

  it("clearing the type recomputes all three under the same rule", async () => {
    await mountProbed("/audit?window=7d&type=run.failed");
    await expand();
    expect(document.querySelectorAll("[data-testid^='aud01-row-']")).toHaveLength(1);
    const download = captureDownload();
    await pick("run.failed"); // pressed again → back to every type
    await waitFor(() => document.querySelectorAll("[data-testid^='aud01-row-']").length === 3, "全量回到屏上");
    expect(document.querySelector("[data-testid='aud01-status']")!.textContent).toContain("已显示 3 条");
    expect(document.querySelector("[data-testid='aud5-export-count']")!.textContent).toContain("将导出 3 条");
    await act(async () => {
      document.querySelector<HTMLElement>("[data-testid='aud5-export']")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(download.lines()).toHaveLength(4);
    expect(download.name()).toContain("-all-n3-");
    expect(download.name()).not.toContain("run-failed");
    const note = document.querySelector("[data-testid='audI-scope-note']")!.textContent ?? "";
    expect(note).toContain("按已加载的 3 条统计");
    expect(note).toContain("不是整窗全量");
    expect(locationText()).not.toContain("type=");
    expect(auditReads()).toBe(2);
  });

  it("a second page keeps saying which denominator was counted", async () => {
    await mountProbed("/audit?window=7d&cursor=cur_page2");
    await expand();
    const note = document.querySelector("[data-testid='audI-scope-note']")!;
    expect(note.textContent).toContain("按已加载的 3 条统计");
    expect(note.getAttribute("title")).toContain("服务端没有按类型的聚合读口");
    expect(document.querySelector("[data-testid='aud2-page']")!.textContent).toContain("第 2 页");
  });

  it("an empty set cannot be exported, and says why in the same words", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async () => ({ items: [], nextCursor: null }));
    await render("/audit?window=7d&type=dispatch.event", <AuditEventsModulePage />);
    await waitFor(() => document.querySelector("[data-testid='aud01-empty']") !== null, "empty answer");
    const node = document.querySelector<HTMLElement>("[data-testid='aud5-export']")!;
    expect(node.getAttribute("aria-disabled")).toBe("true");
    expect(node.getAttribute("title")).toContain("当前筛选无事件可导出");
    const before = urls().length;
    await act(async () => {
      node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(urls()).toHaveLength(before);
    // no set, no distribution to count
    expect(document.querySelector("[data-testid='aud7-types']")).toBeNull();
  });
});
