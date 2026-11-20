// @vitest-environment jsdom
/**
 * R182 — 审批列表导出与筛选同源护栏（纯测试，禁改产品行为）。
 *
 * 已覆盖只回证据，不写重复用例：
 * ④空集导出 disabled+原因句 = ApprovalsHistoryModulePage.test.tsx（R54
 *   「disables with a stated reason when nothing is loaded」）+ R72 gates
 *   矩阵（approvals.paging/crosssurface 族）；导出前后 fetchJSON 不变 =
 *   R54/R168 it①；七列契约与 correlation/rid 同源 = R107；window 参
 *   =apv5-filter-window 恒 disabled 摆设（不进请求/不回填/不改写 URL）=
 *   R129/R139 裁决；apr-row-copy-<i> 六段契约与排序同序 = R127/R162。
 *
 * 现场裁决（禁臆造第二套）：
 * ①工单写「每行 status 列逐字为 approved」——现场 CSV status 列=屏上状态
 *   人话 label（buildApprovalsCsv: row.status.label，与表格渲染同一值），
 *   不是枚举原词。本护栏按现场锁：CSV 列==该行屏上 Badge 文本逐字。
 * ③工单写「缺 risk/decided/rid 行 CSV 写空字段」——现场 risk 缺值仍写
 *   「未标注风险」人话（risk.label 恒有词），updated_at/rid 缺值=空字段。
 *   本护栏按现状锁三列各自的真实形态，并注明 risk 与另两列口径不同。
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
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_e"]')).map((el) =>
    String(el.getAttribute("data-testid")).replace("apr5-row-", ""),
  );
/** 行头部的状态徽标（标题钮的同级最后一个元素——approvals.parity 同款）。 */
const rowBadge = (id: string): string => {
  const title = document.querySelector(`[data-testid="apv-trunc-row-title-${id}"]`);
  const header = title?.closest("button")?.parentElement;
  return (header?.lastElementChild?.textContent ?? "").trim();
};
const urlsAll = (): string[] => api.mock.calls.map((c) => String(c[0]));

const DEEP = "/approvals?tab=history&status=approved&window=7d";

// 三条已批准的行：E2 缺 risk/decidedAt/requestId —— 双载体对照主角。
const E1 = {
  approvalId: "ap_e1",
  title: "渠道发布",
  status: "approved",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  requestId: "req-e1-1",
  approvers: [{ userId: "human:7", name: "郑涛" }],
};
const E2 = {
  approvalId: "ap_e2",
  title: "密钥轮换",
  status: "approved",
  createdAt: "2026-11-18T01:00:00Z",
  // 无 riskLevel、无 decidedAt/closedAt/updatedAt、无 requestId。
};
const E3 = {
  approvalId: "ap_e3",
  title: "预算复议",
  status: "approved",
  riskLevel: "low",
  decidedAt: "2026-11-19T03:00:00Z",
  requestId: "req-e3-3",
};
const PAGES = [E1, E2, E3];

function serveApproved(): void {
  api.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = PAGES.find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("/api/approvals")) return { items: PAGES };
    return {};
  });
}

/** 拦一次导出：返回 CSV 的非空行（首行=表头）。 */
async function grabCsvLines(): Promise<string[]> {
  const captured: Blob[] = [];
  const orig = URL.createObjectURL;
  URL.createObjectURL = ((blob: Blob) => {
    captured.push(blob);
    return "blob:appr182";
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
  const text = await captured[0].text();
  return text.split("\r\n").filter((l) => l !== "");
}

function stubClipboard(written: string[], reject = false): void {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (t: string) => (reject ? Promise.reject(new Error("denied")) : Promise.resolve())
        .then(() => {
          if (!reject) written.push(t);
        }),
    },
  });
}

const splitCells = (line: string): string[] => line.split(",");

describe("R182 export mirrors the filtered view", () => {
  it("deep ?status=approved&window=7d: CSV rows == table rows == apv5-count, status column equals the on-screen label", async () => {
    serveApproved();
    await renderInto(DEEP, <ApprovalsHistoryModulePage />);
    await waitFor(() => rowIds().length === 3, "three approved rows");

    // window 是摆设：请求带 status=approved、从不带 window=（R129/R139 现场
    // 裁决的集中复锁——请求腿与导出腿同用这一行集）。
    const leg = urlsAll().filter((u) => u.includes("/api/approvals"));
    expect(leg.length).toBeGreaterThan(0);
    expect(leg.every((u) => u.includes("status=approved")), leg.join("|")).toBe(true);
    expect(leg.every((u) => !u.includes("window=")), leg.join("|")).toBe(true);

    const csv = await grabCsvLines();
    expect(csv[0]).toBe("id,title,status,risk,updated_at,correlation,rid");
    expect(csv.length - 1, "CSV 数据行数==屏上行数").toBe(rowIds().length);
    expect(q("apv5-count")?.textContent, "apv5-count==行数").toBe(String(rowIds().length));
    expect(q("apv7-export-count")?.textContent).toBe(`共 ${rowIds().length} 行`);

    // 每行 status 列==该行屏上状态人话（现场裁决：非枚举原词 approved）。
    for (const id of rowIds()) {
      const row = csv.find((l) => l.startsWith(`${id},`));
      expect(row, `csv row ${id}`).toBeTruthy();
      const cells = splitCells(row!);
      const badge = rowBadge(id);
      expect(badge.length, "屏上状态人话非空").toBeGreaterThan(0);
      expect(cells[2], `CSV status 列==屏上 label（${id}）`).toBe(badge);
      // 行集确实全部来自 status=approved 筛选腿（第三列是人话不等于词
      // approved——按现场锁「同一值」，不锁字面）。
      expect(cells[2]).not.toBe("");
    }
  });

  it("the CSV obeys the current sort: its first data row is the first on-screen row", async () => {
    serveApproved();
    await renderInto(`${DEEP}&asort=title&adir=asc`, <ApprovalsHistoryModulePage />);
    await waitFor(() => rowIds().length === 3, "rows ready");
    const first = rowIds()[0];
    const before = api.mock.calls.length;
    const csv = await grabCsvLines();
    expect(splitCells(csv[1])[0], "CSV 首数据行==屏上首行审批单号").toBe(first);
    // 屏上次行同样跟随。
    const second = rowIds()[1];
    expect(splitCells(csv[2])[0]).toBe(second);
    expect(api.mock.calls.length, "导出不取数、排序不另发请求（本地维=R71 契约）").toBe(before);
  });

  it("one row, two carriers: missing updated_at/rid are empty CSV fields while the copy shows 「—」; missing risk keeps its 人话", async () => {
    serveApproved();
    const written: string[] = [];
    stubClipboard(written);
    await renderInto(DEEP, <ApprovalsHistoryModulePage />);
    await waitFor(() => rowIds().length === 3, "rows ready");

    const idx = rowIds().indexOf("ap_e2");
    expect(idx, "E2 在屏上").toBeGreaterThan(-1);
    const copyBtn = q(`apr-row-copy-${idx}`) as HTMLButtonElement | null;
    expect(copyBtn, "E2 行复制钮随行序").toBeTruthy();
    const fetchBefore = api.mock.calls.length;
    await act(async () => {
      copyBtn!.click();
    });
    await waitFor(() => written.length === 1, "copy written");
    const segments = written[0].split("\n");
    expect(segments.some((s) => s === "更新时间：—"), `复制段现值: ${segments.join(" | ")}`).toBe(true);
    expect(segments.some((s) => s === "短码：—")).toBe(true);
    expect(written[0], "复制文本不带 rid 全串或 undefined").not.toMatch(/undefined|null|req-/);
    expect(api.mock.calls.length, "复制零请求").toBe(fetchBefore);

    const csv = await grabCsvLines();
    const line = csv.find((l) => l.startsWith("ap_e2,"));
    expect(line, "CSV 含 E2").toBeTruthy();
    const cells = splitCells(line!);
    expect(cells[4], "updated_at 缺=空字段（不写 —，R107）").toBe("");
    expect(cells[6], "rid 缺=空字段（不写缺值句，R107）").toBe("");
    expect(cells[3], "risk 缺值=「未标注风险」人话（现场口径与 updated_at 不同，非空字段）").toBe("未标注风险");
    // 对照：有值的 E1 同行两载体都不空。
    const e1 = splitCells(csv.find((l) => l.startsWith("ap_e1,"))!);
    expect(e1[4]).not.toBe("");
    expect(e1[6]).toBe("req-e1-1");
  });
});
