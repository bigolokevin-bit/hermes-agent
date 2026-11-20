// @vitest-environment jsdom
/**
 * R145 — /system 四态与读源失败不互相污染护栏（纯测试，零产品码改动）。
 *
 * 现查既有用例（派工单纪律）：
 * - `system.refresh.test.tsx`（R112）已锁：①读时刻与数据时刻互不相等互不覆盖；
 *   ②刷新失败保留旧批 + `sys-updated-at` 不写 + 错误态带 rid 与重试；③busy 连点只发一批
 *   （`sys-busy-note` 计数 1、按钮 `.disabled`）；④单探针失败只坏该探针面（行数保留、
 *   `sys6-row-runtime data-status=failed`、`hlt5-row-runtime` 含「异常」与短 rid、非 allDown
 *   不产 `sys-refresh-error`）。
 * - `SystemHealthSurface.test.tsx` 已锁 `sys-state-*` 四态面板自身（error 带
 *   `sys-state-rid`/`sys-state-rid-copy`/`sys-state-retry`，denied 无重试，empty、empty-filter 带清除）。
 * 本文件只补三处缺口：
 *   a) 「其余表文案不变」——按 testid 逐行快照整段 textContent，而不只是行数与采集时刻；
 *   b) 失败的 rid 只出现在它自己的面上，不渗进兄弟行文案、也不被读源面板吞掉（反向污染）；
 *   c) 恢复后**数据换代**：行数跟随新响应（R112 的重试用同一份 payload，换代未被证明）。
 * 零破集核对：`sys-row-copy-*`（R92）、`sys-state-*`、`sys-refresh` 一族本文件只读不写；
 * `sys-evt-copy-*` 本代不存在（R124 放弃：health 模块无事件表），无从破起，如实记录。
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
  vi.useRealTimers();
});

async function render() {
  await act(async () => {
    root.render(<HealthPage />);
  });
  await act(async () => {});
}

/** Flush whatever the last interaction queued, twice: promises then effects. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {});
}

const TWO_SOURCES = { ok: true, asOf: "2026-11-19T06:00:00Z", sources: [{ id: "svc-a", name: "控制台服务", status: "ok" }, { id: "svc-b", name: "域服务", status: "ok" }] };
/** The next generation of the same read: one more service, a different stamp. */
const THREE_SOURCES = {
  ok: true,
  asOf: "2026-11-19T07:00:00Z",
  sources: [{ id: "svc-a", name: "控制台服务", status: "ok" }, { id: "svc-b", name: "域服务", status: "ok" }, { id: "svc-c", name: "审批服务", status: "warning" }],
};
const PAYLOADS: Record<string, unknown> = {
  health: TWO_SOURCES,
  console: { status: "healthy", asOf: "2026-11-19T01:30:00Z" },
  runtime: { status: "healthy", asOf: "2026-11-19T02:45:00Z" },
  domain: { items: [], asOf: "2026-11-19T04:15:00Z" },
};

function keyOf(url: string): string {
  return url.includes("/api/health") ? "health" : url.includes("__health-probe__") ? "console" : url.includes("hermes-summary") ? "runtime" : "domain";
}

const textOf = (testid: string) => container.querySelector(`[data-testid="${testid}"]`)?.textContent?.trim() ?? null;
const rowCount = (selector: string) => container.querySelectorAll(selector).length;

/**
 * Every row of every table, keyed by testid, whole textContent — the wording snapshot.
 * The 耗时 cell is measured per read (`performance.now()`), so it changes on every
 * refresh by nature; folding it to a placeholder keeps the snapshot about wording
 * (name, state, endpoint, 数据时刻) instead of about millisecond jitter.
 */
function rowSnapshot(): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (const selector of ["[data-testid^='sys3-row-']", "[data-testid^='hlt5-row-']", "[data-testid^='sys6-row-']"]) {
    for (const node of container.querySelectorAll<HTMLElement>(selector)) {
      snapshot[node.getAttribute("data-testid")!] = (node.textContent?.trim() ?? "").replace(/\d+ ms/g, "<n> ms");
    }
  }
  return snapshot;
}

const REFRESH = () => container.querySelector("[data-testid='sys-refresh']") as HTMLButtonElement;

describe("R145 — /system 读源失败不互相污染", () => {
  it("① one failed probe turns only its own surfaces, and every sibling row keeps its exact wording", async () => {
    let phase: "init" | "fail" = "init";
    const counts: Record<string, number> = { health: 0, console: 0, runtime: 0, domain: 0 };
    fetchJSON.mockImplementation((url: string) => {
      const key = keyOf(url);
      counts[key] += 1;
      if (phase === "init") return Promise.resolve(PAYLOADS[key]);
      if (key === "runtime") return Promise.reject(new ApiError("boom", { status: 500, body: "", url, requestId: "req-isolate-500" }));
      return Promise.resolve(PAYLOADS[key]);
    });
    await render();
    const before = rowSnapshot();
    expect(Object.keys(before).filter((id) => id.startsWith("sys3-row-"))).toHaveLength(2);
    // No state panel while the list reads fine.
    expect(container.querySelector("[data-testid='sys-state-state']")).toBeNull();

    phase = "fail";
    REFRESH().click();
    await settle();

    // Only the failed read's own surfaces turned…
    expect(textOf("sys6-row-runtime")).not.toBe(before["sys6-row-runtime"]);
    expect(container.querySelector("[data-testid='sys6-row-runtime']")?.getAttribute("data-status")).toBe("failed");
    expect(textOf("sys6-asof-runtime")).toBe("—");
    expect(textOf("hlt5-asof-runtime")).toBe("—");
    const failedRow = container.querySelector("[data-testid='hlt5-row-runtime']")?.textContent ?? "";
    expect(failedRow).toContain("异常");
    expect(failedRow).toContain("req-isolate-500".slice(0, 8));

    // …and every other row is byte-identical, not merely the same count. The only
    // rows that moved are the failed read's own two; nothing else drifted at all.
    const after = rowSnapshot();
    const changed = Object.keys(after)
      .filter((id) => after[id] !== before[id])
      .sort();
    expect(changed).toEqual(["hlt5-row-runtime", "sys6-row-runtime"]);
    for (const [id, text] of Object.entries(after)) {
      if (id.includes("runtime")) continue;
      expect(text).toBe(before[id]);
      // The request id leaked nowhere else: no sibling row speaks of a request at all.
      expect(text).not.toContain("请求编号");
      expect(text).not.toContain("req-isolate-500");
    }
    // A single probe failing is not a page state: the list panel never appears, no refresh error.
    expect(container.querySelector("[data-testid='sys-state-state']")).toBeNull();
    expect(container.querySelector("[data-testid='sys-refresh-error']")).toBeNull();
    expect(counts).toEqual({ health: 2, console: 2, runtime: 2, domain: 2 });
  });

  it("② a failed list read keeps the previous batch verbatim, writes no read stamp, and speaks only in the refresh error block", async () => {
    let phase: "init" | "fail" = "init";
    fetchJSON.mockImplementation((url: string) => {
      const key = keyOf(url);
      if (phase === "init") return Promise.resolve(PAYLOADS[key]);
      if (key === "health") return Promise.reject(new ApiError("boom", { status: 500, body: "", url, requestId: "req-list-500" }));
      return Promise.resolve(PAYLOADS[key]);
    });
    await render();
    const before = rowSnapshot();
    expect(before["sys3-row-svc-a"]).toContain("控制台服务");
    const probeStamps = { console: textOf("sys6-asof-console"), runtime: textOf("sys6-asof-runtime"), domain: textOf("sys6-asof-domain") };

    phase = "fail";
    REFRESH().click();
    await settle();

    // The old batch is still on screen, word for word, in the same order.
    const sys3After = Object.entries(rowSnapshot()).filter(([id]) => id.startsWith("sys3-row-"));
    expect(sys3After.map(([id]) => id)).toEqual(["sys3-row-svc-a", "sys3-row-svc-b"]);
    for (const [id, text] of sys3After) expect(text).toBe(before[id]);
    // The failure is reported once, in the refresh block — and its rid stays there.
    expect(container.querySelector("[data-testid='sys-refresh-error']")?.textContent).toContain("req-list-500");
    expect(textOf("sys-refresh-request-id")).toContain("req-list-500");
    expect(container.querySelector("[data-testid='sys-refresh-retry']")).toBeTruthy();
    expect(container.querySelector("[data-testid='sys-updated-at']")).toBeNull();
    // No state panel hijacked the table, and no data row adopted the failure wording.
    expect(container.querySelector("[data-testid='sys-state-state']")).toBeNull();
    // The whole batch is verbatim, except the failed read's own matrix row — which is
    // honestly marked rather than left claiming success.
    const afterRows = rowSnapshot();
    for (const [id, text] of Object.entries(afterRows)) {
      expect(text).not.toContain("req-list-500");
      if (id !== "sys6-row-health") expect(text).toBe(before[id]);
    }
    expect(afterRows["sys6-row-health"]).not.toBe(before["sys6-row-health"]);
    expect(container.querySelector("[data-testid='sys6-row-health']")?.getAttribute("data-status")).toBe("failed");
    // Only the failed read's own matrix stamp is withdrawn — the probes kept theirs.
    expect(textOf("sys6-asof-health")).toBe("—");
    expect(textOf("sys6-asof-console")).toBe(probeStamps.console);
    expect(textOf("sys6-asof-runtime")).toBe(probeStamps.runtime);
    expect(textOf("sys6-asof-domain")).toBe(probeStamps.domain);
  });

  it("③ clicking refresh again while busy sends no second batch and contaminates nothing", async () => {
    let phase: "init" | "refresh" = "init";
    const pending: Array<() => void> = [];
    const counts: Record<string, number> = { health: 0, console: 0, runtime: 0, domain: 0 };
    fetchJSON.mockImplementation((url: string) => {
      const key = keyOf(url);
      counts[key] += 1;
      if (phase === "init") return Promise.resolve(PAYLOADS[key]);
      return new Promise((resolve) => {
        pending.push(() => resolve(PAYLOADS[key]));
      });
    });
    await render();
    const before = rowSnapshot();
    expect(counts).toEqual({ health: 1, console: 1, runtime: 1, domain: 1 });

    phase = "refresh";
    REFRESH().click();
    await settle();
    const busy = REFRESH();
    expect(busy.disabled).toBe(true);
    expect(busy.getAttribute("aria-busy")).toBe("true");
    // Two more clicks while the batch is still in flight.
    busy.click();
    await settle();
    busy.click();
    await settle();

    expect(counts).toEqual({ health: 2, console: 2, runtime: 2, domain: 2 });
    expect(container.querySelectorAll("[data-testid='sys-busy-note']")).toHaveLength(1);
    // The extra clicks wrote no error, no read stamp, and did not touch a single row.
    expect(container.querySelector("[data-testid='sys-refresh-error']")).toBeNull();
    expect(container.querySelector("[data-testid='sys-updated-at']")).toBeNull();
    expect(container.querySelector("[data-testid='sys-state-state']")).toBeNull();
    expect(rowSnapshot()).toEqual(before);

    pending.splice(0).forEach((resolve) => resolve());
    await settle();
    expect(counts).toEqual({ health: 2, console: 2, runtime: 2, domain: 2 });
    expect(container.querySelectorAll("[data-testid='sys-updated-at']")).toHaveLength(1);
    expect(textOf("sys-updated-at")).toContain("（读取时刻，不是数据时刻）");
    expect(container.querySelector("[data-testid='sys-busy-note']")).toBeNull();
  });

  it("④ recovery drops the error row and the tables follow the NEW payload, not the old one", async () => {
    let phase: "init" | "fail" | "recover" = "init";
    const counts: Record<string, number> = { health: 0, console: 0, runtime: 0, domain: 0 };
    fetchJSON.mockImplementation((url: string) => {
      const key = keyOf(url);
      counts[key] += 1;
      if (phase === "init") return Promise.resolve(PAYLOADS[key]);
      if (phase === "fail" && key === "runtime") return Promise.reject(new ApiError("boom", { status: 500, body: "", url, requestId: "req-gone-500" }));
      if (phase === "recover" && key === "health") return Promise.resolve(THREE_SOURCES);
      return Promise.resolve(PAYLOADS[key]);
    });
    await render();
    expect(rowCount("[data-testid^='sys3-row-']")).toBe(2);

    // Break one probe, so there is an error row to lose.
    phase = "fail";
    REFRESH().click();
    await settle();
    expect(container.querySelector("[data-testid='hlt5-row-runtime']")?.textContent).toContain("异常");
    expect(textOf("sys6-asof-runtime")).toBe("—");

    // Recover with a different generation of the health list: three services, new stamp.
    PAYLOADS.health = THREE_SOURCES;
    phase = "recover";
    REFRESH().click();
    await settle();

    // Row count follows the new response, and the new row is really there.
    const sys3Ids = [...container.querySelectorAll<HTMLElement>("[data-testid^='sys3-row-']")].map((node) => node.getAttribute("data-testid"));
    expect(sys3Ids).toEqual(["sys3-row-svc-a", "sys3-row-svc-b", "sys3-row-svc-c"]);
    expect(textOf("sys3-asof")).toBe("2026-11-19 15:00");
    // The error row is gone: no surface still speaks of the failed read.
    expect(container.querySelector("[data-testid='hlt5-row-runtime']")?.textContent).not.toContain("异常");
    expect(container.querySelector("[data-testid='hlt5-row-runtime']")?.textContent).not.toContain("req-gone-500".slice(0, 8));
    expect(textOf("sys6-asof-runtime")).toBe("2026-11-19 10:45");
    expect(container.querySelector("[data-testid='sys6-row-runtime']")?.getAttribute("data-status")).toBe("ok");
    expect(container.querySelector("[data-testid='sys-refresh-error']")).toBeNull();
    expect(textOf("sys-updated-at")).toContain("刷新完成于");
    // Every table still agrees on one generation: matrix rows are the four fixed reads.
    expect(rowCount("[data-testid^='sys6-row-']")).toBe(4);
    expect(rowCount("[data-testid^='hlt5-row-']")).toBe(4);
    expect(counts).toEqual({ health: 3, console: 3, runtime: 3, domain: 3 });
  });
});
