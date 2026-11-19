// @vitest-environment jsdom
// T11 — 用量与成本（账本唯一金额源）。断言的是屏幕上的话：三个窗口各自发出
// 各自的 `days` 参数；金额只照账本原文呈现——真实 0 是 `$0.00`，缺失是「—」
// 并写明原因，含估算与非账本来源绝不伪装成已花费；原始句柄与 ISO 只进 title
// 与折叠的「技术详情」；四态由服务的回答驱动，403 与 404 逐字同体且上面
// 不留一行数据；`?state=` 复现腿带 data-fixture 与 GAP-07 且不发请求。

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import { UsagePage } from "./UsagePage";

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
const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const skeleton = (): boolean => document.querySelector(".animate-pulse") !== null;
const el = (testId: string): Element | null => document.querySelector(`[data-testid='${testId}']`);

async function pickWindow(key: string): Promise<void> {
  const select = el("usg4-window") as HTMLSelectElement | null;
  expect(select).toBeTruthy();
  await act(async () => {
    select!.value = key;
    select!.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await waitFor(() => !skeleton(), `settled after window ${key}`);
}

/** A full honest answer: ledger totals, one true zero, one unpriced row. */
const LEDGER_ANSWER = {
  period_days: 30,
  tokens: { total_input: 1234567, total_output: 45678, total_cache_read: 90000 },
  by_model: [
    { model: "claude-sonnet-4", input_tokens: 1234567, output_tokens: 45678 },
    { model: "vector-embed", input_tokens: null },
  ],
  cost: {
    source: "cost_ledger",
    cost_usd: 1284.42,
    cost_status: "upstream",
    rows: 418,
    per_employee: [
      { employee_id: "employee:1a2b3c4d5e6f7081", cost_usd: 21.05, cost_status: "upstream", rows: 90 },
      { employee_id: "employee:9f8e7d6c5b4a3f21", cost_usd: 0, cost_status: "upstream", rows: 12 },
      { employee_id: "employee:0011223344556677", cost_status: "unknown", rows: 4 },
      { employee_id: "employee:deadbeefcafe0001", cost_usd: 8.4, cost_status: "upstream" },
    ],
  },
  as_of: "2026-11-19T01:20:00Z",
};

async function mount(handler: (url: string) => Promise<unknown>, entry = "/overview?tab=usage"): Promise<void> {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(handler);
  await render(entry, <UsagePage />);
  await waitFor(() => !skeleton(), "state settled");
}

const ok = (body: unknown) => async (): Promise<unknown> => Promise.resolve(body);

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

describe("the window filter really moves the request", () => {
  it("asks the ledger route with days=30 by default, /api/ segment included", async () => {
    await mount(ok(LEDGER_ANSWER));
    expect(urls()[0]).toBe("/agent-api/api/hermes-usage?days=30");
    expect(el("usg4-page")).toBeTruthy();
    expect(text()).toContain("最近 30 天");
  });

  it("24h and 7d each rebuild the URL with their own days parameter", async () => {
    await mount(ok(LEDGER_ANSWER));
    await pickWindow("24h");
    expect(urls()).toContain("/agent-api/api/hermes-usage?days=1");
    await pickWindow("7d");
    expect(urls()).toContain("/agent-api/api/hermes-usage?days=7");
    // three windows, three distinct requests, and the pane still renders
    expect(new Set(urls()).size).toBe(3);
    expect(el("usg4-cost")).toBeTruthy();
  });
});

describe("money comes only from the ledger", () => {
  it("shows ledger numbers verbatim and a true zero as $0.00", async () => {
    await mount(ok(LEDGER_ANSWER));
    expect(el("usg4-cost-total")?.textContent).toContain("$1,284.42");
    expect(text()).toContain("$21.05");
    expect(text()).toContain("$0.00");
    expect(text()).toContain("418 条账目");
  });

  it("an estimated total never presents as spent money", async () => {
    await mount(
      ok({
        tokens: { total_input: 5 },
        cost: { source: "cost_ledger", cost_usd: 999.99, cost_status: "estimated", rows: 3 },
      }),
    );
    expect(text()).not.toContain("$999.99");
    expect(el("usg4-cost-total")?.textContent).toContain("—");
    expect(el("usg4-cost-total")?.textContent).toContain("估算");
  });

  it("a missing amount is 「—」 with a reason beside it, never $0.00", async () => {
    await mount(ok({ tokens: { total_input: 5 }, cost: { source: "cost_ledger", cost_status: "upstream", rows: 2 } }));
    const total = el("usg4-cost-total");
    expect(total?.textContent).toContain("—");
    expect(total?.textContent).toContain("账本未提供金额");
    expect(text()).not.toContain("$0.00");
  });

  it("an unpriced ledger row is 「—」 with its reason in the cell title", async () => {
    await mount(ok(LEDGER_ANSWER));
    const cell = el("usg4-ledger-money-2");
    expect(cell?.textContent).toBe("—");
    expect(cell?.getAttribute("title")).toContain("账本记为未计价");
  });

  it("a row count that was not sent reads 「—」 with its reason in the title", async () => {
    await mount(ok(LEDGER_ANSWER));
    expect(el("usg4-ledger")?.querySelector('[title*="账目条数未随回答发送"]')).toBeTruthy();
    expect(text()).not.toContain("条账目显示为 0");
  });

  it("non-ledger sources are withheld from the money layer", async () => {
    await mount(
      ok({
        tokens: { total_input: 1 },
        cost: { source: "unit_price_table", cost_usd: 77, cost_status: "upstream", rows: 1 },
      }),
    );
    expect(text()).not.toContain("$77.00");
    expect(el("usg4-cost-total")?.textContent).toContain("不是成本账本");
  });
});

describe("no engineering language on the screen", () => {
  it("renders Beijing minutes, masked handles; raws only in title and details", async () => {
    await mount(ok(LEDGER_ANSWER));
    expect(text()).toContain("2026-11-19 09:20");
    expect(text()).not.toContain("2026-11-19T01:20:00Z");
    expect(text()).not.toContain("employee:1a2b3c4d5e6f7081");
    expect(text()).toContain("员工 · 1A2B3C4D");
    for (const leak of ["undefined", "NaN", "cost_usd", "upstream", "HTTP", "cost_ledger"]) {
      expect(text(), leak).not.toContain(leak);
    }
    // the raw handle lives where it belongs
    expect(el("usg4-ledger")?.querySelector('[title*="employee:"]')).toBeTruthy();
    // closed 技术详情 is absent from the DOM
    expect(el("usg4-details")?.querySelector("ul")).toBeNull();
  });
});

describe("the four states", () => {
  it("loading is a skeleton, not a row of zeros", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(() => new Promise(() => {}));
    await render("/overview?tab=usage", <UsagePage />);
    expect(el("usg4-loading")).toBeTruthy();
    expect(el("usg4-cost")).toBeNull();
    expect(text()).not.toContain("$0.00");
  });

  it("empty explains itself and names the window it speaks for", async () => {
    await mount(ok({}));
    expect(el("usg4-empty")).toBeTruthy();
    expect(text()).toContain("最近 30 天");
    expect(text()).toContain("不代表读取失败");
    expect(text()).toContain("换一个更长的统计窗口");
    expect(el("usg4-token-input")).toBeNull();
  });

  it("an answer that is not usage data is a failure, not an empty ledger", async () => {
    await mount(async () => "not a usage object" as unknown);
    expect(el("usg4-error")).toBeTruthy();
    expect(text()).toContain("不是一份用量数据");
  });

  it("error speaks human words, carries a copyable request id, and retries", async () => {
    await mount(() =>
      Promise.reject(
        new ApiError("boom", {
          status: 500,
          body: "{}",
          url: "/agent-api/api/hermes-usage?days=30",
          requestId: "req-usg-77",
        }),
      ),
    );
    expect(el("usg4-error")).toBeTruthy();
    expect(text()).toContain("req-usg-77");
    expect(text()).toContain("复制");
    expect(text()).not.toContain("HTTP 500");
    const retry = el("usg4-retry") as HTMLButtonElement | null;
    expect(retry?.disabled).toBe(false);
    await act(async () => {
      retry?.click();
    });
    expect(urls().length).toBeGreaterThanOrEqual(2);
  });

  it("an error with no request id says 「未提供」 and why", async () => {
    await mount(() =>
      Promise.reject(
        new ApiError("boom", { status: 500, body: "{}", url: "/agent-api/api/hermes-usage?days=30" }),
      ),
    );
    expect(el("usg4-error-request-id-value-absent")?.textContent).toContain("未提供");
    expect(el("usg4-error-request-id-value-absent")?.getAttribute("title")).toContain("未记录编号");
  });

  it("403 and 404 draw one identical body with no rows above it", async () => {
    const deniedWith = (status: number) => () =>
      Promise.reject(
        new ApiError("nope", {
          status,
          body: status === 403 ? '{"code":"console.forbidden"}' : '{"code":"console.not_found"}',
          url: "/agent-api/api/hermes-usage?days=30",
          requestId: "deny-req",
        }),
      );
    await mount(deniedWith(403));
    const forbidden = el("usg4-denied")?.outerHTML ?? "";
    expect(forbidden).toContain("deny-req");
    await mount(deniedWith(404));
    expect(el("usg4-denied")?.outerHTML).toBe(forbidden);
    for (const leaked of ["console.not_found", "console.forbidden", "HTTP"]) {
      expect(text(), leaked).not.toContain(leaked);
    }
    expect(el("usg4-cost")).toBeNull();
    expect(el("usg4-model-table")).toBeNull();
    expect(el("usg4-ledger")).toBeNull();
  });
});

describe("the ?state= repro legs", () => {
  for (const state of ["loading", "empty", "error", "denied"] as const) {
    it(`?state=${state} reproduces without a request and marks itself`, async () => {
      const entry = `/overview?tab=usage&state=${state}`;
      if (state === "loading") {
        // the repro leg stays a skeleton on purpose; skip the settle wait
        api.fetchJSON.mockReset();
        api.fetchJSON.mockImplementation(ok(LEDGER_ANSWER));
        await render(entry, <UsagePage />);
      } else {
        await mount(ok(LEDGER_ANSWER), entry);
      }
      expect(urls()).toHaveLength(0);
      expect(el("usg4-page")?.getAttribute("data-fixture")).toBe(state);
      expect(text()).toContain(`?state=${state}`);
      expect(text()).toContain("GAP-07");
      expect((el("usg4-reload") as HTMLButtonElement | null)?.disabled).toBe(true);
      expect((el("usg4-window") as HTMLSelectElement | null)?.disabled).toBe(true);
      expect(el(`usg4-${state}`)).toBeTruthy();
    });
  }

  it("ready cannot be forged: without a known state the page does fetch", async () => {
    await mount(ok(LEDGER_ANSWER), "/overview?tab=usage&state=ready");
    expect(urls()).toHaveLength(1);
    expect(el("usg4-page")?.getAttribute("data-fixture")).toBeNull();
  });
});

describe("test hygiene", () => {
  it("every testid on the ready screen wears the usg4- prefix", async () => {
    await mount(ok(LEDGER_ANSWER));
    const ids = Array.from(document.querySelectorAll("[data-testid]")).map((node) =>
      node.getAttribute("data-testid"),
    );
    expect(ids.length).toBeGreaterThan(8);
    for (const id of ids) expect(id?.startsWith("usg4-")).toBe(true);
  });
});
