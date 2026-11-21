// @vitest-environment jsdom
// R256 — 复制控件的键盘与兜底：可达性不靠口头承诺，钉的是 DOM 现状。
//
// 已覆盖、这里不重写（只回证据）：
// - `detailCopy.test.tsx:147`（R121）：原生 button、type="button"、aria-label「复制该事件」、
//   focus() 落位、单击恰一枚投递（clip.calls==[LINE]）、播报「已复制」、role="status"、
//   投递前后 urls() 逐字不变（复制不发请求）；
// - `detailCopy.test.tsx:174`（R121）：剪贴板拒用 ⇒ aud-detail-copy-fallback 只读 textarea，
//   值与投递文本逐字相等；
// - `detailCopy.test.tsx:194`（R121）：无选中时控件仍在、disabled、title 给原因。
//
// 本文件只补真正没钉过的三处：
// ① 未选中的 disabled 控件【不在可聚焦序列】——focus() 尝试后 activeElement 不是它
//    （disabled 原生按钮离开 Tab 序是 DOM 现状；此前只钉过 disabled 与 title 本身）；
// ② 播报是【唯一】的 polite live region：aud-detail-copy-status 计数 1，
//    aria-live="polite" 属性此前从未钉过（只钉过 role）；含「已复制」文本的元素恰 1；
// ③ Enter/Space 键盘事件【不产生第二条触发路径】：产品该按钮只声明 onClick，没有
//    任何 onKeyDown 处理器；jsdom 也不为原生 button 从 keydown 合成 click。
//    按现状钉：派发 Enter 与 Space 的 keydown/keyup 后，投递不增、播报不变、
//    fetchJSON 计数逐字不变。真实浏览器的按键激活属平台行为，本波不臆造——这与带
//    onKeyDown 的桶钮（主测试 :2151/:2167）对照：有处理器的控件才响应按键，这个没有。
//
// 语境现状：未选中时列表页本身就挂着 event=null 的 DetailCopy（:1390），选中态由
// 抽屉里的同款（views.tsx:405）承担——「复制该事件」全页恰一枚，两种语境都测得到。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { auditCopyText } from "@/modules/audit/detailCopy";
import { auditDetailFrom } from "@/modules/audit/model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ID = "evt_present_00000001";
const RECORD = {
  eventId: ID,
  action: "task.created",
  occurredAt: "2026-11-19T01:20:00Z",
  outcome: "succeeded",
  actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" },
  resource: { type: "approval", id: "ap_1122334455667788" },
  requestId: "req-20261119-0a7b3c",
  correlationId: "cor-00112233445566",
};
// 投递句由模型事件生成——auditCopyText 吃的是 model 的 label 形状（R121 同款装配）。
const EVENT = auditDetailFrom({ audit: RECORD });
const LINE = auditCopyText(EVENT!);

let root: Root | null = null;
const clip: { calls: string[] } = { calls: [] };

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

async function render(entry: string): Promise<void> {
  await act(async () => {
    if (root) act(() => root?.unmount());
  });
  root = null;
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <AuditEventsModulePage />
      </MemoryRouter>,
    );
  });
  await waitFor(
    () => document.querySelector(`[data-testid='aud01-row-${ID}']`) !== null,
    "the row is on screen",
  );
}

function node(testId: string): Element | null {
  return document.querySelector(`[data-testid='${testId}']`);
}

function button(): HTMLElement {
  const control = node("aud-detail-copy");
  expect(control, "aud-detail-copy").not.toBeNull();
  return control as HTMLElement;
}

function status(): string {
  return node("aud-detail-copy-status")?.textContent?.trim() ?? "";
}

function urls(): string[] {
  return api.fetchJSON.mock.calls.map((call) => String(call[0]));
}

function pressKey(target: HTMLElement, key: string): Promise<void> {
  return act(async () => {
    for (const type of ["keydown", "keyup"] as const) {
      target.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }));
    }
    await Promise.resolve();
  });
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  clip.calls = [];
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (text: string) =>
        new Promise<void>((resolve) => {
          clip.calls.push(text);
          resolve();
        }),
    },
  });
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) return { audit: RECORD };
    return { items: [RECORD], nextCursor: null };
  });
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R256 - the copy control's place in the focus sequence", () => {
  it("is a native button that can be tabbed to, and leaves the tab sequence when disabled", async () => {
    await render(`/audit?window=7d&detail=${ID}&limit=25`);
    const control = button();
    expect(control.tagName).toBe("BUTTON");
    // 选中态：可达、无 tabindex 干预（Tab 自然停在原生按钮上，无键盘陷阱）。
    expect(control.hasAttribute("disabled")).toBe(false);
    await act(async () => {
      control.focus();
    });
    expect(document.activeElement).toBe(control);
    expect(document.querySelectorAll("[data-testid='aud-detail-copy'][tabindex='-1']")).toHaveLength(0);

    // 未选中语境（列表页无 detail=）：同一控件 disabled，focus() 不再落位——
    // disabled 的原生按钮离开可聚焦序列，这是 DOM 现状，此前只钉过 disabled+title 本身。
    await render("/audit?window=7d&limit=25");
    const idle = button();
    expect(idle.hasAttribute("disabled")).toBe(true);
    await act(async () => {
      idle.focus();
    });
    expect(document.activeElement).not.toBe(idle);
    expect(document.querySelectorAll("[data-testid='aud-detail-copy'][tabindex='-1']")).toHaveLength(0);
  });
});

describe("R256 - one polite announcement, and keys that start nothing", () => {
  it("announces once through one polite live region, and keys never start a second path", async () => {
    await render(`/audit?window=7d&detail=${ID}&limit=25`);
    const control = button();
    clip.calls = [];

    await act(async () => {
      control.click();
    });
    await waitFor(() => status() === "已复制", "the copy announced once");
    expect(clip.calls).toEqual([LINE]);
    const ledger = urls();

    // 播报唯一且 aria-live="polite" 首钉（R121 只钉过 role="status"）。
    const live = document.querySelectorAll("[data-testid='aud-detail-copy-status']");
    expect(live).toHaveLength(1);
    expect(live[0]?.getAttribute("role")).toBe("status");
    expect(live[0]?.getAttribute("aria-live")).toBe("polite");
    const spoken = Array.from(document.querySelectorAll("p,span")).filter(
      (element) => element.textContent?.trim() === "已复制",
    );
    expect(spoken).toHaveLength(1);

    // Enter 与 Space：按钮没有 onKeyDown，jsdom 也不合成原生激活 ⇒ 按键不产生
    // 第二条触发路径（现状钉，绝不臆造「键盘触发复制」；真实浏览器行为另归平台）。
    await pressKey(control, "Enter");
    await pressKey(control, " ");
    expect(clip.calls).toHaveLength(1);
    expect(status()).toBe("已复制");
    expect(urls()).toEqual(ledger);

    // 单击腿本身归 R121:147；这里再点一次确认【一击一枚】且全程零请求。
    await act(async () => {
      control.click();
    });
    await waitFor(() => clip.calls.length === 2, "the deliberate click lands");
    expect(urls()).toEqual(ledger);
    // 成功态不渲染兜底（拒用→只读 textarea 那条腿归 R121:174）。
    expect(node("aud-detail-copy-fallback")).toBeNull();
  });
});
