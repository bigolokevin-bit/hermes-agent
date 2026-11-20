/**
 * R71 — column sort bar for the approvals queues (pending & history).
 *
 * 排序是本地能力：读口实测忽略 sort/order/orderBy/dir（同 200、同集合、同顺序），
 * 所以控件只重排「当前已加载」的行，并把这一点写进表下注脚，禁假装服务端排序。
 */
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { actionGates } from "./gates";
import type { ApprovalSortDir, ApprovalSortKey } from "./model";

type Phase = "loading" | "empty" | "ready" | "error" | "denied";

const COLUMNS: readonly { key: ApprovalSortKey; label: string; tip: string }[] = [
  { key: "title", label: "标题", tip: "按标题字母序（中文按拼音 locale 比较）" },
  { key: "status", label: "状态", tip: "按状态原始值字母序；缺原始值的行排末" },
  { key: "risk", label: "风险档", tip: "按严重度 严重>高>中>低；未标注风险的行排末" },
  { key: "time", label: "更新时间", tip: "按决定时间（decidedAt 原值）；没有决定时间的行排末" },
];

export function QueueSortBar({
  phase,
  sort,
  dir,
  loadedCount,
  onCycle,
}: {
  phase: Phase;
  sort: ApprovalSortKey | null;
  dir: ApprovalSortDir;
  loadedCount: number;
  onCycle: (key: ApprovalSortKey) => void;
}) {
  // R72: 与导出/汇总同一 gates 派生；真实空集下排序保持可用。
  const gate = actionGates(phase, loadedCount).sort;
  const blocked = !gate.enabled;
  return (
    <div className="flex min-w-0 flex-col gap-1" data-testid="apv-sort-wrap">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5" role="group" aria-label="列排序">
        <span className="text-xs text-muted-foreground">排序：</span>
        {COLUMNS.map((col) => {
          const active = sort === col.key;
          const state = active ? (dir === "asc" ? "ascending" : "descending") : "none";
          return (
            <button
              key={col.key}
              type="button"
              data-testid={`apv-sort-${col.key}`}
              aria-sort={state}
              disabled={blocked}
              onClick={() => onCycle(col.key)}
              title={
                blocked
                  ? gate.title
                  : active
                    ? `${col.tip}。当前：${dir === "asc" ? "升序" : "降序"}，再点切换${dir === "asc" ? "降序" : "清除"}。仅在当前已加载 ${loadedCount} 条内排序。`
                    : `${col.tip}。点击升序，再点降序，第三下清除。仅在当前已加载 ${loadedCount} 条内排序。`
              }
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                active
                  ? "border-primary/60 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted/40"
              } ${blocked ? "cursor-not-allowed opacity-60" : ""}`}
            >
              {col.label}
              {active ? (
                dir === "asc" ? (
                  <ArrowUp className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <ArrowDown className="h-3 w-3" aria-hidden="true" />
                )
              ) : (
                <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
      <p
        className="min-w-0 break-words text-[11px] text-muted-foreground/70"
        data-testid="apv-gates-note"
        title="六个入口＝导出 CSV、行内展开、打开详情、列排序、汇总桶点选、重试/刷新；enabled/disabled 与提示文案全部由 actionGates(phase, 行数) 一处派生，原因句只有 gateReason 一套措辞。"
      >
        动作可用性矩阵：导出 / 展开 / 详情 / 排序 / 汇总 / 重试同源判定（状态 + 行数），禁用时写明原因。
      </p>
        <p
          className="min-w-0 break-words text-xs text-muted-foreground"
          data-testid="apv-nav-note"
          title="键盘导航只读屏上已加载的行：不产生请求、不改写 URL 参数。"
        >
          键盘：↑/↓ 行间移焦，Home/End 首末行，Enter 展开/收起该行预览，空格打开详情，Esc 收起并回到该行。
        </p>
      {blocked ? null : (
        <p
          className="min-w-0 break-words text-xs text-muted-foreground"
          data-testid="apv-sort-scope-note"
          title="实测：GET /api/approvals 带 sort/order 或 orderBy/dir 任一组合都返回同一集合同一顺序（200，8 条）；后台不做服务端排序，所以这里只重排已加载行。"
        >
          仅在当前已加载 {loadedCount} 条内排序；不是服务端排序（读口忽略排序参数，实测同序同集合），缺值的行恒排末。
        </p>
      )}
    </div>
  );
}
