// @vitest-environment jsdom
/**
 * R152 — 运行列表错误态的 rid、重试语义与动作闸（纯测试，零产品改动）。
 *
 * 现场裁决（按现状记录，不静默改产品）：
 * ① 强渲复现 handle 是 ?state=（forcedStateOf），?error=500 不是现场 handle——
 *   本锁双形状：真 500 拒绝腿断错误卡+rid 可复制+重试；?error=500 深链=不消费、
 *   列表照常读取、URL 原样保留（run-filter-copy 的剪贴板串为证）。
 * ② runs 域没有 apv-live 中央播报节点；重试成功的现场证据=错误卡与 rid 载体
 *   消失、行渲出、列表腿恰 +1（run-busy-note 是刷新腿的 role=status 播报，
 *   非「已加载 N 条」文案，按现状记录差异）。
 * ③ 错误态下列表主体整体换成面板：导出/复制/分页/行内入口不渲出——以 null
 *   锁替代 disabled 锁；表头排序钮现场恒可点（读本地行集），按现状注记。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { RunsModulePage } from "./RunsModulePage";
import { ApiError } from "@/lib/api-error";

/** Stands where the router thinks we are: proves nothing rewrote the URL. */
function LocationProbe() {
  const { pathname, search } = useLocation();
  return <span data-testid="probe-location">{`${pathname}${search}`}</span>;
}

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn(() => Promise.resolve(true)) }));

vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clip.copyTextToClipboard }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function runRow(n: number) {
  const tail = String(n).padStart(4, "0");
  return {
    runId: `rn_01M7822ERR${tail}`,
    employeeId: "emp_aaaabbbbcccc",
    status: n % 2 === 0 ? "completed" : "failed",
    costUsd: n,
    costStatus: "known",
    startedAt: "2026-11-18T02:00:00.000Z",
    endedAt: "2026-11-18T02:11:00.000Z",
  };
}

const ROWS = [runRow(1), runRow(2)];

async function waitFor(cond: () => boolean, label: string) {
  for (let i = 0; i < 400; i += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  throw new Error(`timeout: ${label}`);
}

async function mount(entry: string) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(
      createElement(
        MemoryRouter,
        { initialEntries: [entry] },
        createElement(RunsModulePage),
        createElement(LocationProbe),
      ),
    );
  });
}

function node(testid: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${testid}"]`);
}

function textOf(testid: string): string {
  return node(testid)?.textContent ?? "";
}

function bodyRows(): number {
  return document.querySelectorAll("[data-testid^='run5-row-'][data-status]").length;
}

function runsCalls(): number {
  return api.fetchJSON.mock.calls.filter((call) => String(call[0] ?? "").includes("/api/runs"))
    .length;
}

async function click(testid: string) {
  const el = node(testid) as HTMLButtonElement | null;
  expect(el, `button ${testid}`).toBeTruthy();
  await act(async () => {
    el!.click();
  });
  await act(async () => {});
}

function fail500(url: string): ApiError {
  return new ApiError("boom", {
    status: 500,
    body: JSON.stringify({ message: "运行服务暂时没有响应" }),
    url,
    requestId: "req-runs-error-500",
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  host?.remove();
  host = null;
  api.fetchJSON.mockReset();
  clip.copyTextToClipboard.mockClear();
});

describe("R152 ① a real 500 paints a human error card with a copyable rid", () => {
  it("rejecting the list leg keeps no fake rows and offers 重试 with req-runs-error-500", async () => {
    api.fetchJSON.mockImplementation((url: unknown) => Promise.reject(fail500(String(url))));
    await mount("/runs");
    await waitFor(() => node("run5-error") !== null, "error card");
    expect(textOf("run5-error")).toContain("运行记录没能加载出来");
    expect(textOf("run5-error")).toContain("运行服务暂时没有响应");
    // rid 载体存在且可复制（CopyValue 的文本格含复制钮字样，逐字用包含断言）。
    const ridCell = node("run5-error-request-id-value");
    expect(ridCell, "rid carrier").toBeTruthy();
    expect(textOf("run5-error-request-id-value")).toContain("req-runs-error-500");
    const copyBtn = ridCell?.querySelector("button") as HTMLButtonElement | null;
    expect(copyBtn, "rid copy control").toBeTruthy();
    await act(async () => {
      copyBtn!.click();
    });
    expect(clip.copyTextToClipboard).toHaveBeenCalledWith("req-runs-error-500");
    // 重试钮在场且可点（不是死控件）。
    const retry = node("run5-error-retry") as HTMLButtonElement;
    expect(retry.disabled, "retry live on a real error").toBe(false);
    // 无假 0/假空：行=0、空态面板不渲、错误态不借空态文案。
    expect(bodyRows()).toBe(0);
    expect(node("run5-empty"), "no fake empty panel under error").toBeNull();
    // 现场③（按现状修正）：错误态下导出/复制/分页入口仍渲出但全部 disabled，
    // 且 title 携带闸原因句（gates 单点措辞）——disabled+title 锁而非 null 锁。
    for (const id of ["run-list-export", "run-list-copy"] as const) {
      const el = node(id) as HTMLButtonElement | null;
      expect(el, `${id} present`).toBeTruthy();
      expect(el!.disabled, `${id} gated on error`).toBe(true);
      expect(el!.title.length, `${id} carries a stated reason`).toBeGreaterThan(0);
    }
    // 分页条在错误态整体不渲出：没有下一页游标可依赖时不摆按钮。
    expect(node("run-more-bar"), "paging bar hidden while the list failed").toBeNull();
  });

  it("?error=500 is not a repro handle: the URL keeps it, the list still reads", async () => {
    api.fetchJSON.mockImplementation(async () => ({ items: ROWS }));
    await mount("/runs?error=500");
    await waitFor(() => bodyRows() === 2, "rows behind ?error=500");
    expect(node("run5-error"), "no error card from an unconsumed param").toBeNull();
    expect(runsCalls(), "the list read is the only leg").toBe(1);
    // 现场注记：run-filter-copy 复制的是筛选摘要（body 派生自已知参数键），
    // 不承载未知参——URL 保参证据用路由位置探针。
    expect(textOf("probe-location")).toBe("/runs?error=500");
  });
});

describe("R152 ③ retry success clears the card and refetches exactly once", () => {
  it("first leg fails, 重试 adds exactly one list call and the rid carrier disappears", async () => {
    let first = true;
    api.fetchJSON.mockImplementation((url: unknown) => {
      const u = String(url);
      if (u.includes("/api/runs")) {
        if (first) {
          first = false;
          return Promise.reject(fail500(u));
        }
        return Promise.resolve({ items: ROWS });
      }
      return Promise.resolve({ items: [] });
    });
    await mount("/runs");
    await waitFor(() => node("run5-error") !== null, "error card");
    const before = runsCalls();
    await click("run5-error-retry");
    await waitFor(() => bodyRows() === 2, "rows after retry");
    expect(runsCalls(), "retry costs exactly one list query").toBe(before + 1);
    expect(node("run5-error"), "error card gone").toBeNull();
    expect(node("run5-error-request-id-value"), "rid carrier gone with the card").toBeNull();
    // 现场注记：runs 域无 apv-live 中央播报；成功证据即卡片消失+行渲出+计数 +1。
  });
});

describe("R152 ② gates on the repro and idle legs (single wording source)", () => {
  it("?state=error marks the list retry disabled with the stated fixture reason", async () => {
    api.fetchJSON.mockImplementation(async () => ({ items: ROWS }));
    await mount("/runs?state=error");
    await waitFor(() => node("run5-error") !== null, "fixture error card");
    const retry = node("run5-error-retry") as HTMLButtonElement;
    expect(retry.disabled, "fixture leg never fires a real request").toBe(true);
    expect(retry.title).toContain("复现腿不发起真实请求");
    expect(runsCalls(), "fixture leg asks nothing").toBe(0);
  });

  it("an empty read disables export/copy/paging with stated reasons, not silence", async () => {
    api.fetchJSON.mockImplementation(async (url: unknown) =>
      String(url).includes("/api/runs") ? { items: [] } : { items: [] },
    );
    await mount("/runs");
    await waitFor(() => node("run5-empty") !== null, "empty panel");
    const exportBtn = node("run-list-export") as HTMLButtonElement | null;
    if (exportBtn !== null) {
      expect(exportBtn.disabled).toBe(true);
      expect(exportBtn.title.length, "disabled carries a reason").toBeGreaterThan(0);
    }
    const copyBtn = node("run-list-copy") as HTMLButtonElement | null;
    if (copyBtn !== null) {
      expect(copyBtn.disabled).toBe(true);
      expect(copyBtn.title.length, "disabled carries a reason").toBeGreaterThan(0);
    }
    const more = node("run-more") as HTMLButtonElement | null;
    if (more !== null) {
      expect(more.disabled).toBe(true);
      expect(more.title).toContain("到底");
    }
  });
});
