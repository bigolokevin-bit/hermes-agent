/**
 * audM — where the list was standing before a record opened.
 *
 * Filters, the page and the open fold already live in the address (aud8), so
 * 「详情→返回列表」 restores the QUESTION. What the address cannot carry is how
 * far down the ledger the person had scrolled, and that is the difference
 * between landing back where you were and re-reading a page from the top.
 *
 * The mark is therefore keyed by the reading fingerprint — window, the custom
 * pair, type, operator, resource, page size and the cursor stack. Navigation
 * state (`detail`, `preview`, `event`, `tech`) is deliberately NOT in the key:
 * opening a record must not look like a new question, or nothing is ever
 * restored.
 *
 * Two rules keep it honest:
 * - changing a filter or a page CLEARS the mark for the question being left,
 *   so a position saved under one window never gets applied inside another;
 * - a `?event=` deep link owns the arrival — the located row is where the
 *   person is going, so an old mark is dropped instead of fought over.
 *
 * sessionStorage, not localStorage: this is one trip inside one tab, not a
 * preference. Everything degrades to "no mark" when storage is unavailable —
 * the reading itself never depends on it.
 */

const PREFIX = "audm-scroll:";

export interface ScrollMark {
  /** The scroll offset in CSS pixels, top of the document. */
  y: number;
  /** The row whose record was opened, so the focus can go back to it. */
  rowKey: string | null;
}

/**
 * The fingerprint of the question being read. Ordered and explicit: the same
 * filters in a different spelling are the same question, and a different page
 * of the same filters is a different place to be.
 */
export function scrollFingerprint(params: URLSearchParams): string {
  const cursors = params.getAll("cursor");
  return [
    `window=${params.get("window") ?? "7d"}`,
    `from=${params.get("from") ?? ""}`,
    `to=${params.get("to") ?? ""}`,
    `type=${params.get("type") ?? ""}`,
    `actor=${params.get("actor") ?? ""}`,
    `resource=${params.get("resource") ?? ""}`,
    `limit=${params.get("limit") ?? ""}`,
    `cursor=${cursors.join(",")}`,
  ].join("|");
}

function store(): globalThis.Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    // A locked-down context (private mode, no storage access) simply has no
    // memory of the scroll. The page reads the same either way.
    return null;
  }
}

/** Remember where the list stood, for this question only. */
export function saveScrollMark(fingerprint: string, mark: ScrollMark): void {
  const bag = store();
  if (!bag) return;
  try {
    bag.setItem(PREFIX + fingerprint, JSON.stringify(mark));
  } catch {
    /* storage full or blocked: no mark, no promise of one */
  }
}

/** The mark for this question, or null when there is nothing to go back to. */
export function readScrollMark(fingerprint: string): ScrollMark | null {
  const bag = store();
  if (!bag) return null;
  const raw = bag.getItem(PREFIX + fingerprint);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ScrollMark>;
    const y = typeof parsed?.y === "number" && Number.isFinite(parsed.y) && parsed.y >= 0 ? parsed.y : null;
    if (y === null) return null;
    const rowKey = typeof parsed.rowKey === "string" ? parsed.rowKey : null;
    return { y, rowKey };
  } catch {
    return null;
  }
}

/**
 * Drop the mark — used when the question changes (a new filter, a new page)
 * and after a mark has been spent, so it is applied once and never twice.
 */
export function clearScrollMark(fingerprint: string): void {
  const bag = store();
  if (!bag) return;
  try {
    bag.removeItem(PREFIX + fingerprint);
  } catch {
    /* nothing to clear */
  }
}

/** Where the window is right now, as the browser reports it. */
export function readScrollY(): number {
  if (typeof window === "undefined") return 0;
  const y = window.scrollY ?? window.pageYOffset ?? 0;
  return Number.isFinite(y) && y > 0 ? y : 0;
}

/** Put the window back. A no-op when the document cannot be told to move. */
export function applyScroll(y: number): void {
  if (typeof window === "undefined" || !Number.isFinite(y)) return;
  window.scrollTo(0, y);
}
