// @vitest-environment jsdom
/**
 * R247：approvals 导出列与状态筛选交叉护栏（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款「已覆盖只回证据与缺口」）：
 *  - 工单②（pending 与 approved 两站先后导出互不残留、行数==表体==apv5-count、
 *    第二次导出零新请求）= approvals.export.multistatus.test.tsx it②（R246）逐字已锁；
 *  - 工单③（未知 ?status=__nope__ 站：导出 disabled+title、强点零 Blob 零请求）
 *    = 同文件 it③（R246；apv5-count 不渲染的现状锁也在其中）；
 *  - 工单①的「CSV 头七列逐字 + status 列人话==屏上徽标」在 rejected 站
 *    = 同文件 it①（R246）。
 * 本文件唯一增量 = 工单①的 risk 列腿：rejected 站 CSV risk 列==riskView 单点
 * 人话、==预览风险 dd（屏上载体互证，R60 预览零请求），且缺 riskLevel 行写
 * 「未标注风险」人话（R107 契约），两处都不落枚举原词（high/low）。
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
import { riskView } from "./model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RJ1 = {
  approvalId: "ap_sc1",
  title: "驳回高危一件",
  status: "rejected",
  riskLevel: "high",
  createdAt: "2026-11-19T04:00:00Z",
  decidedAt: "2026-11-19T05:00:00Z",
};
const RJ2 = {
  approvalId: "ap_sc2",
  title: "驳回缺险二件",
  status: "rejected",
  // 无 riskLevel：CSV 现网契约写「未标注风险」人话（R107），非空字段。
  createdAt: "2026-11-19T04:10:00Z",
  decidedAt: "2026-11-19T05:10:00Z",
};

function serveRejected(): void {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) return {};
    if (u.includes("status=rejected")) return { items: [RJ1, RJ2] };
    return { items: [] };
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
  return Array.from(container?.querySelectorAll('[data-testid^="apr5-row-ap_sc"]') ?? []).map(
    (node) => node.getAttribute("data-testid")?.slice("apr5-row-".length) ?? "",
  );
}

/** 展开某行行内预览（R60：零请求），返回 dd 文本列表。 */
async function previewDds(key: string): Promise<string[]> {
  const toggle = Array.from(container?.querySelectorAll('[data-testid^="apv9-toggle-"]') ?? []).find(
    (node) => node.getAttribute("data-record") === key,
  );
  expect(toggle, `toggle ${key}`).toBeTruthy();
  await act(async () => {
    toggle!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await waitFor(() => !!q(`apv9-preview-${key}`), "preview open");
  return Array.from(q(`apv9-preview-${key}`)?.querySelectorAll("dd") ?? []).map((dd) => dd.textContent ?? "");
}

async function grabCsvLines(): Promise<string[]> {
  const captured: Blob[] = [];
  const orig = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  URL.createObjectURL = ((blob: Blob) => {
    captured.push(blob);
    return "blob:sc247";
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  const clicks = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  try {
    const btn = q("apv7-export") as HTMLButtonElement | null;
    expect(btn, "export button").toBeTruthy();
    expect(btn!.disabled, "rejected 站导出可用").toBe(false);
    await act(async () => {
      btn!.click();
    });
  } finally {
    URL.createObjectURL = orig;
    URL.revokeObjectURL = origRevoke;
    clicks.mockRestore();
  }
  expect(captured).toHaveLength(1);
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

describe("approvals.export.status.columns (R247)", () => {
  it("rejected 站：七列头逐字 + CSV risk 列==riskView 单点人话==预览 dd，不落枚举原词", async () => {
    serveRejected();
    await render("/approvals?tab=history&status=rejected");
    await waitFor(() => rowIds().join(",") === "ap_sc1,ap_sc2", "rejected rows ready");

    // 预览是本地展开：先取屏上风险载体（R60 零请求）。
    const callsBeforePreview = api.fetchJSON.mock.calls.length;
    const dds1 = await previewDds("ap_sc1");
    const dds2 = await previewDds("ap_sc2");
    expect(api.fetchJSON.mock.calls.length, "预览展开零额外请求").toBe(callsBeforePreview);
    const HIGH = riskView("high").label;
    const NONE = riskView(null).label;
    expect(HIGH, "现场真词非空").not.toBe("");
    expect(dds1[1], "预览风险位==riskView 单点（high）").toBe(HIGH);
    expect(dds2[1], "预览风险位==riskView 单点（缺 riskLevel）").toBe(NONE);

    const csv = await grabCsvLines();
    expect(api.fetchJSON.mock.calls.length, "导出不新增请求").toBe(callsBeforePreview);
    expect(csv[0], "七列头现状（R107）").toBe("id,title,status,risk,updated_at,correlation,rid");
    expect(csv.length - 1, "CSV 数据行数==表体").toBe(rowIds().length);
    expect(q("apv5-count")?.textContent, "apv5-count==行数").toBe(String(rowIds().length));

    const line1 = csv.find((l) => l.startsWith("ap_sc1,"));
    const line2 = csv.find((l) => l.startsWith("ap_sc2,"));
    expect(line1 && line2, "两行都在 CSV").toBeTruthy();
    const cells1 = line1!.split(",");
    const cells2 = line2!.split(",");
    expect(cells1[3], "risk 列==riskView(高)").toBe(HIGH);
    expect(cells1[3], "risk 列不落枚举原词").not.toBe("high");
    expect(cells2[3], "缺 riskLevel==未标注风险人话（R107 契约，非空字段）").toBe(NONE);
    expect(cells2[3], "缺值腿不是空字段也不是 —").not.toBe("");
    // status 列人话对照（与 R246 it① 同公式，此站复锁一行成本）。
    expect(cells1[2], "status 列非枚举原词").not.toBe("rejected");
    expect(cells1[2].length, "status 列人话非空").toBeGreaterThan(0);
    expect(csv.join("\n"), "全文不落高危原词").not.toMatch(/\bhigh\b/);
  });
});
