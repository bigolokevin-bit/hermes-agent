// @vitest-environment jsdom
// 定时任务只读页：真实 `/api/cron/jobs`、人话调度、北京时间到分、
// 缺失值「—」+原因、只读按钮 disabled、403/404 同体、四态与复现腿。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import { CronModulePage } from "./CronModulePage";

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

async function render(entry: string): Promise<void> {
  await act(async () => root?.unmount());
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<MemoryRouter initialEntries={[entry]}><CronModulePage /></MemoryRouter>);
  });
}

const text = (): string => document.body.textContent ?? "";
const rows = (): Element[] => [...document.querySelectorAll("[data-testid='cron5-row']")];

const JOB = {
  id: "job_12345678",
  name: "l7-state-backup",
  schedule: { kind: "cron", expr: "10 4 * * *", display: "10 4 * * *" },
  enabled: true,
  next_run_at: "2026-11-20T04:10:00+08:00",
  last_run_at: "2026-11-19T04:10:48.973546+08:00",
  last_status: "ok",
};

async function mount(payload: unknown = [JOB], entry = "/work?tab=board&view=cron"): Promise<void> {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation((url?: string) => {
    if (!url) return Promise.resolve([]);
    return Promise.resolve(payload);
  });
  await render(entry);
  await waitFor(() => !document.querySelector(".animate-pulse"), "settled");
}

const rejects = (status: number, requestId?: string) => (url?: string) => {
  if (!url) return Promise.resolve([]);
  return Promise.reject(new ApiError("failed", { status, body: "{}", url, requestId }));
};

beforeEach(() => api.fetchJSON.mockReset());
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

describe("real cron read", () => {
  it("asks the Hermes cron read route and renders the job", async () => {
    await mount();
    expect(api.fetchJSON).toHaveBeenCalledWith("/api/cron/jobs");
    expect(rows()).toHaveLength(1);
    expect(text()).toContain("l7-state-backup");
    expect(document.querySelector("[data-testid='cron5-schedule']")?.textContent).toContain("每天 04:10");
    expect(document.querySelector("[data-testid='cron5-last']")?.textContent).toContain("2026-11-19 04:10");
    expect(document.querySelector("[data-testid='cron5-next']")?.textContent).toContain("2026-11-20 04:10");
    expect(document.querySelector("[data-testid='cron5-status']")?.textContent).toBe("启用");
    expect(document.querySelector("[data-testid='cron5-result']")?.textContent).toContain("成功");
  });

  it("keeps missing schedule/time/status as 「—」 with reasons, never 0", async () => {
    await mount([{ name: "最小任务" }]);
    expect(text()).toContain("调度：—");
    expect(text()).toContain("上次运行：—");
    expect(text()).toContain("下次运行：—");
    expect(text()).toContain("待核实");
    expect(document.querySelector("[data-testid='cron5-status']")?.textContent).toBe("待核实");
    expect(text()).toContain("接口没有提供调度表达式");
    expect(text()).toContain("接口没有提供上次运行时间");
    expect(text()).toContain("还没有运行记录");
    expect(text()).not.toMatch(/1970|NaN|: 0\b/);
  });

  it("shows failed results with a human reason and keeps disabled rows visible", async () => {
    await mount([
      { name: "失败任务", enabled: false, schedule: "*/5 * * * *", last_status: "error", last_error: "远端拒绝了连接" },
    ]);
    expect(document.querySelector("[data-testid='cron5-schedule']")?.textContent).toContain("每 5 分钟");
    expect(document.querySelector("[data-testid='cron5-result']")?.textContent).toContain("失败");
    expect(text()).toContain("远端拒绝了连接");
    expect(document.querySelector("[data-testid='cron5-status']")?.textContent).toBe("停用");
    expect(rows()[0]?.className).toContain("opacity-60");
  });

  it("renders only disabled read-only controls and never calls a write route", async () => {
    await mount();
    const toggle = document.querySelector<HTMLButtonElement>("[data-testid='cron5-toggle']")!;
    const run = document.querySelector<HTMLButtonElement>("[data-testid='cron5-run-now']")!;
    expect(toggle.disabled).toBe(true);
    expect(run.disabled).toBe(true);
    expect(toggle.getAttribute("aria-disabled")).toBe("true");
    expect(run.getAttribute("aria-disabled")).toBe("true");
    expect(toggle.getAttribute("title")).toContain("只读");
    expect(run.getAttribute("title")).toContain("只读");
    const calls = api.fetchJSON.mock.calls.length;
    await act(async () => {
      toggle.click();
      run.click();
    });
    expect(api.fetchJSON).toHaveBeenCalledTimes(calls);
    expect(text()).not.toMatch(/pause|trigger|resume/i);
  });

  it("shows a true empty answer without sample rows", async () => {
    await mount([]);
    expect(document.querySelector("[data-testid='cron5-empty']")).toBeTruthy();
    expect(text()).toContain("没有定时任务");
    expect(rows()).toHaveLength(0);
  });
});

describe("errors and access", () => {
  it("403 and 404 draw one neutral body without a path or code", async () => {
    const once = async (status: number): Promise<string> => {
      api.fetchJSON.mockReset();
      api.fetchJSON.mockImplementation(rejects(status, "req-cron"));
      await render("/work?tab=board&view=cron");
      await waitFor(() => !!document.querySelector("[data-testid='cron5-denied']"), "denied");
      return document.body.innerHTML;
    };
    const a = await once(403);
    const b = await once(404);
    expect(a).toBe(b);
    expect(text()).toContain("定时任务读口未接入");
    expect(text()).toContain("请求编号：req-cron");
    expect(text()).not.toMatch(/\/api\/|403|404|GAP-CRON-01/);
    expect(document.querySelector("[data-testid='cron5-denied']")?.getAttribute("title")).toBe("GAP-CRON-01");
    expect(document.querySelector("[data-testid='cron5-apply']")?.getAttribute("href")).toBe("/approvals");
  });

  it("500 shows human wording, a copyable request id and a retry that recovers", async () => {
    let fail = true;
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation((url?: string) => {
      if (!url) return Promise.resolve([]);
      if (fail) return Promise.reject(new ApiError("boom", { status: 500, body: "{}", url, requestId: "req-cron-5" }));
      return Promise.resolve([JOB]);
    });
    await render("/work?tab=board&view=cron");
    await waitFor(() => !!document.querySelector("[data-testid='cron5-error']"), "error");
    expect(text()).toContain("处理时出了错");
    expect(text()).toContain("请求编号：req-cron-5");
    expect(text()).not.toMatch(/500|boom|\/api\//);
    expect(document.querySelector("[aria-label='复制请求编号']")).toBeTruthy();
    fail = false;
    const retry = document.querySelector<HTMLButtonElement>("[data-testid='cron5-retry']")!;
    await act(async () => retry.click());
    await waitFor(() => rows().length === 1, "retry recovered");
  });

  it("forced states make no request and no longer carry fixture marker", async () => {
    for (const state of ["loading", "empty", "error", "denied"]) {
      api.fetchJSON.mockReset();
      await render(`/work?tab=board&view=cron&state=${state}`);
      await waitFor(() => !document.querySelector(".animate-pulse") || state === "loading", `${state} painted`);
      expect(document.querySelector("[data-testid='cron5-page']")?.hasAttribute("data-" + "fixture")).toBe(false);
      expect(api.fetchJSON).not.toHaveBeenCalled();
    }
  });
});
