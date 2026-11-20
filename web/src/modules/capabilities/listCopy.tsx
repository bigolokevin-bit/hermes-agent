// Copy the currently displayed capability rows as plain text. The text is a
// projection of the table only: no request, no clock, no invented value. A
// missing cell prints the same 「—」 the table shows, never a zero.
import { useState, type ReactNode } from "react";
import { Copy } from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { copyTextToClipboard } from "@/lib/clipboard";
import type { CsvRow } from "./csv";

export const COPY_HEADER = "name,type,enabled,updated_at";

export function toListText(rows: readonly CsvRow[]): string {
  const lines = [COPY_HEADER];
  for (const row of rows) {
    lines.push([row.name, row.type, row.enabled, row.updated_at].map((value) => value ?? "—").join(","));
  }
  return lines.join("\n");
}

export function CapabilityCopy({ rows }: { rows: readonly CsvRow[] }): ReactNode {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const [count, setCount] = useState(0);
  const text = toListText(rows);
  const empty = rows.length === 0;

  const copy = async () => {
    if (empty) return;
    if (await copyTextToClipboard(text)) {
      setCount(rows.length);
      setState("copied");
      return;
    }
    setState("failed");
  };

  return (
    <>
      <span className="capC-copy-wrap">
        <Button
          size="sm"
          outlined
          disabled={empty}
          aria-disabled={empty ? "true" : undefined}
          title={empty ? "当前视图没有可复制的行" : "复制当前列表为纯文本；不会再发请求"}
          data-testid="capC-copy"
          onClick={() => void copy()}
        >
          <Copy className="mr-1 size-3.5" aria-hidden="true" />复制列表
        </Button>
        <span className="capC-copy-status" data-testid="capC-copy-status" role="status" aria-live="polite">
          {state === "copied" ? `已复制 ${count} 行` : state === "failed" ? "复制失败，已展开手动复制" : ""}
        </span>
      </span>
      {state === "failed" ? (
        <textarea
          className="capC-copy-fallback"
          data-testid="capC-copy-fallback"
          aria-label="手动复制当前列表文本"
          readOnly
          rows={Math.min(8, rows.length + 1)}
          value={text}
        />
      ) : null}
    </>
  );
}