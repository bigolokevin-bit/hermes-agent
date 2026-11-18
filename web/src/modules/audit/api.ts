/**
 * audit data layer — T33 事件列表 / 单条详情 / 时间窗完整性校验 (lane console-approvals).
 *
 * Every call goes to the console BFF over the same-origin proxy; nothing here is
 * mocked and the `/api/` segment is part of the route (the shell's own proxy
 * table only forwards `/agent-api/api/…`). Paths as the task names them:
 *   list    `GET /agent-api/api/audit`                 (`?limit=&cursor=`)
 *   detail  `GET /agent-api/api/audit/detail?id=`
 *   verify  `GET /agent-api/api/audit/verify?from=&to=`
 *
 * RECONCILIATION NOTE (recorded in docs/_artifacts/appr/DONE.md §T33-7): this
 * repo's BFF route table (`docs/_artifacts/D/T02-ENDPOINT-RECONCILIATION.md:16`)
 * lists the same three as `/api/audit*` and `/api/audit-verify`, and says
 * `/api/audit` is gated by `require_any` (one of seven filters). The task's
 * spelling is used here verbatim; a route that does not exist answers 404, and
 * the pages show that as 不可用 / 本环境未启用 with the request id — never a
 * guessed row.
 *
 * The BFF forwards upstream shapes verbatim, so every field is read defensively
 * in model.ts: an absent value stays absent (rendered `—` with a reason) and
 * never becomes 0, an empty string, or a guessed name.
 */
import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";

import { auditDetailFrom, auditPageFrom, verifyResultFrom, type AuditDetail, type AuditPage, type VerifyResult } from "./model";

export const LIST_PATH = "/agent-api/api/audit";
export const DETAIL_PATH = "/agent-api/api/audit/detail";
export const VERIFY_PATH = "/agent-api/api/audit/verify";

/** The BFF's own cursor page size; kept explicit so both panes ask the same thing. */
export const PAGE_LIMIT = 50;

function appendQuery(url: string, key: string, value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${key}=${encodeURIComponent(value)}`;
}

/**
 * One page of the ledger. `cursor` is the opaque value the previous answer
 * carried; without it the request asks for the newest page only. `limit` is
 * always sent so the denominator on screen matches what was asked for.
 */
export function listUrl(cursor: string | null = null, limit = PAGE_LIMIT): string {
  let url = LIST_PATH;
  url = appendQuery(url, "limit", String(limit));
  url = appendQuery(url, "cursor", cursor);
  return url;
}

export function detailUrl(id: string): string {
  return appendQuery(DETAIL_PATH, "id", id);
}

/**
 * The window chain verify. Both bounds are ISO instants on the wire; neither
 * reaches the screen — the page shows them as Beijing wall clock. `null` drops
 * the parameter instead of inventing a bound.
 */
export function verifyUrl(from: string | null, to: string | null): string {
  let url = VERIFY_PATH;
  url = appendQuery(url, "from", from);
  url = appendQuery(url, "to", to);
  return url;
}

/** One page of events. `null` page = the answer is not a list at all (a failure). */
export async function fetchList(cursor: string | null): Promise<AuditPage | null> {
  const payload = await fetchJSON<unknown>(listUrl(cursor));
  return auditPageFrom(payload);
}

export async function fetchDetail(id: string): Promise<AuditDetail | null> {
  const payload = await fetchJSON<unknown>(detailUrl(id));
  return auditDetailFrom(payload);
}

/**
 * Runs the window verify. A payload that is not shaped like an answer is a
 * failure, not a green result: the caller gets `null` and says so.
 */
export async function fetchVerify(from: string | null, to: string | null): Promise<VerifyResult | null> {
  const payload = await fetchJSON<unknown>(verifyUrl(from, to));
  return verifyResultFrom(payload);
}

/** Status + trace id of a failure, for the panels that have to speak to a person. */
export interface FailureInfo {
  status: number;
  requestId: string | null;
  /** Raw multi-line detail — for the 「详情」 disclosure only, never on the surface. */
  technical: string | null;
}

export function failureInfo(err: unknown): FailureInfo {
  if (err instanceof ApiError) {
    return { status: err.status, requestId: err.requestId ?? null, technical: err.details };
  }
  return { status: -1, requestId: null, technical: err instanceof Error ? err.message : String(err) };
}

/** 403 and 404 are one and the same body: both mean "this is not reachable for you". */
export function isDenied(status: number): boolean {
  return status === 403 || status === 404;
}

/**
 * A verify call that cannot run in this deployment: 403/404 (not reachable for
 * you), 405/501 (capability not enabled), 0 (service unreachable) and any 5xx
 * (the chain service behind the BFF did not answer). Each of these becomes
 * 「本环境未启用」 with the named reason — never a guessed pass.
 */
export function isVerifyUnavailable(status: number): boolean {
  return status === 403 || status === 404 || status === 405 || status === 501 || status === 0 || status >= 500;
}
