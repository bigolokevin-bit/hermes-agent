// @vitest-environment jsdom
/**
 * DU-05 验收面：失败态与降级态（degraded 可见）。
 * 钉四条：① health chip 三态词表不混用（读取失败/未接入/无权限各说各的）＋
 * degraded 时成功卡照常出数；② 单卡错误重试=重发原请求（不多发别人的）＋
 * 请求号真值可复制、无号如实「未记录编号」；③ `?state=` 四态强制在 duty 页
 * 真生效（读查询串、复现腿零请求、非法值回真读）；④ 测量噪声不进产品文案。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchJSON: (url: string, init?: RequestInit) => fetchJSON(url, init),
}));
const clipboard = vi.fn<(text: string) => Promise<boolean>>(() => Promise.resolve(true));
vi.mock("@/lib/clipboard", () => ({
  copyTextToClipboard: (text: string) => clipboard(text),
}));

import DutyPage from "./DutyPage";

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
  clipboard.mockReset();
});

const WB_ASOF = "2026-11-18T06:00:00.000Z";

function ok(url: string): unknown {
  if (url.includes("/workbench/summary")) {
    return {
      asOf: WB_ASOF,
      available: true,
      degraded: [],
      kpis: [
        { key: "runs", label: "运行数", unit: "次", value: 2, available: true },
        { key: "failed", label: "失败数", unit: "次", value: 1, available: true },
        { key: "costUsd", label: "成本", unit: "USD", value: 1.5, available: true },
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
      items: [{ id: "apr_1", type: "approval", title: "供应商报价", status: "pending", createdAt: "2026-11-18T01:00:00.000Z", timeoutAt: null }],
      total: 1,
    };
  }
  if (url.includes("/employee-stats")) return { byLifecycle: { active: 1, paused: 0, offboarding: 0 } };
  if (url.includes("/employees")) {
    return { items: [{ employeeId: "emp_1", name: "陈可", lifecycleState: "active", ownerUserId: "u_1" }] };
  }
  if (url.includes("/run-stats")) {
    return { totals: { runs: 2, succeeded: 1, failed: 1, running: 0, costUsd: 1.5 }, buckets: [] };
  }
  if (url.includes("/run-activity")) return { max: 2, cells: [{ dow: 2, hour: 10, count: 2 }] };
  if (url.includes("/budget-usage")) return { items: [{ employeeId: "emp_1", costUsd: 1.5 }], missingEmployeeIds: [] };
  if (url.includes("/approval-stats")) return { pending: 1, dueSoon: 0 };
  if (url.includes("/approvals")) return { items: [{ approvalId: "apr_1", title: "供应商报价", status: "pending" }] };
  if (url.includes("/tasks")) return { items: [{ taskId: "tsk_1", title: "整理周报", status: "blocked" }] };
  if (url.includes("/runs")) {
    return { items: [{ runId: "run_abcdef123456", employeeId: "emp_1", status: "failed", startedAt: "2026-11-18T02:00:00Z" }] };
  }
  return { items: [] };
}

const notWired = (url: string) =>
  new ApiError("not wired", { status: 404, body: '{"code":"knowledge.not_wired"}', url });

async function render(ui = <DutyPage />, entry = "/duty") {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>);
  });
  await act(async () => {});
  await act(async () => {});
}

const q = (sel: string) => container.querySelector(sel);
const chip = () => q('[data-testid="duty-health-chip"]');
const chipText = () => chip()?.textContent ?? "";
const chipTitle = () => chip()?.getAttribute("title") ?? "";

describe("① health chip 三态（ok / degraded / 未接入），词表不混用", () => {
  it("全部腿回答齐：chip=正常；页上不给「降级」，也不借「未接入」的说法", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await render();
    expect(chip()?.getAttribute("data-state")).toBe("ok");
    expect(chipText()).toContain("正常");
    expect(chipText()).not.toContain("降级");
    expect(chipText()).not.toContain("读取失败");
  });

  it("一路 5xx：chip=降级并列出失败腿名（成本账本），措辞是「读取失败」不是「未接入」；成功卡照常出数", async () => {
    fetchJSON.mockImplementation((url: string) =>
      url.includes("/budget-usage")
        ? Promise.reject(new ApiError("down", { status: 500, body: "{}", url, requestId: "req-500" }))
        : Promise.resolve(ok(url)),
    );
    await render();
    expect(chip()?.getAttribute("data-state")).toBe("degraded");
    expect(chipText()).toContain("成本账本 读取失败");
    expect(chipText()).not.toContain("未接入");
    expect(chipTitle()).not.toContain("未接入：");
    // 降级不整体崩：没失败的卡保留真读数（禁假 0 的反面——真数不许被抹成 —）。
    expect(q('[data-testid="ov6-kpi-runs"]')?.textContent).toContain("2");
    expect(q('[data-testid="ov6-kpi-pending"]')?.textContent).toContain("1");
  });

  it("not_wired 形制归「未接入」：不算失败、不触发降级，具名列在 chip 说明里", async () => {
    fetchJSON.mockImplementation((url: string) =>
      url.includes("/tasks") ? Promise.reject(notWired(url)) : Promise.resolve(ok(url)),
    );
    await render();
    // 阻塞事项这一族整族没接口 → 「未接入：阻塞事项」具名；其余族都回答了 → chip 仍是正常。
    expect(chip()?.getAttribute("data-state")).toBe("ok");
    expect(chipTitle()).toContain("未接入：阻塞事项");
    expect(chipTitle()).not.toContain("失败");
    // 卡内的错误标题也用「未接入」词表，不写「没有读取成功」。
    expect(q('[data-testid="ov6-blockers"]')?.textContent).toContain("这一块的数据源未接入");
    expect(q('[data-testid="ov6-blockers"]')?.textContent).not.toContain("这一块没有读取成功");
  });

  it("每族都 not_wired：chip=未接入，通篇不出现「失败」字样（失败/未接入不许互换）", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.reject(notWired(url)));
    await render();
    expect(chip()?.getAttribute("data-state")).toBe("unwired");
    expect(chipText()).toContain("未接入");
    expect(chipText()).not.toContain("失败");
    expect(chipTitle()).not.toContain("失败");
  });

  it("403 归「无权限」措辞并进降级清单，不写「未接入」也不写「读取失败」", async () => {
    fetchJSON.mockImplementation((url: string) =>
      url.includes("/run-activity")
        ? Promise.reject(new ApiError("no", { status: 403, body: "{}", url }))
        : Promise.resolve(ok(url)),
    );
    await render();
    expect(chip()?.getAttribute("data-state")).toBe("degraded");
    expect(chipText()).toContain("运行统计 无权限");
    expect(chipText()).not.toContain("读取失败");
    expect(chipText()).not.toContain("未接入");
  });
});

describe("② 单卡 error 保留重试：重发原请求＋请求号可复制，非假 toast", () => {
  it("真响应头 rid 上屏并可复制（剪贴板收到的是真值）", async () => {
    fetchJSON.mockImplementation((url: string) =>
      url.includes("/workbench/timeseries")
        ? Promise.reject(new ApiError("boom", { status: 500, body: "{}", url, requestId: "req-d-42" }))
        : Promise.resolve(ok(url)),
    );
    await render();
    const card = q('[data-testid="ov6-trend"]');
    expect(card?.textContent).toContain("请求编号 req-d-42");
    const copy = card?.querySelector('[data-testid="ov6-rid-copy"]') as HTMLButtonElement | null;
    expect(copy).toBeTruthy();
    expect(copy?.disabled).toBe(false);
    await act(async () => {
      copy?.click();
    });
    expect(clipboard).toHaveBeenCalledWith("req-d-42");
    expect(card?.textContent).toContain("已复制");
  });

  it("响应没带请求号：如实「未记录编号」，绝不放假编号上屏", async () => {
    fetchJSON.mockImplementation((url: string) =>
      url.includes("/workbench/timeseries")
        ? Promise.reject(new ApiError("boom", { status: 500, body: "{}", url }))
        : Promise.resolve(ok(url)),
    );
    await render();
    const card = q('[data-testid="ov6-trend"]');
    expect(card?.textContent).toContain("本次请求未记录编号");
    expect(card?.textContent).not.toMatch(/req[ _-]?[\w-]{4,}/);
  });

  it("趋势卡重试只重发趋势原请求：其它腿一条都不多发，别的卡读数不动", async () => {
    let timeseriesCalls = 0;
    const urls: string[] = [];
    fetchJSON.mockImplementation((url: string) => {
      urls.push(url);
      if (url.includes("/workbench/timeseries")) {
        timeseriesCalls += 1;
        if (timeseriesCalls === 1) {
          return Promise.reject(new ApiError("boom", { status: 500, body: "{}", url, requestId: "req-ts" }));
        }
        return Promise.resolve(ok(url));
      }
      return Promise.resolve(ok(url));
    });
    await render();
    expect(q('[data-testid="ov6-trend"]')?.textContent).toContain("这一块没有读取成功");
    const before = urls.length;
    const retry = [...(q('[data-testid="ov6-trend"]')?.querySelectorAll("button") ?? [])].find((b) =>
      b.textContent?.includes("重试"),
    ) as HTMLButtonElement | undefined;
    expect(retry).toBeTruthy();
    await act(async () => {
      retry?.click();
    });
    await act(async () => {});
    await act(async () => {});
    const added = urls.slice(before);
    // 重发的是原请求（同一路 URL），且不牵连别的腿。
    expect(added.length).toBe(1);
    expect(added[0]).toContain("/workbench/timeseries");
    expect(q('[data-testid="ov6-trend"]')?.textContent).not.toContain("这一块没有读取成功");
    // 别的卡不受影响：今日运行读数还在。
    expect(q('[data-testid="ov6-kpi-runs"]')?.textContent).toContain("2");
  });

  it("待审队列一次请求喂两卡：重试只重发一条 queue，两卡同时回数", async () => {
    let queueCalls = 0;
    const urls: string[] = [];
    fetchJSON.mockImplementation((url: string) => {
      urls.push(url);
      if (url.includes("/workbench/queue")) {
        queueCalls += 1;
        if (queueCalls === 1) {
          return Promise.reject(new ApiError("down", { status: 500, body: "{}", url, requestId: "req-q" }));
        }
        return Promise.resolve(ok(url));
      }
      return Promise.resolve(ok(url));
    });
    await render();
    const pending = q('[data-testid="ov6-pending"]');
    expect(pending?.textContent).toContain("这一块没有读取成功");
    const before = urls.length;
    const retry = [...(pending?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.includes("重试")) as
      | HTMLButtonElement
      | undefined;
    await act(async () => {
      retry?.click();
    });
    await act(async () => {});
    await act(async () => {});
    const added = urls.slice(before).filter((u) => u.includes("/workbench/queue"));
    expect(added.length).toBe(1);
    expect(pending?.textContent).not.toContain("这一块没有读取成功");
    expect(pending?.textContent).toContain("1 条待你审批");
    // 「最近运行」的明细口没被牵连：runs 相关请求一条没多发。
    expect(urls.slice(before).some((u) => u.includes("/runs?"))).toBe(false);
  });
});

describe("③ `?state=` 四态强制在 duty 页真生效（读查询串；复现腿零请求）", () => {
  it("state=error：渲染错误形制，一条真实请求都不发", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await render(<DutyPage />, "/duty?state=error");
    expect(fetchJSON).not.toHaveBeenCalled();
    expect(q('[data-testid="duty-repro-note"]')?.textContent).toContain("强制态：?state=error");
    expect(q('[data-testid="duty-repro-note"]')?.textContent).toContain("不发起真实请求");
    expect(container.textContent).toContain("这一块没有读取成功");
    expect(chip()?.getAttribute("data-state")).toBe("degraded");
  });

  it("state=denied：说「无权限」，不借用「失败」也不借用「未接入」；零请求", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await render(<DutyPage />, "/duty?state=denied");
    expect(fetchJSON).not.toHaveBeenCalled();
    expect(q('[data-testid="duty-repro-note"]')?.textContent).toContain("强制态：?state=denied");
    expect(container.textContent).toContain("这一块你没有权限查看");
    expect(container.textContent).toContain("你没有查看这块数据的权限");
    expect(chip()?.getAttribute("data-state")).toBe("degraded");
    expect(chipText()).toContain("无权限");
    expect(chipText()).not.toContain("读取失败");
    expect(chipText()).not.toContain("未接入");
  });

  it("state=loading：全部卡在读取形制，chip 画「—」，零请求", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await render(<DutyPage />, "/duty?state=loading");
    expect(fetchJSON).not.toHaveBeenCalled();
    expect(q(".duty-skeleton")).toBeTruthy();
    expect(chipText()).toContain("—");
  });

  it("state=empty：各卡走真组件的空态形制（空≠未接入≠失败），零请求", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await render(<DutyPage />, "/duty?state=empty");
    expect(fetchJSON).not.toHaveBeenCalled();
    expect(container.textContent).toContain("最近没有运行记录");
    expect(container.textContent).not.toContain("这一块没有读取成功");
    // 空读数不是假 0：数量列「数量未提供」，成本列「—」。
    expect(container.textContent).toContain("数量未提供");
    expect(chip()?.getAttribute("data-state")).toBe("ok");
  });

  it("非法值（state=bogus）不进复现分支：回到真实读取", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await render(<DutyPage />, "/duty?state=bogus");
    expect(fetchJSON).toHaveBeenCalled();
    expect(q('[data-testid="duty-repro-note"]')).toBeNull();
  });

  it("四态复现互不泄漏：error 复现里没有「无权限」标题，denied 复现里没有「没有读取成功」", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await render(<DutyPage />, "/duty?state=error");
    expect(q('[data-testid="ov6-trend"]')?.textContent).not.toContain("这一块你没有权限查看");
    act(() => root.unmount());
    container.remove();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await render(<DutyPage />, "/duty?state=denied");
    expect(q('[data-testid="ov6-trend"]')?.textContent).not.toContain("这一块没有读取成功");
  });
});

describe("④ 测量噪声不进产品文案", () => {
  it("整页失败也不把 401 退避/4xx 计数一类的测量词画上屏", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.reject(new ApiError("nope", { status: 429, body: '{"code":"rate_limited"}', url })),
    );
    await render();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/res4xx|退避|backoff|401 环/i);
    expect(chip()).toBeTruthy();
  });
});
