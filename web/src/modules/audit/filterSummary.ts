/**
 * audG — the current reading question as one shareable line.
 *
 * A person pastes this into a ticket so the reader can ask the same question.
 * The two rules that hold it together:
 *
 * 1. Everything in the line is already in the address or already asked. Building
 *    it, copying it and clearing it send nothing: the quoted path is the one
 *    this page ALREADY sent, taken from the data layer's own builder.
 * 2. The quoted path is relative — no origin — and any credential-shaped
 *    parameter is dropped before it can be pasted anywhere. This module never
 *    adds one, and refuses to hand one over if one ever appears.
 *
 * A filter nobody chose reads 「未设置」. The default quick window alone is not a
 * question worth handing over (it is what the page shows before anyone touches
 * it), so with nothing else on the address the control says so instead of
 * copying a line about nothing.
 */

/** The word for a filter nobody chose. */
export const FILTER_SUMMARY_MISSING = "未设置";

/** What the control promises. */
export const FILTER_SUMMARY_COPY_LABEL = "复制当前筛选条件";

/** Why the control is off when there is nothing to share. */
/**
 * audS (R49 ①): the wording the 总控 card asks for, anchored at the front of
 * the disabled title so a probe matches the same sentence the person reads.
 */
export const FILTER_SUMMARY_EMPTY_TITLE = "当前没有可复制的筛选条件";

export interface FilterSummaryInput {
  /** The quick window as the filter bar names it, e.g. 「最近 7 天」. */
  windowLabel: string;
  /** True when the window is the custom range (then the pair carries it). */
  custom: boolean;
  /** Beijing wall clock of the custom pair, as the inputs show it. */
  fromBeijing: string;
  toBeijing: string;
  /** The event type the address chose (the wire calls it `action`). */
  type: string;
  /** The operator handle the address chose (the wire calls it `actorId`). */
  actor: string;
  /** The resource value the address chose, plus how it is really applied. */
  resource: string;
  resourceNote: string;
  /** 第 N 页 and how many cursors the stack carries. */
  page: number;
  cursorCount: number;
  /** The path this page actually asked for, straight from the data layer. */
  askedPath: string | null;
  /**
   * audH: the size in force. A non-default size is part of the question worth
   * handing over, so it opens the summary the same way a filter does.
   */
  limit?: number;
  /** The size the page asks with when the address says nothing. */
  defaultLimit?: number;
}

/**
 * Parameters that must never travel inside a pasted summary. This page does not
 * put them in a request, but the line quotes a real request URL, so the removal
 * is stated instead of assumed.
 */
const CREDENTIAL_KEYS = ["token", "access_token", "code", "key", "secret", "session", "password"] as const;

/** Relative, origin-free, credential-free — or null when nothing was asked yet. */
export function safeRequestPath(asked: string | null): string | null {
  const raw = (asked ?? "").trim();
  if (!raw) return null;
  // The data layer builds relative paths already; a defensive strip keeps an
  // absolute one from ever carrying an origin into the clipboard.
  const withoutOrigin = raw.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i, "");
  const cut = withoutOrigin.indexOf("?");
  const path = cut === -1 ? withoutOrigin : withoutOrigin.slice(0, cut);
  const search = cut === -1 ? "" : withoutOrigin.slice(cut + 1);
  const kept = search
    .split("&")
    .filter((pair) => pair !== "")
    .filter((pair) => !(CREDENTIAL_KEYS as readonly string[]).includes((pair.split("=")[0] ?? "").toLowerCase()));
  return kept.length > 0 ? `${path}?${kept.join("&")}` : path;
}

/** Nothing on the address but the default window → nothing worth sharing. */
export function hasFilterSummary(input: FilterSummaryInput): boolean {
  return (
    (input.limit !== undefined && input.limit !== (input.defaultLimit ?? 50)) ||
    input.custom ||
    input.type !== "" ||
    input.actor !== "" ||
    input.resource !== "" ||
    input.cursorCount > 0
  );
}

/**
 * The line, in the order the filter bar shows the same choices:
 * 时间窗 → 动作类型 → 操作者 → 资源 → 页码 → 这一页实际请求的相对路径.
 */
export function filterSummaryLineOf(input: FilterSummaryInput): string {
  return `${filterSeats(input)} · 请求：${safeRequestPath(input.askedPath) ?? FILTER_SUMMARY_MISSING}`;
}

/**
 * audR: the seats a shareable question is made of — everything except the
 * request path. The 可分享形态 on the card and the copied line come from THIS
 * function, in one field order, so the sentence on the screen and the sentence
 * in the paste cannot become two different sentences.
 *
 * One deliberate difference, and it is an old contract, not a new one: the
 * screen does not print machine handles (`audB`/`aud9` pin that:
 * 「the handle stays off the surface」). So in `screen` mode the operator and
 * resource seats name what was chosen without spelling the identifier, while
 * every other seat — the window, the custom pair, the type code, the page, the
 * size — is byte-identical to the `paste` mode that feeds the clipboard. The
 * identifier is never lost: it is in the href, and in the copied line.
 */
export function filterSeats(input: FilterSummaryInput): string {
  return seatsOf(input, "paste");
}

/** The same seats, worded for a person reading the card. */
export function filterSeatsForScreen(input: FilterSummaryInput): string {
  return seatsOf(input, "screen");
}

/**
 * audT: the seats one at a time, in the order the filter bar shows them.
 * `seatsOf` is this map joined, and the chip row reads the same map — so a chip
 * and the copied line cannot become two different claims about one question.
 */
export interface FilterSeatMap {
  window: string;
  type: string;
  actor: string;
  resource: string;
  page: string;
  limit: string;
}

export function filterSeatMap(input: FilterSummaryInput, mode: "paste" | "screen"): FilterSeatMap {
  const window = input.custom
    ? `时间窗：自定义 ${input.fromBeijing || FILTER_SUMMARY_MISSING} → ${input.toBeijing || FILTER_SUMMARY_MISSING}（北京时间）`
    : `时间窗：${input.windowLabel || FILTER_SUMMARY_MISSING}`;
  const type = `动作类型：${input.type || FILTER_SUMMARY_MISSING}${input.type ? "（服务端按 action 精确匹配）" : ""}`;
  const actor =
    mode === "paste"
      ? `操作者：${input.actor || FILTER_SUMMARY_MISSING}${input.actor ? "（服务端 actorId，机器句柄）" : ""}`
      : `操作者：${input.actor ? "已按句柄筛（服务端 actorId）" : FILTER_SUMMARY_MISSING}`;
  const resource =
    mode === "paste"
      ? `资源：${input.resource || FILTER_SUMMARY_MISSING}${input.resource ? `（${input.resourceNote}）` : ""}`
      : `资源：${input.resource ? "已按编号本地筛（只在本页已加载的记录里）" : FILTER_SUMMARY_MISSING}`;
  // The paging seat is two answers, and audT needs them apart: which page this
  // is, and how big a page is. Joined with the same separator it is the
  // sentence this module has always printed, byte for byte.
  const page = `第 ${input.page} 页（游标 ×${input.cursorCount}）`;
  const limit = `每页 ${input.limit ?? input.defaultLimit ?? 50} 条`;
  return { window, type, actor, resource, page, limit };
}

function seatsOf(input: FilterSummaryInput, mode: "paste" | "screen"): string {
  const seats = filterSeatMap(input, mode);
  return [seats.window, seats.type, seats.actor, seats.resource, seats.page, seats.limit].join(" · ");
}

/**
 * audR: the same question as a link a person can hand over. Origin-free (the
 * href is same-origin by construction), and every credential-shaped parameter
 * is dropped by the same rule that guards the copied request path — a shareable
 * link that carries a session is not a shareable link.
 */
export function pageShareHref(params: URLSearchParams, pathname = "/audit"): string {
  const kept = new URLSearchParams(params);
  for (const key of CREDENTIAL_KEYS) kept.delete(key);
  const search = kept.toString();
  return search ? `${pathname}?${search}` : pathname;
}
