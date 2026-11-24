import "./primitives.css";

export type SegTone = "ok" | "warn" | "bad" | "info" | "mut";

export interface SegSegment {
  value: number;
  tone: SegTone;
}

export interface SegBarProps {
  segments: SegSegment[];
  /** 读屏口径句（图上不显示）。 */
  label?: string;
  className?: string;
}

/** 1–3 段占比条（骨架 seg3）：分母为 0 时整条不渲染。 */
export function SegBar({ segments, label, className }: SegBarProps) {
  const total = segments.reduce((sum, seg) => sum + (Number.isFinite(seg.value) && seg.value > 0 ? seg.value : 0), 0);
  if (total <= 0) return null;
  return (
    <div
      className={className ? `console-segbar ${className}` : "console-segbar"}
      role="img"
      aria-label={label}
    >
      {segments.map((seg, index) =>
        seg.value > 0 ? (
          <i
            key={`${seg.tone}-${index}`}
            className={`tone-${seg.tone}`}
            style={{ width: `${(seg.value / total) * 100}%` }}
          />
        ) : null,
      )}
    </div>
  );
}