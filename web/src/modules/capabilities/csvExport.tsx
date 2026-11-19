import type { ReactNode } from "react";
import { Download } from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { downloadCsv, exportFilename, toCsv, type CsvRow } from "./csv";

export function CapabilityExport({ tab, rows }: { tab: "skills" | "tools"; rows: readonly CsvRow[] }): ReactNode {
  const empty = rows.length === 0;
  return (
    <span className="cap6-export-wrap">
      <Button
        size="sm"
        outlined
        disabled={empty}
        aria-disabled={empty ? "true" : undefined}
        title={empty ? "当前视图无可导出数据" : `导出当前视图 ${rows.length} 条`}
        data-testid="cap6-export"
        onClick={() => downloadCsv(exportFilename(tab), toCsv(rows))}
      >
        <Download className="mr-1 size-3.5" aria-hidden="true" />导出 CSV
      </Button>
      <span className="cap6-export-count" data-testid="cap6-export-count">{empty ? "0 条" : `${rows.length} 条`}</span>
    </span>
  );
}
