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

import type { ApprovalRow } from "./model";
import { epochOf, plainMinute } from "./RelativeTime";
import { gateReason } from "./gates";
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
 * scope=pending 的本页只读 status=pending 队列 ⇒「近 7 天通过 / 驳回」与这份
 * 结果不同源，按约定显「—」并在卡底「缺读口」段点名；scope=history 时按当前
 * 服务端 status 维度判定同源与否（单一状态只对自己那一档给数）。
 */
export function ApprovalMetricBand({
  scope,
  phase,
  rows,
  status = null,
}: {
  scope: "pending" | "history";
  phase: Phase;
  rows: readonly ApprovalRow[];
  /** history 当前生效的服务端 status（null＝「全部」扇出腿）。 */
  status?: string | null;
}): ReactNode {
  const now = useNowOnce();
  const ready = phase === "ready";
  const down = gateReason(phase);
  const off = (action: string): string =>
    ready ? action : `算不出：${down === "" ? "列表还没就绪" : down}；计数位不以 0 冒充读数。`;
  const pendingScope = scope === "pending";
  const covers = (value: "pending" | "approved" | "rejected"): boolean => {
    if (pendingScope) return value === "pending";
    return status === null || status.trim().toLowerCase() === "all" || status.trim().toLowerCase() === value;
  };
  const countBy = (value: "pending" | "approved" | "rejected"): number | null => {
    if (!covers(value)) return null;
    // 待批按 statusView 的 pending 判据数（读口给 awaiting/in_review 等别名时
    // 也是待批）；通过/驳回沿用汇总条既有口径——比对服务端 status 原值。
    return value === "pending"
      ? rows.filter((row) => row.status.pending).length
      : rows.filter((row) => row.status.raw?.trim().toLowerCase() === value).length;
  };

  const waiting = countBy("pending");
  const overdue = covers("pending") ? overdueCount(rows, now) : null;
  const earliest = covers("pending") ? earliestSubmitted(rows) : null;
  const approved = covers("approved") ? decidedWithin(rows, "approved", now) : null;
  const rejected = covers("rejected") ? decidedWithin(rows, "rejected", now) : null;

  const missingCell = (
    label: string,
    testid: string,
    value: number | null,
    why: string,
    tone?: "warn",
  ): ReactNode =>
    value === null || !ready ? (
      <Cell testid={testid} label={label} value="—" title={ready ? why : off(why)} />
    ) : (
      <Cell testid={testid} label={label} value={String(value)} title={why} tone={value > 0 ? tone : undefined} />
    );

  const pendingWhy = pendingScope
    ? "本页只读 status=pending 队列，这一档与下方列表同源（按已加载行计，读口不给总数）。"
    : status === null || status.trim().toLowerCase() === "all"
      ? "「全部」是服务端按 8 个状态扇出合并的结果，这一档与下方列表同源（按已加载行计，不推算总数）。"
      : `当前列表只包含「${status}」结果，待批数与这份结果不同源；切到「全部」后可见。`;
  const overdueWhy =
    "超过 2 小时未处理算超时，阈值在本模块只有一处（PendingReadouts.WAIT_SLA_MS）；按提交到此刻的等待时长计。";
  const earliestWhy = "最早一条待批的提交时间（读口 createdAt 一族键）；没有待批行时不编时间。";
  const approvedWhy = pendingScope
    ? "缺读口：本页只取待处理队列，通过数需要另取 status=approved（本页不为此多发请求）。切到「历史决策」页签可看同源计数。"
    : covers("approved")
      ? "按已加载行里 7 天内处理完成的通过单计（读口不给总数，这不等于 7 天全量）。"
      : `当前列表只包含「${status}」结果，通过数与这份结果不同源。`;
  const rejectedWhy = pendingScope
    ? "缺读口：本页只取待处理队列，驳回数需要另取 status=rejected（本页不为此多发请求）。切到「历史决策」页签可看同源计数。"
    : covers("rejected")
      ? "按已加载行里 7 天内处理完成的驳回单计（读口不给总数，这不等于 7 天全量）。"
      : `当前列表只包含「${status}」结果，驳回数与这份结果不同源。`;

  const earliestText = earliest === null ? "—" : plainMinute(earliest).slice(5);

  return (
    <div className="apr5-band" role="group" aria-label="审批读数（与列表同一请求，按已加载行计）" data-testid="apr5-metric-band">
      {missingCell("待批", "apr5-band-pending", waiting, pendingWhy)}
      <span className="apr5-band__sep" aria-hidden="true">·</span>
      {missingCell("超时", "apr5-band-overdue", overdue, overdueWhy, "warn")}
      <span className="apr5-band__sep" aria-hidden="true">·</span>
      <Cell
        testid="apr5-band-earliest"
        label="最早提交"
        value={earliestText}
        title={earliest === null ? (ready ? earliestWhy : off(earliestWhy)) : `${earliestWhy} 绝对到分：${plainMinute(earliest)}`}
      />
      <span className="apr5-band__sep" aria-hidden="true">·</span>
      {missingCell("近 7 天通过", "apr5-band-approved", approved, approvedWhy)}
      <span className="apr5-band__sep" aria-hidden="true">·</span>
      {missingCell("驳回", "apr5-band-rejected", rejected, rejectedWhy)}
    </div>
  );
}

/** 骨架的「示例」徽标位在这里换成了诚实的读口来源标签（无数据即「—」）。 */
export const QUEUE_CARD_LABEL = "待办队列 · 按等待时长排序";
