// @vitest-environment jsdom
/**
 * R228 — 审批导出 CSV 的文件名/MIME 与 CRLF 双契约（纯测试，禁改产品行为）。
 *
 * 已覆盖只回证据，不写重复用例：
 * - approvalsCsvName 纯函数三形态（pending 时刻/跨日/revise_requested+sort）
 *   = ApprovalsHistoryModulePage.test.tsx L606-613（R182 时代锁）；
 * - 裸 \n 特字 title 写出→状态机读回 = R217 it①②；缺值 cell 解析回空串 =
 *   R217 it②；页面级 CSV title==屏上文本 = R217 it③；导出前后 fetchJSON
 *   不变 = R217 it④ + R182 it②；列头逐字七列 = R182/R217/R219 多处。
 *
 * 本文件两处真缺口（逐条点名）：
 * ①文件名与 MIME 的页面侧现状锁：产品已设 Blob type "text/csv;charset=utf-8"
 *   （QueueCsvExport.tsx L69）但此前无任何断言；页面侧 a.download 拼接名
 *   （导出瞬间 approvalsCsvName 重算）与常驻预览 apv-export-name 逐字一致，
 *   且形态为五段 approvals-<tab>-<status|all>-<sort|default>-<dir|default>-
 *   <YYYYMMDD-HHmm>.csv —— 工单写的四段 <tab|status>-<YYYYMMDD> 是简化口径，
 *   按现状锁全形（禁臆造第二套），正则含日期段即可同时兼容两种读法。
 * ②title 含 \r\n（CRLF 对，非 R217 的裸 \n）：引号包裹、逻辑行数不裂增、
 *   解析回单元格内 CRLF 逐字保留；屏上表体仍 N 行。
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
import { buildApprovalsCsv } from "@/modules/approvals/QueueCsvExport";
import type { ApprovalRow } from "@/modules/approvals/model";
import ApprovalsHistoryModulePage from "@/modules/approvals/ApprovalsHistoryModulePage";

const api = vi.mocked(fetchJSON);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let roots: Root[] = [];
let mounted: HTMLDivElement[] = [];

function clearScreen(): void {
  for (const root of roots) {
    act(() => {
      root.unmount();
    });
  }
  roots = [];
  for (const el of mounted) el.remove();
  mounted = [];
}

afterEach(() => {
  clearScreen();
  api.mockReset();
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

async function renderInto(entry: string, node: ReactNode): Promise<void> {
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

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const rowIds = (): string[] =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_f"]')).map((el) =>
    String(el.getAttribute("data-testid")).replace("apr5-row-", ""),
  );

/** RFC4180 读取状态机（用例自带，非产品码；R217 同款）。 */
function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\r") {
      if (src[i + 1] === "\n") continue;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

describe("R228 csv filename & MIME (page level)", () => {
  const F1 = {
    approvalId: "ap_f1",
    title: "季度预算复议",
    status: "approved",
    riskLevel: "medium",
    decidedAt: "2026-11-19T02:00:00Z",
    requestId: "req-f1-1",
  };

  function serveRows(): void {
    api.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/approvals")) return { items: [F1] };
      return {};
    });
  }

  it("① download name matches the five-part current form and the preview verbatim; Blob carries the CSV MIME", async () => {
    serveRows();
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await waitFor(() => rowIds().length === 1, "one row");

    const captured: Blob[] = [];
    const downloads: string[] = [];
    const orig = URL.createObjectURL;
    URL.createObjectURL = ((blob: Blob) => {
      captured.push(blob);
      return "blob:appr228";
    }) as typeof URL.createObjectURL;
    const clicks = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.getAttribute("download") ?? "");
      });
    const before = api.mock.calls.length;
    try {
      const btn = q("apv7-export") as HTMLButtonElement | null;
      expect(btn, "export button").toBeTruthy();
      expect(btn!.disabled, "export enabled with loaded rows").toBe(false);
      await act(async () => {
        btn!.click();
      });
    } finally {
      URL.createObjectURL = orig;
      clicks.mockRestore();
    }
    expect(captured).toHaveLength(1);
    // 产品已设 MIME（缺口一：此前无断言）——按现状锁逐字。
    expect(captured[0].type, "Blob MIME 现状锁").toBe("text/csv;charset=utf-8");
    expect(downloads).toHaveLength(1);
    // 现状五段形：tab-status|all-sort|default-dir|default-YYYYMMDD-HHmm.csv
    expect(downloads[0], "文件名现状全形").toMatch(
      /^approvals-history-all-default-default-\d{8}-\d{4}\.csv$/,
    );
    // 常驻预览与真实下载名逐字一致（同分钟瞬间重算）。
    expect(q("apv-export-name")?.textContent?.trim(), "预览==下载").toBe(downloads[0]);
    // 导出仍零取数（R217 it④ 口径，这里锁同一条腿）。
    expect(api.mock.calls.length, "导出不发新请求").toBe(before);
  });
});

describe("R228 csv CRLF roundtrip (pure function)", () => {
  const mkRow = (over: Record<string, unknown>): ApprovalRow =>
    ({
      key: "ap_c1",
      rawId: "ap_c1",
      title: "plain",
      status: { label: "已通过" },
      risk: { label: "中风险" },
      clock: "2026-11-19 10:00",
      requestId: "req-c1",
      ...over,
    }) as unknown as ApprovalRow;

  it("② a CRLF pair inside title stays one logical row and reads back with the CRLF verbatim", () => {
    const CR = "甲\r\n乙";
    const csv = buildApprovalsCsv([mkRow({ title: CR }), mkRow({ key: "ap_c2", rawId: "ap_c2" })]);
    // 写出：整个单元格被引号包裹，内部 CRLF 原样在场（非折叠、非剥除）。
    expect(csv).toContain('"甲\r\n乙"');
    // 物理行数会比逻辑行数多——正是要防的裂增；状态机读回必须收敛。
    const grid = parseCsv(csv);
    expect(grid.length, "逻辑行数=表头+2 数据行，CRLF 不裂增").toBe(3);
    expect(grid[0]).toEqual(["id", "title", "status", "risk", "updated_at", "correlation", "rid"]);
    expect(grid[1][0]).toBe("ap_c1");
    expect(grid[1][1], "解析回单元格内 CRLF 逐字保留").toBe(CR);
    expect(grid[2][1]).toBe("plain");
    // 屏上表体行数与逻辑行数同 N 的口径由 R217 it③ 页面级已锁，本例纯函数补
    // CRLF 专用形态（R217 只测了裸 \n）。
  });
});
