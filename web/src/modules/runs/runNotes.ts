/**
 * Calibration notes for the runs list (footer, collapsed by default).
 *
 * One table drives both the visible rows and their titles: the words are not
 * written twice. The cost row reuses COST_CALIBER_TEXT from
 * `../metrics/costCaliberNote` — the same constant the inline
 * `run-cost-caliber-note` prints, so the two can never drift apart.
 *
 * Read routes as the code asks them today (`askListRoute` in ./runs):
 *   /agent-api/api/runs?since=&limit=30[&status][&employeeId][&cursor]
 *   /agent-api/api/run-stats?from=&to=   — 404 fallback only, never with
 *                                          status/employeeId (contract)
 */
import { COST_CALIBER_TEXT } from "../metrics/costCaliberNote";

export interface RunNote {
  key: string;
  /** 口径名 — what this row explains. */
  area: string;
  /** 实际路径 — the read this page uses today. */
  path: string;
  /** 计算范围 — what the number is made of. */
  scope: string;
  /** 缺值策略 — what happens when a piece is missing. */
  missing: string;
}

export const RUN_NOTES_TITLE = "这一页的数字是怎么来的";

export const RUN_NOTE_ROWS: readonly RunNote[] = [
  {
    key: "window",
    area: "时间范围",
    path: "/api/runs?since=…&limit=30（该路径 404 时才改用 /api/run-stats?from=…&to=…）",
    scope: "近 24 小时 / 近 7 天 / 近 30 天换算成起始时刻，只读第一页 30 行，不报总数。",
    missing: "未识别的时间范围按近 7 天读取，地址里的原值不改写。",
  },
  {
    key: "status",
    area: "状态",
    path: "/api/runs?…&status=",
    scope: "只在主读口上按状态过滤；作为兜底的统计读口不接受这个参数，也不带它。",
    missing: "未识别的状态按全部状态读取，地址里的原值不改写。",
  },
  {
    key: "employee",
    area: "员工",
    path: "/api/runs?…&employeeId=",
    scope: "只接受链接里带来的员工标识；这一页没有员工选择器，也不替人推断。",
    missing: "没有员工标识时不做这一层过滤，不默认某个人。",
  },
  {
    key: "state",
    area: "状态机",
    path: "不读写口",
    scope: "只做四态预览：正常读取之外的加载、空、失败、看不到，都是按地址直接画的复现腿。",
    missing: "复现腿不向服务要数据，也不把没读到的算成 0。",
  },
  {
    key: "elapsed",
    area: "耗时",
    path: "行内 startedAt 与 endedAt",
    scope: "起止两端都齐才计算，按北京时间到分显示，不向上取整。",
    missing: "起止两端齐才计算，缺一端显示—，不拿本机时间补。",
  },
  {
    key: "cost",
    area: "成本",
    path: "行内 costStatus 与 costUsd（账本实扣）",
    scope: "只认账本给的实扣金额，不按次数或单价反算。",
    missing: COST_CALIBER_TEXT,
  },
  {
    key: "asOf",
    area: "采集时刻",
    path: "/api/runs 与兜底 /api/run-stats",
    scope: "屏上「采集时刻」只取顶层 ISO 六别名，按北京时间到分显示；读取的时刻与数据的时刻不混为一谈。",
    missing: "只取顶层 ISO，缺失显示—，并写明不用本机时间顶替。",
  },
] as const;