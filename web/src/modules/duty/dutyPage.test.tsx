// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useSearchParams } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import { ApiError } from "@/lib/api-error";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchJSON: (...args: unknown[]) => fetchJSON(...args),
}));

import DutyPage from "./DutyPage";
import { dutyGates } from "./dutyGates";
import { runsCaliber } from "./runsCaliber";
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
    fetchJSON.mockImplementation((url: string) => {
      // 四门证据源未接线：逐门应显示「待核实」，主数字不给伪权威总数。
      if (
        url.includes("/workstations") ||
        url.includes("/effective-config") ||
        url.includes("/knowledge/citations") ||
        (url.includes("/approvals") && url.includes("status=all"))
      ) {
        return Promise.reject(
          new ApiError("source not wired", {
            status: 404,
            body: '{"code":"knowledge.not_wired","asOf":"2026-11-23T15:11:05Z"}',
            url,
            requestId: "req-unknown-gate",
          }),
        );
      }
      return Promise.resolve(ok(url));
    });
    await render(<DutyPage />);
    const text = container.textContent ?? "";
    for (const title of ["可上岗", "今日运行", "今日成本", "近 14 天运行", "近 14 天活跃", "阻塞", "待我处理", "最近运行"]) {
      expect(text).toContain(title);
    }
    expect(container.querySelectorAll('[data-card="duty"]')).toHaveLength(8);
    // 三分态取代单一权威数字：证据没回答的行归「待核实」，绝不冒充百分比。
    const readyValue = container.querySelector('[data-duty-testid="duty-ready-value"]')?.textContent ?? "";
    expect(readyValue).toContain("已确认 0 · 待核实 1 · 未达 0");
    expect(readyValue).not.toMatch(/\d+(\.\d+)?%/);
    expect(text).toContain("待核实");
    expect(container.querySelector('[data-testid="duty-ready-denominator"]')?.textContent ?? "").toContain(
      // DU-08①·D1：标签词「分母口径」收进 glossary duty.denominator（折叠区 InfoHint 承载），
      // 卡内仍留同一条动态真数句——披露内容一字未减，只去掉禁词词面（卡内零按钮，
      // 见 duty.slotCounts「正常态不许摆按钮」）。
      "分母：目录已加载 1 条",
    );
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
    // 队列卡不再打 /approvals?status=pending；四门证据腿读 status=all 是有意为之。
    expect(seen.some((u) => u.includes("/approvals?status=pending") || u.includes("/approvals?limit"))).toBe(false);
    expect(seen.some((u) => u.includes("/approvals?status=all"))).toBe(true);
    expect(seen.some((u) => u.includes("/workstations?"))).toBe(true);
    expect(seen.some((u) => u.includes("/effective-config?"))).toBe(true);
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

    // DU-06① 改了这一相：在飞不再是「能点但悄悄吞掉」，而是 aria-disabled＋原因句。
    const busy = dutyGates({ loading: false, refreshing: true, allFailed: false });
    expect(busy.refresh.enabled).toBe(false);
    expect(busy.refresh.title).toContain("这一轮读完成前重复点没有意义");
    expect(busy.retry.enabled).toBe(false);
    expect(busy.copy.enabled).toBe(false);
    expect(busy.retry.title).toContain("更新中");

    // DU-06①：读完但还在最小间隔窗口内，同一颗钮给另一句原因。
    const cooling = dutyGates({ loading: false, refreshing: false, allFailed: false, cooling: true });
    expect(cooling.refresh.enabled).toBe(false);
    expect(cooling.refresh.title).toContain("不能刷新");
    expect(cooling.refresh.title).toContain("5 秒");

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

describe("DutyPage trend accessibility", () => {
  const q = (sel: string) => container.querySelector(sel);
  const click = async (el: Element | null) => {
    await act(async () => {
      (el as HTMLElement).click();
    });
  };

  it("summarises the very buckets the chart draws, with a described figure", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await render(<DutyPage />);
    const figure = q('[data-testid="duty-trend-figure"]');
    expect(figure?.getAttribute("role")).toBe("img");
    expect(figure?.getAttribute("aria-describedby")).toBe("duty-trend-summary");
    const summary = q('[data-testid="duty-trend-summary"]')?.textContent ?? "";
    expect(summary).toContain("首日 11/17 1 次");
    // metAG-style caliber: the third day came back without a value, so it keeps
    // its slot on the axis and its reading is «—», not 0 or the previous day.
    expect(summary).toContain("末日 11/19");
    expect(q('[data-testid="duty-trend-last"]')?.textContent).toBe("—");
    expect(summary).toContain("峰值 11/18 2 次");
    expect(summary).toContain("最低 11/17 1 次");
    expect(q('[data-testid="duty-trend-total"]')?.textContent).toBe("3");
    expect(q('[data-testid="ov6-trend"] .duty-num')?.textContent).toContain("3");
  });

  it("opens and closes the table on a native button without a single new request", async () => {
    const urls: string[] = [];
    fetchJSON.mockImplementation((url: string) => {
      urls.push(url);
      return Promise.resolve(ok(url));
    });
    await render(<DutyPage />);
    const before = urls.length;
    const toggle = q('[data-testid="duty-trend-table-toggle"]');
    expect(toggle?.tagName).toBe("BUTTON");
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(toggle?.getAttribute("aria-controls")).toBe("duty-trend-table");
    expect(q('[data-testid="duty-trend-table"]')).toBeNull();
    await click(toggle);
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    const table = q('[data-testid="duty-trend-table"]');
    expect(table).not.toBeNull();
    expect(table?.querySelector("caption")?.textContent).toContain("北京时间");
    expect([...table!.querySelectorAll("th")].map((th) => th.getAttribute("scope"))).toEqual(["col", "col"]);
    expect(table!.querySelectorAll("tbody tr")).toHaveLength(3);
    expect(urls.length).toBe(before);
    await click(toggle);
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(q('[data-testid="duty-trend-table"]')).toBeNull();
  });

  it("says the window is empty and still offers an empty table instead of summing to zero", async () => {
    fetchJSON.mockImplementation((url: string) => {
      if (url.includes("/workbench/timeseries")) {
        return Promise.resolve({ asOf: WB_ASOF, available: true, points: [], totals: null });
      }
      return Promise.resolve(ok(url));
    });
    await render(<DutyPage />);
    expect(q('[data-testid="duty-trend-summary"]')?.textContent).toContain("该区间没有运行记录");
    await click(q('[data-testid="duty-trend-table-toggle"]'));
    const table = q('[data-testid="duty-trend-table"]');
    expect(table?.querySelectorAll("tbody tr")).toHaveLength(0);
    expect(q('[data-testid="duty-trend-table-empty"]')?.textContent).toContain("没有可列出的行");
  });

  it("shows four dashes with the failure reason when the trend source is down", async () => {
    fetchJSON.mockImplementation((url: string) => {
      if (url.includes("/workbench/timeseries")) {
        return Promise.reject(new ApiError("trend down", { status: 500, body: "{}", url, requestId: "req-trend-1" }));
      }
      return Promise.resolve(ok(url));
    });
    await render(<DutyPage />);
    for (const id of ["first", "last", "peak", "low", "total"]) {
      expect(q(`[data-testid="duty-trend-${id}"]`)?.textContent).toBe("—");
    }
    const title = q('[data-testid="duty-trend-summary"]')?.getAttribute("title") ?? "";
    expect(title).toContain("req-trend-1");
    expect(title).toContain("不把缺数当 0");
    expect(q('[data-testid="ov6-kpi-runs"]')?.textContent).toContain("2");
  });
});

function RangeProbe() {
  const [params] = useSearchParams();
  return <span data-testid="duty-range-loc">{params.toString()}</span>;
}

describe("DutyPage time range", () => {
  const q = (sel: string) => container.querySelector(sel);

  it("writes the chosen range to the address and restores it from a pasted link", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/?range=30d"]}>
          <DutyPage />
          <RangeProbe />
        </MemoryRouter>,
      );
    });
    await act(async () => {});
    expect(q('[data-testid="duty-range-30d"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("近 30 天运行");
    expect(q('[data-testid="duty-range-loc"]')?.textContent).toBe("range=30d");
    await act(async () => {
      (q('[data-testid="duty-range-14d"]') as HTMLButtonElement).click();
    });
    await act(async () => {});
    expect(q('[data-testid="duty-range-loc"]')?.textContent).toBe("");
  });

  it("offers four real range buttons and the default 14d window drives both time reads", async () => {
    const urls: string[] = [];
    fetchJSON.mockImplementation((url: string) => {
      urls.push(url);
      return Promise.resolve(ok(url));
    });
    await render(<DutyPage />);
    for (const id of ["24h", "7d", "14d", "30d"]) {
      expect(q(`[data-testid="duty-range-${id}"]`)).toBeTruthy();
    }
    expect(q('[data-testid="duty-range-14d"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(q('[data-testid="duty-range-7d"]')?.getAttribute("aria-pressed")).toBe("false");
    expect(urls.filter((u) => u.includes("/workbench/timeseries")).length).toBe(1);
    expect(urls.some((u) => u.includes("/workbench/timeseries") && u.includes("range=30d"))).toBe(true);
    expect(urls.some((u) => u.includes("/run-activity") && u.includes("weeks=2"))).toBe(true);
  });

  it("switching to 7d re-reads only the two time-dependent readers, once each", async () => {
    const urls: string[] = [];
    fetchJSON.mockImplementation((url: string) => {
      urls.push(url);
      return Promise.resolve(ok(url));
    });
    await render(<DutyPage />);
    const initial = urls.length;
    await act(async () => {
      (q('[data-testid="duty-range-7d"]') as HTMLButtonElement).click();
    });
    await act(async () => {});
    const added = urls.slice(initial);
    expect(added.filter((u) => u.includes("/workbench/timeseries")).length).toBe(1);
    expect(added.find((u) => u.includes("/workbench/timeseries"))).toContain("range=7d");
    expect(added.filter((u) => u.includes("/run-activity")).length).toBe(1);
    expect(added.find((u) => u.includes("/run-activity"))).toContain("weeks=1");
    for (const path of ["/employees", "/employee-stats", "/workbench/queue", "/budget-usage", "/tasks"]) {
      expect(added.some((u) => u.includes(path))).toBe(false);
    }
    expect(q('[data-testid="duty-range-7d"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(q('[data-testid="duty-range-14d"]')?.getAttribute("aria-pressed")).toBe("false");
    expect(container.textContent).toContain("近 7 天运行");
  });

  it("drops a late answer from the previous window", async () => {
    const pending: { range: string; resolve: () => void }[] = [];
    fetchJSON.mockImplementation((url: string) => {
      if (url.includes("/workbench/timeseries")) {
        const range = /range=([^&]+)/.exec(url)?.[1] ?? "";
        if (range === "7d" || range === "30d") {
          const value = range === "7d" ? 7 : 30;
          return new Promise((resolve) => {
            pending.push({
              range,
              resolve: () =>
                resolve({
                  asOf: WB_ASOF,
                  points: [{ ts: "2026-11-18T00:00:00.000Z", label: "11-18", value }],
                  totals: { metric: "runs", value },
                }),
            });
          });
        }
      }
      return Promise.resolve(ok(url));
    });
    await render(<DutyPage />);
    await act(async () => {
      (q('[data-testid="duty-range-7d"]') as HTMLButtonElement).click();
    });
    await act(async () => {
      (q('[data-testid="duty-range-30d"]') as HTMLButtonElement).click();
    });
    // Resolve the stale 7d batch first: it must not paint over the 30d window.
    await act(async () => {
      pending.find((p) => p.range === "7d")?.resolve();
    });
    await act(async () => {
      pending.find((p) => p.range === "30d")?.resolve();
    });
    expect(q('[data-testid="duty-trend-total"]')?.textContent).toBe("30");
    expect(container.textContent).toContain("近 30 天运行");
  });
});

describe("DutyPage runs caliber", () => {
  const q = (sel: string) => container.querySelector(sel);

  it("shows this card's value, both read paths and the batch stamp without extra requests", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await render(<DutyPage />);
    const before = fetchJSON.mock.calls.length;
    const line = q('[data-testid="duty-runs-caliber"]');
    expect(line).not.toBeNull();
    expect(q('[data-testid="duty-runs-value"]')?.textContent).toBe("2");
    expect(q('[data-testid="ov6-kpi-runs"]')?.textContent).toContain("2");
    expect(q('[data-testid="duty-runs-asof"]')?.textContent).toBe("2026-11-18 14:00");
    const text = line?.textContent ?? "";
    expect(text).toContain("workbench/summary?range=1d");
    expect(text).toContain("/api/run-stats");
    expect(q('[data-testid="duty-runs-verdict"]')?.textContent).toContain("不在本页取");
    const title = line?.getAttribute("title") ?? "";
    expect(title).toContain("workbench/summary?range=1d");
    expect(title).toContain("/api/run-stats");
    expect(title).toContain("不另发请求");
    expect(fetchJSON.mock.calls.length).toBe(before);
  });

  it("keeps the three verdicts apart in the pure helper", () => {
    const equal = runsCaliber({ duty: 3, metrics: 3, dutyAsOfText: "2026-11-18 14:00" });
    expect(equal.verdict).toBe("equal");
    expect(equal.compare).toBe("与 /metrics 同源一致（3）");

    const diff = runsCaliber({ duty: 3, metrics: 5, dutyAsOfText: "2026-11-18 14:00" });
    expect(diff.verdict).toBe("different");
    // DU-07③：原句「口径不同，见 title」把结论的唯一载体放在悬停里，判据不允许；
    // 改为自足句（完整相遇条件仍留在 title 作补充）。这是本轮对既有断言的**唯一**
    // 措辞更新，理由见 DONE-DU-07.md。
    expect(diff.compare).toBe("本卡 3 · /metrics 5｜两条读口不同，不为对上改任一侧取数");
    expect(diff.compare).not.toContain("见 title");

    const missing = runsCaliber({ duty: null, metrics: null, dutyAsOfText: "—" });
    expect(missing.verdict).toBe("missing");
    expect(missing.compare).toContain("没读到运行数");
    expect(missing.title).toContain("不当作 0");
  });
});

describe("DutyPage caliber notes", () => {
  const q = (sel: string) => container.querySelector(sel);

  it("stays collapsed by default and does not fire a request", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await render(<DutyPage />);
    const before = fetchJSON.mock.calls.length;
    const toggle = q('[data-testid="duty-notes-toggle"]') as HTMLButtonElement | null;
    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(toggle?.getAttribute("aria-controls")).toBe("duty-notes-body");
    expect(q('[data-testid="duty-notes-body"]')).toBeNull();
    expect(q('[data-testid="duty-note-today-runs"]')).toBeNull();
    expect(fetchJSON.mock.calls.length).toBe(before);
  });

  it("opens eight rows of area · path · scope · missing and closes again for free", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await render(<DutyPage />);
    const before = fetchJSON.mock.calls.length;
    await act(async () => {
      (q('[data-testid="duty-notes-toggle"]') as HTMLButtonElement).click();
    });
    const toggle = q('[data-testid="duty-notes-toggle"]');
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    const keys = [
      "today-runs",
      "trend",
      "readiness",
      "cost",
      "recent-runs",
      "pending",
      "blockers",
      "matrix",
    ];
    for (const key of keys) {
      const row = q(`[data-testid="duty-note-${key}"]`);
      expect(row).not.toBeNull();
      const text = row?.textContent ?? "";
      expect(text).toContain("·");
      expect(text).toMatch(/「—」|「待核实」|「该区间没有运行记录」/);
    }
    expect(q('[data-testid="duty-note-today-runs"]')?.textContent).toContain(
      "workbench/summary?range=1d",
    );
    expect(q('[data-testid="duty-note-matrix"]')?.textContent).toContain("待核实");
    expect(fetchJSON.mock.calls.length).toBe(before);
    await act(async () => {
      (q('[data-testid="duty-notes-toggle"]') as HTMLButtonElement).click();
    });
    expect(q('[data-testid="duty-notes-body"]')).toBeNull();
    expect(fetchJSON.mock.calls.length).toBe(before);
  });
});

describe("DutyPage card drill links", () => {
  it("gives every card a real anchor to a route that exists", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await render(<DutyPage />);
    const expected: Array<[string, string]> = [
      ["duty-route-readiness", "/employees"],
      ["duty-route-today-runs", "/runs"],
      ["duty-route-trend", "/runs"],
      ["duty-route-cost", "/metrics"],
      ["duty-route-pending", "/approvals"],
      ["duty-route-blockers", "/work"],
    ];
    for (const [testid, href] of expected) {
      const el = container.querySelector(`[data-testid="${testid}"]`) as HTMLAnchorElement | null;
      expect(el, testid).not.toBeNull();
      expect(el!.tagName).toBe("A");
      expect(el!.getAttribute("href")).toBe(href);
      expect(el!.getAttribute("onclick")).toBeNull();
    }
    const blockers = container.querySelector('[data-testid="duty-route-blockers"]') as HTMLAnchorElement;
    expect(blockers.getAttribute("title")).toContain("不接受 status 筛选");
  });

  it("keeps the drill links when the card data fails and never strands the reader", async () => {
    fetchJSON.mockImplementation((url: string) => {
      if (url.includes("/workbench/summary")) {
        return Promise.reject(new ApiError("boom", { status: 500, body: "", url, requestId: "req-drill-1" }));
      }
      return Promise.resolve(ok(url));
    });
    await render(<DutyPage />);
    expect(container.textContent).toContain("请求编号");
    const link = container.querySelector('[data-testid="duty-route-today-runs"]') as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toBe("/runs");
  });

  it("adds no request of its own", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await render(<DutyPage />);
    const calls = fetchJSON.mock.calls.length;
    await act(async () => {});
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchJSON.mock.calls.length).toBe(calls);
  });

  it("links the matrix view to the capabilities page", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await render(<MatrixView />);
    const link = container.querySelector('[data-testid="duty-route-matrix"]') as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link!.tagName).toBe("A");
    expect(link!.getAttribute("href")).toBe("/capabilities");
  });
});

describe("DutyPage refresh delta summary", () => {
  type Phase = { runs: number; cost: number; pending: number; trend: number; blocked: number; costFail?: boolean };
  const basePhase: Phase = { runs: 2, cost: 1.5, pending: 1, trend: 3, blocked: 1 };

  function wire(phase: Phase) {
    fetchJSON.mockImplementation((url: string) => {
      if (url.includes("/budget-usage")) {
        if (phase.costFail) {
          return Promise.reject(new ApiError("boom", { status: 500, body: "", url, requestId: "req-delta-1" }));
        }
        return Promise.resolve({ items: [{ employeeId: "emp_1", costUsd: phase.cost }], missingEmployeeIds: [] });
      }
      if (url.includes("/workbench/summary")) {
        return Promise.resolve({
          asOf: WB_ASOF,
          asOfSource: "bff-aggregation-read-time",
          available: true,
          degraded: [],
          kpis: [
            { key: "runs", label: "运行数", unit: "次", value: phase.runs, available: true },
            { key: "costUsd", label: "成本", unit: "USD", value: phase.cost, available: true },
            { key: "pendingApprovals", label: "待审批", unit: "条", value: phase.pending, available: true },
          ],
        });
      }
      if (url.includes("/workbench/queue")) {
        return Promise.resolve({
          asOf: WB_ASOF,
          asOfSource: "bff-read-time",
          available: true,
          total: phase.pending,
          items: [],
          degraded: [],
        });
      }
      if (url.includes("/workbench/timeseries")) {
        return Promise.resolve({
          asOf: WB_ASOF,
          asOfSource: "bff-read-time",
          available: true,
          points: [{ ts: "2026-11-18T00:00:00.000Z", label: "11-18", value: phase.trend }],
          totals: { metric: "runs", value: phase.trend },
        });
      }
      if (url.includes("/approval-stats")) return Promise.resolve({ pending: phase.pending, dueSoon: 0 });
      if (url.includes("/tasks")) {
        return Promise.resolve({
          items: Array.from({ length: phase.blocked }, (_, i) => ({ taskId: `tsk_${i}`, title: "整理周报", status: "blocked" })),
        });
      }
      return Promise.resolve(ok(url));
    });
  }

  async function clickRefresh() {
    const button = container.querySelector('[data-testid="duty-refresh"]') as HTMLButtonElement;
    await act(async () => {
      button.click();
    });
    await act(async () => {});
    await new Promise((r) => setTimeout(r, 20));
    await act(async () => {});
  }

  it("lists at most three changed cards and counts the rest", async () => {
    const phase: Phase = { ...basePhase };
    wire(phase);
    await render(<DutyPage />);
    expect(container.querySelector('[data-testid="duty-changed"]')).toBeNull();
    phase.runs = 5;
    phase.cost = 4;
    phase.pending = 0;
    phase.trend = 9;
    phase.blocked = 3;
    await clickRefresh();
    const line = container.querySelector('[data-testid="duty-changed"]') as HTMLParagraphElement;
    expect(line).not.toBeNull();
    expect(line.getAttribute("aria-live")).toBe("polite");
    expect(line.textContent).toContain("今日运行 2 → 5");
    expect(line.textContent).toContain("今日成本 $1.50 → $4.00");
    expect(line.textContent).toContain("待我处理 1 → 0");
    expect(line.querySelectorAll("[data-testid^='duty-changed-']")).toHaveLength(4);
    expect(container.querySelector('[data-testid="duty-changed-more"]')?.textContent).toContain("另有 2 项变化");
    expect(line.textContent).not.toContain("区间运行");
  });

  it("renders nothing when a refresh brings the same readings", async () => {
    wire({ ...basePhase });
    await render(<DutyPage />);
    await clickRefresh();
    expect(container.querySelector('[data-testid="duty-changed"]')).toBeNull();
  });

  it("leaves a failed card out instead of reporting a drop to zero", async () => {
    const phase: Phase = { ...basePhase };
    wire(phase);
    await render(<DutyPage />);
    phase.runs = 5;
    phase.costFail = true;
    await clickRefresh();
    expect(container.querySelector('[data-testid="duty-changed-cost"]')).toBeNull();
    expect(container.querySelector('[data-testid="duty-changed-today-runs"]')?.textContent).toContain("2 → 5");
    expect(container.querySelector('[data-testid="duty-changed"]')?.textContent).not.toContain("$0.00");
  });

  it("resets the baseline when the time range changes", async () => {
    const phase: Phase = { ...basePhase };
    wire(phase);
    await render(<DutyPage />);
    phase.runs = 5;
    await clickRefresh();
    expect(container.querySelector('[data-testid="duty-changed"]')).not.toBeNull();
    const range = container.querySelector('[data-testid="duty-range-7d"]') as HTMLButtonElement;
    await act(async () => {
      range.click();
    });
    await act(async () => {});
    await new Promise((r) => setTimeout(r, 20));
    await act(async () => {});
    expect(container.querySelector('[data-testid="duty-changed"]')).toBeNull();
  });
});

describe("DutyPage timeseries range contract", () => {
  const q = (sel: string) => container.querySelector(sel);
  async function until(cond: () => boolean, label: string) {
    for (let i = 0; i < 120; i += 1) {
      if (cond()) return;
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });
    }
    throw new Error(`timeout: ${label}`);
  }

  it("only ever asks the workbench reader for a range it accepts", async () => {
    const calls: string[] = [];
    fetchJSON.mockImplementation((url: string) => {
      calls.push(url);
      return Promise.resolve(ok(url));
    });
    await render(<DutyPage />);
    await until(() => calls.length > 0, "requests");
    const series = calls.filter((u) => u.includes("/workbench/timeseries"));
    expect(series.length).toBeGreaterThan(0);
    for (const url of series) {
      const qs = new URLSearchParams(url.split("?")[1] ?? "");
      expect(["24h", "1d", "7d", "30d"]).toContain(qs.get("range"));
      expect(qs.get("bucket")).toBe("day");
      expect(["runs", "failed", "costUsd"]).toContain(qs.get("metric"));
    }
  });

  it("keeps the last 14 buckets of the 30 day answer and recomputes the total", async () => {
    const points = Array.from({ length: 30 }, (_, i) => ({
      ts: `2026-11-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
      label: `11/${i + 1}`,
      value: 1,
    }));
    fetchJSON.mockImplementation((url: string) => {
      if (url.includes("/workbench/timeseries")) {
        return Promise.resolve({ asOf: WB_ASOF, available: true, points, totals: { metric: "runs", value: 30 } });
      }
      return Promise.resolve(ok(url));
    });
    await render(<DutyPage />);
    await until(() => q('[data-testid="duty-trend-total"]') !== null, "summary");
    expect(q('[data-testid="duty-trend-total"]')?.textContent).toBe("14");
    const toggle = q('[data-testid="duty-trend-table-toggle"]') as HTMLButtonElement;
    await act(async () => {
      toggle.click();
    });
    await act(async () => {});
    const rows = q('[data-testid="duty-trend-table"]')?.querySelectorAll("tbody tr") ?? [];
    expect(rows.length).toBe(14);
    expect(rows[0].textContent).toContain("11/17");
  });
});

describe("DutyPage trend window caliber note", () => {
  const q = (sel: string) => container.querySelector(sel);
  async function until(cond: () => boolean, label: string) {
    for (let i = 0; i < 120; i += 1) {
      if (cond()) return;
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });
    }
    throw new Error(`timeout: ${label}`);
  }
  const points30 = Array.from({ length: 30 }, (_, i) => ({
    ts: `2026-11-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
    label: `11/${i + 1}`,
    value: 1,
  }));
  function wire30() {
    fetchJSON.mockImplementation((url: string) => {
      if (url.includes("/workbench/timeseries")) {
        return Promise.resolve({ asOf: WB_ASOF, available: true, points: points30, totals: { metric: "runs", value: 30 } });
      }
      return Promise.resolve(ok(url));
    });
  }
  const text = (sel: string) => q(sel)?.textContent ?? "";

  it("explains the trimmed window and keeps the four labels on the same 14 days", async () => {
    wire30();
    await render(<DutyPage />);
    await until(() => text('[data-testid="duty-trend-total"]') === "14", "trimmed total");
    expect(text('[data-testid="duty-trend-window-note"]')).toBe("数据取近 30 天，本卡只显示最近 14 天");
    const card = q('[data-testid="ov6-trend"]') ?? q('[data-testid="duty-trend"]');
    expect(card?.textContent).toContain("近 14 天运行");
    expect(text('[data-testid="duty-trend-summary"]').startsWith("近 14 天：")).toBe(true);
    expect(q('[data-testid="duty-trend-figure"]')?.getAttribute("aria-label")).toBe("近 14 天每日运行次数");
    expect(card?.textContent).not.toContain("近 30 天运行");
    const toggle = q('[data-testid="duty-trend-table-toggle"]') as HTMLButtonElement;
    await act(async () => {
      toggle.click();
    });
    await act(async () => {});
    expect(q('[data-testid="duty-trend-table"] caption')?.textContent).toBe("近 14 天每日运行次数（北京时间）");
    const rows = q('[data-testid="duty-trend-table"]')?.querySelectorAll("tbody tr") ?? [];
    expect(rows.length).toBe(14);
  });

  it("drops the 30 day sentence for 7d and 30d, and labels them by their own window", async () => {
    wire30();
    await render(<DutyPage />);
    await until(() => text('[data-testid="duty-trend-total"]') !== "—", "initial summary");
    const seven = q('[data-testid="duty-range-7d"]') as HTMLButtonElement;
    await act(async () => {
      seven.click();
    });
    await until(
      () => q('[data-testid="duty-trend-figure"]')?.getAttribute("aria-label") === "近 7 天每日运行次数",
      "7d label",
    );
    expect(q('[data-testid="duty-trend-window-note"]')).toBeNull();
    expect(text('[data-testid="duty-trend-summary"]')).not.toContain("近 14 天");
    const thirty = q('[data-testid="duty-range-30d"]') as HTMLButtonElement;
    await act(async () => {
      thirty.click();
    });
    await until(
      () => q('[data-testid="duty-trend-figure"]')?.getAttribute("aria-label") === "近 30 天每日运行次数",
      "30d label",
    );
    expect(q('[data-testid="duty-trend-window-note"]')).toBeNull();
  });

  it("uses the current range in the loading summary instead of a hardcoded 14", async () => {
    fetchJSON.mockImplementation((url: string) => {
      if (url.includes("/workbench/timeseries")) return new Promise(() => {});
      return Promise.resolve(ok(url));
    });
    await render(<DutyPage />);
    await until(
      () => text('[data-testid="duty-trend-summary"]').includes("近 14 天"),
      "default loading summary",
    );
    const seven = q('[data-testid="duty-range-7d"]') as HTMLButtonElement;
    await act(async () => {
      seven.click();
    });
    await until(
      () => text('[data-testid="duty-trend-summary"]').includes("近 7 天"),
      "7d loading summary",
    );
    expect(text('[data-testid="duty-trend-summary"]')).toContain("正在读取近 7 天的运行记录");
    expect(text('[data-testid="duty-trend-summary"]')).not.toContain("近 14 天");
  });

  it("adds no request of its own", async () => {
    wire30();
    await render(<DutyPage />);
    await until(() => text('[data-testid="duty-trend-total"]') === "14", "trimmed total");
    const calls = fetchJSON.mock.calls.length;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });
    expect(fetchJSON.mock.calls.length).toBe(calls);
    expect(q('[data-testid="duty-trend-window-note"]')).not.toBeNull();
  });
});

describe("DutyPage row-level drill links (B1-duty P0#1)", () => {
  it("sends run rows to the registered query form /runs/?run= — not the unregistered path form", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await render(<DutyPage />);
    const rows = Array.from(container.querySelectorAll("a.duty-row-title"));
    expect(rows.length).toBeGreaterThan(0);
    for (const a of rows) {
      expect(a.getAttribute("href")).toBe("/runs/?run=run_abcdef123456");
    }
  });

  it("sends approval blocker rows to /approvals?id= and keeps no dead path forms", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await render(<DutyPage />);
    const links = Array.from(container.querySelectorAll("a.duty-link")).map((a) => a.getAttribute("href"));
    expect(links).toContain("/approvals?id=apr_1");
    expect(links.some((h) => /^\/approvals\//.test(h ?? ""))).toBe(false);
    expect(links.some((h) => /^\/runs\/[^?]/.test(h ?? ""))).toBe(false);
  });
});

describe("DutyPage runs status filter (B1 筛选控件条)", () => {
  const b = (testId: string) => container.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement | null;
  // 三卡返工：最近运行明细不再进卡片，挪到卡外折叠区，所以取样范围跟着挪。
  const card = () => container.querySelector('[data-testid="duty-details-runs"]');
  const rows = () => card()?.querySelectorAll("li").length ?? 0;
  const press = (testId: string) => {
    act(() => {
      (b(testId) as HTMLButtonElement).click();
    });
  };

  it("renders the four state filter chips as an aria-pressed group", async () => {
    fetchJSON.mockImplementation(async (url: unknown) => ok(String(url)));
    await render(<DutyPage />);
    const group = container.querySelector('[role="group"][aria-label="运行状态筛选"]');
    expect(group, "运行状态筛选 group").not.toBeNull();
    for (const id of ["all", "running", "completed", "failed"]) {
      expect(b(`duty-status-${id}`), `chip ${id}`).not.toBeNull();
    }
    expect(b("duty-status-all")?.getAttribute("aria-pressed")).toBe("true");
    expect(b("duty-status-failed")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("is URL-owned: ?status=failed presses the chip and keeps only failed rows", async () => {
    fetchJSON.mockImplementation(async (url: unknown) => ok(String(url)));
    await act(async () => {
      root.render(<MemoryRouter initialEntries={["/overview?status=failed"]}><DutyPage /></MemoryRouter>);
    });
    await act(async () => {});
    expect(b("duty-status-failed")?.getAttribute("aria-pressed")).toBe("true");
    expect(b("duty-status-all")?.getAttribute("aria-pressed")).toBe("false");
    expect(rows()).toBe(1);
    const href = card()?.querySelector("a.duty-row-title")?.getAttribute("href");
    expect(href).toBe("/runs/?run=run_abcdef123456");
  });

  it("filters rows by state and the empty face clears the filter back", async () => {
    fetchJSON.mockImplementation(async (url: unknown) => {
      const u = String(url);
      if (u.includes("/runs") && !u.includes("run-")) {
        return {
          items: [
            { runId: "run_running00001", employeeId: "emp_1", status: "running", startedAt: "2026-11-18T03:00:00Z" },
            { runId: "run_abcdef123456", employeeId: "emp_1", status: "failed", startedAt: "2026-11-18T02:00:00Z" },
          ],
        };
      }
      return ok(u);
    });
    await render(<DutyPage />);
    expect(rows()).toBe(2);
    press("duty-status-completed");
    expect(b("duty-status-completed")?.getAttribute("aria-pressed")).toBe("true");
    expect(rows()).toBe(0);
    expect(container.querySelector('[data-testid="duty-status-empty"]')).not.toBeNull();
    expect(b("duty-status-clear"), "清空筛选").not.toBeNull();
    press("duty-status-clear");
    expect(b("duty-status-all")?.getAttribute("aria-pressed")).toBe("true");
    expect(rows()).toBe(2);
  });
});

// ── 用户直令 2026-11-23：值班台三卡固定槽位 + 同行等高 + 工程话术不上卡 ──────────
describe("DutyPage 三卡固定槽位返工", () => {
  const firstRow = () =>
    Array.from(container.querySelectorAll<HTMLElement>('.duty-grid-3 > [data-card="duty"]')).slice(0, 3);

  it("等高：同行三卡由网格 stretch 统一，卡片主体撑满", async () => {
    const css = readFileSync("src/modules/duty/duty.css", "utf8");
    // 逐块匹配：.duty-grid 与 .duty-card 在文件里各出现两次（基线块 + 返工追加块），
    // 只要求「存在一个块含该声明」，不按 indexOf 取区间，免得锚到前一个块。
    expect(css, "三卡所在网格必须 align-items:stretch").toMatch(
      /\.duty-grid\s*\{[^}]*align-items:\s*stretch/,
    );
    expect(css, "卡片自身要成列，主体才能撑满等高").toMatch(
      /\.duty-card\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/,
    );
    expect(css, "卡内主体 flex:1 = 高度由最高卡决定并统一").toMatch(
      /\.duty-card > \.duty-card-bd\s*\{[^}]*flex:\s*1 1 auto/,
    );
    expect(css, "深链钉在卡底，空档不外溢成无序空白").toMatch(
      /\.duty-card-foot\s*\{[^}]*margin-block-start:\s*auto/,
    );
  });

  it("槽位：三卡只剩标题/主数字/一句状态/查看明细，明细全部在卡外折叠区", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await render(<DutyPage />);
    const cards = firstRow();
    expect(cards, "三卡在场").toHaveLength(3);
    for (const card of cards) {
      for (const banned of [".duty-gates", ".duty-list", ".duty-ranges", ".duty-runs-caliber", ".duty-kpis"]) {
        expect(card.querySelector(banned), "卡内不许再放明细：" + banned).toBeNull();
      }
      expect(card.querySelectorAll(".duty-num").length, "每卡恰好一个主数字").toBe(1);
      expect(card.querySelectorAll(".duty-say").length, "每卡恰好一句状态").toBe(1);
      expect(card.querySelectorAll("[data-testid], [data-duty-testid]").length).toBeGreaterThan(0);
      const foot = card.querySelectorAll(".duty-card-foot");
      expect(foot, "每卡一个查看明细深链").toHaveLength(1);
      expect(foot[0].tagName, "深链必须是链接（走明细页/抽屉，不是删信息）").toBe("A");
      expect(foot[0].textContent ?? "", "深链带服务端真给行数或明说未提供").toMatch(
        /查看全部 \((\d+|数量未提供)\)/,
      );
    }
    const runs = cards[1];
    expect(runs.querySelector('[data-testid="ov6-kpi-runs"]')?.textContent, "今日运行主数字=运行数").toContain("2");
    const details = container.querySelector<HTMLElement>('[data-testid="duty-details"]');
    expect(details, "卡外明细折叠区必须在场").not.toBeNull();
    const moved = details?.querySelector('[data-testid="duty-today-runs-kpis"]');
    expect(moved, "今日运行的三格 KPI 挪到卡外（信息不删）").not.toBeNull();
    for (const label of ["成功率", "在跑", "失败"]) {
      expect(moved?.textContent ?? "", "卡外三格标签：" + label).toContain(label);
    }
    expect(details?.querySelector(".duty-gates"), "检查项挪到卡外").not.toBeNull();
    expect(details?.querySelector('[data-testid="duty-runs-caliber"]'), "口径挪到卡外").not.toBeNull();
    expect(details?.querySelector('[data-testid="duty-status-all"]'), "状态筛选挪到卡外").not.toBeNull();
  });

  it("话术：卡片可见文本零工程 token、零 blurb/hint 长文", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await render(<DutyPage />);
    const BANNED = /emp_|ce_|ob_|http|rid|correlation/i;
    for (const card of firstRow()) {
      const text = card.textContent ?? "";
      expect(text, "卡面不许出现内部标识/端点/审计号").not.toMatch(BANNED);
      expect(text.length, "卡面只留槽位短句（当前=" + text.length + "）").toBeLessThan(220);
      expect(card.getAttribute("title") ?? "", "长 blurb 不许挂在卡框上").not.toMatch(
        /workbench\/agents|byLifecycle/,
      );
    }
  });

  it("手机档：≤820px 控件补到 44px 触控高", () => {
    const css = readFileSync("src/modules/duty/duty.css", "utf8");
    const phone = css.slice(css.lastIndexOf("@media (max-width: 820px)"));
    expect(phone).toMatch(
      /\.duty-kpi[^{]*\.duty-card-foot[^{]*\.duty-details-summary[^{]*\.duty-range\s*\{[^}]*min-block-size:\s*44px/,
    );
  });
});
