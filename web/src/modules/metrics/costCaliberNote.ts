/**
 * 跨页成本口径说明（single source）。
 *
 * `/runs` 与 `/metrics` 都显示成本与次数，但口径不同：运行列表只给账本实扣，
 * 指标页把调用次数与账本金额分列。两处说明必须是同一句话，因此文案只在这里
 * 定义一次；各自 title 互指对方路径，让读者知道去哪儿对照。
 */

export const RUNS_PAGE_PATH = '/runs';
export const METRICS_PAGE_PATH = '/metrics';

/** 两页逐字相同的可见文案。改这里一处，两边同时生效。 */
export const COST_CALIBER_TEXT =
  '成本按账本实扣显示：真实的零写 $0.00，没有记账写「—」，不把读不到当成 0。账本实扣与「调用次数」不是同一套口径，两边数字各以本页卡片为准。';

export type CostCaliberAudience = 'runs' | 'metrics';

/** 互指 title：运行列表指向指标页，指标页指回运行列表。原始路径只进 title。 */
export function costCaliberTitle(audience: CostCaliberAudience): string {
  if (audience === 'runs') {
    return `同一笔运行在两个页面各有读数：本页（${RUNS_PAGE_PATH}）的成本取自账本实扣；指标页（${METRICS_PAGE_PATH}）把调用次数与账本金额分列，两者口径不同，不互相换算。`;
  }
  return `同一笔运行在两个页面各有读数：本页（${METRICS_PAGE_PATH}）把调用次数与账本金额分列；运行列表（${RUNS_PAGE_PATH}）的成本取自账本实扣，两者口径不同，不互相换算。`;
}