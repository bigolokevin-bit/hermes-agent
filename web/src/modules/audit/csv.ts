import type { AuditRow } from "./model";

/**
 * CSV export of the audit list (R34).
 *
 * The file mirrors what the page is showing: the current window's rows, one per
 * event, with Chinese column names. Times are Beijing wall clock to the minute;
 * a value the service did not send stays an empty cell — never `0`, never a
 * placeholder that could be mistaken for data.
 */

export const CSV_HEADER = ["时间", "类型", "结果", "操作者", "对象", "请求编号"] as const;

function cell(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (raw === "") return "";
  if (/[",\r\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

/** The whole file body, with a BOM so spreadsheet apps read the Chinese header. */
export function csvText(rows: readonly AuditRow[]): string {
  const lines = [CSV_HEADER.map(cell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        cell(row.occurredAt),
        cell(row.action.label),
        cell(row.outcome.label),
        cell(row.actor.label),
        cell(row.resource.label),
        cell(row.requestId),
      ].join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

const STAMP = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** `audit-<窗口>-YYYYMMDD-HHmm.csv`, stamped in Beijing time. */
export function exportName(windowLabel: string, now: Date = new Date()): string {
  const parts = STAMP.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  const stamp = `${get("year")}${get("month")}${get("day")}-${get("hour")}${get("minute")}`;
  const label = (windowLabel || "审计事件").replace(/\s+/g, "");
  return `audit-${label}-${stamp}.csv`;
}

/** Hands the text to the browser as a download and releases the object URL. */
export function downloadCsv(rows: readonly AuditRow[], name: string): void {
  const blob = new Blob([csvText(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}