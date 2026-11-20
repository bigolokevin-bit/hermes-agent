// @vitest-environment jsdom
/**
 * R221 — /approvals 详情缺值四形态与复制逐字（纯测试，零产品改动）。
 *
 * 四形态=缺 decided_at / 缺 risk / 缺 reason（事由）/ 缺 correlation（审批单号），
 * 逐一对照四个载体：列表行卡、apr-row-copy-* 六段、右侧抽屉（apr5-detail）、
 * 导出 CSV（apv7-export 拦截 blob）。
 *
 * 现场口径（当轮 grep 实读，禁按工单旧句臆造）：
 *  - 屏上金额缺值句 MISSING_AMOUNT = 「服务未提供该数值」（views.tsx L69；
 *    工单叙述里的「后台没有提供金额」与现场不符，按现场锁）。
 *  - 屏上时间缺值：行卡走 RelativeTime → 「该字段未返回」；抽屉决定时间走
 *    Field → 「—」+ title MISSING_TIME（两载体各按现状口径，禁互窜）。
 *  - 复制六段（RowCopy.tsx）：更新时间缺=「—」、短码缺=「—」、单号缺=「—」。
 *  - CSV（QueueCsvExport L25-45）：updated_at/requestId/correlation/id 缺=空字段；
 *    risk 缺=人话「未标注风险」（R219 现状契约）；七列无 reason/金额列——
 *    「四处」里 CSV 与复制对 reason 均为契约性缺位，本单锁缺位本身。
 *
 * 已覆盖只回证据，不写重复用例：
 *  R162 approvals.detail.copy.test.tsx it L161/L195/L215（六段逐字+抽屉开零请求
 *    +缺 risk/decided/requestId 同句不泄 id）；
 *  approvals.detail.fields2.test.tsx it②（开→关→再开请求与行序矩阵=工单③）；
 *  R219 approvals.columns.lock.test.tsx it①（七列列序冻结+缺值 [4]/[6] 空）；
 *  R217/R107/R54（转义/空集 gates/同源计数）。
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
import { riskView, statusView } from "@/modules/approvals/model";

const mock = vi.mocked(fetchJSON);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const HOUR = 3_600_000;
const isoAgo = (ms: number) => new Date(Date.now() - ms).toISOString();

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

const render = (entry = "/approvals?tab=history") =>
  renderInto(entry, <ApprovalsHistoryModulePage />);

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);

/** dl 里按 label 找值格（Field=dt+dd，无独立 testid 的行卡/抽屉金额与提交位）。 */
const fieldByLabel = (root: Element | null, label: string): HTMLElement | null => {
  if (!root) return null;
  for (const dt of Array.from(root.querySelectorAll("dt"))) {
    if ((dt.textContent ?? "").trim() === label) {
      return dt.nextElementSibling as HTMLElement | null;
    }
  }
  return null;
};

// 缺 decided_at / risk / reason / 金额 / requestId 四形缺一不剩（correlation 有=ap_m2）。
const M2 = {
  approvalId: "ap_m2",
  title: "缺值矩阵单",
  status: "approved",
  approvers: [{ userId: "human:7", name: "郑涛" }],
  createdAt: isoAgo(4 * HOUR),
  // 故意无 riskLevel / decidedAt / reasonText / amountUsd / requestId。
};

// 全缺组合：连 approvalId（correlation/id 列）也没有——key 兜底 approval-<i>。
const M1 = {
  title: "全缺组合单",
  status: "approved",
};

/** 列表行=详情读口=同一 body。 */
function serve(rows: unknown[]) {
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent(u.split("id=")[1] ?? "");
      const row = (rows as { approvalId?: string }[]).find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("/api/approvals")) return { items: rows };
    return {};
  });
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

const openDetail = async (id: string) => {
  const card = q(`apr5-row-${id}`) as HTMLElement | null;
  expect(card, `row ${id}`).toBeTruthy();
  await act(async () => {
    card!.click();
  });
  await waitFor(() => !!q("apr5-detail"), `detail of ${id}`);
};

const clickCopy = async (index: number): Promise<string> => {
  const before = written.length;
  const btn = q(`apr-row-copy-${index}`) as HTMLButtonElement | null;
  expect(btn, `apr-row-copy-${index}`).toBeTruthy();
  await act(async () => {
    btn!.click();
  });
  await waitFor(() => written.length > before, "copy written");
  return written[written.length - 1];
};

/** 拦导出 blob → 解析成单元格矩阵（无引号数据的简单 split）。 */
async function grabCsvGrid(): Promise<string[][]> {
  let blob: Blob | null = null;
  const origCreate = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  const origClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (b: Blob) => {
    blob = b;
    return "blob:csv";
  };
  URL.revokeObjectURL = () => {};
  Object.defineProperty(HTMLAnchorElement.prototype, "click", {
    value: () => {},
    configurable: true,
    writable: true,
  });
  try {
    const btn = q("apv7-export") as HTMLButtonElement | null;
    expect(btn, "apv7-export").toBeTruthy();
    expect(btn!.disabled, "export enabled").toBe(false);
    await act(async () => {
      btn!.click();
    });
    await waitFor(() => !!blob, "csv captured");
  } finally {
    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
    Object.defineProperty(HTMLAnchorElement.prototype, "click", {
      value: origClick,
      configurable: true,
      writable: true,
    });
  }
  const text = await (blob as Blob).text();
  return text
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .filter((line) => line !== "")
    .map((line) => line.split(","));
}

describe("R221 approvals missing-field four shapes across row/copy/drawer/CSV", () => {
  it("缺 decided_at/risk/reason/金额 的四形态在四个载体各按既定口径逐字", async () => {
    stubClipboard();
    serve([M2]);
    await render();

    // —— 载体①列表行卡 ——
    const row = q("apr5-row-ap_m2");
    expect(row, "row ap_m2").toBeTruthy();
    const amountCell = fieldByLabel(row, "涉及金额");
    expect(amountCell?.textContent ?? "", "行金额文本").toBe("—");
    expect(amountCell?.getAttribute("title"), "行金额 title").toBe("服务未提供该数值");
    expect(q("apv-time-row-ap_m2")?.textContent ?? "", "行处理时间缺值句").toBe("该字段未返回");
    expect(q("apv-trunc-row-reason-ap_m2"), "事由段不渲染").toBeNull();

    // —— 载体②apr-row-copy 六段 ——
    const text = await clickCopy(0);
    const lines = text.split("\n");
    expect(lines[0], "单号段").toBe("单号：ap_m2");
    expect(lines[2], "状态段与徽标同源").toBe(`状态：${statusView("approved").label}`);
    expect(lines[3], "风险段").toBe(`风险：${riskView(null).label}`);
    expect(lines[3], "风险缺值人话").toBe("风险：未标注风险");
    expect(lines[4], "更新时间段").toBe("更新时间：—");
    expect(lines[5], "短码段").toBe("短码：—");
    expect(text, "六段无引擎词").not.toMatch(/undefined|null|NaN/);
    expect(text, "六段无 rid 全串").not.toContain("req-");

    // —— 载体③抽屉 ——
    await openDetail("ap_m2");
    const drawer = q("apr5-detail");
    expect(drawer, "drawer").toBeTruthy();
    const decidedCell = fieldByLabel(drawer, "决定时间");
    expect(decidedCell?.textContent ?? "", "抽屉决定时间缺值").toBe("—");
    expect(decidedCell?.getAttribute("title"), "抽屉决定时间 title").toBe("服务未提供该时间");
    const drawerAmount = fieldByLabel(drawer, "涉及金额");
    expect(drawerAmount?.textContent ?? "", "抽屉金额缺值").toBe("—");
    expect(drawerAmount?.getAttribute("title"), "抽屉金额 title").toBe("服务未提供该数值");
    const verdictCell = fieldByLabel(drawer, "结论");
    expect(verdictCell?.textContent ?? "", "无决策的结论位").toBe("—");
    expect(q("apd9-correlation")?.textContent ?? "", "抽屉 rid 缺位句").toContain("该字段未返回");

    // —— 载体④导出 CSV ——
    const grid = await grabCsvGrid();
    expect(grid[0].join(","), "列头七列").toBe("id,title,status,risk,updated_at,correlation,rid");
    const cell = grid[1];
    expect(cell?.[0], "id 列").toBe("ap_m2");
    expect(cell?.[3], "risk 列=人话（R219 现状契约）").toBe("未标注风险");
    expect(cell?.[4], "updated_at 缺=空字段").toBe("");
    expect(cell?.[5], "correlation 列=单号恒等").toBe("ap_m2");
    expect(cell?.[6], "rid 缺=空字段").toBe("");
    const csvAll = grid.map((r) => r.join(",")).join("\n");
    expect(csvAll, "CSV 无引擎词").not.toMatch(/undefined|null/);
    expect(csvAll, "CSV 不写破折号进数据").not.toMatch(/,\u2014(,|$)/);
    expect(csvAll, "CSV 无 reason/金额列").not.toContain("事由");
  });

  it("全缺组合行（连单号也没有）走完四载体不抛错且无 undefined/null 上屏", async () => {
    stubClipboard();
    serve([M1]);
    await render();

    // key 兜底 approval-0：行卡与 toggle 都在，不抛错。
    const row = q("apr5-row-approval-0");
    expect(row, "全缺行按兜底键渲染").toBeTruthy();

    const text = await clickCopy(0);
    expect(text.split("\n")[0], "单号缺=—").toBe("单号：—");
    expect(text, "无引擎词").not.toMatch(/undefined|null|NaN/);

    const grid = await grabCsvGrid();
    expect(grid[1]?.[0], "id 缺=空字段").toBe("");
    expect(grid[1]?.[4], "updated_at 空").toBe("");
    expect(grid[1]?.[5], "correlation 缺=空字段").toBe("");
    expect(grid[1]?.[6], "rid 空").toBe("");
    const csvAll = grid.map((r) => r.join(",")).join("\n");
    expect(csvAll, "CSV 无引擎词").not.toMatch(/undefined|null/);

    expect(document.body.textContent, "屏上无引擎词").not.toMatch(/undefined|null/);
    expect(q("apr5-detail"), "本用例不开抽屉（请求矩阵由 fields2 it② 锁）").toBeNull();
  });

  it("?status=approved 服务端过滤后的缺值行仍是同一套句子", async () => {
    stubClipboard();
    serve([M2]);
    await render("/approvals?tab=history&status=approved");

    expect(q("apr5-row-ap_m2"), "深链下缺值行在屏").toBeTruthy();
    const text = await clickCopy(0);
    expect(text.split("\n")[3], "风险句一致").toBe("风险：未标注风险");
    expect(text.split("\n")[4], "更新时间句一致").toBe("更新时间：—");
    expect(text.split("\n")[5], "短码句一致").toBe("短码：—");
    const grid = await grabCsvGrid();
    expect(grid[1]?.[4], "CSV updated_at 空字段一致").toBe("");
    expect(grid[1]?.[6], "CSV rid 空字段一致").toBe("");
    expect(q("apv5-count")?.textContent ?? "", "计数位与行集同源").toBe(
      String(document.querySelectorAll('[data-testid^="apr5-row-ap_"]').length),
    );
  });
});
