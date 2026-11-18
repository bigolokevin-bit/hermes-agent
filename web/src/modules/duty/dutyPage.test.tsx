// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchJSON: (...args: unknown[]) => fetchJSON(...args),
}));

import DutyPage from "./DutyPage";
import MatrixView from "./MatrixView";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  fetchJSON.mockReset();
});

function ok(url: string): unknown {
  if (url.includes("/employee-stats")) {
    return { byLifecycle: { active: 1, paused: 0, offboarding: 0 } };
  }
  if (url.includes("/employees")) {
    return { items: [{ employeeId: "emp_1", name: "陈可", lifecycleState: "active", ownerUserId: "u_1" }] };
  }
  if (url.includes("/run-stats")) {
    return {
      totals: { runs: 2, succeeded: 1, failed: 1, running: 0, costUsd: 1.5 },
      buckets: [{ bucketStart: "2026-11-18T00:00:00Z", runs: 2, failed: 1 }],
    };
  }
  if (url.includes("/run-activity")) {
    return { max: 2, cells: [{ dow: 2, hour: 10, count: 2 }] };
  }
  if (url.includes("/budget-usage")) {
    return { items: [{ employeeId: "emp_1", costUsd: 1.5 }], missingEmployeeIds: [] };
  }
  if (url.includes("/approval-stats")) return { pending: 1, dueSoon: 0 };
  if (url.includes("/approvals")) {
    return { items: [{ approvalId: "apr_1", title: "供应商报价", status: "pending" }] };
  }
  if (url.includes("/tasks")) {
    return { items: [{ taskId: "tsk_1", title: "整理周报", status: "blocked" }] };
  }
  if (url.includes("/runs")) {
    return {
      items: [
        { runId: "run_abcdef123456", employeeId: "emp_1", status: "failed", startedAt: "2026-11-18T02:00:00Z" },
      ],
    };
  }
  return { items: [] };
}

async function render(ui: React.ReactNode) {
  await act(async () => {
    root.render(<MemoryRouter>{ui}</MemoryRouter>);
  });
  await act(async () => {});
}

describe("DutyPage", () => {
  it("renders the fixed eight cards and keeps unknown gates out of the numerator", async () => {
    fetchJSON.mockImplementation((url: string) => Promise.resolve(ok(url)));
    await render(<DutyPage />);
    const text = container.textContent ?? "";
    for (const title of ["可上岗", "今日运行", "今日成本", "近 14 天运行", "24 小时活跃", "阻塞", "待我处理", "最近运行"]) {
      expect(text).toContain(title);
    }
    expect(container.querySelectorAll('[data-card="duty"]')).toHaveLength(8);
    expect(container.querySelector('[data-testid="duty-ready-value"]')?.textContent).toContain("—");
    expect(text).toContain("待核实");
    expect(text).not.toContain("HTTP");
  });

  it("shows a request id and retry on an error card", async () => {
    fetchJSON.mockImplementation((url: string) =>
      url.includes("/run-stats")
        ? Promise.reject(new ApiError("boom", { status: 500, body: "{}", url, requestId: "req-duty" }))
        : Promise.resolve(ok(url)),
    );
    await render(<DutyPage />);
    expect(container.textContent).toContain("请求编号 req-duty");
    expect(container.textContent).toContain("重试");
  });
});

describe("MatrixView", () => {
  it("uses the labelled fixture only when the matrix route is absent", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.reject(new ApiError("missing", { status: 404, body: "{}", url })),
    );
    await render(<MatrixView />);
    expect(container.querySelector('[data-fixture="true"]')).toBeTruthy();
    expect(container.textContent).toContain("样例");
    expect(container.textContent).toContain("陈可");
  });

  it("never falls back to the fixture on a real 500", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.reject(new ApiError("boom", { status: 500, body: "{}", url, requestId: "req-mx" })),
    );
    await render(<MatrixView />);
    expect(container.querySelector('[data-fixture="true"]')).toBeFalsy();
    expect(container.textContent).toContain("请求编号 req-mx");
    expect(container.textContent).not.toContain("陈可");
  });
});
