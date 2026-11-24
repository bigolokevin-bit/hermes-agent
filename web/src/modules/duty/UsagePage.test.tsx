// @vitest-environment jsdom
// T11 — 用量与成本（账本唯一金额源 · 骨架卡式密度版）。断言的是屏幕上的话：
// 三个统计窗口各自主读口发出各自的 `days` 参数（趋势腿与近 24 小时腿不随窗口
// 重发）；金额只照账本原文呈现——真实 0 是 `$0.00`，缺失是「—」并写明原因，
// 含估算与非账本来源绝不伪装成已花费；原始句柄与 ISO 只进 title 与折叠的
// 「技术详情」；四态由主读口的回答驱动，403 与 404 逐字同体且上面不留一行
// 数据；`?state=` 复现腿一条请求都不发。骨架对位新增：近 7 天北京日窗趋势
// （to>from、缺读数日断口不插值）、投影去向的 sources 状态词上正文、
// workbench 计数替代指标（金额类 KPI 不上这张卡）、卡式密度 ≥4 张卡。

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import { pickOption } from "@/shell/selectHarness";
import { USAGE_WINDOWS } from "./usage";
import { beijingDayWindow } from "./usageTrend";
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
const usageUrls = (): string[] => urls().filter((url) => url.includes("/hermes-usage"));
const skeleton = (): boolean => document.querySelector(".animate-pulse") !== null;
const el = (testId: string): Element | null => document.querySelector(`[data-testid='${testId}']`);
const cards = (): number => document.querySelectorAll(".console-card").length;

async function pickWindow(key: string): Promise<void> {
  // The window control is a hand-drawn listbox: pick the option by its label,
  // the same path a keyboard user takes.
  const label = USAGE_WINDOWS.find((item) => item.key === key)?.label ?? key;
  await pickOption("usg4-window", label);
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

/** 近 24 小时腿：账本块之外还带读口状态与归属实测（真实回答的形制）。 */
const NEARDAY_ANSWER = {
  ...LEDGER_ANSWER,
  period_days: 1,
  sources: {
    dashboard_usage: { state: "ok" },
    gateway_sessions: { state: "degraded", reason: "timeout" },
    cost_ledger: { state: "ok", source: "cost_ledger" },
  },
  attribution: {
    state: "ok",
    note: "Hermes 会话无 tenant/employee，未经 agent_run 映射统一归未归属，绝不猜",
    mapped_sessions: 86,
    unattributed: {
      sessions: 36,
      tokens: { total_input: 444737, total_output: 7348, total_cache_read: 338740 },
    },
  },
};

/** 趋势腿：北京日窗 7 槽里只回 6 个桶，其中一天只有成本没有运行数。 */
const week = beijingDayWindow(7);
const RUN_STATS_ANSWER = {
  asOf: "2026-11-19T23:59:00Z",
  buckets: week.slots.slice(0, 6).map((slot, index) =>
    index === 5
      ? { bucketStart: `${slot.key}T00:00:00+08:00`, cost_usd: 9.6 }
      : { bucketStart: `${slot.key}T00:00:00+08:00`, runs: 50 + index, cost_usd: 10 + index },
  ),
  totals: { runs: 325, costUsd: 65.1 },
};

const SUMMARY_ANSWER = {
  asOf: "2026-11-19T23:59:00Z",
  kpis: [
    { key: "runs", label: "运行", value: 128, available: true },
    { key: "failed", label: "失败", value: 3, available: true },
    { key: "costUsd", label: "成本", value: 5, available: true },
  ],
};

/** 按路由分发的诚实回答：每条腿各回各的块。 */
async function routeAnswer(url: string): Promise<unknown> {
  if (url.includes("/run-stats")) return RUN_STATS_ANSWER;
  if (url.includes("/workbench/summary")) return SUMMARY_ANSWER;
  if (url.includes("days=1")) return NEARDAY_ANSWER;
  return LEDGER_ANSWER;
}

async function mount(handler: (url: string) => Promise<unknown>, entry = "/overview?tab=usage"): Promise<void> {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(handler);
  await render(entry, <UsagePage />);
  await waitFor(() => !skeleton(), "state settled");
}

const ok = (body: unknown) => async (): Promise<unknown> => Promise.resolve(body);
const routed = () => async (url: string): Promise<unknown> => Promise.resolve(await routeAnswer(url));

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
    await mount(routed());
    expect(usageUrls()).toContain("/agent-api/api/hermes-usage?days=30");
    expect(el("usg4-page")).toBeTruthy();
    expect(text()).toContain("最近 30 天");
  });

  it("24h and 7d each rebuild the main route with their own days parameter", async () => {
    await mount(routed());
    await pickWindow("24h");
    expect(usageUrls()).toContain("/agent-api/api/hermes-usage?days=1");
    await pickWindow("7d");
    expect(usageUrls()).toContain("/agent-api/api/hermes-usage?days=7");
    // three windows, three distinct ledger reads, and the pane still renders
    expect(new Set(usageUrls()).size).toBe(3);
    expect(el("usg4-cost")).toBeTruthy();
  });

  it("switching the window does NOT re-fire the trend or the 24h legs", async () => {
    await mount(routed());
    const trendBefore = urls().filter((url) => url.includes("/run-stats")).length;
    await pickWindow("7d");
    expect(urls().filter((url) => url.includes("/run-stats")).length).toBe(trendBefore);
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

describe("the 7-day trend leg", () => {
  it("asks run-stats with a Beijing day window whose `to` is after `from`", async () => {
    await mount(routed());
    const trendUrl = urls().find((url) => url.includes("/run-stats")) ?? "";
    expect(trendUrl).toContain("bucket=day");
    const from = new URL(trendUrl, "http://x").searchParams.get("from") ?? "";
    const to = new URL(trendUrl, "http://x").searchParams.get("to") ?? "";
    expect(Date.parse(to)).toBeGreaterThan(Date.parse(from));
  });

  it("draws the buckets it got and keeps the missing day a gap, not a zero", async () => {
    await mount(routed());
    const rows = document.querySelectorAll("[data-testid^='usg4-trend-row-']");
    expect(rows.length).toBe(7);
    // slot 6 has no bucket at all → 无读数 everywhere in its row
    const gapRow = el(`usg4-trend-row-${week.slots[6]?.label ?? ""}`);
    expect(gapRow?.textContent).toContain("无读数");
    expect(gapRow?.textContent).not.toMatch(/\$0\.00/);
    // slot 5 has cost but no runs → runs read 无读数 while cost is real
    const partial = el(`usg4-trend-row-${week.slots[5]?.label ?? ""}`);
    expect(partial?.textContent).toContain("无读数");
    expect(partial?.textContent).toContain("$9.60");
    // the chart is inline SVG, and the 7-day counts are honest
    expect(el("usg4-trend-chart")?.tagName.toLowerCase()).toBe("svg");
    expect(text()).toContain("6/7 天有读数");
  });

  it("the trend cost column is disclosed as the run-side reading, not the ledger", async () => {
    await mount(routed());
    expect(text()).toContain("成本列是运行侧汇总");
    expect(text()).toContain("账本实扣见「成本账本」");
  });
});

describe("the projection and source-state leg", () => {
  it("states the degraded leg verbatim on screen, endpoint handle only in title", async () => {
    await mount(routed());
    expect(text()).toContain("会话统计 degraded(timeout)");
    expect(text()).toContain("仪表盘用量 实读");
    const titled = document.querySelector('[title*="gateway_sessions"]');
    expect(titled).toBeTruthy();
  });

  it("keeps the unattributed measure as a measure, never a total", async () => {
    await mount(routed());
    expect(text()).toContain("36 个会话没有归属到员工");
    expect(text()).toContain("不是总量");
  });

  it("says where the writable detail lives", async () => {
    await mount(routed());
    expect(text()).toContain("模型与单价 · 用量与单价 →");
    expect(text()).toContain("总览不承接任何写操作");
    expect(el("usg4-projection-rows")).toBeTruthy();
  });
});

describe("the workbench KPI leg — counts only, no money", () => {
  it("shows the counting KPIs and withholds the money KPI", async () => {
    await mount(routed());
    expect(text()).toContain("窗口运行");
    expect(text()).toContain("128");
    expect(el("usg4-summary-kpis")).toBeTruthy();
    // costUsd from workbench must not present as money anywhere on this card
    expect(el("usg4-summary-kpis")?.textContent).not.toContain("$5.00");
  });

  it("an empty kpi block reads as a stated gap, not zeros", async () => {
    await mount(async (url) => (url.includes("/workbench/summary") ? { kpis: [] } : LEDGER_ANSWER));
    expect(el("usg4-summary-empty")?.textContent).toContain("没有回任何可读的计数指标");
  });
});

describe("skeleton parity — card density, no dead canvas", () => {
  it("renders at least four cards with the estimated-only items collapsed into availability", async () => {
    await mount(routed());
    expect(cards()).toBeGreaterThanOrEqual(4);
    const availability = document.querySelector("[data-testid='usg4-cost']")
      ?.closest(".console-card")
      ?.querySelector("[data-availability-count]");
    expect(availability?.getAttribute("data-availability-count")).toBe("2");
    expect(text()).toContain("预计月底");
    expect(text()).toContain("浪费");
    // 「模块内标题用 h2」/「禁 role=tablist」
    expect(document.querySelector("h2")).toBeTruthy();
    expect(document.querySelector('[role="tablist"]')).toBeNull();
    expect(document.querySelector("[data-fixture]")).toBeNull();
  });

  it("the ready screen carries real prose, and dashes stay scarce", async () => {
    await mount(routed());
    expect(text().length).toBeGreaterThanOrEqual(1200);
    const dashes = (text().match(/—/g) ?? []).length;
    expect(dashes).toBeLessThanOrEqual(6);
    expect(text()).not.toContain("未接入");
    expect(text()).not.toContain("待核实");
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

  it("a failed side leg only costs its own card, never the whole screen", async () => {
    await mount(async (url) => {
      if (url.includes("/run-stats")) throw new ApiError("boom", { status: 500, body: "{}", url });
      return routeAnswer(url);
    });
    expect(el("usg4-trend-fallback")).toBeTruthy();
    expect(text()).toContain("重新读取");
    // the money layer keeps rendering normally
    expect(el("usg4-cost-total")?.textContent).toContain("$1,284.42");
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
    expect(cards()).toBe(0);
  });
});

describe("the ?state= repro legs", () => {
  for (const state of ["loading", "empty", "error", "denied"] as const) {
    it(`?state=${state} reproduces without a request and marks itself`, async () => {
      const entry = `/overview?tab=usage&state=${state}`;
      if (state === "loading") {
        // the repro leg stays a skeleton on purpose; skip the settle wait
        api.fetchJSON.mockReset();
        api.fetchJSON.mockImplementation(routed());
        await render(entry, <UsagePage />);
      } else {
        await mount(routed(), entry);
      }
      expect(urls()).toHaveLength(0);
      expect(el("usg4-page")).toBeTruthy(); // R31: repro carries on-screen copy, no data-fixture attr
      expect(text()).toContain(`?state=${state}`);
      expect(text()).toContain("GAP-07");
      expect((el("usg4-reload") as HTMLButtonElement | null)?.disabled).toBe(true);
      expect((el("usg4-window") as HTMLButtonElement | null)?.disabled).toBe(true);
      expect(el(`usg4-${state}`)).toBeTruthy();
    });
  }

  it("ready cannot be forged: without a known state the page does fetch", async () => {
    await mount(routed(), "/overview?tab=usage&state=ready");
    expect(usageUrls().length).toBeGreaterThan(0);
    expect(el("usg4-page")?.getAttribute("data-fixture")).toBeNull();
  });
});

describe("test hygiene", () => {
  it("every testid on the ready screen wears the usg4- prefix", async () => {
    await mount(routed());
    const ids = Array.from(document.querySelectorAll("[data-testid]")).map((node) =>
      node.getAttribute("data-testid"),
    );
    expect(ids.length).toBeGreaterThan(8);
    for (const id of ids) expect(id?.startsWith("usg4-")).toBe(true);
  });
});
