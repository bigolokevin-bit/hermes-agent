/**
 * R121 — the one line a person copies out of the record pane.
 *
 * `auditCopyText` is the ONLY builder of that text: the time goes through the
 * module's own time reading (so the copied seconds are the seconds on screen,
 * with the same 北京时间（UTC+8） wording and never a browser-time guess), the
 * operator/action/resource segments are the labels the model already prints
 * (显示名 + 8 位短码 — a raw internal handle never reaches a clipboard), and an
 * absent field is 「—」 rather than a blank or a guess.
 *
 * WHY 「—」 AND NOT audC's 「该字段未返回」: these are two different lines with two
 * different promises. audC's 结论行 (`summary.ts`) is a report of what the SERVICE
 * answered, so an absent field names the absence. This line is a reading of the
 * record as it stands on the screen, where 「—」 is the module's own empty marker
 * (the same one the 对象 column shows when no type and no id came back). Keeping
 * them distinct is deliberate — do not "unify" one into the other.
 */

import { shortCode } from "./model";
import { AUDJ_TIME_MISSING, AUDJ_TIME_ZONE, auditTimeView } from "./timeActor";

/** What the surface shows for one field: the label the model already printed. */
export interface CopyableLabel {
  label: string;
}

/** What an absent field looks like in this line. */
export const DETAIL_COPY_ABSENT = "—";

/** What the button says out loud; the aria-label names the thing, not the format. */
export const DETAIL_COPY_LABEL = "复制该事件";

/** Why the control is there but cannot be used. */
export const DETAIL_COPY_DISABLED_TITLE = "还没有选中一条审计事件，没有可复制的内容";

/** The fields the line is made of, in the order it prints them. */
export interface CopyableEvent {
  occurredAtRaw?: string | null;
  occurredAt: string | null;
  recordedAt?: string | null;
  actor: CopyableLabel;
  action: CopyableLabel;
  resource: CopyableLabel;
  correlation: string | null;
}

/**
 * Absence, once, for every field: a missing or blank value is 「—」, and a real
 * 0 stays 0 — a count of zero is an answer, not a hole.
 */
export function copyFieldValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return DETAIL_COPY_ABSENT;
  if (typeof value === "number") return String(value);
  const text = value.trim();
  return text === "" ? DETAIL_COPY_ABSENT : text;
}

/** The label the screen shows, or 「—」 when the model had nothing to show. */
function labelOrAbsent(part: CopyableLabel | undefined): string {
  return copyFieldValue(part?.label ?? null);
}

/**
 * The correlation handle masked the way the module masks every handle (last
 * readable segment, 8 characters). The raw value stays in the technical fold.
 */
function correlationSegment(correlation: string | null): string {
  if (correlation === null) return DETAIL_COPY_ABSENT;
  const code = shortCode(correlation);
  return copyFieldValue(code === "" ? correlation : code);
}

/** 时间 · 操作者 · 动作 · 资源 · 同一次操作, with the zone spelled like the screen. */
export function auditCopyText(event: CopyableEvent): string {
  const time = auditTimeView(event.occurredAtRaw ?? null, event.occurredAt);
  // The time helper already returns 「该字段未返回」 when nothing came back; the
  // zone tag only ever rides on a real instant, so an absent time stays one word.
  const when = time.text === AUDJ_TIME_MISSING ? AUDJ_TIME_MISSING : `${time.text} ${AUDJ_TIME_ZONE}`;
  return [
    when,
    labelOrAbsent(event.actor),
    labelOrAbsent(event.action),
    labelOrAbsent(event.resource),
    correlationSegment(event.correlation),
  ].join(" · ");
}
