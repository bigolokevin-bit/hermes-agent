// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchJSON: (...args: unknown[]) => fetchJSON(...args),
}));

import DutyPage from "./DutyPage";
import { dutyGates } from "./dutyGates";
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
});

const WB_ASOF = "2026-11-18T06:00:00.000Z";

function ok(url: string): unknown {
  // Wave-20 read models: statistics, queue and trend come from /workbench/*.
  if (url.includes("/workbench/summary")) {
    return {
      asOf: WB_ASOF,
      asOfSource: "bff-aggregation-read-time",
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
    return {
      asOf: WB_ASOF,
      asOfSource: "bff-read-time",
      available: true,
      points: [
        { ts: "2026-11-17T00:00:00.000Z", label: "11-17", value: 1 },
        { ts: "2026-11-18T00:00:00.000Z", label: "11-18", value: 2 },
        { ts: "2026-11-18T23:00:00.000Z", label: "11-18 23", value: null },
      ],
      totals: { metric: "runs", value: 3 },
    };
  }
  if (url.includes("/workbench/queue")) {
    return {
      asOf: WB_ASOF,
      asOfSource: "bff-read-time",
      available: true,
      degraded: [],
      items: [
        {
          id: "apr_1",
          type: "approval",
          title: "供应商报价",
          status: "pending",
          createdAt: "2026-11-18T01:00:00.000Z",
          timeoutAt: null,
        },
      ],
      total: 1,
    };
  }
  if (url.includes("/employee-stats")) {
    return { byLifecycle: { active: 1, paused: 0, offboarding: 0 } };
  }
  if (url.includes("/employees")) {
    return { items: [{ employeeId: "emp_1", name: "陈可", lifecycleState: "active", ownerUserId: "u_1" }] };
  }
  if (url.includes("/run-stats")) {
    return {
      totals: { runs: 2, succeeded: 1, failed: 1, running: 0, costUsd: 1.5 },
      buckets: [{ bucketStart: "2026-11-18T00:00:00Z", runs: 2, failed: 1 }],
    };
  }
  if (url.includes("/run-activity")) {
    return { max: 2, cells: [{ dow: 2, hour: 10, count: 2 }] };
  }
  if (url.includes("/budget-usage")) {
    return { items: [{ employeeId: "emp_1", costUsd: 1.5 }], missingEmployeeIds: [] };
  }
  if (url.includes("/approval-stats")) return { pending: 1, dueSoon: 0 };
  if (url.includes("/approvals")) {
    return { items: [{ approvalId: "apr_1", title: "供应商报价", status: "pending" }] };
  }
  if (url.includes("/tasks")) {
    return { items: [{ taskId: "tsk_1", title: "整理周报", status: "blocked" }] };
  }
  if (url.includes("/runs")) {
    return {
      items: [
        { runId: "run_abcdef123456", employeeId: "emp_1", status: "failed", startedAt: "2026-11-18T02:00:00Z" },
      ],
    };
  }
  return { items: [] };
}

async function render(ui: React.ReactNode) {
  await act(async () => {
    root.render(<MemoryRouter>{ui}</MemoryRouter>);
  });
  await act(async () => {});
}

describe("DutyPage", () => {
  it("renders the fixed eight cards and keeps unknown gates out of the numerator", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await render(<DutyPage />);
    const text = container.textContent ?? "";
    for (const title of ["可上岗", "今日运行", "今日成本", "近 14 天运行", "24 小时活跃", "阻塞", "待我处理", "最近运行"]) {
      expect(text).toContain(title);
    }
    expect(container.querySelectorAll('[data-card="duty"]')).toHaveLength(8);
    expect(container.querySelector('[data-duty-testid="duty-ready-value"]')?.textContent).toContain("—");
    expect(text).toContain("待核实");
    expect(text).not.toContain("HTTP");
  });

  it("R32 item 1: /overview carries ov6-asof, eight card stamps and the ov6-kpi family", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await render(<DutyPage />);
    const asof = container.querySelector('[data-testid="ov6-asof"]');
    expect(asof).toBeTruthy();
    expect((asof?.textContent ?? "").replace(/\s+/g, " ")).toMatch(
      /采集时刻 北京时间 \d{4}-\d{2}-\d{2} \d{2}:\d{2}|采集时刻 —/,
    );
    for (const id of [
      "ov6-ready-stamp",
      "ov6-today-runs-stamp",
      "ov6-today-cost-stamp",
      "ov6-trend-stamp",
      "ov6-activity-stamp",
      "ov6-blockers-stamp",
      "ov6-pending-stamp",
      "ov6-recent-stamp",
    ]) {
      expect(container.querySelector(`[data-testid="${id}"]`)).toBeTruthy();
    }
    expect(container.querySelectorAll('[data-testid^="ov6-kpi-"]').length).toBeGreaterThanOrEqual(5);
    expect(container.querySelectorAll('[data-duty-testid^="duty-kpi-"]').length).toBeGreaterThanOrEqual(5);
  });

  it("R41: ov6-asof takes the newest asOf among all sources", async () => {
    fetchJSON.mockImplementation((url: string) => {
      const body = ok(url) as Record<string, unknown>;
      if (url.includes("/workbench/summary"))
        return Promise.resolve({ ...body, asOf: "2026-11-18T01:00:00Z" });
      if (url.includes("/budget-usage")) return Promise.resolve({ ...body, asOf: "2026-11-20T05:20:00Z" });
      if (url.includes("/workbench/queue"))
        return Promise.resolve({ ...body, asOf: "2026-11-19T03:00:00Z" });
      return Promise.resolve(body);
    });
    await render(<DutyPage />);
    const asof = container.querySelector('[data-testid="ov6-asof"]');
    expect(asof?.textContent).toContain("采集时刻 北京时间 2026-11-20 13:20");
    expect(asof?.getAttribute("title")).toContain("最新的一个上屏");
  });

  it("R41: when every source lacks asOf the line falls back to the em-dash naming the sources", async () => {
    fetchJSON.mockImplementation((url: string) => {
      const body = ok(url) as Record<string, unknown>;
      // Read models that do send a collection time: strip it for this case.
      if (url.includes("/workbench/")) {
        const rest = { ...body };
        delete rest.asOf;
        return Promise.resolve(rest);
      }
      return Promise.resolve(body);
    });
    await render(<DutyPage />);
    const asof = container.querySelector('[data-testid="ov6-asof"]');
    expect(asof?.textContent).toContain("采集时刻 —（北京时间）");
    expect(asof?.getAttribute("title")).toContain("未返回采集时间的来源：");
    expect(asof?.getAttribute("title")).toContain("今日运行统计");
  });

  it("reads statistics, queue and trend from the workbench models and stops calling the old endpoints", async () => {
    const seen: string[] = [];
    fetchJSON.mockImplementation((url: string) => {
      seen.push(url);
      return Promise.resolve(ok(url));
    });
    await render(<DutyPage />);
    expect(seen.some((u) => u.includes("/workbench/summary"))).toBe(true);
    expect(seen.some((u) => u.includes("/workbench/timeseries"))).toBe(true);
    expect(seen.filter((u) => u.includes("/workbench/queue"))).toHaveLength(1);
    expect(seen.some((u) => u.includes("/run-stats"))).toBe(false);
    expect(seen.some((u) => u.includes("/approval-stats"))).toBe(false);
    expect(seen.some((u) => u.includes("/approvals"))).toBe(false);
    const asof = container.querySelector('[data-testid="ov6-asof"]');
    expect(asof?.textContent).toContain("采集时刻 北京时间 2026-11-18 14:00");
    expect(container.querySelector('[data-testid="ov6-pending-value"]')?.textContent ?? container.textContent).toBeTruthy();
  });

  it("keeps the other cards alive when one workbench read is missing", async () => {
    fetchJSON.mockImplementation((url: string) =>
      url.includes("/workbench/timeseries")
        ? Promise.reject(new ApiError("missing", { status: 404, body: "{}", url }))
        : Promise.resolve(ok(url)),
    );
    await render(<DutyPage />);
    expect(container.querySelector('[data-testid="ov6-trend"]')?.textContent).toContain("—");
    expect(container.querySelector('[data-testid="ov6-today-runs"]')?.textContent).toContain("2");
  });

  it("shows a request id and retry on an error card", async () => {
    fetchJSON.mockImplementation((url: string) =>
      url.includes("/workbench/summary")
        ? Promise.reject(new ApiError("boom", { status: 500, body: "{}", url, requestId: "req-duty" }))
        : Promise.resolve(ok(url)),
    );
    await render(<DutyPage />);
    expect(container.textContent).toContain("请求编号 req-duty");
    expect(container.textContent).toContain("重试");
  });
});

describe("MatrixView", () => {
  it("states 未接入 honestly when the matrix route is absent (R31: no sample rows)", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.reject(new ApiError("missing", { status: 404, body: "{}", url })),
    );
    await render(<MatrixView />);
    expect(container.querySelector('[data-testid="matrix-unwired"]')).toBeTruthy();
    expect(container.textContent).toContain("能力矩阵未接入");
    // GAP-06 now names the upstream read port; the BFF relay already exists.
    expect(container.textContent).toContain("上游的矩阵读口");
    // No sample data ships with the module: nothing may carry data-fixture.
    expect(container.querySelector("[data-fixture]")).toBeNull();
    expect(container.textContent).not.toContain("样例");
    expect(container.textContent).not.toContain("陈可");
  });

  it("never falls back to the fixture on a real 500", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.reject(new ApiError("boom", { status: 500, body: "{}", url, requestId: "req-mx" })),
    );
    await render(<MatrixView />);
    expect(container.querySelector('[data-testid="matrix-unwired"]')).toBeFalsy();
    expect(container.textContent).toContain("请求编号 req-mx");
    expect(container.textContent).not.toContain("陈可");
  });
});

describe("DutyPage refresh", () => {
  const hits = (urls: string[], path: string) => urls.filter((u) => u.includes(path)).length;

  it("one click re-reads every card exactly once and stamps the read time, not the data time", async () => {
    const urls: string[] = [];
    fetchJSON.mockImplementation((url: string) => {
      urls.push(url);
      return Promise.resolve(ok(url));
    });
    await render(<DutyPage />);
    const first = [...urls];
    expect(first.length).toBeGreaterThan(0);

    await act(async () => {
      (container.querySelector('[data-testid="duty-refresh"]') as HTMLButtonElement).click();
    });
    await act(async () => {});
    const second = urls.slice(first.length);
    for (const path of [
      "/employees",
      "/employee-stats",
      "/workbench/summary",
      "/workbench/timeseries",
      "/workbench/queue",
      "/run-activity",
      "/budget-usage",
      "/runs",
      "/tasks",
    ]) {
      expect(hits(second, path), path).toBe(hits(first, path));
    }
    const stamp = container.querySelector('[data-testid="duty-updated-at"]');
    expect(stamp?.textContent).toContain("刷新完成于 北京时间");
    expect(stamp?.textContent).toContain("读取时刻，不是数据时刻");
    expect(container.querySelector('[data-testid="duty-busy-note"]')).toBeNull();
    expect(container.querySelector('[data-testid="ov6-kpi-runs"]')?.textContent).toContain("2");
  });

  it("ignores a second click inside the same batch and keeps the old numbers on screen", async () => {
    const urls: string[] = [];
    let holdOnce = false;
    let release: (() => void) | null = null;
    fetchJSON.mockImplementation((url: string) => {
      urls.push(url);
      if (url.includes("/employee-stats") && holdOnce) {
        holdOnce = false;
        return new Promise((resolve) => {
          release = () => resolve(ok(url));
        });
      }
      return Promise.resolve(ok(url));
    });
    await render(<DutyPage />);
    const before = urls.length;
    const statsBefore = hits(urls, "/employee-stats");
    holdOnce = true;

    await act(async () => {
      const button = container.querySelector('[data-testid="duty-refresh"]') as HTMLButtonElement;
      button.click();
      button.click();
    });
    await act(async () => {});
    // Exactly one new employee-stats read: the second click was swallowed.
    expect(hits(urls, "/employee-stats")).toBe(statsBefore + 1);
    expect(container.querySelector('[data-testid="duty-busy-note"]')?.textContent).toContain("更新中");
    expect(container.querySelector('[data-testid="ov6-kpi-runs"]')?.textContent).toContain("2");

    await act(async () => {
      release?.();
    });
    await act(async () => {});
    expect(container.querySelector('[data-testid="duty-busy-note"]')).toBeNull();
    expect(container.querySelector('[data-testid="duty-updated-at"]')).toBeTruthy();
    expect(urls.length).toBeGreaterThan(before);
  });

  it("keeps the previous batch on a failed refresh, names the request id and retries in place", async () => {
    const urls: string[] = [];
    let failSummary = false;
    fetchJSON.mockImplementation((url: string) => {
      urls.push(url);
      if (failSummary && url.includes("/workbench/summary")) {
        return Promise.reject(
          new ApiError("boom", { status: 500, body: "{}", url, requestId: "req-duty-rf" }),
        );
      }
      return Promise.resolve(ok(url));
    });
    await render(<DutyPage />);
    failSummary = true;
    await act(async () => {
      (container.querySelector('[data-testid="duty-refresh"]') as HTMLButtonElement).click();
    });
    await act(async () => {});
    const error = container.querySelector('[data-testid="duty-refresh-error"]');
    expect(error?.textContent).toContain("这次刷新没成功");
    expect(error?.textContent).toContain("req-duty-rf");
    expect(container.querySelector('[data-testid="duty-updated-at"]')).toBeNull();
    // Only the summary card is hurt; the other cards keep the old batch.
    expect(container.querySelector('[data-testid="ov6-kpi-cost"]')?.textContent).toBeTruthy();

    failSummary = false;
    await act(async () => {
      (container.querySelector('[data-testid="duty-refresh-retry"]') as HTMLButtonElement).click();
    });
    await act(async () => {});
    expect(container.querySelector('[data-testid="duty-refresh-error"]')).toBeNull();
    expect(container.querySelector('[data-testid="duty-updated-at"]')).toBeTruthy();
  });
});

describe("DutyPage action gates", () => {
  const btn = (sel: string) => container.querySelector(sel) as HTMLButtonElement | null;

  it("derives one matrix for refresh, retry, copy and links", () => {
    const loading = dutyGates({ loading: true, refreshing: false, allFailed: false });
    expect(loading.refresh.enabled).toBe(true);
    expect(loading.retry.enabled).toBe(true);
    expect(loading.copy.enabled).toBe(false);
    expect(loading.copy.title).toContain("还在读取");
    expect(loading.link.enabled).toBe(true);

    const ready = dutyGates({ loading: false, refreshing: false, allFailed: false });
    expect(ready.retry.enabled && ready.copy.enabled && ready.refresh.enabled).toBe(true);

    const busy = dutyGates({ loading: false, refreshing: true, allFailed: false });
    expect(busy.refresh.enabled).toBe(true);
    expect(busy.retry.enabled).toBe(false);
    expect(busy.copy.enabled).toBe(false);
    expect(busy.retry.title).toContain("更新中");

    const down = dutyGates({ loading: false, refreshing: false, allFailed: true });
    expect(down.refresh.enabled).toBe(true);
    expect(down.copy.enabled).toBe(false);
    expect(down.copy.title).toContain("整页");
  });

  it("keeps refresh clickable while the first read is still running", async () => {
    let release: (() => void) | null = null;
    fetchJSON.mockImplementation(
      (url: string) =>
        new Promise((resolve) => {
          if (url.includes("/employees?") && !release) {
            release = () => resolve(ok(url));
            return;
          }
          resolve(ok(url));
        }),
    );
    await act(async () => {
      root.render(<MemoryRouter><DutyPage /></MemoryRouter>);
    });
    await act(async () => {});
    const refresh = btn('[data-testid="duty-refresh"]');
    expect(refresh).toBeTruthy();
    expect(refresh?.disabled).toBe(false);
    expect(container.querySelector('[data-testid="ov6-rid-copy"]')).toBeNull();
    await act(async () => {
      release?.();
    });
    await act(async () => {});
  });

  it("leaves a single failed card retryable and copyable while other cards keep their numbers", async () => {
    fetchJSON.mockImplementation((url: string) => {
      if (url.includes("/budget-usage")) {
        return Promise.reject(new ApiError("budget source down", { status: 500, body: "", url, requestId: "req-gate-1" }));
      }
      return Promise.resolve(ok(url));
    });
    await render(<DutyPage />);
    const refresh = btn('[data-testid="duty-refresh"]');
    expect(refresh?.disabled).toBe(false);
    const retries = [...container.querySelectorAll("button")].filter((b) => b.textContent?.includes("重试"));
    expect(retries.length).toBeGreaterThan(0);
    expect(retries.every((b) => !(b as HTMLButtonElement).disabled)).toBe(true);
    const copy = btn('[data-testid="ov6-rid-copy"]');
    expect(copy).toBeTruthy();
    expect(copy?.disabled).toBe(false);
    expect(container.querySelector('[data-testid="ov6-kpi-runs"]')?.textContent).toContain("2");
  });

  it("keeps refresh as the way back when every block failed, and holds the copies", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.reject(new ApiError("all down", { status: 502, body: "", url, requestId: "req-gate-all" })),
    );
    await render(<DutyPage />);
    expect(btn('[data-testid="duty-refresh"]')?.disabled).toBe(false);
    const copies = [...container.querySelectorAll('[data-testid="ov6-rid-copy"]')] as HTMLButtonElement[];
    expect(copies.length).toBeGreaterThan(0);
    expect(copies.every((c) => c.disabled)).toBe(true);
    expect(copies[0].title).toContain("整页");
  });

  it("while a refresh is in flight, retry and copy are held with one reason and a second press is swallowed", async () => {
    let hold = false;
    let release: (() => void) | null = null;
    const urls: string[] = [];
    fetchJSON.mockImplementation((url: string) => {
      urls.push(url);
      if (url.includes("/budget-usage")) {
        return Promise.reject(new ApiError("budget source down", { status: 500, body: "", url, requestId: "req-gate-2" }));
      }
      if (hold && url.includes("/workbench/summary")) {
        hold = false;
        return new Promise((resolve) => {
          release = () => resolve(ok(url));
        });
      }
      return Promise.resolve(ok(url));
    });
    await render(<DutyPage />);
    const before = urls.length;
    hold = true;
    await act(async () => {
      btn('[data-testid="duty-refresh"]')?.click();
    });
    await act(async () => {});
    expect(btn('[data-testid="duty-refresh"]')?.getAttribute("aria-busy")).toBe("true");
    const mid = urls.length;
    await act(async () => {
      btn('[data-testid="duty-refresh"]')?.click();
    });
    await act(async () => {});
    expect(urls.length).toBe(mid);
    const retry = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("重试"));
    expect((retry as HTMLButtonElement).disabled).toBe(true);
    expect(retry?.getAttribute("title")).toContain("更新中");
    const copy = btn('[data-testid="ov6-rid-copy"]');
    expect(copy?.disabled).toBe(true);
    expect(copy?.getAttribute("title")).toContain("更新中");
    await act(async () => {
      release?.();
    });
    await act(async () => {});
    expect(urls.length).toBeGreaterThan(before);
  });
});
