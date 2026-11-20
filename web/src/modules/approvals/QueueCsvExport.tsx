/**
 * R54 — pure front-end CSV export for the approvals queue (pending & history).
 *
 * Zero new backend endpoints: the file is built from the SAME rows object the
 * table already rendered (Blob + a[download]). `updated_at` reuses the exact
 * on-screen value — missing stays empty, never a fake 0 and never this
 * machine's clock. The filename timestamp is the export moment (Beijing),
 * which is a property of the file, not of the data.
 */
import { Button } from "@nous-research/ui/ui/components/button";

import type { ApprovalRow } from "./model";

const CSV_HEADER = ["id", "title", "status", "risk", "updated_at"] as const;

/** RFC4180: quote when the value contains a comma, quote, CR or LF. */
export function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildApprovalsCsv(rows: readonly ApprovalRow[]): string {
  const lines = [CSV_HEADER.join(",")];
  for (const row of rows) {
    lines.push(
      [
        csvEscape(row.rawId ?? ""),
        csvEscape(row.title),
        // 屏上同一状态人话（label 就是表格里渲染的那个值）。
        csvEscape(row.status.label),
        csvEscape(row.risk.label),
        // 屏上同一值（null 时留空；缺值不补 0，也不取本机时钟）。
        csvEscape(row.clock ?? ""),
      ].join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function approvalsCsvName(tab: string, status: string | null, now: Date = new Date()): string {
  const d = new Date(now.getTime() + 480 * 60_000);
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
  return `approvals-${tab}-${status ?? "all"}-${stamp}.csv`;
}

export function downloadCsv(name: string, csv: string): void {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL?.(url);
}

export function QueueCsvExport({
  rows,
  tab,
  status,
}: {
  rows: readonly ApprovalRow[];
  tab: "pending" | "history";
  status: string | null;
}) {
  const count = rows.length;
  return (
    <span className="flex min-w-0 items-center gap-1.5" data-testid="apv7-export-group">
      <Button
        size="sm"
        outlined
        data-testid="apv7-export"
        disabled={count === 0}
        title={
          count === 0
            ? "当前筛选下没有可导出的行，导出暂不可用。"
            : `导出当前已显示的 ${count} 行为 CSV（纯前端 Blob，零新后端端点；updated_at 用屏上同一值）。文件名时间=导出时刻（北京时间）。`
        }
        onClick={() => downloadCsv(approvalsCsvName(tab, status), buildApprovalsCsv(rows))}
      >
        导出 CSV
      </Button>
      <span
        className="font-mono text-xs text-muted-foreground"
        data-testid="apv7-export-count"
        title="导出行数与屏上列表同源：同一份服务端返回、同一份渲染对象"
      >
        共 {count} 行
      </span>
    </span>
  );
}
