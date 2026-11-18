/**
 * audit verify window — the only place the ISO instants exist (T33).
 *
 * A window is chosen in words a person recognises (「最近 7 天」), converted to
 * two ISO instants for the wire, and rendered back through `beijing()` so the
 * screen never shows an ISO string. Bounds are computed from a caller-supplied
 * clock so the maths is testable without freezing timers.
 */

export type WindowKey = "24h" | "7d" | "30d";

export const WINDOW_CHOICES: readonly { value: WindowKey; label: string; hours: number }[] = [
  { value: "24h", label: "最近 24 小时", hours: 24 },
  { value: "7d", label: "最近 7 天", hours: 24 * 7 },
  { value: "30d", label: "最近 30 天", hours: 24 * 30 },
];

export const DEFAULT_WINDOW: WindowKey = "24h";

/** The window as the BFF wants it: two ISO instants, ending at `now`. */
export function windowBounds(key: WindowKey, now: Date = new Date()): { from: string; to: string } {
  const spec = WINDOW_CHOICES.find((choice) => choice.value === key) ?? WINDOW_CHOICES[0]!;
  const from = new Date(now.getTime() - spec.hours * 3_600_000);
  return { from: from.toISOString(), to: now.toISOString() };
}
