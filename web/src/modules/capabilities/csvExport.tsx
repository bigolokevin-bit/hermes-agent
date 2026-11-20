import { useMemo, type ReactNode } from "react";
import { Download } from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { downloadCsv, exportFilename, toCsv, type CsvRow } from "./csv";
import { rowsGate, type ActionGate } from "./gates";

export function CapabilityExport({
  tab,
  rows,
  q = null,
  sort = null,
  dir = null,
  gate = rowsGate(rows.length),
}: {
  tab: "skills" | "tools";
  rows: readonly CsvRow[];
  q?: string | null;
  sort?: string | null;
  dir?: string | null;
  gate?: ActionGate;
}): ReactNode {
  const disabled = !gate.enabled;
  // Freeze the previewed name for this tab/query/sort combination. The click
  // downloads exactly this string, so a minute boundary cannot change it.
  const filename = useMemo(() => exportFilename({ tab, q, sort, dir }), [tab, q, sort, dir]);
  const nameTitle = `文件名来源：tab=${tab} · q=${q?.trim() || "未提供"} · sort=${sort ?? "未提供"} · dir=${dir ?? "未提供"}；导出时刻取北京时间到分，片段只保留字母、数字、点和连字符，不合规折成 default。`;
  return (
    <span className="cap6-export-wrap">
      <Button
        size="sm"
        outlined
        disabled={disabled}
        aria-disabled={disabled ? "true" : undefined}
        title={gate.title}
        data-testid="cap6-export"
        onClick={() => downloadCsv(filename, toCsv(rows))}
      >
        <Download className="mr-1 size-3.5" aria-hidden="true" />导出 CSV
      </Button>
      <span className="cap6-export-count" data-testid="cap6-export-count">{gate.count}</span>
      <span className="cap-export-name" data-testid="cap-export-name" title={nameTitle}>{filename}</span>
      <span className="sr-only" data-testid="cap-gates-export" data-enabled={gate.enabled ? "true" : "false"} title={gate.title} />
    </span>
  );
}
