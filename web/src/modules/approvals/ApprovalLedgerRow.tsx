/**
 * 2026-11-24 审批历史密度车道 —— 历史 pane 的账本行（表格式行壳）。
 *
 * 它不是新的数据面：字段、读口、缺值口径与 ApprovalRowCard 完全同源；
 * 变的是形制——历史页在骨架里是一张单表（时间/事项/发起/审批人/结果/
 * 耗时/编号/备注），不是卡片流。行壳保留旧行卡的全部 testid 与键盘
 * 契约（Enter 展开预览、空格开详情、方向键移焦、Esc 收起），
 * 复制/预览/详情仍在行内，未新增任何请求。
 *
 * DOM 纪律（多个既有护栏依赖的读法）：标题钮的 parentElement 的
 * lastElementChild 必须是状态徽标——所以徽标最后挂载、用 grid-column
 * 归到「结果」列；预览与隐藏字段 dl 都在它之前。
 *
 * 2026-11-24 卡式密度车道：同一行壳新增 `variant="queue"`（待办队列六列
 * 事项|类型|发起|等待|风险|操作）。它只换轨道映射与两列新读数（类型／等待／
 * 风险），字段、缺值口径、testid 与键盘契约一律不动——两页同值（R218）因此
 * 天然成立：同一份 DOM，差别只在哪些列上屏。
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import { PermalinkCopy } from "./PermalinkCopy";
import { RowCopy } from "./RowCopy";
import { RelativeTime, epochOf, plainMinute, timeTitle } from "./RelativeTime";
import { DetailsDisclosure, RequestIdCopyField } from "./states";
import { Pill } from "@/components/console/Pill";
import { APPROVAL_RID_MISSING, FIELD_MISSING_SENTENCE } from "./stateCopy";
import { humanizeHandles, money, type ApprovalRow } from "./model";
import { truncateDisplay } from "./views";
import { WaitCell } from "./PendingReadouts";

const MISSING_AMOUNT = "服务未提供该数值";

/** 动作原值常常是 `message.send` 这类族名；屏上换成类型人话，原值只进 title。 */
const CODE_TOKEN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/i;

function titleOf(row: ApprovalRow): string {
  if (CODE_TOKEN.test(row.title.trim()) && row.changeKind.raw) return row.changeKind.label;
  return row.title;
}

/** 事由/备注里的人话处理：去 policy.* 前缀，族名（message.send /
 * knowledge_scope_boundary）换成「该动作」——工程词不上屏，原文仍在 title。 */
function plainReason(text: string | null): string | null {
  if (!text) return null;
  const stripped = text
    .replace(/^policy\.[a-z0-9_.]+:\s*/i, "")
    .replace(/\b[a-z][a-z0-9]*(?:[._][a-z0-9_]+)+\b/gi, "该动作")
    .trim();
  return stripped || null;
}

/** 待处理行没有“处理耗时”；已决行按提交→处理时间算，缺一端就 `—`。 */
function durationOf(row: ApprovalRow): { text: string; title: string } {
  if (row.status.pending) return { text: "—", title: "这张单还没处理，暂无处理耗时。" };
  const from = epochOf(row.submittedAt);
  const to = epochOf(row.clockAt);
  if (from === null || to === null) {
    return { text: "—", title: "读口没有同时给出提交时间与处理时间，计算不了耗时。" };
  }
  const seconds = Math.max(0, Math.round((to - from) / 1000));
  if (seconds < 60) return { text: `${seconds}s`, title: `提交到处理用时 ${seconds} 秒` };
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return { text: `${minutes}m`, title: `提交到处理用时 ${minutes} 分钟` };
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) {
    return { text: rest ? `${hours}h ${String(rest).padStart(2, "0")}m` : `${hours}h`, title: `提交到处理用时 ${hours} 小时${rest ? ` ${rest} 分` : ""}` };
  }
  const days = Math.floor(hours / 24);
  return { text: `${days}d ${hours % 24}h`, title: `提交到处理用时 ${days} 天 ${hours % 24} 小时` };
}

/**
 * 表格式行的时间列：7 天内用相对读数（与排队页同一句），更早的写月-日，
 * 避免窄屏把 16 位绝对时间挤进事项列。绝对到分仍恒在 title 里。
 */
function LedgerTime({ iso, testid }: { iso: string | null; testid: string }): ReactNode {
  const ms = epochOf(iso);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  if (ms === null) return <RelativeTime iso={iso} testid={testid} />;
  if (now !== null && now - ms > 7 * 86_400_000) {
    const short = plainMinute(ms).slice(5, 10).replace("-", "-");
    return (
      <span data-testid={testid} title={timeTitle(ms, iso ?? "")}>
        {short}
      </span>
    );
  }
  return <RelativeTime iso={iso} testid={testid} />;
}

const TONE: Record<string, "ok" | "warn" | "bad" | "info" | "mut"> = {
  success: "ok",
  warning: "warn",
  destructive: "bad",
  secondary: "mut",
  default: "mut",
  outline: "mut",
};

/** 行壳形态：ledger＝历史账本八列，queue＝待办队列六列（骨架列名逐字一致）。 */
export type LedgerRowVariant = "ledger" | "queue";

/** 批量 P0 的行级勾选（仅待办面传入，与旧行卡同形）。 */
export interface LedgerRowSelection {
  checked: boolean;
  disabled: boolean;
  disabledReason: string | null;
  testId: string;
  onToggle: (checked: boolean) => void;
}

export function ApprovalLedgerRow({
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
  variant = "ledger",
  selection,
}: {
  row: ApprovalRow;
  selected: boolean;
  onOpen: () => void;
  index: number;
  previewOpen: boolean;
  onTogglePreview: () => void;
  active: boolean;
  onActivate: () => void;
  onNavKey: (action: "ArrowUp" | "ArrowDown" | "Home" | "End", fromKey: string) => void;
  onClosePreview: () => void;
  variant?: LedgerRowVariant;
  selection?: LedgerRowSelection;
}): ReactNode {
  const queue = variant === "queue";
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const closeRefocus = (): void => {
    if (previewOpen) onTogglePreview();
    toggleRef.current?.focus();
  };
  const shownTitle = truncateDisplay(titleOf(row));
  const reasonClean = plainReason(humanizeHandles(row.reason));
  const reasonText = reasonClean ? truncateDisplay(reasonClean).shown : null;
  const noteClean = plainReason(humanizeHandles(row.lastNote ?? null));
  const duration = durationOf(row);
  const approverText = row.approvers.labels.length > 1
    ? `${row.approvers.labels[0]} +${row.approvers.labels.length - 1}`
    : row.approvers.labels[0] ?? "—";
  const refCode = row.requestId ? row.requestId.slice(-8) : "—";

  return (
    <div
      className={`apr5-lrow${queue ? " apr5-qrow" : ""}${selected ? " is-selected" : ""}`}
      data-testid={`apr5-row-${row.key}`}
      role="button"
      tabIndex={active ? 0 : -1}
      aria-expanded={previewOpen}
      onFocus={onActivate}
      onClick={onOpen}
      onKeyDown={(event) => {
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
        if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
          event.preventDefault();
          onNavKey(event.key, row.key);
        }
      }}
    >
      <span className="apr5-lrow__time">
        <span className="sr-only">{row.clockLabel}</span>
        <LedgerTime iso={row.clockAt} testid={`apv-time-row-${row.key}`} />
      </span>

      {selection ? (
        <input
          type="checkbox"
          className="apr5-lrow__check"
          data-testid={selection.testId}
          checked={selection.checked}
          disabled={selection.disabled}
          title={selection.disabled ? (selection.disabledReason ?? undefined) : undefined}
          aria-label={`批量选择：${row.title}`}
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
          className="apr5-lrow__toggle"
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
          <ChevronRight className={previewOpen ? "h-3 w-3 rotate-90" : "h-3 w-3"} aria-hidden="true" />
          <span className="sr-only">行内预览</span>
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          title={row.rawId ?? undefined}
          className="apr5-lrow__titlebtn"
        >
          <span
            className="apr5-lrow__title"
            data-testid={`apv-trunc-row-title-${row.key}`}
            title={shownTitle.full ?? undefined}
          >
            {shownTitle.shown}
          </span>
          {reasonText ? (
            <span
              className="apr5-lrow__sub"
              data-testid={`apv-trunc-row-reason-${row.key}`}
              title={truncateDisplay(reasonClean ?? "").full ?? undefined}
            >
              事由：{reasonText}
            </span>
          ) : null}
        </button>

      {queue ? (
        <span
          className="apr5-lrow__kind"
          data-testid={`apr5-row-kind-${row.key}`}
          title={row.changeKind.raw ?? "读口没有回传变更类型（changeKind/binding.changeKind）；屏上不推断。"}
        >
          {row.changeKind.label}
        </span>
      ) : null}
      <span className="apr5-lrow__who apr5-lrow__who--requester" title={row.requester.raw ?? undefined}>{row.requester.label}</span>
      {queue ? (
        <span className="apr5-lrow__wait">
          <WaitCell iso={row.submittedAt} testid={`apr5-row-wait-${row.key}`} />
        </span>
      ) : null}
      {queue ? (
        <span className="apr5-lrow__risk">
          <Pill tone={TONE[row.risk.tone] ?? "mut"} title={row.risk.raw ?? FIELD_MISSING_SENTENCE}>
            {row.risk.label}
          </Pill>
        </span>
      ) : null}
      <span className="apr5-lrow__who apr5-lrow__who--approver" title={row.approvers.raw ?? undefined}>{approverText}</span>
      <span className="apr5-lrow__dur" title={duration.title}>{duration.text}</span>
      <span className="apr5-lrow__ref" title={row.requestId ?? "读口未提供请求编号"}>
        {refCode}
      </span>
      <span className="apr5-lrow__note" title={row.lastNote ?? "读口未提供这条审批的备注"}>
        {noteClean ?? "—"}
      </span>
      <span
        className="apr5-lrow__tools"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <RowCopy row={row} index={index} />
        <DetailsDisclosure
          testId={`apr5-row-details-${row.key}`}
          lines={[row.rawId ? `单据标识：${row.rawId}` : "", `状态原值：${row.status.raw ?? "未提供"}`]}
        />
      </span>

      {previewOpen ? (
        <div
          data-testid={`apv9-preview-${row.key}`}
          role="region"
          aria-label="行内预览"
          className="apr5-lrow__preview"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              closeRefocus();
            }
          }}
        >
          <p
            className="apr5-lrow__preview-title"
            data-testid={`apv-trunc-preview-title-${row.key}`}
            title={shownTitle.full ?? undefined}
          >
            {shownTitle.shown}
          </p>
          <dl className="apr5-lrow__preview-grid">
            <dt>状态</dt>
            <dd title={row.status.raw ?? "原始状态值未返回"}>{row.status.label}</dd>
            <dt>风险档</dt>
            <dd className="apr5-lrow__muted" title={row.risk.raw ?? FIELD_MISSING_SENTENCE}>{row.risk.label}</dd>
            <dt>更新时间</dt>
            <dd>
              <RelativeTime iso={row.decidedAt} testid={`apv-time-preview-${row.key}`} />
            </dd>
            <dt>审批人</dt>
            <dd>
              {row.approvers.labels.length > 0 ? (
                (() => {
                  const joined = row.approvers.labels.join("、");
                  const t = truncateDisplay(joined);
                  return (
                    <span data-testid={`apv-trunc-preview-approvers-${row.key}`} title={t.full ?? undefined}>
                      {t.shown}
                    </span>
                  );
                })()
              ) : (
                "—"
              )}
            </dd>
          </dl>
          <p className="apr5-lrow__preview-rid">
            <RequestIdCopyField requestId={row.requestId} fallback={APPROVAL_RID_MISSING} />
          </p>
          <PermalinkCopy target={row.rawId ?? null} />
        </div>
      ) : null}

      {/* 既有护栏按 dt 标签取行内字段值（涉及金额/提交/处理时间等），
          这些值在表格式行壳里没有独立列，语义保留、视觉让位给密度。 */}
      <dl className="apr5-sr">
        <dt>申请人</dt>
        <dd title={row.requester.raw ?? (row.requester.label === "—" ? "服务未提供申请人信息。" : undefined)}>
          {row.requester.label}
        </dd>
        <dt>执行员工</dt>
        <dd title={row.worker.raw ?? (row.worker.label === "—" ? "服务未提供执行员工。" : undefined)}>
          {row.worker.label}
        </dd>
        <dt>提交</dt>
        <dd>
          <RelativeTime iso={row.submittedAt} testid={`apv-time-row-submitted-${row.key}`} />
        </dd>
        <dt>涉及金额</dt>
        <dd title={row.amount === null ? MISSING_AMOUNT : undefined}>{money(row.amount)}</dd>
      </dl>

      <Pill tone={TONE[row.status.tone] ?? "mut"} title={row.status.raw ?? undefined}>
        {row.status.label}
      </Pill>
    </div>
  );
}