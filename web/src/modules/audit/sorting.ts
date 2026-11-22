/**
 * audN — sorting the columns this page already has.
 *
 * PROBE, 2026-11-20, this lane (docs/_artifacts/aud/DONE.md 同一口径多次记录):
 *   `GET 127.0.0.1:9122/agent-api/api/audit-events?limit=5&sort=occurredAt&order=asc|desc`
 *     → **401 `console.unauthenticated`**（本车道没有可用会话凭据）
 *   `GET …/audit-events?…&orderBy=occurredAt&order=desc` → **401** 同上
 *   `GET …/audit-events?…&sort=actor&order=asc` → **401** 同上
 *   `GET 127.0.0.1:8092/agent-api/api/audit-events?…` → **404 `console.not_found`**（该实例没挂这条路由）
 * 也就是说：**拿不到任何「服务端按 sort/order/orderBy 生效」的证据**（既没有 200，也没有筛前/筛后顺序可对照），
 * 而本模块 `api.ts` 的台账读口 `/api/audit` 从来只发 limit/action/from/to/actorId/resourceId/cursor。
 * 因此这里是**本地排序**：只重排这一页已经读到的行，`aud-sort-scope-note` 明写范围，
 * 界面绝不摆出一副「服务端重排了整窗」的样子。
 *
 * Two rules keep the sort honest:
 * - the comparison uses the SAME display values the screen shows (audJ's
 *   `auditTimeView` / `auditActorView`, the action and resource labels), so a
 *   column can never order by something the person is not reading;
 * - a row whose value the service never sent goes LAST — in both directions.
 *   An absent instant is not an old one, and an unattributed row is not 「空字符串」
 *   that wins the top of an ascending list.
 */

import { AUDJ_TIME_MISSING, auditActorView, auditTimeView } from "./timeActor";
import type { AuditRow } from "./model";

export type SortColumn = "time" | "actor" | "action" | "resource";
export type SortDirection = "asc" | "desc";

export const SORT_COLUMNS: readonly { key: SortColumn; label: string }[] = [
  { key: "time", label: "时间" },
  { key: "actor", label: "操作者" },
  { key: "action", label: "动作" },
  { key: "resource", label: "资源" },
];

export interface SortState {
  column: SortColumn | null;
  direction: SortDirection | null;
}

/** The address keys are `?asort=` / `?adir=`; anything else is no sort. */
export function sortStateFromParams(params: URLSearchParams): SortState {
  return sortStateOf(params.get("asort"), params.get("adir"));
}

/** The same reading off the two raw values, so a page can build it without a
 *  params object and keep the result a plain, comparable pair of primitives. */
export function sortStateOf(raw: string | null, dir: string | null): SortState {
  const column = SORT_COLUMNS.some((item) => item.key === raw) ? (raw as SortColumn) : null;
  const direction = dir === "asc" || dir === "desc" ? dir : null;
  // a direction without a column, or a column without a direction, is not a
  // sort the page can claim: fall back to the order the service gave
  return column && direction ? { column, direction } : { column: null, direction: null };
}

/** asc → desc → cleared, per column; picking another column starts ascending. */
export function nextSort(current: SortState, column: SortColumn): SortState {
  if (current.column !== column) return { column, direction: "asc" };
  if (current.direction === "asc") return { column, direction: "desc" };
  return { column: null, direction: null };
}

const COLLATOR = new Intl.Collator("zh-Hans-CN", { numeric: true, sensitivity: "base" });

/** The value the column sorts on, and whether the service sent one at all. */
function sortKey(row: AuditRow, column: SortColumn): { present: boolean; value: string } {
  switch (column) {
    case "time": {
      const view = auditTimeView(row.occurredAtRaw, row.occurredAt);
      return { present: view.text !== AUDJ_TIME_MISSING, value: view.text };
    }
    case "actor": {
      const view = auditActorView(row.actor);
      // 「未指派」 is the screen's word for nobody attributed — absent, not a name
      return { present: view.text !== "未指派", value: view.text };
    }
    case "action": {
      const value = row.action.label?.trim() ?? "";
      return { present: value !== "" && value !== "—", value };
    }
    case "resource": {
      const value = row.resource.label?.trim() ?? "";
      return { present: value !== "" && value !== "—", value };
    }
  }
}

/**
 * The rows as the screen should show them. The order the service answered in
 * (newest first, its fixed behaviour) is what a cleared sort returns to — this
 * module never claims to know a wider order than the rows in hand.
 */
export function sortRows(rows: readonly AuditRow[], state: SortState): AuditRow[] {
  if (!state.column || !state.direction) return [...rows];
  const factor = state.direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, key: sortKey(row, state.column as SortColumn) }))
    .sort((a, b) => {
      // absent values go last in BOTH directions
      if (a.key.present !== b.key.present) return a.key.present ? -1 : 1;
      if (!a.key.present) return a.index - b.index;
      const compared = COLLATOR.compare(a.key.value, b.key.value);
      return compared !== 0 ? compared * factor : a.index - b.index;
    })
    .map((entry) => entry.row);
}

/** The reading in words, for the note and the status line. */
export function sortReading(state: SortState, count: number): string {
  if (!state.column || !state.direction) return "这一页保持服务给的回行顺序（新在前）。";
  const label = SORT_COLUMNS.find((item) => item.key === state.column)?.label ?? state.column;
  const direction = state.direction === "asc" ? "从小到大（升序）" : "从大到小（降序）";
  return `本列按${label}${direction}排，只重排这一页已加载的 ${count} 条；服务端没有可用的排序参数（本轮实测拿不到生效证据），所以这不是整窗重排。缺这个值的行恒排在最后。`;
}

/**
 * audit-sort-p1（B2 表「排序本地降级 P1」）：每行说自己参与的是哪一种顺序。
 * `service-order` = 这一页保持服务回的行序；`local-page` = 本列在已加载的行里
 * 本地重排过。服务端没有可用的排序参数（本轮实测拿不到生效证据），所以行级
 * 标注比一句话披露更可判——测试与取图都能逐行读到。
 */
export const SORT_SCOPE_SERVICE = "service-order";
export const SORT_SCOPE_LOCAL = "local-page";

/** The scope word stamped on every row while this state is in force. */
export function sortScopeOf(state: SortState): string {
  return state.column && state.direction ? SORT_SCOPE_LOCAL : SORT_SCOPE_SERVICE;
}

/** The ARIA word for the column's current state. */
export function ariaSort(state: SortState, column: SortColumn): "ascending" | "descending" | "none" {
  if (state.column !== column || !state.direction) return "none";
  return state.direction === "asc" ? "ascending" : "descending";
}
