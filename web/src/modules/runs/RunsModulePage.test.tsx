// @vitest-environment jsdom
// T15 (PRD v4.1) list page. The assertions are about what a person can check
// with their eyes: the real BFF routes are the ones asked (the `/api/`
// segment included), rows only ever come from an answer, 403 and 404 draw one
// identical body with no row above it, the filters change what is asked, and
// a `?state=` repro asks for nothing at all.

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import { RunsModulePage } from "./RunsModulePage";

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

async function render(entry: string, page: ReactNode = <RunsModulePage />): Promise<void> {
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
const rowNodes = (): number => document.querySelectorAll("[data-testid^='run5-row-'][data-status]").length;

/** Stands in for the browser back button and shows where the router thinks it is. */
function HistoryProbe(): ReactNode {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div>
      <button data-testid="probe-back" onClick={() => navigate(-1)}>浏览器后退</button>
      <span data-testid="probe-location">{`${location.pathname}${location.search}`}</span>
    </div>
  );
}

const RUN_A = {
  runId: "rn_01M7822XN781D2S9JASH5TX1XZ",
  status: "failed",
  reasonCode: "run.budget_exhausted",
  costStatus: "upstream",
  costUsd: 0.42,
  startedAt: "2026-11-18T02:00:00Z",
  endedAt: "2026-11-18T02:11:48Z",
};
const RUN_B = {
  runId: "rn_01M7822ABCDEF0123456789XYZ",
  status: "running",
  costStatus: "unknown",
  costUsd: null,
  startedAt: "2026-11-18T03:30:00Z",
};

const okList = (items: unknown[], extra: Record<string, unknown> = {}) => async (url: string) => {
  if (url.includes("/api/runs") || url.includes("/api/run-stats")) return { items, ...extra };
  return { items: [] };
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

describe("the read asks the real routes", () => {
  it("mounts asking /api/runs with the /api/ segment kept and the window stated", async () => {
    api.fetchJSON.mockImplementation(okList([RUN_A]));
    await render("/runs");
    await waitFor(() => rowNodes() === 1, "one row");
    expect(urls()[0]?.startsWith("/agent-api/api/runs?")).toBe(true);
    expect(urls()[0]).toContain("limit=30");
    expect(urls()[0]).toContain("since=");
  });

  it("paints the rows the answer carried and nothing more", async () => {
    api.fetchJSON.mockImplementation(okList([RUN_A, RUN_B]));
    await render("/runs");
    await waitFor(() => rowNodes() === 2, "two rows");
    expect(text()).toContain("运行 · X1XZ");
    expect(text()).toContain("运行 · 9XYZ");
    expect(text()).not.toContain("rn_01M7822XN781D2S9JASH5TX1XZ");
    expect(text()).not.toContain("emp_");
    expect(text()).not.toMatch(/2026-11-18T/); // raw ISO stays off the surface
    expect(text()).toContain("2026-11-18 10:00"); // Beijing minute
    expect(text()).toContain("失败");
    expect(text()).toContain("预算耗尽");
    expect(text()).toContain("$0.42");
    expect(text()).toContain("已计价");
  });

  it("the fallback route is asked only when /api/runs says it is not there", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      if (url.includes("/api/runs")) {
        throw new ApiError("gone", { status: 404, body: "{}", url, requestId: "r1" });
      }
      if (url.includes("/api/run-stats")) return { items: [RUN_A] };
      return { items: [] };
    });
    await render("/runs");
    await waitFor(() => rowNodes() === 1, "fallback row");
    expect(urls().some((u) => u.includes("/agent-api/api/run-stats?"))).toBe(true);
    expect(text()).toContain("运行 · X1XZ");
  });

  it("an unknown cost reads 「—」 + 未知 + reason, never a number", async () => {
    api.fetchJSON.mockImplementation(okList([RUN_B]));
    await render("/runs");
    await waitFor(() => rowNodes() === 1, "one row");
    const costCell = document.querySelector("[data-testid='run5-row-0-cost']");
    expect(costCell?.textContent).toContain("—");
    expect(costCell?.textContent).toContain("未知");
    expect(costCell?.textContent).toContain("账本没有这条运行的计价记录");
    expect(costCell?.textContent).not.toMatch(/\$0\.00|\$0(?![.\d])/);
  });

  it("a true zero cost prints $0.00, honest and explicit", async () => {
    api.fetchJSON.mockImplementation(okList([{ ...RUN_A, costUsd: 0 }]));
    await render("/runs");
    await waitFor(() => rowNodes() === 1, "zero row");
    expect(document.querySelector("[data-testid='run5-row-0-cost']")?.textContent).toContain("$0.00");
  });
});

describe("the four states", () => {
  it("loading is a skeleton, not a list of zero", async () => {
    let resolveList: (v: unknown) => void = () => {};
    api.fetchJSON.mockImplementation((url: string) => {
      if (String(url).includes("/api/runs") || String(url).includes("/api/run-stats")) {
        return new Promise((r) => { resolveList = r; });
      }
      return Promise.resolve({ items: [] });
    });
    await render("/runs");
    expect(document.querySelector("[data-testid='run5-loading']")).toBeTruthy();
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(rowNodes()).toBe(0);
    expect(text()).not.toMatch(/失败 0|运行中 0/);
    resolveList({ items: [] });
    await waitFor(() => document.querySelector("[data-testid='run5-empty']") !== null, "empty after settle");
  });

  it("an empty answer explains itself and names the next step", async () => {
    api.fetchJSON.mockImplementation(okList([]));
    await render("/runs");
    await waitFor(() => document.querySelector("[data-testid='run5-empty']") !== null, "empty");
    expect(text()).toContain("确实没有运行");
    expect(text()).toContain("把时间范围放宽一档");
    // earned zeros: the read succeeded and really returned nothing
    expect(text()).toContain("本页 0 次 · 失败 0 · 运行中 0");
  });

  it("an error speaks human words, quotes the copyable request id, and offers retry", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      throw new ApiError("bad", { status: 400, body: "{}", url, requestId: "run5-rid-filter" });
    });
    await render("/runs");
    await waitFor(() => document.querySelector("[data-testid='run5-error']") !== null, "error");
    expect(text()).toContain("这次筛选没有被接受");
    expect(text()).toContain("run5-rid-filter");
    expect(document.querySelector("[aria-label='复制请求编号']")).toBeTruthy();
    expect(text()).not.toMatch(/\b400\b|agent-api|HTTP/);
    const before = api.fetchJSON.mock.calls.length;
    await act(async () => {
      (document.querySelector("[data-testid='run5-error-retry']") as HTMLButtonElement).click();
    });
    await waitFor(() => api.fetchJSON.mock.calls.length > before, "retry asked again");
  });

  it("a failure with no request id says 「未提供」 and why", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      throw new ApiError("down", { status: 503, body: "no rid", url });
    });
    await render("/runs");
    await waitFor(() => document.querySelector("[data-testid='run5-error']") !== null, "error");
    expect(document.querySelector("[data-testid='run5-error-request-id-value-absent']")).toBeTruthy();
    expect(text()).toContain("未提供");
    expect(text()).not.toMatch(/\b503\b|agent-api|HTTP/);
  });

  it("403 and 404 draw one identical body with no rows above it", async () => {
    const once = async (status: number): Promise<string> => {
      api.fetchJSON.mockReset();
      api.fetchJSON.mockImplementation(async (url: string) => {
        throw new ApiError("no", { status, body: "{}", url, requestId: "run5-deny" });
      });
      await render("/runs");
      await waitFor(() => document.querySelector("[data-testid='run5-denied']") !== null, "denied");
      return html();
    };
    const forbidden = await once(403);
    expect(text()).toContain("现在看不到运行记录");
    expect(text()).toContain("请求编号：run5-deny");
    expect(rowNodes()).toBe(0);
    expect(document.querySelector("[data-testid='run5-table']")).toBeNull();
    expect(forbidden).not.toMatch(/agent-api|console\.\w+|\b40[34]\b|HTTP/);
    expect(await once(404)).toBe(forbidden);
  });

  it("the denied body carries the gap number instead of a guess", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      throw new ApiError("no", { status: 403, body: "{}", url, requestId: "r" });
    });
    await render("/runs");
    await waitFor(() => document.querySelector("[data-testid='run5-denied']") !== null, "denied");
    expect(text()).toContain("GAP-09");
  });

  it("unreadable rows are counted, not painted, and never fake zeros", async () => {
    api.fetchJSON.mockImplementation(okList([RUN_A, { status: "failed" }]));
    await render("/runs");
    await waitFor(() => rowNodes() === 1, "one readable row");
    expect(text()).toContain("另有 1 条");
    expect(text()).toContain("本页 1 次");
  });
});

describe("the controls change what is asked", () => {
  it("the window deep link really moves the since instant, and 30d ≠ 7d ≠ 24h", async () => {
    const sinceOf = async (entry: string): Promise<number> => {
      api.fetchJSON.mockReset();
      api.fetchJSON.mockImplementation(okList([]));
      await render(entry);
      await waitFor(() => api.fetchJSON.mock.calls.length >= 1, "asked");
      const raw = new URLSearchParams(urls()[0]?.split("?")[1] ?? "").get("since") ?? "";
      return Date.parse(raw);
    };
    const d24 = await sinceOf("/runs?window=24h");
    const d7 = await sinceOf("/runs?window=7d");
    const d30 = await sinceOf("/runs?window=30d");
    const now = Date.now();
    expect(Math.abs(now - d24 - 24 * 3600_000) < 60_000).toBe(true);
    expect(Math.abs(now - d7 - 7 * 24 * 3600_000) < 60_000).toBe(true);
    expect(Math.abs(now - d30 - 30 * 24 * 3600_000) < 60_000).toBe(true);
  });

  it("a bogus window or status falls back to the default leg, not the raw value", async () => {
    api.fetchJSON.mockImplementation(okList([]));
    await render("/runs?window=whatever&status=open");
    await waitFor(() => api.fetchJSON.mock.calls.length >= 1, "asked");
    expect(urls()[0]).not.toContain("status=");
    const since = new URLSearchParams(urls()[0]?.split("?")[1] ?? "").get("since") ?? "";
    expect(Math.abs(Date.parse(since) - (Date.now() - 7 * 24 * 3600_000)) < 60_000).toBe(true);
  });

  it("choosing a status rebuilds the ask", async () => {
    api.fetchJSON.mockImplementation(okList([RUN_A]));
    await render("/runs");
    await waitFor(() => rowNodes() === 1, "first ask");
    const select = document.querySelector("[data-testid='run5-filter-status']") as HTMLSelectElement;
    await act(async () => {
      select.value = "failed";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await waitFor(() => urls().some((u) => u.includes("status=failed")), "status ask");
  });
});

describe("the ?state= repro legs", () => {
  for (const state of ["loading", "empty", "error", "denied"] as const) {
    it(`?state=${state} carries data-fixture + the note and asks nothing`, async () => {
      api.fetchJSON.mockImplementation(async () => {
        throw new Error("forced leg must not ask");
      });
      await render(`/runs?state=${state}`);
      expect(document.querySelector(`[data-fixture='${state}']`)).toBeTruthy();
      expect(document.querySelector("[data-testid='run5-forced-note']")?.textContent).toContain(`?state=${state}`);
      expect(document.querySelector("[data-testid='run5-forced-note']")?.textContent).toContain("GAP-09");
      expect(document.querySelector("[data-testid='run5-page']")?.getAttribute("data-fixture")).toBe(state);
      expect(api.fetchJSON).not.toHaveBeenCalled();
      const panel = document.querySelector(`[data-testid='run5-${state}']`);
      expect(panel).toBeTruthy();
      expect(panel?.getAttribute("data-fixture")).toBe(state);
      expect((document.querySelector("[data-testid='run5-refresh']") as HTMLButtonElement).disabled).toBe(true);
    });
  }

  it("?state=ready is not a repro — the real read runs", async () => {
    api.fetchJSON.mockImplementation(okList([RUN_A]));
    await render("/runs?state=ready");
    await waitFor(() => rowNodes() === 1, "real ask");
    expect(document.querySelector("[data-testid='run5-page']")?.hasAttribute("data-fixture")).toBe(false);
  });
});

/* ── the detail pane (T15 v4.1, page 2) ───────────────────────────── */

const DETAIL = {
  ...RUN_A,
  employeeId: "emp_9f3a4b7c",
  attemptNo: 1,
  budgetCapUsd: 5,
  upstreamRunId: "run_upstream_9f3a",
};

const EVENTS = {
  items: [
    { runId: DETAIL.runId, seq: 1, eventType: "started", occurredAt: "2026-11-18T02:00:00Z", payload: {} },
    { runId: DETAIL.runId, seq: 2, eventType: "tool_call", occurredAt: "2026-11-18T02:00:30Z", payload: {} },
    { runId: DETAIL.runId, seq: 3, eventType: "tool_result", occurredAt: "2026-11-18T02:01:40Z", payload: { resultRef: "rn-step-9" } },
    { runId: DETAIL.runId, seq: 4, eventType: "tool_result", occurredAt: "2026-11-18T02:01:45Z", payload: {} },
    { runId: DETAIL.runId, seq: 5, eventType: "completed", occurredAt: "2026-11-18T02:11:48Z", payload: {} },
  ],
  hasMore: false,
};

/** A handler that answers list/detail/events/employees for one known run. */
const detailOk = (opts: {
  detail?: unknown;
  detailError?: (url: string) => never;
  events?: unknown;
  eventsError?: (url: string) => unknown;
  retry?: (url: string, init?: { method?: string; body?: string }) => Promise<unknown>;
}) => async (url: string, init?: { method?: string; body?: string }): Promise<unknown> => {
  if (url.includes("/api/run-detail")) {
    if (opts.detailError) return opts.detailError(url);
    const id = new URLSearchParams(url.split("?")[1] ?? "").get("id") ?? DETAIL.runId;
    return { ...(opts.detail as object ?? DETAIL), runId: id };
  }
  if (url.includes("/api/run-events")) {
    if (opts.eventsError) return opts.eventsError(url);
    return opts.events ?? EVENTS;
  }
  if (url.includes("/api/run-retry")) {
    if (!opts.retry) throw new ApiError("missing", { status: 404, body: "{}", url, requestId: "rid-w" });
    return opts.retry(url, init);
  }
  if (url.includes("/api/employees")) return { items: [{ employeeId: "emp_9f3a4b7c", name: "陈可" }] };
  return { items: [RUN_A] };
};

describe("the detail pane", () => {
  it("opens from a row and reads the timeline with honest result refs", async () => {
    api.fetchJSON.mockImplementation(detailOk({}));
    await render("/runs");
    await waitFor(() => rowNodes() === 1, "list ready");
    await act(async () => {
      (document.querySelector("[data-testid='run5-row-0-open']") as HTMLButtonElement).click();
    });
    await waitFor(() => document.querySelector("[data-testid='run5-detail']") !== null, "detail ready");
    expect(text()).toContain("运行 · X1XZ");
    expect(text()).not.toContain(DETAIL.runId); // the full id stays off the surface
    expect(text()).toContain("工具调用");
    expect(text()).toContain("结果引用：rn-step-9");
    expect(text()).toContain("结果引用：未记录");
    expect(document.querySelectorAll("[data-testid^='run5-event-']")).toHaveLength(5);
    expect(text()).toContain("陈可");
    expect(text()).not.toContain("emp_9f3a4b7c");
    // three-state cost badge on the detail
    expect(document.querySelector("[data-testid='run5-detail-cost']")?.textContent).toContain("$0.42");
    expect(document.querySelector("[data-testid='run5-detail-cost']")?.textContent).toContain("已计价");
  });

  it("the deep link opens the same pane and 关闭 clears it", async () => {
    api.fetchJSON.mockImplementation(detailOk({}));
    await render(`/runs?run=${encodeURIComponent(DETAIL.runId)}`);
    await waitFor(() => document.querySelector("[data-testid='run5-detail']") !== null, "deep detail");
    await act(async () => {
      (document.querySelector("[data-testid='run5-detail-close']") as HTMLButtonElement).click();
    });
    expect(document.querySelector("[data-testid='run5-detail']")).toBeNull();
  });

  it("an unknown cost in the detail never renders the figure it was told", async () => {
    api.fetchJSON.mockImplementation(
      detailOk({ detail: { ...DETAIL, costStatus: "unknown" } }),
    );
    await render(`/runs?run=${encodeURIComponent(DETAIL.runId)}`);
    await waitFor(() => document.querySelector("[data-testid='run5-detail']") !== null, "detail");
    const cost = document.querySelector("[data-testid='run5-detail-cost']");
    expect(cost?.textContent).toContain("—");
    expect(cost?.textContent).toContain("未知");
    expect(cost?.textContent).not.toMatch(/0\.42|\$0/);
  });

  it("a 403 and a 404 for one run draw one identical denied body", async () => {
    const once = async (status: number): Promise<string> => {
      api.fetchJSON.mockImplementation(
        detailOk({
          detailError: (url): never => {
            throw new ApiError("no", { status, body: "{}", url, requestId: "rid-d" });
          },
        }),
      );
      await render(`/runs?run=${encodeURIComponent(DETAIL.runId)}`);
      await waitFor(() => document.querySelector("[data-testid='run5-detail-denied']") !== null, "detail denied");
      return html();
    };
    const forbidden = await once(403);
    expect(text()).toContain("现在看不到运行记录");
    expect(forbidden).not.toMatch(/agent-api|console\.\w+|\b40[34]\b|HTTP/);
    expect(await once(404)).toBe(forbidden);
  });

  it("a detail failure speaks human words, quotes the request id, and re-asks on retry", async () => {
    api.fetchJSON.mockImplementation(
      detailOk({
        detailError: (url): never => {
          throw new ApiError("auth", { status: 401, body: "{}", url, requestId: "rid-401a" });
        },
      }),
    );
    await render(`/runs?run=${encodeURIComponent(DETAIL.runId)}`);
    await waitFor(() => document.querySelector("[data-testid='run5-detail-error']") !== null, "detail error");
    expect(text()).toContain("重新登录");
    expect(text()).toContain("rid-401a");
    const before = urls().filter((u) => u.includes("/api/run-detail")).length;
    await act(async () => {
      (document.querySelector("[data-testid='run5-detail-error-retry']") as HTMLButtonElement).click();
    });
    await waitFor(() => urls().filter((u) => u.includes("/api/run-detail")).length > before, "detail re-ask");
  });

  it("an event-stream failure keeps the run body and says what failed", async () => {
    let eventsAsks = 0;
    api.fetchJSON.mockImplementation(
      detailOk({
        eventsError: (url: string) => {
          eventsAsks += 1;
          if (eventsAsks === 1) {
            throw new ApiError("ev", { status: 500, body: "{}", url, requestId: "rid-ev" });
          }
          return EVENTS;
        },
      }),
    );
    await render(`/runs?run=${encodeURIComponent(DETAIL.runId)}`);
    await waitFor(() => document.querySelector("[data-testid='run5-detail']") !== null, "detail with bad events");
    expect(text()).toContain("事件流这次没读到");
    expect(text()).toContain("这次没有读到");
    await act(async () => {
      (document.querySelector("[data-testid='run5-events-retry']") as HTMLButtonElement).click();
    });
    await waitFor(() => document.querySelector("[data-testid='run5-timeline']") !== null, "events after retry");
  });

  it("retry creates a NEW run and the page navigates to that new id", async () => {
    const NEW_ID = "rn_01NEW9F3A4B7C8D9E0F1A2B3";
    api.fetchJSON.mockImplementation(detailOk({ retry: async () => ({ runId: NEW_ID }) }));
    await render(`/runs?run=${encodeURIComponent(DETAIL.runId)}`);
    await waitFor(() => document.querySelector("[data-testid='run5-detail']") !== null, "detail");
    await act(async () => {
      (document.querySelector("[data-testid='run5-retry-new']") as HTMLButtonElement).click();
    });
    await waitFor(() => text().includes("已新建"), "retry done line");
    expect(document.querySelector("[data-testid='run5-retry-result']")?.textContent).toContain("运行 · A2B3");
    expect(urls().some((u) => u.includes("/api/run-retry"))).toBe(true);
    expect(urls().some((u) => u.includes(`id=${encodeURIComponent(NEW_ID)}`))).toBe(true);
    expect(text()).not.toContain(DETAIL.runId); // the old id is not echoed back
  });

  it("a write that is not there is said honestly, with no fake navigation", async () => {
    api.fetchJSON.mockImplementation(detailOk({})); // retry default: 404
    await render(`/runs?run=${encodeURIComponent(DETAIL.runId)}`);
    await waitFor(() => document.querySelector("[data-testid='run5-detail']") !== null, "detail");
    await act(async () => {
      (document.querySelector("[data-testid='run5-retry-new']") as HTMLButtonElement).click();
    });
    await waitFor(() => text().includes("还没有在本控制台接通"), "honest write gap");
    expect(text()).toContain("GAP-09");
    expect(text()).toContain("rid-w");
    expect(document.querySelector("[data-testid='run5-detail']")).toBeTruthy();
    expect(text()).toContain("运行 · X1XZ"); // still the same run, unchanged
  });

  it("the upstream handle is copy-only: no panel, no dead jump, the reason is on screen", async () => {
    // Probed live 2026-11-19: /api/runs ignores both `upstreamRunId=` and
    // `upstream=` (14 rows either way), so a click here could only rewrite the
    // URL. Copy stays; the jump is not offered and the page says why.
    api.fetchJSON.mockImplementation(detailOk({}));
    await render(`/runs?run=${encodeURIComponent(DETAIL.runId)}`);
    await waitFor(() => document.querySelector("[data-testid='run5-detail']") !== null, "detail");
    const line = document.querySelector("[data-testid='run5-detail-upstream']");
    expect(line).toBeTruthy();
    expect(line?.tagName).not.toBe("BUTTON");
    expect(line?.getAttribute("title")).toBe("run_upstream_9f3a");
    expect(text()).toContain("9F3A");
    expect(text()).not.toContain("run_upstream_9f3a"); // raw only in title/clipboard
    expect(text()).toContain("没有按上游编号查询的入口");
    expect(document.querySelector("[data-testid='run5-upstream']")).toBeNull();
  });

  it("a repro leg ignores ?run= and asks for nothing, employee names included", async () => {
    api.fetchJSON.mockImplementation(async () => {
      throw new Error("forced leg must not ask");
    });
    await render(`/runs?state=empty&run=${encodeURIComponent(DETAIL.runId)}`);
    expect(api.fetchJSON).not.toHaveBeenCalled();
    expect(document.querySelector("[data-testid='run5-detail']")).toBeNull();
    expect(document.querySelector("[data-testid='run5-detail-loading']")).toBeNull();
  });
});

describe("real-data depth: people, status words and the deep link", () => {
  const NAMED = {
    runId: "rn_01M7822XN781D2S9JASH5TX1XZ",
    status: "completed",
    costStatus: "upstream",
    costUsd: 0.009875,
    employeeId: "emp_86A81CE8FF6F42E187BCF2B540",
    startedAt: "2026-11-18T02:00:00Z",
    endedAt: "2026-11-18T02:01:13Z",
  };
  const UNNAMED = {
    runId: "rn_01M7822ABCDEF0123456789XYZ",
    status: "quantum",
    costStatus: "unknown",
    employeeId: "emp_9F42AAE299D541FBBB6ECE3671",
    startedAt: "2026-11-18T03:30:00Z",
  };

  it("the list names the owner as 姓名 · 8位短码, and never a bare handle", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      if (url.includes("/api/employees")) {
        return { items: [{ employeeId: "emp_86A81CE8FF6F42E187BCF2B540", name: "小鲤" }] };
      }
      return { items: [NAMED] };
    });
    await render("/runs");
    await waitFor(() => rowNodes() === 1, "one row");
    await waitFor(
      () => (document.querySelector("[data-testid='run5-row-0-employee']")?.textContent ?? "").includes("小鲤"),
      "name decorates the list",
    );
    const cell = document.querySelector("[data-testid='run5-row-0-employee']");
    expect(cell?.textContent).toBe("小鲤 · 86A81CE8");
    expect(cell?.getAttribute("title")).toBe("emp_86A81CE8FF6F42E187BCF2B540");
    expect(text()).not.toContain("emp_86A81CE8FF6F42E187BCF2B540");
    expect(text()).not.toContain("emp_");
  });

  it("an owner the directory does not name keeps the 8-character code, not a bare id", async () => {
    api.fetchJSON.mockImplementation(okList([UNNAMED]));
    await render("/runs");
    await waitFor(() => rowNodes() === 1, "one row");
    const cell = document.querySelector("[data-testid='run5-row-0-employee']");
    expect(cell?.textContent).toBe("员工 · 9F42AAE2");
    expect(cell?.getAttribute("title")).toBe("emp_9F42AAE299D541FBBB6ECE3671");
    expect(text()).not.toContain("emp_");
  });

  it("a run with no owner reads 未指派 with the reason, never a dash pretending to be data", async () => {
    api.fetchJSON.mockImplementation(okList([{ runId: "rn_01M7822ABCDEF0123456789XYZ", status: "pending", startedAt: "2026-11-18T03:30:00Z" }]));
    await render("/runs");
    await waitFor(() => rowNodes() === 1, "one row");
    const cell = document.querySelector("[data-testid='run5-row-0-employee']");
    expect(cell?.textContent).toBe("未指派");
    expect(cell?.getAttribute("title")).toContain("没有带回负责人");
  });

  it("an unlisted status reads 待核实, an absent one stays a dash", async () => {
    api.fetchJSON.mockImplementation(okList([UNNAMED, { runId: "rn_01M7822ZZZZEF0123456789QQQ", startedAt: "2026-11-18T04:00:00Z" }]));
    await render("/runs");
    await waitFor(() => rowNodes() === 2, "two rows");
    expect(document.querySelector("[data-testid='run5-row-0-status']")?.textContent).toBe("待核实");
    expect(document.querySelector("[data-testid='run5-row-1-status']")?.textContent).toBe("—");
  });

  it("a settled ledger figure prints in USD; a running unknown prints a dash with the reason", async () => {
    api.fetchJSON.mockImplementation(okList([NAMED, UNNAMED]));
    await render("/runs");
    await waitFor(() => rowNodes() === 2, "two rows");
    const known = document.querySelector("[data-testid='run5-row-0-cost']");
    expect(known?.textContent).toContain("$0.01"); // 0.009875 at 2dp
    expect(known?.textContent).toContain("已计价");
    const unknown = document.querySelector("[data-testid='run5-row-1-cost']");
    expect(unknown?.textContent).toContain("—");
    expect(unknown?.textContent).toContain("未知");
    expect(unknown?.textContent).not.toContain("$0.00");
  });

  it("the detail also opens from the path /runs/<runId>, so the link survives a refresh", async () => {
    api.fetchJSON.mockImplementation(detailOk({}));
    await render(`/runs/${encodeURIComponent(DETAIL.runId)}`);
    await waitFor(() => document.querySelector("[data-testid='run5-detail']") !== null, "detail from the path");
    expect(text()).toContain("运行 · X1XZ");
  });
});

// R23 (2026-11-19): opening a detail used to replace the list entry, so the
// browser back button left the page before it ever returned to the list. The
// detail is now pushed as its own entry; these locks fail if that regresses.
describe("R23 — a detail is a real history entry", () => {
  it("list → detail → back, three times over, always lands back on the list", async () => {
    api.fetchJSON.mockImplementation(detailOk({}));
    await render(
      "/runs",
      <>
        <HistoryProbe />
        <RunsModulePage />
      </>,
    );
    await waitFor(() => rowNodes() === 1, "list ready");

    for (let cycle = 1; cycle <= 3; cycle += 1) {
      await act(async () => {
        (document.querySelector("[data-testid='run5-row-0-open']") as HTMLButtonElement).click();
      });
      await waitFor(
        () => document.querySelector("[data-testid='run5-detail']") !== null,
        `detail open (cycle ${cycle})`,
      );
      expect(document.querySelector("[data-testid='probe-location']")?.textContent).toContain("run=");

      await act(async () => {
        (document.querySelector("[data-testid='probe-back']") as HTMLButtonElement).click();
      });
      await waitFor(
        () => document.querySelector("[data-testid='run5-detail']") === null,
        `back to the list (cycle ${cycle})`,
      );
      // Back must leave a list on screen, not an empty page: the row is still
      // there and the URL no longer carries the detail parameter.
      expect(rowNodes()).toBe(1);
      expect(document.querySelector("[data-testid='probe-location']")?.textContent).not.toContain("run=");
    }
  });

  it("a deep-linked detail closes in place, because there is no list entry behind it", async () => {
    api.fetchJSON.mockImplementation(detailOk({}));
    await render(
      `/runs?run=${encodeURIComponent(DETAIL.runId)}`,
      <>
        <HistoryProbe />
        <RunsModulePage />
      </>,
    );
    await waitFor(() => document.querySelector("[data-testid='run5-detail']") !== null, "deep detail");
    await act(async () => {
      (document.querySelector("[data-testid='run5-detail-close']") as HTMLButtonElement).click();
    });
    expect(document.querySelector("[data-testid='run5-detail']")).toBeNull();
    expect(document.querySelector("[data-testid='probe-location']")?.textContent).toBe("/runs");
  });

  it("closing a detail that was pushed walks back instead of stacking another entry", async () => {
    api.fetchJSON.mockImplementation(detailOk({}));
    await render(
      "/runs",
      <>
        <HistoryProbe />
        <RunsModulePage />
      </>,
    );
    await waitFor(() => rowNodes() === 1, "list ready");
    await act(async () => {
      (document.querySelector("[data-testid='run5-row-0-open']") as HTMLButtonElement).click();
    });
    await waitFor(() => document.querySelector("[data-testid='run5-detail']") !== null, "detail open");
    await act(async () => {
      (document.querySelector("[data-testid='run5-detail-close']") as HTMLButtonElement).click();
    });
    await waitFor(() => document.querySelector("[data-testid='run5-detail']") === null, "list after close");
    expect(rowNodes()).toBe(1);
    expect(document.querySelector("[data-testid='probe-location']")?.textContent).not.toContain("run=");
  });
});
