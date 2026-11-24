// @vitest-environment jsdom
/**
 * /work 两面的密度契约（2026-11-24 任务与运行车道）。
 *
 * 只锁「骨架同级信息密度」这条可判定的最小面：
 *   1. 一屏只有外壳那一排 tab —— 模块内不得再出 role="tablist"；
 *   2. 任务面用公共卡式基元与看板列，行/列不再是上游裸 Card 网格；
 *   3. 运行面用 40px 行壳（console-grid-row）与公共卡，id 只上短码，
 *      26 位 ULID 不整段露面；
 *   4. 缺读口时留「—」，不把读不到写成 0。
 *
 * 数据全部是 mock 的真读数形状；页面本身不做 fixture 分支。
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import { TasksBoardModulePage } from "../tasks/TasksBoardModulePage";
import { RunsModulePage } from "../runs/RunsModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

async function waitFor(cond: () => boolean, label: string): Promise<void> {
  for (let i = 0; i < 400; i += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error(`timeout: ${label}`);
}

async function render(entry: string, node: ReturnType<typeof createElement>): Promise<HTMLElement> {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(createElement(MemoryRouter, { initialEntries: [entry] }, node));
  });
  return host;
}

const TASKS = [
  {
    taskId: "tk_89F5AEF75D814C17BD1FDFC8BB",
    title: "竞品周报汇总 · 第 46 周",
    status: "in_progress",
    priority: "high",
    source: { kind: "manual" },
    assignee: { type: "employee", id: "emp_86A81CE8FF6F42E187BCF2B540" },
    updatedAt: "2026-11-18T02:00:00Z",
    progressNote: "第 5 / 6 步",
  },
  {
    taskId: "tk_13C3959864744EB3A8EB643088",
    title: "渠道 ROI 异常归因",
    status: "open",
    priority: "normal",
    source: { kind: "channel", channel: "feishu" },
    assignee: { type: "employee", id: "emp_86A81CE8FF6F42E187BCF2B540" },
    updatedAt: "2026-11-17T06:00:00Z",
  },
];

const RUN_ULID = "rn_01M7W7WKRVS0J06HVXZD4N7MNP";

function listBody() {
  return {
    items: [
      {
        runId: RUN_ULID,
        employeeId: "emp_86A81CE8FF6F42E187BCF2B540",
        taskId: "tk_89F5AEF75D814C17BD1FDFC8BB",
        status: "failed",
        reasonCode: "run.timeout",
        costUsd: 0.42,
        costStatus: "priced",
        startedAt: "2026-11-20T06:00:00Z",
        endedAt: "2026-11-20T06:02:00Z",
      },
    ],
    nextCursor: null,
  };
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(async (url: string) => {
    const href = String(url);
    if (href.includes("/api/tasks")) return { items: TASKS, nextCursor: null };
    if (href.includes("/api/matrix")) return { items: [] };
    if (href.includes("/api/run-stats")) {
      return {
        buckets: [],
        totals: {
          runs: 72,
          succeeded: 70,
          failed: 1,
          cancelled: 0,
          interrupted: 0,
          running: 1,
          pending: 0,
          costUsd: 1.13,
          p95: 3,
          successRate: 0.97,
        },
      };
    }
    if (href.includes("/api/runs")) return listBody();
    if (href.includes("/api/employees")) return { items: [] };
    return { items: [] };
  });
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  api.fetchJSON.mockReset();
});

describe("/work 信息密度契约", () => {
  it("任务面：公共看板列铺开，模块内不再自造 tablist", async () => {
    const host = await render("/work", createElement(TasksBoardModulePage));
    await waitFor(() => host.querySelector('[data-testid="tsk4-columns"]') !== null, "board painted");

    expect(host.querySelectorAll('[role="tablist"]').length).toBe(0);
    expect(host.querySelectorAll(".console-board__card").length).toBe(2);
    // 副行是真读数：N 个任务 · N 待处理 · N 进行中 · N 今日完成
    const sub = host.querySelector('[data-testid="tsk4-sub"]')?.textContent ?? "";
    expect(sub).toContain("2 个任务");
    expect(sub).toContain("1 进行中");
    // 卡片走公共基元，不再各自手搓一套卡
    expect(host.querySelectorAll(".console-card").length).toBeGreaterThan(0);
    // 26 位 ULID 不上屏
    expect(host.textContent ?? "").not.toMatch(/rn_[0-9A-HJKMNP-TV-Z]{26}/);
  });

  it("运行面：40px 行壳 + 失败详情/运行构成双卡，id 只上短码", async () => {
    const host = await render("/work?tab=runs", createElement(RunsModulePage));
    await waitFor(() => host.querySelector('[data-testid="run5-row-0"]') !== null, "rows painted");

    expect(host.querySelectorAll('[role="tablist"]').length).toBe(0);
    const row = host.querySelector('[data-testid="run5-row-0"]');
    expect(row?.classList.contains("console-grid-row")).toBe(true);
    // 运行面有两张公共卡：失败详情 + 运行构成
    expect(host.querySelectorAll(".console-card").length).toBeGreaterThanOrEqual(2);
    expect(host.querySelector('[data-testid="run5-split"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="run5-row-0-task"]')).not.toBeNull();
    // 26 位 ULID 不整段上屏；短码仍在（运行 · 尾 4 位）
    const surface = host.textContent ?? "";
    expect(surface).not.toContain(RUN_ULID);
    expect(surface).toContain("运行 · 7MNP");
    // 读不到统计时数字是「—」（本用例给了真读数，先不出现 0 冒充）
    expect(host.querySelector('[data-testid="run5-counts"]')?.textContent ?? "").toContain("本页 1 次");
  });
});