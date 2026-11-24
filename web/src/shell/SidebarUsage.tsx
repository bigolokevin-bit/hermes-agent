/**
 * 侧栏底部额度块（骨架 `.nav-foot` 对齐，2026-11-24）。
 *
 * 骨架三行是「今日全局上限 $已用 / $上限 + 4px 占比条」「本月 $已用 / $配额 · 百分比」。
 * 本树 BFF 没有美元日上限的真口径（matrix 的 dailyTokens 是 token 预算），所以
 * 第一行退化成「今日成本 $X」——没有分母就不写分母，也不画占比条；第二行有真
 * 配额分母，占比条挂在它下面，颜色按占比走 --ok / --warn / --bad。
 * 任一读数取不到就是「—」，绝不补 0。
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

export function SidebarUsage(): ReactNode {
  const usage = useSidebarUsage();
  const pct = percentOf(usage.monthCostUsd, usage.monthQuotaUsd);

  return (
    <div className="sidebar-usage" data-testid="sidebar-usage">
      <div className="sidebar-usage-row">
        <span className="sidebar-usage-k">今日成本</span>
        <span className="sidebar-usage-v" data-testid="sidebar-usage-today">
          {money(usage.todayCostUsd)}
        </span>
      </div>

      <div className="sidebar-usage-row">
        <span className="sidebar-usage-k">本月</span>
        <span className="sidebar-usage-v" data-testid="sidebar-usage-month">
          {usage.monthCostUsd === null && usage.monthQuotaUsd === null
            ? "—"
            : [
                money(usage.monthCostUsd),
                usage.monthQuotaUsd === null ? null : money(usage.monthQuotaUsd),
              ]
                .filter((part): part is string => part !== null)
                .join(" / ") +
              (pct === null ? "" : ` · ${pct.toFixed(1)}%`)}
        </span>
      </div>

      {pct !== null && (
        <div
          className="sidebar-usage-bar"
          role="img"
          aria-label={`本月已用 ${pct.toFixed(1)}%`}
        >
          <i style={{ width: `${pct}%`, background: toneOf(pct) }} />
        </div>
      )}
    </div>
  );
}