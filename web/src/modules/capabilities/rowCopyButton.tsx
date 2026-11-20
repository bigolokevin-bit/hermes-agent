// Copy one capability list row as plain text. The text comes from
// `rowCopyText.capRowCopyText` — only values already on screen, no request,
// no clock. The page keeps ONE result, so at most one row shows the status
// node at a time; the node follows the row by key, surviving re-filtering
// (indexes shift, keys do not).
//
// The status/fallback testids are the ones the order froze (`cap-row-copy-
// status` / `cap-row-copy-fallback`). The row-DETAIL copy (`listCopy.tsx`
// `CapabilityFieldCopy`) uses the same two names inside its own panel; both
// can coexist in the DOM when a row is expanded AND a row line was copied.
// Disclosed in DONE R93 — existing tests only ever exercise one surface per
// query, and this component renders its nodes only for the last-copied row.
import { type ReactNode } from "react";
import { Copy } from "lucide-react";
import { copyTextToClipboard } from "@/lib/clipboard";

export type CapRowCopyResult = { rowKey: string; index: number; text: string; failed: boolean };

export function CapabilityRowCopyButton({
  index,
  rowKey,
  name,
  text,
  result,
  onResult,
}: {
  index: number;
  /** Stable row identity; the result follows the row, not its position. */
  rowKey: string;
  /** Display name for the aria-label; pages fold missing names to 未署名条目. */
  name: string;
  /** The exact line `capRowCopyText` produced for this row. */
  text: string;
  result: CapRowCopyResult | null;
  onResult: (result: CapRowCopyResult) => void;
}): ReactNode {
  const active = result !== null && result.rowKey === rowKey ? result : null;
  const copy = async () => {
    onResult({ rowKey, index, text, failed: !(await copyTextToClipboard(text)) });
  };
  return (
    <span className="cap-row-copy-wrap">
      {/* Native button, type=button: focusable and never submits a form.
          The row containers guard their keydown with a target check, so no
          stopPropagation is needed here. */}
      <button
        type="button"
        className="cap7-toggle cap-row-copy-btn"
        title="复制这一行的名称、类型、状态、调用次数与短码；只读屏上已显示的值，不会再发请求。"
        data-testid={`cap-row-copy-${index}`}
        aria-label={`复制${name}这一行`}
        onClick={() => void copy()}
      >
        <Copy className="mr-1 inline size-3.5" aria-hidden="true" />
        复制
      </button>
      {active ? (
        <span className="cap-row-copy-result">
          <span className="cap-row-copy-status" data-testid="cap-row-copy-status" role="status" aria-live="polite">
            {active.failed ? "复制失败，已展开手动复制" : "已复制"}
          </span>
          {active.failed ? (
            <textarea
              className="cap-row-copy-fallback"
              data-testid="cap-row-copy-fallback"
              aria-label={`手动复制第 ${index + 1} 行`}
              readOnly
              rows={1}
              value={active.text}
            />
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
