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
  /** 卡底一行 11px 弱色口径行（数据截至/来源/统计范围）。 */
  note?: ReactNode;
  /**
   * 缺读口清单：有值即渲染可折叠的「数据可用性」卡底块。
   * 缺读口只在这里声明一次，正文一律只留 `—`，不再往版面里铺散文。
   */
  availability?: { label: string; reason?: string }[];
}

/** 公共卡式基元：--panel 底 + 1px --line + 6px 圆角。 */
export function ConsoleCard({ label, action, children, flush, note, availability, ...rest }: ConsoleCardProps) {
  const missing = availability?.filter((item) => item.label) ?? [];
  return (
    <div className="console-card" {...rest}>
      {label || action ? (
        <div className="console-card__head">
          <span className="console-card__label">{label}</span>
          {action ? <span className="console-card__action">{action}</span> : null}
        </div>
      ) : null}
      {flush ? children : <div className="console-card__body">{children}</div>}
      {note ? <div className="console-card__note">{note}</div> : null}
      {missing.length ? (
        <details className="console-card__availability" data-availability-count={missing.length}>
          <summary>
            数据可用性
            <span className="console-card__availability-badge">{missing.length} 项无读口</span>
          </summary>
          <ul>
            {missing.map((item) => (
              <li key={item.label}>
                <span className="console-card__availability-label">{item.label}</span>
                {item.reason ? <span className="console-card__availability-reason">{item.reason}</span> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}