import type { ReactNode } from "react";

import "./ui.css";

/**
 * 空态 / 错误态 / 载入态的唯一实现（三兄弟同住一个基元，页面不得各写一套）。
 * 用法：<StateBlock tone="empty" title="这条筛选没有留下结果" detail="换个时间范围试试。"
 *                 actions={<UiButton variant="secondary">清空筛选</UiButton>} />
 * tone="loading" 时自带 aria-busy，文案由调用方给（禁止「暂无数据」这类含糊话术）。
 */
export type UiStateTone = "empty" | "error" | "loading";

export function StateBlock({
  tone = "empty",
  title,
  detail,
  actions,
}: {
  tone?: UiStateTone;
  title: string;
  detail?: ReactNode;
  actions?: ReactNode;
}): ReactNode {
  return (
    <div
      className="ui-state"
      data-tone={tone}
      data-testid={`ui-state-${tone}`}
      role="status"
      aria-busy={tone === "loading" ? true : undefined}
    >
      <p className="ui-state-title">{title}</p>
      {detail ? <p className="ui-state-detail">{detail}</p> : null}
      {actions ? <div className="ui-state-actions">{actions}</div> : null}
    </div>
  );
}
