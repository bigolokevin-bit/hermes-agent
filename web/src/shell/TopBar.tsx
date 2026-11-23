/* ------------------------------------------------------------------ *
 * Console top bar — UI-DIRECTION-20261123-v2 §3 + UI-FOUNDATION-CONTRACT
 * clause 6 (`single-h1-in-topbar`).
 *
 * One 56px row carrying, in DOM order: the sidebar collapse control, a 12px
 * breadcrumb, and the page's single <h1>. Nothing else. The right-hand global
 * tools (language / theme / identity) still live in the sidebar footer — those
 * are upstream files outside this lane's write scope, so the right side is
 * deliberately empty rather than holding a look-alike dead control.
 *
 * Why a portal: the acceptance gate reads an h1's surface as
 *   inTopbar  = closest("header,[data-testid*='topbar'],[data-testid*='-head']")
 *   inContent = closest("[data-testid*='grid'],main,.duty-grid")
 * and passes only when there is exactly one h1, it sits in the top bar, and no
 * h1 is inside `main`. The routed body renders inside PageHeaderProvider's
 * <main>, and that provider is not this lane's file, so the bar cannot be
 * composed as a child of it. The portal moves the *DOM* into
 * `#shell-topbar-slot` — a direct child of the main column and a sibling of the
 * provider root — while the *React tree* stays where App mounted it, so the bar
 * still reads the router location and the i18n dictionary through normal
 * context. Without the portal the bar would either land inside <main> (clause 6
 * fails by duplicate) or require editing a file this lane does not own.
 *
 * The row height is the frozen skeleton geometry mirrored in shell-layout.ts
 * (TOPBAR_ROW_PX = 56). It is written as a px utility class rather than an
 * inline style attribute, because the direction bans inline sizing and Tailwind's
 * scanner cannot see a TS constant interpolated into a class. No CSS custom
 * property is minted here (the token freeze at 2026-11-23T20:57+08:00 puts any
 * new name behind L0).
 * ------------------------------------------------------------------ */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";

import { useI18n } from "@/i18n/context";
import { resolvePageTitle } from "@/lib/resolve-page-title";
import { CONSOLE_MODULES, findRoute } from "./routes";

/** Mount point rendered by App.tsx in the main column, outside <main>. */
export const SHELL_TOPBAR_SLOT_ID = "shell-topbar-slot";

interface ConsoleTopBarProps {
  /** Sidebar collapse state, owned by App.tsx and persisted via shell-layout. */
  collapsed: boolean;
  onToggleCollapse: () => void;
}

/* Console routes own their title vocabulary. The shell's route table names every
 * module with a Chinese label, and that label is what the single <h1> must show.
 * The upstream resolver used to be the only source here rendered an English word
 * on the dev face: for /overview it misses the nav registry and falls through to
 * a pathname-derived string, so the shell table wins first and the resolver is
 * only consulted off-shell. */
function consoleSurface(pathname: string): { group: string; label: string } | null {
  const hit = findRoute(pathname);
  if (hit === null) return null;
  const meta = CONSOLE_MODULES.find((m) => m.module === hit.entry.module);
  if (meta === undefined) return null;
  return { group: meta.group, label: meta.label };
}

export function ConsoleTopBar({ collapsed, onToggleCollapse }: ConsoleTopBarProps) {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSlot(document.getElementById(SHELL_TOPBAR_SLOT_ID));
  }, []);

  if (slot === null) return null;

  const surface = consoleSurface(pathname);
  // Off-shell routes fall back to the shared resolver, which owns builtin nav
  // labels and residual zh titles. Plugin tabs are not passed down here: an
  // empty list means a plugin route shows the resolver's pathname-derived title
  // rather than a guessed one, and the upstream header still shows its own title
  // on those routes.
  const title = surface !== null ? surface.label : resolvePageTitle(pathname, t, []);

  return createPortal(
    <header
      data-testid="shell-topbar"
      className="z-1 flex h-[56px] shrink-0 items-center gap-3 border-b border-current/20 bg-background-base px-6"
    >
      <Button
        ghost
        size="icon"
        onClick={onToggleCollapse}
        data-testid="shell-sidebar-collapse"
        aria-label={collapsed ? t.common.expand : t.common.collapse}
        className="hidden lg:flex text-text-secondary hover:text-midground"
      >
        {collapsed ? (
          <PanelLeftOpen className="h-4 w-4" />
        ) : (
          <PanelLeftClose className="h-4 w-4" />
        )}
      </Button>

      <div className="flex min-w-0 flex-col justify-center">
        <span
          data-testid="shell-topbar-crumb"
          className="console-note truncate text-[length:var(--font-size-ls-1)] leading-[var(--line-height-ls-2)]"
        >
          {surface === null ? "数字员工控制台" : `${surface.group} · 控制台`}
        </span>
        <h1
          data-testid="shell-topbar-title"
          className="truncate text-[length:var(--font-size-ls-5)] leading-[var(--line-height-ls-1)] font-medium text-midground"
        >
          {title}
        </h1>
      </div>
    </header>,
    slot,
  );
}
