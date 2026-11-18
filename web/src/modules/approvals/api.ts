/**
 * approvals data layer — T16 pending queue + T17 history (lane console-approvals).
 *
 * Every call goes to the console BFF over the same-origin proxy; nothing here is
 * mocked. Paths are the ones the repo itself names:
 *   list    `GET  /agent-api/api/approvals`        (`?status=&limit=&cursor=`)
 *   detail  `GET  /agent-api/api/approval?id=`     (web/src/shell/routes.ts row 7,
 *                                                    docs/_artifacts/D/T02-ENDPOINT-RECONCILIATION.md)
 *   decision `POST /agent-api/api/approval/decision?id=` — the BFF's single approval
 *   write route (`X-Console-Write: 1`, body `{verdict, comment?}`).
 *
 * The BFF forwards upstream shapes verbatim, so every field is read defensively:
 * an absent value stays absent (rendered `—` with a reason) and never becomes 0,
 * an empty string or a guessed name. See model.ts for the readers.
 */
import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";

import { approvalDetailFrom, approvalsPageFrom, type ApprovalDetail, type ApprovalPage } from "./model";

export const LIST_PATH = "/agent-api/api/approvals";
export const DETAIL_PATH = "/agent-api/api/approval";
export const DECISION_PATH = "/agent-api/api/approval/decision";

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
 * Records a decision. The BFF rejects a write without its anti-forgery header, so
 * the two headers it asks for are sent verbatim; the body carries nothing else —
 * an empty comment is omitted rather than sent as "".
 */
export async function postDecision(id: string, verdict: Verdict, comment?: string): Promise<unknown> {
  const body: Record<string, unknown> = { verdict };
  const note = comment?.trim();
  if (note) body.comment = note;
  return fetchJSON<unknown>(decisionUrl(id), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Console-Write": "1",
    },
    body: JSON.stringify(body),
  });
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

/** 405/501 = the write route is not open in this deployment: a degradation, not a bug. */
export function isWriteUnavailable(status: number): boolean {
  return status === 405 || status === 501;
}
