// @vitest-environment jsdom
/**
 * R269：审批导出与队列汇总四值同源护栏（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款，已覆盖只回证据）：
 *  - CSV 行数==表体==apv5-count 三值腿 = approvals.export.header.row（R254）
 *    it①/statusmatrix（R256）it①/rowcopy.same（R265）it② 已锁；本文件新腿
 *    =「汇总卡状态桶合计」入同一等式（四值同帧），此前三载体站点均未并
 *    apv6 计数。
 *  - 工单② 的 CSV status 列人话==屏上徽标 = approvals.export.multistatus
 *    it①（R246）；本文件增量 = rejected 站四值同步 + 非本源桶渲「—」+
 *    「当前列表只包含…」原因句同帧（QueueSummaryBar history 桶语义，R70 系）。
 *  - 工单③ 空集导出 disabled+title+未调 createObjectURL = export.bounds
 *    it① L148（R229）+tab.rowcopy it②（R260）+approvals.empty it② 已锁；
 *    「汇总显 0 非「—」」与现场契约相反——QueueSummaryBar L70-72 注释与
 *    unavailable()：empty 相位计数位一律「—」+「不是缺数」原因句，绝不
 *    假 0（R70 设计契约）。按现状锁「—」并在断言旁点名与工单措辞差异，
 *    禁改产品。
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

import ApprovalsHistoryModulePage from "./ApprovalsHistoryModulePage";
import { statusView } from "./model";

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
const rowIds = (): string[] =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_"]'))
    .filter((el) => !String(el.getAttribute("data-testid")).includes("-details-"))
    .map((el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""));
const clicks = (): number => api.fetchJSON.mock.calls.length;
const clickTestId = async (id: string): Promise<void> => {
  const el = q(id) as HTMLButtonElement | null;
  expect(el, id).toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};
const rowBadge = (id: string): string => {
  const titleBtn = q(`apv-trunc-row-title-${id}`)?.closest("button");
  return titleBtn?.parentElement?.lastElementChild?.textContent ?? "";
};
/** 汇总桶尾数；「—」桶返回 null（计数不可得态）。 */
const bucketCount = (id: string): number | null => {
  const text = q(id)?.textContent ?? "";
  const m = /(\d+)\s*$/.exec(text);
  return m ? Number(m[1]) : null;
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
    return "blob:summary-parity-269";
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
  const text = await blobs[0].text();
  return { text, grid: parseCsv(text) };
}

const V1 = {
  approvalId: "ap_sy1",
  title: "汇总同源待办单",
  status: "pending",
  riskLevel: "high",
  createdAt: "2026-11-19T01:00:00Z",
};
const V2 = {
  approvalId: "ap_sy2",
  title: "汇总同源已批单",
  status: "approved",
  riskLevel: "low",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
};
const V3 = {
  approvalId: "ap_sy3",
  title: "汇总同源已拒单",
  status: "rejected",
  riskLevel: "medium",
  decidedAt: "2026-11-19T03:00:00Z",
  createdAt: "2026-11-18T02:00:00Z",
};
const V4 = {
  approvalId: "ap_sy4",
  title: "汇总同源已批缺风险单",
  status: "approved",
  createdAt: "2026-11-18T03:00:00Z",
};

const serveAll = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = [V1, V2, V3, V4].find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("status=rejected")) return { items: [V3] };
    if (u.includes("status=approved")) return { items: [V2, V4] };
    return { items: [V1, V2, V3, V4] };
  });
};

describe("R269 approvals export x summary parity guards", () => {
  it("keeps CSV rows, table body, apv5-count and the summary status buckets on one sum at the all station", async () => {
    serveAll();
    await render("/approvals?tab=history");
    expect(rowIds()).toEqual(["ap_sy1", "ap_sy2", "ap_sy3", "ap_sy4"]);
    const { grid } = await grabCsv();
    const data = grid.slice(1);
    // 四值同帧：CSV 数据行 == 表体 == apv5-count == 汇总状态桶合计
    const pending = bucketCount("apv6-summary-pending");
    const approved = bucketCount("apv6-summary-approved");
    const rejected = bucketCount("apv6-summary-rejected");
    expect(pending).toBe(1);
    expect(approved).toBe(2);
    expect(rejected).toBe(1);
    expect(data.length).toBe(rowIds().length);
    expect(Number(q("apv5-count")?.textContent)).toBe(data.length);
    expect(pending + approved + rejected).toBe(data.length);
    // 行级互等：桶计数与 CSV 分状态行数同一谓词
    expect(approved).toBe(data.filter((r) => r[2] === statusView("approved").label).length);
  });

  it("resyncs all four values after switching to ?status=rejected and keeps off-scope buckets at the dash with its reason", async () => {
    serveAll();
    await render("/approvals?tab=history");
    const before = clicks();
    await clickTestId("apr5-filter-rejected");
    await waitFor(() => rowIds().join(",") === "ap_sy3", "rejected station rows");
    expect(clicks(), "one server-side switch costs exactly one read").toBe(before + 1);
    const last = api.fetchJSON.mock.calls[clicks() - 1][0] as string;
    expect(last).toContain("status=rejected");
    expect(last, "switch resets to the first page").not.toContain("cursor=");
    const { grid } = await grabCsv();
    expect(grid.length - 1).toBe(rowIds().length);
    expect(grid.length - 1).toBe(1);
    expect(q("apv5-count")?.textContent).toBe("1");
    expect(bucketCount("apv6-summary-rejected")).toBe(1);
    // 非本源桶＝「—」+「不同源」原因句（现状契约）
    for (const off of ["apv6-summary-pending", "apv6-summary-approved"]) {
      expect(bucketCount(off), off).toBeNull();
      expect(String(q(off)?.getAttribute("title"))).toContain("不同源");
    }
    // CSV status 列＝屏上徽标人话（statusView 单点，非原词）
    const label = statusView("rejected").label;
    expect(grid[1][2]).toBe(label);
    expect(grid[1][2]).toBe(rowBadge("ap_sy3"));
  });

  it("keeps the empty station all-dashes with its stated reason — never a fake zero — while export stays inert", async () => {
    api.fetchJSON.mockImplementation(async () => ({ items: [] }));
    await render("/approvals?tab=history");
    expect(rowIds()).toEqual([]);
    // 现场裁决：工单「汇总显 0」与产品契约相反——empty 相位一律「—」+
    // 「不是缺数」原因句（QueueSummaryBar unavailable()/R70 设计），按现状锁。
    for (const id of ["apv6-summary-pending", "apv6-summary-approved", "apv6-summary-rejected"]) {
      expect(bucketCount(id), id).toBeNull();
      expect(String(q(id)?.getAttribute("title")), id).toContain("不是缺数");
    }
    expect(q("apv6-summary")?.textContent).not.toMatch(/\d/);
    expect(q("apv-state-empty")).toBeTruthy();
    const btn = q("apv7-export") as HTMLButtonElement | null;
    expect(btn, "export button").toBeTruthy();
    expect(btn!.disabled, "empty station export disabled").toBe(true);
    expect(String(btn!.getAttribute("title")).length, "disabled carries a reason").toBeGreaterThan(0);
    const before = clicks();
    let created = 0;
    const orig = URL.createObjectURL;
    URL.createObjectURL = ((blob: Blob) => {
      created += 1;
      void blob;
      return "blob:none-269";
    }) as typeof URL.createObjectURL;
    try {
      await act(async () => {
        btn!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
    } finally {
      URL.createObjectURL = orig;
    }
    expect(created, "forced click never builds a blob").toBe(0);
    expect(clicks(), "forced click asks the service for nothing").toBe(before);
  });
});
