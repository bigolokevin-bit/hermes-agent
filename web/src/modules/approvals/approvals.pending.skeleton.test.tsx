// @vitest-environment jsdom
// 2026-11-24 待处理 pane 九卡骨架形制契约（本车道新增，不改既有测试语义）。
//
// 断言的是「形」而不是业务：骨架 L3319–3535 的九张卡都在、卡头是 h2、
// 模块内没有第二个 tablist、空态是列轨对齐的灰骨架行、指标带只出现真值
// （读不到的项不摆「—」）、缺读口只在卡底留一行 11px 声明。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import ApprovalsPendingModulePage from "@/modules/approvals/ApprovalsPendingModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

async function waitFor(cond: () => boolean, label: string): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

const server = async (url: string): Promise<unknown> => {
  const u = String(url);
  if (u.includes("/api/approval-stats")) return { pending: 0, dueSoon: 0, asOf: "2026-11-24T07:57:29Z" };
  if (u.includes("/api/approvals")) return { items: [] };
  return {};
};

async function mount(): Promise<void> {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(server);
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={["/approvals"]}>
        <ApprovalsPendingModulePage />
      </MemoryRouter>,
    );
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), "initial load settled");
  await waitFor(() => !!document.querySelector('[data-testid="apr5-today-card"]'), "overview painted");
}

beforeEach(() => {
  document.cookie = "console_csrf=test-csrf-token; path=/";
});

afterEach(() => {
  document.cookie = "console_csrf=; path=/; max-age=0";
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

const cards = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>(".console-card"));

describe("待处理 pane 九卡骨架", () => {
  it("骨架的九张卡都在，卡头逐字对得上", async () => {
    await mount();
    const labels = cards().map((card) => card.querySelector("h2")?.textContent ?? "");
    expect(labels).toEqual([
      "待办队列 · 按等待时长排序",
      "批量操作",
      "今日办结",
      "审批负载",
      "谁在等",
      "近 7 天申请",
      "配置发布审批",
      "发布链",
      "校验项",
    ]);
  });

  it("卡头是 h2，模块内零 tablist，也没有 data-fixture", async () => {
    await mount();
    const page = document.querySelector('[data-testid="apr5-page-pending"]') as HTMLElement;
    expect(page.querySelectorAll("h2").length).toBe(9);
    expect(page.querySelectorAll('[role="tablist"]').length).toBe(0);
    expect(page.querySelectorAll("[data-fixture]").length).toBe(0);
  });

  it("空态用与表头同轨的灰骨架行说话，不是居中小灰字", async () => {
    await mount();
    const head = document.querySelector(".apr5-qhead") as HTMLElement;
    const ghosts = Array.from(document.querySelectorAll('[data-testid="apr5-ghost-row"]'));
    expect(head.children.length).toBe(7);
    expect(ghosts.length).toBe(3);
    for (const ghost of ghosts) {
      expect((ghost as HTMLElement).children.length).toBe(head.children.length);
    }
    // 其余三张空表也各自有骨架行，列数与表头一致。
    for (const testId of ["apr5-today-ghost", "apr5-mine-ghost", "apr5-waiters-ghost", "apr5-release-row"]) {
      const ghost = document.querySelector(`[data-testid="${testId}"]`) as HTMLElement;
      expect(ghost, testId).toBeTruthy();
      const tableHead = ghost.parentElement?.querySelector(".apr5-th") as HTMLElement | null;
      if (tableHead) expect(ghost.children.length).toBe(tableHead.children.length);
    }
  });

  it("指标带只用真值：待批 0 上屏，算不出的「最早提交」整项不出现", async () => {
    await mount();
    const band = document.querySelector('[data-testid="apr5-metric-band"]') as HTMLElement;
    expect(band.textContent).toContain("待批");
    expect(band.textContent).toContain("近 7 天通过");
    expect(band.textContent).not.toContain("最早提交");
    expect(band.textContent).not.toContain("—");
  });

  it("缺读口只在卡底留一行 11px 声明，正文不写端点名", async () => {
    await mount();
    const releaseFoot = document.querySelector('[data-testid="apr5-release-missing"]') as HTMLElement;
    expect(releaseFoot.textContent).toContain("缺读口");
    const pageText = document.querySelector('[data-testid="apr5-page-pending"]')?.textContent ?? "";
    expect(pageText).not.toContain("/api/");
    expect(pageText).not.toContain("console.");
  });
});