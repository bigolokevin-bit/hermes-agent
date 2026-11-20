/**
 * ConsoleButton — the console's three-tier button scale, hand-drawn.
 *
 * WHY: the design-system `Button` bakes `text-display … tracking-[0.2em]`
 * (plus `tracking-[0.15em]` at size sm) into its base classes. That is a
 * display-face letter-spacing meant for short Latin eyebrows; on Chinese
 * labels it reads as 「重 试」/「刷 新」. Modules keep the library control (the
 * global rule in `src/index.css` zeroes its letter spacing instead); this is
 * the replacement for the surfaces where the console owns the chrome: the
 * shell's forced-state actions, the load-error retry, and the page-level
 * 刷新/重试 buttons.
 *
 * Tiers, mapped onto the shell token system (`src/shell/tokens.css`) so the
 * component stays inside the zero-UI-import discipline and reads correctly on
 * both the console shell and the pages:
 *   primary   — solid emphasis: the palette's strongest fill, foreground
 *               reversed onto it (the shell has no `--accent-solid`; 值班台
 *               hierarchy is carried by fill vs. outline, not by hue)
 *   secondary — outline: `var(--color-surface)` fill with `var(--color-border-subtle)` border, which
 *               is what the shell's forced-state buttons already looked like
 *   ghost     — no fill, no border; a tinted background only on hover
 *
 * Presentation only: it owns no state beyond the browser's own button
 * behaviour, and `letter-spacing: normal` is set inline so no descendant
 * utility can reintroduce the display tracking on CJK copy.
 */

import type { ReactNode } from "react";

export type ConsoleButtonVariant = "primary" | "secondary" | "ghost";

export interface ConsoleButtonProps {
  variant?: ConsoleButtonVariant;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
  className?: string;
  "data-testid"?: string;
  "aria-label"?: string;
}

/* UI-RUBRIC v1 §7 heights ride the tokens: inline 28 / default 32 / dialog 36.
 * Hit-area rule (32×32) is met at the row level for the 28px inline tier —
 * registered as exception E4 in docs/design/UI-RUBRIC.md. */
const SIZES: Record<"sm" | "md" | "lg", { cls: string; h: string }> = {
  sm: { cls: "px-3 text-xs", h: "var(--btn-h-inline)" },
  md: { cls: "px-3 text-sm", h: "var(--btn-h)" },
  lg: { cls: "px-4 text-sm", h: "var(--btn-h-dialog)" },
};

export function ConsoleButton({
  variant = "secondary",
  size = "sm",
  children,
  onClick,
  type = "button",
  disabled = false,
  title,
  className,
  "data-testid": testId,
  "aria-label": ariaLabel,
}: ConsoleButtonProps) {
  const tier = {
    primary: {
      style: {
        background: "var(--color-text)",
        borderColor: "transparent",
        color: "var(--color-bg)",
        fontWeight: 600,
      },
      hover: "hover:opacity-90",
    },
    secondary: {
      style: {
        background: "var(--color-surface)",
        borderColor: "var(--color-border-subtle)",
        color: "var(--color-text)",
      },
      hover: "hover:bg-[var(--color-surface-raised)]",
    },
    ghost: {
      style: {
        background: "transparent",
        borderColor: "transparent",
        color: "var(--color-text-muted)",
      },
      hover: "hover:bg-accent/60",
    },
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      data-testid={testId}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-sm border",
        "tracking-normal",
        SIZES[size].cls,
        tier.hover,
        "focus-visible:[outline:var(--focus-ring)] focus-visible:outline-offset-2",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        className ?? "",
      ].join(" ")}
      style={{
        ...tier.style,
        letterSpacing: "normal",
        height: SIZES[size].h,
        minWidth: "var(--btn-hit-min)",
      }}
    >
      {children}
    </button>
  );
}
