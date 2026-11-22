// B1 筛选控件条（L0 点单 2026-11-23）：值班台「今日运行」卡的运行状态筛选。
// 形制对齐同仓 URL-owned 筛选（RunsModulePage.tsx:18 「The filters are
// URL-owned (`?window=` / `?status=`)」）与参考屏 chips 组
// （web/docs/console-v4-skeleton.html :3053/:3591 aria-pressed+计数）。
// 只作用于展示行；卡上合计仍以服务端窗口统计为准（不在此重算）。
export const DUTY_STATUS_PARAM = "status";

export type DutyStatusFilterId = "all" | "running" | "completed" | "failed";

export const DUTY_STATUS_FILTERS: ReadonlyArray<{ id: DutyStatusFilterId; label: string }> = [
  { id: "all", label: "全部" },
  { id: "running", label: "在跑" },
  { id: "completed", label: "成功" },
  { id: "failed", label: "失败" },
];

export function parseDutyStatusFilter(raw: string | null): DutyStatusFilterId {
  return DUTY_STATUS_FILTERS.some((f) => f.id === raw) ? (raw as DutyStatusFilterId) : "all";
}

/** 与 runs 模块 status 口径对齐：completed 同时认服务端两种写法。 */
export function filterDutyRuns<T extends { status?: string }>(rows: T[], id: DutyStatusFilterId): T[] {
  if (id === "all") return rows;
  if (id === "running") return rows.filter((r) => r.status === "running" || r.status === "pending");
  if (id === "completed") return rows.filter((r) => r.status === "completed" || r.status === "succeeded");
  return rows.filter((r) => r.status === "failed");
}
