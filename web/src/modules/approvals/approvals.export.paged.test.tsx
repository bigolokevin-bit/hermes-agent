// @vitest-environment jsdom
/**
 * R235 — 审批导出与屏上的行集合在分页后的收敛（纯测试，零产品改动）。
 *
 * 先 git grep 现查既有覆盖，已覆盖只回证据、本文件不写重复用例：
 * ①未翻页站的首行==屏上首行=approvals.export.filter.test.tsx（R182）it②
 *   与 approvals.export.order.test.tsx（R231）desc 站；追加后的三值文案
 *   （apv5-count/apv7-export-count/apv-page-count）与复制同序=
 *   approvals.paging.test.tsx（R139）it①⑤；status 切换重置游标、替换非
 *   累加=R79/R98/R139 证据链；④「翻页中途 500」的可读句+rid+行保留=
 *   R139 it④ 已锁（含 pageFailure 滞留缺陷现状记录）。
 * 本文件缺口=把**导出 blob 本身**拉到分页之后的三个站：
 * ①第 2 页加载后，CSV 数据行数==已加载表体行数==apv5-count 数字，且
 *   CSV 首行单号==屏上首行（R139 只锁了计数文案，没拦真实文件）；
 * ②翻页之后再切 ?status=pending：导出只含新集合行、不残留 ap_p* 旧集合、
 *   apv5-count 同步为 1、新列表请求不带旧 cursor=；
 * ③分页失败站（第二腿 500 已呈现）强点导出：不生成空 CSV——blob 行数
 *   ==屏上保留行数，且导出不新增请求。现场裁决：导出是纯前端动作，产品
 *   没有「导出自身抛错」的路径，工单「导出失败（mock 抛错）」在现场只能
 *   解释为分页中途抛错的站；按现状锁定该站的导出形态，禁为此改产品。
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

import { ApiError } from "@/lib/api-error";
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
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <ApprovalsHistoryModulePage />
      </MemoryRouter>,
    );
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), `${entry} settled`);
}

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const rowIds = () =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_"]'))
    .filter((el) => !String(el.getAttribute("data-testid")).includes("-details-"))
    .map((el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""));

const P1 = { approvalId: "ap_p1", title: "第一条", status: "approved", createdAt: "2026-11-19T01:00:00Z" };
const P2 = { approvalId: "ap_p2", title: "第二条", status: "approved", createdAt: "2026-11-19T01:10:00Z" };
const P3 = { approvalId: "ap_p3", title: "第三条", status: "approved", createdAt: "2026-11-19T01:20:00Z" };
const P4 = { approvalId: "ap_p4", title: "第四条", status: "approved", createdAt: "2026-11-19T01:30:00Z" };
const PAGE1 = { items: [P1, P2, P3], nextCursor: "pc-2" };
const PAGE2 = { items: [P3, P4] }; // 重复 P3 + 新行 P4，末页（无 nextCursor 键）
const Q1 = { approvalId: "ap_q1", title: "待办一条", status: "pending", createdAt: "2026-11-19T02:00:00Z" };
const PENDING_PAGE = { items: [Q1] };

const click = async (id: string): Promise<void> => {
  const el = q(id) as HTMLButtonElement | null;
  expect(el, id).toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

/** 拦一次导出：返回 CSV 逻辑行（含表头），并锁导出不新增 fetch。 */
async function grabCsv(): Promise<string[][]> {
  const blobs: Blob[] = [];
  const orig = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  const origClick = HTMLAnchorElement.prototype.click;
  let callsBefore = 0;
  URL.createObjectURL = ((blob: Blob) => {
    blobs.push(blob);
    return "blob:stub";
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  HTMLAnchorElement.prototype.click = function clickSpy(this: HTMLElement) {
    void clickSpy;
  } as typeof HTMLAnchorElement.prototype.click;
  try {
    callsBefore = mock.mock.calls.length;
    await click("apv7-export");
    await waitFor(() => blobs.length === 1, "export blob captured");
    expect(mock.mock.calls.length, "exporting never fetches").toBe(callsBefore);
  } finally {
    URL.createObjectURL = orig;
    URL.revokeObjectURL = origRevoke;
    HTMLAnchorElement.prototype.click = origClick;
  }
  const text = await blobs[0].text();
  return text
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .filter((line) => line !== "")
    .map((line) => line.split(","));
}

describe("R235 export converges with the loaded set after paging", () => {
  it("① after appending page two, the real CSV row count and first id equal the screen", async () => {
    mock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) return {};
      if (u.includes("cursor=")) return PAGE2;
      return PAGE1;
    });
    await render("/approvals?tab=history");
    await waitFor(() => rowIds().length === 3, "page one");
    await click("apv-page-more");
    await waitFor(() => rowIds().includes("ap_p4"), "page two appended");
    const ids = rowIds();
    expect(ids).toEqual(["ap_p1", "ap_p2", "ap_p3", "ap_p4"]);
    expect(q("apv5-count")?.textContent).toBe("4");
    const grid = await grabCsv();
    expect(grid[0].join(",")).toBe("id,title,status,risk,updated_at,correlation,rid");
    const dataRows = grid.slice(1);
    expect(dataRows.length, "CSV data rows == loaded rows == apv5-count").toBe(4);
    expect(dataRows.length).toBe(Number(q("apv5-count")?.textContent));
    expect(dataRows[0][0], "CSV 首行==屏上首行单号（分页之后站）").toBe(ids[0]);
  });

  it("② after paging then switching to status=pending, export holds only the new set", async () => {
    mock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) return {};
      if (u.includes("status=pending")) return PENDING_PAGE;
      if (u.includes("cursor=")) return PAGE2;
      return PAGE1;
    });
    await render("/approvals?tab=history");
    await waitFor(() => rowIds().length === 3, "page one");
    await click("apv-page-more");
    await waitFor(() => rowIds().includes("ap_p4"), "page two appended");
    await click("apv5-filter-status-pending");
    await waitFor(() => rowIds().join(",") === "ap_q1", "pending set replaced, no stale rows");
    const last = mock.mock.calls
      .filter((c) => String(c[0]).includes("/api/approvals"))
      .map((c) => String(c[0]))
      .at(-1) as string;
    expect(last).toContain("status=pending");
    expect(last, "cursor reset on filter switch").not.toContain("cursor=");
    expect(q("apv5-count")?.textContent).toBe("1");
    const grid = await grabCsv();
    const dataRows = grid.slice(1);
    expect(dataRows.length, "导出只含新集合").toBe(1);
    expect(dataRows[0][0]).toBe("ap_q1");
    const csvAll = grid.map((r) => r.join(",")).join("\n");
    for (const stale of ["ap_p1", "ap_p2", "ap_p3", "ap_p4"]) {
      expect(csvAll, `no stale ${stale} in the export`).not.toContain(stale);
    }
  });

  it("③ on the failed-page station, export writes no empty CSV: rows equal what survives on screen", async () => {
    let cursorTries = 0;
    mock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) return {};
      if (u.includes("cursor=")) {
        cursorTries += 1;
        if (cursorTries === 1) {
          throw new ApiError("boom", {
            status: 500,
            body: JSON.stringify({ code: "runtime.unavailable" }),
            url: u,
            requestId: "req-r235-page",
          });
        }
        return PAGE2;
      }
      return PAGE1;
    });
    await render("/approvals?tab=history");
    await waitFor(() => rowIds().length === 3, "page one");
    await click("apv-page-more");
    await waitFor(() => !!q("apr5-inline-failure"), "page failure shown");
    // 可读错误+rid 由 R139 it④ 全锁；本站只补导出侧：不空、不裂、行等屏上。
    expect(rowIds(), "loaded rows survive").toEqual(["ap_p1", "ap_p2", "ap_p3"]);
    const grid = await grabCsv();
    const dataRows = grid.slice(1);
    expect(dataRows.length, "失败站导出=保留的 3 行，不是空 CSV").toBe(3);
    expect(dataRows.map((r) => r[0])).toEqual(["ap_p1", "ap_p2", "ap_p3"]);
    expect(grid.map((r) => r.join(",")).join("\n"), "no half page leaked").not.toContain("ap_p4");
  });
});
