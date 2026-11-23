import { useEffect } from "react";
import { useTheme } from "../themes/context";

/**
 * L4-nav (UI-NAV) — the single day/night control for the console sidebar.
 *
 * Design contract (docs/product/design/UI-DIRECTION-20261123.md §c):
 *   - exactly ONE day/night button in the sidebar, `type="button"` with
 *     `aria-pressed`, accessible name 「夜间模式」;
 *   - the existing theme context stays the single source of preference, so
 *     persistence keeps using its `hermes-dashboard-theme` localStorage key —
 *     this component never touches storage directly;
 *   - the root element mirrors the resolved mode via `data-console-theme`
 *     ("light" | "dark") as the CSS output hook;
 *   - first run stays on the built-in default (dark, "Hermes Teal").
 *
 * Mode mapping (current preset set): `nous-blue` is the light preset, every
 * other built-in name reads as dark. When UI-TOKENS lands dedicated light/dark
 * tokens this mapping is the single place to update.
 */

export const LIGHT_THEME_NAME = "nous-blue";
export const DARK_THEME_NAME = "default";

export type ConsoleThemeMode = "light" | "dark";

export function themeModeOf(themeName: string): ConsoleThemeMode {
  return themeName === LIGHT_THEME_NAME ? "light" : "dark";
}

interface ThemeToggleProps {
  /** Visual variant for the collapsed icon rail vs the expanded sidebar. */
  collapsed?: boolean;
}

export function ThemeToggle({ collapsed = false }: ThemeToggleProps) {
  const { themeName, setTheme } = useTheme();
  const mode = themeModeOf(themeName);
  const nightOn = mode === "dark";

  // CSS output hook: mirror the resolved mode onto the document root.
  useEffect(() => {
    document.documentElement.dataset.consoleTheme = mode;
  }, [mode]);

  const toggle = () => {
    setTheme(nightOn ? LIGHT_THEME_NAME : DARK_THEME_NAME);
  };

  return (
    <button
      type="button"
      aria-pressed={nightOn}
      aria-label="夜间模式"
      data-testid="nav5-theme-toggle"
      data-console-theme={mode}
      className={
        "console-theme-toggle inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm" +
        (collapsed ? " justify-center" : "")
      }
      onClick={toggle}
    >
      <span aria-hidden="true">{nightOn ? "🌙" : "☀️"}</span>
      {collapsed ? null : <span>{nightOn ? "夜间" : "日间"}</span>}
    </button>
  );
}

export default ThemeToggle;
