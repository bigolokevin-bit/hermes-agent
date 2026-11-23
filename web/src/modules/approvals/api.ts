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

/** Status + trace id of a failure, for the panels that have to speak to a person. */
export interface FailureInfo {
  status: number;
  requestId: string | null;
  /** Plain-Chinese override for CSRF-style 403s; panels show it verbatim. */
  sentence?: string;
  /** Raw multi-line detail — for the 「详情」 disclosure only, never on the surface. */
  technical: string | null;
}

export function failureInfo(err: unknown): FailureInfo {
  if (err instanceof CsrfMissingError) {
    return { status: -1, requestId: null, technical: null, sentence: err.message };
  }
  if (err instanceof ApiError) {
    const csrfCopy = csrfFailureCopy(err.status, err.body, err.requestId);
    if (csrfCopy) {
      return { status: err.status, requestId: csrfCopy.requestId, technical: err.details, sentence: csrfCopy.sentence };
    }
    return { status: err.status, requestId: err.requestId ?? null, technical: err.details };
  }
  return { status: -1, requestId: null, technical: err instanceof Error ? err.message : String(err) };
}

/** 403 and 404 are one and the same body: both mean "this is not reachable for you". */
export function isDenied(status: number): boolean {
  return status === 403 || status === 404;
}

/** 405/501 = the write route is not open in this deployment: a degradation, not a bug. */
export function isWriteUnavailable(status: number): boolean {
  return status === 405 || status === 501;
}
