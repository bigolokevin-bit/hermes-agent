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
  /**
   * AP-06 ①：服务 `details` 的只读披露行（如 409 expired 的 `expiredFrom`）。
   * 只进「详情」折（states.tsx DetailsDisclosure），与 technical 同侧，永不上屏面。
   */
  detailLines?: string[];
}

/**
 * Info a failure copy needs: status plus the service's own envelope (AP-06 ①).
 * `code`/`details` 由 api.ts `failureInfo` 从响应体解析（信封平铺 `{code,
 * message, details?}`），这里只消费，不再自行解析一层。
 */
export interface FailureLike {
  status: number;
  requestId: string | null;
  technical: string | null;
  sentence?: string;
  code?: string | null;
  details?: Record<string, unknown> | null;
}

/**
 * A list/detail failure. 403 and 404 arrive here too, but the pages route them
 * to the denied panel before this copy is read.
 */
export function readFailure(err: unknown, info: FailureLike): FailureCopy {
  const { status } = info;
  const coded = negativeCodeSentence(info.code);
  let sentence: string;
  if (coded) sentence = coded;
  else if (status === 0) sentence = "连不上审批服务，请确认它已经启动，然后重试。";
  else if (status === 401) sentence = "登录状态已经失效，请刷新页面重新登录后再看。";
  else if (status === 429) sentence = "请求太频繁了，请稍等一会儿再试。";
  else if (status >= 500) sentence = "审批服务在处理时出了错，请稍后重试。";
  else sentence = humanSentence(errorMessage(err)) ?? "读取审批申请时出了问题，请稍后重试。";
  return { sentence, requestId: info.requestId, technical: info.technical, detailLines: expiredDetailLines(info.details) };
}

/* ------------------------------------------------------------------ *
 * AP-06 ① — ADR-0010 错误映射表的逐码专句（措辞单点，禁在页面/views 里分叉）。
 *
 * 形制真值（板仓只读核对，盘读 2026-11-24，实测为准）：
 * - BFF `apps/console/server.py` L216-230：`not_approver/already_decided/expired/
 *   service_unavailable` 保留透传；`not_found` ＋ consume 四码
 *   （`subject_mismatch/binding_invalid/already_consumed/not_approved`）折叠为
 *   404 `approval.unavailable` 并换掉整实体（`_UNAVAILABLE`）⇒ 浏览器只可能见到
 *   这一个码，所以折叠族在这里只有一句，五码同体不可分辨（④归主仓 pytest 腿）。
 * - 域侧码↔HTTP：`not_approver`=403（approvals.py:759/769/778 三支同码同体，
 *   形态非法也不教格式、不泄露存在性）；`expired`=409 且带 `details.expiredFrom`
 *   （approvals.py:962-967、L1019-1026）；`already_decided`=409（L792/L850）；
 *   `service_unavailable`=503（server 测试桩 conftest.py:729、stub_upstream.py:1076）。
 * - 信封平铺 `{code, message, details?}`（`services/domain/http_app.py:36-41`）；
 *   BFF `_error_code_of` L298-304 只认顶层 `code` ⇒ 前端 `api.ts:errorEnvelopeOf`
 *   同形制解析，不多猜一层。
 *
 * 句子纪律：①每码唯一、可执行、不含裸码与裸枚举（码只进 `technical`/详情折）；
 * ②「绝不乐观放行」——写腿每一句都说清决定没有生效，没有一句写成已提交；
 * ③`already_decided` 不配失败句：它是回填票面（AP-05f 的措辞单点，见
 * `alreadyDecidedFaceCopy`），把服务已有的票面当错误报是说谎两次。
 * ------------------------------------------------------------------ */

/** 403 非审批人：不自动改派，也不代投。 */
export const NOT_APPROVER_SENTENCE =
  "你不在该单审批人名单里，决定没有提交。这里不会自动改派给别人，也不会替你代投——需要处理时，请转给名单上的审批人。";
/** 409 过期：句子之外必触发列表重读（屏上以服务最新状态为准）。 */
export const EXPIRED_SENTENCE =
  "这张审批单已经过期，决定没有提交。列表已重新读取，屏上以服务给的最新状态为准。";
/** 404 折叠体：not_found 与 consume 四码共用这一句（服务也只给这一个码）。 */
export const UNAVAILABLE_SENTENCE =
  "未找到或无权查看这张单，决定没有提交。请刷新列表确认它的去向。";
/** 503 服务不可用：绝不乐观放行，不写成已提交，也不写成已处理。 */
export const SERVICE_UNAVAILABLE_SENTENCE =
  "审批服务不可用，请稍后重试。这次决定没有提交，这里也不会把它当作已处理。";

export const CODE_NOT_APPROVER = "approval.not_approver";
export const CODE_EXPIRED = "approval.expired";
export const CODE_ALREADY_DECIDED = "approval.already_decided";
export const CODE_UNAVAILABLE = "approval.unavailable";
export const CODE_SERVICE_UNAVAILABLE = "approval.service_unavailable";

/** 码 → 唯一句子；未收录的码返回 null，交状态码档兜底（不猜语义）。 */
export function negativeCodeSentence(code: string | null | undefined): string | null {
  switch (code) {
    case CODE_NOT_APPROVER:
      return NOT_APPROVER_SENTENCE;
    case CODE_EXPIRED:
      return EXPIRED_SENTENCE;
    case CODE_UNAVAILABLE:
      return UNAVAILABLE_SENTENCE;
    case CODE_SERVICE_UNAVAILABLE:
      return SERVICE_UNAVAILABLE_SENTENCE;
    default:
      return null;
  }
}

/**
 * `details.expiredFrom` 只进详情披露：服务给什么就披露什么（原值）；键缺失时
 * 明说「未随响应带回」，不给缺值补 0、不猜来源态。无 details 时返回 undefined
 * （没有这条腿可披露，不摆空行）。
 */
export function expiredDetailLines(details: Record<string, unknown> | null | undefined): string[] | undefined {
  if (!details) return undefined;
  const raw = details.expiredFrom;
  if (typeof raw === "string" && raw.trim()) {
    return [`到期来源态 expiredFrom=${raw.trim()}（服务响应 details 原值）`];
  }
  if (raw !== undefined) {
    return [`到期来源态 expiredFrom=${String(raw)}（服务响应 details 原值，非字符串）`];
  }
  return ["到期来源态 expiredFrom 未随响应带回，这里不猜。"];
}

/** A decision write failed. The ticket has NOT changed; nothing here pretends otherwise. */
export function writeFailure(err: unknown, verdict: "approve" | "reject", info: FailureLike): FailureCopy {
  const done = verdict === "approve" ? "批准" : "驳回";
  const { status } = info;
  if (info.sentence) {
    return { sentence: info.sentence, requestId: info.requestId, technical: info.technical };
  }
  // 逐码专句优先于状态码档：同一个 409 底下「过期」与「已决」是两件事，同一个
  // 403 底下 CSRF 拦截与非审批人也是两件事（CSRF 句已在上面短路走 sentence）。
  const coded = negativeCodeSentence(info.code);
  if (coded) {
    return {
      sentence: coded,
      requestId: info.requestId,
      technical: info.technical,
      detailLines: expiredDetailLines(info.details),
    };
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
 * 域判据（services/domain/approvals.py decide_approval，盘读 2026-11-24）：
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

/**
 * AP-06 ① 409 `approval.already_decided`＝回填票面，不是失败。
 *
 * 复用 AP-05f 的措辞单点（同一 `faceEntry`/`faceNode`/`TRAIL_FACE_RECORDED`），
 * 禁分叉第二套词汇。与 replayFaceCopy 的差别只有一处、且是必须的：这条答复
 * 来自服务说「这张单已经不是待决状态」，票未必是本人投的（域 approvals.py:792
 * `status != pending` ⇒ 409），所以**不认领投票人**，只回填读回的票面——
 * 「你已经投过票」在这里可能是假话，不写。
 *
 * requestId 用这次 409 响应头真取的 `X-Console-Request-Id`（②：失败往返也要能
 * 关联排障）；响应头没给就是 null，由 RequestIdCopyField 出「未记录编号」同形句。
 */
export function alreadyDecidedFaceCopy(
  detail: ApprovalDetail,
  verdict: "approve" | "reject",
  requestId: string | null,
): FailureCopy {
  const done = verdict === "approve" ? "批准" : "驳回";
  return {
    sentence: `这张单已经被处理过了，票面已有记录：${faceNode(faceEntry(detail, verdict))} · ${TRAIL_FACE_RECORDED}。你的${done}没有覆盖它，再次提交只会回到这同一张票面，不会产生第二票。`,
    requestId,
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
