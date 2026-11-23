// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { Tabs as DsTabs, TabsTrigger as DsTabsTrigger } from "@nous-research/ui/ui/components/tabs";
import { UiTabs } from "./Tabs";

/**
 * UiTabs 的行为级自证（L0 点单：禁只报「已改」）。
 * 钉两件事：方向键真的能在 Tab 间移动焦点，且移动的是焦点本身
 * ——选中态只改 aria-selected / tabIndex，不把焦点抢回选中项。
 */
const ITEMS = [
  { value: "config", label: "配置" },
  { value: "runs", label: "运行" },
  { value: "evidence", label: "证据" },
];

let root: Root | null = null;

function mount(node: React.ReactElement): HTMLElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root?.render(node);
  });
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

const tabsIn = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLElement>('[role="tab"]')];

const aria = (list: HTMLElement[]) =>
  list.map((tab) => tab.getAttribute("aria-selected"));

const key = (node: HTMLElement, code: string) => {
  act(() => {
    node.dispatchEvent(
      new KeyboardEvent("keydown", { key: code, bubbles: true, cancelable: true }),
    );
  });
};

function renderTabs(): { host: HTMLElement; tabs: HTMLElement[] } {
  const host = mount(
    <UiTabs ariaLabel="分区" items={ITEMS} defaultActive="config">
      {(active) => <p data-testid="panel-text">{active}</p>}
    </UiTabs>,
  );
  return { host, tabs: tabsIn(host) };
}

describe("UiTabs 键盘与 ARIA 语义", () => {
  it("补上了 DS 缺的 tablist / tab / aria-selected / roving tabindex", () => {
    const { host, tabs } = renderTabs();
    expect(host.querySelector('[role="tablist"]'), "必须有 tablist").toBeTruthy();
    expect(tabs).toHaveLength(3);
    expect(aria(tabs)).toEqual(["true", "false", "false"]);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
    expect(tabs[0].id).toBe("ui-tabs-tab-config");
    expect(tabs[0].getAttribute("aria-controls")).toBe("ui-tabs-panel-config");
  });

  it("方向键移动焦点即切换，焦点不被选中态夺走", () => {
    const { tabs } = renderTabs();
    act(() => tabs[0].focus());
    expect(document.activeElement).toBe(tabs[0]);

    key(tabs[0], "ArrowRight");
    expect(document.activeElement, "焦点必须跟着方向键走").toBe(tabs[1]);
    expect(aria(tabs)).toEqual(["false", "true", "false"]);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, 0, -1]);
    expect(document.querySelector('[data-testid="panel-text"]')?.textContent).toBe(
      "runs",
    );

    key(document.activeElement as HTMLElement, "ArrowLeft");
    expect(document.activeElement).toBe(tabs[0]);
    expect(aria(tabs)).toEqual(["true", "false", "false"]);
  });

  it("首尾环绕，Home / End 跳两端", () => {
    const { tabs } = renderTabs();
    act(() => tabs[0].focus());
    key(tabs[0], "ArrowLeft");
    expect(document.activeElement).toBe(tabs[2]);
    key(tabs[2], "ArrowRight");
    expect(document.activeElement).toBe(tabs[0]);

    key(tabs[0], "End");
    expect(document.activeElement).toBe(tabs[2]);
    key(tabs[2], "Home");
    expect(document.activeElement).toBe(tabs[0]);
  });

  it("面板 aria-labelledby 跟着当前 Tab 走", () => {
    const { tabs } = renderTabs();
    const panel = () => document.querySelector('[role="tabpanel"]');
    expect(panel()?.getAttribute("aria-labelledby")).toBe("ui-tabs-tab-config");
    key(tabs[0], "ArrowRight");
    expect(panel()?.getAttribute("aria-labelledby")).toBe("ui-tabs-tab-runs");
  });

  it("反证：DS 裸 TabsTrigger 确实不写这些语义（缺口是真的）", () => {
    const host = mount(
      <DsTabs defaultValue="a">
        {() => <DsTabsTrigger active value="a">甲</DsTabsTrigger>}
      </DsTabs>,
    );
    expect(host.querySelectorAll('[role="tab"]').length, "DS 不给 role=tab").toBe(0);
    expect(host.querySelectorAll('[role="tablist"]').length).toBe(0);
  });
});
