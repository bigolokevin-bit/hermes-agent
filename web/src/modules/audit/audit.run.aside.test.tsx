// @vitest-environment jsdom
// AU-07 — 「这次运行」aside in the audit record pane (right rail).
//
// 票面判据（板注+deep/04-runs.md §3.9 谱系，现读为准）：
//  ①事件带 runId → 右栏出运行卡：状态四词表封闭、缺值「该字段未返回」、真 0 花费
//    显 $0.00（与缺值字面必须不同）；
//  ②运行读口的值只来自 /api/run-detail——不拿事件字段替运行补数（断言：事件体里
//    写了 employeeId=X 而运行回答缺该键 → 卡上显未返回，不是 X）；
//  ③失败族诚实：403/404 同体（不泄露存在性）、console.unknown_route 说未接入且
//    不给重试承诺、重试按钮对同一单再问一次；
//  ④无 runId 的事件整卡不挂（链位的「无关联」已是答案，不留空心 Section）；
//  ⑤链出口只问 AU-01 单表（runChainOf）：href 与该表逐字同值；
//  ⑥换条记录时上一条运行读口的迟到回答不得覆盖（seq 票号守卫）；
//  ⑦读口次数纪律：打开一条带 run 的事件 = 1 问运行详情；不追问、不轮询。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "./AuditEventsModulePage";
import {
  normalizeRunAside,
  runAsideFailureOf,
  runCostWord,
  runDetailUrl,
  runStatusWord,
} from "./runAside";
import { runChainOf } from "./contextLinks";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RUN_ID = "rn_AU0701M81AZV6P7TAX8KGXKK";
const ROW = {
  eventId: "evt_au07_0000000000000001",
  action: "dispatch.event",
  occurredAt: "2026-11-19T01:20:00Z",
  recordedAt: "2026-11-19T01:20:05Z",
  outcome: "succeeded",
  actor: { type: "employee", id: "employee:8812000000000011" },
  resource: { type: "task", id: "tk_au07" },
  runId: RUN_ID,
  requestId: "req-au07-row",
};
const ROW_NO_RUN = { ...ROW, eventId: "evt_au07_norun_000000001", runId: undefined };
const BASE = "/audit?window=custom&from=2026-11-05T02:00:00Z&to=2026-11-19T02:00:00Z&limit=25";

let root: Root | null = null;
const urls = (): string[] => api.fetchJSON.mock.calls.map((c) => String(c[0]));
const runReads = (): number => urls().filter((u) => u.startsWith("/agent-api/api/run-detail")).length;
const q = (sel: string): Element | null => document.querySelector(sel);
const txt = (testId: string): string =>
  (q(`[data-testid='${testId}']`)?.textContent ?? "").trim();

async function waitFor(cond: () => boolean, label: string): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label}`);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  }
}

async function render(entry: string): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <AuditEventsModulePage />
      </MemoryRouter>,
    );
  });
  await waitFor(() => q(".animate-pulse") === null, "skeleton gone");
}

function impl(url: string) {
  if (url.startsWith("/agent-api/api/audit-detail")) {
    const id = new URL(url, "http://c.test").searchParams.get("id");
    return { audit: id === ROW_NO_RUN.eventId ? ROW_NO_RUN : ROW };
  }
  if (url.startsWith("/agent-api/api/run-detail")) return undefined; // 由用例决定
  return { items: [ROW, ROW_NO_RUN], nextCursor: null };
}

beforeEach(() => {
  api.fetchJSON.mockReset();
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("AU-07 pure legs", () => {
  it("normalise 只认运行读口的原值；缺键=null；无 identity=null", () => {
    expect(normalizeRunAside({ runId: RUN_ID, status: "running", startedAt: "x" })).toEqual({
      runId: RUN_ID,
      status: "running",
      employeeId: null,
      startedAt: "x",
      endedAt: null,
      costUsd: null,
    });
    expect(normalizeRunAside({ id: RUN_ID, costUsd: 0 }).costUsd).toBe(0);
    expect(normalizeRunAside({ status: "succeeded" })).toBeNull();
    expect(normalizeRunAside(null)).toBeNull();
    expect(normalizeRunAside({ run: { runId: RUN_ID, employeeId: " emp_1 " } }).employeeId).toBe("emp_1");
  });

  it("状态四词表封闭：表外原样、缺值破折；花费 null 与真 0 字面不同", () => {
    expect(runStatusWord("succeeded")).toBe("成功");
    expect(runStatusWord("FAILED")).toBe("失败");
    expect(runStatusWord("weird_state")).toBe("weird_state");
    expect(runStatusWord(null)).toBe("—");
    expect(runCostWord(null)).toBe("该字段未返回");
    expect(runCostWord(0)).toBe("$0.00");
    expect(runCostWord(1.5)).toBe("$1.50");
  });

  it("失败族：403/404 同体不泄露存在性；unknown_route 未接入且不承诺重试", () => {
    const e = (status: number, code?: string) =>
      new ApiError("x", {
        status,
        body: code ? JSON.stringify({ code }) : "",
        url: "/agent-api/api/run-detail",
        requestId: "req-aside-1",
      });
    const f403 = runAsideFailureOf(e(403));
    const f404 = runAsideFailureOf(e(404));
    expect(f403.text).toBe(f404.text);
    expect(f403.text).toContain("不存在或你无权访问");
    expect(f403.requestId).toBe("req-aside-1");
    const fUnknown = runAsideFailureOf(e(404, "console.unknown_route"));
    expect(fUnknown.text).toContain("尚未接入");
    expect(fUnknown.text).not.toContain("可以重试"); // 不承诺重试（「也不重试」的否定式合法）
    expect(runAsideFailureOf(e(500)).text).toContain("HTTP 500");
  });

  it("读口地址形状：query 参数带 id（R2 契约）", () => {
    expect(runDetailUrl("rn_a/b")).toBe("/agent-api/api/run-detail?id=rn_a%2Fb");
  });
});

describe("AU-07 record pane aside", () => {
  it("带 run 的事件：1 问运行详情、五格齐、真值上屏、链出口与单表逐字同值", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      const preset = impl(url);
      if (preset !== undefined) return preset;
      return {
        runId: RUN_ID,
        status: "running",
        employeeId: "emp_77",
        startedAt: "2026-11-19T01:20:00Z",
        costUsd: 0,
      };
    });
    await render(`${BASE}&detail=${ROW.eventId}`);
    await waitFor(() => q("[data-testid='aud3-run-aside']") !== null, "the run aside painted");
    expect(runReads(), "一条记录一问运行读口").toBe(1);
    expect(txt("aud3-run-status")).toBe("运行中");
    expect(txt("aud3-run-employee")).toBe("emp_77");
    // 事件体里的 actor id 与运行读口的 employeeId 不互换（补数禁令的机器证明在下一例）
    expect(txt("aud3-run-start")).toContain("2026-11-19");
    expect(txt("aud3-run-cost")).toBe("$0.00");
    expect(txt("aud3-run-end")).toBe("该字段未返回");
    const open = q("[data-testid='aud3-run-open'] a") as HTMLAnchorElement;
    expect(open).not.toBeNull();
    expect(open.getAttribute("href")).toBe(
      runChainOf([{ noun: "运行", label: "运行", raw: RUN_ID }]).href,
    );
    expect(open.getAttribute("rel")).toBe("noreferrer noopener");
    expect(open.textContent).toContain(RUN_ID);
  });

  it("运行读口缺键不拿事件字段补：employeeId 缺 → 未返回，非事件里的 8812", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      const preset = impl(url);
      if (preset !== undefined) return preset;
      return { runId: RUN_ID, status: "succeeded" };
    });
    await render(`${BASE}&detail=${ROW.eventId}`);
    await waitFor(() => q("[data-testid='aud3-run-aside']") !== null, "aside");
    expect(txt("aud3-run-employee")).toBe("该字段未返回");
    expect(txt("aud3-run-cost")).toBe("该字段未返回");
    expect(q("[data-testid='aud3-run-aside']")?.textContent).not.toContain("8812");
  });

  it("失败态：404 同体文案 + 请求编号 + 重试再问一次", async () => {
    let n = 0;
    api.fetchJSON.mockImplementation(async (url: string) => {
      const preset = impl(url);
      if (preset !== undefined) return preset;
      n += 1;
      if (n === 1) {
        throw new ApiError("gone", {
          status: 404,
          body: JSON.stringify({ code: "run.not_found" }),
          url: "/agent-api/api/run-detail",
          requestId: "req-aside-404",
        });
      }
      return { runId: RUN_ID, status: "succeeded" };
    });
    await render(`${BASE}&detail=${ROW.eventId}`);
    await waitFor(() => q("[data-testid='aud3-run-aside-error']") !== null, "error state");
    expect(txt("aud3-run-aside-error")).toContain("运行不存在或你无权访问");
    expect(txt("aud3-run-aside-rid")).toContain("req-aside-404");
    expect(runReads()).toBe(1);

    await act(async () => {
      (q("[data-testid='aud3-run-aside-retry']") as HTMLElement).click();
    });
    await waitFor(() => q("[data-testid='aud3-run-aside']") !== null, "retry recovered");
    expect(runReads(), "重试=对同一单再问一次").toBe(2);
    expect(q("[data-testid='aud3-run-aside-error']")).toBeNull();
  });

  it("无 run 的事件：整卡不挂，运行读口零问", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      const preset = impl(url);
      if (preset !== undefined) return preset;
      return { runId: RUN_ID };
    });
    await render(`${BASE}&detail=${ROW_NO_RUN.eventId}`);
    await waitFor(() => q("[data-testid='aud02-detail']") !== null, "the pane painted");
    expect(q("[data-testid='aud3-run-aside']")).toBeNull();
    expect(q("[data-testid='aud3-run-loading']")).toBeNull();
    expect(runReads()).toBe(0);
    // 链位对同一事实给同一个答案：无关联
    expect(txt("aud3-chain-run")).toContain("无关联");
  });

  it("换记录作废旧回答：先开带 run 的、立刻切到无 run 的，慢答不得覆盖", async () => {
    let releaseRun: ((v: unknown) => void) | null = null;
    api.fetchJSON.mockImplementation(async (url: string) => {
      if (url.startsWith("/agent-api/api/run-detail")) {
        return new Promise((resolve) => {
          releaseRun = resolve;
        });
      }
      return impl(url) ?? { items: [ROW, ROW_NO_RUN], nextCursor: null };
    });
    await render(`${BASE}&detail=${ROW.eventId}`);
    await waitFor(() => q("[data-testid='aud3-run-loading']") !== null, "aside loading");
    expect(runReads()).toBe(1);

    await render(`${BASE}&detail=${ROW_NO_RUN.eventId}`);
    await waitFor(() => q("[data-testid='aud02-detail']") !== null, "second record painted");
    expect(q("[data-testid='aud3-run-aside']")).toBeNull();

    await act(async () => {
      releaseRun?.({ runId: RUN_ID, status: "running", employeeId: "emp_stale" });
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(q("[data-testid='aud3-run-aside']"), "迟到回答被票号吞掉").toBeNull();
  });
});
