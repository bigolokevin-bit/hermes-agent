// @vitest-environment jsdom
/**
 * R242 (tests only): drawer focus + keyboard — current-state locks and gap ledger.
 *
 * 查重（已覆盖只回证据，本文件不重写）：
 * - 打开抽屉不抢焦点（activeElement 留在行锚）+ Esc 不关闭 + apd7-back 真出口
 *   + 关闭后行在序 = approvals.a11y.test.tsx it「opening the drawer keeps focus
 *   on the trigger row and Escape does not close it」(R165 L160-188)；
 * - roving：行锚段恰一 tabindex=0 = approvals.a11y.test.tsx L191；
 * - 复制钮真 button、点击恰一次写剪贴板零请求（click 路径）= 同文件 L205；
 * - 关闭态 apd7-back/apd8-copy 不挂载、apd10-permalink disabled 常驻 = 同文件 L248；
 * - aside 并排语义账：无 role=dialog/aria-modal（缺口台账）=
 *   approvals.detail.a11y.test.tsx it①(R225 L148)；只读字段不进 Tab = 同文件 it②。
 * - R241（approvals.drawer.focus.test.tsx）经查未入库（git log --all 空）=无重叠。
 *
 * 本文件两块现场新锁：
 * ①不加 focus() 的裸打开路径：activeElement 落在哪（现状=不落入抽屉，焦点不移=
 *   缺口台账，工单授权只锁现状禁改码）；抽屉内可聚焦普查（apd7-back/apd8-copy/
 *   apd10-permalink 均真控件在序）+「Tab 循环」前提=无陷阱（jsdom 无 Tab 引擎，
 *   循环不可测，按现状记缺口，与 R225 台账同口径）。
 * ②键盘激活语义：jsdom 不为 <button> 合成 Enter/Space→click（R71/R165 先例），
 *   现状锁=keyDown 不写剪贴板、click 路径恰一次、全程 fetchJSON 计数不变。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...rest }: { children?: React.ReactNode; [key: string]: unknown }) => (
    <button type="button" {...rest}>{children}</button>
  ),
  Card: ({ children, ...rest }: { children?: React.ReactNode; [key: string]: unknown }) => (
    <div {...rest}>{children}</div>
  ),
  CardContent: ({ children, ...rest }: { children?: React.ReactNode; [key: string]: unknown }) => (
    <div {...rest}>{children}</div>
  ),
}));

import ApprovalsHistoryModulePage from "@/modules/approvals/ApprovalsHistoryModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** apd8-copy 只在链路非空时渲染：decisions 必须有一条。 */
const FOCUS_ROW = {
  approvalId: "ap_f42",
  title: "季度预算复审",
  status: "approved",
  riskLevel: "high",
  approvers: [{ userId: "human:7", name: "郑涛" }],
  decisions: [{ approver: "human:7", name: "郑涛", verdict: "approve",
    at: "2026-11-19T02:00:00Z", comment: "同意按计划执行" }],
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
  requestId: "req-f42-12345678",
};

const roots: Root[] = [];
const mounted: HTMLElement[] = [];

function clearScreen() {
  while (roots.length) {
    const root = roots.pop();
    const node = mounted.pop();
    void act(() => {
      root?.unmount();
    });
    node?.remove();
  }
}

afterEach(async () => {
  await act(async () => {
    clearScreen();
  });
  document.body.removeAttribute("data-r242-search");
  api.fetchJSON.mockReset();
});

async function waitFor(what: string, ready: () => boolean) {
  for (let i = 0; i < 600; i += 1) {
    let done = false;
    await act(async () => {
      done = ready();
    });
    if (done) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`waitFor: ${what} never became true`);
}

function render(entry: string) {
  const node = document.createElement("div");
  document.body.appendChild(node);
  mounted.push(node);
  const root = createRoot(node);
  roots.push(root);
  return act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <ApprovalsHistoryModulePage />
      </MemoryRouter>,
    );
  });
}

function q(id: string): Element | null {
  return document.querySelector(`[data-testid="${id}"]`);
}

function clicks(): number {
  return api.fetchJSON.mock.calls.length;
}

function clickEl(el: Element | null | undefined, what: string) {
  expect(el, what).toBeTruthy();
  act(() => {
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

function keyDown(el: Element, key: string) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

function stubClipboard(written: string[]) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (t: string) => {
        written.push(t);
        return Promise.resolve();
      },
    },
  });
}

async function openDetail(id: string) {
  clickEl(q(`apr5-row-${id}`), `row card ${id}`);
  await waitFor(`drawer for ${id}`, () => !!q("apr5-detail"));
}

/** 可聚焦普查选择器（与 R225 白名单同款语义，这里做抽屉正向普查）。 */
const INTERACTIVE = 'a,button,input,select,textarea,[tabindex],[contenteditable="true"]';

function drawerTabbables(): Element[] {
  const drawer = q("apr5-detail");
  expect(drawer, "drawer mounted").toBeTruthy();
  return Array.from(drawer?.querySelectorAll(INTERACTIVE) ?? []).filter(
    (el) => (el as HTMLButtonElement).disabled !== true && el.getAttribute("tabindex") !== "-1",
  );
}

describe("R242 approvals drawer focus & keyboard (current-state locks)", () => {
  it("① a bare open does NOT move focus into the drawer (gap ledger, no code change); drawer controls are all real and tabbable", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      if (url.includes("/api/approval?id=")) return FOCUS_ROW;
      if (url.includes("/api/approvals")) return { items: [FOCUS_ROW] };
      return {};
    });
    await render("/approvals?tab=history");
    await waitFor("row lands", () => !!q("apr5-row-ap_f42"));

    await openDetail("ap_f42");
    // 缺口台账（R225 同款口径）：并排 aside 无 role=dialog/aria-modal、产品不移焦。
    // 现状=裸打开后焦点不在抽屉内（jsdom 的 dispatchEvent click 不移焦，浏览器
    // 行为一致：点 div/Card 主体不聚焦）。工单①期望的「焦点落入首个抽屉控件」
    // 现场不存在，按现状锁死，禁改码。
    const active = document.activeElement;
    expect(
      active?.closest?.('[data-testid="apr5-detail"]') ?? null,
      "现状锁定：打开抽屉不移焦（无焦点陷阱，缺口台账）",
    ).toBeNull();

    // 抽屉内正向普查：动作控件都是真控件、不在 disabled/-1 状态。
    // 现场注记：apd7-back 挂在 aside 内、apr5-detail 主体之外（BackToList 兄弟节点），
    // 返回出口单独按 aside 范围断言。
    const tabbables = drawerTabbables();
    const ids = tabbables.map((el) => el.getAttribute("data-testid") ?? el.tagName);
    expect(ids, "链路复制在序").toContain("apd8-copy");
    expect(tabbables.length, "抽屉内可聚焦件非空").toBeGreaterThan(2);
    const back = document.querySelector('aside[aria-label="记录详情"] [data-testid="apd7-back"]') as HTMLButtonElement | null;
    expect(back, "返回出口在 aside 内、非 disabled").toBeTruthy();
    expect(back?.disabled, "打开态返回钮可激活").toBe(false);

    // 「Tab 循环」前提检查：无 aria-modal（detail.a11y it① 已回证据，这里只补
    // 现状记录——jsdom 没有 Tab 引擎，循环行为不可测，缺口记文件头，禁改码）。
    const aside = document.querySelector('aside[aria-label="记录详情"]');
    expect(aside?.getAttribute("aria-modal"), "非模态=无循环前提").toBeNull();

    // 关闭走 apd7-back：抽屉卸载、关闭零请求（apd7-back 仍为真出口=R165 证据复锁）。
    const before = clicks();
    clickEl(q("apd7-back"), "apd7-back close");
    await waitFor("drawer closed", () => !q("apr5-detail"));
    expect(clicks(), "closing asks for nothing").toBe(before);
  });

  it("② drawer trail button: Enter/Space keydowns never write on their own (jsdom current state), the click path writes exactly once, fetch count frozen", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      if (url.includes("/api/approval?id=")) return FOCUS_ROW;
      if (url.includes("/api/approvals")) return { items: [FOCUS_ROW] };
      return {};
    });
    await render("/approvals?tab=history");
    await waitFor("row lands", () => !!q("apr5-row-ap_f42"));
    await openDetail("ap_f42");

    const written: string[] = [];
    stubClipboard(written);
    const btn = q("apd8-copy") as HTMLButtonElement | null;
    expect(btn, "trail copy button").toBeTruthy();
    const before = clicks();

    // 现状锁：jsdom 不为 <button> 合成 Enter/Space→click（R71/R165 先例）。
    // 浏览器原生会激活；这是测试环境限制，不是产品缺陷——按现状锁 keydown 自身
    // 不触发第二写，真激活语义由 click 路径承担。
    await act(async () => {
      btn?.focus();
    });
    expect(document.activeElement, "复制钮进 tab 序可聚焦").toBe(btn);
    keyDown(btn as Element, "Enter");
    await act(async () => {});
    expect(written.length, "keydown Enter 不合成点击（jsdom 现状）").toBe(0);
    keyDown(btn as Element, " ");
    await act(async () => {});
    expect(written.length, "keydown Space 不合成点击（jsdom 现状）").toBe(0);

    // click 路径：恰一次写 + 状态上屏 + 零请求（「各只触发一次」在此环境的答案）。
    clickEl(btn, "trail copy click");
    await waitFor("trail copy lands", () => written.length === 1);
    clickEl(btn, "trail copy second click");
    await waitFor("second copy lands", () => written.length === 2);
    expect(written[0], "每次点击各写一次，互不合并").not.toBe("");
    expect(
      q("apd8-copy-status")?.textContent,
      "反馈句上屏",
    ).toBe("已复制");
    expect(clicks(), "键盘+复制全程零请求").toBe(before);
  });
});
