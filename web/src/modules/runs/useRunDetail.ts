/**
 * T15 (PRD v4.1) detail read — one run plus its event timeline.
 *
 * Same discipline as the list: nothing renders that the service did not
 * answer. The current answer is stored against the (runId, tick) pair that
 * asked for it — selecting a different run can never leave a previous run
 * on screen pretending to be the new one, and 「重新读取」 really asks
 * again. A 403 and a 404 for one run draw the same denied body the list
 * uses: one body, no path echo, no invented rows.
 *
 * Fixture debt burn (R30): the `?state=` repro leg is gone from this page,
 * so a detail always reflects a real read of the run and its events.
 */
import { useEffect, useState } from "react";

import {
  errorInfo,
  loadRunDetail,
  loadRunEvents,
  type ErrorInfo,
  type RunDetail,
  type RunEvent,
} from "./runs";

export type DetailOutcome =
  | { k: "idle" }
  | { k: "loading" }
  | {
      k: "ready";
      run: RunDetail;
      events: RunEvent[];
      hasMore: boolean;
      eventsFailure: ErrorInfo | null;
    }
  | { k: "error"; denied: boolean; failure: ErrorInfo };

export const DETAIL_IDLE: DetailOutcome = { k: "idle" };

export function useRunDetail(runId: string | null, tick: number): DetailOutcome {
  const [read, setRead] = useState<{ key: string; settled: DetailOutcome } | null>(null);

  useEffect(() => {
    if (runId === null) return;
    let alive = true;
    const key = `${runId}|${tick}`;
    void Promise.allSettled([loadRunDetail(runId), loadRunEvents(runId)]).then(([runRes, evRes]) => {
      if (!alive) return;
      if (runRes.status === "rejected") {
        const info = errorInfo(runRes.reason);
        const denied = info.status === 403 || info.status === 404;
        setRead({ key, settled: { k: "error", denied, failure: info } });
        return;
      }
      const events = evRes.status === "fulfilled" ? evRes.value.items : [];
      setRead({
        key,
        settled: {
          k: "ready",
          run: runRes.value,
          events,
          hasMore: evRes.status === "fulfilled" ? evRes.value.hasMore : false,
          eventsFailure: evRes.status === "rejected" ? errorInfo(evRes.reason) : null,
        },
      });
    });
    return () => {
      alive = false;
    };
  }, [runId, tick]);

  if (runId === null) return DETAIL_IDLE;
  const key = `${runId}|${tick}`;
  if (read !== null && read.key === key) return read.settled;
  return { k: "loading" };
}
