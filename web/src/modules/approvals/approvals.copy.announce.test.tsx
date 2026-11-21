// @vitest-environment jsdom
/**
 * R301 — 复制反馈播报护栏（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款，已覆盖只回证据:行）：
 *  - R86 单播报器契约=ApprovalsHistoryModulePage.test.tsx L2236/L2288/L2611
 *    （全页显式 [aria-live="polite"] 恒 1=apv-live，静态相位站）；
 *  - R99 approvals.copy.test.tsx=文案常量单点（rid/缺值/状态人话），不涉播报；
 *  - R162 approvals.detail.copy.test.tsx L161/L195/L215=六段文本↔行字段、
 *    开抽屉态复制零请求、gap 词——均未锁播报节点形态；
 *  - 「剪贴板写入被拒绝」失败句在所有 approvals 测试 0 命中；
 *  - 行内/抽屉播报均为行内 role="status"（隐式 polite）就地替换：
 *    RowCopy.tsx L62-64（每行一个 apr-row-copy-status）、
 *    views.tsx L437-441（抽屉决策链 apd8-copy-status）、
 *    RowDetailCopy.tsx L68-70（工具条 apd11-copy-status，非抽屉节点，站型注记）。
 * 真缺口=①同站连续两次复制同一行：播报不堆叠、不破坏 R86 单点、零请求；
 * ②writeText 拒绝：失败句只播一次、绝不播「已复制」、兜底文本框与
 *   应写文本同源；③抽屉关闭后其播报节点零残留，列表播报归属当次操作。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Button: ({
    onClick,
    children,
    ...rest
  }: {
    onClick?: () => void;
    children?: ReactNode;
    [k: string]: unknown;
  }) => (
    <button type="button" onClick={onClick} {...rest}>
      {children}
    </button>
  ),
  Card: ({ children, ...rest }: { children?: ReactNode; [k: string]: unknown }) => (
    <div {...rest}>{children}</div>
  ),
  CardContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import ApprovalsHistoryModulePage from "./ApprovalsHistoryModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let roots: Root[] = [];
let mounted: HTMLDivElement[] = [];

const clearScreen = (): void => {
  for (const root of roots) {
    act(() => {
      root.unmount();
    });
  }
  roots = [];
  for (const el of mounted) el.remove();
  mounted = [];
};

const origClipboard = Object.getOwnPropertyDescriptor(Navigator.prototype, "clipboard");

const stubClipboard = (writeText: (text: string) => Promise<void>): void => {
  Object.defineProperty(Navigator.prototype, "clipboard", {
    configurable: true,
    get: () => ({ writeText }),
  });
};

const restoreClipboard = (): void => {
  if (origClipboard) {
    Object.defineProperty(Navigator.prototype, "clipboard", origClipboard);
  } else {
    delete (Navigator.prototype as { clipboard?: unknown }).clipboard;
  }
};

afterEach(() => {
  clearScreen();
  api.fetchJSON.mockReset();
  restoreClipboard();
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

async function render(entry: string): Promise<void> {
  clearScreen();
  const container = document.createElement("div");
  document.body.appendChild(container);
  mounted.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <ApprovalsHistoryModulePage />
      </MemoryRouter>,
    );
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), `${entry} settled`);
}

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const listCalls = (): number =>
  api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approvals?")).length;

const clickTestId = async (id: string): Promise<void> => {
  const el = q(id);
  expect(el, `click target ${id}`).toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

/** 播报读数：role=status 节点中含指定文本的个数（就地替换则恒 1，堆叠则 >1）。 */
const spokenCount = (needle: string): number =>
  Array.from(document.querySelectorAll('[role="status"]')).filter((el) =>
    (el.textContent ?? "").includes(needle),
  ).length;

const AN1 = {
  approvalId: "ap_ac1",
  title: "播报护栏首单",
  status: "approved",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
  requestId: "req-ac-11112222",
  approvers: [{ human: "7 郑涛" }],
};
const AN2 = {
  approvalId: "ap_ac2",
  title: "播报护栏次单",
  status: "pending",
  riskLevel: "medium",
  createdAt: "2026-11-19T04:00:00Z",
  requestId: "req-ac-22223333",
};

const serve = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = [AN1, AN2].find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    return { items: [AN1, AN2] };
  });
};

describe("R301 approvals copy announcer guards", () => {
  it("keeps two consecutive copies of one row as a single in-place announcement without touching the R86 live region", async () => {
    const written: string[] = [];
    stubClipboard(async (text: string) => {
      written.push(text);
    });
    serve();
    await render("/approvals?tab=history");
    expect(listCalls(), "one list read on mount").toBe(1);
    const statusNodes = document.querySelectorAll('[role="status"]').length;
    const liveNodes = document.querySelectorAll('[aria-live="polite"]').length;
    expect(liveNodes, "R86: exactly one explicit polite region").toBe(1);

    await clickTestId("apr-row-copy-0");
    await waitFor(() => spokenCount("已复制") === 1, "first copy announces");
    expect(written.length, "one writeText per click").toBe(1);
    const firstText = written[0];
    expect(firstText.split("\n")[0], "announcement is fed by the six-segment text").toContain(
      "单号：ap_ac1",
    );

    await clickTestId("apr-row-copy-0");
    await waitFor(() => written.length === 2, "second writeText lands");
    // 就地替换：第二次不新增播报节点、不把「已复制」堆成两处
    expect(spokenCount("已复制"), "no stacked announcement").toBe(1);
    expect(
      document.querySelectorAll('[role="status"]').length,
      "role=status node count unchanged (in-place replace)",
    ).toBe(statusNodes);
    expect(
      document.querySelectorAll('[aria-live="polite"]').length,
      "R86 single polite region survives copies",
    ).toBe(liveNodes);
    expect(q("apr-row-copy-fallback"), "no fallback textarea on success").toBeNull();
    expect(listCalls(), "copy never refetches the list").toBe(1);
    expect(api.fetchJSON.mock.calls.length, "zero extra requests of any kind").toBe(1);
    expect(document.body.textContent).not.toMatch(/undefined|null/);
  });

  it("announces the rejection sentence exactly once with a same-source fallback textarea and never a fake success", async () => {
    const written: string[] = [];
    stubClipboard((text: string) => {
      written.push(text);
      return Promise.reject(new Error("NotAllowedError"));
    });
    serve();
    await render("/approvals?tab=history");
    await clickTestId("apr-row-copy-0");
    await waitFor(
      () => (q("apr-row-copy-status")?.textContent ?? "").includes("剪贴板写入被拒绝"),
      "rejection announced",
    );
    expect(spokenCount("剪贴板写入被拒绝"), "rejection sentence plays once").toBe(1);
    expect(spokenCount("已复制"), "never announces success on rejection").toBe(0);
    const fallback = q("apr-row-copy-fallback") as HTMLTextAreaElement | null;
    expect(fallback, "fallback textarea appears").toBeTruthy();
    expect(fallback!.value, "fallback is byte-identical to what writeText was handed").toBe(
      written[0],
    );
    expect(fallback!.value).toContain("单号：ap_ac1");
    expect(fallback!.readOnly, "fallback stays read-only").toBe(true);
    expect(listCalls(), "rejection path costs no extra read").toBe(1);
    // 再点一次也只换回同一个槽位：不新增失败播报节点
    await clickTestId("apr-row-copy-0");
    await waitFor(() => written.length === 2, "second rejection attempt lands");
    expect(spokenCount("剪贴板写入被拒绝"), "still one rejection node").toBe(1);
    expect(document.querySelectorAll('[data-testid="apr-row-copy-fallback"]').length).toBe(1);
    expect(document.querySelectorAll('[aria-live="polite"]').length, "R86 intact").toBe(1);
  });

  it("drops the drawer announcement with the drawer and gives the next copy to the row that ran it", async () => {
    const written: string[] = [];
    stubClipboard(async (text: string) => {
      written.push(text);
    });
    serve();
    await render("/approvals?tab=history");
    // 开抽屉：详情腿 +1；决策链播报槽位随抽屉在场
    const card = q("apr5-row-ap_ac1");
    expect(card, "row card").toBeTruthy();
    await act(async () => {
      card!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await waitFor(() => Boolean(q("apr5-detail")), "drawer opens");
    expect(q("apd8-copy-status"), "drawer announcer node while open").toBeTruthy();
    await clickTestId("apd8-copy");
    if (written.length > 0) {
      await waitFor(() => spokenCount("已复制") >= 1, "drawer copy announces if enabled");
    }

    // 关抽屉：播报节点随 aside 一起移除——零残留
    await clickTestId("apd7-back");
    await waitFor(() => !q("apr5-detail"), "drawer closes");
    expect(
      q("apd8-copy-status"),
      "no announcer node survives the closed drawer",
    ).toBeNull();
    expect(spokenCount("已复制"), "no leftover announcement after close").toBe(0);

    // 列表行再复制：播报恰好一处，且归属这一行自己的槽位
    const beforeWrites = written.length;
    await clickTestId("apr-row-copy-1");
    await waitFor(() => written.length === beforeWrites + 1, "row copy write lands");
    await waitFor(() => spokenCount("已复制") === 1, "row announces once");
    const rowTwo = q("apr5-row-ap_ac2");
    expect(rowTwo, "row two card").toBeTruthy();
    const ownSlot = rowTwo!.querySelector('[data-testid="apr-row-copy-status"]');
    expect(ownSlot, "the announcement lives in row 2's own slot").toBeTruthy();
    expect(ownSlot!.textContent, "row 2 announces its own copy").toContain("已复制");
    expect(document.querySelectorAll('[data-testid="apr-row-copy-status"]').length).toBe(2);
    expect(listCalls(), "drawer round trip plus copy stays one list read").toBe(1);
    expect(api.fetchJSON.mock.calls.length, "detail leg is the only extra read").toBe(2);
    expect(document.querySelectorAll('[aria-live="polite"]').length, "R86 single polite region").toBe(1);
  });
});
