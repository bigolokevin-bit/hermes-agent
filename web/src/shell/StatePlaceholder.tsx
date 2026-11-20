/**
 * StatePlaceholder — 设计车道 ④（空/错态给骨架与占位，375 不许一屏一句）.
 *
 * The ghost rows that sit under an empty / error / forced sentence so a 375
 * viewport reads「这里本该有一列内容，现在是空的」instead of one line floating
 * in a blank frame. Decorative only: the sentence above stays the whole
 * message. The block carries no text, no testid, no `aria-busy` (this is not
 * loading — it is the shape of what is missing) and is `aria-hidden`, so the
 * assistive-technology reading order is exactly what it was before.
 *
 * Zero UI imports (R7.1 shell discipline): plain divs, widths are percentage
 * utilities only so the block can never push a 375 viewport into horizontal
 * overflow, and the fill comes from the LOCAL text colour through
 * `currentColor`. One component therefore stays visible both on the shell's
 * dark panel (`--fg` on `--panel`) and on the upstream pages' light `bg-card`
 * panels — which the `bg-white/5` skeletons elsewhere in the tree cannot
 * promise (invisible in a light theme; the defect class this file avoids).
 *
 * Deliberately NOT the `.animate-pulse` class. In this repo that class is the
 * loading signal, and the settle helpers of ~20 suites wait for it to be gone
 * once a surface has settled — several of them on the very empty states these
 * bars now live in (`pages/ApprovalsPage.test.tsx:35`,
 * `pages/RunsPage.test.tsx:37`, `modules/approvals/approvals.caliber.test.tsx:101`).
 * An empty state is settled, so a permanent `.animate-pulse` there would be
 * both a false "still loading" signal to those audits and a red suite. The
 * animation itself is Tailwind's own `pulse` keyframes — emitted into the
 * shared stylesheet by the loading skeletons that still use them — applied
 * inline instead of by class, so the look is identical and the marker is not.
 */

const PULSE = "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite";

/* currentColor + color-mix: the bar is a tint of whatever colour the frame it
 * sits in already paints its text in. Same idiom as `knowledge.css`. */
const HEAD_FILL = "color-mix(in srgb, currentColor 26%, transparent)";
const ROW_FILL = "color-mix(in srgb, currentColor 15%, transparent)";

/** Width ladder — 条宽阶梯, percentages only (no fixed px ⇒ no 375 overflow). */
const ROW_WIDTHS = ["w-full", "w-5/6", "w-3/4", "w-1/2"] as const;

/** 1 title bar + at most 4 content bars: the lane allows 3~5 bars, no more. */
const MAX_ROWS = ROW_WIDTHS.length;

export interface StatePlaceholderProps {
  /** Content bars under the title bar (1~4, default 3 ⇒ 4 bars total). */
  rows?: number;
  /** Extra layout classes for the frame that hosts it (alignment, width cap). */
  className?: string;
}

/** The ghost rows: one shorter title bar, then `rows` stepped content bars. */
export function StatePlaceholder({ rows = 3, className = "" }: StatePlaceholderProps) {
  const count = Math.min(MAX_ROWS, Math.max(1, Math.round(rows)));
  return (
    <div
      aria-hidden="true"
      data-state-placeholder={count + 1}
      className={`flex w-full min-w-0 max-w-sm flex-col gap-2 ${className}`.trim()}
    >
      <div
        className="h-3.5 w-2/3 rounded-sm"
        style={{ background: HEAD_FILL, animation: PULSE }}
      />
      {ROW_WIDTHS.slice(0, count).map((width) => (
        <div
          key={width}
          className={`h-3 rounded-sm ${width}`}
          style={{ background: ROW_FILL, animation: PULSE }}
        />
      ))}
    </div>
  );
}
