/**
 * R54 — pure front-end CSV export for the approvals queue (pending & history).
 *
 * Zero new backend endpoints: the file is built from the SAME rows object the
 * table already rendered (Blob + a[download]). `updated_at` reuses the exact
 * on-screen value — missing stays empty, never a fake 0 and never this
 * machine's clock. The filename timestamp is the export moment (Beijing),
 * which is a property of the file, not of the data.
 */
import { useEffect, useState } from "react";

import { Button } from "@nous-research/ui/ui/components/button";

import { actionGates } from "./gates";
import type { ApprovalRow } from "./model";

// R107: 表头固定顺序不变、只追加不重排；correlation/rid 与 apd9/apd11 同源。
const CSV_HEADER = ["id", "title", "status", "risk", "updated_at", "correlation", "rid"] as const;

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
        // R107: correlation=审批单号，与 apd9-correlation 的审计 resource 同源；缺=空字段。
        csvEscape(row.rawId ?? ""),
        // R107: rid=服务端请求编号，与 apd11-copy 同一来源行；屏上缺值仍是
        // 「该字段未返回」，CSV 里留空——禁把「—」/缺值句写进数据。
        csvEscape(row.requestId ?? ""),
      ].join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/** R75: 文件名只许 [a-z0-9.-]；其它字符折叠为 -，空段写 default。 */
export function csvNamePart(value: string | null | undefined): string {
  const cleaned = (value ?? "").toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "default";
}

export function approvalsCsvName(
  tab: string,
  status: string | null,
  sort: string | null,
  dir: string | null,
  now: Date = new Date(),
): string {
  const d = new Date(now.getTime() + 480 * 60_000);
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
  return `approvals-${csvNamePart(tab)}-${csvNamePart(status ?? "all")}-${csvNamePart(sort)}-${csvNamePart(dir)}-${stamp}.csv`;
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

type Phase = "loading" | "empty" | "ready" | "error" | "denied";

export function QueueCsvExport({
  rows,
  tab,
  status,
  phase = "ready",
  sort = null,
  dir = null,
}: {
  rows: readonly ApprovalRow[];
  tab: "pending" | "history";
  status: string | null;
  phase?: Phase;
  sort?: string | null;
  dir?: string | null;
}) {
  const count = rows.length;
  // R75: 预览名在 effect 里算（render 体不取时钟=purity 纪律）；四要素来自
  // URL（tab/status/asort/adir），导出瞬间重算同一分钟=与预览逐字一致。
  const [previewName, setPreviewName] = useState("");
  useEffect(() => {
    setPreviewName(approvalsCsvName(tab, status, sort, dir));
  }, [tab, status, sort, dir]);
  // R72: 可用性矩阵单点派生（不再各钮自算措辞）。
  const gate = actionGates(phase, count).export;
  const blocked = phase !== "ready";
  return (
    <span className="flex min-w-0 items-center gap-1.5" data-testid="apv7-export-group">
      <Button
        size="sm"
        outlined
        data-testid="apv7-export"
        disabled={!gate.enabled}
        aria-disabled={!gate.enabled}
        title={gate.enabled ? `${gate.title}文件名时间=导出时刻（北京时间）。列头=id,title,status,risk,updated_at,correlation,rid：correlation=审批单号（与审计 resource 同源）、rid=服务端请求编号；缺值为空字段。` : gate.title}
        onClick={() => downloadCsv(approvalsCsvName(tab, status, sort, dir), buildApprovalsCsv(rows))}
      >
        导出 CSV
      </Button>
      <span
        className="font-mono text-xs text-muted-foreground"
        data-testid="apv7-export-count"
        title="导出行数与屏上列表同源：同一份服务端返回、同一份渲染对象"
      >
        {blocked ? "—" : `共 ${count} 行`}
      </span>
      <p
        className="min-w-0 basis-full break-all font-mono text-xs text-muted-foreground"
        data-testid="apv-export-name"
        title={`完整文件名：${previewName}；四要素来源：tab=当前页签、status=当前 ?status=（无=all）、排序=当前列与方向（未排序=default）、时间=导出瞬间（北京时间到分）。文件名只含 [a-z0-9.-]。`}
      >
        {previewName}
      </p>
    </span>
  );
}
