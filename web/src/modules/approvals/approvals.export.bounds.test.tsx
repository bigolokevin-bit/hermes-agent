// @vitest-environment jsdom
/**
 * R229 — 审批导出空集与非空集边界互斥（纯测试，禁改产品行为）。
 *
 * 已覆盖只回证据，不写重复用例：
 * - 空集导出 disabled+title+点击零请求零 Blob = R211 it②（全空 mount 形态）
 *   与 R54（「disables with a stated reason」）；导出前后 fetchJSON 不变 =
 *   R217 it④ + R182 it②；行数==表体==apv5-count 同筛内三值 = R182 it① +
 *   wave-29 ①；文件名/MIME 现状 = R226（approvals.csv.filename.crlf）。
 *
 * 本文件真缺口（逐条点名）：
 * ①同一筛选腿（?status=pending）返回 0 行时：导出 disabled+title 在场、
 *   强点一次（dispatchEvent 不可信，双锁 disabled 属性与零副作用）零 Blob
 *   零请求、apv7-export-count 读数位=「—」（非假 0）；
 * ③跨状态来回切两次（pending→approved→pending→approved）：三值每站同步、
 *   计数无漂移、fetchJSON 单调 +1/切——既有空/非空场景都是单站，跨站往返
 *   矩阵未锁，本单集中补。
 * ②的「首行单号==CSV 首数据行」与既有「屏上 title==CSV title」（R217 it③）
 *   不同载体：本单锁 id 列首值==屏上首行 approvalId。
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
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_b"]')).map((el) =>
    String(el.getAttribute("data-testid")).replace("apr5-row-", ""),
  );

const A1 = { approvalId: "ap_b1", title: "预算一号", status: "approved", riskLevel: "high", decidedAt: "2026-11-19T02:00:00Z", requestId: "req-b1-1" };
const A2 = { approvalId: "ap_b2", title: "预算二号", status: "approved", riskLevel: "medium", decidedAt: "2026-11-19T03:00:00Z", requestId: "req-b2-2" };
const A3 = { approvalId: "ap_b3", title: "预算三号", status: "approved", decidedAt: "2026-11-19T04:00:00Z" };

function serve(): void {
  api.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("status=approved")) return { items: [A1, A2, A3] };
    if (u.includes("status=pending")) return { items: [] };
    if (u.includes("/api/approvals")) return { items: [A1, A2, A3] };
    return {};
  });
}

/** 一次导出拦截：返回 {download 名, blob 数, 请求增量}，disabled 时钮不可点成功。 */
async function tryExport(): Promise<{ downloads: string[]; blobs: Blob[]; callsBefore: number; callsAfter: number }> {
  const captured: Blob[] = [];
  const downloads: string[] = [];
  const orig = URL.createObjectURL;
  URL.createObjectURL = ((blob: Blob) => {
    captured.push(blob);
    return "blob:appr228b";
  }) as typeof URL.createObjectURL;
  const clicks = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.getAttribute("download") ?? "");
    });
  const callsBefore = api.mock.calls.length;
  try {
    const btn = q("apv7-export") as HTMLButtonElement | null;
    expect(btn, "export button rendered").toBeTruthy();
    await act(async () => {
      btn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  } finally {
    URL.createObjectURL = orig;
    clicks.mockRestore();
  }
  return { downloads, blobs: captured, callsBefore, callsAfter: api.mock.calls.length };
}

describe("R229 export bounds mutual exclusion", () => {
  it("① pending 0 rows: export disabled with a stated reason, forced click makes zero blobs and zero requests, counter reads 「—」 not a fake 0", async () => {
    serve();
    await renderInto("/approvals?tab=history&status=pending", <ApprovalsHistoryModulePage />);
    await waitFor(() => rowIds().length === 0, "pending empty painted");

    const btn = q("apv7-export") as HTMLButtonElement | null;
    expect(btn, "export button present in empty state").toBeTruthy();
    expect(btn!.disabled, "disabled with 0 rows").toBe(true);
    expect(btn!.getAttribute("aria-disabled"), "aria-disabled mirrors").toBe("true");
    expect(String(btn!.getAttribute("title")).length, "disabled title present").toBeGreaterThan(0);
    expect(q("apv7-export-count")?.textContent, "读数位=「—」非假 0").toBe("—");

    const r = await tryExport();
    expect(r.blobs, "强点零 Blob（createObjectURL 未调用）").toHaveLength(0);
    expect(r.downloads, "强点零下载").toHaveLength(0);
    expect(r.callsAfter, "强点零请求").toBe(r.callsBefore);
  });

  it("②③ approved 3 rows restores export and the three values agree on every stop of a two-round status walk, monotone one request per switch", async () => {
    serve();
    await renderInto("/approvals?tab=history&status=pending", <ApprovalsHistoryModulePage />);
    await waitFor(() => rowIds().length === 0, "stop 0: pending empty");
    const calls0 = api.mock.calls.length;

    // 切到 approved：导出恢复可用，三值=3，首行单号==CSV 首数据行。
    clearScreen();
    await renderInto("/approvals?tab=history&status=approved", <ApprovalsHistoryModulePage />);
    await waitFor(() => rowIds().length === 3, "stop 1: approved three rows");
    const calls1 = api.mock.calls.length;
    expect(calls1, "第一次切换=恰 +1 列表取数").toBe(calls0 + 1);
    expect(q("apv5-count")?.textContent).toBe("3");
    expect(q("apv7-export-count")?.textContent).toBe("共 3 行");
    const exportBtn = q("apv7-export") as HTMLButtonElement | null;
    expect(exportBtn!.disabled, "export restored enabled").toBe(false);
    const r1 = await tryExport();
    expect(r1.blobs).toHaveLength(1);
    expect(r1.downloads).toHaveLength(1);
    const text = await r1.blobs[0].text();
    const csvRows = text.replace(/^\uFEFF/, "").split("\r\n").filter((l) => l !== "");
    expect(csvRows.length, "CSV 行数=表头+3").toBe(4);
    expect(csvRows[1].split(",")[0], "CSV 首数据行单号==屏上首行").toBe(rowIds()[0]);
    expect(csvRows[1].split(",")[0]).toBe("ap_b1");
    expect(r1.callsAfter, "导出不取数").toBe(r1.callsBefore);

    // 第二站：切回 pending（空站三值归零位、导出再次闸住）。
    clearScreen();
    await renderInto("/approvals?tab=history&status=pending", <ApprovalsHistoryModulePage />);
    await waitFor(() => rowIds().length === 0, "stop 2: pending empty again");
    expect(q("apv7-export-count")?.textContent).toBe("—");
    expect((q("apv7-export") as HTMLButtonElement).disabled).toBe(true);

    // 第三站：再切 approved——三值与首行逐位复现，无漂移。
    clearScreen();
    await renderInto("/approvals?tab=history&status=approved", <ApprovalsHistoryModulePage />);
    await waitFor(() => rowIds().length === 3, "stop 3: approved restored");
    expect(rowIds()).toEqual(["ap_b1", "ap_b2", "ap_b3"]);
    expect(q("apv5-count")?.textContent).toBe("3");
    expect(q("apv7-export-count")?.textContent).toBe("共 3 行");
    const r2 = await tryExport();
    expect(r2.blobs).toHaveLength(1);
    const text2 = await r2.blobs[0].text();
    expect(text2.replace(/^\uFEFF/, "").split("\r\n").filter((l) => l !== "")[1].split(",")[0]).toBe(rowIds()[0]);
    expect(r2.callsAfter, "第二轮导出不取数").toBe(r2.callsBefore);

    // 全程 fetchJSON 单调：每站切换恰 +1（共 3 次切换增量），导出零贡献。
    expect(api.mock.calls.length, "往返后总请求=初 1+三切换 3").toBe(calls0 + 3);
  });
});
