/**
 * approvals data layer — T16 pending queue + T17 history (lane console-approvals).
 *
 * Every call goes to the console BFF over the same-origin proxy; nothing here is
 * mocked. Paths are the ones the repo itself names:
 *   list    `GET  /agent-api/api/approvals`        (`?status=&limit=&cursor=`)
 *   detail  `GET  /agent-api/api/approval?id=`     (web/src/shell/routes.ts row 7,
 *                                                    docs/_artifacts/D/T02-ENDPOINT-RECONCILIATION.md)
 *   records `GET  /agent-api/api/audit?resourceId=` — AP-03 处理记录腿，走审计
 *                                                    车道既有读口（见下方 AUDIT_LIST_PATH）
 *   decision `POST /agent-api/api/approval/decision?id=` — the BFF's single approval
 *   write route (`X-Console-Write: 1`, body `{verdict, comment?}`).
 *
 * The BFF forwards upstream shapes verbatim, so every field is read defensively:
 * an absent value stays absent (rendered `—` with a reason) and never becomes 0,
 * an empty string or a guessed name. See model.ts for the readers.
 */
import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { csrfFailureCopy, csrfWriteHeaders } from "@/lib/csrf";

import {
  approvalDetailFrom,
  approvalsPageFrom,
  employeeVersionRefsFrom,
  type ApprovalDetail,
  type ApprovalPage,
  type EmployeeVersionRef,
} from "./model";
import { auditPageFrom, type AuditPage } from "@/modules/audit/model";

export const LIST_PATH = "/agent-api/api/approvals";
export const DETAIL_PATH = "/agent-api/api/approval";
export const DECISION_PATH = "/agent-api/api/approval/decision";
/**
 * AP-02 ① 相邻版本核对腿——BFF 既有端点（apps/console/server.py:59 路由表，
 * 2026-11-23 实测 `?id=emp_…` → 200 items[5]），经 /agent-api 反代，零新增。
 */
export const EMPLOYEE_VERSIONS_PATH = "/agent-api/api/employee-versions";

/** The BFF's own cursor page size; kept explicit so both panes ask the same thing. */
export const PAGE_LIMIT = 50;

export type Verdict = "approve" | "reject";

function appendQuery(url: string, key: string, value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${key}=${encodeURIComponent(value)}`;
}

/**
 * The list request for one page. `status` is the eight-state filter of T17 and it
 * really is sent: the value lands in the query string, so the server — not the
 * browser — decides which rows come back. `null` asks for every state.
 */
export function listUrl(status: string | null, cursor: string | null, limit = PAGE_LIMIT): string {
  let url = LIST_PATH;
  url = appendQuery(url, "status", status);
  url = appendQuery(url, "limit", String(limit));
  url = appendQuery(url, "cursor", cursor);
  return url;
}

export function detailUrl(id: string): string {
  return appendQuery(DETAIL_PATH, "id", id);
}

export function decisionUrl(id: string): string {
  return appendQuery(DECISION_PATH, "id", id);
}

/** 相邻版本读口的请求形制：`?id=<员工号>&limit=50`（limit 透传，BFF 实测接受）。 */
export function employeeVersionsUrl(employeeId: string, limit = PAGE_LIMIT): string {
  let url = appendQuery(EMPLOYEE_VERSIONS_PATH, "id", employeeId);
  url = appendQuery(url, "limit", String(limit));
  return url;
}

/**
 * AP-03 ② 处理记录读腿。审计车道既有读口 GET /api/audit（modules/audit/api.ts
 * 的 LIST_PATH 同一路径），本模块只拼自己的 query、不改它的面。
 * 本机 2026-11-23 真登录腿实测（evidence/raw-audit-*.json，BFF 8092）：
 *   `?resourceId=ap_0C67930A766D4AA49E4B5B44EC&limit=50` → **200**，顶层
 *   keys=[events,limit,cursor,hasMore,total,totalSource]，3 行，行内带
 *   eventId/occurredAt/actor{type,id}/action/outcome；
 *   `?limit=50`（无过滤）→ **400** `console.missing_filter`（七个过滤键至少给
 *   一个），所以 resourceId 必带；
 *   无会话 cookie → **401** `console.unauthenticated`（带 X-Console-Request-Id）。
 * 行解析复用 `auditPageFrom`（单点），不在此另起一套审计行模型。
 */
export const AUDIT_LIST_PATH = "/agent-api/api/audit";
/** 一次读多少行：与审计面板同档（audit/api.ts PAGE_LIMIT），不新造尺寸。 */
export const RECORDS_LIMIT = 50;

export function auditResourceUrl(resourceId: string, limit = RECORDS_LIMIT): string {
  let url = appendQuery(AUDIT_LIST_PATH, "resourceId", resourceId);
  url = appendQuery(url, "limit", String(limit));
  return url;
}

/** null = 这一条读口没答成列表（失败/无权），屏上说「暂不可用」，不画空列表。 */
export async function fetchProcessingRecords(resourceId: string): Promise<AuditPage | null> {
  const payload = await fetchJSON<unknown>(auditResourceUrl(resourceId));
  return auditPageFrom(payload);
}

/** One page of the queue. `null` page = the answer is not a list at all (a failure). */
export async function fetchList(status: string | null, cursor: string | null): Promise<ApprovalPage | null> {
  const payload = await fetchJSON<unknown>(listUrl(status, cursor));
  return approvalsPageFrom(payload);
}

export async function fetchDetail(id: string): Promise<ApprovalDetail | null> {
  const payload = await fetchJSON<unknown>(detailUrl(id));
  return approvalDetailFrom(payload);
}

/**
 * AP-02 ① 版本链读取：只读、只在 employee_version_create 详情里被调用。
 * 返回 null = 读口没答成列表（失败/无权），屏上写「版本链未接」；
 * 空数组 = 真读了但没有可比版本。两者都不画 0、都不补造。
 */
export async function fetchVersionChain(employeeId: string): Promise<EmployeeVersionRef[] | null> {
  const payload = await fetchJSON<unknown>(employeeVersionsUrl(employeeId));
  return employeeVersionRefsFrom(payload);
}

/**
 * Records a decision. The BFF rejects a write without its anti-forgery header, so
 * the two headers it asks for are sent verbatim; the body carries nothing else —
 * an empty comment is omitted rather than sent as "".
 */
export async function postDecision(id: string, verdict: Verdict, comment?: string): Promise<unknown> {
  // CSRF double-submit: the session cookie echoes into X-Console-CSRF. No
  // cookie means no honest write — we stop here rather than eat a 403.
  const csrf = csrfWriteHeaders();
  if (!csrf) {
    throw new CsrfMissingError();
  }
  const body: Record<string, unknown> = { verdict };
  const note = comment?.trim();
  if (note) body.comment = note;
  return fetchJSON<unknown>(decisionUrl(id), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Console-Write": "1",
      ...csrf,
    },
    body: JSON.stringify(body),
  });
}

/** Raised before the network when the session cookie is absent. */
export class CsrfMissingError extends Error {
  constructor() {
    super("需要登录后才能提交。当前没有可用的写入会话，请先登录。");
    this.name = "CsrfMissingError";
  }
}

/**
 * AP-06 ① — the service's own error envelope, read the way the BFF reads it.
 *
 * 板仓只读核对（`apps/console/server.py`，2026-11-24）：
 * - `_error_code_of` L298-304 只认**顶层 `code` 字符串**；
 * - 域信封平铺 `{code, message, details?}`（`services/domain/http_app.py:36-41`，
 *   `details` 仅在有值时出现——409 `approval.expired` 带 `{expiredFrom}`，
 *   `services/domain/approvals.py:962-967`）；
 * - 保留透传族 `approval.not_approver|already_decided|expired|service_unavailable`
 *   （`PASSTHROUGH_ERROR_CODES` L216-221）＝上游码与体逐字转给浏览器；
 * - 折叠族 `approval.not_found` ＋ consume 四码（`FOLDED_ERROR_CODES` L223-228）
 *   ＝统一 404 `{"code":"approval.unavailable","message":"approval not found or
 *   not actionable"}`（`_UNAVAILABLE` L230、写腿 L1975-1977）。
 *
 * 码只用来选句子；它本身永远不上屏（裸码/裸枚举属工程值，见 copy.ts 单点句）。
 */
export interface ErrorEnvelope {
  code: string | null;
  details: Record<string, unknown> | null;
}

const NO_ENVELOPE: ErrorEnvelope = { code: null, details: null };

function textOf(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function errorEnvelopeOf(body: string | null | undefined): ErrorEnvelope {
  if (!body) return NO_ENVELOPE;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return NO_ENVELOPE; // 非 JSON（代理 HTML 页等）：没有码可认，走状态码句。
  }
  const rec = recordOf(parsed);
  if (!rec) return NO_ENVELOPE;
  // 平铺信封是真形制；`detail` 嵌套只作兼容腿（csrf.ts 同款容忍），不改判据。
  const nested = recordOf(rec.detail);
  const code = textOf(rec.code) ?? textOf(nested?.code);
  const details = recordOf(rec.details) ?? recordOf(nested?.details);
  if (code === null && details === null) return NO_ENVELOPE;
  return { code, details };
}

/** Status + trace id of a failure, for the panels that have to speak to a person. */
export interface FailureInfo {
  status: number;
  requestId: string | null;
  /** Plain-Chinese override for CSRF-style 403s; panels show it verbatim. */
  sentence?: string;
  /** Raw multi-line detail — for the 「详情」 disclosure only, never on the surface. */
  technical: string | null;
  /** AP-06 ①：服务错误信封的码（`approval.*` 等），选句子用，不上屏。 */
  code?: string | null;
  /** AP-06 ①：信封 `details`（如 409 expired 的 `expiredFrom`），只进详情披露。 */
  details?: Record<string, unknown> | null;
}

export function failureInfo(err: unknown): FailureInfo {
  if (err instanceof CsrfMissingError) {
    return { status: -1, requestId: null, technical: null, sentence: err.message, code: null, details: null };
  }
  if (err instanceof ApiError) {
    const envelope = errorEnvelopeOf(err.body);
    const csrfCopy = csrfFailureCopy(err.status, err.body, err.requestId);
    if (csrfCopy) {
      return {
        status: err.status,
        requestId: csrfCopy.requestId,
        technical: err.details,
        sentence: csrfCopy.sentence,
        code: envelope.code,
        details: envelope.details,
      };
    }
    return {
      status: err.status,
      requestId: err.requestId ?? null,
      technical: err.details,
      code: envelope.code,
      details: envelope.details,
    };
  }
  return { status: -1, requestId: null, technical: err instanceof Error ? err.message : String(err), code: null, details: null };
}

/** 403 and 404 are one and the same body: both mean "this is not reachable for you". */
export function isDenied(status: number): boolean {
  return status === 403 || status === 404;
}

/** 405/501 = the write route is not open in this deployment: a degradation, not a bug. */
export function isWriteUnavailable(status: number): boolean {
  return status === 405 || status === 501;
}

/**
 * AP-05 ③ 判据：这条失败是否属于「结果未知」——请求已出网、答复没拿到
 * （0=连不上/超时，-1=传输层异常）。`CsrfMissingError` 是唯一例外：它拦在
 * 网络之前，决定确定没有送出，不算未知。服务答了话的失败（4xx/5xx）都是
 * 已知结果，走既有 writeFailure 逐码句，不进读回腿。
 */
export function isUnknownOutcome(err: unknown, info: FailureInfo): boolean {
  if (err instanceof CsrfMissingError) return false;
  return info.status === 0 || info.status === -1;
}

/**
 * AP-05 ③：结果未知后的唯一后继——恰好一次 GET 读回票面（同一个详情读口
 * `/api/approval?id=`，看 status/decisions 再决定；deep/03 §3.4 口径）。
 * 本函数只读不写；submitDecisionWithRecovery 的每个未知分支只调它一次、
 * 绝不重发 POST（approvals.idempotency.test.tsx 以请求计数钉死第二 POST 不发生）。
 */
export async function readBackDecisionTicket(id: string): Promise<ApprovalDetail | null> {
  return fetchDetail(id);
}

/* ------------------------------------------------------------------ *
 * AP-04 ② — 服务端写能力探测腿（读侧方法，永不发写）。
 *
 * 判据只准来自写路由自己的确定性答复，禁「猜测成功」：
 *   405 + console.read_only（Allow: GET, HEAD）⇒ closed：写路由在本部署没注册
 *     （AP-06 实测 2026-11-24 01:08，raw-decision-route-options 存证）；
 *   401 ⇒ unauthenticated：会话没建立，能力面读不到，按关处理；
 *   403 + `approval.*` 专码 ⇒ open-denied：只有注册过的写路由才会答出授权层码；
 *   其余一律 unknown——含 2xx OPTIONS（浏览器侧代理层可能替源站应答 CORS 探测，
 *   那种 200 是别人的答复，不是写路由在场，绝不据此判开）、超时、断连、502、
 *   非 approval.* 的 403（CSRF 闸拦截说明不了名单）。
 * unknown/unauthenticated/closed 在门控里全部按「关」处理（工单②：探测失败/超时
 * =按关处理，保守）。探测只用 OPTIONS：GET 带 id 会落到详情语义、POST 是写真尝试，
 * 都不许出现在这条腿上。
 *
 * 形制注记：本腿走原始 fetch（要的是状态码+Allow+顶层码这三件确定事实，
 * fetchJSON 在 4xx 上抛结构化错、丢 Allow 头，判据就没了）。凭据口径与读口一致：
 * 只随 cookie（credentials include）＋ 网关注入的会话 token 头，内部服务凭据
 * 不出浏览器、不手写 Authorization。反代前缀部署（__HERMES_BASE_PATH__ 非空）下
 * 相对路径会打到前缀外的口 ⇒ 答复非确定 ⇒ unknown ⇒ 按关，保守且诚实。
 * ------------------------------------------------------------------ */

export const PROBE_METHOD = "OPTIONS";
export const PROBE_TIMEOUT_MS = 8000;
/** 探测来源句——页头 chip 与 DONE 里写「这个判断来自哪里」的唯一点。 */
export const PROBE_SOURCE = `${PROBE_METHOD} ${DECISION_PATH}`;

export type ProbeVerdict = "closed" | "unauthenticated" | "open-denied" | "unknown";

export interface WriteProbeEvidence {
  verdict: ProbeVerdict;
  /** 真答复的状态码；null = 没拿到答复（超时/断连/探测腿不可达）。 */
  status: number | null;
  /** 响应体顶层 code（判据用，永不上屏）。 */
  code: string | null;
  /** 采集时刻（毫秒）。只有真拿到答复才算采集；null = 未采集，屏上「—」。 */
  observedAt: number | null;
  /** 探测来源（method + path），失败腿也带上——说清试过的是哪张嘴。 */
  source: string;
}

/** 纯分类器：确定性答复 → verdict。除下表三行外全部 unknown（保守，不猜开）。 */
export function classifyProbeResponse(status: number, code: string | null): ProbeVerdict {
  if (status === 405 && code === "console.read_only") return "closed";
  if (status === 401) return "unauthenticated";
  if (status === 403 && code !== null && code.startsWith("approval.")) return "open-denied";
  return "unknown";
}

export async function probeWriteDecisionRoute(): Promise<WriteProbeEvidence> {
  const startedAt = Date.now();
  const failed = (): WriteProbeEvidence => ({
    verdict: "unknown",
    status: null,
    code: null,
    observedAt: null,
    source: PROBE_SOURCE,
  });
  if (typeof fetch !== "function") return failed();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const headers = new Headers();
    const token = typeof window === "undefined" ? undefined : window.__HERMES_SESSION_TOKEN__;
    if (token) headers.set("X-Hermes-Session-Token", token);
    const res = await fetch(DECISION_PATH, {
      method: PROBE_METHOD,
      headers,
      credentials: "include",
      mode: "same-origin",
      signal: controller.signal,
    });
    const body = await res.text().catch(() => null);
    const code = errorEnvelopeOf(body).code;
    const verdict = classifyProbeResponse(res.status, code);
    return {
      verdict,
      status: res.status,
      code,
      // 采集时刻只随可依赖的答复落笔：502/替答等 unknown 腿虽有时间，但那个时刻
      // 没有采到开关事实——记成时刻会误导「这秒读数可信」，屏上仍「—」＋原因。
      observedAt: verdict === "unknown" ? null : startedAt,
      source: PROBE_SOURCE,
    };
  } catch {
    // 超时/断连/jsdom 相对 URL 腿都收敛在这：unknown、无时刻——不拿尝试时间冒充采集。
    return failed();
  } finally {
    clearTimeout(timer);
  }
}
