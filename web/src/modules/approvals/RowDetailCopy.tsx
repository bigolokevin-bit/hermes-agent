/**
 * R100 — copy the expanded row's preview as plain text, assembled ONLY from
 * the already-loaded row object (zero extra requests). Deliberately distinct
 * from apd8-copy (the decision-trail text) and apv7-export (the CSV file):
 * this is the single-row preview summary, line by line, using the same
 * missing-value sentences as the panels (stateCopy single source).
 *
 * The button stays present while nothing is expanded and says why it cannot
 * be used — the alternative (rendering it only inside the preview) could not
 * express the 「先展开一行审批再复制」 state. Feedback uses role="status"
 * (implicitly polite) per the R86 single-announcer contract.
 */
import { useMemo, useState } from "react";

import { Button } from "@nous-research/ui/ui/components/button";

import { epochOf, timeTitle } from "./RelativeTime";
import { APPROVAL_RID_MISSING, FIELD_MISSING_SENTENCE } from "./stateCopy";
import type { ApprovalRow } from "./model";

/** 同一拼装单点：每行 标签：值；缺值句与屏上同形制。 */
export function rowDetailText(row: ApprovalRow): string {
  const submitted = epochOf(row.submittedAt);
  const decided = epochOf(row.decidedAt);
  return [
    `标题：${row.title}`,
    `状态：${row.status.label}`,
    `风险档：${row.risk.label}`,
    `提交时间：${submitted === null ? FIELD_MISSING_SENTENCE : timeTitle(submitted, row.submittedAt ?? "")}`,
    `更新时间：${decided === null ? FIELD_MISSING_SENTENCE : timeTitle(decided, row.decidedAt ?? "")}`,
    `审批人：${row.approvers.labels.length > 0 ? row.approvers.labels.join("、") : FIELD_MISSING_SENTENCE}`,
    row.requestId ? `请求编号：${row.requestId}` : APPROVAL_RID_MISSING,
  ].join("\n");
}

export function RowDetailCopy({ row }: { row: ApprovalRow | null }) {
  const [status, setStatus] = useState<"idle" | "done" | "failed">("idle");
  const text = useMemo(() => (row ? rowDetailText(row) : null), [row]);
  const copy = () => {
    if (!text) return;
    const write = navigator.clipboard?.writeText;
    if (!write) {
      setStatus("failed");
      return;
    }
    write.call(navigator.clipboard, text).then(
      () => setStatus("done"),
      () => setStatus("failed"),
    );
  };
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
      <Button
        size="sm"
        outlined
        className="shrink-0 whitespace-nowrap"
        data-testid="apd11-copy"
        disabled={text === null}
        title={
          text === null
            ? "先展开一行审批再复制"
            : "复制这一行的预览详情为纯文本（标题/状态/风险档/时间/审批人/请求编号，缺值句与屏上同形制）；只读已加载行数据，不产生请求。"
        }
        onClick={copy}
      >
        复制预览详情
      </Button>
      <span data-testid="apd11-copy-status" role="status" className="min-w-0 break-words text-muted-foreground">
        {status === "done" ? "已复制" : status === "failed" ? "剪贴板写入被拒绝，可用下方文本框手动复制。" : ""}
      </span>
      {status === "failed" && text !== null ? (
        <textarea
          data-testid="apd11-copy-fallback"
          readOnly
          rows={7}
          value={text}
          onFocus={(event) => event.currentTarget.select()}
          className="w-full min-w-0 rounded-sm border border-white/15 bg-transparent p-2 font-mono text-xs"
          aria-label="预览详情复制兜底文本框"
          title="内容与复制按钮给出的文本逐字相同；手动选择后复制。"
        />
      ) : null}
    </div>
  );
}
