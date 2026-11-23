// @vitest-environment jsdom
/**
 * DU-06 刷新节流与窗口切换一致性——DoD 计数证据。
 *
 * 这里不数「按钮看起来禁用没」，只数**上游真发了几条请求**：`fetchJSON` 是本页
 * 唯一的出网口（api.ts 全部走它），所以它的调用序列就是上游请求数。
 *  - ① 连点 10 次刷新 ⇒ 一批封顶（busyRef 单飞 + 最小间隔窗口）；
 *  - ① 窗口过完后恢复；窗口值就是 dutyGates 里那个测量出来的常量；
 *  - ② refreshAt 成功批记录、失败批不更新；
 *  - ③ mount 只一整批，且首读在飞时点刷新不叠第二批；
 *  - DoD 切窗只 stats14＋activity 两路重发；
 *  - ④ 没有自动刷新：静置不产生任何请求。
 */
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
import { DUTY_REFRESH_INFLIGHT_REASON, DUTY_REFRESH_MIN_INTERVAL_MS } from "./dutyGates";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  fetchJSON.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const WB_ASOF = "2026-11-18T06:00:00.000Z";

/** 与 dutyPage.test.tsx 同一套响应形制：每条腿都能正常回答。 */
function ok(url: string): unknown {
  if (url.includes("/workbench/summary")) {
    return {
      asOf: WB_ASOF,
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
      available: true,
      points: [
        { ts: "2026-11-17T00:00:00.000Z", label: "11-17", value: 1 },
        { ts: "2026-11-18T00:00:00.000Z", label: "11-18", value: 2 },
      ],
      totals: { metric: "runs", value: 3 },
    };
  }
  if (url.includes("/workbench/queue")) {
    return {
      asOf: WB_ASOF,
      available: true,
      degraded: [],
      items: [{ id: "apr_1", title: "供应商报价", status: "pending", createdAt: "2026-11-18T01:00:00.000Z", timeoutAt: null }],
      total: 1,
    };
  }
  if (url.includes("/employee-stats")) return { byLifecycle: { active: 1, paused: 0, offboarding: 0 } };
  if (url.includes("/employees")) {
    return { items: [{ employeeId: "emp_1", name: "陈可", lifecycleState: "active", ownerUserId: "u_1" }] };
  }
  if (url.includes("/run-activity")) return { max: 2, cells: [{ dow: 2, hour: 10, count: 2 }] };
  if (url.includes("/budget-usage")) return { items: [{ employeeId: "emp_1", costUsd: 1.5 }], missingEmployeeIds: [] };
  if (url.includes("/approvals")) return { items: [{ approvalId: "apr_1", title: "供应商报价", status: "pending" }] };
  if (url.includes("/tasks")) return { items: [{ taskId: "tsk_1", title: "整理周报", status: "blocked" }] };
  if (url.includes("/runs")) {
    return { items: [{ runId: "run_abcdef123456", employeeId: "emp_1", status: "failed", startedAt: "2026-11-18T02:00:00Z" }] };
  }
  return { items: [] };
}

/** 出网请求计数：`paths` 命中几条。 */
const hits = (urls: readonly string[], path: string) => urls.filter((u) => u.includes(path)).length;

/** 每个「读口」的期望批内条数（runs 三张卡、budget 两本账、queue 一条喂两卡）。 */
const LEG_PATHS = [
  "/employees",
  "/employee-stats",
  "/workbench/summary",
  "/workbench/timeseries",
  "/workbench/queue",
  "/run-activity",
  "/budget-usage",
  "/approvals",
  "/tasks",
] as const;

async function renderPage() {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <DutyPage />
      </MemoryRouter>,
    );
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

const btn = (sel: string) => container.querySelector(sel) as HTMLButtonElement | null;
const clickRefresh = async () => {
  await act(async () => {
    btn("[data-testid='duty-refresh']")?.click();
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
};

describe("DU-06③ mount 只一整批，且不叠第二批", () => {
  it("挂载就一条整批：每个读口批内次数固定，没有并发全量重读", async () => {
    const urls: string[] = [];
    fetchJSON.mockImplementation((url: string) => {
      urls.push(url);
      return Promise.resolve(ok(url));
    });
    await renderPage();

    for (const path of LEG_PATHS) {
      // 整批口径：一个读口一次（budget 两本账、runs 三个窗、approvals 一条证据腿另计）。
      const expected = path === "/budget-usage" ? 2 : 1;
      expect(hits(urls, path), path).toBe(expected);
    }
    expect(hits(urls, "/runs?")).toBe(3); // 今日 / 近 7 天 / 失败，三条独立窗口
    expect(hits(urls, "/workbench/queue")).toBe(1); // 一次请求喂两卡
    expect(hits(urls, "/workbench/timeseries")).toBe(1);
    expect(hits(urls, "/run-activity")).toBe(1);
  });

  it("首读还在飞时点刷新，不会叠出第二条整批", async () => {
    const urls: string[] = [];
    let release: (() => void) | null = null;
    fetchJSON.mockImplementation((url: string) => {
      urls.push(url);
      if (url.includes("/employees?")) {
        return new Promise((resolve) => {
          release = () => resolve(ok(url));
        });
      }
      return Promise.resolve(ok(url));
    });
    await act(async () => {
      root.render(
        <MemoryRouter>
          <DutyPage />
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const duringMount = urls.length;

    await clickRefresh();
    expect(urls.length, "首读未落地，刷新一条都不该多发").toBe(duringMount);

    await act(async () => {
      release?.();
      await vi.advanceTimersByTimeAsync(0);
    });
    // 首读落地后补上的是它自己欠的依赖腿（budget/证据），不是第二遍全量读：
    // 每个独立读口仍然只有一条。
    expect(hits(urls, "/employees?")).toBe(1);
    expect(hits(urls, "/workbench/timeseries")).toBe(1);
    expect(hits(urls, "/run-activity")).toBe(1);
    expect(hits(urls, "/workbench/queue")).toBe(1);
  });
});

describe("DU-06① 刷新最小间隔", () => {
  it("连点 10 次刷新 ⇒ 上游请求数封顶在一批之内", async () => {
    const urls: string[] = [];
    fetchJSON.mockImplementation((url: string) => {
      urls.push(url);
      return Promise.resolve(ok(url));
    });
    await renderPage();
    const mount = urls.length;

    await act(async () => {
      const b = btn("[data-testid='duty-refresh']");
      for (let i = 0; i < 10; i += 1) b?.click();
      await vi.advanceTimersByTimeAsync(0);
    });

    const added = urls.slice(mount);
    // 一批 = 每个读口各一次。10 次点击最多换来一批，绝不可能 10 批。
    expect(hits(added, "/employees"), "目录只重读一次").toBe(1);
    expect(hits(added, "/employee-stats")).toBe(1);
    expect(hits(added, "/workbench/summary")).toBe(1);
    expect(hits(added, "/workbench/queue")).toBe(1);
    expect(hits(added, "/runs?")).toBe(3);
    expect(added.length, "上界 = 一整批").toBeLessThanOrEqual(mount);
  });

  it("窗口没走完时再点还是零请求；过完窗口恢复发一整批", async () => {
    const urls: string[] = [];
    fetchJSON.mockImplementation((url: string) => {
      urls.push(url);
      return Promise.resolve(ok(url));
    });
    await renderPage();
    const mount = urls.length;
    await clickRefresh();
    const afterFirst = urls.length;
    expect(hits(urls.slice(mount), "/employees?"), "这一次点确实发了整批").toBe(1);

    // 窗口内（差 200ms 到点）：一条都不发。
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DUTY_REFRESH_MIN_INTERVAL_MS - 200);
    });
    await clickRefresh();
    expect(urls.length, "最小间隔内不该有请求").toBe(afterFirst);
    expect(btn("[data-testid='duty-refresh']")?.getAttribute("data-cooling")).toBe("true");

    // 过完窗口：恢复。
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(btn("[data-testid='duty-refresh']")?.getAttribute("data-cooling")).toBe("false");
    await clickRefresh();
    expect(urls.length).toBeGreaterThan(afterFirst);
    expect(hits(urls.slice(afterFirst), "/employees")).toBe(1);
  });

  it("在飞与窗口内都 aria-disabled＋原因句；原生 disabled 不拿焦点，原因句屏上可见", async () => {
    let hold = false;
    let release: (() => void) | null = null;
    fetchJSON.mockImplementation((url: string) => {
      // 只拦刷新那一批的趋势腿：首读必须先读完，否则挡在飞的是单飞锁而不是窗口。
      if (hold && url.includes("/workbench/summary")) {
        hold = false;
        return new Promise((resolve) => {
          release = () => resolve(ok(url));
        });
      }
      return Promise.resolve(ok(url));
    });
    await renderPage();
    const fresh = btn("[data-testid='duty-refresh']");
    expect(fresh?.getAttribute("aria-disabled")).toBe("false");
    expect(fresh?.title).toBe("");

    hold = true;
    await act(async () => {
      btn("[data-testid='duty-refresh']")?.click();
      await vi.advanceTimersByTimeAsync(0);
    });
    const inflight = btn("[data-testid='duty-refresh']");
    expect(inflight?.getAttribute("aria-disabled")).toBe("true");
    // 原生 disabled 会让钮拿不到焦点，读屏就念不出原因——这里只用 aria-disabled。
    expect(inflight?.disabled).toBe(false);
    expect(inflight?.title).toContain(DUTY_REFRESH_INFLIGHT_REASON);
    expect(inflight?.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      release?.();
      await vi.advanceTimersByTimeAsync(0);
    });
    // 读完进入窗口：原因换成「刚读过」那句，并且**写在页面上**，不只挂在 title。
    const cooled = btn("[data-testid='duty-refresh']");
    expect(cooled?.getAttribute("aria-disabled")).toBe("true");
    expect(cooled?.title).toContain("不能刷新");
    const note = container.querySelector('[data-testid="duty-cooling-note"]');
    expect(note?.textContent).toContain("不能刷新");
    expect(note?.textContent).toContain(String(Math.round(DUTY_REFRESH_MIN_INTERVAL_MS / 1000)));
  });

  it("窗口值有测量来源：常量就是 5000ms（见 DONE 的现网读数）", () => {
    expect(DUTY_REFRESH_MIN_INTERVAL_MS).toBe(5000);
    expect(DUTY_REFRESH_MIN_INTERVAL_MS).toBeGreaterThanOrEqual(5000);
  });
});

describe("DU-06 切窗只两路重发", () => {
  it("换窗口只重发 stats14＋activity，其余读口一条都不多发", async () => {
    const urls: string[] = [];
    fetchJSON.mockImplementation((url: string) => {
      urls.push(url);
      return Promise.resolve(ok(url));
    });
    await renderPage();
    const before = [...urls];

    await act(async () => {
      btn("[data-testid='duty-range-7d']")?.click();
      await vi.advanceTimersByTimeAsync(0);
    });
    const added = urls.slice(before.length);

    expect(hits(added, "/workbench/timeseries"), "趋势腿跟着窗口重读").toBe(1);
    expect(hits(added, "/run-activity"), "活跃腿跟着窗口重读").toBe(1);
    expect(added.length, "切窗总共就两路").toBe(2);
    for (const path of ["/employees", "/employee-stats", "/workbench/summary", "/workbench/queue", "/budget-usage", "/runs?", "/tasks"]) {
      expect(hits(added, path), path).toBe(0);
    }
  });

  it("切窗把作废批的窗口清零后，连点仍被单飞锁封顶在一批", async () => {
    const urls: string[] = [];
    let holdTs = false;
    let release: (() => void) | null = null;
    fetchJSON.mockImplementation((url: string) => {
      urls.push(url);
      // 只拦切窗那一次的趋势腿：让「两路在飞」这个状态真的存在。
      if (holdTs && url.includes("/workbench/timeseries")) {
        holdTs = false;
        return new Promise((resolve) => {
          release = () => resolve(ok(url));
        });
      }
      return Promise.resolve(ok(url));
    });
    await renderPage();
    await clickRefresh(); // 读成功一批 ⇒ 进入节流窗口
    const mark = urls.length;
    holdTs = true;
    await act(async () => {
      btn("[data-testid='duty-range-30d']")?.click();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(hits(urls.slice(mark), "/workbench/timeseries"), "切窗只发趋势这一路").toBe(1);

    // 切窗作废了在飞的旧批，那批欠的窗口也随之清零；但连点 5 次仍只换一批。
    await act(async () => {
      const b = btn("[data-testid='duty-refresh']");
      for (let i = 0; i < 5; i += 1) b?.click();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(hits(urls.slice(mark), "/employees?"), "封顶在一批").toBe(1);
    expect(hits(urls.slice(mark), "/employee-stats")).toBe(1);

    await act(async () => {
      release?.();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(hits(urls.slice(mark), "/employees?")).toBe(1);
  });
});

describe("DU-06② 上批真实读取时刻", () => {
  it("成功批记下读取时刻；失败批不更新它", async () => {
    let failQueue = false;
    fetchJSON.mockImplementation((url: string) => {
      if (failQueue && url.includes("/workbench/queue")) {
        return Promise.reject(
          new ApiError("queue down", { status: 500, body: "{}", url, requestId: "req-du06-1" }),
        );
      }
      return Promise.resolve(ok(url));
    });
    await renderPage();
    expect(container.querySelector('[data-testid="duty-updated-at"]')).toBeNull();

    await clickRefresh();
    const stamp = container.querySelector('[data-testid="duty-updated-at"]');
    const first = stamp?.textContent?.trim();
    expect(first).toContain("刷新完成于 北京时间");
    expect(first).toContain("读取时刻，不是数据时刻");

    // 失败批之后仍能再点（失败不开窗口），且时刻不动。
    failQueue = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DUTY_REFRESH_MIN_INTERVAL_MS + 10);
    });
    await clickRefresh();
    expect(container.querySelector('[data-testid="duty-refresh-error"]')).toBeTruthy();
    const afterFailure = container.querySelector('[data-testid="duty-updated-at"]')?.textContent?.trim();
    expect(afterFailure, "失败时不更新读取时刻").toBe(first);
  });
});

describe("DU-06④ 自动刷新", () => {
  it("没有自动刷新：静置三分钟一条请求都不多发", async () => {
    const urls: string[] = [];
    fetchJSON.mockImplementation((url: string) => {
      urls.push(url);
      return Promise.resolve(ok(url));
    });
    await renderPage();
    const mount = urls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(180_000);
    });
    expect(urls.length, "本页没有数据轮询；AgentFleetRail 的 6s 轮播只滚动不取数").toBe(mount);
  });
});
