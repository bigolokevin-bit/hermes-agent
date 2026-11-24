/**
 * 2026-11-24 审批历史密度车道 —— 空态保持骨架行形制。
 *
 * 骨架的空表不是一个居中小灰字卡：表头还在，行高、列宽照旧，只是没有
 * 数据行。这里沿用同一张表壳，把「为什么空 / 下一步 / 清筛选 / 刷新」
 * 压进一条行带，读屏与既有 testid（apv-state-empty*、apr5-empty-history*）
 * 全部保留；不用空白占位冒充数据。
 */
import type { ReactNode } from "react";
import { Inbox, RefreshCw } from "lucide-react";

import { Button } from "@nous-research/ui/ui/components/button";

import { PanelExits } from "./states";

/**
 * 骨架的「空表」不是居中小灰字：表头还在，行高、列轨照旧，只是没有数据行。
 * 这里给一条与队列表头同轨的灰色骨架行（列数对齐、零文字、零数据），
 * 让「现在没有」这件事以形制而不是以留白说话。aria-hidden：它不是读数，
 * 不进气泡摘要，也不冒充任何缺口的「—」。
 */
export function LedgerGhostRow({ columns, testId = "apr5-ghost-row" }: { columns: number; testId?: string }): ReactNode {
  return (
    <div className="apr5-qghost" data-testid={testId} aria-hidden="true">
      {Array.from({ length: columns }, (_, i) => (
        // 第 0 轨是批量勾选槽（不是数据列），骨架行在这里不放灰条。
        <span key={i} className="apr5-qghost__cell">{i === 0 ? null : <i />}</span>
      ))}
    </div>
  );
}

export function LedgerEmpty({
  reason,
  nextStep,
  onRefresh,
  clear,
  testId = "apr5-empty-history",
}: {
  reason: string;
  nextStep: string;
  onRefresh: () => void;
  clear?: { label: string; onClear: () => void };
  testId?: string;
}): ReactNode {
  return (
    <div className="apr5-empty" data-testid={testId}>
      <div className="apr5-empty__row" data-testid="apv-state-empty" role="status">
        <Inbox className="apr5-empty__icon h-4 w-4" aria-hidden="true" />
        <div className="apr5-empty__copy">
          <p className="apr5-empty__title" data-testid="apv-state-empty-text">{reason}</p>
          <p className="apr5-empty__next">{nextStep}</p>
        </div>
        <div className="apr5-empty__acts">
          {clear ? (
            <Button size="sm" data-testid="apv-state-clear" onClick={clear.onClear}>
              {clear.label}
            </Button>
          ) : null}
          <Button
            size="sm"
            outlined={clear ? true : undefined}
            onClick={onRefresh}
            prefix={<RefreshCw className="h-3 w-3" />}
          >
            刷新
          </Button>
        </div>
      </div>
      <div className="apr5-empty__exits">
        <PanelExits testId={`${testId}-exits`} />
      </div>
    </div>
  );
}