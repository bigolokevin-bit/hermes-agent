// @vitest-environment jsdom
// T15 (PRD v4.1) list page. The assertions are about what a person can check
// with their eyes: the real BFF routes are the ones asked (the `/api/`
// segment included), rows only ever come from an answer, 403 and 404 draw one
// identical body with no row above it, the filters change what is asked, and
// the `?state=` repro legs (R30 removed them, R39 restored them marked) paint a
// panel from the URL while asking the service nothing at all.

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn((text: string) => Promise.resolve(Boolean(text))) }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clip.copyTextToClipboard }));

import { RunsModulePage } from "./RunsModulePage";
import { runCsvFileName, runListCsv } from "./runs";
import { COST_CALIBER_TEXT } from "../metrics/costCaliberNote";

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

  it("the denied body names no gap, because the read route really answers", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      throw new ApiError("no", { status: 403, body: "{}", url, requestId: "r" });
    });
    await render("/runs");
    await waitFor(() => document.querySelector("[data-testid='run5-denied']") !== null, "denied");
    // R30: this page reads a live route, so a denial is a permission answer and
    // must not blame a data-source gap that no longer exists.
    expect(text()).not.toContain("GAP-09");
    expect(text()).toContain("请联系工作区管理员开通");
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
    { runId: DETAIL.runId, seq: 6, eventType: "tool_intent", occurredAt: "2026-11-18T02:11:50Z", payload: { resultRef: "ev-intent-7" } },
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
      (document.querySelector("[data-testid='run5-row-0-open']") as HTMLElement).click();
    });
    await waitFor(() => document.querySelector("[data-testid='run5-detail']") !== null, "detail ready");
    expect(text()).toContain("运行 · X1XZ");
    expect(text()).not.toContain(DETAIL.runId); // the full id stays off the surface
    expect(text()).toContain("工具调用");
    expect(text()).toContain("结果引用：rn-step-9");
    expect(text()).toContain("结果引用：未记录");
    // A tool intent carries the same reference shape; the row says which kind it was.
    expect(text()).toContain("工具意图");
    expect(text()).toContain("结果引用：ev-intent-7");
    expect(document.querySelector("[data-tool-event='tool_intent']")).not.toBeNull();
    // R29 tail: each tool event carries its own readable result-ref cell, and a
    // missing reference says so in the row instead of being left blank.
    const presentRef = document.querySelector("[data-testid='run5-result-ref-3']");
    expect(presentRef).toBeTruthy();
    expect(presentRef?.getAttribute("data-result-ref")).toBe("present");
    expect(presentRef?.getAttribute("title")).toBe("rn-step-9"); // raw handle only in the title
    const absentRef = document.querySelector("[data-testid='run5-result-ref-4']");
    expect(absentRef).toBeTruthy();
    expect(absentRef?.getAttribute("data-result-ref")).toBe("absent");
    expect(absentRef?.textContent).toContain("未记录");
    expect(absentRef?.getAttribute("title")).toContain("没有带回结果引用");
    expect(document.querySelectorAll("[data-testid^='run5-event-']")).toHaveLength(6);
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

  it("the retry entry is disabled with the measured reason: no click, no write, no invented id", async () => {
    // Measured 2026-11-20 against the served console: POST /api/run-retry answers
    // 405 console.read_only (only GET/HEAD allowed) and GET answers 404
    // console.unknown_route. The write channel is closed at the console, so the
    // entry is a disabled control that names the measurement — a click can start
    // nothing and no new id may be invented or the old one reused.
    api.fetchJSON.mockImplementation(detailOk({ retry: async () => ({ runId: "rn_01NEW9F3A4B7C8D9E0F1A2B3" }) }));
    await render(`/runs?run=${encodeURIComponent(DETAIL.runId)}`);
    await waitFor(() => document.querySelector("[data-testid='run5-detail']") !== null, "detail");
    const entry = document.querySelector("[data-testid='run5-retry-new']") as HTMLButtonElement;
    expect(entry).toBeTruthy();
    expect(entry.tagName).toBe("BUTTON");
    expect(entry.disabled).toBe(true);
    expect(entry.getAttribute("aria-disabled")).toBe("true");
    expect(entry.getAttribute("data-planned")).toBe("true");
    expect(entry.getAttribute("data-endpoint-http")).toBe("405");
    expect(entry.getAttribute("title")).toContain("405");
    expect(entry.getAttribute("title")).toContain("console.read_only");
    expect(entry.textContent).toContain("当前环境只读");
    expect(text()).toContain("重试的语义是新建一次运行并生成新编号");
    await act(async () => {
      entry.click();
    });
    expect(urls().some((u) => u.includes("/api/run-retry"))).toBe(false);
    expect(text()).not.toContain("已新建");
    expect(document.querySelector("[data-testid='run5-detail']")).toBeTruthy();
    expect(text()).toContain("运行 · X1XZ"); // still the same run, unchanged
  });

  it("every row carries a real anchor whose href carries the run path segment", async () => {
    api.fetchJSON.mockImplementation(detailOk({}));
    await render("/runs?window=7d");
    await waitFor(() => rowNodes() === 1, "list ready");
    const row = document.querySelector("[data-testid='run5-row-0']");
    expect(row).toBeTruthy();
    expect(row?.getAttribute("data-status")).toBeTruthy();
    const link = row?.querySelector("[data-testid='run5-row-0-open']") as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.tagName).toBe("A");
    // R29: QA counts a[href*="/runs/"], so the address keeps the path shape
    // with the trailing slash react-router matches leniently, and carries the
    // record plus the active filters in the query.
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith("/runs/?")).toBe(true);
    expect(href).toContain("/runs/");
    expect(href).toContain(`run=${encodeURIComponent(RUN_A.runId)}`);
    expect(href).toContain("window=7d"); // filters ride along
    expect(link.getAttribute("data-run-id")).toBe(RUN_A.runId);
    expect(link.getAttribute("tabindex")).toBeNull(); // an anchor with href is natively focusable
  });

  it("the row address really opens that record when it is pasted back", async () => {
    // A copyable href is only honest if the page reads it back: the same
    // address (trailing slash included) must open the record on its own.
    api.fetchJSON.mockImplementation(detailOk({}));
    await render(`/runs/?window=7d&run=${encodeURIComponent(RUN_A.runId)}`);
    await waitFor(() => document.querySelector("[data-testid='run5-detail']") !== null, "detail from the address");
    expect(text()).toContain("运行 · X1XZ");
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
        (document.querySelector("[data-testid='run5-row-0-open']") as HTMLElement).click();
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
      (document.querySelector("[data-testid='run5-row-0-open']") as HTMLElement).click();
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

const EVENTS_R36 = {
  items: [
    { runId: DETAIL.runId, seq: 1, eventType: "quantum.recalibration", occurredAt: "2026-11-18T02:00:00Z", payload: { delta: "整理今天的巡检记录，并把缺项点出来" } },
    { runId: DETAIL.runId, seq: 2, eventType: "failed", occurredAt: "2026-11-18T02:00:40Z", payload: { error: { code: "run.timeout", messageRedacted: "运行超时，被系统中止" } } },
    { runId: DETAIL.runId, seq: 3, eventType: "tool_intent", occurredAt: "2026-11-18T02:01:00Z", payload: { resultRef: "ev_2BAA7DD7F3BC4767AF39764D91" } },
    { runId: DETAIL.runId, seq: 4, eventType: "tool_result", occurredAt: "2026-11-18T02:01:10Z", payload: {} },
  ],
  hasMore: false,
};

describe("R36 — the timeline says what it read", () => {
  it("names an unlisted type 待核实, keeps the raw code in the title, and shows summary, cause and a real link", async () => {
    api.fetchJSON.mockImplementation(detailOk({ events: EVENTS_R36 }));
    await render("/runs");
    await waitFor(() => rowNodes() === 1, "list ready");
    await act(async () => {
      (document.querySelector("[data-testid='run5-row-0-open']") as HTMLElement).click();
    });
    await waitFor(() => document.querySelector("[data-testid='run5-detail']") !== null, "detail ready");
    await waitFor(() => document.querySelector("[data-testid='run5-tl-summary-1']") !== null, "timeline ready");

    const row1 = document.querySelector("[data-testid='run5-event-1']");
    expect(row1?.textContent).toContain("待核实");
    expect(row1?.textContent).not.toContain("quantum.recalibration");
    const titles = Array.from(row1?.querySelectorAll("[title]") ?? []).map((node) => node.getAttribute("title"));
    expect(titles).toContain("quantum.recalibration");

    expect(document.querySelector("[data-testid='run5-tl-summary-1']")?.textContent).toContain("整理今天的巡检记录");

    const reason = document.querySelector("[data-testid='run5-tl-reason-2']");
    expect(reason?.textContent).toContain("失败原因：运行超时");
    expect(reason?.textContent).toContain("被系统中止");
    const absentSummary = document.querySelector("[data-testid='run5-tl-summary-2']");
    expect(absentSummary?.textContent).toBe("未记录");
    expect(absentSummary?.getAttribute("title")).toContain("没有带回可读的摘要");

    const link = document.querySelector("[data-testid='run5-result-ref-3']") as HTMLAnchorElement | null;
    expect(link?.tagName).toBe("A");
    expect(link?.getAttribute("href")).toBe("/audit?detail=ev_2BAA7DD7F3BC4767AF39764D91");

    const absent = document.querySelector("[data-testid='run5-result-ref-4']");
    expect(absent?.getAttribute("data-result-ref")).toBe("absent");
    expect(absent?.textContent ?? "").not.toBe("");
    expect(absent?.textContent).toContain("未记录");
  });
});

/* ── R39 — the ?state= repro legs switch the CONTENT surface ─────────
 *
 * Restored after R30 burned the leg, because QA has to be able to look at
 * these four panels without breaking a service. The bar this block holds: the
 * URL paints a different panel (not the same list with a badge on it), the mark
 * sits on the forced legs only, and a forced leg asks nothing — list, detail
 * and the employee-name side-read alike.
 *
 * Measured in this run, recorded rather than claimed (jsdom, one row on ready):
 *   ready leg   [run5-table] panel 131 chars · body 272 chars · 0 marks
 *   error leg   [run5-error] panel  43 chars · body 253 chars · 2 marks
 *   (the empty/denied legs differ again: 82 and 90 panel chars)
 * See docs/_artifacts/aud/DONE.md §R39 for the full four-state table.
 */

describe("R39 — the ?state= repro legs paint panels and ask for nothing", () => {
  /** Any network attempt from a forced leg fails the test, loudly. */
  const mustNotAsk = (): never => {
    throw new Error("a repro leg must not reach the network");
  };

  const panelOf = (state: string): Element | null => document.querySelector(`[data-testid='run5-${state}']`);
  const panelText = (state: string): string => panelOf(state)?.textContent ?? "";
  const bodyLen = (): number => (document.body.textContent ?? "").length;
  /** A panel reduced to its body: the mark and the request-id line come and go. */
  const bare = (markup: string): string =>
    markup
      .replace(/ data-fixture="[^"]*"/g, "")
      .replace(/<p\b[^>]*data-testid="run5-denied-request-id"[\s\S]*?<\/p>/g, "");

  const STATES = ["loading", "empty", "error", "denied"] as const;

  it.each(STATES)("?state=%s draws that panel, marked, with zero requests", async (state) => {
    api.fetchJSON.mockImplementation(mustNotAsk);
    await render(`/runs?state=${state}`);
    await waitFor(() => panelOf(state) !== null, state);
    expect(urls()).toHaveLength(0);
    // The mark: the root and the panel, and nothing else on the page.
    expect(document.querySelector("[data-testid='run5-page']")?.getAttribute("data-fixture")).toBe(state);
    expect(panelOf(state)?.getAttribute("data-fixture")).toBe(state);
    expect(document.querySelectorAll("[data-fixture]").length).toBe(2);
    // The repro owns up to it on the surface.
    const note = document.querySelector("[data-testid='run5-forced-note']")?.textContent ?? "";
    expect(note).toContain(`?state=${state}`);
    expect(note).toContain("没有向服务要过任何东西");
    // It is a panel, not a painted list. An empty answer counts zero; a leg
    // that was never answered prints a dash.
    expect(rowNodes()).toBe(0);
    expect(document.querySelector("[data-testid='run5-table']")).toBeNull();
    const counts = document.querySelector("[data-testid='run5-counts']")?.textContent ?? "";
    expect(counts).toContain(state === "empty" ? "本页 0 次" : "本页 — 次");
    // The controls that would ask are disabled, with the reason on them.
    const refresh = document.querySelector("[data-testid='run5-refresh']") as HTMLButtonElement | null;
    expect(refresh?.disabled).toBe(true);
    expect(refresh?.title).toContain("复现腿不发起真实请求");
    // No path echo, no engineering language on any leg.
    expect(text()).not.toMatch(/agent-api|\/api\/runs|runId|rn_0|undefined|NaN/);
  });

  it("the four legs are four different panels, one at a time", async () => {
    api.fetchJSON.mockImplementation(mustNotAsk);
    const marks: string[] = [];
    const bodies: string[] = [];
    for (const state of STATES) {
      await render(`/runs?state=${state}`);
      await waitFor(() => panelOf(state) !== null, state);
      for (const other of STATES) {
        if (other !== state) expect(panelOf(other)).toBeNull();
      }
      // The content surface itself moves: different markup every leg. The
      // loading skeleton carries no words, so it is measured by structure.
      marks.push(panelOf(state)?.outerHTML ?? "");
      if (state !== "loading") bodies.push(panelText(state));
    }
    expect(new Set(marks).size).toBe(STATES.length);
    expect(new Set(bodies).size).toBe(bodies.length);
    expect(bodies.every((line) => line.length > 0)).toBe(true);
  });

  it("the error leg shows the request-id slot and a retry, and is not the ready surface", async () => {
    api.fetchJSON.mockImplementation(mustNotAsk);
    await render("/runs?state=error");
    await waitFor(() => panelOf("error") !== null, "error repro");
    const errorPanel = panelText("error");
    const errorBody = bodyLen();
    expect(document.querySelector("[data-testid='run5-error-request-id']")).toBeTruthy();
    const retry = document.querySelector("[data-testid='run5-error-retry']") as HTMLButtonElement | null;
    expect(retry?.textContent).toContain("重试");
    expect(retry?.disabled).toBe(true);

    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(okList([RUN_A]));
    await render("/runs");
    await waitFor(() => rowNodes() === 1, "ready rows");
    const readyPanel = document.querySelector("[data-testid='run5-table']")?.textContent ?? "";
    const readyBody = bodyLen();
    expect(errorPanel).not.toBe(readyPanel);
    expect(errorBody).not.toBe(readyBody);
    expect([errorPanel.length, readyPanel.length, errorBody, readyBody].every((n) => n > 0)).toBe(true);
  });

  it("403 and 404 still draw one identical denied body, and the marked leg is that same body", async () => {
    const deniedOnce = async (status: number): Promise<string> => {
      api.fetchJSON.mockReset();
      api.fetchJSON.mockImplementation(async (url: string) => {
        throw new ApiError("no", { status, body: "{}", url, requestId: "run5-deny" });
      });
      await render("/runs");
      await waitFor(() => panelOf("denied") !== null, "denied");
      return panelOf("denied")?.outerHTML ?? "";
    };
    const forbidden = await deniedOnce(403);
    expect(forbidden.length).toBeGreaterThan(0);
    expect(await deniedOnce(404)).toBe(forbidden);

    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(mustNotAsk);
    await render("/runs?state=denied");
    await waitFor(() => panelOf("denied") !== null, "denied repro");
    expect(urls()).toHaveLength(0);
    const repro = panelOf("denied")?.outerHTML ?? "";
    expect(repro).toContain('data-fixture="denied"');
    // Same panel, mark aside: the repro does not invent a different body.
    expect(bare(repro)).toBe(bare(forbidden));
  });

  it("a repro leg ignores ?run= and asks for nothing, employee names included", async () => {
    api.fetchJSON.mockImplementation(mustNotAsk);
    await render(`/runs?state=empty&run=${encodeURIComponent(RUN_A.runId)}&employee=emp_9f3a4b7c`);
    await waitFor(() => panelOf("empty") !== null, "empty repro");
    expect(urls()).toHaveLength(0);
    expect(document.querySelector("[data-testid='run5-detail']")).toBeNull();
    expect(document.querySelector("[data-testid='run5-detail-loading']")).toBeNull();
  });

  it("the ready leg carries no mark and keeps the real read", async () => {
    api.fetchJSON.mockImplementation(okList([RUN_A], { cursor: null }));
    await render("/runs");
    await waitFor(() => rowNodes() === 1, "ready rows");
    expect(document.querySelector("[data-fixture]")).toBeNull();
    expect(document.querySelector("[data-testid='run5-forced-note']")).toBeNull();
    expect(urls().some((u) => u.startsWith("/agent-api/api/runs?"))).toBe(true);
    expect(document.querySelector("[data-testid='run5-counts']")?.textContent).toContain("本页 1 次");
  });

  it("?state=ready and an unknown state are real reads, not repros", async () => {
    for (const entry of ["/runs?state=ready", "/runs?state=whatever"]) {
      api.fetchJSON.mockReset();
      api.fetchJSON.mockImplementation(okList([RUN_A]));
      await render(entry);
      await waitFor(() => rowNodes() === 1, `real read from ${entry}`);
      expect(document.querySelector("[data-testid='run5-page']")?.hasAttribute("data-fixture")).toBe(false);
      expect(document.querySelector("[data-fixture]")).toBeNull();
      expect(urls().length).toBeGreaterThan(0);
    }
  });
});

describe("R40 — per-event status and duration", () => {
  it("每条事件给出状态人话与相对上一条的耗时", async () => {
    const events = {
      items: [
        { runId: RUN_A.runId, seq: 1, eventType: "started", occurredAt: "2026-11-20T02:00:00Z", payload: {} },
        { runId: RUN_A.runId, seq: 2, eventType: "tool_call", occurredAt: "2026-11-20T02:00:40Z", payload: {} },
        { runId: RUN_A.runId, seq: 3, eventType: "completed", occurredAt: "2026-11-20T02:02:04Z", payload: {} },
        { runId: RUN_A.runId, seq: 4, eventType: "quantum.recalibration", occurredAt: "2026-11-20T02:02:10Z", payload: {} },
      ],
      hasMore: false,
    };
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(detailOk({ events }));
    await render("/runs");
    await waitFor(() => rowNodes() === 1, "row ready");
    await act(async () => {
      (document.querySelector("[data-testid='run5-row-0-open']") as HTMLElement | null)?.click();
    });
    await waitFor(() => document.querySelector("[data-testid='run5-detail']") !== null, "detail ready");
    await waitFor(() => document.querySelector("[data-testid='run5-status-4']") !== null, "timeline ready");

    const cell = (id: string): HTMLElement | null => document.querySelector("[data-testid='" + id + "']");
    expect(cell("run5-status-1")?.textContent).toBe("已开始");
    expect(cell("run5-status-2")?.textContent).toBe("调用中");
    expect(cell("run5-status-3")?.textContent).toBe("已完成");
    expect(cell("run5-status-4")?.textContent).toBe("待核实");
    expect(cell("run5-status-4")?.getAttribute("title") ?? "").toContain("不在这份对照表");

    expect(cell("run5-duration-1")?.textContent).toBe("—");
    expect(cell("run5-duration-1")?.getAttribute("title") ?? "").toContain("第一条事件");
    expect(cell("run5-duration-2")?.textContent).toBe("40s");
    expect(cell("run5-duration-3")?.textContent).toBe("1m 24s");
    expect(cell("run5-duration-4")?.textContent).toBe("6s");
  });
});

/* ── runs row preview ────────────────────────────────────────────────
 * The preview is a reading of the row the list already has: no second read,
 * no client clock, one open at a time, Escape hands focus back to its toggle.
 */
describe("runs row preview", () => {
  const RUN_C = {
    runId: "rn_01M7822PREVIEW0000000001",
    status: "completed",
    costStatus: "upstream",
    costUsd: 0,
    startedAt: "2026-11-18T02:00:00Z",
    endedAt: "2026-11-18T02:11:00Z",
    employeeId: "emp_aaaabbbbcccc",
  };
  const RUN_D = {
    runId: "rn_01M7822PREVIEW0000000002",
    costStatus: "unknown",
    costUsd: null,
  };

  const toggle = (index: number): HTMLButtonElement =>
    document.querySelector(`[data-testid='run-row-toggle-${index}']`) as HTMLButtonElement;
  const preview = (index: number): HTMLElement | null =>
    document.querySelector(`[data-testid='run-row-preview-${index}']`);
  const field = (index: number, key: string): HTMLElement | null =>
    document.querySelector(`[data-testid='run-row-preview-${index}-${key}']`);

  it("expands with values from the row alone and asks nothing more", async () => {
    api.fetchJSON.mockImplementation(okList([RUN_C]));
    await render("/runs");
    await waitFor(() => rowNodes() === 1, "one row");
    const asked = urls().length;
    expect(toggle(0).getAttribute("aria-expanded")).toBe("false");
    expect(preview(0)).toBeNull();
    await act(async () => {
      toggle(0).click();
    });
    expect(toggle(0).getAttribute("aria-expanded")).toBe("true");
    expect(toggle(0).getAttribute("aria-controls")).toBe("run-row-preview-0");
    expect(preview(0)).not.toBeNull();
    expect(field(0, "status")?.textContent).toContain("成功");
    expect(field(0, "started")?.textContent).toContain("2026-11-18 10:00");
    expect(field(0, "ended")?.textContent).toContain("2026-11-18 10:11");
    expect(field(0, "elapsed")?.textContent).toContain("11 分钟");
    expect(field(0, "cost")?.textContent).toContain("$0.00");
    expect(field(0, "employee")?.textContent).toContain("员工 · AAAABBBB");
    expect(field(0, "employee")?.getAttribute("title")).toBe("emp_aaaabbbbcccc");
    expect(urls().length).toBe(asked);
  });

  it("keeps one row open at a time and leaves the address alone", async () => {
    api.fetchJSON.mockImplementation(okList([RUN_C, RUN_D]));
    await render("/runs");
    await waitFor(() => rowNodes() === 2, "two rows");
    const address = document.querySelector("[data-testid='probe-location']")?.textContent;
    if (address !== undefined) expect(address).toBe("/runs");
    await act(async () => {
      toggle(0).click();
    });
    await act(async () => {
      toggle(1).click();
    });
    expect(preview(0)).toBeNull();
    expect(preview(1)).not.toBeNull();
    expect(toggle(0).getAttribute("aria-expanded")).toBe("false");
    expect(toggle(1).getAttribute("aria-expanded")).toBe("true");
    expect(urls().filter((url) => url.includes("/api/runs"))).toHaveLength(1);
  });

  it("closes on Escape and hands focus back to the toggle", async () => {
    api.fetchJSON.mockImplementation(okList([RUN_C]));
    await render("/runs");
    await waitFor(() => rowNodes() === 1, "one row");
    await act(async () => {
      toggle(0).click();
    });
    await act(async () => {
      preview(0)?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(preview(0)).toBeNull();
    expect(document.activeElement).toBe(toggle(0));
  });

  it("names missing fields instead of filling them in", async () => {
    api.fetchJSON.mockImplementation(okList([RUN_D]));
    await render("/runs");
    await waitFor(() => rowNodes() === 1, "one row");
    await act(async () => {
      toggle(0).click();
    });
    expect(field(0, "status")?.textContent).toContain("该字段未返回");
    expect(field(0, "started")?.textContent).toContain("该字段未返回");
    expect(field(0, "ended")?.textContent).toContain("该字段未返回");
    expect(field(0, "elapsed")?.textContent).toContain("—");
    expect(field(0, "elapsed")?.getAttribute("title")).toContain("不拿本机时间补一端");
    expect(field(0, "cost")?.textContent).toContain("—");
    expect(preview(0)?.textContent).not.toContain("$0.00");
    expect(field(0, "employee")?.textContent).toContain("未指派");
  });
});

/* ── list copy as plain text ───────────────────────────────────────── */
describe("runs list copy", () => {
  const COPY_A = {
    runId: "rn_01M7822COPY0000000001",
    status: "completed",
    costStatus: "upstream",
    costUsd: 0,
    startedAt: "2026-11-18T02:00:00Z",
    endedAt: "2026-11-18T02:11:00Z",
    employeeId: "emp_aaaabbbbcccc",
  };
  const COPY_B = {
    runId: "rn_01M7822COPY0000000002",
    status: "running",
    costStatus: "unknown",
    costUsd: null,
    startedAt: "2026-11-18T03:30:00Z",
  };
  const HEADER = "run,status,started,ended,elapsed,cost,employee";
  const LINE_A = "运行 · 0001,成功,2026-11-18 10:00,2026-11-18 10:11,11 分钟,$0.00,员工 · AAAABBBB";
  const LINE_B = "运行 · 0002,运行中,2026-11-18 11:30,—,—,—,未指派";

  const copyButton = (): HTMLButtonElement =>
    document.querySelector("[data-testid='run-list-copy']") as HTMLButtonElement;
  const statusText = (): string =>
    document.querySelector("[data-testid='run-list-copy-status']")?.textContent ?? "";

  afterEach(() => {
    clip.copyTextToClipboard.mockReset();
    clip.copyTextToClipboard.mockImplementation((text: string) => Promise.resolve(Boolean(text)));
  });

  it("copies the rows on screen with a header, and asks the service nothing", async () => {
    api.fetchJSON.mockImplementation(okList([COPY_A, COPY_B]));
    await render("/runs");
    await waitFor(() => rowNodes() === 2, "two rows");
    const asked = urls().length;
    await act(async () => {
      copyButton().click();
    });
    await waitFor(() => statusText().includes("已复制"), "copy done");
    expect(clip.copyTextToClipboard).toHaveBeenCalledTimes(1);
    expect(clip.copyTextToClipboard.mock.calls[0][0]).toBe([HEADER, LINE_A, LINE_B].join("\n"));
    expect(statusText()).toContain("已复制 2 行");
    expect(document.querySelector("[data-testid='run-list-copy-status']")?.getAttribute("aria-live")).toBe("polite");
    expect(urls().length).toBe(asked);
    expect(urls().filter((url) => url.includes("/api/runs"))).toHaveLength(1);
    const text = clip.copyTextToClipboard.mock.calls[0][0] as string;
    expect(text).not.toContain("rn_01M7822COPY");
    expect(text).not.toContain("emp_aaaabbbbcccc");
  });

  it("falls back to a read-only textarea with the same text when the clipboard refuses", async () => {
    clip.copyTextToClipboard.mockImplementation(() => Promise.resolve(false));
    api.fetchJSON.mockImplementation(okList([COPY_A]));
    await render("/runs");
    await waitFor(() => rowNodes() === 1, "one row");
    await act(async () => {
      copyButton().click();
    });
    await waitFor(() => document.querySelector("[data-testid='run-list-copy-fallback-text']") !== null, "fallback");
    const area = document.querySelector("[data-testid='run-list-copy-fallback-text']") as HTMLTextAreaElement;
    expect(area.value).toBe([HEADER, LINE_A].join("\n"));
    expect(area.readOnly).toBe(true);
    expect(statusText()).toContain("复制没成功");
    expect(statusText()).not.toContain("已复制");
  });

  it("disables the button when the list has no rows", async () => {
    api.fetchJSON.mockImplementation(okList([]));
    await render("/runs");
    await waitFor(() => document.querySelector("[data-testid='run-list-copy']") !== null, "copy bar");
    expect(copyButton().disabled).toBe(true);
    expect(copyButton().getAttribute("title")).toContain("没有可复制的文本");
    expect(statusText()).not.toContain("已复制");
  });
});


/* ── list CSV export ───────────────────────────────────────────────── */
describe("runs list CSV export", () => {
  const EXP_A = {
    runId: "rn_01M7822EXPT0000000001",
    status: "completed",
    costStatus: "upstream",
    costUsd: 0,
    startedAt: "2026-11-18T02:00:00Z",
    endedAt: "2026-11-18T02:11:00Z",
    employeeId: "emp_aaaabbbbcccc",
  };
  const EXP_B = {
    runId: "rn_01M7822EXPT0000000002",
    status: "running",
    costStatus: "unknown",
    costUsd: null,
    startedAt: "2026-11-18T03:30:00Z",
  };
  let blobs: Blob[] = [];
  let names: string[] = [];
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  beforeEach(() => {
    blobs = [];
    names = [];
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (blob: Blob) => {
      blobs.push(blob);
      return "blob:runs-export";
    };
    (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });

  const exportButton = (): HTMLButtonElement =>
    document.querySelector("[data-testid='run-list-export']") as HTMLButtonElement;
  const countNode = (): HTMLElement =>
    document.querySelector("[data-testid='run-list-export-count']") as HTMLElement;
  const nameNode = (): HTMLElement =>
    document.querySelector("[data-testid='run-export-name']") as HTMLElement;

  it("exports the same rows, in the same order, and names the file what the preview says", async () => {
    api.fetchJSON.mockImplementation(okList([EXP_A, EXP_B]));
    await render("/runs?window=7d&status=failed");
    await waitFor(() => rowNodes() === 2, "two rows");
    const before = api.fetchJSON.mock.calls.length;
    const preview = nameNode().textContent ?? "";
    expect(preview).toMatch(/^runs-7d-failed-\d{8}-\d{4}\.csv$/);
    expect(countNode().textContent).toContain("2");
    expect(countNode().getAttribute("data-rows")).toBe("2");
    await act(async () => {
      exportButton().click();
    });
    expect(names).toEqual([preview]);
    const text = (await blobs[0].text()).replace(/^\uFEFF/, "");
    expect(text.split("\n")).toEqual([
      "run,status,started,ended,elapsed,cost,employee",
      "运行 · 0001,成功,2026-11-18 10:00,2026-11-18 10:11,11 分钟,0.00,员工 · AAAABBBB",
      "运行 · 0002,运行中,2026-11-18 11:30,,,,未指派",
    ]);
    expect(api.fetchJSON.mock.calls.length).toBe(before);
    expect(document.body.textContent).not.toContain("rn_01M7822EXPT");
  });

  it("quotes a field that carries a comma or a quote", () => {
    const names = new Map([["emp_aaaabbbbcccc", '小鲤, "运营"']]);
    const csv = runListCsv([EXP_A] as never, names);
    const line = csv.split("\n")[1];
    expect(line).toContain('"小鲤, ""运营"" · AAAABBBB"');
  });

  it("uses all when neither window nor status is in the address", () => {
    const name = runCsvFileName(null, null, new Date("2026-11-20T09:30:00Z"));
    expect(name).toBe("runs-all-all-20261120-1730.csv");
    expect(name).toMatch(/^[a-z0-9.-]+$/);
  });

  it("disables the export on an empty list", async () => {
    api.fetchJSON.mockImplementation(okList([]));
    await render("/runs");
    await waitFor(() => exportButton() !== null, "export bar");
    expect(exportButton().disabled).toBe(true);
    expect(exportButton().getAttribute("title")).toContain("没有可导出的 CSV");
  });

  it("disables the export on a failed read with the shared reason", async () => {
    api.fetchJSON.mockImplementation(() =>
      Promise.reject(new ApiError("down", { status: 500, body: "", url: "/api/runs", requestId: "req-exp" })),
    );
    await render("/runs");
    await waitFor(() => exportButton() !== null, "export bar after failure");
    expect(exportButton().disabled).toBe(true);
    expect(exportButton().getAttribute("title")).toContain("先重试");
  });
});

describe("run-state — one answer per phase", () => {
  const q = (id: string): Element | null => document.querySelector(`[data-testid='${id}']`);
  const qs = <T extends Element>(id: string): T | null => document.querySelector(`[data-testid='${id}']`) as T | null;

  it("loading draws the fixed skeleton and the state marker", async () => {
    api.fetchJSON.mockImplementation(() => new Promise(() => undefined));
    await render("/runs");
    await waitFor(() => q("run-state-loading") !== null, "loading marker");
    expect(q("run-state")?.getAttribute("data-phase")).toBe("loading");
    const skeleton = q("run5-loading");
    expect(skeleton?.children.length).toBe(5);
    expect(q("run-list-copy")).toBeNull();
  });

  it("an unfiltered empty answer says the window really was empty", async () => {
    api.fetchJSON.mockImplementation(okList([]));
    await render("/runs");
    await waitFor(() => q("run5-empty") !== null, "empty");
    expect(q("run-state")?.getAttribute("data-phase")).toBe("empty");
    expect(q("run-state-empty-text")?.textContent).toContain("服务回答了");
    expect(q("run-state-clear")).toBeNull();
    const copy = qs<HTMLButtonElement>("run-list-copy");
    expect(copy?.disabled).toBe(true);
    expect(copy?.title).toContain("没有行");
  });

  it("a filtered empty answer explains the filter and clears it", async () => {
    api.fetchJSON.mockImplementation(okList([]));
    await render("/runs?status=failed&window=7d", <><RunsModulePage /><HistoryProbe /></>);
    await waitFor(() => q("run5-empty") !== null, "filtered empty");
    expect(q("run-state-empty-text")?.textContent).toContain("当前筛选下没有运行记录");
    const clear = qs<HTMLButtonElement>("run-state-clear");
    expect(clear).not.toBeNull();
    const before = urls().length;
    await act(async () => {
      clear?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(document.querySelector("[data-testid='probe-location']")?.textContent ?? "").not.toContain("status=");
    const after = urls().slice(before);
    expect(after.every((url) => !url.includes("status="))).toBe(true);
    expect(after.every((url) => url.includes("since="))).toBe(true);
  });

  it("error keeps one retry, copies the request id and asks exactly once more", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      throw new ApiError("no", { status: 500, body: "{}", url, requestId: "req-run-state" });
    });
    await render("/runs?status=failed");
    await waitFor(() => q("run-state-error") !== null, "error");
    expect(q("run-state")?.getAttribute("data-phase")).toBe("error");
    expect(q("run-state-rid")?.textContent).toContain("req-run-state");
    expect(q("run5-counts")?.textContent).toContain("—");
    expect(q("run5-counts")?.getAttribute("title")).toContain("不把读不到当成 0");
    const copy = qs<HTMLButtonElement>("run-list-copy");
    expect(copy?.disabled).toBe(true);
    expect(copy?.title).toContain("先重试");
    const retry = qs<HTMLButtonElement>("run5-error-retry");
    expect(q("run-state-retry")?.getAttribute("data-disabled")).toBe("0");
    const before = urls().length;
    await act(async () => {
      retry?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(urls().length - before).toBe(1);
    expect(q("run5-error")).not.toBeNull();
  });

  it("denied is one body for 403 and 404 and keeps the four filters in the address", async () => {
    const bodyFor = async (status: number): Promise<string> => {
      api.fetchJSON.mockReset();
      api.fetchJSON.mockImplementation(async (url: string) => {
        throw new ApiError("no", { status, body: "{}", url, requestId: "req-denied" });
      });
      await render(
        "/runs?status=failed&window=7d&employee=emp_aaaabbbbcccc",
        <><RunsModulePage /><HistoryProbe /></>,
      );
      await waitFor(() => q("run5-denied") !== null, `denied ${status}`);
      return q("run5-denied")?.textContent ?? "";
    };
    const first = await bodyFor(403);
    const second = await bodyFor(404);
    expect(first).toBe(second);
    expect(q("run-state")?.getAttribute("data-phase")).toBe("denied");
    expect(q("run-state-denied")).not.toBeNull();
    const loc = document.querySelector("[data-testid='probe-location']")?.textContent ?? "";
    expect(loc).toContain("status=failed");
    expect(loc).toContain("window=7d");
    expect(loc).toContain("employee=emp_aaaabbbbcccc");
    const copy = qs<HTMLButtonElement>("run-list-copy");
    expect(copy?.disabled).toBe(true);
    expect(copy?.title).toContain("看不到");
  });
});

/* ── shareable filter source ───────────────────────────────────────── */
describe("runs filter source", () => {
  const pathNode = (): HTMLElement => document.querySelector("[data-testid='run-source-path']") as HTMLElement;
  const copyButton = (): HTMLButtonElement => document.querySelector("[data-testid='run-filter-copy']") as HTMLButtonElement;
  const copyBody = (): string => {
    const calls = clip.copyTextToClipboard.mock.calls;
    return calls.length ? String(calls[calls.length - 1][0]) : "";
  };
  const runsCalls = (): number =>
    api.fetchJSON.mock.calls.filter(([url]) => String(url).includes("/api/runs")).length;
  const windowSelect = (): HTMLSelectElement =>
    document.querySelector("[data-testid='run5-filter-window']") as HTMLSelectElement;
  const statusSelect = (): HTMLSelectElement =>
    document.querySelector("[data-testid='run5-filter-status']") as HTMLSelectElement;

  afterEach(() => {
    clip.copyTextToClipboard.mockReset();
    clip.copyTextToClipboard.mockImplementation((text: string) => Promise.resolve(Boolean(text)));
  });

  it("shows the effective values and reads them back with the same query", async () => {
    api.fetchJSON.mockImplementation(okList([RUN_A]));
    await render("/runs?window=30d&status=failed&employee=emp_aaaabbbbcccc");
    await waitFor(() => pathNode() !== null, "source line");
    expect(pathNode().textContent).toBe("/runs?window=30d&status=failed&employee=emp_aaaabbbbcccc");
    expect(windowSelect().value).toBe("30d");
    expect(statusSelect().value).toBe("failed");
    const asked = api.fetchJSON.mock.calls.map(([url]) => String(url)).find((url) => url.includes("/api/runs")) ?? "";
    expect(asked).toContain("status=failed");
    expect(asked).toContain("employeeId=emp_aaaabbbbcccc");
    await act(async () => {
      copyButton().click();
    });
    expect(copyBody()).toBe("/runs?window=30d&status=failed&employee=emp_aaaabbbbcccc");
    expect(document.querySelector("[data-testid='run-filter-copy-status']")?.textContent).toContain("已复制筛选条件");
  });

  it("says there is no filter instead of inventing one", async () => {
    api.fetchJSON.mockImplementation(okList([RUN_A]));
    await render("/runs");
    await waitFor(() => pathNode() !== null, "source line");
    expect(pathNode().textContent).toBe("/runs");
    expect(document.querySelector("[data-testid='run-source-none']")?.textContent).toContain("未设置筛选");
    await act(async () => {
      copyButton().click();
    });
    expect(copyBody()).toBe("/runs");
  });

  it("names an unrecognised address value instead of rewriting it silently", async () => {
    api.fetchJSON.mockImplementation(okList([RUN_A]));
    await render(
      "/runs?window=zz&status=zz&state=zz",
      <>
        <RunsModulePage />
        <HistoryProbe />
      </>,
    );
    await waitFor(() => pathNode() !== null, "source line");
    const notes = Array.from(document.querySelectorAll("[data-testid='run-source-note']")).map((n) => n.textContent ?? "");
    expect(notes.some((n) => n.includes("时间范围「zz」未识别") && n.includes("近 7 天"))).toBe(true);
    expect(notes.some((n) => n.includes("状态「zz」未识别"))).toBe(true);
    expect(notes.some((n) => n.includes("预览参数「zz」未识别"))).toBe(true);
    expect(windowSelect().value).toBe("7d");
    expect(statusSelect().value).toBe("");
    expect(document.querySelector("[data-testid='probe-location']")?.textContent).toContain("window=zz");
  });

  it("asks exactly once when a control changes", async () => {
    api.fetchJSON.mockImplementation(okList([RUN_A]));
    await render("/runs");
    await waitFor(() => runsCalls() === 1, "first read");
    await act(async () => {
      windowSelect().value = "24h";
      windowSelect().dispatchEvent(new Event("change", { bubbles: true }));
    });
    await waitFor(() => runsCalls() === 2, "one more read");
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(runsCalls()).toBe(2);
  });

  it("falls back to a read-only textarea when the clipboard refuses", async () => {
    clip.copyTextToClipboard.mockImplementation(() => Promise.resolve(false));
    api.fetchJSON.mockImplementation(okList([RUN_A]));
    await render("/runs?status=running");
    await waitFor(() => pathNode() !== null, "source line");
    await act(async () => {
      copyButton().click();
    });
    const fallback = document.querySelector("[data-testid='run-filter-copy-fallback-text']") as HTMLTextAreaElement;
    expect(fallback).not.toBeNull();
    expect(fallback.value).toBe("/runs?status=running");
    expect(fallback.readOnly).toBe(true);
  });
});

/* ── column sorting (client-side) ──────────────────────────────────── */
describe("runs list column sorting", () => {
  const S_EARLY = {
    runId: "rn_01M7822SORT0000000001",
    status: "failed",
    costStatus: "upstream",
    costUsd: 0.5,
    startedAt: "2026-11-18T02:00:00Z",
    endedAt: "2026-11-18T04:00:00Z",
    employeeId: "emp_aaaabbbbcccc",
  };
  const S_LATE = {
    runId: "rn_01M7822SORT0000000002",
    status: "completed",
    costStatus: "upstream",
    costUsd: 2,
    startedAt: "2026-11-18T03:00:00Z",
    endedAt: "2026-11-18T03:10:00Z",
    employeeId: "emp_ddddeeeeffff",
  };
  const S_OPEN = {
    runId: "rn_01M7822SORT0000000003",
    status: "running",
    costStatus: "unknown",
    costUsd: null,
    startedAt: "2026-11-18T04:00:00Z",
  };
  const ALL = [S_EARLY, S_LATE, S_OPEN];

  const sortBtn = (key: string): HTMLButtonElement =>
    document.querySelector(`[data-testid='run-sort-${key}']`) as HTMLButtonElement;
  const header = (key: string): HTMLElement =>
    sortBtn(key).parentElement as HTMLElement;
  const codesInBody = (): string[] =>
    Array.from(document.querySelectorAll("[data-testid^='run5-row-'][data-status]"))
      .map((el) => el.querySelector("[data-testid$='-code']")?.textContent ?? "");

  it("sorts inside the loaded page and writes rsort/rdir without dropping the filters", async () => {
    api.fetchJSON.mockImplementation(okList(ALL));
    await render("/runs?window=30d&status=failed&employee=emp_aaaabbbbcccc", <><RunsModulePage /><HistoryProbe /></>);
    await waitFor(() => rowNodes() === 3, "three rows");
    expect(sortBtn("started").tagName).toBe("BUTTON");
    expect((sortBtn("started") as HTMLButtonElement).type).toBe("button");
    expect(header("started").getAttribute("aria-sort")).toBe("none");
    const calls = api.fetchJSON.mock.calls.length;

    await act(async () => {
      sortBtn("started").click();
    });
    expect(header("started").getAttribute("aria-sort")).toBe("descending");
    expect(header("status").getAttribute("aria-sort")).toBe("none");
    const loc = document.querySelector("[data-testid='probe-location']")?.textContent ?? "";
    expect(loc).toContain("rsort=started");
    expect(loc).toContain("rdir=desc");
    expect(loc).toContain("window=30d");
    expect(loc).toContain("status=failed");
    expect(loc).toContain("employee=emp_aaaabbbbcccc");
    expect(codesInBody()[0]).toContain("0003");

    await act(async () => {
      sortBtn("started").click();
    });
    expect(header("started").getAttribute("aria-sort")).toBe("ascending");
    expect(codesInBody()[0]).toContain("0001");
    expect(api.fetchJSON.mock.calls.length).toBe(calls);
    expect(document.querySelector("[data-testid='run-sort-scope-note']")?.textContent).toContain(
      "仅在当前已加载 3 行内排序",
    );
  });

  it("keeps rows without a reading at the bottom in both directions", async () => {
    api.fetchJSON.mockImplementation(okList(ALL));
    await render("/runs?rsort=cost&rdir=asc");
    await waitFor(() => rowNodes() === 3, "three rows");
    expect(codesInBody().at(-1)).toContain("0003");
    await act(async () => {
      sortBtn("cost").click();
    });
    expect(header("cost").getAttribute("aria-sort")).toBe("descending");
    expect(codesInBody()[0]).toContain("0002");
    expect(codesInBody().at(-1)).toContain("0003");
  });

  it("has no sorting control outside the ready phase", async () => {
    api.fetchJSON.mockImplementation(() =>
      Promise.reject(new ApiError("down", { status: 500, body: "", url: "/api/runs", requestId: "req-sort" })),
    );
    await render("/runs");
    await waitFor(() => document.querySelector("[data-testid='run-state']")?.getAttribute("data-phase") === "error", "error state");
    expect(document.querySelector("[data-testid='run-sort-started']")).toBeNull();
    expect(document.querySelector("[data-testid='run-sort-scope-note']")).toBeNull();
  });

  it("keeps copy and CSV in the same order as the sorted table", async () => {
    api.fetchJSON.mockImplementation(okList(ALL));
    await render("/runs?rsort=cost&rdir=desc");
    await waitFor(() => rowNodes() === 3, "three rows");
    const body = codesInBody();
    await act(async () => {
      (document.querySelector("[data-testid='run-list-copy']") as HTMLButtonElement).click();
    });
    const copied = clip.copyTextToClipboard.mock.calls.at(-1)?.[0] ?? "";
    const copyLines = copied.split("\n").slice(1).map((line: string) => line.split(",")[0]);
    expect(copyLines).toEqual(body);
    const blobs: Blob[] = [];
    const original = URL.createObjectURL;
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (blob: Blob) => {
      blobs.push(blob);
      return "blob:sort";
    };
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await act(async () => {
      (document.querySelector("[data-testid='run-list-export']") as HTMLButtonElement).click();
    });
    const csv = (await blobs[0].text()).replace(/^\uFEFF/, "").split("\n");
    expect(csv.slice(1).map((line) => line.split(",")[0])).toEqual(body);
    clickSpy.mockRestore();
    URL.createObjectURL = original;
  });
});

/* ── preview ↔ detail parity ─────────────────────────────────────────── */
describe("runs preview and detail parity", () => {
  const PAR = {
    runId: "rn_01M7822PARITY000000001",
    status: "completed",
    costStatus: "upstream",
    costUsd: 2.5,
    startedAt: "2026-11-18T02:00:00Z",
    endedAt: "2026-11-18T02:11:00Z",
    employeeId: "emp_aaaabbbbcccc",
  };
  const PAR_BARE = {
    runId: "rn_01M7822PARITY000000002",
    startedAt: "2026-11-18T04:00:00Z",
  };

  const parityMock = (row: unknown) => async (url: string): Promise<unknown> => {
    if (url.includes("/api/run-detail")) return { ...(row as object) };
    if (url.includes("/api/run-events")) return { items: [], hasMore: false };
    if (url.includes("/api/employees")) return { items: [] };
    if (url.includes("/api/run-stats")) return { items: [] };
    if (url.includes("/api/runs")) return { items: [row] };
    return { items: [] };
  };

  const previewText = (index: number, key: string): string =>
    document.querySelector(`[data-testid='run-row-preview-${index}-${key}'] dd`)?.textContent ?? "";
  const detailText = (): string =>
    document.querySelector("[data-testid='run5-detail']")?.textContent ?? "";

  async function openBoth(): Promise<void> {
    await waitFor(() => rowNodes() === 1, "row ready");
    await waitFor(() => document.querySelector("[data-testid='run5-detail']") !== null, "detail ready");
    await act(async () => {
      (document.querySelector("[data-testid='run-row-toggle-0']") as HTMLButtonElement).click();
    });
  }

  it("reads the same six values on the row preview and in the detail", async () => {
    api.fetchJSON.mockImplementation(parityMock(PAR));
    await render(`/runs?run=${encodeURIComponent(PAR.runId)}`);
    await openBoth();
    const detail = detailText();
    const fields = ["status", "started", "ended", "elapsed", "cost", "employee"];
    for (const key of fields) {
      const value = previewText(0, key);
      expect(value.length).toBeGreaterThan(0);
      expect(detail).toContain(value);
    }
    expect(previewText(0, "started")).toBe("2026-11-18 10:00");
    expect(previewText(0, "ended")).toBe("2026-11-18 10:11");
    expect(previewText(0, "elapsed")).toBe("11 分钟");
    expect(previewText(0, "employee")).toBe("员工 · AAAABBBB");
    expect(document.querySelector("[data-testid='run5-detail-ended']")?.textContent).toBe("2026-11-18 10:11");
    expect(document.querySelector("[data-testid='run5-detail-employee']")?.textContent).toBe("员工 · AAAABBBB");
  });

  it("says the same sentence when a field is missing, and never fills the gap", async () => {
    api.fetchJSON.mockImplementation(parityMock(PAR_BARE));
    await render(`/runs?run=${encodeURIComponent(PAR_BARE.runId)}`);
    await openBoth();
    expect(previewText(0, "status")).toBe("该字段未返回");
    expect(previewText(0, "ended")).toBe("该字段未返回");
    expect(document.querySelector("[data-testid='run5-detail-ended']")?.textContent).toBe("该字段未返回");
    expect(detailText()).toContain("该字段未返回");
    expect(previewText(0, "elapsed")).toBe("—");
    expect(document.querySelector("[data-testid='run5-detail-summary']")?.textContent).toContain("耗时 —");
    expect(previewText(0, "employee")).toBe("未指派");
    expect(document.querySelector("[data-testid='run5-detail-employee']")?.textContent).toBe("未指派");
    expect(detailText()).not.toContain("$0.00");
  });

  it("the preview adds no read while the detail is read exactly once", async () => {
    api.fetchJSON.mockImplementation(parityMock(PAR));
    await render(`/runs?run=${encodeURIComponent(PAR.runId)}`);
    await openBoth();
    const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
    const before = urls().length;
    await act(async () => {
      (document.querySelector("[data-testid='run-row-toggle-0']") as HTMLButtonElement).click();
    });
    await act(async () => {
      (document.querySelector("[data-testid='run-row-toggle-0']") as HTMLButtonElement).click();
    });
    expect(urls()).toHaveLength(before);
    expect(urls().filter((u) => u.includes("/api/run-detail"))).toHaveLength(1);
    expect(urls().filter((u) => u.includes("/api/run-events"))).toHaveLength(1);
  });
});

describe("run-cost-caliber-note — cross-page cost caliber", () => {
  it("prints the one shared sentence and points at the metrics page", async () => {
    api.fetchJSON.mockImplementation(okList([RUN_A]));
    await render("/runs");
    const note = document.querySelector("[data-testid='run-cost-caliber-note']");
    expect(note).not.toBeNull();
    expect(note?.textContent).toBe(COST_CALIBER_TEXT);
    const title = note?.getAttribute("title") ?? "";
    expect(title).toContain("/runs");
    expect(title).toContain("/metrics");
    // 静态说明：挂上页面不再追加任何读口。
    const reads = api.fetchJSON.mock.calls.filter((call) => String(call[0]).includes("/api/runs"));
    expect(reads).toHaveLength(1);
  });
});

describe("run-notes — footer caliber block", () => {
  it("starts collapsed and opens seven rows of one sentence each", async () => {
    api.fetchJSON.mockImplementation(okList([RUN_A]));
    await render("/runs");
    const toggle = document.querySelector("[data-testid='run-notes-toggle']") as HTMLButtonElement | null;
    expect(toggle).not.toBeNull();
    expect(toggle?.tagName).toBe("BUTTON");
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(toggle?.getAttribute("aria-controls")).toBe("run-notes-body");
    expect(document.querySelector("[data-testid='run-notes-body']")).toBeNull();
    expect(document.querySelector("[data-testid='run-note-window']")).toBeNull();

    await act(async () => {
      toggle?.click();
    });
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelectorAll("[data-testid^='run-note-']").length).toBe(7);
    const cost = document.querySelector("[data-testid='run-note-cost']")?.textContent ?? "";
    // 成本行与屏上的成本口径说明共用同一常量，不存在第二套措辞。
    expect(cost).toContain(COST_CALIBER_TEXT);
    expect(document.querySelector("[data-testid='run-note-elapsed']")?.textContent ?? "").toContain("不拿本机时间补");
    expect(document.querySelector("[data-testid='run-note-asOf']")?.textContent ?? "").toContain("不拿本机时间顶替");
    expect(document.querySelector("[data-testid='run-note-window']")?.textContent ?? "").toContain("/api/runs");
    expect(document.querySelector("[data-testid='run-note-state']")?.textContent ?? "").toContain("不读写口");

    await act(async () => {
      toggle?.click();
    });
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector("[data-testid='run-notes-body']")).toBeNull();
  });

  it("asks the service for nothing when opened or closed", async () => {
    api.fetchJSON.mockImplementation(okList([RUN_A]));
    await render("/runs");
    const before = urls().length;
    const readsBefore = api.fetchJSON.mock.calls.filter((call) => String(call[0]).includes("/api/runs")).length;
    const toggle = document.querySelector("[data-testid='run-notes-toggle']") as HTMLButtonElement;
    await act(async () => {
      toggle.click();
    });
    await act(async () => {
      toggle.click();
    });
    expect(urls().length).toBe(before);
    expect(api.fetchJSON.mock.calls.filter((call) => String(call[0]).includes("/api/runs")).length).toBe(readsBefore);
  });

  it("is absent on the repro legs, which read nothing", async () => {
    api.fetchJSON.mockImplementation(async () => {
      throw new Error("repro legs ask nothing");
    });
    await render("/runs?state=error");
    expect(document.querySelector("[data-testid='run-notes']")).toBeNull();
  });
});

/* ── the row permalink (frozen URL shape, no extra read) ──────────── */

describe("run permalink", () => {
  it("copies the open run's link with every current parameter kept", async () => {
    api.fetchJSON.mockImplementation(detailOk({}));
    const entry = `/runs/?window=7d&status=failed&rsort=started&rdir=desc&run=${encodeURIComponent(DETAIL.runId)}`;
    await render(entry);
    await waitFor(() => document.querySelector("[data-testid='run5-detail']") !== null, "detail");
    await waitFor(() => rowNodes() === 1, "one row");
    // The address reproduces this page: the same row is marked and its detail is open.
    const row = document.querySelector("[data-testid='run5-row-0']");
    expect(row?.getAttribute("data-selected")).toBe("1");
    expect(row?.getAttribute("aria-current")).toBe("true");
    const before = urls().length;
    const reads = api.fetchJSON.mock.calls.filter((call) => String(call[0]).includes("/api/runs")).length;
    const button = document.querySelector("[data-testid='run-permalink']") as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    await act(async () => {
      button.click();
    });
    const copied = clip.copyTextToClipboard.mock.calls.at(-1)?.[0] as string;
    expect(copied).toBe(
      `/runs/?window=7d&status=failed&rsort=started&rdir=desc&run=${encodeURIComponent(DETAIL.runId)}`,
    );
    expect(copied.startsWith("/runs/?")).toBe(true);
    expect(document.querySelector("[data-testid='run-permalink-status']")?.textContent).toContain("链接已复制");
    expect(urls().length).toBe(before);
    expect(api.fetchJSON.mock.calls.filter((call) => String(call[0]).includes("/api/runs")).length).toBe(reads);
  });

  it("is disabled with a reason until a run is selected", async () => {
    api.fetchJSON.mockImplementation(okList([RUN_A]));
    await render("/runs?window=7d");
    await waitFor(() => rowNodes() === 1, "one row");
    const button = document.querySelector("[data-testid='run-permalink']") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("title")).toBe("先选中一条运行再复制");
    const before = urls().length;
    const copies = clip.copyTextToClipboard.mock.calls.length;
    await act(async () => {
      button.click();
    });
    expect(clip.copyTextToClipboard.mock.calls.length).toBe(copies);
    expect(urls().length).toBe(before);
  });

  it("hands the same string to a read-only field when the clipboard refuses", async () => {
    clip.copyTextToClipboard.mockImplementationOnce(() => Promise.resolve(false));
    api.fetchJSON.mockImplementation(detailOk({}));
    await render(`/runs/?window=7d&run=${encodeURIComponent(DETAIL.runId)}`);
    await waitFor(() => document.querySelector("[data-testid='run5-detail']") !== null, "detail");
    const button = document.querySelector("[data-testid='run-permalink']") as HTMLButtonElement;
    await act(async () => {
      button.click();
    });
    const fallback = document.querySelector("[data-testid='run-permalink-fallback-text']") as HTMLTextAreaElement;
    expect(fallback).toBeTruthy();
    expect(fallback.readOnly).toBe(true);
    expect(fallback.value).toBe(
      `/runs/?window=7d&run=${encodeURIComponent(DETAIL.runId)}`,
    );
    expect(document.querySelector("[data-testid='run-permalink-status']")?.textContent).toContain("没复制成功");
  });

  it("stays off the repro legs, which read nothing", async () => {
    api.fetchJSON.mockImplementation(async () => {
      throw new Error("repro legs ask nothing");
    });
    await render("/runs?state=empty");
    expect(document.querySelector("[data-testid='run-permalink']")).toBeNull();
  });
});
