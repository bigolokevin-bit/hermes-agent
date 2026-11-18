/**
 * approvals failure copy — one sentence a person can act on, plus the trace id.
 *
 * The surface never shows an HTTP code, a wire field name or a raw body: those
 * live in `technical`, which only the 「详情」 disclosure and `title` attributes
 * carry. A missing request id stays 「未提供」 — it is never invented.
 */
import { errorMessage } from "@/lib/api-error";
import { humanSentence } from "./model";

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
  info: { status: number; requestId: string | null; technical: string | null },
): FailureCopy {
  const done = verdict === "approve" ? "批准" : "驳回";
  const { status } = info;
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

/** The request-id line, shared by every panel so the wording never drifts. */
export const requestIdLine = (id: string | null): string => `请求编号：${id ?? "未提供"}`;
