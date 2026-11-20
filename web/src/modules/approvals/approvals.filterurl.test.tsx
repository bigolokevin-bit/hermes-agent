// @vitest-environment jsdom
/**
 * R98 — 审批筛选 URL 契约护栏（纯测试，零产品改动）。
 *
 * 锁四件事：
 * ①URL 生效筛选参 == chips 集合 == 实际请求 query 的同源契约：
 *   本地参（q/actor/since/risk/asort+adir）只进 chips 不进请求，
 *   status 是唯一服务端维；asort+adir 合成一枚 sort chip；cursor 不进 chips。
 * ②非法值：chips 原值上屏并标「该值未被识别」；since/risk 非法=本地不过滤
 *   （落回默认读取）。status 非法=按 R44 显式契约原样透传读取并出提示句
 *   （既有锁：approvals-history.test「keeps an unknown state verbatim」）——
 *   工单口径「落回默认读取」与 R44 契约冲突，本护栏按现状记录，差异上报 L0，
 *   不静默改破既有契约。
 * ③移除 status chip=refetch 恰一次且新请求无 status=/cursor=（回第一页）；
 *   移除本地维 chip=零请求。
 * ④pending tab 进入即移除 status（R93b）且不引发额外请求。
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
import ApprovalsPendingModulePage from "@/modules/approvals/ApprovalsPendingModulePage";
import { FILTER_PARAM_KEYS } from "@/modules/approvals/FilterReset";
import { chipsFor } from "@/modules/approvals/FilterSummary";

const mock = vi.mocked(fetchJSON);

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
  mock.mockImplementation(async (url: string) => serveRows(String(url)));
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
const urls = (): string[] => mock.mock.calls.map((c) => String(c[0]));
const listCalls = (): number => urls().filter((u) => u.includes("/api/approvals")).length;
const chipKeys = (): string[] =>
  Array.from(document.querySelectorAll('[data-testid^="apv-chip-"]'))
    .map((el) => el.getAttribute("data-testid") ?? "")
    .filter((t) => t.length > 0 && !t.includes("-remove-"))
    .map((t) => t.replace("apv-chip-", ""));
const removeChip = async (key: string): Promise<void> => {
  const btn = q(`apv-chip-remove-${key}`) as HTMLButtonElement | null;
  expect(btn, `chip remove ${key}`).toBeTruthy();
  await act(async () => {
    btn!.click();
  });
  await act(async () => {});
};

const isoAgo = (ms: number) => new Date(Date.now() - ms).toISOString();
const HOUR = 3_600_000;

// 夹具：q 检索词 zz 必须能在行字段上命中（R88/R94 坑：检索词字段必含）
const ROWS = {
  items: [
    {
      approvalId: "ap_f1",
      title: "配置回滚 zz",
      status: "pending",
      riskLevel: "high",
      createdAt: isoAgo(2 * HOUR),
      approvers: [{ userId: "human:7", name: "郑涛" }],
    },
    {
      approvalId: "ap_f2",
      title: "预算上调申请 zz",
      status: "approved",
      createdAt: isoAgo(72 * HOUR),
      decidedAt: isoAgo(70 * HOUR),
      approvers: [{ userId: "human:9" }],
    },
  ],
};

const serveRows = async (url: string): Promise<unknown> => {
  const u = String(url);
  if (u.includes("/api/approval?id=")) return {};
  return ROWS;
};

const ALL_PARAMS =
  "/approvals?tab=history&status=pending&q=zz&actor=human%3A7&since=24h&risk=high&asort=title&adir=desc&cursor=abc";

describe("R98 filter-url contract: params == chips == request query", () => {
  it("chips mirror the URL dimensions; only status reaches the request; sort is one chip; cursor is not a chip", async () => {
    await renderInto(ALL_PARAMS, <ApprovalsHistoryModulePage />);
    // chips 集合（本地维也在=生效于屏上）
    expect(chipKeys().sort()).toEqual(["actor", "q", "risk", "since", "sort", "status"]);
    // 纯函数侧：remove 摊平集合 == FILTER_PARAM_KEYS（集合相等，非子集）
    const params = new URLSearchParams(ALL_PARAMS.split("?")[1]);
    expect(chipsFor(params).flatMap((chip) => chip.remove).sort()).toEqual(
      [...FILTER_PARAM_KEYS].sort(),
    );
    // 实际请求 query：只有 status（服务端维）+ limit；本地参与 cursor 不上请求
    const first = urls().find((u) => u.includes("/api/approvals"));
    expect(first).toBeTruthy();
    expect(first).toContain("status=pending");
    for (const local of ["q=zz", "actor=", "since=", "risk=", "asort=", "adir=", "cursor="]) {
      expect(first, `${local} must not reach the request`).not.toContain(local);
    }
  });

  it("unknown values keep their text on the chip and are flagged 未被识别; local dims fall back to no-filter", async () => {
    await renderInto(
      "/approvals?tab=history&since=lastweek&risk=purple",
      <ApprovalsHistoryModulePage />,
    );
    const sinceChip = q("apv-chip-since");
    expect(sinceChip?.textContent).toContain("lastweek");
    expect(sinceChip?.getAttribute("title")).toContain("该值未被识别");
    const riskChip = q("apv-chip-risk");
    expect(riskChip?.textContent).toContain("purple");
    expect(riskChip?.getAttribute("title")).toContain("该值未被识别");
    // 非法本地维=不过滤：两行原样在屏（落回默认读取）
    expect(document.querySelectorAll('[data-testid^="apr5-row-ap_"]').length).toBe(2);
  });

  it("unknown status follows the explicit R44 contract: verbatim in URL, chip and request, with the stated warning (deviation from 落回默认 flagged to L0, not silently changed)", async () => {
    await renderInto("/approvals?tab=history&status=purple", <ApprovalsHistoryModulePage />);
    const chip = q("apv-chip-status");
    expect(chip?.textContent).toContain("purple");
    expect(chip?.getAttribute("title")).toContain("该值未被识别");
    // R44 既有契约（approvals-history.test「keeps an unknown state verbatim」）：
    // 原样透传给读口 + 屏上有「不在已知的八种结果里」提示句，不静默吞参。
    expect(urls().find((u) => u.includes("/api/approvals"))).toContain("status=purple");
    expect(document.body.textContent).toContain("这个筛选值不在已知的八种结果里");
  });

  it("removing the status chip refetches exactly once without status/cursor; local chips refetch nothing", async () => {
    await renderInto(ALL_PARAMS, <ApprovalsHistoryModulePage />);
    const beforeStatus = listCalls();
    await removeChip("status");
    await waitFor(() => listCalls() === beforeStatus + 1, "status removal refetches once");
    const fresh = urls().slice(beforeStatus).filter((u) => u.includes("/api/approvals"));
    expect(fresh).toHaveLength(1);
    expect(fresh[0]).not.toContain("status=");
    expect(fresh[0], "first page: no stale cursor").not.toContain("cursor=");
    expect(q("apv-chip-status"), "status chip gone").toBeNull();
    // 本地维逐个移除=零请求（q 移除后 status 还在=列表仍服务端过滤态）
    const settled = listCalls();
    for (const key of ["risk", "since", "actor", "sort"]) {
      await removeChip(key);
      expect(listCalls(), `${key} removal is local`).toBe(settled);
    }
    await removeChip("q");
    expect(listCalls(), "q removal is local").toBe(settled);
    await waitFor(() => !q("apv-filter-summary") || chipKeys().length === 0, "chips cleared");
    expect(chipKeys()).toHaveLength(0);
  });
});

describe("R98 filter-url contract: pending tab", () => {
  it("entering pending with a status drops it immediately without an extra request", async () => {
    await renderInto("/approvals?tab=pending&status=expired", <ApprovalsPendingModulePage />);
    // 数据腿恒 pending（R93b）：status 被进入即移除，不引发第二次取数
    expect(listCalls(), "exactly one list read on entry").toBe(1);
    expect(urls().find((u) => u.includes("/api/approvals"))).toContain("status=pending");
    expect(q("apv-status-note"), "常驻口径句").toBeTruthy();
    expect(q("apv-chip-status"), "status chip dropped with the param").toBeNull();
  });
});
