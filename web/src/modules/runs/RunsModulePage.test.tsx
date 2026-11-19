// @vitest-environment jsdom
// T15 (PRD v4.1) list page. The assertions are about what a person can check
// with their eyes: the real BFF routes are the ones asked (the `/api/`
// segment included), rows only ever come from an answer, 403 and 404 draw one
// identical body with no row above it, the filters change what is asked, and
// a `?state=` repro asks for nothing at all.

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
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
    expect(urls()[1]).toContain("/agent-api/api/run-stats?");
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
    api.fetchJSON.mockImplementation(() => new Promise((r) => { resolveList = r; }));
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
      const panel = document.querySelector(`[data-testid='run5-${state === "loading" ? "loading" : state}']`);
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
