import type { ReactNode } from "react";
import "./primitives.css";

export interface ChipProps {
  title?: string;
  children?: ReactNode;
}

/** 小 chip（技能等短标签），最多 3 个一行。 */
export function Chip({ title, children }: ChipProps) {
  return (
    <span className="emp-chip" title={title}>
      {children}
    </span>
  );
}