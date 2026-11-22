import type { ComponentProps, ReactNode } from "react";
import { Button as DSButton } from "@nous-research/ui";

/** DS Button 的真实属性面：不编造属性，缺什么就显式补什么。 */
type DSButtonProps = ComponentProps<typeof DSButton>;

/**
 * UI-F 四档语义钮。DS 的 Button 只有 `outlined` / `destructive` 两个形状开关，
 * 没有 variant / icon 属性（见 dist 声明里那 289 个属性中没有 variant），所以：
 * primary = 两个开关都不给；secondary = outlined；danger = destructive；
 * ghost = outlined 之外再加 `.ui-button-ghost`（去面色，只留文字与焦点环）。
 * 用法：`<Button variant="danger" onClick={stop}>停用</Button>`
 */
export type UiButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export type UiButtonProps = Omit<DSButtonProps, "outlined" | "destructive"> & {
  variant?: UiButtonVariant;
  /** 只做图标时必填 aria-label，否则读屏只剩一个没有名字的按钮。 */
  iconOnly?: boolean;
  children?: ReactNode;
};

export function Button({
  variant = "primary",
  className,
  iconOnly = false,
  "aria-label": ariaLabel,
  ...rest
}: UiButtonProps) {
  const shape = {
    outlined: variant === "secondary" || variant === "ghost",
    ...(variant === "danger" ? { destructive: true } : null),
  };
  const classes = [
    iconOnly ? "ui-button-icon" : null,
    variant === "ghost" ? "ui-button-ghost" : null,
    className,
  ].filter(Boolean);
  return (
    <DSButton
      {...rest}
      {...shape}
      aria-label={ariaLabel}
      className={classes.length > 0 ? classes.join(" ") : undefined}
    />
  );
}

/** 命名兼容：barrel 与页面都用 UiButton* 前缀，便于与 DS 原生钮区分。 */
export { Button as UiButton };
export type { DSButtonProps as UiButtonBaseProps };
