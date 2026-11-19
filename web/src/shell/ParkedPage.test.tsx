// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";

import { ParkedPage, ParkedAwareSystem } from "./ParkedPage";

// A.3 consolidation: the parked zone lists all eight shelved upstream
// entries, links each to its original path, and never counts as IA.
describe("ParkedPage (PRD A.3)", () => {
  let container: HTMLDivElement;
  let root: Root;

  const mount = (element: React.ReactElement, entry = "/system?tab=parked") => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={[entry]}>{element}</MemoryRouter>,
      );
    });
  };

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const setup = () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    return container;
  };

  it("renders the banner and all eight parked entries with their paths", () => {
    setup();
    mount(<ParkedPage />);
    const banner = container.querySelector('[data-testid="parked-banner"]');
    expect(banner?.textContent).toContain("未纳入信息架构");
    const keys = ["files", "logs", "cron", "plugins", "pairing", "webhooks", "env", "docs"];
    for (const key of keys) {
      const card = container.querySelector(`[data-testid="parked-item-${key}"]`);
      expect(card, `parked-item-${key}`).toBeTruthy();
    }
    const hrefs = Array.from(container.querySelectorAll("[data-testid^='parked-item-']")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/files", "/logs", "/cron", "/plugins", "/pairing", "/webhooks", "/env", "/docs"]);
    expect(container.textContent).toContain("最近复核：2026-11-19");
  });

  it("each card names the reason and the owning lane", () => {
    setup();
    mount(<ParkedPage />);
    const card = container.querySelector('[data-testid="parked-item-files"]');
    expect(card?.textContent).toContain("文件浏览暂不纳入 IA");
    expect(card?.textContent).toContain("负责车道：");
  });

  it("tab=parked renders the parked page instead of the system tab", () => {
    setup();
    mount(
      <ParkedAwareSystem system={<div data-testid="sys" />} />,
      "/system?tab=parked",
    );
    expect(container.querySelector('[data-testid="parked-page"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="sys"]')).toBeNull();
  });

  it("plain /system keeps its original content untouched", () => {
    setup();
    mount(<ParkedAwareSystem system={<div data-testid="sys" />} />, "/system");
    expect(container.querySelector('[data-testid="sys"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="parked-page"]')).toBeNull();
  });
});
