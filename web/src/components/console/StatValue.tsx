import type { ReactNode } from "react";
import "./primitives.css";

export interface StatValueProps {
  value: ReactNode;
  /** 弱色后缀（单位、分母）。 */
  suffix?: ReactNode;
  /** compact = 11px 行内档；默认 24px 大字档。 */
  compact?: boolean;
  title?: string;
}

/** 等宽大字读数 + 弱色后缀（骨架 .mini b / 统计位）。 */
export function StatValue({ value, suffix, compact, title }: StatValueProps) {
  return (
    <b className={compact ? "stat-value stat-value--compact" : "stat-value"} title={title}>
      {value}
      {suffix ? <span className="stat-value__suffix">{suffix}</span> : null}
    </b>
  );
}