/**
 * The audit list refuses an unbounded scan: the read route requires at least one
 * of runId / taskId / actorId / resourceId / action / from / to (`require_any`),
 * so there is deliberately no 「不限时间」 option — every read carries a bounded
 * window. This module owns the window arithmetic for the list filter and for the
 * chain verification panel.
 */

export type WindowKey = "24h" | "7d" | "30d";

export const WINDOW_CHOICES: readonly { value: WindowKey; label: string; hours: number }[] = [
  { value: "24h", label: "最近 24 小时", hours: 24 },
  { value: "7d", label: "最近 7 天", hours: 24 * 7 },
  { value: "30d", label: "最近 30 天", hours: 24 * 30 },
];

export const DEFAULT_WINDOW: WindowKey = "7d";

export function windowBounds(key: WindowKey, now: Date = new Date()): { from: string; to: string } {
  const spec = WINDOW_CHOICES.find((choice) => choice.value === key) ?? WINDOW_CHOICES[0]!;
  const from = new Date(now.getTime() - spec.hours * 3_600_000);
  return { from: from.toISOString(), to: now.toISOString() };
}

// ── R34: the list filter also offers a custom range ──────────────────
//
// The service honours `from`/`to` verbatim (probed 2026-11-20: 24h → 0 events,
// 7d → 50, custom three-day slice → 47) and refuses an inverted range with
// 400 `request.invalid_query` ("'from' must not be later than 'to'"). The
// custom inputs are Beijing wall clock, so the page never depends on the
// browser's own time zone.

export type FilterWindowKey = WindowKey | "custom";

export const FILTER_WINDOW_CHOICES: readonly { value: FilterWindowKey; label: string }[] = [
  ...WINDOW_CHOICES.map(({ value, label }) => ({ value, label })),
  { value: "custom", label: "自定义" },
];

export const CUSTOM_WINDOW_LABEL = "自定义";

const BEIJING_INPUT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** An ISO instant (or Beijing stamp) as a datetime-local value in Beijing time. */
export function beijingInputValue(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const parts = BEIJING_INPUT.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  if (!year || !month || !day || !hour || !minute) return "";
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/** A datetime-local value read as Beijing wall clock, as an ISO instant. */
export function parseBeijingInput(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const withSeconds = raw.length === 16 ? `${raw}:00` : raw;
  const ms = Date.parse(`${withSeconds}+08:00`);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

/**
 * One side of a custom range as an instant, in either spelling the address can
 * carry: the ISO instant the page writes back, or a Beijing wall clock typed
 * into a datetime-local control. Anything else is null.
 */
function instantOf(value: string | null | undefined): number | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(raw)) {
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : null;
  }
  const iso = parseBeijingInput(raw);
  return iso === null ? null : Date.parse(iso);
}

/** The bounded range behind a custom filter, or null when it is not usable. */
export function customBounds(
  fromInput: string | null | undefined,
  toInput: string | null | undefined,
): { from: string; to: string } | null {
  const from = instantOf(fromInput);
  const to = instantOf(toInput);
  if (from === null || to === null) return null;
  if (from >= to) return null;
  return { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
}

/** A window key read from the URL, falling back to the default. */
export function filterWindowOf(raw: string | null | undefined): FilterWindowKey {
  if (raw === "custom") return "custom";
  return WINDOW_CHOICES.find((choice) => choice.value === raw)?.value ?? DEFAULT_WINDOW;
}