// @vitest-environment jsdom
/**
 * R252：审批导出列宽/截断与全文同源护栏（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款「已覆盖只回证据与缺口」）：
 *  - 工单②（含逗号/引号/换行的 title 或备注 RFC4180 往返逐字、逻辑行数不裂增）
 *    = approvals.csv.roundtrip.test.tsx it①（R217：HAZARD='Budget, "Q4"\nUplift'
 *    纯函数站 parseCsv 状态机回读 grid[1][1] toBe 原串、grid.length=3 不裂增）
 *    + it③（页面级逗号引号 title：CSV cells[1]==屏上==原串）+ CRLF 逐字对
 *    = approvals.csv.filename.crlf.test.tsx it②（R228）；换行在页面级 title
 *    由 model.humanSentence 折叠单空格（R217 现场裁决，非缺陷），备注列在 CSV
 *    七列契约中不存在（R107/R216 已点名）——均回证据不重写。
 *  - 屏上长值截断形态（60 字符+省略号、title 全文、复制给全文）行卡腿
 *    = approvals.detail.edge2.test.tsx it②（R216）与 history.test（R80）。
 * 本文件增量：
 *  ①同一超长（>120 字）title 行的「屏上截断 × 复制全文 × CSV 全文」三层同帧
 *    对照，CSV 不落截断省略号、复制标题段与 CSV title 列逐字相等（R216 未拦
 *    同站 blob）；
 *  ③筛选站（?status=approved）下导出仍给全文，且 CSV 数据行数==表体行数==
 *    apv5-count 三值相等、复制与导出零新增请求（长值×筛选组合站此前无锁）。
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

import ApprovalsHistoryModulePage from "./ApprovalsHistoryModulePage";
import { TRUNCATE_LIMIT } from "./views";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** 126 字符纯中文长标题：>120，不含逗号/引号/换行（②归 R217 证据，此站只测长度）。 */
const LONG_TITLE = "预算".repeat(63);

const X_LONG = {
  approvalId: "ap_xt1",
  title: LONG_TITLE,
  status: "approved",
  riskLevel: "high",
  createdAt: "2026-11-19T01:00:00Z",
  decidedAt: "2026-11-19T02:00:00Z",
  requestId: "req-xt-11112222",
};
const X_SHORT = {
  approvalId: "ap_xt2",
  title: "短标题一件",
  status: "approved",
  riskLevel: "low",
  createdAt: "2026-11-19T01:10:00Z",
  decidedAt: "2026-11-19T02:10:00Z",
  requestId: "req-xt-33334444",
};

function serveRows(): void {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) return {};
    if (u.includes("/api/approvals")) return { items: [X_LONG, X_SHORT] };
    return {};
  });
}

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

async function render(entry: string): Promise<void> {
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
  await waitFor(() => document.querySelectorAll(".animate-pulse").length === 0, "reads settled");
}

function q(testId: string): HTMLElement | null {
  return container?.querySelector(`[data-testid="${testId}"]`) ?? null;
}

function rowIds(): string[] {
  return Array.from(container?.querySelectorAll('[data-testid^="apr5-row-ap_xt"]') ?? []).map(
    (node) => node.getAttribute("data-testid")?.slice("apr5-row-".length) ?? "",
  );
}

function clicks(): number {
  return api.fetchJSON.mock.calls.length;
}

/** 点行末复制钮收文本；前置零新增请求锁。 */
async function copyRow(index: number): Promise<string> {
  const written: string[] = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (text: string) => {
        written.push(text);
        return Promise.resolve();
      },
    },
  });
  const before = clicks();
  const btn = q(`apr-row-copy-${index}`) as HTMLElement | null;
  expect(btn, `apr-row-copy-${index}`).toBeTruthy();
  await act(async () => {
    btn!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await waitFor(() => written.length === 1, "clipboard write");
  expect(clicks(), "复制不新增请求").toBe(before);
  return written[0];
}

/** 拦导出 Blob 收 CSV 逻辑行；内置导出不新增 fetch 锁。 */
async function grabCsvLines(): Promise<string[]> {
  const before = clicks();
  const captured: Blob[] = [];
  const orig = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  URL.createObjectURL = ((blob: Blob) => {
    captured.push(blob);
    return "blob:xt252";
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  const anchorClicks = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  try {
    const btn = q("apv7-export") as HTMLButtonElement | null;
    expect(btn, "export button").toBeTruthy();
    expect(btn!.disabled, "有行站导出可用").toBe(false);
    await act(async () => {
      btn!.click();
    });
  } finally {
    URL.createObjectURL = orig;
    URL.revokeObjectURL = origRevoke;
    anchorClicks.mockRestore();
  }
  expect(captured, "导出生成 Blob").toHaveLength(1);
  expect(clicks(), "导出不新增请求").toBe(before);
  const text = await captured[0].text();
  return text.replace(/^\uFEFF/, "").split("\r\n").filter((l) => l !== "");
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  api.fetchJSON.mockReset();
});

describe("R252 approvals export truncation guards", () => {
  it("①一个超长 title 行的屏上截断、复制全文与 CSV 全文三层同帧不打架", async () => {
    serveRows();
    await render("/approvals?tab=history");
    expect(rowIds()).toEqual(["ap_xt1", "ap_xt2"]);
    expect(LONG_TITLE.length).toBeGreaterThan(120);

    // 屏上：60 字符截断+省略号（R80 契约复验），title 属性给全文。
    const shown = q("apv-trunc-row-title-ap_xt1");
    expect(shown, "行卡长标题载体").toBeTruthy();
    expect(shown!.textContent).toBe(`${LONG_TITLE.slice(0, TRUNCATE_LIMIT - 1)}…`);
    expect(shown!.getAttribute("title")).toBe(LONG_TITLE);

    // 复制：标题段给折叠全文，无省略号、无截断。
    const copied = await copyRow(0);
    const titleLine = copied
      .split("\n")
      .find((line) => line.startsWith("标题："));
    expect(titleLine, "复制标题段").toBeDefined();
    expect(titleLine).toBe(`标题：${LONG_TITLE}`);
    expect(copied.includes("…")).toBe(false);

    // 导出：CSV title 列与复制段逐字相等，且全文不截断（无省略号）。
    const lines = await grabCsvLines();
    expect(lines[0]).toBe("id,title,status,risk,updated_at,correlation,rid");
    expect(lines).toHaveLength(3); // 表头 + 2 数据行
    const longRow = lines[1].split(",");
    expect(longRow[0]).toBe("ap_xt1");
    expect(longRow[1]).toBe(LONG_TITLE);
    expect(lines.join("\n").includes("…")).toBe(false);
    // 三层同源：复制标题段（去前缀）===CSV 列===title 属性全文。
    expect(titleLine!.slice("标题：".length)).toBe(longRow[1]);
  });

  it("③筛选站（?status=approved）下导出仍给全文且行数三值同步", async () => {
    serveRows();
    await render("/approvals?tab=history&status=approved");

    // 服务端筛选站现状：请求带 status=approved（R79/R98 家族契约复验）。
    const lastCall = String(api.fetchJSON.mock.calls.at(-1)?.[0] ?? "");
    expect(lastCall).toContain("status=approved");

    const rows = rowIds();
    expect(rows).toEqual(["ap_xt1", "ap_xt2"]);
    const count = q("apv5-count");
    expect(count, "apv5-count 有行站渲染").toBeTruthy();
    expect(count!.textContent).toBe(String(rows.length));

    const lines = await grabCsvLines();
    const dataRows = lines.slice(1);
    expect(dataRows).toHaveLength(rows.length);
    expect(dataRows.length).toBe(Number(count!.textContent));
    // 筛选后 CSV 仍给全文：长标题行 title 列逐字、无省略号。
    expect(dataRows[0].split(",")[1]).toBe(LONG_TITLE);
    expect(lines.join("\n").includes("…")).toBe(false);

    // 复制与导出都零新增请求（grabCsvLines/copyRow 内置前后计数锁）。
    const before = clicks();
    const copied = await copyRow(1);
    expect(copied).toContain("标题：短标题一件");
    expect(clicks()).toBe(before);
  });
});
