// @vitest-environment jsdom
// 设计车道 ④ — 空/错态占位条的外壳侧契约（轻量，只钉表现层纪律）。
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { StatePlaceholder } from "./StatePlaceholder";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const block = (): Element | null => container.querySelector("[data-state-placeholder]");
const bars = (): Element[] => [...(block()?.querySelectorAll(":scope > div") ?? [])];

describe("StatePlaceholder (设计车道 ④)", () => {
  it("is decoration: hidden from assistive tech, carries no text, never claims to load", () => {
    act(() => root.render(<StatePlaceholder />));
    expect(block()?.getAttribute("aria-hidden")).toBe("true");
    expect(block()?.textContent).toBe("");
    // 空/错态是「已落定」的状态：占位条不得冒充加载（aria-busy 是骨架的标记）。
    expect(block()?.getAttribute("aria-busy")).toBeNull();
  });

  it("counts 3~5 bars off the rows ladder and stays out of the .animate-pulse contract", () => {
    act(() => root.render(<StatePlaceholder />));
    expect(bars()).toHaveLength(4); // 标题条 + 3 条内容

    act(() => root.render(<StatePlaceholder rows={1} />));
    expect(bars()).toHaveLength(2);

    act(() => root.render(<StatePlaceholder rows={9} />));
    expect(bars()).toHaveLength(5); // 上限 5 条，克制

    // 结算后的空/错态里不得出现 .animate-pulse：全仓 ~20 个 settle helper 把它
    // 当加载信号等它消失（pages/ApprovalsPage.test.tsx:35 等）。
    expect(container.querySelector(".animate-pulse")).toBeNull();
    // 条宽只有百分比阶梯，没有固定 px 宽 ⇒ 375 撑不出横向溢出。
    expect(bars().every((bar) => /\bw-(full|2\/3|5\/6|3\/4|1\/2)\b/.test(bar.className))).toBe(
      true,
    );
  });
});
