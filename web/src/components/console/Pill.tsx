import type { ReactNode } from "react";
import "./primitives.css";

export type PillTone = "ok" | "warn" | "bad" | "info" | "mut";

export interface PillProps {
  tone?: PillTone;
  /** 圆点（骨架的 .dot）。 */
  dot?: boolean;
  title?: string;
  /** 探针地址（骨架 t-runs 的状态 pill 用）。 */
  "data-testid"?: string;
  children?: ReactNode;
}

/** 状态胶囊：ok/warn/bad/info/mut + 圆点。 */
export function Pill({ tone = "mut", dot = true, title, "data-testid": testId, children }: PillProps) {
  return (
    <span className={`emp-pill ${tone}`} title={title} data-testid={testId}>
      {dot ? <span className="emp-pill__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}