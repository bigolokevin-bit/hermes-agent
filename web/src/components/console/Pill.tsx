import type { ReactNode } from "react";
import "./primitives.css";

export type PillTone = "ok" | "warn" | "bad" | "info" | "mut";

export interface PillProps {
  tone?: PillTone;
  /** 圆点（骨架的 .dot）。 */
  dot?: boolean;
  title?: string;
  children?: ReactNode;
}

/** 状态胶囊：ok/warn/bad/info/mut + 圆点。 */
export function Pill({ tone = "mut", dot = true, title, children }: PillProps) {
  return (
    <span className={`emp-pill ${tone}`} title={title}>
      {dot ? <span className="emp-pill__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}