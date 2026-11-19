/**
 * PRD v4.1 附录 A.3 — 唯一暂存区（parked zone）。
 *
 * 这些上游入口既没有被 8 模块 IA 吸收，也不在 §13「不做」清单里，先别丢：
 * 它们不进 routes.ts、不进 registry、不进侧栏、不算 IA 视图，只能从
 * `/system?tab=parked` 直链进入。每一项保留原路径、照抄 A.3 的保留理由、
 * 负责车道与最近复核日期；点卡片走 SPA 路由跳回原页，原页自身不改。
 */
import { Link, useSearchParams } from "react-router";
import type { ReactNode } from "react";

const REVIEWED = "2026-11-19";

type ParkedItem = {
  key: string;
  name: string;
  path: string;
  reason: string;
  lane: string;
};

/** 保留理由逐字照抄 PRD v4.1 附录 A.3 处置表；负责车道按 A.3 背景口径归 L0 集成。 */
const PARKED_ITEMS: ParkedItem[] = [
  {
    key: "files",
    name: "文件浏览",
    path: "/files",
    reason: "文件浏览暂不纳入 IA；§13 不做「独立页」，只保留暂存入口",
    lane: "L0 集成（上游 Hermes 页）",
  },
  {
    key: "logs",
    name: "运行日志",
    path: "/logs",
    reason: "运行日志待定归属，先保能力",
    lane: "L0 集成（上游 Hermes 页）",
  },
  {
    key: "cron",
    name: "计划任务",
    path: "/cron",
    reason: "§13 不做「Hermes cron 冒充计划任务」；只保留只读查看",
    lane: "L0 集成（上游 Hermes 页）",
  },
  {
    key: "plugins",
    name: "插件",
    path: "/plugins",
    reason: "§13 不做插件生态；只保留只读查看",
    lane: "L0 集成（上游 Hermes 页）",
  },
  {
    key: "pairing",
    name: "设备配对",
    path: "/pairing",
    reason: "配对流程未定归属",
    lane: "L0 集成（上游 Hermes 页）",
  },
  {
    key: "webhooks",
    name: "Webhooks",
    path: "/webhooks",
    reason: "未定归属",
    lane: "L0 集成（上游 Hermes 页）",
  },
  {
    key: "env",
    name: "环境变量",
    path: "/env",
    reason: "环境变量页仅调试用，暂不产品化",
    lane: "L0 集成（上游 Hermes 页）",
  },
  {
    key: "docs",
    name: "文档",
    path: "/docs",
    reason: "上游文档页，暂不产品化",
    lane: "L0 集成（上游 Hermes 页）",
  },
];

export function ParkedPage(): ReactNode {
  return (
    <div className="flex min-w-0 w-full flex-col gap-3" data-testid="parked-page">
      <p
        className="min-w-0 break-words rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300"
        data-testid="parked-banner"
        role="status"
      >
        暂存区 · 未纳入信息架构，仅保留能力，随时可能调整
      </p>
      <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PARKED_ITEMS.map((item) => (
          <Link
            key={item.key}
            to={item.path}
            className="flex min-w-0 flex-col gap-1 rounded-md border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
            data-testid={`parked-item-${item.key}`}
          >
            <span className="min-w-0 break-words text-sm font-medium text-foreground">{item.name}</span>
            <span className="min-w-0 break-words font-mono text-xs text-muted-foreground">{item.path}</span>
            <span className="min-w-0 break-words text-xs text-muted-foreground">{item.reason}</span>
            <span className="min-w-0 break-words text-xs text-muted-foreground">
              负责车道：{item.lane} · 最近复核：{REVIEWED}
            </span>
          </Link>
        ))}
      </div>
      <p className="min-w-0 break-words text-xs text-muted-foreground">
        暂存区只读：这里不新增后端，也不改动原页；任一入口要转正，先改 PRD 再施工。
      </p>
    </div>
  );
}

/**
 * /system 表面的 parked 门禁：`?tab=parked` 直链渲染暂存区（不产生 IA tab，
 * routes.ts 数据零改动），其余情况渲染传入的正常 system 视图。
 */
export function ParkedAwareSystem({ system }: { system: ReactNode }): ReactNode {
  const [params] = useSearchParams();
  if (params.get("tab") === "parked") return <ParkedPage />;
  return <>{system}</>;
}
