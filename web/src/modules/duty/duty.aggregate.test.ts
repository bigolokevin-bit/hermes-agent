// @vitest-environment jsdom
/**
 * duty trend / aggregate caliber guards. Test-only file: it pins the trend
 * summary to the very buckets the card draws, keeps missing readings from
 * turning into zeros, and keeps the collection time to the payload.
 *
 * One real defect was exposed and fixed with this file (see commit body):
 * `dailyBuckets` used to coerce a bucket without a reading to 0, which made a
 * missing point look like a real zero and shortened/skewed the axis.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({ fetchJSON: (...args: unknown[]) => fetchJSON(...args) }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: vi.fn(() => Promise.resolve(true)) }));

import DutyPage from "./DutyPage";
import { dailyBuckets, trendSummary, type DayBucketView } from "./aggregate";
import { timeseriesStats } from "./workbench";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  fetchJSON.mockReset();
  vi.useRealTimers();
});

const ASOF = "2026-11-18T06:00:00.000Z";

const point = (day: string, value: number | null) => ({
  ts: `2026-11-${day}T04:00:00.000Z`,
  label: `11/${day}`,
  value,
});

function body(url: string): unknown {
  if (url.includes("/workbench/summary")) {
    return {
      asOf: ASOF,
      available: true,
      kpis: [
        { key: "runs", value: 2, available: true },
        { key: "failed", value: 1, available: true },
        { key: "costUsd", value: 1.5, available: true },
        { key: "pendingApprovals", value: 1, available: true },
      ],
    };
  }
  if (url.includes("/workbench/timeseries")) {
    return { asOf: ASOF, points: [point("17", 1), point("18", 2)], totals: { metric: "runs", value: 3 } };
  }
  if (url.includes("/workbench/queue")) {
    return { asOf: ASOF, available: true, items: [{ id: "apr_1", title: "供应商报价" }], total: 1 };
  }
  if (url.includes("/employee-stats")) return { byLifecycle: { active: 1 } };
  if (url.includes("/employees")) return { items: [{ employeeId: "emp_1", name: "陈可" }] };
  if (url.includes("/run-activity")) return { max: 2, cells: [{ dow: 2, hour: 10, count: 2 }] };
  if (url.includes("/budget-usage")) return { items: [{ employeeId: "emp_1", costUsd: 1.5 }], missingEmployeeIds: [] };
  if (url.includes("/tasks")) return { items: [{ taskId: "tsk_1", title: "整理周报" }] };
  if (url.includes("/runs")) return { items: [{ runId: "run_1", status: "failed", startedAt: ASOF }] };
  return { items: [] };
}

function use(overrides: { timeseries?: unknown; activity?: Error } = {}) {
  fetchJSON.mockImplementation((url: string) => {
    if (overrides.timeseries !== undefined && url.includes("/workbench/timeseries")) {
      return Promise.resolve(overrides.timeseries);
    }
    if (overrides.activity && url.includes("/run-activity")) return Promise.reject(overrides.activity);
    return Promise.resolve(body(url));
  });
}

async function render() {
  await act(async () => {
    root.render(createElement(MemoryRouter, null, createElement(DutyPage)));
  });
  await act(async () => {});
}

const q = (id: string) => container.querySelector(`[data-testid="${id}"]`);
const txt = (id: string) => q(id)?.textContent ?? "";

async function openTable() {
  const toggle = q("duty-trend-table-toggle");
  await act(async () => {
    toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

const bucket = (i: number, runs: number | null): DayBucketView => ({
  label: `11/${String(i + 1).padStart(2, "0")}`,
  runs,
  failed: 0,
});

describe("duty aggregate — trend summary derives from the same buckets", () => {
  it("matches first/last/peak/low/total for one, two and fourteen buckets", () => {
    for (const count of [1, 2, 14]) {
      const rows = Array.from({ length: count }, (_, i) => bucket(i, (i * 3) % 7));
      const view = trendSummary(rows);
      const runs = rows.map((r) => r.runs as number);
      expect(view.first?.label).toBe(rows[0].label);
      expect(view.last?.label).toBe(rows[count - 1].label);
      expect(view.total).toBe(runs.reduce((a, b) => a + b, 0));
      expect(view.peak?.runs).toBe(Math.max(...runs));
      expect(view.low?.runs).toBe(Math.min(...runs));
      expect(view.empty).toBe(view.total === 0);
    }
  });

  it("keeps the table body sum equal to the summary total on screen", async () => {
    use();
    await render();
    await openTable();
    const rows = [...container.querySelectorAll("#duty-trend-table tbody tr")];
    const sum = rows.reduce((n, row) => n + Number(row.lastElementChild?.textContent ?? 0), 0);
    expect(rows.length).toBe(2);
    expect(sum).toBe(Number(txt("duty-trend-total")));
  });
});

describe("duty aggregate — empty and missing batches are not zeros", () => {
  it("treats an empty batch as nothing to report and says so, with no body rows", async () => {
    use({ timeseries: { asOf: ASOF, points: [], totals: null } });
    await render();
    expect(txt("duty-trend-summary")).toContain("该区间没有运行记录");
    await openTable();
    expect(container.querySelectorAll("#duty-trend-table tbody tr").length).toBe(0);
    expect(txt("duty-trend-table-empty")).toContain("没有可列出的行");
  });

  it("treats an all-missing batch the same way instead of summing zeros", async () => {
    const stats = timeseriesStats({
      asOf: ASOF,
      points: [point("17", null), point("18", null)],
      totals: null,
    });
    expect(stats.buckets?.length).toBe(2);
    expect(dailyBuckets(stats).every((b) => b.runs === null)).toBe(true);
    expect(trendSummary(dailyBuckets(stats)).total).toBeNull();
    expect(trendSummary(dailyBuckets(stats)).empty).toBe(true);

    use({ timeseries: { asOf: ASOF, points: [point("17", null), point("18", null)], totals: null } });
    await render();
    expect(txt("duty-trend-summary")).toContain("该区间没有运行记录");
    await openTable();
    expect(container.querySelectorAll("#duty-trend-table tbody tr").length).toBe(0);
  });
});

describe("duty aggregate — a missing point keeps its slot", () => {
  it("does not count a null bucket in peak/low/total and keeps the axis length", async () => {
    use({
      timeseries: {
        asOf: ASOF,
        points: [point("16", 4), point("17", null), point("18", 2)],
        totals: null,
      },
    });
    await render();
    expect(txt("duty-trend-total")).toBe("6");
    expect(txt("duty-trend-peak")).toBe("4");
    expect(txt("duty-trend-low")).toBe("2");
    // 曲线换成公共件 TrendCurve 后仍是一条连续曲线：缺读数的桶按 0 参与
    // （曲线件里 null 才造断口，这里不给 null），三个桶各占一个轴位。
    const figure = container.querySelector('[data-testid="duty-trend-figure"]');
    const lines = [...(figure?.querySelectorAll("path.tc-line") ?? [])];
    expect(lines.length).toBe(1);
    expect(lines[0].getAttribute("d") ?? "").toContain("C");
    const xTicks = [...(figure?.querySelectorAll("text.tc-tick") ?? [])].filter(
      (node) => Number(node.getAttribute("y")) > 100,
    );
    expect(xTicks.length).toBe(3);
    await openTable();
    const rows = [...container.querySelectorAll("#duty-trend-table tbody tr")];
    expect(rows.length).toBe(3);
    expect(rows[1].lastElementChild?.textContent).toBe("—");
  });
});

describe("duty aggregate — queue availability never becomes a sum", () => {
  it("shows the pending count as missing, with the reason, and leaves other numbers alone", async () => {
    const queue = {
      asOf: ASOF,
      available: false,
      reason: "审批源暂时读不到",
      items: [],
      total: null,
    };
    fetchJSON.mockImplementation((url: string) =>
      Promise.resolve(url.includes("/workbench/queue") ? queue : body(url)),
    );
    await render();
    expect(txt("ov6-kpi-pending")).toContain("—");
    expect(container.textContent ?? "").toContain("审批源暂时读不到");
    expect(txt("ov6-kpi-runs")).toContain("2");
    expect(txt("duty-trend-total")).toBe("3");
  });
});

describe("duty aggregate — one failing read only breaks its own card", () => {
  it("keeps the trend summary when the activity read fails, and blanks only the trend on its own failure", async () => {
    use({ activity: new ApiError("boom", { status: 500, body: "", url: "/run-activity", requestId: "req-act" }) });
    await render();
    expect(container.textContent ?? "").toContain("req-act");
    expect(txt("duty-trend-total")).toBe("3");
    expect(txt("duty-trend-first")).toBe("1");
    expect(txt("duty-trend-low")).toBe("1");

    act(() => root.unmount());
    root = createRoot(container);
    fetchJSON.mockReset();
    fetchJSON.mockImplementation((url: string) => {
      if (url.includes("/workbench/timeseries")) {
        return Promise.reject(
          new ApiError("boom", { status: 500, body: "", url, requestId: "req-trend-1" }),
        );
      }
      return Promise.resolve(body(url));
    });
    await render();
    for (const id of ["duty-trend-first", "duty-trend-last", "duty-trend-peak", "duty-trend-low", "duty-trend-total"]) {
      expect(txt(id), id).toBe("—");
    }
    const summary = q("duty-trend-summary");
    expect(summary?.getAttribute("title") ?? "").toContain("req-trend-1");
    expect(summary?.getAttribute("title") ?? "").toContain("不把缺数当 0");
    expect(txt("ov6-kpi-runs")).toContain("2");
  });
});

describe("duty aggregate — collection time comes from the payload only", () => {
  it("accepts the six top-level aliases and refuses to borrow the browser clock", async () => {
    for (const key of ["asOf", "as_of", "collectedAt", "collected_at", "generatedAt", "generated_at"]) {
      fetchJSON.mockImplementation((url: string) => {
        if (url.includes("/workbench/timeseries")) {
          const next = { ...(body(url) as Record<string, unknown>), [key]: "2026-11-20T05:20:00Z" };
          if (key !== "asOf") delete next.asOf;
          return Promise.resolve(next);
        }
        return Promise.resolve(body(url));
      });
      await render();
      expect(txt("ov6-trend-stamp"), key).toContain("数据截至 2026-11-20 13:20");
      act(() => root.unmount());
      root = createRoot(container);
    }

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2031-03-04T05:06:07Z"));
    fetchJSON.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes("/workbench/timeseries")
          ? { ...(body(url) as object), asOf: "yesterday" }
          : body(url),
      ),
    );
    await render();
    vi.useRealTimers();
    expect(txt("ov6-trend-stamp")).toContain("数据截至 —");
    expect(q("ov6-trend-stamp")?.getAttribute("title") ?? "").toContain("不用本机时间顶替");
    expect(container.textContent ?? "").not.toContain("2031");
  });
});