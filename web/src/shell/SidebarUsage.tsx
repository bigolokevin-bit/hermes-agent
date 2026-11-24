/**
 * 侧栏底部额度块（骨架 `.nav-foot` 对齐，2026-11-24）。
 *
 * 骨架三行是「今日全局上限 $已用 / $上限 + 4px 占比条」「本月 $已用 / $配额 · 百分比」。
 * 本树 BFF 没有美元日上限的真口径（matrix 的 dailyTokens 是 token 预算），所以
 * 第一行退化成「今日成本 $X」——没有分母就不写分母。
 *
 * 布局稳定是硬约束：两块标签行 + 4px 占比条的位置**永远在**，任何一路数据慢
 * （matrix 配额实测 5s+）都不许把整块抽掉。未到数显示「读取中…」，到数替换；
 * 今日与本月各自落地、互不等待。读取失败才显示「—」，绝不拿 — 冒充还没回来的值。
 */
import type { ReactNode } from "react";
import { useSidebarUsage } from "./sidebar-data";

function money(value: number | null): string {
  if (value === null) return "—";
  return `$${value.toFixed(2)}`;
}

function percentOf(used: number | null, quota: number | null): number | null {
  if (used === null || quota === null || quota <= 0) return null;
  return Math.max(0, Math.min(100, (used / quota) * 100));
}

/** 占比配色：<70% 正常，70~90% 提醒，≥90% 危险。 */
function toneOf(pct: number | null): string {
  if (pct === null) return "var(--ok)";
  if (pct >= 90) return "var(--bad)";
  if (pct >= 70) return "var(--warn)";
  return "var(--ok)";
}

/** 未到数：11px 弱色读数语，几何与真值同高（不留空框）。 */
function Pending(): ReactNode {
  return <span className="sidebar-usage-pending">读取中…</span>;
}

export function SidebarUsage(): ReactNode {
  const usage = useSidebarUsage();
  const pct = percentOf(usage.monthCostUsd, usage.monthQuotaUsd);

  const todayText =
    usage.todayCostUsd === null && !usage.todaySettled ? (
      <Pending />
    ) : (
      money(usage.todayCostUsd)
    );

  const monthText = usage.monthSettled ? (
    usage.monthCostUsd === null && usage.monthQuotaUsd === null ? (
      "—"
    ) : (
      [
        money(usage.monthCostUsd),
        usage.monthQuotaUsd === null ? null : money(usage.monthQuotaUsd),
      ]
        .filter((part): part is string => part !== null)
        .join(" / ") + (pct === null ? "" : ` · ${pct.toFixed(1)}%`)
    )
  ) : (
    <Pending />
  );

  return (
    <div
      className="sidebar-usage"
      data-testid="sidebar-usage"
      aria-busy={!usage.todaySettled || !usage.monthSettled}
    >
      <div className="sidebar-usage-row">
        <span className="sidebar-usage-k">今日成本</span>
        <span className="sidebar-usage-v" data-testid="sidebar-usage-today">
          {todayText}
        </span>
      </div>

      <div className="sidebar-usage-row">
        <span className="sidebar-usage-k">本月</span>
        <span className="sidebar-usage-v" data-testid="sidebar-usage-month">
          {monthText}
        </span>
      </div>

      {/* 4px 占比条的位置常驻；未到数时宽度 0（不画假的占比）。 */}
      <div
        className="sidebar-usage-bar"
        role="img"
        aria-label={
          pct === null ? "本月占比读取中" : `本月已用 ${pct.toFixed(1)}%`
        }
      >
        <i style={{ width: pct === null ? "0%" : `${pct}%`, background: toneOf(pct) }} />
      </div>
    </div>
  );
}