/**
 * approvals view pieces — the queue row and the ticket body.
 *
 * Both render the same funnel: every value is a sentence, a Beijing wall clock,
 * or US dollars, and anything the service did not send shows 「—」 with the
 * reason in its `title`. Raw identifiers, state tokens and digests never reach
 * the text of the page — they live in `title` attributes and the 「详情」
 * disclosure, which is collapsed by default.
 */
import type { ReactNode } from "react";

import { Badge } from "@nous-research/ui/ui/components/badge";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";

import { themedBody } from "@/lib/utils";
import { money, type ApprovalDetail, type ApprovalRow } from "./model";
import { DetailsDisclosure } from "./states";

/** A label/value pair that never overflows its column at 375px. */
function Field({
  label,
  value,
  reason,
  tone,
}: {
  label: string;
  value: string;
  /** Why the value is missing; shown as the `title` so the gap is explainable. */
  reason?: string;
  tone?: ReactNode;
}): ReactNode {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground" title={reason}>
        {value}
        {tone}
      </dd>
    </div>
  );
}

const MISSING_TIME = "服务未提供该时间";
const MISSING_AMOUNT = "服务未提供该数值";

export function ApprovalRowCard({
  row,
  selected,
  onOpen,
}: {
  row: ApprovalRow;
  selected: boolean;
  onOpen: () => void;
}): ReactNode {
  return (
    <Card
      className={`border-border bg-card ${selected ? "ring-1 ring-primary/60" : ""}`}
      data-testid={`approval-row-${row.key}`}
    >
      <CardContent className="flex min-w-0 flex-col gap-2 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <button
            type="button"
            onClick={onOpen}
            title={row.rawId ?? undefined}
            className="min-w-0 flex-1 break-words text-left text-sm hover:underline"
          >
            <span className={themedBody}>{row.title}</span>
          </button>
          <Badge tone={row.status.tone} title={row.status.raw ?? undefined}>
            {row.status.label}
          </Badge>
        </div>

        <dl className="flex min-w-0 flex-wrap gap-x-5 gap-y-1 text-xs">
          <Field label="申请人" value={row.requester.label} reason={row.requester.raw ?? undefined} />
          <Field label="执行员工" value={row.worker.label} reason={row.worker.raw ?? undefined} />
          <Field label="提交" value={row.submitted ?? "—"} reason={row.submitted ? undefined : MISSING_TIME} />
          <Field
            label={row.clockLabel}
            value={row.clock ?? "—"}
            reason={row.clock ? undefined : MISSING_TIME}
          />
          <Field label="涉及金额" value={money(row.amount)} reason={row.amount === null ? MISSING_AMOUNT : undefined} />
        </dl>

        {row.reason ? (
          <p className="min-w-0 break-words text-xs text-muted-foreground">事由：{row.reason}</p>
        ) : null}

        <DetailsDisclosure
          testId={`approval-row-details-${row.key}`}
          lines={[
            row.rawId ? `单据标识：${row.rawId}` : "",
            `状态原值：${row.status.raw ?? "未提供"}`,
          ]}
        />
      </CardContent>
    </Card>
  );
}

/** The decision controls, supplied by the pending pane only. */
export function ApprovalDetailBody({
  detail,
  actions,
  testId = "approval-detail",
}: {
  detail: ApprovalDetail;
  actions?: ReactNode;
  testId?: string;
}): ReactNode {
  const details = [
    ...detail.technical,
    detail.kind.raw ? `变更类型原值：${detail.kind.raw}` : "",
    detail.risk.raw ? `风险等级原值：${detail.risk.raw}` : "",
  ];
  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid={testId}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className={`min-w-0 flex-1 break-words text-sm ${themedBody}`} title={detail.rawId ?? undefined}>
          {detail.title}
        </h2>
        <Badge tone={detail.status.tone} title={detail.status.raw ?? undefined}>
          {detail.status.label}
        </Badge>
        <Badge tone={detail.risk.tone} title={detail.risk.raw ?? undefined}>
          {detail.risk.label}
        </Badge>
      </div>

      <dl className="flex min-w-0 flex-wrap gap-x-5 gap-y-1 text-xs">
        <Field label="类型" value={detail.kind.label} />
        <Field label="申请人" value={detail.requester.label} reason={detail.requester.raw ?? undefined} />
        <Field label="执行员工" value={detail.worker.label} reason={detail.worker.raw ?? undefined} />
        <Field label="提交" value={detail.submitted ?? "—"} reason={detail.submitted ? undefined : MISSING_TIME} />
        <Field
          label="处理期限"
          value={detail.deadline ?? "—"}
          reason={detail.deadline ? undefined : MISSING_TIME}
          tone={detail.remaining ? <span className="ml-1 text-muted-foreground">（{detail.remaining.text}）</span> : undefined}
        />
        <Field
          label="涉及金额"
          value={money(detail.amount)}
          reason={detail.amount === null ? MISSING_AMOUNT : undefined}
        />
      </dl>

      {detail.reason ? (
        <p className="min-w-0 break-words text-xs text-muted-foreground">事由：{detail.reason}</p>
      ) : null}

      {detail.approvers.labels.length ? (
        <p className="min-w-0 break-words text-xs text-muted-foreground" title={detail.approvers.raw ?? undefined}>
          审批人：{detail.approvers.labels.join("、")}
        </p>
      ) : null}

      {detail.supersededBy ? (
        <p className="min-w-0 break-words text-xs text-warning">这张单已被另一张替代，请到「待处理」里查看新单。</p>
      ) : null}

      {detail.decisions.length ? (
        <ul className="flex min-w-0 flex-col gap-1 text-xs">
          {detail.decisions.map((entry, index) => (
            <li key={`${entry.who}-${index}`} className="min-w-0 break-words text-muted-foreground">
              <span title={entry.whoRaw ?? undefined}>{entry.who}</span> · {entry.verdict}
              {entry.at ? ` · ${entry.at}` : ""}
              {entry.note ? ` · 备注：${entry.note}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className="min-w-0 break-words text-xs text-muted-foreground">还没有人给出结论。</p>
      )}

      <DetailsDisclosure testId={`${testId}-details`} lines={details} />

      {actions}
    </div>
  );
}
