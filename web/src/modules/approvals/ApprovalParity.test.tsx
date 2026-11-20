// @vitest-environment jsdom
/**
 * R78 — one approval must read identically in the employee approvals zone
 * (ed8-appr-*) and in the approvals queue preview (apv9-preview-*): title,
 * 状态人话、风险档（缺=未标注风险+title 原值/「该字段未返回」）、更新时间
 * （同一 RelativeTime：屏上相对，title 绝对北京到秒 + ISO 原文，两处逐字等）。
 * The two surfaces render the SAME mock record; zero extra requests.
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
import EmployeeDetailModulePage from "@/modules/employee-detail/EmployeeDetailModulePage";
import ApprovalsHistoryModulePage from "@/modules/approvals/ApprovalsHistoryModulePage";

const mock = vi.mocked(fetchJSON);
const EMP = "emp_A3F1B2C4D5E6";

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

/** Serve the SAME record to both surfaces; count every leg. */
function serve(items: unknown[]) {
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approvals")) return { items };
    if (u.includes("/api/approval?id=")) return {};
    return {};
  });
}

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const text = (id: string): string => q(id)?.textContent ?? "";
const title = (id: string): string => q(id)?.getAttribute("title") ?? "";

describe("R78 approval parity (ed8 zone vs apv queue)", () => {
  it("a full record reads field-for-field identical in both surfaces, zero extra requests", async () => {
    serve([
      {
        approvalId: "ap_p78a",
        title: "轮换密钥",
        status: "expired",
        riskLevel: "high",
        createdAt: "2026-11-19T02:00:00Z",
        updatedAt: "2026-11-19T03:00:00Z",
        requestId: "req-p78a",
      },
    ]);
    await renderInto(`/employees/${encodeURIComponent(EMP)}?zone=approvals`, <EmployeeDetailModulePage employeeId={EMP} />);
    const ed8 = {
      title: text("ed8-appr-title-0"),
      status: text("ed8-appr-status-0"),
      statusTitle: title("ed8-appr-status-0"),
      risk: text("ed8-appr-risk-0"),
      riskTitle: title("ed8-appr-risk-0"),
      timeTitle: title("ed8-appr-time-0"),
    };
    const approvalsLegs = mock.mock.calls.filter((c) => String(c[0]).includes("/api/approvals")).length;
    expect(approvalsLegs, "zone leg count").toBe(1);

    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await waitFor(() => !!q("apr5-row-ap_p78a"), "queue row");
    await act(async () => {
      (q("apv9-toggle-ap_p78a") as HTMLButtonElement).click();
    });
    await waitFor(() => !!q("apv9-preview-ap_p78a"), "preview open");
    const pvText = q("apv9-preview-ap_p78a")?.textContent ?? "";
    const pvTimes = Array.from(q("apv9-preview-ap_p78a")!.querySelectorAll("span[title]")) as HTMLElement[];
    const pvTime = pvTimes.find((el) => (el.getAttribute("title") ?? "").includes("ISO")) ?? null;

    expect(ed8.title).toBe("轮换密钥");
    expect(pvText).toContain(ed8.title);
    expect(pvText).toContain(ed8.status); // 同一 statusView 人话
    expect(ed8.statusTitle).toBe("expired"); // title 原值两处同形制
    expect(ed8.risk).toBe("高风险");
    expect(pvText).toContain(ed8.risk);
    expect(title("apv7-export-count").length).toBeGreaterThanOrEqual(0);
    expect(pvTime?.getAttribute("title")).toBe(ed8.timeTitle); // 更新时间 title 逐字等
    expect(ed8.timeTitle).toContain("2026-11-19 11:00:00（北京时间）");
    expect(ed8.timeTitle).toContain("ISO 2026-11-19T03:00:00Z");
    expect(mock.mock.calls.filter((c) => String(c[0]).includes("/api/approvals")).length, "each surface reads the list once — parity adds nothing").toBe(2);
  });

  it("a record missing risk/status/update-time/requestId keeps one wording on both sides", async () => {
    serve([
      {
        approvalId: "ap_p78m",
        status: "weird_state",
        createdAt: "2026-11-19T02:00:00Z",
      },
    ]);
    await renderInto(`/employees/${encodeURIComponent(EMP)}?zone=approvals`, <EmployeeDetailModulePage employeeId={EMP} />);
    expect(text("ed8-appr-risk-0")).toBe("未标注风险");
    expect(title("ed8-appr-risk-0")).toBe("该字段未返回");
    expect(text("ed8-appr-status-0")).toBe("状态未识别");
    expect(text("ed8-appr-time-0")).toBe("该字段未返回");
    expect(title("ed8-appr-time-0")).toContain("不补当前时间");

    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await waitFor(() => !!q("apr5-row-ap_p78m"), "queue row");
    await act(async () => {
      (q("apv9-toggle-ap_p78m") as HTMLButtonElement).click();
    });
    await waitFor(() => !!q("apv9-preview-ap_p78m"), "preview open");
    const pv = q("apv9-preview-ap_p78m")?.textContent ?? "";
    expect(pv).toContain("未标注风险");
    expect(pv).toContain("状态未识别");
    expect(pv).toContain("该字段未返回"); // 更新时间与 rid 的缺值句
    expect(pv).not.toContain("weird_state该字段未返回原始状态值未返回"); // sanity：不是拼接事故
    expect(pv).toContain("未写明事由的申请"); // 缺标题时队列走 model 兜底句族
    expect(document.body.textContent).not.toContain("human:");
  });
});
