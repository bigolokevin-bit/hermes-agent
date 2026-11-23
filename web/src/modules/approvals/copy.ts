/**
 * approvals failure copy — one sentence a person can act on, plus the trace id.
 *
 * The surface never shows an HTTP code, a wire field name or a raw body: those
 * live in `technical`, which only the 「详情」 disclosure and `title` attributes
 * carry. A missing request id names the fallback action — it is never invented.
 */
import { errorMessage } from "@/lib/api-error";
import { isDenied } from "./api";
import { humanSentence, type ApprovalDetail } from "./model";

export interface FailureCopy {
  /** What the panel says. */
  sentence: string;
  /** `ApiError.requestId`, or null when the answer carried none. */
  requestId: string | null;
  /** Multi-line technical text for the disclosure only. */
  technical: string | null;
}

/**
 * A list/detail failure. 403 and 404 arrive here too, but the pages route them
 * to the denied panel before this copy is read.
 */
export function readFailure(err: unknown, info: { status: number; requestId: string | null; technical: string | null }): FailureCopy {
  const { status } = info;
  let sentence: string;
  if (status === 0) sentence = "连不上审批服务，请确认它已经启动，然后重试。";
  else if (status === 401) sentence = "登录状态已经失效，请刷新页面重新登录后再看。";
  else if (status === 429) sentence = "请求太频繁了，请稍等一会儿再试。";
  else if (status >= 500) sentence = "审批服务在处理时出了错，请稍后重试。";
  else sentence = humanSentence(errorMessage(err)) ?? "读取审批申请时出了问题，请稍后重试。";
  return { sentence, requestId: info.requestId, technical: info.technical };
}

/** A decision write failed. The ticket has NOT changed; nothing here pretends otherwise. */
export function writeFailure(
  err: unknown,
  verdict: "approve" | "reject",
  info: { status: number; requestId: string | null; technical: string | null; sentence?: string },
): FailureCopy {
  const done = verdict === "approve" ? "批准" : "驳回";
  const { status } = info;
  if (info.sentence) {
    return { sentence: info.sentence, requestId: info.requestId, technical: info.technical };
  }
  let sentence: string;
  if (status === 0) sentence = `连不上审批服务，这次${done}没有提交成功。请确认它已启动后重试。`;
  else if (status === 401) sentence = "登录状态已经失效，请重新登录后再提交决定。";
  else if (status === 403) sentence = "这张单据不归你审批，决定没有提交。需要别人处理时，请转给名单上的审批人。";
  else if (status === 404) sentence = "这张单据已经找不到了，决定没有提交。请刷新列表确认它的去向。";
  else if (status === 405 || status === 501) sentence = "这套环境还没有开放审批写入，决定没有提交。请让管理员开通后再试。";
  else if (status === 409) sentence = `这张单据已经被处理过了，你的${done}没有覆盖它。刷新后能看到最新结果。`;
  else if (status === 429) sentence = "请求太频繁了，请稍等一会儿再提交。";
  else if (status >= 500) sentence = `审批服务在处理这次${done}时出了错，决定没有生效。请稍后重试。`;
  else sentence = humanSentence(errorMessage(err)) ?? `这次${done}没有提交成功，请稍后重试。`;
  return { sentence, requestId: info.requestId, technical: info.technical };
}

/** The request-id line, shared by every panel so the wording never drifts.
 * QA V4-R4 条目5: a missing id names the fallback action instead of 「未提供」. */
export const requestIdLine = (id: string | null): string =>
  id ? `请求编号：${id}` : "本次请求未记录编号，可复制时间与操作路径反馈";

/* ------------------------------------------------------------------ *
 * AP-03 ①② — 时间线与「处理记录」的单点句。
 * 屏上、复制文本、title 三处都引用这里的常量，禁在 views 里字面量分叉。
 * 回填票面（already_decided 族的服务答复）不是失败：措辞里不出现
 * 「失败/出错/没能」，只说这张票已在单上。
 * ------------------------------------------------------------------ */

/** 已结束单据的票面标注（DOM 与 apd8 链路文本同值同位）。 */
export const TRAIL_FACE_RECORDED = "票面已记录";

/** 处理记录段的首句——这一段是手动读取，不是轮询（GAP-APR-11 无状态读口）。 */
export const RECORDS_IDLE_SENTENCE = "处理记录未读取";
/** 读取中的过程句（不摆空列表、不摆骨架行）。 */
export const RECORDS_LOADING_SENTENCE = "处理记录读取中。";
/** 真读回 0 行——「没有记录」与「读不到」是两句话，不许互相冒充。 */
export const RECORDS_EMPTY_SENTENCE = "这条单没有带回处理记录（审计读口本次答 0 行）。";
/** 403/401/404/5xx/网络失败共用的首句。 */
export const RECORDS_UNAVAILABLE_SENTENCE = "处理记录暂不可用";
/** 无权限档（403/404 同体）的正文句。 */
export const RECORDS_DENIED_SENTENCE = "审计台账对这条单没有开放，这里不显示任何猜测的记录。";

/**
 * 失败档的正文句：只说这一条读口的实情，不带审批主链路的词。
 * 请求编号另由可复制载体给出，缺号时明说「未记录编号」。
 */
export function recordsFailureSentence(status: number): string {
  if (status === 0) return "连不上审计读口，请确认服务已启动后重新读取。";
  if (status === 401) return "登录状态没有带上这条读取，请重新登录后再读取一次。";
  if (isDenied(status)) return RECORDS_DENIED_SENTENCE;
  if (status === 400) return "这条读取没被审计读口接受（它要求至少一个过滤条件），请重新读取一次。";
  if (status >= 500) return "审计服务在处理这条读取时出了错，请稍后重新读取。";
  return "审计读口这次没有答成，处理记录保持未读取。";
}

/* ------------------------------------------------------------------ *
 * AP-05 ②③ — 提交结果的「回填票面」与「结果未知」句（单点措辞）。
 *
 * 域口径（services/domain/approvals.py decide_approval，盘读 2026-11-24）：
 * 幂等键＝(approval_id, user_id)；同键重放（含双击）答 200 并带回整张票面，
 * 这些分支是成功侧——措辞不出现「失败/出错/没能」，票面节点沿用 DecisionTrail
 * 的「who · 结论 · 时间 · 意见」形制与 TRAIL_FACE_RECORDED 标注。
 * 200+票面已落定 ⇒ 该键的票必在单上（fresh 记票、重放认票、并发认票三条 200
 * 路径都以「本票已在 decisions[]」为前提），「你已经投过票」为真话；
 * 超时读回落定 ⇒ 不认领是谁投的，只报读回票面。
 * ------------------------------------------------------------------ */

/** 票面节点取法：优先与本次 verdict 同向的最后一张票，取不到落票面末张。 */
function faceEntry(detail: ApprovalDetail, verdict: "approve" | "reject") {
  const mine = detail.decisions.filter((e) => e.verdictRaw?.trim().toLowerCase() === verdict);
  return mine.length > 0 ? mine[mine.length - 1] : detail.decisions[detail.decisions.length - 1] ?? null;
}

const faceNode = (entry: { verdict: string; at: string | null; note: string | null } | null): string =>
  entry === null
    ? "票面节点未随响应带回，读回后以决策链路为准"
    : `${entry.verdict} · ${entry.at ?? "该字段未返回"} · 意见：${entry.note ?? "未填"}`;

/**
 * ②同键重放/双击的票面回填句（成功侧）。requestId 恒 null：这条答复
 * 本身是 200，没有失败请求号可报，不编一个。
 */
export function replayFaceCopy(detail: ApprovalDetail, verdict: "approve" | "reject"): FailureCopy {
  return {
    sentence: `你已经投过票：${faceNode(faceEntry(detail, verdict))} · ${TRAIL_FACE_RECORDED}。再次提交只会回到这同一张票面，不会产生第二票。`,
    requestId: null,
    technical: detail.status.raw ? `票面状态原值：${detail.status.raw}` : null,
  };
}

/** ③读回后票面已落定：以读回为准，不认领投票人，不重发。 */
export function settledReadbackCopy(detail: ApprovalDetail, verdict: "approve" | "reject"): FailureCopy {
  return {
    sentence: `这次提交没等到回执，读回的票面显示这张单已落定为「${detail.status.label}」：票面 ${faceNode(faceEntry(detail, verdict))}。以服务读回的票面为准，这里不自动重发决定。`,
    requestId: null,
    technical: detail.status.raw ? `票面状态原值：${detail.status.raw}` : null,
  };
}

/** ③读回后票面没有落定结论：这条票记没记上确认不了，交人工，不自动重发。 */
export function pendingReadbackCopy(detail: ApprovalDetail): FailureCopy {
  return {
    sentence: `这次提交没等到回执；读回的票面没有显示这张单已落定（状态读数「${detail.status.label}」）。你的决定是否记上无法从票面确认——这里不会自动重发，请人工核对这张单后再决定是否再投。`,
    requestId: null,
    technical: detail.status.raw ? `票面状态原值：${detail.status.raw}` : null,
  };
}

/** ③连读回也没答成：结果未知，给手动重读出口，不自动重发。 */
export function unreadableReadbackCopy(): FailureCopy {
  return {
    sentence: "这次提交没等到回执，票面也没能读回：结果未知。这里不会自动重发决定；请稍后用「重新读取这张单」确认它的真实状态。",
    requestId: null,
    technical: null,
  };
}
