// @vitest-environment jsdom
/**
 * R245：/approvals 历史页分页契约护栏（纯测试，零产品改动）。
 *
 * 现场裁决：工单①点名 `apv7-export-count` 的 data-rows 属性——现场
 * QueueCsvExport.tsx 只有 data-testid="apv7-export-count"（「共 N 行」文案读数），
 * 全仓 grep data-rows 零命中=幻影属性（先例：R237 工单点名 apv7-page 现场不存在，
 * 实名 apr5-page-history）。故工单①的「三值」按现场载体（apv5-count textContent、
 * 表体行数、真实导出 blob 数据行数、「共 N 行」读数）复核，不臆造 data-rows。
 *
 * 已覆盖只回证据（不写重复用例）：
 *  ①第 2 页追加后 CSV 数据行数==已加载表体==apv5-count、首行单号==屏上首行
 *    = approvals.export.paged.test.tsx it「① after appending page two…」（R235）；
 *  ③末页 nextCursor=null 时 apv-page-more disabled+title（「已到末页」）
 *    = approvals.paging.test.tsx it「appends the deduped page…」（R139）；
 *    第 2 页 500：旧行保留+错误条带可复制 rid+重试恰 +1 并追加成功
 *    = approvals.paging.test.tsx it「pageFailure panel carries the rid…」（R139），
 *    失败站计数三值不变 = approvals.export.fail.isolation.test.tsx it①（R243）。
 *
 * 本文件缺口 = ②翻页后切 ?status=rejected 站：游标重置（新请求不带 cursor=）、
 * 行替换非累加、apv5-count/导出读数随新集合重算（R235 it② 只测了 pending 站）。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const clip = vi.hoisted(() => ({ write: vi.fn() }));
vi.mock("@/lib/clipboard", () => ({
  isClipboardCopySupported: () => true,
  copyTextToClipboard: (text: string) => clip.write(text),
}));

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

const mock = api.fetchJSON;

import ApprovalsHistoryModulePage from "./ApprovalsHistoryModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const P1 = { approvalId: "ap_p1", title: "第一条", status: "approved", createdAt: "2026-11-19T01:00:00Z" };
const P2 = { approvalId: "ap_p2", title: "第二条", status: "approved", createdAt: "2026-11-19T01:10:00Z" };
const P3 = { approvalId: "ap_p3", title: "第三条", status: "approved", createdAt: "2026-11-19T01:20:00Z" };
const P4 = { approvalId: "ap_p4", title: "第四条", status: "approved", createdAt: "2026-11-19T01:30:00Z" };
const RJ = { approvalId: "ap_rj1", title: "驳回一条", status: "rejected", createdAt: "2026-11-19T03:00:00Z", decidedAt: "2026-11-19T04:00:00Z" };

const PAGE1 = { items: [P1, P2, P3], nextCursor: "pc-2" };
// 第二页重复 P3、末页不再带 nextCursor 键。
const PAGE2 = { items: [P3, P4] };

let container: HTMLDivElement | null = null;
let root: Root | null = null;

async function waitFor(condition: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 3000;
  for (;;) {
    let done = false;
    await act(async () => {
      done = condition();
      if (!done) await new Promise((resolve) => setTimeout(resolve, 5));
    });
    if (done) return;
    if (Date.now() > deadline) throw new Error(`waitFor: ${label} never became true`);
  }
}

async function render(entry = "/approvals?tab=history"): Promise<void> {
  if (root) root.unmount();
  container?.remove();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <ApprovalsHistoryModulePage />
      </MemoryRouter>,
    );
  });
  await waitFor(() => document.querySelectorAll(".animate-pulse").length === 0, "initial reads settled");
}

function q(testId: string): HTMLElement | null {
  return container?.querySelector(`[data-testid="${testId}"]`) ?? null;
}

function rowIds(): string[] {
  return Array.from(container?.querySelectorAll('[data-testid^="apr5-row-ap_"]') ?? []).map(
    (node) => node.getAttribute("data-testid")?.slice("apr5-row-".length) ?? "",
  );
}

function listCalls(): string[] {
  return mock.mock.calls.map((call) => String(call[0])).filter((url) => url.includes("/api/approvals"));
}

function click(testId: string): void {
  const node = q(testId);
  if (!node) throw new Error(`找不到 ${testId}`);
  node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  mock.mockReset();
  clip.write.mockReset();
});

function servePaged() {
  mock.mockImplementation((input: unknown) => {
    const url = String(input);
    if (url.includes("/api/approval?id=")) return Promise.resolve({});
    if (url.includes("status=rejected")) return Promise.resolve({ items: [RJ] });
    if (url.includes("cursor=")) return Promise.resolve(PAGE2);
    return Promise.resolve(PAGE1);
  });
}

describe("approvals.history.paging (R245)", () => {
  it("② after appending page two, switching ?status=rejected resets the cursor, replaces rows and recomputes every count", async () => {
    servePaged();
    await render();
    // 先站到第 2 页（游标已被消费，地址里没有 cursor——R79 现场形态）。
    click("apv-page-more");
    await waitFor(() => rowIds().join(",") === ["ap_p1", "ap_p2", "ap_p3", "ap_p4"].join(","), "page two appended (deduped)");
    const before = listCalls().length;

    click("apv5-filter-status-rejected");
    await waitFor(() => rowIds().join(",") === "ap_rj1", "rejected station replaced the rows");
    const fresh = listCalls().slice(before);
    expect(fresh.length, "服务端维切换恰 1 次新取数").toBe(1);
    expect(fresh[0], "新请求带 status=rejected").toContain("status=rejected");
    expect(fresh[0], "新请求不残留旧游标").not.toContain("cursor=");
    expect(rowIds(), "行替换非累加：第 2 页行零残留").toEqual(["ap_rj1"]);
    const shown = q("apv5-count")?.textContent ?? "";
    expect(shown, "apv5-count 随新集合重算").toBe("1");
    expect(shown, "计数位不是裸 0 或缺位").not.toBe("0");
    // 导出读数与行集同源（现场载体：「共 N 行」文案，无 data-rows 属性——文件头裁决）。
    const exportCount = q("apv7-export-count")?.textContent ?? "";
    expect(exportCount, "导出读数=新集合行数").toContain("1");
    expect(exportCount, "导出读数不是「—」假空").not.toContain("—");
    // 导出不新增 fetch（R235/R182 已在他站锁计数；此站复锁一次，用现场 stub 形制）。
    const callsAfterSwitch = mock.mock.calls.length;
    const URLRef = URL as unknown as {
      createObjectURL: (value: unknown) => string;
      revokeObjectURL: (value: string) => void;
    };
    const originalCreate = URLRef.createObjectURL;
    const originalRevoke = URLRef.revokeObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;
    const captured: unknown[] = [];
    URLRef.createObjectURL = (blob: unknown) => {
      captured.push(blob);
      return "blob:history-paging";
    };
    URLRef.revokeObjectURL = () => undefined;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      captured.push(`download:${this.download}`);
    };
    try {
      click("apv7-export");
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
    } finally {
      URLRef.createObjectURL = originalCreate;
      URLRef.revokeObjectURL = originalRevoke;
      HTMLAnchorElement.prototype.click = originalClick;
    }
    expect(captured.length, "rejected 站导出真实生成了一个文件（非 disabled 空站）").toBe(2);
    expect(mock.mock.calls.length, "导出零额外请求").toBe(callsAfterSwitch);
  });
});
