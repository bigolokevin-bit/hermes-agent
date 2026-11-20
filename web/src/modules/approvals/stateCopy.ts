/**
 * R93 — the ONE sentence family for approval failure states.
 *
 * The queue panels (apv-state-*) and the employee approvals zone (ed8)
 * render these constants verbatim: one string, one wording, never a
 * third copy. 403 and 404 share the denied body by construction.
 */

/** 空集主句（队列 reason 以此打头拼「：「X」结果下没有记录」）。 */
export const APPROVAL_EMPTY_SENTENCE = "该条件下无审批";
/** 失败首句（ErrorPanel title 与 ed8 错误卡同值）。 */
export const APPROVAL_FAILED_TITLE = "审批申请没能加载出来";
/** 无权首句（403≡404 同体，DeniedPanel 与 ed8 拒绝卡同值）。 */
export const APPROVAL_DENIED_TITLE = "暂时无法查看审批申请";
/** 无权正文（单行常量，两处逐字渲染相等）。 */
export const APPROVAL_DENIED_BODY =
  "这块内容要么尚未对你开放，要么当前环境还没有提供它。这里不会显示任何猜测的内容。 需要处理审批时，请联系工作区管理员为你开通。";
/** 重试按钮文字（单点）。 */
export const APPROVAL_RETRY_LABEL = "重试";
/** rid 缺位兜底句（与 RequestIdCopyField 同值单点）。 */
export const APPROVAL_RID_FALLBACK = "本次请求未记录编号，可复制时间与操作路径反馈";
