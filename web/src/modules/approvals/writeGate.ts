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

/* ------------------------------------------------------------------ *
 * AP-05 ① — 「动作指纹缺失」禁用原因（数据侧腿，单点措辞）。
 *
 * 总控裁定（2026-11-24，照实记入 DONE-AP-05）：工单步骤①假设决策钮可启用
 * （AP-04 形制），本轮未开闸，DECISION_GATE 一字不动、按钮三属性仍只读它；
 * 该腿落为「禁用原因列表里新增一条 hash 缺失原因」——由这条单的数据驱动，
 * 与 DECISION_GATE.title 同屏并存。开闸评估时，这句与人工门接成合取
 * （钮的 disabled = DECISION_GATE.disabled ∨ 本句命中），属 AP-04 后续波，
 * 不在本道改。
 *
 * 判据输入是详情读回的 `actionHash`（model.ts 读 actionHash/action_hash/
 * argsDigest 一族键，缺即 null）。现网实测（evidence/raw-detail-*.json，
 * 2026-11-24）：响应只带 argsDigest、恒有值 ⇒ 该句在现网恒不出现=诚实实态；
 * 禁为凑句造字段。缺字段显示「—」的呈现腿走 views.tsx 既有
 * apd5-field-action-hash（MISSING 原因位），本句管的是「为什么批不得」。
 * ------------------------------------------------------------------ */

export const ACTION_HASH_MISSING_REASON = "这张单没给出动作指纹，无法确认批的就是当前动作。";

/** 数据侧判据：详情响应没带回指纹族键 ⇒ 返回该句；带回 ⇒ null（不假报缺失）。 */
export function missingHashReasonFor(actionHash: string | null): string | null {
  return actionHash === null || actionHash.trim() === "" ? ACTION_HASH_MISSING_REASON : null;
}

/**
 * 禁用原因列表单点（按序）：写通道关闭句在前，数据侧指纹缺失句在后。
 * 消费点：决策区说明段逐条渲染；按钮 title 仍只读 DECISION_GATE.title
 * （AP-07② 同源契约不破，本函数不接线到钮上）。
 */
export function decisionBlockReasons(actionHash: string | null): string[] {
  const reasons: string[] = [];
  if (DECISION_GATE.disabled) reasons.push(DECISION_GATE.title);
  const missing = missingHashReasonFor(actionHash);
  if (missing) reasons.push(missing);
  return reasons;
}
