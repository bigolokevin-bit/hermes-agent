// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// The toggle must talk to the existing theme context and nothing else; stub
// the context so the test pins the wiring, not the provider internals.
const setTheme = vi.fn();
let themeName = "default";

vi.mock("../themes/context", () => ({
  useTheme: () => ({ themeName, setTheme }),
}));

import { ThemeToggle, themeModeOf, LIGHT_THEME_NAME, DARK_THEME_NAME } from "./ThemeToggle";

function mountToggle(props: { collapsed?: boolean } = {}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root: Root = createRoot(host);
  act(() => {
    root.render(<ThemeToggle {...props} />);
  });
  return { host, root };
}

describe("ThemeToggle — single day/night control (UI-DIRECTION §c)", () => {
  beforeEach(() => {
    setTheme.mockClear();
    themeName = "default";
    document.documentElement.removeAttribute("data-console-theme");
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("maps presets to modes: nous-blue is light, everything else dark", () => {
    expect(themeModeOf("nous-blue")).toBe("light");
    expect(themeModeOf("default")).toBe("dark");
    expect(themeModeOf("midnight")).toBe("dark");
  });

  it("renders one button named 夜间模式, pressed while dark, root mirrors mode", () => {
    const { host } = mountToggle();
    const buttons = [...host.querySelectorAll("button")].filter(
      (b) => b.getAttribute("aria-label") === "夜间模式",
    );
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute("type")).toBe("button");
    expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.getAttribute("data-console-theme")).toBe("dark");
  });

  it("clicking in dark switches to the light preset via the shared context", () => {
    const { host } = mountToggle();
    const btn = host.querySelector<HTMLElement>("[data-testid='nav5-theme-toggle']")!;
    act(() => {
      btn.click();
    });
    expect(setTheme).toHaveBeenCalledWith(LIGHT_THEME_NAME);
  });

  it("clicking in light returns to the dark preset and aria-pressed clears", () => {
    themeName = LIGHT_THEME_NAME;
    const { host } = mountToggle();
    const btn = host.querySelector<HTMLElement>("[data-testid='nav5-theme-toggle']")!;
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(document.documentElement.getAttribute("data-console-theme")).toBe("light");
    act(() => {
      btn.click();
    });
    expect(setTheme).toHaveBeenCalledWith(DARK_THEME_NAME);
  });

  it("collapsed variant keeps a single control without extra text nodes", () => {
    const { host } = mountToggle({ collapsed: true });
    expect(host.querySelectorAll("[data-testid='nav5-theme-toggle']")).toHaveLength(1);
    expect(host.textContent).not.toContain("夜间");
    expect(host.textContent).not.toContain("日间");
  });

  it("no language switcher renders inside the toggle area", () => {
    const { host } = mountToggle();
    expect(host.textContent).not.toMatch(/中文|English/);
  });
});
