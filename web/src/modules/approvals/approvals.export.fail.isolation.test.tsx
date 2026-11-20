// @vitest-environment jsdom
/**
 * R243 — 审批导出与分页中途失败的隔离（纯测试，零产品改动）。
 *
 * 先 git grep 查重，已覆盖只回证据、本文件不写重复用例：
 * - 失败站「不空 CSV、行=屏上保留、导出不新增 fetch」=
 *   approvals.export.paged.test.tsx（R235）it③（同站未比 apv5-count）；
 * - 失败条的可读句+rid、重试恰 +1 且成功追加、pageFailure 追加后**滞留**
 *   （缺陷已记录，修复需另令）= approvals.paging.test.tsx（R139 系）
 *   it「pageFailure panel carries the rid, rows survive, retry appends successfully」；
 * - 健康站 CSV==表体==apv5-count=wave-29/R235 it①。
 * 本文件三块真缺口：
 * ①失败站把 apv5-count 计数位拉进对照——CSV 数据行==表体==计数位三值同站；
 * ②错误条滞留时**连点两次导出**：两次 CSV 逐字相等（同一已加载集合，
 *   无任何中途状态漂移）；
 * ③重试成功换代后：表体/计数位/CSV 三者同步到 4 行、旧行不残留不重复，
 *   错误锚按现状锁滞留（工单「锚消失」与已记录缺陷冲突，禁改码）。
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

const roots: Root[] = [];
const mounted: HTMLDivElement[] = [];

afterEach(() => {
  for (const root of roots) {
    act(() => {
      root.unmount();
    });
  }
  roots.length = 0;
  for (const el of mounted) el.remove();
  mounted.length = 0;
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

const click = async (id: string): Promise<void> => {
  const el = q(id) as HTMLButtonElement | null;
  expect(el, id).toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

/** 失败站夹具：cursor 腿首击 500（rid=req-r243-page），重试即成功。 */
function serveFailOnce(): { cursorTries: () => number } {
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
          requestId: "req-r243-page",
        });
      }
      return PAGE2;
    }
    return PAGE1;
  });
  return { cursorTries: () => cursorTries };
}

/** 拦一次导出：返回逻辑行网格，并锁导出不新增 fetch。 */
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

describe("R243 export stays isolated from a mid-page failure", () => {
  it("① failed-page station: CSV rows == table body == apv5-count, no empty/half CSV", async () => {
    serveFailOnce();
    await render("/approvals?tab=history");
    await waitFor(() => rowIds().length === 3, "page one");
    await click("apv-page-more");
    await waitFor(() => !!q("apr5-inline-failure"), "page failure shown");

    const grid = await grabCsv();
    const dataRows = grid.slice(1);
    const count = q("apv5-count")?.textContent ?? "";
    expect(count, "计数位在失败站仍与表体同源").toBe(String(rowIds().length));
    expect(dataRows.length, "CSV 数据行==计数位==表体三值").toBe(Number(count));
    expect(dataRows.map((r) => r[0]), "行 id 序与屏上逐位一致").toEqual(rowIds());
    expect(grid.map((r) => r.join(",")).join("\n"), "半页 ap_p4 不漏").not.toContain("ap_p4");
  });

  it("② with the failure bar still up, a second export is byte-identical and still costs no request", async () => {
    serveFailOnce();
    await render("/approvals?tab=history");
    await waitFor(() => rowIds().length === 3, "page one");
    await click("apv-page-more");
    await waitFor(() => !!q("apr5-inline-failure"), "page failure shown");
    expect(q("apr5-inline-failure"), "错误条滞留（导出对照前提）").toBeTruthy();

    const first = await grabCsv();
    const before = mock.mock.calls.length;
    const second = await grabCsv();
    expect(second, "两次导出同一已加载集合，逐字相等").toEqual(first);
    expect(
      second.map((r) => r.join(",")).join("\n"),
      "第二次的 CSV 全文与第一次逐字一致",
    ).toBe(first.map((r) => r.join(",")).join("\n"));
    expect(mock.mock.calls.length, "两次导出间零新增请求").toBe(before);
  });

  it("③ after a successful retry the export converges with the new body (4 rows), the stale error bar persists as recorded", async () => {
    serveFailOnce();
    await render("/approvals?tab=history");
    await waitFor(() => rowIds().length === 3, "page one");
    await click("apv-page-more");
    await waitFor(() => !!q("apr5-inline-failure"), "page failure shown");

    const fail = q("apr5-inline-failure") as Element;
    const retry = Array.from(fail.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("重试"),
    ) as HTMLButtonElement | null;
    expect(retry, "错误条内的重试入口").toBeTruthy();
    const before = mock.mock.calls.length;
    await act(async () => {
      retry!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await waitFor(() => rowIds().length === 4, "retry appends the fourth row");
    expect(mock.mock.calls.length, "retry costs exactly one list read").toBe(before + 1);
    // 现状锁定：pageFailure 追加成功后滞留（缺陷已由 R139 系记录，修复需另令）。
    // 工单③「错误锚消失」期望与已记录现状冲突——按现状锁，禁改码。
    expect(q("apr5-inline-failure"), "错误条滞留=已记录缺陷现状").toBeTruthy();

    // 换代同步：表体、计数位、CSV 三者到同一 4 行集合，旧行不残留不重复。
    expect(rowIds(), "追加按单号去重，换代无重复残留").toEqual([
      "ap_p1",
      "ap_p2",
      "ap_p3",
      "ap_p4",
    ]);
    expect(q("apv5-count")?.textContent, "计数位同步到 4").toBe("4");
    const grid = await grabCsv();
    expect(grid.slice(1).map((r) => r[0]), "导出集合与表体同步换代").toEqual(rowIds());
  });
});
