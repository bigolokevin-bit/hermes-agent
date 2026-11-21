// @vitest-environment jsdom
/**
 * R231 — 审批导出顺序与三值同源护栏（纯测试，零产品改动，gap-only）。
 *
 * 已覆盖只回证据，不写重复用例：
 * ①的 asc 方向 = approvals.export.filter.test.tsx it②（entry
 *   DEEP&asort=title&adir=asc，CSV 首/次行 cells[0]==rowIds()[0]/[1] +
 *   导出前后 mock.calls 相等）。本文件补 desc 方向 + 第三路
 *   apr-row-copy-<i>（其「钮与行同序」单站锁在 R127/R162，从未与
 *   深链 desc + CSV 同帧对照）。
 * ② 三值（apv5-count==表体==「共 N 行」）= export.filter it① /
 *   export.bounds it②；导出与复制零取数 = export.filter it②、
 *   bounds it②③、rows.csv roundtrip it④。本文件在 desc 深链站
 *   顺带集中复锁一次（同一 mock.calls 前后差），不新建站点。
 * ③ 缺值双载体（CSV 空字段 vs 复制「—」）= export.filter it③ +
 *   rows.csv.roundtrip it①②。现场裁决：risk 缺值 CSV 写人话
 *   「未标注风险」而非空字段（R107 契约，export.filter it③ 已锁），
 *   工单「缺 risk→CSV 对应 cell 空字段」与此不符——按现状锁，
 *   本文件同行复核 rid/updated_at 两格空 + 复制「—」。
 * ④ 空集导出 disabled+title+强点零 Blob 零请求 = approvals.empty
 *   it② + export.bounds it①（dispatchEvent 双锁形态已建）。
 *
 * 现场事实：排序参 asort/adir 为本地维、从不进请求（R71/R186 契约）；
 * 深链直入 desc 站只需首取 1 条列表腿；localeCompare("zh-Hans-CN")
 * 拼音序教训在案——本文件用 ASCII 标题（Alpha/Beta/Gamma）使期望序
 * 无歧义：desc = Gamma, Beta, Alpha。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

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

async function renderInto(entry: string, node: ReactElement): Promise<void> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  mounted.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[entry]}>{node}</MemoryRouter>);
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), `${entry} settled`);
}

const render = (entry: string) => renderInto(entry, <ApprovalsHistoryModulePage />);

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
let urlsAll: string[] = [];
const listCalls = () => urlsAll.filter((u) => u.includes("/api/approvals"));

const O1 = {
  approvalId: "ap_or1",
  title: "Alpha release",
  status: "approved",
  riskLevel: "high",
  requestId: "req-or-11112222",
  createdAt: "2026-11-18T01:00:00Z",
  decidedAt: "2026-11-19T02:00:00Z",
};
// 缺值主角：无 riskLevel / 无 decidedAt(等 DECIDED 键) / 无 requestId。
const O2 = {
  approvalId: "ap_or2",
  title: "Beta rotation",
  status: "approved",
  createdAt: "2026-11-18T02:00:00Z",
};
const O3 = {
  approvalId: "ap_or3",
  title: "Gamma budget",
  status: "approved",
  riskLevel: "low",
  requestId: "req-or-33334444",
  createdAt: "2026-11-18T03:00:00Z",
  decidedAt: "2026-11-19T04:00:00Z",
};

function serveApproved() {
  urlsAll = [];
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    urlsAll.push(u);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent(u.split("id=")[1] ?? "");
      const row = [O1, O2, O3].find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("/api/approvals")) return { items: [O1, O2, O3] };
    return {};
  });
}

const rowIds = () =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap"]'))
    .map((el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""))
    .filter((id) => !id.startsWith("details-"));

const DESC = "/approvals?tab=history&status=approved&asort=title&adir=desc";

describe("R231 ①②③ desc station — CSV order == screen order == row-copy order", () => {
  it("deep-linked title/desc keeps all three carriers in the same order, three values agree, and the gap row writes empty CSV cells with 复制「—」", async () => {
    serveApproved();
    await render(DESC);
    await waitFor(() => rowIds().length === 3, "desc station shows three rows");

    // 排序本地维：深链首取只 1 条列表腿，且请求不带 asort/adir（R71/R186 契约）。
    expect(listCalls(), "list reads: exactly one").toHaveLength(1);
    expect(listCalls()[0]).toContain("status=approved");
    expect(listCalls()[0], "排序参不进请求").not.toMatch(/asort=|adir=/);

    // desc 期望序（ASCII 标题无拼音歧义）：Gamma, Beta, Alpha。
    const sortBtn = q("apv-sort-title") as HTMLButtonElement | null;
    expect(sortBtn, "title sort button").toBeTruthy();
    expect(sortBtn!.getAttribute("aria-sort"), "desc 回填").toBe("descending");
    const order = rowIds();
    expect(order, "屏上行序=desc").toEqual(["ap_or3", "ap_or2", "ap_or1"]);

    // ② 三值：apv5-count == 表体 == 「共 N 行」。
    expect(q("apv5-count")?.textContent).toBe("3");
    expect(q("apv7-export-count")?.textContent).toContain("共 3 行");

    // ① 第三路：逐位点 apr-row-copy-<i>，复制首段单号 == rowIds()[i]。
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (t: string) => {
          written.push(t);
          return Promise.resolve();
        },
      },
    });
    const callsBeforeCopy = mock.mock.calls.length;
    for (let i = 0; i < 3; i += 1) {
      const btn = q(`apr-row-copy-${i}`) as HTMLButtonElement | null;
      expect(btn, `row copy button ${i}`).toBeTruthy();
      await act(async () => {
        btn!.click();
      });
    }
    expect(written).toHaveLength(3);
    written.forEach((line, i) => {
      expect(line.startsWith(`单号：${order[i]}`), `copy ${i} 首段==屏上第 ${i} 行`).toBe(true);
    });
    expect(written[0], "首行单号 toBe").toContain("单号：ap_or3");
    expect(mock.mock.calls.length, "复制零取数").toBe(callsBeforeCopy);

    // ③ 缺值行（Beta rotation，屏上第 1 位）：复制「—」与未标注风险人话。
    expect(written[1]).toContain("更新时间：—");
    expect(written[1]).toContain("短码：—");
    expect(written[1]).toContain("风险：未标注风险");
    expect(written[1], "复制不泄引擎词").not.toMatch(/undefined|null|req-/);

    // ① 第一路 + ③ CSV 格：拦 blob，数据行序逐位 == rowIds()。
    const captured: Blob[] = [];
    const orig = URL.createObjectURL;
    URL.createObjectURL = ((blob: Blob) => {
      captured.push(blob);
      return "blob:appr231";
    }) as typeof URL.createObjectURL;
    const clicks = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const callsBeforeExport = mock.mock.calls.length;
    try {
      const btn = q("apv7-export") as HTMLButtonElement | null;
      expect(btn, "export button").toBeTruthy();
      expect(btn!.disabled, "非空集导出可用").toBe(false);
      await act(async () => {
        btn!.click();
      });
    } finally {
      URL.createObjectURL = orig;
      clicks.mockRestore();
    }
    expect(captured).toHaveLength(1);
    const grid = (await captured[0].text())
      .replace(/^\uFEFF/, "")
      .split("\r\n")
      .filter((line) => line !== "")
      .map((line) => line.split(","));
    expect(grid[0]).toEqual(["id", "title", "status", "risk", "updated_at", "correlation", "rid"]);
    const dataRows = grid.slice(1);
    expect(dataRows).toHaveLength(3);
    dataRows.forEach((cells, i) => {
      expect(cells[0], `CSV 第 ${i} 行 id==屏上第 ${i} 行`).toBe(order[i]);
    });
    const gapRow = dataRows.find((r) => r[0] === "ap_or2");
    expect(gapRow, "csv gap row").toBeTruthy();
    expect(gapRow![3], "risk 缺值=人话「未标注风险」（R107 契约，非空字段——按现状）").toBe("未标注风险");
    expect(gapRow![4], "updated_at 缺=空字段").toBe("");
    expect(gapRow![6], "rid 缺=空字段").toBe("");
    const fullRow = dataRows.find((r) => r[0] === "ap_or3");
    expect(fullRow![4], "对照：有决定时间行非空").not.toBe("");
    expect(fullRow![6]).toBe("req-or-33334444");
    expect(grid.join("\n"), "CSV 不泄引擎词").not.toMatch(/undefined|null/);
    expect(mock.mock.calls.length, "导出零取数").toBe(callsBeforeExport);
  });
});
