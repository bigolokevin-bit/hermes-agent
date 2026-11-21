// @vitest-environment jsdom
/**
 * R257：审批导出「详情缺失字段 × 导出列」逐字护栏（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款，已覆盖只回证据+文件:行）：
 *  - 「列头逐字 + 缺值不塌列」纯函数站 = approvals.columns.lock.test.tsx
 *    it① L88（R219）；「单行各列 == 屏上载体」= 同文件 it② L130；
 *    「缺 updated_at/rid 空字段 vs 复制『—』双载体」=
 *    approvals.export.filter.test.tsx（R182）与 approvals.export.truncate/
 *    triple 家族；「默认站含缺值行逐行 7 格」=
 *    approvals.export.statusmatrix.test.tsx it①（R256）；
 *    「rejected 站行数==表体==apv5-count」=
 *    approvals.export.multistatus.test.tsx it① L156（R246）；
 *    「抽屉打开态导出五列==抽屉字段」=
 *    approvals.export.detail.parity.test.tsx it①（R255）。
 *  - 本文件真增量：①同一缺值行七格「逐格」全核对（含 correlation 列=单号
 *    的现状契约 R107，此前各站只抽断缺值三格或首列同序）；②抽屉开态导出
 *    grid 与列表态导出 grid 整体 toEqual 逐字（两态 blob 全等此前未锁，
 *    R255 锁的是 blob vs 抽屉字段而非两 blob 互等）；③rejected 深链站
 *    缺值行逐行 7 格不塌列（R246 只锁行数与 status 列，7 格腿在默认站=
 *    R256，rejected 站合并断言为本单新）。
 *  - 工单「禁裸 id」按现状口径：rid 全串不进任何行（本站 rid 缺位）、
 *    correlation 列=审批单号本身属 R107 七列契约，非泄漏。
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
const listCalls = (): number =>
  api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approvals?")).length;
const detailCalls = (): number =>
  api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approval?id=")).length;

const openDetail = async (id: string): Promise<void> => {
  const card = q(`apr5-row-${id}`) as HTMLElement | null;
  expect(card, `row ${id}`).toBeTruthy();
  await act(async () => {
    card!.click();
  });
  await waitFor(() => !!q("apr5-detail"), `detail of ${id}`);
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
    return "blob:missing-fields-257";
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

const rowBadge = (id: string): string => {
  const titleBtn = q(`apv-trunc-row-title-${id}`)?.closest("button");
  const parent = titleBtn?.parentElement;
  const last = parent?.lastElementChild;
  return (last?.textContent ?? "").trim();
};

const MISS = {
  approvalId: "ap_mf1",
  title: "缺值全列单",
  status: "approved",
  createdAt: "2026-11-18T01:00:00Z",
  // 无 riskLevel / decidedAt / requestId：逐格核对的主角
};
const OK2 = {
  approvalId: "ap_mf2",
  title: "全字段对照单",
  status: "approved",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T02:00:00Z",
  requestId: "req-mf-87654321",
};
const RECMISS = { ...MISS, status: "rejected" };
const REC2 = { ...OK2, status: "rejected" };

const serve = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = [MISS, OK2, RECMISS, REC2].find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("status=rejected")) return { items: [RECMISS, REC2] };
    return { items: [MISS, OK2] };
  });
};

describe("R257 approvals export missing-field column guards", () => {
  it("checks every one of the seven cells of the missing-value row, each in its own contract shape", async () => {
    serve();
    await render();
    expect(rowIds()).toEqual(["ap_mf1", "ap_mf2"]);
    const { text, grid } = await grabCsv();
    expect(grid[0].join(",")).toBe("id,title,status,risk,updated_at,correlation,rid");
    const gap = grid.find((r) => r[0] === "ap_mf1");
    expect(gap).toBeTruthy();
    expect(gap?.[1], "标题列==屏上标题").toBe(
      (q("apv-trunc-row-title-ap_mf1")?.textContent ?? "").trim(),
    );
    expect(gap?.[2], "状态列==屏上徽标人话").toBe(rowBadge("ap_mf1"));
    expect(gap?.[3], "risk 缺值=人话句（R107 现状）").toBe("未标注风险");
    expect(gap?.[4], "decided_at 缺位=空字段").toBe("");
    expect(gap?.[5], "correlation=审批单号本身（R107 七列契约，非泄漏）").toBe("ap_mf1");
    expect(gap?.[6], "rid 缺位=空字段").toBe("");
    // 全列无引擎词、无占位破折号；rid 全串在对照行合法出现且仅此一处
    expect(text).not.toMatch(/undefined|null/);
    expect(text).not.toMatch(/,—(,|$)/);
    expect(text.split("req-mf-87654321").length - 1).toBe(1);
    // 完整行逐格同帧对照
    const full = grid.find((r) => r[0] === "ap_mf2");
    expect(full?.[3]).toBe("高风险");
    expect(full?.[4]).toBe("2026-11-19 10:00");
    expect(full?.[6]).toBe("req-mf-87654321");
  });

  it("exports the identical grid with the drawer open as in the plain list state", async () => {
    serve();
    await render();
    const list = await grabCsv();
    const listsBefore = listCalls();
    const clicksBefore = clicks();
    await openDetail("ap_mf1");
    expect(detailCalls(), "opening the drawer costs one detail read").toBe(1);
    expect(listCalls(), "opening the drawer costs no list read").toBe(listsBefore);
    const withDrawer = await grabCsv();
    expect(withDrawer.grid, "抽屉开态 blob 与列表态逐字全等").toEqual(list.grid);
    // correlation 列在两态同为单号原值（点名比较）
    expect(withDrawer.grid[1][5]).toBe("ap_mf1");
    expect(clicks(), "no drift while the drawer stayed open").toBe(clicksBefore + 1);
    expect(q("apr5-detail"), "drawer still open at the end").toBeTruthy();
  });

  it("keeps seven cells per row on the rejected station and the three values in sync", async () => {
    serve();
    await render("/approvals?tab=history&status=rejected");
    expect(rowIds()).toEqual(["ap_mf1", "ap_mf2"]);
    const { grid } = await grabCsv();
    for (const r of grid) {
      expect(r.length, "rejected 站逐行恒 7 格不塌列").toBe(7);
    }
    const gap = grid.find((r) => r[0] === "ap_mf1");
    expect(gap?.[3]).toBe("未标注风险");
    expect(gap?.[4]).toBe("");
    expect(gap?.[6]).toBe("");
    expect(q("apv5-count")?.textContent).toBe(String(rowIds().length));
    expect(grid.length - 1).toBe(rowIds().length);
  });
});
