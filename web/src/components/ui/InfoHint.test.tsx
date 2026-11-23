// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GLOSSARY, type GlossaryTerm } from "./glossary";
import { InfoHint } from "./InfoHint";

// L0 令（@1348@）：InfoHint 组件本体三形制自钉。
// 本仓没有 @testing-library/react，沿用 ui 层既有形制：createRoot + act + 原生事件。
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const mount = (term: GlossaryTerm, label?: string) =>
  act(() => root.render(label ? <InfoHint term={term}>{label}</InfoHint> : <InfoHint term={term} />));

const trigger = () =>
  container.querySelector<HTMLButtonElement>('[data-testid^="hint-"] button.ui-hint-trigger');
const pop = () =>
  container.querySelector<HTMLElement>('[data-testid$="-pop"]');

describe("InfoHint 组件本体三形制", () => {
  it("①弹层文本＝glossary 全局唯一定义，页面自带文案不得覆盖", () => {
    (Object.keys(GLOSSARY) as GlossaryTerm[]).forEach((term) => {
      mount(term, "我自己写的一句");
      const t = trigger();
      expect(t, `trigger for ${term}`).toBeTruthy();
      act(() => t!.dispatchEvent(new MouseEvent("mouseEnter", { bubbles: true })));
      const p = pop();
      expect(p?.textContent, `弹层必须原样取 glossary[${term}]`).toContain(GLOSSARY[term].text);
      // 页面自带的只有标签权，不得进弹层
      expect(p?.textContent, "页面文案不得混进弹层").not.toContain("我自己写的一句");
      act(() => t!.dispatchEvent(new MouseEvent("mouseLeave", { bubbles: true })));
      expect(pop()?.getAttribute("data-open"), "mouseLeave 必须收起").toBe("false");
      act(() => root.unmount());
      container.innerHTML = "";
      root = createRoot(container);
    });
  });

  it("②键盘可达：Tab 落触发器、focus 即展开、aria-describedby 指向弹层、Esc 关闭并回焦", () => {
    mount("duty.ready", "可上岗");
    const t = trigger()!;
    expect(t.tagName, "触发器必须是真 button（可 Tab 聚焦）").toBe("BUTTON");
    expect(t.getAttribute("aria-label"), "可访问名带术语").toBe("解释：duty.ready");
    expect(t.getAttribute("aria-expanded"), "初始未展开").toBe("false");
    expect(t.getAttribute("aria-describedby"), "收起时不得留悬空-describedby").toBeNull();
    act(() => t.focus());
    act(() => t.dispatchEvent(new FocusEvent("focus")));
    const p = pop()!;
    expect(p.getAttribute("data-open"), "focus 必须展开").toBe("true");
    expect(t.getAttribute("aria-expanded")).toBe("true");
    expect(t.getAttribute("aria-describedby"), "describedby 必须等于弹层 id").toBe(p.id);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(pop()?.getAttribute("data-open"), "Esc 必须关闭").toBe("false");
    expect(document.activeElement, "关闭后焦点必须回到触发器").toBe(t);
  });

  it("③解释性文字只走 InfoHint：标签/页面文案不得再出现口径、说明：、注：", () => {
    const BLURB = /口径|说明[:：]|注[:：]/;
    (Object.keys(GLOSSARY) as GlossaryTerm[]).forEach((term) => {
      mount(term, "可上岗");
      const label = container.querySelector(".ui-hint-label");
      expect(label?.textContent, "标签不得携带解释句").not.toMatch(BLURB);
      act(() => trigger()!.dispatchEvent(new MouseEvent("mouseEnter", { bubbles: true })));
      const p = pop()!;
      // 唯一允许携带解释正文的地方就是弹层本身，且正文必须来自 glossary
      expect(p.textContent, `弹层正文必须等于 glossary[${term}]`).toContain(GLOSSARY[term].text);
      expect(GLOSSARY[term].text.length, "单条定义 ≤45 汉字").toBeLessThanOrEqual(45);
      act(() => root.unmount());
      container.innerHTML = "";
      root = createRoot(container);
    });
  });
});
