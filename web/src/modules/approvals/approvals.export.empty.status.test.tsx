// @vitest-environment jsdom
/**
 * R249 — 审批空状态站与清筛选恢复的导出护栏（纯测试，零产品改动，gap-only）。
 *
 * 已覆盖只回证据，不写重复用例：
 * ① rejected 空站的导出闸 = approvals.export.multistatus.test.tsx it③
 *   （?status=__nope__ 透传空站：apv5-count toBeNull + apv7-export
 *   disabled + title 非空 + dispatchEvent 强点零 Blob 零请求）与
 *   approvals.export.bounds.test.tsx it①（pending 空站含
 *   aria-disabled=true 锁）。空站载体形制相同，本文件在 rejected 站
 *   顺带复锁 disabled/aria-disabled/title/强点，不作为主体。
 * ② 两行站三值+首行 = approvals.export.order.test.tsx（R231，三行）
 *   与 approvals.export.sort.cross.test.tsx（R248，三行）已锁同机制；
 *   行数多少无语义增量。本文件在恢复站顺带复锁（两行）。
 * ③ 真缺口 = 空站 → 点 apv-reset-filters（R90 清七参保留 tab，
 *   恰 1 次重取）→ 导出恢复的整链：createObjectURL 全程只在恢复后
 *   被调用一次（空站强点贡献 0 次），且恢复后三值与首行同步。
 *   R229 的往返锁的是读数文案（「—」vs 共 N 行），从未把「空站强点
 *   + 恢复后真导出」放进同一个 Blob 计数里。
 *
 * 现场事实：status 为服务端维（切换/清除必重取，choose/reset 恰 +1、
 * 新请求无 cursor=）；导出为纯前端零 fetch（R54 契约）。
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

// 恢复站的两行（清掉 status 后服务端腿返回的全集）。
const E1 = {
  approvalId: "ap_es1",
  title: "恢复首行一号",
  status: "rejected",
  riskLevel: "medium",
  requestId: "req-es-11112222",
  createdAt: "2026-11-18T01:00:00Z",
  decidedAt: "2026-11-19T02:00:00Z",
};
const E2 = {
  approvalId: "ap_es2",
  title: "恢复次行二号",
  status: "approved",
  riskLevel: "low",
  requestId: "req-es-33334444",
  createdAt: "2026-11-18T02:00:00Z",
  decidedAt: "2026-11-19T03:00:00Z",
};

function serve() {
  urlsAll = [];
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    urlsAll.push(u);
    if (u.includes("/api/approval?id=")) return {};
    if (u.includes("status=rejected")) return { items: [] };
    if (u.includes("/api/approvals")) return { items: [E1, E2] };
    return {};
  });
}

const rowIds = () =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap"]'))
    .map((el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""))
    .filter((id) => !id.startsWith("details-"));

describe("R249 空站强点 + 清筛选恢复导出的 Blob 累计链", () => {
  it("rejected 空站导出全闸且强点零 Blob；apv-reset-filters 回全量后导出恢复，createObjectURL 全程只被调用一次", async () => {
    serve();
    await render("/approvals?tab=history&status=rejected");
    await waitFor(() => q("apv7-export") !== null, "empty station paints export gate");

    // ① 空站复锁（主证据=R246 it③ + R229 it①）：disabled/aria-disabled/title。
    const btn = q("apv7-export") as HTMLButtonElement | null;
    expect(btn, "export button mounted").toBeTruthy();
    expect(btn!.disabled, "空站导出 disabled").toBe(true);
    expect(btn!.getAttribute("aria-disabled"), "aria-disabled 同源").toBe("true");
    expect(btn!.getAttribute("title"), "空站 title 写明原因").toBeTruthy();
    expect(q("apv5-count"), "空站 apv5-count 不渲染非假 0").toBeNull();

    // Blob 计数从空站起挂：强点必须贡献 0 次。
    const captured: Blob[] = [];
    const orig = URL.createObjectURL;
    URL.createObjectURL = ((blob: Blob) => {
      captured.push(blob);
      return "blob:appr249";
    }) as typeof URL.createObjectURL;
    const clicks = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    try {
      const callsBeforeEmptyClick = mock.mock.calls.length;
      await act(async () => {
        btn!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      expect(captured, "空站强点零 Blob").toHaveLength(0);
      expect(clicks, "空站强点零下载").not.toHaveBeenCalled();
      expect(mock.mock.calls.length, "空站强点零请求").toBe(callsBeforeEmptyClick);

      // 清筛选 = R90 重置钮（清七参保留 tab，服务端维恰 +1 且无 cursor=）。
      const reset = q("apv-reset-filters") as HTMLButtonElement | null;
      expect(reset, "reset button mounted").toBeTruthy();
      expect(reset!.disabled, "有 status 参时 reset 可用").toBe(false);
      const listBefore = listCalls().length;
      await act(async () => {
        reset!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      await waitFor(() => rowIds().length === 2, "cleared station shows both rows");
      expect(listCalls(), "清筛选恰 +1 次重取").toHaveLength(listBefore + 1);
      const fresh = listCalls()[listCalls().length - 1];
      expect(fresh, "新请求不带 status/游标").not.toMatch(/status=|cursor=/);

      // ③ 恢复站：三值 + 首行 + createObjectURL 累计恰 1。
      expect(q("apv5-count")?.textContent, "apv5-count==表体").toBe("2");
      expect(q("apv7-export-count")?.textContent).toContain("共 2 行");
      const exportBtn = q("apv7-export") as HTMLButtonElement | null;
      expect(exportBtn!.disabled, "恢复后导出可用").toBe(false);
      const callsBeforeExport = mock.mock.calls.length;
      await act(async () => {
        exportBtn!.click();
      });
      expect(captured, "createObjectURL 全程只调用一次（空站 0 + 恢复 1）").toHaveLength(1);
      expect(mock.mock.calls.length, "导出零取数").toBe(callsBeforeExport);
      const lines = (await captured[0].text())
        .replace(/^\uFEFF/, "")
        .split("\r\n")
        .filter((line) => line !== "");
      const dataRows = lines.slice(1).map((line) => line.split(","));
      expect(dataRows, "CSV 数据行==表体==apv5-count").toHaveLength(2);
      expect(dataRows[0][0], "首行单号==屏上首行").toBe(rowIds()[0]);
      expect(dataRows[1][0]).toBe(rowIds()[1]);
    } finally {
      URL.createObjectURL = orig;
      clicks.mockRestore();
    }
  });
});
