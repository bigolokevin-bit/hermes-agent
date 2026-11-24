// @vitest-environment jsdom
/**
 * pump-health — 出站 pump 心跳面（sysP）的红→绿钉测。
 *
 * 现网事实：GET /api/pump-status 在 BFF 上是 404 application/json
 * `{"code":"console.unknown_route", …}`，所以首态必须是「pump 状态未接入」的人话，
 * 不是 spinner、不是空白、更不是伪造的绿色。
 *
 * 形制说明（为什么本文件用 vi.stubGlobal('fetch')，而邻居文件用 vi.hoisted 的
 * fetchJSON mock）：pump 这一腿刻意不走 `@/lib/api` 的 fetchJSON——本目录多个既有
 * 契约测试按调用笔数钉死四条读口（system.time 的 4/8、SourceMatrix 的
 * toHaveBeenCalledTimes(4)、system.window.isolation 的 4），第五笔若从那条缝里出去
 * 就会改掉它们的断言。pump 用自己的 same-origin 读口，于是这里 stub 全局 fetch，
 * 顺带把「重试只重发 pump 这一腿」做成可直接数 URL 的断言。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: (...args: unknown[]) => api.fetchJSON(...args) }));
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: string }) => {
    void tone;
    return <span {...props}>{children}</span>;
  },
  Button: ({ children, outlined, size, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { outlined?: boolean; size?: string }) => {
    void outlined;
    void size;
    return <button {...props}>{children}</button>;
  },
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

import { HealthPage } from "./HealthPage";
import { resetSourceMatrix } from "./sourceReads";
import { beijingMinute } from "./systemHealth";
import { PUMP_PATH, PUMP_STALE_MS, pumpVerdict, readPumpStatus } from "./pumpStatus";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LEGS = {
  health: { ok: true, asOf: "2026-11-19T06:00:00Z", sources: [{ id: "svc-a", name: "控制台服务", status: "ok", version: "4.2.1" }] },
  console: { status: "healthy", asOf: "2026-11-19T06:00:00Z" },
  runtime: { status: "healthy", asOf: "2026-11-19T06:00:00Z" },
  domain: { items: [], asOf: "2026-11-19T06:00:00Z" },
};

const NOT_WIRED_BODY = JSON.stringify({ code: "console.unknown_route", message: "unknown console API route" });

let container: HTMLDivElement;
let root: Root;
const pumpFetch = vi.fn();

function json(payload: unknown, status = 200): Response {
  return new Response(typeof payload === "string" ? payload : JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", "x-console-request-id": "req-pump-1" },
  });
}

function arm(response: () => Response | Promise<Response>): void {
  pumpFetch.mockReset();
  pumpFetch.mockImplementation(async () => response());
}

function pumpCalls(): string[] {
  return pumpFetch.mock.calls.map((call) => String(call[0]));
}

/** 四条既有读口的调用笔数（排除 vitest 收尾的无参调用）。 */
function legReads(): number {
  return api.fetchJSON.mock.calls.filter((call) => call[0] !== undefined).length;
}

function q<T extends HTMLElement = HTMLElement>(testid: string): T | null {
  return container.querySelector<T>(`[data-testid='${testid}']`);
}

function text(testid: string): string {
  return q(testid)?.textContent ?? "";
}

async function waitFor(cond: () => boolean, label: string): Promise<void> {
  for (let i = 0; i < 600; i += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error(`waitFor: ${label} never became true`);
}

async function render(): Promise<void> {
  await act(async () => {
    root.render(<HealthPage />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}

/** 装页：四条既有读口全部正常返回，屏上只剩 pump 这一腿的成色可看。 */
async function mount(): Promise<void> {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(async (url: unknown) => {
    const at = String(url);
    if (at.includes("/api/health")) return LEGS.health;
    if (at.includes("__health-probe__")) return LEGS.console;
    if (at.includes("hermes-summary")) return LEGS.runtime;
    return LEGS.domain;
  });
  await render();
  await waitFor(() => !!q("sys3-table"), "the service list paints");
  await waitFor(() => !!q("sysP-pump"), "the pump line paints");
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  resetSourceMatrix();
  window.history.replaceState({}, "", "/system?tab=health");
  vi.stubGlobal("fetch", pumpFetch);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.replaceChildren();
  resetSourceMatrix();
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
  pumpFetch.mockReset();
});

describe("sysP — 出站 pump 心跳面", () => {
  it("① 404 console.unknown_route：屏上是「pump 状态未接入」的人话，没有 spinner、没有伪造的正常", async () => {
    arm(() => json(NOT_WIRED_BODY, 404));
    await mount();

    expect(container.textContent).toContain("pump 状态未接入");
    expect(text("sysP-pump")).toContain("出站 pump 状态未接入");
    expect(q("sysP-pump")?.getAttribute("data-state")).toBe("notWired");
    // 红→绿门的第一半：未接入时绝不给成功字样，也不给请求编号缺失以外的假结论。
    expect(text("sysP-pump-badge")).toBe("未接入");
    expect(text("sysP-pump")).not.toContain("正常");
    // 屏上不许出现工程 token；这些只活在 title。
    for (const token of ["unknown_route", "pump-status", "GAP-"]) {
      expect(container.textContent, `屏上出现了 ${token}`).not.toContain(token);
    }
    expect(text("sysP-pump"), "状态码不进屏上文案").not.toContain("404");
    expect(q("sysP-pump")?.getAttribute("title")).toContain("console.unknown_route");
    // 无 spinner 残留：本页三种骨架与壳的 pulse 都不该在 pump 行亮起时留下。
    expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(0);
    expect(container.querySelectorAll(".hlt5-skeleton")).toHaveLength(0);
    expect(container.querySelectorAll(".sys3-skeleton")).toHaveLength(0);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(0);
    // 未接入态不给重试钮：重试改变不了一个还没接线的端点。
    expect(q("sysP-pump-retry")).toBeNull();
  });

  it("② 200 带 10 秒内的 lastTickAt：心跳正常，最近 tick 的北京时刻上屏，ISO 只在 title", async () => {
    const tick = new Date(Date.now() - 10_000).toISOString();
    arm(() => json({ lastTickAt: tick, state: "running" }));
    await mount();

    expect(q("sysP-pump")?.getAttribute("data-state")).toBe("alive");
    expect(text("sysP-pump-badge")).toBe("正常");
    expect(text("sysP-pump")).toContain("出站 pump 心跳正常");
    const shown = beijingMinute(tick) ?? "";
    expect(shown).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(text("sysP-pump")).toContain(shown);
    expect(text("sysP-pump")).not.toContain("T");
    expect(text("sysP-pump")).not.toContain("Z");
    expect(q("sysP-pump")?.getAttribute("title")).toContain(tick);
    // 上游自报的词只作旁证，写在 title 里，不参与判活。
    expect(q("sysP-pump")?.getAttribute("title")).toContain("running");
  });

  it("③ 200 带 120 秒前的 lastTickAt：告警态「超过 90 秒未心跳」", async () => {
    const tick = new Date(Date.now() - 120_000).toISOString();
    arm(() => json({ tick_at: tick }));
    await mount();

    expect(q("sysP-pump")?.getAttribute("data-state")).toBe("stale");
    expect(text("sysP-pump")).toContain("超过 90 秒未心跳");
    expect(text("sysP-pump")).toContain(beijingMinute(tick) ?? "");
    expect(text("sysP-pump-badge")).toBe("超期");
    expect(text("sysP-pump")).not.toContain("心跳正常");
  });

  it("④ 500：这次没读到 + 单腿重试；重试只发 pump 一条 URL，四条既有读口一笔不增，并翻成绿色", async () => {
    arm(() => json({ detail: "boom" }, 500));
    await mount();

    expect(q("sysP-pump")?.getAttribute("data-state")).toBe("failed");
    expect(text("sysP-pump")).toContain("这次没读到 pump 状态");
    // 非 404 的失败不许归成「未接入」。
    expect(container.textContent).not.toContain("pump 状态未接入");
    const retry = q<HTMLButtonElement>("sysP-pump-retry");
    expect(retry, "读失败要给可点的重试").not.toBeNull();

    expect(pumpCalls()).toEqual([PUMP_PATH]);
    const readsBefore = legReads();

    // 重试只重发这一腿：把端点翻成有数据，看绿色是怎么来的。
    const tick = new Date(Date.now() - 5_000).toISOString();
    arm(() => json({ lastTickAt: tick }));
    await act(async () => {
      retry?.click();
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    await waitFor(() => q("sysP-pump")?.getAttribute("data-state") === "alive", "pump turns alive");

    // arm() 里 mockReset 会清空挂载那笔的记账，此处列表即重试本身：恰好一笔。
    expect(pumpCalls(), "重试只发 /api/pump-status 一条 URL").toEqual([PUMP_PATH]);
    expect(pumpCalls().every((url) => url === PUMP_PATH), "没有第二条形制的 URL 混进来").toBe(true);
    expect(legReads(), "整页四条既有读口一笔都没有被重跑").toBe(readsBefore);
    expect(text("sysP-pump")).toContain("出站 pump 心跳正常");
    expect(q("sysP-pump-retry"), "翻绿之后重试钮收起").toBeNull();
  });

  it("④b 网络断开与假 200 的 HTML：都只说「这次没读到」，不退化成未接入也不退化成正常", async () => {
    for (const fake of [
      () => Promise.reject(new TypeError("Failed to fetch")),
      () => new Response("<html><body>gateway</body></html>", { status: 200, headers: { "content-type": "text/html" } }),
      () => json({ detail: "not this code" }, 404),
    ]) {
      act(() => root.unmount());
      container.remove();
      document.body.replaceChildren();
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);

      arm(fake);
      await mount();
      expect(q("sysP-pump")?.getAttribute("data-state"), "读不到就说读不到").toBe("failed");
      expect(text("sysP-pump")).toContain("这次没读到 pump 状态");
      expect(container.textContent).not.toContain("pump 状态未接入");
      expect(text("sysP-pump")).not.toContain("心跳正常");
      expect(q("sysP-pump-retry")).not.toBeNull();
    }
  });

  it("④c pump 的行不进读源矩阵：矩阵仍是四条既有读口的契约集合", async () => {
    arm(() => json(NOT_WIRED_BODY, 404));
    await mount();
    await act(async () => {
      q<HTMLButtonElement>("sys6-toggle")?.click();
    });
    await waitFor(() => container.querySelectorAll("[data-testid^='sys6-row-']").length === 4, "matrix expanded");
    expect(container.querySelectorAll("[data-testid^='sys6-row-']")).toHaveLength(4);
    expect(container.textContent).not.toContain("出站 pump 心跳");
  });

  it("④d 预览态不发请求也不给结论", async () => {
    window.history.replaceState({}, "", "/system?tab=health&state=empty");
    arm(() => json({ lastTickAt: new Date().toISOString() }));
    await render();
    expect(pumpCalls(), "预览态不发起 pump 读取").toHaveLength(0);
    expect(q("sysP-pump"), "预览态不渲染 pump 结论").toBeNull();
  });
});

describe("sysP — 纯函数表驱动", () => {
  const NOW = Date.parse("2026-11-19T06:00:00Z");

  it("⑤ pumpVerdict 四态与 90 秒边界", () => {
    const at = (deltaMs: number) => new Date(NOW - deltaMs).toISOString();
    const cases: Array<{ name: string; status: { tickAt: string | null; state: string | null } | null; notWired?: boolean; want: string }> = [
      { name: "未接入优先于一切读数", status: { tickAt: at(1_000), state: null }, notWired: true, want: "notWired" },
      { name: "没有读数", status: null, want: "unknown" },
      { name: "有对象但没有时刻", status: { tickAt: null, state: "running" }, want: "unknown" },
      { name: "时刻不可解析", status: { tickAt: "昨天下午", state: null }, want: "unknown" },
      { name: "刚跳过", status: { tickAt: at(1_000), state: null }, want: "alive" },
      { name: "边界内 89_999", status: { tickAt: at(89_999), state: null }, want: "alive" },
      { name: "整点 90_000 还不算超期", status: { tickAt: at(PUMP_STALE_MS), state: null }, want: "alive" },
      { name: "边界外 90_001", status: { tickAt: at(90_001), state: null }, want: "stale" },
      { name: "很久没跳", status: { tickAt: at(3_600_000), state: null }, want: "stale" },
    ];
    for (const testCase of cases) {
      expect(pumpVerdict(testCase.status, NOW, testCase.notWired ?? false), testCase.name).toBe(testCase.want);
    }
    // 未来时刻不被当成超期，也不被当成没读到。
    expect(pumpVerdict({ tickAt: new Date(NOW + 60_000).toISOString(), state: null }, NOW)).toBe("alive");
  });

  it("⑤b readPumpStatus 宽容取键：lastTickAt / tick_at / lastHeartbeat 任一键，state 透传", () => {
    expect(readPumpStatus({ lastTickAt: "2026-11-19T06:00:00Z", state: "running" })).toEqual({
      tickAt: "2026-11-19T06:00:00Z",
      state: "running",
    });
    expect(readPumpStatus({ tick_at: "2026-11-19T05:59:00Z" }).tickAt).toBe("2026-11-19T05:59:00Z");
    expect(readPumpStatus({ last_heartbeat: "2026-11-19T05:58:00Z" }).tickAt).toBe("2026-11-19T05:58:00Z");
    expect(readPumpStatus({ status: "ok", lastHeartbeat: "2026-11-19T05:57:00Z" })).toEqual({
      tickAt: "2026-11-19T05:57:00Z",
      state: "ok",
    });
    // 没有键 / 键不是可解析时刻 / 载荷不是对象 —— 一律 null，不猜、不用本机时间补。
    expect(readPumpStatus({})).toEqual({ tickAt: null, state: null });
    expect(readPumpStatus({ lastTickAt: "" })).toEqual({ tickAt: null, state: null });
    expect(readPumpStatus({ lastTickAt: "not-a-moment" }).tickAt).toBeNull();
    expect(readPumpStatus(null)).toEqual({ tickAt: null, state: null });
    expect(readPumpStatus([])).toEqual({ tickAt: null, state: null });
  });
});
