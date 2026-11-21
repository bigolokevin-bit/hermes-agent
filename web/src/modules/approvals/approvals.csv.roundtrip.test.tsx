// @vitest-environment jsdom
/**
 * R217 — 审批备注与导出 RFC4180 往返护栏（纯测试，禁改产品行为）。
 *
 * 已覆盖只回证据，不写重复用例：
 * ③列头逐字+行数==表体==apv5-count = R182 it①（L136-166：deep status 腿三值
 *   同源）；导出前后 fetchJSON 不变 = R182 it②；缺值空字段（updated_at/rid）
 *   正向断言 = R54（L193-206：endsWith 形态）与 R182 it③ 双载体；空集导出
 *   disabled+title+createObjectURL 未调用 = R211 it②；CSV 无备注列契约 =
 *   R216 it③；七列 correlation/rid 语义 = R107。
 *
 * 本文件真缺口（逐条点名）：
 * ①往返解析=状态机把 buildApprovalsCsv 的输出解析回原串逐字相等（既有只锁
 *   转义「写出」形态，没有验证「读回」形态）；含逗号+双引号+换行三特字的
 *   title 在逻辑行里不裂行、不丢字。
 * ②缺值列解析回空串（非「—」非 null）——用解析后 cell 逐字锁，替代 R54 的
 *   endsWith 字符串形态。
 * ③页面级：屏上标题（truncated 载体文本）== CSV 解析回的 title 单元格逐字。
 *
 * 现场裁决（禁臆造第二套）：
 * - 模型层 humanSentence（model.ts L40-46）把标题里的 \s+ 折成单空格，所以
 *   页面级 CSV 的 title 单元格现实不会出现裸换行；换行往返由纯函数用例覆盖
 *   （buildApprovalsCsv 接收的 ApprovalRow.title 若含 \n，csvEscape 会引号
 *   包裹且解析回原样）。本护栏按现状分别锁，不给页面塞模型会折叠的假场景。
 * - CSV status/risk 列=屏上同一人话 label（R182 裁决沿引），本文件不另断。
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
import { buildApprovalsCsv, csvEscape } from "@/modules/approvals/QueueCsvExport";
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

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const rowIds = (): string[] =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_s"]')).map((el) =>
    String(el.getAttribute("data-testid")).replace("apr5-row-", ""),
  );

/**
 * RFC4180 读取状态机（用例自带，非产品码）：引号内逗号/换行不分裂，
 * "" 还原成 "；引号外的 \r\n（或裸 \n）终止逻辑行；末尾换行不产生空行。
 */
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
      // \r 只在 \r\n 序列里出现；单独出现也按行尾处理。
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

/** 拦一次页面导出并走状态机解析（区别于 R182 的物理行 split）。 */
async function grabCsvGrid(): Promise<string[][]> {
  const captured: Blob[] = [];
  const orig = URL.createObjectURL;
  URL.createObjectURL = ((blob: Blob) => {
    captured.push(blob);
    return "blob:appr217";
  }) as typeof URL.createObjectURL;
  const clicks = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
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
  return parseCsv(await captured[0].text());
}

describe("R217 csv rfc4180 roundtrip (pure function)", () => {
  it("①② comma, quote and newline survive write-then-read verbatim; missing cells read back empty", () => {
    const mkRow = (over: Record<string, unknown>): ApprovalRow =>
      ({
        key: "ap_r1",
        rawId: "ap_r1",
        title: "plain",
        status: { label: "待处理" },
        risk: { label: "高风险" },
        clock: "2026-11-19 09:20",
        requestId: "req-r1",
        ...over,
      }) as unknown as ApprovalRow;

    const HAZARD = 'Budget, "Q4"\nUplift';
    const csv = buildApprovalsCsv([
      mkRow({ title: HAZARD }),
      mkRow({ key: "ap_r2", rawId: "ap_r2", title: "plain", clock: null, requestId: null }),
    ]);

    // 写出形态（与 R54 的正向断言同串，这里作为往返的前半段见证）。
    expect(csv).toContain('"Budget, ""Q4""\nUplift"');
    expect(csvEscape("plain")).toBe("plain");

    const grid = parseCsv(csv);
    expect(grid[0]).toEqual(["id", "title", "status", "risk", "updated_at", "correlation", "rid"]);
    // 换行被引号保护：逻辑行=表头+2 数据行，绝不因 title 内换行裂成 4 行。
    expect(grid.length, "logical rows: header + 2 data rows").toBe(3);
    expect(grid[1][1], "title 解析回原串逐字（逗号+双引号+换行）").toBe(HAZARD);
    expect(grid[1][0]).toBe("ap_r1");
    expect(grid[2][1]).toBe("plain");
    // ②缺值=空字段：解析回空串，不是「—」也不是 null。
    expect(grid[2][4], "updated_at 缺=空串").toBe("");
    expect(grid[2][6], "rid 缺=空串").toBe("");
    expect(csv).not.toContain("—");
    expect(csv).not.toContain("null");
  });
});

describe("R217 csv roundtrip (page level)", () => {
  const S1 = {
    approvalId: "ap_s1",
    title: '预算追加, "特别" 通道',
    status: "approved",
    riskLevel: "high",
    decidedAt: "2026-11-19T02:00:00Z",
    requestId: "req-s1-1",
    approvers: [{ userId: "human:7", name: "郑涛" }],
  };
  const S2 = {
    approvalId: "ap_s2",
    title: "密钥轮换",
    status: "approved",
    createdAt: "2026-11-18T01:00:00Z",
    // 缺 risk/decided/requestId：CSV 空字段侧由 ① 纯函数已锁，这里只做行数。
  };

  function serveRows(): void {
    api.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approvals")) return { items: [S1, S2] };
      return {};
    });
  }

  it("③ parsed title equals the on-screen row text, verbatim, same carriers", async () => {
    serveRows();
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await waitFor(() => rowIds().length === 2, "two rows");

    const grid = await grabCsvGrid();
    expect(grid[0][1]).toBe("title");
    const s1 = grid.find((r) => r[0] === "ap_s1");
    expect(s1, "csv row ap_s1").toBeTruthy();
    const screenTitle = (q("apv-trunc-row-title-ap_s1")?.textContent ?? "").trim();
    // 短标题（<60 字符）不截断：屏上文本=原值=CSV 解析值，三态同串。
    expect(screenTitle).toBe('预算追加, "特别" 通道');
    expect(s1![1], "CSV 解析回的 title==屏上文本逐字").toBe(screenTitle);

    // 行数==表体==apv5-count（R182 已锁三值，这里以「解析后」口径复证一行）。
    expect(grid.length - 1, "解析逻辑行数==屏上行数").toBe(rowIds().length);
    expect(q("apv5-count")?.textContent).toBe(String(rowIds().length));
  });

  it("④ export costs no extra fetch (roundtrip path keeps the list leg untouched)", async () => {
    serveRows();
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await waitFor(() => rowIds().length === 2, "two rows");
    const before = api.mock.calls.length;
    const grid = await grabCsvGrid();
    expect(grid.length).toBe(3);
    expect(api.mock.calls.length, "导出前后 fetchJSON 计数不变").toBe(before);
  });
});
