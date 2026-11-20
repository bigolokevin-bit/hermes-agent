// @vitest-environment jsdom
/**
 * R250 — 审批导出无状态列时表头与行解析护栏（纯测试，零产品改动，gap-only）。
 *
 * 已覆盖只回证据，不写重复用例：
 * ① ?status=__nope__ 空站导出 disabled+title+强点零 Blob 零请求 =
 *   approvals.export.multistatus.test.tsx it③（主证据）+
 *   approvals.export.bounds.test.tsx it①（aria-disabled 形制）。本
 *   文件 itB 只做同形制集中复锁（挂桩计数），不新建站点语义。
 * ③ 切回 approved 后 行数==表体==apv5-count+首行==屏上首行 =
 *   approvals.export.multistatus.test.tsx it①②（rejected/approved
 *   两站逐行 status 人话+互不残留）+ export.bounds it②（三值往返）
 *   + export.sort.cross（R248 无 status 深链三载体）。按现状回证据。
 * 真缺口 = ②：默认无 status 参站上「表头逐字含 correlation,rid 且
 *   每一行 split(",") 恒 7 格」的显式逐行断言——列序冻结在 R219 是
 *   纯函数手构站，页面级 R247（rejected 站）只按下标取样
 *   cells[0..6]，从未断言「含缺值行在内、每行格数恒 7 不塌列」。
 *   本文件 itA 补此站此断言。
 *
 * 现场事实：CSV=buildApprovalsCsv 七列 id,title,status,risk,updated_at,
 * correlation,rid，缺值=空字段（risk 缺=「未标注风险」人话，R107）；
 * 导出纯前端零 fetch（R54）。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/lib/api", () => ({ fetchJSON: vi.fn() }));

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    onClick,
    ...rest
  }: {
    children?: ReactNode;
    onClick?: () => void;
    [k: string]: unknown;
  }) => (
    <button type="button" onClick={onClick} {...(rest as Record<string, never>)}>
      {children}
    </button>
  ),
  Card: ({ children, ...rest }: { children?: ReactNode; [k: string]: unknown }) => (
    <div {...(rest as Record<string, never>)}>{children}</div>
  ),
  CardContent: ({ children, className }: { children?: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

import { fetchJSON } from "@/lib/api";
import ApprovalsHistoryModulePage from "@/modules/approvals/ApprovalsHistoryModulePage";

const mock = vi.mocked(fetchJSON);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let roots: Root[] = [];
let mounted: HTMLDivElement[] = [];

afterEach(() => {
  for (const root of roots) {
    act(() => {
      root.unmount();
    });
  }
  roots = [];
  for (const el of mounted) el.remove();
  mounted = [];
  mock.mockReset();
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

async function render(entry: string): Promise<void> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  mounted.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[entry]}>{<ApprovalsHistoryModulePage />}</MemoryRouter>);
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), `${entry} settled`);
}

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
let urlsAll: string[] = [];
const listCalls = () => urlsAll.filter((u) => u.includes("/api/approvals"));

// 两行：H1 全字段；H2 缺 risk/decidedAt/rid（不塌列主角）。
const H1 = {
  approvalId: "ap_ns1",
  title: "无状态首行",
  status: "approved",
  riskLevel: "medium",
  requestId: "req-ns-11112222",
  createdAt: "2026-11-18T01:00:00Z",
  decidedAt: "2026-11-19T02:00:00Z",
};
const H2 = {
  approvalId: "ap_ns2",
  title: "无状态次行",
  status: "pending",
  createdAt: "2026-11-18T02:00:00Z",
};

function serveTwo() {
  urlsAll = [];
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    urlsAll.push(u);
    if (u.includes("/api/approval?id=")) return {};
    if (u.includes("/api/approvals")) return { items: [H1, H2] };
    return {};
  });
}

function serveEmptyNope() {
  urlsAll = [];
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    urlsAll.push(u);
    if (u.includes("/api/approvals")) return { items: [] };
    return {};
  });
}

const rowIds = () =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap"]'))
    .map((el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""))
    .filter((id) => !id.startsWith("details-"));

describe("R250 ② 无 status 参站：表头含 correlation,rid 且每行恒 7 格不塌列", () => {
  it("默认站的 CSV 每行（含缺值行）split(\",\") 长度恒 7，表头逐字含 correlation,rid，三值==2==首行同源", async () => {
    serveTwo();
    await render("/approvals?tab=history");
    await waitFor(() => rowIds().length === 2, "no-status station shows two rows");

    expect(listCalls(), "首取 1 条列表腿").toHaveLength(1);
    expect(listCalls()[0], "无 status 深链不发送 status 参").not.toContain("status=");

    const captured: Blob[] = [];
    const orig = URL.createObjectURL;
    URL.createObjectURL = ((blob: Blob) => {
      captured.push(blob);
      return "blob:appr250";
    }) as typeof URL.createObjectURL;
    const clicks = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const callsBefore = mock.mock.calls.length;
    try {
      const btn = q("apv7-export") as HTMLButtonElement | null;
      expect(btn, "export button").toBeTruthy();
      expect(btn!.disabled, "有行站导出可用").toBe(false);
      await act(async () => {
        btn!.click();
      });
    } finally {
      URL.createObjectURL = orig;
      clicks.mockRestore();
    }
    expect(captured, "真导出一次 Blob").toHaveLength(1);
    expect(mock.mock.calls.length, "导出零取数").toBe(callsBefore);

    const lines = (await captured[0].text())
      .replace(/^\uFEFF/, "")
      .split("\r\n")
      .filter((line) => line !== "");
    expect(lines[0], "表头逐字").toBe("id,title,status,risk,updated_at,correlation,rid");
    expect(lines[0], "表头含 correlation,rid").toContain("correlation,rid");
    const grid = lines.slice(1).map((line) => line.split(","));
    expect(grid, "两数据行").toHaveLength(2);
    grid.forEach((cells, i) => {
      expect(cells.length, `第 ${i} 行恒 7 格不塌列`).toBe(7);
    });
    const gapRow = grid.find((r) => r[0] === "ap_ns2");
    expect(gapRow, "缺值行在场").toBeTruthy();
    expect(gapRow![3], "risk 缺=未标注风险人话非空字段（R107 现状）").toBe("未标注风险");
    expect(gapRow![4], "updated_at 缺=空字段仍占位").toBe("");
    expect(gapRow![6], "rid 缺=空字段仍占位").toBe("");
    expect(grid[0][0], "首行单号==屏上首行").toBe(rowIds()[0]);
    expect(q("apv5-count")?.textContent, "三值：apv5-count==表体").toBe("2");
    expect(q("apv7-export-count")?.textContent).toContain("共 2 行");
  });
});

describe("R250 ① ?status=__nope__ 空站导出闸（复锁；主证据 R246 it③/R229 it①）", () => {
  it("空站 disabled+aria-disabled+title，强点零 Blob 零请求", async () => {
    serveEmptyNope();
    await render("/approvals?tab=history&status=__nope__");
    await waitFor(() => q("apv7-export") !== null, "empty nope station paints gate");

    const btn = q("apv7-export") as HTMLButtonElement | null;
    expect(btn!.disabled, "空站 disabled").toBe(true);
    expect(btn!.getAttribute("aria-disabled"), "aria-disabled 同源").toBe("true");
    expect(btn!.getAttribute("title"), "title 写明原因").toBeTruthy();
    expect(q("apv5-count"), "空站无假 0 计数").toBeNull();

    const captured: Blob[] = [];
    const orig = URL.createObjectURL;
    URL.createObjectURL = ((blob: Blob) => {
      captured.push(blob);
      return "blob:appr250b";
    }) as typeof URL.createObjectURL;
    const clicks = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const callsBefore = mock.mock.calls.length;
    try {
      await act(async () => {
        btn!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
    } finally {
      URL.createObjectURL = orig;
      clicks.mockRestore();
    }
    expect(captured, "强点零 Blob").toHaveLength(0);
    expect(mock.mock.calls.length, "强点零新增请求").toBe(callsBefore);
  });
});
