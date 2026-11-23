// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { UiCard, UiCardRow } from "./Card";

const CSS = readFileSync("src/components/ui/ui.css", "utf8");
const block = (selector: string) => {
  const at = CSS.indexOf(selector + " {");
  expect(at, `ui.css 必须有 ${selector} 规则`).toBeGreaterThanOrEqual(0);
  return CSS.slice(at, CSS.indexOf("}", at));
};

let container: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(ui: React.ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(ui));
}

describe("UiCard 固定槽位与同排等高", () => {
  it("只渲染给到的槽位，缺的槽不留空节点", () => {
    render(
      <UiCard
        title="可上岗"
        metric={12}
        metricLabel="人"
        action={<a href="/employees">查看明细</a>}
        testId="card-ready"
      />,
    );
    const slots = [...container.querySelectorAll("[data-ui-card-slot]")].map(
      (n) => n.getAttribute("data-ui-card-slot"),
    );
    expect(slots).toEqual(["title", "metric", "foot"]);
    expect(container.querySelector('[data-ui-card-slot="note"]')).toBeNull();
    expect(container.querySelector('[data-ui-card-slot="body"]')).toBeNull();
    expect(container.textContent).toContain("可上岗");
    expect(container.textContent).toContain("人");
  });

  it("底部出口永远在场，明细只能经它离开卡片", () => {
    render(
      <UiCard title="今日成本" note="账本还缺 3 人的金额" testId="card-cost" />,
    );
    const foot = container.querySelector('[data-ui-card-slot="foot"]');
    expect(foot, "没有 action 也要留底部槽位，等高机制靠它贴边").not.toBeNull();
    expect(foot?.childElementCount).toBe(0);
    render(
      <UiCard
        title="今日成本"
        action={<a href="/metrics?tab=cost">查看全部</a>}
        testId="card-cost-2"
      />,
    );
    const link = container.querySelector('[data-ui-card-slot="foot"] a');
    expect(link?.getAttribute("href")).toBe("/metrics?tab=cost");
  });

  it("UiCardRow 是同排等高的唯一容器，列数由 data-cols 决定", () => {
    render(
      <UiCardRow cols={3} testId="row-kpi">
        <UiCard title="可上岗" metric={12} action={<a href="/employees">查看明细</a>} />
        <UiCard title="今日运行" metric={3} action={<a href="/runs">查看明细</a>} />
        <UiCard title="今日成本" metric="$1.5" action={<a href="/metrics">查看明细</a>} />
      </UiCardRow>,
    );
    const row = container.querySelector("[data-ui-card-row]") as HTMLElement;
    expect(row, "卡片必须包在 UiCardRow 里才享有等高").not.toBeNull();
    expect(row.getAttribute("data-cols")).toBe("3");
    expect(container.querySelectorAll(".ui-card").length).toBe(3);
    expect(row.getAttribute("data-testid")).toBe("row-kpi");
  });

  it("等高与截断的唯一实现源在 CSS 里（页面不得再自己写一遍）", () => {
    expect(block(".ui-card-row")).toMatch(/align-items:\s*stretch/);
    expect(block('.ui-card-row[data-cols="3"]')).toMatch(/repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(block(".ui-card")).toMatch(/display:\s*flex/);
    expect(block(".ui-card")).toMatch(/flex-direction:\s*column/);
    expect(block(".ui-card-foot")).toMatch(/margin-block-start:\s*auto/);
    expect(block(".ui-card-note")).toMatch(/-webkit-line-clamp:\s*2/);
  });

  it("卡片字号只准六档令牌，禁字面 px 与内联 style", () => {
    const cardCss = CSS.slice(CSS.indexOf("/* ── UI-F 固定槽位卡片"));
    const sizes = [...cardCss.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(sizes.length, "卡片块必须显式声明字号").toBeGreaterThanOrEqual(6);
    for (const s of sizes) {
      expect(s, `字号必须是六档令牌之一，实际=${s}`).toMatch(
        /^var\(--font-size-ls-[1-6]\)$/,
      );
    }
    expect(cardCss).not.toMatch(/style=\{/);
  });
});
