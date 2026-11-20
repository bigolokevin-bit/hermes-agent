import type { AuditDetail, AuditRow } from "./model";

/**
 * audC — the one-line 结论 a person copies out of /audit.
 *
 * Both legs (the inline row preview and the event detail) build their copy
 * text here, so the same event cannot produce two different sentences from two
 * different panels: one builder, one field order, one missing-field word.
 *
 * The line is built from data that is ALREADY on screen. Nothing in this
 * module reaches the network — a copy is a read of what the service already
 * answered, never a second question about it.
 *
 * Order (fixed, and asserted by the tests): 时间（北京时间，到秒）· 操作者 ·
 * 动作 · 资源 · 请求编号. 请求编号 is not a secret (every other copy control on
 * this surface already offers it), so it rides along; a field the service did
 * not send says 「该字段未返回」 instead of being dropped, so a pasted line never
 * looks like a shorter window than it was.
 */

/** What one copied line is made of, in the shape both model views can supply. */
export interface SummarySource {
  /** Raw instant as the service sent it (ISO), if it sent one. */
  occurredAtRaw?: string | null;
  /** The same instant already spoken in Beijing time, to the minute. */
  occurredAt: string | null;
  /** Person-readable actor, e.g. 「李思 · 6d7e8f90」 or 「员工 · 5b4a3f21」. */
  actorLabel: string;
  /** Human name of the action, or the code verbatim when it is unknown. */
  actionLabel: string;
  /** Human name of what was touched, e.g. 「审批单 · 55667788」. */
  resourceLabel: string;
  /** 请求编号, or null when the answer said none. */
  requestId: string | null;
}

/** The word a missing field takes inside a copied line — never a blank, never a guess. */
export const SUMMARY_MISSING = "该字段未返回";

/**
 * The line itself. `seconds` comes from the caller's own formatter (the model
 * owns Beijing time), so this stays a formatting contract, not a second clock.
 */
export function summaryLineOf(source: SummarySource, seconds: string | null): string {
  const parts = [
    seconds ?? source.occurredAt ?? SUMMARY_MISSING,
    source.actorLabel?.trim() || SUMMARY_MISSING,
    source.actionLabel?.trim() || SUMMARY_MISSING,
    source.resourceLabel?.trim() || SUMMARY_MISSING,
    source.requestId ?? SUMMARY_MISSING,
  ];
  return parts.join(" · ");
}

/** The label of the copy control, so both legs promise the same thing. */
export const SUMMARY_COPY_LABEL = "复制结论行";

/** A shape both model views can answer from: one row, or one detail record. */
interface SummaryParts {
  occurredAt: string | null;
  actorLabel: string;
  actionLabel: string;
  resourceLabel: string;
  requestId: string | null;
}

/** The line for a loaded list row (the inline preview). */
export function summaryFromRow(row: AuditRow, seconds: string | null): string {
  const parts: SummaryParts = {
    occurredAt: row.occurredAt,
    actorLabel: row.actor.label,
    actionLabel: row.action.label,
    resourceLabel: row.resource.label,
    requestId: row.requestId,
  };
  return summaryLineOf({ ...parts, occurredAtRaw: row.occurredAtRaw ?? null }, seconds);
}

/** The line for one opened record (the detail). Same builder, same order. */
export function summaryFromDetail(detail: AuditDetail, seconds: string | null): string {
  const parts: SummaryParts = {
    occurredAt: detail.occurredAt,
    actorLabel: detail.actor.label,
    actionLabel: detail.action.label,
    resourceLabel: detail.resource.label,
    requestId: detail.requestId,
  };
  return summaryLineOf({ ...parts, occurredAtRaw: detail.occurredAtRaw }, seconds);
}
