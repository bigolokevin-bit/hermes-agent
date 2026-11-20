/**
 * audO — long values, said in one line, never cut off from the person.
 *
 * A ledger row can carry a name nobody anticipated: an operator with a 40-character
 * display name, a resource path like `/tenants/…/workstations/…`, an action
 * sentence. Wrapping them inside a card column makes the row taller than the
 * screen at 375px; clipping them silently makes the value unreadable. So:
 *
 * - the line shows a head slice plus a stated 「…」, and says how many characters
 *   it left out — counted from the actual strings, never a guess;
 * - the FULL original goes in `title`, in the same sentence, so hovering or
 *   opening the row reads the whole thing;
 * - the preview and the record pane also get a 「展开全文」button, because a
 *   `title` cannot be reached by keyboard or on a touchscreen;
 * - a value that was never long gets no ornament at all: no ellipsis, no
 *   button, no promise of more.
 *
 * Sensitive values are untouched by this module. Masking stays where it was
 * decided (`maskSensitive`, and the short-form `CopyValue`), and nothing here
 * puts a masked-away secret into a `title`.
 */

/** How many characters one line shows before stating the rest. */
export const TRUNC_CELL = 24;
export const TRUNC_LINE = 40;

/** The word between the shown head and the count. */
const ELLIPSIS = "…";

export interface TruncatedView {
  /** True only when characters were actually left out. */
  truncated: boolean;
  /** What the line shows — the full text when nothing was left out. */
  shown: string;
  /** How many characters the line does not show. */
  omitted: number;
  /** The full original, with the omission stated — for `title` and for 展开. */
  title: string;
}

/**
 * Cut one display value. `limit` is in characters, and the omitted count is
 * measured: `original − shown`, so the sentence cannot over- or under-report
 * what the line dropped.
 */
export function truncatedView(value: string, limit: number): TruncatedView {
  const text = value ?? "";
  if (text.length <= limit) {
    return { truncated: false, shown: text, omitted: 0, title: text };
  }
  const shown = text.slice(0, Math.max(1, limit)) + ELLIPSIS;
  const omitted = text.length - limit;
  return {
    truncated: true,
    shown,
    omitted,
    title: `完整值：${text}（已省略 ${omitted} 字符，完整值见此处）`,
  };
}

/**
 * The `title` a truncated cell carries. When a field already had a title (the
 * raw identifier, the stated reason for a missing value), the full text and the
 * omission note are added to it instead of replacing it — one field, one hover,
 * everything the person needs in the same place.
 */
export function joinTitles(...parts: Array<string | null | undefined>): string | undefined {
  const kept = parts.map((part) => (part ?? "").trim()).filter((part) => part !== "");
  return kept.length ? kept.join("｜") : undefined;
}

/** The label of the expand button, so both surfaces promise the same thing. */
export const TRUNC_EXPAND_LABEL = "展开全文";
export const TRUNC_COLLAPSE_LABEL = "收起全文";
