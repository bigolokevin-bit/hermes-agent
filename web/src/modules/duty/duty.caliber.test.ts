// @vitest-environment jsdom
/**
 * duty caliber guards — the six /overview blocks must keep reading real
 * endpoints and must never fall back to sample rows. Test-only file unless a
 * real defect was exposed; the two product fixes shipped with it are noted in
 * the commit body (asOf aliases/ISO check, copyable request id).
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const fetchJSON = vi.fn();
const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn(() => Promise.resolve(true)) }));
vi.mock("@/lib/api", () => ({
  fetchJSON: (...args: unknown[]) => fetchJSON(...args),
}));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clip.copyTextToClipboard }));

import DutyPage from "./DutyPage";
import MatrixView from "./MatrixView";

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
  clip.copyTextToClipboard.mockClear();
});

const ASOF = "2026-11-18T06:00:00.000Z";

function body(url: string): unknown {
  if (url.includes("/workbench/summary")) {
    return {
      asOf: ASOF,
      available: true,
      degraded: [],
      kpis: [
        { key: "runs", label: "运行数", unit: "次", value: 2, available: true },
        { key: "failed", label: "失败数", unit: "次", value: 1, available: true },
        { key: "failureRate", label: "失败率", unit: "ratio", value: 0.5, available: true },
        { key: "costUsd", label: "成本", unit: "USD", value: 1.5, available: true },
        { key: "activeEmployees", label: "在岗数字员工", unit: "个", value: 1, available: true },
        { key: "pendingApprovals", label: "待审批", unit: "条", value: 1, available: true },
      ],
    };
  }
  if (url.includes("/workbench/timeseries")) {
    return { asOf: ASOF, available: true, points: [], totals: { metric: "runs", value: 0 } };
  }
  if (url.includes("/workbench/queue")) {
    return {
      asOf: ASOF,
      available: true,
      degraded: [],
      items: [{ id: "apr_1", type: "approval", title: "供应商报价", status: "pending" }],
      total: 1,
    };
  }
  if (url.includes("/employee-stats")) return { byLifecycle: { active: 1 } };
  if (url.includes("/employees")) {
    return { items: [{ employeeId: "emp_1", name: "陈可", lifecycleState: "active" }] };
  }
  if (url.includes("/run-activity")) return { max: 2, cells: [{ dow: 2, hour: 10, count: 2 }] };
  if (url.includes("/budget-usage")) {
    return { items: [{ employeeId: "emp_1", costUsd: 1.5 }], missingEmployeeIds: [] };
  }
  if (url.includes("/tasks")) return { items: [{ taskId: "tsk_1", title: "整理周报", status: "blocked" }] };
  if (url.includes("/runs")) {
    return { items: [{ runId: "run_abcdef123456", status: "failed", startedAt: ASOF }] };
  }
  if (url.includes("/matrix")) {
    return { items: [{ employeeId: "emp_1", employeeName: "陈可", lifecycleState: "active" }] };
  }
  return { items: [] };
}

async function render(ui: React.ReactNode) {
  await act(async () => {
    root.render(createElement(MemoryRouter, null, ui));
  });
  await act(async () => {});
}

function seen(): string[] {
  return fetchJSON.mock.calls.map((call) => String(call[0]));
}

describe("duty caliber — every block reads a real endpoint", () => {
  it("calls the six real reads and renders no fixture symbol or data-fixture marker", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(body(url)));
    await render(createElement(DutyPage));
    const urls = seen();
    for (const path of ["/employee-stats", "/run-activity", "/budget-usage", "/tasks", "/runs"]) {
      expect(urls.some((u) => u.includes(path))).toBe(true);
    }
    expect(urls.some((u) => u.includes("/run-stats"))).toBe(false);
    // 待审队列仍不打 /approval-stats 与 /approvals?status=pending；
    // 四门证据腿（approvals?status=all、workstations、effective-config、knowledge）是新增的真实读。
    expect(urls.some((u) => u.includes("/approval-stats") || u.includes("/approvals?status=pending") || u.includes("/approvals?limit"))).toBe(false);
    for (const path of ["/approvals?status=all", "/workstations?", "/effective-config?", "/knowledge/documents"]) {
      expect(urls.some((u) => u.includes(path))).toBe(true);
    }
    expect(container.innerHTML).not.toContain("MATRIX_FIXTURE");
    expect(container.querySelector("[data-fixture]")).toBeNull();
    expect(container.textContent ?? "").not.toContain("样例");

    // The matrix block reads /api/matrix and, with no upstream, states 未接入.
    fetchJSON.mockImplementation(() =>
      Promise.reject(new ApiError("not found", { status: 404, body: "", url: "/api/matrix" })),
    );
    await act(async () => {
      root.render(createElement(MemoryRouter, null, createElement(MatrixView)));
    });
    await act(async () => {});
    expect(seen().some((u) => u.includes("/api/matrix"))).toBe(true);
    expect(container.querySelector("[data-fixture]")).toBeNull();
    expect(container.textContent ?? "").not.toContain("样例");
  });

  it("keeps the ov6 anchor family the page shipped with", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(body(url)));
    await render(createElement(DutyPage));
    const ids = [
      "ov6-page",
      "ov6-asof",
      "ov6-ready",
      "ov6-ready-value",
      "ov6-today-runs",
      "ov6-today-cost",
      "ov6-trend",
      "ov6-activity",
      "ov6-blockers",
      "ov6-pending",
      "ov6-recent",
      "ov6-kpi-employees",
      "ov6-kpi-runs",
      "ov6-kpi-cost",
      "ov6-kpi-pending",
      "ov6-kpi-health",
      "ov6-ready-stamp",
      "ov6-today-runs-stamp",
      "ov6-today-cost-stamp",
      "ov6-trend-stamp",
      "ov6-activity-stamp",
      "ov6-blockers-stamp",
      "ov6-pending-stamp",
      "ov6-recent-stamp",
    ];
    for (const id of ids) expect(container.querySelector(`[data-testid="${id}"]`), id).toBeTruthy();
    expect(container.querySelectorAll('[data-testid^="ov6-gate-"]').length).toBeGreaterThanOrEqual(4);
  });
});

describe("duty caliber — collection time", () => {
  const aliases = ["asOf", "as_of", "collectedAt", "collected_at", "generatedAt", "generated_at"];

  it("accepts all six top-level aliases and prints Beijing time to the minute", async () => {
    for (const key of aliases) {
      fetchJSON.mockImplementation((url: string) => {
        const b = body(url) as Record<string, unknown>;
        if (url.includes("/budget-usage")) return Promise.resolve({ ...b, [key]: "2026-11-20T05:20:00Z" });
        return Promise.resolve(b);
      });
      await render(createElement(DutyPage));
      const stamp = container.querySelector('[data-testid="ov6-today-cost-stamp"]');
      expect(stamp?.textContent, key).toContain("数据截至 2026-11-20 13:20");
      act(() => root.unmount());
      root = createRoot(container);
    }
  });

  it("refuses a non-ISO stamp and never substitutes the browser clock", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2031-03-04T05:06:07Z"));
    try {
      fetchJSON.mockImplementation((url: string) => {
        const b = body(url) as Record<string, unknown>;
        if (url.includes("/budget-usage")) return Promise.resolve({ ...b, asOf: "yesterday" });
        return Promise.resolve(b);
      });
      await render(createElement(DutyPage));
      const stamp = container.querySelector('[data-testid="ov6-today-cost-stamp"]');
      expect(stamp?.textContent).toContain("数据截至 —");
      expect(stamp?.getAttribute("title")).toContain("不用本机时间顶替");
      expect(container.textContent ?? "").not.toContain("2031");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("duty caliber — missing numbers stay missing", () => {
  it("prints an em dash when summary omits a KPI and when the queue is unavailable", async () => {
    fetchJSON.mockImplementation((url: string) => {
      if (url.includes("/workbench/summary")) {
        return Promise.resolve({
          asOf: ASOF,
          available: true,
          kpis: [{ key: "failed", label: "失败数", unit: "次", value: 0, available: true }],
        });
      }
      if (url.includes("/workbench/queue")) {
        return Promise.resolve({
          asOf: ASOF,
          available: false,
          reason: "审批源暂时读不到",
          degraded: [{ source: "approvals", error: "审批源暂时读不到" }],
          items: [],
          total: null,
        });
      }
      return Promise.resolve(body(url));
    });
    await render(createElement(DutyPage));
    expect(container.querySelector('[data-testid="ov6-kpi-runs"]')?.textContent).toContain("—");
    expect(container.querySelector('[data-testid="ov6-kpi-runs"]')?.textContent).not.toContain("0");
    const pending = container.querySelector('[data-testid="ov6-kpi-pending"]');
    expect(pending?.textContent).toContain("—");
    expect(container.textContent ?? "").toContain("审批源暂时读不到");
  });
});

describe("duty caliber — one failed read breaks one card", () => {
  it("keeps the other cards and hands out a copyable request id with retry", async () => {
    fetchJSON.mockImplementation((url: string) => {
      if (url.includes("/budget-usage")) {
        return Promise.reject(
          new ApiError("成本账本这次没读出来", {
            status: 500,
            body: "",
            url,
            requestId: "req-duty-500",
          }),
        );
      }
      return Promise.resolve(body(url));
    });
    await render(createElement(DutyPage));
    const cost = container.querySelector('[data-testid="ov6-today-cost"]');
    expect(cost?.textContent).toContain("请求编号 req-duty-500");
    expect(cost?.textContent).toContain("重试");
    expect(container.querySelector('[data-testid="ov6-today-runs"]')?.textContent).toContain("2");

    const copy = container.querySelector('[data-testid="ov6-rid-copy"]') as HTMLButtonElement | null;
    expect(copy).toBeTruthy();
    await act(async () => copy?.click());
    expect(clip.copyTextToClipboard).toHaveBeenCalledWith("req-duty-500");
  });
});
describe("duty caliber — staff card source decision (workbench/agents)", () => {
  it("keeps the two real employee reads and says why agents does not replace them", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(body(url)));
    await render(createElement(DutyPage));
    const urls = seen();
    expect(urls.some((u) => u.includes("/employee-stats"))).toBe(true);
    expect(urls.some((u) => u.includes("/employees"))).toBe(true);
    // The card stays on the two sources that carry the lifecycle totals.
    expect(urls.some((u) => u.includes("/workbench/agents"))).toBe(false);
    // 三卡返工：来源取舍的理由不再挂在卡片 tooltip 上，随明细一起收进卡外折叠区。
    const card = container.querySelector('[data-testid="duty-details-readiness"]');
    const hint = card?.getAttribute("title") ?? "";
    expect(hint, "来源取舍理由必须留在卡外明细").toContain("workbench/agents 缺");
    expect(hint).toContain("本卡仍取");
    expect(container.querySelector("[data-fixture]")).toBeNull();
    expect(container.textContent ?? "").not.toContain("样例");
  });

  it("breaks only the readiness card when the employee stats leg fails", async () => {
    fetchJSON.mockImplementation((url: string) => {
      if (url.includes("/employee-stats")) {
        return Promise.reject(
          new ApiError("boom", { status: 500, body: "", url, requestId: "req-ready" }),
        );
      }
      return Promise.resolve(body(url));
    });
    await render(createElement(DutyPage));
    const ready = container.querySelector('[data-testid="ov6-ready"]');
    expect(ready?.textContent ?? "").toContain("请求编号 req-ready");
    expect(ready?.textContent ?? "").toContain("重试");
    // Other cards keep their own real numbers from this batch.
    expect(container.querySelector('[data-testid="ov6-today-runs"]')?.textContent).toContain("2");
    expect(container.querySelector('[data-testid="ov6-kpi-pending"]')?.textContent).toContain("1");
  });
});
