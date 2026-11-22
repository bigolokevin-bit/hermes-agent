import { isValidElement } from "react";
import type { ReactNode } from "react";

import "./ui.css";

/**
 * 空态 / 错误态 / 载入态的唯一实现（三兄弟同住一个基元，页面不得各写一套）。
 * 用法：<StateBlock tone="empty" title="这条筛选没有留下结果" detail="换个时间范围试试。"
 *                 actions={<UiButton variant="secondary">清空筛选</UiButton>} />
 * tone="loading" 时自带 aria-busy，文案由调用方给（禁止「暂无数据」这类含糊话术）。
 *
 * rubric 优先于迁移（UI-RUBRIC 扣分项「裸内部 id 上屏」）：基元自己拒收内部标识，
 * 不靠外部测试兜。开发态当场抛错让作者看见；生产态返回 null——宁可不渲染，
 * 也不把 id 摊上屏、更不让用户看白屏。真要展示这类串的页面请保留自有实现，
 * 并在迁移 PR 注明理由（L0 裁决：A 不为 rubric 让路）。
 */
export type UiStateTone = "empty" | "error" | "loading";

/** 只认公认形态：snake_case 键名、8 位以上十六进制串（含 UUID 段）、rid 前缀。 */
const INTERNAL_ID_SHAPE = /\b(?:[a-z]+(?:_[a-z]+)+|[0-9a-f]{8,}|rid[-_:]\S+)\b/i;

export const containsInternalIdShape = (text: string): boolean =>
  INTERNAL_ID_SHAPE.test(text);

/** 取节点里会真正上屏的文字；布尔与空节点不计。 */
function visibleText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(visibleText).join(" ");
  if (isValidElement(node)) {
    const children = (node.props as { children?: ReactNode }).children;
    return children === undefined ? "" : visibleText(children);
  }
  return "";
}

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
  if (containsInternalIdShape(`${visibleText(title)} ${visibleText(detail)}`)) {
    if (import.meta.env.DEV) {
      throw new Error(
        "StateBlock 不接受内部标识（snake_case 键名 / 8 位以上十六进制 / UUID / rid-…）：" +
          "rubric 优先于迁移，这类文案请保留页面自有实现，并在迁移 PR 注明理由。",
      );
    }
    return null;
  }
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
