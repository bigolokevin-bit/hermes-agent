/**
 * AP-05 ②③ — 决定提交结果的单一状态机（纯逻辑，UI 只做映射）。
 *
 * 三条服务事实（域 approvals.py decide_approval 盘读 2026-11-24；BFF 逐字转发）：
 * 1. 幂等键＝(approval_id, user_id)。同键重放（含双击）⇒ **200 带回整张票面**，
 *    不是错误、不产生第二票；三条 200 路径（既有票回填、fresh 记票、并发认票）
 *    都以「该键的票在单上」为前提，票面已落定时「你已经投过票」为真话。
 * 2. 409 只会来自 idempotency key 复用且请求体不一致（先例
 *    docs/_artifacts/D/T03-ENDPOINT-RECONCILIATION.md L137-141；本 worktree 盘上
 *    无该文件，判据按总控转述落注）——人话提示冲突，**不重试**。
 * 3. 超时/断连＝结果未知，客户端分不出「票已记上但回执没回来」与「根本没记上」；
 *    唯一后继是恰好一次 GET 读回（api.ts readBackDecisionTicket），看
 *    status/decisions 再决定。本模块任何分支都不存在第二次 POST 路径——
 *    approvals.idempotency.test.tsx 以 POST 计数=1 钉死。
 *
 * 写开关（DECISION_GATE）关时这些分支不可从 UI 触达，由本文件的单测与
 * 状态机测试钉住形制；开闸波直接接线，不再改判据。
 */
import {
  failureInfo,
  isUnknownOutcome,
  isWriteUnavailable,
  type Verdict,
} from "./api";
import {
  CODE_ALREADY_DECIDED,
  CODE_EXPIRED,
  alreadyDecidedFaceCopy,
  pendingReadbackCopy,
  replayFaceCopy,
  settledReadbackCopy,
  unreadableReadbackCopy,
  writeFailure,
  type FailureCopy,
} from "./copy";
import { approvalDetailFrom, type ApprovalDetail } from "./model";

export interface SubmitDeps {
  /** 真生产腿是 api.ts postDecision；测试注入合法 stub（stub 允许在测试面）。 */
  post: (id: string, verdict: Verdict, comment?: string) => Promise<unknown>;
  /** 真生产腿是 api.ts readBackDecisionTicket（GET，恰好一次）。 */
  readBack: (id: string) => Promise<ApprovalDetail | null>;
}

export type SubmitOutcome =
  /** 200 且票面仍在等人：本次票已记（或响应没给可读票面），重读渲染。 */
  | { kind: "recorded"; reloadTicket: true; reloadList: true }
  /** ②同键重放/双击：200＋票面已落定 ⇒ 成功侧回填票面，不进错误弹窗、不当失败。 */
  | { kind: "replay"; face: FailureCopy; reloadTicket: true; reloadList: true }
  /** 已知失败（4xx/5xx/CSRF 拦截/连不上之外的确定答复）：逐码人话句。 */
  | { kind: "failure"; copy: FailureCopy; reloadTicket: boolean; reloadList: boolean }
  /**
   * AP-06 ① 409 `approval.already_decided`＝回填票面（成功侧，不当失败）：
   * 票面来自恰好一次 GET 读回（重读不是重试，POST 计数仍为 1）。
   */
  | { kind: "already-decided-face"; face: FailureCopy; reloadList: true }
  /** ③超时后读回：票面已落定——以服务读回为准，成功侧呈现，不重发。 */
  | { kind: "readback-settled"; face: FailureCopy; reloadTicket: true; reloadList: true }
  /** ③超时后读回：票面没落定——结果未知交人工，不重发、不乐观放行。 */
  | { kind: "readback-pending"; copy: FailureCopy }
  /** ③连读回也没答成：结果未知如实说，给手动重读出口，不重发。 */
  | { kind: "readback-unreadable"; copy: FailureCopy };

/**
 * 提交一条决定并把服务答复分类成上述六种结局之一。POST 至多发一次；
 * 只有「结果未知」才发生恰好一次 GET 读回。此函数不摸 DOM、不起弹窗。
 */
export async function submitDecisionWithRecovery(
  id: string,
  verdict: Verdict,
  comment: string | undefined,
  deps: SubmitDeps,
): Promise<SubmitOutcome> {
  let payload: unknown;
  try {
    payload = await deps.post(id, verdict, comment);
  } catch (err) {
    const info = failureInfo(err);
    if (isUnknownOutcome(err, info)) {
      let back: ApprovalDetail | null = null;
      try {
        back = await deps.readBack(id);
      } catch {
        back = null; // 读回自身失败也是「没能读回」：不据此判定，也不据此重发。
      }
      if (back === null) return { kind: "readback-unreadable", copy: unreadableReadbackCopy() };
      if (back.status.settled) {
        return { kind: "readback-settled", face: settledReadbackCopy(back, verdict), reloadTicket: true, reloadList: true };
      }
      return { kind: "readback-pending", copy: pendingReadbackCopy(back) };
    }
    // 已知答复：逐码句走 writeFailure 单点。409 族在此分流——
    // · `approval.already_decided`＝服务已有票面 ⇒ 回填票面（成功侧），恰好一次
    //   GET 读回；读不回就不猜票面，退回逐码句。POST 计数恒 1（不重试）。
    // · 其余 409（如 key 复用且请求体不一致）＝人话冲突句、零读回（AP-05f 形制）。
    if (info.code === CODE_ALREADY_DECIDED) {
      let decided: ApprovalDetail | null = null;
      try {
        decided = await deps.readBack(id);
      } catch {
        decided = null; // 读回没答成＝票面给不出，不用猜测的票面冒充回填。
      }
      if (decided !== null) {
        return { kind: "already-decided-face", face: alreadyDecidedFaceCopy(decided, verdict, info.requestId), reloadList: true };
      }
    }
    return {
      kind: "failure",
      copy: writeFailure(err, verdict, info),
      reloadTicket: info.status === 409 || info.status === 404 || isWriteUnavailable(info.status),
      // AP-06 ①：过期与已决都改了队列的事实（单据不再是待处理）⇒ 触发列表重读；
      // 其余失败（含 503 服务不可用）不动队列读数，屏上保持服务上次给的样子。
      reloadList: info.code === CODE_EXPIRED || info.code === CODE_ALREADY_DECIDED,
    };
  }
  const ticket = approvalDetailFrom(payload);
  if (ticket !== null && ticket.status.settled) {
    return { kind: "replay", face: replayFaceCopy(ticket, verdict), reloadTicket: true, reloadList: true };
  }
  return { kind: "recorded", reloadTicket: true, reloadList: true };
}
