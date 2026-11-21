// @vitest-environment jsdom
/**
 * R261：审批导出 × 详情开态 × 分页三链同序（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款，已覆盖只回证据:行）：
 *  - 工单②「详情开态切 status 自动关抽屉 + 导出换代零残留」
 *    = approvals.export.detail.parity.test.tsx it② L279（R255）逐字已锁；
 *  - 工单③「详情 500 时导出只含列表行、重试恰 +1、三值同步」
 *    = 同文件 it③ L296（R255）已锁；「rid 不截断」腿=同 it 断 apr5-request-id
 *    含完整 rid，列值全串腿另有 R257 it①（rid 全串恰 1 次）。
 *  - 工单④「空集 disabled+title、零 Blob、未调 createObjectURL」
 *    = approvals.export.tab.rowcopy.test.tsx it②（R260，pending 组件站）
 *    + approvals.export.bounds.test.tsx it① L148（R229）+ approvals.empty it②。
 *  - 真缺口=工单①「第 2 页后开详情再导出」三链组合站：
 *    翻页导出站（export.paged it① R235 / export.triple it② R253）均未开抽屉；
 *    抽屉导出站（detail.parity it① L249 R255）停在第 1 页。本文件补
 *    「翻页追加 → 开第 2 页单详情 → 导出」同帧：CSV 数据行数==已加载表体
 *    ==apv5-count、被开单在列、首行与屏上首行同源、列表腿 2 / 详情腿 1 /
 *    导出零新增。
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
    return "blob:detail-paging-261";
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

const D1 = {
  approvalId: "ap_dp1",
  title: "首行对照单",
  status: "approved",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
  requestId: "req-dp-11112222",
};
const D2 = {
  approvalId: "ap_dp2",
  title: "首页第二单",
  status: "approved",
  riskLevel: "medium",
  decidedAt: "2026-11-19T02:30:00Z",
  createdAt: "2026-11-18T02:00:00Z",
  requestId: "req-dp-22223333",
};
const D3 = {
  approvalId: "ap_dp3",
  title: "第二页单",
  status: "approved",
  riskLevel: "low",
  decidedAt: "2026-11-19T04:00:00Z",
  createdAt: "2026-11-18T03:00:00Z",
  requestId: "req-dp-33334444",
};

const serve = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = [D1, D2, D3].find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("cursor=")) return { items: [D3] };
    return { items: [D1, D2], nextCursor: "pc-2" };
  });
};

describe("R261 approvals export x detail x paging guards", () => {
  it("loads page 2, opens that page's detail, then exports one grid matching the loaded body and the first screen row", async () => {
    serve();
    await render("/approvals?tab=history");
    expect(rowIds()).toEqual(["ap_dp1", "ap_dp2"]);
    await clickTestId("apv-page-more");
    await waitFor(() => rowIds().join(",") === "ap_dp1,ap_dp2,ap_dp3", "page 2 appended");
    expect(listCalls(), "paging costs exactly one extra list read").toBe(2);
    await openDetail("ap_dp3");
    expect(detailCalls(), "opening the drawer costs one detail read").toBe(1);
    expect(listCalls(), "the drawer costs no list read").toBe(2);
    const { text, grid } = await grabCsv();
    expect(grid[0].join(",")).toBe("id,title,status,risk,updated_at,correlation,rid");
    // 三值同帧：CSV 数据行 == 已加载表体 == apv5-count
    expect(grid.length - 1).toBe(rowIds().length);
    expect(q("apv5-count")?.textContent).toBe(String(rowIds().length));
    // 被开抽屉的第二页单在列且全串 rid 不截断（工单③的列值腿顺带）
    const opened = grid.find((r) => r[0] === "ap_dp3");
    expect(opened?.[6]).toBe("req-dp-33334444");
    expect(opened?.[4]).toBe("2026-11-19 12:00");
    // 首行同源：导出首数据行 == 屏上首行
    expect(grid.slice(1).map((r) => r[0])).toEqual(rowIds());
    expect(text).not.toMatch(/undefined|null/);
    // 导出后总计数不变（grabCsv 内置等式已锁，这里核全局腿分布）
    expect(listCalls(), "export adds no list read").toBe(2);
    expect(detailCalls(), "export adds no detail read").toBe(1);
  });
});
