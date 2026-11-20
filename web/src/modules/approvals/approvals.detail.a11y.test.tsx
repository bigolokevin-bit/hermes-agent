// @vitest-environment jsdom
/**
 * R225 — /approvals 决策抽屉可访问性补账（纯测试，零产品改动）。
 *
 * 先查既有覆盖（工单查重条款，已覆盖只回证据、本文件不重复）：
 *  - 「打开抽屉后首个可焦点元素」的现场契约 + 「Esc 关闭后焦点回触发行」的缺口台账
 *    + 「行 tabIndex roving 单点」=approvals.a11y.test.tsx（R165）①②；
 *  - 「复制按钮键盘可激活载体 + 每触发恰一次剪贴板、零额外请求」=R165 ②③
 *    （jsdom 不把 Enter/Space 合成为 click，已按载体属性+click 路径锁死，现状不改码）；
 *  - 「关闭态抽屉控件不挂载」=R165 ④（apv6-gates 同屏复跑亦锁）。
 *
 * 本文件只补两处现场缺口：
 *  ① aria-modal/role 语义账：抽屉现状=并排 aside（aria-label=记录详情），
 *    没有 role=dialog、没有 aria-modal——非模态并排是现场设计，按现状锁定属性
 *    缺席并挂台账；若将来改成模态，此用例应红并提醒同步补语义与焦点陷阱。
 *  ② 只读字段不进 Tab 序列：抽屉里的只读值载体（决定时间 dd、标题、事由）不带
 *    tabindex、不是可交互元素、内部不含交互控件；Tab 停得到的只有已锁的按钮族。
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

const D1 = {
  approvalId: "ap_d25",
  title: "季度预算复议",
  status: "approved",
  riskLevel: "high",
  approvers: [{ userId: "human:7", name: "郑涛" }],
  requestId: "req-d25-12345678",
  createdAt: isoAgo(3 * HOUR),
  decidedAt: isoAgo(1 * HOUR),
  reasonText: "常规预算调整",
  decisions: [
    { userId: "human:7", name: "郑涛", decision: "approve", at: isoAgo(1 * HOUR), comment: "同意" },
  ],
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

const aside = (): HTMLElement | null =>
  document.querySelector('aside[aria-label="记录详情"]');

const INTERACTIVE = "a,button,input,select,textarea,[tabindex],[contenteditable=true]";

describe("R225 ① - the drawer's modal semantics, as built", () => {
  it("parallel aside carries aria-label but no role=dialog/aria-modal (gap ledger, no code change)", async () => {
    serve([D1]);
    await render();
    await openDetail("ap_d25");

    const shell = aside();
    expect(shell, "记录详情 aside 在位").toBeTruthy();
    // 现场设计=并排非模态：没有弹窗语义可锁，就把「缺席」也锁成契约。
    expect(shell!.getAttribute("role")).toBeNull();
    expect(shell!.getAttribute("aria-modal")).toBeNull();
    // 抽屉主体锚在位（焦点契约与 Esc 台账见 approvals.a11y.test.tsx R165①，不重复）
    expect(q("apr5-detail")).toBeTruthy();
    expect(q("apd7-back"), "真返回出口在位").toBeTruthy();
  });
});

describe("R225 ② - read-only fields stay out of the tab sequence", () => {
  it("value carriers carry no tabindex, are not interactive, and hold no controls", async () => {
    serve([D1]);
    await render();
    await openDetail("ap_d25");

    const shell = aside();
    expect(shell).toBeTruthy();

    // 决定时间=只读 Field（dd 纯文本+title 说明）
    const field = shell!.querySelector('[data-testid="apd5-field-decided-at"]');
    expect(field, "决定时间字段在位").toBeTruthy();
    const dd = field!.querySelector("dd");
    expect(dd, "决定时间值格在位").toBeTruthy();
    expect(dd!.getAttribute("tabindex")).toBeNull();
    expect(dd!.matches(INTERACTIVE)).toBe(false);
    expect(dd!.querySelector(INTERACTIVE), "值格里没有交互控件").toBeNull();
    expect(dd!.textContent, "决定时间有可读值").not.toBe("");

    // 标题与事由同理：只读文本不带 tabindex、不含可聚焦件
    for (const id of ["apv-trunc-detail-title", "apv-trunc-detail-reason"]) {
      const el = shell!.querySelector(`[data-testid="${id}"]`);
      if (!el) continue; // 事由为空时该位不渲染（缺位口径见 R221 矩阵）
      expect(el.getAttribute("tabindex"), id).toBeNull();
      expect(el.matches(INTERACTIVE), id).toBe(false);
      expect(el.querySelector(INTERACTIVE), `${id} 内部无交互控件`).toBeNull();
    }

    // Tab 在抽屉内停得到的只有已知按钮族（复制/返回/固定链接系）
    const focusables = Array.from(shell!.querySelectorAll(INTERACTIVE)).map(
      (el) => (el.getAttribute("data-testid") ?? el.tagName.toLowerCase()).split("-")[0],
    );
    expect(focusables.length, "抽屉确有按钮族可聚焦").toBeGreaterThan(0);
    for (const el of Array.from(shell!.querySelectorAll(INTERACTIVE))) {
      const tag = el.tagName.toLowerCase();
      const testId = el.getAttribute("data-testid") ?? "";
      // 白名单：带 ap* testid 的按钮/链接 + 无 testid 但语义完整的折叠披露钮
      // （aria-expanded 在位，如详情技术折叠段——它本就应是键盘可达的交互件）。
      const ledger =
        (tag === "button" || tag === "a") &&
        (testId.startsWith("ap") || el.getAttribute("aria-expanded") !== null);
      expect(ledger, `意外可聚焦元素: ${el.outerHTML.slice(0, 80)}`).toBe(true);
    }
  });
});
