/**
 * 2026-11-24 审批与发布门「卡式密度」车道 —— 页头等宽指标带 + 队列「等待」读数。
 *
 * 三条纪律（与本模块既有口径同源，不新立规矩）：
 * 1. 只数「这一份读口结果里的行」，与下方列表同源；读口顶层没有 total 键
 *    （实测 keys=[items]/[items,nextCursor]）⇒ 任何档位都不按条数推算总量。
 * 2. 算不出＝「—」＋ title 写清算不出的原因，绝不用 0 冒充「读到了空集」，
 *    也不为凑一个数字多发一次请求（本页零额外请求是既有契约）。
 * 3. 「超 2 小时」的阈值只有这一处（WAIT_SLA_MS）：指标带、行内「等待」列、
 *    页头副行三处读的是同一个数，不允许各行自算。
 *
 * 比较时刻在挂载时取一次（与 SinceQuickFilter / RelativeTime 同一形制）：
 * 渲染期不读 Date.now()，所以同一帧内读数恒等，快照与复现都稳定。
 */
import { useEffect, useState, type ReactNode } from "react";

import type { ApprovalStats } from "./api";
import type { ApprovalRow } from "./model";
import { epochOf, plainMinute } from "./RelativeTime";
import type { Phase } from "./useApprovalsData";

/** SLA：超过 2 小时算「超时」（骨架副行「1 项超 2 小时」同一档）。 */
export const WAIT_SLA_MS = 2 * 60 * 60 * 1000;

/** 提交→此刻的等待时长读数；缺提交时间＝null，不编「刚刚」。 */
export function waitOf(
  submittedAtMs: number | null,
  now: number,
): { text: string; title: string; overdue: boolean } | null {
  if (submittedAtMs === null) return null;
  const diff = now - submittedAtMs;
  if (diff < 0) {
    return { text: "—", title: "提交时间在未来，等待时长计算不了。", overdue: false };
  }
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const text = minutes < 1 ? "<1m" : minutes < 60 ? `${minutes}m` : `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
  const human = minutes < 1 ? "不到 1 分钟" : hours < 1 ? `${minutes} 分钟` : `${hours} 小时 ${minutes % 60} 分`;
  return {
    text,
    title: `从提交到此刻已等待 ${human}（提交于 ${plainMinute(submittedAtMs)}）`,
    overdue: diff > WAIT_SLA_MS,
  };
}

/** 同一批行里「等待超过 SLA」的条数（只数真在待批的单）。 */
export function overdueCount(rows: readonly ApprovalRow[], now: number | null): number | null {
  if (now === null) return null;
  let n = 0;
  for (const row of rows) {
    if (!row.status.pending) continue;
    const w = waitOf(epochOf(row.submittedAt), now);
    if (w?.overdue) n += 1;
  }
  return n;
}

/** 同一批行里最早的提交时间（毫秒）；没有可用时间戳＝null。 */
export function earliestSubmitted(rows: readonly ApprovalRow[]): number | null {
  let best: number | null = null;
  for (const row of rows) {
    if (!row.status.pending) continue;
    const ms = epochOf(row.submittedAt);
    if (ms !== null && (best === null || ms < best)) best = ms;
  }
  return best;
}

/** 挂载时取一次的「此刻」，供等待类读数用（渲染期不读时钟）。 */
export function useNowOnce(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  return now;
}

/** 行内「等待」列：等宽数字 + 超档上色，绝对时间留在 title。 */
export function WaitCell({ iso, testid }: { iso: string | null; testid: string }): ReactNode {
  const ms = epochOf(iso);
  const now = useNowOnce();
  if (ms === null || now === null) {
    return (
      <span data-testid={testid} title="读口没有给出提交时间，等待时长计算不了。">
        —
      </span>
    );
  }
  const w = waitOf(ms, now);
  if (w === null) return <span data-testid={testid}>—</span>;
  return (
    <span
      data-testid={testid}
      className={w.overdue ? "apr5-band__v is-over" : undefined}
      title={w.title}
    >
      {w.text}
    </span>
  );
}

const SEVEN_DAYS_MS = 7 * 86_400_000;

/** 近 7 天内按处理结果计数；缺处理时间的行不计入（不推断）。 */
function decidedWithin(rows: readonly ApprovalRow[], statusRaw: string, now: number | null): number | null {
  if (now === null) return null;
  let n = 0;
  for (const row of rows) {
    if (row.status.raw?.trim().toLowerCase() !== statusRaw) continue;
    const ms = epochOf(row.decidedAt);
    if (ms === null) continue;
    if (now - ms <= SEVEN_DAYS_MS) n += 1;
  }
  return n;
}

function Cell({
  testid,
  label,
  value,
  title,
  tone,
}: {
  testid: string;
  label: string;
  value: string;
  title: string;
  tone?: "warn" | "bad";
}): ReactNode {
  return (
    <span className="apr5-band__cell" data-testid={testid} title={title}>
      <span className="apr5-band__k">{label}</span>
      <span className={`apr5-band__v${tone ? ` is-${tone}` : ""}`} data-testid={`${testid}-v`}>
        {value}
      </span>
    </span>
  );
}

/**
 * 页头等宽指标带：待批 / 超时 / 最早提交 / 近 7 天通过 / 驳回。
 *
 * 2026-11-24 卡式密度第二轮：每个数都从它的真读口来——待批取
 * `/api/approval-stats`（没有就用同一份待批队列数），超时与最早提交取队列
 * 行，通过/驳回取无状态列表里 7 天内处理完成的行。**读不到的那一项整项不
 * 进版面**：不摆「—」，不补 0，也不为凑数多发请求。
 */
export function ApprovalMetricBand({
  phase,
  pendingRows,
  allRows,
  stats,
}: {
  phase: Phase;
  pendingRows: readonly ApprovalRow[];
  allRows: readonly ApprovalRow[] | null;
  stats: ApprovalStats | null;
}): ReactNode {
  const now = useNowOnce();
  const queueReady = phase === "ready" && now !== null;
  const queueCount = phase === "ready" ? pendingRows.filter((row) => row.status.pending).length : null;
  const pending = stats?.pending ?? queueCount;
  const overdue = queueReady ? overdueCount(pendingRows, now) : null;
  const earliest = queueReady ? earliestSubmitted(pendingRows) : null;
  const approved = allRows !== null ? decidedWithin(allRows, "approved", now) : null;
  const rejected = allRows !== null ? decidedWithin(allRows, "rejected", now) : null;

  const cells: ReactNode[] = [];
  const push = (key: string, node: ReactNode): void => {
    if (cells.length > 0) {
      cells.push(<span key={`${key}-sep`} className="apr5-band__sep" aria-hidden="true">·</span>);
    }
    cells.push(<span key={key} className="apr5-band__cellwrap">{node}</span>);
  };

  if (pending !== null) {
    push(
      "pending",
      <Cell
        testid="apr5-band-pending"
        label="待批"
        value={String(pending)}
        title="来自审批统计读口的待处理数；与下方待办队列同租户。"
        tone={pending > 0 ? "warn" : undefined}
      />,
    );
  }
  if (overdue !== null) {
    push(
      "overdue",
      <Cell
        testid="apr5-band-overdue"
        label="超时"
        value={String(overdue)}
        title="超过 2 小时未处理算超时，阈值在本模块只有一处（PendingReadouts.WAIT_SLA_MS）。"
        tone={overdue > 0 ? "warn" : undefined}
      />,
    );
  }
  if (earliest !== null) {
    push(
      "earliest",
      <Cell
        testid="apr5-band-earliest"
        label="最早提交"
        value={plainMinute(earliest).slice(5, 16)}
        title={`最早一条待批的提交时间：${plainMinute(earliest)}`}
      />,
    );
  }
  if (approved !== null) {
    push(
      "approved",
      <Cell
        testid="apr5-band-approved"
        label="近 7 天通过"
        value={String(approved)}
        title="按无状态列表里 7 天内处理完成的通过单计；读口不给总数，这不等于 7 天全量。"
      />,
    );
  }
  if (rejected !== null) {
    push(
      "rejected",
      <Cell
        testid="apr5-band-rejected"
        label="驳回"
        value={String(rejected)}
        title="按无状态列表里 7 天内处理完成的驳回单计；读口不给总数，这不等于 7 天全量。"
      />,
    );
  }

  if (cells.length === 0) return null;
  return (
    <div className="apr5-band" role="group" aria-label="审批读数（与列表同一租户，按已加载行计）" data-testid="apr5-metric-band">
      {cells}
    </div>
  );
}

/** 骨架的「示例」徽标位在这里换成了诚实的读口来源标签（无数据即「—」）。 */
export const QUEUE_CARD_LABEL = "待办队列 · 按等待时长排序";
