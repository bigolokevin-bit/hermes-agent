import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";

import "./ui.css";

/**
 * Textarea 的形制档位（设计系统包根 v0.19.1 未导出 textareaVariants，
 * 由本层自定）：值指向 ui.css 里的令牌类名，调用方按档拼类，禁内联 style。
 */
export type UiTextareaSize = "sm" | "md" | "lg";

export const TextareaVariants = {
  base: "ui-textarea",
  size: { sm: "ui-textarea-sm", md: "", lg: "ui-textarea-lg" },
} as const;

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * 多行输入基元：设计系统没有 Textarea 组件（只发了 textareaVariants 且未在包根导出），
 * 故本层自带一个纯令牌版：形状只读 ui.css 的 .ui-textarea，禁内联 style 与裸 px。
 * 用法：<UiTextarea id="note" value={text} onChange={(e) => setText(e.target.value)} />
 */
export const UiTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function UiTextarea({ className, ...rest }, ref) {
    return <textarea {...rest} className={["ui-textarea", className].filter(Boolean).join(" ")} ref={ref} />;
  },
);
