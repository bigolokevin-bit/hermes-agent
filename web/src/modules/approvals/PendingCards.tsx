/**
 * 2026-11-24 待处理 pane 卡式密度（第三轮）——骨架 L3319–3535 的九张卡，
 * 除「待办队列」主表外都在本文件。
 *
 * 三条纪律（沿用本模块既有口径，不新立规矩）：
 * 1. 每个数都从真读口来：审批统计给待批，无状态列表给近 7 天通过/驳回、
 *    今日办结与近 7 天申请；读不到的那一项/那一列整项不进版面，不摆「—」。
 * 2. 空态不是居中小灰字：表头留着，行高与列轨照旧，用一条与表头同轨的
 *    灰骨架行说话（aria-hidden，不是数据，也不进读屏摘要）。
 * 3. 缺读口的卡只留列形 + 卡底一行 11px 声明；不写示例行，不写端点名，
 *    也不把工程字段名搬上屏。
 */
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "@nous-research/ui/ui/components/button";

import { Pill, type PillTone } from "@/components/console/Pill";

import type { ApprovalStats } from "./api";
import type { ApprovalRow } from "./model";
import { useNowOnce, WAIT_SLA_MS, waitOf } from "./PendingReadouts";
import { epochOf, plainMinute } from "./RelativeTime";

const SEVEN_DAYS_MS = 7 * 86_400_000;

/** 卡壳：与 ConsoleCard 同一套类名，但卡头是 h2（骨架每张卡都是 h2，
 * 全页只有外壳一个 h1）。外层类名不变，视觉与既有卡完全一致。 */
export function SkelCard({
  label,
  action,
  flush,
  children,
  testId,
  "data-testid": dataTestId,
}: {
  label: string;
  action?: ReactNode;
  flush?: boolean;
  children: ReactNode;
  testId?: string;
  "data-testid"?: string;
}): ReactNode {
  return (
    <div className="console-card" data-testid={testId ?? dataTestId}>
      <div className="console-card__head">
        <h2 className="console-card__label apr5-cardtitle">{label}</h2>
        {action ? <span className="console-card__action">{action}</span> : null}
      </div>
      {flush ? children : <div className="console-card__body">{children}</div>}
    </div>
  );
}

const TONE: Record<string, PillTone> = {
  success: "ok",
  warning: "warn",
  destructive: "bad",
  secondary: "mut",
  default: "mut",
  outline: "mut",
  info: "info",
};

function toneOf(row: ApprovalRow): PillTone {
  return TONE[row.status.tone] ?? "mut";
}

function withinDays(iso: string | null, now: number | null): number | null {
  if (now === null) return null;
  const ms = epochOf(iso);
  if (ms === null || ms > now) return null;
  return now - ms <= SEVEN_DAYS_MS ? ms : null;
}

function minuteText(fromMs: number, toMs: number): string {
  const minutes = Math.max(0, Math.floor((toMs - fromMs) / 60_000));
  if (minutes < 1) return "<1m";
  const hours = Math.floor(minutes / 60);
  return hours < 1 ? `${minutes}m` : `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}

/** 表头：与行同一套列轨；9px mono 大写，和其他卡同一形制。 */
function TableHead({ variant, columns }: { variant: string; columns: readonly string[] }): ReactNode {
  return (
    <div className={`apr5-th ${variant}`} role="row" aria-hidden="true">
      {columns.map((label) => (
        <span key={label}>{label}</span>
      ))}
    </div>
  );
}

/** 空表骨架行：与表头同轨，零文字、零数据。 */
export function GhostRow({
  variant,
  columns,
  testId,
}: {
  variant: string;
  columns: number;
  testId?: string;
}): ReactNode {
  return (
    <div className={`apr5-gh ${variant}`} aria-hidden="true" data-testid={testId}>
      {Array.from({ length: columns }, (_, i) => (
        <span key={i}>
          <i />
        </span>
      ))}
    </div>
  );
}

/** 卡底一行 11px 口径/缺口声明（全模块只有这一种卡底句式）。 */
function CardFoot({ children, testId }: { children: ReactNode; testId?: string }): ReactNode {
  return (
    <p className="apr5-cardfoot" data-testid={testId}>
      {children}
    </p>
  );
}

/* ── 今日办结 ─────────────────────────────────────────────── */

export function TodayDoneCard({ rows, phase }: { rows: readonly ApprovalRow[] | null; phase: "loading" | "ready" }): ReactNode {
  const now = useNowOnce();
  const today = now === null ? null : plainMinute(now).slice(0, 10);
  const done = today === null || rows === null
    ? []
    : rows
        .filter((row) => !row.status.pending)
        .filter((row) => {
          const ms = epochOf(row.decidedAt);
          return ms !== null && plainMinute(ms).slice(0, 10) === today;
        })
        .sort((a, b) => (epochOf(b.decidedAt) ?? 0) - (epochOf(a.decidedAt) ?? 0));

  const durations = done
    .map((row) => {
      const from = epochOf(row.submittedAt);
      const to = epochOf(row.decidedAt);
      return from !== null && to !== null && to >= from ? to - from : null;
    })
    .filter((value): value is number => value !== null);
  const average = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60_000) : null;

  return (
    <SkelCard
      label="今日办结"
      action={<span className="apr5-minilink is-plain">{average === null ? `${done.length} 项` : `${done.length} 项 · 平均 ${average} 分钟`}</span>}
      data-testid="apr5-today-card"
    >
      <TableHead variant="apr5-t5" columns={["时间", "事项", "审批人", "结果", "耗时"]} />
      {done.length > 0 ? (
        done.slice(0, 5).map((row) => {
          const at = epochOf(row.decidedAt);
          const from = epochOf(row.submittedAt);
          return (
            <div className="apr5-tr apr5-t5" key={row.key} data-testid="apr5-today-row">
              <span className="apr5-mono">{at === null ? "" : plainMinute(at).slice(11, 16)}</span>
              <span className="apr5-tcell">{row.title}</span>
              <span className="apr5-sub">{row.approvers.labels[0] ?? "未写明审批人"}</span>
              <span>
                <Pill tone={toneOf(row)}>{row.status.label}</Pill>
              </span>
              <span className="apr5-mono apr5-right">{from !== null && at !== null ? minuteText(from, at) : ""}</span>
            </div>
          );
        })
      ) : (
        <>
          <GhostRow variant="apr5-t5" columns={5} testId="apr5-today-ghost" />
          <GhostRow variant="apr5-t5" columns={5} />
        </>
      )}
      <CardFoot testId="apr5-today-foot">
        范围：只列今天已办结的申请；处理时间由读口给出才计入，平均耗时只对有起止时间的行求均值。
        {phase === "ready" && done.length === 0 ? " 今天还没有办结任何申请；耗时只算提交与处理两端都有时间的行。" : null}
      </CardFoot>
    </SkelCard>
  );
}

/* ── 近 7 天申请（骨架「我发起的申请」） ─────────────────── */

export function RecentRequestsCard({ rows, phase }: { rows: readonly ApprovalRow[] | null; phase: "loading" | "ready" }): ReactNode {
  const now = useNowOnce();
  const requests = rows === null
    ? []
    : rows
        .filter((row) => withinDays(row.submittedAt, now) !== null)
        .sort((a, b) => (epochOf(b.submittedAt) ?? 0) - (epochOf(a.submittedAt) ?? 0));

  return (
    <SkelCard
      label="近 7 天申请"
      action={
        <Link className="apr5-minilink" to="/approvals?tab=history">
          看历史决策 →
        </Link>
      }
      data-testid="apr5-mine-card"
    >
      <TableHead variant="apr5-t4" columns={["事项", "类型", "提交于", "状态"]} />
      {requests.length > 0 ? (
        requests.slice(0, 6).map((row) => {
          const at = epochOf(row.submittedAt);
          return (
            <div className="apr5-tr apr5-t4" key={row.key} data-testid="apr5-mine-row">
              <span className="apr5-tcell">{row.title}</span>
              <span className="apr5-sub">{row.changeKind.raw ? row.changeKind.label : "未写明类型"}</span>
              <span className="apr5-mono">{at === null ? "提交时间缺失" : plainMinute(at).slice(5, 16)}</span>
              <span>
                <Pill tone={toneOf(row)}>{row.status.label}</Pill>
              </span>
            </div>
          );
        })
      ) : (
        <>
          <GhostRow variant="apr5-t4" columns={4} testId="apr5-mine-ghost" />
          <GhostRow variant="apr5-t4" columns={4} />
          <GhostRow variant="apr5-t4" columns={4} />
        </>
      )}
      <CardFoot testId="apr5-mine-foot">
        范围：近 7 天提交的申请（含已过期与已消费）。当前审批节点没有读口，该列不渲染；本租户的控制台身份与申请发起人之间也没有绑定，所以不写「我」。
        {phase === "ready" && requests.length === 0 ? " 近 7 天没有读到申请；最多列最近 6 条。" : null}
      </CardFoot>
    </SkelCard>
  );
}

/* ── 审批负载（右栏） ─────────────────────────────────────── */

export function LoadCard({
  stats,
  rows,
  allRows,
  phase,
}: {
  stats: ApprovalStats | null;
  rows: readonly ApprovalRow[];
  allRows: readonly ApprovalRow[] | null;
  phase: "loading" | "ready";
}): ReactNode {
  const now = useNowOnce();
  const queueReady = phase === "ready" && now !== null;
  const pending = stats?.pending ?? (phase === "ready" ? rows.filter((row) => row.status.pending).length : null);
  const overdue = queueReady ? rows.filter((row) => row.status.pending && (waitOf(epochOf(row.submittedAt), now)?.overdue ?? false)).length : null;

  const waits = queueReady
    ? rows
        .filter((row) => row.status.pending)
        .map((row) => {
          const ms = epochOf(row.submittedAt);
          return ms === null ? null : Math.max(0, now - ms);
        })
        .filter((value): value is number => value !== null)
        .sort((a, b) => a - b)
    : [];
  const median = waits.length > 0 ? waits[Math.floor(waits.length / 2)] : null;

  const today = now === null ? null : plainMinute(now).slice(0, 10);
  const doneToday = allRows !== null && today !== null
    ? allRows.filter((row) => {
        if (row.status.pending) return false;
        const ms = epochOf(row.decidedAt);
        return ms !== null && plainMinute(ms).slice(0, 10) === today;
      }).length
    : null;
  const approved = allRows !== null
    ? allRows.filter((row) => row.status.raw?.trim().toLowerCase() === "approved" && withinDays(row.decidedAt, now) !== null).length
    : null;
  const rejected = allRows !== null
    ? allRows.filter((row) => row.status.raw?.trim().toLowerCase() === "rejected" && withinDays(row.decidedAt, now) !== null).length
    : null;

  return (
    <SkelCard label="审批负载" action={<span className="apr5-minilink is-plain">今日</span>} data-testid="apr5-load-card">
      <div className="apr5-load">
        {pending === null ? <i className="apr5-load__ghost" aria-hidden="true" /> : <span className="apr5-load__n" data-testid="apr5-load-pending">{pending}</span>}
        {median !== null ? <Pill tone="warn">中位等待 {minuteText(now! - median, now!)}</Pill> : null}
      </div>
      <div className="console-divider" />
      <dl className="console-kv" data-testid="apr5-load-kv">
        {doneToday !== null ? (
          <>
            <dt>今日办结</dt>
            <dd className="apr5-mono">{doneToday}</dd>
          </>
        ) : null}
        {approved !== null ? (
          <>
            <dt>近 7 天通过</dt>
            <dd className="apr5-mono">{approved}</dd>
          </>
        ) : null}
        {rejected !== null ? (
          <>
            <dt>近 7 天驳回</dt>
            <dd className="apr5-mono">{rejected}</dd>
          </>
        ) : null}
        {overdue !== null ? (
          <>
            <dt>超 2 小时</dt>
            <dd className="apr5-mono">{overdue}</dd>
          </>
        ) : null}
        <dt>超时阈值</dt>
        <dd>{Math.round(WAIT_SLA_MS / 3_600_000)} 小时</dd>
      </dl>
      <CardFoot testId="apr5-load-foot">
        范围：待批数来自审批统计读口，超时按 2 小时阈值从待办行计；近 7 天通过与驳回按无状态列表里已决的单计。
        {phase === "ready" && allRows === null ? " 缺读口：全部申请清单此刻读不到，这一卡只报待批队列里的数。" : null}
      </CardFoot>
    </SkelCard>
  );
}

/* ── 谁在等（右栏） ───────────────────────────────────────── */

export function WaitersCard({ rows, phase }: { rows: readonly ApprovalRow[]; phase: "loading" | "ready" }): ReactNode {
  const now = useNowOnce();
  const groups = new Map<string, number>();
  if (phase === "ready" && now !== null) {
    for (const row of rows) {
      if (!row.status.pending) continue;
      const ms = epochOf(row.submittedAt);
      if (ms === null) continue;
      const wait = Math.max(0, now - ms);
      const key = row.requester.label;
      groups.set(key, Math.max(groups.get(key) ?? 0, wait));
    }
  }
  const entries = [...groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <SkelCard label="谁在等" action={<span className="apr5-minilink is-plain">按发起人</span>} data-testid="apr5-waiters-card">
      {entries.length > 0 ? (
        <div className="apr5-waiters">
          {entries.map(([name, wait]) => (
            <div className="apr5-waiter" key={name}>
              <span className="apr5-tcell">{name}</span>
              <span className={`apr5-mono ${wait > WAIT_SLA_MS ? "apr5-is-warn" : ""}`}>{minuteText(now! - wait, now!)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="apr5-waiters">
          <GhostRow variant="apr5-t2" columns={2} testId="apr5-waiters-ghost" />
          <GhostRow variant="apr5-t2" columns={2} />
          <GhostRow variant="apr5-t2" columns={2} />
        </div>
      )}
      {phase === "ready" && entries.length === 0 ? <CardFoot>队列为空，此刻没有人在等。</CardFoot> : null}
    </SkelCard>
  );
}

/** 骨架的 notice：不是卡，是右栏的一句硬规则。 */
export function PolicyNotice(): ReactNode {
  return (
    <div className="console-notice" data-testid="apr5-policy-notice">
      <div className="min-w-0">
        <b>「对外发送」不可自动通过</b>
        <div className="console-notice__sub">即使发起人是管理员，也需第二人确认。</div>
      </div>
    </div>
  );
}

/* ── 配置发布审批（缺读口） ────────────────────────────────── */

export function ReleaseGateCard(): ReactNode {
  return (
    <SkelCard
      label="配置发布审批"
      action={<span className="apr5-minilink is-plain">缺读口</span>}
      data-testid="apr5-release-card"
    >
      <TableHead variant="apr5-t6" columns={["员工", "版本", "校验", "审批人", "发起", "状态"]} />
      <GhostRow variant="apr5-t6" columns={6} testId="apr5-release-row" />
      <GhostRow variant="apr5-t6" columns={6} />
      <CardFoot testId="apr5-release-missing">
        缺读口：配置发布审批没有列表读口，员工、版本、校验结果、审批人与发起时刻都读不到；这一卡只保留骨架列形，不写示例行。
      </CardFoot>
    </SkelCard>
  );
}

/* ── 发布链 / 校验项（发布门的形制两卡） ──────────────────── */

export function ReleaseChainCard(): ReactNode {
  return (
    <SkelCard label="发布链" action={<span className="apr5-minilink is-plain">与员工详情同源</span>} data-testid="apr5-chain-card">
      <dl className="console-kv">
        <dt>状态机</dt>
        <dd className="apr5-mono">draft → validating → approved → publishing → active</dd>
        <dt>必备字段</dt>
        <dd>配置版本、员工、生效时刻、策略快照、审批单据</dd>
        <dt>失败回退</dt>
        <dd>校验失败即终止，不产生发布</dd>
      </dl>
      <CardFoot>缺读口：本租户没有发布流水读口，这一卡只写发布链约定，不是本租户读数；发布动作也不在本页发起。</CardFoot>
    </SkelCard>
  );
}

const CHECK_ITEMS = ["模型与回退链可达", "技能版本未被撤回", "知识范围在授权内", "预算不低于当前已用", "发送门未关闭"] as const;

export function ReleaseChecksCard(): ReactNode {
  return (
    <SkelCard label="校验项" action={<span className="apr5-minilink is-plain">发布前必过</span>} data-testid="apr5-checks-card">
      <div className="apr5-checks">
        {CHECK_ITEMS.map((label) => (
          <div className="apr5-check" key={label}>
            <span>{label}</span>
            <i className="apr5-ghostpill" aria-hidden="true" />
          </div>
        ))}
      </div>
      <CardFoot testId="apr5-checks-missing">缺读口：校验结果没有读口，这里只列校验项，不写通过或失败；接上读口后才会出现结果。</CardFoot>
    </SkelCard>
  );
}

/* ── 批量操作（空队列时的骨架条） ─────────────────────────── */

export function BatchSkeletonCard(): ReactNode {
  return (
    <SkelCard
      label="批量操作"
      action={<span className="apr5-minilink is-plain">仅同类型可批量</span>}
      data-testid="apr5-bulk-card"
    >
      <div className="apr5-batch" data-testid="apv-bulk-empty">
        <Button size="sm" disabled title="待办队列为空，没有可选择的单。">
          选择预算类（0）
        </Button>
        <Button size="sm" disabled title="待办队列为空，没有可选择的单。">
          选择低风险（0）
        </Button>
        <Button size="sm" outlined disabled title="没有选择可清空。">
          清空
        </Button>
        <span className="grow" />
        <span className="apr5-sub">高风险的「对外发送」「删除」不可批量</span>
      </div>
      <CardFoot>范围：批量只对同类型、低风险的待办生效；队列为空时三个按钮都在禁用态，不放点不动的假动作。</CardFoot>
    </SkelCard>
  );
}