import type { SystemHealthRow } from "./systemHealth";

/** One health row as a single plain-text line: 表名 · 读数 · 数据时刻 · 状态人话.
 *
 * The wording lives here only; the row button and the fallback textarea both
 * read this result, so the two can never drift. Rules that mirror the on-screen
 * table exactly:
 * - 表名 falls back to the caliber key when upstream gave no name, same as the
 *   search box does; it never invents a label.
 * - 读数 is the upstream latency string as displayed; a real 0 keeps its
 *   "0 ms" text, and only a missing value becomes 「—」.
 * - 数据时刻 is the row's own checkedAt — already formatted from the upstream
 *   top-level collection time. The refresh stamp (sys-updated-at) is a read
 *   time and must never be substituted here (R112 caliber).
 * - 状态人话 is the mapped Sys3State, always present. */
export function sysRowCopyText(row: SystemHealthRow): string {
  return [row.name ?? row.key, row.latency ?? "—", row.checkedAt ?? "—", row.state].join(" · ");
}
