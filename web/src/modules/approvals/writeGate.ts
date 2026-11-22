/**
 * P0-1r（wave-126）：控制台写通道在 BFF 层整体关闭，与单据状态无关。L0 于 2026-11-21
 * 用终态单 ap_AEEC078E0C824E749513AFEC9A 一次性实测：POST /agent-api/api/approval/decision?id=
 * → HTTP 405（服务端只允许 GET/HEAD）。批准/驳回若呈现可点，是「必然失败却不提示」的误导。
 * 这里取 runs 页 run5-retry-new 的同源口径：一个对象同时驱动 disabled / aria-disabled /
 * 人话原因，首帧即禁用，不拿用户的点击去撞 405（原因句不裸显服务端 code）。
 * send()、确认弹窗与 405 兜底路径原样保留，供写通道开闸的后代直接复用。
 *
 * 批量 P0 从本文件提取为模块内单点：逐单抽屉与批量条读同一个 DECISION_GATE，
 * 环境只读时两处禁用、两处同一句话，不再有第二套写开关词汇。
 */
export const DECISION_GATE: { disabled: boolean; title: string } = {
  disabled: true,
  title:
    "这个环境的控制台只读：实测决定提交一律被拒（服务端当前只允许读请求，写请求没有入口）。所以批准、驳回在这里以禁用态出现，点它不会发起任何请求；要处理这张单，请走它原本产生决定的渠道。",
};
