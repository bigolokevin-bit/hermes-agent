// @vitest-environment jsdom
/**
 * R226 — 审批详情缺字段与超长值护栏（纯测试，零产品改动）。
 *
 * 现场裁决（禁臆造）：工单①「三形态各自『—』」——抽屉里三个缺位各有现网句，
 * 且都已在别处锁过单载体，本单锁的是同一帧同框：意见缺=「未填」
 * （fields2 it②已锁两载体）、关联 run/task 缺=「该段无记录」+原因
 * （apd6-link-run-none/-task-none，此前从未测）、rid 缺=「该字段未返回」
 * （R99 copy 单点已锁字面）。统一「—」并不存在于抽屉，按现状点名。
 * 工单②「折行不撑破」：R80 的产品答案是 60 字符截断+title 全文（并非 CSS
 * 折行），history.test:1902 已在行卡锁过；本单补 >120 字符的集中形态，
 * 并锁 apr-row-copy 给全文标题、短码段只给后 8 位（R127 六段契约）、
 * 抽屉内 rid 显示全文可复制（R168/R219 已锁 req 短值，超长形态此处补）。
 *
 * 已覆盖只回证据，不写重复用例：R127（六段+短码不泄全串）、R162（抽屉开态
 * 同行钮逐字）、R168/R219（rid 矩阵与 CSV 空字段）、R99（缺值句 stateCopy
 * 单点）、R80（截断 truncateDisplay/title 全文，history.test:1902）、
 * fields2 it④=工单③全量已锁（可读句+可复制 rid+列表行保留+list 腿不变+
 * 重试恰 +1+错误锚消失）、fields2 it③≈工单④主体（各开恰 1 次详情读、
 * 关闭零请求、行序保持）——本单④只补排序态在开合后不变的一格。
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
import { TRUNCATE_LIMIT } from "@/modules/approvals/views";

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

const render = (entry = "/approvals?tab=history") => renderInto(entry, <ApprovalsHistoryModulePage />);

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const text = (id: string): string => q(id)?.textContent ?? "";

function stubClipboard(written: string[]): void {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (value: string) => {
        written.push(value);
        return Promise.resolve();
      },
    },
  });
}

// ①缺位三形态：无 requestId、无关联、意见未填。
const E1 = {
  approvalId: "ap_e21",
  title: "缺位集中单",
  status: "approved",
  riskLevel: "medium",
  approvers: [{ userId: "human:7", name: "郑涛" }],
  decisions: [
    {
      approver: "human:7",
      name: "郑涛",
      decision: "approve",
      at: isoAgo(2 * HOUR),
      // comment 缺 —— 现网句「未填」。
    },
  ],
  createdAt: isoAgo(4 * HOUR),
  decidedAt: isoAgo(1 * HOUR),
  // 无 requestId / runId / taskId。
};

// ②超长形态：标题 126 字符、requestId 74 字符。
const LONG_TITLE = "预算".repeat(63);
const LONG_RID = `req-${"x".repeat(70)}`;
const E2 = {
  approvalId: "ap_e22",
  title: LONG_TITLE,
  status: "approved",
  riskLevel: "low",
  approvers: [{ userId: "human:9", name: "阿朝" }],
  requestId: LONG_RID,
  decisions: [{ approver: "human:9", name: "阿朝", decision: "approve", at: isoAgo(2 * HOUR), comment: "同意" }],
  createdAt: isoAgo(4 * HOUR),
  decidedAt: isoAgo(1 * HOUR),
};

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

const openDetail = async (id: string) => {
  const card = q(`apr5-row-${id}`) as HTMLElement | null;
  expect(card, `row ${id}`).toBeTruthy();
  await act(async () => {
    card!.click();
  });
  await waitFor(() => !!q("apr5-detail"), `detail of ${id}`);
};

describe("R226 approvals detail edge — one frame per gap and per length", () => {
  it("① the drawer shows each gap carrier its own wording, never a req- residue", async () => {
    serve([E1, E2]);
    await render();
    await openDetail("ap_e21");

    const drawer = text("apr5-detail");
    // 意见缺=未填；关联 run/task 缺=该段无记录+原因；两载体同帧在场。
    expect(drawer).toContain("意见：未填");
    expect(q("apd6-link-run-none"), "run gap carrier").toBeTruthy();
    expect(q("apd6-link-task-none"), "task gap carrier").toBeTruthy();
    expect(text("apd6-link-run-none")).toContain("该段无记录");
    expect(text("apd6-link-task-none")).toContain("该段无记录");
    // 原因句在 NoSeg 的 title 上（屏上只显兜底词），同帧核对两条原因。
    expect(q("apd6-link-run-none")?.querySelector("span")?.getAttribute("title")).toBe(
      "服务返回的单据没有带关联运行编号。",
    );
    expect(q("apd6-link-task-none")?.querySelector("span")?.getAttribute("title")).toBe(
      "服务返回的单据没有带关联任务编号。",
    );
    // rid 缺位：屏上没有 req- 前缀残留，也没有引擎词。
    expect(drawer).not.toContain("req-");
    expect(drawer).not.toMatch(/undefined|null|NaN/);
  });

  it("② >120-char title clips at the shared limit with the full value in title, and the row copy keeps it whole", async () => {
    serve([E1, E2]);
    await render();

    // 行卡载体：60 字符截断（R80 单点），title 全文。
    const clip = TRUNCATE_LIMIT - 1;
    expect(text("apv-trunc-row-title-ap_e22")).toBe(`${LONG_TITLE.slice(0, clip)}…`);
    expect(q("apv-trunc-row-title-ap_e22")?.getAttribute("title")).toBe(LONG_TITLE);

    const written: string[] = [];
    stubClipboard(written);
    const btn = q("apr-row-copy-1") as HTMLButtonElement | null;
    expect(btn, "row copy button for the long row").toBeTruthy();
    await act(async () => {
      btn!.click();
    });
    await waitFor(() => written.length === 1, "copy written");
    expect(written[0], "复制给全文标题").toContain(LONG_TITLE);
    // 短码段只给后 8 位（R127 六段契约），rid 全串不落复制文本。
    expect(written[0]).toContain(`短码：${LONG_RID.slice(-8)}`);
    expect(written[0]).not.toContain(LONG_RID);

    // 抽屉：长 rid 全文显示在复制载体上，标题仍按单点截断+title 全文。
    await openDetail("ap_e22");
    const drawer = text("apr5-detail");
    expect(drawer).toContain(LONG_RID);
    expect(q("apd5-field-request-id")?.textContent ?? text("apd5-request-id")).toContain(LONG_RID.slice(0, 20));
  });

  it("④ a sort state survives an open/close cycle at zero extra requests", async () => {
    serve([E1, E2]);
    await render();

    const sort = q("apv-sort-title") as HTMLButtonElement | null;
    expect(sort, "sort control").toBeTruthy();
    await act(async () => {
      sort!.click();
    });
    await waitFor(() => sort!.getAttribute("aria-sort") === "ascending", "asc armed");
    const orderBefore = [...document.querySelectorAll("[data-testid^='apr5-row-ap_']")].map(
      (el) => el.getAttribute("data-testid"),
    );

    await openDetail("ap_e21");
    const callsAfterOpen = mock.mock.calls.length;
    const btn = q("apd7-back") as HTMLButtonElement | null;
    expect(btn, "back to list").toBeTruthy();
    await act(async () => {
      btn!.click();
    });
    await waitFor(() => !q("apr5-detail"), "drawer closed");

    expect(mock.mock.calls.length, "closing asks for nothing").toBe(callsAfterOpen);
    expect(sort!.getAttribute("aria-sort"), "sort state kept").toBe("ascending");
    const orderAfter = [...document.querySelectorAll("[data-testid^='apr5-row-ap_']")].map(
      (el) => el.getAttribute("data-testid"),
    );
    expect(orderAfter).toEqual(orderBefore);
  });
});
