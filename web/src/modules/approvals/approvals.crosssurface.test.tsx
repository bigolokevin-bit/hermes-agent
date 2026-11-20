// @vitest-environment jsdom
/**
 * wave-29 — 审批三面一致性护栏（纯测试；本文件带出的一处真缺陷修复见
 * commit message：详情 rid 缺值句「—」→「该字段未返回」，与预览同口径）。
 *
 * 锁四件事（同一渲染入口、同一夹具）：
 * ①导出行数 == apv5-count == 表体行数；空集导出钮 disabled 且 title 的
 *   原因句与 gates/apv-live 同源（gateReason/announcement 逐字）；
 * ②审批人分桶计数之和 == 可见行数；点桶后桶计数不变、列表行数==桶计数、
 *   再点清空复原；
 * ③apv-chip-* 出现集合 == URL 生效筛选参集合（asort+adir 合成一枚 sort），
 *   移除 status chip=refetch 且新请求无 status=，移除 q chip=本地零请求；
 * ④同一记录的 rid（预览/详情两处载体）与状态人话（行卡/预览/详情终态）
 *   逐字同值；缺 rid 时两处都落「该字段未返回」。
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
import { announcement, gateReason } from "@/modules/approvals/gates";
import { statusView } from "@/modules/approvals/model";

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
const rowCount = () => document.querySelectorAll('[data-testid^="apr5-row-ap_"]').length;
const isoAgo = (ms: number) => new Date(Date.now() - ms).toISOString();

const HOUR = 3_600_000;
const X1 = {
  approvalId: "ap_x1",
  title: "跨面护栏一",
  status: "pending",
  riskLevel: "high",
  approvers: [{ userId: "human:7", name: "郑涛" }],
  requestId: "req-xs-1",
  createdAt: isoAgo(2 * HOUR),
  reasonText: "护栏理由一",
};
const X2 = {
  approvalId: "ap_x2",
  title: "跨面护栏二",
  status: "approved",
  approvers: [{ userId: "human:9" }],
  createdAt: isoAgo(72 * HOUR),
  decidedAt: isoAgo(48 * HOUR),
};
const X3 = {
  approvalId: "ap_x3",
  title: "跨面护栏三",
  status: "pending",
  approvers: [{ userId: "human:7", name: "郑涛" }],
  createdAt: isoAgo(5 * HOUR),
  requestId: "req-xs-3",
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

const openRow = async (id: string) => {
  const card = document.querySelector(`[data-testid="apr5-row-${id}"]`) as HTMLElement | null;
  expect(card, `row ${id}`).toBeTruthy();
  await act(async () => {
    card!.click();
  });
  await waitFor(() => !!q("apr5-detail"), `detail of ${id}`);
};

const openPreview = async (id: string) => {
  const btn = document.querySelector(`[data-testid^="apv9-toggle-"][data-record="${id}"]`) as HTMLButtonElement | null;
  expect(btn, `toggle of ${id}`).toBeTruthy();
  await act(async () => {
    btn!.click();
  });
  await waitFor(() => !!q(`apv9-preview-${id}`), `preview of ${id}`);
};

describe("wave-29 ① same-source row counts (export == apv5-count == table body)", () => {
  it("ready view keeps the three numbers identical", async () => {
    serve([X1, X2, X3]);
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    expect(rowCount()).toBe(3);
    expect(q("apv5-count")?.textContent).toBe("3");
    expect(q("apv7-export-count")?.textContent).toBe("共 3 行");
  });

  it("empty answer disables export with the gates sentence, not a fake 0", async () => {
    serve([]);
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    const btn = q("apv7-export") as HTMLButtonElement;
    expect(btn.disabled, "export gated on empty").toBe(true);
    expect(btn.title, "export reason is the single gates sentence").toContain(gateReason("empty"));
    expect(q("apv-live")?.textContent).toBe(announcement("empty", 0));
    expect(q("apv7-export-count")?.textContent).toBe("—");
    expect(q("apv5-count"), "count chip only renders when ready").toBeNull();
  });
});

describe("wave-29 ② actor buckets sum and same-source filtering", () => {
  it("bucket counts sum to the visible rows; picking keeps sums and filters to the bucket", async () => {
    serve([X1, X2, X3]);
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    const buckets = Array.from(document.querySelectorAll('[data-testid^="apv-actor-bucket-"]'));
    expect(buckets, "two buckets: 郑涛 and 人员 · 9").toHaveLength(2);
    const sum = buckets.reduce((acc, b) => {
      const m = b.textContent?.match(/(\d+)\s*$/);
      return acc + (m ? Number(m[1]) : 0);
    }, 0);
    expect(sum, "bucket sum equals visible rows").toBe(rowCount());
    const z = buckets.find((b) => (b.getAttribute("title") ?? "").includes("human:7")) as HTMLButtonElement;
    const zCount = Number(z.textContent?.match(/(\d+)\s*$/)?.[1] ?? "-1");
    const before = mock.mock.calls.length;
    await act(async () => {
      z.click();
    });
    await waitFor(() => rowCount() === 2, "郑涛 rows");
    expect(rowCount(), "list rows == bucket count").toBe(zCount);
    expect(q("apv5-count")?.textContent).toBe(String(zCount));
    expect(mock.mock.calls.length, "picking a bucket never refetches").toBe(before);
    const zAfter = Number(z.textContent?.match(/(\d+)\s*$/)?.[1] ?? "-1");
    expect(zAfter, "bucket counts stay stable").toBe(zCount);
    await act(async () => {
      z.click();
    });
    await waitFor(() => rowCount() === 3, "restored");
    expect(mock.mock.calls.length, "clearing never refetches either").toBe(before);
  });
});

describe("wave-29 ③ chips mirror the URL, removal keeps both in sync", () => {
  const chipKeys = () =>
    Array.from(document.querySelectorAll('[data-testid^="apv-chip-"]'))
      .map((el) => (el.getAttribute("data-testid") ?? "").replace("apv-chip-", ""))
      .filter((k) => !k.startsWith("remove-"))
      .sort();

  it("chip set == effective filter params (asort+adir fold into one sort chip)", async () => {
    serve([X1, X2, X3]);
    await renderInto(
      "/approvals?tab=history&status=pending&q=%E6%8A%A4%E6%A0%8F&risk=high&actor=human%3A7&since=24h&asort=title&adir=asc",
      <ApprovalsHistoryModulePage />,
    );
    expect(chipKeys()).toEqual(["actor", "q", "risk", "since", "sort", "status"]);
    expect(rowCount(), "combined filters leave one row").toBe(1);
    const n0 = mock.mock.calls.length;
    await act(async () => {
      (q("apv-chip-remove-status") as HTMLButtonElement).click();
    });
    await waitFor(() => mock.mock.calls.length === n0 + 1, "status chip removal refetches once");
    const fresh = String(mock.mock.calls[n0][0]);
    expect(fresh.includes("status="), fresh).toBe(false);
    expect(chipKeys(), "status chip gone").not.toContain("status");
    const n1 = mock.mock.calls.length;
    await act(async () => {
      (q("apv-chip-remove-q") as HTMLButtonElement).click();
    });
    await waitFor(() => !q("apv-chip-remove-q"), "q chip gone");
    expect(mock.mock.calls.length, "local chip removal never refetches").toBe(n1);
  });
});

describe("wave-29 ④ rid and status wording agree across surfaces", () => {
  it("same record: preview and detail share the rid; status reads identically in three places", async () => {
    serve([X1, X2, X3]);
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await openPreview("ap_x1");
    const previewText = q("apv9-preview-ap_x1")?.textContent ?? "";
    expect(previewText, "preview carries the rid").toContain("req-xs-1");
    expect(previewText, "preview status is the plain label").toContain(statusView("pending").label);
    await openRow("ap_x1");
    expect(q("apd5-request-id")?.textContent).toBe("req-xs-1");
    expect(
      (document.querySelector('[data-testid="apv9-preview-ap_x1"]')?.textContent ?? "").includes("req-xs-1"),
      "opening the detail collapses the preview (R60 contract kept)",
    ).toBe(false);
    expect(
      Array.from(document.querySelectorAll('[data-testid="apr5-row-ap_x1"] *'))
        .some((el) => (el.textContent ?? "").includes(statusView("pending").label)),
      "row badge shows the same label",
    ).toBe(true);
    const final = q("apd6-step-final")?.textContent ?? "";
    expect(final, "trail final states the same label").toContain(`终态 · ${statusView("pending").label}`);
  });

  it("record without a rid: preview and detail both say 该字段未返回", async () => {
    serve([X1, X2, X3]);
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await openPreview("ap_x2");
    expect(
      q("apv9-preview-ap_x2")?.textContent,
      "preview missing-rid sentence",
    ).toContain("该字段未返回");
    await openRow("ap_x2");
    expect(q("apd5-request-id-missing")?.textContent).toBe("该字段未返回");
  });
});
