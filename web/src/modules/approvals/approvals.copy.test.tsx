// @vitest-environment jsdom
/**
 * R99 — 审批面跨页文案常量收敛护栏（纯测试 + 同单把 rid/缺值句的字面量
 * 收敛到 stateCopy.ts 单点：FIELD_MISSING_SENTENCE / APPROVAL_RID_MISSING）。
 *
 * 锁三组常量只有一个出处（禁字面量散落）：
 * ①rid/字段缺值句——行内预览（apv9）请求编号位、详情（apd5）请求编号位、
 *   预览风险缺值 reason 三处 DOM 逐字等于 stateCopy 导出；
 * ②状态人话——行卡 / 预览 / 详情终态三处逐字等于 model.statusView 输出；
 * ③风险档缺值「未标注风险」——预览与徽标同 riskView 单点。
 * 另覆盖 403≡404 同体（DeniedPanel 单点句）与空集主句（apv-state-empty-text）。
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
import { ApiError } from "@/lib/api-error";
import ApprovalsHistoryModulePage from "@/modules/approvals/ApprovalsHistoryModulePage";
import {
  APPROVAL_DENIED_BODY,
  APPROVAL_DENIED_TITLE,
  APPROVAL_EMPTY_SENTENCE,
  APPROVAL_RID_MISSING,
  FIELD_MISSING_SENTENCE,
} from "@/modules/approvals/stateCopy";
import { riskView, statusView } from "@/modules/approvals/model";

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

const isoAgo = (ms: number) => new Date(Date.now() - ms).toISOString();
const HOUR = 3_600_000;

// C1：未知状态、无风险、无 rid；C2：pending high rid 齐，详情体无 rid
const C1 = {
  approvalId: "ap_c1",
  title: "带宽扩容",
  status: "teleported",
  createdAt: isoAgo(2 * HOUR),
  approvers: [{ userId: "human:7", name: "郑涛" }],
};
const C2 = {
  approvalId: "ap_c2",
  title: "密钥轮换",
  status: "pending",
  riskLevel: "high",
  requestId: "req-c-2",
  createdAt: isoAgo(3 * HOUR),
  approvers: [{ userId: "human:7", name: "郑涛" }],
};
// 详情体刻意不带 requestId：验证 apd5 请求编号缺值位用共享常量
const C2_DETAIL: Record<string, unknown> = { ...C2, decisions: [] };
delete C2_DETAIL.requestId;

const serveCopy = async (url: string): Promise<unknown> => {
  const u = String(url);
  if (u.includes("/api/approval?id=")) return C2_DETAIL; // 详情体不带 requestId
  return { items: [C1, C2] };
};

async function expand(key: string): Promise<void> {
  const toggle = document.querySelector(
    `[data-testid^="apv9-toggle-"][data-record="${key}"]`,
  ) as HTMLButtonElement | null;
  expect(toggle, `toggle ${key}`).toBeTruthy();
  await act(async () => {
    toggle!.click();
  });
  await act(async () => {});
  await waitFor(() => !!q(`apv9-preview-${key}`), `preview ${key}`);
}

describe("R99 shared copy constants: rid/missing sentences from ONE source", () => {
  it("preview rid-missing, detail rid-missing and preview risk-reason all equal the stateCopy constants", async () => {
    mock.mockImplementation(serveCopy);
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    // C1 无 rid：预览请求编号位 = APPROVAL_RID_MISSING（fallback 单点）
    await expand("ap_c1");
    expect(q("apv9-preview-ap_c1")?.textContent).toContain(APPROVAL_RID_MISSING);
    // C1 无 risk：风险值=riskView 单点缺值词，reason=FIELD_MISSING_SENTENCE
    const riskCell = q("apv9-preview-ap_c1")?.querySelector(`[title='${FIELD_MISSING_SENTENCE}']`);
    expect(riskCell, "risk missing reason is the shared sentence").toBeTruthy();
    expect(q("apv9-preview-ap_c1")?.textContent).toContain(riskView(null).label);

    // C2 详情体无 rid：apd5 请求编号位 = FIELD_MISSING_SENTENCE
    const card = q("apr5-row-ap_c2") as HTMLElement | null;
    expect(card, "row card").toBeTruthy();
    await act(async () => {
      card!.click();
    });
    await waitFor(() => !!q("apr5-detail"), "detail open");
    expect(q("apd5-request-id-missing")?.textContent).toBe(FIELD_MISSING_SENTENCE);
  });

  it("status words across row / preview / trail equal model.statusView verbatim", async () => {
    mock.mockImplementation(serveCopy);
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    const word = statusView("teleported").label;
    const row = q("apr5-row-ap_c1");
    expect(row?.textContent).toContain(word);
    await expand("ap_c1");
    expect(q("apv9-preview-ap_c1")?.textContent).toContain(word);
  });

  it("403 and 404 stay one denied body built from the shared constants", async () => {
    mock.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/approval?id=")) return {};
      throw new ApiError("nope", { status: 403, body: "", url: String(url), requestId: "req-c-403" });
    });
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await waitFor(() => !!q("apv-state-denied"), "403 denied");
    const a = q("apv-state-denied")?.textContent ?? "";
    expect(a).toContain(APPROVAL_DENIED_TITLE);
    expect(a).toContain(APPROVAL_DENIED_BODY);

    mock.mockReset();
    mock.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/approval?id=")) return {};
      throw new ApiError("nope", { status: 404, body: "", url: String(url), requestId: "req-c-404" });
    });
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await waitFor(() => !!q("apv-state-denied"), "404 denied");
    const b = q("apv-state-denied")?.textContent ?? "";
    expect(b).toBe(a);
  });

  it("the empty-state sentence starts with the shared APPROVAL_EMPTY_SENTENCE", async () => {
    mock.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/approval?id=")) return {};
      return { items: [] };
    });
    await renderInto("/approvals?tab=history&status=pending", <ApprovalsHistoryModulePage />);
    await waitFor(() => !!q("apv-state-empty-text"), "empty panel");
    expect(q("apv-state-empty-text")?.textContent).toContain(APPROVAL_EMPTY_SENTENCE);
  });
});
