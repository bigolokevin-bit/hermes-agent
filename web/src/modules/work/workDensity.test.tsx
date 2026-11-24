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

  it("破折号治理：任务列恒在（骨架七列），缺关联的行格内留空、卡底只点名一次", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      const href = String(url);
      if (href.includes("/api/runs")) {
        return {
          items: [
            { ...listBody().items[0], taskId: undefined },
            { ...listBody().items[0], runId: "rn_01M7W7WKRVS0J06HVXZD4N7MNQ", taskId: undefined },
          ],
          nextCursor: null,
        };
      }
      if (href.includes("/api/run-stats")) return { buckets: [], totals: null };
      return { items: [] };
    });
    const host = await render("/work?tab=runs", createElement(RunsModulePage));
    await waitFor(() => host.querySelector('[data-testid="run5-row-0"]') !== null, "rows painted");

    // 骨架定义性列不因缺读口消失：表头仍在，行内该列也仍在（只是格内空着）。
    expect(host.querySelector('[data-testid="run5-table"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="run5-head"]')).not.toBeNull();
    const head = host.querySelector('[data-testid="run5-head"]')?.textContent ?? "";
    expect(head).toContain("任务");
    const cell = host.querySelector('[data-testid="run5-row-0-task"]');
    expect(cell, "任务列结构保留").not.toBeNull();
    expect(cell?.textContent ?? "", "缺值不摆占位符").toBe("");
    expect(host.querySelector('[data-testid="run5-row-1-task"]')?.textContent ?? "").toBe("");
    const avail = host.querySelector('[data-testid="run5-table"] .console-card__availability');
    expect(avail, "卡底数据可用性点名任务列").toBeTruthy();
    expect(avail?.textContent ?? "").toContain("任务列");
    // 一处声明就够了：这句只出现在卡底可用性里，不在每一行重复
    expect((host.textContent ?? "").match(/没有回传任务关联/g) ?? []).toHaveLength(1);
    expect(avail?.textContent ?? "").toContain("没有回传任务关联");
  });

  it("计划任务面：排期表七列照骨架立起，调度四列留空、卡底点名一次", async () => {
    const host = await render("/work", createElement(TasksBoardModulePage));
    await waitFor(() => host.querySelector('[data-testid="tsk4-columns"]') !== null, "board painted");

    // chip 是来源筛选，不是页签
    const chip = host.querySelector('[data-testid="tsk4-chip-scheduled"]');
    expect(chip?.textContent ?? "").toContain("计划任务");
    await act(async () => {
      (chip as HTMLButtonElement).click();
    });

    expect(host.querySelector('[data-testid="tsk4-columns"]'), "切到排期时看板收起").toBeNull();
    expect(host.querySelector('[data-testid="tsk4-schedule"]')).not.toBeNull();
    const head = host.querySelector('[data-testid="tsk4-schedule-head"]')?.textContent ?? "";
    for (const label of ["名称", "运行员工", "频率", "下次触发", "近 7 天", "上次", "操作"]) {
      expect(head, `表头有「${label}」`).toContain(label);
    }
    // 表头里不许出现破折号
    expect(head).not.toContain("—");
    // 骨架定义性的调度列：格内空着，但行结构在
    const row = host.querySelector('[data-testid^="tsk4-schedule-row-"]');
    expect(row, "有来源=渠道/定时的任务就该出现一行").not.toBeNull();
    const rowId = row?.getAttribute("data-testid")?.replace("tsk4-schedule-row-", "") ?? "";
    expect(host.querySelector(`[data-testid="tsk4-schedule-name-${rowId}"]`)?.textContent ?? "").toContain("渠道 ROI");
    for (const key of ["freq", "next", "week", "last"]) {
      expect(host.querySelector(`[data-testid="tsk4-schedule-${key}-${rowId}-value"]`)?.textContent ?? "").toBe("");
    }
    const avail = host.querySelector('[data-testid="tsk4-schedule"] .console-card__availability');
    expect(avail).toBeTruthy();
    expect(avail?.textContent ?? "").toContain("频率 / 下次触发");
    expect(avail?.textContent ?? "").toContain("近 7 天 / 上次");
    expect(host.querySelectorAll('[role="tablist"]').length).toBe(0);
  });

  it("破折号治理：任务面成本整列无回传时不摆占位符，卡底点名一次", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      const href = String(url);
      if (href.includes("/api/tasks")) {
        return { items: TASKS.map((row) => ({ ...row, cost: undefined })), nextCursor: null };
      }
      if (href.includes("/api/matrix")) return { items: [] };
      return { items: [] };
    });
    const host = await render("/work", createElement(TasksBoardModulePage));
    await waitFor(() => host.querySelector('[data-testid="tsk4-columns"]') !== null, "board painted");

    expect(host.textContent ?? "").not.toContain("成本 —");
    const foot = host.querySelector('[data-testid="tsk4-board-foot"]');
    expect(foot, "页脚不再列没有来源的目标对比").toBeTruthy();
    expect(foot?.textContent ?? "").not.toContain("目标");
    const avail = host.querySelector(".console-card__availability");
    expect(avail, "卡底数据可用性点名成本与目标").toBeTruthy();
    expect(avail?.textContent ?? "").toContain("任务成本");
    expect(avail?.textContent ?? "").toContain("今日目标数");
  });
});