// @vitest-environment jsdom
import { act } from "react";
import { readFileSync } from "node:fs";
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
import { readSystemHealth } from "./systemHealth";
import { resetSourceMatrix } from "./sourceReads";
import { sysRowCopyText } from "./rowCopy";

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

async function waitFor(check: () => boolean, label: string) {
  const deadline = Date.now() + 3000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
  }
}

/** Three service rows: full values, a real 0 latency, and a nameless/latency-less row. */
const HEALTH_ROWS = [
  { id: "bff", name: "控制台服务(BFF)", status: "ok", latencyMs: 12 },
  { id: "engine", name: "运行时引擎", status: "warning", latencyMs: 0 },
  { id: "legacy-svc", status: "down" },
];
/** Top-level collection time: 2026-11-19 23:17 in Beijing. Never a browser clock. */
const HEALTH_STAMPED = { ok: true, asOf: "2026-11-19T15:17:00Z", sources: HEALTH_ROWS };
const PROBES = {
  console: { status: "healthy", asOf: "2026-11-19T01:30:00Z" },
  runtime: { status: "healthy", asOf: "2026-11-19T02:45:00Z" },
  domain: { items: [], asOf: "2026-11-19T04:15:00Z" },
};

function keyOf(url: string): "health" | "console" | "runtime" | "domain" {
  return url.includes("/api/health") ? "health" : url.includes("__health-probe__") ? "console" : url.includes("hermes-summary") ? "runtime" : "domain";
}

const q = <T extends HTMLElement = HTMLElement>(testid: string) =>
  container.querySelector<T>(`[data-testid="${testid}"]`);
const calls = () => fetchJSON.mock.calls.length;
const copyButton = (i: number) => q<HTMLButtonElement>(`sys-row-copy-${i}`);

async function clickCopy(i: number) {
  const button = copyButton(i)!;
  await act(async () => { button.click(); await Promise.resolve(); });
}

describe("sys row copy on the health table", () => {
  it("copies each row verbatim — including a real 0 and missing fields — with zero extra requests", async () => {
    fetchJSON.mockImplementation((url: string) => {
      const key = keyOf(url);
      return Promise.resolve(key === "health" ? HEALTH_STAMPED : PROBES[key]);
    });
    await render();
    await waitFor(() => !!q("sys3-table"), "table");
    const before = calls();
    expect(q("sys-row-copy-status")).toBeNull();

    // Native, focusable buttons in rendered row order.
    for (const i of [0, 1, 2]) {
      const button = copyButton(i)!;
      expect(button.tagName).toBe("BUTTON");
      expect(button.getAttribute("type")).toBe("button");
    }
    expect(copyButton(0)?.getAttribute("aria-label")).toBe("复制控制台服务(BFF)这一行");
    expect(copyButton(1)?.getAttribute("aria-label")).toBe("复制运行时引擎这一行");
    expect(copyButton(2)?.getAttribute("aria-label")).toBe("复制legacy-svc这一行");

    await clickCopy(0);
    expect(clipboard.copyTextToClipboard).toHaveBeenLastCalledWith(
      "控制台服务(BFF) · 12 ms · 2026-11-19 23:17 · 正常",
    );
    const status = q("sys-row-copy-status")!;
    expect(status.textContent).toBe("已复制");
    expect(status.getAttribute("role")).toBe("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(q("sys-row-copy-fallback-text")).toBeNull();

    await clickCopy(1);
    expect(clipboard.copyTextToClipboard).toHaveBeenLastCalledWith(
      "运行时引擎 · 0 ms · 2026-11-19 23:17 · 降级",
    );
    await clickCopy(2);
    expect(clipboard.copyTextToClipboard).toHaveBeenLastCalledWith(
      "legacy-svc · — · 2026-11-19 23:17 · 不可达",
    );

    // Copying never toggles the row detail and never reads anything.
    expect(container.querySelectorAll("[data-testid^='sys4-detail-']")).toHaveLength(0);
    expect(calls()).toBe(before);
  });

  it("keeps the data time as 「—」 when upstream sent none, even with a 2031 browser clock", async () => {
    vi.useFakeTimers({ now: new Date("2031-03-01T00:00:00Z"), toFake: ["Date"] });
    fetchJSON.mockImplementation((url: string) => {
      const key = keyOf(url);
      return Promise.resolve(
        key === "health"
          ? { ok: true, sources: [{ id: "bff", name: "控制台服务(BFF)", status: "ok", latencyMs: 12 }] }
          : PROBES[key],
      );
    });
    await render();
    await waitFor(() => !!q("sys3-table"), "table");
    await clickCopy(0);
    expect(clipboard.copyTextToClipboard).toHaveBeenLastCalledWith("控制台服务(BFF) · 12 ms · — · 正常");
    expect(String(clipboard.copyTextToClipboard.mock.lastCall?.[0])).not.toContain("2031");
  });

  it("copies the data time, never the refresh stamp, while a refresh is in flight and after it lands", async () => {
    vi.useFakeTimers({ now: new Date("2030-06-01T00:00:00Z"), toFake: ["Date"] });
    let phase: "init" | "refresh" = "init";
    const pending: Array<() => void> = [];
    fetchJSON.mockImplementation((url: string) => {
      const key = keyOf(url);
      if (phase === "init") {
        return Promise.resolve(key === "health" ? HEALTH_STAMPED : PROBES[key]);
      }
      return new Promise<Record<string, unknown>>((resolve) => {
        pending.push(() => resolve(key === "health" ? HEALTH_STAMPED : PROBES[key]));
      });
    });
    await render();
    await waitFor(() => !!q("sys3-table"), "table");
    expect(q("sys-updated-at")).toBeNull();

    phase = "refresh";
    await act(async () => { q<HTMLButtonElement>("sys-refresh")!.click(); });
    await waitFor(() => pending.length === 4, "refresh batch");
    expect(q("sys-updated-at")).toBeNull(); // read stamp withdrawn while busy

    await clickCopy(0);
    const whileBusy = "控制台服务(BFF) · 12 ms · 2026-11-19 23:17 · 正常";
    expect(clipboard.copyTextToClipboard).toHaveBeenLastCalledWith(whileBusy);
    expect(whileBusy).not.toContain("2030");

    await act(async () => { pending.forEach((release) => release()); await Promise.resolve(); });
    await waitFor(() => !!q("sys-updated-at"), "read stamp");
    const stamped = q("sys-updated-at")!.textContent ?? "";
    expect(stamped).toContain("读取时刻，不是数据时刻");
    expect(stamped).toContain("2030-06-01 08:00");

    await clickCopy(0);
    expect(clipboard.copyTextToClipboard).toHaveBeenLastCalledWith(whileBusy); // untouched by the refresh stamp
    expect(stamped).not.toContain(whileBusy);
    const read = readSystemHealth(HEALTH_STAMPED);
    expect(read).not.toBeNull();
    expect(sysRowCopyText(read!.rows[0])).toBe(whileBusy); // the helper is the single wording source
  });

  it("falls back to a read-only textarea with the exact same text when the clipboard refuses", async () => {
    clipboard.copyTextToClipboard.mockResolvedValue(false);
    fetchJSON.mockImplementation((url: string) => {
      const key = keyOf(url);
      return Promise.resolve(key === "health" ? HEALTH_STAMPED : PROBES[key]);
    });
    await render();
    await waitFor(() => !!q("sys3-table"), "table");
    const before = calls();

    await clickCopy(1);
    expect(q("sys-row-copy-status")?.textContent).toContain("复制失败");
    const fallback = q<HTMLTextAreaElement>("sys-row-copy-fallback-text")!;
    expect(fallback.readOnly).toBe(true);
    expect(fallback.value).toBe("运行时引擎 · 0 ms · 2026-11-19 23:17 · 降级");
    expect(fallback.value).toBe(String(clipboard.copyTextToClipboard.mock.lastCall?.[0]));

    // A later successful click replaces the failure block.
    clipboard.copyTextToClipboard.mockResolvedValue(true);
    await clickCopy(0);
    expect(q("sys-row-copy-status")?.textContent).toBe("已复制");
    expect(q("sys-row-copy-fallback-text")).toBeNull();
    expect(calls()).toBe(before);
  });

  it("re-numbers the buttons with the rendered rows when a state filter narrows the table", async () => {
    fetchJSON.mockImplementation((url: string) => {
      const key = keyOf(url);
      return Promise.resolve(key === "health" ? HEALTH_STAMPED : PROBES[key]);
    });
    await render();
    await waitFor(() => !!q("sys3-table"), "table");
    const before = calls();

    await act(async () => { q<HTMLButtonElement>("sys5-count-normal")!.click(); });
    await waitFor(() => container.querySelectorAll("[data-testid^='sys3-row-']").length === 1, "filtered to 正常");
    expect(copyButton(1)).toBeNull();
    await clickCopy(0);
    expect(clipboard.copyTextToClipboard).toHaveBeenLastCalledWith(
      "控制台服务(BFF) · 12 ms · 2026-11-19 23:17 · 正常",
    );
    expect(calls()).toBe(before);
  });
});

describe("sys row copy sticky rail (buglist P0-5)", () => {
  beforeEach(() => {
    fetchJSON.mockImplementation((url: string) => {
      const key = keyOf(url);
      return Promise.resolve(key === "health" ? HEALTH_STAMPED : PROBES[key]);
    });
  });

  it("keeps the copy cells on the classes the css pins to the scroll shell", async () => {
    await render();
    await waitFor(() => !!q("sys3-table"), "table");

    // Header corner cell: the last th (5 columns — 「重启」整列已删，无读口不留空列),
    // carrying the class the sticky rule hooks.
    const heads = Array.from(container.querySelectorAll(".sys3-table thead th"));
    expect(heads).toHaveLength(5);
    expect(heads[4]?.className).toContain("sys-row-copy-head");

    // Every data row's final cell carries the rail class and holds the copy button.
    const rows = Array.from(container.querySelectorAll("tbody tr.sys3-row"));
    expect(rows).toHaveLength(3);
    for (const [index, row] of rows.entries()) {
      const cells = row.querySelectorAll("td");
      const last = cells[cells.length - 1];
      expect(last?.className).toContain("sys-row-copy-cell");
      expect(last?.querySelector(`[data-testid="sys-row-copy-${index}"]`)).not.toBeNull();
    }
  });

  it("pins that rail to the right edge of the scroll shell in health.css", () => {
    const css = readFileSync(`${process.cwd()}/src/modules/health/health.css`, "utf8");
    // Opaque cell pinned right so sliding columns never show through.
    expect(css).toMatch(/\.sys-row-copy-cell\s*\{[^}]*position: sticky;[^}]*right: 0;[^}]*z-index: 1;[^}]*background: var\(--color-card\);/);
    // Corner cell stacks above both sticky axes (thead th sticks at z-index 0).
    expect(css).toMatch(/\.sys3-table thead \.sys-row-copy-head\s*\{[^}]*position: sticky;[^}]*right: 0;[^}]*z-index: 2;/);
    // The ≤720 right-edge fade would mask the pinned rail itself — it must stay gone.
    expect(css).not.toMatch(/\.sys3-scroll\s*\{[^}]*mask-image/);
  });
});
