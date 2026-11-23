/**
 * DU-02 固定槽位的计数定义（三卡「查看全部 (N)」的唯一来源）。
 *
 * N 只认**服务端响应真给回来的行数**：数的是这一份响应里实际带的集合，
 * 不是请求上限、不是页码乘以条数、也不是卡上已经画了几行。三种拿不到的
 * 情形一律 null —— ① 这一腿读取失败／还在读；② 响应形状漂移（既不是数组
 * 也没有 `items` 数组）；③ 上游根本没带这个键。null 上屏写「(数量未提供)」，
 * 绝不画 0（`asArray` 会把漂移收成空数组，所以这里不复用它，见 serverRowsOf）。
 */

export interface ServerRowCount {
  /** 响应里真带的行数；null = 服务端没给出可数的行集合。 */
  serverRows: number | null;
  /** 响应里带回来但读不成行的条数（非对象／缺 id）；null = 无从判断。 */
  unreadable: number | null;
  /** 本轮请求带上的行数上限；null = 这一腿没有设上限。 */
  requestLimit: number | null;
}

export const NO_COUNT: ServerRowCount = {
  serverRows: null,
  unreadable: null,
  requestLimit: null,
};

/** 折叠区列表的显示封顶（沿用 duty-details-run-list 既有 8 条上限，单一定源）。 */
export const DUTY_LIST_CAP = 8;

/**
 * 只数响应实际带回来的集合；形状对不上给 null，不给 0。
 * 与 `asArray` 的分工：asArray 负责「拿来画图」（漂移→空数组），
 * 本函数负责「服务端给了几行」（漂移→null，宁可不显示数字）。
 */
export function serverRowsOf(body: unknown): number | null {
  if (Array.isArray(body)) return body.length;
  if (body && typeof body === "object" && Array.isArray((body as { items?: unknown }).items)) {
    return ((body as { items: unknown[] }).items).length;
  }
  return null;
}

/** 深链文案：有真数就带数，拿不到就明说没有，不猜一个数填进去。 */
export function viewAllText(n: number | null): string {
  return n === null ? "查看全部 (数量未提供)" : `查看全部 (${n})`;
}

/**
 * 截断披露：只有「响应行数打满本轮请求上限」才说非全量——这是响应自证的事实，
 * 不是「多半还有更多」的推测；没打满就只报本轮返回条数。
 */
export function truncationClause(count: ServerRowCount): string {
  const n = count.serverRows;
  if (n === null) return "本轮返回条数未提供";
  if (count.requestLimit !== null && n >= count.requestLimit) {
    return `本轮返回 ${n} 条（请求上限 ${count.requestLimit}，非全量）`;
  }
  return `本轮返回 ${n} 条`;
}

/**
 * 折叠区列表的承接句：服务端给了 n 条、这一屏列出 k 条（k≤DUTY_LIST_CAP）、
 * 另有 u 条读不成形。三个数各自有源，缺哪个就不说哪个。
 */
export function detailsListNote(count: ServerRowCount, shown: number): string {
  const parts: string[] = [];
  const clause = truncationClause(count);
  if (clause) parts.push(clause);
  if (count.serverRows !== null && shown < count.serverRows) {
    parts.push(`这里列前 ${shown} 条`);
  }
  if (count.unreadable !== null && count.unreadable > 0) {
    parts.push(`${count.unreadable} 条读不成行形，不计入明细`);
  }
  return parts.join(" · ");
}
