// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({ fetchJSON: (...args: unknown[]) => fetchJSON(...args) }));
const clipboard = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clipboard.copyTextToClipboard }));
vi.mock("@/lib/api-error", () => ({
  ApiError: class ApiError extends Error {
    status: number; requestId?: string;
    constructor(message: string, init: { status: number; body?: string; url?: string; requestId?: string }) { super(message); this.status = init.status; this.requestId = init.requestId; }
  },
}));
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { outlined?: boolean }) => {
    const { outlined, ...rest } = props; void outlined; return <button {...rest}>{children}</button>;
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
  await act(async () => { root.render(<HealthPage />); });
  await act(async () => {});
}

/** Each read口 answers with its own top-level ISO so every 数据时刻 cell is distinguishable. */
const PAYLOADS = {
  health: { ok: true, asOf: "2026-11-19T06:00:00Z", sources: [
    { id: "svc-a", name: "控制台服务", status: "ok" },
    { id: "svc-b", name: "域服务", status: "ok" },
  ] },
  console: { status: "healthy", asOf: "2026-11-19T01:30:00Z" },
  runtime: { status: "healthy", asOf: "2026-11-19T02:45:00Z" },
  domain: { items: [], asOf: "2026-11-19T04:15:00Z" },
} as const;

function keyOf(url: string): keyof typeof PAYLOADS {
  return url.includes("/api/health") ? "health" : url.includes("__health-probe__") ? "console" : url.includes("hermes-summary") ? "runtime" : "domain";
}

const textOf = (testid: string) => container.querySelector(`[data-testid="${testid}"]`)?.textContent?.trim() ?? null;

/** Every 数据时刻 cell on the page: the service-list stamp, the matrix column and the probe list. */
function asOfCells(): Record<string, string | null> {
  const cells: Record<string, string | null> = { "sys3-asof": textOf("sys3-asof") };
  for (const id of ["health", "console", "runtime", "domain"]) {
    cells[`sys6-asof-${id}`] = textOf(`sys6-asof-${id}`);
    cells[`sys8-asof-${id}`] = textOf(`sys8-asof-${id}`);
  }
  for (const id of ["console", "runtime", "domain", "bisheng"]) cells[`hlt5-asof-${id}`] = textOf(`hlt5-asof-${id}`);
  return cells;
}

const rowCount = (selector: string) => container.querySelectorAll(selector).length;

describe("system refresh stamp versus data stamp", () => {
  it("writes a read stamp that equals no 数据时刻 cell and never overwrites one", async () => {
    // A pinned 2030 clock: the read stamp can never collide with the 2026 upstream values.
    vi.useFakeTimers({ now: new Date("2030-06-01T00:00:00Z"), toFake: ["Date"] });
    const counts: Record<string, number> = { health: 0, console: 0, runtime: 0, domain: 0 };
    let phase: "init" | "refresh" = "init";
    const pending: Array<() => void> = [];
    fetchJSON.mockImplementation((url: string) => {
      const key = keyOf(url);
      counts[key] += 1;
      if (phase === "init") return Promise.resolve(PAYLOADS[key]);
      return new Promise((resolve) => { pending.push(() => resolve(PAYLOADS[key])); });
    });
    await render();
    const before = asOfCells();
    expect(before["sys3-asof"]).toBe("2026-11-19 14:00");
    expect(before["hlt5-asof-console"]).toBe("2026-11-19 09:30");
    expect(before["sys6-asof-runtime"]).toBe("2026-11-19 10:45");
    expect(before["hlt5-asof-bisheng"]).toBe("—");
    expect(container.querySelector("[data-testid='sys-updated-at']")).toBeNull();

    phase = "refresh";
    await act(async () => { (container.querySelector("[data-testid='sys-refresh']") as HTMLButtonElement).click(); });
    // In flight: the read stamp is withdrawn, every 数据时刻 cell keeps its old value.
    expect(container.querySelector("[data-testid='sys-updated-at']")).toBeNull();
    expect(asOfCells()).toEqual(before);

    await act(async () => { pending.splice(0).forEach((resolve) => resolve()); await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    const stamp = textOf("sys-updated-at");
    expect(stamp).toContain("（读取时刻，不是数据时刻）");
    expect(stamp).toContain("2030-06-01 08:00");
    const value = /刷新完成于\s+(.+?)（/.exec(stamp ?? "")?.[1] ?? "";
    expect(value).toBe("2030-06-01 08:00");
    // Neither direction leaks: no 数据时刻 cell holds the read stamp, and the read stamp is not any cell.
    const after = asOfCells();
    for (const [cell, cellValue] of Object.entries(after)) {
      expect(`${cell}=${cellValue}`).not.toBe(`sys-updated-at=${value}`);
      expect(cellValue).not.toContain(value);
    }
    expect(Object.values(after)).not.toContain(value);
    // The refresh re-read the same upstream times; the read stamp did not replace them.
    expect(after).toEqual(before);
  });

  it("keeps the old batch, writes no read stamp on a failed refresh, and retries into a clean success", async () => {
    const counts: Record<string, number> = { health: 0, console: 0, runtime: 0, domain: 0 };
    let phase: "init" | "fail" | "retry" = "init";
    const pending: Array<() => void> = [];
    fetchJSON.mockImplementation((url: string) => {
      const key = keyOf(url);
      counts[key] += 1;
      if (phase === "init") return Promise.resolve(PAYLOADS[key]);
      if (phase === "fail" && key === "health") {
        return Promise.reject(new ApiError("boom", { status: 500, body: "", url, requestId: "req-refresh-500" }));
      }
      if (phase === "fail") return new Promise((resolve) => { pending.push(() => resolve(PAYLOADS[key])); });
      return Promise.resolve(PAYLOADS[key]);
    });
    await render();
    const before = asOfCells();
    phase = "fail";
    await act(async () => { (container.querySelector("[data-testid='sys-refresh']") as HTMLButtonElement).click(); });
    await act(async () => { pending.splice(0).forEach((resolve) => resolve()); await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    expect(container.querySelector("[data-testid='sys-updated-at']")).toBeNull();
    const error = container.querySelector("[data-testid='sys-refresh-error']");
    expect(error?.textContent).toContain("请求编号");
    expect(textOf("sys-refresh-request-id")).toContain("req-refresh-500");
    expect(container.querySelector("[data-testid='sys-refresh-retry']")).toBeTruthy();
    // The old batch survives the failed refresh: same tables, and every 数据时刻 keeps its value
    // EXCEPT the failed read's own matrix row, whose stamp is honestly withdrawn to 「—」.
    expect(rowCount("[data-testid^='sys3-row-']")).toBe(2);
    expect(rowCount("[data-testid^='hlt5-row-']")).toBe(4);
    expect(rowCount("[data-testid^='sys6-row-']")).toBe(4);
    const after = asOfCells();
    expect(after["sys3-asof"]).toBe(before["sys3-asof"]);
    for (const id of ["console", "runtime", "domain"]) {
      expect(after[`sys6-asof-${id}`]).toBe(before[`sys6-asof-${id}`]);
      expect(after[`hlt5-asof-${id}`]).toBe(before[`hlt5-asof-${id}`]);
    }
    expect(after["sys6-asof-health"]).toBe("—");
    expect(container.querySelector("[data-testid='sys6-row-health']")?.getAttribute("data-status")).toBe("failed");

    phase = "retry";
    await act(async () => { (container.querySelector("[data-testid='sys-refresh-retry']") as HTMLButtonElement).click(); });
    await act(async () => {});
    expect(container.querySelector("[data-testid='sys-refresh-error']")).toBeNull();
    expect(textOf("sys-updated-at")).toContain("刷新完成于");
    expect(asOfCells()).toEqual(before);
  });

  it("fires exactly one batch when the refresh button is clicked twice while busy", async () => {
    const counts: Record<string, number> = { health: 0, console: 0, runtime: 0, domain: 0 };
    let phase: "init" | "refresh" = "init";
    const pending: Array<() => void> = [];
    fetchJSON.mockImplementation((url: string) => {
      const key = keyOf(url);
      counts[key] += 1;
      if (phase === "init") return Promise.resolve(PAYLOADS[key]);
      return new Promise((resolve) => { pending.push(() => resolve(PAYLOADS[key])); });
    });
    await render();
    expect(counts).toEqual({ health: 1, console: 1, runtime: 1, domain: 1 });
    phase = "refresh";
    const button = () => container.querySelector("[data-testid='sys-refresh']") as HTMLButtonElement;
    await act(async () => { button().click(); });
    expect(button().disabled).toBe(true);
    await act(async () => { button().click(); });
    await act(async () => { button().click(); });
    expect(counts).toEqual({ health: 2, console: 2, runtime: 2, domain: 2 });
    expect(container.querySelectorAll("[data-testid='sys-busy-note']")).toHaveLength(1);
    await act(async () => { pending.splice(0).forEach((resolve) => resolve()); await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });
    expect(counts).toEqual({ health: 2, console: 2, runtime: 2, domain: 2 });
    expect(textOf("sys-updated-at")).toContain("（读取时刻，不是数据时刻）");
  });

  it("contains a single failed probe to its own row: the other tables keep their rows and stamps", async () => {
    const counts: Record<string, number> = { health: 0, console: 0, runtime: 0, domain: 0 };
    let phase: "init" | "refresh" = "init";
    fetchJSON.mockImplementation((url: string) => {
      const key = keyOf(url);
      counts[key] += 1;
      if (phase === "init") return Promise.resolve(PAYLOADS[key]);
      if (key === "runtime") {
        return Promise.reject(new ApiError("boom", { status: 500, body: "", url, requestId: "req-runtime-500" }));
      }
      return Promise.resolve(PAYLOADS[key]);
    });
    await render();
    const before = asOfCells();
    const sys3Rows = rowCount("[data-testid^='sys3-row-']");
    expect(sys3Rows).toBe(2);
    expect(rowCount("[data-testid^='hlt5-row-']")).toBe(4);
    expect(rowCount("[data-testid^='sys6-row-']")).toBe(4);

    phase = "refresh";
    await act(async () => { (container.querySelector("[data-testid='sys-refresh']") as HTMLButtonElement).click(); });
    await act(async () => {});
    await act(async () => { await Promise.resolve(); });

    // Only the runtime surfaces turned; every other table kept its rows and its 数据时刻.
    expect(rowCount("[data-testid^='sys3-row-']")).toBe(sys3Rows);
    expect(rowCount("[data-testid^='hlt5-row-']")).toBe(4);
    expect(rowCount("[data-testid^='sys6-row-']")).toBe(4);
    const after = asOfCells();
    expect(after["sys3-asof"]).toBe(before["sys3-asof"]);
    expect(after["hlt5-asof-console"]).toBe(before["hlt5-asof-console"]);
    expect(after["hlt5-asof-domain"]).toBe(before["hlt5-asof-domain"]);
    expect(after["sys6-asof-health"]).toBe(before["sys6-asof-health"]);
    expect(container.querySelector("[data-testid='sys6-row-runtime']")?.getAttribute("data-status")).toBe("failed");
    expect(container.querySelector("[data-testid='sys6-row-console']")?.getAttribute("data-status")).toBe("ok");
    expect(container.querySelector("[data-testid='hlt5-row-runtime']")?.textContent).toContain("异常");
    expect(textOf("hlt5-asof-runtime")).toBe("—");
    expect(container.querySelector("[data-testid='hlt5-row-runtime']")?.textContent).toContain("req-runtime-500".slice(0, 8));
    // The batch itself completed: a read stamp landed, no refresh error.
    expect(container.querySelector("[data-testid='sys-refresh-error']")).toBeNull();
    expect(textOf("sys-updated-at")).toContain("刷新完成于");
    expect(counts).toEqual({ health: 2, console: 2, runtime: 2, domain: 2 });
  });
});
