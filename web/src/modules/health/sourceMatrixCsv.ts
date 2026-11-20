import { SOURCE_STATUS_LABEL, type SourceRow } from "./sourceReads";

export const SYS7_HEADER = ["name", "path", "state", "elapsed_ms", "as_of"] as const;

export interface SourceCsvRow {
  name: string;
  path: string;
  state: string;
  elapsed_ms: number | null;
  as_of: string | null;
}

/** The screen and the CSV use the same rows; nothing is fetched for the export. */
export function csvRows(rows: SourceRow[]): SourceCsvRow[] {
  return rows.map((row) => ({
    name: row.label,
    path: row.path,
    state: SOURCE_STATUS_LABEL[row.status],
    elapsed_ms: row.durationMs,
    as_of: row.asOfIso,
  }));
}

function cell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180: header plus one CRLF-terminated record per row. */
export function toCsv(rows: SourceCsvRow[]): string {
  const lines = [
    SYS7_HEADER.join(","),
    ...rows.map((row) => [
      cell(row.name),
      cell(row.path),
      cell(row.state),
      cell(row.elapsed_ms),
      cell(row.as_of),
    ].join(",")),
  ];
  return `${lines.join("\r\n")}\r\n`;
}

export const SYS10_HEADER = ["口径名", "路径", "状态", "耗时", "采集时刻"] as const;

/** Plain text mirrors exactly what is on screen; no request, no clock. */
export function toPlainText(rows: SourceRow[]): string {
  const lines = [
    SYS10_HEADER.join(" | "),
    ...rows.map((row) => [
      row.label,
      row.path,
      SOURCE_STATUS_LABEL[row.status],
      row.durationMs === null ? "—" : `${row.durationMs} ms`,
      row.asOf ?? "—",
    ].join(" | ")),
  ];
  return `${lines.join("\n")}\n`;
}

/** Tab-separated mirror of the current matrix table; no request, no clock. */
export function toMatrixText(rows: SourceRow[]): string {
  const lines = [
    SYS10_HEADER.join("\t"),
    ...rows.map((row) => [
      row.label,
      row.path,
      SOURCE_STATUS_LABEL[row.status],
      row.durationMs === null ? "—" : `${row.durationMs} ms`,
      row.asOf ?? "—",
    ].join("\t")),
  ];
  return `${lines.join("\n")}\n`;
}

/** Beijing time to the minute, e.g. system-sources-20261120-0615.csv. */
export function exportFilename(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `system-sources-${value("year")}${value("month")}${value("day")}-${value("hour")}${value("minute")}.csv`;
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}