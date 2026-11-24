import type { HTMLAttributes, ReactNode } from "react";
import "./primitives.css";

export interface ConsoleCardProps extends HTMLAttributes<HTMLDivElement> {
  /** 11px 大写微标签；不传则卡头整条不渲染（骨架列表卡就是这么做的）。 */
  label?: ReactNode;
  /** 卡头右侧小链接/微动作。 */
  action?: ReactNode;
  /** 卡体内容（自带 12px 内距的包裹层）。 */
  children?: ReactNode;
  /** 卡体不加内距（整宽表格用）。 */
  flush?: boolean;
}

/** 公共卡式基元：--panel 底 + 1px --line + 6px 圆角。 */
export function ConsoleCard({ label, action, children, flush, ...rest }: ConsoleCardProps) {
  return (
    <div className="console-card" {...rest}>
      {label || action ? (
        <div className="console-card__head">
          <span className="console-card__label">{label}</span>
          {action ? <span className="console-card__action">{action}</span> : null}
        </div>
      ) : null}
      {flush ? children : <div className="console-card__body">{children}</div>}
    </div>
  );
}