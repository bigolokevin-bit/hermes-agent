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
import { Link } from "react-router";

import { Badge } from "@nous-research/ui/ui/components/badge";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";

import { themedBody } from "@/lib/utils";
import { humanizeHandles, money, type ApprovalDetail, type ApprovalRow } from "./model";
import { DetailsDisclosure } from "./states";
import { shortRef } from "@/modules/tasks/tasksBoard";

/** A label/value pair that never overflows its column at 375px. */
function Field({
  label,
  value,
  reason,
  tone,
  testId,
}: {
  label: string;
  value: string;
  /** Why the value is missing; shown as the `title` so the gap is explainable. */
  reason?: string;
  tone?: ReactNode;
  testId?: string;
}): ReactNode {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5" data-testid={testId}>
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
      data-testid={`apr5-row-${row.key}`}
      // R26 F1: the whole row is the affordance — clicking anywhere (or
      // pressing Enter/Space on it) selects the ticket and opens its detail.
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <CardContent className="flex min-w-0 flex-col gap-2 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
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
          <Field
            label="申请人"
            value={row.requester.label}
            reason={row.requester.raw ?? (row.requester.label === "—" ? "服务未提供申请人信息。" : undefined)}
          />
          <Field
            label="执行员工"
            value={row.worker.label}
            reason={row.worker.raw ?? (row.worker.label === "—" ? "服务未提供执行员工。" : undefined)}
          />
          <Field label="提交" value={row.submitted ?? "—"} reason={row.submitted ? undefined : MISSING_TIME} />
          <Field
            label={row.clockLabel}
            value={row.clock ?? "—"}
            reason={row.clock ? undefined : MISSING_TIME}
          />
          <Field label="涉及金额" value={money(row.amount)} reason={row.amount === null ? MISSING_AMOUNT : undefined} />
        </dl>

        {row.reason ? (
          <p className="min-w-0 break-words text-xs text-muted-foreground" title={row.reason}>事由：{humanizeHandles(row.reason)}</p>
        ) : null}

        <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <DetailsDisclosure
          testId={`apr5-row-details-${row.key}`}
          lines={[
            row.rawId ? `单据标识：${row.rawId}` : "",
            `状态原值：${row.status.raw ?? "未提供"}`,
          ]}
        />
        </div>
      </CardContent>
    </Card>
  );
}

/** The decision controls, supplied by the pending pane only. */

/* ------------------------------------------------------------------ *
 * R46 apd6 — the decision trail. Same data, one honest timeline:
 * submitted → every recorded decision (service order, never re-sorted
 * here) → approvers still outstanding → terminal state → related
 * run/task/evidence. Any segment without backing data says 该段无记录
 * with the reason in the title; nothing is invented.
 * ------------------------------------------------------------------ */

function NoSeg({ reason }: { reason: string }) {
  return (
    <span className="text-muted-foreground" title={reason}>
      该段无记录
    </span>
  );
}

export function DecisionTrail({ detail }: { detail: ApprovalDetail }): ReactNode {
  const acted = detail.decisions;
  const pending = detail.approvers.labels.filter((label) => !acted.some((entry) => entry.who === label));
  return (
    <section
      className="flex min-w-0 flex-col gap-1"
      data-testid="apd6-trail"
      aria-label="决策链路（只读）"
    >
      <h3 className="text-xs font-medium text-muted-foreground">决策链路 · 只读（节点顺序即服务返回顺序）</h3>
      <ol className="flex min-w-0 flex-col gap-1 text-xs">
        <li className="min-w-0 break-words" data-testid="apd6-step-submitted" title={detail.requester.raw ?? undefined}>
          提交 · {detail.requester.label} ·{" "}
          {detail.submitted ?? <NoSeg reason={MISSING_TIME} />}
        </li>
        {acted.length === 0 ? (
          <li className="min-w-0 break-words" data-testid="apd6-step-nodes-none">
            审批节点 · <NoSeg reason="服务未返回任何决策记录。" />
          </li>
        ) : (
          acted.map((entry, index) => (
            <li
              key={`${entry.who}-${index}`}
              className="min-w-0 break-words"
              data-testid={`apd6-step-node-${index}`}
              title={entry.whoRaw ?? undefined}
            >
              节点 {index + 1} · {entry.who} · {entry.verdict} ·{" "}
              {entry.at ?? <NoSeg reason="这个节点没有带回决策时间。" />} · 意见：{entry.note ?? "未填"}
            </li>
          ))
        )}
        {pending.map((label, index) => (
          <li
            key={`pending-${label}-${index}`}
            className="min-w-0 break-words"
            data-testid={`apd6-step-pending-${index}`}
            title={detail.approvers.raw ?? undefined}
          >
            {label} · 待办 · <NoSeg reason="该审批人还没有给出决定。" /> · 意见：未填
          </li>
        ))}
        <li className="min-w-0 break-words" data-testid="apd6-step-final" title={detail.status.raw ?? undefined}>
          终态 · {detail.status.label}
          {detail.decided ? ` · ${detail.decided}` : ""}
        </li>
        <li className="min-w-0 break-words" data-testid="apd6-step-links">
          关联：{" "}
          {detail.runId ? (
            <Link
              className="underline underline-offset-2"
              to={`/runs/${encodeURIComponent(detail.runId)}`}
              title={detail.runId}
              data-testid="apd6-link-run"
            >
              运行 · {shortRef(detail.runId)}
            </Link>
          ) : (
            <span data-testid="apd6-link-run-none">运行 <NoSeg reason="服务返回的单据没有带关联运行编号。" /></span>
          )}{" "}
          ·{" "}
          {detail.taskId ? (
            <Link
              className="underline underline-offset-2"
              to={`/tasks/${encodeURIComponent(detail.taskId)}`}
              title={detail.taskId}
              data-testid="apd6-link-task"
            >
              任务 · {shortRef(detail.taskId)}
            </Link>
          ) : (
            <span data-testid="apd6-link-task-none">任务 <NoSeg reason="服务返回的单据没有带关联任务编号。" /></span>
          )}{" "}
          ·{" "}
          <span data-testid="apd6-link-evidence-none">
            证据 <NoSeg reason="证据读取路径尚未在服务侧开放（本代次实测该路由返回 unknown_route）。" />
          </span>
        </li>
      </ol>
    </section>
  );
}

export function ApprovalDetailBody({
  detail,
  actions,
  testId = "apd5-detail",
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
        <Field label="类型" value={detail.kind.label} testId="apd5-field-change-kind" />
        <Field
          label="申请人"
          value={detail.requester.label}
          reason={detail.requester.raw ?? (detail.requester.label === "—" ? "服务未提供申请人信息。" : undefined)}
        />
        <Field
          label="执行员工"
          value={detail.worker.label}
          reason={detail.worker.raw ?? (detail.worker.label === "—" ? "服务未提供执行员工。" : undefined)}
        />
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
        {/* R17 apd5: PRD §4.2 frozen decision fields — conclusion, decided
          * time, recipient, data-scope snapshot, action hash, request id. */}
        <Field
          label="结论"
          value={detail.decisions.length ? detail.decisions[detail.decisions.length - 1].verdict : "—"}
          reason={detail.decisions.length ? undefined : "还没有人给出结论。"}
          testId="apd5-field-verdict"
        />
        <Field
          label="决定时间"
          value={detail.decided ?? "—"}
          reason={detail.decided ? undefined : MISSING_TIME}
          testId="apd5-field-decided-at"
        />
        <Field
          label="收件人"
          value={detail.recipient.label ?? "—"}
          reason={detail.recipient.label ? (detail.recipient.raw ?? undefined) : "单据未写明收件对象。"}
          testId="apd5-field-recipient"
        />
        <Field
          label="数据范围（快照）"
          value={detail.dataScope ?? "—"}
          reason={detail.dataScope ? "创建时的数据范围快照，只读。" : "服务未提供数据范围快照。"}
          testId="apd5-field-scope"
        />
        <div className="flex min-w-0 items-baseline gap-1.5" data-testid="apd5-field-action-hash">
          <dt className="shrink-0 text-muted-foreground">操作指纹</dt>
          <dd className="min-w-0 break-words text-foreground">
            {detail.actionHash ? (
              <span title={detail.actionHash}>
                {detail.actionHash.slice(0, 8)}…
                <button
                  type="button"
                  aria-label="复制操作指纹"
                  data-testid="apd5-copy-action-hash"
                  className="ml-1 text-xs text-muted-foreground underline underline-offset-2"
                  onClick={() => {
                    void navigator.clipboard?.writeText(detail.actionHash ?? "");
                  }}
                >
                  复制
                </button>
              </span>
            ) : (
              <span title="服务未提供操作指纹">—</span>
            )}
          </dd>
        </div>
        <div className="flex min-w-0 items-baseline gap-1.5" data-testid="apd5-field-request-id">
          <dt className="shrink-0 text-muted-foreground">请求编号</dt>
          <dd className="min-w-0 break-words text-foreground">
            {detail.requestId ? (
              <>
                <code data-testid="apd5-request-id" title={detail.requestId}>
                  {detail.requestId}
                </code>
                <button
                  type="button"
                  aria-label="复制请求编号"
                  data-testid="apd5-copy-detail-request-id"
                  className="ml-1 text-xs underline underline-offset-2"
                  onClick={() => {
                    void navigator.clipboard?.writeText(detail.requestId ?? "");
                  }}
                >
                  复制
                </button>
              </>
            ) : (
              <span data-testid="apd5-request-id-missing" title="这条记录没有带回请求编号">—</span>
            )}
          </dd>
        </div>
      </dl>

      {detail.reason ? (
        <p className="min-w-0 break-words text-xs text-muted-foreground" title={detail.reason ?? undefined}>事由：{humanizeHandles(detail.reason)}</p>
      ) : null}

      {/* R28 item 2: the approver slot is always present; empty means a
        * dash with a reason, never a missing field. */}
      <p
        className="min-w-0 break-words text-xs text-muted-foreground"
        data-testid="apd5-field-approver"
      >
        审批人：
        {detail.approvers.labels.length ? (
          <span data-testid="apd5-approver" title={detail.approvers.raw ?? undefined}>
            {detail.approvers.labels.join("、")}
          </span>
        ) : (
          <span title="单据没有带回审批人">—</span>
        )}
      </p>

      {detail.supersededBy ? (
        <p className="min-w-0 break-words text-xs text-warning">这张单已被另一张替代，请到「待处理」里查看新单。</p>
      ) : null}

      {/* apd7: the decision replay is a titled read-only block — every entry
        * names who decided (masked handle or 未指派), the verdict, the Beijing
        * minute, and the note; an empty list says so plainly. */}
      <section className="flex min-w-0 flex-col gap-1" data-testid="apd5-replay" aria-label="决策回放（只读）">
        <h3 className="text-xs font-medium text-muted-foreground">决策回放 · 只读</h3>
        {detail.decisions.length ? (
          <ul className="flex min-w-0 flex-col gap-1 text-xs">
            {detail.decisions.map((entry, index) => (
              <li key={`${entry.who}-${index}`} className="min-w-0 break-words text-muted-foreground" data-testid="apd5-decision">
                <span title={entry.whoRaw ?? undefined}>{entry.who}</span> · {entry.verdict}
                {entry.at ? ` · ${entry.at}` : ""}
                {entry.note ? ` · 意见：${entry.note}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="apd5-replay-empty">无决策记录。</p>
        )}
      </section>

      <DecisionTrail detail={detail} />

      <DetailsDisclosure testId={`${testId}-details`} lines={details} />

      {actions}
    </div>
  );
}
