import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * UI-F 固定槽位卡片（用户直令「Card 固定槽位」）。
 *
 * 卡片只有五个槽：标题 / 副标 / 主数字 / 一句状态 / 底部出口。
 * 明细不进卡片——超出槽位的内容一律截断，看全部走底部 action 深链。
 * 同一行的卡片用 UiCardRow 包住，等高由 CSS 的 stretch + margin-block-start:auto
 * 唯一实现，页面不要再自己写一遍（这是三张 KPI 卡被打回的根因）。
 *
 * 用法：
 *   <UiCardRow cols={3}>
 *     <UiCard title="可上岗" metric="12" metricLabel="人" note="还有 2 项检查没接入"
 *             action={<Link to="/employees">查看明细</Link>} />
 *   </UiCardRow>
 */
export interface UiCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  metric?: ReactNode;
  metricLabel?: ReactNode;
  note?: ReactNode;
  /** 槽位外的明细必须走这里（深链），不要塞 children。 */
  action?: ReactNode;
  /** 只放固定的少量控件（如四格 KPI），高内容由槽位数决定，不随数据行数增长。 */
  children?: ReactNode;
  tone?: "surface" | "raised";
  testId?: string;
  className?: string;
}

export function UiCard({
  title,
  subtitle,
  metric,
  metricLabel,
  note,
  action,
  children,
  tone = "surface",
  testId,
  className,
}: UiCardProps) {
  return (
    <section
      className={cn("ui-card", tone === "raised" && "is-raised", className)}
      data-ui-card={testId ?? "card"}
      data-testid={testId}
    >
      <header className="ui-card-head">
        <h3 className="ui-card-title" data-ui-card-slot="title">
          {title}
        </h3>
        {subtitle ? (
          <span className="ui-card-subtitle" data-ui-card-slot="subtitle">
            {subtitle}
          </span>
        ) : null}
      </header>
      {metric !== undefined && metric !== null ? (
        <p className="ui-card-metric" data-ui-card-slot="metric">
          <b className="ui-card-metric-value">{metric}</b>
          {metricLabel ? <span className="ui-card-metric-label">{metricLabel}</span> : null}
        </p>
      ) : null}
      {note !== undefined && note !== null ? (
        <p className="ui-card-note" data-ui-card-slot="note">
          {note}
        </p>
      ) : null}
      {children ? (
        <div className="ui-card-body" data-ui-card-slot="body">
          {children}
        </div>
      ) : null}
      <footer className="ui-card-foot" data-ui-card-slot="foot">
        {action ?? null}
      </footer>
    </section>
  );
}

export interface UiCardRowProps {
  children: ReactNode;
  cols?: 2 | 3 | 4;
  testId?: string;
  className?: string;
}

/** 同排等高容器：卡片高度由最高的内容决定，其余卡片被拉伸到同一行高。 */
export function UiCardRow({ children, cols = 3, testId, className }: UiCardRowProps) {
  return (
    <div
      className={cn("ui-card-row", className)}
      data-ui-card-row={testId ?? "row"}
      data-cols={cols}
      data-testid={testId}
    >
      {children}
    </div>
  );
}
