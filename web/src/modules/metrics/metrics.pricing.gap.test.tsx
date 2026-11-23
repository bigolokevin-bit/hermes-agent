// @vitest-environment jsdom
/**
 * MT-01 — /metrics 价目读口的「未接」归一。
 *
 * BFF 侧 (MT-01-bff) 把 GET /api/models/pricing 注册为诚实未接口：503
 * models.pricing_not_wired（域侧无价目端点，不造数）。旧形状 404
 * console.unknown_route 也在野。本卡把两种形状（连同 403/404 同一句话的既有
 * 纪律）归一成同一个 UI 态：
 *   - 单价卡片说「标价未接」，GAP 编号按既有 met6-gap 形制进 title；
 *   - 采集时刻记「—」；
 *   - 屏幕上任何地方不出现裸 404 / Not Found / 服务原文错误串；
 *   - 不拿任何数字冒充标价（无 fixture、无假 0）。
 *
 * 503 的反例锚点：归一前 503 落通用文案「请稍后重试」（把未接说成临时故障），
 * 归一后必须说「标价未接」——断言卡片文案里不出现「请稍后重试」。
 *
 * Mocking 形制照抄 metrics.empty.error.test.tsx：模块级 mock fetchJsonStrict，
 * 抛出的 ApiError 与 fetchJsonStrict 真实现同形（message=humanStatus(status)、
 * status、body:''）。
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));

vi.mock("@/modules/models/fetchJson", () => ({ fetchJsonStrict: api.fetchJsonStrict }));

import { MetricsModulePage } from "./MetricsModulePage";
import { beijingDayKey } from "./metrics";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FROZEN = "2026-11-19T12:00:00.000Z";
const FROZEN_MS = Date.parse(FROZEN);
const DAY = beijingDayKey(new Date(FROZEN_MS));
const DAY_MS = 86_400_000;

function dayKey(back: number): string {
  return beijingDayKey(new Date(FROZEN_MS - back * DAY_MS));
}

const A = "emp_aaaabbbbcccc";

/** 价目读口的失败形状由场景决定：404（旧形状）或 503（not_wired 信封）。
 *  message 逐字等于 fetchJsonStrict 的 humanStatus(status) 产物——真链路的形状。 */
type PricingShape = "404" | "503";
let pricingShape: PricingShape = "404";

const PRICING_404 = () => {
  throw new ApiError("这个数据接口还没有接入。", { status: 404, body: "", url: "/agent-api/api/models/pricing" });
};
const PRICING_503 = () => {
  throw new ApiError("数据服务暂时没有响应，请稍后重试。", {
    status: 503,
    body: "",
    url: "/agent-api/api/models/pricing",
    requestId: "req-mt01-503",
  });
};

function answer(path: string, at: URL): unknown {
  if (path.endsWith("/api/models/pricing")) {
    if (pricingShape === "404") PRICING_404();
    PRICING_503();
  }
  if (path.endsWith("/api/budget-usage")) {
    if (at.searchParams.get("periodKind") === "month") {
      return { items: [{ employeeId: A, period: DAY.slice(0, 7), periodKind: "month", costUsd: 1.1, updatedAt: FROZEN }], missingEmployeeIds: [] };
    }
    return {
      items: [{ employeeId: A, period: dayKey(0), periodKind: "day", costUsd: 0.2, updatedAt: `${dayKey(0)}T03:20:00.000Z` }],
      missingEmployeeIds: [],
    };
  }
  if (path.endsWith("/api/run-stats")) {
    return {
      from: at.searchParams.get("from"),
      to: at.searchParams.get("to"),
      bucket: at.searchParams.get("bucket") ?? "hour",
      slots: 24,
      buckets: [{ bucketStart: at.searchParams.get("from"), runs: 13 }],
      totals: { runs: 13, succeeded: 12, failed: 1, running: 0, sampleCount: 13, successRate: 12 / 13 },
    };
  }
  if (path.endsWith("/api/run-activity")) {
    return {
      cells: [
        { dow: 1, hour: 9, count: 4 },
        { dow: 2, hour: 10, count: 3 },
      ],
      max: 4,
      from: "2026-11-12T16:00:00.000Z",
      to: `${DAY}T15:59:59.000Z`,
      tz: "Asia/Shanghai",
    };
  }
  if (path.endsWith("/api/employees")) {
    return { items: [{ employeeId: A, name: "小鲤" }], nextCursor: null };
  }
  return { items: [] };
}

async function handler(url: string): Promise<unknown> {
  const at = new URL(url, "http://localhost");
  return answer(at.pathname, at);
}

let root: Root | null = null;

function AddressProbe(): ReactNode {
  return null as ReactNode;
}

async function waitFor(condition: () => boolean, label: string): Promise<void> {
  for (let tick = 0; tick < 600; tick += 1) {
    if (condition()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error(`waitFor: ${label} never became true`);
}

function q(id: string): HTMLElement | null {
  const found = document.querySelector(`[data-testid="${id}"]`);
  return found instanceof HTMLElement ? found : null;
}

function settled(): boolean {
  return document.querySelector(".met5-skeleton") === null;
}

async function drain(): Promise<void> {
  let previous = -1;
  let stable = 0;
  for (let round = 0; round < 240 && stable < 6; round += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    const count = api.fetchJsonStrict.mock.calls.length;
    stable = count === previous ? stable + 1 : 0;
    previous = count;
  }
  await waitFor(settled, "state settled");
}

async function mount(shape: PricingShape): Promise<void> {
  pricingShape = shape;
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation((url: unknown) => handler(String(url)));
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={["/metrics"]}>
        <MetricsModulePage />
        <AddressProbe />
      </MemoryRouter>,
    );
  });
  await waitFor(settled, "initial batch");
  await drain();
}

function expectNotWiredCopy(): void {
  // 单价卡片：说「标价未接」，GAP 编号按 met6-gap 形制在 title。
  const gap = q("met6-price-gap");
  expect(gap).not.toBeNull();
  expect(gap?.textContent ?? "").toContain("标价未接");
  expect(gap?.getAttribute("title")).toBe("GAP-MET6-01");
  // 不把未接说成临时故障，也不出服务原文。
  expect(gap?.textContent ?? "").not.toContain("请稍后重试");
  // 单价位与采集时刻都是「—」，没有任何造出来的数。
  expect(q("met6-price-value")?.textContent).toBe("—");
  expect(q("met6-price-source")?.textContent ?? "").toContain("—");
  // 整页无裸 404 / Not Found 原文（价目卡与其他卡都不许出现）。
  const body = document.body.textContent ?? "";
  expect(body).not.toContain("404");
  expect(body).not.toContain("Not Found");
}

beforeEach(() => {
  pricingShape = "404";
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(FROZEN));
  window.history.replaceState({}, "", "/");
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("MT-01 价目未接归一", () => {
  it("404（BFF 无此路由的旧形状）渲染标价未接（GAP-MET6-01）与采集时刻「—」", async () => {
    await mount("404");
    expectNotWiredCopy();
  });

  it("503（BFF 诚实未接信封 models.pricing_not_wired）渲染同一个未接态", async () => {
    await mount("503");
    expectNotWiredCopy();
    // 503 带 rid 时照常可复制（信封纪律不因归一丢请求编号）。
    expect(q("met6-price-gap")?.textContent ?? "").not.toContain("undefined");
  });
});
