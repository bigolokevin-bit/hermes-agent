/**
 * approvals view pieces — the queue row and the ticket body.
 *
 * Both render the same funnel: every value is a sentence, a Beijing wall clock,
 * or US dollars, and anything the service did not send shows 「—」 with the
 * reason in its `title`. Raw identifiers, state tokens and digests never reach
 * the text of the page — they live in `title` attributes and the 「详情」
 * disclosure, which is collapsed by default.
 */
import { useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";

import { themedBody } from "@/lib/utils";
import { humanizeHandles, money, type ApprovalDetail, type ApprovalRow } from "./model";
import { DetailsDisclosure, RequestIdCopyField } from "./states";
import { RelativeTime } from "./RelativeTime";
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
  value: ReactNode;
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

// R80: 长值单行截断——阈值与字符截断形态集中在这一处；行卡/行内预览/详情主体/
// trail 全走同一助手，屏上显截断值、title 恒全文（与复制/导出的全文同源同值）。
// 不超过阈值不加省略号也不加 title；空值走各自既有缺值口径，不进本助手。
export const TRUNCATE_LIMIT = 60;

export function truncateDisplay(text: string): { shown: string; full: string | null } {
  if (text.length <= TRUNCATE_LIMIT) return { shown: text, full: null };
  return { shown: `${text.slice(0, TRUNCATE_LIMIT - 1)}…`, full: text };
}

const MISSING_TIME = "服务未提供该时间";
const MISSING_AMOUNT = "服务未提供该数值";

export function ApprovalRowCard({
  row,
  selected,
  onOpen,
  previewOpen,
  onTogglePreview,
  active,
  onActivate,
  onNavKey,
  onClosePreview,
}: {
  row: ApprovalRow;
  selected: boolean;
  onOpen: () => void;
  /** R60: 行内就地展开预览 — 纯本地数据，不打开详情抽屉、不发任何请求。 */
  previewOpen: boolean;
  onTogglePreview: () => void;
  /** R73: roving tabindex — 仅当前行入 tab 序；方向键导航由页层处理。 */
  active: boolean;
  onActivate: () => void;
  onNavKey: (action: "ArrowUp" | "ArrowDown" | "Home" | "End", fromKey: string) => void;
  /** R73: Esc 收起预览并把焦点还给该行。 */
  onClosePreview: () => void;
}): ReactNode {
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const closeRefocus = (): void => {
    if (previewOpen) onTogglePreview();
    toggleRef.current?.focus();
  };
  return (
    <Card
      className={`border-border bg-card ${selected ? "ring-1 ring-primary/60" : ""}`}
      data-testid={`apr5-row-${row.key}`}
      // R26 F1: the whole row is the affordance — clicking anywhere (or
      // pressing Enter/Space on it) selects the ticket and opens its detail.
      role="button"
      tabIndex={active ? 0 : -1}
      aria-expanded={previewOpen}
      onFocus={onActivate}
      onClick={onOpen}
      onKeyDown={(event) => {
        // R73 裁决：Enter=就地展开预览（工单明文）；Space 保留 R26 F1 的
        // 「键盘打开详情」通道；方向键只在有行的 ready 态存在（四态无行=
        // 天然不劫持），Esc 收起预览并把焦点还给本行。
        if (event.key === "Enter") {
          event.preventDefault();
          onTogglePreview();
          return;
        }
        if (event.key === " ") {
          event.preventDefault();
          onOpen();
          return;
        }
        if (event.key === "Escape") {
          if (previewOpen) {
            event.preventDefault();
            onClosePreview();
          }
          return;
        }
        if (
          event.key === "ArrowDown" ||
          event.key === "ArrowUp" ||
          event.key === "Home" ||
          event.key === "End"
        ) {
          event.preventDefault();
          onNavKey(event.key, row.key);
        }
      }}
    >
      <CardContent className="flex min-w-0 flex-col gap-2 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <button
            ref={toggleRef}
            type="button"
            data-testid={`apv9-toggle-${row.key}`}
            aria-expanded={previewOpen}
            title="就地展开预览（不打开详情，不产生新请求）"
            className="shrink-0 rounded-sm border border-white/15 p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/40"
            onClick={(event) => {
              event.stopPropagation();
              onTogglePreview();
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                closeRefocus();
              }
            }}
          >
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform ${previewOpen ? "rotate-90" : ""}`}
              aria-hidden="true"
            />
            <span className="sr-only">行内预览</span>
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
            title={row.rawId ?? undefined}
            className="min-w-0 flex-1 break-words text-left text-sm hover:underline"
          >
            <span
              className={themedBody}
              data-testid={`apv-trunc-row-title-${row.key}`}
              title={truncateDisplay(row.title).full ?? undefined}
            >
              {truncateDisplay(row.title).shown}
            </span>
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
          {/* R76: 相对时间+title 绝对/ISO——与预览、决策链路同一 helper 同一输入。 */}
          <Field
            label="提交"
            value={<RelativeTime iso={row.submittedAt} testid={`apv-time-row-submitted-${row.key}`} />}
          />
          <Field
            label={row.clockLabel}
            value={<RelativeTime iso={row.clockAt} testid={`apv-time-row-${row.key}`} />}
          />
          <Field label="涉及金额" value={money(row.amount)} reason={row.amount === null ? MISSING_AMOUNT : undefined} />
        </dl>

        {row.reason ? (
          <p
            className="min-w-0 break-words text-xs text-muted-foreground"
            data-testid={`apv-trunc-row-reason-${row.key}`}
            title={truncateDisplay(humanizeHandles(row.reason)).full ?? undefined}
          >
            事由：{truncateDisplay(humanizeHandles(row.reason)).shown}
          </p>
        ) : null}

        <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        {previewOpen ? (
          <div
            data-testid={`apv9-preview-${row.key}`}
            role="region"
            aria-label="行内预览"
            className="min-w-0 rounded-sm border border-white/10 bg-white/[0.03] p-3"
            onClick={(event) => {
              event.stopPropagation();
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                closeRefocus();
              }
            }}
          >
            <p
              className={`break-words text-sm ${themedBody}`}
              data-testid={`apv-trunc-preview-title-${row.key}`}
              title={truncateDisplay(row.title).full ?? undefined}
            >
              {truncateDisplay(row.title).shown}
            </p>
            <dl className="mt-2 grid min-w-0 gap-1.5 text-xs">
              <Field
                label="状态"
                value={row.status.label}
                reason={row.status.raw ?? "原始状态值未返回"}
              />
              {/* R65 parity: the risk reads exactly what the detail badge
                * reads (riskView 同值，缺值=「未标注风险」)；时间走 decided —
                * 与详情的「决定时间」同一键序同一助手。缺字段口径=「该字段未返回」。 */}
              <Field
                label="风险档"
                value={row.risk.label}
                reason={row.risk.raw ?? "该字段未返回"}
              />
              <Field
                label="更新时间"
                value={<RelativeTime iso={row.decidedAt} testid={`apv-time-preview-${row.key}`} />}
              />
              <Field
                label="审批人"
                value={
                  row.approvers.labels.length > 0
                    ? (() => {
                        const joined = row.approvers.labels.join("、");
                        const t = truncateDisplay(joined);
                        return (
                          <span data-testid={`apv-trunc-preview-approvers-${row.key}`} title={t.full ?? undefined}>
                            {t.shown}
                          </span>
                        );
                      })()
                    : "—"
                }
                reason={
                  row.approvers.labels.length > 0
                    ? row.approvers.raw ?? undefined
                    : row.approvers.raw
                      ? `该字段未返回姓名（原值：${row.approvers.raw}）`
                      : "该字段未返回"
                }
              />
            </dl>
            <p className="mt-2 min-w-0 break-words text-xs">
              <RequestIdCopyField
                requestId={row.requestId}
                fallback="请求编号：该字段未返回"
              />
            </p>
          </div>
        ) : null}

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

/**
 * R61 apd8 — the trail as human-readable text, in exactly the order the
 * screen shows it. Raw ids never enter the copy; missing segments keep the
 * 「该段无记录」 wording, missing comments keep 「未填」. Nothing new is
 * asked of the server — this reads only the detail already on screen.
 */
function trailToText(detail: ApprovalDetail): string {
  const lines: string[] = [
    `提交 · ${detail.requester.label} · ${detail.submitted ?? "该段无记录"}`,
  ];
  if (detail.decisions.length === 0) {
    lines.push("审批节点 · 该段无记录");
  } else {
    detail.decisions.forEach((entry, index) => {
      lines.push(
        `节点 ${index + 1} · ${entry.who} · ${entry.verdict} · ${entry.at ?? "该段无记录"} · 意见：${entry.note ?? "未填"}`,
      );
    });
  }
  const pending = detail.approvers.labels.filter(
    (label) => !detail.decisions.some((entry) => entry.who === label),
  );
  for (const label of pending) lines.push(`${label} · 待办 · 该段无记录 · 意见：未填`);
  lines.push(`终态 · ${detail.status.label}${detail.decided ? ` · ${detail.decided}` : ""}`);
  return lines.join("\n");
}

export function DecisionTrail({ detail }: { detail: ApprovalDetail }): ReactNode {
  const acted = detail.decisions;
  const pending = detail.approvers.labels.filter((label) => !acted.some((entry) => entry.who === label));
  const copyText = useMemo(() => trailToText(detail), [detail]);
  const emptyTrail = acted.length === 0 && pending.length === 0;
  const [copyState, setCopyState] = useState<"idle" | "done" | "failed">("idle");
  const [showFallback, setShowFallback] = useState(false);
  const copyTrail = () => {
    const clip = navigator.clipboard;
    if (!clip?.writeText) {
      setCopyState("failed");
      setShowFallback(true);
      return;
    }
    clip.writeText(copyText).then(
      () => {
        setCopyState("done");
        setShowFallback(false);
      },
      () => {
        setCopyState("failed");
        setShowFallback(true);
      },
    );
  };
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
          <RelativeTime iso={detail.submittedAt} testid="apv-time-detail-submitted" />
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
              <RelativeTime iso={entry.atRaw} testid={`apv-time-detail-node-${index}`} /> · 意见：
              {entry.note == null ? (
                "未填"
              ) : (
                <span data-testid={`apv-trunc-note-${index}`} title={truncateDisplay(entry.note).full ?? undefined}>
                  {truncateDisplay(entry.note).shown}
                </span>
              )}
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
          {detail.decidedAt ? (
            <>
              {" · "}
              <RelativeTime iso={detail.decidedAt} testid="apv-time-detail-final" />
            </>
          ) : ""}
        </li>
        <li className="min-w-0 break-words" data-testid="apd6-step-links">
          关联：{" "}
          {detail.runId ? (
            <Link
              className="underline underline-offset-2"
              to={`/runs?run=${encodeURIComponent(detail.runId)}`}
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
              to={`/work?tab=board&task=${encodeURIComponent(detail.taskId)}`}
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
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xs">
        <Button
          size="sm"
          outlined
          data-testid="apd8-copy"
          disabled={emptyTrail}
          title={
            emptyTrail
              ? "服务没有返回任何决策节点，也没有待办审批人：没有可复制的链路。"
              : "按屏上同序复制为纯文本；只读屏上已有数据，不产生新请求。"
          }
          onClick={copyTrail}
        >
          复制为纯文本
        </Button>
        <span data-testid="apd8-copy-status" aria-live="polite" className="text-muted-foreground">
          {copyState === "done"
            ? "已复制"
            : copyState === "failed"
              ? "剪贴板写入被拒绝，可用下方文本框手动复制。"
              : ""}
        </span>
      </div>
      {showFallback ? (
        <textarea
          data-testid="apd8-fallback"
          readOnly
          rows={8}
          aria-label="决策链路文本（手动复制）"
          title="剪贴板不可用时的兜底：全选后手动复制；文本与屏上链路同序同口径。"
          className="w-full min-w-0 rounded-sm border border-border bg-transparent p-2 font-mono text-xs"
          value={copyText}
          onFocus={(e) => e.currentTarget.select()}
        />
      ) : null}
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
        <h2
          className={`min-w-0 flex-1 break-words text-sm ${themedBody}`}
          title={truncateDisplay(detail.title).full ?? detail.rawId ?? undefined}
          data-testid="apv-trunc-detail-title"
        >
          {truncateDisplay(detail.title).shown}
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
        <p
          className="min-w-0 break-words text-xs text-muted-foreground"
          data-testid="apv-trunc-detail-reason"
          title={truncateDisplay(humanizeHandles(detail.reason)).full ?? undefined}
        >
          事由：{truncateDisplay(humanizeHandles(detail.reason)).shown}
        </p>
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

      {/* R82: 审计台账真链——audit 读口按 resourceId=审批单号真过滤
        * （活体实测：resourceId=ap_… → 200 n=1 命中 approval.expired；
        * resourceId=资源路径 → 200 n=0；limit 单参 → 400 需过滤）。
        * 页级消费 ?resource= → 线上 resourceId=（aud8 契约），并带默认时间窗。
        * ?event= 需要审计事件 id——审批对象不带该字段，禁编造：这里给的是
        * 过滤真链，不是假事件定位链。 */}
      <section className="flex min-w-0 flex-col gap-1 text-xs" data-testid="apd9-correlation" aria-label="相关记录">
        <h3 className="text-xs font-medium text-muted-foreground">相关记录 · 只读</h3>
        {detail.rawId ? (
          <Link
            className="min-w-0 break-words underline underline-offset-2"
            to={`/audit?resource=${encodeURIComponent(detail.rawId)}`}
            title="打开审计台账并按该审批单号过滤（服务端 resourceId 真过滤，默认时间窗；审批对象不带审计事件 id，故这不是按事件行的定位链）。"
            data-testid="apd9-audit-link"
          >
            在审计中查看相关记录
          </Link>
        ) : (
          <p className="min-w-0 break-words" data-testid="apd9-audit-note">
            审计跳转
            <NoSeg reason="该字段未返回（审批单号没有回传，无法拼出过滤链接，禁编造 id）。" />
          </p>
        )}
        <p className="min-w-0 break-words">
          <RequestIdCopyField requestId={detail.requestId} fallback="请求编号：该字段未返回" />
          {" "}
          <span className="text-muted-foreground">审计页没找到对应事件时，可用上面的单号/请求编号在台账里人工检索。</span>
        </p>
      </section>

      <DetailsDisclosure testId={`${testId}-details`} lines={details} />

      {actions}
    </div>
  );
}
