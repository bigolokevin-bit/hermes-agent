// @vitest-environment jsdom
/**
 * R264：approvals 导出与详情关闭后一致性（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款，已覆盖只回证据:行）：
 *  - 工单①「抽屉开→关后导出 blob 行数与首行==当前屏上、前后 fetchJSON
 *    计数不变」= approvals.export.closeddetail.test.tsx it① L251（R263：
 *    apd7-back 关闭零请求+after toEqual before+行序==rowIds）——回证据。
 *  - 工单③主体「500 时导出只含列表行、重试恰 +1」
 *    = approvals.export.detail.parity.test.tsx it③ L296（R255：错误站
 *    grabCsv 三段落照常、apr5-request-id 含 req-r255-detail、重试恰 +1）。
 *  - 真增量=工单②「?status=approved 深链站开→关各一次后三值等式」：
 *    R263 站是默认站，approved 站型（服务端维深链）+二次开关未锁；
 *    + 工单③的「rid 不入 CSV」隔离腿：错误对象的 requestId（req-r264-
 *    detail）不得混入导出文本，而行数据自带的 rid 列合法全串在列
 *    （列契约见 R257 it①/R107）——R255 只锁错误 rid 的文本载体，
 *    未锁 blob 不含它。
 */
import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Button: ({ onClick, children, ...rest }: { onClick?: () => void; children?: ReactNode }) => (
    <button type="button" onClick={onClick} {...rest}>
      {children}
    </button>
  ),
  Card: ({ children, ...rest }: { children?: ReactNode; [k: string]: unknown }) => (
    <div {...(rest as Record<string, unknown>)}>{children}</div>
  ),
  CardContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import { ApiError } from "@/lib/api-error";
import ApprovalsHistoryModulePage from "./ApprovalsHistoryModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let roots: Root[] = [];
let mounted: HTMLDivElement[] = [];

const clearScreen = (): void => {
  for (const root of roots) {
    act(() => {
      root.unmount();
    });
  }
  roots = [];
  for (const el of mounted) el.remove();
  mounted = [];
};

afterEach(() => {
  clearScreen();
  api.fetchJSON.mockReset();
});

const waitFor = async (cond: () => boolean, label: string): Promise<void> => {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
};

async function render(entry = "/approvals?tab=history"): Promise<void> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  mounted.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <ApprovalsHistoryModulePage />
      </MemoryRouter>,
    );
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), `${entry} settled`);
}

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const text = (id: string): string => q(id)?.textContent ?? "";
const rowIds = (): string[] =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_"]'))
    .filter((el) => !String(el.getAttribute("data-testid")).includes("-details-"))
    .map((el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""));
const clicks = (): number => api.fetchJSON.mock.calls.length;
const listCalls = (): number =>
  api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approvals?")).length;
const detailCalls = (): number =>
  api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approval?id=")).length;

const clickTestId = async (id: string): Promise<void> => {
  const el = q(id) as HTMLButtonElement | null;
  expect(el, id).toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

const openDetail = async (id: string): Promise<void> => {
  const card = q(`apr5-row-${id}`) as HTMLElement | null;
  expect(card, `row ${id}`).toBeTruthy();
  await act(async () => {
    card!.click();
  });
};

function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r" && src[i + 1] === "\n") {
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
      i += 1;
    } else if (ch === "\n") {
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ""));
}

async function grabCsv(): Promise<{ text: string; grid: string[][] }> {
  const before = clicks();
  const blobs: Blob[] = [];
  const orig = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  const origClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = ((blob: Blob) => {
    blobs.push(blob);
    return "blob:closed-state-264";
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  HTMLAnchorElement.prototype.click = () => undefined;
  try {
    const btn = q("apv7-export") as HTMLButtonElement | null;
    expect(btn, "export button").toBeTruthy();
    await act(async () => {
      btn!.click();
    });
  } finally {
    URL.createObjectURL = orig;
    URL.revokeObjectURL = origRevoke;
    HTMLAnchorElement.prototype.click = origClick;
  }
  expect(blobs.length, "one blob per export").toBe(1);
  expect(clicks(), "export never refetches").toBe(before);
  const csvText = await blobs[0].text();
  return { text: csvText, grid: parseCsv(csvText) };
}

const CS1 = {
  approvalId: "ap_cs1",
  title: "关闭态后续一",
  status: "approved",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
  requestId: "req-cs-11112222",
};
const CS2 = {
  approvalId: "ap_cs2",
  title: "关闭态后续二",
  status: "approved",
  riskLevel: "medium",
  decidedAt: "2026-11-19T03:00:00Z",
  createdAt: "2026-11-18T02:00:00Z",
  requestId: "req-cs-22223333",
};
const CS3 = {
  approvalId: "ap_cs3",
  title: "关闭态缺值",
  status: "approved",
  createdAt: "2026-11-18T03:00:00Z",
  // 缺 risk/decided/rid
};

const serveApproved = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = [CS1, CS2, CS3].find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    return { items: [CS1, CS2, CS3] };
  });
};

describe("R264 approvals export closed-state guards", () => {
  it("keeps the three values in sync on the approved deep-link station after opening and closing the drawer twice", async () => {
    serveApproved();
    await render("/approvals?tab=history&status=approved");
    expect(rowIds()).toEqual(["ap_cs1", "ap_cs2", "ap_cs3"]);
    expect(listCalls(), "the approved station reads once").toBe(1);
    await openDetail("ap_cs1");
    await waitFor(() => !!q("apr5-detail"), "first drawer opened");
    await clickTestId("apd7-back");
    await waitFor(() => !q("apr5-detail"), "first drawer closed");
    await openDetail("ap_cs2");
    await waitFor(() => !!q("apr5-detail"), "second drawer opened");
    await clickTestId("apd7-back");
    await waitFor(() => !q("apr5-detail"), "second drawer closed");
    expect(detailCalls(), "each drawer costs its own detail read").toBe(2);
    expect(listCalls(), "the drawers never refetch the list").toBe(1);
    const { grid } = await grabCsv();
    expect(grid.length - 1, "CSV 数据行数==表体").toBe(rowIds().length);
    expect(q("apv5-count")?.textContent, "apv5-count==表体").toBe(String(rowIds().length));
    expect(grid.slice(1).map((r) => r[0])).toEqual(rowIds());
    expect(grid.every((r) => r.length === 7), "恒 7 格").toBe(true);
  });

  it("keeps the failed detail's rid out of the CSV while the row-level rid column stays legal", async () => {
    let detailTries = 0;
    api.fetchJSON.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) {
        detailTries += 1;
        if (detailTries === 1) {
          throw new ApiError("boom", {
            status: 500,
            body: JSON.stringify({ code: "runtime.unavailable" }),
            url: u,
            requestId: "req-r264-detail",
          });
        }
        return { ...CS1 };
      }
      return { items: [CS1, CS3] };
    });
    await render("/approvals?tab=history");
    await openDetail("ap_cs1");
    await waitFor(() => !!q("apr5-detail-error"), "detail error shown");
    expect(text("apr5-request-id")).toContain("req-r264-detail");
    const { text: csvText, grid } = await grabCsv();
    // 错误对象的 rid 不混入导出；行数据自带的 rid 列合法全串在列
    expect(csvText).not.toContain("req-r264-detail");
    expect(csvText).toContain("req-cs-11112222");
    expect(grid.every((r) => r.length === 7), "七格不塌").toBe(true);
    expect(grid.length - 1, "错误站导出只含列表行").toBe(rowIds().length);
    await clickTestId("apr5-detail-error-retry");
    expect(detailCalls(), "the retry costs exactly one detail read").toBe(2);
    await waitFor(() => !q("apr5-detail-error"), "retry recovered");
    const after = await grabCsv();
    expect(after.grid.length - 1).toBe(rowIds().length);
    expect(after.grid.every((r) => r.length === 7)).toBe(true);
    expect(listCalls(), "the whole flow made no second list read").toBe(1);
  });
});
