import type { ComponentProps, ReactNode } from "react";

import { Input as DSInput } from "@nous-research/ui";

import "./ui.css";

/**
 * 输入基元：单行输入直接复用设计系统 Input（尺寸/焦点/错误文案已由它管）。
 * 用法：<UiInput id="keyword" value={q} onChange={setQ} placeholder="搜会话标题" />
 */
type DSInputProps = ComponentProps<typeof DSInput>;

export function UiInput(props: DSInputProps): ReactNode {
  return <DSInput {...props} />;
}
