// @vitest-environment jsdom
/**
 * R165 — 审批详情抽屉键盘与焦点护栏（纯测试，零产品改动）。
 *
 * 既有覆盖先查（git grep activeElement/focus-trap=本域测试零命中=全新单）；
 * R73 roving tabindex 与 R127/R162 复制契约不在此重复。
 *
 * 现场缺口台账（工单授权「只记缺口不改码」，此处按现状锁定真实行为）：
 *  - 产品没有焦点陷阱：打开抽屉不移焦、Esc 不关抽屉、Tab 可在抽屉与列表间
 *    自由往返。用例①把这三件事作为「当前契约」锁死——若将来接线焦点陷阱，
 *    该用例将红并提醒同步升级本文件断言。
 *  - jsdom 不把键盘 Enter/Space 合成为 button click（浏览器原生语义），
 *    用例②锁键盘可激活的载体属性（真 <button type=button>、非 disabled、
 *    行锚 tabIndex 0/−1 规则），并以 click 路径验证「每触发一次恰一次
 *    writeText、零额外请求」。
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

const C1 = {
  approvalId: "ap_a11",
  title: "季度预算复议",
  status: "approved",
  riskLevel: "high",
  approvers: [{ userId: "human:7", name: "郑涛" }],
  requestId: "req-a11-12345678",
  createdAt: isoAgo(3 * HOUR),
  decidedAt: isoAgo(1 * HOUR),
  decisions: [
    { userId: "human:7", name: "郑涛", decision: "approve", at: isoAgo(1 * HOUR), comment: "同意" },
  ],
};
const C2 = {
  approvalId: "ap_a12",
  title: "密钥轮换",
  status: "pending",
  approvers: [{ userId: "human:9", name: "阿朝" }],
  createdAt: isoAgo(2 * HOUR),
};

/** 列表行=详情读口同一 body。 */
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

const stubClipboard = (written: string[]) => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (t: string) => {
        written.push(t);
        return Promise.resolve();
      },
    },
  });
};

describe("R165 ① focus contract as built: no trap, no steal, no Esc-close (gap ledger)", () => {
  it("opening the drawer keeps focus on the trigger row and Escape does not close it", async () => {
    serve([C1, C2]);
    await render();
    const row = q(`apr5-row-${C1.approvalId}`) as HTMLElement | null;
    expect(row).toBeTruthy();
    await act(async () => {
      row!.focus();
    });
    expect(document.activeElement, "行锚获得焦点").toBe(row);

    await openDetail(C1.approvalId);
    // 缺口台账：产品打开抽屉不劫持焦点——焦点仍在触发行。
    expect(document.activeElement, "打开抽屉不抢焦点（现状锁定）").toBe(row);

    await act(async () => {
      row!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    // 缺口台账：Esc 只收行内预览，不关抽屉——详情仍在。
    expect(q("apr5-detail"), "Esc 不关抽屉（现状锁定）").toBeTruthy();
    expect(document.activeElement, "Esc 后焦点仍在行锚").toBe(row);

    // 真正的关闭出口=apd7-back（返回列表）。
    const back = q("apd7-back") as HTMLButtonElement | null;
    expect(back, "返回出口按钮存在且键盘可用").toBeTruthy();
    expect(["button", "submit"].includes(back!.type), "返回出口是真 <button>，键盘可激活").toBe(true);
    await act(async () => {
      back!.click();
    });
    await waitFor(() => !q("apr5-detail"), "drawer closed via apd7-back");
  });

  it("tab order: only the active row anchor is focusable among rows", async () => {
    serve([C1, C2]);
    await render();
    const rowA = q(`apr5-row-${C1.approvalId}`) as HTMLElement | null;
    const rowB = q(`apr5-row-${C2.approvalId}`) as HTMLElement | null;
    expect(rowA && rowB).toBeTruthy();
    // R73 roving：恰一行 tabIndex=0，其余 −1。
    const tabs = [rowA!, rowB!].map((el) => el.getAttribute("tabindex"));
    expect(tabs.filter((t) => t === "0"), "恰一个行锚在 tab 序").toHaveLength(1);
    expect(tabs.filter((t) => t === "-1"), "其余行锚不在 tab 序").toHaveLength(1);
  });
});

describe("R165 ②③ keyboard-activatable carriers copy exactly once, zero requests", () => {
  it("row copy and drawer trail copy are real buttons; each activation writes once and fetches nothing", async () => {
    const written: string[] = [];
    stubClipboard(written);
    serve([C1, C2]);
    await render();

    const copyBtn = q("apr-row-copy-0") as HTMLButtonElement | null;
    expect(copyBtn, "行末复制钮").toBeTruthy();
    // jsdom 不把键盘 Enter/Space 合成 click（浏览器原生行为）；这里锁可键盘
    // 激活的载体属性，真激活走 click 路径。现场记录：@nous-research/ui 的
    // Button 不显式写 type，button 元素默认 "submit"——不在 form 内，浏览器
    // 激活语义与 type=button 相同，键盘 Enter/Space 仍可触发。
    expect(["button", "submit"].includes(copyBtn!.type), "真 <button> 可被 Enter/Space 原生激活").toBe(true);
    expect(copyBtn!.disabled).toBe(false);
    await act(async () => {
      copyBtn!.focus();
    });
    expect(document.activeElement, "复制钮进入 tab 序").toBe(copyBtn);

    const before = mock.mock.calls.length;
    await act(async () => {
      copyBtn!.click();
    });
    expect(written, "一次触发恰一次复制").toHaveLength(1);
    expect(mock.mock.calls.length, "复制零请求").toBe(before);
    expect(q("apr-row-copy-status")?.textContent).toBe("已复制");

    await openDetail(C1.approvalId);
    const trail = q("apd8-copy") as HTMLButtonElement | null;
    expect(trail, "抽屉链路复制钮").toBeTruthy();
    expect(["button", "submit"].includes(trail!.type), "链路复制钮同为可键盘激活的真 button").toBe(true);
    expect(trail!.disabled).toBe(false);
    const beforeDetail = mock.mock.calls.length;
    await act(async () => {
      trail!.click();
    });
    expect(written, "抽屉钮触发再加一次复制").toHaveLength(2);
    expect(mock.mock.calls.length, "抽屉复制同样零请求").toBe(beforeDetail);
    expect(q("apd8-copy-status")?.textContent).toBe("已复制");
  });
});

describe("R165 ④ closed drawer keeps its controls out of the focus sequence", () => {
  it("unmounted or disabled when nothing is selected; live once a row opens", async () => {
    const written: string[] = [];
    stubClipboard(written);
    serve([C1, C2]);
    await render();

    const aside = document.querySelector('aside[aria-label="记录详情"]') as HTMLElement | null;
    expect(aside, "aside 常驻（并排布局）").toBeTruthy();
    expect(aside!.querySelector('[data-testid="apr5-detail"]'), "关闭态无详情").toBeNull();
    expect(aside!.querySelector('[data-testid="apd7-back"]'), "关闭态无返回钮").toBeNull();
    expect(aside!.querySelector('[data-testid="apd8-copy"]'), "关闭态无链路复制钮").toBeNull();
    // 唯一常驻的抽屉钮=固定链接，未选中时 disabled（不在 tab 序）。
    const permalink = aside!.querySelector('[data-testid="apd10-permalink"]') as HTMLButtonElement | null;
    expect(permalink, "固定链接钮常驻").toBeTruthy();
    expect(permalink!.disabled, "未选中则 disabled（不可聚焦激活）").toBe(true);

    await openDetail(C1.approvalId);
    expect((q("apd10-permalink") as HTMLButtonElement).disabled, "打开后解禁").toBe(false);
    expect(q("apd7-back"), "打开后返回钮在序").toBeTruthy();

    await act(async () => {
      (q("apd7-back") as HTMLButtonElement).click();
    });
    await waitFor(() => !q("apr5-detail"), "closed again");
    expect((q("apd10-permalink") as HTMLButtonElement).disabled, "再关闭回到不可激活态").toBe(true);
  });
});
