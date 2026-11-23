/**
 * 全局术语表（用户契约 2026-11-23）：同一个术语全站只允许一份定义。
 * 页面不得再随手写「说明／注／口径」句子，只能引用这里的 key，
 * 渲染统一走 `InfoHint`（问号图标 + hover/focus 弹层）。
 * 每条 text ≤45 汉字；source 为可选出处（读口或页面名）。
 */
export const GLOSSARY = {
  "duty.ready": {
    text: "每项检查都通过才算可上岗；未接入的检查既不算通过也不算不通过。",
    source: "员工目录与运行统计",
  },
  "duty.runs": {
    text: "只重排本页已读到的运行；服务端没有排序参数，采集时刻取上游响应自带值。",
    source: "运行窗口统计",
  },
  "duty.cost": {
    text: "只认账本实际金额；缺行不按 0 计入，日账与月账不相加。",
    source: "当日成本账本",
  },
  "duty.notes": {
    text: "各区块读哪个口、算哪一段、缺值怎么显示，全部列在这里。",
    source: "值班台只读口径",
  },
  "duty.denominator": {
    text: "比率与总数只按本轮真正读到的在册员工算；触到单页上限时不是全量。",
    source: "员工目录单页读取",
  },
  "duty.runsCaliber": {
    text: "值班台与指标页各读各的运行统计口；两侧对得上才写一致，本页不替对方取数。",
    source: "运行窗口统计／指标页读口",
  },
  "duty.blockerFields": {
    text: "阻塞项按五个字段呈现：对象、卡在哪一步、等谁、已等时长、下一步动作。",
    source: "运行·任务·审批明细",
  },
  "metrics.cost": {
    text: "成本按账本实际金额统计，缺行不按 0 计入。",
    source: "指标页成本读口",
  },
  "approvals.pending": {
    text: "待处理＝已提交且尚未盖章或驳回；超时只提示，不自动改状态。",
    source: "审批队列读口",
  },
} as const;

export type GlossaryTerm = keyof typeof GLOSSARY;

export function glossaryText(term: GlossaryTerm): string {
  return GLOSSARY[term].text;
}
