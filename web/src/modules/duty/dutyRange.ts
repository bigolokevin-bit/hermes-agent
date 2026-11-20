/**
 * The four ranges the duty page can look at. One id drives both reads that
 * depend on time — the workbench timeseries and the run-activity heat — so
 * the two cards can never show different windows.
 */
export type DutyRangeId = "24h" | "7d" | "14d" | "30d";

export interface DutyRange {
  id: DutyRangeId;
  /** On-screen name, also used in card titles. */
  label: string;
  days: number;
  /** run-activity aggregates by week; 24h and 7d both read one week. */
  weeks: number;
  /** workbench/timeseries range parameter. */
  tsRange: "1d" | "7d" | "14d" | "30d";
}

export const DUTY_RANGES: DutyRange[] = [
  { id: "24h", label: "近 24 小时", days: 1, weeks: 1, tsRange: "1d" },
  { id: "7d", label: "近 7 天", days: 7, weeks: 1, tsRange: "7d" },
  { id: "14d", label: "近 14 天", days: 14, weeks: 2, tsRange: "14d" },
  { id: "30d", label: "近 30 天", days: 30, weeks: 4, tsRange: "30d" },
];

export const DEFAULT_DUTY_RANGE: DutyRangeId = "14d";
export const DUTY_RANGE_PARAM = "range";

export function parseDutyRange(value: string | null | undefined): DutyRangeId {
  return DUTY_RANGES.some((r) => r.id === value) ? (value as DutyRangeId) : DEFAULT_DUTY_RANGE;
}

export function dutyRange(id: DutyRangeId): DutyRange {
  return DUTY_RANGES.find((r) => r.id === id) ?? DUTY_RANGES[2];
}