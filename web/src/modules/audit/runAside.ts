/**
 * AU-07 — the 「这次运行」 card in the audit record pane's right rail.
 *
 * An audit event that names a run (the 运行 row of `detail.links`, decided by
 * the SAME table as AU-01's chain block — no second parse of the raw answer)
 * can say more than a link: the run's own read answers who ran it, when it
 * started and ended, how much it really cost, and how it ended. This module
 * reads `GET /agent-api/api/run-detail?id=` (BFF R2 leg, already on the wire)
 * and normalizes ONLY what the card prints — missing values stay null and say
 * 「该字段未返回」, never a dash-as-zero, never a computed guess.
 *
 * Honest-states doctrine (design deep/04-runs.md §3.9, verbatim families):
 *  - 403 and 404 print ONE identical sentence: 「运行不存在或你无权访问」 — the
 *    contract says run.not_found answers 404 not 403, and a cross-tenant id
 *    must never be split into a "permission" leak (AGENTRUN §3);
 *  - BFF unrouted (`console.unknown_route`) is 「该功能尚未接入」, distinct
 *    words, no retry promise (G-05 discipline);
 *  - everything else: 人话 + copyable 请求编号 + 重试 (AU-04 RequestIdLine).
 *
 * The footer way out is NOT built here: `runChainOf` (contextLinks.ts) owns the
 * one `/runs?run=` href for this record, and this card asks it — an aside must
 * not invent a second truth about where the run page is.
 */
import { ApiError } from "@/lib/api-error";
import { AUDJ_TIME_MISSING } from "./timeActor";

export const RUN_DETAIL_PATH = "/agent-api/api/run-detail";

export function runDetailUrl(runId: string): string {
  return `${RUN_DETAIL_PATH}?id=${encodeURIComponent(runId)}`;
}

/** 卡上六项，全部来自读口原值；null=未返回，不猜。 */
export interface RunAside {
  runId: string;
  status: string | null;
  employeeId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  costUsd: number | null;
}

export function normalizeRunAside(v: unknown): RunAside | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const inner = (r.run ?? r.detail) && typeof (r.run ?? r.detail) === "object"
    ? ((r.run ?? r.detail) as Record<string, unknown>)
    : r;
  const s = (key: string): string | null => {
    const value = inner[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };
  const runId = s("runId") ?? s("id");
  if (!runId) return null; // no identity, no card — never a half-invented one
  const cost = inner.costUsd;
  return {
    runId,
    status: s("status"),
    employeeId: s("employeeId"),
    startedAt: s("startedAt"),
    endedAt: s("endedAt"),
    costUsd: typeof cost === "number" && Number.isFinite(cost) ? cost : null,
  };
}

/** 状态四词表封闭（OM-07 同谱系）：缺值「—」，表外值原样上不换写。 */
export const RUN_STATUS_WORDS: Record<string, string> = {
  succeeded: "成功",
  failed: "失败",
  running: "运行中",
  queued: "排队中",
};
export function runStatusWord(status: string | null): string {
  if (!status) return "—";
  return RUN_STATUS_WORDS[status.toLowerCase()] ?? status;
}

export interface RunAsideFailure {
  text: string;
  requestId: string | null;
}

/** 失败族→人话；403/404 同体（不泄露存在性），unknown_route 说未接入且不重试。 */
export function runAsideFailureOf(err: unknown): RunAsideFailure {
  const status = err instanceof ApiError ? err.status : 0;
  const requestId = err instanceof ApiError ? err.requestId ?? null : null;
  let code: string | null = null;
  if (err instanceof ApiError) {
    try {
      code = (JSON.parse(err.body) as { code?: string }).code ?? null;
    } catch {
      code = null;
    }
  }
  if (code === "console.unknown_route") {
    return { text: "运行详情的读口在这个环境尚未接入，这张卡不出结论也不重试。", requestId };
  }
  if (code === "console.unauthenticated" || status === 401) {
    return { text: "登录状态没有带到这一问。刷新页面重新登录后再看这一条运行。", requestId };
  }
  // 403 and 404: one body. 契约同体（run.not_found 用 404），权限话术会把
  // 「存在但你看不见」泄露成另一个答案。
  if (status === 403 || status === 404 || code === "run.not_found") {
    return { text: "运行不存在或你无权访问这一条。", requestId };
  }
  if (status === 0) {
    return { text: "这一问没有到达运行服务（网络或本机通道问题）。", requestId };
  }
  return { text: `运行详情此刻没有回答（HTTP ${status}）。可以重试；引用请求编号反馈。`, requestId };
}

/** 成本只认读口实值；null=未返回，真 0 显 $0.00（两态字面必须不同）。 */
export function runCostWord(costUsd: number | null): string {
  if (costUsd === null) return AUDJ_TIME_MISSING;
  return `$${costUsd.toFixed(2)}`;
}
