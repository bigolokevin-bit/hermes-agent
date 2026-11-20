import type { ReactNode } from "react";
import { Download } from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { downloadCsv, exportFilename, toCsv, type CsvRow } from "./csv";
import { outputBlocked, outputCount, outputTitle, type CapabilityOutputState } from "./outputState";

export function CapabilityExport({
  tab,
  rows,
  state = rows.length ? { kind: "ready" } : { kind: "empty" },
}: {
  tab: "skills" | "tools";
  rows: readonly CsvRow[];
  state?: CapabilityOutputState;
}): ReactNode {
  const disabled = outputBlocked(state) || rows.length === 0;
  return (
    <span className="cap6-export-wrap">
      <Button
        size="sm"
        outlined
        disabled={disabled}
        aria-disabled={disabled ? "true" : undefined}
        title={outputTitle(state, "导出", rows.length)}
        data-testid="cap6-export"
        onClick={() => downloadCsv(exportFilename(tab), toCsv(rows))}
      >
        <Download className="mr-1 size-3.5" aria-hidden="true" />导出 CSV
      </Button>
      <span className="cap6-export-count" data-testid="cap6-export-count">{outputCount(state, rows.length)}</span>
    </span>
  );
}
