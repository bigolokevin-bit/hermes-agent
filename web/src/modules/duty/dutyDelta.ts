import { dailyBuckets, trendSummary } from "./aggregate";
import { usd } from "./format";
import type { DutyData } from "./useDutyData";

/** One card reading that can be compared across two refresh batches. */
export interface DutyDeltaItem {
  key: string;
  label: string;
  before: number | null;
  after: number | null;
  kind: "count" | "usd";
}

export interface DutyDelta {
  items: Array<{ key: string; label: string; text: string }>;
  more: number;
}

/** At most three lines on screen; the rest is summarized as a count. */
export const DUTY_DELTA_LIMIT = 3;

function runsOf(batch: DutyData): number | null {
  if (batch.todayStats.k !== "ready") return null;
  const totals = batch.todayStats.data.totals;
  const runs = totals && typeof totals.runs === "number" ? totals.runs : null;
  return runs;
}

function costOf(batch: DutyData): number | null {
  if (batch.budgetDay.k !== "ready") return null;
  const rows = batch.budgetDay.data.items;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  let sum = 0;
  let seen = false;
  for (const row of rows) {
    const value = (row as { costUsd?: unknown }).costUsd;
    if (typeof value === "number" && Number.isFinite(value)) {
      sum += value;
      seen = true;
    }
  }
  return seen ? sum : null;
}

function pendingOf(batch: DutyData): number | null {
  if (batch.approvalStats.k !== "ready") return null;
  const pending = batch.approvalStats.data.pending;
  return typeof pending === "number" ? pending : null;
}

function trendOf(batch: DutyData): number | null {
  if (batch.stats14.k !== "ready") return null;
  const summary = trendSummary(dailyBuckets(batch.stats14.data));
  return summary.total;
}

function blockedOf(batch: DutyData): number | null {
  if (batch.blockedTasks.k !== "ready") return null;
  const items = batch.blockedTasks.data;
  return Array.isArray(items) ? items.length : null;
}

export function dutySnapshot(batch: DutyData): DutyDeltaItem[] {
  return [
    { key: "today-runs", label: "今日运行", before: null, after: runsOf(batch), kind: "count" },
    { key: "cost", label: "今日成本", before: null, after: costOf(batch), kind: "usd" },
    { key: "pending", label: "待我处理", before: null, after: pendingOf(batch), kind: "count" },
    { key: "trend", label: "区间运行", before: null, after: trendOf(batch), kind: "count" },
    { key: "blocked", label: "阻塞项", before: null, after: blockedOf(batch), kind: "count" },
  ];
}

function show(item: DutyDeltaItem, value: number | null): string {
  if (value === null) return "—";
  return item.kind === "usd" ? usd(value) : String(value);
}

/**
 * Compares two already-read batches. A reading missing on either side is left
 * out entirely — a failed card never shows up as a drop to zero.
 */
export function diffDuty(prev: DutyData, next: DutyData): DutyDelta {
  const before = new Map(dutySnapshot(prev).map((item) => [item.key, item]));
  const items: DutyDelta["items"] = [];
  for (const item of dutySnapshot(next)) {
    const older = before.get(item.key);
    if (!older || older.after === null || item.after === null) continue;
    if (older.after === item.after) continue;
    items.push({
      key: item.key,
      label: item.label,
      text: `${item.label} ${show(item, older.after)} → ${show(item, item.after)}`,
    });
  }
  const shown = items.slice(0, DUTY_DELTA_LIMIT);
  return { items: shown, more: items.length - shown.length };
}
