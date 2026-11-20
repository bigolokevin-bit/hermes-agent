// @vitest-environment jsdom
/**
 * R210 — /system 多个读口同时失败/同时恢复时互不污染（纯测试，零产品码改动）。
 *
 * 先现查既有用例（派工单纪律，逐条回证据不写重复）：
 * - `sys-evt-copy-*` / 事件表在本代不存在（第 11 条道确认）：`git grep -n
 *   "sys-evt\|sysEventCopyText\|evt-copy\|evt-more\|evt-count" -- web/src` 只有 4 处命中，
 *   全部是注记（`system.state.isolation.test.tsx:18`、`system.filters.test.tsx:14`、
 *   `system.time.test.tsx:8`、`system.matrix.export.test.tsx:6`）。health 模块没有事件表；
 *   事件表住在 `modules/audit/**`（锚 `agent-v2-page-audit`），与 health 是 shell 里互斥的
 *   live 槽位（R135 实测 `App.tsx` 的 `health:` vs `events:`），同一次挂载里拿不到两张表。
 *   ⇒ 派工单 ② 的「仅矩阵刷新时事件表行数、时间列与 `sys-evt-copy-<i>` 文本不动」不可测：
 *   本代矩阵不发自己的请求（它复用页面四读的结果），也没有事件表可对照，如实记录不编造。
 * - ① 的域内读法「单读源失败时矩阵 asof 与行值不动」已覆盖：R145 ①（改动集恰好是
 *   `[hlt5-row-runtime, sys6-row-runtime]`，兄弟行整段文案逐字不变）、R145 ②（清单失败只
 *   撤自己那格的采集时刻、`sys3-table` 保留旧批）、R148 ②（`sys6-summary` 如实计数）、
 *   R112 ④（单探针失败不外溢行数与时刻）。本文件不重写这一条。
 * - ③④ 的「同时」这一维没人钉过：R145 ①② / R148 ②④ / R112 ②④ / R151 ②④ 全部是
 *   一次只坏一个读口、或一次只恢复一个读口。两读口同批失败、同批恢复是本文件的缺口。
 *
 * 零破集：`sys3-*` / `sys4-detail-*` / `sys5-*` / `sys6-*` / `sys8-*` / `sys15-*` /
 * `sys-refresh` 一族 / `sys-row-copy-*`（R92）/ `hlt5-*` 全部只读不写。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({ fetchJSON: (...args: unknown[]) => fetchJSON(...args) }));
const clipboard = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clipboard.copyTextToClipboard }));
vi.mock("@/lib/api-error", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    requestId?: string;
    constructor(message: string, init: { status: number; body?: string; url?: string; requestId?: string }) {
      super(message);
      this.status = init.status;
      this.requestId = init.requestId;
    }
  },
}));
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { outlined?: boolean }) => {
    const { outlined, ...rest } = props;
    void outlined;
    return <button {...rest}>{children}</button>;
  },
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));
import { HealthPage } from "./HealthPage";
import { ApiError } from "@/lib/api-error";
import { resetSourceMatrix } from "./sourceReads";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  fetchJSON.mockReset();
  clipboard.copyTextToClipboard.mockReset();
  clipboard.copyTextToClipboard.mockResolvedValue(true);
  resetSourceMatrix();
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  resetSourceMatrix();
  window.history.replaceState({}, "", "/");
  vi.useRealTimers();
});

async function render() {
  await act(async () => {
    root.render(<HealthPage />);
  });
  await act(async () => {});
}

const TWO_SOURCES = {
  ok: true,
  asOf: "2026-11-19T06:00:00Z",
  sources: [
    { id: "svc-a", name: "控制台服务", status: "ok" },
    { id: "svc-b", name: "域服务", status: "ok" },
  ],
};
/** The next generation of the same read: one more service, a different stamp. */
const THREE_SOURCES = {
  ok: true,
  asOf: "2026-11-19T07:00:00Z",
  sources: [
    { id: "svc-a", name: "控制台服务", status: "ok" },
    { id: "svc-b", name: "域服务", status: "ok" },
    { id: "svc-c", name: "审批服务", status: "warning" },
  ],
};
const INIT: Record<string, unknown> = {
  health: TWO_SOURCES,
  console: { status: "healthy", asOf: "2026-11-19T01:30:00Z" },
  runtime: { status: "healthy", asOf: "2026-11-19T02:45:00Z" },
  domain: { items: [], asOf: "2026-11-19T04:15:00Z" },
};
/** Recovery generation: the list grows and the runtime probe answers a NEW instant. */
const RECOVER: Record<string, unknown> = {
  health: THREE_SOURCES,
  console: INIT.console,
  runtime: { status: "healthy", asOf: "2026-11-19T03:20:00Z" },
  domain: INIT.domain,
};

const LIST_RID = "req-list-both";
const PROBE_RID = "req-probe-both";

function keyOf(url: string): string {
  return url.includes("/api/health") ? "health" : url.includes("__health-probe__") ? "console" : url.includes("hermes-summary") ? "runtime" : "domain";
}

const textOf = (testid: string) => container.querySelector(`[data-testid="${testid}"]`)?.textContent?.trim() ?? null;
/**
 * Iteration-bounded on purpose: a wall-clock deadline read via `Date.now()` is
 * brittle in this file (the page stamps reads with the browser clock) and the
 * R135 lane learned that the hard way. 600 ticks × 5 ms of real setTimeout is
 * the same ~3 s budget without depending on a frozen clock.
 */
async function waitFor(cond: () => boolean, label: string): Promise<void> {
  for (let i = 0; i < 600; i += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error(`waitFor: ${label} never became true`);
}

/** Flush promises then effects; twice, because a two-source batch settles in two waves. */
async function settle() {
  for (let i = 0; i < 2; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {});
  }
}

const node = <T extends HTMLElement = HTMLElement>(testid: string) => container.querySelector<T>(`[data-testid="${testid}"]`);
const rowCount = (selector: string) => container.querySelectorAll(selector).length;
const idsOf = (prefix: string) =>
  [...container.querySelectorAll<HTMLElement>(`[data-testid^='${prefix}']`)].map((el) => el.getAttribute("data-testid")!);

/** Whole-row wording snapshots, 耗时 folded: it is measured per read, so it always moves. */
function rowSnapshot(): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (const selector of ["[data-testid^='sys3-row-']", "[data-testid^='hlt5-row-']", "[data-testid^='sys6-row-']"]) {
    for (const el of container.querySelectorAll<HTMLElement>(selector)) {
      snapshot[el.getAttribute("data-testid")!] = (el.textContent?.trim() ?? "").replace(/\d+ ms/g, "<n> ms");
    }
  }
  return snapshot;
}

/** Every 数据时刻 face the page can show, so a read stamp can be compared against all of them. */
function dataStamps(): Record<string, string | null> {
  const stamps: Record<string, string | null> = { "sys3-asof": textOf("sys3-asof") };
  for (const id of ["health", "console", "runtime", "domain"]) {
    stamps[`sys6-asof-${id}`] = textOf(`sys6-asof-${id}`);
    stamps[`sys8-asof-${id}`] = textOf(`sys8-asof-${id}`);
    stamps[`hlt5-asof-${id}`] = textOf(`hlt5-asof-${id}`);
  }
  return stamps;
}

const REFRESH = () => node<HTMLButtonElement>("sys-refresh");

describe("R210 — 两个读口同批失败 / 同批恢复互不污染", () => {
  it("③ a list read and a probe read failing in the same batch keep their own anchors and empty nothing", async () => {
    let phase: "init" | "both-fail" = "init";
    const counts: Record<string, number> = { health: 0, console: 0, runtime: 0, domain: 0 };
    fetchJSON.mockImplementation((url: string) => {
      const key = keyOf(url);
      counts[key] += 1;
      if (phase === "init") return Promise.resolve(INIT[key]);
      if (key === "health") return Promise.reject(new ApiError("list exploded", { status: 500, body: "", url, requestId: LIST_RID }));
      if (key === "runtime") return Promise.reject(new ApiError("probe exploded", { status: 500, body: "", url, requestId: PROBE_RID }));
      return Promise.resolve(INIT[key]);
    });
    await render();
    const before = rowSnapshot();
    const stampsBefore = dataStamps();
    const rowsBefore = { sys3: rowCount("[data-testid^='sys3-row-']"), hlt5: rowCount("[data-testid^='hlt5-row-']"), sys6: rowCount("[data-testid^='sys6-row-']") };
    expect(textOf("sys6-summary")).toBe("4 个读口 · 成功 4 · 失败 0 · 读口未接入 0");
    expect(node("sys-refresh-error")).toBeNull();
    expect(node("sys-updated-at")).toBeNull();

    phase = "both-fail";
    REFRESH()!.click();
    await settle();
    await waitFor(() => !!node("sys-refresh-error"), "the same-batch failure landed in the refresh error block");

    // 禁一处失败把另一处清空成 0 行：三张表的行数与失败前一模一样。
    expect({ sys3: rowCount("[data-testid^='sys3-row-']"), hlt5: rowCount("[data-testid^='hlt5-row-']"), sys6: rowCount("[data-testid^='sys6-row-']") }).toEqual(rowsBefore);
    expect(rowsBefore.sys3).toBe(2);
    expect(node("sys3-table")).not.toBeNull();
    // 清单失败不塌成状态面板：有旧数据就保留旧批（hasDataRef），只在刷新错误块里说话。
    expect(node("sys3-error")).toBeNull();
    expect(node("sys-state-state")).toBeNull();

    // 各有各的锚：矩阵两格各自标记，且各自的完整 rid 只在自己的 title 里。
    expect(node("sys6-row-health")?.getAttribute("data-status")).toBe("failed");
    expect(node("sys6-row-runtime")?.getAttribute("data-status")).toBe("failed");
    expect(node("sys6-rid-health")?.getAttribute("title")).toBe(LIST_RID);
    expect(node("sys6-rid-runtime")?.getAttribute("title")).toBe(PROBE_RID);
    expect(textOf("sys6-asof-health")).toBe("—");
    expect(textOf("sys6-asof-runtime")).toBe("—");
    // 探针面只坏自己那一行：状态人话 + 8 位短码，且短码是它自己那枚 rid 的。
    const probeRow = node("hlt5-row-runtime")?.textContent ?? "";
    expect(probeRow).toContain("异常");
    expect(probeRow).toContain(PROBE_RID.slice(0, 8));
    expect(textOf("hlt5-asof-runtime")).toBe("—");

    // 页面级错误块只有一块，且它记的是这一批里的某一次失败（两枚 rid 先到哪枚都算这批）。
    expect(rowCount("[data-testid='sys-refresh-error']")).toBe(1);
    const ridFace = textOf("sys-refresh-request-id") ?? "";
    expect([LIST_RID, PROBE_RID].some((rid) => ridFace.includes(rid))).toBe(true);
    expect(node("sys-refresh-copy")).not.toBeNull();

    // 反向污染为零：兄弟行不谈请求、不喊对方的 rid；清单服务的旧批整段文案逐字不动。
    const after = rowSnapshot();
    for (const [id, text] of Object.entries(after)) {
      if (id.includes("runtime") || id.includes("health")) continue;
      expect(text).toBe(before[id]);
      expect(text).not.toContain("请求编号");
      expect(text).not.toContain(LIST_RID);
      expect(text).not.toContain(PROBE_RID);
    }
    for (const key of idsOf("sys3-row-")) {
      expect(after[key]).toBe(before[key]);
    }
    // 两条好腿的时刻一动不动，摘要如实数出「成功 2 · 失败 2」，失败批不写读时刻。
    for (const id of ["sys6-asof-console", "sys8-asof-console", "hlt5-asof-console", "sys6-asof-domain", "sys8-asof-domain", "hlt5-asof-domain", "sys3-asof"]) {
      expect(textOf(id)).toBe(stampsBefore[id]);
    }
    expect(textOf("sys6-summary")).toBe("4 个读口 · 成功 2 · 失败 2 · 读口未接入 0");
    expect(node("sys-updated-at")).toBeNull();
    expect(counts).toEqual({ health: 2, console: 2, runtime: 2, domain: 2 });
  });

  it("④ recovering both reads in one batch turns both faces green on the NEW generation, with the read stamp alone moving", async () => {
    let phase: "init" | "both-fail" | "recover" = "init";
    const counts: Record<string, number> = { health: 0, console: 0, runtime: 0, domain: 0 };
    fetchJSON.mockImplementation((url: string) => {
      const key = keyOf(url);
      counts[key] += 1;
      if (phase === "both-fail") {
        if (key === "health") return Promise.reject(new ApiError("list exploded", { status: 500, body: "", url, requestId: LIST_RID }));
        if (key === "runtime") return Promise.reject(new ApiError("probe exploded", { status: 500, body: "", url, requestId: PROBE_RID }));
      }
      const table = phase === "recover" ? RECOVER : INIT;
      return Promise.resolve(table[key]);
    });
    await render();
    expect(rowCount("[data-testid^='sys3-row-']")).toBe(2);

    phase = "both-fail";
    REFRESH()!.click();
    await settle();
    await waitFor(() => !!node("sys-refresh-error"), "the same-batch failure landed in the refresh error block");
    expect(textOf("sys6-summary")).toBe("4 个读口 · 成功 2 · 失败 2 · 读口未接入 0");

    phase = "recover";
    REFRESH()!.click();
    await settle();
    await waitFor(() => textOf("sys6-summary") === "4 个读口 · 成功 4 · 失败 0 · 读口未接入 0", "both reads came back green in one batch");

    // 两处同时回绿：错误锚全撤，两枚 rid 消失，摘要数满。
    expect(node("sys-refresh-error")).toBeNull();
    expect(node("sys6-rid-health")).toBeNull();
    expect(node("sys6-rid-runtime")).toBeNull();
    expect(node("sys6-row-health")?.getAttribute("data-status")).toBe("ok");
    expect(node("sys6-row-runtime")?.getAttribute("data-status")).toBe("ok");
    expect(textOf("sys6-summary")).toBe("4 个读口 · 成功 4 · 失败 0 · 读口未接入 0");
    expect(node("hlt5-row-runtime")?.textContent ?? "").not.toContain("异常");

    // 表体跟随新一代而不是回到旧一代：清单多出一项，行键唯一无重复。
    const serviceIds = idsOf("sys3-row-").sort();
    expect(serviceIds).toEqual(["sys3-row-svc-a", "sys3-row-svc-b", "sys3-row-svc-c"]);
    expect(new Set(serviceIds).size).toBe(serviceIds.length);
    expect(rowCount("[data-testid^='hlt5-row-']")).toBe(4);
    expect(rowCount("[data-testid^='sys6-row-']")).toBe(4);

    // 采集时刻换代：清单两格同源，探针那一格是新 instant，好腿一动不动。
    expect(textOf("sys3-asof")).toBe("2026-11-19 15:00");
    expect(textOf("sys6-asof-health")).toBe("2026-11-19 15:00");
    expect(textOf("sys8-asof-health")).toBe("2026-11-19 15:00");
    expect(textOf("sys6-asof-runtime")).toBe("2026-11-19 11:20");
    expect(textOf("hlt5-asof-runtime")).toBe("2026-11-19 11:20");
    expect(textOf("sys6-asof-console")).toBe("2026-11-19 09:30");
    expect(textOf("sys6-asof-domain")).toBe("2026-11-19 12:15");

    // `sys-updated-at` 只在刷新时刻更新：它带着读取时刻的自述，且不等于任何一个数据时刻。
    const stampFace = textOf("sys-updated-at") ?? "";
    expect(stampFace).toContain("（读取时刻，不是数据时刻）");
    const stamp = /刷新完成于 (\d{4}-\d{2}-\d{2} \d{2}:\d{2})/.exec(stampFace);
    expect(stamp, `read stamp unreadable: ${stampFace}`).not.toBeNull();
    const stamps = dataStamps();
    for (const [face, value] of Object.entries(stamps)) {
      expect(stamp![1], face).not.toBe(value);
    }
    // 上一代与失败态的读数零残留：旧时刻不再出现在任何时间面上。
    expect(Object.values(stamps)).not.toContain("2026-11-19 14:00");
    expect(Object.values(stamps)).not.toContain("2026-11-19 10:45");
    expect(Object.values(stamps)).not.toContain("—");
    expect(counts).toEqual({ health: 3, console: 3, runtime: 3, domain: 3 });
  });
});
