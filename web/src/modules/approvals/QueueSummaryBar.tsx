/**
 * R50 — read-only summary bar for the approvals surfaces.
 *
 * Every count is computed from the SAME list request the table already made
 * (no second query, no client-side re-fetch). Where the current request's
 * scope cannot answer a bucket honestly, the count renders "—" with the
 * reason in its title — never a fake 0. Clicking a status count lands on the
 * existing `?status=` filter (history pane consumes it), so refresh and a
 * shared copy reproduce the view.
 *
 * P0-③: `detail` lets a pane fold its own 「已显示 …」 reading line into this
 * bar so the screen carries ONE summary instead of two competing counts.
 * It is plain text, never a second live region (R86 keeps 播报 single).
 */
import { Link } from "react-router";

import { gateReason } from "./gates";
import type { ApprovalRow } from "./model";

type Phase = "loading" | "empty" | "ready" | "error" | "denied";

const STATUS_BUCKETS: readonly { value: string; label: string }[] = [
  { value: "pending", label: "待办" },
  { value: "approved", label: "已批" },
  { value: "rejected", label: "已拒" },
];

const RISK_BUCKETS: readonly { value: string; label: string }[] = [
  { value: "high", label: "高风险" },
  { value: "medium", label: "中风险" },
  { value: "low", label: "低风险" },
];

function unavailable(phase: Phase): string | null {
  // R72: 原因句取自 gateReason 单点；这里只拼「计数」这一动作的后缀。
  if (phase === "loading") return `${gateReason(phase)}，计数不作 0 处理`;
  if (phase === "error") return `本次${gateReason(phase)}，取不到计数`;
  if (phase === "denied") return `${gateReason(phase)}，计数不可得`;
  // empty 走「—」+原因——计数位不得用 0 冒充「读到了空集」这件事本身。
  if (phase === "empty") return `${gateReason(phase)}（不是缺数）；计数位按约定显「—」。`;
  return null;
}

export function QueueSummaryBar({
  phase,
  rows,
  scope,
  singleStatus = null,
  detail = null,
}: {
  phase: Phase;
  rows: readonly ApprovalRow[];
  /** queue = 待处理视图（只读 pending 集合）；history = 决策历史视图。 */
  scope: "queue" | "history";
  /** 历史视图当前生效的单一状态（null=全部）；其余状态桶因此不同源而显「—」。 */
  singleStatus?: string | null;
  /** 本页自有的读数句（含「下面还有更多」/「关键字过滤中」提示）；null=不渲染。 */
  detail?: string | null;
}) {
  const down = unavailable(phase);
  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs"
      role="group"
      aria-label="队列汇总（与列表同一请求结果计算）"
      data-testid="apv6-summary"
    >
      <span className="text-muted-foreground">汇总（与列表同源）：</span>
      {STATUS_BUCKETS.map((bucket) => {
        let count: number | null = null;
        let missingReason: string | null = down;
        // R70: 非 ready 态（含 empty）不数行——计数位走「—」+原因。
        if (down === null && scope === "queue") {
          count = bucket.value === "pending" ? rows.length : null;
          if (count === null) {
            missingReason =
              "本视图只读取待处理队列，该状态的计数与这份结果不同源；请到决策历史查看（那里计数与列表同源）。";
          }
        }
        if (count === null && down === null && scope === "history") {
          if (singleStatus !== null && singleStatus !== bucket.value) {
            missingReason = `当前列表只包含「${singleStatus}」结果，该状态计数与这份结果不同源；切回「全部」后可见。`;
          } else {
            count = rows.filter((row) => row.status.raw?.trim().toLowerCase() === bucket.value).length;
          }
        }
        if (count === null) {
          return (
            <span key={bucket.value} data-testid={`apv6-summary-${bucket.value}`} title={missingReason ?? "计数不可得"}>
              {bucket.label} <b className="font-mono">—</b>
            </span>
          );
        }
        return (
          <Link
            key={bucket.value}
            to={`/approvals?tab=history&status=${encodeURIComponent(bucket.value)}`}
            data-testid={`apv6-summary-${bucket.value}`}
            title="点击＝把该状态写进既有的 ?status= 筛选（刷新与分享可复现）"
            className="text-muted-foreground underline-offset-2 hover:underline focus-visible:underline"
          >
            {bucket.label} <b className="font-mono text-foreground">{count}</b>
          </Link>
        );
      })}
      {RISK_BUCKETS.map((bucket) => {
        const count = down === null ? rows.filter((row) => row.risk.raw?.trim().toLowerCase() === bucket.value).length : null;
        return (
          <span
            key={bucket.value}
            data-testid={`apv6-summary-risk-${bucket.value}`}
            title={
              down ??
              "当前列表范围内的风险分布（同一份服务端返回的行算出）。风险档读口不支持按参数筛选，故为只读展示。"
            }
            className="text-muted-foreground"
          >
            {bucket.label} <b className="font-mono text-foreground">{count ?? "—"}</b>
          </span>
        );
      })}
      {detail ? (
        <span className="min-w-0 break-words text-muted-foreground" data-testid="apv6-summary-detail">
          {detail}
        </span>
      ) : null}
    </div>
  );
}
