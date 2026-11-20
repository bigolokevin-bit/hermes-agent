/**
 * audE — the fixed link for ONE audit event.
 *
 * The spelling is the one this surface already answers (`git grep` 2026-11-20:
 * `?event=<id>` is the deep link the list resolves, in
 * `AuditEventsModulePage.tsx`; `?detail=` opens the record pane and `?id=` is
 * the legacy spelling still read). A permalink therefore says
 * `<origin>/audit?event=<eventId>`: pasted cold, the list locates and opens
 * that row, so the link promises exactly what the page does with it.
 *
 * Nothing here reaches the network: the id is the one already painted on the
 * row or on the record. No id on screen → no link (the control is disabled and
 * says why); an invented identifier would be a link to nothing.
 */

/** The route this surface lives on (the same spelling the preview links use). */
export const AUDIT_PATH = "/audit";

/** The deep-link parameter the list page actually reads. */
export const DEEP_LINK_PARAM = "event";

/** What the copy control promises. */
export const PERMALINK_COPY_LABEL = "复制事件链接";

/** The sentence a row without an identifier owes the person. */
export const PERMALINK_MISSING_TITLE = "该行没有可用的固定标识";

/**
 * The permalink for one event. `base` is injectable so the builder can be
 * tested without a browser; on screen it is the current origin, which is what
 * a person can actually paste into another tab.
 */
export function eventPermalink(eventId: string, base?: string): string {
  const origin = base ?? (typeof window === "undefined" ? "" : window.location.origin);
  return `${origin}${AUDIT_PATH}?${DEEP_LINK_PARAM}=${encodeURIComponent(eventId)}`;
}

/**
 * The same link, from an address the person is already on: the quick windows
 * and the chain check keep working, a fixed link should not carry a filter
 * that the next reader may not want.
 */
export function permalinkFromEvent(eventId: string | null | undefined, base?: string): string | null {
  const raw = (eventId ?? "").trim();
  return raw ? eventPermalink(raw, base) : null;
}
