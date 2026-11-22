import type { ComponentProps, ReactNode } from "react";

import { Button as DSButton } from "@nous-research/ui";

import "./ui.css";

/**
 * 按钮基元：四档语义（主/次/危险/幽灵），内部映射到设计系统 Button。
 * 「幽灵」＝设计系统的 text 档（该包无 ghost 档），这是本层唯一允许的档位映射，
 * 不是新造视觉；命中区靠容器保障，禁给钮补高（UI-RUBRIC E4）。
 * 用法：<UiButton variant="danger" onClick={stop}>停用</UiButton>
 *       纯图标钮必须带 aria-label：<UiButton icon variant="secondary" aria-label="复制">…</UiButton>
 */
export type UiButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type DSButtonProps = ComponentProps<typeof DSButton>;

const VARIANT: Record<UiButtonVariant, DSButtonProps["variant"]> = {
  primary: "primary",
  secondary: "secondary",
  danger: "danger",
  ghost: "text",
};

export type UiButtonProps = Omit<DSButtonProps, "variant"> & {
  variant?: UiButtonVariant;
};

export function UiButton(props: UiButtonProps): ReactNode {
  const { variant = "secondary", className, ...rest } = props;
  const cls = [className, rest.icon ? "ui-button-icon" : undefined].filter(Boolean).join(" ");
  return <DSButton {...rest} className={cls || undefined} variant={VARIANT[variant]} />;
}
