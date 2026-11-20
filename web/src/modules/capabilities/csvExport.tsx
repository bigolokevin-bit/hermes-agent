import type { ReactNode } from "react";
import { Download } from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { downloadCsv, exportFilename, toCsv, type CsvRow } from "./csv";
import { rowsGate, type ActionGate } from "./gates";

export function CapabilityExport({
  tab,
  rows,
  gate = rowsGate(rows.length),
}: {
  tab: "skills" | "tools";
  rows: readonly CsvRow[];
  gate?: ActionGate;
}): ReactNode {
  const disabled = !gate.enabled;
  return (
    <span className="cap6-export-wrap">
      <Button
        size="sm"
        outlined
        disabled={disabled}
        aria-disabled={disabled ? "true" : undefined}
        title={gate.title}
        data-testid="cap6-export"
        onClick={() => downloadCsv(exportFilename(tab), toCsv(rows))}
      >
        <Download className="mr-1 size-3.5" aria-hidden="true" />导出 CSV
      </Button>
      <span className="cap6-export-count" data-testid="cap6-export-count">{gate.count}</span>
      <span className="sr-only" data-testid="cap-gates-export" data-enabled={gate.enabled ? "true" : "false"} title={gate.title} />
    </span>
  );
}
