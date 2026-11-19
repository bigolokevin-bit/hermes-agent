/**
 * audit data layer — T33 事件列表 / 单条详情 / 时间窗完整性校验 (lane console-approvals).
 *
 * Every call goes to the console BFF over the same-origin proxy; nothing here is
 * mocked and the `/api/` segment is part of the route (the shell's own proxy
 * table only forwards `/agent-api/api/…`). Paths as PROBED LIVE 2026-11-19 on
 * the console dev server (127.0.0.1:9122, authenticated session — full table
 * in docs/_artifacts/aud/DONE.md «TASK audit closeout»):
 *   list    `GET /agent-api/api/audit`                 (`?limit=&cursor=`)   200
 *   detail  `GET /agent-api/api/audit-detail?id=`                            200
 *           (`/api/audit/detail?id=` is 404 `console.unknown_route` — removed)
 *   verify  `GET /agent-api/api/audit-verify?from=&to=`                      200
 *           (`/api/audit/verify` is 404 `console.unknown_route` — removed)
 *
 * RECONCILIATION NOTE (recorded in docs/_artifacts/appr/DONE.md §T33-7 and
 * settled by the live probe): the BFF route table
 * (`docs/_artifacts/D/T02-ENDPOINT-RECONCILIATION.md:16`) lists the three as
 * `/api/audit*` and `/api/audit-verify`, and `/api/audit` really is gated by
 * `require_any` — the 400 body names the seven: `runId taskId actorId
 * resourceId action from to`. A list read with only `limit` answers 400
 * `console.missing_filter`, so the pages always carry a bounded window.
 * Routes that do not exist answer 404, and the pages show that as 不可用 /
 * 本环境未启用 with the request id — never a guessed row.
 *
 * The BFF forwards upstream shapes verbatim, so every field is read defensively
 * in model.ts: an absent value stays absent (rendered `—` with a reason) and
 * never becomes 0, an empty string, or a guessed name.
 */
import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";

import { auditDetailFrom, auditPageFrom, verifyResultFrom, type AuditDetail, type AuditPage, type VerifyResult } from "./model";

export const LIST_PATH = "/agent-api/api/audit";
export const DETAIL_PATH = "/agent-api/api/audit-detail";
export const VERIFY_PATH = "/agent-api/api/audit-verify";

/** The BFF's own cursor page size; kept explicit so both panes ask the same thing. */
export const PAGE_LIMIT = 50;

function appendQuery(url: string, key: string, value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${key}=${encodeURIComponent(value)}`;
}

/**
 * The two filters the screen offers, as the wire wants them. `null` means the
 * person did not choose that filter, so the parameter is dropped from the URL
 * rather than sent empty.
 *
 * LIVE PROBE (2026-11-19, session-authenticated, table in
 * docs/_artifacts/aud/DONE.md): the event-type filter's real wire parameter is
 * `action` — `event_type` is accepted but IGNORED (the whole unfiltered ledger
 * comes back), so sending it would be a control that pretends. `action` is
 * matched EXACTLY: the dotted spelling the service uses (`task.created`)
 * returns its rows, an underscore respelling (`task_created`) returns zero.
 * That is why the choices are the sampled live codes verbatim
 * (`LIVE_ACTION_CODES` in model.ts), not this module's internal vocabulary.
 * `from`/`to` are the two ISO instants of the chosen time window and were
 * probed working. `actorId` also exists on the wire, but there is no operator
 * directory to pick a value from, so the operator control stays 未接入 (GAP-06).
 */
export interface ListFilters {
  /** Wire name `action`; the event-type filter's chosen live code. */
  action: string | null;
  from: string | null;
  to: string | null;
  /**
   * aud8: wire name `actorId`. Live probe #11 (2026-11-19) showed it exists
   * AND filters (50/50 rows back with `actor.id === employee-api`), but it only
   * takes a machine handle — there is no named-operator directory to build a
   * picker from, so the on-screen picker stays 未接入 (GAP-06) while a handle
   * handed over in the URL (`?actor=`) is honoured on the wire, never invented.
   * Optional because a filter set predating aud8 simply carries neither key.
   */
  actor?: string | null;
  /**
   * aud8: wire name `resourceId`. Named by the route's own 400 body as one of
   * the seven accepted filters, but never probed on its own (DONE.md gap list),
   * so the screen says 「效果未单独验证」 rather than claiming a filtered answer.
   */
  resource?: string | null;
}

export const NO_FILTERS: ListFilters = { action: null, from: null, to: null, actor: null, resource: null };

/**
 * One page of the ledger. `cursor` is the opaque value the previous answer
 * carried; without it the request asks for the newest page only. `limit` is
 * always sent so the denominator on screen matches what was asked for.
 */
export function listUrl(cursor: string | null = null, filters: ListFilters = NO_FILTERS, limit = PAGE_LIMIT): string {
  let url = LIST_PATH;
  url = appendQuery(url, "limit", String(limit));
  url = appendQuery(url, "action", filters.action);
  url = appendQuery(url, "from", filters.from);
  url = appendQuery(url, "to", filters.to);
  // aud8: the two handle filters, only when the URL handed one over. An
  // unchosen filter is dropped from the wire, never sent empty.
  url = appendQuery(url, "actorId", filters.actor ?? null);
  url = appendQuery(url, "resourceId", filters.resource ?? null);
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
export async function fetchList(cursor: string | null, filters: ListFilters = NO_FILTERS): Promise<AuditPage | null> {
  const payload = await fetchJSON<unknown>(listUrl(cursor, filters));
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
