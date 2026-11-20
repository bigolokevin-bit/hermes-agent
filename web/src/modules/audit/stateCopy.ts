/**
 * audF — one table for the four states, shared by the three surfaces.
 *
 * The rule this file exists to hold: the SAME failure must not be called two
 * different things depending on which panel painted it. The reason sentence has
 * always come from one place (`readFailure` in copy.ts); what drifted was the
 * STATE around it — the list said 「没能加载」 while a record pane said
 * 「没能加载出来」, and an unwired read口 could be mistaken for an empty answer.
 *
 * So: one label per phase, one mark per (surface × phase), and the two empty
 * kinds kept apart — 「该条件下无事件」 is what the service answered when the
 * question was fine and the ledger is empty; 「读口未接入」 is a route that does
 * not exist here, which is never painted as zero records.
 */

/** The three surfaces this page family has, plus the chain check. */
export type StateSlot = "list" | "preview" | "detail" | "verify";

/** The states every one of them speaks in the same words. */
export type StatePhase = "loading" | "empty" | "unwired" | "error" | "denied";

/** The canonical label of a phase. Identical in all three surfaces. */
export const STATE_LABEL: Record<StatePhase, string> = {
  loading: "正在读取",
  empty: "该条件下无事件",
  unwired: "这个读口在本环境未接入",
  error: "读取没有完成",
  denied: "暂时无法查看审计事件",
};

/**
 * audS: the denied body, in one sentence, used by all three faces. 403 and 404
 * paint this same text — the point of a shared body is that one code cannot
 * grow a paragraph the other does not have.
 */
export const DENIED_BODY_SENTENCE =
  "这块内容要么尚未对你开放，要么当前环境还没有提供它。这里不会显示任何猜测的内容。需要查看审计记录时，请联系工作区管理员为你开通。";

/** The line a face prints for a phase, when the phase itself is the message. */
export function stateSentenceFor(phase: StatePhase, failureSentence?: string | null): string {
  // A failed read speaks its own reason (same helper, same words, every face).
  // A refused read speaks ONE sentence in every face — the body paragraph below
  // it is shared too, but the sentence a probe compares is the headline.
  if (phase === "error") return (failureSentence ?? "").trim() || STATE_LABEL.error;
  return STATE_LABEL[phase];
}

/** A probe locator for one surface in one state: `audF-state-list-error`. */
export function stateMark(slot: StateSlot, phase: StatePhase): string {
  return `audF-state-${slot}-${phase}`;
}

/** The reason a denied answer is really an unwired route, in the panel's words. */
export function unwiredReasonFor(status: number | null | undefined, technical: string | null): string | null {
  if (status !== 404) return null;
  const raw = (technical ?? "").toLowerCase();
  // Only a route that is not there counts. A record the ledger does not have
  // (`audit.event_not_found`) stays a plain read of one event, and 403 stays a
  // closed door: the two codes must keep ONE body on screen.
  if (!raw.includes("unknown_route") && !raw.includes("static asset not found")) return null;
  return "这个地址在当前环境里没有提供（读口未接入）。";
}
