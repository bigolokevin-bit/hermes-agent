/**
 * audit failure copy — one sentence a person can act on, plus the trace id.
 *
 * The surface never shows an HTTP code, a wire field name or a raw body: those
 * live in `technical`, which only the 「详情」/「技术详情」 disclosure and `title`
 * attributes carry. A missing request id stays 「未提供」 — it is never invented.
 *
 * The verify panel has one more rule than the list: a check that could not run
 * says 「本环境未启用」 and names why. It never borrows the wording of a check
 * that ran and found nothing, because an unrun check has no result.
 */
import { isVerifyUnavailable } from "./api";
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
  if (status === 0) sentence = "连不上审计服务，请确认它已经启动，然后重试。";
  else if (status === 400) sentence = "这次读取缺一个服务端要求的筛选条件，没能返回记录。请换个时间范围或筛选条件再试。";
  else if (status === 401) sentence = "登录状态已经失效，请刷新页面重新登录后再看。";
  else if (status === 429) sentence = "请求太频繁了，请稍等一会儿再试。";
  else if (status >= 500) sentence = "审计服务在处理时出了错，请稍后重试。";
  else sentence = humanSentence(errorMessage(err)) ?? "读取审计事件时出了问题，请稍后重试。";
  return { sentence, requestId: info.requestId, technical: info.technical };
}

/** The answer arrived but is not shaped like a list: a failure, not an empty ledger. */
export function shapeFailure(): FailureCopy {
  return {
    sentence: "服务回的内容不是一份审计记录，这里没能读出任何事件。",
    requestId: null,
    technical: "unexpected payload shape",
  };
}

/** Same, for the single-record answer. */
export function detailShapeFailure(): FailureCopy {
  return {
    sentence: "服务回的内容不是一条审计记录，这条事件的详情没能读出来。",
    requestId: null,
    technical: "unexpected payload shape",
  };
}

/**
 * Why the window check could not run, in words. The status decides the sentence;
 * the number itself never reaches the screen.
 */
export function verifyUnavailableReason(status: number): string {
  if (status === 403 || status === 404) return "这套环境没有提供完整性校验，或者它还没有对你开放。";
  if (status === 405 || status === 501) return "完整性校验这条路在本套环境里尚未开通，需要管理员启用后才能运行。";
  if (status === 401) return "登录状态已经失效，重新登录后才能运行校验。";
  if (status === 400) return "服务端没有接受这个时间窗，校验没有运行。请把窗口放宽一格再试一次。";
  if (status === 0) return "连不上审计服务，校验没有运行。";
  if (status >= 500) return "校验需要的那个服务此刻连不上，没有结果。";
  return "服务端没有返回可用的校验结果，校验没有运行。";
}

export interface VerifyFailure extends FailureCopy {
  /** True when the panel must read 「本环境未启用」 instead of a green/wrong result. */
  unavailable: boolean;
}

/** A verify call that failed: unavailable for the nameable cases, plain error otherwise. */
export function verifyFailure(err: unknown, info: { status: number; requestId: string | null; technical: string | null }): VerifyFailure {
  const base = readFailure(err, info);
  const unavailable = isVerifyUnavailable(info.status);
  const sentence = unavailable ? verifyUnavailableReason(info.status) : base.sentence;
  return { sentence, requestId: info.requestId, technical: info.technical, unavailable };
}

/** The request-id line, shared by every panel so the wording never drifts. */
export const requestIdLine = (id: string | null): string => `请求编号：${id ?? "未提供"}`;
