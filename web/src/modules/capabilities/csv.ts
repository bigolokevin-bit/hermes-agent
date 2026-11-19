// RFC 4180 CSV for the currently loaded capability rows. The export is a
// browser-side projection of the table; it never calls a backend and never
// turns a missing value into a zero.

export type CsvRow = {
  name: string | null;
  type: string | null;
  enabled: string | null;
  updated_at: string | null;
};

export const CSV_HEADER = ["name", "type", "enabled", "updated_at"] as const;

function cell(value: string | null | undefined): string {
  const text = value ?? "";
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: readonly CsvRow[]): string {
  const lines = [CSV_HEADER.join(","), ...rows.map((row) => [row.name, row.type, row.enabled, row.updated_at].map(cell).join(","))];
  return `${lines.join("\r\n")}\r\n`;
}

export function exportFilename(tab: "skills" | "tools", now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  const stamp = `${part("year")}${part("month")}${part("day")}-${part("hour")}${part("minute")}`;
  return `capabilities-${tab}-${stamp}.csv`;
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8;" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 0);
}
