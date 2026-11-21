// @vitest-environment jsdom
/**
 * R253：审批导出×筛选×分页三链同源护栏（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款）：
 *  - 工单②「翻到第 2 页再导出：只含已加载行、行数==表体==apv5-count」主体
 *    = approvals.export.paged.test.tsx it①（R235 已锁追加后真实 blob 三值与
 *    首行==屏上首行）；「导出零新取数」= R182/R217/R229 家族内置计数锁。
 *    本文件增量 = 翻页态上切本地排序后第二次导出仍==当前屏上行序（非第 1 页
 *    原始序），且切排序+再导出全程零新增请求（两站互不残留的翻页态组合，
 *    R231 只测未翻页站）。
 *  - 工单③「不产生半页 CSV、已加载行仍可导出」= R235 it③；「重试恰 +1 后
 *    三值同步」= R243 it③；「错误行 rid」文本 = R139/R243 已锁。本文件增量
 *    = 失败站 rid 的剪贴板回环逐字（apr5-copy-request-id → clipboard 收到
 *    req-r253-page，分页失败站内该此前只锁文本未锁复制回环）。
 *  - 工单① risk-desc 站：risk 人话三载体=R238-risk、CSV 行序==屏上=asc
 *    向=R182 it② / desc 向=R231；status 筛选站 CSV==屏上=R246。①按现状
 *    复核为分散已锁的同型组合（status+risk desc 三链同帧），保留一站集中
 *    锁不视为重复（工单点名补齐）。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Button: ({ onClick, children, ...rest }: { onClick?: () => void; children?: React.ReactNode }) => (
    <button type="button" onClick={onClick} {...rest}>
      {children}
    </button>
  ),
  Card: ({ children, ...rest }: { children?: React.ReactNode }) => <div {...rest}>{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

import { ApiError } from "@/lib/api-error";
import ApprovalsHistoryModulePage from "./ApprovalsHistoryModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];
const mounted: HTMLDivElement[] = [];

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

afterEach(() => {
  for (const root of roots) {
    act(() => {
      root.unmount();
    });
  }
  roots.length = 0;
  for (const el of mounted) el.remove();
  mounted.length = 0;
  api.fetchJSON.mockReset();
});

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const rowIds = () =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_"]'))
    .filter((el) => !String(el.getAttribute("data-testid")).includes("-details-"))
    .map((el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""));
const clicks = () => api.fetchJSON.mock.calls.length;

const click = async (id: string): Promise<void> => {
  const el = q(id) as HTMLButtonElement | null;
  expect(el, id).toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

async function grabCsv(): Promise<string[][]> {
  const before = clicks();
  const blobs: Blob[] = [];
  const orig = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  const origClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = ((blob: Blob) => {
    blobs.push(blob);
    return "blob:triple-253";
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
  expect(blobs, "导出生成 Blob").toHaveLength(1);
  expect(clicks(), "导出不新增请求").toBe(before);
  const text = await blobs[0].text();
  return text
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .filter((l) => l !== "")
    .map((l) => l.split(","));
}

const written: string[] = [];
function stubClipboard(): void {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (t: string) => {
        written.push(t);
        return Promise.resolve();
      },
    },
  });
}

// —— 工单① 夹具：approved 站 risk 档位（high/low/medium）——
const T1 = { approvalId: "ap_tt1", title: "Alpha release", status: "approved", riskLevel: "high", createdAt: "2026-11-19T01:00:00Z", decidedAt: "2026-11-19T03:00:00Z" };
const T2 = { approvalId: "ap_tt2", title: "Bravo rotation", status: "approved", riskLevel: "low", createdAt: "2026-11-19T01:10:00Z", decidedAt: "2026-11-19T03:10:00Z" };
const T3 = { approvalId: "ap_tt3", title: "Charlie budget", status: "approved", riskLevel: "medium", createdAt: "2026-11-19T01:20:00Z", decidedAt: "2026-11-19T03:20:00Z" };

function serveTriples(): void {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) return {};
    if (u.includes("status=approved")) return { items: [T3, T2, T1] }; // 服务回序故意非 risk 序
    return { items: [] };
  });
}

// —— 工单②③ 夹具：分页站 ——
const G1 = { approvalId: "ap_pg1", title: "Alpha", status: "approved", createdAt: "2026-11-19T01:00:00Z" };
const G2 = { approvalId: "ap_pg2", title: "Bravo", status: "approved", createdAt: "2026-11-19T01:10:00Z" };
const G3 = { approvalId: "ap_pg3", title: "Charlie", status: "approved", createdAt: "2026-11-19T01:20:00Z" };
const G4 = { approvalId: "ap_pg4", title: "Delta", status: "approved", createdAt: "2026-11-19T01:30:00Z" };
const PG1 = { items: [G1, G2, G3], nextCursor: "gc-2" };
const PG2 = { items: [G2, G4] }; // 重复 G2 + 新行 G4，末页无 nextCursor

describe("R253 approvals export triple chain guards", () => {
  it("①status+risk-desc 站：CSV 首行==屏上首行==行复制首段、行数==表体==apv5-count", async () => {
    serveTriples();
    await render("/approvals?tab=history&status=approved&asort=risk&adir=desc");

    // 排序为本地维：请求带 status=approved 而不带 asort/adir（R71/R186 契约复验）。
    const last = String(api.fetchJSON.mock.calls.at(-1)?.[0] ?? "");
    expect(last).toContain("status=approved");
    expect(last).not.toContain("asort=");
    expect(last).not.toContain("adir=");

    // 现状单点 risk rank=critical0/high1/medium2/low3，desc=rank 数值降序=low、medium、high；
    // 本站锁的是「屏上序==CSV 序==复制首段」三链一致，方向词按现状记录。
    expect(rowIds()).toEqual(["ap_tt2", "ap_tt3", "ap_tt1"]);
    const count = q("apv5-count");
    expect(count, "apv5-count 有行站").toBeTruthy();
    expect(count!.textContent).toBe("3");

    const grid = await grabCsv();
    expect(grid[0].join(",")).toBe("id,title,status,risk,updated_at,correlation,rid");
    expect(grid.slice(1)).toHaveLength(3);
    expect(grid[1][0]).toBe(rowIds()[0]); // CSV 首行==屏上首行
    expect(grid.map((r) => r[0]).slice(1)).toEqual(rowIds());

    // 行复制首段（单号）与屏上/CSV 首行同源。
    stubClipboard();
    const before = clicks();
    await click("apr-row-copy-0");
    await waitFor(() => written.length === 1, "clipboard write");
    expect(written[0].split("\n")[0]).toBe(`单号：${rowIds()[0]}`);
    expect(clicks()).toBe(before);
  });

  it("②翻页态切本地排序后导出==当前屏上序（非第 1 页原始序），全程零新增请求", async () => {
    let cursorTries = 0;
    api.fetchJSON.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) return {};
      if (u.includes("cursor=")) {
        cursorTries += 1;
        return PG2;
      }
      return PG1;
    });
    await render("/approvals?tab=history&status=approved");
    expect(rowIds()).toEqual(["ap_pg1", "ap_pg2", "ap_pg3"]);

    await click("apv-page-more");
    await waitFor(() => rowIds().length === 4, "page 2 appended");
    expect(rowIds()).toEqual(["ap_pg1", "ap_pg2", "ap_pg3", "ap_pg4"]); // 去重追加

    const listBefore = api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approvals")).length;

    // 切本地排序 asc（标题升序，服务回序本已升序则再点 desc 制造可见换代）。
    await click("apv-sort-title"); // asc
    await click("apv-sort-title"); // desc
    await waitFor(() => rowIds()[0] === "ap_pg4", "desc sort active");

    const grid = await grabCsv();
    expect(grid.slice(1).map((r) => r[0])).toEqual(rowIds());
    expect(grid[1][0]).toBe("ap_pg4"); // 非第 1 页原始首行
    expect(grid).toHaveLength(5); // 表头+4 已加载行（只含已加载）

    // 排序切换+导出全程零新增列表取数（本地维契约）。
    const listAfter = api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approvals")).length;
    expect(listAfter).toBe(listBefore);
    expect(cursorTries, "本站未再翻页").toBe(1);
  });

  it("③翻页 500 站：rid 剪贴板回环逐字，重试恰 +1 后导出与屏上三值同步", async () => {
    let cursorTries = 0;
    api.fetchJSON.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) return {};
      if (u.includes("cursor=")) {
        cursorTries += 1;
        if (cursorTries === 1) {
          throw new ApiError("boom", {
            status: 500,
            body: JSON.stringify({ code: "runtime.unavailable" }),
            url: u,
            requestId: "req-r253-page",
          });
        }
        return PG2;
      }
      return PG1;
    });
    await render("/approvals?tab=history&status=approved");
    await click("apv-page-more");
    await waitFor(() => !!q("apr5-inline-failure"), "inline failure");

    // 失败站：已加载行仍可导出，且不产生半页 CSV（只含保留的 3 行）。
    const gridFail = await grabCsv();
    expect(gridFail.slice(1)).toHaveLength(3);
    expect(gridFail.map((r) => r[0]).slice(1)).toEqual(["ap_pg1", "ap_pg2", "ap_pg3"]);
    expect(gridFail.join("\n")).not.toContain("ap_pg4");

    // 增量：错误行 rid 复制入口与逐字文本双锁（现网 RequestIdCopyField 在模块
    // 加载期捕获 navigator.clipboard 引用，测试内 defineProperty 无法回环注入
    // ——R244 的逐字回环先例对新 mount 有效、对共享模块实例的 history 页无效；
    // 此处锁复制钮在位+反馈锚形态+rid 文本逐字，复制成功态以 clipboard 注入
    // 可用环境为准另测）。
    const ridCell = q("apr5-inline-failure")?.querySelector('[data-testid="apr5-request-id"]');
    expect(ridCell, "失败站 rid 文本格").toBeTruthy();
    expect(ridCell!.textContent).toBe("req-r253-page");
    expect(q("apr5-copy-request-id"), "失败站 rid 复制钮").toBeTruthy();
    expect(q("apr5-copy-state"), "未点击时无反馈锚").toBeNull();

    // 重试恰 +1（loadMore 同游标再取），成功后三值同步。
    const before = api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approvals")).length;
    const retry = Array.from(
      q("apr5-inline-failure")?.querySelectorAll("button") ?? [],
    ).find((b) => (b.textContent ?? "").trim() === "重试") as HTMLButtonElement | null;
    expect(retry, "inline 重试钮").toBeTruthy();
    await act(async () => {
      retry!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await waitFor(() => rowIds().length === 4, "retry appended");
    const after = api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approvals")).length;
    expect(after).toBe(before + 1);

    const count = q("apv5-count");
    expect(count!.textContent).toBe("4");
    const gridOk = await grabCsv();
    expect(gridOk.slice(1).map((r) => r[0])).toEqual(rowIds());
    expect(gridOk.slice(1)).toHaveLength(Number(count!.textContent));
  });
});
