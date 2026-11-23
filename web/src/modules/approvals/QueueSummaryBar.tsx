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
 *
 * AP-01 (分母诚实) — the read port has no `total` key (measured: fan-out
 * answers `{items,nextCursor}`, single-status answers `{items}`), so every
 * number in this bar counts LOADED ROWS and says so; `denominatorReadout()`
 * below is the single source of that sentence for the bar, the footer and both
 * panes, and `unreadable` gets an on-screen exit here instead of only in the
 * list body. Nothing in this file may derive a total from a page length.
 */
import { Link } from "react-router";

import { gateReason } from "./gates";
import type { ApprovalRow } from "./model";

type Phase = "loading" | "empty" | "ready" | "error" | "denied";

/** What the read port actually told us about the size of the answer. */
export interface DenominatorFacts {
  /** Rows this request(s) brought back and that can be shown (pre-local-filter). */
  loaded: number;
  /** The read port's own `total` key — absent in every measured response, so null. */
  total: number | null;
  /** The server handed back a cursor, so there is provably more to fetch. */
  hasMore: boolean;
  /** The `status=all`/omitted fan-out leg: cross-status cursor is forced to None
   *  and the merged rows are truncated to `limit`, so "no cursor" proves nothing. */
  aggregated: boolean;
}

/**
 * AP-01 ① — one honest denominator sentence, from one place, for every surface.
 * With a real `total` it shows the total; without one it shows the loaded count
 * marked 非全量 and never a number that could be read as a total.
 */
export function denominatorReadout(facts: DenominatorFacts): {
  text: string;
  reason: string;
  note: string;
} {
  const { loaded, total, hasMore, aggregated } = facts;
  if (total !== null) {
    return {
      text: `共 ${total} 条 / 已加载 ${loaded} 条`,
      reason: "总数来自读口顶层的 total 键（契约升级腿，现网实测未出现）；「已加载」是已累计的行数。",
      note: "",
    };
  }
  const text = `已加载 ${loaded} 条（非全量）`;
  if (hasMore) {
    return {
      text,
      reason:
        "读口顶层没有 total 键（实测 keys=[items,nextCursor]），服务端还给了下一页游标：屏上这些不是全部，按已加载条数推算总数会撒谎，故不推算、不报总数。",
      note: "读口不给总数：这里只报已加载条数，点「加载更多」按服务端游标继续取。",
    };
  }
  if (aggregated) {
    return {
      text,
      reason:
        "读口顶层没有 total 键（实测 keys=[items,nextCursor]）；「全部」由服务端逐状态扇出合并，跨状态游标恒为 None、合并后按单页上限截断：没有游标既不能证明这是全量，也不能证明已到末页，故不报总数。",
      note:
        "「全部」是服务端按 8 个状态扇出合并、再截断到单页上限的结果：没有下一页游标不等于这是全量，所以只报已加载条数（非全量），不报总数。",
    };
  }
  return {
    text,
    reason:
      "读口顶层没有 total 键（实测 keys=[items]），服务端也没有下一页游标：屏上这些是本次取回的全部记录，但总数仍未由读口给出，故不报总数、只报已加载条数。",
    note: "读口不给总数，也没有下一页游标：上面是本次取回的全部记录（服务端未承诺这是全量），总数不推算。",
  };
}

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
  denominator = null,
  unreadable = 0,
}: {
  phase: Phase;
  rows: readonly ApprovalRow[];
  /** queue = 待处理视图（只读 pending 集合）；history = 决策历史视图。 */
  scope: "queue" | "history";
  /** 历史视图当前生效的单一状态（null=全部）；其余状态桶因此不同源而显「—」。 */
  singleStatus?: string | null;
  /** 本页自有的读数句（含「下面还有更多」/「关键字过滤中」提示）；null=不渲染。 */
  detail?: string | null;
  /** AP-01：读口给的尺寸事实（loaded/total/hasMore/扇出腿）；null=不渲染分母句。 */
  denominator?: DenominatorFacts | null;
  /** AP-01②：读回来了但无法成行的记录数；>0 时在汇总条披露「n 条无法读取」。 */
  unreadable?: number;
}) {
  const down = unavailable(phase);
  // AP-01：桶计数数的是「这一份读口结果里的行」，读口没有 total ⇒ 任何桶数都不是
  // 全集的数量。范围句单点出自 denominatorReadout，分页条与本页其他读数同一口径。
  const countScope = denominator === null ? "" : `；${denominatorReadout(denominator).text}`;
  const read = denominator === null || phase !== "ready" ? null : denominatorReadout(denominator);
  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs"
      role="group"
      aria-label="队列汇总（按同一请求已加载的行计，读口不给总数）"
      data-testid="apv6-summary"
    >
      <span className="text-muted-foreground">汇总（与列表同一请求，按已加载行计）：</span>
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
              {bucket.label} <b className="font-mono tabular-nums">—</b>
            </span>
          );
        }
        return (
          <Link
            key={bucket.value}
            to={`/approvals?tab=history&status=${encodeURIComponent(bucket.value)}`}
            data-testid={`apv6-summary-${bucket.value}`}
            title={`点击＝把该状态写进既有的 ?status= 筛选（刷新与分享可复现）${countScope}`}
            className="text-muted-foreground underline-offset-2 hover:underline focus-visible:underline"
          >
            {bucket.label} <b className="font-mono text-foreground tabular-nums">{count}</b>
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
              `当前列表范围内的风险分布（同一份服务端返回的行算出）。风险档读口不支持按参数筛选，故为只读展示。${countScope}`
            }
            className="text-muted-foreground"
          >
            {bucket.label} <b className="font-mono text-foreground tabular-nums">{count ?? "—"}</b>
          </span>
        );
      })}
      {read ? (
        <span
          className="min-w-0 break-words font-mono text-muted-foreground tabular-nums"
          data-testid="apv6-summary-scope"
          title={read.reason}
        >
          {read.text}
        </span>
      ) : null}
      {/* AP-01②：unreadable 的出口——读回来了但成不了行的记录，在汇总条直说，
          不并进任何计数（列表上方那段同源，两处说的是同一件事）。 */}
      {unreadable > 0 ? (
        <span
          className="min-w-0 break-words text-warning"
          data-testid="apv6-summary-unreadable"
          title="这些记录服务端确实返回了，只是内容读不出可显示的形态；它们不计入上面任何一个数字。"
        >
          {unreadable} 条无法读取
        </span>
      ) : null}
      {detail ? (
        <span className="min-w-0 break-words text-muted-foreground" data-testid="apv6-summary-detail">
          {detail}
        </span>
      ) : null}
    </div>
  );
}
