// @vitest-environment jsdom
/**
 * R244 — 审批详情 × 多页选中态（纯测试，零产品改动）。
 *
 * 先 git grep 查重，已覆盖只回证据、本文件不写重复用例：
 * - 追加后行序/复制/CSV 同序=approvals.paging.test.tsx（R139）+
 *   approvals.export.paged.test.tsx（R235）it①③；
 * - 切站后同一行复制逐字+缺值段=R234（rowcopy.stability）it①；
 * - 排序切换后钮 i 与行 i 不串=R162 it L245；开详情列表腿不变+详情腿恰 1+
 *   关闭零请求+行序保持=approvals.parity（R120）/fields2 it③（R207）；
 * - 详情 500 错误面=fields2 it④（R207）。
 * 本文件三块真缺口：
 * ①**第 2 页追加出来的行**开详情：复制钮序号 i 与 4 行屏上序逐位对应、
 *   详情内容=该行本身、列表不回到第 1 页集合；
 * ②详情打开态切 ?status=：现场语义=choose() 先 setSelected(null)+删 id
 *   （抽屉自动关闭，非残留），关闭后 rail 序号从 0 连续无重复；
 * ③详情 **404**：现场落 DeniedPanel（api.ts 403≡404 同体）而非 500 的
 *   apr5-detail-error——apr5-denied/apv-state-denied+可读句+rid 可复制；
 *   apv5-count 与表体不受详情失败牵连；关闭零请求。
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
import { APPROVAL_DENIED_TITLE } from "@/modules/approvals/stateCopy";

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
const railIndexes = () =>
  Array.from(document.querySelectorAll("button"))
    .map((b) => b.getAttribute("data-testid") ?? "")
    .filter((t) => /^apr-row-copy-\d+$/.test(t))
    .map((t) => Number(t.replace("apr-row-copy-", "")));

const clickEl = async (el: Element | null | undefined, what: string): Promise<void> => {
  expect(el, what).toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};
const click = (id: string) => clickEl(q(id), id);

const P1 = { approvalId: "ap_p1", title: "第一条", status: "approved", createdAt: "2026-11-19T01:00:00Z" };
const P2 = { approvalId: "ap_p2", title: "第二条", status: "approved", createdAt: "2026-11-19T01:10:00Z" };
const P3 = { approvalId: "ap_p3", title: "第三条", status: "approved", createdAt: "2026-11-19T01:20:00Z" };
const P4 = { approvalId: "ap_p4", title: "第四条", status: "approved", createdAt: "2026-11-19T01:30:00Z",
  requestId: "req-r244-44445555" };
const A1 = { approvalId: "ap_a1", title: "已批一条", status: "approved", createdAt: "2026-11-19T04:00:00Z" };
const PAGE1 = { items: [P1, P2, P3], nextCursor: "pc-2" };
const PAGE2 = { items: [P3, P4] }; // 重复 P3 + 末页新行 P4（无 nextCursor 键）

/** 第 2 页追加后 ap_p4 在场；id 读口回同体供详情。 */
function servePaged(): void {
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent(u.split("id=")[1] ?? "");
      return [P1, P2, P3, P4, A1].find((r) => r.approvalId === id) ?? {};
    }
    if (u.includes("cursor=")) return PAGE2;
    if (u.includes("status=approved")) return { items: [A1] };
    return PAGE1;
  });
}

async function openDetail(id: string): Promise<void> {
  await clickEl(q(`apr5-row-${id}`), `row card ${id}`);
  await waitFor(() => !!q("apr5-detail") || !!q("apr5-denied"), `drawer for ${id}`);
}

function stubClipboard(written: string[]) {
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

describe("R244 approvals detail × multipage selection state", () => {
  it("① opening a detail on an appended page-two row: rail index i tracks the 4-row screen order, content is that row, no bounce back to page one", async () => {
    servePaged();
    await render("/approvals?tab=history");
    await waitFor(() => rowIds().length === 3, "page one");
    const beforePage2 = mock.mock.calls.length;
    await click("apv-page-more");
    await waitFor(() => rowIds().length === 4, "page two appended");
    expect(rowIds(), "追加集合").toEqual(["ap_p1", "ap_p2", "ap_p3", "ap_p4"]);

    // 在第 2 页才出现的行上开详情。
    const listBefore = mock.mock.calls.filter((c) => String(c[0]).includes("/api/approvals")).length;
    await openDetail("ap_p4");
    expect(q("apr5-detail"), "详情抽屉打开").toBeTruthy();
    expect(
      mock.mock.calls.filter((c) => String(c[0]).includes("/api/approvals")).length,
      "开详情不重取列表",
    ).toBe(listBefore);
    expect(q("apr5-detail")?.textContent ?? "", "详情内容=该行本身").toContain("第四条");
    expect(rowIds(), "屏上集合不回到第 1 页").toEqual(["ap_p1", "ap_p2", "ap_p3", "ap_p4"]);

    // rail 序号与 4 行序逐位对应（详情打开态不漂移）。
    expect(railIndexes(), "rail 序号=0..3 连续").toEqual([0, 1, 2, 3]);
    const written: string[] = [];
    stubClipboard(written);
    const callsBefore = mock.mock.calls.length;
    await click("apr-row-copy-3");
    await waitFor(() => written.length === 1, "rail copy lands");
    expect(written[0].split("\n")[0], "第 4 个钮复制的是第 4 行").toBe("单号：ap_p4");
    expect(mock.mock.calls.length, "复制零请求").toBe(callsBefore);
    expect(mock.mock.calls.length, "整链相对追加前只多了翻页那条读").toBe(beforePage2 + 2);
  });

  it("② switching ?status= with the drawer open: current state closes the detail, and the rail renumbers from 0 with no duplicates", async () => {
    servePaged();
    await render("/approvals?tab=history");
    await waitFor(() => rowIds().length === 3, "page one");
    await openDetail("ap_p2");
    expect(q("apr5-detail"), "drawer open before the switch").toBeTruthy();

    await click("apv5-filter-status-approved");
    await waitFor(() => rowIds().length === 1 && rowIds()[0] === "ap_a1", "approved station");
    // 现状锁：choose() 先 setSelected(null)+删 id=切换状态自动关详情（非残留）。
    expect(q("apr5-detail"), "现场语义：切状态关闭打开中的详情").toBeNull();
    expect(q("apr5-denied"), "也不该落进无权态").toBeNull();
    // MemoryRouter 不动 window.location；id 落参以「抽屉不重开」为行为证据（上行）。
    // 关后 rail 从 0 连续无重复（1 行=只有一枚钮）。
    expect(railIndexes(), "序号从 0 连续无重复").toEqual([0]);
    expect(q("apv5-count")?.textContent, "计数位与表体同步").toBe(String(rowIds().length));
  });

  it("③ detail 404 lands in the 403≡404 denied body: readable sentence + copyable rid, list and count untouched, closing costs nothing", async () => {
    mock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) {
        throw new ApiError("gone", {
          status: 404,
          body: JSON.stringify({ code: "approval.not_found" }),
          url: u,
          requestId: "req-r244-404",
        });
      }
      return { items: [P1, P2, P3] };
    });
    await render("/approvals?tab=history");
    await waitFor(() => rowIds().length === 3, "list lands");
    const countBefore = q("apv5-count")?.textContent ?? "";

    await openDetail("ap_p1");
    // 404 现场落 DeniedPanel（api.ts 403≡404 同体），不是 500 的 apr5-detail-error。
    expect(q("apr5-denied"), "详情 404=同体无权面板").toBeTruthy();
    expect(q("apr5-detail-error"), "不是错误面板（现状锁）").toBeNull();
    const deniedText = (q("apr5-denied")?.textContent ?? "");
    expect(deniedText, "可读句=单点标题").toContain(APPROVAL_DENIED_TITLE);
    expect(q("apv-state-rid")?.textContent ?? "", "rid 载体在面板上").toContain("req-r244-404");

    const written: string[] = [];
    stubClipboard(written);
    const copyBtn = q("apr5-denied")?.querySelector("[data-testid='apr5-copy-request-id']");
    const callsBefore = mock.mock.calls.length;
    await clickEl(copyBtn, "denied rid copy");
    await waitFor(() => written.length === 1, "rid copy lands");
    expect(written[0], "剪贴板收到 rid 本体").toBe("req-r244-404");

    expect(q("apv5-count")?.textContent, "列表计数位不受详情失败牵连").toBe(countBefore);
    expect(rowIds(), "表体 3 行原样").toEqual(["ap_p1", "ap_p2", "ap_p3"]);

    await click("apd7-back");
    await waitFor(() => !q("apr5-denied"), "denied panel closed");
    expect(mock.mock.calls.length, "关闭零请求").toBe(callsBefore);
  });
});
