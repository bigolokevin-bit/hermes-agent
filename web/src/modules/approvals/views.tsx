/**
 * approvals view pieces — the queue row and the ticket body.
 *
 * Both render the same funnel: every value is a sentence, a Beijing wall clock,
 * or US dollars, and anything the service did not send shows 「—」 with the
 * reason in its `title`. Raw identifiers, state tokens and digests never reach
 * the text of the page — they live in `title` attributes and the 「详情」
 * disclosure, which is collapsed by default.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Link, useLocation } from "react-router";

import { PermalinkCopy } from "./PermalinkCopy";
import { RowCopy } from "./RowCopy";
import { saveCorrelationReturn } from "./correlationReturn";
import { fetchVersionChain } from "./api";

import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";

import { themedBody } from "@/lib/utils";
import {
  consumptionStateFrom,
  diffBranchFor,
  humanizeHandles,
  money,
  versionChainNote,
  type ApprovalDetail,
  type ApprovalRow,
  type VersionChainNote,
} from "./model";
import { DetailsDisclosure, RequestIdCopyField } from "./states";
import { APPROVAL_RID_MISSING, FIELD_MISSING_SENTENCE } from "./stateCopy";
import { RelativeTime } from "./RelativeTime";
import { shortRef } from "@/modules/tasks/tasksBoard";

/** A label/value pair that never overflows its column at 375px. */
function Field({
  label,
  value,
  reason,
  tone,
  num,
  muted,
  testId,
}: {
  label: string;
  value: ReactNode;
  /** Why the value is missing; shown as the `title` so the gap is explainable. */
  reason?: string;
  tone?: ReactNode;
  /** 数字与时间字段：等宽数字，纵向可比（UI-RUBRIC §一·数字与时间） */
  num?: boolean;
  /** 辅助值（时间/风险档）：降为次级色，与事由同级；
   * 待处理页行内层级的落点见 approvals-density.css（历史页不受影响）。 */
  muted?: boolean;
  testId?: string;
}): ReactNode {
  return (
    <div className="ui-c-field" data-testid={testId}>
      <dt className="ui-c-field-label">{label}</dt>
      <dd
        className={`ui-c-field-value${num ? " ui-c-num" : ""}${muted ? " density-value-muted" : ""}`}
        title={reason}
      >
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
  index,
  previewOpen,
  onTogglePreview,
  active,
  onActivate,
  onNavKey,
  onClosePreview,
  selection,
}: {
  row: ApprovalRow;
  selected: boolean;
  onOpen: () => void;
  /** R60: 行内就地展开预览 — 纯本地数据，不打开详情抽屉、不发任何请求。 */
  /** R52-obs: the toggle anchor is positional; the full id rides data-record. */
  index: number;
  previewOpen: boolean;
  onTogglePreview: () => void;
  /** R73: roving tabindex — 仅当前行入 tab 序；方向键导航由页层处理。 */
  active: boolean;
  onActivate: () => void;
  onNavKey: (action: "ArrowUp" | "ArrowDown" | "Home" | "End", fromKey: string) => void;
  /** R73: Esc 收起预览并把焦点还给该行。 */
  onClosePreview: () => void;
  /**
   * 批量 P0（仅待办面传入）：行级勾选框。undefined = 不渲染（历史页与未开
   * 批量区的形态逐字节不变）；禁用原因句由 batch.ts 单点给出，组件不文案。
   */
  selection?: {
    checked: boolean;
    disabled: boolean;
    disabledReason: string | null;
    testId: string;
    onToggle: (checked: boolean) => void;
  };
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
          {selection ? (
            <input
              type="checkbox"
              data-testid={selection.testId}
              checked={selection.checked}
              disabled={selection.disabled}
              title={selection.disabled ? (selection.disabledReason ?? undefined) : undefined}
              aria-label={`批量选择：${row.title}`}
              className="h-4 w-4 shrink-0 accent-primary"
              onClick={(event) => {
                // 行主体是 role=button 的打开把手；勾选只改选择集，不开详情。
                event.stopPropagation();
              }}
              onChange={(event) => {
                event.stopPropagation();
                selection.onToggle(event.target.checked);
              }}
            />
          ) : null}
          <button
            ref={toggleRef}
            type="button"
            data-testid={`apv9-toggle-${index}`}
            data-record={row.key}
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
              className={`${themedBody} density-row-title`}
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
          {/* R76: 相对时间+title 绝对/ISO——与预览、决策链路同一 helper 同一输入。
           * P1 层级：两个时间只作辅助信息（次级色+等宽数字），主次留给标题与金额。 */}
          <Field
            label="提交"
            num
            muted
            value={<RelativeTime iso={row.submittedAt} testid={`apv-time-row-submitted-${row.key}`} />}
          />
          <Field
            label={row.clockLabel}
            num
            muted
            value={<RelativeTime iso={row.clockAt} testid={`apv-time-row-${row.key}`} />}
          />
          <Field
            label="涉及金额"
            num
            value={money(row.amount)}
            reason={row.amount === null ? MISSING_AMOUNT : undefined}
          />
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

        {/* R127: 行末复制——六段纯文本单 helper 拼装，零额外请求。 */}
        <RowCopy row={row} index={index} />

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
                muted
                value={row.risk.label}
                reason={row.risk.raw ?? FIELD_MISSING_SENTENCE}
              />
              <Field
                label="更新时间"
                num
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
                      : FIELD_MISSING_SENTENCE
                }
              />
            </dl>
            <p className="mt-2 min-w-0 break-words text-xs">
              <RequestIdCopyField
                requestId={row.requestId}
                fallback={APPROVAL_RID_MISSING}
              />
            </p>
            {/* R88: 预览内也给出固定链接（同一条审批的直达地址）。 */}
            <PermalinkCopy target={row.rawId ?? null} />
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
  // R94: 点关联链离开前记下当前视图（完整 search+滚动位），返回时同页还原。
  const location = useLocation();
  const leaveWithSnapshot = () => saveCorrelationReturn(location.search, window.scrollY ?? 0);
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
    <section className="ui-c-section" data-testid="apd6-trail" aria-label="决策链路（只读）">
      {/* UI-C: 区块头在上，复制入口收到右上；链路节点顺序仍由服务返回决定。 */}
      <div className="ui-c-section-head">
        <h3 className="ui-c-section-title">决策链路 · 只读（节点顺序即服务返回顺序）</h3>
        <span className="ui-c-section-actions">
          <Button
            size="sm"
            outlined
            className="shrink-0 whitespace-nowrap"
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
          {/* R88: 动作反馈走 role=status（隐式 polite），显式 aria-live 播报位保持单点（R86 契约）。 */}
          <span data-testid="apd8-copy-status" role="status">
            {copyState === "done"
              ? "已复制"
              : copyState === "failed"
                ? "剪贴板写入被拒绝，可用下方文本框手动复制。"
                : ""}
          </span>
        </span>
      </div>
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
              onClick={leaveWithSnapshot}
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
              onClick={leaveWithSnapshot}
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

/* ------------------------------------------------------------------ *
 * AP-02 差异分区——Q13「变更差异 · 字段级（只读）」段的 changeKind 分支版。
 *
 * 分支口径（backlog §AP-02 步骤①，四类各有确定形态）：
 *  ① employee_version_create + 响应带差异键 → 字段级前/后行（与 Q13 同形同键）
 *     ＋ 相邻版本核对腿（GET /api/employee-versions?id=，BFF 既有端点，
 *     不新增端点）：把 fromVersionId 对进版本链，能说 v几→v几 才说；
 *     读不到就写「未读回」，不猜。
 *  ② employee_version_create + 响应无差异键 → 「未接」+原因句（沿用 Q13 载体，
 *     屏上不猜差异内容）。
 *  ③ 其它已知类型（message_send / grant_escalation / …）→
 *     「差异明细未提供（该变更类型无差异数据源）」，同样不画任何行。
 *  ④ 没写明变更类型 → 「差异明细未提供（该单据没写明变更类型）」——
 *     不能把「类型未知」猜成「有数据源」，也不能猜成「无数据源」。
 *
 * 风险差异四项无字段 ⇒ 整块不在此出现（不画 0）。argsDigest 走「不可逆摘要，
 * 非差异」标注。禁 fixture、禁假成功。
 * ------------------------------------------------------------------ */

/**
 * 相邻版本核对腿。只在差异有数据源（employee_version_create 出了字段行）时
 * 才读 GET /api/employee-versions?id=（BFF 既有读口，limit 透传）；
 * 读回形制不合法＝unreadable，网络/无权＝failed——两样都只说「不判定」，
 * 不补 v 号、不画 0。
 *
 * 形制：effect 只在异步回调里落结果（不同步 setState，避免级联渲染），
 * 结果按「单据号|员工号」键控——换单后旧读数自动失效，不串台。
 */
type ChainResult = { key: string; note: VersionChainNote } | { key: string; failed: true };

function VersionChainLine({ detail }: { detail: ApprovalDetail }): ReactNode {
  const anchor = detail.versionAnchor;
  const employeeId = anchor?.employeeId ?? null;
  const key = `${detail.rawId ?? ""}|${employeeId ?? ""}`;
  const [result, setResult] = useState<ChainResult | null>(null);

  useEffect(() => {
    if (!employeeId || !anchor) return;
    let alive = true;
    void fetchVersionChain(employeeId)
      .then((refs) => {
        if (alive) {
          setResult({
            key,
            note: versionChainNote(refs, anchor) ?? { readable: false, fromLabel: null, target: "unknown", chainSize: null },
          });
        }
      })
      .catch(() => {
        if (alive) setResult({ key, failed: true });
      });
    return () => {
      alive = false;
    };
  }, [anchor, employeeId, key]);

  // 没有员工号就没有可读的版本链——这是「没有输入」，不是「读到了空」（派生态，不进 state）。
  if (!employeeId) {
    return (
      <p
        className="min-w-0 break-words text-xs text-muted-foreground"
        data-testid="apd10-chain-no-anchor"
        title="相邻版本核对需要单据带回的员工号（binding.subjectId / resource.employee_id 一族）；这条单没有带回，读口没有输入，故链上位置不判定。"
      >
        版本链未判定——这条单没有带回可读的员工号。
      </p>
    );
  }
  const fresh = result && result.key === key ? result : null;
  if (!fresh) return null; // 读取中：不摆骨架、不占位、不猜
  if ("failed" in fresh) {
    return (
      <p
        className="min-w-0 break-words text-xs text-muted-foreground"
        data-testid="apd10-chain-failed"
        title="相邻版本核对走 BFF 既有读口 GET /api/employee-versions?id=；这一次没有读回（网络失败或无权）。字段级差异仍只以这条单据自己的响应为准。"
      >
        版本链未读回——相邻版本读口这一次没答成，链上位置不判定。
      </p>
    );
  }
  const { note } = fresh;
  if (!note.readable) {
    return (
      <p
        className="min-w-0 break-words text-xs text-muted-foreground"
        data-testid="apd10-chain-unreadable"
        title="相邻版本读口（GET /api/employee-versions?id=）这一条答回来的不是版本列表——无权、降级或形制不符都算这一档。链上位置不判定，字段级差异仍只以这条单据自己的响应为准。"
      >
        版本链未读回——相邻版本读口这一条没答成版本列表，链上位置不判定。
      </p>
    );
  }
  const from = note.fromLabel ? `前版 ${note.fromLabel}` : "前版未对上进链";
  const target =
    note.target === "present"
      ? `后版 v${anchor?.toVersionNo ?? "?"} 已在链上`
      : note.target === "absent"
        ? `后版 v${anchor?.toVersionNo ?? "?"} 尚未出现在链上`
        : "后版号未带回";
  return (
    <p
      className="min-w-0 break-words text-xs text-muted-foreground"
      data-testid="apd10-chain-note"
      title={`相邻版本核对只读 GET /api/employee-versions?id=（BFF 既有端点，不新增）。前值原码=${anchor?.fromVersionId ?? "未带回"}；后版号=${anchor?.toVersionNo ?? "未带回"}；链上读回 ${note.chainSize ?? "—"} 版（真读数）。读不出的段落写「未对上/未带回」，不补造。`}
    >
      版本链核对：{from} → {target}；链上读回 {note.chainSize ?? "—"} 版。
    </p>
  );
}

export function ChangeDiffSection({ detail }: { detail: ApprovalDetail }): ReactNode {
  const branch = diffBranchFor(detail);
  return (
    <section className="ui-c-section" data-testid="apd10-diff" aria-label="变更差异（字段级·只读）">
      <h3 className="ui-c-section-title">变更差异 · 字段级（只读）</h3>
      {branch.kind === "version" && branch.state === "rows" ? (
        <ul className="flex min-w-0 flex-col gap-1 text-xs">
          {detail.diff?.fields.map((field, index) => (
            <li
              key={`${field.label}-${index}`}
              className="grid min-w-0 grid-cols-1 gap-x-2 gap-y-0.5 sm:grid-cols-[minmax(6rem,9rem)_minmax(0,1fr)_minmax(0,1fr)]"
              data-testid={`apd10-diff-row-${index}`}
            >
              <span className="min-w-0 break-words text-muted-foreground">{field.label}</span>
              <span className="min-w-0 break-words" data-testid={`apd10-diff-before-${index}`} title={field.raw ?? undefined}>
                前：{field.before}
              </span>
              <span className="min-w-0 break-words" data-testid={`apd10-diff-after-${index}`}>
                后：{field.after}
              </span>
            </li>
          ))}
        </ul>
      ) : branch.kind === "version" && branch.state === "carrier-empty" ? (
        <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="apd10-diff-empty">
          服务带回了差异结构，其中没有字段级变更。
        </p>
      ) : (
        <p
          className="min-w-0 break-words text-xs text-muted-foreground"
          data-testid="apd10-diff-unwired"
          title={
            branch.kind === "version"
              ? "差异只从这条单据的服务端响应读取；该响应没有带回字段级前后值（版本 from→to、added/removed 之类形制均未出现），前端不自行补齐。"
              : branch.kind === "no-source"
                ? `差异只从这条单据的服务端响应读取；「${branch.label}」这类变更（原值 ${branch.raw}）在服务端没有差异数据源，这条响应没有带回字段级前后值，前端不自行补齐。`
                : "差异只从这条单据的服务端响应读取；这条单据没有写明变更类型，无法判定它有没有差异数据源，这条响应没有带回字段级前后值，前端不自行补齐。"
          }
        >
          {branch.kind === "version"
            ? "未接——差异明细未提供（这条单据的响应没有带回字段级前后值，也无法定位相邻版本），屏上不猜差异内容。"
            : branch.kind === "no-source"
              ? "未接——差异明细未提供（该变更类型无差异数据源），屏上不猜差异内容。"
              : "未接——差异明细未提供（该单据没写明变更类型），屏上不猜差异内容。"}
        </p>
      )}
      {branch.kind === "version" && branch.state === "rows" ? <VersionChainLine detail={detail} /> : null}
      {/* AP-02 ④: 摘要值就在「详情」里，但它在差异段先说清楚自己不是什么。 */}
      {detail.digest ? (
        <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="apd10-digest-note">
          参数摘要为不可逆摘要，非差异——原文见「详情」段。
        </p>
      ) : null}
    </section>
  );
}

/**
 * AP-02 ②: consumedAt 两态（E52/E53）。approved 且 consumedAt 空 ⇒「已批准，
 * 等待运行时使用」；非空 ⇒「已被运行时使用」，run 回链仅当响应真带回 run 标识
 * （顶层 runId 或 binding.runId），没有就只给文案。其它状态不宣称消费。
 */
export function ConsumptionStateLine({ detail }: { detail: ApprovalDetail }): ReactNode {
  const view = consumptionStateFrom(detail.status.raw, detail.consumedAt);
  if (!view) return null;
  if (view.state === "waiting") {
    return (
      <p
        className="min-w-0 break-words text-xs text-muted-foreground"
        data-testid="apd10-consumed-waiting"
        title="这条单已批准，但服务端响应没有带回 consumedAt——运行时还没有使用它。使用时间由服务端写入，前端不猜。"
      >
        已批准，等待运行时使用。
      </p>
    );
  }
  return (
    <p
      className="ui-c-inline min-w-0 break-words text-xs"
      data-testid="apd10-consumed-used"
      title={view.atRaw ?? undefined}
    >
      <span data-testid="apd10-consumed-used-sentence">
        {view.timeMissing
          ? "已被运行时使用（使用时间未随本单回传）。"
          : `已被运行时使用：${view.at ?? "—"}。`}
      </span>
      {detail.consumptionRunId ? (
        <>
          {" "}
          <Link
            className="underline underline-offset-2"
            to={`/runs?run=${encodeURIComponent(detail.consumptionRunId)}`}
            title={detail.consumptionRunId}
            data-testid="apd10-consumed-run-link"
          >
            查看该次运行
          </Link>
        </>
      ) : (
        <span className="text-muted-foreground" data-testid="apd10-consumed-run-none">
          （该单没带回运行编号，故不给回链。）
        </span>
      )}
    </p>
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
    <div className="ui-c-container flex min-w-0 flex-col gap-3" data-testid={testId}>
      <div className="ui-c-head ui-c-head--plain">
        <h2
          className={`ui-c-head-title ui-c-head-title--lead ui-c-head-text ${themedBody}`}
          title={truncateDisplay(detail.title).full ?? detail.rawId ?? undefined}
          data-testid="apv-trunc-detail-title"
        >
          {truncateDisplay(detail.title).shown}
        </h2>
        {/* UI-C: 徽标仍是标题的兄弟（parity 测试按位置读它们），
         * flex-1 标题把它们推到区块头右上。 */}
        <Badge tone={detail.status.tone} title={detail.status.raw ?? undefined}>
          {detail.status.label}
        </Badge>
        <Badge tone={detail.risk.tone} title={detail.risk.raw ?? undefined}>
          {detail.risk.label}
        </Badge>
      </div>

      <dl className="ui-c-fields ui-c-fields--compact">
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
        <Field label="提交" num value={detail.submitted ?? "—"} reason={detail.submitted ? undefined : MISSING_TIME} />
        <Field
          label="处理期限"
          num
          value={detail.deadline ?? "—"}
          reason={detail.deadline ? undefined : MISSING_TIME}
          tone={detail.remaining ? <span className="ml-1 text-muted-foreground">（{detail.remaining.text}）</span> : undefined}
        />
        <Field
          label="涉及金额"
          num
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
          num
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
          value={<span className="ui-c-id">{detail.dataScope ?? "—"}</span>}
          reason={detail.dataScope ? "创建时的数据范围快照，只读。" : "服务未提供数据范围快照。"}
          testId="apd5-field-scope"
        />
        <div className="ui-c-field" data-testid="apd5-field-action-hash">
          <dt className="ui-c-field-label">操作指纹</dt>
          <dd className="ui-c-field-value">
            {detail.actionHash ? (
              <span className="ui-c-id" title={detail.actionHash}>
                {detail.actionHash.slice(0, 8)}…
                <button
                  type="button"
                  aria-label="复制操作指纹"
                  data-testid="apd5-copy-action-hash"
                  className="ui-c-field-actions ml-1 underline underline-offset-2"
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
        <div className="ui-c-field" data-testid="apd5-field-request-id">
          <dt className="ui-c-field-label">请求编号</dt>
          {/* P1-375-5 × UI-C2: 栅格类负责排版，flex-wrap 让长编号就地折行、
              复制钮豁免收缩不被挤出可视区；值与 testid 不动。 */}
          <dd className="ui-c-field-value flex min-w-0 flex-wrap items-center gap-1">
            {detail.requestId ? (
              <>
                <code className="ui-c-id min-w-0 break-all" data-testid="apd5-request-id" title={detail.requestId}>
                  {detail.requestId}
                </code>
                <button
                  type="button"
                  aria-label="复制请求编号"
                  data-testid="apd5-copy-detail-request-id"
                  className="ui-c-field-actions ml-1 shrink-0 whitespace-nowrap underline underline-offset-2"
                  onClick={() => {
                    void navigator.clipboard?.writeText(detail.requestId ?? "");
                  }}
                >
                  复制
                </button>
              </>
            ) : (
              <span data-testid="apd5-request-id-missing" title="这条记录没有带回请求编号">{FIELD_MISSING_SENTENCE}</span>
            )}
          </dd>
        </div>
      </dl>

      {detail.reason ? (
        <p
          className="ui-c-inline"
          data-testid="apv-trunc-detail-reason"
          title={truncateDisplay(humanizeHandles(detail.reason)).full ?? undefined}
        >
          <span>事由：</span>
          <span className="ui-c-inline-value">{truncateDisplay(humanizeHandles(detail.reason)).shown}</span>
        </p>
      ) : null}

      {/* R28 item 2: the approver slot is always present; empty means a
        * dash with a reason, never a missing field. */}
      <p
        className="ui-c-inline"
        data-testid="apd5-field-approver"
      >
        <span>审批人：</span>
        {detail.approvers.labels.length ? (
          <span className="ui-c-inline-value" data-testid="apd5-approver" title={detail.approvers.raw ?? undefined}>
            {detail.approvers.labels.join("、")}
          </span>
        ) : (
          <span className="ui-c-inline-value" title="单据没有带回审批人">—</span>
        )}
      </p>

      {detail.supersededBy ? (
        <p className="min-w-0 break-words text-xs text-warning">这张单已被另一张替代，请到「待处理」里查看新单。</p>
      ) : null}

      {/* Q13→AP-02: 字段级前后差异 + changeKind 分支。数据源仍是本详情响应
        * （GET /api/approval?id=）；只有 employee_version_create 带差异载体，
        * 其余类型显式「差异明细未提供」。风险差异四项（可触达/新增写入/
        * 未脱敏/同类申请）在响应里没有任何字段形制（evidence/raw-detail-*.json
        * 逐单清点）⇒ 整块不渲染，不画 0、不摆骨架（AP-02 ③）。 */}
      <ChangeDiffSection detail={detail} />

      {/* AP-02 ②: consumedAt 两态——只在该单真的走到「批准/执行」时出现。 */}
      <ConsumptionStateLine detail={detail} />

      {/* apd7: the decision replay is a titled read-only block — every entry
        * names who decided (masked handle or 未指派), the verdict, the Beijing
        * minute, and the note; an empty list says so plainly. */}
      <section className="ui-c-section" data-testid="apd5-replay" aria-label="决策回放（只读）">
        <h3 className="ui-c-section-title">决策回放 · 只读</h3>
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
      <section className="ui-c-section text-xs" data-testid="apd9-correlation" aria-label="相关记录">
        <h3 className="ui-c-section-title">相关记录 · 只读</h3>
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
            <NoSeg reason={`${FIELD_MISSING_SENTENCE}（审批单号没有回传，无法拼出过滤链接，禁编造 id）。`} />
          </p>
        )}
        <p className="min-w-0 break-words">
          <RequestIdCopyField requestId={detail.requestId} fallback={APPROVAL_RID_MISSING} />
          {" "}
          <span className="text-muted-foreground">审计页没找到对应事件时，可用上面的单号/请求编号在台账里人工检索。</span>
        </p>
      </section>

      <DetailsDisclosure testId={`${testId}-details`} lines={details} />

      {actions}
    </div>
  );
}
