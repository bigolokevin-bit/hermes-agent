/**
 * R90 — single source of truth for the approvals filter reset.
 *
 * One parameter table (FILTER_PARAM_KEYS) drives the reset button, the
 * empty-state 「清空筛选」 exit and (R91) the summary chips: no second set of
 * wording, no second list of keys. tab/id/state/rid are never touched — the
 * pane stays where the reader is; clearing the server-side status parameter
 * is what naturally refetches page one without a cursor.
 */
export const FILTER_PARAM_KEYS = ["status", "q", "actor", "since", "risk", "asort", "adir"] as const;

export function hasActiveFilters(params: URLSearchParams): { active: boolean; count: number } {
  let count = 0;
  for (const key of FILTER_PARAM_KEYS) {
    const value = params.get(key);
    if (value !== null && value !== "") count += 1;
  }
  return { active: count > 0, count };
}

export const RESET_NONE_TITLE = "当前没有可清除的筛选条件";

export function resetTitle(count: number): string {
  if (count <= 0) return RESET_NONE_TITLE;
  return `一次清除 ${count} 项筛选（状态/搜索/审批人/时间/风险/排序），保留页签；回到第一页。`;
}

export function clearFilterParams(draft: URLSearchParams): void {
  for (const key of FILTER_PARAM_KEYS) draft.delete(key);
}
