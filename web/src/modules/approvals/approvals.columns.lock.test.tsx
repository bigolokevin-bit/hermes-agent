// @vitest-environment jsdom
/**
 * R219 — 审批列表与导出列头双向锁（纯测试，禁改产品行为）。
 *
 * 已覆盖只回证据，不写重复用例：
 * 列头逐字字符串 = approvals.export.filter(R182 it① csv[0])、
 * approvals.csv.roundtrip(R217 grid[0]/it③)、approvals.decision.parity2
 * (R216 it③ header)、approvals.cross.page(R218 it④ gH[0])；
 * CSV status 列==屏上人话 = R182 it①；updated_at 四处分钟链 =
 * R168 it①（行/预览/详情/CSV）；缺值双载体（CSV 空字段 vs 复制「—」，
 * risk 缺值保留「未标注风险」人话）= R182 it③ + R107；三值
 * 行数==表体==apv5-count==导出读数 = R182 it① + wave-29 crosssurface①；
 * 导出前后 fetchJSON 不变 = R182 it②/R217 it④；空集 disabled+title+零
 * Blob = R54/R211 it②/R217。
 * ⇒ 本文件的新增量只有两处：列序不移（每行解析回来恒七格、缺值不
 * 塌列）的集中冻结，以及同一行 CSV 六格对屏上各自载体的一次成组
 * 矩阵（title/status/risk/updated/correlation/rid 全列一屏锁死）。
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
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
import { buildApprovalsCsv } from "@/modules/approvals/QueueCsvExport";
import type { ApprovalRow } from "@/modules/approvals/model";

const api = vi.mocked(fetchJSON);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) {
    act(() => {
      root!.unmount();
    });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
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

const HEADER = "id,title,status,risk,updated_at,correlation,rid";

describe("R219 approvals column lock (header + per-row cells)", () => {
  it("① the header string and the seven-slot column order are frozen; missing values never collapse a column", async () => {
    const mk = (over: Partial<ApprovalRow>): ApprovalRow =>
      ({
        key: over.rawId ?? "ap_k",
        rawId: over.rawId ?? "ap_k",
        title: over.title ?? "T",
        status: over.status ?? { label: "已处理" },
        requester: { label: "人员" },
        worker: { label: "人员" },
        submitted: "2026-11-18 09:00",
        clock: "2026-11-19 10:00",
        clockLabel: "处理于",
        decided: "2026-11-19 10:00",
        decidedAt: "2026-11-19T02:00:00Z",
        submittedAt: "2026-11-18T01:00:00Z",
        amount: null,
        reason: null,
        risk: { label: "高风险", tone: "warning", raw: "high" },
        approvers: { labels: [], raw: null },
        approverIds: [],
        requestId: "req-1",
        ...over,
      } as unknown as ApprovalRow);
    const csv = buildApprovalsCsv([
      mk({}),
      mk({ rawId: "ap_norisk", title: "缺风险", risk: { label: "未标注风险", tone: "secondary", raw: null } }),
      mk({ rawId: "ap_nodata", title: "缺时间与编号", clock: null, decidedAt: null, requestId: null }),
    ]);
    const lines = csv.replace(/^\uFEFF/, "").split("\r\n").filter((l) => l !== "");
    expect(lines[0]).toBe(HEADER); // ① 列头逐字
    expect(lines).toHaveLength(4); // 表头 + 三行，没有因换行裂列
    const cells = lines.slice(1).map((l) => l.split(","));
    for (const rowCells of cells) {
      expect(rowCells).toHaveLength(7); // 列序不移：每行恒七格
    }
    expect(cells[1][0]).toBe("ap_norisk");
    expect(cells[1][3]).toBe("未标注风险"); // risk 缺值=人话非空（现状契约）
    expect(cells[2][4]).toBe(""); // 缺 updated_at=空字段
    expect(cells[2][6]).toBe(""); // 缺 rid=空字段
    expect(csv).not.toMatch(/—|null/); // 不写「—」、不写 null
  });

  it("② one row, six columns: each CSV cell equals its own on-screen carrier verbatim", async () => {
    const RAW = {
      approvalId: "ap_h1",
      title: "季度预算复议",
      status: "approved",
      riskLevel: "high",
      approvers: [{ userId: "human:7", name: "郑涛" }],
      decisions: [{ approver: "human:7", name: "郑涛", decision: "approve", at: "2026-11-19T02:00:00Z" }],
      createdAt: "2026-11-18T01:00:00Z",
      decidedAt: "2026-11-19T02:00:00Z",
      requestId: "req-h1-87654321",
    };
    api.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) return RAW;
      if (u.includes("status=approved")) return { items: [RAW] };
      return { items: [] };
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(
        <MemoryRouter initialEntries={["/approvals?tab=history&status=approved"]}>
          <ApprovalsHistoryModulePage />
        </MemoryRouter>,
      );
    });
    await waitFor(
      () => !container!.querySelector(".animate-pulse") && !!container!.querySelector('[data-testid="apr5-row-ap_h1"]'),
      "row landed",
    );
    // 展开预览，取 risk/updated 屏上载体
    const toggle = Array.from(container!.querySelectorAll('[data-testid^="apv9-toggle-"]')).find(
      (el) => el.getAttribute("data-record") === "ap_h1",
    ) as HTMLButtonElement | null;
    expect(toggle, "preview toggle").toBeTruthy();
    await act(async () => {
      toggle!.click();
    });
    await act(async () => {});
    const pv = container!.querySelector('[data-testid="apv9-preview-ap_h1"]');
    expect(pv, "preview opened").toBeTruthy();
    const dds = Array.from(pv!.querySelectorAll("dd")).map((dd) => (dd.textContent ?? "").trim());
    const badge =
      container!.querySelector('[data-testid="apv-trunc-row-title-ap_h1"]')?.closest("button")?.parentElement
        ?.lastElementChild?.textContent ?? "<<no badge>>";
    const timeTitle =
      container!.querySelector('[data-testid="apv-time-row-ap_h1"]')?.getAttribute("title") ?? "<<no title>>";
    const titleText = container!.querySelector('[data-testid="apv-trunc-row-title-ap_h1"]')?.textContent ?? "";
    // 拦导出
    const blobs: Blob[] = [];
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    const origClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = ((blob: Blob) => {
      blobs.push(blob);
      return "blob:columns-lock";
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
    HTMLAnchorElement.prototype.click = function () {
      void 0;
    } as unknown as typeof HTMLAnchorElement.prototype.click;
    try {
      const exportBtn = container!.querySelector('[data-testid="apv7-export"]') as HTMLButtonElement | null;
      expect(exportBtn, "export button present").toBeTruthy();
      const callsBefore = api.mock.calls.length;
      await act(async () => {
        exportBtn!.click();
      });
      expect(blobs.length).toBe(1);
      expect(api.mock.calls.length).toBe(callsBefore); // 导出不取数（R182/R217 已锁，此处成组复证）
      const lines = (await blobs[0].text())
        .replace(/^\uFEFF/, "")
        .split("\r\n")
        .filter((l) => l !== "");
      expect(lines[0]).toBe(HEADER);
      expect(lines).toHaveLength(2);
      const cells = lines[1].split(",");
      expect(cells[0]).toBe("ap_h1"); // id
      expect(cells[1]).toBe(titleText); // title==屏上标题
      expect(cells[2]).toBe(badge.trim()); // status==行卡徽标人话
      expect(cells[3]).toBe(dds[1]); // risk==预览风险档人话（行卡无位，R162 先例）
      expect(timeTitle.slice(3, 19)).toBe(cells[4]); // updated_at==屏上绝对分钟句
      expect(cells[5]).toBe("ap_h1"); // correlation（R107 契约）
      expect(cells[6]).toBe("req-h1-87654321"); // rid 全串
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
      HTMLAnchorElement.prototype.click = origClick;
    }
  });
});
